/* The power-up search for the variants. It runs as a module worker with its own copy
   of the variant rules (ffish) and the same backend the board uses, so every power-up
   and every variant rule is the real one.

   That backend is slower than the built-in chess rules, so this search is short: a few
   half-moves plus captures, judged by material. Its job is tactics, not strategy: spot
   what a power-up wins or loses right now, use the free actions, and hand Fairy-Stockfish
   the moves that are safe so it can pick the one that fits the variant.

   In:  { id, game: { sig, uci, c960, startFen, cfg, hand, special, nocheck, boom, keepCastle, ini, inverse }, state, opts }
   Out: { id, result: { depth, nodes, score, actions: [{ key, score }] } } */
import Module from '../fairy/ffish.js';
import './fairy.js';

const F = self.Fairy;
const MATE = 100000, INF = 1000000;
const STD = { p: 100, n: 320, b: 330, r: 500, q: 900 };

let ff = null, cur = null; // cur = { sig, B, values, game }
const loadedIni = {};
const inWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
const ready = !inWorker ? null : Module({ locateFile: (f) => new URL('../fairy/' + f, import.meta.url).href, print: () => {}, printErr: () => {} }).then((m) => {
  ff = m;
  new ff.Board('chess').delete(); // the first board initialises the variant tables
});
// Outside a worker (tests) the rules library is handed in.
export function init(lib) { ff = lib; }

const moveKey = (m) => (m.storm ? 'S' : m.drop ? 'D' + m.drop : m.snipe ? 'X' : (m.kind || 'n')) + ':' + m.from + ':' + m.to + ':' + (m.promo || '');
const white = (p) => p === p.toUpperCase();

/* What a piece letter is worth in this variant. The letters mean different pieces from
   variant to variant, so each one is put on an empty board and its moves are counted. */
function pieceValues(game, W, H) {
  const values = {}, fen0 = game.startFen.split(' ')[0], letters = {};
  for (const ch of fen0) if (/[a-z]/i.test(ch)) letters[ch.toLowerCase()] = true;
  const royal = !game.nocheck;
  const spots = [[Math.floor(H / 2), Math.floor(W / 2)], [Math.floor(H / 2) - 1, 1], [H - 2, W - 2]]; // centre, edge, near a corner
  const count = (l, r, f) => {
    const cells = new Array(W * H).fill('');
    cells[r * W + f] = l.toUpperCase();
    // kings as far away as possible, when the variant has them
    if (letters.k && l !== 'k') { cells[(H - 1) * W] = cells[(H - 1) * W] || 'K'; cells[W - 1] = cells[W - 1] || 'k'; }
    if (letters.p && !cells[2 * W - 1]) cells[2 * W - 1] = 'p'; // some variants end the game against a bare king
    const fen = F.splitFen(game.startFen), rest = fen.fields.slice(1);
    if (fen.fields.length >= 5) { rest[0] = '-'; rest[1] = '-'; } // no castling, no en passant
    const text = joinBoard(cells, W, H) + (fen.pocket != null ? '[]' : '') + ' w ' + rest.join(' ');
    try {
      if (ff.validateFen(text, game.uci, !!game.c960) !== 1) return -1;
      const b = game.c960 ? new ff.Board(game.uci, text, true) : new ff.Board(game.uci, text);
      const from = F.sqName(r * W + f, W, H), to = {};
      b.legalMoves().split(' ').forEach((u) => { const mm = /^([a-l]\d{1,2})([a-l]\d{1,2})/.exec(u); if (mm && mm[1] === from) to[mm[2]] = true; });
      b.delete();
      return Object.keys(to).length;
    } catch (e) { return -1; }
  };
  Object.keys(letters).forEach((l) => {
    if (l === 'p') { values[l] = 100; return; }
    if (l === 'k') { values[l] = royal ? 0 : 280; return; }
    const got = spots.map((s) => count(l, s[0], s[1])).filter((n) => n >= 0);
    if (!got.length || Math.max.apply(null, got) === 0) { values[l] = STD[l] || 400; return; } // the test position did not work in this variant
    const centre = got[0], avg = got.reduce((a, b) => a + b, 0) / got.length;
    // the usual piece behind the usual letter keeps its usual value
    const usual = { n: 8, b: Math.min(W, H) * 2 - 3, r: W + H - 2, q: W + H - 2 + Math.min(W, H) * 2 - 3 }[l];
    if (STD[l] && Math.abs(centre - usual) <= 2) { values[l] = STD[l]; return; }
    values[l] = Math.max(90, Math.min(1500, Math.round(40 + 42 * avg)));
  });
  return values;
}
function joinBoard(cells, W, H) {
  let out = '';
  for (let r = 0; r < H; r++) {
    let empty = 0;
    for (let x = 0; x < W; x++) {
      const t = cells[r * W + x];
      if (!t) empty++;
      else { if (empty) { out += empty; empty = 0; } out += t; }
    }
    if (empty) out += empty;
    if (r < H - 1) out += '/';
  }
  return out;
}

