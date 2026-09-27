# Otel Selvi — Kurumsal Web Sitesi

Karabük'teki Otel Selvi için 4 dilli (Türkçe, İngilizce, Rusça, Japonca), mobil uyumlu, arama motoru ve yapay zekâ aramalarına uygun web sitesi. Node.js (Express) ile sunucu tarafında oluşturulur; her dil ve sayfa Google'a tam HTML olarak gider.

## Diller ve adresler

Ana dil Türkçe'dir ve kök adreste yayınlanır. Diğer diller kendi klasöründedir; her sayfa diğer dillerdeki karşılığını `hreflang` ile Google'a bildirir.

| Sayfa | Türkçe | English | Русский | 日本語 |
|---|---|---|---|---|
| Ana sayfa | `/` | `/en` | `/ru` | `/ja` |
| Odalar | `/odalar` | `/en/rooms` | `/ru/nomera` | `/ja/rooms` |
| Kurumsal | `/kurumsal-konaklama` | `/en/corporate-accommodation` | `/ru/korporativnoe-prozhivanie` | `/ja/corporate-stays` |
| Hakkımızda | `/hakkimizda` | `/en/about` | `/ru/o-nas` | `/ja/about` |
| İletişim | `/iletisim` | `/en/contact` | `/ru/kontakty` | `/ja/contact` |
| Gezi rehberi | `/karabuk-gezi-rehberi` | `/en/karabuk-travel-guide` | `/ru/putevoditel-karabyuk` | `/ja/karabuk-guide` |
| SSS | `/sikca-sorulan-sorular` | `/en/faq` | `/ru/voprosy-i-otvety` | `/ja/faq` |
| KVKK | `/kvkk-aydinlatma-metni` | `/en/privacy-notice` | `/ru/politika-konfidencialnosti` | `/ja/privacy` |

Menüler, butonlar, formlar, hata mesajları, sayfa başlıkları, Google yapısal verisi ve sitemap dahil her şey seçilen dile göre değişir. Form e-postaları otel personeli için her zaman Türkçe gelir; e-postada formun hangi dilde doldurulduğu yazar.

## İçeriği güncelleme

- **`src/config/site.js`**: dilden bağımsız bilgiler. Adres, telefonlar, e-posta, Instagram, koordinat, giriş-çıkış saatleri, olanaklar, oda kapasiteleri ve **fiyatlar** (`priceFrom`), rota planlayıcıdaki hazır yerler.
- **`src/i18n/tr.js`, `en.js`, `ru.js`, `ja.js`**: sitedeki tüm metinler. Oda açıklamaları, SSS, hakkımızda, gezi rehberi, form metinleri. Bir metni değiştirirken dört dosyada da güncelleyin.
- **Fotoğraflar:** `FOTOGRAF-EKLEME.txt` dosyasındaki isimlerle `public/img/foto/` klasörüne koyun. Ana sayfadaki büyük görsel için `hero.jpg` yeterli. Fotoğraf yoksa zarif bir yer tutucu görünür.

## Harita ve yol tarifi

Sitede her yerde **Yol tarifi al** butonu var; ziyaretçinin bulunduğu yerden otele Google Haritalar rotası açar. Ana sayfada ve iletişim sayfasında harita ile **"Otelden ne kadar sürer?"** bölümü bulunur.

- **API anahtarı olmadan (varsayılan, ücretsiz):** Google Haritalar gömülü harita olarak görünür. Hazır yerler (Safranbolu, gar, üniversite…) ve yazılan yerler, seçilen ulaşım türüyle Google Haritalar'da açılır.
- **API anahtarı ile:** Harita etkileşimli olur; süre ve mesafe sayfanın içinde hesaplanır ve rota haritaya çizilir. Gönderdiğiniz Google "Commutes" örneği eski (legacy) Places/Directions servislerini kullandığı için Mart 2025'ten sonra açılan projelerde çalışmaz. Bu yüzden aynı özellik Google'ın yeni **Routes** kütüphanesiyle yeniden yazıldı (`public/js/route-planner.js`).

Anahtar kurulumu:

1. Google Cloud Console'da bir proje açın ve faturalandırmayı etkinleştirin (Google aylık ücretsiz kullanım kotası verir).
2. **Maps JavaScript API** ve **Routes API**'yi etkinleştirin.
3. Bir API anahtarı oluşturun. **Uygulama kısıtlaması** olarak "Web siteleri" seçip `https://otelselvi.com/*` ve `https://www.otelselvi.com/*` ekleyin. **API kısıtlaması** olarak yalnızca bu iki API'yi seçin.
4. İsterseniz Harita Yönetimi'nden bir Map ID oluşturun.
5. Dokploy Environment'a `GOOGLE_MAPS_API_KEY` ve (varsa) `GOOGLE_MAPS_MAP_ID` yazıp yeniden deploy edin.

