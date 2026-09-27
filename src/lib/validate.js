'use strict';

const { LOCALES } = require('../i18n');

// Seçenek değerleri dilden bağımsızdır; etiketler dil dosyalarındadır
const TOPICS = Object.keys(LOCALES.tr.form.topics);
const DURATIONS = Object.keys(LOCALES.tr.form.durations);
const ROOM_PREFS = Object.keys(LOCALES.tr.form.roomPrefs);

const LIMITS = { name: 80, company: 120, email: 254, phone: 25, message: 3000, notes: 2000 };
const GUESTS = { contact: [1, 50], quote: [1, 500] };

function cleanMultiline(v, max) {
  if (typeof v !== 'string') return '';
  return v
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, max + 1);
}

// Tek satırlık alan: tüm kontrol karakterleri silinir (e-posta başlık enjeksiyonuna karşı)
function cleanLine(v, max) {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max + 1);
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"']+@[^\s@<>()[\]\\,;:"']+\.[^\s@<>()[\]\\,;:"'.]{2,}$/i;
const isEmail = (v) => v.length <= LIMITS.email && EMAIL_RE.test(v);

function isPhone(v) {
  if (!/^[+\d\s().-]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

const countLinks = (text) => (text.match(/(https?:\/\/|www\.)/gi) || []).length;

function todayIstanbul() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}

function parseDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  return v;
}

function addYears(iso, years) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function checkDates(errors, m, giris, cikis, requireStart) {
  const today = todayIstanbul();
  const maxDate = addYears(today, 2);
  let start = null;
  if (giris) {
    start = parseDate(giris);
    if (!start) errors.giris = m.dateInvalid;
    else if (start < today) errors.giris = m.datePast;
    else if (start > maxDate) errors.giris = m.dateTooFar;
  } else if (requireStart) {
    errors.giris = m.startRequired;
  }
  if (cikis) {
    const end = parseDate(cikis);
    if (!end) errors.cikis = m.dateInvalid;
    else if (start && end <= start) errors.cikis = m.endBeforeStart;
    else if (end > maxDate) errors.cikis = m.dateTooFar;
  }
}

function checkGuests(errors, m, value, [min, max], required) {
  if (!value) {
    if (required) errors.kisi = m.guestsRequired;
    return;
  }
  const n = parseInt(value, 10);
  if (!/^\d+$/.test(value) || n < min || n > max) errors.kisi = m.guests(min, max);
}

const isChecked = (v) => v === 'on' || v === 'true' || v === '1' || v === true;

/** @param m dil dosyasındaki "validation" bölümü */
function validateContact(body = {}, m) {
  const errors = {};
  const data = {
    ad: cleanLine(body.ad, LIMITS.name),
    eposta: cleanLine(body.eposta, LIMITS.email).toLowerCase(),
    telefon: cleanLine(body.telefon, LIMITS.phone),
    konu: cleanLine(body.konu, 30),
    giris: cleanLine(body.giris, 10),
    cikis: cleanLine(body.cikis, 10),
    kisi: cleanLine(body.kisi, 3),
    mesaj: cleanMultiline(body.mesaj, LIMITS.message),
  };

  if (data.ad.length < 2) errors.ad = m.name;
  else if (data.ad.length > LIMITS.name) errors.ad = m.nameMax(LIMITS.name);

  if (!data.eposta) errors.eposta = m.emailRequired;
  else if (!isEmail(data.eposta)) errors.eposta = m.email;

  if (data.telefon && !isPhone(data.telefon)) errors.telefon = m.phone;

  if (!TOPICS.includes(data.konu)) errors.konu = m.topic;

  if (data.konu === 'rezervasyon') {
    checkDates(errors, m, data.giris, data.cikis, false);
    checkGuests(errors, m, data.kisi, GUESTS.contact, false);
  } else {
    data.giris = '';
    data.cikis = '';
    data.kisi = '';
  }

  if (data.mesaj.length < 5) errors.mesaj = m.message;
  else if (data.mesaj.length > LIMITS.message) errors.mesaj = m.messageMax(LIMITS.message);
  else if (countLinks(data.mesaj) > 2) errors.mesaj = m.links;

  if (!isChecked(body.kvkk)) errors.kvkk = m.consent;

  return { ok: Object.keys(errors).length === 0, data, errors };
}

function validateQuote(body = {}, m) {
  const errors = {};
  const data = {
    firma: cleanLine(body.firma, LIMITS.company),
    yetkili: cleanLine(body.yetkili, LIMITS.name),
    eposta: cleanLine(body.eposta, LIMITS.email).toLowerCase(),
    telefon: cleanLine(body.telefon, LIMITS.phone),
    kisi: cleanLine(body.kisi, 4),
    giris: cleanLine(body.giris, 10),
    sure: cleanLine(body.sure, 20),
    odaTipi: cleanLine(body.oda_tipi, 20),
    notlar: cleanMultiline(body.notlar, LIMITS.notes),
  };

  if (data.firma.length < 2) errors.firma = m.company;
  else if (data.firma.length > LIMITS.company) errors.firma = m.companyMax(LIMITS.company);

  if (data.yetkili.length < 2) errors.yetkili = m.contactPerson;
  else if (data.yetkili.length > LIMITS.name) errors.yetkili = m.nameMax(LIMITS.name);

  if (!data.eposta) errors.eposta = m.emailRequired;
  else if (!isEmail(data.eposta)) errors.eposta = m.email;

  if (!data.telefon) errors.telefon = m.phoneRequired;
  else if (!isPhone(data.telefon)) errors.telefon = m.phone;

  checkGuests(errors, m, data.kisi, GUESTS.quote, true);
  checkDates(errors, m, data.giris, '', true);

  if (!DURATIONS.includes(data.sure)) errors.sure = m.duration;
  if (!ROOM_PREFS.includes(data.odaTipi)) errors.oda_tipi = m.roomPref;

  if (data.notlar.length > LIMITS.notes) errors.notlar = m.notesMax(LIMITS.notes);
  else if (countLinks(data.notlar) > 2) errors.notlar = m.links;

  if (!isChecked(body.kvkk)) errors.kvkk = m.consent;

  return { ok: Object.keys(errors).length === 0, data, errors };
}

/** İstemci tarafı doğrulama için form başına mesajlar */
function clientMessages(form, m) {
  const common = {
    eposta: m.email,
    eposta_required: m.emailRequired,
    telefon: m.phone,
    telefon_required: m.phoneRequired,
    giris: m.datePast,
    giris_required: m.startRequired,
    cikis: m.endBeforeStart,
    kvkk: m.consent,
  };
  if (form === 'contact') {
    return { ...common, ad: m.name, konu: m.topic, kisi: m.guests(...GUESTS.contact), mesaj: m.message };
  }
  return {
    ...common,
    firma: m.company,
    yetkili: m.contactPerson,
    kisi: m.guests(...GUESTS.quote),
    kisi_required: m.guestsRequired,
    sure: m.duration,
    oda_tipi: m.roomPref,
    notlar: m.notesMax(LIMITS.notes),
  };
}

module.exports = { validateContact, validateQuote, clientMessages, TOPICS, DURATIONS, ROOM_PREFS, LIMITS, GUESTS, todayIstanbul };
