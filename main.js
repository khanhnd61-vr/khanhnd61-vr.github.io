// Havilab - small, effective interactions.

// Current year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Mobile nav toggle
const toggle = document.querySelector('.nav__toggle');
const links = document.querySelector('.nav__links');

toggle.addEventListener('click', () => {
  const open = links.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(open));
});

// Close the mobile menu after tapping a link
links.querySelectorAll('a').forEach((a) => {
  a.addEventListener('click', () => {
    links.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  });
});

// Interactive code-comment card: render the vicuna brand header
// as a C++ or Python comment depending on the chosen language.
const vicunaArt = [
  '      /\\    /\\',
  '     /  \\__/  \\',
  '    /  O    O  \\',
  '   |     ︶     |',
  '   |   \\____/   |',
  '    \\  ~~~~~~  /',
  '     \\________/',
  '       HAVILAB',
];
const tagline = ['Happy Vicuna Laboratory', 'build simple and effective code'];

const renderers = {
  cpp: {
    file: 'vicuna.cpp',
    build: () => [
      '/*',
      ...vicunaArt.map((l) => ' * ' + l),
      ' *',
      ...tagline.map((l) => ' *  ' + l),
      ' */',
    ].join('\n'),
  },
  py: {
    file: 'vicuna.py',
    build: () => [
      '# ' + '='.repeat(22),
      ...vicunaArt.map((l) => '# ' + l),
      '#',
      ...tagline.map((l) => '#  ' + l),
      '# ' + '='.repeat(22),
    ].join('\n'),
  },
};

const codeEl = document.querySelector('[data-code]');
if (codeEl) {
  const fileEl = document.querySelector('[data-filename]');
  const langBtns = document.querySelectorAll('.codecard__langs .lang');

  const setLang = (lang) => {
    const r = renderers[lang];
    if (!r) return;
    codeEl.textContent = r.build();
    if (fileEl) fileEl.textContent = r.file;
    langBtns.forEach((b) => {
      const active = b.dataset.lang === lang;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
    });
    // brief swap animation
    codeEl.parentElement.classList.remove('codecard__code--swap');
    void codeEl.parentElement.offsetWidth; // reflow to restart animation
    codeEl.parentElement.classList.add('codecard__code--swap');
  };

  langBtns.forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  setLang('cpp'); // default
}

// Projects carousel: prev/next arrows + disabled-state sync
const track = document.querySelector('.projects');
if (track) {
  const prevBtn = document.querySelector('.carousel-nav__btn[data-scroll="prev"]');
  const nextBtn = document.querySelector('.carousel-nav__btn[data-scroll="next"]');

  const step = () => {
    const card = track.querySelector('.project');
    if (!card) return track.clientWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  };

  const syncButtons = () => {
    const maxScroll = track.scrollWidth - track.clientWidth - 1;
    if (prevBtn) prevBtn.disabled = track.scrollLeft <= 0;
    if (nextBtn) nextBtn.disabled = track.scrollLeft >= maxScroll;
  };

  if (prevBtn) prevBtn.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  if (nextBtn) nextBtn.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('scroll', syncButtons, { passive: true });
  window.addEventListener('resize', syncButtons);
  syncButtons();
}

// Reveal-on-scroll for sections
const revealEls = document.querySelectorAll('.section, .hero__text, .hero__art');
revealEls.forEach((el) => el.classList.add('reveal'));

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('is-visible'));
}
