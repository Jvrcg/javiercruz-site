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

![Search Console performance baseline, June 2026](/images/lab-notes/search-console-performance-baseline.png)

One page indexed out of five crawled. Seven impressions. One click. That is the starting
point.

The 14.3% CTR is the one number worth noting. When the site did appear in results, someone
clicked (thank you for your kindness, and we haven't even made it to page 2 yet). That
suggests the result was relevant to the query, even if the query data is too thin to
surface in the console yet. Position 5.6 on a brand new domain with no inbound links is
also a reasonable starting point.

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
was "Performance marketing, in the open." A strong brand line, but a useless SEO signal.
None of the top-level pages contained a phrase that a practitioner would actually type into
Google or an AI engine.

**3. Lab Notes is empty but indexed.** The section exists, it is in the sitemap, Google
can crawl it, and it says "First posts coming soon." An empty indexed page is a mild crawl
budget waste and a real E-E-A-T problem.

**4. No structured data on playbook posts.** The playbook posts are long-form,
step-by-step content. Neither the HowTo schema nor the Article schema is present on any
of them. For AEO specifically, structured data is how you signal to Google and AI engines
that a page is the canonical answer to a procedural question.

**5. Zero inbound links.** No external sites linking to any page. For both SEO and GEO,
external citation is the multiplier. Without it, even well-optimized content stays
invisible to discovery. This one will take awhile, since I'm going to avoid posting on
LinkedIn.

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

---

## Terminology

**OG image (Open Graph image):** A 1200x630 pixel image attached to a page via meta tags
that platforms like LinkedIn, Slack, and X use to generate link preview cards. Without one,
shared links render as broken or blank previews.

**H1:** The primary heading tag on a webpage. Search engines weight it heavily when
determining what a page is about. One H1 per page, and it should contain the core keyword
phrase you want the page to rank for.

**Meta description:** The short text snippet that appears below a page title in search
results. It does not directly affect rankings but influences click-through rate. It should
match the search intent of the query you are targeting.

**E-E-A-T:** Experience, Expertise, Authoritativeness, and Trustworthiness. Google's
framework for evaluating content quality. A site with original data, a named author, and
external citations scores higher than anonymous, derivative content.

**Structured data:** Code added to a page in JSON-LD format that explicitly tells search
engines what type of content the page contains: an article, a how-to guide, a product, a
person. For AEO, it increases the probability that your content gets surfaced as a direct
answer.

**AEO (Answer Engine Optimization):** The practice of structuring content so it gets
selected as a direct answer in search results, featured snippets, People Also Ask boxes,
and AI-generated responses.

**GEO (Generative Engine Optimization):** The practice of optimizing content so it gets
cited or referenced in AI-generated answers from tools like ChatGPT, Perplexity, Google
AI Overviews, and Claude. Original data, named authorship, and external citations are the
strongest signals.
