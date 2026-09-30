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

  /* ---------- Jokers ---------- */

  const isFace = (c) => c.r >= 9 && c.r <= 11;
  const label = (eff) => (eff.xmult ? `×${eff.xmult} Mult` : eff.mult ? `+${eff.mult} Mult` : `+${eff.chips} Chips`);
  const suitJoker = (name, s) => ({ name, desc: `Scored ${SUITS[s]} cards give +3 Mult`, card: (c) => c.s === s && { mult: 3 } });
  const typeJoker = (name, type, what, eff) => ({ name, desc: `${label(eff)} if the hand contains a ${what}`, hand: (ctx) => ctx.has[type] && eff });
  const JOKERS = [
    { name: 'Joker', desc: '+4 Mult', hand: () => ({ mult: 4 }) },
    suitJoker('Greedy Joker', 3), suitJoker('Lusty Joker', 1), suitJoker('Wrathful Joker', 0), suitJoker('Gluttonous Joker', 2),
    typeJoker('Jolly Joker', 'pair', 'Pair', { mult: 8 }),
    typeJoker('Zany Joker', 'three', 'Three of a Kind', { mult: 12 }),
    typeJoker('Mad Joker', 'twoPair', 'Two Pair', { mult: 10 }),
    typeJoker('Crazy Joker', 'straight', 'Straight', { mult: 12 }),
    typeJoker('Droll Joker', 'flush', 'Flush', { mult: 10 }),
    typeJoker('Sly Joker', 'pair', 'Pair', { chips: 50 }),
    typeJoker('Wily Joker', 'three', 'Three of a Kind', { chips: 100 }),
    typeJoker('Clever Joker', 'twoPair', 'Two Pair', { chips: 80 }),
    typeJoker('Devious Joker', 'straight', 'Straight', { chips: 100 }),
    typeJoker('Crafty Joker', 'flush', 'Flush', { chips: 80 }),
    typeJoker('The Duo', 'pair', 'Pair', { xmult: 2 }),
    typeJoker('The Trio', 'three', 'Three of a Kind', { xmult: 3 }),
    typeJoker('The Family', 'four', 'Four of a Kind', { xmult: 4 }),
    typeJoker('The Order', 'straight', 'Straight', { xmult: 3 }),
    typeJoker('The Tribe', 'flush', 'Flush', { xmult: 2 }),
    { name: 'Half Joker', desc: '+20 Mult if the hand has 3 or fewer cards', hand: (ctx) => ctx.cards.length <= 3 && { mult: 20 } },
    { name: 'Scary Face', desc: 'Scored face cards give +30 Chips', card: (c) => isFace(c) && { chips: 30 } },
    { name: 'Smiley Face', desc: 'Scored face cards give +5 Mult', card: (c) => isFace(c) && { mult: 5 } },
    { name: 'Even Steven', desc: 'Scored even cards give +4 Mult', card: (c) => c.r <= 8 && c.r % 2 === 0 && { mult: 4 } },
    { name: 'Odd Todd', desc: 'Scored odd cards give +31 Chips', card: (c) => ((c.r <= 7 && c.r % 2 === 1) || c.r === 12) && { chips: 31 } },
    { name: 'Fibonacci', desc: 'Scored A, 2, 3, 5, 8 give +8 Mult', card: (c) => [12, 0, 1, 3, 6].includes(c.r) && { mult: 8 } },
    { name: 'Walkie Talkie', desc: 'Scored 10s and 4s give +10 Chips and +4 Mult', card: (c) => (c.r === 8 || c.r === 2) && { chips: 10, mult: 4 } },
    { name: 'Photograph', desc: 'First scored face card gives ×2 Mult', card: (c, ctx) => ctx.scoring.find(isFace) === c && { xmult: 2 } },
    { name: 'Banner', desc: '+30 Chips per remaining discard', hand: (ctx) => ({ chips: 30 * ctx.discards }) },
    { name: 'Mystic Summit', desc: '+15 Mult when no discards remain', hand: (ctx) => ctx.discards === 0 && { mult: 15 } },
    { name: 'Abstract Joker', desc: '+3 Mult per joker held', hand: (ctx) => ({ mult: 3 * ctx.jokers }) },
    { name: 'Blue Joker', desc: '+2 Chips per card left in the deck', hand: (ctx) => ({ chips: 2 * ctx.deck }) },
    { name: 'Misprint', desc: '+0 to +23 Mult, at random', hand: () => ({ mult: Math.floor(Math.random() * 24) }) },
  ];

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
  let selected = new Set();
  let score = 0;
  let hands = HANDS;
  let discards = DISCARDS;
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

  // Chips and mult: the hand's base, then each scoring card's chips with any
  // per-card joker effects, then the jokers' hand-wide effects, left to right.
  const scoreHand = (cards) => {
    const { name, scoring, has } = evaluate(cards);
    let [chips, mult] = BASE[name];
    const ctx = { cards, scoring, has, discards, jokers: jokers.length, deck: deck.length };
    const apply = (eff) => {
      if (!eff) return;
      chips += eff.chips || 0;
      mult += eff.mult || 0;
      if (eff.xmult) mult *= eff.xmult;
    };
    scoring.forEach((c) => {
      chips += CHIPS[c.r];
      jokers.forEach((j) => j.card && apply(j.card(c, ctx)));
    });
    jokers.forEach((j) => j.hand && apply(j.hand(ctx)));
    return { name, scoring, chips, mult, total: Math.floor(chips * mult) };
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

  const renderJokers = () => {
    if (!jokers.length) {
      jokersEl.innerHTML = '<p class="balatro__empty">No jokers yet. Beat a blind to pick one.</p>';
      return;
    }
    jokersEl.replaceChildren(...jokers.map((j, i) => {
      const el = document.createElement('div');
      el.className = 'joker';
      el.innerHTML = `<b>${j.name}</b><small>${j.desc}</small><button type="button" data-sell="${i}" aria-label="Sell ${j.name}" title="Sell">×</button>`;
      return el;
    }));
  };

  const showOverlay = (text, btnLabel, offer = []) => {
    msg.textContent = text;
    startBtn.textContent = btnLabel;
    offerEl.replaceChildren(...offer.map((j, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'joker joker--offer';
      b.dataset.pick = i;
      b.innerHTML = `<b>${j.name}</b><small>${j.desc}</small>`;
      return b;
    }));
    offerEl.hidden = !offer.length;
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

  let offer = [];
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
    state = 'shop';
    renderPreview();
    const held = new Set(jokers.map((j) => j.name));
    offer = shuffle(JOKERS.filter((j) => !held.has(j.name))).slice(0, 3);
    showOverlay(`Blind beaten with ${fmt(spare)} to spare. Take a joker?`, 'Skip', offer);
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
