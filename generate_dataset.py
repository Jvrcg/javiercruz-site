"""
generate_dataset.py
Generates a mock B2B SaaS paid media dataset for Syncflow.
Outputs: data/prospects.json, data/prospects.csv, data/attribution_results.json

ARCHITECTURE NOTE: this is target-first, not forward-simulated. Annual
MQL/PQL/pipeline goals and monthly attainment curves (seasonality.py) are
inputs. Prospects are generated as the mechanism that satisfies those
monthly targets, rather than emerging from independent per-prospect random
draws whose aggregate is measured afterward. Record-level statistical
independence is intentionally not modeled — see seasonality.py and the
Sources tab note in generate_template.py.
"""

import random
import json
import csv
import os
import shutil
import calendar
from datetime import datetime, timedelta

from seasonality import (
    SEASONALITY_INDEX, SEASONALITY_INDEX_MAP, FISCAL_MONTHS, FISCAL_MONTH_NAMES,
    ANNUAL_MQL_GOAL, ANNUAL_PQL_GOAL, ANNUAL_PIPELINE_GOAL,
    ATTAINMENT_MQL, ATTAINMENT_PQL, ATTAINMENT_PIPELINE, monthly_targets,
)

random.seed(42)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SENIORITY_TIERS = [
    ("c_suite_vp", 0.12, 1.5, [
        "Chief Data Officer", "VP of Analytics", "VP of Data Engineering",
        "VP of Data", "Chief Analytics Officer",
    ]),
    ("director", 0.23, 1.25, [
        "Director of Data Engineering", "Director of Analytics",
        "Director of Business Intelligence", "Director of Data",
    ]),
    ("manager", 0.35, 1.0, [
        "Data Engineering Manager", "Analytics Manager",
        "BI Manager", "Data Platform Manager",
    ]),
    ("ic_analyst", 0.30, 0.75, [
        "Data Engineer", "Analytics Engineer",
        "Data Analyst", "BI Analyst", "Senior Data Engineer",
    ]),
]

# Base sales-cycle days by seniority tier.
SENIORITY_CYCLE_DAYS = {
    "c_suite_vp": 70,
    "director": 55,
    "manager": 45,
    "ic_analyst": 30,
}

COMPANIES = [
    "Syncflow", "Pipeform", "Streamlink", "Nexlayer", "Dataduct",
    "Conduitly", "Prismware", "Vaultbase", "Stackbridge", "Queryspan",
    "Cloudnetic", "Datavera", "Pulsestream", "Gridlane", "Helix Analytics",
    "Ironset", "Luminary Data", "Axiom Cloud", "Crestline Systems", "Novabridge",
    "Tangent Labs", "Ember Analytics", "Solaris Data", "Apex Workflows",
    "Beacon Platforms", "Meridian Cloud", "Onyx Intelligence", "Stratum Data",
    "Catalyst Systems", "Horizon Analytics",
]

FIRST_NAMES = [
    "Alex", "Jordan", "Morgan", "Taylor", "Casey", "Riley", "Avery", "Quinn",
    "Drew", "Cameron", "Blake", "Skyler", "Peyton", "Reese", "Dana", "Jamie",
    "Logan", "Rowan", "Finley", "Harper", "Elliot", "Sage", "Emery", "Phoenix",
    "Noel", "Hayden", "Parker", "Kendall", "Spencer", "Indigo",
]

LAST_NAMES = [
    "Chen", "Patel", "Kim", "Nguyen", "Rodriguez", "Johnson", "Williams",
    "Smith", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson",
    "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia",
    "Martinez", "Robinson", "Clark", "Lewis", "Lee", "Walker", "Hall", "Allen",
]

CAMPAIGNS = {
    "linkedin": [
        "LI-ENT-Awareness-DataPipeline",
        "LI-ENT-Awareness-DataIntegration",
        "LI-MOFU-Demo-DataEngineers",
        "LI-MOFU-Trial-AnalyticsTeams",
        "LI-Retarget-SiteVisitors-30d",
        "LI-Retarget-PricingPage-14d",
        "LI-ABM-Strategic-ENT",
    ],
    "google": [
        "GGL-Brand-Syncflow-Exact",
        "GGL-NonBrand-ETL-Tools",
        "GGL-NonBrand-DataPipeline",
        "GGL-Competitor-Pipeform-Alt",
        "GGL-Competitor-Streamlink-Alt",
        "GGL-RLSA-HighIntent-Visitors",
    ],
    "g2": [
        "G2-GridReport-ETL-Gated",
        "G2-Badge-LP-Integration",
        "G2-Retarget-CategoryBuyers",
    ],
    "programmatic": [
        "DSP-ABM-AirCover-Strategic",
        "DSP-ABM-AirCover-Commercial",
        "DSP-Retarget-HighIntent-14d",
        "DSP-Awareness-DataEngineers",
    ],
}

UTM = {
    "linkedin": {
        "utm_source": "linkedin",
        "utm_medium": "paid-social",
        "utm_content_options": [
            "single-image_pain-point_cta-demo",
            "single-image_pain-point_cta-trial",
            "single-image_social-proof_cta-demo",
            "single-image_social-proof_cta-learn-more",
            "single-image_thought-leadership_cta-download",
            "single-image_thought-leadership_cta-learn-more",
            "single-image_product-feature_cta-demo",
            "single-image_product-feature_cta-trial",
        ],
        "utm_term_options": [
            "li-ent-data-engineers",
            "li-mid-analytics-directors",
            "li-retarget-site-visitors-30d",
            "li-lookalike-closed-won",
            "li-abm-strategic-accounts",
        ],
    },
    "google": {
        "utm_source": "google",
        "utm_medium": "paid-search",
        "utm_content_options": [
            "text-ad_search",
            "text-ad_rlsa",
            "text-ad_competitor",
        ],
        "utm_term_options": [
            "etl-software",
            "data-pipeline-tools",
            "syncflow-alternative",
            "data-integration-platform",
            "pipeform-alternative",
            "streamlink-vs-syncflow",
        ],
    },
    "g2": {
        "utm_source": "g2",
        "utm_medium": "review-site",
        "utm_content_options": [
            "gated-report_etl",
            "badge-display_integration",
            "retarget-banner_category",
        ],
        "utm_term_options": [
            "etl-tools-comparison",
            "data-integration-review",
            "pipeline-software-evaluation",
        ],
    },
    "programmatic": {
        "utm_source": "stackadapt",
        "utm_medium": "display",
        "utm_content_options": [
            "display-banner_abm",
            "display-banner_retarget",
            "display-banner_awareness",
        ],
        "utm_term_options": [
            "abm-strategic-accounts",
            "retarget-site-visitors-14d",
            "lookalike-data-engineers",
        ],
    },
}


def campaign_to_channel(campaign_name):
    if campaign_name.startswith("LI-"):
        return "linkedin"
    if campaign_name.startswith("GGL-"):
        return "google"
    if campaign_name.startswith("G2-"):
        return "g2"
    return "programmatic"

# Primary channel (touch 1) distribution — unchanged proportions from the
# original fixed counts (5200/4000/140/38 out of 9378), scaled to the pool.
PRIMARY_CHANNEL_PROPORTIONS = {
    "linkedin": 5200 / 9378,
    "google": 4000 / 9378,
    "g2": 140 / 9378,
    "programmatic": 38 / 9378,
}

LI_RETARGET_CAMPAIGNS = [
    "LI-Retarget-SiteVisitors-30d",
    "LI-Retarget-PricingPage-14d",
]

# Filler (non-qualifying) form types only — demo_request/trial_signup are
# never drawn randomly; they're deliberately placed by the target-month
# allocation so accidental qualification never happens on a filler touch.
FILLER_FORM_TYPES = ["gated_content_download", "newsletter_signup"]
FILLER_FORM_WEIGHTS = [0.45 / 0.70, 0.25 / 0.70]

SUPPRESSED_CHANNELS = {"linkedin", "google", "g2"}

# Conversion economics by lead_type. to_sql/sql_to_won are now proportions
# the generated population conforms to (exact quotas), not per-prospect
# draws. cycle_days_add is added to the seniority-based cycle base. deal_index
# is an independent axis from seniority_mult (lead-type deal size, not
# seniority-based deal size) and combines multiplicatively with it when
# splitting a month's pipeline target across that month's opportunities.
LEAD_TYPE_CONVERSION = {
    "demo":    {"to_sql": 0.32, "sql_to_won": 0.22, "cycle_days_add": 55, "deal_index": 1.00},
    "trial":   {"to_sql": 0.18, "sql_to_won": 0.16, "cycle_days_add": 75, "deal_index": 0.75},
    "both":    {"to_sql": 0.42, "sql_to_won": 0.26, "cycle_days_add": 45, "deal_index": 1.15},
    "neither": {"to_sql": 0.08, "sql_to_won": 0.12, "cycle_days_add": 65, "deal_index": 0.85},
}

# Existing lead_type mix (realized proportions from the prior forward-simulated
# run) used only to derive the both-segment overlap floor and the neither
# share — per Decision 3, 9.9% is a floor, not a fixed ratio.
EXISTING_MIX = {"demo": 0.157, "trial": 0.374, "both": 0.099, "neither": 0.370}
BOTH_OVERLAP_FLOOR = EXISTING_MIX["both"]  # 9.9% of ANNUAL_MQL_GOAL, floor

# Kept in sync with generate_template.py's ANNUAL_SPEND — duplicated here
# only so this script's verification report can print CPL/ROAS/cpMQL
# without importing the template generator.
ANNUAL_SPEND = {
    "linkedin": 574000,
    "google": 574000,
    "g2": 112000,
    "programmatic": 140000,
}

