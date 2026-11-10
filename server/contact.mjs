#!/usr/bin/env node
// Contactformulier-server voor mobiussystems.be
// Ontvangt berichten op POST /api/contact en stuurt ze via de Brevo-API door.
// Geen externe pakketten nodig (Node 18 of nieuwer).
//
// Instellingen via omgevingsvariabelen (zie deploy/contact.env.voorbeeld):
//   BREVO_API_KEY   API-sleutel van Brevo (verplicht, behalve bij DRY_RUN=1)
//   MAIL_TO         ontvanger, bv. aiko@mobiussystems.be
//   MAIL_FROM       afzender op een geverifieerd domein, bv. website@mobiussystems.be
//   MAIL_FROM_NAME  naam van de afzender (standaard "Website Mobius Systems")
//   ALLOWED_ORIGINS komma-gescheiden lijst, bv. https://mobiussystems.be,https://www.mobiussystems.be
//   PORT            standaard 8787 (luistert enkel op 127.0.0.1)
//   DRY_RUN=1       niets versturen, enkel loggen (om te testen)

import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const API_KEY = process.env.BREVO_API_KEY || '';
const MAIL_TO = process.env.MAIL_TO || 'aiko@mobiussystems.be';
const MAIL_FROM = process.env.MAIL_FROM || 'website@mobiussystems.be';
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'Website Mobius Systems';
const DRY_RUN = process.env.DRY_RUN === '1';
const ALLOWED = (process.env.ALLOWED_ORIGINS || 'https://mobiussystems.be,https://www.mobiussystems.be')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const REDIRECTS = {
  nl: { ok: '/bedankt/', fout: '/fout/' },
  fr: { ok: '/fr/merci/', fout: '/fr/erreur/' },
  en: { ok: '/en/thank-you/', fout: '/en/error/' },
};

if (!API_KEY && !DRY_RUN) {
  console.error('BREVO_API_KEY ontbreekt. Zet DRY_RUN=1 om zonder te testen.');
  process.exit(1);
}

// ---------------------------------------------------------------- limieten

const perIp = new Map(); // ip -> [tijdstippen]
const HOUR = 60 * 60 * 1000;
const MAX_PER_IP_PER_HOUR = 5;
const MAX_PER_DAY = 60;
let dayStart = Date.now();
let dayCount = 0;

function allowed(ip) {
  const now = Date.now();
  if (now - dayStart > 24 * HOUR) {
    dayStart = now;
    dayCount = 0;
  }
  if (dayCount >= MAX_PER_DAY) return false;
  const list = (perIp.get(ip) || []).filter((t) => now - t < HOUR);
  if (list.length >= MAX_PER_IP_PER_HOUR) {
    perIp.set(ip, list);
    return false;
  }
  list.push(now);
  perIp.set(ip, list);
  dayCount++;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of perIp) if (!list.some((t) => now - t < HOUR)) perIp.delete(ip);
}, 10 * 60 * 1000).unref();

// ---------------------------------------------------------------- hulpfuncties

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clean = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const oneLine = (v, max) => clean(v, max).replace(/\s+/g, ' ');
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

