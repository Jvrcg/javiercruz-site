// Layer 2 (baseline engine) + Layer 3 (rules engine) for the B2B Funnel Diagnostic Tool.
// Pure functions. Consumes the `periods` array emitted by FunnelDiagnosticInput.
//
// Input can be daily, weekly, or monthly rows (any granularity `parseReportingDate`
// understands). `bucketInto30DayWindows()` normalizes everything into non-overlapping
// 30-day windows, summing raw counts per window, before the baseline/rules math below
// (which is unchanged) runs against those windows as if they were the periods.

import { parseReportingDate } from './dateParser.js';

export const DEVIATION_THRESHOLD = 0.20;   // 20% off trailing-3 baseline
export const MIN_PERIODS_FLAG = 3;         // deviation flags
export const MIN_PERIODS_MARGINAL = 4;     // marginal cpMQL (3 to build baseline + 1 to compare)
export const SIGNAL_STARVATION_FLOOR = 15; // conversions/month (Google Ads Help Center)

const METRIC_KEYS = ['cpl', 'cpmql', 'clickToLead', 'leadToMql', 'mqlToOpp', 'oppToWon', 'spend', 'leads', 'mqls'];
const SUMMABLE_KEYS = ['spend', 'clicks', 'leads', 'mqls', 'opportunitiesCreated', 'closedWonDeals', 'dealValue'];
const BUCKET_MS = 30 * 24 * 60 * 60 * 1000; // 30-day bucketing window

function toNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[$,%\s]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function median(arr) {
  const nums = arr.filter(n => n !== null && Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function derive(period) {
  const spend = toNum(period.spend);
  const clicks = toNum(period.clicks);
  const leads = toNum(period.leads);
  const mqls = toNum(period.mqls);
  const opps = toNum(period.opportunitiesCreated);
  const won = toNum(period.closedWonDeals);
  return {
    spend, clicks, leads, mqls, opps, won,
    cpl: (spend != null && leads) ? spend / leads : null,
    cpmql: (spend != null && mqls) ? spend / mqls : null,
    clickToLead: (leads != null && clicks) ? leads / clicks : null,
    leadToMql: (mqls != null && leads) ? mqls / leads : null,
    mqlToOpp: (opps != null && mqls) ? opps / mqls : null,
    oppToWon: (won != null && opps) ? won / opps : null,
  };
}

function pctDeviation(current, baseline) {
  if (current == null || baseline == null || baseline === 0) return null;
  return (current - baseline) / baseline;
}

// Sums raw counts across a set of rows that fall in the same 30-day bucket.
// Missing values are skipped (not treated as zero); a key stays null only if
// no row in the bucket had a value for it.
function sumRawRows(rawRows) {
  const summed = {};
  SUMMABLE_KEYS.forEach(k => {
    let total = null;
    rawRows.forEach(r => {
      const n = toNum(r[k]);
      if (n !== null) total = (total ?? 0) + n;
    });
    summed[k] = total;
  });
  summed.channel = rawRows[0] ? rawRows[0].channel : undefined;
  return summed;
}

// Groups periods by channel, parses each row's reporting date, and buckets
// each channel's rows into non-overlapping 30-day windows counted backward
// from that channel's latest parsed date. Bucket 0 = [latest - 30d, latest],
// bucket 1 = [latest - 60d, latest - 30d), and so on. A bucket with zero
// rows in it is never created (no zero-filled periods). Rows whose date
// can't be parsed are excluded and counted in `unparsedRowCount` rather than
// silently dropped without a trace.
export function bucketInto30DayWindows(periods) {
  const byChannel = {};
  (periods || []).forEach(p => {
    const ch = (p.channel || 'Other').trim() || 'Other';
    if (!byChannel[ch]) byChannel[ch] = { parsedRows: [], unparsedRowCount: 0, hasAmbiguousDates: false };
    const parsed = parseReportingDate(p.month);
    if (!parsed) {
      byChannel[ch].unparsedRowCount += 1;
      return;
    }
    if (!parsed.confident) byChannel[ch].hasAmbiguousDates = true;
    byChannel[ch].parsedRows.push({ raw: p, timestamp: parsed.timestamp });
  });

  const bucketed = {};
  Object.entries(byChannel).forEach(([ch, info]) => {
    const sortedRows = [...info.parsedRows].sort((a, b) => a.timestamp - b.timestamp);
    const rows = [];
    if (sortedRows.length) {
      const latestTs = sortedRows[sortedRows.length - 1].timestamp;
      const buckets = new Map(); // bucketIndex -> raw rows in that window
      sortedRows.forEach(r => {
        const age = latestTs - r.timestamp;
        // Subtracting 1ms before flooring puts an exact window boundary
        // (e.g. age === 90 days) into the earlier/more-recent bucket.
        const bucketIndex = Math.floor(Math.max(0, age - 1) / BUCKET_MS);
        if (!buckets.has(bucketIndex)) buckets.set(bucketIndex, []);
        buckets.get(bucketIndex).push(r.raw);
      });
      const orderedIndexes = Array.from(buckets.keys()).sort((a, b) => b - a); // oldest first
      orderedIndexes.forEach(idx => {
        const rawRows = buckets.get(idx);
        const summed = sumRawRows(rawRows);
        const windowStart = latestTs - (idx + 1) * BUCKET_MS;
        rows.push({ raw: summed, sortKey: windowStart, derived: derive(summed) });
      });
    }
    bucketed[ch] = {
      rows,
      unparsedRowCount: info.unparsedRowCount,
      hasAmbiguousDates: info.hasAmbiguousDates,
    };
  });

  return bucketed;
}

// Purely descriptive per-channel coverage: how many calendar days does this
// channel's data actually span, anchored to that channel's own most recent
// reporting date (not "today", and not a shared anchor across channels).
// Used by the input-step coverage chart and by the 90-day caveat below.
// Makes no judgment about whether the coverage is "enough", it just reports
// the fact; MIN_SPAN_DAYS-based interpretation happens where it's consumed.
export const MIN_SPAN_DAYS = 90;

export function computeChannelCoverage(periods) {
  const byChannel = {};
  (periods || []).forEach(p => {
    const ch = (p.channel || 'Other').trim() || 'Other';
    if (!byChannel[ch]) byChannel[ch] = { timestamps: [], rowCount: 0, unparsedCount: 0 };
    byChannel[ch].rowCount += 1;
    const parsed = parseReportingDate(p.month);
    if (!parsed) { byChannel[ch].unparsedCount += 1; return; }
    byChannel[ch].timestamps.push(parsed.timestamp);
  });

  const result = {};
  Object.entries(byChannel).forEach(([ch, info]) => {
    if (!info.timestamps.length) {
      result[ch] = { channel: ch, daysSpan: 0, rowCount: info.rowCount, unparsedCount: info.unparsedCount };
      return;
    }
    const earliest = Math.min(...info.timestamps);
    const latest = Math.max(...info.timestamps);
    const daysSpan = Math.round((latest - earliest) / (24 * 60 * 60 * 1000));
    result[ch] = { channel: ch, daysSpan, rowCount: info.rowCount, unparsedCount: info.unparsedCount };
  });
  return result;
}

// ---- Layer 2: baseline ----
export function buildBaseline(periods) {
  const bucketed = bucketInto30DayWindows(periods);
  const coverage = computeChannelCoverage(periods);

  const channels = {};
  Object.entries(bucketed).forEach(([ch, info]) => {
    const sorted = info.rows;
    const monthOrderReliable = info.unparsedRowCount === 0;
    const n = sorted.length;
    const latest = n ? sorted[n - 1] : null;

    // trailing-3 baseline = median of up-to-3 periods before latest
    const priorWindow = sorted.slice(Math.max(0, n - 4), n - 1); // up to 3 periods before latest
    const baseline = {};
    const deviations = {};
    if (latest && n >= MIN_PERIODS_FLAG) {
      METRIC_KEYS.forEach(k => { baseline[k] = median(priorWindow.map(r => r.derived[k])); });
      METRIC_KEYS.forEach(k => { deviations[k] = pctDeviation(latest.derived[k], baseline[k]); });
    }

    // marginal cpMQL: latest cpMQL vs median cpMQL of exactly the 3 prior periods
    let marginalCpmqlDeviation = null;
    if (n >= MIN_PERIODS_MARGINAL) {
      const prior3 = sorted.slice(n - 4, n - 1);
      const base = median(prior3.map(r => r.derived.cpmql));
      marginalCpmqlDeviation = pctDeviation(latest.derived.cpmql, base);
    }

    channels[ch] = {
      channel: ch,
      periodCount: n,
      monthOrderReliable,
      thinBaseline: n === MIN_PERIODS_FLAG,
      hasFlagBaseline: n >= MIN_PERIODS_FLAG,
      hasMarginalBaseline: n >= MIN_PERIODS_MARGINAL,
      rows: sorted,
      latest,
      baseline,
      deviations,
      marginalCpmqlDeviation,
      unparsedRowCount: info.unparsedRowCount,
      hasAmbiguousDates: info.hasAmbiguousDates,
      daysSpan: coverage[ch] ? coverage[ch].daysSpan : 0,
    };
  });

  return channels;
}

// ---- Metric formatting (shared by output text and chart labels) ----
export function formatMetricValue(value, metricKey) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  const currencyMetrics = new Set(['cpl', 'cpmql', 'spend', 'dealValue']);
  const percentMetrics = new Set(['clickToLead', 'leadToMql', 'mqlToOpp', 'oppToWon']);
  if (currencyMetrics.has(metricKey)) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (percentMetrics.has(metricKey)) {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ---- Layer 3: rules ----
// Each rule returns null OR { id, name, severity, triggerMath, plainLanguage, nextStep, benchmarkContext }
// `severity` is used only to rank which up-to-2 findings to surface.

const over = (dev, t = DEVIATION_THRESHOLD) => dev != null && Math.abs(dev) > t;
const pct = d => (d == null ? 'n/a' : `${(d * 100).toFixed(0)}%`);

function ruleAuctionPressure(c) {
  const d = c.deviations;
  if (!c.hasFlagBaseline) return null;
  if (over(d.cpl) && d.cpl > 0 && !over(d.leads)) {
    return {
      id: 'auction_pressure', name: 'Auction pressure / saturation', severity: Math.abs(d.cpl),
      channel: c.channel, primaryMetricKey: 'cpl',
      triggerMath: `${c.channel}: CPL is ${pct(d.cpl)} vs its trailing-3 median while lead volume is within 20% of baseline (${pct(d.leads)}).`,
      plainLanguage: `Rising cost per lead without a matching change in volume is consistent with auction pressure or audience saturation on ${c.channel}.`,
      nextStep: `Check whether impression share or CPCs on ${c.channel} rose over the same window, and whether the audience or geo pool has narrowed.`,
      benchmarkContext: null,
    };
  }
  return null;
}

function ruleVolumeQualityMismatch(c) {
  const d = c.deviations;
  if (!c.hasFlagBaseline) return null;
  // "holding" = click-to-lead is within the deviation band (not materially up or down),
  // while lead-to-MQL is down more than the threshold.
  if (d.clickToLead != null && d.leadToMql != null && !over(d.clickToLead) && over(d.leadToMql) && d.leadToMql < 0) {
    return {
      id: 'volume_quality', name: 'Volume-quality mismatch', severity: Math.abs(d.leadToMql),
      channel: c.channel, primaryMetricKey: 'leadToMql',
      triggerMath: `${c.channel}: click-to-lead is holding (${pct(d.clickToLead)} vs baseline) but lead-to-MQL is ${pct(d.leadToMql)} vs baseline.`,
      plainLanguage: `Leads are converting to MQLs at a lower rate than this channel's own history, which is consistent with looser lead quality or lower-intent traffic on ${c.channel}.`,
      nextStep: `Review the lead source and scoring for ${c.channel} against a period where lead-to-MQL was healthy. Confirm the MQL definition did not change.`,
      benchmarkContext: c.channel === 'Google Ads'
        ? 'For reference only, not a trigger: WordStream 2026 Google Ads Benchmarks (Business Services proxy) reports a 4.85% median conversion rate. Close the gap to your own baseline first; industry medians vary by segment and ACV.'
        : null,
    };
  }
  return null;
}

function ruleChannelRoleMismatch(c) {
  const d = c.deviations;
  if (!c.hasFlagBaseline) return null;
  const topStrong = d.clickToLead != null && d.clickToLead >= 0;
  const bottomWeak = (over(d.mqlToOpp) && d.mqlToOpp < 0) || (over(d.oppToWon) && d.oppToWon < 0);
  const highSpend = over(d.spend) && d.spend > 0;
  if (highSpend && topStrong && bottomWeak) {
    const worst = Math.min(d.mqlToOpp ?? 0, d.oppToWon ?? 0);
    const worstMetricKey = (d.mqlToOpp ?? 0) <= (d.oppToWon ?? 0) ? 'mqlToOpp' : 'oppToWon';
    return {
      id: 'channel_role', name: 'Channel role mismatch', severity: Math.abs(worst),
      channel: c.channel, primaryMetricKey: worstMetricKey,
      triggerMath: `${c.channel}: spend up ${pct(d.spend)} and top-funnel conversion holding, but bottom-funnel conversion is down (MQL-to-Opp ${pct(d.mqlToOpp)}, Opp-to-Won ${pct(d.oppToWon)}) vs baseline.`,
      plainLanguage: `Strong top-funnel and weak bottom-funnel on rising spend is consistent with ${c.channel} being pushed for cold acquisition when its strength may be warmer, later-funnel roles.`,
      nextStep: `Compare ${c.channel}'s bottom-funnel rates against its own best periods. Consider shifting some spend to retargeting or a warmer audience and re-measuring.`,
      benchmarkContext: c.channel === 'LinkedIn'
        ? 'For reference only, not a trigger: Dreamdata 2026 LinkedIn B2B benchmarks recommend judging LinkedIn on cost per company influenced rather than direct CPL. Vendor caveats apply.'
        : null,
    };
  }
  return null;
}

function ruleSignalStarvation(c) {
  if (!c.latest) return null;
  const usingMqls = c.latest.derived.mqls != null;
  const conv = usingMqls ? c.latest.derived.mqls : c.latest.derived.leads;
  if (conv != null && conv < SIGNAL_STARVATION_FLOOR) {
    return {
      id: 'signal_starvation', name: 'Signal starvation', severity: 1 + (SIGNAL_STARVATION_FLOOR - conv) / SIGNAL_STARVATION_FLOOR,
      channel: c.channel, primaryMetricKey: usingMqls ? 'mqls' : 'leads',
      triggerMath: `${c.channel}: latest period shows ${conv} conversions, below the 15/month floor smart bidding needs to optimize.`,
      plainLanguage: `Below roughly 15 conversions per month, smart bidding has too little signal to optimize reliably on ${c.channel}. This is consistent with erratic delivery and high cost variance.`,
      nextStep: `Consider consolidating campaigns or ad groups on ${c.channel} to pool conversions, or optimizing toward a higher-volume upper-funnel event, so the algorithm clears its learning threshold.`,
      benchmarkContext: 'Source: Google Ads Help Center. Google recommends at least 15 conversions in 30 days for smart bidding, and 30 to 50 per month for best results.',
    };
  }
  return null;
}

function ruleAttributionLeakage(channels) {
  // cross-channel: one channel's leadToMql disproportionately strong vs another disproportionately weak, same latest window
  const eligible = Object.values(channels).filter(c => c.hasFlagBaseline && c.deviations.leadToMql != null);
  if (eligible.length < 2) return null;
  const strong = eligible.filter(c => c.deviations.leadToMql > DEVIATION_THRESHOLD);
  const weak = eligible.filter(c => c.deviations.leadToMql < -DEVIATION_THRESHOLD);
  if (strong.length && weak.length) {
    const s = strong[0], w = weak[0];
    return {
      id: 'attribution_leakage', name: 'Possible attribution leakage', severity: Math.abs(s.deviations.leadToMql) + Math.abs(w.deviations.leadToMql),
      channel: s.channel, primaryMetricKey: 'leadToMql',
      triggerMath: `${s.channel} lead-to-MQL is up ${pct(s.deviations.leadToMql)} vs its baseline while ${w.channel} is down ${pct(w.deviations.leadToMql)} vs its baseline in the same window.`,
      plainLanguage: `One channel looking much stronger while another looks much weaker in the same window is consistent with a last-touch model crediting ${s.channel} for warm-up work done by ${w.channel}.`,
      nextStep: `Look at ${s.channel} and ${w.channel} under a multi-touch or time-decay view before reallocating. Confirm the shift is real and not a crediting artifact.`,
      benchmarkContext: null,
    };
  }
  return null;
}

function ruleMarginalCpmqlReallocate(c) {
  if (!c.hasMarginalBaseline) return null;
  if (over(c.marginalCpmqlDeviation) && c.marginalCpmqlDeviation > 0) {
    return {
      id: 'marginal_cpmql', name: 'Marginal cpMQL rising, reallocation candidate', severity: Math.abs(c.marginalCpmqlDeviation),
      channel: c.channel, primaryMetricKey: 'cpmql',
      triggerMath: `${c.channel}: marginal cpMQL is ${pct(c.marginalCpmqlDeviation)} above the median of the prior 3 periods.`,
      plainLanguage: `The incremental cost of the next MQL on ${c.channel} is rising faster than its recent history, which is consistent with diminishing returns at the current spend level.`,
      nextStep: `Test holding or trimming ${c.channel} spend and moving the increment to a channel with a lower marginal cpMQL, then re-measure over the next 3 periods.`,
      benchmarkContext: null,
    };
  }
  return null;
}

// Downstream-leak fallback fires only when nothing more specific did and MQLs are down on flat spend.
function ruleDownstreamLeakFallback(c) {
  const d = c.deviations;
  if (!c.hasFlagBaseline) return null;
  const mqlsDown = over(d.mqls) && d.mqls < 0;
  const spendFlat = d.spend == null || !over(d.spend);
  if (mqlsDown && spendFlat) {
    return {
      id: 'downstream_leak', name: 'Downstream funnel leak', severity: Math.abs(d.mqls) * 0.9, // slight deprioritize vs specific rules
      channel: c.channel, primaryMetricKey: 'mqls',
      triggerMath: `${c.channel}: MQLs down ${pct(d.mqls)} vs baseline while spend is roughly flat (${pct(d.spend)}).`,
      plainLanguage: `Fewer MQLs on steady spend, without a cleaner stage-specific pattern, points to a leak somewhere downstream of spend on ${c.channel}.`,
      nextStep: `Walk ${c.channel}'s stage-to-stage rates from click through MQL to find where the drop concentrates, then compare to a healthy period.`,
      benchmarkContext: null,
    };
  }
  return null;
}

export function runDiagnostics(periods, settings = {}) {
  const channels = buildBaseline(periods);
  const perChannelRules = [
    ruleAuctionPressure, ruleVolumeQualityMismatch, ruleChannelRoleMismatch,
    ruleSignalStarvation, ruleMarginalCpmqlReallocate,
  ];

  const findings = [];
  Object.values(channels).forEach(c => {
    const specific = [];
    perChannelRules.forEach(fn => { const r = fn(c); if (r) specific.push(r); });
    // fallback only if no specific per-channel rule fired for this channel
    if (!specific.length) { const fb = ruleDownstreamLeakFallback(c); if (fb) specific.push(fb); }
    findings.push(...specific);
  });

  const leak = ruleAttributionLeakage(channels);
  if (leak) findings.push(leak);

  findings.sort((a, b) => b.severity - a.severity);
  const top = findings.slice(0, 2); // up to 2, no padding

  // caveats
  const caveats = [];
  Object.values(channels).forEach(c => {
    if (c.unparsedRowCount > 0) {
      caveats.push(`${c.channel}: ${c.unparsedRowCount} row${c.unparsedRowCount === 1 ? '' : 's'} had an unparseable reporting date and ${c.unparsedRowCount === 1 ? 'was' : 'were'} excluded from the diagnosis.`);
    }
    if (c.hasAmbiguousDates) {
      caveats.push(`${c.channel}: some dates were ambiguous (e.g. 03/04/2026) and were read as MM/DD/YYYY. Confirm this matches your export format.`);
    }
    if (c.daysSpan < MIN_SPAN_DAYS) {
      caveats.push(`${c.channel}: data spans ${c.daysSpan} day${c.daysSpan === 1 ? '' : 's'}, short of the 90-day window this tool is built around. Treat any results for this channel as low-confidence until more history accrues.`);
    }
    if (c.periodCount < MIN_PERIODS_FLAG) caveats.push(`${c.channel}: not enough history (${c.periodCount} period${c.periodCount === 1 ? '' : 's'}) to establish a baseline. Minimum 3.`);
    else if (c.thinBaseline) caveats.push(`${c.channel}: baseline is thin (3 periods). Treat flags as low-confidence until more history accrues.`);
  });

  return { channels, findings: top, totalTriggered: findings.length, caveats };
}
