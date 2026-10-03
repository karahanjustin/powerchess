/* Drawback Chess, more drawbacks (see js/drawbacks.js for the terms and the ctx). */
(function (root) {
  'use strict';
  var DB = root.Drawbacks || (typeof require !== 'undefined' ? require('../drawbacks.js') : null), h = DB.h;
  var R = root.Rules || (typeof require !== 'undefined' ? require('../rules.js') : null);
  var only = function (fn) { return function (ctx, moves) { return moves.filter(function (m) { return fn(ctx, m); }); }; };
  var must = function (fn) { return function (ctx, moves) { var x = moves.filter(function (m) { return fn(ctx, m); }); return x.length ? x : moves; }; };
  var spare = function (fn) { return function (ctx, m) { return h.isKingCap(m) || fn(ctx, m); }; }; // square and capture rules spare the king capture

  /* ---------- local helpers ---------- */
  function own(s, q, me) { var p = s.board[q]; return !!p && h.colorOf(p) === me; }
  function same(a, b) { return !!a && !!b && a.from === b.from && a.to === b.to && (a.promo || '') === (b.promo || ''); }
  // the position with m played, on the board only (cheap; castling goes through the rules)
  function lite(ctx, m) {
    if (m.castle) return R.play(ctx.s, m, ctx.cfg);
    var b = ctx.s.board.slice();
    b[m.from] = '';
    if (m.capSq != null && m.capSq >= 0) b[m.capSq] = '';
    b[m.to] = m.promo ? (ctx.me === 'w' ? m.promo.toUpperCase() : m.promo) : m.piece;
    var t = Object.create(ctx.s);
    t.board = b;
    return t;
  }
  // the rook a castling move takes along: the first own rook from the king towards the side it castles to
  function castleRook(s, m, me) {
    var d = h.col(m.to) > h.col(m.from) ? 1 : -1, r = h.row(m.from);
    for (var c = h.col(m.from) + d; c >= 0 && c < 8; c += d) { var q = r * 8 + c, p = s.board[q]; if (p) return h.type(p) === 'r' && h.colorOf(p) === me ? q : -1; }
    return -1;
  }
  /* Pieces followed by their square (for rules about pieces that moved, captured, got stuck): the list as it is
     after the own move m. A square that no longer holds an own piece before the move (taken meanwhile) drops out. */
  function follow(ctx, list, m, add) {
    var out = (list || []).filter(function (q) { return own(ctx.s, q, ctx.me); }), i = out.indexOf(m.from);
    if (i >= 0) out.splice(i, 1);
    if (i >= 0 || add) out.push(m.to);
    if (m.castle) {
      var ro = castleRook(ctx.s, m, ctx.me), j = out.indexOf(ro);
      if (j >= 0) out.splice(j, 1);
      if (j >= 0 || add) out.push((m.from + m.to) >> 1);
    }
    return out;
  }
  /* What an engine said about one position, kept on the position object: the page and the sim filter a position
     (for its status) before they play on it, so a rule's memory can later read what was suggested there. */
  var CACHE = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function memo(s, key, fn) { if (!CACHE) return fn(); var o = CACHE.get(s); if (!o) { o = {}; CACHE.set(s, o); } if (!(key in o)) o[key] = fn(); return o[key]; }
  function peek(s, key) { var o = CACHE && CACHE.get(s); return o && (key in o) ? o[key] : undefined; }
  // the devil's choice: the move that loses the most at once (what it takes minus the most the other side can take back)
  function worst(ctx, moves) {
    var best = null, bs = Infinity, r = draw(ctx, 'devil');
    moves.forEach(function (m) {
      var n = R.play(ctx.s, m, ctx.cfg), top = 0;
      if (!n.lost) R.pseudoMoves(n, ctx.cfg, true).forEach(function (x) { if (x.cap) top = Math.max(top, h.val(x.cap)); });
      var sc = h.val(m.cap) - top + r.next() * 0.5;
      if (sc < bs) { bs = sc; best = m; }
    });
    return best;
  }
  // a turn's draw, stirred a little first (the first draw of a fresh generator barely depends on the seed's low bits)
  function draw(ctx, salt) { var r = h.turnRng(ctx, salt); r.next(); r.next(); r.next(); return r; }
  function rightFile(q, me) { return me === 'w' ? h.col(q) : 7 - h.col(q); }
  function center(q) { return h.col(q) === 3 || h.col(q) === 4; }
  function dome(q) { var r = h.row(q), c = h.col(q); return r >= 2 && r <= 5 && c >= 2 && c <= 5; }
  function files(params) { return (params.files || [2, 5]).map(function (f) { return 'abcdefgh'[f]; }); }
  function garden(ctx, q) { var f = ctx.params.files || [2, 5]; return h.rankOf(q, ctx.me) === 3 && f.indexOf(h.col(q)) >= 0; }
  function canDo(ctx, fn) { return R.legalMoves(ctx.s, ctx.cfg).some(function (m) { return h.isKingCap(m) || fn(ctx, m); }); }
  var NAMES = h.NAME;

  // the distance the opponent's last move went (0 before it has moved)
  function farOf(ctx) { return ctx.foeLast ? h.dist(ctx.foeLast.from, ctx.foeLast.to) : 0; }
  function cowed(ctx) { var e = ctx.last; return !!e && e.by === ctx.foe && !!e.cap; }
  function relayFrom(ctx) { return ctx.myLast && own(ctx.s, ctx.myLast.to, ctx.me) ? ctx.myLast.to : -1; }
  function torpedo(ctx) { var e = ctx.myLast; return e && h.type(e.p) === 'p' && !e.cap && !e.promo && ctx.s.board[e.to] === (ctx.me === 'w' ? 'P' : 'p') ? e.to : -1; }
  function summonCost(t) { return t === 'k' ? 0 : h.VAL[t] || 0; }
  function walked(ctx) { var t = 0; ctx.hist.forEach(function (e) { if (e.by === ctx.me) t += h.dist(e.from, e.to); }); return t; }

  DB.register([
    { id: 'colorblind', name: 'Colorblind', text: 'You can\'t move to squares of one color, picked again every turn.', turnRandom: true,
      dark: function (ctx) { return draw(ctx).int(2) === 1; },
      filter: function (ctx, moves) { var dk = this.dark(ctx); return moves.filter(function (m) { return h.isKingCap(m) || h.light(m.to) === dk; }); },
      status: function (ctx) { return 'This turn you can\'t move to ' + (this.dark(ctx) ? 'dark' : 'light') + ' squares.'; } },

    { id: 'inching_forward', name: 'Inching Forward', text: 'After your 6th move your king must stand in front of your home rank, and every six moves after that the rank it must be on or beyond moves up by one. You lose if it is behind at the end of your turn.',
      lose: function (ctx) {
        if (!ctx.last || ctx.last.by !== ctx.me) return false;
        var k = h.kingSq(ctx.s, ctx.me);
        return k >= 0 && h.rankOf(k, ctx.me) < 1 + Math.floor(ctx.myMoves / 6);
      },
      status: function (ctx) { var r = 1 + Math.floor(ctx.moveNo / 6); return r > 1 ? 'After this move your king must be on rank ' + r + ' or beyond.' : ''; } },

    { id: 'left_to_right', name: 'Left to Right', text: 'Unless your last move went to the rightmost file, you must move to a file to the right of where you last moved (right as seen from your side).',
      filter: function (ctx, moves) {
        var e = ctx.myLast;
        if (!e || rightFile(e.to, ctx.me) === 7) return moves;
        var f = rightFile(e.to, ctx.me);
        return must(spare(function (c, m) { return rightFile(m.to, c.me) > f; }))(ctx, moves);
      } },

    { id: 'friendly_fire', name: 'Friendly Fire', text: 'You can only move to squares defended by your other pieces.',
      filter: only(spare(function (ctx, m) { return h.attacked(lite(ctx, m), m.to, ctx.me, ctx.cfg); })) },

    { id: 'going_the_distance', name: 'Going the Distance', text: 'You must move at least as far as your opponent\'s last move went, or you lose (if you can\'t).',
      ok: function (ctx, m) { return h.dist(m.from, m.to) >= farOf(ctx); },
      filter: function (ctx, moves) { var self = this; return moves.filter(function (m) { return h.isKingCap(m) || self.ok(ctx, m); }); },
      lose: function (ctx) { var self = this; return !ctx.hypo && ctx.s.turn === ctx.me && farOf(ctx) > 1 && !canDo(ctx, function (c, m) { return self.ok(c, m); }); },
      status: function (ctx) { var d = farOf(ctx); return d > 1 ? 'This turn: move at least ' + d + ' squares.' : ''; } },

    { id: 'helicopter_parent', name: 'Helicopter Parent', text: 'You lose if you have an undefended pawn at the end of your turn.',
      lose: function (ctx) {
        if (!ctx.last || ctx.last.by !== ctx.me) return false;
        return h.pieces(ctx.s, ctx.me, 'p').some(function (q) { return !h.attacked(ctx.s, q, ctx.me, ctx.cfg); });
      } },

    { id: 'exclusivity_clause', name: 'Exclusivity Clause', text: 'You can\'t move to squares that more than one of your pieces can move to.',
      filter: function (ctx, moves) {
        var by = {};
        moves.forEach(function (m) { var a = by[m.to] || (by[m.to] = []); if (a.indexOf(m.from) < 0) a.push(m.from); });
        return moves.filter(function (m) { return h.isKingCap(m) || by[m.to].length < 2; });
      } },

    { id: 'relay_race', name: 'Relay Race', text: 'If you can move a piece that stands next to the piece you moved last, you must.',
      filter: function (ctx, moves) { var q = relayFrom(ctx); return q < 0 ? moves : must(function (c, m) { return h.isKingCap(m) || h.adj(m.from, q); })(ctx, moves); } },

    { id: 'devil_on_your_shoulder', name: 'Devil on Your Shoulder', text: 'Each turn a devil suggests a terrible move. If you disobey it 7 turns in a row, you must obey it on the 8th.', engine: true,
      devil: function (ctx, moves) { return moves.length ? memo(ctx.s, 'devil' + ctx.me, function () { return worst(ctx, moves); }) : null; },
      filter: function (ctx, moves) {
        if (!ctx.engine || (ctx.mem || 0) < 7) { if (ctx.engine) this.devil(ctx, moves); return moves; }
        var d = this.devil(ctx, moves);
        return d ? moves.filter(function (m) { return same(m, d); }) : moves;
      },
      after: function (ctx, m) { var d = peek(ctx.s, 'devil' + ctx.me); if (d === undefined || !d) return undefined; return same(m, d) ? 0 : (ctx.mem || 0) + 1; },
      status: function (ctx, moves) {
        var d = ctx.engine ? this.devil(ctx, moves || []) : peek(ctx.s, 'devil' + ctx.me), n = ctx.mem || 0; // the page asks without the engine: what the filter found
        if (!d) return '';
        var mv = h.sqName(d.from) + '-' + h.sqName(d.to) + (d.promo ? '=' + d.promo.toUpperCase() : '');
        return n >= 7 ? 'The devil demands ' + mv + '. You must obey.' : 'The devil suggests ' + mv + ' (disobeyed ' + n + ' of 7 times in a row).';
      } },

    { id: 'reflective', name: 'Reflective', text: 'You can only move pieces other than pawns to squares whose mirror square across the middle of the board (same file, mirrored rank) is occupied.',
      filter: only(spare(function (ctx, m) {
        if (h.type(m.piece) === 'p') return true;
        var mq = (7 - h.row(m.to)) * 8 + h.col(m.to);
        if (mq === m.from) return false; // the piece leaves it empty
        if (m.capSq != null && m.capSq >= 0 && mq === m.capSq) return false;
        return !!ctx.s.board[mq];
      })) },

    { id: 'alternator', name: 'Alternator', text: 'You must alternate pawn moves and moves with other pieces.',
      filter: function (ctx, moves) {
        if (!ctx.myLast) return moves;
        var pawn = h.type(ctx.myLast.p) === 'p';
        return must(function (c, m) { return h.isKingCap(m) || (h.type(m.piece) === 'p') !== pawn; })(ctx, moves);
      },
      status: function (ctx) { return ctx.myLast ? (h.type(ctx.myLast.p) === 'p' ? 'This turn: move a piece that is not a pawn.' : 'This turn: move a pawn.') : ''; } },

    { id: 'cowardly', name: 'Cowardly', text: 'When your opponent captures, you must move backward on your next move, or you lose (if you can\'t).',
      filter: function (ctx, moves) { if (!cowed(ctx)) return moves; return moves.filter(function (m) { return h.isKingCap(m) || h.backward(m, ctx.me); }); },
      lose: function (ctx) { return !ctx.hypo && ctx.s.turn === ctx.me && cowed(ctx) && !canDo(ctx, function (c, m) { return h.backward(m, c.me); }); },
      status: function (ctx) { return cowed(ctx) ? 'This turn: move backward.' : ''; } },

    { id: 'obsession', name: 'Obsession', text: 'Every turn a random square is picked. If you can move to it, you must.', turnRandom: true,
      square: function (ctx) { return draw(ctx).int(64); },
      filter: function (ctx, moves) { var q = this.square(ctx); return must(function (c, m) { return h.isKingCap(m) || m.to === q; })(ctx, moves); },
      status: function (ctx) { return 'This turn\'s square: ' + h.sqName(this.square(ctx)) + '.'; } },

    { id: 'boxing_with_shadow', name: 'Boxing with Shadow', text: 'When your opponent moves a piece, if you can move to the square it moved from, you must.',
      filter: function (ctx, moves) {
        var e = ctx.last;
        if (!e || e.by !== ctx.foe) return moves;
        return must(function (c, m) { return h.isKingCap(m) || m.to === e.from; })(ctx, moves);
      } },

    { id: 'noble_steed', name: 'Noble Steed', text: 'Your pieces other than knights can only move if they stand next to one of your knights.',
      filter: function (ctx, moves) {
        var ks = h.pieces(ctx.s, ctx.me, 'n');
        return moves.filter(function (m) { return h.type(m.piece) === 'n' || ks.some(function (k) { return h.adj(k, m.from); }); });
      } },

    { id: 'deer_in_the_headlights', name: 'Deer in the Headlights', text: 'You can\'t move pieces that are under attack.',
      filter: function (ctx, moves) {
        var hit = {};
        return moves.filter(function (m) { if (!(m.from in hit)) hit[m.from] = h.attacked(ctx.s, m.from, ctx.foe, ctx.cfg); return !hit[m.from]; });
      } },

    { id: 'hand_and_gigabrain', name: 'Hand and Gigabrain', text: 'You must move the type of piece the engine recommends.', engine: true,
      pick: function (ctx, moves) { if (!ctx.engine || moves.length < 2) return null; return memo(ctx.s, 'giga' + ctx.me, function () { return ctx.engine(ctx.s, moves) || null; }); },
      filter: function (ctx, moves) {
        var b = this.pick(ctx, moves);
        if (!b) return moves;
        var t = h.type(b.piece);
        return moves.filter(function (m) { return h.isKingCap(m) || h.type(m.piece) === t; });
      },
      status: function (ctx, moves) { var b = ctx.engine ? this.pick(ctx, moves || []) : peek(ctx.s, 'giga' + ctx.me); return b ? 'The engine says: move a ' + NAMES[h.type(b.piece)] + '.' : ''; } },

    { id: 'crenellations', name: 'Crenellations', text: 'Your pawns can only move to squares of one color.',
      setup: function (r) { return { light: r.int(2) === 0 }; },
      textOf: function (p) { return 'Your pawns can only move to ' + (p.light ? 'light' : 'dark') + ' squares.'; },
      filter: only(spare(function (ctx, m) { return h.type(m.piece) !== 'p' || h.light(m.to) === !!ctx.params.light; })) },

    { id: 'scent_of_blood', name: 'The Scent of Blood', text: 'You can\'t make a non-capturing move with a piece that can capture.',
      filter: function (ctx, moves) {
        var can = {};
        moves.forEach(function (m) { if (m.cap) can[m.from] = true; });
        return moves.filter(function (m) { return !!m.cap || !can[m.from]; });
      } },

    { id: 'leading_the_charge', name: 'Leading the Charge', text: 'As long as you have a knight, you can\'t move your other pieces to a rank ahead of your most advanced knight.',
      filter: function (ctx, moves) {
        var top = 0;
        h.pieces(ctx.s, ctx.me, 'n').forEach(function (q) { top = Math.max(top, h.rankOf(q, ctx.me)); });
        if (!top) return moves;
        return moves.filter(function (m) { return h.isKingCap(m) || h.type(m.piece) === 'n' || h.rankOf(m.to, ctx.me) <= top; });
      } },

    { id: 'active_volcano', name: 'Active Volcano', text: 'You can\'t move onto a volcano square in the middle of the board or the squares orthogonally next to it.',
      setup: function (r) { return { sq: (2 + r.int(4)) * 8 + r.int(8) }; },
      textOf: function (p) { return 'You can\'t move onto ' + h.sqName(p.sq) + ' (an active volcano) or the squares orthogonally next to it.'; },
      filter: only(spare(function (ctx, m) {
        var v = ctx.params.sq, dr = Math.abs(h.row(m.to) - h.row(v)), dc = Math.abs(h.col(m.to) - h.col(v));
        return dr + dc > 1;
      })) },

    { id: 'nurturer', name: 'Nurturer', text: 'You can\'t capture the enemy king until you have promoted a pawn.',
      filter: function (ctx, moves) {
        if (!moves.some(h.isKingCap) || ctx.hist.some(function (e) { return e.by === ctx.me && !!e.promo; })) return moves;
        return moves.filter(function (m) { return !h.isKingCap(m); });
      } },

    { id: 'prince_charming', name: 'Prince Charming', text: 'If your queen is attacked, you must move a knight if you can.',
      attacked: function (ctx) { return h.pieces(ctx.s, ctx.me, 'q').some(function (q) { return h.attacked(ctx.s, q, ctx.foe, ctx.cfg); }); },
      filter: function (ctx, moves) { if (!this.attacked(ctx)) return moves; return must(function (c, m) { return h.isKingCap(m) || h.type(m.piece) === 'n'; })(ctx, moves); },
      status: function (ctx) { return this.attacked(ctx) ? 'Your queen is attacked: move a knight if you can.' : ''; } },

    { id: 'absolution', name: 'Absolution', text: 'When one of your pieces other than bishops captures, it can\'t capture again until it starts a turn next to one of your bishops.',
      blessed: function (ctx, q) { return h.pieces(ctx.s, ctx.me, 'b').some(function (b) { return h.adj(b, q); }); },
      filter: function (ctx, moves) {
        var self = this, bad = (ctx.mem || []).filter(function (q) { return own(ctx.s, q, ctx.me) && !self.blessed(ctx, q); });
        if (!bad.length) return moves;
        return moves.filter(function (m) { return !m.cap || h.isKingCap(m) || bad.indexOf(m.from) < 0; });
      },
      after: function (ctx, m) {
        var self = this, list = (ctx.mem || []).filter(function (q) { return own(ctx.s, q, ctx.me) && !self.blessed(ctx, q); });
        list = follow(ctx, list, m, false);
        if (m.cap && h.type(m.piece) !== 'b' && list.indexOf(m.to) < 0) list.push(m.to);
        return list;
      } },

    { id: 'quicksand', name: 'Quicksand', text: 'If one of your pieces ends your turn on the same square in the middle two ranks twice in a row, it can never move again.',
      filter: function (ctx, moves) {
        var st = ctx.mem && ctx.mem.stuck;
        if (!st || !st.length) return moves;
        return moves.filter(function (m) { return st.indexOf(m.from) < 0 && !(m.castle && st.indexOf(castleRook(ctx.s, m, ctx.me)) >= 0); });
      },
      after: function (ctx, m, n) {
        var mem = ctx.mem || { prev: [], stuck: [] }, me = ctx.me;
        var stuck = mem.stuck.filter(function (q) { return own(ctx.s, q, me); });
        var cur = [];
        for (var q = 24; q < 40; q++) if (n.board[q] && h.colorOf(n.board[q]) === me) cur.push(q);
        cur.forEach(function (q) {
          if (q !== m.to && !(m.castle && q === ((m.from + m.to) >> 1)) && mem.prev.indexOf(q) >= 0 && own(ctx.s, q, me) && stuck.indexOf(q) < 0) stuck.push(q);
        });
        return { prev: cur, stuck: stuck };
      } },

    { id: 'rook_fan_club', name: 'Rook Fan Club', text: 'You must promote to rooks. Your king and queen can\'t move diagonally.',
      filter: only(function (ctx, m) {
        if (m.promo && m.promo !== 'r') return false;
        var t = h.type(m.piece);
        if ((t === 'k' || t === 'q') && !m.castle) { var dr = Math.abs(h.row(m.to) - h.row(m.from)), dc = Math.abs(h.col(m.to) - h.col(m.from)); if (dr && dc) return false; }
        return true;
      }) },

    { id: 'ladies_first', name: 'Ladies First', text: 'You can only move your king if you moved your queen on your previous move.',
      filter: only(function (ctx, m) { return h.type(m.piece) !== 'k' || (!!ctx.myLast && h.type(ctx.myLast.p) === 'q' && !ctx.myLast.promo); }) },

    { id: 'inside_the_lines', name: 'Inside the Lines', text: 'You can\'t move onto the rim (the outer squares of the board).',
      filter: only(spare(function (ctx, m) { return !h.rim(m.to); })) },

    { id: 'bridge_over_troubled_water', name: 'Bridge Over Troubled Water', text: 'A river runs between the 4th and 5th ranks. You can only cross it on the d- and e-files.',
      filter: only(function (ctx, m) {
        var north = function (q) { return h.row(q) <= 3; };
        if (north(m.from) === north(m.to)) return true;
        var sq = [m.from].concat(h.path(m), [m.to]);
        for (var i = 0; i + 1 < sq.length; i++) if (north(sq[i]) !== north(sq[i + 1])) return center(sq[i]) && center(sq[i + 1]);
        return true;
      }) },

    { id: 'royal_berth', name: 'Royal Berth', text: 'You can\'t move a piece to a square next to your king.',
      filter: function (ctx, moves) {
        var k = h.kingSq(ctx.s, ctx.me);
        return moves.filter(function (m) {
          if (h.isKingCap(m)) return true;
          if (m.castle) return false; // the rook lands next to the king
          return h.type(m.piece) === 'k' || k < 0 || !h.adj(m.to, k);
        });
      } },

    { id: 'velociraptor', name: 'Velociraptor', text: 'You can only capture a type of piece your opponent has moved in their last three moves.',
      kinds: function (ctx) {
        var out = {}, n = 0;
        for (var i = ctx.hist.length - 1; i >= 0 && n < 3; i--) { var e = ctx.hist[i]; if (e.by !== ctx.foe) continue; n++; out[h.type(e.p)] = true; if (e.promo) out[e.promo] = true; }
        return out;
      },
      filter: function (ctx, moves) { var k = this.kinds(ctx); return moves.filter(function (m) { return !m.cap || h.isKingCap(m) || !!k[h.type(m.cap)]; }); } },

    { id: 'secret_garden', name: 'Secret Garden', text: 'You have a secret garden on the squares in front of two of your pawns (on your 3rd rank). You can\'t move onto it, and if your opponent moves onto it, you lose.',
      setup: function (r) { var a = r.int(8), b = r.int(7); if (b >= a) b++; return { files: [Math.min(a, b), Math.max(a, b)] }; },
      textOf: function (p) { var f = files(p); return 'You have a secret garden on the squares in front of your ' + f[0] + '- and ' + f[1] + '-pawns (on your 3rd rank). You can\'t move onto it, and if your opponent moves onto it, you lose.'; },
      filter: only(spare(function (ctx, m) { return !garden(ctx, m.to); })),
      lose: function (ctx) { var e = ctx.last; return !!e && e.by === ctx.foe && garden(ctx, e.to); } },

    { id: 'thunderdome', name: 'Thunderdome', text: 'The middle 16 squares are the thunderdome. Once one of your pieces is in it, it can\'t leave unless it is your only piece in there.',
      filter: function (ctx, moves) {
        var n = 0;
        for (var q = 0; q < 64; q++) if (dome(q) && own(ctx.s, q, ctx.me)) n++;
        if (n < 2) return moves;
        return moves.filter(function (m) { return !dome(m.from) || dome(m.to); });
      } },

    { id: 'indecisive', name: 'Indecisive', text: 'A piece of yours can\'t capture if it could make more than one capturing move.',
      filter: function (ctx, moves) {
        var tg = {};
        moves.forEach(function (m) { if (!m.cap) return; var a = tg[m.from] || (tg[m.from] = []); if (a.indexOf(m.to) < 0) a.push(m.to); });
        return moves.filter(function (m) { return !m.cap || h.isKingCap(m) || tg[m.from].length < 2; });
      } },

    { id: 'unrequited_love', name: 'Unrequited Love', text: 'Your king can\'t move away from your queen (and can\'t move at all without one). Your queen can\'t move towards your king.',
      filter: function (ctx, moves) {
        var qs = h.pieces(ctx.s, ctx.me, 'q'), k = h.kingSq(ctx.s, ctx.me);
        var near = function (q) { var d = 99; qs.forEach(function (x) { d = Math.min(d, h.dist(x, q)); }); return d; };
        return moves.filter(function (m) {
          var t = h.type(m.piece);
          if (t === 'k') return qs.length > 0 && near(m.to) <= near(m.from);
          if (t === 'q' && k >= 0) return h.dist(m.to, k) >= h.dist(m.from, k);
          return true;
        });
      } },

    { id: 'torpedoes', name: 'Torpedoes', text: 'If you moved a pawn without capturing on your previous turn and you can move it again, you must.',
      filter: function (ctx, moves) { var q = torpedo(ctx); return q < 0 ? moves : must(function (c, m) { return h.isKingCap(m) || m.from === q; })(ctx, moves); } },

    { id: 'theocracy', name: 'Theocracy', text: 'On every other move you can only capture with your bishops.',
      setup: function (r) { return { odd: r.int(2) === 0 }; },
      textOf: function (p) { return 'On your ' + (p.odd ? 'odd' : 'even') + '-numbered moves you can only capture with your bishops.'; },
      holy: function (ctx) { return (ctx.moveNo % 2 === 1) === !!ctx.params.odd; },
      filter: function (ctx, moves) { if (!this.holy(ctx)) return moves; return moves.filter(function (m) { return !m.cap || h.isKingCap(m) || h.type(m.piece) === 'b'; }); },
      status: function (ctx) { return this.holy(ctx) ? 'This move only your bishops may capture.' : ''; } },

    { id: 'bottled_lightning', name: 'Bottled Lightning', text: 'If you can move your king, you must.',
      filter: must(function (ctx, m) { return h.isKingCap(m) || h.type(m.piece) === 'k'; }) },

    { id: 'yugioh', name: 'Yugioh', text: 'You can only summon (move for the first time) a piece once your other moves have covered a total distance of its value (pawn 1, knight 3, bishop 3, rook 5, queen 9). Your first move may summon a pawn, and your king is free.',
      filter: function (ctx, moves) {
        var done = ctx.mem || [], total = -1;
        var ok = function (q, t) {
          if (done.indexOf(q) >= 0 || t === 'k') return true;
          if (t === 'p' && ctx.myMoves === 0) return true;
          if (total < 0) total = walked(ctx);
          return total >= summonCost(t);
        };
        return moves.filter(function (m) {
          if (!ok(m.from, h.type(m.piece))) return false;
          if (m.castle) { var ro = castleRook(ctx.s, m, ctx.me); if (ro >= 0 && !ok(ro, 'r')) return false; }
          return true;
        });
      },
      after: function (ctx, m) { return follow(ctx, ctx.mem, m, true); },
      status: function (ctx) { return 'Distance moved so far: ' + walked(ctx) + '.'; } },

    { id: 'taking_turns', name: 'Taking Turns', text: 'You can\'t move a type of piece again until you have moved every piece of that type at least once.',
      filter: function (ctx, moves) {
        var done = ctx.mem || [], fresh = {};
        h.pieces(ctx.s, ctx.me).forEach(function (q) { if (done.indexOf(q) < 0) fresh[h.type(ctx.s.board[q])] = true; });
        var ok = function (q, t) { return done.indexOf(q) < 0 || !fresh[t]; };
        return moves.filter(function (m) {
          if (!ok(m.from, h.type(m.piece))) return false;
          if (m.castle) { var ro = castleRook(ctx.s, m, ctx.me); if (ro >= 0 && !ok(ro, 'r')) return false; }
          return true;
        });
      },
      after: function (ctx, m) { return follow(ctx, ctx.mem, m, true); } }
  ]);
})(typeof self !== 'undefined' ? self : this);
