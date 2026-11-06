/**
 * Global motion layer: smooth scroll (Lenis) + GSAP ScrollTrigger lifecycle,
 * custom cursor, magnetic buttons, character/word text effects.
 * Works with Astro view transitions: everything is torn down before a swap and rebuilt after.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => matchMedia('(pointer: fine)').matches;

let lenis: Lenis | null = null;
let ctx: gsap.Context | null = null;
const pageInits: Array<() => void> = [];

/** Register a page-specific animation setup (runs inside a gsap.context, auto-reverted on navigation). */
export function onPage(fn: () => void) {
  pageInits.push(fn);
}

function initLenis() {
  if (lenis || reduceMotion()) return;
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis?.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  (window as any).__lenis = lenis;
  // in-page anchor links go through Lenis for a smooth glide
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const el = document.querySelector(url.hash);
    if (!el) return;
    e.preventDefault();
    lenis?.scrollTo(el as HTMLElement, { offset: -20, duration: 1.6 });
  });
}

/* ---------------- text splitting ---------------- */
export function splitChars(el: HTMLElement) {
  if (el.dataset.chars) return el.querySelectorAll<HTMLElement>('.ch');
  el.dataset.chars = '1';
  const walk = (node: Node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        (n.textContent || '').split(/(\s+)/).forEach((word) => {
          if (!word) return;
          if (/^\s+$/.test(word)) { frag.append(document.createTextNode(' ')); return; }
          const w = document.createElement('span');
          w.className = 'wd';
          [...word].forEach((c) => {
            const s = document.createElement('span');
            s.className = 'ch';
            s.textContent = c;
            w.append(s);
          });
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && (n as HTMLElement).tagName !== 'BR') walk(n);
    });
  };
  walk(el);
  return el.querySelectorAll<HTMLElement>('.ch');
}

export function splitWords(el: HTMLElement) {
  if (el.dataset.words) return el.querySelectorAll<HTMLElement>('.wd');
  el.dataset.words = '1';
  const walk = (node: Node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        (n.textContent || '').split(/(\s+)/).forEach((word) => {
          if (!word) return;
          if (/^\s+$/.test(word)) { frag.append(document.createTextNode(' ')); return; }
          const w = document.createElement('span');
          w.className = 'wd';
          w.textContent = word;
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && (n as HTMLElement).tagName !== 'BR') walk(n);
    });
  };
  walk(el);
  return el.querySelectorAll<HTMLElement>('.wd');
}

/* ---------------- generic effects ---------------- */
function globalEffects() {
  if (reduceMotion()) {
    document.querySelectorAll('[data-blur-chars],[data-scrub-words]').forEach((e) => e.classList.add('is-in'));
    return;
  }

  // Headline letters fly in from blur (premotio-style)
  document.querySelectorAll<HTMLElement>('[data-blur-chars]').forEach((el) => {
    const chars = splitChars(el);
    gsap.set(el, { opacity: 1 });
    gsap.from(chars, {
      opacity: 0,
      y: 40,
      filter: 'blur(12px)',
      duration: 1.1,
      ease: 'expo.out',
      stagger: { each: 0.025 },
      delay: parseFloat(el.dataset.delay || '0'),
      scrollTrigger: el.dataset.now ? undefined : { trigger: el, start: 'top 88%' },
    });
  });

  // Paragraph words light up as you scroll through
  document.querySelectorAll<HTMLElement>('[data-scrub-words]').forEach((el) => {
    const words = splitWords(el);
    gsap.fromTo(
      words,
      { opacity: 0.14 },
      {
        opacity: 1,
        stagger: 0.1,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
      },
    );
  });

  // Scrubbed parallax
  document.querySelectorAll<HTMLElement>('[data-speed]').forEach((el) => {
    const k = parseFloat(el.dataset.speed || '0.2');
    gsap.fromTo(el, { yPercent: -k * 50 }, {
      yPercent: k * 50,
      ease: 'none',
      scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // Number counters
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const to = parseFloat(el.dataset.count || '0');
    const o = { v: 0 };
    gsap.to(o, {
      v: to,
      duration: 2.2,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%' },
      onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-US'); },
    });
  });

  // Marquees speed up & skew with scroll velocity
  const marquees = gsap.utils.toArray<HTMLElement>('.marquee');
  if (marquees.length) {
    let skew = 0;
    ScrollTrigger.create({
      onUpdate: (self) => {
        const v = gsap.utils.clamp(-8, 8, self.getVelocity() / -300);
        if (Math.abs(v) > Math.abs(skew)) {
          skew = v;
          gsap.to(marquees, { skewX: skew, duration: 0.6, ease: 'power3', overwrite: true, onComplete: () => { skew = 0; } });
          gsap.to(marquees, { skewX: 0, duration: 1.2, ease: 'power3', delay: 0.4 });
        }
      },
    });
  }
}

/* ---------------- cursor & magnetic ---------------- */
let cursorReady = false;
function initCursor() {
  if (cursorReady || !finePointer() || reduceMotion()) return;
  cursorReady = true;
  const c = document.createElement('div');
  c.className = 'cursor';
  c.innerHTML = '<span class="cursor__label"></span>';
  document.body.append(c);
  document.documentElement.classList.add('has-cursor');
  const label = c.querySelector<HTMLElement>('.cursor__label')!;
  const xTo = gsap.quickTo(c, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(c, 'y', { duration: 0.35, ease: 'power3' });
  addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); c.classList.add('is-visible'); });
  document.addEventListener('pointerleave', () => c.classList.remove('is-visible'));
  document.addEventListener('pointerover', (e) => {
    const t = e.target as HTMLElement;
    const lab = t.closest<HTMLElement>('[data-cursor]');
    const link = t.closest('a, button, [role=button], input, textarea, label');
    c.classList.toggle('is-label', !!lab);
    c.classList.toggle('is-link', !lab && !!link);
    label.textContent = lab?.dataset.cursor || '';
  });
  // keep cursor sensible after page swap
  document.addEventListener('astro:after-swap', () => {
    document.body.append(c);
    c.classList.remove('is-label', 'is-link');
  });
}

function magnetic() {
  if (!finePointer() || reduceMotion()) return;
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = parseFloat(el.dataset.magnetic || '0.35');
    const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ---------------- lifecycle ---------------- */
function boot() {
  initLenis();
  initCursor();
  ctx?.revert();
  ctx = gsap.context(() => {
    globalEffects();
    magnetic();
    pageInits.forEach((fn) => fn());
  });
  // images/fonts change layout: refresh triggers once things settle
  requestAnimationFrame(() => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

document.addEventListener('astro:page-load', boot);
document.addEventListener('astro:before-swap', () => {
  ctx?.revert();
  ctx = null;
  ScrollTrigger.getAll().forEach((t) => t.kill());
});
document.addEventListener('astro:after-swap', () => {
  // <html> classes are replaced on navigation — restore the state flags
  const root = document.documentElement;
  root.classList.add('js');
  if ((window as any).__introDone) root.classList.add('intro-done');
  lenis?.scrollTo(0, { immediate: true, force: true });
});

export { gsap, ScrollTrigger };
