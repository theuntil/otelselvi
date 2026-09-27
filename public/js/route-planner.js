/*
 * Otel Selvi — "Otelden ne kadar sürer?" rota planlayıcı
 *
 * Google'ın "Commutes and Destinations" örneğindeki fikirden yola çıkılarak
 * yeniden yazılmıştır. O örnek eski (legacy) Places/Directions servislerini
 * kullandığı için Mart 2025 sonrası açılan Google Cloud projelerinde çalışmaz;
 * burada onların yerine yeni Routes kütüphanesi (Route.computeRoutes) ve
 * Advanced Markers kullanılır.
 *
 * Gerekli API'ler: Maps JavaScript API + Routes API (GOOGLE_MAPS_API_KEY).
 * Harita yalnızca bölüm ekrana yaklaşınca yüklenir; bir sorun olursa ücretsiz
 * gömülü haritaya ve Google Haritalar bağlantılarına geri dönülür.
 */
(function () {
  'use strict';

  var root = document.querySelector('[data-planner]');
  if (!root) return;
  var cfg;
  try {
    cfg = JSON.parse(root.getAttribute('data-planner'));
  } catch (_) {
    return;
  }
  if (!cfg.key || cfg.hotel.lat == null) return;

  var canvas = root.querySelector('[data-map-canvas]');
  var fallback = root.querySelector('[data-map-fallback]');
  var form = root.querySelector('[data-planner-form]');
  var statusEl = root.querySelector('[data-planner-status]');
  var resultsEl = root.querySelector('[data-planner-results]');
  var leadEl = root.querySelector('[data-planner-lead]');
  var input = form.querySelector('input[name="destination"]');
  var hotel = { lat: cfg.hotel.lat, lng: cfg.hotel.lng };
  var MAX_RESULTS = 5;

  var state = { lib: null, map: null, ready: false, failed: false, loading: null, polylines: [], destMarker: null, results: [], activeId: null, cache: {} };

  function currentMode() {
    var el = form.querySelector('input[name="travelmode"]:checked');
    return (el ? el.value : 'driving').toUpperCase();
  }

  function setStatus(msg, isError) {
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  function routeUrl(dest, mode) {
    var p = new URLSearchParams({ api: '1', origin: cfg.hotel.query, destination: dest, travelmode: mode.toLowerCase() });
    return 'https://www.google.com/maps/dir/?' + p.toString();
  }

  function unit(value, name, digits) {
    return new Intl.NumberFormat(cfg.intl, { style: 'unit', unit: name, unitDisplay: 'short', maximumFractionDigits: digits || 0 }).format(value);
  }

  function fmtDuration(ms) {
    if (!(ms > 0)) return '';
    var total = Math.max(1, Math.round(ms / 60000));
    var h = Math.floor(total / 60);
    var m = total % 60;
    if (h && m) return unit(h, 'hour') + ' ' + unit(m, 'minute');
    return h ? unit(h, 'hour') : unit(m, 'minute');
  }

  function fmtDistance(meters) {
    if (!(meters > 0)) return '';
    return meters < 1000 ? unit(Math.round(meters / 10) * 10, 'meter') : unit(meters / 1000, 'kilometer', meters < 10000 ? 1 : 0);
  }

  function pinContent(pin) {
    return pin.element || pin;
  }

  /* Sorun olursa ücretsiz gömülü haritaya dön */
  function fail() {
    if (state.failed) return;
    state.failed = true;
    state.ready = false;
    canvas.hidden = true;
    fallback.hidden = false;
    if (leadEl) leadEl.textContent = cfg.text.leadNoKey;
    setStatus('');
    resultsEl.textContent = '';
  }
  window.gm_authFailure = fail; // Google, anahtar hatasında bu fonksiyonu çağırır

  function loadScript() {
    return new Promise(function (resolve, reject) {
      if (window.google && window.google.maps && window.google.maps.importLibrary) return resolve();
      window.__selviMapsReady = function () {
        resolve();
      };
      var params = new URLSearchParams({ key: cfg.key, v: 'weekly', loading: 'async', language: cfg.lang, region: 'TR', callback: '__selviMapsReady' });
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?' + params.toString();
      s.async = true;
      s.onerror = function () {
        reject(new Error('Google Maps yüklenemedi'));
      };
      document.head.appendChild(s);
    });
  }

  function init() {
    if (state.loading) return state.loading;
    state.loading = loadScript()
      .then(function () {
        return Promise.all([
          google.maps.importLibrary('maps'),
          google.maps.importLibrary('marker'),
          google.maps.importLibrary('routes'),
          google.maps.importLibrary('core'),
        ]);
      })
      .then(function (libs) {
        if (state.failed) return;
        state.lib = {
          Map: libs[0].Map,
          AdvancedMarkerElement: libs[1].AdvancedMarkerElement,
          PinElement: libs[1].PinElement,
          Route: libs[2].Route,
          LatLngBounds: libs[3].LatLngBounds,
        };
        canvas.hidden = false;
        state.map = new state.lib.Map(canvas, {
          center: hotel,
          zoom: 15,
          mapId: cfg.mapId,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        });
        var pin = new state.lib.PinElement({ background: '#23473D', borderColor: '#183229', glyphColor: '#D9B25E', scale: 1.15 });
        new state.lib.AdvancedMarkerElement({ map: state.map, position: hotel, title: cfg.hotel.name, content: pinContent(pin) });
        fallback.hidden = true;
        state.ready = true;
      })
      .catch(function (err) {
        console.warn('[harita]', err);
        fail();
      });
    return state.loading;
  }

  function clearRoute() {
    state.polylines.forEach(function (p) {
      p.setMap(null);
    });
    state.polylines = [];
    if (state.destMarker) state.destMarker.map = null;
    state.destMarker = null;
  }

  function show(id) {
    var r = state.results.filter(function (x) {
      return x.id === id;
    })[0];
    if (!r) return;
    state.activeId = id;
    clearRoute();

    var polys;
    try {
      polys = r.route.createPolylines({ polylineOptions: { strokeColor: '#23473D', strokeOpacity: 0.9, strokeWeight: 5 } });
    } catch (_) {
      polys = r.route.createPolylines();
    }
    polys.forEach(function (p) {
      p.setMap(state.map);
    });
    state.polylines = polys;

    var path = r.route.path || [];
    if (path.length) {
      var pin = new state.lib.PinElement({ background: '#BE902F', borderColor: '#8A6414', glyphColor: '#FFFFFF' });
      state.destMarker = new state.lib.AdvancedMarkerElement({ map: state.map, position: path[path.length - 1], title: r.label, content: pinContent(pin) });
      var bounds = new state.lib.LatLngBounds();
      path.forEach(function (pt) {
        bounds.extend(pt);
      });
      bounds.extend(hotel);
      state.map.fitBounds(bounds, 48);
    }
    render();
  }

  function render() {
    resultsEl.textContent = '';
    state.results.forEach(function (r) {
      var li = document.createElement('li');
      li.className = 'planner-result' + (r.id === state.activeId ? ' is-active' : '');

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'planner-result-main';
      btn.setAttribute('aria-pressed', String(r.id === state.activeId));
      btn.addEventListener('click', function () {
        show(r.id);
      });
      var name = document.createElement('span');
      name.className = 'planner-result-name';
      name.textContent = r.label;
      var time = document.createElement('span');
      time.className = 'planner-result-time';
      time.textContent = fmtDuration(r.route.durationMillis);
      btn.appendChild(name);
      btn.appendChild(time);

      var meta = document.createElement('span');
      meta.className = 'planner-result-meta';
      meta.textContent = [cfg.text.modes[r.mode], fmtDistance(r.route.distanceMeters)].filter(Boolean).join(', ');

      var link = document.createElement('a');
      link.className = 'planner-result-link';
      link.href = routeUrl(r.dest, r.mode);
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = cfg.text.openRoute;

      li.appendChild(btn);
      li.appendChild(meta);
      li.appendChild(link);
      resultsEl.appendChild(li);
    });
  }

  function compute(dest, label) {
    var mode = currentMode();
    var id = mode + '|' + dest.toLocaleLowerCase();
    setStatus(cfg.text.loading);
    var cached = state.cache[id];
    var work = cached
      ? Promise.resolve(cached)
      : state.lib.Route.computeRoutes({
          origin: hotel,
          destination: dest,
          travelMode: mode,
          region: 'tr',
          fields: ['path', 'distanceMeters', 'durationMillis'],
        }).then(function (res) {
          var route = res && res.routes && res.routes[0];
          if (route && route.path && route.path.length) state.cache[id] = route;
          return route;
        });

    return work
      .then(function (route) {
        if (!route || !route.path || !route.path.length) {
          setStatus(cfg.text.notFound, true);
          return;
        }
        setStatus('');
        state.results = state.results.filter(function (x) {
          return x.id !== id;
        });
        state.results.unshift({ id: id, dest: dest, label: label, mode: mode, route: route });
        state.results = state.results.slice(0, MAX_RESULTS);
        show(id);
      })
      .catch(function (err) {
        console.warn('[rota]', err);
        setStatus(cfg.text.error, true);
      });
  }

  function markChip(chip) {
    root.querySelectorAll('.chip[data-dest]').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c === chip));
    });
  }

  /* Hazır yerler: harita hazırsa sayfada hesapla, değilse bağlantı Google Haritalar'ı açar */
  root.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip[data-dest]');
    if (!chip || !state.ready) return;
    e.preventDefault();
    markChip(chip);
    compute(chip.getAttribute('data-dest'), chip.getAttribute('data-label'));
  });

  form.addEventListener('submit', function (e) {
    if (!state.ready) return;
    e.preventDefault();
    var v = input.value.trim();
    if (!v) return;
    markChip(null);
    compute(v, v);
  });

  form.addEventListener('change', function (e) {
    if (e.target.name !== 'travelmode' || !state.ready || !state.activeId) return;
    var active = state.results.filter(function (x) {
      return x.id === state.activeId;
    })[0];
    if (active) compute(active.dest, active.label);
  });

  /* Harita, bölüm ekrana yaklaşınca yüklensin (gereksiz API kullanımını önler) */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) {
          io.disconnect();
          init();
        }
      },
      { rootMargin: '300px 0px' }
    );
    io.observe(root);
  } else {
    init();
  }
})();
