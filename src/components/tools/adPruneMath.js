// Ad Pruning Tool: CSV parsing and verdict math, kept free of React so it can be tested on its own.
//
// Method:
//   1. Each ad is compared to the most specific group of OTHER ads (leave-one-out) that has
//      conversions and at least one other ad past the volume floor.
//      Paid social: ad set, then audience segment (if mapped) or the whole objective.
//      Paid search: ad group, then campaign, then all ads in this analysis.
//      RSA assets: same asset type inside the same ad, no fallback.
//   2. Group rates are pooled (total conversions / total spend), not averages of each ad's rate.
//   3. Volume floor. Paid social: impressions (default 10,000, Javier's practitioner rule, editable).
//      Paid search and assets: clicks needed to expect k conversions at the group's conversion rate,
//      where k = -ln(1 - confidence). At 95% k = 2.996, so roughly 3 expected conversions.
//      At that point, zero conversions is exactly borderline significant: P(0 | k) = e^-k = 1 - confidence.
//      A hard minimum applies on top: floor = max(minimum clicks, k / group CVR). Default minimum 30 clicks
//      (Javier Cruz Galera's choice, editable), so a high-converting group can't produce a tiny floor.
//   4. Expected conversions = ad spend / group cost per conversion.
//      One-sided Poisson test: P(X <= actual | expected). Below 1 - confidence means significantly worse.
//   5. Verdicts: under the floor = Wait. Past the floor and significantly worse = Turn off.
//      Past the floor and at or above expected = Keep. Otherwise Wait (not conclusive yet).

export const DEFAULT_FLOOR_IMPRESSIONS = 10000;
export const DEFAULT_CONFIDENCE = 0.95;
export const DEFAULT_MIN_CLICKS = 30; // hard minimum for the paid search click floor, Javier's choice, editable
export const MIN_STAGE_VOLUME = 15; // per 30 days: Understory and Google Smart Bidding guidance, see sources on the page

// ---------- CSV ----------

export function decodeBuffer(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  return new TextDecoder('utf-8').decode(buf);
}

function splitLine(line, d) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === d) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// Splits text into logical lines, keeping newlines that sit inside quotes.
function logicalLines(text) {
  const lines = [];
  let cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') q = !q;
    if ((ch === '\n' || ch === '\r') && !q) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      lines.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines.filter(l => l.trim() !== '');
}

// Some exports start with report title or date-range lines. The header is taken as the first
// line that has the widest column count among the first 30 lines.
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const lines = logicalLines(clean);
  if (!lines.length) return { headers: [], rows: [] };
  const sample = lines.slice(0, 30).join('\n');
  const d = ['\t', ';', ','].reduce((best, c) => (sample.split(c).length > sample.split(best).length ? c : best), ',');
  const split = lines.map(l => splitLine(l, d));
  const width = r => r.filter(c => c !== '').length;
  const maxW = Math.max(...split.slice(0, 30).map(width));
  const h = split.findIndex(r => width(r) === maxW);
  const headers = split[h].map((x, i) => x || `Column ${i + 1}`);
  const rows = split.slice(h + 1)
    .filter(r => width(r) >= Math.min(3, maxW))
    .map(r => Object.fromEntries(headers.map((k, i) => [k, r[i] ?? ''])));
  return { headers, rows };
}

export function num(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).replace(/[$€£,%\s]/g, '');
  if (s === '' || s === '-' || s === '--') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// Suggests a column for each field from header keywords. The user confirms every pick in the mapper.
const GUESS = {
  adName: [/^ad name$/i, /creative name/i, /^ad$/i, /ad name/i, /^asset$/i, /asset text/i],
  adId: [/^ad id$/i, /creative id/i, /ad id/i],
  campaign: [/^campaign name$/i, /^campaign$/i, /campaign/i],
  group: [/ad set name/i, /ad group/i, /ad set/i, /campaign group/i],
  objective: [/objective/i],
  audience: [/audience/i, /segment/i],
  assetType: [/asset type/i, /field type/i, /^type$/i],
  impressions: [/^impressions$/i, /impr/i],
  clicks: [/^clicks$/i, /link clicks/i, /clicks/i],
  spend: [/^spend$/i, /^cost$/i, /amount spent/i, /total spent/i, /spent/i, /cost/i],
  opens: [/form opens/i, /lead form opens/i],
};

