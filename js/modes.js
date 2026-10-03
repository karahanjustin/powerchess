/* Game modes: the logic without any page code, so it runs in node too (tools/tests/modes_*.js).

   Dice Chess Arena: three-dice chess on the normal board against a bot, with a bet. Each tier costs credits
   to enter and pays back twice that on a win (the stake comes back on a draw). The free tier costs nothing
   and pays 1, so nobody ever runs out. A stronger tier means a stronger bot.

   Ouroboros Run: a roguelike run under The Ouroboros King's rules (king capture). You start with a king, a
   pawn and three units drawn at random, and fight stage after stage against a growing army and a bot whose
   level climbs with some chance in it. After each win you pick one of three rewards: a new unit, or now and
   then the evolution of one of your pieces. The layout can be changed before every stage is revealed. A loss
   ends the run, a draw replays the stage. The longest run is kept.

   Everything random in a run comes from the run's own generator, whose state is saved, so reloading the page
   cannot reroll a stage or a reward. The whole state is one plain object (see fresh()). */
(function (root) {
  'use strict';
  var R = root.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);
  var B = root.Brain || (typeof require !== 'undefined' ? require('./brain.js') : null); // rates a dealt stage
  var VERSION = 1;

  /* ---------- random numbers ---------- */
  // mulberry32: small, fast, and its whole state is one number that can be saved
  function rng(state) {
    var st = { s: state >>> 0 };
    st.next = function () {
      st.s = (st.s + 0x6D2B79F5) >>> 0;
      var t = st.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    st.int = function (n) { return Math.floor(st.next() * n); };
    st.pick = function (a) { return a[st.int(a.length)]; };
    return st;
  }
  function newSeed() { return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0; }

  /* ---------- the saved state ---------- */
  var START_CREDITS = 10;
  function fresh() {
    return {
      v: VERSION, rev: 0, updated: 0,
      dice: { credits: START_CREDITS, best: START_CREDITS, played: 0, won: 0, lost: 0, drawn: 0, earned: 0, tiers: {} },
      run: null,
      runs: { count: 0, best: 0, bestDate: 0, bestArmy: null, history: [] },
      // Drawback Chess: your games against the bots, in all and per drawback you had ({ id: { w, l, d } })
      drawback: { played: 0, won: 0, lost: 0, drawn: 0, per: {} },
      hex: { played: 0, won: 0, lost: 0, drawn: 0 }, // Hexagonal Chess against the bots
      // Shotgun King: runs, how far each rank got (best floor), the highest rank open, the run in progress (shotgun.js)
      sk: { runs: 0, won: 0, best: {}, wins: {}, maxRank: 1, kills: 0, run: null },
      pending: null // a mode game in progress: { id, kind, spec, actions, tier | stage, started }
    };
  }
  // Older or damaged saves are filled up with the defaults, never thrown away.
  function migrate(o) {
    var f = fresh();
    if (!o || typeof o !== 'object') return f;
    var out = Object.assign(f, o);
    out.dice = Object.assign(fresh().dice, o.dice || {});
    out.runs = Object.assign(fresh().runs, o.runs || {});
    out.drawback = Object.assign(fresh().drawback, o.drawback || {});
    out.hex = Object.assign(fresh().hex, o.hex || {});
    out.sk = Object.assign(fresh().sk, o.sk || {});
    if (!out.drawback.per || typeof out.drawback.per !== 'object') out.drawback.per = {};
    if (!Array.isArray(out.runs.history)) out.runs.history = [];
    if (typeof out.dice.credits !== 'number' || !isFinite(out.dice.credits) || out.dice.credits < 0) out.dice.credits = 0;
    if (out.run && (!Array.isArray(out.run.army) || !out.run.army.some(function (x) { return R.isRoyal(x[1]); }))) out.run = null;
    if (out.run && out.run.edit && out.run.edit.kind === 'arrange') out.run.edit = null;
    out.v = VERSION;
    return out;
  }
  // A Drawback Chess game you played: res 'w', 'l' or 'd' from your side, id = the drawback you had.
  function settleDrawback(M, id, res) {
    var d = M.drawback, p = d.per[id] = d.per[id] || { w: 0, l: 0, d: 0 };
    d.played++;
    if (res === 'w') { d.won++; p.w++; } else if (res === 'l') { d.lost++; p.l++; } else { d.drawn++; p.d++; }
  }
  // Two copies (browser storage and the file the server keeps): the one saved last wins.
  function newer(a, b) {
    if (!a) return b; if (!b) return a;
    if ((a.rev || 0) !== (b.rev || 0)) return (a.rev || 0) > (b.rev || 0) ? a : b;
    return (a.updated || 0) >= (b.updated || 0) ? a : b;
  }

  /* ---------- Dice Chess Arena ---------- */
  /* The tables (leagues). Each costs five times the one below, so it takes about four wins more than losses at
     one table to afford the next one, and the top table takes 2.500.000. A win pays twice the entry. */
  var DICE_TIERS = [
    { id: 'free', name: 'Free', cost: 0, win: 1, bot: 'b1' },
    { id: 'l10', name: 'Copper', cost: 10, win: 20, bot: 'b2' },
    { id: 'l50', name: 'Bronze', cost: 50, win: 100, bot: 'b3' },
    { id: 'l250', name: 'Silver', cost: 250, win: 500, bot: 'b4' },
    { id: 'l1k', name: 'Gold', cost: 1000, win: 2000, bot: 'b5' },
    { id: 'l5k', name: 'Platinum', cost: 5000, win: 10000, bot: 'b6' },
    { id: 'l25k', name: 'Diamond', cost: 25000, win: 50000, bot: 'b7' },
    { id: 'l100k', name: 'Ruby', cost: 100000, win: 200000, bot: 'b8' },
    { id: 'l500k', name: 'Emerald', cost: 500000, win: 1000000, bot: 'b9' },
    { id: 'l2500k', name: 'Legend', cost: 2500000, win: 5000000, bot: 'max' }
  ];
  // the tables before the gaps were widened: an unfinished game at one of them still settles as it was bet
  var OLD_TIERS = [
    { id: 't5', name: 'Copper', cost: 5, win: 10, bot: 'b2' }, { id: 't10', name: 'Bronze', cost: 10, win: 20, bot: 'b3' },
    { id: 't25', name: 'Silver', cost: 25, win: 50, bot: 'b4' }, { id: 't50', name: 'Gold', cost: 50, win: 100, bot: 'b5' },
    { id: 't100', name: 'Platinum', cost: 100, win: 200, bot: 'b6' }, { id: 't250', name: 'Diamond', cost: 250, win: 500, bot: 'b7' },
    { id: 't500', name: 'Ruby', cost: 500, win: 1000, bot: 'b8' }, { id: 't1000', name: 'Emerald', cost: 1000, win: 2000, bot: 'b9' },
    { id: 't2500', name: 'Legend', cost: 2500, win: 5000, bot: 'max' }
  ];
  function tier(id) {
    var all = DICE_TIERS.concat(OLD_TIERS);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function canBet(M, id) { return DICE_TIERS.some(function (t) { return t.id === id; }) && !M.pending && M.dice.credits >= tier(id).cost; }
  // The stake is paid when the game starts, so leaving a lost game cannot save it.
  function placeBet(M, id) {
    var t = tier(id);
    if (!canBet(M, id)) return false;
    M.dice.credits -= t.cost;
    return true;
  }
  // res: 'w', 'd' or 'l' from the player's side. Returns the credits paid out.
  function settleDice(M, id, res) {
    var t = tier(id), d = M.dice, pay = res === 'w' ? t.win : res === 'd' ? t.cost : 0;
    d.credits += pay;
    d.played++;
    if (res === 'w') d.won++; else if (res === 'd') d.drawn++; else d.lost++;
    d.earned += pay - t.cost;
    if (d.credits > d.best) d.best = d.credits;
    var rec = d.tiers[id] = d.tiers[id] || { w: 0, d: 0, l: 0 };
    rec[res]++;
    return pay;
  }

  /* ---------- Ouroboros Run ---------- */
  // squares by name on the 8 x 8 board
  var FILES = 'abcdefgh';
  function sq(n) { return (8 - parseInt(n[1], 10)) * 8 + FILES.indexOf(n[0]); }
  function sqName(i) { return FILES[i % 8] + (8 - Math.floor(i / 8)); }
  var HOME = []; // the player's two home ranks
  // pieces that may never stand on their own first rank: the pawn, the marching pawn, the quartermaster
  var PAWNISH = { 'p': 1, 'д': 1, 'ы': 1 };
  for (var hq = 48; hq < 64; hq++) HOME.push(hq);
  var START_ARMY = [['b1', 'N'], ['e1', 'K'], ['f1', 'B'], ['h1', 'R']]; // how a run of the game starts

  var STD_VALUE = { p: 100, n: 300, b: 320, r: 500, q: 900, k: 0 };
  function value(l) {
    var t = l.toLowerCase();
    if (STD_VALUE[t] != null) return STD_VALUE[t];
    var d = R.fairyOf(l);
    return d ? (d.royal ? 0 : d.value || 0) : 0;
  }
  function armyValue(army) { return army.reduce(function (a, x) { return a + value(x[1]); }, 0); }
  function title(l) {
    var t = l.toLowerCase(), STD = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
    return STD[t] || (R.fairyOf(l) ? R.fairyOf(l).name : l);
  }

  /* The units as The Ouroboros King sorts them (fandom wiki, Units page). Tier 1 can be taken at the start of a run,
     tier 2 too but only one of them, tier 3 never at the start. Evolved units (Upgrades) are never recruited: they
     come only from upgrading their base unit. Letters are the black (lower case) ones; the player's are upper case. */
  var TIERS = [
    ['ο', 'b', 'n', 'o', 'з', 's', 'ρ', 'τ', 'υ', 'φ', 'χ', 'б', 'в', 'π', 'г', 'д', 'ξ', 'ж', 'и'],
    ['r', 'x', 'v', 'л', 'п', 'ф', 'μ', 'ц', 'y'],
    ['q', 'ђ', 'ћ', 'ч', 'ш', 'α', 'β', 'ъ']
  ];
  // the evolved units: what they evolve from (the game's Armory)
  var EVOLVES = { 'э': 'k', 'θ': 'b', 'κ': 'n', 'ι': 'r', 'ν': 'o', 'щ': 'з', 't': 's', 'λ': 'ρ', 'ε': 'τ', 'ζ': 'υ', 'η': 'ζ', 'ψ': 'χ', 'ω': 'φ', 'ы': 'д', 'й': 'и', 'γ': 'α', 'δ': 'β' };
  // the enemy may field anything, evolved units too: by strength
  var POOL = [
    ['д', 's', 'ζ', 'η', 'ρ', 'τ', 'y', 'б', 'щ', 'з', 'ы', 'n', 'b', 'ж', 'ч'],
    ['o', 't', 'θ', 'α', 'β', 'ε', 'κ', 'λ', 'μ', 'ξ', 'ο', 'π', 'г', 'л', 'п', 'ф', 'r', 'φ', 'χ', 'ψ', 'в'],
    ['v', 'x', 'γ', 'δ', 'ι', 'ν', 'ц', 'ш', 'ъ', 'ђ', 'ћ', 'ω', 'и', 'й', 'q']
  ];
  var BOSSES = [['я', 'Tabitha the Deceptive'], ['ь', 'Andromeda of the Stars'], ['ё', 'Edea, the Witch Queen']];
  /* The enemy's units by the game's tiers: a base unit has its own tier, an evolved one the tier above its base
     (at most 3). The first two stages field tier 1 only (and nothing dearer than a bishop and a half). */
  function enemyTier(l) {
    for (var t = 0; t < TIERS.length; t++) if (TIERS[t].indexOf(l) >= 0) return t;
    return EVOLVES[l] ? Math.min(2, enemyTier(EVOLVES[l]) + 1) : 1;
  }
  var ENEMY = [[], [], []];
  POOL.forEach(function (list) { list.forEach(function (l) { ENEMY[enemyTier(l)].push(l); }); });
  // How likely each tier is at a stage: weak units early, strong ones later.
  function poolWeights(stage) {
    if (stage <= 2) return [1, 0, 0];
    if (stage <= 4) return [0.75, 0.25, 0];
    if (stage <= 7) return [0.5, 0.4, 0.1];
    if (stage <= 11) return [0.3, 0.45, 0.25];
    return [0.2, 0.4, 0.4];
  }
  function drawUnit(r, stage, maxValue) {
    var w = poolWeights(stage), cheap = stage <= 2 ? 480 : Infinity;
    if (maxValue == null || maxValue > cheap) maxValue = cheap;
    for (var tries = 0; tries < 30; tries++) {
      var x = r.next(), k = x < w[0] ? 0 : x < w[0] + w[1] ? 1 : 2;
      var l = r.pick(ENEMY[k]);
      if (value(l) <= maxValue) return l;
    }
    return r.pick(ENEMY[0].filter(function (l) { return value(l) <= 480; }));
  }

  // Upgrades: the evolution lines of the game, base unit to its evolved form. Keys and values are lower case.
  var UPGRADES = {};
  Object.keys(EVOLVES).forEach(function (to) { var from = EVOLVES[to]; (UPGRADES[from] = UPGRADES[from] || []).push(to); });
  function upgradesOf(l) {
    var lo = l.toLowerCase(), up = UPGRADES[lo] || [], white = l !== lo;
    return up.map(function (u) { return white ? u.toUpperCase() : u; });
  }

  /* The bot of a stage: its level climbs about one every two stages, give or take one. Level 0 is the Beginner
     (100), level 1 the Rookie (400), up to level 9, the Machine. The first stage sends 100 to 400. */
  function botFor(stage, r) {
    var lv = Math.round(0.45 * (stage - 1) + (r.next() * 2 - 1));
    return 'b' + Math.max(0, Math.min(9, lv));
  }
  /* The army a stage sends: below the player's strength at first, closing in slowly (the bot's level rises too),
     never more than the player's own army, plus a floor that rises gently, minus a pawn and a half. */
  function budgetFor(stage, army) {
    var floor = 600 + 120 * (stage - 1);
    // and every stage a pawn and a half lighter than that (user's call), never below three pawns
    return Math.max(300, Math.max(floor, Math.round(armyValue(army) * Math.min(1, 0.7 + 0.025 * (stage - 1)))) - 150);
  }
  function cfgFor(terrain) { return { side: 'w', pw: { w: null, b: null }, freeArmy: true, kingCapture: true, terrain: terrain }; }
  function boardOf(army, black) {
    var b = new Array(64).fill('');
    army.forEach(function (x) { b[sq(x[0])] = x[1]; });
    black.forEach(function (x) { b[sq(x[0])] = x[1]; });
    return b;
  }
  function fenOf(army, black) { return R.boardFen(boardOf(army, black), 8) + ' w - - 0 1'; }
  // Could either side take a royal piece on the very first move? Then the stage is not dealt that way.
  function hotStart(fen, terrain) {
    var cfg = cfgFor(terrain);
    for (var t = 0; t < 2; t++) {
      var s = R.fromFen(fen.replace(' w ', t ? ' b ' : ' w '), cfg);
      if (R.legalMoves(s, cfg).some(function (m) { return m.cap && R.isRoyal(m.cap); })) return true;
    }
    return false;
  }
  // How the start looks for the player (White, to move), in hundredths of a pawn: a short search.
  function rate(fen, terrain) {
    if (!B) return 0;
    var cfg = cfgFor(terrain), s = R.fromFen(fen, cfg);
    // a fixed depth, not a time limit: the same seed must deal the same stage on a busy machine too
    var res = B.think(s, cfg, { ms: 5000, maxDepth: 3, margin: 0, free: true });
    return res && isFinite(res.score) ? res.score : 0;
  }
  // Terrain in the four middle ranks, the same seen from both sides.
  function terrainFor(stage, r) {
    if (stage < 3 || r.next() > 0.45) return null;
    var t = { walls: [], water: [], portals: [] }, used = {};
    var pairs = 1 + r.int(3), kind = r.next() < 0.5 ? 'water' : 'walls';
    for (var i = 0; i < pairs; i++) {
      var q = 16 + 8 + r.int(16), mirror = 63 - q; // ranks 4 to 5 and their point mirror
      if (used[q] || used[mirror]) continue;
      used[q] = used[mirror] = true;
      t[r.next() < 0.7 ? kind : (kind === 'water' ? 'walls' : 'water')].push(sqName(q), sqName(mirror));
    }
    if (r.next() < 0.2) {
      var p = 24 + r.int(8), pm = 63 - p;
      if (!used[p] && !used[pm]) t.portals = [sqName(p), sqName(pm)];
    }
    return t;
  }
  function terrainIdx(t) { return t ? { walls: t.walls.map(sq), water: t.water.map(sq), portals: t.portals.map(sq) } : null; }

  /* A stage: the black army, the terrain and the bot. Dealt from the run's generator. A layout that would
     allow a capture on the first move, or that the rules refuse, is dealt again. */
  function genStage(run) {
    var r = rng(run.rng), stage = run.stage, boss = stage % 5 === 0 ? BOSSES[Math.min(BOSSES.length - 1, Math.floor(stage / 5) - 1)] : null;
    var budget = budgetFor(stage, run.army), terrain = terrainFor(stage, r), tIdx = terrainIdx(terrain);
    var king = stage >= 8 && r.next() < 0.3 ? r.pick(['э', 'ю']) : 'k';
    var units = [];
    if (boss) { units.push(boss[0]); budget -= value(boss[0]); }
    var cap = Math.min(15, 2 + Math.ceil(stage * 0.9));
    while (budget > 120 && units.length < cap) {
      var l = drawUnit(r, stage, budget + 150);
      units.push(l); budget -= value(l);
    }
    if (!units.length) units.push('s');
    /* Layouts are dealt until one is fair: no royal piece in reach on move one, and a short search finds no
       side clearly ahead (within 2.5 pawns). Up to eight are rated; the most even one is kept. */
    var black = null, fen = '', rated = 0, bestBlack = null, bestScore = Infinity;
    for (var tries = 0; tries < 80 && !black && rated < 8; tries++) {
      // the king on the back rank (now and then in a corner), the rest on the two back ranks, pawns in front
      var free = [], i, out = [];
      for (i = 0; i < 16; i++) if (!tIdx || (tIdx.walls.indexOf(i) < 0)) free.push(i);
      var kq = r.next() < 0.25 ? r.pick([0, 7]) : 1 + r.int(6);
      out.push([sqName(kq), king]);
      free.splice(free.indexOf(kq), 1);
      var order = units.slice().sort(function (a, b) { return (PAWNISH[a] ? 1 : 0) - (PAWNISH[b] ? 1 : 0); });
      for (i = 0; i < order.length && free.length; i++) {
        var pawnish = !!PAWNISH[order[i]], opts = free.filter(function (q) { return pawnish ? q >= 8 : true; });
        if (!opts.length) opts = free;
        var q = r.pick(opts);
        free.splice(free.indexOf(q), 1);
        out.push([sqName(q), order[i]]);
      }
      fen = fenOf(run.army, out);
      var cfg = cfgFor(tIdx), s;
      try { s = R.fromFen(fen, cfg); } catch (e) { continue; }
      if (R.validate(s, cfg).length || hotStart(fen, tIdx)) { if (tries % 15 === 14 && units.length > 1) units.pop(); continue; }
      var sc = Math.abs(rate(fen, tIdx));
      rated++;
      if (sc < bestScore) { bestScore = sc; bestBlack = out; }
      if (sc <= 250) black = out;
    }
    if (!black) black = bestBlack;
    if (!black) { black = [['e8', king]]; units = []; } // nothing fits at all: only seen with a board too full to deal
    var lead = units.slice().sort(function (a, b) { return value(b) - value(a); })[0];
    run.rng = r.s;
    return {
      stage: stage, black: black, terrain: terrain, bot: botFor(stage, rng(run.rng ^ 0x9e3779b9)), boss: boss ? boss[1] : '',
      title: boss ? 'Boss: ' + boss[1] : (lead ? 'Led by ' + (/^[AEIO]/.test(title(lead)) ? 'an ' : 'a ') + title(lead) : 'A small band'),
      value: armyValue(black)
    };
  }
  /* The three units a run starts with, besides the king: any from tier 1, at most one from tier 2 (the game's rule).
     They stand where the knight, bishop and rook of the first run stand; the layout can be changed before every fight. */
  function startOk(units) {
    if (!Array.isArray(units) || units.length !== 3) return false;
    var t2 = 0;
    for (var i = 0; i < 3; i++) {
      var l = String(units[i]).toLowerCase();
      if (TIERS[0].indexOf(l) >= 0) continue;
      if (TIERS[1].indexOf(l) >= 0) { t2++; continue; }
      return false;
    }
    return t2 <= 1;
  }
  // The start: the king with a pawn in front of it, and the three units on b1, f1 and h1 (a pawn-like one a rank up).
  function startArmy(units) {
    if (!startOk(units)) units = ['n', 'b', 'r'];
    var at = ['b', 'f', 'h'];
    return [['e1', 'K'], ['e2', 'P']].concat(units.map(function (l, i) { return [at[i] + (PAWNISH[l] ? '2' : '1'), String(l).toUpperCase()]; }));
  }
  // The three units are drawn, never chosen: any of tier 1, and with some luck one of tier 2.
  function drawStart(r) {
    var out = [];
    while (out.length < 3) {
      var l = r.pick(TIERS[0]);
      if (out.indexOf(l) < 0) out.push(l);
    }
    if (r.next() < 0.35) out[r.int(3)] = r.pick(TIERS[1]);
    return out;
  }
  function newRun(M, seed, units) {
    var r0 = rng((seed ^ 0x51ed27) >>> 0);
    var run = { seed: seed >>> 0, rng: seed >>> 0, stage: 1, cleared: 0, army: startArmy(startOk(units) ? units : drawStart(r0)), next: null, reward: null, edit: null, started: Date.now() };
    // the first stage stays hidden until the army is set up: see reveal()
    M.run = run;
    M.runs.count++;
    return run;
  }
  function stageFen(run) { return fenOf(run.army, run.next.black); }

  /* After a win: three kinds of reward to pick one from. Recruits are drawn for the stage just cleared; the
     upgrades come from the army's own pieces. Dealt once and saved, so a reload shows the same offer. */
  // A recruit: a base unit, from tier 1 early on and from the higher tiers as the run goes deeper.
  function drawRecruit(r, stage) {
    var w = stage <= 3 ? [0.75, 0.25, 0] : stage <= 7 ? [0.45, 0.4, 0.15] : [0.25, 0.4, 0.35];
    var x = r.next(), k = x < w[0] ? 0 : x < w[0] + w[1] ? 1 : 2;
    return r.pick(TIERS[k]);
  }
  /* After a win: three offers, pick one. Each offer is a new unit, or (as one of the possibilities, in place of a
     unit) the evolution of a piece already in the army. Dealt once and saved, so a reload shows the same offer. */
  function dealReward(run) {
    var r = rng(run.rng), offers = [], seenUnit = {}, seenUp = {}, full = run.army.length >= HOME.length;
    var ups = [];
    run.army.forEach(function (x) { upgradesOf(x[1]).forEach(function (u) { ups.push({ kind: 'up', sq: x[0], from: x[1], to: u }); }); });
    for (var i = 0; i < 40 && offers.length < 3; i++) {
      var wantUp = ups.length && (full || r.next() < 0.3);
      if (wantUp) {
        var u = ups[r.int(ups.length)], key = u.sq + u.to;
        if (!seenUp[key]) { seenUp[key] = true; offers.push(u); }
        if (Object.keys(seenUp).length >= ups.length && full) break;
      } else if (!full) {
        var l = drawRecruit(r, run.stage).toUpperCase();
        if (!freeHome(run, l).length) continue; // a pawn-like unit with only first-rank squares left
        if (!seenUnit[l]) { seenUnit[l] = true; offers.push({ kind: 'unit', l: l }); }
      } else break;
    }
    run.rng = r.s;
    return { offers: offers };
  }
  // res from the player's side: 'w', 'd' or 'l'. Returns what happened: 'cleared', 'again' or 'over'.
  function settleRun(M, res) {
    var run = M.run;
    if (!run) return null;
    if (res === 'w') {
      run.cleared++;
      run.stage++;
      if (run.cleared > M.runs.best) { M.runs.best = run.cleared; M.runs.bestDate = Date.now(); M.runs.bestArmy = run.army.map(function (x) { return x.slice(); }); }
      run.reward = dealReward(run);
      run.next = null;
      return 'cleared';
    }
    if (res === 'd') return 'again'; // the same stage once more
    M.runs.history.unshift({ cleared: run.cleared, date: Date.now(), army: run.army.map(function (x) { return x.slice(); }) });
    if (M.runs.history.length > 30) M.runs.history.length = 30;
    M.run = null;
    return 'over';
  }
  // the free home squares, for a given piece only those it may stand on (a pawn-like one never on rank 1)
  function freeHome(run, piece) {
    var taken = {};
    run.army.forEach(function (x) { taken[sq(x[0])] = true; });
    return HOME.filter(function (q) { return !taken[q]; }).map(sqName).filter(function (n) { return !piece || fits(piece, n); });
  }
  // A reward saved before offers were dealt this way: turned into offers.
  function offersOf(rw) {
    if (!rw) return [];
    if (rw.offers) return rw.offers;
    return (rw.recruit || []).map(function (l) { return { kind: 'unit', l: l }; }).concat((rw.upgrades || []).map(function (u) { return { kind: 'up', sq: u.sq, from: u.from, to: u.to }; })).slice(0, 3);
  }
  /* Picking offer i. A unit then waits to be placed on a free home square (and can still be swapped for another
     offer until then); an evolution happens at once. Returns false for a stale offer. */
  function chooseOffer(run, i) {
    var o = offersOf(run.reward)[i];
    if (!o) return false;
    if (o.kind === 'unit') {
      if (!freeHome(run, o.l).length) return false;
      run.edit = { kind: 'place', piece: o.l, offer: run.reward };
      run.reward = null;
      return true;
    }
    var x = run.army.find(function (a) { return a[0] === o.sq && a[1] === o.from; });
    if (!x) return false;
    x[1] = o.to;
    run.reward = null;
    return true;
  }
  function chooseRecruit(run, letter) { var i = offersOf(run.reward).findIndex(function (o) { return o.kind === 'unit' && o.l === letter; }); return i >= 0 && chooseOffer(run, i); }
  function chooseUpgrade(run, i) {
    var ups = offersOf(run.reward).map(function (o, k) { return o.kind === 'up' ? k : -1; }).filter(function (k) { return k >= 0; });
    return ups[i] != null && chooseOffer(run, ups[i]);
  }
  // Back to the offer, before the unit is placed.
  function cancelPlace(run) {
    if (!run.edit || run.edit.kind !== 'place' || !run.edit.offer) return false;
    run.reward = run.edit.offer;
    run.edit = null;
    return true;
  }
  function placeRecruit(run, at) {
    if (!run.edit || run.edit.kind !== 'place' || freeHome(run, run.edit.piece).indexOf(at) < 0) return false;
    run.army.push([at, run.edit.piece]);
    run.edit = null;
    return true;
  }
  // A reward with nothing in it (a full army with nothing left to evolve): the run goes on.
  function skipReward(run) {
    if (!run.reward || offersOf(run.reward).length) return false;
    run.reward = null;
    return true;
  }
  /* The layout: free to change at any time before the next stage is revealed (never after: the stage is dealt
     against the layout, and seeing it first would make that too easy). A piece moves within the two home ranks,
     or two pieces swap. */
  function canArrange(run) { return !!run && !run.reward && !run.edit && !run.next; }
  // a pawn never stands on the first rank (it could not have got there, and the rules refuse it)
  function pawnish(l) { return !!PAWNISH[String(l).toLowerCase()]; }
  function fits(l, at) { return !(PAWNISH[String(l).toLowerCase()] && at[1] === '1'); }
  function movePiece(run, from, to) {
    if (!canArrange(run) || HOME.indexOf(sq(to)) < 0 || from === to) return false;
    var a = run.army.find(function (x) { return x[0] === from; }), b = run.army.find(function (x) { return x[0] === to; });
    if (!a || !fits(a[1], to) || (b && !fits(b[1], from))) return false;
    a[0] = to;
    if (b) b[0] = from;
    return true;
  }
  // Reveal the next stage: it is dealt now, against the layout as it stands, and the layout is fixed until the fight.
  function reveal(run) {
    if (run.reward || run.edit) return false;
    if (!run.next) run.next = genStage(run);
    return true;
  }
  var ready = reveal;
  // (older saves: rearranging was once a reward with its own edit state)
  function chooseRearrange(run) { if (!run.reward) return false; run.reward = null; return true; }
  function startArrange(run) { return canArrange(run); }
  function finishEdit(run) { if (run.edit && run.edit.kind === 'arrange') run.edit = null; return true; }
  function layoutOk() { return true; }

  var api = {
    VERSION: VERSION, START_CREDITS: START_CREDITS, DICE_TIERS: DICE_TIERS, HOME: HOME, START_ARMY: START_ARMY, UPGRADES: UPGRADES, POOL: POOL, BOSSES: BOSSES, TIERS: TIERS, EVOLVES: EVOLVES,
    startOk: startOk, startArmy: startArmy, startArrange: startArrange, skipReward: skipReward, offersOf: offersOf, chooseOffer: chooseOffer, canArrange: canArrange, reveal: reveal,
    rng: rng, newSeed: newSeed, fresh: fresh, migrate: migrate, newer: newer,
    tier: tier, canBet: canBet, placeBet: placeBet, settleDice: settleDice, settleDrawback: settleDrawback,
    sq: sq, sqName: sqName, value: value, armyValue: armyValue, title: title, upgradesOf: upgradesOf, budgetFor: budgetFor,
    genStage: genStage, newRun: newRun, stageFen: stageFen, terrainIdx: terrainIdx, boardOf: boardOf, hotStart: hotStart, cfgFor: cfgFor,
    dealReward: dealReward, settleRun: settleRun, freeHome: freeHome,
    chooseRecruit: chooseRecruit, cancelPlace: cancelPlace, layoutOk: layoutOk, placeRecruit: placeRecruit, chooseUpgrade: chooseUpgrade, chooseRearrange: chooseRearrange,
    movePiece: movePiece, pawnish: pawnish, finishEdit: finishEdit, ready: ready
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Modes = api;
})(typeof self !== 'undefined' ? self : this);
