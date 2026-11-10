// HTML-sjablonen. Geen inline stijlen: alles loopt via klassen in styles.css,
// zodat de strikte Content-Security-Policy van de server blijft werken.

import { LANGS, ROUTES, UI, LOCALE, OG_LOCALE } from './i18n.mjs';

export const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Tekst in de gevraagde taal, met terugval op Nederlands.
export const t = (obj, lang) => {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.nl || '';
};

const pad = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------- iconen

const LOGO_PATH =
  'M16 8 C 13.5 3.2, 4.5 3.2, 4.5 8 C 4.5 12.8, 13.5 12.8, 16 8 C 18.5 3.2, 27.5 3.2, 27.5 8 C 27.5 12.8, 18.5 12.8, 16 8 Z';

export const logoMark = (cls = 'logo-mark') =>
  `<svg class="${cls}" viewBox="0 0 32 16" aria-hidden="true" focusable="false"><path d="${LOGO_PATH}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>`;

const arrow = `<svg class="icon-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const check = `<svg class="icon-check" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const SERVICE_ICONS = {
  website: `<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9h18"/>`,
  webapp: `<path d="M12 3.5 L20.5 8 L12 12.5 L3.5 8 Z"/><path d="M3.5 12 L12 16.5 L20.5 12"/><path d="M3.5 16 L12 20.5 L20.5 16"/>`,
  hosting: `<rect x="3.5" y="4" width="17" height="7" rx="1.5"/><rect x="3.5" y="13" width="17" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01" stroke-width="2.2" stroke-linecap="round"/>`,
};
const serviceIcon = (key) =>
  `<svg class="service-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">${SERVICE_ICONS[key] || SERVICE_ICONS.website}</g></svg>`;

const menuIcon = `<svg class="menu-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path class="menu-icon-top" d="M3 7h14"/><path class="menu-icon-bottom" d="M3 13h14"/></svg>`;

// ---------------------------------------------------------------- afbeeldingen

