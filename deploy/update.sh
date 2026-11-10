#!/usr/bin/env bash
# Haalt de nieuwste versie van GitHub op, bouwt de site en zet ze online.
# Draait elke minuut via mobius-update.timer (als gebruiker "mobius").
# Handmatig forceren:  sudo systemctl start mobius-update.service
#   of:                sudo -u mobius FORCE=1 /opt/mobiussystems/repo/deploy/update.sh
set -euo pipefail

BASE=/opt/mobiussystems
REPO="$BASE/repo"
BUILD="$BASE/build"
WEB=/var/www/mobiussystems.be
BRANCH="${BRANCH:-main}"

cd "$REPO"
git fetch --quiet origin "$BRANCH"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")
if [ "$LOCAL" = "$REMOTE" ] && [ "${FORCE:-0}" != "1" ] && [ -f "$WEB/index.html" ]; then
  exit 0
fi

OLD_SERVER=$(git rev-parse "HEAD:server/contact.mjs" 2>/dev/null || echo geen)
git reset --hard --quiet "origin/$BRANCH"

# Pakketten (enkel sharp, voor lichtere afbeeldingen) bijwerken als package.json wijzigde
if ! cmp -s package.json "$BASE/.package.json" 2>/dev/null; then
  if npm install --omit=dev --no-audit --no-fund --loglevel=error; then
    cp package.json "$BASE/.package.json"
  else
    echo "npm install mislukt: de site wordt gebouwd zonder WebP-afbeeldingen" >&2
  fi
fi

# Bouwen in een aparte map; pas als dat lukt, gaat het online.
node build.mjs --out "$BUILD"
rsync -a --delete "$BUILD"/ "$WEB"/

NEW_SERVER=$(git rev-parse "HEAD:server/contact.mjs")
if [ "$OLD_SERVER" != "$NEW_SERVER" ]; then
  sudo -n /usr/bin/systemctl restart mobius-contact.service || echo "Kon de contactserver niet herstarten" >&2
fi

echo "Site bijgewerkt naar $(git rev-parse --short HEAD): $(git log -1 --pretty=%s)"
