// Hashi (Hashiwokakero) for the Play section: every puzzle is generated in the
// browser from a random bridge network (so it always has a solution), then
// checked by an exact solver and only kept when that solution is the only one.
(() => {
  const root = document.querySelector('[data-hashi]');
  if (!root) return;

  /* ---------- Puzzle core ---------- */

  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  // Nearest-neighbour island pairs (the only places a bridge can go) and, for
  // each, the other pairs whose bridge would cross it.
  const buildEdges = (w, h, islands) => {
    const at = new Map(islands.map((s, i) => [s.y * w + s.x, i]));
    const edges = [];
    islands.forEach((s, i) => {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        let x = s.x + dx;
        let y = s.y + dy;
        while (x < w && y < h && !at.has(y * w + x)) { x += dx; y += dy; }
        if (x < w && y < h) edges.push({ a: i, b: at.get(y * w + x), horiz: dy === 0, cross: [] });
      }
    });
    edges.forEach((e, k) => {
      if (!e.horiz) return;
      const y = islands[e.a].y;
      const x1 = islands[e.a].x;
      const x2 = islands[e.b].x;
      edges.forEach((f, j) => {
        if (f.horiz) return;
        const x = islands[f.a].x;
        const y1 = islands[f.a].y;
        const y2 = islands[f.b].y;
        if (x1 < x && x < x2 && y1 < y && y < y2) {
          e.cross.push(j);
          f.cross.push(k);
        }
      });
    });
    return edges;
  };

  // Exact solver: bound propagation per island, crossing and connectivity
  // pruning, then branching. Stops after `limit` solutions; `guesses` counts
  // branch points, so 0 means plain deduction solves it.
  const solve = (islands, edges, limit = 2) => {
    const n = islands.length;
    const m = edges.length;
    const inc = islands.map(() => []);
    edges.forEach((e, k) => { inc[e.a].push(k); inc[e.b].push(k); });
    let count = 0;
    let first = null;
    let guesses = 0;

    const parent = new Int32Array(n);
    const findRoot = (i) => {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]];
      return i;
    };
    const components = (bridges) => {
      for (let i = 0; i < n; i++) parent[i] = i;
      let groups = n;
      for (let k = 0; k < m; k++) {
        if (!bridges[k]) continue;
        const a = findRoot(edges[k].a);
        const b = findRoot(edges[k].b);
        if (a !== b) { parent[a] = b; groups--; }
      }
      return groups;
    };

    const propagate = (lo, hi) => {
      let changed = true;
      while (changed) {
        changed = false;
        for (let k = 0; k < m; k++) {
          if (!lo[k]) continue;
          for (const f of edges[k].cross) {
            if (lo[f]) return false;
            if (hi[f]) { hi[f] = 0; changed = true; }
          }
        }
        for (let i = 0; i < n; i++) {
          const need = islands[i].n;
          let sl = 0;
          let sh = 0;
          for (const k of inc[i]) { sl += lo[k]; sh += hi[k]; }
          if (sl > need || sh < need) return false;
          for (const k of inc[i]) {
            const nlo = Math.max(lo[k], need - (sh - hi[k]));
            const nhi = Math.min(hi[k], need - (sl - lo[k]));
            if (nlo > nhi) return false;
            if (nlo !== lo[k] || nhi !== hi[k]) {
              sl += nlo - lo[k];
              sh += nhi - hi[k];
              lo[k] = nlo;
              hi[k] = nhi;
              changed = true;
            }
          }
        }
      }
      // Everything must still be reachable through possible bridges...
      if (components(hi) > 1) return false;
      // ...and no finished group of islands may be cut off from the rest.
      if (components(lo) > 1) {
        const open = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          let sl = 0;
          for (const k of inc[i]) sl += lo[k];
          if (sl < islands[i].n) open[findRoot(i)] = 1;
        }
        for (let i = 0; i < n; i++) if (findRoot(i) === i && !open[i]) return false;
      }
      return true;
    };

    const search = (lo, hi) => {
      if (!propagate(lo, hi)) return;
      // Branch on the open edge with the fewest options, preferring ones already in use.
      let pick = -1;
      let score = Infinity;
      for (let k = 0; k < m; k++) {
        if (lo[k] === hi[k]) continue;
        const s = (hi[k] - lo[k]) * 2 - (lo[k] ? 1 : 0);
        if (s < score) { score = s; pick = k; }
      }
      if (pick < 0) {
        count++;
        if (!first) first = Array.from(lo);
        return;
      }
      guesses++;
      for (let v = hi[pick]; v >= lo[pick] && count < limit; v--) {
        const L = lo.slice();
        const H = hi.slice();
        L[pick] = H[pick] = v;
        search(L, H);
      }
    };

    search(new Int8Array(m), new Int8Array(m).fill(2));
    return { count, solution: first, guesses };
  };

  // Grows a random connected bridge network one island at a time. Islands never
  // touch, and bridges are laid down as they go so nothing crosses, which makes
  // the network itself a valid solution for the numbers it produces.
  const grow = (w, h, target) => {
    const grid = new Int16Array(w * h); // 0 empty, -1 bridge, i + 1 island i
    const islands = [];
    const links = new Map(); // "a,b" -> bridges
    const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    const nearIsland = (x, y) => DIRS.some(([dx, dy]) => inside(x + dx, y + dy) && grid[(y + dy) * w + x + dx] > 0);
    const place = (x, y) => {
      islands.push({ x, y, n: 0 });
      grid[y * w + x] = islands.length;
    };
    const link = (a, b, path) => {
      path.forEach(([x, y]) => { grid[y * w + x] = -1; });
      const v = Math.random() < 0.4 ? 2 : 1;
      links.set(a < b ? `${a},${b}` : `${b},${a}`, v);
      islands[a].n += v;
      islands[b].n += v;
    };

    place(Math.floor(Math.random() * w), Math.floor(Math.random() * h));
    for (let tries = 0; islands.length < target && tries < target * 80; tries++) {
      const a = Math.floor(Math.random() * islands.length);
      const [dx, dy] = DIRS[Math.floor(Math.random() * 4)];
      let x = islands[a].x + dx;
      let y = islands[a].y + dy;
      const path = [];
      while (inside(x, y) && grid[y * w + x] === 0) { path.push([x, y]); x += dx; y += dy; }
      const hit = inside(x, y) ? grid[y * w + x] - 1 : -1;

      // Sometimes close a loop to an island already in line, for less tree-like puzzles.
      if (hit >= 0 && Math.random() < 0.3) {
        const key = a < hit ? `${a},${hit}` : `${hit},${a}`;
        if (!links.has(key)) link(a, hit, path);
        continue;
      }
      const spots = [];
      for (let i = 1; i < path.length; i++) if (!nearIsland(...path[i])) spots.push(i);
      if (!spots.length) continue;
      // Favour short hops so islands spread evenly instead of racing to the edges.
      const i = spots[Math.floor(Math.random() ** 1.6 * spots.length)];
      place(...path[i]);
      link(a, islands.length - 1, path.slice(0, i));
    }
    return islands;
  };

  const generate = ({ w, h, islands: target, logicOnly, needsLookahead }) => {
    for (let attempt = 1; ; attempt++) {
      const islands = grow(w, h, target);
      if (islands.length < target * 0.85) continue;
      const edges = buildEdges(w, h, islands);
      const res = solve(islands, edges, 2);
      if (res.count !== 1 || (logicOnly && res.guesses) || (needsLookahead && !res.guesses)) continue;
      return { w, h, islands, edges, solution: res.solution, attempts: attempt };
    }
  };

  /* ---------- UI ---------- */

  // Easy puzzles fall to plain deduction; hard ones can't be solved without lookahead.
  const LEVELS = {
    easy: { w: 7, h: 7, islands: 12, logicOnly: true },
    medium: { w: 10, h: 10, islands: 22 },
    hard: { w: 13, h: 13, islands: 36, needsLookahead: true },
  };
  const CELL = 10; // SVG units per grid cell
  const R = 4.1; // island radius
  const BEST_KEY = 'hashi-best';

  const board = root.querySelector('[data-board]');
  const overlay = root.querySelector('[data-overlay]');
  const msg = root.querySelector('[data-msg]');
  const levelBtns = root.querySelectorAll('[data-level]');
  const out = (k) => root.querySelector(`[data-out="${k}"]`);

  const loadBest = () => {
    try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch { return {}; }
  };
  const saveBest = () => {
    try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* storage unavailable */ }
  };

  let level = 'easy';
  let best = loadBest();
  let puzzle = null;
  let nb = []; // per island: [{ k, j, dx, dy }] reachable neighbours
  let bridges = null; // Int8Array, bridges per edge
  let history = []; // earlier bridge states, for undo
  let sel = -1;
  let solved = false;
  let elapsed = 0; // ms banked while the clock was running
  let since = 0; // when the clock last started, 0 while stopped
  let clock = 0;
  let blocked = -1;
  let blockTimer = 0;
  let hiddenStop = false; // clock stopped only because the page was hidden

  const fmtTime = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const now = () => elapsed + (since ? performance.now() - since : 0);
  const showTime = () => { out('time').textContent = fmtTime(now()); };
  const startClock = () => {
    if (since || solved) return;
    since = performance.now();
    clock = setInterval(showTime, 250);
  };
  const stopClock = () => {
    if (!since) return;
    elapsed = now();
    since = 0;
    clearInterval(clock);
  };

  const sums = () => {
    const s = puzzle.islands.map(() => 0);
    puzzle.edges.forEach((e, k) => { s[e.a] += bridges[k]; s[e.b] += bridges[k]; });
    return s;
  };

  const connected = () => {
    const seen = new Uint8Array(puzzle.islands.length);
    const stack = [0];
    seen[0] = 1;
    let reached = 1;
    while (stack.length) {
      for (const { k, j } of nb[stack.pop()]) {
        if (bridges[k] && !seen[j]) { seen[j] = 1; reached++; stack.push(j); }
      }
    }
    return reached === puzzle.islands.length;
  };

  /* ---------- Drawing ---------- */

  const centre = (i) => [puzzle.islands[i].x * CELL + CELL / 2, puzzle.islands[i].y * CELL + CELL / 2];

  const draw = () => {
    const { w, h, islands, edges } = puzzle;
    const have = sums();
    const cand = new Set(sel >= 0 ? nb[sel].map((o) => o.j) : []);
    const parts = [];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) parts.push(`<circle class="hashi__dot" cx="${x * CELL + CELL / 2}" cy="${y * CELL + CELL / 2}" r=".45"/>`);
    }
    // Wide invisible strokes between neighbours: tap one to cycle its bridges.
    edges.forEach((e, k) => {
      const [x1, y1] = centre(e.a);
      const [x2, y2] = centre(e.b);
      const ox = e.horiz ? R : 0;
      const oy = e.horiz ? 0 : R;
      parts.push(`<line class="hashi__hit" data-k="${k}" x1="${x1 + ox}" y1="${y1 + oy}" x2="${x2 - ox}" y2="${y2 - oy}"/>`);
    });
    edges.forEach((e, k) => {
      if (!bridges[k]) return;
      const [x1, y1] = centre(e.a);
      const [x2, y2] = centre(e.b);
      const offs = bridges[k] === 2 ? [-0.95, 0.95] : [0];
      const lines = offs.map((o) => (e.horiz
        ? `<line x1="${x1}" y1="${y1 + o}" x2="${x2}" y2="${y2 + o}"/>`
        : `<line x1="${x1 + o}" y1="${y1}" x2="${x2 + o}" y2="${y2}"/>`)).join('');
      parts.push(`<g class="hashi__bridge${k === blocked ? ' is-blocked' : ''}">${lines}</g>`);
    });
    islands.forEach((s, i) => {
      const [cx, cy] = centre(i);
      const cls = [
        have[i] === s.n && 'is-done',
        have[i] > s.n && 'is-over',
        i === sel && 'is-sel',
        cand.has(i) && 'is-cand',
      ].filter(Boolean).join(' ');
      parts.push(`<g class="hashi__island ${cls}" data-i="${i}"><circle cx="${cx}" cy="${cy}" r="${R}"/><text x="${cx}" y="${cy}">${s.n}</text></g>`);
    });

    board.innerHTML = parts.join('');
    out('done').textContent = `${have.filter((v, i) => v === islands[i].n).length} / ${islands.length}`;
  };

  const showStats = () => {
    showTime();
    out('best').textContent = best[level] ? fmtTime(best[level]) : '-';
  };

  /* ---------- Game flow ---------- */

  const newPuzzle = () => {
    puzzle = generate(LEVELS[level]);
    nb = puzzle.islands.map(() => []);
    puzzle.edges.forEach((e, k) => {
      const [ax, ay] = [puzzle.islands[e.a].x, puzzle.islands[e.a].y];
      const [bx, by] = [puzzle.islands[e.b].x, puzzle.islands[e.b].y];
      nb[e.a].push({ k, j: e.b, dx: Math.sign(bx - ax), dy: Math.sign(by - ay) });
      nb[e.b].push({ k, j: e.a, dx: Math.sign(ax - bx), dy: Math.sign(ay - by) });
    });
    const { w, h } = puzzle;
    board.setAttribute('viewBox', `0 0 ${w * CELL} ${h * CELL}`);
    board.setAttribute('aria-label', `Hashi puzzle, ${w} by ${h}, ${puzzle.islands.length} islands`);
    bridges = new Int8Array(puzzle.edges.length);
    history = [];
    sel = -1;
    solved = false;
    stopClock();
    elapsed = 0;
    overlay.hidden = true;
    showStats();
    draw();
  };

  const win = () => {
    solved = true;
    stopClock();
    const t = elapsed;
    const record = !best[level] || t < best[level];
    if (record) {
      best[level] = t;
      saveBest();
    }
    showStats();
    msg.textContent = `Solved in ${fmtTime(t)}${record ? ' · new best!' : ''}`;
    overlay.hidden = false;
  };

  // Flash the bridge that is in the way of a new one.
  const flash = (k) => {
    blocked = k;
    clearTimeout(blockTimer);
    blockTimer = setTimeout(() => { blocked = -1; draw(); }, 450);
  };

  // Cycle a pair's bridges 0 -> 1 -> 2 -> 0.
  const cycle = (k) => {
    if (solved) return;
    if (!bridges[k]) {
      const hit = puzzle.edges[k].cross.find((f) => bridges[f]);
      if (hit !== undefined) {
        flash(hit);
        return;
      }
    }
    history.push(bridges.slice());
    bridges[k] = (bridges[k] + 1) % 3;
    startClock();
    if (sums().every((v, i) => v === puzzle.islands[i].n) && connected()) win();
  };

  const undo = () => {
    if (solved || !history.length) return;
    bridges = history.pop();
    sel = -1;
    draw();
  };

  const restart = () => {
    if (solved || !bridges.some(Boolean)) return;
    history.push(bridges.slice());
    bridges.fill(0);
    sel = -1;
    draw();
  };

  const setLevel = (name) => {
    level = name;
    levelBtns.forEach((b) => {
      const on = b.dataset.level === name;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    newPuzzle();
  };

  /* ---------- Input ---------- */

  // Tap between two islands, drag from one island toward another, or tap one
  // island and then its neighbour: each adds a bridge (a third time removes them).
  let drag = null;
  const toBoard = (e) => {
    const r = board.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * puzzle.w * CELL, ((e.clientY - r.top) / r.height) * puzzle.h * CELL];
  };

  board.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const island = e.target.closest('[data-i]');
    const edge = e.target.closest('[data-k]');
    if (island) {
      e.preventDefault();
      drag = { i: Number(island.dataset.i), at: toBoard(e), id: e.pointerId };
      board.setPointerCapture(e.pointerId);
      return;
    }
    if (edge) cycle(Number(edge.dataset.k));
    sel = -1;
    draw();
  });

  board.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { i, at } = drag;
    drag = null;
    const [x, y] = toBoard(e);
    const dx = x - at[0];
    const dy = y - at[1];
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-i]');
    const j = under ? Number(under.dataset.i) : -1;

    if (Math.hypot(dx, dy) > CELL * 0.4) {
      // Dragged: to the island it ended on, or else the neighbour in that direction.
      const horiz = Math.abs(dx) > Math.abs(dy);
      const dir = horiz ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      const o = nb[i].find((n) => n.j === j) || nb[i].find((n) => n.dx === dir[0] && n.dy === dir[1]);
      if (o) cycle(o.k);
      sel = -1;
    } else if (sel >= 0 && sel !== i && nb[sel].some((n) => n.j === i)) {
      cycle(nb[sel].find((n) => n.j === i).k);
      sel = -1;
    } else {
      sel = sel === i ? -1 : i;
    }
    draw();
  });

  board.addEventListener('pointercancel', () => { drag = null; });

  root.addEventListener('keydown', (e) => {
    if (e.target.closest('button, select, input')) return;
    const undoKey = e.code === 'KeyU' || ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ');
    if (undoKey) {
      e.preventDefault();
      undo();
    } else if (e.code === 'Escape' && sel >= 0) {
      sel = -1;
      draw();
    }
  });

  root.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', newPuzzle));
  root.querySelector('[data-undo]').addEventListener('click', undo);
  root.querySelector('[data-restart]').addEventListener('click', restart);
  levelBtns.forEach((b) => b.addEventListener('click', () => setLevel(b.dataset.level)));

  // The clock only runs while the page is visible.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenStop = Boolean(since);
      stopClock();
    } else if (hiddenStop) {
      hiddenStop = false;
      startClock();
    }
  });

  setLevel(level);
})();