# Job function, derived from title. Existing fields only — no new generation.
JOB_FUNCTION_TITLES = {
    "Data Engineering": [
        "Data Engineer", "Senior Data Engineer", "Data Engineering Manager",
        "Director of Data Engineering", "VP of Data Engineering",
    ],
    "Analytics and BI": [
        "Data Analyst", "BI Analyst", "Analytics Engineer", "Analytics Manager",
        "BI Manager", "Director of Analytics", "Director of Business Intelligence",
        "VP of Analytics", "Chief Analytics Officer",
    ],
    "Data Platform and Governance": [
        "Data Platform Manager", "Director of Data", "VP of Data", "Chief Data Officer",
    ],
}
TITLE_TO_FUNCTION = {
    title: func for func, titles in JOB_FUNCTION_TITLES.items() for title in titles
}

# Prior-year MQL series: a stated modeling choice (18% YoY growth), not a
# benchmark. Only used to draw the Pacing & Goals projection line.
PRIOR_YEAR_GROWTH = 0.18

# ---------------------------------------------------------------------------
# Time windows
# ---------------------------------------------------------------------------

SEEDING_START = (2024, 10)
SEEDING_END = (2025, 12)
RUNWAY_END = datetime(2026, 2, 28, 18, 0, 0)

SEED_SLOTS = [
    (2024, 10), (2024, 11), (2024, 12),
    (2025, 1), (2025, 2), (2025, 3), (2025, 4), (2025, 5), (2025, 6),
    (2025, 7), (2025, 8), (2025, 9), (2025, 10), (2025, 11), (2025, 12),
]

MONTH_ORDER = [m for m, _ in SEASONALITY_INDEX]

LAG_SHARES = {0: 0.50, 1: 0.35, 2: 0.15}


def is_valid_seed_month(y, m):
    return SEEDING_START <= (y, m) <= SEEDING_END


def add_months(year, month, delta):
    total = (year * 12 + (month - 1)) + delta
    return total // 12, total % 12 + 1


def compute_reachable_fraction():
    """Fraction of total 15-slot seeding weight that is actually reachable by
    some fiscal target month's 0-2 month lag window. Oct/Nov 2024 are seeded
    (warm-up) but too far before the fiscal window to ever be drawn — their
    qualifying events, if any, land in their own (out-of-window) month
    instead, same as the old forward-simulated architecture's spillover."""
    raw_weights = {(y, m): SEASONALITY_INDEX_MAP[MONTH_ORDER[m - 1]] for (y, m) in SEED_SLOTS}
    reachable = set()
    for (ty, tm) in FISCAL_MONTHS:
        for lag in (0, 1, 2):
            sy, sm = add_months(ty, tm, -lag)
            if is_valid_seed_month(sy, sm):
                reachable.add((sy, sm))
    total_weight = sum(raw_weights.values())
    reachable_weight = sum(w for month, w in raw_weights.items() if month in reachable)
    return reachable_weight / total_weight


# ---------------------------------------------------------------------------
# Helpers (unchanged mechanics)
# ---------------------------------------------------------------------------


def random_month_datetime(year, month):
    last_day = calendar.monthrange(year, month)[1]
    while True:
        day = random.randint(1, last_day)
        candidate = datetime(year, month, day)
        if candidate.weekday() < 5:
            break
    hour = random.randint(8, 17)
    minute = random.randint(0, 59)
    return candidate.replace(hour=hour, minute=minute, second=0, microsecond=0)


def random_business_datetime(after: datetime) -> datetime:
    days_ahead = random.randint(7, 21)
    candidate = after + timedelta(days=days_ahead)
    weekday = candidate.weekday()
    if weekday == 5:
        candidate += timedelta(days=2)
    elif weekday == 6:
        candidate += timedelta(days=1)
    if candidate > RUNWAY_END:
        candidate = RUNWAY_END
    hour = random.randint(8, 17)
    minute = random.randint(0, 59)
    return candidate.replace(hour=hour, minute=minute, second=0, microsecond=0)


def pick_weighted(options, weights):
    r = random.random()
    cumulative = 0.0
    for opt, w in zip(options, weights):
        cumulative += w
        if r < cumulative:
            return opt
    return options[-1]


def pick_seniority():
    r = random.random()
    cumulative = 0.0
    for name, prob, mult, titles in SENIORITY_TIERS:
        cumulative += prob
        if r < cumulative:
            return name, mult, random.choice(titles)
    last = SENIORITY_TIERS[-1]
    return last[0], last[2], random.choice(last[3])


def pick_channel_for_touch(touch_number, num_touches, primary_channel=None):
    if touch_number == 1:
        return primary_channel
    if touch_number == 2:
        all_channels = ["linkedin", "google", "g2", "programmatic"]
        weights = [0.30, 0.30, 0.20, 0.20]
        return pick_weighted(all_channels, weights)
    if touch_number == 3:
        r = random.random()
        if r < 0.30:
            return "g2"
        elif r < 0.70:
            return "linkedin"
        else:
            return random.choice(["google", "programmatic"])
    r = random.random()
    if r < 0.40:
        return "google"
    elif r < 0.70:
        return "g2"
    else:
        return random.choice(["linkedin", "programmatic"])


def build_touch(touch_number, num_touches, timestamp, form_type, primary_channel=None):
    channel = pick_channel_for_touch(touch_number, num_touches, primary_channel)

    if touch_number == 3 and channel == "linkedin":
        campaign = random.choice(LI_RETARGET_CAMPAIGNS)
    elif touch_number == 4 and channel == "google":
        campaign = random.choice(["GGL-Brand-Syncflow-Exact", "GGL-RLSA-HighIntent-Visitors"])
    else:
        campaign = random.choice(CAMPAIGNS[channel])

    utm = UTM[channel]
    utm_content = random.choice(utm["utm_content_options"])
    utm_term    = random.choice(utm["utm_term_options"])

    return {
        "touch_number": touch_number,
        "channel": channel,
        "campaign_name": campaign,
        "utm_source": utm["utm_source"],
        "utm_medium": utm["utm_medium"],
        "utm_campaign": campaign.lower().replace("-", "_"),
        "utm_content": utm_content,
        "utm_term": utm_term,
        "timestamp": timestamp.isoformat(),
        "form_type": form_type,
    }


# ---------------------------------------------------------------------------
# Phase 1: seeding (first-touch month follows SEASONALITY_INDEX, unchanged)
# ---------------------------------------------------------------------------


def compute_seed_slot_counts(total_pool):
    raw_weights = [SEASONALITY_INDEX_MAP[MONTH_ORDER[month - 1]] for (_, month) in SEED_SLOTS]
    weight_sum = sum(raw_weights)
    counts = []
    for (year, month), w in zip(SEED_SLOTS, raw_weights):
        base = total_pool * (w / weight_sum)
        variance = 1 + random.uniform(-0.10, 0.10)
        counts.append((year, month, max(1, round(base * variance))))
    return counts


def build_primary_channel_list(total):
    counts = {ch: round(total * p) for ch, p in PRIMARY_CHANNEL_PROPORTIONS.items()}
    drift = total - sum(counts.values())
    counts["linkedin"] += drift
    channels = []
    for ch, n in counts.items():
        channels.extend([ch] * n)
    random.shuffle(channels)
    return channels


def compute_pool_composition():
    """Derive lead_type totals from the annual MQL/PQL goals (weighted by
    their attainment curves) plus the existing-mix overlap floor. Returns
    a dict of counts and the two monthly-target dicts."""
    mql_targets = monthly_targets(ANNUAL_MQL_GOAL, ATTAINMENT_MQL)
    pql_targets = monthly_targets(ANNUAL_PQL_GOAL, ATTAINMENT_PQL)
    mql_total = round(sum(mql_targets.values()))
    pql_total = round(sum(pql_targets.values()))

    # Inflate the qualifying pools so that, after the unreachable Oct/Nov 2024
    # warm-up slice is excluded, the RE­ACHABLE supply still covers the fiscal
    # monthly targets (see compute_reachable_fraction).
    reachable_fraction = compute_reachable_fraction()
    mql_supply_needed = round(mql_total / reachable_fraction)
    pql_supply_needed = round(pql_total / reachable_fraction)

    both_count = round(BOTH_OVERLAP_FLOOR * mql_supply_needed)
    demo_count = mql_supply_needed - both_count
    trial_count = pql_supply_needed - both_count

    conflict = None
    if trial_count < 0 or demo_count < 0:
        conflict = (
            f"Overlap floor ({both_count}) exceeds MQL total ({mql_total}) or PQL total "
            f"({pql_total}) — cannot derive non-negative demo/trial-only counts."
        )

    qualifying_total = demo_count + trial_count + both_count
    neither_ratio = EXISTING_MIX["neither"] / (1 - EXISTING_MIX["both"])
    neither_count = round(neither_ratio * qualifying_total)
    total_pool = qualifying_total + neither_count

    return {
        "mql_targets": mql_targets,
        "pql_targets": pql_targets,
        "mql_total": mql_total,
        "pql_total": pql_total,
        "demo_count": demo_count,
        "trial_count": trial_count,
        "both_count": both_count,
        "neither_count": neither_count,
        "total_pool": total_pool,
        "conflict": conflict,
    }


# ---------------------------------------------------------------------------
# Phase 2: lead_type assignment, stratified per seed-month cohort
# ---------------------------------------------------------------------------


