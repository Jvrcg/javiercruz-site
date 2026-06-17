---
title: "SEO Audit Log: OG Images, H1s, and What Google Sees on a New Site"
description: "A documented first audit of jjcruzgalera.com covering OG image setup, H1 targeting, and Search Console baselines. Five issues found, two fixed in the same session."
publishDate: 2026-06-17
tags: ["Lab Notes", "SEO", "AEO", "Audit"]
ogImage: "https://jjcruzgalera.com/og-image.png"
---

## What this is

This site is a public SEO and GEO experiment. That means documenting what gets tested,
what gets fixed, and what the data shows, including the starting point when the numbers
are embarrassing.

This is the first audit log. It covers what was found, what was fixed, and what the
baseline looks like before any of it has time to compound.

---

## The baseline: what Google sees right now

Before touching anything, here is what Google Search Console showed for jjcruzgalera.com
as of June 17, 2026, across a 3-month window:

- Total clicks: 1
- Total impressions: 7
- Average CTR: 14.3%
- Average position: 5.6
- Pages indexed: 1 (the homepage only)

One page indexed out of five crawled. Seven impressions. One click. That is the starting
point.

The 14.3% CTR is the one number worth noting. When the site did appear in results, someone
clicked. That suggests the result was relevant to the query, even if the query data is too
thin to surface in the console yet. Position 5.6 on a brand new domain with no inbound
links is also a reasonable starting point.

Everything else is a gap to close.

---

## Five issues found

The audit covered the homepage, all three playbook posts, the Lab Notes index, the About
page, and the Tools section. Five issues identified, prioritized by impact:

**1. OG image was broken sitewide.** Every page was passing `favicon.png` as the Open
Graph image instead of a proper 1200x630 image. The bug was in `BaseLayout.astro`: the
`ogImage` prop was declared and defaulted correctly, but both the `og:image` and
`twitter:image` meta tags were hardcoded to the favicon path, ignoring the prop entirely.
Every link shared from this site was generating a broken social preview card.

**2. H1s and meta descriptions were not targeting any searchable query.** The homepage H1
was "Performance marketing, in the open." A strong brand line. A useless SEO signal. None
of the top-level pages contained a phrase that a practitioner would actually type into
Google or an AI engine.

**3. Lab Notes is empty but indexed.** The section exists, it is in the sitemap, Google
can crawl it, and it says "First posts coming soon." An empty indexed page is a mild crawl
budget waste and a real E-E-A-T problem.

**4. No structured data on playbook posts.** The playbook posts are long-form,
step-by-step content. Neither HowTo schema nor Article schema is present on any of them.
For AEO specifically, structured data is how you signal to Google and AI engines that a
page is the canonical answer to a procedural question.

**5. Zero inbound links.** No external sites linking to any page. For both SEO and GEO,
external citation is the multiplier. Without it, even well-optimized content stays
invisible to discovery.

---

## What was fixed in this session

**OG image:** Designed a 1200x630 dark background image matching the site footer
(`#1a1a19`), with the J lettermark, site headline, byline, and blue accent bar (`#2563eb`).
Uploaded to `public/og-image.png`. A Claude Code prompt was written to fix the meta tag
bug in `BaseLayout.astro` so the `{ogImage}` variable is used instead of the hardcoded
favicon path.

**Homepage H1 and meta description:** H1 updated from "Performance marketing, in the
open." to "B2B Paid Media Playbooks for Performance Marketers." The original brand line
is retained as an h2 subheading directly below. Meta description updated to: "Practical
playbooks, tools, and honest writing on paid media attribution, A/B testing, and growth
marketing for B2B SaaS marketers."

Both changes are live on main as of today.

---

## What is still open

- BaseLayout meta tag fix: Claude Code prompt written, not yet committed
- Lab Notes: this post resolves the empty section problem
- HowTo and Article schema on playbook posts
- Inbound links: zero, no fix for this in a single session

---

## The hypothesis

Fixing the OG image and H1 targeting will improve indexed page count and average position
within 60 days. (Fingers crossed.)

The next audit log will run in 30 days against the same Search Console metrics used here
as a baseline.
