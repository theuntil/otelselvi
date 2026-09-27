'use strict';

const nodemailer = require('nodemailer');
const env = require('../config/env');
const { LOCALES } = require('../i18n');

let transporter = null;

function getTransport() {
  if (transporter) return transporter;
  if (env.mail.dryRun) {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }
  if (!env.smtp.host || !env.mail.to) return null;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    requireTLS: !env.smtp.secure && env.smtp.port === 587,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { rejectUnauthorized: env.smtp.rejectUnauthorized, minVersion: 'TLSv1.2' },
  });
  return transporter;
}

async function verifyConnection() {
  const t = getTransport();
  if (!t) {
    console.warn('[mail] SMTP ayarlanmamış (SMTP_HOST / MAIL_TO eksik). Formlar hata döndürecek.');
    return false;
  }
  if (env.mail.dryRun) {
    console.log('[mail] MAIL_DRY_RUN=true — e-postalar gönderilmeyecek, konsola yazılacak.');
    return true;
  }
  try {
    await t.verify();
    console.log(`[mail] SMTP bağlantısı hazır: ${env.smtp.host}:${env.smtp.port}`);
    return true;
  } catch (err) {
    console.error('[mail] SMTP bağlantısı kurulamadı:', err.message);
    return false;
  }
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function nowIstanbul() {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());
}

// Başlık satırlarına girecek metinlerde satır sonu kalmamasını garanti eder
const headerSafe = (s) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, 120);

function renderEmail({ title, intro, rows, message, messageLabel, meta }) {
  const rowsHtml = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) => `<tr>
        <td style="padding:10px 16px 10px 0;color:#56655F;font-size:14px;vertical-align:top;white-space:nowrap;border-bottom:1px solid #E3E9E5">${esc(k)}</td>
        <td style="padding:10px 0;color:#1C2A26;font-size:15px;vertical-align:top;border-bottom:1px solid #E3E9E5">${v.html ?? esc(v)}</td>
      </tr>`
    )
    .join('');
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#F1F5F2;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F2;padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-top:4px solid #BE902F">
      <tr><td style="padding:28px 28px 8px">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#23473D">${esc(title)}</div>
        <div style="font-size:14px;color:#56655F;margin-top:6px">${esc(intro)}</div>
      </td></tr>
      <tr><td style="padding:8px 28px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table></td></tr>
      ${
        message
          ? `<tr><td style="padding:16px 28px 8px">
        <div style="font-size:14px;color:#56655F;margin-bottom:6px">${esc(messageLabel)}</div>
        <div style="font-size:15px;line-height:1.6;color:#1C2A26;white-space:pre-wrap;background:#F7F9F8;padding:14px 16px;border-left:3px solid #BE902F">${esc(message)}</div>
      </td></tr>`
          : ''
      }
      <tr><td style="padding:20px 28px 28px;font-size:12px;color:#7A8782;line-height:1.5">
        Bu e-posta ${esc(env.siteHost)} adresindeki formdan gönderildi. Yanıtla dediğinizde doğrudan başvuru sahibine yazarsınız.<br>
        ${esc(meta)}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const text = [
    title,
    intro,
    '',
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v.text ?? v}`),
    '',
    message ? `${messageLabel}:\n${message}` : '',
    '',
    '—',
    meta,
  ].join('\n');

  return { html, text };
}

function linkRow(href, label) {
  return { html: `<a href="${esc(href)}" style="color:#23473D">${esc(label)}</a>`, text: label };
}

async function send({ to, subject, replyTo, html, text }) {
  const t = getTransport();
  if (!t) throw new Error('SMTP yapılandırılmamış');
  const info = await t.sendMail({
    from: { name: env.mail.fromName, address: env.mail.from },
    to,
    replyTo,
    subject: headerSafe(subject),
    text,
    html,
    headers: { 'X-Auto-Response-Suppress': 'OOF, AutoReply' },
  });
  if (env.mail.dryRun) console.log('[mail:dry-run]', subject, '→', to);
  return info;
}

// E-postalar otel personeli için her zaman Türkçe gönderilir; formun dili ayrıca belirtilir
const TR = LOCALES.tr.form;
const langLabel = (lang) => `${LOCALES[lang].label} (${lang.toUpperCase()})`;

async function sendContactMail(data, meta) {
  const topic = TR.topics[data.konu];
  const { html, text } = renderEmail({
    title: `Yeni mesaj: ${topic}`,
    intro: `${data.ad} web sitesindeki iletişim formundan yazdı.`,
    rows: [
      ['Ad soyad', data.ad],
      ['E-posta', linkRow(`mailto:${data.eposta}`, data.eposta)],
      ['Telefon', data.telefon ? linkRow(`tel:${data.telefon.replace(/[^\d+]/g, '')}`, data.telefon) : ''],
      ['Konu', topic],
      ['Giriş tarihi', formatDate(data.giris)],
      ['Çıkış tarihi', formatDate(data.cikis)],
      ['Kişi sayısı', data.kisi],
      ['Form dili', langLabel(meta.lang)],
    ],
    message: data.mesaj,
    messageLabel: 'Mesaj',
    meta: `Gönderim: ${nowIstanbul()} · IP: ${meta.ip}`,
  });
  const tag = meta.lang === 'tr' ? '' : ` [${meta.lang.toUpperCase()}]`;
  return send({
    to: env.mail.to,
    subject: `[Web İletişim]${tag} ${topic} — ${headerSafe(data.ad)}`,
    replyTo: { name: headerSafe(data.ad), address: data.eposta },
    html,
    text,
  });
}

async function sendQuoteMail(data, meta) {
  const { html, text } = renderEmail({
    title: `Kurumsal teklif talebi: ${data.firma}`,
    intro: `${data.yetkili}, ${data.kisi} kişilik konaklama için teklif istiyor.`,
    rows: [
      ['Firma / kurum', data.firma],
      ['Yetkili', data.yetkili],
      ['E-posta', linkRow(`mailto:${data.eposta}`, data.eposta)],
      ['Telefon', linkRow(`tel:${data.telefon.replace(/[^\d+]/g, '')}`, data.telefon)],
      ['Kişi sayısı', data.kisi],
      ['Giriş tarihi', formatDate(data.giris)],
      ['Tahmini süre', TR.durations[data.sure]],
      ['Oda tercihi', TR.roomPrefs[data.odaTipi]],
      ['Form dili', langLabel(meta.lang)],
    ],
    message: data.notlar,
    messageLabel: 'Ek notlar',
    meta: `Gönderim: ${nowIstanbul()} · IP: ${meta.ip}`,
  });
  const tag = meta.lang === 'tr' ? '' : ` [${meta.lang.toUpperCase()}]`;
  return send({
    to: env.mail.toCorporate,
    subject: `[Kurumsal Teklif]${tag} ${headerSafe(data.firma)} — ${data.kisi} kişi, ${formatDate(data.giris)}`,
    replyTo: { name: headerSafe(data.yetkili), address: data.eposta },
    html,
    text,
  });
}

module.exports = { verifyConnection, sendContactMail, sendQuoteMail };
