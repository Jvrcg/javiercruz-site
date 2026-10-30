// Ad Pruning Tool: official campaign objective names per platform.
// Names are copied exactly as each platform writes them in its own docs (casing included).
// Aliases cover renamed objectives and API-style values. Matching runs through normKey, so
// casing, underscores, hyphens, extra spaces, punctuation and plural/singular differences all resolve
// (e.g. "LEAD_GENERATION", "lead  generation", "Lead Generation" -> "Lead generation").
// Values not found here are kept exactly as written in the file and flagged as not official.

export const PLATFORM_OBJECTIVES = {
  linkedin: {
    label: 'LinkedIn Ads',
    sources: [
      'https://business.linkedin.com/advertise/ads/how-to-advertise-on-linkedin',
      'https://www.linkedin.com/help/lms/answer/a424570',
      'https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting/ad-budget-pricing-type-combinations',
    ],
    objectives: [
      { name: 'Brand awareness', aliases: ['BRAND_AWARENESS'] },
      { name: 'Website visits', aliases: ['WEBSITE_VISIT'] },
      { name: 'Engagement', aliases: ['ENGAGEMENT'] },
      { name: 'Video views', aliases: [] },
      { name: 'Lead generation', aliases: ['LEAD_GENERATION'] },
      { name: 'Website conversions', aliases: ['WEBSITE_CONVERSION'] },
      { name: 'Job applicants', aliases: ['JOB_APPLICANT'] },
    ],
  },
  google: {
    label: 'Google Ads',
    sources: [
      'https://support.google.com/google-ads/answer/7450050',
      'https://support.google.com/google-ads/answer/10995481',
    ],
    objectives: [
      { name: 'Sales', aliases: [] },
      { name: 'Leads', aliases: [] },
      { name: 'Website traffic', aliases: [] },
      { name: 'App promotion', aliases: [] },
      // Google: "'Awareness and consideration' has been renamed to 'YouTube reach, views and engagements'" for new campaigns.
      // "Awareness and consideration" itself combined the older "Brand awareness and reach" and "Product and brand consideration".
      { name: 'YouTube reach, views and engagements', aliases: ['Awareness and consideration', 'Brand awareness and reach', 'Product and brand consideration'] },
      { name: 'Local store visits and promotions', aliases: ['Local store visits'] },
    ],
  },
  meta: {
    label: 'Meta Ads',
    sources: [
      'https://www.jonloomer.com/meta-campaign-objectives-best-practices/',
    ],
    objectives: [
      { name: 'Awareness', aliases: [] },
      { name: 'Traffic', aliases: [] },
      { name: 'Engagement', aliases: [] },
      { name: 'Leads', aliases: [] },
      { name: 'App promotion', aliases: [] },
      { name: 'Sales', aliases: [] },
    ],
  },
};

// Lowercase, turn _ and - into spaces, drop other punctuation, collapse spaces, and drop a trailing "s"
// from each word so singular and plural forms match ("WEBSITE_VISIT" -> "website visit" = "Website visits").
export function normKey(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .join(' ');
}

const INDEX = Object.fromEntries(Object.entries(PLATFORM_OBJECTIVES).map(([p, cfg]) => {
  const m = new Map();
  cfg.objectives.forEach(o => [o.name, ...o.aliases].forEach(a => m.set(normKey(a), o.name)));
  return [p, m];
}));

export const objectiveNames = platform => (PLATFORM_OBJECTIVES[platform]?.objectives || []).map(o => o.name);

// Returns { name, official }. Unknown values come back trimmed but otherwise exactly as written.
export function canonicalObjective(platform, raw) {
  const v = String(raw ?? '').trim();
  if (!v) return { name: '', official: false };
  const hit = INDEX[platform]?.get(normKey(v));
  return hit ? { name: hit, official: true } : { name: v, official: false };
}
