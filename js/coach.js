/* The coach: says in plain words why a move was weak and what the better move would
   have done. It does not rate anything itself. It takes the engine's two lines (the
   answer to the move that was played, and the line that started with the best move),
   plays them out on the real rules and reads off what happens: a piece that is taken,
   a fork, a mate, a frozen defender, a statue.

   kit  = { B, std, R, cfg, name(sq), label(state, legal, act) }
   data = { s, n, m, by, san, cls, before, after, reply: [...], best: [...] }
          s/n are the states before and after the move, reply and best are lists of
          actions ({ m } | { gild } | { freeze } | { convert } | { stop }) or UCI texts. */
(function (root) {
  'use strict';

  var NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  var VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  // Variants bring their own pieces: the kit can name them and say what they are worth (kit.names, kit.values).
  var extraName = {}, extraVal = {};
  function nm(letter) { var l = String(letter).toLowerCase(); return extraName[l] || NAME[l] || 'piece'; }
  function val(letter) { var l = String(letter).toLowerCase(), v = extraVal[l] != null ? extraVal[l] : VAL[l]; return v == null ? 4 : v; }
  function colorOf(p) { return p === p.toUpperCase() ? 'w' : 'b'; }
  function other(c) { return c === 'w' ? 'b' : 'w'; }
  function sideName(c) { return c === 'w' ? 'White' : 'Black'; }

  // Material of one side in pawns. Statues count for nothing, pieces in a pocket do count.
  function material(s, c) {
    var sum = 0, b = s.board, i;
    for (i = 0; i < b.length; i++) if (b[i] && colorOf(b[i]) === c && s.gold.indexOf(i) < 0) sum += val(b[i]);
    if (s.pockets && s.pockets[c]) for (i = 0; i < s.pockets[c].length; i++) sum += val(s.pockets[c][i]);
    return sum;
  }
  function balance(s, c) { return material(s, c) - material(s, other(c)); }

  function applyAct(B, s, a) {
    if (a.m) return B.play(s, a.m);
    if (a.gild != null) return B.gild(s, a.gild);
    if (a.freeze != null) return B.freeze(s, a.freeze);
    if (a.convert != null) return B.convert(s, a.convert);
    if (a.stop) return B.timeStop(s);
    return null;
  }

  /* Play a line out. Every step keeps the state before and after, who acted, what was
     taken and whether it gave check. Stops at the first action that does not fit. */
  function walk(kit, state, acts, max) {
    var B = kit.B, out = [], s = state;
    for (var i = 0; i < acts.length && out.length < (max || 8); i++) {
      var lg = B.legal(s), a = acts[i];
      if (typeof a === 'string') { var found = B.find(lg, a); if (!found) break; a = { m: found }; }
      if (a.m && lg.indexOf(a.m) < 0) {
        // the move object may come from another list: find the same move here
        var same = null;
        for (var k = 0; k < lg.length; k++) if (lg[k].from === a.m.from && lg[k].to === a.m.to && (lg[k].promo || '') === (a.m.promo || '') && !!lg[k].snipe === !!a.m.snipe && (lg[k].kind || '') === (a.m.kind || '') && (lg[k].drop || '') === (a.m.drop || '')) { same = lg[k]; break; }
        if (!same) break;
        a = { m: same };
      }
      var label;
      try { label = kit.label(s, lg, a); } catch (e) { break; }
      var n = applyAct(B, s, a);
      if (!n) break;
      var step = { by: s.turn, act: a, label: label, before: s, after: n, taken: [], check: false, mate: false, over: null };
      if (a.m) {
        if (a.m.cap) step.taken.push({ p: a.m.cap, sq: a.m.capSq != null && a.m.capSq >= 0 ? a.m.capSq : a.m.to });
        var rem = n.fx && n.fx.removed ? n.fx.removed : [];
        for (var r = 0; r < rem.length; r++) if (rem[r].sq != null && !step.taken.some(function (t) { return t.sq === rem[r].sq; })) step.taken.push({ p: rem[r].p, sq: rem[r].sq });
      }
      var lg2 = B.legal(n), st = B.status(n, lg2);
      step.check = n.turn !== s.turn && B.checks(n).length > 0;
      step.over = st.over ? st : null;
      step.mate = !!(st.over && st.reason === 'checkmate');
      out.push(step);
      s = n;
      if (st.over) break;
    }
    return out;
  }

  function list(words) {
    if (words.length < 2) return words.join('');
    return words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1];
  }
  function worth(d) {
    if (d >= 8) return 'a queen';
    if (d >= 5) return 'a rook';
    if (d >= 3) return 'a piece';
    if (d === 2) return 'two pawns\' worth of material';
    return 'a pawn';
  }
  function line(steps, n) { return steps.slice(0, n).map(function (x) { return x.label; }).join(' '); }

  // Squares a piece could capture on from where it stands, if it were its side's turn (standard rules only).
  function targetsFrom(kit, s, sq) {
    var p = s.board[sq];
    if (!p || !kit.std) return [];
    var flipped = {};
    for (var k in s) flipped[k] = s[k];
    flipped.turn = colorOf(p); flipped.ep = -1;
    return kit.R.pseudoMoves(flipped, kit.cfg).filter(function (m) { return m.from === sq && m.cap && !m.snipe; }).map(function (m) { return m.capSq; });
  }
  function attackedBy(kit, s, sq, c) { return kit.std ? kit.R.attacked(s, sq, c, kit.cfg) : null; }

  /* What is wrong with the move. Returns { why, spot } where spot is the square of the
     piece that suffers (or -1), so the advice about the better move can refer to it. */
  function problem(kit, d, reply) {
    var me = d.by, foe = other(me), Foe = sideName(foe), m = d.m;
    var turn = [], i;
    for (i = 0; i < reply.length && reply[i].by === foe; i++) turn.push(reply[i]); // everything the other side does before the turn comes back
    if (!turn.length) return null;
    var first = turn[0], last = turn[turn.length - 1];
    var endBal = reply.length ? balance(reply[reply.length - 1].after, me) : balance(d.n, me), lost = balance(d.n, me) - endBal;
    var net = balance(d.s, me) - endBal; // what the whole affair costs, counting what the move itself took

    // mate on the spot
    for (i = 0; i < turn.length; i++) if (turn[i].mate) {
      return { why: (turn.length === 1 ? 'It allows ' + first.label + ', which is checkmate.' : 'It allows ' + line(turn, turn.length) + ' and that is checkmate.'), spot: -1 };
    }
    if (last.over && last.over.result === foe) return { why: 'It allows ' + line(turn, turn.length) + ', which wins the game on the spot.', spot: -1 };

    var frees = turn.filter(function (x) { return !x.act.m; }), moves = turn.filter(function (x) { return !!x.act.m; });
    var caps = moves.filter(function (x) { return x.taken.length > 0; });
    var parts = [], spot = -1;
    var landed = m ? (d.n.fx && d.n.fx.tp >= 0 ? d.n.fx.tp : m.to) : -1;

    // Why a capture works: the piece that just moved is loose, or another one lost its cover.
    function capWhy(step) {
      var tk = step.taken[0], sm = step.act.m;
      if (!tk) return null;
      if (sm.snipe) return { why: step.label + ' shoots the ' + nm(tk.p) + ' on ' + kit.name(tk.sq) + ' from a distance. The shooter does not even have to move.', spot: tk.sq };
      if (m && tk.sq === landed && !m.drop) {
        var guarded = attackedBy(kit, d.n, landed, me);
        return { why: 'The ' + nm(tk.p) + ' on ' + kit.name(landed) + (guarded === false ? ' is not defended there and ' : ' can be taken there: ') + step.label + (guarded === false ? ' simply takes it.' : ' wins material.'), spot: landed };
      }
      var what = 'the ' + nm(tk.p) + ' on ' + kit.name(tk.sq), reason = '';
      if (kit.std && m && step === first) {
        var wasHit = attackedBy(kit, d.s, tk.sq, foe), wasHeld = attackedBy(kit, d.s, tk.sq, me), isHeld = attackedBy(kit, d.n, tk.sq, me);
        if (wasHeld && !isHeld) reason = d.san + ' takes the defender away from ' + what + '. ';
        else if (!wasHit) reason = d.san + ' opens the way to ' + what + '. ';
        else if (!wasHeld) reason = what.charAt(0).toUpperCase() + what.slice(1) + ' was hanging already and ' + d.san + ' does nothing about it. ';
        else reason = what.charAt(0).toUpperCase() + what.slice(1) + ' was under attack and ' + d.san + ' does not deal with it. ';
      }
      return { why: reason + step.label + ' wins ' + (reason ? 'it' : what) + (lost >= 2 && lost < val(tk.p) ? ' for less than it is worth' : '') + '.', spot: tk.sq };
    }

    // the free actions of a power-up side come first in its turn
    frees.forEach(function (f) {
      var b = f.before.board, sq, p;
      if (f.act.gild != null) {
        sq = f.act.gild; p = b[sq];
        parts.push(Foe + ' can turn the ' + nm(p) + ' on ' + kit.name(sq) + ' to gold with Midas Touch. It stays on the board, but it will never move again.');
        if (spot < 0) spot = sq;
      } else if (f.act.convert != null) {
        sq = f.act.convert; p = b[sq];
        parts.push(Foe + ' can use Turncoat on the ' + nm(p) + ' on ' + kit.name(sq) + ', which then plays for the other side.');
        if (spot < 0) spot = sq;
      } else if (f.act.stop) {
        parts.push(Foe + ' can use Time Stop and play ' + line(moves, moves.length) + ' in one go.');
      } else if (f.act.freeze != null) {
        sq = f.act.freeze; p = b[sq];
        var hit = caps.length ? caps[0].taken[0] : null, later = null;
        if (!hit) for (var j = turn.length; j < reply.length; j++) if (reply[j].by === foe && reply[j].taken.some(function (t) { return t.sq === sq; })) { later = reply[j]; break; }
        if (hit && hit.sq !== sq) {
          parts.push(Foe + ' can freeze the ' + nm(p) + ' on ' + kit.name(sq) + ' and then play ' + caps[0].label + ': the ' + nm(hit.p) + ' on ' + kit.name(hit.sq) + ' falls, and the frozen ' + nm(p) + ' cannot take back.');
          spot = hit.sq;
        } else if (hit && hit.sq === sq) {
          parts.push(Foe + ' can freeze the ' + nm(p) + ' on ' + kit.name(sq) + ' so that it cannot be saved, and take it with ' + caps[0].label + '.');
          spot = sq;
        } else if (later) {
          parts.push(Foe + ' can freeze the ' + nm(p) + ' on ' + kit.name(sq) + ' and attack it. It cannot step away, and ' + later.label + ' wins it a move later.');
          spot = sq;
        } else {
          parts.push(Foe + ' can freeze the ' + nm(p) + ' on ' + kit.name(sq) + ', and ' + (moves.length ? moves[0].label : 'the reply') + ' is strong while that piece stands still.');
        }
      }
    });
    if (parts.length) {
      // a capture in the same turn that the sentences above have not covered yet
      var told = parts.join(' ');
      if (caps.length && told.indexOf(caps[0].label) < 0) {
        var extra = capWhy(caps[0]);
        if (extra) {
          var big = val(caps[0].taken[0].p) >= 5;
          if (big) { parts.unshift(extra.why); spot = extra.spot; } else parts.push('On top of that, ' + caps[0].label + ' takes the ' + nm(caps[0].taken[0].p) + ' on ' + kit.name(caps[0].taken[0].sq) + '.');
        }
      } else if (lost >= 1 && !/falls|wins it|take it|to gold|other side/.test(told)) parts.push('In the end that costs ' + worth(lost) + '.');
      return { why: parts.join(' '), spot: spot };
    }

    // several moves in one turn (Double Move, Rampage)
    if (moves.length > 1 && lost >= 1) {
      var got = [];
      moves.forEach(function (x) { x.taken.forEach(function (t) { got.push('the ' + nm(t.p) + ' on ' + kit.name(t.sq)); }); });
      return { why: Foe + ' has ' + moves.length + ' moves in this turn and plays ' + line(moves, moves.length) + (got.length ? ', taking ' + list(got) : '') + '.', spot: got.length ? moves[0].taken.length ? moves[0].taken[0].sq : -1 : -1 };
    }

    var rm = first.act.m, tk = first.taken[0];
    var Me = sideName(me), ca = d.chanceAfter == null ? 0.5 : d.chanceAfter, cb = d.chanceBefore == null ? 0.5 : d.chanceBefore;
    var outcome = ca >= 0.62 ? Me + ' is still better, but by less than before' : ca >= 0.42 ? (cb >= 0.62 ? 'the advantage is gone' : Foe + ' has the easier game') : ca >= 0.25 ? Foe + ' takes over' : Foe + ' is close to winning';
    // a capture that is simply taken back: an exchange, not a gift
    if (tk && m && m.cap && tk.sq === landed && net < 1) {
      return { why: d.san + ' trades the ' + nm(tk.p) + ' for the ' + nm(m.cap) + '. The exchange suits ' + Foe + ': ' + outcome + '.', spot: -1, soft: true };
    }
    // the piece that just moved can simply be taken, or something is shot from a distance
    if (tk && lost >= 1 && ((rm && rm.snipe) || (m && tk.sq === landed && !m.drop))) return capWhy(first);

    // a fork: the piece that comes in attacks two things at once
    if (kit.std && rm && !rm.snipe && !rm.drop) {
      var at = first.after.fx && first.after.fx.tp >= 0 ? first.after.fx.tp : rm.to, piece = first.after.board[at];
      if (piece) {
        var tg = targetsFrom(kit, first.after, at).filter(function (sq) {
          var t = first.after.board[sq];
          return t && (val(t) > val(piece) || !attackedBy(kit, first.after, sq, me));
        });
        var names = tg.map(function (sq) { return 'the ' + nm(first.after.board[sq]) + ' on ' + kit.name(sq); });
        if (first.check) names.unshift('the king');
        if (names.length >= 2 && lost >= 1) {
          return { why: first.label + ' is a fork: the ' + nm(piece) + ' attacks ' + list(names) + ' at the same time, and only one of them can be saved.', spot: tg.length ? tg[0] : -1 };
        }
      }
    }

    // another piece is taken
    if (tk && lost >= 1) return capWhy(first);

    // a pawn runs through
    for (i = 0; i < reply.length; i++) if (reply[i].by === foe && reply[i].act.m && reply[i].act.m.promo) {
      return { why: 'After ' + line(reply, i + 1) + ' ' + Foe + ' gets a new ' + nm(reply[i].act.m.promo) + '.', spot: -1 };
    }

    // material goes a few moves down the line
    if (lost >= 1 && reply.length >= 2) return { why: 'After ' + line(reply, Math.min(reply.length, 5)) + ' ' + Foe + ' is ' + worth(lost) + ' up.', spot: -1 };

    // nothing is lost in material: say what the answer is and what it does
    // the answer chases the piece that just moved: that is lost time
    if (kit.std && rm && m && !rm.snipe && landed >= 0 && first.after.board[landed] && colorOf(first.after.board[landed]) === me) {
      var from = first.after.fx && first.after.fx.tp >= 0 ? first.after.fx.tp : rm.to, mover = first.after.board[from], chased = first.after.board[landed];
      if (mover && nm(chased) !== 'pawn' && nm(chased) !== 'king' && targetsFrom(kit, first.after, from).indexOf(landed) >= 0 && (val(chased) > val(mover) || !attackedBy(kit, first.after, landed, me))) {
        return { why: first.label + ' attacks the ' + nm(chased) + ' on ' + kit.name(landed) + ' right away, so it has to move again. That costs time, and ' + outcome + '.', spot: -1, soft: true };
      }
    }
    return { why: 'Nothing is lost at once. ' + Foe + '\'s best answer is ' + first.label + (first.check ? ', with check' : '') + (reply.length > 2 ? ' (' + line(reply, Math.min(reply.length, 4)) + ')' : '') + ', and ' + outcome + '.', spot: -1, soft: true };
  }

  // What the better move would have done.
  function advice(kit, d, best, prob) {
    if (!best.length) return '';
    var me = d.by, b0 = best[0], label = b0.label, i;
    // the suggested move runs into a mate as well: then there was nothing better to find
    for (i = 0; i < best.length; i++) if (best[i].by !== me && best[i].mate) return 'Nothing else held either: after ' + label + ' it is mate as well (' + line(best, i + 1) + ').';
    for (i = 0; i < best.length; i++) if (best[i].by === me && best[i].mate) {
      return i === 0 ? label + ' was checkmate.' : label + ' led to mate: ' + line(best, i + 1) + '.';
    }
    if (!b0.act.m) {
      var b = b0.before.board;
      if (b0.act.gild != null) return 'Better was Midas Touch on the ' + nm(b[b0.act.gild]) + ' on ' + kit.name(b0.act.gild) + ' first: it costs no move, and that piece never moves again.';
      if (b0.act.freeze != null) return 'Better was to freeze the ' + nm(b[b0.act.freeze]) + ' on ' + kit.name(b0.act.freeze) + ' first' + (best[1] && best[1].by === me ? ' and then play ' + best[1].label : '') + '.';
      if (b0.act.convert != null) return 'Better was Turncoat on the ' + nm(b[b0.act.convert]) + ' on ' + kit.name(b0.act.convert) + ', which would then have played for you.';
      return 'Better was to use Time Stop here' + (best.length >= 3 ? ' and play ' + line(best.filter(function (x) { return x.by === me; }), 3) + ' in one go' : '') + '.';
    }
    var gain = balance(best[best.length - 1].after, me) - balance(d.s, me), bm = b0.act.m;
    if (gain >= 1 && b0.taken.length) return label + ' would have won the ' + nm(b0.taken[0].p) + ' on ' + kit.name(b0.taken[0].sq) + '.';
    if (gain >= 1) return label + ' would have won ' + worth(gain) + ' (' + line(best, Math.min(best.length, 4)) + ').';
    if (prob && prob.spot >= 0 && !bm.drop) {
      var piece = d.s.board[prob.spot];
      if (piece && colorOf(piece) === me) {
        if (bm.from === prob.spot) return label + ' would have moved the ' + nm(piece) + ' out of danger.';
        if (kit.std) {
          var foe = other(me);
          if (attackedBy(kit, d.s, prob.spot, foe) && !attackedBy(kit, b0.after, prob.spot, foe)) return label + ' would have stopped the attack on the ' + nm(piece) + '.';
          if (!attackedBy(kit, d.s, prob.spot, me) && attackedBy(kit, b0.after, prob.spot, me)) return label + ' would have defended the ' + nm(piece) + '.';
        }
        return label + ' would have kept the ' + nm(piece) + ' safe.';
      }
    }
    return label + ' was the move' + (best.length >= 3 ? ' (' + line(best, 3) + ')' : '') + '.';
  }

  /* The whole explanation. Returns { why, better } as finished sentences, either can be ''. */
  function explain(kit, d) {
    extraName = kit.names || {}; extraVal = kit.values || {};
    var reply = walk(kit, d.n, d.reply || [], 7), best = walk(kit, d.s, d.best || [], 6);
    var prob = null, why = '', better = '';
    try { prob = problem(kit, d, reply); } catch (e) { prob = null; }
    if (prob) why = prob.why;
    try { better = advice(kit, d, best, prob); } catch (e2) { better = ''; }
    if (best.length && d.m && best[0].act.m && best[0].act.m.from === d.m.from && best[0].act.m.to === d.m.to && (best[0].act.m.promo || '') === (d.m.promo || '') && !!best[0].act.m.snipe === !!d.m.snipe) better = ''; // same move, nothing to advise
    return { why: why, better: better, soft: !!(prob && prob.soft) };
  }

  var api = { explain: explain, walk: walk, material: material, balance: balance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Coach = api;
})(typeof self !== 'undefined' ? self : this);
