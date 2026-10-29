// Noise vs Signal: XmR math, kept free of React so it can be tested on its own.
//
// Method (Xmrit / Wheeler):
//   Moving range (mR) = |x[i] - x[i-1]|
//   Limits are computed from a locked baseline only (points B0 through B1 - 1).
//   Noise band = center +/- 2.66 x average mR of the baseline
//   Upper range limit = 3.268 x average mR of the baseline
//   Center = baseline average, or (growth on) a least-squares line fit to the baseline.
//     Baseline points outside the untrended limits are left out of the fit.
// Detection rules (Xmrit manual), checked only from the baseline start onward:
//   Rule 1 Process Limit Rule: a point outside the noise band, or an mR above the upper range limit.
//   Rule 2 Quartile Limit Rule: 3 of 4 successive points closer to the same limit than to the center.
//   Rule 3 Runs of Eight: 8 or more successive points on the same side of the center.
// Judgment calls (not from a source): a point exactly on a limit is not flagged; a point exactly
// on the center line ends a run; points before the baseline start are never flagged.

export const NPL = 2.66;
export const URL_K = 3.268;
export const MIN_POINTS = 6;
export const MIN_TREND_POINTS = 12;
export const DEFAULT_BASE = 20;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toNum = x => (x === undefined || x === '' ? NaN : Number(String(x).replace(/[$,%\s]/g, '')));

// CSV text -> { dates, values, lastYear (array or null), bad (1-based row numbers skipped) }
export function parseCsv(text) {
  const rows = String(text || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.split(/[,\t;]/).map(c => c.trim().replace(/^"|"$/g, '')));
  if (rows.length && !ISO.test(rows[0][0])) rows.shift();
  const dates = [], values = [], ly = [], bad = [];
  rows.forEach((r, i) => {
    const v = toNum(r[1]);
    if (!ISO.test(r[0]) || !Number.isFinite(v)) { bad.push(i + 1); return; }
    dates.push(r[0]);
    values.push(v);
    ly.push(toNum(r[2]));
  });
  const lastYear = ly.length && ly.every(Number.isFinite) ? ly : null;
  return { dates, values, lastYear, bad };
}

// Decimal places to display: match the data, capped at 2.
export function decimalsOf(values) {
  return Math.min(2, Math.max(0, ...values.map(x => {
    const t = String(x).split('.')[1];
    return t ? t.length : 0;
  })));
}

// Spacing between dates, used only for wording ("week" vs "day" vs "month").
export function unitOf(dates) {
  if (dates.length < 2) return 'point';
  const gaps = [];
  for (let i = 1; i < dates.length; i++) gaps.push((Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 86400000);
  gaps.sort((a, b) => a - b);
  const g = gaps[Math.floor(gaps.length / 2)];
  if (g >= 27) return 'month';
  if (g >= 6) return 'week';
  return 'day';
}

export function analyze(V, B0, B1, trend) {
  const n = V.length;
  const base = B1 - B0;
  const bv = V.slice(B0, B1);
  let s = 0;
  for (let i = 1; i < base; i++) s += Math.abs(bv[i] - bv[i - 1]);
  const mrb = s / (base - 1);
  const w = NPL * mrb;
  const url = URL_K * mrb;
  const m0 = bv.reduce((a, b) => a + b, 0) / base;

  let c, slope = 0;
  if (trend) {
    const keep = [];
    for (let i = B0; i < B1; i++) if (Math.abs(V[i] - m0) <= w) keep.push(i);
    const mx = keep.reduce((a, i) => a + i, 0) / keep.length;
    const my = keep.reduce((a, i) => a + V[i], 0) / keep.length;
    let num = 0, den = 0;
    keep.forEach(i => { num += (i - mx) * (V[i] - my); den += (i - mx) ** 2; });
    slope = den ? num / den : 0;
    const a = my - slope * mx;
    c = V.map((_, i) => a + slope * i);
  } else {
    c = V.map(() => m0);
  }

  const R = V.map(() => []);
  const add = (i, k) => { if (!R[i].includes(k)) R[i].push(k); };
  V.forEach((v, i) => { if (i >= B0 && Math.abs(v - c[i]) > w) add(i, 1); });
  for (let st = B0; st + 4 <= n; st++) {
    const ws = [st, st + 1, st + 2, st + 3];
    const hi = ws.filter(i => V[i] > c[i] + w / 2);
    const lo = ws.filter(i => V[i] < c[i] - w / 2);
    if (hi.length >= 3) hi.forEach(i => add(i, 2));
    if (lo.length >= 3) lo.forEach(i => add(i, 2));
  }
  let rs = B0, sd = 0;
  for (let i = B0; i <= n; i++) {
    const sg = i < n ? Math.sign(V[i] - c[i]) : 0;
    if (i < n && sg !== 0 && sg === sd) continue;
    if (sd !== 0 && i - rs >= 8) for (let k = rs; k < i; k++) add(k, 3);
    rs = i;
    sd = sg;
  }
  R.forEach(r => r.sort());
  const mr = V.map((v, i) => (i ? Math.abs(v - V[i - 1]) : null));
  // A big jump is not flagged when the point is only falling back inside the band right after a point outside it.
  // That jump is the spike ending, which Rule 1 already flagged. This skip is a judgment call, not a standard XmR rule.
  const mrHigh = mr.map((x, i) => x !== null && i > B0 && x > url && !(R[i - 1].includes(1) && !R[i].includes(1)));
  return { c, w, url, mrb, slope, R, mr, mrHigh };
}

export const topRule = r => (r.length ? Math.min(...r) : 0);

// Consecutive points tripping rule k on the same side of the center.
export function groupsOf(A, V, k) {
  const { R, c } = A;
  const n = V.length;
  const g = [];
  let i = 0;
  while (i < n) {
    if (!R[i].includes(k)) { i++; continue; }
    let j = i;
    while (j + 1 < n && R[j + 1].includes(k) && Math.sign(V[j + 1] - c[j + 1]) === Math.sign(V[i] - c[i])) j++;
    g.push([i, j]);
    i = j + 1;
  }
  return g;
}

// Nudge: growth off, and upward Runs of Eight cover at least half the points after the baseline.
// The one-half cutoff is a judgment call.
export function shouldNudge(A, V, B1, trend) {
  const n = V.length;
  if (trend || n <= B1) return false;
  let up = 0;
  for (let i = B1; i < n; i++) if (A.R[i].includes(3) && V[i] > A.c[i]) up++;
  return up >= (n - B1) / 2;
}
