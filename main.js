// Small, effective interactions.

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

// Interactive code card: the same short self-introduction
// written in C++ or Python depending on the chosen language.
const renderers = {
  cpp: {
    file: 'khanh.cpp',
    build: () => [
      'struct Engineer {',
      '  const char* name  = "Khanh D. Nguyen";',
      '  const char* role  = "AI Software Engineer";',
      '  const char* focus[3] = {',
      '    "inference engineering",',
      '    "model optimization",',
      '    "edge AI for robotics",',
      '  };',
      '  const char* motto = "simple code, effective results";',
      '};',
    ].join('\n'),
  },
  py: {
    file: 'khanh.py',
    build: () => [
      '@dataclass',
      'class Engineer:',
      '    name: str = "Khanh D. Nguyen"',
      '    role: str = "AI Software Engineer"',
      '    focus: tuple = (',
      '        "inference engineering",',
      '        "model optimization",',
      '        "edge AI for robotics",',
      '    )',
      '    motto: str = "simple code, effective results"',
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
