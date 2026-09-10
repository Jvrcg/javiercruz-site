"""
seasonality.py
Shared monthly seasonality index used to drive lead-seeding volume in
generate_dataset.py and to display pacing targets in generate_template.py.
Both scripts import this module so the two stay in sync automatically.
"""

SEASONALITY_INDEX = [
    ("Jan", 0.069),
    ("Feb", 0.081),
    ("Mar", 0.096),
    ("Apr", 0.094),
    ("May", 0.089),
    ("Jun", 0.078),
    ("Jul", 0.067),
    ("Aug", 0.071),
    ("Sep", 0.104),
    ("Oct", 0.115),
    ("Nov", 0.096),
    ("Dec", 0.040),
]

_total = round(sum(v for _, v in SEASONALITY_INDEX), 3)
assert _total == 1.000, f"SEASONALITY_INDEX must sum to 1.000, got {_total}"

SEASONALITY_INDEX_MAP = dict(SEASONALITY_INDEX)

# Fiscal reporting window, in calendar order (Feb 2025 - Jan 2026).
FISCAL_MONTHS = [
    (2025, 2), (2025, 3), (2025, 4), (2025, 5), (2025, 6), (2025, 7),
    (2025, 8), (2025, 9), (2025, 10), (2025, 11), (2025, 12), (2026, 1),
]
FISCAL_MONTH_NAMES = ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"]

# Annual pacing goals (targets, not tuned constants) and per-month attainment
# curves. monthly_goal(month) = ANNUAL_GOAL * SEASONALITY_INDEX[month];
# monthly_actual(month) = monthly_goal(month) * ATTAINMENT[month].
# Three separate attainment curves so the metrics can diverge month to month
# (a real program does not hit MQL/PQL/pipeline pacing identically) — that
# divergence is what the Pacing tab is meant to surface.
ANNUAL_MQL_GOAL = 2350
ANNUAL_PQL_GOAL = 4400
ANNUAL_PIPELINE_GOAL = 5040000

ATTAINMENT_MQL = {
    "Feb": 1.048, "Mar": 0.78, "Apr": 1.09, "May": 1.06, "Jun": 1.058,
    "Jul": 0.998, "Aug": 1.078, "Sep": 1.048, "Oct": 1.06, "Nov": 1.018,
    "Dec": 1.028, "Jan": 1.038,
}

ATTAINMENT_PQL = {
    "Feb": 1.02, "Mar": 1.04, "Apr": 1.00, "May": 1.03, "Jun": 0.99,
    "Jul": 1.05, "Aug": 1.01, "Sep": 1.03, "Oct": 1.06, "Nov": 0.98,
    "Dec": 1.02, "Jan": 1.04,
}

ATTAINMENT_PIPELINE = {
    "Feb": 1.05, "Mar": 1.02, "Apr": 1.06, "May": 0.98, "Jun": 0.92,
    "Jul": 1.00, "Aug": 1.07, "Sep": 1.02, "Oct": 1.12, "Nov": 1.01,
    "Dec": 1.04, "Jan": 0.99,
}


def monthly_targets(annual_goal, attainment_curve):
    """Return {(year, month): actual_count_or_amount} for the fiscal window."""
    targets = {}
    for (year, month), name in zip(FISCAL_MONTHS, FISCAL_MONTH_NAMES):
        goal = annual_goal * SEASONALITY_INDEX_MAP[name]
        targets[(year, month)] = goal * attainment_curve[name]
    return targets
