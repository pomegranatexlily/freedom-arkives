#!/usr/bin/env python3
"""Extract embedded homepage resources without rewriting publication text."""
import base64
import hashlib
import json
import re
from html import escape
from html.parser import HTMLParser
from pathlib import Path

class Blocks(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.lines = [0]
        self.lines.extend(m.end() for m in re.finditer("\n", text))
        self.active = None
        self.blocks = []
        self.main_depth = None
        self.depth = 0
        self.main_children = 0
        self.feed(text)
    def position(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col
    def handle_starttag(self, tag, attrs):
        start = self.position()
        raw = self.get_starttag_text()
        if tag in ("style", "script"):
            self.active = (tag, dict(attrs), start, start + len(raw), raw)
        if tag == "main":
            self.main_depth = self.depth
        elif self.main_depth is not None and self.depth == self.main_depth + 1 and tag not in ("script", "style", "template"):
            self.main_children += 1
        if tag not in ("area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"):
            self.depth += 1
    def handle_endtag(self, tag):
        if self.active and self.active[0] == tag:
            kind, attrs, start, body_start, raw = self.active
            end_start = self.position()
            end = self.text.index(">", end_start) + 1
            self.blocks.append((kind, attrs, start, body_start, end_start, end, raw))
            self.active = None
        self.depth -= 1
        if tag == "main":
            self.main_depth = None

class VisibleText(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.skip = 0
        self.parts = []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip -= 1
    def handle_data(self, data):
        if not self.skip and data.strip():
            self.parts.append(data)
    def handle_entityref(self, name):
        if not self.skip:
            self.parts.append("&" + name + ";")
    def handle_charref(self, name):
        if not self.skip:
            self.parts.append("&#" + name + ";")

def transform(root):
    root = Path(root)
    index = root / "index.html"
    original = index.read_text(encoding="utf-8")
    if not re.search(r"<main\b", original, re.I):
        raise ValueError("No main element: stop rather than guess the layout")
    match = re.search(r'<script type="application/json" id="catalogData">(.*?)</script>', original, re.S)
    if not match:
        raise ValueError("Missing catalogData: stop rather than replace the catalog")
    before_catalog = json.loads(match.group(1))
    outputs = {}
    def image(match):
        extension = {"jpeg":"jpg", "png":"png", "gif":"gif", "webp":"webp", "avif":"avif"}[match.group(1).lower()]
        raw = base64.b64decode(match.group(2), validate=True)
        if not raw:
            raise ValueError("Empty embedded image")
        name = "assets/extracted/" + hashlib.sha256(raw).hexdigest()[:24] + "." + extension
        outputs[name] = raw
        return name
    text = re.sub(r"data:image/(jpeg|png|gif|webp|avif);base64,([A-Za-z0-9+/]+={0,2})", image, original, flags=re.I)
    blocks = Blocks(text).blocks
    edits = []
    counters = {"style":0, "script":0}
    for kind, attrs, start, body_start, body_end, end, raw in blocks:
        body = text[body_start:body_end]
        if not body.strip():
            continue
        if kind == "script" and ("src" in attrs or attrs.get("type", "").lower() not in ("", "text/javascript", "application/javascript") or "document.currentScript" in body):
            continue
        counters[kind] += 1
        name = "homepage-" + kind + "-" + str(counters[kind]) + (".css" if kind == "style" else ".js")
        if (root / name).exists():
            raise ValueError("Generated filename collision: " + name)
        outputs[name] = body.encode("utf-8")
        if kind == "style":
            keep = "".join(" " + key + '=\"' + escape(value or "", quote=True) + '\"' for key, value in attrs.items() if key in ("media", "title", "nonce"))
            replacement = '<link rel="stylesheet" href="' + name + '"' + keep + '>'
        else:
            replacement = raw[:-1] + ' src="' + name + '"></script>'
        edits.append((start, end, replacement))
    for start, end, replacement in reversed(edits):
        text = text[:start] + replacement + text[end:]
    if 'href="app-navigation.css"' not in text:
        text, count = re.subn(r"</head\s*>", '<link rel="stylesheet" href="app-navigation.css">\n</head>', text, count=1, flags=re.I)
        if count != 1:
            raise ValueError("Missing head close")
    if 'src="app-navigation.js"' not in text:
        text, count = re.subn(r"</body\s*>", '<script src="app-navigation.js" defer></script>\n</body>', text, count=1, flags=re.I)
        if count != 1:
            raise ValueError("Missing body close")
    after_match = re.search(r'<script type="application/json" id="catalogData">(.*?)</script>', text, re.S)
    after_catalog = json.loads(after_match.group(1))
    def publication_records(catalog):
        result = json.loads(json.dumps(catalog))
        for book in result.get("books", []):
            book.pop("cover", None)
        return result
    if publication_records(before_catalog) != publication_records(after_catalog):
        raise ValueError("Publication records changed")
    if VisibleText(original).parts != VisibleText(text).parts:
        raise ValueError("Visible publication text changed")
    for book in after_catalog.get("books", []):
        cover = book.get("cover", "")
        if cover.startswith("assets/extracted/") and cover not in outputs and not (root / cover).is_file():
            raise ValueError("Missing extracted cover: " + cover)
    worker_path = root / "sw.js"
    worker = worker_path.read_text(encoding="utf-8")
    assets = re.search(r"const SHELL_ASSETS = \[(.*?)\];", worker, re.S)
    if not assets:
        raise ValueError("Missing service-worker asset list")
    names = json.loads("[" + assets.group(1) + "]")
    names += list(outputs) + ["app-navigation.css", "app-navigation.js"]
    names += [p.name for pattern in ("homepage-style-*.css", "homepage-script-*.js") for p in sorted(root.glob(pattern))]
    names = sorted(set(names))
    asset_json = json.dumps(names, ensure_ascii=False, indent=2)
    worker = worker[:assets.start()] + "const SHELL_ASSETS = " + asset_json + ";" + worker[assets.end():]
    digest = hashlib.sha256(text.encode("utf-8"))
    for name in names:
        digest.update(name.encode("utf-8"))
        if name in outputs:
            digest.update(outputs[name])
        elif (root / name).is_file():
            digest.update((root / name).read_bytes())
    worker, count = re.subn(r'const VERSION = "[^"]+";', 'const VERSION = "fa-offline-' + digest.hexdigest()[:16] + '";', worker, count=1)
    if count != 1:
        raise ValueError("Missing service-worker version")
    outputs["index.html"] = text.encode("utf-8")
    outputs["sw.js"] = worker.encode("utf-8")
    for name, data in outputs.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return {"homepage_before_bytes":len(original.encode("utf-8")), "homepage_after_bytes":len(text.encode("utf-8")), "extracted_resources":len(outputs)-2, "books_preserved":len(after_catalog.get("books", [])), "articles_preserved":len(after_catalog.get("articles", []))}

if __name__ == "__main__":
    print(json.dumps(transform(Path.cwd()), indent=2))
