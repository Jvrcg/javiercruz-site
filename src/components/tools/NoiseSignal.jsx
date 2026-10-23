import { useMemo, useState } from 'react';
import {
  parseCsv, decimalsOf, unitOf, analyze, topRule, groupsOf, shouldNudge,
  MIN_POINTS, MIN_TREND_POINTS, DEFAULT_BASE,
} from './noiseSignalMath.js';

// Noise vs Signal
// Privacy rules:
// 1. Uploaded files are read in the browser only (FileReader). Nothing the user uploads is sent anywhere.
// 2. Data lives in React state only. No localStorage, sessionStorage or IndexedDB.
// 3. Nothing from the file is pushed to the dataLayer.
// 4. The template download is built client-side with a Blob URL.
// The only network request is loading the public Syncflow sample file from this site.

const SAMPLE_URL = '/data/syncflow_noise_vs_signal.csv';
const SAMPLE_NAME = 'Syncflow Noise vs. Signal';
const TEMPLATE = 'date,value,last_year\n2026-01-05,64,42\n2026-01-12,58,43\n2026-01-19,63,49\n';

const C = { 0: '#888780', 1: '#E24B4A', 2: '#D85A30', 3: '#EF9F27' };
const NAME = { 0: 'Noise', 1: 'Process Limit Rule', 2: 'Quartile Limit Rule', 3: 'Runs of Eight' };
const BADGE = { 1: ['#fee2e2', '#991b1b'], 2: ['#ffedd5', '#9a3412'], 3: ['#fef3c7', '#92400e'] };
const LY_COLOR = '#85B7EB';

const f2 = x => x.toFixed(2);
const parseISO = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); };
const fmtShort = (d, unit) => parseISO(d).toLocaleDateString('en-US', unit === 'month' ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' });
const fmtLong = d => parseISO(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Chevron({ open }) {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function L({ href, children }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>{children}</a>;
}

function Accordion({ title, isOpen, onToggle, children }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f8f7', border: 'none', padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1a1a19', cursor: 'pointer', textAlign: 'left' }}
      >
        <span>{title}</span>
        <Chevron open={isOpen} />
      </button>
      {isOpen && <div style={{ padding: '14px 16px', fontSize: 13, color: '#4b5563', lineHeight: 1.7 }}>{children}</div>}
    </div>
  );
}

function Sources({ children }) {
  return <p style={{ fontSize: 12, color: '#9b9a97', marginTop: 12 }}>Sources: {children}</p>;
}

// Marker shapes: circle = noise, triangle = Rule 1, diamond = Rule 2, square = Rule 3
function Mark({ x, y, t, ring = '#fff' }) {
  const c = C[t];
  if (t === 1) return <path d={`M${x},${y - 6} L${x + 6},${y + 5} L${x - 6},${y + 5} Z`} fill={c} stroke={ring} strokeWidth="1.5" />;
  if (t === 2) return <path d={`M${x},${y - 6} L${x + 6},${y} L${x},${y + 6} L${x - 6},${y} Z`} fill={c} stroke={ring} strokeWidth="1.5" />;
  if (t === 3) return <rect x={x - 4.5} y={y - 4.5} width="9" height="9" rx="1" fill={c} stroke={ring} strokeWidth="1.5" />;
  return <circle cx={x} cy={y} r="4" fill={c} stroke={ring} strokeWidth="1.5" />;
}