/* A few games stay ready at once: the eval bar asks about the same position with and
   without power-ups, and a bot may be thinking about another configuration. */
const games = [], valueCache = {};
export function setGame(game) {
  if (cur && cur.sig === game.sig) return;
  const at = games.findIndex((g) => g.sig === game.sig);
  if (at >= 0) { cur = games[at]; return; }
  if (game.ini && !loadedIni[game.ini]) { ff.loadVariantConfig(game.ini); loadedIni[game.ini] = true; }
  const B = F.backend(ff, { uci: game.uci, c960: !!game.c960, startFen: game.startFen, cfg: game.cfg, hand: !!game.hand, special: !!game.special, nocheck: !!game.nocheck, boom: !!game.boom, keepCastle: !!game.keepCastle });
  const vk = game.uci + '|' + game.startFen.split(' ')[0].replace(/[^a-z]/gi, '').toLowerCase().split('').sort().join('').replace(/(.)\1+/g, '$1') + '|' + B.W + 'x' + B.H;
  if (!valueCache[vk]) valueCache[vk] = pieceValues(game, B.W, B.H);
  cur = { sig: game.sig, B: B, game: game, values: valueCache[vk], tt: new Map() };
  games.push(cur);
  if (games.length > 6) { const old = games.shift(); try { old.B.dispose(); } catch (e) { /* gone */ } }
}

/* ---------- evaluation: material, from White's point of view ---------- */

function evaluate(s) {
  const B = cur.B, val = cur.values, b = s.board, pw = B.powersOf('w'), pb = B.powersOf('b');
  let score = 0, i;
  for (i = 0; i < b.length; i++) {
    const p = b[i];
    if (!p) continue;
    const w = white(p), t = p.toLowerCase(), own = w ? pw : pb;
    let v = val[t] == null ? 400 : val[t];
    if (t === 'b') { if (own.sniper) v += 170; if (own.ghostB) v += 80; }
    else if (t === 'n') { if (own.dragon) v += 380; if (own.archer) v += 150; }
    else if (t === 'q') { if (own.amazon) v += 260; if (own.immortal) v += 150; if (own.sniperQ) v += 250; if (own.ghostQ) v += 120; }
    else if (t === 'r') { if (own.ghost) v += 90; if (own.sniperR) v += 200; }
    else if (t === 'p' && own.sniperP) v += 40;
    if (s.gold.length && s.gold.indexOf(i) >= 0) v *= 0.1; // a statue only stands there
    score += w ? v : -v;
  }
  const bag = (list, sign) => { for (let k = 0; k < list.length; k++) score += sign * (val[list[k]] == null ? 300 : val[list[k]]) * 0.9; };
  bag(s.pockets.w, 1); bag(s.pockets.b, -1);
  // Reinforcements keep their captures in the overlay pockets
  const first = cur.game.cfg.side === 'b' ? 'b' : 'w';
  if (s.pocket.length) bag(s.pocket, first === 'w' ? 1 : -1);
  if (s.pocket2.length) bag(s.pocket2, first === 'w' ? -1 : 1);
  if (cur.game.inverse) score = -score; // giving pieces away is the point
  // checks still needed (Three-check and friends): every check given is worth a lot
  const chk = /\s(\d+)\+(\d+)\s/.exec(s.fen);
  if (chk) score += (+chk[2] - +chk[1]) * 220;
  if (pw.timestop && s.stopUsed.indexOf('w') < 0) score += 130;
  if (pb.timestop && s.stopUsed.indexOf('b') < 0) score -= 130;
  if (pw.turncoat && s.turned.indexOf('w') < 0) score += 220;
  if (pb.turncoat && s.turned.indexOf('b') < 0) score -= 220;
  if (s.movesLeft > 1) score += (s.turn === 'w' ? 1 : -1) * 45 * (s.movesLeft - 1);
  return score;
}