export function picture(ctx, src, alt, { sizes = '100vw', cls = '', eager = false } = {}) {
  if (!src) return '';
  const m = ctx.media.get(src);
  const dims = m && m.width ? ` width="${m.width}" height="${m.height}"` : '';
  const loading = eager ? 'eager' : 'lazy';
  const img = `<img src="${esc(m ? m.url : src)}" alt="${esc(alt)}"${dims} loading="${loading}" decoding="async"${cls ? ` class="${cls}"` : ''}>`;
  if (!m || !m.webp || !m.webp.length) return img;
  const srcset = m.webp.map((v) => `${v.url} ${v.w}w`).join(', ');
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="${sizes}">${img}</picture>`;
}

// ---------------------------------------------------------------- layout

export function layout(ctx, { pageKey, title, description, body, jsonLd, noindex = false }) {
  const { lang, site } = ctx;
  const ui = UI[lang];
  const routes = ROUTES[lang];
  const s = ctx.settings;
  const path = pageKey ? routes[pageKey] : null;
  const canonical = path ? site.url + path : null;

  const alternates = pageKey
    ? LANGS.map((l) => `<link rel="alternate" hreflang="${LOCALE[l]}" href="${site.url}${ROUTES[l][pageKey]}">`).join('\n  ') +
      `\n  <link rel="alternate" hreflang="x-default" href="${site.url}${ROUTES.nl[pageKey]}">`
    : '';

  const langLinks = LANGS.map((l) => {
    const href = pageKey ? ROUTES[l][pageKey] : ROUTES[l].home;
    const current = l === lang ? ' aria-current="true"' : '';
    return `<a href="${href}" lang="${l}" hreflang="${l}" aria-label="${esc(UI[l].taalNaam)}"${current}>${l.toUpperCase()}</a>`;
  }).join('<span aria-hidden="true">/</span>');

  const home = routes.home;
  const navItems = ['werk', 'diensten', 'werkwijze', 'over']
    .map((k) => `<li><a href="${home}#${k}">${esc(ui.nav[k])}</a></li>`)
    .join('');

  const ld = jsonLd ? `\n  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : '';

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${noindex ? '<meta name="robots" content="noindex">' : ''}
  ${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
  ${alternates}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(s.bedrijfsnaam)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  ${canonical ? `<meta property="og:url" content="${canonical}">` : ''}
  <meta property="og:image" content="${site.url}/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="${OG_LOCALE[lang]}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#ffffff">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preload" href="/assets/fonts/inter-400.woff" as="font" type="font/woff" crossorigin>
  <link rel="preload" href="/assets/fonts/inter-display-500.woff" as="font" type="font/woff" crossorigin>
  <link rel="stylesheet" href="/assets/styles.css?v=${ctx.assetVersion}">
  <script src="/assets/flag.js?v=${ctx.assetVersion}"></script>
  <script src="/assets/main.js?v=${ctx.assetVersion}" defer></script>${ld}
</head>
<body>
<a class="skip-link" href="#inhoud">${esc(ui.naarInhoud)}</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${home}" aria-label="${esc(ui.naarBoven)}">${logoMark()}<span class="brand-name">${esc(s.bedrijfsnaam)}</span></a>
    <nav class="nav" id="hoofdmenu" aria-label="${esc(ui.hoofdmenu)}" data-nav>
      <ul class="nav-list">${navItems}</ul>
      <a class="btn btn-primary nav-cta" href="${home}#contact">${esc(ui.cta)}</a>
    </nav>
    <div class="header-actions">
      <nav class="lang-switch" aria-label="${esc(ui.taalKiezen)}">${langLinks}</nav>
      <a class="btn btn-primary btn-sm header-cta" href="${home}#contact">${esc(ui.cta)}</a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="hoofdmenu" data-menu-toggle data-label-open="${esc(ui.menu)}" data-label-close="${esc(ui.sluiten)}"><span data-menu-label>${esc(ui.menu)}</span>${menuIcon}</button>
    </div>
  </div>
</header>
<main id="inhoud">
${body}
</main>
${footer(ctx)}
</body>
</html>
`;
}

function footer(ctx) {
  const { lang } = ctx;
  const ui = UI[lang];
  const s = ctx.settings;
  const r = ROUTES[lang];
  return `<footer class="site-footer">
  <div class="wrap footer-inner">
    <div class="footer-id">
      <a class="brand brand-inverse" href="${r.home}" aria-label="${esc(ui.naarBoven)}">${logoMark()}<span class="brand-name">${esc(s.bedrijfsnaam)}</span></a>
      <p>${esc(s.bedrijfsnaam)} — ${esc(s.zaakvoerder)} · ${esc(s.straat)}, ${esc(s.postcode)} ${esc(s.gemeente)}</p>
      <p class="mono">${esc(ui.footer.ondernemingsnr)} ${esc(s.ondernemingsnummer)} · ${esc(ui.footer.btw)} ${esc(s.btwNummer)}</p>
    </div>
    <nav class="footer-nav" aria-label="${esc(ui.footer.juridisch)}">
      <a href="${r.privacy}">${esc(ui.privacy)}</a>
      <a href="${r.voorwaarden}">${esc(ui.voorwaarden)}</a>
      <span>© ${ctx.year} ${esc(s.bedrijfsnaam)}</span>
    </nav>
  </div>
</footer>`;
}

// ---------------------------------------------------------------- homepage

function sectionHead(lang, number, data, id) {
  return `<div class="section-head">
    <div class="section-head-main">
      <p class="eyebrow"><span class="accent">${pad(number)}</span> — ${esc(t(data.label, lang))}</p>
      <h2 id="${id}-titel">${esc(t(data.titel, lang))}</h2>
    </div>
    ${t(data.intro, lang) ? `<p class="section-intro">${esc(t(data.intro, lang))}</p>` : ''}
  </div>`;
}

function heroFigure(lang) {
  const f = UI[lang].figuur;
  // Punten langs de lus (viewBox 600 x 290), in volgorde van het traject.
  const pts = [
    [80, 150, 62, 154.5, 'end'],
    [171.25, 213.75, 171.25, 246, 'middle'],
    [428.75, 86.25, 428.75, 62, 'middle'],
    [520, 150, 538, 154.5, 'start'],
    [428.75, 213.75, 428.75, 246, 'middle'],
    [171.25, 86.25, 171.25, 62, 'middle'],
  ];
  const dots = pts
    .map(([cx, cy], i) => `<circle cx="${cx}" cy="${cy}" r="${i === 0 ? 6 : 5}" class="${i === 0 ? 'fig-dot fig-dot-start' : 'fig-dot'}"/>`)
    .join('');
  const labels = pts
    .map(([, , x, y, anchor], i) => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="fig-label"><tspan class="fig-num">${pad(i + 1)}</tspan> ${esc(f.stappen[i].toUpperCase())}</text>`)
    .join('');
  const loop =
    'M300 150 C 250 70, 80 60, 80 150 C 80 240, 250 230, 300 150 C 350 70, 520 60, 520 150 C 520 240, 350 230, 300 150';
  const left = 'M300 150 C 250 70, 80 60, 80 150 C 80 240, 250 230, 300 150';
  const right = 'M300 150 C 350 70, 520 60, 520 150 C 520 240, 350 230, 300 150';
  return `<figure class="hero-figure">
      <svg class="hero-svg" viewBox="0 0 600 290" role="img" aria-label="${esc(f.aria)}" data-hero-svg>
        <path d="${left}" class="fig-band"/>
        <path d="${left}" class="fig-line"/>
        <path d="${right}" class="fig-gap"/>
        <path d="${right}" class="fig-band"/>
        <path d="${right}" class="fig-line"/>
        <path id="fig-loop" d="${loop}" fill="none" stroke="none"/>
        ${dots}
        <circle r="4" class="fig-runner"><animateMotion dur="14s" repeatCount="indefinite" rotate="auto"><mpath href="#fig-loop"/></animateMotion></circle>
        ${labels}
      </svg>
      <ol class="fig-legend" aria-hidden="true">${f.stappen.map((s, i) => `<li><span class="accent">${pad(i + 1)}</span> ${esc(s)}</li>`).join('')}</ol>
      <figcaption>${esc(f.onderschrift)}</figcaption>
    </figure>`;
}

