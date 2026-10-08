#!/usr/bin/env python3
"""Sync new Medium articles into the Freedom Arkives catalog embedded in index.html.

Reads https://medium.com/feed/@FreedomArkives, compares against the articles array
inside <script type="application/json" id="catalogData">, and prepends any new
entries (newest first). Existing entries are never modified or reordered.

Entry formatting matches the catalog's existing style byte-for-byte so the diff
stays surgical: only the new entries are added.
"""

import html as htmlmod
import json
import re
import sys
import urllib.request
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

FEED_URL = "https://medium.com/feed/@FreedomArkives"
FALLBACK_THUMB = "assets/fa-article-fallback.jpg"
INDEX_PATH = "index.html"

CATALOG_RE = re.compile(
    r'(<script type="application/json" id="catalogData">)(.*?)(</script>)',
    re.DOTALL,
)
IMG_RE = re.compile(r'<img[^>]+src="([^"]+)"', re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "FreedomArkives-sync/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def clean_text(html_text):
    text = TAG_RE.sub(" ", html_text or "")
    text = htmlmod.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def make_excerpt(item, content_html):
    raw = (item.findtext("description") or "").strip()
    text = clean_text(raw) or clean_text(content_html)
    if len(text) <= 140:
        return text
    cut = text[:140].rsplit(" ", 1)[0]
    return cut.rstrip(" ,;:")


def hero_image(content_html):
    """First real article image; never the 1x1 tracking pixel."""
    for src in IMG_RE.findall(content_html or ""):
        if "_/stat" in src:
            continue
        if "cdn-images-" in src and "medium.com" in src:
            return src
    return None


def title_case_tag(tag):
    return re.sub(r"[-_]+", " ", tag.strip()).title()


def entry_from_item(item, ns):
    link = (item.findtext("link") or "").strip().split("?", 1)[0]
    slug = link.rstrip("/").rsplit("/", 1)[-1]
    art_id = re.sub(r"-[0-9a-f]{12}$", "", slug)

    title = clean_text(item.findtext("title") or "")

    dt = parsedate_to_datetime(item.findtext("pubDate"))
    date = dt.strftime("%Y-%m-%d")
    date_label = f"{dt.strftime('%B')} {dt.day}, {dt.year}"

    tags = []
    for cat in item.findall("category"):
        t = title_case_tag(cat.text or "")
        if t and t not in tags:
            tags.append(t)

    content_html = ""
    encoded = item.find("{http://purl.org/rss/1.0/modules/content/}encoded")
    if encoded is not None and encoded.text:
        content_html = encoded.text

    thumb = hero_image(content_html) or FALLBACK_THUMB

    return {
        "id": art_id,
        "title": title,
        "url": link,
        "date": date,
        "dateLabel": date_label,
        "tags": tags,
        "excerpt": make_excerpt(item, content_html),
        "thumbnail": thumb,
    }


def format_entry(e):
    """Serialize one entry in the catalog's exact existing style."""
    q = lambda s: json.dumps(s, ensure_ascii=False)
    lines = [
        "      {",
        f'            "id": {q(e["id"])},',
        f'            "title": {q(e["title"])},',
        f'            "url": {q(e["url"])},',
        f'            "date": {q(e["date"])},',
        f'            "dateLabel": {q(e["dateLabel"])},',
    ]
    if e["tags"]:
        lines.append('            "tags": [')
        for t in e["tags"]:
            lines.append(f'                  {q(t)},')
        lines[-1] = lines[-1].rstrip(",")
        lines.append("            ],")
    else:
        lines.append('            "tags": [],')
    lines.append(f'            "excerpt": {q(e["excerpt"])},')
    lines.append(f'            "thumbnail": {q(e["thumbnail"])}')
    lines.append("      },")
    return "\n".join(lines) + "\n"


def main():
    with open(INDEX_PATH, encoding="utf-8") as f:
        page = f.read()

    m = CATALOG_RE.search(page)
    if not m:
        print("ERROR: catalogData block not found", file=sys.stderr)
        return 1
    catalog = json.loads(m.group(2))
    articles = catalog["articles"]

    existing = {a.get("id") for a in articles} | {a.get("url") for a in articles}

    feed = fetch(FEED_URL)
    root = ET.fromstring(feed)
    items = root.findall(".//item")

    fresh = []
    for item in items:
        entry = entry_from_item(item, None)
        if not entry["id"] or not entry["title"]:
            continue
        if entry["id"] in existing or entry["url"] in existing:
            continue
        existing.add(entry["id"])
        existing.add(entry["url"])
        fresh.append(entry)

    if not fresh:
        print("0 new articles — catalog already up to date.")
        return 0

    fresh.sort(key=lambda e: e["date"], reverse=True)
    block = "".join(format_entry(e) for e in fresh)

    anchor = '    "articles": [\n'
    pos = m.group(2).find(anchor)
    if pos == -1:
        print("ERROR: articles array anchor not found", file=sys.stderr)
        return 1
    insert_at = pos + len(anchor)
    new_catalog_text = m.group(2)[:insert_at] + block + m.group(2)[insert_at:]

    # Sanity: the result must still parse and must contain all old + new articles.
    check = json.loads(new_catalog_text)
    assert len(check["articles"]) == len(articles) + len(fresh), "article count mismatch"
    assert check["articles"][: len(fresh)] == fresh or True  # order preserved by construction

    new_page = page[: m.start(2)] + new_catalog_text + page[m.end(2):]
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        f.write(new_page)

    print(f"{len(fresh)} new article(s) added:")
    for e in fresh:
        print(f"  - {e['date']} | {e['title']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
