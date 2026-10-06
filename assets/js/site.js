/* AD 007 – skripty webu (bez knižníc).
   Načítava sa s atribútom `defer`, takže beží až po načítaní HTML vo všetkých
   prehliadačoch rovnako. Stránka funguje aj bez JavaScriptu – skript ju len vylepšuje. */
(function () {
  'use strict';

  var doc = document;
  var preview = window.__SITE_PREVIEW__ || null;   // nastavuje editor pri náhľade
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  // potiahnutie prstom doľava/doprava. h.move(dx) – počas vodorovného ťahania (nepovinné),
  // h.end(dx, v) – po pustení: posun v px a rýchlosť v px/ms (0, ak pohyb nebol vodorovný).
  // Vodorovný pohyb prsta by si inak vzal prehliadač na posúvanie stránky (prišlo by pointercancel
  // namiesto pointerup) – CSS mu preto na týchto miestach nechá len zvislé posúvanie (touch-action: pan-y).
  function onSwipe(el, mouseToo, h) {
    var x = null, y = 0, t = 0, drag = false, at = 0;
    el.addEventListener('pointerdown', function (e) {
      if (e.isPrimary && (mouseToo || e.pointerType !== 'mouse')) { x = e.clientX; y = e.clientY; t = e.timeStamp; drag = false; }
    });
    el.addEventListener('pointermove', function (e) {
      if (x === null || !h.move || !e.isPrimary) return;
      var dx = e.clientX - x;
      if (!drag && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - y)) drag = true;
      if (drag) h.move(dx);
    });
    el.addEventListener('pointercancel', function () {
      if (x !== null && drag) h.end(0, 0);       // prehliadač si gesto vzal (napr. zvislé posúvanie)
      x = null;
    });
    el.addEventListener('pointerup', function (e) {
      if (x === null || !e.isPrimary) return;
      var dx = e.clientX - x, dy = e.clientY - y;
      var flat = drag || Math.abs(dx) > Math.abs(dy) * 1.2;
      x = null;
      if (flat && (drag || Math.abs(dx) > 40)) at = Date.now();
      h.end(flat ? dx : 0, flat ? dx / Math.max(1, e.timeStamp - t) : 0);
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
      b.addEventListener('click', function () { slideTo(i); restart(); });
      dots.appendChild(b);
      return b;
    });
    function arrow(cls, label, path, step) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'hero-arrow ' + cls;
      b.setAttribute('aria-label', label);
      b.innerHTML = icon(path);
      b.addEventListener('click', function () { slideBy(step); restart(); });
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
      if (reduceMotion || preview || paused || stopped || held) return;
      // automatické prepínanie ostáva pomalé prelínanie (go), ručné je rýchly posun (slideTo)
      timer = setInterval(function () { if (!doc.hidden) { if (finishing) finishing(); go(current + 1); } }, delay);
    }

    /* ručné prepnutie – potiahnutie prstom, šípky, bodky, klávesy: celá snímka sa rýchlo posunie
       do strany a susedná príde za ňou; pri ťahaní ide snímka priamo za prstom */
    var held = false;          // prst práve ťahá snímku
    var finishing = null;      // dokončí rozbehnutý posun (keď príde ďalší pokyn skôr)
    var dragD = 0;             // smer ťahania: 1 = k ďalšej snímke, -1 k predchádzajúcej
    function idx(n) { return (n + slides.length) % slides.length; }
    function place(s, x, ms) {
      s.style.transition = ms ? 'transform ' + ms + 'ms cubic-bezier(.2, .8, .2, 1)' : 'none';
      s.style.transform = 'translateX(' + x + 'px)';
    }
    function rest(s) {         // snímka späť do pokoja, bez animácie
      s.style.transition = 'none';
      s.classList.remove('is-peek');
      s.style.transform = '';
      void s.offsetWidth;
      s.style.transition = '';
    }
    function peek(i, x) { place(slides[i], x, 0); slides[i].classList.add('is-peek'); }
    // n = cieľová snímka, d = smer (1 = príde sprava), from = doterajší posun prstom
    function slideTo(n, d, from) {
      if (finishing) finishing();
      n = idx(n);
      if (n === current) return;
      d = d || (n > current ? 1 : -1);
      from = from || 0;
      var cur = slides[current], nxt = slides[n], W = root.clientWidth || 1;
      peek(n, d * W + from);
      place(cur, from, 0);
      void nxt.offsetWidth;
      var ms = Math.round(Math.max(200, 420 * (1 - Math.abs(from) / W)));   // zvyšok dráhy, nie celá
      place(cur, -d * W, ms);
      place(nxt, 0, ms);
      var t = setTimeout(done, ms + 40);
      function done() {
        clearTimeout(t);
        finishing = null;
        cur.style.transition = 'none';   // odchádzajúca snímka zmizne hneď, bez prelínania
        go(n);
        rest(cur);
        rest(nxt);
      }
      finishing = done;
    }
    function slideBy(step) { if (finishing) finishing(); slideTo(current + step, step); }

    root.addEventListener('mouseenter', function () { paused = true; restart(); });
    root.addEventListener('mouseleave', function () { paused = false; restart(); });
    root.addEventListener('focusin', function () { paused = true; restart(); });
    root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget)) { paused = false; restart(); } });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') slideBy(-1);
      if (e.key === 'ArrowRight') slideBy(1);
    });
    onSwipe(root, false, {
      move: function (dx) {
        if (finishing) finishing();
        held = true;
        clearInterval(timer);
        var d = dx < 0 ? 1 : -1, W = root.clientWidth || 1;
        if (d !== dragD) {             // zmena smeru: z druhej strany príde iná snímka
          if (dragD) rest(slides[idx(current + dragD)]);
          dragD = d;
        }
        place(slides[current], dx, 0);
        peek(idx(current + d), d * W + dx);
      },
      end: function (dx, v) {
        var d = dragD, W = root.clientWidth || 1;
        dragD = 0;
        held = false;
        if (d && (dx < 0 ? 1 : -1) === d && (Math.abs(dx) > W * 0.2 || (Math.abs(v) > 0.35 && Math.abs(dx) > 20))) {
          slideTo(current + d, d, dx);   // dosť ďaleko alebo rýchlo → dobehne na susednú snímku
        } else if (d) {                  // krátke potiahnutie: snímka sa vráti na miesto
          var cur = slides[current], nb = slides[idx(current + d)];
          var back = function () { clearTimeout(t); finishing = null; rest(cur); rest(nb); };
          place(cur, 0, 220);
          place(nb, d * W, 220);
          var t = setTimeout(back, 260);
          finishing = back;
        } else if (Math.abs(dx) > 40) {  // rýchle švihnutie bez ťahania
          slideBy(dx < 0 ? 1 : -1);
        }
        restart();
      }
    });

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
    box.querySelector('.lb-prev').addEventListener('click', function () { show(boxIndex - 1, -1); });
    box.querySelector('.lb-next').addEventListener('click', function () { show(boxIndex + 1, 1); });
    box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(boxIndex - 1, -1);
      if (e.key === 'ArrowRight') show(boxIndex + 1, 1);
    });
    onSwipe(box, true, { end: function (dx) { if (Math.abs(dx) > 40) show(boxIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); } });
  }
  // d = smer (1 ďalší, -1 predchádzajúci): nový obrázok krátko vkĺzne z tej strany
  function show(i, d) {
    boxIndex = (i + boxItems.length) % boxItems.length;
    var el = boxItems[boxIndex];
    var img = box.querySelector('img');
    img.src = el.getAttribute('data-full');
    img.alt = el.getAttribute('data-caption') || '';
    img.classList.remove('lb-in-next', 'lb-in-prev');
    if (d) { void img.offsetWidth; img.classList.add(d > 0 ? 'lb-in-next' : 'lb-in-prev'); }
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