function caseArticle(ctx, c, index) {
  const { lang } = ctx;
  const ui = UI[lang];
  const facts = [];
  if (t(c.statusTekst, lang)) {
    facts.push(`<div><dt>${esc(ui.status)}</dt><dd><span class="status-dot status-${c.status === 'live' ? 'live' : 'busy'}" aria-hidden="true"></span>${esc(t(c.statusTekst, lang))}</dd></div>`);
  }
  if (t(c.resultaat, lang)) facts.push(`<div><dt>${esc(ui.resultaat)}</dt><dd>${esc(t(c.resultaat, lang))}</dd></div>`);
  if (t(c.geleverd, lang)) facts.push(`<div><dt>${esc(ui.geleverd)}</dt><dd>${esc(t(c.geleverd, lang))}</dd></div>`);

  const schermen = (c.schermen || []).filter((s) => s && s.afbeelding);
  let media = '';
  if (schermen.length && c.weergave === 'browser') {
    const s0 = schermen[0];
    media = `<div class="case-media case-media-browser">
        <div class="browser"><div class="browser-bar" aria-hidden="true"><span></span><span></span><span></span></div>
        ${picture(ctx, s0.afbeelding, t(s0.alt, lang), { sizes: '(min-width: 1100px) 640px, 100vw' })}</div>
      </div>`;
  } else if (schermen.length) {
    const items = schermen
      .map((s, i) => {
        const cap = t(s.bijschrift, lang);
        return `<li><figure class="screen-card"><div class="screen">${picture(ctx, s.afbeelding, t(s.alt, lang), { sizes: '(min-width: 1100px) 210px, (min-width: 700px) 30vw, 70vw' })}</div>${cap ? `<figcaption><span class="accent">${pad(i + 1)}</span> ${esc(cap)}</figcaption>` : ''}</figure></li>`;
      })
      .join('');
    media = `<div class="case-media case-media-screens"><ul class="screens" aria-label="${esc(ui.schermen)}">${items}</ul></div>`;
  }

  return `<article class="case${media ? '' : ' case-no-media'}">
    <div class="case-text">
      <p class="eyebrow">${esc(ui.caseLabel)} ${pad(index + 1)} · ${esc(t(c.categorie, lang))}</p>
      <div class="case-head">
        <h3>${esc(t(c.titel, lang))}</h3>
        ${t(c.klant, lang) ? `<p class="case-client">${esc(t(c.klant, lang))}</p>` : ''}
      </div>
      ${t(c.beschrijving, lang) ? `<p class="case-desc">${esc(t(c.beschrijving, lang))}</p>` : ''}
      ${(c.punten || []).length ? `<ul class="checklist">${c.punten.map((p) => `<li>${check}<span>${esc(t(p, lang))}</span></li>`).join('')}</ul>` : ''}
      ${facts.length ? `<dl class="facts">${facts.join('')}</dl>` : ''}
    </div>
    ${media}
  </article>`;
}

