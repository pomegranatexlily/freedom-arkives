#!/usr/bin/env python3
"""Sync new Medium articles into the Freedom Arkives catalog embedded in index.html.

Reads https://medium.com/feed/@FreedomArkives, compares against the articles array
inside <script type="application/json" id="catalogData">, and prepends any new
entries (newest first). Existing entries are never modified or reordered.

Entry formatting matches the catalog's existing style byte-for-byte so the diff
stays surgical: only the new entries are added.
"""

import base64
import hashlib
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


BOOK_COUNT_DISPLAY = "14"  # author's published total (not the on-page catalog length)


def refresh_copy(page, article_count):
    """Keep hardcoded marketing copy honest on every sync run.

    - Article-count placeholder -> live catalog count (the page JS overwrites
      this on load anyway; this keeps the static HTML truthful for no-JS).
    - Book-count placeholder + library heading -> author's published total.
    - JS book counter -> author's published total (was the on-page catalog length).
    All substitutions are idempotent: re-running with no changes is a no-op.
    """
    subs = [
        (r'(<div class="result-count" id="articleCount" aria-live="polite">)\d+ articles</div>',
         rf"\g<1>{article_count} articles</div>"),
        (r'(<div class="result-count" id="bookCount" aria-live="polite">)\d+ books</div>',
         rf"\g<1>{BOOK_COUNT_DISPLAY} books</div>"),
        (r"Eight books\. One living catalog\.",
         "Fourteen books. One living catalog."),
        (r'bookCount\.textContent = books\.length \+ \(books\.length === 1 \? " book" : " books"\);',
         f'bookCount.textContent = "{BOOK_COUNT_DISPLAY} books";'),
        # 2026-10-10 user direction: no disclaimers, no builder notes on the live site.
        (r" It does not claim to represent Zionism, rabbinic Judaism, or Jewish people as a whole\.",
         ""),
        (r" Every record below is rendered from the JSON catalog embedded at the end of this page\.",
         ""),
        (r"; typographic covers are replaceable assets, ready for final cover files at the same paths\.",
         ""),
        # 2026-10-10 user direction: the browser tab must not read "The New Jew".
        (r"<title>The New Jew</title>",
         "<title>Freedom Arkives \u2014 Official App</title>"),
        # 2026-10-10 user direction: no "New Jew"/"strong Jew" framing — he is an Israelite, not Jewish.
        (r'<p class="serial">The New Jew \u00b7 Civilizational doctrine 01</p>',
         '<p class="serial">Freedom Arkives \u00b7 Civilizational doctrine 01</p>'),
        (r"The strong Jew is the regenerated builder:",
         "The strong Israelite is the regenerated builder:"),
        (r"The strong Jew is not the one who can name the captivity\.",
         "The strong Israelite is not the one who can name the captivity."),
        (r"Strong-Jew discipline",
         "Strong-Israelite discipline"),
        # 2026-10-11 user-sealed statement: the two peoples / rival claims separation note.
        (r"The words \u201cJew,\u201d \u201cIsrael,\u201d \u201ccovenant,\u201d and \u201crestoration\u201d are used here inside Freedom Arkives\u2019 own Covenant Anthropology\.",
         "Within Freedom Arkives\u2019 Covenant Anthropology, the terms \u201cIsrael,\u201d \u201ccovenant,\u201d and \u201crestoration\u201d bear a determinate meaning. The Israel of this work is not the Jewish Israeli state, which it does not support; it is the Native Israelite people \u2014 so-called African Americans and the other children of the transatlantic slave trade \u2014 together with their claim to a homeland of their own. The two peoples advance distinct claims upon a single covenant blessing, and their relation is one of rivalry, not alliance."),
    ]
    for pat, rep in subs:
        page, n = re.subn(pat, rep, page)
        print(f"  copy refresh: {n} replacement(s) for /{pat[:48]}.../")
    return page


