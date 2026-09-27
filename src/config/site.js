/**
 * OTEL SELVİ — DİLDEN BAĞIMSIZ OTEL BİLGİLERİ
 * ------------------------------------------------------------------
 * Adres, telefon, fiyat, saat gibi her dilde aynı olan bilgiler burada.
 * Sitedeki METİNLER (oda açıklamaları, SSS, hakkımızda…) ise her dil için
 * ayrı dosyadadır:  src/i18n/tr.js  en.js  ru.js  ja.js
 *
 * "KONTROL EDİN" yazan satırlar tahmini bilgidir; yayından önce düzeltin.
 */

module.exports = {
  name: 'Otel Selvi',
  // KVKK metninde "veri sorumlusu" olarak görünür. Resmi şirket ünvanınızı yazın. (KONTROL EDİN)
  legalName: 'Otel Selvi',

  // Kuruluş yılı (ör. 1987). Yazarsanız tüm dillerde "1987 yılından bu yana" vurgusu çıkar.
  foundedYear: null,

  address: {
    street: 'Bayır Mah. Fevzi Fırat Cad. No:72',
    streetShort: 'Fevzi Fırat Cad. No:72',
    district: 'Merkez',
    city: 'Karabük',
    postalCode: '78200',
    countryCode: 'TR',
    full: 'Bayır Mah. Fevzi Fırat Cad. No:72, 78200 Karabük Merkez / Karabük',
  },

  // Otelin harita koordinatı (Google Haritalar'dan alındı)
  geo: { lat: 41.1960266, lng: 32.609521 },

  maps: {
    // Google İşletme Profilinizin kalıcı bağlantısı
    placeUrl: 'https://maps.google.com/?cid=1294515180294259685',
    // Harita ve yol tarifinde aranacak ifade
    query: 'Otel Selvi, Fevzi Fırat Cd. No:72, 78200 Karabük',
    /**
     * "Otelden ne kadar sürer?" bölümündeki hazır yerler.
     * query: Google'ın bulacağı açık adres. Etiketler dil dosyalarında (planner.presets).
     */
    routePresets: [
      { key: 'safranbolu', query: 'Safranbolu Çarşı, Safranbolu, Karabük' },
      { key: 'station', query: 'Karabük Tren Garı, Karabük' },
      { key: 'university', query: 'Karabük Üniversitesi Demir Çelik Kampüsü, Karabük' },
      { key: 'kardemir', query: 'KARDEMİR Karabük Demir Çelik, Karabük' },
      { key: 'canyon', query: 'Kristal Cam Seyir Terası, Tokatlı Kanyonu, Safranbolu' },
    ],
  },

  phones: [
    { key: 'reception', display: '0370 424 10 10', intl: '+90 370 424 10 10', e164: '+903704241010' },
    { key: 'mobile', display: '0507 213 53 99', intl: '+90 507 213 53 99', e164: '+905072135399', whatsapp: true },
  ],
  email: 'iletisim@otelselvi.com',

  social: {
    // Instagram kullanıcı adınız farklıysa düzeltin. (KONTROL EDİN)
    instagram: { handle: 'otelselvi', url: 'https://www.instagram.com/otelselvi/' },
    // Facebook sayfanız varsa adresini yazın; boşsa gösterilmez.
    facebook: '',
  },

  // (KONTROL EDİN)
  checkin: '14:00',
  checkout: '12:00',
  reception24h: true,

  priceRange: '₺₺',
  currency: 'TRY',
  // Ödeme yöntemleri: cash, card, debit, transfer
  payment: ['cash', 'card', 'debit', 'transfer'],

  /**
   * Otel olanakları. Olmayanı silin. Kullanılabilecek anahtarlar:
   * wifi, reception, housekeeping, invoice, longstay, central, breakfast, parking, ac, elevator
   * (KONTROL EDİN)
   */
  amenities: ['wifi', 'reception', 'housekeeping', 'invoice', 'longstay', 'central'],

  /**
   * ODALAR — metinleri dil dosyalarındaki "roomTypes" bölümünde.
   * priceFrom: gecelik başlangıç fiyatı (TL, sadece sayı, ör. 1500). null ise "Fiyat için arayın" yazar.
   *            Doldurursanız Google'a yapısal veri olarak fiyat teklifi gider.
   * photo:     public/img/foto/ içine koyacağınız fotoğrafın adı (uzantısız).
   */
  rooms: [
    { key: 'single', capacity: 1, priceFrom: null, photo: 'oda-tek' },
    { key: 'double', capacity: 2, priceFrom: null, photo: 'oda-cift' },
    { key: 'twin', capacity: 2, priceFrom: null, photo: 'oda-iki-yatakli' },
    { key: 'triple', capacity: 3, priceFrom: null, photo: 'oda-uc-kisilik' },
  ],
};