def assign_lead_types(prospects_by_month, composition):
    total_pool = composition["total_pool"]
    fracs = {
        "demo": composition["demo_count"] / total_pool,
        "trial": composition["trial_count"] / total_pool,
        "both": composition["both_count"] / total_pool,
        "neither": composition["neither_count"] / total_pool,
    }
    for month, cohort in prospects_by_month.items():
        random.shuffle(cohort)
        n = len(cohort)
        counts = {lt: round(n * f) for lt, f in fracs.items()}
        drift = n - sum(counts.values())
        counts["neither"] += drift
        i = 0
        for lt in ("demo", "trial", "both", "neither"):
            for _ in range(counts[lt]):
                if i >= n:
                    break
                cohort[i]["lead_type"] = lt
                i += 1


# ---------------------------------------------------------------------------
# Phase 3: target-month allocation via lag-window sourcing
# ---------------------------------------------------------------------------


def allocate_target_months(pool_by_month, targets_by_month, field_name):
    """Fill each fiscal month's quota for `field_name` (mql_target_month or
    pql_target_month) by drawing from seed cohorts 0/1/2 months earlier
    (50/35/15 split, renormalized at the seeding-window boundary). If one
    lag source for a target month comes up short, the shortfall is first
    covered by surplus in the OTHER valid lag sources for that same target
    month before it's recorded as a genuine conflict. Mutates prospect
    dicts in place; returns a list of shortfall records."""
    shortfalls = []
    for (ty, tm) in FISCAL_MONTHS:
        target_count = round(targets_by_month[(ty, tm)])
        valid_lags = []
        for lag in (0, 1, 2):
            sy, sm = add_months(ty, tm, -lag)
            if is_valid_seed_month(sy, sm):
                valid_lags.append((lag, sy, sm))
        # Weight each valid lag by its nominal share AND the source month's
        # own seasonality index (a proxy for how much supply it actually
        # has). Plain lag-share renormalization at a window boundary (e.g.
        # January 2026, which has no lag-0 option) would otherwise dump a
        # disproportionate load onto whichever remaining source happens to
        # have the smallest natural cohort (December, index .040) — this
        # keeps the burden proportional to actual supply instead.
        source_weights = {
            (lag, sy, sm): LAG_SHARES[lag] * SEASONALITY_INDEX_MAP[MONTH_ORDER[sm - 1]]
            for lag, sy, sm in valid_lags
        }
        total_share = sum(source_weights.values())

        draws = {}
        for key, w in source_weights.items():
            draws[key] = round(target_count * w / total_share)

        # Each source month is drawn strictly up to its nominal share here —
        # no over-drawing from one lag source to cover another's shortfall
        # within this same target month. That kind of local redistribution
        # is greedy under sequential (chronological) processing: an earlier
        # month would raid its own lag-0 pool beyond its fair share to patch
        # itself, draining supply that later months still need via lag-1/2
        # (this is exactly what starved January to zero on the first pass).
        # A genuine shortfall here is reported, not silently patched.
        shortfall_total = 0
        for key in draws:
            lag, sy, sm = key
            available = pool_by_month.get((sy, sm), [])
            take = min(draws[key], len(available))
            for _ in range(take):
                p = available.pop()
                p[field_name] = (ty, tm)
            shortfall_total += draws[key] - take

        if shortfall_total > 0:
            shortfalls.append({
                "target_month": (ty, tm), "needed": target_count, "short_by": shortfall_total,
            })

    # Second pass: backfill remaining shortfalls from genuinely UNCLAIMED
    # leftover supply only — pools no month's round-1 nominal share touched.
    # This can't reproduce the earlier bug (raiding a pool another month's
    # own lag-window draw still needed), because round 1 already ran to
    # completion for every month before this pass starts.
    backfilled = 0
    for s in shortfalls:
        if s["short_by"] <= 0:
            continue
        ty, tm = s["target_month"]
        candidates = sorted(
            pool_by_month.keys(),
            key=lambda sm: abs((sm[0] * 12 + sm[1]) - (ty * 12 + tm)),
        )
        for sy, sm in candidates:
            if s["short_by"] <= 0:
                break
            available = pool_by_month.get((sy, sm), [])
            take = min(s["short_by"], len(available))
            for _ in range(take):
                p = available.pop()
                p[field_name] = (ty, tm)
            s["short_by"] -= take
            backfilled += take

    shortfalls = [s for s in shortfalls if s["short_by"] > 0]

    leftover_count = 0
    for month, lst in pool_by_month.items():
        for p in lst:
            leftover_count += 1
            # Unreachable by any fiscal target month (e.g. Oct/Nov 2024
            # warm-up, or true structural surplus after backfill) — qualify
            # in their own seed month instead, which naturally falls outside
            # the fiscal MQL/PQL counts, same as the old forward-simulated
            # architecture's spillover behavior.
            p[field_name] = p["seed_month"]
        lst.clear()

    return shortfalls, leftover_count


# ---------------------------------------------------------------------------
# Phase 4: touch construction from assigned qualifying events
# ---------------------------------------------------------------------------


def resolve_qualifying_date(target_month, seed_month, first_touch_dt):
    ty, tm = target_month
    if target_month == seed_month:
        candidate = random_month_datetime(ty, tm)
        if candidate < first_touch_dt:
            candidate = first_touch_dt
        return candidate
    return random_month_datetime(ty, tm)


def build_prospect_touches(p, primary_channel):
    first_touch_dt = p["first_touch_dt"]
    anchors = {}  # isoformat -> form_type
    anchors[first_touch_dt.isoformat()] = None

    mql_dt = None
    pql_dt = None
    if p.get("mql_target_month"):
        mql_dt = resolve_qualifying_date(p["mql_target_month"], p["seed_month"], first_touch_dt)
        anchors[mql_dt.isoformat()] = "demo_request"
    if p.get("pql_target_month"):
        pql_dt = resolve_qualifying_date(p["pql_target_month"], p["seed_month"], first_touch_dt)
        anchors[pql_dt.isoformat()] = "trial_signup"

    if p["lead_type"] == "both":
        touch_count = pick_weighted([3, 4], [0.45 / 0.70, 0.25 / 0.70])
    else:
        touch_count = pick_weighted([2, 3, 4], [0.30, 0.45, 0.25])
    touch_count = max(touch_count, len(anchors))

    remaining = touch_count - len(anchors)
    if remaining > 0:
        latest = max(datetime.fromisoformat(k) for k in anchors)
        ts = latest
        for _ in range(remaining):
            ts = random_business_datetime(ts)
            key = ts.isoformat()
            while key in anchors:
                ts = random_business_datetime(ts)
                key = ts.isoformat()
            form_type = pick_weighted(FILLER_FORM_TYPES, FILLER_FORM_WEIGHTS)
            anchors[key] = form_type

    for key in anchors:
        if anchors[key] is None:
            anchors[key] = pick_weighted(FILLER_FORM_TYPES, FILLER_FORM_WEIGHTS)

    ordered = sorted(anchors.items(), key=lambda kv: kv[0])
    n = len(ordered)
    touches = []
    for i, (ts_str, form_type) in enumerate(ordered, start=1):
        ts = datetime.fromisoformat(ts_str)
        touches.append(build_touch(i, n, ts, form_type, primary_channel))

    return touches, mql_dt, pql_dt


# ---------------------------------------------------------------------------
# Generation orchestration
# ---------------------------------------------------------------------------


