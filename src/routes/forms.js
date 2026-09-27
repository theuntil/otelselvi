'use strict';

const path = require('path');
const express = require('express');
const env = require('../config/env');
const site = require('../config/site');
const { LOCALES, ORDER, DEFAULT_LANG, pathFor } = require('../i18n');
const { SlidingWindowLimiter, BurstLimiter, DAY_MS } = require('../lib/rateLimiter');
const { validateContact, validateQuote } = require('../lib/validate');
const { sendContactMail, sendQuoteMail } = require('../lib/mailer');

function createFormsRouter({ tokens }) {
  const router = express.Router();

  // İki form ortak kotayı kullanır: aynı IP 24 saatte en fazla N başarılı gönderim
  const daily = new SlidingWindowLimiter({
    limit: env.limits.perIpDaily,
    windowMs: DAY_MS,
    secret: env.formSecret,
    file: path.join(env.dataDir, 'rate-limit.json'),
  });
  // Deneme yanılma / bot trafiği için kısa pencere (başarılı-başarısız tüm istekler)
  const burst = new BurstLimiter({ limit: env.limits.burstPerIp, windowMs: env.limits.burstWindowMs });

  router.flush = () => daily.saveNow();

  function sameOrigin(req) {
    const allowed = new Set([env.siteHost, req.get('host')].filter(Boolean));
    const check = (u) => {
      try {
        return allowed.has(new URL(u).host);
      } catch (_) {
        return false;
      }
    };
    const origin = req.get('origin');
    if (origin && origin !== 'null') return check(origin);
    const referer = req.get('referer');
    if (referer) return check(referer);
    return true; // Başlık yoksa imzalı form anahtarı yine de zorunlu
  }

  function handler({ form, validate, send, pageKey, okKey }) {
    return async (req, res) => {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const lang = ORDER.includes(body.lang) ? body.lang : DEFAULT_LANG;
      const t = LOCALES[lang];
      const phone = t.phoneStyle === 'intl' ? site.phones[0].intl : site.phones[0].display;
      const s = t.server;

      const wantsJson = (req.get('accept') || '').includes('application/json');
      const reply = (status, payload, reason) => {
        if (wantsJson) return res.status(status).json(payload);
        const q = payload.ok ? 'form=ok' : `form=error&reason=${encodeURIComponent(reason || 'invalid')}`;
        return res.redirect(303, `${pathFor(lang, pageKey)}?${q}#form`);
      };
      const ip = req.ip;
      res.set('Cache-Control', 'no-store');

      if (!burst.hit(ip)) return reply(429, { ok: false, message: s.burst(phone) }, 'burst');
      if (!sameOrigin(req)) return reply(403, { ok: false, message: s.invalid }, 'invalid');

      // Bal küpü alanı: insanlar görmez, botlar doldurur. Bota başarılı gibi görünür, e-posta gitmez.
      if (typeof body.website === 'string' && body.website.trim() !== '') {
        console.warn(`[form:${form}] bal küpü alanı dolu, gönderim yok sayıldı`);
        return reply(200, { ok: true, message: s[okKey] }, null);
      }

      const tk = tokens.verify(form, body._token);
      if (!tk.ok) {
        const map = { too_fast: 'tooFast', expired: 'expired', reused: 'reused', invalid: 'invalid' };
        return reply(tk.reason === 'too_fast' ? 429 : 400, { ok: false, message: s[map[tk.reason]] }, tk.reason === 'expired' ? 'expired' : 'invalid');
      }

      const quota = daily.peek(ip);
      if (!quota.allowed) {
        const hours = Math.max(1, Math.ceil(quota.retryAfterMs / 3_600_000));
        return reply(429, { ok: false, message: s.limit(env.limits.perIpDaily, hours, phone) }, 'limit');
      }
      if (daily.globalCount() >= env.limits.globalDaily) {
        return reply(429, { ok: false, message: s.busy(phone) }, 'busy');
      }

      const v = validate(body, t.validation);
      if (!v.ok) return reply(422, { ok: false, message: t.form.summary, errors: v.errors }, 'validation');

      tokens.markUsed(tk.nonce, tk.issued);
      try {
        await send(v.data, { ip, lang });
      } catch (err) {
        tokens.release(tk.nonce);
        console.error(`[form:${form}] e-posta gönderilemedi:`, err.message);
        return reply(502, { ok: false, message: s.failed(phone, site.email) }, 'failed');
      }

      const remaining = daily.consume(ip);
      console.log(`[form:${form}] gönderildi (dil: ${lang}, bu IP için kalan hak: ${remaining})`);
      return reply(200, { ok: true, message: s[okKey] }, null);
    };
  }

  router.post('/form/iletisim', handler({ form: 'contact', validate: validateContact, send: sendContactMail, pageKey: 'contact', okKey: 'contactOk' }));
  router.post('/form/kurumsal-teklif', handler({ form: 'quote', validate: validateQuote, send: sendQuoteMail, pageKey: 'corporate', okKey: 'quoteOk' }));

  router.get('/form/iletisim', (req, res) => res.redirect(301, pathFor(DEFAULT_LANG, 'contact')));
  router.get('/form/kurumsal-teklif', (req, res) => res.redirect(301, pathFor(DEFAULT_LANG, 'corporate')));

  return router;
}

module.exports = { createFormsRouter };
