/* AD 007 – skripty webu (bez knižníc).
   Načítava sa s atribútom `defer`, takže beží až po načítaní HTML vo všetkých
   prehliadačoch rovnako. Stránka funguje aj bez JavaScriptu – skript ju len vylepšuje. */
(function () {
  'use strict';

  var doc = document;
  var preview = window.__SITE_PREVIEW__ || null;   // nastavuje editor pri náhľade
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  // potiahnutie prstom doľava/doprava: fn(1) = ďalší, fn(-1) = predchádzajúci.
  // Vodorovný pohyb prsta by si inak vzal prehliadač na posúvanie stránky (prišlo by pointercancel
  // namiesto pointerup) – CSS mu preto na týchto miestach nechá len zvislé posúvanie (touch-action: pan-y).
  function onSwipe(el, mouseToo, fn) {
    var x = null, y = 0, at = 0;
    el.addEventListener('pointerdown', function (e) {
      if (e.isPrimary && (mouseToo || e.pointerType !== 'mouse')) { x = e.clientX; y = e.clientY; }
    });
    el.addEventListener('pointercancel', function () { x = null; });
    el.addEventListener('pointerup', function (e) {
      if (x === null) return;
      var dx = e.clientX - x, dy = e.clientY - y;
      x = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) { at = Date.now(); fn(dx < 0 ? 1 : -1); }
    });
    // kliknutie tesne po potiahnutí (prst začal napr. na tlačidle) sa nepočíta
    el.addEventListener('click', function (e) {
      if (Date.now() - at < 400) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }
  function icon(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  /* ---------- hlavička: tieň po odscrollovaní ---------- */
  var header = doc.querySelector('.site-header');
  var toTop = doc.querySelector('.to-top');
  function onScroll() {
    var y = window.pageYOffset || doc.documentElement.scrollTop;
    if (header) header.classList.toggle('is-scrolled', y > 10);
    if (toTop) toTop.classList.toggle('is-visible', y > 500);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobilné menu ---------- */
  var navToggle = doc.querySelector('.nav-toggle');
  function setNav(open) {
    if (!header || !navToggle) return;
    header.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (navToggle) {
    navToggle.addEventListener('click', function () { setNav(!header.classList.contains('nav-open')); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) { setNav(false); navToggle.focus(); }
    });
    doc.addEventListener('click', function (e) {
      if (header.classList.contains('nav-open') && !header.contains(e.target)) setNav(false);
    });
  }

  /* ---------- podmenu (Produkty) ---------- */
  $all('.sub-toggle').forEach(function (btn) {
    var li = btn.parentNode;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !li.classList.contains('is-open');
      $all('.has-sub.is-open').forEach(function (o) { if (o !== li) { o.classList.remove('is-open'); o.querySelector('.sub-toggle').setAttribute('aria-expanded', 'false'); } });
      li.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    li.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && li.classList.contains('is-open')) { li.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    });
  });
  doc.addEventListener('click', function (e) {
    $all('.has-sub.is-open').forEach(function (li) {
      if (!li.contains(e.target)) { li.classList.remove('is-open'); li.querySelector('.sub-toggle').setAttribute('aria-expanded', 'false'); }
    });
  });

  /* ---------- slider ---------- */
  $all('[data-slider]').forEach(function (root) {
    var slides = $all('.slide', root);
    if (slides.length < 2) return;
    var current = 0;
    var timer = null;
    var paused = false;       // myš alebo fokus na slideri
    var stopped = false;      // návštevník prepínanie zastavil tlačidlom
    var delay = Math.max(3, Math.min(30, +root.getAttribute('data-delay') || 6)) * 1000;

    var dots = doc.createElement('div');
    dots.className = 'hero-dots';
    // tlačidlo na zastavenie automatického prepínania (len keď sa naozaj prepína)
    if (!reduceMotion && !preview) {
      var pause = doc.createElement('button');
      pause.type = 'button';
      pause.className = 'hero-pause';
      var setPause = function () {
        pause.setAttribute('aria-label', stopped ? 'Spustiť automatické prepínanie snímok' : 'Zastaviť automatické prepínanie snímok');
        pause.innerHTML = icon(stopped ? '<path d="M8 5v14l11-7z"/>' : '<path d="M9 5v14M15 5v14"/>');
      };
      pause.addEventListener('click', function () { stopped = !stopped; setPause(); restart(); });
      setPause();
      dots.appendChild(pause);
    }
    var dotButtons = slides.map(function (s, i) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Snímka ' + (i + 1) + ' z ' + slides.length);
      b.addEventListener('click', function () { go(i); restart(); });
      dots.appendChild(b);
      return b;
    });
    function arrow(cls, label, path, step) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'hero-arrow ' + cls;
      b.setAttribute('aria-label', label);
      b.innerHTML = icon(path);
      b.addEventListener('click', function () { go(current + step); restart(); });
      root.appendChild(b);
    }
    arrow('hero-prev', 'Predchádzajúca snímka', '<path d="M15 4 7 12l8 8"/>', -1);
    arrow('hero-next', 'Ďalšia snímka', '<path d="m9 4 8 8-8 8"/>', 1);
    root.appendChild(dots);

    function go(n) {
      current = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        var on = i === current;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
        if ('inert' in s) s.inert = !on;
      });
      dotButtons.forEach(function (b, i) { b.setAttribute('aria-current', i === current ? 'true' : 'false'); });
    }
    function restart() {
      clearInterval(timer);
      if (reduceMotion || preview || paused || stopped) return;
      timer = setInterval(function () { if (!doc.hidden) go(current + 1); }, delay);
    }
    root.addEventListener('mouseenter', function () { paused = true; restart(); });
    root.addEventListener('mouseleave', function () { paused = false; restart(); });
    root.addEventListener('focusin', function () { paused = true; restart(); });
    root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget)) { paused = false; restart(); } });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { go(current - 1); }
      if (e.key === 'ArrowRight') { go(current + 1); }
    });
    onSwipe(root, false, function (d) { go(current + d); restart(); });

    go(preview && preview.slide != null ? Math.min(preview.slide, slides.length - 1) : 0);
    restart();
  });

  /* ---------- galéria / lightbox ---------- */
  var groups = {};
  $all('[data-lightbox]').forEach(function (el) {
    var g = el.getAttribute('data-lightbox');
    (groups[g] = groups[g] || []).push(el);
  });
  var box = null;
  var boxItems = [];
  var boxIndex = 0;
  function buildBox() {
    box = doc.createElement('dialog');
    box.className = 'lightbox';
    box.setAttribute('aria-label', 'Prehliadač obrázkov');
    box.innerHTML =
      '<img alt=""><p></p>' +
      '<button type="button" class="lb-btn lb-close" aria-label="Zavrieť">' + icon('<path d="M6 6l12 12M18 6 6 18"/>') + '</button>' +
      '<button type="button" class="lb-btn lb-prev" aria-label="Predchádzajúci obrázok">' + icon('<path d="M15 4 7 12l8 8"/>') + '</button>' +
      '<button type="button" class="lb-btn lb-next" aria-label="Ďalší obrázok">' + icon('<path d="m9 4 8 8-8 8"/>') + '</button>';
    doc.body.appendChild(box);
    box.querySelector('.lb-close').addEventListener('click', function () { box.close(); });
    box.querySelector('.lb-prev').addEventListener('click', function () { show(boxIndex - 1); });
    box.querySelector('.lb-next').addEventListener('click', function () { show(boxIndex + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(boxIndex - 1);
      if (e.key === 'ArrowRight') show(boxIndex + 1);
    });
    onSwipe(box, true, function (d) { show(boxIndex + d); });
  }
  function show(i) {
    boxIndex = (i + boxItems.length) % boxItems.length;
    var el = boxItems[boxIndex];
    var img = box.querySelector('img');
    img.src = el.getAttribute('data-full');
    img.alt = el.getAttribute('data-caption') || '';
    box.querySelector('p').textContent = el.getAttribute('data-caption') || '';
    var multi = boxItems.length > 1;
    box.querySelector('.lb-prev').hidden = !multi;
    box.querySelector('.lb-next').hidden = !multi;
  }
  Object.keys(groups).forEach(function (g) {
    groups[g].forEach(function (el, i) {
      el.addEventListener('click', function (e) {
        if (typeof HTMLDialogElement === 'undefined') return;   // veľmi starý prehliadač → otvorí obrázok priamo
        e.preventDefault();
        if (!box) buildBox();
        boxItems = groups[g];
        show(i);
        box.showModal();
      });
    });
  });

  /* ---------- tlačidlo hore ---------- */
  if (toTop) {
    toTop.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      var skip = doc.querySelector('.skip-link');
      if (skip) skip.focus({ preventScroll: true });
    });
  }

  /* ---------- objednávkový formulár ---------- */
  $all('form[data-mode]').forEach(function (form) {
    var mode = form.getAttribute('data-mode');
    var status = form.querySelector('.form-status');
    function say(msg, ok) {
      status.textContent = msg;
      status.className = 'form-status ' + (ok ? 'ok' : 'err');
    }
    function val(name) { var el = form.elements[name]; return el ? el.value.trim() : ''; }

    form.addEventListener('submit', function (e) {
      if (preview) { e.preventDefault(); say('Toto je náhľad – formulár sa neodosiela.', true); return; }
      if (!form.checkValidity()) return;        // prehliadač ukáže, čo chýba
      if (val('web')) { e.preventDefault(); return; }   // pasca na roboty

      if (mode === 'mailto') {
        e.preventDefault();
        var lines = [
          form.getAttribute('data-l-order') + ': ' + val('objednavka'),
          form.getAttribute('data-l-qty') + ': ' + val('mnozstvo'),
          form.getAttribute('data-l-name') + ': ' + val('meno'),
          form.getAttribute('data-l-email') + ': ' + val('email'),
          form.getAttribute('data-l-phone') + ': ' + val('telefon')
        ];
        var to = form.getAttribute('data-to');
        var subject = form.getAttribute('data-subject') + ' – ' + val('meno');
        window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
        say(form.getAttribute('data-mailto-msg'), true);
        return;
      }

      // php / url: odoslanie na pozadí, bez opustenia stránky
      if (!window.fetch || !window.FormData) return;
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]');
      if (btn) btn.disabled = true;
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }).then(function (j) { return { ok: r.ok && j.ok !== false, j: j }; }); })
        .then(function (res) {
          if (res.ok) { form.reset(); say(form.getAttribute('data-ok-msg'), true); }
          else say((res.j && res.j.message) || form.getAttribute('data-err-msg'), false);
        })
        .catch(function () { say(form.getAttribute('data-err-msg'), false); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  });
})();
