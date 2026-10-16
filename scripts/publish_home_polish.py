#!/usr/bin/env python3
"""Publish the approved home controls and a pinned, licensed first-party font."""
import hashlib
import json
import re
import urllib.request
from pathlib import Path

EXPECTED = {"app-navigation.js":"b864ea2411197858c23ca27cd2e41b7e7cd2a539", "app-navigation.css":"b0850c66f2c23dd28ae4e8cded8c273acd99a53d", "privacy-consent.js":"04c07f427b8d674412487d800433daf5e659d394"}
BASE = "https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/schibstedgrotesk/"
FONT_FILES = [("SchibstedGrotesk%5Bwght%5D.ttf", "assets/fonts/SchibstedGrotesk-wght.ttf", "78ad61cf65a390c517248f46d325a1e9b88d367d"), ("OFL.txt", "assets/fonts/SchibstedGrotesk-OFL.txt", "ba41e1147195c699cf6c9b91cf07d8a0e4f44cdb")]
CSS = '\n/* Approved Schibsted homepage polish */\n@font-face{font-family:"Schibsted Grotesk";src:url("assets/fonts/SchibstedGrotesk-wght.ttf") format("truetype");font-style:normal;font-weight:100 900;font-display:swap}\nhtml.fa-section-navigation{--serif:"Schibsted Grotesk",system-ui,sans-serif;--sans:"Schibsted Grotesk",system-ui,sans-serif;--mono:"Schibsted Grotesk",system-ui,sans-serif}\n.fa-section-navigation .brand strong{font-weight:600}\n#fa-section-menu summary{width:44px;height:44px;min-height:44px;border:3px solid #fff;border-radius:50%;background:#203027;color:#fff}\n#fa-section-menu summary svg{display:block;width:20px;height:20px;fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}\n#fa-section-menu .fa-site-settings{display:block;width:100%;min-height:44px;padding:12px;border:0;border-top:1px solid var(--line);border-radius:0;background:transparent;color:inherit;text-align:left;font:500 14px/1.4 var(--sans);cursor:pointer}\n#fa-section-menu .fa-site-settings::before{content:none}\n#fa-section-menu .fa-site-settings:hover{background:var(--paper-2);color:var(--copper);opacity:1}\n#fa-section-menu .fa-site-settings:focus-visible{outline:3px solid var(--copper);outline-offset:2px}\n#home .hero-actions .btn{display:flex;align-items:center;justify-content:center;min-height:49px;padding:14px 22px;border:0;border-radius:999px;font-family:var(--sans);font-size:15px;line-height:1.35;font-weight:500;letter-spacing:-.015em;transition:opacity .15s,transform .15s}\n#home .hero-actions .btn.primary{background:var(--ink);color:var(--paper)}\n#home .hero-actions .btn.primary:hover{background:var(--ink);color:var(--paper);opacity:.9}\n#home .hero-actions .btn:not(.primary){gap:12px;min-height:48px;padding:12px 0;border:0;border-radius:0;background:transparent;color:var(--ink);font-size:14px;text-decoration:none}\n#home .hero-actions .btn:not(.primary)::after{content:"\\2192";font-size:18px;line-height:1}\n#home .hero-actions .btn:not(.primary):hover{color:var(--copper)}\n#home .hero-actions .btn:active{transform:translateY(1px)}\n#home .hero-actions .btn:focus-visible{outline:2px solid var(--copper);outline-offset:4px}\n@media(max-width:640px){#home .hero-actions{flex-direction:column;align-items:stretch;gap:12px}#home .hero-actions .btn{width:100%}}\n@media(prefers-reduced-motion:reduce){#home .hero-actions .btn{transition:none;transform:none}}\n'
OLD_TOGGLE = '    var toggle = document.createElement("summary"); toggle.textContent = "☰"; toggle.setAttribute("aria-label", "Open navigation menu"); menu.appendChild(toggle);'
NEW_TOGGLE = '    /* Approved homepage menu */\n    var toggle = document.createElement("summary"); toggle.setAttribute("aria-label", "Open navigation menu");\n    var menuIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg"); menuIcon.setAttribute("viewBox", "0 0 24 24"); menuIcon.setAttribute("aria-hidden", "true");\n    var menuLines = document.createElementNS("http://www.w3.org/2000/svg", "path"); menuLines.setAttribute("d", "M5 7h14M5 12h14M5 17h10"); menuIcon.appendChild(menuLines); toggle.appendChild(menuIcon); menu.appendChild(toggle);'
MOUNT = '    slot.appendChild(menu);\n    function mountSettings() {\n      var settings = slot.querySelector(".fa-site-settings");\n      if (settings) { settings.textContent = "Settings"; list.appendChild(settings); }\n    }\n    mountSettings();\n    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountSettings, {once:true});'

