// Mobius Systems — klein script voor menu, animatie en contactformulier.
(function () {
  'use strict';

  // Mobiel menu
  var toggle = document.querySelector('[data-menu-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    var label = toggle.querySelector('[data-menu-label]');
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) nav.setAttribute('data-open', '');
      else nav.removeAttribute('data-open');
      if (label) label.textContent = open ? toggle.dataset.labelClose : toggle.dataset.labelOpen;
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 960px)').addEventListener('change', function (mq) {
      if (mq.matches) setOpen(false);
    });
  }

  // Animatie in de hero stilzetten wie minder beweging wil
  var svg = document.querySelector('[data-hero-svg]');
  if (svg && svg.pauseAnimations && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    svg.pauseAnimations();
  }

  // Contactformulier
  var form = document.querySelector('[data-contact-form]');
  if (!form || !window.fetch) return;

  var started = Date.now();
  var timeField = form.querySelector('[data-form-time]');
  if (timeField) timeField.value = String(started);

  var status = form.querySelector('[data-form-status]');
  var button = form.querySelector('[data-submit]');
  var buttonHtml = button ? button.innerHTML : '';

  var show = function (state, text, withMail) {
    status.setAttribute('data-state', state);
    status.textContent = text;
    if (withMail) {
      var email = form.dataset.email;
      status.appendChild(document.createTextNode(' '));
      var a = document.createElement('a');
      a.href = 'mailto:' + email;
      a.textContent = email;
      status.appendChild(a);
      status.appendChild(document.createTextNode('.'));
    }
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      show('error', form.dataset.msgInvalid);
      return;
    }
    var data = {};
    new FormData(form).forEach(function (v, k) {
      data[k] = typeof v === 'string' ? v.trim() : v;
    });

    button.disabled = true;
    button.textContent = form.dataset.msgSending;
    status.textContent = '';

    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        return res.json().catch(function () {
          return { ok: false };
        });
      })
      .then(function (json) {
        if (json && json.ok) {
          form.reset();
          if (timeField) timeField.value = String(started);
          show('ok', form.dataset.msgOk);
        } else if (json && json.error === 'invalid') {
          show('error', form.dataset.msgInvalid);
        } else {
          show('error', form.dataset.msgFail, true);
        }
      })
      .catch(function () {
        show('error', form.dataset.msgFail, true);
      })
      .then(function () {
        button.disabled = false;
        button.innerHTML = buttonHtml;
      });
  });
})();