export function homePage(ctx) {
  const { lang, c } = ctx;
  const ui = UI[lang];
  const s = ctx.settings;
  const r = ROUTES[lang];
  const hero = c.hero;
  const werk = c.werk;
  const cases = (werk.cases || []).filter((x) => x && x.zichtbaar !== false);
  const telHref = 'tel:' + s.telefoon.replace(/[^+\d]/g, '');

  const body = `
<section class="hero wrap" aria-labelledby="hero-titel">
  <div class="hero-text">
    <p class="eyebrow">${esc(t(hero.label, lang))}</p>
    <h1 id="hero-titel">${esc(t(hero.titel, lang))}</h1>
    <p class="lead">${esc(t(hero.intro, lang))}</p>
    <div class="button-row">
      <a class="btn btn-primary btn-lg" href="#contact">${esc(t(hero.knopPrimair, lang))}${arrow}</a>
      <a class="btn btn-secondary btn-lg" href="#werk">${esc(t(hero.knopSecundair, lang))}</a>
    </div>
  </div>
  ${heroFigure(lang)}
</section>

<section class="facts-strip" aria-label="${esc(ui.inHetKort)}">
  <div class="wrap facts-grid">
    ${(hero.kerngegevens || [])
      .map((k) => `<div class="fact"><p class="fact-title">${esc(t(k.titel, lang))}</p><p class="fact-text">${esc(t(k.tekst, lang))}</p></div>`)
      .join('')}
  </div>
</section>

<section class="section wrap" id="werk" aria-labelledby="werk-titel">
  ${sectionHead(lang, 1, werk, 'werk')}
  ${cases.map((cs, i) => caseArticle(ctx, cs, i)).join('\n')}
  ${
    werk.labo && (werk.labo.items || []).length
      ? `<div class="lab">
    <div class="lab-head">
      <h3>${esc(t(werk.labo.titel, lang))}</h3>
      <p>${esc(t(werk.labo.intro, lang))}</p>
    </div>
    <div class="lab-grid">
      ${werk.labo.items
        .map((it) => `<div class="lab-card"><p class="eyebrow">${esc(t(it.label, lang))}</p><h4>${esc(t(it.titel, lang))}</h4><p>${esc(t(it.tekst, lang))}</p></div>`)
        .join('')}
    </div>
  </div>`
      : ''
  }
</section>

<section class="section-tint" id="diensten" aria-labelledby="diensten-titel">
  <div class="section wrap">
    ${sectionHead(lang, 2, c.diensten, 'diensten')}
    <div class="services">
      ${(c.diensten.items || [])
        .map(
          (d) => `<div class="service">
        ${serviceIcon(d.icoon)}
        <div class="service-head">
          <h3>${esc(t(d.titel, lang))}</h3>
          <p>${esc(t(d.tekst, lang))}</p>
        </div>
        <ul class="service-list">${(d.punten || []).map((p) => `<li>${esc(t(p, lang))}</li>`).join('')}</ul>
        <p class="service-price">${esc(t(d.prijs, lang))}</p>
      </div>`
        )
        .join('')}
    </div>
  </div>
</section>

<section class="section wrap" id="werkwijze" aria-labelledby="werkwijze-titel">
  ${sectionHead(lang, 3, c.werkwijze, 'werkwijze')}
  <ol class="steps">
    ${(c.werkwijze.stappen || [])
      .map(
        (st, i) => `<li class="step${i === 0 ? ' step-first' : ''}">
      <span class="step-num">${pad(i + 1)}</span>
      <h3>${esc(t(st.titel, lang))}</h3>
      <p>${esc(t(st.tekst, lang))}</p>
    </li>`
      )
      .join('')}
  </ol>
</section>

<section class="about-wrap" id="over" aria-labelledby="over-titel">
  <div class="section wrap about">
    <div class="about-photo">${picture(ctx, c.over.foto, t(c.over.fotoAlt, lang), { sizes: '(min-width: 900px) 440px, 100vw' })}</div>
    <div class="about-text">
      <p class="eyebrow"><span class="accent">04</span> — ${esc(t(c.over.label, lang))}</p>
      <h2 id="over-titel">${esc(t(c.over.titel, lang))}</h2>
      <p class="about-p">${esc(t(c.over.tekst1, lang))}</p>
      <p class="about-p about-p-muted">${esc(t(c.over.tekst2, lang))}</p>
      <dl class="about-facts">
        <div><dt>${esc(ui.over.talen)}</dt><dd>${esc(t(c.over.talen, lang))}</dd></div>
        <div><dt>${esc(ui.over.regio)}</dt><dd>${esc(t(c.over.regio, lang))}</dd></div>
      </dl>
    </div>
  </div>
</section>

<section class="contact" id="contact" aria-labelledby="contact-titel">
  <div class="section wrap contact-inner">
    <div class="contact-text">
      <p class="eyebrow eyebrow-inverse">${esc(t(c.contact.label, lang))}</p>
      <h2 id="contact-titel">${esc(t(c.contact.titel, lang))}</h2>
      <p class="contact-intro">${esc(t(c.contact.intro, lang))}</p>
      <dl class="contact-list">
        <div><dt>${esc(ui.contact.email)}</dt><dd><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></dd></div>
        <div><dt>${esc(ui.contact.telefoon)}</dt><dd><a href="${telHref}">${esc(s.telefoon)}</a></dd></div>
        <div><dt>${esc(ui.contact.adres)}</dt><dd>${esc(s.straat)}, ${esc(s.postcode)} ${esc(s.gemeente)}</dd></div>
      </dl>
    </div>
    ${contactForm(ctx)}
  </div>
</section>`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: s.bedrijfsnaam,
    url: ctx.site.url + r.home,
    description: t(s.seo.beschrijving, lang),
    email: s.email,
    telephone: s.telefoon.replace(/\s/g, ''),
    image: ctx.site.url + '/og.png',
    logo: ctx.site.url + '/logo-720.png',
    vatID: (s.btwNummer || '').replace(/[\s.]/g, ''),
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.straat,
      postalCode: s.postcode,
      addressLocality: s.gemeente,
      addressCountry: 'BE',
    },
    founder: { '@type': 'Person', name: s.zaakvoerder },
    areaServed: 'BE',
    knowsLanguage: ['nl', 'fr', 'en'],
  };

  return layout(ctx, {
    pageKey: 'home',
    title: t(s.seo.titel, lang),
    description: t(s.seo.beschrijving, lang),
    body,
    jsonLd,
  });
}

