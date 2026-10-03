/* Endgame tables for king and one piece against a bare king (KQK, KRK, KPK), worked out here by
   retrograde analysis: every mate is found first, then every position from which mate can be forced
   one move earlier, and so on. Everything that is left is a draw. A promotion in KPK looks up KQK.
   Runs as a worker ({ fen } in, { wdl, dtm } out, dtm in moves for the side to move) or in node. */
(function (root) {
  'use strict';
  var KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]], DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  function near(a, b) { return Math.abs((a >> 3) - (b >> 3)) <= 1 && Math.abs((a & 7) - (b & 7)) <= 1; }
  function inside(r, f) { return r >= 0 && r < 8 && f >= 0 && f < 8; }
  // squares a white piece of type t on sq attacks, with the white king possibly in the way
  function attacks(t, sq, wk, target) {
    var r = sq >> 3, f = sq & 7, i, d, rr, ff;
    if (t === 'p') return (r - 1) === (target >> 3) && Math.abs(f - (target & 7)) === 1;
    var dirs = t === 'r' ? ORTH : ORTH.concat(DIAG);
    for (i = 0; i < dirs.length; i++) {
      d = dirs[i]; rr = r + d[0]; ff = f + d[1];
      while (inside(rr, ff)) {
        var s2 = rr * 8 + ff;
        if (s2 === target) return true;
        if (s2 === wk) break;
        rr += d[0]; ff += d[1];
      }
    }
    return false;
  }
  var idx = function (wk, bk, p, stm) { return ((wk * 64 + bk) * 64 + p) * 2 + stm; };
  var tables = {};
  /* Builds the table for piece type t ('q', 'r' or 'p'). dtm: -1 unknown or draw, 0 = mate on the board
     (black to move), n = white mates in n moves (white to move) or black is mated in n (black to move). */
  function build(t) {
    var N = 64 * 64 * 64 * 2, dtm = new Int8Array(N), legal = new Uint8Array(N), i, wk, bk, p, stm;
    dtm.fill(-1);
    var kq = t === 'p' ? tables.q || build('q') : null;
    for (wk = 0; wk < 64; wk++) for (bk = 0; bk < 64; bk++) for (p = 0; p < 64; p++) {
      if (wk === bk || p === wk || p === bk || near(wk, bk)) continue;
      if (t === 'p' && ((p >> 3) === 0 || (p >> 3) === 7)) continue;
      var chk = attacks(t, p, wk, bk);
      legal[idx(wk, bk, p, 1)] = 1;          // black to move, may be in check
      if (!chk) legal[idx(wk, bk, p, 0)] = 1; // white to move only when black is not in check
    }
    // black's moves: king steps, possibly taking the piece
    function blackMoves(wk, bk, p) {
      var out = [], r = bk >> 3, f = bk & 7, i;
      for (i = 0; i < 8; i++) {
        var rr = r + KG[i][0], ff = f + KG[i][1];
        if (!inside(rr, ff)) continue;
        var to = rr * 8 + ff;
        if (to === wk || near(to, wk)) continue;
        if (to === p) { out.push(-1); continue; } // takes the piece: a draw
        if (attacks(t, p, wk, to)) continue;
        out.push(idx(wk, to, p, 0));
      }
      return out;
    }
    // white's moves: king steps and piece moves; a pawn that promotes becomes a queen
    function whiteMoves(wk, bk, p) {
      var out = [], r, f, i, d, rr, ff, to;
      r = wk >> 3; f = wk & 7;
      for (i = 0; i < 8; i++) {
        rr = r + KG[i][0]; ff = f + KG[i][1];
        if (!inside(rr, ff)) continue;
        to = rr * 8 + ff;
        if (to === p || near(to, bk)) continue;
        out.push(idx(to, bk, p, 1));
      }
      r = p >> 3; f = p & 7;
      if (t === 'p') {
        to = p - 8;
        if (to >= 0 && to !== wk && to !== bk) {
          if ((to >> 3) === 0) out.push({ q: idx(wk, bk, to, 1) });
          else { out.push(idx(wk, bk, to, 1)); if (r === 6 && (to - 8) !== wk && (to - 8) !== bk) out.push(idx(wk, bk, to - 8, 1)); }
        }
        return out;
      }
      var dirs = t === 'r' ? ORTH : ORTH.concat(DIAG);
      for (i = 0; i < dirs.length; i++) {
        d = dirs[i]; rr = r + d[0]; ff = f + d[1];
        while (inside(rr, ff)) {
          to = rr * 8 + ff;
          if (to === wk || to === bk) break;
          out.push(idx(wk, bk, to, 1));
          rr += d[0]; ff += d[1];
        }
      }
      return out;
    }
    // mates
    for (wk = 0; wk < 64; wk++) for (bk = 0; bk < 64; bk++) for (p = 0; p < 64; p++) {
      i = idx(wk, bk, p, 1);
      if (!legal[i]) continue;
      if (attacks(t, p, wk, bk) && blackMoves(wk, bk, p).length === 0) dtm[i] = 0;
    }
    var n = 0, changed = true;
    while (changed && n < 60) {
      changed = false; n++;
      // white to move: mates in n if some move reaches a black-to-move position mated in n-1
      for (wk = 0; wk < 64; wk++) for (bk = 0; bk < 64; bk++) for (p = 0; p < 64; p++) {
        i = idx(wk, bk, p, 0);
        if (!legal[i] || dtm[i] >= 0) continue;
        var ms = whiteMoves(wk, bk, p), k;
        for (k = 0; k < ms.length; k++) {
          var m = ms[k], v = typeof m === 'object' ? (kq ? kq.dtm[m.q] : -1) : dtm[m];
          if (v === n - 1 || (typeof m === 'object' && v >= 0 && v < n)) { dtm[i] = n; changed = true; break; }
        }
      }
      // black to move: mated in n if every move reaches a white-to-move position that mates in at most n
      for (wk = 0; wk < 64; wk++) for (bk = 0; bk < 64; bk++) for (p = 0; p < 64; p++) {
        i = idx(wk, bk, p, 1);
        if (!legal[i] || dtm[i] >= 0) continue;
        var bs = blackMoves(wk, bk, p), all = bs.length > 0, worst = 0, j;
        for (j = 0; j < bs.length; j++) {
          var w = bs[j] < 0 ? -1 : dtm[bs[j]];
          if (w < 0 || w > n) { all = false; break; }
          if (w > worst) worst = w;
        }
        if (all && worst === n) { dtm[i] = n; changed = true; }
      }
    }
    tables[t] = { dtm: dtm, legal: legal, piece: t };
    return tables[t];
  }
  /* Looks a FEN up. Only king and one white or black queen, rook or pawn against a bare king; the
     board is mirrored so that the piece is White's. Returns null when the position is not covered,
     else { wdl: 'win' | 'draw' | 'loss' from the side to move, dtm } with dtm in moves. */
  function probe(fen) {
    var parts = fen.split(' '), rows = parts[0].split('/'), board = [], r, c, i;
    if (rows.length !== 8) return null;
    for (r = 0; r < 8; r++) for (c = 0; c < rows[r].length; c++) {
      var ch = rows[r][c];
      if (ch >= '1' && ch <= '8') for (i = 0; i < +ch; i++) board.push(''); else board.push(ch);
    }
    if (board.length !== 64) return null;
    var pieces = [];
    for (i = 0; i < 64; i++) if (board[i]) pieces.push({ sq: i, p: board[i] });
    if (pieces.length !== 3) return null;
    var wk = -1, bk = -1, x = null;
    pieces.forEach(function (e) { if (e.p === 'K') wk = e.sq; else if (e.p === 'k') bk = e.sq; else x = e; });
    if (wk < 0 || bk < 0 || !x) return null;
    var t = x.p.toLowerCase();
    if (t !== 'q' && t !== 'r' && t !== 'p') return null;
    var white = x.p === x.p.toUpperCase(), stm = parts[1] === 'w' ? 0 : 1;
    // the strong side is White in the tables: flip the board top to bottom and swap colours
    var flip = function (sq) { return (7 - (sq >> 3)) * 8 + (sq & 7); };
    if (!white) { var tmp = flip(wk); wk = flip(bk); bk = tmp; x.sq = flip(x.sq); stm = 1 - stm; }
    if (t === 'p' && ((x.sq >> 3) === 0 || (x.sq >> 3) === 7)) return null;
    var tb = tables[t] || build(t), id = idx(wk, bk, x.sq, stm);
    if (!tb.legal[id]) return null;
    var d = tb.dtm[id];
    // stm here is the side of the tables: 0 = the strong side to move
    if (d < 0) return { wdl: 'draw', dtm: 0 };
    return { wdl: stm === 0 ? 'win' : 'loss', dtm: d };
  }
  var api = { probe: probe, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tablebase = api;
  if (typeof importScripts === 'function' && typeof root.document === 'undefined') {
    root.onmessage = function (e) {
      var d = e.data, out = null;
      try { out = probe(d.fen); } catch (err) { out = null; }
      root.postMessage({ id: d.id, result: out });
    };
  }
})(typeof self !== 'undefined' ? self : this);
