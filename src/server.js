'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

const env = require('./config/env');
const site = require('./config/site');
const photos = require('./lib/photos');
const seo = require('./lib/seo');
const i18n = require('./i18n');
const { createFormTokens } = require('./lib/formToken');
const { TOPICS, DURATIONS, ROOM_PREFS, clientMessages, todayIstanbul } = require('./lib/validate');
const { verifyConnection } = require('./lib/mailer');
const { icon } = require('./lib/icons');
const { createFormsRouter } = require('./routes/forms');
const { createSeoRouter } = require('./routes/seo');

const { LOCALES, ORDER, DEFAULT_LANG, PAGE_KEYS } = i18n;
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.trustProxy);
app.set('view engine', 'ejs');
app.set('views', path.join(ROOT, 'views'));
if (env.isProd) app.set('view cache', true);

// ---------- Güvenlik başlıkları ----------
// Etkileşimli Google Haritası yalnızca harita içeren sayfalarda ve API anahtarı varsa yüklenir;
// CSP sadece o sayfalarda Google'ın istediği kaynaklara açılır.
const MAP_PATHS = new Set(i18n.allRoutes().filter((r) => r.key === 'home' || r.key === 'contact').map((r) => r.path));
app.use((req, res, next) => {
  res.locals.gmaps = Boolean(env.maps.apiKey) && MAP_PATHS.has(req.path);
  next();
});
const src = (base, mapsExtra) => [(req, res) => (res.locals.gmaps ? `${base} ${mapsExtra}` : base)];
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: src("'self'", "https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com 'unsafe-eval' blob:"),
        styleSrc: src("'self'", "'unsafe-inline' https://fonts.googleapis.com"),
        imgSrc: src("'self' data:", 'blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com'),
        fontSrc: src("'self'", 'https://fonts.gstatic.com'),
        connectSrc: src("'self'", 'https://*.googleapis.com https://*.google.com https://*.gstatic.com data: blob:'),
        workerSrc: src("'self'", 'blob:'),
        frameSrc: ['https://www.google.com', 'https://maps.google.com'],
        formAction: ["'self'", 'https://www.google.com'],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: env.isProd && env.siteUrl.startsWith('https') ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: env.isProd ? { maxAge: 31536000, includeSubDomains: false } : false,
  })
);
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});
app.use(compression());

app.get('/healthz', (req, res) => res.set('Cache-Control', 'no-store').json({ ok: true }));

// Alan adı yönlendirmesi (ör. www → www'suz). CANONICAL_REDIRECT=true ile açılır.
if (env.canonicalRedirect) {
  app.use((req, res, next) => {
    const host = req.get('host');
    if (host && host !== env.siteHost) return res.redirect(301, env.siteUrl + req.originalUrl);
    next();
  });
}

// Sondaki eğik çizgiyi kaldır: /odalar/ → /odalar, /en/ → /en
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.length > 1 && req.path.endsWith('/')) {
    const q = req.originalUrl.slice(req.path.length);
    return res.redirect(301, req.path.replace(/\/+$/, '') + q);
  }
  next();
});