def generate_prospects():
    composition = compute_pool_composition()
    if composition["conflict"]:
        print("\n*** CONSTRAINT CONFLICT — STOPPING ***")
        print(composition["conflict"])
        return None, composition

    slot_counts = compute_seed_slot_counts(composition["total_pool"])
    actual_total = sum(c for _, _, c in slot_counts)
    primary_channels = build_primary_channel_list(actual_total)

    # --- Step 1: seed prospects (base attributes + first-touch month) ---
    prospects_by_month = {}
    counter = 0
    idx = 0
    for (year, month, count) in slot_counts:
        cohort = []
        for _ in range(count):
            counter += 1
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            seniority_tier, seniority_mult, title = pick_seniority()
            p = {
                "prospect_id": f"PRO-{counter:05d}",
                "full_name": f"{first} {last}",
                "title": title,
                "seniority_tier": seniority_tier,
                "seniority_mult": seniority_mult,
                "company": random.choice(COMPANIES),
                "primary_channel": primary_channels[idx],
                "seed_month": (year, month),
                "first_touch_dt": random_month_datetime(year, month),
            }
            idx += 1
            cohort.append(p)
        prospects_by_month[(year, month)] = cohort

    all_prospects = [p for cohort in prospects_by_month.values() for p in cohort]
    print(f"Seeded {len(all_prospects):,} prospects across {len(slot_counts)} month slots "
          f"(pool composition: demo={composition['demo_count']:,} trial={composition['trial_count']:,} "
          f"both={composition['both_count']:,} neither={composition['neither_count']:,})")

    # --- Step 2: lead_type assignment, stratified per seed month ---
    assign_lead_types(prospects_by_month, composition)

    # --- Step 3: target-month allocation for MQL and PQL pools ---
    mql_pool_by_month = {m: [] for m in prospects_by_month}
    pql_pool_by_month = {m: [] for m in prospects_by_month}
    for month, cohort in prospects_by_month.items():
        for p in cohort:
            if p["lead_type"] in ("demo", "both"):
                mql_pool_by_month[month].append(p)
            if p["lead_type"] in ("trial", "both"):
                pql_pool_by_month[month].append(p)

    mql_shortfalls, mql_leftover = allocate_target_months(
        mql_pool_by_month, composition["mql_targets"], "mql_target_month")
    pql_shortfalls, pql_leftover = allocate_target_months(
        pql_pool_by_month, composition["pql_targets"], "pql_target_month")

    # --- Step 4: build touches, resolve mql_date/pql_date/qualified_date ---
    for p in all_prospects:
        touches, mql_dt, pql_dt = build_prospect_touches(p, p["primary_channel"])
        p["touches"] = touches
        p["is_mql"] = mql_dt is not None
        p["mql_date"] = mql_dt.isoformat() if mql_dt else None
        p["is_pql"] = pql_dt is not None
        p["pql_date"] = pql_dt.isoformat() if pql_dt else None
        assert p["is_mql"] == (p["mql_date"] is not None)
        assert p["is_pql"] == (p["pql_date"] is not None)

        if mql_dt and pql_dt:
            qualified_dt = min(mql_dt, pql_dt)
        elif mql_dt:
            qualified_dt = mql_dt
        elif pql_dt:
            qualified_dt = pql_dt
        else:
            qualified_dt = p["first_touch_dt"]
        p["qualified_date"] = qualified_dt.isoformat()
        p["qualified_dt"] = qualified_dt
        # Single population-membership gate for all scoped reporting: a
        # prospect belongs to the fiscal-window population if its earliest
        # qualifying event (qualified_date) falls inside Feb 2025-Jan 2026.
        # This correctly includes a warm-up-seeded prospect whose mql_date
        # lagged into the window (first touch out, but qualified_date in),
        # and correctly excludes a warm-up prospect whose only touch
        # activity happened before the window. Each specific metric ALSO
        # checks its own relevant date (mql_date/pql_date/first-touch) —
        # this flag is ANDed with that check, not a substitute for it.
        p["in_fiscal_window"] = (qualified_dt.year, qualified_dt.month) in FISCAL_MONTHS

    # --- Step 5: post-MQL suppression (drop rows) ---
    dropped_by_channel = {}
    for p in all_prospects:
        mql_dt = datetime.fromisoformat(p["mql_date"]) if p["mql_date"] else None
        if not mql_dt:
            continue
        kept = []
        for t in p["touches"]:
            if (
                datetime.fromisoformat(t["timestamp"]) > mql_dt
                and t["channel"] in SUPPRESSED_CHANNELS
            ):
                dropped_by_channel[t["channel"]] = dropped_by_channel.get(t["channel"], 0) + 1
                continue
            kept.append(t)
        p["touches"] = kept

    # --- Step 6: resequence touch_number, no gaps ---
    for p in all_prospects:
        for i, t in enumerate(p["touches"], start=1):
            t["touch_number"] = i

    # --- Step 7: post_mql flags ---
    for p in all_prospects:
        mql_dt = datetime.fromisoformat(p["mql_date"]) if p["mql_date"] else None
        for t in p["touches"]:
            t_dt = datetime.fromisoformat(t["timestamp"])
            t["post_mql"] = bool(mql_dt and t_dt > mql_dt)

    # --- Step 8: is_opp / is_closed_won as exact per-lead_type quotas ---
    by_lead_type = {"demo": [], "trial": [], "both": [], "neither": []}
    for p in all_prospects:
        by_lead_type[p["lead_type"]].append(p)

    for p in all_prospects:
        p["is_opp"] = False
        p["is_closed_won"] = False

    for lt, cohort in by_lead_type.items():
        rates = LEAD_TYPE_CONVERSION[lt]
        shuffled = cohort[:]
        random.shuffle(shuffled)
        opp_n = round(len(shuffled) * rates["to_sql"])
        opps = shuffled[:opp_n]
        for p in opps:
            p["is_opp"] = True
        won_n = round(opp_n * rates["sql_to_won"])
        for p in opps[:won_n]:
            p["is_closed_won"] = True

    # --- Step 9: cycle_days / close_date for opportunities, runway clamp ---
    clamped_close_date_count = 0
    clamped_close_date_count_iw = 0
    for p in all_prospects:
        p["clamped"] = False
        if not p["is_opp"]:
            p["cycle_days"] = None
            p["close_date"] = None
            continue
        rates = LEAD_TYPE_CONVERSION[p["lead_type"]]
        seniority_base = SENIORITY_CYCLE_DAYS[p["seniority_tier"]]
        base_cycle = seniority_base + rates["cycle_days_add"]
        cycle_days = round(base_cycle * (1 + random.uniform(-0.15, 0.15)))
        close_dt = p["qualified_dt"] + timedelta(days=cycle_days)
        if close_dt > RUNWAY_END:
            if p["is_closed_won"]:
                clamped_close_date_count += 1
                if p["in_fiscal_window"]:
                    clamped_close_date_count_iw += 1
                p["clamped"] = True
            p["is_closed_won"] = False
        p["cycle_days"] = cycle_days
        p["close_date"] = close_dt.isoformat()

    # --- Step 10: pipeline_value — split each month's $ target by
    # (seniority_mult x deal_index) across that month's opportunities ---
    opps = [p for p in all_prospects if p["is_opp"]]
    opps_by_qmonth = {}
    for p in opps:
        qd = p["qualified_dt"]
        opps_by_qmonth.setdefault((qd.year, qd.month), []).append(p)

    for p in all_prospects:
        p["pipeline_value"] = 0

    fiscal_weight_sum = 0.0
    fiscal_dollar_sum = 0.0
    for (ty, tm) in FISCAL_MONTHS:
        month_opps = opps_by_qmonth.get((ty, tm), [])
        if not month_opps:
            continue
        target = ANNUAL_PIPELINE_GOAL * SEASONALITY_INDEX_MAP[FISCAL_MONTH_NAMES[FISCAL_MONTHS.index((ty, tm))]] \
            * ATTAINMENT_PIPELINE[FISCAL_MONTH_NAMES[FISCAL_MONTHS.index((ty, tm))]]
        weights = [p["seniority_mult"] * LEAD_TYPE_CONVERSION[p["lead_type"]]["deal_index"] for p in month_opps]
        wsum = sum(weights)
        for p, w in zip(month_opps, weights):
            p["pipeline_value"] = round(target * w / wsum)
        fiscal_weight_sum += wsum
        fiscal_dollar_sum += target

    fallback_rate = fiscal_dollar_sum / fiscal_weight_sum if fiscal_weight_sum else 0
    out_of_window_opp_count = 0
    for (y, m), month_opps in opps_by_qmonth.items():
        if (y, m) in FISCAL_MONTHS:
            continue
        out_of_window_opp_count += len(month_opps)
        for p in month_opps:
            w = p["seniority_mult"] * LEAD_TYPE_CONVERSION[p["lead_type"]]["deal_index"]
            p["pipeline_value"] = round(fallback_rate * w)

    for p in all_prospects:
        if not p["is_opp"]:
            p["pipeline_value"] = 0

    stats = {
        "composition": composition,
        "mql_shortfalls": mql_shortfalls,
        "pql_shortfalls": pql_shortfalls,
        "mql_leftover": mql_leftover,
        "pql_leftover": pql_leftover,
        "dropped_by_channel": dropped_by_channel,
        "clamped_close_date_count": clamped_close_date_count,
        "clamped_close_date_count_iw": clamped_close_date_count_iw,
        "out_of_window_opp_count": out_of_window_opp_count,
        "fallback_rate": fallback_rate,
    }
    return all_prospects, stats


# ---------------------------------------------------------------------------
# Attribution models (unchanged)
# ---------------------------------------------------------------------------


def position_weights(touches):
    n = len(touches)
    eligible = [i for i, t in enumerate(touches) if not t["post_mql"]]
    first_i = eligible[0]
    last_i = eligible[-1]

    if n == 1:
        return [1.0], first_i, last_i

    weights = [0.0] * n
    if first_i == last_i:
        weights[first_i] = 0.8
        rest = [i for i in range(n) if i != first_i]
        share = 0.2 / len(rest)
        for i in rest:
            weights[i] = share
        return weights, first_i, last_i

    middle = [i for i in range(n) if i not in (first_i, last_i)]
    if middle:
        weights[first_i] = 0.4
        weights[last_i] = 0.4
        share = 0.2 / len(middle)
        for i in middle:
            weights[i] = share
    else:
        weights[first_i] = 0.5
        weights[last_i] = 0.5
    return weights, first_i, last_i


def compute_attribution(prospects, key_fn=lambda t: t["channel"]):
    """Pipeline credit by key_fn(touch) for all 4 models, on post-suppression
    touches only. key_fn defaults to channel; pass a campaign_name extractor
    to get the same models grouped by campaign instead."""
    models = {"first_touch": {}, "last_touch": {}, "linear": {}, "u_shaped": {}}

    for p in prospects:
        if not p["is_opp"]:
            continue
        pv = p["pipeline_value"]
        touches = p["touches"]
        n = len(touches)

        weights, first_i, last_i = position_weights(touches)

        k = key_fn(touches[first_i])
        models["first_touch"][k] = models["first_touch"].get(k, 0.0) + pv

        k = key_fn(touches[last_i])
        models["last_touch"][k] = models["last_touch"].get(k, 0.0) + pv

        per_touch = pv / n
        for t in touches:
            k = key_fn(t)
            models["linear"][k] = models["linear"].get(k, 0.0) + per_touch

        for t, w in zip(touches, weights):
            k = key_fn(t)
            models["u_shaped"][k] = models["u_shaped"].get(k, 0.0) + pv * w

    for model in models:
        for k in models[model]:
            models[model][k] = round(models[model][k], 2)

    return models


# ---------------------------------------------------------------------------
# Web-tool summary JSON: a pre-aggregated view of the SAME finalized data
# used everywhere else in this script. No separate dataset, no mock
# constants — every number here must reconcile with the workbook.
# ---------------------------------------------------------------------------