export function guessMapping(headers) {
  const used = new Set();
  const m = {};
  for (const [field, pats] of Object.entries(GUESS)) {
    for (const p of pats) {
      const hit = headers.find(hd => p.test(hd) && !used.has(hd));
      if (hit) { m[field] = hit; used.add(hit); break; }
    }
  }
  const convPats = [/lead/i, /conversion/i, /form fill/i, /mql/i, /sql/i, /opportunit/i, /result/i];
  m.results = headers.filter(hd => !used.has(hd) && !/cost per|rate|cpl|cpa|value|open/i.test(hd) && convPats.some(p => p.test(hd)));
  return m;
}

// ---------- Poisson ----------

// P(X <= k) for X ~ Poisson(lambda), summed in log space so large lambda does not underflow.
export function poissonCdf(k, lambda) {
  if (lambda <= 0) return 1;
  if (k < 0) return 0;
  const lnL = Math.log(lambda);
  let lt = -lambda;
  let acc = lt;
  for (let i = 1; i <= k; i++) {
    lt += lnL - Math.log(i);
    const hi = Math.max(acc, lt);
    acc = hi + Math.log(Math.exp(acc - hi) + Math.exp(lt - hi));
  }
  return Math.min(1, Math.exp(acc));
}

// Expected conversions at which zero conversions becomes significant.
export const kFor = confidence => -Math.log(1 - confidence);

// ---------- analysis ----------

const sum = (arr, f) => arr.reduce((a, r) => a + f(r), 0);

function pool(rs) {
  return {
    n: rs.length,
    impr: sum(rs, r => r.impr),
    clicks: sum(rs, r => r.clicks),
    spend: sum(rs, r => r.spend),
    conv: sum(rs, r => r.conv),
    opens: sum(rs, r => r.opens || 0),
  };
}

export function rates(p) {
  return {
    ctr: p.impr ? p.clicks / p.impr : null,
    cvr: p.clicks ? p.conv / p.clicks : null,
    formCvr: p.opens ? p.conv / p.opens : null,
    cpm: p.impr ? (p.spend / p.impr) * 1000 : null,
    cpx: p.conv ? p.spend / p.conv : null,
  };
}

function levelsFor(mode, hasGroup, hasAudience) {
  const cg = r => `${r.campaign}||${r.group}`;
  if (mode === 'assets') return [{ label: 'Same asset type in this ad', key: r => `${cg(r)}||${r.adId || r.group}||${r.assetType}` }];
  if (mode === 'search') {
    const L = [];
    if (hasGroup) L.push({ label: 'Ad group', key: cg });
    L.push({ label: 'Campaign', key: r => r.campaign });
    L.push({ label: 'All ads in this analysis', key: () => 'all' });
    return L;
  }
  const L = [];
  if (hasGroup) L.push({ label: 'Ad set', key: cg });
  if (hasAudience) L.push({ label: 'Audience segment', key: r => `aud||${r.audience}` });
  else L.push({ label: 'Objective', key: () => 'all' });
  return L;
}