def blob_sha(raw):
    return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()

def once(text, old, new):
    if text.count(old) != 1:
        raise ValueError("Unexpected source anchor; no source files written")
    return text.replace(old, new, 1)

def make_updates(current):
    nav = current["app-navigation.js"]
    privacy = current["privacy-consent.js"]
    css = current["app-navigation.css"]
    nav = once(nav, OLD_TOGGLE, NEW_TOGGLE)
    nav = once(nav, "    slot.appendChild(menu);", MOUNT)
    nav = once(nav, 'event.target.closest("a")', 'event.target.closest("a,.fa-site-settings")')
    privacy = once(privacy, '  var slot=document.querySelector(".site-head .nav") ||', '  var slot=document.querySelector(".site-head .nav .fa-menu-links") ||\n    document.querySelector(".site-head .nav") ||')
    privacy = once(privacy, 'manage=makeButton("⚙ Settings","fa-site-settings",open);', 'manage=makeButton("Settings","fa-site-settings",open);')
    privacy = once(privacy, '  if(!allowed("externalMedia")){if(link)link.remove();return;}', '  if(document.querySelector(".site-head") || !allowed("externalMedia")){if(link)link.remove();return;}')
    return {"app-navigation.js":nav, "privacy-consent.js":privacy, "app-navigation.css":css + CSS}

def ensure_fonts(root):
    for source, target, expected in FONT_FILES:
        path = root / target
        if path.is_file() and blob_sha(path.read_bytes()) == expected:
            continue
        request = urllib.request.Request(BASE + source, headers={"User-Agent":"FreedomArkives-font-packager/1.0"})
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read(3000000)
        if blob_sha(data) != expected:
            raise ValueError("Official font/license hash mismatch")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

def apply(root):
    root = Path(root)
    current = {name:(root/name).read_text(encoding="utf-8") for name in EXPECTED}
    done = "Approved Schibsted homepage polish" in current["app-navigation.css"] and "Approved homepage menu" in current["app-navigation.js"] and '.site-head .nav .fa-menu-links' in current["privacy-consent.js"]
    if done:
        updates = {}
    else:
        for name, expected in EXPECTED.items():
            if blob_sha(current[name].encode("utf-8")) != expected:
                raise ValueError("Source changed since inspection: " + name)
        updates = make_updates(current)
    ensure_fonts(root)
    worker = root / "sw.js"
    text = worker.read_text(encoding="utf-8")
    match = re.search(r"const SHELL_ASSETS = \[(.*?)\];", text, re.S)
    if not match:
        raise ValueError("Missing offline asset list")
    assets = list(dict.fromkeys(json.loads("[" + match.group(1) + "]") + [FONT_FILES[0][1]]))
    text = text[:match.start()] + "const SHELL_ASSETS = " + json.dumps(assets, indent=2) + ";" + text[match.end():]
    for name, value in updates.items():
        (root/name).write_text(value, encoding="utf-8")
    worker.write_text(text, encoding="utf-8")
    print("Approved homepage polish applied; original content and image files untouched.")

if __name__ == "__main__":
    apply(Path.cwd())