def compute_prior_year_mql_monthly(current_year_total):
    """Prior-year MQL monthly series: SEASONALITY_INDEX with +/-15%
    per-month variance, renormalized to sum to 1.0, then scaled by
    (current_year_total / (1 + PRIOR_YEAR_GROWTH)). Uses the module's
    already-seeded (seed=42) random stream — deterministic run to run.
    Not a scaled copy of the index: the variance means the month shares
    genuinely differ from this year's, which is the point of calling it
    a distinct prior-year distribution."""
    prior_total = current_year_total / (1 + PRIOR_YEAR_GROWTH)
    raw = [SEASONALITY_INDEX_MAP[name] * (1 + random.uniform(-0.15, 0.15)) for name in FISCAL_MONTH_NAMES]
    raw_sum = sum(raw)
    shares = [v / raw_sum for v in raw]
    return [prior_total * s for s in shares]


def build_summary_json(prospects, attribution_by_channel, attribution_by_campaign, composition):
    leads_iw = [p for p in prospects if in_window(p["first_touch_dt"]) and p["in_fiscal_window"]]
    mqls_iw = [p for p in prospects if p["is_mql"] and in_window(datetime.fromisoformat(p["mql_date"])) and p["in_fiscal_window"]]
    pqls_iw = [p for p in prospects if p["is_pql"] and in_window(datetime.fromisoformat(p["pql_date"])) and p["in_fiscal_window"]]
    opps_iw = [p for p in prospects if p["is_opp"] and p["in_fiscal_window"]]
    won_iw = [p for p in opps_iw if p["is_closed_won"]]

    total_pipeline = sum(p["pipeline_value"] for p in opps_iw)

    # --- totals ---
    totals = {
        "leads": len(leads_iw), "mqls": len(mqls_iw), "pqls": len(pqls_iw),
        "opportunities": len(opps_iw), "closed_won": len(won_iw),
        "pipeline_by_model": {m: round(sum(v.values()), 2) for m, v in attribution_by_channel.items()},
    }

    # --- channels ---
    channels = {ch: {"leads": 0, "mqls": 0, "opportunities": 0, "closed_won": 0} for ch in ANNUAL_SPEND}
    for p in leads_iw:
        channels[p["touches"][0]["channel"]]["leads"] += 1
    for p in mqls_iw:
        channels[p["touches"][0]["channel"]]["mqls"] += 1
    for p in opps_iw:
        channels[p["touches"][0]["channel"]]["opportunities"] += 1
    for p in won_iw:
        channels[p["touches"][0]["channel"]]["closed_won"] += 1

    touched_by_channel = {ch: set() for ch in ANNUAL_SPEND}
    touched_by_campaign = {}
    campaign_channel = {}
    for p in opps_iw:
        for t in p["touches"]:
            touched_by_channel[t["channel"]].add(p["prospect_id"])
            touched_by_campaign.setdefault(t["campaign_name"], set()).add(p["prospect_id"])
            campaign_channel[t["campaign_name"]] = t["channel"]

    for ch in channels:
        channels[ch]["pipeline_by_model"] = {m: attribution_by_channel[m].get(ch, 0.0) for m in attribution_by_channel}
        channels[ch]["opportunities_touched"] = len(touched_by_channel[ch])
        channels[ch]["annual_spend"] = ANNUAL_SPEND[ch]

    # --- campaigns ---
    campaigns = {}
    for camp, prospect_ids in touched_by_campaign.items():
        campaigns[camp] = {
            "channel": campaign_channel[camp],
            "pipeline_by_model": {m: attribution_by_campaign[m].get(camp, 0.0) for m in attribution_by_campaign},
            "opportunities_touched": len(prospect_ids),
        }

    # --- monthly (MQL/PQL/pipeline actual + goal), fiscal months Feb-Jan ---
    month_labels = [f"{FISCAL_MONTH_NAMES[i]}-{y}" for i, (y, m) in enumerate(FISCAL_MONTHS)]
    mql_actual, pql_actual, pipeline_actual = [], [], []
    mql_goal, pql_goal, pipeline_goal = [], [], []
    for i, (ty, tm) in enumerate(FISCAL_MONTHS):
        name = FISCAL_MONTH_NAMES[i]
        mql_actual.append(sum(1 for p in mqls_iw if datetime.fromisoformat(p["mql_date"]).year == ty and datetime.fromisoformat(p["mql_date"]).month == tm))
        pql_actual.append(sum(1 for p in pqls_iw if datetime.fromisoformat(p["pql_date"]).year == ty and datetime.fromisoformat(p["pql_date"]).month == tm))
        pipeline_actual.append(round(sum(p["pipeline_value"] for p in opps_iw if p["qualified_dt"].year == ty and p["qualified_dt"].month == tm), 2))
        mql_goal.append(round(ANNUAL_MQL_GOAL * SEASONALITY_INDEX_MAP[name], 1))
        pql_goal.append(round(ANNUAL_PQL_GOAL * SEASONALITY_INDEX_MAP[name], 1))
        pipeline_goal.append(round(ANNUAL_PIPELINE_GOAL * SEASONALITY_INDEX_MAP[name], 2))

    prior_year_mql = compute_prior_year_mql_monthly(sum(mql_actual))

    # --- pacing projection: implied_total from Feb-Oct actual vs prior-year
    # share of Feb-Oct, then projected[m] = implied_total * prior-year share(m) ---
    CUTOFF_IDX = 8  # Oct is index 8 (Feb=0..Jan=11)
    actual_feb_to_oct = sum(mql_actual[:CUTOFF_IDX + 1])
    prior_year_total = sum(prior_year_mql)
    prior_year_share_feb_to_oct = sum(prior_year_mql[:CUTOFF_IDX + 1]) / prior_year_total
    implied_total = actual_feb_to_oct / prior_year_share_feb_to_oct
    projected = {}
    for i in (9, 10, 11):
        share = prior_year_mql[i] / prior_year_total
        projected[month_labels[i]] = round(implied_total * share, 1)

    print("\n--- Pacing projection check (projected vs REAL actual, Nov/Dec) ---")
    validation = {}
    for i in (9, 10):
        proj = projected[month_labels[i]]
        actual = mql_actual[i]
        variance_pct = round((proj - actual) / actual * 100, 1) if actual else None
        validation[month_labels[i]] = {"projected": proj, "actual": actual, "variance_pct": variance_pct}
        print(f"    {month_labels[i]}: projected={proj:.1f}  actual={actual}  "
              f"diff={proj - actual:+.1f}  variance={variance_pct:+.1f}%")

    # --- demographics ---
    lead_type_counts = {}
    for p in leads_iw:
        lead_type_counts[p["lead_type"]] = lead_type_counts.get(p["lead_type"], 0) + 1

    def group_stats(group_key_fn):
        groups = {}
        for p in leads_iw:
            gk = group_key_fn(p)
            groups.setdefault(gk, {
                "leads": 0, "mqls": 0, "opportunities": 0, "closed_won": 0,
                "channel_mix": {ch: 0 for ch in ANNUAL_SPEND},
                "_deal_sizes": [], "_cycle_days": [],
            })
            groups[gk]["leads"] += 1
        for p in mqls_iw:
            gk = group_key_fn(p)
            if gk not in groups:
                continue
            groups[gk]["mqls"] += 1
            groups[gk]["channel_mix"][p["touches"][0]["channel"]] += 1
        for p in opps_iw:
            gk = group_key_fn(p)
            if gk not in groups:
                continue
            groups[gk]["opportunities"] += 1
            groups[gk]["_cycle_days"].append(p["cycle_days"])
            if p["is_closed_won"]:
                groups[gk]["closed_won"] += 1
                groups[gk]["_deal_sizes"].append(p["pipeline_value"])
        # mqls-by-channel totals (all groups) needed for spend allocation
        mqls_by_channel_total = {ch: 0 for ch in ANNUAL_SPEND}
        for p in mqls_iw:
            mqls_by_channel_total[p["touches"][0]["channel"]] += 1
        for gk, g in groups.items():
            allocated_spend = 0.0
            for ch in ANNUAL_SPEND:
                if mqls_by_channel_total[ch]:
                    allocated_spend += ANNUAL_SPEND[ch] * (g["channel_mix"][ch] / mqls_by_channel_total[ch])
            g["cost_per_mql"] = round(allocated_spend / g["mqls"], 2) if g["mqls"] else None
            g["avg_deal_size"] = round(sum(g["_deal_sizes"]) / len(g["_deal_sizes"]), 2) if g["_deal_sizes"] else None
            g["avg_cycle_days"] = round(sum(g["_cycle_days"]) / len(g["_cycle_days"]), 1) if g["_cycle_days"] else None
            g["win_rate"] = round(g["closed_won"] / g["opportunities"], 4) if g["opportunities"] else None
            del g["_deal_sizes"], g["_cycle_days"]
        return groups

    seniority = group_stats(lambda p: p["seniority_tier"])
    job_function = group_stats(lambda p: TITLE_TO_FUNCTION.get(p["title"], "Unmapped"))

    # --- pipeline by lead_type (for the Deal Efficiency motion split) ---
    pipeline_by_lead_type = {lt: 0.0 for lt in ("demo", "trial", "both", "neither")}
    for p in opps_iw:
        pipeline_by_lead_type[p["lead_type"]] += p["pipeline_value"]
    pipeline_by_lead_type = {k: round(v, 2) for k, v in pipeline_by_lead_type.items()}

    # --- overall deal metrics (for Deal Efficiency top stat cards) ---
    all_deal_sizes = [p["pipeline_value"] for p in won_iw]
    all_cycle_days = [p["cycle_days"] for p in opps_iw]
    avg_deal_size = round(sum(all_deal_sizes) / len(all_deal_sizes), 2) if all_deal_sizes else 0
    avg_cycle_days = round(sum(all_cycle_days) / len(all_cycle_days), 1) if all_cycle_days else 0
    pipeline_velocity_30d = round(len(won_iw) * avg_deal_size / avg_cycle_days * 30, 2) if avg_cycle_days else 0
    totals["avg_deal_size"] = avg_deal_size
    totals["avg_cycle_days"] = avg_cycle_days
    totals["pipeline_velocity_30d"] = pipeline_velocity_30d

    # --- monthly lead counts (Traffic tab — real first-touch volume, no
    # fabricated "sessions" figure) ---
    leads_actual = []
    for (ty, tm) in FISCAL_MONTHS:
        leads_actual.append(sum(1 for p in leads_iw if p["first_touch_dt"].year == ty and p["first_touch_dt"].month == tm))

    # --- demo/trial form-fill touch counts by channel (Channel tab
    # cost-per-demo / cost-per-trial) — counted on in-window leads' surviving
    # touches, independent of MQL/opp status ---
    demo_touches = {ch: 0 for ch in ANNUAL_SPEND}
    trial_touches = {ch: 0 for ch in ANNUAL_SPEND}
    for p in leads_iw:
        for t in p["touches"]:
            if t["form_type"] == "demo_request":
                demo_touches[t["channel"]] += 1
            elif t["form_type"] == "trial_signup":
                trial_touches[t["channel"]] += 1

    company_counts = {}
    for p in leads_iw:
        company_counts[p["company"]] = company_counts.get(p["company"], 0) + 1
    sizes = list(company_counts.values())
    distribution = {"1": 0, "2": 0, "3": 0, "4+": 0}
    for s in sizes:
        key = str(s) if s <= 3 else "4+"
        distribution[key] += 1

    demographics = {
        "lead_type": lead_type_counts,
        "seniority": seniority,
        "job_function": job_function,
        "buying_committee": {
            "avg_distinct_prospects_per_company": round(sum(sizes) / len(sizes), 2) if sizes else 0,
            "distribution": distribution,
        },
    }

    for ch in channels:
        channels[ch]["demo_touches"] = demo_touches[ch]
        channels[ch]["trial_touches"] = trial_touches[ch]

    demographics["pipeline_by_lead_type"] = pipeline_by_lead_type

    summary = {
        "meta": {
            "fiscal_window": {"start": "2025-02-01", "end": "2026-01-31"},
            "annual_goals": {"mql": ANNUAL_MQL_GOAL, "pql": ANNUAL_PQL_GOAL, "pipeline": ANNUAL_PIPELINE_GOAL},
            "prior_year_growth_assumption": PRIOR_YEAR_GROWTH,
        },
        "totals": totals,
        "channels": channels,
        "campaigns": campaigns,
        "monthly": {
            "months": month_labels,
            "leads_actual": leads_actual,
            "mql_actual": mql_actual, "mql_goal": mql_goal,
            "pql_actual": pql_actual, "pql_goal": pql_goal,
            "pipeline_actual": pipeline_actual, "pipeline_goal": pipeline_goal,
            "prior_year_mql": [round(v, 1) for v in prior_year_mql],
        },
        "pacing_projection": {
            "cutoff_month": month_labels[CUTOFF_IDX],
            "actual_feb_to_oct_mql": actual_feb_to_oct,
            "implied_total": round(implied_total, 1),
            "projected": projected,
            "validation": validation,
        },
        "demographics": demographics,
    }
    return summary


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

