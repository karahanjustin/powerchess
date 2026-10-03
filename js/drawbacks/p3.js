/* Drawback Chess, more drawbacks (see js/drawbacks.js for the terms and the ctx). */
(function (root) {
  'use strict';
  var DB = root.Drawbacks || (typeof require !== 'undefined' ? require('../drawbacks.js') : null), h = DB.h;
  var R = root.Rules || (typeof require !== 'undefined' ? require('../rules.js') : null);
  var only = function (fn) { return function (ctx, moves) { return moves.filter(function (m) { return fn(ctx, m); }); }; };
  var must = function (fn) { return function (ctx, moves) { var x = moves.filter(function (m) { return fn(ctx, m); }); return x.length ? x : moves; }; };
  /* local helpers */
  var kc = h.isKingCap;
  var noKingRule = function (fn) { return function (ctx, m) { return kc(m) || fn(ctx, m); }; }; // capture and square rules spare the king
  // a "must" rule: the moves that satisfy it (taking the king is always among them), else all moves
  var mustK = function (fn) { return function (ctx, moves) { var x = moves.filter(function (m) { return fn(ctx, m); }); return x.length ? moves.filter(function (m) { return kc(m) || fn(ctx, m); }) : moves; }; };
  var startOfTurn = function (ctx) { return ctx.s.turn === ctx.me && !ctx.s.lost; };
  var endOfTurn = function (ctx) { return !!ctx.last && ctx.last.by === ctx.me; };
  // is there a legal move that satisfies fn (taking the king always does)?
  var anyMove = function (ctx, fn) { return R.legalMoves(ctx.s, ctx.cfg).some(function (m) { return kc(m) || fn(ctx, m); }); };
  var mine = function (ctx, q) { var p = ctx.s.board[q]; return !!p && h.colorOf(p) === ctx.me; };
  var leftward = function (m, me) { return me === 'w' ? h.col(m.to) < h.col(m.from) : h.col(m.to) > h.col(m.from); };
  var rightward = function (m, me) { return me === 'w' ? h.col(m.to) > h.col(m.from) : h.col(m.to) < h.col(m.from); };
  var isCap = function (ctx, m) { return !!m.cap; };
  var DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  // the squares the queens of `c` attack (the first piece on each line included)
  function queenSeen(s, c) {
    var seen = {}, qs = h.pieces(s, c, 'q');
    for (var i = 0; i < qs.length; i++) {
      for (var d = 0; d < 8; d++) {
        var r = h.row(qs[i]) + DIRS[d][0], f = h.col(qs[i]) + DIRS[d][1];
        while (r >= 0 && r < 8 && f >= 0 && f < 8) { var q = r * 8 + f; seen[q] = true; if (s.board[q]) break; r += DIRS[d][0]; f += DIRS[d][1]; }
      }
    }
    return seen;
  }
  // own moves of the owner, oldest first
  function ownHist(ctx) { return ctx.hist.filter(function (e) { return e.by === ctx.me; }); }
  // the squares a castling rook leaves and reaches
  function rookFrom(e) { return e.castle === 'K' ? e.from + 3 : e.castle === 'Q' ? e.from - 4 : -1; }
  var START_COLS = { r: [0, 7], n: [1, 6], b: [2, 5], q: [3], k: [4] };
  function fischerOk(ctx) {
    var ps = h.pieces(ctx.s, ctx.me);
    for (var i = 0; i < ps.length; i++) {
      var t = h.type(ctx.s.board[ps[i]]);
      if (t === 'p') continue;
      if (h.rankOf(ps[i], ctx.me) !== 1 || START_COLS[t].indexOf(h.col(ps[i])) >= 0) return false;
    }
    return true;
  }
  function inWindow(n, at) { return n >= at && n <= at + 3; }
  // Bloodthirsty: own moves in a row without a capture, counted from the 4th move on
  function dryStreak(ctx) {
    var k = ctx.myMoves, streak = 0;
    for (var i = ctx.hist.length - 1; i >= 0 && k >= 4; i--) {
      var e = ctx.hist[i];
      if (e.by !== ctx.me) continue;
      if (e.cap) break;
      streak++; k--;
      if (streak >= 2) break;
    }
    return streak;
  }
  function crusadeFits(ctx, m) {
    var sq = ctx.params.sq;
    if (m.to === sq) return true;
    return mine(ctx, sq) && m.from !== sq && !(m.castle && rookFrom(m) === sq);
  }
  // Unlucky: the squares closed this turn (on the first move drawn again until a move is left)
  function closedOf(ctx, moves) {
    for (var t = 0; t < 30; t++) {
      var r = h.turnRng(ctx, t ? String(t) : ''), a = [], closed = {}, i;
      for (i = 0; i < 64; i++) a.push(i);
      for (i = 0; i < 32; i++) { var j = i + r.int(64 - i), x = a[i]; a[i] = a[j]; a[j] = x; closed[a[i]] = true; }
      if (ctx.myMoves > 0 || !moves || moves.some(function (m) { return kc(m) || !closed[m.to]; })) return closed;
    }
    return {};
  }
  var PRE = { n: 'p', b: 'n', r: 'b', q: 'r', k: 'q' };

  DB.register([
    { id: 'warlord', name: 'Warlord', text: 'From your 12th move on, your king must not be on your first two ranks, or you lose.',
      lose: function (ctx) { if (!endOfTurn(ctx) || ctx.myMoves < 12) return false; var k = h.kingSq(ctx.s, ctx.me); return k >= 0 && h.rankOf(k, ctx.me) <= 2; },
      status: function (ctx) { return ctx.moveNo >= 12 ? 'Your king must end this move off your first two ranks.' : ctx.moveNo >= 9 ? 'From move 12 your king must be off your first two ranks.' : ''; } },
    { id: 'medusa', name: 'Medusa', text: 'Your pieces attacked by your opponent\'s queen are turned to stone and can\'t move.',
      filter: function (ctx, moves) { var seen = queenSeen(ctx.s, ctx.foe); return moves.filter(function (m) { return !seen[m.from]; }); } },
    { id: 'fischer_random', name: 'Fischer Random', text: 'By your 20th move, all your remaining non-pawn pieces must be on your home rank, each on a square it couldn\'t have started on, or you lose.',
      lose: function (ctx) { return endOfTurn(ctx) && ctx.myMoves === 20 && !fischerOk(ctx); },
      status: function (ctx) { return ctx.moveNo <= 20 ? 'Move ' + ctx.moveNo + ' of 20.' : ''; } },
    { id: 'centralized_command', name: 'Centralized Command', text: 'You can only capture if you moved your king in your last three turns.',
      filter: function (ctx, moves) {
        var own = ownHist(ctx).slice(-3), ok = own.some(function (e) { return h.type(e.p) === 'k'; });
        return ok ? moves : moves.filter(function (m) { return !m.cap || kc(m); });
      } },
    { id: 'stand_your_ground', name: 'Stand Your Ground', text: 'Your pieces can only capture if they are attacked.',
      filter: function (ctx, moves) {
        var memo = {};
        return moves.filter(function (m) {
          if (!m.cap || kc(m)) return true;
          if (memo[m.from] === undefined) memo[m.from] = !!h.attacked(ctx.s, m.from, ctx.foe, ctx.cfg);
          return memo[m.from];
        });
      } },
    { id: 'glorious_battle', name: 'Glorious Battle', text: 'For four turns in a row starting on a random move from your 5th to your 15th, you must capture, or you lose.',
      setup: function (r) { return { at: 5 + r.int(11) }; },
      textOf: function (p) { return 'For four turns in a row starting on your ' + p.at + 'th move, you must capture, or you lose.'; },
      filter: function (ctx, moves) { return inWindow(ctx.moveNo, ctx.params.at) ? must(isCap)(ctx, moves) : moves; },
      lose: function (ctx) {
        var at = ctx.params.at;
        if (endOfTurn(ctx) && inWindow(ctx.myMoves, at) && !ctx.last.cap) return true;
        return startOfTurn(ctx) && inWindow(ctx.moveNo, at) && !anyMove(ctx, isCap);
      },
      status: function (ctx) { var at = ctx.params.at; return inWindow(ctx.moveNo, at) ? 'You must capture this turn (' + (ctx.moveNo - at + 1) + ' of 4).' : ctx.moveNo < at ? 'Your battle starts on move ' + at + '.' : ''; } },
    { id: 'flatterer', name: 'Flatterer', text: 'If your opponent moves a pawn, you must move a pawn. If your opponent moves a non-pawn piece, you must move a non-pawn piece.',
      filter: function (ctx, moves) {
        if (!ctx.foeLast) return moves;
        var pawn = h.type(ctx.foeLast.p) === 'p';
        return mustK(function (c, m) { return (h.type(m.piece) === 'p') === pawn; })(ctx, moves);
      } },
    { id: 'messy_divorce', name: 'Messy Divorce', text: 'Your pieces can\'t move from the queenside (a to d files) to the kingside (e to h files) or the other way round.',
      filter: only(function (ctx, m) { return (h.col(m.from) < 4) === (h.col(m.to) < 4); }) },
    { id: 'leveling_up', name: 'Leveling Up', text: 'You can\'t capture a piece until you have captured its predecessor in the list pawn, knight, bishop, rook, queen, king.',
      filter: function (ctx, moves) {
        var got = {};
        ctx.hist.forEach(function (e) { if (e.by === ctx.me && e.cap) got[h.type(e.cap)] = true; });
        return moves.filter(function (m) { if (!m.cap) return true; var t = h.type(m.cap); return t === 'p' || !!got[PRE[t]]; });
      } },
    { id: 'homeland_security', name: 'Homeland Security', text: 'If your opponent moves into your 16 starting squares, you lose.',
      lose: function (ctx) { var e = ctx.last; return !!e && e.by === ctx.foe && e.to >= 0 && h.rankOf(e.to, ctx.me) <= 2; } },
    { id: 'cowering_in_fear', name: 'Cowering in Fear', text: 'You can\'t move a piece of lower value than one your opponent has taken.',
      filter: function (ctx, moves) {
        var top = 0;
        ctx.hist.forEach(function (e) { if (e.by === ctx.foe && e.cap) top = Math.max(top, h.val(e.cap)); });
        return top ? moves.filter(function (m) { return h.val(m.piece) >= top; }) : moves;
      } },
    { id: 'barbarian_rage', name: 'Barbarian Rage', text: 'If you captured on your last move, you must capture if able.',
      filter: function (ctx, moves) { return ctx.myLast && ctx.myLast.cap ? must(isCap)(ctx, moves) : moves; } },
    { id: 'my_kingdom_for_a_horse', name: 'My Kingdom for a Horse', text: 'If your opponent captures one of your knights, you lose.',
      lose: function (ctx) { return ctx.hist.some(function (e) { return e.by === ctx.foe && h.type(e.cap) === 'n'; }); } },
    { id: 'eye_for_an_eye', name: 'Eye for an Eye', text: 'If your opponent captures, you must capture on your next move, or you lose.',
      filter: function (ctx, moves) { return ctx.foeLast && ctx.foeLast === ctx.last && ctx.last.cap ? must(isCap)(ctx, moves) : moves; },
      lose: function (ctx) {
        var e = ctx.last;
        if (endOfTurn(ctx) && !e.cap) { var i = ctx.hist.length - 2, p = i >= 0 ? ctx.hist[i] : null; if (p && p.by === ctx.foe && p.cap) return true; }
        return startOfTurn(ctx) && !!e && e.by === ctx.foe && !!e.cap && !anyMove(ctx, isCap);
      },
      status: function (ctx) { return ctx.last && ctx.last.by === ctx.foe && ctx.last.cap ? 'You must capture this turn.' : ''; } },
    { id: 'simon_says', name: 'Simon Says', text: 'You must move onto a square of the same color as your opponent\'s last move.',
      filter: function (ctx, moves) { if (!ctx.foeLast || ctx.foeLast.to < 0) return moves; var l = h.light(ctx.foeLast.to); return mustK(function (c, m) { return h.light(m.to) === l; })(ctx, moves); },
      status: function (ctx) { return ctx.foeLast && ctx.foeLast.to >= 0 ? 'Move onto a ' + (h.light(ctx.foeLast.to) ? 'light' : 'dark') + ' square.' : ''; } },
    { id: 'irresistible', name: 'Irresistible', text: 'If you can move a piece adjacent to your opponent\'s king that isn\'t already adjacent, you must; capturing their king is always allowed.',
      filter: function (ctx, moves) { var k = h.kingSq(ctx.s, ctx.foe); if (k < 0) return moves; return mustK(function (c, m) { return !h.adj(m.from, k) && h.adj(m.to, k); })(ctx, moves); } },
    { id: 'boastful', name: 'Boastful', text: 'You lose if you have fewer pieces than your opponent.',
      lose: function (ctx) { return h.pieces(ctx.s, ctx.me).length < h.pieces(ctx.s, ctx.foe).length; } },
    { id: 'winds_of_fate', name: 'Winds of Fate', text: 'Every turn you randomly can\'t move either left or right.', turnRandom: true,
      dirOf: function (ctx) { return h.turnRng(ctx).int(2) ? 'right' : 'left'; },
      filter: function (ctx, moves) { var d = this.dirOf(ctx), me = ctx.me; return moves.filter(function (m) { return d === 'left' ? !leftward(m, me) : !rightward(m, me); }); },
      status: function (ctx) { return 'This turn you can\'t move ' + this.dirOf(ctx) + '.'; } },
    { id: 'monkey_see', name: 'Monkey See', text: 'You can only capture with piece types that your opponent has captured with.',
      filter: function (ctx, moves) {
        var used = {};
        ctx.hist.forEach(function (e) { if (e.by === ctx.foe && e.cap) used[h.type(e.p)] = true; });
        return moves.filter(function (m) { return !m.cap || kc(m) || !!used[h.type(m.piece)]; });
      } },
    { id: 'true_love', name: 'True Love', text: 'Your king can only make moves that place it adjacent to your queen, and can\'t move without a queen. Your queen can only make moves that place it adjacent to your king.',
      filter: function (ctx, moves) {
        var qs = h.pieces(ctx.s, ctx.me, 'q'), k = h.kingSq(ctx.s, ctx.me);
        return moves.filter(function (m) {
          var t = h.type(m.piece);
          if (t === 'k') return qs.some(function (q) { return q !== m.to && h.adj(m.to, q); });
          if (t === 'q' && !m.promo) return k >= 0 && h.adj(m.to, k);
          return true;
        });
      } },
    { id: 'superstitious', name: 'Superstitious', text: 'You can\'t move to a square that your opponent has captured on.',
      filter: function (ctx, moves) {
        var bad = {};
        ctx.hist.forEach(function (e) { if (e.by === ctx.foe && e.cap) bad[e.to] = true; });
        return moves.filter(function (m) { return kc(m) || !bad[m.to]; });
      } },
    { id: 'rising_water', name: 'Rising Water', text: 'Every 10 turns the water rises one rank from your home rank. You can\'t move pieces that are under water.',
      filter: function (ctx, moves) { var lv = Math.floor(ctx.myMoves / 10); return lv ? moves.filter(function (m) { return h.rankOf(m.from, ctx.me) > lv; }) : moves; },
      status: function (ctx) { var lv = Math.floor(ctx.myMoves / 10); return (lv ? 'Under water: rank' + (lv > 1 ? 's 1 to ' + lv : ' 1') + '. ' : '') + 'The water rises after your move ' + (lv + 1) * 10 + '.'; } },
    { id: 'eat_your_vegetables', name: 'Eat Your Vegetables', text: 'You can\'t capture pieces other than pawns until your opponent has 4 or fewer pawns left.',
      filter: function (ctx, moves) { if (h.pieces(ctx.s, ctx.foe, 'p').length <= 4) return moves; return moves.filter(function (m) { return !m.cap || kc(m) || h.type(m.cap) === 'p'; }); } },
    { id: 'bloodthirsty', name: 'Bloodthirsty', text: 'From your 4th move on, if you go 2 turns without capturing, you must capture on the third, or you lose.',
      filter: function (ctx, moves) { return dryStreak(ctx) >= 2 ? must(isCap)(ctx, moves) : moves; },
      lose: function (ctx) { return startOfTurn(ctx) && dryStreak(ctx) >= 2 && !anyMove(ctx, isCap); },
      status: function (ctx) { var n = ctx.moveNo < 4 ? -1 : dryStreak(ctx); return n >= 2 ? 'You must capture this turn.' : n === 1 ? 'Capture this turn or next.' : ''; } },
    { id: 'left_for_dead', name: 'Left for Dead', text: 'You can only capture to the left (as seen from your side: towards the a-file as White, towards the h-file as Black).',
      filter: only(noKingRule(function (ctx, m) { return !m.cap || leftward(m, ctx.me); })) },
    { id: 'pacman', name: 'Pacman', text: 'If you can capture a pawn, you must.',
      filter: mustK(function (ctx, m) { return h.type(m.cap) === 'p'; }) },
    { id: 'crusade', name: 'Crusade', text: 'For four turns in a row starting on a random move from your 6th to your 14th, you must end your turn occupying a random square in the middle four ranks, or you lose.',
      setup: function (r) { return { at: 6 + r.int(9), sq: 16 + r.int(32) }; },
      textOf: function (p) { return 'For four turns in a row starting on your ' + p.at + 'th move, you must end your turn occupying ' + h.sqName(p.sq) + ', or you lose.'; },
      filter: function (ctx, moves) { return inWindow(ctx.moveNo, ctx.params.at) ? mustK(crusadeFits)(ctx, moves) : moves; },
      lose: function (ctx) {
        var at = ctx.params.at;
        if (endOfTurn(ctx) && inWindow(ctx.myMoves, at) && !mine(ctx, ctx.params.sq)) return true;
        return startOfTurn(ctx) && inWindow(ctx.moveNo, at) && !anyMove(ctx, crusadeFits);
      },
      status: function (ctx) { var p = ctx.params; return inWindow(ctx.moveNo, p.at) ? 'End this turn on ' + h.sqName(p.sq) + ' (' + (ctx.moveNo - p.at + 1) + ' of 4).' : ctx.moveNo < p.at ? 'Your crusade to ' + h.sqName(p.sq) + ' starts on move ' + p.at + '.' : ''; } },
    { id: 'pack_mentality', name: 'Pack Mentality', text: 'Your pieces must move to squares adjacent to another one of your pieces.',
      filter: mustK(function (ctx, m) {
        if (m.castle) return true;
        var r = h.row(m.to), f = h.col(m.to);
        for (var d = 0; d < 8; d++) {
          var rr = r + DIRS[d][0], ff = f + DIRS[d][1], q = rr * 8 + ff;
          if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && q !== m.from && mine(ctx, q)) return true;
        }
        return false;
      }) },
    { id: 'scorched_earth', name: 'Scorched Earth', text: 'You can\'t move to a square that you\'ve moved from.',
      filter: function (ctx, moves) {
        var burnt = {};
        ctx.hist.forEach(function (e) { if (e.by === ctx.me && e.from >= 0) { burnt[e.from] = true; if (e.castle) burnt[rookFrom(e)] = true; } });
        return moves.filter(function (m) { return kc(m) || !burnt[m.to]; });
      } },
    { id: 'hedonic_treadmill', name: 'Hedonic Treadmill', text: 'You must move a piece at least as valuable as your opponent\'s last moved piece (if you can).',
      filter: function (ctx, moves) { if (!ctx.foeLast) return moves; var v = h.val(ctx.foeLast.p); return mustK(function (c, m) { return h.val(m.piece) >= v; })(ctx, moves); } },
    { id: 'death_wish', name: 'Death Wish', text: 'If you can move your king into check (and aren\'t already in check), you must.',
      filter: function (ctx, moves) {
        if (h.checked(ctx.s, ctx.me, ctx.cfg)) return moves;
        return mustK(function (c, m) {
          if (h.type(m.piece) !== 'k' || kc(m)) return false;
          var n = R.play(ctx.s, m, ctx.cfg);
          return !n.lost && h.checked(n, ctx.me, ctx.cfg);
        })(ctx, moves);
      } },
    { id: 'closed_book', name: 'Closed Book', text: 'You lose if you ever start your turn while there\'s an open file (a file with no pawns of either side).',
      lose: function (ctx) {
        if (!startOfTurn(ctx) || !ctx.last) return false;
        var b = ctx.s.board;
        for (var f = 0; f < 8; f++) {
          var pawn = false;
          for (var r = 0; r < 8 && !pawn; r++) { var p = b[r * 8 + f]; if (p === 'p' || p === 'P') pawn = true; }
          if (!pawn) return true;
        }
        return false;
      } },
    { id: 'fixation', name: 'Fixation', text: 'Once you move a particular pawn, you cannot move a different pawn until you move a non-pawn piece. Once you move a particular non-pawn piece, you cannot move a different non-pawn piece until you move a pawn.',
      filter: function (ctx, moves) {
        var L = ctx.myLast;
        if (!L) return moves;
        var pawn = h.type(L.p) === 'p'; // the kind that is fixed on the piece that moved last, now on L.to
        return moves.filter(function (m) { return (h.type(m.piece) === 'p') !== pawn || m.from === L.to; });
      } },
    { id: 'covering_fire', name: 'Covering Fire', text: 'You can only capture a piece if you can capture it two different ways.',
      filter: function (ctx, moves) {
        var ways = {};
        moves.forEach(function (m) { if (m.cap) { var w = ways[m.capSq] || (ways[m.capSq] = {}); w[m.from] = true; } });
        return moves.filter(function (m) { return !m.cap || kc(m) || Object.keys(ways[m.capSq]).length >= 2; });
      } },
    { id: 'unlucky', name: 'Unlucky', text: 'You can\'t move to half of the squares, re-randomized every turn.', turnRandom: true,
      filter: function (ctx, moves) { var closed = closedOf(ctx, moves); return moves.filter(function (m) { return kc(m) || !closed[m.to]; }); },
      status: function (ctx, moves) {
        var closed = closedOf(ctx, moves), open = {};
        (moves || []).forEach(function (m) { if (!closed[m.to]) open[m.to] = true; });
        var names = Object.keys(open).map(function (q) { return h.sqName(+q); }).sort();
        return names.length ? 'This turn you can move to ' + names.join(', ') + '.' : 'This turn every square you could reach is closed.';
      } },
    { id: 'jumpy', name: 'Jumpy', text: 'When possible, you must move a piece that is being attacked.',
      filter: function (ctx, moves) {
        var memo = {};
        return mustK(function (c, m) { if (memo[m.from] === undefined) memo[m.from] = !!h.attacked(ctx.s, m.from, ctx.foe, ctx.cfg); return memo[m.from]; })(ctx, moves);
      } },
    { id: 'hopscotch', name: 'Hopscotch', text: 'You must alternate moving to light and dark squares.',
      filter: function (ctx, moves) { if (!ctx.myLast || ctx.myLast.to < 0) return moves; var l = !h.light(ctx.myLast.to); return mustK(function (c, m) { return h.light(m.to) === l; })(ctx, moves); },
      status: function (ctx) { return ctx.myLast && ctx.myLast.to >= 0 ? 'Move to a ' + (h.light(ctx.myLast.to) ? 'dark' : 'light') + ' square.' : ''; } },
    { id: 'leaps_and_bounds', name: 'Leaps and Bounds', text: 'You can\'t move a piece to a square adjacent to where it was.',
      filter: only(function (ctx, m) { return h.moveDist(m) !== 1; }) }
  ]);
})(typeof self !== 'undefined' ? self : this);
