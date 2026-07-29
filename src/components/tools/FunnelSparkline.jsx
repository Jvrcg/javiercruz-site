import { formatMetricValue } from './funnelDiagnostics.js';

const METRIC_DISPLAY_NAMES = {
  cpl: 'CPL',
  cpmql: 'cpMQL',
  clickToLead: 'Click → Lead',
  leadToMql: 'Lead → MQL',
  mqlToOpp: 'MQL → Opp',
  oppToWon: 'Opp → Won',
  spend: 'Spend',
  leads: 'Leads',
  mqls: 'MQLs',
};

function formatBucketDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Pure, reusable line chart. Scale is computed from the data passed in,
// no hardcoded ranges, so it renders correctly regardless of the metric
// or how many buckets are present. Designed to be legible standalone
// (e.g. pasted into a deck): every point is labeled, axes are real.
export function FunnelSparkline({ rows, metricKey, flaggedIndex, channel, width = 480, height = 220 }) {
  const padding = { top: 40, right: 24, bottom: 36, left: 56 };
  const values = rows.map(r => r.derived[metricKey]).filter(v => v !== null && Number.isFinite(v));

  if (values.length < 2) {
    return <div className="fd-sparkline-empty">Not enough data to chart this metric.</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.max(1, max * 0.1) || 1; // guard against a flat line collapsing the scale

  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const n = rows.length;

  const points = rows.map((r, i) => {
    const v = r.derived[metricKey];
    const x = padding.left + (n === 1 ? usableWidth / 2 : (i / (n - 1)) * usableWidth);
    const y = v === null ? null : padding.top + usableHeight - ((v - min) / range) * usableHeight;
    return { x, y, v, isFlagged: i === flaggedIndex, sortKey: r.sortKey };
  });

  const pathPoints = points.filter(p => p.y !== null);
  const pathD = pathPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const areaD = pathPoints.length
    ? `${pathD} L ${pathPoints[pathPoints.length - 1].x.toFixed(2)} ${(padding.top + usableHeight).toFixed(2)} L ${pathPoints[0].x.toFixed(2)} ${(padding.top + usableHeight).toFixed(2)} Z`
    : '';

  // 4 horizontal gridlines including min/max
  const gridSteps = 3;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const v = min + (range * i) / gridSteps;
    const y = padding.top + usableHeight - (i / gridSteps) * usableHeight;
    return { v, y };
  });

  const metricLabel = METRIC_DISPLAY_NAMES[metricKey] || metricKey;
  const title = channel ? `${channel} · ${metricLabel}` : metricLabel;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width, height: 'auto' }} className="fd-sparkline">
      <text x={padding.left} y={18} fontSize="12" fontWeight="600" fill="#374151">{title}</text>

      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={padding.left} y1={g.y} x2={width - padding.right} y2={g.y} stroke="#e5e7eb" strokeWidth="1" />
          <text x={padding.left - 8} y={g.y + 4} fontSize="10" textAnchor="end" fill="#9ca3af">
            {formatMetricValue(g.v, metricKey)}
          </text>
        </g>
      ))}

      <line x1={padding.left} y1={padding.top + usableHeight} x2={width - padding.right} y2={padding.top + usableHeight} stroke="#d1d5db" strokeWidth="1" />

      {areaD && <path d={areaD} fill="#9d174d" fillOpacity="0.08" stroke="none" />}
      <path d={pathD} fill="none" stroke="#374151" strokeWidth="2" />

      {points.map((p, i) => p.y !== null && (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={p.isFlagged ? 5 : 3}
            fill={p.isFlagged ? '#9d174d' : '#374151'}
          />
          <text
            x={p.x}
            y={p.isFlagged ? p.y - 14 : p.y - 10}
            textAnchor="middle"
            fontSize={p.isFlagged ? '12' : '10'}
            fontWeight={p.isFlagged ? '700' : '400'}
            fill={p.isFlagged ? '#9d174d' : '#6b7280'}
          >
            {formatMetricValue(p.v, metricKey)}
          </text>
          <text
            x={p.x}
            y={padding.top + usableHeight + 18}
            textAnchor="middle"
            fontSize="10"
            fill="#9ca3af"
          >
            {formatBucketDate(p.sortKey)}
          </text>
        </g>
      ))}
    </svg>
  );
}
