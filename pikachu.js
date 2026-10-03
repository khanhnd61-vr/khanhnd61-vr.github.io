// Pikachu (connect-two) for the Play section: clear the board by joining pairs
// of matching aliens with a path of at most three straight lines that only
// crosses empty space, including the gap around the board. Each level changes
// how the tiles left behind move after a match: none, down, up, left, right,
// then two gravities at once. The aliens come from assets/moon-aliens.png, a
// 5 x 4 sheet of 20 creatures.
(() => {
  const root = document.querySelector('[data-pika]');
  if (!root) return;

  const COLS = 12;
  const ROWS = 8;
  const KINDS = 20;
  const CELL = 48; // board units per tile
  const MARGIN = CELL * 0.75; // room around the board for paths that go outside it
  const W = COLS * CELL + 2 * MARGIN;
  const H = ROWS * CELL + 2 * MARGIN;
  const TIME = 240; // seconds per level
  const HINTS = 5; // per level
  const SHUFFLES = 3; // per level, on top of the free ones when no move is left
  const MATCH = 10; // points for a pair, times the combo
  const COMBO_WINDOW = 2500; // ms between matches that keep the combo going
  const LINK = 320; // ms the joining line stays before the pair goes
  const BEST_KEY = 'pika-best';
  const SHEET = { src: 'assets/moon-aliens.png', cols: 5, rows: 4, inset: 0.025 };
  const SPRITE = 128; // px each alien is pre-scaled to
  const BOARD_BG = '#3d250c';

  // How the tiles still on the board move after each match. A pull is a
  // direction and, for the split levels, the half of the board it acts on;
  // two pulls in a row give the corner levels.
  const LEVELS = [
    { name: 'Still', about: 'Nothing moves: a plain board.', pulls: [] },
    { name: 'Down', about: 'The tiles fall down.', pulls: [['down']] },
    { name: 'Up', about: 'The tiles rise to the top.', pulls: [['up']] },
    { name: 'Left', about: 'The tiles slide to the left.', pulls: [['left']] },
    { name: 'Right', about: 'The tiles slide to the right.', pulls: [['right']] },
    { name: 'Apart ↑↓', about: 'The top half rises, the bottom half falls.', pulls: [['up', 'top'], ['down', 'bottom']] },
    { name: 'Together ↓↑', about: 'Both halves close in on the middle row.', pulls: [['down', 'top'], ['up', 'bottom']] },
    { name: 'Apart ←→', about: 'The left half slides left, the right half right.', pulls: [['left', 'left'], ['right', 'right']] },
    { name: 'Together →←', about: 'Both halves close in on the middle column.', pulls: [['right', 'left'], ['left', 'right']] },
    { name: 'Down, left', about: 'Two gravities: the tiles fall, then slide left.', pulls: [['down'], ['left']] },
    { name: 'Up, right', about: 'Two gravities: the tiles rise, then slide right.', pulls: [['up'], ['right']] },
    { name: 'Down, right', about: 'Two gravities: the tiles fall, then slide right.', pulls: [['down'], ['right']] },
    { name: 'Up, left', about: 'Two gravities: the tiles rise, then slide left.', pulls: [['up'], ['left']] },
  ];

  const stage = root.querySelector('[data-stage]');
  const canvas = root.querySelector('[data-board]');
  const overlay = root.querySelector('[data-overlay]');
  const msg = root.querySelector('[data-msg]');
  const startBtn = root.querySelector('[data-start]');
  const hintBtn = root.querySelector('[data-hint]');
  const shuffleBtn = root.querySelector('[data-shuffle]');
  const newBtn = root.querySelector('[data-new]');
  const prevBtn = root.querySelector('[data-level-prev]');
  const nextBtn = root.querySelector('[data-level-next]');
  const timeBar = root.querySelector('[data-timebar]');
  const timeFill = root.querySelector('[data-time-fill]');
  const out = (k) => root.querySelector(`[data-out="${k}"]`);
  const ctx = canvas.getContext('2d');

  const loadBest = () => {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  };
  const saveBest = (n) => {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* storage unavailable */ }
  };

  /* ---------- State ---------- */

  // board[r][c] is 0 for an empty cell or the kind of the tile there, 1..KINDS.
  let board = [];
  let level = 0; // index into LEVELS
  let state = 'idle'; // idle | playing | paused | cleared | over | done
  let score = 0;
  let levelScore = 0; // score when the level began, for a retry
  let best = loadBest();
  let timeLeft = TIME;
  let hints = HINTS;
  let shuffles = SHUFFLES;
  let combo = 0;
  let lastMatch = 0;
  let selected = null; // [r, c]
  let hint = null; // [[r, c], [r, c]] shown until the next match
  let link = null; // { path, until } while a matched pair is being cleared
  let cursor = null; // [r, c] moved with the arrow keys
  let note = ''; // short line under the board, e.g. after a free shuffle
  let noteUntil = 0;
  let raf = 0;
  let lastTime = 0;
  let scale = 1;
  let pending = false; // the start button was pressed before the sheet arrived

  const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  /* ---------- Sprites ---------- */

  // Each alien is cut out of the sheet (skipping the thin grid lines at the
  // cell edges) and scaled once to SPRITE px, so drawing the board stays cheap.
  const sprites = [];
  let sheet = null; // 'loading' | 'ready' | 'failed'
  const loadSheet = () => {
    if (sheet) return;
    sheet = 'loading';
    const img = new Image();
    img.onload = () => {
      const cw = img.naturalWidth / SHEET.cols;
      const ch = img.naturalHeight / SHEET.rows;
      const ix = cw * SHEET.inset;
      const iy = ch * SHEET.inset;
      for (let k = 0; k < KINDS; k++) {
        const c = document.createElement('canvas');
        c.width = SPRITE;
        c.height = SPRITE;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, (k % SHEET.cols) * cw + ix, Math.floor(k / SHEET.cols) * ch + iy, cw - 2 * ix, ch - 2 * iy, 0, 0, SPRITE, SPRITE);
        sprites[k + 1] = c;
      }
      sheet = 'ready';
      startBtn.disabled = false;
      if (pending) start();
      else if (state === 'idle') showIdle();
      draw(performance.now());
    };
    img.onerror = () => {
      sheet = 'failed';
      pending = false;
      startBtn.disabled = true;
      showOverlay('The aliens could not be loaded. Check assets/moon-aliens.png.', 'Start level');
    };
    img.src = SHEET.src;
  };

  /* ---------- Board ---------- */

  // Cells outside the board count as empty: paths may go around the edge.
  const free = (r, c) => r < 0 || c < 0 || r >= ROWS || c >= COLS || board[r][c] === 0;

  // Every cell strictly between two points on one row or column is empty.
  const clear = (r1, c1, r2, c2) => {
    if (r1 === r2) {
      const [a, b] = c1 < c2 ? [c1, c2] : [c2, c1];
      for (let c = a + 1; c < b; c++) if (!free(r1, c)) return false;
      return true;
    }
    if (c1 === c2) {
      const [a, b] = r1 < r2 ? [r1, r2] : [r2, r1];
      for (let r = a + 1; r < b; r++) if (!free(r, c1)) return false;
      return true;
    }
    return false;
  };

  // The corners of a path from tile a to tile b with at most two turns, or
  // null. Tried shortest first: straight, one corner, then two corners that
  // share a column (anywhere from just outside the left edge to just outside
  // the right) or a row.
  const findPath = (a, b) => {
    const [r1, c1] = a;
    const [r2, c2] = b;
    if ((r1 === r2 || c1 === c2) && clear(r1, c1, r2, c2)) return [a, b];
    for (const [cr, cc] of [[r1, c2], [r2, c1]]) {
      if (free(cr, cc) && clear(r1, c1, cr, cc) && clear(cr, cc, r2, c2)) return [a, [cr, cc], b];
    }
    for (let k = -1; k <= COLS; k++) {
      if (k === c1 || k === c2) continue;
      if (free(r1, k) && free(r2, k) && clear(r1, c1, r1, k) && clear(r1, k, r2, k) && clear(r2, k, r2, c2)) {
        return [a, [r1, k], [r2, k], b];
      }
    }
    for (let k = -1; k <= ROWS; k++) {
      if (k === r1 || k === r2) continue;
      if (free(k, c1) && free(k, c2) && clear(r1, c1, k, c1) && clear(k, c1, k, c2) && clear(k, c2, r2, c2)) {
        return [a, [k, c1], [k, c2], b];
      }
    }
    return null;
  };

  const tilesLeft = () => board.flat().filter(Boolean).length;

  // Any pair that can be joined right now, or null.
  const findMove = () => {
    const byKind = new Map();
    board.forEach((row, r) => row.forEach((k, c) => {
      if (!k) return;
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k).push([r, c]);
    }));
    for (const cells of byKind.values()) {
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          if (findPath(cells[i], cells[j])) return [cells[i], cells[j]];
        }
      }
    }
    return null;
  };

  // Rearrange the tiles that are left among the cells they occupy, until a
  // move exists. The last resort of exact repeats cannot happen in practice:
  // some arrangement of two or more pairs always connects.
  const reshuffle = () => {
    const cells = [];
    const kinds = [];
    board.forEach((row, r) => row.forEach((k, c) => {
      if (!k) return;
      cells.push([r, c]);
      kinds.push(k);
    }));
    for (let tries = 0; tries < 200; tries++) {
      shuffle(kinds);
      cells.forEach(([r, c], i) => { board[r][c] = kinds[i]; });
      if (findMove()) return;
    }
  };

  // A fresh board: every cell filled, each kind in pairs, with a move to make.
  const deal = () => {
    const kinds = [];
    for (let i = 0; i < (ROWS * COLS) / 2; i++) kinds.push((i % KINDS) + 1, (i % KINDS) + 1);
    board = range(0, ROWS).map(() => range(0, COLS).map(() => 0));
    board.forEach((row, r) => row.forEach((_, c) => { board[r][c] = kinds[r * COLS + c]; }));
    reshuffle();
  };

  // Slide the tiles in each line of the pulled half (or the whole board) up
  // against the side the pull points to, keeping their order.
  const applyPull = ([dir, half]) => {
    const vertical = dir === 'up' || dir === 'down';
    const n = vertical ? ROWS : COLS;
    let along = range(0, n);
    if (half === 'top' || half === 'left') along = range(0, n / 2);
    if (half === 'bottom' || half === 'right') along = range(n / 2, n);
    if (dir === 'down' || dir === 'right') along.reverse(); // the first index is the floor
    range(0, vertical ? COLS : ROWS).forEach((k) => {
      const at = (i) => (vertical ? [i, k] : [k, i]);
      const tiles = along.map((i) => { const [r, c] = at(i); return board[r][c]; }).filter(Boolean);
      along.forEach((i, j) => { const [r, c] = at(i); board[r][c] = tiles[j] || 0; });
    });
  };

  /* ---------- Drawing ---------- */

  const cellX = (c) => MARGIN + c * CELL;
  const cellY = (r) => MARGIN + r * CELL;
  const centre = ([r, c]) => [cellX(c) + CELL / 2, cellY(r) + CELL / 2];
  const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

  const rrect = (x, y, w, h, rad) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, rad);
    else ctx.rect(x, y, w, h);
  };

  const tile = (r, c, kind, t) => {
    const x = cellX(c);
    const y = cellY(r);
    const picked = same(selected, [r, c]) || (link && (same(link.path[0], [r, c]) || same(link.path[link.path.length - 1], [r, c])));
    const hinted = hint && (same(hint[0], [r, c]) || same(hint[1], [r, c]));
    ctx.fillStyle = 'rgba(0, 0, 0, .28)';
    rrect(x + 3, y + 5, CELL - 6, CELL - 6, 7);
    ctx.fill();
    ctx.fillStyle = picked ? '#ffe3ad' : hinted ? '#fff0c8' : '#fff6e8';
    rrect(x + 3, y + 3, CELL - 6, CELL - 6, 7);
    ctx.fill();
    if (picked || hinted) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = picked ? '#e2a963' : `rgba(244, 193, 93, ${0.8 + 0.2 * Math.sin(t / 160)})`;
      rrect(x + 4.5, y + 4.5, CELL - 9, CELL - 9, 6);
      ctx.stroke();
    }
    const img = sprites[kind];
    if (img) ctx.drawImage(img, x + 7, y + 6, CELL - 14, CELL - 14);
  };

  const draw = (t) => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, W, H);
    // A faint frame where the board sits, so the gap around it reads as part of the play area.
    ctx.strokeStyle = 'rgba(255, 242, 225, .12)';
    ctx.lineWidth = 1;
    rrect(MARGIN - 6, MARGIN - 6, COLS * CELL + 12, ROWS * CELL + 12, 10);
    ctx.stroke();

    board.forEach((row, r) => row.forEach((k, c) => { if (k) tile(r, c, k, t); }));

    if (cursor && state === 'playing') {
      ctx.strokeStyle = 'rgba(141, 176, 126, .95)';
      ctx.lineWidth = 2.5;
      rrect(cellX(cursor[1]) + 1.5, cellY(cursor[0]) + 1.5, CELL - 3, CELL - 3, 9);
      ctx.stroke();
    }

    if (link) {
      ctx.strokeStyle = '#f4c15d';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      link.path.forEach((p, i) => {
        const [x, y] = centre(p);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }

    if (note && t < noteUntil) {
      ctx.font = '600 13px "Space Grotesk", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2b1a08';
      ctx.fillRect(W / 2 - 110, H / 2 - 16, 220, 32);
      ctx.fillStyle = '#f4c15d';
      ctx.fillText(note, W / 2, H / 2);
    }
  };

  const fmtTime = (s) => {
    const t = Math.max(0, Math.ceil(s));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };

  const updateStats = () => {
    const l = LEVELS[level];
    out('score').textContent = score;
    out('best').textContent = best || '-';
    out('level').textContent = `${level + 1} / ${LEVELS.length}`;
    out('gravity').textContent = l.name;
    out('levelname').textContent = `Level ${level + 1} · ${l.name}`;
    out('pairs').textContent = tilesLeft() / 2;
    out('time').textContent = fmtTime(timeLeft);
    const frac = Math.max(0, timeLeft / TIME);
    timeFill.style.width = `${frac * 100}%`;
    timeBar.classList.toggle('is-low', timeLeft <= 30);
    hintBtn.textContent = `Hint (${hints})`;
    shuffleBtn.textContent = `Shuffle (${shuffles})`;
    hintBtn.disabled = state !== 'playing' || hints <= 0;
    shuffleBtn.disabled = state !== 'playing' || shuffles <= 0;
    prevBtn.disabled = level === 0;
    nextBtn.disabled = level === LEVELS.length - 1;
  };

  const say = (text) => {
    note = text;
    noteUntil = performance.now() + 1600;
  };

  /* ---------- Play ---------- */

  const showOverlay = (text, label) => {
    msg.textContent = text;
    startBtn.textContent = label;
    overlay.hidden = false;
  };

  const showIdle = () => {
    const l = LEVELS[level];
    showOverlay(`Level ${level + 1}, ${l.name.toLowerCase()}: ${l.about}`, sheet === 'ready' ? 'Start level' : 'Loading the aliens…');
    startBtn.disabled = sheet !== 'ready';
  };

  const run = () => {
    lastTime = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };

  const stopLoop = () => {
    cancelAnimationFrame(raf);
    selected = null;
    link = null;
  };

  // Set the board up for the current level; the score carries over.
  const start = () => {
    if (sheet !== 'ready') {
      pending = true;
      loadSheet();
      showIdle();
      return;
    }
    pending = false;
    deal();
    levelScore = score;
    timeLeft = TIME;
    hints = HINTS;
    shuffles = SHUFFLES;
    combo = 0;
    hint = null;
    cursor = null;
    note = '';
    resume();
  };

  const resume = () => {
    state = 'playing';
    overlay.hidden = true;
    stage.focus({ preventScroll: true });
    updateStats();
    run();
  };

  const pause = () => {
    if (state !== 'playing') return;
    state = 'paused';
    stopLoop();
    updateStats();
    draw(performance.now());
    showOverlay('Paused', 'Resume');
  };

  const finishLevel = () => {
    const bonus = Math.ceil(timeLeft);
    score += bonus;
    if (score > best) {
      best = score;
      saveBest(best);
    }
    stopLoop();
    draw(performance.now());
    if (level + 1 < LEVELS.length) {
      state = 'cleared';
      showOverlay(`Level ${level + 1} cleared, +${bonus} for the time left. Next: ${LEVELS[level + 1].name.toLowerCase()}.`, 'Next level');
    } else {
      state = 'done';
      showOverlay(`All ${LEVELS.length} levels cleared! Final score ${score}.`, 'Play again');
    }
    updateStats();
  };

  const timeOut = () => {
    state = 'over';
    timeLeft = 0;
    stopLoop();
    draw(performance.now());
    showOverlay(`Time's up on level ${level + 1}, ${LEVELS[level].name.toLowerCase()}.`, 'Try again');
    updateStats();
  };

  // Called when nothing can be joined any more: a free shuffle.
  const stuck = () => {
    if (!tilesLeft()) return;
    reshuffle();
    hint = null;
    say('No move left: shuffled');
  };

  // Take the matched pair off the board, let the tiles fall, then see where that leaves us.
  const settle = () => {
    const a = link.path[0];
    const b = link.path[link.path.length - 1];
    board[a[0]][a[1]] = 0;
    board[b[0]][b[1]] = 0;
    link = null;
    LEVELS[level].pulls.forEach(applyPull);
    if (!tilesLeft()) {
      finishLevel();
      return;
    }
    if (!findMove()) stuck();
    updateStats();
  };

  const match = (a, b) => {
    const path = findPath(a, b);
    if (!path) return false;
    const now = performance.now();
    combo = now - lastMatch < COMBO_WINDOW ? combo + 1 : 1;
    lastMatch = now;
    score += MATCH * combo;
    if (combo > 1) say(`Combo ×${combo}`);
    if (score > best) {
      best = score;
      saveBest(best);
    }
    selected = null;
    hint = null;
    link = { path, until: now + LINK };
    updateStats();
    return true;
  };

  // Pick a tile: the first of a pair, or the second if it joins the first.
  const pick = (r, c) => {
    if (state !== 'playing' || link) return;
    if (!board[r]?.[c]) {
      selected = null;
      return;
    }
    if (same(selected, [r, c])) {
      selected = null;
      return;
    }
    if (selected && board[selected[0]][selected[1]] === board[r][c] && match(selected, [r, c])) return;
    selected = [r, c];
  };

  const useHint = () => {
    if (state !== 'playing' || hints <= 0 || link) return;
    const move = findMove();
    if (!move) {
      stuck();
      return;
    }
    hints--;
    hint = move;
    selected = null;
    updateStats();
  };

  const useShuffle = () => {
    if (state !== 'playing' || shuffles <= 0 || link) return;
    shuffles--;
    reshuffle();
    hint = null;
    selected = null;
    say('Shuffled');
    updateStats();
  };

  const tick = (t) => {
    if (state !== 'playing') return;
    const dt = Math.max(0, Math.min(100, t - lastTime)); // the first frame stamp can predate run()
    lastTime = t;
    timeLeft -= dt / 1000;
    if (link && t >= link.until) settle();
    if (state !== 'playing') return;
    if (timeLeft <= 0) {
      timeOut();
      return;
    }
    out('time').textContent = fmtTime(timeLeft);
    timeFill.style.width = `${Math.max(0, timeLeft / TIME) * 100}%`;
    timeBar.classList.toggle('is-low', timeLeft <= 30);
    draw(t);
    raf = requestAnimationFrame(tick);
  };

  // The start button: begin, resume, go on to the next level, or retry.
  const go = () => {
    if (state === 'paused') resume();
    else if (state === 'cleared') {
      level++;
      start();
    } else if (state === 'done') {
      level = 0;
      score = 0;
      start();
    } else if (state === 'over') {
      score = levelScore;
      start();
    } else start();
  };

  // Choosing a level puts away whatever game is going and begins afresh there.
  const setLevel = (n) => {
    level = Math.max(0, Math.min(LEVELS.length - 1, n));
    state = 'idle';
    stopLoop();
    score = 0;
    levelScore = 0;
    timeLeft = TIME;
    hints = HINTS;
    shuffles = SHUFFLES;
    hint = null;
    cursor = null;
    board = range(0, ROWS).map(() => range(0, COLS).map(() => 0));
    updateStats();
    draw(performance.now());
    showIdle();
  };

  /* ---------- Input ---------- */

  const cellAt = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const c = Math.floor((x - MARGIN) / CELL);
    const row = Math.floor((y - MARGIN) / CELL);
    return row >= 0 && row < ROWS && c >= 0 && c < COLS ? [row, c] : null;
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'playing') return;
    e.preventDefault();
    stage.focus({ preventScroll: true });
    const cell = cellAt(e);
    if (cell) {
      cursor = null;
      pick(...cell);
    } else selected = null;
  });

  // Keys only reach the game while it has focus, so the page scrolls normally otherwise.
  const MOVES = { ArrowUp: [-1, 0], KeyW: [-1, 0], ArrowDown: [1, 0], KeyS: [1, 0], ArrowLeft: [0, -1], KeyA: [0, -1], ArrowRight: [0, 1], KeyD: [0, 1] };
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('button') && (e.code === 'Enter' || e.code === 'Space')) return;
    if (state !== 'playing') {
      if ((e.code === 'Enter' || e.code === 'NumpadEnter' || (state === 'paused' && e.code === 'Space')) && !e.repeat) {
        e.preventDefault();
        if (sheet === 'ready') go();
      }
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (!e.repeat) pause();
    } else if (e.code === 'KeyH') {
      e.preventDefault();
      if (!e.repeat) useHint();
    } else if (MOVES[e.code]) {
      e.preventDefault();
      const [dr, dc] = MOVES[e.code];
      cursor = cursor
        ? [(cursor[0] + dr + ROWS) % ROWS, (cursor[1] + dc + COLS) % COLS]
        : [Math.floor(ROWS / 2), Math.floor(COLS / 2)];
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space' || e.code === 'KeyZ') {
      e.preventDefault();
      if (!e.repeat && cursor) pick(...cursor);
    }
  });

  startBtn.addEventListener('click', go);
  hintBtn.addEventListener('click', useHint);
  shuffleBtn.addEventListener('click', useShuffle);
  newBtn.addEventListener('click', () => setLevel(level));
  prevBtn.addEventListener('click', () => setLevel(level - 1));
  nextBtn.addEventListener('click', () => setLevel(level + 1));

  // Pause whenever the player's attention goes elsewhere.
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

  const fit = () => {
    const w = Math.round(canvas.clientWidth * (window.devicePixelRatio || 1));
    if (!w) return;
    canvas.width = w;
    canvas.height = Math.round((w * H) / W);
    scale = w / W;
    draw(performance.now());
  };
  // The dungeon (dungeon.js) puts this window away and brings it back; the
  // sheet is only fetched once the player first walks in.
  root.addEventListener('scene-exit', pause);
  root.addEventListener('scene-enter', () => {
    loadSheet();
    fit();
  });
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(canvas);
  if (!root.hidden) loadSheet();

  setLevel(0);
  fit();
})();
