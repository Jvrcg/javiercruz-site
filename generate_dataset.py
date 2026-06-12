"""
generate_dataset.py
Generates a mock B2B SaaS paid media dataset for Syncflow.
Outputs: data/prospects.json, data/prospects.csv, data/attribution_results.json
"""

import random
import json
import csv
import os
from datetime import datetime, timedelta

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

# Campaigns by channel
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

# UTM taxonomy per channel
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

# Campaign → channel mapping (derived from prefix)
def campaign_to_channel(campaign_name):
    if campaign_name.startswith("LI-"):
        return "linkedin"
    if campaign_name.startswith("GGL-"):
        return "google"
    if campaign_name.startswith("G2-"):
        return "g2"
    return "programmatic"

# Primary channel (touch 1) distribution — total lead counts per channel
PRIMARY_CHANNEL_COUNTS = {
    "linkedin": 5200,
    "google": 4000,
    "g2": 140,
    "programmatic": 38,
}

# Retargeting campaigns for LinkedIn touch 3
LI_RETARGET_CAMPAIGNS = [
    "LI-Retarget-SiteVisitors-30d",
    "LI-Retarget-PricingPage-14d",
]

FORM_TYPES = [
    ("gated_content_download", 0.45),
    ("newsletter_signup", 0.25),
    ("trial_signup", 0.20),
    ("demo_request", 0.10),
]

FORM_TYPE_NAMES = [f for f, _ in FORM_TYPES]
FORM_TYPE_WEIGHTS = [w for _, w in FORM_TYPES]

# MQL intent ordering (highest to lowest)
FORM_INTENT_ORDER = ["demo_request", "trial_signup", "gated_content_download", "newsletter_signup"]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

START_DATE = datetime(2025, 1, 1, 8, 0, 0)
END_DATE   = datetime(2025, 12, 31, 18, 0, 0)


def random_business_datetime(after: datetime) -> datetime:
    """Return a business-hours datetime 7–21 days after `after`."""
    days_ahead = random.randint(7, 21)
    candidate = after + timedelta(days=days_ahead)
    # Shift to Monday if weekend
    weekday = candidate.weekday()  # 0=Mon, 6=Sun
    if weekday == 5:
        candidate += timedelta(days=2)
    elif weekday == 6:
        candidate += timedelta(days=1)
    # Clamp to year end
    if candidate > END_DATE:
        candidate = END_DATE
    # Random hour 8–17 (so HH:MM within 8am–6pm)
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
    tiers = [(name, prob, mult, titles) for name, prob, mult, titles in SENIORITY_TIERS]
    names = [t[0] for t in tiers]
    weights = [t[1] for t in tiers]
    idx = FORM_TYPE_NAMES.index(pick_weighted(FORM_TYPE_NAMES, FORM_TYPE_WEIGHTS)) if False else None
    # Weighted random selection
    r = random.random()
    cumulative = 0.0
    for name, prob, mult, titles in tiers:
        cumulative += prob
        if r < cumulative:
            return name, mult, random.choice(titles)
    last = tiers[-1]
    return last[0], last[2], random.choice(last[3])


def pick_channel_for_touch(touch_number, num_touches, primary_channel=None):
    """Return a channel string based on touch sequencing rules."""
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
            return "linkedin"  # retargeting
        else:
            return random.choice(["google", "programmatic"])
    # Touch 4
    r = random.random()
    if r < 0.40:
        return "google"  # branded/RLSA
    elif r < 0.70:
        return "g2"
    else:
        return random.choice(["linkedin", "programmatic"])


def build_touch(touch_number, num_touches, timestamp, primary_channel=None):
    channel = pick_channel_for_touch(touch_number, num_touches, primary_channel)

    # Pick campaign
    if touch_number == 3 and channel == "linkedin":
        campaign = random.choice(LI_RETARGET_CAMPAIGNS)
    elif touch_number == 4 and channel == "google":
        campaign = random.choice(["GGL-Brand-Syncflow-Exact", "GGL-RLSA-HighIntent-Visitors"])
    else:
        campaign = random.choice(CAMPAIGNS[channel])

    utm = UTM[channel]
    utm_content = random.choice(utm["utm_content_options"])
    utm_term    = random.choice(utm["utm_term_options"])
    form_type   = pick_weighted(FORM_TYPE_NAMES, FORM_TYPE_WEIGHTS)

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


