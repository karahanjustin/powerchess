/* Drawback Chess, the first set of drawbacks (see js/drawbacks.js for the terms and the ctx). */
(function (root) {
  'use strict';
  var DB = root.Drawbacks || (typeof require !== 'undefined' ? require('../drawbacks.js') : null), h = DB.h;
  var only = function (fn) { return function (ctx, moves) { return moves.filter(function (m) { return fn(ctx, m); }); }; };
  var noKingRule = function (fn) { return function (ctx, m) { return h.isKingCap(m) || fn(ctx, m); }; }; // capture rules spare the king
  var must = function (fn) { return function (ctx, moves) { var x = moves.filter(function (m) { return fn(ctx, m); }); return x.length ? x : moves; }; };

  DB.register([
    { id: 'lucky', name: 'Lucky', text: 'No drawback.' },
    { id: 'lame_duck', name: 'Lame Duck', text: 'You can\'t move your king.', filter: only(function (ctx, m) { return h.type(m.piece) !== 'k'; }) },
    { id: 'out_of_breath', name: 'Out of Breath', text: 'You can only move your king once.',
      filter: only(function (ctx, m) { return h.type(m.piece) !== 'k' || !ctx.hist.some(function (e) { return e.by === ctx.me && h.type(e.p) === 'k'; }); }) },
    { id: 'horse_tranquilizer', name: 'Horse Tranquilizer', text: 'Your knights can\'t capture.', filter: only(noKingRule(function (ctx, m) { return !(m.cap && h.type(m.piece) === 'n'); })) },
    { id: 'conscientious_objectors', name: 'Conscientious Objectors', text: 'You can\'t capture with pawns.', filter: only(noKingRule(function (ctx, m) { return !(m.cap && h.type(m.piece) === 'p'); })) },
    { id: 'trophy_wife', name: 'Trophy Wife', text: 'Your queen can\'t capture.', filter: only(noKingRule(function (ctx, m) { return !(m.cap && h.type(m.piece) === 'q'); })) },
    { id: 'true_gentleman', name: 'True Gentleman', text: 'You can\'t capture queens.', filter: only(function (ctx, m) { return h.type(m.cap) !== 'q'; }) },
    { id: 'vegan', name: 'Vegan', text: 'You can\'t capture knights.', filter: only(function (ctx, m) { return h.type(m.cap) !== 'n'; }) },
    { id: 'elephants_fear_mice', name: 'Elephants Fear Mice', text: 'Your pieces other than pawns can\'t capture pawns.', filter: only(function (ctx, m) { return !(h.type(m.cap) === 'p' && h.type(m.piece) !== 'p'); }) },
    { id: 'checkers', name: 'Checkers', text: 'You must capture if you can.', filter: must(function (ctx, m) { return !!m.cap; }) },
    { id: 'respectful', name: 'Respectful', text: 'You can\'t give check.',
      filter: only(function (ctx, m) { if (h.isKingCap(m)) return true; var n = DB.play(ctx.s, m, ctx.cfg); return !h.checked(n, ctx.foe, ctx.cfg); }) },
    { id: 'simp', name: 'Simp', text: 'You lose if you have no queen.', lose: function (ctx) { return !h.pieces(ctx.s, ctx.me, 'q').length; } },
    { id: 'always_check', name: 'Always Check, It Might Be Mate', text: 'If you are put in check, you lose.',
      lose: function (ctx) { return !!ctx.last && ctx.last.by === ctx.foe && h.checked(ctx.s, ctx.me, ctx.cfg); } },
    { id: 'siege', name: 'Siege', text: 'You must capture at least one of your opponent\'s rooks by your 20th move, or you lose.',
      lose: function (ctx) { return ctx.myMoves >= 20 && !ctx.hist.some(function (e) { return e.by === ctx.me && h.type(e.cap) === 'r'; }); } },
    { id: 'cess', name: 'Cess', text: 'You can\'t move to the h-file.', filter: only(function (ctx, m) { return h.isKingCap(m) || h.col(m.to) !== 7; }) },
    { id: 'number_of_the_beast', name: 'Number of the Beast', text: 'You can\'t move to the sixth rank.', filter: only(function (ctx, m) { return h.isKingCap(m) || h.rankOf(m.to, ctx.me) !== 6; }) },
    { id: 'forward_march', name: 'Forward March', text: 'You can\'t move backwards.', filter: only(function (ctx, m) { return !h.backward(m, ctx.me); }) },
    { id: 'stop_stalling', name: 'Stop Stalling', text: 'Your pieces can\'t move sideways.', filter: only(function (ctx, m) { return m.castle || !h.lateral(m); }) },
    { id: 'entrenched', name: 'Entrenched', text: 'Your rooks can\'t move more than 2 squares.', filter: only(function (ctx, m) { return m.castle || h.type(m.piece) !== 'r' || h.moveDist(m) <= 2; }) },
    { id: 'greedy', name: 'Greedy', text: 'You can\'t capture a piece if you could capture a piece of higher value instead.',
      filter: function (ctx, moves) { var top = 0; moves.forEach(function (m) { if (m.cap) top = Math.max(top, h.val(m.cap)); }); return moves.filter(function (m) { return !m.cap || h.val(m.cap) >= top; }); } },
    { id: 'skittish', name: 'Skittish', text: 'While in check, you must move your king.',
      filter: function (ctx, moves) { if (!h.checked(ctx.s, ctx.me, ctx.cfg)) return moves; return moves.filter(function (m) { return h.type(m.piece) === 'k' || h.isKingCap(m); }); } },
    { id: 'three_check', name: 'Three Check', text: 'If you are put in check three times, you lose.',
      lose: function (ctx) { return ctx.hist.filter(function (e) { return e.by === ctx.foe && e.chk; }).length >= 3; } },
    { id: 'femme_fatale', name: 'Femme Fatale', text: 'You can only capture the enemy king with a queen.', filter: only(function (ctx, m) { return !h.isKingCap(m) || h.type(m.piece) === 'q'; }) },
    { id: 'hand_and_brainless', name: 'Hand and Brainless', text: 'Each turn a random piece type is picked, and you must move that type if you can.', turnRandom: true,
      pickOf: function (ctx, moves) { var kinds = []; moves.forEach(function (m) { var t = h.type(m.piece); if (kinds.indexOf(t) < 0) kinds.push(t); }); kinds.sort(); return kinds.length ? h.turnRng(ctx).pick(kinds) : ''; },
      filter: function (ctx, moves) { var t = this.pickOf(ctx, moves); return moves.filter(function (m) { return h.type(m.piece) === t || h.isKingCap(m); }); },
      status: function (ctx, moves) { var t = this.pickOf(ctx, moves); return t ? 'This turn: move a ' + h.NAME[t] + '.' : ''; } },
    { id: 'ichtyophobe', name: 'Ichtyophobe', text: 'You can\'t make the move the engine would make.', engine: true,
      filter: function (ctx, moves) { if (!ctx.engine || moves.length < 2) return moves; var best = ctx.engine(ctx.s, moves); return best ? moves.filter(function (m) { return !(m.from === best.from && m.to === best.to && (m.promo || '') === (best.promo || '')); }) : moves; } },
    { id: 'fog_of_war', name: 'Fog of War', text: 'You can\'t see your opponent\'s pieces. You still see when a move is a capture or takes the king, and when you are in check.', fog: true }
  ]);
})(typeof self !== 'undefined' ? self : this);
