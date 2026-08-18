// AloraAI: sign-up form submission, workflow, hub and nav behaviour.

/* ---------------------------------------------------------------------------
   Sign-up form: posts to /api/signup, swaps the form for a success panel.
   ------------------------------------------------------------------------- */
(function () {
  const form = document.getElementById('signup-form');
  if (!form) return;

  const status = document.getElementById('signup-status');
  const submit = document.getElementById('signup-submit');
  const formWrap = document.getElementById('signup-form-wrap');
  const success = document.getElementById('signup-success');

  const setStatus = (msg, kind) => {
    status.textContent = msg || '';
    status.className = 'form-status' + (kind ? ' ' + kind : '');
  };

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');

    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      organization: form.organization.value.trim(),
      location: form.location.value.trim(),
      linkedin: form.linkedin.value.trim(),
    };

    if (!data.name) return setStatus('Please add your name.', 'error');
    if (!validEmail(data.email)) return setStatus('Please enter a valid work email.', 'error');

    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = 'Sending…';

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || 'Something went wrong. Please try again.');
      }

      formWrap.classList.add('hidden');
      success.classList.remove('hidden');
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      setStatus(err.message || 'Could not reach the server. Please try again.', 'error');
      submit.disabled = false;
      submit.textContent = original;
    }
  });
})();

/* ---------------------------------------------------------------------------
   Workflow: reveal each card as it enters, and keep the sticky left index in
   sync with whichever card is nearest the middle of the viewport.
   ------------------------------------------------------------------------- */
(function () {
  const cards = Array.from(document.querySelectorAll('.flow-card'));
  const items = Array.from(document.querySelectorAll('.flow-index-item'));
  if (!cards.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. reveal on entry (once per card)
  if (!reduced && 'IntersectionObserver' in window) {
    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          reveal.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    cards.forEach((c) => reveal.observe(c));
  } else {
    cards.forEach((c) => c.classList.add('is-in'));
  }

  // 2. scroll-spy: whichever card centre is closest to the viewport centre wins
  if (!items.length) return;

  const setActive = (key) => {
    items.forEach((it) => it.classList.toggle('is-active', it.dataset.target === key));
    cards.forEach((c) => c.classList.toggle('is-current', c.id === key));
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const mid = window.innerHeight / 2;
      let best = null;
      let bestDist = Infinity;
      cards.forEach((c) => {
        const r = c.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) { bestDist = d; best = c; }
      });
      if (best) setActive(best.id);
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  // 3. clicking an index entry scrolls to its card
  items.forEach((it) => {
    it.addEventListener('click', (e) => {
      const target = document.getElementById(it.dataset.target);
      if (!target) return;
      e.preventDefault();
      const y = window.scrollY + target.getBoundingClientRect().top
              - (window.innerHeight - target.offsetHeight) / 2;
      window.scrollTo({ top: Math.max(0, y), behavior: reduced ? 'auto' : 'smooth' });
    });
  });
})();

/* ---------------------------------------------------------------------------
   Hero agent card: cross-fades between what Alora surfaces during a call.
   All lines are already in the DOM, stacked in one grid cell, so switching
   costs no layout.
   ------------------------------------------------------------------------- */
(function () {
  const lines = Array.from(document.querySelectorAll('.agent-line'));
  if (lines.length < 2) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const FADE_MS = 300;   // must match the CSS transition
  const HOLD_MS = 5200;

  let i = 0;
  setInterval(() => {
    // Fade the current line fully out BEFORE bringing the next one in.
    // Overlapping the two fades renders both messages at once, since they
    // occupy the same grid cell.
    lines[i].classList.remove('is-on');
    setTimeout(() => {
      i = (i + 1) % lines.length;
      lines[i].classList.add('is-on');
    }, FADE_MS + 40);
  }, HOLD_MS);
})();

/* ---------------------------------------------------------------------------
   Nav: transparent over the hero, solid once the hero is behind you.
   ------------------------------------------------------------------------- */
(function () {
  const nav = document.getElementById('nav');
  const hero = document.getElementById('top');
  if (!nav) return;

  let ticking = false;
  const update = () => {
    const trigger = hero ? hero.offsetHeight - nav.offsetHeight - 40 : 80;
    nav.classList.toggle('is-stuck', window.scrollY > Math.max(40, trigger));
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();

/* ---------------------------------------------------------------------------
   Hub: picking a team flips the hospital core to what Alora gives that team.
   ------------------------------------------------------------------------- */
(function () {
  const core = document.getElementById('hub-core');
  const nodes = Array.from(document.querySelectorAll('.hub-node'));
  const backs = Array.from(document.querySelectorAll('.hub-back-item'));
  if (!core || !nodes.length) return;

  const hint = document.querySelector('.hub-hint');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active = null;

  const reset = () => {
    active = null;
    core.classList.remove('is-flipped');
    nodes.forEach((n) => n.setAttribute('aria-pressed', 'false'));
    if (hint) hint.textContent = 'Select a team to see what Alora gives them';
    // hold the back face until the flip is done, so it doesn't flash mid-turn
    setTimeout(() => { if (!active) backs.forEach((b) => (b.hidden = true)); }, 380);
  };

  const show = (dept) => {
    active = dept;
    backs.forEach((b) => (b.hidden = b.dataset.dept !== dept));
    nodes.forEach((n) => n.setAttribute('aria-pressed', String(n.dataset.dept === dept)));
    core.classList.add('is-flipped');
    if (hint) hint.textContent = 'Select another team, or the same one to flip back';
  };

  /* --- if nobody clicks, walk the whole circle for them ------------------- */
  const STEP_MS = 2600;
  const LEAD_MS = 700;
  let touched = false;
  let timer = null;
  let step = -1;

  const stopTour = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const tourDone = () => step >= nodes.length;

  const advance = () => {
    timer = null;
    if (touched) return;
    step += 1;
    if (tourDone()) { reset(); return; }   // full circle walked, settle on the hospital
    show(nodes[step].dataset.dept);
    timer = setTimeout(advance, STEP_MS);
  };

  nodes.forEach((node) => {
    node.addEventListener('click', () => {
      touched = true;              // the visitor is driving now
      stopTour();
      const dept = node.dataset.dept;
      // clicking the team already showing flips back to the hospital
      if (active === dept) reset();
      else show(dept);
    });
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && active) reset(); });

  // Auto-advancing content is disorienting for anyone who asked for less motion.
  if (reducedMotion) return;

  const hub = document.querySelector('.hub');
  if (!hub || !('IntersectionObserver' in window)) return;

  // Runs only while the hub is actually on screen, so the tour is never
  // spent on a visitor who is somewhere else on the page.
  new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (touched || tourDone()) return;
      if (e.isIntersecting) {
        if (!timer) timer = setTimeout(advance, step < 0 ? LEAD_MS : STEP_MS);
      } else {
        stopTour();
      }
    });
  }, { threshold: 0.4 }).observe(hub);
})();

/* ---------------------------------------------------------------------------
   Mobile menu: hamburger toggles the stacked nav.
   ------------------------------------------------------------------------- */
(function () {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  const nav = document.getElementById('nav');
  if (!toggle || !menu) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    if (nav) nav.classList.toggle('menu-open', open);
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  // any destination closes it
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  // never leave it open once the desktop links come back
  window.addEventListener('resize', () => {
    if (window.innerWidth > 860) setOpen(false);
  }, { passive: true });
})();
