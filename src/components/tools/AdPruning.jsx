import { useMemo, useState } from 'react';
import {
  decodeBuffer, parseCsv, num, textShare, guessMapping, analyze, whatToDo, stageVolume, toCsv, fmtN, kFor,
  DEFAULT_FLOOR_IMPRESSIONS, DEFAULT_CONFIDENCE, DEFAULT_MIN_CLICKS, MIN_STAGE_VOLUME,
} from './adPruneMath.js';
import { PLATFORM_OBJECTIVES, objectiveNames, canonicalObjective, normKey } from './platformObjectives.js';

// Ad Pruning Tool
// Privacy rules:
// 1. Uploaded files are read in the browser only (FileReader). Nothing the user uploads is sent anywhere.
// 2. Data lives in React state only. No localStorage, sessionStorage or IndexedDB.
// 3. Nothing from the file is pushed to the dataLayer.
// 4. Download Export is built client-side with a Blob URL.
// The only network requests are loading the public Syncflow sample files from this site.

const PLATFORMS = {
  linkedin: { label: 'LinkedIn Ads', type: 'social' },
  meta: { label: 'Meta Ads', type: 'social' },
  google: { label: 'Google Ads (Search)', type: 'search' },
};

const SAMPLES = {
  social: { url: '/data/syncflow_paid_social_mock.csv', name: 'Syncflow Paid Social Mock Data' },
  search: { url: '/data/syncflow_paid_search_mock.csv', name: 'Syncflow Paid Search Mock Data' },
  assets: { url: '/data/syncflow_rsa_assets_mock.csv', name: 'Syncflow RSA Assets Mock Data' },
};

const V = {
  off: { label: 'Turn off', color: '#d03b3b', bg: '#fef2f2', text: '#991b1b' },
  replace: { label: 'Replace candidate', color: '#d03b3b', bg: '#fef2f2', text: '#991b1b' },
  wait: { label: 'Wait', color: '#888780', bg: '#f5f5f4', text: '#44403c' },
  keep: { label: 'Keep', color: '#2a78d6', bg: '#eff6ff', text: '#1e3a8a' },
};

