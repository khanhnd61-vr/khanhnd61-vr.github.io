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

// Latency explorer: pick an engine, model and device; show that model's config
// and the measured latency / memory from bench-data.js.
const bench = document.querySelector('[data-bench]');
if (bench && window.BENCH_DATA) {
  const DATA = window.BENCH_DATA;
  const out = (k) => bench.querySelector(`[data-out="${k}"]`);
  const modelSel = bench.querySelector('[data-model]');
  const deviceSel = bench.querySelector('[data-device]');
  const engineBtns = bench.querySelectorAll('[data-engine]');
  const DEFAULTS = { 'vla.cpp': ['smolvla', 'agxorin'], 'vla.simd': ['impact', 'pi5'] };
  let engine = 'vla.cpp';

  const fmt = (n, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const fmtMs = (ms) => (ms < 100 ? fmt(ms, 1) : fmt(ms, 0));
  const fmtMiB = (mib) => (mib >= 1024 ? `${fmt(mib / 1024, 1)} GiB` : `${fmt(mib, 0)} MiB`);
  const rowsFor = (model) => DATA[engine].results
    .filter((r) => r[0] === model)
    .sort((x, y) => x[2] - y[2]);

  const fill = (sel, items, keep) => {
    sel.replaceChildren(...items.map(([id, label]) => new Option(label, id)));
    sel.value = items.some(([id]) => id === keep) ? keep : items[0][0];
  };

  const setNA = (el, text) => { el.textContent = text; el.classList.add('is-na'); };
  const setVal = (el, text) => { el.textContent = text; el.classList.remove('is-na'); };

  const render = () => {
    const d = DATA[engine];
    const model = d.models[modelSel.value];
    const rows = rowsFor(modelSel.value);
    const row = rows.find((r) => r[1] === deviceSel.value);
    const [, devId, ms, mem, views, setup] = row;

    out('ms').textContent = fmtMs(ms);
    setVal(out('rate'), fmt(model.chunk / (ms / 1000), 0));

    const memEl = out('mem');
    if (mem && mem.vram) {
      setVal(memEl, fmtMiB(mem.vram));
      out('memsub').textContent = mem.rss ? `VRAM · ${fmtMiB(mem.rss)} host` : 'VRAM';
    } else if (mem && mem.shared) {
      setVal(memEl, fmtMiB(mem.shared));
      out('memsub').textContent = mem.rss ? `shared · ${fmtMiB(mem.rss)} RSS` : 'shared';
    } else if (mem && mem.rss) {
      setVal(memEl, fmtMiB(mem.rss));
      out('memsub').textContent = 'peak RSS';
    } else {
      setNA(memEl, 'not reported');
      out('memsub').textContent = '';
    }

    out('img').textContent = typeof model.image === 'number' ? `${model.image}×${model.image}` : model.image;
    out('views').textContent = views ?? model.views ?? '-';
    out('chunk').textContent = `${model.chunk} steps`;
    out('setup').textContent = setup;
    out('note').textContent = d.devices[devId].note;

    const max = rows[rows.length - 1][2];
    const bars = out('bars');
    const scroll = bars.scrollTop;
    bars.replaceChildren(...rows.map(([, id, t]) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = id === devId ? 'is-current' : '';
      b.setAttribute('aria-label', `${d.devices[id].name}: ${fmtMs(t)} ms`);
      b.innerHTML = '<span class="dev"></span><span class="track"><span class="fill"></span></span><span class="ms"></span>';
      b.querySelector('.dev').textContent = d.devices[id].name;
      b.querySelector('.fill').style.width = `${Math.max(2, (t / max) * 100)}%`;
      b.querySelector('.ms').textContent = `${fmtMs(t)} ms`;
      b.addEventListener('click', () => { deviceSel.value = id; render(); });
      li.append(b);
      return li;
    }));
    bars.scrollTop = scroll;
  };

  const fillDevices = (keep) => {
    const d = DATA[engine];
    fill(deviceSel, rowsFor(modelSel.value).map((r) => [r[1], d.devices[r[1]].name]), keep);
  };

  const setEngine = (next) => {
    engine = next;
    engineBtns.forEach((b) => {
      const on = b.dataset.engine === next;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const d = DATA[engine];
    const [defModel, defDevice] = DEFAULTS[engine] || [];
    const models = Object.keys(d.models).filter((id) => d.results.some((r) => r[0] === id));
    fill(modelSel, models.map((id) => [id, d.models[id].name]), defModel);
    fillDevices(defDevice);
    render();
  };

  engineBtns.forEach((b) => b.addEventListener('click', () => setEngine(b.dataset.engine)));
  modelSel.addEventListener('change', () => { fillDevices(deviceSel.value); render(); });
  deviceSel.addEventListener('change', render);
  setEngine(engine);
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
