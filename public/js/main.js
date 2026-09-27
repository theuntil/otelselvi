(function () {
  'use strict';

  /* ---------- Mobil menü ---------- */
  var header = document.querySelector('[data-header]');
  var toggle = document.querySelector('[data-nav-toggle]');
  if (header && toggle) {
    var setOpen = function (open) {
      header.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? toggle.getAttribute('data-label-close') : toggle.getAttribute('data-label-open'));
    };
    toggle.addEventListener('click', function () {
      setOpen(!header.classList.contains('is-open'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    header.querySelectorAll('.site-nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        setOpen(false);
      });
    });
  }

  /* ---------- Rota planlayıcı (anahtarsız mod): hazır yerler seçili ulaşım türüyle açılsın ---------- */
  document.querySelectorAll('[data-planner-form]').forEach(function (form) {
    var chips = form.querySelectorAll('.chip[data-dest]');
    var sync = function () {
      var mode = (form.querySelector('input[name="travelmode"]:checked') || {}).value || 'driving';
      chips.forEach(function (chip) {
        var url = new URL(chip.href);
        url.searchParams.set('travelmode', mode);
        chip.href = url.toString();
      });
    };
    form.addEventListener('change', sync);
    sync();
  });

  /* ---------- Formlar ---------- */
  function phoneOk(v) {
    if (!v) return true;
    if (!/^[+\d\s().-]+$/.test(v)) return false;
    var d = v.replace(/\D/g, '');
    return d.length >= 8 && d.length <= 15;
  }

  function setError(form, name, message) {
    var el = form.querySelector('[data-error-for="' + name + '"]');
    var input = form.querySelector('[name="' + name + '"]');
    if (el) el.textContent = message || '';
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function clearErrors(form) {
    form.querySelectorAll('[data-error-for]').forEach(function (el) {
      el.textContent = '';
    });
    form.querySelectorAll('[aria-invalid]').forEach(function (el) {
      el.removeAttribute('aria-invalid');
    });
  }

  function validateField(form, messages, input) {
    var name = input.name;
    if (!name || input.type === 'hidden' || name === 'website') return true;
    if (input.closest('[hidden]')) {
      setError(form, name, '');
      return true;
    }
    var ok = input.checkValidity();
    if (ok && input.type === 'tel') ok = phoneOk(input.value.trim());
    if (ok && (input.type === 'text' || input.tagName === 'TEXTAREA') && input.required) {
      ok = input.value.trim().length >= (parseInt(input.getAttribute('minlength'), 10) || 1);
    }
    if (ok && name === 'cikis') {
      var start = form.querySelector('[name="giris"]');
      if (start && start.value && input.value && input.value <= start.value) ok = false;
    }
    var missing = input.validity && input.validity.valueMissing;
    var msg = (missing && messages[name + '_required']) || messages[name] || '';
    setError(form, name, ok ? '' : msg);
    return ok;
  }

  function showStatus(form, ok, message) {
    var box = form.querySelector('[data-form-status]');
    if (!box) return;
    box.hidden = false;
    box.className = 'alert ' + (ok ? 'alert--success' : 'alert--error');
    box.textContent = message;
  }

  function showSuccess(form, title, message) {
    var wrap = document.createElement('div');
    wrap.className = 'form-success';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('tabindex', '-1');
    var h = document.createElement('h3');
    h.className = 'h3';
    h.textContent = title;
    var p = document.createElement('p');
    p.textContent = message;
    wrap.appendChild(h);
    wrap.appendChild(p);
    form.replaceWith(wrap);
    wrap.focus();
  }

  document.querySelectorAll('[data-form]').forEach(function (form) {
    var messages = {};
    try {
      messages = JSON.parse(form.getAttribute('data-messages') || '{}');
    } catch (_) {}
    var submit = form.querySelector('[data-submit]');
    var busy = false;

    var topic = form.querySelector('[data-topic]');
    var reservation = form.querySelector('[data-reservation]');
    if (topic && reservation) {
      var syncTopic = function () {
        reservation.hidden = topic.value !== 'rezervasyon';
      };
      topic.addEventListener('change', syncTopic);
      syncTopic();
    }

    var start = form.querySelector('[data-date-start]');
    var end = form.querySelector('[data-date-end]');
    if (start && end) {
      start.addEventListener('change', function () {
        if (!start.value) return;
        var d = new Date(start.value + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + 1);
        end.min = d.toISOString().slice(0, 10);
        if (end.value && end.value <= start.value) end.value = '';
      });
    }

    form.querySelectorAll('input, select, textarea').forEach(function (input) {
      input.addEventListener('blur', function () {
        if (input.value || input.type === 'checkbox') validateField(form, messages, input);
      });
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true') validateField(form, messages, input);
      });
      input.addEventListener('change', function () {
        if (input.getAttribute('aria-invalid') === 'true' || input.type === 'checkbox') validateField(form, messages, input);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;

      clearErrors(form);
      var firstInvalid = null;
      form.querySelectorAll('input, select, textarea').forEach(function (input) {
        if (!validateField(form, messages, input) && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) {
        showStatus(form, false, form.getAttribute('data-summary'));
        firstInvalid.focus();
        return;
      }

      busy = true;
      var label = submit.textContent;
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      submit.textContent = form.getAttribute('data-sending');

      fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams(new FormData(form)).toString(),
        credentials: 'same-origin'
      })
        .then(function (res) {
          return res.json().catch(function () {
            return { ok: false, message: form.getAttribute('data-unexpected') };
          });
        })
        .then(function (data) {
          if (data.ok) {
            showSuccess(form, form.getAttribute('data-success-title'), data.message);
            return;
          }
          var first = null;
          if (data.errors) {
            Object.keys(data.errors).forEach(function (name) {
              setError(form, name, data.errors[name]);
              if (!first) first = form.querySelector('[name="' + name + '"]');
            });
          }
          showStatus(form, false, data.message || form.getAttribute('data-unexpected'));
          if (first) first.focus();
        })
        .catch(function () {
          showStatus(form, false, form.getAttribute('data-network'));
        })
        .then(function () {
          busy = false;
          if (document.body.contains(submit)) {
            submit.disabled = false;
            submit.removeAttribute('aria-busy');
            submit.textContent = label;
          }
        });
    });
  });
})();