FLAT_TOUCH_FIELDS = [
    "touch_number", "channel", "campaign_name",
    "utm_source", "utm_medium", "utm_campaign",
    "utm_content", "utm_term", "timestamp", "form_type",
]

PROSPECT_FIELDS = [
    "prospect_id", "full_name", "title", "seniority_tier", "seniority_mult",
    "company", "is_mql", "is_opp", "is_closed_won", "pipeline_value",
]

APPEND_FIELDS = [
    "lead_type", "mql_date", "pql_date", "qualified_date",
    "is_pql", "post_mql", "cycle_days", "close_date", "in_fiscal_window",
]


def save_csv(prospects, path):
    fieldnames = PROSPECT_FIELDS + FLAT_TOUCH_FIELDS + APPEND_FIELDS
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for p in prospects:
            base = {k: p[k] for k in PROSPECT_FIELDS}
            base.update({
                "lead_type": p["lead_type"],
                "mql_date": p["mql_date"],
                "pql_date": p["pql_date"],
                "qualified_date": p["qualified_date"],
                "is_pql": p["is_pql"],
                "cycle_days": p["cycle_days"],
                "close_date": p["close_date"],
                "in_fiscal_window": p["in_fiscal_window"],
            })
            for touch in p["touches"]:
                row = {**base, **touch}
                writer.writerow(row)


def to_json_safe(prospects):
    out = []
    for p in prospects:
        d = {k: p[k] for k in [
            "prospect_id", "full_name", "title", "seniority_tier", "seniority_mult",
            "company", "is_mql", "is_opp", "is_closed_won", "pipeline_value", "touches",
            "lead_type", "mql_date", "pql_date", "qualified_date", "is_pql",
            "cycle_days", "close_date", "in_fiscal_window",
        ]}
        out.append(d)
    return out


# ---------------------------------------------------------------------------
# Verification report
# ---------------------------------------------------------------------------


def in_window(dt):
    return dt is not None and (dt.year, dt.month) in FISCAL_MONTHS


