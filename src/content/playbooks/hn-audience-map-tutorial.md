---
title: "Building an Audience Map for Channel Expansion"
description: "A practical walkthrough for digital, growth, and performance marketers who want to know whether a new channel is worth their time and spend — before they spend."
publishDate: 2026-05-01
tags: ["Tutorial", "Audience Research", "HN Analysis"]
collection: playbooks
---

![HN Audience Overlap Map](/hn_audience_map.png)

## Why I built this

I was doing channel research on a target company that mentioned Reddit as a place they were exploring. I wanted to understand which competitors share an audience, and the engagement volume.

Thanks to Reddit's 2023+ API restrictions, I had to abandon the idea since I did not have enterprise access. So I pivoted to the closest high-signal channel for a technical, infrastructure buying audience: **Hacker News**. HN has an open Algolia-backed API and the kind of audience that maps cleanly to a B2B buyer journey.

The result is a network map where companies are nodes and shared commenters are edges, indicating which competitors and adjacent tools share an audience. Useful before you decide where to spend.

This tutorial walks you through how to build the same thing for your own market. No coding background required. Plan on ~2 hours your first time through.

---

## Who this is for

Digital, growth, and performance marketers who want a methodology for evaluating a new channel before they commit budget to it. If you've ever sat in a planning meeting and someone asked "Should we try Reddit / HN / Product Hunt?" and the answer was a vibe rather than data, this is for you.

You don't need to know how to code. You do need to be willing to copy and paste a few commands into a terminal window.

---

## What you'll need

- A Mac or any computer (Windows works with minor adjustments)
- ~2 hours (the data pull runs in the background)
- A GitHub account (free)
- Python 3.9 or newer (free and quick install)
- A list of 20–40 companies you want to map

No paid tools, no API keys, no scraping. HN's API is open.

---

## An aside on using AI for this

I built this with Claude as my coding pair. I'm a marketer, not an engineer. My opinion: **marketers should be using AI as much as possible, but they should be driving the strategy, dictating the vision, and reviewing every step and the final output.**

The AI is the leverage, the tool. You are the operator. Use the AI to write the code — don't outsource the thinking.

---

## Step 1 — Pick your domains (this is the GTM work)

This is the single most important step. The map is only as good as the list you feed it.

The framework I use is **four concentric rings around your anchor company**:

- **Ring 1 — Direct competitors.** Who does your sales team compete against?
- **Ring 2 — Adjacent tooling.** What the buyer uses alongside you.
- **Ring 3 — Upstream / dependencies.** What sits beneath you in the stack.
- **Ring 4 — Broader peripheral context.** Where the audience hangs out even when they're not talking about your category.

**Aim for 30–40 domains.** Fewer than 20 = the map looks empty. More than 50 = the visual becomes unreadable.

Practical rules:
- Use root domains (`example.com`), not subdomains
- Lowercase everything
- Be honest about including your own anchor company — if the absence is interesting, leave it in

Save your list in a Google Sheet with three columns: `domain`, `ring`, `why it matters`. The third column forces you to articulate why each domain belongs.

---

## Step 2 — Set up your environment

Open Terminal (`Cmd + Space`, type `terminal`, hit Enter).

Check Python:

```bash
python3 --version
```

If you see `Python 3.9.x` or higher, you're set. Then install the libraries:

```bash
pip3 install requests pandas networkx matplotlib
```

Create a GitHub repo, then clone it locally:

```bash
cd ~/Documents
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
mkdir data
```

---

## Step 3 — Pull the data

Create `fetch_hn_data.py` and paste this in:

```python
import requests
import json
import time
from urllib.parse import urlparse
from pathlib import Path

DOMAINS = [
    "example1.com",
    "example2.com",
    "example3.com",
]

MONTHS_BACK = 12
SECONDS_PER_DAY = 86400
CUTOFF_TIMESTAMP = int(time.time()) - (MONTHS_BACK * 30 * SECONDS_PER_DAY)
HN_SEARCH_URL = "https://hn.algolia.com/api/v1/search_by_date"
SLEEP_BETWEEN_REQUESTS = 1
OUTPUT_DIR = Path("data")
OUTPUT_DIR.mkdir(exist_ok=True)

def url_matches_domain(url, domain):
    if not url:
        return False
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return False
    return host == domain or host.endswith("." + domain)

def fetch_stories_for_domain(domain):
    stories, seen_urls = [], set()
    page, hits_per_page = 0, 100
    consecutive_empty_pages, MAX_EMPTY_PAGES = 0, 3
    while True:
        params = {
            "tags": "story",
            "numericFilters": f"created_at_i>{CUTOFF_TIMESTAMP}",
            "query": domain,
            "restrictSearchableAttributes": "url",
            "hitsPerPage": hits_per_page,
            "page": page,
        }
        try:
            response = requests.get(HN_SEARCH_URL, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException:
            break
        hits = data.get("hits", [])
        if not hits:
            break
        matches = 0
        for hit in hits:
            url = hit.get("url", "") or ""
            if url_matches_domain(url, domain):
                url_lower = url.lower()
                if url_lower not in seen_urls:
                    seen_urls.add(url_lower)
                    stories.append({
                        "story_id": hit.get("objectID"),
                        "title": hit.get("title"),
                        "url": url,
                        "author": hit.get("author"),
                        "points": hit.get("points", 0),
                        "created_at": hit.get("created_at"),
                    })
                    matches += 1
        if matches == 0:
            consecutive_empty_pages += 1
            if consecutive_empty_pages >= MAX_EMPTY_PAGES:
                break
        else:
            consecutive_empty_pages = 0
        if len(hits) < hits_per_page or page > 30:
            break
        page += 1
        time.sleep(SLEEP_BETWEEN_REQUESTS)
    return stories

def fetch_commenters_for_story(story_id):
    url = f"https://hn.algolia.com/api/v1/items/{story_id}"
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException:
        return set()
    commenters = set()
    def walk(node):
        if not node:
            return
        if node.get("author"):
            commenters.add(node["author"])
        for child in node.get("children", []):
            walk(child)
    walk(data)
    commenters.discard(data.get("author"))
    return commenters

def main():
    print(f"Pulling {len(DOMAINS)} domains, {MONTHS_BACK}-month window\n")
    results = {}
    for i, domain in enumerate(DOMAINS, 1):
        print(f"[{i}/{len(DOMAINS)}] {domain}")
        stories = fetch_stories_for_domain(domain)
        all_commenters = set()
        for story in stories:
            all_commenters.update(fetch_commenters_for_story(story["story_id"]))
            time.sleep(SLEEP_BETWEEN_REQUESTS)
        results[domain] = {
            "story_count": len(stories),
            "commenter_count": len(all_commenters),
            "commenters": sorted(all_commenters),
            "stories": stories,
        }
        print(f"  {len(stories)} stories, {len(all_commenters)} commenters\n")
    with open(OUTPUT_DIR / "hn_raw_data.json", "w") as f:
        json.dump(results, f, indent=2)
    print("Saved to data/hn_raw_data.json")

if __name__ == "__main__":
    main()
```

