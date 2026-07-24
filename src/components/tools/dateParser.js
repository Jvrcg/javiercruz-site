// Reporting-date parser for the B2B Funnel Diagnostic Tool.
// Pure functions, no dependencies.
//
// Supported formats:
//   - "Jan 2026", "January 2026"        -> first of month (legacy month-only input)
//   - "2026-01"                         -> first of month (YYYY-MM, legacy)
//   - "01/2026"                         -> first of month (MM/YYYY, legacy)
//   - "2026-07-24"                      -> ISO calendar date (YYYY-MM-DD)
//   - "07/24/2026", "07-24-2026"        -> MM/DD/YYYY or MM-DD-YYYY
//   - "24/07/2026"                      -> DD/MM/YYYY (unambiguous when a segment is > 12)
//   - "7/4/26"                          -> 2-digit years are read as 2000 + YY
//   - "Jul 24, 2026", "24 Jul 2026"     -> written month + day + year
//
// Ordinal ambiguity: for a slash- or dash-delimited calendar date where BOTH
// segments before the year are <= 12 (e.g. "03/04/2026"), there is no way to
// tell from the string alone whether the format is MM/DD or DD/MM. This
// parser defaults to MM/DD/YYYY in that case and marks the result
// `confident: false` so callers can surface it as a caveat rather than
// silently assuming. When one segment is > 12 (e.g. "24/07/2026"), the order
// is unambiguous and `confident` is `true`.

const MONTH_NAMES = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7,
  september: 8, october: 9, november: 10, december: 11,
};

function toYear(raw) {
  const n = Number(raw);
  if (raw.length <= 2) return n < 50 ? 2000 + n : 1900 + n;
  return n;
}

function makeResult(year, monthIndex, day, confident) {
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, monthIndex, day));
  if (Number.isNaN(date.getTime())) return null;
  // Guard against JS date rollover for invalid days (e.g. Feb 30).
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthIndex || date.getUTCDate() !== day) return null;
  return { timestamp: date.getTime(), confident };
}

export function parseReportingDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;

  // Legacy: "Jan 2026", "January-2026" -> first of month
  let m = s.match(/^([a-z]+)[\s\-\/.]+(\d{4})$/);
  if (m && MONTH_NAMES[m[1]] !== undefined) {
    return makeResult(Number(m[2]), MONTH_NAMES[m[1]], 1, true);
  }

  // Legacy: "2026-01" -> YYYY-MM, first of month
  m = s.match(/^(\d{4})[\s\-\/.]+(\d{1,2})$/);
  if (m) {
    const monthIndex = Number(m[2]) - 1;
    if (monthIndex >= 0 && monthIndex <= 11) return makeResult(Number(m[1]), monthIndex, 1, true);
  }

  // Legacy: "01/2026" -> MM/YYYY, first of month
  m = s.match(/^(\d{1,2})[\s\-\/.]+(\d{4})$/);
  if (m) {
    const monthIndex = Number(m[1]) - 1;
    if (monthIndex >= 0 && monthIndex <= 11) return makeResult(Number(m[2]), monthIndex, 1, true);
  }

  // ISO calendar date: "2026-07-24"
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return makeResult(Number(m[1]), Number(m[2]) - 1, Number(m[3]), true);
  }

  // Written "Jul 24, 2026" / "Jul 24 2026"
  m = s.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && MONTH_NAMES[m[1]] !== undefined) {
    return makeResult(Number(m[3]), MONTH_NAMES[m[1]], Number(m[2]), true);
  }

  // Written "24 Jul 2026"
  m = s.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
  if (m && MONTH_NAMES[m[2]] !== undefined) {
    return makeResult(Number(m[3]), MONTH_NAMES[m[2]], Number(m[1]), true);
  }

  // Slash/dash calendar date: "07/24/2026", "24/07/2026", "07-24-2026", "7/4/26"
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = toYear(m[3]);
    const aValidMonth = a >= 1 && a <= 12;
    const bValidMonth = b >= 1 && b <= 12;
    if (!aValidMonth && !bValidMonth) return null;
    if (aValidMonth && !bValidMonth) {
      // Only "a" can be the month, so "b" must be the day.
      return makeResult(year, a - 1, b, true);
    }
    if (!aValidMonth && bValidMonth) {
      // Only "b" can be the month, so "a" must be the day.
      return makeResult(year, b - 1, a, true);
    }
    // Both segments are <= 12: genuinely ambiguous, default to MM/DD/YYYY.
    return makeResult(year, a - 1, b, false);
  }

  return null;
}
