#!/usr/bin/env node
// Bouwt de statische site naar ./dist (of de map na --out).
// Geen externe pakketten nodig. Is 'sharp' geïnstalleerd, dan worden
// afbeeldingen ook als lichte WebP-versies weggeschreven.
//
//   node build.mjs
//   node build.mjs --out /pad/naar/map
//   node build.mjs --site-url https://voorbeeld.be

import { readFile, writeFile, mkdir, rm, cp, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LANGS, ROUTES, UI } from './src/i18n.mjs';
import { homePage, legalPage, messagePage } from './src/templates.mjs';
import { markdown, parseFrontmatter } from './src/markdown.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT = path.resolve(arg('--out', path.join(ROOT, 'dist')));
const SITE_URL = arg('--site-url', 'https://mobiussystems.be').replace(/\/$/, '');

let sharp = null;
try {
  sharp = createRequire(import.meta.url)('sharp');
} catch {
  sharp = null;
}

const warnings = [];
const warn = (m) => warnings.push(m);

// ------------------------------------------------------------ inhoud lezen

async function readJson(rel) {
  const file = path.join(ROOT, 'content', rel);
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    throw new Error(`Kan ${rel} niet lezen: ${e.message}`);
  }
}

async function readDoc(rel) {
  const src = await readFile(path.join(ROOT, 'content', rel), 'utf8');
  const { data, body } = parseFrontmatter(src);
  return { data, html: markdown(body) };
}

// Controleer of elke tekst in alle talen ingevuld is.
function checkTranslations(obj, where) {
  if (Array.isArray(obj)) return obj.forEach((v, i) => checkTranslations(v, `${where}[${i}]`));
  if (!obj || typeof obj !== 'object') return;
  const keys = Object.keys(obj);
  if (keys.length && keys.every((k) => LANGS.includes(k))) {
    const filled = LANGS.filter((l) => (obj[l] || '').trim());
    if (filled.length && filled.length < LANGS.length) {
      warn(`Vertaling ontbreekt in ${where}: ${LANGS.filter((l) => !(obj[l] || '').trim()).join(', ')}`);
    }
    return;
  }
  for (const k of keys) checkTranslations(obj[k], `${where}.${k}`);
}

// ------------------------------------------------------------ afbeeldingen

function imageSize(buf) {
  // PNG
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  // WebP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

function collectImages(content) {
  const found = new Set();
  const walk = (v) => {
    if (typeof v === 'string' && /^\/media\/.+\.(png|jpe?g|webp|gif|avif)$/i.test(v)) found.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(content);
  return [...found];
}

async function processImages(list) {
  const media = new Map();
  const widths = [480, 960, 1440];
  for (const src of list) {
    const rel = src.replace(/^\//, '');
    const file = path.join(ROOT, rel);
    if (!existsSync(file)) {
      warn(`Afbeelding niet gevonden: ${src}`);
      continue;
    }
    const buf = await readFile(file);
    const dims = imageSize(buf) || {};
    const outFile = path.join(OUT, rel);
    await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, buf);
    const hash = createHash('sha1').update(buf).digest('hex').slice(0, 8);
    const entry = { url: `${src}?v=${hash}`, width: dims.width, height: dims.height, webp: [] };

    if (sharp && dims.width) {
      const base = rel.replace(/\.[^.]+$/, '');
      const targets = widths.filter((w) => w < dims.width);
      targets.push(Math.min(dims.width, widths[widths.length - 1]));
      for (const w of [...new Set(targets)]) {
        const outRel = `${base}-${w}.webp`;
        await sharp(buf).resize({ width: w }).webp({ quality: 82 }).toFile(path.join(OUT, outRel));
        entry.webp.push({ w, url: `/${outRel}?v=${hash}` });
      }
    }
    media.set(src, entry);
  }
  return media;
}

// ------------------------------------------------------------ hulpfuncties

async function write(rel, html) {
  const file = path.join(OUT, rel.endsWith('/') ? rel + 'index.html' : rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}

// Franse typografie: vaste (smalle) spatie voor : ; ! ? en binnen « »
const frenchSpacing = (html) =>
  html
    .replace(/ ([;:!?])/g, ' $1')
    .replace(/« /g, '« ')
    .replace(/ »/g, ' »');

const hashOf = (...parts) => createHash('sha1').update(parts.join('\n')).digest('hex').slice(0, 10);

// ------------------------------------------------------------ bouwen

async function build() {
  const started = Date.now();
  const content = {
    settings: await readJson('instellingen.json'),
    hero: await readJson('hero.json'),
    werk: await readJson('werk.json'),
    diensten: await readJson('diensten.json'),
    werkwijze: await readJson('werkwijze.json'),
    over: await readJson('over.json'),
    contact: await readJson('contact.json'),
  };
  for (const [k, v] of Object.entries(content)) checkTranslations(v, k);

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // vaste bestanden (lettertypes, iconen, og-afbeelding)
  await cp(path.join(ROOT, 'static'), OUT, { recursive: true });

  // css en js
  const css = await readFile(path.join(ROOT, 'src/styles.css'), 'utf8');
  const js = await readFile(path.join(ROOT, 'src/main.js'), 'utf8');
  const flag = await readFile(path.join(ROOT, 'src/flag.js'), 'utf8');
  await mkdir(path.join(OUT, 'assets'), { recursive: true });
  await writeFile(path.join(OUT, 'assets/styles.css'), css);
  await writeFile(path.join(OUT, 'assets/main.js'), js);
  await writeFile(path.join(OUT, 'assets/flag.js'), flag);
  const assetVersion = hashOf(css, js, flag);

  const media = await processImages(collectImages(content));

  const site = { url: SITE_URL };
  const year = new Date().getFullYear();

  for (const lang of LANGS) {
    const ctx = { lang, site, settings: content.settings, c: content, media, assetVersion, year };
    const r = ROUTES[lang];
    const ui = UI[lang];

    const typo = lang === 'fr' ? frenchSpacing : (h) => h;
    await write(r.home, typo(homePage(ctx)));
    await write(r.privacy, typo(legalPage(ctx, 'privacy', await readDoc(`juridisch/privacy.${lang}.md`))));
    await write(r.voorwaarden, typo(legalPage(ctx, 'voorwaarden', await readDoc(`juridisch/voorwaarden.${lang}.md`))));
    await write(r.bedankt, typo(messagePage(ctx, 'bedankt', { ...ui.bedankt })));
    await write(r.fout, typo(messagePage(ctx, 'fout', { ...ui.fout, mail: true })));
  }

  // 404 (Nederlands, met links naar de andere talen in de header)
  const ctx404 = { lang: 'nl', site, settings: content.settings, c: content, media, assetVersion, year };
  await write('404.html', messagePage(ctx404, null, { ...UI.nl.nietGevonden }));

  // sitemap en robots
  const urls = [];
  for (const key of ['home', 'privacy', 'voorwaarden']) {
    for (const lang of LANGS) {
      const alts = LANGS.map(
        (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE_URL}${ROUTES[l][key]}"/>`
      ).join('\n');
      urls.push(`  <url>\n    <loc>${SITE_URL}${ROUTES[lang][key]}</loc>\n${alts}\n  </url>`);
    }
  }
  await write(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
  );
  await write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  const ms = Date.now() - started;
  console.log(`Klaar in ${ms} ms → ${OUT}${sharp ? '' : ' (zonder WebP: sharp niet geïnstalleerd)'}`);
  for (const w of warnings) console.warn('Let op: ' + w);
}

build().catch((e) => {
  console.error('Bouwen mislukt:', e.message);
  process.exit(1);
});