Run it:

```bash
python3 fetch_hn_data.py
```

This takes 30–60 minutes for 30 domains. Walk away — the script prints progress as it goes.

---

## Step 4 — Compute the overlap matrix

Create `compute_overlap.py`:

```python
import json
from pathlib import Path
from itertools import combinations

DATA_DIR = Path("data")
INPUT_FILE = DATA_DIR / "hn_raw_data.json"
OUTPUT_FILE = DATA_DIR / "overlap_matrix.json"

def main():
    with open(INPUT_FILE) as f:
        data = json.load(f)
    commenter_sets = {d: set(info["commenters"]) for d, info in data.items()}
    domains = list(commenter_sets.keys())
    edges = []
    for d1, d2 in combinations(domains, 2):
        set1, set2 = commenter_sets[d1], commenter_sets[d2]
        shared = set1 & set2
        if not shared:
            continue
        union = set1 | set2
        jaccard = len(shared) / len(union) if union else 0
        smaller = min(len(set1), len(set2))
        overlap_coef = len(shared) / smaller if smaller else 0
        edges.append({
            "source": d1, "target": d2,
            "shared_commenters": len(shared),
            "jaccard": round(jaccard, 4),
            "overlap_coefficient": round(overlap_coef, 4),
            "source_size": len(set1),
            "target_size": len(set2),
        })
    edges.sort(key=lambda x: x["shared_commenters"], reverse=True)
    nodes = [{
        "domain": d,
        "story_count": data[d]["story_count"],
        "commenter_count": data[d]["commenter_count"],
    } for d in domains]
    with open(OUTPUT_FILE, "w") as f:
        json.dump({"nodes": nodes, "edges": edges}, f, indent=2)
    print(f"Top overlaps:\n")
    for edge in edges[:15]:
        print(f"  {edge['source']:<20} <-> {edge['target']:<20} "
              f"{edge['shared_commenters']:>5} shared "
              f"(overlap coef: {edge['overlap_coefficient']:.3f})")

if __name__ == "__main__":
    main()
```

Run it:

```bash
python3 compute_overlap.py
```

Read the terminal output carefully before moving on. It often surfaces the most interesting structures before you even see the visual.

---

## Step 5 — Visualize

Create `visualize_static.py`, edit `FOCUS_DOMAINS` and `ANCHOR_DOMAIN` to match your list, then run:

```bash
python3 visualize_static.py
open audience_map.png
```

The map uses:
- **Green lines** = audience movement within your focus cluster
- **Blue circles** = focus cluster companies
- **Gray circles** = broader market context
- **Orange circle** = your anchor company
- **Circle size** = total HN commenters

---

## Step 6 — Read the map

Three things to look at, in order:

**1. Where does your company sit?** If your anchor is isolated, the absence is the finding — the audience exists adjacent to your competitors, but you're not in it.

**2. Where's the gravitational hub?** One or two nodes will have edges to almost everything else. That's the room your audience is already in.

**3. Which clusters separate?** What looks like one audience is often two. In my example, AI-infra companies clustered separately from the foundation-model giants — same broad market, different rooms. Real implications for content strategy and paid targeting.

---

## Caveats

- Shared commenters approximate shared audience, not causal influence
- Some commenters are probably the companies themselves (engineers, founders)
- HN skews technical and US-centric — one signal, not the whole market
- The 12-month window matters — 6 months missed slower-posting companies entirely
- Edge thresholds are a choice: lower = denser map, higher = cleaner clusters

---

## Three real ways to use this on the job

**1. Pre-spend channel audit.** Before allocating budget to a new channel, run the audience map first. If your buyer's adjacent communities aren't there, you're paying to reach the wrong audience. Map before you buy.

**2. Competitive intel for ABM list-building.** The companies most overlapping with yours are often signaling shared ICP. Use the top overlapping domains as a research input for tier-1 account list refinement.

**3. Earned-presence prioritization.** The hub nodes are where the audience already congregates. Show HN launches, technical deep-dives, founder participation in adjacent threads — cheaper than paid, higher signal, compounds over time.

---

*Code, sample data, and the full analysis are in the [hn-audience-map repo](https://github.com/Jvrcg/hn-audience-map). Built with Python and Claude as a coding pair.*
