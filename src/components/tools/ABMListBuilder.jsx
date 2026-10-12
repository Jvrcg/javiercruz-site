import { useMemo, useState } from 'react';

// ABM List Builder
// Privacy rules (keep the Privacy-First copy true):
// 1. Uploaded files are read in the browser only (FileReader, or read-excel-file for .xlsx in Step 4.1). Nothing the user uploads or pastes is sent anywhere.
// 2. Data lives in React state only. No localStorage, sessionStorage or IndexedDB.
// 3. Nothing from the file is pushed to the dataLayer.
// 4. Downloads are built client-side with Blob URLs.
// The only network request is loading the public Syncflow sample file from this site.

const SAMPLE_URL = '/data/syncflow_customers.csv';
const TODAY = new Date();

// ---------- Colors (match the Keyword Planner palette) ----------
const TIER_STYLE = {
  'Strategic': { bg: '#E6F1FB', fg: '#0C447C', sub: '#185FA5' },
  'Core ICP': { bg: '#EAF3DE', fg: '#27500A', sub: '#3B6D11' },
  'Heavy Lift': { bg: '#FAEEDA', fg: '#633806', sub: '#854F0B' },
  'Churned': { bg: '#FCEBEB', fg: '#791F1F', sub: '#A32D2D' },
  'Closed-lost': { bg: '#f3f4f6', fg: '#374151', sub: '#6b7280' },
  'Hand-picked': { bg: '#EEEDFE', fg: '#3C3489', sub: '#534AB7' },
  'Not picked': { bg: '#f3f4f6', fg: '#374151', sub: '#6b7280' },
};

const TIER_LABEL = {
  'Strategic': 'Strategic',
  'Core ICP': 'Core ICP',
  'Heavy Lift': 'Heavy Lift / Transactional',
  'Churned': 'Churned (negative signal)',
  'Closed-lost': 'Closed-lost',
  'Hand-picked': 'Hand-picked best customer',
  'Not picked': 'Not picked',
};

const TIER_DEFINITION = {
  'Strategic': 'Highest Customer Lifetime Value (LTV), perfect product-market fit, short sales cycle, and high expansion potential.',
  'Core ICP': 'Solid revenue, standard sales cycle, requires some customization but generally healthy.',
  'Heavy Lift': 'Low revenue, high churn risk, or requires too much customer support. Exclude these from your predictive search.',
  'Churned': 'Customers who left in their first year. Used only to tell the LLM what to avoid.',
};

// ---------- Field schema ----------
const FIELDS = [
  { key: 'account_name', label: 'Account name', required: true, aliases: ['account name', 'account', 'company', 'company name', 'name', 'organization', 'organization name', 'customer', 'customer name'] },
  { key: 'domain', label: 'Domain', required: false, aliases: ['domain', 'company domain', 'website domain', 'email domain'] },
  { key: 'website', label: 'Website', required: false, aliases: ['website', 'url', 'company website', 'site', 'web'] },
  { key: 'industry', label: 'Industry', required: false, aliases: ['industry', 'vertical', 'sector'] },
  { key: 'employee_band', label: 'Employee band', required: false, aliases: ['employee band', 'employees', 'employee count', 'company size', 'headcount', 'size', 'number of employees'] },
  { key: 'region', label: 'Region', required: false, aliases: ['region', 'geo', 'geography', 'country', 'territory'] },
  { key: 'tech_stack', label: 'Tech stack', required: false, aliases: ['tech stack', 'technologies', 'technology', 'technographics', 'stack', 'tools'] },
  { key: 'pain_point_solved', label: 'Pain point solved', required: false, aliases: ['pain point solved', 'pain point', 'pain', 'use case', 'problem', 'problem solved', 'reason for purchase'] },
  { key: 'arr_usd', label: 'ARR (USD)', required: true, aliases: ['arr usd', 'arr', 'annual recurring revenue', 'contract value', 'acv', 'annual contract value', 'revenue', 'amount'] },
  { key: 'sales_cycle_days', label: 'Sales cycle (days)', required: true, aliases: ['sales cycle days', 'sales cycle', 'cycle days', 'days to close', 'sales cycle length', 'cycle length'] },
  { key: 'expansion', label: 'Expansion (Yes/No)', required: true, aliases: ['expansion', 'expanded', 'upsell', 'expansion potential', 'has expanded'] },
  { key: 'churn_risk', label: 'Churn risk (Low/Med/High)', required: true, aliases: ['churn risk', 'risk', 'health', 'health score', 'churn'] },
  { key: 'support_tickets_qtr', label: 'Support tickets per quarter', required: true, aliases: ['support tickets qtr', 'support tickets', 'tickets', 'tickets per quarter', 'support cases', 'cases'] },
  { key: 'pmf_fit', label: 'Product-market fit (High/Med/Low)', required: true, aliases: ['pmf fit', 'pmf', 'fit', 'product fit', 'product market fit', 'icp fit'] },
  { key: 'churned_year1', label: 'Churned in year one (Yes/No)', required: false, aliases: ['churned year1', 'churned year 1', 'churned in year one', 'churned first year', 'churned'] },
  { key: 'account_status', label: 'Account status (Customer/Closed-lost)', required: false, aliases: ['account status', 'status', 'stage', 'opportunity status'] },
  { key: 'closed_lost_date', label: 'Closed-lost date', required: false, aliases: ['closed lost date', 'lost date', 'close date', 'closed date'] },
];

const EMPLOYEE_BANDS = ['1-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'];