/* ---------- search ---------- */

function Search(opts) {
  this.deadline = Date.now() + (opts.ms || 800);
  this.nodes = 0;
  this.stopped = false;
  // free actions are always part of the tree for the side that has them, opts.free only concerns the root list
  this.free = true;
  this.rootFree = opts.free !== false;
  this.reply = -1;    // after a search call: the square the best move of that position starts from, or -1
  this.killers = [];
}
Search.prototype.timeUp = function () {
  if ((this.nodes & 15) === 0 && Date.now() > this.deadline) this.stopped = true;
  return this.stopped;
};
const valueOf = (letter) => { const v = cur.values[letter.toLowerCase()]; return v == null ? 400 : v; };
const fromOf = (m) => (typeof m.from === 'number' && m.from >= 0 ? m.from : -1);
const codeOf = (m) => (fromOf(m) + 1) * 4096 + m.to;
// hint = the move a previous look at this position liked best, k1 and k2 = quiet moves that worked next door
function order(moves, hint, k1, k2) {
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i], c = codeOf(m);
    let o = 0;
    if (c === hint) o = 100000;
    else if (m.cap) o = 1000 + valueOf(m.cap) * 10 - (m.snipe || !m.piece ? 0 : valueOf(m.piece));
    else if (m.promo) o = 800;
    else if (c === k1) o = 700;
    else if (c === k2) o = 600;
    m.order = o;
  }
  moves.sort((x, y) => y.order - x.order);
}
/* What is known about a position from an earlier look: how deep, what score, which move. The key is
   the position with everything the power-ups add to it. tp is part of it, because near the root the
   free actions are searched and further out they are not. */
function keyOf(s, tp) {
  const f = s.fen, a = f.lastIndexOf(' '), b = a > 0 ? f.lastIndexOf(' ', a - 1) : -1;
  return (b > 0 ? f.slice(0, b) : f) + '|' + s.gold + '|' + s.ice + '|' + s.movesLeft + (s.freezeUsed ? 'f' : '-') + s.midasUsed + s.stopUsed + '|' + s.turned + '|' + s.pocket + '/' + s.pocket2 + (tp <= 1 ? 'a' : tp <= 2 ? 'b' : 'c');
}
const EXACT = 0, LOWER = 1, UPPER = 2;
// Midas Touch needs a piece that could capture the target. If there is exactly one, this is its square, else -1.
function attackerOf(lg, target) {
  let from = -1;
  for (let i = 0; i < lg.length; i++) {
    const m = lg[i];
    if (!m.cap || m.to !== target) continue;
    const f = fromOf(m);
    if (f < 0 || (from >= 0 && f !== from)) return -1;
    from = f;
  }
  return from;
}
// Free actions worth a look: the most valuable targets. tp = turns since the root. Freeze Ray is not
// in this list, it is searched move by move (see search).
Search.prototype.freeActions = function (s, lg, tp, atRoot) {
  const B = cur.B, out = [], b = s.board, byValue = (x, y) => valueOf(b[y]) - valueOf(b[x]);
  const g = B.gildTargets(s, lg).sort(byValue).slice(0, atRoot ? 4 : 1);
  g.forEach((sq) => out.push({ gild: sq, key: 'g' + sq }));
  if (tp === 0) {
    B.convertTargets(s).sort(byValue).slice(0, atRoot ? 3 : 1).forEach((sq) => out.push({ convert: sq, key: 'c' + sq }));
    if (B.stopReady(s)) out.push({ stop: true, key: 't' });
  }
  return out;
};
function apply(s, a) {
  const B = cur.B;
  if (a.m) return B.play(s, a.m);
  if (a.gild != null) return B.gild(s, a.gild);
  if (a.freeze != null) return B.freeze(s, a.freeze);
  if (a.convert != null) return B.convert(s, a.convert);
  return B.timeStop(s);
}
// Is the game decided here? Returns a score for the side to move, or null.
function terminal(s, lg, ply) {
  if (lg.length && !cur.game.special) return null;
  const st = cur.B.status(s, lg);
  if (!st.over) return null;
  if (st.result === 'draw') return 0;
  return st.result === s.turn ? MATE - ply : -MATE + ply;
}