function contactForm(ctx) {
  const { lang } = ctx;
  const f = UI[lang].form;
  const s = ctx.settings;
  return `<form class="contact-form" action="/api/contact" method="post" aria-label="${esc(f.aria)}" data-contact-form data-msg-ok="${esc(f.gelukt)}" data-msg-fail="${esc(f.mislukt)}" data-msg-invalid="${esc(f.ongeldig)}" data-msg-sending="${esc(f.bezig)}" data-email="${esc(s.email)}">
      <input type="hidden" name="taal" value="${lang}">
      <input type="hidden" name="t" value="" data-form-time>
      <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="field-row">
        <div class="field">
          <label for="c-naam">${esc(f.naam)}</label>
          <input id="c-naam" name="naam" type="text" autocomplete="name" required maxlength="100">
        </div>
        <div class="field">
          <label for="c-email">${esc(f.email)}</label>
          <input id="c-email" name="email" type="email" autocomplete="email" required maxlength="200">
        </div>
      </div>
      <div class="field">
        <label for="c-bedrijf">${esc(f.bedrijf)} <span class="label-hint">${esc(f.optioneel)}</span></label>
        <input id="c-bedrijf" name="bedrijf" type="text" autocomplete="organization" maxlength="150">
      </div>
      <div class="field">
        <label for="c-bericht">${esc(f.bericht)}</label>
        <textarea id="c-bericht" name="bericht" rows="6" required minlength="10" maxlength="5000"></textarea>
      </div>
      <div class="form-foot">
        <button class="btn btn-light btn-lg" type="submit" data-submit>${esc(f.versturen)}${arrow}</button>
        <p class="form-note">${esc(f.privacy)} <a href="${ROUTES[lang].privacy}">${esc(UI[lang].privacy)}</a></p>
      </div>
      <p class="form-status" role="status" aria-live="polite" data-form-status></p>
    </form>`;
}