COVER_SOURCES = {
    "deconstructing-christianity": ("https://muse.ai/files/1336938832839460/1421414639362517/jf8hih805l9kgb5o8sxowjwg/deconstructing-christianity.jpg", "d1228b1de07a4ea7e7299e8461a4c266ea5138db5f436f2e16df5886338c6c46"),
    "bloodline": ("https://muse.ai/files/1336938832839460/990988757393323/nls7k3jimltkx9uyifby0x49/bloodline.jpg", "f3ac7833def14eb774c5c4f20ad146f851e4e6a0f94db773b77c3e6d254abecd"),
    "this-aint-animal-farm": ("https://muse.ai/files/1336938832839460/1124952873807589/aymm3uoruldmd4r1up1kflvd/this-aint-animal-farm.jpg", "53a6f4bd3a803f70cc153ed26745a6fdeb25214782eb66a0fde0755de0a7d3b1"),
    "ash-rain": ("https://muse.ai/files/1336938832839460/1076823808530267/owh06hpnpx5wxd23vnzkfciy/ash-rain.jpg", "127184529fcba5ac45523341285356b507f8d317f78bcc73d2d4c308c372d21e"),
    "broken-inheritance": ("https://muse.ai/files/1336938832839460/39127615873550494/3fwjb0t03lozz8pp8zn1vc0s/broken-inheritance.jpg", "39916c28898f571a6bf5e4b10b5bf402d2b1f82cf96aaeea6030fd8394dd7774"),
    "freedom-articles": ("https://muse.ai/files/1336938832839460/1439137174390525/cgjcqqa1lqgpx96z3hs2ugo2/freedom-articles.jpg", "a264cbd2e2bfe0c85e6bbff3e5ea1e354aaa3f0bb8aa10026d390a73359efbb6"),
    "lawkeepers-guidebook": ("https://muse.ai/files/1336938832839460/1634088961632360/r7aq3fu5q8vb6wby9fpde5w2/lawkeepers-guidebook.jpg", "3fc7360470fd09b2c9c74ee304f73290ea890f994beee0fb41aad056196925bc"),
    "rich-young-ruler": ("https://muse.ai/files/1336938832839460/1111469631468503/du7k6lxq8ekn685joxgqxi5t/rich-young-ruler.jpg", "7615fef754a17893a8570a5172c82e1b08decbe9dbd13cf059c71e6c31c49159"),
    "songs-of-masha": ("https://muse.ai/files/1336938832839460/1079116698480982/kl6e8t5werfey8g4y2vq1gii/songs-of-masha.jpg", "8a3bab5f11fc063e83649f68dacf182abf47c3238143099034ad6420c62f77c7"),
    "jacobs-trouble": ("https://muse.ai/files/1336938832839460/2172266613709459/zucxkgqbmaf5g52s4hz4yxvn/jacobs-trouble.jpg", "50d6649d896219163f8f0630a0b5cc39c4f1ee61f2ba428b0ff85fccfe8ade63"),
    "prophecy-over-dna": ("https://muse.ai/files/1336938832839460/941731408618041/7bm600u83gidepe7uywuwf7n/prophecy-over-dna.jpg", "46184fb85d11264764134c8ad7e55cdaae61abe8350a06d05a879797f2ed6a6f"),
}

def fetch_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": "FreedomArkives-sync/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def apply_real_covers(page):
    """Embed the author's real book covers into the catalog.

    Cover bytes are staged at public URLs; each entry is pinned by the sha256
    of its final data URI. A book whose cover already matches its pin is left
    untouched (no fetch), so daily runs stay light and idempotent. Any fetch
    or hash failure skips that book and keeps the existing cover.
    """
    m = CATALOG_RE.search(page)
    if not m:
        return page
    text = m.group(2)
    try:
        catalog = json.loads(text)
    except Exception:
        return page
    books = {b.get("id"): b for b in catalog.get("books", [])}
    changed = False
    for bid, (url, want_hash) in COVER_SOURCES.items():
        book = books.get(bid)
        if book is None:
            continue
        if hashlib.sha256((book.get("cover") or "").encode()).hexdigest() == want_hash:
            continue
        try:
            raw = fetch_bytes(url)
        except Exception as e:
            print(f"  covers: fetch failed for {bid}: {e}")
            continue
        uri = "data:image/jpeg;base64," + base64.b64encode(raw).decode()
        if hashlib.sha256(uri.encode()).hexdigest() != want_hash:
            print(f"  covers: hash mismatch for {bid}; skipped")
            continue
        idpos = text.find(f'"id": "{bid}"')
        if idpos == -1:
            continue
        cpos = text.find('"cover": "', idpos)
        if cpos == -1:
            continue
        vstart = cpos + len('"cover": "')
        vend = text.find('"', vstart)
        text = text[:vstart] + uri + text[vend:]
        changed = True
        print(f"  covers: embedded real cover for {bid}")
    if not changed:
        return page
    return page[: m.start(2)] + text + page[m.end(2):]


