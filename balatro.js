// Balatro-lite for the Play section: pick up to five cards from a hand of eight,
// the poker hand sets chips × mult, the jokers you collect bend the numbers,
// and every blind's target climbs until a run ends. No money, tarots or boss
// effects: just the scoring loop, kept small and fast.
(() => {
  const root = document.querySelector('[data-balatro]');
  if (!root) return;

  const SUITS = ['♠', '♥', '♣', '♦'];
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const CHIPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11];
  const HAND_SIZE = 8;
  const HANDS = 4;
  const DISCARDS = 3;
  const MAX_PLAY = 5;
  const MAX_JOKERS = 5;
  const ANTES = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];
  const BLINDS = [['Small Blind', 1], ['Big Blind', 1.5], ['Boss Blind', 2]];
  const BASE = {
    'High Card': [5, 1], Pair: [10, 2], 'Two Pair': [20, 2], 'Three of a Kind': [30, 3], Straight: [30, 4],
    Flush: [35, 4], 'Full House': [40, 4], 'Four of a Kind': [60, 7], 'Straight Flush': [100, 8],
  };
  const BEST_KEY = 'balatro-best';
  const SCORE_MS = 1000; // how long the played hand stays up with its score
  const SHEET_COLS = 9; // assets/jokers.png holds the 36 cards in a 9 x 4 grid, in JOKERS order

  /* ---------- Jokers ---------- */
  // Hooks: card(c, ctx, j) and hand(ctx, j) return { chips, mult, xmult } while
  // scoring; play(cards, ctx, j) returns extra cards for the hand; start(j)
  // returns extra discards for a new blind; round(j) runs after a blind is
  // beaten and returns false when the joker is used up. `copy` makes a joker
  // score as its neighbour (+1 right, -1 left). `n` is per-joker state.

  const isFace = (c) => c.r >= 9 && c.r <= 11;
  const label = (eff) => (eff.xmult ? `×${eff.xmult} Mult` : eff.mult ? `+${eff.mult} Mult` : `+${eff.chips} Chips`);
  const suit = (name, s) => ({ name, desc: `Scored ${SUITS[s]} cards give +3 Mult`, card: (c) => c.s === s && { mult: 3 } });
  const type = (name, kind, what, eff) => ({ name, desc: `${label(eff)} if the hand contains a ${what}`, hand: (ctx) => ctx.has[kind] && eff });
  const JOKERS = [
    { name: 'Joker', desc: '+4 Mult', hand: () => ({ mult: 4 }) },
    { name: 'Half Joker', desc: '+20 Mult if the hand has 3 or fewer cards', hand: (ctx) => ctx.cards.length <= 3 && { mult: 20 } },
    { name: 'Abstract Joker', desc: '+3 Mult per joker held', hand: (ctx) => ({ mult: 3 * ctx.jokers }) },
    { name: 'Misprint', desc: '+0 to +23 Mult, at random', hand: () => ({ mult: Math.floor(Math.random() * 24) }) },
    { name: 'Lucky Joker', desc: 'Each scored card has a 1 in 4 chance of +20 Mult', card: () => Math.random() < 0.25 && { mult: 20 } },
    { name: 'Money Tree', desc: '+4 Mult per hand left after this one', hand: (ctx) => ({ mult: 4 * ctx.hands }) },
    { name: 'Popcorn', desc: (j) => `+${j.n} Mult, loses 4 Mult each blind beaten`, n: 20, hand: (ctx, j) => ({ mult: j.n }), round: (j) => (j.n -= 4) > 0 },
    type('Jolly Joker', 'pair', 'Pair', { mult: 8 }),
    { name: 'Blueprint', desc: 'Scores as a copy of the joker to its right', copy: 1 },
    { name: 'DNA', desc: 'First hand of a blind: play exactly 1 card and a copy of it joins your hand', play: (cards, ctx) => (ctx.first && cards.length === 1 ? [{ ...cards[0] }] : []) },
    { name: 'Stone Joker', desc: '+25 Chips per card played, scoring or not', hand: (ctx) => ({ chips: 25 * ctx.cards.length }) },
    { name: 'Banana', desc: '+15 Mult. 1 in 6 chance of going bad after each blind', hand: () => ({ mult: 15 }), round: () => Math.random() >= 1 / 6 },
    type('The Duo', 'pair', 'Pair', { xmult: 2 }),
    type('The Trio', 'three', 'Three of a Kind', { xmult: 3 }),
    type('The Family', 'four', 'Four of a Kind', { xmult: 4 }),
    { name: 'Constellation', desc: (j) => `×${j.n} Mult, grows by ×0.1 each blind beaten`, n: 1, hand: (ctx, j) => j.n > 1 && { xmult: j.n }, round: (j) => { j.n = Math.round(j.n * 10 + 1) / 10; return true; } },
    { name: 'Crystal Ball', desc: '+1 discard every blind', start: () => 1 },
    type('Magician', 'three', 'Three of a Kind', { mult: 12 }),
    { name: 'Hanged Man', desc: '+4 Mult per discard used this blind', hand: (ctx) => ({ mult: 4 * ctx.used }) },
    suit('Death', 0),
    suit('The Sun', 1),
    suit('The Moon', 2),
    { name: 'Wheel of Fortune', desc: '1 in 4 chance of ×3 Mult', hand: () => Math.random() < 0.25 && { xmult: 3 } },
    type('Justice', 'twoPair', 'Two Pair', { mult: 10 }),
    { name: 'The Fool', desc: 'Scores as a copy of the joker to its left', copy: -1 },
    { name: 'Devil', desc: 'Scored face cards give +30 Chips', card: (c) => isFace(c) && { chips: 30 } },
    type('The Tower', 'straight', 'Straight', { mult: 12 }),
    suit('Star', 3),
    { name: 'Planet X', desc: '×1.5 Mult if you play 5 cards', hand: (ctx) => ctx.cards.length === 5 && { xmult: 1.5 } },
    type('Mercury', 'pair', 'Pair', { chips: 50 }),
    type('Venus', 'three', 'Three of a Kind', { chips: 100 }),
    type('Mars', 'twoPair', 'Two Pair', { chips: 80 }),
    type('Jupiter', 'flush', 'Flush', { chips: 80 }),
    type('Saturn', 'straight', 'Straight', { chips: 100 }),
    type('Uranus', 'flush', 'Flush', { xmult: 2 }),
    type('Neptune', 'straight', 'Straight', { xmult: 3 }),
  ];
  JOKERS.forEach((j, i) => { j.art = i; });
  const describe = (j) => (typeof j.desc === 'function' ? j.desc(j) : j.desc);

  /* ---------- Hand evaluation ---------- */

  // Which poker hand the cards make, which of them score, and what the hand
  // "contains" (a Full House contains a Pair, and so on) for the jokers.
  const evaluate = (cards) => {
    const byRank = new Map();
    cards.forEach((c) => byRank.set(c.r, [...(byRank.get(c.r) || []), c]));
    const groups = [...byRank.values()].sort((a, b) => b.length - a.length || b[0].r - a[0].r);
    const n = groups.map((g) => g.length);
    const flush = cards.length === 5 && cards.every((c) => c.s === cards[0].s);
    let straight = false;
    if (cards.length === 5 && byRank.size === 5) {
      const rs = [...byRank.keys()].sort((a, b) => a - b);
      straight = rs[4] - rs[0] === 4 || (rs[4] === 12 && rs[3] === 3); // A-2-3-4-5 counts
    }
    const has = {
      pair: n[0] >= 2, three: n[0] >= 3, four: n[0] >= 4,
      twoPair: n[0] >= 4 || (n[0] >= 2 && n[1] >= 2), straight, flush,
    };
    let name;
    let scoring;
    if (straight && flush) [name, scoring] = ['Straight Flush', cards];
    else if (has.four) [name, scoring] = ['Four of a Kind', groups[0]];
    else if (n[0] === 3 && n[1] === 2) [name, scoring] = ['Full House', cards];
    else if (flush) [name, scoring] = ['Flush', cards];
    else if (straight) [name, scoring] = ['Straight', cards];
    else if (has.three) [name, scoring] = ['Three of a Kind', groups[0]];
    else if (has.twoPair) [name, scoring] = ['Two Pair', [...groups[0], ...groups[1]]];
    else if (has.pair) [name, scoring] = ['Pair', groups[0]];
    else [name, scoring] = ['High Card', [cards.reduce((a, c) => (c.r > a.r ? c : a))]];
    return { name, scoring: cards.filter((c) => scoring.includes(c)), has };
  };

  /* ---------- State ---------- */

  const out = (k) => root.querySelector(`[data-out="${k}"]`);
  const handEl = root.querySelector('[data-hand]');
  const jokersEl = root.querySelector('[data-jokers]');
  const resultEl = root.querySelector('[data-result]');
  const overlay = root.querySelector('[data-overlay]');
  const msg = root.querySelector('[data-msg]');
  const offerEl = root.querySelector('[data-offer]');
  const startBtn = root.querySelector('[data-start]');
  const playBtn = root.querySelector('[data-play]');
  const discardBtn = root.querySelector('[data-discard]');

  const loadBest = () => {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  };
  const saveBest = (n) => {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* storage unavailable */ }
  };

  let state = 'idle'; // idle | playing | scoring | shop | over
  let blind = 0; // blinds beaten this run: ante = blind / 3
  let deck = [];
  let hand = [];
  let jokers = [];
  let offer = [];
  let selected = new Set();
  let score = 0;
  let hands = HANDS;
  let discards = DISCARDS;
  let used = 0; // discards used this blind
  let sortBy = 'rank';
  let best = loadBest();
  let timer = 0;

  const fmt = (n) => n.toLocaleString('en-US');
  const target = () => Math.floor(ANTES[Math.floor(blind / 3)] * BLINDS[blind % 3][1]);
  const blindName = () => `Ante ${Math.floor(blind / 3) + 1} · ${BLINDS[blind % 3][0]}`;

  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const sortHand = () => hand.sort(sortBy === 'rank'
    ? (a, b) => b.r - a.r || a.s - b.s
    : (a, b) => a.s - b.s || b.r - a.r);

  const drawCards = () => {
    while (hand.length < HAND_SIZE && deck.length) hand.push(deck.pop());
    sortHand();
  };

  // The joker whose scoring hooks slot i uses: itself, or for Blueprint and
  // The Fool the neighbour they copy (a copy of a copy follows the chain).
  const source = (i, seen = new Set()) => {
    const j = jokers[i];
    if (!j || seen.has(i)) return null;
    if (!j.copy) return j;
    seen.add(i);
    return source(i + j.copy, seen);
  };
  const each = (hook, fn) => jokers.forEach((_, i) => {
    const j = source(i);
    if (j?.[hook]) fn(j);
  });

  // Chips and mult: the hand's base, then each scoring card's chips with any
  // per-card joker effects, then the jokers' hand-wide effects, left to right.
  const scoreHand = (cards) => {
    const { name, scoring, has } = evaluate(cards);
    let [chips, mult] = BASE[name];
    const ctx = { cards, scoring, has, hands: hands - 1, discards, used, jokers: jokers.length, deck: deck.length, first: hands === HANDS };
    const apply = (eff) => {
      if (!eff) return;
      chips += eff.chips || 0;
      mult += eff.mult || 0;
      if (eff.xmult) mult *= eff.xmult;
    };
    scoring.forEach((c) => {
      chips += CHIPS[c.r];
      each('card', (j) => apply(j.card(c, ctx, j)));
    });
    each('hand', (j) => apply(j.hand(ctx, j)));
    const extra = [];
    each('play', (j) => extra.push(...j.play(cards, ctx, j)));
    return { name, scoring, chips, mult: Math.round(mult * 10) / 10, total: Math.floor(chips * mult), extra };
  };

  /* ---------- Rendering ---------- */

  const renderStats = () => {
    out('blind').textContent = blindName();
    out('target').textContent = fmt(target());
    out('score').textContent = fmt(score);
    out('hands').textContent = hands;
    out('discards').textContent = discards;
    out('deck').textContent = deck.length;
    out('best').textContent = best ? `Ante ${Math.ceil(best / 3)}` : '-';
    root.classList.toggle('is-beaten', score >= target());
  };

  const renderPreview = () => {
    const picked = hand.filter((c) => selected.has(c));
    if (!picked.length) {
      out('handname').textContent = '-';
      out('formula').textContent = 'Pick up to 5 cards';
    } else {
      const { name } = evaluate(picked);
      const [chips, mult] = BASE[name];
      out('handname').textContent = name;
      out('formula').textContent = `${chips} chips × ${mult} mult`;
    }
    const busy = state !== 'playing';
    playBtn.disabled = busy || !picked.length;
    discardBtn.disabled = busy || !picked.length || !discards;
  };

  const renderHand = () => {
    handEl.replaceChildren(...hand.map((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pcard${c.s % 2 ? ' pcard--red' : ''}${selected.has(c) ? ' is-selected' : ''}`;
      b.dataset.i = i;
      b.setAttribute('aria-pressed', String(selected.has(c)));
      b.setAttribute('aria-label', `${RANKS[c.r]} of ${['spades', 'hearts', 'clubs', 'diamonds'][c.s]}`);
      b.innerHTML = `<span class="pcard__rank">${RANKS[c.r]}</span><span class="pcard__suit">${SUITS[c.s]}</span>`;
      return b;
    }));
    renderPreview();
  };

  // A joker card: its art from the sprite sheet, its text underneath.
  const jokerEl = (j, tag, attr) => {
    const el = document.createElement(tag);
    el.className = 'joker';
    el.setAttribute('aria-label', `${j.name}: ${describe(j)}`);
    el.title = j.name;
    el.innerHTML = `<span class="joker__art" style="--col:${j.art % SHEET_COLS};--row:${Math.floor(j.art / SHEET_COLS)}"></span><small>${describe(j)}</small>`;
    Object.entries(attr).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  const renderJokers = () => {
    if (!jokers.length) {
      jokersEl.innerHTML = '<p class="balatro__empty">No jokers yet. Beat a blind to pick one.</p>';
      return;
    }
    jokersEl.replaceChildren(...jokers.map((j, i) => {
      const el = jokerEl(j, 'div', {});
      el.insertAdjacentHTML('beforeend', `<button type="button" data-sell="${i}" aria-label="Sell ${j.name}" title="Sell">×</button>`);
      return el;
    }));
  };

  const showOverlay = (text, btnLabel, cards = []) => {
    msg.textContent = text;
    startBtn.textContent = btnLabel;
    offerEl.replaceChildren(...cards.map((j, i) => {
      const b = jokerEl(j, 'button', { type: 'button', 'data-pick': i });
      b.classList.add('joker--offer');
      return b;
    }));
    offerEl.hidden = !cards.length;
    overlay.hidden = false;
  };

  /* ---------- Game flow ---------- */

  const startBlind = () => {
    deck = shuffle(SUITS.flatMap((_, s) => RANKS.map((_, r) => ({ r, s }))));
    hand = [];
    selected = new Set();
    score = 0;
    hands = HANDS;
    discards = DISCARDS;
    used = 0;
    each('start', (j) => { discards += j.start(j); });
    drawCards();
    state = 'playing';
    overlay.hidden = true;
    resultEl.textContent = '';
    renderStats();
    renderHand();
  };

  const newRun = () => {
    blind = 0;
    jokers = [];
    renderJokers();
    startBlind();
  };

  const finish = (text) => {
    state = 'over';
    renderPreview();
    showOverlay(text, 'New run');
  };

  // The beaten blind stays on the scoreboard while the joker offer is up; the
  // next one shows once it starts.
  const winBlind = () => {
    const spare = score - target();
    blind++;
    if (blind > best) {
      best = blind;
      saveBest(best);
      out('best').textContent = `Ante ${Math.ceil(best / 3)}`;
    }
    if (blind === ANTES.length * 3) {
      finish(`You beat every blind. Ante ${ANTES.length} is yours!`);
      return;
    }
    // End-of-blind joker effects: some wear out or go bad.
    const gone = jokers.filter((j) => j.round && !j.round(j)).map((j) => j.name);
    jokers = jokers.filter((j) => !gone.includes(j.name));
    renderJokers();
    state = 'shop';
    renderPreview();
    const held = new Set(jokers.map((j) => j.name));
    offer = shuffle(JOKERS.filter((j) => !held.has(j.name))).slice(0, 3).map((j) => ({ ...j }));
    const note = gone.length ? ` ${gone.join(' and ')} ${gone.length > 1 ? 'are' : 'is'} gone.` : '';
    showOverlay(`Blind beaten with ${fmt(spare)} to spare.${note} Take a joker?`, 'Skip', offer);
  };

  const removePicked = () => {
    hand = hand.filter((c) => !selected.has(c));
    selected = new Set();
  };

  const play = () => {
    if (state !== 'playing' || !selected.size) return;
    const played = hand.filter((c) => selected.has(c));
    const res = scoreHand(played);
    state = 'scoring';
    hands--;
    score += res.total;
    handEl.querySelectorAll('.pcard').forEach((el, i) => {
      el.classList.toggle('is-played', selected.has(hand[i]));
      el.classList.toggle('is-scoring', res.scoring.includes(hand[i]));
    });
    resultEl.textContent = `${res.name} · ${fmt(res.chips)} × ${fmt(res.mult)} = ${fmt(res.total)}`;
    renderStats();
    renderPreview();
    clearTimeout(timer);
    timer = setTimeout(() => {
      removePicked();
      hand.push(...res.extra);
      if (score >= target()) {
        renderHand();
        winBlind();
      } else if (!hands) {
        renderHand();
        finish(`Run over on ${blindName()} · ${fmt(score)} of ${fmt(target())}`);
      } else {
        drawCards();
        state = 'playing';
        renderStats();
        renderHand();
      }
    }, SCORE_MS);
  };

  const discard = () => {
    if (state !== 'playing' || !selected.size || !discards) return;
    discards--;
    used++;
    removePicked();
    drawCards();
    resultEl.textContent = '';
    renderStats();
    renderHand();
  };

  /* ---------- Input ---------- */

  handEl.addEventListener('click', (e) => {
    const el = e.target.closest('[data-i]');
    if (!el || state !== 'playing') return;
    const c = hand[Number(el.dataset.i)];
    if (selected.has(c)) selected.delete(c);
    else if (selected.size < MAX_PLAY) selected.add(c);
    else return;
    el.classList.toggle('is-selected', selected.has(c));
    el.setAttribute('aria-pressed', String(selected.has(c)));
    renderPreview();
  });

  jokersEl.addEventListener('click', (e) => {
    const el = e.target.closest('[data-sell]');
    if (!el || state === 'scoring') return;
    jokers.splice(Number(el.dataset.sell), 1);
    renderJokers();
    if (state === 'shop') msg.textContent = 'Take a joker?';
  });

  offerEl.addEventListener('click', (e) => {
    const el = e.target.closest('[data-pick]');
    if (!el || state !== 'shop') return;
    if (jokers.length >= MAX_JOKERS) {
      msg.textContent = `You can hold ${MAX_JOKERS} jokers. Sell one (×) to make room, or skip.`;
      return;
    }
    jokers.push(offer[Number(el.dataset.pick)]);
    renderJokers();
    startBlind();
  });

  startBtn.addEventListener('click', () => (state === 'shop' ? startBlind() : newRun()));
  playBtn.addEventListener('click', play);
  discardBtn.addEventListener('click', discard);
  root.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
    sortBy = b.dataset.sort;
    root.querySelectorAll('[data-sort]').forEach((x) => x.classList.toggle('is-active', x === b));
    sortHand();
    renderHand();
  }));

  // Enter plays, Backspace or D discards, while the window has focus.
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('button') && (e.code === 'Enter' || e.code === 'Space')) return;
    if (e.code === 'Enter') play();
    else if (e.code === 'Backspace' || e.code === 'KeyD') discard();
    else return;
    e.preventDefault();
  });

  renderStats();
  renderJokers();
  renderHand();
  showOverlay('Play poker hands to beat each blind. Jokers change the maths.', 'Start run');
})();
