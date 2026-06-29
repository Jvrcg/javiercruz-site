"""
Daily Job Search Scraper
Searches BuiltIn, Wellfound, YC Work at a Startup, and TrueUp
for paid media / growth marketing roles matching Javier's profile.
Sends a daily email digest of new listings.
"""

import os
import json
import hashlib
import smtplib
import datetime
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from bs4 import BeautifulSoup
from urllib.parse import urlencode, quote_plus
import time
import re

# ── CONFIG ──────────────────────────────────────────────────────────────────

SENDER_EMAIL    = os.environ.get("SENDER_EMAIL")     # your gmail address
SENDER_PASSWORD = os.environ.get("SENDER_PASSWORD")  # gmail app password
RECIPIENT_EMAIL = os.environ.get("RECIPIENT_EMAIL")  # where to send digest

KEYWORDS = [
    "senior paid media manager",
    "senior digital marketing manager",
    "senior performance marketing manager",
    "paid media manager",
    "growth marketing manager",
    "senior growth marketing manager",
    "senior acquisition marketing manager",
]

# Seen jobs file — committed back to repo so duplicates are suppressed
SEEN_FILE = "seen_jobs.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

# ── UTILITIES ────────────────────────────────────────────────────────────────

def load_seen():
    if os.path.exists(SEEN_FILE):
        with open(SEEN_FILE) as f:
            return set(json.load(f))
    return set()


def save_seen(seen):
    with open(SEEN_FILE, "w") as f:
        json.dump(list(seen), f)


def job_id(title, company, url):
    raw = f"{title.lower().strip()}|{company.lower().strip()}|{url.strip()}"
    return hashlib.md5(raw.encode()).hexdigest()


def title_matches(title):
    title_lower = title.lower()
    for kw in KEYWORDS:
        # fuzzy: all words in the keyword must appear in the title
        words = kw.split()
        if all(w in title_lower for w in words):
            return True
    return False


def clean(text):
    return re.sub(r"\s+", " ", text).strip()

# ── SCRAPERS ─────────────────────────────────────────────────────────────────

def scrape_builtin():
    """BuiltIn job search — marketing category, filtered by keyword."""
    jobs = []
    search_terms = [
        "paid+media+manager",
        "performance+marketing+manager",
        "growth+marketing+manager",
    ]
    for term in search_terms:
        url = f"https://builtin.com/jobs?search={term}&seniority=mid&seniority=senior"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            soup = BeautifulSoup(resp.text, "html.parser")
            cards = soup.select("article[data-id]") or soup.select("div[data-testid='job-card']")
            for card in cards[:30]:
                title_el = card.select_one("h2, h3, [data-testid='job-title']")
                company_el = card.select_one("[data-testid='company-title'], .company-name, .company")
                link_el = card.select_one("a[href]")
                if not title_el:
                    continue
                title   = clean(title_el.get_text())
                company = clean(company_el.get_text()) if company_el else "Unknown"
                href    = link_el["href"] if link_el else ""
                full_url = href if href.startswith("http") else f"https://builtin.com{href}"
                if title_matches(title):
                    jobs.append({"title": title, "company": company, "url": full_url, "source": "BuiltIn"})
        except Exception as e:
            print(f"BuiltIn error ({term}): {e}")
        time.sleep(1)
    return jobs


def scrape_wellfound():
    """Wellfound public role search pages."""
    jobs = []
    role_slugs = [
        "performance-marketing-manager",
        "growth-marketing-manager",
        "paid-media-manager",
        "digital-marketing-manager",
    ]
    for slug in role_slugs:
        url = f"https://wellfound.com/role/l/{slug}"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            soup = BeautifulSoup(resp.text, "html.parser")
            # Wellfound embeds Apollo JSON in a script tag
            scripts = soup.find_all("script", {"type": "application/json"})
            for script in scripts:
                try:
                    data = json.loads(script.string or "{}")
                    # Walk the Apollo cache looking for job objects
                    for key, val in data.items():
                        if isinstance(val, dict) and val.get("__typename") == "JobListing":
                            title   = val.get("title", "")
                            company = val.get("startup", {}).get("name", "Unknown") if isinstance(val.get("startup"), dict) else "Unknown"
                            slug_j  = val.get("slug", "")
                            job_url = f"https://wellfound.com/jobs/{slug_j}" if slug_j else url
                            if title_matches(title):
                                jobs.append({"title": title, "company": company, "url": job_url, "source": "Wellfound"})
                except Exception:
                    pass
            # Fallback: parse HTML cards
            cards = soup.select("div[class*='styles_jobCard'], a[class*='job']")
            for card in cards[:30]:
                title_el   = card.select_one("h3, h4, [class*='title']")
                company_el = card.select_one("[class*='company'], [class*='startup']")
                link_el    = card if card.name == "a" else card.select_one("a[href]")
                if not title_el:
                    continue
                title   = clean(title_el.get_text())
                company = clean(company_el.get_text()) if company_el else "Unknown"
                href    = link_el["href"] if link_el else ""
                full_url = href if href.startswith("http") else f"https://wellfound.com{href}"
                if title_matches(title):
                    jobs.append({"title": title, "company": company, "url": full_url, "source": "Wellfound"})
        except Exception as e:
            print(f"Wellfound error ({slug}): {e}")
        time.sleep(2)
    return jobs


