import { useState } from 'react';
import { runDiagnostics } from './funnelDiagnostics.js';

const GARBAGE_IN = "The tool reads the numbers you enter. It can't see anything outside them, meaning no creative changes, sales process shifts, seasonality, or pricing changes are visible in the data you enter. A mismatched column or the wrong metric type might produce a 100% confident, 100% incorrect result! Check your column mapping before trusting the output, and treat every flagged pattern as a place to look, not a verdict.";

const DOWNSTREAM_DISCLAIMER = "Recent periods will structurally understate downstream conversion, since deals entering the funnel in the last few weeks haven't had time to move through your full sales cycle. Judge a recent period's SQL, Opp, or Won numbers against your own known average time-in-stage (MQL to SQL, SQL to Opp), not against fully-matured earlier periods. If your org treats SQL and Opp as the same stage, apply your own SQL to Won cycle length instead.";

export default function FunnelDiagnosticOutput({ periods = [], settings = {} }) {
  const [methodOpen, setMethodOpen] = useState(false);
  const hasData = periods && periods.length > 0;
  const result = hasData ? runDiagnostics(periods, settings) : null;

  return (
    <div className="fd-wrap" style={{ marginTop: 28 }}>
      <span className="fd-label">Diagnosis</span>

      <div className="fd-warn" style={{ marginTop: 4 }}>{GARBAGE_IN}</div>

      {!hasData && <p className="fd-note">Add at least one period above to see a diagnosis.</p>}

      {hasData && result.findings.length === 0 && (
        <div className="fd-card">
          <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>No known pattern matched</p>
          <p className="fd-note" style={{ marginBottom: 0 }}>
            Nothing in the tool's rule library triggered on this data. That is not the same as "no problem", it means none of the known, funnel-math-detectable patterns fired. Check the caveats below.
          </p>
        </div>
      )}

      {hasData && result.findings.map((f, i) => (
        <div className="fd-card" key={f.id}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
            Most likely {i + 1} of {result.findings.length}
          </p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 8 }}>{f.name}</p>
          <p style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.5 }}><strong>What triggered it:</strong> {f.triggerMath}</p>
          <p style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.5 }}>{f.plainLanguage}</p>
          <p style={{ fontSize: 13, color: '#374151', marginBottom: f.benchmarkContext ? 8 : 0, lineHeight: 1.5 }}><strong>Where to look:</strong> {f.nextStep}</p>
          {f.benchmarkContext && <p className="fd-note" style={{ marginBottom: 0 }}>{f.benchmarkContext}</p>}
        </div>
      ))}

      {hasData && result.totalTriggered > result.findings.length && (
        <p className="fd-note">
          {result.totalTriggered - result.findings.length} other lower-ranked pattern{result.totalTriggered - result.findings.length === 1 ? '' : 's'} also triggered. The tool surfaces the 2 strongest to keep the diagnosis actionable.
        </p>
      )}

      {hasData && result.caveats.length > 0 && (
        <div className="fd-card" style={{ background: '#FAFAF9' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#633806', marginBottom: 6 }}>Caveats for this data</p>
          {result.caveats.map((c, i) => (
            <p className="fd-note" key={i} style={{ marginBottom: i === result.caveats.length - 1 ? 0 : 6 }}>{c}</p>
          ))}
        </div>
      )}

      <div className="fd-note" style={{ marginTop: 4 }}>{DOWNSTREAM_DISCLAIMER}</div>

      <div className="fd-accordion" style={{ marginTop: 16 }}>
        <button type="button" className="fd-accordion-trigger" onClick={() => setMethodOpen(o => !o)} aria-expanded={methodOpen}>
          <span>How this works, and why these thresholds</span>
          <span className="fd-accordion-chevron">{methodOpen ? '−' : '+'}</span>
        </button>
        {methodOpen && (
          <div className="fd-accordion-body">
            <p><strong>Median, not average.</strong> Baselines use the median of your trailing periods so a single outlier month does not distort what "normal" looks like for a channel.</p>
            <p><strong>Marginal, not average, cpMQL.</strong> The tool judges the cost of the next MQL against your recent history, not the blended average, because optimizing on average systematically over-allocates to already-saturated channels.</p>
            <p><strong>Why 4 periods for marginal cpMQL, 3 for other flags.</strong> A marginal read needs 3 periods to build a stable baseline plus 1 to compare against it. Other deviation flags activate at 3, with a low-confidence note until more history accrues.</p>
            <p>The tool flags anything more than 20% off your trailing 3-month median. That's roughly where multiple marketing dashboard frameworks draw the line between normal noise and something worth a second look, including a CMO dashboard variance framework that codes under 10% as normal, 10 to 20% as worth a look, and over 20% as flag-worthy. Some teams reserve 30%+ for severe, drop-everything alerts; 20% surfaces directional signal earlier, in line with this tool's goal of narrowing possibilities rather than waiting for certainty.</p>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
              Sources: <a href="https://improvado.io/blog/cmo-dashboard-examples-metrics-templates" target="_blank" rel="noopener noreferrer">Improvado: CMO Dashboard Examples, Metrics and Templates</a>, <a href="https://support.google.com/google-ads/answer/10285843" target="_blank" rel="noopener noreferrer">Google Ads Help: Smart Bidding conversion guidance</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
