// Small, effective interactions.

// Current year in footer
document.getElementById('year').textContent = new Date().getFullYear();

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

// Coding agent benchmark: pick a model; show how it did on the SDK build from agent-data.js,
// with every model's time as bars (green success, red failed).
const agent = document.querySelector('[data-agent]');
if (agent && window.AGENT_DATA) {
  const { models } = window.AGENT_DATA;
  const out = (k) => agent.querySelector(`[data-agent-out="${k}"]`);
  const modelSel = agent.querySelector('[data-agent-model]');
  const pad = (n) => String(n).padStart(2, '0');
  const dur = (s) => (s < 3600
    ? `${Math.floor(s / 60)}m ${pad(s % 60)}s`
    : `${Math.floor(s / 3600)}h ${pad(Math.round((s % 3600) / 60))}m`);
  const byTime = [...models].sort((x, y) => x.modelTime - y.modelTime);
  const max = byTime[byTime.length - 1].modelTime;

  const label = (m) => (m.star ? `${m.name} ★` : m.name);
  modelSel.replaceChildren(...models.map((m) => new Option(label(m), m.id)));
  modelSel.value = 'qwen38';

  const render = () => {
    const m = models.find((x) => x.id === modelSel.value);
    const result = out('result');
    result.textContent = m.built ? 'Success' : 'Failed';
    result.classList.toggle('is-fail', !m.built);
    out('time').textContent = dur(m.modelTime);
    out('toolsub').textContent = `+ ${dur(m.toolTime)} tools`;
    out('hints').textContent = m.hints;
    out('prompts').textContent = `${m.prompts} prompt${m.prompts === 1 ? '' : 's'}`;
    out('backend').textContent = m.backend;
    out('quant').textContent = m.quant;
    out('context').textContent = m.context;
    out('vram').textContent = m.vram;
    out('size').textContent = m.size;

    const bars = out('bars');
    const scroll = bars.scrollTop;
    bars.replaceChildren(...byTime.map((x) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = [x.id === m.id ? 'is-current' : '', x.built ? '' : 'is-fail'].join(' ').trim();
      b.setAttribute('aria-label', `${x.name}: ${dur(x.modelTime)}, ${x.built ? 'success' : 'failed'}`);
      b.innerHTML = '<span class="dev"></span><span class="track"><span class="fill"></span></span><span class="ms"></span>';
      b.querySelector('.dev').textContent = label(x);
      b.querySelector('.fill').style.width = `${Math.max(2, (x.modelTime / max) * 100)}%`;
      b.querySelector('.ms').textContent = dur(x.modelTime);
      b.addEventListener('click', () => { modelSel.value = x.id; render(); });
      li.append(b);
      return li;
    }));
    bars.scrollTop = scroll;
  };

  modelSel.addEventListener('change', render);
  render();
}

// Human / Agent toggle: the swap itself is CSS (styles.css); start each view at the top
document.querySelector('.view-toggle__input').addEventListener('change', () => {
  window.scrollTo({ top: 0, behavior: 'instant' });
});