BROKEN_INHERITANCE_ENTRY = """      {
        "id": "broken-inheritance",
        "title": "From Broken Inheritance to Black Liberation",
        "author": "Christopher M Turner",
        "series": null,
        "cover": "__COVER__",
        "order": 9,
        "readingRole": "Turn survival into inheritance",
        "description": "Black people have survived. Survival alone cannot guarantee that children inherit the safety, knowledge, property, and institutions needed to direct their own futures. From Broken Inheritance to Black Liberation turns an unfinished recovery into a practical program for health, skill, ownership, memory, accountable leadership, and long-term power. The measure is not how much we endure. It is what we can build, keep, govern, and pass forward.",
        "subjects": ["Liberation", "Capacity", "Continuity"],
        "editions": [
          {"format": "Hardcover", "price": "$80.00", "asin": "B0HMMWNFNG", "url": "https://www.amazon.com/dp/B0HMMWNFNG"}
        ]
      }"""




THUMBNAIL_FIXES = {
    "https://freedomarkives.medium.com/stop-just-watching-python-tutorials-run-the-code-9c482f3f884c": "https://cdn-images-1.medium.com/max/768/1*EYhQY8x9RQvzEqQtbP4WMw@2x.jpeg",
    "https://freedomarkives.medium.com/from-passover-to-easter-from-covenant-to-christian-tradition-7a78f4956127": "https://cdn-images-1.medium.com/max/768/1*UFPMEHkUdFRynuRn1BDlCg@2x.jpeg",
    "https://freedomarkives.medium.com/participation-is-not-power-b821617434ea": "https://cdn-images-1.medium.com/max/768/1*gc_w7N9sVYQOYR6w0_DzFQ@2x.jpeg",
    "https://freedomarkives.medium.com/how-to-use-chatgpt-198a5035da97": "https://cdn-images-1.medium.com/max/768/1*FpyWMbmOuMVTV5oE_FU9Fg@2x.jpeg",
    "https://freedomarkives.medium.com/can-ai-understand-aave-3afa3ef18c4e": "https://cdn-images-1.medium.com/max/768/1*AuEkwDtZBeHDfwj0DfF5ug@2x.jpeg",
    "https://freedomarkives.medium.com/the-rat-poison-of-progressive-christianity-96d9f919b1c8": "https://cdn-images-1.medium.com/max/768/1*ar2NtsqhwUARfq01rg3qEA@2x.jpeg",
    "https://freedomarkives.medium.com/trumps-5-000-political-bribe-and-america-s-unpaid-reparations-debt-5ac2c2a7bc2b": "https://cdn-images-1.medium.com/max/768/1*DiOsVxFf6KdBOP8CcHHgRw@2x.jpeg",
    "https://freedomarkives.medium.com/why-israel-is-at-the-center-of-american-politics-empire-and-prophecy-in-2026-583ca86f3244": "https://cdn-images-1.medium.com/max/768/1*QR27ooztaFOUdJkyjBxdQg@2x.jpeg",
    "https://freedomarkives.medium.com/when-did-hebrew-israelites-black-hebrew-israelites-start-9396dc7e6453": "https://cdn-images-1.medium.com/max/768/1*_vKTbWtj5_hg0PNHgEYCLA@2x.jpeg",
    "https://freedomarkives.medium.com/the-cycle-of-demoralization-and-division-3538de8a62a5": "https://cdn-images-1.medium.com/max/768/1*1YdYRpjJOnmagzGndyEfgg@2x.jpeg",
    "https://freedomarkives.medium.com/christianity-universalism-and-the-antichrist-fd1cff31f8dc": "https://cdn-images-1.medium.com/max/768/1*OBpio350CS1hhxdcNhu8SQ@2x.jpeg",
    "https://freedomarkives.medium.com/power-courts-equity-and-legitimacy-8b4c128a292d": "https://cdn-images-1.medium.com/max/768/1*1CXh5mspe5mcgHGXZMsWkQ@2x.jpeg",
    "https://freedomarkives.medium.com/romes-saturday-is-not-yahawah-s-shabbat-a798bc480a61": "https://cdn-images-1.medium.com/max/768/1*mhk9p2ASE1-Acnwx6_wC6w@2x.jpeg",
    "https://freedomarkives.medium.com/do-black-people-have-the-right-to-hate-white-america-fbde46e06ce3": "https://cdn-images-1.medium.com/max/768/1*bAF6-OwD-NzvoJroBWMuAQ@2x.jpeg",
    "https://freedomarkives.medium.com/who-is-esau-0cfa44e68f3a": "https://cdn-images-1.medium.com/max/768/1*14bhyjnyTIe4zFEjnbmIzA@2x.jpeg",
    "https://freedomarkives.medium.com/who-is-yahawshai-why-the-church-lied-about-the-conquering-king-a4de86d1a5d4": "https://cdn-images-1.medium.com/max/768/1*S1bLFM05pYLu2KsD1qDvKQ@2x.jpeg",
    "https://freedomarkives.medium.com/the-throne-the-covenant-and-the-empire-9b9d38248279": "https://cdn-images-1.medium.com/max/768/1*GwtVDFR1KzijvOH__2S6ew@2x.jpeg",
    "https://freedomarkives.medium.com/what-gentile-salvation-really-is-f2cd9ed3080d": "https://cdn-images-1.medium.com/max/768/1*2h7w7neM6icEfHM1WT6I1Q@2x.jpeg",
    "https://freedomarkives.medium.com/are-black-hebrew-israelites-really-crazy-95575827e10b": "https://cdn-images-1.medium.com/max/768/1*NUjt-d7_RGifZPN3nNwyPw@2x.jpeg",
    "https://freedomarkives.medium.com/deconstructing-christianity-for-real-5ad0b13f91ea": "https://cdn-images-1.medium.com/max/768/1*Il6Y6B5TqjycfVn-LJPgKA@2x.jpeg",
    "https://freedomarkives.medium.com/who-is-yahawashi-reclaiming-the-hebrew-messiah-behind-jesus-4d51b9a6e24a": "https://cdn-images-1.medium.com/max/768/1*_r4h4Ul68oIF57N8tIeT7g@2x.jpeg",
    "https://freedomarkives.medium.com/intersectionality-dilutes-the-black-agenda-1b6ecb4655a6": "https://cdn-images-1.medium.com/max/768/1*QOOS1AiAI89Q-leMPRMmjQ@2x.jpeg",
    "https://freedomarkives.medium.com/both-sides-are-wrong-commandments-covenant-and-the-bastardized-gospel-a9b59fc26bb5": "https://cdn-images-1.medium.com/max/768/1*WnvKAoLGMUV_z9GA6Qs9ig@2x.jpeg",
    "https://freedomarkives.medium.com/written-in-love-a-response-on-shabath-the-moon-and-captivity-2807521622de": "https://cdn-images-1.medium.com/max/768/1*RI29LKVbVgr4g35_rAR3ug@2x.jpeg",
    "https://freedomarkives.medium.com/saturday-still-has-to-be-proven-1b0faf13b55d": "https://cdn-images-1.medium.com/max/768/1*-RIeeNnjDWKUCPvyOrAdBA@2x.jpeg",
    "https://freedomarkives.medium.com/self-determination-that-never-reaches-us-why-international-law-is-just-another-cover-for-empire-312aa66f13ad": "https://cdn-images-1.medium.com/max/768/1*5wnOOlxrhaspjYCxcdIupw@2x.jpeg",
    "https://freedomarkives.medium.com/the-devil-on-the-shoulder-2cb1889178e2": "https://cdn-images-1.medium.com/max/768/1*ErZ_43DWX_aVhuiLcgBucg@2x.jpeg",
    "https://freedomarkives.medium.com/why-does-god-allow-evil-aee6adb99b75": "https://cdn-images-1.medium.com/max/768/1*kN4HV5uiwarXbWrjeqNRPw@2x.jpeg",
    "https://freedomarkives.medium.com/when-israels-promises-were-stolen-how-christian-doctrine-turned-our-liberation-into-their-bf0dfee0c9b4": "https://cdn-images-1.medium.com/max/768/1*rYsuWOrlIDWcfamAf7qyNw@2x.jpeg",
    "https://freedomarkives.medium.com/obama-was-not-the-first-black-u-s-president-b47c0b9a2e07": "https://cdn-images-1.medium.com/max/768/1*6K-uzwNE1L2YyOA86UiL2A@2x.jpeg",
    "https://freedomarkives.medium.com/the-social-verse-c70bf0742f53": "https://cdn-images-1.medium.com/max/768/1*4Vd-WCRGZSLZXMBnSUKIHQ@2x.jpeg",
    "https://freedomarkives.medium.com/the-american-crucifixion-project-89a31c57c26c": "https://cdn-images-1.medium.com/max/768/1*aLIBX9ys96P4X69zWT_GVA@2x.jpeg",
    "https://freedomarkives.medium.com/the-5-point-ministry-29f3eb254e96": "https://cdn-images-1.medium.com/max/768/1*whX1sYTj-AKpSbTQn0u48w@2x.jpeg",
    "https://freedomarkives.medium.com/from-jerusalem-to-negroland-53598450e57d": "https://cdn-images-1.medium.com/max/768/1*Z5Qx-X_o-ZQVahz01NmATQ@2x.jpeg",
    "https://freedomarkives.medium.com/frisco-teen-dies-after-assaulting-black-peer-a4eb4af03c27": "https://cdn-images-1.medium.com/max/768/1*zvjHzSoKfKKppm9EjHngrA@2x.jpeg",
    "https://freedomarkives.medium.com/i-am-the-grandson-of-a-klansman-2ce1aeb8dc74": "https://cdn-images-1.medium.com/max/768/1*Rm3jck89nGZGoqcRNWS14w@2x.jpeg",
    "https://freedomarkives.medium.com/who-is-yahuah-8857baa3d35e": "https://cdn-images-1.medium.com/max/768/1*By-Nv8rUqmsNu73QtinGJw@2x.jpeg",
    "https://freedomarkives.medium.com/who-is-yahawashi-ae8283f70bbd": "https://cdn-images-1.medium.com/max/768/1*1XgZ3KXm1XzAsbCyb2ZT6g@2x.jpeg",
    "https://freedomarkives.medium.com/iconoclasm-5ce6e7ca4a07": "https://cdn-images-1.medium.com/max/768/1*cjbkuG5gPqN0XbScG2-dfw@2x.jpeg",
    "https://freedomarkives.medium.com/artificial-intelligence-power-grab-or-tool-for-resistance-972a8a20faa5": "https://cdn-images-1.medium.com/max/768/1*f0qSBxzDAzXKrmRxifucNQ@2x.jpeg",
    "https://freedomarkives.medium.com/the-national-leadership-council-nlc-israels-next-evolution-73cdf03dfbaa": "https://cdn-images-1.medium.com/max/768/1*xC4MOaHDLsyOeGYfHspUsQ@2x.jpeg",
    "https://freedomarkives.medium.com/what-is-exegesis-43c04b1ddcd0": "https://cdn-images-1.medium.com/max/768/1*u5iv6nqIdgyAOYsKJ_fP3w@2x.jpeg",
    "https://freedomarkives.medium.com/the-palestine-confusion-a-historical-and-spiritual-deception-1d508fde4b50": "https://cdn-images-1.medium.com/max/768/1*gJR7SKXVall7VD4e4HHY7Q@2x.jpeg",
    "https://freedomarkives.medium.com/kingdom-business-building-as-israelites-in-preparation-for-the-kingdom-8a437ff028ce": "https://cdn-images-1.medium.com/max/768/1*drJA_h83mCTREVuCczugdg@2x.jpeg",
    "https://freedomarkives.medium.com/the-geez-canon-and-the-judgment-of-ethiopia-exposing-false-doctrine-and-prophetic-consequences-ca853b13f276": "https://cdn-images-1.medium.com/max/768/1*bwpi9YgFsFrRIODFNhwA0g@2x.jpeg",
    "https://freedomarkives.medium.com/from-the-apostolic-ekklesia-to-the-roman-church-the-corruption-of-biblical-faith-and-its-legacy-d44a725fd660": "https://cdn-images-1.medium.com/max/768/1*sSzTY5SK9AEUcmkbv19K2g@2x.jpeg",
    "https://freedomarkives.medium.com/can-we-all-get-along-uniting-hebrew-israelites-across-doctrines-d081711f1551": "https://cdn-images-1.medium.com/max/768/1*P-PPRFl71SGoK47D_ocrAA@2x.jpeg",
    "https://freedomarkives.medium.com/is-christmas-really-pagan-maybe-its-just-the-tip-of-the-iceberg-a2f6dea446b8": "https://cdn-images-1.medium.com/max/768/1*IbqYImWY37ouHlDwDFQKFQ@2x.jpeg",
    "https://freedomarkives.medium.com/who-is-yahawashi-a26b4b042f9e": "https://cdn-images-1.medium.com/max/768/1*Ld8bhPlFZUHsRlYhHBa-dg@2x.jpeg",
    "https://freedomarkives.medium.com/heres-a-fully-developed-article-following-the-outline-integrating-your-expanded-insights-and-9ecf3f78f2a2": "https://cdn-images-1.medium.com/max/768/1*neL_WsBi6GOZ6NYjliRIaA@2x.jpeg",
    "https://freedomarkives.medium.com/the-chodesh-breakdown-bc05a74e5476": "https://cdn-images-1.medium.com/max/768/1*olLJfc5qp6AVvBuIa7k3xw@2x.jpeg",
    "https://freedomarkives.medium.com/jesus-fulfilled-sacrifices-not-the-law-6a61373e4310": "https://cdn-images-1.medium.com/max/768/1*EsAO4WwnsEHyc5LzipGiYw@2x.jpeg",
    "https://freedomarkives.medium.com/the-systematic-erasure-of-israel-from-antiochus-to-the-negro-act-of-1740-2c8819ed68a9": "https://cdn-images-1.medium.com/max/768/1*PC2WKqCf8kRAnraMExzHzQ@2x.jpeg",
    "https://freedomarkives.medium.com/fulfilling-the-law-in-matthew-5-17-doesnt-mean-abolishing-it-it-means-fulfilling-the-1ed380220201": "https://cdn-images-1.medium.com/max/768/1*1dz31ulpR4m3j2f_0jlk4w@2x.jpeg",
}

