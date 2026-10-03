/* Puzzle logic without any screen code: the rating, which puzzle comes next, the
   daily puzzle, Puzzle Rush, filters and statistics. The puzzles themselves sit in
   puzzles/puzzles.json: { id, fen, moves (the solver moves first), rating, themes, last }.
   They were made on this machine by letting Stockfish play careless games against
   itself and keeping the positions in which exactly one move works. */
(function (root) {
  'use strict';

  var THEMES = {
    mate: 'Checkmate', mateIn1: 'Mate in 1', mateIn2: 'Mate in 2', mateIn3: 'Mate in 3', mateIn4: 'Mate in 4', mateIn5: 'Mate in 5',
    oneMove: 'One move', short: 'Two moves', long: 'Three moves', veryLong: 'Four moves or more',
    opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame',
    advantage: 'Win material', crushing: 'Winning blow', equality: 'Hold the balance',
    fork: 'Fork', hangingPiece: 'Hanging piece', sacrifice: 'Sacrifice', quietMove: 'Quiet move',
    discoveredAttack: 'Discovered attack', doubleCheck: 'Double check',
    backRankMate: 'Back rank mate', smotheredMate: 'Smothered mate',
    promotion: 'Promotion', underPromotion: 'Underpromotion', enPassant: 'En passant', castling: 'Castling',
    pin: 'Pin', skewer: 'Skewer', deflection: 'Deflection', attraction: 'Attraction', trappedPiece: 'Trapped piece', zugzwang: 'Zugzwang',
    intermezzo: 'In-between move', clearance: 'Clearance', interference: 'Interference', xRayAttack: 'X-ray', capturingDefender: 'Remove the defender',
    defensiveMove: 'Defensive move', exposedKing: 'Exposed king', kingsideAttack: 'Kingside attack', queensideAttack: 'Queenside attack',
    attackingF2F7: 'Attack on f2 or f7', advancedPawn: 'Advanced pawn', discoveredCheck: 'Discovered check', collinearMove: 'Collinear move',
    rookEndgame: 'Rook endgame', pawnEndgame: 'Pawn endgame', queenEndgame: 'Queen endgame', bishopEndgame: 'Bishop endgame', knightEndgame: 'Knight endgame', queenRookEndgame: 'Queen and rook endgame',
    anastasiaMate: 'Anastasia\'s mate', arabianMate: 'Arabian mate', bodenMate: 'Boden\'s mate', doubleBishopMate: 'Double bishop mate', dovetailMate: 'Dovetail mate', hookMate: 'Hook mate',
    killBoxMate: 'Kill box mate', vukovicMate: 'Vukovic mate', operaMate: 'Opera mate', pillsburysMate: 'Pillsbury\'s mate', morphysMate: 'Morphy\'s mate', epauletteMate: 'Epaulette mate',
    swallowstailMate: 'Swallow\'s tail mate', blindSwineMate: 'Blind swine mate', balestraMate: 'Balestra mate', cornerMate: 'Corner mate', triangleMate: 'Triangle mate',
    master: 'From a master game', masterVsMaster: 'Master against master', superGM: 'From a super GM game', yourGame: 'From your own game',
    powerUp: 'Power-up puzzle', freeze: 'Freeze Ray', midas: 'Midas Touch', sniper: 'Sniper Bishops', dragon: 'Dragon Knights', rocket: 'Rocket Pawns', amazon: 'Amazon Queen', timestop: 'Time Stop', archer: 'Sniper Knights', ghost: 'Ghost Rooks', sniperR: 'Sniper Rooks'
  };
  // the ones offered as filters, in this order
  var FILTERS = ['mate', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'fork', 'pin', 'skewer', 'hangingPiece', 'sacrifice', 'deflection', 'attraction', 'discoveredAttack', 'doubleCheck',
    'quietMove', 'defensiveMove', 'trappedPiece', 'zugzwang', 'intermezzo', 'clearance', 'capturingDefender', 'exposedKing', 'kingsideAttack', 'queensideAttack',
    'backRankMate', 'smotheredMate', 'arabianMate', 'anastasiaMate', 'promotion', 'advancedPawn', 'advantage', 'crushing',
    'opening', 'middlegame', 'endgame', 'rookEndgame', 'pawnEndgame', 'queenEndgame', 'master', 'oneMove', 'short', 'long', 'veryLong'];
  var BANDS = [['all', 'Any', 0, 9999], ['a', 'Under 900', 0, 900], ['b', '900+', 900, 1300], ['c', '1300+', 1300, 1700], ['d', '1700+', 1700, 9999]];
  var RUSH = { 3: { name: '3 minutes', secs: 180, strikes: 3 }, 5: { name: '5 minutes', secs: 300, strikes: 3 }, s: { name: 'Survival', secs: 0, strikes: 3 }, k: { name: 'Streak', secs: 0, strikes: 1 } };

  function fresh() {
    return { rating: 800, rd: 250, best: 800, streak: 0, bestStreak: 0, solved: 0, failed: 0, seconds: 0,
      seen: {}, history: [], log: [], rush: { 3: 0, 5: 0, s: 0, k: 0 }, rushRuns: [], daily: {}, adj: {} };
  }
  function load(text) {
    var p = fresh(), got = null;
    try { got = JSON.parse(text); } catch (e) { got = null; }
    if (got && typeof got === 'object') for (var k in p) if (got[k] != null) p[k] = got[k];
    return p;
  }

  /* Rating. The chance to solve a puzzle follows the usual logistic curve. How much one result moves
     the rating depends on how settled it is (rd): a new profile jumps in big steps, a seasoned one in
     small ones. */
  function expected(user, puzzle) { return 1 / (1 + Math.pow(10, (puzzle - user) / 400)); }
  /* A puzzle's rating as it stands for this player: the rating it came with, corrected by the results
     it has had. A puzzle that keeps being solved by weaker players drifts down, one that keeps
     beating stronger players drifts up. The corrections live in the profile (adj), not in the file. */
  function ratingOf(item, p) { return item.rating + ((p && p.adj && p.adj[item.id]) || 0); }
  function rate(p, puzzleRating, won) {
    var k = 14 + p.rd * 0.16, delta = Math.round(k * ((won ? 1 : 0) - expected(p.rating, puzzleRating)));
    if (won && delta < 1) delta = 1;
    if (!won && delta > -1) delta = -1;
    return delta;
  }
  // Book one rated result. Returns the rating change.
  function record(p, item, won, seconds, when) {
    var r = ratingOf(item, p), delta = rate(p, r, won);
    // the puzzle learns too: a smaller step, bounded, so a few results cannot throw it far
    if (!p.adj) p.adj = {};
    var pd = Math.round(12 * ((won ? 0 : 1) - (1 - expected(p.rating, r))));
    p.adj[item.id] = Math.max(-300, Math.min(300, (p.adj[item.id] || 0) + pd));
    p.rating = Math.max(100, p.rating + delta);
    p.rd = Math.max(60, p.rd * 0.965);
    if (p.rating > p.best) p.best = p.rating;
    if (won) { p.solved++; p.streak++; if (p.streak > p.bestStreak) p.bestStreak = p.streak; } else { p.failed++; p.streak = 0; }
    p.seconds += seconds;
    p.seen[item.id] = won ? 1 : 2;
    p.history.unshift({ id: item.id, r: r, ok: won ? 1 : 0, t: Math.round(seconds), d: when, dl: delta, u: p.rating });
    if (p.history.length > 400) p.history.length = 400;
    p.log.push([when, p.rating]);
    if (p.log.length > 600) p.log.splice(0, p.log.length - 600);
    return delta;
  }

  function rnd(n) { return Math.floor(Math.random() * n); }
  // The next rated puzzle: close to the player's rating, not seen before if possible.
  function next(list, p) {
    for (var width = 120; width <= 2400; width *= 2) {
      var pool = list.filter(function (x) { return !p.seen[x.id] && Math.abs(ratingOf(x, p) - p.rating) <= width; });
      if (pool.length >= 3 || (pool.length && width > 900)) return pool[rnd(pool.length)];
    }
    // everything solved: start over with the ones that went wrong, then with any
    var again = list.filter(function (x) { return p.seen[x.id] === 2; });
    if (again.length) return again[rnd(again.length)];
    return list[rnd(list.length)];
  }

  // One puzzle per calendar day, the same all day. Middle of the range, at least two moves long.
  function dayKey(date) { var z = function (n) { return (n < 10 ? '0' : '') + n; }; return date.getFullYear() + '-' + z(date.getMonth() + 1) + '-' + z(date.getDate()); }
  function daily(list, key) {
    var pool = list.filter(function (x) { return x.rating >= 950 && x.rating <= 1900 && x.moves.length >= 3; });
    if (!pool.length) pool = list;
    var h = 2166136261;
    for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    return pool[(h >>> 0) % pool.length];
  }
  function dailyStreak(p, today) {
    var n = 0, d = new Date(today.getTime());
    if (!(p.daily[dayKey(d)] && p.daily[dayKey(d)].ok)) d.setDate(d.getDate() - 1); // today may still be open
    while (p.daily[dayKey(d)] && p.daily[dayKey(d)].ok) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /* Puzzle Rush: the puzzles get harder one by one. used = ids already played in this run. */
  function rushNext(list, k, used, p) {
    var target = 420 + k * 42 + rnd(60), best = null, bd = 1e9;
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (used[x.id] || x.moves.length > 5) continue;
      var d = Math.abs(ratingOf(x, p) - target) + rnd(40);
      if (d < bd) { bd = d; best = x; }
    }
    return best;
  }

  function filter(list, themes, band, p) {
    var b = BANDS.filter(function (x) { return x[0] === band; })[0] || BANDS[0];
    return list.filter(function (x) {
      var r = ratingOf(x, p);
      if (r < b[2] || r >= b[3]) return false;
      for (var i = 0; i < themes.length; i++) if (x.themes.indexOf(themes[i]) < 0) return false;
      return true;
    });
  }

  // Numbers for the statistics page.
  function stats(p, list) {
    var total = p.solved + p.failed, byTheme = {}, byId = {};
    list.forEach(function (x) { byId[x.id] = x; });
    p.history.forEach(function (hst) {
      var it = byId[hst.id];
      if (!it) return;
      it.themes.forEach(function (t) { var e = byTheme[t] = byTheme[t] || { n: 0, ok: 0 }; e.n++; e.ok += hst.ok; });
    });
    var themes = Object.keys(byTheme).filter(function (t) { return byTheme[t].n >= 3 && THEMES[t]; })
      .map(function (t) { return { id: t, name: THEMES[t], n: byTheme[t].n, pct: Math.round(byTheme[t].ok / byTheme[t].n * 100) }; })
      .sort(function (a, b) { return b.n - a.n; });
    return { total: total, accuracy: total ? Math.round(p.solved / total * 100) : null, avg: total ? Math.round(p.seconds / total) : null, themes: themes };
  }

  var api = { THEMES: THEMES, FILTERS: FILTERS, BANDS: BANDS, RUSH: RUSH, fresh: fresh, load: load, expected: expected, ratingOf: ratingOf, rate: rate, record: record,
    next: next, dayKey: dayKey, daily: daily, dailyStreak: dailyStreak, rushNext: rushNext, filter: filter, stats: stats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Puzzles = api;
})(typeof self !== 'undefined' ? self : this);