def print_verification(prospects, attribution, stats):
    print("\n" + "=" * 72)
    print("VERIFICATION (fiscal-window-scoped reporting: Feb 2025 - Jan 2026)")
    print("=" * 72)

    total = len(prospects)
    touch_rows = sum(len(p["touches"]) for p in prospects)
    composition = stats["composition"]

    def dt_or_none(iso):
        return datetime.fromisoformat(iso) if iso else None

    # Scoped populations, per the scoping rule: each metric filtered on its
    # own relevant date AND in_fiscal_window (qualified_date-based gate).
    leads_iw = [p for p in prospects if in_window(p["first_touch_dt"]) and p["in_fiscal_window"]]
    mqls_iw = [p for p in prospects if p["is_mql"] and in_window(dt_or_none(p["mql_date"])) and p["in_fiscal_window"]]
    pqls_iw = [p for p in prospects if p["is_pql"] and in_window(dt_or_none(p["pql_date"])) and p["in_fiscal_window"]]
    mqls_iw_ids = {p["prospect_id"] for p in mqls_iw}
    pqls_iw_ids = {p["prospect_id"] for p in pqls_iw}
    overlap_iw_ids = mqls_iw_ids & pqls_iw_ids
    opps_iw = [p for p in prospects if p["is_opp"] and p["in_fiscal_window"]]

    # (a) lead-to-MQL, lead-to-PQL, overlap — IN-WINDOW ONLY
    n_leads = len(leads_iw)
    n_mqls = len(mqls_iw)
    n_pqls = len(pqls_iw)
    print("\n(a) Lead-to-MQL / lead-to-PQL / overlap — FISCAL WINDOW ONLY")
    print(f"    In-window leads (first touch in window): {n_leads:,}")
    print(f"    Total touch rows (post-suppression, all prospects incl. warm-up): {touch_rows:,}")
    print(f"    Lead-to-MQL rate: {n_mqls/n_leads*100:.1f}%  ({n_mqls:,} / {n_leads:,})")
    print(f"    Lead-to-PQL rate: {n_pqls/n_leads*100:.1f}%  ({n_pqls:,} / {n_leads:,})")
    print(f"    MQL/PQL overlap (both, in-window): {len(overlap_iw_ids):,}")
    lead_type_counts = {}
    for p in leads_iw:
        lead_type_counts[p["lead_type"]] = lead_type_counts.get(p["lead_type"], 0) + 1
    for lt in ("demo", "trial", "both", "neither"):
        c = lead_type_counts.get(lt, 0)
        print(f"      {lt:<8} {c:>6,}  ({c/n_leads*100:.1f}% of in-window leads)")

    # q/r/s. monthly actual vs goal, attainment %
    def monthly_report(label, targets, date_field):
        print(f"\n    {label} by fiscal month — actual vs target (attainment)")
        print(f"    {'Month':<10}{'Target':>12}{'Actual':>12}{'Attain %':>12}{'Spec Attain %':>16}{'Within 2%':>12}")
        curve = {"MQL": ATTAINMENT_MQL, "PQL": ATTAINMENT_PQL, "PIPELINE": ATTAINMENT_PIPELINE}[label]
        for i, (ty, tm) in enumerate(FISCAL_MONTHS):
            name = FISCAL_MONTH_NAMES[i]
            target = targets[(ty, tm)]
            if date_field == "pipeline":
                actual = sum(p["pipeline_value"] for p in prospects
                             if p["is_opp"] and p["qualified_dt"].year == ty and p["qualified_dt"].month == tm)
            else:
                actual = sum(1 for p in prospects
                             if p[date_field] and datetime.fromisoformat(p[date_field]).year == ty
                             and datetime.fromisoformat(p[date_field]).month == tm)
            goal = {"MQL": ANNUAL_MQL_GOAL, "PQL": ANNUAL_PQL_GOAL, "PIPELINE": ANNUAL_PIPELINE_GOAL}[label]
            month_goal = goal * SEASONALITY_INDEX_MAP[name]
            attain_pct = actual / month_goal * 100 if month_goal else 0
            spec_pct = curve[name] * 100
            within = abs(attain_pct - spec_pct) <= 2.0
            if date_field == "pipeline":
                print(f"    {name:<10}{'$'+format(target,',.0f'):>12}{'$'+format(actual,',.0f'):>12}{attain_pct:>11.1f}%{spec_pct:>15.1f}%{str(within):>12}")
            else:
                print(f"    {name:<10}{target:>12.1f}{actual:>12,}{attain_pct:>11.1f}%{spec_pct:>15.1f}%{str(within):>12}")

    print("\n(q) MQL monthly actual vs goal")
    monthly_report("MQL", composition["mql_targets"], "mql_date")
    print("\n(r) PQL monthly actual vs goal")
    monthly_report("PQL", composition["pql_targets"], "pql_date")
    print("\n(s) Pipeline monthly actual vs goal")
    pipeline_targets = {(ty, tm): ANNUAL_PIPELINE_GOAL * SEASONALITY_INDEX_MAP[FISCAL_MONTH_NAMES[i]] * ATTAINMENT_PIPELINE[FISCAL_MONTH_NAMES[i]]
                         for i, (ty, tm) in enumerate(FISCAL_MONTHS)}
    monthly_report("PIPELINE", pipeline_targets, "pipeline")

    # t. first-touch count by month vs SEASONALITY_INDEX
    # NOTE: the 15-slot seeding window double-counts Oct/Nov/Dec (once as
    # 2024 warm-up, once in 2025 proper), so the 15 raw weights sum to
    # 1.251, not 1.0 — expected share per slot is index(month)/1.251, not
    # the raw 12-month index value directly.
    print("\n(t) First-touch count by seed month vs SEASONALITY_INDEX target (Constraint 1 check)")
    weight_sum_15 = sum(SEASONALITY_INDEX_MAP[MONTH_ORDER[m - 1]] for (_, m) in SEED_SLOTS)
    ft_counts = {}
    for p in prospects:
        if not p["touches"]:
            continue
        dt = datetime.fromisoformat(p["touches"][0]["timestamp"])
        key = (dt.year, dt.month)
        ft_counts[key] = ft_counts.get(key, 0) + 1
    total_seeded = sum(ft_counts.values())
    print(f"    {'Month':<12}{'Actual':>10}{'Share':>10}{'Expected share':>16}")
    for (y, m), count in sorted(ft_counts.items()):
        name = MONTH_ORDER[m - 1]
        share = count / total_seeded * 100 if total_seeded else 0
        expected_share = SEASONALITY_INDEX_MAP[name] / weight_sum_15 * 100
        print(f"    {name} {y:<7}{count:>10,}{share:>9.1f}%{expected_share:>15.1f}%")

    # u. ROAS by channel — deterministic, computed on SCOPED (in-window-only) attribution
    u = attribution["u_shaped"]
    total_pipeline = sum(p["pipeline_value"] for p in opps_iw)
    print("\n(u) ROAS / CPL / cpMQL by channel — FISCAL WINDOW ONLY (attribution computed on in-window opportunities' touches only)")
    roas_breach = False
    leads_by_channel = {}
    mqls_by_channel = {}
    for p in leads_iw:
        ch = p["touches"][0]["channel"]
        leads_by_channel[ch] = leads_by_channel.get(ch, 0) + 1
    for p in mqls_iw:
        ch = p["touches"][0]["channel"]
        mqls_by_channel[ch] = mqls_by_channel.get(ch, 0) + 1
    for ch in ("linkedin", "google", "g2", "programmatic"):
        credit = u.get(ch, 0.0)
        spend = ANNUAL_SPEND[ch]
        roas = credit / spend if spend else 0
        leads_ch = leads_by_channel.get(ch, 0)
        mqls_ch = mqls_by_channel.get(ch, 0)
        cpl = spend / leads_ch if leads_ch else 0
        cpmql = spend / mqls_ch if mqls_ch else 0
        print(f"    {ch:<14} credit=${credit:>13,.2f}   spend=${spend:>10,}   ROAS={roas:.2f}x   "
              f"CPL=${cpl:,.2f}   cpMQL=${cpmql:,.2f}")
        if ch in ("linkedin", "google") and not (3.0 <= roas <= 4.0):
            roas_breach = True
    if roas_breach:
        print("    *** GUARDRAIL BREACH: LinkedIn or Google ROAS outside 3-4x after rescoping. REPORT AND STOP — not tuning to compensate. ***")

    # v. realized to-SQL / SQL-to-won by lead_type — FISCAL WINDOW ONLY
    print("\n(v) Realized to-SQL / SQL-to-won by lead_type vs specified — FISCAL WINDOW ONLY")
    for lt in ("demo", "trial", "both", "neither"):
        cohort = [p for p in leads_iw if p["lead_type"] == lt]
        n = len(cohort)
        opp = sum(1 for p in cohort if p["is_opp"] and p["in_fiscal_window"])
        won = sum(1 for p in cohort if p["is_closed_won"] and p["in_fiscal_window"])
        rates = LEAD_TYPE_CONVERSION[lt]
        if n and opp:
            print(f"    {lt:<8} n={n:>6,}  to_SQL={opp/n*100:.1f}% (target {rates['to_sql']*100:.1f}%)   "
                  f"SQL_to_won={won/opp*100:.1f}% (target {rates['sql_to_won']*100:.1f}%)")
        else:
            print(f"    {lt:<8} n={n:>6,}  to_SQL={(opp/n*100 if n else 0):.1f}%")

    # w. avg deal size by seniority tier — FISCAL WINDOW ONLY
    print("\n(w) Avg deal size (pipeline_value) by seniority tier — in-window opportunities only")
    for tier, _, _, _ in SENIORITY_TIERS:
        vals = [p["pipeline_value"] for p in opps_iw if p["seniority_tier"] == tier]
        avg = sum(vals) / len(vals) if vals else 0
        print(f"    {tier:<14} n={len(vals):>6,}  avg=${avg:,.0f}")

    # x. prospect count vs MQL+PQL sum — FISCAL WINDOW ONLY
    print(f"\n(x) In-window lead count vs MQL+PQL sum")
    print(f"    In-window leads: {n_leads:,}")
    print(f"    MQL count: {n_mqls:,}  +  PQL count: {n_pqls:,}  =  {n_mqls+n_pqls:,}")
    print(f"    Overlap (both, counted twice above): {len(overlap_iw_ids):,}")
    print(f"    MQL + PQL - overlap (distinct in-window qualifying prospects): {n_mqls+n_pqls-len(overlap_iw_ids):,}")

    # y. in-window vs out-of-window counts, side by side
    print("\n(y) In-window vs out-of-window — leads, MQLs, PQLs, opportunities, pipeline")
    all_mqls = [p for p in prospects if p["is_mql"]]
    all_pqls = [p for p in prospects if p["is_pql"]]
    all_opps = [p for p in prospects if p["is_opp"]]
    all_leads_total = total
    print(f"    {'Metric':<16}{'In-window':>14}{'Out-of-window':>16}{'Total':>12}")
    print(f"    {'Leads':<16}{n_leads:>14,}{all_leads_total-n_leads:>16,}{all_leads_total:>12,}")
    print(f"    {'MQLs':<16}{n_mqls:>14,}{len(all_mqls)-n_mqls:>16,}{len(all_mqls):>12,}")
    print(f"    {'PQLs':<16}{n_pqls:>14,}{len(all_pqls)-n_pqls:>16,}{len(all_pqls):>12,}")
    print(f"    {'Opportunities':<16}{len(opps_iw):>14,}{len(all_opps)-len(opps_iw):>16,}{len(all_opps):>12,}")
    out_of_window_pipeline = sum(p["pipeline_value"] for p in all_opps if not p["in_fiscal_window"])
    all_pipeline = sum(p["pipeline_value"] for p in all_opps)
    print(f"    {'Pipeline':<16}{'$'+format(total_pipeline,',.0f'):>14}{'$'+format(out_of_window_pipeline,',.0f'):>16}{'$'+format(all_pipeline,',.0f'):>12}")

    # g. touch rows dropped by suppression — mechanism-level audit, full population
    # (suppression/resequencing is a structural check on the generation mechanism,
    # not a scoped business KPI — warm-up touches are genuine and remain in Raw Data)
    print("\n(g) Touch rows dropped by post-MQL suppression, by channel (full population — mechanism audit)")
    dropped = stats["dropped_by_channel"]
    for ch in ("linkedin", "google", "g2"):
        print(f"    {ch:<14} {dropped.get(ch, 0):>8,} dropped")
    print(f"    {'total':<14} {sum(dropped.values()):>8,} dropped")
    print(f"    Surviving touch rows: {touch_rows:,}")

    # h. suppressed-channel touches after mql_date — must be 0 (full population)
    bad = 0
    for p in prospects:
        if not p["mql_date"]:
            continue
        mql_dt = datetime.fromisoformat(p["mql_date"])
        for t in p["touches"]:
            if t["channel"] in SUPPRESSED_CHANNELS and datetime.fromisoformat(t["timestamp"]) > mql_dt:
                bad += 1
    print(f"\n(h) linkedin/google/g2 touches occurring after any mql_date: {bad}  (must be 0)")

    # i. programmatic touches with post_mql TRUE (full population)
    prog_post_mql = sum(1 for p in prospects for t in p["touches"] if t["channel"] == "programmatic" and t["post_mql"])
    print(f"(i) Programmatic touches with post_mql TRUE: {prog_post_mql:,}")

    # j. per-model reconciliation — SCOPED attribution vs SCOPED total pipeline
    print("\n(j) Per-model pipeline credit reconciliation — FISCAL WINDOW ONLY")
    for model, data in attribution.items():
        total_m = sum(data.values())
        match = "OK" if abs(total_m - total_pipeline) < 0.01 else "MISMATCH"
        print(f"    {model:<14} ${total_m:>14,.2f}   vs in-window pipeline ${total_pipeline:,.2f}   [{match}]")

    # k. max touch_number == touch count (full population, structural)
    bad_seq = sum(1 for p in prospects if p["touches"] and max(t["touch_number"] for t in p["touches"]) != len(p["touches"]))
    print(f"\n(k) Prospects where max touch_number != touch count: {bad_seq}  (must be 0)")

    # l. is_opp FALSE and pipeline_value > 0 (full population, structural)
    bad_pv = sum(1 for p in prospects if not p["is_opp"] and p["pipeline_value"] > 0)
    print(f"(l) Prospects with is_opp FALSE and pipeline_value > 0: {bad_pv}  (must be 0)")

    # m. (superseded by bb below — recomputed on fiscal-window population)

    # n. programmatic detail — FISCAL WINDOW ONLY
    prog_leads = leads_by_channel.get("programmatic", 0)
    prog_mqls = mqls_by_channel.get("programmatic", 0)
    prog_cpmql = ANNUAL_SPEND["programmatic"] / prog_mqls if prog_mqls else 0
    print(f"\n(n) Programmatic detail — FISCAL WINDOW ONLY, small sample, reported as-is:")
    print(f"    Leads: {prog_leads:,}   MQLs: {prog_mqls:,}   cpMQL: ${prog_cpmql:,.2f}")

    # o. qualified_date null count (full population, structural)
    null_qd = sum(1 for p in prospects if not p["qualified_date"])
    print(f"\n(o) Prospects with null qualified_date: {null_qd}  (must be 0)")

    # p. total pipeline cross-check — FISCAL WINDOW figure is the one workbook tabs must show
    print(f"\n(p) Total pipeline, fiscal window only (this is the figure Channel Summary/Pacing must show): ${total_pipeline:,.2f}")

    # z. internal consistency: sum of (s) monthly rows == in-window pipeline total
    sum_s_rows = sum(
        sum(p["pipeline_value"] for p in opps_iw if p["qualified_dt"].year == ty and p["qualified_dt"].month == tm)
        for (ty, tm) in FISCAL_MONTHS
    )
    print(f"\n(z) Sum of (s) monthly rows vs in-window pipeline total: "
          f"${sum_s_rows:,.2f} vs ${total_pipeline:,.2f}   [{'OK' if abs(sum_s_rows-total_pipeline)<0.01 else 'MISMATCH'}]")
    print(f"    (Channel Summary and Pacing & Goals tabs must independently equal this same figure — verified once the workbook is built.)")

    # aa. audit: is_mql TRUE but in_fiscal_window FALSE — confirm excluded everywhere
    aa_count = sum(1 for p in prospects if p["is_mql"] and not p["in_fiscal_window"])
    aa_included_in_mqls_iw = sum(1 for p in prospects if p["is_mql"] and not p["in_fiscal_window"] and p["prospect_id"] in mqls_iw_ids)
    print(f"\n(aa) Records with is_mql=TRUE and in_fiscal_window=FALSE: {aa_count:,}")
    print(f"     Of those, counted in the in-window MQL metric above: {aa_included_in_mqls_iw}  (must be 0)")

    # bb. close_date runway clamp, recomputed on fiscal-window population
    clamped_iw = stats["clamped_close_date_count_iw"]
    total_opps_iw = len(opps_iw)
    clamped_pct_iw = clamped_iw / total_opps_iw * 100 if total_opps_iw else 0
    print(f"\n(bb) Close_date runway clamp, RECOMPUTED on fiscal-window population only: "
          f"{clamped_iw:,} ({clamped_pct_iw:.1f}% of {total_opps_iw:,} in-window opportunities)")
    if clamped_pct_iw > 5:
        print("     *** GUARDRAIL BREACH: clamped opportunities exceed 5% of the fiscal-window population. REPORT AND STOP. ***")

    # Allocation feasibility (Constraint 1)
    print("\n--- Allocation feasibility (Constraint 1) ---")
    if stats["mql_shortfalls"] or stats["pql_shortfalls"]:
        print("    *** CONFLICTS DETECTED — seasonality seeding could not fully supply target months, even after cross-lag redistribution ***")
        for s in stats["mql_shortfalls"]:
            print(f"    MQL: target {s['target_month']} needed {s['needed']}, short by {s['short_by']}")
        for s in stats["pql_shortfalls"]:
            print(f"    PQL: target {s['target_month']} needed {s['needed']}, short by {s['short_by']}")
    else:
        print("    No shortfalls — every target month's quota was fully sourced from its lag window.")
    print(f"    Leftover (supply > demand, assigned to own/nearest fiscal month): "
          f"MQL pool {stats['mql_leftover']}, PQL pool {stats['pql_leftover']}")
    print(f"    Opportunities with qualified_date outside the fiscal window (fallback pipeline rate applied): "
          f"{stats['out_of_window_opp_count']} (fallback rate ${stats['fallback_rate']:,.2f} per weighted unit)")

    print("\n" + "=" * 72)


