/* Drawback Chess, more drawbacks (see js/drawbacks.js for the terms and the ctx). */
(function (root) {
  'use strict';
  var DB = root.Drawbacks || (typeof require !== 'undefined' ? require('../drawbacks.js') : null), h = DB.h;
  var R = root.Rules || (typeof require !== 'undefined' ? require('../rules.js') : null);
  var only = function (fn) { return function (ctx, moves) { return moves.filter(function (m) { return fn(ctx, m); }); }; };
  var must = function (fn) { return function (ctx, moves) { var x = moves.filter(function (m) { return fn(ctx, m); }); return x.length ? x : moves; }; };

  /* ---------- local helpers ---------- */
  // the move takes the enemy king: a plain king capture, or the king en passant after it castled (see drawbacks.js)
  function kingTake(ctx, m) {
    if (h.isKingCap(m)) return true;
    var l = ctx.last;
    return !!l && l.by === ctx.foe && !!l.castle && (m.to === l.from || m.to === l.pass);
  }
  // capture and destination rules spare the king
  var spare = function (fn) { return function (ctx, m) { return kingTake(ctx, m) || fn(ctx, m); }; };
  // must rules always allow taking the king
  var mustK = function (fn) { return must(function (ctx, m) { return kingTake(ctx, m) || fn(ctx, m); }); };
  // the piece standing on the board after the move (the promoted piece for a promotion)
  function arrives(m) { return m.promo ? m.promo : h.type(m.piece); }
  function horiz(m) { return Math.sign(h.col(m.to) - h.col(m.from)); }
  function nearOwn(s, q, me, t, skip) { // a piece of `me` (of type t, if given) on a square next to q, other than `skip`
    var r = h.row(q), c = h.col(q);
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      var rr = r + dr, cc = c + dc;
      if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
      var a = rr * 8 + cc, p = s.board[a];
      if (a === skip || !p || h.colorOf(p) !== me) continue;
      if (!t || (typeof t === 'function' ? t(h.type(p)) : h.type(p) === t)) return true;
    }
    return false;
  }
  // the position after a move, without the history (cheaper than DB.play where only the board matters)
  function after(ctx, m) { return R.play(ctx.s, m, ctx.cfg); }
  // can any queen of `me` make a move at all (a step to an empty square or onto an enemy piece)?
  function queenMoves(s, me) {
    var qs = h.pieces(s, me, 'q');
    for (var i = 0; i < qs.length; i++) {
      var r = h.row(qs[i]), c = h.col(qs[i]);
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
        var p = s.board[rr * 8 + cc];
        if (!p || h.colorOf(p) !== me) return true;
      }
    }
    return false;
  }
  function canTakeKing(s, me, cfg) { var k = h.kingSq(s, h.other(me)); return k >= 0 && h.attacked(s, k, me, cfg); }
  // the enemy piece types the pieces of `me` attack in s, added to `have` (a string of type letters)
  function studied(s, me, cfg, have) {
    have = have || '';
    if (have.length >= 6) return have;
    var foe = h.other(me);
    for (var i = 0; i < 64; i++) {
      var p = s.board[i];
      if (!p || h.colorOf(p) !== foe) continue;
      var t = h.type(p);
      if (have.indexOf(t) >= 0) continue;
      if (h.attacked(s, i, me, cfg)) have += t;
    }
    return have;
  }
  function count(s, c) { var k = 0; for (var i = 0; i < 64; i++) if (s.board[i] && h.colorOf(s.board[i]) === c) k++; return k; }
  var CENTER = [27, 28, 35, 36]; // d5 e5 d4 e4
  function middleSquare(rng) { return (3 + rng.int(2)) * 8 + rng.int(8); } // ranks 4 and 5: nobody attacks them at the start
  var PLURAL = { n: 'knights', b: 'bishops', r: 'rooks' };

  DB.register([
    { id: 'hipster', name: 'Hipster', text: 'You can\'t move the same piece type as your opponent\'s last move.',
      filter: only(function (ctx, m) { return !ctx.foeLast || h.type(m.piece) !== h.type(ctx.foeLast.p); }) },

    { id: 'savior_complex', name: 'Savior Complex', text: 'When you are in check, you must move your queen, or you lose if you can\'t.',
      filter: function (ctx, moves) {
        if (!h.checked(ctx.s, ctx.me, ctx.cfg)) return moves;
        return moves.filter(function (m) { return h.type(m.piece) === 'q' || kingTake(ctx, m); });
      },
      lose: function (ctx) {
        var s = ctx.s;
        if (s.turn !== ctx.me || !h.checked(s, ctx.me, ctx.cfg)) return false;
        return !queenMoves(s, ctx.me) && !canTakeKing(s, ctx.me, ctx.cfg);
      },
      status: function (ctx) { return h.checked(ctx.s, ctx.me, ctx.cfg) ? 'You are in check: move your queen.' : ''; } },

    { id: 'reconnaissance', name: 'Reconnaissance', text: 'You start unable to capture. Whenever your turn ends, every enemy piece type your pieces attack becomes studied, and you can only capture studied types.',
      filter: only(spare(function (ctx, m) { return !m.cap || (ctx.mem || '').indexOf(h.type(m.cap)) >= 0; })),
      after: function (ctx, m, n) { return n.lost ? ctx.mem : studied(n, ctx.me, ctx.cfg, ctx.mem || ''); },
      status: function (ctx) { var t = (ctx.mem || '').split('').filter(function (x) { return x !== 'k'; }); return t.length ? 'Studied: ' + t.map(function (x) { return h.NAME[x]; }).join(', ') + '.' : 'Nothing studied yet.'; } },

    { id: 'control_center', name: 'Control Center', text: 'Your non-capturing moves must go to the four central files (c to f).',
      filter: only(function (ctx, m) { return !!m.cap || kingTake(ctx, m) || (h.col(m.to) >= 2 && h.col(m.to) <= 5); }) },

    { id: 'haunted', name: 'Haunted', text: 'You can\'t move to a square that you have captured on.',
      filter: function (ctx, moves) {
        var bad = {}, any = false;
        ctx.hist.forEach(function (e) { if (e.by === ctx.me && e.cap) { bad[e.to] = true; any = true; } });
        return any ? moves.filter(function (m) { return !bad[m.to] || kingTake(ctx, m); }) : moves;
      } },

    { id: 'tower_defense', name: 'Tower Defense', text: 'You can\'t move your rooks (nor castle). If you lose all your rooks, you lose.',
      filter: only(function (ctx, m) { return h.type(m.piece) !== 'r' && !m.castle; }),
      lose: function (ctx) { return !h.pieces(ctx.s, ctx.me, 'r').length; } },

    { id: 'paranoid', name: 'Paranoid', text: 'Your king must always be defended: you can\'t make a move after which your king is not defended by one of your pieces.',
      filter: only(function (ctx, m) {
        if (kingTake(ctx, m)) return true;
        var n = after(ctx, m), k = h.kingSq(n, ctx.me);
        return k >= 0 && h.attacked(n, k, ctx.me, ctx.cfg);
      }) },

    { id: 'bipartisanship', name: 'Bipartisanship', text: 'You can\'t move left twice in a row or right twice in a row.',
      filter: only(function (ctx, m) { var l = ctx.myLast; if (!l) return true; var d = Math.sign(h.col(l.to) - h.col(l.from)); return !d || horiz(m) !== d; }) },

    { id: 'shellshocked', name: 'Shellshocked', text: 'When your opponent captures, your pieces next to that square can\'t move on your next turn.',
      filter: function (ctx, moves) {
        var l = ctx.last;
        if (!l || l.by !== ctx.foe || !l.cap) return moves;
        return moves.filter(function (m) { return !h.adj(m.from, l.to); });
      },
      status: function (ctx) { var l = ctx.last; return l && l.by === ctx.foe && l.cap ? 'Your pieces next to ' + h.sqName(l.to) + ' can\'t move.' : ''; } },

    { id: 'comfort_zone', name: 'Comfort Zone', text: 'If you can move to a certain square, you must.',
      setup: function (rng) { return { sq: middleSquare(rng) }; },
      textOf: function (p) { return 'If you can move to ' + h.sqName(p.sq) + ', you must.'; },
      filter: function (ctx, moves) { var q = ctx.params.sq; return mustK(function (c, m) { return m.to === q; })(ctx, moves); } },

    { id: 'king_of_the_hill', name: 'King of the Hill', text: 'From your second turn on, if you start your turn without a piece in the four center squares, you lose.',
      lose: function (ctx) {
        if (ctx.s.turn !== ctx.me || ctx.myMoves < 1) return false;
        var b = ctx.s.board;
        return !CENTER.some(function (q) { return b[q] && h.colorOf(b[q]) === ctx.me; });
      } },

    { id: 'lethal_attraction', name: 'Lethal Attraction', text: 'You can\'t make a move that places the moving piece farther away from your opponent\'s king.',
      filter: function (ctx, moves) {
        var k = h.kingSq(ctx.s, ctx.foe);
        if (k < 0) return moves;
        return moves.filter(function (m) { return h.dist(m.to, k) <= h.dist(m.from, k); });
      } },

    { id: 'modest', name: 'Modest', text: 'You lose if you have more pieces than your opponent.',
      lose: function (ctx) { return count(ctx.s, ctx.me) > count(ctx.s, ctx.foe); } },

    { id: 'triple_play', name: 'Triple Play', text: 'You can only capture the enemy king if you have three pieces of a certain type.',
      setup: function (rng) { return { t: rng.pick(['n', 'b', 'r']) }; },
      textOf: function (p) { return 'You can only capture the enemy king if you have three ' + PLURAL[p.t] + '.'; },
      filter: function (ctx, moves) {
        if (h.pieces(ctx.s, ctx.me, ctx.params.t || 'n').length >= 3) return moves;
        return moves.filter(function (m) { return !kingTake(ctx, m); });
      } },

    { id: 'sibling_rivalry', name: 'Sibling Rivalry', text: 'You can\'t move a piece to a square next to an enemy piece of the same type.',
      filter: only(spare(function (ctx, m) {
        var skip = m.cap && m.capSq !== m.to ? m.capSq : -1;
        if (nearOwn(ctx.s, m.to, ctx.foe, arrives(m), skip)) return false;
        if (m.castle) { var rq = (m.from + m.to) >> 1; if (nearOwn(ctx.s, rq, ctx.foe, 'r', -1)) return false; }
        return true;
      })) },

    { id: 'torchlight', name: 'Torchlight', text: 'Your pieces other than pawns can only make moves that start or end next to one of your pawns.',
      filter: only(function (ctx, m) {
        if (h.type(m.piece) === 'p') return true;
        return nearOwn(ctx.s, m.from, ctx.me, 'p', -1) || nearOwn(ctx.s, m.to, ctx.me, 'p', -1);
      }) },

    { id: 'turn_the_other_cheek', name: 'Turn the Other Cheek', text: 'You can\'t recapture: you can\'t capture on the square where your opponent just captured.',
      filter: function (ctx, moves) {
        var l = ctx.last;
        if (!l || l.by !== ctx.foe || !l.cap) return moves;
        return moves.filter(function (m) { return !m.cap || m.to !== l.to || kingTake(ctx, m); });
      } },

    { id: 'gambler', name: 'Gambler', text: 'Each turn a random piece type is picked, and you can\'t move that type.', turnRandom: true,
      pickOf: function (ctx) {
        var kinds = [];
        h.pieces(ctx.s, ctx.me).forEach(function (q) { var t = h.type(ctx.s.board[q]); if (kinds.indexOf(t) < 0) kinds.push(t); });
        kinds.sort();
        return kinds.length ? h.turnRng(ctx).pick(kinds) : '';
      },
      filter: function (ctx, moves) { var t = this.pickOf(ctx); return moves.filter(function (m) { return h.type(m.piece) !== t; }); },
      status: function (ctx) { var t = this.pickOf(ctx); return t ? 'This turn: you can\'t move a ' + h.NAME[t] + '.' : ''; } },

    { id: 'blinded_by_the_sun', name: 'Blinded by the Sun', text: 'You can\'t end your turn attacking a certain square.',
      setup: function (rng) { return { sq: middleSquare(rng) }; },
      textOf: function (p) { return 'You can\'t end your turn attacking ' + h.sqName(p.sq) + '.'; },
      filter: only(spare(function (ctx, m) { return !h.attacked(after(ctx, m), ctx.params.sq, ctx.me, ctx.cfg); })) },

    { id: 'bishop_fan_club', name: 'Bishop Fan Club', text: 'You must promote to bishops. Your king and queen can only move diagonally.',
      filter: only(function (ctx, m) {
        if (m.promo && m.promo !== 'b') return false;
        var t = h.type(m.piece);
        if (t !== 'k' && t !== 'q') return true;
        return !m.castle && Math.abs(h.row(m.to) - h.row(m.from)) === Math.abs(h.col(m.to) - h.col(m.from));
      }) },

    { id: 'truant', name: 'Truant', text: 'You can\'t move the same piece twice in a row.',
      filter: only(function (ctx, m) {
        var l = ctx.myLast;
        if (!l) return true;
        return m.from !== l.to && !(l.castle && m.from === l.pass);
      }) },

    { id: 'chivalry', name: 'Chivalry', text: 'You can only capture rooks and queens with a knight.',
      filter: only(function (ctx, m) { var t = h.type(m.cap); return (t !== 'r' && t !== 'q') || h.type(m.piece) === 'n'; }) },

    { id: 'spread_out', name: 'Spread Out', text: 'You can\'t move a piece other than a pawn next to another one of your pieces other than pawns, and you can\'t castle.',
      filter: only(function (ctx, m) {
        if (m.castle) return false;
        if (h.type(m.piece) === 'p' || kingTake(ctx, m)) return true;
        return !nearOwn(ctx.s, m.to, ctx.me, function (t) { return t !== 'p'; }, m.from);
      }) },

    { id: 'peons_first', name: 'Peons First', text: 'You can\'t move pieces that stand one square behind one of your pawns.',
      filter: only(function (ctx, m) {
        var q = m.from + (ctx.me === 'w' ? -8 : 8);
        return q < 0 || q > 63 || ctx.s.board[q] !== (ctx.me === 'w' ? 'P' : 'p');
      }) },

    { id: 'moving_day', name: 'Moving Day', text: 'From your 21st move on, your pieces can\'t be on your home rank: you lose if one is there at the end of your turn.',
      lose: function (ctx) {
        if (!ctx.last || ctx.last.by !== ctx.me || ctx.myMoves < 21) return false;
        return h.pieces(ctx.s, ctx.me).some(function (q) { return h.rankOf(q, ctx.me) === 1; });
      },
      status: function (ctx) { return ctx.moveNo >= 21 ? 'Your pieces must leave your home rank this turn.' : ctx.moveNo >= 15 ? 'From move 21 on your home rank must be empty.' : ''; } },

    { id: 'oddball', name: 'Oddball', text: 'You can only capture on odd-numbered moves.',
      filter: only(spare(function (ctx, m) { return !m.cap || ctx.moveNo % 2 === 1; })) },

    { id: 'even_keeled', name: 'Even Keeled', text: 'You can only capture on even-numbered moves.',
      filter: only(spare(function (ctx, m) { return !m.cap || ctx.moveNo % 2 === 0; })) },

    { id: 'social_distancing', name: 'Social Distancing', text: 'You can\'t make non-capturing moves to squares next to your opponent\'s pieces.',
      filter: only(function (ctx, m) { return !!m.cap || kingTake(ctx, m) || !nearOwn(ctx.s, m.to, ctx.foe, null, -1); }) },

    { id: 'far_sighted', name: 'Far Sighted', text: 'Your pieces can\'t capture pieces that are next to them.',
      filter: only(spare(function (ctx, m) { return !m.cap || !h.adj(m.from, m.capSq >= 0 ? m.capSq : m.to); })) },

    { id: 'hold_them_back', name: 'Hold Them Back', text: 'You lose if your opponent moves a pawn to your side of the board.',
      lose: function (ctx) {
        var P = ctx.foe === 'w' ? 'P' : 'p', b = ctx.s.board;
        for (var i = 0; i < 64; i++) if (b[i] === P && h.rankOf(i, ctx.me) <= 4) return true;
        var l = ctx.last; // a pawn that promoted on the way (it must have crossed already, but to be sure)
        return !!l && l.by === ctx.foe && h.type(l.p) === 'p' && h.rankOf(l.to, ctx.me) <= 4;
      } },

    { id: 'whites_of_their_eyes', name: 'Whites of Their Eyes', text: 'Your capturing moves must be of distance 2 or less.',
      filter: only(spare(function (ctx, m) { return !m.cap || h.moveDist(m) <= 2; })) },

    { id: 'drag', name: 'Drag', text: 'Your queen is a king: it moves like one, and if it is captured, you lose.',
      filter: only(function (ctx, m) { return h.type(m.piece) !== 'q' || h.moveDist(m) === 1; }),
      lose: function (ctx) { var l = ctx.last; return !!l && l.by === ctx.foe && h.type(l.cap) === 'q'; } },

    { id: 'stir_crazy', name: 'Stir Crazy', text: 'If you haven\'t moved your king 4 turns in a row, you must move it on the fifth.',
      due: function (ctx) {
        var k = 0;
        for (var i = ctx.hist.length - 1; i >= 0 && k < 4; i--) {
          var e = ctx.hist[i];
          if (e.by !== ctx.me) continue;
          if (h.type(e.p) === 'k') return false;
          k++;
        }
        return k >= 4;
      },
      filter: function (ctx, moves) { return this.due(ctx) ? mustK(function (c, m) { return h.type(m.piece) === 'k'; })(ctx, moves) : moves; },
      status: function (ctx) { return this.due(ctx) ? 'This turn: move your king if you can.' : ''; } },

    { id: 'rook_on_the_seventh', name: 'Rook on the Seventh', text: 'By your 15th move, you must have moved a rook to the seventh rank, or you lose.',
      after: function (ctx, m) { return !!ctx.mem || (h.type(m.piece) === 'r' && h.rankOf(m.to, ctx.me) === 7); },
      lose: function (ctx) { return ctx.myMoves >= 15 && !ctx.mem; },
      status: function (ctx) { return ctx.mem ? '' : 'Move a rook to your seventh rank by move 15 (move ' + ctx.moveNo + ' now).'; } },

    { id: 'guerilla_tactics', name: 'Guerilla Tactics', text: 'After a capturing move, you must return the capturing piece to where it came from on your next move, if possible.',
      filter: function (ctx, moves) {
        var l = ctx.myLast;
        if (!l || !l.cap) return moves;
        return mustK(function (c, m) { return m.from === l.to && m.to === l.from; })(ctx, moves);
      },
      status: function (ctx) { var l = ctx.myLast; return l && l.cap ? 'Move the piece on ' + h.sqName(l.to) + ' back to ' + h.sqName(l.from) + ' if you can.' : ''; } },

    { id: 'cheerleaders', name: 'Cheerleaders', text: 'Your pieces other than pawns can only capture while next to one of your pawns.',
      filter: only(spare(function (ctx, m) { return !m.cap || h.type(m.piece) === 'p' || nearOwn(ctx.s, m.from, ctx.me, 'p', -1); })) },

    { id: 'scouting_ahead', name: 'Scouting Ahead', text: 'As long as you have a pawn, you can\'t move pieces other than pawns ahead of your most advanced pawn.',
      filter: function (ctx, moves) {
        var ps = h.pieces(ctx.s, ctx.me, 'p');
        if (!ps.length) return moves;
        var top = 0;
        ps.forEach(function (q) { top = Math.max(top, h.rankOf(q, ctx.me)); });
        return moves.filter(function (m) { return h.type(m.piece) === 'p' || kingTake(ctx, m) || h.rankOf(m.to, ctx.me) <= top; });
      } },

    { id: 'spice_of_life', name: 'Spice of Life', text: 'You can\'t move the same piece type twice in a row.',
      filter: only(function (ctx, m) { return !ctx.myLast || h.type(m.piece) !== h.type(ctx.myLast.p); }) }
  ]);
})(typeof self !== 'undefined' ? self : this);
