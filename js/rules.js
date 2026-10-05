/* Power Chess rules engine.
   Standard chess plus the player-only power-ups. Works in the browser
   (window.Rules) and in node (module.exports) so it can be perft-tested.

   Boards are W x H, from 1 x 1 up to 26 x 26 (8 x 8 by default). Squares are 0..W*H-1 row by row from
   the top: 0 = a8, 63 = h1 on the normal board. Pieces are FEN letters, '' = empty. The size comes with
   the state (s.W, s.H, set by fromFen); every entry point switches the tables to it (use).
   cfg.pw = { w: { sniper: true, ... }, b: { ... } } gives each side its own set of
   power-ups. The older flat form still works: the flags sit on cfg itself and
   belong to cfg.side, or to both sides when cfg.both is set.
   cfg.dice with cfg.seed turns the game into Dice Chess. */
(function (root) {
  'use strict';

  var FILES = 'abcdefghijklmnopqrstuvwxyz', MAXW = 26, MAXN = MAXW * MAXW;
  /* The board size in use and the tables that go with it: ROW and COL of every square, the squares around
     each one (KG_T), and the rim (RIM) for the infiltrator. Built once per size and kept. */
  var W = 0, H = 0, N = 0, ROW = null, COL = null, KG_T = null, RIM = null, RIM_AT = null, GEO = {};
  function setGeo(w, h) {
    if (w === W && h === H) return;
    var key = w + 'x' + h, g = GEO[key];
    if (!g) {
      var n = w * h, row = new Int16Array(n), col = new Int16Array(n), kg = [], rim = [], at = new Int16Array(n).fill(-1), q, d;
      for (q = 0; q < n; q++) { row[q] = Math.floor(q / w); col[q] = q % w; }
      for (q = 0; q < n; q++) {
        var l = [];
        for (d = 0; d < 8; d++) { var rr = row[q] + KG[d][0], ff = col[q] + KG[d][1]; if (rr >= 0 && rr < h && ff >= 0 && ff < w) l.push(rr * w + ff); }
        kg.push(l);
      }
      // the rim, clockwise from the top left corner (a single row or file is walked once)
      for (q = 0; q < w; q++) rim.push(q);
      for (q = 1; q < h; q++) rim.push(q * w + w - 1);
      if (h > 1) for (q = w - 2; q >= 0; q--) rim.push((h - 1) * w + q);
      if (w > 1) for (q = h - 2; q >= 1; q--) rim.push(q * w);
      rim = rim.filter(function (x, i) { return rim.indexOf(x) === i; });
      for (q = 0; q < rim.length; q++) at[rim[q]] = q;
      g = GEO[key] = { row: row, col: col, kg: kg, rim: rim, at: at };
    }
    W = w; H = h; N = w * h; ROW = g.row; COL = g.col; KG_T = g.kg; RIM = g.rim; RIM_AT = g.at;
  }
  // Switch to the size of this state (cheap when it is already the one in use).
  function use(s) { var w = (s && s.W) || 8, h = (s && s.H) || 8; if (w !== W || h !== H) setGeo(w, h); }
  // Castling exists only on the normal board.
  function classic() { return W === 8 && H === 8; }
  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  var KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  var ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var RIGHTS = { 60: 'KQ', 63: 'K', 56: 'Q', 4: 'kq', 7: 'k', 0: 'q' };
  var NO_POWERS = { side: 'w' };
  setGeo(8, 8);

  function sqName(i) { return FILES[COL[i]] + (H - ROW[i]); }
  function sqIndex(n) { return (H - parseInt(n.slice(1), 10)) * W + FILES.indexOf(n[0]); }
  function colorOf(p) { return p ? (p === p.toUpperCase() ? 'w' : 'b') : null; }
  function typeOf(p) { return LOW[p] || p.toLowerCase(); }
  function other(c) { return c === 'w' ? 'b' : 'w'; }
  function inside(r, f) { return r >= 0 && r < H && f >= 0 && f < W; }
  var NONE = {};
  var KEYS = ['double', 'sniper', 'midas', 'dragon', 'amazon', 'explosive', 'drops', 'portals', 'rocket', 'freeze', 'immortal', 'storm',
    'timestop', 'rampage', 'bodyguard', 'earlypromo', 'ghost', 'archer', 'iron', 'swap', 'turncoat', 'shield', 'tempo', 'helmet', 'vest', 'sniperNP', 'ghostNP', 'ghostAll',
    'helmetP', 'helmetN', 'helmetB', 'helmetR', 'helmetQ', 'helmetAll', 'helmetNP', 'vestP', 'vestN', 'vestB', 'vestR', 'vestQ', 'vestAll', 'vestNP',
    'sniperP', 'sniperR', 'sniperQ', 'sniperK', 'ghostB', 'ghostQ', 'sniperAll'];
  /* Snipers and ghosts exist for several piece types. The flags: sniper = bishops, archer = knights,
     sniperP/R/Q/K = pawns, rooks, queens, king, sniperAll = every piece there is (fairy, Ouroboros and checkers too). ghost = rooks, ghostB/ghostQ = bishops, queens. */
  // The power-ups of one color.
  function powersOf(cfg, c) {
    if (cfg.pw) return cfg.pw[c] || NONE;
    return (cfg.both || cfg.side === c) ? cfg : NONE;
  }
  function has(cfg, c) { return powersOf(cfg, c) !== NONE; }
  function anyPower(o) { for (var i = 0; i < KEYS.length; i++) if (o[KEYS[i]]) return true; return false; }
  // Reinforcements: each side keeps its own pocket.
  function pocketKey(cfg, c) { return c === (cfg.side === 'b' ? 'b' : 'w') ? 'pocket' : 'pocket2'; }
  function near(a, b) { return a >= 0 && Math.abs(ROW[a] - ROW[b]) <= 1 && Math.abs(COL[a] - COL[b]) <= 1; }

  /* ---------- fairy pieces ----------
     Pieces beyond the six of chess, each a lowercase letter (uppercase = White) and a list of move
     atoms. ride: slides along dirs up to max squares (0 = any), min = squares it must pass first,
     jump = other pieces do not block it. leap: jumps straight to the offsets. walk: up to n steps
     straight, turning allowed, through empty squares. two: one step along the first dirs, then a
     ride along the second. mode: m = may only move there, c = may only capture there, mc = both.
     fwd: dirs are given for White and mirrored for Black. The Greek letters are only used because
     the Latin ones ran out; they never reach an engine that would not understand them. */
  var CAMEL = [[-3, -1], [-3, 1], [-1, -3], [1, -3], [3, -1], [3, 1], [-1, 3], [1, 3]];
  var ZEBRA = [[-3, -2], [-3, 2], [-2, -3], [2, -3], [3, -2], [3, 2], [-2, 3], [2, 3]];
  var ALFIL = [[-2, -2], [-2, 2], [2, -2], [2, 2]], DABB = [[-2, 0], [2, 0], [0, -2], [0, 2]];
  var VERT = [[-1, 0], [1, 0]], HORZ = [[0, -1], [0, 1]], FWD_DIAG = [[-1, -1], [-1, 1]], BACK = [[1, 0]];
  var BOX2 = [], RING2 = [];
  for (var bx = -2; bx <= 2; bx++) for (var by = -2; by <= 2; by++) {
    if (bx || by) BOX2.push([bx, by]);
    if (Math.abs(bx) === 2 || Math.abs(by) === 2) RING2.push([bx, by]); // the outline of the 5x5 square
  }
  var FWD = [[-1, 0]], FWD2 = [[-1, 0]];
  // the two swings of a troll: the 3x3 block ahead and to the right, and the one behind and to the left
  var TROLL_R = [], TROLL_L = [];
  for (var tr = 1; tr <= 3; tr++) for (var tf = 1; tf <= 3; tf++) { TROLL_R.push([-tr, tf], [tr, -tf]); }
  for (tr = 1; tr <= 3; tr++) for (tf = 1; tf <= 3; tf++) { TROLL_L.push([-tr, -tf], [tr, tf]); }
  /* rot: the offsets are given for White and turned by 180 degrees for Black (fwd only mirrors the rank). */
  function ride(d, max, o) { o = o || {}; return { k: 'ride', d: d, max: max || 0, min: o.min || 1, jump: !!o.jump, hop: !!o.hop, mode: o.mode || 'mc', fwd: !!o.fwd, thru: !!o.thru, bounce: !!o.bounce }; }
  function leap(d, o) { o = o || {}; return { k: 'leap', d: d, mode: o.mode || 'mc', fwd: !!o.fwd, rot: !!o.rot }; }
  function walk(n) { return { k: 'walk', n: n }; }
  // checkers: take by jumping over the piece next to it onto the empty square beyond (that piece is removed)
  function hopcap(d, o) { o = o || {}; return { k: 'hopcap', d: d, fwd: !!o.fwd }; }
  function two(first, then, max, hop) { return { k: 'two', first: first, then: then, max: max || 0, hop: !!hop }; }
  var EDGE = { k: 'edge' };   // runs along the rim of the board, round the corners too
  /* Walks the rim from sq both ways. step(to) is told about every square in turn and returns false to stop
     that direction. */
  function rimRun(sq, step) {
    var at = RIM_AT[sq];
    if (at < 0) return;
    for (var dir = -1; dir <= 1; dir += 2) {
      for (var k = 1; k < RIM.length; k++) {
        var to = RIM[(at + dir * k + RIM.length * 2) % RIM.length];
        if (to === sq || step(to) === false) break;
      }
    }
  }
  var ANY = { k: 'any' };     // jumps to any empty square
  var REAP = { k: 'reap' };   // takes any enemy standing on a square of its own colour
  // the moves of the chess pieces as atoms, for the pieces that copy others
  var STD_ATOMS = {
    p: [ride(FWD, 1, { mode: 'm', fwd: true }), ride(FWD_DIAG, 1, { mode: 'c', fwd: true })],
    n: [leap(KN)], b: [ride(DIAG)], r: [ride(ORTH)], q: [ride(KG)], k: [ride(KG, 1)]
  };
  var FAIRY = {
    a: { name: 'Amazon', san: 'Am', pic: 'amazon', base: 'Q', badge: 'N', value: 1200, how: 'Moves like a queen or a knight', atoms: [ride(KG), leap(KN)] },
    h: { name: 'Archbishop', san: 'Ab', pic: 'archbishop', base: 'B', badge: 'N', value: 700, how: 'Moves like a bishop or a knight', atoms: [ride(DIAG), leap(KN)] },
    e: { name: 'Chancellor', san: 'Ch', pic: 'chancellor', base: 'R', badge: 'N', value: 800, how: 'Moves like a rook or a knight', atoms: [ride(ORTH), leap(KN)] },
    i: { name: 'Centaur', san: 'Ce', pic: 'centaur', base: 'N', badge: 'K', value: 600, how: 'Moves like a knight or one step in any direction', atoms: [leap(KN), ride(KG, 1)] },
    u: { name: 'Nightrider', san: 'Nr', pic: 'nightrider', base: 'N', badge: 'N', value: 500, how: 'Keeps jumping like a knight in the same direction while the squares it lands on are empty', atoms: [ride(KN, 0, { hop: true })] },
    m: { name: 'Commoner', san: 'Co', pic: 'commoner', base: 'K', badge: 'P', value: 300, how: 'Moves like a king, but it can be taken', atoms: [ride(KG, 1)] },
    j: { name: 'Wizard', san: 'Wz', pic: 'wizard', base: 'N', badge: 'B', value: 350, how: 'Jumps like a camel (1,3) or steps one square diagonally', atoms: [leap(CAMEL), ride(DIAG, 1)] },
    l: { name: 'Champion', san: 'Cp', pic: 'champion', base: 'R', badge: 'N', value: 400, how: 'Steps one square straight, or jumps two squares straight or diagonally', atoms: [ride(ORTH, 1), leap(ALFIL), leap(DABB)] },
    g: { name: 'Elephant', san: 'El', pic: 'elephant', base: 'B', badge: '', value: 180, how: 'Steps one square diagonally or jumps two squares diagonally', atoms: [ride(DIAG, 1), leap(ALFIL)] },
    c: { name: 'Camel', san: 'Ca', pic: 'camel', base: 'N', badge: '', value: 220, how: 'Jumps three squares one way and one the other (1,3)', atoms: [leap(CAMEL)] },
    z: { name: 'Zebra', san: 'Zb', pic: 'zebra', base: 'N', badge: '', value: 220, how: 'Jumps three squares one way and two the other (2,3)', atoms: [leap(ZEBRA)] },
    d: { name: 'Dabbaba', san: 'Db', pic: 'dabbaba', base: 'R', badge: '', value: 150, how: 'Jumps exactly two squares straight', atoms: [leap(DABB)] },
    f: { name: 'Ferz', san: 'Fz', pic: 'ferz', base: 'Q', badge: '', value: 140, how: 'Steps one square diagonally', atoms: [ride(DIAG, 1)] },
    w: { name: 'Wazir', san: 'Wa', pic: 'wazir', base: 'R', badge: '', value: 150, how: 'Steps one square straight', atoms: [ride(ORTH, 1)] },
    // from The Ouroboros King
    o: { name: 'Crusader', san: 'Cr', pic: 'crusader', base: 'B', badge: 'P', value: 400, how: 'Slides diagonally forward any distance, or straight backward', atoms: [ride(FWD_DIAG, 0, { fwd: true }), ride(BACK, 0, { fwd: true })] },
    s: { name: 'Viking', san: 'Vk', pic: 'viking', base: 'R', badge: 'P', value: 300, how: 'Walks up to two squares straight, and may turn after the first', atoms: [walk(2)] },
    t: { name: 'Berserker', san: 'Bs', pic: 'berserker', base: 'R', badge: 'K', value: 450, how: 'Walks up to three squares straight, turning as it likes', atoms: [walk(3)] },
    v: { name: 'Bowman', san: 'Bw', pic: 'bowman', base: 'Q', badge: 'P', value: 550, how: 'Slides like a queen, but always two squares or more', atoms: [ride(KG, 0, { min: 2 })] },
    x: { name: 'Catapult', san: 'Ct', pic: 'catapult', base: 'R', badge: 'N', value: 550, how: 'Flies any distance up or down the file over everything, or slides up to two squares sideways', atoms: [ride(VERT, 0, { jump: true }), ride(HORZ, 2)] },
    y: { name: 'Sorcerer', san: 'So', pic: 'sorcerer', base: 'B', badge: 'N', value: 350, how: 'Jumps two squares diagonally, then may step one square straight from there', atoms: [two(ALFIL, ORTH, 1, true)] },
    'α': { name: 'Manticore', san: 'Ma', pic: 'manticore', base: 'B', badge: 'R', value: 450, how: 'Steps one square straight, then may slide diagonally from there', atoms: [two(ORTH, DIAG, 0)] },
    'β': { name: 'Gryphon', san: 'Gr', pic: 'gryphon', base: 'R', badge: 'B', value: 500, how: 'Steps one square diagonally, then may slide straight from there', atoms: [two(DIAG, ORTH, 0)] },
    'γ': { name: 'Minotaur', san: 'Mi', pic: 'minotaur', base: 'B', badge: 'Q', value: 650, how: 'Moves like a manticore or a bishop', atoms: [two(ORTH, DIAG, 0), ride(DIAG)] },
    'δ': { name: 'Hydra', san: 'Hy', pic: 'hydra', base: 'R', badge: 'Q', value: 750, how: 'Moves like a gryphon or a rook', atoms: [two(DIAG, ORTH, 0), ride(ORTH)] },
    'ε': { name: 'Phoenix', san: 'Ph', pic: 'phoenix', base: 'Q', badge: 'K', value: 400, how: 'Slides up to two squares in any direction. When taken it comes back once, in its home corner (a1 for White, h8 for Black) if that square is free', atoms: [ride(KG, 2)] },
    'ζ': { name: 'Whelp', san: 'Wh', pic: 'whelp', base: 'R', badge: 'P', value: 250, how: 'Slides up to two squares straight', atoms: [ride(ORTH, 2)] },
    'η': { name: 'Dragon', san: 'Dr', pic: 'wyrm', base: 'R', badge: 'B', value: 350, how: 'Slides up to three squares straight', atoms: [ride(ORTH, 3)] },
    'θ': { name: 'Cardinal', san: 'Cd', pic: 'cardinal', base: 'B', badge: 'K', value: 450, how: 'Moves like a bishop or a king', atoms: [ride(DIAG), ride(KG, 1)] },
    'ι': { name: 'War Wagon', san: 'Ww', pic: 'warwagon', base: 'R', badge: 'K', value: 650, how: 'Moves like a rook or a king', atoms: [ride(ORTH), ride(KG, 1)] },
    'κ': { name: 'Pegasus Rider', san: 'Pg', pic: 'pegasus', base: 'N', badge: 'B', value: 400, how: 'Makes one or two knight jumps in the same direction, jumping over everything in between', atoms: [leap(KN), leap(KN.map(function (d) { return [d[0] * 2, d[1] * 2]; }))] },
    'λ': { name: 'Blade Dancer', san: 'Bd', pic: 'bladedancer', base: 'N', badge: 'Q', value: 450, how: 'Jumps to any square on the outline of the 5x5 square around it, over anything in between, but never to a square next to it. After a capture it moves once more, once per turn', atoms: [leap(RING2)] },
    'μ': { name: 'Musketeer', san: 'Mu', pic: 'musketeer', base: 'R', badge: 'B', value: 450, how: 'Moves any distance up or down the file, or one square diagonally. It never moves to take: it shoots straight ahead any distance, or one square diagonally ahead, and stays where it is', atoms: [ride(VERT, 0, { mode: 'm' }), ride(DIAG, 1, { mode: 'm' }), ride(FWD, 0, { mode: 'c', fwd: true }), ride(FWD_DIAG, 1, { mode: 'c', fwd: true })] },
    'ν': { name: 'Knight Templar', san: 'Kt', pic: 'templar', base: 'B', badge: 'R', value: 600, how: 'Slides any distance along the file or diagonally', atoms: [ride(VERT), ride(DIAG)] },
    'ξ': { name: 'Royal Guard', san: 'Rg', pic: 'royalguard', base: 'K', badge: 'Q', value: 500, how: 'Moves like a king, but captures like a queen', atoms: [ride(KG, 1, { mode: 'm' }), ride(KG, 0, { mode: 'c' })] },
    /* The rest of The Ouroboros King's units, abilities included. The letters are the remaining Greek
       ones and then Cyrillic ones that do not look like Latin letters. Ability flags, read by the
       rules: royal (must be kept safe like the king), prince (the king cannot be checked while it is
       within three squares), immortal (only a king takes it, it never gives check), again (moves once
       more after a capture), shoot (captures from where it stands), respawn (comes back once in its corner, s.reborn holds the ones that did),
       becomes (turns into another piece after moving), onCapture (turns into a queen, or into what it
       took), promote (becomes a queen on the last rank), decoy (swaps with allies, takes its killer
       with it), leper (its killer becomes a leper, not a shooter), martyr (explodes when taken), banner (adjacent
       allies move like queens), gorgon (adjacent enemies cannot move), rocks (breaks boulders),
       spawn (leaves a pawn behind and becomes one), mimic (copies other pieces), noBack (never onto
       the first or last rank). A gold statue has no abilities left. */
    'ο': { name: 'Prince', san: 'Pr', pic: 'prince', base: 'K', badge: 'P', value: 380, how: 'Moves like a king. While it stands within three squares of its king, the king cannot be checked or mated', atoms: [ride(KG, 1)], prince: true },
    'π': { name: 'Immortal', san: 'Im', pic: 'immortal', base: 'K', badge: 'R', value: 420, how: 'Moves like a king. Only a king can take it, and it never gives check', atoms: [ride(KG, 1)], immortal: true },
    'ρ': { name: 'Assassin', san: 'As', pic: 'assassin', base: 'K', badge: 'N', value: 360, how: 'Moves like a king. After a capture it moves once more, once per turn', atoms: [ride(KG, 1)], again: true },
    'τ': { name: 'Fire Chick', san: 'Fc', pic: 'firechick', base: 'K', badge: 'B', value: 320, how: 'Moves like a king. When taken it comes back once, in its home corner (a1 for White, h8 for Black) if that square is free', atoms: [ride(KG, 1)], respawn: true },
    'υ': { name: 'Egg', san: 'Eg', pic: 'egg', base: 'P', badge: '', value: 40, how: 'Cannot move at all', atoms: [] },
    // the agents change form with every move, so both forms of a pair are worth the same (the mean): the evaluation does not swing each time one moves
    'φ': { name: 'Agent +', san: 'Ar', pic: 'agentplus', base: 'R', badge: '+', value: 410, how: 'Moves like a rook. After moving it becomes Agent X, which moves like a bishop', atoms: [ride(ORTH)], becomes: 'χ' },
    'χ': { name: 'Agent X', san: 'Ai', pic: 'agentx', base: 'B', badge: 'x', value: 410, how: 'Moves like a bishop. After moving it becomes Agent +, which moves like a rook', atoms: [ride(DIAG)], becomes: 'φ' },
    'ψ': { name: 'Agent L', san: 'Al', pic: 'agentl', base: 'N', badge: 'L', value: 600, how: 'Moves like a knight. After moving it becomes Agent *, which moves like a queen', atoms: [leap(KN)], becomes: 'ω' },
    'ω': { name: 'Agent *', san: 'Aq', pic: 'agentstar', base: 'Q', badge: '*', value: 600, how: 'Moves like a queen. After moving it becomes Agent L, which moves like a knight', atoms: [ride(KG)], becomes: 'ψ' },
    'б': { name: 'Decoy', san: 'Dc', pic: 'decoy', base: 'P', badge: 'K', value: 260, how: 'Moves by changing places with any of its own pieces, and takes one square diagonally. Whatever takes it is taken with it, so no king will; a shot from a distance is safe', atoms: [ride(DIAG, 1, { mode: 'c' })], decoy: true },
    'в': { name: 'Fool', san: 'Fo', pic: 'fool', base: 'N', badge: 'P', value: 300, how: 'Moves the way the last enemy piece that moved does. Until an enemy has moved it stays put', atoms: [], mimic: 'fool' },
    'г': { name: 'Infiltrator', san: 'In', pic: 'infiltrator', base: 'K', badge: 'B', value: 400, how: 'Moves like a king, or any distance along the edge of the board. It may step onto a boulder next to it and break it', atoms: [ride(KG, 1), EDGE], rocks: true },
    'д': { name: 'Marching Pawn', san: 'Mp', pic: 'marchingpawn', base: 'P', badge: '', value: 130, how: 'Moves one or two squares forward or one square diagonally forward, takes only diagonally, and becomes a queen on the last rank', atoms: [ride(FWD, 2, { mode: 'm', fwd: true }), ride(FWD_DIAG, 1, { fwd: true })], promote: true },
    'ж': { name: 'Princess', san: 'Ps', pic: 'princess', base: 'Q', badge: 'P', value: 330, how: 'Moves one square straight or up to two diagonally. After a capture she becomes a queen', atoms: [ride(ORTH, 1), ride(DIAG, 2)], onCapture: 'q' },
    'з': { name: 'Leper', san: 'Lp', pic: 'leper', base: 'K', badge: 'P', value: 240, how: 'Moves like a king. Whatever takes it becomes a leper itself, unless it is a king or shoots it from a distance', atoms: [ride(KG, 1)], leper: true },
    'и': { name: 'Glass Queen', san: 'Gq', pic: 'glassqueen', base: 'Q', badge: '', value: 880, how: 'Moves like a queen. In the game she is lost for good once taken; here that is just a queen', atoms: [ride(KG)] },
    'й': { name: 'Mirror Queen', san: 'Mq', pic: 'mirrorqueen', base: 'Q', badge: 'B', value: 880, how: 'Moves like a queen. After a capture she becomes whatever she took', atoms: [ride(KG)], onCapture: 'mirror' },
    'л': { name: 'Portal Mage', san: 'Pm', pic: 'portalmage', base: 'B', badge: 'K', value: 420, how: 'Jumps to any empty square on the board, but only takes on the squares next to it', atoms: [ANY, ride(KG, 1, { mode: 'c' })] },
    'п': { name: 'Troll', san: 'Tr', pic: 'troll', base: 'N', badge: 'R', value: 380, how: 'Jumps to any square in the 3x3 block ahead and to its right, or behind and to its left. After moving it swings the other way', atoms: [leap(TROLL_R, { rot: true })], becomes: 'ф' },
    'ф': { name: 'Troll (left swing)', san: 'Tl', pic: 'trollleft', base: 'N', badge: 'L', value: 380, how: 'Jumps to any square in the 3x3 block ahead and to its left, or behind and to its right. After moving it swings the other way', atoms: [leap(TROLL_L, { rot: true })], becomes: 'п' },
    'ц': { name: 'Reaper', san: 'Rp', pic: 'reaper', base: 'K', badge: 'B', value: 520, how: 'Moves like a king, and takes any enemy piece standing on a square of the same colour as its own, wherever it is. Kings and witches are safe from it', atoms: [ride(KG, 1), REAP] },
    'ч': { name: 'Bannerman', san: 'Bn', pic: 'bannerman', base: 'K', badge: 'R', value: 360, how: 'Moves like a king. Its own pieces on the squares next to it may also move like queens; an assassin, blade dancer or martyr may not capture that way', atoms: [ride(KG, 1)], banner: true },
    'ш': { name: 'Gorgon', san: 'Go', pic: 'gorgon', base: 'Q', badge: 'K', value: 600, how: 'Moves like a queen but never takes. Enemy pieces on the squares next to it are turned to stone and cannot move', atoms: [ride(KG, 0, { mode: 'm' })], gorgon: true },
    'щ': { name: 'Martyr', san: 'Mt', pic: 'martyr', base: 'K', badge: 'P', value: 300, how: 'Moves one square in any direction. When taken it explodes and takes every piece around it with it, kings excepted. Blasts cannot hurt it', atoms: [ride(KG, 1)], martyr: true },
    'ы': { name: 'Quartermaster', san: 'Qm', pic: 'quartermaster', base: 'K', badge: 'P', value: 260, how: 'Moves like a king, never onto the first or last rank. After moving it becomes a pawn and leaves another pawn where it stood', atoms: [ride(KG, 1)], spawn: true, noBack: true },
    'э': { name: 'Mounted King', san: 'Mk', pic: 'mountedking', base: 'K', badge: 'N', value: 0, how: 'Moves like a king or a knight. It is royal: it must be kept safe just like the king, and losing it loses the game', atoms: [ride(KG, 1), leap(KN)], royal: true },
    'ю': { name: 'General', san: 'Gn', pic: 'general', base: 'K', badge: 'R', value: 0, how: 'Moves like a king. It is royal: it must be kept safe just like the king, and losing it loses the game', atoms: [ride(KG, 1)], royal: true },
    'я': { name: 'Tabitha', san: 'Tb', pic: 'tabitha', base: 'Q', badge: 'N', value: 700, how: 'The Deceptive, a witch: moves like any enemy piece on the board, except a portal mage', atoms: [], mimic: 'tabitha', witch: true },
    'ь': { name: 'Andromeda', san: 'An', pic: 'andromeda', base: 'Q', badge: 'B', value: 650, how: 'Of the Stars, a witch: moves like a manticore or a gryphon', atoms: [two(ORTH, DIAG, 0), two(DIAG, ORTH, 0)], witch: true },
    'ё': { name: 'Edea', san: 'Ed', pic: 'edea', base: 'Q', badge: 'N', value: 1150, how: 'The Witch Queen: moves like a rook, a bishop or a knight', atoms: [ride(ORTH), ride(DIAG), leap(KN)], witch: true },
    'ђ': { name: 'Unicorn Cavalry', san: 'Uc', pic: 'unicorncavalry', base: 'R', badge: 'N', value: 800, how: 'Moves like a rook or a knight', atoms: [ride(ORTH), leap(KN)] },
    'ћ': { name: 'Centaur (Ouroboros)', san: 'Cn', pic: 'oucentaur', base: 'B', badge: 'N', value: 700, how: 'Moves like a bishop or a knight', atoms: [ride(DIAG), leap(KN)] },
    'є': { name: 'Checker', san: 'Ck', pic: 'checker', base: 'P', badge: '', value: 140, how: 'A checkers man: moves one square diagonally forward. It takes by jumping diagonally forward over the piece next to it onto the empty square beyond, and keeps jumping while it can. On the last rank it becomes a checkers king', atoms: [ride(FWD_DIAG, 1, { mode: 'm', fwd: true }), hopcap(FWD_DIAG, { fwd: true })], promote: true, promoteTo: 'ї', hopper: true },
    'ї': { name: 'Checkers King', san: 'Ckk', pic: 'checkerking', base: 'K', badge: '', value: 260, how: 'A crowned checker: moves one square diagonally in any direction, and takes by jumping diagonally over the piece next to it onto the empty square beyond, again and again while it can', atoms: [ride(DIAG, 1, { mode: 'm' }), hopcap(DIAG)], hopper: true },
    // Chess Ultimate: the devil and its demons, the slime and its blobs
    'ѓ': { name: 'Devil', san: 'Dv', pic: 'devil', base: 'K', badge: '', value: 320, how: 'Never moves. Instead of a move it spawns a demon on an empty square next to it (as far as a king reaches), then sleeps for a round before it can spawn the next one', atoms: [], spawner: 'ќ' },
    'ќ': { name: 'Demon', san: 'Dm', pic: 'demon', base: 'P', badge: '', value: 110, how: 'Spawned by a devil. It moves by itself: one square straight forward (the way its side\'s pawns go) after every turn of its side, on top of the move, and takes whatever piece it lands on, its own side\'s too. It passes through boulders, ducks and statues and falls off at the edge of the board or a missing square', atoms: [], demon: true },
    'ў': { name: 'Slime', san: 'Sl', pic: 'slime', base: 'R', badge: '', value: 210, how: 'Moves one or two squares straight like a rook, never takes, and leaves a blob of its own colour on the square it left and the one it slid over', atoms: [ride(ORTH, 2, { mode: 'm' })], slime: 'џ' },
    // Shotgun King: a king with the royal shotgun (from Shotgun King: The Final Checkmate), one per side
    'ґ': { name: 'Shotgun King', san: 'SK', pic: 'shotgunking', base: 'K', badge: '', value: 0, how: 'The king with the royal shotgun. It is its side\'s king (it can be checked and mated) and steps one square any way. Instead of a move it can shoot: 4 pellets fan out over 55 degrees and fly 3 to 5 squares, each one doing 1 damage to the first enemy piece it meets. In a game with a Shotgun King every piece has hit points (pawn and knight 3, bishop 4, rook and queen 5, king 8). It holds 2 shells and 6 in reserve: a step or a reload turn puts one shell back into the gun, a step also brings 1 shell back to the reserve. In check it may shoot the piece giving check if the pellets can kill it, and if that piece survives, the king falls', atoms: [ride(KG, 1)], royal: true, shotgun: true },
    'џ': { name: 'Blob', san: 'Bb', pic: 'blob', base: 'P', badge: '', value: 45, how: 'Left behind by a slime. It never moves and only stands in the way, until it is taken like any other piece', atoms: [] },
    'ъ': { name: 'Golem', san: 'Gl', pic: 'golem', base: 'R', badge: 'K', value: 520, how: 'Moves like a rook, a king or a knight, but only to take: it never moves to an empty square', atoms: [ride(ORTH, 0, { mode: 'c' }), ride(KG, 1, { mode: 'c' }), leap(KN, { mode: 'c' })] },
    /* Shogi: the pieces of Japanese chess, with their own moves. On the board they point at the other side, so both
       sides' pieces look the same but turned round (Settings can colour them). In a chess game a piece that can
       promote does so on the enemy back rank (shogiUp: what it turns into); in the Shogi mode the game's own rules
       apply (Fairy-Stockfish): the last three ranks, drops, and the rest. */
    'ѣ': { name: 'Shogi King', san: 'Ou', pic: 'shogi_king', base: 'K', badge: '', value: 0, how: 'Steps one square in any direction. It is royal: it must be kept safe just like the king, and losing it loses the game', atoms: [ride(KG, 1)], royal: true, shogi: true },
    'ѥ': { name: 'Rook (Hisha)', san: 'Hi', pic: 'shogi_rook', base: 'R', badge: '', value: 500, how: 'Slides any distance straight, like a rook. Promotes to a Dragon King', atoms: [ride(ORTH)], shogi: true, shogiUp: 'ѧ' },
    'ѧ': { name: 'Dragon King (Ryuo)', san: 'Ry', pic: 'shogi_dragon', base: 'R', badge: 'K', value: 700, how: 'The promoted rook: slides any distance straight, or steps one square diagonally', atoms: [ride(ORTH), ride(DIAG, 1)], shogi: true },
    'ѩ': { name: 'Bishop (Kakugyo)', san: 'Ka', pic: 'shogi_bishop', base: 'B', badge: '', value: 330, how: 'Slides any distance diagonally, like a bishop. Promotes to a Dragon Horse', atoms: [ride(DIAG)], shogi: true, shogiUp: 'ѫ' },
    'ѫ': { name: 'Dragon Horse (Ryuma)', san: 'Um', pic: 'shogi_horse', base: 'B', badge: 'K', value: 560, how: 'The promoted bishop: slides any distance diagonally, or steps one square straight', atoms: [ride(DIAG), ride(ORTH, 1)], shogi: true },
    'ѭ': { name: 'Gold General (Kinsho)', san: 'Ki', pic: 'shogi_gold', base: 'K', badge: 'R', value: 300, how: 'Steps one square straight or diagonally forward: six squares, not diagonally back. It does not promote', atoms: [ride(ORTH, 1), ride(FWD_DIAG, 1, { fwd: true })], shogi: true },
    'ѯ': { name: 'Silver General (Ginsho)', san: 'Gi', pic: 'shogi_silver', base: 'K', badge: 'B', value: 270, how: 'Steps one square diagonally or straight forward: five squares, not sideways or straight back. Promotes to a gold-moving silver', atoms: [ride(DIAG, 1), ride(FWD, 1, { fwd: true })], shogi: true, shogiUp: 'ѱ' },
    'ѱ': { name: 'Promoted Silver (Narigin)', san: 'NG', pic: 'shogi_psilver', base: 'K', badge: 'R', value: 300, how: 'The promoted silver: moves like a gold general, one square straight or diagonally forward', atoms: [ride(ORTH, 1), ride(FWD_DIAG, 1, { fwd: true })], shogi: true },
    'ѳ': { name: 'Knight (Keima)', san: 'Ke', pic: 'shogi_knight', base: 'N', badge: '', value: 180, how: 'Jumps two squares forward and one to the side, over anything: only the two forward knight jumps. Promotes to a gold-moving knight', atoms: [leap([[-2, -1], [-2, 1]], { fwd: true })], shogi: true, shogiUp: 'ѵ' },
    'ѵ': { name: 'Promoted Knight (Narikei)', san: 'NK', pic: 'shogi_pknight', base: 'K', badge: 'R', value: 300, how: 'The promoted knight: moves like a gold general, one square straight or diagonally forward', atoms: [ride(ORTH, 1), ride(FWD_DIAG, 1, { fwd: true })], shogi: true },
    'ѹ': { name: 'Lance (Kyosha)', san: 'Ky', pic: 'shogi_lance', base: 'R', badge: 'P', value: 220, how: 'Slides any distance straight forward, never back or sideways. Promotes to a gold-moving lance', atoms: [ride(FWD, 0, { fwd: true })], shogi: true, shogiUp: 'ѻ' },
    'ѻ': { name: 'Promoted Lance (Narikyo)', san: 'NY', pic: 'shogi_plance', base: 'K', badge: 'R', value: 300, how: 'The promoted lance: moves like a gold general, one square straight or diagonally forward', atoms: [ride(ORTH, 1), ride(FWD_DIAG, 1, { fwd: true })], shogi: true },
    'ѽ': { name: 'Shogi Pawn (Fuhyo)', san: 'Fu', pic: 'shogi_pawn', base: 'P', badge: '', value: 80, how: 'Steps one square straight forward, and takes that way too. Promotes to a tokin', atoms: [ride(FWD, 1, { fwd: true })], shogi: true, shogiUp: 'ѿ', pawn: true },
    'ѿ': { name: 'Tokin', san: 'To', pic: 'shogi_tokin', base: 'K', badge: 'R', value: 300, how: 'The promoted pawn: moves like a gold general, one square straight or diagonally forward', atoms: [ride(ORTH, 1), ride(FWD_DIAG, 1, { fwd: true })], shogi: true }
  };
  // the abilities that stay with the piece after it has moved, so that an Assassin and a Blade Dancer share theirs
  FAIRY['λ'].again = true;   // the blade dancer is the assassin's upgrade
  FAIRY['μ'].shoot = true;   // the musketeer returns to its square after a capture
  FAIRY['ε'].respawn = true; // the phoenix comes back like the fire chick
  var FAIRY_LETTERS = Object.keys(FAIRY);
  /* Shogi pieces in any game: the promotion zone is the far third of the board (the ranks, rounded down, at least
     one: 2 on 8 ranks, 3 on 9 to 11, 4 on 12), where the dots are drawn. A move that starts or ends in it may
     promote; a pawn or lance on the last rank and a knight on the last two must. A taken shogi piece goes to its
     taker's hand, unpromoted, and can be dropped back as a move, in every game (with the drop rules of Shogi). */
  var SHOGI_BASE = {};
  FAIRY_LETTERS.forEach(function (k) { if (FAIRY[k].shogiUp) SHOGI_BASE[FAIRY[k].shogiUp] = k; });
  // Shogi has no 50 move rule: a game with shogi pieces on the board or in a hand plays on (taken ones come back)
  function shogiInPlay(s) {
    var sh = function (p) { return p && FAIRY.hasOwnProperty(typeOf(p)) && FAIRY[typeOf(p)].shogi; };
    return !!(s.fairy && s.board.some(sh)) || (s.pocket || []).some(sh) || (s.pocket2 || []).some(sh);
  }
  function shogiZone(h) { return Math.max(1, Math.floor(h / 3)); }
  function inZone(c, row) { var z = shogiZone(H); return c === 'w' ? row < z : row >= H - z; }
  function shogiDead(t, c, row) {
    var last = c === 'w' ? row : H - 1 - row;
    if (t === '\u047d' || t === '\u0479') return last === 0; // pawn, lance
    if (t === '\u0473') return last <= 1;                     // knight
    return false;
  }
  function shogiPromos(out, c) {
    var extra = [];
    for (var i = 0; i < out.length; i++) {
      var m = out[i];
      if (m.drop || m.from < 0 || m.promo || !m.piece || m.snipe || m.shot || m.swap || m.blast || m.stay || m.pass) continue;
      var d = FAIRY[typeOf(m.piece)];
      if (!d || !d.shogiUp || !(inZone(c, ROW[m.from]) || inZone(c, ROW[m.to]))) continue;
      if (shogiDead(typeOf(m.piece), c, ROW[m.to])) { m.promo = '+'; continue; }
      var pm = {};
      for (var k in m) pm[k] = m[k];
      pm.promo = '+';
      extra.push(pm);
    }
    for (i = 0; i < extra.length; i++) out.push(extra[i]);
  }
  /* Lookup tables by piece letter, both colours: the lowercase letter and the fairy definition. The search asks
     these millions of times, and building a lowercase string each time costs more than the move generation. */
  var LOW = {}, DEF = {};
  'pnbrqkPNBRQK'.split('').forEach(function (ch) { LOW[ch] = ch.toLowerCase(); });
  FAIRY_LETTERS.forEach(function (l) { LOW[l] = l; LOW[l.toUpperCase()] = l; DEF[l] = FAIRY[l]; DEF[l.toUpperCase()] = FAIRY[l]; });
  var REACHED = new Int32Array(MAXN), FEATHER = new Int32Array(MAXN), STAMP = 0; // squares a fairy piece has already reached in this listing (FEATHER: swaps)
  var NO_DEF = {}; // a chess piece moved by its atoms (see pseudoMoves)
  /* Upgrades placed by hand on single pieces (board editor): s.ghosts are pieces that move through their own
     pieces like Ghost power-ups, s.snipers ('camo') shoot what they could take, like Sniper power-ups. The
     lists hold squares and follow their pieces from move to move. A gold statue has no upgrade left. */
  function isG(s, sq) { use(s); return !!s.ghosts && s.ghosts.length > 0 && s.ghosts.indexOf(sq) >= 0 && s.gold.indexOf(sq) < 0; }
  function isS(s, sq) { use(s); return !!s.snipers && s.snipers.length > 0 && s.snipers.indexOf(sq) >= 0 && s.gold.indexOf(sq) < 0; }
  /* Spiked Helmet and Explosive Vest, worn by single pieces like the upgrades above (s.helmets, s.vests). A capture of
     a helmeted piece fails: the helmet breaks, the piece stays, the attacker stays where it was and its move is used
     (a shot as well). A blast only breaks a helmet. The vest is a move of its own: the piece goes up and takes every
     piece in the 3 x 3 square around it with it, its own side's too; kings, statues and what is safe from blasts stay. */
  function isH(s, sq) { return !!s.helmets && s.helmets.length > 0 && s.helmets.indexOf(sq) >= 0; }
  function isV(s, sq) { return !!s.vests && s.vests.length > 0 && s.vests.indexOf(sq) >= 0 && s.gold.indexOf(sq) < 0; }
  /* Which pieces an army-wide upgrade (the power-up) goes on at the start: level 1 the chess pieces (pawn to queen),
     2 every piece but the pawns, 3 every piece. Kings only where the upgrade lets them (snipers, ghosts). */
  function armyGets(p, level, kings) {
    if (!p || (isRoyal(p) && !kings)) return false;
    var t = typeOf(p), pawnish = t === 'p' || (!!DEF[p] && (!!DEF[p].promote || !!DEF[p].pawn));
    if (level === 1) return 'pnbrqk'.indexOf(t) >= 0 && !DEF[p];
    if (level === 2) return !pawnish;
    return true;
  }
  function armyUp(list, board, c, level, kings) {
    for (var q = 0; q < board.length; q++) if (board[q] && colorOf(board[q]) === c && armyGets(board[q], level, kings) && list.indexOf(q) < 0) list.push(q);
    return list;
  }
  function isFairy(p) { return !!p && !!DEF[p]; }
  function fairyOf(p) { return p ? DEF[p] || null : null; }
  // A king, or a fairy piece that has to be kept safe like one.
  function isRoyal(p) { if (!p) return false; if (p === 'k' || p === 'K') return true; var d = DEF[p]; return !!d && !!d.royal; }
  // The ability of the piece on sq, or false: a gold statue has none left.
  function ability(s, sq, key) {
    use(s);
    var p = s.board[sq];
    if (!p) return false;
    var def = DEF[p];
    if (!def || !def[key]) return false;
    return s.gold.indexOf(sq) < 0;
  }
  /* Does the board hold any of them? Kept on the state as a set of bits: 1 = any fairy piece, 2 = a gorgon,
     4 = a bannerman, 8 = a prince, 16 = a royal fairy piece. The checks that cost something only run when
     the bit is set. */
  function hasFairy(board) {
    var bits = 0;
    for (var i = 0; i < board.length; i++) {
      var p = board[i];
      if (!p) continue;
      var def = DEF[p];
      if (!def) continue;
      bits |= 1;
      if (def.gorgon) bits |= 2;
      if (def.banner) bits |= 4;
      if (def.prince) bits |= 8;
      if (def.royal) bits |= 16;
      if (def.again) bits |= 32;
      if (def.demon) bits |= 64;   // a demon walks forward after its side's turns
      if (def.spawner) bits |= 128; // a devil that can spawn one
      if (def.shotgun) bits |= 256; // a Shotgun King: pieces have hit points
    }
    return bits;
  }
  var dist = function (a, b) { return Math.max(Math.abs(ROW[a] - ROW[b]), Math.abs(COL[a] - COL[b])); };
  // Is the piece on sq turned to stone by an enemy gorgon next to it? (gorgons themselves never are)
  function stiff(s, sq) {
    use(s);
    if (!(s.fairy & 2)) return false;
    var p = s.board[sq], c = colorOf(p);
    if (DEF[p] && DEF[p].gorgon) return false;
    var r = ROW[sq], f = COL[sq];
    for (var i = 0; i < 8; i++) {
      var rr = r + KG[i][0], ff = f + KG[i][1];
      if (!inside(rr, ff)) continue;
      var q = rr * W + ff, qp = s.board[q];
      if (qp && colorOf(qp) !== c && ability(s, q, 'gorgon')) return true;
    }
    return false;
  }
  // Does a prince of colour c stand within three squares of sq? (Or is it a royal piece of c under the Magic tiara?)
  function guarded(s, sq, c) {
    use(s);
    if (s.ouSafe && s.ouSafe === c && isRoyal(s.board[sq])) return true; // the Magic tiara: the General cannot be taken this turn
    if (!(s.fairy & 8)) return false;
    for (var i = 0; i < N; i++) {
      var p = s.board[i];
      if (p && colorOf(p) === c && dist(i, sq) <= 3 && ability(s, i, 'prince')) return true;
    }
    return false;
  }
  // The squares of the royal pieces of colour c: the king first, then any general or mounted king.
  function royalSquares(s, c) {
    use(s);
    var out = [], k = s.board.indexOf(c === 'w' ? 'K' : 'k');
    if (k >= 0) out.push(k);
    if (s.fairy & 16) for (var i = 0; i < N; i++) { var p = s.board[i]; if (p && i !== k && colorOf(p) === c && DEF[p] && DEF[p].royal) out.push(i); }
    return out;
  }
  /* The move atoms of the piece on sq. A fool uses those of the last enemy piece that moved, Tabitha
     those of every enemy piece on the board (abilities are never copied, and a copied copier is a king). */
  function atomsFor(s, sq) {
    use(s);
    var p = s.board[sq], def = DEF[p], c = colorOf(p);
    if (!def.mimic) return def.atoms;
    var typeAtoms = function (t) {
      if (STD_ATOMS[t]) return STD_ATOMS[t];
      var d = FAIRY[t];
      if (!d) return [];
      if (d.mimic) return STD_ATOMS.k;
      return d.atoms;
    };
    if (def.mimic === 'fool') {
      var last = c === 'w' ? s.lastB : s.lastW;
      return last ? typeAtoms(last) : [];
    }
    var out = [], seen = {};
    for (var i = 0; i < N; i++) {
      var q = s.board[i];
      if (!q || colorOf(q) === c) continue;
      var t = LOW[q];
      if (seen[t] || t === 'л') continue; // not the portal mage
      seen[t] = true;
      out = out.concat(typeAtoms(t));
    }
    return out;
  }

  /* Terrain (cfg.terrain = { walls, water, portals }): a boulder square can neither be entered nor
     passed; a water square can be entered but a slider cannot continue through it; fixed teleporters
     work like the Portals power-up for both sides. */
  function terrainOf(cfg) { return cfg && cfg.terrain ? cfg.terrain : null; }
  // Squares nothing can enter or pass: boulders (an infiltrator may break one) and holes, squares taken out of the board.
  function isWall(cfg, sq, s) { var t = cfg.terrain; return (!!t && ((!!t.holes && t.holes.length > 0 && t.holes.indexOf(sq) >= 0) || isRock(cfg, sq, s))) || duckAt(s, sq) || bombAt(s, sq) || (!!s && !!s.boulders && s.boulders.length > 0 && s.boulders.indexOf(sq) >= 0); }
  /* The Ouroboros King: a bomb stands on a square like a boulder, but it can be taken, and then it blows up with
     everything on the eight squares around it, the piece that took it too (a martyr and a side with the Dwarven
     helmet stay). s.boulders are boulders an item or a relic put there during the game. */
  function bombAt(s, sq) { return !!s && !!s.bombs && s.bombs.length > 0 && s.bombs.indexOf(sq) >= 0; }
  /* Ducks (Duck Chess): a duck stands on a square like a boulder, nothing enters or passes it and nothing takes it, a
     knight jumps over. Yellow ones (s.ducks) have to be moved after every move, blue ones (s.bducks) may be. */
  function duckAt(s, sq) { return !!s && ((!!s.ducks && s.ducks.length > 0 && s.ducks.indexOf(sq) >= 0) || (!!s.bducks && s.bducks.length > 0 && s.bducks.indexOf(sq) >= 0)); }
  function isRock(cfg, sq, s) { var t = cfg.terrain; return (!!t && !!t.walls && t.walls.indexOf(sq) >= 0 && !(s && s.rocks && s.rocks.length && s.rocks.indexOf(sq) >= 0)) || (!!s && !!s.boulders && s.boulders.length > 0 && s.boulders.indexOf(sq) >= 0); }
  function isHole(cfg, sq) { var t = cfg.terrain; return !!t && !!t.holes && t.holes.indexOf(sq) >= 0; }
  function isWater(cfg, sq) { var t = cfg.terrain; return !!t && !!t.water && t.water.indexOf(sq) >= 0; }

  /* Walks the atoms of a fairy piece. onEmpty(to, jump) is told about every empty square it could
     move to and returns false to stop the line; onPiece(to, jump) about the first piece met. mode
     filters: 'moves' skips capture-only atoms when looking at empty squares and move-only atoms when
     looking at pieces; 'attacks' only follows atoms that can capture. */
  /* The Ouroboros King's relics that give units more moves (powers .ou of their side): the Premium horseshoes and the
     Royal sceptre a king's step, the Tabi boots two squares, the Extra wheel one more sideways, the White flag a step
     straight back, the Immaterial vestments diagonals through anything, the Holy grail a bounce off the edge. */
  var OU_ADD = null;
  function ouAtoms(ou, t) {
    if (!ou._atoms) Object.defineProperty(ou, '_atoms', { value: {}, enumerable: false });
    if (ou._atoms[t]) return ou._atoms[t];
    if (!OU_ADD) OU_ADD = { kstep: [ride(KG, 1)], two: [ride(KG, 2)], wheel: [ride(HORZ, 3)], back: [ride(BACK, 1, { mode: 'm', fwd: true })], thru: [ride(DIAG, 0, { thru: true })],
      grailO: [ride(FWD_DIAG, 0, { fwd: true, bounce: true }), ride(BACK, 0, { fwd: true, bounce: true })], grailN: [ride(VERT, 0, { bounce: true }), ride(DIAG, 0, { bounce: true })] };
    var out = [];
    if ((ou.horseshoes && 'nκћђ'.indexOf(t) >= 0) || (ou.sceptre && 'φχψω'.indexOf(t) >= 0)) out = out.concat(OU_ADD.kstep);
    if (ou.tabi && 'зщ'.indexOf(t) >= 0) out = out.concat(OU_ADD.two);
    if (ou.wheel && t === 'x') out = out.concat(OU_ADD.wheel);
    if (ou.vestments && 'bθћ'.indexOf(t) >= 0) out = out.concat(OU_ADD.thru);
    if (ou.grail && t === 'o') out = out.concat(OU_ADD.grailO);
    if (ou.grail && t === 'ν') out = out.concat(OU_ADD.grailN);
    if (ou.whiteflag && t !== 'k' && t !== 'p' && !(FAIRY[t] && FAIRY[t].royal)) out = out.concat(OU_ADD.back);
    ou._atoms[t] = out;
    return out;
  }
  function walkFairy(s, cfg, sq, c, forAttack, onEmpty, onPiece, onWall) {
    use(s);
    var b = s.board, r = ROW[sq], f = COL[sq], i, j, k, d, rr, ff, to, p, atom, tt = typeOf(b[sq]), ouW = powersOf(cfg, c).ou;
    // a bottle (an item): this turn every unit of the side moves like a bishop, knight or rook
    var atoms = s.bottle && s.turn === c && !isRoyal(b[sq]) && STD_ATOMS[s.bottle] ? STD_ATOMS[s.bottle] : DEF[b[sq]] ? atomsFor(s, sq) : (STD_ATOMS[tt] || []);
    if (ouW && !(s.bottle && s.turn === c)) { var extra = ouAtoms(ouW, tt); if (extra.length) atoms = atoms.concat(extra); }
    var glide = !!s.glide && s.turn === c && !forAttack; // the Hang glider: over boulders and bombs, this move
    var axe = !!ouW && !!ouW.axe && (tt === 's' || tt === 't'); // the Battle axe: vikings walk through anything
    var ghostP = isG(s, sq); // a ghost slides through its own pieces
    var mirror = c === 'b';
    // Black sees forward-bound atoms mirrored (rot: turned round). Worked out once per atom and kept on it.
    function dirs(list, fwd, rot) {
      if (!(fwd || rot) || !mirror) return list;
      var key = rot ? '_rot' : '_fwd';
      if (!list[key]) { var out = []; for (var q = 0; q < list.length; q++) out.push([-list[q][0], rot ? -list[q][1] : list[q][1]]); Object.defineProperty(list, key, { value: out }); }
      return list[key];
    }
    var shooter = !!(DEF[b[sq]] && DEF[b[sq]].shoot) || isS(s, sq) || !!powersOf(cfg, colorOf(b[sq])).sniperAll; // its captures are shots: they fly over water
    function slideFrom(r0, f0, list, max, min, jump, mode, hop, thru, bounce) {
      var a, n, dd, dr, df, sr, sf, sq2, q, mark = jump || hop || thru, wet, bounced;
      for (a = 0; a < list.length; a++) {
        dd = list[a]; dr = dd[0]; df = dd[1]; sr = r0 + dr; sf = f0 + df; wet = false; bounced = !bounce;
        for (n = 1; !max || n <= max; n++) {
          if (!inside(sr, sf)) {
            // the Holy grail: once off the edge of the board and back the other way
            if (bounced) break;
            bounced = true;
            var pr = sr - dr, pf = sf - df;
            if (sr < 0 || sr >= H) dr = -dr;
            if (sf < 0 || sf >= W) df = -df;
            sr = pr + dr; sf = pf + df;
            if (!inside(sr, sf)) break;
          }
          sq2 = sr * W + sf;
          if (isWall(cfg, sq2, s)) {
            if (glide || thru) { sr += dr; sf += df; continue; } // flies over it, or passes through it
            if (onWall && n >= min && mode !== 'm' && !wet) onWall(sq2);
            break;
          }
          q = b[sq2];
          if (wet) {
            // past water only a shot goes on: the first piece is its target, empty squares are only threatened
            if (q) { if (n >= min && sq2 !== sq) onPiece(sq2, mark, true); break; }
            if (forAttack && n >= min) onEmpty(sq2, mark);
            sr += dr; sf += df;
            continue;
          }
          if (sq2 === sq) { if (!jump && !thru && !bounce) break; sr += dr; sf += df; continue; }
          if (q) {
            if (n >= min && mode !== 'm') onPiece(sq2, mark);
            if (ghostP && !jump && colorOf(q) === c) { sr += dr; sf += df; continue; }
            if (!jump && !thru) break;
          } else if (n >= min) {
            if (forAttack ? mode !== 'm' : mode !== 'c') { if (onEmpty(sq2, mark) === false) break; }
            if (!jump && !thru && isWater(cfg, sq2)) { if (shooter && mode !== 'm') wet = true; else break; }
          } else if (!jump && !thru && isWater(cfg, sq2)) { if (shooter && mode !== 'm') wet = true; else break; }
          sr += dr; sf += df;
        }
      }
    }
    for (k = 0; k < atoms.length; k++) {
      atom = atoms[k];
      if (forAttack && atom.mode === 'm') continue;
      if (atom.k === 'ride') slideFrom(r, f, dirs(atom.d, atom.fwd), atom.max, atom.min, atom.jump, atom.mode, atom.hop, atom.thru, atom.bounce);
      else if (atom.k === 'edge') {
        // along the rim, round the corners, until something is in the way; water is entered and ends the run
        rimRun(sq, function (to) {
          if (isWall(cfg, to, s)) { if (onWall) onWall(to); return false; }
          if (b[to]) { onPiece(to, false); return false; }
          onEmpty(to, false);
          return !isWater(cfg, to);
        });
      } else if (atom.k === 'any') {
        if (!forAttack) for (i = 0; i < N; i++) if (!b[i] && !isWall(cfg, i, s)) onEmpty(i, true);
      } else if (atom.k === 'reap') {
        var shade = (r + f) & 1;
        for (i = 0; i < N; i++) {
          p = b[i];
          if (!p || i === sq || colorOf(p) === c || isRoyal(p) || (DEF[p] && DEF[p].witch) || ((ROW[i] + COL[i]) & 1) !== shade) continue;
          onPiece(i, true);
        }
      } else if (atom.k === 'leap') {
        var ld = dirs(atom.d, atom.fwd, atom.rot);
        for (i = 0; i < ld.length; i++) {
          rr = r + ld[i][0]; ff = f + ld[i][1];
          if (!inside(rr, ff)) continue;
          to = rr * W + ff;
          if (isWall(cfg, to, s)) { if (onWall && atom.mode !== 'm' && !glide) onWall(to); continue; }
          if (b[to]) { if (atom.mode !== 'm') onPiece(to, true); }
          else if (forAttack ? atom.mode !== 'm' : atom.mode !== 'c') onEmpty(to, true);
        }
      } else if (atom.k === 'walk') {
        var seen = {}, front = [sq], next, n;
        seen[sq] = true;
        for (n = 0; n < atom.n && front.length; n++) {
          next = [];
          for (i = 0; i < front.length; i++) {
            var from = front[i], fr = ROW[from], fc = COL[from];
            for (j = 0; j < 4; j++) {
              rr = fr + ORTH[j][0]; ff = fc + ORTH[j][1];
              if (!inside(rr, ff)) continue;
              to = rr * W + ff;
              if (seen[to]) continue;
              if (isWall(cfg, to, s)) { seen[to] = true; if (axe || glide) next.push(to); else if (onWall) onWall(to); continue; }
              seen[to] = true;
              if (b[to]) { onPiece(to, false); if (axe) next.push(to); }
              else { onEmpty(to, false); if (!isWater(cfg, to) || axe) next.push(to); }
            }
          }
          front = next;
        }
      } else if (atom.k === 'hopcap') {
        var hd = dirs(atom.d, atom.fwd);
        for (i = 0; i < hd.length; i++) {
          var mr = r + hd[i][0], mf = f + hd[i][1], lr2 = r + 2 * hd[i][0], lf2 = f + 2 * hd[i][1];
          if (!inside(mr, mf) || !inside(lr2, lf2)) continue;
          var mid = mr * W + mf, lnd = lr2 * W + lf2;
          if (!b[mid] || b[lnd] || isWall(cfg, lnd, s) || isWall(cfg, mid, s)) continue;
          onPiece(mid, true, false, lnd);
        }
      } else if (atom.k === 'two') {
        var fd = atom.first;
        for (i = 0; i < fd.length; i++) {
          rr = r + fd[i][0]; ff = f + fd[i][1];
          if (!inside(rr, ff)) continue;
          to = rr * W + ff;
          if (isWall(cfg, to, s)) continue;
          if (b[to]) { onPiece(to, atom.hop); continue; }
          onEmpty(to, atom.hop);
          if (isWater(cfg, to)) continue;
          slideFrom(rr, ff, atom.then, atom.max, 1, false, 'mc', false);
        }
      }
    }
  }
  // Squares a fairy piece on sq attacks (empty squares along its lines included).
  function fairyAttacks(s, cfg, sq) {
    use(s);
    var out = [];
    walkFairy(s, cfg, sq, colorOf(s.board[sq]), true, function (to) { out.push(to); }, function (to) { out.push(to); });
    return out;
  }

  function fromFen(fen, cfg) {
    cfg = cfg || NO_POWERS;
    var parts = String(fen).trim().split(/\s+/);
    var rows = parts[0].split('/');
    // any size up to 26 x 26: the number of ranks gives the height, the first rank the width
    if (rows.length < 1 || rows.length > MAXW) throw new Error('A board has 1 to 26 ranks');
    var board = [], width = -1;
    for (var r = 0; r < rows.length; r++) {
      var n = 0, row = rows[r];
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (/[0-9]/.test(ch)) {
          var num = ch;
          while (i + 1 < row.length && /[0-9]/.test(row[i + 1])) num += row[++i]; // 10, 12, 26 empty squares
          for (var k = 0; k < +num; k++) { board.push(''); n++; }
        } else if (/[pnbrqkPNBRQK]/.test(ch) || FAIRY.hasOwnProperty(ch.toLowerCase())) { board.push(ch); n++; }
        else throw new Error('Bad FEN character: ' + ch);
      }
      if (width < 0) width = n;
      if (n !== width || n < 1 || n > MAXW) throw new Error('Rank ' + (rows.length - r) + ' does not have ' + (width > 0 ? width : 'the same number of') + ' squares');
    }
    setGeo(width, rows.length);
    var turn = parts[1] === 'b' ? 'b' : 'w';
    var s = {
      board: board, turn: turn,
      castling: (parts[2] && parts[2] !== '-') ? parts[2].replace(/[^KQkq]/g, '') : '',
      ep: (parts[3] && parts[3] !== '-' && /^[a-z][0-9]+$/.test(parts[3])) ? sqIndex(parts[3]) : -1, W: W, H: H,
      half: parseInt(parts[4], 10) || 0,
      full: parseInt(parts[5], 10) || 1,
      gold: [], pocket: [], pocket2: [], portals: cfg.terrain && cfg.terrain.portals && cfg.terrain.portals.length === 2 ? cfg.terrain.portals.slice() : [],
      movesLeft: has(cfg, turn) ? (powersOf(cfg, turn).double || 1) : 0,
      midasUsed: 0, ice: [], freezeUsed: false, stopUsed: '', turned: '', dice: null, roll: 0, fx: null,
      guard: [], shieldUsed: false, passed: '', // Shield: the pieces shielded and whether this turn's shield is used; Tempo: one letter per pass
      again: -1, lastW: '', lastB: '', rocks: [],
      ghosts: cfg.traits && cfg.traits.ghosts ? cfg.traits.ghosts.filter(function (q) { return !!board[q]; }) : [],
      snipers: cfg.traits && cfg.traits.snipers ? cfg.traits.snipers.filter(function (q) { return !!board[q]; }) : [],
      reborn: [], // fire chicks and phoenixes that already came back once: they stay down the next time
      againHop: false, checkers: !!cfg.checkers, // the game of Checkers: no king, a jump chain goes on
      // ducks: where they stand, how many yellow ones still wait to be put on the board (Duck Chess), the duck part of a turn
      ducks: duckList(cfg, 'ducks', board), bducks: duckList(cfg, 'bducks', board), duckHand: 0, duckPhase: 0, dTodo: [], dBan: [], bMoved: [],
      sleep: [], fresh: [] // devils that spawned (square * 4 + rounds left), demons spawned this turn (they wait a turn)
    };
    if (cfg.duckChess && !s.ducks.length) s.duckHand = 1; // the duck comes onto the board after White's first move
    // The Ouroboros King: bombs on the board, boulders put there later, the items of a turn, the turns counted for the
    // Cursed staff; the Marching boots give the first turn of a battle two moves
    s.bombs = cfg.terrain && cfg.terrain.bombs ? cfg.terrain.bombs.filter(function (q) { return !board[q]; }) : [];
    s.boulders = []; s.ouTurns = 0; s.ouLock = -1; s.bottle = ''; s.knife = false; s.boomer = false; s.glide = false;
    var ou0 = powersOf(cfg, turn).ou, ou1 = powersOf(cfg, other(turn)).ou;
    if (ou0) { if (ou0.cursed) s.ouTurns = 1; if (ou0.boots) s.movesLeft = Math.max(s.movesLeft, 2); } // the turns of the side with the staff only (the enemy may have relics too)
    // the other side moves first (the enemy's Camouflage): the Marching boots wait for that side's first turn
    s.ouBoots = ou1 && ou1.boots ? other(turn) : '';
    s.ouDone = ''; s.ouSafe = ''; // the relics used up in the battle (Spiked shield, Bodyguard horn), the Magic tiara's turn
    s.helmets = cfg.traits && cfg.traits.helmets ? cfg.traits.helmets.filter(function (q) { return !!board[q] && !isRoyal(board[q]); }) : [];
    s.vests = cfg.traits && cfg.traits.vests ? cfg.traits.vests.filter(function (q) { return !!board[q] && !isRoyal(board[q]); }) : [];
    ['w', 'b'].forEach(function (c) { // the army-wide ones: the power-up puts them on at the start
      var pc = powersOf(cfg, c);
      if (pc.helmet) armyUp(s.helmets, board, c, +pc.helmet, false); // the old levels (1 chess pieces, 2 all but pawns, 3 all)
      if (pc.vest) armyUp(s.vests, board, c, +pc.vest, false);
      // by kind, as the Sniper power-ups: pawns to queens, every piece, every piece but the pawns (never a king)
      ['helmet', 'vest'].forEach(function (w) {
        var list = w === 'helmet' ? s.helmets : s.vests;
        if (pc[w + 'All']) armyUp(list, board, c, 3, false);
        else if (pc[w + 'NP']) armyUp(list, board, c, 2, false);
        'PNBRQ'.split('').forEach(function (k) {
          if (!pc[w + k]) return;
          for (var q = 0; q < board.length; q++) if (board[q] && colorOf(board[q]) === c && !DEF[board[q]] && typeOf(board[q]) === k.toLowerCase() && list.indexOf(q) < 0) list.push(q);
        });
      });
      if (pc.sniperNP) armyUp(s.snipers, board, c, 2, true);
      if (pc.ghostAll || pc.ghostNP) armyUp(s.ghosts, board, c, pc.ghostAll ? 3 : 2, true);
    });
    if (hasFairy(board) & 256) {
      // a Shotgun King: its gun (shells loaded, shells in reserve), the damage pieces have taken, the luck of the shots
      s.sg = {};
      for (var gi = 0; gi < board.length; gi++) if (board[gi] && DEF[board[gi]] && DEF[board[gi]].shotgun) s.sg[colorOf(board[gi])] = [SG.cap, SG.res];
      s.dmg = {};
      s.seed = (cfg.seed || 20261003) >>> 0;
    }
    s.castling = cleanCastling(s);
    s.fairy = hasFairy(board); // kept on the state: the check detection asks often
    /* A side that starts without a king (or another royal piece) has nothing to be mated: it loses when all of its
       pieces are taken. That lets a checkers board, or any army without a king, be played in a normal game. */
    s.kingless = ['w', 'b'].filter(function (c) { return !hasRoyal(board, c); }).join('');
    if (cfg.dice) {
      s.pool = dicePool(board); // every kind of piece on the board at the start, each as likely to be rolled
      s.rolled = null;
      if (cfg.legacyDice) rollDice(s, cfg);
    }
    return s;
  }

  // Drop castling rights the position cannot support (king or rook not at home).
  function cleanCastling(s) {
    use(s);
    var b = s.board, out = '';
    if (!classic()) return ''; // no castling on any other board
    if (s.castling.indexOf('K') >= 0 && b[60] === 'K' && b[63] === 'R') out += 'K';
    if (s.castling.indexOf('Q') >= 0 && b[60] === 'K' && b[56] === 'R') out += 'Q';
    if (s.castling.indexOf('k') >= 0 && b[4] === 'k' && b[7] === 'r') out += 'k';
    if (s.castling.indexOf('q') >= 0 && b[4] === 'k' && b[0] === 'r') out += 'q';
    return out;
  }

  // w = the board's width (the one in use if left out)
  function boardFen(board, w) {
    w = w || W;
    var out = '', h = board.length / w;
    for (var r = 0; r < h; r++) {
      var empty = 0;
      for (var f = 0; f < w; f++) {
        var p = board[r * w + f];
        if (!p) empty++;
        else { if (empty) { out += empty; empty = 0; } out += p; }
      }
      if (empty) out += empty;
      if (r < h - 1) out += '/';
    }
    return out;
  }

  function toFen(s) {
    use(s);
    return boardFen(s.board) + ' ' + s.turn + ' ' + (s.castling || '-') + ' ' +
      (s.ep >= 0 ? sqName(s.ep) : '-') + ' ' + s.half + ' ' + s.full;
  }

  function kingSq(s, c) { return s.board.indexOf(c === 'w' ? 'K' : 'k'); }
  /* Does side c still have its royal piece? Usually the king, but an army may lead with an upgraded king
     instead (a mounted king or a general, see FAIRY). A royal piece lost in a blast counts as gone. */
  // Does the piece on sq give the check side c is in? Without it, c would no longer be in check.
  function givesCheck(s, sq, c, cfg) {
    var t = {};
    for (var k in s) t[k] = s[k];
    t.board = s.board.slice(); t.board[sq] = '';
    var r = !inCheck(t, c, cfg);
    use(s);
    return r;
  }

  /* ---------- the royal shotgun ----------
     Pellets fly from the centre of the shooter's square at random angles inside the fire arc around the aim, each
     for a random distance between rmin and rmax squares, and hit the first enemy piece they meet (pierce: a chance
     to fly on). Shared by the Shotgun King piece here and the Shotgun King game mode (shotgun.js). */
  var SG = { cap: 2, res: 6, fp: 4, arc: 55, rmin: 3, rmax: 5, regen: 1 }; // Solomon, the base royal shotgun
  var HP = { p: 3, n: 3, b: 4, r: 5, q: 5, k: 8 };
  function hpOf(p) {
    var t = typeOf(p);
    if (HP[t]) return HP[t];
    var d = DEF[p];
    if (!d) return 3;
    if (d.shotgun || d.royal) return 8;
    return Math.max(2, Math.min(8, Math.round(d.value / 130)));
  }
  function mulberry(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /* o = { from, to, n, arc (degrees), rmin, rmax, pierce, rng, stop(sq) -> true where a pellet ends (a boulder),
     hit(sq) -> true for a piece it hits }. Gives { paths: [{ a, len, hit }], hits: { sq: count } } on the current
     board geometry (use() it first). */
  function pellets(o) {
    var x0 = COL[o.from] + 0.5, y0 = ROW[o.from] + 0.5, base = Math.atan2(ROW[o.to] + 0.5 - y0, COL[o.to] + 0.5 - x0);
    var out = { paths: [], hits: {} }, arc = (o.arc || 0) * Math.PI / 180, step = 0.05;
    for (var i = 0; i < o.n; i++) {
      var wide = o.wide && i < o.wide ? 2 : 1; // a pellet with double the arc
      var a = base + (o.rng() - 0.5) * arc * wide, d = o.rmin + o.rng() * (o.rmax - o.rmin), cx = Math.cos(a), cy = Math.sin(a), cell = o.from, t = step, hit = -1, len = d;
      for (; t <= d; t += step) {
        var x = x0 + cx * t, y = y0 + cy * t;
        if (x < 0 || y < 0 || x >= W || y >= H) { len = t; break; }
        var sq = Math.floor(y) * W + Math.floor(x);
        if (sq === cell) continue;
        cell = sq;
        if (o.stop && o.stop(sq)) { len = t; break; }
        if (o.hit(sq)) {
          out.hits[sq] = (out.hits[sq] || 0) + 1;
          hit = sq;
          if (!(o.pierce && o.rng() < o.pierce)) { len = t; break; }
        }
      }
      out.paths.push({ a: a, len: Math.min(len, d), hit: hit });
    }
    return out;
  }
  // The result of a Shotgun King's shot: real luck from the state's seed, or (cfg.sgExpect, for a search) the average
  function shotResult(s, m, cfg) {
    var c = colorOf(s.board[m.from]);
    var o = { from: m.from, to: m.to, n: SG.fp, arc: SG.arc, rmin: SG.rmin, rmax: SG.rmax,
      stop: function (q) { return isRock(cfg, q, s) || duckAt(s, q); },
      hit: function (q) { var p = s.board[q]; return !!p && colorOf(p) !== c && !(s.gold.length && s.gold.indexOf(q) >= 0); } };
    if (cfg.sgExpect) {
      var acc = {}, T = 24;
      o.rng = mulberry(m.from * 977 + m.to * 31 + 7);
      for (var k = 0; k < T; k++) { var r = pellets(o); for (var q in r.hits) acc[q] = (acc[q] || 0) + r.hits[q] / T; }
      return { hits: acc, paths: [], seed: s.seed };
    }
    var seed = s.seed >>> 0, rnd = mulberry(seed), res;
    o.rng = rnd;
    res = pellets(o);
    res.seed = (Math.imul(seed ^ 0x9E3779B9, 2654435761) + 12345) >>> 0;
    return res;
  }
  function duckList(cfg, key, board) {
    var t = cfg.terrain, l = t && t[key] ? t[key] : [];
    return l.filter(function (q, i) { return q >= 0 && q < board.length && !board[q] && l.indexOf(q) === i; });
  }
  function hasRoyal(board, c) {
    for (var i = 0; i < board.length; i++) { var p = board[i]; if (p && colorOf(p) === c && (typeOf(p) === 'k' || (DEF[p] && DEF[p].royal))) return true; }
    return false;
  }
  // a side without a king that has no piece left: it has lost
  function wiped(s, c) {
    if (!s.kingless || s.kingless.indexOf(c) < 0) return false;
    for (var i = 0; i < s.board.length; i++) if (s.board[i] && colorOf(s.board[i]) === c) return false;
    return true;
  }
  function royalAlive(s, c) {
    use(s);
    if (s.lost && s.lost.indexOf(c) >= 0) return false;
    if (s.checkers) return true; // the game of Checkers has no king to lose
    if (s.kingless && s.kingless.indexOf(c) >= 0) return true; // no king from the start: it has none to lose
    if (s.board.indexOf(c === 'w' ? 'K' : 'k') >= 0) return true;
    if (!(s.fairy & 16)) return false;
    for (var i = 0; i < N; i++) { var p = s.board[i]; if (p && colorOf(p) === c && DEF[p] && DEF[p].royal) return true; }
    return false;
  }

  // Does color `by` attack square `sq`? Power-ups widen the player's attacks.
  function attacked(s, sq, by, cfg) {
    use(s);
    var b = s.board, r = ROW[sq], f = COL[sq], i, d, rr, ff, p;
    var pb = powersOf(cfg, by), ghost = pb.ghost, terrain = !!cfg.terrain;
    var fb = s.fairy === undefined ? hasFairy(b) : s.fairy, stone = (fb & 2) !== 0;
    if ((fb & 64) && demonHits(s, cfg, sq, by)) return true; // a demon of `by` steps onto this square next
    /* a piece turned to stone by a gorgon threatens nothing, and neither does a gold statue or a frozen piece:
       neither gives check (a frozen piece cannot move on its next turn, so it could not take the king) */
    var gold = s.gold && s.gold.length ? s.gold : null, ice = s.ice && s.ice.length ? s.ice : null;
    var ok = function (at) { return (!gold || gold.indexOf(at) < 0) && (!ice || ice.indexOf(at) < 0) && (!stone || !stiff(s, at)); };
    if (fb) {
      // a fairy piece of that colour that reaches the square. An immortal never threatens anything royal.
      var royalSq = isRoyal(b[sq]);
      for (i = 0; i < N; i++) {
        p = b[i];
        if (!p || colorOf(p) !== by || !DEF[p]) continue;
        if (s.gold.indexOf(i) >= 0 || s.ice.indexOf(i) >= 0) continue;
        if (royalSq && DEF[p].immortal) continue;
        if (!ok(i)) continue;
        if (fairyAttacks(s, cfg, i).indexOf(sq) >= 0) return true;
      }
      if (fb & 4) {
        // the pieces next to a bannerman reach the square like queens
        for (i = 0; i < N; i++) {
          p = b[i];
          if (!p || colorOf(p) !== by || !ability(s, i, 'banner') || s.ice.indexOf(i) >= 0) continue;
          var nb = KG_T_at(i);
          for (var q = 0; q < nb.length; q++) {
            var a = nb[q], ap = b[a];
            if (!ap || colorOf(ap) !== by || s.gold.indexOf(a) >= 0 || s.ice.indexOf(a) >= 0 || !ok(a)) continue;
            if (DEF[ap] && (DEF[ap].again || DEF[ap].martyr)) continue;
            if (queenReach(s, cfg, a, sq)) return true;
          }
        }
      }
    }
    var w = by === 'w';
    var P = w ? 'P' : 'p', KN_ = w ? 'N' : 'n', B = w ? 'B' : 'b', R = w ? 'R' : 'r', Q = w ? 'Q' : 'q', K = w ? 'K' : 'k';
    var pr = w ? r + 1 : r - 1;
    if (pr >= 0 && pr < H) {
      if (f > 0 && b[pr * W + f - 1] === P && ok(pr * W + f - 1)) return true;
      if (f < W - 1 && b[pr * W + f + 1] === P && ok(pr * W + f + 1)) return true;
    }
    for (i = 0; i < 8; i++) {
      rr = r + KN[i][0]; ff = f + KN[i][1];
      if (inside(rr, ff)) {
        p = b[rr * W + ff];
        if ((p === KN_ || (pb.amazon && p === Q)) && ok(rr * W + ff)) return true;
      }
      rr = r + KG[i][0]; ff = f + KG[i][1];
      if (inside(rr, ff) && b[rr * W + ff] === K && ok(rr * W + ff)) return true;
    }
    var ghostB = pb.ghostB, ghostQ = pb.ghostQ, thru, wet;
    // ghosts placed by hand: a line may pass the attacker's own pieces if one of its pieces is such a ghost
    var gt = s.ghosts && s.ghosts.length ? s.ghosts : null, gtAny = false;
    if (gt) for (i = 0; i < gt.length; i++) if (b[gt[i]] && colorOf(b[gt[i]]) === by) { gtAny = true; break; }
    var gh = function (q) { return !!gt && gt.indexOf(q) >= 0; };
    for (i = 0; i < 4; i++) {
      // ghosts look through their own pieces: thru = the line has passed one already
      d = DIAG[i]; rr = r + d[0]; ff = f + d[1]; thru = false; wet = false;
      while (inside(rr, ff)) {
        p = b[rr * W + ff];
        if (terrain && isWall(cfg, rr * W + ff, s)) break;
        if (p && wet) { if (((p === B && (pb.sniper || pb.sniperAll)) || (p === Q && (pb.sniperQ || pb.sniperAll)) || ((p === B || p === Q) && isS(s, rr * W + ff))) && ok(rr * W + ff)) return true; break; } // past water only a shot reaches
        if (p) {
          if (p === B && (!thru || ghostB || gh(rr * W + ff)) && ok(rr * W + ff)) return true;
          if (p === Q && (!thru || ghostQ || gh(rr * W + ff)) && ok(rr * W + ff)) return true;
          if (pb.dragon && p === KN_ && (!thru || gh(rr * W + ff)) && ok(rr * W + ff)) return true;
          if ((ghostB || ghostQ || gtAny) && (p === p.toUpperCase()) === w) thru = true; else break;
        }
        if (terrain && isWater(cfg, rr * W + ff)) { if (thru) break; wet = true; } // a move stops in water, a shot flies on
        rr += d[0]; ff += d[1];
      }
      d = ORTH[i]; rr = r + d[0]; ff = f + d[1]; thru = false; wet = false;
      while (inside(rr, ff)) {
        p = b[rr * W + ff];
        if (terrain && isWall(cfg, rr * W + ff, s)) break;
        if (p && wet) { if (((p === R && (pb.sniperR || pb.sniperAll)) || (p === Q && (pb.sniperQ || pb.sniperAll)) || ((p === R || p === Q) && isS(s, rr * W + ff))) && ok(rr * W + ff)) return true; break; }
        if (p) {
          if (p === R && (!thru || ghost || gh(rr * W + ff)) && ok(rr * W + ff)) return true;
          if (p === Q && (!thru || ghostQ || gh(rr * W + ff)) && ok(rr * W + ff)) return true;
          if ((ghost || ghostQ || gtAny) && (p === p.toUpperCase()) === w) thru = true; else break;
        }
        if (terrain && isWater(cfg, rr * W + ff)) { if (thru) break; wet = true; }
        rr += d[0]; ff += d[1];
      }
    }
    return false;
  }

  /* Check. With king capture (cfg.kingCapture) there is none: a king may stand where it can be taken, and
     taking it wins. Otherwise a royal piece is in check when something attacks it. */
  function inCheck(s, c, cfg) {
    use(s);
    if (cfg && cfg.kingCapture) return false;
    return checkedSquares(s, c, cfg).length > 0;
  }
  // The royal squares of c in danger right now: in check, or (with king capture) simply attacked.
  function checkedSquares(s, c, cfg) {
    use(s);
    var rs = royalSquares(s, c), foe = other(c), out = [];
    for (var i = 0; i < rs.length; i++) if (attacked(s, rs[i], foe, cfg) && !guarded(s, rs[i], c)) out.push(rs[i]);
    // a king may not stand where its own side's demon steps next either: it would take it at the end of the turn
    if (s.fairy & 64) for (i = 0; i < rs.length; i++) if (out.indexOf(rs[i]) < 0 && demonHits(s, cfg, rs[i], c)) out.push(rs[i]);
    // (No 'double attack' any more: a capture that checks ends the turn, so an assassin can never take and then reach the king.)
    return out;
  }
  // Does the piece on `from` reach `to` along a queen line, with boulders and water in the way?
  function queenReach(s, cfg, from, to) {
    use(s);
    var dr = ROW[to] - ROW[from], df = COL[to] - COL[from];
    if (!dr && !df) return false;
    if (dr && df && Math.abs(dr) !== Math.abs(df)) return false;
    var sr = dr > 0 ? 1 : dr < 0 ? -1 : 0, sf = df > 0 ? 1 : df < 0 ? -1 : 0;
    var r = ROW[from] + sr, f = COL[from] + sf;
    while (inside(r, f)) {
      var sq = r * W + f;
      if (sq === to) return true;
      if (s.board[sq] || isWall(cfg, sq, s) || isWater(cfg, sq)) return false;
      r += sr; f += sf;
    }
    return false;
  }
  function KG_T_at(sq) { return KG_T[sq]; }

  // Stockfish rejects armies a real game could not produce: more than 8 pawns,
  // or more extra pieces than there are missing pawns. Returns the free slots.
  function armyRoom(board, c) {
    var n = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
    for (var i = 0; i < board.length; i++) { var p = board[i]; if (p && colorOf(p) === c) n[typeOf(p)]++; }
    var extras = Math.max(0, n.n - 2) + Math.max(0, n.b - 2) + Math.max(0, n.r - 2) + Math.max(0, n.q - 1);
    return { counts: n, room: 8 - n.p - extras };
  }
  function canDrop(army, t) {
    if (t === 'p') return army.room >= 1;
    return army.counts[t] < (t === 'q' ? 1 : 2) || army.room >= 1;
  }

  /* Which pawns move in a Pawn Storm, front ranks first so whole columns can follow. Nobody steps onto
     the last rank. fixed = squares whose pieces cannot move (statues and frozen pawns), they stay and block. */
  function stormSteps(board, c, fixed) {
    var b = board.slice(), P = c === 'w' ? 'P' : 'p', dir = c === 'w' ? -W : W, order = [], out = [], i;
    for (i = 0; i < N; i++) if (b[i] === P && !(fixed && fixed.indexOf(i) >= 0)) order.push(i);
    if (c === 'b') order.reverse();
    for (i = 0; i < order.length; i++) {
      var t = order[i] + dir, row = ROW[t];
      if (t >= 0 && t < N && !b[t] && row !== 0 && row !== H - 1) { b[t] = P; b[order[i]] = ''; out.push([order[i], t]); }
    }
    return out;
  }

  // noisy = only captures and promotions, which is all a search needs to settle a position.
  function pseudoMoves(s, cfg, noisy) {
    use(s);
    var b = s.board, c = s.turn, pw = powersOf(cfg, c), out = [];
    var gold = s.gold, hasGold = gold.length > 0, ice = s.ice, hasIce = ice.length > 0;
    var w = c === 'w', foe = other(c), fp = powersOf(cfg, foe);
    var foeKing = fp.bodyguard ? b.indexOf(w ? 'k' : 'K') : -1;
    var fairy = s.fairy, stone = (fairy & 2) !== 0, again = s.again >= 0 ? s.again : -1;
    // a sniper: camo placed by hand on that piece, or Snipers for all pieces (every kind, fairy ones too)
    if (s.duckPhase) return noisy ? [] : duckMoves(s, cfg); // after the move: the ducks
    var allS = !!pw.sniperAll;
    // The Ouroboros King: relics of this side (pw.ou), and items of this turn (a bottle, the Hang glider, the knife)
    var ouSide = !!pw.ou || !!s.bottle || !!s.glide || !!s.knife, feather = !!pw.ou && !!pw.ou.feather, wreck = !!pw.ou && !!pw.ou.wrecking;
    function camoAt(q) { return (allS && !(hasGold && gold.indexOf(q) >= 0)) || isS(s, q); } // a statue shoots nothing

    // May the piece on `from` capture what stands on `sq`?
    var kc = !!cfg.kingCapture;
    function canCap(sq, from, shot) { // shot: taking it from a distance (a sniper), which a decoy cannot punish
      var p = b[sq];
      if (!p) return false;
      if (colorOf(p) === c) return !!s.knife && sq !== from && !isRoyal(p) && !(hasGold && gold.indexOf(sq) >= 0); // the Backstabbing knife: your own units, this turn
      if (isRoyal(p)) {
        // with king capture the king can simply be taken: not by an immortal, and not while a prince guards it
        if (!kc) return false;
        if (from >= 0 && FAIRY.hasOwnProperty(typeOf(b[from])) && FAIRY[typeOf(b[from])].immortal) return false;
        if (from >= 0 && DEF[b[from]] && DEF[b[from]].witch && powersOf(cfg, colorOf(p)).firegem) return false; // the Fire gem (The Ouroboros King): no witch takes this king
        if (guarded(s, sq, colorOf(p))) return false;
        return !(hasGold && gold.indexOf(sq) >= 0);
      }
      var t = typeOf(p);
      if (t === 'д' && fp.ou && fp.ou.heavyarmor) return false;       // the Heavy armor: a marching pawn cannot be taken until it changes
      if (fp.immortal && t === 'q') return false;                    // Immortal Queen
      if (fp.iron && t === 'p' && typeOf(b[from]) !== 'p') return false; // Iron Pawns fall to pawns only
      if (foeKing >= 0 && near(foeKing, sq)) return false;           // Bodyguard
      if (hasGold && gold.indexOf(sq) >= 0) return false;
      if (s.guard && s.guard.length && s.guard.indexOf(sq) >= 0) return false; // Shield
      if (fairy && FAIRY.hasOwnProperty(t)) {
        var fd = FAIRY[t];
        if (fd.immortal && !isRoyal(b[from])) return false;            // only a king takes an immortal
        if (fd.decoy && !shot && from >= 0 && isRoyal(b[from])) return false; // a king would be taken with the decoy, unless it shoots
      }
      return true;
    }
    function push(from, to, extra) {
      if (noisy && !b[to] && !(extra && (extra.promo || extra.cap))) return;
      var m = { from: from, to: to, piece: b[from], cap: '', capSq: -1 };
      if (b[to]) { m.cap = b[to]; m.capSq = to; }
      if (extra) for (var k in extra) m[k] = extra[k];
      out.push(m);
    }
    var terrain = !!cfg.terrain;
    function step(from, r, f, offs, snipe, jump) {
      for (var i = 0; i < offs.length; i++) {
        var rr = r + offs[i][0], ff = f + offs[i][1];
        if (!inside(rr, ff)) continue;
        var to = rr * W + ff;
        if (terrain && isWall(cfg, to, s)) { if (bombAt(s, to)) push(from, to, { bomb: true }); continue; }
        if (!b[to]) push(from, to, jump ? { jump: true } : null);
        else if (canCap(to, from)) { push(from, to, jump ? { jump: true } : null); if (snipe) push(from, to, { snipe: true }); } else if (snipe && canCap(to, from, true)) push(from, to, { snipe: true });
      }
    }
    // A shot flies on over water (a move stops in it): the first piece beyond is a target for the shot only.
    function shootOver(from, rr, ff, d) {
      for (rr += d[0], ff += d[1]; inside(rr, ff); rr += d[0], ff += d[1]) {
        var to = rr * W + ff;
        if (isWall(cfg, to, s)) return;
        if (!b[to]) continue;
        if (canCap(to, from, true)) push(from, to, { snipe: true });
        return;
      }
    }
    function slide(from, r, f, dirs, snipe) {
      for (var i = 0; i < dirs.length; i++) {
        var rr = r + dirs[i][0], ff = f + dirs[i][1];
        while (inside(rr, ff)) {
          var to = rr * W + ff;
          if (terrain && isWall(cfg, to, s)) { if (bombAt(s, to)) push(from, to, { bomb: true }); break; }
          if (!b[to]) { push(from, to); if (terrain && isWater(cfg, to)) { if (snipe) shootOver(from, rr, ff, dirs[i]); break; } }
          else {
            if (canCap(to, from)) { push(from, to); if (snipe) push(from, to, { snipe: true }); } else if (snipe && canCap(to, from, true)) push(from, to, { snipe: true });
            break;
          }
          rr += dirs[i][0]; ff += dirs[i][1];
        }
      }
    }
    // Ghosts: lines that pass through the piece's own pieces.
    function ghostSlide(from, r, f, dirs, snipe) {
      for (var i = 0; i < dirs.length; i++) {
        var rr = r + dirs[i][0], ff = f + dirs[i][1];
        while (inside(rr, ff)) {
          var to = rr * W + ff;
          if (terrain && isWall(cfg, to, s)) break;
          if (!b[to]) { push(from, to); if (terrain && isWater(cfg, to)) { if (snipe) shootOver(from, rr, ff, dirs[i]); break; } }
          else if (colorOf(b[to]) !== c) { if (canCap(to, from)) { push(from, to); if (snipe) push(from, to, { snipe: true }); } else if (snipe && canCap(to, from, true)) push(from, to, { snipe: true }); break; }
          rr += dirs[i][0]; ff += dirs[i][1];
        }
      }
    }
    // Fast Promotion: the pawns of a side with that power-up promote two ranks early.
    var early = pw.earlypromo;
    function promoAt(row) { return w ? row <= (early ? 2 : 0) : row >= (early ? H - 3 : H - 1); }

    for (var sq = 0; sq < N; sq++) {
      var p = b[sq];
      if (!p || colorOf(p) !== c) continue;
      if (again >= 0 && sq !== again) continue; // only the piece that earned another move
      if (s.ouLock >= 0 && sq === s.ouLock) continue; // a second move of the turn (Cursed staff, Marching boots): another unit
      if (hasGold && gold.indexOf(sq) >= 0) continue;
      if (hasIce && ice.indexOf(sq) >= 0) continue;
      if (stone && stiff(s, sq)) continue;      // turned to stone by a gorgon
      var r = ROW[sq], f = COL[sq], t = typeOf(p);
      if (t === 'p') {
        var dir = w ? -1 : 1, startRow = w ? H - 2 : 1; // pawns start on their second rank, whatever the size
        var nr = r + dir;
        if (nr < 0 || nr > H - 1) continue;
        var fwd = nr * W + f;
        if (!b[fwd] && !(terrain && isWall(cfg, fwd, s))) {
          if (promoAt(nr)) pawnPromos(sq, fwd, null);
          else {
            push(sq, fwd);
            var wet = terrain && isWater(cfg, fwd);
            if (pw.rocket && !wet) {
              // Rocket Pawns: keep running while the file is clear.
              for (var pr = nr + dir; pr >= 0 && pr <= H - 1 && !b[pr * W + f] && !(terrain && isWall(cfg, pr * W + f, s)); pr += dir) {
                if (promoAt(pr)) { pawnPromos(sq, pr * W + f, null); break; }
                push(sq, pr * W + f, (r === startRow && pr === nr + dir) ? { dbl: true } : null);
                if (terrain && isWater(cfg, pr * W + f)) break;
              }
            } else if (r === startRow && !wet && !b[fwd + dir * W] && !(terrain && isWall(cfg, fwd + dir * W, s))) push(sq, fwd + dir * W, { dbl: true });
          }
        }
        for (var df = -1; df <= 1; df += 2) {
          var nf = f + df;
          if (nf < 0 || nf > W - 1) continue;
          var to = nr * W + nf;
          if (terrain && isWall(cfg, to, s)) { if (bombAt(s, to)) push(sq, to, { bomb: true }); continue; }
          if (canCap(to, sq)) {
            if (promoAt(nr)) pawnPromos(sq, to, b[to]);
            else push(sq, to);
            if (pw.sniperP || camoAt(sq)) push(sq, to, { snipe: true }); // Sniper Pawns shoot what they could take
          } else if (to === s.ep && !b[to]) {
            var victim = r * W + nf;
            if (b[victim] === (w ? 'p' : 'P') && !(hasGold && gold.indexOf(victim) >= 0) && !(foeKing >= 0 && near(foeKing, victim))) {
              push(sq, to, { ep: true, cap: b[victim], capSq: victim });
            }
          }
        }
      } else if (FAIRY.hasOwnProperty(t) || (ouSide && t !== 'p')) {
        // a fairy piece, or a chess piece of a side whose relics or items change how it moves (it moves by its atoms here)
        var fdef = FAIRY[t] || NO_DEF, live = !(hasGold && gold.indexOf(sq) >= 0), backRank = function (to) { return ROW[to] === 0 || ROW[to] === H - 1; };
        var stamp = ++STAMP; // several atoms can reach the same square (a king step and the rim run): one move each
        walkFairy(s, cfg, sq, c, false,
          function (to, jump) { if (REACHED[to] !== stamp && !(fdef.noBack && backRank(to))) { REACHED[to] = stamp; push(sq, to, jump ? { jump: true } : null); } },
          function (to, jump, wet, land) {
            // a checkers jump: over the piece on `to` onto the empty square `land`, which it takes
            if (land != null) {
              if (canCap(to, sq)) push(sq, land, { cap: b[to], capSq: to, hop: true, jump: true });
              /* A sniper checker shoots what it could jump, and stays: a man with Sniper Pawns (it is a pawn of its
                 own kind), a checkers king with Sniper King, either one with camo. */
              if (live && (camoAt(sq) || (fdef.base === 'P' ? pw.sniperP : fdef.base === 'K' ? pw.sniperK : false)) && canCap(to, sq, true)) push(sq, to, { snipe: true });
              return;
            }
            if (wet) { if (REACHED[to] !== stamp && live && canCap(to, sq, true)) { REACHED[to] = stamp; push(sq, to, { snipe: true }); } return; }
            // the Feather necklace: onto one of your own units, and the two change places
            if (feather && colorOf(b[to]) === c && to !== sq && FEATHER[to] !== stamp && !(hasGold && gold.indexOf(to) >= 0) && !(hasIce && ice.indexOf(to) >= 0)) { FEATHER[to] = stamp; push(sq, to, { ally: true, cap: '', capSq: -1 }); }
            if (REACHED[to] === stamp || !canCap(to, sq) || (fdef.noBack && backRank(to))) return;
            REACHED[to] = stamp;
            if (fdef.shoot && live) push(sq, to, { snipe: true }); // a musketeer takes and returns: a shot
            else { push(sq, to, jump ? { jump: true } : null); if (camoAt(sq)) push(sq, to, { snipe: true }); }
          },
          // a wall met on the way: a bomb is taken (it blows up), a boulder broken with the Wrecking ball
          function (to) {
            if (REACHED[to] === stamp || b[to]) return;
            if (bombAt(s, to)) { REACHED[to] = stamp; push(sq, to, { bomb: true }); }
            else if (wreck && isRock(cfg, to, s)) { REACHED[to] = stamp; push(sq, to, { rock: true }); }
          });
        if (live && fdef.shotgun && !noisy && again < 0 && s.sg && s.sg[c]) {
          // the royal shotgun: shoot at an enemy piece in reach (not while in check), or reload
          var gunc = s.sg[c], checked = gunc[0] > 0 && !cfg.kingCapture && inCheck(s, c, cfg);
          if (gunc[0] > 0) {
            for (var tq = 0; tq < N; tq++) {
              var tp = b[tq];
              if (!tp || colorOf(tp) === c || (hasGold && gold.indexOf(tq) >= 0)) continue;
              // in check: only the piece that gives it, and only if the pellets can kill it (a sure miss is no way out)
              if (checked && (!givesCheck(s, tq, c, cfg) || hpOf(tp) - ((s.dmg && s.dmg[tq]) || 0) > SG.fp + 1e-9)) continue;
              var ddr = ROW[tq] - ROW[sq], ddf = COL[tq] - COL[sq];
              if (ddr * ddr + ddf * ddf <= (SG.rmax + 0.5) * (SG.rmax + 0.5)) out.push(checked ? { from: sq, to: tq, piece: p, cap: '', capSq: -1, shot: true, inCheck: true } : { from: sq, to: tq, piece: p, cap: '', capSq: -1, shot: true });
            }
          }
          if (gunc[0] < SG.cap && gunc[1] > 0) out.push({ from: sq, to: sq, piece: p, cap: '', capSq: -1, reload: true });
        }
        if (live && fdef.spawner && !noisy && !asleep(s, sq) && again < 0) {
          // a devil spawns a demon on an empty square a king's step away
          var sn = KG_T[sq];
          for (var si = 0; si < sn.length; si++) if (!b[sn[si]] && !(terrain && isWall(cfg, sn[si], s)) && !duckAt(s, sn[si])) out.push({ from: sq, to: sn[si], piece: p, cap: '', capSq: -1, spawn: fdef.spawner });
        }
        if (live && fdef.rocks && terrain && !noisy) {
          // an infiltrator breaks a boulder: one next to it, or the first one its run along the rim meets
          var nb = KG_T[sq];
          for (var bi = 0; bi < nb.length; bi++) if (isRock(cfg, nb[bi], s) && !isHole(cfg, nb[bi])) push(sq, nb[bi], { rock: true });
          rimRun(sq, function (to) {
            if (isHole(cfg, to)) return false;
            if (isRock(cfg, to, s)) { if (KG_T[sq].indexOf(to) < 0) push(sq, to, { rock: true }); return false; }
            return !b[to] && !isWater(cfg, to) && !duckAt(s, to);
          });
        }
        if (live && fdef.decoy && !noisy) {
          // a decoy changes places with any of its own pieces
          for (var dq = 0; dq < N; dq++) {
            var dp = b[dq];
            if (dq === sq || !dp || colorOf(dp) !== c || (hasGold && gold.indexOf(dq) >= 0) || (hasIce && ice.indexOf(dq) >= 0)) continue;
            out.push({ from: sq, to: dq, piece: p, cap: '', capSq: -1, swap: true });
          }
        }
      } else if (t === 'n') {
        var shN = pw.archer || camoAt(sq);
        step(sq, r, f, KN, shN, true); // Archer Knights shoot what they attack; knights jump
        if (pw.dragon) { if (isG(s, sq)) ghostSlide(sq, r, f, DIAG, camoAt(sq)); else slide(sq, r, f, DIAG, camoAt(sq)); }
      } else if (t === 'b') {
        var shB = pw.sniper || camoAt(sq);
        if (pw.ghostB || isG(s, sq)) ghostSlide(sq, r, f, DIAG, shB); else slide(sq, r, f, DIAG, shB);
      } else if (t === 'r') {
        var shR = pw.sniperR || camoAt(sq);
        if (pw.ghost || isG(s, sq)) ghostSlide(sq, r, f, ORTH, shR); else slide(sq, r, f, ORTH, shR);
      } else if (t === 'q') {
        var shQ = pw.sniperQ || camoAt(sq);
        if (pw.ghostQ || isG(s, sq)) { ghostSlide(sq, r, f, DIAG, shQ); ghostSlide(sq, r, f, ORTH, shQ); }
        else { slide(sq, r, f, DIAG, shQ); slide(sq, r, f, ORTH, shQ); }
        if (pw.amazon) step(sq, r, f, KN, shQ, true);
      } else if (t === 'k') {
        step(sq, r, f, KG, pw.sniperK || camoAt(sq));
        if (noisy) continue;
        castles(sq);
        if (pw.swap) {
          // Royal Swap: the king changes places with one of its rooks, wherever they stand.
          var rk = w ? 'R' : 'r';
          for (var q = 0; q < N; q++) {
            if (b[q] !== rk || (hasGold && gold.indexOf(q) >= 0) || (hasIce && ice.indexOf(q) >= 0)) continue;
            out.push({ from: sq, to: q, piece: p, cap: '', capSq: -1, swap: true });
          }
        }
      }
    }

    function pawnPromos(from, to, cap) {
      var opts = ['q', 'n', 'r', 'b'];
      for (var i = 0; i < 4; i++) push(from, to, { promo: opts[i] });
    }
    function castles(ksq) {
      if (!classic()) return;
      var home = w ? 60 : 4;
      if (ksq !== home) return;
      var opp = other(c), rook = w ? 'R' : 'r';
      var kRight = w ? 'K' : 'k', qRight = w ? 'Q' : 'q';
      function free(sqs) { for (var i = 0; i < sqs.length; i++) if (b[sqs[i]]) return false; return true; }
      // Drawback Chess (cfg.castleAny): a king may castle out of and through check, it can then be taken en passant
      function safe(sqs) { if (cfg.castleAny) return true; for (var i = 0; i < sqs.length; i++) if (attacked(s, sqs[i], opp, cfg)) return false; return true; }
      function movable(sq) { return !(hasGold && gold.indexOf(sq) >= 0) && !(hasIce && ice.indexOf(sq) >= 0); }
      if (s.castling.indexOf(kRight) >= 0 && b[home + 3] === rook && movable(home + 3) &&
        free([home + 1, home + 2]) && safe([home, home + 1, home + 2])) {
        push(home, home + 2, { castle: 'K' });
      }
      if (s.castling.indexOf(qRight) >= 0 && b[home - 4] === rook && movable(home - 4) &&
        free([home - 1, home - 2, home - 3]) && safe([home, home - 1, home - 2])) {
        push(home, home - 2, { castle: 'Q' });
      }
    }

    // Bannerman: its neighbours may also move like queens (an assassin, blade dancer or martyr may not take that way).
    if (fairy & 4) {
      var have = {}, bq, bn, bi2, bsq, bp, bdef;
      for (bi2 = 0; bi2 < out.length; bi2++) have[(out[bi2].from + 1) * 100 + out[bi2].to + (out[bi2].snipe ? 10000 : 0) + (out[bi2].promo ? 100000 : 0)] = true;
      for (bq = 0; bq < N; bq++) {
        bp = b[bq];
        if (!bp || colorOf(bp) !== c || !ability(s, bq, 'banner') || (hasIce && ice.indexOf(bq) >= 0)) continue;
        bn = KG_T[bq];
        for (bi2 = 0; bi2 < bn.length; bi2++) {
          bsq = bn[bi2]; bp = b[bsq];
          if (!bp || colorOf(bp) !== c || (hasGold && gold.indexOf(bsq) >= 0) || (hasIce && ice.indexOf(bsq) >= 0) || (stone && stiff(s, bsq))) continue;
          if (again >= 0 && bsq !== again) continue;
          bdef = FAIRY[typeOf(bp)];
          var noCap = !!bdef && (bdef.again || bdef.martyr), before = out.length;
          slide(bsq, ROW[bsq], COL[bsq], KG, false);
          for (var bk = before; bk < out.length; bk++) {
            var bm = out[bk], key = (bm.from + 1) * 100 + bm.to;
            if (have[key] || (noCap && bm.cap)) { out.splice(bk, 1); bk--; continue; }
            have[key] = true;
            if (typeOf(bp) === 'p' && ROW[bm.to] === (w ? 0 : H - 1)) { out.splice(bk, 1); bk--; } // a pawn does not reach the last rank this way
          }
        }
      }
    }
    // checkers: in a chain of jumps only further jumps of the same piece; in the game of Checkers taking is a must
    if (s.againHop && again >= 0) out = out.filter(function (m) { return m.hop && m.from === again; });
    if (cfg.checkers) { var takes = out.filter(function (m) { return !!m.cap; }); if (takes.length) out = takes; }
    // Explosive Vest: instead of moving, the piece goes up (not a frozen one, not a statue, not during a bonus move)
    if (s.vests && s.vests.length && again < 0 && !cfg.checkers) {
      for (var vi = 0; vi < s.vests.length; vi++) {
        var vq = s.vests[vi];
        if (b[vq] && colorOf(b[vq]) === c && isV(s, vq) && !(hasIce && ice.indexOf(vq) >= 0)) out.push({ from: vq, to: vq, piece: b[vq], cap: '', capSq: -1, blast: true });
      }
    }
    if (fairy) shogiPromos(out, c);
    if (noisy) return out;
    if (again >= 0) {
      // the bonus move is a plain move of that piece, and it may be left out: staying ends the turn (a chain of
      // jumps in Checkers may not be cut short)
      if (!(cfg.checkers && s.againHop)) out.push({ from: again, to: again, piece: b[again], cap: '', capSq: -1, stay: true });
      return out;
    }
    // Tempo: twice a game, pass (the other side has to move again). Not in check: legalAll sees to that.
    if (pw.tempo && (s.passed || '').split(c).length - 1 < (pw.tempoMax || 2)) out.push({ from: -1, to: -1, piece: '', cap: '', capSq: -1, pass: true });
    // Pawn Storm: every pawn that has room steps forward, all in one move.
    if (pw.storm && stormSteps(b, c, hasGold || hasIce ? gold.concat(ice) : null).length) {
      out.push({ from: -1, to: -1, piece: w ? 'P' : 'p', cap: '', capSq: -1, storm: true });
    }

    // Reinforcements: drop a captured piece on any empty square. Shogi pieces in hand: always, by Shogi's rules
    // (not where they could never move, and no second unpromoted pawn on a file).
    var pocket = s[pocketKey(cfg, c)];
    if (pocket && pocket.length) {
      var seen = {}, army = pw.drops ? armyRoom(b, c) : null;
      for (var i = 0; i < pocket.length; i++) {
        var pt = pocket[i], sh = !!(FAIRY.hasOwnProperty(pt) && FAIRY[pt].shogi);
        if (seen[pt] || (!sh && !pw.drops)) continue;
        seen[pt] = true;
        if (!sh && !cfg.freeArmy && !canDrop(army, pt)) continue;
        var piece = w ? pt.toUpperCase() : pt, files = null;
        if (pt === '\u047d') { files = {}; for (var f = 0; f < N; f++) if (b[f] === piece) files[COL[f]] = true; }
        for (var e = 0; e < N; e++) {
          if (b[e] || (terrain && isWall(cfg, e, s))) continue;
          if (pt === 'p' && (ROW[e] === 0 || ROW[e] === H - 1)) continue;
          if (sh && shogiDead(pt, c, ROW[e])) continue;
          if (files && files[COL[e]]) continue;
          out.push({ from: -1, to: e, piece: piece, cap: '', capSq: -1, drop: pt });
        }
      }
    }
    if (s.bducks && s.bducks.length) blueMoves(s, cfg, out); // a blue duck may move first
    return out;
  }

  /* ---------- ducks ----------
     After its move (all of it: Double Move, a jump chain and the like) the side moves its yellow ducks: every one
     once, each to a square no yellow duck stood on when the duck part of the turn began (so they cannot simply swap
     places); a yellow duck waiting in the hand (Duck Chess) goes onto any free square. A yellow duck that has nowhere
     to go ends the game in a draw. Blue ducks may be moved, each once a turn, at any point of the turn: before the
     move or among the yellow ones. */
  function duckApply(s, m) {
    var n = {};
    for (var k in s) n[k] = s[k];
    n.fx = { removed: [], tp: -1, boom: false, duck: m.duck };
    if (m.duck === 'y') {
      if (m.from < 0) { n.duckHand = s.duckHand - 1; n.ducks = s.ducks.concat([m.to]); }
      else { n.ducks = s.ducks.map(function (q) { return q === m.from ? m.to : q; }); n.dTodo = s.dTodo.filter(function (q) { return q !== m.from; }); }
    } else {
      n.bducks = s.bducks.map(function (q) { return q === m.from ? m.to : q; });
      n.bMoved = (s.bMoved || []).concat([m.to]);
    }
    return n;
  }
  function duckSquares(s, cfg, ban) {
    var out = [], b = s.board;
    for (var i = 0; i < b.length; i++) if (!b[i] && !isWall(cfg, i, s) && !(ban && ban.indexOf(i) >= 0)) out.push(i);
    return out;
  }
  var mkDuck = function (from, to, kind) { return { from: from, to: to, piece: '', cap: '', capSq: -1, duck: kind }; };
  function blueMoves(s, cfg, out) {
    if (!s.bducks || !s.bducks.length) return out;
    var bl = null, moved = s.bMoved || [];
    for (var i = 0; i < s.bducks.length; i++) {
      if (moved.indexOf(s.bducks[i]) >= 0) continue;
      if (!bl) bl = duckSquares(s, cfg, null);
      for (var j = 0; j < bl.length; j++) out.push(mkDuck(s.bducks[i], bl[j], 'b'));
    }
    return out;
  }
  function duckMoves(s, cfg) {
    var out = [], yl = duckSquares(s, cfg, s.dBan), i, j;
    if (s.duckHand > 0) for (j = 0; j < yl.length; j++) out.push(mkDuck(-1, yl[j], 'y'));
    for (i = 0; i < s.dTodo.length; i++) for (j = 0; j < yl.length; j++) out.push(mkDuck(s.dTodo[i], yl[j], 'y'));
    return blueMoves(s, cfg, out);
  }
  // after the move: the duck part of the turn, a state of the same side (null when no yellow duck has to move)
  function duckStart(n, mover) {
    if (!(n.ducks && n.ducks.length) && !(n.duckHand > 0)) return null;
    var t = {};
    for (var k in n) t[k] = n[k];
    t.turn = mover; t.duckPhase = 1; t.dTodo = n.ducks.slice(); t.dBan = n.ducks.slice();
    return t;
  }
  // is a yellow duck still to be moved in this turn?
  function duckDue(s) { return !!s.duckPhase && ((s.dTodo && s.dTodo.length > 0) || s.duckHand > 0); }

  /* ---------- demons and devils ---------- */
  // Where a demon on q steps next: straight forward, through boulders, ducks and statues; -1 when it falls off.
  function demonNext(s, cfg, q) {
    use(s);
    var p = s.board[q], dir = colorOf(p) === 'w' ? -1 : 1, r = ROW[q] + dir, f = COL[q];
    while (r >= 0 && r < H) {
      var sq = r * W + f;
      if (isHole(cfg, sq)) return -1;
      if (isRock(cfg, sq, s) || duckAt(s, sq) || (s.gold.length && s.gold.indexOf(sq) >= 0)) { r += dir; continue; }
      return sq;
    }
    return -1;
  }
  /* The end of a side's turn: its demons step forward (the front ones first, newly spawned ones wait a turn) and
     take what they land on, its devils sleep one round less. */
  function turnOver(n, mover, cfg) {
    if (n.fairy & 64) {
      var b = n.board.slice(), list = [], i, fresh = n.fresh || [];
      for (i = 0; i < b.length; i++) if (b[i] && colorOf(b[i]) === mover && DEF[b[i]] && DEF[b[i]].demon && fresh.indexOf(i) < 0) list.push(i);
      list.sort(function (x, y) { return mover === 'w' ? x - y : y - x; }); // the one furthest ahead goes first
      var moved = [], took = [];
      n.board = b;
      for (i = 0; i < list.length; i++) {
        var q = list[i], dp = b[q], to = demonNext(n, cfg, q);
        b[q] = '';
        if (to < 0) { moved.push({ from: q, to: -1 }); continue; } // over the edge
        if (b[to]) {
          took.push({ sq: to, p: b[to] });
          if (isRoyal(b[to])) { n.lost = (n.lost && n.lost !== colorOf(b[to])) ? 'wb' : colorOf(b[to]); n.lostBy = n.lostBy || 'king'; }
          n.half = 0;
        }
        b[to] = dp;
        moved.push({ from: q, to: to });
      }
      if (moved.length) {
        if (!n.fx) n.fx = { removed: [], tp: -1, boom: false };
        n.fx.demons = moved; n.fx.demonTook = took;
        var gone = took.map(function (x) { return x.sq; }).concat(moved.map(function (x) { return x.from; }));
        var keep = function (l) { return l && l.length ? l.filter(function (q) { return gone.indexOf(q) < 0; }) : l; };
        n.ghosts = keep(n.ghosts); n.snipers = keep(n.snipers); n.reborn = keep(n.reborn); n.helmets = keep(n.helmets); n.vests = keep(n.vests); n.stun = keep(n.stun);
        if (n.ice.length) n.ice = n.ice.filter(function (q) { return gone.indexOf(q) < 0; });
        n.fairy = hasFairy(b);
      }
    }
    n.fresh = [];
    if (n.sleep && n.sleep.length) {
      n.sleep = n.sleep.map(function (x) {
        var q = x >> 2, p = n.board[q];
        if (!p || !DEF[p] || !DEF[p].spawner) return -1; // the devil is gone
        return colorOf(p) === mover ? ((x & 3) > 1 ? q * 4 + (x & 3) - 1 : -1) : x;
      }).filter(function (x) { return x >= 0; });
    }
    return n;
  }
  // does a demon of colour c land on sq at the end of c's next turn?
  function demonHits(s, cfg, sq, c) {
    var b = s.board;
    for (var i = 0; i < b.length; i++) { var p = b[i]; if (p && DEF[p] && DEF[p].demon && colorOf(p) === c && demonNext(s, cfg, i) === sq) return true; }
    return false;
  }
  function asleep(s, sq) { if (!s.sleep || !s.sleep.length) return false; for (var i = 0; i < s.sleep.length; i++) if ((s.sleep[i] >> 2) === sq) return true; return false; }

  // Apply a move without any turn bookkeeping for double moves.
  function applyRaw(s, m, cfg) {
    use(s);
    if (m.duck) return duckApply(s, m);
    var b = s.board.slice(), c = s.turn, pw = powersOf(cfg, c), fp = powersOf(cfg, other(c)), pkey = pocketKey(cfg, c);
    var n = {
      board: b, turn: other(c), castling: s.castling, ep: -1,
      half: s.half + 1, full: s.full + (c === 'b' ? 1 : 0),
      gold: s.gold, pocket: s.pocket, pocket2: s.pocket2, portals: s.portals,
      movesLeft: s.movesLeft, midasUsed: s.midasUsed, ice: s.ice, freezeUsed: s.freezeUsed, stopUsed: s.stopUsed, guard: s.guard || [], shieldUsed: !!s.shieldUsed, passed: s.passed || '',
      turned: s.turned, dice: s.dice, roll: s.roll, fairy: s.fairy, pool: s.pool, rolled: s.rolled, wasted: null,
      again: -1, againHop: false, checkers: !!s.checkers, kingless: s.kingless || '', lastW: s.lastW, lastB: s.lastB, rocks: s.rocks, lost: s.lost || '', lostBy: s.lostBy || '', W: W, H: H,
      ghosts: s.ghosts || [], snipers: s.snipers || [], reborn: s.reborn || [], helmets: s.helmets || [], vests: s.vests || [], stun: s.stun || [],
      ducks: s.ducks || [], bducks: s.bducks || [], duckHand: s.duckHand || 0, duckPhase: 0, dTodo: [], dBan: [], bMoved: s.bMoved || [], sleep: s.sleep || [], fresh: s.fresh || [],
      sg: s.sg, dmg: s.dmg, seed: s.seed,
      bombs: s.bombs || [], boulders: s.boulders || [], ouTurns: s.ouTurns || 0, ouLock: -1, bottle: s.bottle || '', knife: !!s.knife, boomer: false, glide: false,
      ouBoots: s.ouBoots || '', ouDone: s.ouDone || '', ouSafe: s.ouSafe || '',
      fx: { removed: [], tp: -1, boom: false }
    };
    var touched = [], removed = n.fx.removed, i;
    n[c === 'w' ? 'lastW' : 'lastB'] = m.pass ? (c === 'w' ? s.lastW : s.lastB) : m.storm ? 'p' : m.drop ? m.drop : typeOf(m.piece); // what a fool copies next
    var isMartyr = function (q) { var d = DEF[q]; return !!d && !!d.martyr; };

    if (m.pass) {
      n.passed = (s.passed || '') + c; // nothing on the board changes
    } else if (m.storm) {
      stormSteps(b, c, s.gold.length || s.ice.length ? s.gold.concat(s.ice) : null).forEach(function (st) { b[st[1]] = b[st[0]]; b[st[0]] = ''; });
      n.half = 0;
    } else if (m.drop) {
      b[m.to] = m.piece;
      var pk = s[pkey].slice();
      pk.splice(pk.indexOf(m.drop), 1);
      n[pkey] = pk;
      n.half = 0;
    } else if (m.swap || m.ally) { // Royal Swap, or the Feather necklace
      b[m.from] = b[m.to];
      b[m.to] = m.piece;
      touched.push(m.from, m.to);
    } else if (m.shot || m.reload) {
      // the royal shotgun: a shot (no step), or a reload turn that fills the gun from the reserve
      var gun = {}, own = s.sg[c] || [0, 0];
      for (var gk in s.sg) gun[gk] = s.sg[gk];
      if (m.reload) { var fill = Math.min(SG.cap - own[0], own[1]); gun[c] = [own[0] + fill, own[1] - fill]; } // as in the original: the gun is filled from the reserve
      else {
        gun[c] = [own[0] - 1, own[1]];
        var sr = shotResult(s, m, cfg), dm = {};
        for (var dk in s.dmg) dm[dk] = s.dmg[dk];
        n.seed = sr.seed;
        for (var hq in sr.hits) {
          var hs = +hq, hp = b[hs];
          if (!hp || colorOf(hp) === c) continue;
          dm[hs] = (dm[hs] || 0) + sr.hits[hq];
          if (dm[hs] >= hpOf(hp) - 1e-9) {
            if (isRoyal(hp)) { n.lost = (n.lost && n.lost !== colorOf(hp)) ? 'wb' : colorOf(hp); n.lostBy = 'shot'; }
            removed.push({ sq: hs, p: hp }); b[hs] = ''; delete dm[hs]; touched.push(hs); n.half = 0;
          }
        }
        n.dmg = dm;
        n.fx.shot = { from: m.from, to: m.to, paths: sr.paths, hits: sr.hits };
        // a shot in check is a gamble, as in Shotgun King: the attacker it does not kill takes the king
        if (!cfg.kingCapture && !n.lost && m.inCheck) { n.board = b; if (inCheck(n, c, cfg)) { n.lost = c; n.lostBy = 'survived'; } use(s); }
      }
      n.sg = gun;
    } else if (m.blast) {
      // Explosive Vest: the wearer and everything around it, both colours
      var vr = ROW[m.from], vf = COL[m.from], vguard = [fp.bodyguard ? b.indexOf(c === 'w' ? 'k' : 'K') : -1, pw.bodyguard ? b.indexOf(c === 'w' ? 'K' : 'k') : -1];
      for (i = 0; i < N; i++) {
        var vp = b[i];
        if (!vp || Math.abs(ROW[i] - vr) > 1 || Math.abs(COL[i] - vf) > 1) continue;
        if (i !== m.from) {
          var vpw = colorOf(vp) === c ? pw : fp, vg = vguard[colorOf(vp) === c ? 1 : 0];
          if (isRoyal(vp) || s.gold.indexOf(i) >= 0 || near(vg, i) || (vpw.iron && typeOf(vp) === 'p') || (vpw.immortal && typeOf(vp) === 'q') || (s.fairy && isMartyr(vp)) || (s.guard && s.guard.indexOf(i) >= 0)) continue;
          if (isH(n, i)) { n.helmets = n.helmets.filter(function (q) { return q !== i; }); continue; } // the helmet takes the blast
        }
        removed.push({ sq: i, p: vp }); b[i] = ''; touched.push(i);
      }
      n.fx.boom = true; n.fx.blast = m.from; n.half = 0;
      var vgone = {};
      for (i = 0; i < removed.length; i++) vgone[removed[i].sq] = 1;
      var vkeep = function (l) { return l && l.length ? l.filter(function (q) { return !vgone[q]; }) : l; };
      n.ghosts = vkeep(n.ghosts); n.snipers = vkeep(n.snipers); n.reborn = vkeep(n.reborn); n.helmets = vkeep(n.helmets); n.vests = vkeep(n.vests); n.stun = vkeep(n.stun);
    } else if (m.cap && isH(s, m.capSq) && !isRoyal(m.cap)) {
      // Spiked Helmet: the capture bounces off. The helmet breaks, both pieces stay, the move is used.
      n.helmets = s.helmets.filter(function (q) { return q !== m.capSq; });
      n.fx.bounce = m.capSq;
      n.stun = (s.stun || []).concat([m.from]); // the attacker is stunned: frozen on its side's next turn (endOfTurn)
    } else if (m.spawn) {
      // a devil spawns a demon next to it, and sleeps: it may not spawn on its side's next turn
      b[m.to] = c === 'w' ? m.spawn.toUpperCase() : m.spawn;
      n.fresh = (s.fresh || []).concat([m.to]);
      n.sleep = (s.sleep || []).filter(function (x) { return (x >> 2) !== m.from; }).concat([m.from * 4 + 2]);
    } else {
      if (!m.snipe) touched.push(m.from, m.to); // a shooter stays where it is and keeps its castling rights
      if (m.cap) {
        if (isRoyal(m.cap)) { n.lost = colorOf(m.cap); n.lostBy = 'king'; } // only with king capture
        removed.push({ sq: m.capSq, p: m.cap });
        b[m.capSq] = '';
        touched.push(m.capSq);
        n.half = 0;
      }
      var piece = m.piece;
      if (!m.snipe) {
        if (m.promo && m.promo !== '+') piece = c === 'w' ? m.promo.toUpperCase() : m.promo;
        b[m.from] = '';
        b[m.to] = piece;
        if (typeOf(m.piece) === 'p') { n.half = 0; if (m.dbl) n.ep = (m.from + m.to) / 2; }
        else if (isFairy(m.piece) && (fairyOf(m.piece).promote || fairyOf(m.piece).pawn)) n.half = 0; // a pawn of another kind: it never moves back and can promote
        if (m.castle === 'K') { b[m.to + 1] = ''; b[m.to - 1] = c === 'w' ? 'R' : 'r'; touched.push(m.to + 1); }
        if (m.castle === 'Q') { b[m.to - 2] = ''; b[m.to + 1] = c === 'w' ? 'R' : 'r'; touched.push(m.to - 2); }
      }
      // Explosive captures: enemy pieces next to the captured one go too.
      if (pw.explosive && m.cap) {
        var cr = ROW[m.capSq], cf = COL[m.capSq];
        var guard = fp.bodyguard ? b.indexOf(c === 'w' ? 'k' : 'K') : -1;
        for (i = 0; i < 8; i++) {
          var rr = cr + KG[i][0], ff = cf + KG[i][1];
          if (!inside(rr, ff)) continue;
          var a = rr * W + ff, ap = b[a];
          if (ap && colorOf(ap) !== c && !isRoyal(ap) && s.gold.indexOf(a) < 0 && !near(guard, a) && !(fp.iron && typeOf(ap) === 'p') && !(fp.immortal && typeOf(ap) === 'q') && !(s.fairy && isMartyr(ap)) && !(s.guard && s.guard.indexOf(a) >= 0)) {
            if (isH(n, a)) { n.helmets = n.helmets.filter(function (q) { return q !== a; }); n.fx.boom = true; continue; } // the helmet takes the blast
            removed.push({ sq: a, p: ap });
            b[a] = '';
            touched.push(a);
            n.fx.boom = true;
          }
        }
      }
      // Portals: landing on one end moves the piece to the other end.
      var land = m.snipe ? m.from : m.to;
      if ((pw.portals || (cfg.terrain && cfg.terrain.portals && cfg.terrain.portals.length === 2)) && s.portals.length === 2 && !m.castle && !m.snipe && !m.stay && !(fp.ou && fp.ou.fence)) { // the Spiked fence: not for the other side
        var exit = m.to === s.portals[0] ? s.portals[1] : (m.to === s.portals[1] ? s.portals[0] : -1);
        if (exit >= 0 && exit !== m.from && !b[exit]) {
          var er = ROW[exit];
          if (!(typeOf(piece) === 'p' && (er === 0 || er === H - 1))) {
            b[m.to] = '';
            b[exit] = piece;
            n.ep = -1;
            n.fx.tp = exit;
            touched.push(exit);
            land = exit;
          }
        }
      }
      if (s.fairy) {
        // what the mover does after its move
        var md = FAIRY[typeOf(piece)], lr = ROW[land];
        if (md && !m.snipe && !m.stay && s.gold.indexOf(m.from) < 0) {
          if (m.rock) n.rocks = s.rocks.concat([m.to]);
          if (md.slime) {
            // the slime leaves a blob where it started and on the square it slid over
            var blob = c === 'w' ? md.slime.toUpperCase() : md.slime;
            if (!b[m.from]) b[m.from] = blob;
            if (Math.abs(ROW[m.to] - ROW[m.from]) + Math.abs(COL[m.to] - COL[m.from]) === 2) { var mid = (m.from + m.to) / 2; if (!b[mid]) b[mid] = blob; }
          }
          if (md.again && m.cap && s.again < 0) n.again = land;
          // checkers: after a jump the same piece may jump on (play() checks that it can); a crowned man stops
          if (md.hopper && m.hop && !(md.promote && lr === (c === 'w' ? 0 : H - 1))) { n.again = land; n.againHop = true; }
          if (md.onCapture && m.cap) b[land] = c === 'w' ? (md.onCapture === 'q' ? 'Q' : m.cap.toUpperCase()) : (md.onCapture === 'q' ? 'q' : m.cap.toLowerCase());
          else if (md.promote && lr === (c === 'w' ? 0 : H - 1)) b[land] = c === 'w' ? (md.promoteTo || 'q').toUpperCase() : (md.promoteTo || 'q'); // a checker is crowned, a marching pawn becomes a queen
          else if (md.shogiUp && m.promo === '+') b[land] = c === 'w' ? md.shogiUp.toUpperCase() : md.shogiUp; // a shogi piece promotes (in the zone, see shogiPromos)
          else if (md.spawn) { b[land] = c === 'w' ? 'P' : 'p'; if (ROW[m.from] !== 0 && ROW[m.from] !== H - 1) b[m.from] = b[land]; }
          else if (md.becomes) b[land] = c === 'w' ? md.becomes.toUpperCase() : md.becomes;
        }
        // what the taken piece does to its taker
        var cd = m.cap ? FAIRY[typeOf(m.cap)] : null;
        if (cd && s.gold.indexOf(m.capSq) < 0) {
          // a shot from a distance is safe: only a taker that comes close catches the leprosy or goes down with a decoy
          if (cd.leper && !m.snipe && b[land] && !isRoyal(b[land])) b[land] = c === 'w' ? 'З' : 'з';
          if (cd.decoy && !m.snipe && b[land] && !isRoyal(b[land])) { removed.push({ sq: land, p: b[land] }); b[land] = ''; touched.push(land); }
          if (cd.martyr) {
            var mr = ROW[m.capSq], mf = COL[m.capSq];
            for (i = 0; i < N; i++) {
              var q = b[i];
              if (!q || Math.abs(ROW[i] - mr) > 1 || Math.abs(COL[i] - mf) > 1 || s.gold.indexOf(i) >= 0 || isMartyr(q) || (s.guard && s.guard.indexOf(i) >= 0)) continue;
              if (isH(n, i) && !isRoyal(q)) { n.helmets = n.helmets.filter(function (x) { return x !== i; }); n.fx.boom = true; continue; } // the helmet takes the blast
              // kings are not spared: a royal piece caught in the blast loses the game for its side
              if (isRoyal(q)) { n.lost = (n.lost && n.lost !== colorOf(q)) ? 'wb' : colorOf(q); n.lostBy = n.lostBy || 'blast'; }
              removed.push({ sq: i, p: q }); b[i] = ''; touched.push(i); n.fx.boom = true;
            }
          }
        }
      }
    }
    if (s.sg && !m.shot && !m.reload) {
      // a step of a Shotgun King puts one shell into its gun and brings one back to the reserve; damage goes with its piece
      if (!m.drop && !m.storm && !m.swap && !m.duck && !m.spawn && !m.snipe && !m.blast && n.fx.bounce == null && DEF[m.piece] && DEF[m.piece].shotgun && s.sg[c]) {
        var g2 = {}, o2 = s.sg[c], f2 = Math.min(SG.cap - o2[0], o2[1]); // a step fills the gun as far as the reserve goes
        for (var g3 in s.sg) g2[g3] = s.sg[g3];
        g2[c] = [o2[0] + f2, Math.min(SG.res, o2[1] - f2 + SG.regen)];
        n.sg = g2;
      }
      var gone2 = {}, dm2 = {}, landTo = n.fx.tp >= 0 ? n.fx.tp : m.to;
      for (i = 0; i < removed.length; i++) gone2[removed[i].sq] = 1;
      for (var dk2 in s.dmg) {
        var dq = +dk2;
        if (m.swap) dq = dq === m.from ? m.to : dq === m.to ? m.from : dq;
        else if (!m.drop && !m.storm && !m.duck && !m.spawn && !m.snipe && !m.blast && n.fx.bounce == null && dq === m.from) dq = landTo; // a bounce moves nobody, and no damage with it
        else if (gone2[dq]) continue;
        if (b[dq]) dm2[dq] = s.dmg[dk2];
      }
      n.dmg = dm2;
    }
    // The Ouroboros King. A bomb taken blows up with everything around it, the taker too.
    if (m.bomb) {
      n.bombs = n.bombs.filter(function (q) { return q !== m.to; });
      var br0 = ROW[m.to], bf0 = COL[m.to];
      for (i = 0; i < N; i++) {
        var bq = b[i];
        if (!bq || Math.abs(ROW[i] - br0) > 1 || Math.abs(COL[i] - bf0) > 1 || s.gold.indexOf(i) >= 0 || isMartyr(bq)) continue;
        var bo = powersOf(cfg, colorOf(bq)).ou;
        if (bo && bo.helmet) continue; // the Dwarven helmet
        if (isRoyal(bq)) { n.lost = (n.lost && n.lost !== colorOf(bq)) ? 'wb' : colorOf(bq); n.lostBy = n.lostBy || 'bomb'; }
        removed.push({ sq: i, p: bq }); b[i] = ''; touched.push(i);
      }
      n.fx.boom = true; n.fx.booms = (n.fx.booms || []).concat([m.to]);
    }
    if (m.rock) { n.boulders = n.boulders.filter(function (q) { return q !== m.to; }); if (n.rocks.indexOf(m.to) < 0) n.rocks = (n.rocks || []).concat([m.to]); } // a boulder broken
    // the relics of the side that moved: what a unit does after its move
    var ouM = pw.ou, mvd = !m.pass && !m.drop && !m.storm && !m.shot && !m.reload && !m.blast && !m.ally && !m.bomb && !m.duck && !m.spawn && n.fx.bounce == null;
    if (ouM && mvd) {
      var mt = typeOf(m.piece), at0 = m.snipe ? m.from : land, here = b[at0], tint = function (l) { return c === 'w' ? l.toUpperCase() : l.toLowerCase(); };
      if (here && colorOf(here) === c && s.gold.indexOf(m.from) < 0) {
        if (m.cap && !m.snipe) {
          if (ouM.carrots && (mt === 'n' || mt === 'κ') && s.again < 0) { n.again = at0; n.ouAgain = true; } // Spicy carrots: once more, once a turn
          if (ouM.daggers && (mt === 'ρ' || mt === 'λ')) { n.again = at0; n.ouAgain = true; }             // Extra daggers: on and on
          if (ouM.totem && !isRoyal(here) && !isRoyal(m.cap) && colorOf(m.cap) !== c) b[at0] = here = tint(typeOf(m.cap)); // the Totem mask: it becomes what it took
          if (ouM.medal && ouM.medal[typeOf(here)]) b[at0] = here = tint(ouM.medal[typeOf(here)]);            // the Death medal: upgraded
          if (ouM.stiletto && mt === 'ж' && !b[m.from]) { b[m.from] = here; b[at0] = ''; at0 = m.from; }    // the Stiletto: back where it started
        }
        if (ouM.carnival && ouM.carnival.length && !isRoyal(here)) b[at0] = here = tint(ouM.carnival[(m.from * 31 + m.to * 7 + s.full * 13) % ouM.carnival.length]); // the Carnival mask
        if (ouM.terraform && mt === 'л' && !b[m.from] && at0 !== m.from) n.boulders = n.boulders.concat([m.from]); // the Terraformer staff
      }
    }
    // the Boomerang (an item): the unit that moved comes back to where it started
    if (s.boomer && mvd) { var bh = b[land]; if (bh && colorOf(bh) === c && !b[m.from]) { b[m.from] = bh; b[land] = ''; if (n.again === land) n.again = m.from; } }
    if (n.again >= 0 && !n.againHop && !n.ouAgain && !(b[n.again] && FAIRY.hasOwnProperty(typeOf(b[n.again])) && FAIRY[typeOf(b[n.again])].again)) n.again = -1;
    if (s.fairy && removed.length) {
      // a fire chick or phoenix comes back in its corner when that square is free, once: then it is marked as reborn
      for (i = 0; i < removed.length; i++) {
        var rp = removed[i].p, rd = FAIRY[typeOf(rp)];
        if (!rd || !rd.respawn || s.gold.indexOf(removed[i].sq) >= 0 || (s.reborn && s.reborn.indexOf(removed[i].sq) >= 0)) continue;
        var corner = colorOf(rp) === 'w' ? (H - 1) * W : W - 1; // a1 for White, the top right corner for Black
        if (!b[corner] && !isWall(cfg, corner, s)) { b[corner] = rp; removed[i].back = corner; }
      }
    }
    if (removed.length) {
      // the taken pieces to the taker's hand: all of them with Reinforcements, shogi pieces always (unpromoted)
      var pocket = null;
      for (i = 0; i < removed.length; i++) {
        if (colorOf(removed[i].p) === c || removed[i].back != null) continue;
        var rt = typeOf(removed[i].p), rsd = FAIRY.hasOwnProperty(rt) ? FAIRY[rt] : null;
        if (rsd && rsd.shogi && !rsd.royal) (pocket = pocket || n[pkey].slice()).push(SHOGI_BASE[rt] || rt);
        else if (pw.drops) (pocket = pocket || n[pkey].slice()).push(rt);
      }
      if (pocket) n[pkey] = pocket;
    }
    if (s.fairy || (m.drop && FAIRY.hasOwnProperty(m.drop))) n.fairy = hasFairy(b);
    if ((n.ghosts.length || n.snipers.length || n.reborn.length || n.helmets.length || n.vests.length || n.stun.length || n.guard.length) && !m.stay && !m.blast && n.fx.bounce == null) {
      // the upgrades follow their pieces: the mover to where it landed, a castling rook along, the taken ones gone
      var gone = {}, steps = m.storm ? stormSteps(s.board, c, s.gold.length || s.ice.length ? s.gold.concat(s.ice) : null) : null;
      for (i = 0; i < removed.length; i++) gone[removed[i].sq] = 1;
      var follow = function (list) {
        var out = [];
        for (var q = 0; q < list.length; q++) {
          var at = list[q];
          if (m.swap) at = at === m.from ? m.to : at === m.to ? m.from : at;
          else if (steps) { for (var st = 0; st < steps.length; st++) if (steps[st][0] === at) { at = steps[st][1]; break; } }
          else if (!m.drop && !m.snipe && !m.shot && !m.reload && at === m.from) at = land;
          else if (gone[at]) continue;
          else if (m.castle === 'K' && at === m.to + 1) at = m.to - 1;
          else if (m.castle === 'Q' && at === m.to - 2) at = m.to + 1;
          if (b[at] && out.indexOf(at) < 0) out.push(at);
        }
        return out;
      };
      n.ghosts = follow(n.ghosts); n.snipers = follow(n.snipers); n.reborn = follow(n.reborn); n.helmets = follow(n.helmets); n.vests = follow(n.vests); n.stun = follow(n.stun); n.guard = follow(n.guard);
    }
    // the ones that just came back are spent from now on
    for (i = 0; i < removed.length; i++) if (removed[i].back != null) n.reborn = n.reborn.concat([removed[i].back]);
    // Ice only holds the piece it was put on: a square that was captured on or vacated thaws.
    if (s.ice.length) n.ice = s.ice.filter(function (q) { return b[q] === s.board[q]; });
    if (n.castling) {
      var cs = n.castling;
      for (i = 0; i < touched.length; i++) {
        var rt = RIGHTS[touched[i]];
        if (rt) cs = cs.replace(rt[0], '').replace(rt[1] || '~', '');
      }
      n.castling = cs;
    }
    // Dice Chess: a kind of piece that was not on the board before (a promotion, a piece that changed shape) joins the dice
    if (n.pool && m.to >= 0 && b[m.to]) {
      var nt = typeOf(b[m.to]);
      if (n.pool.indexOf(nt) < 0) n.pool = n.pool.concat([nt]);
    }
    return n;
  }

  /* Dice Chess. Every die shows a kind of piece; the faces are the kinds that stood on the board when the game
     began (a kind that appears later, by promotion or by a piece changing shape, joins them), each equally
     likely however many of it there are. A turn starts unrolled: the side to move rolls (roll()), and only then
     are there moves. Games saved before the dice became a real roll (cfg.legacyDice) still roll from their seed.
     The die a move needs is the kind of the piece that moves. */
  function dieOf(m) {
    var t = m.storm ? 'p' : m.drop ? m.drop : typeOf(m.piece);
    if (legacyDice) return DEF[t] ? DEF[t].base.toLowerCase() : t; // the old rule: a fairy piece counted as its base
    return t;
  }
  var legacyDice = false;
  function dicePool(board) {
    var out = [];
    for (var i = 0; i < board.length; i++) { var p = board[i]; if (p) { var t = typeOf(p); if (out.indexOf(t) < 0) out.push(t); } }
    var order = 'pnbrqk';
    return out.sort(function (a, b) { var x = order.indexOf(a), y = order.indexOf(b); return (x < 0 ? 9 : x) - (y < 0 ? 9 : y) || (a < b ? -1 : a > b ? 1 : 0); });
  }
  function diceCount(cfg) { return cfg.dice3 ? 3 : 2; }
  // A fair throw of the dice for the side to move (rnd: a function giving 0 to 1, Math.random by default).
  function rollFaces(s, cfg, rnd) {
    rnd = rnd || Math.random;
    var pool = s.pool && s.pool.length ? s.pool : ['p', 'n', 'b', 'r', 'q', 'k'], out = [];
    for (var i = 0; i < diceCount(cfg); i++) out.push(pool[Math.floor(rnd() * pool.length) % pool.length]);
    return out;
  }
  /* The roll itself. With three dice a throw that allows no move at all loses the turn; with two dice the
     throw does not count and the side rolls again. n.rolled keeps the whole throw for the display, n.dice
     what is left of it. */
  function roll(s, cfg, faces) {
    use(s);
    if (!cfg.dice || s.dice || !faces || faces.length !== diceCount(cfg)) return null;
    var n = {};
    for (var k in s) n[k] = s[k];
    n.dice = faces.slice(); n.rolled = faces.slice(); n.roll = (s.roll || 0) + 1; n.fx = null; n.wasted = null;
    if (legalMoves(n, cfg).length) return n;
    if (!cfg.dice3) { n.dice = null; n.rolled = null; n.wasted = faces.slice(); return n; } // nothing fits: throw again
    n.wasted = faces.slice();
    return passTurn(n, s.turn, cfg);
  }
  // The turn goes over: the mover's ice melts, the other side starts fresh and unrolled.
  // The Ouroboros King at the start of a turn: the items of the last one are spent, the Cursed staff gives an extra
  // move every third turn of its side, the Marching boots the first turn of a side that did not move first; the Magic
  // tiara's protection ends with the turn
  function ouTurnStart(n, cfg) {
    n.ouLock = -1; n.bottle = ''; n.knife = false;
    if (n.ouSafe) n.ouSafe = '';
    var nou = powersOf(cfg, n.turn).ou;
    if (nou && nou.cursed) { n.ouTurns = (n.ouTurns || 0) + 1; if (n.ouTurns % 3 === 0) n.movesLeft = Math.max(n.movesLeft, 2); }
    if (n.ouBoots && n.ouBoots === n.turn) { n.ouBoots = ''; if (nou && nou.boots) n.movesLeft = Math.max(n.movesLeft, 2); }
  }
  function passTurn(n, mover, cfg) {
    n.turn = other(mover); n.ep = -1; n.again = -1; n.movesLeft = 0;
    n.full = n.full + (mover === 'b' ? 1 : 0);
    n.dice = null; n.rolled = null;
    if (n.ice.length) n.ice = n.ice.filter(function (q) { return n.board[q] && colorOf(n.board[q]) !== mover; });
    if (n.guard && n.guard.length) n.guard = n.guard.filter(function (q) { return n.board[q] && colorOf(n.board[q]) === mover; }); // a shield lasts through the other side's turn
    if (has(cfg, n.turn)) { n.movesLeft = powersOf(cfg, n.turn).double || 1; n.midasUsed = 0; n.freezeUsed = false; n.shieldUsed = false; }
    ouTurnStart(n, cfg);
    return n;
  }
  // The chance that at least one of `a` given kinds comes up, with the game's dice and pool.
  function diceChance(s, cfg, a) {
    var k = s.pool && s.pool.length ? s.pool.length : 6;
    return a <= 0 ? 0 : 1 - Math.pow(Math.max(0, k - a) / k, diceCount(cfg));
  }
  function die(seed, n) {
    var x = ((seed | 0) ^ Math.imul(n + 1, 0x9E3779B1)) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B);
    x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35);
    x ^= x >>> 16;
    return 'pnbrqk'[(x >>> 0) % 6];
  }
  /* Roll two dice for the side to move. They come from the game's seed, so a replay sees
     the same rolls. A roll that allows no move at all is thrown again. */
  /* Three-dice chess (cfg.dice3): three dice, and every one of them has to be used, one move each, in any order.
     A die that cannot be used any more is lost. Without a seed (inside the search, where nobody may know the
     coming rolls) the next turn is not bound to any dice. */
  function rollDice(s, cfg) {
    use(s);
    if (!cfg.legacyDice) { s.dice = null; s.rolled = null; return; } // a real roll comes from roll()
    legacyDice = true;
    s.dice = null;
    if (cfg.dice3 && !cfg.seed) return;
    var all = legalAll(s, cfg);
    if (!all.length) return;
    for (var i = 0; i < 80; i++) {
      s.roll++;
      var d = cfg.dice3 ? [die(cfg.seed, s.roll * 3 + 1000), die(cfg.seed, s.roll * 3 + 1001), die(cfg.seed, s.roll * 3 + 1002)] : [die(cfg.seed, s.roll * 2), die(cfg.seed, s.roll * 2 + 1)];
      for (var j = 0; j < all.length; j++) if (d.indexOf(dieOf(all[j])) >= 0) { s.dice = d; return; }
    }
  }
  function legalMoves(s, cfg) {
    use(s);
    legacyDice = !!(cfg && cfg.legacyDice);
    if (cfg.dice && !cfg.legacyDice && !s.dice && s.again < 0) return []; // roll first
    var all = legalAll(s, cfg);
    if (!cfg.dice || !s.dice || s.again >= 0) return all; // the bonus move of an assassin is not bound to the dice
    var fit = all.filter(function (m) { return s.dice.indexOf(dieOf(m)) >= 0; });
    return cfg.dice3 ? diceMost(s, fit, cfg) : fit;
  }
  /* Three-dice chess: as many dice as possible have to be used. A move is only allowed if the dice that are left
     after it can still be used as far as the best order of moves would allow. With pawn, pawn, king and a king
     that is walled in, a pawn move that does not free the king is not allowed while another one does. Taking the
     king ends the game and is always allowed. */
  function diceMost(s, fit, cfg) {
    use(s);
    if (fit.length < 2 || s.dice.length < 2) return fit;
    var best = diceUse(s, s.dice, cfg, 3);
    return fit.filter(function (m) {
      var n = diceStep(s, m, cfg);
      return n.lost || 1 + diceUse(n, n.dice, cfg, best - 1) >= best;
    });
  }
  // The position after one move of a three-dice turn: the same side still to move, the die spent.
  function diceStep(s, m, cfg) {
    use(s);
    var n = applyRaw(s, m, cfg), rem = s.dice.slice(), used = rem.indexOf(dieOf(m));
    if (used >= 0) rem.splice(used, 1);
    n.turn = s.turn; n.ep = -1; n.dice = rem;
    return n;
  }
  // How many of these dice can still be used from here, at most (stops looking once `enough` is reached).
  function diceUse(s, dice, cfg, enough) {
    use(s);
    if (!dice.length || enough <= 0) return 0;
    var all = legalAll(s, cfg), best = 0;
    for (var i = 0; i < all.length; i++) {
      if (dice.indexOf(dieOf(all[i])) < 0) continue;
      var n = diceStep(s, all[i], cfg);
      var u = n.lost ? dice.length : 1 + diceUse(n, n.dice, cfg, Math.min(enough, dice.length) - 1);
      if (u > best) best = u;
      if (best >= Math.min(enough, dice.length)) break;
    }
    return best;
  }

  function legalAll(s, cfg) {
    use(s);
    var ps = pseudoMoves(s, cfg), out = [], c = s.turn, opp = other(c);
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].inCheck) { out.push(ps[i]); continue; } // a shot at the attacker: legal whatever the pellets do
      var n = applyRaw(s, ps[i], cfg);
      if (royalAlive(n, c) && !inCheck(n, c, cfg) && !pawnDropMate(n, ps[i], c, cfg)) out.push(ps[i]);
    }
    return out;
  }
  // Shogi: a dropped pawn may give check, but not mate (uchifuzume)
  function pawnDropMate(n, m, c, cfg) {
    if (m.drop !== '\u047d' || n.turn === c || !inCheck(n, n.turn, cfg)) return false;
    return !anyLegal(n, cfg);
  }

  // Is there a legal move at all? Stops at the first one, so it costs a fraction of listing them.
  function anyLegal(s, cfg) {
    use(s);
    var ps = pseudoMoves(s, cfg), c = s.turn, opp = other(c), dice = cfg.dice && s.dice ? s.dice : null;
    for (var i = 0; i < ps.length; i++) {
      if (dice && s.again < 0 && dice.indexOf(dieOf(ps[i])) < 0) continue;
      if (ps[i].inCheck) return true;
      var n = applyRaw(s, ps[i], cfg);
      if (royalAlive(n, c) && !inCheck(n, c, cfg) && !pawnDropMate(n, ps[i], c, cfg)) return true;
    }
    return false;
  }

  // Only the legal captures and promotions: what a search looks at when it settles a position.
  function noisyMoves(s, cfg) {
    use(s);
    var ps = pseudoMoves(s, cfg, true), out = [], c = s.turn, opp = other(c);
    for (var i = 0; i < ps.length; i++) {
      if (!ps[i].cap && !ps[i].promo) continue;
      var n = applyRaw(s, ps[i], cfg);
      if (royalAlive(n, c) && !inCheck(n, c, cfg)) out.push(ps[i]);
    }
    return out;
  }

  // Play a move including the turn logic of Double Move, Time Stop and Rampage.
  function play(s, m, cfg) {
    use(s);
    if (m.duck) {
      // a duck move: the same side goes on until every yellow duck has moved, then the turn is over
      var d = applyRaw(s, m, cfg);
      if (!s.duckPhase || duckDue(d)) return d;
      d.duckPhase = 0; d.dTodo = []; d.dBan = [];
      return endOfTurn(d, s.turn, cfg);
    }
    var n = applyRaw(s, m, cfg), mover = s.turn, pw = powersOf(cfg, mover);
    if (n.lost) { n.again = -1; n.movesLeft = 0; return n; }
    if (n.again >= 0) {
      // an assassin or blade dancer that has just taken moves once more, if it can
      var t2 = {};
      for (var k2 in n) t2[k2] = n[k2];
      t2.turn = mover; t2.ep = -1; t2.full = s.full;
      /* With check and mate, a capture that checks the other side's royal piece ends the turn: the king may never be
         taken, so it always gets the chance to answer. Under king capture (The Ouroboros King) the extra move stays,
         as in the game: it may take the king, which wins. */
      var checks = !cfg.kingCapture && royalSquares(n, other(mover)).some(function (q) { return attacked(n, q, mover, cfg) && !guarded(n, q, other(mover)); });
      var goOn = n.againHop ? legalMoves(t2, cfg).some(function (x) { return x.hop; }) : anyLegal(t2, cfg); // checkers: only another jump
      if (!checks && !inCheck(t2, mover, cfg) && goOn) return t2;
      n.again = -1; n.againHop = false;
    }
    if (cfg.dice3 && s.dice && s.dice.length) {
      // the die this move used is spent; with dice left that can still be used, the same side moves again
      var rem = s.dice.slice(), used = rem.indexOf(dieOf(m));
      if (used >= 0) rem.splice(used, 1);
      if (rem.length) {
        var t3 = {};
        for (var k3 in n) t3[k3] = n[k3];
        t3.turn = mover; t3.ep = -1; t3.full = s.full; t3.dice = rem;
        if (anyLegal(t3, cfg)) return t3;
      }
      n.dice = null;
    }
    if (pw !== NONE) {
      n.movesLeft = s.movesLeft - 1 + (pw.rampage && m.cap && !(n.fx && n.fx.bounce >= 0) ? 1 : 0); // Rampage: a capture earns another move (not one that bounced off a helmet)
      if (n.movesLeft > 0 && !inCheck(n, n.turn, cfg)) {
        var t = {};
        for (var k in n) t[k] = n[k];
        t.turn = mover; t.ep = -1; t.full = s.full;
        if (pw.ou) { var lk = n.fx && n.fx.tp >= 0 ? n.fx.tp : m.to; t.ouLock = lk >= 0 && n.board[lk] && colorOf(n.board[lk]) === mover ? lk : (m.from >= 0 && n.board[m.from] && colorOf(n.board[m.from]) === mover ? m.from : -1); } // the second move: another unit
        if (anyLegal(t, cfg)) n = t; else n.movesLeft = 0;
      } else n.movesLeft = 0;
    }
    if (n.turn !== mover) {
      var dk = duckStart(n, mover); // the yellow ducks come first
      if (dk) return dk;
      n = endOfTurn(n, mover, cfg);
    }
    return n;
  }
  // The turn of `mover` is over (n.turn is already the other side): demons, devils, ice, the next side's power-ups and dice.
  function endOfTurn(n, mover, cfg) {
    n.turn = other(mover);
    n.bMoved = [];
    if ((n.fairy & 64) || (n.sleep && n.sleep.length) || (n.fresh && n.fresh.length)) turnOver(n, mover, cfg);
    if (n.lost) { n.movesLeft = 0; return n; }
    // the ice on the mover's pieces melts once that side has had its turn
    if (n.ice.length) n.ice = n.ice.filter(function (q) { return n.board[q] && colorOf(n.board[q]) !== mover; });
    // an attacker that bounced off a helmet this turn freezes now: it stays frozen through its side's next turn
    if (n.stun && n.stun.length) { var stunned = n.stun.filter(function (q) { return n.board[q] && n.ice.indexOf(q) < 0 && n.gold.indexOf(q) < 0; }); if (stunned.length) n.ice = n.ice.concat(stunned); n.stun = []; }
    if (n.guard && n.guard.length) n.guard = n.guard.filter(function (q) { return n.board[q] && colorOf(n.board[q]) === mover; }); // a shield lasts through the other side's turn
    if (has(cfg, n.turn)) { n.movesLeft = powersOf(cfg, n.turn).double || 1; n.midasUsed = 0; n.freezeUsed = false; n.shieldUsed = false; }
    ouTurnStart(n, cfg);
    if (cfg.dice) { rollDice(n, cfg); if (!cfg.legacyDice) { n.dice = null; n.rolled = null; } }
    return n;
  }

  /* Midas Touch: squares the player may turn to gold right now. midasPerTurn is how often a turn may use it
     for free: 1, or 0 for no limit. -1 means it uses the turn: a gild is then the move (one of them with
     Double Move), so it may not leave the own king in check. */
  function midasTurn(pw) { return pw.midasPerTurn === -1; }
  function gildTargets(s, cfg, legal) {
    use(s);
    var pw = powersOf(cfg, s.turn);
    if (!pw.midas) return [];
    if (pw.midasPerTurn > 0 && s.midasUsed >= pw.midasPerTurn) return [];
    if (midasTurn(pw) && s.again >= 0) return []; // the second step of an assassin's capture is a move, not a turn
    legal = legal || (cfg.dice ? legalMoves(s, cfg) : noisyMoves(s, cfg)); // only the captures matter here
    /* Only a piece that could be taken without putting the own king in check: the capture is played in thought
       and the own royal pieces must not be attacked afterwards. With king capture rules that is not part of a
       legal move, so it is checked here; otherwise a king could gild a guarded queen right next to it. */
    var out = [], c = s.turn;
    for (var i = 0; i < legal.length; i++) {
      var m = legal[i];
      if (!m.cap || out.indexOf(m.capSq) >= 0 || isRoyal(m.cap)) continue;
      var after = applyRaw(s, m, cfg);
      if (after.lost || !royalAlive(after, c) || checkedSquares(after, c, cfg).length) continue;
      out.push(m.capSq);
    }
    if (midasTurn(pw) && !cfg.kingCapture) out = out.filter(function (q) { return !inCheck(goldOn(s, q), s.turn, cfg); });
    return out;
  }
  function goldOn(s, sq) {
    var n = {};
    for (var k in s) n[k] = s[k];
    n.gold = s.gold.concat([sq]);
    return n;
  }

  function gild(s, sq, cfg) {
    use(s);
    if (gildTargets(s, cfg).indexOf(sq) < 0) return null;
    var n = goldOn(s, sq);
    n.midasUsed = s.midasUsed + 1;
    n.half = 0; // a statue can never come back, like a capture: the 50 move count starts again
    n.fx = null;
    n.bMoved = [];
    if ((n.fairy & 64) || (n.sleep && n.sleep.length)) turnOver(n, mover, cfg);
    if (midasTurn(powersOf(cfg, s.turn))) n = gildEndsMove(s, n, cfg);
    return n;
  }
  // Midas that uses the turn: the gild counts as one move of it. With moves left (Double Move) the same side goes on.
  function gildEndsMove(s, n, cfg) {
    var mover = s.turn;
    n.movesLeft = s.movesLeft - 1;
    n.ep = -1; n.again = -1;
    if (n.movesLeft > 0 && anyLegal(n, cfg)) return n;
    n.movesLeft = 0;
    n.turn = other(mover);
    n.full = s.full + (mover === 'b' ? 1 : 0);
    n.dice = null;
    n.bMoved = [];
    if ((n.fairy & 64) || (n.sleep && n.sleep.length)) turnOver(n, mover, cfg);
    // as after a move: the ice on the mover's pieces melts, the other side's turn starts fresh
    if (n.ice.length) n.ice = n.ice.filter(function (q) { return n.board[q] && colorOf(n.board[q]) !== mover; });
    if (n.guard && n.guard.length) n.guard = n.guard.filter(function (q) { return n.board[q] && colorOf(n.board[q]) === mover; }); // a shield lasts through the other side's turn
    if (has(cfg, n.turn)) { n.movesLeft = powersOf(cfg, n.turn).double || 1; n.midasUsed = 0; n.freezeUsed = false; n.shieldUsed = false; }
    ouTurnStart(n, cfg);
    if (cfg.dice) { rollDice(n, cfg); n.dice = null; n.rolled = null; }
    return n;
  }

  // Freeze Ray: any enemy piece except the king, once per turn.
  function freezeTargets(s, cfg) {
    use(s);
    if (!powersOf(cfg, s.turn).freeze || s.freezeUsed) return [];
    var out = [];
    for (var i = 0; i < N; i++) {
      var p = s.board[i];
      if (p && colorOf(p) !== s.turn && !isRoyal(p) && s.gold.indexOf(i) < 0 && s.ice.indexOf(i) < 0) out.push(i);
    }
    return out;
  }
  function freeze(s, sq, cfg) {
    use(s);
    if (freezeTargets(s, cfg).indexOf(sq) < 0) return null;
    var n = {};
    for (var k in s) n[k] = s[k];
    n.ice = s.ice.concat([sq]);
    n.freezeUsed = true;
    n.fx = null;
    return n;
  }

  /* Shield: once a turn, free, one of your pieces (not the king, not a statue) cannot be captured, shot or blown up on
     the other side's next turn. The shield goes with its piece and ends when that turn is over. */
  function shieldTargets(s, cfg) {
    use(s);
    if (!powersOf(cfg, s.turn).shield || s.shieldUsed) return [];
    var out = [], g = s.guard || [];
    for (var i = 0; i < N; i++) {
      var p = s.board[i];
      if (p && colorOf(p) === s.turn && !isRoyal(p) && s.gold.indexOf(i) < 0 && g.indexOf(i) < 0) out.push(i);
    }
    return out;
  }
  function shield(s, sq, cfg) {
    use(s);
    if (shieldTargets(s, cfg).indexOf(sq) < 0) return null;
    var n = {};
    for (var k in s) n[k] = s[k];
    n.guard = (s.guard || []).concat([sq]);
    n.shieldUsed = true;
    n.fx = null;
    return n;
  }

  // Time Stop: once per game and side, two extra moves this turn.
  function stopReady(s, cfg) { return !!powersOf(cfg, s.turn).timestop && s.stopUsed.indexOf(s.turn) < 0; }
  function timeStop(s, cfg) {
    use(s);
    if (!stopReady(s, cfg)) return null;
    var n = {};
    for (var k in s) n[k] = s[k];
    n.movesLeft = s.movesLeft + 2;
    n.stopUsed = s.stopUsed + s.turn;
    n.fx = null;
    return n;
  }

  /* Turncoat: once per game, an enemy piece changes sides for good. Not the king, not a
     statue, not a piece whose change would put the enemy king in check on the spot, and
     against Stockfish only while the army stays one it accepts. */
  function convertTargets(s, cfg) {
    use(s);
    var me = s.turn;
    if (!powersOf(cfg, me).turncoat || s.turned.indexOf(me) >= 0) return [];
    var out = [], army = armyRoom(s.board, me), ek = kingSq(s, other(me));
    for (var i = 0; i < N; i++) {
      var p = s.board[i];
      if (!p || colorOf(p) === me || isRoyal(p) || s.gold.indexOf(i) >= 0) continue;
      if (!cfg.freeArmy && !canDrop(army, typeOf(p))) continue;
      var b = s.board.slice();
      b[i] = me === 'w' ? p.toUpperCase() : p.toLowerCase();
      var probe = {};
      for (var pk in s) probe[pk] = s[pk];
      probe.board = b; probe.fairy = hasFairy(b);
      if (inCheck(probe, other(me), cfg)) continue;
      out.push(i);
    }
    return out;
  }
  function convert(s, sq, cfg) {
    use(s);
    if (convertTargets(s, cfg).indexOf(sq) < 0) return null;
    var n = {};
    for (var k in s) n[k] = s[k];
    n.board = s.board.slice();
    n.board[sq] = s.turn === 'w' ? s.board[sq].toUpperCase() : s.board[sq].toLowerCase();
    n.turned = s.turned + s.turn;
    n.ice = s.ice.filter(function (q) { return q !== sq; });
    n.fairy = hasFairy(n.board);
    if (RIGHTS[sq] && n.castling) n.castling = n.castling.replace(RIGHTS[sq][0], '').replace(RIGHTS[sq][1] || '~', '');
    n.fx = null;
    return n;
  }

  function insufficient(s) {
    use(s);
    var minors = 0;
    for (var i = 0; i < N; i++) {
      var p = s.board[i];
      if (!p) continue;
      var t = typeOf(p);
      if (t === 'k') continue;
      if (t === 'n' || t === 'b') minors++;
      else return false;
    }
    return minors <= 1;
  }

  function hasPowers(cfg) {
    return cfg.pw ? (anyPower(cfg.pw.w || NONE) || anyPower(cfg.pw.b || NONE)) : anyPower(cfg);
  }

  // { over, result: 'w' | 'b' | 'draw', reason }
  function status(s, cfg, legal) {
    use(s);
    if (s.lost) {
      var why = s.lostBy === 'king' ? 'king captured' : s.lostBy === 'shot' ? 'the king was shot' : s.lostBy === 'survived' ? 'the attacker survived the shot' : 'explosion';
      return s.lost.length > 1 ? { over: true, result: 'draw', reason: why } : { over: true, result: other(s.lost), reason: why };
    }
    if (s.duckPhase) {
      // a yellow duck that cannot move anywhere: a draw
      if (duckDue(s) && !(legal || legalMoves(s, cfg)).some(function (m) { return m.duck === 'y'; })) return { over: true, result: 'draw', reason: 'a duck cannot move' };
      return { over: false };
    }
    if (s.kingless) { // no king: all of its pieces taken is the loss
      var ww = wiped(s, 'w'), wb = wiped(s, 'b');
      if (ww || wb) return ww && wb ? { over: true, result: 'draw', reason: 'all pieces taken' } : { over: true, result: ww ? 'b' : 'w', reason: 'all pieces taken' };
    }
    if (cfg.dice && !cfg.legacyDice && !s.dice && s.again < 0) { // not rolled yet: the move count, and a side that no throw can help
      if (s.half >= 100 && !shogiInPlay(s)) return { over: true, result: 'draw', reason: 'the 50 move rule' };
      if (!cfg.kingCapture && !legalAll(s, cfg).length && !(midasTurn(powersOf(cfg, s.turn)) && gildTargets(s, cfg).length)) {
        if (inCheck(s, s.turn, cfg)) return { over: true, result: other(s.turn), reason: 'checkmate' };
        return { over: true, result: 'draw', reason: 'stalemate' };
      }
      return { over: false };
    }
    legal = legal || legalMoves(s, cfg);
    if (cfg.duckChess && !legal.length) return { over: true, result: s.turn, reason: 'no moves, which wins in Duck Chess' }; // there is no stalemate in Duck Chess
    if (s.checkers || cfg.checkers) { // the game of Checkers: who cannot move (no pieces, all blocked) loses
      if (!legal.length) return { over: true, result: other(s.turn), reason: 'no moves left' };
      if (s.half >= 100 && !shogiInPlay(s)) return { over: true, result: 'draw', reason: 'the 50 move rule' };
      return { over: false };
    }
    if (!legal.length && !(midasTurn(powersOf(cfg, s.turn)) && gildTargets(s, cfg).length)) { // a gild that uses the turn is a move too
      if (inCheck(s, s.turn, cfg)) return { over: true, result: other(s.turn), reason: 'checkmate' };
      return { over: true, result: 'draw', reason: 'stalemate' };
    }
    if (s.half >= 100 && !shogiInPlay(s)) return { over: true, result: 'draw', reason: 'the 50 move rule' };
    // not under king capture (The Ouroboros King): a king can still walk into a capture, so nothing is a dead draw
    if (!hasPowers(cfg) && !cfg.kingCapture && !s.kingless && insufficient(s)) return { over: true, result: 'draw', reason: 'insufficient material' };
    if (ouFinisher(s, cfg)) return { over: true, result: s.turn, reason: 'finisher' }; // The Finisher (The Ouroboros King)
    return { over: false };
  }

  /* The Ouroboros King's relics that act at the start of a side's turn (powers .ou of that side, the player's or the
     enemy's alike). The Finisher: the other side's General (or King) stands alone and this side still has another
     unit, which wins (status). The Spiked shield: the first unit of this side taken by anything but a king, the taker
     is destroyed (once a battle). The Bodyguard horn: the King is this side's only unit left, a Queen joins him on a
     free square next to him (once a battle). What is used up is kept on the state: s.ouDone holds 'S' or 'H' and the
     side. The app plays the shield and the horn as entries of their own (ouRelicStep), the search right after the
     move that ends a turn (ouTurnRelics). */
  function ouFinisher(s, cfg) {
    var ou = powersOf(cfg, s.turn).ou;
    if (!ou || !ou.finisher) return false;
    var c = s.turn, mine = false, theirs = false, b = s.board;
    for (var i = 0; i < b.length; i++) {
      var p = b[i];
      if (!p) continue;
      if (colorOf(p) === c) { if (!isRoyal(p)) mine = true; } else if (isRoyal(p)) theirs = true; else return false;
    }
    return mine && theirs;
  }
  // The square of the unit the Spiked shield destroys now, or -1. m: the last move of the other side (null if none).
  function ouSpike(s, cfg, m) {
    var c = s.turn, ou = powersOf(cfg, c).ou;
    if (!ou || !ou.spiked || (s.ouDone || '').indexOf('S' + c) >= 0 || !m || !m.cap || colorOf(m.cap) !== c || !m.piece || colorOf(m.piece) === c || isRoyal(m.piece)) return -1;
    return s.board[m.to] === m.piece ? m.to : m.from >= 0 && s.board[m.from] === m.piece ? m.from : -1;
  }
  // The square the Bodyguard horn's Queen comes to now, or -1.
  function ouHorn(s, cfg) {
    var c = s.turn, ou = powersOf(cfg, c).ou;
    if (!ou || !ou.horn || (s.ouDone || '').indexOf('H' + c) >= 0) return -1;
    var k = -1, i;
    for (i = 0; i < s.board.length; i++) {
      var p = s.board[i];
      if (!p || colorOf(p) !== c) continue;
      if (k >= 0 || !isRoyal(p)) return -1;
      k = i;
    }
    if (k < 0) return -1;
    for (i = 0; i < 8; i++) {
      var rr = ROW[k] + HORN[i][0], ff = COL[k] + HORN[i][1], q = rr * W + ff;
      if (inside(rr, ff) && !s.board[q] && !isWall(cfg, q, s)) return q;
    }
    return -1;
  }
  var HORN = [[-1, 0], [-1, -1], [-1, 1], [0, -1], [0, 1], [1, 0], [1, -1], [1, 1]];
  /* One relic acting at the start of s.turn: { n, spike, spiked } or { n, horn }, or null when none does. m: the last
     move of the other side. */
  function ouRelicStep(s, cfg, m) {
    use(s);
    var c = s.turn, q = ouSpike(s, cfg, m), out = null;
    if (q >= 0) out = { spike: q, spiked: s.board[q], put: '', mark: 'S' };
    else if ((q = ouHorn(s, cfg)) >= 0) out = { horn: q, put: c === 'w' ? 'Q' : 'q', mark: 'H' };
    if (!out) return null;
    var n = {};
    for (var k in s) n[k] = s[k];
    n.board = s.board.slice();
    n.board[q] = out.put;
    n.fairy = hasFairy(n.board);
    n.ouDone = (s.ouDone || '') + out.mark + c;
    n.fx = null;
    out.n = n;
    return out;
  }
  // The relics at the start of the turn n has reached by move m (a no-op while the same side is still moving).
  function ouTurnRelics(s, m, n, cfg) {
    if (n.turn === s.turn || n.lost || !ouTurnOn(cfg)) return n;
    var r = ouRelicStep(n, cfg, m);
    while (r) { n = r.n; r = r.horn != null ? null : ouRelicStep(n, cfg, null); }
    return n;
  }
  function ouTurnOn(cfg) {
    for (var i = 0; i < 2; i++) { var o = powersOf(cfg, i ? 'b' : 'w').ou; if (o && (o.spiked || o.horn)) return true; }
    return false;
  }
  function ouFinisherOn(cfg) { var a = powersOf(cfg, 'w').ou, b = powersOf(cfg, 'b').ou; return !!((a && a.finisher) || (b && b.finisher)); }
  /* An item was used by side c (the enemy never uses items): with the other side's Magic tiara its General cannot be
     taken for the rest of the turn. */
  function ouItemUsed(n, cfg, c) {
    var f = other(c), fo = powersOf(cfg, f).ou;
    if (fo && fo.tiara && n.turn === c) n.ouSafe = f;
    return n;
  }

  /* The Ouroboros King's items that act on the board (the app counts what is left): a bottle (this turn every unit
     moves like a bishop, knight or rook), the Boomerang (the next unit to move comes back), the Hang glider (the next
     move flies over boulders and bombs), the Backstabbing knife (this turn your units may take your own), the Pocket
     boulder (a boulder on an empty square), the Hammer (a boulder broken), the Snow bottle (a bomb defused), the
     Exploding rock (a bomb placed, the turn is over), the Teleporter (two of your units change places, the turn is
     over). Returns the new position, or null when the item cannot be used there. */
  function ouItem(s, cfg, id, a, b2) {
    use(s);
    var n = {}, k, c = s.turn, pass = false;
    for (k in s) n[k] = s[k];
    n.board = s.board.slice(); n.fx = null;
    n.bombs = (s.bombs || []).slice(); n.boulders = (s.boulders || []).slice(); n.rocks = (s.rocks || []).slice();
    if (id === 'bottle_b' || id === 'bottle_n' || id === 'bottle_r') n.bottle = id.slice(-1);
    else if (id === 'boomerang') n.boomer = true;
    else if (id === 'glider') n.glide = true;
    else if (id === 'knife') n.knife = true;
    else if (id === 'boulder' || id === 'rock') {
      if (a < 0 || a >= N || n.board[a] || isWall(cfg, a, s) || (cfg.terrain && cfg.terrain.portals && cfg.terrain.portals.indexOf(a) >= 0)) return null;
      if (id === 'boulder') n.boulders.push(a); else { n.bombs.push(a); pass = true; }
    } else if (id === 'hammer') {
      if (!isRock(cfg, a, s)) return null;
      var bi = n.boulders.indexOf(a);
      if (bi >= 0) n.boulders.splice(bi, 1); else n.rocks.push(a);
    } else if (id === 'snow') {
      var si = n.bombs.indexOf(a);
      if (si < 0) return null;
      n.bombs.splice(si, 1);
    } else if (id === 'teleporter') {
      var pa = n.board[a], pb = n.board[b2];
      if (a === b2 || !pa || !pb || colorOf(pa) !== c || colorOf(pb) !== c || s.gold.indexOf(a) >= 0 || s.gold.indexOf(b2) >= 0) return null;
      n.board[a] = pb; n.board[b2] = pa; pass = true;
    } else return null;
    if (pass) n = play(n, { from: -1, to: -1, piece: '', cap: '', capSq: -1, pass: true }, cfg);
    else ouItemUsed(n, cfg, c);
    n.fx = null;
    return n;
  }
  function posKey(s) {
    use(s);
    return boardFen(s.board) + s.turn + s.castling + s.ep + '|' + s.gold.join(',') + '|' +
      s.pocket.slice().sort().join('') + '/' + s.pocket2.slice().sort().join('') + '|' + s.movesLeft + '|' + s.ice.join(',') + '|' + s.turned + (s.dice ? '|' + s.dice.join('') : '') +
      (s.fairy ? '|' + s.again + s.lastW + s.lastB + (s.rocks && s.rocks.length ? s.rocks.join(',') : '') : '') +
      ((s.ghosts && s.ghosts.length) || (s.snipers && s.snipers.length) ? '|g' + s.ghosts.join(',') + '|s' + s.snipers.join(',') : '') +
      (s.reborn && s.reborn.length ? '|r' + s.reborn.join(',') : '') +
      ((s.guard && s.guard.length) || s.shieldUsed || s.passed ? '|S' + (s.guard || []).join(',') + (s.shieldUsed ? '!' : '') + '|T' + (s.passed || '') : '') +
      ((s.helmets && s.helmets.length) || (s.vests && s.vests.length) || (s.stun && s.stun.length) ? '|h' + (s.helmets || []).join(',') + '|v' + (s.vests || []).join(',') + '|u' + (s.stun || []).join(',') : '') +
      ((s.ducks && s.ducks.length) || (s.bducks && s.bducks.length) || s.duckHand ? '|d' + s.ducks.join(',') + '/' + s.bducks.join(',') + '/' + (s.duckHand || 0) + '/' + (s.duckPhase ? s.dTodo.join(',') : '-') + '/' + (s.bMoved || []).join(',') : '') +
      (s.sleep && s.sleep.length ? '|z' + s.sleep.join(',') : '') + (s.fresh && s.fresh.length ? '|f' + s.fresh.join(',') : '') +
      (s.sg ? '|g' + JSON.stringify(s.sg) + JSON.stringify(s.dmg) : '') +
      ((s.bombs && s.bombs.length) || (s.boulders && s.boulders.length) ? '|B' + (s.bombs || []).join(',') + '/' + (s.boulders || []).join(',') : '') +
      (s.bottle || s.knife || s.boomer || s.glide || s.ouLock >= 0 ? '|I' + s.bottle + (s.knife ? 1 : 0) + (s.boomer ? 1 : 0) + (s.glide ? 1 : 0) + s.ouLock : '') + (s.ouTurns ? '|t' + (s.ouTurns % 3) : '') +
      (s.ouDone || s.ouSafe || s.ouBoots ? '|o' + (s.ouDone || '') + '/' + (s.ouSafe || '') + '/' + (s.ouBoots || '') : '');
  }

  function uci(m) { return sqName(m.from) + sqName(m.to) + (m.promo || ''); }

  function findUci(legal, str) {
    for (var i = 0; i < legal.length; i++) {
      var m = legal[i];
      if (!m.drop && !m.snipe && !m.storm && !m.swap && uci(m) === str) return m;
    }
    return null;
  }

  // Notation. Standard SAN, plus: B*e5 sniper shot, N@e5 drop, >d7 portal exit, ^ blast.
  function san(s, m, cfg, legal, after) {
    use(s);
    legal = legal || legalMoves(s, cfg);
    after = after || play(s, m, cfg);
    var out, t = typeOf(m.piece), dest = sqName(m.to);
    if (s.checkers && !m.stay) return sqName(m.from) + (m.cap ? 'x' : '-') + dest; // the game of Checkers: c3-d4, d4xb6
    if (m.duck) return (m.duck === 'b' ? 'Blue duck ' : 'Duck ') + (m.from >= 0 ? sqName(m.from) + '-' : '@') + dest; // Duck d5-e3, Duck @e3 from the hand
    if (m.spawn) return FAIRY[typeOf(m.piece)].san + '&' + dest; // a devil spawns a demon: Dv&e4
    if (m.shot) return 'SK*' + dest; // the Shotgun King shoots at e5
    if (m.blast) { var bt = typeOf(m.piece); return (FAIRY.hasOwnProperty(bt) ? FAIRY[bt].san : bt === 'p' ? '' : bt.toUpperCase()) + '\u2738' + dest; } // the vest goes up: N✸d4
    if (m.reload) return 'SK reload';
    if (m.pass) out = '--';
    else if (m.storm) out = 'Storm';
    else if (m.swap) out = (FAIRY.hasOwnProperty(t) ? FAIRY[t].san : 'K') + '~' + dest;
    else if (m.stay) out = (FAIRY.hasOwnProperty(t) ? FAIRY[t].san : t.toUpperCase()) + ' stays';
    else if (m.castle) out = m.castle === 'K' ? 'O-O' : 'O-O-O';
    else if (m.drop) out = (FAIRY.hasOwnProperty(m.drop) ? FAIRY[m.drop].san : m.drop.toUpperCase()) + '@' + dest;
    else {
      var dis = '';
      if (t !== 'p') {
        var sameFile = false, sameRank = false, clash = false;
        for (var i = 0; i < legal.length; i++) {
          var o = legal[i];
          if (o === m || o.drop || o.from === m.from || o.to !== m.to || o.piece !== m.piece || !!o.snipe !== !!m.snipe) continue;
          clash = true;
          if (COL[o.from] === COL[m.from]) sameFile = true;
          if (ROW[o.from] === ROW[m.from]) sameRank = true;
        }
        if (clash) dis = !sameFile ? sqName(m.from)[0] : (!sameRank ? sqName(m.from)[1] : sqName(m.from));
      }
      var letter = FAIRY.hasOwnProperty(t) ? FAIRY[t].san : t.toUpperCase();
      if (m.snipe) out = (t === 'p' ? sqName(m.from)[0] : letter + dis) + '*' + dest;
      else if (t === 'p') out = (m.cap ? sqName(m.from)[0] + 'x' : '') + dest + (m.promo ? '=' + m.promo.toUpperCase() : '');
      else out = letter + dis + (m.cap ? 'x' : '') + dest + (m.promo === '+' && FAIRY.hasOwnProperty(t) && FAIRY[t].shogiUp ? '=' + FAIRY[FAIRY[t].shogiUp].san : '');
    }
    if (after.fx && after.fx.boom && !m.blast) out += '^';
    if (after.fx && after.fx.bounce >= 0) out += '\u26d1'; // bounced off a helmet: Bxe5⛑
    if (after.fx && after.fx.tp >= 0) out += '>' + sqName(after.fx.tp);
    if (m.rock) out += '!';
    var enemy = other(s.turn);
    if (after.lost && after.lost.indexOf(enemy) >= 0) return out + '#';
    if (inCheck(after, enemy, cfg)) {
      var probe = after;
      if (after.turn !== enemy) { probe = {}; for (var k in after) probe[k] = after[k]; probe.turn = enemy; }
      out += legalMoves(probe, cfg).length ? '+' : '#';
    }
    return out;
  }

  // Problems that make a position unplayable (also unplayable for Stockfish).
  function validate(s, cfg) {
    use(s);
    cfg = cfg || NO_POWERS;
    var errs = [], wk = 0, bk = 0, count = 0;
    for (var i = 0; i < N; i++) {
      var p = s.board[i];
      if (!p) continue;
      count++;
      if (p === 'K' || p === 'Ѣ') wk++; // the Shogi King is its side's king like any other
      if (p === 'k' || p === 'ѣ') bk++;
      if ((p === 'P' || p === 'p') && (ROW[i] === 0 || ROW[i] === H - 1)) {
        if (errs.indexOf('Pawns cannot stand on the first or last rank.') < 0) errs.push('Pawns cannot stand on the first or last rank.');
      }
    }
    // one king each, or an upgraded king (mounted king, general) in its place
    if (s.kingless) ['w', 'b'].forEach(function (c) { if (wiped(s, c)) errs.push((c === 'w' ? 'White' : 'Black') + ' has no pieces.'); });
    if (s.kingless && !cfg.freeArmy && !s.checkers) errs.push('Stockfish 19 needs a king on each side. Pick Fairy-Stockfish as the opponent: a side without a king is played by the app\'s own search and loses when all its pieces are taken.');
    var sgk = { w: 0, b: 0 };
    for (var si2 = 0; si2 < N; si2++) if (s.board[si2] && DEF[s.board[si2]] && DEF[s.board[si2]].shotgun) sgk[colorOf(s.board[si2])]++;
    if (sgk.w > 1 || sgk.b > 1) errs.push('Each side can have only one Shotgun King.');
    if ((sgk.w && wk) || (sgk.b && bk)) errs.push('A Shotgun King is its side\'s king: take the normal king off the board.');
    if (wk > 1 || (!wk && !royalAlive(s, 'w'))) errs.push('White needs exactly one king (a Shogi King counts as one; or a mounted king or general instead).');
    if (bk > 1 || (!bk && !royalAlive(s, 'b'))) errs.push('Black needs exactly one king (a Shogi King counts as one; or a mounted king or general instead).');
    // Stockfish 19 refuses these positions. Fairy-Stockfish does not care (cfg.freeArmy).
    if (!cfg.freeArmy) {
      if (count > 32) errs.push('Stockfish 19 accepts at most 32 pieces. Pick Fairy-Stockfish as the opponent to play this position.');
      ['w', 'b'].forEach(function (c) {
        if (armyRoom(s.board, c).room < 0) {
          errs.push((c === 'w' ? 'White' : 'Black') + ' has an army Stockfish 19 refuses (more than 8 pawns, or extra pieces without missing pawns). Pick Fairy-Stockfish as the opponent to play this position.');
        }
      });
    }
    if (!errs.length) {
      if (!cfg.kingCapture && inCheck(s, other(s.turn), NO_POWERS)) errs.push('The side that is not to move is in check.');
      else if (!(cfg.dice && !cfg.legacyDice ? legalAll(s, cfg) : legalMoves(s, cfg)).length) errs.push('The side to move has no legal moves.'); // Dice Chess: before the throw, any move counts
    }
    return errs;
  }

  function perft(s, depth, cfg) {
    use(s);
    cfg = cfg || NO_POWERS;
    var ms = legalMoves(s, cfg);
    if (depth <= 1) return ms.length;
    var n = 0;
    for (var i = 0; i < ms.length; i++) n += perft(play(s, ms[i], cfg), depth - 1, cfg);
    return n;
  }

  var api = {
    START_FEN: START_FEN, MAXW: MAXW, use: use, size: function () { return { W: W, H: H }; }, sqName: sqName, sqIndex: sqIndex, colorOf: colorOf, typeOf: typeOf, other: other,
    fromFen: fromFen, toFen: toFen, boardFen: boardFen, cleanCastling: cleanCastling,
    attacked: attacked, inCheck: inCheck, kingSq: kingSq, royalAlive: royalAlive, wiped: wiped, pellets: pellets, mulberry: mulberry, hpOf: hpOf, SG: SG, shotResult: shotResult, hasRoyal: hasRoyal, duckAt: duckAt, duckDue: duckDue, duckSquares: duckSquares, demonNext: demonNext, demonHits: demonHits, asleep: asleep, isGhostAt: isG, isSniperAt: isS, royalSquares: royalSquares, checkedSquares: checkedSquares, isRoyal: isRoyal, ability: ability, stiff: stiff, guarded: guarded, atomsFor: atomsFor,
    ouItem: ouItem, ouItemUsed: ouItemUsed, ouFinisher: ouFinisher, ouFinisherOn: ouFinisherOn, ouRelicStep: ouRelicStep, ouTurnRelics: ouTurnRelics, ouTurnOn: ouTurnOn, bombAt: bombAt, isRock: isRock, shogiZone: shogiZone, SHOGI_BASE: SHOGI_BASE,     legalMoves: legalMoves, anyLegal: anyLegal, noisyMoves: noisyMoves, FAIRY: FAIRY, FAIRY_LETTERS: FAIRY_LETTERS, isFairy: isFairy, fairyOf: fairyOf, hasFairy: hasFairy, fairyAttacks: fairyAttacks, isWall: isWall, isWater: isWater, play: play, gildTargets: gildTargets, gild: gild, midasTurn: midasTurn, freezeTargets: freezeTargets, freeze: freeze, shieldTargets: shieldTargets, shield: shield, stopReady: stopReady, timeStop: timeStop, has: has, pocketKey: pocketKey, powersOf: powersOf, anyPower: anyPower, KEYS: KEYS,
    isRock: isRock, isHole: isHole, convertTargets: convertTargets, convert: convert, legalAll: legalAll, dieOf: dieOf, diceMost: diceMost, dicePool: dicePool, rollFaces: rollFaces, roll: roll, diceChance: diceChance, diceCount: diceCount, pseudoMoves: pseudoMoves,
    status: status, hasPowers: hasPowers, posKey: posKey, uci: uci, findUci: findUci, san: san,
    validate: validate, perft: perft, armyRoom: armyRoom, canDrop: canDrop
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Rules = api;
})(typeof self !== 'undefined' ? self : this);