def print_summary(prospects, attribution):
    """Fiscal-window-scoped summary (matches the workbook's Summary tab):
    leads by first-touch date, MQL/PQL by their own date, opportunities/
    pipeline by qualified_date. Raw Data still holds every prospect,
    warm-up included — see print_verification for the full in vs
    out-of-window breakdown (item y)."""
    leads_iw = [p for p in prospects if in_window(p["first_touch_dt"]) and p["in_fiscal_window"]]
    total = len(leads_iw)
    mqls = sum(1 for p in leads_iw if p["mql_date"] and in_window(datetime.fromisoformat(p["mql_date"])))
    opps = [p for p in prospects if p["is_opp"] and p["in_fiscal_window"]]
    won = sum(1 for p in opps if p["is_closed_won"])
    pipeline = sum(p["pipeline_value"] for p in opps)

    print("\n" + "=" * 60)
    print("SUMMARY STATS (fiscal window: Feb 2025 - Jan 2026)")
    print("=" * 60)
    print(f"  Leads:          {total:,}")
    print(f"  MQLs:           {mqls:,}  ({mqls/total*100:.1f}%)")
    print(f"  Opportunities:  {len(opps):,}  ({len(opps)/total*100:.1f}% of leads)")
    print(f"  Closed Won:     {won:,}  ({won/len(opps)*100:.1f}% of Opps)" if opps else f"  Closed Won:     {won}")
    print(f"  Total Pipeline: ${pipeline:,.0f}")

    print("\nSeniority distribution (in-window leads):")
    for tier, prob, mult, _ in SENIORITY_TIERS:
        count = sum(1 for p in leads_iw if p["seniority_tier"] == tier)
        print(f"  {tier:<18} {count:>5}  ({count/total*100:.1f}%)")

    print("\nChannel pipeline credit (U-Shaped, in-window opportunities only):")
    u = attribution["u_shaped"]
    total_credit = sum(u.values())
    for ch, credit in sorted(u.items(), key=lambda x: -x[1]):
        pct = credit / total_credit * 100 if total_credit else 0
        print(f"  {ch:<16} ${credit:>12,.2f}  ({pct:.1f}%)")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    os.makedirs("data", exist_ok=True)

    print("Generating target-first prospect population (seed=42)...")
    prospects, stats = generate_prospects()
    if prospects is None:
        print("\nGeneration stopped due to an unresolved constraint conflict. No files written.")
        return

    print("\nSaving data/prospects.json...")
    with open("data/prospects.json", "w", encoding="utf-8") as f:
        json.dump(to_json_safe(prospects), f, indent=2)

    print("Saving data/prospects.csv...")
    save_csv(prospects, "data/prospects.csv")

    # public/data/prospects.csv is a second, byte-identical copy: vercel.json
    # has a header rule (Content-Disposition: attachment) that turns
    # /data/prospects.csv into a live production download endpoint
    # ("syncflow_prospects.csv"). Nothing links to it from the site, but it's
    # directly reachable by URL regardless, so it must never be allowed to
    # drift from the real dataset the way it did pre-rearchitecture. Copying
    # (not regenerating) guarantees byte-for-byte identity with the source.
    os.makedirs("public/data", exist_ok=True)
    shutil.copy2("data/prospects.csv", "public/data/prospects.csv")
    print("Copied to public/data/prospects.csv (backs the vercel.json download endpoint)...")

    print("Computing attribution models (fiscal-window opportunities only, post-suppression touches)...")
    # Scoped per the reporting rule: attribution/ROAS/etc. are all
    # fiscal-window metrics. Warm-up touches on an in-window-qualifying
    # prospect still count (their full touch history is real); an
    # out-of-window opportunity's touches are excluded entirely.
    opps_iw = [p for p in prospects if p["is_opp"] and p["in_fiscal_window"]]
    attribution = compute_attribution(opps_iw)

    print("Saving data/attribution_results.json...")
    with open("data/attribution_results.json", "w", encoding="utf-8") as f:
        json.dump(attribution, f, indent=2)

    print_summary(prospects, attribution)
    print_verification(prospects, attribution, stats)

    print("\nBuilding public/data/attribution_summary.json (web tool)...")
    attribution_by_campaign = compute_attribution(opps_iw, key_fn=lambda t: t["campaign_name"])
    summary = build_summary_json(prospects, attribution, attribution_by_campaign, stats["composition"])
    os.makedirs("public/data", exist_ok=True)
    summary_path = "public/data/attribution_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    size_kb = os.path.getsize(summary_path) / 1024
    print(f"Wrote {summary_path} ({size_kb:.1f} KB)")
    if size_kb > 200:
        print("*** WARNING: summary JSON exceeds the 200KB target. ***")

    print("\nDone. Files written to ./data/ and ./public/data/")


if __name__ == "__main__":
    main()
