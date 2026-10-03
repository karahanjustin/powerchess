/* Game review: turns engine evaluations into move ratings, accuracy numbers
   and short explanations. Pure functions, no DOM, so it can be tested in node.

   An evaluation is always from White's point of view:
   { cp: 35 }, { mate: 3 } (White mates in 3), { mate: -2 }, or { win: 'w' | 'b' | 'draw' } for a finished game. */
(function (root) {
  'use strict';

  var CLASSES = {
    brilliant: { label: 'Brilliant', sym: '!!', color: '#1baca6' },
    great: { label: 'Great', sym: '!', color: '#5c8bb0' },
    best: { label: 'Best', sym: '★', color: '#81b64c' },
    excellent: { label: 'Excellent', sym: '✓', color: '#96bc4b' },
    good: { label: 'Good', sym: '✓', color: '#77915f' },
    book: { label: 'Book', sym: '≡', color: '#a88865' },
    inaccuracy: { label: 'Inaccuracy', sym: '?!', color: '#f0c15c' },
    mistake: { label: 'Mistake', sym: '?', color: '#e6912c' },
    miss: { label: 'Miss', sym: '×', color: '#ee6b55' },
    blunder: { label: 'Blunder', sym: '??', color: '#ca3431' },
    forced: { label: 'Forced', sym: '→', color: '#8b8987' }
  };
  var ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
  var KEY = { brilliant: 1, great: 1, inaccuracy: 1, mistake: 1, miss: 1, blunder: 1 };

  // Opening names with their moves. A game is "in book" while it follows one of these lines.
  var OPENINGS = [
    ["King's Pawn Opening", 'e4'],
    ["Queen's Pawn Opening", 'd4'],
    ['English Opening', 'c4'],
    ['Zukertort Opening', 'Nf3'],
    ["Bird's Opening", 'f4'],
    ["Larsen's Opening", 'b3'],
    ['Polish Opening', 'b4'],
    ["King's Fianchetto Opening", 'g3'],
    ['Grob Opening', 'g4'],
    ["Van't Kruijs Opening", 'e3'],
    ['Open Game', 'e4 e5'],
    ["King's Knight Opening", 'e4 e5 Nf3'],
    ["King's Knight Opening", 'e4 e5 Nf3 Nc6'],
    ['Italian Game', 'e4 e5 Nf3 Nc6 Bc4'],
    ['Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5'],
    ['Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6'],
    ['Giuoco Pianissimo', 'e4 e5 Nf3 Nc6 Bc4 Bc5 d3'],
    ['Evans Gambit', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4'],
    ['Two Knights Defense', 'e4 e5 Nf3 Nc6 Bc4 Nf6'],
    ['Two Knights Defense, Knight Attack', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5'],
    ['Fried Liver Attack', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7'],
    ['Hungarian Defense', 'e4 e5 Nf3 Nc6 Bc4 Be7'],
    ['Ruy Lopez', 'e4 e5 Nf3 Nc6 Bb5'],
    ['Ruy Lopez, Morphy Defense', 'e4 e5 Nf3 Nc6 Bb5 a6'],
    ['Ruy Lopez, Morphy Defense', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6'],
    ['Ruy Lopez, Exchange Variation', 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6'],
    ['Ruy Lopez, Closed', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6'],
    ['Ruy Lopez, Open', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4'],
    ['Ruy Lopez, Berlin Defense', 'e4 e5 Nf3 Nc6 Bb5 Nf6'],
    ['Ruy Lopez, Berlin Defense', 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4'],
    ['Ruy Lopez, Classical Defense', 'e4 e5 Nf3 Nc6 Bb5 Bc5'],
    ['Ruy Lopez, Steinitz Defense', 'e4 e5 Nf3 Nc6 Bb5 d6'],
    ['Scotch Game', 'e4 e5 Nf3 Nc6 d4'],
    ['Scotch Game', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4'],
    ['Scotch Gambit', 'e4 e5 Nf3 Nc6 d4 exd4 Bc4'],
    ['Three Knights Opening', 'e4 e5 Nf3 Nc6 Nc3'],
    ['Four Knights Game', 'e4 e5 Nf3 Nc6 Nc3 Nf6'],
    ['Four Knights Game, Spanish Variation', 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5'],
    ['Ponziani Opening', 'e4 e5 Nf3 Nc6 c3'],
    ["Petrov's Defense", 'e4 e5 Nf3 Nf6'],
    ["Petrov's Defense", 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4'],
    ['Philidor Defense', 'e4 e5 Nf3 d6'],
    ['Philidor Defense', 'e4 e5 Nf3 d6 d4'],
    ['Latvian Gambit', 'e4 e5 Nf3 f5'],
    ['Vienna Game', 'e4 e5 Nc3'],
    ['Vienna Game', 'e4 e5 Nc3 Nf6'],
    ['Vienna Gambit', 'e4 e5 Nc3 Nf6 f4'],
    ["Bishop's Opening", 'e4 e5 Bc4'],
    ["King's Gambit", 'e4 e5 f4'],
    ["King's Gambit Accepted", 'e4 e5 f4 exf4'],
    ["King's Gambit Accepted", 'e4 e5 f4 exf4 Nf3'],
    ["King's Gambit Declined", 'e4 e5 f4 Bc5'],
    ['Falkbeer Countergambit', 'e4 e5 f4 d5'],
    ['Center Game', 'e4 e5 d4'],
    ['Center Game', 'e4 e5 d4 exd4 Qxd4'],
    ['Danish Gambit', 'e4 e5 d4 exd4 c3'],
    ['Sicilian Defense', 'e4 c5'],
    ['Sicilian Defense', 'e4 c5 Nf3'],
    ['Sicilian Defense', 'e4 c5 Nf3 d6'],
    ['Sicilian Defense', 'e4 c5 Nf3 Nc6'],
    ['Sicilian Defense', 'e4 c5 Nf3 e6'],
    ['Sicilian Defense, Open', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4'],
    ['Sicilian Defense, Open', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3'],
    ['Sicilian Defense, Najdorf Variation', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'],
    ['Sicilian Defense, Dragon Variation', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6'],
    ['Sicilian Defense, Classical Variation', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6'],
    ['Sicilian Defense, Scheveningen Variation', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6'],
    ['Sicilian Defense, Open', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4'],
    ['Sicilian Defense, Sveshnikov Variation', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5'],
    ['Sicilian Defense, Accelerated Dragon', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6'],
    ['Sicilian Defense, Rossolimo Variation', 'e4 c5 Nf3 Nc6 Bb5'],
    ['Sicilian Defense, Moscow Variation', 'e4 c5 Nf3 d6 Bb5'],
    ['Sicilian Defense, Open', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4'],
    ['Sicilian Defense, Taimanov Variation', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6'],
    ['Sicilian Defense, Kan Variation', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6'],
    ['Sicilian Defense, Alapin Variation', 'e4 c5 c3'],
    ['Sicilian Defense, Closed', 'e4 c5 Nc3'],
    ['Sicilian Defense, Closed', 'e4 c5 Nc3 Nc6 g3'],
    ['Sicilian Defense, Grand Prix Attack', 'e4 c5 Nc3 Nc6 f4'],
    ['Sicilian Defense, Smith-Morra Gambit', 'e4 c5 d4 cxd4 c3'],
    ['French Defense', 'e4 e6'],
    ['French Defense', 'e4 e6 d4 d5'],
    ['French Defense, Advance Variation', 'e4 e6 d4 d5 e5'],
    ['French Defense, Advance Variation', 'e4 e6 d4 d5 e5 c5 c3'],
    ['French Defense, Exchange Variation', 'e4 e6 d4 d5 exd5 exd5'],
    ['French Defense, Tarrasch Variation', 'e4 e6 d4 d5 Nd2'],
    ['French Defense, Winawer Variation', 'e4 e6 d4 d5 Nc3 Bb4'],
    ['French Defense, Classical Variation', 'e4 e6 d4 d5 Nc3 Nf6'],
    ['French Defense, Rubinstein Variation', 'e4 e6 d4 d5 Nc3 dxe4 Nxe4'],
    ['Caro-Kann Defense', 'e4 c6'],
    ['Caro-Kann Defense', 'e4 c6 d4 d5'],
    ['Caro-Kann Defense, Advance Variation', 'e4 c6 d4 d5 e5'],
    ['Caro-Kann Defense, Advance Variation', 'e4 c6 d4 d5 e5 Bf5'],
    ['Caro-Kann Defense, Exchange Variation', 'e4 c6 d4 d5 exd5 cxd5'],
    ['Caro-Kann Defense, Panov Attack', 'e4 c6 d4 d5 exd5 cxd5 c4'],
    ['Caro-Kann Defense, Classical Variation', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5'],
    ['Caro-Kann Defense, Two Knights Attack', 'e4 c6 Nc3 d5 Nf3'],
    ['Scandinavian Defense', 'e4 d5'],
    ['Scandinavian Defense', 'e4 d5 exd5 Qxd5'],
    ['Scandinavian Defense', 'e4 d5 exd5 Qxd5 Nc3 Qa5'],
    ['Scandinavian Defense, Modern Variation', 'e4 d5 exd5 Nf6'],
    ["Alekhine's Defense", 'e4 Nf6'],
    ["Alekhine's Defense", 'e4 Nf6 e5 Nd5 d4 d6'],
    ['Pirc Defense', 'e4 d6'],
    ['Pirc Defense', 'e4 d6 d4 Nf6 Nc3 g6'],
    ['Modern Defense', 'e4 g6'],
    ['Modern Defense', 'e4 g6 d4 Bg7'],
    ['Nimzowitsch Defense', 'e4 Nc6'],
    ["Owen's Defense", 'e4 b6'],
    ["Queen's Pawn Game", 'd4 d5'],
    ["Queen's Pawn Game", 'd4 d5 Nf3'],
    ["Queen's Pawn Game", 'd4 d5 Nf3 Nf6'],
    ["Queen's Gambit", 'd4 d5 c4'],
    ["Queen's Gambit Accepted", 'd4 d5 c4 dxc4'],
    ["Queen's Gambit Accepted", 'd4 d5 c4 dxc4 Nf3 Nf6 e3'],
    ["Queen's Gambit Declined", 'd4 d5 c4 e6'],
    ["Queen's Gambit Declined", 'd4 d5 c4 e6 Nc3 Nf6'],
    ["Queen's Gambit Declined", 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7'],
    ["Queen's Gambit Declined, Exchange Variation", 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5'],
    ['Tarrasch Defense', 'd4 d5 c4 e6 Nc3 c5'],
    ['Slav Defense', 'd4 d5 c4 c6'],
    ['Slav Defense', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4'],
    ['Semi-Slav Defense', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6'],
    ['Albin Countergambit', 'd4 d5 c4 e5'],
    ['Chigorin Defense', 'd4 d5 c4 Nc6'],
    ['London System', 'd4 d5 Bf4'],
    ['London System', 'd4 d5 Nf3 Nf6 Bf4'],
    ['London System', 'd4 Nf6 Bf4'],
    ['London System', 'd4 Nf6 Nf3 g6 Bf4'],
    ['Colle System', 'd4 d5 Nf3 Nf6 e3'],
    ['Blackmar-Diemer Gambit', 'd4 d5 e4'],
    ['Indian Defense', 'd4 Nf6'],
    ['Indian Defense', 'd4 Nf6 c4'],
    ['Indian Defense', 'd4 Nf6 Nf3'],
    ['Indian Defense', 'd4 Nf6 c4 e6'],
    ['Indian Defense', 'd4 Nf6 c4 g6'],
    ["King's Indian Defense", 'd4 Nf6 c4 g6 Nc3 Bg7'],
    ["King's Indian Defense", 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6'],
    ["King's Indian Defense, Classical Variation", 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5'],
    ["King's Indian Defense, Samisch Variation", 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3'],
    ['Grunfeld Defense', 'd4 Nf6 c4 g6 Nc3 d5'],
    ['Grunfeld Defense, Exchange Variation', 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3'],
    ['Nimzo-Indian Defense', 'd4 Nf6 c4 e6 Nc3 Bb4'],
    ['Nimzo-Indian Defense, Rubinstein Variation', 'd4 Nf6 c4 e6 Nc3 Bb4 e3'],
    ['Nimzo-Indian Defense, Classical Variation', 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2'],
    ["Queen's Indian Defense", 'd4 Nf6 c4 e6 Nf3 b6'],
    ["Queen's Indian Defense", 'd4 Nf6 c4 e6 Nf3 b6 g3'],
    ['Bogo-Indian Defense', 'd4 Nf6 c4 e6 Nf3 Bb4'],
    ['Catalan Opening', 'd4 Nf6 c4 e6 g3'],
    ['Catalan Opening', 'd4 Nf6 c4 e6 g3 d5 Bg2'],
    ['Benoni Defense', 'd4 Nf6 c4 c5'],
    ['Modern Benoni', 'd4 Nf6 c4 c5 d5 e6'],
    ['Benko Gambit', 'd4 Nf6 c4 c5 d5 b5'],
    ['Budapest Gambit', 'd4 Nf6 c4 e5'],
    ['Old Indian Defense', 'd4 Nf6 c4 d6'],
    ['Trompowsky Attack', 'd4 Nf6 Bg5'],
    ['Torre Attack', 'd4 Nf6 Nf3 e6 Bg5'],
    ['Dutch Defense', 'd4 f5'],
    ['Dutch Defense', 'd4 f5 c4 Nf6 g3'],
    ['Englund Gambit', 'd4 e5'],
    ['English Opening, Symmetrical Variation', 'c4 c5'],
    ['English Opening, Reversed Sicilian', 'c4 e5'],
    ['English Opening, Reversed Sicilian', 'c4 e5 Nc3 Nf6'],
    ['English Opening, Anglo-Indian Defense', 'c4 Nf6'],
    ['English Opening', 'c4 e6'],
    ['Reti Opening', 'Nf3 d5 c4'],
    ["King's Indian Attack", 'Nf3 d5 g3'],
    ['Zukertort Opening', 'Nf3 Nf6'],
    ['Zukertort Opening', 'Nf3 d5']
  ];
  var bookIndex = null, bookEco = null;
  function buildBook() {
    bookIndex = {}; bookEco = {};
    var lines = OPENINGS.map(function (o) { return ['', o[0], o[1]]; });
    // the full book, when it is loaded (js/openings.js in the page, the module in node)
    var big = typeof OPENING_BOOK !== 'undefined' ? OPENING_BOOK : null;
    if (!big && typeof module !== 'undefined' && module.exports) { try { big = require('./openings.js'); } catch (e) { big = null; } }
    if (big) lines = lines.concat(big);
    lines.forEach(function (o) {
      var moves = o[2].split(' ').map(function (m) { return m.replace(/[+#]/g, ''); });
      for (var i = 1; i <= moves.length; i++) {
        var key = moves.slice(0, i).join(' ');
        if (i === moves.length) { bookIndex[key] = o[1]; bookEco[key] = o[0]; }
        else if (!(key in bookIndex)) bookIndex[key] = '';
      }
    });
  }
  // sans = the game's moves in SAN. Returns how many plies are theory and the most specific name reached.
  function opening(sans) {
    if (!bookIndex) buildBook();
    var name = '', plies = 0, eco = '';
    for (var i = 1; i <= sans.length; i++) {
      var key = sans.slice(0, i).map(function (s) { return s.replace(/[+#]/g, ''); }).join(' ');
      if (!(key in bookIndex)) break;
      plies = i;
      if (bookIndex[key]) { name = bookIndex[key]; eco = bookEco[key] || ''; }
    }
    return { name: name, plies: plies, eco: eco };
  }

  /* ---------- numbers ---------- */

  function whiteChance(ev) {
    if (!ev) return 0.5;
    if (ev.win) return ev.win === 'w' ? 1 : ev.win === 'b' ? 0 : 0.5;
    if (ev.mate != null) return ev.mate > 0 ? 1 : 0;
    return 1 / (1 + Math.exp(-0.00368208 * ev.cp * (ev.k || 1))); // k: the weight of a lead with this much material on the board (app.js matScale)
  }
  function chanceFor(ev, color) { var w = whiteChance(ev); return color === 'w' ? w : 1 - w; }
  function moveAccuracy(before, after) {
    if (after >= before) return 100;
    var a = 103.1668 * Math.exp(-0.04354 * (before - after) * 100) - 3.1669;
    return Math.max(0, Math.min(100, a));
  }
  function fmt(ev) {
    if (!ev) return '0.0';
    if (ev.win) return ev.win === 'w' ? '1-0' : ev.win === 'b' ? '0-1' : '½-½';
    if (ev.mate != null) return (ev.mate < 0 ? '-' : '+') + 'M' + Math.abs(ev.mate);
    var v = ev.cp / 100;
    return (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(v > -10 && v < 10 ? 2 : 1);
  }

  /* Rate every move. Each ply needs: by, special, played, best, before, after, second,
     forced, recapture, hang ({ piece, sq, net } or null), book, idx, npm. */
  function classify(plies) {
    plies.forEach(function (p) {
      p.cls = null;
      if (p.special && !p.rated) return; // a free action is only rated when the search that knows power-ups reviewed the game
      var eb = chanceFor(p.before, p.by), ea = chanceFor(p.after, p.by);
      p.chanceBefore = eb; p.chanceAfter = ea;
      p.loss = Math.max(0, eb - ea);
      p.acc = moveAccuracy(eb, ea);
      if (p.book) { p.cls = 'book'; p.acc = 100; return; }
      if (p.forced) { p.cls = 'forced'; return; }
      var isBest = (!!p.played && p.played === p.best) || (!p.played && p.loss <= 0.02);
      var c = isBest ? 'best' : p.loss <= 0.02 ? 'excellent' : p.loss <= 0.05 ? 'good' : p.loss <= 0.10 ? 'inaccuracy' : p.loss <= 0.20 ? 'mistake' : 'blunder';
      if ((c === 'best' || (c === 'excellent' && p.loss <= 0.01)) && p.hang && p.hang.net >= 2 && !p.recapture && ea >= 0.45 && eb <= 0.97) {
        c = 'brilliant'; // gives material and the engine still approves
      } else if (c === 'best' && p.second && !p.recapture) {
        var es = chanceFor(p.second, p.by);
        if (eb - es >= 0.10 && eb >= 0.25 && es < 0.9) c = 'great'; // the only move that holds
      }
      if ((c === 'mistake' || c === 'blunder') && !p.hang && eb >= 0.7 && ea >= 0.4) c = 'miss'; // a won game let slip, nothing lost yet
      // Walking into a quick forced mate is never a good move, however lost the position already was.
      var mated = p.after && p.after.mate != null && ((p.after.mate > 0) !== (p.by === 'w')) && Math.abs(p.after.mate) <= 3;
      var wasMated = p.before && p.before.mate != null && ((p.before.mate > 0) !== (p.by === 'w'));
      if (mated && !wasMated && !isBest && (c === 'excellent' || c === 'good' || c === 'inaccuracy' || c === 'mistake')) c = eb >= 0.08 ? 'blunder' : 'mistake';
      p.cls = c;
    });
    return plies;
  }

  function phaseOf(p) {
    if (p.book || (p.idx < 20 && p.npm >= 56)) return 'opening';
    return p.npm <= 26 ? 'endgame' : 'middlegame';
  }
  function average(list) {
    if (!list.length) return null;
    var sum = 0, inv = 0;
    list.forEach(function (a) { sum += a; inv += 1 / Math.max(a, 1); });
    return (sum / list.length + list.length / inv) / 2; // plain mean and harmonic mean, so bad moves count
  }
  /* Accuracy to rating, measured on 7,000 rapid and classical games from the Lichess database (August 2026,
     players with established ratings, Lichess's own analysis): for every rating, the median accuracy over the
     moves played while the game was still open. So the scale is Lichess rapid, and a rating here means "a
     typical game of a player of this rating looks like this". Built with tools/calibrate_rating.js. */
  var RATING = [[100, 3150], [96, 2850], [93, 2600], [90, 2400], [88.4, 2300], [86.6, 2200], [85.7, 2100], [84.9, 2000], [84.1, 1900], [83.1, 1800],
    [81.6, 1700], [80.7, 1600], [79.5, 1500], [78.2, 1400], [77.2, 1300], [75.6, 1200], [73.8, 1100], [71.6, 1000], [69.5, 900], [68.7, 800],
    [65, 700], [60, 500], [50, 300], [40, 200], [0, 100]];
  var MIDDLE = 1500, SHRINK = 20, MIN_OPEN = 8;
  function ratingFor(acc) {
    if (acc == null) return null;
    for (var i = 1; i < RATING.length; i++) {
      if (acc >= RATING[i][0]) {
        var a = RATING[i - 1], b = RATING[i], t = (acc - b[0]) / (a[0] - b[0]);
        return b[1] + t * (a[1] - b[1]);
      }
    }
    return 100;
  }
  /* Only moves made while the game was still open count: with one side far ahead every move keeps the result and
     scores close to 100, which says nothing about the player. One game is a small sample, so the estimate is pulled
     towards the middle of the scale the fewer such moves there were (n / (n + SHRINK)), and with fewer than
     MIN_OPEN there is no estimate at all. */
  function openPly(p) {
    return p.cls && p.cls !== 'book' && p.cls !== 'forced' && p.chanceBefore != null && Math.min(p.chanceBefore, 1 - p.chanceBefore) >= 0.1;
  }
  function estimate(acc, n) {
    if (acc == null || n < MIN_OPEN) return null;
    var r = MIDDLE + (ratingFor(acc) - MIDDLE) * n / (n + SHRINK);
    return Math.round(r / 50) * 50;
  }
  function gradeFor(acc) {
    if (acc == null) return null;
    return acc >= 90 ? 'best' : acc >= 80 ? 'excellent' : acc >= 70 ? 'good' : acc >= 55 ? 'inaccuracy' : acc >= 40 ? 'mistake' : 'blunder';
  }

  function summary(plies) {
    var out = { acc: {}, counts: { w: {}, b: {} }, rating: {}, open: {}, phases: { w: {}, b: {} }, moves: { w: 0, b: 0 } };
    ['w', 'b'].forEach(function (c) {
      var mine = plies.filter(function (p) { return p.by === c && p.cls; });
      out.moves[c] = mine.length;
      ORDER.forEach(function (k) { out.counts[c][k] = 0; });
      mine.forEach(function (p) { if (p.cls in out.counts[c]) out.counts[c][p.cls]++; });
      out.acc[c] = average(mine.map(function (p) { return p.acc; }));
      /* The rating estimate (see estimate). In Dice Chess (base and baseAll known) picking the best of the few moves
         the dice allow is much easier than picking it among all legal moves. So there the player's accuracy is measured
         from what a random allowed move would score (base) and mapped onto the same distance above what a random legal
         move scores (baseAll). A ply in which every allowed move was about as good is left out. */
      var open = mine.filter(openPly);
      var dice = open.filter(function (p) { return p.base != null && p.baseAll != null && p.base < 97; });
      if (dice.length >= MIN_OPEN) {
        var A = average(dice.map(function (p) { return p.acc; })), Bd = average(dice.map(function (p) { return p.base; })), Bf = average(dice.map(function (p) { return Math.min(p.baseAll, p.base); }));
        var scaled = Bf + (A - Bd) * (100 - Bf) / Math.max(1, 100 - Bd);
        out.rating[c] = estimate(Math.max(0, Math.min(100, scaled)), dice.length);
      } else if (open.some(function (p) { return p.base != null; })) out.rating[c] = null;
      else out.rating[c] = estimate(average(open.map(function (p) { return p.acc; })), open.length);
      out.open[c] = open.length;
      ['opening', 'middlegame', 'endgame'].forEach(function (ph) {
        var part = mine.filter(function (p) { return phaseOf(p) === ph; });
        out.phases[c][ph] = gradeFor(average(part.map(function (p) { return p.acc; })));
      });
    });
    return out;
  }

  /* ---------- words ---------- */

  function standing(ev) {
    if (!ev) return '';
    if (ev.win) return ev.win === 'draw' ? 'The game is drawn.' : (ev.win === 'w' ? 'White' : 'Black') + ' has won.';
    if (ev.mate != null) return (ev.mate > 0 ? 'White' : 'Black') + ' has a forced mate in ' + Math.abs(ev.mate) + '.';
    var w = whiteChance(ev), side = w >= 0.5 ? 'White' : 'Black', d = Math.abs(w - 0.5);
    if (d < 0.06) return 'The position is about equal.';
    if (d < 0.17) return side + ' is slightly better.';
    if (d < 0.33) return side + ' is clearly better.';
    return side + ' is winning.';
  }
  var PIECE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

  // A short explanation of one rated move, in plain words.
  function comment(p, openingName) {
    var san = p.san, better = p.bestSan && p.bestSan !== san ? p.bestSan : '';
    // the coach's findings, when it has looked at the move: why it fails and what the better move would have done
    var seen = p.why ? p.why + ' ' : '', tip = p.better ? ' ' + p.better : (better ? ' ' + better + ' was the move.' : '');
    if (p.special) {
      // a free power-up action, rated like a move: by what it does to the position
      var act = { gild: 'Midas Touch', freeze: 'Freeze Ray', stop: 'Time Stop', convert: 'Turncoat' }[p.special] || 'This';
      var on = p.target && p.target.piece ? ' on the ' + (p.target.name || PIECE[p.target.piece.toLowerCase()] || 'piece') + ' on ' + p.target.sq : '';
      var verdict = { best: ' is the best use of it here.', excellent: ' is a fine choice here.', good: ' is fine here.', forced: ' is all there is.', great: ' is the one action that holds things together.', brilliant: ' is excellent.',
        inaccuracy: ' is not the best use of it.', mistake: ' is a mistake.', blunder: ' is a blunder.', miss: ' misses something better.' }[p.cls] || '.';
      var weak = p.cls === 'inaccuracy' || p.cls === 'mistake' || p.cls === 'blunder' || p.cls === 'miss';
      return act + on + verdict + (weak ? ' ' + (seen + tip.trim()).trim() : '') + ' ' + standing(p.after);
    }
    var who = p.by === 'w' ? 'White' : 'Black', after = standing(p.after);
    var mateNow = p.after && p.after.mate != null && ((p.after.mate > 0) !== (p.by === 'w'));
    var hadMate = p.before && p.before.mate != null && ((p.before.mate > 0) === (p.by === 'w'));
    var piece = p.hang ? (PIECE[p.hang.piece.toLowerCase()] || 'piece') : '';
    switch (p.cls) {
      case 'book': return san + ' is a book move.' + (openingName ? ' This is the ' + openingName + '.' : '');
      case 'forced': return san + ' is the only legal move.';
      case 'brilliant': return san + ' is brilliant. It offers the ' + piece + ' on ' + p.hang.sq + ', and taking it does not help the opponent. ' + after;
      case 'great': return san + ' is a great move, the only one that keeps things together. Everything else was clearly worse. ' + after;
      case 'best': return san + ' is the best move. ' + after;
      case 'excellent': return san + ' is an excellent move' + (better ? ', almost as good as ' + better : '') + '. ' + after;
      case 'good': return san + ' is a solid move.' + (better ? ' ' + better + ' was a little stronger.' : '') + ' ' + after;
      case 'inaccuracy': return san + ' is an inaccuracy. ' + (seen || (p.replyLine && p.replyLine.length ? 'The best answer is ' + p.replyLine[0] + (p.replyLine.length > 1 ? ' (' + p.replyLine.slice(0, 4).join(' ') + ')' : '') + '. ' : '')) + (p.better ? p.better + ' ' : (better ? better + ' was better. ' : '')) + after;
      case 'miss':
        return san + ' misses a chance. ' + (hadMate ? 'There was a forced mate' + (better ? ' starting with ' + better : '') + '. ' : (seen || (p.replyLine && p.replyLine.length ? 'The best answer is ' + p.replyLine[0] + (p.replyLine.length > 1 ? ' (' + p.replyLine.slice(0, 4).join(' ') + ')' : '') + '. ' : '')) + (p.better ? p.better + ' ' : (better ? better + ' would have kept a winning position. ' : ''))) + after;
      case 'mistake':
      case 'blunder':
        var label = p.cls === 'blunder' ? 'a blunder' : 'a mistake', why;
        if (p.why && !p.whySoft) why = p.why + (mateNow && !/checkmate/.test(p.why) ? ' It ends in a forced mate in ' + Math.abs(p.after.mate) + '.' : '');
        else if (mateNow) why = 'It allows a forced mate in ' + Math.abs(p.after.mate) + '.' + (p.why ? ' ' + p.why : '');
        else if (p.after && p.after.win && p.after.win !== 'draw') why = 'It loses on the spot.';
        else if (p.hang) why = 'It leaves the ' + piece + ' on ' + p.hang.sq + ' hanging.';
        else if (hadMate) why = 'It throws away a forced mate.';
        else if (p.why) why = p.why;
        else if (p.chanceBefore >= 0.7 && p.chanceAfter < 0.6) why = who + ' gives away the advantage.';
        else if (p.chanceBefore >= 0.4 && p.chanceAfter < 0.25) why = 'This loses the thread of the game.';
        else why = p.replyLine && p.replyLine.length ? 'The best answer is ' + p.replyLine[0] + (p.replyLine.length > 1 ? ' (' + p.replyLine.slice(0, 4).join(' ') + ')' : '') + ', and the position gets a good deal worse.' : 'It makes the position a good deal worse.';
        return san + ' is ' + label + '. ' + why + tip + ' ' + after;
      default: return san + '. ' + after;
    }
  }

  // How a move tried on the review board compares, by the winning chances it gives up.
  function gradeLoss(loss, isBest) {
    if (isBest) return 'best';
    return loss <= 0.02 ? 'excellent' : loss <= 0.05 ? 'good' : loss <= 0.10 ? 'inaccuracy' : loss <= 0.20 ? 'mistake' : 'blunder';
  }

  var api = {
    CLASSES: CLASSES, ORDER: ORDER, KEY: KEY, OPENINGS: OPENINGS,
    opening: opening, whiteChance: whiteChance, chanceFor: chanceFor, moveAccuracy: moveAccuracy, fmt: fmt,
    classify: classify, summary: summary, ratingFor: ratingFor, estimate: estimate, openPly: openPly, comment: comment, standing: standing, gradeLoss: gradeLoss, phaseOf: phaseOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Review = api;
})(typeof self !== 'undefined' ? self : this);
