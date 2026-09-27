'use strict';

const crypto = require('crypto');

/**
 * Her form görüntülendiğinde sunucu imzalı bir anahtar üretir.
 * Gönderimde şunlar kontrol edilir:
 *  - imza doğru mu (form gerçekten bu siteden mi açıldı)
 *  - form çok hızlı mı dolduruldu (bot)
 *  - form çok mu eski
 *  - aynı anahtar daha önce kullanıldı mı (tekrar gönderim saldırısı)
 */
function createFormTokens({ secret, minFillMs, maxAgeMs }) {
  const used = new Map(); // nonce -> expiry

  const cleaner = setInterval(() => {
    const now = Date.now();
    for (const [nonce, exp] of used) if (exp < now) used.delete(nonce);
  }, 10 * 60 * 1000);
  cleaner.unref();

  function sign(form, ts, nonce) {
    return crypto.createHmac('sha256', secret).update(`${form}|${ts}|${nonce}`).digest('base64url');
  }

  function issue(form) {
    const ts = Date.now().toString(36);
    const nonce = crypto.randomBytes(12).toString('base64url');
    return `${ts}.${nonce}.${sign(form, ts, nonce)}`;
  }

  /** @returns {{ok:true, nonce:string} | {ok:false, reason:'invalid'|'too_fast'|'expired'|'reused'}} */
  function verify(form, token, now = Date.now()) {
    if (typeof token !== 'string' || token.length > 200) return { ok: false, reason: 'invalid' };
    const parts = token.split('.');
    if (parts.length !== 3) return { ok: false, reason: 'invalid' };
    const [ts, nonce, sig] = parts;
    const expected = sign(form, ts, nonce);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'invalid' };
    const issued = parseInt(ts, 36);
    if (!Number.isFinite(issued)) return { ok: false, reason: 'invalid' };
    const age = now - issued;
    if (age < minFillMs) return { ok: false, reason: 'too_fast' };
    if (age > maxAgeMs) return { ok: false, reason: 'expired' };
    if (used.has(nonce)) return { ok: false, reason: 'reused' };
    return { ok: true, nonce, issued };
  }

  function markUsed(nonce, issued) {
    used.set(nonce, issued + maxAgeMs + 60 * 1000);
  }

  function release(nonce) {
    used.delete(nonce);
  }

  return { issue, verify, markUsed, release };
}

module.exports = { createFormTokens };
