#!/usr/bin/env bash
# Renders src/og.html to og.png at exactly 1200x630 — the size Open Graph
# consumers (WhatsApp, X, LinkedIn) expect for a large link preview card.
#
# Headless Chrome is used rather than an SVG rasteriser because the card sets
# Arabic type, and only a real browser shapes and kerns it correctly.
#
#   bash tools/make-og.sh
set -e
D="$(cd "$(dirname "$0")/.." && pwd)"

CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
[ -x "$CHROME" ] || CHROME="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -x "$CHROME" ] || { echo "no Chrome or Edge found" >&2; exit 1; }

# --virtual-time-budget lets the webfonts finish downloading before the shot;
# without it the card renders in fallback type.
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --hide-scrollbars \
  --force-device-scale-factor=1 \
  --window-size=1200,630 \
  --virtual-time-budget=8000 \
  --screenshot="C:/Users/falbl/bud-site/og.png" \
  "file:///C:/Users/falbl/bud-site/src/og.html" 2>/dev/null

echo "wrote og.png — $(wc -c < "$D/og.png") bytes"