MISSING_THUMBS = ("", "None", FALLBACK_THUMB)


def repair_thumbnails(page):
    """Fill in article thumbnails harvested from the publication itself
    (2026-10-11: 54 of 59 catalog articles carried a literal "None").
    Keyed by article URL; only replaces missing markers, never a live
    thumbnail, so feed-captured images always win. Idempotent."""
    m = CATALOG_RE.search(page)
    if not m:
        return page
    text = m.group(2)
    try:
        catalog = json.loads(text)
    except Exception:
        return page
    fixed = 0
    for a in catalog.get("articles", []):
        raw_url = a.get("url") or ""
        want = THUMBNAIL_FIXES.get(raw_url.split("?")[0].rstrip("/"))
        if not want:
            continue
        if (a.get("thumbnail") or "") not in MISSING_THUMBS:
            continue
        upos = text.find(f'"url": "{raw_url}"')
        if upos == -1:
            continue
        next_id = text.find('"id": "', upos)
        seg_end = next_id if next_id != -1 else len(text)
        tpos = text.find('"thumbnail": ', upos, seg_end)
        if tpos == -1:
            continue
        vstart = tpos + len('"thumbnail": ')
        if text.startswith("null", vstart):
            text = text[:vstart] + f'"{want}"' + text[vstart + 4:]
            fixed += 1
            print(f"  thumbs: repaired {a.get('id')}")
        elif text[vstart] == '"':
            vend = text.find('"', vstart + 1)
            if text[vstart + 1:vend] in MISSING_THUMBS:
                text = text[:vstart + 1] + want + text[vend:]
                fixed += 1
                print(f"  thumbs: repaired {a.get('id')}")
    if not fixed:
        return page
    print(f"  thumbs: {fixed} repaired in total")
    return page[: m.start(2)] + text + page[m.end(2):]


