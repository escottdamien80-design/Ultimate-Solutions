/* Ultimate Solutions - small, dependency-free behaviour:
   1) mobile menu  2) footer year  3) quote form validation + sending */
(function () {
  'use strict';

  /* ---------- 1. Mobile menu ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
    });
  }

  /* ---------- 2. Footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- 3. Quote form ---------- */
  var form = document.getElementById('quote-form');
  if (!form) return;

  var MAX_FILES = 5;
  var MAX_BYTES = 5 * 1024 * 1024;
  var UK_POSTCODE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;
  var status = document.getElementById('form-status');
  var photos = document.getElementById('q-photos');
  var fileList = document.getElementById('q-photos-list');

  // The form is "connected" once action="" points at a real form service (not the .invalid placeholder).
  var isConnected = function () { return !/\.invalid(\/|$)/.test(form.getAttribute('action') || ''); };

  function showError(id, msg) {
    var err = document.getElementById(id + '-err');
    var field = document.getElementById(id);
    if (err) { err.textContent = msg; err.hidden = !msg; }
    if (field) { if (msg) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid'); }
  }

  function showStatus(kind, msg) {
    status.hidden = !msg;
    status.className = 'form-status' + (kind ? ' is-' + kind : '');
    status.textContent = msg || '';
  }

  /* Returns [ [fieldId, message], ... ] for every problem found. */
  function validate() {
    var problems = [];
    var v = function (n) { return form.elements[n].value.trim(); };

    if (!v('name')) problems.push(['q-name', 'Please tell us your name.']);

    var phoneDigits = v('phone').replace(/\D/g, '');
    if (!v('phone')) problems.push(['q-phone', 'Please give us a phone number.']);
    else if (phoneDigits.length < 10 || phoneDigits.length > 13) problems.push(['q-phone', 'That phone number doesn’t look right.']);

    if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) problems.push(['q-email', 'That email address doesn’t look right.']);

    if (!v('postcode')) problems.push(['q-postcode', 'Please enter your postcode.']);
    else if (!UK_POSTCODE.test(v('postcode'))) problems.push(['q-postcode', 'Please enter a full UK postcode, e.g. CW1 2AB.']);

    if (!form.querySelector('input[name="project"]:checked')) problems.push(['q-type', 'Please choose kitchen, bathroom or both.']);

    var files = Array.prototype.slice.call(photos.files || []);
    if (files.length > MAX_FILES) problems.push(['q-photos', 'Please choose no more than ' + MAX_FILES + ' photos.']);
    else if (files.some(function (f) { return !/^image\//.test(f.type); })) problems.push(['q-photos', 'Only image files can be added.']);
    else if (files.some(function (f) { return f.size > MAX_BYTES; })) problems.push(['q-photos', 'Each photo must be under 5 MB.']);

    return problems;
  }

  function clearErrors() {
    ['q-name', 'q-phone', 'q-email', 'q-postcode', 'q-type', 'q-photos'].forEach(function (id) { showError(id, ''); });
  }

  photos.addEventListener('change', function () {
    var names = Array.prototype.map.call(photos.files, function (f) { return f.name; });
    fileList.textContent = names.length ? 'Selected: ' + names.join(', ') : '';
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    showStatus('', '');

    var problems = validate();
    if (problems.length) {
      problems.forEach(function (p) { showError(p[0], p[1]); });
      var first = document.getElementById(problems[0][0]) || form.querySelector('input[name="project"]');
      if (first) first.focus();
      showStatus('error', 'Please check the highlighted details and try again.');
      return;
    }

    // Spam trap filled in: pretend success, send nothing.
    if (form.elements['_gotcha'].value) { showStatus('ok', 'Thanks, we’ll be in touch soon.'); form.reset(); return; }

    if (!isConnected()) {
      // Be honest: nothing is sent until a form service is configured.
      showStatus('warn', 'This form isn’t connected yet, so your enquiry has NOT been sent. Please call 07702 782875 instead.');
      return;
    }

    var button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    showStatus('', 'Sending…');
    status.hidden = false;

    fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.reset();
        fileList.textContent = '';
        showStatus('ok', 'Thank you, your enquiry has been sent. We’ll be in touch soon.');
      })
      .catch(function () {
        showStatus('error', 'Sorry, something went wrong and your enquiry was not sent. Please call 07702 782875.');
      })
      .then(function () { button.disabled = false; });
  });
})();
