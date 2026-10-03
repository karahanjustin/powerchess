/* Drawback Chess, more drawbacks (see js/drawbacks.js for the terms and the ctx). */
(function (root) {
  'use strict';
  var DB = root.Drawbacks || (typeof require !== 'undefined' ? require('../drawbacks.js') : null), h = DB.h;
  var R = root.Rules || (typeof require !== 'undefined' ? require('../rules.js') : null);
  var only = function (fn) { return function (ctx, moves) { return moves.filter(function (m) { return fn(ctx, m); }); }; };
  var noKingRule = function (fn) { return function (ctx, m) { return h.isKingCap(m) || fn(ctx, m); }; }; // capture rules spare the king
  // a "must" rule: the moves that satisfy it if there are any (taking the king always stays allowed), else all
  var mustK = function (fn) { return function (ctx, moves) { var x = moves.filter(function (m) { return fn(ctx, m); }); return x.length ? moves.filter(function (m) { return h.isKingCap(m) || fn(ctx, m); }) : moves; }; };
  var mine = function (p, me) { return !!p && h.colorOf(p) === me; };
  var ORD = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth' };
  // the rook's square of a castling move, before and after
  var rookFrom = function (m) { return m.castle === 'K' ? m.from + 3 : m.from - 4; };
  var rookTo = function (m) { return (m.from + m.to) >> 1; };
  var copy = function (o) { var c = {}; if (o) for (var k in o) c[k] = o[k]; return c; };
  var capSqOf = function (m) { return m.capSq != null && m.capSq >= 0 ? m.capSq : m.to; };

  // Rook Buddies: two rooks on the home rank with nothing between them
  function connected(s, me) {
    var home = me === 'w' ? 7 : 0, rk = me === 'w' ? 'R' : 'r', last = -1;
    for (var f = 0; f < 8; f++) {
      var p = s.board[home * 8 + f];
      if (!p) continue;
      if (p === rk && last >= 0) return true;
      last = p === rk ? f : -1;
    }
    return false;
  }
  // Separation of Church and State: is there a piece of type t next to q (not counting the square `skip`)?
  function nextTo(board, q, t, skip) {
    var r = h.row(q), c = h.col(q);
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      var rr = r + dr, cc = c + dc;
      if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
      var x = rr * 8 + cc;
      if (x !== skip && h.type(board[x]) === t) return true;
    }
    return false;
  }
  // Eye of Sauron: the most advanced rank (counted from the owner) any of its rooks sees, or 0 without rooks
  function sauronRank(s, me) {
    var rooks = h.pieces(s, me, 'r'), best = 0, D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    rooks.forEach(function (q) {
      best = Math.max(best, h.rankOf(q, me));
      D.forEach(function (d) {
        var r = h.row(q) + d[0], c = h.col(q) + d[1];
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          var x = r * 8 + c;
          best = Math.max(best, h.rankOf(x, me));
          if (s.board[x]) break;
          r += d[0]; c += d[1];
        }
      });
    });
    return best;
  }
  // You Best Not Miss: a move that takes the other king (also the king en passant after it castled)
  function takesKing(ctx, m) {
    var l = ctx.last;
    return h.isKingCap(m) || (!!l && l.by === ctx.foe && !!l.castle && (m.to === l.from || m.to === l.pass));
  }
  function shapeSq(ctx) {
    var sq = ctx.mem == null ? (ctx.me === 'w' ? 59 : 3) : ctx.mem;
    return sq >= 0 && mine(ctx.s.board[sq], ctx.me) ? sq : -1;
  }

  DB.register([
    { id: 'rook_buddies', name: 'Rook Buddies', text: 'You can\'t move your rooks until you have connected them (your two rooks on your home rank with nothing between them). Once connected, they stay free.',
      filter: function (ctx, moves) {
        if (ctx.mem || connected(ctx.s, ctx.me)) return moves;
        return moves.filter(function (m) { return m.castle || h.type(m.piece) !== 'r'; });
      },
      after: function (ctx, m, n) { return !!(ctx.mem || connected(ctx.s, ctx.me) || connected(n, ctx.me)); } },

    { id: 'duck', name: 'Duck', text: 'There is a duck sleeping on a square in the middle of the board. You can\'t move through it or onto it.',
      setup: function (r) { return { sq: (2 + r.int(4)) * 8 + r.int(8) }; },
      textOf: function (p) { return 'There is a duck sleeping on ' + h.sqName(p.sq) + '. You can\'t move through it or onto it.'; },
      filter: only(function (ctx, m) {
        var d = ctx.params.sq;
        if (m.to === d && !h.isKingCap(m)) return false;
        if (m.castle) return h.path({ from: rookFrom(m), to: rookTo(m) }).indexOf(d) < 0 && rookTo(m) !== d && h.path(m).indexOf(d) < 0;
        return h.path(m).indexOf(d) < 0;
      }) },

    { id: 'separation_anxiety', name: 'Separation Anxiety', text: 'Your pawns next to your king can\'t make moves that take them away from the squares next to him.',
      filter: only(function (ctx, m) {
        if (h.type(m.piece) !== 'p' || h.isKingCap(m)) return true;
        var k = h.kingSq(ctx.s, ctx.me);
        return k < 0 || !h.adj(m.from, k) || h.adj(m.to, k);
      }) },

    { id: 'crossing_the_rubicon', name: 'Crossing the Rubicon', text: 'Once a piece has crossed to your opponent\'s half of the board, it can\'t go back.',
      filter: only(function (ctx, m) { return h.rankOf(m.from, ctx.me) < 5 || h.rankOf(m.to, ctx.me) >= 5; }) },

    { id: 'queen_disguise', name: 'Queen Disguise', text: 'Your queen is secretly a rook or a bishop. Once it has moved like one, it can\'t move like the other.',
      kindOf: function (m) { return h.row(m.from) === h.row(m.to) || h.col(m.from) === h.col(m.to) ? 'r' : 'b'; },
      filter: function (ctx, moves) {
        var mem = ctx.mem || {}, self = this;
        return moves.filter(function (m) { return h.type(m.piece) !== 'q' || !mem[m.from] || mem[m.from] === self.kindOf(m); });
      },
      after: function (ctx, m, n) {
        var mem = copy(ctx.mem), k = h.type(m.piece) === 'q' ? (mem[m.from] || this.kindOf(m)) : '';
        delete mem[m.from]; delete mem[m.to];
        if (m.castle) { delete mem[rookFrom(m)]; delete mem[rookTo(m)]; }
        if (k) mem[m.to] = k;
        return mem;
      },
      status: function (ctx) {
        var mem = ctx.mem || {}, out = [];
        h.pieces(ctx.s, ctx.me, 'q').forEach(function (q) { if (mem[q]) out.push('the queen on ' + h.sqName(q) + ' moves like a ' + h.NAME[mem[q]]); });
        return out.length ? 'Now ' + out.join(', ') + '.' : '';
      } },

    { id: 'queen_bee', name: 'Queen Bee', text: 'Once you have captured with a queen, you can\'t move queens any more.',
      filter: function (ctx, moves) {
        var me = ctx.me;
        if (!ctx.hist.some(function (e) { return e.by === me && e.cap && h.type(e.p) === 'q'; })) return moves;
        return moves.filter(function (m) { return h.type(m.piece) !== 'q'; });
      } },

    { id: 'shadow_queen', name: 'Shadow Queen', text: 'Your queen can only move to dark squares.',
      filter: only(function (ctx, m) { return h.type(m.piece) !== 'q' || h.isKingCap(m) || !h.light(m.to); }) },

    { id: 'quit_horsing_around', name: 'Quit Horsing Around', text: 'If you moved a knight last move, you can\'t move a knight.',
      filter: function (ctx, moves) {
        if (!ctx.myLast || h.type(ctx.myLast.p) !== 'n') return moves;
        return moves.filter(function (m) { return h.type(m.piece) !== 'n'; });
      } },

    { id: 'royal_jubilee', name: 'Royal Jubilee', text: 'When you capture a piece other than a pawn, you must move your king or queen next (if you can).',
      due: function (ctx) { var l = ctx.myLast; return !!l && !!l.cap && h.type(l.cap) !== 'p'; },
      filter: function (ctx, moves) {
        if (!this.due(ctx)) return moves;
        return mustK(function (c, m) { var t = h.type(m.piece); return t === 'k' || t === 'q'; })(ctx, moves);
      },
      status: function (ctx) { return this.due(ctx) ? 'This turn: move your king or queen.' : ''; } },

    { id: 'prima_donna', name: 'Prima Donna', text: 'You can\'t make a move that leaves two of your pawns on the same file.',
      filter: function (ctx, moves) {
        var b = ctx.s.board, pw = ctx.me === 'w' ? 'P' : 'p', cnt = [0, 0, 0, 0, 0, 0, 0, 0];
        for (var i = 0; i < 64; i++) if (b[i] === pw) cnt[i & 7]++;
        return moves.filter(function (m) {
          if (h.isKingCap(m)) return true;
          if (h.type(m.piece) !== 'p') return Math.max.apply(null, cnt) < 2;
          var c = cnt.slice();
          c[h.col(m.from)]--;
          if (!m.promo) c[h.col(m.to)]++;
          return Math.max.apply(null, c) < 2;
        });
      } },

    { id: 'church_and_state', name: 'Separation of Church and State', text: 'You can\'t move a bishop next to a king, and you can\'t move your king next to a bishop.',
      filter: only(function (ctx, m) {
        if (h.isKingCap(m)) return true;
        var b = ctx.s.board, t = m.promo ? m.promo : h.type(m.piece);
        if (t === 'b') return !nextTo(b, m.to, 'k', m.from);
        if (t === 'k') return !nextTo(b, m.to, 'b', m.castle ? rookFrom(m) : -1);
        return true;
      }) },

    { id: 'escort_mission', name: 'Escort Mission', text: 'If your king can capture, it must.',
      filter: mustK(function (ctx, m) { return h.type(m.piece) === 'k' && !!m.cap; }) },

    { id: 'champing_at_the_bit', name: 'Champing at the Bit', text: 'Your pawns can only make moves of distance 2.',
      filter: only(function (ctx, m) { return h.type(m.piece) !== 'p' || h.isKingCap(m) || h.moveDist(m) === 2; }) },

    { id: 'battle_fatigue', name: 'Battle Fatigue', text: 'When a piece captures, it can\'t capture again until it has made a move that is not a capture.',
      filter: only(noKingRule(function (ctx, m) { return !m.cap || !(ctx.mem && ctx.mem[m.from]); })),
      after: function (ctx, m, n) {
        var mem = copy(ctx.mem);
        delete mem[m.from];
        if (m.castle) { delete mem[rookFrom(m)]; delete mem[rookTo(m)]; }
        if (m.cap) mem[m.to] = true; else delete mem[m.to];
        return mem;
      } },

    { id: 'no_shuffling', name: 'No Shuffling', text: 'Your rooks can\'t move sideways.',
      filter: only(function (ctx, m) { return h.type(m.piece) !== 'r' || !h.lateral(m); }) },

    { id: 'outflanked', name: 'Outflanked', text: 'You can\'t capture on the rim (the outer squares), except to capture the king.',
      filter: only(noKingRule(function (ctx, m) { return !m.cap || !h.rim(capSqOf(m)); })) },

    { id: 'professional_courtesy', name: 'Professional Courtesy', text: 'You can\'t capture pieces other than pawns with pieces of the same type.',
      filter: only(noKingRule(function (ctx, m) { var t = h.type(m.cap); return !m.cap || t === 'p' || t !== h.type(m.piece); })) },

    { id: 'snipers', name: 'Snipers', text: 'Your bishops can only capture from a distance of 3 or more.',
      filter: only(noKingRule(function (ctx, m) { return !m.cap || h.type(m.piece) !== 'b' || h.moveDist(m) >= 3; })) },

    { id: 'diplomatic_immunity', name: 'Diplomatic Immunity', text: 'You can\'t capture a piece that just moved, unless its move was a capture.',
      filter: function (ctx, moves) {
        var l = ctx.last;
        if (!l || l.by !== ctx.foe || l.cap) return moves;
        var moved = [l.to];
        if (l.castle) moved.push(l.pass);
        return moves.filter(function (m) { return h.isKingCap(m) || !m.cap || moved.indexOf(capSqOf(m)) < 0; });
      } },

    { id: 'simplifier', name: 'Simplifier', text: 'If you can capture a piece with a piece of lower or equal value, you must.',
      filter: mustK(function (ctx, m) { return !!m.cap && h.val(m.piece) <= h.val(m.cap); }) },

    { id: 'sleepy_king', name: 'Sleepy King', text: 'Your king can only move when it is in check.',
      filter: function (ctx, moves) {
        if (h.checked(ctx.s, ctx.me, ctx.cfg)) return moves;
        return moves.filter(function (m) { return h.type(m.piece) !== 'k' || h.isKingCap(m); });
      } },

    { id: 'get_down_mr_president', name: 'Get Down Mr. President', text: 'You can\'t move your king while it is in check.',
      filter: function (ctx, moves) {
        if (!h.checked(ctx.s, ctx.me, ctx.cfg)) return moves;
        return moves.filter(function (m) { return h.type(m.piece) !== 'k'; });
      } },

    { id: 'power_cells', name: 'Power Cells', text: 'You can\'t move a piece farther than the number of pawns you have.',
      filter: function (ctx, moves) {
        var n = h.pieces(ctx.s, ctx.me, 'p').length;
        return moves.filter(function (m) { return h.moveDist(m) <= n; });
      } },

    { id: 'unspooling', name: 'Unspooling', text: 'You can only move a total distance of 100. Once you have used it up, you lose.',
      used: function (ctx) { return ctx.mem || 0; },
      filter: function (ctx, moves) { var left = 100 - this.used(ctx); return moves.filter(function (m) { return h.moveDist(m) <= left; }); },
      after: function (ctx, m) { return this.used(ctx) + h.moveDist(m); },
      lose: function (ctx) { return this.used(ctx) >= 100; },
      status: function (ctx) { return 'Distance left: ' + (100 - this.used(ctx)) + '.'; } },

    { id: 'evil_twin', name: 'Evil Twin', text: 'If you can capture a piece with a piece of the same type, you must.',
      filter: mustK(function (ctx, m) { return !!m.cap && h.type(m.cap) === h.type(m.piece); }) },

    { id: 'doctor_octopus', name: 'Doctor Octopus', text: 'You can only capture pieces other than the king 8 times.',
      count: function (ctx) { var me = ctx.me; return ctx.hist.filter(function (e) { return e.by === me && e.cap && h.type(e.cap) !== 'k'; }).length; },
      filter: function (ctx, moves) {
        if (this.count(ctx) < 8) return moves;
        return moves.filter(function (m) { return !m.cap || h.isKingCap(m); });
      },
      status: function (ctx) { return 'Captures left: ' + Math.max(0, 8 - this.count(ctx)) + '.'; } },

    { id: 'protected_pawns', name: 'Protected Pawns', text: 'You can only move pawns to squares your other pieces defend.',
      filter: only(function (ctx, m) {
        if (h.type(m.piece) !== 'p' || h.isKingCap(m)) return true;
        var s = ctx.s, b = s.board.slice();
        b[m.from] = '';
        if (m.capSq != null && m.capSq >= 0) b[m.capSq] = '';
        b[m.to] = m.piece;
        var t = Object.create(s);
        t.board = b;
        return R.attacked(t, m.to, ctx.me, ctx.cfg);
      }) },

    { id: 'just_passing_through', name: 'Just Passing Through', text: 'You can\'t capture on one rank in the middle of the board.',
      setup: function (r) { return { rank: 3 + r.int(4) }; },
      textOf: function (p) { return 'You can\'t capture on the ' + ORD[p.rank] + ' rank.'; },
      filter: only(noKingRule(function (ctx, m) { return !m.cap || h.rankOf(m.to, ctx.me) !== ctx.params.rank; })) },

    { id: 'stay_at_home_mom', name: 'Stay at Home Mom', text: 'Your queen can only move to your first two ranks.',
      filter: only(function (ctx, m) { return h.type(m.piece) !== 'q' || h.isKingCap(m) || h.rankOf(m.to, ctx.me) <= 2; }) },

    { id: 'remorseful', name: 'Remorseful', text: 'You can\'t capture twice in a row.',
      filter: function (ctx, moves) {
        if (!ctx.myLast || !ctx.myLast.cap) return moves;
        return moves.filter(function (m) { return !m.cap || h.isKingCap(m); });
      } },

    { id: 'shapeshifter', name: 'Shapeshifter', text: 'Your queen starts as a bishop. When it captures a piece other than a pawn, it becomes that piece.',
      start: function (s, me) { var q = me === 'w' ? 59 : 3; if (h.type(s.board[q]) === 'q' && mine(s.board[q], me)) s.board[q] = me === 'w' ? 'B' : 'b'; },
      after: function (ctx, m, n) {
        var sq = shapeSq(ctx);
        if (sq < 0 || m.from !== sq) return sq;
        var t = h.type(m.cap);
        if (m.cap && t !== 'p' && t !== 'k') n.board[m.to] = ctx.me === 'w' ? t.toUpperCase() : t;
        return m.to;
      },
      status: function (ctx) { var sq = shapeSq(ctx); return sq >= 0 ? 'Your shapeshifter is on ' + h.sqName(sq) + '.' : ''; } },

    { id: 'horse_eats_first', name: 'Horse Eats First', text: 'As long as you have a knight, you can only capture with knights.',
      filter: function (ctx, moves) {
        if (!h.pieces(ctx.s, ctx.me, 'n').length) return moves;
        return moves.filter(function (m) { return h.isKingCap(m) || !m.cap || h.type(m.piece) === 'n'; });
      } },

    { id: 'punching_down', name: 'Punching Down', text: 'Your pieces can\'t capture pieces worth more than them.',
      filter: only(noKingRule(function (ctx, m) { return !m.cap || h.val(m.cap) <= h.val(m.piece); })) },

    { id: 'windup_toys', name: 'Windup Toys', text: 'After your 12th move, you can\'t move your knights and bishops.',
      filter: function (ctx, moves) {
        if (ctx.moveNo <= 12) return moves;
        return moves.filter(function (m) { var t = h.type(m.piece); return t !== 'n' && t !== 'b'; });
      },
      status: function (ctx) { return ctx.moveNo <= 12 ? 'Knight and bishop moves left: ' + (13 - ctx.moveNo) + ' turns.' : ''; } },

    { id: 'abstinence', name: 'Abstinence', text: 'If your opponent has two pieces of the same type, other than pawns, next to each other, you lose.',
      lose: function (ctx) {
        var b = ctx.s.board, ps = h.pieces(ctx.s, ctx.foe).filter(function (q) { return h.type(b[q]) !== 'p'; });
        for (var i = 0; i < ps.length; i++) for (var j = i + 1; j < ps.length; j++)
          if (h.type(b[ps[i]]) === h.type(b[ps[j]]) && h.adj(ps[i], ps[j])) return true;
        return false;
      } },

    { id: 'you_best_not_miss', name: 'You Best Not Miss', text: 'If you end your turn checking your opponent, you must capture their king on your next move. If you can\'t, you lose.',
      // memory: the opponent's king stood attacked after this side's last move
      after: function (ctx, m, n) { return !n.lost && h.checked(n, ctx.foe, ctx.cfg); },
      filter: function (ctx, moves) {
        if (!ctx.mem) return moves;
        var x = moves.filter(function (m) { return takesKing(ctx, m); });
        return x.length ? x : moves;
      },
      lose: function (ctx) {
        if (!ctx.mem || ctx.s.turn !== ctx.me || !ctx.last || ctx.last.by !== ctx.foe) return false;
        return !R.legalMoves(ctx.s, ctx.cfg).some(function (m) { return takesKing(ctx, m); });
      },
      status: function (ctx) { return ctx.mem ? 'This turn: capture the king, or you lose.' : ''; } },

    { id: 'ivory_tower', name: 'Ivory Tower', text: 'You lose if an opposing piece stands next to your king.',
      lose: function (ctx) {
        var k = h.kingSq(ctx.s, ctx.me);
        return k >= 0 && h.pieces(ctx.s, ctx.foe).some(function (q) { return h.adj(q, k); });
      } },

    { id: 'eye_of_sauron', name: 'Eye of Sauron', text: 'As long as you have a rook, your pieces other than pawns can\'t move to a rank beyond the farthest square your rooks can see.',
      filter: function (ctx, moves) {
        var top = sauronRank(ctx.s, ctx.me), me = ctx.me;
        if (!top) return moves;
        return moves.filter(function (m) { return h.type(m.piece) === 'p' || h.isKingCap(m) || h.rankOf(m.to, me) <= top; });
      },
      status: function (ctx) { var top = sauronRank(ctx.s, ctx.me); return top ? 'Your rooks see up to the ' + ORD[top] + ' rank.' : ''; } }
  ]);
})(typeof self !== 'undefined' ? self : this);