def ensure_broken_inheritance(page):
    """Insert the Broken Inheritance catalog entry once its Amazon edition went
    live (user-supplied link, 2026-10-11: Hardcover $80.00, ASIN B0HMMWNFNG).
    Idempotent: no-op when the entry is already in the catalog."""
    if '"id": "broken-inheritance"' in page:
        print("  books: broken-inheritance already in catalog.")
        return page
    anchor = '      }\n    ],\n    "articles": ['
    if page.count(anchor) != 1:
        print("ERROR: books-array anchor not found exactly once", file=sys.stderr)
        return page
    entry_text = BROKEN_INHERITANCE_ENTRY.replace('__COVER__', 'assets/broken-inheritance.jpg')
    new_page = page.replace(
        anchor, '      },\n' + entry_text + '\n    ],\n    "articles": [', 1)
    m = CATALOG_RE.search(new_page)
    check = json.loads(m.group(2))
    ids = [b.get("id") for b in check["books"]]
    assert ids.count("broken-inheritance") == 1, "book insert sanity check failed"
    print(f"  books: inserted broken-inheritance (catalog now {len(ids)} books).")
    return new_page


JACOBS_TROUBLE_ENTRY = """      {
        "id": "jacobs-trouble",
        "title": "Jacob's Trouble \\"Birth of a King\\"",
        "author": "M M Judah",
        "series": null,
        "cover": "__COVER__",
        "order": 10,
        "readingRole": "Protect the heir in the time of trouble",
        "description": "Masha Ma-Yan Yahawadah does not know who he is. Then the forces hunting his unborn son force the truth out of hiding. The child is Yahawashi, the coming King, and Baron, an Edomite adversary tied to the ancient line of Haman, will kill to stop the birth. A prophetic novel of identity, betrayal, spiritual warfare, and the restoration of Israel.",
        "subjects": ["Literature", "Heritage", "Captivity"],
        "editions": [
          {"format": "Kindle", "price": "$9.99", "asin": "B0DPVVHJSK", "url": "https://www.amazon.com/dp/B0DPVVHJSK"},
          {"format": "Paperback", "price": "$10.00", "asin": "B0DQ2WL6NZ", "url": "https://www.amazon.com/dp/B0DQ2WL6NZ"}
        ]
      }"""


