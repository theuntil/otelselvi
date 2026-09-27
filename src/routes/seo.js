'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const env = require('../config/env');
const site = require('../config/site');
const { LOCALES, ORDER, PAGE_KEYS, DEFAULT_LANG } = require('../i18n');
const { hotelDescription, pageUrl } = require('../lib/seo');

const VIEWS = path.join(__dirname, '..', '..', 'views', 'pages');
const I18N = path.join(__dirname, '..', 'i18n');
const CONFIG_FILE = path.join(__dirname, '..', 'config', 'site.js');

const SITEMAP_META = {
  home: ['weekly', '1.0'],
  rooms: ['weekly', '0.9'],
  corporate: ['monthly', '0.9'],
  contact: ['monthly', '0.8'],
  about: ['monthly', '0.7'],
  guide: ['monthly', '0.6'],
  faq: ['monthly', '0.6'],
  privacy: ['yearly', '0.2'],
};

function lastModified(lang, key) {
  const files = [path.join(VIEWS, `${key}.ejs`), path.join(I18N, `${lang}.js`), CONFIG_FILE];
  const times = files.map((f) => {
    try {
      return fs.statSync(f).mtime.getTime();
    } catch (_) {
      return 0;
    }
  });
  return new Date(Math.max(...times) || Date.now()).toISOString().slice(0, 10);
}

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Her URL, diğer dillerdeki karşılıklarını hreflang ile bildirir
function buildSitemap() {
  const urls = [];
  for (const lang of ORDER) {
    for (const key of PAGE_KEYS) {
      const alts = ORDER.map((l) => `    <xhtml:link rel="alternate" hreflang="${LOCALES[l].htmlLang}" href="${xmlEsc(pageUrl(l, key))}"/>`);
      alts.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEsc(pageUrl(DEFAULT_LANG, key))}"/>`);
      const [freq, prio] = SITEMAP_META[key];
      urls.push(`  <url>
    <loc>${xmlEsc(pageUrl(lang, key))}</loc>
${alts.join('\n')}
    <lastmod>${lastModified(lang, key)}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${prio}</priority>
  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

function buildRobots() {
  const agents = ['*', 'Googlebot', 'Bingbot', 'YandexBot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'CCBot'];
  return `${agents.map((a) => `User-agent: ${a}`).join('\n')}
Allow: /
Disallow: /form/

Sitemap: ${env.siteUrl}/sitemap.xml
`;
}

// llms.txt: yapay zekâ arama motorları için özet (Türkçe + İngilizce, diğer dillere bağlantı)
function langBlock(lang) {
  const t = LOCALES[lang];
  const phones = site.phones.map((p) => `${t.phoneStyle === 'intl' ? p.intl : p.display} (${t.ui.phoneLabels[p.key]})`).join(', ');
  const rooms = site.rooms
    .map((r) => {
      const rt = t.roomTypes[r.key];
      const price = Number.isFinite(r.priceFrom) && r.priceFrom > 0 ? ` ${t.rooms.priceFrom} ${r.priceFrom} TRY.` : '';
      return `- ${rt.name} (${t.rooms.capacity(r.capacity)}; ${rt.bed}): ${rt.summary}${price}`;
    })
    .join('\n');
  const faq = [...t.faq.items, ...t.corporate.faq].map((f) => `### ${f.q}\n${f.a}`).join('\n\n');
  const links = PAGE_KEYS.filter((k) => k !== 'privacy')
    .map((k) => `- [${t.pages[k].name}](${pageUrl(lang, k)}): ${t.pages[k].description}`)
    .join('\n');
  return `> ${hotelDescription(lang)}

- ${t.ui.address}: ${site.address.full}
- ${t.ui.phoneLabels.reception}: ${phones}
- ${t.ui.email}: ${site.email}
- Instagram: ${site.social.instagram ? site.social.instagram.url : '-'}
- Google Maps: ${site.maps.placeUrl}
- ${t.rooms.terms.checkin.label}: ${site.checkin} / ${t.rooms.terms.checkout.label}: ${site.checkout}
- ${t.rooms.amenitiesTitle}: ${site.amenities.map((k) => t.amenities[k]).join(', ')}
- ${t.location.nearbyTitle}: ${t.nearby.map((n) => `${n.name} (${n.detail})`).join('; ')}

#### ${t.home.roomsTitle}

${rooms}

#### ${t.corporate.h1}

${t.corporate.lead} ${pageUrl(lang, 'corporate')}

#### ${t.pages.home.name}

${links}

#### ${t.faq.h1}

${faq}`;
}

function buildLlms() {
  const others = ORDER.filter((l) => l !== 'tr' && l !== 'en')
    .map((l) => `- ${LOCALES[l].label}: ${pageUrl(l, 'home')}`)
    .join('\n');
  return `# Otel Selvi — Karabük, Türkiye

## Türkçe

${langBlock('tr')}

## English

${langBlock('en')}

## Other languages

${others}
`;
}

function createSeoRouter() {
  const router = express.Router();
  const robots = buildRobots();
  const sitemap = buildSitemap();
  const llms = buildLlms();
  const manifest = JSON.stringify({
    name: `${site.name} Karabük`,
    short_name: site.name,
    lang: 'tr',
    start_url: '/',
    display: 'browser',
    background_color: '#FFFFFF',
    theme_color: '#23473D',
    icons: [
      { src: '/img/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/img/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
  const text = (type, body) => (req, res) => res.type(type).set('Cache-Control', 'public, max-age=3600').send(body);

  router.get('/robots.txt', text('text/plain; charset=utf-8', robots));
  router.get('/sitemap.xml', text('application/xml; charset=utf-8', sitemap));
  router.get('/llms.txt', text('text/plain; charset=utf-8', llms));
  router.get('/site.webmanifest', text('application/manifest+json; charset=utf-8', manifest));
  return router;
}

module.exports = { createSeoRouter };