// ---------- Statik dosyalar ----------
const assetVersions = {};
function asset(p) {
  if (!(p in assetVersions)) {
    try {
      assetVersions[p] = crypto.createHash('md5').update(fs.readFileSync(path.join(PUBLIC, p))).digest('hex').slice(0, 10);
    } catch (_) {
      assetVersions[p] = null;
    }
  }
  return assetVersions[p] ? `${p}?v=${assetVersions[p]}` : p;
}
app.use(
  express.static(PUBLIC, {
    index: false,
    maxAge: '7d',
    setHeaders(res, filePath) {
      const req = res.req;
      if (req && req.query && req.query.v) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else if (/\.(woff2|png|jpe?g|webp|avif|svg|ico)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=2592000');
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: '20kb', parameterLimit: 30 }));
app.use(express.json({ limit: '20kb' }));

// ---------- Görünüm değişkenleri ----------
const tokens = createFormTokens({ secret: env.formSecret, minFillMs: env.limits.minFillMs, maxAgeMs: env.limits.maxTokenAgeMs });

app.locals.site = site;
app.locals.env = { siteUrl: env.siteUrl, verification: env.verification, dailyLimit: env.limits.perIpDaily, mapsKey: env.maps.apiKey, mapsMapId: env.maps.mapId };
app.locals.asset = asset;
app.locals.icon = icon;
app.locals.photo = photos.photo;
app.locals.gallery = photos.gallery;
app.locals.year = new Date().getFullYear();
app.locals.options = { TOPICS, DURATIONS, ROOM_PREFS };
app.locals.PAGE_KEYS = PAGE_KEYS;
app.locals.LOCALE_OG = Object.fromEntries(ORDER.map((l) => [l, LOCALES[l].ogLocale]));

const helperCache = Object.fromEntries(ORDER.map((l) => [l, i18n.helpers(l, env.siteUrl)]));

function baseLocals(lang, key) {
  return { lang, t: LOCALES[lang], L: helperCache[lang], pageKey: key };
}

function formStatus(t, query) {
  if (query.form === 'ok') return { ok: true, message: t.server.sent };
  if (query.form !== 'error') return null;
  const phone = t.phoneStyle === 'intl' ? site.phones[0].intl : site.phones[0].display;
  const map = {
    expired: t.server.expired,
    invalid: t.server.invalid,
    limit: t.server.limit(env.limits.perIpDaily, 24, phone),
    burst: t.server.burst(phone),
    busy: t.server.busy(phone),
    validation: t.server.validation,
    failed: t.server.failed(phone, site.email),
  };
  return { ok: false, message: map[query.reason] || t.server.invalid };
}

// ---------- Sayfalar (her dil × her sayfa) ----------
const graphCache = new Map();
for (const { lang, key, path: routePath } of i18n.allRoutes()) {
  app.get(routePath, (req, res) => {
    const t = LOCALES[lang];
    const cacheKey = `${lang}:${key}`;
    if (!graphCache.has(cacheKey) || !env.isProd) graphCache.set(cacheKey, seo.buildGraph(lang, key));
    const locals = {
      ...baseLocals(lang, key),
      page: { key, ...t.pages[key] },
      canonical: seo.pageUrl(lang, key),
      jsonLd: graphCache.get(cacheKey),
      formStatus: formStatus(t, req.query),
      today: todayIstanbul(),
    };
    if (key === 'contact' || key === 'corporate') {
      locals.tokens = { contact: tokens.issue('contact'), quote: tokens.issue('quote') };
      locals.clientMessages = { contact: clientMessages('contact', t.validation), quote: clientMessages('quote', t.validation) };
      res.set('Cache-Control', 'no-store');
    } else {
      res.set('Cache-Control', 'public, max-age=300');
    }
    res.set('Content-Language', t.htmlLang);
    res.render(`pages/${key}`, locals);
  });
}

app.use(createSeoRouter());
const formsRouter = createFormsRouter({ tokens });
app.use(formsRouter);

// ---------- 404 ve hata ----------
app.use((req, res) => {
  const lang = i18n.langFromPath(req.path);
  const t = LOCALES[lang];
  res.status(404).render('pages/404', {
    ...baseLocals(lang, 'home'),
    page: { key: '404', name: t.notFound.h1, title: t.notFound.title, description: t.notFound.description, noindex: true },
    canonical: `${env.siteUrl}${req.path}`,
    jsonLd: null,
    formStatus: null,
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ ok: false, message: 'Payload too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, message: 'Bad request.' });
  console.error('[hata]', err);
  const t = LOCALES[i18n.langFromPath(req.path)];
  res.status(500).type('text/plain; charset=utf-8').send(t.server.error500(site.phones[0].intl));
});

// ---------- Başlat ----------
const server = app.listen(env.port, () => {
  console.log(`[otel-selvi] ${env.isProd ? 'production' : 'development'} — http://0.0.0.0:${env.port} — site: ${env.siteUrl} — diller: ${ORDER.join(', ')}`);
  verifyConnection();
});

function shutdown(signal) {
  console.log(`[otel-selvi] ${signal} alındı, kapatılıyor…`);
  if (typeof formsRouter.flush === 'function') formsRouter.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { DEFAULT_LANG };
