'use strict';

const fs = require('fs');
const path = require('path');

const FOTO_DIR = path.join(__dirname, '..', '..', 'public', 'img', 'foto');
const EXT = ['.webp', '.jpg', '.jpeg', '.png', '.avif'];

/**
 * public/img/foto/ klasörüne koyduğunuz fotoğraflar sunucu açılırken bulunur.
 * Örn: hero.jpg koyarsanız ana sayfadaki kemer çerçevede otomatik görünür.
 */
function scan() {
  const photos = {};
  let files = [];
  try {
    files = fs.readdirSync(FOTO_DIR);
  } catch (_) {
    return { photos, gallery: [] };
  }
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!EXT.includes(ext)) continue;
    const base = path.basename(file, path.extname(file)).toLowerCase();
    const prev = photos[base];
    // Aynı isimde birden fazla uzantı varsa webp'yi tercih et
    if (!prev || EXT.indexOf(ext) < EXT.indexOf(prev.ext)) {
      photos[base] = { src: `/img/foto/${encodeURIComponent(file)}`, ext };
    }
  }

  let gallery = [];
  try {
    gallery = fs
      .readdirSync(path.join(FOTO_DIR, 'galeri'))
      .filter((f) => EXT.includes(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'tr'))
      .slice(0, 24)
      .map((f) => {
        const label = path
          .basename(f, path.extname(f))
          .replace(/^\d+[-_ ]*/, '')
          .replace(/[-_]+/g, ' ')
          .trim();
        return {
          src: `/img/foto/galeri/${encodeURIComponent(f)}`,
          alt: label ? `Otel Selvi Karabük — ${label.charAt(0).toLocaleUpperCase('tr') + label.slice(1)}` : 'Otel Selvi Karabük',
        };
      });
  } catch (_) {
    gallery = [];
  }
  return { photos, gallery };
}

const state = scan();

module.exports = {
  photo: (name) => (name && state.photos[name.toLowerCase()]) || null,
  gallery: state.gallery,
  allPhotoUrls: () => [...Object.values(state.photos).map((p) => p.src), ...state.gallery.map((g) => g.src)],
};
