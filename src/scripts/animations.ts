/** Scroll-reveal, split-line headings, auto-hiding header, video helpers. Re-run on every page (view transitions). */
let cleanup: Array<() => void> = [];

function splitLines(el: HTMLElement) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  // split by explicit <br> into line wrappers
  const parts = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = parts
    .map((p, i) => `<span class="line" style="--i:${i}"><span>${p}</span></span>`)
    .join('');
}

export function initPage() {
  cleanup.forEach((fn) => fn());
  cleanup = [];

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll<HTMLElement>('[data-split]').forEach(splitLines);

  const targets = document.querySelectorAll<HTMLElement>('[data-reveal], [data-split]');
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach((t) => t.classList.add('is-in'));
  } else {
    // clip-path hides an element from IntersectionObserver, so "wipe" items are watched via their parent
    const watched = new Map<Element, HTMLElement[]>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            watched.get(e.target)?.forEach((t) => t.classList.add('is-in'));
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    );
    targets.forEach((t) => {
      const key = t.dataset.reveal === 'wipe' && t.parentElement ? t.parentElement : t;
      if (!watched.has(key)) watched.set(key, []);
      watched.get(key)!.push(t);
      io.observe(key);
    });
    cleanup.push(() => io.disconnect());
  }

  // Header hides on scroll down, shows on scroll up
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (header) {
    let last = scrollY;
    const onScroll = () => {
      const y = scrollY;
      header.classList.toggle('is-hidden', y > last && y > 200);
      last = y;
    };
    addEventListener('scroll', onScroll, { passive: true });
    cleanup.push(() => removeEventListener('scroll', onScroll));
  }

  // Parallax for elements with data-parallax="0.1"
  const para = [...document.querySelectorAll<HTMLElement>('[data-parallax]')];
  if (para.length && !reduce) {
    let raf = 0;
    const tick = () => {
      raf = 0;
      const vh = innerHeight;
      for (const el of para) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const k = parseFloat(el.dataset.parallax || '0.1');
        const off = (r.top + r.height / 2 - vh / 2) * -k;
        el.style.translate = `0 ${off.toFixed(1)}px`;
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    cleanup.push(() => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); });
  }

  // Autoplay videos only while visible (saves battery & data)
  const autoVids = document.querySelectorAll<HTMLVideoElement>('video[data-autoplay]');
  if (autoVids.length) {
    const vio = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting && !reduce) v.play().catch(() => {});
        else v.pause();
      }
    }, { threshold: 0.2 });
    autoVids.forEach((v) => vio.observe(v));
    cleanup.push(() => vio.disconnect());
  }

  // Click-to-play videos with custom poster button
  document.querySelectorAll<HTMLElement>('[data-video-player]').forEach((wrap) => {
    const video = wrap.querySelector('video')!;
    const btn = wrap.querySelector<HTMLButtonElement>('[data-play]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      wrap.classList.add('is-playing');
      video.controls = true;
      video.play();
    });
  });
}
