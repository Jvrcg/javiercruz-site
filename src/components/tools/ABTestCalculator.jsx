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

const X_OPTIONS = ['Clicks', 'Impressions', 'Leads', 'MQLs', 'Sessions', 'Visitors', 'Custom'];
const Y_OPTIONS = ['Lead', 'MQL', 'SQL', 'Demo request', 'Trial signup', 'Closed-won', 'Opportunity', 'Conversion', 'Custom'];

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

function additionalNeeded(zThresh, cvrA, cvrB, pooled) {
  const diff = Math.abs(cvrB - cvrA);
  if (diff === 0) return Infinity;
  return Math.ceil(Math.pow(zThresh / diff, 2) * pooled * (1 - pooled) * 2);
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

const selectStyle = {
  width: '100%',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 13,
  color: '#1a1a19',
  background: 'white',
  cursor: 'pointer',
};

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
  const [showContext, setShowContext] = useState(false);

  const [xSelect, setXSelect] = useState('Visitors');
  const [ySelect, setYSelect] = useState('Conversion');
  const [xCustom, setXCustom] = useState('');
  const [yCustom, setYCustom] = useState('');

  const xLabel = xSelect === 'Custom' ? (xCustom || 'X') : xSelect;
  const yLabel = ySelect === 'Custom' ? (yCustom || 'Y') : ySelect;

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

      {/* Funnel context (optional) */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
        <button
          onClick={() => setShowContext(v => !v)}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f8f7', border: 'none', padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#6b6a68', cursor: 'pointer' }}
        >
          <span>Add funnel context (optional)</span>
          <span style={{ fontSize: 15 }}>{showContext ? '-' : '+'}</span>
        </button>
        {showContext && (
          <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b6a68', marginBottom: 5 }}>What is X?</p>
              <select value={xSelect} onChange={e => setXSelect(e.target.value)} style={selectStyle}>
                {X_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {xSelect === 'Custom' && (
                <input
                  type="text"
                  placeholder="Enter X label"
                  value={xCustom}
                  onChange={e => setXCustom(e.target.value)}
                  style={{ ...selectStyle, marginTop: 6 }}
                />
              )}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6b6a68', marginBottom: 5 }}>What is Y?</p>
              <select value={ySelect} onChange={e => setYSelect(e.target.value)} style={selectStyle}>
                {Y_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {ySelect === 'Custom' && (
                <input
                  type="text"
                  placeholder="Enter Y label"
                  value={yCustom}
                  onChange={e => setYCustom(e.target.value)}
                  style={{ ...selectStyle, marginTop: 6 }}
                />
              )}
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
          <p style={{ fontSize: 11, color: '#6b6a68' }}>95% and 99%: Medical-grade thresholds. Not required for marketing campaign optimization.</p>
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
                {result.pooled && isFinite(additionalNeeded(zThresh, result.cvrA, result.cvrB, result.pooled)) && (
                  <>You need approximately {additionalNeeded(zThresh, result.cvrA, result.cvrB, result.pooled).toLocaleString()} more {xLabel} per variation to reach significance. Keep running the test.</>
                )}
              </p>
              <p style={{ fontSize: 12, color: '#854d0e', fontStyle: 'italic' }}>{decisionGuidance()}</p>
            </div>
          )}

          {/* How this is calculated */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
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
        </div>
      )}
    </div>
  );
}
