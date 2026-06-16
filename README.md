# B2B A/B Test Statistical Significance Calculator

A frequentist z-test calculator built for paid media and growth marketers. Enter your visitor and conversion counts for each variation, select your confidence threshold, and get a plain-English result.

Live tool: [jjcruzgalera.com/tools/ab-test](https://jjcruzgalera.com/tools/ab-test)

---

## Why I built this

Most A/B test calculators are built for product and CRO teams running high-volume web experiments. Paid media operates differently: smaller sample sizes, higher CPLs, and decisions that need to be made before you hit the sample sizes those tools assume.

I wanted a calculator that reflects how performance marketers actually work, with guidance calibrated to paid media realities rather than e-commerce conversion rates.

---

## What it does

- Runs a two-proportion z-test on Variation A (control) and Variation B (test)
- Works with any metric pair across the funnel. X is your input (clicks, impressions, sessions, leads) and Y is your output (leads, MQLs, signups, closed-won). If you can count it at two stages of a funnel, you can test it.
- Four confidence thresholds: 80%, 90%, 95%, 99%
- Returns a plain-English result with the observed lift and whether it clears your chosen confidence threshold
- When a test is not yet significant, returns the estimated additional X volume needed per variation to reach your chosen confidence threshold at 80% statistical power, so you know whether to keep running or reassess the test design
- Includes guidance on confidence level selection by growth stage, sample size expectations by channel, and how to think about testing at different stages of a program

---

## How it works

The calculator uses a standard two-proportion z-test:

1. Calculates the conversion rate for each variation (conversions / visitors)
2. Computes a pooled proportion across both variations
3. Derives the standard error from the pooled proportion and sample sizes
4. Calculates a z-score from the difference in conversion rates
5. Maps the z-score to a p-value and evaluates it against your chosen confidence threshold

Sample size estimates include 80% statistical power (z=0.84), meaning the test has an 80% probability of detecting a real difference if one exists. This is the industry standard assumption for experiment design.

No external stats libraries. The math runs entirely in the browser.

---

## Confidence level guide

| Threshold | When to use |
|-----------|-------------|
| 80% | Directional signal. Reasonable to act at early stage or when budget at stake is low. |
| 90% | Strong signal. Appropriate for most paid media optimization decisions. |
| 95% / 99% | Higher confidence threshold. Appropriate when the decision carries significant budget or risk. |

---

## Tech stack

- React (functional component with hooks)
- Tailwind CSS
- Deployed as part of an Astro v6 portfolio site on Vercel

---

## Usage

The component accepts no props and manages all state internally. To use it in your own project:

1. Copy `ABTestCalculator.jsx` into your components directory
2. Import and render it on any page
3. Tailwind CSS is required for styling

---

## Related work

- [HN Audience Map](https://github.com/Jvrcg/hn-audience-map): A Python tool for mapping audience overlap across companies on Hacker News, built for channel expansion research
- [B2B Attribution Simulator](https://jjcruzgalera.com/tools/attribution): An interactive multi-touch attribution model across LinkedIn, Google Ads, G2, and programmatic

---

Built by [Javier Cruz Galera](https://jjcruzgalera.com). Senior B2B paid media and demand generation marketer.
