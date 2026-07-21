// Layer 2 (baseline engine) + Layer 3 (rules engine) for the B2B Funnel Diagnostic Tool.
// Pure functions. Consumes the `periods` array emitted by FunnelDiagnosticInput.

export const DEVIATION_THRESHOLD = 0.20;   // 20% off trailing-3 baseline
export const MIN_PERIODS_FLAG = 3;         // deviation flags
export const MIN_PERIODS_MARGINAL = 4;     // marginal cpMQL (3 to build baseline + 1 to compare)
export const SIGNAL_STARVATION_FLOOR = 15; // conversions/month (Google Ads Help Center)

const METRIC_KEYS = ['cpl', 'cpmql', 'clickToLead', 'leadToMql', 'mqlToOpp', 'oppToWon', 'spend', 'leads', 'mqls'];

const MONTH_NAMES = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7,
  september: 8, october: 9, november: 10, december: 11,
};

function toNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[$,%\s]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Returns a sortable integer (year*12 + monthIndex) or null if unparseable.
export function parseMonthKey(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  let m = s.match(/^([a-z]+)[\s\-\/.]+(\d{4})$/);       // "Jan 2026", "January-2026"
  if (m && MONTH_NAMES[m[1]] !== undefined) return Number(m[2]) * 12 + MONTH_NAMES[m[1]];
  m = s.match(/^(\d{4})[\s\-\/.]+(\d{1,2})$/);           // "2026-01"
  if (m) return Number(m[1]) * 12 + (Number(m[2]) - 1);
  m = s.match(/^(\d{1,2})[\s\-\/.]+(\d{4})$/);           // "01/2026"
  if (m) return Number(m[2]) * 12 + (Number(m[1]) - 1);
  return null;
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

// ---- Layer 2: baseline ----
export function buildBaseline(periods) {
  const byChannel = {};
  (periods || []).forEach(p => {
    const ch = (p.channel || 'Other').trim() || 'Other';
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push({ raw: p, sortKey: parseMonthKey(p.month), derived: derive(p) });
  });

  const channels = {};
  Object.entries(byChannel).forEach(([ch, rows]) => {
    const monthOrderReliable = rows.every(r => r.sortKey !== null);
    const sorted = monthOrderReliable ? [...rows].sort((a, b) => a.sortKey - b.sortKey) : rows;
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
    };
  });

  return channels;
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
    return {
      id: 'channel_role', name: 'Channel role mismatch', severity: Math.abs(worst),
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
  const conv = c.latest.derived.mqls != null ? c.latest.derived.mqls : c.latest.derived.leads;
  if (conv != null && conv < SIGNAL_STARVATION_FLOOR) {
    return {
      id: 'signal_starvation', name: 'Signal starvation', severity: 1 + (SIGNAL_STARVATION_FLOOR - conv) / SIGNAL_STARVATION_FLOOR,
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
    if (!c.monthOrderReliable) caveats.push(`${c.channel}: month values could not all be parsed, so chronological order was not verified. Results assume entry order.`);
    if (c.periodCount < MIN_PERIODS_FLAG) caveats.push(`${c.channel}: not enough history (${c.periodCount} period${c.periodCount === 1 ? '' : 's'}) to establish a baseline. Minimum 3.`);
    else if (c.thinBaseline) caveats.push(`${c.channel}: baseline is thin (3 periods). Treat flags as low-confidence until more history accrues.`);
  });

  return { channels, findings: top, totalTriggered: findings.length, caveats };
}
