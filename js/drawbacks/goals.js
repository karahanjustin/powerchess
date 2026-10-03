/* Drawback Chess: how far a side is towards the goal its drawback sets (score(ctx) in centipawns for the owner).
   The bot's search adds it at its leaves, so it heads for a goal whose deadline is still beyond its horizon.
   Loaded after the definitions; a drawback that is not there is skipped. */
(function (root) {
  'use strict';
  var DB = root.Drawbacks || (typeof require !== 'undefined' ? require('../drawbacks.js') : null), h = DB.h;
  var START_COLS = { r: [0, 7], n: [1, 6], b: [2, 5], q: [3], k: [4] };
  var CENTER = [27, 28, 35, 36];
  // how pressing a deadline is: 0 long before it, 1 on it
  var urge = function (n, from, to) { return n <= from ? 0 : n >= to ? 1 : (n - from) / (to - from); };
  var goals = {
    // a rook of theirs by move 20: attack their rooks, more so as move 20 nears
    siege: function (ctx) {
      if (ctx.hist.some(function (e) { return e.by === ctx.me && h.type(e.cap) === 'r'; })) return 0;
      var u = urge(ctx.myMoves, 4, 19), hits = h.pieces(ctx.s, ctx.foe, 'r').filter(function (q) { return h.attacked(ctx.s, q, ctx.me, ctx.cfg); }).length;
      return Math.round(u * (60 * hits - 150));
    },
    rook_on_the_seventh: function (ctx) {
      if (ctx.mem) return 0;
      var u = 0.35 + 0.65 * urge(ctx.myMoves, 2, 14), top = 1, open = 0;
      h.pieces(ctx.s, ctx.me, 'r').forEach(function (q) {
        top = Math.max(top, h.rankOf(q, ctx.me));
        // a file without an own pawn in front of the rook is the road up
        var f = h.col(q), blocked = h.pieces(ctx.s, ctx.me, 'p').some(function (pq) { return h.col(pq) === f && h.rankOf(pq, ctx.me) > h.rankOf(q, ctx.me); });
        if (!blocked) open++;
      });
      // one rook move from the seventh rank: a clear file up to it (the square empty or an enemy piece)
      var reach = h.pieces(ctx.s, ctx.me, 'r').some(function (q) {
        var t = ctx.me === 'w' ? 8 + h.col(q) : 48 + h.col(q), tp = ctx.s.board[t];
        if (q === t || (tp && h.colorOf(tp) === ctx.me)) return false;
        return h.path({ from: q, to: t }).every(function (x) { return !ctx.s.board[x]; });
      });
      return Math.round(u * (50 * (top - 1) + 40 * open + (reach ? 200 : 0) - 260));
    },
    warlord: function (ctx) {
      var k = h.kingSq(ctx.s, ctx.me), u = urge(ctx.myMoves, 5, 11);
      if (k < 0) return 0;
      var r = h.rankOf(k, ctx.me);
      return r >= 3 ? 0 : -Math.round(u * 140 * (3 - r));
    },
    fischer_random: function (ctx) {
      var u = urge(ctx.myMoves, 6, 19), good = 0, bad = 0;
      h.pieces(ctx.s, ctx.me).forEach(function (q) {
        var t = h.type(ctx.s.board[q]);
        if (t === 'p') return;
        if (h.rankOf(q, ctx.me) === 1 && START_COLS[t].indexOf(h.col(q)) < 0) good++; else bad++;
      });
      return Math.round(u * (40 * good - 70 * bad));
    },
    king_of_the_hill: function (ctx) {
      var n = CENTER.filter(function (q) { var p = ctx.s.board[q]; return p && h.colorOf(p) === ctx.me; }).length;
      return n ? 40 + 15 * n : -160;
    },
    moving_day: function (ctx) {
      var u = urge(ctx.myMoves, 12, 20);
      return -Math.round(u * 60 * h.pieces(ctx.s, ctx.me).filter(function (q) { return h.rankOf(q, ctx.me) === 1; }).length);
    },
    crusade: function (ctx) {
      var p = ctx.params, u = urge(ctx.moveNo, p.at - 4, p.at), near = 9;
      if (ctx.moveNo > p.at + 3) return 0;
      h.pieces(ctx.s, ctx.me).forEach(function (q) { if (h.type(ctx.s.board[q]) !== 'k') near = Math.min(near, h.dist(q, p.sq)); });
      return Math.round(u * (near === 0 ? 90 : -25 * near));
    },
    inching_forward: function (ctx) {
      var k = h.kingSq(ctx.s, ctx.me);
      if (k < 0 || ctx.myMoves < 3) return 0;
      var need = ctx.myMoves < 6 ? 2 : 2 + Math.floor((ctx.myMoves - 6) / 6), r = h.rankOf(k, ctx.me);
      return r >= need ? 0 : -110 * (need - r);
    },
    helicopter_parent: function (ctx) {
      var loose = h.pieces(ctx.s, ctx.me, 'p').filter(function (q) { return !h.attacked(ctx.s, q, ctx.me, ctx.cfg); }).length;
      return -45 * loose;
    }
  };
  Object.keys(goals).forEach(function (id) { if (DB.BY[id] && !DB.BY[id].score) DB.BY[id].score = goals[id]; });
})(typeof self !== 'undefined' ? self : this);
