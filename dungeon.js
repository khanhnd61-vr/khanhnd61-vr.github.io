// Dungeon hub for the Play section: a top-down, Zelda-style map of six rooms
// drawn on one small canvas and scaled up with crisp pixels. The lobby has a
// computer and a book to read; the Pikachu room beside it and the four
// L-shaped rooms around them each hold an arcade cabinet. Press Z at one to
// swap this card for that game's window; the red button in the game window's
// title bar brings the player back here.
(() => {
  const root = document.querySelector('[data-dungeon]');
  if (!root) return;

  // The map, one character per tile: # is rock or wall, + a door, and each
  // letter is a room's floor. The middle is split into the lobby (l) and the
  // Pikachu room (k); the L-shaped rooms around them are Pong (p), Balatro
  // (b), Tetris (t) and Hashi (h). The two middle rooms open onto each other
  // and onto the rooms above and below them, and the four L-shaped rooms join
  // up in a ring.
  const LAYOUT = [
    '#########################',
    '#ppppppppppp#bbbbbbbbbbb#',
    '#ppppppppppp+bbbbbbbbbbb#',
    '#ppppppppppp+bbbbbbbbbbb#',
    '#ppp###++#######++###bbb#',
    '#ppp#lllllll#kkkkkkk#bbb#',
    '#ppp#lllllll#kkkkkkk#bbb#',
    '#ppp#lllllll#kkkkkkk#bbb#',
    '#ppp#lllllll+kkkkkkk#bbb#',
    '##++#lllllll+kkkkkkk#++##',
    '#ttt#lllllll#kkkkkkk#hhh#',
    '#ttt#lllllll#kkkkkkk#hhh#',
    '#ttt#lllllll#kkkkkkk#hhh#',
    '#ttt#lllllll#kkkkkkk#hhh#',
    '#ttt###++#######++###hhh#',
    '#ttttttttttt#hhhhhhhhhhh#',
    '#ttttttttttt#hhhhhhhhhhh#',
    '#ttttttttttt#hhhhhhhhhhh#',
    '#########################',
  ];

  const TILE = 16;
  const COLS = LAYOUT[0].length;
  const ROWS = LAYOUT.length;
  const W = COLS * TILE;
  const H = ROWS * TILE;
  const SPEED = 72; // px per second, in canvas pixels
  const FADE = 320; // ms for the scene fade
  const STEP = 150; // ms per walk frame

  // Tile types. The pond tiles and the furniture are solid.
  const FLOOR = 0;
  const WALL = 1;
  const POT = 2;
  const RUG = 3;
  const STAIRS = 4;
  const WATER = 5;
  const ISLAND = 6;
  const BRIDGE_H = 7;
  const BRIDGE_V = 8;
  const BLOCK = 9;
  const CRACK = 10;
  const CARD = 11;
  const ARCADE = 12;
  const COMPUTER = 13;
  const DESK = 14;
  const BOOK = 15;
  const CHAIR = 16;
  const SHELF = 17;
  const PLANT = 18;
  const COURT = 19;
  const SOLID = new Set([WALL, POT, WATER, ISLAND, BRIDGE_H, BRIDGE_V, ARCADE, COMPUTER, DESK, BOOK, CHAIR, SHELF, PLANT]);

  // Room floors by letter; each game room's name is painted on its floor at `at` (tiles).
  const ROOMS = {
    l: { name: 'Lobby', label: 'LOBBY', at: [8.5, 12.5] },
    k: { name: 'Pikachu room', label: 'PIKACHU', at: [16.5, 12.5] },
    p: { name: 'Pong room', label: 'PONG', at: [2.5, 6.5] },
    b: { name: 'Balatro room', label: 'BALATRO', at: [22.5, 6.5] },
    t: { name: 'Tetris room', label: 'TETRIS', at: [2.5, 12.5] },
    h: { name: 'Hashi room', label: 'HASHI', at: [22.5, 12.5] },
  };
  const DOORS = [];
  LAYOUT.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '+') DOORS.push([x, y]); }));
  const TORCHES = [[6, 0], [18, 0], [0, 6], [24, 6], [0, 12], [24, 12], [6, 18], [18, 18], [12, 4], [12, 6], [12, 12], [12, 14]];
  const POTS = [[11, 1], [1, 8], [13, 1], [23, 8], [11, 17], [23, 17], [13, 5]];
  // A small Hashi pond at the far end of the Hashi room: four islands joined in a ring.
  const ISLANDS = { '13,15': 2, '15,15': 2, '13,17': 2, '15,17': 2 };
  const BLOCK_COLORS = {
    I: '#8FB8C4', O: '#F4C15D', T: '#B48CB0', S: '#8DB07E', Z: '#D9745A', J: '#6F8FC0', L: '#E2A963',
  };
  // Fallen tetrominoes on the Tetris room floor.
  const BLOCKS = {
    Z: [[1, 10], [2, 10], [2, 11], [3, 11]],
    S: [[2, 14], [3, 14], [1, 15], [2, 15]],
    T: [[2, 16], [1, 17], [2, 17], [3, 17]],
    I: [[5, 17], [6, 17], [7, 17], [8, 17]],
    O: [[9, 15], [10, 15], [9, 16], [10, 16]],
  };
  const CRACKS = [[3, 7], [4, 2], [6, 12], [14, 7], [23, 11], [18, 17]];
  const CARDS = [[15, 2], [17, 1], [19, 3], [16, 3], [23, 5], [21, 7]]; // playing cards strewn on the floor
  const COURT_AT = [5, 1, 6, 3]; // Pong court painted on the Pong room floor: x, y, w, h in tiles
  // A few Pikachu tiles painted on the Pikachu room floor, one pair of them joined: x, y, then a colour per tile.
  const BOARD_AT = [15, 8];
  const BOARD = [
    ['#8db07e', '#f4c15d', '#8fb8c4', '#f4c15d'],
    ['#d9745a', '#6f8fc0', '#b48cb0', '#8db07e'],
    ['#8fb8c4', '#e2a963', '#d9745a', '#b48cb0'],
  ];

  // What the book on the table and the computer on the desk say, a page at a time.
  const PROFILE = [
    'Khanh D. Nguyen, AI Software Engineer. I make capable AI models run fast on real hardware.',
    'I work on inference engineering, model optimization and edge AI for robotics: lean C/C++ engines that bring VLMs, VLAs and LLMs to CPUs, accelerators and robots.',
    'Inspired by llama.cpp: a few lines of simple code, big results on your own hardware.',
    'Research: M.S. in AI Convergence, on multimodal learning and affective behavior analysis, with 6 peer-reviewed papers (CVPRW, ECCVW, RSSW).',
    'Mentor: An Thai Le, Assistant Professor at VinUniversity and Director of Foundation AI at VinRobotics, working on robots that plan, learn and act with limited compute and data.',
    'Interests: edge AI, model optimization, robotics, VLA, C and C++. Me as a happy vicuna.',
  ];
  const PROJECTS = [
    '> ls ~/projects\nSix pinned repositories. Press Z to page through them.',
    'vla.cpp: Vision-Language-Action models on local hardware, in the spirit of llama.cpp for robotics. The open-source project I lead at VinRobotics. C++ and ggml.',
    'vla.simd: efficient CPU inference for language-conditioned manipulation. Shared SIMD micro-kernels (AVX2 and NEON) plus IMPACT, a policy that supplies 30+ actions per second on a Raspberry Pi 5.',
    'Model Optimization 101: hands-on notebooks for edge deployment. Quantization, distillation, pruning, NAS and GPU kernels, each measuring size, latency and accuracy before and after.',
    'REX, neural network Representation EXchange: a hands-on study of how different frameworks represent and serialize neural networks.',
    'FaceGen: multiple appropriate facial reaction generation from a speaker\'s audio-visual cues. 3rd place at REACT 2024.',
    'ReadItDown: a native markdown viewer and editor for Linux, Windows and macOS.',
    'All of them live at github.com/khanhnd61-vr. The Projects section above has the links and the latency explorer.',
  ];

  // Things the player can face and press Z at.
  const THINGS = [
    { x: 9, y: 5, tile: COMPUTER, name: 'Computer', pages: PROJECTS },
    { x: 8, y: 9, tile: BOOK, name: 'Book', pages: PROFILE },
    { x: 2, y: 1, tile: ARCADE, name: 'Pong', game: '[data-pong]' },
    { x: 22, y: 1, tile: ARCADE, name: 'Balatro', game: '[data-balatro]' },
    { x: 19, y: 5, tile: ARCADE, name: 'Pikachu', game: '[data-pika]' },
    { x: 4, y: 15, tile: ARCADE, name: 'Tetris', game: '[data-tetris]' },
    { x: 19, y: 15, tile: ARCADE, name: 'Hashi', game: '[data-hashi]' },
  ];

  const grid = LAYOUT.map((row) => [...row].map((ch) => (ch === '#' ? WALL : FLOOR)));
  const put = (type, cells) => cells.forEach(([x, y]) => { grid[y][x] = type; });
  const rect = (x0, y0, w, h) => {
    const cells = [];
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) cells.push([x, y]);
    return cells;
  };
  put(CRACK, CRACKS);
  put(CARD, CARDS);
  put(POT, POTS);
  put(COURT, rect(...COURT_AT));
  put(STAIRS, [[5, 5]]);
  put(RUG, rect(6, 8, 5, 3));
  put(SHELF, [[6, 5], [11, 5]]);
  put(DESK, [[10, 5]]);
  put(CHAIR, [[7, 9], [9, 9]]);
  put(PLANT, [[5, 13], [11, 13], [13, 13], [19, 13]]);
  put(WATER, rect(13, 15, 3, 3));
  put(BRIDGE_H, [[14, 15], [14, 17]]);
  put(BRIDGE_V, [[13, 16], [15, 16]]);
  put(ISLAND, Object.keys(ISLANDS).map((k) => k.split(',').map(Number)));
  const blockColor = new Map();
  Object.entries(BLOCKS).forEach(([id, cells]) => {
    put(BLOCK, cells);
    cells.forEach(([x, y]) => blockColor.set(`${x},${y}`, BLOCK_COLORS[id]));
  });
  THINGS.forEach((t) => { grid[t.y][t.x] = t.tile; });
  const thingAt = (x, y) => THINGS.find((t) => t.x === x && t.y === y);

  /* ---------- Tile art ---------- */

  const floor = (c, px, py, x, y) => {
    c.fillStyle = (x + y) % 2 ? '#7d5c3a' : '#775736';
    c.fillRect(px, py, TILE, TILE);
    c.fillStyle = 'rgba(0, 0, 0, .12)';
    c.fillRect(px, py + TILE - 1, TILE, 1);
    c.fillRect(px + TILE - 1, py, 1, TILE);
  };

  // Walls show their bricks where they face a room; rock further in stays dark,
  // so the shapes of the rooms stand out.
  const facesRoom = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = grid[y + dy]?.[x + dx];
        if (t !== undefined && t !== WALL) return true;
      }
    }
    return false;
  };

  const rock = (c, px, py, x, y) => {
    c.fillStyle = '#1c1006';
    c.fillRect(px, py, TILE, TILE);
    c.fillStyle = '#2b1a08';
    if ((x * 7 + y * 3) % 4 === 0) c.fillRect(px + 4, py + 5, 2, 1);
    if ((x * 5 + y * 11) % 5 === 0) c.fillRect(px + 10, py + 11, 3, 1);
  };

  const wall = (c, px, py, x, y) => {
    if (!facesRoom(x, y)) {
      rock(c, px, py, x, y);
      return;
    }
    c.fillStyle = '#2b1a08';
    c.fillRect(px, py, TILE, TILE);
    const brick = (bx, by, bw) => {
      c.fillStyle = '#4b2e0f';
      c.fillRect(bx, by, bw, 6);
      c.fillStyle = '#5e3d1a';
      c.fillRect(bx, by, bw, 1);
    };
    brick(px + 1, py + 1, 6);
    brick(px + 9, py + 1, 6);
    brick(px, py + 9, 3);
    brick(px + 5, py + 9, 6);
    brick(px + 13, py + 9, 3);
  };

  const water = (c, px, py, x, y) => {
    c.fillStyle = '#4f6f8a';
    c.fillRect(px, py, TILE, TILE);
    c.fillStyle = '#6a8fae';
    if ((x + y) % 2) {
      c.fillRect(px + 2, py + 4, 4, 1);
      c.fillRect(px + 9, py + 11, 4, 1);
    } else {
      c.fillRect(px + 8, py + 3, 4, 1);
      c.fillRect(px + 3, py + 10, 4, 1);
    }
  };

  const pot = (c, px, py) => {
    c.fillStyle = 'rgba(0, 0, 0, .22)';
    c.fillRect(px + 3, py + 14, 10, 2);
    c.fillStyle = '#b48c6a';
    c.fillRect(px + 3, py + 6, 10, 8);
    c.fillRect(px + 4, py + 5, 8, 1);
    c.fillRect(px + 4, py + 14, 8, 1);
    c.fillStyle = '#4b2e0f';
    c.fillRect(px + 5, py + 3, 6, 2);
    c.fillRect(px + 4, py + 5, 8, 1);
    c.fillStyle = '#d2ad8a';
    c.fillRect(px + 5, py + 7, 2, 4);
  };

  // A wooden desk top with its front edge; the computer and papers sit on it.
  const desk = (c, px, py) => {
    c.fillStyle = 'rgba(0, 0, 0, .2)';
    c.fillRect(px + 1, py + 14, 14, 2);
    c.fillStyle = '#8b5a2b';
    c.fillRect(px, py + 5, TILE, 8);
    c.fillStyle = '#6b4420';
    c.fillRect(px, py + 13, TILE, 2);
    c.fillStyle = '#a06a35';
    c.fillRect(px, py + 5, TILE, 1);
  };

  // Each arcade cabinet shows a different screen.
  const SCREENS = {
    Tetris: (c, px, py) => {
      c.fillStyle = '#1a1030';
      c.fillRect(px + 4, py + 3, 8, 6);
      [['#D9745A', 4, 7], ['#D9745A', 5, 7], ['#F4C15D', 7, 7], ['#F4C15D', 8, 7], ['#8FB8C4', 10, 4], ['#8FB8C4', 10, 5], ['#8FB8C4', 10, 6], ['#8FB8C4', 10, 7], ['#B48CB0', 6, 5], ['#B48CB0', 5, 6], ['#B48CB0', 6, 6], ['#B48CB0', 7, 6]]
        .forEach(([col, x, y]) => { c.fillStyle = col; c.fillRect(px + x, py + y, 1, 1); });
    },
    Balatro: (c, px, py) => {
      c.fillStyle = '#2f6b45';
      c.fillRect(px + 4, py + 3, 8, 6);
      c.fillStyle = '#fffaf2';
      c.fillRect(px + 5, py + 4, 3, 4);
      c.fillRect(px + 9, py + 4, 3, 4);
      c.fillStyle = '#c0392b';
      c.fillRect(px + 6, py + 5, 1, 2);
      c.fillStyle = '#2b1a08';
      c.fillRect(px + 10, py + 5, 1, 2);
    },
    Hashi: (c, px, py) => {
      c.fillStyle = '#4f6f8a';
      c.fillRect(px + 4, py + 3, 8, 6);
      c.fillStyle = '#e2a963';
      c.fillRect(px + 6, py + 5, 5, 1);
      c.fillStyle = '#a8b89c';
      c.fillRect(px + 5, py + 4, 2, 3);
      c.fillRect(px + 10, py + 4, 2, 3);
    },
    Pong: (c, px, py) => {
      c.fillStyle = '#1a1030';
      c.fillRect(px + 4, py + 3, 8, 6);
      c.fillStyle = '#fffaf2';
      c.fillRect(px + 4, py + 4, 1, 3); // paddles
      c.fillRect(px + 11, py + 5, 1, 3);
      c.fillStyle = '#f4c15d';
      c.fillRect(px + 8, py + 5, 1, 1); // ball
    },
    Pikachu: (c, px, py) => {
      c.fillStyle = '#1a1030';
      c.fillRect(px + 4, py + 3, 8, 6);
      [['#8db07e', 5, 4], ['#f4c15d', 8, 4], ['#d9745a', 5, 7], ['#8db07e', 8, 7]]
        .forEach(([col, x, y]) => { c.fillStyle = col; c.fillRect(px + x, py + y, 2, 1); });
      c.fillStyle = '#fffaf2';
      c.fillRect(px + 10, py + 4, 1, 4); // the line joining the two green tiles
      c.fillRect(px + 7, py + 4, 3, 1);
      c.fillRect(px + 10, py + 7, 1, 1);
    },
  };

  const TILES = {
    [FLOOR]: floor,
    [WALL]: wall,
    [WATER]: water,
    [POT]: (c, px, py, x, y) => floor(c, px, py, x, y), // the pot is drawn later, sorted with the hero
    [CRACK]: (c, px, py, x, y) => {
      floor(c, px, py, x, y);
      c.fillStyle = '#4b2e0f';
      const pts = [[3, 4], [4, 5], [5, 5], [6, 6], [7, 8], [8, 9], [9, 9], [10, 11]];
      pts.forEach(([dx, dy]) => c.fillRect(px + ((x + y) % 2 ? TILE - 1 - dx : dx), py + dy, 1, 1));
    },
    [RUG]: (c, px, py, x, y) => {
      c.fillStyle = '#a44a3a';
      c.fillRect(px, py, TILE, TILE);
      c.fillStyle = '#c96a52';
      c.fillRect(px + 6, py + 6, 4, 4);
      c.fillStyle = '#f4c15d';
      const rugLike = (t) => t === RUG || t === BOOK || t === CHAIR;
      if (!rugLike(grid[y - 1][x])) c.fillRect(px, py, TILE, 1);
      if (!rugLike(grid[y + 1][x])) c.fillRect(px, py + TILE - 1, TILE, 1);
      if (!rugLike(grid[y][x - 1])) c.fillRect(px, py, 1, TILE);
      if (!rugLike(grid[y][x + 1])) c.fillRect(px + TILE - 1, py, 1, TILE);
    },
    [COURT]: (c, px, py) => {
      c.fillStyle = '#34503c';
      c.fillRect(px, py, TILE, TILE);
    },
    [STAIRS]: (c, px, py) => {
      c.fillStyle = '#1c1006';
      c.fillRect(px, py, TILE, TILE);
      ['#5a3a1a', '#47300f', '#33210a'].forEach((col, i) => {
        c.fillStyle = col;
        c.fillRect(px + 2, py + 2 + i * 3, 12, 3);
      });
    },
    [ISLAND]: (c, px, py, x, y) => {
      water(c, px, py, x, y);
      c.fillStyle = '#3d250c';
      c.beginPath();
      c.arc(px + 8, py + 8, 6.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#a8b89c';
      c.beginPath();
      c.arc(px + 8, py + 8, 5.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3d250c';
      c.font = 'bold 8px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(ISLANDS[`${x},${y}`]), px + 8, py + 8.5);
    },
    [BRIDGE_H]: (c, px, py, x, y) => {
      water(c, px, py, x, y);
      c.fillStyle = '#e2a963';
      c.fillRect(px, py + 6, TILE, 4);
      c.fillStyle = '#b8823e';
      c.fillRect(px, py + 6, TILE, 1);
      c.fillRect(px, py + 9, TILE, 1);
    },
    [BRIDGE_V]: (c, px, py, x, y) => {
      water(c, px, py, x, y);
      c.fillStyle = '#e2a963';
      c.fillRect(px + 6, py, 4, TILE);
      c.fillStyle = '#b8823e';
      c.fillRect(px + 6, py, 1, TILE);
      c.fillRect(px + 9, py, 1, TILE);
    },
    [CARD]: (c, px, py, x, y) => {
      floor(c, px, py, x, y);
      const red = (x + y) % 2;
      c.fillStyle = '#3d250c';
      c.fillRect(px + 3, py + 2, 10, 13);
      c.fillStyle = '#fffaf2';
      c.fillRect(px + 4, py + 3, 8, 11);
      c.fillStyle = red ? '#c0392b' : '#2b1a08';
      c.fillRect(px + 7, py + 7, 2, 2);
      c.fillRect(px + 6, py + 8, 4, 1);
      if (!red) c.fillRect(px + 7, py + 10, 2, 1);
      else c.fillRect(px + 7, py + 6, 2, 1);
      c.fillRect(px + 5, py + 4, 1, 2);
      c.fillRect(px + 10, py + 11, 1, 2);
    },
    [BLOCK]: (c, px, py, x, y) => {
      floor(c, px, py, x, y);
      c.fillStyle = blockColor.get(`${x},${y}`);
      c.fillRect(px + 1, py + 1, 14, 14);
      c.fillStyle = 'rgba(255, 255, 255, .25)';
      c.fillRect(px + 3, py + 2, 10, 2);
      c.fillStyle = 'rgba(0, 0, 0, .18)';
      c.fillRect(px + 1, py + 13, 14, 2);
    },
    [ARCADE]: (c, px, py, x, y) => {
      floor(c, px, py, x, y);
      c.fillStyle = 'rgba(0, 0, 0, .22)';
      c.fillRect(px + 2, py + 14, 12, 2);
      c.fillStyle = '#2b1a08';
      c.fillRect(px + 2, py, 12, 15);
      c.fillStyle = '#3b2f5e';
      c.fillRect(px + 3, py + 1, 10, 13);
      c.fillStyle = '#e2a963';
      c.fillRect(px + 3, py + 1, 10, 1); // marquee
      SCREENS[thingAt(x, y).name](c, px, py);
      c.fillStyle = '#5e4a86';
      c.fillRect(px + 3, py + 10, 10, 3); // control panel
      c.fillStyle = '#2b1a08';
      c.fillRect(px + 5, py + 10, 1, 2); // joystick
      c.fillStyle = '#d9745a';
      c.fillRect(px + 8, py + 11, 2, 1);
      c.fillStyle = '#f4c15d';
      c.fillRect(px + 11, py + 11, 2, 1);
    },
    [COMPUTER]: (c, px, py, x, y) => {
      floor(c, px, py, x, y);
      desk(c, px, py);
      c.fillStyle = '#3d3d3d';
      c.fillRect(px + 3, py, 10, 8); // monitor
      c.fillStyle = '#5b8ac7';
      c.fillRect(px + 4, py + 1, 8, 6);
      c.fillStyle = '#cfe3ff';
      c.fillRect(px + 5, py + 2, 5, 1);
      c.fillRect(px + 5, py + 4, 3, 1);
      c.fillStyle = '#3d3d3d';
      c.fillRect(px + 7, py + 8, 2, 1); // stand
      c.fillStyle = '#d8d0c0';
      c.fillRect(px + 4, py + 10, 8, 2); // keyboard
    },
    [DESK]: (c, px, py, x, y) => {
      floor(c, px, py, x, y);
      desk(c, px, py);
      c.fillStyle = '#fffaf2';
      c.fillRect(px + 2, py + 6, 6, 6); // papers
      c.fillStyle = '#9a8a78';
      c.fillRect(px + 3, py + 7, 4, 1);
      c.fillRect(px + 3, py + 9, 3, 1);
      c.fillStyle = '#c0392b';
      c.fillRect(px + 10, py + 7, 4, 4); // mug
      c.fillStyle = '#e06a5a';
      c.fillRect(px + 14, py + 8, 1, 2);
    },
    [BOOK]: (c, px, py, x, y) => {
      TILES[RUG](c, px, py, x, y);
      c.fillStyle = 'rgba(0, 0, 0, .2)';
      c.fillRect(px + 2, py + 13, 12, 2);
      c.fillStyle = '#a8743f';
      c.fillRect(px + 1, py + 3, 14, 10); // table top
      c.fillStyle = '#7c5228';
      c.fillRect(px + 1, py + 12, 14, 1);
      c.fillStyle = '#c0392b';
      c.fillRect(px + 3, py + 4, 10, 7); // book cover
      c.fillStyle = '#fffaf2';
      c.fillRect(px + 4, py + 5, 4, 5); // open pages
      c.fillRect(px + 9, py + 5, 3, 5);
      c.fillStyle = '#9a8a78';
      c.fillRect(px + 5, py + 6, 2, 1);
      c.fillRect(px + 5, py + 8, 2, 1);
      c.fillRect(px + 10, py + 6, 1, 1);
      c.fillRect(px + 10, py + 8, 1, 1);
    },
    [CHAIR]: (c, px, py, x, y) => {
      TILES[RUG](c, px, py, x, y);
      c.fillStyle = '#6b4420';
      c.fillRect(px + 4, py + 2, 8, 4); // back
      c.fillStyle = '#8b5a2b';
      c.fillRect(px + 4, py + 6, 8, 6); // seat
      c.fillStyle = '#4b2e0f';
      c.fillRect(px + 4, py + 12, 2, 2); // legs
      c.fillRect(px + 10, py + 12, 2, 2);
    },
    [SHELF]: (c, px, py) => {
      c.fillStyle = '#4b2e0f';
      c.fillRect(px, py, TILE, TILE);
      c.fillStyle = '#3a230b';
      c.fillRect(px + 1, py + 1, 14, 6);
      c.fillRect(px + 1, py + 9, 14, 6);
      const spines = ['#c0392b', '#5c7a5e', '#e2a963', '#6f8fc0', '#b48cb0', '#f4c15d', '#8db07e'];
      for (let i = 0; i < 6; i++) {
        c.fillStyle = spines[i % spines.length];
        c.fillRect(px + 2 + i * 2, py + 2 + (i % 2), 2, 5 - (i % 2));
        c.fillStyle = spines[(i + 3) % spines.length];
        c.fillRect(px + 2 + i * 2, py + 10 + ((i + 1) % 2), 2, 5 - ((i + 1) % 2));
      }
    },
    [PLANT]: (c, px, py, x, y) => {
      floor(c, px, py, x, y);
      c.fillStyle = 'rgba(0, 0, 0, .2)';
      c.fillRect(px + 4, py + 14, 8, 2);
      c.fillStyle = '#b48c6a';
      c.fillRect(px + 5, py + 10, 6, 5); // pot
      c.fillStyle = '#4b2e0f';
      c.fillRect(px + 4, py + 9, 8, 1);
      c.fillStyle = '#5c7a5e';
      c.fillRect(px + 6, py + 3, 4, 7);
      c.fillRect(px + 3, py + 5, 4, 3);
      c.fillRect(px + 9, py + 4, 4, 3);
      c.fillStyle = '#8db07e';
      c.fillRect(px + 7, py + 2, 2, 3);
      c.fillRect(px + 4, py + 5, 2, 1);
      c.fillRect(px + 10, py + 4, 2, 1);
    },
  };

  // Everything that never changes is drawn once, then copied each frame.
  const map = document.createElement('canvas');
  map.width = W;
  map.height = H;
  const mctx = map.getContext('2d');
  grid.forEach((row, y) => row.forEach((t, x) => TILES[t](mctx, x * TILE, y * TILE, x, y)));
  DOORS.forEach(([x, y]) => {
    mctx.fillStyle = 'rgba(0, 0, 0, .14)';
    mctx.fillRect(x * TILE, y * TILE, TILE, TILE);
  });
  TORCHES.forEach(([x, y]) => {
    mctx.fillStyle = '#8b5a2b';
    mctx.fillRect(x * TILE + 7, y * TILE + 8, 2, 6);
  });
  // The court's lines, net, paddles and ball, painted over its floor.
  {
    const [x0, y0, w, h] = COURT_AT.map((n) => n * TILE);
    mctx.fillStyle = 'rgba(255, 242, 225, .5)';
    mctx.fillRect(x0 + 2, y0 + 2, w - 4, 1);
    mctx.fillRect(x0 + 2, y0 + h - 3, w - 4, 1);
    mctx.fillRect(x0 + 2, y0 + 2, 1, h - 4);
    mctx.fillRect(x0 + w - 3, y0 + 2, 1, h - 4);
    for (let y = y0 + 5; y < y0 + h - 4; y += 5) mctx.fillRect(x0 + w / 2, y, 1, 3);
    mctx.fillStyle = '#fff2e1';
    mctx.fillRect(x0 + 6, y0 + 12, 2, 12);
    mctx.fillRect(x0 + w - 8, y0 + 22, 2, 12);
    mctx.fillStyle = '#f4c15d';
    mctx.fillRect(x0 + 34, y0 + 18, 3, 3);
  }
  // The Pikachu tiles, and the path over the top of the board joining the two yellow ones.
  {
    const [x0, y0] = BOARD_AT.map((n) => n * TILE);
    BOARD.forEach((row, j) => row.forEach((col, i) => {
      const tx = x0 + i * TILE;
      const ty = y0 + j * TILE;
      mctx.fillStyle = 'rgba(0, 0, 0, .2)';
      mctx.fillRect(tx + 3, ty + 3, 12, 12);
      mctx.fillStyle = '#fffaf2';
      mctx.fillRect(tx + 2, ty + 2, 12, 12);
      mctx.fillStyle = col;
      mctx.fillRect(tx + 4, ty + 4, 8, 8);
      mctx.fillStyle = '#2b1a08';
      mctx.fillRect(tx + 6, ty + 7, 1, 1); // eyes
      mctx.fillRect(tx + 9, ty + 7, 1, 1);
    }));
    mctx.fillStyle = '#f4c15d';
    mctx.fillRect(x0 + TILE + 7, y0 - 4, 2, 6);
    mctx.fillRect(x0 + TILE + 7, y0 - 4, 2 * TILE + 2, 2);
    mctx.fillRect(x0 + 3 * TILE + 7, y0 - 4, 2, 6);
  }
  Object.values(ROOMS).forEach((r) => {
    if (!r.label) return;
    const [cx, cy] = r.at.map((n) => n * TILE);
    mctx.font = 'bold 8px "JetBrains Mono", monospace';
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    mctx.fillStyle = '#a07a4f';
    mctx.fillText(r.label, cx, cy + 1);
    mctx.fillStyle = '#2b1a08';
    mctx.fillText(r.label, cx, cy);
  });

  const flame = (c, px, py, alt) => {
    c.fillStyle = '#e2a963';
    if (alt) c.fillRect(px + 5, py + 4, 5, 4);
    else c.fillRect(px + 6, py + 3, 5, 5);
    c.fillStyle = '#f4c15d';
    c.fillRect(px + 7, py + (alt ? 3 : 2), 2, 5);
    c.fillStyle = '#fff2e1';
    c.fillRect(px + 7 + (alt ? 1 : 0), py + (alt ? 5 : 4), 1, 2);
  };

  // "Z" bubble over everything the player can use; the one in reach lights up.
  const prompt = (c, px, py, bob, active) => {
    const bx = px + 4;
    const by = py - 10 - bob;
    c.fillStyle = '#2b1a08';
    c.fillRect(bx, by, 9, 9);
    c.fillRect(bx + 3, by + 9, 3, 1);
    c.fillStyle = active ? '#f4c15d' : '#fffaf2';
    c.fillRect(bx + 1, by + 1, 7, 7);
    c.fillStyle = '#2b1a08';
    c.fillRect(bx + 3, by + 2, 4, 1);
    c.fillRect(bx + 5, by + 3, 1, 1);
    c.fillRect(bx + 4, by + 4, 1, 1);
    c.fillRect(bx + 3, by + 5, 1, 1);
    c.fillRect(bx + 3, by + 6, 4, 1);
  };

  /* ---------- Hero sprite ---------- */

  // A shiba inu, 16 x 14 pixels: o coat, d ear tips, c cream muzzle, belly
  // and paws, k eyes and nose. The side view shows the curled tail.
  const PAL = { o: '#e2a963', d: '#b8743a', c: '#fff2e1', k: '#2b1a08' };
  const BODY = {
    down: [
      '....d......d....', '...dod....dod...', '...oooooooooo...', '..oooooooooooo..',
      '..oookooookooo..', '..ooccccccccoo..', '..occccckkcccco.', '...occcccccco...',
      '...oooccccooo...', '...oooccccooo...', '...oooooooooo...',
    ],
    up: [
      '....d......d....', '...dod....dod...', '...oooooooooo...', '..oooooooooooo..',
      '..oooooooooooo..', '..oooooooooooo..', '...oooooooooo...', '...oooooooooo...',
      '...oooooooooo...', '...ooooccoooo...', '...oooccccooo...',
    ],
    right: [
      '..........d..d..', '..........dood..', '...oo.....oooooo', '..o..o...ooookoo',
      '..o..o..oooooooo', '...ooooooooccckk', '..oooooooooocccc', '..ooooooooooocc.',
      '..ooooooooooooo.', '..oocccccccccoo.', '..ooo.....ooo...',
    ],
  };
  const LEGS = {
    front: [['...ooo....ooo...', '...ccc....ccc...'], ['..ooo......ooo..', '..ccc......ccc..']],
    side: [['..ooo.....ooo...', '..ccc.....ccc...'], ['.oo..o...oo..o..', '.cc..c...cc..c..']],
  };
  const render = (rows, flip) => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 14;
    const g = c.getContext('2d');
    if (flip) {
      g.translate(16, 0);
      g.scale(-1, 1);
    }
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (!PAL[ch]) return;
      g.fillStyle = PAL[ch];
      g.fillRect(x, y, 1, 1);
    }));
    return c;
  };
  const SPRITES = {
    down: LEGS.front.map((legs) => render([...BODY.down, ...legs])),
    up: LEGS.front.map((legs) => render([...BODY.up, ...legs])),
    right: LEGS.side.map((legs) => render([...BODY.right, ...legs])),
    left: LEGS.side.map((legs) => render([...BODY.right, ...legs], true)),
  };

  /* ---------- State ---------- */

  const stage = root.querySelector('[data-stage]');
  const view = root.querySelector('[data-view]');
  const overlay = root.querySelector('[data-overlay]');
  const msg = root.querySelector('[data-msg]');
  const startBtn = root.querySelector('[data-start]');
  const roomOut = root.querySelector('[data-room]');
  const talkEl = root.querySelector('[data-talk]');
  const talkTitle = root.querySelector('[data-talk-title]');
  const talkText = root.querySelector('[data-talk-text]');
  const talkMore = root.querySelector('[data-talk-more]');
  const ctx = view.getContext('2d');
  view.width = W;
  view.height = H;
  ctx.imageSmoothingEnabled = false;

  // The hero's feet box is rows 8-13 and columns 2-13 of the 16 x 14 sprite.
  const hero = { x: 5 * TILE, y: 6 * TILE - 8, dir: 'down', frame: 0, walked: 0 }; // at the foot of the stairs
  let room = ROOMS.l;
  let state = 'idle'; // idle | playing | reading | paused | leaving | away | returning
  let raf = 0;
  let lastTime = 0;
  let fade = 0;
  let fadeFrom = 0;
  let fadeAt = 0;
  let target = null; // arcade whose game is being entered
  let talk = null; // { thing, page } while reading
  const held = []; // directions currently held, most recent last

  const roomAt = (tx, ty) => ROOMS[LAYOUT[ty]?.[tx]] || null;
  const feetTile = () => [Math.floor((hero.x + 8) / TILE), Math.floor((hero.y + 11) / TILE)];

  // Only the hero's feet collide, so the head may overlap the wall above (Zelda-style).
  const blocked = (x, y) => {
    const corners = [[x + 2, y + 8], [x + 13, y + 8], [x + 2, y + 13], [x + 13, y + 13]];
    return corners.some(([cx, cy]) => {
      const t = grid[Math.floor(cy / TILE)]?.[Math.floor(cx / TILE)];
      return t === undefined || SOLID.has(t);
    });
  };

  // Slide up to `amount` px along one axis, one pixel at a time, stopping at walls.
  const slide = (axis, amount) => {
    const sign = Math.sign(amount);
    let left = Math.abs(amount);
    while (left > 0) {
      const s = Math.min(1, left);
      const nx = hero.x + (axis === 'x' ? s * sign : 0);
      const ny = hero.y + (axis === 'y' ? s * sign : 0);
      if (blocked(nx, ny)) return;
      hero.x = nx;
      hero.y = ny;
      left -= s;
    }
  };

  // The thing in front of the hero, or else any one beside it.
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const nearThing = () => {
    const [tx, ty] = feetTile();
    const [fx, fy] = DIRS[hero.dir];
    return thingAt(tx + fx, ty + fy)
      || Object.values(DIRS).map(([dx, dy]) => thingAt(tx + dx, ty + dy)).find(Boolean)
      || null;
  };

  /* ---------- Drawing ---------- */

  const draw = (t) => {
    ctx.drawImage(map, 0, 0);
    TORCHES.forEach(([x, y]) => flame(ctx, x * TILE, y * TILE, Math.floor(t / 220 + x) % 2));

    const hx = Math.round(hero.x);
    const hy = Math.round(hero.y);
    ctx.fillStyle = 'rgba(0, 0, 0, .25)';
    ctx.beginPath();
    ctx.ellipse(hx + 8, hy + 13.5, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    POTS.forEach(([x, y]) => { if (y * TILE + TILE <= hy + 14) pot(ctx, x * TILE, y * TILE); });
    ctx.drawImage(SPRITES[hero.dir][hero.frame], hx, hy - (hero.frame ? 1 : 0));
    POTS.forEach(([x, y]) => { if (y * TILE + TILE > hy + 14) pot(ctx, x * TILE, y * TILE); });

    const near = state === 'playing' ? nearThing() : null;
    THINGS.forEach((thing) => {
      const active = thing === near;
      prompt(ctx, thing.x * TILE, thing.y * TILE, active ? Math.floor(t / 400) % 2 : 0, active);
    });

    if (fade > 0) {
      ctx.fillStyle = `rgba(20, 12, 4, ${fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  };

  /* ---------- Scene flow ---------- */

  const showOverlay = (text, label) => {
    msg.textContent = text;
    startBtn.textContent = label;
    overlay.hidden = false;
  };

  const run = () => {
    lastTime = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };

  const switchTo = (thing) => {
    cancelAnimationFrame(raf);
    state = 'away';
    const game = document.querySelector(thing.game);
    root.hidden = true;
    game.hidden = false;
    game.dispatchEvent(new CustomEvent('scene-enter'));
    game.scrollIntoView({ block: 'nearest' });
  };

  const enterGame = (thing) => {
    state = 'leaving';
    target = thing;
    held.length = 0;
    hero.frame = 0;
    fadeFrom = fade;
    fadeAt = performance.now();
    roomOut.textContent = `Starting ${thing.name}…`;
  };

  const leaveGame = (game) => {
    if (state !== 'away') return;
    game.dispatchEvent(new CustomEvent('scene-exit'));
    game.hidden = true;
    root.hidden = false;
    overlay.hidden = true;
    roomOut.textContent = room.name;
    state = 'returning';
    fadeFrom = fade;
    fadeAt = performance.now();
    stage.focus({ preventScroll: true });
    root.scrollIntoView({ block: 'nearest' });
    run();
  };

  /* ---------- Reading ---------- */

  const showPage = () => {
    const { thing, page } = talk;
    talkTitle.textContent = `${thing.name} · ${page + 1} / ${thing.pages.length}`;
    talkText.textContent = thing.pages[page];
    talkMore.textContent = page + 1 < thing.pages.length ? 'next' : 'done';
    talkEl.hidden = false;
  };

  const startReading = (thing) => {
    state = 'reading';
    held.length = 0;
    hero.frame = 0;
    talk = { thing, page: 0 };
    showPage();
  };

  const stopReading = () => {
    talk = null;
    talkEl.hidden = true;
    if (state === 'reading') state = 'playing';
  };

  const nextPage = () => {
    if (talk.page + 1 < talk.thing.pages.length) {
      talk.page++;
      showPage();
    } else stopReading();
  };

  // Z: use the thing in front of the hero, or turn the page while reading.
  const interact = () => {
    if (state === 'reading') {
      nextPage();
      return;
    }
    if (state !== 'playing') return;
    const thing = nearThing();
    if (!thing) return;
    if (thing.game) enterGame(thing);
    else startReading(thing);
  };

  const pause = () => {
    if (state !== 'playing' && state !== 'reading') return;
    stopReading();
    state = 'paused';
    cancelAnimationFrame(raf);
    held.length = 0;
    hero.frame = 0;
    draw(performance.now());
    showOverlay('Paused', 'Continue');
  };

  const resume = () => {
    state = 'playing';
    overlay.hidden = true;
    stage.focus({ preventScroll: true });
    run();
  };

  const tick = (t) => {
    const dt = Math.max(0, Math.min(50, t - lastTime)); // the first frame stamp can predate run()
    lastTime = t;

    if (state === 'leaving' || state === 'returning') {
      const k = Math.min(1, (t - fadeAt) / FADE);
      fade = state === 'leaving' ? fadeFrom + (1 - fadeFrom) * k : fadeFrom * (1 - k);
      draw(t);
      if (k < 1) raf = requestAnimationFrame(tick);
      else if (state === 'leaving') switchTo(target);
      else {
        state = 'playing';
        raf = requestAnimationFrame(tick);
      }
      return;
    }
    if (state !== 'playing' && state !== 'reading') return;

    const dir = state === 'playing' && held[held.length - 1];
    if (dir) {
      hero.dir = dir;
      const step = (SPEED * dt) / 1000;
      const dx = (held.includes('right') ? 1 : 0) - (held.includes('left') ? 1 : 0);
      const dy = (held.includes('down') ? 1 : 0) - (held.includes('up') ? 1 : 0);
      const norm = dx && dy ? Math.SQRT1_2 : 1;
      if (dx) slide('x', dx * step * norm);
      if (dy) slide('y', dy * step * norm);
      hero.walked += dt;
      hero.frame = Math.floor(hero.walked / STEP) % 2;
    } else {
      hero.walked = 0;
      hero.frame = 0;
    }

    const r = roomAt(...feetTile());
    if (r && r !== room) {
      room = r;
      roomOut.textContent = r.name;
    }

    draw(t);
    raf = requestAnimationFrame(tick);
  };

  /* ---------- Input ---------- */

  const KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };
  const unhold = (dir) => {
    const i = held.indexOf(dir);
    if (i >= 0) held.splice(i, 1);
  };
  const hold = (dir) => {
    unhold(dir);
    held.push(dir);
  };

  root.addEventListener('keydown', (e) => {
    if (e.target.closest('button') && (e.code === 'Enter' || e.code === 'Space')) return;
    if (state === 'idle' || state === 'paused') {
      if (e.code === 'Enter' && !e.repeat) {
        e.preventDefault();
        resume();
      }
      return;
    }
    if (state !== 'playing' && state !== 'reading') return;
    if (e.code === 'KeyZ') {
      e.preventDefault();
      if (!e.repeat) interact();
    } else if (e.code === 'KeyX' || e.code === 'Escape') {
      if (state !== 'reading') return;
      e.preventDefault();
      stopReading();
    } else if (KEYS[e.code]) {
      e.preventDefault();
      if (!e.repeat && state === 'playing') hold(KEYS[e.code]);
    }
  });
  root.addEventListener('keyup', (e) => {
    const dir = KEYS[e.code];
    if (dir) unhold(dir);
  });

  // Touch pad: hold a direction to keep walking; Z and X act like the keys.
  root.querySelectorAll('[data-dir]').forEach((b) => {
    const dir = b.dataset.dir;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (state !== 'playing') return;
      hold(dir);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => b.addEventListener(type, () => unhold(dir)));
  });
  root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (b.dataset.act === 'z') interact();
    else if (state === 'reading') stopReading();
  }));
  talkEl.addEventListener('click', () => { if (state === 'reading') nextPage(); });
  startBtn.addEventListener('click', resume);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) resume();
  });

  // The red window button of each game window leads back to the dungeon.
  THINGS.filter((t) => t.game).forEach((t) => {
    const game = document.querySelector(t.game);
    game?.querySelectorAll('[data-exit]').forEach((b) => b.addEventListener('click', () => leaveGame(game)));
  });

  // Stop whenever attention goes elsewhere.
  root.addEventListener('focusout', (e) => {
    if (!e.relatedTarget || !root.contains(e.relatedTarget)) pause();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!root.contains(e.target)) pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('blur', pause);

  roomOut.textContent = room.name;
  draw(0);
  showOverlay('Explore the lobby, then find the five game rooms.', 'Enter the dungeon');
})();