def compute_mql(seniority_tier, touches):
    """Return (is_mql, mql_touch_index) where mql_touch_index is 0-based."""
    form_types = [t["form_type"] for t in touches]

    # Auto-qualify
    if seniority_tier in ("manager", "director", "c_suite_vp"):
        for i, ft in enumerate(form_types):
            if ft in ("demo_request", "trial_signup"):
                return True, i

    # Base-rate qualification — find highest-intent touch
    mql_touch_idx = None
    for intent_form in FORM_INTENT_ORDER:
        for i, ft in enumerate(form_types):
            if ft == intent_form:
                rates = {
                    "demo_request": 0.80,
                    "trial_signup": 0.70,
                    "gated_content_download": 0.20,
                    "newsletter_signup": 0.08,
                }
                if random.random() < rates[intent_form]:
                    return True, i
                break  # only test once per intent level

    return False, None


# ---------------------------------------------------------------------------
# Attribution models
# ---------------------------------------------------------------------------

def u_shaped_credit(n_touches):
    """Return list of credit weights (sum=1) for u-shaped model."""
    if n_touches == 1:
        return [1.0]
    if n_touches == 2:
        return [0.5, 0.5]
    middle_weight = 0.20 / (n_touches - 2)
    weights = [0.40] + [middle_weight] * (n_touches - 2) + [0.40]
    return weights


def compute_attribution(prospects):
    """Compute pipeline credit by channel for all 4 models."""
    models = {
        "first_touch": {},
        "last_touch": {},
        "linear": {},
        "u_shaped": {},
    }

    for p in prospects:
        if not p["is_opp"]:
            continue
        pv = p["pipeline_value"]
        touches = p["touches"]
        n = len(touches)

        # first touch
        ch = touches[0]["channel"]
        models["first_touch"][ch] = models["first_touch"].get(ch, 0.0) + pv

        # last touch
        ch = touches[-1]["channel"]
        models["last_touch"][ch] = models["last_touch"].get(ch, 0.0) + pv

        # linear
        per_touch = pv / n
        for t in touches:
            ch = t["channel"]
            models["linear"][ch] = models["linear"].get(ch, 0.0) + per_touch

        # u-shaped
        weights = u_shaped_credit(n)
        for t, w in zip(touches, weights):
            ch = t["channel"]
            models["u_shaped"][ch] = models["u_shaped"].get(ch, 0.0) + pv * w

    # Round values
    for model in models:
        for ch in models[model]:
            models[model][ch] = round(models[model][ch], 2)

    return models


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

def generate_prospects(n=2000):
    prospects = []

    primary_channels = []
    for channel, count in PRIMARY_CHANNEL_COUNTS.items():
        primary_channels.extend([channel] * count)
    random.shuffle(primary_channels)

    for i in range(n):
        if (i + 1) % 500 == 0:
            print(f"  Generated {i + 1} / {n} prospects...")

        prospect_id = f"PRO-{i+1:05d}"
        primary_channel = primary_channels[i]
        first = random.choice(FIRST_NAMES)
        last  = random.choice(LAST_NAMES)
        full_name = f"{first} {last}"
        company = random.choice(COMPANIES)

        seniority_tier, seniority_mult, title = pick_seniority()

        # Touch count
        touch_count = pick_weighted([2, 3, 4], [0.30, 0.45, 0.25])

        # First touch timestamp: random business day in 2025
        days_into_year = random.randint(0, 300)  # leave room for subsequent touches
        first_ts = START_DATE + timedelta(days=days_into_year)
        # Ensure it's a weekday
        while first_ts.weekday() >= 5:
            first_ts += timedelta(days=1)
        first_ts = first_ts.replace(
            hour=random.randint(8, 17),
            minute=random.randint(0, 59),
        )

        touches = []
        ts = first_ts
        for tn in range(1, touch_count + 1):
            touch = build_touch(tn, touch_count, ts, primary_channel)
            touches.append(touch)
            if tn < touch_count:
                ts = random_business_datetime(ts)

        is_mql, mql_touch_idx = compute_mql(seniority_tier, touches)

        is_opp        = is_mql and random.random() < 0.45
        is_closed_won = is_opp and random.random() < 0.35
        pipeline_value = round(random.randint(35000, 120000) * seniority_mult * 0.0225) if is_opp else 0

        prospects.append({
            "prospect_id":    prospect_id,
            "full_name":      full_name,
            "title":          title,
            "seniority_tier": seniority_tier,
            "seniority_mult": seniority_mult,
            "company":        company,
            "is_mql":         is_mql,
            "is_opp":         is_opp,
            "is_closed_won":  is_closed_won,
            "pipeline_value": pipeline_value,
            "touches":        touches,
        })

    return prospects


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


