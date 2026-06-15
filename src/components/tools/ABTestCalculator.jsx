import { useState } from 'react';

// Abramowitz and Stegun approximation for normal CDF
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

const Z_THRESHOLDS = { 90: 1.645, 95: 1.960, 99: 2.576 };

function validateInputs(vA, cA, vB, cB) {
  const errors = {};
  if (vA === '' || cA === '' || vB === '' || cB === '') {
    errors.general = 'All four fields are required.';
    return errors;
  }
  const nVA = Number(vA), nCA = Number(cA), nVB = Number(vB), nCB = Number(cB);
  if (nVA <= 0) errors.vA = 'Visitors must be greater than 0.';
  if (nVB <= 0) errors.vB = 'Visitors must be greater than 0.';
  if (nCA > nVA) errors.cA = 'Conversions cannot exceed visitors.';
  if (nCB > nVB) errors.cB = 'Conversions cannot exceed visitors.';
  if (nVA < 100 || nVB < 100) errors.sample = 'Not enough data. Run at least 100 visitors per variation before checking significance.';
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

function additionalVisitorsNeeded(zThresh, cvrA, cvrB, pooled) {
  const diff = Math.abs(cvrB - cvrA);
  if (diff === 0) return Infinity;
  return Math.ceil(Math.pow(zThresh / diff, 2) * pooled * (1 - pooled) * 2);
}

function DistributionCurve({ cvrA, cvrB, nVA, nVB }) {
  const sdA = Math.sqrt(cvrA * (1 - cvrA) / nVA);
  const sdB = Math.sqrt(cvrB * (1 - cvrB) / nVB);
  const maxSd = Math.max(sdA, sdB);
  const minX = Math.min(cvrA, cvrB) - 4 * maxSd;
  const maxX = Math.max(cvrA, cvrB) + 4 * maxSd;

  const W = 600, H = 200, BASELINE = 175, PADDING = 20;
  const plotW = W - PADDING * 2;

  function toSvgX(x) {
    return PADDING + ((x - minX) / (maxX - minX)) * plotW;
  }

  const N = 300;
  const step = (maxX - minX) / N;

  function curvePDF(x, mean, sd) {
    if (sd === 0) return 0;
    const z = (x - mean) / sd;
    return normalPDF(z) / sd;
  }

  // Sample points and find max y for scaling
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
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        {/* X axis */}
        <line x1={PADDING} y1={BASELINE} x2={W - PADDING} y2={BASELINE} stroke="#d1d5db" strokeWidth="1" />

        {/* Curve A */}
        <path d={buildPath(yA)} fill="rgba(37,99,235,0.12)" stroke="#2563EB" strokeWidth="2" />
        {/* Curve B */}
        <path d={buildPath(yB)} fill="rgba(29,158,117,0.12)" stroke="#1D9E75" strokeWidth="2" />

        {/* Dashed vertical at A peak */}
        <line
          x1={peakXA} y1={peakYA} x2={peakXA} y2={BASELINE}
          stroke="#2563EB" strokeWidth="1.5" strokeDasharray="4,3"
        />
        {/* Dashed vertical at B peak */}
        <line
          x1={peakXB} y1={peakYB} x2={peakXB} y2={BASELINE}
          stroke="#1D9E75" strokeWidth="1.5" strokeDasharray="4,3"
        />

        {/* Labels at peaks */}
        <text
          x={peakXA}
          y={labelYA}
          textAnchor="middle"
          fontSize="11"
          fill="#2563EB"
          fontWeight="600"
        >
          {(cvrA * 100).toFixed(2)}%
        </text>
        <text
          x={peakXB}
          y={labelYB}
          textAnchor="middle"
          fontSize="11"
          fill="#1D9E75"
          fontWeight="600"
        >
          {(cvrB * 100).toFixed(2)}%
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b6a68' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#2563EB' }} />
          Variation A
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b6a68' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#1D9E75' }} />
          Variation B
        </span>
      </div>
    </div>
  );
}