// rows: [{ id, name, adId, campaign, group, audience, assetType, impr, clicks, spend, conv, opens }]
// opts: { mode: 'social' | 'search' | 'assets', confidence, floorImpressions, minClicks, accountRows }
export function analyze(rows, opts) {
  const { mode, confidence = DEFAULT_CONFIDENCE, floorImpressions = DEFAULT_FLOOR_IMPRESSIONS, minClicks = DEFAULT_MIN_CLICKS, accountRows = rows } = opts;
  const alpha = 1 - confidence;
  const k = kFor(confidence);
  const hasGroup = rows.some(r => r.group);
  const hasAudience = mode === 'social' && rows.some(r => r.audience);
  const levels = levelsFor(mode, hasGroup, hasAudience);
  const buckets = levels.map(L => {
    const m = new Map();
    rows.forEach(r => { const kk = L.key(r); if (!m.has(kk)) m.set(kk, []); m.get(kk).push(r); });
    return m;
  });
  const account = pool(accountRows);
  const accountRates = rates(account);

  const floorFor = peers => {
    if (mode === 'social') return { type: 'impressions', value: floorImpressions };
    const cvr = peers.clicks ? peers.conv / peers.clicks : 0;
    return { type: 'clicks', value: cvr > 0 ? Math.max(minClicks, Math.ceil(k / cvr)) : Infinity };
  };
  const past = (r, floor) => (floor.type === 'impressions' ? r.impr >= floor.value : r.clicks >= floor.value);

  return rows.map(r => {
    let chosen = null;
    for (let li = 0; li < levels.length; li++) {
      const members = buckets[li].get(levels[li].key(r)) || [];
      const others = members.filter(o => o.id !== r.id);
      if (!others.length) continue;
      const peers = pool(others);
      if (peers.conv <= 0 || peers.spend <= 0) continue;
      const floor = floorFor(peers);
      if (!others.some(o => past(o, floor))) continue;
      chosen = { level: levels[li].label, others, peers, floor };
      break;
    }

    const own = pool([r]);
    const ownRates = rates(own);
    const base = { ...r, own: ownRates, accountRates };

    if (!chosen) {
      return { ...base, verdict: 'wait', reason: 'nogroup', compared: null, expected: null, index: null, p: null, pastFloor: false, floor: null };
    }

    const { peers, floor, others } = chosen;
    const groupRates = rates(peers);
    const groupCpx = peers.spend / peers.conv;
    const expected = r.spend / groupCpx;
    const index = expected > 0 ? r.conv / expected : null;
    const p = expected > 0 ? poissonCdf(r.conv, expected) : 1;
    const pastFloor = past(r, floor);
    const metric = floor.type === 'impressions' ? r.impr : r.clicks;
    const progress = Number.isFinite(floor.value) ? Math.min(1, metric / floor.value) : 0;
    const toFloor = Number.isFinite(floor.value) ? Math.max(0, floor.value - metric) : null;

    let verdict, reason;
    if (!pastFloor) {
      verdict = 'wait';
      // Starved: under the floor while every other ad in its comparison group is past it.
      reason = others.every(o => past(o, floor)) ? 'starved' : 'floor';
    } else if (expected > 0 && p < alpha) {
      verdict = 'off';
      reason = 'worse';
    } else if (index !== null && index >= 1) {
      verdict = 'keep';
      reason = 'ok';
    } else {
      verdict = 'wait';
      reason = 'inconclusive';
    }

    return {
      ...base, verdict, reason, compared: chosen.level, groupRates, groupCpx, expected, index, p,
      pastFloor, floor, progress, toFloor, excess: r.spend - r.conv * groupCpx,
    };
  });
}

// Which part of cost per conversion is furthest off vs. the group: CPM up, CTR down, or conversion rate down.
// Cost per conversion = CPM / (1,000 x CTR x CVR), so the three ratios multiply out to the cost ratio.
export function mainLever(a) {
  const o = a.own, g = a.groupRates;
  if (!g) return null;
  if (!a.clicks) return { lever: 'ctr', ratio: 0 };
  const cand = [];
  if (o.ctr !== null && g.ctr) cand.push({ lever: 'ctr', ratio: o.ctr / g.ctr, bad: -Math.log(Math.max(o.ctr / g.ctr, 1e-9)) });
  if (o.cvr !== null && g.cvr) cand.push({ lever: 'cvr', ratio: o.cvr / g.cvr, bad: -Math.log(Math.max(o.cvr / g.cvr, 1e-9)) });
  if (o.cpm !== null && g.cpm) cand.push({ lever: 'cpm', ratio: o.cpm / g.cpm, bad: Math.log(o.cpm / g.cpm) });
  if (!cand.length) return null;
  return cand.sort((x, y) => y.bad - x.bad)[0];
}

