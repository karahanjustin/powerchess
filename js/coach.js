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
    if (a.shield != null) return B.shield(s, a.shield);
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

  /* A pin or a skewer by the line piece on sq (8 x 8 boards): along one of its lines the first piece met is the
     other side's (x), and right behind it stands another of theirs (y). y the more valuable (or the king): a pin.
     x the more valuable (or the king): a skewer. Returns { pin, x, xs, y, ys } or null. */
  function rayMotif(s, sq, me) {
    var b = s.board, p = b[sq], W = s.W || 8, H = s.H || 8;
    if (!p || W !== 8 || H !== 8) return null;
    var t = p.toLowerCase(), dirs = [];
    if (t === 'r' || t === 'q') dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    if (t === 'b' || t === 'q') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    var c0 = sq % 8, r0 = Math.floor(sq / 8);
    for (var d = 0; d < dirs.length; d++) {
      var found = [], c = c0, r = r0;
      while (found.length < 2) {
        c += dirs[d][0]; r += dirs[d][1];
        if (c < 0 || c > 7 || r < 0 || r > 7) break;
        var q = r * 8 + c;
        if (b[q]) { if (colorOf(b[q]) === me) break; found.push(q); }
      }
      if (found.length < 2) continue;
      var x = b[found[0]], y = b[found[1]], xk = x.toLowerCase() === 'k', yk = y.toLowerCase() === 'k';
      if (!xk && (yk || val(y) > val(x)) && val(x) >= 3) return { pin: true, x: x, xs: found[0], y: y, ys: found[1] };
      if ((xk || val(x) > val(y)) && val(y) >= 3) return { pin: false, x: x, xs: found[0], y: y, ys: found[1] };
    }
    return null;
  }

  /* The idea behind a puzzle's solution, in a few sentences, for the solver ("you"): what the first action does
     (and, for a power-up, why it works here), where the line ends up, and how the other side defends best.
     d = { s, sol: [acts], follow: [acts], me, power(state, act) -> the name of the power-up that makes this move
     possible, or null }. sol is the solution as played, follow the best play after it (the other side's answer and
     the solver's reply). Returns a list of sentences, each its own text (the German comes sentence by sentence). */
  function idea(kit, d) {
    extraName = kit.names || {}; extraVal = kit.values || {};
    var all = walk(kit, d.s, (d.sol || []).concat(d.follow || []), 14);
    var solN = Math.min((d.sol || []).length, all.length), sol = all.slice(0, solN), fol = all.slice(solN), me = d.me;
    var out = [];
    if (!sol.length) return out;
    var k0 = sol[0], b0 = k0.before.board, a0 = k0.act, i;
    // the squares the solver takes on later in the line (the solution and the follow-up)
    var laterCaps = [];
    for (i = 1; i < all.length; i++) if (all[i].by === me) all[i].taken.forEach(function (t) { laterCaps.push({ sq: t.sq, p: t.p, step: all[i] }); });
    var nextMine = null;
    for (i = 1; i < all.length; i++) if (all[i].by === me) { nextMine = all[i]; break; }
    var guards = function (sq) { // a later capture square the piece on sq could have taken back on
      var t = targetsFrom(kit, k0.before, sq);
      for (var j = 0; j < laterCaps.length; j++) if (t.indexOf(laterCaps[j].sq) >= 0 && laterCaps[j].sq !== sq) return laterCaps[j];
      return null;
    };
    if (a0.freeze != null) {
      var fp = b0[a0.freeze], fsq = kit.name(a0.freeze), g = guards(a0.freeze), gone = laterCaps.filter(function (c) { return c.sq === a0.freeze; })[0];
      // what it would have done: take back, run away, or take one of yours
      var threat = targetsFrom(kit, k0.before, a0.freeze).filter(function (q) { return b0[q] && colorOf(b0[q]) === me && b0[q].toLowerCase() !== 'k' && val(b0[q]) >= 3; })[0];
      if (g) out.push('Freeze the ' + nm(fp) + ' on ' + fsq + ': it can no longer take back on ' + kit.name(g.sq) + '.');
      else if (gone) out.push('Freeze the ' + nm(fp) + ' on ' + fsq + ': it cannot get away, and ' + gone.step.label + ' takes it.');
      else if (threat != null) out.push('Freeze the ' + nm(fp) + ' on ' + fsq + ': it cannot take your ' + nm(b0[threat]) + ' on ' + kit.name(threat) + ' on the next turn.');
      else out.push('Freeze the ' + nm(fp) + ' on ' + fsq + ': it cannot move on the next turn.');
    } else if (a0.gild != null) {
      var gp = b0[a0.gild], gsq = kit.name(a0.gild), gg = guards(a0.gild);
      var hit = targetsFrom(kit, k0.before, a0.gild).filter(function (q) { return b0[q] && colorOf(b0[q]) === me && b0[q].toLowerCase() !== 'k'; })[0];
      if (gg) out.push('Midas Touch turns the ' + nm(gp) + ' on ' + gsq + ' into a statue: it no longer guards ' + kit.name(gg.sq) + '.');
      else if (hit != null) out.push('Midas Touch turns the ' + nm(gp) + ' on ' + gsq + ' into a statue: it no longer attacks your ' + nm(b0[hit]) + ' on ' + kit.name(hit) + '.');
      else out.push('Midas Touch turns the ' + nm(gp) + ' on ' + gsq + ' into a statue: it never moves again.');
    } else if (a0.convert != null) {
      var cp = b0[a0.convert];
      out.push('Turncoat brings the ' + nm(cp) + ' on ' + kit.name(a0.convert) + ' over to your side' + (nextMine && nextMine.act.m && nextMine.act.m.from === a0.convert ? ', and it plays ' + nextMine.label + ' at once.' : '.'));
    } else if (a0.shield != null) {
      out.push('Shield the ' + nm(b0[a0.shield]) + ' on ' + kit.name(a0.shield) + ': it cannot be taken on the next turn.');
    } else if (a0.stop) {
      var run = sol.filter(function (x) { return x.by === me && !x.act.stop; }).slice(0, 3);
      out.push('Time Stop gives you three moves in a row' + (run.length ? ': ' + line(run, run.length) : '') + '.');
    } else if (a0.m) {
      var m = a0.m, mover = b0[m.from], pw = d.power ? d.power(k0.before, a0) : null, second = sol[1] && sol[1].by === me ? sol[1] : null;
      var bounced = k0.after.fx && k0.after.fx.bounce >= 0;
      if (m.blast) {
        // the vest: what it takes with it, theirs and (the price) yours
        var foes = k0.taken.filter(function (t) { return colorOf(t.p) !== me; }), ours = k0.taken.filter(function (t) { return colorOf(t.p) === me && t.sq !== m.from; });
        var name = function (t) { return 'the ' + nm(t.p) + ' on ' + kit.name(t.sq); };
        out.push(k0.label + ': the ' + nm(mover) + ' goes up' + (foes.length ? ' and takes ' + list(foes.map(name)) + ' with it' : '') + (ours.length ? ', and your ' + list(ours.map(function (t) { return nm(t.p) + ' on ' + kit.name(t.sq); })) + (ours.length > 1 ? ' go' : ' goes') + ' as well' : '') + '.');
      } else if (bounced) out.push(k0.label + ' bounces off the helmet: the ' + nm(b0[m.to]) + ' stays, but its helmet is gone.');
      else if (m.snipe && k0.taken.length) out.push(k0.label + ': the ' + nm(mover) + ' shoots the ' + nm(k0.taken[0].p) + ' on ' + kit.name(k0.taken[0].sq) + ' without leaving its square.');
      else if (k0.taken.length > 1) out.push(k0.label + ' takes the ' + nm(k0.taken[0].p) + ' and sets off a blast: ' + list(k0.taken.slice(1).map(function (t) { return 'the ' + nm(t.p) + ' on ' + kit.name(t.sq); })) + (k0.taken.length > 2 ? ' go' : ' goes') + ' as well.');
      else if (second && k0.taken.length && !d.double) out.push(k0.label + ' takes, and the capture earns another move right away: ' + second.label + '.');
      else if (second && d.double) out.push('Two moves this turn: ' + k0.label + ' and ' + second.label + '.');
      else if (pw) out.push(k0.label + ' is a move only ' + pw + ' allows.');
      else {
        // a fork: the moved piece attacks two valuable pieces at once
        var to = m.to, hits = targetsFrom(kit, k0.after, to).filter(function (q) { var x = k0.after.board[q]; return x && colorOf(x) !== me && (x.toLowerCase() === 'k' || val(x) >= 3); });
        var ray = rayMotif(k0.after, to, me), big = hits.filter(function (q) { var x = k0.after.board[q]; return x.toLowerCase() !== 'k' && val(x) > val(m.promo || mover); })[0];
        if (!k0.taken.length && hits.length >= 2) out.push(k0.label + ' attacks the ' + nm(k0.after.board[hits[0]]) + ' and the ' + nm(k0.after.board[hits[1]]) + ' at once.');
        else if (!k0.taken.length && k0.check && hits.filter(function (q) { return k0.after.board[q].toLowerCase() !== 'k'; }).length) {
          var also = hits.filter(function (q) { return k0.after.board[q].toLowerCase() !== 'k'; })[0];
          out.push(k0.label + ' gives check and attacks the ' + nm(k0.after.board[also]) + ' on ' + kit.name(also) + ' at the same time.');
        }
        else if (ray && ray.pin) out.push(k0.label + ' pins the ' + nm(ray.x) + ' on ' + kit.name(ray.xs) + ' to the ' + nm(ray.y) + '.');
        else if (ray) out.push(k0.label + ' skewers the ' + nm(ray.x) + ' and the ' + nm(ray.y) + ' behind it.');
        else if (!k0.taken.length && big != null) out.push(k0.label + ' attacks the ' + nm(k0.after.board[big]) + ' on ' + kit.name(big) + '.');
        else if (k0.taken.length && k0.check) out.push(k0.label + ' takes the ' + nm(k0.taken[0].p) + ' with check.');
        else if (k0.taken.length) out.push(k0.label + ' takes the ' + nm(k0.taken[0].p) + ' on ' + kit.name(k0.taken[0].sq) + '.');
        else if (k0.check) out.push(k0.label + ' gives check.');
        else out.push(k0.label + ' is the key move.');
      }
    }
    // a helmet that makes the move safe: the piece stands where it can be taken, but taking it would only bounce off
    if (a0.m && !a0.m.blast && k0.after.helmets && k0.after.helmets.indexOf(a0.m.to) >= 0 && attackedBy(kit, k0.after, a0.m.to, other(me))) {
      out.push('The ' + nm(k0.after.board[a0.m.to]) + ' on ' + kit.name(a0.m.to) + ' wears a helmet: taking it would only bounce off.');
    } else if (a0.m && !a0.m.blast && k0.after.helmets && k0.after.helmets.length) {
      // or another piece of yours hangs, and the helmet lets you leave it there
      var hung = k0.after.helmets.filter(function (q) { var x = k0.after.board[q]; return x && colorOf(x) === me && val(x) >= 3 && attackedBy(kit, k0.after, q, other(me)); })[0];
      if (hung != null) out.push('The ' + nm(k0.after.board[hung]) + ' on ' + kit.name(hung) + ' is attacked, but its helmet would take the hit.');
    }
    // where it ends: a mate, material, or simply the line
    var mateAt = -1;
    for (i = 0; i < all.length; i++) if (all[i].mate && all[i].by === me) { mateAt = i; break; }
    var gain = balance(all[all.length - 1].after, me) - balance(d.s, me);
    if (mateAt === 0) out.splice(0, out.length, k0.label + ' is checkmate.'); // nothing else to say
    else if (mateAt > 0) out.push('It ends in checkmate: ' + line(all, mateAt + 1) + '.');
    else if (gain >= 1 && sol.length > 1) out.push('In the end you are ' + worth(gain) + ' up: ' + line(sol, sol.length) + '.');
    else if (gain >= 1) out.push('In the end you are ' + worth(gain) + ' up.');
    else if (sol.some(function (x) { return x.by !== me; })) out.push('The line: ' + line(sol, sol.length) + '.'); // over several turns: worth spelling out
    // the other side's best defence
    // a whole turn as one text: a freeze and the move after it, two moves of a double move
    var turnAt = function (from) { var t = [], j = from; while (j < fol.length && fol[j].by === fol[from].by) { t.push(fol[j].label); j++; } return { text: t.join(' '), end: j }; };
    if (mateAt < 0 && fol.length && fol[0].by !== me) {
      var their = turnAt(0), ans = their.end < fol.length ? turnAt(their.end) : null;
      out.push('The best answer is ' + their.text + (ans ? ', met by ' + ans.text : '') + '.');
    }
    return out;
  }

  var api = { explain: explain, idea: idea, walk: walk, material: material, balance: balance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Coach = api;
})(typeof self !== 'undefined' ? self : this);
