'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * IPv4 adresini olduğu gibi, IPv6 adresini /64 önekine indirerek anahtar üretir.
 * (IPv6'da tek bir kullanıcı bir /64 bloğundaki binlerce adresi kullanabilir.)
 */
function normalizeIp(ip) {
  if (!ip) return 'unknown';
  let v = String(ip).trim().split('%')[0];
  if (v.startsWith('::ffff:') && v.includes('.')) return v.slice(7);
  if (!v.includes(':')) return v;
  const [head, tail] = v.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const fill = v.includes('::') ? new Array(Math.max(0, 8 - h.length - t.length)).fill('0') : [];
  const full = [...h, ...fill, ...t];
  return full.slice(0, 4).map((x) => parseInt(x || '0', 16).toString(16)).join(':') + '::/64';
}

/**
 * Kayan pencereli sayaç. Anahtarlar (IP) diske ham hâliyle değil,
 * gizli anahtarla özetlenmiş (HMAC) biçimde yazılır — KVKK dostu.
 */
class SlidingWindowLimiter {
  constructor({ limit, windowMs, secret, file = null }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.secret = secret;
    this.file = file;
    this.hits = new Map();
    this.global = [];
    this._saveTimer = null;
    if (file) this._load();
    this._pruneTimer = setInterval(() => this.prune(), 10 * 60 * 1000);
    this._pruneTimer.unref();
  }

  key(ip) {
    return crypto.createHmac('sha256', this.secret).update(normalizeIp(ip)).digest('base64url').slice(0, 22);
  }

  _recent(list, now) {
    return list.filter((t) => now - t < this.windowMs);
  }

  /** Sınırı aşmadan kaç hak kaldığını söyler; sayaç artırmaz. */
  peek(ip, now = Date.now()) {
    const k = this.key(ip);
    const recent = this._recent(this.hits.get(k) || [], now);
    const remaining = Math.max(0, this.limit - recent.length);
    const retryAfterMs = remaining > 0 ? 0 : this.windowMs - (now - recent[0]);
    return { allowed: remaining > 0, remaining, retryAfterMs };
  }

  consume(ip, now = Date.now()) {
    const k = this.key(ip);
    const recent = this._recent(this.hits.get(k) || [], now);
    recent.push(now);
    this.hits.set(k, recent);
    this.global = this._recent(this.global, now);
    this.global.push(now);
    this._scheduleSave();
    return Math.max(0, this.limit - recent.length);
  }

  globalCount(now = Date.now()) {
    this.global = this._recent(this.global, now);
    return this.global.length;
  }

  prune(now = Date.now()) {
    for (const [k, list] of this.hits) {
      const recent = this._recent(list, now);
      if (recent.length) this.hits.set(k, recent);
      else this.hits.delete(k);
    }
    this.global = this._recent(this.global, now);
    this._scheduleSave();
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const now = Date.now();
      for (const [k, list] of Object.entries(raw.hits || {})) {
        if (Array.isArray(list)) {
          const recent = this._recent(list.filter(Number.isFinite), now);
          if (recent.length) this.hits.set(k, recent);
        }
      }
      if (Array.isArray(raw.global)) this.global = this._recent(raw.global.filter(Number.isFinite), now);
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn('[rate-limit] Kayıt dosyası okunamadı, sıfırdan başlanıyor:', err.message);
    }
  }

  _scheduleSave() {
    if (!this.file || this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.saveNow();
    }, 1000);
    this._saveTimer.unref();
  }

  saveNow() {
    if (!this.file) return;
    const data = JSON.stringify({ v: 1, hits: Object.fromEntries(this.hits), global: this.global });
    const tmp = `${this.file}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmp, data, { mode: 0o600 });
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.warn('[rate-limit] Kayıt dosyası yazılamadı:', err.message);
    }
  }
}

/** Kısa süreli ani istek koruması (yalnızca bellekte). */
class BurstLimiter {
  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
    const t = setInterval(() => {
      const now = Date.now();
      for (const [k, list] of this.hits) {
        const recent = list.filter((x) => now - x < this.windowMs);
        if (recent.length) this.hits.set(k, recent);
        else this.hits.delete(k);
      }
    }, 60 * 1000);
    t.unref();
  }

  hit(ip, now = Date.now()) {
    const k = normalizeIp(ip);
    const recent = (this.hits.get(k) || []).filter((x) => now - x < this.windowMs);
    recent.push(now);
    this.hits.set(k, recent);
    return recent.length <= this.limit;
  }
}

module.exports = { SlidingWindowLimiter, BurstLimiter, normalizeIp, DAY_MS };
