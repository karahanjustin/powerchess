/* Hexagonal Chess (Gliński, 1936): rules and an engine, without any page code, so it runs in node
   (tools/tests/hex_*.js), in the page and in the search worker.

   The board: 91 hexagons in 11 files a to l (there is no j), standing vertically. File f in the middle has
   11 cells, the files to its sides one fewer each (a and l have 6). Cells are named by file and rank, the
   rank counted from the bottom of each file (f1 is the lowest cell, f11 the highest). Three colours.

   Inside, a cell is (q, r) in axial coordinates: q = file - f (-5..5), r so that the six neighbours are
   always the same steps: up (0,1), up-right (1,0), down-right (1,-1), down (0,-1), down-left (-1,0),
   up-left (-1,1). For a file right of f (q >= 0) r is the rank, for one to its left r = rank - q.

   The rules: rooks slide orthogonally (6 directions), bishops diagonally (6, between two orthogonal ones, so
   a bishop keeps its colour), the queen both, the king one step in any of the 12, the knight two cells
   orthogonally and one at 60 degrees (12 targets, a leap). A pawn moves one cell straight ahead, two from
   any starting cell of a pawn of its colour, and takes one cell orthogonally forward at 60 degrees, en
   passant included; it promotes at the end of its file. There is no castling. Checkmate wins; stalemate
   counts as a win for the side that delivers it (3/4 of a point in tournaments); threefold repetition and
   the 50 move rule draw. */
