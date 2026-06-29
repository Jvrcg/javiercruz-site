# Job Search Scraper

Daily digest of paid media / growth marketing roles from BuiltIn, Wellfound, YC Work at a Startup, TrueUp, and Jack & Jill Jobs. Runs automatically every weekday morning via GitHub Actions and emails new matches.

---

## Setup (one-time, ~10 minutes)

### 1. Create a new GitHub repo

Create a new **private** repo (e.g. `job-search-scraper`). Push these files to it:

```
job_scraper.py
requirements.txt
seen_jobs.json        <- create this as an empty file: []
.github/
  workflows/
    daily_job_digest.yml
```

### 2. Create a Gmail App Password

You need a Gmail account and a dedicated App Password (not your regular password).

1. Go to your Google Account > Security
2. Enable 2-Step Verification if not already on
3. Go to Security > App Passwords
4. Create one called "Job Scraper" — copy the 16-character password

### 3. Add GitHub Secrets

In your repo: Settings > Secrets and variables > Actions > New repository secret

Add these three:

| Secret name       | Value                            |
|-------------------|----------------------------------|
| `SENDER_EMAIL`    | your.gmail@gmail.com             |
| `SENDER_PASSWORD` | the 16-char App Password         |
| `RECIPIENT_EMAIL` | where you want the digest sent   |

### 4. Initialize seen_jobs.json

Create an empty file called `seen_jobs.json` in the repo root with this content:

```json
[]
```

### 5. Test it manually

Go to your repo > Actions tab > "Daily Job Search Digest" > Run workflow.
Check your inbox. If no jobs show up in email, check the Actions log for scrape output.

---

## How it works

- Scrapes 5 job boards using BeautifulSoup
- Matches titles against 7 keyword patterns
- Tracks previously seen jobs in `seen_jobs.json` so you only get truly new listings
- Sends an HTML email digest with job title, company, and source link
- Runs weekdays at 8 AM Pacific via GitHub Actions cron (free for public/private repos)

---

## Keyword targets

- senior paid media manager
- senior digital marketing manager
- senior performance marketing manager
- paid media manager
- growth marketing manager
- senior growth marketing manager
- senior acquisition marketing manager

---

## Adding more boards

To add a new source, add a scraper function following the same pattern as the existing ones and call it in `main()`. The deduplication and email logic handles the rest automatically.

---

## Notes

- LinkedIn is intentionally excluded — they actively block scrapers and terms of service prohibit it. Use LinkedIn's built-in job alerts for that board.
- seen_jobs.json is committed back to the repo after each run so state persists across GitHub Actions runs (which are stateless VMs).
