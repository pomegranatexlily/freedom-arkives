#!/usr/bin/env python3
"""Rebuild the approved Freedom Arkives icon from its existing ecosystem poster artwork.

Only crop/resample the already approved graphic; no new imagery or redesign.
The 256px source limits actual visible image detail at larger output sizes.
"""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/arkives-poster-icon-source.jpg"
OUTPUTS = {"favicon-32.png":32,"apple-touch-icon.png":180,"icon-192.png":192,"icon-512.png":512}
with Image.open(SOURCE) as img:
    img.load()
    if img.size != (256,256):
        raise ValueError("Approved icon source must be 256×256")
    img = img.convert("RGB")
    for name,side in OUTPUTS.items():
        dest = ROOT / name
        img.resize((side,side),Image.Resampling.LANCZOS).save(dest,format="PNG",optimize=True)
        with Image.open(dest) as check:
            if check.format != "PNG" or check.size != (side,side):
                raise RuntimeError("Invalid generated icon: "+name)
        print("Built",name,side)