export default function ABTestCalculator() {
  const [vA, setVA] = useState('');
  const [cA, setCA] = useState('');
  const [vB, setVB] = useState('');
  const [cB, setCB] = useState('');
  const [confidence, setConfidence] = useState(90);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [showMethod, setShowMethod] = useState(false);

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

  return (
    <div style={{ fontFamily: 'inherit', color: '#1a1a19' }}>
      {/* Input grid */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr 1fr',
            gap: '8px 12px',
            alignItems: 'end',
            marginBottom: 8,
          }}
        >
          <div />
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b6a68', paddingBottom: 4 }}>Visitors</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b6a68', paddingBottom: 4 }}>Conversions</div>

          {/* Row A */}
          <div style={{ fontSize: 13, fontWeight: 500, paddingBottom: 8 }}>Variation A (Control)</div>
          <div>
            <input
              type="number"
              className={inputClass}
              placeholder="e.g. 5000"
              value={vA}
              onChange={e => setVA(e.target.value)}
              min="0"
              style={{ borderColor: errors.vA ? '#dc2626' : undefined }}
            />
            {errors.vA && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 3 }}>{errors.vA}</p>}
          </div>
          <div>
            <input
              type="number"
              className={inputClass}
              placeholder="e.g. 250"
              value={cA}
              onChange={e => setCA(e.target.value)}
              min="0"
              style={{ borderColor: errors.cA ? '#dc2626' : undefined }}
            />
            {errors.cA && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 3 }}>{errors.cA}</p>}
          </div>

          {/* Row B */}
          <div style={{ fontSize: 13, fontWeight: 500, paddingTop: 4 }}>Variation B (Test)</div>
          <div>
            <input
              type="number"
              className={inputClass}
              placeholder="e.g. 5000"
              value={vB}
              onChange={e => setVB(e.target.value)}
              min="0"
              style={{ borderColor: errors.vB ? '#dc2626' : undefined }}
            />
            {errors.vB && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 3 }}>{errors.vB}</p>}
          </div>
          <div>
            <input
              type="number"
              className={inputClass}
              placeholder="e.g. 300"
              value={cB}
              onChange={e => setCB(e.target.value)}
              min="0"
              style={{ borderColor: errors.cB ? '#dc2626' : undefined }}
            />
            {errors.cB && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 3 }}>{errors.cB}</p>}
          </div>
        </div>
        {errors.sample && (
          <p style={{ color: '#ca8a04', fontSize: 12, background: '#fefce8', border: '1px solid #fef08a', borderRadius: 6, padding: '8px 12px', marginTop: 8 }}>
            {errors.sample}
          </p>
        )}
        {errors.general && (
          <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{errors.general}</p>
        )}
      </div>

      {/* Confidence selector */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#6b6a68', marginBottom: 8 }}>Confidence level</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {[90, 95, 99].map(lvl => (
            <button
              key={lvl}
              onClick={() => setConfidence(lvl)}
              style={{
                padding: '6px 18px',
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
        <p style={{ fontSize: 11, color: '#9b9a97', lineHeight: 1.5 }}>
          90% confidence is sufficient for most marketing decisions. 95% and 99% are medical-grade thresholds, overkill for ad campaign optimization.
        </p>
      </div>

      {/* Calculate button */}
      <button
        onClick={handleCalculate}
        style={{
          width: '100%',
          background: '#2563EB',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '11px 0',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 32,
        }}
      >
        Calculate significance
      </button>

      {/* Results */}
      {result && (
        <div>
          {/* Distribution curve */}
          <DistributionCurve
            cvrA={result.cvrA}
            cvrB={result.cvrB}
            nVA={result.nVA}
            nVB={result.nVB}
          />

          {/* CVR tiles — three in one row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
            <div style={{ background: '#f8f8f7', borderRadius: 6, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, color: '#6b6a68', marginBottom: 4 }}>Variation A CVR</p>
              <p style={{ fontSize: 20, fontWeight: 700 }}>{(result.cvrA * 100).toFixed(2)}%</p>
            </div>
            <div style={{ background: '#f8f8f7', borderRadius: 6, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, color: '#6b6a68', marginBottom: 4 }}>Variation B CVR</p>
              <p style={{ fontSize: 20, fontWeight: 700 }}>{(result.cvrB * 100).toFixed(2)}%</p>
            </div>
            <div style={{ background: '#f8f8f7', borderRadius: 6, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, color: '#6b6a68', marginBottom: 4 }}>Relative lift</p>
              <p style={{
                fontSize: 20,
                fontWeight: 700,
                color: result.relativeLift >= 0 ? '#16a34a' : '#dc2626',
              }}>
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
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${fillPct}%`,
                background: meterColor,
                borderRadius: 6,
                transition: 'width 0.4s ease',
              }} />
              {/* Threshold marker */}
              <div style={{
                position: 'absolute',
                left: `${thresholdPct}%`,
                top: -4,
                bottom: -4,
                width: 2,
                background: '#1a1a19',
                borderRadius: 1,
                zIndex: 2,
              }} />
            </div>
            <p style={{ fontSize: 11, color: '#9b9a97', marginTop: 6 }}>
              Threshold: {confidence}% (your selected confidence level)
            </p>
          </div>

          {/* Winner declaration */}
          {isSignificant ? (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 6,
              padding: '16px 20px',
              marginBottom: 20,
            }}>
              <p style={{ fontWeight: 700, fontSize: 16, color: '#15803d', marginBottom: 8 }}>
                {result.cvrB > result.cvrA ? 'Variation B wins' : 'Variation A wins'}
              </p>
              <p style={{ fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
                {result.cvrB > result.cvrA
                  ? `Variation B's conversion rate of ${(result.cvrB * 100).toFixed(2)}% is ${Math.abs(result.relativeLift).toFixed(1)}% higher than Variation A's ${(result.cvrA * 100).toFixed(2)}%.`
                  : `Variation A's conversion rate of ${(result.cvrA * 100).toFixed(2)}% is ${Math.abs(result.relativeLift).toFixed(1)}% higher than Variation B's ${(result.cvrB * 100).toFixed(2)}%.`
                }{' '}
                You can be {result.confidence.toFixed(0)}% confident this difference is not due to chance. At this traffic level, this result would occur by random chance only 1 in {Math.round(1 / (1 - result.confidence / 100))} times.
              </p>
            </div>
          ) : (
            <div style={{
              background: '#fefce8',
              border: '1px solid #fef08a',
              borderRadius: 6,
              padding: '16px 20px',
              marginBottom: 20,
            }}>
              <p style={{ fontWeight: 700, fontSize: 16, color: '#854d0e', marginBottom: 8 }}>
                Not yet significant
              </p>
              {result.cvrA > result.cvrB && (
                <p style={{ fontSize: 13, color: '#713f12', marginBottom: 8 }}>
                  Variation A is currently outperforming Variation B, but the result is not yet statistically significant.
                </p>
              )}
              <p style={{ fontSize: 13, color: '#713f12', lineHeight: 1.6 }}>
                Your current confidence is {result.confidence.toFixed(1)}%. You need {confidence}% to call a winner.
                {' '}
                {result.pooled && isFinite(additionalVisitorsNeeded(zThresh, result.cvrA, result.cvrB, result.pooled)) && (
                  <>To reach significance at your selected threshold, you need approximately {additionalVisitorsNeeded(zThresh, result.cvrA, result.cvrB, result.pooled).toLocaleString()} more visitors per variation. Keep running the test.</>
                )}
              </p>
            </div>
          )}

          {/* Methodology — collapsed by default */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
            <button
              onClick={() => setShowMethod(v => !v)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8f8f7',
                border: 'none',
                padding: '12px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: '#1a1a19',
                cursor: 'pointer',
              }}
            >
              <span>How this is calculated</span>
              <span style={{ fontSize: 16 }}>{showMethod ? '-' : '+'}</span>
            </button>
            {showMethod && (
              <div style={{ padding: '14px 16px', fontSize: 13, color: '#4b5563', lineHeight: 1.7 }}>
                <p style={{ marginBottom: 10 }}>
                  This calculator uses a two-tailed frequentist z-test for proportions. Statistical significance tells you the probability that the observed difference between Variation A and Variation B is not due to random chance. A 90% confidence level means there is a 10% chance the result is a false positive, acceptable for most marketing optimization decisions.
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
        </div>
      )}
    </div>
  );
}
