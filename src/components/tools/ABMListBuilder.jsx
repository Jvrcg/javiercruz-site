import { useMemo, useState } from 'react';

// ABM List Builder
// Privacy rules (keep the Privacy-First copy true):
// 1. Uploaded files are read with FileReader only. Nothing the user uploads or pastes is sent anywhere.
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

function traitLines(traits, problemLabel) {
  return traits.map(t => {
    const parts = t.items.map((it, i) => {
      const pct = Math.round(it.baseShare * 100);
      const vs = i === 0 && t === traits[0] ? `vs ${pct}% of all customers` : `vs ${pct}%`;
      return `${it.value} (${it.n} of ${it.total}, ${vs})`;
    });
    const label = problemLabel && t.label === 'Problem we solved' ? problemLabel : t.label;
    return `- ${label}: ${parts.join(', ')}`;
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
  const [showCutoffs, setShowCutoffs] = useState(false);

  // Hypothesis mode picks
  const [picked, setPicked] = useState({});

  // Step 4 inputs
  const [whatYouSell, setWhatYouSell] = useState('');
  const [strategicCount, setStrategicCount] = useState(25);
  const [coreCount, setCoreCount] = useState(50);
  const [jobTitles, setJobTitles] = useState('');
  const [copied, setCopied] = useState(false);

  // Step 4.1
  const [pasted, setPasted] = useState('');
  const [cleanResult, setCleanResult] = useState(null);

  const [tierFilter, setTierFilter] = useState('All');
  const [open, setOpen] = useState({});
  const toggle = k => setOpen(o => ({ ...o, [k]: !o[k] }));

  function resetDownstream() {
    setConfirmed(false);
    setPicked({});
    setCleanResult(null);
    setPasted('');
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
    setJobTitles('');
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
  const promptText = useMemo(() => {
    if (!tiered) return '';
    const { current, churned, hypothesis, by } = tiered;
    const strategic = hypothesis ? by('Hand-picked') : by('Strategic');
    const core = hypothesis ? by('Not picked') : by('Core ICP');
    const lines = [];
    lines.push('You are a B2B research analyst building a target account list.');
    lines.push('');
    lines.push('PERMISSION');
    lines.push('You have my permission to search the web and open public web pages for this whole task. Do not stop to ask before each search or page. Only ask if a page needs a login or a payment.');
    lines.push('');
    lines.push('CONTEXT');
    lines.push(`We sell ${whatYouSell.trim() ? whatYouSell.trim() : (isSample ? 'Syncflow: a data integration platform' : '[describe what you sell]')}. Below are the traits that set our best customers apart, measured against our full customer base.`);
    lines.push('');
    const sLabel = hypothesis ? 'BEST CUSTOMERS (HAND-PICKED)' : 'STRATEGIC CUSTOMERS';
    lines.push(`${sLabel} (${strategic.length} accounts, median ARR ${fmtMoney(median(strategic.map(r => r.arr)))})`);
    const sTraits = traitLines(overIndexedTraits(strategic, current));
    if (sTraits.length) lines.push(...sTraits);
    else lines.push('- No single trait stands out for this group.');
    lines.push('');
    lines.push(`CORE ICP CUSTOMERS (${core.length} accounts, median ARR ${fmtMoney(median(core.map(r => r.arr)))})`);
    const cTraits = traitLines(overIndexedTraits(core, current));
    const coreFallback = cTraits.length === 0;
    if (cTraits.length) {
      lines.push(...cTraits);
    } else {
      const healthy = [...strategic, ...core];
      const counts = {};
      healthy.forEach(r => { if (r.industry) counts[r.industry] = (counts[r.industry] || 0) + 1; });
      const top3 = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(e => e[0]);
      const bandIdx = healthy.map(r => EMPLOYEE_BANDS.indexOf(r.employee_band)).filter(i => i >= 0).sort((a, b) => a - b);
      const medBand = bandIdx.length ? EMPLOYEE_BANDS[bandIdx[Math.floor((bandIdx.length - 1) / 2)]] : '[median employee band]';
      lines.push(`For the Core ICP tier, look for accounts that broadly mirror our general customer profile: primarily distributed across our top three indexed industries (${top3.length ? top3.join('; ') : '[top 3 industries]'}) and fitting within our mid-tier employee bands (${medBand}).${churned.length ? ' Avoid the negative churned indicators listed below.' : ''}`);
    }
    const aTraits = traitLines(overIndexedTraits(churned, current), 'Problem');
    if (churned.length) {
      lines.push('');
      lines.push(`AVOID: CUSTOMERS WHO CHURNED IN YEAR ONE (${churned.length} accounts)`);
      if (aTraits.length) lines.push(...aTraits);
      else lines.push('- No single trait stands out for this group.');
    }
    lines.push('');
    lines.push('TASK');
    lines.push(`1. List ${strategicCount} companies that match the ${hypothesis ? 'best customer' : 'Strategic'} profile.`);
    lines.push(`2. List ${coreCount} companies that match the Core ICP profile.`);
    if (churned.length) lines.push('3. Skip any company that matches the Avoid profile.');
    const titles = jobTitles.split(',').map(s => s.trim()).filter(Boolean);
    if (titles.length) {
      lines.push('');
      lines.push('Hiring Signal Objective:');
      const titleQuery = titles.length === 1 ? `"${titles[0]}"` : '(' + titles.map(t => `"${t}"`).join(' OR ') + ')';
      lines.push(`For each lookalike account generated, use your web-browsing capability to search major ATS platforms using this query format: \`site:greenhouse.io OR site:lever.co OR site:ashbyhq.com "[Company Name]" ${titleQuery}\`.`);
      lines.push("Validation Rule: Only count a hiring signal if the job posting link is live when you open it. Include that link in your response. If you cannot open a live posting, write 'no live posting found'.");
    }
    lines.push('');
    lines.push('RULES');
    lines.push('- Only include real companies you can verify on the public web.');
    lines.push('- For every field, give the source URL and the date you checked it.');
    lines.push('- If you cannot verify a field, write "unverified". Never guess.');
    lines.push("- Confirm the company's website is live.");
    lines.push('- Return results in batches of 25. Wait for me to say "continue" before the next batch.');
    lines.push('- Before returning a batch, check every domain against the EXCLUDE list and remove matches.');
    lines.push("- If your evidence for a company comes from a competitor's case study or customer page, keep the company and write that competitor's name in the Competitor customer column. Otherwise write \"none found\".");
    if (coreFallback) {
      const reasons = ['Adjacent industry', 'Tech stack match', 'Problem match'];
      if (titles.length) reasons.push('Hiring signal');
      lines.push(`- Core ICP 70/30 rule: at least 70% of the Core ICP companies must be in the listed industries and employee band. Up to 30% may fall outside them, but only if the company matches at least one ${hypothesis ? 'best customer' : 'Strategic'} trait with a source. For each of those, fill the Exception reason column with exactly one of: ${reasons.join(' | ')}. For the rest, write "n/a".`);
      lines.push('- Do not pad the list. If you cannot find enough qualified companies, return fewer and say how many are missing.');
    }
    lines.push('');
    lines.push(`EXCLUDE (current customers, churned customers, and accounts lost in the last ${windowMonths} months; never return these)`);
    lines.push(exclusion.list.map(e => e.domain || e.name).join(', '));
    lines.push('');
    lines.push('OUTPUT');
    const cols = ['Tier', 'Company', 'Domain', 'Industry', 'Employees', 'Tech stack evidence', 'Problem evidence', 'Competitor customer', 'Source URLs', 'Date checked', 'Match reason (one line)'];
    if (titles.length) cols.splice(9, 0, 'Hiring signal link');
    if (coreFallback) cols.push('Exception reason');
    lines.push(`A table with these columns: ${cols.join(' | ')}`);
    return lines.join('\n');
  }, [tiered, exclusion, isSample, whatYouSell, strategicCount, coreCount, jobTitles, windowMonths]);

  // ---------- Step 4.1 cleaner ----------
  function cleanOutput() {
    const domainRe = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s|,)]*)?/gi;
    const exDomains = exclusion.list.filter(e => e.domain);
    const exNames = exclusion.list.filter(e => normName(e.name).length > 2);
    const clean = [];
    const removed = [];
    const check = [];
    const seen = new Set();
    let header = null;
    pasted.split(/\r?\n/).forEach(raw => {
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
      if (seen.has(primary)) { check.push({ line, reason: 'Duplicate' }); return; }
      seen.add(primary);
      clean.push({ line, domain: primary });
    });
    setCleanResult({ clean, removed, check, header });
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
            <li><strong>You control the export.</strong> The tiered CSV downloads straight to your device. The prompt only goes to an LLM if you copy and paste it there yourself, and that provider's data policy then applies. The prompt includes the domains of your customers and recently lost accounts so the LLM can skip them, but no revenue, names of people or other fields. Results you paste back in Step 4.1 are cleaned in your browser too.</li>
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

              <p style={{ ...S.gray, marginBottom: 8 }}>
                Strategic = top {strategicTopPct}% ARR ({fmtMoney(tiered.cut.arrTop)} and up) plus any {traitsNeeded} of 3: sales cycle under the median ({Math.round(tiered.cut.cycleMedian)} days), expansion Yes, product-market fit High. Heavy Lift = churn risk High, or bottom {heavyArrBottomPct}% ARR ({fmtMoney(tiered.cut.arrBottom)} or less) with top {heavyTicketsTopPct}% support tickets ({tiered.cut.ticketsTop} or more per quarter). Everything else = Core ICP. All cutoffs are judgment calls you can edit.
              </p>
              <button style={{ ...S.btnGhost, fontSize: 12, padding: '5px 12px', marginBottom: 10 }} onClick={() => setShowCutoffs(v => !v)}>
                {showCutoffs ? 'Hide cutoffs' : 'Edit cutoffs'}
              </button>
              {showCutoffs && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12, background: '#f8f8f7', padding: 12, borderRadius: 6 }}>
                  {[
                    ['Strategic: top % of ARR', strategicTopPct, setStrategicTopPct, 1, 99],
                    ['Strategic: traits needed (of 3)', traitsNeeded, setTraitsNeeded, 0, 3],
                    ['Heavy Lift: bottom % of ARR', heavyArrBottomPct, setHeavyArrBottomPct, 1, 99],
                    ['Heavy Lift: top % of tickets', heavyTicketsTopPct, setHeavyTicketsTopPct, 1, 99],
                  ].map(([label, val, set, min, max]) => (
                    <label key={label} style={{ fontSize: 12, color: '#6b6a68' }}>
                      {label}
                      <input type="number" min={min} max={max} value={val} onChange={e => { const v = Math.max(min, Math.min(max, Number(e.target.value) || 0)); set(v); }} style={{ ...S.input, marginTop: 4 }} />
                    </label>
                  ))}
                </div>
              )}
            </>
          )}

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
            <input type="number" min={1} max={500} value={strategicCount} onChange={e => setStrategicCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} aria-label={tiered.hypothesis ? 'Best customer lookalikes' : 'Strategic lookalikes'} style={{ ...S.input, width: 70 }} />
            <span style={{ fontSize: 13, color: '#1a1a19' }}>{tiered.hypothesis ? 'best customer' : 'Strategic'}</span>
            <input type="number" min={1} max={500} value={coreCount} onChange={e => setCoreCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} aria-label="Core ICP lookalikes" style={{ ...S.input, width: 70 }} />
            <span style={{ fontSize: 13, color: '#1a1a19' }}>Core ICP</span>
          </div>
          <p style={{ ...S.gray, marginBottom: 14 }}>These counts go into the prompt in Step 4.</p>

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
          <label style={{ fontSize: 12, color: '#6b6a68', display: 'block', marginBottom: 4 }}>
            Target job titles (optional, comma separated). Adds the hiring signal section to the prompt.
            <input type="text" value={jobTitles} placeholder="e.g. Director of Data Engineering, Analytics Engineer" onChange={e => setJobTitles(e.target.value)} style={{ ...S.input, marginTop: 4 }} />
          </label>
          <p style={{ ...S.gray, fontStyle: 'italic', marginBottom: 12 }}>
            Many LLM chats can't read career pages or job boards. The hiring signal works best in a web-enabled tool like Claygent or Perplexity. See Limitations & Solutions at the bottom of this page.
          </p>
          <textarea readOnly value={promptText} style={{ width: '100%', minHeight: 320, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.5, border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, color: '#1a1a19', background: '#f9fafb' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button style={S.btn} onClick={() => copyText(promptText, true)}>{copied ? 'Copied' : 'Copy prompt'}</button>
          </div>
          <p style={{ ...S.gray, marginTop: 8 }}>Paste into Claude, ChatGPT or Claygent. Once pasted, that provider's data policy applies.</p>

          <Accordion isOpen={!!open.a4} onToggle={() => toggle('a4')} title="Before you trust the LLM's list">
            <ul style={ul}>
              <li>LLMs can return made-up companies or old details. Keep the source URL and date-checked columns, and spot-check them.</li>
              <li>Check that every domain is live before you enrich the list.</li>
              <li>Company data decays, so re-verify on a schedule.</li>
              <li>A low-fit account with loud intent still stays off the list.</li>
              <li>Next step outside this tool: layer intent. 6sense, for example, sorts accounts into buying stages from Target to Purchase.</li>
            </ul>
            <p style={{ fontSize: 12, color: '#9b9a97', marginTop: 12 }}>Sources: <L href="https://www.hubspot.com/startups/tech-stacks/sales-csx/how-to-build-lookalike-prospecting-engine">HubSpot for Startups: Lookalike Prospecting Engine in Clay</L>, <L href="https://www.clay.com/guides/how-to-build-a-targeted-prospect-list">Clay: How to Build a Targeted Prospect List</L>, <L href="https://digital-astronauts.com/blog/abm-target-account-list-intent-data/">Digital Astronauts: ABM Target Account List with Intent Data</L>, <L href="https://support.6sense.com/docs/predictive-buying-stages">6sense: Predictive Buying Stages</L></p>
          </Accordion>

          {/* Step 4.1 */}
          <div style={{ marginTop: 22, borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
            <p style={S.stepEyebrow}>Step 4.1 (Recommended)</p>
            <h4 style={{ ...S.stepTitle, fontSize: 16 }}>Clean Your Output</h4>
            <p style={S.intro}>Paste your LLM's results here. This step will remove any company you already sell to or recently lost, right in your browser.</p>
            <textarea value={pasted} onChange={e => setPasted(e.target.value)} placeholder="Paste the table or list your LLM returned" style={{ width: '100%', minHeight: 140, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10, color: '#1a1a19' }} />
            <button style={{ ...S.btn, marginTop: 10, opacity: pasted.trim() ? 1 : 0.5 }} disabled={!pasted.trim()} onClick={cleanOutput}>Clean my list</button>
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

      {/* Limitations & Solutions */}
      <Accordion isOpen={!!open.limits} onToggle={() => toggle('limits')} title="Limitations & Solutions">
        <p style={{ marginBottom: 10 }}>That’s why the prompt doesn't just ask for the data blindly. It acts as an agentic workflow blueprint. It instructs web-enabled AI tools like Claygent or Perplexity on the exact Google search operators to use against Greenhouse, Lever and Ashby to validate live hiring signals on their side.</p>
        <ul style={ul}>
          <li><strong>LLM amnesia.</strong> In long chats, LLMs lose track of instructions, so later batches can repeat companies or skip the EXCLUDE list. Research on long inputs found models use information best at the start or end of a prompt and worst in the middle. Solution: the prompt puts the rules and the EXCLUDE list at the end, works in batches of 25, and Step 4.1 removes anything that slips through. If results drift, paste the RULES section again.</li>
          <li><strong>Scraping barriers.</strong> Career pages and job boards can block automated browsing or load their listings in ways an AI tool can't read. "No live posting found" means the tool couldn't confirm one, not that the company isn't hiring. Solution: use a web-enabled agent like Claygent, and spot-check important accounts by hand.</li>
          <li><strong>Strict rule exceptions.</strong> The tiers follow fixed rules, so some accounts land in a tier a human might not choose. For example, a top-revenue account with churn risk High goes to Heavy Lift, and a small file can push percentile cutoffs to odd values. Solution: every row shows its tier_reason, the cutoffs are editable, and you can adjust tiers in the downloaded CSV.</li>
        </ul>
        <p style={{ fontSize: 12, color: '#9b9a97', marginTop: 12 }}>Sources: <L href="https://arxiv.org/abs/2307.03172">Liu et al.: Lost in the Middle</L></p>
      </Accordion>
    </div>
  );
}