// ---------- Helpers ----------
function Chevron({ open }) {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let rowNum = 0; // spreadsheet row number, counting blank rows
  const keep = r => { rowNum++; if (r.some(v => v.trim() !== '')) { r.rowNum = rowNum; rows.push(r); } };
  const t = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(field); field = '';
      keep(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  keep(row);
  return rows;
}

function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCSV(filename, header, rows) {
  const text = [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normHeader(h) {
  return String(h).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function autoMap(headers) {
  const normed = headers.map(normHeader);
  const used = new Set();
  const mapping = {};
  // Pass 1: exact key or exact alias. Pass 2: header contains an alias.
  for (const pass of [1, 2]) {
    for (const f of FIELDS) {
      if (mapping[f.key] !== undefined) continue;
      const keyNorm = normHeader(f.key);
      const candidates = [keyNorm, ...f.aliases];
      let idx = -1;
      if (pass === 1) idx = normed.findIndex((h, i) => !used.has(i) && candidates.includes(h));
      else idx = normed.findIndex((h, i) => !used.has(i) && candidates.some(a => a.length > 3 && h.includes(a)));
      if (idx !== -1) { mapping[f.key] = idx; used.add(idx); }
    }
  }
  return mapping;
}

function normalizeDomain(raw) {
  if (!raw) return '';
  let d = String(raw).trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split(/[\/?#\s]/)[0];
  d = d.replace(/\.+$/, '');
  return d;
}

// Parse dates; YYYY-MM-DD is read as a local date so it doesn't shift a day by time zone
function parseDate(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseNumber(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).replace(/[$,\s]/g, '');
  if (s === '') return NaN;
  return Number(s);
}

function parseYesNo(v) {
  const s = String(v || '').trim().toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(s)) return 'Yes';
  if (['no', 'n', 'false', '0'].includes(s)) return 'No';
  return '';
}

function parseLevel(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s.startsWith('high')) return 'High';
  if (s.startsWith('med')) return 'Med';
  if (s.startsWith('low')) return 'Low';
  return '';
}

function parseEmployeeBand(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (EMPLOYEE_BANDS.includes(s)) return s;
  const n = parseNumber(s);
  if (Number.isNaN(n)) return s;
  if (n <= 50) return '1-50';
  if (n <= 200) return '51-200';
  if (n <= 500) return '201-500';
  if (n <= 1000) return '501-1000';
  if (n <= 5000) return '1001-5000';
  return '5000+';
}

// Linear interpolation quantile (same method as pandas and Excel PERCENTILE.INC)
function quantile(values, q) {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

function median(values) {
  return quantile(values, 0.5);
}

function fmtMoney(n) {
  if (Number.isNaN(n) || n === undefined || n === null) return '';
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function revenueBand(arr) {
  if (Number.isNaN(arr)) return '';
  if (arr >= 120000) return '$$$';
  if (arr >= 60000) return '$$';
  return '$';
}

function techList(s) {
  return String(s || '').split(/[,;|]/).map(x => x.trim()).filter(Boolean);
}

// ---------- Trait aggregation ----------
// A value is a trait of a group when >= 50% of the group has it AND its share is >= 1.25x
// its share across all current customers. Both cutoffs are judgment calls.
const TRAIT_FIELDS = [
  { key: 'industry', label: 'Industry' },
  { key: 'employee_band', label: 'Employees' },
  { key: 'region', label: 'Region' },
  { key: 'tech', label: 'Tech stack' },
  { key: 'pain_point_solved', label: 'Problem we solved' },
];

function hasValue(row, key, val) {
  if (key === 'tech') return techList(row.tech_stack).includes(val);
  return row[key] === val;
}

function valuesOf(rows, key) {
  const set = new Set();
  rows.forEach(r => {
    if (key === 'tech') techList(r.tech_stack).forEach(t => set.add(t));
    else if (r[key]) set.add(r[key]);
  });
  return [...set];
}

function overIndexedTraits(group, base) {
  const out = [];
  if (!group.length || !base.length) return out;
  TRAIT_FIELDS.forEach(f => {
    const items = [];
    valuesOf(group, f.key).forEach(v => {
      const n = group.filter(r => hasValue(r, f.key, v)).length;
      const share = n / group.length;
      const baseShare = base.filter(r => hasValue(r, f.key, v)).length / base.length;
      if (share >= 0.5 && baseShare > 0 && share / baseShare >= 1.25) {
        items.push({ value: v, n, total: group.length, baseShare });
      }
    });
    items.sort((a, b) => b.n - a.n || a.value.localeCompare(b.value));
    if (items.length) out.push({ label: f.label, items });
  });
  return out;
}

// Trait lines without counts or shares (used in the prompt and the export add-ons)
function plainTraitLines(traits) {
  return traits.map(t => {
    const vals = t.items.map(it => it.value);
    const sep = vals.some(v => v.includes(',')) ? '; ' : ', ';
    const label = t.label === 'Problem we solved' ? 'Problem' : t.label;
    return `- ${label}: ${vals.join(sep)}`;
  });
}

function Pill({ tier }) {
  if (!tier) return <span style={{ fontSize: 11, color: '#9ca3af' }}>Left out</span>;
  const st = TIER_STYLE[tier];
  return <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: st.bg, color: st.fg, whiteSpace: 'nowrap' }}>{TIER_LABEL[tier]}</span>;
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

// ---------- Main component ----------
export default function ABMListBuilder() {
  const [source, setSource] = useState(null); // { name, headers, rows }
  const [isSample, setIsSample] = useState(false);
  const [mapping, setMapping] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  // Editable cutoffs (judgment calls)
  const [strategicTopPct, setStrategicTopPct] = useState(20);
  const [heavyArrBottomPct, setHeavyArrBottomPct] = useState(25);
  const [heavyTicketsTopPct, setHeavyTicketsTopPct] = useState(25);
  const [traitsNeeded, setTraitsNeeded] = useState(2);
  const [windowMonths, setWindowMonths] = useState(10);

  // Hypothesis mode picks
  const [picked, setPicked] = useState({});

  // Step 4 inputs
  const [whatYouSell, setWhatYouSell] = useState('');
  const [strategicCount, setStrategicCount] = useState(15);
  const [coreCount, setCoreCount] = useState(20);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  // Step 4.1
  const [pasted, setPasted] = useState('');
  const [cleanResult, setCleanResult] = useState(null);
  const [cleanMode, setCleanMode] = useState(null); // 'paste' | null
  const [showCleanUpload, setShowCleanUpload] = useState(false);
  const [cleanFile, setCleanFile] = useState(null);
  const [cleanFileName, setCleanFileName] = useState('');
  const [cleanError, setCleanError] = useState('');

  const [tierFilter, setTierFilter] = useState('All');
  const [open, setOpen] = useState({});
  const toggle = k => setOpen(o => ({ ...o, [k]: !o[k] }));

  function resetDownstream() {
    setConfirmed(false);
    setPicked({});
    setCleanResult(null);
    setPasted('');
    setCleanFileName('');
    setCleanError('');
    setTierFilter('All');
  }

  function loadText(text, name, sample) {
    const rows = parseCSV(text);
    if (rows.length < 2) {
      setError("We couldn't find any rows. Check that the first row is your column headers.");
      return;
    }
    const headers = rows[0].map(h => h.trim());
    setSource({ name, headers, rows: rows.slice(1) });
    setMapping(autoMap(headers));
    setIsSample(sample);
    setError('');
    resetDownstream();
    setWhatYouSell('');
  }

  function handleUpload() {
    if (!pendingFile) return;
    if (!/\.csv$/i.test(pendingFile.name)) {
      setError("That file isn't a CSV. Export your list as .csv and try again.");
      setShowUpload(false);
      setPendingFile(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      loadText(String(e.target.result || ''), pendingFile.name, false);
      setShowUpload(false);
      setPendingFile(null);
    };
    reader.readAsText(pendingFile);
  }

  async function loadSample() {
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error('fetch failed');
      loadText(await res.text(), 'syncflow_customers.csv', true);
    } catch {
      setError("We couldn't load the sample file. Refresh the page and try again.");
    }
  }

  function downloadTemplate() {
    const header = FIELDS.map(f => f.key);
    const example = ['Example Co', 'example.com', 'https://example.com', 'Technology, Information and Media', '201-500', 'North America West', 'Snowflake, Salesforce, Looker', 'Brittle in-house pipelines breaking weekly', '85000', '72', 'Yes', 'Low', '6', 'High', 'No', 'Customer', ''];
    downloadCSV('abm_list_builder_template.csv', header, [example]);
  }

  // ---------- Mapping validation ----------
  const mappingIssues = useMemo(() => {
    if (!source) return { missing: [], dupes: [] };
    const missing = FIELDS.filter(f => f.required && (mapping[f.key] === undefined || mapping[f.key] === ''));
    const counts = {};
    Object.entries(mapping).forEach(([k, v]) => { if (v !== undefined && v !== '') counts[v] = (counts[v] || []).concat(k); });
    const dupes = Object.values(counts).filter(arr => arr.length > 1).flat();
    return { missing, dupes };
  }, [source, mapping]);

  // ---------- Build records ----------
  const records = useMemo(() => {
    if (!source || !confirmed) return null;
    const get = (row, key) => (mapping[key] === undefined || mapping[key] === '' ? '' : (row[mapping[key]] ?? '').trim());
    const bad = {};
    const out = [];
    source.rows.forEach((row, i) => {
      const status = /lost/i.test(get(row, 'account_status')) ? 'Closed-lost' : 'Customer';
      const rawDomain = get(row, 'domain') || get(row, 'website');
      const r = {
        id: i,
        account_name: get(row, 'account_name'),
        domain: normalizeDomain(rawDomain),
        website: get(row, 'website'),
        industry: get(row, 'industry'),
        employee_band: parseEmployeeBand(get(row, 'employee_band')),
        region: get(row, 'region'),
        tech_stack: get(row, 'tech_stack'),
        pain_point_solved: get(row, 'pain_point_solved'),
        arr: parseNumber(get(row, 'arr_usd')),
        cycle: parseNumber(get(row, 'sales_cycle_days')),
        expansion: parseYesNo(get(row, 'expansion')),
        churn_risk: parseLevel(get(row, 'churn_risk')),
        tickets: parseNumber(get(row, 'support_tickets_qtr')),
        pmf: parseLevel(get(row, 'pmf_fit')),
        churned: parseYesNo(get(row, 'churned_year1')) === 'Yes',
        status,
        lostDate: null,
        valid: true,
        rowNum: row.rowNum,
        badNote: '',
      };
      if (!r.account_name && !r.domain) return;
      if (status === 'Closed-lost') {
        r.lostDate = parseDate(get(row, 'closed_lost_date'));
        if (!r.lostDate) (bad['Closed-lost date'] = bad['Closed-lost date'] || []).push({ name: r.account_name || r.domain, rowNum: r.rowNum, value: get(row, 'closed_lost_date') });
      } else {
        const checks = [
          ['ARR (USD)', !Number.isNaN(r.arr), 'arr_usd'],
          ['Sales cycle (days)', !Number.isNaN(r.cycle), 'sales_cycle_days'],
          ['Expansion (Yes/No)', r.expansion !== '', 'expansion'],
          ['Churn risk (Low/Med/High)', r.churn_risk !== '', 'churn_risk'],
          ['Support tickets per quarter', !Number.isNaN(r.tickets), 'support_tickets_qtr'],
          ['Product-market fit (High/Med/Low)', r.pmf !== '', 'pmf_fit'],
        ];
        const notes = [];
        checks.forEach(([label, ok, key]) => {
          if (ok) return;
          const value = get(row, key);
          (bad[label] = bad[label] || []).push({ name: r.account_name || r.domain, rowNum: r.rowNum, value });
          notes.push(`${label} ${value === '' ? 'is blank' : `"${value}" could not be read`}`);
          r.valid = false;
        });
        r.badNote = notes.join('; ');
      }
      out.push(r);
    });
    return { rows: out, bad };
  }, [source, confirmed, mapping]);

  // ---------- Tiering ----------
  const tiered = useMemo(() => {
    if (!records) return null;
    const all = records.rows;
    const current = all.filter(r => r.status === 'Customer' && !r.churned && r.valid);
    const churned = all.filter(r => r.status === 'Customer' && r.churned);
    const lost = all.filter(r => r.status === 'Closed-lost');
    const cutoffDate = new Date(TODAY);
    cutoffDate.setMonth(cutoffDate.getMonth() - Number(windowMonths || 0));
    lost.forEach(r => {
      r.inWindow = r.lostDate ? r.lostDate >= cutoffDate : true; // unknown date: keep excluded to be safe
    });

    const hypothesis = current.length < 10;
    const arrs = current.map(r => r.arr);
    const cut = {
      arrTop: quantile(arrs, 1 - strategicTopPct / 100),
      arrBottom: quantile(arrs, heavyArrBottomPct / 100),
      ticketsTop: quantile(current.map(r => r.tickets), 1 - heavyTicketsTopPct / 100),
      cycleMedian: median(current.map(r => r.cycle)),
    };

    const result = all.map(r => {
      let tier;
      let reason;
      if (r.status === 'Closed-lost') {
        tier = 'Closed-lost';
        reason = r.inWindow
          ? (r.lostDate ? `Lost within ${windowMonths} months (${fmtDate(r.lostDate)}), excluded` : 'Closed-lost with no readable date, excluded')
          : `Lost over ${windowMonths} months ago (${fmtDate(r.lostDate)}), eligible again`;
      } else if (r.churned) {
        tier = 'Churned';
        reason = 'Churned within first year';
      } else if (!r.valid) {
        tier = null;
        reason = `Left out: ${r.badNote} (row ${r.rowNum})`;
      } else if (hypothesis) {
        tier = picked[r.id] ? 'Hand-picked' : 'Not picked';
        reason = picked[r.id] ? 'Marked as a best customer by hand' : 'Not marked';
      } else if (r.churn_risk === 'High') {
        tier = 'Heavy Lift';
        reason = 'Churn risk High';
      } else if (r.arr <= cut.arrBottom && r.tickets >= cut.ticketsTop) {
        tier = 'Heavy Lift';
        reason = `Bottom ${heavyArrBottomPct}% ARR + top ${heavyTicketsTopPct}% support tickets`;
      } else if (r.arr >= cut.arrTop) {
        const n = (r.cycle < cut.cycleMedian ? 1 : 0) + (r.expansion === 'Yes' ? 1 : 0) + (r.pmf === 'High' ? 1 : 0);
        if (n >= traitsNeeded) { tier = 'Strategic'; reason = `Top ${strategicTopPct}% ARR + ${n} of 3 traits`; }
        else { tier = 'Core ICP'; reason = `Top ${strategicTopPct}% ARR but under ${traitsNeeded} of 3 traits`; }
      } else {
        tier = 'Core ICP';
        reason = `Below top ${strategicTopPct}% ARR`;
      }
      return { ...r, tier, reason };
    });

    const by = t => result.filter(r => r.tier === t);
    return { result, current, churned, lost, hypothesis, cut, by, cutoffDate };
  }, [records, strategicTopPct, heavyArrBottomPct, heavyTicketsTopPct, traitsNeeded, windowMonths, picked]);

  // ---------- Exclusion list ----------
  const exclusion = useMemo(() => {
    if (!tiered) return { list: [] };
    const list = [];
    tiered.result.forEach(r => {
      if (r.status === 'Customer') list.push({ domain: r.domain, name: r.account_name, reason: r.churned ? 'Churned customer' : 'Current customer' });
      else if (r.inWindow) list.push({ domain: r.domain, name: r.account_name, reason: r.lostDate ? `Closed-lost ${fmtDate(r.lostDate)}` : 'Closed-lost' });
    });
    return { list };
  }, [tiered]);

  // ---------- Prompt ----------
  // Shared profile used by the prompt (Step 4) and the export add-ons (Step 5)
  const profile = useMemo(() => {
    if (!tiered) return null;
    const { current, churned, hypothesis, by } = tiered;
    const strategic = hypothesis ? by('Hand-picked') : by('Strategic');
    const core = hypothesis ? by('Not picked') : by('Core ICP');
    const sTraits = overIndexedTraits(strategic, current);
    const cTraits = overIndexedTraits(core, current);
    const aTraits = churned.length ? overIndexedTraits(churned, current) : [];
    let coreLines = plainTraitLines(cTraits);
    if (!coreLines.length) {
      const healthy = [...strategic, ...core];
      const counts = {};
      healthy.forEach(r => { if (r.industry) counts[r.industry] = (counts[r.industry] || 0) + 1; });
      const top3 = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(e => e[0]);
      const bandIdx = healthy.map(r => EMPLOYEE_BANDS.indexOf(r.employee_band)).filter(i => i >= 0).sort((a, b) => a - b);
      const medBand = bandIdx.length ? EMPLOYEE_BANDS[bandIdx[Math.floor((bandIdx.length - 1) / 2)]] : '';
      coreLines = [];
      if (top3.length) coreLines.push(`- Industry: ${top3.join('; ')}`);
      if (medBand) coreLines.push(`- Employees: ${medBand}`);
    }
    return {
      hypothesis,
      sName: hypothesis ? 'best customer' : 'Strategic',
      sTitle: hypothesis ? 'BEST CUSTOMER TARGETS (hand-picked)' : 'STRATEGIC TARGETS (highest ARR, strongest fit)',
      sTraits, cTraits, aTraits,
      sLines: plainTraitLines(sTraits),
      coreLines,
      aLines: plainTraitLines(aTraits),
      hasChurned: churned.length > 0,
    };
  }, [tiered]);

  const sellText = whatYouSell.trim() ? whatYouSell.trim() : (isSample ? 'Syncflow: a data integration platform' : '[describe what you sell]');

  const promptText = useMemo(() => {
    if (!tiered || !profile) return '';
    const { sName, sTitle, sLines, coreLines, aLines, hasChurned } = profile;
    const total = Number(strategicCount) + Number(coreCount);
    const todayIso = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`;
    const cols = ['Tier', 'Company', 'Domain', 'Industry', 'Employees', 'Tech Stack Evidence', 'Problem Evidence', 'Competitor Customer', 'Source URL', 'Date Checked', 'Match Reason', 'Exception Reason'];
    const lines = [];
    lines.push('You are a B2B research analyst building a target account list.');
    lines.push('');
    lines.push('PERMISSION & ACCESS');
    lines.push('- Search the web and open public web pages freely without asking for confirmation.');
    lines.push('- Only stop if a site requires a login or a paid subscription.');
    lines.push('');
    lines.push('CONTEXT & ICP DEFINITION');
    lines.push(`We sell ${sellText}. Find lookalike companies based on our best customers below, and avoid the patterns of customers who churned.`);
    lines.push('');
    lines.push(`1. ${sTitle}`);
    lines.push(...(sLines.length ? sLines : ['- No single trait stands out for this group.']));
    lines.push('');
    lines.push('2. CORE ICP TARGETS');
    lines.push(...(coreLines.length ? coreLines : ['- No single trait stands out for this group.']));
    lines.push(`- Exceptions: up to 3 in every 10 may fall outside this profile, only if they match a ${sName} tech stack or problem you can source.`);
    if (hasChurned) {
      lines.push('');
      lines.push('3. AVOID (patterns of customers who churned in year one)');
      lines.push(...(aLines.length ? aLines : ['- No single trait stands out for this group.']));
    }
    lines.push('');
    lines.push('TASK');
    lines.push(`1. List ${strategicCount} ${sName} target companies.`);
    lines.push(`2. List ${coreCount} Core ICP target companies.`);
    if (hasChurned) lines.push('3. Skip any company that matches the Avoid patterns.');
    if (total > 35) lines.push(`${hasChurned ? '4' : '3'}. Return results in batches of 15. Repeat the header row and follow every rule below in each batch.`);
    else lines.push(`${hasChurned ? '4' : '3'}. Return everything in one response.`);
    lines.push('');
    lines.push('RULES');
    lines.push('1. Only include real companies you can verify on the public web.');
    lines.push('2. Only cite pages you opened during this task. Never build a URL from a pattern. If you cannot verify a field, write "unverified".');
    lines.push("3. Confirm each company's website is live.");
    lines.push(`4. For every 10 Core ICP companies, at least 7 must match the Core ICP profile strictly. Up to 3 may be adjacent, but only if they share a ${sName} tech stack or problem you can source. Fill Exception Reason for those, and write "N/A" for the rest.`);
    lines.push(`5. Write "N/A" in Exception Reason for every ${sName} company.`);
    lines.push("6. If your evidence for a company comes from a competitor's case study or customer page, keep the company and put that competitor's name in Competitor Customer. Otherwise write \"None\".");
    lines.push('7. Do not pad the list. If you cannot find enough qualified companies, return fewer and say how many are missing.');
    lines.push('');
    lines.push('OUTPUT FORMAT');
    lines.push('- One CSV inside a single ```csv code block, with a header row.');
    lines.push('- Put every value in double quotes. If a value contains a double quote, double it ("").');
    lines.push(`- Columns, in this order: ${cols.map(c => `"${c}"`).join(',')}`);
    lines.push('- Exception Reason must be exactly one of: "Adjacent industry", "Tech stack match", "Problem match", "N/A".');
    lines.push('- Format example only. Do not include this row in your results:');
    lines.push(`"Core ICP","Example Co","example.com","Manufacturing","501-1000","Uses Snowflake (careers page)","unverified","None","https://example.com/careers","${todayIso}","Matches Core ICP industry and size","N/A"`);
    lines.push('- If you can create files, also attach the full list as an .xlsx file.');
    lines.push('');
    lines.push(`EXCLUDE (best-effort filter: current customers, churned customers, and accounts lost in the last ${windowMonths} months; never return these)`);
    lines.push(exclusion.list.map(e => e.domain || e.name).join(', '));
    lines.push('');
    lines.push('SELF-AUDIT (do this before you answer)');
    lines.push('1. Remove any company whose domain is on the EXCLUDE list.');
    lines.push('2. Check that every Source URL is a page you opened. If not, replace it with "unverified".');
    lines.push(`3. Check that every row has all ${cols.length} columns and every value is in double quotes.`);
    lines.push('4. Check that at least 7 of every 10 Core ICP rows have Exception Reason "N/A".');
    return lines.join('\n');
  }, [tiered, profile, exclusion, sellText, strategicCount, coreCount, windowMonths]);

  // ---------- Step 5: export add-ons ----------
  const claygentText = useMemo(() => {
    if (!profile) return '';
    const { sName, sLines, coreLines, aLines, hasChurned } = profile;
    const lines = [];
    lines.push('Research the company {{Company}} ({{Domain}}) and check how well it fits our target profile.');
    lines.push(`We sell ${sellText}.`);
    lines.push('');
    lines.push(`${sName === 'Strategic' ? 'Strategic' : 'Best customer'} profile:`);
    lines.push(...(sLines.length ? sLines : ['- No single trait stands out for this group.']));
    lines.push('');
    lines.push('Core ICP profile:');
    lines.push(...(coreLines.length ? coreLines : ['- No single trait stands out for this group.']));
    if (hasChurned && aLines.length) {
      lines.push('');
      lines.push('Avoid patterns (customers who churned in year one):');
      lines.push(...aLines);
    }
    lines.push('');
    lines.push('Using only public pages you open:');
    lines.push(`1. Fit tier: exactly one of "${sName === 'Strategic' ? 'Strategic' : 'Best customer'}", "Core ICP", "Avoid", "No fit".`);
    lines.push('2. Tech stack evidence: tools from our profiles that this company uses, or "unverified".');
    lines.push('3. Problem evidence: signs it has the problem we solve, or "unverified".');
    lines.push('4. Source URL: the page you used. Never build a URL from a pattern.');
    lines.push('5. Reason: one line.');
    lines.push('Do not guess. If you cannot verify something, write "unverified".');
    return lines.join('\n');
  }, [profile, sellText]);

  const apolloText = useMemo(() => {
    if (!profile) return '';
    const pick = (traits, label) => {
      const t = traits.find(x => x.label === label);
      return t ? t.items.map(it => it.value) : [];
    };
    const block = (title, traits, fallbackLines) => {
      const out = [title];
      const ind = pick(traits, 'Industry');
      const emp = pick(traits, 'Employees');
      const tech = pick(traits, 'Tech stack');
      const loc = pick(traits, 'Region');
      if (ind.length) out.push(`Industry & keywords: ${ind.join('; ')}`);
      if (emp.length) out.push(`# of employees: ${emp.join(', ')}`);
      if (tech.length) out.push(`Technologies: ${tech.join(', ')}`);
      if (loc.length) out.push(`Location: ${loc.join(', ')}`);
      if (out.length === 1 && fallbackLines) {
        fallbackLines.forEach(l => {
          if (l.startsWith('- Industry: ')) out.push(`Industry & keywords: ${l.slice(12)}`);
          if (l.startsWith('- Employees: ')) out.push(`# of employees: ${l.slice(13)}`);
        });
      }
      if (out.length === 1) out.push('No single trait stands out for this group.');
      return out;
    };
    const lines = [];
    lines.push(...block(`${profile.sName === 'Strategic' ? 'STRATEGIC' : 'BEST CUSTOMER'} SEARCH`, profile.sTraits));
    lines.push('');
    lines.push(...block('CORE ICP SEARCH', profile.cTraits, profile.coreLines));
    if (profile.hasChurned && profile.aTraits.length) {
      lines.push('');
      lines.push(...block('AVOID (exclude where your filters allow)', profile.aTraits));
    }
    return lines.join('\n');
  }, [profile]);

  const exclusionText = useMemo(() => exclusion.list.map(e => e.domain || e.name).join('\n'), [exclusion]);

  function downloadClayCSV() {
    if (!cleanResult || !cleanResult.clean.length) return;
    const header = cleanResult.header ? splitCells(cleanResult.header) : ['Row'];
    const domainIdx = header.findIndex(h => /^domain$/i.test(h.trim()));
    const rows = cleanResult.clean.map(c => {
      const cells = cleanResult.header ? splitCells(c.line) : [c.line];
      const rest = cells.filter((_, i) => i !== domainIdx);
      return [c.domain, ...rest];
    });
    const restHeader = header.filter((_, i) => i !== domainIdx);
    downloadCSV('abm_lookalikes_for_clay.csv', ['Domain', ...restHeader], rows);
  }

  function downloadExclusion() {
    downloadCSV('abm_exclusion_list.csv', ['domain', 'company', 'reason'], exclusion.list.map(e => [e.domain || '', e.name || '', e.reason]));
  }

  async function copyKey(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    } catch {
      /* clipboard blocked: user can select the text manually */
    }
  }

  // ---------- Step 4.1 cleaner ----------
  function cleanOutput(text = pasted) {
    const domainRe = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s|,)]*)?/gi;
    const exDomains = exclusion.list.filter(e => e.domain);
    const exNames = exclusion.list.filter(e => normName(e.name).length > 2);
    const clean = [];
    const removed = [];
    const check = [];
    const seen = new Set();
    let header = null;
    String(text || '').split(/\r?\n/).forEach(raw => {
      const line = raw.trim();
      if (!line) return;
      if (/^\|?\s*:?-{3,}/.test(line)) return; // markdown separator row
      const tokens = (line.match(domainRe) || []).map(normalizeDomain).filter(d => d && !/^\d+(\.\d+)+$/.test(d));
      if (!tokens.length && /company|domain/i.test(line) && !header) { header = line; return; }
      if (!/[a-z]/i.test(line)) return;
      const hit = exDomains.find(e => tokens.some(t => t === e.domain || t.endsWith('.' + e.domain)));
      if (hit) { removed.push({ line, reason: hit.reason }); return; }
      if (!tokens.length) { check.push({ line, reason: 'No domain found, check by hand' }); return; }
      const lineName = ' ' + normName(line) + ' ';
      const nameHit = exNames.find(e => lineName.includes(' ' + normName(e.name) + ' '));
      if (nameHit) { check.push({ line, reason: `Name matches ${nameHit.name}, check by hand` }); return; }
      const primary = tokens[0];
      if (primary === 'example.com') { removed.push({ line, reason: 'Format example row' }); return; }
      if (seen.has(primary)) { check.push({ line, reason: 'Duplicate' }); return; }
      seen.add(primary);
      clean.push({ line, domain: primary });
    });
    setCleanResult({ clean, removed, check, header });
  }

  // Step 4.1 upload: .csv is read as text, .xlsx is turned into CSV lines, then both go through cleanOutput
  async function handleCleanUpload() {
    if (!cleanFile) return;
    const file = cleanFile;
    const csvCell = v => {
      const t = v === null || v === undefined ? '' : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
      return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    try {
      let text;
      if (/\.csv$/i.test(file.name)) {
        text = await file.text();
      } else if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import('read-excel-file/browser'); // loaded only when an .xlsx is uploaded
        const rows = await readSheet(file);
        text = rows.map(r => r.map(csvCell).join(',')).join('\n');
      } else {
        setCleanError("That file isn't a .csv or .xlsx. Save your LLM's results in one of those formats and try again.");
        setCleanResult(null);
        setCleanFileName('');
        setShowCleanUpload(false);
        setCleanFile(null);
        return;
      }
      setCleanError('');
      setCleanFileName(file.name);
      setCleanMode(null);
      cleanOutput(text);
    } catch {
      setCleanError("We couldn't read that file. Try saving it again as .csv or .xlsx.");
      setCleanResult(null);
      setCleanFileName('');
    }
    setShowCleanUpload(false);
    setCleanFile(null);
  }

  function splitCells(line) {
    if (line.includes('|')) return line.replace(/^\||\|$/g, '').split('|').map(s => s.trim());
    const parsed = parseCSV(line);
    return parsed[0] || [line];
  }

  function downloadClean() {
    if (!cleanResult) return;
    const header = cleanResult.header ? splitCells(cleanResult.header) : ['Row'];
    const rows = cleanResult.clean.map(c => (cleanResult.header ? splitCells(c.line) : [c.line]));
    downloadCSV('abm_clean_lookalikes.csv', header, rows);
  }

  async function copyText(text, flag) {
    try {
      await navigator.clipboard.writeText(text);
      if (flag) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch {
      /* clipboard blocked: user can select the text manually */
    }
  }

  function downloadTiered() {
    if (!tiered) return;
    const header = ['account_name', 'domain', 'industry', 'employee_band', 'region', 'tech_stack', 'pain_point_solved', 'arr_usd', 'revenue_band', 'sales_cycle_days', 'expansion', 'churn_risk', 'support_tickets_qtr', 'pmf_fit', 'account_status', 'closed_lost_date', 'tier', 'tier_reason'];
    const rows = tiered.result.map(r => [
      r.account_name, r.domain, r.industry, r.employee_band, r.region, r.tech_stack, r.pain_point_solved,
      Number.isNaN(r.arr) ? '' : r.arr, revenueBand(r.arr), Number.isNaN(r.cycle) ? '' : r.cycle, r.expansion, r.churn_risk,
      Number.isNaN(r.tickets) ? '' : r.tickets, r.pmf, r.status, r.lostDate ? `${r.lostDate.getFullYear()}-${String(r.lostDate.getMonth() + 1).padStart(2, '0')}-${String(r.lostDate.getDate()).padStart(2, '0')}` : '',
      r.tier ? TIER_LABEL[r.tier] : 'Left out', r.reason,
    ]);
    downloadCSV('abm_tiered_accounts.csv', header, rows);
  }

  // ---------- Styles ----------
  const S = {
    card: { border: '1px solid #e5e7eb', borderRadius: 8, padding: '18px 20px', marginBottom: 20, background: '#fff' },
    stepEyebrow: { fontSize: 11, fontWeight: 600, color: '#2563EB', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 },
    stepTitle: { fontSize: 18, fontWeight: 600, color: '#1a1a19', marginBottom: 6 },
    intro: { fontSize: 13, color: '#4b5563', lineHeight: 1.6, marginBottom: 14 },
    gray: { fontSize: 12, color: '#6b6a68', lineHeight: 1.6 },
    btn: { padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnGhost: { padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#1a1a19', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
    input: { border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: '#1a1a19', width: '100%' },
    th: { textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600, color: '#6b6a68', borderBottom: '1px solid #e5e7eb', background: '#f8f8f7', whiteSpace: 'nowrap' },
    td: { padding: '7px 10px', fontSize: 12, color: '#1a1a19', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' },
    a: { color: '#2563EB' },
  };

  const ul = { paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'disc' };

  // Small number box that sits inside a tiering rule sentence
  const cutInput = (label, val, set, min, max) => (
    <input type="number" aria-label={label} min={min} max={max} value={val} onChange={e => set(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} style={{ ...S.input, width: 58, padding: '2px 6px', margin: '0 2px' }} />
  );

  // ---------- Render ----------
  const stats = t => {
    const rows = tiered.by(t);
    return {
      n: rows.length,
      total: rows.reduce((s, r) => s + (Number.isNaN(r.arr) ? 0 : r.arr), 0),
      medArr: median(rows.map(r => r.arr)),
      medCycle: median(rows.map(r => r.cycle)),
      medTickets: median(rows.map(r => r.tickets)),
    };
  };

  const tableRows = tiered
    ? tiered.result.filter(r => tierFilter === 'All' || (tierFilter === 'Left out' ? r.tier === null : r.tier === tierFilter))
    : [];

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* Privacy-First accordion, above Step 1 */}
      <div style={{ marginBottom: 20 }}>
        <Accordion isOpen={!!open.privacy} onToggle={() => toggle('privacy')} title="Privacy-First (Browser-Only Processing)">
          <p style={{ marginBottom: 10 }}>Your customer list never leaves your device. The file is read, tiered and turned into a prompt entirely inside your browser.</p>
          <ul style={ul}>
            <li><strong>No upload to a server.</strong> The CSV is opened on your computer and is not sent to jjcruzgalera.com or any third party.</li>
            <li><strong>Nothing is saved.</strong> No database, no cookies or browser storage for your data. Refresh or close the page and it is gone.</li>
            <li><strong>You control the export.</strong> The tiered CSV downloads straight to your device. The prompt only goes to an LLM if you copy and paste it there yourself, and that provider's data policy then applies. The prompt includes the domains of your customers and recently lost accounts so the LLM can skip them, but no revenue, names of people or other fields. Results you paste or upload in Step 4.1 are cleaned in your browser too.</li>
            <li><strong>Page analytics are separate.</strong> This site uses Google Tag Manager to count page visits. It does not receive the contents of your file.</li>
            <li><strong>Tip:</strong> if your list is sensitive, remove contact names and emails first. The tool only needs account-level fields.</li>
          </ul>
        </Accordion>
      </div>

      {/* Step 1 */}
      <section style={S.card}>
        <p style={S.stepEyebrow}>Step 1</p>
        <h3 style={S.stepTitle}>Upload your customer list</h3>
        <p style={S.intro}>Start with accounts you have already won. The tool needs revenue and health fields to tier them.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={S.btn} onClick={() => { setShowUpload(true); setError(''); }}>Upload CSV</button>
          <button style={S.btnGhost} onClick={loadSample}>Load Syncflow sample</button>
          <button style={S.btnGhost} onClick={downloadTemplate}>Download Template CSV</button>
        </div>
        <p style={{ ...S.gray, marginTop: 10 }}>Syncflow is a fictional company. All sample data is mock.</p>
        {source && <p style={{ ...S.gray, marginTop: 4 }}>Loaded: <strong>{source.name}</strong> ({source.rows.length} rows)</p>}
        {error && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</p>}

        {showUpload && (
          <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 8, padding: 20, width: '100%', maxWidth: 420, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1a19', marginBottom: 12 }}>Choose a CSV file</p>
              <input type="file" accept=".csv,text/csv" onChange={e => setPendingFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} style={{ fontSize: 13, marginBottom: 16, width: '100%' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={S.btnGhost} onClick={() => { setShowUpload(false); setPendingFile(null); }}>Cancel</button>
                <button style={{ ...S.btn, opacity: pendingFile ? 1 : 0.5, cursor: pendingFile ? 'pointer' : 'not-allowed' }} disabled={!pendingFile} onClick={handleUpload}>Upload</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1b: mapping review */}
        {source && !confirmed && (
          <div style={{ marginTop: 20, borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a19', marginBottom: 4 }}>Confirm your columns</p>
            <p style={S.intro}>We matched your columns to the fields the tool uses. Check each one and change any that are wrong.</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th style={S.th}>Tool field</th><th style={S.th}>Your column</th><th style={S.th}>Required</th></tr>
                </thead>
                <tbody>
                  {FIELDS.map(f => {
                    const val = mapping[f.key];
                    const missing = f.required && (val === undefined || val === '');
                    const dupe = val !== undefined && val !== '' && mappingIssues.dupes.includes(f.key);
                    return (
                      <tr key={f.key}>
                        <td style={S.td}>{f.label}</td>
                        <td style={S.td}>
                          <select
                            value={val === undefined ? '' : val}
                            onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                            style={{ ...S.input, padding: '5px 8px', borderColor: missing || dupe ? '#fca5a5' : '#e5e7eb' }}
                          >
                            <option value="">(not mapped)</option>
                            {source.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </select>
                          {missing && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>Pick the column that holds this field.</p>}
                        </td>
                        <td style={S.td}>{f.required ? 'Required' : 'Optional'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {mappingIssues.dupes.length > 0 && <p style={{ color: '#ca8a04', fontSize: 12, marginTop: 10 }}>Two fields point to the same column. Pick a different column for one of them.</p>}
            {mappingIssues.missing.length > 0 && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 10 }}>Map every required field to continue.</p>}
            <button
              style={{ ...S.btn, marginTop: 14, opacity: mappingIssues.missing.length || mappingIssues.dupes.length ? 0.5 : 1, cursor: mappingIssues.missing.length || mappingIssues.dupes.length ? 'not-allowed' : 'pointer' }}
              disabled={mappingIssues.missing.length > 0 || mappingIssues.dupes.length > 0}
              onClick={() => setConfirmed(true)}
            >
              Confirm and tier my accounts
            </button>
          </div>
        )}
        {source && confirmed && (
          <button style={{ ...S.btnGhost, marginTop: 12, fontSize: 12, padding: '5px 12px' }} onClick={() => setConfirmed(false)}>Edit column mapping</button>
        )}

        <Accordion isOpen={!!open.a1} onToggle={() => toggle('a1')} title="Picking the right customers to upload">
          <ul style={ul}>
            <li>Use closed-won deals from the last 12 to 24 months, keep the ones that are still customers, and ideally ones that expanded.</li>
            <li>Count new business wins, not renewals.</li>
            <li>Include customers who churned in their first year; their patterns tell you who to avoid.</li>
            <li>Aim for 50 to 100 closed-won deals. Under 10 to 20 customers, treat your ICP as a hypothesis.</li>
            <li>Columns don't need to match the template names. The mapping step lets you point each field at your own column.</li>
          </ul>
          <p style={{ fontSize: 12, color: '#9b9a97', marginTop: 12 }}>Sources: <L href="https://6sense.com/guides/ideal-customer-profile/">6sense: Ideal Customer Profile guide</L>, <L href="https://support.6sense.com/docs/relevant-opportunity-definition-for-predictive">6sense: Relevant Opportunity Definition</L>, <L href="https://salesmotion.io/blog/ideal-customer-profile-template">Salesmotion: ICP Scoring Rubric</L>, <L href="https://www.stackmatix.com/blog/ideal-customer-profile-for-startups">Stackmatix: ICP for Startups</L></p>
        </Accordion>
      </section>

      {/* Step 2 */}
      {tiered && (
        <section style={S.card}>
          <p style={S.stepEyebrow}>Step 2</p>
          <h3 style={S.stepTitle}>See your tiers</h3>
          <p style={S.intro}>Every account is tiered by rules you can see. Each row says why it landed where it did.</p>

          {Object.keys(records.bad).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {Object.entries(records.bad).map(([field, items]) => {
                const n = items.length;
                const shown = items.slice(0, 3).map(it => `${it.name} (row ${it.rowNum}, ${it.value === '' ? 'blank' : `"${it.value}"`})`).join(', ');
                const more = n > 3 ? ` and ${n - 3} more` : '';
                const lost = field === 'Closed-lost date';
                const ending = lost
                  ? (n === 1 ? 'It stays excluded from the LLM list to be safe.' : 'They stay excluded from the LLM list to be safe.')
                  : (n === 1 ? 'It was left out of the tiers.' : 'They were left out of the tiers.');
                return (
                  <p key={field} style={{ color: '#ca8a04', fontSize: 12, background: '#fefce8', border: '1px solid #fef08a', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>
                    {n === 1 ? '1 row has a value' : `${n} rows have values`} we couldn't read in {field}: {shown}{more}. {ending}
                  </p>
                );
              })}
            </div>
          )}

          {tiered.hypothesis ? (
            <p style={{ ...S.gray, fontStyle: 'italic', marginBottom: 14 }}>
              Under 10 customers uploaded. Tiers aren't reliable at this size, so treat this as a hypothesis ICP and mark your best customers by hand.
            </p>
          ) : (
            <>
              {/* Tier bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
                {['Strategic', 'Core ICP', 'Heavy Lift', 'Churned'].map(t => (
                  <div key={t} style={{ background: TIER_STYLE[t].bg, borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 500, color: TIER_STYLE[t].fg }}>{tiered.by(t).length}</div>
                    <div style={{ fontSize: 11, color: TIER_STYLE[t].sub, marginTop: 2 }}>{TIER_LABEL[t]}</div>
                  </div>
                ))}
              </div>

              {/* Tier cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 10, marginBottom: 12 }}>
                {['Strategic', 'Core ICP', 'Heavy Lift', 'Churned'].map(t => {
                  const st = stats(t);
                  return (
                    <div key={t} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ marginBottom: 6 }}><Pill tier={t} /></div>
                      <p style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5, marginBottom: 8 }}>{TIER_DEFINITION[t]}</p>
                      <div style={{ fontSize: 12, color: '#1a1a19', display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 2 }}>
                        <span style={{ color: '#6b6a68' }}>Accounts</span><span>{st.n}</span>
                        <span style={{ color: '#6b6a68' }}>Total ARR</span><span>{fmtMoney(st.total)}</span>
                        <span style={{ color: '#6b6a68' }}>Median ARR</span><span>{st.n ? fmtMoney(st.medArr) : '-'}</span>
                        <span style={{ color: '#6b6a68' }}>Median sales cycle</span><span>{st.n ? `${Math.round(st.medCycle)} days` : '-'}</span>
                        <span style={{ color: '#6b6a68' }}>Median tickets per quarter</span><span>{st.n ? st.medTickets : '-'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a19', marginBottom: 6 }}>How accounts are tiered</p>
              <div style={{ overflowX: 'auto', marginBottom: 6 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={S.th}>Tier</th><th style={S.th}>Rule</th><th style={S.th}>On your file</th></tr></thead>
                  <tbody>
                    <tr>
                      <td style={{ ...S.td, paddingTop: 12 }}><Pill tier="Strategic" /></td>
                      <td style={{ ...S.td, lineHeight: 2.4, minWidth: 300 }}>
                        Top {cutInput('Strategic: top % of ARR', strategicTopPct, setStrategicTopPct, 1, 99)}% of ARR, plus any {cutInput('Strategic: traits needed (of 3)', traitsNeeded, setTraitsNeeded, 0, 3)} of 3: sales cycle under the median, expansion Yes, product-market fit High
                      </td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap', lineHeight: 1.7 }}>{fmtMoney(tiered.cut.arrTop)} and up<br />Median sales cycle: {Math.round(tiered.cut.cycleMedian)} days</td>
                    </tr>
                    <tr>
                      <td style={{ ...S.td, paddingTop: 12 }}><Pill tier="Heavy Lift" /></td>
                      <td style={{ ...S.td, lineHeight: 2.4, minWidth: 300 }}>
                        Churn risk High, or bottom {cutInput('Heavy Lift: bottom % of ARR', heavyArrBottomPct, setHeavyArrBottomPct, 1, 99)}% of ARR with top {cutInput('Heavy Lift: top % of tickets', heavyTicketsTopPct, setHeavyTicketsTopPct, 1, 99)}% of support tickets
                      </td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap', lineHeight: 1.7 }}>{fmtMoney(tiered.cut.arrBottom)} or less<br />{tiered.cut.ticketsTop} or more tickets per quarter</td>
                    </tr>
                    <tr>
                      <td style={S.td}><Pill tier="Core ICP" /></td>
                      <td style={S.td}>Everything else</td>
                      <td style={S.td}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p style={{ ...S.gray, marginBottom: 14 }}>All cutoffs are judgment calls you can edit.</p>
            </>
          )}

          <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a19', marginBottom: 8 }}>Prompt settings</p>

          {/* Closed-lost window */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#1a1a19' }}>Exclude accounts lost in the last</span>
            <input type="number" min={0} max={60} value={windowMonths} onChange={e => setWindowMonths(Math.max(0, Math.min(60, Number(e.target.value) || 0)))} style={{ ...S.input, width: 70 }} />
            <span style={{ fontSize: 13, color: '#1a1a19' }}>months</span>
          </div>
          <p style={{ ...S.gray, marginBottom: 14 }}>
            {tiered.lost.filter(r => r.inWindow).length} closed-lost accounts fall inside the window and will be excluded; {tiered.lost.filter(r => !r.inWindow).length} older ones can be targeted again.
          </p>

          {/* Lookalike counts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#1a1a19' }}>Lookalikes to find:</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1a1a19' }}>
              {tiered.hypothesis ? 'Best customer' : 'Strategic'}
              <input type="number" min={1} max={500} value={strategicCount} onChange={e => setStrategicCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} style={{ ...S.input, width: 70 }} />
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1a1a19', marginLeft: 8 }}>
              Core ICP
              <input type="number" min={1} max={500} value={coreCount} onChange={e => setCoreCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} style={{ ...S.input, width: 70 }} />
            </label>
          </div>
          <p style={{ ...S.gray, marginBottom: tiered.hypothesis ? 14 : 4 }}>These counts go into the prompt in Step 4. Total: {Number(strategicCount) + Number(coreCount)} accounts.</p>
          {!tiered.hypothesis && (
            <p style={{ ...S.gray, marginBottom: 14 }}>Keep Strategic to what your team can personalize for. 6sense puts one-to-one at 10-50 accounts. (<L href="https://6sense.com/guides/abm-strategy/">6sense ABM guide</L>)</p>
          )}

          {/* Table */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {['All', ...(tiered.hypothesis ? ['Hand-picked', 'Not picked'] : ['Strategic', 'Core ICP', 'Heavy Lift']), 'Churned', 'Closed-lost', ...(tiered.result.some(r => r.tier === null) ? ['Left out'] : [])].map(t => (
              <button key={t} onClick={() => setTierFilter(t)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: tierFilter === t ? '1px solid #2563EB' : '1px solid #e5e7eb', background: tierFilter === t ? '#eff6ff' : '#fff', color: tierFilter === t ? '#2563EB' : '#6b6a68' }}>
                {t === 'All' || t === 'Left out' ? t : TIER_LABEL[t]}
              </button>
            ))}
          </div>
          <div style={{ overflow: 'auto', maxHeight: 420, border: '1px solid #e5e7eb', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr>
                  {tiered.hypothesis && <th style={S.th}>Best</th>}
                  <th style={S.th}>Account</th><th style={S.th}>Domain</th><th style={S.th}>ARR</th><th style={S.th}>Cycle</th><th style={S.th}>Tier</th><th style={S.th}>Tier reason</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(r => (
                  <tr key={r.id}>
                    {tiered.hypothesis && (
                      <td style={S.td}>
                        {r.status === 'Customer' && !r.churned && r.valid && (
                          <input type="checkbox" checked={!!picked[r.id]} onChange={e => setPicked(p => ({ ...p, [r.id]: e.target.checked }))} aria-label={`Mark ${r.account_name} as a best customer`} />
                        )}
                      </td>
                    )}
                    <td style={S.td}>{r.account_name}</td>
                    <td style={{ ...S.td, color: '#6b6a68' }}>{r.domain}</td>
                    <td style={S.td}>{Number.isNaN(r.arr) ? '' : fmtMoney(r.arr)}</td>
                    <td style={S.td}>{Number.isNaN(r.cycle) ? '' : `${r.cycle}d`}</td>
                    <td style={S.td}><Pill tier={r.tier} /></td>
                    <td style={{ ...S.td, color: '#6b6a68' }}>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button style={{ ...S.btn, marginTop: 12 }} onClick={downloadTiered}>Download tiered CSV</button>

          <Accordion isOpen={!!open.a2} onToggle={() => toggle('a2')} title="How the tiers are calculated">
            <ul style={ul}>
              <li>Tiers use several signals, not one, and weigh customer value against cost to serve.</li>
              <li>ARR is the gate for Strategic, so a strong revenue account is not downgraded for one weak operational metric.</li>
              <li>Rules, not lead scoring: lead scoring rates people, and these tiers rate accounts. Predictive scoring needs more data than most startups have; Microsoft Dynamics 365, for example, needs 40 qualified and 40 disqualified leads to train.</li>
              <li>Every cutoff (top 20%, bottom 25%, median, 2 of 3) is a judgment call, not a benchmark. Edit them to fit your business.</li>
            </ul>
            <p style={{ fontSize: 12, color: '#9b9a97', marginTop: 12 }}>Sources: <L href="https://www.velaris.io/articles/customer-tiers-for-customer-success">Velaris: Customer Tiers in SaaS</L>, <L href="https://www.factors.ai/blog/account-scoring-guide">Factors.ai: B2B Account Scoring Guide</L>, <L href="https://learn.microsoft.com/en-us/dynamics365/sales/configure-predictive-lead-scoring">Microsoft Learn: Configure predictive lead scoring</L></p>
          </Accordion>
        </section>
      )}

      {/* Step 3 */}
      {tiered && (
        <section style={S.card}>
          <p style={S.stepEyebrow}>Step 3</p>
          <h3 style={S.stepTitle}>How each tier is used</h3>
          <p style={S.intro}>Strategic and Core ICP accounts become the seed for your lookalike search. Churned accounts tell the LLM what to avoid.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={S.th}>Tier</th><th style={S.th}>In the LLM prompt</th><th style={S.th}>Default motion</th></tr></thead>
              <tbody>
                <tr><td style={S.td}><Pill tier="Strategic" /></td><td style={S.td}>Seed: find lookalikes first</td><td style={S.td}>One-to-one: bespoke programs for the top 10 to 50 accounts (<L href="https://6sense.com/guides/abm-strategy/">6sense ABM guide</L>)</td></tr>
                <tr><td style={S.td}><Pill tier="Core ICP" /></td><td style={S.td}>Seed: find lookalikes second</td><td style={S.td}>One-to-few: semi-personalized campaigns for clusters of 5 to 20 similar accounts (<L href="https://6sense.com/guides/abm-strategy/">6sense ABM guide</L>)</td></tr>
                <tr><td style={S.td}><Pill tier="Heavy Lift" /></td><td style={S.td}>Not a seed</td><td style={S.td}>Self-serve; sales engages on buying signals (<L href="https://salesmotion.io/blog/saas-gtm-strategy-plg-sales-led">Salesmotion</L>, <L href="https://www.plg.news/p/how-to-use-product-qualified-accounts">PLG News</L>)</td></tr>
                <tr><td style={S.td}><Pill tier="Churned" /></td><td style={S.td}>Avoid profile</td><td style={S.td}>Excluded from the list</td></tr>
              </tbody>
            </table>
          </div>
          <p style={{ ...S.gray, fontStyle: 'italic', marginTop: 10 }}>
            Account counts per motion vary by source: 6sense puts one-to-few at 50 to 200 accounts, ZenABM at 50 to 300. The right size depends on your company and product. (<L href="https://6sense.com/guides/abm-strategy/">6sense</L>, <L href="https://zenabm.com/blog/choose-target-accounts-for-abm">ZenABM</L>)
          </p>

          <Accordion isOpen={!!open.a3} onToggle={() => toggle('a3')} title="Keeping the list useful">
            <ul style={ul}>
              <li>"20,000 companies is not a target list. That is a marketing audience."</li>
              <li>Review your ICP quarterly against new closed-won data and do a full refresh annually.</li>
              <li>Treat the list as living: add new fits and remove accounts with no engagement after 90 days.</li>
              <li>Self-serve accounts can still become targets once they show buying signals.</li>
            </ul>
            <p style={{ fontSize: 12, color: '#9b9a97', marginTop: 12 }}>Sources: <L href="https://zenabm.com/blog/choose-target-accounts-for-abm">ZenABM: How to Choose Target Accounts for ABM</L>, <L href="https://6sense.com/guides/ideal-customer-profile/">6sense: Ideal Customer Profile guide</L>, <L href="https://www.plg.news/p/how-to-use-product-qualified-accounts">PLG News: Product Qualified Accounts</L></p>
          </Accordion>
        </section>
      )}

      {/* Step 4 */}
      {tiered && (
        <section style={S.card}>
          <p style={S.stepEyebrow}>Step 4</p>
          <h3 style={S.stepTitle}>Copy your prompt</h3>
          <p style={S.intro}>Built from the traits that set your best customers apart. No account names are included.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#6b6a68' }}>
              What you sell
              <input type="text" value={whatYouSell} placeholder="e.g. Syncflow: a data integration platform" onChange={e => setWhatYouSell(e.target.value)} style={{ ...S.input, marginTop: 4 }} />
            </label>
          </div>
          <textarea readOnly value={promptText} style={{ width: '100%', minHeight: 320, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.5, border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, color: '#1a1a19', background: '#f9fafb' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button style={S.btn} onClick={() => copyText(promptText, true)}>{copied ? 'Copied' : 'Copy prompt'}</button>
          </div>
          <p style={{ ...S.gray, marginTop: 8 }}>Paste into Claude, ChatGPT or Claygent. Once pasted, that provider's data policy applies.</p>
          <p style={{ ...S.gray, marginTop: 4 }}>The EXCLUDE list in the prompt is a best-effort filter. Step 4.1 is the guaranteed check: it removes every customer and recent loss in your browser.</p>

          <Accordion isOpen={!!open.a4} onToggle={() => toggle('a4')} title="Before you trust the LLM's list">
            <ul style={ul}>
              <li>LLMs can return made-up companies or old details. Keep the source URL and date-checked columns, and spot-check them.</li>
              <li>Check that every domain is live before you enrich the list.</li>
              <li>Company data decays, so re-verify on a schedule.</li>
            </ul>
            <p style={{ fontSize: 12, color: '#9b9a97', marginTop: 12 }}>Sources: <L href="https://www.hubspot.com/startups/tech-stacks/sales-csx/how-to-build-lookalike-prospecting-engine">HubSpot for Startups: Lookalike Prospecting Engine in Clay</L>, <L href="https://www.clay.com/guides/how-to-build-a-targeted-prospect-list">Clay: How to Build a Targeted Prospect List</L></p>
          </Accordion>

          {/* Step 4.1 */}
          <div style={{ marginTop: 22, borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
            <p style={S.stepEyebrow}>Step 4.1 (Recommended)</p>
            <h4 style={{ ...S.stepTitle, fontSize: 16 }}>Clean Your Output</h4>
            <p style={S.intro}>Paste or upload your LLM's results. This step will remove any company you already sell to or recently lost, right in your browser.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={cleanMode === 'paste' ? S.btn : S.btnGhost} onClick={() => { setCleanMode(m => (m === 'paste' ? null : 'paste')); setCleanError(''); }}>Paste results</button>
              <button style={S.btnGhost} onClick={() => { setShowCleanUpload(true); setCleanError(''); }}>Upload file (.csv or .xlsx)</button>
            </div>
            {cleanMode === 'paste' && (
              <div style={{ marginTop: 10 }}>
                <textarea value={pasted} onChange={e => setPasted(e.target.value)} placeholder="Paste the CSV or table your LLM returned" style={{ width: '100%', minHeight: 140, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10, color: '#1a1a19' }} />
                <button style={{ ...S.btn, marginTop: 10, opacity: pasted.trim() ? 1 : 0.5 }} disabled={!pasted.trim()} onClick={() => { setCleanFileName(''); cleanOutput(pasted); }}>Clean my list</button>
              </div>
            )}
            {showCleanUpload && (
              <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
                <div style={{ background: '#fff', borderRadius: 8, padding: 20, width: '100%', maxWidth: 420, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1a19', marginBottom: 12 }}>Choose your LLM's results file (.csv or .xlsx)</p>
                  <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => setCleanFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} style={{ fontSize: 13, marginBottom: 16, width: '100%' }} />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button style={S.btnGhost} onClick={() => { setShowCleanUpload(false); setCleanFile(null); }}>Cancel</button>
                    <button style={{ ...S.btn, opacity: cleanFile ? 1 : 0.5, cursor: cleanFile ? 'pointer' : 'not-allowed' }} disabled={!cleanFile} onClick={handleCleanUpload}>Upload and clean</button>
                  </div>
                </div>
              </div>
            )}
            {cleanFileName && <p style={{ ...S.gray, marginTop: 8 }}>Cleaned: <strong>{cleanFileName}</strong></p>}
            {cleanError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{cleanError}</p>}
            <p style={{ ...S.gray, marginTop: 8 }}>Matching is by domain. Subdomains count as a match (eu.acme.com matches acme.com).</p>

            {cleanResult && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#27500A', marginBottom: 6 }}>Clean ({cleanResult.clean.length}): ready to use</p>
                  {cleanResult.clean.map((c, i) => <p key={i} style={{ fontSize: 12, background: '#EAF3DE', color: '#1a1a19', borderRadius: 4, padding: '4px 8px', marginBottom: 4, wordBreak: 'break-word' }}>{c.line}</p>)}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button style={S.btnGhost} onClick={() => copyText(cleanResult.clean.map(c => c.line).join('\n'), false)}>Copy clean list</button>
                    <button style={S.btnGhost} onClick={downloadClean}>Download clean CSV</button>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#791F1F', marginBottom: 6 }}>Removed ({cleanResult.removed.length})</p>
                  {cleanResult.removed.map((c, i) => <p key={i} style={{ fontSize: 12, color: '#6b6a68', marginBottom: 4, wordBreak: 'break-word' }}><span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: '#FCEBEB', color: '#791F1F', whiteSpace: 'nowrap' }}>{c.reason}</span> <span style={{ marginLeft: 6 }}>{c.line}</span></p>)}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#633806', marginBottom: 6 }}>Check by hand ({cleanResult.check.length})</p>
                  {cleanResult.check.map((c, i) => <p key={i} style={{ fontSize: 12, color: '#6b6a68', marginBottom: 4, wordBreak: 'break-word' }}><span style={{ color: '#633806' }}>{c.reason}:</span> {c.line}</p>)}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Step 5 */}
      {tiered && (
        <section style={S.card}>
          <p style={S.stepEyebrow}>Step 5 (Optional)</p>
          <h3 style={S.stepTitle}>Take it to your tools</h3>
          <p style={S.intro}>Built from the same profile as your prompt. Everything below is generated in your browser.</p>

          <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a19', marginBottom: 4 }}>Clay</p>
          <p style={{ ...S.gray, marginBottom: 8 }}>Download your cleaned list from Step 4.1 with the domain in the first column, then import it into a Clay table as a CSV.</p>
          <button style={{ ...S.btnGhost, opacity: cleanResult && cleanResult.clean.length ? 1 : 0.5, cursor: cleanResult && cleanResult.clean.length ? 'pointer' : 'not-allowed' }} disabled={!(cleanResult && cleanResult.clean.length)} onClick={downloadClayCSV}>Download Clay-ready CSV</button>
          {!(cleanResult && cleanResult.clean.length) && <p style={{ ...S.gray, marginTop: 6 }}>Clean a list in Step 4.1 first.</p>}

          <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a19', marginTop: 18, marginBottom: 4 }}>Claygent prompt (runs on each row)</p>
          <p style={{ ...S.gray, marginBottom: 8 }}>Paste into a Claygent column. Replace {'{{Company}}'} and {'{{Domain}}'} with the matching columns in your table.</p>
          <textarea readOnly value={claygentText} style={{ width: '100%', minHeight: 200, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.5, border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, color: '#1a1a19', background: '#f9fafb' }} />
          <button style={{ ...S.btnGhost, marginTop: 8 }} onClick={() => copyKey(claygentText, 'claygent')}>{copiedKey === 'claygent' ? 'Copied' : 'Copy Claygent prompt'}</button>

          <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a19', marginTop: 18, marginBottom: 4 }}>Apollo filters</p>
          <p style={{ ...S.gray, marginBottom: 8 }}>Values to enter in Apollo's company search filters. Pick the closest options Apollo offers.</p>
          <textarea readOnly value={apolloText} style={{ width: '100%', minHeight: 160, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.5, border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, color: '#1a1a19', background: '#f9fafb' }} />
          <button style={{ ...S.btnGhost, marginTop: 8 }} onClick={() => copyKey(apolloText, 'apollo')}>{copiedKey === 'apollo' ? 'Copied' : 'Copy Apollo filters'}</button>

          <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a19', marginTop: 18, marginBottom: 4 }}>Exclusion list ({exclusion.list.length} accounts)</p>
          <p style={{ ...S.gray, marginBottom: 8 }}>Your current customers, churned customers and accounts lost in the last {windowMonths} months, one domain per line. Use it to exclude companies in Apollo, or download it as a CSV for a saved list.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={S.btnGhost} onClick={() => copyKey(exclusionText, 'exclude')}>{copiedKey === 'exclude' ? 'Copied' : 'Copy exclusion list'}</button>
            <button style={S.btnGhost} onClick={downloadExclusion}>Download exclusion CSV</button>
          </div>
          <p style={{ fontSize: 12, color: '#9b9a97', marginTop: 12 }}>Sources: <L href="https://university.clay.com/docs/csv-import-overview">Clay Docs: How to import your CSV into Clay</L>, <L href="https://www.clay.com/guides/how-to-use-claygent-for-prospect-research">Clay: How to Use Claygent for Prospect Research</L>, <L href="https://knowledge.apollo.io/hc/en-us/articles/4412665755661-Search-Filters-Overview">Apollo: Search Filters Overview</L></p>
        </section>
      )}

      {/* Limitations & Solutions */}
      <Accordion isOpen={!!open.limits} onToggle={() => toggle('limits')} title="Limitations & Solutions">
        <ul style={ul}>
          <li><strong>LLM amnesia.</strong> In long chats, LLMs lose track of instructions, so later batches can repeat companies or skip the EXCLUDE list. Research on long inputs found models use information best at the start or end of a prompt and worst in the middle. Solution: the prompt asks for 35 accounts in one response by default, puts the EXCLUDE list and a self-audit at the end, and Step 4.1 removes anything that slips through. If results drift, paste the RULES section again.</li>
          <li><strong>Strict rule exceptions.</strong> The tiers follow fixed rules, so some accounts land in a tier a human might not choose. For example, a top-revenue account with churn risk High goes to Heavy Lift, and a small file can push percentile cutoffs to odd values. Solution: every row shows its tier_reason, the cutoffs are editable, and you can adjust tiers in the downloaded CSV.</li>
        </ul>
        <p style={{ fontSize: 12, color: '#9b9a97', marginTop: 12 }}>Sources: <L href="https://arxiv.org/abs/2307.03172">Liu et al.: Lost in the Middle</L></p>
      </Accordion>

      {/* Additional insights */}
      <Accordion isOpen={!!open.insights} onToggle={() => toggle('insights')} title="Additional ABM List Building & LLM insights">
        <p>This free tool does not include an intent and intelligence layer (latest hiring efforts, company updates etc.) given that many LLM chats can't read career pages or job boards.</p>
      </Accordion>
    </div>
  );
}
