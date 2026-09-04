#!/usr/bin/env bash
# Rebuilds the deployable page from the sources in src/.
#   src/_head.html  = the real <head> (title, meta, OG tags, fonts, favicon)
#   src/index.html  = the page body + styles + script
#   index.html      = the built file Vercel serves
# Run after any edit to src/:  bash build.sh
set -e
D="$(cd "$(dirname "$0")" && pwd)"
{
  cat "$D/src/_head.html"
  cat "$D/src/index.html"
  printf '\n</body>\n</html>\n'
} > "$D/index.html"
echo "built index.html — $(wc -c < "$D/index.html") bytes"
