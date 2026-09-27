'use strict';

const site = require('../config/site');
const env = require('../config/env');
const photos = require('./photos');
const { LOCALES, ORDER, pathFor } = require('../i18n');

const U = env.siteUrl;
const HOTEL_ID = `${U}/#hotel`;
const WEBSITE_ID = `${U}/#website`;

const abs = (p) => (p.startsWith('http') ? p : `${U}${p}`);
const pageUrl = (lang, key) => {
  const p = pathFor(lang, key);
  return p === '/' ? `${U}/` : `${U}${p}`;
};
const compact = (obj) => {
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined || obj[k] === null || obj[k] === '' || (Array.isArray(obj[k]) && !obj[k].length)) delete obj[k];
  }
  return obj;
};
const LANG_TAG = { tr: 'tr-TR', en: 'en', ru: 'ru', ja: 'ja' };

function hotelDescription(lang) {
  const t = LOCALES[lang];
  return t.seo.hotelDescription(t.home.since(site.foundedYear));
}

function roomId(room) {
  return `${U}/#room-${room.key}`;
}

function roomNode(lang, room) {
  const t = LOCALES[lang];
  const r = t.roomTypes[room.key];
  const ph = photos.photo(room.photo);
  return compact({
    '@type': 'HotelRoom',
    '@id': roomId(room),
    name: r.name,
    description: r.summary,
    url: `${pageUrl(lang, 'rooms')}#${room.key}`,
    bed: { '@type': 'BedDetails', typeOfBed: r.bed },
    occupancy: { '@type': 'QuantitativeValue', maxValue: room.capacity, unitCode: 'C62' },
    amenityFeature: r.features.map((f) => ({ '@type': 'LocationFeatureSpecification', name: f, value: true })),
    image: ph ? abs(ph.src) : undefined,
  });
}

function offerNode(lang, room) {
  const t = LOCALES[lang];
  return {
    '@type': 'Offer',
    name: t.seo.offerName(t.roomTypes[room.key].name),
    url: `${pageUrl(lang, 'rooms')}#${room.key}`,
    itemOffered: { '@id': roomId(room) },
    price: room.priceFrom,
    priceCurrency: site.currency,
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: room.priceFrom,
      priceCurrency: site.currency,
      unitText: t.seo.unitText,
      unitCode: 'DAY',
    },
    availability: 'https://schema.org/InStock',
    seller: { '@id': HOTEL_ID },
  };
}

function hotelNode(lang, { withRooms = false } = {}) {
  const t = LOCALES[lang];
  const phoneKey = (p) => t.ui.phoneLabels[p.key];
  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const priced = site.rooms.filter((r) => Number.isFinite(r.priceFrom) && r.priceFrom > 0);
  // Tüm dillerdeki alternatif adlar: "Otel Selvi" her dilde aranabilsin
  const alternateNames = [...new Set(ORDER.flatMap((l) => LOCALES[l].seo.alternateNames))];

  return compact({
    '@type': 'Hotel',
    '@id': HOTEL_ID,
    name: site.name,
    alternateName: alternateNames,
    legalName: site.legalName !== site.name ? site.legalName : undefined,
    slogan: t.footer.slogan,
    description: hotelDescription(lang),
    url: `${U}/`,
    logo: { '@type': 'ImageObject', url: abs('/img/logo.png'), width: 900, height: 516 },
    image: [abs('/img/og-image.jpg'), ...photos.allPhotoUrls().slice(0, 8).map(abs)],
    telephone: site.phones[0].intl,
    email: site.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: 'Karabük',
      addressRegion: 'Karabük',
      postalCode: site.address.postalCode,
      addressCountry: site.address.countryCode,
    },
    geo: site.geo ? { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng } : undefined,
    hasMap: site.maps.placeUrl,
    sameAs: [site.social.instagram && site.social.instagram.url, site.social.facebook, site.maps.placeUrl].filter(Boolean),
    foundingDate: site.foundedYear ? String(site.foundedYear) : undefined,
    priceRange: site.priceRange,
    currenciesAccepted: site.currency,
    paymentAccepted: site.payment.map((k) => t.payment[k]).join(', '),
    checkinTime: `${site.checkin}:00`,
    checkoutTime: `${site.checkout}:00`,
    availableLanguage: [{ '@type': 'Language', name: 'Turkish', alternateName: 'tr' }],
    areaServed: [
      { '@type': 'City', name: 'Karabük' },
      { '@type': 'City', name: 'Safranbolu' },
    ],
    knowsAbout: t.seo.keywords,
    amenityFeature: site.amenities.map((k) => ({ '@type': 'LocationFeatureSpecification', name: t.amenities[k], value: true })),
    openingHoursSpecification: site.reception24h
      ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: allDays, opens: '00:00', closes: '23:59' }]
      : undefined,
    contactPoint: [
      ...site.phones.map((p) => ({
        '@type': 'ContactPoint',
        telephone: p.intl,
        contactType: 'reservations',
        name: phoneKey(p),
        areaServed: 'TR',
        availableLanguage: ['Turkish'],
      })),
      {
        '@type': 'ContactPoint',
        telephone: site.phones[0].intl,
        email: site.email,
        contactType: 'sales',
        name: t.seo.serviceName,
        availableLanguage: ['Turkish'],
      },
    ],
    containsPlace: withRooms ? site.rooms.map((r) => ({ '@id': roomId(r) })) : undefined,
    makesOffer: withRooms && priced.length ? priced.map((r) => offerNode(lang, r)) : undefined,
    potentialAction: {
      '@type': 'ReserveAction',
      name: t.seo.reserveAction,
      target: { '@type': 'EntryPoint', urlTemplate: `tel:${site.phones[0].e164}` },
    },
  });
}

