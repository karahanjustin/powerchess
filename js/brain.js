/* The power-up brain: an alpha-beta search over the real Power Chess rules.
   Stockfish only knows normal chess. This search knows every power-up, for both
   sides: a gold statue is dead weight that still blocks, a frozen piece cannot
   run, a Midas side wins whatever it attacks. The free actions (Midas Touch,
   Freeze Ray, Turncoat, Time Stop) are part of the tree and cost no depth.

   In a game with power-ups this search decides. The chess engine is only asked
   to break ties between moves this search rates as equal.

   Runs in a worker (see the bottom) and in node for tests. */
(function (root) {
  'use strict';
  var R = root.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);
  var DBX = root.Drawbacks || null; // Drawback Chess rules, loaded on first use (js/drawbacks.js)

  var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  // the fairy pieces by their letters, with the values the rules give them
  var FAIRY_N = 80, NCODES = 12 + 2 * FAIRY_N;
  R.FAIRY_LETTERS.forEach(function (l) { VAL[l] = R.FAIRY[l].value; });
  var BASE = [100, 320, 330, 500, 900, 0];        // by type index: p n b r q k
  var ATKV = [100, 320, 330, 500, 900, 10000];    // what an attacker risks
  var MATE = 100000, INF = 1000000;

  /* ---------- tables ---------- */

  /* piece letter to a code: 0..11 for the chess pieces (white first), 12 and up for the fairy pieces
     (white block, then black block). CW says which colour a code belongs to. */
  var PIDX = new Int16Array(1300).fill(-1), CW = new Int8Array(NCODES);
  'PNBRQKpnbrqk'.split('').forEach(function (ch, i) { PIDX[ch.charCodeAt(0)] = i; CW[i] = i < 6 ? 0 : 1; });
  R.FAIRY_LETTERS.forEach(function (l, i) {
    PIDX[l.toUpperCase().charCodeAt(0)] = 12 + i; CW[12 + i] = 0;
    PIDX[l.charCodeAt(0)] = 12 + FAIRY_N + i; CW[12 + FAIRY_N + i] = 1;
  });
  var FCODE = 12; // codes from here on are fairy pieces
  /* Tables for the board size in use (BW x BH, up to 26 x 26): rows and columns, knight and king steps,
     the rays, the piece-square tables and the mirror square for Black. Built once per size and kept. */
  var MAXN = 676, BW = 0, BH = 0, BN = 0, BROW = null, BCOL = null, MIR = null, KN_T = null, KG_T = null, RAYS = null, PST_MG = null, PST_EG = null, BGEO = {};
  function buildGeo(w, h) {
    var KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    var DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]; // 0..3 diagonal, 4..7 straight
    var n = w * h, g = { row: new Int16Array(n), col: new Int16Array(n), mir: new Int16Array(n), kn: [], kg: [], rays: [], mg: [], eg: [] };
    var inB = function (rr, ff) { return rr >= 0 && rr < h && ff >= 0 && ff < w; };
    for (var sq = 0; sq < n; sq++) {
      var r = Math.floor(sq / w), f = sq % w, a = [], k = [], i, rr, ff;
      g.row[sq] = r; g.col[sq] = f; g.mir[sq] = (h - 1 - r) * w + f;
      for (i = 0; i < 8; i++) {
        rr = r + KN[i][0]; ff = f + KN[i][1];
        if (inB(rr, ff)) a.push(rr * w + ff);
        rr = r + DIRS[i][0]; ff = f + DIRS[i][1];
        if (inB(rr, ff)) k.push(rr * w + ff);
        var ray = [];
        rr = r + DIRS[i][0]; ff = f + DIRS[i][1];
        while (inB(rr, ff)) { ray.push(rr * w + ff); rr += DIRS[i][0]; ff += DIRS[i][1]; }
        g.rays.push(ray);
      }
      g.kn.push(a); g.kg.push(k);
    }
    // Piece-square tables from White's point of view (square 0 = a8), the same as before on 8 x 8.
    // The distance to the centre is scaled to the normal board, so a big board does not drive pieces off the edge.
    for (var t = 0; t < 6; t++) { g.mg.push(new Int16Array(n)); g.eg.push(new Int16Array(n)); }
    var cr = (h - 1) / 2, cf = (w - 1) / 2, span = Math.max(1, cr + cf) / 7, c1 = Math.floor(cf), c2 = Math.ceil(cf), kf = Math.floor(w / 2);
    for (sq = 0; sq < n; sq++) {
      var r2 = Math.floor(sq / w), f2 = sq % w, d = (Math.abs(r2 - cr) + Math.abs(f2 - cf)) / span, adv = (h - 2) - r2;
      // pawns: push the centre, keep the rest modest
      var pm = adv * 4;
      if (f2 === c1 || f2 === c2) pm += adv >= 2 ? 18 : adv === 1 ? 4 : -10;
      else if (f2 === c1 - 1 || f2 === c2 + 1) pm += adv >= 2 ? 6 : 0;
      g.mg[0][sq] = pm; g.eg[0][sq] = adv * 9;
      g.mg[1][sq] = g.eg[1][sq] = Math.round((4 - d) * 7) - (r2 === h - 1 ? 12 : 0);   // knights off the back rank
      g.mg[2][sq] = g.eg[2][sq] = Math.round((4 - d) * 3) - (r2 === h - 1 ? 10 : 0);
      g.mg[3][sq] = (r2 === 1 ? 20 : 0) + (f2 === c1 || f2 === c2 ? 6 : 0); g.eg[3][sq] = r2 === 1 ? 12 : 0;
      g.mg[4][sq] = Math.round((4 - d) * 1.5); g.eg[4][sq] = Math.round((4 - d) * 4);
      var km;
      if (r2 === h - 1) km = (f2 === w - 2 || f2 === 1) ? 28 : (f2 === w - 1 || f2 === 0 || f2 === 2) ? 16 : (f2 === kf) ? 0 : -12;
      else km = r2 === h - 2 ? -28 : -55;
      g.mg[5][sq] = km; g.eg[5][sq] = Math.round((4 - d) * 9);
    }
    return g;
  }
  function useGeo(s) {
    var w = (s && s.W) || 8, h = (s && s.H) || 8;
    if (w === BW && h === BH) return;
    var key = w + 'x' + h, g = BGEO[key] || (BGEO[key] = buildGeo(w, h));
    BW = w; BH = h; BN = w * h; BROW = g.row; BCOL = g.col; MIR = g.mir; KN_T = g.kn; KG_T = g.kg; RAYS = g.rays; PST_MG = g.mg; PST_EG = g.eg;
  }
  useGeo(null);

  var PASSED = [0, 6, 12, 26, 50, 85, 135];
  var MOB = [0, 4, 4, 2, 1], MOB_E = [0, 4, 4, 4, 2], MOB_BASE = [0, 4, 6, 7, 13];

  function moveKey(m) {
    return (m.duck ? 'Q' + m.duck : m.spawn ? 'P' : m.shot ? 'G' : m.reload ? 'L' : m.storm ? 'S' : m.drop ? 'D' + m.drop : m.snipe ? 'X' : 'n') + ':' + m.from + ':' + m.to + ':' + (m.promo || '');
  }
  // The same identity as a number, for the hash table and the killer slots.
  var C_GILD = 1000000000, C_FREEZE = 1100000000, C_CONVERT = 1200000000, C_STOP = 1300000000;
  function codeOf(m) {
    var kind = m.snipe ? 1 : m.drop ? 2 : m.storm ? 3 : m.swap ? 4 : m.duck === 'y' ? 5 : m.duck === 'b' ? 6 : m.spawn ? 7 : m.shot ? 8 : m.reload ? 9 : 0;
    var extra = m.promo ? 'qnrb'.indexOf(m.promo) + 1 : m.drop ? 'pnbrq'.indexOf(m.drop) + 1 : 0;
    // room for 676 squares: kind * 1e8 + (from + 1) * 1e5 + (to + 1) * 100 + extra; free actions sit above 1e9
    return kind * 100000000 + (m.from + 1) * 100000 + (m.to + 1) * 100 + extra;
  }

  // What a piece is worth to its owner, power-ups included. ti = type index.
  function worth(ti, pw) {
    var v = BASE[ti];
    if (ti === 2) { if (pw.sniper) v += 170; if (pw.ghostB) v += 80; }
    else if (ti === 1) { if (pw.dragon) v += 380; if (pw.archer) v += 150; }
    else if (ti === 4) { if (pw.amazon) v += 260; if (pw.immortal) v += 150; if (pw.sniperQ) v += 250; if (pw.ghostQ) v += 120; }
    else if (ti === 3) { if (pw.ghost) v += 90; if (pw.swap) v += 20; if (pw.sniperR) v += 200; }
    else if (ti === 0) { if (pw.rocket || pw.earlypromo) v += 45; if (pw.iron) v += 30; if (pw.sniperP) v += 40; }
    return v;
  }
  // Does this piece type shoot instead of capturing? (type index: p n b r q k)
  function shoots(ti, pw) {
    return pw.sniperAll || (ti === 2 ? pw.sniper : ti === 1 ? pw.archer : ti === 3 ? pw.sniperR : ti === 4 ? pw.sniperQ : ti === 0 ? pw.sniperP : pw.sniperK);
  }

  /* ---------- attacks ---------- */

  var blk = new Uint8Array(676), anyBlk = false; // squares no line passes: boulders, missing squares, ducks (set by evaluate)
  function rays(bc, sq, d0, d1, white, ghost, out, n) {
    for (var d = d0; d < d1; d++) {
      var ray = RAYS[sq * 8 + d];
      for (var j = 0; j < ray.length; j++) {
        var t = ray[j], c = bc[t];
        if (anyBlk && blk[t]) break;
        out[n++] = t;
        if (c >= 0) { if (ghost && (CW[c] === 0) === white) continue; break; } // Ghost Rooks look through their own pieces
      }
    }
    return n;
  }
  // Squares a piece attacks or defends, power-ups included. Returns how many were written to out.
  function pieceAttacks(bc, sq, ti, white, pw, out) {
    var n = 0, i, lst;
    if (ti === 0) {
      var pr = white ? BROW[sq] - 1 : BROW[sq] + 1, f = BCOL[sq];
      if (pr >= 0 && pr < BH) { if (f > 0) out[n++] = pr * BW + f - 1; if (f < BW - 1) out[n++] = pr * BW + f + 1; }
      return n;
    }
    if (ti === 1) {
      lst = KN_T[sq];
      for (i = 0; i < lst.length; i++) out[n++] = lst[i];
      return pw.dragon ? rays(bc, sq, 0, 4, white, false, out, n) : n;
    }
    if (ti === 2) return rays(bc, sq, 0, 4, white, !!pw.ghostB, out, 0);
    if (ti === 3) return rays(bc, sq, 4, 8, white, !!pw.ghost, out, 0);
    if (ti === 4) {
      n = rays(bc, sq, 0, 8, white, !!pw.ghostQ, out, 0);
      if (pw.amazon) { lst = KN_T[sq]; for (i = 0; i < lst.length; i++) out[n++] = lst[i]; }
      return n;
    }
    lst = KG_T[sq];
    for (i = 0; i < lst.length; i++) out[n++] = lst[i];
    return n;
  }

  /* ---------- evaluation ----------
     Static score from White's point of view, in centipawns. Leaves the attack maps
     of the position behind (attMin, attCnt, bc, fl), the Freeze Ray picker reads them. */

  var bc = new Int16Array(MAXN), fl = new Uint8Array(MAXN), tmp = new Int16Array(4096); // bc holds piece codes, up to NCODES (more than an Int8 can hold)
  var attMin = [new Uint16Array(MAXN), new Uint16Array(MAXN)], attCnt = [new Uint8Array(MAXN), new Uint8Array(MAXN)];
  var shot = [new Uint8Array(MAXN), new Uint8Array(MAXN)];    // squares a side's snipers can fire at
  var pMin = [new Int8Array(26), new Int8Array(26)], pMax = [new Int8Array(26), new Int8Array(26)], pCnt = [new Int8Array(26), new Int8Array(26)];
  var kings = [-1, -1];

  function nearSq(a, b) { return a >= 0 && Math.abs(BROW[a] - BROW[b]) <= 1 && Math.abs(BCOL[a] - BCOL[b]) <= 1; }
  // Can the piece on sq be captured at all, given its owner's power-ups and who attacks it?
  function takeable(sq, ti, ci, pw, fdef) {
    if (fl[sq] & 1) return false;                                   // gold
    if (ti === 4 && pw.immortal) return false;
    if (ti === 0 && pw.iron && attMin[1 - ci][sq] !== 100) return false;
    if (pw.bodyguard && nearSq(kings[ci], sq)) return false;
    if (fdef) {
      if (fdef.royal) return false;                                  // nobody takes a general
      if (fdef.immortal && attMin[1 - ci][sq] !== 10000) return false; // only a king takes an immortal
      if (fdef.decoy || fdef.martyr) return false;                   // taking it costs the taker as much
    }
    return true;
  }
  // Which squares a gorgon turns to stone: fl bit 4 on every enemy piece next to one.
  function markStone(s) {
    var b = s.board, i, j;
    for (i = 0; i < BN; i++) {
      var p = b[i];
      if (!p || !R.ability(s, i, 'gorgon')) continue;
      var zone = KG_T[i], c = R.colorOf(p);
      for (j = 0; j < zone.length; j++) {
        var t = zone[j], q = b[t];
        if (q && R.colorOf(q) !== c && !(R.isFairy(q) && R.fairyOf(q).gorgon)) fl[t] |= 4;
      }
    }
  }

  /* The game of Checkers: men and crowned kings only, so its own measure. A man is worth more the closer it gets
     to its crowning row, the back row is kept as a guard while the other side still has men to crown, kings want
     the middle, and the side ahead wants trades (two against one wins, eight against seven barely matters). */
  function checkersEval(s) {
    var b = s.board, H = s.H, W = s.W, i, p, w, r, f, v = 0, men = [0, 0], kings = [0, 0], ks = [[], []], all = [[], []];
    for (i = 0; i < b.length; i++) {
      p = b[i]; if (!p) continue;
      w = p === p.toUpperCase() ? 0 : 1; r = Math.floor(i / W); f = i % W;
      var t = p.toLowerCase(), sg = w ? -1 : 1, adv = w ? r : H - 1 - r; // rows travelled towards the crown
      all[w].push(i);
      if (t === 'є') {
        men[w]++;
        v += sg * (100 + adv * 6 + (adv >= H - 3 ? 12 : 0) + (f > 1 && f < W - 2 && adv > 1 && adv < H - 2 ? 4 : 0));
        if (adv === 0) v += sg * 9; // a back-row guard
      } else if (t === 'ї') {
        kings[w]++; ks[w].push(i);
        var dc = Math.abs(r - (H - 1) / 2) + Math.abs(f - (W - 1) / 2);
        v += sg * (165 - dc * 3);
      } else v += sg * (R.fairyOf(p) ? R.fairyOf(p).value : 300);
    }
    // the back-row guard only counts while the other side has men that could be crowned
    if (!men[1]) for (i = 0; i < all[0].length; i++) if (Math.floor(all[0][i] / W) === H - 1 && b[all[0][i]] === 'Є') v -= 9;
    if (!men[0]) for (i = 0; i < all[1].length; i++) if (Math.floor(all[1][i] / W) === 0 && b[all[1][i]] === 'є') v += 9;
    var nw = men[0] + kings[0], nb = men[1] + kings[1], tot = nw + nb;
    if (nw !== nb && tot) v += (nw - nb) * Math.round(180 / (tot + 2)); // trade down when ahead
    // the stronger side's kings close in on what is left (endings are won by hunting the last pieces down)
    var strong = nw > nb ? 0 : nb > nw ? 1 : -1;
    if (strong >= 0 && tot <= 8) {
      var weak = all[1 - strong], dsum = 0;
      for (i = 0; i < ks[strong].length; i++) for (var j = 0; j < weak.length; j++) {
        var a = ks[strong][i], c2 = weak[j];
        dsum += Math.max(Math.abs(Math.floor(a / W) - Math.floor(c2 / W)), Math.abs(a % W - c2 % W));
      }
      /* and box them in: every free square next to a weak piece is a way out. A lone king is hunted towards a
         single corner (a corner square of its own colour, a1 or h8), where it can be caught; the double corner is
         its fortress. */
      var room = 0, corner = 0, D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (j = 0; j < weak.length; j++) {
        var q = weak[j], qr = Math.floor(q / W), qf = q % W, best2 = 99;
        for (var d = 0; d < 4; d++) {
          var rr = qr + D[d][0], ff = qf + D[d][1]; if (rr >= 0 && rr < H && ff >= 0 && ff < W && !b[rr * W + ff]) room++;
          var cr = d & 1 ? H - 1 : 0, cf = d & 2 ? W - 1 : 0; // the four corners
          if ((cr + cf) % 2 === (qr + qf) % 2) best2 = Math.min(best2, Math.max(Math.abs(qr - cr), Math.abs(qf - cf)));
        }
        corner += best2 === 99 ? 0 : best2;
      }
      v += (strong ? 1 : -1) * (dsum * 2 + room * 10 + corner * 8); // white-positive: White as the stronger side wants all three small
    }
    return v;
  }

  function evaluate(s, cfg) {
    if (s.checkers) return checkersEval(s);
    if (s.sg) return evaluateCore(s, cfg) + shotgunTerms(s);
    return evaluateCore(s, cfg);
  }
  /* With a Shotgun King on the board pieces have hit points: a hurt piece is worth less (it falls to fewer pellets),
     and shells in the gun and in reserve are worth something to the side that has the gun. */
  function shotgunTerms(s) {
    var v = 0, k, p;
    for (k in s.dmg) { p = s.board[+k]; if (!p) continue; var loss = Math.min(1, s.dmg[k] / R.hpOf(p)) * 0.6 * (R.isRoyal(p) ? 900 : (VAL[R.typeOf(p)] || 100)); v += R.colorOf(p) === 'w' ? -loss : loss; }
    for (k in s.sg) v += (k === 'w' ? 1 : -1) * (s.sg[k][0] * 22 + s.sg[k][1] * 4);
    return v;
  }
  function evaluateCore(s, cfg) {
    useGeo(s);
    // what blocks the lines of the sliders: boulders that still stand, missing squares, ducks
    var tr = cfg.terrain;
    if (anyBlk) { blk.fill(0, 0, BN); anyBlk = false; }
    if (tr && ((tr.walls && tr.walls.length) || (tr.holes && tr.holes.length))) {
      anyBlk = true;
      if (tr.walls) for (var wi = 0; wi < tr.walls.length; wi++) if (!(s.rocks && s.rocks.indexOf(tr.walls[wi]) >= 0)) blk[tr.walls[wi]] = 1;
      if (tr.holes) for (wi = 0; wi < tr.holes.length; wi++) blk[tr.holes[wi]] = 1;
    }
    if ((s.ducks && s.ducks.length) || (s.bducks && s.bducks.length)) {
      anyBlk = true;
      for (var di = 0; di < s.ducks.length; di++) blk[s.ducks[di]] = 1;
      for (di = 0; di < s.bducks.length; di++) blk[s.bducks[di]] = 1;
    }
    var b = s.board, i, j, c, ti, ci, white, p, n, t, v;
    var pws = [R.powersOf(cfg, 'w'), R.powersOf(cfg, 'b')];
    var toMove = s.turn === 'w' ? 0 : 1;
    fl.fill(0, 0, BN);
    for (i = 0; i < s.gold.length; i++) fl[s.gold[i]] |= 1;
    for (i = 0; i < s.ice.length; i++) fl[s.ice[i]] |= 2;
    if (s.fairy & 2) markStone(s);
    attMin[0].fill(0, 0, BN); attMin[1].fill(0, 0, BN); attCnt[0].fill(0, 0, BN); attCnt[1].fill(0, 0, BN);
    var anyShot = [false, false];
    for (i = 0; i < 2; i++) anyShot[i] = !!(pws[i].sniperAll || pws[i].sniper || pws[i].archer || pws[i].sniperP || pws[i].sniperR || pws[i].sniperQ || pws[i].sniperK);
    /* Upgrades placed by hand on single pieces: a piece with one counts as if its side had the power-up for it.
       The sets with the power-up added are made only when such a piece is on the board. */
    var hasUp = (s.ghosts && s.ghosts.length > 0) || (s.snipers && s.snipers.length > 0), pwUp = null;
    if (hasUp) {
      pwUp = [0, 1].map(function (q) {
        var base = pws[q], G = Object.assign({}, base, { ghost: true, ghostB: true, ghostQ: true }), S = Object.assign({}, base, { sniper: true, archer: true, sniperP: true, sniperR: true, sniperQ: true, sniperK: true });
        return { g: G, s: S, gs: Object.assign({}, G, S, { ghost: true, ghostB: true, ghostQ: true }) };
      });
      for (i = 0; i < s.snipers.length; i++) { var sp = b[s.snipers[i]]; if (sp && s.gold.indexOf(s.snipers[i]) < 0) anyShot[R.colorOf(sp) === 'w' ? 0 : 1] = true; }
    }
    pMin[0].fill(BH); pMin[1].fill(BH); pMax[0].fill(-1); pMax[1].fill(-1); pCnt[0].fill(0); pCnt[1].fill(0);
    kings[0] = kings[1] = -1;
    for (i = 0; i < BN; i++) {
      p = b[i];
      if (!p) { bc[i] = -1; continue; }
      c = PIDX[p.charCodeAt(0)];
      bc[i] = c;
      if (c === 5) kings[0] = i;
      else if (c === 11) kings[1] = i;
      else if (c >= FCODE) { if (R.fairyOf(p).shoot && !(fl[i] & 1)) anyShot[CW[c]] = true; }
      else if (c === 0 || c === 6) {
        ci = c ? 1 : 0;
        var pf = BCOL[i], prow = BROW[i];
        pCnt[ci][pf]++;
        if (prow < pMin[ci][pf]) pMin[ci][pf] = prow;
        if (prow > pMax[ci][pf]) pMax[ci][pf] = prow;
      }
    }

    if (anyShot[0]) shot[0].fill(0, 0, BN);
    if (anyShot[1]) shot[1].fill(0, 0, BN);
    var mg = 0, eg = 0, npm = [0, 0], bishops = [0, 0], queens = [0, 0], guardedK = [false, false], royals = [];
    for (i = 0; i < BN; i++) {
      c = bc[i];
      if (c < 0) continue;
      ci = CW[c]; white = ci === 0;
      var pw = pws[ci], sgn = white ? 1 : -1, ps = white ? i : MIR[i];
      if (hasUp) { var ug = R.isGhostAt(s, i), us = R.isSniperAt(s, i); if (ug || us) pw = ug && us ? pwUp[ci].gs : ug ? pwUp[ci].g : pwUp[ci].s; }
      if (c >= FCODE) {
        // a fairy piece: its value, its reach on this board, and the squares it attacks or defends
        var fdef = R.fairyOf(b[i]), fv = fdef.value, royalF = !!fdef.royal;
        if (fl[i] & 1) { mg += sgn * fv * 0.1; eg += sgn * fv * 0.1; continue; }
        if (!royalF) npm[ci] += fv;
        var fm = fv, fe = fv, zn, zq;
        if (fdef.prince && kings[ci] >= 0 && Math.max(Math.abs(BROW[i] - BROW[kings[ci]]), Math.abs(BCOL[i] - BCOL[kings[ci]])) <= 3) { guardedK[ci] = true; fm += 60; fe += 90; }
        if (fdef.banner || fdef.gorgon) {
          // a bannerman is worth the pieces it lifts, a gorgon the pieces it holds
          zn = KG_T[i];
          for (j = 0; j < zn.length; j++) { zq = bc[zn[j]]; if (zq >= 0 && (CW[zq] === ci) === !!fdef.banner && !(fl[zn[j]] & 1)) { fm += fdef.banner ? 22 : 30; fe += fdef.banner ? 22 : 30; } }
        }
        if (fdef.demon) {
          /* A demon walks forward by itself: worth what lies on its way (the first piece it will reach, an enemy one
             is a threat, its own side's one a loss) and less the closer it is to falling off. */
          var ddir = white ? -1 : 1, dr = BROW[i] + ddir, dcol = BCOL[i], dsteps = 0, dfound = false;
          while (dr >= 0 && dr < BH) {
            var dq = dr * BW + dcol;
            if (tr && tr.holes && tr.holes.indexOf(dq) >= 0) break;
            dsteps++;
            if ((anyBlk && blk[dq]) || (fl[dq] & 1)) { dr += ddir; continue; }
            if (bc[dq] >= 0 && !dfound) {
              dfound = true;
              var dval = R.isRoyal(b[dq]) ? 900 : (VAL[R.typeOf(b[dq])] || 100);
              fm += (CW[bc[dq]] === ci ? -0.7 : 0.45) * dval / dsteps; fe += (CW[bc[dq]] === ci ? -0.7 : 0.45) * dval / dsteps;
              if (dsteps === 1 && CW[bc[dq]] !== ci) { if (!attMin[ci][dq] || fv < attMin[ci][dq]) attMin[ci][dq] = fv; attCnt[ci][dq]++; } // it takes that piece next
            }
            dr += ddir;
          }
          fm -= fv * Math.max(0, 1 - dsteps / 4); fe -= fv * Math.max(0, 1 - dsteps / 4); // little time left on the board
        }
        if (fdef.spawner && !R.asleep(s, i)) { fm += 30; fe += 30; } // a devil ready to spawn
        if (fdef.respawn && !(s.reborn && s.reborn.indexOf(i) >= 0)) { zq = white ? (BH - 1) * BW : BW - 1; if (bc[zq] < 0) { fm += 40; fe += 40; } } // a second life, not yet used
        if (!((fl[i] & 2) && ci !== toMove) && !(fl[i] & 4)) {
          var fa = R.fairyAttacks(s, cfg, i), fam = attMin[ci], fac = attCnt[ci], fcnt = 0, fav = royalF ? 10000 : fv, fsh = fdef.shoot || pw.sniperAll || (hasUp && R.isSniperAt(s, i)) ? shot[ci] : null;
          for (j = 0; j < fa.length; j++) {
            t = fa[j];
            if (!fam[t] || fav < fam[t]) fam[t] = fav;
            fac[t]++;
            if (fsh) fsh[t] = 1;
            var foc = bc[t];
            if (foc < 0 || CW[foc] !== ci) fcnt++;
          }
          if (!royalF) { fm += 3 * (fcnt - 6); fe += 3 * (fcnt - 6); }
        }
        if (royalF) { fm = 0; fe = 0; royals.push(i); } // a general or mounted king: nothing to win, everything to keep safe (below)
        mg += sgn * fm; eg += sgn * fe;
        continue;
      }
      ti = ci ? c - 6 : c;
      if (ti === 5) {
        var kl = KG_T[i];
        for (j = 0; j < kl.length; j++) { t = kl[j]; if (!attMin[ci][t]) attMin[ci][t] = 10000; attCnt[ci][t]++; if (pw.sniperK || pw.sniperAll) shot[ci][t] = 1; }
        mg += sgn * PST_MG[5][ps]; eg += sgn * PST_EG[5][ps];
        continue;
      }
      v = worth(ti, pw);
      if (fl[i] & 1) {
        // a statue is dead weight: it attacks nothing and gives no check, it only stands in the way
        mg += sgn * v * 0.1; eg += sgn * v * 0.1;
        continue;
      }
      var m = v + PST_MG[ti][ps], e = v + PST_EG[ti][ps];
      if (ti === 0) {
        var f = BCOL[i], row = BROW[i], adv = white ? (BH - 2) - row : row - 1, oi = 1 - ci, passed = true, ff;
        if (BH !== 8) adv = Math.round(adv * 6 / Math.max(1, BH - 2)); // the passed pawn bonus by the share of the way done
        for (ff = f - 1; ff <= f + 1; ff++) {
          if (ff < 0 || ff > BW - 1) continue;
          if (white ? pMin[oi][ff] < row : pMax[oi][ff] > row) { passed = false; break; }
        }
        if (passed) {
          var pb = PASSED[adv < 0 ? 0 : adv > 6 ? 6 : adv] * (pw.earlypromo ? 2 : 1) * (pw.rocket ? 1.4 : 1);
          m += pb * 0.5; e += pb;
        }
        if (pCnt[ci][f] > 1) { m -= 8; e -= 14; }
        if ((f === 0 || !pCnt[ci][f - 1]) && (f === BW - 1 || !pCnt[ci][f + 1])) { m -= 10; e -= 8; }
      } else {
        npm[ci] += BASE[ti];
        if (ti === 2) bishops[ci]++;
        else if (ti === 4) queens[ci]++;
        else if (ti === 3) {
          var rf = BCOL[i];
          if (!pCnt[ci][rf]) { m += pCnt[1 - ci][rf] ? 9 : 18; e += 8; }
        }
      }
      // A frozen piece does nothing while its owner waits for the turn. Once the owner is to move it defends again. Stone does nothing at all.
      if (!((fl[i] & 2) && ci !== toMove) && !(fl[i] & 4)) {
        n = pieceAttacks(bc, i, ti, white, pw, tmp);
        var av = ATKV[ti], am = attMin[ci], ac = attCnt[ci], cnt = 0, sh = anyShot[ci] && shoots(ti, pw) ? shot[ci] : null;
        for (j = 0; j < n; j++) {
          t = tmp[j];
          if (!am[t] || av < am[t]) am[t] = av;
          ac[t]++;
          if (sh) sh[t] = 1;
          var oc = bc[t];
          if (oc < 0 || (CW[oc] === 0) !== white) cnt++;
        }
        if (ti >= 1) { m += MOB[ti] * (cnt - MOB_BASE[ti]); e += MOB_E[ti] * (cnt - MOB_BASE[ti]); }
      }
      mg += sgn * m; eg += sgn * e;
    }

    // the squares around a general or mounted king, once every piece's attacks are known
    for (j = 0; j < royals.length; j++) {
      var rq = royals[j], rc = CW[bc[rq]], rz = KG_T[rq], rd = 0;
      for (var q = 0; q < rz.length; q++) rd += attCnt[1 - rc][rz[q]];
      mg -= (rc ? -1 : 1) * rd * 6;
    }
    var score = 0;
    // threats, Midas targets, king safety
    for (ci = 0; ci < 2; ci++) {
      var ei = 1 - ci, sg = ci === 0 ? 1 : -1, mypw = pws[ci], t1 = 0, t2 = 0, frozen = 0, g1 = 0, g2 = 0;
      var midasFoe = pws[ei].midas, freezeFoe = pws[ei].freeze, snap = 0;
      for (i = 0; i < BN; i++) {
        c = bc[i];
        if (c < 0 || CW[c] !== ci) continue;
        ti = c >= FCODE ? 6 : (ci ? c - 6 : c);
        var fd2 = ti === 6 ? R.fairyOf(b[i]) : null;
        if (ti === 5 || !attCnt[ei][i] || !takeable(i, ti, ci, mypw, fd2)) continue;
        v = ti === 6 ? fd2.value : worth(ti, mypw);
        if (fd2 && fd2.respawn && !(s.reborn && s.reborn.indexOf(i) >= 0) && bc[ci ? BW - 1 : (BH - 1) * BW] < 0) v *= 0.5; // it would only come back
        if (midasFoe) { if (v > g1) { g2 = g1; g1 = v; } else if (v > g2) g2 = v; }
        var defended = attCnt[ci][i] > 0, low = attMin[ei][i], thr;
        // Freeze Ray on the other side: a lone defender gets frozen, then the piece is simply taken
        if (freezeFoe && attCnt[ci][i] === 1 && attMin[ci][i] !== 10000) {
          if (ci === toMove) defended = false;
          else if (!s.freezeUsed && v > snap) snap = v;
        }
        if (!defended || (anyShot[ei] && shot[ei][i])) thr = v; // a sniper shoots it, defended or not
        else if (low === 10000) thr = 0;                     // a king cannot take a defended piece
        else { var plain = ti === 6 ? v : BASE[ti]; thr = low < plain ? plain - low : 0; }
        if (!thr) continue;
        if (ci === toMove) {
          if (fl[i] & 6) frozen += thr;                      // cannot step away this turn (ice or stone)
          else if (thr > t1) { t2 = t1; t1 = thr; } else if (thr > t2) t2 = thr;
        }
      }
      // the side to move saves one hanging piece, not two. A frozen one cannot run at all.
      if (ci === toMove) score -= sg * (t2 * 0.5 + t1 * 0.08 + frozen * 0.55);
      else if (snap) score -= sg * snap * 0.6;
      // Midas: whatever the other side attacks turns to gold, one piece per turn, for free
      if (midasFoe) {
        var lim = pws[ei].midasPerTurn, gain;
        if (ei === toMove) gain = lim === -1 ? g1 * 0.5 + g2 * 0.2 // it costs the move, so it is worth less than a free one
          : (!lim || s.midasUsed < lim) ? g1 * 0.8 + g2 * 0.25 : g2 * 0.3 + g1 * 0.08;
        else gain = g2 * 0.5 + g1 * 0.12;
        score -= sg * gain * 0.9;
      }
      // king safety: enemy attacks around the king, a pawn shield in front of it
      var k = kings[ci];
      if (k >= 0) {
        var zone = KG_T[k], danger = 0, shield = 0, ownPawn = ci ? 6 : 0, front = ci ? 1 : -1;
        for (j = 0; j < zone.length; j++) {
          t = zone[j];
          danger += attCnt[ei][t];
          if (bc[t] === ownPawn && BROW[t] - BROW[k] === front) shield++;
          if ((fl[t] & 1) && bc[t] >= 0 && CW[bc[t]] === ci) danger++; // an own statue next to the king only takes a flight square
        }
        if (attCnt[ei][k]) danger += 2;
        var heat = npm[ei] >= 1500 ? (queens[ei] ? 1 : 0.55) : 0.2;
        if (guardedK[ci]) heat *= 0.25; // a prince nearby: no check, no mate
        mg -= sg * (Math.min(danger * danger * 2.2, 420) * heat - shield * 11);
      }
      if (bishops[ci] >= 2) { mg += sg * 28; eg += sg * 40; }
    }

    var phase = (npm[0] + npm[1]) / 6200;
    if (phase > 1) phase = 1;
    score += mg * phase + eg * (1 - phase);
    // pieces waiting in the pocket
    var kw = R.pocketKey(cfg, 'w'), kb = R.pocketKey(cfg, 'b');
    if (pws[0].drops) for (i = 0; i < s[kw].length; i++) score += VAL[s[kw][i]] * 0.9;
    if (pws[1].drops) for (i = 0; i < s[kb].length; i++) score -= VAL[s[kb][i]] * 0.9;
    // an unused Time Stop or Turncoat is worth keeping for a real gain
    if (pws[0].timestop && s.stopUsed.indexOf('w') < 0) score += 130;
    if (pws[1].timestop && s.stopUsed.indexOf('b') < 0) score -= 130;
    if (pws[0].turncoat && s.turned.indexOf('w') < 0) score += 220;
    if (pws[1].turncoat && s.turned.indexOf('b') < 0) score -= 220;
    // the move itself, and extra moves in hand
    score += toMove ? -10 : 10;
    if (s.movesLeft > 1) score += (toMove ? -1 : 1) * 45 * (s.movesLeft - 1);
    if (s.again >= 0) score += toMove ? -30 : 30; // an assassin's bonus move in hand
    return score;
  }

  /* ---------- hash table ---------- */

  var TT_BITS = 20, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  var tLock = null, tScore = null, tMove = null, tInfo = null, tCtl = null;
  var EXACT = 0, LOWER = 1, UPPER = 2;
  /* The table can live in shared memory, so that several workers search the same position and feed
     each other (see think: helper). Nothing is locked. An entry carries a checksum of its own fields
     in the lock word instead, so a half-written entry simply does not match.
     ctl[0] is the number of the search that is wanted right now. A search that was started with
     another number (opts.gen) stops at once: that is how helpers are called off. */
  function makeTable(bits, shared) {
    var n = 1 << bits, mk = function (bytes) { return shared && typeof SharedArrayBuffer !== 'undefined' ? new SharedArrayBuffer(n * bytes) : new ArrayBuffer(n * bytes); };
    return { lock: mk(4), score: mk(4), move: mk(4), info: mk(2), ctl: shared && typeof SharedArrayBuffer !== 'undefined' ? new SharedArrayBuffer(8) : new ArrayBuffer(8) };
  }
  function useTable(t) {
    tLock = new Int32Array(t.lock); tScore = new Int32Array(t.score); tMove = new Int32Array(t.move); tInfo = new Int16Array(t.info);
    tCtl = t.ctl ? new Int32Array(t.ctl) : null;
    TT_SIZE = tLock.length; TT_MASK = TT_SIZE - 1;
  }
  function mix(v, code, info) { return (Math.imul(v, 0x9E3779B1) ^ Math.imul(code, 0x85EBCA6B) ^ (info << 13)) | 0; }
  var Z1 = new Int32Array(NCODES * MAXN + 6000), Z2 = new Int32Array(NCODES * MAXN + 6000);
  (function () {
    var x = 0x9E3779B9 | 0;
    function rnd() { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x | 0; }
    for (var i = 0; i < Z1.length; i++) { Z1[i] = rnd(); Z2[i] = rnd(); }
  })();
  // Offsets into Z1/Z2: piece code times MAXN plus square, then the rest of the state (square-sized blocks are MAXN long).
  var ZX = NCODES * MAXN;
  var Z_TURN = ZX, Z_CASTLE = ZX + 1, Z_EP = ZX + 5, Z_GOLD = Z_EP + MAXN, Z_ICE = Z_GOLD + MAXN, Z_MOVES = Z_ICE + MAXN, Z_MIDAS = Z_MOVES + 8, Z_FREEZE = Z_MIDAS + 4, Z_STOP = Z_FREEZE + 1, Z_TURNED = Z_STOP + 2, Z_POCKET = Z_TURNED + 2;
  var Z_AGAIN = Z_POCKET + 32, Z_ROCK = Z_AGAIN + MAXN, Z_LASTW = Z_ROCK + MAXN, Z_LASTB = Z_LASTW + NCODES, Z_DICE = Z_LASTB + NCODES, Z_UP = Z_DICE + 64; // the Ouroboros state: bonus move, broken boulders, what a fool copies
  var h1 = 0, h2 = 0;
  function hashState(s, sig) {
    var a = sig ^ Math.imul(((s.W || 8) << 5) + (s.H || 8), 0x2545F491), c = sig * 31 | 0, b = s.board, i, p, k;
    for (i = 0; i < b.length; i++) {
      p = b[i];
      if (p) { k = PIDX[p.charCodeAt(0)] * MAXN + i; a ^= Z1[k]; c ^= Z2[k]; }
    }
    if (s.turn === 'b') { a ^= Z1[Z_TURN]; c ^= Z2[Z_TURN]; }
    for (i = 0; i < s.castling.length; i++) { k = Z_CASTLE + 'KQkq'.indexOf(s.castling[i]); a ^= Z1[k]; c ^= Z2[k]; }
    if (s.ep >= 0) { a ^= Z1[Z_EP + s.ep]; c ^= Z2[Z_EP + s.ep]; }
    for (i = 0; i < s.gold.length; i++) { k = Z_GOLD + s.gold[i]; a ^= Z1[k]; c ^= Z2[k]; }
    for (i = 0; i < s.ice.length; i++) { k = Z_ICE + s.ice[i]; a ^= Z1[k]; c ^= Z2[k]; }
    k = Z_MOVES + (s.movesLeft > 7 ? 7 : s.movesLeft); a ^= Z1[k]; c ^= Z2[k];
    k = Z_MIDAS + (s.midasUsed > 3 ? 3 : s.midasUsed); a ^= Z1[k]; c ^= Z2[k];
    if (s.freezeUsed) { a ^= Z1[Z_FREEZE]; c ^= Z2[Z_FREEZE]; }
    if (s.stopUsed) for (i = 0; i < s.stopUsed.length; i++) { k = Z_STOP + (s.stopUsed[i] === 'w' ? 0 : 1); a ^= Z1[k]; c ^= Z2[k]; }
    if (s.turned) for (i = 0; i < s.turned.length; i++) { k = Z_TURNED + (s.turned[i] === 'w' ? 0 : 1); a ^= Z1[k]; c ^= Z2[k]; }
    // pockets are bags, so their letters are added, not xored
    for (i = 0; i < s.pocket.length; i++) { k = Z_POCKET + 'pnbrq'.indexOf(s.pocket[i]); a = (a + Z1[k]) | 0; c = (c + Z2[k]) | 0; }
    for (i = 0; i < s.pocket2.length; i++) { k = Z_POCKET + 8 + 'pnbrq'.indexOf(s.pocket2[i]); a = (a + Z1[k]) | 0; c = (c + Z2[k]) | 0; }
    // three-dice chess: the dice still to be used this turn (a bag, so added up)
    if (s.dice && s.dice.length < 4) for (i = 0; i < s.dice.length; i++) { k = Z_DICE + (s.dice[i].charCodeAt(0) & 63); a = (a + Z1[k]) | 0; c = (c + Z2[k]) | 0; }
    if (s.fairy) {
      if (s.again >= 0) { k = Z_AGAIN + s.again; a ^= Z1[k]; c ^= Z2[k]; }
      if (s.rocks) for (i = 0; i < s.rocks.length; i++) { k = Z_ROCK + s.rocks[i]; a ^= Z1[k]; c ^= Z2[k]; }
      if (s.lastW) { k = Z_LASTW + PIDX[s.lastW.charCodeAt(0)]; a ^= Z1[k]; c ^= Z2[k]; }
      if (s.lastB) { k = Z_LASTB + PIDX[s.lastB.charCodeAt(0)]; a ^= Z1[k]; c ^= Z2[k]; }
    }
    // upgrades placed by hand: ghosts and camo pieces by square
    if (s.ghosts) for (i = 0; i < s.ghosts.length; i++) { k = Z_UP + s.ghosts[i]; a ^= Z1[k]; c ^= Z2[k]; }
    if (s.snipers) for (i = 0; i < s.snipers.length; i++) { k = Z_UP + MAXN + s.snipers[i]; a ^= Z1[k]; c ^= Z2[k]; }
    if (s.reborn) for (i = 0; i < s.reborn.length; i++) { k = Z_UP + s.reborn[i]; a ^= Math.imul(Z1[k], 31); c ^= Math.imul(Z2[k], 17); } // spent second lives
    // ducks and the duck part of a turn, devils asleep, demons spawned this turn (the same keys, mixed apart)
    if (s.ducks) for (i = 0; i < s.ducks.length; i++) { k = Z_GOLD + s.ducks[i]; a ^= Math.imul(Z1[k], 7); c ^= Math.imul(Z2[k], 11); }
    if (s.bducks) for (i = 0; i < s.bducks.length; i++) { k = Z_GOLD + s.bducks[i]; a ^= Math.imul(Z1[k], 13); c ^= Math.imul(Z2[k], 19); }
    if (s.duckHand) { a ^= Math.imul(Z1[Z_MOVES + 7], 3 + s.duckHand); c ^= Math.imul(Z2[Z_MOVES + 7], 5 + s.duckHand); }
    if (s.duckPhase) { a ^= Math.imul(Z1[Z_TURN], 23); c ^= Math.imul(Z2[Z_TURN], 29); for (i = 0; i < s.dTodo.length; i++) { k = Z_ICE + s.dTodo[i]; a ^= Math.imul(Z1[k], 37); c ^= Math.imul(Z2[k], 41); } }
    if (s.bMoved) for (i = 0; i < s.bMoved.length; i++) { k = Z_ICE + s.bMoved[i]; a ^= Math.imul(Z1[k], 43); c ^= Math.imul(Z2[k], 47); }
    if (s.sleep) for (i = 0; i < s.sleep.length; i++) { k = Z_ROCK + (s.sleep[i] >> 2); a ^= Math.imul(Z1[k], 53 + (s.sleep[i] & 3)); c ^= Math.imul(Z2[k], 59 + (s.sleep[i] & 3)); }
    if (s.fresh) for (i = 0; i < s.fresh.length; i++) { k = Z_ROCK + s.fresh[i]; a ^= Math.imul(Z1[k], 61); c ^= Math.imul(Z2[k], 67); }
    if (s.sg) {
      // a Shotgun King: shells and the damage on each square
      for (var gk in s.sg) { k = Z_MOVES + (gk === 'w' ? 1 : 2); a ^= Math.imul(Z1[k], 71 + s.sg[gk][0] * 13 + s.sg[gk][1]); c ^= Math.imul(Z2[k], 73 + s.sg[gk][0] * 17 + s.sg[gk][1]); }
      for (var dk in s.dmg) { k = Z_ICE + (+dk); var dv = Math.round(s.dmg[dk] * 8); a ^= Math.imul(Z1[k], 79 + dv); c ^= Math.imul(Z2[k], 83 + dv); }
    }
    h1 = a; h2 = c;
  }
  function sigOf(cfg) {
    var str = JSON.stringify([cfg.pw || cfg, !!cfg.freeArmy, !!cfg.kingCapture, !!cfg.checkers, !!cfg.duckChess, !!cfg.sgExpect]), h = 7;
    for (var i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
    return h;
  }

  /* ---------- ducks ----------
     A duck can go to almost any square, so a node with a duck to move has dozens of moves that mostly mean nothing.
     They are scored by what they do and only the best are searched: a duck between an enemy piece and what it
     could take blocks that capture (worth what would be taken, everything for a king), a duck between an own
     piece and its target spoils that capture, a duck next to the enemy king takes a square from it, and a duck
     that leaves a square may open a capture there for the other side. Blue ducks (optional) only make it in
     when they score well. */
  function duckLines(st, cfg, c, sc, w) {
    var caps = R.pseudoMoves(st, cfg, true);
    for (var i = 0; i < caps.length; i++) {
      var m = caps[i];
      if (!m.cap || m.from < 0 || R.colorOf(m.cap) === c) continue;
      var v = R.isRoyal(m.cap) ? 3000 : (VAL[R.typeOf(m.cap)] || 100);
      var fr = BROW[m.from], ff = BCOL[m.from], tr = BROW[m.capSq], tf = BCOL[m.capSq], dr = Math.sign(tr - fr), df = Math.sign(tf - ff);
      if ((fr !== tr && ff !== tf && Math.abs(tr - fr) !== Math.abs(tf - ff)) || Math.max(Math.abs(tr - fr), Math.abs(tf - ff)) < 2) continue; // a jump or a step: nothing to put in between
      for (var r = fr + dr, f = ff + df; r !== tr || f !== tf; r += dr, f += df) sc[r * BW + f] += w * v;
    }
    return caps;
  }
  var DSC = new Float64Array(676);
  function capSet(st, cfg) { var out = {}, l = R.pseudoMoves(st, cfg, true); for (var i = 0; i < l.length; i++) if (l[i].cap) out[l[i].from + '>' + l[i].capSq] = R.isRoyal(l[i].cap) ? 3000 : (VAL[R.typeOf(l[i].cap)] || 100); return out; }
  function duckCut(s, cfg, moves, root) {
    var dm = [], other = [], i;
    for (i = 0; i < moves.length; i++) (moves[i].duck ? dm : other).push(moves[i]);
    if (!dm.length) return moves;
    useGeo(s);
    var me = s.turn, foe = me === 'w' ? 'b' : 'w', view = {}, k;
    for (k in s) view[k] = s[k];
    view.duckPhase = 0; view.dTodo = []; view.bMoved = [];
    DSC.fill(0, 0, BN);
    view.turn = foe; var foeCaps = capSet(view, cfg); duckLines(view, cfg, foe, DSC, 1);
    view.turn = me; duckLines(view, cfg, me, DSC, -0.6);
    for (i = 0; i < BN; i++) {
      var p = s.board[i];
      if (p && R.isRoyal(p) && R.colorOf(p) === foe) { var kl = KG_T[i]; for (var j = 0; j < kl.length; j++) DSC[kl[j]] += cfg.kingCapture ? 40 : 25; }
      DSC[i] += 6 - Math.max(Math.abs(BROW[i] - (BH - 1) / 2), Math.abs(BCOL[i] - (BW - 1) / 2)); // a little for the middle
    }
    // what a duck that leaves its square opens for the other side
    var leave = {};
    for (i = 0; i < dm.length; i++) {
      var q = dm[i].from;
      if (q < 0 || leave[q] != null) continue;
      var v2 = {};
      for (k in view) v2[k] = view[k];
      v2.ducks = s.ducks.filter(function (x) { return x !== q; }); v2.bducks = s.bducks.filter(function (x) { return x !== q; }); v2.turn = foe;
      var after = capSet(v2, cfg), pen = 0;
      for (k in after) if (!(k in foeCaps)) pen += after[k];
      leave[q] = pen;
    }
    for (i = 0; i < dm.length; i++) {
      var m = dm[i];
      m.dscore = DSC[m.to] - (m.from >= 0 ? leave[m.from] : 0) - (m.duck === 'b' ? 30 : 0); // an optional blue move has to be worth it
    }
    dm.sort(function (x, y) { return y.dscore - x.dscore; });
    var yellow = dm.filter(function (m) { return m.duck === 'y'; }), blue = dm.filter(function (m) { return m.duck === 'b' && m.dscore > 20; });
    var keepY = root ? yellow.length : Math.min(yellow.length, 10), keepB = root ? Math.min(blue.length, 8) : Math.min(blue.length, 2);
    return other.concat(yellow.slice(0, keepY), blue.slice(0, keepB));
  }

  /* ---------- search ---------- */

  // For how many turns from the root the free actions are part of the tree (0 = the root side's own turn).
  var FREE_TURNS = 3;
  /* Switches for the search refinements. All on; they exist so that each one can be measured on its own
     (node: BRAIN_OPT='{"lmp":false}'). rfp, fut, lmp, lmr: pruning by the static score and reductions
     for late moves. canon: one order of free actions per turn. fred: a shallower first look at free
     actions. bar: a root free action has to clear the best one found so far. */
  var OPT = { rfp: true, fut: true, lmp: true, lmr: true, canon: true, fred: true, bar: true };
  if (typeof process !== 'undefined' && process.env && process.env.BRAIN_OPT) { try { var eo = JSON.parse(process.env.BRAIN_OPT); for (var ek in eo) OPT[ek] = eo[ek]; } catch (e) { /* keep the defaults */ } }
  /* ---------- Dice Chess: the odds ----------
     Nobody knows the next throw, so the search ends where a side is about to roll. There the position is worth
     its static score plus what the throw is likely to bring: for every kind of piece the best capture it allows
     (taking the king wins the game under king capture), weighted by the chance that this kind comes up and no
     better one does. A guarded target is worth less: the other side may take back, if its throw allows. */
  var DICE_WIN = 9000;
  function unrolled(s, cfg) { return !!cfg.dice && !cfg.legacyDice && !s.dice && s.again < 0 && !s.lost; }
  function captureGains(s, cfg) {
    var me = s.turn, foe = me === 'w' ? 'b' : 'w', caps = R.pseudoMoves(s, cfg, true), best = {}, i;
    for (i = 0; i < caps.length; i++) {
      var m = caps[i];
      if (!m.cap) continue;
      var royal = R.isRoyal(m.cap), v;
      if (royal) v = cfg.kingCapture ? DICE_WIN : 0;
      else {
        v = VAL[R.typeOf(m.cap)] || 0;
        if (!m.snipe && R.attacked(s, m.capSq, foe, cfg)) v = Math.max(0, v - 0.6 * (VAL[R.typeOf(m.piece)] || 0));
      }
      var t = R.dieOf(m);
      if (v > (best[t] || 0)) best[t] = v;
    }
    return best;
  }
  // The expected best capture of the coming throw: the kinds sorted by what they win, each counted when it comes
  // up and none better does. A throw shows `dice` faces out of the pool's k kinds.
  function expectedGain(s, cfg) {
    var best = captureGains(s, cfg), k = s.pool && s.pool.length ? s.pool.length : 6, d = R.diceCount(cfg), g = [], t, i, e = 0;
    for (t in best) g.push(best[t]);
    g.sort(function (a, b) { return b - a; });
    for (i = 0; i < g.length; i++) e += g[i] * (Math.pow((k - i) / k, d) - Math.pow(Math.max(0, k - i - 1) / k, d));
    return e;
  }
  function chanceValue(s, cfg) {
    useGeo(s);
    return (s.turn === 'w' ? 1 : -1) * evaluate(s, cfg) + 0.85 * expectedGain(s, cfg);
  }
  /* Before the throw (the eval bar and a hint before rolling): the average over every throw, each searched to the
     end of the turn. With up to 84 different throws all of them are looked at, weighted by how often each comes
     up; with a bigger pool a fixed sample of 48 throws stands in for them. */
  function thinkRoll(state, cfg, opts) {
    var pool = state.pool && state.pool.length ? state.pool : ['p', 'n', 'b', 'r', 'q', 'k'], k = pool.length, d = R.diceCount(cfg);
    var throws = [], i, j, l;
    var fact = function (n) { return n <= 1 ? 1 : n * fact(n - 1); };
    var weight = function (idx) { var c = {}, w = fact(d); idx.forEach(function (x) { c[x] = (c[x] || 0) + 1; }); for (var x in c) w /= fact(c[x]); return w / Math.pow(k, d); };
    if (d === 3 && k <= 7) { for (i = 0; i < k; i++) for (j = i; j < k; j++) for (l = j; l < k; l++) throws.push({ f: [pool[i], pool[j], pool[l]], w: weight([i, j, l]) }); }
    else if (d === 2 && k <= 12) { for (i = 0; i < k; i++) for (j = i; j < k; j++) throws.push({ f: [pool[i], pool[j]], w: weight([i, j]) }); }
    else {
      var x = 0x9E3779B1;
      var rnd = function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
      for (i = 0; i < 48; i++) { var f = []; for (j = 0; j < d; j++) f.push(pool[Math.floor(rnd() * k)]); throws.push({ f: f, w: 1 / 48 }); }
    }
    var per = Math.max(15, Math.floor((opts.ms || 600) / throws.length)), sum = 0, wsum = 0, nodes = 0;
    for (i = 0; i < throws.length; i++) {
      var n = R.roll(state, cfg, throws[i].f), v;
      if (!n) continue;
      var S = new Search(cfg, Object.assign({}, opts, { ms: per }));
      if (!n.dice && n.turn === state.turn) continue; // two dice that allow nothing are thrown again: left out
      if (n.turn !== state.turn) v = -chanceValue(n, cfg); // nothing to move: the turn is lost
      else v = S.search(n, d + 1, -INF, INF, 1, 0, false);
      v = Math.max(-DICE_WIN, Math.min(DICE_WIN, v)); // a throw that takes the king is a won game, counted as such
      nodes += S.nodes;
      sum += v * throws[i].w; wsum += throws[i].w;
    }
    var score = wsum ? Math.round(sum / wsum) : 0;
    return { depth: d, nodes: nodes, score: score, actions: [], trail: [score], expected: true };
  }

  function Search(cfg, opts) {
    this.cfg = cfg;
    this.deadline = Date.now() + (opts.ms || 1000);
    this.nodes = 0;
    this.stopped = false;
    this.killers = new Int32Array(256);
    this.hist = new Int32Array(NCODES * BN);
    /* Midas, Freeze Ray, Turncoat and Time Stop are always part of the tree, for whichever side has them.
       opts.free = false only keeps them out of the list of root actions. It must never switch them off
       inside the tree: a bot without power-ups still has to see the other side's freeze coming. */
    this.free = true;
    this.rootFree = opts.free !== false;
    this.gen = opts.gen == null ? null : opts.gen;
    this.seen = opts.seen || null;   // positions the game has already been through: { key: count }
    /* Drawback Chess: opts.db = { w|b: { id, params } for the side whose drawback the search knows (its own),
       seed }. Its moves are filtered by the drawback, losing by it ends a line, the history rides along on the
       states (Drawbacks.play), and the hash table stays out: a position means different things after different
       histories. */
    this.db = opts.db || null;
    if (this.db && !DBX) DBX = typeof require !== 'undefined' ? require('./drawbacks.js') : root.Drawbacks;
    var selfS = this;
    this.play = this.db ? function (st, m, c) { return DBX.play(st, m, c, selfS.db); } : R.play;
    this.rootTurn = 'w';
    this.maxPly = 12;
    this.sig = sigOf(cfg);
    // a search held to a few moves of depth keeps to its own entries, so it cannot borrow from a deeper one
    if (opts.maxDepth && opts.maxDepth < 64) this.sig = (this.sig ^ Math.imul(opts.maxDepth, 0x27d4eb2d)) | 0;
    if (!tLock) useTable(makeTable(TT_BITS, false));
    // what kind of game this is, for the pruning: free actions and wild power-ups call for more care
    var pa = R.powersOf(cfg, 'w'), pb2 = R.powersOf(cfg, 'b');
    this.hasFree = !!(pa.midas || pa.freeze || pa.turncoat || pa.timestop || pb2.midas || pb2.freeze || pb2.turncoat || pb2.timestop);
    this.wild = !!(pa.double || pa.rampage || pa.explosive || pa.drops || pa.rocket || pb2.double || pb2.rampage || pb2.explosive || pb2.drops || pb2.rocket);
  }

  Search.prototype.timeUp = function () {
    if ((this.nodes & 255) === 0 && (Date.now() > this.deadline || (this.gen !== null && tCtl[0] !== this.gen))) this.stopped = true;
    return this.stopped;
  };

  /* The free actions worth a look in this position. tp counts the turns since the root:
     0 is the root side's own turn, 1 the reply, and so on. They are part of the tree for two
     turns of each side (FREE_TURNS), with fewer candidates the further out it gets. Beyond
     that the evaluation stands in for them. Freeze Ray is not in this list: it is searched
     move by move, see the pairs in search(). */
  Search.prototype.freeActions = function (s, tp, atRoot, legal) {
    var cfg = this.cfg, pt = R.powersOf(cfg, s.turn), out = [], b = s.board, i;
    var byValue = function (x, y) { return VAL[R.typeOf(b[y])] - VAL[R.typeOf(b[x])]; };
    // In the tree a turn is searched in one order only: gild first, then the move with its freeze. The other orders lead to the same positions.
    if (pt.midas && (atRoot || !OPT.canon || !s.freezeUsed) && (pt.midasPerTurn > 0 ? s.midasUsed < pt.midasPerTurn : pt.midasPerTurn === -1 || atRoot || s.midasUsed < 2)) {
      var g = R.gildTargets(s, cfg, legal || null).sort(byValue).slice(0, atRoot ? 5 : tp === 0 ? 2 : 1);
      if (!atRoot && tp >= 2 && g.length && VAL[R.typeOf(b[g[0]])] < 300) g = []; // far out only a piece is worth the branch
      for (i = 0; i < g.length; i++) out.push({ gild: g[i], key: 'g' + g[i], code: C_GILD + g[i] });
    }
    if (tp === 0) {
      if (pt.turncoat && s.turned.indexOf(s.turn) < 0) {
        var cv = R.convertTargets(s, cfg).sort(byValue).slice(0, atRoot ? 3 : 1);
        for (i = 0; i < cv.length; i++) out.push({ convert: cv[i], key: 'c' + cv[i], code: C_CONVERT + cv[i] });
      }
    }
    // Time Stop: on the own turn, and on the reply turn so that three moves in a row do not come as a surprise
    if (tp <= 1 && pt.timestop && R.stopReady(s, cfg)) out.push({ stop: true, key: 't', code: C_STOP });
    return out;
  };
  /* Which piece answers a move? After a position has been searched, the hash table holds the best
     reply to it. The square that reply starts from is returned, or -1. A move that fails only
     because one particular piece takes, blocks or runs is the case for Freeze Ray, and this is
     how the search finds that piece. */
  Search.prototype.refuter = function (n, tp) {
    hashState(n, tp <= FREE_TURNS && this.free ? this.sig ^ 0x5bd1e995 : this.sig);
    var idx = h1 & TT_MASK, code = tMove[idx];
    if ((tLock[idx] ^ mix(tScore[idx], code, tInfo[idx])) !== h2) return -1;
    var from, p;
    if (code >= C_GILD && code < C_FREEZE) {
      // the answer is Midas Touch: it needs a piece that could capture the target. If there is just one, that is the piece to stop.
      var target = code - C_GILD, caps = R.pseudoMoves(n, this.cfg, true);
      from = -1;
      for (var i = 0; i < caps.length; i++) {
        if (caps[i].capSq !== target) continue;
        if (from >= 0 && caps[i].from !== from) return -1;
        from = caps[i].from;
      }
      p = from >= 0 ? n.board[from] : '';
      return p && p !== 'k' && p !== 'K' ? from : -1;
    }
    if (code <= 0 || code >= 200000000) return -1; // no move stored, or a drop, a storm, a swap or another free action
    from = Math.floor((code % 100000000) / 100000) - 1; p = from >= 0 ? n.board[from] : '';
    return p && p !== 'k' && p !== 'K' ? from : -1;
  };
  Search.prototype.apply = function (s, a) {
    if (a.m) return this.play(s, a.m, this.cfg);
    if (a.gild != null) return R.gild(s, a.gild, this.cfg);
    if (a.freeze != null) return R.freeze(s, a.freeze, this.cfg);
    if (a.convert != null) return R.convert(s, a.convert, this.cfg);
    return R.timeStop(s, this.cfg);
  };

  // Hand the turn over without moving (for the null move).
  function passTurn(s, cfg) {
    var n = {}, me = s.turn, foe = me === 'w' ? 'b' : 'w';
    for (var k in s) n[k] = s[k];
    n.turn = foe; n.ep = -1; n.fx = null; n.again = -1; n.dice = null;
    if (n.ice.length) n.ice = n.ice.filter(function (q) { return n.board[q] && R.colorOf(n.board[q]) !== me; });
    if (R.has(cfg, foe)) { n.movesLeft = R.powersOf(cfg, foe).double || 1; n.midasUsed = 0; n.freezeUsed = false; }
    else n.movesLeft = 0;
    return n;
  }
  // Three-dice chess: inside a turn only the moves the remaining dice allow.
  function diceOnly(moves, s, cfg) {
    if (!cfg.dice || !s.dice || s.again >= 0) return moves;
    if (!cfg.dice3) return moves.filter(function (m) { return s.dice.indexOf(R.dieOf(m)) >= 0; });
    // only what the dice allow, and only moves that keep as many dice usable as the best order would
    return R.diceMost(s, moves.filter(function (m) { return s.dice.indexOf(R.dieOf(m)) >= 0; }), cfg);
  }
  // A martyr's blast took a royal piece: the game is decided. Scored for the side to move.
  function blast(s, ply) {
    if (s.lost.length > 1) return 0;
    return s.lost === s.turn ? -MATE + ply : MATE - ply;
  }
  function hasPieces(s, c) {
    var b = s.board, set = c === 'w' ? 'NBRQ' : 'nbrq';
    for (var i = 0; i < b.length; i++) if (b[i] && set.indexOf(b[i]) >= 0 && s.gold.indexOf(i) < 0) return true;
    return false;
  }

  Search.prototype.order = function (moves, ttMove, ply) {
    var k1 = this.killers[ply * 2], k2 = this.killers[ply * 2 + 1], hist = this.hist, i, m, o, code;
    for (i = 0; i < moves.length; i++) {
      m = moves[i];
      code = m.code = codeOf(m);
      if (code === ttMove) o = 1e9;
      else if (m.cap) o = (R.isRoyal(m.cap) ? 5e8 : 1e6) + VAL[R.typeOf(m.cap)] * 16 - (m.snipe ? 0 : VAL[R.typeOf(m.piece)]); // king capture: taking the king first
      else if (m.promo) o = 9e5 + VAL[m.promo];
      else if (code === k1) o = 8e5;
      else if (code === k2) o = 7e5;
      else if (m.duck) o = m.dscore || 0;
      else o = m.from >= 0 && m.piece ? hist[PIDX[m.piece.charCodeAt(0)] * BN + m.to] : 0;
      m.order = o;
    }
    moves.sort(function (x, y) { return y.order - x.order; });
  };

  // Drawback Chess: has a side the search knows lost by its drawback here? Its colour, or ''.
  Search.prototype.dbLost = function (s) {
    var db = this.db;
    if (db.w && DBX.loses(s, 'w', db, true)) return 'w';
    if (db.b && DBX.loses(s, 'b', db, true)) return 'b';
    return '';
  };
  /* Drawback Chess: a drawback with a goal far ahead (a rook to the seventh by move 15, ...) gives the leaves a
     score for the progress towards it (hook score(ctx), in centipawns, for its owner), so the bot works towards
     it before the search can see the deadline. */
  Search.prototype.dbScore = function (s, me) {
    var db = this.db, v = 0, c, slot, d;
    for (var i = 0; i < 2; i++) {
      c = i ? 'b' : 'w'; slot = db[c]; d = slot && DBX.BY[slot.id];
      if (d && d.score) v += (c === me ? 1 : -1) * (d.score(DBX.ctxFor(s, c, slot, db, true)) || 0);
    }
    return v;
  };
  Search.prototype.quiesce = function (s, alpha, beta, ply, qd) {
    this.nodes++;
    if (s.lost) return blast(s, ply);
    if (s.kingless && R.wiped(s, s.turn)) return -MATE + ply; // no king and nothing left: lost
    if (this.db) { var dl = this.dbLost(s); if (dl) return dl === s.turn ? -MATE + ply : MATE - ply; }
    if (unrolled(s, this.cfg)) return chanceValue(s, this.cfg);
    var cfg = this.cfg, me = s.turn, stand = (me === 'w' ? 1 : -1) * evaluate(s, cfg) + (this.db ? this.dbScore(s, me) : 0);
    if (qd > 9 || this.timeUp()) return stand;
    var moves = diceOnly(R.pseudoMoves(s, cfg, true), s, cfg), foe = me === 'w' ? 'b' : 'w', king = me === 'w' ? 'K' : 'k', i, m, o;
    /* Checkers: a capture that is there has to be made (and a jump chain finished), so the side cannot simply
       stand: the exchanges are played out first. Without one a checkers side has only quiet moves, and the
       score stands. */
    var forced = s.checkers && moves.length > 0;
    if (s.checkers && !moves.length && !R.anyLegal(s, cfg)) return -MATE + ply; // nothing to move: lost
    var bestF = -MATE + ply; // with a forced capture the best of the captures counts, not the standing score
    if (!forced) {
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
    }
    if (this.db && this.db[me]) moves = DBX.filter(s, me, this.db, moves, true);
    for (i = 0; i < moves.length; i++) {
      m = moves[i];
      o = m.promo ? 800 + VAL[m.promo] : 0;
      if (m.cap) o += (R.isRoyal(m.cap) ? 1e7 : 0) + VAL[R.typeOf(m.cap)] * 16 - (m.snipe ? 0 : VAL[R.typeOf(m.piece)]);
      m.order = o;
    }
    moves.sort(function (x, y) { return y.order - x.order; });
    for (i = 0; i < moves.length; i++) {
      m = moves[i];
      if (!forced && !m.promo && !R.isRoyal(m.cap) && stand + VAL[R.typeOf(m.cap)] + 180 < alpha) continue; // cannot lift the score far enough
      var n = this.play(s, m, cfg), v;
      if (!R.royalAlive(n, me) || R.inCheck(n, me, cfg)) continue;
      if (n.turn === me) v = this.quiesce(n, alpha, beta, ply + 1, qd + 1);
      else v = -this.quiesce(n, -beta, -alpha, ply + 1, qd + 1);
      if (v >= beta) return v;
      if (v > bestF) bestF = v;
      if (v > alpha) alpha = v;
    }
    return forced ? bestF : alpha;
  };

  Search.prototype.store = function (a, c, depth, flag, v, code, ply) {
    if (this.db) return; // Drawback Chess keeps out of the table (see Search)
    var idx = a & TT_MASK;
    if (v > MATE - 1000) v += ply; else if (v < -MATE + 1000) v -= ply;
    var info = (depth << 2) | flag;
    tScore[idx] = v; tMove[idx] = code; tInfo[idx] = info; tLock[idx] = c ^ mix(v, code, info);
  };

  /* tp = turns since the root, canNull = a null move may be tried here. */
  Search.prototype.search = function (s, depth, alpha, beta, ply, tp, canNull) {
    var cfg = this.cfg, me = s.turn, foe = me === 'w' ? 'b' : 'w';
    if (s.lost) { this.nodes++; return blast(s, ply); }
    if (s.kingless && R.wiped(s, me)) { this.nodes++; return -MATE + ply; } // no king and nothing left: lost
    if (this.db) { var dl = this.dbLost(s); if (dl) { this.nodes++; return dl === me ? -MATE + ply : MATE - ply; } }
    if (unrolled(s, cfg)) { this.nodes++; return chanceValue(s, cfg); } // the next throw is not known to anyone
    var inChk = R.inCheck(s, me, cfg);
    if (inChk && ply < this.maxPly) depth = (depth < 0 ? 0 : depth) + 1; // never stop in a check
    if (depth <= 0) return this.quiesce(s, alpha, beta, ply, 0);
    this.nodes++;
    if (this.timeUp()) return 0;

    // A position the game has already seen: a third time is a draw, a second time is on the way there.
    var rep = 0;
    if (this.seen && ply <= 2) {
      // Dice Chess: the rolls are not part of the search, so the comparison leaves them out
      var sc = this.seen[s.dice ? R.posKey(Object.assign({}, s, { dice: null })) : R.posKey(s)];
      if (sc >= 2) return 0;
      if (sc === 1) rep = 1;
    }

    hashState(s, tp <= FREE_TURNS && this.free ? this.sig ^ 0x5bd1e995 : this.sig); // near the root the free actions are part of the node
    var ha = h1, hc = h2, idx = ha & TT_MASK, ttMove = 0;
    var tv = tScore[idx], tm = tMove[idx], info = tInfo[idx];
    if (!this.db && (tLock[idx] ^ mix(tv, tm, info)) === hc) {
      ttMove = tm;
      if ((info >> 2) >= depth && !rep) {
        var tf = info & 3;
        if (tv > MATE - 1000) tv -= ply; else if (tv < -MATE + 1000) tv += ply;
        if (tf === EXACT) return tv;
        if (tf === LOWER && tv >= beta) return tv;
        if (tf === UPPER && tv <= alpha) return tv;
      }
    }

    var v, n, i, stand = null;
    /* Pruning by the static score. Only where no free action can still turn things around (past the
       turns in which they are searched), outside of checks and multi-move turns, and with wider
       margins when the power-ups in play are of the wild kind. */
    var calm = !inChk && s.movesLeft <= 1 && beta - alpha === 1 && beta < MATE - 1000 && beta > -MATE + 1000 && !(this.hasFree && tp <= FREE_TURNS + 1);
    var wide = this.wild ? 2 : 1, skipQuiet = false;
    if (calm && depth <= 3) {
      stand = (me === 'w' ? 1 : -1) * evaluate(s, cfg);
      // far above beta already: the other side will not let it get here
      if (OPT.rfp && stand - 150 * depth * wide >= beta && hasPieces(s, me)) return stand;
      // far below alpha: quiet moves will not make up for it
      if (OPT.fut && depth <= 2 && stand + (130 + 190 * depth) * wide <= alpha) skipQuiet = true;
    }
    // Null move: if passing is already good enough, the real moves are too.
    if (canNull && !this.db && !s.checkers && !s.duckPhase && !inChk && depth >= 3 && s.movesLeft <= 1 && beta < MATE - 1000 && beta > -MATE + 1000) {
      if (stand === null) stand = (me === 'w' ? 1 : -1) * evaluate(s, cfg);
      if (stand >= beta && hasPieces(s, me)) {
        v = -this.search(passTurn(s, cfg), depth - (depth >= 6 ? 4 : 3), -beta, -beta + 1, ply + 1, tp + 1, false);
        if (this.stopped) return 0;
        if (v >= beta) return v > MATE - 1000 ? beta : v;
      }
    }

    var a0 = alpha, best = -INF, bestCode = 0, fa = null, gildMoves = 0, gildMove = R.has(cfg, me) && R.midasTurn(R.powersOf(cfg, me));
    if (this.free && tp <= FREE_TURNS && (depth >= 2 || (inChk && tp <= 1)) && R.has(cfg, me)) {
      fa = this.freeActions(s, tp, false, null);
      /* Midas costs nothing, so it goes first. It stays a choice though, never a reflex: a statue cannot
         be captured any more, and gilding the piece that gives check would wall the own king in. */
      for (i = 0; i < fa.length; i++) {
        if (fa[i].gild == null || (inChk && !gildMove)) continue;
        n = this.apply(s, fa[i]);
        if (!n) continue;
        if (n.turn !== me) { gildMoves++; v = -this.search(n, depth - 1, -beta, -alpha, ply + 1, tp + 1, true); } // Midas that uses the turn: a move like any other
        else v = this.search(n, depth, alpha, beta, ply + 1, tp, false);
        if (this.stopped) return 0;
        if (v > best) { best = v; bestCode = fa[i].code; }
        if (v > alpha) alpha = v;
        if (alpha >= beta) { this.store(ha, hc, depth, LOWER, best, bestCode, ply); return best; }
      }
    }

    var moves = diceOnly(R.pseudoMoves(s, cfg), s, cfg), king = me === 'w' ? 'K' : 'k', count = 0, m;
    if (s.duckPhase || (s.bducks && s.bducks.length)) moves = duckCut(s, cfg, moves, false);
    if (this.db && this.db[me]) { moves = DBX.filter(s, me, this.db, moves, true); if (!moves.length) return -MATE + ply; } // no move left by the drawback: lost
    var canFreeze = fa && R.powersOf(cfg, me).freeze && !s.freezeUsed;
    /* Freeze Ray, move by move. A freeze only matters through the reply it takes away, so after a move
       has been searched, the piece that made the best reply is frozen and the same move searched once
       more. That is one extra look per move instead of a whole second turn per candidate, and it always
       aims at the piece that matters. */
    var pairs = canFreeze, iced = null;
    this.order(moves, ttMove, ply);
    for (i = 0; i < moves.length; i++) {
      m = moves[i];
      n = this.play(s, m, cfg);
      if (!R.royalAlive(n, me) || R.inCheck(n, me, cfg)) continue; // leaves the own king (or general) in check, or loses it
      count++;
      var same = n.turn === me, nd = depth - 1, quiet = !m.cap && !m.promo;
      // hopeless quiet moves and the tail of the list are left out near the leaves, unless they give check
      if (quiet && count > 1 && !same && (skipQuiet || (OPT.lmp && calm && depth <= 2 && count > 7 + 7 * depth)) && best > -MATE + 1000 && !R.inCheck(n, foe, cfg)) continue;
      var sd = nd; // the depth the move was last searched to
      if (count === 1) {
        v = same ? this.search(n, nd, alpha, beta, ply + 1, tp, false) : -this.search(n, nd, -beta, -alpha, ply + 1, tp + 1, true);
      } else {
        // later quiet moves get a shallower look first, and a full one only if they surprise
        var red = 0;
        if (quiet && !inChk && depth >= 3 && count > 3) {
          red = OPT.lmr ? Math.floor(0.55 + Math.log(depth) * Math.log(count) / 2.5) : (count > 12 && depth >= 5 ? 2 : 1);
          if (m.code === this.killers[ply * 2] || m.code === this.killers[ply * 2 + 1]) red--;
          if (red > nd - 1) red = nd - 1;
          if (red < 0) red = 0;
        }
        sd = nd - red;
        v = same ? this.search(n, sd, alpha, alpha + 1, ply + 1, tp, false) : -this.search(n, sd, -alpha - 1, -alpha, ply + 1, tp + 1, true);
        if (!this.stopped && v > alpha && (red || v < beta)) {
          sd = nd;
          v = same ? this.search(n, nd, alpha, beta, ply + 1, tp, false) : -this.search(n, nd, -beta, -alpha, ply + 1, tp + 1, true);
        }
      }
      if (this.stopped) return 0;
      if (pairs && !same && v < beta) {
        var pq = this.refuter(n, tp + 1);
        if (pq >= 0 && s.board[pq] === n.board[pq]) {
          if (!iced) iced = {};
          var sf = iced[pq];
          if (sf === undefined) sf = iced[pq] = R.freeze(s, pq, cfg);
          if (sf) {
            // it has to beat both what stands and the move without the freeze
            var n2 = this.play(sf, m, cfg), a2 = v > alpha ? v : alpha;
            var v2 = -this.search(n2, sd, -a2 - 1, -a2, ply + 1, tp + 1, true);
            if (!this.stopped && v2 > a2 && (sd < nd || v2 < beta)) v2 = -this.search(n2, nd, -beta, -a2, ply + 1, tp + 1, true);
            if (this.stopped) return 0;
            if (v2 > v) v = v2;
          }
        }
      }
      if (v > best) { best = v; bestCode = m.code; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (quiet) {
          var kp = ply * 2;
          if (kp < 254 && this.killers[kp] !== m.code) { this.killers[kp + 1] = this.killers[kp]; this.killers[kp] = m.code; }
          if (m.from >= 0 && m.piece) this.hist[PIDX[m.piece.charCodeAt(0)] * BN + m.to] += depth * depth;
        }
        break;
      }
    }
    if (!count && !gildMoves) return inChk || this.db || s.checkers ? -MATE + ply : 0; // checkers: who cannot move has lost

    // the other free actions have to beat what the moves alone achieve
    if (fa && alpha < beta) {
      for (i = 0; i < fa.length; i++) {
        if (fa[i].gild != null) continue;
        n = this.apply(s, fa[i]);
        if (!n) continue;
        /* A free action opens a whole second look at the same turn, which is what makes these games
           expensive. So it gets a shallower first look, the shallower the further from the root, and
           the full one only if that first look says it beats the moves. */
        var fd = depth;
        if (OPT.fred) { fd = depth - 1 - (tp > 2 ? 2 : tp); if (fd < 1) fd = 1; }
        v = this.search(n, fd, alpha, alpha + 1, ply + 1, tp, false);
        if (!this.stopped && v > alpha && (v < beta || fd < depth)) v = this.search(n, depth, alpha, beta, ply + 1, tp, false);
        if (this.stopped) return 0;
        if (v > best) { best = v; bestCode = fa[i].code; }
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
    }

    if (rep) {
      // repeating is only attractive for the side that is worse off
      var rs = me === this.rootTurn ? 1 : -1;
      return best * rs > 0 ? Math.round(best / 2) : best;
    }
    this.store(ha, hc, depth, best <= a0 ? UPPER : best >= beta ? LOWER : EXACT, best, bestCode, ply);
    return best;
  };

  /* Think about a position. Returns every root action with a score from the mover's
     point of view, best first. Free actions are scored as "do this, then go on with the
     turn" and stand before a move with the same score: they cost nothing.
     Move scores are exact within `margin` of the best move and upper bounds below that.
     A free action's score is exact when it matches or beats the best move.
     opts = { ms, maxDepth, margin, banned: [keys], allow: [keys] or null, free, seen: { posKey: count } } */
  function think(state, cfg, opts) {
    opts = opts || {};
    useGeo(state);
    if (unrolled(state, cfg)) return thinkRoll(state, cfg, opts); // before the throw: what it is worth on average
    var S = new Search(cfg, opts), margin = opts.margin == null ? 40 : opts.margin;
    S.rootTurn = state.turn;
    var legal = R.legalMoves(state, cfg), i;
    if (state.duckPhase || (state.bducks && state.bducks.length)) legal = duckCut(state, cfg, legal, true);
    if (S.db && S.db[state.turn] && !opts.allow) legal = DBX.filter(state, state.turn, S.db, legal, false);
    var moves = legal.map(function (m) { return { m: m, key: moveKey(m), v: 0 }; });
    if (opts.allow) moves = moves.filter(function (a) { return opts.allow.indexOf(a.key) >= 0; });
    var banned = opts.banned && opts.banned.length ? opts.banned : null;
    if (banned) moves = moves.filter(function (a) { return banned.indexOf(a.key) < 0; });
    var frees = S.rootFree && moves.length && R.has(cfg, state.turn) ? S.freeActions(state, 0, true, legal) : [];
    if (banned) frees = frees.filter(function (a) { return banned.indexOf(a.key) < 0; });
    frees.forEach(function (a) { a.v = 0; });
    S.order(moves.map(function (a) { return a.m; }), 0, 0);
    moves.sort(function (x, y) { return y.m.order - x.m.order; });
    // Freeze Ray at the root works like in the tree: every move is tried once more with its refuter frozen.
    var pairRoot = S.rootFree && !!R.powersOf(cfg, state.turn).freeze && !state.freezeUsed;
    var pairMap = {}, pairList = [], rootIced = {};
    var pack = function () {
      return frees.concat(pairList, moves).map(function (a) { return { key: a.key, score: Math.round(a.v) }; }).sort(function (x, y) { return y.score - x.score; });
    };
    var result = { depth: 0, nodes: 0, score: 0, actions: pack(), trail: [] };
    if (!moves.length || (S.gen !== null && tCtl[0] !== S.gen)) return result; // nothing to do, or called off before it began
    var maxDepth = opts.maxDepth || 64;
    /* A helper searches the same position in another worker at the same time. It shares the hash table
       and nothing else, and looks one or two steps deeper than the main search so that its entries are
       of use there. Its own result is thrown away. */
    var ahead = opts.helper ? 1 + (opts.helper % 2) : 0;
    for (var depth = 1 + ahead; depth <= maxDepth + ahead; depth++) {
      S.maxPly = depth * 2 + 6;
      var best = -INF, n, v, pairBest = -INF, pk;
      for (pk in pairMap) { pairMap[pk].nv = -INF; pairMap[pk].mv = -INF; }
      for (i = 0; i < moves.length; i++) {
        n = S.play(state, moves[i].m, cfg);
        var alpha = best === -INF ? -INF : best - margin - 1;
        if (n.turn === state.turn) v = S.search(n, depth - 1, alpha, INF, 1, 0, false);
        else v = -S.search(n, depth - 1, -INF, -alpha, 1, 1, true);
        if (S.stopped) break;
        moves[i].nv = v;
        if (v > best) best = v;
        if (pairRoot && n.turn !== state.turn && depth >= 2) {
          var pq = S.refuter(n, 1);
          if (pq < 0 || state.board[pq] !== n.board[pq] || (banned && banned.indexOf('f' + pq) >= 0)) continue;
          var sf = rootIced[pq];
          if (sf === undefined) sf = rootIced[pq] = R.freeze(state, pq, cfg);
          if (!sf) continue;
          var n2 = S.play(sf, moves[i].m, cfg), ptop = pairBest > best ? pairBest : best, lo = ptop - margin - 1, v2;
          if (v <= lo) {
            // a first look with a narrow window: most of the time the freeze does not lift the move far enough
            v2 = -S.search(n2, depth - 1, -lo - 1, -lo, 1, 1, true);
            if (!S.stopped && v2 > lo) v2 = -S.search(n2, depth - 1, -INF, -lo, 1, 1, true);
          } else v2 = -S.search(n2, depth - 1, -INF, -lo, 1, 1, true);
          if (S.stopped) break;
          var pe = pairMap[pq] || (pairMap[pq] = { freeze: pq, key: 'f' + pq, code: C_FREEZE + pq, v: -INF, nv: -INF, mv: -INF });
          if (v2 > pe.nv) pe.nv = v2;
          if (v > pe.mv) pe.mv = v; // the move it goes with, to tell equal freezes apart
          if (v2 > pairBest) pairBest = v2;
        }
      }
      if (S.stopped) break;
      // the bar a free action has to clear: the best move, and then the best free action so far
      var bar = best > pairBest ? best : pairBest;
      for (i = 0; i < frees.length; i++) {
        n = S.apply(state, frees[i]);
        if (!n) { frees[i].nv = -INF; continue; }
        var lo = OPT.bar && bar > best ? bar - margin - 1 : best - 1;
        /* Each free action is a search of its own, and most of them lose to the best move. So unless it
           led the last round, it gets a shallower look first and the full one only when that look says
           it matches the best move. */
        var rd = OPT.fred && depth >= 4 && !(frees[i].v > -INF && frees[i].v >= moves[0].v) ? depth - (depth >= 6 ? 2 : 1) : depth;
        if (n.turn !== state.turn) v = -S.search(n, depth - 1, -INF, -lo, 1, 1, true); // Midas that uses the turn
        else if (rd < depth) {
          v = S.search(n, rd, lo, lo + 1, 1, 0, false);
          if (!S.stopped && v > lo) v = S.search(n, depth, lo, INF, 1, 0, false);
        } else v = S.search(n, depth, lo, INF, 1, 0, false);
        if (S.stopped) break;
        frees[i].nv = v;
        if (v > bar) bar = v;
      }
      if (S.stopped) break;
      // keep this finished iteration, best first, so the next one searches in a good order
      moves.forEach(function (a) { a.v = a.nv; });
      frees.forEach(function (a) { a.v = a.nv; });
      pairList = [];
      for (pk in pairMap) if (pairMap[pk].nv > -INF) { pairMap[pk].v = pairMap[pk].nv; pairList.push(pairMap[pk]); }
      pairList.sort(function (x, y) { return y.v - x.v || y.mv - x.mv; });
      moves.sort(function (x, y) { return y.v - x.v; });
      frees.sort(function (x, y) { return y.v - x.v; });
      result.depth = depth;
      result.actions = pack();
      result.score = result.actions[0].score;
      result.trail.push(result.score); // the best score of every finished depth, for the eval bar
      var top = result.score; // free actions included: a lost-looking move list can still be saved by one
      // a mate seen at a very shallow depth has not met the other side's free actions yet
      /* A mate stops the search once the depth reaches it: a mate score that comes out of the hash table at a low
         depth is only a bound from an earlier search, and playing on it can walk in circles (a king ending in
         Checkers did exactly that). */
      if (((top > MATE - 100 || top < -MATE + 100) && depth >= Math.max(3, MATE - Math.abs(top))) || (moves.length === 1 && !frees.length)) break;
    }
    result.nodes = S.nodes;
    return result;
  }

  var api = { think: think, evaluate: evaluate, moveKey: moveKey, MATE: MATE, makeTable: makeTable, useTable: useTable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Brain = api;

  // Worker mode: { id, state, cfg, opts } in, { id, result } out.
  if (typeof importScripts === 'function' && typeof root.document === 'undefined') {
    root.onmessage = function (e) {
      var d = e.data, out;
      if (d.table) { useTable(d.table); return; } // the shared hash table, handed over once at start
      // Hexagonal Chess has its own engine (js/hex.js), loaded in the same worker
      try { out = d.cfg && d.cfg.hex ? root.Hex.think(d.state, d.opts || {}) : think(d.state, d.cfg, d.opts); } catch (err) { out = { error: String(err && err.message || err), actions: [] }; }
      root.postMessage({ id: d.id, result: out });
    };
  }
})(typeof self !== 'undefined' ? self : this);
