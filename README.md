# mobiussystems.be

Website van Mobius Systems: een snelle, statische site in drie talen (NL, FR, EN) met een contactformulier.

## Zo werkt het

```
Pages CMS (browser/gsm) ──► GitHub (deze repository) ──► VPS haalt elke minuut op ──► bouwt ──► online
```

- **Teksten, prijzen, cases en foto's** pas je aan via [Pages CMS](https://app.pagescms.org): log in met GitHub en kies deze repository. Elk tekstveld heeft een vak per taal.
- Na **Opslaan** staat de wijziging binnen een à twee minuten online.
- Elke wijziging is een commit op GitHub. Een fout ongedaan maken kan dus altijd.

## Mappen

| Map / bestand | Inhoud |
|---|---|
| `content/` | Alle teksten (JSON) en de juridische pagina's (Markdown). Dit is wat het CMS aanpast. |
| `media/` | Foto's en screenshots. Uploads uit het CMS komen hier terecht. |
| `src/` | Opmaak (`styles.css`), HTML-sjablonen, vaste labels per taal (`i18n.mjs`) en het kleine script. |
| `static/` | Lettertypes, favicon, logo's en de deelafbeelding (`og.png`). |
| `server/contact.mjs` | De contactformulier-server (stuurt berichten via Brevo). |
| `deploy/` | Alles voor de VPS: installatiescript, Caddy, systemd-diensten. |
| `build.mjs` | Bouwt de site naar `dist/`. Geen pakketten nodig. |
| `.pages.yml` | Instellingen van Pages CMS (welke velden je ziet). |

## Lokaal bouwen

```bash
node build.mjs              # bouwt naar ./dist
npx serve dist              # of een andere eenvoudige webserver
```

Is `sharp` geïnstalleerd (`npm install`), dan worden foto's ook als lichte WebP-bestanden aangemaakt. Zonder werkt alles ook.

## Een nieuwe case toevoegen

1. Open **Werk (cases & labo)** in Pages CMS.
2. Voeg onder **Cases** een item toe en vul de velden in de drie talen in.
3. Upload 1 tot 3 screenshots. Gsm-screenshots: kies weergave "Gsm-screenshots naast elkaar". Eén computerscreenshot: kies "Eén screenshot in browserkader".
4. Vink **Tonen op de site** aan en sla op.

De garage-case staat er al in, maar verborgen. Zet ze aan zodra er screenshots zijn.

## Server (eenmalig)

Op een verse Debian- of Ubuntu-VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/Mobiussystems/mobiussystems.be/main/deploy/setup-vps.sh | sudo bash
```

Daarna:

```bash
sudo nano /etc/mobius-contact.env     # Brevo-sleutel invullen
sudo systemctl restart mobius-contact
```

Handige commando's:

```bash
journalctl -u mobius-update -n 20      # laatste updates van de site
journalctl -u mobius-contact -n 20     # contactformulier
sudo systemctl start mobius-update     # nu meteen bijwerken
```

## Beveiliging en privacy

- Geen cookies, geen trackers, geen externe lettertypes of scripts.
- Strikte Content-Security-Policy (zie `deploy/Caddyfile`): gebruik dus geen inline `style=""` of `<script>` in sjablonen.
- Het contactformulier heeft een spamval, een limiet per IP-adres en bewaart zelf geen berichten.
