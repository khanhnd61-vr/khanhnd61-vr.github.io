// Tetris for the Play section: canvas boards, 7-bag randomizer, ghost piece,
// keyboard + touch controls, best score kept in this browser, and a 2-player
// mode on one keyboard where multi-line clears send garbage to the other board.
(() => {
  const root = document.querySelector('[data-tetris]');
  if (!root) return;

  const COLS = 10;
  const ROWS = 20;
  const BOARD_BG = '#3d250c';
  // Classic piece hues, muted to sit with the site palette; G is garbage.
  const COLORS = {
    I: '#8FB8C4', O: '#F4C15D', T: '#B48CB0', S: '#8DB07E',
    Z: '#D9745A', J: '#6F8FC0', L: '#E2A963', G: '#7D6A55',
  };
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  };
  const LINE_POINTS = [0, 100, 300, 500, 800];
  const GARBAGE = [0, 0, 1, 2, 4]; // rows sent to the opponent per lines cleared
  // Offsets tried in order when a rotation collides (simple wall/floor kicks).
  const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];
  const DAS = 170; // ms before a held move starts repeating
  const ARR = 50; // ms between repeats
  const BEST_KEY = 'tetris-best';
  const IDLE_MSG = {
    1: 'Stack the blocks, clear the lines.',
    2: 'Clear 2+ lines to send garbage. Last one standing wins.',
  };

  // Physical keys (KeyboardEvent.code) -> [player, action].
  const SOLO_KEYS = {
    ArrowLeft: [0, 'left'], ArrowRight: [0, 'right'], ArrowDown: [0, 'down'],
    ArrowUp: [0, 'rotate'], KeyX: [0, 'rotate'], KeyZ: [0, 'rotateBack'],
    Space: [0, 'drop'], KeyP: [0, 'pause'], Escape: [0, 'pause'],
  };
  const DUO_KEYS = {
    KeyA: [0, 'left'], KeyD: [0, 'right'], KeyS: [0, 'down'], KeyW: [0, 'rotate'], KeyF: [0, 'drop'],
    ArrowLeft: [1, 'left'], ArrowRight: [1, 'right'], ArrowDown: [1, 'down'], ArrowUp: [1, 'rotate'],
    Enter: [1, 'drop'], NumpadEnter: [1, 'drop'],
    Space: [0, 'pause'], KeyP: [0, 'pause'], Escape: [0, 'pause'],
  };
  const REPEATS = new Set(['left', 'right', 'down']);

  const stage = root.querySelector('[data-stage]');
  const overlay = root.querySelector('[data-overlay]');
  const msg = root.querySelector('[data-msg]');
  const startBtn = root.querySelector('[data-start]');
  const modeBtns = root.querySelectorAll('[data-mode]');

  const loadBest = () => {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  };
  const saveBest = (n) => {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* storage unavailable */ }
  };

  const emptyGrid = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  const makePlayer = (panel, name) => {
    const board = panel.querySelector('[data-board]');
    const preview = panel.querySelector('[data-next]');
    panel.querySelector('[data-who]').textContent = `${name} player`;
    return {
      name, board, preview,
      ctx: board.getContext('2d'),
      nctx: preview.getContext('2d'),
      out: (k) => panel.querySelector(`[data-out="${k}"]`),
    };
  };

  // The right player's panel is a copy of the left one; each keeps only its own key list.
  const leftPanel = root.querySelector('[data-player]');
  const rightPanel = leftPanel.cloneNode(true);
  leftPanel.after(rightPanel);
  leftPanel.querySelector('[data-keys="right"]').remove();
  rightPanel.querySelectorAll('[data-keys="solo"], [data-keys="left"]').forEach((el) => el.remove());
  const players = [makePlayer(leftPanel, 'Left'), makePlayer(rightPanel, 'Right')];

  let mode = 1;
  let queue = [];
  let best = loadBest();
  let state = 'idle'; // idle | playing | paused | over
  let raf = 0;
  let lastTime = 0;
  let overAt = 0;

  const fmt = (n) => n.toLocaleString('en-US');
  const interval = (p) => Math.max(70, 800 * 0.85 ** (p.level - 1));
  const active = () => (mode === 2 ? players : players.slice(0, 1));
  const opponent = (p) => players[1 - players.indexOf(p)];

  // Both players read one shared sequence of shuffled 7-piece bags, so they get
  // the same pieces in the same order and droughts stay short.
  const take = (p) => {
    while (p.seq >= queue.length) {
      const bag = Object.keys(SHAPES);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      queue.push(...bag);
    }
    return queue[p.seq++];
  };

  const spawn = (id) => {
    const m = SHAPES[id].map((row) => row.slice());
    return { id, m, x: Math.floor((COLS - m[0].length) / 2), y: id === 'I' ? -1 : 0 };
  };

  // Cells above the board (y < 0) are allowed so pieces can spawn and rotate there.
  const fits = (p, m, x, y) => m.every((row, r) => row.every((v, c) => {
    if (!v) return true;
    const gx = x + c;
    const gy = y + r;
    return gx >= 0 && gx < COLS && gy < ROWS && (gy < 0 || !p.grid[gy][gx]);
  }));

  const rotated = (m, dir) => {
    const t = m[0].map((_, c) => m.map((row) => row[c]));
    return dir > 0 ? t.map((row) => row.reverse()) : t.reverse();
  };

  const dropY = (p) => {
    let y = p.piece.y;
    while (fits(p, p.piece.m, p.piece.x, y + 1)) y++;
    return y;
  };

  /* ---------- Drawing ---------- */

  const fitCanvas = (canvas, cols, rows) => {
    const w = Math.round(canvas.clientWidth * (window.devicePixelRatio || 1));
    if (!w) return;
    canvas.width = w;
    canvas.height = Math.round((w * rows) / cols);
  };

  const block = (c, x, y, s, color, ghost) => {
    const gap = Math.max(1, s * 0.06);
    const px = x * s + gap;
    const py = y * s + gap;
    const size = s - gap * 2;
    c.beginPath();
    if (c.roundRect) c.roundRect(px, py, size, size, s * 0.14);
    else c.rect(px, py, size, size);
    if (ghost) {
      c.globalAlpha = 0.45;
      c.lineWidth = Math.max(1, s * 0.07);
      c.strokeStyle = color;
      c.stroke();
      c.globalAlpha = 1;
      return;
    }
    c.fillStyle = color;
    c.fill();
    c.fillStyle = 'rgba(255, 255, 255, .22)';
    c.fillRect(px + size * 0.12, py + size * 0.1, size * 0.76, size * 0.14);
  };

  const eachCell = (m, fn) => m.forEach((row, r) => row.forEach((v, c) => v && fn(c, r)));

  const draw = (p) => {
    const { ctx, board, grid, piece } = p;
    const s = board.width / COLS;
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, board.width, board.height);

    ctx.strokeStyle = 'rgba(255, 242, 225, .06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(Math.round(x * s) + 0.5, 0);
      ctx.lineTo(Math.round(x * s) + 0.5, board.height);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, Math.round(y * s) + 0.5);
      ctx.lineTo(board.width, Math.round(y * s) + 0.5);
    }
    ctx.stroke();

    grid.forEach((row, y) => row.forEach((id, x) => id && block(ctx, x, y, s, COLORS[id])));

    if (piece) {
      const color = COLORS[piece.id];
      const gy = dropY(p);
      if (gy !== piece.y) eachCell(piece.m, (c, r) => gy + r >= 0 && block(ctx, piece.x + c, gy + r, s, color, true));
      eachCell(piece.m, (c, r) => piece.y + r >= 0 && block(ctx, piece.x + c, piece.y + r, s, color));
    }

    // Incoming garbage meter along the right edge.
    if (p.garbage) {
      const h = Math.min(ROWS, p.garbage) * s;
      ctx.fillStyle = COLORS.Z;
      ctx.fillRect(board.width - s * 0.14, board.height - h, s * 0.14, h);
    }
  };

  // Next piece, centred on a 4x2 preview.
  const drawNext = (p) => {
    const { nctx, preview, next } = p;
    nctx.clearRect(0, 0, preview.width, preview.height);
    if (!next) return;
    const cells = [];
    eachCell(SHAPES[next], (c, r) => cells.push([c, r]));
    const minC = Math.min(...cells.map(([c]) => c));
    const minR = Math.min(...cells.map(([, r]) => r));
    const w = Math.max(...cells.map(([c]) => c)) - minC + 1;
    const h = Math.max(...cells.map(([, r]) => r)) - minR + 1;
    const s = preview.width / 4;
    cells.forEach(([c, r]) => block(nctx, c - minC + (4 - w) / 2, r - minR + (2 - h) / 2, s, COLORS[next]));
  };

  const updateStats = (p) => {
    p.out('score').textContent = fmt(p.score);
    p.out('best').textContent = fmt(Math.max(best, p.score));
    p.out('lines').textContent = fmt(p.lines);
    p.out('level').textContent = p.level;
    drawNext(p);
  };

  /* ---------- Game flow ---------- */

  const showOverlay = (text, label) => {
    msg.textContent = text;
    startBtn.textContent = label;
    overlay.hidden = false;
  };

  // Held moves repeat on the game's own timers, so two players holding keys at
  // once both keep repeating (the OS only auto-repeats the last key pressed).
  const held = new Map();
  const release = (id) => {
    clearTimeout(held.get(id));
    held.delete(id);
  };
  const releaseAll = () => {
    held.forEach((t) => clearTimeout(t));
    held.clear();
  };

  const finish = (text) => {
    state = 'over';
    overAt = performance.now();
    cancelAnimationFrame(raf);
    releaseAll();
    active().forEach((p) => {
      p.piece = null;
      updateStats(p);
      draw(p);
    });
    showOverlay(text, 'Play again');
  };

  const lose = (p) => {
    if (mode === 2) {
      finish(`${opponent(p).name} player wins!`);
      return;
    }
    if (p.score > best) {
      best = p.score;
      saveBest(best);
    }
    finish(`Game over · ${fmt(p.score)} points`);
  };

  // Push pending garbage rows (one shared hole) up from the bottom.
  // Returns true if that shoves blocks off the top.
  const addGarbage = (p) => {
    const n = Math.min(p.garbage, ROWS);
    if (!n) return false;
    const hole = Math.floor(Math.random() * COLS);
    const overflow = p.grid.slice(0, n).some((row) => row.some(Boolean));
    const rows = Array.from({ length: n }, () => Array.from({ length: COLS }, (_, c) => (c === hole ? null : 'G')));
    p.grid = [...p.grid.slice(n), ...rows];
    p.garbage = 0;
    return overflow;
  };

  const lock = (p) => {
    const { piece } = p;
    let toppedOut = piece.m.some((row, r) => piece.y + r < 0 && row.some(Boolean));
    eachCell(piece.m, (c, r) => {
      if (piece.y + r >= 0) p.grid[piece.y + r][piece.x + c] = piece.id;
    });

    const kept = p.grid.filter((row) => !row.every(Boolean));
    const cleared = ROWS - kept.length;
    if (cleared) {
      p.grid = [...Array.from({ length: cleared }, () => Array(COLS).fill(null)), ...kept];
      p.lines += cleared;
      p.score += LINE_POINTS[cleared] * p.level;
      p.level = Math.floor(p.lines / 10) + 1;
    }

    if (mode === 2) {
      // Clears cancel incoming garbage first; the rest goes to the opponent.
      // Garbage still pending lands when a piece locks without clearing.
      const sent = GARBAGE[cleared];
      const cancel = Math.min(sent, p.garbage);
      p.garbage -= cancel;
      opponent(p).garbage += sent - cancel;
      if (!cleared && addGarbage(p)) toppedOut = true;
    }

    p.piece = spawn(p.next);
    p.next = take(p);
    p.dropAcc = 0;
    updateStats(p);
    if (toppedOut || !fits(p, p.piece.m, p.piece.x, p.piece.y)) lose(p);
  };

  // One row down; locks the piece when it lands. Returns whether it moved.
  const fall = (p) => {
    if (fits(p, p.piece.m, p.piece.x, p.piece.y + 1)) {
      p.piece.y++;
      return true;
    }
    lock(p);
    return false;
  };

  const move = (p, dx) => {
    if (fits(p, p.piece.m, p.piece.x + dx, p.piece.y)) p.piece.x += dx;
  };

  const turn = (p, dir) => {
    const m = rotated(p.piece.m, dir);
    const kick = KICKS.find(([dx, dy]) => fits(p, m, p.piece.x + dx, p.piece.y + dy));
    if (!kick) return;
    p.piece.m = m;
    p.piece.x += kick[0];
    p.piece.y += kick[1];
  };

  const softDrop = (p) => {
    if (fall(p)) p.score += 1;
    p.dropAcc = 0;
    updateStats(p);
  };

  const hardDrop = (p) => {
    const y = dropY(p);
    p.score += (y - p.piece.y) * 2;
    p.piece.y = y;
    lock(p);
  };

  const tick = (t) => {
    if (state !== 'playing') return;
    const dt = t - lastTime;
    lastTime = t;
    for (const p of active()) {
      p.dropAcc += dt;
      if (p.dropAcc >= interval(p)) {
        p.dropAcc = 0;
        fall(p);
        if (state !== 'playing') return;
      }
    }
    active().forEach(draw);
    raf = requestAnimationFrame(tick);
  };

  const resume = () => {
    state = 'playing';
    stage.focus({ preventScroll: true });
    overlay.hidden = true;
    lastTime = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };

  const reset = () => {
    queue = [];
    players.forEach((p) => Object.assign(p, {
      grid: emptyGrid(), piece: null, next: null, seq: 0,
      score: 0, lines: 0, level: 1, dropAcc: 0, garbage: 0,
    }));
  };

  const start = () => {
    reset();
    active().forEach((p) => {
      p.piece = spawn(take(p));
      p.next = take(p);
      updateStats(p);
    });
    resume();
  };

  const pause = () => {
    if (state !== 'playing') return;
    state = 'paused';
    cancelAnimationFrame(raf);
    releaseAll();
    showOverlay('Paused', 'Resume');
  };

  const startOrResume = () => (state === 'paused' ? resume() : start());

  // Switching mode abandons the current game and shows a fresh board(s).
  const setMode = (n) => {
    mode = n;
    root.classList.toggle('is-duo', n === 2);
    modeBtns.forEach((b) => {
      const on = Number(b.dataset.mode) === n;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    cancelAnimationFrame(raf);
    releaseAll();
    state = 'idle';
    reset();
    players.forEach((p) => {
      updateStats(p);
      draw(p);
    });
    showOverlay(IDLE_MSG[n], 'Start game');
  };

  /* ---------- Input ---------- */

  const ACTIONS = {
    left: (p) => move(p, -1),
    right: (p) => move(p, 1),
    down: softDrop,
    rotate: (p) => turn(p, 1),
    rotateBack: (p) => turn(p, -1),
    drop: hardDrop,
  };

  const press = (id, who, act) => {
    const p = players[who];
    const again = (delay) => held.set(id, setTimeout(() => {
      if (state !== 'playing') return;
      ACTIONS[act](p);
      again(ARR);
    }, delay));
    release(id);
    ACTIONS[act](p);
    if (REPEATS.has(act) && state === 'playing') again(DAS);
  };

  // Keys only reach the game while it has focus, so the page scrolls normally otherwise.
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('button') && (e.code === 'Enter' || e.code === 'Space')) return;
    const [who, act] = (mode === 2 ? DUO_KEYS : SOLO_KEYS)[e.code] || [];
    if (state !== 'playing') {
      const isStart = e.code === 'Enter' || e.code === 'NumpadEnter';
      if (!isStart && !(state === 'paused' && act === 'pause')) return;
      e.preventDefault();
      // A short grace period stops a late hard-drop Enter from restarting at once.
      if (e.repeat || (state === 'over' && performance.now() - overAt < 800)) return;
      startOrResume();
      return;
    }
    if (!act) return;
    e.preventDefault();
    if (e.repeat) return;
    if (act === 'pause') pause();
    else press(e.code, who, act);
  });
  root.addEventListener('keyup', (e) => release(e.code));

  // Touch pad (left player): tap to act, hold left/right/down to repeat.
  root.querySelectorAll('[data-act]').forEach((b) => {
    const act = b.dataset.act;
    const id = `pad-${act}`;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (state !== 'playing') return;
      if (act === 'pause') pause();
      else press(id, 0, act);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => b.addEventListener(type, () => release(id)));
  });

  startBtn.addEventListener('click', startOrResume);
  modeBtns.forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.mode);
    if (n !== mode) setMode(n);
  }));

  // Pause whenever the players' attention goes elsewhere.
  root.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !root.contains(e.relatedTarget)) pause();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!root.contains(e.target)) pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('blur', pause);

  const resize = () => players.forEach((p) => {
    fitCanvas(p.board, COLS, ROWS);
    fitCanvas(p.preview, 4, 2);
    draw(p);
    drawNext(p);
  });
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(resize);
    players.forEach((p) => ro.observe(p.board));
  }
  setMode(1);
  resize();
})();