const pct = x => `${Math.round(Math.abs(x) * 100)}%`;
const int = x => Math.round(x).toLocaleString('en-US');

export function whatToDo(a, ctx) {
  const { mode, convLabel } = ctx;
  const unit = a.floor && a.floor.type === 'clicks' ? 'clicks' : 'impressions';
  if (a.verdict === 'wait') {
    if (a.reason === 'nogroup') return 'Wait. No comparison group with conversions and another ad past the floor yet.';
    if (a.reason === 'starved') return `Wait. ${int(a.toFloor)} ${unit} to the floor, and delivery is going to the other ads in its group. Check whether the platform is starving it.`;
    if (a.reason === 'floor') return `Wait. ${int(a.toFloor)} ${unit} to the floor.`;
    return `Wait. Below its group (${fmtN(a.conv)} vs. ${a.expected.toFixed(1)} expected ${convLabel}), but not conclusive yet.`;
  }
  if (a.verdict === 'keep') {
    return `Keep. ${fmtN(a.conv)} ${convLabel} vs. ${a.expected.toFixed(1)} expected, at or above its group.`;
  }
  const lead = mode === 'assets' ? 'Replace candidate (directional).' : 'Turn off.';
  const lv = mainLever(a);
  if (!lv) return `${lead} ${fmtN(a.conv)} vs. ${a.expected.toFixed(1)} expected ${convLabel}.`;
  if (lv.lever === 'ctr') {
    const why = mode === 'social' ? "the creative isn't stopping the scroll" : "the copy isn't earning the click";
    return `${lead} CTR ${pct(1 - lv.ratio)} below group, so ${why}.`;
  }
  if (lv.lever === 'cvr') {
    if (!a.conv) return `${lead} 0 ${convLabel} from ${int(a.clicks)} clicks while its group converts. Check the offer, form, or landing page match.`;
    return `${lead} Conversion rate ${pct(1 - lv.ratio)} below group. Clicks aren't converting, so check the offer, form, or landing page match.`;
  }
  return `${lead} CPM ${pct(lv.ratio - 1)} above group. Mostly a cost problem, so check audience overlap and bids before blaming the ad.`;
}

export function fmtN(x) {
  return Number.isInteger(x) ? x.toLocaleString('en-US') : x.toFixed(1);
}

// Volume check for the "optimizing for" pick. Returns per-30-day volume when days are known.
export function stageVolume(rows, days) {
  const total = sum(rows, r => r.conv);
  const per30 = days > 0 ? (total * 30) / days : null;
  return { total, per30, enough: (per30 ?? total) >= MIN_STAGE_VOLUME };
}

export function toCsv(list, convLabel) {
  const head = ['Verdict', 'Ad name', 'Ad ID', 'Campaign', 'Ad set / ad group', 'Compared against', 'Impressions', 'Clicks', 'Spend', convLabel,
    `Expected ${convLabel}`, 'Cost per conversion', 'Group cost per conversion', 'Account cost per conversion', 'CTR', 'Group CTR', 'Account CTR',
    'Conversion rate', 'Group conversion rate', 'Account conversion rate', 'What to do'];
  const esc = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const r2 = x => (x === null || x === undefined || !Number.isFinite(x) ? '' : Math.round(x * 100) / 100);
  const r4 = x => (x === null || x === undefined || !Number.isFinite(x) ? '' : Math.round(x * 10000) / 10000);
  const lines = [head.map(esc).join(',')];
  list.forEach(a => {
    lines.push([
      a.verdictLabel, a.name, a.adId, a.campaign, a.group, a.compared || '', a.impr, a.clicks, r2(a.spend), a.conv,
      r2(a.expected), r2(a.own.cpx), r2(a.groupCpx), r2(a.accountRates.cpx), r4(a.own.ctr), r4(a.groupRates?.ctr), r4(a.accountRates.ctr),
      r4(a.own.cvr), r4(a.groupRates?.cvr), r4(a.accountRates.cvr), a.todo,
    ].map(esc).join(','));
  });
  return lines.join('\n');
}
