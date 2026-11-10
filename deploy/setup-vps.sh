#!/usr/bin/env bash
# Eenmalige installatie van mobiussystems.be op een Debian- of Ubuntu-VPS.
# Uitvoeren als root (of met sudo). Je mag het script gerust opnieuw draaien.
#
#   curl -fsSL https://raw.githubusercontent.com/Mobiussystems/mobiussystems.be/main/deploy/setup-vps.sh | sudo bash
#
# Wat het doet:
#   1. installeert Caddy (webserver + automatische HTTPS), Node.js, git en rsync
#   2. maakt de gebruiker "mobius" aan en haalt de site op van GitHub
#   3. bouwt de site en zet ze in /var/www/mobiussystems.be
#   4. zet de contactformulier-server en de automatische updates (elke minuut) op
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Mobiussystems/mobiussystems.be.git}"
REPO_SSH="${REPO_SSH:-git@github.com:Mobiussystems/mobiussystems.be.git}"
BASE=/opt/mobiussystems
WEB=/var/www/mobiussystems.be
ENV_FILE=/etc/mobius-contact.env

say() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\n\033[1;33m!!\033[0m %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Voer dit script uit als root (bv. met sudo)." >&2
  exit 1
fi
if ! command -v apt-get >/dev/null; then
  echo "Dit script werkt enkel op Debian of Ubuntu." >&2
  exit 1
fi

say "Pakketten installeren"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl git rsync gnupg debian-keyring debian-archive-keyring apt-transport-https ca-certificates nodejs npm sudo

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js $NODE_MAJOR is te oud (minstens 18 nodig)." >&2
  exit 1
fi

if ! command -v caddy >/dev/null; then
  say "Caddy installeren"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

say "Gebruiker en mappen"
if ! id mobius >/dev/null 2>&1; then
  useradd --system --home-dir "$BASE" --create-home --shell /usr/sbin/nologin mobius
fi
mkdir -p "$BASE" "$WEB"
chown -R mobius:mobius "$BASE" "$WEB"

say "Site ophalen van GitHub"
if [ ! -d "$BASE/repo/.git" ]; then
  if ! sudo -u mobius git clone --quiet "$REPO_URL" "$BASE/repo" 2>/dev/null; then
    # Privé-repository: deploy key aanmaken
    sudo -u mobius mkdir -p "$BASE/.ssh"
    chmod 700 "$BASE/.ssh"
    if [ ! -f "$BASE/.ssh/id_ed25519" ]; then
      sudo -u mobius ssh-keygen -q -t ed25519 -N '' -C 'mobiussystems-vps' -f "$BASE/.ssh/id_ed25519"
    fi
    sudo -u mobius sh -c "ssh-keyscan -t ed25519 github.com >> '$BASE/.ssh/known_hosts' 2>/dev/null"
    if ! sudo -u mobius git clone --quiet "$REPO_SSH" "$BASE/repo" 2>/dev/null; then
      warn "De repository is privé. Voeg deze sleutel toe op GitHub:"
      echo "   Repository → Settings → Deploy keys → Add deploy key (alleen lezen)"
      echo
      cat "$BASE/.ssh/id_ed25519.pub"
      echo
      echo "Draai daarna dit script opnieuw."
      exit 1
    fi
  fi
fi
chmod +x "$BASE/repo/deploy/update.sh"

say "Contactformulier instellen"
if [ ! -f "$ENV_FILE" ]; then
  cp "$BASE/repo/deploy/contact.env.voorbeeld" "$ENV_FILE"
fi
chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"

install -m 644 "$BASE/repo/deploy/mobius-contact.service" /etc/systemd/system/mobius-contact.service
install -m 644 "$BASE/repo/deploy/mobius-update.service" /etc/systemd/system/mobius-update.service
install -m 644 "$BASE/repo/deploy/mobius-update.timer" /etc/systemd/system/mobius-update.timer

# De update-dienst mag (enkel) de contactserver herstarten
echo 'mobius ALL=(root) NOPASSWD: /usr/bin/systemctl restart mobius-contact.service' > /etc/sudoers.d/mobius
chmod 440 /etc/sudoers.d/mobius
visudo -cf /etc/sudoers.d/mobius >/dev/null

say "Site bouwen"
sudo -u mobius -H env FORCE=1 "$BASE/repo/deploy/update.sh"

say "Caddy instellen"
if [ -f /etc/caddy/Caddyfile ] && ! cmp -s /etc/caddy/Caddyfile "$BASE/repo/deploy/Caddyfile"; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.backup-$(date +%Y%m%d%H%M%S)"
fi
install -m 644 "$BASE/repo/deploy/Caddyfile" /etc/caddy/Caddyfile
mkdir -p /var/log/caddy
chown caddy:caddy /var/log/caddy
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl enable caddy >/dev/null 2>&1
systemctl reload caddy 2>/dev/null || systemctl restart caddy

say "Diensten starten"
systemctl daemon-reload
systemctl enable --now mobius-update.timer >/dev/null
systemctl enable mobius-contact.service >/dev/null 2>&1
if grep -q 'VUL_HIER' "$ENV_FILE"; then
  warn "Het contactformulier wacht nog op je Brevo-sleutel."
  echo "   sudo nano $ENV_FILE        (vul BREVO_API_KEY in)"
  echo "   sudo systemctl restart mobius-contact"
else
  systemctl restart mobius-contact.service
fi

IP=$(curl -4 -fsS https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
say "Klaar"
echo "   Site staat in $WEB en wordt elke minuut bijgewerkt vanaf GitHub."
echo "   Zorg dat de DNS van mobiussystems.be en www.mobiussystems.be naar $IP wijst."
echo "   Logboek van updates:   journalctl -u mobius-update -n 20"
echo "   Logboek contact:       journalctl -u mobius-contact -n 20"
