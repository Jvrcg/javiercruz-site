import { formatMetricValue } from './funnelDiagnostics.js';

// Pure, reusable line chart. Scale is computed from the data passed in,
// no hardcoded ranges, so it renders correctly regardless of the metric
// or how many buckets are present.
export function FunnelSparkline({ rows, metricKey, flaggedIndex, width = 280, height = 72 }) {
  const padding = 12;
  const values = rows.map(r => r.derived[metricKey]).filter(v => v !== null && Number.isFinite(v));

  if (values.length < 2) {
    return <div className="fd-sparkline-empty">Not enough data to chart this metric.</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // guard against a flat line collapsing the scale

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const n = rows.length;

  const points = rows.map((r, i) => {
    const v = r.derived[metricKey];
    const x = padding + (n === 1 ? usableWidth / 2 : (i / (n - 1)) * usableWidth);
    const y = v === null ? null : padding + usableHeight - ((v - min) / range) * usableHeight;
    return { x, y, v, isFlagged: i === flaggedIndex };
  });

  const pathPoints = points.filter(p => p.y !== null);
  const pathD = pathPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="fd-sparkline">
      <path d={pathD} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {points.map((p, i) => p.y !== null && (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={p.isFlagged ? 4 : 2.5}
            fill={p.isFlagged ? '#9d174d' : 'currentColor'}
          />
          {p.isFlagged && (
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="11" fill="#9d174d">
              {formatMetricValue(p.v, metricKey)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
