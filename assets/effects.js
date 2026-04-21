/* SimVida site effects: scroll-triggered reveals + screenshot lightbox.
   Degrades cleanly without JS (content is visible by default; reveal
   classes start hidden so we guard on a root class that JS sets). */

(function () {
  'use strict';

  var root = document.documentElement;
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Mobile nav toggle ---------- */
  var navInner = document.querySelector('.nav .nav-inner');
  var navEl = navInner && navInner.querySelector('nav');
  if (navInner && navEl) {
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-label', 'Open menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'nav-primary');
    toggle.innerHTML = '<span></span><span></span><span></span>';
    navEl.setAttribute('id', 'nav-primary');
    navInner.insertBefore(toggle, navEl);

    function closeNav() {
      navEl.classList.remove('is-open');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    }
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !navEl.classList.contains('is-open');
      navEl.classList.toggle('is-open', open);
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    navEl.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeNav);
    });
    document.addEventListener('click', function (e) {
      if (!navEl.contains(e.target) && !toggle.contains(e.target)) closeNav();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navEl.classList.contains('is-open')) closeNav();
    });
  }

  /* ---------- Cookie consent banner ---------- */
  (function () {
    var STORAGE_KEY = 'simvida-cookie-consent';
    var banner = null;

    function getConsent() {
      try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }
    function setConsent(v) {
      try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {}
    }

    function build() {
      if (banner) return banner;
      banner = document.createElement('aside');
      banner.className = 'cookie-banner';
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-label', 'Cookie preferences');
      banner.setAttribute('aria-live', 'polite');
      banner.innerHTML =
        '<div class="cookie-banner-inner">' +
          '<div class="cookie-banner-body">' +
            '<strong>We use cookies, carefully.</strong>' +
            '<p>Essentials keep the site working. Analytics help us make it better. Nothing else without your say-so.</p>' +
            '<p class="cookie-meta"><a href="privacy.html">Read the policy</a></p>' +
          '</div>' +
          '<div class="cookie-banner-actions">' +
            '<button type="button" class="btn btn-ghost cookie-reject">Essential only</button>' +
            '<button type="button" class="btn btn-primary cookie-accept">Accept all</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(banner);
      banner.querySelector('.cookie-accept').addEventListener('click', function () {
        setConsent('all'); hide();
      });
      banner.querySelector('.cookie-reject').addEventListener('click', function () {
        setConsent('essential'); hide();
      });
      return banner;
    }

    function show() {
      build();
      requestAnimationFrame(function () { banner.classList.add('is-open'); });
    }
    function hide() { if (banner) banner.classList.remove('is-open'); }

    if (!getConsent()) {
      setTimeout(show, 900);
    }

    // Allow re-opening from a [data-cookie-prefs] link anywhere on the page.
    document.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('[data-cookie-prefs]');
      if (link) {
        e.preventDefault();
        show();
      }
    });

    // Inject "Cookie preferences" into every footer's Legal column.
    document.querySelectorAll('.footer h4').forEach(function (h4) {
      if ((h4.textContent || '').trim() !== 'Legal') return;
      var ul = h4.parentElement.querySelector('ul');
      if (!ul || ul.querySelector('[data-cookie-prefs]')) return;
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#';
      a.setAttribute('data-cookie-prefs', '');
      a.textContent = 'Cookie preferences';
      li.appendChild(a);
      ul.appendChild(li);
    });
  })();

  /* ---------- Article TOC (auto-generated from h2s in .article-body) ---------- */
  var articleBody = document.querySelector('.article-body');
  if (articleBody) {
    var h2s = articleBody.querySelectorAll('h2');
    if (h2s.length >= 2) {
      var toc = document.createElement('nav');
      toc.className = 'article-toc';
      toc.setAttribute('aria-label', 'In this guide');
      var label = document.createElement('span');
      label.className = 'article-toc-label';
      label.textContent = 'In this guide';
      toc.appendChild(label);
      var ol = document.createElement('ol');
      h2s.forEach(function (h2, i) {
        var id = h2.id || ('section-' + (i + 1));
        h2.id = id;
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + id;
        a.textContent = (h2.textContent || '').replace(/\.$/, '');
        li.appendChild(a);
        ol.appendChild(li);
      });
      toc.appendChild(ol);
      articleBody.insertBefore(toc, articleBody.firstChild);
    }
  }

  /* ---------- Scroll reveals ---------- */
  root.classList.add('js-ready');

  if (prefersReduced || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal, .reveal-stagger').forEach(function (el) {
      el.classList.add('is-visible');
    });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    document.querySelectorAll('.reveal, .reveal-stagger').forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---------- Hero focus interaction ("Your money, finally" sharpens) ---------- */
  (function () {
    var hero = document.querySelector('.hero');
    var h1 = hero && hero.querySelector('h1');
    var fuzzy = hero && hero.querySelector('h1 .fuzzy');
    if (!hero || !fuzzy) return;
    if (prefersReduced) return;

    var FOCUS_RADIUS = 260;   // within this = fully sharp
    var BLUR_RADIUS  = 560;   // at/beyond this = max blur
    var MAX_BLUR     = 4;
    var REST_BLUR    = 2;
    var locked = false;       // true while the cursor is over a CTA, the H1, or the lede

    function setBlur(px) {
      fuzzy.style.setProperty('--fuzzy-blur', px.toFixed(1) + 'px');
    }

    hero.addEventListener('pointermove', function (e) {
      if (locked || e.pointerType === 'touch') return;
      var rect = h1.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      var norm = (dist - FOCUS_RADIUS) / (BLUR_RADIUS - FOCUS_RADIUS);
      var blur = Math.max(0, Math.min(MAX_BLUR, norm * MAX_BLUR));
      setBlur(blur);
    });
    hero.addEventListener('pointerleave', function () {
      if (!locked) setBlur(REST_BLUR);
    });

    // Hover over the H1, the lede, or any CTA locks the text fully sharp.
    var lockers = hero.querySelectorAll('h1, .hero-lede, .btn-row a, .btn');
    lockers.forEach(function (el) {
      el.addEventListener('pointerenter', function () { locked = true; setBlur(0); });
      el.addEventListener('pointerleave', function () { locked = false; });
      el.addEventListener('focus',        function () { locked = true; setBlur(0); });
      el.addEventListener('blur',         function () { locked = false; setBlur(REST_BLUR); });
    });
  })();

  /* ---------- Contact form (mailto fallback) ---------- */
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    var routeMap = {
      General: 'support', Support: 'support', Advisor: 'support',
      Privacy: 'privacy', Security: 'security', Press: 'press',
      Partnership: 'support'
    };
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = contactForm.querySelector('#f-name').value.trim();
      var email = contactForm.querySelector('#f-email').value.trim();
      var reason = contactForm.querySelector('#f-reason').value;
      var message = contactForm.querySelector('#f-message').value.trim();
      if (!name || !email || !message) {
        contactForm.querySelectorAll('[required]').forEach(function (el) {
          if (!el.value.trim()) el.focus();
        });
        return;
      }
      var routeTo = (routeMap[reason] || 'support') + '@simvida.com';
      var subject = '[' + reason + '] message from ' + name;
      var body = message + '\n\n—\nFrom: ' + name + ' <' + email + '>';
      var href = 'mailto:' + routeTo + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      window.location.href = href;
      var success = document.getElementById('contact-success');
      if (success) success.classList.add('is-shown');
    });
  }

  /* ---------- Lightbox ---------- */
  var triggers = document.querySelectorAll('[data-lightbox]');
  if (!triggers.length) return;

  var overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML =
    '<button type="button" class="lightbox-close" aria-label="Close">\u00d7</button>' +
    '<img alt="" />';
  document.body.appendChild(overlay);

  var overlayImg = overlay.querySelector('img');
  var closeBtn = overlay.querySelector('.lightbox-close');
  var lastTrigger = null;

  function open(src, alt, trigger) {
    overlayImg.src = src;
    overlayImg.alt = alt || '';
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    lastTrigger = trigger || null;
    setTimeout(function () { closeBtn.focus(); }, 0);
  }
  function close() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
    lastTrigger = null;
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      var src = trigger.getAttribute('data-lightbox');
      var innerImg = trigger.querySelector('img');
      var alt = innerImg ? innerImg.alt : '';
      open(src, alt, trigger);
    });
  });

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });
})();