def scrape_yc():
    """YC Work at a Startup job board — JSON-backed."""
    jobs = []
    url = "https://www.workatastartup.com/jobs?role=marketing&jobType=fulltime"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")
        # Try structured data first
        script = soup.find("script", id="__NEXT_DATA__") or soup.find("script", {"type": "application/json"})
        if script and script.string:
            try:
                data = json.loads(script.string)
                job_list = (
                    data.get("props", {}).get("pageProps", {}).get("jobs", [])
                    or data.get("jobs", [])
                )
                for j in job_list:
                    title   = j.get("title", "") or j.get("job_title", "")
                    company = j.get("company", {}).get("name", "Unknown") if isinstance(j.get("company"), dict) else j.get("company_name", "Unknown")
                    slug    = j.get("slug", "") or str(j.get("id", ""))
                    job_url = f"https://www.workatastartup.com/jobs/{slug}" if slug else url
                    if title_matches(title):
                        jobs.append({"title": title, "company": company, "url": job_url, "source": "YC Work at a Startup"})
            except Exception:
                pass
        # HTML fallback
        cards = soup.select("div[class*='job-card'], li[class*='job']")
        for card in cards[:40]:
            title_el   = card.select_one("h3, h4, [class*='title']")
            company_el = card.select_one("[class*='company']")
            link_el    = card.select_one("a[href]")
            if not title_el:
                continue
            title   = clean(title_el.get_text())
            company = clean(company_el.get_text()) if company_el else "Unknown"
            href    = link_el["href"] if link_el else ""
            full_url = href if href.startswith("http") else f"https://www.workatastartup.com{href}"
            if title_matches(title):
                jobs.append({"title": title, "company": company, "url": full_url, "source": "YC Work at a Startup"})
    except Exception as e:
        print(f"YC error: {e}")
    return jobs


def scrape_trueup():
    """TrueUp job search — marketing category."""
    jobs = []
    terms = [
        "paid media manager",
        "performance marketing manager",
        "growth marketing manager",
    ]
    for term in terms:
        url = f"https://www.trueup.io/job-openings?q={quote_plus(term)}&category=marketing"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            soup = BeautifulSoup(resp.text, "html.parser")
            cards = soup.select("a[href*='/job/'], div[class*='job']")
            for card in cards[:30]:
                title_el   = card.select_one("h2, h3, h4, [class*='title']")
                company_el = card.select_one("[class*='company']")
                link_el    = card if card.name == "a" else card.select_one("a[href]")
                if not title_el:
                    continue
                title   = clean(title_el.get_text())
                company = clean(company_el.get_text()) if company_el else "Unknown"
                href    = link_el["href"] if link_el else ""
                full_url = href if href.startswith("http") else f"https://www.trueup.io{href}"
                if title_matches(title):
                    jobs.append({"title": title, "company": company, "url": full_url, "source": "TrueUp"})
        except Exception as e:
            print(f"TrueUp error ({term}): {e}")
        time.sleep(1)
    return jobs