const S = {
  card: { border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 20px', marginTop: 16 },
  eyebrow: { fontSize: 12, fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' },
  title: { fontSize: 17, fontWeight: 600, color: '#111827', margin: '0 0 10px' },
  hint: { fontSize: 12, color: '#6b7280', margin: 0 },
  muted: { fontSize: 13, color: '#6b7280' },
  link: { color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, background: 'none', border: 0, padding: 0, fontFamily: 'inherit' },
  primary: { fontSize: 13, background: '#2563eb', border: '1px solid #2563eb', color: '#fff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' },
  select: { fontSize: 13, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' },
  stat: { background: '#f5f5f4', borderRadius: 8, padding: '14px 16px' },
  statLabel: { fontSize: 12, color: '#4b5563', margin: '0 0 8px' },
  statValue: { fontSize: 22, fontWeight: 600, margin: 0, color: '#111827' },
  nudge: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', borderRadius: 8, padding: '10px 14px', fontSize: 13, margin: '0 0 12px' },
  th: { padding: '7px 10px', fontWeight: 600, width: '34%', verticalAlign: 'top', color: '#111827' },
  td: { padding: '7px 10px' },
  sec: { fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 4px' },
};

function XChart({ data, A, B0, B1, trend, unit, hover, setHover }) {
  const { values: V, lastYear: LY, labels } = data;
  const { c, w, R } = A;
  const n = V.length;
  const W = 700, X0 = 44, X1 = 600, Y0 = 20, Y1 = 300;
  const all = V.concat(LY || [], c.map(x => x + w), c.map(x => x - w));
  const lo = Math.min(...all) - 4, hi = Math.max(...all) + 4;
  const sx = i => X0 + (n === 1 ? 0 : (i * (X1 - X0)) / (n - 1));
  const sy = v => Y1 - ((v - lo) / (hi - lo)) * (Y1 - Y0);
  const step = Math.max(1, Math.ceil(n / 7));
  const gridStep = Math.max(1, Math.pow(10, Math.floor(Math.log10((hi - lo) / 4))));
  const grid = [];
  for (let g = Math.ceil(lo / gridStep) * gridStep; g < hi; g += gridStep) grid.push(g);
  const band = [...c.map((v, i) => `${sx(i)},${sy(v + w)}`), ...c.map((v, i) => `${sx(i)},${sy(v - w)}`).reverse()].join(' ');
  const line = off => c.map((v, i) => `${sx(i)},${sy(v + off)}`).join(' ');
  const e = n - 1;
  const fd = x => x.toFixed(data.dec);
  const tx = { fill: '#6b7280', fontSize: 11 };
  const tip = hover !== null && hover < n ? hover : null;
  const tipX = tip === null ? 0 : (sx(tip) > W - 250 ? sx(tip) - 240 : sx(tip) + 10);
  const tipLabel = i => (unit === 'week' ? `Week of ${labels[i]}` : labels[i]);

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} 340`} width="100%" role="img" aria-label={`Chart of ${n} data points with the noise band and flagged points`} onMouseLeave={() => setHover(null)}>
        <polygon points={band} fill="#888780" opacity="0.10" />
        <rect x={sx(B0)} y={Y0} width={Math.max(0, sx(B1 - 1) - sx(B0))} height={Y1 - Y0} fill="#378ADD" opacity="0.04" />
        <text x={sx(B0) + 6} y={Y0 + 12} style={tx}>Baseline (limits locked)</text>
        {[w, 0, -w].map(off => <polyline key={off} points={line(off)} fill="none" stroke="#888780" strokeWidth="1" />)}
        {[[c[e] + w, 'Upper limit'], [c[e], trend ? 'Trend line' : 'Average'], [c[e] - w, 'Lower limit']].map(([v, t]) => (
          <g key={t}>
            <text x={X1 + 6} y={sy(v) - 2} style={{ fill: '#374151', fontSize: 11 }}>{t}</text>
            <text x={X1 + 6} y={sy(v) + 11} style={{ fill: '#111827', fontSize: 11 }}>{fd(v)}</text>
          </g>
        ))}
        {grid.map(g => <text key={g} x={X0 - 8} y={sy(g) + 4} textAnchor="end" style={tx}>{g}</text>)}
        {V.map((_, i) => (i % step === 0 ? <text key={i} x={sx(i)} y={Y1 + 20} textAnchor="middle" style={tx}>{labels[i]}</text> : null))}
        {LY && <polyline points={LY.map((v, i) => `${sx(i)},${sy(v)}`).join(' ')} fill="none" stroke={LY_COLOR} strokeWidth="1.5" strokeDasharray="3,4" opacity="0.7" />}
        <polyline points={V.map((v, i) => `${sx(i)},${sy(v)}`).join(' ')} fill="none" stroke="#B4B2A9" strokeWidth="1.5" strokeLinejoin="round" />
        {V.map((v, i) => (
          <g key={i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
            <Mark x={sx(i)} y={sy(v)} t={topRule(R[i])} />
            <rect x={sx(i) - 6} y={Y0} width="12" height={Y1 - Y0} fill="transparent" />
          </g>
        ))}
      </svg>
      {tip !== null && (
        <div style={{ position: 'absolute', pointerEvents: 'none', left: `${(tipX / W) * 100}%`, top: `${(sy(V[tip]) / 340) * 100}%`, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 12, maxWidth: 240, lineHeight: 1.5, color: '#111827' }}>
          <b>{tipLabel(tip)}: {V[tip]}</b>
          {R[tip].length
            ? <>{R[tip].map(k => <div key={k}>Rule {k}: {NAME[k]}</div>)}<div>Investigate.</div></>
            : <div>Within the noise. No action.</div>}
        </div>
      )}
    </div>
  );
}

function MRChart({ data, A }) {
  const { labels } = data;
  const { mr, mrHigh, url, mrb } = A;
  const n = mr.length;
  const X0 = 44, X1 = 600, M0 = 15, M1 = 115;
  const sx = i => X0 + (n === 1 ? 0 : (i * (X1 - X0)) / (n - 1));
  const mhi = Math.max(url, ...mr.slice(1)) + 2;
  const my = v => M1 - (v / mhi) * (M1 - M0);
  const fd = x => x.toFixed(data.dec);
  const step = Math.max(1, Math.ceil(n / 7));
  const tx = { fill: '#6b7280', fontSize: 11 };
  return (
    <svg viewBox="0 0 700 150" width="100%" role="img" aria-label="Moving range chart with the upper range limit">
      <line x1={X0} x2={X1} y1={my(url)} y2={my(url)} stroke="#888780" />
      <text x={X1 + 6} y={my(url) - 2} style={{ fill: '#374151', fontSize: 11 }}>Upper range limit</text>
      <text x={X1 + 6} y={my(url) + 11} style={{ fill: '#111827', fontSize: 11 }}>{fd(url)}</text>
      <line x1={X0} x2={X1} y1={my(mrb)} y2={my(mrb)} stroke="#888780" />
      <text x={X1 + 6} y={my(mrb) + 4} style={{ fill: '#374151', fontSize: 11 }}>Avg {fd(mrb)}</text>
      <polyline points={mr.slice(1).map((v, j) => `${sx(j + 1)},${my(v)}`).join(' ')} fill="none" stroke="#B4B2A9" strokeWidth="1.5" />
      {mr.map((v, i) => (i ? <Mark key={i} x={sx(i)} y={my(v)} t={mrHigh[i] ? 1 : 0} /> : null))}
      {mr.map((_, i) => (i % step === 0 ? <text key={`l${i}`} x={sx(i)} y={M1 + 22} textAnchor="middle" style={tx}>{labels[i]}</text> : null))}
    </svg>
  );
}

function buildFindings(data, A, trend, unit) {
  const { values: V, labels: lab } = data;
  const { c, w, R, mr, mrHigh, url } = A;
  const ref = trend ? 'your trend line' : 'the average';
  const U = unit === 'point' ? 'point' : unit;
  const rng = (a, b, f) => { const xs = []; for (let k = a; k <= b; k++) xs.push(f(k)); const lo = Math.min(...xs), hi = Math.max(...xs); return lo === hi ? f2(lo) : `${f2(lo)} to ${f2(hi)}`; };
  const vr = (a, b) => { const xs = V.slice(a, b + 1); const lo = Math.min(...xs), hi = Math.max(...xs); return lo === hi ? `${lo}` : `${lo} to ${hi}`; };
  const when = i => (unit === 'week' ? `the week of ${lab[i]}` : lab[i]);
  const MEAN = {
    p: 'Strong signal. This is outside the range routine variation produces, so look for a specific cause on these dates.',
    m: `Strong signal. A change this big from one ${U} to the next is outside routine variation.`,
    2: 'Moderate signal. Points are bunching up near one limit, which is often an early sign of a shift.',
    3: 'Weak signal on its own, but a run this long points to a sustained change in level.',
  };
  const rows = [];
  groupsOf(A, V, 1).forEach(([a, b]) => {
    const up = V[a] > c[a], side = up ? 'upper' : 'lower', lim = k => (up ? c[k] + w : c[k] - w);
    const t = a === b
      ? `${V[a]} in ${when(a)}, ${up ? 'above' : 'below'} the ${side} limit of ${f2(lim(a))} by ${f2(Math.abs(V[a] - lim(a)))}.`
      : `${b - a + 1} ${U}s in a row ${up ? 'above' : 'below'} the noise band, from ${lab[a]} to ${lab[b]}. Values ranged from ${vr(a, b)}, and the ${side} limit was ${rng(a, b, lim)}.`;
    rows.push({ s: a, d: a === b ? lab[a] : `${lab[a]} to ${lab[b]}`, k: 1, t, m: a === b ? MEAN.p.replace('these dates', 'this date') : MEAN.p });
  });
  mrHigh.forEach((h, k) => {
    if (h) rows.push({ s: k, d: lab[k], k: 1, t: `A jump of ${Number.isInteger(mr[k]) ? mr[k] : f2(mr[k])} from ${when(k - 1)} (${V[k - 1]}) to ${when(k)} (${V[k]}), above the upper range limit of ${f2(url)}.`, m: MEAN.m });
  });
  groupsOf(A, V, 2).forEach(([a, b]) => {
    const up = V[a] > c[a];
    let cnt = 0;
    for (let k = a; k <= b; k++) if (R[k].includes(2)) cnt++;
    rows.push({ s: a, d: a === b ? lab[a] : `${lab[a]} to ${lab[b]}`, k: 2, t: `${cnt} ${U}${cnt > 1 ? 's' : ''} from ${lab[a]} to ${lab[b]} sat closer to the ${up ? 'upper' : 'lower'} limit (${rng(a, b, k => (up ? c[k] + w : c[k] - w))}) than to ${ref}. Values ranged from ${vr(a, b)}.`, m: MEAN[2] });
  });
  groupsOf(A, V, 3).forEach(([a, b]) => {
    const up = V[a] > c[a];
    const ctx = trend ? `The gap to your trend line ranged from ${rng(a, b, k => Math.abs(V[k] - c[k]))}.` : `Values ranged from ${vr(a, b)}, against an average of ${f2(c[a])}.`;
    rows.push({ s: a, d: `${lab[a]} to ${lab[b]}`, k: 3, t: `${b - a + 1} ${U}s in a row ${up ? 'above' : 'below'} ${ref}, from ${lab[a]} to ${lab[b]}. ${ctx}`, m: MEAN[3] });
  });
  rows.sort((x, y) => x.s - y.s || x.k - y.k);
  return rows;
}

export default function NoiseSignal() {
  const [data, setData] = useState(null); // { name, dates, values, lastYear, labels, longLabels, dec, unit }
  const [base, setBase] = useState({ f: 0, t: DEFAULT_BASE - 1 });
  const [trend, setTrend] = useState(false);
  const [downNote, setDownNote] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [hover, setHover] = useState(null);
  const [open, setOpen] = useState({});
  const toggle = k => setOpen(o => ({ ...o, [k]: !o[k] }));

  function load(parsed, name) {
    setError('');
    const { dates, values, lastYear } = parsed;
    if (values.length < MIN_POINTS) { setError(`Add at least ${MIN_POINTS} data points. That is the minimum for reliable limits.`); return false; }
    const unit = unitOf(dates);
    const n = values.length;
    const f = 0, t = Math.min(DEFAULT_BASE, n) - 1;
    const next = { name, dates, values, lastYear, unit, dec: decimalsOf(values), labels: dates.map(d => fmtShort(d, unit)), longLabels: dates.map(fmtLong) };
    // Growth defaults to on, unless the baseline trends down (a steady decline should be flagged, not treated as normal).
    let tr = false, down = false;
    if (t - f + 1 >= MIN_TREND_POINTS) {
      const slope = analyze(values, f, t + 1, true).slope;
      tr = slope >= 0;
      down = slope < 0;
    }
    setData(next);
    setPending(null);
    setBase({ f, t });
    setTrend(tr);
    setDownNote(down);
    setHover(null);
    return true;
  }

  function fromText(text, name) {
    const p = parseCsv(text);
    if (!p.values.length) { setError("We couldn't find any rows. Each row needs a date (YYYY-MM-DD) and a number."); return; }
    if (load(p, name) && p.bad.length) setError(`Skipped ${p.bad.length} row(s) we couldn't read: row ${p.bad.slice(0, 5).join(', ')}.`);
  }

  function pick(file) { setPending(file || null); setError(''); }

  function submit() {
    if (!pending) { setError('Choose a CSV first, then press Submit.'); return; }
    if (!/\.csv$/i.test(pending.name)) { setError("That file isn't a CSV. Export your data as .csv and try again."); return; }
    const reader = new FileReader();
    reader.onload = () => fromText(String(reader.result || ''), pending.name);
    reader.readAsText(pending);
  }

  async function loadSample() {
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error('fetch failed');
      fromText(await res.text(), SAMPLE_NAME);
    } catch {
      setError("We couldn't load the sample file. Refresh the page and try again.");
    }
  }

  function downloadTemplate() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    a.download = 'noise_vs_signal_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Baseline dropdowns. If "from" moves past "to" (or the reverse), the other end moves to keep up to 20 points.
  function changeBase(which, idx) {
    const n = data.values.length;
    let f = which === 'f' ? idx : base.f;
    let t = which === 't' ? idx : base.t;
    if (t < f) { if (which === 'f') t = Math.min(f + DEFAULT_BASE - 1, n - 1); else f = Math.max(t - DEFAULT_BASE + 1, 0); }
    let msg = '';
    if (t - f + 1 < MIN_POINTS) {
      if (f + MIN_POINTS - 1 <= n - 1) t = f + MIN_POINTS - 1; else { t = n - 1; f = n - MIN_POINTS; }
      msg = `The baseline needs at least ${MIN_POINTS} points, so we widened it.`;
    }
    setError(msg);
    setBase({ f, t });
    if (t - f + 1 < MIN_TREND_POINTS) setTrend(false);
  }

  const B0 = base.f, B1 = base.t + 1, BASE = B1 - B0;
  const trendAllowed = BASE >= MIN_TREND_POINTS;
  const useTrend = trend && trendAllowed;
  const A = useMemo(() => (data ? analyze(data.values, B0, B1, useTrend) : null), [data, B0, B1, useTrend]);
  const findings = useMemo(() => (data && A ? buildFindings(data, A, useTrend, data.unit) : []), [data, A, useTrend]);

  let results = null;
  if (data && A) {
    const V = data.values, n = V.length, li = n - 1, lab = data.labels;
    const { c, w, R, mrHigh, slope } = A;
    const lt = topRule(R[li]);
    const fd = x => x.toFixed(data.dec);
    const tie = [c[li] - w, c[li] + w].some(x => fd(x) === fd(V[li]));
    const bf = tie ? f2 : fd;
    const flagged = R.filter((r, i) => r.length || mrHigh[i]).length;
    const ref = useTrend ? 'your trend line' : 'the average';
    const unitWord = data.unit === 'point' ? 'point' : data.unit;
    const latestLabel = data.unit === 'week' ? `week of ${lab[li]}` : lab[li];
    const dir = V[li] > c[li] ? 'above' : 'below';
    const stat = { 0: ['Noise', '#4b5563'], 1: ['Rule 1', '#b91c1c'], 2: ['Rule 2', '#c2410c'], 3: ['Rule 3', '#b45309'] };
    let verdict;
    if (lt === 1) verdict = { bg: '#fef2f2', b: '#fecaca', t: '#991b1b', h: 'Signal: investigate', p: `The ${latestLabel} came in at ${V[li]}, ${dir} the noise band of ${f2(c[li] - w)} to ${f2(c[li] + w)}${useTrend ? ' around your trend line' : ''}. This is not routine variation.`, r: 'Check what changed before reacting: tracking, budget, launches, platform changes, or outside factors like industry events or other campaigns.' };
    else if (lt) verdict = { bg: '#fffbeb', b: '#fde68a', t: '#92400e', h: 'Possible shift: confirm what changed', p: `The ${latestLabel} came in at ${V[li]}, inside the noise band, but it is part of a pattern ${dir} ${ref}.`, r: 'Confirm what changed at the start of the pattern.' };
    else verdict = { bg: '#f0fdf4', b: '#bbf7d0', t: '#166534', h: 'Within the noise', p: `The ${latestLabel} came in at ${V[li]}, inside the noise band, with no pattern rules triggered.`, r: 'Keep monitoring' };
    const nudge = shouldNudge(A, V, B1, useTrend);

    results = (
      <div style={{ marginTop: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, margin: '0 0 12px', color: trendAllowed ? '#111827' : '#9ca3af' }}>
          <input type="checkbox" checked={useTrend} disabled={!trendAllowed} onChange={e => { setTrend(e.target.checked); setDownNote(false); }} />
          Account for growth (fit a trend line)
        </label>
        {downNote && !useTrend && <div style={S.nudge}>Your baseline is trending down, so we left "Account for growth" off. A steady decline gets flagged instead of treated as normal.</div>}
        {nudge && (
          <div style={S.nudge}>
            Your data is trending up. Try turning on "Account for growth."
            <button onClick={() => { setTrend(true); setDownNote(false); }} style={{ marginLeft: 8, fontSize: 12, border: '1px solid #93c5fd', background: '#fff', color: '#1e3a8a', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Turn it on</button>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '0 0 8px', fontSize: 12, color: '#374151' }}>
          {[0, 1, 2, 3].map(t => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="14" height="14" viewBox="-7 -7 14 14"><Mark x={0} y={0} t={t} /></svg>{t ? `Rule ${t}: ` : ''}{NAME[t]}
            </span>
          ))}
          {data.lastYear && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="22" height="10"><line x1="1" y1="5" x2="21" y2="5" stroke={LY_COLOR} strokeWidth="1.5" strokeDasharray="3,4" /></svg>Last year
            </span>
          )}
        </div>
        <XChart data={data} A={A} B0={B0} B1={B1} trend={useTrend} unit={data.unit} hover={hover} setHover={setHover} />
        <p style={{ fontSize: 13, color: '#374151', margin: '16px 0 4px' }}>{unitWord.charAt(0).toUpperCase() + unitWord.slice(1)}-to-{unitWord} change (moving range)</p>
        <MRChart data={data} A={A} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, margin: '28px 0 20px' }}>
          {useTrend
            ? <div style={S.stat}><p style={S.statLabel}>Trend</p><p style={S.statValue}>{slope >= 0 ? '+' : ''}{f2(slope)} / {unitWord}</p></div>
            : <div style={S.stat}><p style={S.statLabel}>Average (locked)</p><p style={S.statValue}>{fd(c[0])}</p></div>}
          <div style={S.stat}><p style={S.statLabel}>Noise band at latest {unitWord}</p><p style={S.statValue}>{bf(c[li] - w)} to {bf(c[li] + w)}</p></div>
          <div style={S.stat}><p style={S.statLabel}>Latest ({latestLabel})</p><p style={{ ...S.statValue, color: stat[lt][1] }}>{V[li]} <span style={{ fontSize: 13 }}>{stat[lt][0]}</span></p></div>
          <div style={S.stat}><p style={S.statLabel}>Flagged since baseline start</p><p style={S.statValue}>{flagged} of {n - B0}</p></div>
        </div>

        <div style={{ borderRadius: 8, padding: '16px 20px', border: `1px solid ${verdict.b}`, background: verdict.bg, color: verdict.t, margin: '0 0 20px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600 }}>{verdict.h}</h3>
          <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.6 }}>{verdict.p}</p>
          {useTrend && <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.6 }}>Trend on: only departures from your growth line are flagged.</p>}
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}><b>Recommendation:</b> {verdict.r}</p>
        </div>

        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px', color: '#111827' }}>Findings ({findings.length})</h4>
          {findings.map((x, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, padding: '10px 0', borderTop: '1px solid #e5e7eb', fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ color: '#111827' }}>{x.d}</div>
              <div>
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, marginBottom: 4, background: BADGE[x.k][0], color: BADGE[x.k][1] }}>Rule {x.k}: {NAME[x.k]}</span>
                <b style={{ display: 'block', fontWeight: 500, color: '#111827' }}>{x.t}</b>
                <span style={{ display: 'block', color: '#6b7280', fontSize: 12, marginTop: 2 }}>{x.m}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const opts = data ? data.dates.map((d, i) => <option key={i} value={i}>{data.longLabels[i]}</option>) : null;

  return (
    <div>
      <Accordion title="How to use this tool, step by step" isOpen={!!open.guide} onToggle={() => toggle('guide')}>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Pick one metric to check, like weekly demo requests or weekly MQLs. The tool looks at one metric at a time.</li>
          <li>Export it from your reporting tool or spreadsheet as a CSV with two columns: the date (YYYY-MM-DD) and the value.</li>
          <li>Optional: add a third column with last year's value for the same week. It shows up as a light dotted line for context.</li>
          <li>For low-volume metrics, use weekly totals, not daily numbers or rolling averages.</li>
          <li>Include at least 6 rows. 20 or more gives you limits you can trust.</li>
          <li>Choose your CSV, then press Submit. Or press Load sample to see how it works with Syncflow Noise vs. Signal.</li>
          <li>After your data loads, choose the dates to lock the limits on. Aim for 15 to 20 points from a recent stretch with no known changes, like a launch or a budget shift.</li>
          <li>If your numbers are growing on purpose, turn on "Account for growth." The tool will suggest it when your data is trending up.</li>
          <li>Read the verdict first. It tells you whether your latest data point is within the noise or needs a closer look. The findings list shows every signal and when it happened.</li>
        </ol>
      </Accordion>

      <section style={S.card}>
        <p style={S.eyebrow}>Step 1</p>
        <h3 style={S.title}>Add your data</h3>
        <div
          onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
          onDrop={e => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files[0]); }}
          style={{ border: `2px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`, borderRadius: 10, padding: '22px 16px', textAlign: 'center', background: dragOver ? '#eff6ff' : '#f8fafc' }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px', color: '#111827' }}>Drag your CSV here</p>
          <p style={{ ...S.muted, margin: '0 0 6px' }}>or <label style={S.link}>choose a file<input type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { pick(e.target.files[0]); e.target.value = ''; }} /></label></p>
          <p style={S.hint}>Columns: date (YYYY-MM-DD), value, last year (optional)</p>
          <p style={{ margin: '8px 0 0' }}><button style={S.link} onClick={downloadTemplate}>Download template</button></p>
          {pending && <p style={{ ...S.muted, margin: '8px 0 0' }}>Selected: {pending.name}</p>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14 }}>
          {data ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <label htmlFor="ns-b0">Lock limits from</label>
              <select id="ns-b0" style={S.select} value={base.f} onChange={e => changeBase('f', Number(e.target.value))}>{opts}</select>
              <span>to</span>
              <select id="ns-b1" aria-label="Lock limits to" style={S.select} value={base.t} onChange={e => changeBase('t', Number(e.target.value))}>{opts}</select>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1e3a8a', background: '#eff6ff', borderRadius: 999, padding: '2px 8px' }}>{BASE} points selected</span>
            </div>
          ) : (
            <p style={S.hint}>Limits lock on your first 20 data points by default. You can change the dates once your data loads.</p>
          )}
          <button style={S.primary} onClick={submit}>Submit</button>
        </div>
        <p style={{ ...S.hint, margin: '6px 0 0' }}>Aim for 15 to 20 points from a recent stretch with no known changes, like a launch, a budget shift, or a tracking fix. Limits get reliable between 12 and 20 points, and more than 20 adds little.</p>
        {error && <p style={{ color: '#b91c1c', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}
        <p style={{ ...S.muted, margin: '10px 0 0' }}>No data yet? <button style={S.link} onClick={loadSample}>Load the sample (Syncflow Noise vs. Signal)</button></p>
        {data && (
          <p style={{ fontSize: 12, color: '#9b9a97', marginTop: 12 }}>
            Loaded: {data.name} ({data.values.length} points{data.lastYear ? ', with last year' : ''}). Limits locked from {data.longLabels[B0]} to {data.longLabels[B1 - 1]}.
            {!trendAllowed && ` Lock ${MIN_TREND_POINTS} or more points to use "Account for growth."`}
          </p>
        )}
        <Sources>
          <L href="https://xmrit.com/manual/">Xmrit: User Manual</L>, <L href="https://xmrit.com/articles/why-you-need-to-lock-limits/">Xmrit: Why Locking Limits is Essential</L>, <L href="https://www.spcforexcel.com/knowledge/control-chart-basics/when-calculate-lock-and-recalculate-control-limits">SPC for Excel: When to Calculate, Lock, and Recalculate Control Limits</L>, <L href="https://www.wsh.nhs.uk/asset-library/making-data-count-the-essentials.pdf">NHS England: Making Data Count, The Essentials</L>
        </Sources>
      </section>

      {results}

      <Accordion title="How this is calculated" isOpen={!!open.calc} onToggle={() => toggle('calc')}>
        <p style={{ margin: 0 }}>
          1. Moving range: the absolute difference between each point and the one before it.<br />
          2. Limits are locked on the points you choose (the baseline, the first 20 by default), so new points can't drag them around.<br />
          3. Average: the mean of the baseline points. With "Account for growth" on, a straight trend line fit to the baseline replaces the average. Baseline points outside the untrended limits are left out of the fit.<br />
          4. Noise band: the average (or trend line) plus or minus 2.66 times the average moving range.<br />
          5. Upper range limit: 3.268 times the average moving range.
        </p>
        <Sources>
          <L href="https://xmrit.com/articles/plot-xmr-chart-instructions/">Xmrit: How to Plot an XmR Chart</L>, <L href="https://xmrit.com/articles/why-you-need-to-lock-limits/">Xmrit: Why Locking Limits is Essential</L>, <L href="https://xmrit.com/articles/seasonality-and-trend-launch/">Xmrit: Trend and Seasonality Features</L>, <L href="https://www.qualitydigest.com/march97/html/spctool.html">Quality Digest: Good Limits From Bad Data</L>, <L href="https://xmrit.com/articles/how-often-measure-business-processes/">Xmrit: How Often Should You Measure Your Business Processes?</L>, <L href="https://xmrit.com/articles/saas-metrics-for-xmr-charts/">Xmrit: SaaS Metrics for XmR Charts</L>
        </Sources>
      </Accordion>

      <Accordion title="How to read the signals & terminology" isOpen={!!open.signals} onToggle={() => toggle('signals')}>
        <p style={{ ...S.sec, marginTop: 0 }}>How to read the signals</p>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>Each flagged point on the chart uses one of these markers.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, margin: '0 0 6px' }}>
          {[
            [1, 'Strong', 'A point outside the noise band, or a point-to-point change above the upper range limit.'],
            [2, 'Moderate', '3 of 4 points in a row closer to the same limit than to the average.'],
            [3, 'Weak', '8 or more points in a row on the same side of the average.'],
          ].map(([k, lvl, txt]) => (
            <div key={k} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="-7 -7 14 14"><Mark x={0} y={0} t={k} ring="none" /></svg>
                <b style={{ color: '#111827' }}>Rule {k}: {NAME[k]}</b>
                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '1px 8px', background: BADGE[k][0], color: BADGE[k][1] }}>{lvl} signal</span>
              </div>
              <p style={{ margin: '6px 0 0', lineHeight: 1.5 }}>{txt}</p>
            </div>
          ))}
        </div>
        <p style={{ ...S.sec, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>Terminology</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <tbody>
            {[
              ['Noise', 'The normal ups and downs a metric shows when nothing has changed. Also called common cause variation. Xmrit calls it routine variation.'],
              ['Signal', "A change that noise doesn't explain, so something likely happened. Also called special cause variation. Xmrit calls it exceptional variation."],
              ['Noise band', 'The shaded area between the lower and upper limits. Points inside it are noise.'],
              ['Baseline', "The points the limits are locked on. New points can't move the limits."],
              ['Upper and lower limits', 'The edges of the noise band. Xmrit calls them the natural process limits.'],
              ['Average', 'The center line: the mean of the baseline points.'],
              ['Trend line', 'Replaces the average when "Account for growth" is on. A straight line fit to the baseline.'],
              ['Moving range', 'How much the metric changed from one point to the next.'],
              ['Upper range limit', 'The largest point-to-point change that noise explains.'],
              ['Last year', "The dotted line. Shown for context only. It doesn't affect the limits or the signals."],
            ].map(([t, d]) => <tr key={t} style={{ borderTop: '1px solid #e5e7eb' }}><td style={S.th}>{t}</td><td style={S.td}>{d}</td></tr>)}
          </tbody>
        </table>
        <Sources>
          <L href="https://xmrit.com/manual/">Xmrit: User Manual</L>, <L href="https://xmrit.com/articles/why-you-need-to-lock-limits/">Xmrit: Why Locking Limits is Essential</L>, <L href="https://asq.org/quality-resources/variation">ASQ: What is the Law of Variation?</L>
        </Sources>
      </Accordion>

      <Accordion title="10 things you should know about this analysis" isOpen={!!open.ten} onToggle={() => toggle('ten')}>
        {[
          ['Core Strategic Principles', [
            'It separates "Signal" from "Noise": Daily shifts in digital marketing metrics (traffic, conversions, platform spend) are completely normal. This analysis draws a hard mathematical line so executives stop treating expected daily noise as a crisis.',
            'It uses your X-Matrix as an operational shield: An X-Matrix maps your exact daily tasks (North Quadrant) to your primary 1-year goals (West Quadrant). It gives you a clear visual workflow to prove to executives exactly what high-impact work will stop if you are forced to pivot to an ad-hoc investigation.',
            'It introduces "Common Cause" vs. "Special Cause" variation: Common cause variation is standard, everyday fluctuation (e.g., lower traffic on a Tuesday). Special cause variation is a massive, unexpected change (e.g., broken conversion pixels). You should only investigate special cause variations.',
          ]],
          ['Technical & Platform Execution', [
            'Volatility depends entirely on the platform: Search engine traffic is typically stable, but paid ad platforms like Meta Ads are highly volatile. This analysis teaches leadership what normal fluctuation looks like for each channel, based on its own history.',
            'The "Triage Window" must match your optimization cadence: You cannot optimize long-term marketing campaigns on a 24-hour horizon. This framework forces executives to move away from daily panic and focus on rolling 7-day, 14-day, or monthly averages.',
            'Custom data guardrails can be built into your dashboards: You don\'t have to calculate this manually every day. You can use this logic to build shaded "control limits" directly into your reporting platforms (like Google Looker Studio) so charts visually show when data is in a safe zone.',
          ]],
          ['Team Dynamics & Executive Communication', [
            'It changes the operational conversation to strategic trade-offs: Instead of answering a frantic question with "it could be anything, it\'s just noise," you pivot the conversation to focus on resource management: "We can audit this Tuesday drop, but it means pausing our high-impact Q3 landing page optimization."',
            'Pre-written automation saves mental energy: Having a standard, automated triage script ready to go removes the anxiety of pushing back against leadership. It transforms a defensive reaction into a standardized, professional protocol.',
            'It establishes a pre-approved "Threshold Rule": By getting executive buy-in on standard volatility ranges before the data drops, leadership agrees ahead of time that they will not request deep dives unless the data breaks outside its noise band.',
            'It protects your team\'s most valuable asset velocity: Constantly shifting a digital marketing team back and forth between long-term campaign builds and daily data debugging kills momentum. Standardizing this boundary keeps your team focused on execution that drives real business pipeline.',
          ]],
        ].reduce((acc, [head, items]) => {
          acc.out.push(
            <div key={head}>
              <h4 style={{ margin: '12px 0 6px', fontSize: 14, fontWeight: 600, color: '#111827' }}>{head}</h4>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {items.map((t, j) => (
                  <li key={j} style={{ display: 'grid', gridTemplateColumns: '26px 1fr', margin: '0 0 6px' }}>
                    <b style={{ color: '#111827' }}>{acc.i + j + 1}.</b><span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>,
          );
          acc.i += items.length;
          return acc;
        }, { i: 0, out: [] }).out}
        <Sources>
          <L href="https://docs.cloud.google.com/looker/docs/studio/add-reference-lines-and-reference-bands-to-charts">Looker Studio Help: Add reference lines and reference bands to charts</L>, <L href="https://umbrex.com/resources/frameworks/marketing-frameworks/leading-vs-lagging-indicators-framework/">Umbrex: Leading vs Lagging Indicators Framework</L>
        </Sources>
      </Accordion>

      <Accordion title="Common noise culprits by channel" isOpen={!!open.channel} onToggle={() => toggle('channel')}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#e7e5e4' }}>
                <th style={{ padding: '8px 10px', fontWeight: 600, color: '#111827' }}>Channel Category</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, color: '#111827' }}>Typical "Noise" Culprit</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Brand Search & Direct', "Reporting delays, holiday shifts (yes, seasonality is a real thing even when some leadership may say 'seasonality doesn't affect us')"],
                ['Generic Paid Search', 'Competitor budget changes, bidding strategy adjustments'],
                ['Paid Social (Meta/LinkedIn)', 'Algorithm pacing, ad fatigue, creative testing pauses'],
                ['Organic Content (SEO)', 'Broken tracking code, server downtime, major algorithm rollout'],
              ].map(([a, b]) => <tr key={a} style={{ borderTop: '1px solid #e5e7eb' }}><td style={S.td}>{a}</td><td style={S.td}>{b}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Accordion>

      <Accordion title="What this tool adds" isOpen={!!open.adds} onToggle={() => toggle('adds')}>
        <p style={{ margin: 0 }}>
          1. A plain-English verdict on your latest data point: within the noise, possible shift, or investigate.<br />
          2. A findings list that groups every signal by date range and rule.<br />
          3. A growth toggle for teams that expect to grow, with a prompt to turn it on when your data is trending up.<br />
          4. Built for marketing metrics, with a weekly sample dataset and channel guidance.
        </p>
      </Accordion>
    </div>
  );
}
