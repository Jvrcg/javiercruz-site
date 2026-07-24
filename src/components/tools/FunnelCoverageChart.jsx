// Purely descriptive: shows how many days of history each channel has,
// anchored to that channel's own latest reporting date. No "needs X" language,
// no pass/fail styling, this is a reality check on what was entered, not a
// judgment. The 90-day gate's interpretation lives in the caveat text, not here.
export function FunnelCoverageChart({ coverage, width = 320 }) {
  const channels = Object.values(coverage || {}).filter(c => c.rowCount > 0);
  if (!channels.length) return null;

  const maxSpan = Math.max(...channels.map(c => c.daysSpan), 1);
  const barMaxWidth = width - 140; // reserve space for the channel label + day count

  return (
    <div className="fd-coverage-chart">
      {channels.map(c => (
        <div key={c.channel} className="fd-coverage-row" style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ width: 110, fontSize: 12, color: '#374151', flexShrink: 0 }}>{c.channel}</span>
          <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', height: 10 }}>
            <div
              style={{
                width: `${Math.max(2, (c.daysSpan / maxSpan) * 100)}%`,
                background: '#9d174d',
                height: '100%',
              }}
            />
          </div>
          <span style={{ width: 68, textAlign: 'right', fontSize: 12, color: '#6b7280', flexShrink: 0 }}>
            {c.daysSpan} day{c.daysSpan === 1 ? '' : 's'}
          </span>
        </div>
      ))}
    </div>
  );
}