def save_csv(prospects, path):
    fieldnames = PROSPECT_FIELDS + FLAT_TOUCH_FIELDS
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for p in prospects:
            base = {k: p[k] for k in PROSPECT_FIELDS}
            for touch in p["touches"]:
                row = {**base, **touch}
                writer.writerow(row)


def print_summary(prospects, attribution):
    total   = len(prospects)
    mqls    = sum(1 for p in prospects if p["is_mql"])
    opps    = sum(1 for p in prospects if p["is_opp"])
    won     = sum(1 for p in prospects if p["is_closed_won"])
    pipeline = sum(p["pipeline_value"] for p in prospects)

    print("\n" + "=" * 60)
    print("SUMMARY STATS")
    print("=" * 60)
    print(f"  Prospects:      {total:,}")
    print(f"  MQLs:           {mqls:,}  ({mqls/total*100:.1f}%)")
    print(f"  Opportunities:  {opps:,}  ({opps/mqls*100:.1f}% of MQLs)" if mqls else f"  Opportunities:  {opps}")
    print(f"  Closed Won:     {won:,}  ({won/opps*100:.1f}% of Opps)" if opps else f"  Closed Won:     {won}")
    print(f"  Total Pipeline: ${pipeline:,.0f}")

    print("\nSeniority distribution:")
    for tier, prob, mult, _ in SENIORITY_TIERS:
        count = sum(1 for p in prospects if p["seniority_tier"] == tier)
        print(f"  {tier:<18} {count:>5}  ({count/total*100:.1f}%)")

    print("\nChannel pipeline credit (U-Shaped):")
    u = attribution["u_shaped"]
    total_credit = sum(u.values())
    for ch, credit in sorted(u.items(), key=lambda x: -x[1]):
        pct = credit / total_credit * 100 if total_credit else 0
        print(f"  {ch:<16} ${credit:>12,.2f}  ({pct:.1f}%)")

    print("\nAttribution model totals:")
    for model, data in attribution.items():
        total_m = sum(data.values())
        print(f"  {model:<16} ${total_m:>12,.2f}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    os.makedirs("data", exist_ok=True)

    total_prospects = sum(PRIMARY_CHANNEL_COUNTS.values())
    print(f"Generating {total_prospects:,} Syncflow prospects (seed=42)...")
    prospects = generate_prospects(total_prospects)

    print("\nSaving data/prospects.json...")
    with open("data/prospects.json", "w", encoding="utf-8") as f:
        json.dump(prospects, f, indent=2)

    print("Saving data/prospects.csv...")
    save_csv(prospects, "data/prospects.csv")

    print("Computing attribution models...")
    attribution = compute_attribution(prospects)

    print("Saving data/attribution_results.json...")
    with open("data/attribution_results.json", "w", encoding="utf-8") as f:
        json.dump(attribution, f, indent=2)

    print_summary(prospects, attribution)
    print("\nDone. Files written to ./data/")


if __name__ == "__main__":
    main()