(function (root) {
  'use strict';
  var FILES = 'abcdefghikl', N = 91;
  var ORTH = [[0, 1], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1]];
  var DIAG = [[1, 1], [2, -1], [1, -2], [-1, -1], [-2, 1], [-1, 2]];
  var KNI = [];
  for (var oi = 0; oi < 6; oi++) {
    [5, 1].forEach(function (k) { var a = ORTH[oi], b = ORTH[(oi + k) % 6]; KNI.push([2 * a[0] + b[0], 2 * a[1] + b[1]]); });
  }

  /* ---------- the cells ---------- */
  var CELLS = [], AT = {};
  for (var fx = 0; fx < 11; fx++) {
    var q = fx - 5, len = 11 - Math.abs(q);
    for (var n = 1; n <= len; n++) {
      var r = q >= 0 ? n : n - q;
      var c = { i: CELLS.length, q: q, r: r, file: fx, rank: n, name: FILES[fx] + n, color: (((q + 2 * r) % 3) + 3) % 3, top: n === len };
      AT[q + ',' + r] = c.i;
      CELLS.push(c);
    }
  }
  function cellAt(q, r) { var i = AT[q + ',' + r]; return i === undefined ? -1 : i; }
  function index(name) { for (var i = 0; i < N; i++) if (CELLS[i].name === name) return i; return -1; }
  function step(i, d) { return cellAt(CELLS[i].q + d[0], CELLS[i].r + d[1]); }
  // rays and leaps from every cell, worked out once
  var RAY_O = [], RAY_D = [], KNT = [], KNG = [];
  for (var ci = 0; ci < N; ci++) {
    RAY_O.push(ORTH.map(function (d) { var out = [], j = ci; for (;;) { j = step(j, d); if (j < 0) break; out.push(j); } return out; }));
    RAY_D.push(DIAG.map(function (d) { var out = [], j = ci; for (;;) { j = step(j, d); if (j < 0) break; out.push(j); } return out; }));
    KNT.push(KNI.map(function (d) { return step(ci, d); }).filter(function (j) { return j >= 0; }));
    KNG.push(ORTH.concat(DIAG).map(function (d) { return step(ci, d); }).filter(function (j) { return j >= 0; }));
  }
  // pawns: forward and the two capture steps, per colour (0 white, 1 black)
  var PFWD = [ORTH[0], ORTH[3]], PCAP = [[ORTH[1], ORTH[5]], [ORTH[2], ORTH[4]]];
  var P_STEP = [[], []], P_CAPS = [[], []], P_FROM = [[], []]; // P_FROM: the cells a pawn could have taken from onto this one
  for (ci = 0; ci < N; ci++) {
    for (var s0 = 0; s0 < 2; s0++) {
      P_STEP[s0].push(step(ci, PFWD[s0]));
      P_CAPS[s0].push(PCAP[s0].map(function (d) { return step(ci, d); }).filter(function (j) { return j >= 0; }));
      P_FROM[s0].push(PCAP[s0].map(function (d) { return step(ci, [-d[0], -d[1]]); }).filter(function (j) { return j >= 0; }));
    }
  }
  var START_PAWNS = { w: ['b1', 'c2', 'd3', 'e4', 'f5', 'g4', 'h3', 'i2', 'k1'].map(index), b: ['b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7', 'i7', 'k7'].map(index) };
  var PSTART = [new Uint8Array(N), new Uint8Array(N)];
  START_PAWNS.w.forEach(function (i) { PSTART[0][i] = 1; });
  START_PAWNS.b.forEach(function (i) { PSTART[1][i] = 1; });
  var CENTER = index('f6');
  function hexDist(a, b) { var dq = CELLS[a].q - CELLS[b].q, dr = CELLS[a].r - CELLS[b].r; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2; }

  /* ---------- positions (letters, as the page wants them) ---------- */
  var START = {
    w: { K: ['g1'], Q: ['e1'], R: ['c1', 'i1'], B: ['f1', 'f2', 'f3'], N: ['d1', 'h1'], P: ['b1', 'c2', 'd3', 'e4', 'f5', 'g4', 'h3', 'i2', 'k1'] },
    b: { k: ['g10'], q: ['e10'], r: ['c8', 'i8'], b: ['f11', 'f10', 'f9'], n: ['d9', 'h9'], p: ['b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7', 'i7', 'k7'] }
  };
  // what the page expects every position to carry (the square rules' power-up fields), empty here
  function EMPTY() { return { W: 11, H: 11, gold: [], ice: [], portals: [], pocket: [], pocket2: [], ghosts: [], snipers: [], reborn: [], rocks: [], dice: null, rolled: null, again: -1, movesLeft: 0, midasUsed: 0, freezeUsed: false, stopUsed: '', turned: '', castling: '' }; }
  function colorOf(p) { return p ? (p === p.toUpperCase() ? 'w' : 'b') : ''; }
  function other(c) { return c === 'w' ? 'b' : 'w'; }
  function initial() {
    var board = []; for (var i = 0; i < N; i++) board.push('');
    ['w', 'b'].forEach(function (c) { var set = START[c]; Object.keys(set).forEach(function (p) { set[p].forEach(function (nm) { board[index(nm)] = p; }); }); });
    return Object.assign({ hex: true, board: board, turn: 'w', ep: -1, epVictim: -1, half: 0, full: 1, fx: null }, EMPTY());
  }
  /* A hex FEN: the files a to l separated by '/', each from rank 1 upwards, digits for empty cells, then the side
     to move, the en passant cell (or -), the half-move clock and the move number. */
  function toFen(s) {
    var files = [];
    for (var f = 0; f < 11; f++) {
      var out = '', gap = 0;
      CELLS.forEach(function (c) { if (c.file !== f) return; var p = s.board[c.i]; if (p) { if (gap) out += gap; gap = 0; out += p; } else gap++; });
      if (gap) out += gap;
      files.push(out);
    }
    return files.join('/') + ' ' + s.turn + ' ' + (s.ep >= 0 ? CELLS[s.ep].name : '-') + ' ' + s.half + ' ' + s.full;
  }
  function fromFen(fen) {
    var parts = String(fen).trim().split(/\s+/), files = parts[0].split('/'), s = initial();
    if (files.length !== 11) throw new Error('A hex position needs 11 files');
    for (var i = 0; i < N; i++) s.board[i] = '';
    files.forEach(function (str, f) {
      var cells = CELLS.filter(function (c) { return c.file === f; }), k = 0, num = '';
      for (var j = 0; j < str.length; j++) {
        var ch = str[j];
        if (ch >= '0' && ch <= '9') { num += ch; continue; }
        if (num) { k += +num; num = ''; }
        if (!/[pnbrqkPNBRQK]/.test(ch)) throw new Error('Unknown piece ' + ch);
        if (k >= cells.length) throw new Error('File ' + FILES[f] + ' is too long');
        s.board[cells[k++].i] = ch;
      }
    });
    s.turn = parts[1] === 'b' ? 'b' : 'w';
    s.ep = parts[2] && parts[2] !== '-' ? index(parts[2]) : -1;
    s.epVictim = s.ep >= 0 ? step(s.ep, PFWD[s.turn === 'w' ? 1 : 0]) : -1; // the pawn that just jumped stands one further on
    s.half = parseInt(parts[3], 10) || 0;
    s.full = parseInt(parts[4], 10) || 1;
    return s;
  }

  /* ---------- the rules on letters (the page) ---------- */
  var VAL_L = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  function attackedL(board, sq, by) {
    var w = by === 'w', P = w ? 'P' : 'p', N_ = w ? 'N' : 'n', B = w ? 'B' : 'b', R_ = w ? 'R' : 'r', Q = w ? 'Q' : 'q', K = w ? 'K' : 'k', i, j, ray, x;
    var from = P_FROM[w ? 0 : 1][sq];
    for (i = 0; i < from.length; i++) if (board[from[i]] === P) return true;
    for (i = 0; i < KNT[sq].length; i++) if (board[KNT[sq][i]] === N_) return true;
    for (i = 0; i < KNG[sq].length; i++) if (board[KNG[sq][i]] === K) return true;
    for (i = 0; i < 6; i++) {
      ray = RAY_O[sq][i];
      for (j = 0; j < ray.length; j++) { x = board[ray[j]]; if (x) { if (x === R_ || x === Q) return true; break; } }
      ray = RAY_D[sq][i];
      for (j = 0; j < ray.length; j++) { x = board[ray[j]]; if (x) { if (x === B || x === Q) return true; break; } }
    }
    return false;
  }
  function kingAt(board, c) { var k = c === 'w' ? 'K' : 'k'; return board.indexOf(k); }
  function inCheck(s, c) { var k = kingAt(s.board, c); return k >= 0 && attackedL(s.board, k, other(c)); }
  function pseudo(s) {
    var out = [], c = s.turn, ci = c === 'w' ? 0 : 1, b = s.board, i, j, k, p, t, to, ray;
    var push = function (from, to2, extra) { var m = { from: from, to: to2, piece: b[from], cap: b[to2] || '', capSq: b[to2] ? to2 : -1 }; if (extra) for (var key in extra) m[key] = extra[key]; out.push(m); };
    var promos = function (from, to2) { ['q', 'r', 'b', 'n'].forEach(function (x) { push(from, to2, { promo: x }); }); };
    for (i = 0; i < N; i++) {
      p = b[i];
      if (!p || colorOf(p) !== c) continue;
      t = p.toLowerCase();
      if (t === 'p') {
        to = P_STEP[ci][i];
        if (to >= 0 && !b[to]) {
          if (CELLS[to].top && ci === 0 || ci === 1 && CELLS[to].rank === 1) promos(i, to); else push(i, to);
          var to2 = P_STEP[ci][to];
          if (PSTART[ci][i] && to2 >= 0 && !b[to2]) push(i, to2, { dbl: true });
        }
        for (j = 0; j < P_CAPS[ci][i].length; j++) {
          to = P_CAPS[ci][i][j];
          var x = b[to];
          if (x && colorOf(x) !== c) { if (CELLS[to].top && ci === 0 || ci === 1 && CELLS[to].rank === 1) promos(i, to); else push(i, to); }
          else if (!x && to === s.ep && s.epVictim >= 0) out.push({ from: i, to: to, piece: p, cap: b[s.epVictim], capSq: s.epVictim, ep: true });
        }
      } else if (t === 'n' || t === 'k') {
        var tg = t === 'n' ? KNT[i] : KNG[i];
        for (j = 0; j < tg.length; j++) { to = tg[j]; if (!b[to] || colorOf(b[to]) !== c) push(i, to); }
      } else {
        var sets = t === 'r' ? [RAY_O] : t === 'b' ? [RAY_D] : [RAY_O, RAY_D];
        for (k = 0; k < sets.length; k++) for (j = 0; j < 6; j++) {
          ray = sets[k][i][j];
          for (var z = 0; z < ray.length; z++) { to = ray[z]; if (!b[to]) push(i, to); else { if (colorOf(b[to]) !== c) push(i, to); break; } }
        }
      }
    }
    return out;
  }
  function play(s, m) {
    var b = s.board.slice(), c = s.turn, removed = [];
    if (m.capSq >= 0) { removed.push({ sq: m.capSq, p: b[m.capSq] }); b[m.capSq] = ''; }
    b[m.to] = m.promo ? (c === 'w' ? m.promo.toUpperCase() : m.promo) : b[m.from];
    b[m.from] = '';
    var pawn = m.piece.toLowerCase() === 'p';
    var n = Object.assign({ hex: true, board: b, turn: other(c), ep: -1, epVictim: -1, half: pawn || m.cap ? 0 : s.half + 1, full: s.full + (c === 'b' ? 1 : 0) }, EMPTY());
    if (m.dbl) { n.ep = P_STEP[c === 'w' ? 0 : 1][m.from]; n.epVictim = m.to; }
    n.fx = { removed: removed, tp: -1, anims: [{ from: m.from, to: m.to }], capture: !!m.cap, booms: [] };
    return n;
  }
  function legalMoves(s) {
    var c = s.turn;
    return pseudo(s).filter(function (m) { var n = play(s, m); return !inCheck(n, c); });
  }
  function status(s, legal) {
    legal = legal || legalMoves(s);
    if (!legal.length) return inCheck(s, s.turn) ? { over: true, result: other(s.turn), reason: 'checkmate' } : { over: true, result: other(s.turn), reason: 'stalemate' };
    if (s.half >= 100) return { over: true, result: 'draw', reason: 'the 50 move rule' };
    // too little to mate: kings alone, or a king and one knight or bishop
    var minor = 0, more = false;
    for (var i = 0; i < N; i++) { var p = s.board[i]; if (!p) continue; var t = p.toLowerCase(); if (t === 'k') continue; if (t === 'n' || t === 'b') minor++; else more = true; }
    if (!more && minor <= 1) return { over: true, result: 'draw', reason: 'insufficient material' };
    return { over: false };
  }
  function key(s) { return s.board.join(',') + s.turn + s.ep; }
  function uci(m) { return CELLS[m.from].name + CELLS[m.to].name + (m.promo || ''); }
  function find(legal, str) { for (var i = 0; i < legal.length; i++) if (uci(legal[i]) === str) return legal[i]; return null; }
  function san(s, m, legal, n) {
    var t = m.piece.toUpperCase(), out = '';
    if (t === 'P') out = (m.cap ? CELLS[m.from].name[0] + 'x' : '') + CELLS[m.to].name + (m.promo ? '=' + m.promo.toUpperCase() : '');
    else {
      out = t;
      var twins = (legal || []).filter(function (x) { return x !== m && x.to === m.to && x.piece === m.piece && x.from !== m.from; });
      if (twins.length) {
        var f = CELLS[m.from].name[0], sameF = twins.some(function (x) { return CELLS[x.from].name[0] === f; });
        out += sameF ? CELLS[m.from].name : f;
      }
      out += (m.cap ? 'x' : '') + CELLS[m.to].name;
    }
    n = n || play(s, m);
    if (inCheck(n, n.turn)) out += legalMoves(n).length ? '+' : '#';
    return out;
  }

  /* ---------- the engine ---------- */
  // pieces as numbers: 1 pawn .. 6 king, black negative
  var CODE = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 }, LET = ['', 'p', 'n', 'b', 'r', 'q', 'k'];
  var VAL = [0, 100, 290, 320, 500, 900, 0];
  var MATE = 100000, INF = 1e9;
  // where a piece likes to stand: near the middle (minor pieces, queen), pawns further up, the king back home
  var PST = [];
  (function () {
    for (var t = 0; t <= 6; t++) {
      var w = new Int16Array(N), bl = new Int16Array(N);
      for (var i = 0; i < N; i++) {
        var d = hexDist(i, CENTER), up = CELLS[i].rank, len = 11 - Math.abs(CELLS[i].q), v = 0;
        if (t === 2) v = (5 - d) * 9;
        else if (t === 3) v = (5 - d) * 5;
        else if (t === 4) v = (5 - d) * 2;
        else if (t === 5) v = (5 - d) * 3;
        else if (t === 1) v = (up - 1) * 6 + (5 - d) * 2 + (CELLS[i].top ? 0 : 0);
        else if (t === 6) v = -(5 - d) * 6;
        w[i] = v;
        // black sees the board upside down: its cell with the same file and the rank counted from the top
        var mirror = 0, c2 = CELLS[i];
        for (var j = 0; j < N; j++) if (CELLS[j].file === c2.file && CELLS[j].rank === len + 1 - c2.rank) { mirror = j; break; }
        bl[mirror] = v;
      }
      PST.push([w, bl]);
    }
  })();
  // hashing
  var Z1 = new Int32Array(13 * N + 2 + N), Z2 = new Int32Array(13 * N + 2 + N);
  (function () { var x = 0x2545F491; for (var i = 0; i < Z1.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; Z1[i] = x; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; Z2[i] = x; } })();
  var TT_BITS = 20, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  var tLock = null, tScore, tMove, tInfo;
  function ttInit() { if (tLock) return; tLock = new Int32Array(TT_SIZE); tScore = new Int32Array(TT_SIZE); tMove = new Int32Array(TT_SIZE); tInfo = new Int16Array(TT_SIZE); }
  var EXACT = 0, LOWER = 1, UPPER = 2;

  function Engine(s, opts) {
    this.b = new Int8Array(N);
    for (var i = 0; i < N; i++) { var p = s.board[i]; if (p) this.b[i] = (p === p.toUpperCase() ? 1 : -1) * CODE[p.toLowerCase()]; }
    this.side = s.turn === 'w' ? 1 : -1;
    this.ep = s.ep; this.epV = s.epVictim; this.half = s.half;
    this.h1 = 0; this.h2 = 0;
    for (i = 0; i < N; i++) if (this.b[i]) { var z = (this.b[i] + 6) * N + i; this.h1 ^= Z1[z]; this.h2 ^= Z2[z]; }
    if (this.side < 0) { this.h1 ^= Z1[13 * N]; this.h2 ^= Z2[13 * N]; }
    this.deadline = Date.now() + (opts.ms || 1000);
    this.nodes = 0; this.stopped = false;
    this.killers = new Int32Array(256);
    this.hist = new Int32Array(13 * N);
    this.stack = []; this.keys = []; // position keys along the line, for repetitions
    this.seen = opts.seen || null;
    ttInit();
  }
  var E = Engine.prototype;
  E.timeUp = function () { if ((this.nodes & 1023) === 0 && Date.now() > this.deadline) this.stopped = true; return this.stopped; };
  E.attacked = function (sq, by) { // by = 1 white, -1 black
    var b = this.b, i, j, ray, x, from = P_FROM[by > 0 ? 0 : 1][sq];
    for (i = 0; i < from.length; i++) if (b[from[i]] === by) return true;
    var kn = KNT[sq]; for (i = 0; i < kn.length; i++) if (b[kn[i]] === 2 * by) return true;
    var kg = KNG[sq]; for (i = 0; i < kg.length; i++) if (b[kg[i]] === 6 * by) return true;
    for (i = 0; i < 6; i++) {
      ray = RAY_O[sq][i];
      for (j = 0; j < ray.length; j++) { x = b[ray[j]]; if (x) { if (x === 4 * by || x === 5 * by) return true; break; } }
      ray = RAY_D[sq][i];
      for (j = 0; j < ray.length; j++) { x = b[ray[j]]; if (x) { if (x === 3 * by || x === 5 * by) return true; break; } }
    }
    return false;
  };
  E.king = function (side) { var k = 6 * side, b = this.b; for (var i = 0; i < N; i++) if (b[i] === k) return i; return -1; };
  E.inCheck = function (side) { var k = this.king(side); return k >= 0 && this.attacked(k, -side); };
  // moves as numbers: from | to << 7 | promo << 14 | flags << 17 (1 double step, 2 en passant)
  E.gen = function (capsOnly) {
    var b = this.b, side = this.side, ci = side > 0 ? 0 : 1, out = [], i, j, k, p, t, to, ray, x;
    for (i = 0; i < N; i++) {
      p = b[i] * side;
      if (p <= 0) continue;
      if (p === 1) {
        to = P_STEP[ci][i];
        var promo = function (sq) { return ci === 0 ? CELLS[sq].top : CELLS[sq].rank === 1; };
        if (to >= 0 && !b[to]) {
          if (promo(to)) { out.push(i | to << 7 | 5 << 14); if (!capsOnly) { out.push(i | to << 7 | 2 << 14, i | to << 7 | 4 << 14, i | to << 7 | 3 << 14); } }
          else if (!capsOnly) {
            out.push(i | to << 7);
            var to2 = P_STEP[ci][to];
            if (PSTART[ci][i] && to2 >= 0 && !b[to2]) out.push(i | to2 << 7 | 1 << 17);
          }
        }
        var caps = P_CAPS[ci][i];
        for (j = 0; j < caps.length; j++) {
          to = caps[j]; x = b[to];
          if (x * side < 0) { if (promo(to)) { out.push(i | to << 7 | 5 << 14); if (!capsOnly) out.push(i | to << 7 | 2 << 14, i | to << 7 | 4 << 14, i | to << 7 | 3 << 14); } else out.push(i | to << 7); }
          else if (!x && to === this.ep && this.epV >= 0) out.push(i | to << 7 | 2 << 17);
        }
      } else if (p === 2 || p === 6) {
        var tg = p === 2 ? KNT[i] : KNG[i];
        for (j = 0; j < tg.length; j++) { to = tg[j]; x = b[to]; if (x * side < 0 || (!x && !capsOnly)) out.push(i | to << 7); }
      } else {
        for (k = 0; k < 2; k++) {
          if (k === 0 && p === 3) continue;
          if (k === 1 && p === 4) continue;
          var rays = k === 0 ? RAY_O[i] : RAY_D[i];
          for (j = 0; j < 6; j++) {
            ray = rays[j];
            for (var z = 0; z < ray.length; z++) { to = ray[z]; x = b[to]; if (!x) { if (!capsOnly) out.push(i | to << 7); } else { if (x * side < 0) out.push(i | to << 7); break; } }
          }
        }
      }
    }
    return out;
  };
  E.make = function (m) {
    var from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flags = m >> 17, b = this.b, side = this.side, p = b[from];
    var capSq = flags === 2 ? this.epV : to, cap = b[capSq];
    this.stack.push(m, cap, capSq, this.ep, this.epV, this.half, this.h1, this.h2);
    var z;
    if (cap) { z = (cap + 6) * N + capSq; this.h1 ^= Z1[z]; this.h2 ^= Z2[z]; b[capSq] = 0; }
    z = (p + 6) * N + from; this.h1 ^= Z1[z]; this.h2 ^= Z2[z];
    var np = promo ? promo * side : p;
    b[from] = 0; b[to] = np;
    z = (np + 6) * N + to; this.h1 ^= Z1[z]; this.h2 ^= Z2[z];
    if (this.ep >= 0) { this.h1 ^= Z1[13 * N + 1 + this.ep]; this.h2 ^= Z2[13 * N + 1 + this.ep]; }
    this.ep = -1; this.epV = -1;
    if (flags === 1) { this.ep = P_STEP[side > 0 ? 0 : 1][from]; this.epV = to; this.h1 ^= Z1[13 * N + 1 + this.ep]; this.h2 ^= Z2[13 * N + 1 + this.ep]; }
    this.half = (p === side || cap) ? 0 : this.half + 1;
    this.side = -side; this.h1 ^= Z1[13 * N]; this.h2 ^= Z2[13 * N];
    return cap;
  };
  E.unmake = function () {
    var st = this.stack, h2 = st.pop(), h1 = st.pop(), half = st.pop(), epV = st.pop(), ep = st.pop(), capSq = st.pop(), cap = st.pop(), m = st.pop();
    var from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, b = this.b;
    this.side = -this.side;
    b[from] = promo ? this.side : b[to];
    b[to] = 0;
    if (cap) b[capSq] = cap;
    this.ep = ep; this.epV = epV; this.half = half; this.h1 = h1; this.h2 = h2;
  };
  E.evaluate = function () { // from the side to move
    var b = this.b, v = 0, i, p, t;
    for (i = 0; i < N; i++) {
      p = b[i];
      if (!p) continue;
      if (p > 0) { t = p; v += VAL[t] + PST[t][0][i]; }
      else { t = -p; v -= VAL[t] + PST[t][1][i]; }
    }
    return v * this.side;
  };
  E.order = function (moves, ttm, ply) {
    var b = this.b, sc = new Int32Array(moves.length), i;
    for (i = 0; i < moves.length; i++) {
      var m = moves[i], from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, cap = b[to], o = 0;
      if (m === ttm) o = 1e9;
      else if (cap) o = 1e6 + VAL[Math.abs(cap)] * 10 - VAL[Math.abs(b[from])] / 10 + (Math.abs(cap) === 6 ? 1e7 : 0);
      else if (promo) o = 9e5 + promo;
      else if ((m >> 17) === 2) o = 1e6 + 1000;
      else if (m === this.killers[ply * 2]) o = 8e5;
      else if (m === this.killers[ply * 2 + 1]) o = 7e5;
      else o = this.hist[(b[from] + 6) * N + to];
      sc[i] = o;
    }
    var idx = moves.map(function (_, k) { return k; }).sort(function (x, y) { return sc[y] - sc[x]; });
    return idx.map(function (k) { return moves[k]; });
  };
  E.quiesce = function (alpha, beta, ply, qd) {
    this.nodes++;
    var stand = this.evaluate();
    if (qd > 8 || this.timeUp()) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    var moves = this.order(this.gen(true), 0, ply), side = this.side;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], to = (m >> 7) & 127, cap = this.b[to];
      if (cap && Math.abs(cap) === 6) return MATE - ply; // the king can be taken: the last move was illegal
      if (cap && stand + VAL[Math.abs(cap)] + 200 < alpha && !((m >> 14) & 7)) continue;
      this.make(m);
      if (this.inCheck(side)) { this.unmake(); continue; }
      var v = -this.quiesce(-beta, -alpha, ply + 1, qd + 1);
      this.unmake();
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  };
  E.repeated = function () {
    var k = this.h1 + ':' + this.h2;
    for (var i = this.keys.length - 2; i >= 0 && i >= this.keys.length - this.half - 1; i -= 2) if (this.keys[i] === k) return true;
    return !!(this.seen && this.seen[k] >= 1);
  };
  E.search = function (depth, alpha, beta, ply, canNull) {
    var side = this.side, inChk = this.inCheck(side);
    if (inChk) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply, 0);
    this.nodes++;
    if (this.timeUp()) return 0;
    if (ply > 0 && (this.half >= 100 || this.repeated())) return 0;
    var idx = this.h1 & TT_MASK, ttm = 0;
    if (tLock[idx] === this.h2) {
      ttm = tMove[idx];
      var info = tInfo[idx], td = info >> 2, tf = info & 3, tv = tScore[idx];
      if (td >= depth && ply > 0) {
        if (tv > MATE - 1000) tv -= ply; else if (tv < -MATE + 1000) tv += ply;
        if (tf === EXACT || (tf === LOWER && tv >= beta) || (tf === UPPER && tv <= alpha)) return tv;
      }
    }
    // null move: if passing already holds, a real move will too
    if (canNull && !inChk && depth >= 3 && beta < MATE - 1000 && this.material(side) > 0) {
      var stand = this.evaluate();
      if (stand >= beta) {
        var sEp = this.ep, sV = this.epV;
        this.side = -side; this.h1 ^= Z1[13 * N]; this.h2 ^= Z2[13 * N];
        if (sEp >= 0) { this.h1 ^= Z1[13 * N + 1 + sEp]; this.h2 ^= Z2[13 * N + 1 + sEp]; }
        this.ep = -1; this.epV = -1; this.keys.push('null');
        var nv = -this.search(depth - 3, -beta, -beta + 1, ply + 1, false);
        this.keys.pop();
        this.side = side; this.h1 ^= Z1[13 * N]; this.h2 ^= Z2[13 * N]; this.ep = sEp; this.epV = sV;
        if (sEp >= 0) { this.h1 ^= Z1[13 * N + 1 + sEp]; this.h2 ^= Z2[13 * N + 1 + sEp]; }
        if (this.stopped) return 0;
        if (nv >= beta) return nv;
      }
    }
    var moves = this.order(this.gen(false), ttm, ply), best = -INF, bestM = 0, a0 = alpha, count = 0;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], cap = this.make(m);
      if (this.inCheck(side)) { this.unmake(); continue; }
      count++;
      this.keys.push(this.h1 + ':' + this.h2);
      var v, quiet = !cap && !((m >> 14) & 7);
      if (count === 1) v = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        var red = quiet && !inChk && depth >= 3 && count > 3 ? (count > 10 ? 2 : 1) : 0;
        v = -this.search(depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (!this.stopped && v > alpha && (red || v < beta)) v = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
      }
      this.keys.pop();
      this.unmake();
      if (this.stopped) return 0;
      if (v > best) { best = v; bestM = m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (quiet) {
          if (this.killers[ply * 2] !== m) { this.killers[ply * 2 + 1] = this.killers[ply * 2]; this.killers[ply * 2] = m; }
          this.hist[(this.b[m & 127] + 6) * N + ((m >> 7) & 127)] += depth * depth;
        }
        break;
      }
    }
    // no move: checkmate, or stalemate, which also loses here (the side that stalemates scores)
    if (!count) return -MATE + ply + (inChk ? 0 : 50);
    var sv = best;
    if (sv > MATE - 1000) sv += ply; else if (sv < -MATE + 1000) sv -= ply;
    tLock[idx] = this.h2; tScore[idx] = sv; tMove[idx] = bestM; tInfo[idx] = (Math.min(depth, 4000) << 2) | (best <= a0 ? UPPER : best >= beta ? LOWER : EXACT);
    return best;
  };
  E.material = function (side) { var v = 0, b = this.b; for (var i = 0; i < N; i++) { var p = b[i] * side; if (p > 1 && p < 6) v += VAL[p]; } return v; };
  // the move as the page has it
  function toMove(s, m) {
    var from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flags = m >> 17, out = { from: from, to: to, piece: s.board[from], cap: s.board[to] || '', capSq: s.board[to] ? to : -1 };
    if (promo) out.promo = LET[promo];
    if (flags === 1) out.dbl = true;
    if (flags === 2) { out.ep = true; out.cap = s.board[s.epVictim]; out.capSq = s.epVictim; }
    return out;
  }
  // the same key the page uses for every move (app.js moveKey): 'n:from:to:promo'
  function moveKey(m) { return 'n:' + m.from + ':' + m.to + ':' + (m.promo || ''); }

  /* Think about a position: every root move with a score from the mover's point of view, best first, the way
     brain.js answers (scores exact within `margin` of the best, upper bounds below). opts = { ms, maxDepth,
     margin, allow: [keys], seen: { key: count } }. */
  function think(s, opts) {
    opts = opts || {};
    var en = new Engine(s, opts), margin = opts.margin == null ? 40 : opts.margin, side = en.side;
    var legal = en.gen(false).filter(function (m) { en.make(m); var ok = !en.inCheck(side); en.unmake(); return ok; });
    var root = legal.map(function (m) { var pm = toMove(s, m); return { m: m, key: moveKey(pm), v: 0 }; });
    if (opts.allow) root = root.filter(function (a) { return opts.allow.indexOf(a.key) >= 0; });
    var result = { depth: 0, nodes: 0, score: 0, actions: root.map(function (a) { return { key: a.key, score: 0 }; }), trail: [], hex: true };
    if (!root.length) return result;
    var maxDepth = opts.maxDepth || 64;
    for (var depth = 1; depth <= maxDepth; depth++) {
      var best = -INF, done = true;
      var order = en.order(root.map(function (a) { return a.m; }), root[0].m, 0);
      root.sort(function (x, y) { return order.indexOf(x.m) - order.indexOf(y.m); });
      for (var i = 0; i < root.length; i++) {
        var a = root[i], v;
        en.make(a.m); en.keys.push(en.h1 + ':' + en.h2);
        if (i === 0) v = -en.search(depth - 1, -INF, INF, 1, true);
        else {
          var lo = best - margin;
          v = -en.search(depth - 1, -lo - 1, -lo, 1, true);
          if (!en.stopped && v > lo) v = -en.search(depth - 1, -INF, -lo, 1, true);
        }
        en.keys.pop(); en.unmake();
        if (en.stopped) { done = false; break; }
        a.v = v;
        if (v > best) best = v;
      }
      if (!done && depth > 1) break;
      root.sort(function (x, y) { return y.v - x.v; });
      result.depth = depth; result.score = root[0].v; result.trail.push(root[0].v);
      result.actions = root.map(function (x) { return { key: x.key, score: Math.round(x.v) }; });
      if (en.stopped || Math.abs(root[0].v) > MATE - 1000) break;
    }
    result.nodes = en.nodes;
    return result;
  }
  function perft(s, d) { if (!d) return 1; var lg = legalMoves(s), n = 0; for (var i = 0; i < lg.length; i++) n += perft(play(s, lg[i]), d - 1); return n; }

  var api = {
    N: N, CELLS: CELLS, FILES: FILES, ORTH: ORTH, DIAG: DIAG, KNI: KNI, START_PAWNS: START_PAWNS, index: index, cellAt: cellAt, step: step, hexDist: hexDist,
    initial: initial, toFen: toFen, fromFen: fromFen, legalMoves: legalMoves, pseudo: pseudo, play: play, status: status, inCheck: inCheck, attacked: attackedL,
    key: key, uci: uci, find: find, san: san, think: think, moveKey: moveKey, perft: perft, MATE: MATE, colorOf: colorOf, VAL: VAL_L
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Hex = api;
})(typeof self !== 'undefined' ? self : this);
