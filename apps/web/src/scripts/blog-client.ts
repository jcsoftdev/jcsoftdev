import { staggerDelay } from '../lib/stagger';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let revealObserver: IntersectionObserver | null = null;

/** Same contract as the landing: [data-reveal] sections release their [data-reveal-item]s. */
function initReveals() {
  revealObserver?.disconnect();
  if (reduceMotion()) return;
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const section = entry.target as HTMLElement;
        const items = section.querySelectorAll<HTMLElement>('[data-reveal-item]');
        if (items.length === 0) {
          section.classList.add('is-revealed');
        } else {
          items.forEach((item, i) => {
            item.style.setProperty('--reveal-delay', `${staggerDelay(i, 55, 9)}ms`);
            item.classList.add('is-revealed');
          });
        }
        revealObserver?.unobserve(section);
      }
    },
    { threshold: 0.1, rootMargin: '0px 0px -8% 0px' }
  );
  for (const section of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
    revealObserver.observe(section);
  }
}

function initProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar || bar.dataset.bound === 'true') return;
  bar.dataset.bound = 'true';
  if (reduceMotion()) {
    bar.hidden = true;
    return;
  }
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    bar.style.transform = `scaleX(${ratio})`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initCopyLink() {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy-link]')) {
    if (button.dataset.bound === 'true') continue;
    button.dataset.bound = 'true';
    const label = button.querySelector<HTMLElement>('[data-copy-label]');
    const idle = label?.textContent ?? 'Copy link';
    let timer: number | undefined;
    button.addEventListener('click', async () => {
      const url = button.dataset.copyLink || window.location.href;
      let ok = true;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        ok = false;
      }
      if (label) label.textContent = ok ? 'Copied' : 'Copy failed';
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (label) label.textContent = idle;
      }, 2000);
    });
  }
}

let tocObserver: IntersectionObserver | null = null;

/** Marks the TOC link of the heading currently in the upper part of the viewport. */
function initToc() {
  tocObserver?.disconnect();
  const links = new Map<string, HTMLAnchorElement>();
  for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-toc] a[href^='#']")) {
    links.set(decodeURIComponent(a.hash.slice(1)), a);
  }
  if (links.size === 0) return;
  const setCurrent = (id: string) => {
    for (const [key, a] of links) {
      if (key === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  };
  tocObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setCurrent(entry.target.id);
      }
    },
    { rootMargin: '0px 0px -70% 0px' }
  );
  for (const id of links.keys()) {
    const heading = document.getElementById(id);
    if (heading) tocObserver.observe(heading);
  }
}

function init() {
  initReveals();
  initProgress();
  initCopyLink();
  initToc();
}

init();
document.addEventListener('astro:page-load', init);
