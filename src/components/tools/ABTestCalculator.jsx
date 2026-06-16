import { useState } from 'react';

function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t * (0.319381530 +
      t * (-0.356563782 +
        t * (1.781477937 +
          t * (-1.821255978 +
            t * 1.330274429))));
  const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - pdf * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

function normalPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

const Z_THRESHOLDS = { 80: 1.282, 90: 1.645, 95: 1.960, 99: 2.576 };


function validateInputs(vA, cA, vB, cB) {
  const errors = {};
  if (vA === '' || cA === '' || vB === '' || cB === '') {
    errors.general = 'All four fields are required.';
    return errors;
  }
  const nVA = Number(vA), nCA = Number(cA), nVB = Number(vB), nCB = Number(cB);
  if (nVA <= 0) errors.vA = 'X must be greater than 0.';
  if (nVB <= 0) errors.vB = 'X must be greater than 0.';
  if (nCA > nVA) errors.cA = 'Y cannot exceed X.';
  if (nCB > nVB) errors.cB = 'Y cannot exceed X.';
  if (nVA < 100 || nVB < 100) errors.sample = 'Not enough data. Run at least 100 X per variation before checking significance.';
  return errors;
}

function calculate(vA, cA, vB, cB) {
  const nVA = Number(vA), nCA = Number(cA), nVB = Number(vB), nCB = Number(cB);
  const cvrA = nCA / nVA;
  const cvrB = nCB / nVB;
  const relativeLift = ((cvrB - cvrA) / cvrA) * 100;
  const pooled = (nCA + nCB) / (nVA + nVB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nVA + 1 / nVB));
  const z = se === 0 ? 0 : (cvrB - cvrA) / se;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  const confidence = (1 - pValue) * 100;
  return { cvrA, cvrB, relativeLift, pooled, z, confidence, nVA, nCA, nVB, nCB };
}

function additionalNeeded(zThresh, cvrA, cvrB, pooled, currentN) {
  const diff = Math.abs(cvrB - cvrA);
  if (diff === 0) return Infinity;
  const zPower = 0.84;
  const totalNeeded = Math.ceil(Math.pow((zThresh + zPower) / diff, 2) * pooled * (1 - pooled) * 2);
  return Math.max(0, totalNeeded - currentN);
}

function DistributionCurve({ cvrA, cvrB, nVA, nVB, xLabel, yLabel }) {
  const sdA = Math.sqrt(cvrA * (1 - cvrA) / nVA);
  const sdB = Math.sqrt(cvrB * (1 - cvrB) / nVB);
  const maxSd = Math.max(sdA, sdB);
  const minX = Math.min(cvrA, cvrB) - 4 * maxSd;
  const maxX = Math.max(cvrA, cvrB) + 4 * maxSd;

  const W = 600, BASELINE = 175, PADDING = 20;
  const plotW = W - PADDING * 2;

  function toSvgX(x) {
    return PADDING + ((x - minX) / (maxX - minX)) * plotW;
  }

  const N = 300;
  const step = (maxX - minX) / N;

  function curvePDF(x, mean, sd) {
    if (sd === 0) return 0;
    return normalPDF((x - mean) / sd) / sd;
  }

  const xs = Array.from({ length: N + 1 }, (_, i) => minX + i * step);
  const yA = xs.map(x => curvePDF(x, cvrA, sdA));
  const yB = xs.map(x => curvePDF(x, cvrB, sdB));
  const maxY = Math.max(...yA, ...yB);
  const yScale = maxY > 0 ? (BASELINE - 15) / maxY : 1;

  function toSvgY(y) {
    return BASELINE - y * yScale;
  }

  function buildPath(ys) {
    const pts = xs.map((x, i) => `${toSvgX(x).toFixed(1)},${toSvgY(ys[i]).toFixed(1)}`);
    const first = `${toSvgX(xs[0]).toFixed(1)},${BASELINE}`;
    const last = `${toSvgX(xs[xs.length - 1]).toFixed(1)},${BASELINE}`;
    return `M ${first} L ${pts.join(' L ')} L ${last} Z`;
  }

  const peakXA = toSvgX(cvrA);
  const peakXB = toSvgX(cvrB);
  const peakYA = toSvgY(curvePDF(cvrA, cvrA, sdA));
  const peakYB = toSvgY(curvePDF(cvrB, cvrB, sdB));
  const labelYA = Math.max(peakYA - 8, 10);
  const labelYB = Math.max(peakYB - 8, 10);

  return (
    <div style={{ marginBottom: 20 }}>
      <svg viewBox={`0 0 ${W} 200`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <line x1={PADDING} y1={BASELINE} x2={W - PADDING} y2={BASELINE} stroke="#d1d5db" strokeWidth="1" />
        <path d={buildPath(yA)} fill="rgba(37,99,235,0.12)" stroke="#2563EB" strokeWidth="2" />
        <path d={buildPath(yB)} fill="rgba(29,158,117,0.12)" stroke="#1D9E75" strokeWidth="2" />
        <line x1={peakXA} y1={peakYA} x2={peakXA} y2={BASELINE} stroke="#2563EB" strokeWidth="1.5" strokeDasharray="4,3" />
        <line x1={peakXB} y1={peakYB} x2={peakXB} y2={BASELINE} stroke="#1D9E75" strokeWidth="1.5" strokeDasharray="4,3" />
        <text x={peakXA} y={labelYA} textAnchor="middle" fontSize="11" fill="#2563EB" fontWeight="600">{(cvrA * 100).toFixed(2)}%</text>
        <text x={peakXB} y={labelYB} textAnchor="middle" fontSize="11" fill="#1D9E75" fontWeight="600">{(cvrB * 100).toFixed(2)}%</text>
      </svg>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b6a68' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#2563EB' }} />
          Variation A {yLabel} rate
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b6a68' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#1D9E75' }} />
          Variation B {yLabel} rate
        </span>
      </div>
    </div>
  );
}