const money = x => (x === null || x === undefined || !Number.isFinite(x) ? 'n/a' : `$${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const pct = (x, d = 2) => (x === null || x === undefined || !Number.isFinite(x) ? 'n/a' : `${(x * 100).toFixed(d)}%`);
const int = x => Math.round(x).toLocaleString('en-US');

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

// Marker shapes so verdicts never rely on color alone: triangle = turn off, square = wait, circle = keep.
function Mark({ x, y, v, ring = '#fff' }) {
  const c = V[v].color;
  if (v === 'off' || v === 'replace') return <path d={`M${x},${y - 6} L${x + 6},${y + 5} L${x - 6},${y + 5} Z`} fill={c} stroke={ring} strokeWidth="1.5" />;
  if (v === 'wait') return <rect x={x - 4.5} y={y - 4.5} width="9" height="9" rx="1" fill={c} stroke={ring} strokeWidth="1.5" />;
  return <circle cx={x} cy={y} r="5" fill={c} stroke={ring} strokeWidth="1.5" />;
}

const S = {
  card: { border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 20px', marginTop: 16 },
  eyebrow: { fontSize: 12, fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' },
  title: { fontSize: 17, fontWeight: 600, color: '#111827', margin: '0 0 10px' },
  hint: { fontSize: 12, color: '#6b7280', margin: 0 },
  muted: { fontSize: 13, color: '#6b7280' },
  link: { color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, background: 'none', border: 0, padding: 0, fontFamily: 'inherit' },
  primary: { fontSize: 13, background: '#2563eb', border: '1px solid #2563eb', color: '#fff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' },
  secondary: { fontSize: 13, background: '#fff', border: '1px solid #d1d5db', color: '#111827', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' },
  select: { fontSize: 13, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', maxWidth: '100%' },
  stat: { background: '#f5f5f4', borderRadius: 8, padding: '14px 16px' },
  statLabel: { fontSize: 12, color: '#4b5563', margin: '0 0 8px' },
  statValue: { fontSize: 22, fontWeight: 600, margin: 0, color: '#111827' },
  nudge: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', borderRadius: 8, padding: '10px 14px', fontSize: 13, margin: '0 0 12px' },
  warn: { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '10px 14px', fontSize: 13, margin: '0 0 12px' },
  sep: { border: 0, borderTop: '1px solid #e5e7eb', margin: '16px 0' },
  sec: { fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 4px' },
  th: { padding: '8px 10px', fontWeight: 600, color: '#111827', textAlign: 'left', verticalAlign: 'bottom', whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', verticalAlign: 'top' },
  seg: on => ({ fontSize: 13, padding: '6px 12px', border: '1px solid', borderColor: on ? '#2563eb' : '#d1d5db', background: on ? '#eff6ff' : '#fff', color: on ? '#1e3a8a' : '#374151', borderRadius: 8, cursor: 'pointer', fontWeight: on ? 600 : 400 }),
};

const NUMERIC = new Set(['impressions', 'clicks', 'spend', 'opens']);

function fieldsFor(mode) {
  const F = [
    { k: 'adName', label: mode === 'assets' ? 'Asset text' : 'Ad name', req: true },
    { k: 'adId', label: 'Ad ID', req: mode === 'assets' },
    { k: 'campaign', label: 'Campaign', req: true },
    { k: 'group', label: mode === 'social' ? 'Ad set' : 'Ad group', req: false },
  ];
  if (mode !== 'assets') F.push({ k: 'objective', label: mode === 'search' ? 'Campaign objective' : 'Objective', req: false });
  if (mode === 'social') F.push({ k: 'audience', label: 'Audience (e.g. prospecting, retargeting)', req: false });
  if (mode === 'assets') F.push({ k: 'assetType', label: 'Asset type (headline or description)', req: true });
  F.push({ k: 'impressions', label: 'Impressions', req: true });
  F.push({ k: 'clicks', label: 'Clicks', req: true });
  F.push({ k: 'spend', label: 'Spend or cost', req: true });
  if (mode === 'social') F.push({ k: 'opens', label: 'Form opens (native lead forms)', req: false });
  return F;
}

function Chart({ list, mode, floorImpr, convLabel, hover, setHover }) {
  const xKey = mode === 'social' ? 'impr' : 'clicks';
  const pts = list.filter(a => a.index !== null && a[xKey] > 0);
  if (!pts.length) return <p style={S.muted}>No ads with a comparison group to plot yet.</p>;
  const W = 700, H = 340, X0 = 54, X1 = 680, Y0 = 16, Y1 = 290;
  const xs = pts.map(a => a[xKey]).concat(mode === 'social' ? [floorImpr] : []);
  const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...xs))));
  const hi = Math.pow(10, Math.ceil(Math.log10(Math.max(...xs) * 1.0001)));
  const yMax = Math.min(4, Math.max(2, Math.ceil(Math.max(...pts.map(a => a.index)) * 2) / 2));
  const sx = v => X0 + ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (X1 - X0);
  const sy = v => Y1 - (Math.min(v, yMax) / yMax) * (Y1 - Y0);
  const ticks = [];
  for (let t = lo; t <= hi; t *= 10) ticks.push(t);
  const yt = [];
  for (let t = 0; t <= yMax + 1e-9; t += 0.5) yt.push(t);
  const tx = { fill: '#6b7280', fontSize: 11 };
  const tip = hover !== null ? pts.find(a => a.id === hover) : null;
  const tipX = tip ? (sx(tip[xKey]) > W - 260 ? sx(tip[xKey]) - 250 : sx(tip[xKey]) + 12) : 0;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Scatter chart of ${pts.length} ads: ${xKey === 'impr' ? 'impressions' : 'clicks'} against actual divided by expected ${convLabel}, marked by verdict`} onMouseLeave={() => setHover(null)}>
        {yt.map(t => (
          <g key={t}>
            <line x1={X0} x2={X1} y1={sy(t)} y2={sy(t)} stroke="#e1e0d9" strokeWidth="1" />
            <text x={X0 - 8} y={sy(t) + 4} textAnchor="end" style={tx}>{t.toFixed(1)}{t === yMax && pts.some(a => a.index > yMax) ? '+' : ''}</text>
          </g>
        ))}
        <line x1={X0} x2={X1} y1={sy(1)} y2={sy(1)} stroke="#888780" strokeWidth="1.5" strokeDasharray="2,3" />
        <text x={X1} y={sy(1) - 5} textAnchor="end" style={{ fill: '#4b5563', fontSize: 11 }}>Group average (1.0)</text>
        {mode === 'social' && (
          <g>
            <rect x={X0} y={Y0} width={Math.max(0, sx(floorImpr) - X0)} height={Y1 - Y0} fill="#888780" opacity="0.06" />
            <line x1={sx(floorImpr)} x2={sx(floorImpr)} y1={Y0} y2={Y1} stroke="#888780" strokeWidth="1.5" strokeDasharray="5,4" />
            <text x={sx(floorImpr) - 6} y={Y0 + 12} textAnchor="end" style={{ fill: '#4b5563', fontSize: 11 }}>Wait zone</text>
            <text x={sx(floorImpr) + 6} y={Y0 + 12} style={{ fill: '#4b5563', fontSize: 11 }}>Floor: {int(floorImpr)}</text>
          </g>
        )}
        {ticks.map(t => <text key={t} x={sx(t)} y={Y1 + 18} textAnchor="middle" style={tx}>{int(t)}</text>)}
        <text x={(X0 + X1) / 2} y={H - 6} textAnchor="middle" style={tx}>{xKey === 'impr' ? 'Impressions (log scale)' : 'Clicks (log scale). Click floors vary by comparison group'}</text>
        <text transform={`translate(12 ${(Y0 + Y1) / 2}) rotate(-90)`} textAnchor="middle" style={tx}>Actual ÷ expected {convLabel}</text>
        {pts.map(a => (
          <g key={a.id} style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(a.id)} onClick={() => setHover(a.id)}>
            <circle cx={sx(a[xKey])} cy={sy(a.index)} r="10" fill="transparent" />
            <Mark x={sx(a[xKey])} y={sy(a.index)} v={a.vkey} ring={hover === a.id ? '#111827' : '#fff'} />
          </g>
        ))}
      </svg>
      {tip && (
        <div style={{ position: 'absolute', pointerEvents: 'none', left: `${(tipX / W) * 100}%`, top: `${((sy(tip.index) > H * 0.5 ? Math.max(sy(tip.index) - 130, 0) : sy(tip.index) + 12) / H) * 100}%`, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 12, width: 240, lineHeight: 1.5, color: '#111827' }}>
          <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '1px 8px', background: V[tip.vkey].bg, color: V[tip.vkey].text }}>{tip.verdictLabel}</span>
          <b style={{ display: 'block', fontWeight: 600, margin: '4px 0' }}>{tip.name}</b>
          <span style={{ display: 'block' }}>{mode === 'social' ? `Impressions: ${int(tip.impr)}` : `Clicks: ${int(tip.clicks)}`}</span>
          <span style={{ display: 'block' }}>{convLabel}: {fmtN(tip.conv)} vs. {tip.expected.toFixed(1)} expected</span>
          <span style={{ display: 'block' }}>Cost per conversion: {money(tip.own.cpx)} vs. {money(tip.groupCpx)} group</span>
        </div>
      )}
    </div>
  );
}