Harita, bölüm ekrana yaklaşınca yüklenir; rota yalnızca ziyaretçi bir yer seçtiğinde hesaplanır. Böylece ücretsiz kota verimli kullanılır. Anahtarda sorun olursa site otomatik olarak ücretsiz gömülü haritaya döner.

## Dokploy'a kurulum (Docker Compose)

1. Projeyi GitHub'a gönderin (`.env` gönderilmez).
2. Dokploy'da Project → Create Service → **Compose** oluşturun. Provider olarak Git'i, deponuzu ve `main` dalını seçin. Compose Path: `./docker-compose.yml`.
3. **Environment** sekmesine `.env.example` içeriğini kendi bilgilerinizle yapıştırın. En az `SITE_URL`, `SMTP_*`, `MAIL_FROM`, `MAIL_TO` gerekli.
4. **Domains** sekmesinde alan adını ekleyin: Service Name `web`, Container Port `3000`, HTTPS açık, Let's Encrypt. Aynısını `www` için de ekleyin.
5. **Deploy** edin. İki alan adı da çalışınca `CANONICAL_REDIRECT=true` yapıp tekrar deploy edin.

Cloudflare turuncu bulut (proxy) açıksa `TRUST_PROXY=2` yapın.

Yerelde çalıştırmak için: `npm install`, `cp .env.example .env`, `npm run dev` (http://localhost:3000).

## Google ve yapay zekâ aramaları

- Her dilde benzersiz başlık/açıklama, canonical ve `hreflang` etiketleri var. Sitemap 32 adresi dil karşılıklarıyla birlikte listeler.
- `Hotel`, `HotelRoom`, `FAQPage`, `Service`, `BreadcrumbList` yapısal verileri sayfanın diline göre üretilir. Otelin tüm dillerdeki adları (ör. "Отель Селви", "ホテル・セルヴィ") Google'a alternatif ad olarak bildirilir.
- `/llms.txt` yapay zekâ aramaları için Türkçe ve İngilizce özet sunar. `robots.txt` ChatGPT, Claude, Perplexity ve Gemini tarayıcılarına açıktır.
- Search Console ve Bing Webmaster Tools'a `https://otelselvi.com/sitemap.xml` adresini gönderin.
- **Fiyatların Google otel aramasında görünmesi** web sitesinden değil, Google Hotel Center üzerinden kanal yöneticiniz (HotelRunner, Elektraweb vb.) aracılığıyla olur. Sitedeki fiyat verisi bu süreci destekler.

## Güvenlik

- Bir IP adresi 24 saatte en fazla 4 form gönderebilir; iki form ortak kotayı kullanır. Sayaç yeniden başlatmada sıfırlanmaz. IP'ler diske özetlenmiş (HMAC) yazılır.
- 15 dakikada 10'dan fazla deneme ve site genelinde günde 200'den fazla form reddedilir.
- Her form imzalı, tek kullanımlık ve süreli bir anahtar taşır. Başka siteden gönderim, tekrar gönderim ve 3 saniyeden hızlı doldurulan formlar reddedilir. Botlar için gizli bal küpü alanı vardır.
- Tüm alanlar sunucuda doğrulanır; e-posta başlığına kod sokma denemeleri etkisizdir, e-posta içeriği kaçışlıdır.
- Sıkı güvenlik başlıkları (CSP, HSTS vb.) kullanılır. Google Haritalar için gereken izinler yalnızca harita içeren sayfalarda ve API anahtarı tanımlıysa açılır.
- Konteyner root olmayan kullanıcıyla, salt okunur dosya sistemiyle ve tüm Linux yetkileri kapalı çalışır.

## Yayın öncesi kontrol listesi

- [ ] `src/config/site.js` içindeki "KONTROL EDİN" satırları (olanaklar, saatler, Instagram, resmi ünvan)
- [ ] Oda fiyatları (`priceFrom`) ve istenirse kuruluş yılı
- [ ] `hero.jpg` ve oda fotoğrafları
- [ ] Oda tipleri ve SSS metinleri gerçek bilgilerinizle uyumlu mu (4 dil dosyasında)
- [ ] KVKK metninin hukuk danışmanınızca gözden geçirilmesi
- [ ] SMTP bilgileri ve test formu gönderimi
- [ ] (İsteğe bağlı) Google Maps API anahtarı
- [ ] Search Console ve Bing Webmaster Tools'a sitemap gönderimi
