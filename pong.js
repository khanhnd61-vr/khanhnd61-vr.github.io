// Pong for the Play section, first to 7. Single: you (left) against the
// computer (right). Duo: two players against each other on one keyboard, W/S
// for the left paddle and the arrow keys for the right one.
(() => {
  const root = document.querySelector('[data-pong]');
  if (!root) return;

  // The court has its own units; the canvas is scaled to whatever size it gets.
  const W = 480;
  const H = 300;
  const WIN = 7; // points to win a game
  const PAD_W = 8;
  const PAD_H = 56;
  const PAD_X = 16; // gap between each goal line and its paddle
  const BALL = 5; // half the ball's size
  const MOVE = 330; // paddle speed, units per second
  const SPEEDUP = 1.06; // ball speed gained on every paddle hit
  const MAX_SPEED = 660;
  const MAX_ANGLE = Math.PI / 3.2; // steepest return, off a paddle's tip
  const SERVE_WAIT = 900; // ms the ball waits in the middle before each serve
  const BEST_KEY = 'pong-best-rally';
  const COURT_BG = '#3d250c';
  const CPU_SPEED = 250; // the computer's paddle speed
  // How far off the ball's path the computer may aim; past 33 (half a paddle
  // plus the ball) it can whiff outright.
  const CPU_MISS = 38;
  const MODES = {
    1: { sides: ['You', 'CPU'], ball: 280, idle: 'First to 7 wins.' },
    2: { sides: ['Left', 'Right'], ball: 300, idle: 'Left (W/S) against right (↑/↓). First to 7 wins.' },
  };

  // Physical keys (KeyboardEvent.code) -> [paddle, direction]: 0 is the left
  // paddle, 1 the right. In single mode both sets move your paddle;
  // PadUp/PadDown come from the touch pad.
  const SOLO_KEYS = {
    KeyW: [0, -1], KeyS: [0, 1], ArrowUp: [0, -1], ArrowDown: [0, 1], PadUp: [0, -1], PadDown: [0, 1],
  };
  const DUO_KEYS = { KeyW: [0, -1], KeyS: [0, 1], ArrowUp: [1, -1], ArrowDown: [1, 1] };
  const PAUSE_KEYS = new Set(['Space', 'KeyP', 'Escape']);

  const stage = root.querySelector('[data-stage]');
  const court = root.querySelector('[data-court]');
  const overlay = root.querySelector('[data-overlay]');
  const msg = root.querySelector('[data-msg]');
  const startBtn = root.querySelector('[data-start]');
  const modeBtns = root.querySelectorAll('[data-mode]');
  const out = (k) => root.querySelector(`[data-out="${k}"]`);
  const ctx = court.getContext('2d');
  const touch = window.matchMedia?.('(pointer: coarse)');

  const loadBest = (m) => {
    try { return Number(localStorage.getItem(`${BEST_KEY}-${m}`)) || 0; } catch { return 0; }
  };
  const saveBest = (m, n) => {
    try { localStorage.setItem(`${BEST_KEY}-${m}`, String(n)); } catch { /* storage unavailable */ }
  };

  // The left paddle is always a player's; the right one is the computer's in
  // single mode and the second player's in duo.
  const paddles = [
    { x: PAD_X, y: 0, target: null, color: '#F4C15D' },
    { x: W - PAD_X - PAD_W, y: 0, target: null, color: '#D9745A' },
  ];
  const [left, right] = paddles;
  const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: 0 };

  let mode = 1;
  let state = 'idle'; // idle | playing | paused | over
  let score = [0, 0]; // left, right
  let rally = 0;
  let best = loadBest(1);
  let serveLeft = 0; // ms until the waiting ball is served
  let miss = 0; // how far off the ball's path the computer aims this time
  let raf = 0;
  let lastTime = 0;
  let overAt = 0;
  let scale = 1;
  const held = new Set(); // key codes held down
  const drags = new Map(); // pointer id -> index of the paddle it moves

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const human = (i) => i === 0 || mode === 2;

  const centrePaddles = () => paddles.forEach((p) => { p.y = (H - PAD_H) / 2; });

  /* ---------- Drawing ---------- */

  const rrect = (x, y, w, h, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  };

  const draw = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = COURT_BG;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255, 242, 225, .16)';
    for (let y = 8; y < H; y += 18) ctx.fillRect(W / 2 - 1, y, 2, 10); // net

    ctx.font = '600 44px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 242, 225, .12)';
    ctx.fillText(String(score[0]), W / 4, 16);
    ctx.fillText(String(score[1]), (W * 3) / 4, 16);

    paddles.forEach((p) => {
      ctx.fillStyle = p.color;
      rrect(p.x, p.y, PAD_W, PAD_H, 3);
    });

    // Which keys move which paddle, shown while the ball waits to be served.
    if (serveLeft > 0 || state !== 'playing') {
      ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 242, 225, .55)';
      ctx.textAlign = 'left';
      const solo = touch?.matches ? 'drag, or hold ↑ / ↓' : 'W / S  or  ↑ / ↓';
      ctx.fillText(mode === 2 ? 'W / S' : solo, left.x + PAD_W + 10, left.y + PAD_H / 2);
      if (mode === 2) {
        ctx.textAlign = 'right';
        ctx.fillText('↑ / ↓', right.x - 10, right.y + PAD_H / 2);
      }
    }

    ctx.fillStyle = '#FFF2E1';
    rrect(ball.x - BALL, ball.y - BALL, BALL * 2, BALL * 2, 2);
  };

  const updateStats = () => {
    out('sides').textContent = MODES[mode].sides.join(' : ');
    out('score').textContent = score.join(' : ');
    out('rally').textContent = rally;
    out('best').textContent = best;
  };

  /* ---------- Play ---------- */

  const aim = () => {
    miss = (Math.random() * 2 - 1) * CPU_MISS;
  };

  // Park the ball in the middle, then send it towards `dir` (-1 left, 1 right).
  const serve = (dir) => {
    const angle = (Math.random() * 2 - 1) * 0.35;
    ball.speed = MODES[mode].ball;
    Object.assign(ball, {
      x: W / 2, y: H / 2, vx: dir * ball.speed * Math.cos(angle), vy: ball.speed * Math.sin(angle),
    });
    serveLeft = SERVE_WAIT;
    rally = 0;
    aim();
  };

  // Where the ball will cross x, bouncing off the top and bottom walls.
  const predictY = (x) => {
    const t = (x - ball.x) / ball.vx;
    if (!(t > 0)) return ball.y;
    const span = H - 2 * BALL;
    let m = (ball.y - BALL + ball.vy * t) % (2 * span);
    if (m < 0) m += 2 * span;
    return BALL + (m > span ? 2 * span - m : m);
  };

  const movePaddles = (dt) => {
    const keys = mode === 2 ? DUO_KEYS : SOLO_KEYS;
    const dirs = [0, 0];
    held.forEach((code) => {
      const k = keys[code];
      if (k) dirs[k[0]] += k[1];
    });
    paddles.forEach((p, i) => {
      if (!human(i)) return;
      if (p.target !== null) p.y += clamp(p.target - p.y, -MOVE * 1.5 * dt, MOVE * 1.5 * dt); // following a finger
      else p.y += clamp(dirs[i], -1, 1) * MOVE * dt;
      p.y = clamp(p.y, 0, H - PAD_H);
    });
    if (mode === 2) return;

    // The computer chases the ball on its way over and drifts back to the middle otherwise.
    const coming = ball.vx > 0 && serveLeft <= 0;
    const goal = (coming ? predictY(right.x - BALL) + miss : H / 2) - PAD_H / 2;
    const reach = CPU_SPEED * dt * (coming ? 1 : 0.5);
    right.y = clamp(right.y + clamp(goal - right.y, -reach, reach), 0, H - PAD_H);
  };

  // Touching paddle p from the front (the ball's middle has not passed the paddle's).
  const hits = (p, dir) => ball.y + BALL > p.y && ball.y - BALL < p.y + PAD_H
    && ball.x + BALL > p.x && ball.x - BALL < p.x + PAD_W
    && (dir > 0 ? ball.x >= p.x + PAD_W / 2 : ball.x <= p.x + PAD_W / 2);

  // Send the ball back off paddle p: the further from its middle, the steeper.
  const bounce = (p, dir) => {
    const off = clamp((ball.y - (p.y + PAD_H / 2)) / (PAD_H / 2 + BALL), -1, 1);
    ball.speed = Math.min(MAX_SPEED, ball.speed * SPEEDUP);
    ball.vx = dir * ball.speed * Math.cos(off * MAX_ANGLE);
    ball.vy = ball.speed * Math.sin(off * MAX_ANGLE);
    ball.x = dir > 0 ? p.x + PAD_W + BALL : p.x - BALL;
    rally++;
    if (dir > 0) aim(); // a new ball for the computer to chase
    updateStats();
  };

  const moveBall = (h) => {
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    if (ball.y < BALL) {
      ball.y = 2 * BALL - ball.y;
      ball.vy = Math.abs(ball.vy);
    } else if (ball.y > H - BALL) {
      ball.y = 2 * (H - BALL) - ball.y;
      ball.vy = -Math.abs(ball.vy);
    }
    if (ball.vx < 0 && hits(left, 1)) bounce(left, 1);
    else if (ball.vx > 0 && hits(right, -1)) bounce(right, -1);
  };

  const showOverlay = (text, label) => {
    msg.textContent = text;
    startBtn.textContent = label;
    overlay.hidden = false;
  };

  const endDrags = () => {
    drags.clear();
    paddles.forEach((p) => { p.target = null; });
  };

  const finish = (winner) => {
    state = 'over';
    overAt = performance.now();
    cancelAnimationFrame(raf);
    held.clear();
    endDrags();
    draw();
    const final = score.join(' : ');
    if (mode === 2) showOverlay(`${MODES[2].sides[winner]} player wins! ${final}`, 'Play again');
    else if (winner === 0) showOverlay(`You win! ${final}`, 'Play again');
    else showOverlay(`The computer wins, ${final}.`, 'Play again');
  };

  // Side 0 (left) or 1 (right) takes the point.
  const point = (side) => {
    score[side]++;
    if (rally > best) {
      best = rally;
      saveBest(mode, best);
    }
    if (score[side] >= WIN) finish(side);
    else serve(side === 0 ? 1 : -1); // towards the side that lost the point
    updateStats();
  };

  const update = (dt) => {
    movePaddles(dt);
    if (serveLeft > 0) {
      serveLeft -= dt * 1000;
      return;
    }
    // Small steps, so a fast ball cannot skip through a paddle.
    const n = Math.max(1, Math.ceil((ball.speed * dt) / 3));
    for (let i = 0; i < n; i++) {
      moveBall(dt / n);
      if (ball.x < -BALL || ball.x > W + BALL) {
        point(ball.x < 0 ? 1 : 0);
        return;
      }
    }
  };

  const tick = (t) => {
    if (state !== 'playing') return;
    const dt = Math.max(0, Math.min(50, t - lastTime)) / 1000; // the first frame stamp can predate resume()
    lastTime = t;
    update(dt);
    draw();
    if (state === 'playing') raf = requestAnimationFrame(tick);
  };

  const resume = () => {
    state = 'playing';
    stage.focus({ preventScroll: true });
    overlay.hidden = true;
    lastTime = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    score = [0, 0];
    centrePaddles();
    // The first ball goes to you in single mode, to either player in duo.
    serve(mode === 2 && Math.random() < 0.5 ? 1 : -1);
    updateStats();
    resume();
  };

  const pause = () => {
    if (state !== 'playing') return;
    state = 'paused';
    cancelAnimationFrame(raf);
    held.clear();
    endDrags();
    draw();
    showOverlay('Paused', 'Resume');
  };

  const startOrResume = () => (state === 'paused' ? resume() : start());

  // Switching mode abandons the current game.
  const setMode = (n) => {
    mode = n;
    root.classList.toggle('is-duo', n === 2);
    modeBtns.forEach((b) => {
      const on = Number(b.dataset.mode) === n;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    right.color = n === 2 ? '#8DB07E' : '#D9745A';
    cancelAnimationFrame(raf);
    held.clear();
    endDrags();
    state = 'idle';
    best = loadBest(n);
    score = [0, 0];
    rally = 0;
    serveLeft = 0;
    centrePaddles();
    Object.assign(ball, { x: W / 2, y: H / 2, vx: 0, vy: 0 });
    updateStats();
    draw();
    showOverlay(MODES[n].idle, 'Start game');
  };

  /* ---------- Input ---------- */

  // Keys only reach the game while it has focus, so the page scrolls normally otherwise.
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('button') && (e.code === 'Enter' || e.code === 'Space')) return;
    if (state !== 'playing') {
      const isStart = e.code === 'Enter' || e.code === 'NumpadEnter';
      if (!isStart && !(state === 'paused' && PAUSE_KEYS.has(e.code))) return;
      e.preventDefault();
      // A short grace period stops a key still held from the last rally restarting at once.
      if (e.repeat || (state === 'over' && performance.now() - overAt < 800)) return;
      startOrResume();
      return;
    }
    if (PAUSE_KEYS.has(e.code)) {
      e.preventDefault();
      if (!e.repeat) pause();
    } else if ((mode === 2 ? DUO_KEYS : SOLO_KEYS)[e.code]) {
      e.preventDefault();
      held.add(e.code);
    }
  });
  root.addEventListener('keyup', (e) => held.delete(e.code));

  // Drag on the court to move your paddle; in duo mode, the one on that side.
  const courtPoint = (e) => {
    const r = court.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const follow = (e) => {
    paddles[drags.get(e.pointerId)].target = clamp(courtPoint(e)[1] - PAD_H / 2, 0, H - PAD_H);
  };
  court.addEventListener('pointerdown', (e) => {
    if (state !== 'playing') return;
    drags.set(e.pointerId, mode === 2 && courtPoint(e)[0] >= W / 2 ? 1 : 0);
    court.setPointerCapture?.(e.pointerId);
    follow(e);
  });
  court.addEventListener('pointermove', (e) => {
    if (drags.has(e.pointerId)) follow(e);
  });
  ['pointerup', 'pointercancel'].forEach((type) => court.addEventListener(type, (e) => {
    if (!drags.has(e.pointerId)) return;
    paddles[drags.get(e.pointerId)].target = null;
    drags.delete(e.pointerId);
  }));

  // Touch pad (single mode): hold ↑ or ↓ to move, ❚❚ to pause.
  root.querySelectorAll('[data-act]').forEach((b) => {
    const act = b.dataset.act;
    const code = act === 'up' ? 'PadUp' : 'PadDown';
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (state !== 'playing') return;
      if (act === 'pause') pause();
      else held.add(code);
    });
    if (act === 'pause') return;
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => b.addEventListener(type, () => held.delete(code)));
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

  const fit = () => {
    const w = Math.round(court.clientWidth * (window.devicePixelRatio || 1));
    if (!w) return;
    court.width = w;
    court.height = Math.round((w * H) / W);
    scale = w / W;
    draw();
  };
  // The dungeon (dungeon.js) puts this window away and brings it back.
  root.addEventListener('scene-exit', pause);
  root.addEventListener('scene-enter', fit);
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(court);

  setMode(1);
  fit();
})();