export default function AdPruning() {
  const [platform, setPlatform] = useState('linkedin');
  const [gMode, setGMode] = useState('ads');
  const [raw, setRaw] = useState(null); // { name, headers, rows }
  const [map, setMap] = useState(null);
  const [assign, setAssign] = useState({});
  const [objIdx, setObjIdx] = useState(0);
  const [resultCol, setResultCol] = useState('');
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const [floorImpr, setFloorImpr] = useState(DEFAULT_FLOOR_IMPRESSIONS);
  const [minClicks, setMinClicks] = useState(DEFAULT_MIN_CLICKS);
  const [days, setDays] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [hover, setHover] = useState(null);
  const [open, setOpen] = useState({});
  const toggle = k => setOpen(o => ({ ...o, [k]: !o[k] }));

  const ptype = PLATFORMS[platform].type;
  const mode = ptype === 'search' ? (gMode === 'assets' ? 'assets' : 'search') : 'social';
  const fields = fieldsFor(mode);

  function reset() { setRaw(null); setMap(null); setAssign({}); setObjIdx(0); setResultCol(''); setError(''); setPending(null); setHover(null); }
  function choosePlatform(p) { if (p !== platform) { setPlatform(p); reset(); } }
  function chooseGMode(m) { if (m !== gMode) { setGMode(m); reset(); } }

  function load(name, text) {
    const { headers, rows } = parseCsv(text);
    if (!headers.length || !rows.length) { setError('That file has no rows we could read. Export a CSV with a header row and at least one ad.'); return; }
    const g = guessMapping(headers);
    setRaw({ name, headers, rows });
    setMap(g);
    setAssign({});
    setObjIdx(0);
    setResultCol(g.results[g.results.length - 1] || g.results[0] || '');
    setHover(null);
    setError('');
  }

  function pick(file) { setPending(file || null); setError(''); }
  function submit() {
    if (!pending) { setError('Choose a CSV file first.'); return; }
    const reader = new FileReader();
    reader.onload = () => load(pending.name, decodeBuffer(reader.result));
    reader.onerror = () => setError('We could not read that file.');
    reader.readAsArrayBuffer(pending);
  }
  async function loadSample() {
    const s = SAMPLES[mode];
    try {
      const res = await fetch(s.url);
      if (!res.ok) throw new Error();
      load(s.name, await res.text());
    } catch { setError('The sample could not be loaded. Try again.'); }
  }

  const setField = (k, v) => setMap(m => ({ ...m, [k]: v || undefined }));
  const setStage = (i, v) => setMap(m => {
    const r = [...(m.results || [])];
    if (v) r[i] = v; else r.splice(i, 1);
    const clean = r.filter(Boolean);
    if (!clean.includes(resultCol)) setResultCol(clean[clean.length - 1] || clean[0] || '');
    return { ...m, results: clean };
  });

  const missing = map ? fields.filter(f => f.req && !map[f.k]).map(f => f.label) : [];
  if (map && !(map.results || []).length) missing.push(mode === 'search' ? 'At least one conversion column' : 'At least one result column');
  // Live check: numeric fields must hold numbers. Over half text in a column blocks the run.
  const numChecks = useMemo(() => {
    if (!raw || !map) return {};
    const out = {};
    fields.filter(f => NUMERIC.has(f.k) && map[f.k]).forEach(f => { out[f.k] = textShare(raw.rows, map[f.k]); });
    (map.results || []).forEach(c => { out[`result:${c}`] = textShare(raw.rows, c); });
    return out;
  }, [raw, map, mode]);
  const textBlocked = Object.entries(numChecks).filter(([, t]) => t.share > 0.5).map(([k]) => (k.startsWith('result:') ? k.slice(7) : fields.find(f => f.k === k)?.label || k));
  if (textBlocked.length) missing.push(`Number columns that look like text: ${textBlocked.join(', ')}`);
  const mapped = !!map && missing.length === 0;

  // Normalized rows for every ad in the upload (all objectives).
  const allRows = useMemo(() => {
    if (!raw || !mapped) return [];
    return raw.rows.map((r, i) => ({
      id: i,
      name: r[map.adName] || `Row ${i + 1}`,
      adId: map.adId ? r[map.adId] : '',
      campaign: r[map.campaign] || '(no campaign)',
      group: map.group ? r[map.group] : '',
      audience: map.audience ? r[map.audience] : '',
      assetType: map.assetType ? r[map.assetType] : '',
      objective: map.objective ? r[map.objective] : '',
      impr: num(r[map.impressions]),
      clicks: num(r[map.clicks]),
      spend: num(r[map.spend]),
      conv: resultCol ? num(r[resultCol]) : 0,
      opens: map.opens ? num(r[map.opens]) : 0,
    })).filter(r => r.impr > 0 || r.spend > 0);
  }, [raw, map, mapped, resultCol]);

  const campaigns = useMemo(() => [...new Set(allRows.map(r => r.campaign))], [allRows]);
  const needAssign = mode === 'social' && mapped && !map.objective;
  // Objective values are matched to the platform's official names (casing, spacing and API-style quirks).
  // Unknown values are grouped by their normalized form and shown as first written.
  const objInfo = useMemo(() => {
    const seen = new Map();
    const unofficial = new Set();
    if (map?.objective) allRows.forEach(r => {
      const c = canonicalObjective(platform, r.objective);
      if (!c.name) return;
      const k = normKey(c.name);
      if (!seen.has(k)) seen.set(k, c.name);
      if (!c.official) unofficial.add(seen.get(k));
    });
    return { seen, unofficial: [...unofficial] };
  }, [allRows, map, platform]);
  const objectiveOf = r => {
    if (mode === 'assets') return 'All campaigns';
    if (map.objective) { const c = canonicalObjective(platform, r.objective); return c.name ? objInfo.seen.get(normKey(c.name)) : '(no objective)'; }
    return mode === 'search' ? 'All campaigns' : assign[r.campaign] || '';
  };
  const objectives = useMemo(() => {
    if (!mapped) return [];
    return [...new Set(allRows.map(objectiveOf).filter(Boolean))];
  }, [allRows, assign, mapped, mode, objInfo]);
  const obj = objectives[Math.min(objIdx, Math.max(0, objectives.length - 1))];
  const objRows = useMemo(() => allRows.filter(r => objectiveOf(r) === obj), [allRows, obj, assign, objInfo]);

  const convLabel = resultCol || 'conversions';
  const analysis = useMemo(() => {
    if (!objRows.length) return [];
    return analyze(objRows, { mode, confidence, floorImpressions: floorImpr, minClicks, accountRows: allRows }).map(a => {
      const vkey = a.verdict === 'off' ? (mode === 'assets' ? 'replace' : 'off') : a.verdict;
      const out = { ...a, vkey, verdictLabel: V[vkey].label };
      out.todo = whatToDo(out, { mode, convLabel });
      return out;
    });
  }, [objRows, mode, confidence, floorImpr, minClicks, allRows, convLabel]);

  const sections = useMemo(() => {
    const off = analysis.filter(a => a.verdict === 'off').sort((x, y) => y.excess - x.excess);
    const wait = analysis.filter(a => a.verdict === 'wait').sort((x, y) => (y.progress ?? -1) - (x.progress ?? -1));
    const keep = analysis.filter(a => a.verdict === 'keep').sort((x, y) => y.index - x.index);
    return [[mode === 'assets' ? 'replace' : 'off', off], ['wait', wait], ['keep', keep]];
  }, [analysis, mode]);

  function downloadExport() {
    const ordered = sections.flatMap(([, l]) => l);
    const blob = new Blob([toCsv(ordered, convLabel)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ad-pruning-${(obj || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Funnel-depth check for paid search: does the picked stage have enough volume?
  const stages = map?.results || [];
  const vol = mode === 'search' && objRows.length ? stageVolume(objRows, Number(days) || 0) : null;
  const stageIdx = stages.indexOf(resultCol);
  const upStage = stageIdx > 0 ? stages[stageIdx - 1] : null;
  const showForm = mode === 'social' && !!map?.opens && objRows.some(r => r.opens > 0);

  // ---------- results ----------
  let results = null;
  if (mapped && objRows.length) {
    const offKey = mode === 'assets' ? 'replace' : 'off';
    const tile = (k, l) => (
      <div style={S.stat} key={k}>
        <p style={S.statLabel}>{V[k].label}</p>
        <p style={{ ...S.statValue, color: V[k].text }}>{l.length} <span style={{ fontSize: 13, fontWeight: 400, color: '#4b5563' }}>ads, {money(l.reduce((s, a) => s + a.spend, 0))}</span></p>
      </div>
    );
    const kpi = a => {
      const lines = [
        mode === 'social'
          ? `Impr. ${int(a.impr)}${a.verdict === 'wait' && a.floor?.type === 'impressions' && !a.pastFloor ? ` / ${int(a.floor.value)}` : ''}`
          : `Clicks ${int(a.clicks)}${a.verdict === 'wait' && a.floor?.type === 'clicks' && !a.pastFloor && Number.isFinite(a.floor.value) ? ` / ${int(a.floor.value)}` : ''}`,
        `Spend ${money(a.spend)}`,
        `${convLabel} ${fmtN(a.conv)}${a.expected !== null ? ` vs. ${a.expected.toFixed(1)} exp.` : ''}`,
        `Cost/conv. ${a.conv ? money(a.own.cpx) : 'none yet'}`,
        `CTR ${pct(a.own.ctr)}`,
        `Conv. rate ${pct(a.own.cvr)}`,
      ];
      if (showForm) lines.push(`Form CVR ${pct(a.own.formCvr)}`);
      return lines;
    };
    const avg = a => {
      const g = a.groupRates, c = a.accountRates;
      const lines = [
        ' ', ' ', ' ',
        `group ${g ? money(a.groupCpx) : 'n/a'} | acct ${money(c.cpx)}`,
        `group ${g ? pct(g.ctr) : 'n/a'} | acct ${pct(c.ctr)}`,
        `group ${g ? pct(g.cvr) : 'n/a'} | acct ${pct(c.cvr)}`,
      ];
      if (showForm) lines.push(`group ${g ? pct(g.formCvr) : 'n/a'} | acct ${pct(c.formCvr)}`);
      return lines;
    };
    const stack = (lines, style) => lines.map((l, i) => <span key={i} style={{ display: 'block', whiteSpace: 'nowrap', ...style }}>{l}</span>);
    const noGroup = analysis.filter(a => a.index === null).length;

    results = (
      <div style={{ marginTop: 22 }}>
        <p style={S.eyebrow}>Step 5</p>
        <h3 style={S.title}>Read the verdicts{objectives.length > 1 ? `: ${obj}` : ''}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, margin: '0 0 18px' }}>
          {tile(offKey, sections[0][1])}{tile('wait', sections[1][1])}{tile('keep', sections[2][1])}
        </div>
        {mode === 'assets' && <div style={S.warn}>Asset results are directional. Google counts one impression for every asset shown in an ad, and says asset-level ratios should be used as directional indicators only.</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '0 0 8px', fontSize: 12, color: '#374151' }}>
          {[offKey, 'wait', 'keep'].map(k => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="14" height="14" viewBox="-7 -7 14 14"><Mark x={0} y={0} v={k} ring="none" /></svg>{V[k].label}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="22" height="10"><line x1="1" y1="5" x2="21" y2="5" stroke="#888780" strokeWidth="1.5" strokeDasharray="2,3" /></svg>Group average
          </span>
        </div>
        <Chart list={analysis} mode={mode} floorImpr={floorImpr} convLabel={convLabel} hover={hover} setHover={setHover} />
        {noGroup > 0 && <p style={{ ...S.hint, marginTop: 6 }}>{noGroup} {noGroup === 1 ? 'ad is' : 'ads are'} not plotted because there is no comparison group with conversions yet. {noGroup === 1 ? 'It is' : 'They are'} listed under Wait.</p>}

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, margin: '24px 0 4px' }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#111827' }}>Ads analyzed ({analysis.length})</h4>
          <button style={S.primary} onClick={downloadExport}>Download Export</button>
        </div>
        <p style={{ ...S.hint, margin: '0 0 8px' }}>Averages column: group average (decides the verdict) | account average (every ad in your upload, for context).</p>
        {sections.map(([k, l]) => (l.length ? (
          <div key={k} style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px', color: V[k].text, background: V[k].bg, borderRadius: 6, padding: '6px 10px' }}>
              {V[k].label}: {l.length} {l.length === 1 ? 'ad' : 'ads'}, {money(l.reduce((s, a) => s + a.spend, 0))} spend
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#374151' }}>
                <thead>
                  <tr style={{ background: '#f5f5f4' }}>
                    <th style={S.th}>{mode === 'assets' ? 'Asset' : 'Ad name'}</th>
                    <th style={S.th}>Campaign</th>
                    <th style={S.th}>Compared against</th>
                    <th style={S.th}>KPIs</th>
                    <th style={S.th}>Averages</th>
                  </tr>
                </thead>
                <tbody>
                  {l.map(a => [
                    <tr key={a.id} style={{ borderTop: '1px solid #e5e7eb', background: hover === a.id ? '#f8fafc' : 'transparent' }} onMouseEnter={() => setHover(a.id)}>
                      <td style={{ ...S.td, minWidth: 150 }}>
                        <span style={{ display: 'block', color: '#111827', fontWeight: 500 }}>{a.name}</span>
                        {a.adId && <span style={{ display: 'block', fontSize: 11, color: '#9b9a97' }}>ID {a.adId}{mode === 'assets' && a.assetType ? ` | ${a.assetType}` : ''}</span>}
                      </td>
                      <td style={{ ...S.td, minWidth: 120 }}>{a.campaign}{a.group && <span style={{ display: 'block', fontSize: 11, color: '#9b9a97' }}>{a.group}</span>}</td>
                      <td style={S.td}>{a.compared || 'None yet'}</td>
                      <td style={S.td}>{stack(kpi(a))}</td>
                      <td style={S.td}>{stack(avg(a), { color: '#6b7280' })}</td>
                    </tr>,
                    <tr key={`${a.id}-todo`} style={{ background: hover === a.id ? '#f8fafc' : 'transparent' }} onMouseEnter={() => setHover(a.id)}>
                      <td colSpan={5} style={{ padding: '0 10px 10px', color: '#111827' }}>
                        <span style={{ fontWeight: 600, color: V[a.vkey].text }}>What to do: </span>{a.todo}
                      </td>
                    </tr>,
                  ])}
                </tbody>
              </table>
            </div>
          </div>
        ) : null))}
        {objectives.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={S.secondary} onClick={() => { setObjIdx((objIdx + 1) % objectives.length); setHover(null); }}>
              Next objective: {objectives[(objIdx + 1) % objectives.length]} →
            </button>
          </div>
        )}
      </div>
    );
  }

  const opt = (h, i) => <option key={i} value={h}>{h}</option>;

  return (
    <div>
      <Accordion title="How to use this tool, step by step" isOpen={!!open.guide} onToggle={() => toggle('guide')}>
        <ol style={{ margin: 0, paddingLeft: 20, listStyleType: 'decimal' }}>
          <li style={{ marginBottom: 6 }}>Pick the ad platform your export comes from. For Google Ads, choose whether you are judging whole ads or RSA assets (headlines and descriptions).</li>
          <li style={{ marginBottom: 6 }}>Export your ad performance report as a CSV, at the ad level with all columns, and upload it. Or load the Syncflow sample to see how it works.</li>
          <li style={{ marginBottom: 6 }}>Match your file's columns to the fields the tool needs. The tool suggests matches, so check each one.</li>
          <li style={{ marginBottom: 6 }}>Pick the objective, and the result or conversion you are optimizing for. The tool analyzes one objective at a time.</li>
          <li>Read the verdicts. Turn off the ads in the Turn off list, leave the Wait list alone until it reaches the floor, and use Download Export to take the list into your ad platform.</li>
        </ol>
      </Accordion>

      <section style={S.card}>
        <p style={S.eyebrow}>Step 1</p>
        <h3 style={S.title}>Choose your platform</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(PLATFORMS).map(([k, p]) => <button key={k} style={S.seg(platform === k)} onClick={() => choosePlatform(k)}>{p.label}</button>)}
        </div>
        {ptype === 'search' && (
          <div style={{ marginTop: 12 }}>
            <p style={{ ...S.hint, margin: '0 0 6px' }}>What are you judging?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button style={S.seg(gMode === 'ads')} onClick={() => chooseGMode('ads')}>Ads</button>
              <button style={S.seg(gMode === 'assets')} onClick={() => chooseGMode('assets')}>RSA assets (directional)</button>
            </div>
          </div>
        )}

        <hr style={S.sep} />
        <p style={S.eyebrow}>Step 2</p>
        <h3 style={S.title}>Upload and submit</h3>
        <div
          onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
          onDrop={e => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files[0]); }}
          style={{ border: `2px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`, borderRadius: 10, padding: '22px 16px', textAlign: 'center', background: dragOver ? '#eff6ff' : '#f8fafc' }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px', color: '#111827' }}>Drag your CSV here</p>
          <p style={{ ...S.muted, margin: '0 0 6px' }}>or <label style={S.link}>choose a file<input type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={e => { pick(e.target.files[0]); e.target.value = ''; }} /></label></p>
          {pending && <p style={{ ...S.muted, margin: '8px 0 0' }}>Selected: {pending.name}</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button style={S.primary} onClick={submit}>Submit</button>
        </div>
        {error && <p style={{ color: '#b91c1c', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}
        {(platform !== 'meta') && <p style={{ ...S.muted, margin: '10px 0 0' }}>No data yet? <button style={S.link} onClick={loadSample}>Load the sample ({SAMPLES[mode].name})</button></p>}
        {raw && <p style={{ fontSize: 12, color: '#9b9a97', marginTop: 12 }}>Loaded: {raw.name} ({raw.rows.length} rows, {raw.headers.length} columns).</p>}

        <hr style={S.sep} />
        <p style={S.eyebrow}>Step 3</p>
        <h3 style={S.title}>Map your columns</h3>
        <p style={{ ...S.warn, fontWeight: 600 }}>Ensure you exported at the AD level with ALL columns enabled.</p>
        {map ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px 20px' }}>
              {fields.map(f => (
                <label key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13, color: '#111827' }}>
                  <span>{f.label}{f.req ? ' *' : <span style={{ color: '#9b9a97' }}> (optional)</span>}</span>
                  <select style={S.select} value={map[f.k] || ''} onChange={e => setField(f.k, e.target.value)}>
                    <option value="">(none)</option>
                    {raw.headers.map(opt)}
                  </select>
                </label>
              ))}
            </div>
            <p style={{ fontSize: 13, color: '#111827', margin: '14px 0 4px' }}>
              {mode === 'search' ? 'Conversion columns, top of the funnel to the bottom *' : mode === 'assets' ? 'Conversion column *' : 'Result columns (what counts as a conversion) *'}
            </p>
            {mode === 'search' && <p style={{ ...S.hint, margin: '0 0 6px' }}>Example: Form fills, then MQLs, then SQLs, if you import offline conversions into Google Ads.</p>}
            {mode !== 'assets' && <p style={{ ...S.hint, margin: '0 0 6px' }}>Each analysis judges one column at a time. Columns are never added together, because funnel stages overlap (every SQL was also a form fill).</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[...(map.results || []), ''].slice(0, mode === 'assets' ? 1 : 4).map((v, i) => (
                <label key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: '#6b7280' }}>
                  {mode === 'search' ? `Stage ${i + 1}` : `Column ${i + 1}`}
                  <select style={S.select} value={v} onChange={e => setStage(i, e.target.value)}>
                    <option value="">(none)</option>
                    {raw.headers.map(opt)}
                  </select>
                </label>
              ))}
            </div>
            {(() => {
              const first = raw.rows.find(r => Object.values(r).some(v => String(v).trim() !== '')) || raw.rows[0];
              const cols = fields.filter(f => map[f.k]).map(f => ({ key: f.k, label: f.label.replace(/ \(.*\)$/, ''), col: map[f.k], numeric: NUMERIC.has(f.k) }))
                .concat((map.results || []).map(c => ({ key: `result:${c}`, label: c, col: c, numeric: true })));
              if (!cols.length) return null;
              return (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 13, color: '#111827', margin: '0 0 4px', fontWeight: 600 }}>Live preview: first row, as the tool reads it</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {cols.map(c => {
                      const rawV = String(first[c.col] ?? '');
                      const chk = c.numeric ? numChecks[c.key] : null;
                      const bad = c.numeric && chk && chk.bad > 0;
                      const isText = c.numeric && rawV.trim() !== '' && !Number.isFinite(Number(rawV.replace(/[$€£,%\s]/g, '')));
                      let shown = rawV || '(blank)';
                      if (c.numeric) shown = isText ? `"${rawV}" is text` : num(rawV).toLocaleString('en-US');
                      if (c.key === 'objective' && rawV) {
                        const co = canonicalObjective(platform, rawV);
                        shown = co.official && co.name !== rawV ? `${co.name} (from "${rawV}")` : co.official ? co.name : `${rawV} (not official)`;
                      }
                      return (
                        <div key={c.key} style={{ border: `1px solid ${bad ? '#fecaca' : '#e5e7eb'}`, background: bad ? '#fef2f2' : '#fff', borderRadius: 8, padding: '6px 8px', fontSize: 12, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 11, color: bad ? '#991b1b' : '#6b7280' }}>{c.label}{c.numeric ? ' (#)' : ''} <span style={{ color: '#9b9a97' }}>| {c.col}</span></span>
                          <span style={{ display: 'block', color: bad ? '#991b1b' : '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={shown}>{shown}</span>
                          {bad && <span style={{ display: 'block', fontSize: 11, color: '#991b1b' }}>{chk.bad} of {chk.filled} rows are text</span>}
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ ...S.hint, margin: '4px 0 0' }}>(#) = read as a number. Red means a number field is pulling in text, so the column is probably mapped wrong.</p>
                </div>
              );
            })()}
            {missing.length > 0 && <p style={{ color: '#b91c1c', fontSize: 13, margin: '10px 0 0' }}>Still needed: {missing.join(', ')}.</p>}
          </div>
        ) : (
          <p style={S.hint}>Your file's columns show up here after you upload. LinkedIn does not export every dashboard column (for example, Cost per result), so the tool calculates cost per conversion itself from spend and conversions.</p>
        )}

        {needAssign && campaigns.length > 0 && (
          <div>
            <hr style={S.sep} />
            <p style={S.eyebrow}>Step 3b</p>
            <h3 style={S.title}>Assign each campaign to an objective</h3>
            <p style={{ ...S.hint, margin: '0 0 8px' }}>Your file has no objective column. Pick the objective for each campaign once, so ads are only compared with ads chasing the same goal.</p>
            {campaigns.map(c => (
              <div key={c} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' }}>
                <span style={{ flex: '1 1 260px', color: '#111827' }}>{c}</span>
                <select style={S.select} value={assign[c] || ''} onChange={e => { setAssign(a => ({ ...a, [c]: e.target.value })); setObjIdx(0); }}>
                  <option value="">(skip)</option>
                  {objectiveNames(platform).map(opt)}
                </select>
              </div>
            ))}
          </div>
        )}

        {mapped && objectives.length > 0 && (
          <div>
            <hr style={S.sep} />
            <p style={S.eyebrow}>Step 4</p>
            <h3 style={S.title}>Set the analysis</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', fontSize: 13, color: '#111827' }}>
              {(mode === 'social' || objectives.length > 1) && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  Objective
                  <select style={S.select} value={obj} onChange={e => { setObjIdx(objectives.indexOf(e.target.value)); setHover(null); }}>
                    {objectives.map(opt)}
                  </select>
                </label>
              )}
              {mode !== 'assets' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {mode === 'search' ? 'What are you optimizing for?' : 'Result to judge on'}
                  <select style={S.select} value={resultCol} onChange={e => setResultCol(e.target.value)}>
                    {stages.map(opt)}
                  </select>
                </label>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                Confidence for a {mode === 'assets' ? 'Replace' : 'Turn off'} verdict
                <select style={S.select} value={confidence} onChange={e => setConfidence(Number(e.target.value))}>
                  <option value={0.95}>95% (default)</option>
                  <option value={0.9}>90%</option>
                </select>
              </label>
              {mode === 'social' ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  Impression floor per ad
                  <input type="number" min="0" step="1000" value={floorImpr} onChange={e => setFloorImpr(Math.max(0, Number(e.target.value) || 0))} style={{ ...S.select, width: 120 }} />
                </label>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  Minimum click floor
                  <input type="number" min="0" step="5" value={minClicks} onChange={e => setMinClicks(Math.max(0, Number(e.target.value) || 0))} style={{ ...S.select, width: 120 }} />
                </label>
              )}
              {mode !== 'social' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  Days in this export (optional)
                  <input type="number" min="0" step="1" value={days} onChange={e => setDays(e.target.value)} style={{ ...S.select, width: 120 }} />
                </label>
              )}
            </div>
            {objInfo.unofficial.length > 0 && (
              <div style={{ ...S.warn, marginTop: 10 }}>
                Not on {PLATFORM_OBJECTIVES[platform].label}'s official objective list, so kept exactly as written: {objInfo.unofficial.join(', ')}. Check that the platform and the objective column are right.
              </div>
            )}
            <p style={{ ...S.hint, margin: '8px 0 0' }}>
              {mode === 'social'
                ? "Floor default: 10,000 impressions per ad and audience. This is Javier Cruz Galera's practitioner rule, not an industry benchmark. Change it to match your own."
                : `Click floor: the higher of ${int(minClicks)} clicks or the clicks needed to expect ${kFor(confidence).toFixed(1)} ${convLabel} at that group's conversion rate. Deeper funnel stages convert less often, so the floor rises automatically. The ${DEFAULT_MIN_CLICKS}-click default minimum is Javier Cruz Galera's choice, not an industry benchmark.`}
            </p>
            {vol && !vol.enough && (
              <div style={{ ...S.warn, marginTop: 10 }}>
                {vol.per30 !== null
                  ? `${convLabel}: about ${Math.round(vol.per30)} per 30 days in this export.`
                  : `${convLabel}: ${vol.total} in this export. Add the number of days in the export to check the monthly rate.`}{' '}
                Practitioners recommend optimizing to the deepest stage with at least {MIN_STAGE_VOLUME} conversions a month.
                {upStage ? ` Consider judging on ${upStage} instead.` : ''}
              </div>
            )}
          </div>
        )}
      </section>

      {results}

      <Accordion title="How this is calculated" isOpen={!!open.calc} onToggle={() => toggle('calc')}>
        <p style={{ margin: 0 }}>
          1. Comparison group: each ad is compared with the other ads in its most specific group that has conversions and at least one other ad past the floor. The ad itself is left out of its own group. Paid social: ad set, then audience segment (if mapped), otherwise the whole objective. Paid search: ad group, then campaign, then all ads in the analysis. RSA assets: the same asset type inside the same ad.<br />
          2. Group rates are pooled: total conversions divided by total spend or clicks, not an average of each ad's rate.<br />
          3. Volume floor. Paid social: impressions per ad (default 10,000, Javier Cruz Galera's practitioner rule). Paid search and assets: the higher of a minimum click count (default 30, Javier Cruz Galera's choice) or the clicks needed to expect about 3 conversions at the group's conversion rate (at 95% confidence, the exact number is 3.0; at 90%, 2.3). Below that, zero conversions can't be told apart from bad luck. The minimum keeps a high-converting group from producing a tiny floor.<br />
          4. Expected conversions: the ad's spend divided by the group's cost per conversion.<br />
          5. The test: a one-sided Poisson test asks how likely the ad's conversion count would be if it truly performed like its group. If that chance is under 5% (at 95% confidence), the verdict is Turn off. Example: $1,200 spend at a $300 group cost per lead means 4 expected leads. The chance of 0 is e^-4 = 1.8%, so it gets flagged.<br />
          6. Keep: past the floor and at or above expected conversions. Wait: under the floor, or below expected without enough evidence yet. Starved: under the floor while every other ad in its group is past it.<br />
          7. What to do: cost per conversion = CPM ÷ (1,000 × CTR × conversion rate), so the tool names whichever of the three is furthest off from the group.<br />
          8. Account average: every ad in your upload, across objectives. It is context only and never decides a verdict.
        </p>
        <Sources>
          <L href="https://opteo.com/docs/en/articles/11769301-pause-keyword">Opteo: Pause Keyword (3-conversion minimum)</L>, <L href="https://support.google.com/google-ads/answer/10285843?hl=en">Google Ads Help: Smart Bidding guidance</L>, <L href="https://www.understoryagency.com/blog/google-ads-optimization-b2b-saas">Understory: Google Ads optimization for B2B SaaS</L>, <L href="https://lionelz.com/en/blog/google-ads-b2b-conversiones-offline/">Lionel Fenestraz: Google Ads B2B lead quality and offline conversions</L>, <L href="https://support.google.com/google-ads/answer/9564897">Google Ads Help: Ad-level asset report for responsive search ads</L>, <L href="https://www.linkedin.com/help/linkedin/answer/107773">LinkedIn Help: Reports available to export in Campaign Manager</L>, <L href="https://business.linkedin.com/advertise/ads/how-to-advertise-on-linkedin">LinkedIn: How to advertise on LinkedIn (objectives)</L>, <L href="https://www.jonloomer.com/meta-campaign-objectives-best-practices/">Jon Loomer: Meta campaign objectives</L>, <L href="https://support.google.com/google-ads/answer/7450050">Google Ads Help: About campaign objectives</L>, <L href="https://www.linkedin.com/help/lms/answer/a424570">LinkedIn Help: Marketing objectives</L>
        </Sources>
      </Accordion>
    </div>
  );
}