const STAGE_TABLE = [
  { conf: '80%', stage: 'Early stage / Growth', description: 'Budget is limited and speed matters. The cost of waiting outweighs the cost of an occasional wrong call. Act directionally.' },
  { conf: '90%', stage: 'Scaling / Optimization', description: 'More budget at stake. Directional confidence is still acceptable but you want stronger signal before reallocating spend.' },
  { conf: '95%', stage: 'Large budget / High stakes', description: 'Standard threshold when significant spend is on the line. Not medical grade but appropriate for major channel or creative decisions.' },
  { conf: '99%', stage: 'Medical / Legal / Financial', description: 'Regulatory or liability implications. Not required for marketing campaign optimization.' },
];


export default function ABTestCalculator() {
  const [vA, setVA] = useState('');
  const [cA, setCA] = useState('');
  const [vB, setVB] = useState('');
  const [cB, setCB] = useState('');
  const [confidence, setConfidence] = useState(80);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [showMethod, setShowMethod] = useState(false);
  const [showStage, setShowStage] = useState(false);
  const [showSampleSize, setShowSampleSize] = useState(false);
  const [showGrowth, setShowGrowth] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const [xInput, setXInput] = useState('');
  const [yInput, setYInput] = useState('');

  const xLabel = xInput.trim() || 'X';
  const yLabel = yInput.trim() || 'Y';

  function handleCalculate() {
    const errs = validateInputs(vA, cA, vB, cB);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setResult(null);
      return;
    }
    setResult(calculate(vA, cA, vB, cB));
  }

  const inputClass = `
    w-full border border-gray-200 rounded-[6px] px-3 py-2 text-sm text-[#1a1a19]
    focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]
    placeholder-gray-400
  `;

  const isSignificant = result && result.confidence >= confidence;
  const zThresh = Z_THRESHOLDS[confidence];

  let meterColor = '#d1d5db';
  if (result) {
    const gap = result.confidence - confidence;
    if (result.confidence >= confidence) meterColor = '#16a34a';
    else if (gap >= -5) meterColor = '#ca8a04';
  }

  const thresholdPct = confidence;
  const fillPct = result ? Math.min(result.confidence, 100) : 0;

  function decisionGuidance() {
    if (!result) return null;
    if (isSignificant) {
      if (confidence === 80) return 'This is a directional signal. Appropriate for early stage programs or low-budget tests. Consider running longer to reach 90% if budget at stake is significant.';
      if (confidence === 90) return 'Strong signal. Appropriate for most paid media optimization decisions.';
      return 'High confidence result.';
    }
    return `If you need to act now, your current confidence is ${result.confidence.toFixed(1)}%. At early or growth stage, 80% confidence may be sufficient for a directional decision.`;
  }

  return (
    <div style={{ fontFamily: 'inherit', color: '#1a1a19' }}>
      {/* Input grid */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '8px 12px', alignItems: 'end', marginBottom: 8 }}>
          <div />
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b6a68', paddingBottom: 4 }}>X (Input)</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b6a68', paddingBottom: 4 }}>Y (Output)</div>

          <div style={{ fontSize: 13, fontWeight: 500, paddingBottom: 8 }}>Variation A (Control)</div>
          <div>
            <input type="number" className={inputClass} placeholder="e.g. 5,000" value={vA} onChange={e => setVA(e.target.value)} min="0" style={{ borderColor: errors.vA ? '#dc2626' : undefined }} />
            {errors.vA && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 3 }}>{errors.vA}</p>}
          </div>
          <div>
            <input type="number" className={inputClass} placeholder="e.g. 250" value={cA} onChange={e => setCA(e.target.value)} min="0" style={{ borderColor: errors.cA ? '#dc2626' : undefined }} />
            {errors.cA && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 3 }}>{errors.cA}</p>}
          </div>

          <div style={{ fontSize: 13, fontWeight: 500, paddingTop: 4 }}>Variation B (Test)</div>
          <div>
            <input type="number" className={inputClass} placeholder="e.g. 5,000" value={vB} onChange={e => setVB(e.target.value)} min="0" style={{ borderColor: errors.vB ? '#dc2626' : undefined }} />
            {errors.vB && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 3 }}>{errors.vB}</p>}
          </div>
          <div>
            <input type="number" className={inputClass} placeholder="e.g. 250" value={cB} onChange={e => setCB(e.target.value)} min="0" style={{ borderColor: errors.cB ? '#dc2626' : undefined }} />
            {errors.cB && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 3 }}>{errors.cB}</p>}
          </div>
        </div>

        <p style={{ fontSize: 11, color: '#9b9a97', marginBottom: 8 }}>
          X and Y can represent any two-step funnel. Examples: clicks and leads, impressions and MQLs, sessions and signups, leads and closed-won.
        </p>

        {errors.sample && (
          <p style={{ color: '#ca8a04', fontSize: 12, background: '#fefce8', border: '1px solid #fef08a', borderRadius: 6, padding: '8px 12px', marginTop: 4 }}>
            {errors.sample}
          </p>
        )}
        {errors.general && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{errors.general}</p>}
      </div>

      {/* Label inputs (optional) */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
        <button
          onClick={() => setShowContext(v => !v)}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f8f7', border: 'none', padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#6b6a68', cursor: 'pointer' }}
        >
          <span>Label your inputs (optional)</span>
          <span style={{ fontSize: 15 }}>{showContext ? '-' : '+'}</span>
        </button>
        {showContext && (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#6b6a68' }}>What is X?</p>
              <input
                type="text"
                placeholder="e.g. Clicks, Impressions, MQLs"
                value={xInput}
                onChange={e => setXInput(e.target.value)}
                style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: '#1a1a19', width: '100%' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#6b6a68' }}>What is Y?</p>
              <input
                type="text"
                placeholder="e.g. Leads, MQLs, Closed-won"
                value={yInput}
                onChange={e => setYInput(e.target.value)}
                style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: '#1a1a19', width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Confidence selector */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#6b6a68', marginBottom: 8 }}>Confidence level</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {[80, 90, 95, 99].map(lvl => (
            <button
              key={lvl}
              onClick={() => setConfidence(lvl)}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: confidence === lvl ? '2px solid #2563EB' : '2px solid #e5e7eb',
                background: confidence === lvl ? '#eff6ff' : 'white',
                color: confidence === lvl ? '#2563EB' : '#6b6a68',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {lvl}%
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <p style={{ fontSize: 11, color: '#6b6a68' }}>80%: Directional signal. Reasonable to act at early stage or when budget at stake is low.</p>
          <p style={{ fontSize: 11, color: '#6b6a68' }}>90%: Strong signal. Appropriate for most paid media optimization decisions.</p>
          <p style={{ fontSize: 11, color: '#6b6a68' }}>95% and 99%: Higher confidence threshold. Appropriate when the decision carries significant budget or risk.</p>
        </div>
      </div>

      {/* Calculate button */}
      <button
        onClick={handleCalculate}
        style={{ width: '100%', background: '#2563EB', color: 'white', border: 'none', borderRadius: 6, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 32 }}
      >
        Calculate significance
      </button>

      {/* Results */}
      {result && (
        <div>
          <DistributionCurve cvrA={result.cvrA} cvrB={result.cvrB} nVA={result.nVA} nVB={result.nVB} xLabel={xLabel} yLabel={yLabel} />

          {/* CVR tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
            <div style={{ background: '#f8f8f7', borderRadius: 6, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, color: '#6b6a68', marginBottom: 4 }}>Variation A {yLabel} rate</p>
              <p style={{ fontSize: 20, fontWeight: 700 }}>{(result.cvrA * 100).toFixed(2)}%</p>
            </div>
            <div style={{ background: '#f8f8f7', borderRadius: 6, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, color: '#6b6a68', marginBottom: 4 }}>Variation B {yLabel} rate</p>
              <p style={{ fontSize: 20, fontWeight: 700 }}>{(result.cvrB * 100).toFixed(2)}%</p>
            </div>
            <div style={{ background: '#f8f8f7', borderRadius: 6, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, color: '#6b6a68', marginBottom: 4 }}>Relative lift in {yLabel} rate</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: result.relativeLift >= 0 ? '#16a34a' : '#dc2626' }}>
                {result.relativeLift >= 0 ? '+' : ''}{result.relativeLift.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Confidence meter */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              Statistical confidence: {result.confidence.toFixed(1)}%
            </p>
            <div style={{ position: 'relative', height: 12, background: '#e5e7eb', borderRadius: 6, overflow: 'visible' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${fillPct}%`, background: meterColor, borderRadius: 6, transition: 'width 0.4s ease' }} />
              <div style={{ position: 'absolute', left: `${thresholdPct}%`, top: -4, bottom: -4, width: 2, background: '#1a1a19', borderRadius: 1, zIndex: 2 }} />
            </div>
            <p style={{ fontSize: 11, color: '#9b9a97', marginTop: 6 }}>
              Threshold: {confidence}% (your selected confidence level)
            </p>
          </div>

          {/* Winner declaration */}
          {isSignificant ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '16px 20px', marginBottom: 20 }}>
              <p style={{ fontWeight: 700, fontSize: 16, color: '#15803d', marginBottom: 8 }}>
                {result.cvrB > result.cvrA ? 'Variation B wins' : 'Variation A wins'}
              </p>
              <p style={{ fontSize: 13, color: '#166534', lineHeight: 1.6, marginBottom: 8 }}>
                {result.cvrB > result.cvrA
                  ? `Variation B's ${yLabel} rate of ${(result.cvrB * 100).toFixed(2)}% is ${Math.abs(result.relativeLift).toFixed(1)}% higher than Variation A's ${yLabel} rate of ${(result.cvrA * 100).toFixed(2)}%.`
                  : `Variation A's ${yLabel} rate of ${(result.cvrA * 100).toFixed(2)}% is ${Math.abs(result.relativeLift).toFixed(1)}% higher than Variation B's ${yLabel} rate of ${(result.cvrB * 100).toFixed(2)}%.`
                }{' '}
                You can be {result.confidence.toFixed(0)}% confident this difference is not due to chance. At this traffic level, this result would occur by random chance only 1 in {Math.round(1 / (1 - result.confidence / 100))} times.
              </p>
              <p style={{ fontSize: 12, color: '#15803d', fontStyle: 'italic' }}>{decisionGuidance()}</p>
            </div>
          ) : (
            <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: 6, padding: '16px 20px', marginBottom: 20 }}>
              <p style={{ fontWeight: 700, fontSize: 16, color: '#854d0e', marginBottom: 8 }}>Not yet significant</p>
              {result.cvrA > result.cvrB && (
                <p style={{ fontSize: 13, color: '#713f12', marginBottom: 8 }}>
                  Variation A is currently outperforming Variation B, but the result is not yet statistically significant.
                </p>
              )}
              <p style={{ fontSize: 13, color: '#713f12', lineHeight: 1.6, marginBottom: 8 }}>
                Your current confidence is {result.confidence.toFixed(1)}%. You need {confidence}% to call a winner.
                {' '}
                {result.pooled && isFinite(additionalNeeded(zThresh, result.cvrA, result.cvrB, result.pooled, Math.max(result.nVA, result.nVB))) && additionalNeeded(zThresh, result.cvrA, result.cvrB, result.pooled, Math.max(result.nVA, result.nVB)) > 0 && (
                  <>You need approximately {additionalNeeded(zThresh, result.cvrA, result.cvrB, result.pooled, Math.max(result.nVA, result.nVB)).toLocaleString()} more {xLabel} per variation to reach significance at 80% power. Keep running the test.</>
                )}
              </p>
              <p style={{ fontSize: 12, color: '#854d0e', fontStyle: 'italic' }}>{decisionGuidance()}</p>
            </div>
          )}

        </div>
      )}

      {/* Always-visible collapsible sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>

        {/* How this is calculated */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
          <button
            onClick={() => setShowMethod(v => !v)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f8f7', border: 'none', padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1a1a19', cursor: 'pointer' }}
          >
            <span>How this is calculated</span>
            <span style={{ fontSize: 16 }}>{showMethod ? '-' : '+'}</span>
          </button>
          {showMethod && (
            <div style={{ padding: '14px 16px', fontSize: 13, color: '#4b5563', lineHeight: 1.7 }}>
              <p style={{ marginBottom: 10 }}>
                This calculator uses a two-tailed frequentist z-test for proportions. It works for any two-step funnel where you are comparing the rate at which {xLabel} converts to {yLabel} across two variations.
              </p>
              <p style={{ marginBottom: 10 }}>
                Sample size estimates include 80% statistical power (z=0.84), meaning the test has an 80% probability of detecting a real difference if one exists. This is the industry standard assumption for experiment design.
              </p>
              <p style={{ fontSize: 12, color: '#9b9a97' }}>
                Sources:{' '}
                <a href="https://blog.analytics-toolkit.com/2017/statistical-significance-ab-testing-complete-guide/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>
                  Analytics Toolkit: Complete Guide to Statistical Significance in A/B Testing
                </a>
                {' '}and{' '}
                <a href="https://towardsdatascience.com/why-most-a-b-tests-are-lying-to-you/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>
                  Towards Data Science: Why Most A/B Tests Are Lying to You
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Confidence level guide by growth stage */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
          <button
            onClick={() => setShowStage(v => !v)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f8f7', border: 'none', padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1a1a19', cursor: 'pointer' }}
          >
            <span>Confidence level guide by growth stage</span>
            <span style={{ fontSize: 16 }}>{showStage ? '-' : '+'}</span>
          </button>
          {showStage && (
            <div style={{ padding: '14px 16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b6a68', fontWeight: 600 }}>Confidence</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b6a68', fontWeight: 600 }}>Stage</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b6a68', fontWeight: 600 }}>When to use</th>
                  </tr>
                </thead>
                <tbody>
                  {STAGE_TABLE.map((row, i) => (
                    <tr key={row.conf} style={{ background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#1a1a19', whiteSpace: 'nowrap' }}>{row.conf}</td>
                      <td style={{ padding: '8px', color: '#4b5563', whiteSpace: 'nowrap' }}>{row.stage}</td>
                      <td style={{ padding: '8px', color: '#4b5563', lineHeight: 1.5 }}>{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.6, marginBottom: 10 }}>
                At 80% confidence you are accepting a 1 in 5 chance of a false positive to keep moving. For a small test budget that is a rational trade-off. For a $500K campaign change, probably not.
              </p>
              <p style={{ fontSize: 11, color: '#9b9a97', lineHeight: 1.6 }}>
                Sources:{' '}
                <a href="https://www.airship.com/blog/a-b-testing-the-science-behind-the-numbers/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>Airship: When and why to adjust your confidence threshold</a>
                {', '}
                <a href="https://www.invespcro.com/ab-testing/results-analysis/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>Invesp: How to analyze A/B test results</a>
                {', '}
                <a href="https://blog.analytics-toolkit.com/2017/statistical-significance-ab-testing-complete-guide/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>Analytics Toolkit: Statistical significance in A/B testing: complete guide</a>
              </p>
            </div>
          )}
        </div>

        {/* Sample size guidance by channel */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
          <button
            onClick={() => setShowSampleSize(v => !v)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f8f7', border: 'none', padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1a1a19', cursor: 'pointer' }}
          >
            <span>Sample size guidance by channel</span>
            <span style={{ fontSize: 16 }}>{showSampleSize ? '-' : '+'}</span>
          </button>
          {showSampleSize && (
            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 12, color: '#6b6a68', lineHeight: 1.7, marginBottom: 12 }}>
                Sample size requirements vary by channel, baseline conversion rate, and the minimum lift you want to detect. These are practical benchmarks for paid media A/B tests. Some of the claims are sourced from published research; others are based on personal and practitioner guidance.
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 }}>
                <thead>
                  <tr style={{ background: '#f8f8f7' }}>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e5e5e3', color: '#1a1a19', fontWeight: 500 }}>Channel</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e5e5e3', color: '#1a1a19', fontWeight: 500 }}>Typical conversion volume</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e5e5e3', color: '#1a1a19', fontWeight: 500 }}>Significance achievable?</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      channel: 'Google Search (branded)',
                      vol: 'Medium to high. Varies significantly by brand size and search volume.',
                      sig: 'Often achievable in 4 to 8 weeks for high-volume accounts. Smaller B2B brands may see low branded volume and should treat results directionally.',
                      note: 'Sourced: Google Ads 2 to 4 week minimum for high-volume accounts. blog.marketingblatt.com',
                    },
                    {
                      channel: 'Google Search (non-branded)',
                      vol: 'Medium',
                      sig: 'Yes, with 4 to 8 weeks of data at typical B2B conversion volumes. Landing page tests detecting a 40 to 100% CVR lift are achievable in 4 to 6 weeks.',
                      note: 'Sourced: GrowthSpree, Google Ads Experiments for B2B SaaS.',
                    },
                    {
                      channel: 'LinkedIn',
                      vol: 'Low to medium. High cost per conversion.',
                      sig: 'Requires at least 50 conversions per variant for directional data and 100 or more for statistical significance. At a $75 CPL, 100 conversions per variant means approximately $15,000 in total test budget. Plan LinkedIn tests carefully.',
                      note: 'Sourced: Percuity, How to A/B Test LinkedIn Ads Effectively.',
                    },
                    {
                      channel: 'Programmatic and display',
                      vol: 'Low at conversion level',
                      sig: 'Rarely achievable at conversion level. Test CTR first. If your campaign serves fewer than 1,000 impressions per week or generates fewer than 20 conversions per month, plan for 8 to 12 weeks or longer.',
                      note: 'Sourced: ALM Corp, Google Performance Max A/B Testing Guide.',
                    },
                    {
                      channel: 'G2 and review sites',
                      vol: 'Low',
                      sig: 'Rarely achievable at standard significance thresholds. Treat all G2 test results directionally. This is practitioner guidance. No published benchmark exists for G2-specific A/B testing.',
                      note: 'Practitioner guidance. No published source available.',
                    },
                    {
                      channel: 'Email',
                      vol: 'Medium to high',
                      sig: 'Yes for open rate and CTR with at least 20,000 recipients per variant. Conversion-level significance is rarely achievable without very large list sizes.',
                      note: 'Sourced: HubSpot, How to determine your A/B testing sample size and time frame.',
                    },
                  ].map((row, i) => (
                    <tr key={row.channel} style={{ background: i % 2 === 0 ? 'white' : '#f8f8f7', borderBottom: '1px solid #e5e5e3' }}>
                      <td style={{ padding: '8px', fontWeight: 500, color: '#1a1a19', verticalAlign: 'top' }}>{row.channel}</td>
                      <td style={{ padding: '8px', color: '#6b6a68', lineHeight: 1.5, verticalAlign: 'top' }}>{row.vol}</td>
                      <td style={{ padding: '8px', color: '#6b6a68', lineHeight: 1.5, verticalAlign: 'top' }}>
                        {row.sig}
                        <br />
                        <span style={{ fontSize: 10, color: '#9b9a97', fontStyle: 'italic' }}>{row.note}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: '#6b6a68', lineHeight: 1.6, marginTop: 12 }}>
                Required sample size depends on your baseline conversion rate, the minimum lift you want to detect, and your selected confidence threshold. Lower baseline rates and smaller expected lifts require significantly larger samples. Use a sample size calculator before starting any test.
              </p>
              <p style={{ fontSize: 11, color: '#9b9a97', lineHeight: 1.7, marginTop: 8 }}>
                Sources:{' '}
                <a href="https://blog.marketingblatt.com/en/google-ads-ab-testing" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>Google Ads testing minimum duration</a>
                {', '}
                <a href="https://www.growthspreeofficial.com/blogs/google-ads-experiments-b2b-saas-statistical-significance-methodology" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>GrowthSpree: Google Ads Experiments for B2B SaaS</a>
                {', '}
                <a href="https://percuity.ai/answers/linkedin-ads/linkedin-ads-ab-testing/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>Percuity: LinkedIn Ads A/B Testing</a>
                {', '}
                <a href="https://almcorp.com/blog/performance-max-ab-testing-creative-assets-complete-guide/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>ALM Corp: Performance Max A/B Testing</a>
                {', '}
                <a href="https://blog.hubspot.com/marketing/email-a-b-test-sample-size-testing-time" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>HubSpot: Email A/B test sample size</a>
              </p>
            </div>
          )}
        </div>

        {/* Testing at growth stage */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
          <button
            onClick={() => setShowGrowth(v => !v)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff', border: 'none', padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#2563EB', cursor: 'pointer' }}
          >
            <span>Testing at growth stage</span>
            <span style={{ fontSize: 16 }}>{showGrowth ? '-' : '+'}</span>
          </button>
          {showGrowth && (
            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 12, color: '#6b6a68', lineHeight: 1.7, marginBottom: 12 }}>
                If your campaigns are generating fewer than 100 conversions per variation, you may not reach statistical significance regardless of how long you run the test. This is common at growth stage and does not mean the tool is broken or the test failed.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a19', marginBottom: 3 }}>Treat results as directional signals</p>
                  <p style={{ fontSize: 12, color: '#6b6a68', lineHeight: 1.7 }}>A 70 to 80% confidence reading with a consistent directional trend over two or more weeks is often enough to make a budget reallocation decision at growth stage. This is practitioner judgment, not a published statistical standard. Document your hypothesis, result, and confidence level, then revisit when volume increases.</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a19', marginBottom: 3 }}>Test the highest-volume metric first</p>
                  <p style={{ fontSize: 12, color: '#6b6a68', lineHeight: 1.7 }}>If conversions are too low to test, move up the funnel. Test CTR before testing click-to-lead rate. Test impression-level engagement before testing CTR. Work downstream as volume grows.</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a19', marginBottom: 3 }}>Velocity matters more than significance at early stage</p>
                  <p style={{ fontSize: 12, color: '#6b6a68', lineHeight: 1.7 }}>At growth stage you are trying to build intuition about what works, not prove it at 95% confidence. A consistent directional winner across three or more tests can provide more reliable signal than a single result at low sample size, but treat it as a hypothesis to validate, not a conclusion.</p>
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#6b6a68', lineHeight: 1.6, marginTop: 12 }}>
                The right time to switch from directional to statistical decision-making is when your campaigns can generate enough volume to detect a meaningful lift. Use the sample size guidance section above to calculate when that threshold is achievable for your specific baseline conversion rate and budget.
              </p>
              <p style={{ fontSize: 11, color: '#9b9a97', lineHeight: 1.6, marginTop: 8 }}>
                Sources:{' '}
                <a href="https://www.convert.com/blog/a-b-testing/ab-testing-stats/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>Convert.com: A/B Testing Stats 2026</a>
                {' '}and{' '}
                <a href="https://crometrics.com/blog/ab-testing-sample-size/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>CRO Metrics: How to properly determine A/B testing sample size</a>
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
