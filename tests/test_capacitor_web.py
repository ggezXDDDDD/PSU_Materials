#!/usr/bin/env python3
"""Small regression check for the Capacitor web staging step."""

from pathlib import Path
from json import loads
from subprocess import run

ROOT = Path(__file__).resolve().parent.parent
run(["python3", "scripts/prepare_capacitor_web.py"], cwd=ROOT, check=True)

for path in ("index.html", "assets/js/auth.js", "pages/polymer.html", "data/tasks_live.json"):
    assert (ROOT / "web" / path).is_file(), path
assert not (ROOT / "web" / "server.py").exists()
mobile_css = (ROOT / "web" / "assets/css/portal-liquid.css").read_text(encoding="utf-8")
assert "backdrop-filter:blur(5px)" not in mobile_css
assert "isDevelopmentServer" in (ROOT / "web" / "assets/js/pwa.js").read_text(encoding="utf-8")
assert "server" not in loads((ROOT / "capacitor.config.json").read_text(encoding="utf-8"))
print("Capacitor web staging: PASS")