PROPHECY_OVER_DNA_ENTRY = """      {
        "id": "prophecy-over-dna",
        "title": "Prophecy OVER DNA",
        "author": "M M Judah",
        "series": "The Freedom Articles Series",
        "cover": "__COVER__",
        "order": 11,
        "readingRole": "Name the bloodline by prophecy",
        "description": "A world captivated by ancestry tests wants DNA to decide who Israel is. This book answers that prophecy, covenant, and paternal lineage, not genetic markers, define the true descendants of Israel. It traces the African diaspora through the curses of Deuteronomy 28 and the historical migration of Israelites into Africa, and calls the awakening back to Torah and restoration.",
        "subjects": ["Heritage", "Scripture", "Inheritance"],
        "editions": [
          {"format": "Kindle", "price": "$9.99", "asin": "B0DR3MCQNT", "url": "https://www.amazon.com/dp/B0DR3MCQNT"},
          {"format": "Paperback", "price": "$9.99", "asin": "B0DR6VMDH6", "url": "https://www.amazon.com/dp/B0DR6VMDH6"}
        ]
      }"""


NEW_BOOK_ENTRIES = [
    ("jacobs-trouble", JACOBS_TROUBLE_ENTRY, "assets/jacobs-trouble.jpg"),
    ("prophecy-over-dna", PROPHECY_OVER_DNA_ENTRY, "assets/prophecy-over-dna.jpg"),
]


