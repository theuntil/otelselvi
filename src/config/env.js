'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function str(name, fallback = '') {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : String(v).trim();
}
function int(name, fallback) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) ? n : fallback;
}
function bool(name, fallback) {
  const v = (process.env[name] || '').toLowerCase().trim();
  if (['1', 'true', 'yes', 'evet', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'hayir', 'hayır', 'off'].includes(v)) return false;
  return fallback;
}

const isProd = str('NODE_ENV', 'development') === 'production';
const dataDir = path.resolve(str('DATA_DIR', path.join(__dirname, '..', '..', 'data')));
fs.mkdirSync(dataDir, { recursive: true });

// Form imzalama anahtarı: .env'de yoksa ilk açılışta üretilip data klasörüne kaydedilir
function resolveSecret() {
  const fromEnv = str('FORM_SECRET');
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (fromEnv) console.warn('[env] FORM_SECRET 32 karakterden kısa; otomatik üretilen anahtar kullanılacak.');
  const file = path.join(dataDir, '.form-secret');
  try {
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved.length >= 32) return saved;
  } catch (_) { /* ilk açılış */ }
  const generated = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(file, generated, { mode: 0o600 });
  } catch (err) {
    console.warn('[env] Form anahtarı diske yazılamadı, yalnızca bellekte tutulacak:', err.message);
  }
  return generated;
}

let siteUrl = str('SITE_URL', 'https://otelselvi.com').replace(/\/+$/, '');
if (!/^https?:\/\//.test(siteUrl)) siteUrl = 'https://' + siteUrl;

const trustProxyRaw = str('TRUST_PROXY', '1');
const trustProxy = /^\d+$/.test(trustProxyRaw) ? parseInt(trustProxyRaw, 10) : trustProxyRaw === 'true' ? true : trustProxyRaw;

const env = {
  isProd,
  port: int('PORT', 3000),
  siteUrl,
  siteHost: new URL(siteUrl).host,
  canonicalRedirect: bool('CANONICAL_REDIRECT', false),
  trustProxy,
  dataDir,
  formSecret: resolveSecret(),

  smtp: {
    host: str('SMTP_HOST'),
    port: int('SMTP_PORT', 587),
    // 465 için true, 587/25 için false (STARTTLS otomatik kullanılır)
    secure: bool('SMTP_SECURE', int('SMTP_PORT', 587) === 465),
    user: str('SMTP_USER'),
    pass: str('SMTP_PASS'),
    rejectUnauthorized: bool('SMTP_TLS_REJECT_UNAUTHORIZED', true),
  },
  mail: {
    from: str('MAIL_FROM', str('SMTP_USER')),
    fromName: str('MAIL_FROM_NAME', 'Otel Selvi Web Sitesi'),
    to: str('MAIL_TO'),
    toCorporate: str('MAIL_TO_CORPORATE', str('MAIL_TO')),
    dryRun: bool('MAIL_DRY_RUN', false),
  },
  limits: {
    perIpDaily: int('FORM_DAILY_LIMIT_PER_IP', 4),
    globalDaily: int('FORM_DAILY_LIMIT_GLOBAL', 200),
    burstPerIp: int('FORM_BURST_LIMIT', 10),
    burstWindowMs: int('FORM_BURST_WINDOW_MINUTES', 15) * 60 * 1000,
    minFillMs: int('FORM_MIN_FILL_SECONDS', 3) * 1000,
    maxTokenAgeMs: int('FORM_MAX_AGE_HOURS', 6) * 60 * 60 * 1000,
  },
  maps: {
    // Boşsa ücretsiz Google Haritalar gömmesi kullanılır; doluysa etkileşimli harita ve süre hesabı açılır
    apiKey: str('GOOGLE_MAPS_API_KEY'),
    mapId: str('GOOGLE_MAPS_MAP_ID', 'DEMO_MAP_ID'),
  },
  verification: {
    google: str('GOOGLE_SITE_VERIFICATION'),
    bing: str('BING_SITE_VERIFICATION'),
    yandex: str('YANDEX_VERIFICATION'),
  },
};

if (isProd) {
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_TO'].filter((k) => !str(k));
  if (missing.length && !env.mail.dryRun) {
    console.warn(`[env] Eksik e-posta ayarları: ${missing.join(', ')} — formlar e-posta gönderemez.`);
  }
}

module.exports = env;
