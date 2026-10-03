/* Drawback Chess: chess with a hidden drawback for each side, after drawbackchess.com.

   The game is king capture on the normal board. There is no check and no mate: a side loses when its king is
   taken, when its drawback says so, or when its drawback leaves it no legal move. A king may castle out of and
   through check; on the very next move it can then be taken en passant, by any move to the square it left or
   the square it passed (where the rook lands).

   This module is the rules of the drawbacks, without any page code, so it runs in node (tools/tests), in the
   page and in the search worker. A drawback is an object in the registry:

     { id, name, text,                       the name and the rule as the player reads it
       setup(rng) -> params,                 random parts fixed at the start of a game (a square, a rank, ...)
       textOf(params) -> string,             the rule with those parts filled in (else text)
       filter(ctx, moves) -> moves,          the moves the drawback allows (moves are rules.js moves)
       lose(ctx) -> true,                    the owner loses now (asked after every move, either side's)
       status(ctx, moves) -> string,         optional: what the rule asks for this very turn
       after(ctx, m, n) -> mem,              optional: after an own move m (n = the new position, its board may be
                                             changed in place), the drawback's memory from now on (ctx.mem before)
       start(s, me, params),                 optional: changes the start position (s.board) for its owner
       score(ctx) -> centipawns,             optional: progress towards a goal the drawback sets (for its owner), so the
                                             bot heads for it before the search can see the deadline
       turnRandom / engine: true }           a rule that changes every turn or asks an engine: the search
                                             cannot see ahead, so it only applies to real moves (ctx.hypo false)

   ctx: s (the position, side to move = the owner when filtering), me, foe, params, seed, hypo, cfg, and the
   history: hist (all moves so far, oldest first), last, myLast, foeLast, myMoves (own moves made so far),
   moveNo (the number of the own move about to be made, from 1). A history entry:
     { by, p (the piece letter), from, to, cap (taken letter or ''), capSq, promo, castle, pass, n (ply), chk }
   chk: after the move the other side's king stood attacked.

   Terms (as on drawbackchess.com): a piece is any piece including pawns and the king unless the rule says
   otherwise; value: pawn 1, knight 3, bishop 3, rook 5, queen 9, king 100; distance: king steps between two
   squares; adjacent: one king step away; the rim: the outer squares; ranks are counted from the owner's side
   (rank 1 is the owner's home rank). Capturing the king is never forbidden by a capture rule unless the rule is
   about the king itself. */