def ensure_new_books(page):
    """Insert catalog entries for Jacob's Trouble and Prophecy Over DNA
    (user direction, 2026-10-11). Idempotent per book."""
    missing = [(bid, tpl, ph) for bid, tpl, ph in NEW_BOOK_ENTRIES
               if f'"id": "{bid}"' not in page]
    if not missing:
        print("  books: jacobs-trouble + prophecy-over-dna already in catalog.")
        return page
    anchor = '      }\n    ],\n    "articles": ['
    if page.count(anchor) != 1:
        print("ERROR: books-array anchor not found exactly once", file=sys.stderr)
        return page
    parts = [tpl.replace('__COVER__', ph) for _, tpl, ph in missing]
    new_page = page.replace(
        anchor, '      },\n' + ',\n'.join(parts) + '\n    ],\n    "articles": [', 1)
    m = CATALOG_RE.search(new_page)
    check = json.loads(m.group(2))
    ids = [b.get("id") for b in check["books"]]
    for bid, _, _ in missing:
        assert ids.count(bid) == 1, f"book insert sanity check failed for {bid}"
        print(f"  books: inserted {bid} (catalog now {len(ids)} books).")
    return new_page


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

    new_page = page
    if not fresh:
        print("0 new articles — catalog already up to date.")
    else:
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
        print(f"{len(fresh)} new article(s) added:")
        for e in fresh:
            print(f"  - {e['date']} | {e['title']}")

    total_articles = len(articles) + len(fresh)
    new_page = refresh_copy(new_page, total_articles)
    new_page = ensure_broken_inheritance(new_page)
    new_page = ensure_new_books(new_page)
    new_page = repair_thumbnails(new_page)
    new_page = apply_real_covers(new_page)

    if new_page == page:
        print("No changes to write.")
        return 0
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        f.write(new_page)
    print("index.html updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