def scrape_jacknjill():
    """Jack & Jill Jobs — startup marketing roles."""
    jobs = []
    url = "https://www.jackandjilljobs.com/jobs?category=Marketing"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")
        cards = soup.select("div[class*='job'], li[class*='job'], article")
        for card in cards[:40]:
            title_el   = card.select_one("h2, h3, h4, [class*='title'], [class*='position']")
            company_el = card.select_one("[class*='company'], [class*='employer']")
            link_el    = card.select_one("a[href]")
            if not title_el:
                continue
            title   = clean(title_el.get_text())
            company = clean(company_el.get_text()) if company_el else "Unknown"
            href    = link_el["href"] if link_el else ""
            full_url = href if href.startswith("http") else f"https://www.jackandjilljobs.com{href}"
            if title_matches(title):
                jobs.append({"title": title, "company": company, "url": full_url, "source": "Jack & Jill Jobs"})
    except Exception as e:
        print(f"Jack & Jill error: {e}")
    return jobs

# ── EMAIL ────────────────────────────────────────────────────────────────────

def build_html_email(new_jobs):
    date_str = datetime.date.today().strftime("%B %d, %Y")
    rows = ""
    for j in new_jobs:
        rows += f"""
        <tr>
          <td style="padding:10px 8px; border-bottom:1px solid #eee;">
            <a href="{j['url']}" style="color:#1a1aff; font-weight:600; text-decoration:none;">{j['title']}</a><br>
            <span style="color:#444; font-size:13px;">{j['company']}</span>
          </td>
          <td style="padding:10px 8px; border-bottom:1px solid #eee; color:#666; font-size:13px; white-space:nowrap;">{j['source']}</td>
        </tr>"""

    html = f"""
    <html><body style="font-family:Arial,sans-serif; max-width:700px; margin:0 auto; color:#222;">
      <h2 style="border-bottom:2px solid #1a1aff; padding-bottom:8px;">
        Job Search Digest &mdash; {date_str}
      </h2>
      <p style="color:#555;">{len(new_jobs)} new match(es) found across BuiltIn, Wellfound, YC, TrueUp, and Jack & Jill Jobs.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background:#f5f5f5; text-align:left;">
            <th style="padding:8px; font-size:13px; color:#888;">ROLE / COMPANY</th>
            <th style="padding:8px; font-size:13px; color:#888;">SOURCE</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      <p style="margin-top:24px; font-size:12px; color:#aaa;">
        Sent by your job search scraper &bull; Keywords: paid media, performance marketing, growth marketing
      </p>
    </body></html>"""
    return html


def send_email(new_jobs):
    if not all([SENDER_EMAIL, SENDER_PASSWORD, RECIPIENT_EMAIL]):
        print("Email env vars not set — printing results to stdout instead.")
        for j in new_jobs:
            print(f"  [{j['source']}] {j['title']} at {j['company']} — {j['url']}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Job Digest {datetime.date.today()} — {len(new_jobs)} new match(es)"
    msg["From"]    = SENDER_EMAIL
    msg["To"]      = RECIPIENT_EMAIL

    plain = "\n".join([f"{j['title']} at {j['company']} ({j['source']}): {j['url']}" for j in new_jobs])
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(build_html_email(new_jobs), "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, RECIPIENT_EMAIL, msg.as_string())
        print(f"Email sent: {len(new_jobs)} jobs.")
    except Exception as e:
        print(f"Email failed: {e}")

# ── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    seen = load_seen()
    all_jobs = []

    print("Scraping BuiltIn...")
    all_jobs += scrape_builtin()
    print("Scraping Wellfound...")
    all_jobs += scrape_wellfound()
    print("Scraping YC Work at a Startup...")
    all_jobs += scrape_yc()
    print("Scraping TrueUp...")
    all_jobs += scrape_trueup()
    print("Scraping Jack & Jill Jobs...")
    all_jobs += scrape_jacknjill()

    # Deduplicate within this run
    seen_this_run = set()
    unique_jobs = []
    for j in all_jobs:
        jid = job_id(j["title"], j["company"], j["url"])
        if jid not in seen_this_run:
            seen_this_run.add(jid)
            unique_jobs.append((jid, j))

    # Filter to only new jobs
    new_jobs = [(jid, j) for jid, j in unique_jobs if jid not in seen]

    print(f"Total scraped: {len(unique_jobs)} | New: {len(new_jobs)}")

    if new_jobs:
        job_list = [j for _, j in new_jobs]
        send_email(job_list)
        # Mark all as seen (including ones we already knew about)
        seen.update(jid for jid, _ in unique_jobs)
        save_seen(seen)
    else:
        print("No new jobs found today.")
        # Still update seen with today's full list to avoid future re-sends
        seen.update(jid for jid, _ in unique_jobs)
        save_seen(seen)


if __name__ == "__main__":
    main()