function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: `${U}/`,
    name: site.name,
    alternateName: 'Otel Selvi Karabük',
    inLanguage: ORDER.map((l) => LANG_TAG[l]),
    publisher: { '@id': HOTEL_ID },
  };
}

function breadcrumbNode(lang, key) {
  const t = LOCALES[lang];
  const items = [{ name: t.ui.home, url: pageUrl(lang, 'home') }];
  if (key !== 'home') items.push({ name: t.pages[key].name, url: pageUrl(lang, key) });
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl(lang, key)}#breadcrumb`,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

const faqEntities = (list) => list.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }));

const PAGE_TYPE = { about: 'AboutPage', contact: 'ContactPage', faq: 'FAQPage' };

function webPageNode(lang, key, extra = {}, type) {
  const t = LOCALES[lang];
  return compact({
    '@type': type || PAGE_TYPE[key] || 'WebPage',
    '@id': `${pageUrl(lang, key)}#webpage`,
    url: pageUrl(lang, key),
    name: t.pages[key].title,
    description: t.pages[key].description,
    inLanguage: LANG_TAG[lang],
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': HOTEL_ID },
    breadcrumb: { '@id': `${pageUrl(lang, key)}#breadcrumb` },
    primaryImageOfPage: { '@type': 'ImageObject', url: abs('/img/og-image.jpg') },
    ...extra,
  });
}

/** Her dil ve sayfa için JSON-LD @graph */
function buildGraph(lang, key) {
  const t = LOCALES[lang];
  const graph = [websiteNode()];

  switch (key) {
    case 'rooms':
      graph.push(hotelNode(lang, { withRooms: true }), ...site.rooms.map((r) => roomNode(lang, r)), webPageNode(lang, key));
      break;
    case 'faq':
      graph.push(hotelNode(lang), webPageNode(lang, key, { mainEntity: faqEntities([...t.faq.items, ...t.corporate.faq]) }));
      break;
    case 'corporate':
      graph.push(hotelNode(lang), {
        '@type': 'Service',
        '@id': `${pageUrl(lang, key)}#service`,
        name: t.seo.serviceName,
        serviceType: t.seo.serviceName,
        description: t.seo.serviceDescription,
        provider: { '@id': HOTEL_ID },
        areaServed: [{ '@type': 'City', name: 'Karabük' }],
        audience: { '@type': 'BusinessAudience', name: t.seo.audience },
        availableChannel: {
          '@type': 'ServiceChannel',
          serviceUrl: `${pageUrl(lang, key)}#teklif`,
          servicePhone: { '@type': 'ContactPoint', telephone: site.phones[0].intl },
        },
      });
      graph.push(webPageNode(lang, key, { mainEntity: faqEntities(t.corporate.faq) }, ['WebPage', 'FAQPage']));
      break;
    case 'guide':
      graph.push(hotelNode(lang), {
        '@type': 'ItemList',
        '@id': `${pageUrl(lang, key)}#places`,
        name: t.guide.listName,
        itemListElement: t.guide.places.map((g, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: { '@type': 'TouristAttraction', name: g.name, description: g.text, containedInPlace: { '@type': 'AdministrativeArea', name: 'Karabük' } },
        })),
      });
      graph.push(webPageNode(lang, key, { mainEntity: { '@id': `${pageUrl(lang, key)}#places` } }));
      break;
    default:
      graph.push(hotelNode(lang), webPageNode(lang, key));
  }
  graph.push(breadcrumbNode(lang, key));
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

module.exports = { buildGraph, hotelDescription, pageUrl, abs };