// ---------------------------------------------------------------- overige pagina's

export function legalPage(ctx, pageKey, doc) {
  const { lang } = ctx;
  const ui = UI[lang];
  let updated = '';
  if (doc.data.bijgewerkt) {
    const d = new Date(doc.data.bijgewerkt + 'T12:00:00Z');
    if (!isNaN(d)) updated = new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: 'long' }).format(d);
  }
  const title = doc.data.titel || ui[pageKey];
  const body = `<div class="wrap page">
  <article class="prose">
    <p class="eyebrow"><a href="${ROUTES[lang].home}">${esc(ctx.settings.bedrijfsnaam)}</a></p>
    <h1>${esc(title)}</h1>
    ${updated ? `<p class="prose-meta">${esc(ui.bijgewerkt)} ${esc(updated)}</p>` : ''}
    ${doc.html}
  </article>
</div>`;
  return layout(ctx, { pageKey, title: `${title} — ${ctx.settings.bedrijfsnaam}`, description: title, body });
}

export function messagePage(ctx, pageKey, { titel, tekst, mail = false, noindex = true }) {
  const { lang } = ctx;
  const ui = UI[lang];
  const s = ctx.settings;
  const body = `<div class="wrap page page-message">
  <div class="message">
    ${logoMark('logo-mark logo-mark-lg')}
    <h1>${esc(titel)}</h1>
    <p>${esc(tekst)}${mail ? ` <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>.` : ''}</p>
    <a class="btn btn-secondary" href="${ROUTES[lang].home}">${esc(ui.terug)}</a>
  </div>
</div>`;
  return layout(ctx, { pageKey, title: `${titel} — ${s.bedrijfsnaam}`, description: titel, body, noindex });
}
