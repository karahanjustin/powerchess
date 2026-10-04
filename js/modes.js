/* Game modes: the logic without any page code, so it runs in node too (tools/tests/modes_*.js).

   Dice Chess Arena: three-dice chess on the normal board against a bot, with a bet. Each tier costs credits
   to enter and pays back twice that on a win (the stake comes back on a draw). The free tier costs nothing
   and pays 1, so nobody ever runs out. A stronger tier means a stronger bot.

   The Ouroboros King's run lives in js/ouro.js; its state is kept here with the rest (M.run, M.runs), and an
   older run is carried over into it by migrate(). The whole state is one plain object (see fresh()). */
(function (root) {
  'use strict';
  var R = root.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);
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
      // Pawnbarian: the run in progress (pawnbarian.js), the dungeons each hero conquered and on which chain, the chain open
      pb: { run: null, conquered: {}, chain: 0, runs: 0, won: 0 },
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
    out.pb = Object.assign(fresh().pb, o.pb || {});
    if (!out.pb.conquered || typeof out.pb.conquered !== 'object') out.pb.conquered = {};
    if (!out.drawback.per || typeof out.drawback.per !== 'object') out.drawback.per = {};
    if (!Array.isArray(out.runs.history)) out.runs.history = [];
    if (typeof out.dice.credits !== 'number' || !isFinite(out.dice.credits) || out.dice.credits < 0) out.dice.credits = 0;
    if (out.run && (!Array.isArray(out.run.army) || !out.run.army.some(function (x) { return R.isRoyal(x[1]); }))) out.run = null;
    // a run of the stage-after-stage kind: on in the map and gold run, its army kept (js/ouro.js)
    var O = root.Ouro || (typeof require !== 'undefined' ? require('./ouro.js') : null);
    if (out.run && out.run.v !== 2 && O) { out.run = O.fromOld(out.run); if (out.pending && out.pending.kind === 'run') out.pending = null; } // its unfinished stage does not exist any more
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

  var api = {
    VERSION: VERSION, START_CREDITS: START_CREDITS, DICE_TIERS: DICE_TIERS,
    rng: rng, newSeed: newSeed, fresh: fresh, migrate: migrate, newer: newer,
    tier: tier, canBet: canBet, placeBet: placeBet, settleDice: settleDice, settleDrawback: settleDrawback
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Modes = api;
})(typeof self !== 'undefined' ? self : this);