Search.prototype.quiesce = function (s, alpha, beta, ply, qd) {
  this.nodes++;
  this.reply = -1;
  const stand = (s.turn === 'w' ? 1 : -1) * evaluate(s);
  if (qd >= 2 || this.timeUp()) return stand;
  // good enough already and not in check: no need to list the moves (a variant with a goal of its own still looks)
  if (stand >= beta && !s.check.length && !cur.game.special) return stand;
  const B = cur.B, lg = B.legal(s), end = terminal(s, lg, ply);
  if (end != null) return end;
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const caps = lg.filter((m) => m.cap);
  order(caps, -1, -1, -1);
  let from = -1;
  for (let i = 0; i < caps.length && i < 6; i++) {
    const n = B.play(s, caps[i]);
    const v = n.turn === s.turn ? this.quiesce(n, alpha, beta, ply + 1, qd + 1) : -this.quiesce(n, -beta, -alpha, ply + 1, qd + 1);
    if (v >= beta) { this.reply = fromOf(caps[i]); return v; }
    if (v > alpha) { alpha = v; from = fromOf(caps[i]); }
  }
  this.reply = from;
  return alpha;
};

Search.prototype.search = function (s, depth, alpha, beta, ply, tp) {
  if (depth <= 0) return this.quiesce(s, alpha, beta, ply, 0);
  this.nodes++;
  this.reply = -1;
  if (this.timeUp()) return 0;
  const B = cur.B, me = s.turn, tt = cur.tt, key = keyOf(s, tp), known = tt.get(key);
  let hint = -1;
  if (known) {
    hint = known.c;
    if (known.d >= depth) {
      let tv = known.v;
      if (tv > MATE - 1000) tv -= ply; else if (tv < -MATE + 1000) tv += ply;
      if (known.f === EXACT || (known.f === LOWER && tv >= beta) || (known.f === UPPER && tv <= alpha)) { this.reply = known.from; return tv; }
    }
  }
  const lg = B.legal(s), end = terminal(s, lg, ply);
  if (end != null) return end;
  if (!lg.length) return 0;
  const a0 = alpha, mine = this.free && B.has(me) ? B.powersOf(me) : null;
  let best = -INF, bestFrom = -1, bestCode = -1, v, n, i;
  const fa = mine && tp <= 1 ? this.freeActions(s, lg, tp, false) : [];
  const inCheck = s.check.length > 0;
  const done = (flag) => {
    let sv = best;
    if (sv > MATE - 1000) sv += ply; else if (sv < -MATE + 1000) sv -= ply;
    if (tt.size > 300000) tt.clear();
    tt.set(key, { d: depth, f: flag, v: sv, c: bestCode, from: bestFrom });
    this.reply = bestFrom;
    return best;
  };
  // Midas first, it costs nothing. Never on the piece that gives check: a statue cannot be captured any more.
  for (i = 0; i < fa.length; i++) {
    if (fa[i].gild == null || inCheck) continue;
    n = apply(s, fa[i]);
    if (!n) continue;
    // Midas that uses the turn hands the move over: searched like a move
    v = n.turn !== me ? -this.search(n, depth - 1, -beta, -alpha, ply + 1, tp + 1) : this.search(n, depth, alpha, beta, ply + 1, tp);
    if (this.stopped) return 0;
    if (v > best) { best = v; bestFrom = attackerOf(lg, fa[i].gild); bestCode = -1; }
    if (v > alpha) alpha = v;
    if (alpha >= beta) return done(LOWER);
  }
  const kp = ply * 2;
  order(lg, hint, this.killers[kp] || -1, this.killers[kp + 1] || -1);
  /* Freeze Ray, move by move: a freeze only matters through the reply it takes away. So once a move
     has been searched, the piece that made the best reply is frozen and the same move is looked at
     once more. One extra look per move, and always at the piece that matters. */
  const pairs = mine && mine.freeze && !s.freezeUsed && tp <= 2;
  let iced = null, count = 0;
  for (i = 0; i < lg.length; i++) {
    const m = lg[i];
    n = B.play(s, m);
    const same = n.turn === me;
    count++;
    if (count === 1 || best === -INF) v = same ? this.search(n, depth - 1, alpha, beta, ply + 1, tp) : -this.search(n, depth - 1, -beta, -alpha, ply + 1, tp + 1);
    else {
      // the first move is expected to be the best: the others only have to show they are not better
      v = same ? this.search(n, depth - 1, alpha, alpha + 1, ply + 1, tp) : -this.search(n, depth - 1, -alpha - 1, -alpha, ply + 1, tp + 1);
      if (!this.stopped && v > alpha && v < beta) v = same ? this.search(n, depth - 1, alpha, beta, ply + 1, tp) : -this.search(n, depth - 1, -beta, -alpha, ply + 1, tp + 1);
    }
    if (this.stopped) return 0;
    if (pairs && !same && v < beta) {
      const rq = this.reply;
      if (rq >= 0 && s.board[rq] && s.board[rq] === n.board[rq]) {
        if (!iced) iced = {};
        let sf = iced[rq];
        if (sf === undefined) sf = iced[rq] = B.freeze(s, rq);
        if (sf) {
          const n2 = B.play(sf, m), a2 = v > alpha ? v : alpha;
          let v2 = -this.search(n2, depth - 1, -a2 - 1, -a2, ply + 1, tp + 1);
          if (!this.stopped && v2 > a2 && v2 < beta) v2 = -this.search(n2, depth - 1, -beta, -a2, ply + 1, tp + 1);
          if (this.stopped) return 0;
          if (v2 > v) v = v2;
        }
      }
    }
    if (v > best) { best = v; bestFrom = fromOf(m); bestCode = codeOf(m); }
    if (v > alpha) alpha = v;
    if (alpha >= beta) {
      if (!m.cap && !m.promo && this.killers[kp] !== bestCode) { this.killers[kp + 1] = this.killers[kp]; this.killers[kp] = bestCode; }
      return done(LOWER);
    }
  }
  for (i = 0; i < fa.length; i++) {
    if (fa[i].gild != null) continue;
    n = apply(s, fa[i]);
    if (!n) continue;
    v = this.search(n, depth, alpha, beta, ply + 1, tp);
    if (this.stopped) return 0;
    if (v > best) { best = v; bestFrom = -1; bestCode = -1; }
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return done(best <= a0 ? UPPER : best >= beta ? LOWER : EXACT);
};

/* Returns every root action with a score from the mover's point of view, best first.
   A free action stands before a move with the same score, it costs nothing. Move scores
   are exact within `margin` of the best move. A Freeze Ray entry is scored as "freeze this,
   then play the move it helps most". */
export function think(state, opts) {
  const B = cur.B, S = new Search(opts), margin = opts.margin == null ? 60 : opts.margin;
  const legal = B.legal(state);
  let moves = legal.map((m) => ({ m: m, key: moveKey(m), v: 0 }));
  const banned = opts.banned && opts.banned.length ? opts.banned : null;
  if (banned) moves = moves.filter((a) => banned.indexOf(a.key) < 0);
  let frees = S.rootFree && moves.length && B.has(state.turn) ? S.freeActions(state, legal, 0, true) : [];
  if (banned) frees = frees.filter((a) => banned.indexOf(a.key) < 0);
  frees.forEach((a) => { a.v = 0; });
  order(moves.map((a) => a.m), -1, -1, -1);
  moves.sort((x, y) => y.m.order - x.m.order);
  const pairRoot = S.rootFree && B.has(state.turn) && !!B.powersOf(state.turn).freeze && !state.freezeUsed;
  const pairMap = {}, rootIced = {};
  let pairList = [];
  const pack = () => frees.concat(pairList, moves).map((a) => ({ key: a.key, score: Math.round(a.v) })).sort((x, y) => y.score - x.score);
  const result = { depth: 0, nodes: 0, score: 0, actions: pack(), values: cur.values };
  if (!moves.length) return result;
  const maxDepth = opts.maxDepth || 6;
  for (let depth = 1; depth <= maxDepth; depth++) {
    let best = -INF, pairBest = -INF, n, v, i;
    for (const k in pairMap) { pairMap[k].nv = -INF; pairMap[k].mv = -INF; }
    for (i = 0; i < moves.length; i++) {
      n = B.play(state, moves[i].m);
      const alpha = best === -INF ? -INF : best - margin - 1, same = n.turn === state.turn;
      v = same ? S.search(n, depth - 1, alpha, INF, 1, 0) : -S.search(n, depth - 1, -INF, -alpha, 1, 1);
      if (S.stopped) break;
      moves[i].nv = v;
      if (v > best) best = v;
      if (!pairRoot || same) continue;
      const rq = S.reply;
      if (rq < 0 || !state.board[rq] || state.board[rq] !== n.board[rq] || (banned && banned.indexOf('f' + rq) >= 0)) continue;
      let sf = rootIced[rq];
      if (sf === undefined) sf = rootIced[rq] = B.freeze(state, rq);
      if (!sf) continue;
      const n2 = B.play(sf, moves[i].m), top = pairBest > best ? pairBest : best, lo = top - margin - 1;
      let v2;
      if (v <= lo) {
        v2 = -S.search(n2, depth - 1, -lo - 1, -lo, 1, 1);
        if (!S.stopped && v2 > lo) v2 = -S.search(n2, depth - 1, -INF, -lo, 1, 1);
      } else v2 = -S.search(n2, depth - 1, -INF, -lo, 1, 1);
      if (S.stopped) break;
      const pe = pairMap[rq] || (pairMap[rq] = { freeze: rq, key: 'f' + rq, v: -INF, nv: -INF, mv: -INF });
      if (v2 > pe.nv) pe.nv = v2;
      if (v > pe.mv) pe.mv = v; // the move it goes with, to tell equal freezes apart
      if (v2 > pairBest) pairBest = v2;
    }
    if (S.stopped) break;
    for (i = 0; i < frees.length; i++) {
      n = apply(state, frees[i]);
      if (!n) { frees[i].nv = -INF; continue; }
      v = n.turn !== state.turn ? -S.search(n, depth - 1, -INF, -(best - 1), 1, 1) : S.search(n, depth, best - 1, INF, 1, 0); // a gild that uses the turn is a move
      if (S.stopped) break;
      frees[i].nv = v;
    }
    if (S.stopped) break;
    moves.forEach((a) => { a.v = a.nv; });
    frees.forEach((a) => { a.v = a.nv; });
    moves.sort((x, y) => y.v - x.v);
    frees.sort((x, y) => y.v - x.v);
    pairList = [];
    for (const k in pairMap) if (pairMap[k].nv > -INF) { pairMap[k].v = pairMap[k].nv; pairList.push(pairMap[k]); }
    pairList.sort((x, y) => y.v - x.v || y.mv - x.mv);
    result.depth = depth;
    result.actions = pack();
    result.score = result.actions[0].score;
    if (result.score > MATE - 100 || result.score < -MATE + 100 || (moves.length === 1 && !frees.length && !pairList.length)) break;
  }
  result.nodes = S.nodes;
  return result;
}

export function backendNow() { return cur && cur.B; }

if (inWorker) self.onmessage = (e) => {
  const d = e.data;
  ready.then(() => {
    let out;
    try { setGame(d.game); out = think(d.state, d.opts || {}); } catch (err) { out = { error: String(err && err.message || err), actions: [] }; }
    self.postMessage({ id: d.id, result: out });
  }, (err) => self.postMessage({ id: d.id, result: { error: 'The variant rules did not load: ' + err, actions: [] } }));
};
