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
  if (nVA < 100 || nVB < 100) errors.sample = 'Not enough data — run at least 100 visitors per variation before checking significance.';
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
  const labelClass = 'block text-xs font-medium text-[#6b6a68] mb-1';

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
          90% confidence is sufficient for most marketing decisions. 95% and 99% are medical-grade thresholds — overkill for ad campaign optimization.
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
          {/* CVR comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Variation A CVR', value: `${(result.cvrA * 100).toFixed(2)}%` },
              { label: 'Variation B CVR', value: `${(result.cvrB * 100).toFixed(2)}%` },
            ].map(tile => (
              <div key={tile.label} style={{ background: '#f8f8f7', borderRadius: 6, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, color: '#6b6a68', marginBottom: 4 }}>{tile.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700 }}>{tile.value}</p>
              </div>
            ))}
          </div>
          <div style={{ background: '#f8f8f7', borderRadius: 6, padding: '14px 16px', marginBottom: 24 }}>
            <p style={{ fontSize: 11, color: '#6b6a68', marginBottom: 4 }}>Relative lift</p>
            <p style={{
              fontSize: 22,
              fontWeight: 700,
              color: result.relativeLift >= 0 ? '#16a34a' : '#dc2626',
            }}>
              {result.relativeLift >= 0 ? '+' : ''}{result.relativeLift.toFixed(1)}%
            </p>
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
                Your current confidence is {result.confidence.toFixed(1)}% — you need {confidence}% to call a winner.
                {' '}
                {result.pooled && isFinite(additionalVisitorsNeeded(zThresh, result.cvrA, result.cvrB, result.pooled)) && (
                  <>To reach significance at your selected threshold, you need approximately {additionalVisitorsNeeded(zThresh, result.cvrA, result.cvrB, result.pooled).toLocaleString()} more visitors per variation. Keep running the test.</>
                )}
              </p>
            </div>
          )}

          {/* Methodology */}
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
              <span style={{ fontSize: 16 }}>{showMethod ? '−' : '+'}</span>
            </button>
            {showMethod && (
              <div style={{ padding: '14px 16px', fontSize: 13, color: '#4b5563', lineHeight: 1.7 }}>
                <p style={{ marginBottom: 10 }}>
                  This calculator uses a two-tailed frequentist z-test for proportions. Statistical significance tells you the probability that the observed difference between Variation A and Variation B is not due to random chance. A 90% confidence level means there is a 10% chance the result is a false positive — acceptable for most marketing optimization decisions.
                </p>
                <p style={{ fontSize: 12, color: '#9b9a97' }}>
                  Sources:{' '}
                  <a href="https://blog.analytics-toolkit.com/2017/statistical-significance-ab-testing-complete-guide/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>
                    Analytics Toolkit — Complete Guide to Statistical Significance in A/B Testing
                  </a>
                  {' '}and{' '}
                  <a href="https://towardsdatascience.com/why-most-a-b-tests-are-lying-to-you/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>
                    Towards Data Science — Why Most A/B Tests Are Lying to You
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