(function (root) {
  'use strict';
  var R = root.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);

  var LIST = [], BY = {};
  function register(list) { list.forEach(function (d) { if (BY[d.id]) throw new Error('drawback ' + d.id + ' twice'); BY[d.id] = d; LIST.push(d); }); }

  /* ---------- small helpers (8x8 board, square 0 = a8, 63 = h1) ---------- */
  var VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  var NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  function type(p) { return p ? p.toLowerCase() : ''; }
  function colorOf(p) { return p ? (p === p.toUpperCase() ? 'w' : 'b') : ''; }
  function val(p) { return VAL[type(p)] || 0; }
  function row(q) { return q >> 3; }
  function col(q) { return q & 7; }
  function dist(a, b) { return Math.max(Math.abs(row(a) - row(b)), Math.abs(col(a) - col(b))); }
  function adj(a, b) { return a !== b && dist(a, b) === 1; }
  function rim(q) { return row(q) === 0 || row(q) === 7 || col(q) === 0 || col(q) === 7; }
  function rankOf(q, me) { return me === 'w' ? 8 - row(q) : row(q) + 1; } // 1 = the owner's home rank
  function fileOf(q) { return col(q); } // 0 = a
  function light(q) { return (row(q) + col(q)) % 2 === 0; }
  function other(c) { return c === 'w' ? 'b' : 'w'; }
  function sqName(q) { return 'abcdefgh'[col(q)] + (8 - row(q)); }
  function sqIndex(n) { return (8 - (+n[1])) * 8 + 'abcdefgh'.indexOf(n[0]); }
  function kingSq(s, c) { var k = c === 'w' ? 'K' : 'k'; return s.board.indexOf(k); }
  function pieces(s, c, t) { var out = []; for (var i = 0; i < 64; i++) { var p = s.board[i]; if (p && colorOf(p) === c && (!t || type(p) === t)) out.push(i); } return out; }
  function attacked(s, q, by, cfg) { return R.attacked(s, q, by, cfg); }
  // forward for the owner: towards the other side
  function forward(m, me) { return me === 'w' ? row(m.to) < row(m.from) : row(m.to) > row(m.from); }
  function backward(m, me) { return me === 'w' ? row(m.to) > row(m.from) : row(m.to) < row(m.from); }
  function lateral(m) { return row(m.to) === row(m.from) && m.from !== m.to; }
  function moveDist(m) { return dist(m.from, m.to); }
  // the squares a sliding move passes between its start and its end (none for a knight or a one-step move)
  function path(m) {
    var dr = Math.sign(row(m.to) - row(m.from)), dc = Math.sign(col(m.to) - col(m.from)), out = [];
    if (!(row(m.to) - row(m.from) === 0 || col(m.to) - col(m.from) === 0 || Math.abs(row(m.to) - row(m.from)) === Math.abs(col(m.to) - col(m.from)))) return out;
    for (var q = m.from + dr * 8 + dc; q !== m.to; q += dr * 8 + dc) out.push(q);
    return out;
  }
  function isKingCap(m) { return !!m.cap && type(m.cap) === 'k'; }
  // the king of `c` stands attacked (what the site calls being in check)
  function checked(s, c, cfg) { var k = kingSq(s, c); return k >= 0 && R.attacked(s, k, other(c), cfg); }

  // a seeded generator: the same game always draws the same parts
  function rng(seed) { var x = (seed >>> 0) || 1; return { next: function () { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }, int: function (n) { return Math.floor(this.next() * n); }, pick: function (a) { return a[this.int(a.length)]; } }; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // a fresh draw for one turn: the same game and turn always draw the same
  function turnRng(ctx, salt) { return rng((ctx.seed ^ hash(ctx.id + (salt || '')) ^ Math.imul(ctx.hist.length + 1, 2654435761)) >>> 0); }

  /* ---------- history ---------- */
  function histOf(s) {
    var node = s.dh;
    if (!node) return [];
    if (node.arr) return node.arr;
    var out = [], k = node;
    while (k) { out.push(k.e); k = k.prev; }
    out.reverse();
    node.arr = out;
    return out;
  }
  // a rules.js move played, with the history carried along (s.dh, a linked list) and the king en passant
  function play(s, m, cfg, conf) {
    var n = R.play(s, m, cfg), by = s.turn;
    var e = { by: by, p: m.piece || (m.drop ? m.drop : ''), from: m.from, to: m.to, cap: m.cap || '', capSq: m.capSq != null ? m.capSq : -1, promo: m.promo || '', castle: m.castle || '', pass: -1, n: s.dh ? s.dh.e.n + 1 : 0, chk: false };
    if (m.castle) e.pass = (m.from + m.to) >> 1;
    // the king castled out of or through check last move: a move to the square it left or passed takes it
    var pe = s.dh ? s.dh.e : null;
    if (pe && pe.castle && pe.by !== by && !n.lost && (m.to === pe.from || m.to === pe.pass)) {
      n.lost = pe.by; n.lostBy = 'king'; e.kingEp = true;
    }
    if (!conf || conf.check) e.chk = !n.lost && checked(n, other(by), cfg);
    n.dh = { e: e, prev: s.dh || null };
    // the drawback's memory (s.dm = { w, b }), and what its own move does to the board
    n.dm = s.dm || null;
    var slot = conf && conf[by], d = slot && BY[slot.id];
    if (d && d.after) {
      n.board = n.board.slice();
      var mem = d.after(ctxFor(s, by, slot, conf, false), m, n);
      if (mem !== undefined) { n.dm = { w: s.dm ? s.dm.w : null, b: s.dm ? s.dm.b : null }; n.dm[by] = mem; }
    }
    return n;
  }

  /* ---------- the context of one side ---------- */
  function ctxFor(s, me, slot, conf, hypo) {
    var hist = histOf(s), myMoves = 0, myLast = null, foeLast = null;
    for (var i = hist.length - 1; i >= 0; i--) {
      if (hist[i].by === me) { myMoves++; if (!myLast) myLast = hist[i]; } else if (!foeLast) foeLast = hist[i];
    }
    return {
      s: s, me: me, foe: other(me), id: slot.id, params: slot.params || {}, seed: (conf && conf.seed) || 1, hypo: !!hypo, cfg: (conf && conf.cfg) || CFG,
      mem: s.dm ? s.dm[me] : null,
      hist: hist, last: hist.length ? hist[hist.length - 1] : null, myLast: myLast, foeLast: foeLast, myMoves: myMoves, moveNo: myMoves + 1
    };
  }
  var CFG = { side: 'w', kingCapture: true, castleAny: true, freeArmy: true };

  // The moves the owner of `me` may make. conf = { w: { id, params } | null, b: ..., seed, cfg, engine }.
  function filter(s, me, conf, moves, hypo) {
    var slot = conf && conf[me];
    if (!slot) return moves;
    var d = BY[slot.id];
    if (!d || !d.filter) return moves;
    if (hypo && (d.turnRandom || d.engine)) return moves;
    var ctx = ctxFor(s, me, slot, conf, hypo);
    ctx.engine = conf.engine || null;
    var out = d.filter(ctx, moves);
    return out || moves;
  }
  // Does the owner of `me` lose in this position by its drawback?
  function loses(s, me, conf, hypo) {
    var slot = conf && conf[me];
    if (!slot) return false;
    var d = BY[slot.id];
    if (!d || !d.lose) return false;
    if (hypo && (d.turnRandom || d.engine)) return false;
    return !!d.lose(ctxFor(s, me, slot, conf, hypo));
  }
  /* The verdict on a position: { over, result, reason, by } or { over: false }. legalOf(s) gives the plain
     legal moves of the side to move. The side that just moved is judged first. */
  function status(s, conf, legalOf) {
    if (s.lost) return { over: true, result: other(s.lost), reason: 'king captured' };
    var mover = s.dh ? s.dh.e.by : other(s.turn), order = [mover, other(mover)];
    for (var i = 0; i < 2; i++) {
      var c = order[i];
      if (loses(s, c, conf, false)) return { over: true, result: other(c), reason: 'drawback', by: c, id: conf[c].id };
    }
    var lg = filter(s, s.turn, conf, legalOf(s), false);
    if (!lg.length) return { over: true, result: other(s.turn), reason: 'no legal moves', by: s.turn };
    return { over: false };
  }
  // The start position with both drawbacks' changes to it (most have none).
  function startState(s, conf) {
    ['w', 'b'].forEach(function (c) { var slot = conf[c], d = slot && BY[slot.id]; if (d && d.start) { s.board = s.board.slice(); d.start(s, c, slot.params || {}); } });
    return s;
  }
  function textOf(slot) {
    var d = BY[slot.id];
    if (!d) return '';
    return d.textOf ? d.textOf(slot.params || {}) : d.text;
  }
  // A new game: two different drawbacks (or the ones asked for), their random parts, a seed.
  function deal(seed, want) {
    var r = rng(seed), ids = LIST.map(function (d) { return d.id; });
    var w = want && want.w ? want.w : r.pick(ids), b = want && want.b ? want.b : r.pick(ids);
    if (!(want && want.b)) while (b === w && ids.length > 1) b = r.pick(ids);
    var slot = function (id, salt) { var d = BY[id], pr = rng(seed ^ hash(id + salt)); return { id: id, params: d.setup ? d.setup(pr) : {} }; };
    return { seed: seed >>> 0, w: slot(w, 'w'), b: slot(b, 'b'), check: true };
  }

  // the files in js/drawbacks/ that hold the definitions (the page loads them by script tag, the worker by importScripts)
  var PARTS = ['core', 'p1', 'p2', 'p3', 'p4', 'goals'];
  var api = {
    PARTS: PARTS, LIST: LIST, BY: BY, register: register, play: play, startState: startState, filter: filter, loses: loses, status: status, textOf: textOf, deal: deal,
    histOf: histOf, ctxFor: ctxFor, CFG: CFG,
    // helpers for the drawback definitions
    h: { VAL: VAL, NAME: NAME, type: type, colorOf: colorOf, val: val, row: row, col: col, dist: dist, adj: adj, rim: rim, rankOf: rankOf, fileOf: fileOf, light: light, other: other,
      sqName: sqName, sqIndex: sqIndex, path: path, kingSq: kingSq, pieces: pieces, attacked: attacked, forward: forward, backward: backward, lateral: lateral, moveDist: moveDist,
      isKingCap: isKingCap, checked: checked, rng: rng, hash: hash, turnRng: turnRng }
  };
  root.Drawbacks = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; PARTS.forEach(function (p) { require('./drawbacks/' + p + '.js'); }); }
})(typeof self !== 'undefined' ? self : this);
