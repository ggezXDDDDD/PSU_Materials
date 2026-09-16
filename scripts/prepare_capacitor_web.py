#!/usr/bin/env python3
"""Stage the existing static site for Capacitor without duplicating its source."""

from pathlib import Path
from shutil import copy2, copytree, rmtree

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "web"
FILES = ("index.html", "login.html", "courses.html", "tasks.html", "calendar.html", "liquid-glass.html", "offline.html", "manifest.json", "sw.js")
DIRECTORIES = ("assets", "data", "pages", "01_วิชาเอก_Materials", "02_วิชาศึกษาทั่วไป_GenEd")

if OUTPUT.exists():
    rmtree(OUTPUT)
OUTPUT.mkdir()

for name in FILES:
    copy2(ROOT / name, OUTPUT / name)
for name in DIRECTORIES:
    copytree(ROOT / name, OUTPUT / name)

print(f"Prepared {OUTPUT.relative_to(ROOT)} from the shared web source.")
