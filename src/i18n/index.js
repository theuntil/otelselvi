'use strict';

const site = require('../config/site');

const LOCALES = {
  tr: require('./tr'),
  en: require('./en'),
  ru: require('./ru'),
  ja: require('./ja'),
};
// Dil sırası (dil seçicide ve sitemap'te bu sırayla görünür)
const ORDER = ['tr', 'en', 'ru', 'ja'];
const DEFAULT_LANG = 'tr'; // Türkçe kök adreste (/), diğerleri /en, /ru, /ja altında
const PAGE_KEYS = ['home', 'rooms', 'corporate', 'about', 'contact', 'guide', 'faq', 'privacy'];

function prefix(lang) {
  return lang === DEFAULT_LANG ? '' : `/${lang}`;
}

function pathFor(lang, key) {
  const slug = LOCALES[lang].routes[key];
  return prefix(lang) + (slug ? `/${slug}` : '') || '/';
}

/** Tüm dil × sayfa kombinasyonları */
function allRoutes() {
  const list = [];
  for (const lang of ORDER) for (const key of PAGE_KEYS) list.push({ lang, key, path: pathFor(lang, key) });
  return list;
}

function langFromPath(p) {
  const seg = String(p || '').split('/')[1];
  return ORDER.includes(seg) && seg !== DEFAULT_LANG ? seg : DEFAULT_LANG;
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Metni kaçışlar, {anahtar} yerlerine verilen HTML'i koyar. */
function rich(str, map = {}) {
  return esc(str).replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}

/** Metindeki {anahtar} yerlerini düz metinle doldurur. */
function fill(str, map = {}) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}

function mapsUrls(lang) {
  const q = encodeURIComponent(site.maps.query);
  const hl = LOCALES[lang].mapsHl;
  return {
    embed: `https://www.google.com/maps?q=${q}&hl=${hl}&z=16&output=embed`,
    // Başlangıç verilmezse Google Haritalar ziyaretçinin konumunu kullanır
    directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    place: site.maps.placeUrl,
    // Otelden bir yere rota (rota planlayıcı için)
    fromHotel: (dest, mode = 'driving') =>
      `https://www.google.com/maps/dir/?api=1&origin=${q}&destination=${encodeURIComponent(dest)}&travelmode=${mode}`,
  };
}

/** Şablonlarda kullanılan dile özel yardımcılar */
function helpers(lang, siteUrl) {
  const t = LOCALES[lang];
  const price = new Intl.NumberFormat(t.intl, { style: 'currency', currency: site.currency, maximumFractionDigits: 0 });
  const maps = mapsUrls(lang);
  const wa = site.phones.find((p) => p.whatsapp);
  return {
    href: (key) => pathFor(lang, key),
    alternates: (key) =>
      ORDER.map((l) => ({
        lang: l,
        label: LOCALES[l].label,
        short: LOCALES[l].short,
        htmlLang: LOCALES[l].htmlLang,
        path: pathFor(l, key),
        url: siteUrl + (pathFor(l, key) === '/' ? '/' : pathFor(l, key)),
        current: l === lang,
      })),
    rich,
    fill,
    phoneText: (p) => (t.phoneStyle === 'intl' ? p.intl : p.display),
    phoneLabel: (p) => t.ui.phoneLabels[p.key] || '',
    price: (n) => price.format(n),
    maps,
    whatsappHref: wa ? `https://wa.me/${wa.e164.replace(/\D/g, '')}?text=${encodeURIComponent(t.ui.whatsappText)}` : null,
    since: t.home.since(site.foundedYear),
  };
}

module.exports = { LOCALES, ORDER, DEFAULT_LANG, PAGE_KEYS, pathFor, allRoutes, langFromPath, helpers, rich, fill, esc, mapsUrls };