function readBody(req, limit = 20 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('te groot'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parse(body, type) {
  if (type.includes('application/json')) return JSON.parse(body || '{}');
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(body));
  throw Object.assign(new Error('type'), { status: 415 });
}

function clientIp(req) {
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket.remoteAddress || 'onbekend';
}

async function sendMail(msg) {
  const subject = `Nieuwe aanvraag via mobiussystems.be — ${msg.naam}`;
  const lines = [
    `Naam: ${msg.naam}`,
    `E-mail: ${msg.email}`,
    msg.bedrijf ? `Bedrijf/vereniging: ${msg.bedrijf}` : null,
    `Taal: ${msg.taal.toUpperCase()}`,
    '',
    msg.bericht,
  ].filter((l) => l !== null);
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#0b0d12">
<p style="margin:0 0 16px"><strong>Nieuwe aanvraag via mobiussystems.be</strong></p>
<table style="border-collapse:collapse;margin-bottom:16px">
<tr><td style="padding:2px 16px 2px 0;color:#555b66">Naam</td><td>${esc(msg.naam)}</td></tr>
<tr><td style="padding:2px 16px 2px 0;color:#555b66">E-mail</td><td><a href="mailto:${esc(msg.email)}">${esc(msg.email)}</a></td></tr>
${msg.bedrijf ? `<tr><td style="padding:2px 16px 2px 0;color:#555b66">Bedrijf</td><td>${esc(msg.bedrijf)}</td></tr>` : ''}
<tr><td style="padding:2px 16px 2px 0;color:#555b66">Taal</td><td>${esc(msg.taal.toUpperCase())}</td></tr>
</table>
<div style="white-space:pre-wrap;border-left:3px solid #2440e6;padding-left:12px">${esc(msg.bericht)}</div>
<p style="margin-top:20px;color:#555b66;font-size:13px">Antwoord gewoon op deze e-mail om ${esc(msg.naam)} te bereiken.</p>
</div>`;

  const payload = {
    sender: { name: MAIL_FROM_NAME, email: MAIL_FROM },
    to: [{ email: MAIL_TO }],
    replyTo: { email: msg.email, name: msg.naam },
    subject,
    textContent: lines.join('\n'),
    htmlContent: html,
    tags: ['website-contact'],
  };

  if (DRY_RUN) {
    console.log('[DRY_RUN] zou versturen:', JSON.stringify({ ...payload, htmlContent: '(html)' }));
    return;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Brevo antwoordde ${res.status}: ${text.slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------- server

function reply(res, wantsJson, lang, status, result) {
  if (wantsJson) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(result));
    return;
  }
  const r = REDIRECTS[lang] || REDIRECTS.nl;
  res.writeHead(303, { location: result.ok ? r.ok : r.fout, 'cache-control': 'no-store' });
  res.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (url.pathname !== '/api/contact') {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Niet gevonden');
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { allow: 'POST', 'content-type': 'text/plain' });
    res.end('Enkel POST');
    return;
  }

  const type = String(req.headers['content-type'] || '');
  const wantsJson = type.includes('application/json');
  const origin = req.headers.origin;
  if (origin && !ALLOWED.includes(origin)) {
    reply(res, wantsJson, 'nl', 403, { ok: false, error: 'origin' });
    return;
  }

  let data;
  try {
    data = parse(await readBody(req), type);
  } catch (e) {
    reply(res, wantsJson, 'nl', e.status || 400, { ok: false, error: 'invalid' });
    return;
  }

  const lang = ['nl', 'fr', 'en'].includes(data.taal) ? data.taal : 'nl';

  // Spamval: verborgen veld ingevuld of te snel verstuurd -> doen alsof het lukte.
  const t = Number(data.t);
  if (clean(data.website, 200) || (t && Date.now() - t < 3000)) {
    console.log(`spam genegeerd (${clientIp(req)})`);
    reply(res, wantsJson, lang, 200, { ok: true });
    return;
  }

  const msg = {
    naam: oneLine(data.naam, 100),
    email: oneLine(data.email, 200),
    bedrijf: oneLine(data.bedrijf, 150),
    bericht: clean(data.bericht, 5000),
    taal: lang,
  };
  if (!msg.naam || !EMAIL_RE.test(msg.email) || msg.bericht.length < 10) {
    reply(res, wantsJson, lang, 422, { ok: false, error: 'invalid' });
    return;
  }

  if (!allowed(clientIp(req))) {
    reply(res, wantsJson, lang, 429, { ok: false, error: 'limit' });
    return;
  }

  try {
    await sendMail(msg);
    console.log(`bericht doorgestuurd (${lang})`);
    reply(res, wantsJson, lang, 200, { ok: true });
  } catch (e) {
    console.error('versturen mislukt:', e.message);
    reply(res, wantsJson, lang, 502, { ok: false, error: 'send' });
  }
});

// Brevo schakelt sleutels uit na 90 dagen zonder gebruik. Een wekelijkse,
// alleen-lezen opvraging houdt de sleutel actief en meldt problemen in het logboek.
async function keepAlive() {
  if (DRY_RUN) return;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/statistics/aggregatedReport?days=1', {
      headers: { 'api-key': API_KEY, accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) console.log('Brevo-sleutel gecontroleerd: in orde');
    else console.error(`Let op: Brevo-sleutel gaf ${res.status} bij de wekelijkse controle`);
  } catch (e) {
    console.error('Let op: Brevo niet bereikbaar bij de wekelijkse controle:', e.message);
  }
}
setTimeout(keepAlive, 60 * 1000).unref();
setInterval(keepAlive, 7 * 24 * HOUR).unref();

server.listen(PORT, HOST, () => {
  console.log(`Contactserver luistert op http://${HOST}:${PORT}${DRY_RUN ? ' (DRY_RUN)' : ''}`);
});
