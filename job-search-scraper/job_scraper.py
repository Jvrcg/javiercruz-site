"""
Daily Job Search Scraper
Searches BuiltIn, Wellfound, YC Work at a Startup, and TrueUp
for paid media / growth marketing roles matching Javier's profile.
Sends a daily email digest of new listings.

These boards render listings client-side with JavaScript, so plain
`requests` + BeautifulSoup sees an empty shell. Playwright renders each
page in a headless browser first, then BeautifulSoup parses the
resulting DOM.
"""

import os
import json
import hashlib
import smtplib
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from bs4 import BeautifulSoup
from urllib.parse import quote_plus
from playwright.sync_api import sync_playwright
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

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# ── UTILITIES ────────────────────────────────────────────────────────────────

def load_seen():
    if os.path.exists(SEEN_FILE):
        try:
            with open(SEEN_FILE) as f:
                content = f.read().strip()
                if not content:
                    return set()
                return set(json.loads(content))
        except Exception:
            return set()
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

# ── BROWSER HELPERS ──────────────────────────────────────────────────────────

def fetch_rendered_html(page, url, wait_selector=None, wait_ms=3000):
    """Load a JS-rendered page in the shared browser and return its DOM HTML."""
    page.goto(url, timeout=30000, wait_until="domcontentloaded")
    if wait_selector:
        try:
            page.wait_for_selector(wait_selector, timeout=wait_ms)
        except Exception:
            pass
    else:
        page.wait_for_timeout(wait_ms)
    return page.content()


def find_json_objects(data, predicate):
    """Recursively walk a parsed JSON structure, yielding dicts matching predicate."""
    if isinstance(data, dict):
        if predicate(data):
            yield data
        for val in data.values():
            yield from find_json_objects(val, predicate)
    elif isinstance(data, list):
        for item in data:
            yield from find_json_objects(item, predicate)


def extract_json_scripts(soup):
    """Return parsed JSON from every <script> tag that looks like embedded state."""
    blobs = []
    for script in soup.find_all("script"):
        text = script.string or script.get_text()
        if not text or "{" not in text:
            continue
        try:
            blobs.append(json.loads(text))
        except Exception:
            continue
    return blobs

# ── SCRAPERS ─────────────────────────────────────────────────────────────────
# Each scraper takes a Playwright `page` so all sources share one browser.

def scrape_builtin(page):
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
            html = fetch_rendered_html(page, url, wait_selector="article, div[data-id]")
            soup = BeautifulSoup(html, "html.parser")
            cards = soup.select("article[data-id]") or soup.select("div[data-testid='job-card']") or soup.select("article")
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


def scrape_wellfound(page):
    """Wellfound public role search pages — reads the rendered Apollo JSON cache."""
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
            html = fetch_rendered_html(page, url, wait_selector="[class*='job']")
            soup = BeautifulSoup(html, "html.parser")

            for data in extract_json_scripts(soup):
                for obj in find_json_objects(data, lambda d: d.get("__typename") == "JobListing"):
                    title   = obj.get("title", "")
                    startup = obj.get("startup")
                    company = startup.get("name", "Unknown") if isinstance(startup, dict) else "Unknown"
                    slug_j  = obj.get("slug", "")
                    job_url = f"https://wellfound.com/jobs/{slug_j}" if slug_j else url
                    if title_matches(title):
                        jobs.append({"title": title, "company": company, "url": job_url, "source": "Wellfound"})

            # Fallback: parse rendered HTML cards directly
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


def scrape_yc(page):
    """YC Work at a Startup job board — reads the rendered __NEXT_DATA__ payload."""
    jobs = []
    url = "https://www.workatastartup.com/jobs?role=marketing&jobType=fulltime"
    try:
        html = fetch_rendered_html(page, url, wait_selector="[class*='job']")
        soup = BeautifulSoup(html, "html.parser")

        script = soup.find("script", id="__NEXT_DATA__")
        if script and script.string:
            try:
                data = json.loads(script.string)
                # Job entries can live at different depths depending on the
                # current Next.js build, so search recursively for anything
                # that looks like a job record rather than a fixed path.
                seen_ids = set()
                for obj in find_json_objects(data, lambda d: ("title" in d or "job_title" in d) and ("company" in d or "company_name" in d)):
                    title   = obj.get("title", "") or obj.get("job_title", "")
                    company_field = obj.get("company")
                    company = company_field.get("name", "Unknown") if isinstance(company_field, dict) else obj.get("company_name", "Unknown")
                    slug    = obj.get("slug", "") or str(obj.get("id", ""))
                    if slug in seen_ids:
                        continue
                    seen_ids.add(slug)
                    job_url = f"https://www.workatastartup.com/jobs/{slug}" if slug else url
                    if title and title_matches(title):
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


def scrape_trueup(page):
    """TrueUp job search — marketing category, rendered DOM."""
    jobs = []
    terms = [
        "paid media manager",
        "performance marketing manager",
        "growth marketing manager",
    ]
    for term in terms:
        url = f"https://www.trueup.io/job-openings?q={quote_plus(term)}&category=marketing"
        try:
            html = fetch_rendered_html(page, url, wait_selector="a[href*='/job/'], [class*='job']")
            soup = BeautifulSoup(html, "html.parser")
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
      <p style="color:#555;">{len(new_jobs)} new match(es) found across BuiltIn, Wellfound, YC, and TrueUp.</p>
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

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)

        print("Scraping BuiltIn...")
        all_jobs += scrape_builtin(page)
        print("Scraping Wellfound...")
        all_jobs += scrape_wellfound(page)
        print("Scraping YC Work at a Startup...")
        all_jobs += scrape_yc(page)
        print("Scraping TrueUp...")
        all_jobs += scrape_trueup(page)

        browser.close()

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
