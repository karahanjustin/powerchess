/* Power Chess UI.
   Standard chess and the power-ups: rules.js + Stockfish 19 (engine.js).
   Chess variants: ffish rules + Fairy-Stockfish (fairy.js, Engine.initFairy). */
(function () {
  'use strict';
  const R = Rules;
  const $ = (s) => document.querySelector(s);
  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  // Piece pictures: the classic set lives in pieces/, the others in a folder of their own.
  const PIECE_SETS = [['cburnett', 'Classic'], ['merida', 'Merida'], ['chessnut', 'Chessnut'], ['spatial', 'Spatial']];
  // a fairy piece's picture; the shogi pieces come in wood (as the original) or in black and white (Settings > Pieces)
  const fairyPic = (c, pic) => 'pieces/fairy/' + c + '_' + (settings.shogiBW && pic.indexOf('shogi_') === 0 ? 'shogibw_' + pic.slice(6) : pic) + '.svg';
  function pieceDir(set) { const id = set || settings.pieces; return 'pieces/' + (id && id !== 'cburnett' ? id + '/' : ''); }
  function pieceUrl(p) { return pieceDir() + R.colorOf(p) + p.toUpperCase() + '.svg'; }
  const imgUrl = (code) => 'url(' + pieceDir() + code + '.svg)';
  // the Shotgun King: the normal king of the piece set in use, with the gun drawn over him
  const skGunKing = (c, gun) => 'url(pieces/fairy/gun_' + (gun || 'solomon') + '.svg), url(' + pieceDir() + c + 'K.svg)';
  /* Fairy pieces have pictures of their own (pieces/fairy, Wikimedia Commons, see CREDITS.txt there).
     A glyph names its picture in the third slot, and the usual combinations get one by their parts. */
  const FAIRY_PAIRS = { BN: 'archbishop', NB: 'archbishop', RN: 'chancellor', NR: 'chancellor', QN: 'amazon', NQ: 'amazon', NK: 'centaur', KN: 'centaur', KP: 'commoner', NN: 'nightrider' };
  const fairyRole = (g) => (g ? g[2] || FAIRY_PAIRS[(g[0] || '') + (g[1] || '')] || null : null);
  const FAIRY_ROLES = ['amazon', 'archbishop', 'camel', 'centaur', 'champion', 'chancellor', 'commoner', 'dabbaba', 'dragon', 'elephant', 'ferz', 'giraffe', 'guard', 'nightrider', 'unicorn', 'wazir', 'wizard', 'zebra',
    'crusader', 'viking', 'berserker', 'bowman', 'catapult', 'sorcerer', 'manticore', 'gryphon', 'minotaur', 'hydra', 'phoenix', 'whelp', 'wyrm', 'cardinal', 'warwagon', 'pegasus', 'bladedancer', 'musketeer', 'templar', 'royalguard',
    'prince', 'immortal', 'assassin', 'firechick', 'egg', 'agentplus', 'agentx', 'agentl', 'agentstar', 'decoy', 'fool', 'infiltrator', 'marchingpawn', 'princess', 'leper', 'glassqueen', 'mirrorqueen', 'portalmage',
    'troll', 'trollleft', 'reaper', 'bannerman', 'gorgon', 'martyr', 'quartermaster', 'mountedking', 'general', 'tabitha', 'andromeda',
    'edea', 'unicorncavalry', 'oucentaur', 'golem', 'checker', 'checkerking', 'devil', 'demon', 'slime', 'blob', 'shotgunking'].concat(
    ['king', 'rook', 'dragon', 'bishop', 'horse', 'gold', 'silver', 'psilver', 'knight', 'pknight', 'lance', 'plance', 'pawn', 'tokin'].map((n) => 'shogi_' + n));

  /* ---------- data ---------- */

  const BOTS = [
    // only the Ouroboros Run sends it (the first stages): kept out of the New Game lists
    { id: 'b0', lv: 0, name: 'Beginner', elo: '100', skill: 0, fskill: -20, depth: 1, random: 0.7, hidden: true },
    { id: 'b1', lv: 1, name: 'Rookie', elo: '400', skill: 0, fskill: -14, depth: 1, random: 0.45 },
    { id: 'b2', lv: 2, name: 'Casual', elo: '800', skill: 0, fskill: -8, depth: 2, random: 0.15 },
    { id: 'b3', lv: 3, name: 'Club Player', elo: '1350', uciElo: 1350, ms: 400 },
    { id: 'b4', lv: 4, name: 'Tournament', elo: '1600', uciElo: 1600, ms: 500 },
    { id: 'b5', lv: 5, name: 'Expert', elo: '1900', uciElo: 1900, ms: 600 },
    { id: 'b6', lv: 6, name: 'Master', elo: '2200', uciElo: 2200, ms: 700 },
    { id: 'b7', lv: 7, name: 'Grandmaster', elo: '2500', uciElo: 2500, ms: 800 },
    { id: 'b8', lv: 8, name: 'Super GM', elo: '2850', uciElo: 2850, ms: 1000 },
    { id: 'b9', lv: 9, name: 'Machine', elo: '3190', uciElo: 3190, ms: 1200 },
    { id: 'max', lv: 'MAX', name: 'Stockfish Max', elo: '3600+', max: true },
    /* Personalities: the same engine held to a rating, but it picks among the engine's best few moves
       by taste. In a game with power-ups the power-up search chooses instead, so the taste is off there. */
    { id: 'nina', lv: 'N', name: 'Nina', elo: '1500', uciElo: 1500, ms: 500, style: 'attack', blurb: 'Goes for your king: checks, captures, sacrifices. Shaky in quiet positions.' },
    { id: 'gus', lv: 'G', name: 'Gus', elo: '1400', uciElo: 1400, ms: 450, style: 'gambit', blurb: 'Gives a pawn in the opening for open lines, then attacks.' },
    { id: 'otto', lv: 'O', name: 'Otto', elo: '1700', uciElo: 1700, ms: 600, style: 'solid', blurb: 'Keeps everything covered, trades when he can, never hurries.' },
    { id: 'lena', lv: 'L', name: 'Lena', elo: '1800', uciElo: 1800, ms: 600, style: 'clock', blurb: 'Strong, but falls apart with under a minute on the clock. Best with a time control.' },
    { id: 'rex', lv: 'R', name: 'Rex', elo: '2000', uciElo: 2000, ms: 700, style: 'endgame', blurb: 'Trades pieces at every chance and grinds out the endgame.' }
  ];
  // Gus's openings: a pawn for the initiative. As White the first list, as Black the second, in short notation.
  const GAMBITS = {
    w: ['e4 e5 f4', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4', 'd4 d5 c4', 'e4 c5 b4', 'e4 d5 exd5 Nf6 c4', 'd4 d5 e4', 'e4 e5 d4 exd4 c3', 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4'],
    b: ['d4 Nf6 c4 e5', 'e4 e5 Nf3 d5', 'd4 d5 c4 e5', 'e4 e5 Nf3 Nc6 Bc4 Nd4', 'e4 e5 Nf3 f5', 'd4 d5 c4 c5', 'e4 d5 d4 Nf6']
  };
  const botById = (id) => BOTS.find((b) => b.id === id) || BOTS[BOTS.length - 1];
  // In the variants the opponent is Fairy-Stockfish, which tops out lower.
  function botLabel(bot, fairy, ck) {
    if (ck) { // Checkers, Duck Chess: no Stockfish plays it here, the app's own engine plays at the bot's level
      const nm = typeof ck === 'string' ? ck : 'Checkers', e = bot.max ? '3000+' : bot.uciElo ? String(Math.min(bot.uciElo, 2850)) : bot.elo;
      return { name: bot.max ? nm + ' Engine Max' : bot.name, elo: e, tag: (bot.max ? '' : e + ', ') + 'own ' + nm.toLowerCase() + ' engine' };
    }
    if (!fairy) return { name: bot.name, elo: bot.elo, tag: bot.max ? bot.elo : bot.elo + ', Stockfish 19' };
    if (bot.max) return { name: 'Fairy-Stockfish Max', elo: '3000+', tag: '3000+' };
    const elo = bot.uciElo ? String(Math.min(bot.uciElo, 2850)) : bot.elo;
    return { name: bot.name, elo: elo, tag: elo + ', Fairy-Stockfish' };
  }
  // the personalities' pictures, by style: crossed swords, a gift (the gambit), a shield, a stopwatch, the finish flag
  const PERSONA_ICON = {
    attack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l10 10M4 4h4.5M4 4v4.5M20 4 10 14M20 4h-4.5M20 4v4.5M7.5 13.5l3 3M6 18l3-3M16.5 13.5l-3 3M18 18l-3-3"/></svg>',
    gambit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9.5" width="16" height="10.5" rx="1.5"/><path d="M3 9.5h18M12 9.5V20M12 9.5C10.5 6 7 5 6.5 7.3 6 9.3 9.5 9.5 12 9.5zM12 9.5c1.5-3.5 5-4.5 5.5-2.2.5 2-3 2.2-5.5 2.2z"/></svg>',
    solid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5M10 3h4M12 3v3.5M18.2 6.8l1.4-1.4"/></svg>',
    endgame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h13l-2.5 4.5L18 13H5"/></svg>'
  };
  // what stands in a bot's square: the level number, MAX, or a personality's picture
  const botFace = (b) => (b.style ? PERSONA_ICON[b.style] || b.lv : b.lv);
  const statKey = (kind, bot) => (kind === 'fairy' ? 'f:' : '') + bot.id;
  /* Your own rating, one per time control, from games against the bots without power-ups, and one for
     power-up games (any clock) where both sides have the same power-ups: with a set of your own only,
     the bot would be beaten by the power-ups, not by you. A bot is rated at the Elo it plays at, and your
     rating moves the usual way: big steps while it is new, smaller ones once it has settled. */
  const TIME_CLASSES = { untimed: 'Untimed', blitz: 'Blitz', rapid: 'Rapid' };
  const RATING_NAMES = Object.assign({ power: 'Power-ups' }, TIME_CLASSES);
  const powerSig = (pw) => (pw ? Object.keys(pw).filter((k) => pw[k] && k !== 'side' && k !== 'pw').sort().map((k) => k + '=' + pw[k]).join(',') : '');
  const samePowers = (g) => !!g.pw && powerSig(g.pw.w) === powerSig(g.pw.b);
  // the rating a game counts for, or null
  function ratingClass(game) {
    if (game.auto || game.local || !game.bot || game.hex) return null;
    if (game.B.powers) return samePowers(game) ? 'power' : null;
    return timeClass(game.spec.clock);
  }
  // the rating the game being set up would count for (the curve shown on the New Game tab)
  const setupRatingClass = () => (setup.powers && R.anyPower(setup.powers) ? 'power' : timeClass(setup.clock));
  const timeClass = (clock) => (!clock ? 'untimed' : clock < 600 ? 'blitz' : 'rapid');
  function botElo(game) {
    const b = game.bot;
    if (!b) return 0;
    if (b.max) return game.engine === 'fairy' ? 3000 : 3400;
    const lab = botLabel(b, game.engine === 'fairy');
    return parseInt(lab.elo, 10) || 1200;
  }
  function rateGame(game, res) {
    const cls = ratingClass(game), all = stats.rating = stats.rating || {};
    if (!cls) return game.B.powers && !game.auto && !game.local && game.bot && !game.hex ? '. Not rated: the bot did not have the same power-ups' : '';
    const r = all[cls] = all[cls] || { r: 1000, n: 0, log: [] };
    const score = res === 'w' ? 1 : res === 'd' ? 0.5 : 0, k = r.n < 20 ? 40 : 20;
    const delta = Math.round(k * (score - 1 / (1 + Math.pow(10, (botElo(game) - r.r) / 400))));
    r.r = Math.max(100, r.r + delta); r.n++;
    r.log.push([Date.now(), r.r]);
    if (r.log.length > 400) r.log.splice(0, r.log.length - 400);
    return (cls === 'power' ? '. Your power-up rating: ' : '. Your ' + TIME_CLASSES[cls].toLowerCase() + ' rating: ') + r.r + ' (' + (delta >= 0 ? '+' : '') + delta + ')';
  }
  // The rating box on the New Game tab: one number per time control and the curve of the last games.
  function renderRatings() {
    const box = $('#ratings'), all = stats.rating || {}, keys = Object.keys(RATING_NAMES).filter((k) => all[k]);
    if (!keys.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.style.display = '';
    let html = '<h3>Your ratings</h3><div class="pz-rating">' + keys.map((k) => '<div><small>' + RATING_NAMES[k] + '</small><b>' + all[k].r + '</b><small>' + all[k].n + (all[k].n === 1 ? ' game' : ' games') + '</small></div>').join('') + '</div>';
    const curCls = setupRatingClass(), cur = all[curCls];
    if (cur && cur.log.length >= 2) {
      const vals = cur.log.slice(-60).map((x) => x[1]), lo = Math.min.apply(null, vals) - 20, hi = Math.max.apply(null, vals) + 20;
      const pts = vals.map((v, i) => (i / (vals.length - 1) * 300).toFixed(1) + ',' + (70 - (v - lo) / (hi - lo) * 66 - 2).toFixed(1)).join(' ');
      html += '<svg class="pz-graph" viewBox="0 0 300 72" preserveAspectRatio="none"><polyline points="' + pts + '" fill="none" stroke="#81b64c" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>' +
        '<div class="pz-axis"><span>' + RATING_NAMES[curCls] + ', ' + Math.round(lo) + ' to ' + Math.round(hi) + '</span><span>last ' + vals.length + ' games</span></div>';
    }
    html += '<p class="sub">Games against the bots count, power-up games when the bot has the same power-ups. The bots are rated at the level they play.</p>';
    box.innerHTML = html;
  }
  const ENGINES = [
    { id: 'sf', name: 'Stockfish 19', desc: 'The strongest engine there is. Standard chess only, and no impossible armies.' },
    { id: 'fairy', name: 'Fairy-Stockfish', desc: 'Plays every variant, every board and any position. A little weaker.' }
  ];

  const POWERS = [
    { id: 'double', name: 'Double Move', icon: 'wP', badge: 'x2',
      desc: 'You play two moves every turn. If your first move gives check, the turn ends right there.',
      opt: 'double', opts: [[2, '2 moves per turn'], [3, '3 moves per turn']] },
    { id: 'snipers', name: 'Snipers', one: 'Sniper', icon: 'wB', skin: 'camo', first: 'sniper',
      desc: 'The pieces you pick can shoot anything they attack without leaving their square. A shot uses your move. On the board a sniper has a vine wound around it. All gives it to every piece there is: kings, pawns, fairy, Ouroboros and checkers pieces.',
      multi: [['sniperP', 'Pawns', 'P'], ['archer', 'Knights', 'N'], ['sniper', 'Bishops', 'B'], ['sniperR', 'Rooks', 'R'], ['sniperQ', 'Queens', 'Q'], ['sniperK', 'King', 'K'], ['sniperAll', 'All pieces', '*'], ['sniperNP', 'All but pawns', '-']] },
    { id: 'midas', name: 'Midas Touch', icon: 'wQ', gold: true,
      desc: 'Turn an enemy piece you could take into a gold statue, as long as taking it would not leave your king in check. A statue never moves, cannot be captured and gives no check, it only stands in the way. A free action on top of your move, or with Uses turn the gild is your move.',
      opt: 'midasPerTurn', opts: [[1, 'Once per turn'], [0, 'Unlimited'], [-1, 'Uses turn']] },
    { id: 'freeze', name: 'Freeze Ray', icon: 'bR', ice: true,
      desc: 'Once per turn, freeze any enemy piece except the king. It cannot move on the engine\'s next turn. Free action, does not use your move.' },
    { id: 'dragon', name: 'Dragon Knights', icon: 'wN', fairy: 'dragon', badge: '+B',
      desc: 'Your knights also move like bishops.' },
    { id: 'amazon', name: 'Amazon Queen', icon: 'wQ', fairy: 'amazon', badge: '+N',
      desc: 'Your queen also jumps like a knight.' },
    { id: 'rocket', name: 'Rocket Pawns', icon: 'wP', badge: '>>',
      desc: 'Your pawns run forward as far as the way is clear, all the way to promotion in one move.' },
    { id: 'explosive', name: 'Explosive Captures', icon: 'wR',
      desc: 'When you capture, every enemy piece next to the captured one is destroyed too. Kings survive the blast.' },
    { id: 'drops', name: 'Reinforcements', icon: 'bN',
      desc: 'Pieces you capture switch sides. Instead of moving you can drop one on any empty square. Against Stockfish 19 your army has to stay one a real game could produce: at most 8 pawns, and every extra piece needs a missing pawn. Fairy-Stockfish has no such limit.' },
    { id: 'portals', name: 'Portals', icon: 'wK',
      desc: 'Place two portals on your turn. A piece of yours that lands on one comes out at the other.' },
    { id: 'immortal', name: 'Immortal Queen', icon: 'wQ', badge: '\u221e',
      desc: 'Your queen cannot be captured. The engine may attack her all it wants, it can never take her.' },
    { id: 'storm', name: 'Pawn Storm', icon: 'wP', badge: 'all',
      desc: 'As your move, every pawn of yours that has room steps one square forward at the same time.' },
    { id: 'timestop', name: 'Time Stop', icon: 'wK', badge: '+2',
      desc: 'Once per game, play three moves in a row. A check still ends your turn.' },
    { id: 'veto', name: 'Veto', icon: 'bK', badge: 'x3',
      desc: 'Three times per game, reject the move the engine just played. It has to take it back and play something else.' },
    { id: 'puppet', name: 'Puppet Master', icon: 'bP', badge: 'x1',
      desc: 'Once per game, you choose the engine\'s next move for it.' },
    { id: 'rampage', name: 'Rampage', icon: 'wN', badge: '+1',
      desc: 'Every capture earns you another move right away. A check still ends the turn.' },
    { id: 'bodyguard', name: 'Bodyguard', icon: 'wK',
      desc: 'Pieces standing next to your king cannot be captured.' },
    { id: 'earlypromo', name: 'Fast Promotion', icon: 'wP', badge: '6th',
      desc: 'Your pawns promote two ranks early, on the sixth rank. In variants the pawn turns into a queen on its own.' },
    { id: 'ghosts', name: 'Ghosts', one: 'Ghost', icon: 'wR', skin: 'ghost', first: 'ghost',
      desc: 'The pieces you pick move and attack straight through your own pieces. Ghosts are half transparent on the board.',
      multi: [['ghostB', 'Bishops', 'B'], ['ghost', 'Rooks', 'R'], ['ghostQ', 'Queens', 'Q'], ['ghostAll', 'All pieces', '*'], ['ghostNP', 'All but pawns', '-']] },
    { id: 'iron', name: 'Iron Pawns', icon: 'wP', badge: 'Fe',
      desc: 'Your pawns can only be captured by pawns. Pieces bounce off them, and explosions leave them standing.' },
    { id: 'swap', name: 'Royal Swap', icon: 'wK', badge: '<>',
      desc: 'As your move, the king changes places with one of your rooks, wherever the two stand. Not into check.' },
    { id: 'turncoat', name: 'Turncoat', icon: 'bQ', badge: 'x1',
      desc: 'Once per game, an enemy piece of your choice joins your side. Never the king, and never a piece that would give check at once. Free action, does not use your move. Against Stockfish 19 your army has to stay one a real game could produce, so a piece can only join once you are a pawn down. Fairy-Stockfish has no such limit.' },
    { id: 'shield', name: 'Shield', icon: 'wR', badge: '\u26e8',
      desc: 'Once per turn, shield one of your pieces (not the king): it cannot be captured, shot or blown up on the other side\'s next turn. Free action, does not use your move.' },
    { id: 'tempo', name: 'Tempo', icon: 'wK', badge: 'x2',
      desc: 'Twice per game you may pass: skip your move, and the other side has to move again. Not while in check. Strongest in the endgame, where having to move can lose.' },
    { id: 'helmet', name: 'Spiked Helmet', icon: 'wN', wear: 'helmet', first: ['helmetP', 'helmetN', 'helmetB', 'helmetR', 'helmetQ'],
      multi: [['helmetP', 'Pawns', 'P'], ['helmetN', 'Knights', 'N'], ['helmetB', 'Bishops', 'B'], ['helmetR', 'Rooks', 'R'], ['helmetQ', 'Queens', 'Q'], ['helmetAll', 'All pieces', '*'], ['helmetNP', 'All but pawns', '-']],
      desc: 'Your pieces wear a spiked helmet. A capture of a helmeted piece bounces off: the helmet breaks, both pieces stay where they are, the attacker\'s move is used (a shot\'s too) and the attacker is frozen on its next turn. A blast only breaks the helmet. Kings wear none. In the board editor it goes on single pieces of either colour.' },
    { id: 'vest', name: 'Explosive Vest', icon: 'wN', wear: 'vest', first: ['vestN', 'vestB', 'vestR', 'vestQ'],
      multi: [['vestP', 'Pawns', 'P'], ['vestN', 'Knights', 'N'], ['vestB', 'Bishops', 'B'], ['vestR', 'Rooks', 'R'], ['vestQ', 'Queens', 'Q'], ['vestAll', 'All pieces', '*'], ['vestNP', 'All but pawns', '-']],
      desc: 'Your pieces wear an explosive vest. Instead of moving, a piece can go up: it and every piece in the 3 x 3 square around it are destroyed, your own as well. Kings, statues and what is safe from blasts survive, and a helmet takes the blast. Double-click the piece, or select it and press Detonate. Kings wear none.' }
  ];
  const POWER_KEYS = ['sniper', 'midas', 'freeze', 'dragon', 'amazon', 'rocket', 'explosive', 'drops', 'portals', 'immortal', 'storm', 'timestop', 'veto', 'puppet', 'rampage', 'bodyguard', 'earlypromo', 'ghost', 'archer', 'iron', 'swap', 'turncoat', 'sniperP', 'sniperR', 'sniperQ', 'sniperK', 'ghostB', 'ghostQ', 'sniperAll', 'shield', 'tempo', 'helmet', 'vest', 'sniperNP', 'ghostNP', 'ghostAll',
    'helmetP', 'helmetN', 'helmetB', 'helmetR', 'helmetQ', 'helmetAll', 'helmetNP', 'vestP', 'vestN', 'vestB', 'vestR', 'vestQ', 'vestAll', 'vestNP'];
  const HUMAN_ONLY = ['veto', 'puppet', 'portals']; // a bot cannot be handed these
  // A card on the Power-ups tab is one power-up, or several of a kind (snipers, ghosts) with a flag per piece type.
  const CARD = {}, POWER_LIST = [];
  POWERS.forEach((p) => {
    CARD[p.id] = p;
    const GROUP = { sniperAll: 'Snipers on all pieces', sniperNP: 'Snipers on all but pawns', ghostAll: 'Ghosts on all pieces', ghostNP: 'Ghosts on all but pawns',
      helmetAll: 'Helmets on all pieces', helmetNP: 'Helmets on all but pawns', vestAll: 'Vests on all pieces', vestNP: 'Vests on all but pawns' };
    // a wearable upgrade by kind: "Pawns with helmets", "Knights with vests"
    if (p.multi) p.multi.forEach((m) => POWER_LIST.push({ key: m[0], name: GROUP[m[0]] || (p.wear ? m[1] + ' with ' + p.wear + 's' : p.one + ' ' + m[1]) }));
    else POWER_LIST.push({ key: p.id, name: p.name });
  });
  const flagOn = (pw, key) => (key === 'double' ? pw.double > 0 : !!pw[key]);
  const powerOn = (pw, id) => (CARD[id] && CARD[id].multi ? CARD[id].multi.some((m) => !!pw[m[0]]) : flagOn(pw, id));
  const SNIPER_KINDS = ['sniperP', 'archer', 'sniper', 'sniperR', 'sniperQ', 'sniperK'];
  // Snipers for all pieces is one entry, not seven
  const WEAR_KINDS = (w) => ['P', 'N', 'B', 'R', 'Q'].map((k) => w + k);
  const powerNames = (pw) => (pw ? POWER_LIST.filter((x) => flagOn(pw, x.key) && !(pw.sniperAll && SNIPER_KINDS.indexOf(x.key) >= 0) &&
    !(pw.helmetAll && WEAR_KINDS('helmet').indexOf(x.key) >= 0) && !(pw.vestAll && WEAR_KINDS('vest').indexOf(x.key) >= 0)).map((x) => x.name)
    .concat(pw.helmet ? ['Spiked Helmet'] : [], pw.vest ? ['Explosive Vest'] : []) : []); // helmet/vest: the old levels (puzzles, saved games)
  /* Skins: every piece image once more as a sniper and as a statue. They are painted on a canvas at
     start and kept as images, which is steadier than blending layers on the board.
     A sniper keeps its normal look and gets a vine wound around it, with a few leaves that reach
     past its outline. A statue is the piece turned to gold and a frozen piece the piece turned to ice: the
     white drawing of the piece is tinted with a gold or an ice-blue gradient (multiplied, so its lines stay),
     ice also gets a frosty shine. Black uses the same white drawing in a darker shade of gold or blue, so a
     black statue looks just like a white one, only deeper, and the sides stay apart. A frozen sniper keeps
     its vine (icecamo, goldcamo for a statue), a ghost keeps its see-through style on top of the ice or gold.
     (The sniper skin is still called "camo" in the code.) */
  const SKIN = { camo: {}, gold: {}, ice: {}, icecamo: {}, goldcamo: {}, ready: false };
  const TINTS = {
    gold: { w: [[0, '#fff6c4'], [0.35, '#ffdc55'], [0.68, '#f3b300'], [1, '#cf8e00']], b: [[0, '#e0b347'], [0.38, '#b8861a'], [0.72, '#8c5e06'], [1, '#5c3c00']] },
    ice: { w: [[0, '#f4fcff'], [0.3, '#b8e8ff'], [0.65, '#6cc4f4'], [1, '#2f8fd6']], b: [[0, '#8cc4ee'], [0.35, '#4a8fd0'], [0.7, '#2364a8'], [1, '#0f3a70']] }
  };
  function buildSkins() {
    const size = 192, codes = [];
    'wb'.split('').forEach((c) => 'PNBRQK'.split('').forEach((t) => codes.push(c + t)));
    // the fairy pieces get a statue too (code w_amazon and so on)
    'wb'.split('').forEach((c) => FAIRY_ROLES.forEach((r) => codes.push(c + '_' + r)));
    const canvas = () => { const cv = document.createElement('canvas'); cv.width = cv.height = size; return cv; };
    const gold = (stops) => {
      const cv = canvas(), x = cv.getContext('2d'), g = x.createLinearGradient(size * 0.2, 0, size * 0.8, size);
      stops.forEach((st) => g.addColorStop(st[0], st[1]));
      x.fillStyle = g; x.fillRect(0, 0, size, size);
      return cv;
    };
    // the white drawing of a piece tinted: the gradient is multiplied in where the piece is, ice gets a shine on top
    const tint = (img, stops, shine) => {
      const cv = canvas(), x = cv.getContext('2d'), over = canvas(), o = over.getContext('2d');
      x.drawImage(img, 0, 0, size, size);
      const g = o.createLinearGradient(size * 0.2, 0, size * 0.8, size);
      stops.forEach((st) => g.addColorStop(st[0], st[1]));
      o.fillStyle = g; o.fillRect(0, 0, size, size);
      o.globalCompositeOperation = 'destination-in'; // the colour only where the piece is
      o.drawImage(img, 0, 0, size, size);
      x.globalCompositeOperation = 'multiply';
      x.drawImage(over, 0, 0);
      if (shine) {
        // frost: a pale sheen from the top left and a bright streak across, only on the piece
        const sh = canvas(), so = sh.getContext('2d'), lg = so.createLinearGradient(0, 0, size, size);
        lg.addColorStop(0, 'rgba(255,255,255,' + shine + ')'); lg.addColorStop(0.38, 'rgba(255,255,255,0)');
        lg.addColorStop(0.44, 'rgba(255,255,255,' + shine * 0.9 + ')'); lg.addColorStop(0.5, 'rgba(255,255,255,0)');
        so.fillStyle = lg; so.fillRect(0, 0, size, size);
        so.globalCompositeOperation = 'destination-in';
        so.drawImage(img, 0, 0, size, size);
        x.globalCompositeOperation = 'screen';
        x.drawImage(sh, 0, 0);
      }
      x.globalCompositeOperation = 'source-over';
      return cv;
    };

    /* A vine around the piece. The outline of the piece is read from its picture, and the vine runs in
       two or three slanted turns from the left edge up to the right edge, as if it went round the back
       in between. Both ends of every turn stick out a little, and so do some of the leaves. */
    const vine = (x, img, seed) => {
      const probe = canvas(), pc = probe.getContext('2d');
      pc.drawImage(img, 0, 0, size, size);
      let data;
      try { data = pc.getImageData(0, 0, size, size).data; } catch (e) { return; }
      const edge = (y) => {
        let l = -1, r = -1;
        const row = Math.max(0, Math.min(size - 1, Math.round(y))) * size * 4;
        for (let k = 0; k < size; k++) if (data[row + k * 4 + 3] > 60) { if (l < 0) l = k; r = k; }
        return l < 0 ? null : [l, r];
      };
      let top = 0, bot = size - 1;
      while (top < size && !edge(top)) top++;
      while (bot > 0 && !edge(bot)) bot--;
      if (bot - top < 40) return;
      let sd = seed;
      const rnd = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
      const at = (f) => top + (bot - top) * f;
      const bez = (p, t) => {
        const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        const px = a * p[0] + b * p[2] + c * p[4] + d * p[6], py = a * p[1] + b * p[3] + c * p[5] + d * p[7];
        const tx = 3 * u * u * (p[2] - p[0]) + 6 * u * t * (p[4] - p[2]) + 3 * t * t * (p[6] - p[4]);
        const ty = 3 * u * u * (p[3] - p[1]) + 6 * u * t * (p[5] - p[3]) + 3 * t * t * (p[7] - p[5]);
        return [px, py, Math.atan2(ty, tx)];
      };
      const leaf = (px, py, ang, len) => {
        x.save();
        x.translate(px, py); x.rotate(ang);
        x.beginPath();
        x.moveTo(0, 0);
        x.quadraticCurveTo(len * 0.45, -len * 0.42, len, 0);
        x.quadraticCurveTo(len * 0.45, len * 0.42, 0, 0);
        x.closePath();
        x.fillStyle = '#5c9e3c'; x.strokeStyle = '#1f3c16'; x.lineWidth = 2.2; x.lineJoin = 'round';
        x.fill(); x.stroke();
        x.beginPath(); x.moveTo(len * 0.12, 0); x.lineTo(len * 0.82, 0);
        x.strokeStyle = '#a4d66e'; x.lineWidth = 1.4; x.stroke();
        x.restore();
      };
      // the turns, from the bottom up: where each one starts on the left and ends on the right
      const turns = [[0.80, 0.60], [0.47, 0.29]];
      x.lineCap = 'round';
      turns.forEach((tr, n) => {
        const e0 = edge(at(tr[0])), e1 = edge(at(tr[1]));
        if (!e0 || !e1) return;
        const out = 5 + rnd() * 3, x0 = e0[0] - out, y0 = at(tr[0]), x1 = e1[1] + out, y1 = at(tr[1]), dx = x1 - x0;
        const p = [x0, y0, x0 + dx * 0.32, y0 + 13, x1 - dx * 0.32, y1 - 5, x1, y1]; // a slack S, not a ruler line
        x.save();
        x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = 3; x.shadowOffsetY = 2;
        x.beginPath(); x.moveTo(p[0], p[1]); x.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]);
        x.strokeStyle = '#1f3c16'; x.lineWidth = 6.4; x.stroke();
        x.restore();
        x.beginPath(); x.moveTo(p[0], p[1]); x.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]);
        x.strokeStyle = '#4c8733'; x.lineWidth = 3.2; x.stroke();
        // a leaf at each end, outside the piece, and one on the way
        [0.02, 0.5, 0.98].forEach((t, k) => {
          const q = bez(p, t), side = (k + n) % 2 ? 1 : -1;
          const ang = t < 0.05 ? q[2] + Math.PI + 0.55 * side : t > 0.95 ? q[2] - 0.55 * side : q[2] + side * (0.95 + rnd() * 0.3);
          leaf(q[0], q[1], ang, 18 + rnd() * 5);
        });
      });
    };

    const turned = (img) => { const cv = canvas(), x = cv.getContext('2d'); x.translate(size, size); x.rotate(Math.PI); x.drawImage(img, 0, 0, size, size); return cv; };
    let left = codes.length;
    codes.forEach((code, idx) => {
      const img = new Image();
      img.onload = () => {
        // statue and ice, for both colours, from the white drawing (the black code's own picture only gets its vine)
        if (code[0] === 'w') ['w', 'b'].forEach((c) => {
          // a shogi piece points at the other side: Black's statue and ice are the white drawing turned round
          const src = c === 'b' && code.indexOf('_shogi') > 0 ? turned(img) : img;
          const bc = c + code.slice(1), gcv = tint(src, TINTS.gold[c], 0), icv = tint(src, TINTS.ice[c], c === 'w' ? 0.55 : 0.4);
          try {
            SKIN.gold[bc] = gcv.toDataURL('image/png');
            SKIN.ice[bc] = icv.toDataURL('image/png');
            vine(icv.getContext('2d'), src, 17 + idx % 6 * 31); // the same vine as the sniper skin below
            SKIN.icecamo[bc] = icv.toDataURL('image/png');
            vine(gcv.getContext('2d'), src, 17 + idx % 6 * 31); // a statue keeps its vine too
            SKIN.goldcamo[bc] = gcv.toDataURL('image/png');
          } catch (e) { /* the plain piece stays */ }
        });
        // sniper: the piece as it is, a little smaller so the leaves have room, with the vine on top
        const sv = canvas(), sx = sv.getContext('2d');
        sx.drawImage(img, 0, 0, size, size);
        vine(sx, img, 17 + idx % 6 * 31);
        try { SKIN.camo[code] = sv.toDataURL('image/png'); } catch (e) { /* the plain piece stays */ }
        if (--left === 0) { SKIN.ready = true; renderPowers(); renderAll(); }
      };
      img.onerror = () => { if (--left === 0) { SKIN.ready = true; renderAll(); } };
      img.src = code.indexOf('_') > 0 ? fairyPic(code[0], code.slice(2)) : pieceDir() + code + '.svg';
    });
  }
  const skinUrl = (kind, code) => (SKIN[kind][code] ? 'url(' + SKIN[kind][code] + ')' : imgUrl(code));
  // How a piece is dressed: a vine for a sniper, a see-through look for a ghost.
  function skinOf(t, pw) {
    let cls = '';
    if (pw.sniperAll) cls += ' camo'; // Snipers for all pieces: every piece wears the vine
    else if (t === 'b' ? pw.sniper : t === 'n' ? pw.archer : t === 'r' ? pw.sniperR : t === 'q' ? pw.sniperQ : t === 'p' ? pw.sniperP : t === 'k' ? pw.sniperK : false) cls += ' camo';
    if (t === 'r' ? pw.ghost : t === 'b' ? pw.ghostB : t === 'q' ? pw.ghostQ : false) cls += ' ghost';
    return cls;
  }
  // The power-ups of one side: games on the standard rules carry a set per colour.
  const pwOf = (cfg, c) => (cfg.pw ? cfg.pw[c] : (c === cfg.side ? cfg : null));
  // Standard chess and Dice Chess run on the built-in rules, everything else on Fairy-Stockfish.
  const stdVariant = (id) => id === 'chess' || id === 'dice' || id === 'dice3' || id === 'duck';
  const isCheckers = (id) => id === 'checkers'; // the game of Checkers: rules.js and the app's own engine, its own start, no power-ups
  // a board with nothing but checkers men and kings on it: Checkers is played from it (an editor board or a preset)
  // Checkers rules for the game being set up: the Checkers variant, or a board of only checkers pieces in a normal game
  const ckRules = () => isCheckers(setup.variant) || (setup.variant === 'chess' && checkersBoard(setup.fen));
  // the variants only the app's own engine plays: their name for the bot's label, or null
  const ownName = () => (ckRules() ? 'Checkers' : setup.variant === 'duck' ? 'Duck Chess' : null);
  const checkersBoard = (fen) => { try { const b = R.fromFen(fen).board; return b.some(Boolean) && b.every((p) => !p || p === 'є' || p === 'Є' || p === 'ї' || p === 'Ї'); } catch (e) { return false; } };
  const DIE_NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

  const PRESETS = [
    ['Starting position', R.START_FEN],
    ['Black without queen', 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
    ['Black without rooks', '1nbqkbn1/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1'],
    ['White without queen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1'],
    ['White queen army', 'rnbqkbnr/pppppppp/8/8/8/8/3QQ3/QQQQKQQQ w kq - 0 1'],
    ['White knight army', 'rnbqkbnr/pppppppp/8/8/8/8/2NNNN2/NNN1KNNN w kq - 0 1'],
    ['Pawns only', '4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1'],
    ['King and queen against everything', 'rnbqkbnr/pppppppp/8/8/8/8/8/3QK3 w kq - 0 1'],
    ['Queen against rook endgame', '8/8/8/3k4/3r4/8/2Q5/2K5 w - - 0 1'],
    ['Rook endgame, Lucena', '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1']
  ];
  /* The preset browser in the board editor: chess positions (PRESETS above), standard armies on terrain, armies
     and boss fights from The Ouroboros King (they switch king capture on, the game's own rules) and terrain alone
     for the pieces already on the board. Squares of terrain are given by name. */
  const BOARD_PRESETS = [
    { g: 'chess', n: "Lakes on the wings", d: "Water on both wings of the middle ranks: sliders stop at the shore.", f: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', t: { walls: [], water: ["a4","b4","a5","b5","g4","h4","g5","h5"], portals: [] } },
    { g: 'chess', n: "Boulder field", d: "Four boulders in the centre: nothing passes them.", f: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', t: { walls: ["d4","e5","c5","f4"], water: [], portals: [] } },
    { g: 'chess', n: "River with two fords", d: "A river across the board, crossable on the c and f files without stopping.", f: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', t: { walls: [], water: ["a4","b4","d4","e4","g4","h4","a5","b5","d5","e5","g5","h5"], portals: [] } },
    { g: 'chess', n: "Twin gates", d: "Fixed teleporters on c4 and f5: land on one, come out at the other.", f: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', t: { walls: [], water: [], portals: ["c4","f5"] } },
    { g: 'chess', n: "Canyon", d: "Boulder walls on the d and e files split the board in two.", f: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', t: { walls: ["d3","d4","e5","e6"], water: ["e3","d6"], portals: [] } },
    { g: 'chess', n: "Islands", d: "A lake in the middle with a boulder on it and gates on the wings.", f: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', t: { walls: ["d4","e5"], water: ["d5","e4","c4","f5"], portals: ["a5","h4"] } },
    { g: 'ouroboros', s: 'small', n: "The first battle", d: "A small start: the king with a knight, a bishop and a rook.", f: 'r1bk2n1/8/8/8/8/8/8/1N2KB1R w - - 0 1', t: { walls: ["d4","e5"], water: ["c5","f4"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'small', n: "Scouts", d: "A small band: an infiltrator on the rim, an assassin and a bowman.", f: '4kv1г/7ρ/8/8/8/8/Ρ7/Г1VK4 w - - 0 1', t: { walls: ["c4","f5","e4","d5"], water: ["b6","g3"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'small', n: "Corner keep", d: "Both armies start in a corner, the king walled in by its guard.", f: '5vξk/5nso/8/8/8/8/OSN5/KΞV5 w - - 0 1', t: { walls: ["d5","e4"], water: ["c6","f3","f6","c3"], portals: ["a8","h1"] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "Mounted charge", d: "Upgraded kings on horseback, with pegasus riders, unicorn cavalry and centaurs.", f: '1ђ1эћ1κ1/2p2p2/8/8/8/8/2P2P2/1Κ1ЋЭ1Ђ1 w - - 0 1', t: { walls: [], water: ["a4","h5","b4","g5","g4","b5","h4","a5"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "The shield wall", d: "Generals in place of kings, behind vikings and berserkers.", f: '2t1юv2/3sts2/8/8/8/8/2STS3/2VЮ1T2 w - - 0 1', t: { walls: ["c5","f4","f5","c4"], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "Spy games", d: "Four agents a side, changing shape with every move.", f: 'φψχkω3/2ppp1p1/8/8/8/8/3PPP1P/3ΩKΧΨΦ w - - 0 1', t: { walls: [], water: [], portals: ["c4","f5"] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "The royal court", d: "Prince, princess, royal guard and a glass queen on both sides.", f: '1ξοkиж2/8/8/8/8/8/8/2ЖИKΟΞ1 w - - 0 1', t: { walls: [], water: ["a4","h5","a5","h4","b4","g5"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "Mythic beasts", d: "Manticore, gryphon and minotaur against the same.", f: '1β1kγα2/2p2p2/8/8/8/8/2P2P2/2ΑΓK1Β1 w - - 0 1', t: { walls: ["d3","e6","d4","e5"], water: ["e3","d6"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "Portal maze", d: "Portal mages that jump anywhere, and two gates.", f: '1лbk2лr/8/8/8/8/8/8/RЛ2KBЛ1 w - - 0 1', t: { walls: ["d4","e5"], water: [], portals: ["a4","h5"] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "Troll bridge", d: "Trolls on both banks of a river that is dry only in the middle.", f: '1bфk1пb1/8/8/8/8/8/8/1NП1KФB1 w - - 0 1', t: { walls: [], water: ["a4","h5","b4","g5","c4","f5","f4","c5","g4","b5","h4","a5"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "Assassins at night", d: "Assassins, a blade dancer and a decoy against royal guards and musketeers.", f: '2ξ1k3/1μ4μ1/8/8/8/8/8/2ΡΛKБΡ1 w - - 0 1', t: { walls: ["c4","f5","d6"], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "Dragon's nest", d: "Eggs, a whelp, a dragon and fire birds against vikings and a bowman.", f: '1τζηkυε1/3ζ4/8/8/8/8/8/1VSTKS2 w - - 0 1', t: { walls: [], water: ["d5","e5","d4","e4"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "The gorgon's lair", d: "A gorgon, a reaper and a martyr against guns, a catapult and a golem.", f: '2цшk3/1щ2p1з1/8/8/8/8/8/XГ1ЪK1Μ1 w - - 0 1', t: { walls: ["b5","g4"], water: ["e5"], portals: [] }, kc: true, sp: [12, 16, 12] }, // sp: balanced by self-play (white wins, black wins, draws), the search misjudges martyr blasts
    { g: 'ouroboros', s: 'army', n: "The crusade", d: "Crusaders, a templar and a cardinal against vikings and berserkers.", f: '1s1sk1s1/2t2t2/8/8/8/8/8/1O1ΝKΘO1 w - - 0 1', t: { walls: ["e4","d5"], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "The plague", d: "Lepers and martyrs against marching pawns and quartermasters.", f: '2з1kз2/1щ1з2щ1/8/8/8/8/Д1Д2Д1Д/1Ы1NK1Ы1 w - - 0 1', t: { walls: [], water: ["a5","h4"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "The siege", d: "A corner fortress of catapults and bowmen against war wagons and a mounted king.", f: '5vxk/6μμ/8/8/8/8/3S1S2/2Ι1Э1Ι1 w - - 0 1', t: { walls: ["e6","f5","g4"], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'boss', n: "Edea, the Witch Queen", d: "The first witch with her agents and mages, against a hero army.", f: '1yφёkχл1/8/8/8/8/8/4P3/ONΡΟKBR1 w - - 0 1', fp: '1yφёkχл1/8/8/8/8/8/3P4/ONΡΟKBR1 w - - 0 1', t: { walls: ["c5","f4"], water: [], portals: ["a5","h4"] }, kc: true },
    { g: 'ouroboros', s: 'boss', n: "Tabitha the Deceptive", d: "The witch that moves like your own army, with fools, decoys and a leper.", f: '1вбяkзз1/8/8/8/8/8/8/R1S1KO1R w - - 0 1', t: { walls: ["d4","e5"], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'boss', n: "Andromeda of the Stars", d: "The last witch and her beasts of the night sky, against riders and a mounted king.", f: '1δαьkβ2/8/8/8/8/8/P2Д1P2/1ΚΘΙЭΝΚ1 w - - 0 1', t: { walls: [], water: ["c4","f5"], portals: ["a6","h3"] }, kc: true },
    { g: 'ouroboros', s: 'boss', n: "Edea's ambush", d: "The Witch Queen with one agent at her side, against a small band of heroes.", f: '3ёkχ2/8/8/8/8/8/P7/1N1ΡKBR1 w - - 0 1', t: { walls: ["d5","e4"], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'boss', n: "Tabitha alone", d: "Tabitha the Deceptive and a fool. She moves like whatever you bring, so bring little.", f: '2вяk3/8/8/8/8/8/8/2SNKO2 w - - 0 1', t: { walls: ["c5"], water: ["f4"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'boss', n: "Andromeda's hunt", d: "Andromeda and one manticore against a mounted king and his riders.", f: '3ьkα2/8/8/8/8/8/5P2/1Κ1ΘЭ1Κ1 w - - 0 1', fp: '3ьkα2/8/8/8/8/8/2P2P2/1Κ1ΘЭ1Κ1 w - - 0 1', t: { walls: [], water: ["c5","f4"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'boss', n: "The golem awakens", d: "A golem that only moves to take, with two eggs, against a light party.", f: '2υъkυ2/3p4/8/8/8/8/8/2S1KB2 w - - 0 1', t: { walls: ["b5","g5"], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'boss', n: "Hydra of the marsh", d: "A hydra in a marsh full of water, against archers and a viking.", f: '3δk3/8/8/8/8/8/8/2VSK3 w - - 0 1', fp: '3δk3/8/8/8/8/8/4S3/2V1K3 w - - 0 1', t: { walls: [], water: ["c4","d5","e4","f5","b6","g3"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'boss', n: "The dragon", d: "A dragon and its whelp against two vikings and a bowman.", f: '3ηk3/3ζ4/8/8/8/8/8/2S1KS2 w - - 0 1', t: { walls: ["d4"], water: ["e5"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'boss', n: "The reaper's field", d: "A reaper alone against birds that come back and a leper.", f: '3цk3/2p5/8/8/8/8/8/2ΤЗK3 w - - 0 1', t: { walls: ["c5","f4"], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'boss', n: "The gorgon queen", d: "A gorgon and a mirror queen against a band that must not stand still.", f: '2йшk3/8/8/8/8/8/8/1Κ1OKΡΡ1 w - - 0 1', t: { walls: ["e5"], water: ["d4"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'small', n: "Duel of blades", d: "An assassin and a blade dancer each: every capture brings another move.", f: '2λk1ρ2/8/8/8/8/8/8/2Ρ1KΛ2 w - - 0 1', t: { walls: ["d4","e5"], water: ["c5","f4"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'small', n: "Riders' errand", d: "A pegasus rider and a knight each, on an open field with a lake.", f: '1n1k2κ1/8/8/8/8/8/8/1Κ2K1N1 w - - 0 1', t: { walls: [], water: ["d4","e5","e4","d5"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'small', n: "Handover", d: "Two agents each, changing shape with every move.", f: '2ψk2φ1/8/8/8/8/8/8/1Φ2KΨ2 w - - 0 1', t: { walls: ["c4","f5"], water: [], portals: ["a5","h4"] }, kc: true },
    { g: 'ouroboros', s: 'small', n: "The royal pair", d: "Generals instead of kings, each with a prince and a princess.", f: '2жюο3/8/8/8/8/8/8/3ΟЮЖ2 w - - 0 1', t: { walls: ["d5","e4"], water: ["c4","f5"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'small', n: "Plague cart", d: "A leper, a martyr and a quartermaster each.", f: '2щk1з2/4ы3/8/8/8/8/3Ы4/2З1KЩ2 w - - 0 1', t: { walls: [], water: ["b5","g4","g5","b4"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'small', n: "Corner duel", d: "Two kings in opposite corners with a war wagon and a catapult each.", f: '6ιk/7x/8/8/8/8/X7/KΙ6 w - - 0 1', t: { walls: ["d4","e5"], water: [], portals: [] }, kc: true },
    /* every board size the editor offers, classical, fairy and Ouroboros armies: generated by tools/make_size_presets.js */
    { g: 'chess', s: 'huge', n: "Two lines", d: "A second rank of knights and bishops behind the pawns.", f: 'rnbqkbnr/nbnbbnbn/pppppppp/8/8/PPPPPPPP/NBNBBNBN/RNBQKBNR w - - 0 1', t: { walls: [], water: [], portals: [] } },
    { g: 'chess', s: 'army', n: "Pawn chain", d: "Every pawn has a twin in front of it.", f: 'rnbqkbnr/pppppppp/pppppppp/8/8/PPPPPPPP/PPPPPPPP/RNBQKBNR w - - 0 1', t: { walls: [], water: [], portals: [] } },
    { g: 'chess', s: 'army', n: "Ten files", d: "The normal army stretched to ten files, with a second pair of rooks.", f: 'rnbrqkrbnr/pppppppppp/10/10/10/10/10/10/PPPPPPPPPP/RNNRQKRBNR w - - 0 1', t: { walls: [], water: ["a6", "a5", "j6", "j5", "c6", "c5", "h6", "h5", "d6", "d5", "g6", "g5", "f6", "f5", "e6", "e5", "i6", "i5", "b6", "b5"], portals: [] } },
    { g: 'chess', s: 'huge', n: "Grand battalion", d: "Two full ranks of pieces and a pawn wall.", f: 'rnbrqkrbnr/nbbnqqnbbn/pppppppppp/10/10/10/10/PPPPPPPPPP/NBBNQQNBBN/RNBRQKRBNR w - - 0 1', t: { walls: ["i6", "i5", "b6", "b5"], water: [], portals: [] } },
    { g: 'chess', s: 'army', n: "Twelve files", d: "Three rooks a side and a queen on each wing.", f: 'rnbqbrkbqbnr/pppppppppppp/12/12/12/12/12/12/12/12/PPPPPPPPPPPP/RNBQBRKBQBNR w - - 0 1', t: { walls: ["e9", "e4", "h9", "h4", "a8", "a5", "l8", "l5"], water: [], portals: ["i7", "i6"] } },
    { g: 'chess', s: 'huge', n: "Heavy front", d: "Two ranks of pieces and two of pawns.", f: 'rnbrrqkrrbnr/bnnbnqqnbnnb/pppppppppppp/pppppppppppp/12/12/12/12/PPPPPPPPPPPP/PPPPPPPPPPPP/BNNBNQQNBNNB/RNBRRQKRRBNR w - - 0 1', t: { walls: [], water: ["l7", "l6", "a7", "a6"], portals: [] } },
    { g: 'chess', s: 'army', n: "Four queens", d: "Sixteen files, four queens a side.", f: 'rnbqrnbqkbnrqbnr/nbnbnbnqbnbnbnbn/pppppppppppppppp/16/16/16/16/16/16/16/16/16/16/PPPPPPPPPPPPPPPP/NBNBNBNQBNBNBNBN/RNBQRNBQKBNRQBNR w - - 0 1', t: { walls: ["c12", "c5", "n12", "n5", "l10", "l7", "e10", "e7", "a9", "a8", "p9", "p8"], water: [], portals: [], holes: ["o11", "o6", "b11", "b6", "e11", "e6", "l11", "l6"] } },
    { g: 'chess', s: 'huge', n: "Legion", d: "Three ranks of pieces behind two pawn walls.", f: 'rnbqrnbqkbnrqbnr/bnrbnrbrrbrnbrnb/nbnnbnnbbnnbnnbn/pppppppppppppppp/pppppppppppppppp/16/16/16/16/16/16/PPPPPPPPPPPPPPPP/PPPPPPPPPPPPPPPP/NBNNBNNBBNNBNNBN/BNRBNRBRRBRNBRNB/RNBQRNBQKBNRQBNR w - - 0 1', t: { walls: [], water: ["b9", "b8", "o9", "o8", "d9", "d8", "m9", "m8", "f9", "f8", "k9", "k8", "h9", "h8", "i9", "i8", "j9", "j8", "g9", "g8", "n9", "n8", "c9", "c8"], portals: [], holes: ["a9", "a8", "p9", "p8", "e9", "e8", "l9", "l8"] } },
    { g: 'chess', s: 'army', n: "Open field", d: "A wide front with plenty of room behind it.", f: 'rnbqbrnbqqkqbnrbqbnr/n1bn1bn1bnnb1nb1nb1n/pppppppppppppppppppp/20/20/20/20/20/20/20/20/20/20/20/20/20/20/PPPPPPPPPPPPPPPPPPPP/N1BN1BN1BNNB1NB1NB1N/RNBQBRNBQQKQBNRBQBNR w - - 0 1', t: { walls: [], water: ["b15", "b6", "s15", "s6", "c15", "c6", "r15", "r6", "j12", "j9", "k12", "k9", "r14", "r7", "c14", "c7", "b14", "b7", "s14", "s7", "b13", "b8", "s13", "s8", "m12", "m9", "h12", "h9", "n12", "n9", "g12", "g9", "o15", "o6", "f15", "f6"], portals: [] } },
    { g: 'chess', s: 'huge', n: "Great horde", d: "Four ranks of pieces and two of pawns, a hundred and twenty men a side.", f: 'rnbqbrnbqqkqbnrbqbnr/bnrbnrbnrrrrnbrnbrnb/nbqnbqnbqqqqbnqbnqbn/rnbrnbrnbnnbnrbnrbnr/pppppppppppppppppppp/pppppppppppppppppppp/20/20/20/20/20/20/20/20/PPPPPPPPPPPPPPPPPPPP/PPPPPPPPPPPPPPPPPPPP/RNBRNBRNBNNBNRBNRBNR/NBQNBQNBQQQQBNQBNQBN/BNRBNRBNRRRRNBRNBRNB/RNBQBRNBQQKQBNRBQBNR w - - 0 1', t: { walls: ["o13", "o8", "f13", "f8", "l12", "l9", "i12", "i9"], water: [], portals: [], holes: ["c12", "c9", "r12", "r9"] } },
    { g: 'chess', s: 'army', n: "Field battle", d: "Every letter of the alphabet a file, two ranks of pieces.", f: 'rnbqbnrrnbqbqkbqbnrrnbqbnr/nbnbnbnbnbnbrrbnbnbnbnbnbn/pppppppppppppppppppppppppp/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/PPPPPPPPPPPPPPPPPPPPPPPPPP/NBNBNBNBNBNBRRBNBNBNBNBNBN/RNBQBNRRNBQBQKBQBNRRNBQBNR w - - 0 1', t: { walls: ["i15", "i12", "r15", "r12", "e17", "e10", "v17", "v10", "c22", "c5", "x22", "x5", "a17", "a10", "z17", "z10", "v21", "v6", "e21", "e6", "n14", "n13", "m14", "m13", "j19", "j8", "q19", "q8"], water: [], portals: ["v20", "v7"] } },
    { g: 'chess', s: 'huge', n: "Total war", d: "Five ranks of pieces and two of pawns, almost two hundred men a side.", f: 'rnbqbrnbqbrnqknrbqbnrbqbnr/bnrbnrbnrbnrrrrnbrnbrnbrnb/nbqnbqnbqnbqqqqbnqbnqbnqbn/rnbrnbrnbrnbnnbnrbnrbnrbnr/bnbnbnbnbnbnbbnbnbnbnbnbnb/pppppppppppppppppppppppppp/pppppppppppppppppppppppppp/26/26/26/26/26/26/26/26/26/26/26/26/PPPPPPPPPPPPPPPPPPPPPPPPPP/PPPPPPPPPPPPPPPPPPPPPPPPPP/BNBNBNBNBNBNBBNBNBNBNBNBNB/RNBRNBRNBRNBNNBNRBNRBNRBNR/NBQNBQNBQNBQQQQBNQBNQBNQBN/BNRBNRBNRBNRRRRNBRNBRNBRNB/RNBQBRNBQBRNQKNRBQBNRBQBNR w - - 0 1', t: { walls: [], water: ["b14", "b13", "y14", "y13", "c14", "c13", "x14", "x13", "e14", "e13", "v14", "v13", "f14", "f13", "u14", "u13", "g14", "g13", "t14", "t13", "i14", "i13", "r14", "r13", "j14", "j13", "q14", "q13", "l14", "l13", "o14", "o13", "m14", "m13", "n14", "n13", "p14", "p13", "k14", "k13", "w14", "w13", "d14", "d13"], portals: [], holes: ["a14", "a13", "z14", "z13", "h14", "h13", "s14", "s13"] } },
    { g: 'chess', s: 'army', n: "The corridor", d: "Four files wide and twenty ranks long.", f: 'rqkr/nbbn/pppp/4/4/4/4/4/4/4/4/4/4/4/4/4/4/PPPP/NBBN/RQKR w - - 0 1', t: { walls: ["c14", "c7", "b14", "b7"], water: [], portals: [] } },
    { g: 'chess', s: 'huge', n: "Deep column", d: "Six ranks deep on four files.", f: 'rqkr/nbbn/brrb/nqqn/pppp/pppp/4/4/4/4/4/4/4/4/PPPP/PPPP/NQQN/BRRB/NBBN/RQKR w - - 0 1', t: { walls: [], water: ["c12", "c9", "b12", "b9"], portals: [] } },
    { g: 'chess', s: 'army', n: "Seven files", d: "Two queens around the king on a narrow, long board.", f: 'rnqkqnr/ppppppp/7/7/7/7/7/7/7/7/7/PPPPPPP/RNQKQNR w - - 0 1', t: { walls: [], water: ["a7", "g7", "c7", "e7", "d7", "f7", "b7"], portals: [] } },
    { g: 'chess', s: 'huge', n: "Long march", d: "Two ranks of pieces and two of pawns.", f: 'rnqkqnr/bnbrbnb/ppppppp/ppppppp/7/7/7/7/7/PPPPPPP/PPPPPPP/BNBRBNB/RNQKQNR w - - 0 1', t: { walls: ["c7", "e7"], water: [], portals: [] } },
    { g: 'fairy', s: 'army', n: "Capablanca court", d: "Chancellor and archbishop in place of queen and knights.", f: 'rhbekbhr/pppppppp/8/8/8/8/PPPPPPPP/RHNEKBHR w - - 0 1', t: { walls: ["e5", "e4", "d5", "d4"], water: [], portals: ["f5", "f4"] } },
    { g: 'fairy', s: 'huge', n: "Leaper camp", d: "Camels, zebras and an amazon, with a rank of ferzes and wazirs.", f: 'cznaknzc/fwfggfwf/pppppppp/8/8/PPPPPPPP/FWFGGFWF/CZNAKNZC w - - 0 1', t: { walls: [], water: [], portals: [] } },
    { g: 'fairy', s: 'army', n: "Grand court", d: "Chancellor, archbishop and the classical pieces on ten files.", f: 'rnbhekhbnr/pppppppppp/10/10/10/10/10/10/PPPPPPPPPP/RNBHEKHBNR w - - 0 1', t: { walls: [], water: ["h6", "h5", "c6", "c5", "i6", "i5", "b6", "b5"], portals: [] } },
    { g: 'fairy', s: 'huge', n: "Nightriders", d: "Nightriders on the wings, centaurs and champions in a second rank.", f: 'runbakbnur/ililmmlili/pppppppppp/10/10/10/10/PPPPPPPPPP/ILILMMLILI/RUNBAKBNUR w - - 0 1', t: { walls: ["j6", "j5", "a6", "a5"], water: [], portals: [] } },
    { g: 'fairy', s: 'army', n: "Desert caravan", d: "Camels and zebras among the classical pieces.", f: 'rczbhekhbzcr/pppppppppppp/12/12/12/12/12/12/12/12/PPPPPPPPPPPP/RCZBHEKHBZCR w - - 0 1', t: { walls: [], water: ["a7", "a6", "l7", "l6", "c7", "c6", "j7", "j6", "d7", "d6", "i7", "i6", "f7", "f6", "g7", "g6"], portals: [] } },
    { g: 'fairy', s: 'huge', n: "Menagerie", d: "Three ranks: heavy pieces, leapers and pawns.", f: 'rnbheakehbnr/cjglciiclgjc/pppppppppppp/pppppppppppp/12/12/12/12/PPPPPPPPPPPP/PPPPPPPPPPPP/CJGLCIICLGJC/RNBHEAKEHBNR w - - 0 1', t: { walls: [], water: ["a7", "a6", "l7", "l6"], portals: [] } },
    { g: 'fairy', s: 'army', n: "Amazon guard", d: "Two amazons beside the king, chancellors on the flanks.", f: 'renbhreakerhbner/nlblclzianlblclz/pppppppppppppppp/16/16/16/16/16/16/16/16/16/16/PPPPPPPPPPPPPPPP/NLBLCLZIANLBLCLZ/RENBHREAKERHBNER w - - 0 1', t: { walls: ["n12", "n5", "c12", "c5", "g10", "g7", "j10", "j7"], water: [], portals: ["j12", "j5"] } },
    { g: 'fairy', s: 'huge', n: "Fairy legion", d: "Every classic fairy piece, four ranks deep.", f: 'renbhreakerhbner/czjlucziizculjzc/fwgdfwgmmgwfdgwf/pppppppppppppppp/16/16/16/16/16/16/16/16/PPPPPPPPPPPPPPPP/FWGDFWGMMGWFDGWF/CZJLUCZIIZCULJZC/RENBHREAKERHBNER w - - 0 1', t: { walls: ["k11", "k6", "f11", "f6", "h10", "h7", "i10", "i7"], water: [], portals: [], holes: ["l11", "l6", "e11", "e6"] } },
    { g: 'fairy', s: 'army', n: "Long front", d: "A wide front of archbishops and chancellors.", f: 'rnbhernbhakhbnrehbnr/cicicicicllcicicicic/pppppppppppppppppppp/20/20/20/20/20/20/20/20/20/20/20/20/20/20/PPPPPPPPPPPPPPPPPPPP/CICICICICLLCICICICIC/RNBHERNBHAKHBNREHBNR w - - 0 1', t: { walls: [], water: ["b11", "b10", "s11", "s10", "d11", "d10", "q11", "q10", "e11", "e10", "p11", "p10", "g11", "g10", "n11", "n10", "i11", "i10", "l11", "l10", "j11", "j10", "k11", "k10"], portals: [], holes: ["a11", "a10", "t11", "t10", "f11", "f10", "o11", "o10"] } },
    { g: 'fairy', s: 'huge', n: "Fairy horde", d: "Five ranks of fairy pieces against the same.", f: 'rnbhernbhakhbnrehbnr/uczjuczjuaaujzcujzcu/ilmilmilmeemlimlimli/fwgdfwgdfhhfdgwfdgwf/pppppppppppppppppppp/20/20/20/20/20/20/20/20/20/20/PPPPPPPPPPPPPPPPPPPP/FWGDFWGDFHHFDGWFDGWF/ILMILMILMEEMLIMLIMLI/UCZJUCZJUAAUJZCUJZCU/RNBHERNBHAKHBNREHBNR w - - 0 1', t: { walls: [], water: ["h13", "h8", "m13", "m8", "h12", "h9", "m12", "m9", "t11", "t10", "a11", "a10", "o11", "o10", "f11", "f10", "p11", "p10", "e11", "e10", "l13", "l8", "i13", "i8"], portals: [] } },
    { g: 'fairy', s: 'army', n: "Fairy empire", d: "Twenty six files of fairy pieces.", f: 'rnbhecrnbhecakcehbnrcehbnr/zjzjzjzjzjzjiijzjzjzjzjzjz/pppppppppppppppppppppppppp/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/PPPPPPPPPPPPPPPPPPPPPPPPPP/ZJZJZJZJZJZJIIJZJZJZJZJZJZ/RNBHECRNBHECAKCEHBNRCEHBNR w - - 0 1', t: { walls: ["t19", "t8", "g19", "g8", "c19", "c8", "x19", "x8", "r15", "r12", "i15", "i12", "e21", "e6", "v21", "v6", "h20", "h7", "s20", "s7", "q18", "q9", "j18", "j9", "w20", "w7", "d20", "d7", "s21", "s6", "h21", "h6", "o17", "o10", "l17", "l10"], water: [], portals: [], holes: ["z20", "z7", "a20", "a7", "f14", "f13", "u14", "u13", "k20", "k7", "p20", "p7"] } },
    { g: 'fairy', s: 'huge', n: "Fairy apocalypse", d: "Six ranks of fairy pieces, the biggest fairy army there is.", f: 'rnbhernbhernaknrehbnrehbnr/uczjuczjuczjaajzcujzcujzcu/ilmilmilmilmeemlimlimlimli/fwgdfwgdfwgdhhdgwfdgwfdgwf/pppppppppppppppppppppppppp/pppppppppppppppppppppppppp/26/26/26/26/26/26/26/26/26/26/26/26/26/26/PPPPPPPPPPPPPPPPPPPPPPPPPP/PPPPPPPPPPPPPPPPPPPPPPPPPP/FWGDFWGDFWGDHHDGWFDGWFDGWF/ILMILMILMILMEEMLIMLIMLIMLI/UCZJUCZJUCZJAAJZCUJZCUJZCU/RNBHERNBHERNAKNREHBNREHBNR w - - 0 1', t: { walls: [], water: ["b14", "b13", "y14", "y13", "c14", "c13", "x14", "x13", "e14", "e13", "v14", "v13", "f14", "f13", "u14", "u13", "g14", "g13", "t14", "t13", "i14", "i13", "r14", "r13", "j14", "j13", "q14", "q13", "l14", "l13", "o14", "o13", "m14", "m13", "n14", "n13", "p14", "p13", "k14", "k13", "w14", "w13", "d14", "d13"], portals: [], holes: ["a14", "a13", "z14", "z13", "h14", "h13", "s14", "s13"] } },
    { g: 'fairy', s: 'army', n: "Fairy corridor", d: "Chancellors and an amazon down a narrow lane.", f: 'eake/hnnh/pppp/4/4/4/4/4/4/4/4/4/4/4/4/4/4/PPPP/HNNH/EAKE w - - 0 1', t: { walls: [], water: ["b13", "b8", "c13", "c8"], portals: [] } },
    { g: 'fairy', s: 'huge', n: "Fairy tower", d: "Six ranks deep on four files.", f: 'eake/hcch/ullu/izzi/pppp/pppp/4/4/4/4/4/4/4/4/PPPP/PPPP/IZZI/ULLU/HCCH/EAKE w - - 0 1', t: { walls: ["d12", "d9", "a12", "a9"], water: [], portals: [] } },
    { g: 'fairy', s: 'army', n: "Fairy road", d: "An archbishop and a chancellor at the king's side.", f: 'rchkhcr/ppppppp/7/7/7/7/7/7/7/7/7/PPPPPPP/RCHKHCR w - - 0 1', t: { walls: ["g9", "g5", "a9", "a5"], water: [], portals: ["f8", "f6"] } },
    { g: 'fairy', s: 'huge', n: "Fairy procession", d: "Three ranks of fairy pieces and a pawn wall.", f: 'rehkher/zialaiz/ppppppp/7/7/7/7/7/7/7/PPPPPPP/ZIALAIZ/REHKHER w - - 0 1', t: { walls: [], water: ["a7", "g7", "c7", "e7", "d7", "f7", "b7"], portals: [] } },
    { g: 'ouroboros', s: 'huge', n: "War camp", d: "Two ranks of units behind a few marching pawns.", f: 'ιβθξkθβι/sβsζζsβs/д1д2д1д/8/8/P1Д2Д1Д/SΒSΖΖSΒS/ΙΒΘΞKΘΒΙ w - - 0 1', t: { walls: [], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'huge', n: "Royal host", d: "Mounted kings with knights templar, princesses and vikings.", f: 'νβθжэθβν/sssttsss/8/8/8/8/SSSTTSSS/ΝΒΘSЭΘΒΝ w - - 0 1', t: { walls: ["h5", "h4", "a5", "a4"], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "Border war", d: "Gryphons, cardinals and war wagons, a few marching pawns in front.", f: 'ιsθαskαθsι/д2д2д2д/10/10/10/10/10/10/P2Д2Д2Д/ΙSΘΑSKΑΘSΙ w - - 0 1', t: { walls: [], water: ["a6", "a5", "j6", "j5", "c6", "c5", "h6", "h5", "d6", "d5", "g6", "g5", "f6", "f5", "e6", "e5", "i6", "i5", "b6", "b5"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'corner', n: "Corner forts", d: "Both armies start in their corner, walled in by vikings.", f: '6βkθι/6sζιs/6s2s/10/10/10/10/S2S6/SΒΖS6/ΙΘKΒ6 w - - 0 1', t: { walls: ["b9", "i2"], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "Clan muster", d: "Vikings and berserkers around a general, marching pawns in front.", f: 'ιsθsιtюιsθsι/s1ss1ss1ss1s/д1д1д2д1д1д/12/12/12/12/12/12/Д1Д1Д2Д1Д1Д/S1SS1SS1SS1S/ΙSΘSΙTЮΙSΘSΙ w - - 0 1', t: { walls: [], water: ["c8", "c5", "j8", "j5", "c7", "c6", "j7", "j6"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'corner', n: "Two keeps", d: "Corner starts on a big board, a long way to the enemy king.", f: '7νθkβι/7sηζθs/7д1д1д/12/12/12/12/12/12/Д1Д1Д7/SΘΖSS7/ΙΒKΘΝ7 w - - 0 1', t: { walls: ["h9", "e4", "f11", "g2"], water: [], portals: ["c10", "j3"] }, kc: true },
    { g: 'ouroboros', s: 'huge', n: "The great host", d: "Three ranks of units, sixty a side.", f: 'ιβθανδιξkιδναθβι/ζstsηζsζηsζηstsζ/д2дд2дд2дд2д/16/16/16/16/16/16/16/16/16/16/Д2ДД2ДД2ДД2Д/ΖSTSΗΖSΖΗSΖΗSTSΖ/ΙΒΘΑΝΔΙΞKΙΔΝΑΘΒΙ w - - 0 1', t: { walls: [], water: ["b9", "b8", "o9", "o8", "d9", "d8", "m9", "m8", "f9", "f8", "k9", "k8", "h9", "h8", "i9", "i8", "j9", "j8", "g9", "g8", "n9", "n8", "c9", "c8"], portals: [], holes: ["a9", "a8", "p9", "p8", "e9", "e8", "l9", "l8"] }, kc: true },
    { g: 'ouroboros', s: 'corner', n: "Corner kingdoms", d: "Two kingdoms in opposite corners, a wide wild land between them.", f: '10δνkθβι/10sβηζαs/10tsttst/11д1д1д/16/16/16/16/16/16/16/16/Д1Д1Д11/TSTTST10/SΑΖΗΒS10/ΙΒΘKΝΔ10 w - - 0 1', t: { walls: [], water: ["k13", "f4", "k12", "f5", "c9", "n8", "a14", "p3", "b14", "o3", "l11", "e6", "m11", "d6"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'huge', n: "Siege of the plains", d: "Four ranks of units across twenty files.", f: 'ιβθανδιβθξkθβιδναθβι/ζstsηζζstγγtsζζηstsζ/ssθιβsθθθииθsθsβsθsι/д2д1д2дддд2д1д2д/20/20/20/20/20/20/20/20/20/20/20/20/Д2Д1Д2ДДДД2Д1Д2Д/SSΘΙΒSΘΘΘИИΘSΘSΒSΘSΙ/ΖSTSΗΖΖSTΓΓTSΖΖΗSTSΖ/ΙΒΘΑΝΔΙΒΘΞKΘΒΙΔΝΑΘΒΙ w - - 0 1', t: { walls: ["s14", "s7", "b14", "b7", "k14", "k7", "j14", "j7", "m12", "m9", "h12", "h9", "s11", "s10", "b11", "b10"], water: [], portals: [], holes: ["k12", "k9", "j12", "j9", "c14", "c7", "r14", "r7"] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "Witch hunt", d: "Edea, Andromeda and their guard against the same.", f: 'ιβθαsιβθαёkαθβιsαθβι/tζηtζηtζηθжηζtηζtηζt/д1д1д1д1д2д1д1д1д1д/20/20/20/20/20/20/20/20/20/20/20/20/20/20/Д1Д1Д1Д1Д2Д1Д1Д1Д1Д/TΖΗTΖΗTΖΗΘЖΗΖTΗΖTΗΖT/ΙΒΘΑSΙΒΘΑЁKΑΘΒΙSΑΘΒΙ w - - 0 1', t: { walls: ["k13", "k8", "j13", "j8", "k11", "k10", "j11", "j10", "o16", "o5", "f16", "f5", "n14", "n7", "g14", "g7"], water: [], portals: ["o14", "o7"] }, kc: true },
    { g: 'ouroboros', s: 'huge', n: "End of the world", d: "Five ranks of units on the biggest board, well over a hundred a side.", f: 'ιβθανδιβθανδξkδναθβιδναθβι/ζstsηζζstsηζγγζηstsζζηstsζ/βθιθββθιθββθииθββθιθββθιθβ/ssζηsssζηssαttαssηζsssηζss/д2д1д2д1д1дд1д1д2д1д2д/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/Д2Д1Д2Д1Д1ДД1Д1Д2Д1Д2Д/SSΖΗSSSΖΗSSΑTTΑSSΗΖSSSΗΖSS/ΒΘΙΘΒΒΘΙΘΒΒΘИИΘΒΒΘΙΘΒΒΘΙΘΒ/ΖSTSΗΖΖSTSΗΖΓΓΖΗSTSΖΖΗSTSΖ/ΙΒΘΑΝΔΙΒΘΑΝΔΞKΔΝΑΘΒΙΔΝΑΘΒΙ w - - 0 1', t: { walls: [], water: ["b14", "b13", "y14", "y13", "c14", "c13", "x14", "x13", "e14", "e13", "v14", "v13", "f14", "f13", "u14", "u13", "g14", "g13", "t14", "t13", "i14", "i13", "r14", "r13", "j14", "j13", "q14", "q13", "l14", "l13", "o14", "o13", "m14", "m13", "n14", "n13", "p14", "p13", "k14", "k13", "w14", "w13", "d14", "d13"], portals: [], holes: ["a14", "a13", "z14", "z13", "h14", "h13", "s14", "s13"] }, kc: true },
    { g: 'ouroboros', s: 'corner', n: "Twin empires", d: "Two empires in opposite corners of the biggest board.", f: '17ιθδνkαθβι/17sαζηγηζαs/17tsttsttst/17βθιθβθιθβ/17p1p1д1д1д/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/26/Д1Д1Д1Д1Д17/ΒΘΙΘΒΘΙΘΒ17/TSTTSTTST17/SΑΖΗSΗΖΑS17/ΙΒΘΑKΝΔΘΙ17 w - - 0 1', t: { walls: [], water: ["p18", "k9", "q18", "j9", "k20", "p7", "c19", "x8", "d19", "w8", "b15", "y12", "v21", "e6", "b19", "y8", "i19", "r8", "i18", "r9", "w21", "d6", "x21", "c6", "a21", "z6", "b21", "y6", "b20", "y7", "i25", "r2", "e25", "v2", "i14", "r13"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "The narrow pass", d: "Four files, a long pass, units in single file.", f: 'ιξkι/ssss/д2д/4/4/4/4/4/4/4/4/4/4/4/4/4/4/Д2Д/SSSS/ΙΞKΙ w - - 0 1', t: { walls: ["d13", "d8", "a13", "a8"], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'huge', n: "Mountain column", d: "Five ranks of units marching down a narrow valley.", f: 'ιξkι/θββθ/stts/αζζα/дддд/4/4/4/4/4/4/4/4/4/4/PДДД/ΑΖΖΑ/STTS/ΘΒΒΘ/ΙΞKΙ w - - 0 1', t: { walls: [], water: ["d12", "d9", "a12", "a9"], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'army', n: "Mountain road", d: "Seven files and a mounted king.", f: 'ιβθэθβι/д1sζs1д/7/7/7/7/7/7/7/7/7/Д1SΖS1Д/ΙΒΘЭΘΒΙ w - - 0 1', t: { walls: ["a10", "a4", "g10", "g4"], water: [], portals: [] }, kc: true },
    { g: 'ouroboros', s: 'huge', n: "Little war", d: "Three ranks of units on seven files.", f: 'ιβθkθβι/sαζtζαs/д1ддд1д/7/7/7/7/7/7/7/P1PДД1Д/SΑΖTΖΑS/ΙΒΘKΘΒΙ w - - 0 1', t: { walls: ["e7", "c7"], water: [], portals: [] }, kc: true },
  ];
  BOARD_PRESETS.push(...(window.BOARD_PRESETS_MORE || [])); // the second batch, js/presets_more.js
  BOARD_PRESETS.push(...(window.BOARD_PRESETS_CHECKERS || [])); // Checkers starts, openings and endings, js/presets_checkers.js
  const THEMES = [['green', '#ebecd0', '#739552'], ['brown', '#edd6b0', '#b88762'], ['blue', '#eae9d2', '#4b7399'],
    ['purple', '#f0f1f0', '#8476ba'], ['gray', '#dcdcdc', '#8b8987']];
  /* The shogi boards (one colour, lines between the squares, four star points on 9 x 9): wood as the original, white,
     gray and black, and each two-coloured board drawn the shogi way (shogi-green ...: a tone between its light and dark
     square, lines in its dark colour). Every game takes settings.theme, a game of Shogi settings.shogiBoard, and a
     two-coloured board in a game of Shogi gets the star points. [square, line, coordinates] */
  const SG_BOARDS = { shogi: ['#e5bd72', '#2b1d0b', '#6b4c1e'], shogiw: ['#f4f2ec', '#1c1b19', '#55524c'], shogig: ['#9a9893', '#1f1e1c', '#3a3936'], shogib: ['#1d1c1a', '#d9d4c8', '#a9a397'] };
  const SHOGI_BOARDS = ['shogi', 'shogiw', 'shogig', 'shogib'].concat(THEMES.map((t) => 'shogi-' + t[0]));
  const BOARD_NAMES = { green: 'Green', brown: 'Brown', blue: 'Blue', purple: 'Purple', gray: 'Gray', shogi: 'Wood', shogiw: 'White', shogig: 'Gray', shogib: 'Black' };
  const boardName = (id) => (/^shogi-/.test(id) ? 'Shogi, ' + BOARD_NAMES[id.slice(6)].toLowerCase() : /^shogi/.test(id) ? 'Shogi, ' + BOARD_NAMES[id].toLowerCase() : BOARD_NAMES[id] || id);
  function sgBoardColors(id) {
    if (SG_BOARDS[id]) return SG_BOARDS[id];
    const t = THEMES.find((x) => 'shogi-' + x[0] === id) || THEMES[0];
    const rgb = (hx) => [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16));
    const mix = (a, b, k) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
    return [mix(t[1], t[2], 0.38), mix(t[2], '#000000', 0.55), mix(t[2], '#000000', 0.35)];
  }
  // a board's colours for the small pictures: [light, dark, line or null]
  const boardColors = (id) => { if (/^shogi/.test(id)) { const c = sgBoardColors(id); return [c[0], c[0], c[1]]; } const t = THEMES.find((x) => x[0] === id) || THEMES[0]; return [t[1], t[2], null]; };
  // a button for a board colour: four squares, or one colour with its lines
  function boardSwatch(id, on, attr) {
    const c = boardColors(id), sq = (bg) => '<i style="background:' + bg + (c[2] ? ';box-shadow:inset 0 0 0 .6px ' + c[2] : '') + '"></i>';
    return '<button ' + attr + ' class="' + (on ? 'on' : '') + '" title="' + boardName(id) + '">' + sq(c[0]) + sq(c[1]) + sq(c[1]) + sq(c[0]) + '</button>';
  }
  const boardGroups = (cur, attr) => '<div class="thgroup"><span>Two colours</span><div class="themes">' + THEMES.map((t) => boardSwatch(t[0], cur === t[0], attr + '="' + t[0] + '"')).join('') + '</div></div>' +
    '<div class="thgroup"><span>Shogi boards</span><div class="themes">' + SHOGI_BOARDS.map((id) => boardSwatch(id, cur === id, attr + '="' + id + '"')).join('') + '</div></div>';
  // the board on screen: its colours (data-theme, and the shogi colours of a computed one), the star points in Shogi
  function applyBoard(id, shogiGame) {
    document.body.dataset.theme = id;
    const c = /^shogi-/.test(id) ? sgBoardColors(id) : null;
    ['sq', 'line', 'ink'].forEach((k, i) => { if (c) document.body.style.setProperty('--sg-' + k, c[i]); else document.body.style.removeProperty('--sg-' + k); });
    document.body.classList.toggle('shogigame', !!shogiGame);
  }
  const THINK = [[1000, '1 s'], [3000, '3 s'], [5000, '5 s'], [10000, '10 s'], [30000, '30 s']];
  const CLOCKS = [[0, 'None'], [180, '3 min'], [300, '5 min'], [600, '10 min'], [915, '15 | 10']];

  /* ---------- persistent state ---------- */

  const KEY = 'powerchess_v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { saved = {}; }
  const settings = Object.assign({ haptics: true, theme: 'green', pieces: 'cburnett', evalBar: true, legal: true, coords: true, sound: true, anim: true, premove: true, multiPremove: false, autoQueen: false, thinkMs: 3000, reviewMs: 700 }, saved.settings);
  const setup = Object.assign({ bot: 'max', color: 'w', clock: 0, fen: R.START_FEN, engine: 'auto', mode: 'human', flipEach: true, kingCapture: false, variant: 'chess', customIni: Fairy.TEMPLATES[0].ini }, saved.setup);
  const noPowers = () => { const o = { double: 0, midasPerTurn: 1 }; POWER_KEYS.forEach((k) => { o[k] = false; }); return o; };
  setup.powers = Object.assign(noPowers(), saved.setup && saved.setup.powers);   // yours, or White's in a bot match
  setup.powers2 = Object.assign(noPowers(), saved.setup && saved.setup.powers2); // the other side's own set
  if (!Fairy.VARIANTS.some((v) => v.id === setup.variant)) setup.variant = 'chess';
  setup.ai = Object.assign({ anticipate: false, use: 'none' }, saved.setup && saved.setup.ai);
  [setup.powers, setup.powers2].forEach((pw) => {
    // Spiked Helmet and Explosive Vest were levels once (1 chess pieces, 2 all but pawns, 3 all): by kind now
    if (!pw) return;
    ['helmet', 'vest'].forEach((w) => {
      const lv = +pw[w] || 0;
      if (lv === 1) ['P', 'N', 'B', 'R', 'Q'].forEach((k) => { pw[w + k] = true; }); else if (lv === 2) pw[w + 'NP'] = true; else if (lv === 3) pw[w + 'All'] = true;
      pw[w] = 0;
    });
  });
  if (setup.ai.use === true) setup.ai.use = 'same'; // settings saved before each side had its own set
  if (['none', 'same', 'own'].indexOf(setup.ai.use) < 0) setup.ai.use = 'none';
  setup.botW = Object.assign({ engine: 'auto', bot: 'max' }, saved.setup && saved.setup.botW);
  setup.botB = Object.assign({ engine: 'fairy', bot: 'max' }, saved.setup && saved.setup.botB);
  if (!setup.engineAuto) { // the engine became automatic (2026-10-03): the saved choice gives way once
    setup.engine = 'auto';
    if (setup.botW.engine === 'sf') setup.botW.engine = 'auto';
    if (setup.botB.engine === 'sf') setup.botB.engine = 'auto';
    setup.engineAuto = true;
  }
  const stats = saved.stats || {};
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ settings: settings, setup: setup, stats: stats })); } catch (e) { /* private mode */ }
  }

  /* ---------- runtime state ---------- */

  let G = null;       // current game
  let custom = null;  // loaded custom variant { uci, title, fen, ini, glyphs }
  let customErr = '';
  const ui = { sgHover: -1, tab: 'new', flipped: setup.color === 'b', sel: null, mode: null, draft: [], arrows: [], marks: [], drag: null, paint: null, overlay: null, rc: -1, dropFrom: -1, hintArrow: null, hintWanted: false, thinking: false, premoves: [], pwSet: 'a', eval: { cp: 0, mate: null, depth: 0 } };
  const ed = { board: [], W: 8, H: 8, turn: 'w', castling: '', brush: null, errs: [], terrain: { walls: [], water: [], portals: [], holes: [] }, ghosts: [], snipers: [], helmets: [], vests: [] };

  const engine = new Engine();
  let engineReady = false;
  // A dropped request during page load can kill the first attempt, so try a few times.
  async function bootEngine() {
    for (let i = 0; i < 3 && !engineReady; i++) {
      try { await engine.init(); engineReady = true; } catch (e) { console.warn('Stockfish start failed, attempt ' + (i + 1), e); await sleep(800); }
    }
  }
  const enginePromise = bootEngine();
  let fairyEngine = null, fairyPromise = null;
  function getFairy() {
    if (!fairyPromise) {
      fairyPromise = new Engine().initFairy().then((e) => { fairyEngine = e; renderEngineBox(); return e; });
      fairyPromise.catch(() => { fairyPromise = null; });
    }
    return fairyPromise;
  }
  // Stockfish 19 only plays standard chess, so every variant goes to Fairy-Stockfish.
  /* Which engine plays. 'auto' (the default) and 'sf' take Stockfish 19 whenever it can play the game and
     Fairy-Stockfish when it cannot: another variant, or an army Stockfish refuses (three queens, no king, ...).
     'fairy' always takes Fairy-Stockfish. Checkers and Duck Chess have the app's own engine. */
  let sfMemo = { key: null, ok: true };
  function sfCanPlay() {
    if (!stdVariant(setup.variant) || ownName()) return false;
    const key = setup.fen + '|' + JSON.stringify(setup.powers) + '|' + autoKC().on;
    if (sfMemo.key === key) return sfMemo.ok;
    let ok = true;
    try {
      const cfg = setupCfg('w');
      cfg.kingCapture = autoKC().on; cfg.freeArmy = false;
      const s0 = R.fromFen(setup.fen, cfg);
      // only the army stands in the way when Fairy-Stockfish's freer rules would take the position
      if ((s0.W || 8) === 8 && (s0.H || 8) === 8 && R.validate(s0, cfg).length) { cfg.freeArmy = true; ok = R.validate(s0, cfg).length > 0; }
    } catch (e) { ok = true; }
    sfMemo = { key: key, ok: ok };
    return ok;
  }
  function prefEngine(pref) {
    if (!stdVariant(setup.variant) || ownName()) return 'fairy';
    return pref === 'fairy' ? 'fairy' : sfCanPlay() ? 'sf' : 'fairy';
  }
  function engineKind() { return prefEngine(setup.engine); }
  // why Stockfish 19 does not play (null when it does or when Fairy-Stockfish was chosen by hand)
  function sfWhyNot() {
    const V = Fairy.byId(setup.variant);
    if (ownName()) return null;
    if (!stdVariant(V.id)) return 'Stockfish 19 only plays standard chess, so Fairy-Stockfish plays ' + V.name + '.';
    if (!sfCanPlay()) return 'Stockfish 19 refuses this position (an army it does not allow), so Fairy-Stockfish plays it.';
    return null;
  }
  /* King capture is not a switch: it is on where the rules of the game need it. Dice Chess (a throw can leave a king
     in check with no die to answer it), Duck Chess, a board with The Ouroboros King's units or one of that game's
     presets (their extra moves and blocks are made for it). Off for a checkers board, with a Shotgun King (no shot
     while in check) and everywhere else. */
  function autoKC() {
    const V = Fairy.byId(setup.variant);
    if (!stdVariant(V.id) || ckRules()) return { on: false, why: '' };
    if (V.duckChess) return { on: true, why: 'Duck Chess is played this way.' };
    if (V.dice) return { on: true, why: 'Dice Chess is played this way: a throw can leave the king in check with no die to answer it.' };
    const pcs = setup.fen.split(' ')[0];
    if (/[ґҐ]/.test(pcs)) return { on: false, why: '' };
    const ouro = R.FAIRY_LETTERS.slice(R.FAIRY_LETTERS.indexOf('o')).filter((l) => ['є', 'ї', 'ѓ', 'ќ', 'ў', 'џ', 'ґ'].indexOf(l) < 0 && !R.FAIRY[l].shogi);
    if (pcs.split('').some((ch) => ouro.indexOf(ch.toLowerCase()) >= 0)) return { on: true, why: 'The Ouroboros King\'s units are on the board, and their game is played this way.' };
    if (setup.kcPreset) return { on: true, why: 'The position is a preset from The Ouroboros King, and that game is played this way.' };
    return { on: false, why: '' };
  }
  function engineByKind(kind) {
    if (kind === 'fairy') return getFairy().catch((e) => { console.error(e); return null; });
    return enginePromise.then(() => (engineReady ? engine : null));
  }
  function engineFor(game) { return engineByKind(game.engine); }
  function stopEngines() {
    engine.stop();
    if (fairyEngine) fairyEngine.stop();
    stopBrain();
  }

  const board = $('#board');
  const L = {};
  ['squares', 'marks', 'pieces', 'hints', 'arrows', 'fx'].forEach((k) => { L[k] = board.querySelector('.' + k); });
  let BW = 8, BH = 8; // files and ranks currently on screen

  const live = () => G.states[G.states.length - 1];
  const isLive = () => G && G.view === G.states.length - 1;
  // What the board shows: the editor, a preview of the next game, or the game itself.
  function mode() {
    if (ui.tab === 'editor') return 'editor';
    if (ui.tab === 'modes') return 'modes';
    if (ui.tab === 'analysis') return A ? 'analysis' : 'preview';
    if (ui.tab === 'puzzles') return pz.cur ? 'puzzle' : 'preview';
    if (ui.tab === 'variants' || !G) return 'preview';
    return 'game';
  }
  /* The colour the person at the keyboard plays: their own against a bot, whoever is to move when two
     people share the board. cfg.side itself stays fixed, the rules key the pockets by it. */
  function mySide() { return G.local ? live().turn : G.cfg.side; }
  // Drawback Chess for two at one device: the side to move has to take the device and show its drawback first
  const handoff = () => !!(G && G.local && G.db && !G.over && G.dbReveal !== live().turn);
  function canAct() {
    return mode() === 'game' && ui.tab !== 'review' && !G.auto && !G.over && isLive() && !ui.overlay && !ui.thinking && !handoff() && (live().turn === mySide() || G.puppetNow);
  }
  function canPremove() {
    return !(G && newDice(G.cfg)) && settings.premove && mode() === 'game' && ui.tab !== 'review' && !G.auto && !G.over && isLive() && !ui.overlay && !G.puppetNow && !G.local && live().turn !== G.cfg.side;
  }
  function blank(boardArr, turn) {
    return { board: boardArr, turn: turn || 'w', gold: [], portals: [], pocket: [], check: [], ice: [] };
  }
  function preview() {
    if (ui.tab === 'puzzles') return { s: R.fromFen(R.START_FEN), W: 8, H: 8, glyphs: {}, cfg: null }; // no puzzle on the board right now
    const V = Fairy.byId(setup.variant);
    if (stdVariant(V.id)) {
      // the game as it will start: what the power-ups put on the pieces (helmets, vests, ghosts, camo) and the upgrades by hand
      const me = setup.mode === 'human' && setup.color === 'b' ? 'b' : 'w', pw = { w: null, b: null };
      const theirs = setup.ai.use === 'same' ? setup.powers : setup.ai.use === 'own' ? setup.powers2 : null;
      pw[me] = setup.powers || null; pw[R.other(me)] = theirs || null;
      const pcfg = { side: 'w', pw: pw, traits: hasTraits(setup.traits) ? setup.traits : null, freeArmy: true, terrain: hasTerrain(setup.terrain) ? setup.terrain : null };
      let s;
      try { s = R.fromFen(setup.fen, pcfg); } catch (e) { s = R.fromFen(R.START_FEN); }
      return { s: s, W: s.W || 8, H: s.H || 8, glyphs: {}, cfg: hasTerrain(setup.terrain) ? { side: 'w', terrain: setup.terrain } : null };
    }
    if (V.checkers) { const s = R.fromFen(checkersBoard(setup.fen) ? setup.fen : V.fen); return { s: s, W: s.W || 8, H: s.H || 8, glyphs: {}, cfg: null }; }
    const c = V.id === 'custom' ? custom : null;
    const pb = Fairy.parseBoard(c ? c.fen : V.fen);
    return { s: blank(pb.board), W: pb.W, H: pb.H, glyphs: c ? c.glyphs : (V.glyphs || {}), cfg: null };
  }
  function view() {
    const m = mode();
    if (m === 'modes') return modesView();
    if (m === 'editor') return { s: Object.assign(blank(ed.board, ed.turn), { ghosts: ed.ghosts, snipers: ed.snipers, helmets: ed.helmets, vests: ed.vests, W: ed.W, H: ed.H }), W: ed.W, H: ed.H, glyphs: {}, cfg: { side: 'w', terrain: ed.terrain } };
    if (m === 'preview') return preview();
    if (m === 'analysis') return { s: A.cur.state, W: A.W, H: A.H, glyphs: A.glyphs, cfg: A.cfg };
    if (m === 'puzzle') return { s: pz.cur.shown || pz.cur.state, W: 8, H: 8, glyphs: {}, cfg: pz.cur.cfg.pw ? pz.cur.cfg : null };
    if (reviewing() && rv.trial) return { s: rv.trial.state, W: G.W, H: G.H, glyphs: G.glyphs, cfg: G.cfg, hex: !!G.hex };
    if (rvPeek()) return { s: rv.peek.state, W: G.W, H: G.H, glyphs: G.glyphs, cfg: G.cfg, hex: !!G.hex };
    return { s: G.states[G.view], W: G.W, H: G.H, glyphs: G.glyphs, cfg: G.cfg, hex: !!G.hex };
  }
  function setupCfg(side) {
    const p = setup.powers, cfg = { side: side, double: p.double, midasPerTurn: p.midasPerTurn };
    POWER_KEYS.forEach((k) => { cfg[k] = p[k]; });
    return cfg;
  }

  /* ---------- sound ---------- */

  let AC = null;
  function ac() {
    if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function noise(t, dur, freq, q, vol) {
    const len = Math.ceil(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(AC.destination); src.start(t);
  }
  /* The royal shotgun, made here (no sample): a short, dry crack. A tight burst of noise that is gone in a tenth of
     a second, a little body under it and no tail, so it sits with the other move sounds instead of over them. */
  function burst(t, dur, curve, type, freq, q, vol) {
    const len = Math.ceil(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, curve);
    const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(AC.destination); src.start(t);
  }
  function gunshot(t) {
    burst(t, 0.11, 4, 'bandpass', 2300, 0.8, 0.55);   // the crack
    burst(t, 0.16, 5, 'lowpass', 900, 0.6, 0.35);     // a little body
    tone(t, 0.07, 95, 0.18, 'sine', 60);              // a short knock under it
  }
  // a piece struck down after the king: an electric crackle with a falling buzz under it
  function zapSound(t) {
    burst(t, 0.09, 2, 'bandpass', 3200, 1.1, 0.35);
    burst(t + 0.05, 0.22, 3, 'bandpass', 1400, 0.9, 0.25);
    tone(t, 0.26, 880, 0.07, 'sawtooth', 110);
    tone(t + 0.02, 0.18, 150, 0.16, 'square', 55);
  }
  /* Pawnbarian: the hero takes a hit. A heavy body blow (a falling thump), the crunch of it, and a short rough
     grunt under it, so a point of damage is never mistaken for a move or a capture. */
  function hurtSound(t) {
    tone(t, 0.2, 150, 0.42, 'sine', 42);              // the thump
    burst(t, 0.13, 3, 'lowpass', 1300, 0.7, 0.75);    // the impact
    burst(t + 0.012, 0.07, 4, 'bandpass', 3200, 1.1, 0.3); // the crunch
    tone(t + 0.03, 0.2, 210, 0.1, 'sawtooth', 80);    // the grunt
  }
  // a monster cut down: a quick blade swish, rising, then the cut
  function slashSound(t) {
    const len = Math.ceil(AC.sampleRate * 0.16), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
    const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.Q.value = 2.2;
    f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(5200, t + 0.15);
    g.gain.value = 0.38;
    src.connect(f); f.connect(g); g.connect(AC.destination); src.start(t);
    burst(t + 0.12, 0.06, 3, 'bandpass', 2600, 1, 0.28);
  }
  /* Pawnbarian's cards, all made here: the card itself (a paper flick), how the piece goes (a slide, a jump, a step,
     the Ghost's shimmer, the Nomad's bow) and what the card's upgrades add (a Shield's ring, a Splash's sweep,
     Purify's chime). */
  function sweep(t, dur, f0, f1, q, vol, type) {
    const len = Math.ceil(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
    const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = buf; f.type = type || 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(AC.destination); src.start(t);
  }
  const PB_SFX = {
    flick: (t) => { sweep(t, 0.07, 6000, 2600, 1.4, 0.16, 'highpass'); burst(t + 0.05, 0.02, 3, 'bandpass', 3400, 1.5, 0.12); }, // a card picked
    card: (t) => { sweep(t, 0.09, 4200, 1800, 1.2, 0.2); burst(t + 0.07, 0.03, 3, 'bandpass', 1900, 1.2, 0.22); }, // a card slapped down
    slide: (t) => { sweep(t, 0.22, 1800, 600, 1.1, 0.22); tone(t + 0.19, 0.06, 190, 0.18); },              // along a line
    jump: (t) => { tone(t, 0.16, 260, 0.11, 'triangle', 620); tone(t + 0.16, 0.08, 150, 0.24, 'sine', 70); burst(t + 0.16, 0.05, 3, 'lowpass', 900, 0.7, 0.3); }, // up and down
    step: (t) => { burst(t, 0.05, 3, 'lowpass', 1100, 0.8, 0.32); tone(t, 0.06, 160, 0.2); },             // one square
    ghost: (t) => { tone(t, 0.42, 520, 0.07, 'sine', 1040); tone(t + 0.05, 0.38, 780, 0.05, 'sine', 1560); sweep(t, 0.35, 3000, 900, 2, 0.05); }, // a shimmer
    bow: (t) => { tone(t, 0.18, 196, 0.16, 'sawtooth', 160); tone(t, 0.12, 392, 0.06, 'triangle'); sweep(t + 0.03, 0.16, 5000, 1600, 1.6, 0.14); }, // the string, the arrow
    shield: (t) => { tone(t, 0.5, 1760, 0.07, 'triangle'); tone(t, 0.6, 2640, 0.04, 'sine'); tone(t + 0.01, 0.35, 1175, 0.05, 'triangle'); }, // a ring of metal
    splash: (t) => { sweep(t, 0.18, 900, 4200, 1.8, 0.2); },                                              // the sweep around
    purify: (t) => { [1319, 1760, 2349].forEach((f, i) => tone(t + i * 0.06, 0.4, f, 0.05, 'sine')); },  // a chime
    deal: (t) => { [0, 0.09, 0.18].forEach((dt) => sweep(t + dt, 0.06, 5200, 2400, 1.3, 0.12, 'highpass')); } // three cards dealt
  };
  // a shell goes in: the pump, back and forth (chk-chk)
  function pumpSound(t) {
    [0, 0.09].forEach((dt, i) => burst(t + dt, 0.025, 3, 'bandpass', i ? 1800 : 2500, 1.2, 0.22)); // a soft click-clack
  }
  function tone(t, dur, freq, vol, type, freq2) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  /* Real samples from the Lichess sound sets (standard: Move, Capture, GenericNotify, LowTime, Explosion,
     Promotion = Confirmation, Wrong = Error; sfx: Check; woodland: Correct = Confirmation). The end of a
     game is one plain notify, win or lose, no tune. Decoded up front so the first move is not late. */
  const SAMPLES = { move: 'Move', capture: 'Capture', notify: 'GenericNotify', lowtime: 'LowTime', boom: 'Explosion', check: 'Check', promo: 'Promotion', right: 'Correct', wrong: 'Wrong' };
  const SAMPLE_FOR = { move: 'move', castle: 'move', capture: 'capture', start: 'notify', win: 'notify', lose: 'notify', draw: 'notify', lowtime: 'lowtime', boom: 'boom', check: 'check', promo: 'promo', right: 'right', wrong: 'wrong' };
  const SAMPLE_VOL = { check: 0.45, promo: 0.7, right: 0.55, wrong: 0.7, win: 0.7, lose: 0.7, draw: 0.7 };
  const sampleBuf = {};
  (function loadSamples() {
    const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Off) return;
    const dec = new Off(1, 1, 44100);
    Object.keys(SAMPLES).forEach((k) => {
      fetch('sounds/' + SAMPLES[k] + '.mp3')
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing sound'))))
        .then((raw) => dec.decodeAudioData(raw))
        .then((buf) => { sampleBuf[k] = buf; })
        .catch(() => { /* the synth below covers a missing file */ });
    });
  })();
  function sample(k, vol, delay) {
    const src = AC.createBufferSource(), g = AC.createGain();
    src.buffer = sampleBuf[k];
    g.gain.value = vol;
    src.connect(g); g.connect(AC.destination);
    src.start(delay ? AC.currentTime + delay : 0);
  }
  function snd(kind, delay) {
    if (window.PWA) PWA.buzz(kind); // a phone also vibrates (Settings, Vibration)
    if (!settings.sound || !ac()) return;
    if (kind === 'shotgun') { gunshot(AC.currentTime + 0.005 + (delay || 0)); return; }
    if (kind === 'shell') { pumpSound(AC.currentTime + 0.005 + (delay || 0)); return; }
    if (kind === 'zap') { zapSound(AC.currentTime + 0.005 + (delay || 0)); return; }
    if (kind === 'hurt') { hurtSound(AC.currentTime + 0.005 + (delay || 0)); return; }
    if (kind === 'slash') { slashSound(AC.currentTime + 0.005 + (delay || 0)); return; }
    if (kind.indexOf('pb:') === 0) { const f = PB_SFX[kind.slice(3)]; if (f) f(AC.currentTime + 0.005 + (delay || 0)); return; }
    const key = SAMPLE_FOR[kind];
    if (key && sampleBuf[key]) {
      sample(key, SAMPLE_VOL[kind] || 0.8, delay || 0);
      if (kind === 'castle') sample(key, 0.7, (delay || 0) + 0.12); // king and rook: two pieces are put down
      return;
    }
    if (kind === 'check' || kind === 'promo' || kind === 'right' || kind === 'wrong') return; // no stand-in for these
    if (kind === 'win' || kind === 'lose' || kind === 'draw') kind = 'start'; // one plain note, never a tune
    const t = AC.currentTime + 0.005;
    if (kind === 'move') { noise(t, 0.07, 950, 1.2, 0.9); tone(t, 0.06, 170, 0.25); }
    else if (kind === 'capture') { noise(t, 0.06, 1500, 1, 0.9); noise(t + 0.035, 0.09, 700, 1.2, 0.9); tone(t, 0.08, 140, 0.3); }
    else if (kind === 'castle') { noise(t, 0.07, 950, 1.2, 0.8); noise(t + 0.11, 0.07, 850, 1.2, 0.8); }
    else if (kind === 'start') { tone(t, 0.12, 523, 0.1, 'triangle'); tone(t + 0.1, 0.2, 784, 0.1, 'triangle'); }
    else if (kind === 'gold') [1568, 2093, 2637, 3136].forEach((f, i) => tone(t + i * 0.05, 0.32, f, 0.06));
    else if (kind === 'ice') { [2400, 1900, 3100].forEach((f, i) => tone(t + i * 0.04, 0.22, f, 0.05, 'triangle')); noise(t, 0.18, 5200, 2, 0.35); }
    else if (kind === 'shot') { noise(t, 0.13, 2600, 0.7, 1.1); tone(t, 0.14, 1400, 0.1, 'sawtooth', 180); }
    else if (kind === 'clank') { tone(t, 0.16, 1850, 0.16, 'triangle', 1500); tone(t, 0.3, 2650, 0.07, 'sine', 2400); noise(t, 0.05, 3200, 1.4, 0.5); }
    else if (kind === 'boom') { noise(t, 0.5, 170, 0.6, 1.8); noise(t, 0.25, 640, 0.8, 0.8); tone(t, 0.4, 90, 0.35, 'sine', 40); }
    else if (kind === 'portal') { tone(t, 0.25, 320, 0.09, 'sine', 1250); tone(t + 0.04, 0.25, 480, 0.05, 'sine', 1800); }
    else if (kind === 'roll') { let at = t; for (let k = 0; k < 20; k++) { noise(at, 0.028, 1800 + Math.random() * 1600, 1.6, 0.42); at += 0.04 + k * 0.004; } } // dice rattling in a cup
    else if (kind === 'diestop') { noise(t, 0.05, 820, 1.3, 0.85); tone(t, 0.05, 210, 0.18); }
  }
  // The sound a move makes, the same everywhere: game, review, analysis and puzzles. check = it gives check.
  function moveSound(m, fx, check) {
    if (m.shot) { snd('shotgun'); if (check) snd('check', 0.2); return; } // a Shotgun King's blast
    if (m.reload) { snd('shell'); return; }
    if (fx && fx.bounce >= 0) snd('clank'); // off a helmet
    else if (m.snipe) snd('shot');
    else if (fx && fx.boom) snd('boom');
    else if (fx && fx.tp >= 0) snd('portal');
    else if (fx ? fx.capture : !!m.cap) snd('capture');
    else if (m.castle) snd('castle');
    else snd('move');
    if (m.promo) snd('promo', 0.09);
    if (check) snd('check', 0.07);
  }
  /* What moves on the board when a move is played. A captured piece stays on its square until the
     capturing piece gets there ({ ghost, at }), instead of vanishing the moment the move starts. */
  function moveAnims(before, m, fx) {
    const list = fx && fx.anims ? fx.anims.slice() : [];
    if (fx && fx.capture && !fx.boom && m.to >= 0 && !m.swap) {
      const at = before.board[m.to] ? m.to : m.capSq >= 0 ? m.capSq : -1; // en passant takes next to where it lands
      if (at >= 0 && before.board[at]) list.push({ ghost: before.board[at], at: at });
    }
    return list;
  }

  /* ---------- board drawing ---------- */

  /* Hexagonal Chess: the board is 91 hexagons, flat side up, in 11 files. A cell's box (for its piece, hints and
     marks) is one hexagon high and as wide; the files stand 0.866 boxes apart, neighbours in the next file half a
     box higher or lower. BHEX says the board on screen is the hex one; BW then holds its width in boxes. */
  let BHEX = false, BSHOGI = false;
  const HEXW = 10 * 0.8660254 + 1.1547005;
  function hexCenter(i) {
    const c = Hex.CELLS[i];
    let x = (c.q + 5) * 0.8660254 + 0.5773503, y = 11.5 - (2 * c.rank + Math.abs(c.q)) / 2;
    if (ui.flipped) { x = HEXW - x; y = 11 - y; }
    return [x, y];
  }
  function setDims(W, H, hex) {
    hex = !!hex;
    if (hex) { W = HEXW; H = 11; }
    if (W === BW && H === BH && hex === BHEX && L.squares.children.length) return;
    BW = W; BH = H; BHEX = hex;
    document.body.classList.toggle('bigboard', Math.max(W, H) > 10); // the phone's editor shows the zoom buttons only where zooming helps
    board.classList.toggle('hex', hex);
    const st = document.documentElement.style;
    st.setProperty('--W', W); st.setProperty('--H', H); st.setProperty('--M', Math.max(W, H));
    setZoom(1); // a new size starts with the whole board in view
    L.arrows.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    buildSquares();
  }
  /* Zoom for boards bigger than 8 x 8: from 1 (the whole board fits) up to squares as big as on the normal
     board. The board grows inside #boardview, which scrolls; at = the point of the board to keep in place. */
  ui.zoom = 1;
  const zoomMax = () => (BHEX ? 1 : Math.max(1, Math.max(BW, BH) / 8));
  function setZoom(z, at) {
    const view = $('#boardview');
    z = Math.max(1, Math.min(zoomMax(), z));
    const old = ui.zoom || 1, vr = view.getBoundingClientRect();
    // the board point under `at` (or the middle of the view), as a share of the board
    const px = at ? at.x - vr.left : vr.width / 2, py = at ? at.y - vr.top : vr.height / 2;
    const bw = view.scrollWidth || 1, bh = view.scrollHeight || 1;
    const fx = (view.scrollLeft + px) / bw, fy = (view.scrollTop + py) / bh;
    ui.zoom = z;
    document.documentElement.style.setProperty('--Z', z);
    $('#zoombar').classList.toggle('on', zoomMax() > 1);
    $('#zoomPct').textContent = Math.round(z / zoomMax() * 100) + '%';
    if (z !== old) { view.scrollLeft = fx * view.scrollWidth - px; view.scrollTop = fy * view.scrollHeight - py; }
    if (z === 1) { view.scrollLeft = 0; view.scrollTop = 0; }
  }
  function sqXY(sq) {
    if (BHEX) { const c = hexCenter(sq); return [c[0] - 0.5, c[1] - 0.5]; }
    let f = sq % BW, r = Math.floor(sq / BW);
    if (ui.flipped) { f = BW - 1 - f; r = BH - 1 - r; }
    return [f, r];
  }
  function evSq(e) {
    const rc = board.getBoundingClientRect();
    if (BHEX) {
      // the nearest hexagon centre, if the point is inside a cell at all
      const px = (e.clientX - rc.left) / rc.width * BW, py = (e.clientY - rc.top) / rc.height * BH;
      let best = -1, bd = 0.36;
      for (let i = 0; i < Hex.N; i++) { const c = hexCenter(i), d = (c[0] - px) * (c[0] - px) + (c[1] - py) * (c[1] - py); if (d < bd) { bd = d; best = i; } }
      return best;
    }
    let f = Math.floor((e.clientX - rc.left) / rc.width * BW), r = Math.floor((e.clientY - rc.top) / rc.height * BH);
    if (f < 0 || f >= BW || r < 0 || r >= BH) return -1;
    if (ui.flipped) { f = BW - 1 - f; r = BH - 1 - r; }
    return r * BW + f;
  }
  function place(el, sq) {
    const xy = sqXY(sq);
    el.style.left = xy[0] * 100 / BW + '%';
    el.style.top = xy[1] * 100 / BH + '%';
    return el;
  }
  function trans(sq) { const xy = sqXY(sq); return 'translate(' + xy[0] * 100 + '%,' + xy[1] * 100 + '%)'; }
  function sqLabel(sq) { return BHEX ? Hex.CELLS[sq].name : Fairy.sqName(sq, BW, BH); }

  function buildSquares() {
    L.squares.innerHTML = '';
    L.squares.classList.toggle('hexg', BHEX);
    L.squares.classList.toggle('b9', BW === 9 && BH === 9 && !BHEX); // the shogi board's star points
    if (BHEX) { L.squares.innerHTML = hexBoardSvg(); return; }
    for (let row = 0; row < BH; row++) for (let col = 0; col < BW; col++) {
      const r = ui.flipped ? BH - 1 - row : row, f = ui.flipped ? BW - 1 - col : col;
      const d = h('div', 'sq' + (((f + BH - 1 - r) % 2 === 0) ? ' d' : ''));
      if (col === 0) d.appendChild(h('span', 'rk', BSHOGI ? Fairy.FILES[r] : String(BH - r)));
      if (row === BH - 1) d.appendChild(h('span', 'fl', BSHOGI ? String(BW - f) : Fairy.FILES[f]));
      L.squares.appendChild(d);
    }
  }

  // The hex board: three shades of the theme's colours, file letters on the lowest cells, ranks on the left edge.
  function hexBoardSvg() {
    const R0 = 0.5773503, fills = ['var(--sq-light)', 'color-mix(in srgb, var(--sq-light) 48%, var(--sq-dark))', 'var(--sq-dark)'];
    let g = '<svg class="hexsvg" viewBox="0 0 ' + HEXW + ' 11" preserveAspectRatio="none">';
    Hex.CELLS.forEach((c) => {
      const ctr = hexCenter(c.i), pts = [];
      for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; pts.push((ctr[0] + R0 * Math.cos(a)).toFixed(4) + ',' + (ctr[1] + R0 * Math.sin(a)).toFixed(4)); }
      g += '<polygon points="' + pts.join(' ') + '" style="fill:' + fills[c.color] + '"/>';
      const ink = c.color === 2 ? 'var(--sq-light)' : 'var(--sq-dark)';
      if (c.rank === (ui.flipped ? 11 - Math.abs(c.q) : 1)) g += '<text class="hexl" x="' + ctr[0].toFixed(3) + '" y="' + (ctr[1] + (ui.flipped ? -0.3 : 0.4)).toFixed(3) + '" style="fill:' + ink + '">' + c.name[0] + '</text>';
      if (c.q === (ui.flipped ? 5 : -5) || (c.top && c.q <= 0 && !ui.flipped) || (c.rank === 1 && c.q >= 0 && ui.flipped)) g += '<text class="hexl" x="' + (ctr[0] - 0.36).toFixed(3) + '" y="' + (ctr[1] + 0.06).toFixed(3) + '" style="fill:' + ink + '">' + c.rank + '</text>';
    });
    return g + '</svg>';
  }

  /* Draw a piece into an element. Compound pieces get a base piece plus a badge,
     unknown letters a disc with the letter. */
  function paint(el, p, glyphs, cfg, extra) {
    const c = R.colorOf(p), t = p.toLowerCase();
    if (extra) el.className += extra; // upgrades placed by hand on this one piece
    let g = glyphs && glyphs[t];
    const pw = !g && cfg ? pwOf(cfg, c) : null;
    el.classList.add(c === 'w' ? 'lt' : 'dk'); // light or dark piece, the skins blend differently
    if (pw) {
      if (t === 'n' && pw.dragon) g = ['N', 'B', 'dragon'];
      else if (t === 'q' && pw.amazon) g = ['Q', 'N', 'amazon'];
      const skin = skinOf(t, pw);
      if (skin) el.className += skin;
    }
    const std = 'pnbrqk'.indexOf(t) >= 0, camo = el.classList.contains('camo');
    if (!g && R.isFairy(p)) { const fd = R.fairyOf(p); g = [fd.base, fd.badge, fd.pic]; } // a fairy piece on the plain board
    if (g) {
      const role = fairyRole(g);
      // a shogi piece points at the other side: on a turned board each one is turned round too (statues and ice as well)
      if (role && role.indexOf('shogi_') === 0 && ui.flipped && el.classList.contains('piece')) el.classList.add('sgturn');
      if (role && camo && SKIN.camo[c + '_' + role]) el.style.backgroundImage = skinUrl('camo', c + '_' + role);
      else if (role === 'shotgunking' && !camo) el.style.backgroundImage = skGunKing(c);
      else if (role && !camo) el.style.backgroundImage = 'url(' + fairyPic(c, role) + ')';
      else {
        el.style.backgroundImage = camo ? skinUrl('camo', c + g[0]) : imgUrl(c + g[0]);
        if (g[1]) {
          const bd = h('i', 'badge');
          bd.style.backgroundImage = imgUrl(c + g[1]);
          el.appendChild(bd);
        }
      }
    } else if (std) el.style.backgroundImage = camo ? skinUrl('camo', c + t.toUpperCase()) : 'url(' + pieceUrl(p) + ')';
    else el.appendChild(h('b', 'disc ' + c, t.toUpperCase()));
    return el;
  }

  function lastSquares(e) {
    if (e.roll) return [];
    if (e.gild != null) return [e.gild];
    if (e.freeze != null) return [e.freeze];
    if (e.shield != null) return [e.shield];
    if (e.convert != null) return [e.convert];
    if (e.powerup != null) return [e.powerup];
    if (e.downgrade != null) return [e.downgrade];
    if (e.spike != null) return [e.spike];
    if (e.horn != null) return [e.horn];
    if (e.ouItem) return [e.a, e.b].filter((q) => q >= 0);
    if (!e.m || e.stop || e.m.storm) return [];
    if (e.m.drop) return [e.m.to];
    const out = [e.m.from, e.m.to];
    if (e.tp >= 0) out.push(e.tp);
    return out;
  }

  function renderBoard(anims) {
    const v = view(), s = v.s, md = mode(), inGame = md === 'game', an = md === 'analysis';
    if (s && s.duckPhase && ((inGame && G && isLive() && canAct()) || (an && canAnalyse()))) duckAuto(s, an ? A.legal : G.legal);
    setDims(v.W, v.H, v.hex);
    const shogi = !!(v.glyphs && v.glyphs['+p']); // a game of Shogi: a shogi board, with its files 9 to 1 and ranks a to i
    // a board of only shogi pieces takes the Shogi board too (its squares keep the chess names: the moves use them)
    const onlyShogi = !shogi && s && s.board.some(Boolean) && s.board.every((p) => !p || (R.isFairy(p) && R.fairyOf(p).shogi));
    applyBoard(v.pb ? 'pawnbarian' : shogi || onlyShogi ? settings.shogiBoard || 'shogi' : settings.theme, !v.pb && (shogi || onlyShogi));
    if (shogi !== BSHOGI) { BSHOGI = shogi; buildSquares(); }
    L.marks.innerHTML = '';
    const mark = (sq, cls) => L.marks.appendChild(place(h('div', 'mark ' + cls), sq));
    const trial = reviewing() && rv.trial ? rv.trial : rvPeek();
    if (inGame) {
      if (trial) lastSquares({ m: trial.m, tp: trial.state.fx ? trial.state.fx.tp : -1 }).forEach((sq) => mark(sq, 'last'));
      else if (G.view > 0) lastSquares(G.log[G.view - 1]).forEach((sq) => mark(sq, 'last'));
      s.gold.forEach((sq) => mark(sq, 'goldsq'));
      (s.ice || []).forEach((sq) => mark(sq, 'frozen'));
      G.B.checks(s).forEach((sq) => mark(sq, 'check'));
      const pts = ui.mode === 'portal' ? ui.draft : s.portals;
      pts.forEach((sq, i) => mark(sq, 'portal' + (i ? ' b' : '')));
      if (isLive()) ui.premoves.forEach((pm) => { mark(pm.from, 'premove'); mark(pm.to, 'premove'); });
      if (settings.danger && dangerGame() && !G.over) dangerSquares(s, G.cfg, R.other(G.auto ? s.turn : mySide())).forEach((q) => mark(q, 'danger' + (s.board[q] ? ' hit' : '')));
      // the Alarm bell (The Ouroboros King): the King's square is marked while it is under attack, guarded by a Prince or not
      else if (runGame() && Ouro.has(ouroRun(), 'bell') && !G.over) { const me = mySide(), ks = s.board.findIndex((p) => p && R.colorOf(p) === me && R.isRoyal(p)); if (ks >= 0 && R.attacked(s, ks, R.other(me), G.cfg)) mark(ks, 'danger hit'); }
    } else if (an) {
      if (A.cur.m) lastSquares({ m: A.cur.m, tp: A.cur.state.fx ? A.cur.state.fx.tp : -1 }).forEach((sq) => mark(sq, 'last'));
      s.gold.forEach((sq) => mark(sq, 'goldsq'));
      (s.ice || []).forEach((sq) => mark(sq, 'frozen'));
      A.B.checks(s).forEach((sq) => mark(sq, 'check'));
      s.portals.forEach((sq, i) => mark(sq, 'portal' + (i ? ' b' : '')));
    } else if (md === 'modes') {
      modesMarks(mark);
    } else if (md === 'puzzle') {
      if (pz.cur.last && !pz.cur.shown) pz.cur.last.forEach((sq) => mark(sq, 'last'));
      s.gold.forEach((sq) => mark(sq, 'goldsq'));
      (s.ice || []).forEach((sq) => mark(sq, 'frozen'));
      R.checkedSquares(s, s.turn, pz.cur.cfg).forEach((sq) => mark(sq, 'check'));
    }
    // terrain: boulders, water and the fixed teleporters
    const ter = v.cfg && v.cfg.terrain;
    if (ter) {
      (ter.walls || []).forEach((sq) => { if (!(s.rocks && s.rocks.indexOf(sq) >= 0)) mark(sq, 'wall'); }); // an infiltrator may have broken some
      (ter.water || []).forEach((sq) => mark(sq, 'water'));
      (ter.holes || []).forEach((sq) => mark(sq, 'hole')); // squares taken off the board
      if (ter.portals && ter.portals.length === 2 && !(inGame && s.portals.length === 2)) ter.portals.forEach((sq, i) => mark(sq, 'portal' + (i ? ' b' : '')));
      else if (ter.portals && ter.portals.length === 1 && md === 'editor') mark(ter.portals[0], 'portal');
    }
    // The Ouroboros King: boulders put there during the game, and bombs
    (s.boulders || []).forEach((sq) => mark(sq, 'wall'));
    (s.bombs || []).forEach((sq) => mark(sq, 'bomb'));
    // ducks: where they stand now in a game, where the editor puts them otherwise
    const dsrc = (inGame || an || md === 'puzzle') && s.ducks ? s : (ter || {});
    (dsrc.ducks || []).forEach((sq) => mark(sq, 'duck'));
    (dsrc.bducks || []).forEach((sq) => mark(sq, 'duck blue'));
    ui.marks.forEach((sq) => mark(sq, 'user'));
    if (ui.sel && ui.sel.sq >= 0 && (inGame || an || md === 'puzzle')) mark(ui.sel.sq, 'sel');

    L.pieces.innerHTML = '';
    const els = {};
    // queued premoves are shown as if they had been played
    const brd = inGame && !trial && isLive() && ui.premoves.length && ui.tab !== 'review' ? pmBoard(s) : s.board;
    for (let sq = 0; sq < brd.length; sq++) {
      const p = brd[sq];
      if (!p) continue;
      if (inGame && fogged(R.colorOf(p))) continue; // Fog of War
      const gold = s.gold.indexOf(sq) >= 0, ice = !gold && !!s.ice && s.ice.indexOf(sq) >= 0;
      const d = h('div', 'piece' + (gold ? ' gold' : '') + (ice ? ' ice' : '') + (s.reborn && s.reborn.indexOf(sq) >= 0 ? ' spent' : '') + (s.guard && s.guard.indexOf(sq) >= 0 ? ' shielded' : '')); // spent: a fire chick or phoenix that already came back; shielded: Shield
      const up = (s.snipers && s.snipers.indexOf(sq) >= 0 && !/camo/.test(d.className) ? ' camo' : '') + (s.ghosts && s.ghosts.indexOf(sq) >= 0 ? ' ghost' : '');
      // a variant's raw token where it is drawn differently: a promoted shogi piece is '+B' (the board holds the bare 'B')
      const tok = s.raw && s.raw[sq] && s.raw[sq] !== p && v.glyphs && v.glyphs[s.raw[sq].toLowerCase()] ? s.raw[sq] : p;
      paint(d, tok, v.glyphs, v.cfg, up);
      wearOn(d, s, sq);
      if (gold || ice) {
        /* a statue or a frozen piece keeps its shape and the shade of its side: bright gold or pale ice for
           White, deep gold or dark blue for Black. A frozen sniper keeps its vine, a ghost its style. */
        const kind = (gold ? 'gold' : 'ice') + (d.classList.contains('camo') ? 'camo' : ''), c = R.colorOf(p);
        const gl = v.glyphs && v.glyphs[tok.toLowerCase()];
        let role = fairyRole(gl);
        if (!gl && R.isFairy(p) && !(v.glyphs && Object.keys(v.glyphs).length)) role = R.fairyOf(p).pic; // a fairy piece on the plain board
        if (!gl && !R.isFairy(p) && v.cfg && 'nq'.indexOf(p.toLowerCase()) >= 0) {
          const pw = pwOf(v.cfg, c); // a dragon knight or an amazon is drawn as a fairy piece
          if (pw && p.toLowerCase() === 'n' && pw.dragon) role = 'dragon';
          if (pw && p.toLowerCase() === 'q' && pw.amazon) role = 'amazon';
        }
        const base = gl ? gl[0] : 'pnbrqk'.indexOf(p.toLowerCase()) >= 0 ? p.toUpperCase() : '';
        if (role && SKIN[kind][c + '_' + role]) d.style.backgroundImage = skinUrl(kind, c + '_' + role);
        else if (base && !role) d.style.backgroundImage = skinUrl(kind, c + base);
      }
      d.style.transform = trans(sq);
      d.dataset.sq = sq;
      if (s.sg && s.dmg) {
        // a Shotgun King game: every piece shows its hit points as in the Shotgun King mode, one dash per point
        const mx = R.hpOf(p), left = Math.max(0, Math.ceil(mx - (s.dmg[sq] || 0) - 1e-9));
        if (mx <= 12) d.appendChild(h('i', 'skhp seg', Array.from({ length: mx }, (_, i) => '<u class="' + (i < left ? 'on' : '') + '"></u>').join('')));
        else d.appendChild(h('i', 'skhp', '<b style="width:' + (left / mx * 100) + '%"></b><span>' + left + '</span>'));
      }
      L.pieces.appendChild(d);
      els[sq] = d;
    }
    if (v.sk) skDecorate(els);
    if (v.pb) pbDecorate(els);
    if (anims && settings.anim) anims.forEach((a) => {
      const dropped = ui.dropFrom >= 0; // the piece was carried there by hand: nothing left to slide
      if (a.ghost) {
        if (dropped) return;
        const g = h('div', 'piece');
        paint(g, a.ghost, v.glyphs, v.cfg);
        g.style.transform = trans(a.at);
        L.pieces.insertBefore(g, L.pieces.firstChild);
        const fade = g.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 190, fill: 'forwards' });
        fade.onfinish = () => g.remove();
        setTimeout(() => g.remove(), 400); // a tab in the background does not run animations
        return;
      }
      const d = els[a.to];
      if (!d || (dropped && a.from === ui.dropFrom)) return;
      d.style.zIndex = 5;
      d.animate([{ transform: trans(a.from) }, { transform: trans(a.to) }], { duration: 170, easing: 'ease-out' });
    });
    if (anims) ui.dropFrom = -1;
    // A drag that was running while the board was redrawn keeps its piece.
    if (ui.drag) {
      const el = els[ui.drag.sq];
      if (!el) ui.drag = null;
      else {
        ui.drag.el = el;
        if (ui.drag.moved && ui.drag.tf) { el.classList.add('dragging'); el.style.transform = ui.drag.tf; }
      }
    }

    L.hints.innerHTML = '';
    const hint = (sq, cls) => L.hints.appendChild(place(h('div', 'hint ' + cls), sq));
    if ((inGame && (canAct() || canTry())) || (an && canAnalyse()) || (md === 'puzzle' && pzCanMove())) {
      const PB = md === 'puzzle' ? pz.cur.B : G.B, plg = md === 'puzzle' ? pz.cur.legal : G.legal;
      // the free actions belong to the live game (or the puzzle): never mark them on a board that shows another position
      const freeOk = md === 'puzzle' || (inGame && canAct() && s === live());
      if (ui.mode && !freeOk && (ui.mode === 'gild' || ui.mode === 'freeze' || ui.mode === 'convert' || ui.mode === 'shield' || ui.mode === 'powerup' || ui.mode === 'downgrade' || ui.mode.indexOf('ou:') === 0)) ui.mode = null;
      if ((ui.mode === 'powerup' || ui.mode === 'downgrade') && inGame) ouTargets(ui.mode, s).forEach((sq) => hint(sq, ui.mode === 'powerup' ? 'gild' : 'turn'));
      if (ui.mode && ui.mode.indexOf('ou:') === 0 && inGame && freeOk) { ouRuleTargets(ui.mode.slice(3), s).forEach((sq) => hint(sq, 'shieldh')); if (ui.ouA >= 0) mark(ui.ouA, 'sel'); }
      if (ui.mode === 'gild') PB.gildTargets(s, plg).forEach((sq) => hint(sq, 'gild'));
      else if (ui.mode === 'freeze') PB.freezeTargets(s).forEach((sq) => hint(sq, 'cold'));
      else if (ui.mode === 'shield') PB.shieldTargets(s).forEach((sq) => hint(sq, 'shieldh'));
      else if (ui.mode === 'convert') PB.convertTargets(s).forEach((sq) => hint(sq, 'turn'));
      else if (ui.sel && settings.legal) {
        const seen = {};
        ui.sel.moves.forEach((m) => {
          if (seen[m.to]) return;
          seen[m.to] = true;
          const cands = ui.sel.moves.filter((x) => x.to === m.to), plain = cands.filter((x) => !x.snipe && !x.shot);
          if (cands.some((x) => x.swap)) hint(m.to, 'swap');
          else if (plain.length) {
            // a jump looks different from a move along a line
            const jump = plain.every((x) => x.jump);
            hint(m.to, s.board[m.to] ? (jump ? 'jumpring' : 'ring') : (jump ? 'jump' : 'dot'));
          }
          if (cands.some((x) => x.snipe || (x.shot && !sgArmed()))) hint(m.to, 'aim');
        });
        if (ui.sel.blast) blastZone(s, ui.sel.sq).forEach((q) => hint(q, 'blast')); // what the vest would take with it
      }
    }
    if (v.sk) skHints(hint);
    if (v.pb) pbHints(hint);
    // a look at a piece of the other side: where it could go
    if (ui.peek && ui.peek.state === s && (inGame || an)) {
      hint(ui.peek.sq, 'peeksel');
      ui.peek.to.forEach((x) => hint(x.to, 'peek' + (x.cap ? ' cap' : '')));
      (ui.peek.reach || []).forEach((x) => hint(x.to, 'peek ' + (x.guard ? 'guard' : 'reach'))); // captures only, and take-backs
    }
    // the king guard (king capture): for this one turn every square the other side attacks is tinted
    if (ui.threat && ui.threat.state === s && inGame && isLive()) ui.threat.squares.forEach((q) => hint(q, 'threat'));
    // Review: the rating of the move sits on the corner of its square.
    if (inGame && reviewing()) {
      let cls = null, at = -1;
      if (trial) { cls = trial.cls; at = trial.state.fx && trial.state.fx.tp >= 0 ? trial.state.fx.tp : trial.m.to; }
      else if (G.view > 0) {
        const q = rv.plies[G.view - 1], e = G.log[G.view - 1];
        if (q && q.cls && e.m) { cls = q.cls; at = e.tp >= 0 ? e.tp : e.m.to; }
      }
      if (cls && at >= 0) {
        const c = Review.CLASSES[cls];
        L.hints.appendChild(place(h('div', 'hint clsb', '<i style="background:' + c.color + '">' + c.sym + '</i>'), at));
      }
    }
    // Puzzles: right or wrong, shown on the square the move went to.
    if (md === 'puzzle' && pz.cur.mark) {
      const k = pz.cur.mark;
      L.hints.appendChild(place(h('div', 'hint clsb', '<i style="background:' + (k.ok ? '#81b64c' : '#e04040') + '">' + (k.ok ? '\u2713' : '\u2715') + '</i>'), k.sq));
    }
    renderArrows();
  }

  function renderArrows() {
    const list = ui.arrows.slice();
    if (ui.hintArrow) list.push(ui.hintArrow);
    if (mode() === 'analysis' && A.arrows && A.on && A.lines[0] && (A.lines[0].act || A.lines[0].pv.length)) {
      const bm = A.lines[0].act ? A.lines[0].act.m : A.B.find(A.legal, A.lines[0].pv[0]);
      if (bm && bm.from >= 0) list.push({ from: bm.from, to: bm.to, color: '#8fd13f' });
    }
    if (reviewing() && rv.trial && rv.trial.kind === 'best' && rv.trial.m.from >= 0) list.push({ from: rv.trial.m.from, to: rv.trial.m.to, color: '#8fd13f' });
    if (rvPeek() && rv.peek.m.from >= 0 && rv.peek.m.to >= 0) list.push({ from: rv.peek.m.from, to: rv.peek.m.to, color: '#f0b400' });
    if (ui.threat && G && mode() === 'game' && isLive() && ui.threat.state === live()) ui.threat.arrows.forEach((a) => list.push(a));
    let out = '';
    list.forEach((a) => {
      const p1 = sqXY(a.from), p2 = sqXY(a.to);
      const x1 = p1[0] + 0.5, y1 = p1[1] + 0.5, x2 = p2[0] + 0.5, y2 = p2[1] + 0.5;
      const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const sx = x1 + ux * 0.34, sy = y1 + uy * 0.34, ex = x2 - ux * 0.4, ey = y2 - uy * 0.4;
      const col = a.color || '#ffaa00';
      out += '<g opacity=".8"><line x1="' + sx + '" y1="' + sy + '" x2="' + ex + '" y2="' + ey + '" stroke="' + col + '" stroke-width=".2"/>' +
        '<polygon fill="' + col + '" points="' + x2 + ',' + y2 + ' ' + (ex - uy * 0.27) + ',' + (ey + ux * 0.27) + ' ' + (ex + uy * 0.27) + ',' + (ey - ux * 0.27) + '"/></g>';
    });
    if (mode() === 'modes' && gmTab === 'sk') out += skCone();
    if (sgArmed() && ui.sgHover >= 0 && sgShotTo(ui.sgHover)) out += coneSvg(ui.sel.sq, ui.sgHover, R.SG.arc, R.SG.rmin, R.SG.rmax);
    L.arrows.innerHTML = out;
  }

  function fxRing(sq, cls) {
    const d = place(h('div', 'ring ' + cls), sq);
    L.fx.appendChild(d);
    setTimeout(() => d.remove(), 650);
  }
  function fxTracer(from, to) {
    const p1 = sqXY(from), p2 = sqXY(to);
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', p1[0] + 0.5); ln.setAttribute('y1', p1[1] + 0.5);
    ln.setAttribute('x2', p2[0] + 0.5); ln.setAttribute('y2', p2[1] + 0.5);
    ln.setAttribute('stroke', '#ff3b1f'); ln.setAttribute('stroke-width', '.09'); ln.setAttribute('stroke-linecap', 'round');
    L.arrows.appendChild(ln);
    ln.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: 'ease-in' }).onfinish = () => ln.remove();
    fxRing(to, 'boom');
  }

  /* ---------- player bars, clocks, eval ---------- */

  function capturedBy(color) {
    const out = [];
    if (mode() !== 'game') return out;
    for (let i = 0; i < G.view; i++) {
      const e = G.log[i];
      if (e.by === color && e.removed) e.removed.forEach((x) => out.push(x.p));
    }
    return out.sort((a, b) => (VALUE[R.typeOf(a)] || 4) - (VALUE[R.typeOf(b)] || 4) || (a < b ? -1 : a > b ? 1 : 0));
  }
  function material(s) {
    let d = 0;
    for (let i = 0; i < s.board.length; i++) {
      const p = s.board[i];
      if (!p) continue;
      const t = R.typeOf(p), f = VALUE[t] == null ? R.fairyOf(p) : null;
      d += (R.colorOf(p) === 'w' ? 1 : -1) * (VALUE[t] != null ? VALUE[t] : f && !f.royal ? Math.round(f.value / 100) : 0); // fairy pieces by their value
    }
    return d;
  }
  function fmtClock(ms) {
    if (ms < 0) ms = 0;
    const t = Math.ceil(ms / 1000), m = Math.floor(t / 60), s = t % 60;
    if (ms < 20000) return '0:' + (ms / 1000 < 10 ? '0' : '') + (Math.floor(ms / 100) / 10).toFixed(1);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fillBar(elm, color) {
    const md = mode(), inGame = md === 'game', v = view();
    let you = false, name, tag = '';
    if (md === 'analysis' || md === 'puzzle' || ui.tab === 'puzzles') name = color === 'w' ? 'White' : 'Black';
    else if (md === 'modes') { const mb = modesBar(color); you = mb.you; name = mb.name; tag = mb.tag; }
    else if (inGame) { you = !G.auto && !G.local && color === G.cfg.side; name = G.names[color]; tag = G.tags[color] || ''; }
    else if (setup.mode === 'bots') {
      const b = color === 'w' ? setup.botW : setup.botB, lab = botLabel(botById(b.bot), prefEngine(b.engine) === 'fairy', ownName());
      name = lab.name; tag = lab.tag;
    } else if (setup.mode === 'local') name = color === 'w' ? 'White' : 'Black';
    else {
      you = color === (ui.flipped ? 'b' : 'w');
      const lab = botLabel(botById(setup.bot), engineKind() === 'fairy', ownName());
      name = you ? 'You' : lab.name; tag = you ? '' : lab.tag;
    }
    const human = you || md === 'analysis' || md === 'puzzle' || ui.tab === 'puzzles';
    elm.innerHTML = '';
    const av = h('div', 'avatar' + (human ? '' : ' bot'));
    av.style.backgroundImage = imgUrl(color + (you ? 'P' : 'K'));
    const meta = h('div', 'pmeta');
    meta.appendChild(h('div', 'pname', name + (tag ? '<span>(' + tag + ')</span>' : '')));
    const caps = h('div', 'pcaps'), list = capturedBy(color);
    list.forEach((p, i) => {
      const ic = paint(h('i', i < list.length - 1 && list[i + 1] !== p ? 'gap' : ''), p, v.glyphs, null);
      caps.appendChild(ic);
    });
    if (inGame && G.B.kind === 'std') {
      const diff = material(v.s) * (color === 'w' ? 1 : -1);
      if (diff > 0) caps.appendChild(h('b', '', '+' + diff));
    }
    meta.appendChild(caps);
    elm.appendChild(av); elm.appendChild(meta);
    const clk = h('div', 'clock ' + (color === 'w' ? 'white' : ''));
    clk.id = 'clk-' + color;
    elm.appendChild(clk);
  }
  function renderBars() {
    const bottom = ui.flipped ? 'b' : 'w';
    fillBar($('#barBot'), bottom);
    fillBar($('#barTop'), R.other(bottom));
    renderClocks();
  }
  function renderClocks() {
    ['w', 'b'].forEach((c) => {
      const el = $('#clk-' + c);
      if (!el) return;
      if (mode() !== 'game' || !G.clock.on) { el.classList.add('hide'); return; }
      const running = !G.over && live().turn === c;
      el.classList.remove('hide');
      el.classList.toggle('on', running);
      el.classList.toggle('low', G.clock[c] < 20000);
      el.textContent = fmtClock(G.clock[c]);
    });
  }
  setInterval(() => {
    if (!G || !G.clock.on || G.over) return;
    const now = performance.now(), c = live().turn;
    G.clock[c] -= now - G.clock.last;
    G.clock.last = now;
    if (G.clock[c] <= 0) { G.clock[c] = 0; finish({ over: true, result: R.other(c), reason: 'timeout' }); return; }
    if ((G.local || c === G.cfg.side) && !G.clock.warned && G.clock[c] < 20000) { G.clock.warned = true; snd('lowtime'); }
    renderClocks();
  }, 100);

  /* The bar in a game shows the median of the last three verdicts of consecutive positions. A single position
     that a short search misreads (a freeze duel, an exchange half done) then does not throw the bar about,
     while a real change shows one action later. A mate is shown at once, and going back starts afresh. */
  const barHist = { game: null, at: -1, cps: [] };
  function smoothCp(cp) {
    if (!G || mode() !== 'game' || reviewing()) return cp;
    const at = G.states.length;
    if (barHist.game !== G || at < barHist.at) { barHist.game = G; barHist.cps = []; }
    if (at === barHist.at && barHist.cps.length) barHist.cps.pop(); // a newer verdict on the same position replaces the older one
    barHist.at = at;
    barHist.cps.push(cp);
    if (barHist.cps.length > 3) barHist.cps.shift();
    const sorted = barHist.cps.slice().sort((x, y) => x - y);
    return sorted[(sorted.length - 1) >> 1];
  }
  function setEval(info, turn) {
    const sign = turn === 'w' ? 1 : -1;
    const cp = info.score.cp != null ? smoothCp(info.score.cp * sign) : null;
    if (cp === null) barHist.cps = [];
    ui.eval = { cp: cp, mate: info.score.mate != null ? info.score.mate * sign : null, depth: info.depth, lost: info.score.mate === 0 ? turn : null };
    ui.evalFor = G ? live() : null; // the position this verdict belongs to
    renderEval();
  }
  /* In Dice Chess the coming rolls are luck: a lead the engine counts as decisive often is not, because the
     side that is ahead may not be allowed the move that wins. The bar and the graph show it at half strength. */
  const DICE_SOFT = 0.5;
  const softEv = (e) => (G && G.dice && e && e.cp != null ? Object.assign({}, e, { cp: e.cp * DICE_SOFT }) : e);
  /* How much a lead in material means depends on how much is still on the board: ten pawns up among a few
     hundred pawns' worth of pieces is far from the won game that ten pawns up in normal chess is (Stockfish's own
     win-rate model also asks for a bigger lead when more material is on the board). The engines count leads in
     pawns, so on boards with more than the 78 pawns' worth of a normal start (kings left out) the bar and the
     review's win chances read the lead as cp * sqrt(78 / material). The square root and not the plain ratio:
     the side ahead can trade down, and every trade makes the same lead count for more. Normal chess and smaller
     armies keep the plain reading. */
  const STD_MATERIAL = 78, MAT_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  function matScale(st) {
    if (!st || !st.board || !st.board.length) return 1;
    let total = 0;
    for (let i = 0; i < st.board.length; i++) {
      const p = st.board[i];
      if (!p || (st.gold && st.gold.indexOf(i) >= 0)) continue; // a statue is no material any more
      const t = String(p).replace(/[^\p{L}]/gu, '').toLowerCase();
      if (!t) continue;
      if (MAT_VAL[t] != null) total += MAT_VAL[t];
      else if (R.isFairy(t)) { const d = R.fairyOf(t); total += d.royal ? 0 : d.value / 100; }
      else total += 3; // a piece of a variant the app does not value: about a minor piece
    }
    return total > STD_MATERIAL ? Math.sqrt(STD_MATERIAL / total) : 1;
  }
  // the position the bar speaks about
  const barState = () => (mode() === 'analysis' ? A && A.cur && A.cur.state : G ? G.states[Math.min(G.view, G.states.length - 1)] : null);
  function renderEval() {
    const bar = $('#evalbar'), num = $('#evalnum');
    let ev = ui.eval;
    // A variant with power-ups: the engine's verdict plus what the power-ups change about it.
    if (G && G.pd && G.pd.state === live() && ui.evalFor === G.pd.state && mode() === 'game') {
      if (G.pd.mate != null) ev = { cp: null, mate: G.pd.mate, depth: ev.depth, lost: null };
      else if (ev.mate == null) ev = { cp: ev.cp + G.pd.cp, mate: null, depth: ev.depth, lost: null };
    }
    if (reviewing()) {
      // the review's own verdict for the position on the board
      const e = rv.trial ? rv.trial.ev : rv.evals[G.view].ev;
      if (e.win) ev = e.win === 'draw' ? { cp: 0, mate: null, depth: 0 } : { cp: null, mate: 0, lost: R.other(e.win), depth: 0 };
      else ev = e.mate != null ? { cp: null, mate: e.mate, depth: 0 } : { cp: e.cp, mate: null, depth: 0 };
    }
    if (mode() === 'analysis') ev = A.term ? barEv({ win: A.term.result }) : (A.lines[0] ? barEv(A.lines[0].ev) : { cp: 0, mate: null, depth: 0 });
    bar.classList.toggle('off', !settings.evalBar || (mode() !== 'game' && mode() !== 'analysis') || (mode() === 'game' && ranked()));
    bar.classList.toggle('flip', ui.flipped);
    let pct, txt, whiteBetter;
    if (ev.mate != null) {
      whiteBetter = ev.lost ? ev.lost === 'b' : ev.mate > 0;
      pct = whiteBetter ? 100 : 0;
      txt = ev.lost ? '#' : 'M' + Math.abs(ev.mate);
    } else {
      pct = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * ev.cp * (G && G.dice && mode() !== 'analysis' ? DICE_SOFT : 1) * matScale(barState()))) - 1);
      pct = Math.max(4, Math.min(96, pct));
      whiteBetter = ev.cp >= 0;
      txt = (Math.abs(ev.cp) / 100).toFixed(1);
    }
    $('#evalfill').style.height = pct + '%';
    num.textContent = txt;
    num.className = whiteBetter ? 'w' : 'b';
    $('#statusInfo').textContent = G && ev.depth && !ranked() ? 'depth ' + ev.depth + ', ' + (ev.mate != null ? txt : ((ev.cp > 0 ? '+' : ev.cp < 0 ? '-' : '') + txt)) : '';
  }

  function renderEngineBox() {
    const box = $('#engineBox');
    box.classList.toggle('ok', engineReady);
    box.classList.toggle('bad', !engineReady);
    let html = engineReady
      ? '<b>' + engine.label + '</b>' + (engine.kind === 'full' ? engine.threads + ' threads, ' + engine.hash + ' MB hash' : 'single thread fallback')
      : '<b>Engine failed</b>Open the app through its server';
    if (fairyEngine) html += '<b style="margin-top:6px">Fairy-Stockfish</b>' + fairyEngine.threads + ' threads, for variants';
    $('#engineText').innerHTML = html;
  }

  /* ---------- panel: game view ---------- */

  const TITLES = { puzzles: 'Puzzles', play: 'Play', analysis: 'Analysis', archive: 'Archive', review: 'Game Review', new: 'New Game', variants: 'New Game', powers: 'New Game', editor: 'New Game', settings: 'Settings', modes: 'Game Modes' };

  /* Android's back button (and the browser's): back through the tabs, the way an app does, closing what is open
     first (an explanation, a menu, the preset browser, the result card, a piece card). On the first screen, back
     leaves the app. */
  let navFromPop = false;
  function closeTop() {
    if (window.PWA && PWA.hideTip()) return true;
    if ($('#presetModal').classList.contains('on')) { closePresets(); return true; }
    if (ui.overlay) { closeOverlay(); ui.sel = null; renderAll(); return true; }
    if (G && G.over && G.endOpen && ui.tab === 'play') { G.endOpen = false; renderAll(); return true; }
    if (ui.info != null || ui.peek) { ui.info = null; ui.peek = null; renderAll(); return true; }
    if (rvPeek()) { rv.peek = null; renderAll(); return true; }
    return false;
  }
  window.addEventListener('popstate', (e) => {
    if (closeTop()) { try { history.pushState({ pc: ui.tab }, ''); } catch (err) { /* no history */ } return; }
    const tab = e.state && e.state.pc;
    if (!tab || tab === ui.tab) return;
    navFromPop = true;
    try { setTab(tab); } finally { navFromPop = false; }
  });
  const MORE_TABS = ['review', 'analysis', 'archive', 'settings']; // under More on a phone
  function setTab(tab) {
    if (tab === 'more') { $('#moreSheet').classList.toggle('on'); return; }
    $('#moreSheet').classList.remove('on');
    if (ui.tab === 'analysis' && tab !== 'analysis' && A && A.searching) { A.searching = false; stopEngines(); }
    if (ui.tab === 'puzzles' && tab !== 'puzzles') pzLeave();
    const from = ui.tab;
    ui.tab = tab;
    if (tab === 'puzzles' && from !== 'puzzles') pzEnter();
    // leaving the board editor after changing the board: that board is the one played (a variant with its own start
    // gives way). Only after a change, so that looking at the board step while setting up keeps the chosen variant.
    if (from === 'editor' && tab !== 'editor' && ed.touched && !stdVariant(setup.variant) && !(isCheckers(setup.variant) && checkersBoard(setup.fen))) {
      setup.variant = 'chess'; changed();
      toast(checkersBoard(setup.fen) ? 'The checkers board from the editor is set up for the game (checkers rules)' : 'The board from the editor is set up for the game (standard rules)');
    }
    ui.sel = null; ui.mode = null; ui.draft = [];
    if (rv) { rv.trial = null; rv.retry = null; }
    closeOverlay();
    if (from === 'editor') ed.touched = false;
    const navTab = SETUP_STEPS.some((x) => x[0] === tab) ? 'new' : tab; // the four setup steps are one entry in the sidebar
    document.querySelectorAll('.nav').forEach((b) => b.classList.toggle('on', b.dataset.tab === navTab || (b.dataset.tab === 'more' && MORE_TABS.indexOf(navTab) >= 0)));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === 'view-' + tab));
    document.body.dataset.tab = tab; // the phone layout hides the board on the pages that do not use it
    const icon = document.querySelector('.nav[data-tab="' + navTab + '"] svg').outerHTML;
    $('#ptitle').innerHTML = icon + TITLES[tab];
    $('#startbox').classList.toggle('on', navTab === 'new');
    $('#startbox').classList.toggle('nosum', tab !== 'new'); // the full summary on the first step
    renderSteps();
    if (tab === 'editor') renderEditor();
    // the Game Modes board always shows the player's side at the bottom; the game's own view comes back afterwards
    if (tab === 'modes' && from !== 'modes') { ui.flipSaved = ui.flipped; if (ui.flipped) { ui.flipped = false; buildSquares(); } }
    if (from === 'modes' && tab !== 'modes' && ui.flipSaved != null) { const f = ui.flipSaved; ui.flipSaved = null; if (ui.flipped !== f) { ui.flipped = f; buildSquares(); } }
    if (tab === 'modes') renderModes();
    if (tab === 'archive') renderArchive();
    renderAll();
    if (tab === 'analysis' && A) runAnalysis();
    if (tab !== from && !navFromPop) { try { history.pushState({ pc: tab }, ''); } catch (e) { /* no history */ } }
  }

  function renderAll(anims) {
    renderBoard(anims);
    renderBars();
    renderGame();
    renderGuide();
    renderEval();
    if (ui.tab === 'review') renderReview();
    if (ui.tab === 'analysis') renderAnalysis();
    if (ui.tab === 'puzzles') renderPuzzles();
    const showEnd = G && G.over && G.endOpen && mode() === 'game';
    $('#endcard').classList.toggle('on', !!showEnd);
    // the way back to the result once the end card is closed: in the status line, the review and the analysis
    $('#showEnd').style.display = G && G.over && !G.endOpen && ui.tab === 'play' ? '' : 'none';
    $('#rvResult').style.display = G && G.over ? '' : 'none';
    document.querySelector('.nav[data-tab="play"]').classList.toggle('live', !!G && !G.over);
    if (window.PWA) PWA.awake((!!G && !G.over && ui.tab === 'play') || (ui.tab === 'modes' && ((gmTab === 'sk' && skLive()) || (gmTab === 'pb' && pbLive())))); // the screen stays on during a game
  }

  function statusText() {
    if (!G) return '';
    if (G.over) return resultText(G.over).title + ' ' + resultText(G.over).sub;
    if (!isLive()) return 'Looking at an earlier position';
    const s = live();
    if (G.puppetNow) return 'Puppet Master: play the engine\'s move for it';
    if (G.auto) return nameOf(G, s.turn) + ' is thinking for ' + (s.turn === 'w' ? 'White' : 'Black');
    if (s.again >= 0 && (G.local || s.turn === G.cfg.side) && !ui.mode) return 'The ' + R.fairyOf(s.board[s.again]).name.toLowerCase() + ' has taken and may move once more, or stay';
    if (G.local && !ui.mode && !(ui.sel && ui.sel.drop)) return (s.turn === 'w' ? 'White' : 'Black') + ' to move' + (G.B.checks(s).length ? ', in check' : '');
    if (s.turn !== G.cfg.side) return G.botName + ' is thinking' + (ui.premoves.length > 1 ? ', ' + ui.premoves.length + ' premoves set' : ui.premoves.length ? ', premove set' : '');
    if (ui.mode === 'gild') return 'Midas Touch: click a glowing piece';
    if (ui.mode === 'freeze') return runGame() ? 'Shackles: click the enemy unit to bind' : 'Freeze Ray: click the piece to freeze';
    if (ui.mode === 'shield') return runGame() ? 'Sphere of protection: click the unit to protect' : 'Shield: click the piece to shield';
    if (ui.mode === 'powerup') return 'Power up: click the unit to upgrade';
    if (ui.mode === 'ou:boulder') return 'Pocket boulder: click an empty square';
    if (ui.mode === 'ou:rock') return 'Exploding rock: click an empty square for the bomb';
    if (ui.mode === 'ou:hammer') return 'Hammer: click the boulder to break';
    if (ui.mode === 'ou:snow') return 'Snow bottle: click the bomb to defuse';
    if (ui.mode === 'ou:teleporter') return ui.ouA >= 0 ? 'Teleporter: click the unit it changes places with' : 'Teleporter: click the first of your two units';
    if (ui.mode === 'downgrade') return 'Downgrade: click the upgraded enemy unit';
    if (ui.mode === 'convert') return 'Turncoat: click the piece that should join you';
    if (ui.mode === 'portal') return ui.draft.length ? 'Click the square for the orange portal' : 'Click the square for the blue portal';
    if (ui.sel && ui.sel.drop) return 'Click an empty square to drop the piece';
    if (G.cfg.double && s.movesLeft > 0) return 'Your turn, ' + s.movesLeft + (s.movesLeft === 1 ? ' move left' : ' moves left');
    return 'Your turn';
  }

  function pocketRow(label, letters, color, clickable, act, legal, glyphs) {
    legal = legal || G.legal; glyphs = glyphs || G.glyphs;
    const row = h('div', 'prow', '<b>' + label + '</b>');
    const pk = h('div', 'pocket'), counts = {}, order = [];
    letters.forEach((t) => { if (!counts[t]) order.push(t); counts[t] = (counts[t] || 0) + 1; });
    order.sort((a, b) => (VALUE[b] || 4) - (VALUE[a] || 4));
    order.forEach((t) => {
      const piece = color === 'w' ? t.toUpperCase() : t;
      const b = paint(h(clickable ? 'button' : 'span', clickable && ui.sel && ui.sel.drop === t ? 'on' : ''), piece, glyphs, null);
      if (counts[t] > 1) b.appendChild(h('b', 'n', String(counts[t])));
      if (clickable) {
        const fits = legal.some((m) => m.drop === t);
        b.disabled = !act || !fits;
        b.title = fits || !act ? '' : 'This piece cannot be dropped right now';
        b.onclick = () => {
          if (ui.sel && ui.sel.drop === t) ui.sel = null;
          else { ui.mode = null; ui.sel = { sq: -1, drop: t, moves: legal.filter((m) => m.drop === t) }; }
          renderAll();
        };
      }
      pk.appendChild(b);
    });
    if (!letters.length) row.appendChild(h('span', '', clickable ? 'Capture something first' : 'empty'));
    row.appendChild(pk);
    return row;
  }

  // Dice Chess: the roll of the side to move.
  /* The dice of the turn. Before the throw: blank dice and, on the player's turn, the Roll button. After it: the
     whole throw, a used die darkened (never removed), and a die that cannot be used any more crossed out. */
  function diceRow(s, who, ctx) {
    ctx = ctx || { B: G.B, legal: G.legal, cfg: G.cfg, canRoll: canRoll() };
    const row = h('div', 'prow dicerow'), box = h('div', 'dice');
    box.id = ctx.id || 'diceBox';
    row.appendChild(h('b', '', 'Dice'));
    const n = ctx.B.diceCount || (ctx.cfg.dice3 ? 3 : 2), color = s.turn;
    const face = (t) => paint(h('i', 'die'), color === 'w' ? t.toUpperCase() : t, null, null);
    let text = '';
    if (!s.dice && !s.rolled) {
      for (let i = 0; i < n; i++) box.appendChild(h('i', 'die blank', '?'));
      row.appendChild(box);
      if (ctx.canRoll) {
        const b = h('button', 'btn green rollbtn', 'Roll the dice');
        b.onclick = () => rollDice(ctx);
        row.appendChild(b);
        return row;
      }
      text = G && G.rolling ? who + (who === 'You' ? ' are' : ' is') + ' rolling' : who + ' to roll';
    } else {
      const left = (s.dice || []).slice(), useful = {};
      (ctx.legal || []).forEach((m) => { useful[R.dieOf(m)] = true; });
      // three dice: a die with no move yet is not lost when another die's move opens one for it (a pawn step frees the queen)
      if (ctx.cfg.dice3 && s.dice && s.dice.some((t) => !useful[t])) {
        (ctx.legal || []).some((m) => {
          try { const n2 = ctx.B.play(s, m); if (n2.turn === s.turn && n2.dice) ctx.B.legal(n2).forEach((m2) => { useful[R.dieOf(m2)] = true; }); } catch (e) { /* skip that line */ }
          return s.dice.every((t) => useful[t]);
        });
      }
      (s.rolled || s.dice).forEach((t) => {
        const i = left.indexOf(t), el = face(t);
        if (i >= 0) { left.splice(i, 1); if (!useful[t]) el.classList.add('dead'); }
        else el.classList.add('used');
        box.appendChild(el);
      });
      const names = (s.dice || []).filter((t) => useful[t]).map((t) => pieceName(t));
      const has = who === 'You' ? ' have' : ' has';
      if (ctx.cfg.dice3) text = names.length ? who + ' still' + has + ' to move: ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + ', in any order' : 'the ' + names[0]) : '';
      else text = names.length ? who + ' may move ' + (names.length > 1 && names[0] !== names[1] ? 'the ' + names[0] + ' or the ' + names[1] : 'the ' + names[0]) : '';
      row.appendChild(box);
    }
    if (text) row.appendChild(h('span', '', text));
    return row;
  }
  // a kind of piece in plain words
  function pieceName(t) { const d = R.fairyOf(t); return d ? d.name.toLowerCase() : (DIE_NAME[t] || t); }
  function canRoll() {
    if (!G || G.over || G.rolling || mode() !== 'game' || ui.tab === 'review' || !isLive()) return false;
    const s = live();
    return !!(G.B.unrolled && G.B.unrolled(s)) && !G.auto && (G.local || s.turn === G.cfg.side);
  }
  /* A throw: the faces are drawn the moment the button is pressed (or the bot's turn comes), never before, then the
     dice spin like slot reels, top to bottom, and stop one after the other. */
  function rollDice(ctx) {
    if (ctx && ctx.analysis) { analysisRoll(); return; }
    if (!G || G.over || G.rolling) return;
    const game = G, s = live();
    if (!G.B.unrolled(s)) return;
    const faces = G.B.rollFaces(s);
    // a game mode keeps the throw the moment it is made: reloading during the reels cannot draw a new one
    const gm = G.spec && G.spec.gameMode;
    if (gm) { syncModes(); if (MS.pending && MS.pending.id === gm.id) { MS.pending.actions = actionsOf(G).concat(['r|' + faces.join(',')]); saveModes(); } }
    G.rolling = true;
    renderGame();
    spinDice(faces, s.turn, s.pool, () => {
      game.rolling = false;
      if (game !== G || live() !== s || G.over) return;
      doRoll(faces);
    });
  }
  function doRoll(faces) {
    const s = live(), n = G.B.roll(s, faces);
    if (!n) return;
    pushState(n, { by: s.turn, roll: faces.slice(), san: '', removed: [], wasted: !!n.wasted });
    ui.sel = null; ui.mode = null; ui.hintArrow = null;
    renderAll();
    if (n.wasted) toast(n.turn !== s.turn ? 'Nothing can move with that throw: the turn is lost' : 'Nothing can move with that throw: roll again');
    afterAction();
  }
  // The slot reels. done() runs once the last die has stopped (at once when the dice are not on screen).
  function spinDice(faces, color, pool, done) {
    const box = $('#diceBox');
    if (!box || !box.offsetParent || !settings.anim) { if (box && box.offsetParent) snd('diestop'); setTimeout(done, box && box.offsetParent ? 120 : 0); return; }
    const kinds = pool && pool.length ? pool : ['p', 'n', 'b', 'r', 'q', 'k'], cell = box.firstChild ? box.firstChild.getBoundingClientRect().height || 30 : 30;
    box.innerHTML = '';
    snd('roll');
    let left = faces.length;
    faces.forEach((f, i) => {
      const win = h('i', 'die reelwin'), reel = h('div', 'reel'), n = 12 + i * 5;
      // the strip: the result on top, random faces below it; it slides down, so the faces pass from top to bottom
      const strip = [f];
      for (let k = 0; k < n; k++) strip.push(kinds[Math.floor(Math.random() * kinds.length)]);
      strip.forEach((t) => reel.appendChild(paint(h('i', 'die cellface'), color === 'w' ? t.toUpperCase() : t, null, null)));
      win.appendChild(reel);
      box.appendChild(win);
      const anim = reel.animate([{ transform: 'translateY(' + (-n * cell) + 'px)' }, { transform: 'translateY(0)' }], { duration: 650 + i * 260, easing: 'cubic-bezier(.15,.65,.25,1)', fill: 'forwards' });
      const end = () => { snd('diestop'); if (--left === 0) setTimeout(done, 160); };
      let fired = false;
      anim.onfinish = () => { if (!fired) { fired = true; end(); } };
      setTimeout(() => { if (!fired) { fired = true; end(); } }, 1400 + i * 260); // a hidden tab does not run animations
    });
  }

  // a Shotgun King's gun: shells loaded and in reserve, and the reload for the side to move
  function gunRow(s, c) {
    const g = s.sg[c], cap = R.SG.cap, who = G.auto || G.local ? (c === 'w' ? 'White' : 'Black') : c === G.cfg.side ? 'Your' : 'The bot\'s';
    const row = h('div', 'prow', skMag(g[0], cap, g[1], R.SG.res) + '<span>' + who + ' royal shotgun</span>');
    const rl = isLive() && !G.over && s.turn === c && canAct() && G.legal.find((m) => m.reload);
    if (s.turn === c && !G.auto && (G.local || c === G.cfg.side)) {
      const b = h('button', 'btn', 'Reload');
      b.disabled = !rl;
      b.title = rl ? 'Put one shell into the gun from the reserve: that is your move' : g[0] >= cap ? 'The gun is full' : 'No shells in reserve';
      b.onclick = () => { if (rl) dispatch(rl); };
      row.insertBefore(b, row.firstChild);
    }
    return row;
  }
  // what the ducks want from the side to move: a line in the game panel
  function duckRow(s) {
    const who = G.auto || G.local ? (s.turn === 'w' ? 'White' : 'Black') : s.turn === G.cfg.side ? 'You' : 'The bot';
    let t;
    if (s.duckPhase) {
      const left = (s.dTodo || []).length + (s.duckHand || 0);
      t = s.duckHand ? who + ': place the duck on any free square' : left > 1 ? who + ': move the yellow ducks, ' + left + ' left. None may land where a yellow duck stood' : who + ': move the duck to another free square';
    } else t = s.ducks.length || s.duckHand ? 'The yellow duck' + (s.ducks.length > 1 ? 's move' : ' moves') + ' after every move' : '';
    if (s.bducks && s.bducks.length) t += (t ? '. ' : '') + 'Blue ducks may be moved, each once a turn: click one';
    return h('div', 'prow duckrow', '<i class="duckicon' + (s.duckPhase || !s.bducks.length ? '' : ' blue') + '"></i><span>' + t + '</span>');
  }
  function renderGame() {
    const head = $('#gamehead'), bar = $('#powerbar'), box = $('#moves');
    if (!G) {
      head.style.display = 'none'; bar.classList.remove('on'); $('#cardFloat').innerHTML = '';
      box.innerHTML = '<div id="empty"><img src="pieces/wN.svg" alt=""><br>No game running yet.<br>Pick an opponent, a variant or some power-ups, and press Play.<br><button class="btn" id="emptyGo">Set up a game</button></div>';
      $('#emptyGo').onclick = () => setTab('new');
      $('#statusText').textContent = '';
      $('#statusline').classList.remove('busy');
      ['cUndo', 'cHint', 'cResign', 'cReview', 'cAnalyse'].forEach((id) => { $('#' + id).disabled = true; });
      return;
    }
    const cfg = G.cfg, s = live();
    head.style.display = '';
    let hh = G.auto ? '<b>' + nameOf(G, 'w') + '</b> against <b>' + nameOf(G, 'b') + '</b><span class="chip">Bot match</span>'
      : G.local ? '<b>White</b> against <b>Black</b><span class="chip">Two players</span>' : 'You against <b>' + G.botName + '</b>';
    if (G.variantGame || G.dice || G.checkers || G.duck) hh += '<span class="chip">' + G.vname + '</span>';
    if (G.spec && G.spec.gameMode) hh += '<span class="chip gm">' + modeChip(G.spec.gameMode) + '</span>';
    if (G.spec && G.spec.daily) hh += '<span class="chip gm">Daily challenge</span>';
    if (G.B.kc) hh += '<span class="chip">King capture</span>';
    if (G.B.ups) hh += '<span class="chip">Upgrades by hand</span>';
    const chips = (pw, cls, pre) => powerNames(pw).map((n) => '<span class="chip' + cls + '">' + pre + n + '</span>').join('');
    if (G.auto || G.local) {
      if (G.use === 'same') hh += chips(G.pw.w, '', '') + (G.pw.w ? '<span class="chip ai">' + (G.local ? 'Both players' : 'Both bots') + '</span>' : '');
      else hh += chips(G.pw.w, '', 'White: ') + chips(G.pw.b, ' ai', 'Black: ');
    } else {
      const theirs = G.pw[R.other(cfg.side)];
      hh += chips(cfg, '', '');
      if (theirs) hh += G.use === 'same' ? '<span class="chip ai">Bot has them too</span>' : chips(theirs, ' ai', 'Bot: ');
    }
    if (G.ai && G.ai.anticipate && !G.local && (G.pw.w || G.pw.b)) hh += '<span class="chip ai">Bots anticipate</span>'; // only worth saying when there are power-ups to see coming
    head.innerHTML = hh;

    // power bar
    bar.innerHTML = '';
    const me = mySide(), act = canAct() && s.turn === me; // not while you are moving the engine's pieces
    const sv = G.states[G.view];
    const fl = $('#cardFloat');
    fl.innerHTML = '';
    const sgCard = G.glyphs && G.glyphs['+p'] && sv.board[ui.info] ? SHOGI_OWN[((sv.raw && sv.raw[ui.info]) || sv.board[ui.info]).toLowerCase()] : null; // Shogi: the card of the app's own shogi piece
    if (ui.info != null && (G.B.kind === 'std' || G.hex || sgCard) && mode() === 'game' && sv.board[ui.info]) {
      const card = G.hex ? hexCard(sv.board[ui.info]) : sgCard ? pieceCard(R.colorOf(sv.board[ui.info]) === 'w' ? sgCard.toUpperCase() : sgCard, { pw: { w: null, b: null } }, null) : pieceCard(sv.board[ui.info], cfg, sv);
      if (sv.helmets && sv.helmets.indexOf(ui.info) >= 0) card.insertAdjacentHTML('beforeend', '<div class="pc-wear"><i class="wear helmet"></i>Spiked helmet: the next capture of this piece bounces off, breaks the helmet and freezes the attacker for a turn</div>');
      if (sv.vests && sv.vests.indexOf(ui.info) >= 0) card.insertAdjacentHTML('beforeend', '<div class="pc-wear"><i class="wear vest"></i>Explosive vest: instead of moving it can go up and take the 3 x 3 square around it with it</div>');
      if (ui.peek && ui.peek.sq === ui.info) card.insertAdjacentHTML('beforeend', peekLegend()); // what the red marks on the board mean
      fl.appendChild(card); // floats over the move list
    }
    if (G.db) bar.appendChild(drawbackRow(sv));
    // the hand-over between two players at one device, over the board as well
    let hc = $('#handoffCard');
    if (handoff() && mode() === 'game' && isLive()) {
      const t = live().turn === 'w' ? 'White' : 'Black';
      if (!hc) { hc = h('div', 'handoffcard'); hc.id = 'handoffCard'; board.appendChild(hc); }
      if (hc.dataset.who !== t) {
        hc.dataset.who = t;
        hc.innerHTML = '<b>' + t + ' to move</b><span>Hand the device to ' + t + '. Both drawbacks stay hidden until then.</span>';
        const go = h('button', 'btn green', 'I am ' + t + ': show my drawback');
        go.onclick = (e) => { e.stopPropagation(); G.dbReveal = live().turn; renderAll(); };
        hc.appendChild(go);
      }
    } else if (hc) hc.remove();
    if ((sv.ducks && sv.ducks.length) || (sv.bducks && sv.bducks.length) || sv.duckHand) bar.appendChild(duckRow(sv));
    if (sv.sg) Object.keys(sv.sg).forEach((c) => bar.appendChild(gunRow(sv, c)));
    if (G.dice && (sv.dice || sv.rolled || (G.B.unrolled && G.B.unrolled(sv))) && !(G.over && isLive())) bar.appendChild(diceRow(sv, G.auto || G.local ? (sv.turn === 'w' ? 'White' : 'Black') : sv.turn === cfg.side ? 'You' : 'The bot', isLive() ? null : { B: G.B, legal: G.B.legal(sv), cfg: cfg, canRoll: false }));
    const mine = G.auto ? {} : G.local ? (G.pw[me] || {}) : cfg; // a bot match has nothing to click; at a shared board the side to move
    if (G.local) {
      const row = h('div', 'prow');
      const b = h('button', 'btn' + (G.spec.flipEach ? ' on' : ''), 'Turn board');
      b.onclick = () => { G.spec.flipEach = setup.flipEach = !G.spec.flipEach; save(); if (G.spec.flipEach && !G.over) { ui.flipped = live().turn === 'b'; buildSquares(); } renderAll(); };
      row.appendChild(b);
      row.appendChild(h('span', '', G.spec.flipEach ? 'The board turns to whoever is to move' : 'The board stays as it is'));
      bar.appendChild(row);
    }
    if (mine.double) {
      const row = h('div', 'prow', '<b>Double Move</b>');
      const pips = h('div', 'pips');
      for (let i = 0; i < mine.double; i++) pips.appendChild(h('i', (s.turn === me && !G.over && i < s.movesLeft) ? 'on' : ''));
      row.appendChild(pips);
      bar.appendChild(row);
    }
    if (mine.midas) {
      const row = h('div', 'prow');
      const n = act ? G.B.gildTargets(s, G.legal).length : 0;
      const b = h('button', 'btn gold' + (ui.mode === 'gild' ? ' on' : ''), ui.mode === 'gild' ? 'Cancel' : 'Midas Touch');
      b.disabled = !n;
      b.onclick = () => { ui.mode = ui.mode === 'gild' ? null : 'gild'; ui.sel = null; renderAll(); };
      row.appendChild(b);
      const used = mine.midasPerTurn > 0 && s.midasUsed >= mine.midasPerTurn && s.turn === me;
      row.appendChild(h('span', '', used ? 'Used this turn' : (n ? n + (n === 1 ? ' piece' : ' pieces') + ' in reach' + (mine.midasPerTurn === -1 ? ', uses your move' : '') : 'Nothing in reach')));
      bar.appendChild(row);
    }
    if (runGame() && !G.over) ouroBar(bar, s, act);
    if (mine.freeze && !runGame()) {
      const row = h('div', 'prow');
      const ready = act && !s.freezeUsed;
      const b = h('button', 'btn' + (ui.mode === 'freeze' ? ' on' : ''), ui.mode === 'freeze' ? 'Cancel' : 'Freeze Ray');
      b.disabled = !ready;
      b.onclick = () => { ui.mode = ui.mode === 'freeze' ? null : 'freeze'; ui.sel = null; renderAll(); };
      row.appendChild(b);
      const mineIce = s.ice.filter((q) => s.board[q] && R.colorOf(s.board[q]) !== me);
      row.appendChild(h('span', '', mineIce.length ? mineIce.map(sqLabel).join(', ') + ' frozen' : (s.freezeUsed && s.turn === me ? 'Used this turn' : 'Ready')));
      bar.appendChild(row);
    }
    if ((s.vests || []).some((q) => s.board[q] && R.colorOf(s.board[q]) === me && s.gold.indexOf(q) < 0)) {
      // Explosive Vest: the selected piece goes up
      const row = h('div', 'prow'), bl = act && ui.sel && ui.sel.blast;
      const b = h('button', 'btn' + (bl ? ' red' : ''), 'Detonate');
      b.disabled = !bl;
      b.onclick = () => { if (ui.sel && ui.sel.blast) blastAt(ui.sel.sq); };
      row.appendChild(b);
      row.appendChild(h('span', '', bl ? 'The ' + (R.fairyOf(s.board[ui.sel.sq]) ? R.fairyOf(s.board[ui.sel.sq]).name : { q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }[s.board[ui.sel.sq].toLowerCase()] || 'piece').toLowerCase() + ' on ' + sqLabel(ui.sel.sq) + ' goes up, and everything around it' : 'Select a piece with a vest, or double-click it'));
      bar.appendChild(row);
    }
    if (mine.shield && !runGame()) {
      const row = h('div', 'prow');
      const ready = act && !s.shieldUsed && G.B.shieldTargets(s).length > 0;
      const b = h('button', 'btn' + (ui.mode === 'shield' ? ' on' : ''), ui.mode === 'shield' ? 'Cancel' : 'Shield');
      b.disabled = !ready && ui.mode !== 'shield';
      b.onclick = () => { ui.mode = ui.mode === 'shield' ? null : 'shield'; ui.sel = null; renderAll(); };
      row.appendChild(b);
      const mineG = (s.guard || []).filter((q) => s.board[q] && R.colorOf(s.board[q]) === me);
      row.appendChild(h('span', '', mineG.length ? mineG.map(sqLabel).join(', ') + ' shielded' : (s.shieldUsed && s.turn === me ? 'Used this turn' : 'Ready')));
      bar.appendChild(row);
    }
    if (mine.tempo && !runGame()) {
      const row = h('div', 'prow'), pass = act ? G.legal.find((x) => x.pass) : null, left = 2 - ((s.passed || '').split(me).length - 1);
      const b = h('button', 'btn', 'Pass');
      b.disabled = !pass;
      b.onclick = () => { if (pass) applyMove(pass); };
      row.appendChild(b);
      row.appendChild(h('span', '', left > 0 ? left + (left === 1 ? ' pass left' : ' passes left') : 'No passes left'));
      bar.appendChild(row);
    }
    if (mine.portals) {
      const row = h('div', 'prow');
      const b = h('button', 'btn' + (ui.mode === 'portal' ? ' on' : ''), ui.mode === 'portal' ? 'Cancel' : (s.portals.length ? 'Move portals' : 'Place portals'));
      b.disabled = !act;
      b.onclick = () => { ui.mode = ui.mode === 'portal' ? null : 'portal'; ui.draft = []; ui.sel = null; renderAll(); };
      row.appendChild(b);
      row.appendChild(h('span', '', s.portals.length ? sqLabel(s.portals[0]) + ' and ' + sqLabel(s.portals[1]) + ' are linked' : 'No portals on the board'));
      bar.appendChild(row);
    }
    if (mine.drops) bar.appendChild(pocketRow('Reinforcements', s[R.pocketKey(cfg, me)], me, true, act));
    if (!G.hand) {
      // pockets nobody here can click: the bot's, or both in a bot match
      (G.auto ? ['w', 'b'] : [R.other(me)]).forEach((c) => {
        if (G.pw[c] && G.pw[c].drops) bar.appendChild(pocketRow(G.auto || G.local ? (c === 'w' ? 'White\'s pocket' : 'Black\'s pocket') : 'Their pocket', s[R.pocketKey(cfg, c)], c, false, false));
      });
    }
    const simple = (label, enabled, onClick, text, on) => {
      const row = h('div', 'prow'), b = h('button', 'btn' + (on ? ' on' : ''), label);
      b.disabled = !enabled;
      b.onclick = onClick;
      row.appendChild(b);
      row.appendChild(h('span', '', text));
      bar.appendChild(row);
    };
    if (mine.storm) {
      const st = G.legal.find((m) => m.storm);
      simple('Pawn Storm', act && !!st, () => applyMove(st), st || !act ? 'Every pawn with room steps forward' : 'No pawn can step forward');
    }
    const stopSpent = typeof s.stopUsed === 'string' ? s.stopUsed.indexOf(me) >= 0 : !!s.stopUsed;
    if (mine.timestop) simple('Time Stop', act && G.B.stopReady(s), doTimeStop, stopSpent ? 'Used' : 'Once per game: three moves in a row');
    if (mine.turncoat) {
      const spent = typeof s.turned === 'string' ? s.turned.indexOf(me) >= 0 : !!s.turned;
      const n = act && !spent ? G.B.convertTargets(s).length : 0;
      simple(ui.mode === 'convert' ? 'Cancel' : 'Turncoat', n > 0, () => { ui.mode = ui.mode === 'convert' ? null : 'convert'; ui.sel = null; renderAll(); },
        spent ? 'Used' : act && !n ? (G.B.kind !== 'std' || cfg.freeArmy ? 'No piece can join right now' : 'Your army is full, a piece can join once you are a pawn down') : 'Once per game: an enemy piece joins you', ui.mode === 'convert');
    }
    if (s.again >= 0 && act) {
      // an assassin or blade dancer has taken: its extra move is optional
      const stay = G.legal.find((m) => m.stay);
      if (stay) simple('Stay', true, () => applyMove(stay), 'Ends the turn without the extra move');
    }
    if (mine.veto) simple('Veto', vetoReady(), doVeto, G.vetoLeft + ' left, rejects the engine\'s last move');
    if (mine.puppet) {
      simple(G.puppetArmed ? 'Cancel' : 'Puppet Master', act && G.puppetLeft > 0, () => { G.puppetArmed = !G.puppetArmed; renderAll(); },
        G.puppetNow ? 'You are moving for the engine' : G.puppetArmed ? 'Armed: after your move you play the engine\'s reply' : (G.puppetLeft ? 'Once per game' : 'Used'), G.puppetArmed);
    }
    if (G.variantGame && (G.hand || s.pockets.w.length || s.pockets.b.length)) {
      // in Shogi the captured pieces are "in hand"
      const sh = !!(G.glyphs && G.glyphs['+p']), wp = sh ? 'White\'s hand' : 'White\'s pocket', bp = sh ? 'Black\'s hand' : 'Black\'s pocket';
      if (G.auto) {
        bar.appendChild(pocketRow(wp, s.pockets.w, 'w', false, false));
        bar.appendChild(pocketRow(bp, s.pockets.b, 'b', false, false));
      } else {
        bar.appendChild(pocketRow(G.local ? (me === 'w' ? wp : bp) : sh ? 'In your hand' : 'Your pocket', s.pockets[me], me, true, act));
        bar.appendChild(pocketRow(G.local ? (me === 'w' ? bp : wp) : sh ? 'In their hand' : 'Their pocket', s.pockets[R.other(me)], R.other(me), false, false));
      }
    }
    if (G.variantGame) {
      const chk = /\s(\d+)\+(\d+)\s/.exec(s.fen);
      if (chk) bar.appendChild(h('div', 'prow', '<b>Checks still needed</b><span>White ' + chk[1] + ', Black ' + chk[2] + '</span>'));
    }
    // Danger (the Ouroboros King's rules, as in Shotgun King): every square the other side could take on next turn
    if (dangerGame()) simple('Danger', true, () => { settings.danger = !settings.danger; save(); renderAll(); }, settings.danger ? 'Red: what the other side could take next turn' : 'Show what the other side could take next turn', !!settings.danger);
    // what the text next to a button says, also as its hold text (a phone shows the buttons only)
    bar.querySelectorAll('.prow').forEach((row) => { const b = row.querySelector('button'), t = row.querySelector(':scope > span'); if (b && t && t.textContent && !b.title) b.title = t.textContent; });
    bar.classList.toggle('on', bar.children.length > 0);

    // move list
    const rows = [];
    let row = null, lastBy = null, no = G.moveNo;
    G.log.forEach((e, i) => {
      if (e.by !== lastBy) {
        if (e.by === 'w' || !row) { row = { no: no++, w: [], b: [] }; rows.push(row); }
        lastBy = e.by;
      }
      row[e.by].push(i);
    });
    box.innerHTML = '';
    rows.forEach((r) => {
      const el = h('div', 'mrow');
      el.appendChild(h('div', 'no', r.no + '.'));
      ['w', 'b'].forEach((c) => {
        const cell = h('div', 'cell');
        if (c === 'w' && !r.w.length) cell.textContent = '...';
        r[c].forEach((i) => {
          const e = G.log[i];
          const b = h('button', 'mv' + (G.view === i + 1 ? ' on' : '') + (e.gild != null ? ' au' : '') + (e.freeze != null || e.convert != null || e.shield != null ? ' ice' : '') + (e.roll ? ' rollmv' + (e.wasted ? ' wasted' : '') : ''), e.san);
          if (e.roll) { e.roll.forEach((t) => b.appendChild(paint(h('i', 'mdie'), e.by === 'w' ? t.toUpperCase() : t, null, null))); b.title = 'Rolled ' + e.roll.map(pieceName).join(', ') + (e.wasted ? ': nothing could move' : ''); }
          b.onclick = () => gotoView(i + 1);
          cell.appendChild(b);
        });
        el.appendChild(cell);
      });
      box.appendChild(el);
    });
    const onEl = box.querySelector('.mv.on');
    if (isLive()) { box.scrollTop = box.scrollHeight; box.scrollLeft = box.scrollWidth; } // a phone shows the moves as one row
    else if (onEl) onEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    $('#statusText').textContent = statusText();
    $('#statusline').classList.toggle('busy', !G.over && s.turn !== me);
    $('#cUndo').disabled = modeGame() || undoTarget() < 0;
    $('#cHint').disabled = ranked() || !act || !!(G.B.unrolled && G.B.unrolled(live())); // nothing to hint before the throw
    $('#cResign').disabled = !!G.over;
    $('#cReview').disabled = !G.over;
    $('#cAnalyse').disabled = !G.over || !!G.hex; // the analysis board is square: a hex game has its review
    $('#cResignTxt').textContent = G.auto ? 'Stop' : 'Resign';
  }

  function gotoView(i) {
    if (!G) return;
    i = Math.max(0, Math.min(G.states.length - 1, i));
    if (i === G.view) return;
    G.view = i;
    ui.sel = null; ui.mode = null; ui.hintArrow = null; ui.premoves = [];
    if (rv) { rv.trial = null; rv.retry = null; }
    closeOverlay();
    renderAll();
  }

  /* ---------- overlays ---------- */

  function closeOverlay() {
    if (ui.overlay) { ui.overlay.remove(); ui.overlay = null; }
    $('#veil').classList.remove('on');
  }
  function showPromo(cands) {
    const to = cands[0].to, xy = sqXY(to), color = R.colorOf(cands[0].piece);
    const box = h('div', 'picker');
    // one cell wide, on the cell the pawn reaches, running into the board: down from the top half, up from the bottom
    // half (any board size, the hex board too, whose cells sit at fractional positions)
    box.style.width = 100 / BW + '%';
    box.style.left = Math.max(0, Math.min(BW - 1, xy[0])) * 100 / BW + '%';
    if (xy[1] < BH / 2) box.style.top = Math.max(0, xy[1]) * 100 / BH + '%';
    else { box.style.bottom = Math.max(0, BH - 1 - xy[1]) * 100 / BH + '%'; box.style.flexDirection = 'column-reverse'; }
    ['q', 'n', 'r', 'b'].forEach((t) => {
      const m = cands.find((c) => c.promo === t);
      if (!m) return;
      const b = h('button');
      b.style.backgroundImage = imgUrl(color + t.toUpperCase());
      b.onclick = () => { closeOverlay(); dispatch(m); };
      box.appendChild(b);
    });
    const x = h('button', 'x', '&times;');
    x.onclick = () => { closeOverlay(); ui.sel = null; renderAll(); };
    box.appendChild(x);
    openOverlay(box);
  }
  // Variant promotions can offer any number of pieces, so they get a row instead of the column.
  function showPromoRow(cands) {
    const xy = sqXY(cands[0].to), n = cands.length, white = R.colorOf(cands[0].piece) === 'w';
    const box = h('div', 'rowpick');
    const cw = 100 / BW;
    box.style.width = Math.min(100, n * cw) + '%';
    box.style.left = Math.max(0, Math.min(100 - n * cw, (xy[0] + 0.5 - n / 2) * cw)) + '%';
    box.style.top = (xy[1] < BH / 2 ? xy[1] + 1 : xy[1] - 1) * 100 / BH + '%';
    cands.forEach((m) => {
      // Shogi: the '+' of a promotion is the piece turned over
      const letter = m.promo === '+' ? '+' + m.piece.replace('+', '') : m.promo || m.piece;
      const b = paint(h('button'), white ? letter.toUpperCase() : letter.toLowerCase(), curGlyphs(), null);
      b.title = m.promo === '+' ? 'Promote' : m.promo ? '' : cands.some((x) => x.promo === '+') ? 'Do not promote' : 'Plain move';
      b.onclick = () => { closeOverlay(); dispatch(m); };
      box.appendChild(b);
    });
    openOverlay(box);
  }
  function showChooser(cands) {
    const xy = sqXY(cands[0].to);
    const box = h('div', 'chooser');
    box.style.left = (xy[0] + 0.5) * 100 / BW + '%';
    // above the square, or below it on the top row
    if (xy[1] === 0) { box.style.top = 100 / BH + '%'; box.style.transform = 'translate(-50%,12%)'; }
    else box.style.top = xy[1] * 100 / BH + '%';
    // one button per way of playing to this square
    const seen = {};
    cands.forEach((m) => {
      const label = m.swap ? 'Swap places' : m.snipe || m.shot ? 'Shoot' : m.cap ? 'Capture' : 'Move';
      if (seen[label]) return;
      seen[label] = true;
      const b = h('button', '', label);
      b.onclick = () => { closeOverlay(); dispatch(m); };
      box.appendChild(b);
    });
    openOverlay(box);
    // near the edge the box would leave the board: measured now that it is on the page, and pushed back in
    const br = board.getBoundingClientRect(), r = box.getBoundingClientRect();
    const dx = r.left < br.left + 3 ? br.left + 3 - r.left : r.right > br.right - 3 ? br.right - 3 - r.right : 0;
    if (dx) box.style.marginLeft = dx + 'px';
  }
  function openOverlay(box) {
    closeOverlay();
    ui.overlay = box;
    board.appendChild(box);
    $('#veil').classList.add('on');
    renderBoard();
  }

  function resultText(st) {
    const side = G.cfg.side;
    let title = st.result === 'draw' ? 'Draw' : G.auto || G.local ? (st.result === 'w' ? 'White Won' : 'Black Won') : (st.result === side ? 'You Won!' : G.botName + ' Won');
    if (st.reason === 'stopped') title = 'Match stopped';
    const sub = {
      stopped: 'before it was decided',
      checkmate: 'by checkmate', stalemate: 'by stalemate', repetition: 'by repetition', timeout: 'on time', resignation: 'by resignation',
      explosion: 'a royal piece was caught in a martyr\'s blast', 'king captured': 'by taking the king',
      finisher: 'by The Finisher: the enemy General stood alone', smoke: 'gone in a cloud of smoke', hourglass: 'the sand runs back',
      variant: 'by the rules of ' + G.vname, drawrule: 'by repetition, the 50 move rule or too little material',
      drawback: G.db ? (G.auto || G.local ? (st.by === 'w' ? 'White' : 'Black') + ' lost by its drawback, ' : (st.by === side ? 'you lost by your drawback, ' : G.botName + ' lost by its drawback, ')) + dbName(G.db[st.by]) : '',
      'no legal moves': (G.auto || G.local ? (st.by === 'w' ? 'White' : 'Black') + ' had' : st.by === side ? 'you had' : G.botName + ' had') + ' no legal move left by the drawback'
    }[st.reason] || ('by ' + st.reason);
    return { title: title, sub: sub };
  }

  /* ---------- Hexagonal Chess (js/hex.js) ---------- */

  /* The backend for Gliński's hexagonal chess, the same shape as the others. Its own engine (in the brain worker)
     plays, judges the eval bar and reviews; the chess engines cannot read a hex board. */
  function hexBackend() {
    const none = () => [];
    return {
      kind: 'hex', hex: true, W: 11, H: 11, big: false, powers: false, dice: false, fairy: false, terrain: true, kc: false, ups: false,
      initial: () => Hex.initial(),
      legal: (s) => Hex.legalMoves(s),
      play: (s, m) => Hex.play(s, m),
      san: (s, m, lg, n) => Hex.san(s, m, lg, n),
      status: (s, lg) => Hex.status(s, lg),
      checks: (s) => { const k = s.board.indexOf(s.turn === 'w' ? 'K' : 'k'); return k >= 0 && Hex.inCheck(s, s.turn) ? [k] : []; },
      fen: (s) => Hex.toFen(s),
      key: (s) => Hex.key(s),
      position: () => null,
      searchmoves: () => null,
      find: (lg, uci) => Hex.find(lg, uci),
      uci: (m) => Hex.uci(m),
      gildTargets: none, freezeTargets: none, shieldTargets: none, shield: () => null, convertTargets: none, stopReady: () => false, timeStop: () => null,
      withPortals: (s) => s, unrolled: () => false, diceCount: 0,
      dispose: () => {}
    };
  }

  /* ---------- Drawback Chess (js/drawbacks.js) ---------- */

  // Both drawbacks of a game, as the rules use them. The engine some drawbacks ask is a short fixed search.
  function dbConf(d, cfg) {
    const engine = (s, moves) => {
      try {
        const r = Brain.think(s, cfg, { ms: 400, maxDepth: 2, margin: 0, free: false, allow: moves.map(moveKey) });
        return r.actions.length ? moves.find((m) => moveKey(m) === r.actions[0].key) || null : null;
      } catch (e) { return null; }
    };
    return { seed: d.seed, w: d.w, b: d.b, check: true, cfg: cfg, engine: engine };
  }
  /* The standard backend with both drawbacks on top: a move the drawback forbids is not legal (so it is not even
     shown), the history rides along on the positions, and a side loses by its drawback or for want of a move. */
  function drawbackBackend(B0, cfg, conf) {
    const B = Object.assign({}, B0);
    B.drawback = conf;
    B.initial = () => Drawbacks.startState(B0.initial(), conf);
    B.legal = (s) => Drawbacks.filter(s, s.turn, conf, B0.legal(s), false);
    B.play = (s, m) => { const fx = B0.play(s, m).fx, n = Drawbacks.play(s, m, cfg, conf); n.fx = fx; return n; };
    B.status = (s) => {
      const st = Drawbacks.status(s, conf, B0.legal);
      if (st.over) return st;
      const r = R.status(s, cfg);
      return r.over && r.reason === 'the 50 move rule' ? r : { over: false };
    };
    return B;
  }
  /* The drawbacks in the game panel: yours with its rule (and what it asks this very turn), the bot's hidden until
     the game is over. In a bot match both are shown. */
  function drawbackRow(sv) {
    const row = h('div', 'dbrow'), conf = G.db, me = G.cfg.side;
    const line = (c, who, show) => {
      const slot = conf[c], d = Drawbacks.BY[slot.id];
      let html = '<div class="dbline' + (show ? '' : ' hidden') + '"><small>' + who + '</small>';
      if (!show) return html + '<b>Hidden drawback</b><span>You find out when the game is over.</span></div>';
      html += '<b>' + d.name + '</b><span>' + Drawbacks.textOf(slot) + '</span>';
      if (d.status && !G.over && sv.turn === c && sv === live()) {
        let note = '';
        try { note = d.status(Drawbacks.ctxFor(sv, c, slot, conf, false), R.legalMoves(sv, G.cfg)); } catch (e) { note = ''; }
        if (note) html += '<em>' + note + '</em>';
      }
      return html + '</div>';
    };
    if (G.local) {
      // two at one device: only the side to move sees its own drawback, once it has said it holds the device
      const t = sv.turn, name = (c) => (c === 'w' ? 'White' : 'Black');
      if (G.over) row.innerHTML = line('w', 'White', true) + line('b', 'Black', true);
      else if (G.dbReveal === t) row.innerHTML = line(t, name(t) + '\'s drawback (you)', true) + line(R.other(t), name(R.other(t)) + '\'s drawback', false);
      else {
        row.innerHTML = '<div class="dbline hidden"><small>Both drawbacks are hidden</small><b>' + name(t) + ' to move</b><span>Hand the device to ' + name(t) + '.</span></div>';
        const b = h('button', 'btn green dbreveal', 'I am ' + name(t) + ': show my drawback');
        b.onclick = () => { G.dbReveal = live().turn; renderAll(); };
        row.appendChild(b);
      }
    } else if (G.auto) row.innerHTML = line('w', 'White', true) + line('b', 'Black', true);
    else row.innerHTML = line(me, 'Your drawback', true) + line(R.other(me), G.botName + '\'s drawback', !!G.over);
    return row;
  }
  // Fog of War: you do not see the other side's pieces (until the game is over)
  function fogged(c) {
    if (!G || !G.db || G.over || G.auto || mode() !== 'game') return false;
    const me = G.local ? G.dbReveal : G.cfg.side; // two at one device: the player who holds it
    if (!me) return false;
    const d = Drawbacks.BY[G.db[me].id];
    return !!(d && d.fog) && c !== me;
  }
  // What the search of the bot playing `me` may know: its own drawback only.
  function dbOwn(game, me) {
    if (!game.db) return undefined;
    const o = { seed: game.db.seed, check: true };
    o[me] = game.db[me];
    return o;
  }
  const dbName = (slot) => (slot && Drawbacks.BY[slot.id] ? Drawbacks.BY[slot.id].name : '');

  /* ---------- game flow ---------- */

  /* Rules backend for standard chess (rules.js). The variant backend in fairy.js
     has the same shape, so everything below works with either one. */
  function stdBackend(cfg, startFen) {
    let fairy = false, W = 8, H = 8, kingless = false;
    try { const s0 = R.fromFen(startFen, cfg); fairy = R.hasFairy(s0.board); W = s0.W || 8; H = s0.H || 8; kingless = !!s0.kingless; } catch (e) { fairy = false; }
    const ups = hasTraits(cfg.traits), big = W !== 8 || H !== 8; // big: any board that is not 8 x 8, which the chess engines cannot read
    const powers = R.hasPowers(cfg) || !!cfg.dice || !!cfg.terrain || fairy || !!cfg.kingCapture || ups || big || kingless; // anything the chess engines do not know about (a side without a king too)
    const special = (m) => m.drop || m.snipe || m.storm || m.swap || m.duck || m.spawn || m.shot || m.reload || m.blast;
    const geo = { W: W, H: H }, at = () => R.use(geo); // square names depend on the board size, which rules.js keeps for the last board it saw
    return {
      kind: 'std', W: W, H: H, big: big, powers: powers, kingless: kingless, dice: !!cfg.dice, fairy: fairy, terrain: !!cfg.terrain || ups || big, kc: !!cfg.kingCapture, ups: ups,
      initial: () => R.fromFen(startFen, cfg),
      legal: (s) => R.legalMoves(s, cfg),
      play: (s, m) => {
        const n = R.play(s, m, cfg), fx = n.fx;
        fx.anims = [];
        if (m.swap) fx.anims.push({ from: m.from, to: m.to }, { from: m.to, to: m.from });
        else if (!special(m) && !(fx.bounce >= 0)) { // a capture that bounced off a helmet: nobody moves
          fx.anims.push({ from: m.from, to: fx.tp >= 0 ? fx.tp : m.to });
          if (m.castle === 'K') fx.anims.push({ from: m.to + 1, to: m.to - 1 });
          if (m.castle === 'Q') fx.anims.push({ from: m.to - 2, to: m.to + 1 });
        }
        if (fx.demons) fx.demons.forEach((d) => { if (d.to >= 0) fx.anims.push({ from: d.from, to: d.to }); }); // the demons' own steps
        fx.capture = (!!m.cap && !(fx.bounce >= 0)) || !!(fx.demonTook && fx.demonTook.length);
        fx.booms = fx.boom ? fx.removed.map((x) => x.sq) : [];
        return n;
      },
      san: (s, m, lg, n) => R.san(s, m, cfg, lg, n),
      status: (s, lg) => R.status(s, cfg, lg),
      checks: (s) => R.checkedSquares(s, s.turn, cfg),
      gildTargets: (s, lg) => R.gildTargets(s, cfg, lg),
      gild: (s, sq) => R.gild(s, sq, cfg),
      freezeTargets: (s) => R.freezeTargets(s, cfg),
      freeze: (s, sq) => R.freeze(s, sq, cfg),
      shieldTargets: (s) => R.shieldTargets(s, cfg),
      shield: (s, sq) => R.shield(s, sq, cfg),
      withPortals: (s, a, b) => Object.assign({}, s, { portals: [a, b], fx: null }),
      fen: (s) => R.toFen(s),
      key: (s) => R.posKey(s),
      position: (s, log) => (powers ? 'fen ' + R.toFen(s) : (at(), 'fen ' + startFen + (log.length ? ' moves ' + log.map((e) => R.uci(e.m)).join(' ') : ''))),
      // The engine only knows normal chess, so it gets the moves that are legal under the power-up rules.
      searchmoves: (s, lg, forHint) => {
        if (!powers) return null;
        at();
        const list = [];
        lg.forEach((m) => {
          if (special(m)) return;
          const u = R.uci(m);
          if (list.indexOf(u) < 0) list.push(u);
        });
        return list;
      },
      find: (lg, uci) => (at(), R.findUci(lg, uci)),
      uci: (m) => (special(m) ? null : (at(), R.uci(m))),
      stopReady: (s) => R.stopReady(s, cfg),
      timeStop: (s) => R.timeStop(s, cfg),
      convertTargets: (s) => R.convertTargets(s, cfg),
      convert: (s, sq) => R.convert(s, sq, cfg),
      // Dice Chess: a turn starts unrolled; roll() applies a throw, rollFaces() makes a fair one
      unrolled: (s) => !!cfg.dice && !cfg.legacyDice && !s.dice && s.again < 0 && !s.lost,
      roll: (s, faces) => R.roll(s, cfg, faces),
      rollFaces: (s) => R.rollFaces(s, cfg),
      diceCount: R.diceCount(cfg),
      dispose: () => {}
    };
  }

  // A move as a short text, stable enough to find the same move again when a game is replayed.
  const moveKey = (m) => (m.duck ? 'Q' + m.duck : m.spawn ? 'P' : m.shot ? 'G' : m.reload ? 'L' : m.storm ? 'S' : m.drop ? 'D' + m.drop : m.snipe ? 'X' : m.blast ? 'V' : (m.kind || 'n')) + ':' + m.from + ':' + m.to + ':' + (m.promo || ''); // the same keys as brain.js
  const nameOf = (g, c) => g.names[c];

  /* A spec is everything needed to set a game up again. New games, rematches and
     archived games all go through createGame(spec). */
  function specFromSetup() {
    const bots = setup.mode === 'bots', local = setup.mode === 'local', V = Fairy.byId(setup.variant), variant = !stdVariant(V.id);
    const pick = (b) => ({ engine: prefEngine(b.engine), bot: b.bot });
    const copy = (o) => JSON.parse(JSON.stringify(o));
    return {
      mode: bots ? 'bots' : local ? 'local' : 'human', variant: V.id, engine: engineKind(), bot: setup.bot,
      bots: bots ? { w: pick(setup.botW), b: pick(setup.botB) } : null, flipEach: local ? !!setup.flipEach : false,
      side: bots ? 'x' : local ? 'w' : (setup.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : setup.color),
      // powers: yours, or White's in a bot match. powers2: the other side's own set.
      powers: V.checkers ? noPowers() : bots && V.nobrain ? {} : copy(setup.powers),
      powers2: !V.nobrain && !V.checkers && setup.ai.use === 'own' ? copy(setup.powers2) : null,
      ai: V.nobrain || V.checkers ? null : { anticipate: !!setup.ai.anticipate, use: setup.ai.use },
      seed: Math.floor(Math.random() * 0x7fffffff) + 1, // the dice of Dice Chess, the pellets of a Shotgun King
      fen: stdVariant(V.id) ? setup.fen : V.checkers ? (checkersBoard(setup.fen) ? setup.fen : V.fen) : null, customIni: V.id === 'custom' ? setup.customIni : null, clock: setup.clock,
      terrain: stdVariant(V.id) && hasTerrain(setup.terrain) ? copy(setup.terrain) : null,
      kingCapture: autoKC().on, diceV: 2,
      traits: stdVariant(V.id) && hasTraits(setup.traits) ? copy(setup.traits) : null
    };
  }

  async function createGame(spec) {
    const V = Fairy.byId(spec.variant), auto = spec.mode === 'bots', local = spec.mode === 'local', std = stdVariant(V.id) || !!V.checkers;
    // checkers rules: the Checkers variant, or a normal game started from a board of only checkers pieces
    const ckGame = !!V.checkers || (V.id === 'chess' && !!spec.fen && checkersBoard(spec.fen));
    const ownG = ckGame ? 'Checkers' : V.duckChess ? 'Duck Chess' : null; // the app's own engine plays it
    const flags = (pw) => {
      pw = pw || {};
      const o = { double: pw.double || 0, midasPerTurn: pw.midasPerTurn == null ? 1 : pw.midasPerTurn };
      POWER_KEYS.forEach((k) => { o[k] = !!pw[k]; });
      o.helmet = +pw.helmet || 0; o.vest = +pw.vest || 0; // which pieces wear it: 1 chess pieces, 2 all but pawns, 3 all
      if (pw.ou) o.ou = pw.ou; if (pw.firegem) o.firegem = true; if (pw.tempoMax) o.tempoMax = pw.tempoMax; // The Ouroboros King: relics, Fire gem, the Rocking chair
      return o;
    };
    /* cfg carries the player's own flags (that is what the panel reads) plus cfg.pw with one set per
       colour, which is what the rules read. Games archived before the sets were split stored use as
       true or false, and variant games from before the bots knew power-ups there have no ai entry. */
    const use = V.nobrain || !spec.ai ? 'none' : spec.ai.use === true ? 'same' : (spec.ai.use === 'same' || spec.ai.use === 'own' ? spec.ai.use : 'none');
    const mine = flags(spec.powers), theirs = use === 'same' ? flags(spec.powers) : use === 'own' ? flags(spec.powers2) : null;
    if (theirs) { theirs.veto = theirs.puppet = false; if (use === 'own' && !local) theirs.portals = false; }
    if (auto) HUMAN_ONLY.forEach((k) => { mine[k] = false; if (theirs) theirs[k] = false; });
    if (local) mine.veto = mine.puppet = false; // both need an engine to play against
    const cfg = Object.assign({}, mine, { side: spec.side });
    const me = auto ? 'w' : spec.side, pw = { w: null, b: null };
    const setPw = () => {
      pw.w = pw.b = null;
      if (R.anyPower(mine) || mine.ou || mine.firegem) pw[me] = mine; // The Ouroboros King's relics count too
      if (theirs && R.anyPower(theirs)) pw[R.other(me)] = theirs;
    };
    setPw();
    cfg.pw = pw;
    // Dice Chess. A game saved before the dice were rolled by hand (no diceV) keeps its seeded rolls, so it replays.
    if (std && V.dice) { cfg.dice = true; if (spec.diceV !== 2) { cfg.legacyDice = true; cfg.seed = spec.seed || 1; } }
    if (std && !cfg.seed && spec.seed) cfg.seed = spec.seed; // a Shotgun King's luck: the same game replays the same way
    if (std && V.dice3) { cfg.dice3 = true; cfg.kingCapture = true; } // three dice, all of them used, and the king is taken
    if (std && (hasTerrain(spec.terrain) || (spec.terrain && spec.gameMode && spec.gameMode.kind === 'run'))) cfg.terrain = JSON.parse(JSON.stringify(spec.terrain)); // a run's battle always has one (bombs, boulders to come)
    if (std && spec.kingCapture) cfg.kingCapture = true; // Ouroboros rules: no check, the king is simply taken
    if (std && hasTraits(spec.traits)) cfg.traits = JSON.parse(JSON.stringify(spec.traits)); // upgrades placed by hand
    const anySf = auto ? (spec.bots.w.engine === 'sf' || spec.bots.b.engine === 'sf') : spec.engine === 'sf';
    const kind = !std || ownG ? 'fairy' : (anySf ? 'sf' : 'fairy'); // the engine that reviews and analyses this game
    const secs = spec.clock === 915 ? 900 : spec.clock, bot = botById(spec.bot);
    const g = {
      spec: spec, auto: auto, local: local, ai: null, use: use, pw: pw, dice: false, bo: null, engine: kind, cfg: cfg, bot: bot, bots: null, botName: '', statKey: statKey(kind, bot), names: {}, tags: {},
      variantGame: false, vname: 'chess', uci: 'chess', c960: false, custom: null, hand: false, archiveId: null,
      B: null, W: 8, H: 8, glyphs: {}, states: [], log: [], view: 0, over: null, endOpen: false, counted: false,
      legal: [], keys: {}, startFen: '', moveNo: 1, analysis: null,
      vetoLeft: cfg.veto && !auto ? 3 : 0, banned: {}, puppetLeft: cfg.puppet && !auto ? 1 : 0, puppetArmed: false, puppetNow: false,
      clock: { on: spec.clock > 0, w: secs * 1000, b: secs * 1000, inc: spec.clock === 915 ? 10000 : 0, last: performance.now(), warned: false }
    };
    if (auto) {
      g.bots = { w: { engine: spec.bots.w.engine, bot: botById(spec.bots.w.bot) }, b: { engine: spec.bots.b.engine, bot: botById(spec.bots.b.bot) } };
      ['w', 'b'].forEach((c) => { const lab = botLabel(g.bots[c].bot, g.bots[c].engine === 'fairy', ownG); g.names[c] = lab.name; g.tags[c] = lab.tag; });
      g.botName = g.names.w + ' and ' + g.names.b;
    } else if (local) {
      g.names.w = 'White'; g.names.b = 'Black';
      g.botName = 'Black';
    } else {
      const lab = botLabel(bot, kind === 'fairy', ownG), opp = R.other(spec.side);
      g.botName = lab.name;
      g.names[spec.side] = 'You'; g.names[opp] = lab.name; g.tags[opp] = lab.tag;
    }
    if (spec.hex) {
      // Hexagonal Chess: no power-ups, no variants, its own rules and engine
      cfg.hex = true; cfg.pw = { w: null, b: null };
      g.B = hexBackend(); g.hex = true; g.W = 11; g.H = 11; g.vname = 'Hexagonal Chess'; g.uci = 'hex'; g.engine = 'hex';
      g.startFen = Hex.toFen(g.B.initial()); g.moveNo = 1; g.statKey = 'hex:' + bot.id;
      // the strongest bot is the hex engine at full strength, not Stockfish
      ['w', 'b'].forEach((c) => { if (g.names[c] === 'Fairy-Stockfish Max' || g.names[c] === 'Stockfish Max') g.names[c] = 'Hex Engine Max'; });
      g.botName = g.botName.replace(/(Fairy-)?Stockfish Max/g, 'Hex Engine Max');
    } else if (std) {
      cfg.freeArmy = !anySf || local;
      if (spec.drawback) { cfg.kingCapture = true; cfg.castleAny = true; cfg.freeArmy = true; } // Drawback Chess: the king is taken, it may castle through check
      if (V.dice) { g.dice = true; g.vname = V.name; }
      if (V.duckChess) {
        // Duck Chess: king capture, no stalemate, and the duck waits in the hand until White's first move is played
        cfg.duckChess = true; cfg.kingCapture = true; cfg.freeArmy = true; g.duck = true; g.vname = V.name;
        if (!cfg.terrain) cfg.terrain = { walls: [], water: [], portals: [], holes: [], ducks: [], bducks: [] };
      }
      if (ckGame) { cfg.checkers = true; cfg.freeArmy = true; g.checkers = true; g.vname = 'Checkers'; if (V.checkers) cfg.pw = { w: null, b: null }; } // the variant has no power-ups, a normal game keeps its own
      const s0 = R.fromFen(spec.fen || R.START_FEN, cfg);
      if ((s0.W || 8) !== 8 || (s0.H || 8) !== 8) cfg.freeArmy = true; // a big board has no standard army to compare with
      const errs = R.validate(s0, cfg);
      if (errs.length) throw new Error(errs[0]);
      g.startFen = R.toFen(s0);
      g.moveNo = s0.full;
      g.B = stdBackend(cfg, g.startFen);
      if (spec.drawback) { g.db = dbConf(spec.drawback, cfg); g.B = drawbackBackend(g.B, cfg, g.db); g.vname = 'Drawback Chess'; }
      g.W = g.B.W; g.H = g.B.H;
    } else {
      const ff = await Fairy.rules();
      let uci = V.uci || V.id, fen = V.fen, glyphs = V.glyphs || {}, cust = null;
      if (V.id === 'custom') {
        if (spec.customIni === setup.customIni) { if (!custom) custom = await Fairy.loadCustom(setup.customIni); cust = custom; }
        else cust = await Fairy.loadCustom(spec.customIni);
        uci = cust.uci; fen = cust.fen; glyphs = cust.glyphs;
      }
      if (spec.fen) fen = spec.fen; // a replay starts from exactly the position it was played from
      else if (V.c960) {
        const b0 = new ff.Board(uci, Fairy.random960(), true);
        fen = b0.fen();
        b0.delete();
      }
      const hand = ff.capturesToHand(uci);
      if (hand || V.drops) { cfg.drops = mine.drops = false; if (theirs) theirs.drops = false; setPw(); } // the variant already has pockets of its own
      // everything the rules backend needs besides the power-ups, kept for the variant search in its worker
      g.bo = { uci: uci, c960: !!V.c960, startFen: fen, hand: hand, special: !!V.special, nocheck: !!V.nocheck, boom: !!V.boom, keepCastle: !!V.keepCastle, inverse: !!V.inverse, ini: cust ? cust.ini : null };
      g.B = Fairy.backend(ff, Object.assign({ cfg: cfg }, g.bo));
      g.variantGame = true; g.uci = uci; g.c960 = !!V.c960; g.custom = cust; g.glyphs = glyphs;
      g.vname = cust ? cust.title : V.name; g.hand = hand || !!V.drops;
      g.startFen = fen; g.W = g.B.W; g.H = g.B.H;
      const mv = parseInt(fen.split(' ').pop(), 10);
      if (mv > 0) g.moveNo = mv;
    }
    spec.fen = g.startFen;
    // The power-up search plays for a bot that has power-ups, and for one that should see the other side's coming.
    const odd = !!g.hex || (std && (g.B.fairy || g.B.terrain || g.B.kc || g.B.kingless || newDice(cfg))); // fairy pieces, terrain, king capture or real dice: only the power-up search knows them; hex: its own engine
    g.ai = !V.nobrain && (pw.w || pw.b || odd) ? { anticipate: odd || !!(spec.ai && spec.ai.anticipate) } : null;
    // Say so next to the bot's name: its moves are not the chess engine's own any more.
    if (g.ai && !g.hex && !g.checkers && !g.duck) ['w', 'b'].forEach((c) => {
      if ((auto || c !== spec.side) && g.tags[c] && (pw[c] || odd || (g.ai.anticipate && pw[R.other(c)]))) g.tags[c] += ', guided by the power-up search';
    });
    if (g.hex) ['w', 'b'].forEach((c) => { if (g.tags[c]) g.tags[c] = g.tags[c].replace(/, (Fairy-)?Stockfish.*$/, '') + ', hex engine'; });
    g.states = [g.B.initial()];
    g.legal = g.B.legal(g.states[0]);
    g.keys[g.B.key(g.states[0])] = 1;
    return g;
  }

  // A backend may be shared by the game and the analysis board, so it is only freed when neither uses it.
  function release(B) {
    if (B && (!G || G.B !== B) && (!A || A.B !== B)) B.dispose();
  }
  function installGame(g) {
    stopEngines();
    if (g.engine === 'fairy' || (g.bots && (g.bots.w.engine === 'fairy' || g.bots.b.engine === 'fairy'))) getFairy().catch(() => {}); // warm it up
    if (engineReady) engine.newGame();
    const old = G;
    G = g;
    ui.info = null; ui.peek = null; ui.threat = null; // a piece card from the last game does not stay open
    rv = null;
    release(old && old.B);
    ui.flipped = g.local ? false : g.cfg.side === 'b';
    ui.flipSaved = null; // a new game decides its own orientation
    ui.sel = null; ui.mode = null; ui.arrows = []; ui.marks = []; ui.hintArrow = null; ui.hintWanted = false; ui.thinking = false; ui.premoves = []; ui.drag = null;
    ui.eval = { cp: 0, mate: null, depth: 0 };
    BW = 0; // force a rebuild of the squares for the new orientation
    saveLive(); // a new game takes the place of the kept one
  }

  /* A running game left for another one is given up: in the record, the rating and the archive, as a
     resignation (a bot match or a two-player game is stopped). Before your first move it is just called
     off. Game Modes keep theirs (MS.pending). false: the player keeps playing. */
  function leaveRunning(msg) {
    if (!G || G.over || !G.log.length || (G.spec && G.spec.gameMode)) return true;
    const played = G.auto || G.local ? G.log.length : G.log.filter((e) => e.by === G.cfg.side).length;
    if (!played) return true;
    if (!confirm(G.auto ? 'A bot match is running. Stop it?' : G.local ? 'A game is still running. End it here?' : msg)) return false;
    finish(G.auto || G.local ? { over: true, result: 'draw', reason: 'stopped' } : { over: true, result: R.other(mySide()), reason: 'resignation' }, true);
    return true;
  }

  /* ---------- the daily challenge ----------
     One game a day, the same for everybody that day: two power-ups drawn from the date, for both sides (fair), a bot
     that gets stronger through the week (Monday easy, Sunday hard, like a newspaper puzzle), your colour by the day.
     The first result of the day counts; the Game Modes tab shows the last two weeks and the streak of days won. */
  const DAILY_KEY = 'powerchess_daily';
  let daily = {};
  try { daily = JSON.parse(localStorage.getItem(DAILY_KEY)) || {}; } catch (e) { daily = {}; }
  const saveDaily = () => { try { localStorage.setItem(DAILY_KEY, JSON.stringify(daily)); } catch (e) { /* private mode */ } };
  const DAILY_POOL = ['sniper', 'midas', 'freeze', 'dragon', 'amazon', 'rocket', 'explosive', 'timestop', 'rampage', 'bodyguard', 'earlypromo', 'ghost', 'iron', 'turncoat', 'shield', 'tempo', 'archer', 'sniperR'];
  const DAILY_BOT = ['b5', 'b1', 'b2', 'b3', 'b3', 'b4', 'b4']; // Sunday to Saturday
  const dayKeyOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function dailyOf(key) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
    const a = DAILY_POOL[Math.floor(rnd() * DAILY_POOL.length)];
    let b = a;
    while (b === a) b = DAILY_POOL[Math.floor(rnd() * DAILY_POOL.length)];
    const day = new Date(key + 'T12:00:00').getDay();
    return { key: key, powers: [a, b], bot: DAILY_BOT[day], side: rnd() < 0.5 ? 'w' : 'b', day: day, seed: (h % 0x7ffffffe) + 1 };
  }
  function dailySpec(d) {
    const pw = noPowers();
    d.powers.forEach((k) => { pw[k] = true; });
    return { mode: 'human', variant: 'chess', engine: prefEngine('auto'), bot: d.bot, bots: null, flipEach: false, side: d.side, powers: pw, powers2: null,
      ai: { anticipate: false, use: 'same' }, seed: d.seed, fen: R.START_FEN, customIni: null, clock: 0, terrain: null, kingCapture: false, diceV: 2, traits: null, daily: d.key };
  }
  async function startDaily() {
    if (starting || !leaveRunning('A game is still running. Starting the daily challenge counts as a resignation. Resign it?')) return;
    starting = true;
    let g;
    try { g = await createGame(dailySpec(dailyOf(dayKeyOf(new Date())))); } catch (e) { toast(e.message || 'The game could not be set up'); return; } finally { starting = false; }
    installGame(g);
    botBrain.fresh(); evalBrain.fresh();
    snd('start');
    setTab('play');
    afterAction(true);
  }
  // days won in a row, up to today (today still open does not break it)
  function dailyStreak() {
    let n = 0;
    const d = new Date();
    if (!daily[dayKeyOf(d)]) d.setDate(d.getDate() - 1);
    for (;;) { const r = daily[dayKeyOf(d)]; if (!r || r.r !== 'w') return n; n++; d.setDate(d.getDate() - 1); }
  }
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function dailyModeCard() {
    const key = dayKeyOf(new Date()), d = dailyOf(key), rec = daily[key], bot = botLabel(botById(d.bot), false);
    const names = d.powers.map((k) => (POWER_LIST.find((x) => x.key === k) || { name: k }).name);
    let html = '<div class="gm-card"><div class="gm-head"><h2>Daily Challenge</h2><div class="gm-credits"><b>' + dailyStreak() + '</b><span>streak</span></div></div>';
    html += '<p class="gm-fixed">' + WEEKDAYS[d.day] + ': ' + bot.name + ' (' + bot.elo + '). Both sides have ' + names.join(' and ') + '. You play ' + (d.side === 'w' ? 'White' : 'Black') + '.</p>';
    if (rec) html += '<p class="gm-fixed"><b>' + (rec.r === 'w' ? 'Won' : rec.r === 'd' ? 'Drawn' : 'Lost') + '</b> in ' + rec.n + ' moves. Again any time, only the first game counts.</p>';
    html += '<button class="btn green gm-wide" data-gm="dailystart">' + (rec ? 'Play again' : 'Play today\'s challenge') + '</button>';
    html += '<div class="gm-lab">The last two weeks</div><div class="pz-days">';
    for (let i = 13; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const r = daily[dayKeyOf(dt)];
      html += '<button disabled class="' + (r ? (r.r === 'w' ? 'ok' : r.r === 'l' ? 'bad' : '') : '') + (i === 0 ? ' on' : '') + '"><b>' + dt.getDate() + '.' + (dt.getMonth() + 1) + '.</b><span>' + (r ? (r.r === 'w' ? 'won' : r.r === 'd' ? 'drawn' : 'lost') : i ? '' : 'today') + '</span></button>';
    }
    return html + '</div></div>';
  }

  /* ---------- the first start ----------
     A short welcome on the very first start, and a guided first game: the Rookie, Freeze Ray and Sniper Bishops for
     you, three tips one after the other. Settings can show the welcome again. */
  const INTRO_KEY = 'powerchess_intro';
  const introDone = () => { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch (e) { return true; } };
  const setIntroDone = () => { try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* private mode */ } };
  function showIntro() {
    if ($('#intro')) return;
    const box = h('div', '', '<div class="intro-box"><img src="pieces/wN.svg" alt=""><h2>Welcome to Power Chess</h2><p>Chess with power-ups: freeze a piece, shoot from a distance, turn pieces to gold. The bots know them too.</p>' +
      '<div class="intro-btns"><button class="btn green" id="introGo">Play a guided game</button><button class="btn" id="introSkip">Look around</button></div></div>');
    box.id = 'intro';
    document.body.appendChild(box);
    const close = () => { box.remove(); setIntroDone(); };
    $('#introSkip').onclick = close;
    $('#introGo').onclick = () => { close(); startGuide(); };
  }
  async function startGuide() {
    if (starting || !leaveRunning('A game is still running. Starting the guided game counts as a resignation. Resign it?')) return;
    const pw = noPowers();
    pw.freeze = true; pw.sniper = true;
    const spec = { mode: 'human', variant: 'chess', engine: prefEngine('auto'), bot: 'b1', bots: null, flipEach: false, side: 'w', powers: pw, powers2: null,
      ai: { anticipate: false, use: 'none' }, seed: 1 + Math.floor(Math.random() * 1e9), fen: R.START_FEN, customIni: null, clock: 0, terrain: null, kingCapture: false, diceV: 2, traits: null, guide: true };
    starting = true;
    let g;
    try { g = await createGame(spec); } catch (e) { toast(e.message || 'The game could not be set up'); return; } finally { starting = false; }
    installGame(g);
    botBrain.fresh(); evalBrain.fresh();
    snd('start');
    setTab('play');
    afterAction(true);
  }
  // the tips of the guided game: one at a time, by what has happened so far
  const GUIDE_TIPS = [
    'Your bishops are snipers. Click one: a ringed enemy piece can be shot without the bishop moving. A shot is your move.',
    'Freeze Ray: press it in the bar above the moves, then click an enemy piece. It cannot move on its next turn, and freezing costs you no move.',
    'That is the idea. New Game has all the power-ups, the variants and the board editor, Game Modes the daily challenge and the runs. Point at a button to see what it does.'
  ];
  function renderGuide() {
    const box = $('#guide');
    if (!box) return;
    if (!G || !G.spec || !G.spec.guide || G.over || G.guideDone || mode() !== 'game') { box.innerHTML = ''; box.style.display = 'none'; return; }
    const mine = G.log.filter((e) => e.by === G.cfg.side), moves = mine.filter((e) => e.m).length, froze = mine.some((e) => e.freeze != null);
    const tip = moves === 0 ? 0 : !froze && moves < 6 ? 1 : 2;
    box.style.display = 'block';
    box.innerHTML = '<div class="guide-tip"><button class="guide-x" id="guideOk" title="' + (tip === 2 ? 'Got it' : 'Hide the tips') + '">×</button><b>Tip ' + (tip + 1) + ' of 3</b><p>' + GUIDE_TIPS[tip] + '</p></div>';
    $('#guideOk').onclick = () => { G.guideDone = true; renderAll(); };
  }

  let starting = false;
  async function startGame() {
    if (starting) return;
    if (!leaveRunning('A game is still running. Starting a new one counts as a resignation. Resign it?')) return;
    starting = true;
    $('#startBtn').textContent = 'Loading';
    let g;
    try { g = await createGame(specFromSetup()); } catch (e) { toast(e.message || 'The game could not be set up'); return; } finally {
      starting = false;
      $('#startBtn').textContent = 'Start game';
    }
    installGame(g);
    botBrain.fresh(); evalBrain.fresh();
    snd('start');
    setTab('play');
    afterAction(true);
  }

  /* ---------- game archive ---------- */

  const ARCH_KEY = 'powerchess_games', ARCH_MAX = 150;
  let archive = [];
  try { archive = JSON.parse(localStorage.getItem(ARCH_KEY)) || []; } catch (e) { archive = []; }
  function saveArchive() {
    for (let tries = 0; tries < 4; tries++) {
      try { localStorage.setItem(ARCH_KEY, JSON.stringify(archive)); return; } catch (e) { archive.length = Math.floor(archive.length * 0.8); } // storage full: let the oldest go
    }
  }
  // The game as a list of short action texts: moves, power-up actions and portal placements.
  function actionsOf(g) {
    const out = [];
    let portals = '';
    g.log.forEach((e, i) => {
      const p = g.states[i].portals.join(',');
      if (p !== portals) { portals = p; if (p) out.push('p|' + p); }
      if (e.gild != null) out.push('g|' + e.gild);
      else if (e.freeze != null) out.push('f|' + e.freeze);
      else if (e.shield != null) out.push('h|' + e.shield);
      else if (e.stop) out.push('t|');
      else if (e.convert != null) out.push('c|' + e.convert);
      else if (e.powerup != null) out.push('u|' + e.powerup + ':' + e.to);
      else if (e.downgrade != null) out.push('v|' + e.downgrade + ':' + e.to);
      else if (e.spike != null) out.push('x|' + e.spike);
      else if (e.horn != null) out.push('q|' + e.horn);
      else if (e.ouItem) out.push('o|' + e.ouItem + ':' + e.a + ':' + e.b);
      else if (e.roll) out.push('r|' + e.roll.join(','));
      else out.push((e.puppet ? 'M|' : 'm|') + moveKey(e.m));
    });
    return out;
  }
  function replay(g, actions) {
    let s = g.states[0];
    actions.forEach((a) => {
      const kind = a[0], arg = a.slice(2), by = s.turn;
      let n, entry;
      if (kind === 'p') {
        const pq = arg.split(',').map(Number);
        g.states[g.states.length - 1] = s = g.B.withPortals(s, pq[0], pq[1]);
        return;
      }
      if (kind === 'g') { n = g.B.gild(s, +arg); entry = { by: by, gild: +arg, san: '✦' + Fairy.sqName(+arg, g.W, g.H), removed: [] }; }
      else if (kind === 'f') { n = g.B.freeze(s, +arg); entry = { by: by, freeze: +arg, san: '❄' + Fairy.sqName(+arg, g.W, g.H), removed: [] }; }
      else if (kind === 'h') { n = g.B.shield(s, +arg); entry = { by: by, shield: +arg, san: '\u26e8' + Fairy.sqName(+arg, g.W, g.H), removed: [] }; }
      else if (kind === 't') { n = g.B.timeStop(s); entry = { by: by, stop: true, san: '⧖', removed: [] }; }
      else if (kind === 'u' || kind === 'v') { const a2 = arg.split(':'); n = ouEdit(g.B, s, +a2[0], a2[1], kind === 'v'); entry = { by: by, to: a2[1], san: (kind === 'u' ? '\u21e7' : '\u21e9') + Fairy.sqName(+a2[0], g.W, g.H), removed: [] }; entry[kind === 'u' ? 'powerup' : 'downgrade'] = +a2[0]; }
      else if (kind === 'x') { const t0 = s.board[+arg]; n = ouEdit(g.B, s, +arg, '', false); entry = { by: by, spike: +arg, spiked: t0, san: '\u2736' + Fairy.sqName(+arg, g.W, g.H), removed: [{ sq: +arg, p: t0 }] }; }
      else if (kind === 'o') { const a3 = arg.split(':'); n = R.ouItem(s, g.cfg, a3[0], +a3[1], +a3[2]); entry = { by: by, ouItem: a3[0], a: +a3[1], b: +a3[2], san: (OU_SAN[a3[0]] || '') + (+a3[1] >= 0 ? Fairy.sqName(+a3[1], g.W, g.H) : '') + (+a3[2] >= 0 ? Fairy.sqName(+a3[2], g.W, g.H) : ''), removed: [] }; }
      else if (kind === 'q') { n = ouEdit(g.B, s, +arg, by === 'w' ? 'Q' : 'q', false); entry = { by: by, horn: +arg, san: '+Q' + Fairy.sqName(+arg, g.W, g.H), removed: [] }; }
      else if (kind === 'c') { n = g.B.convert(s, +arg); entry = { by: by, convert: +arg, san: '⇄' + Fairy.sqName(+arg, g.W, g.H), removed: [] }; }
      else if (kind === 'r') { const f = arg.split(','); n = g.B.roll(s, f); entry = { by: by, roll: f, san: '', removed: [], wasted: !!(n && n.wasted) }; }
      else {
        const lg = g.B.legal(s);
        let m = lg.find((x) => moveKey(x) === arg);
        if (!m && arg[0] === 'G') { const fq = arg.split(':'); m = { from: +fq[1], to: +fq[2], piece: s.board[+fq[1]], cap: '', capSq: -1, shot: true }; } // a Shotgun King's shot at a square, not a piece
        if (!m) throw new Error('move ' + (g.log.length + 1) + ' no longer fits the rules');
        n = g.B.play(s, m);
        entry = { by: by, m: m, san: g.B.san(s, m, lg, n), removed: n.fx.removed, tp: n.fx.tp, puppet: kind === 'M' };
      }
      if (!n) throw new Error('action ' + (g.log.length + 1) + ' could not be repeated');
      if (!entry.m) n.fx = null;
      g.states.push(n);
      g.log.push(entry);
      s = n;
    });
  }
  /* The running game is kept as it goes (the setup and its actions), so that it is still there when the app is
     opened again: a phone closes apps in the background without asking. Game Modes keep theirs in MS.pending. */
  const LIVE_KEY = 'powerchess_live';
  function saveLive() {
    try {
      if (!G || (G.spec && G.spec.gameMode) || G.over || G.archiveId || !G.log.length) { localStorage.removeItem(LIVE_KEY); return; }
      localStorage.setItem(LIVE_KEY, JSON.stringify({ spec: G.spec, actions: actionsOf(G), clock: G.clock.on ? { w: G.clock.w, b: G.clock.b } : null, vetoLeft: G.vetoLeft, banned: G.banned }));
    } catch (e) { /* storage full or private mode: the game just is not kept */ }
  }
  async function resumeLive() {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(LIVE_KEY)); } catch (e) { o = null; }
    if (!o || !o.spec || !o.actions || G || starting) return false;
    let g;
    starting = true;
    try {
      g = await createGame(o.spec);
      replay(g, o.actions);
    } catch (e) {
      try { localStorage.removeItem(LIVE_KEY); } catch (e2) { /* private mode */ }
      return false;
    } finally { starting = false; }
    g.view = g.states.length - 1;
    g.legal = g.B.legal(g.states[g.view]);
    g.keys = {};
    g.states.forEach((st, i) => { if (i && g.log[i - 1].roll) return; const k = g.B.key(st); g.keys[k] = (g.keys[k] || 0) + 1; });
    if (o.clock && g.clock.on) { g.clock.w = o.clock.w; g.clock.b = o.clock.b; g.clock.last = performance.now(); }
    if (o.vetoLeft != null) g.vetoLeft = o.vetoLeft;
    if (o.banned) g.banned = o.banned;
    installGame(g);
    botBrain.fresh(); evalBrain.fresh();
    if (ui.tab === 'new') setTab('play');
    afterAction(true);
    return true;
  }

  // Every power-up in the game, whoever has it.
  function allPowerNames(g) {
    const out = powerNames(g.cfg);
    ['w', 'b'].forEach((c) => powerNames(g.pw[c]).forEach((n) => { if (out.indexOf(n) < 0) out.push(n); }));
    return out;
  }
  function archiveGame() {
    if (!G || !G.over || !G.log.length) return;
    const old = G.archiveId ? archive.findIndex((r) => r.id === G.archiveId) : -1;
    const rec = {
      id: G.archiveId || Date.now(), date: old >= 0 ? archive[old].date : Date.now(), spec: G.spec, actions: actionsOf(G),
      over: { over: true, result: G.over.result, reason: G.over.reason }, white: nameOf(G, 'w'), black: nameOf(G, 'b'), tags: G.tags,
      vname: G.variantGame || G.dice || G.checkers || G.duck ? G.vname : '', powers: allPowerNames(G),
      plies: G.log.filter((e) => e.m).length, you: G.auto || G.local ? null : G.cfg.side, acc: old >= 0 ? archive[old].acc : null
    };
    G.archiveId = rec.id;
    if (old >= 0) archive.splice(old, 1);
    archive.unshift(rec);
    if (archive.length > ARCH_MAX) archive.length = ARCH_MAX;
    saveArchive();
  }
  async function openArchived(id) {
    const rec = archive.find((r) => r.id === id);
    if (!rec || starting) return;
    if (!leaveRunning('A game is still running. Opening another one counts as a resignation. Resign it?')) return;
    let g;
    starting = true;
    try {
      g = await createGame(JSON.parse(JSON.stringify(rec.spec)));
      replay(g, rec.actions);
    } catch (e) {
      toast('This game could not be restored: ' + (e.message || 'unknown reason'));
      return;
    } finally { starting = false; }
    g.over = rec.over;
    g.counted = true;
    g.archiveId = rec.id;
    g.clock.on = false;
    g.view = g.states.length - 1;
    g.legal = g.B.legal(g.states[g.view]);
    g.keys = {};
    g.states.forEach((s, i) => { if (i && g.log[i - 1].roll) return; const k = g.B.key(s); g.keys[k] = (g.keys[k] || 0) + 1; }); // throws are no repetitions (see afterAction)
    installGame(g);
    setTab('play');
  }
  function resultTag(rec) {
    if (rec.over.result === 'draw') return { cls: 'd', txt: rec.over.reason === 'stopped' ? 'stop' : '½' };
    if (!rec.you) return { cls: 'n', txt: rec.over.result === 'w' ? '1-0' : '0-1' };
    return rec.over.result === rec.you ? { cls: 'w', txt: 'Won' } : { cls: 'l', txt: 'Lost' };
  }
  /* The whole archive as one PGN file, every game replayed through its own rules so the notation is
     right for variants too. The file is handed to the browser to save. */
  async function exportArchive() {
    if (!archive.length) return;
    const parts = [];
    for (const rec of archive) {
      try {
        const g = await createGame(JSON.parse(JSON.stringify(rec.spec)));
        replay(g, rec.actions);
        g.over = rec.over;
        parts.push(pgn(g, rec.date));
        if (g.B !== (G && G.B)) release(g.B);
      } catch (e) { /* a game that cannot be replayed is left out */ }
    }
    const blob = new Blob([parts.join('\n\n') + '\n'], { type: 'application/x-chess-pgn' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'power-chess-games.pgn';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(parts.length + (parts.length === 1 ? ' game exported' : ' games exported'));
  }
  // A PGN file (one or many games, standard chess) becomes archive entries that can be replayed, reviewed and analysed.
  function importPgnText(text) {
    const games = text.split(/(?=\[Event\s)/).map((t) => t.trim()).filter((t) => t && /\[\w+\s+"/.test(t) ? true : t.split(/\s+/).length > 3);
    let added = 0, skipped = 0;
    const tag = (t, name) => { const m = new RegExp('\\[' + name + '\\s+"([^"]*)"\\]', 'i').exec(t); return m ? m[1] : ''; };
    games.forEach((t) => {
      const variant = tag(t, 'Variant');
      if (variant && !/^(standard|chess)$/i.test(variant)) { skipped++; return; }
      const pg = parsePgn(t);
      if (!pg.sans.length) { skipped++; return; }
      const cfg = { side: 'w' }, fen = pg.fen || R.START_FEN;
      let s;
      try { s = R.fromFen(fen, cfg); } catch (e) { skipped++; return; }
      const actions = [];
      for (const want of pg.sans) {
        const lg = R.legalMoves(s, cfg);
        let hit = null;
        for (const m of lg) { const after = R.play(s, m, cfg); if (R.san(s, m, cfg, lg, after).replace(/[+#]/g, '') === want) { hit = m; s = after; break; } }
        if (!hit) break;
        actions.push('m|' + moveKey(hit));
      }
      if (!actions.length) { skipped++; return; }
      const result = tag(t, 'Result'), st = R.status(s, cfg);
      const over = st.over ? { over: true, result: st.result, reason: st.reason }
        : { over: true, result: result === '1-0' ? 'w' : result === '0-1' ? 'b' : 'draw', reason: result === '1/2-1/2' ? 'agreed' : result === '*' ? 'stopped' : 'resignation' };
      const powers = {}; POWER_KEYS.forEach((k) => { powers[k] = false; }); powers.double = 0; powers.midasPerTurn = 1;
      const spec = { mode: 'human', variant: 'chess', engine: 'sf', bot: 'max', bots: null, side: 'w', powers: powers, powers2: null, ai: { anticipate: false, use: 'none' }, seed: 0, fen: fen, customIni: null, clock: 0 };
      const date = Date.parse((tag(t, 'Date') || '').replace(/\./g, '-').replace(/\?/g, '1')) || Date.now();
      archive.unshift({
        id: Date.now() + added, date: date, spec: spec, actions: actions, over: over,
        white: tag(t, 'White') || 'White', black: tag(t, 'Black') || 'Black', tags: {}, vname: '', powers: [],
        plies: actions.length, you: null, acc: null, imported: true
      });
      added++;
    });
    if (archive.length > ARCH_MAX) archive.length = ARCH_MAX;
    saveArchive();
    renderArchive();
    toast(added + (added === 1 ? ' game imported' : ' games imported') + (skipped ? ', ' + skipped + ' skipped' : ''));
  }
  function renderArchive() {
    const box = $('#archBody');
    if (!archive.length) {
      box.innerHTML = '<div id="empty"><img src="' + pieceDir() + 'wR.svg" alt=""><br>No games yet.<br>Every finished game is kept here, with its power-ups and variant, ready to be replayed, reviewed or analysed.<br><br><button class="btn" id="archImport">Import a PGN file</button></div>';
      $('#archImport').onclick = () => $('#pgnFile').click();
      return;
    }
    box.innerHTML = '<div class="arch-top"><span>' + archive.length + (archive.length === 1 ? ' game' : ' games') + '</span><span><button class="btn" id="archExport">Export PGN</button> <button class="btn" id="archImport">Import PGN</button> <button class="btn" id="archClear">Delete all</button></span></div>';
    archive.forEach((rec) => {
      const tag = resultTag(rec), d = new Date(rec.date), pad = (n) => (n < 10 ? '0' : '') + n;
      const when = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      const why = { checkmate: 'checkmate', stalemate: 'stalemate', repetition: 'repetition', timeout: 'on time', resignation: 'resignation', variant: 'variant rule', drawrule: 'draw rule', stopped: 'stopped' }[rec.over.reason] || rec.over.reason;
      let chips = rec.vname ? '<span class="chip">' + rec.vname + '</span>' : '';
      if (rec.powers.length) chips += '<span class="chip" title="' + rec.powers.join(', ') + '">' + rec.powers.length + (rec.powers.length === 1 ? ' power-up' : ' power-ups') + '</span>';
      if (rec.acc) chips += '<span class="chip acc">' + (rec.acc.w == null ? '?' : rec.acc.w.toFixed(0)) + ' / ' + (rec.acc.b == null ? '?' : rec.acc.b.toFixed(0)) + '</span>';
      const row = h('div', 'arch' + (G && G.archiveId === rec.id ? ' on' : ''),
        '<div class="res ' + tag.cls + '">' + tag.txt + '</div><div class="info"><div class="nm"><i class="dotw"></i>' + rec.white + ' <em>against</em> <i class="dotb"></i>' + rec.black + '</div>' +
        '<div class="ds">' + Math.ceil(rec.plies / 2) + ' moves, ' + why + ', ' + when + '</div>' + (chips ? '<div class="chips">' + chips + '</div>' : '') + '</div>');
      const del = h('button', 'del', '&times;');
      del.title = 'Delete this game';
      del.onclick = (e) => {
        e.stopPropagation();
        archive = archive.filter((r) => r.id !== rec.id);
        if (G && G.archiveId === rec.id) G.archiveId = null;
        saveArchive();
        renderArchive();
      };
      row.appendChild(del);
      row.onclick = () => openArchived(rec.id);
      box.appendChild(row);
    });
    $('#archExport').onclick = exportArchive;
    $('#archImport').onclick = () => $('#pgnFile').click();
    $('#archClear').onclick = () => {
      if (!confirm('Delete all ' + archive.length + ' archived games?')) return;
      archive = [];
      if (G) G.archiveId = null;
      saveArchive();
      renderArchive();
    };
  }

  function kick() {
    if (!G || G.over) return;
    const game = G, s = live();
    refreshDelta();
    // two people, one screen: turn the board to whoever is to move, once the piece has landed. In Dice Chess that is
    // right after the last move of a turn (the next player then throws), not after the throw
    if (G.local && G.spec.flipEach && ui.flipped !== (s.turn === 'b')) {
      setTimeout(() => {
        if (game !== G || live() !== s || G.over) return;
        ui.flipped = s.turn === 'b'; buildSquares(); closeOverlay(); renderAll();
      }, settings.anim ? 240 : 0);
    }
    if (G.B.unrolled && G.B.unrolled(s)) {
      // Dice Chess, a new turn: a bot throws at once, a player presses the button (the bar meanwhile shows the average throw)
      const botTurn = G.auto || (!G.local && s.turn !== G.cfg.side);
      if (botTurn) { setTimeout(() => { if (game === G && live() === s && !G.over) rollDice(); }, G.auto ? 250 : 350); if (G.auto && brainGame(G.B, G.cfg)) analyse(); }
      else analyse();
      return;
    }
    if (G.auto) {
      engineTurn();
      if (brainGame(G.B, G.cfg)) analyse(); // the bar of a bot match: the power-up search's own look at every position
      return;
    }
    if (G.local) { analyse(); return; } // the board has turned above
    if (s.turn !== G.cfg.side) {
      if (G.puppetArmed && G.puppetLeft > 0) {
        // Puppet Master: the player makes this move for the engine.
        G.puppetArmed = false; G.puppetLeft--; G.puppetNow = true;
        ui.premoves = [];
        renderAll();
        return;
      }
      engineTurn();
      return;
    }
    if (ui.premoves.length) {
      // Let the engine's move land on screen first, then play the premove.
      setTimeout(() => {
        if (game !== G || live() !== s || G.over) return;
        if (!runPremove()) analyse();
      }, 160);
      return;
    }
    analyse();
  }

  /* Premoves wait in a queue. With multi-premoves off the queue holds one move. The first one is played
     when the turn comes. If it is not possible any more, the whole queue is dropped: the later
     ones were planned on top of it. */
  function pmAdd(from, to) {
    if (!settings.multiPremove) ui.premoves = [];
    if (ui.premoves.length < 16) ui.premoves.push({ from: from, to: to });
  }
  // The board as it would look once the queued premoves have been played, so the next one can be set from there.
  function pmBoard(s) {
    const b = s.board.slice();
    ui.premoves.forEach((pm) => { b[pm.to] = b[pm.from]; b[pm.from] = ''; });
    return b;
  }
  function runPremove() {
    const pm = ui.premoves.shift();
    if (!pm) return false;
    const cands = G.legal.filter((m) => !m.drop && !m.swap && m.from === pm.from && m.to === pm.to);
    if (!cands.length) { ui.premoves = []; renderAll(); return false; }
    applyMove(cands.find((c) => c.promo === 'q') || cands.find((c) => !c.snipe && !c.promo) || cands[0]);
    return true;
  }

  function pushState(n, entry) {
    // watching a bot match: the piece looked at stays looked at, its squares worked out again for the new position
    const watch = G.auto && ui.peek ? peekFollow(ui.peek.sq, entry, n) : -1;
    ui.peek = null;
    if (G.local && G.db) G.dbReveal = null; // both drawbacks hidden again until the next player has the device
    G.states.push(n);
    G.log.push(entry);
    G.view = G.states.length - 1;
    G.legal = G.B.legal(n);
    G.analysis = null;
    modeProgress();
    saveLive();
    if (watch >= 0) { ui.peek = peekOf(watch, n, G.cfg); ui.info = watch; } else if (G.auto && ui.info != null && !n.board[ui.info]) ui.info = null;
  }
  // Where the piece on sq stands after this move (it moved, castled, swapped, went through a portal), or -1 when it is gone.
  function peekFollow(sq, entry, n) {
    const m = entry.m;
    let to = sq;
    if (entry.removed && entry.removed.some((x) => x.sq === sq) && !(m && m.from === sq && !m.snipe && !m.blast)) return -1; // taken
    if (m && !m.snipe && !m.stay && !m.blast && !m.shot && !m.reload && !(n.fx && n.fx.bounce >= 0)) {
      if (m.swap) to = sq === m.from ? m.to : sq === m.to ? m.from : sq;
      else if (m.from === sq) to = entry.tp >= 0 ? entry.tp : m.to;
      else if (m.castle === 'K' && sq === m.to + 1) to = m.to - 1;
      else if (m.castle === 'Q' && sq === m.to - 2) to = m.to + 1;
    }
    return n.board[to] ? to : -1;
  }

  // Is the game over? If not, whoever is to move gets going. fresh = the start position, not counted twice.
  function afterAction(fresh) {
    const s = live();
    let st = G.B.status(s, G.legal);
    const last = G.log[G.log.length - 1];
    if (!st.over && !fresh && !(last && last.roll)) { // Dice Chess: a throw that changes nothing on the board is no repetition
      const k = G.B.key(s);
      G.keys[k] = (G.keys[k] || 0) + 1;
      if (G.keys[k] >= 3) st = { over: true, result: 'draw', reason: 'repetition' };
    }
    if (st.over) { finish(st); return; }
    if (ouRelics()) return;
    kick();
  }

  // Shared bookkeeping around a move. keep = square the player had selected while waiting.
  function beforeMove(by) {
    const keep = !G.local && by !== G.cfg.side && ui.sel && ui.sel.sq >= 0 ? ui.sel.sq : -1;
    ui.sel = null; ui.mode = null; ui.hintArrow = null; ui.hintWanted = false; ui.arrows = []; ui.marks = [];
    return keep;
  }
  function afterMove(keep, n) {
    if (keep < 0 || n.turn !== G.cfg.side) return;
    const p = n.board[keep];
    if (p && R.colorOf(p) === G.cfg.side) select(keep);
  }

  /* ---------- The Ouroboros King in a battle: items and relics ----------
     The run's items are actions here: Shackles and the Sphere of protection work like Freeze Ray and Shield, the
     Rocking chair like a pass, Power up and Downgrade change a piece for the rest of the battle; Rewinds take back a
     move. How many are used is kept with the game (G.ouUsed, also in MS.pending) and taken off when it is settled. */
  const runGame = () => !!(G && G.spec && G.spec.gameMode && G.spec.gameMode.kind === 'run' && ouroRun() && ouroRun().battle);
  const ouUsed = () => (G && G.ouUsed) || (MS.pending && MS.pending.used) || {};
  const itemsLeft = (id) => { const run = ouroRun(); return run ? Math.max(0, (run.items[id] || 0) - (ouUsed()[id] || 0)) : 0; };
  function useItem(id) {
    if (!G.ouUsed) G.ouUsed = (MS.pending && MS.pending.used) || {};
    G.ouUsed[id] = (G.ouUsed[id] || 0) + 1;
    if (MS.pending) { MS.pending.used = G.ouUsed; saveModes(); }
  }
  const ouroMoves = () => G.log.filter((e) => e.m).length;
  // what the battle brought: the moves (the gold drops with each), what was taken by whom, what was lost
  function ouroInfo() {
    const me = G.cfg.side, kills = [], lost = [];
    G.log.forEach((e) => {
      if (e.m && e.m.cap) { if (e.by === me) kills.push([e.m.piece, e.m.cap]); else lost.push(e.m.cap); }
      (e.removed || []).forEach((r) => { if (r && r.p && R.colorOf(r.p) === me) lost.push(r.p); });
      if (e.spike != null && e.spiked) kills.push(['', e.spiked]);
    });
    return { moves: ouroMoves(), kills: kills, lost: lost, used: ouUsed() };
  }
  // a piece changed by an item or a relic; pass: the change uses the turn (Downgrade)
  function ouEdit(B, s, sq, to, pass) {
    let n = Object.assign({}, s, { board: s.board.slice() });
    n.board[sq] = to;
    n.fairy = R.hasFairy(n.board);
    if (pass) n = B.play(n, { from: -1, to: -1, piece: '', cap: '', capSq: -1, pass: true });
    n.fx = null;
    return n;
  }
  function ouTargets(mode, s) {
    const me = G.cfg.side, out = [];
    s.board.forEach((p, q) => {
      if (!p || s.gold.indexOf(q) >= 0) return;
      if (mode === 'powerup' && R.colorOf(p) === me && Ouro.upgradeOf(p)) out.push(q);
      if (mode === 'downgrade' && R.colorOf(p) !== me && Ouro.downgradeOf(p)) out.push(q);
    });
    return out;
  }
  function doOuItem(mode, sq) {
    const s = live(), p = s.board[sq];
    if (!runGame() || !itemsLeft(mode) || ouTargets(mode, s).indexOf(sq) < 0) return;
    const to = mode === 'powerup' ? Ouro.upgradeOf(p) : Ouro.downgradeOf(p), n = ouEdit(G.B, s, sq, to, mode === 'downgrade');
    const e = { by: s.turn, to: to, san: (mode === 'powerup' ? '\u21e7' : '\u21e9') + sqLabel(sq), removed: [] };
    e[mode] = sq;
    pushState(n, e);
    useItem(mode);
    ui.sel = null; ui.mode = null;
    renderAll();
    fxRing(sq, mode === 'powerup' ? 'glint' : 'blue');
    snd('gold');
    afterAction();
  }
  const OU_SAN = { knife: '\u2020', bottle_b: 'B!', bottle_n: 'N!', bottle_r: 'R!', boomerang: '\u21ba', glider: '\u21e1', boulder: '\u25aa', hammer: '\u2692', snow: '\u2744\ufe0e', rock: '\u2739', teleporter: '\u21c4' };
  // where an item can be used: an empty square for a boulder or a bomb, a boulder for the Hammer, a bomb for the Snow bottle, your units for the Teleporter
  function ouRuleTargets(id, s) {
    const out = [], me = G.cfg.side, por = (G.cfg.terrain && G.cfg.terrain.portals) || [];
    for (let q = 0; q < s.board.length; q++) {
      const p = s.board[q];
      if ((id === 'boulder' || id === 'rock') && !p && !R.isWall(G.cfg, q, s) && por.indexOf(q) < 0) out.push(q);
      else if (id === 'hammer' && R.isRock(G.cfg, q, s)) out.push(q);
      else if (id === 'snow' && R.bombAt(s, q)) out.push(q);
      else if (id === 'teleporter' && p && R.colorOf(p) === me && s.gold.indexOf(q) < 0 && q !== ui.ouA) out.push(q);
    }
    return out;
  }
  function doOuRule(id, a, b) {
    const s = live();
    if (!runGame() || !itemsLeft(id)) return;
    const n = R.ouItem(s, G.cfg, id, a, b);
    if (!n) { toast('That cannot be done there'); return; }
    pushState(n, { by: s.turn, ouItem: id, a: a, b: b, san: OU_SAN[id] + (a >= 0 ? sqLabel(a) : '') + (b >= 0 ? sqLabel(b) : ''), removed: [] });
    useItem(id);
    ui.sel = null; ui.mode = null; ui.ouA = -1;
    renderAll();
    if (a >= 0) fxRing(a, id === 'rock' ? 'boom' : 'blue');
    snd(id === 'rock' || id === 'hammer' ? 'capture' : 'gold');
    afterAction();
  }
  function doRewind() {
    const run = ouroRun(), j = undoTarget();
    if (!runGame() || j < 0 || !run || run.rewinds <= 0) return;
    Ouro.useRewind(run);
    saveModes();
    undoTo(j);
    toast(run.rewinds + (run.rewinds === 1 ? ' Rewind' : ' Rewinds') + ' left');
  }
  function ouSmoke() {
    if (!runGame() || !itemsLeft('smoke') || ouroRun().battle.boss) return;
    if (!confirm('Use the Smoke bomb? The battle ends at once, with no reward.')) return;
    useItem('smoke');
    finish({ over: true, result: 'draw', reason: 'smoke' });
  }
  function ouHourglass() {
    if (!runGame() || !itemsLeft('hourglass')) return;
    if (!confirm('Turn the Sand hourglass? The battle starts again, the positions and the terrain may differ.')) return;
    useItem('hourglass');
    finish({ over: true, result: 'draw', reason: 'hourglass' }, true);
    setTimeout(() => startMode('run'), 60);
  }
  /* The relics that act in a battle, at the start of the player's turn: The Finisher (the enemy General alone: won),
     the Bodyguard horn (the King alone: a Queen joins him, once), the Spiked shield (the first unit of yours taken by
     anything but a king: the taker is destroyed, once), the Alarm bell (the King in danger: a warning). True when the
     battle ended. */
  function ouRelics() {
    const run = ouroRun(), s = live(), me = G.cfg.side;
    if (!runGame() || s.turn !== me || G.over) return false;
    const has = (id) => Ouro.has(run, id), mine = [], theirs = [];
    s.board.forEach((p, q) => { if (p) (R.colorOf(p) === me ? mine : theirs).push(q); });
    if (has('finisher') && theirs.length && theirs.every((q) => R.isRoyal(s.board[q])) && mine.some((q) => !R.isRoyal(s.board[q]))) {
      finish({ over: true, result: me, reason: 'finisher' });
      return true;
    }
    const last = G.log[G.log.length - 1];
    if (has('spiked') && !G.log.some((e) => e.spike != null) && last && last.by !== me && last.m && last.m.cap && R.colorOf(last.m.cap) === me && !R.isRoyal(last.m.piece)) {
      const at = s.board[last.m.to] === last.m.piece ? last.m.to : s.board[last.m.from] === last.m.piece ? last.m.from : -1;
      if (at >= 0) {
        const taken = s.board[at];
        pushState(ouEdit(G.B, s, at, '', false), { by: me, spike: at, spiked: taken, san: '\u2736' + sqLabel(at), removed: [{ sq: at, p: taken }] });
        fxRing(at, 'boom'); snd('capture');
        toast('Spiked shield: the ' + Ouro.title(taken).toLowerCase() + ' that took your unit is destroyed');
        return ouRelics();
      }
    }
    if (has('horn') && !G.log.some((e) => e.horn != null) && mine.length === 1 && R.isRoyal(s.board[mine[0]])) {
      const k = mine[0], r0 = Math.floor(k / 8), f0 = k % 8, cand = [];
      [[-1, 0], [-1, -1], [-1, 1], [0, -1], [0, 1], [1, 0], [1, -1], [1, 1]].forEach((d) => { const r = r0 + d[0], f = f0 + d[1]; if (r >= 0 && r < 8 && f >= 0 && f < 8 && !s.board[r * 8 + f] && !R.isWall(G.cfg, r * 8 + f, s)) cand.push(r * 8 + f); });
      if (cand.length) {
        pushState(ouEdit(G.B, s, cand[0], me === 'w' ? 'Q' : 'q', false), { by: me, horn: cand[0], san: '+Q' + sqLabel(cand[0]), removed: [] });
        fxRing(cand[0], 'glint'); snd('gold');
        toast('Bodyguard horn: a Queen comes to your King\'s side');
      }
    }
    if (has('bell')) {
      const ks = s.board.findIndex((p) => p && R.colorOf(p) === me && R.isRoyal(p));
      const key = G.log.length;
      // a King a Prince guards cannot be taken: no alarm then (his square is still marked as under attack, see renderBoard)
      if (ks >= 0 && R.attacked(s, ks, R.other(me), G.cfg) && !R.guarded(s, ks, me) && G.bellAt !== key) { G.bellAt = key; toast('Alarm bell: your King is in danger!'); snd('check'); }
    }
    return false;
  }

  /* The king guard, under king capture: a player who leaves the king to be taken while a safe move exists gets
     the move back, three times a game. The piece slides there and back, and for the rest of the turn every
     square the other side attacks is tinted, with arrows from the pieces that would have taken the king. */
  const GUARDS = 3;
  function kingGuard(s, m) {
    const by = s.turn, cfg = G.cfg;
    if (!cfg.kingCapture || G.B.kind !== 'std' || G.auto || (!G.local && by !== cfg.side) || G.puppetNow) return false;
    const angel = runGame(); // in a run it is the Guardian angel: 3 Rewinds each time, as long as they last
    if (angel && (!Ouro.has(ouroRun(), 'angel') || ouroRun().rewinds < 3)) return false;
    if (G.guardLeft == null) G.guardLeft = GUARDS;
    if (!angel && G.guardLeft <= 0) return false;
    let n;
    try { n = G.B.play(s, m); } catch (e) { return false; }
    if (n.lost || n.turn === by || !R.checkedSquares(n, by, cfg).length) return false;
    const safe = G.legal.some((m2) => {
      if (m2 === m) return false;
      if (m2.cap && R.isRoyal(m2.cap)) return true;
      try { const n2 = G.B.play(s, m2); return n2.turn === by || !R.checkedSquares(n2, by, cfg).length; } catch (e) { return false; }
    });
    if (!safe) return false;
    if (angel) { ouroRun().rewinds -= 3; saveModes(); } else G.guardLeft--;
    const foe = R.other(by), squares = [], arrows = [];
    for (let q = 0; q < s.board.length; q++) if (!R.isWall(cfg, q, s) && R.attacked(s, q, foe, cfg)) squares.push(q);
    try { R.pseudoMoves(n, cfg, true).forEach((x) => { if (x.cap && R.isRoyal(x.cap) && R.colorOf(x.cap) === by) arrows.push({ from: x.from, to: x.capSq != null && x.capSq >= 0 ? x.capSq : x.to, color: '#e04040' }); }); } catch (e) { /* the tint alone */ }
    ui.threat = { state: s, squares: squares, arrows: arrows };
    ui.sel = null; ui.drag = null;
    renderAll();
    const el = L.pieces.querySelector('[data-sq="' + m.from + '"]');
    if (el && settings.anim && m.from >= 0) el.animate([{ transform: trans(m.from) }, { transform: trans(m.to), offset: 0.45 }, { transform: trans(m.from) }], { duration: 650, easing: 'ease-in-out' });
    snd('wrong');
    toast(angel ? 'Guardian angel: your King would be taken there, so the move is taken back for 3 Rewinds (' + ouroRun().rewinds + ' left). The enemy\'s attacks are shown for this turn.'
      : 'Your king would be taken there, so the move is taken back. The other side\'s attacks are shown for this turn. ' + (G.guardLeft ? G.guardLeft + ' of ' + GUARDS + ' take-backs left this game.' : 'That was the last take-back of this game.'));
    return true;
  }
  // a Shotgun King's shot: the pellets fly, the hit pieces show their damage, the ones it killed break apart
  function shotFx(before, after, fx) {
    if (!fx.shot) return;
    skPellets(fx.shot.from, fx.shot.paths || []);
    Object.keys(fx.shot.hits || {}).forEach((q) => { const sq = +q, p = before.board[sq]; if (p && R.colorOf(p) !== R.colorOf(before.board[fx.shot.from])) skDamage(sq, fx.shot.hits[q], 'shot'); });
    (fx.removed || []).forEach((r) => skShatter(r.sq, pieceSrc(r.p), false));
  }
  function applyMove(m) {
    if (m.pass && runGame()) { if (!itemsLeft('chair')) return; useItem('chair'); } // the Rocking chair
    if (kingGuard(live(), m)) return;
    const s = live(), by = s.turn, puppet = G.puppetNow && by !== G.cfg.side;
    if (by !== G.cfg.side) G.puppetNow = false;
    const n = G.B.play(s, m), fx = n.fx;
    const san = G.B.san(s, m, G.legal, n);
    if (G.clock.on && n.turn !== by) G.clock[by] += G.clock.inc;
    G.clock.last = performance.now();
    const keep = beforeMove(by);
    pushState(n, { by: by, m: m, san: san, removed: fx.removed, tp: fx.tp, puppet: puppet });
    afterMove(keep, n);
    renderAll(moveAnims(s, m, fx));
    if (m.shot) shotFx(s, n, fx);
    if (!m.reload && n.sg && s.sg && n.sg[by] && s.sg[by] && n.sg[by][0] > s.sg[by][0]) snd('shell', 0.12); // a step put a shell in
    if (m.snipe) fxTracer(m.from, m.to);
    if (fx.boom) fx.booms.forEach((sq) => fxRing(sq, 'boom'));
    if (fx.bounce >= 0) fxRing(fx.bounce, 'orange');
    if (fx.tp >= 0) { fxRing(m.to, 'blue'); fxRing(fx.tp, 'orange'); }
    moveSound(m, fx, G.B.checks(n).length > 0 && !G.B.status(n, G.legal).over);
    afterAction();
  }

  function doGild(sq) {
    const s = live(), n = G.B.gild(s, sq);
    if (!n) return;
    n.fx = null;
    if (n.turn !== s.turn) { if (G.clock.on) G.clock[s.turn] += G.clock.inc; G.clock.last = performance.now(); } // Midas that uses the turn ends it
    pushState(n, { by: s.turn, gild: sq, san: '✦' + sqLabel(sq), removed: [] });
    ui.sel = null; ui.mode = null; ui.hintArrow = null;
    renderAll();
    fxRing(sq, 'glint');
    snd('gold');
    afterAction();
  }
  // The battle's row of the run: the gold it still pays, the Rewinds, and a button for each item the run holds
  function ouroBar(bar, s, act) {
    const run = ouroRun(), b = run.battle, left = Ouro.rewardAfter(b, ouroMoves());
    bar.appendChild(h('div', 'prow ou-reward', '<b>Reward</b><span>' + num(left) + ' gold, 4 less a move' + (Ouro.has(run, 'bounty') ? ' (doubled)' : '') + '</span>'));
    const btn = (label, on, enabled, click, text) => {
      const row = h('div', 'prow'), x = h('button', 'btn' + (on ? ' on' : ''), label);
      x.disabled = !enabled; x.onclick = click; x.title = text;
      row.appendChild(x); row.appendChild(h('span', '', text)); bar.appendChild(row);
    };
    btn('Rewind (' + run.rewinds + ')', false, act && run.rewinds > 0 && undoTarget() >= 0, doRewind, 'Take back your last move and the answer to it');
    // item: the run's item, m: the board's mode for it (Shackles freeze, the Sphere shields)
    const mode = (item, m, label, ready, text) => { if (!itemsLeft(item)) return; btn(ui.mode === m ? 'Cancel' : label + ' (' + itemsLeft(item) + ')', ui.mode === m, ready || ui.mode === m, () => { ui.mode = ui.mode === m ? null : m; ui.sel = null; renderAll(); }, text); };
    mode('shackles', 'freeze', 'Shackles', act && !s.freezeUsed && G.B.freezeTargets(s).length > 0, Ouro.ITEMS.shackles.text);
    mode('sphere', 'shield', 'Sphere', act && !s.shieldUsed && G.B.shieldTargets(s).length > 0, Ouro.ITEMS.sphere.text);
    mode('powerup', 'powerup', 'Power up', act && ouTargets('powerup', s).length > 0, Ouro.ITEMS.powerup.text);
    mode('downgrade', 'downgrade', 'Downgrade', act && ouTargets('downgrade', s).length > 0, Ouro.ITEMS.downgrade.text);
    // the items the rules carry out (R.ouItem): some at once, some on a square
    const now = (id, label, on, ready) => { if (itemsLeft(id)) btn(label + (on ? ' (on)' : ' (' + itemsLeft(id) + ')'), on, act && ready && !on, () => doOuRule(id, -1, -1), Ouro.ITEMS[id].text); };
    now('knife', 'Backstabbing knife', !!s.knife, true);
    now('bottle_b', 'Bishop in a bottle', s.bottle === 'b', !s.bottle);
    now('bottle_n', 'Knight in a bottle', s.bottle === 'n', !s.bottle);
    now('bottle_r', 'Rook in a bottle', s.bottle === 'r', !s.bottle);
    now('boomerang', 'Boomerang', !!s.boomer, true);
    now('glider', 'Hang glider', !!s.glide, true);
    [['boulder', 'Pocket boulder'], ['hammer', 'Hammer'], ['rock', 'Exploding rock'], ['snow', 'Snow bottle'], ['teleporter', 'Teleporter']].forEach((x) => mode(x[0], 'ou:' + x[0], x[1], act && ouRuleTargets(x[0], s).length > (x[0] === 'teleporter' ? 1 : 0), Ouro.ITEMS[x[0]].text));
    if (itemsLeft('chair')) { const pass = act ? G.legal.find((x) => x.pass) : null; btn('Rocking chair (' + itemsLeft('chair') + ')', false, !!pass, () => { if (pass) applyMove(pass); }, Ouro.ITEMS.chair.text); }
    if (itemsLeft('smoke')) btn('Smoke bomb (' + itemsLeft('smoke') + ')', false, act && !b.boss, ouSmoke, b.boss ? 'Not against a witch' : Ouro.ITEMS.smoke.text);
    if (itemsLeft('hourglass')) btn('Sand hourglass (' + itemsLeft('hourglass') + ')', false, act, ouHourglass, Ouro.ITEMS.hourglass.text);
  }
  function doShield(sq) {
    if (runGame() && !itemsLeft('sphere')) return; // the Sphere of protection
    const s = live(), n = G.B.shield(s, sq);
    if (!n) return;
    if (runGame()) useItem('sphere');
    n.fx = null;
    pushState(n, { by: s.turn, shield: sq, san: '\u26e8' + sqLabel(sq), removed: [] });
    ui.sel = null; ui.mode = null; ui.hintArrow = null;
    renderAll();
    fxRing(sq, 'blue');
    snd('ice');
    afterAction();
  }
  function doFreeze(sq) {
    if (runGame() && !itemsLeft('shackles')) return; // Shackles
    const s = live(), n = G.B.freeze(s, sq);
    if (!n) return;
    if (runGame()) useItem('shackles');
    n.fx = null;
    pushState(n, { by: s.turn, freeze: sq, san: '❄' + sqLabel(sq), removed: [] });
    ui.sel = null; ui.mode = null; ui.hintArrow = null;
    renderAll();
    fxRing(sq, 'frost');
    snd('ice');
    afterAction();
  }

  function doTimeStop() {
    const s = live(), n = G.B.timeStop(s);
    if (!n) return;
    n.fx = null;
    pushState(n, { by: s.turn, stop: true, san: '\u29d6', removed: [] });
    ui.sel = null; ui.mode = null; ui.hintArrow = null;
    renderAll();
    snd('ice');
    afterAction();
  }

  function doConvert(sq) {
    const s = live(), n = G.B.convert(s, sq);
    if (!n) return;
    n.fx = null;
    pushState(n, { by: s.turn, convert: sq, san: '\u21c4' + sqLabel(sq), removed: [] });
    ui.sel = null; ui.mode = null; ui.hintArrow = null;
    renderAll();
    fxRing(sq, 'blue');
    snd('portal');
    afterAction();
  }

  // Veto: the engine's last move is taken back and it may not play it again.
  function vetoReady() {
    if (!canAct() || !G.cfg.veto || G.vetoLeft < 1 || G.states.length < 2) return false;
    const e = G.log[G.log.length - 1];
    return !!e.m && e.by !== G.cfg.side && !e.puppet;
  }
  function doVeto() {
    if (!vetoReady()) return;
    const j = G.states.length - 2, e = G.log[j], lg = G.B.legal(G.states[j]);
    const banned = G.banned[j] = G.banned[j] || [];
    if (lg.filter((m) => banned.indexOf(moveKey(m)) < 0).length < 2) { toast('The engine has no other move, the veto is kept'); return; }
    banned.push(moveKey(e.m));
    G.vetoLeft--;
    stopEngines();
    G.states.length = j + 1;
    G.log.length = j;
    G.view = j;
    G.legal = lg;
    G.analysis = null;
    G.keys = {};
    G.states.forEach((st) => { const k = G.B.key(st); G.keys[k] = (G.keys[k] || 0) + 1; });
    ui.thinking = false; ui.sel = null; ui.mode = null; ui.hintArrow = null; ui.premoves = [];
    toast('Vetoed ' + e.san);
    saveLive();
    renderAll();
    kick();
  }

  function setPortals(a, b) {
    const n = G.B.withPortals(live(), a, b);
    G.states[G.states.length - 1] = n;
    G.legal = G.B.legal(n);
    G.analysis = null;
    ui.mode = null; ui.draft = [];
    renderAll();
    fxRing(a, 'blue'); fxRing(b, 'orange');
    snd('portal');
    const st = G.B.status(n, G.legal);
    if (st.over) finish(st); else analyse();
  }

  function finish(st, quiet) { // quiet: given up for a new game, no sound
    G.over = st;
    G.endOpen = true;
    saveLive(); // over: nothing to come back to
    stopEngines();
    ui.thinking = false; ui.sel = null; ui.mode = null; ui.hintArrow = null; ui.premoves = [];
    closeOverlay();
    setZoom(1); // the end card sits on the board: the whole board in view
    const side = G.cfg.side, res = st.result === 'draw' ? 'd' : (st.result === side ? 'w' : 'l');
    let ratingNote = '';
    if (!G.counted && !G.auto && !G.local) {
      const rec = stats[G.statKey] = stats[G.statKey] || { w: 0, l: 0, d: 0 };
      rec[res]++;
      ratingNote = rateGame(G, res);
      save();
    }
    G.counted = true;
    if (G.spec && G.spec.daily && !daily[G.spec.daily] && !G.auto && !G.local) { daily[G.spec.daily] = { r: res, n: Math.ceil(G.log.filter((x) => x.m).length / 2) }; saveDaily(); }
    if (st.result && st.result !== 'draw') ui.eval = { cp: null, mate: 0, depth: 0, lost: R.other(st.result) }; // a king capture or an explosion ends it as surely as a mate
    const modeLine = settleMode(res); // a bet or a run stage is settled here, once
    const txt = resultText(st), rec = stats[G.statKey] || { w: 0, l: 0, d: 0 };
    $('#endcard').classList.toggle('win', !G.auto && !G.local && res === 'w');
    $('#endTitle').textContent = txt.title;
    $('#endSub').textContent = txt.sub;
    $('#endTally').textContent = G.auto ? nameOf(G, 'w') + ' (White) against ' + nameOf(G, 'b') + ' (Black)'
      : G.local ? 'Two players at one board, ' + G.log.filter((e) => e.m).length + ' half-moves'
      : modeLine || 'Your record against ' + G.botName + ': ' + rec.w + ' won, ' + rec.d + ' drawn, ' + rec.l + ' lost' + ratingNote;
    endButtons();
    if (!quiet) snd(G.auto || G.local ? 'draw' : res === 'w' ? 'win' : res === 'l' ? 'lose' : 'draw');
    archiveGame();
    renderAll();
    renderSetup();
  }

  /* ---------- talking to the engines ---------- */

  function strength(bot, E, fairy) {
    if (bot.max) return { MultiPV: 1, UCI_LimitStrength: 'false', 'Skill Level': 20 };
    if (bot.uciElo) return { MultiPV: 1, 'Skill Level': 20, UCI_LimitStrength: 'true', UCI_Elo: Math.max(E.limits.eloMin, Math.min(E.limits.eloMax, bot.uciElo)) };
    return { MultiPV: 1, UCI_LimitStrength: 'false', 'Skill Level': fairy ? bot.fskill : bot.skill };
  }
  const FULL = { MultiPV: 1, UCI_LimitStrength: 'false', 'Skill Level': 20 };
  // Fairy-Stockfish has to be told which game it is playing, Stockfish 19 only knows one.
  /* ---------- bots that know the power-ups ---------- */

  /* Two copies of the power-up search: one plays for the bots, one feeds the eval bar and
     the hints, so a hint never delays a bot move. Each runs in its own worker.
     Where the browser allows shared memory, the hash table of a brain lives there and a few helper
     workers search the same position alongside. They share nothing but that table, so what one of
     them has worked out the others can look up. Only the main worker's answer counts. The table
     also outlives a stopped search, which a worker's own table did not. */
  const CORES = navigator.hardwareConcurrency || 4;
  const CAN_SHARE = typeof SharedArrayBuffer !== 'undefined' && !!self.crossOriginIsolated;
  function makeBrain(helpers) {
    let w = null, seq = 0, busy = 0, table = null, ctl = null;
    const wait = {}, aides = [];
    if (!CAN_SHARE) helpers = 0;
    function boot() {
      if (CAN_SHARE && !table) {
        const n = 1 << 20, buf = (bytes) => new SharedArrayBuffer(n * bytes);
        table = { lock: buf(4), score: buf(4), move: buf(4), info: buf(2), ctl: new SharedArrayBuffer(8) };
        ctl = new Int32Array(table.ctl);
      }
      w = new Worker('js/brainworker.js');
      if (table) w.postMessage({ table: table });
      w.onmessage = (e) => {
        const cb = wait[e.data.id];
        if (!cb) return;
        delete wait[e.data.id]; busy--;
        if (ctl && busy < 1) Atomics.add(ctl, 0, 1); // the answer is in: call the helpers off
        cb(e.data.result);
      };
      w.onerror = (e) => { console.error('The power-up search failed', e.message); };
    }
    return {
      think(state, cfg, opts) {
        if (!w) boot();
        return new Promise((resolve) => {
          const id = ++seq, st = Object.assign({}, state, { fx: null });
          wait[id] = resolve;
          busy++;
          w.postMessage({ id: id, state: st, cfg: cfg, opts: opts });
          // helpers only for a search without a depth limit: a bot held to a few moves of depth must not borrow deeper results
          if (helpers && busy === 1 && (!opts.maxDepth || opts.maxDepth >= 64)) {
            const gen = Atomics.add(ctl, 0, 1) + 1;
            while (aides.length < helpers) { const a = new Worker('js/brainworker.js'); a.postMessage({ table: table }); aides.push(a); }
            aides.forEach((a, k) => a.postMessage({ id: 0, state: st, cfg: cfg, opts: Object.assign({}, opts, { helper: k + 1, gen: gen, maxDepth: 64 }) }));
          }
        });
      },
      // A search cannot be interrupted, so a running one is dropped together with its worker. The helpers stop by themselves.
      stop() {
        if (!w || busy < 1) return;
        w.terminate();
        w = null;
        busy = 0;
        if (ctl) Atomics.add(ctl, 0, 1);
        Object.keys(wait).forEach((k) => { const cb = wait[k]; delete wait[k]; cb(null); });
      },
      // A new game starts with an empty table.
      fresh() { if (table) { Atomics.add(ctl, 0, 1); new Int32Array(table.lock).fill(0); } else if (w && busy < 1) { w.terminate(); w = null; } },
      get busy() { return busy > 0; },
      helpers: helpers
    };
  }
  const botBrain = makeBrain(CORES >= 10 ? 3 : CORES >= 8 ? 2 : CORES >= 6 ? 1 : 0), evalBrain = makeBrain(CORES >= 10 ? 2 : CORES >= 6 ? 1 : 0);
  /* The variants have a search of their own (js/fairybrain.js): a module worker with the variant rules inside. */
  const makeFairyBrain = () => {
    let w = null, seq = 0, busy = 0;
    const wait = {};
    return {
      think(game, state, opts) {
        if (!w) {
          w = new Worker('js/fairybrain.js', { type: 'module' });
          w.onmessage = (e) => {
            const cb = wait[e.data.id];
            if (cb) { delete wait[e.data.id]; busy--; cb(e.data.result); }
          };
          w.onerror = (e) => { console.error('The variant power-up search failed', e.message); };
        }
        return new Promise((resolve) => {
          const id = ++seq;
          wait[id] = resolve;
          busy++;
          w.postMessage({ id: id, game: game, state: Object.assign({}, state, { fx: null }), opts: opts });
        });
      },
      stop() {
        if (!w || busy < 1) return;
        w.terminate();
        w = null;
        busy = 0;
        Object.keys(wait).forEach((k) => { const cb = wait[k]; delete wait[k]; cb(null); });
      }
    };
  };
  const fairyBrain = makeFairyBrain(), evalFairy = makeFairyBrain(); // one plays, one feeds the eval bar

  /* What the power-ups change about a variant position, in centipawns from White's point of view.
     Fairy-Stockfish judges the position as if there were none. The variant search looks at it twice
     to the same depth, once with the real power-ups, statues and ice, once without all of them. The
     difference is added to the engine's verdict. Resolves with { cp, mate } or null. */
  async function powerDelta(game, s, ms, depth) {
    if (!game.bo || !game.B.powers) return null;
    const sign = s.turn === 'w' ? 1 : -1, base = [game.bo.uci, game.bo.startFen];
    const full = Object.assign({ cfg: { side: game.cfg.side, pw: game.cfg.pw }, sig: JSON.stringify(base.concat([game.cfg.pw])) }, game.bo);
    const none = Object.assign({ cfg: { side: game.cfg.side, pw: { w: null, b: null } }, sig: JSON.stringify(base.concat(['blind'])) }, game.bo);
    const a = await evalFairy.think(full, s, { ms: ms, maxDepth: depth || 6, margin: 0, free: true });
    if (!a || a.error || !a.actions || !a.actions.length) return null;
    if (a.score > 90000 || a.score < -90000) {
      const n = Math.max(1, Math.ceil((100000 - Math.abs(a.score)) / 2));
      return { cp: 0, mate: (a.score > 0 ? n : -n) * sign, best: a.actions[0].key };
    }
    const blindState = Object.assign({}, s, { gold: [], ice: [], frozen: -1, pocket: [], pocket2: [], movesLeft: 0, fx: null });
    const b = await evalFairy.think(none, blindState, { ms: ms * 2, maxDepth: Math.max(1, a.depth), margin: 0, free: false });
    if (!b || b.error || !b.actions || !b.actions.length || Math.abs(b.score) > 90000) return null;
    return { cp: (a.score - b.score) * sign, mate: null, best: a.actions[0].key }; // best = what the power-up search would do here
  }
  // Keep the correction for the position on the board up to date.
  function refreshDelta() {
    const game = G, s = live();
    if (!game || !game.variantGame || !game.B.powers || !settings.evalBar || game.over) return;
    if (game.pd && game.pd.state === s) return;
    evalFairy.stop();
    powerDelta(game, s, 350).then((d) => {
      if (!d || game !== G || live() !== s) return;
      game.pd = { state: s, cp: d.cp, mate: d.mate };
      renderEval();
    });
  }
  function stopBrain() { botBrain.stop(); evalBrain.stop(); fairyBrain.stop(); evalFairy.stop(); }

  /* The endgame tables (js/tablebase.js) in a worker of their own: king and queen, rook or pawn against
     a bare king. They are worked out on first use, which takes a few seconds, so the first answer may
     wait. Resolves with { wdl, dtm } from the side to move, or null when the position is not covered. */
  let tbWorker = null, tbSeq = 0;
  const tbWait = {};
  function probeTablebase(fen) {
    const parts = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '');
    if (parts.length !== 3 || !/[QRPqrp]/.test(parts)) return Promise.resolve(null);
    if (!tbWorker) {
      tbWorker = new Worker('js/tablebase.js');
      tbWorker.onmessage = (e) => { const cb = tbWait[e.data.id]; if (cb) { delete tbWait[e.data.id]; cb(e.data.result); } };
      tbWorker.onerror = () => { Object.keys(tbWait).forEach((k) => { const cb = tbWait[k]; delete tbWait[k]; cb(null); }); };
    }
    return new Promise((resolve) => { const id = ++tbSeq; tbWait[id] = resolve; tbWorker.postMessage({ id: id, fen: fen }); });
  }

  // How deep the power-up search looks at each bot level. Max has no limit but the clock.
  const BRAIN_DEPTH = [1, 1, 2, 2, 3, 4, 5, 6, 7];
  // The search config for the side to move: its own power-ups always, the other side's only when it may know them.
  function brainCfg(cfg, me, seeFoe) {
    const foe = R.other(me), pw = { w: null, b: null };
    pw[me] = cfg.pw[me];
    if (seeFoe) pw[foe] = cfg.pw[foe];
    // No dice in the search: nobody knows the coming rolls. This turn's roll is enforced through `allow`.
    const out = { side: cfg.side, pw: pw, freeArmy: cfg.freeArmy, terrain: cfg.terrain || null, kingCapture: !!cfg.kingCapture, castleAny: !!cfg.castleAny, hex: !!cfg.hex, checkers: !!cfg.checkers, duckChess: !!cfg.duckChess, sgExpect: true }; // the search judges a shot by its average
    // Dice Chess: the dice of this turn bind the search, and where a side is about to roll the search weighs every
    // possible throw. Old games (legacyDice) keep the old way: three dice bind this turn only, two dice nothing.
    if (cfg.dice && !cfg.legacyDice) { out.dice = true; out.dice3 = !!cfg.dice3; }
    else if (cfg.dice3) { out.dice = true; out.dice3 = true; out.seed = 0; out.legacyDice = true; }
    return out;
  }
  /* Dice Chess, for the review: after a turn, which of the mover's pieces the other side's next throw can take, and
     how likely that is. A target counts once, with every kind of piece that reaches it: the chance is that at least
     one of those kinds comes up. The king first (under king capture taking it wins), then the most valuable piece. */
  function diceOdds(game, n, by) {
    const cfg = game.cfg, foe = R.other(by), caps = R.pseudoMoves(n, cfg, true), hits = {};
    caps.forEach((m) => {
      if (!m.cap || R.colorOf(m.cap) !== by) return;
      const h0 = hits[m.capSq] = hits[m.capSq] || { p: m.cap, kinds: [] };
      const k = R.dieOf(m);
      if (h0.kinds.indexOf(k) < 0) h0.kinds.push(k);
    });
    const list = Object.keys(hits).map((q) => hits[q]), worth = (x) => (R.isRoyal(x.p) ? 1e6 : (VALUE[R.typeOf(x.p)] != null ? VALUE[R.typeOf(x.p)] : (R.fairyOf(x.p) ? R.fairyOf(x.p).value / 100 : 0)));
    const other = foe === 'w' ? 'White' : 'Black', yours = game.auto || game.local || by !== game.cfg.side ? (by === 'w' ? 'White\'s' : 'Black\'s') : 'your';
    if (!list.length) return (yours === 'your' ? 'Nothing of yours' : 'None of ' + yours + ' pieces') + ' can be taken by ' + other + '\'s next throw.';
    list.sort((a, b) => worth(b) - worth(a));
    const top = list[0], pct = Math.round(R.diceChance(n, cfg, top.kinds.length) * 100), name = R.isRoyal(top.p) ? 'king' : pieceName(R.typeOf(top.p));
    const kinds = top.kinds.map(pieceName), how = kinds.length > 1 ? kinds.slice(0, -1).join(', ') + ' or ' + kinds[kinds.length - 1] : kinds[0];
    return other + ' takes ' + yours + ' ' + name + (R.isRoyal(top.p) && cfg.kingCapture ? ', and with it the game,' : '') + ' if a ' + how + ' comes up: ' + pct + '% of throws.' + (list.length > 1 ? ' ' + (list.length - 1) + ' more of ' + yours + ' pieces can be hit.' : '');
  }
  /* Dice Chess: the search ends at the coming throw, so every level sees about the same. What sets the levels apart
     is how often a bot settles for a move a little worse than the best: a choice weighted by the score, with a
     spread that narrows level by level (none at all at full strength). The slip is made on the first move of a
     turn only: the moves after it carry out the turn that move started, the best way the dice allow, so a weak
     bot plays a weaker plan, not a turn of unrelated moves. */
  const DICE_SPREAD = [260, 180, 125, 85, 58, 38, 24, 14, 7];
  // the first move of a turn: no die used yet (two dice: every move is one)
  const diceTurnStart = (s) => !s.dice || !s.rolled || s.dice.length === s.rolled.length;
  function diceBotPick(acts, bot, s) {
    const T = bot.max || (s && !diceTurnStart(s)) ? 0 : DICE_SPREAD[Math.max(0, (bot.lv == null ? 9 : bot.lv) - 1)] || 7, top = acts[0].a.score;
    if (!T) return acts[0].act;
    const pool = acts.filter((x) => x.a.score >= top - 4 * T), w = pool.map((x) => Math.exp((x.a.score - top) / T)), sum = w.reduce((a, x) => a + x, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i].act; }
    return pool[0].act;
  }
  // Positions the game has been through, for the search to steer clear of repetitions. Dice rolls are left out.
  function seenKeys(game) {
    if (!game.dice) return game.keys;
    const out = {};
    Object.keys(game.keys).forEach((k) => { const b = k.replace(/\|[pnbrqk]{2}$/, ''); out[b] = (out[b] || 0) + game.keys[k]; });
    return out;
  }
  // A search result as the eval bar wants it, from the mover's point of view.
  /* The eval bar's number from a search: the mean of the last two finished depths. A short search swings
     between an odd and an even depth, most of all when free actions such as Freeze Ray come into play; the
     mean of the two keeps the bar from jumping. Mates are shown as they are. */
  function barScore(res, score) {
    const t = res.trail || [], prev = t.length > 1 ? t[t.length - 2] : null, M = 100000 - 1000;
    if (prev === null || Math.abs(score) > M || Math.abs(prev) > M) return score;
    return Math.round((score + prev) / 2);
  }
  function brainInfo(res) {
    const M = 100000, v = res.score;
    if (v > M - 1000) return { score: { mate: Math.max(1, Math.ceil((M - v) / 2)) }, depth: res.depth };
    if (v < -M + 1000) return { score: { mate: -Math.max(1, Math.ceil((M + v) / 2)) }, depth: res.depth };
    return { score: { cp: v }, depth: res.depth };
  }
  // Short text for an action of the power-up search, as the move list would write it.
  function actLabel(B, s, legal, act) {
    if (act.gild != null) return '\u2726' + sqLabel(act.gild);
    if (act.freeze != null) return '\u2744' + sqLabel(act.freeze);
    if (act.shield != null) return '\u26e8' + sqLabel(act.shield);
    if (act.convert != null) return '\u21c4' + sqLabel(act.convert);
    if (act.stop) return '\u29d6';
    return B.san(s, act.m, legal, B.play(s, act.m));
  }
  // Is this a standard-rules game with power-ups, the kind the power-up search has to judge?
  function brainGame(B, cfg) { return B.kind === 'hex' || B.kind === 'std' && ((!!cfg.pw && R.hasPowers(cfg)) || !!B.fairy || !!B.terrain || !!B.kc || newDice(cfg)); }
  const newDice = (cfg) => !!cfg && !!cfg.dice && !cfg.legacyDice; // Dice Chess with real throws: the odds-aware search plays and judges it
  const hasTraits = (t) => !!t && ((t.ghosts && t.ghosts.length > 0) || (t.snipers && t.snipers.length > 0) || (t.helmets && t.helmets.length > 0) || (t.vests && t.vests.length > 0));
  const hasTerrain = (t) => !!t && ((t.walls && t.walls.length > 0) || (t.water && t.water.length > 0) || (t.portals && t.portals.length === 2) || (t.holes && t.holes.length > 0) || (t.ducks && t.ducks.length > 0) || (t.bducks && t.bducks.length > 0));
  function keyToAct(key, pool) {
    // free actions are a letter and a square number. Anything else is a move key ("fly:12:30:" is a move, not a freeze).
    const free = /^([gfch])(\d+)$/.exec(key);
    if (free) return free[1] === 'g' ? { gild: +free[2] } : free[1] === 'f' ? { freeze: +free[2] } : free[1] === 'h' ? { shield: +free[2] } : { convert: +free[2] };
    return key === 't' ? { stop: true } : { m: pool.find((m) => moveKey(m) === key) };
  }
  // Drop what the real game does not allow here (the dice can rule out a Midas target the search saw).
  function actFits(game, s, pool, x) {
    return x.gild != null ? game.B.gildTargets(s, pool).indexOf(x.gild) >= 0 : x.freeze != null ? game.B.freezeTargets(s).indexOf(x.freeze) >= 0 : x.shield != null ? game.B.shieldTargets(s).indexOf(x.shield) >= 0 :
      x.convert != null ? game.B.convertTargets(s).indexOf(x.convert) >= 0 : x.stop ? game.B.stopReady(s) : !!x.m;
  }

  /* Pick the bot's next action in a game with power-ups. The power-up search decides: it
     plays with the real rules, knows gold and frozen pieces, and uses the free actions
     whenever they are at least as good as moving right away. Stockfish cannot see any of
     that, so it is only asked to choose between moves the search rates as equal, and only
     while the board holds nothing it would misread. */
  async function awareChoice(game, s, pool, bot, E, kind) {
    const me = s.turn, foe = R.other(me), cfg = game.cfg, meHas = R.has(cfg, me), foeHas = R.has(cfg, foe);
    const see = game.ai.anticipate && foeHas, odd = game.B.fairy || game.B.terrain || game.B.kc || newDice(cfg);
    if (!meHas && !see && !odd) return null;
    const MARGIN = meHas ? 12 : 35;
    const full = see || !foeHas; // this search knows everything that is in the game
    let ms = bot.max ? Math.min(12000, Math.max(700, thinkMs(game) * 0.85)) : 250 + bot.lv * 130;
    if (s.freezeUsed || s.midasUsed) ms *= 0.6; // the turn is already under way
    if (game.clock.on) ms = Math.min(ms, Math.max(120, game.clock[me] / 50));
    const res = await botBrain.think(s, brainCfg(cfg, me, see), { ms: ms, maxDepth: bot.max ? 64 : Math.max(BRAIN_DEPTH[Math.max(0, bot.lv - 1)] || 3, newDice(cfg) && s.dice ? s.dice.length + 1 : 0), margin: MARGIN, allow: pool.map(moveKey), free: true, seen: seenKeys(game), db: dbOwn(game, me) });
    if (!res || !res.actions || !res.actions.length || game !== G || live() !== s) return null;
    const acts = res.actions.map((a) => ({ a: a, act: keyToAct(a.key, pool) })).filter((x) => actFits(game, s, pool, x.act) && actSafe(game, s, x.act));
    if (!acts.length) return null;
    // only a full-strength search speaks for the bar: a bot held to a few moves of depth would make it jump every turn
    if (full && bot.max) setEval(brainInfo({ score: barScore(res, acts[0].a.score), depth: res.depth }), me);
    if (newDice(cfg)) return diceBotPick(acts, bot, s);
    const best = acts[0];
    if (!best.act.m) return best.act; // a free action that is at least as good as the best move
    const near = acts.filter((x) => x.act.m && x.a.score >= best.a.score - MARGIN && game.B.uci(x.act.m));
    const clean = !s.gold.length && !s.ice.length && !game.B.fairy && !game.B.terrain && !game.B.kc && !!game.B.uci(best.act.m) && Math.abs(best.a.score) < 50000;
    if (!clean || near.length < 2) return best.act;
    let think = bot.max ? Math.max(300, thinkMs(game) - ms) : Math.min(bot.ms || 300, 400);
    if (game.clock.on) think = Math.min(think, Math.max(100, game.clock[me] / 80));
    const r = await E.search({
      position: 'fen ' + game.B.fen(s), go: (bot.depth ? 'depth ' + bot.depth : 'movetime ' + Math.round(think)) + ' searchmoves ' + near.map((x) => game.B.uci(x.act.m)).join(' '),
      options: Object.assign(variantOpts(game, E, kind), strength(bot, E, kind === 'fairy'))
    });
    if (!r || r.cancelled) return null;
    const pick = r.best && near.find((x) => game.B.uci(x.act.m) === r.best);
    return (pick || best).act;
  }

  /* The same decision in a variant. The variant search is short and only counts material, so it
     settles the tactics (what a power-up wins or loses, which free action to use) and leaves the
     choice among the safe moves to Fairy-Stockfish, which knows how the variant is played. */
  async function awareChoiceFairy(game, s, pool, banned, bot, E) {
    const me = s.turn, foe = R.other(me), B = game.B, meHas = B.has(me), foeHas = B.has(foe);
    const see = game.ai.anticipate && foeHas;
    if (!meHas && !see) return null;
    const MARGIN = 60, pw = { w: null, b: null };
    pw[me] = game.cfg.pw[me];
    if (see) pw[foe] = game.cfg.pw[foe];
    const scfg = { side: game.cfg.side, pw: pw };
    let ms = bot.max ? Math.min(8000, Math.max(600, thinkMs(game) * 0.6)) : 300 + bot.lv * 90;
    if (s.freezeUsed || s.midasUsed) ms *= 0.6;
    if (game.clock.on) ms = Math.min(ms, Math.max(150, game.clock[me] / 50));
    const gm = Object.assign({ cfg: scfg, sig: JSON.stringify([game.bo.uci, game.bo.startFen, pw]) }, game.bo);
    const res = await fairyBrain.think(gm, s, { ms: ms, maxDepth: bot.max ? 8 : Math.min(4, BRAIN_DEPTH[Math.max(0, bot.lv - 1)] || 2), margin: MARGIN, free: true, banned: banned });
    if (!res || game !== G || live() !== s) return null;
    if (res.error) { console.warn('Variant power-up search:', res.error); return null; }
    const acts = (res.actions || []).map((a) => ({ a: a, act: keyToAct(a.key, pool) })).filter((x) => actFits(game, s, pool, x.act));
    if (!acts.length) return null;
    const best = acts[0];
    if (!best.act.m) return best.act; // a free action that is at least as good as the best move
    const normal = acts.filter((x) => x.act.m && B.uci(x.act.m) && x.a.score >= best.a.score - MARGIN);
    // a power move on top is played when it clearly beats every normal move
    if (!B.uci(best.act.m) && (!normal.length || best.a.score > normal[0].a.score + 25)) return best.act;
    if (normal.length < 2 || Math.abs(best.a.score) > 50000) return (normal[0] || best).act;
    let think = bot.max ? Math.max(300, thinkMs(game) - ms) : Math.min(bot.ms || 300, 500);
    if (game.clock.on) think = Math.min(think, Math.max(100, game.clock[me] / 80));
    const r = await E.search({
      position: 'fen ' + B.fen(s), go: (bot.depth ? 'depth ' + bot.depth : 'movetime ' + Math.round(think)) + ' searchmoves ' + normal.map((x) => B.uci(x.act.m)).join(' '),
      options: Object.assign(variantOpts(game, E, 'fairy'), strength(bot, E, true)), onInfo: (i) => { if (game === G && live() === s) setEval(i, s.turn); }
    });
    if (!r || r.cancelled) return null;
    const pick = r.best && normal.find((x) => B.uci(x.act.m) === r.best);
    return (pick || normal[0]).act;
  }

  function variantOpts(game, E, kind) {
    if ((kind || game.engine) !== 'fairy') return {};
    if (game.custom) E.loadVariants(game.custom.ini);
    return { UCI_Variant: game.uci, UCI_Chess960: game.c960 ? 'true' : 'false' };
  }

  /* A personality's move. The engine lists its best few moves, and the bot picks among the ones that
     are close to the best by what it likes: checks and captures for the attacker, trades for the
     grinder, and so on. Lena keeps her taste to herself but loses her head in time trouble. */
  async function styledMove(game, s, pool, bot, E, go, options) {
    const me = s.turn, B = game.B;
    // Gus: a gambit line from the book while the game still follows one
    if (bot.style === 'gambit' && game.startFen === R.START_FEN && !game.variantGame) {
      const sans = game.log.filter((e) => e.m).map((e) => e.san.replace(/[+#]/g, ''));
      const lines = GAMBITS[me].filter((l) => { const mv = l.split(' '); return mv.length > sans.length && sans.every((x, i) => x === mv[i]); });
      if (lines.length) {
        const want = lines[Math.floor(Math.random() * lines.length)].split(' ')[sans.length];
        for (const m of pool) { const after = B.play(s, m); if (B.san(s, m, game.legal, after).replace(/[+#]/g, '') === want) return m; }
      }
    }
    const width = { attack: 70, gambit: 90, solid: 45, endgame: 45, clock: 25 }[bot.style] || 40;
    const r = await E.search({ position: B.position(s, game.log), go: go, options: Object.assign({}, options, { MultiPV: 4 }) });
    if (!r || r.cancelled) return null;
    const lines = Object.keys(r.lines || {}).map((k) => r.lines[k]).filter((l) => l && l.pv && l.pv.length && l.score);
    if (!lines.length) return r.best ? B.find(pool, r.best) : null;
    const num = (sc) => (sc.mate != null ? (sc.mate > 0 ? 100000 - sc.mate : -100000 - sc.mate) : sc.cp);
    const best = Math.max.apply(null, lines.map((l) => num(l.score)));
    // time trouble: with little time left Lena picks worse moves, and now and then a random one
    if (bot.style === 'clock' && game.clock.on) {
      const left = game.clock[me] / 1000;
      if (left < 60) {
        const panic = Math.min(1, (60 - left) / 50);
        if (Math.random() < panic * 0.25) return pool[Math.floor(Math.random() * pool.length)];
        const cands = lines.filter((l) => best - num(l.score) <= 60 + panic * 300).map((l) => B.find(pool, l.pv[0])).filter(Boolean);
        if (cands.length && Math.random() < panic) return cands[Math.floor(Math.random() * cands.length)];
      }
    }
    const VALUE = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 }, foeKing = s.board.indexOf(me === 'w' ? 'k' : 'K'), W = B.W;
    const dist = (a, b) => (a < 0 || b < 0 ? 9 : Math.max(Math.abs(Math.floor(a / W) - Math.floor(b / W)), Math.abs((a % W) - (b % W))));
    const ply = game.log.filter((e) => e.m).length;
    let pick = null, top = -Infinity;
    lines.forEach((l) => {
      const v = num(l.score);
      if (best - v > width || Math.abs(v) > 90000 && v < best) return;
      const m = B.find(pool, l.pv[0]);
      if (!m) return;
      const after = B.play(s, m), check = B.checks(after).length > 0, cap = !!m.cap, mover = (m.piece || '').toLowerCase();
      const capVal = cap ? VALUE[(m.cap || '').toLowerCase()] || 300 : 0, ownVal = VALUE[mover] || 300;
      let bonus = 0;
      if (bot.style === 'attack' || bot.style === 'gambit') {
        bonus += (check ? 30 : 0) + (cap ? 15 : 0) + (m.from >= 0 && dist(m.to, foeKing) < dist(m.from, foeKing) ? 12 : 0) + (mover === 'q' || mover === 'r' ? 6 : 0);
        if (bot.style === 'gambit' && ply < 24 && v < best && mover === 'p') bonus += 25; // a pawn offered
      } else if (bot.style === 'solid') {
        bonus += (cap && capVal >= ownVal ? 15 : 0) + (mover === 'p' ? 6 : 0) + (m.castle ? 20 : 0) - (check ? 8 : 0) - (cap && capVal < ownVal ? 20 : 0);
      } else if (bot.style === 'endgame') {
        bonus += (cap && capVal >= ownVal ? 25 + (mover === 'q' ? 15 : 0) : 0) + (mover === 'k' && ply > 40 ? 8 : 0) + (mover === 'p' && ply > 40 ? 8 : 0);
      }
      const score = v + bonus + Math.random() * 6;
      if (score > top) { top = score; pick = m; }
    });
    return pick;
  }

  /* King capture: a bot whose royal piece stands attacked always gets it out of reach, at every level, if any move
     can (a king step, a block or taking the attacker). Only when nothing can does it move as it likes. */
  function kingSafety(game, s, pool) {
    if (!game.cfg.kingCapture || game.B.kind !== 'std' || !pool.length) return pool;
    const me = s.turn, cfg = game.cfg;
    if (!R.checkedSquares(s, me, cfg).length) return pool;
    /* Taking the other king wins on the spot, so it is always safe. A move after which the same side moves again
       (three dice: dice left this turn, an assassin's second step) is judged by the end of the turn, which the
       search sees: on the way the king may stand attacked, for instance on its way to take the other king. */
    const safe = pool.filter((m) => { try { if (m.cap && R.isRoyal(m.cap)) return true; const n = game.B.play(s, m); return R.royalAlive(n, me) && (n.turn === me || !R.checkedSquares(n, me, cfg).length); } catch (e) { return false; } });
    return safe.length ? safe : pool;
  }
  // A free action of a bot whose king is attacked under king capture: fine only if it keeps the turn or ends the attack.
  function actSafe(game, s, act) {
    if (act.m || !game.cfg.kingCapture || game.B.kind !== 'std') return true;
    const me = s.turn, cfg = game.cfg;
    if (!R.checkedSquares(s, me, cfg).length) return true;
    let n = null;
    try { n = act.gild != null ? game.B.gild(s, act.gild) : act.freeze != null ? game.B.freeze(s, act.freeze) : act.shield != null ? game.B.shield(s, act.shield) : act.convert != null ? game.B.convert(s, act.convert) : game.B.timeStop(s); } catch (e) { n = null; }
    return !!n && (n.turn === me || !R.checkedSquares(n, me, cfg).length);
  }
  // How long a full-strength bot thinks: the setting, except in a game mode, which keeps its own fixed rules.
  const thinkMs = (game) => (game && game.spec && game.spec.gameMode ? 3000 : settings.thinkMs);
  async function engineTurn() {
    const game = G, s = live(), legal = G.legal, t0 = performance.now();
    // In a bot match each side has its own engine and level.
    const P = G.auto ? G.bots[s.turn] : { engine: G.engine, bot: G.bot }, bot = P.bot, fairy = P.engine === 'fairy';
    ui.thinking = true;
    renderGame();
    const E = await engineByKind(P.engine);
    if (game !== G || live() !== s || G.over) return;
    if (!E) { ui.thinking = false; renderGame(); toast('The engine could not be started. Reload the page.'); return; }
    const banned = G.banned[G.states.length - 1] || []; // moves the player has vetoed here
    const pool = kingSafety(game, s, banned.length ? legal.filter((m) => banned.indexOf(moveKey(m)) < 0) : legal);
    let move = null;
    // a weak bot's blind move: in Dice Chess only to start a turn, never in the middle of one (see diceBotPick)
    if (bot.random && Math.random() < bot.random && !(newDice(game.cfg) && !diceTurnStart(s))) move = pool[Math.floor(Math.random() * pool.length)];
    else if (game.ai) {
      // A bot that knows the power-ups: the power-up search decides, the engine only breaks ties.
      const act = game.B.kind === 'std' || game.B.kind === 'hex' ? await awareChoice(game, s, pool, bot, E, P.engine) : await awareChoiceFairy(game, s, pool, banned, bot, E);
      if (game !== G || live() !== s || G.over) return;
      if (act && !act.m) {
        const wait0 = 450 - (performance.now() - t0);
        if (wait0 > 0) await sleep(wait0);
        if (game !== G || live() !== s || G.over) return;
        ui.thinking = false;
        if (act.gild != null) doGild(act.gild);
        else if (act.freeze != null) doFreeze(act.freeze);
        else if (act.shield != null) doShield(act.shield);
        else if (act.convert != null) doConvert(act.convert);
        else doTimeStop();
        return;
      }
      move = act && act.m;
      if (!move && (game.B.fairy || game.B.terrain || game.B.kc || game.hex)) {
        // the chess engine cannot read this position: a legal move it is, if the search gave none
        if (game !== G || live() !== s || G.over) return;
        move = pool[Math.floor(Math.random() * pool.length)];
      }
    }
    if (!move && !(bot.random && move)) {
      let go;
      if (bot.depth) go = 'depth ' + bot.depth;
      else {
        let ms = bot.max ? thinkMs(game) : bot.ms;
        if (G.clock.on) ms = Math.min(ms, Math.max(150, G.clock[s.turn] / 30));
        go = 'movetime ' + Math.round(ms);
      }
      let only = G.B.searchmoves(s, legal, false);
      if (banned.length) only = pool.map(G.B.uci).filter(Boolean);
      if (only) go += ' searchmoves ' + only.join(' ');
      const options = Object.assign(variantOpts(game, E, P.engine), strength(bot, E, fairy));
      if (bot.style) move = await styledMove(game, s, pool, bot, E, go, options);
      if (game !== G || live() !== s || G.over) return;
      if (!move) {
        // On the standard rules with power-ups this engine is blind to them, so its verdict stays off the eval bar.
        const r = await E.search({ position: G.B.position(s, G.log), go: go, options: options, onInfo: (i) => { if (game === G && live() === s && !brainGame(game.B, game.cfg)) setEval(i, s.turn); } });
        if (game !== G || live() !== s || G.over || r.cancelled) return;
        move = r.best && G.B.find(pool, r.best);
      }
      if (!move) {
        console.warn('The engine gave no usable move for', G.B.fen(s), r.best);
        move = pool[Math.floor(Math.random() * pool.length)];
      }
    }
    const wait = 450 - (performance.now() - t0);
    if (wait > 0) await sleep(wait);
    if (game !== G || live() !== s || G.over) return;
    ui.thinking = false;
    applyMove(move);
  }

  function analyse() {
    const game = G, s = live();
    if (G.over || (!G.auto && s.turn !== mySide())) return;
    if (!settings.evalBar && !ui.hintWanted) return;
    if (brainGame(game.B, game.cfg)) {
      // Power-ups in the game: the search that knows them judges the position and finds the hint.
      const legal = G.legal;
      /* In a bot match the bots act every few hundred milliseconds. A look that is cut off by each new action
         never finishes, so there a running look is left to finish and its verdict shown, a moment late. */
      if (G.auto && evalBrain.busy) return;
      if (!G.auto) evalBrain.stop();
      const lookMs = G.auto ? 600 : Math.min(2500, Math.max(900, settings.thinkMs * 0.5));
      evalBrain.think(s, brainCfg(game.cfg, s.turn, true), { ms: lookMs, margin: 0, allow: legal.map(moveKey), free: true, seen: seenKeys(game) }).then((res) => {
        if (!res || !res.actions || game !== G || G.over || (!G.auto && live() !== s)) return;
        if (res.expected) { setEval(brainInfo({ score: res.score, depth: res.depth }), s.turn); G.analysis = { state: s, best: null, act: null }; return; } // before the throw: its average
        const acts = res.actions.map((a) => ({ a: a, act: keyToAct(a.key, legal) })).filter((x) => actFits(game, s, legal, x.act));
        if (!acts.length) return;
        setEval(brainInfo({ score: barScore(res, acts[0].a.score), depth: res.depth }), s.turn);
        G.analysis = { state: s, best: null, act: acts[0].act };
        if (ui.hintWanted) showHint();
      });
      return;
    }
    let go = 'movetime 1500';
    const only = G.B.searchmoves(s, G.legal, true);
    if (only) {
      if (!only.length) return;
      go += ' searchmoves ' + only.join(' ');
    }
    const position = G.B.position(s, G.log);
    engineFor(game).then((E) => {
      if (!E || game !== G || live() !== s || G.over) return null;
      const options = Object.assign(variantOpts(game, E), FULL);
      return E.search({ position: position, go: go, options: options, onInfo: (i) => { if (game === G && live() === s) setEval(i, s.turn); } });
    }).then((r) => {
      if (!r || r.cancelled || game !== G || live() !== s) return;
      G.analysis = { state: s, best: r.best };
      if (ui.hintWanted) showHint();
    });
  }

  function showHint() {
    ui.hintWanted = false;
    const an = G.analysis && G.analysis.state === live() ? G.analysis : null;
    if (!an) return;
    const act = an.act || (an.best ? { m: G.B.find(G.legal, an.best) } : null);
    if (!act) return;
    const m = act.m;
    if (act.gild != null) { ui.marks = [act.gild]; toast('Hint: use Midas Touch on ' + sqLabel(act.gild)); renderBoard(); }
    else if (act.freeze != null) { ui.marks = [act.freeze]; toast('Hint: freeze the piece on ' + sqLabel(act.freeze)); renderBoard(); }
    else if (act.shield != null) { ui.marks = [act.shield]; toast('Hint: shield the piece on ' + sqLabel(act.shield)); renderBoard(); }
    else if (act.convert != null) { ui.marks = [act.convert]; toast('Hint: use Turncoat on ' + sqLabel(act.convert)); renderBoard(); }
    else if (act.stop) toast('Hint: use Time Stop now');
    else if (!m) return;
    else if (m.storm) toast('Hint: play Pawn Storm');
    else if (m.drop) { ui.marks = [m.to]; toast('Hint: drop a ' + m.drop.toUpperCase() + ' on ' + sqLabel(m.to)); renderBoard(); }
    else {
      ui.hintArrow = { from: m.from, to: m.to, color: '#8fd13f' };
      if (m.snipe) toast('Hint: shoot, do not capture');
      else if (m.swap) toast('Hint: swap king and rook');
      renderArrows();
    }
    $('#statusText').textContent = statusText();
  }
  function hint() {
    if (!canAct() || ranked() || (G.B.unrolled && G.B.unrolled(live()))) return; // nothing to hint before the throw
    if (G.analysis && G.analysis.state === live() && (G.analysis.best || G.analysis.act)) { showHint(); return; }
    ui.hintWanted = true;
    $('#statusText').textContent = 'Looking for a hint';
    analyse();
  }

  function undoTarget() {
    if (!G || G.auto) return -1;
    for (let i = G.states.length - 2; i >= 0; i--) {
      const s = G.states[i], full = (G.local ? (G.pw[s.turn] && G.pw[s.turn].double) : G.cfg.double) || 1;
      if (!G.local && s.turn !== G.cfg.side) continue; // against a bot the take-back goes to the start of your own turn
      const free = i > 0 && !G.log[i - 1].m && !G.log[i - 1].roll && G.log[i - 1].by === s.turn; // reached by a free action: the turn began earlier
      if (newDice(G.cfg) && !(s.dice && s.rolled && s.dice.length === s.rolled.length)) continue; // Dice Chess: back to just after your throw, never before it
      if ((!s.movesLeft || s.movesLeft === full) && !s.midasUsed && !s.freezeUsed && !s.shieldUsed && !free && !(s.again >= 0) && !(G.cfg.dice3 && s.dice && s.dice.length < 3)) return i;
    }
    return -1;
  }
  function undo() {
    if (runGame() && !G.over) { doRewind(); return; } // The Ouroboros King: a Rewind
    if (modeGame()) return; // no take-backs in a game mode, not even after it ended (it is settled)
    const j = undoTarget();
    if (j < 0) return;
    undoTo(j);
  }
  function undoTo(j) {
    stopEngines();
    G.states.length = j + 1;
    G.log.length = j;
    G.view = j;
    G.over = null; G.endOpen = false;
    G.puppetNow = false; G.puppetArmed = false;
    Object.keys(G.banned).forEach((k) => { if (+k > j) delete G.banned[k]; });
    rv = null;
    G.legal = G.B.legal(live());
    G.analysis = null;
    G.keys = {};
    G.states.forEach((s) => { const k = G.B.key(s); G.keys[k] = (G.keys[k] || 0) + 1; });
    G.clock.last = performance.now();
    ui.thinking = false; ui.sel = null; ui.mode = null; ui.hintArrow = null; ui.hintWanted = false; ui.premoves = [];
    closeOverlay();
    saveLive();
    renderAll();
    kick();
  }

  function pgn(game, when) {
    const G = game;
    if (!G) return '';
    const res = !G.over ? '*' : G.over.result === 'draw' ? '1/2-1/2' : G.over.result === 'w' ? '1-0' : '0-1';
    const d = when ? new Date(when) : new Date(), pad = (n) => (n < 10 ? '0' : '') + n;
    const powers = '';
    let out = '[Event "Power Chess"]\n[Date "' + d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + '"]\n' +
      '[White "' + nameOf(G, 'w') + '"]\n[Black "' + nameOf(G, 'b') + '"]\n[Result "' + res + '"]\n';
    if (G.variantGame || G.dice || G.checkers || G.duck) out += '[Variant "' + G.vname + '"]\n';
    if (G.startFen !== R.START_FEN) out += '[SetUp "1"]\n[FEN "' + G.startFen + '"]\n';
    if (powers) out += '[PowerUps "' + powers + '"]\n';
    if (G.pw.w) out += '[WhitePowerUps "' + powerNames(G.pw.w).join(', ') + '"]\n';
    if (G.pw.b) out += '[BlackPowerUps "' + powerNames(G.pw.b).join(', ') + '"]\n';
    out += '\n';
    let lastBy = null, no = G.moveNo;
    G.log.forEach((e, i) => {
      if (e.by !== lastBy) {
        if (e.by === 'w') out += (no++) + '. ';
        else if (i === 0) out += (no++) + '... ';
        lastBy = e.by;
      }
      out += e.san + ' ';
    });
    return out + res;
  }
  function copy(text, what) {
    const done = () => toast(what + ' copied');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => toast('Copy failed'));
    else toast('Copy is not available here');
  }
  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
  }

  /* ---------- game review ---------- */

  let rv = null; // { game, status: 'run' | 'summary' | 'step', evals, plies, sum, opening, legal, bestLine, trial, retry }
  const RV_SPEED = [[300, 'Fast'], [700, 'Standard'], [1500, 'Deep']];

  function evWhite(score, turn) {
    if (!score) return null;
    if (score.mate != null) return score.mate === 0 ? { win: R.other(turn) } : { mate: turn === 'w' ? score.mate : -score.mate };
    return { cp: turn === 'w' ? score.cp : -score.cp };
  }
  function reviewing() { return ui.tab === 'review' && !!rv && rv.game === G && (rv.status === 'summary' || rv.status === 'step'); }
  function rvLegal(i) {
    if (!rv.legal[i]) rv.legal[i] = G.B.legal(G.states[i]);
    return rv.legal[i];
  }
  // On the review board you may try a move for whoever is to move in the position shown.
  function canTry() {
    return reviewing() && rv.status === 'step' && !rv.trial && !rvPeek() && !ui.overlay && !rv.evals[G.view].over && rvLegal(G.view).length > 0;
  }
  function material2(boardArr) {
    let n = 0;
    boardArr.forEach((p) => { if (!p) return; const t = p.toLowerCase(); if (t !== 'p' && t !== 'k') n += VALUE[t] != null ? VALUE[t] : 5; });
    return n;
  }
  // Does the move leave its own piece where it can be taken for free or by something cheaper?
  function hangInfo(game, e, n, lgNext) {
    const m = e.m;
    if (game.B.kind !== 'std' || !m || m.drop || m.snipe || m.storm || m.swap || n.turn === e.by || !lgNext) return null;
    const sq = e.tp >= 0 ? e.tp : m.to, p = n.board[sq];
    if (!p || R.colorOf(p) !== e.by) return null;
    const t = R.typeOf(p);
    if (t === 'k' || t === 'p') return null;
    const att = lgNext.filter((x) => x.cap && x.capSq === sq && !x.snipe);
    if (!att.length) return null;
    const val = VALUE[t], minAtt = Math.min.apply(null, att.map((x) => (R.typeOf(x.piece) === 'k' ? 100 : VALUE[R.typeOf(x.piece)])));
    const offer = !R.attacked(n, sq, e.by, game.cfg) ? val : (minAtt < val ? val - minAtt : 0);
    const net = offer - (m.cap ? VALUE[R.typeOf(m.cap)] || 0 : 0);
    R.use(n);
    return net >= 2 ? { piece: p, sq: R.sqName(sq), net: net } : null;
  }

  async function startReview() {
    if (!G || !G.over) return;
    const game = G;
    stopEngines();
    const my = rv = { game: game, status: 'run', done: 0, total: game.states.length, evals: [], plies: [], legal: {}, bestLine: {}, trial: null, retry: null, opening: { name: '', plies: 0 } };
    renderReview();
    const byBrain = my.byBrain = brainGame(game.B, game.cfg); // power-ups: only the power-up search reads these positions right
    const E = byBrain ? null : await engineFor(game);
    if (rv !== my || G !== game) return;
    if (!E && !byBrain) { rv = null; toast('The engine could not be started. Reload the page.'); renderReview(); return; }
    for (let i = 0; i < game.states.length; i++) {
      const s = game.states[i], lg = game.B.legal(s), st = game.B.status(s, lg);
      my.legal[i] = lg;
      const rec = { ev: null, best: null, pv: [], second: null, pv2: [], n: lg.length, over: !!st.over };
      if (st.over) rec.ev = { win: st.result };
      else if (byBrain) {
        // Dice Chess: every legal move is searched, rolled or not (see buildReview), the allowed ones give the verdict
        const every = game.dice ? R.legalAll(s, game.cfg) : null;
        const res = await evalBrain.think(s, brainCfg(game.cfg, s.turn, true), { ms: settings.reviewMs * (every ? 1.5 : 1), margin: every ? 400 : 60, allow: (every || lg).map(moveKey), free: true });
        if (rv !== my || G !== game || !res) { if (rv === my) { rv = null; renderReview(); } return; }
        const acts = (res.actions || []).map((a) => ({ a: a, act: keyToAct(a.key, lg) })).filter((x) => actFits(game, s, lg, x.act));
        if (res.expected) rec.ev = evWhite(brainInfo({ score: res.score, depth: res.depth }).score, s.turn); // before a throw: its average
        if (every) {
          rec.moveEvs = {}; rec.allowed = lg.map(moveKey); rec.nAll = every.length;
          const keys = every.map(moveKey);
          (res.actions || []).forEach((a) => { if (keys.indexOf(a.key) >= 0) rec.moveEvs[a.key] = evWhite(brainInfo({ score: a.score, depth: res.depth }).score, s.turn); });
        }
        if (acts.length) {
          rec.ev = evWhite(brainInfo({ score: acts[0].a.score, depth: res.depth }).score, s.turn);
          rec.best = acts[0].a.key;
          rec.bestAct = acts[0].act;
          if (acts[1]) rec.second = evWhite(brainInfo({ score: acts[1].a.score, depth: res.depth }).score, s.turn);
        }
      } else {
        const only = game.B.searchmoves(s, lg, true);
        // A free action that leaves the board as it was (Freeze Ray, Midas Touch, Time Stop) gives the engine the
        // same position twice. Its first verdict is kept, so that only the power-up correction decides the rating.
        const prevRec = i > 0 && !game.log[i - 1].m && game.B.fen(s) === game.B.fen(game.states[i - 1]) ? my.evals[i - 1] : null;
        if (prevRec && prevRec.raw) {
          rec.ev = prevRec.raw; rec.best = prevRec.best; rec.pv = prevRec.pv; rec.second = prevRec.rawSecond; rec.pv2 = prevRec.pv2;
        } else if (!only || only.length) {
          /* Dice Chess: one line per legal move, rolled or not, all in the same search. The best of the moves the
             dice allowed is the verdict on the position, and the move played is judged against it from the same
             search (see buildReview). */
          const every = game.dice ? R.legalAll(s, game.cfg).map(R.uci).filter((u, k, a) => a.indexOf(u) === k) : null;
          const r = await E.search({
            position: 'fen ' + game.B.fen(s), go: 'movetime ' + (every ? Math.round(settings.reviewMs * 1.5) + ' searchmoves ' + every.join(' ') : settings.reviewMs + (only ? ' searchmoves ' + only.join(' ') : '')),
            options: Object.assign(variantOpts(game, E), FULL, { MultiPV: every ? Math.max(2, Math.min(every.length, 60)) : 2 })
          });
          if (rv !== my || G !== game || r.cancelled) { if (rv === my) { rv = null; renderReview(); } return; }
          let l1 = r.lines[1] || { score: r.score, pv: r.pv }, l2 = r.lines[2];
          if (every) {
            rec.moveEvs = {}; rec.allowed = only || []; rec.nAll = every.length;
            const ranked = Object.keys(r.lines).map((k) => r.lines[k]).filter((l) => l && l.pv && l.pv[0]);
            ranked.forEach((l) => { if (!rec.moveEvs[l.pv[0]]) rec.moveEvs[l.pv[0]] = evWhite(l.score, s.turn); });
            const ok = ranked.filter((l) => rec.allowed.indexOf(l.pv[0]) >= 0); // still best first
            l1 = ok[0] || l1; l2 = ok[1] || null;
            r.best = l1.pv && l1.pv[0] ? l1.pv[0] : r.best;
          }
          rec.ev = evWhite(l1.score, s.turn);
          rec.best = r.best;
          rec.pv = l1.pv || [];
          if (l2 && l2.pv && l2.pv[0] !== rec.pv[0]) { rec.second = evWhite(l2.score, s.turn); rec.pv2 = l2.pv; }
        }
        // three pieces on the board: the endgame table knows the exact outcome
        if (game.B.kind === 'std' && !game.B.powers) {
          const tb = await probeTablebase(game.B.fen(s));
          if (rv !== my || G !== game) return;
          if (tb) {
            const sign = s.turn === 'w' ? 1 : -1;
            rec.ev = tb.wdl === 'draw' ? { cp: 0, mate: null } : { cp: null, mate: (tb.wdl === 'win' ? 1 : -1) * sign * Math.max(1, tb.dtm) };
            rec.tb = tb.wdl;
          }
        }
        rec.raw = rec.ev; rec.rawSecond = rec.second;
        if (game.variantGame && game.B.powers) {
          // the engine judged this as the plain variant: add what the power-ups change
          // a fixed depth, so that two neighbouring positions are measured with the same yardstick
          const d = await powerDelta(game, s, Math.max(500, settings.reviewMs), 2);
          if (rv !== my || G !== game) { if (rv === my) { rv = null; renderReview(); } return; }
          if (d && d.best) {
            // what the power-up search would do here, free actions included
            const pa = keyToAct(d.best, lg);
            if (actFits(game, s, lg, pa)) { rec.pwBest = d.best; rec.pwAct = pa; }
          }
          if (d && d.mate != null) rec.ev = { mate: d.mate };
          else if (d) {
            if (rec.ev && rec.ev.cp != null) rec.ev = { cp: rec.ev.cp + d.cp };
            if (rec.second && rec.second.cp != null) rec.second = { cp: rec.second.cp + d.cp };
          }
        }
      }
      if (!rec.ev) rec.ev = i ? my.evals[i - 1].ev : { cp: 0 };
      // the material on the board weighs every verdict of this position (matScale): copies, so the previous position's verdict is not touched
      const k = matScale(s);
      if (k !== 1) ['ev', 'second', 'raw', 'rawSecond'].forEach((f) => { if (rec[f]) rec[f] = Object.assign({}, rec[f], { k: k }); });
      if (k !== 1 && rec.moveEvs) Object.keys(rec.moveEvs).forEach((m) => { rec.moveEvs[m] = Object.assign({}, rec.moveEvs[m], { k: k }); });
      my.evals.push(rec);
      my.done = i + 1;
      const bar = $('#rvProg');
      if (bar) { bar.style.width = (my.done / my.total * 100) + '%'; $('#rvProgText').textContent = 'Position ' + my.done + ' of ' + my.total; }
    }
    if (byBrain) {
      /* Second pass for power-up games. The verdict on the move that was played comes from the position
         after it, which is one step deeper than the verdict on the move the search preferred. With a
         short search that alone can make a sound move look like a blunder. So wherever the two differ
         clearly, the preferred action is played out too and judged from the position it leads to. */
      const todo = [];
      for (let i = 0; i < game.log.length; i++) {
        const e = game.log[i], rec = my.evals[i], nx = my.evals[i + 1];
        if (!rec.bestAct || rec.over) continue;
        const played = e.m ? moveKey(e.m) : e.gild != null ? 'g' + e.gild : e.freeze != null ? 'f' + e.freeze : e.shield != null ? 'h' + e.shield : e.convert != null ? 'c' + e.convert : 't';
        if (played !== rec.best && Review.chanceFor(rec.ev, e.by) - Review.chanceFor(nx.ev, e.by) > 0.05) todo.push(i);
      }
      for (let k = 0; k < todo.length; k++) {
        const i = todo[k], s = game.states[i], a = my.evals[i].bestAct;
        const bar = $('#rvProg');
        if (bar) { bar.style.width = ((k + 1) / todo.length * 100) + '%'; $('#rvProgText').textContent = 'Checking the critical moves, ' + (k + 1) + ' of ' + todo.length; }
        let nb = null;
        try { nb = a.m ? game.B.play(s, a.m) : a.gild != null ? game.B.gild(s, a.gild) : a.freeze != null ? game.B.freeze(s, a.freeze) : a.shield != null ? game.B.shield(s, a.shield) : a.convert != null ? game.B.convert(s, a.convert) : game.B.timeStop(s); } catch (err) { nb = null; }
        if (!nb) continue;
        const lgb = game.B.legal(nb), stb = game.B.status(nb, lgb);
        if (stb.over) { my.evals[i].bestAfter = { win: stb.result }; continue; }
        const res = await evalBrain.think(nb, brainCfg(game.cfg, nb.turn, true), { ms: settings.reviewMs, margin: 0, allow: lgb.map(moveKey), free: true });
        if (rv !== my || G !== game || !res) { if (rv === my) { rv = null; renderReview(); } return; }
        if (res.actions && res.actions.length) my.evals[i].bestAfter = evWhite(brainInfo(res).score, nb.turn);
      }
    }
    buildReview(my);
    const kept = game.archiveId ? archive.find((r) => r.id === game.archiveId) : null;
    if (kept) { kept.acc = my.sum.acc; saveArchive(); }
    my.status = 'summary';
    renderAll();
  }

  function buildReview(my) {
    const game = my.game, plies = [], sans = [];
    game.log.forEach((e, i) => {
      const s = game.states[i], n = game.states[i + 1], rec = my.evals[i], nx = my.evals[i + 1];
      if (e.roll) { plies.push({ idx: i, by: e.by, san: '', special: 'roll', rated: false, roll: e.roll, wasted: !!e.wasted, npm: material2(s.board) }); return; }
      const special = e.gild != null ? 'gild' : e.freeze != null ? 'freeze' : e.shield != null ? 'shield' : e.convert != null ? 'convert' : e.stop ? 'stop' : null;
      let bestSan = '';
      if (rec.bestAct && !rec.bestAct.m) bestSan = actLabel(game.B, s, my.legal[i], rec.bestAct); // the best thing here was a free action
      else if (special && !my.byBrain) { if (rec.pwAct) bestSan = actLabel(game.B, s, my.legal[i], rec.pwAct); } // a variant: the power-up search names the alternative
      else if (rec.best && (!special || my.byBrain)) {
        const bm = rec.bestAct ? rec.bestAct.m : game.B.find(my.legal[i], rec.best);
        if (bm) {
          const bn = game.B.play(s, bm);
          bestSan = game.B.san(s, bm, my.legal[i], bn);
          my.bestLine[i] = { m: bm, state: bn, san: bestSan };
        }
      }
      const prev = i > 0 ? game.log[i - 1] : null, capture = !!(e.removed && e.removed.length);
      const keyOf = (x) => (x.gild != null ? 'g' + x.gild : x.freeze != null ? 'f' + x.freeze : x.shield != null ? 'h' + x.shield : x.convert != null ? 'c' + x.convert : x.stop ? 't' : null);
      // Free actions of one turn can be played in any order. If the one the search wanted first follows later in the same turn, nothing was done wrong.
      let sameTurn = false;
      if (special && rec.best) for (let k = i + 1; k < game.log.length && game.log[k].by === e.by && !game.log[k - 1].m; k++) if (keyOf(game.log[k]) === rec.best) { sameTurn = true; break; }
      /* Dice Chess. The position after a move is searched with the other side held to its own roll, which
         flatters every move: both players come out near perfect. So a move is judged against the other moves
         the dice allowed, all from the same search, and `base` says how well a random allowed move would
         have done, for the rating estimate. */
      let diceAfter = null, base = null, baseAll = null;
      if (game.dice && !special && rec.moveEvs) {
        const pk = my.byBrain ? moveKey(e.m) : game.B.uci(e.m);
        if (rec.moveEvs[pk]) {
          diceAfter = rec.moveEvs[pk];
          const top = Review.chanceFor(rec.ev, e.by);
          // how well a random choice would have done: among the moves the dice allowed, and among all legal moves
          const randomAcc = (keys, n) => {
            const v = keys.filter((k) => rec.moveEvs[k]).map((k) => Review.moveAccuracy(top, Review.chanceFor(rec.moveEvs[k], e.by)));
            if (!v.length) return null;
            const worst = Math.min.apply(null, v); // moves beyond the searched lines count as the worst one seen
            return (v.reduce((a, x) => a + x, 0) + Math.max(0, n - v.length) * worst) / Math.max(n, v.length);
          };
          base = randomAcc(rec.allowed, rec.allowed.length);
          baseAll = randomAcc(Object.keys(rec.moveEvs), rec.nAll);
        }
      }
      plies.push({
        dice: diceAfter != null, base: base, baseAll: baseAll,
        idx: i, by: e.by, san: e.san, special: special, rated: !!special, // free actions are rated like moves
        target: special && special !== 'stop' ? { piece: s.board[e.gild != null ? e.gild : e.freeze != null ? e.freeze : e.shield != null ? e.shield : e.convert], name: (COMPOUND[((game.glyphs || {})[String(s.board[e.gild != null ? e.gild : e.freeze != null ? e.freeze : e.shield != null ? e.shield : e.convert]).toLowerCase()] || []).join('')] || [])[0] || '', sq: Fairy.sqName(e.gild != null ? e.gild : e.freeze != null ? e.freeze : e.shield != null ? e.shield : e.convert, game.W, game.H) } : null,
        played: special ? (sameTurn ? rec.best : keyOf(e)) : (my.byBrain ? moveKey(e.m) : game.B.uci(e.m)),
        best: special && !my.byBrain ? (rec.pwBest || null) : rec.best, bestSan: bestSan,
        before: diceAfter ? rec.ev : (rec.bestAfter || rec.ev), after: diceAfter || nx.ev, // bestAfter: the preferred move judged at the same depth as the played one second: rec.second, forced: !special && rec.n === 1,
        recapture: capture && !!prev && !!prev.m && !!e.m && !!(prev.removed && prev.removed.length) && prev.m.to === e.m.to,
        hang: special || game.hex ? null : hangInfo(game, e, n, my.legal[i + 1]), npm: material2(s.board), book: false,
        tbAfter: nx.tb || null, // what the endgame table says about the position the move leads to
        odds: newDice(game.cfg) && n.turn !== e.by && !nx.over ? diceOdds(game, n, e.by) : '' // Dice Chess: what the coming throw can do
      });
      if (!special) sans.push(e.san);
    });
    if (game.B.kind === 'std' && !game.B.powers && game.startFen === R.START_FEN) {
      my.opening = Review.opening(sans);
      for (let i = 0; i < my.opening.plies && i < plies.length; i++) plies[i].book = true;
    }
    Review.classify(plies);
    my.plies = plies;
    my.sum = Review.summary(plies);
    if (!game.hex) harvestPuzzles(game, my, plies); // puzzles are square-board chess
  }

  /* Puzzles from your own games. Every position in which you missed a clearly best line becomes one:
     the other side's move leads in, the engine's line is the solution. Kept in localStorage. */
  const MINE_KEY = 'powerchess_mypuzzles';
  let mine = [];
  try { mine = JSON.parse(localStorage.getItem(MINE_KEY)) || []; } catch (e) { mine = []; }
  function saveMine() { try { localStorage.setItem(MINE_KEY, JSON.stringify(mine)); } catch (e) { /* full */ } }
  function harvestPuzzles(game, my, plies) {
    if (game.auto || game.B.kind !== 'std' || game.B.powers || my.byBrain || game.dice) return;
    const you = game.cfg.side, cfg = { side: 'w' };
    let added = 0;
    plies.forEach((p) => {
      if (p.by !== you || p.special || !(p.cls === 'mistake' || p.cls === 'blunder' || p.cls === 'miss')) return;
      const i = p.idx, rec = my.evals[i], s = game.states[i];
      if (!rec || !rec.pv || !rec.pv.length || !rec.second) return;
      if (Review.chanceFor(rec.ev, you) - Review.chanceFor(rec.second, you) < 0.12) return; // more than one good move
      if ((s.W || 8) !== 8 || (s.H || 8) !== 8) return; // puzzles are 8 x 8 only
      const fen = R.toFen(s);
      if (mine.some((x) => x.fen === fen)) return;
      // the solution: the engine's line, checked against the rules, at most three of your moves
      const moves = [];
      let cur = s;
      for (const u of rec.pv.slice(0, 5)) {
        const m = R.findUci(R.legalMoves(cur, cfg), u);
        if (!m) break;
        moves.push(u); cur = R.play(cur, m, cfg);
      }
      if (moves.length % 2 === 0) moves.pop();
      if (!moves.length) return;
      R.use(s);
      const prev = i > 0 ? game.log[i - 1] : null, lead = prev && prev.m && !prev.m.snipe && !prev.m.drop ? R.uci(prev.m) : null;
      const first = R.findUci(R.legalMoves(s, cfg), moves[0]), solverMoves = (moves.length + 1) / 2;
      const mate = rec.ev && rec.ev.mate != null && ((rec.ev.mate > 0) === (you === 'w')) ? Math.abs(rec.ev.mate) : 0;
      const themes = ['yourGame', solverMoves === 1 ? 'oneMove' : solverMoves === 2 ? 'short' : 'long', material2(s.board) <= 16 ? 'endgame' : 'middlegame'];
      if (mate && mate <= 5) themes.push('mate', 'mateIn' + mate);
      let rating = 700 + 300 * (solverMoves - 1) + (first && !first.cap && !R.inCheck(R.play(s, first, cfg), R.other(you), cfg) ? 350 : 0) + (p.cls === 'miss' ? 150 : 0);
      rating = Math.min(2500, rating);
      mine.unshift({
        id: 'g' + (game.archiveId || Date.now()) + '_' + i, fen: fen, moves: moves, rating: rating, themes: themes,
        last: lead, pre: lead ? R.toFen(game.states[i - 1]) : null, lc: lead && prev.m.cap ? prev.m.cap : '',
        game: { white: nameOf(game, 'w'), black: nameOf(game, 'b'), date: Date.now(), move: Math.floor((i + (s.turn === 'b' ? 1 : 0)) / 2) + 1, you: you, played: p.san },
        solved: 0
      });
      added++;
    });
    if (!added) return;
    if (mine.length > 300) mine.length = 300;
    saveMine();
    toast(added === 1 ? 'One puzzle from this game is waiting under Puzzles, Your games' : added + ' puzzles from this game are waiting under Puzzles, Your games');
  }

  function badgeHtml(cls, size) {
    const c = Review.CLASSES[cls];
    return c ? '<i class="cb ' + (size || '') + '" style="background:' + c.color + '">' + c.sym + '</i>' : '';
  }
  function moveLabel(i) {
    // "12. Nf3" or "12... Nf6" for the ply at log index i
    let no = G.moveNo - 1, lastBy = null;
    for (let k = 0; k <= i; k++) { const by = G.log[k].by; if (by !== lastBy) { if (by === 'w' || lastBy === null) no++; lastBy = by; } }
    return no + (G.log[i].by === 'w' ? '. ' : '... ') + G.log[i].san;
  }
  function pvSan(i, ucis) {
    let s = G.states[i], lg = rvLegal(i);
    const out = [];
    for (let k = 0; k < Math.min(ucis.length, 7); k++) {
      const m = G.B.find(lg, ucis[k]);
      if (!m) break;
      const n = G.B.play(s, m);
      out.push(G.B.san(s, m, lg, n));
      s = n; lg = G.B.legal(n);
    }
    return out;
  }

  function graphHtml() {
    const n = rv.evals.length, pts = rv.evals.map((r, i) => [n > 1 ? i / (n - 1) * 100 : 0, (1 - Review.whiteChance(softEv(r.ev))) * 100]);
    let d = 'M0,100 ';
    pts.forEach((p) => { d += 'L' + p[0].toFixed(2) + ',' + p[1].toFixed(2) + ' '; });
    d += 'L100,100 Z';
    let dots = '';
    rv.plies.forEach((p) => {
      if (!p.cls || !Review.KEY[p.cls]) return;
      const pt = pts[p.idx + 1];
      dots += '<i class="rv-dot" style="left:' + pt[0] + '%;top:' + Math.max(6, Math.min(94, pt[1])) + '%;background:' + Review.CLASSES[p.cls].color + '"></i>';
    });
    const cur = n > 1 ? G.view / (n - 1) * 100 : 0;
    return '<div class="rv-graph" id="rvGraph"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="' + d + '" fill="#f1f1ee"/><line x1="0" y1="50" x2="100" y2="50" stroke="rgba(128,128,128,.55)" stroke-width=".6"/></svg>' +
      dots + '<i class="rv-cur" style="left:' + cur + '%"></i></div>';
  }
  function wireGraph() {
    const g = $('#rvGraph');
    if (!g) return;
    g.onclick = (e) => {
      const rc = g.getBoundingClientRect();
      gotoView(Math.round((e.clientX - rc.left) / rc.width * (rv.evals.length - 1)));
    };
  }

  function renderReview() {
    const body = $('#rvBody'), step = $('#rvStep');
    const stepping = !!rv && rv.game === G && rv.status === 'step';
    body.classList.toggle('off', stepping);
    step.classList.toggle('on', stepping);
    if (!G || !G.over) {
      body.innerHTML = '<div id="empty"><img src="pieces/wQ.svg" alt=""><br>' + (G ? 'Finish this game first.<br>A review rates every move once the game is over.' : 'Nothing to review yet.<br>Play a game, then come back here.') + '</div>';
      return;
    }
    if (!rv || rv.game !== G) {
      body.innerHTML = '<h3>Game Review</h3><p class="sub">The engine goes through the whole game, rates every move of both sides, and shows where it turned. Afterwards you can step through it, see the best move in any position and retry your mistakes on the board.</p>' +
        (brainGame(G.B, G.cfg) && !(G.cfg.pw && R.hasPowers(G.cfg)) ? '<div class="note on">' + (G.dice ? 'Dice Chess is rated by the built-in search, which knows the dice and weighs every throw that can come up. Each move is compared with the best one the dice allowed.' : 'This game is rated by the built-in search, which knows these pieces and rules, but does not look as deep as Stockfish.') + '</div>'
          : brainGame(G.B, G.cfg) ? '<div class="note on">This game used power-ups, so it is rated by the power-up search. It knows gold statues, frozen pieces and every other power-up, but it does not look as deep as Stockfish. A bot with power-ups gets its moves from that same search, Stockfish cannot play with them. With many power-ups stacked the search only sees a few moves ahead, so pick Deep for a verdict you can trust.</div>'
          : G.variantGame && G.B.powers ? '<div class="note on">This game used power-ups. Fairy-Stockfish judges every position as the plain variant, and a short power-up search adds what statues, ice and the other power-ups change about it. That second part only looks about two moves ahead.</div>' : '') +
        (G.dice ? '<div class="note on">This was Dice Chess. In every position the engine only weighs the moves the dice allowed.</div>' : '') +
        '<h3>Depth</h3><div class="seg" id="rvSpeed"></div><p class="sub" style="margin-top:8px">' + G.states.length + ' positions, about ' + Math.max(1, Math.round(G.states.length * settings.reviewMs / 1000)) + ' seconds.</p>' +
        '<button class="btn green" id="rvStart">Start Review</button>';
      seg($('#rvSpeed'), RV_SPEED, settings.reviewMs, (v) => { settings.reviewMs = v; save(); renderReview(); });
      $('#rvStart').onclick = startReview;
      return;
    }
    if (rv.status === 'run') {
      body.innerHTML = '<h3>Analyzing the game</h3><div class="rv-prog"><i id="rvProg" style="width:' + (rv.done / rv.total * 100) + '%"></i></div><p class="sub" id="rvProgText" style="margin-top:8px">Position ' + rv.done + ' of ' + rv.total + '</p>' +
        (G && G.over ? '<button class="btn" id="rvBackRun" style="width:100%;margin-top:12px">Back to the result</button>' : '');
      if ($('#rvBackRun')) $('#rvBackRun').onclick = showResult;
      return;
    }
    if (rv.status === 'summary') { renderSummaryView(body); return; }
    renderStepView();
  }

  function renderSummaryView(body) {
    const side = G.cfg.side === 'b' ? 'b' : 'w', opp = R.other(side), sum = rv.sum, C = Review.CLASSES;
    const accTxt = (c) => (sum.acc[c] == null ? 'n/a' : sum.acc[c].toFixed(1));
    const card = (c, who) => '<div class="rv-card' + (c === 'w' ? ' wh' : '') + '"><div class="who">' + who + '</div><div class="num">' + accTxt(c) + '</div><div class="who">Accuracy</div></div>';
    let html = (rv.opening.name ? '<div class="rv-open">Opening: <b>' + rv.opening.name + '</b>' + (rv.opening.eco ? ' <span style="color:var(--dim)">' + rv.opening.eco + '</span>' : '') + '</div>' : '') + graphHtml() +
      '<div class="rv-acc">' + card(side, nameOf(G, side)) + card(opp, nameOf(G, opp)) + '</div><table class="rv-table">';
    Review.ORDER.forEach((k) => {
      html += '<tr><td style="color:' + C[k].color + '">' + sum.counts[side][k] + '</td><td>' + badgeHtml(k, 'sm') + '<span>' + C[k].label + '</span></td><td style="color:' + C[k].color + '">' + sum.counts[opp][k] + '</td></tr>';
    });
    // no estimate: too few moves were played while the game was still open
    const est = (c) => (sum.rating[c] ? sum.rating[c] : '<span title="Too few moves while the game was still open to tell">?</span>');
    html += '<tr class="sep"><td>' + est(side) + '</td><td><span title="Lichess rapid scale. Only moves made while the game was still open count.">Estimated rating</span></td><td>' + est(opp) + '</td></tr>';
    [['opening', 'Opening'], ['middlegame', 'Middlegame'], ['endgame', 'Endgame']].forEach((ph) => {
      const a = sum.phases[side][ph[0]], b = sum.phases[opp][ph[0]];
      html += '<tr><td>' + (a ? badgeHtml(a, 'sm') : '<em>none</em>') + '</td><td><span>' + ph[1] + '</span></td><td>' + (b ? badgeHtml(b, 'sm') : '<em>none</em>') + '</td></tr>';
    });
    html += '</table>' + (!sum.rating.w && !sum.rating.b ? '<div class="note on">No rating estimate: one side was far ahead for almost the whole game, and moves made in a decided position say little about the player.</div>' : '') + (brainGame(G.B, G.cfg) && G.cfg.pw && R.hasPowers(G.cfg) ? '<div class="note on">Power-ups were on. The ratings come from the power-up search, which knows them.</div>'
      : G.variantGame && G.B.powers ? '<div class="note on">Power-ups were on. The ratings are the engine\'s view of the plain variant plus a short power-up correction.</div>' : '') +
      (G.dice ? '<div class="note on">Dice Chess: a move is rated against the best one the dice allowed.</div>' : '') +
      '<button class="btn green" id="rvGo">Review the moves</button><button class="btn" id="rvAgain" style="width:100%;margin-top:10px">Analyze again</button>' +
      (G.over ? '<button class="btn" id="rvBackEnd" style="width:100%;margin-top:10px">Back to the result</button>' : '');
    body.innerHTML = html;
    wireGraph();
    $('#rvGo').onclick = () => { rv.status = 'step'; if (G.view === G.states.length - 1) G.view = 0; renderAll(); };
    $('#rvAgain').onclick = () => { rv = null; renderAll(); };
    if ($('#rvBackEnd')) $('#rvBackEnd').onclick = showResult;
  }

  /* The coach's explanation for the move at log index i: why it fails and what the better move would
     have done. It needs two lines, the answer to the move and the line after the best move. Stockfish
     hands them over with its verdict. In a power-up game the power-up search plays them out first,
     which takes a moment, so the text arrives a little later. */
  const WEAK = { inaccuracy: 1, mistake: 1, blunder: 1, miss: 1 };
  const COMPOUND = { BN: ['archbishop', 7], NB: ['archbishop', 7], RN: ['chancellor', 8], NR: ['chancellor', 8], QN: ['amazon', 12], NQ: ['amazon', 12], RK: ['dragon king', 7], BK: ['dragon horse', 5], NN: ['nightrider', 5] };
  function coachKit(game) {
    // pieces a variant draws as two combined pieces get their usual name and a fitting value
    const names = {}, values = {};
    Object.keys(game.glyphs || {}).forEach((l) => { const c = COMPOUND[(game.glyphs[l] || []).slice(0, 2).join('')]; if (c) { names[l] = c[0]; values[l] = c[1]; } });
    if (game.B.kind === 'std') R.FAIRY_LETTERS.forEach((l) => { names[l] = R.FAIRY[l].name.toLowerCase(); values[l] = Math.round(R.FAIRY[l].value / 100); });
    return { B: game.B, std: game.B.kind === 'std', R: R, cfg: game.cfg, names: names, values: values, name: (sq) => Fairy.sqName(sq, game.W, game.H), label: (st, lg, act) => actLabel(game.B, st, lg, act) };
  }
  // Best play from a position according to the power-up search, action by action, for at most three turns.
  async function brainLine(game, state, first, maxActs) {
    const B = game.B, out = [];
    let s = state, turns = 0, act = first || null;
    for (let i = 0; i < maxActs; i++) {
      const lg = B.legal(s);
      if (B.status(s, lg).over) break;
      if (!act) {
        const res = await evalBrain.think(s, brainCfg(game.cfg, s.turn, true), { ms: 260, margin: 0, allow: lg.map(moveKey), free: true });
        if (!res || !res.actions) return null; // stopped
        const fit = res.actions.map((a) => keyToAct(a.key, lg)).filter((x) => actFits(game, s, lg, x))[0];
        if (!fit) break;
        act = fit;
      }
      const n = act.m ? B.play(s, act.m) : act.gild != null ? B.gild(s, act.gild) : act.freeze != null ? B.freeze(s, act.freeze) : act.shield != null ? B.shield(s, act.shield) : act.convert != null ? B.convert(s, act.convert) : B.timeStop(s);
      if (!n) break;
      out.push(act);
      if (n.turn !== s.turn && ++turns >= 3) break;
      s = n; act = null;
    }
    return out;
  }
  function coachFor(i) {
    const my = rv, game = G, p = my.plies[i];
    if (!p || !WEAK[p.cls] || typeof Coach === 'undefined') return;
    my.why = my.why || {};
    if (my.why[i]) return;
    const e = game.log[i], s = game.states[i], n = game.states[i + 1], rec = my.evals[i], nx = my.evals[i + 1];
    const finish = (reply, best) => {
      let x = { why: '', better: '', soft: false };
      try { x = Coach.explain(coachKit(game), { s: s, n: n, m: e.m || null, by: e.by, san: e.san, cls: p.cls, chanceBefore: p.chanceBefore, chanceAfter: p.chanceAfter, reply: reply || [], best: best || [] }); } catch (err) { console.warn('coach', err); }
      my.why[i] = { done: true };
      p.why = x.why; p.better = x.better; p.whySoft = x.soft;
    };
    if (!my.byBrain) {
      // a free action in a variant: the alternative comes from the power-up search, the engine knows none
      if (p.special) finish([], rec.pwAct ? [rec.pwAct] : []);
      else finish(nx.pv || [], rec.pv || []);
      return;
    }
    my.why[i] = { done: false };
    (async () => {
      const reply = nx.over ? [] : await brainLine(game, n, e.m ? nx.bestAct : null, 7);
      // the advice gets a longer look than the quick pass of the review gave it
      let first = rec.bestAct;
      if (reply && first) {
        const lg = my.legal[i] || game.B.legal(s);
        const res = await evalBrain.think(s, brainCfg(game.cfg, s.turn, true), { ms: Math.max(1500, settings.reviewMs * 2), margin: 0, allow: lg.map(moveKey), free: true });
        if (res && res.actions) { const fit = res.actions.map((a) => keyToAct(a.key, lg)).filter((x) => actFits(game, s, lg, x))[0]; if (fit) first = fit; }
      }
      const best = reply && first ? await brainLine(game, s, first, 5) : null;
      if (rv !== my || G !== game) return;
      if (!reply || !best) { delete my.why[i]; return; } // the search was stopped, try again next time
      finish(reply, best);
      if (ui.tab === 'review' && my.status === 'step') renderReview();
    })();
  }

  /* Moves named in the review's words are links: a click shows the position after that move, with an arrow, and a
     second click goes back. A word is taken as a move when it is a legal move in the position after the reviewed
     move, or before it (the better move), or right after the move before it in the same line ("Bxa6 bxa6 d4"). */
  const rvPeek = () => (reviewing() && rv.peek && rv.peek.view === G.view && !rv.trial ? rv.peek : null);
  const sanMaps = new WeakMap();
  function sanMap(s) {
    if (!s) return {};
    let map = sanMaps.get(s);
    if (map) return map;
    map = {};
    try {
      const lg = G.B.legal(s);
      lg.forEach((m) => { const n = G.B.play(s, m); if (!n) return; const san = String(G.B.san(s, m, lg, n)).replace(/[+#!?]+$/, ''); if (!map[san]) map[san] = { m: m, n: n }; });
    } catch (e) { map = {}; }
    sanMaps.set(s, map);
    return map;
  }
  function rvLinkMoves(k, p) {
    const before = k > 0 ? G.states[k - 1] : null, after = G.states[k];
    const firsts = (w) => (p && (w === String(p.san).replace(/[+#]+$/, '') || (p.bestSan && w === String(p.bestSan).replace(/[+#]+$/, ''))) ? [before, after] : [after, before]);
    const links = [];
    rv.links = links;
    $('#rvCoach').querySelectorAll('.rv-coach p, .rv-lines span').forEach((el) => {
      const lineStart = el.tagName === 'SPAN' ? after : null; // an engine line starts in the position on the board
      let cur = lineStart, prev = '';
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
      let x;
      while ((x = walker.nextNode())) nodes.push(x);
      nodes.forEach((node) => {
        const parts = node.data.split(/(\s+)/), frag = document.createDocumentFragment();
        let any = false, plain = ''; // the text between the links, kept in one piece
        parts.forEach((part) => {
          const w = /\S/.test(part) ? part.replace(/^[(\[„"]+|[)\],.;:!?“"]+$/g, '').replace(/[+#]+$/, '') : ''; // the spaces between words are no word
          let hit = null;
          if (w && /\d|O-O/.test(w) && !/^(on|auf|von|from|to|nach)$/i.test(prev)) {
            if (cur && sanMap(cur)[w]) hit = sanMap(cur)[w];
            else for (const st of (lineStart && !links.length ? [lineStart] : firsts(w))) { if (st && sanMap(st)[w]) { hit = sanMap(st)[w]; break; } }
          }
          if (/\S/.test(part)) prev = w;
          if (hit) {
            any = true;
            const i = part.indexOf(w);
            let end = i + w.length;
            while (part[end] === '+' || part[end] === '#') end++; // the check sign belongs to the move
            const a = h('span', 'mvlink' + (rvPeek() && rv.peek.id === links.length ? ' on' : ''), part.slice(i, end));
            a.dataset.mv = links.length;
            links.push(hit);
            cur = hit.n;
            plain += part.slice(0, i);
            if (plain) frag.appendChild(document.createTextNode(plain));
            frag.appendChild(a);
            plain = part.slice(end);
          } else {
            if (w) cur = null; // any other word ends the line
            plain += part;
          }
        });
        if (plain) frag.appendChild(document.createTextNode(plain));
        if (any) node.parentNode.replaceChild(frag, node);
      });
    });
  }

  function renderStepView() {
    const k = G.view, rec = rv.evals[k], p = k > 0 ? rv.plies[k - 1] : null, tr = rv.trial, C = Review.CLASSES;
    if (p && !tr) coachFor(k - 1);
    let badge = '', title, text, evTxt = Review.fmt(tr ? tr.ev : rec.ev), acts = '';
    const btn = (id, label, cls) => '<button class="btn ' + (cls || '') + '" id="' + id + '">' + label + '</button>';
    if (tr) {
      const base = rv.evals[tr.base], bl = rv.bestLine[tr.base];
      if (tr.kind === 'best') {
        badge = badgeHtml('best'); title = 'Best was ' + tr.san;
        text = 'This was the strongest move in the position. ' + Review.standing(base.ev);
      } else if (tr.pending) {
        title = 'Checking ' + tr.san; text = 'The engine is looking at your move.';
      } else {
        const c = C[tr.cls];
        badge = badgeHtml(tr.cls); title = tr.san + ': ' + c.label;
        if (tr.cls === 'best') text = tr.san + ' is the best move here. Well found.';
        else if (tr.cls === 'excellent' || tr.cls === 'good') text = tr.san + ' works too.' + (bl && bl.san !== tr.san ? ' The engine prefers ' + bl.san + ' by a small margin.' : '');
        else text = tr.san + ' is not it.' + (bl ? ' There is something clearly stronger.' : '');
        text += ' ' + Review.standing(tr.ev);
      }
      acts = btn('rvBack', tr.kind === 'try' && !tr.pending && tr.cls !== 'best' && rv.retry === tr.base ? 'Try again' : 'Back to the game');
      if (tr.kind === 'try' && bl) acts += btn('rvShowBest', 'Show best');
    } else if (rv.retry === k && k < rv.plies.length) {
      const q = rv.plies[k];
      title = 'Your turn to find it';
      text = 'In the game ' + q.san + ' was played here. Make a better move on the board.';
      acts = (rv.bestLine[k] ? btn('rvShowBest', 'Show best') : '') + btn('rvSkip', 'Back to ' + q.san);
    } else if (!p) {
      title = 'Starting position';
      text = (rv.opening.name ? 'This game went into the ' + rv.opening.name + '. ' : '') + 'Step through the moves with the arrows. In any position you can also try a move of your own on the board.';
    } else {
      badge = p.cls ? badgeHtml(p.cls) : '';
      title = moveLabel(k - 1) + (p.cls ? ': ' + C[p.cls].label : '');
      // the engine's best answer to the move: what it caused, for the words when the coach found nothing sharper
      if (!p.replyLine && WEAK[p.cls] && rec && rec.pv && rec.pv.length) { try { p.replyLine = pvSan(k, rec.pv).slice(0, 5); } catch (e) { p.replyLine = []; } }
      text = p.special === 'roll' ? (p.by === 'w' ? 'White' : 'Black') + ' rolled ' + p.roll.map(pieceName).join(', ') + (p.wasted ? ': nothing could move, the turn ' + (rv.game.cfg.dice3 ? 'was lost.' : 'had to be thrown again.') : '.') : Review.comment(p.dice ? Object.assign({}, p, { after: rv.evals[p.idx + 1].ev }) : p, rv.opening.name); // Dice Chess: the words follow the number shown, the average over the coming throw
      if (p.odds) text += ' ' + p.odds;
      if (p.tbAfter) {
        const mover = p.by === 'w' ? 'White' : 'Black', other = p.by === 'w' ? 'Black' : 'White', ev = rv.evals[p.idx + 1].ev;
        text += ' The endgame table is certain: ' + (p.tbAfter === 'draw' ? 'a draw with correct play.' : (ev.mate > 0) === (p.by === 'w') ? mover + ' mates in ' + Math.abs(ev.mate) + ' against best defence.' : other + ' wins by force, mate in ' + Math.abs(ev.mate) + '.');
      }
      if (rv.why && rv.why[k - 1] && !rv.why[k - 1].done) text += ' <em class="dim">The coach is working out the details.</em>';
      const weak = p.cls === 'inaccuracy' || p.cls === 'mistake' || p.cls === 'miss' || p.cls === 'blunder';
      if (rv.bestLine[k - 1] && p.played !== p.best && !p.special) acts += btn('rvShowBest', 'Show best');
      if (weak && !p.special) acts += btn('rvRetry', 'Retry');
    }
    let lines = '';
    if (!tr && rec.pv && rec.pv.length) {
      if (!rec.sans) rec.sans = [pvSan(k, rec.pv), rec.pv2.length ? pvSan(k, rec.pv2) : []];
      [[rec.ev, rec.sans[0]], [rec.second, rec.sans[1]]].forEach((l) => {
        if (!l[0] || !l[1].length) return;
        lines += '<div class="rv-line"><b class="' + (Review.whiteChance(l[0]) >= 0.5 ? '' : 'dk') + '">' + Review.fmt(l[0]) + '</b><span>' + l[1].join(' ') + '</span></div>';
      });
    }
    $('#rvCoach').innerHTML = '<div class="rv-coach">' + badge + '<div><b>' + title + '</b><p>' + text + '</p></div><span class="rv-ev">' + evTxt + '</span></div>' +
      (acts ? '<div class="rv-actions">' + acts + '</div>' : '') + (lines ? '<div class="rv-lines">' + lines + '</div>' : '') + graphHtml();
    wireGraph();
    if (!tr) { const box = $('#rvCoach').firstChild; setTimeout(() => { if (box && box.isConnected) rvLinkMoves(k, p); }, 0); } // after the translation has run
    const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
    on('rvBack', () => { rv.trial = null; renderAll(); });
    on('rvSkip', () => { rv.retry = null; gotoView(k + 1); });
    on('rvRetry', () => { gotoView(k - 1); rv.retry = k - 1; renderAll(); });
    on('rvShowBest', () => {
      const i = tr ? tr.base : (rv.retry === k ? k : k - 1), bl = rv.bestLine[i];
      if (!bl) return;
      if (G.view !== i) { G.view = i; }
      rv.retry = null;
      rv.trial = { base: i, state: bl.state, m: bl.m, san: bl.san, kind: 'best', pending: false, cls: 'best', ev: rv.evals[i].ev };
      ui.sel = null;
      renderAll();
    });

    // move list with the ratings
    const box = $('#rvList'), rows = [];
    let row = null, lastBy = null, no = G.moveNo;
    G.log.forEach((e, i) => {
      if (e.by !== lastBy) {
        if (e.by === 'w' || !row) { row = { no: no++, w: [], b: [] }; rows.push(row); }
        lastBy = e.by;
      }
      row[e.by].push(i);
    });
    box.innerHTML = '';
    rows.forEach((r) => {
      const el = h('div', 'mrow');
      el.appendChild(h('div', 'no', r.no + '.'));
      ['w', 'b'].forEach((c) => {
        const cell = h('div', 'cell');
        if (c === 'w' && !r.w.length) cell.textContent = '...';
        r[c].forEach((i) => {
          const q = rv.plies[i];
          const e = G.log[i];
          const b = h('button', 'mv' + (G.view === i + 1 ? ' on' : '') + (e.roll ? ' rollmv' + (e.wasted ? ' wasted' : '') : ''), (q && q.cls ? badgeHtml(q.cls, 'xs') : '') + e.san);
          if (e.roll) { e.roll.forEach((t) => b.appendChild(paint(h('i', 'mdie'), e.by === 'w' ? t.toUpperCase() : t, null, null))); b.title = 'Rolled ' + e.roll.map(pieceName).join(', ') + (e.wasted ? ': nothing could move' : ''); }
          b.onclick = () => gotoView(i + 1);
          cell.appendChild(b);
        });
        el.appendChild(cell);
      });
      box.appendChild(el);
    });
    const onEl = box.querySelector('.mv.on');
    if (onEl) onEl.scrollIntoView({ block: 'nearest' });
  }

  // A move made on the review board: play it on a side board and let the engine judge it.
  function tryMove(m) {
    const base = G.view, s = G.states[base], lg = rvLegal(base), rec = rv.evals[base], game = G, my = rv;
    const n = G.B.play(s, m), san = G.B.san(s, m, lg, n), uci = my.byBrain ? moveKey(m) : G.B.uci(m), isBest = !!uci && uci === rec.best;
    const tr = rv.trial = { base: base, state: n, m: m, san: san, kind: 'try', pending: !isBest, cls: isBest ? 'best' : null, ev: rec.ev };
    ui.sel = null;
    moveSound(m, n.fx, G.B.checks(n).length > 0);
    renderAll(n.fx ? moveAnims(s, m, n.fx) : null);
    if (isBest) return;
    const done = (ev) => {
      if (rv !== my || my.trial !== tr) return;
      tr.pending = false;
      if (ev && ev.cp != null && matScale(n) !== 1) ev = Object.assign({}, ev, { k: matScale(n) }); // weighed like the review's own verdicts
      tr.ev = ev;
      tr.cls = Review.gradeLoss(Math.max(0, Review.chanceFor(rec.ev, s.turn) - Review.chanceFor(ev, s.turn)), false);
      renderAll();
    };
    const lg2 = G.B.legal(n), st = G.B.status(n, lg2);
    if (st.over) { done({ win: st.result }); return; }
    if (my.byBrain) {
      evalBrain.think(n, brainCfg(game.cfg, n.turn, true), { ms: 900, margin: 0, allow: lg2.map(moveKey), free: true }).then((res) => {
        if (res && res.actions && res.actions.length) done(evWhite(brainInfo(res).score, n.turn) || rec.ev);
      });
      return;
    }
    const only = G.B.searchmoves(n, lg2, true);
    if (only && !only.length) { done(rec.ev); return; }
    engineFor(game).then((E) => {
      if (!E || rv !== my || my.trial !== tr) return null;
      return E.search({ position: 'fen ' + G.B.fen(n), go: 'movetime 900' + (only ? ' searchmoves ' + only.join(' ') : ''), options: Object.assign(variantOpts(game, E), FULL) });
    }).then((r) => { if (r && !r.cancelled) done(evWhite(r.score, n.turn) || rec.ev); });
  }
  // Moves on the board go to the game, or to the review's side board.
  /* The Shotgun King in a normal game plays as in the Game Mode: select it, the cone follows the mouse, a click on a
     square it can step to (or capture on) moves it, a click on any other square fires there. In check only a shot
     at the piece giving check is allowed (the rules list those). */
  function sgArmed() {
    if (!G || mode() !== 'game' || !ui.sel || ui.sel.sq < 0 || ui.sel.duck || !canAct()) return false;
    const s = live(), p = s.board[ui.sel.sq], d = p && R.fairyOf(p);
    return !!(d && d.shotgun && s.sg && s.sg[s.turn] && R.colorOf(p) === s.turn);
  }
  // the shot a click on q would fire, or null
  function sgShotTo(q) {
    const s = live(), from = ui.sel.sq;
    if (q < 0 || q === from || ui.sel.moves.some((m) => m.to === q && !m.shot)) return null;
    const legal = ui.sel.moves.find((m) => m.shot && m.to === q);
    if (legal) return legal;
    if (!(s.sg[s.turn][0] > 0) || G.B.checks(s).length) return null; // in check: only the listed shots
    if (s.board[q] && R.colorOf(s.board[q]) === s.turn) return null; // not at its own pieces
    return { from: from, to: q, piece: s.board[from], cap: '', capSq: -1, shot: true };
  }
  function dispatch(m) {
    if (mode() === 'puzzle') pzMove(m);
    else if (mode() === 'analysis') analysisMove(m);
    else if (reviewing() && rv.status === 'step') tryMove(m);
    else applyMove(m);
  }
  function nextKey() {
    for (let i = G.view; i < rv.plies.length; i++) {
      if (rv.plies[i].cls && Review.KEY[rv.plies[i].cls]) { gotoView(i + 1); return; }
    }
    toast('No more key moves after this one');
  }

  /* ---------- analysis board ---------- */

  let A = null; // { B, W, H, glyphs, cfg, engine, uci, c960, custom, vname, std, root, cur, legal, lines, depth, on, multipv, arrows, term, paused, searching }
  let aNodeId = 0, aTimer = 0;
  const AN_LINES = [[1, '1 line'], [2, '2 lines'], [3, '3 lines'], [5, '5 lines']];

  function aNode(parent, state, m, san, by) {
    return { id: ++aNodeId, parent: parent, children: [], state: state, m: m || null, san: san || '', by: by || null };
  }
  function canAnalyse() { return mode() === 'analysis' && !ui.overlay && !A.term && A.legal.length > 0; }
  function curB() { return mode() === 'analysis' ? A.B : mode() === 'puzzle' ? pz.cur.B : G.B; }
  function curGlyphs() { return mode() === 'analysis' ? A.glyphs : mode() === 'puzzle' ? {} : G.glyphs; }
  function fullmoveOf(s) { return s.full != null ? s.full : (parseInt(String(s.fen).split(' ').pop(), 10) || 1); }
  function barEv(e) {
    if (e.win) return e.win === 'draw' ? { cp: 0, mate: null, depth: 0 } : { cp: null, mate: 0, lost: R.other(e.win), depth: 0 };
    return e.mate != null ? { cp: null, mate: e.mate, depth: 0 } : { cp: e.cp, mate: null, depth: 0 };
  }

  function setAnalysis(a) {
    const old = A;
    A = Object.assign({ lines: [], depth: 0, on: old ? old.on : true, multipv: old ? old.multipv : 3, arrows: old ? old.arrows : true, term: null, paused: false, searching: false }, a);
    if (old) release(old.B);
    ui.sel = null; ui.arrows = []; ui.marks = [];
    aGoto(A.cur || A.root);
  }
  // The finished (or loaded) game becomes the main line, the board opens on the move you were looking at.
  function analyseGame() {
    if (!G || !G.log.length) { toast('There is no game to analyse yet'); return; }
    if (!G.over) { toast('Finish the game first, the engine cannot do both at once'); return; }
    const root = aNode(null, G.states[0]);
    let node = root, cur = root;
    G.log.forEach((e, i) => {
      const c = aNode(node, G.states[i + 1], e.m, e.san, e.by);
      node.children.push(c);
      if (i + 1 === G.view) cur = c;
      node = c;
    });
    setAnalysis({
      B: G.B, W: G.W, H: G.H, glyphs: G.glyphs, cfg: G.cfg, bo: G.bo, variantGame: G.variantGame, engine: G.engine, uci: G.uci, c960: G.c960, custom: G.custom,
      vname: G.variantGame ? G.vname : '', std: G.B.kind === 'std' && !G.B.powers, root: root, cur: cur, title: nameOf(G, 'w') + ' against ' + nameOf(G, 'b'),
      fromGame: G // the way back to its end screen
    });
    setTab('analysis');
  }
  // A fresh board: the start position of the chosen variant, or any FEN.
  async function analyseFresh(fen, plain) {
    const V = plain ? Fairy.byId('chess') : Fairy.byId(setup.variant); // plain = standard chess, whatever variant is selected
    try {
      if (stdVariant(V.id) || V.checkers) {
        const cfg = { side: 'w', freeArmy: setup.engine === 'fairy' || !!V.checkers || !!V.duckChess, checkers: !!V.checkers };
        if (V.duckChess) { cfg.duckChess = true; cfg.kingCapture = true; cfg.terrain = { walls: [], water: [], portals: [], holes: [], ducks: [], bducks: [] }; } // a fresh Duck Chess board: the duck in hand
        let s0 = R.fromFen(fen || (V.checkers ? V.fen : R.START_FEN), cfg);
        if ((s0.W || 8) !== 8 || (s0.H || 8) !== 8) cfg.freeArmy = true;
        let errs = R.validate(s0, cfg), kind = V.checkers ? 'fairy' : setup.engine;
        if (errs.length && !cfg.freeArmy) { cfg.freeArmy = true; kind = 'fairy'; errs = R.validate(s0, cfg); } // Stockfish refuses it, Fairy-Stockfish may not
        if (errs.length) throw new Error(errs[0]);
        const B = stdBackend(cfg, R.toFen(s0));
        setAnalysis({ B: B, W: B.W, H: B.H, glyphs: {}, cfg: cfg, engine: kind, uci: 'chess', c960: false, custom: null, vname: V.checkers ? V.name : '', std: !B.big && !V.checkers, root: aNode(null, B.initial()), title: fen ? 'Custom position' : V.checkers ? V.name : 'Start position' });
      } else {
        const ff = await Fairy.rules();
        let uci = V.uci || V.id, start = V.fen, glyphs = V.glyphs || {}, cust = null;
        if (V.id === 'custom') {
          if (!custom) custom = await Fairy.loadCustom(setup.customIni);
          cust = custom; uci = cust.uci; start = cust.fen; glyphs = cust.glyphs;
        }
        if (fen) {
          if (ff.validateFen(fen, uci, !!V.c960) !== 1) throw new Error('That is not a valid position for ' + V.name);
          start = fen;
        } else if (V.c960) {
          const b0 = new ff.Board(uci, Fairy.random960(), true);
          start = b0.fen();
          b0.delete();
        }
        const cfg = { side: 'w' };
        const B = Fairy.backend(ff, { uci: uci, c960: !!V.c960, startFen: start, cfg: cfg, hand: ff.capturesToHand(uci), special: !!V.special, nocheck: !!V.nocheck, boom: !!V.boom, keepCastle: !!V.keepCastle });
        setAnalysis({ B: B, W: B.W, H: B.H, glyphs: glyphs, cfg: cfg, engine: 'fairy', uci: uci, c960: !!V.c960, custom: cust, vname: cust ? cust.title : V.name, std: false, root: aNode(null, B.initial()), title: cust ? cust.title : V.name });
      }
    } catch (e) { toast(e.message || 'The position could not be loaded'); return false; }
    renderAll();
    return true;
  }

  // Pasted text: a FEN, or a PGN whose main line is replayed (standard chess only).
  function parsePgn(text) {
    const fm = /\[FEN\s+"([^"]+)"\]/i.exec(text);
    let body = text.replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' '), depth = 0, flat = '';
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (!depth) flat += ch;
    }
    const sans = flat.split(/\s+/).map((t) => t.replace(/^\d+\.+/, '').replace(/[!?]+$/, ''))
      .filter((t) => t && !/^\$\d+$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t) && !/^\d+\.*$/.test(t))
      .map((t) => t.replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O').replace(/[+#]/g, ''));
    return { fen: fm ? fm[1] : null, sans: sans };
  }
  async function analyseText(text) {
    text = String(text || '').trim();
    if (!text) return;
    const first = text.split(/\s+/)[0];
    if (first.indexOf('/') > 0 && !/\[\w+\s+"/.test(text)) { if (await analyseFresh(text)) toast('Position loaded'); return; }
    if (!stdVariant(setup.variant)) { toast('A PGN can only be loaded for standard chess. Pick Standard chess under New Game, Variant first.'); return; }
    const pg = parsePgn(text);
    if (!pg.sans.length) { toast('No moves found in that text'); return; }
    if (!(await analyseFresh(pg.fen))) return;
    let node = A.root, n = 0;
    for (const want of pg.sans) {
      const s = node.state, lg = A.B.legal(s);
      let hit = null;
      for (const m of lg) {
        const after = A.B.play(s, m), san = A.B.san(s, m, lg, after);
        if (san.replace(/[+#]/g, '') === want) { hit = aNode(node, after, m, san, s.turn); break; }
      }
      if (!hit) { toast('Loaded ' + n + ' moves, then "' + want + '" did not fit'); break; }
      node.children.push(hit);
      node = hit; n++;
    }
    A.title = 'Imported game';
    aGoto(A.root.children.length ? A.root.children[0] : A.root);
    if (n === pg.sans.length) toast(n + ' moves loaded');
  }

  function aGoto(node) {
    if (!A || !node) return;
    A.cur = node;
    A.legal = A.B.legal(node.state);
    ui.sel = null; ui.hintArrow = null;
    closeOverlay();
    renderAll();
    runAnalysis();
  }
  function analysisMove(m) {
    const s = A.cur.state, key = moveKey(m);
    let child = A.cur.children.find((c) => c.m && moveKey(c.m) === key);
    if (!child) {
      const n = A.B.play(s, m);
      child = aNode(A.cur, n, m, A.B.san(s, m, A.legal, n), s.turn);
      A.cur.children.push(child);
    }
    const fx = child.state.fx;
    moveSound(m, fx, A.B.checks(child.state).length > 0);
    A.cur = child;
    A.legal = A.B.legal(child.state);
    ui.sel = null;
    renderAll(fx ? moveAnims(s, m, fx) : null);
    if (m.shot && fx) shotFx(s, child.state, fx);
    runAnalysis();
  }
  // The analysis board: a throw becomes a position of its own in the tree, like a move.
  function analysisRoll() {
    const s = A.cur.state;
    if (!A.B.unrolled || !A.B.unrolled(s)) return;
    const faces = A.B.rollFaces(s), n = A.B.roll(s, faces);
    if (!n) return;
    const child = aNode(A.cur, n, null, '', s.turn);
    child.roll = faces;
    A.cur.children.push(child);
    A.cur = child;
    A.legal = A.B.legal(n);
    snd('diestop');
    if (n.wasted) toast('Nothing can move with that throw');
    renderAll();
    runAnalysis();
  }
  function aMainEnd(node) { while (node.children.length) node = node.children[0]; return node; }
  function aDelete() {
    const n = A.cur;
    if (!n.parent) { toast('The start position cannot be deleted'); return; }
    n.parent.children.splice(n.parent.children.indexOf(n), 1);
    aGoto(n.parent);
  }
  // Make the line you are in the main line of its branch point.
  function aPromote() {
    let n = A.cur;
    while (n.parent && n.parent.children[0] === n) n = n.parent;
    if (!n.parent) { toast('This already is the main line'); return; }
    const list = n.parent.children;
    list.splice(list.indexOf(n), 1);
    list.unshift(n);
    renderAll();
  }

  /* Engine lines for the position on the board. Paused while a game or a review needs the engine. */
  function runAnalysis() {
    if (!A) return;
    const my = A, node = A.cur, s = node.state;
    A.lines = []; A.depth = 0;
    const st = A.B.status(s, A.legal);
    A.term = st.over ? st : null;
    A.paused = !!((G && !G.over) || (rv && rv.status === 'run'));
    const want = A.on && !A.term && !A.paused && ui.tab === 'analysis';
    const only = want ? A.B.searchmoves(s, A.legal, true) : null;
    if (!want || (only && !only.length)) {
      if (A.searching) { A.searching = false; stopEngines(); }
      renderAnalysis(); renderEval(); renderArrows();
      return;
    }
    A.searching = true;
    renderAnalysis();
    if (brainGame(A.B, A.cfg)) {
      // Power-ups on the board: the power-up search gives the lines, first quickly, then with more time.
      A.brain = true;
      const allow = A.legal.map(moveKey), scfg = brainCfg(A.cfg, s.turn, true);
      const round = (ms) => evalBrain.think(s, scfg, { ms: ms, margin: 400, allow: allow, free: true }).then((res) => {
        if (!res || !res.actions || A !== my || A.cur !== node || ui.tab !== 'analysis' || !A.on) return false;
        const lg = A.legal;
        A.lines = res.actions.map((a) => ({ a: a, act: keyToAct(a.key, lg) })).filter((x) => actFits(A, s, lg, x.act)).slice(0, A.multipv)
          .map((x) => ({ ev: evWhite(brainInfo({ score: x.a.score, depth: res.depth }).score, s.turn), pv: [], depth: res.depth, act: x.act, sans: [actLabel(A.B, s, lg, x.act)] }));
        A.depth = res.depth;
        renderLines(); renderEval(); renderArrows();
        return true;
      });
      evalBrain.stop();
      round(500).then((ok) => (ok ? round(4000) : false)).then(() => { if (A === my && A.cur === node) { A.searching = false; renderLines(); } });
      return;
    }
    A.brain = false;
    // a variant with power-ups: the engine's lines get the same power-up correction as the eval bar
    const fix = A.variantGame && A.B.powers && A.bo ? powerDelta(A, s, 350).catch(() => null) : Promise.resolve(null);
    Promise.all([engineByKind(A.engine), fix]).then((got) => {
      const E = got[0], d = got[1];
      if (!E || A !== my || A.cur !== node || ui.tab !== 'analysis' || !A.on) return;
      const adjust = (ev) => (!d || !ev ? ev : d.mate != null ? { mate: d.mate } : ev.cp != null ? { cp: ev.cp + d.cp } : ev);
      E.search({
        position: 'fen ' + A.B.fen(s), go: 'movetime 20000' + (only ? ' searchmoves ' + only.join(' ') : ''),
        options: Object.assign(variantOpts(A, E), FULL, { MultiPV: A.multipv }),
        onLine: (rank, entry) => {
          if (A !== my || A.cur !== node) return;
          A.lines[rank - 1] = { ev: adjust(evWhite(entry.score, s.turn)), pv: entry.pv, depth: entry.depth, sans: null };
          if (rank === 1) A.depth = entry.depth;
          if (!aTimer) aTimer = setTimeout(() => { aTimer = 0; if (A === my && ui.tab === 'analysis') { renderLines(); renderEval(); renderArrows(); } }, 220);
        }
      }).then(() => { if (A === my && A.cur === node) { A.searching = false; renderLines(); } });
    });
  }
  function aPvSan(ucis) {
    let s = A.cur.state, lg = A.legal;
    const out = [];
    for (let k = 0; k < Math.min(ucis.length, 9); k++) {
      const m = A.B.find(lg, ucis[k]);
      if (!m) break;
      const n = A.B.play(s, m);
      out.push(A.B.san(s, m, lg, n));
      s = n; lg = A.B.legal(n);
    }
    return out;
  }

  function renderLines() {
    const box = $('#anLines');
    if (!box || !A) return;
    box.innerHTML = '';
    let head = A.on ? (A.paused ? 'Paused while a game or a review uses the engine' : A.term ? 'Game over in this position' : (A.brain ? 'Power-up search' : A.engine === 'fairy' ? 'Fairy-Stockfish' : 'Stockfish 19') + ', depth ' + (A.depth || 0) + (A.searching ? '' : ', done'))
      : 'Engine off';
    $('#anDepth').textContent = head;
    if (A.term) {
      const t = A.term, who = t.result === 'draw' ? 'Draw' : (t.result === 'w' ? 'White' : 'Black') + ' wins';
      box.appendChild(h('div', 'rv-line', '<b>' + (t.result === 'draw' ? '½-½' : t.result === 'w' ? '1-0' : '0-1') + '</b><span>' + who + ' by ' + (t.reason === 'variant' ? 'the variant rule' : t.reason === 'drawrule' ? 'a draw rule' : t.reason) + '</span>'));
      return;
    }
    if (!A.on || A.paused) return;
    A.lines.forEach((l) => {
      if (!l) return;
      if (!l.sans) l.sans = aPvSan(l.pv);
      const row = h('button', 'rv-line an-line', '<b class="' + (Review.whiteChance(l.ev) >= 0.5 ? '' : 'dk') + '">' + Review.fmt(l.ev) + '</b><span>' + l.sans.join(' ') + '</span>');
      const lm = l.act ? l.act.m : A.B.find(A.legal, l.pv[0]);
      row.title = lm ? 'Play the first move of this line' : 'A free power-up action, it cannot be played on this board';
      row.onclick = () => { if (lm) analysisMove(lm); };
      box.appendChild(row);
    });
  }

  function treeInto(box) {
    const add = (node, into, numbered) => {
      const no = fullmoveOf(node.parent.state), sameSide = node.parent.by === node.by;
      let label = '';
      if (!sameSide && node.by === 'w') label = no + '. ';
      else if (!sameSide && numbered) label = no + '... ';
      const b = h('button', 'tm' + (node === A.cur ? ' on' : ''), label + node.san);
      b.onclick = () => aGoto(node);
      into.appendChild(b);
    };
    const walk = (node, into, numbered) => {
      let cur = node;
      while (cur.children.length) {
        const main = cur.children[0];
        add(main, into, numbered);
        numbered = false;
        if (cur.children.length > 1) {
          cur.children.slice(1).forEach((alt) => {
            const v = h('span', 'tv');
            v.appendChild(document.createTextNode('('));
            add(alt, v, true);
            walk(alt, v, false);
            v.appendChild(document.createTextNode(')'));
            into.appendChild(v);
          });
          numbered = true;
        }
        cur = main;
      }
    };
    box.innerHTML = '';
    if (!A.root.children.length) { box.appendChild(h('div', 'sub', 'Make a move on the board. Every move you try is kept as a line you can come back to.')); return; }
    walk(A.root, box, true);
    const on = box.querySelector('.tm.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function aPgn() {
    const txt = (node, numbered) => {
      let out = '', cur = node;
      const one = (n, num) => {
        const no = fullmoveOf(n.parent.state), same = n.parent.by === n.by;
        return (!same && n.by === 'w' ? no + '. ' : (!same && num ? no + '... ' : '')) + n.san + ' ';
      };
      while (cur.children.length) {
        const main = cur.children[0];
        out += one(main, numbered);
        numbered = false;
        if (cur.children.length > 1) {
          cur.children.slice(1).forEach((alt) => { out += '(' + (one(alt, true) + txt(alt, false)).trim() + ') '; });
          numbered = true;
        }
        cur = main;
      }
      return out;
    };
    const start = A.B.fen(A.root.state);
    let head = '[Event "Power Chess analysis"]\n';
    if (A.vname) head += '[Variant "' + A.vname + '"]\n';
    if (start !== R.START_FEN) head += '[SetUp "1"]\n[FEN "' + start + '"]\n';
    return head + '\n' + txt(A.root, true).trim() + ' *';
  }

  function renderAnalysis() {
    const start = $('#anStart'), main = $('#anMain');
    start.classList.toggle('off', !!A);
    main.classList.toggle('on', !!A);
    if (!A) {
      const V = Fairy.byId(setup.variant);
      $('#anFromGame').disabled = !G || !G.over || !G.log.length;
      $('#anFromGame').textContent = G && G.log.length ? (G.over ? 'Analyse the game on the board' : 'Finish the running game to analyse it') : 'No game to analyse yet';
      $('#anFromStart').textContent = 'Start position: ' + (V.id === 'custom' && custom ? custom.title : V.name);
      $('#anFromEditor').style.display = stdVariant(V.id) ? '' : 'none';
      return;
    }
    $('#anTitle').textContent = A.title + (A.vname && A.title !== A.vname ? ', ' + A.vname : '');
    $('#anBack').style.display = A.fromGame && A.fromGame === G && G.over ? '' : 'none';
    $('#anReview').style.display = A.fromGame && A.fromGame === G && G.over && rv && rv.game === G ? '' : 'none';
    $('#anOn').classList.toggle('on', A.on);
    seg($('#anMulti'), AN_LINES, A.multipv, (v) => { A.multipv = v; runAnalysis(); });
    renderLines();
    // pockets of the side to move, for variants with drops
    const s = A.cur.state, info = $('#anInfo');
    info.innerHTML = '';
    if (ui.info != null && A.B.kind === 'std' && s.board[ui.info]) info.appendChild(pieceCard(s.board[ui.info], A.cfg, s));
    if (A.B.dice && (s.dice || s.rolled || (A.B.unrolled && A.B.unrolled(s)))) info.appendChild(diceRow(s, s.turn === 'w' ? 'White' : 'Black', { B: A.B, legal: A.legal, cfg: A.cfg, canRoll: !!(A.B.unrolled && A.B.unrolled(s)) && !A.term, analysis: true, id: 'diceBoxA' }));
    const tpw = pwOf(A.cfg, s.turn);
    const letters = s.pockets ? s.pockets[s.turn] : (tpw && tpw.drops ? (A.B.kind === 'std' ? s[R.pocketKey(A.cfg, s.turn)] : s.pocket) : []);
    if (letters && letters.length) info.appendChild(pocketRow('Pocket', letters, s.turn, true, canAnalyse(), A.legal, A.glyphs));
    if (A.std) {
      const sans = [];
      for (let n = A.cur; n.parent; n = n.parent) sans.unshift(n.san);
      const op = Review.opening(sans);
      if (op.name) info.appendChild(h('div', 'rv-open', 'Opening: <b>' + op.name + '</b>'));
    }
    treeInto($('#anTree'));
    $('#anArrows').classList.toggle('on', A.arrows);
    $('#anPlay').disabled = !A.std;
  }

  /* ---------- board input ---------- */

  function select(sq) {
    const list = mode() === 'analysis' ? A.legal : mode() === 'puzzle' ? pz.cur.legal : canTry() ? rvLegal(G.view) : G.legal;
    const own = list.filter((m) => !m.drop && !m.duck && !m.reload && m.from === sq);
    // a vest going up is never a click on a square: only a double click or the Detonate button set it off
    ui.sel = { sq: sq, moves: own.filter((m) => !m.blast), blast: own.find((m) => m.blast) || null };
  }
  /* Spiked Helmet and Explosive Vest on a piece of the board: a small helmet on top, a belt of dynamite below. */
  function wearOn(el, s, sq) {
    if (s.helmets && s.helmets.indexOf(sq) >= 0) el.appendChild(h('i', 'wear helmet'));
    if (s.vests && s.vests.indexOf(sq) >= 0 && s.gold.indexOf(sq) < 0) el.appendChild(h('i', 'wear vest'));
  }
  // The 3 x 3 square a vest on sq would take with it (on the board in view).
  function blastZone(s, sq) {
    const W = s.W || 8, H = s.H || 8, r = Math.floor(sq / W), c = sq % W, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < H && cc >= 0 && cc < W) out.push(rr * W + cc); }
    return out;
  }
  // Set off the vest of the piece on sq, in the game, the analysis or a puzzle. true when it went up.
  function blastAt(sq) {
    const md = mode(), list = md === 'puzzle' ? (pzCanMove() ? pz.cur.legal : null) : md === 'analysis' ? (canAnalyse() ? A.legal : null) : canAct() ? G.legal : null;
    const m = list && list.find((x) => x.blast && x.from === sq);
    if (!m) return false;
    ui.sel = null;
    dispatch(m);
    return true;
  }
  /* The duck part of a turn: the duck to move is in hand already, a duck waiting off the board (Duck Chess) or the
     only yellow duck left, so one click on a free square places it. */
  function duckAuto(s, list) {
    if (!s || !s.duckPhase || (ui.sel && ui.sel.duck)) return;
    const y = list.filter((m) => m.duck === 'y');
    if (!y.length) return;
    const from = y[0].from;
    if (from >= 0 && y.some((m) => m.from !== from)) return; // several yellow ducks: the player picks one
    ui.sel = { sq: from, moves: y.filter((m) => m.from === from), duck: true };
  }
  function commit(cands) {
    if (cands.some((c) => c.swap)) { showChooser(cands); return; } // asked first: a click on your own rook is easily meant as a selection
    if (cands.length === 1) { dispatch(cands[0]); return; }
    if (cands.some((c) => c.promo)) {
      const queen = cands.find((c) => c.promo === 'q');
      if (settings.autoQueen && queen) dispatch(queen);
      else if (curB().kind === 'fairy') showPromoRow(cands);
      else showPromo(cands);
      return;
    }
    if (cands.some((c) => c.snipe || c.shot)) { showChooser(cands); return; }
    dispatch(cands[0]);
  }

  board.addEventListener('contextmenu', (e) => e.preventDefault());
  /* Touch: a long press is the right button (a mark, or with a drag an arrow; it also drops the premoves), two taps on
     one square are a double click. A Shotgun King aims while the finger is down and acts when it lifts. */
  const touch = { lp: null, last: { sq: -1, t: 0 }, aim: null };
  board.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.picker,.chooser,.rowpick,#endcard,.handoffcard')) return; // cards over the board take their own clicks
    if (rvPeek()) { rv.peek = null; renderAll(); return; } // a move shown from the review's words: a click on the board goes back
    const sq = evSq(e);
    if (sq < 0) return;
    if (e.pointerType === 'touch' && e.button === 0) {
      if (ui.tab === 'modes' && gmTab === 'pb') { pbUi.hover = sq; pbHoverInfo(); modesDown(sq); return; }
      if (ui.tab === 'modes' && gmTab === 'sk') { touch.aim = 'sk'; skUi.hover = sq; renderArrows(); skHoverInfo(); return; }
      if (ui.tab === 'editor') { touch.lp = null; touch.last = { sq: -1, t: 0 }; editorDown(sq, e); return; } // no marks or double taps here: a held piece is a drag
      const now = performance.now();
      if (touch.last.sq === sq && now - touch.last.t < 330) { touch.last.t = 0; if (dblAt(sq)) return; }
      touch.last = { sq: sq, t: now };
      if (touch.lp) clearTimeout(touch.lp.timer);
      const lp = touch.lp = { sq: sq, x: e.clientX, y: e.clientY, fired: false };
      lp.timer = setTimeout(() => {
        if (touch.lp !== lp) return;
        lp.fired = true;
        if (window.PWA) PWA.buzz('select');
        if (ui.drag) { const d = ui.drag; ui.drag = null; if (d.el) { d.el.classList.remove('dragging'); d.el.style.transform = d.tf0 || ''; } }
        if (ui.premoves.length) { ui.premoves = []; ui.sel = null; lp.done = true; renderAll(); return; }
        ui.sel = null; ui.rc = lp.sq; renderAll();
      }, 450);
    }
    if (e.button === 2) {
      if (ui.premoves.length) { ui.premoves = []; ui.sel = null; ui.rc = -1; renderAll(); return; }
      ui.rc = sq;
      return;
    }
    if (e.button !== 0) return;
    ui.dropFrom = -1;
    if (ui.overlay) { closeOverlay(); ui.sel = null; renderAll(); return; }
    if (ui.arrows.length || ui.marks.length) { ui.arrows = []; ui.marks = []; renderBoard(); }
    if (ui.tab === 'editor') { editorDown(sq, e); return; }
    if (ui.tab === 'modes') { modesDown(sq); return; }
    const md = mode(), anl = md === 'analysis';
    if (md === 'puzzle') { pzDown(sq, e); return; }
    if (md !== 'game' && !anl) return;
    if (anl && !canAnalyse()) return;
    const trying = anl || canTry(); // a free board: whoever is to move may be moved
    if (ui.tab === 'review' && !trying) return;
    const s = anl ? A.cur.state : trying ? G.states[G.view] : live(), p = s.board[sq];
    // Whose pieces may be picked up: yours, or whoever is to move on the review board or under Puppet Master.
    const mine = !!p && !(G.auto && !trying) && R.colorOf(p) === (trying || G.puppetNow ? s.turn : mySide()); // a bot match: nobody's, every piece can be looked at
    /* A look at a piece (standard rules): every piece clicked shows its card in the panel, and a piece of the other
       side also shows where it could go on its own turn. A click on it while one of your pieces could take it
       stays a capture. */
    const stdRules = (anl ? A.B : G.B).kind === 'std' || (!anl && !!G.hex); // a hex game has its cards and looks too
    if (ui.peek && ui.peek.sq !== sq) ui.peek = null;
    const seen = p && !(!anl && fogged(R.colorOf(p))); // Fog of War: a hidden piece cannot be looked at
    if (stdRules) ui.info = seen ? sq : null;
    else if (!anl && G.glyphs && G.glyphs['+p']) ui.info = seen ? sq : null; // Shogi: the card of the piece, how it moves
    if (seen && stdRules && !ui.mode && !mine && !(ui.sel && ui.sel.moves.some((m) => m.to === sq))) { peekAt(sq, s, anl ? A.cfg : G.cfg); return; }
    if (stdRules && !trying && !canAct() && !canPremove()) { renderAll(); return; } // not your turn: the card of your own piece still opens

    if (!trying && canPremove()) {
      // The engine is thinking: pick the move to play the moment it answers. With multi-premoves the
      // pieces are shown where the queued moves will put them, and the next premove starts from there.
      const had = ui.premoves.length > 0, multi = settings.multiPremove;
      if (!multi) ui.premoves = [];
      const vp = multi ? pmBoard(s)[sq] : p, mine = !!vp && R.colorOf(vp) === G.cfg.side;
      if (ui.sel && ui.sel.sq >= 0 && sq !== ui.sel.sq && !mine) {
        pmAdd(ui.sel.sq, sq);
        ui.sel = null;
        renderAll();
      } else if (mine) {
        const was = ui.sel && ui.sel.sq === sq;
        ui.sel = { sq: sq, moves: [] };
        renderAll();
        startDrag(e, sq, was);
      } else if (ui.sel || had) { ui.sel = null; ui.premoves = []; renderAll(); } // a click on nothing cancels them all
      return;
    }
    if (!trying && !canAct()) return;
    if (trying && (ui.mode === 'gild' || ui.mode === 'freeze' || ui.mode === 'convert' || ui.mode === 'shield')) ui.mode = null; // those act on the live game only
    if (ui.mode === 'gild') {
      if (G.B.gildTargets(s, G.legal).indexOf(sq) >= 0) doGild(sq);
      else { ui.mode = null; renderAll(); }
      return;
    }
    if (ui.mode === 'shield') {
      if (G.B.shieldTargets(s).indexOf(sq) >= 0) doShield(sq); else { ui.mode = null; renderAll(); }
      return;
    }
    if (ui.mode && ui.mode.indexOf('ou:') === 0) {
      const id = ui.mode.slice(3);
      if (ouRuleTargets(id, s).indexOf(sq) < 0) { ui.mode = null; ui.ouA = -1; renderAll(); return; }
      if (id === 'teleporter' && !(ui.ouA >= 0)) { ui.ouA = sq; renderAll(); return; } // the first of the two
      doOuRule(id, id === 'teleporter' ? ui.ouA : sq, id === 'teleporter' ? sq : -1);
      return;
    }
    if (ui.mode === 'powerup' || ui.mode === 'downgrade') {
      if (ouTargets(ui.mode, s).indexOf(sq) >= 0) doOuItem(ui.mode, sq);
      else { ui.mode = null; renderAll(); }
      return;
    }
    if (ui.mode === 'freeze') {
      if (G.B.freezeTargets(s).indexOf(sq) >= 0) doFreeze(sq);
      else { ui.mode = null; renderAll(); }
      return;
    }
    if (ui.mode === 'convert') {
      if (G.B.convertTargets(s).indexOf(sq) >= 0) doConvert(sq);
      else { ui.mode = null; renderAll(); }
      return;
    }
    if (ui.mode === 'portal') {
      if (ui.draft.length === 0) { ui.draft = [sq]; renderAll(); }
      else if (sq !== ui.draft[0]) setPortals(ui.draft[0], sq);
      return;
    }
    if (ui.sel) {
      if (sgArmed() && sq !== ui.sel.sq && !(p && R.colorOf(p) === s.turn)) {
        const plain = ui.sel.moves.filter((m) => m.to === sq && !m.shot);
        if (plain.length) { commit(plain); return; }
        const shot = sgShotTo(sq);
        if (shot && e.pointerType === 'touch') { touch.aim = 'sg'; ui.sgHover = sq; renderArrows(); return; } // a finger: aim until it lifts
        if (shot) { ui.sel = null; ui.sgHover = -1; dispatch(shot); return; }
      }
      const cands = ui.sel.moves.filter((m) => m.to === sq);
      if (cands.length) { commit(cands); return; }
    }
    // a duck: a yellow one in the duck part of the turn, a blue one at any point of the turn
    if (!p && ((s.ducks && s.ducks.indexOf(sq) >= 0) || (s.bducks && s.bducks.indexOf(sq) >= 0))) {
      const list = anl ? A.legal : trying ? rvLegal(G.view) : G.legal, dm = list.filter((m) => m.duck && m.from === sq);
      ui.sel = dm.length ? { sq: sq, moves: dm, duck: true } : null;
      renderAll();
      return;
    }
    if (mine) {
      const was = ui.sel && ui.sel.sq === sq;
      select(sq);
      renderAll();
      startDrag(e, sq, was);
    } else if (ui.sel) { ui.sel = null; renderAll(); }
  });

  // Hexagonal Chess: the same look at an enemy piece, with the hex rules
  function hexPeek(sq, s) {
    const c = Hex.colorOf(s.board[sq]), t = Object.assign({}, s, { turn: c, ep: -1, epVictim: -1 });
    const to = Hex.legalMoves(t).filter((m) => m.from === sq).map((m) => ({ to: m.to, cap: !!m.cap })), seen = {}, reach = [];
    to.forEach((x) => { seen[x.to] = true; });
    const foePawn = c === 'w' ? 'p' : 'P';
    for (let q = 0; q < Hex.N; q++) {
      const occ = s.board[q];
      if (q === sq || seen[q] || (occ && (Hex.colorOf(occ) !== c || occ.toLowerCase() === 'k'))) continue;
      if (!occ && !Hex.attacked(s.board, q, c)) continue;
      const b2 = s.board.slice(); b2[q] = foePawn;
      if (Hex.pseudo(Object.assign({}, t, { board: b2 })).some((m) => m.from === sq && m.to === q && m.cap)) reach.push({ to: q, guard: !!occ });
    }
    ui.peek = { sq: sq, to: to, reach: reach, state: s };
    ui.sel = null;
    renderAll();
  }
  /* The card of a hex piece: the whole board small, the piece in the middle (a pawn on its starting cell), and
     where it goes: moves, captures only, jumps. Same marks and legend as the square cards. */
  const HEX_HOW = {
    k: 'Moves one cell in any of 12 directions: to the six cells around it and the six diagonal cells.',
    q: 'Slides any distance along the six lines through its sides and the six diagonal lines.',
    r: 'Slides any distance in the six directions through the sides of its cell.',
    b: 'Slides any distance along the six diagonals. It never leaves its colour, so each side has three, one per colour.',
    n: 'Jumps two cells straight on and one more at 60 degrees: twelve cells, over anything in between.',
    p: 'Moves one cell straight ahead, two from any starting cell of its colour. Takes one cell forward at 60 degrees, en passant too. Promotes at the end of its file.'
  };
  function hexDiagram(letter) {
    const U = 22, c = Hex.colorOf(letter), t = letter.toLowerCase(), pawn = t === 'p';
    const at = Hex.index(pawn ? (c === 'w' ? 'f5' : 'f7') : 'f6'), s = Hex.initial();
    for (let i = 0; i < Hex.N; i++) s.board[i] = '';
    s.board[at] = letter; s.turn = c;
    const used = {}, marks = {};
    Hex.pseudo(s).forEach((m) => { if (m.from === at) marks[m.to] = t === 'n' ? 'moveJump' : pawn ? 'move' : 'both'; });
    if (pawn) { // what it takes: put something of the other side where it could
      const s2 = Object.assign({}, s, { board: s.board.slice() }), foe = c === 'w' ? 'p' : 'P';
      Hex.CELLS.forEach((x) => { if (!s2.board[x.i] && x.i !== at) s2.board[x.i] = foe; });
      Hex.pseudo(s2).forEach((m) => { if (m.from === at && m.cap) marks[m.to] = 'cap'; });
    } else if (t === 'n') Object.keys(marks).forEach((k) => { marks[k] = 'bothJump'; });
    const flip = ui.flipped; ui.flipped = false; // the diagram is always drawn from White's side
    const R0 = 0.5773503 * U, fills = ['#ebecd0', '#b0c48e', '#739552'];
    let g = '<svg viewBox="0 0 ' + (HEXW * U).toFixed(1) + ' ' + 11 * U + '" class="eddia hexdia">';
    Hex.CELLS.forEach((x) => {
      const ctr = hexCenter(x.i).map((v) => v * U), pts = [];
      for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; pts.push((ctr[0] + R0 * Math.cos(a)).toFixed(2) + ',' + (ctr[1] + R0 * Math.sin(a)).toFixed(2)); }
      g += '<polygon points="' + pts.join(' ') + '" fill="' + fills[x.color] + '"/>';
      if (x.i === at) g += '<image href="' + pieceUrl(letter) + '" x="' + (ctr[0] - U * 0.48).toFixed(2) + '" y="' + (ctr[1] - U * 0.48).toFixed(2) + '" width="' + (U * 0.96).toFixed(2) + '" height="' + (U * 0.96).toFixed(2) + '"/>';
      else if (marks[x.i]) { g += moveMark(marks[x.i], ctr[0], ctr[1]); used[marks[x.i]] = true; }
    });
    ui.flipped = flip;
    edDiagram.used = used; edDiagram.letter = letter;
    return g + '</svg>';
  }
  function hexCard(letter) {
    const c = Hex.colorOf(letter), name = (c === 'w' ? 'White ' : 'Black ') + ({ p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' })[letter.toLowerCase()];
    const card = h('div', 'pinfo', hexDiagram(letter) + '<div class="edinfo"><b>' + name + '</b><span class="how">' + HEX_HOW[letter.toLowerCase()] + '</span></div>' + moveLegend(edDiagram.used));
    const x = h('button', 'pinfo-x', '&times;');
    x.title = 'Close';
    x.onclick = () => { ui.info = null; ui.peek = null; renderAll(); };
    card.appendChild(x);
    return card;
  }
  function peekAt(sq, s, cfg) {
    if (s.hex) { hexPeek(sq, s); return; }
    ui.peek = peekOf(sq, s, cfg);
    ui.sel = null;
    renderAll();
  }
  // Where the piece on sq could go on its own turn, and what else it covers (the red marks of a look at a piece).
  /* Danger: a game under the Ouroboros King's rules (king capture) against a bot, a run stage above all. The squares
     the other side could take on its next turn; a piece of yours standing on one is marked harder. */
  const dangerGame = () => !!(G && G.cfg && G.cfg.kingCapture && G.B.kind === 'std' && !G.local && !G.hex);
  function dangerSquares(s, cfg, by) {
    const out = [];
    try { for (let q = 0; q < s.board.length; q++) { const p = s.board[q]; if ((!p || R.colorOf(p) !== by) && !R.isWall(cfg, q, s) && R.attacked(s, q, by, cfg)) out.push(q); } } catch (e) { /* none then */ }
    return out;
  }
  function peekOf(sq, s, cfg) {
    if (s.hex) return null;
    const c = R.colorOf(s.board[sq]), t = Object.assign({}, s, { turn: c, dice: null, rolled: null, again: -1, ep: -1 });
    let to = [];
    try { to = R.legalAll(t, cfg).filter((m) => m.from === sq).map((m) => ({ to: m.to, cap: !!m.cap })); } catch (err) { to = []; }
    /* What else it covers: empty squares it could only capture on (a pawn's diagonals), and its own pieces it
       guards, where it would take back if you captured there. Found by putting one of your pawns on each square
       the side attacks at all, and asking whether this piece could take it. */
    const reach = [], foePawn = c === 'w' ? 'p' : 'P', seen = {};
    to.forEach((x) => { seen[x.to] = true; });
    try {
      for (let q = 0; q < s.board.length; q++) {
        if (q === sq || seen[q] || R.isWall(cfg, q, s)) continue;
        const occ = s.board[q];
        if (occ && (R.colorOf(occ) !== c || R.isRoyal(occ))) continue;
        if (!R.attacked(s, q, c, cfg) && !occ) continue;
        const b2 = s.board.slice(); b2[q] = foePawn;
        const t2 = Object.assign({}, t, { board: b2 });
        if (R.pseudoMoves(t2, cfg, true).some((m) => m.from === sq && m.capSq === q || (m.from === sq && m.to === q && m.cap))) reach.push({ to: q, guard: !!occ });
      }
    } catch (err) { /* only the moves then */ }
    // a demon walks by itself: the square it steps on next is the one in danger
    if (R.isFairy(s.board[sq]) && R.fairyOf(s.board[sq]).demon) {
      const nx = R.demonNext(s, cfg, sq);
      if (nx >= 0) { if (s.board[nx]) to.push({ to: nx, cap: true }); else reach.push({ to: nx, guard: false }); }
    }
    return { sq: sq, to: to, reach: reach, state: s };
  }
  // The red marks of an enemy piece on the board, explained under its card.
  function peekLegend() {
    const red = 'rgba(214,58,42,.85)', sq = (inner) => '<svg viewBox="0 0 22 22"><rect width="22" height="22" rx="3" fill="#ebecd0"/>' + inner + '</svg>';
    const corner = (x, y, dx, dy) => '<path d="M' + x + ' ' + (y + dy * 6) + 'V' + y + 'H' + (x + dx * 6) + '" fill="none" stroke="' + red + '" stroke-width="2.4"/>';
    const rows = [
      [sq('<circle cx="11" cy="11" r="3.6" fill="' + red + '"/>'), 'It can move there'],
      [sq('<circle cx="11" cy="11" r="8" fill="none" stroke="' + red + '" stroke-width="2.2"/>'), 'It can capture there'],
      [sq('<path d="M7 7l8 8M15 7l-8 8" stroke="' + red + '" stroke-width="2.4"/>'), 'It attacks this empty square'],
      [sq(corner(3, 3, 1, 1) + corner(19, 3, -1, 1) + corner(3, 19, 1, -1) + corner(19, 19, -1, -1)), 'It guards this piece: it takes back there']];
    return '<div class="mlegend peekleg">' + rows.map((r) => '<div>' + r[0] + '<span>' + r[1] + '</span></div>').join('') + '</div>';
  }
  // The card of a piece, as in the board editor: its moves on a small board, what it does, what the marks mean.
  // The kinds of piece a mimic copies in this position: Tabitha every kind of the other side but the portal mage,
  // the Fool the last kind that moved. A copied mimic moves like a king.
  function mimicNow(letter, s) {
    const d = R.isFairy(letter) ? R.fairyOf(letter) : null, c = R.colorOf(letter);
    if (!d || !d.mimic || !s) return null;
    const kind = (t) => (R.isFairy(t) && R.fairyOf(t).mimic ? 'k' : t.toLowerCase());
    if (d.mimic === 'fool') { const last = c === 'w' ? s.lastB : s.lastW; return last ? [kind(last)] : []; }
    const out = [];
    s.board.forEach((p) => { if (!p || R.colorOf(p) === c || p.toLowerCase() === 'л') return; const t = kind(p); if (out.indexOf(t) < 0) out.push(t); });
    return out;
  }
  function pieceCard(letter, cfg, s) {
    const c = R.colorOf(letter), def = R.isFairy(letter) ? R.fairyOf(letter) : null;
    const name = (c === 'w' ? 'White ' : 'Black ') + (def ? def.name : Ouro.title(letter));
    const now = mimicNow(letter, s), kinds = now ? now.map(pieceName) : null;
    const nowText = now && now.length ? ' <em class="mimicnow">Right now it moves like: ' + (kinds.length > 1 ? kinds.slice(0, -1).join(', ') + ' and ' + kinds[kinds.length - 1] : kinds[0]) + '.</em>' : '';
    const card = h('div', 'pinfo', edDiagram(letter, cfg, now) + '<div class="edinfo"><b>' + name + '</b><span class="how">' + unitHow(letter) + '.' + nowText + '</span></div>' + moveLegend(edDiagram.used));
    const x = h('button', 'pinfo-x', '&times;');
    x.title = 'Close';
    x.onclick = () => { ui.info = null; ui.peek = null; renderAll(); };
    card.appendChild(x);
    return card;
  }
  function startDrag(e, sq, wasSelected) {
    const el = L.pieces.querySelector('[data-sq="' + sq + '"]');
    if (!el) return;
    ui.drag = { sq: sq, el: el, x: e.clientX, y: e.clientY, moved: false, was: wasSelected };
    try { board.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
  }
  // Shotgun King: the cone follows the mouse, the panel names the piece under it
  board.addEventListener('pointermove', (e) => {
    if (ui.tab !== 'modes' || gmTab !== 'sk') return;
    const sq = evSq(e);
    if (sq !== skUi.hover) { skUi.hover = sq; renderArrows(); skHoverInfo(); }
  });
  // Pawnbarian: the panel names the monster under the mouse, the board shows the squares it attacks
  board.addEventListener('pointermove', (e) => {
    if (ui.tab !== 'modes' || gmTab !== 'pb') return;
    const sq = evSq(e);
    if (sq !== pbUi.hover) { pbUi.hover = sq; if (!pbUi.busy) renderBoard(); pbHoverInfo(); } // not while the attacks are being shown
  });
  board.addEventListener('pointerleave', () => { if (pbUi.hover !== -1 && gmTab === 'pb') { pbUi.hover = -1; renderBoard(); pbHoverInfo(); } });
  board.addEventListener('pointerleave', () => { if (skUi.hover !== -1) { skUi.hover = -1; renderArrows(); skHoverInfo(); } if (ui.sgHover >= 0) { ui.sgHover = -1; renderArrows(); } });
  // a selected Shotgun King in a normal game: the cone follows the mouse too
  board.addEventListener('pointermove', (e) => {
    if (!sgArmed()) { if (ui.sgHover >= 0) { ui.sgHover = -1; renderArrows(); } return; }
    const sq = evSq(e);
    if (sq !== ui.sgHover) { ui.sgHover = sq; renderArrows(); }
  });
  board.addEventListener('pointermove', (e) => {
    if (ui.paint) {
      const sq = evSq(e), T = ed.terrain, holes = T.holes || (T.holes = []);
      if (sq < 0) return;
      if ('hole' in ui.paint) {
        // cutting squares out (or putting them back) along the drag
        const i = holes.indexOf(sq);
        if (ui.paint.hole && i < 0) { [T.walls, T.water, T.portals].forEach((l) => { const j = l.indexOf(sq); if (j >= 0) l.splice(j, 1); }); holes.push(sq); ed.board[sq] = ''; edSync(); }
        else if (!ui.paint.hole && i >= 0) { holes.splice(i, 1); edSync(); }
        return;
      }
      if (ui.paint.v && (holes.indexOf(sq) >= 0 || T.walls.indexOf(sq) >= 0)) return; // no piece where there is no square or a boulder
      if (ed.board[sq] !== ui.paint.v) { ed.board[sq] = ui.paint.v; oneKing(ed.board, sq); edSync(); }
      return;
    }
    if (touch.lp && !touch.lp.fired && Math.hypot(e.clientX - touch.lp.x, e.clientY - touch.lp.y) > 10) { clearTimeout(touch.lp.timer); touch.lp = null; }
    const d = ui.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
    d.moved = true;
    const rc = board.getBoundingClientRect(), size = rc.width / BW;
    d.tf = 'translate(' + (e.clientX - rc.left - size / 2) + 'px,' + (e.clientY - rc.top - size / 2) + 'px)';
    d.el.classList.add('dragging');
    d.el.style.transform = d.tf;
  });
  board.addEventListener('pointerup', (e) => {
    let right = e.button === 2;
    if (e.pointerType === 'touch') {
      const lp = touch.lp;
      touch.lp = null;
      if (lp) clearTimeout(lp.timer);
      if (touch.aim === 'sk') { touch.aim = null; const q = evSq(e); skUi.hover = -1; skDown(q); return; }
      if (touch.aim === 'sg') {
        touch.aim = null;
        const shot = sgArmed() ? sgShotTo(evSq(e)) : null;
        ui.sgHover = -1;
        if (shot) { ui.sel = null; dispatch(shot); } else renderAll();
        return;
      }
      if (lp && lp.fired) { if (lp.done) return; right = true; }
    }
    if (right) {
      const sq = evSq(e), from = ui.rc;
      ui.rc = -1;
      if (sq < 0 || from < 0) return;
      if (sq === from) {
        const i = ui.marks.indexOf(sq);
        if (i >= 0) ui.marks.splice(i, 1); else ui.marks.push(sq);
      } else {
        const i = ui.arrows.findIndex((a) => a.from === from && a.to === sq);
        if (i >= 0) ui.arrows.splice(i, 1); else ui.arrows.push({ from: from, to: sq });
      }
      renderBoard();
      return;
    }
    if (ui.paint) { ui.paint = null; return; }
    const d = ui.drag;
    if (!d) return;
    ui.drag = null;
    const sq = evSq(e);
    if (sq !== d.sq) d.moved = true; // released elsewhere without move events in between
    if (d.editor) {
      const T = ed.terrain;
      if (d.moved && sq >= 0 && ((T.holes || []).indexOf(sq) >= 0 || T.walls.indexOf(sq) >= 0)) { renderBoard(); return; } // no square, or a boulder: the piece stays
      if (d.moved) {
        const p = ed.board[d.sq];
        ed.board[d.sq] = '';
        if (sq >= 0) ed.board[sq] = p;
        // the piece takes its upgrades along, the one it lands on loses its own
        const move = (list) => list.filter((q) => q !== sq).map((q) => (q === d.sq ? sq : q)).filter((q) => q >= 0);
        ed.ghosts = move(ed.ghosts); ed.snipers = move(ed.snipers); ed.helmets = move(ed.helmets); ed.vests = move(ed.vests);
        edSync();
      }
      return;
    }
    if (!d.moved) {
      if (d.was) { ui.sel = null; renderAll(); }
      return;
    }
    if (canAct() || canTry() || (mode() === 'analysis' && canAnalyse()) || pzCanMove()) {
      const cands = ui.sel ? ui.sel.moves.filter((m) => m.to === sq) : [];
      if (cands.length) { ui.dropFrom = d.sq; commit(cands); } else renderAll();
    } else if (canPremove() && sq >= 0) {
      pmAdd(d.sq, sq);
      ui.sel = null;
      renderAll();
    } else renderAll();
  });
  // a double click (or two taps): Midas Touch on a target, or a sniper's shot
  function dblAt(sq) {
    if (sq >= 0 && blastAt(sq)) return true; // a double click on a piece with a vest sets it off
    if (!canAct() || sq < 0) return false;
    const s = live();
    if (G.cfg.midas && G.B.gildTargets(s, G.legal).indexOf(sq) >= 0) { doGild(sq); return true; }
    const m = G.legal.find((x) => x.snipe && x.to === sq);
    if (m) { applyMove(m); return true; }
    return false;
  }
  board.addEventListener('dblclick', (e) => { dblAt(evSq(e)); });

  const TAB_KEYS = { 1: 'play', 2: 'new', 3: 'modes', 4: 'puzzles', 5: 'review', 6: 'analysis', 7: 'archive', 0: 'settings' };
  document.addEventListener('keydown', (e) => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (pbKey(e)) return; // Pawnbarian: the digits pick a card, Space ends the turn
    // the same everywhere: a digit picks a tab, letters press the buttons of the bar under the board
    if (TAB_KEYS[e.key] !== undefined) { setTab(TAB_KEYS[e.key]); return; }
    const press = (id) => { const b = $('#' + id); if (b && !b.disabled && b.offsetParent) { b.click(); return true; } return false; };
    if (e.key === 'n' || e.key === 'N') { if (ui.tab === 'new') press('startBtn'); else if (G && !G.over && ui.tab === 'play') press('cNew'); else setTab('new'); return; }
    if (e.key === 'u' || e.key === 'U') { press('cUndo'); return; }
    // the end of a game: space presses the suggested (green) button of the end card
    if (e.key === ' ' && G && G.over && G.endOpen && $('#endcard').classList.contains('on')) {
      const lead = $('#endcard .body .btn.green');
      if (lead && !lead.disabled && lead.offsetParent) { e.preventDefault(); lead.click(); return; }
    }
    if (e.key === ' ' && ui.tab === 'modes' && gmTab === 'sk' && skLive()) { e.preventDefault(); skReload(); return; }
    if ((e.key === ' ' || e.key === 'r' || e.key === 'R') && ui.tab === 'play' && canRoll()) { e.preventDefault(); rollDice(); return; } // space or R throws the dice
    if (e.key === 'r' || e.key === 'R') { press('cReview'); return; }
    if (e.key === 'a' || e.key === 'A') { press('cAnalyse'); return; }
    if (ui.tab === 'play' && (e.key === 'h' || e.key === 'H')) { press('cHint'); return; }
    if (mode() === 'analysis' && /^Arrow/.test(e.key)) {
      const to = e.key === 'ArrowLeft' ? A.cur.parent : e.key === 'ArrowRight' ? A.cur.children[0] : e.key === 'ArrowUp' ? A.root : aMainEnd(A.cur);
      if (to && to !== A.cur) aGoto(to);
      e.preventDefault();
      return;
    }
    if (ui.tab === 'puzzles') {
      // Enter or Space: on to the next puzzle once this one is done. H: a hint.
      const P = pz.cur, nextBtn = $('#pzNext');
      if ((e.key === 'Enter' || e.key === ' ') && P && P.status !== 'play' && nextBtn) { nextBtn.click(); e.preventDefault(); }
      else if ((e.key === 'h' || e.key === 'H') && P && P.status === 'play') pzHint();
      else if (e.key === 'Escape') { ui.sel = null; renderAll(); }
      return;
    }
    if (e.key === 'ArrowLeft') { gotoView(G ? G.view - 1 : 0); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { gotoView(G ? G.view + 1 : 0); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { gotoView(0); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { gotoView(G ? G.states.length - 1 : 0); e.preventDefault(); }
    else if (e.key === 'f' || e.key === 'F') flip();
    else if (e.key === 'Escape') { closeOverlay(); ui.sel = null; ui.mode = null; ui.draft = []; ui.premoves = []; renderAll(); }
  });

  function flip() {
    ui.flipped = !ui.flipped;
    buildSquares();
    closeOverlay();
    renderAll();
  }

  /* ---------- panel: new game, variants, power-ups, settings ---------- */

  function seg(box, items, current, onPick) {
    box.innerHTML = '';
    items.forEach((it) => {
      const b = h('button', it[0] === current ? 'on' : '', it[1]);
      b.onclick = (e) => { e.stopPropagation(); onPick(it[0]); };
      box.appendChild(b);
    });
  }

  function renderSetup() {
    renderRatings();
    const box = $('#bots'), kind = engineKind(), fairy = kind === 'fairy', V = Fairy.byId(setup.variant), botsMode = setup.mode === 'bots';
    const localMode = setup.mode === 'local';
    seg($('#modeSeg'), [['human', 'Against a bot'], ['local', 'Two players'], ['bots', 'Bot match']], setup.mode, (v) => {
      setup.mode = v;
      if (!G || G.over) { ui.flipped = v === 'human' && setup.color === 'b'; buildSquares(); }
      changed();
    });
    $('#humanBox').style.display = botsMode || localMode ? 'none' : '';
    $('#colorBox').style.display = botsMode || localMode ? 'none' : '';
    $('#localBox').style.display = localMode ? '' : 'none';
    // king capture follows the game (autoKC): shown only when it is on, with the reason
    const kc = autoKC();
    $('#kcBox').style.display = kc.on ? '' : 'none';
    $('#kcWhy').textContent = kc.why + ' No check and no mate: a king may stand where it can be taken, and taking it wins the game.';
    const fe = $('#flipEach');
    fe.className = 'sw' + (setup.flipEach ? ' on' : '');
    fe.onclick = () => { setup.flipEach = !setup.flipEach; changed(); };
    const bb = $('#botsBox');
    bb.style.display = botsMode ? '' : 'none';
    bb.innerHTML = '';
    if (botsMode) [['w', 'White'], ['b', 'Black']].forEach((side) => {
      const cur = side[0] === 'w' ? setup.botW : setup.botB, eng = prefEngine(cur.engine);
      bb.appendChild(h('h3', '', side[1]));
      const row = h('div', 'row'), se = h('select', 'field'), sl = h('select', 'field');
      se.appendChild(new Option('Automatic (' + (prefEngine('auto') === 'fairy' ? 'Fairy-Stockfish' : 'Stockfish 19') + ')', 'auto'));
      ENGINES.forEach((e) => { const o = new Option(e.name, e.id); o.disabled = e.id === 'sf' && !sfCanPlay(); se.appendChild(o); });
      se.value = cur.engine === 'sf' && !sfCanPlay() ? 'auto' : cur.engine;
      se.onchange = () => { cur.engine = se.value; if (se.value === 'fairy') getFairy().catch(() => {}); changed(); };
      BOTS.forEach((b) => {
        if (b.hidden) return;
        const lab = botLabel(b, eng === 'fairy');
        sl.appendChild(new Option(b.max ? 'Max: full strength' : 'Level ' + b.lv + ': ' + lab.name + ' (' + lab.elo + ')', b.id));
      });
      sl.value = cur.bot;
      sl.onchange = () => { cur.bot = sl.value; changed(); };
      row.appendChild(se); row.appendChild(sl);
      bb.appendChild(row);
    });
    // the opponent: one card (who plays, at what rating, on which engine and why), the details behind Change
    const cur = botById(setup.bot), lab = botLabel(cur, fairy, ownName()), why = setup.engine !== 'fairy' ? sfWhyNot() : null;
    const engName = ownName() ? lab.tag.replace(/^[\d+]+, /, '') : fairy ? 'Fairy-Stockfish' : 'Stockfish 19';
    const face = (b) => '<div class="lv' + (b.max ? ' max' : '') + (b.style ? ' persona p-' + b.style : '') + '">' + botFace(b) + '</div>';
    $('#oppCard').innerHTML = '<div class="oppc">' + face(cur) + '<div class="tx"><div class="nm">' + lab.name + '</div><div class="el">' +
      (cur.max ? 'Full strength' : 'Rating ' + lab.elo) + ', ' + engName + (setup.engine === 'auto' && !ownName() ? ' (automatic)' : '') + '</div>' +
      (why ? '<div class="why">' + why + '</div>' : cur.blurb ? '<div class="why">' + cur.blurb + '</div>' : '') + '</div>' +
      '<button class="btn" id="oppChange">' + (ui.oppOpen ? 'Done' : 'Change') + '</button></div>';
    $('#oppChange').onclick = () => { ui.oppOpen = !ui.oppOpen; renderSetup(); };
    $('#oppMore').classList.toggle('on', !!ui.oppOpen);
    if (ownName()) {
      seg($('#engSeg'), [['own', 'Own engine']], 'own', () => {});
      $('#engNote').textContent = ckRules() ? 'Stockfish does not know checkers. The app\'s own search plays it, with forced captures, jump chains and kings.'
        : 'The app\'s own search plays Duck Chess: it knows the duck, where to put it and where it blocks, and every other piece and power-up.';
    } else {
      const sfOk = sfCanPlay();
      seg($('#engSeg'), [['auto', 'Automatic'], ['sf', 'Stockfish 19'], ['fairy', 'Fairy-Stockfish']], setup.engine === 'sf' && !sfOk ? 'auto' : setup.engine, (v) => {
        if (v === 'sf' && !sfOk) return;
        setup.engine = v;
        if (prefEngine(v) === 'fairy') getFairy().catch(() => {});
        changed();
      });
      const sfBtn = $('#engSeg').querySelectorAll('button')[1];
      if (sfBtn && !sfOk) { sfBtn.disabled = true; sfBtn.title = sfWhyNot() || ''; }
      $('#engNote').textContent = setup.engine === 'fairy' ? 'Fairy-Stockfish plays every variant, every board and any position. A little weaker than Stockfish 19.'
        : (why || 'Stockfish 19 plays: the strongest engine there is. Another variant or an army it refuses switches to Fairy-Stockfish by itself.');
    }
    box.innerHTML = '';
    BOTS.forEach((b) => {
      if (b.hidden) return;
      const rec = stats[statKey(kind, b)], lb = botLabel(b, fairy, ownName());
      const threads = fairy ? (fairyEngine ? fairyEngine.threads + ' threads' : 'all threads') : (engineReady ? engine.threads + ' threads' : 'all threads');
      if (b.style && !BOTS.slice(0, BOTS.indexOf(b)).some((x) => x.style)) box.appendChild(h('div', 'bots-head', 'Personalities'));
      const el = h('button', 'bot' + (b.max ? ' max' : '') + (b.style ? ' persona' : '') + (setup.bot === b.id ? ' on' : ''),
        face(b) + '<div style="min-width:0"><div class="nm">' + lb.name + '</div><div class="el">' +
        (b.max ? 'Full strength, ' + threads : 'Rating ' + lb.elo + (b.blurb ? '. ' + b.blurb : '')) + '</div></div>' +
        (rec ? '<div class="rec">' + rec.w + ' W, ' + rec.d + ' D, ' + rec.l + ' L</div>' : ''));
      el.onclick = () => { setup.bot = b.id; ui.oppOpen = false; changed(); };
      box.appendChild(el);
    });
    $('#thinkBox').style.display = (botsMode ? setup.botW.bot === 'max' || setup.botB.bot === 'max' : !localMode && setup.bot === 'max') ? '' : 'none';
    seg($('#thinkSeg'), THINK, settings.thinkMs, (v) => { settings.thinkMs = v; changed(); });
    seg($('#colorSeg'), [['w', 'White'], ['r', 'Random'], ['b', 'Black']], setup.color, (v) => {
      setup.color = v;
      if (!G || G.over) { ui.flipped = v === 'b'; buildSquares(); }
      changed();
    });
    seg($('#clockSeg'), CLOCKS, setup.clock, (v) => { setup.clock = v; changed(); });
  }

  function renderVariants() {
    const box = $('#variants');
    box.innerHTML = '';
    let group = '';
    Fairy.VARIANTS.forEach((V) => {
      if (V.group !== group) { group = V.group; box.appendChild(h('h3', '', group)); }
      const pb = Fairy.parseBoard(V.id === 'custom' && custom ? custom.fen : V.fen);
      const el = h('button', 'var' + (setup.variant === V.id ? ' on' : ''),
        '<div class="sz">' + (V.id === 'custom' && !custom ? '?' : pb.W + 'x' + pb.H) + '</div><div><div class="nm">' + V.name +
        (V.id === 'custom' && custom ? ': ' + custom.title : '') + '</div><div class="ds">' + V.desc + '</div></div>');
      el.onclick = () => {
        setup.variant = V.id;
        if (!stdVariant(V.id)) Fairy.rules().catch(() => {});
        if (V.id === 'custom' && !custom) loadCustom();
        changed();
        if (V.id === 'custom') $('#customLab').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      };
      box.appendChild(el);
    });
    $('#customLab').classList.toggle('on', setup.variant === 'custom');
    const msg = $('#customMsg');
    msg.className = customErr ? 'bad' : (custom ? 'ok' : '');
    if (customErr) msg.textContent = customErr;
    else if (custom) {
      const pb = Fairy.parseBoard(custom.fen);
      msg.textContent = 'Loaded "' + custom.title + '", ' + pb.W + 'x' + pb.H + '. ' + (custom.warnings.length ? 'Notes from the engine: ' + custom.warnings.join(' ') : 'Ready to play.');
    } else msg.textContent = 'Not loaded yet. Edit the definition, then press Load variant.';
  }
  function loadCustom() {
    const ini = setup.customIni;
    customErr = '';
    $('#customMsg').className = '';
    $('#customMsg').textContent = 'Loading';
    return Fairy.loadCustom(ini).then((c) => { custom = c; }, (e) => { custom = null; customErr = e.message || 'The variant could not be loaded.'; })
      .then(() => changed());
  }

  function renderPowers() {
    const box = $('#powers'), hasDrops = !!Fairy.byId(setup.variant).drops;
    // std = the bots can handle power-ups in this variant (all of them but the one where being mated is the goal)
    const ab = $('#aiBox'), std = !Fairy.byId(setup.variant).nobrain, bots = setup.mode === 'bots', local = setup.mode === 'local';
    const own = std && setup.ai.use === 'own';
    if (!own) ui.pwSet = 'a';
    const second = ui.pwSet === 'b'; // editing the other side's own set
    const pw = second ? setup.powers2 : setup.powers;
    ab.innerHTML = '';
    // who else gets power-ups
    const who = h('div', 'setrow col' + (std ? '' : ' dim'), '<div>' + (bots || local ? 'Black\'s power-ups' : 'The bot\'s power-ups') + '<small>' +
      (!std ? 'Not in this variant: here the bot keeps playing by the normal rules.'
        : bots ? 'White always plays with the first set. Black can go without, share it, or get a set of its own.'
          : local ? 'White plays with the first set. Black can go without, share it, or get a set of its own. Veto and Puppet Master need an engine, so they stay off at a shared board.'
            : 'The bot can go without, play with the same power-ups as you, or get a set of its own. Veto and Puppet Master always stay yours.') + '</small></div>');
    const sg = h('div', 'seg');
    seg(sg, [['none', 'None'], ['same', bots || local ? 'Same as White' : 'Same as yours'], ['own', 'Its own set']], std ? setup.ai.use : 'none', (v) => {
      if (!std) return;
      setup.ai.use = v;
      ui.pwSet = v === 'own' ? 'b' : 'a';
      changed();
    });
    who.appendChild(sg);
    ab.appendChild(who);
    if (!local) {
      const el = h('div', 'setrow' + (std ? '' : ' dim'), '<div>Bots see them coming<small>' +
        (std ? 'A bot looks a few moves ahead with the other side\'s power-ups in mind and keeps its pieces out of their reach. Off, it only knows its own.' : 'Not in this variant.') + '</small></div>');
      const sw = h('button', 'sw' + (setup.ai.anticipate && std ? ' on' : ''));
      sw.disabled = !std;
      sw.onclick = () => { setup.ai.anticipate = !setup.ai.anticipate; changed(); };
      el.appendChild(sw);
      ab.appendChild(el);
    }
    // which of the two sets the list below edits
    const ss = $('#pwSetSeg');
    ss.style.display = own ? '' : 'none';
    if (own) seg(ss, bots || local ? [['a', 'White\'s set'], ['b', 'Black\'s set']] : [['a', 'Your set'], ['b', 'The bot\'s set']], ui.pwSet, (v) => { ui.pwSet = v; renderPowers(); });
    $('#pwIntro').textContent = second ? (bots || local ? 'These are Black\'s power-ups. Read every "you" below as Black.' : 'These are the bot\'s power-ups, it plays them against you. Read every "you" below as the bot.')
      : bots ? (std ? 'These are White\'s power-ups. Stack as many as you like.' : 'Bots get no power-ups in this variant.')
        : local ? 'These are White\'s power-ups. Read every "you" below as White. Stack as many as you like.'
          : 'Give yourself an unfair advantage. Stack as many as you like, in standard chess, in Dice Chess or in any variant.';
    box.innerHTML = '';
    POWERS.forEach((p) => {
      // the variant brings its own drops, and a bot cannot be handed the power-ups that need a person
      const blocked = (p.id === 'drops' && hasDrops) || (((second && !local) || bots) && HUMAN_ONLY.indexOf(p.id) >= 0) || (local && (p.id === 'veto' || p.id === 'puppet'));
      const on = powerOn(pw, p.id) && !blocked;
      const el = h('div', 'pw' + (on ? ' on' : '') + (blocked ? ' off' : ''));
      if (window.PWA && PWA.touch) el.title = p.desc; // a phone shows the text of a card that is off when it is held
      const ic = h('div', 'ic' + (p.skin ? ' ' + p.skin : ''), (p.badge ? '<b>' + p.badge + '</b>' : '') + (p.wear ? '<i class="wear ' + p.wear + '"></i>' : ''));
      ic.style.backgroundImage = p.fairy ? 'url(pieces/fairy/w_' + p.fairy + '.svg)' : p.skin === 'camo' ? skinUrl('camo', p.icon) : imgUrl(p.icon);
      if (p.gold) ic.style.filter = 'brightness(.74) sepia(1) saturate(7) hue-rotate(-6deg) brightness(1.18)';
      if (p.ice) ic.style.backgroundColor = '#6fc8ee';
      const tx = h('div', 'tx', '<div class="nm">' + p.name + '</div><div class="ds">' + p.desc + '</div>');
      if (on && p.opts) {
        const sg = h('div', 'seg');
        seg(sg, p.opts, pw[p.opt], (v) => { pw[p.opt] = v; changed(); });
        tx.appendChild(sg);
      }
      if (on && p.multi) {
        // which piece types get it: one small button each, in the same dress as on the board
        const row = h('div', 'picks');
        p.multi.forEach((m) => {
          // '*' every piece, '-' every piece but the pawns (the ones in the editor's sense: any kind, fairy too)
          const all = m[2] === '*', np = m[2] === '-', b = h('button', 'pick ' + (p.skin || '') + (all ? ' all' : '') + (np ? ' nopawn' : '') + (pw[m[0]] ? ' on' : ''), all ? 'All' : '');
          if (p.wear && !all) b.innerHTML = '<i class="wear ' + p.wear + '"></i>';
          if (!all) b.style.backgroundImage = p.skin === 'camo' ? skinUrl('camo', 'w' + (np ? 'P' : m[2])) : imgUrl('w' + (np ? 'P' : m[2]));
          b.title = POWER_LIST.find((x) => x.key === m[0]).name;
          b.onclick = (e) => {
            e.stopPropagation();
            // All Snipers switches every kind on (and off) with it; taking one kind away is no longer all.
            // The other group buttons are one or the other.
            // All and All but pawns switch the kinds with them (the pawns too, or all but the pawns), and each other off;
            // a kind switched off again is no longer the group. (Ghosts on all pieces stays a group of its own.)
            const kinds = p.multi.filter((x) => x[2] !== '*' && x[2] !== '-'), groups = p.multi.filter((x) => x[2] === '*' || x[2] === '-');
            if (all || np) {
              const v = !pw[m[0]];
              groups.forEach((x) => { pw[x[0]] = false; });
              if (!(m[0] === 'ghostAll')) kinds.forEach((x) => { pw[x[0]] = v && !(np && x[2] === 'P'); });
              pw[m[0]] = v;
            } else {
              pw[m[0]] = !pw[m[0]];
              if (!pw[m[0]]) groups.forEach((x) => { if (x[0] !== 'ghostAll' && (x[2] === '*' || m[2] !== 'P')) pw[x[0]] = false; });
            }
            changed();
          };
          row.appendChild(b);
        });
        tx.appendChild(row);
      }
      el.appendChild(ic); el.appendChild(tx); el.appendChild(h('div', 'tg'));
      el.onclick = () => {
        if (blocked) return;
        if (p.id === 'double') pw.double = on ? 0 : 2;
        else if (p.opt === p.id) pw[p.id] = on ? 0 : p.opts[0][0]; // a level of its own (helmet, vest)
        else if (p.multi) { if (on) p.multi.forEach((m) => { pw[m[0]] = false; }); else [].concat(p.first).forEach((k) => { pw[k] = true; }); }
        else pw[p.id] = !on;
        changed();
      };
      box.appendChild(el);
    });
    const V = Fairy.byId(setup.variant), variant = !stdVariant(V.id);
    let note = '';
    if (V.checkers) note = 'Checkers is played without power-ups: they stay off in this game, whatever is switched on here.';
    else if (variant) {
      note = 'In ' + V.name + ' the power-ups go by piece letter: a piece written like a bishop shoots like one, knights turn into dragons, queens into amazons, pawns into rockets. Kings are immune to every power-up.';
      if (!V.nobrain) note += ' Bots handle power-ups here too, but their lookahead for them is short, about two moves. The eval bar adds a power-up correction to the engine\'s view.';
      if (V.drops) note += ' Reinforcements is off, this variant already has drops of its own.';
      if (V.special) note += ' A win or loss by the variant\'s own rule ends the game at once, a power-up cannot undo it.';
    }
    $('#powersNote').classList.toggle('on', variant);
    $('#powersNote').textContent = note;
    $('#edNote').classList.toggle('on', variant);
    $('#edNote').textContent = V.checkers ? 'Checkers is played from this board when it holds nothing but checkers men and kings (the Checkers presets do), otherwise from the normal checkers start.'
      : 'Custom positions only apply to standard chess. You picked ' + V.name + ', so the next game starts from that variant\'s own setup.';
  }

  function startErrs() {
    if (stdVariant(setup.variant)) return ed.errs;
    if (isCheckers(setup.variant)) return checkersBoard(setup.fen) ? ed.errs : [];
    if (setup.variant === 'custom' && !custom) return [customErr ? 'The custom variant has an error.' : 'Load your custom variant first.'];
    return [];
  }
  /* New Game in four steps: Opponent, Variant, Power-ups, Board. A strip of four buttons under the panel title, each
     saying what is chosen right now, so the whole setup can be read at a glance and any step reached in one click. */
  const SETUP_STEPS = [
    ['new', 'Opponent', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.400 0-8 2.300-8 5.200V21h16v-1.800c0-2.900-3.600-5.200-8-5.200z"/></svg>'],
    ['variants', 'Variant', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 3 7v10l9 5 9-5V7zm0 2.300 6.500 3.600L12 11.500 5.500 7.900zM5 9.600l6 3.300v6.500l-6-3.300zm14 0v6.500l-6 3.300v-6.500z"/></svg>'],
    ['powers', 'Power-ups', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2 4 13.5h6L8.5 22 20 9.5h-6.5z"/></svg>'],
    ['editor', 'Board', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm13.5 0 1.2 3.3L21 17.5l-3.3 1.2L16.5 22l-1.2-3.3L12 17.5l3.3-1.2z"/></svg>']
  ];
  function stepValues() {
    const V = Fairy.byId(setup.variant), bots = setup.mode === 'bots', local = setup.mode === 'local';
    const opp = bots ? 'Bot match' : local ? 'Two players' : botLabel(botById(setup.bot), engineKind() === 'fairy', ownName()).name;
    const vname = V.id === 'custom' && custom ? custom.title : V.name;
    const n = powerNames(setup.powers).length + (setup.ai.use === 'own' && setup.powers2 ? powerNames(setup.powers2).length : 0);
    const pw = V.checkers ? 'off in Checkers' : n ? n + ' active' : 'none';
    let board;
    if (!stdVariant(V.id) && !(V.checkers && checkersBoard(setup.fen) && setup.fen !== V.fen)) board = 'Variant\'s start';
    else {
      const parts = setup.fen.split(' ')[0].split('/'), H = parts.length, W = parts[0].replace(/\d+/g, (d) => 'x'.repeat(+d)).length;
      const plain = setup.fen === R.START_FEN && !hasTraits(setup.traits) && !(setup.terrain && ((setup.terrain.walls || []).length || (setup.terrain.holes || []).length));
      board = plain ? 'Start position' : 'Custom' + (W !== 8 || H !== 8 ? ' (' + W + ' x ' + H + ')' : '');
    }
    return { new: [opp, false], variants: [vname, V.id !== 'chess'], powers: [pw, n > 0 && !V.checkers], editor: [board, board !== 'Start position' && board !== 'Variant\'s start'] };
  }
  function renderSteps() {
    const box = $('#setupSteps');
    if (!box) return;
    const on = SETUP_STEPS.some((x) => x[0] === ui.tab);
    box.classList.toggle('on', on);
    if (!on) return;
    const vals = stepValues();
    box.innerHTML = SETUP_STEPS.map((x) => '<button data-step="' + x[0] + '" class="' + (ui.tab === x[0] ? 'on' : '') + '" title="' + x[1] + ': ' + vals[x[0]][0] + '">' +
      '<span class="st-top">' + x[2] + '<span>' + x[1] + '</span></span><span class="st-val' + (vals[x[0]][1] ? ' set' : '') + '">' + vals[x[0]][0] + '</span></button>').join('');
    box.querySelectorAll('[data-step]').forEach((b) => { b.onclick = () => { if (ui.tab !== b.dataset.step) setTab(b.dataset.step); }; });
  }

  function renderSummary() {
    const bot = botById(setup.bot), V = Fairy.byId(setup.variant), variant = !stdVariant(V.id), bots = setup.mode === 'bots', local = setup.mode === 'local';
    const lab = botLabel(bot, engineKind() === 'fairy', ownName());
    // the two sets exactly as the next game will use them
    const clean = (pw, botSet) => powerNames(pw).filter((n) => {
      const id = POWER_LIST.find((x) => x.name === n).key;
      return !(id === 'drops' && V.drops) && !(botSet && HUMAN_ONLY.indexOf(id) >= 0 && !(id === 'portals' && setup.ai.use === 'same' && !bots)) && !(local && (id === 'veto' || id === 'puppet'));
    });
    const dumb = !!V.nobrain || !!V.checkers; // no bot power-ups in this variant
    const tagMidas = (names, set) => names.map((n) => (n === 'Midas Touch' && set && set.midasPerTurn === -1 ? 'Midas Touch (uses turn)' : n));
    const otherSet = setup.ai.use === 'own' ? setup.powers2 : setup.powers;
    const first = (bots && dumb) || V.checkers ? [] : tagMidas(clean(setup.powers, bots), setup.powers);
    const other = dumb || setup.ai.use === 'none' ? [] : tagMidas(clean(otherSet, !local), otherSet);
    const colors = { w: 'White', b: 'Black', r: 'a random color' };
    const clock = CLOCKS.find((c) => c[0] === setup.clock)[1];
    // a headline, then one labelled row per setting; rows that do not apply are left out
    const rows = [], row = (k, v) => rows.push('<dt>' + k + '</dt><dd>' + v + '</dd>');
    const pw = (names) => (names.length ? '<b>' + names.join(', ') + '</b>' : 'none');
    let head;
    if (bots) {
      const lb = (b) => botLabel(botById(b.bot), prefEngine(b.engine) === 'fairy', ownName()), lw = lb(setup.botW), lk = lb(setup.botB);
      head = 'Bot match';
      row('White', '<b>' + lw.name + '</b> (' + lw.tag + ')');
      row('Black', '<b>' + lk.name + '</b> (' + lk.tag + ')');
    } else if (local) {
      head = 'Two players at one board';
      if (setup.flipEach) row('Board', 'turns after each move');
    } else {
      head = 'You against <b>' + lab.name + '</b> <span class="tag">(' + lab.tag + ')</span>';
      row('You play', colors[setup.color]);
    }
    row('Clock', setup.clock ? clock : 'none');
    if (variant || V.dice || V.duckChess) row('Variant', '<b>' + (V.id === 'custom' && custom ? custom.title : V.name) + '</b>');
    const anticipate = !local && !dumb && (first.length || other.length) && setup.ai.anticipate;
    if (!first.length && !other.length) row('Power-ups', 'none');
    else if (setup.ai.use === 'same' && (bots || local)) row('Power-ups', 'both sides: ' + pw(first));
    else if (bots || local) { row('White has', pw(first)); row('Black has', pw(other)); }
    else { row('You have', pw(first)); row('Bot has', setup.ai.use === 'same' ? 'the same' : pw(other)); }
    if (anticipate) row('Bots', bots ? 'see the power-ups coming' : 'sees yours coming');
    const pos = [];
    if (!variant && setup.fen !== R.START_FEN) pos.push(V.id === 'chess' && checkersBoard(setup.fen) ? '<b>checkers board</b>, played by checkers rules' : '<b>custom</b>');
    if (V.checkers && checkersBoard(setup.fen) && setup.fen !== V.fen) pos.push('<b>from the board editor</b>');
    if (autoKC().on && !V.dice && !V.duckChess) pos.push('<b>king capture</b>, take the king to win');
    if (stdVariant(V.id) && hasTraits(setup.traits)) {
      const T = setup.traits, n = (l) => (l || []).length;
      pos.push([n(T.ghosts) ? n(T.ghosts) + ' ghost' : '', n(T.snipers) ? n(T.snipers) + ' camo' : '', n(T.helmets) ? n(T.helmets) + ' helmet' : '', n(T.vests) ? n(T.vests) + ' vest' : ''].filter(Boolean).join(', ') + ' by hand');
    }
    if (pos.length) row('Position', pos.join(', '));
    let html = '<div class="sumhead">' + head + '</div><dl class="sumgrid">' + rows.join('') + '</dl>';
    const errs = startErrs();
    if (errs.length) html += '<div class="err">' + errs[0] + '</div>';
    $('#summary').innerHTML = html;
    $('#startBtn').disabled = errs.length > 0;
  }

  function renderSettings() {
    const th = $('#themes');
    th.innerHTML = '';
    th.innerHTML = boardGroups(settings.theme, 'data-board');
    th.querySelectorAll('[data-board]').forEach((b) => { b.onclick = () => { settings.theme = b.dataset.board; changed(); }; });
    const ps = $('#pieceSets');
    ps.innerHTML = '';
    PIECE_SETS.forEach((t) => {
      const b = h('button', settings.pieces === t[0] ? 'on' : '', '<i style="background-image:url(' + pieceDir(t[0]) + 'wN.svg)"></i><i style="background-image:url(' + pieceDir(t[0]) + 'bQ.svg)"></i><span>' + t[1] + '</span>');
      b.onclick = () => {
        if (settings.pieces === t[0]) return;
        settings.pieces = t[0];
        SKIN.camo = {}; SKIN.gold = {}; SKIN.ice = {}; SKIN.icecamo = {}; SKIN.goldcamo = {}; SKIN.ready = false;
        buildSkins(); // the vines and the gold are painted from the pictures of the set
        changed();
      };
      ps.appendChild(b);
    });
    // the shogi pieces: wood as the original (the sides told apart by where they point), or a white and a black piece
    const ss = $('#shogiStyle');
    ss.innerHTML = '';
    [[false, 'Wood', 'shogi'], [true, 'Black and white', 'shogibw']].forEach((t) => {
      const b = h('button', !!settings.shogiBW === t[0] ? 'on' : '', '<i style="background-image:url(pieces/fairy/w_' + t[2] + '_king.svg)"></i><i style="background-image:url(pieces/fairy/b_' + t[2] + '_rook.svg)"></i><span>' + t[1] + '</span>');
      b.onclick = () => {
        if (!!settings.shogiBW === t[0]) return;
        settings.shogiBW = t[0];
        SKIN.camo = {}; SKIN.gold = {}; SKIN.ice = {}; SKIN.icecamo = {}; SKIN.goldcamo = {}; SKIN.ready = false;
        buildSkins();
        changed();
      };
      ss.appendChild(b);
    });
    const rows = [
      ['evalBar', 'Evaluation bar', 'With power-ups in standard chess or Dice Chess the bar comes from the power-up search, which knows gold and frozen pieces. In the other variants Fairy-Stockfish judges the plain position and a short power-up search corrects it'],
      ['legal', 'Show legal moves', 'Dots and rings on the squares a selected piece can reach'],
      ['premove', 'Premoves', 'Choose your next move while the engine is still thinking'],
      ['multiPremove', 'Multi-premoves', 'Queue several moves in a row. They are played one per turn, and if one is no longer possible the rest is dropped. A right click or a click on an empty square cancels them'],
      ['coords', 'Coordinates', ''],
      ['sound', 'Sounds', ''],
      ['anim', 'Piece animation', ''],
      ['autoQueen', 'Always promote to a queen', 'Skips the promotion menu']
    ].concat(window.PWA && PWA.touch ? [['haptics', 'Vibration', 'A short buzz for moves, captures, checks and shots']] : []);
    const box = $('#setrows');
    box.innerHTML = '';
    rows.forEach((r) => {
      const el = h('div', 'setrow', '<div>' + r[1] + (r[2] ? '<small>' + r[2] + '</small>' : '') + '</div>');
      const sw = h('button', 'sw' + (settings[r[0]] ? ' on' : ''));
      sw.onclick = () => {
        settings[r[0]] = !settings[r[0]];
        if (r[0] === 'premove' || r[0] === 'multiPremove') ui.premoves = [];
        changed();
        if (r[0] === 'evalBar' && settings.evalBar && G) analyse();
      };
      el.appendChild(sw);
      box.appendChild(el);
    });
    // a phone shows the names only; the explanation comes when a row is held
    if (window.PWA && PWA.touch) box.querySelectorAll('.setrow').forEach((r) => { const sm = r.querySelector('small'); if (sm) r.title = sm.textContent; });
  }

  /* Settings, App: install it as an app (when the browser offers it), and a backup of everything this device keeps
     (games, puzzles, progress, settings) as a file, to move to another phone or to keep. */
  function renderAppBox() {
    const box = $('#appBox');
    if (!box) return;
    box.innerHTML = '';
    if (window.PWA && PWA.canInstall()) {
      const r = h('div', 'setrow', '<div>Install Power Chess<small>On your home screen, full screen and offline, like any app from the store.</small></div>');
      const b = h('button', 'btn green sm', 'Install');
      b.onclick = () => PWA.install().then(renderAppBox);
      r.appendChild(b); box.appendChild(r);
    }
    const ri = h('div', 'setrow', '<div>Introduction<small>The welcome and the guided first game.</small></div>');
    const ib = h('button', 'btn sm', 'Show');
    ib.onclick = showIntro;
    ri.appendChild(ib); box.appendChild(ri);
    const r2 = h('div', 'setrow', '<div>Backup<small>Your games, puzzles, Game Mode progress and settings as one file.</small></div>');
    const ex = h('button', 'btn sm', 'Save'), im = h('button', 'btn sm', 'Load');
    ex.onclick = exportBackup;
    im.onclick = () => $('#backupFile').click();
    const btns = h('div', 'app-btns'); btns.appendChild(ex); btns.appendChild(im); r2.appendChild(btns);
    box.appendChild(r2);
  }
  function exportBackup() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('powerchess') === 0) data[k] = localStorage.getItem(k); }
    const blob = new Blob([JSON.stringify({ app: 'Power Chess', v: 1, saved: new Date().toISOString(), data: data })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'power-chess-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function importBackup(file) {
    const rd = new FileReader();
    rd.onload = () => {
      let o = null;
      try { o = JSON.parse(rd.result); } catch (e) { o = null; }
      if (!o || o.app !== 'Power Chess' || !o.data) { toast('That file is not a Power Chess backup'); return; }
      if (!confirm('Replace the games, puzzles, progress and settings on this device with the backup?')) return;
      Object.keys(localStorage).filter((k) => k.indexOf('powerchess') === 0).forEach((k) => localStorage.removeItem(k));
      Object.keys(o.data).forEach((k) => { if (k.indexOf('powerchess') === 0) localStorage.setItem(k, o.data[k]); });
      try { MS = Modes.migrate(JSON.parse(localStorage.getItem(MODES_KEY))); MS.rev = (MS.rev || 0) + 1e6; pushModes(); } catch (e) { /* no progress in it */ }
      setTimeout(() => location.reload(), 300);
    };
    rd.readAsText(file);
  }

  function applySettings() {
    if (window.PWA) PWA.haptics = settings.haptics !== false;
    applyBoard(settings.theme, document.body.classList.contains('shogigame'));
    document.body.classList.toggle('nocoords', !settings.coords);
  }

  function revalidate() {
    try {
      const cfg = setupCfg(setup.color === 'b' ? 'b' : 'w');
      cfg.kingCapture = autoKC().on;
      if (ckRules()) cfg.checkers = true; // no king needed, who cannot move loses
      if (setup.variant === 'duck') { cfg.duckChess = true; cfg.kingCapture = true; }
      cfg.freeArmy = !!ownName() || (setup.mode === 'bots' ? (prefEngine(setup.botW.engine) === 'fairy' && prefEngine(setup.botB.engine) === 'fairy') : setup.mode === 'local' || engineKind() === 'fairy');
      const s0 = R.fromFen(setup.fen, cfg);
      if ((s0.W || 8) !== 8 || (s0.H || 8) !== 8) cfg.freeArmy = true; // no standard army to compare with
      if (setup.terrain && setup.terrain.holes) cfg.terrain = setup.terrain;
      ed.errs = R.validate(s0, cfg);
    } catch (e) { ed.errs = [e.message]; }
  }

  // Any change to setup or settings ends up here.
  function changed() {
    save();
    applySettings();
    revalidate();
    renderSetup(); renderVariants(); renderPowers(); renderSettings(); renderSummary(); renderSteps(); renderAppBox();
    if (ui.tab === 'editor') renderEditor();
    renderAll();
  }

  /* ---------- game modes ----------
     Dice Chess Arena (bets in credits) and the Ouroboros Run (a roguelike under The Ouroboros King's rules).
     The rules of both live in js/modes.js. Here: saving, starting and resuming the games, settling them at the
     end, and the Game Modes page. The progress is kept twice: in the browser and, through the server, in a
     file outside the project folder (app.py, /api/modes). Every save counts a revision; the newer copy wins.
     A mode game in progress is saved after every action and can be resumed after a reload or a restart, so
     leaving a game neither loses it nor gets anyone out of a lost one. */
  const MODES_KEY = 'powerchess_modes';
  let MS = Modes.fresh(), msTimer = null, msSel = null, gmTab = 'home';
  let msPeek = null; // a piece kind whose card is open, picked from the army list or the reward offers
  try { const t0 = localStorage.getItem('powerchess_gmtab'); gmTab = ['run', 'sk', 'pb', 'daily', 'dice', 'drawback', 'hex', 'shogi'].indexOf(t0) >= 0 ? t0 : 'home'; } catch (e) { /* first visit */ }
  // Hexagonal Chess settings, like Drawback Chess
  let hexSet = { bot: 'b3', side: 'w', match: null };
  try { hexSet = Object.assign(hexSet, JSON.parse(localStorage.getItem('powerchess_hexset')) || {}); } catch (e) { /* first visit */ }
  const saveHexSet = () => { try { localStorage.setItem('powerchess_hexset', JSON.stringify(hexSet)); } catch (e) { /* private mode */ } };
  // the Dice Arena's own switches: two players on this device, and turning the board
  let diceSet = { twoP: false, flip: true };
  try { diceSet = Object.assign(diceSet, JSON.parse(localStorage.getItem('powerchess_diceset')) || {}); } catch (e) { /* first visit */ }
  // Shogi on the Game Modes page: the opponent, who moves first, two players
  let sgSet = { bot: 'b3', side: 'w', twoP: false, flip: true };
  try { sgSet = Object.assign(sgSet, JSON.parse(localStorage.getItem('powerchess_shogiset')) || {}); } catch (e) { /* first visit */ }
  const saveSgSet = () => { try { localStorage.setItem('powerchess_shogiset', JSON.stringify(sgSet)); } catch (e) { /* private mode */ } };
  const SETS = { db: () => dbSet, hx: () => hexSet, dc: () => diceSet, sg: () => sgSet };
  const saveSets = () => { saveDbSet(); saveHexSet(); saveSgSet(); try { localStorage.setItem('powerchess_diceset', JSON.stringify(diceSet)); } catch (e) { /* private mode */ } };
  /* Two players at one device (Drawback Chess, the Dice Arena, Hexagonal Chess): nothing is counted, no credits, no
     wins, no drawback progress. The board can turn to whoever is to move. */
  function twoPRows(key) {
    const set = SETS[key]();
    if (set.flip == null) set.flip = true;
    return '<div class="tp-set"><div class="setrow"><div>Two players on this device<small>Nothing is counted: no credits, wins or drawback progress.</small></div><button class="sw' + (set.twoP ? ' on' : '') + '" data-tp="' + key + '" title="Two players"></button></div>' +
      (set.twoP ? '<div class="setrow"><div>Turn the board after each move<small>Whoever is to move sees the board from their side.</small></div><button class="sw' + (set.flip ? ' on' : '') + '" data-tpflip="' + key + '" title="Turn the board"></button></div>' : '') + '</div>';
  }
  // Drawback Chess settings: your opponent, your colour ('r' = random), or a match of two bots
  let dbSet = { bot: 'b3', side: 'r', match: null, q: '' };
  try { dbSet = Object.assign(dbSet, JSON.parse(localStorage.getItem('powerchess_dbset')) || {}); } catch (e) { /* first visit */ }
  const saveDbSet = () => { try { localStorage.setItem('powerchess_dbset', JSON.stringify(dbSet)); } catch (e) { /* private mode */ } };
  try { MS = Modes.migrate(JSON.parse(localStorage.getItem(MODES_KEY))); } catch (e) { MS = Modes.fresh(); }
  function saveModes() {
    MS.rev = (MS.rev || 0) + 1;
    MS.updated = Date.now();
    try { localStorage.setItem(MODES_KEY, JSON.stringify(MS)); } catch (e) { /* private mode: the server copy still keeps it */ }
    clearTimeout(msTimer);
    msTimer = setTimeout(() => { msTimer = null; pushModes(); }, 120); // cleared once sent: leaving the page then sends nothing stale
    renderModesBadge();
  }
  function pushModes() {
    if (window.PC_WEB) return; // the web build: the browser's copy is the only one (Settings, Backup)
    fetch('api/modes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(MS) })
      .then((r) => { if (r.status === 409) pullModes(); }) // the server has a newer copy (another tab): take that one
      .catch(() => { /* no server (opened as a file): the browser copy is it */ });
  }
  function pullModes() {
    if (window.PC_WEB) return Promise.resolve();
    return fetch('api/modes', { cache: 'no-store' }).then((r) => r.json()).then((srv) => {
      if (!srv || !srv.v) { if (MS.rev) pushModes(); return; } // nothing there yet: hand over the browser's copy
      const win = Modes.newer(MS, srv);
      if (win === MS) { if ((MS.rev || 0) > (srv.rev || 0)) pushModes(); return; }
      MS = Modes.migrate(srv);
      try { localStorage.setItem(MODES_KEY, JSON.stringify(MS)); } catch (e) { /* see above */ }
      renderModesBadge();
      if (ui.tab === 'modes') { renderModes(); renderAll(); }
    }).catch(() => {});
  }
  // Another tab saved: its copy is newer, so this tab takes it (and cannot start a second game on the same stake).
  function syncModes() {
    try {
      const o = JSON.parse(localStorage.getItem(MODES_KEY));
      if (o && o.v && Modes.newer(MS, o) !== MS) { MS = Modes.migrate(o); return true; }
    } catch (e) { /* nothing stored */ }
    return false;
  }
  window.addEventListener('storage', (e) => {
    if (e.key !== MODES_KEY || !syncModes()) return;
    renderModesBadge();
    if (ui.tab === 'modes') { renderModes(); renderAll(); }
  });
  // the last word on leaving the page, in case a save was still waiting
  window.addEventListener('pagehide', () => {
    if (!msTimer || window.PC_WEB) return;
    try { navigator.sendBeacon('api/modes', new Blob([JSON.stringify(MS)], { type: 'application/json' })); } catch (e) { /* nothing more to do */ }
  });

  // numbers with dots between the thousands: 10000 is written 10.000
  const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const ranked = () => !!(G && G.spec && G.spec.gameMode && G.spec.gameMode.kind !== 'hex' && !G.spec.gameMode.twoP && !G.over); // a mode game is running: no undo, hints or eval (Hexagonal Chess keeps them)
  const modeGame = () => !!(G && G.spec && G.spec.gameMode && G.spec.gameMode.kind !== 'hex' && !G.spec.gameMode.twoP);
  function modeChip(gm) {
    if (gm.twoP) return ({ dice: 'Dice Chess', drawback: 'Drawback Chess', hex: 'Hexagonal Chess' })[gm.kind] || 'Game Mode';
    if (gm.kind === 'dice') { const t = Modes.tier(gm.tier); return 'Dice Arena, ' + t.name + (t.cost ? ': ' + num(t.cost) + ' staked' : ''); }
    if (gm.kind === 'drawback') return 'Drawback Chess';
    if (gm.kind === 'hex') return 'Hexagonal Chess';
    return 'Ouroboros King, battle ' + gm.stage;
  }
  function modeProgress() {
    const gm = G && G.spec && G.spec.gameMode;
    if (!gm) return;
    syncModes();
    if (!MS.pending || MS.pending.id !== gm.id) return;
    MS.pending.actions = actionsOf(G);
    saveModes();
  }
  // The fixed settings of a mode game.
  function modeSpec(kind, o) {
    return {
      mode: o.local ? 'local' : o.bots ? 'bots' : 'human', variant: kind === 'dice' ? 'dice3' : 'chess', engine: 'fairy', bot: o.bot, bots: o.bots || null, flipEach: !!(o.local && o.flip),
      side: o.side, powers: noPowers(), powers2: null, ai: { anticipate: false, use: 'none' },
      seed: kind === 'dice' ? Math.floor(Math.random() * 0x7fffffff) + 1 : 0,
      fen: o.fen || null, customIni: null, clock: 0, terrain: o.terrain || null, kingCapture: kind === 'run' || kind === 'drawback', traits: null, diceV: 2,
      drawback: o.drawback || null,
      gameMode: { id: o.id, kind: kind, tier: o.tier || null, stage: o.stage || 0, opts: o.opts || null, twoP: !!o.local }
    };
  }
  async function startMode(kind, arg) {
    if (starting) return;
    syncModes();
    const two = !!(arg && typeof arg === 'object' && arg.twoP); // two players at this device: nothing is staked or kept
    if (MS.pending && !(kind === 'drawback' && arg && arg.match) && kind !== 'hex' && !two) { toast('Finish or give up the unfinished game first'); return; } // a bot match is only watched
    ui.info = null; msPeek = null; // a card from the Game Modes page does not follow into the game
    let spec;
    if (kind === 'dice' && two) {
      spec = modeSpec('dice', { id: 'd' + Date.now(), bot: 'b1', side: 'w', local: true, flip: arg.flip, opts: JSON.parse(JSON.stringify(arg)) });
    } else if (kind === 'dice') {
      const t = Modes.tier(arg);
      if (!t || !Modes.canBet(MS, arg)) { toast('Not enough credits for this table'); return; }
      spec = modeSpec('dice', { id: 'd' + Date.now(), tier: arg, bot: t.bot, side: Math.random() < 0.5 ? 'w' : 'b' });
    } else if (kind === 'hex') {
      // Hexagonal Chess (Gliński): you against a bot, or a match of two bots; nothing at stake, so no pending game
      const o = arg || hexSet, side = o.match || o.twoP ? 'w' : o.side === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : o.side;
      const bots = o.match && !o.twoP ? { w: { engine: 'fairy', bot: o.match.w }, b: { engine: 'fairy', bot: o.match.b } } : null;
      spec = modeSpec('hex', { id: 'h' + Date.now(), bot: o.bot, side: side, bots: bots, local: !!o.twoP, flip: o.flip, opts: JSON.parse(JSON.stringify(o)) });
      spec.hex = true;
    } else if (kind === 'drawback') {
      // arg: { bot, side ('w', 'b' or 'r'), match: { w, b } for a bot match }. Both drawbacks are dealt at random.
      const o = arg || dbSet, seed = Math.floor(Math.random() * 0x7fffffff) + 1, side = o.match || o.twoP ? 'w' : o.side === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : o.side;
      const bots = o.match && !o.twoP ? { w: { engine: 'fairy', bot: o.match.w }, b: { engine: 'fairy', bot: o.match.b } } : null;
      spec = modeSpec('drawback', { id: 'x' + Date.now(), bot: o.bot, side: side, bots: bots, local: !!o.twoP, flip: o.flip, drawback: Drawbacks.deal(seed), opts: JSON.parse(JSON.stringify(o)) });
    } else {
      const run = ouroRun();
      if (!run || !run.battle) return; // only a battle that has been dealt
      const cfg = Ouro.battleCfg(run);
      spec = modeSpec('run', { id: 'r' + Date.now(), stage: run.won + 1, bot: run.battle.bot, side: 'w', fen: Ouro.battleFen(run), terrain: cfg.terrain });
      // the items the run holds, as the power-ups they work like (how many are left is counted by the app), and the Fire gem
      const it = run.items, pw = spec.powers;
      if (it.shackles) pw.freeze = true;
      if (it.sphere) pw.shield = true;
      if (it.chair) { pw.tempo = true; pw.tempoMax = 99; }
      if (Ouro.has(run, 'firegem')) pw.firegem = true;
      const ou = Ouro.battleFlags(run);
      if (ou) pw.ou = ou;
    }
    if (!leaveRunning('A game is still running. Starting this one counts as a resignation. Resign it?')) return;
    let g;
    starting = true;
    try { g = await createGame(spec); } catch (e) { toast('The game could not be set up: ' + (e.message || 'unknown reason')); return; } finally { starting = false; }
    if (kind === 'dice' && !two) Modes.placeBet(MS, arg); // the stake is paid now (two players stake nothing)
    // a bot match is only watched: nothing to keep, nothing to count
    if (!spec.bots && kind !== 'hex' && !two) MS.pending = { id: spec.gameMode.id, kind: kind, spec: JSON.parse(JSON.stringify(g.spec)), actions: [], tier: spec.gameMode.tier, stage: spec.gameMode.stage, started: Date.now() };
    saveModes();
    installGame(g);
    botBrain.fresh(); evalBrain.fresh();
    snd('start');
    setTab('play');
    afterAction(true);
  }
  // Back to the unfinished game: the same start, every action replayed (the dice are seeded, so they fall the same).
  async function resumePending() {
    syncModes();
    const p = MS.pending;
    if (!p || starting) return;
    if (G && G.spec && G.spec.gameMode && G.spec.gameMode.id === p.id && !G.over) { setTab('play'); return; }
    let g;
    starting = true;
    try {
      g = await createGame(JSON.parse(JSON.stringify(p.spec)));
      replay(g, p.actions || []);
    } catch (e) {
      starting = false;
      voidPending('The game could not be restored after an update (' + (e.message || 'unknown reason') + '). ');
      return;
    }
    starting = false;
    g.view = g.states.length - 1;
    g.legal = g.B.legal(g.states[g.view]);
    g.keys = {};
    g.states.forEach((s, i) => { if (i && g.log[i - 1].roll) return; const k = g.B.key(s); g.keys[k] = (g.keys[k] || 0) + 1; }); // throws are no repetitions (see afterAction)
    installGame(g);
    if (p.used) G.ouUsed = p.used;
    botBrain.fresh(); evalBrain.fresh();
    setTab('play');
    afterAction(true);
  }
  // A game that cannot be restored is called off: the stake comes back, the stage stays.
  function voidPending(why) {
    const p = MS.pending;
    if (!p) return;
    if (p.kind === 'dice') MS.dice.credits += Modes.tier(p.tier).cost;
    MS.pending = null;
    saveModes();
    toast(why + (p.kind === 'dice' ? 'The stake was paid back.' : p.kind === 'drawback' ? 'It does not count.' : 'The stage can be played again.'));
    renderModes();
  }
  function giveUpPending() {
    syncModes();
    const p = MS.pending;
    if (!p || !confirm(p.kind === 'dice' ? (Modes.tier(p.tier).cost ? 'Give up this game? The stake is lost.' : 'Give up this game? It counts as a loss.') : 'Give up this stage? That ends the run.')) return;
    if (G && G.spec && G.spec.gameMode && G.spec.gameMode.id === p.id && !G.over) { finish({ over: true, result: R.other(G.cfg.side), reason: 'resignation' }); setTab('play'); return; } // the game on the board: an ordinary resignation
    if (p.kind === 'dice') Modes.settleDice(MS, p.tier, 'l'); else if (p.kind === 'drawback') Modes.settleDrawback(MS, p.spec.drawback[p.spec.side].id, 'l'); else Ouro.settle(MS, 'l', {});
    MS.pending = null;
    saveModes();
    renderModes();
  }
  // Called from finish(): settles the bet or the stage once. Returns the line for the end card, or null.
  function settleMode(res) {
    const gm = G.spec && G.spec.gameMode;
    G.modeEnd = null;
    if (!gm) return null;
    syncModes();
    if (gm.twoP) { G.modeEnd = { kind: gm.kind, twoP: true, outcome: res, opts: gm.opts }; return 'Two players at one device: nothing is counted.'; }
    if (gm.kind === 'hex') {
      G.modeEnd = { kind: 'hex', outcome: res, opts: gm.opts };
      if (G.auto || G.counted2) return null;
      G.counted2 = true;
      const hx = MS.hex;
      hx.played++; if (res === 'w') hx.won++; else if (res === 'l') hx.lost++; else hx.drawn++;
      saveModes();
      return 'Hexagonal Chess: ' + hx.won + ' won, ' + hx.drawn + ' drawn, ' + hx.lost + ' lost.';
    }
    if (gm.kind === 'drawback' && G.auto) { G.modeEnd = { kind: 'drawback', outcome: res, opts: gm.opts }; return 'White\'s drawback: ' + dbName(G.db.w) + '. Black\'s drawback: ' + dbName(G.db.b) + '.'; }
    if (!MS.pending || MS.pending.id !== gm.id) { G.modeEnd = { kind: gm.kind, tier: gm.tier, outcome: 'done', opts: gm.opts }; return null; } // already settled
    MS.pending = null;
    let line;
    if (gm.kind === 'drawback') {
      const mine = G.db[G.cfg.side], theirs = G.db[R.other(G.cfg.side)];
      Modes.settleDrawback(MS, mine.id, res);
      const r2 = MS.drawback.per[mine.id];
      line = 'Your drawback: ' + dbName(mine) + '. ' + G.botName + '\'s drawback was ' + dbName(theirs) + ': ' + Drawbacks.textOf(theirs) + ' With ' + dbName(mine) + ': ' + r2.w + ' won, ' + r2.d + ' drawn, ' + r2.l + ' lost.';
      G.modeEnd = { kind: 'drawback', outcome: res, opts: gm.opts };
    } else if (gm.kind === 'dice') {
      const t = Modes.tier(gm.tier), pay = Modes.settleDice(MS, gm.tier, res);
      line = (res === 'w' ? 'You won ' + num(pay) + (pay === 1 ? ' credit' : ' credits') : res === 'd' ? 'A draw: your ' + num(t.cost) + ' credits came back' : t.cost ? 'You lost your ' + num(t.cost) + ' credits' : 'No credits lost at the free table') + '. Balance: ' + num(MS.dice.credits) + '.';
      G.modeEnd = { kind: 'dice', tier: gm.tier, outcome: res };
    } else {
      const run = ouroRun(), reason = G.over && G.over.reason;
      if (reason === 'hourglass') { Ouro.restart(run); G.modeEnd = { kind: 'run', outcome: 'again' }; saveModes(); return 'The sand runs back: the battle starts again.'; }
      const r = Ouro.settle(MS, reason === 'smoke' ? 'f' : res, ouroInfo()), out = r ? r.outcome : 'over';
      line = out === 'cleared' ? 'Battle won: +' + num(r.gold) + ' gold. Your reward waits under Game Modes.'
        : out === 'boss' ? 'The witch falls: +' + num(r.gold) + ' gold.'
          : out === 'won' ? 'The Coven falls. Thessalonia is free!'
            : out === 'again' ? 'A draw: the boss battle is fought again.'
              : out === 'fled' ? 'You slip away in the smoke: no reward.'
                : out === 'draw' || out === 'draw-reward' ? 'A draw: no gold' + (out === 'draw-reward' ? ', but the Secret key keeps the reward.' : ' and no reward.')
                  : 'Your King has fallen. The run ends after ' + MS.runs.history[0].cleared + (MS.runs.history[0].cleared === 1 ? ' battle' : ' battles') + ' won.';
      G.modeEnd = { kind: 'run', outcome: out === 'boss' || out === 'won' || out === 'draw-reward' || out === 'draw' || out === 'fled' ? 'cleared' : out };
    }
    saveModes();
    return line;
  }
  function endButtons() {
    const me = G && G.modeEnd, re = $('#endRematch'), nw = $('#endNew');
    endLead(false);
    if (!me) { re.textContent = 'Rematch'; re.disabled = false; nw.textContent = 'New Game'; nw.style.display = ''; return; }
    nw.textContent = 'Game Modes';
    if (me.twoP) { re.textContent = 'Play again'; re.disabled = false; nw.style.display = ''; endLead(true); return; }
    nw.style.display = me.kind === 'run' && me.outcome === 'cleared' ? 'none' : ''; // 'Choose reward' leads there already
    if (me.kind === 'dice') { re.textContent = 'Bet again'; re.disabled = !Modes.canBet(MS, me.tier); endLead(!re.disabled); } // betting again is the suggested way on
    else if (me.kind === 'drawback' || me.kind === 'hex') { re.textContent = G.auto ? 'Another match' : 'Play again'; re.disabled = false; }
    else { re.textContent = me.outcome === 'cleared' ? 'Back to the map' : me.outcome === 'again' ? 'Fight again' : 'New run'; re.disabled = false; endLead(true); } // the run goes on first: the reward, the stage again, or a new run
  }
  // Which end button leads (green, first): Game Review, or the rematch (Bet again in the Dice Arena)
  function endLead(rematch) {
    const rv0 = $('#endReview'), re = $('#endRematch');
    rv0.className = rematch ? 'btn' : 'btn green sm';
    re.className = rematch ? 'btn green sm' : 'btn';
    if (rematch) rv0.parentNode.insertBefore(re, rv0); else re.parentNode.insertBefore(rv0, re);
  }
  function modeRematch() {
    const me = G.modeEnd;
    G.endOpen = false;
    if (me.twoP) { startMode(me.kind, me.opts); return; }
    if (me.kind === 'dice') { startMode('dice', me.tier); return; }
    if (me.kind === 'drawback') { startMode('drawback', me.opts || dbSet); return; }
    if (me.kind === 'hex') { startMode('hex', me.opts || hexSet); return; }
    if (me.outcome === 'again') { startMode('run'); return; }
    setTab('modes');
  }

  /* ---------- the board on the Game Modes page: the next stage, and arranging the army ---------- */
  function modesView() {
    const run = MS.run;
    if (gmTab === 'hex') return { s: Hex.initial(), W: 11, H: 11, glyphs: {}, cfg: null, hex: true };
    if (gmTab === 'daily' || gmTab === 'home') return { s: R.fromFen(R.START_FEN), W: 8, H: 8, glyphs: {}, cfg: null };
    if (gmTab === 'sk') return skView();
    if (gmTab === 'pb') return pbView();
    if (gmTab === 'shogi') return { s: R.fromFen(SHOGI_START, { side: 'w', freeArmy: true }), W: 9, H: 9, glyphs: Fairy.byId('shogi').glyphs, cfg: null };
    if (gmTab === 'dice' || gmTab === 'drawback') return { s: R.fromFen(R.START_FEN), W: 8, H: 8, glyphs: {}, cfg: null };
    return ouroView(ouroRun());
  }
  function modesMarks(mark) {
    // Shotgun King: a king in check is marked as in every other game
    if (gmTab === 'sk') { skMarks(mark); return; }
    if (gmTab === 'pb') { pbMarks(mark); return; }
    const run = ouroRun();
    if (gmTab !== 'run' || !run || run.battle || run.reward) return;
    if (run.edit && run.edit.kind === 'place') Ouro.freeCells(run, run.edit.piece).map(Ouro.sq).forEach((q) => mark(q, 'homesq'));
    else if (!run.edit) {
      Ouro.CELLS.forEach((c) => mark(Ouro.sq(c), 'homesq'));
      if (msSel) mark(Ouro.sq(msSel), 'sel');
    }
  }
  function modesDown(sq) {
    if (gmTab === 'sk') { skDown(sq); return; }
    if (gmTab === 'pb') { pbDown(sq); return; }
    syncModes();
    const run = ouroRun();
    if (gmTab !== 'run' || sq < 0) return;
    const name = Ouro.sqName(sq), v = modesView().s;
    ui.info = v.board[sq] ? sq : null; // the card of the piece clicked, yours or the enemy's, to plan with
    msPeek = null;
    if (!run || run.battle || run.reward) { renderModes(); return; }
    if (run.edit && run.edit.kind === 'place') {
      if (v.board[sq]) { renderModes(); return; } // an occupied square: just its card
      if (!Ouro.placeRecruit(run, name)) { toast(!Ouro.fits(run.edit.piece, name) ? 'This piece cannot stand on the first rank' : 'Pick a free square of your formation: files a to d, ranks 1 and 2'); return; }
      snd('move');
    } else {
      const own = run.army.some((x) => x[0] === name);
      if (!msSel) { if (own) msSel = name; }
      else if (msSel === name) msSel = null;
      else if (Ouro.movePiece(run, msSel, name)) { msSel = null; ui.info = sq; snd('move'); }
      else if (Ouro.CELLS.indexOf(name) < 0) { toast('The formation is files a to d of ranks 1 and 2'); msSel = null; }
      else if (run.army.some((x) => (x[0] === msSel && !Ouro.fits(x[1], name)) || (x[0] === name && !Ouro.fits(x[1], msSel)))) toast('A pawn-like piece cannot stand on the first rank');
      else msSel = own ? name : null;
    }
    saveModes();
    renderModes(); renderAll();
  }
  function modesBar(color) {
    const run = MS.run;
    if (gmTab === 'shogi') return color === 'w' ? { you: true, name: 'You', tag: 'Shogi' } : { you: false, name: sgSet.twoP ? 'Second player' : botLabel(botById(sgSet.bot), true).name, tag: sgSet.twoP ? '' : botLabel(botById(sgSet.bot), true).elo };
    if (gmTab === 'home') return color === 'w' ? { you: true, name: 'You', tag: '' } : { you: false, name: 'Game Modes', tag: '' };
    if (gmTab === 'pb') { const r = pbRun(); return color === 'w' ? { you: true, name: PBM.HERO[r ? r.hero : pbUi.hero].name, tag: r ? r.hearts + ' of ' + r.maxHearts + ' Hearts' : '' } : { you: false, name: PBM.DUNGEON[r ? r.dungeon : pbUi.dungeon].name, tag: r ? pbFloorName(r) : '' }; }
    if (gmTab === 'dice') return color === 'w' ? { you: true, name: 'You', tag: num(MS.dice.credits) + ' credits' } : { you: false, name: 'Dice Arena', tag: 'pick a table' };
    // Shotgun King: the White army at the top, the Black King at the bottom (the bars go by colour, so it is turned round here)
    if (gmTab === 'sk') { const r = skRun(); return color === 'w' ? { you: true, name: 'The Black King', tag: r ? SKM.GUN[r.gun].name : 'Shotgun King' } : { you: false, name: 'The White Army', tag: r ? 'floor ' + Math.min(r.floor, 12) + ', rank ' + r.rank : 'rank ' + Math.min(skUi.rank, skData().maxRank) }; }
    if (gmTab === 'daily') { const d = dailyOf(dayKeyOf(new Date())); return color === d.side ? { you: true, name: 'You', tag: 'Daily challenge' } : { you: false, name: botLabel(botById(d.bot), false).name, tag: botLabel(botById(d.bot), false).elo }; }
    if (gmTab === 'hex') return color === 'w' ? { you: true, name: 'You', tag: 'Hexagonal Chess' } : { you: false, name: botLabel(botById(hexSet.bot), true).name, tag: 'hex engine' };
    if (gmTab === 'drawback') return color === 'w' ? { you: true, name: 'You', tag: 'a hidden drawback' } : { you: false, name: botLabel(botById(dbSet.bot), true).name, tag: 'a hidden drawback' };
    const ou = ouroRun();
    if (color === 'w') return { you: true, name: 'You', tag: ou ? num(ou.gold) + ' gold' : '' };
    if (ou && ou.battle) { const lab = botLabel(botById(ou.battle.bot), true); return { you: false, name: ou.battle.title, tag: lab.elo }; }
    return { you: false, name: ou ? Ouro.ACTS[ou.act].name : 'Ouroboros King', tag: '' };
  }

  /* ---------- the Game Modes page ---------- */
  const unitHow = (l) => {
    const STD = { k: 'Moves one square in any direction', q: 'Slides any distance straight or diagonally', r: 'Slides any distance straight', b: 'Slides any distance diagonally', n: 'Jumps two squares one way and one the other', p: 'Moves forward, takes diagonally forward' };
    const d = R.fairyOf(l);
    return d ? d.how : STD[l.toLowerCase()] || '';
  };
  const unitImg = (l) => '<i class="unit" style="background-image:url(' + pieceSrc(l) + ')"></i>';
  function renderModesBadge() {
    const nav = document.querySelector('.nav[data-tab="modes"]');
    if (nav) nav.classList.toggle('dot', !!MS.pending || !!(MS.run && (MS.run.reward || MS.run.edit)));
  }
  /* The Game Modes page: the two roguelike runs as big cards, the four other modes as tiles. A mode opens on its own
     page with a way back here. */
  const GM_ICON = {
    daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8.5 14.5l2.2 2.2 4.8-4.7"/></svg>',
    dice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3.5"/><g fill="currentColor" stroke="none"><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="15.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="15.5" r="1.5"/></g></svg>',
    drawback: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.5" r=".6" fill="currentColor"/></svg>',
    hex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M12 8l3.5 2v4L12 16l-3.5-2v-4z"/></svg>'
  };
  // the shogi start in the app's own letters, for the board on the Shogi page (the game itself is Fairy-Stockfish's)
  // the Shogi variant's letters (Fairy-Stockfish) and the app's own shogi pieces
  const SHOGI_OWN = { k: 'ѣ', r: 'ѥ', '+r': 'ѧ', b: 'ѩ', '+b': 'ѫ', g: 'ѭ', s: 'ѯ', '+s': 'ѱ', n: 'ѳ', '+n': 'ѵ', l: 'ѹ', '+l': 'ѻ', p: 'ѽ', '+p': 'ѿ' };
  const SHOGI_START = 'ѹѳѯѭѣѭѯѳѹ/1ѥ5ѩ1/ѽѽѽѽѽѽѽѽѽ/9/9/9/ѼѼѼѼѼѼѼѼѼ/1Ѩ5Ѥ1/ѸѲѮѬѢѬѮѲѸ w - - 0 1';
  // the eight pieces and what they promote to, for the Shogi page
  const SHOGI_TABLE = [['ѣ'], ['ѥ', 'ѧ'], ['ѩ', 'ѫ'], ['ѭ'], ['ѯ', 'ѱ'], ['ѳ', 'ѵ'], ['ѹ', 'ѻ'], ['ѽ', 'ѿ']];
  function shogiModeCard() {
    const bots = BOTS.filter((b) => !b.style && !b.hidden), opt = (sel) => bots.map((b) => { const lab = botLabel(b, true); return '<option value="' + b.id + '"' + (b.id === sel ? ' selected' : '') + '>' + (b.max ? 'Max' : lab.name + ' (' + lab.elo + ')') + '</option>'; }).join('');
    const short = (l) => R.FAIRY[l].name.replace(/ \(.*\)$/, '');
    let html = '<section class="gm-card"><div class="gm-head"><h2>Shogi</h2></div>' +
      '<p class="gm-fixed">Japanese chess. What you take joins your hand, and instead of a move you may drop it back on the board.</p>' +
      twoPRows('sg') + '<div class="db-set">' +
      (sgSet.twoP ? '' : '<div class="db-row"><span>Opponent</span><select id="sgBot">' + opt(sgSet.bot) + '</select></div><div class="seg db-side">' + [['w', 'Move first'], ['r', 'Random'], ['b', 'Move second']].map((x) => '<button data-sgside="' + x[0] + '" class="' + (sgSet.side === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>') +
      '<button class="btn green gm-wide" data-gm="sgstart">' + (sgSet.twoP ? 'Play two players' : 'Play') + '</button></div>';
    // the board of a Shogi game: any of them; a two-coloured one gets the star points
    html += '<h3 class="sk-h">Board</h3><div class="sg-boards">' + boardGroups(settings.shogiBoard || 'shogi', 'data-sgboard') + '</div>';
    html += '<h3 class="sk-h">The pieces</h3><div class="sg-pieces">' + SHOGI_TABLE.map((row) => {
      const up = row[1], d = R.FAIRY[row[0]];
      return '<div class="sg-p" title="' + d.how + (up ? '. ' + R.FAIRY[up].how : '') + '"><i style="background-image:url(' + fairyPic('w', d.pic) + ')"></i>' + (up ? '<i style="background-image:url(' + fairyPic('w', R.FAIRY[up].pic) + ')"></i>' : '<i></i>') +
        '<b>' + short(row[0]) + '</b><span>' + (up ? '\u2192 ' + short(up) : '') + '</span></div>';
    }).join('') + '</div>';
    return html + '</section>';
  }
  async function startShogi() {
    if (starting || !leaveRunning('A game is still running. Starting a new one counts as a resignation. Resign it?')) return;
    const two = !!sgSet.twoP;
    const spec = { mode: two ? 'local' : 'human', variant: 'shogi', engine: 'fairy', bot: sgSet.bot, bots: null, flipEach: two && sgSet.flip !== false,
      side: two ? 'w' : sgSet.side === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : sgSet.side, powers: noPowers(), powers2: null, ai: { anticipate: false, use: 'none' },
      seed: Math.floor(Math.random() * 0x7fffffff) + 1, fen: null, customIni: null, clock: 0, terrain: null, kingCapture: false, diceV: 2, traits: null };
    starting = true;
    let g;
    try { g = await createGame(spec); } catch (e) { toast(e.message || 'The game could not be set up'); return; } finally { starting = false; }
    installGame(g);
    botBrain.fresh(); evalBrain.fresh();
    snd('start');
    setTab('play');
    afterAction(true);
  }
  function wireShogi(box) {
    box.querySelectorAll('[data-sgboard]').forEach((x) => { x.onclick = () => { settings.shogiBoard = x.dataset.sgboard; changed(); renderModes(); }; });
    const b = box.querySelector('#sgBot');
    if (b) b.onchange = () => { sgSet.bot = b.value; saveSgSet(); renderAll(); };
    box.querySelectorAll('[data-sgside]').forEach((x) => { x.onclick = () => { sgSet.side = x.dataset.sgside; saveSgSet(); renderModes(); renderAll(); }; });
  }
  function gmHome() {
    const run = MS.run, sk = skData(), skr = sk.run, dkey = dayKeyOf(new Date()), drec = daily[dkey], streak = dailyStreak();
    const big = (tab, img, name, line, stat) => '<button class="gm-big" data-gmtab="' + tab + '"><i class="gm-art" style="background-image:' + img + '"></i><span class="gm-txt"><b>' + name + '</b><span>' + line + '</span></span><em>' + stat + '</em></button>';
    const tile = (tab, name, stat) => '<button class="gm-tile" data-gmtab="' + tab + '"><i class="gm-ic">' + GM_ICON[tab] + '</i><b>' + name + '</b><span>' + stat + '</span></button>';
    let html = '<div class="gm-home"><h3 class="gm-cat">Runs</h3>';
    html += big('run', 'url(pieces/fairy/w_wyrm.svg)', 'Ouroboros King', 'Grow an army, stage by stage', ouroRun() ? 'Act ' + Math.min(4, ouroRun().act + 1) : MS.runs.best ? 'Best ' + MS.runs.best : '');
    html += big('sk', 'url(pieces/fairy/b_shotgunking.svg)', 'Shotgun King', 'One king, one shotgun', skr && skr.phase !== 'lost' && skr.phase !== 'won' ? 'Floor ' + Math.min(skr.floor, 12) : 'Rank ' + Math.min(skUi.rank, sk.maxRank));
    const pbr = pbRun();
    if (PBM) html += big('pb', 'url(' + PB_ART + 'h_pawnbarian.svg)', 'Pawnbarian', 'Chess cards against monsters', pbr && !pbr.over ? (pbr.gauntlet ? 'Gauntlet ' + pbr.gauntlet : 'Floor ' + pbr.floor) : pbData().won ? pbData().won + ' won' : '');
    html += '<h3 class="gm-cat">Other games</h3>';
    html += big('shogi', 'url(' + fairyPic('w', 'shogi_king') + ')', 'Shogi', 'Japanese chess, with drops', '');
    html += '<h3 class="gm-cat">Chess twists</h3><div class="gm-tiles">';
    html += tile('daily', 'Daily', drec ? (drec.r === 'w' ? 'Won today' : 'Played today') : streak ? 'Streak ' + streak : 'New today');
    html += tile('dice', 'Dice Arena', num(MS.dice.credits) + ' credits');
    html += tile('drawback', 'Drawback', 'A secret weakness');
    html += tile('hex', 'Hexagon', '91 hexagons');
    return html + '</div></div>';
  }
  function renderModes() {
    const box = $('#modesBox');
    if (!box) return;
    renderModesBadge();
    const d = MS.dice, run = MS.run, p = MS.pending;
    let html = '';
    if (p) {
      html += '<div class="gm-pend"><b>Unfinished game</b><span>' + (p.kind === 'dice' ? 'Dice Arena, ' + Modes.tier(p.tier).name + ' table' : p.kind === 'drawback' ? 'Drawback Chess' : 'Ouroboros King, stage ' + p.stage) +
        ', ' + (p.actions || []).filter((a) => a[0] === 'm' || a[0] === 'M').length + ' moves so far.</span><div class="gm-row"><button class="btn green" data-gm="resume">Resume</button><button class="btn" data-gm="giveup">Give up</button></div></div>';
    }
    document.body.dataset.gm = gmTab; // the phone shows the list of modes without a board
    html += gmTab === 'home' ? gmHome() : '<button class="gm-back" data-gmtab="home">All modes</button>';
    // Dice Chess Arena
    if (gmTab === 'dice') html += '<section class="gm-card"><div class="gm-head"><h2>Dice Chess Arena</h2><div class="gm-credits"><b>' + num(d.credits) + '</b><span>credits</span></div></div>' +
      '<p class="gm-fixed">Three dice a turn, all of them used. Take the king to win. Pay the entry, win double.</p>' + twoPRows('dc') + (diceSet.twoP ? '<button class="btn green gm-wide" data-gm="dc2start">Play two players</button>' : '') + (p && !diceSet.twoP ? '<p class="gm-block">Finish or give up the unfinished game first.</p>' : '') + '<div class="gm-tiers">';
    if (gmTab === 'dice' && !diceSet.twoP) Modes.DICE_TIERS.forEach((t, i) => {
      const bot = botById(t.bot), ok = Modes.canBet(MS, t.id), rec = d.tiers[t.id], lv = i + 1;
      const why = p ? 'An unfinished game is waiting' : d.credits < t.cost ? 'You need ' + num(t.cost) + ' credits' : '';
      const tip = (why ? why + '. ' : '') + (bot.max ? 'Max' : bot.name) + ', level ' + lv + (rec ? '. ' + rec.w + ' won, ' + rec.d + ' drawn, ' + rec.l + ' lost' : '');
      html += '<button class="gm-tier' + (ok ? '' : ' locked') + '" data-tier="' + t.id + '"' + (ok ? '' : ' disabled') + ' title="' + tip + '"><b>' + t.name + '</b><span class="gm-bet">' +
        (t.cost ? num(t.cost) + ' \u2192 ' + num(t.win) : 'win ' + t.win) + '</span></button>';
    });
    if (gmTab === 'dice') html += '</div><div class="gm-stats">' + d.played + (d.played === 1 ? ' game' : ' games') + ': ' + d.won + ' won, ' + d.drawn + ' drawn, ' + d.lost + ' lost. Highest balance ' + num(d.best) + '.</div></section>';
    if (gmTab === 'run') html += ouroCard(ouroRun(), p);
    if (gmTab === 'drawback') html += drawbackCard(p);
    if (gmTab === 'hex') html += hexModeCard();
    if (gmTab === 'daily') html += dailyModeCard();
    if (gmTab === 'sk') html += skCard();
    if (gmTab === 'pb') html += pbCard();
    if (gmTab === 'shogi') html += shogiModeCard();
    box.innerHTML = html;
    // the card of the piece last clicked on the board, as in a game
    const slot = $('#gmCard'), pv = gmTab !== 'run' ? null : msPeek || (ui.info != null ? modesView().s.board[ui.info] : null);
    if (slot && pv) slot.appendChild(pieceCard(pv, { pw: { w: null, b: null } }, msPeek ? null : modesView().s)); // on the board: what a mimic copies from the line-up
    wireModes(box);
  }
  /* ---------- The Ouroboros King: the run (js/ouro.js) ----------
     The page: the act and its map (places to travel to, bottom to top, the boss at the top), gold, Rewinds, relics and
     items, and whatever the run waits for: a reward to pick, a recruit to place, a battle to fight. The board shows the
     formation (files a to d of the first two ranks), to arrange before travelling, and the battle once it is dealt. */
  let ouSel = null, ouStart = [], obGet = null; // the place picked on the map, the units picked for a start, the obelisk's offer picked
  const ouroRun = () => (MS.run && MS.run.v === 2 ? MS.run : null);
  const OU_ICON = {
    recruit: '<path d="M7 21V4M7 5h10l-2.5 3.5L17 12H7"/>',
    upgrade: '<path d="M13 5l6 6-2.5 2.5-6-6zM10.5 7.5 4 14l3 3 6.5-6.5M3 21h8"/>',
    ruins: '<path d="M6 21h12M8 21V10M16 21v-8l-2-2M8 10l2-3h3M11 21v-6"/>',
    shop: '<path d="M9 4h6l-1.5 3h-3zM12 7c-3.5 0-6 2.5-6 6.5S8.5 20 12 20s6-2.5 6-6.5S15.5 7 12 7zM12 10.5v6M10.3 12.2c.4-.9 3-.9 3.4 0 .4 1-3.4 1.2-3 2.3.4 1 3 .9 3.4 0"/>',
    obelisk: '<path d="M10 20l1-13 1-3 1 3 1 13zM7 20h10"/>',
    boss: '<path d="M4 20V9h3v3h2.5V9h5v3H17V9h3v11zM10 20v-4h4v4M12 4v3"/>',
    manor: '<path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6"/>'
  };
  const OU_COLOR = { recruit: '#5c8f3a', upgrade: '#9a6a2c', ruins: '#6a5f8f', shop: '#b08a2a', obelisk: '#4f7688', boss: '#9c3030', manor: '#555' };
  const ouIcon = (type, size) => '<svg class="ou-ic" viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + OU_ICON[type] + '</svg>';
  const relicChip = (id) => { const r = Ouro.RELICS[id]; return '<span class="ou-chip relic' + (r.premium ? ' prem' : '') + '" title="' + r.text + '">' + r.name + '</span>'; };
  const itemChip = (id, n) => { const it = Ouro.ITEMS[id]; return '<span class="ou-chip item" title="' + it.text + '">' + it.name + (n > 1 ? ' x' + n : '') + '</span>'; };
  // the act's map, as an SVG: Ouroboros Manor at the bottom, the rows above it, the boss on top
  function ouroMap(run) {
    const m = run.map, rows = m.rows, W = 300, gap = 54, H = gap * (rows.length + 1) + 44, opts = Ouro.options(run);
    const yOf = (row) => H - 22 - gap * (row + 1), xOf = (p) => 30 + p.x * (W - 60);
    const pos = {}; rows.forEach((row) => row.forEach((p) => { pos[p.id] = [xOf(p), yOf(p.row)]; }));
    pos.boss = [W / 2, rows.length ? yOf(rows.length) : H / 2]; const manor = [W / 2, H - 22];
    const done = run.done, here = run.at;
    let g = '<svg class="ou-map" viewBox="0 0 ' + W + ' ' + H + '">';
    const line = (a, b, on) => { g += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" class="' + (on ? 'walked' : '') + '"/>'; };
    if (rows.length) {
      rows[0].forEach((p) => line(manor, pos[p.id], done.indexOf(p.id) >= 0));
      rows.forEach((row) => row.forEach((p) => p.next.forEach((id) => line(pos[p.id], pos[id], done.indexOf(p.id) >= 0 && done.indexOf(id) >= 0))));
    } else line(manor, pos.boss, false);
    const node = (id, type, xy, r) => {
      const can = opts.indexOf(id) >= 0, was = done.indexOf(id) >= 0, at = here === id, sel = ouSel === id;
      g += '<g class="ou-node' + (can ? ' can' : '') + (was ? ' done' : '') + (at ? ' here' : '') + (sel ? ' sel' : '') + '"' + (can ? ' data-onode="' + id + '"' : '') + ' transform="translate(' + xy[0] + ',' + xy[1] + ')">' +
        '<title>' + (type === 'manor' ? 'Ouroboros Manor' : type === 'boss' ? Ouro.ACTS[run.act].boss + ': ' + Ouro.ACTS[run.act].witchName : Ouro.PLACES[type].name) + '</title>' +
        '<circle r="' + r + '" fill="' + OU_COLOR[type] + '"/><g transform="translate(' + (-r * 0.62) + ',' + (-r * 0.62) + ') scale(' + (r * 1.24 / 24) + ')" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + OU_ICON[type] + '</g></g>';
    };
    node('manor', 'manor', manor, 13);
    rows.forEach((row) => row.forEach((p) => node(p.id, p.type, pos[p.id], 16)));
    node('boss', 'boss', pos.boss, 20);
    return g + '</svg>';
  }
  function ouroCard(run, p) {
    let html = '<section class="gm-card ouro"><div class="gm-head"><h2>Ouroboros King</h2><div class="gm-credits"><b>' + MS.runs.best + '</b><span>most battles won</span></div></div>';
    if (!run) {
      if (!MS.runs.count) {
        html += '<p class="gm-fixed">The Coven of three witches has taken the Kingdom of Thessalonia. Lead the Ouroboros King through three lands to their castle. Every place on the map is a battle; what kind of place it is decides your reward. Lose your King and the run is over.</p>' +
          '<p class="gm-fixed">You start with a Knight, a Bishop and a Rook, 500 gold and 5 Rewinds.</p><button class="btn green gm-wide" data-gm="ourostart">Start a run</button>';
      } else {
        const offer = Ouro.startOffer(MS.runs.count * 7919 + 17), okNow = Ouro.startOk(ouStart);
        html += '<p class="gm-fixed">Pick three units to start with, at most one of tier 2.</p><div class="ou-picks">' + offer.map((l) => {
          const on = ouStart.indexOf(l) >= 0, t2 = Ouro.tierOf(l) === 2;
          return '<button class="ou-pick' + (on ? ' on' : '') + '" data-ostart="' + l + '" title="' + Ouro.title(l) + ': ' + unitHow(l) + '">' + unitImg(l.toUpperCase()) + '<b>' + Ouro.title(l) + '</b>' + (t2 ? '<em>tier 2</em>' : '') + '</button>';
        }).join('') + '</div><button class="btn green gm-wide" data-gm="ourostart"' + (okNow ? '' : ' disabled') + '>Start a run</button>';
      }
      if (MS.runs.history.length) html += '<div class="gm-stats">Runs: ' + MS.runs.count + (MS.runs.wins ? ', ' + MS.runs.wins + ' won' : '') + '. Battles won in the last ones: ' + MS.runs.history.slice(0, 8).map((x) => x.won ? x.cleared + ' (won)' : x.cleared).join(', ') + '.</div>';
      return html + '</section>';
    }
    const A = Ouro.ACTS[run.act];
    html += '<div class="ou-top"><b>' + (run.act < 3 ? 'Act ' + (run.act + 1) + ': ' : 'The end: ') + A.name + '</b><span class="ou-gold">' + num(run.gold) + ' gold</span><span class="ou-rw" title="Rewinds take back a move and the answer to it">' + run.rewinds + ' Rewinds</span></div>';
    const items = Object.keys(run.items).filter((k) => run.items[k] > 0);
    html += '<div class="ou-chips">' + run.relics.map(relicChip).join('') + items.map((k) => itemChip(k, run.items[k])).join('') + '</div>';
    if (run.over && run.over.won) {
      html += '<div class="sk-end won"><b>The Coven is beaten. Thessalonia is free.</b><span>' + run.won + ' battles won.</span></div><button class="btn green gm-wide" data-gm="ouroclose">New run</button>';
      return html + '</section>';
    }
    const rw = run.reward;
    if (rw) html += ouroReward(run, rw);
    else if (run.edit && run.edit.kind === 'place') {
      html += '<div class="gm-edit"><h3>Place your ' + Ouro.title(run.edit.piece) + '</h3><p>' + unitImg(run.edit.piece) + 'Click a free square of your formation (files a to d, ranks 1 and 2)' + (run.edit.price ? '. It costs ' + num(run.edit.price) + ' gold' : '') + '.</p><button class="gm-link" data-gm="ouback">Choose another</button></div>';
    } else if (run.battle) {
      const b = run.battle, lab = botLabel(botById(b.bot), true), pl = b.boss ? null : Ouro.PLACES[b.type];
      html += '<div class="ou-battle"><div class="ou-place">' + ouIcon(b.boss ? 'boss' : b.type, 22) + '<b>' + (b.boss ? Ouro.ACTS[b.act].boss : pl.name) + '</b></div>' +
        '<h3>' + b.title + '</h3><p>' + (b.black.length - 1) + ' enemy units and the General. The bot plays at ' + lab.elo + (b.terrain ? '. With boulders' + (b.terrain.portals.length ? ' and portals' : '') : '') + '.</p>' +
        '<p>' + (pl ? pl.text + '. ' : '') + 'The battle pays ' + b.reward + ' gold, 4 less with every move.</p>' +
        (p ? '<p class="gm-block">Finish or give up the unfinished game first.</p>' : '<button class="btn green gm-wide" data-gm="fight">Fight</button>') + '</div>';
    } else {
      const opts = Ouro.options(run), sel = ouSel && opts.indexOf(ouSel) >= 0 ? Ouro.place(run, ouSel) : null;
      html += ouroMap(run);
      if (sel) {
        const name = sel.type === 'boss' ? A.boss : Ouro.PLACES[sel.type].name, text = sel.type === 'boss' ? 'The boss: ' + A.witchName + '. Pays gold only' : Ouro.PLACES[sel.type].text;
        html += '<div class="ou-sel">' + ouIcon(sel.type, 20) + '<div><b>' + name + '</b><span>' + text + '.</span></div></div><button class="btn green gm-wide" data-gm="travel">Travel there</button>';
      } else html += '<p class="gm-fixed ou-hint">Pick where to go next on the map. Before you travel, arrange your army on the board: click a piece, then a square of the formation.</p>';
    }
    html += '<div class="gm-army"><span class="gm-lab">Your army, ' + run.army.length + ' of 8</span><div class="gm-units">' + run.army.map((x) => '<button class="gm-unit" data-peek="' + x[1] + '" title="' + Ouro.title(x[1]) + ': ' + unitHow(x[1]) + '">' + unitImg(x[1]) + '</button>').join('') + '</div></div>';
    html += '<div id="gmCard"></div><button class="gm-link" data-gm="abandon">Abandon this run</button>';
    return html + '</section>';
  }
  // what the run waits for after a battle: the place's reward (any can be left), or a boss's gold
  function ouroReward(run, rw) {
    let html = '<div class="gm-reward">';
    const won = rw.gold != null && !rw.boss ? '<p class="gm-fixed">Battle won: +' + num(rw.gold) + ' gold.</p>' : '';
    if (rw.kind === 'gold') {
      html += rw.boss ? '<h3>' + (rw.last ? 'The Coven falls' : Ouro.ACTS[run.act].witchName + ' falls') + '</h3><p class="gm-fixed">+' + num(rw.gold) + ' gold.' + (rw.last ? '' : ' On to ' + Ouro.ACTS[run.act + 1].name + '.') + '</p>'
        : won + '<p class="gm-fixed">' + (rw.instead ? 'Nothing to take here' + (run.army.length >= 8 ? ' (your army is full)' : '') + ': +' + rw.instead + ' gold instead.' : '') + '</p>';
      return html + '<button class="btn green gm-wide" data-gm="oleave">Continue</button></div>';
    }
    const card = (i, img, title, text, price, off) => '<button class="gm-pick ou-card' + (off ? ' off' : '') + '" data-otake="' + i + '"' + (off ? ' disabled' : '') + '>' + img + '<b>' + title + (price != null ? ' <i class="ou-price">' + (price ? num(price) + ' gold' : 'free') + '</i>' : '') + '</b><span>' + text + '</span></button>';
    if (rw.kind === 'recruit') {
      html += won + '<h3>Training grounds: recruit a unit</h3><div class="gm-picks">' + rw.offers.map((o, i) => card(i, unitImg(o.l), Ouro.title(o.l), unitHow(o.l), o.price, run.gold < o.price)).join('') + '</div>';
    } else if (rw.kind === 'upgrade') {
      html += won + '<h3>Armory: upgrade a unit</h3><div class="gm-picks">' + rw.offers.map((o, i) => card(i, unitImg(o.from) + '<em>to</em>' + unitImg(o.to), Ouro.title(o.from) + ' to ' + Ouro.title(o.to), unitHow(o.to), null, false)).join('') + '</div>';
    } else if (rw.kind === 'ruins') {
      html += won + '<h3>Ruins: take a relic</h3><div class="gm-picks">' + rw.offers.map((o, i) => card(i, '', Ouro.RELICS[o.id].name + (Ouro.RELICS[o.id].premium ? ' (premium)' : ''), Ouro.RELICS[o.id].text, o.price, run.gold < o.price)).join('') + '</div>';
    } else if (rw.kind === 'shop') {
      html += won + '<h3>Shop: buy items</h3><div class="gm-picks">' + rw.offers.map((o, i) => card(i, '', Ouro.ITEMS[o.id].name + (o.qty > 1 ? ' x' + o.qty : '') + (o.sold ? ' (bought)' : ''), Ouro.ITEMS[o.id].text, o.price, o.sold || run.gold < o.price)).join('') + '</div>';
    } else if (rw.kind === 'obelisk') {
      // give up a unit for a tier 3 unit, or a relic (or all gold and Rewinds) for a premium relic
      html += won + '<h3>Sacrificial obelisks</h3><p class="gm-fixed">Give something up for something better.</p>';
      html += '<div class="gm-lab">A unit of yours for one of these</div><div class="gm-picks">' + rw.units.map((l) => '<button class="gm-pick' + (obGet === l ? ' on' : '') + '" data-obget="' + l + '">' + unitImg(l) + '<b>' + Ouro.title(l) + '</b><span>' + unitHow(l) + '</span></button>').join('') + '</div>';
      if (obGet && rw.units.indexOf(obGet) >= 0) {
        const can = run.army.filter((x) => !R.isRoyal(x[1]) && Ouro.fits(obGet, x[0]));
        html += '<div class="gm-lab">Which unit goes?</div><div class="gm-units">' + (can.length ? can.map((x) => '<button class="gm-unit" data-obunit="' + x[0] + '" title="' + Ouro.title(x[1]) + '">' + unitImg(x[1]) + '</button>').join('') : '<span class="gm-fixed">None of your units can make room for it.</span>') + '</div>';
      }
      if (rw.relics.length) {
        const own = run.relics.filter((id) => !Ouro.RELICS[id].premium);
        html += '<div class="gm-lab">A relic, or all your gold and Rewinds, for one of these</div><div class="gm-picks">' + rw.relics.map((id) => '<button class="gm-pick' + (obGet === id ? ' on' : '') + '" data-obget="' + id + '"><b>' + Ouro.RELICS[id].name + '</b><span>' + Ouro.RELICS[id].text + '</span></button>').join('') + '</div>';
        if (obGet && rw.relics.indexOf(obGet) >= 0) html += '<div class="gm-units">' + own.map((id) => '<button class="ou-chip relic" data-obrelic="' + id + '" title="' + Ouro.RELICS[id].text + '">' + Ouro.RELICS[id].name + '</button>').join('') + '<button class="ou-chip all" data-obrelic="*">All gold and Rewinds</button></div>';
      }
    }
    return html + '<button class="btn gm-wide" data-gm="oleave">' + (rw.kind === 'shop' ? 'Leave the shop' : 'Leave') + '</button></div>';
  }
  function wireOuro(box) {
    const done = () => { saveModes(); renderModes(); renderAll(); };
    box.querySelectorAll('[data-onode]').forEach((n) => { n.onclick = () => { ouSel = n.dataset.onode; renderModes(); }; });
    box.querySelectorAll('[data-ostart]').forEach((b) => { b.onclick = () => { const l = b.dataset.ostart, i = ouStart.indexOf(l); if (i >= 0) ouStart.splice(i, 1); else if (ouStart.length < 3) ouStart.push(l); renderModes(); renderAll(); }; });
    box.querySelectorAll('[data-otake]').forEach((b) => { b.onclick = () => { syncModes(); const run = ouroRun(), k = run && run.reward && run.reward.kind; if (run && Ouro.take(run, +b.dataset.otake)) { snd(k === 'upgrade' || k === 'shop' || k === 'ruins' ? 'gold' : 'move'); done(); } }; });
    box.querySelectorAll('[data-obget]').forEach((b) => { b.onclick = () => { obGet = obGet === b.dataset.obget ? null : b.dataset.obget; renderModes(); }; });
    box.querySelectorAll('[data-obunit]').forEach((b) => { b.onclick = () => { syncModes(); const run = ouroRun(); if (run && Ouro.take(run, 0, { give: 'unit', at: b.dataset.obunit, get: obGet })) { obGet = null; snd('gold'); done(); } }; });
    box.querySelectorAll('[data-obrelic]').forEach((b) => {
      b.onclick = () => {
        syncModes(); const run = ouroRun(), all = b.dataset.obrelic === '*';
        if (all && !confirm('Give up all your gold (' + num(run.gold) + ') and all your Rewinds (' + run.rewinds + ')?')) return;
        if (run && Ouro.take(run, 0, all ? { give: 'all', get: obGet } : { give: 'relic', id: b.dataset.obrelic, get: obGet })) { obGet = null; snd('gold'); done(); }
      };
    });
  }
  // the Ouroboros pieces of a board: the formation (no battle) or the battle's start
  function ouroView(run) {
    if (run && run.battle) {
      const cfg = Ouro.battleCfg(run);
      return { s: R.fromFen(Ouro.battleFen(run), cfg), W: 8, H: 8, glyphs: {}, cfg: { side: 'w', terrain: cfg.terrain } };
    }
    const b = new Array(64).fill('');
    (run ? run.army : Ouro.startArmy(ouStart.length === 3 && Ouro.startOk(ouStart) ? ouStart : null)).forEach((x) => { b[Ouro.sq(x[0])] = x[1]; });
    return { s: blank(b, 'w'), W: 8, H: 8, glyphs: {}, cfg: null };
  }
  /* Drawback Chess on the Game Modes page: the settings, your record, and the index of every drawback. A drawback
     you have won a game with gets a green border; each shows your games with it. */
  function drawbackCard(p) {
    const d = MS.drawback, bots = BOTS.filter((b) => !b.style && !b.hidden), opt = (sel) => bots.map((b) => { const lab = botLabel(b, true); return '<option value="' + b.id + '"' + (b.id === sel ? ' selected' : '') + '>' + (b.max ? 'Max' : lab.name + ' (' + lab.elo + ')') + '</option>'; }).join('');
    const match = !!dbSet.match;
    let html = '<section class="gm-card"><div class="gm-head"><h2>Drawback Chess</h2><div class="gm-credits"><b>' + num(d.won) + '</b><span>won</span></div></div>' +
      '<p class="gm-fixed">Each side has a secret drawback. Take the king to win.</p>' +
      twoPRows('db') +
      '<div class="db-set">' + (dbSet.twoP ? '' : '<label class="db-check"><input type="checkbox" id="dbMatch"' + (match ? ' checked' : '') + '> Bot match: watch two bots</label>') +
      (dbSet.twoP ? '' : match ? '<div class="db-row"><span>White</span><select id="dbW">' + opt(dbSet.match.w) + '</select></div><div class="db-row"><span>Black</span><select id="dbB">' + opt(dbSet.match.b) + '</select></div>'
        : '<div class="db-row"><span>Opponent</span><select id="dbBot">' + opt(dbSet.bot) + '</select></div><div class="seg db-side">' + [['w', 'White'], ['r', 'Random'], ['b', 'Black']].map((x) => '<button data-dbside="' + x[0] + '" class="' + (dbSet.side === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>') +
      (p && !match && !dbSet.twoP ? '<p class="gm-block">Finish or give up the unfinished game first.</p>' : '<button class="btn green gm-wide" data-gm="dbstart">' + (dbSet.twoP ? 'Play two players' : match ? 'Watch a match' : 'Play') + '</button>') + '</div>' +
      '<div class="gm-stats">' + d.played + (d.played === 1 ? ' game' : ' games') + ': ' + d.won + ' won, ' + d.drawn + ' drawn, ' + d.lost + ' lost. Drawbacks won with: ' + Object.keys(d.per).filter((k) => d.per[k].w > 0).length + ' of ' + Drawbacks.LIST.length + '.</div>';
    const q = (dbSet.q || '').toLowerCase();
    const list = Drawbacks.LIST.slice().sort((a, b) => a.name.localeCompare(b.name));
    html += '<div class="db-head"><h3>All drawbacks</h3><input id="dbQ" type="search" placeholder="Search" value="' + (dbSet.q || '').replace(/"/g, '&quot;') + '"></div><div class="db-grid">' + list.map((x) => {
      const r = d.per[x.id], hide = q && (x.name + ' ' + x.text).toLowerCase().indexOf(q) < 0;
      return '<div class="db-item' + (r && r.w > 0 ? ' won' : '') + '"' + (hide ? ' style="display:none"' : '') + '><b>' + x.name + '</b><span>' + x.text + '</span>' + (r ? '<em>' + r.w + ' won, ' + r.d + ' drawn, ' + r.l + ' lost</em>' : '<em class="dim">not played yet</em>') + '</div>';
    }).join('') + '</div>';
    return html + '</section>';
  }
  /* Hexagonal Chess on the Game Modes page: the rules in short, the settings, your record and the six pieces with
     how they move. */
  function hexModeCard() {
    const d = MS.hex, bots = BOTS.filter((b) => !b.style && !b.hidden), opt = (sel) => bots.map((b) => { const lab = botLabel(b, true); return '<option value="' + b.id + '"' + (b.id === sel ? ' selected' : '') + '>' + (b.max ? 'Max' : lab.name + ' (level ' + b.lv + ')') + '</option>'; }).join('');
    const match = !!hexSet.match;
    let html = '<section class="gm-card"><div class="gm-head"><h2>Hexagonal Chess</h2><div class="gm-credits"><b>' + num(d.won) + '</b><span>won</span></div></div>' +
      '<p class="gm-fixed">Gli\u0144ski\'s chess on 91 hexagons. Stalemate wins.</p>' +
      twoPRows('hx') +
      '<div class="db-set">' + (hexSet.twoP ? '' : '<label class="db-check"><input type="checkbox" id="hxMatch"' + (match ? ' checked' : '') + '> Bot match: watch two bots</label>') +
      (hexSet.twoP ? '' : match ? '<div class="db-row"><span>White</span><select id="hxW">' + opt(hexSet.match.w) + '</select></div><div class="db-row"><span>Black</span><select id="hxB">' + opt(hexSet.match.b) + '</select></div>'
        : '<div class="db-row"><span>Opponent</span><select id="hxBot">' + opt(hexSet.bot) + '</select></div><div class="seg db-side">' + [['w', 'White'], ['r', 'Random'], ['b', 'Black']].map((x) => '<button data-hxside="' + x[0] + '" class="' + (hexSet.side === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>') +
      '<button class="btn green gm-wide" data-gm="hxstart">' + (hexSet.twoP ? 'Play two players' : match ? 'Watch a match' : 'Play') + '</button></div>' +
      '<div class="gm-stats">' + d.played + (d.played === 1 ? ' game' : ' games') + ': ' + d.won + ' won, ' + d.drawn + ' drawn, ' + d.lost + ' lost.</div>' +
      '<div class="db-head"><h3>The pieces</h3></div><div class="hx-pieces"></div>';
    return html + '</section>';
  }
  function wireHex(box) {
    const save = () => { saveHexSet(); renderModes(); renderAll(); };
    const m = box.querySelector('#hxMatch');
    if (m) m.onchange = () => { hexSet.match = m.checked ? { w: hexSet.bot, b: hexSet.bot } : null; save(); };
    ['hxBot', 'hxW', 'hxB'].forEach((id) => { const el = box.querySelector('#' + id); if (el) el.onchange = () => { if (id === 'hxBot') hexSet.bot = el.value; else hexSet.match[id === 'hxW' ? 'w' : 'b'] = el.value; saveHexSet(); renderAll(); }; });
    box.querySelectorAll('[data-hxside]').forEach((b) => { b.onclick = () => { hexSet.side = b.dataset.hxside; save(); }; });
    const gal = box.querySelector('.hx-pieces');
    if (gal) ['K', 'Q', 'R', 'B', 'N', 'P'].forEach((l) => { const c = hexCard(l); c.querySelector('.pinfo-x').remove(); gal.appendChild(c); });
  }
  function wireDrawback(box) {
    const save = () => { saveDbSet(); renderModes(); renderAll(); };
    const m = box.querySelector('#dbMatch');
    if (m) m.onchange = () => { dbSet.match = m.checked ? { w: dbSet.bot, b: dbSet.bot } : null; save(); };
    ['dbBot', 'dbW', 'dbB'].forEach((id) => { const el = box.querySelector('#' + id); if (el) el.onchange = () => { if (id === 'dbBot') dbSet.bot = el.value; else dbSet.match[id === 'dbW' ? 'w' : 'b'] = el.value; saveDbSet(); renderAll(); }; });
    box.querySelectorAll('[data-dbside]').forEach((b) => { b.onclick = () => { dbSet.side = b.dataset.dbside; save(); }; });
    const q = box.querySelector('#dbQ');
    if (q) q.oninput = () => {
      dbSet.q = q.value; saveDbSet();
      const v = q.value.toLowerCase();
      box.querySelectorAll('.db-item').forEach((el) => { el.style.display = !v || el.textContent.toLowerCase().indexOf(v) >= 0 ? '' : 'none'; });
    };
  }
  /* ---------- Shotgun King (the Game Mode; the rules are in shotgun.js) ----------
     The run lives in MS.sk.run and is saved with the other modes after every turn. The board shows it with the
     pieces' hit points and timers, the squares the White army attacks, the king's steps and, while the mouse is
     over the board, the cone his shot would cover. A turn is played in two parts so the board can show them one
     after the other: the king's action (pellets, hits, pieces breaking), then the White army's moves. */
  const SKM = typeof Shotgun !== 'undefined' ? Shotgun : null;
  // the danger squares start hidden, as the original's Squares of Influence do (v2: settings saved before that start hidden too)
  // pick: a card's action waiting for its square ({ k, id } of the action, from: the piece picked first for Hypnosis)
  const skUi = { hover: -1, soul: -1, grenade: false, blade: false, pick: null, busy: false, folly: -1, gun: 'solomon', rank: 1, danger: false };
  try { const o = JSON.parse(localStorage.getItem('powerchess_skset') || 'null'); if (o) { skUi.gun = SKM && SKM.GUN[o.gun] ? o.gun : 'solomon'; skUi.rank = +o.rank || 1; skUi.danger = o.v === 2 && o.danger === true; } } catch (e) { /* first visit */ }
  const skSaveSet = () => { try { localStorage.setItem('powerchess_skset', JSON.stringify({ v: 2, gun: skUi.gun, rank: skUi.rank, danger: skUi.danger })); } catch (e) { /* private mode */ } };
  const skData = () => MS.sk || (MS.sk = Modes.fresh().sk);
  const skRun = () => skData().run;
  const skLive = () => { const r = skRun(); return !!(r && r.F && r.phase === 'play' && !r.F.over); };
  const SK_LETTER = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K', P: 'P', K: 'K' };
  const skBossPic = (p) => (p.t === 'P' ? 'pieces/fairy/w_bosspawn.svg' : p.t === 'K' ? 'pieces/fairy/w_bossking.svg' : p.boss ? 'pieces/fairy/w_bossqueen.svg' : '');
  const skPicOf = (p) => skBossPic(p) || pieceUrl(SK_LETTER[p.t] || 'P');
  function skView() {
    const run = skRun(), b = new Array(64).fill('');
    if (run && run.F && !(run.settled && run.closed)) {
      // a cleared floor: the army is gone, except while the victory sequence still strikes it down piece by piece
      if (run.F.over !== 'won' || skUi.victory) run.F.pieces.forEach((p) => { if (!(skUi.victory && skUi.victory.struck[p.id])) b[p.sq] = SK_LETTER[p.t] || 'P'; });
      // the king's allies are black pieces, his hologram a second king (drawn pale)
      (run.F.allies || []).forEach((a) => { b[a.sq] = a.t; });
      if (run.F.holo >= 0 && run.F.over !== 'dead') b[run.F.holo] = 'ґ';
      if (run.F.over !== 'dead') b[run.F.king] = 'ґ';
    } else { b[60] = 'ґ'; b[4] = 'K'; [11, 12, 13, 18, 21].forEach((q) => { b[q] = 'P'; }); b[6] = 'N'; b[2] = 'B'; } // a first floor, for the look of it
    return { s: blank(b, 'b'), W: 8, H: 8, glyphs: {}, cfg: null, sk: true };
  }
  // hit points and the move timer on every white piece, the bosses drawn bigger
  function skDecorate(els) {
    const run = skRun();
    if (!run || !run.F || (run.settled && run.closed)) { if (els[60]) els[60].style.backgroundImage = skGunKing('b', skUi.gun); return; } // the picked shotgun, before the run
    run.F.pieces.forEach((p) => {
      const el = els[p.sq];
      if (!el) return;
      const boss = skBossPic(p);
      if (boss) { el.style.backgroundImage = 'url(' + boss + ')'; el.classList.add('skboss'); }
      /* As in the game: the hit points as segments (a bar with the number for the big bosses), and the speed as the
         hourglass under the piece, one segment per turn of its speed, the filled ones the turns until it moves; the
         last one flashes red when it moves after your next turn. */
      if (p.max <= 12) el.appendChild(h('i', 'skhp seg' + (p.bleed ? ' bleed' : ''), Array.from({ length: p.max }, (_, i) => '<u class="' + (i < p.hp ? 'on' : '') + '"></u>').join('')));
      else el.appendChild(h('i', 'skhp' + (p.bleed ? ' bleed' : ''), '<b style="width:' + Math.max(0, Math.min(100, p.hp / p.max * 100)) + '%"></b><span>' + p.hp + '</span>'));
      el.appendChild(h('i', 'sktime' + (p.tm <= 1 ? ' now' : ''), Array.from({ length: p.spd }, (_, i) => '<u class="' + (i < p.tm ? 'on' : '') + '"></u>').join('')));
      if (p.mark) el.appendChild(h('i', 'skmark', '☠'));
      if (p.leader) el.classList.add('skleader');
      if (p.spy) el.classList.add('skspy'); // The Mole: a spy wears a mask
      if (p.id === run.F.orb) el.classList.add('skorbed');
      if (p.id === run.F.strafe) el.classList.add('sktarget');
    });
    // the allies: their own hourglass, in green
    (run.F.allies || []).forEach((a) => {
      const el = els[a.sq];
      if (!el) return;
      el.classList.add('skally');
      el.appendChild(h('i', 'sktime ally' + (a.tm <= 1 ? ' now' : ''), Array.from({ length: a.spd }, (_, i) => '<u class="' + (i < a.tm ? 'on' : '') + '"></u>').join('')));
    });
    if (run.F.holo >= 0 && els[run.F.holo] && run.F.holo !== run.F.king) { els[run.F.holo].classList.add('skholo'); els[run.F.holo].style.backgroundImage = skGunKing('b', run.gun); }
    if (run.F.over !== 'dead' && els[run.F.king]) { els[run.F.king].classList.add('skking'); if (run.F.stealth > 0) els[run.F.king].classList.add('skstealth'); els[run.F.king].style.backgroundImage = skGunKing('b', run.gun); }
  }
  // the squares the cards mark: the moat, holes, flagstones, pentagrams, cannonballs, the waypoint; and a king in check
  function skMarks(mark) {
    const r = skRun();
    if (!skLive()) return;
    const F = r.F;
    if (F.moat) for (let f = 0; f < 8; f++) mark(SKM.MOAT * 8 + f, 'water');
    (F.holes || []).forEach((q) => mark(q, 'skhole'));
    (F.stones || []).forEach((q) => mark(q, 'skstone'));
    (F.penta || []).forEach((x) => mark(x.sq, 'skpenta' + (x.on ? '' : ' off')));
    (F.balls || []).forEach((q) => mark(q, 'skball'));
    if (F.way >= 0) mark(F.way, 'skway');
    if (SKM.inCheck(r, F)) mark(F.king, 'check');
  }
  // the actions a card's pick mode can play now (Hypnosis: the pieces first, then the squares of the one picked)
  function skPickActs(run, F, acts) {
    const pk = skUi.pick;
    if (!pk) return [];
    let list = acts.filter((a) => a.k === pk.k && (pk.id == null || a.id === pk.id));
    if (pk.k === 'project') { const s0 = skUi.soul >= 0 ? skUi.soul : list.length ? list[0].soul : -1; list = list.filter((a) => a.soul === s0); }
    if (pk.from != null) list = list.filter((a) => a.from === pk.from);
    return list;
  }
  // the square a pick action is played by: the piece's for the orb and the strafe target, the action's own otherwise
  const skPickSq = (F, a) => (a.k === 'orb' || a.k === 'strafe' ? (F.pieces.find((p) => p.id === a.id) || {}).sq : a.k === 'wand' && a.id === 'wandhypnosis' && skUi.pick && skUi.pick.from == null ? a.from : a.to);
  // the hints: attacked squares, steps, soul moves, blade targets
  function skHints(hint) {
    const run = skRun();
    if (!skLive()) return;
    const F = run.F, acts = SKM.actions(run, F);
    if (skUi.danger) for (let q = 0; q < 64; q++) if (q !== F.king && !SKM.pieceAt(F, q) && SKM.attackedFrom(run, F, q)) hint(q, 'skdanger');
    if (skUi.busy) return;
    if (skUi.soul >= 0 && !(skUi.pick && skUi.pick.k === 'project')) acts.filter((a) => a.k === 'soul' && a.soul === skUi.soul).forEach((a) => hint(a.to, 'dot sksoul'));
    else acts.filter((a) => a.k === 'move').forEach((a) => hint(a.to, 'dot'));
    if (skUi.blade) acts.filter((a) => a.k === 'blade').forEach((a) => hint(a.to, 'ring'));
    acts.filter((a) => a.k === 'jump').forEach((a) => hint(a.to, 'dot skjump'));
    const seen = {};
    skPickActs(run, F, acts).forEach((a) => { const q = skPickSq(F, a); if (q >= 0 && !seen[q]) { seen[q] = 1; hint(q, SKM.pieceAt(F, q) ? 'ring skpick' : 'dot sksoul'); } });
    // Seer's Orb: where the piece goes next
    const op = F.orb >= 0 ? F.pieces.find((p) => p.id === F.orb) : null, to = op ? SKM.predict(run, F, op) : -1;
    if (to >= 0) hint(to, 'skorbto');
  }
  // the fire cone: the arc around the aim, faint up to the shortest reach, stronger where pellets may stop
  function skCone() {
    const run = skRun();
    if (!skLive() || skUi.busy || skUi.hover < 0 || skUi.soul >= 0 || skUi.pick || run.F.disrupt) return '';
    const F = run.F, q = skUi.hover, st = SKM.stats(run, F);
    if (q === F.king) return '';
    if (skUi.grenade) {
      if (Math.max(Math.abs((q >> 3) - (F.king >> 3)), Math.abs((q & 7) - (F.king & 7))) > 4) return '';
      const c = sqXY(q);
      return '<rect x="' + (c[0] - 1) + '" y="' + (c[1] - 1) + '" width="3" height="3" fill="rgba(255,140,30,.22)" stroke="#ff9a1f" stroke-width=".05" rx=".1"/>';
    }
    if (SKM.actions(run, F).some((a) => (a.k === 'move' && a.to === q) || (skUi.blade && a.k === 'blade' && a.to === q))) return '';
    if (F.gun[0] <= 0) return '';
    return coneSvg(F.king, q, st.arc, st.rmin, st.rmax);
  }
  // the fire cone from square `from` towards q: the near part pale, the band the pellets end in strong, the aim line
  function coneSvg(from, q, arc, rmin, rmax) {
    const st = { arc: arc, rmin: rmin, rmax: rmax };
    const k = sqXY(from), t = sqXY(q), x0 = k[0] + 0.5, y0 = k[1] + 0.5, base = Math.atan2(t[1] + 0.5 - y0, t[0] + 0.5 - x0), half = st.arc * Math.PI / 360;
    const arcPath = (r1, r2) => {
      const a1 = base - half, a2 = base + half, big = half * 2 > Math.PI ? 1 : 0;
      const p = (r, a) => (x0 + Math.cos(a) * r).toFixed(3) + ' ' + (y0 + Math.sin(a) * r).toFixed(3);
      return 'M' + p(r1, a1) + 'L' + p(r2, a1) + 'A' + r2 + ' ' + r2 + ' 0 ' + big + ' 1 ' + p(r2, a2) + 'L' + p(r1, a2) + (r1 > 0 ? 'A' + r1 + ' ' + r1 + ' 0 ' + big + ' 0 ' + p(r1, a1) : '') + 'Z';
    };
    return '<path d="' + arcPath(0.35, st.rmin) + '" fill="rgba(255,90,40,.13)"/><path d="' + arcPath(st.rmin, st.rmax) + '" fill="rgba(255,90,40,.28)" stroke="rgba(255,120,60,.7)" stroke-width=".035"/>' +
      '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + (t[0] + 0.5) + '" y2="' + (t[1] + 0.5) + '" stroke="rgba(255,220,180,.55)" stroke-width=".04" stroke-dasharray=".12 .1"/>';
  }

  /* ---------- the effects: pellets, hits, pieces breaking ---------- */
  function skPellets(from, paths) {
    const k = sqXY(from), x0 = k[0] + 0.5, y0 = k[1] + 0.5, flip = ui.flipped ? -1 : 1;
    paths.forEach((p, i) => {
      const x1 = x0 + Math.cos(p.a) * p.len * flip, y1 = y0 + Math.sin(p.a) * p.len * flip;
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', x0); ln.setAttribute('y1', y0); ln.setAttribute('x2', x1); ln.setAttribute('y2', y1);
      ln.setAttribute('stroke', p.hit >= 0 ? '#ffd27a' : '#ffefc8'); ln.setAttribute('stroke-width', '.05'); ln.setAttribute('stroke-linecap', 'round');
      const len = Math.max(0.1, p.len);
      ln.setAttribute('stroke-dasharray', len + ' ' + len); ln.setAttribute('stroke-dashoffset', len);
      L.arrows.appendChild(ln);
      const an = ln.animate([{ strokeDashoffset: len, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.45 }, { strokeDashoffset: -len, opacity: 0 }], { duration: 420 + i * 12, easing: 'ease-out' });
      an.onfinish = () => ln.remove();
      setTimeout(() => ln.remove(), 900);
      const sp = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      sp.setAttribute('cx', x1); sp.setAttribute('cy', y1); sp.setAttribute('r', p.hit >= 0 ? '.13' : '.07'); sp.setAttribute('fill', p.hit >= 0 ? '#ff7a2a' : '#ffe6b0');
      L.arrows.appendChild(sp);
      sp.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, offset: 0.4 }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 480, easing: 'ease-out' }).onfinish = () => sp.remove();
      setTimeout(() => sp.remove(), 900);
    });
    // a muzzle flash
    const fl = place(h('div', 'skflash'), from);
    L.fx.appendChild(fl);
    setTimeout(() => fl.remove(), 300);
  }
  function skDamage(sq, n, cls) {
    const d = place(h('div', 'skdmg ' + (cls || ''), '-' + (Math.round(n * 10) / 10)), sq);
    L.fx.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }
  // a piece breaks: its picture cut into shards that fly apart, spin and fade
  function skShatter(sq, pic, big) {
    const SH = [[0, 0, 55, 0, 30, 40], [55, 0, 100, 0, 100, 35, 30, 40], [0, 0, 30, 40, 0, 60], [30, 40, 100, 35, 70, 65], [0, 60, 30, 40, 70, 65, 40, 100, 0, 100], [100, 35, 100, 100, 70, 65], [70, 65, 100, 100, 40, 100]];
    SH.forEach((pts) => {
      const d = place(h('div', 'skshard' + (big ? ' big' : '')), sq);
      d.style.backgroundImage = /^url\(/.test(pic) ? pic : 'url(' + pic + ')';
      let poly = '', cx = 0, cy = 0;
      for (let i = 0; i < pts.length; i += 2) { poly += (i ? ',' : '') + pts[i] + '% ' + pts[i + 1] + '%'; cx += pts[i]; cy += pts[i + 1]; }
      cx /= pts.length / 2; cy /= pts.length / 2;
      d.style.clipPath = 'polygon(' + poly + ')';
      const dx = (cx - 50) * (1.6 + Math.random()), dy = (cy - 50) * (1.6 + Math.random()) - 30, rot = (Math.random() - 0.5) * 220;
      L.fx.appendChild(d);
      d.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + dx + '%,' + (dy + 60) + '%) rotate(' + rot + 'deg)', opacity: 0 }], { duration: 760, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
      setTimeout(() => d.remove(), 900);
    });
    const dust = place(h('div', 'skdust'), sq);
    L.fx.appendChild(dust);
    setTimeout(() => dust.remove(), 700);
  }
  // play the events of one part of a turn on the board, then call done
  function skAnimate(ev, before, kingFrom, done) {
    const anims = [];
    let wait = 160, shot = null, dead = null, victory = false;
    ev.forEach((e) => {
      if (e.e === 'king') anims.push({ from: e.from, to: e.to });
      else if (e.e === 'move' && !e.kill) anims.push({ from: e.from, to: e.to });
      else if (e.e === 'move' && e.kill) anims.push({ from: e.from, to: e.to });
      else if (e.e === 'knock') anims.push({ from: e.from, to: e.to });
      else if (e.e === 'swap') { anims.push({ from: e.bTo, to: e.aTo }, { from: e.aTo, to: e.bTo }); }
      else if (e.e === 'shot') shot = e;
      else if (e.e === 'dead') dead = e;
    });
    if (ev.some((e) => e.e === 'cleared')) skUi.victory = { struck: {} }; // the army stays on the board for the lightning
    renderModes(); renderAll(anims);
    if (shot) { skPellets(shot.from, shot.paths); snd('shotgun'); wait = 430; }
    if (ev.some((e) => e.e === 'load')) snd('shell', shot ? 0.25 : 0.06);
    if (ev.some((e) => e.e === 'move')) { snd('move'); wait = Math.max(wait, 260); }
    ev.forEach((e) => {
      if (e.e === 'hit') skDamage(e.sq, e.n, e.cause);
      else if (e.e === 'kill') { const b = before[e.id]; skShatter(e.sq, b ? b.pic : pieceUrl('P'), b && b.boss); }
      else if (e.e === 'fall') skDamage(e.sq, 0, 'fall');
      else if (e.e === 'arrive' || e.e === 'promote') fxRing(e.sq != null ? e.sq : (skRun().F.pieces.find((p) => p.id === e.id) || {}).sq, 'boom');
      else if (e.e === 'grenade') { fxRing(e.to, 'boom'); snd('boom'); wait = 420; }
      else if (e.e === 'wand') { const kf = skRun().F; if (kf) fxRing(kf.king, e.id === 'wandgust' ? 'blue' : 'orange'); snd(e.id === 'wandgust' ? 'portal' : 'shell'); }
      else if (e.e === 'rat') fxTracer(e.from, e.to);
      else if (e.e === 'flip' || e.e === 'unflip') { const cd = SKM.CARD[e.card]; if (cd) toast(cd.name + (e.e === 'flip' ? ' is face down for this floor' : ' is back')); }
      else if (e.e === 'mist') { toast('Black Mist: death passes you by'); fxRing(skRun().F.king, 'boom'); }
      else if (e.e === 'heir') { toast('An heir takes the throne'); fxRing(e.sq, 'boom'); }
      else if (e.e === 'countdown') toast('Final Countdown: ' + e.n + ' turns to finish the floor');
      else if (e.e === 'scare' || e.e === 'stun' || e.e === 'shield' || e.e === 'immune' || e.e === 'heal' || e.e === 'bleed') fxRing(e.sq, 'boom');
      else if (e.e === 'leave') skDamage(e.sq, 0, 'fall');
      else if (e.e === 'strike' || e.e === 'bolt' || (e.e === 'throw' && e.to >= 0)) fxTracer(e.from, e.to);
      else if (e.e === 'ally' || e.e === 'convert' || e.e === 'holo' || e.e === 'lift' || e.e === 'dig' || e.e === 'key' || e.e === 'penta') fxRing(e.sq, 'boom');
      else if (e.e === 'tunnel') fxRing(e.to, 'boom');
      else if (e.e === 'allydead') skShatter(e.sq, pieceUrl(e.t), false);
      else if (e.e === 'stealth') toast(e.n ? 'The king is stealthy for ' + e.n + ' turns' : 'The king is no longer stealthy');
      else if (e.e === 'pentaAll') toast('Unholy Call: every pentagram triggered, +2 firepower for this floor');
      else if (e.e === 'mission' || e.e === 'spy') toast('Disrupt the White Army: pick one');
      else if (e.e === 'disrupt') toast(SK_DISRUPT[e.id] ? SK_DISRUPT[e.id][0] : e.id);
      else if (e.e === 'refill') toast('Wand of Execution is ready again');
      else if (e.e === 'secret') toast('Secret Move: +' + e.n + ' firepower on your next shot');
      else if (e.e === 'cleared') victory = true;
    });
    if (dead) setTimeout(() => { const r0 = skRun(); skShatter(kingFrom, skGunKing('b', r0 && r0.gun), false); snd('lose'); }, 230);
    if (victory) { setTimeout(() => skVictory(done), wait + 250); return; }
    setTimeout(done, dead ? 900 : wait);
  }
  /* The victory sequence: the leader is down, and red lightning strikes the rest of the army, one piece after the
     other, the nearest to where the leader fell first. Then the floor's cards come up. */
  function skVictory(done) {
    const run = skRun(), F = run && run.F;
    if (!F || !F.pieces.length) { skUi.victory = null; snd('win'); setTimeout(done, 500); return; }
    const from = F.leaderSq != null ? F.leaderSq : F.king;
    const list = F.pieces.slice().sort((a, b) => Math.max(Math.abs((a.sq >> 3) - (from >> 3)), Math.abs((a.sq & 7) - (from & 7))) - Math.max(Math.abs((b.sq >> 3) - (from >> 3)), Math.abs((b.sq & 7) - (from & 7))) || a.sq - b.sq);
    if (!skUi.victory) skUi.victory = { struck: {} };
    renderAll();
    const gap = Math.max(160, Math.min(320, 2600 / list.length));
    list.forEach((p, i) => setTimeout(() => {
      const pic = skPicOf(p);
      skLightning(p.sq);
      snd('zap');
      setTimeout(() => {
        if (!skUi.victory) return;
        skUi.victory.struck[p.id] = true;
        renderAll();
        skShatter(p.sq, pic, !!skBossPic(p));
      }, 90);
    }, i * gap));
    setTimeout(() => { skUi.victory = null; snd('win'); renderAll(); setTimeout(done, 450); }, list.length * gap + 380);
  }
  // a red bolt from the top edge of the board down onto a square, flickering, with a flash where it lands
  function skLightning(sq) {
    const xy = sqXY(sq), x = xy[0] + 0.5, y = xy[1] + 0.5, NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + BW + ' ' + BH); svg.setAttribute('class', 'skbolt');
    let pts = [[x + (Math.random() - 0.5) * 0.6, -0.2]], cy = -0.2;
    while (cy < y - 0.35) { cy += 0.35 + Math.random() * 0.3; pts.push([x + (Math.random() - 0.5) * 0.5 * Math.min(1, (y - cy) / 1.5 + 0.2), Math.min(cy, y - 0.1)]); }
    pts.push([x, y]);
    const line = pts.map((q) => q[0].toFixed(3) + ',' + q[1].toFixed(3)).join(' ');
    // a fork off the main bolt
    const k = Math.max(1, Math.floor(pts.length / 2)), fork = [pts[k], [pts[k][0] + (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.3), pts[k][1] + 0.45]].map((q) => q[0].toFixed(3) + ',' + q[1].toFixed(3)).join(' ');
    svg.innerHTML = '<polyline points="' + line + '" fill="none" stroke="#ff2414" stroke-opacity=".35" stroke-width=".26" stroke-linejoin="round"/>' +
      '<polyline points="' + line + '" fill="none" stroke="#ff4a2a" stroke-width=".1" stroke-linejoin="round"/>' +
      '<polyline points="' + line + '" fill="none" stroke="#ffe2d6" stroke-width=".035" stroke-linejoin="round"/>' +
      '<polyline points="' + fork + '" fill="none" stroke="#ff4a2a" stroke-width=".05" stroke-linejoin="round" stroke-opacity=".8"/>';
    L.fx.appendChild(svg);
    svg.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0.35, offset: 0.3 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], { duration: 380, easing: 'linear', fill: 'forwards' });
    setTimeout(() => svg.remove(), 450);
    const fl = place(h('div', 'skzap'), sq);
    L.fx.appendChild(fl);
    setTimeout(() => fl.remove(), 520);
    board.classList.add('skshake'); setTimeout(() => board.classList.remove('skshake'), 160);
  }

  /* ---------- playing a turn ---------- */
  function skDo(a) {
    const run = skRun();
    if (!skLive() || skUi.busy) return;
    const snap = () => { const o = {}; run.F.pieces.concat(run.F.carry && run.F.carry.p ? [run.F.carry.p] : []).forEach((p) => { o[p.id] = { sq: p.sq, pic: skPicOf(p), boss: !!skBossPic(p) }; }); return o; };
    const before = snap(), kingFrom = run.F.king;
    skUi.busy = true; skUi.soul = -1; skUi.grenade = false; skUi.blade = false; skUi.folly = -1; skUi.pick = null;
    const ev1 = SKM.act(run, a, { split: true });
    skAnimate(ev1, before, kingFrom, () => {
      const pre = run.F ? snap() : {}, kq = run.F ? run.F.king : kingFrom;
      const ev2 = run.phase === 'play' && run.F && run.F.pend ? SKM.finish(run) : [];
      const next = () => { skUi.busy = false; skSettle(); saveModes(); renderModes(); renderAll(); if (skLive() && SKM.inCheck(run, run.F)) snd('check'); };
      if (ev2.length) skAnimate(ev2, pre, kq, next); else next();
    });
  }
  // a run that has ended counts once: runs, wins, the best floor of its rank, the next rank opened by a win
  function skSettle() {
    const d = skData(), run = d.run;
    if (!run || run.settled || (run.phase !== 'won' && run.phase !== 'lost')) return;
    run.settled = true;
    d.runs++; d.kills += run.kills;
    d.best[run.rank] = Math.max(d.best[run.rank] || 0, run.phase === 'won' ? 13 : run.floor);
    if (run.phase === 'won') { d.won++; d.wins[run.rank] = (d.wins[run.rank] || 0) + 1; d.maxRank = Math.max(d.maxRank, Math.min(20, run.rank + 1)); }
    MS.rev = (MS.rev || 0) + 1;
  }
  function skDown(sq) {
    const run = skRun();
    if (!skLive() || skUi.busy || sq < 0) return;
    const F = run.F, acts = SKM.actions(run, F), check = SKM.inCheck(run, F);
    const folly = (what) => {
      // a Folly Shield: an action that leaves the king in check is only played on the second click. As in the original
      // not for a shot at an attacker next to the king that the pellets surely kill.
      if (!check || skUi.folly === sq) return true;
      const tp = SKM.pieceAt(F, sq), st0 = SKM.stats(run, F);
      if (what === 'A shot' && tp && SKM.attackedBy(run, F, F.king).indexOf(tp) >= 0 && Math.max(Math.abs((sq >> 3) - (F.king >> 3)), Math.abs((sq & 7) - (F.king & 7))) === 1 && tp.hp <= st0.fp) return true;
      skUi.folly = sq;
      toast('Folly Shield: the king is in check. ' + what + ' leaves him there unless it kills the attacker. Click again to do it anyway.');
      return false;
    };
    if (F.disrupt) { toast('Pick a disruption first'); return; }
    if (skUi.pick) {
      // a card's action waiting for its square (Hypnosis: the piece first, then where it goes)
      const pk = skUi.pick, list = skPickActs(run, F, acts);
      if (pk.k === 'wand' && pk.id === 'wandhypnosis' && pk.from == null && list.some((x) => x.from === sq)) { pk.from = sq; renderAll(); return; }
      let pa = list.find((x) => skPickSq(F, x) === sq);
      if (!pa && pk.k === 'throw') {
        // a throw goes along one of the eight lines from the king: a click anywhere on the line
        const dr = (sq >> 3) - (F.king >> 3), df = (sq & 7) - (F.king & 7);
        if (dr === 0 || df === 0 || Math.abs(dr) === Math.abs(df)) pa = list.find((x) => x.to === F.king + Math.sign(dr) * 8 + Math.sign(df));
      }
      skUi.pick = null;
      if (pa) skDo(pa); else { renderModes(); renderAll(); }
      return;
    }
    if (skUi.soul >= 0) {
      const a = acts.find((x) => x.k === 'soul' && x.soul === skUi.soul && x.to === sq);
      if (a) skDo(a); else { skUi.soul = -1; renderAll(); }
      return;
    }
    if (skUi.grenade) {
      const g = acts.find((x) => x.k === 'grenade');
      if (g && Math.max(Math.abs((sq >> 3) - (F.king >> 3)), Math.abs((sq & 7) - (F.king & 7))) <= 4) skDo({ k: 'grenade', to: sq });
      else { skUi.grenade = false; renderAll(); }
      return;
    }
    const step = acts.find((x) => x.k === 'move' && x.to === sq) || acts.find((x) => x.k === 'jump' && x.to === sq);
    if (step) { skDo(step); return; }
    const blade = acts.find((x) => x.k === 'blade' && x.to === sq);
    if (blade && skUi.blade) { skDo(blade); return; }
    if (sq === F.king) return;
    if (F.gun[0] <= 0) { toast('The shotgun is empty: a step fills it from the reserve, or press Space to load in place'); return; }
    if (folly('A shot')) { const k0 = skUi.decree && acts.some((x) => x.k === 'decree') ? 'decree' : 'shoot'; skUi.decree = false; skDo({ k: k0, to: sq }); }
  }
  function skReload() {
    const run = skRun();
    if (!skLive() || skUi.busy) return;
    if (run.F.disrupt) { toast('Pick a disruption first'); return; }
    const acts = SKM.actions(run, run.F), r = acts.find((a) => a.k === 'reload') || acts.find((a) => a.k === 'wait');
    if (!r) { toast(run.F.gun[1] <= 0 ? 'No shells left in reserve: a step brings one back' : 'The shotgun is full'); return; }
    if (SKM.inCheck(run, run.F) && skUi.folly !== -2) { skUi.folly = -2; toast('Folly Shield: the king is in check, standing still is death. Press again to do it anyway.'); return; }
    skDo(r);
  }
  function skStart(again) {
    const d = skData(), last = d.run;
    const gun = again && last ? last.gun : skUi.gun, rank = again && last ? last.rank : Math.min(skUi.rank, d.maxRank);
    d.run = SKM.newRun({ gun: gun, rank: rank, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 });
    skUi.soul = -1; skUi.grenade = false; skUi.blade = false; skUi.busy = false; skUi.pick = null;
    MS.rev = (MS.rev || 0) + 1;
    saveModes(); snd('start'); renderModes(); renderAll();
  }

  /* ---------- the panel ---------- */
  /* The icons on a card: what it does at a glance, read from the card's own data. Stats with their symbol, pieces
     with their picture, a flag (a rule) with its symbol and a short word. */
  const SKI = {
    search: '<circle cx="6.5" cy="6.5" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.6 9.6 14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    grenade: '<circle cx="7.5" cy="9.5" r="5"/><path d="M6 4.5h3V3H6zM9.5 3.5l2.5-1.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    fp: '<circle cx="4" cy="9" r="2.1"/><circle cx="9.5" cy="4.5" r="2.1"/><circle cx="11.5" cy="11" r="2.1"/>',
    arc: '<path d="M8 14L2.5 3.5A12 12 0 0 1 13.5 3.5Z" fill-opacity=".35" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    range: '<path d="M1.5 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    cap: '<rect x="4.5" y="1.5" width="7" height="13" rx="1.5" fill="#d8362a"/><rect x="4.5" y="10.5" width="7" height="4" rx="1" fill="#d6b14a"/>',
    res: '<rect x="1.5" y="3" width="3.6" height="10" rx="1" fill="#d8362a"/><rect x="6.2" y="3" width="3.6" height="10" rx="1" fill="#d8362a"/><rect x="10.9" y="3" width="3.6" height="10" rx="1" fill="#d8362a"/><rect x="1.5" y="10.5" width="13" height="2.5" fill="#d6b14a"/>',
    pierce: '<circle cx="9" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M1 8h14M12 5l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    knock: '<circle cx="4.5" cy="8" r="3" /><path d="M9 8h6M12.5 5l2.5 3-2.5 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    souls: '<path d="M8 1.5c3 2.5 5 5 5 8a5 5 0 0 1-10 0c0-2 1-3.5 2.2-4.6.2 1.8 1.2 2.8 2.3 3-.8-2.4 0-4.6.5-6.4z" fill="#a98bff"/>',
    move: '<path d="M2 12l4-4-4-4M8 12l4-4-4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    mark: '<circle cx="8" cy="7" r="5"/><circle cx="6" cy="7" r="1.3" fill="#fff"/><circle cx="10" cy="7" r="1.3" fill="#fff"/><rect x="5.5" y="11" width="5" height="3.5" rx="1"/>',
    blade: '<path d="M13.5 2.5L6 10l-1 3 3-1 7.5-7.5zM3 11l2 2-1.5 1.5-2-2z"/>',
    hp: '<path d="M8 14S1.5 9.8 1.5 5.6A3.3 3.3 0 0 1 8 4.2a3.3 3.3 0 0 1 6.5 1.4C14.5 9.8 8 14 8 14z" fill="#e0362a"/>',
    spd: '<path d="M3.5 1.5h9M3.5 14.5h9M4.5 1.5c0 4 7 4.5 7 6.5s-7 2.5-7 6.5M11.5 1.5c0 4-7 4.5-7 6.5s7 2.5 7 6.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    leader: '<path d="M2 12.5L1 4l3.8 3.2L8 2l3.2 5.2L15 4l-1 8.5z" fill="#ffd34d" stroke="#8a6a10" stroke-width=".8"/>',
    all: '<rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1"/><rect x="9" y="9" width="5.5" height="5.5" rx="1"/>',
    turn: '<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    clock: '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.5V8l2.5 1.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    bleed: '<path d="M8 1.5C10.5 5 12.5 7.5 12.5 10a4.5 4.5 0 0 1-9 0c0-2.5 2-5 4.5-8.5z" fill="#b3122b"/>',
    rat: '<ellipse cx="7" cy="9.5" rx="5" ry="3.3"/><circle cx="12" cy="7.5" r="2.2"/><path d="M2 10.5C.5 12 1 14 3 14" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    shield: '<path d="M8 1.5l5.5 2v4.2c0 3.4-2.4 5.6-5.5 6.8-3.1-1.2-5.5-3.4-5.5-6.8V3.5z" fill-opacity=".35" stroke="currentColor" stroke-width="1.4"/>',
    swap: '<path d="M2 5h10M9 2l3 3-3 3M14 11H4M7 8l-3 3 3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    edge: '<rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="1.5" y="1.5" width="3.5" height="13" fill-opacity=".6"/>',
    eye: '<path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2"/>',
    jump: '<path d="M2 13c1.5-7 10.5-7 12 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 1.6"/><path d="M11.5 11l2.5 2 1-3" fill="none" stroke="currentColor" stroke-width="1.5"/>'
  };
  // a shotgun's numbers, one per line with its icon: what the selection cards show instead of a text
  function skGunStats(g, cls, now) { // now: the run's gun as it stands (shells loaded, reserve left)
    const L = (now ? [] : [['cap', g.cap + (g.cap === 1 ? ' Shell' : ' Shells')], ['res', g.res + ' Reserve']]).concat([ ['fp', g.fp + ' Pellets'], ['arc', g.arc + '° Spread'], ['range', 'Range ' + g.rmin + '-' + g.rmax]]);
    if (g.pierce) L.push(['pierce', Math.round(g.pierce * 100) + '% Pierce']);
    if (g.blade) L.push(['blade', 'Blade ' + g.blade]);
    if (g.knock) L.push(['knock', Math.round(g.knock * 100) + '% Knockback']);
    if (g.mark) L.push(['mark', 'Marks hits']);
    if (g.reloadOnKill) L.push(['cap', 'Kills reload']);
    if (g.search) L.push(['search', g.search + ' Search per floor']);
    if (g.grenades) L.push(['grenade', g.grenades + ' Grenade']);
    if (g.move > 1) L.push(['move', 'Steps up to ' + g.move]);
    if (g.jump) L.push(['jump', g.jump === 1 ? '1 Jump a turn' : g.jump + ' Jumps a turn']);
    return '<ul class="sk-gstats' + (cls ? ' ' + cls : '') + '">' + L.map((x) => '<li>' + skIcon(x[0]) + '<span>' + x[1] + '</span></li>').join('') + '</ul>';
  }
  // the gun's shells: the magazine, and under it the reserve in the same shells (filled = there, dark = room left)
  const skMag = (loaded, cap, res, resMax) => {
    const pips = (n, of) => Array.from({ length: Math.max(n, of) }, (_, i) => '<i class="' + (i < n ? 'on' : '') + '"></i>').join('');
    return '<span class="sk-mag" title="' + loaded + ' of ' + cap + ' loaded, ' + res + ' in reserve"><span class="sk-shells">' + pips(loaded, cap) + '</span><span class="sk-shells res">' + pips(res, resMax) + '</span></span>';
  };
  const skIcon = (k) => '<svg class="ski-i" viewBox="0 0 16 16" fill="currentColor">' + (SKI[k] || '') + '</svg>';
  const skPieceIcon = (t) => '<i class="ski-p" style="background-image:url(' + pieceUrl(t.toUpperCase()) + ')"></i>';
  const skPieceIconB = (t) => '<i class="ski-p" style="background-image:url(' + pieceUrl(t.toLowerCase()) + ')"></i>'; // a black piece: an ally
  const skNum = (v, unit) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + (unit || '');
  // the small chips of a card the run owns: its numbers as icons (stats, army, HP, speed), from its fx
  function skCardIcons(c) {
    const out = [], chip = (inner) => out.push('<span class="ski">' + inner + '</span>');
    const UNIT = { arc: '°', pierce: '%', knock: '%' }, ICON = { regen: 'res', grenades: 'grenade', gdmg: 'grenade', search: 'search', fright: 'eye', shrapnel: 'fp', jdmg: 'jump' };
    (c.fx || []).forEach((e) => {
      if (e.s && !e.every) chip(skNum(e.s === 'pierce' || e.s === 'knock' ? Math.round(e.v * 100) : e.v, UNIT[e.s]) + skIcon(ICON[e.s] || e.s));
      else if (e.a && !e.after && !e.every) chip(skNum(e.v) + skPieceIcon(e.a));
      else if (e.ally) chip(skNum(e.v) + skPieceIconB(e.ally));
      else if (e.hp) chip(skNum(e.v) + skIcon('hp') + (e.hp === 'leader' ? skIcon('leader') : e.hp === 'all' ? skIcon('all') : skPieceIcon(e.hp)));
      else if (e.spd && !e.every) chip(skNum(-e.v) + skIcon('spd') + (e.spd === 'all' ? skIcon('all') : e.spd === 'leader' ? skIcon('leader') : skPieceIcon(e.spd)));
    });
    return out.length ? '<div class="skv">' + out.join('') + '</div>' : '';
  }

  // the rules' short lines (RULE effects), and what flips a card or switches it off
  const SK_RULE_TEXT = {
    wandfrenzy: ['res', 'Once a floor, free: full gun and ammo'], wandgust: ['spd', 'Once a floor, free: push all back'], wandwings: ['turn', 'Once a floor, free: fly up to 3 squares'],
    wanddownpour: ['fp', 'Once a floor, free: 10 random damage'], wandexecution: ['blade', 'Free: destroy a pawn; kills refill'], wandhypnosis: ['swap', 'Once a floor, free: move a white piece'],
    wandsouls: ['souls', 'Once a floor, free: stun, take a soul'], wandtreachery: ['swap', 'Once a floor, free: turn a neighbour'], wandwrath: ['fp', 'Once a floor, free: Pellets as damage'],
    flagstone: ['jump', 'A flagstone to jump to: +1 Pellet'], cloaking: ['eye', 'Hologram: 6 turns of stealth'], deepwaters: ['shield', 'No attacks from the moat'], elusive: ['shield', 'Pieces about to move can\'t attack'],
    steed: ['swap', 'Your knight takes the blow, carries you'], holoking: ['souls', 'Soul move: a hologram stays'], shotput: ['knock', '+1 Cannonball to throw'], shoulders: ['knock', 'Once a floor: lift and throw a piece'],
    disguise: ['eye', 'Pawn dies: 2 turns of stealth'], shackles: ['clock', 'The orbed piece is bound, slower'], patience: ['search', 'Next black card: any you like'], rapunzel: ['leader', 'First dead rook: a black queen'],
    loafers: ['range', 'Steps fire at a target, +15°'], secretmove: ['jump', 'All jumps used: Pellets for the shot'], orb: ['eye', 'See a piece\'s next move'], shovel: ['move', '2 holes to dig and travel'],
    silencer: ['eye', 'Shots keep your stealth'], smallkey: ['swap', 'Key: remove a rook, free a prisoner'], projection: ['souls', 'A soul becomes an ally'], moat: ['shield', 'A moat across the middle'],
    mole: ['eye', '+1 Spy among the pawns'], undercover: ['turn', 'A waypoint: disrupt the army'], unholy: ['fp', '3 pentagrams: extra turns, +2 Pellets'],
    august: ['eye', 'No piece comes next to you'], mist: ['shield', 'Survive death once a floor'], plague: ['bleed', 'Each turn: 1 random damage'], bloodless: ['all', 'Pawns can\'t attack'],
    boldplan: ['swap', 'Swap one of the white cards'], bushido: ['blade', 'Free execution once a turn'], caltropsSlow: ['spd', 'Bleeding pieces are slower'], caltrops: ['bleed', 'Moving pieces may bleed'],
    fodder: ['fp', 'Pawn souls: +2 Pellets'], jousting: ['turn', 'Extra turn per knight kill'], scope: ['range', 'Aim: -45° Spread, +2 Range'], fearsome: ['eye', 'Kills scare nearby pieces'],
    forceFp: ['cap', 'Full gun: +1 Pellet'], force: ['cap', 'Reload one shell extra'], absolution: ['souls', '+1 Pellet per empty soul'], humanshield: ['eye', 'Pawn kills scare too'],
    grenadeBleed: ['bleed', 'Grenades make pieces bleed'], alms: ['grenade', '+2 damage at the center'], confidence: ['cap', '+1 Pellet per empty shell'], onboarding: ['turn', 'Welcome Gift flips back'],
    presbyopia: ['eye', 'Queens, bishops: no close attack'], rats: ['rat', 'Kills: a rat bites'], terror: ['eye', 'Fear also around the dead'], crown: ['turn', 'Extra turn after a soul'],
    grenadeSafe: ['shield', 'Immune to your grenades'], grenadeStun: ['clock', 'Grenades stun 2 turns'], sawed: ['move', 'Shooting pushes you back'], selective: ['all', 'White moves 2 kinds a turn'],
    smallfry: ['res', 'Pawn kill: +1 Reserve'], poison: ['clock', 'Queens slowed for 15 turns'], bleedHit: ['bleed', 'Hit pieces bleed'], decree: ['cap', 'Fire all shells at once'],
    workshop: ['grenade', 'Every 8 turns: grenade, 2 ammo'], depot: ['res', 'Rook kill: +2 Reserve'], paralysis: ['clock', 'Can\'t act for 6 turns'], anarchy: ['swap', 'Shuffled army, 2 promoted'],
    ascension: ['jump', 'Bishops pass obstacles'], assault: ['jump', 'Pawns: 2 squares first'], bodyguard: ['shield', 'Knights shield the leader'], bouncy: ['knock', 'Fallen pieces come back'],
    buckler: ['shield', 'Leader: max 3 damage a turn'], castle: ['swap', 'Leader swaps with a rook'], cathedral: ['shield', 'Near rooks: max 2 damage'], goalKnights: ['leader', 'Win: all knights dead'],
    goalBishops: ['leader', 'Win: all bishops dead'], goalAll: ['leader', 'Win: every piece dead'], heal: ['hp', 'Bishops heal neighbours'], emergency: ['spd', 'First leader hit: alarm'],
    countdown: ['clock', '6 left: 12 turns to win'], fleshwall: ['shield', 'Pawns fall at turn end'], gatehouse: ['all', 'Rooks raise knights'], governess: ['leader', 'Pawns promote to queens'],
    ironmaiden: ['shield', 'Queens can\'t die'], mistress: ['range', 'Queens move 3 squares'], kite: ['shield', 'Knights block one hit'], knightmare: ['shield', 'Knights hit only when active'],
    lady: ['leader', 'Rooks promote, don\'t kill'], guardian: ['leader', 'Last pawn is crowned'], lightfoot: ['jump', 'Pawns jump over pieces'], lookout: ['clock', 'Kills hurry the backups'],
    mausoleum: ['hp', 'Rook dies: kings take 2'], militia: ['all', 'Pawns: 4 directions'], nomad: ['leader', 'Knights promote too'], pikemen: ['range', 'Pawns hit 2 ahead'],
    plumed: ['hp', 'A knight: +3 HP, diagonals'], prison: ['shield', 'Near rooks: jailed'], mother: ['eye', 'Queen dies: all scared'], saboteur: ['arc', '1 pellet: double spread'],
    sanctity: ['souls', 'No bishop souls'], redbook: ['move', 'Bishops move straight too'], heir: ['leader', 'An heir takes the throne'], heirKing: ['leader', 'The heir becomes a king'],
    undead: ['all', 'Dead pieces rise as pawns'], vampire: ['hp', 'Leader, queens drink blood'], vendetta: ['spd', 'Kills rouse their kind']
  };
  const SK_FLIP_TEXT = { pawnKilled: 'Flips when a pawn dies', reload: 'Flips when you reload', promote: 'Flips when a pawn promotes', queenKilled: 'Flips when a queen dies', bishopAt15: 'Flips: bishop alive at turn 15' };
  const SK_OFF_TEXT = { notEdge: 'Only on the edge', adjacent: 'Off with a piece next to you', noRook: 'Off without rooks', noPawn: 'Off without pawns', noBishop: 'Off without bishops', onlyQueens: 'Off with only queens left', notStealth: 'Only while stealthy' };
  const SK_PIECE = { p: ['Pawn', 'Pawns'], n: ['Knight', 'Knights'], b: ['Bishop', 'Bishops'], r: ['Rook', 'Rooks'], q: ['Queen', 'Queens'], k: ['King', 'Kings'] };
  /* A card's effects, one line each with its icon, the way the shotgun cards show their stats: "+1 Pellet",
     "-10° Spread", "+3 Pawns", "+2 HP Leader", or a short line for a rule. Built from the card's fx, the same list
     the rules use. The card's full text is its tooltip. */
  function skCardLines(c) {
    const L = [], line = (icon, text, rule) => L.push('<li' + (rule ? ' class="rule"' : '') + '>' + icon + '<span>' + text + '</span></li>');
    const one = (v, a, b) => skNum(v) + ' ' + (Math.abs(v) === 1 ? a : b);
    const STAT = { fp: (v) => one(v, 'Pellet', 'Pellets'), arc: (v) => skNum(v, '°') + ' Spread', range: (v) => skNum(v) + ' Range', cap: (v) => one(v, 'Shell', 'Shells'), res: (v) => skNum(v) + ' Reserve',
      pierce: (v) => skNum(Math.round(v * 100), '%') + ' Pierce', knock: (v) => skNum(Math.round(v * 100), '%') + ' Knockback', souls: (v) => one(v, 'Soul slot', 'Soul slots'), move: (v) => skNum(v) + ' Step range',
      mark: () => 'Hits are marked', blade: (v) => skNum(v) + ' Blade', regen: (v) => skNum(v) + ' Regen', grenades: (v) => one(v, 'Grenade', 'Grenades'), gdmg: (v) => skNum(v) + ' Grenade dmg',
      search: (v) => skNum(v) + ' Search', fright: (v) => skNum(v) + ' Fright radius', shrapnel: (v) => skNum(v) + ' Shrapnel', jump: (v) => one(v, 'Jump', 'Jumps'), jdmg: (v) => skNum(v) + ' Jump dmg' };
    const ICON = { regen: 'res', grenades: 'grenade', gdmg: 'grenade', search: 'search', fright: 'eye', shrapnel: 'fp', jdmg: 'jump' };
    // whom it is for: the leader or all pieces by word, a kind of piece by its picture
    const whoTag = (t) => (t === 'leader' ? ' Leader' : t === 'all' ? ' All' : '</span>' + skPieceIcon(t) + '<span hidden>');
    const army = (e) => one(e.v, (SK_PIECE[e.a] || [e.a])[0], (SK_PIECE[e.a] || [e.a, e.a])[1]);
    // army changes of the same size and timing share a line when there are three or more ("-1 each", pictures in a row)
    const fx = (c.fx || []).slice(), groups = {};
    fx.forEach((e) => { if (e.a) { const k = e.v + '|' + (e.after || '') + '|' + (e.every || ''); (groups[k] = groups[k] || []).push(e); } });
    const done = new Set();
    fx.forEach((e) => {
      const g = e.a ? groups[e.v + '|' + (e.after || '') + '|' + (e.every || '')] : null;
      if (g && g.length >= 3) {
        if (done.has(g)) return;
        done.add(g);
        L.push('<li' + (e.after || e.every ? ' class="rule"' : '') + '><span class="skl-pics">' + g.map((x) => skPieceIcon(x.a)).join('') + '</span><span>' + skNum(e.v) + ' each' + (e.after ? ' at turn ' + e.after : e.every ? ' every ' + e.every + ' turns' : '') + '</span></li>');
        return;
      }
      if (e.s && STAT[e.s]) line(skIcon(ICON[e.s] || e.s), STAT[e.s](e.v) + (e.every ? ' every ' + e.every + ' turns' : ''), !!e.every);
      else if (e.a) line(skPieceIcon(e.a), army(e) + (e.after ? ' at turn ' + e.after : e.every ? ' every ' + e.every + ' turns' : ''), !!(e.after || e.every));
      else if (e.ally) line(skPieceIconB(e.ally), one(e.v, 'Ally', 'Allies'));
      else if (e.hp) line(skIcon('hp'), skNum(e.v) + ' HP' + whoTag(e.hp));
      else if (e.spd) line(skIcon('spd'), skNum(-e.v) + ' Speed' + (e.every ? ' every ' + e.every + ' turns' : '') + whoTag(e.spd), !!e.every); // the card's own sign: + is faster
      else if (e.r && SK_RULE_TEXT[e.r]) line(skIcon(SK_RULE_TEXT[e.r][0]), SK_RULE_TEXT[e.r][1], true);
      else if (e.flip) line(skIcon('turn'), SK_FLIP_TEXT[e.flip] || e.flip, true);
      else if (e.off) line(skIcon('eye'), SK_OFF_TEXT[e.off] || e.off, true);
    });
    return '<ul class="skl">' + L.join('') + '</ul>';
  }
  const skCardHtml = (id, run) => {
    const c = SKM.CARD[id];
    if (!c) return '<div class="skc empty">No card left</div>';
    const n = run.cards[id] || 0;
    return '<div class="skc ' + c.color + '" title="' + c.text.split('; ').map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join('. ') + '"><b>' + c.name + '</b>' + skCardLines(c) + (c.max > 1 ? '<i title="' + (n ? 'You have ' + n + ' of ' + c.max : 'Can be taken up to ' + c.max + ' times') + '">' + (n ? n + '/' + c.max : 'x' + c.max) + '</i>' : '') + '</div>';
  };
  const skFloorName = (f) => (f === SKM.BOSS_FLOOR ? 'the White King' : f === SKM.BOSS_PAWN_FLOOR ? 'the Boss Pawn' : 'the king');
  function skCard() {
    if (!SKM) return '<section class="gm-card"><p>Shotgun King did not load.</p></section>';
    const d = skData(), run = d.run;
    let html = '<section class="gm-card sk">';
    if (!run || (run.settled && run.closed)) {
      html += '<div class="gm-head"><h2>Shotgun King</h2></div><p class="gm-fixed">You are the Black King with a shotgun. Kill the leader on each of 12 floors.</p>';
      html += '<h3 class="sk-h">Shotgun</h3><div class="sk-guns">' + SKM.SHOTGUNS.map((g) => '<button class="sk-gun' + (skUi.gun === g.id ? ' on' : '') + '" data-skgun="' + g.id + '" title="' + g.text + '"><i class="sk-gunpic" style="background-image:' + skGunKing('b', g.id) + '"></i><b>' + g.name + '</b></button>').join('') + '</div>';
      const sel = SKM.GUN[skUi.gun] || SKM.SHOTGUNS[0];
      html += '<div class="sk-gunsel">' + skGunStats(sel, 'two') + '</div>'; // the stats of the gun picked, once
      html += '<h3 class="sk-h">Rank</h3><div class="sk-ranks">';
      for (let r = 1; r <= 20; r++) {
        const open = r <= d.maxRank, best = d.best[r];
        html += '<button class="sk-rank' + (Math.min(skUi.rank, d.maxRank) === r ? ' on' : '') + (open ? '' : ' locked') + '" data-skrank="' + r + '"' + (open ? '' : ' disabled title="Win rank ' + (r - 1) + ' first"') + '><b>' + r + '</b>' + (best ? '<i>' + (best >= 13 ? 'won' : 'floor ' + best) + '</i>' : '') + '</button>';
      }
      html += '</div><button class="btn green gm-wide" data-gm="skstart">Start the run</button>';
      html += '<div class="gm-stats">' + d.runs + (d.runs === 1 ? ' run' : ' runs') + ', ' + d.won + ' won, ' + d.kills + ' pieces broken. Rank ' + d.maxRank + ' is open.</div>';
      return html + '</section>';
    }
    const F = run.F, st = SKM.stats(run, F), g = SKM.GUN[run.gun];
    if (skUi.victory) return html + '<div class="gm-head"><h2>Floor ' + Math.min(run.floor, 12) + ' of 12</h2></div><div class="sk-end won"><b>' + (run.floor >= 12 ? 'The White King falls.' : 'The leader falls.') + '</b><span>The rest of the army is struck down.</span></div></section>';
    html += '<div class="gm-head"><h2>Floor ' + Math.min(run.floor, 12) + ' of 12</h2><div class="gm-credits"><b>' + run.rank + '</b><span>rank</span></div></div>';
    if (run.phase === 'won' || run.phase === 'lost') {
      const killer = run.phase === 'lost' && F ? F.pieces.find((p) => p.id === F.killer) : null;
      html += '<div class="sk-end ' + run.phase + '"><b>' + (run.phase === 'won' ? 'The White King falls. The throne is yours again.' : 'The Black King is taken on floor ' + run.floor + (killer ? ' by ' + (killer.boss ? 'the crowned Boss Pawn' : killer.t === 'P' ? 'the Boss Pawn' : killer.t === 'K' ? 'the White King' : 'a ' + SKM.NAMES[killer.t].toLowerCase()) : F && F.killer === -2 ? ' by his own grenade' : '') + '.') + '</b><span>' + g.name + ', rank ' + run.rank + ', ' + run.kills + ' pieces broken in ' + run.turns + ' turns.</span></div>' +
        '<div class="gm-row"><button class="btn green" data-gm="skagain">Same shotgun and rank again</button><button class="btn" data-gm="skclose">Back</button></div>';
      return html + skOwned(run) + '</section>';
    }
    if (run.phase === 'cards') {
      html += '<p class="gm-fixed">Floor ' + run.floor + ' cleared. Take one pair: the black card is yours, the white card goes to the army.</p><div class="sk-pairs">' +
        run.offer.map((pr, i) => '<div class="sk-pair">' + skCardHtml(pr[0], run) + skCardHtml(pr[1], run) + '<button class="btn green" data-skpair="' + i + '">Take this pair</button></div>').join('') + '</div>' +
        (run.searchLeft > 0 ? '<button class="btn gm-wide" data-gm="sksearch">Search: draw a new offer (' + run.searchLeft + ' left)</button>' : '');
      // Patience: the black card of this pick may be any from the deck; it goes into both pairs
      const br = SKM.browsable(run);
      if (br.length) html += '<h3 class="sk-h">Patience: any black card for this pick</h3><div class="sk-browse">' + br.map((id) => '<button class="btn' + (run.offer[0][0] === id ? ' on' : '') + '" data-skbrowse="' + id + '" title="' + SKM.CARD[id].text.split('; ').map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join('. ') + '">' + SKM.CARD[id].name + '</button>').join('') + '</div>';
      return html + skOwned(run) + '</section>';
    }
    const shells = skMag(F.gun[0], st.cap, F.gun[1], st.res);
    html += '<div class="sk-row"><i class="sk-gunpic small" style="background-image:' + skGunKing('b', run.gun) + '"></i><b>' + g.name + '</b>' + shells + '</div>' + skGunStats(Object.assign({}, g, st), 'grid', F.gun);
    const slots = [];
    for (let i = 0; i < st.souls; i++) {
      const t = run.souls[i];
      slots.push(t ? '<button class="sk-soul' + (skUi.soul === i ? ' on' : '') + '" data-sksoul="' + i + '" title="' + (t === 'p' ? 'Feed this pawn\'s soul to your next shot: +2 firepower' : 'Spend the ' + SKM.NAMES[t].toLowerCase() + '\'s soul: move once like a ' + SKM.NAMES[t].toLowerCase()) + '" style="background-image:url(' + pieceUrl(t.toUpperCase()) + ')"></button>' : '<span class="sk-soul empty" title="An empty soul slot: kill a knight, bishop, rook or queen"></span>');
    }
    html += '<div class="sk-row"><span>Souls</span>' + slots.join('') + '</div>';
    const leader = F.pieces.find((p) => p.leader), check = SKM.inCheck(run, F);
    const goal = !leader && F.goal ? (F.goal.indexOf('all') >= 0 ? 'Kill every piece.' : 'Kill all ' + F.goal.map((g) => ({ n: 'knights', b: 'bishops' })[g]).join(' or all ') + '.') : '';
    html += '<div class="sk-row small">' + (leader ? 'Leader: ' + (leader.boss ? 'the crowned Boss Pawn' : skFloorName(run.floor)) + ', ' + leader.hp + ' of ' + leader.max + ' HP.' : goal) + ' Turn ' + F.turn + '.' +
      (F.paralysis > 0 ? ' Paralysed for ' + F.paralysis + (F.paralysis === 1 ? ' turn.' : ' turns.') : '') + (F.countdown != null ? ' ' + F.countdown + ' turns left.' : '') + '</div>';
    // what the newer cards hold: stealth, a carried piece, jumps, allies, the pentagrams' firepower
    const more = [];
    if (F.stealth > 0) more.push(F.stealth === 1 ? 'Stealthy for 1 more turn.' : 'Stealthy for ' + F.stealth + ' more turns.');
    if (F.carry) more.push('Carrying: ' + (F.carry.ball ? 'Cannonball' : SKM.NAMES[F.carry.p.t]) + '.');
    if (st.jump) more.push('Jumps left: ' + Math.max(0, st.jump - (F.jumps || 0)) + ' of ' + st.jump + '.');
    if ((F.allies || []).length) more.push('Allies: ' + F.allies.length + '.');
    if (F.pentaFp) more.push('Pentagrams: +' + F.pentaFp + ' Pellets.');
    if (more.length) html += '<div class="sk-row small">' + more.join(' ') + '</div>';
    if (check) html += '<div class="sk-warn">Check: get out of the attack or kill the attacker this turn.</div>';
    if (F.disrupt) {
      // Undercover Mission, The Mole, Small Key: one disruption, then the king acts again
      return html + '<div class="sk-warn ok">Disrupt the White Army: pick one. Then you act again.</div><div class="gm-row sk-acts sk-disrupt">' +
        SKM.actions(run, F).map((a) => '<button class="btn" data-gm="skdisrupt:' + a.id + '" title="' + SK_DISRUPT[a.id][1] + '">' + SK_DISRUPT[a.id][0] + '</button>').join('') + '</div>' + skOwned(run) + '</section>';
    }
    html += '<div class="gm-row sk-acts"><button class="btn" data-gm="skreload"' + (F.gun[0] >= st.cap || F.gun[1] <= 0 ? ' disabled' : '') + ' title="Fill the gun from the reserve (that is your turn)">Load (Space)</button>' +
      skTools(run, F) +
      (st.blade ? '<button class="btn' + (skUi.blade ? ' on' : '') + '" data-gm="skblade">Blade</button>' : '') +
      (F.grenades > 0 ? '<button class="btn' + (skUi.grenade ? ' on' : '') + '" data-gm="skgrenade">Grenade (' + F.grenades + ')</button>' : '') +
      (SKM.rule(run, F, 'decree') && F.gun[0] > 1 ? '<button class="btn' + (skUi.decree ? ' on' : '') + '" data-gm="skdecree" title="Unjust Decree: the next shot fires every loaded shell">Fire all</button>' : '') +
      (SKM.rule(run, F, 'scope') ? '<button class="btn' + (F.scope ? ' on' : '') + '" data-gm="skscope" title="Engraved Scope: -45° spread, +2 range until you move or reload">Scope</button>' : '') +
      '<button class="btn' + (skUi.danger ? ' on' : '') + '" data-gm="skdanger">Danger</button><button class="btn" data-gm="skquit">Give up</button></div>';
    html += '<div class="sk-row small" id="skHover"></div>';
    return html + skOwned(run) + '</section>';
  }
  /* The buttons of the cards' own actions: the wands (once a floor each), the orb, the strafe target, lifting and
     throwing, the key, the shovel, Soul Projection. A button the king can use now is lit; one with a target waits for
     a click on the board (skUi.pick), the others act at once. [kind, wand id, label, tooltip] */
  const SK_TOOLS = [
    ['wand', 'wandfrenzy', 'Frenzy', 'Wand of Frenzy: refill your ammo and reload your gun. Free, once a floor'], ['wand', 'wandgust', 'Gust', 'Wand of Gust: every white piece one square back, and their next move two turns later. Free, once a floor'],
    ['wand', 'wandwings', 'Wings', 'Wand of Wings: move up to 3 squares in a straight line. Free, once a floor'],
    ['wand', 'wanddownpour', 'Downpour', 'Wand of Downpour: 10 damage spread over up to 4 random pieces. Free, once a floor'],
    ['wand', 'wandexecution', 'Execution', 'Wand of Execution: destroy a pawn. Free; ready again when you kill a piece that is not a pawn'],
    ['wand', 'wandhypnosis', 'Hypnosis', 'Wand of Hypnosis: pick a white piece, then where it goes. Free, once a floor'],
    ['wand', 'wandsouls', 'Souls', 'Wand of Souls: stun a piece for 3 turns and take its soul. Free, once a floor'],
    ['wand', 'wandtreachery', 'Treachery', 'Wand of Treachery: a piece next to the king changes sides. Free, once a floor'],
    ['wand', 'wandwrath', 'Wrath', 'Wand of Wrath: your firepower as damage to a piece that is not a king. Free, once a floor'],
    ['orb', '', 'Orb', 'Seer\'s Orb: pick a piece to see where it moves next. Free'],
    ['strafe', '', 'Strafe', 'Royal Loafers: pick a target, and your steps fire at it with 15° more spread. Free'],
    ['lift', '', 'Lift', 'Lift a piece or a cannonball next to the king. Free'],
    ['throw', '', 'Throw', 'Throw what the king carries: click a line from him. 3 damage to the first piece it hits'],
    ['key', '', 'Key', 'Small Key: a rook next to the king goes, or a jailed piece next to him changes sides; then disrupt the White Army. Free, once a floor'],
    ['dig', '', 'Dig', 'Shovel: dig a hole next to the king (that is your turn)'],
    ['project', '', 'Ally', 'Soul Projection: spend a soul to make an ally next to the king. Free']
  ];
  const SK_DIRECT = { wandfrenzy: 1, wandgust: 1, wanddownpour: 1 };
  const SK_TOOL_RULE = { orb: ['orb'], strafe: ['loafers'], lift: ['shoulders', 'shotput'], key: ['smallkey'], dig: ['shovel'], project: ['projection'] };
  const SK_DISRUPT = { sabotage: ['Sabotage', 'A random white card goes face down for this floor'], poison: ['Poison their water', 'Every white piece: -1 max HP'], stab: ['Stab their king', 'The White King takes 4 damage'],
    ammo: ['Steal their ammo', 'Full gun, full reserve, grenades back'], glue: ['Glue their shoes', 'Every white piece moves one turn slower'], guards: ['Remove the guards\' weapons', 'Pawns can\'t attack for this floor'] };
  function skTools(run, F) {
    const acts = SKM.actions(run, F), out = [];
    SK_TOOLS.forEach((w) => {
      const k = w[0], id = w[1];
      const owned = k === 'wand' ? SKM.rule(run, F, id) > 0 : k === 'throw' ? !!F.carry : SK_TOOL_RULE[k].some((r) => SKM.rule(run, F, r) > 0) && !(k === 'lift' && F.carry);
      if (!owned) return;
      const ready = acts.some((a) => a.k === k && (!id || a.id === id));
      const on = (skUi.pick && skUi.pick.k === k && (skUi.pick.id || '') === id) || (k === 'strafe' && F.strafe >= 0);
      out.push('<button class="btn' + (on ? ' on' : '') + '" data-gm="sktool:' + k + ':' + id + '"' + (ready ? '' : ' disabled') + ' title="' + w[3] + '">' + w[2] + '</button>');
    });
    return out.join('');
  }
  function skOwned(run) {
    const ids = Object.keys(run.cards).filter((k) => run.cards[k] > 0);
    if (!ids.length) return '';
    const chip = (id) => { const c = SKM.CARD[id]; return '<span class="sk-chip ' + c.color + '" title="' + c.text + '">' + c.name + (run.cards[id] > 1 ? ' x' + run.cards[id] : '') + skCardIcons(c).replace('class="skv"', 'class="skv mini"') + '</span>'; };
    return '<div class="sk-owned">' + ids.filter((k) => SKM.CARD[k].color === 'black').map(chip).join('') + ids.filter((k) => SKM.CARD[k].color === 'white').map(chip).join('') + '</div>';
  }
  function skHoverInfo() {
    const el = $('#skHover'), run = skRun();
    if (!el || !skLive()) return;
    const F = run.F, q = skUi.hover, p = SKM.pieceAt(F, q), al = SKM.allyAt(F, q), when = (t) => (t <= 1 ? 'after your next turn' : 'in ' + t + ' turns');
    let tx = p ? (p.boss ? 'The crowned Boss Pawn' : SKM.NAMES[p.t]) + (p.leader ? ' (leader)' : '') + ': ' + p.hp + ' of ' + p.max + ' HP, moves ' + when(p.tm) + ' (every ' + p.spd + ')' + (p.bleed ? ', bleeding' : '') + (p.mark ? ', marked' : '') + '.' : '';
    if (p && p.spy === 1) tx += ' A spy: step next to it.';
    else if (al) tx = 'Ally: ' + SKM.NAMES[al.t] + ', moves ' + when(al.tm) + ' (every ' + al.spd + ').';
    else if (!p && q === F.holo) tx = 'Your hologram: a piece that takes it is stunned for 2 turns.';
    else if (!p && (F.balls || []).indexOf(q) >= 0) tx = 'A cannonball: lift it, then throw it.';
    else if (!p && (F.stones || []).indexOf(q) >= 0) tx = 'A flagstone: step onto it from anywhere, +1 firepower while you stand on it.';
    else if (!p && (F.penta || []).some((x) => x.sq === q)) tx = (F.penta.find((x) => x.sq === q).on ? 'A pentagram: step onto it for an extra turn.' : 'A spent pentagram.');
    else if (!p && (F.holes || []).indexOf(q) >= 0) tx = 'A hole: from next to one, travel to any other.';
    else if (!p && q === F.way) tx = 'The waypoint: reach it to disrupt the White Army.';
    else if (!p && F.moat && (q >> 3) === SKM.MOAT) tx = 'The moat: only knights cross it in one move.';
    el.textContent = tx;
  }
  function wireSk(box) {
    box.querySelectorAll('[data-skgun]').forEach((b) => { b.onclick = () => { skUi.gun = b.dataset.skgun; skSaveSet(); renderModes(); renderAll(); }; });
    box.querySelectorAll('[data-skrank]').forEach((b) => { b.onclick = () => { skUi.rank = +b.dataset.skrank; skSaveSet(); renderModes(); }; });
    box.querySelectorAll('[data-sksoul]').forEach((b) => { b.onclick = () => {
      const i = +b.dataset.sksoul, r0 = skRun();
      if (r0 && r0.souls[i] === 'p') { skDo({ k: 'fodder', soul: i }); return; } // Cannon Fodder: a pawn's soul feeds the next shot
      skUi.soul = skUi.soul === i ? -1 : i; skUi.grenade = false; if (!(skUi.pick && skUi.pick.k === 'project')) skUi.pick = null; renderModes(); renderAll();
    }; });
    box.querySelectorAll('[data-skbrowse]').forEach((b) => { b.onclick = () => { const run = skRun(); if (run && SKM.browse(run, b.dataset.skbrowse)) { saveModes(); renderModes(); } }; });
    box.querySelectorAll('[data-skpair]').forEach((b) => { b.onclick = () => { const run = skRun(); if (run && SKM.choosePair(run, +b.dataset.skpair)) { MS.rev = (MS.rev || 0) + 1; saveModes(); snd('start'); renderModes(); renderAll(); } }; });
  }
  /* ---------- Pawnbarian (the Game Mode; the rules are in pawnbarian.js) ----------
     The run lives in MS.pb.run and is saved after every action. The board is 5 x 5: the hero, the monsters with
     their traits shown, the squares they attack this turn (one red tick per point of damage), Blight, the Mystic's
     Wards; in the shop the items and the stairs. The panel holds the loot track, the hearts and the hand: a card
     picked shows its squares on the board, a click there plays it. */
  const PBM = typeof Pawnbarian !== 'undefined' ? Pawnbarian : null;
  const pbUi = { card: -1, hover: -1, hero: 'pawnbarian', dungeon: 'goblin', chain: 0, busy: false, flash: 0 };
  try { const o = JSON.parse(localStorage.getItem('powerchess_pbset') || 'null'); if (o && PBM) { if (PBM.HERO[o.hero]) pbUi.hero = o.hero; if (PBM.DUNGEON[o.dungeon]) pbUi.dungeon = o.dungeon; pbUi.chain = +o.chain || 0; } } catch (e) { /* first visit */ }
  const pbSaveSet = () => { try { localStorage.setItem('powerchess_pbset', JSON.stringify({ hero: pbUi.hero, dungeon: pbUi.dungeon, chain: pbUi.chain })); } catch (e) { /* private mode */ } };
  const pbData = () => MS.pb || (MS.pb = Modes.fresh().pb);
  const pbRun = () => { const r = pbData().run; return r && !r.closed ? r : null; };
  const pbLive = () => { const r = pbRun(); return !!(r && r.F && !r.F.over && !r.over); };
  const PB_ART = 'pieces/pawnbarian/';
  const PB_SHOGI = { sK: 'shogi_king', sG: 'shogi_gold', sS: 'shogi_silver', sN: 'shogi_knight', sL: 'shogi_lance', sP: 'shogi_pawn', sR: 'shogi_rook', sB: 'shogi_bishop', sD: 'shogi_dragon', sH: 'shogi_horse' };
  const PB_SHOGI_UP = { sS: 'shogi_psilver', sN: 'shogi_pknight', sL: 'shogi_plance', sP: 'shogi_tokin', sR: 'shogi_dragon', sB: 'shogi_horse' };
  const PB_NEW = { H: 'hawk', E: 'bear', G: 'ghost' };
  // the picture of a card: its chess piece, the Shogun's shogi piece (promoted: the promoted side), a new piece
  function pbPic(c) {
    const p = typeof c === 'string' ? c : c.p, promo = typeof c === 'string' ? null : c.promo;
    if (PB_SHOGI[p]) return fairyPic('w', promo && PB_SHOGI_UP[p] ? PB_SHOGI_UP[p] : PB_SHOGI[p]);
    if (PB_NEW[p]) return PB_ART + 'w_' + PB_NEW[p] + '.svg';
    return pieceUrl(promo || p);
  }
  const pbPieceName = (c) => PBM.PIECES[PBM.pieceOf(c)].name;
  const PB_UPS = ['cantrip', 'shield', 'dsplash', 'csplash', 'purify'];
  const pbUps = (up, cls) => PB_UPS.filter((u) => up[u]).map((u) => '<i class="pb-up ' + (cls || '') + '" title="' + PBM.UPGRADES[u].name + ': ' + PBM.UPGRADES[u].text + '" style="background-image:url(' + PB_ART + 'i_' + u + '.svg)"></i>').join('');
  const pbIcon = (n, cls, title) => '<i class="pb-ic ' + (cls || '') + '"' + (title ? ' title="' + title + '"' : '') + ' style="background-image:url(' + PB_ART + 'i_' + n + '.svg)"></i>';
  const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  function pbView() {
    const run = pbRun(), b = new Array(25).fill('');
    if (run && run.shop) {
      run.shop.offers.forEach((o) => { if (!o.sold) b[o.sq] = 'p'; });
      b[PBM.STAIRS] = 'p';
      b[run.shop.hero] = 'K';
    } else if (run && run.F) {
      run.F.enemies.forEach((e) => { b[e.sq] = 'p'; });
      if (run.F.over !== 'dead') b[run.F.hero] = 'K';
    } else { b[PBM.START] = 'K'; [[6, 'p'], [8, 'p'], [12, 'p']].forEach((x) => { b[x[0]] = x[1]; }); } // a first floor, for the look of it
    return { s: blank(b, 'w'), W: 5, H: 5, glyphs: {}, cfg: null, pb: true };
  }
  function pbDecorate(els) {
    const run = pbRun();
    const art = (el, src) => { if (el) el.style.backgroundImage = 'url(' + src + ')'; };
    if (!run || (!run.F && !run.shop)) {
      art(els[PBM.START], PB_ART + 'h_' + pbUi.hero + '.svg');
      ['capybear', 'gskirmisher', 'spidertoad'].forEach((k, i) => art(els[[6, 8, 12][i]], PB_ART + 'm_' + k + '.svg'));
      Object.keys(els).forEach((q) => els[q].classList.add('pbp'));
      return;
    }
    if (run.shop) {
      const S = run.shop;
      art(els[S.hero], PB_ART + 'h_' + run.hero + '.svg');
      if (els[S.hero]) els[S.hero].classList.add('pbp', 'pbhero');
      if (els[PBM.STAIRS] && S.hero !== PBM.STAIRS) { art(els[PBM.STAIRS], PB_ART + 'i_stairs.svg'); els[PBM.STAIRS].classList.add('pbp', 'pbitem'); }
      S.offers.forEach((o) => {
        const el = els[o.sq];
        if (!el || o.sold || S.hero === o.sq) return;
        el.classList.add('pbp', 'pbitem');
        if (o.heart) { art(el, PB_ART + 'i_heart.svg'); el.classList.add('pbheart'); }
        else {
          const c = run.deck.find((x) => x.id === o.card);
          art(el, pbPic(c));
          el.appendChild(h('i', 'pb-badge', pbUps(c.up, 'old') + '<i class="pb-up new" style="background-image:url(' + PB_ART + 'i_' + o.up + '.svg)"></i>'));
        }
        el.appendChild(h('i', 'pb-price' + (o.price > run.gold ? ' poor' : ''), o.price));
      });
      return;
    }
    const F = run.F;
    F.enemies.forEach((e) => {
      const el = els[e.sq];
      if (!el) return;
      art(el, PB_ART + 'm_' + e.kind + '.svg');
      el.classList.add('pbp', 'pbmon');
      if (PBM.hasT(e, 'champion')) el.classList.add('pbchamp');
      if (PBM.hasT(e, 'nimble') && e.dodged !== F.turn) el.classList.add('pbnimble');
      if (PBM.MONSTERS[e.kind].boss) el.classList.add('pbboss');
      if (F.over !== 'dead' && PBM.immune(run, F, e, F.hero)) el.classList.add('pbimmune');
      if (pbUi.pop && pbUi.pop[e.id]) el.classList.add('pbpop');
    });
    if (F.over !== 'dead' && els[F.hero]) {
      art(els[F.hero], PB_ART + 'h_' + run.hero + '.svg'); els[F.hero].classList.add('pbp', 'pbhero');
      if (F.shield > 0) els[F.hero].classList.add('pbshielded');
      if (!F.over && pbPending(run, F) > 0) els[F.hero].classList.add('pbcheck'); // in danger: the hero is "in check"
    }
  }
  // the board's marks: Blight (a pip per stack), the Wards, the attacked squares (a tick per point, a skull from 4)
  function pbMarks(mark) {
    const run = pbRun();
    if (!run) return;
    if (run.shop) { PBM.shopMoves(run).forEach((q) => mark(q, 'pbreach')); return; }
    const F = run.F;
    if (!F) return;
    F.blight.forEach((n, q) => { if (n > 0) { const m = mark(q, 'pbblight'); m.innerHTML = '<i>' + '<u></u>'.repeat(Math.min(n, 8)) + '</i>' + (n > 8 ? '<b>' + n + '</b>' : ''); } });
    F.wards.forEach((q) => mark(q, 'pbward'));
    if (F.over) return;
    if (pbPending(run, F) > 0) mark(F.hero, 'check');
    const hov = pbUi.hover;
    for (let q = 0; q < 25; q++) {
      const n = PBM.threat(run, F, q);
      if (!n) continue;
      const m = mark(q, 'pbthreat' + (q === F.hero ? ' on' : ''));
      m.innerHTML = n >= 4 ? '<i class="skull"></i>' : '<i>' + '<u></u>'.repeat(n) + '</i>';
    }
    // the monster under the mouse: the squares it attacks
    const e = hov >= 0 ? PBM.enemyAt(F, hov) : null;
    if (e) PBM.targets(e).forEach((q) => mark(q, 'pbtgt'));
  }
  /* What a card would do on each square it reaches, worked out by playing it on a copy of the run: which monsters
     it hits and how (killed, dodging to which square, immune), where the splash lands, where the hero ends up and
     what the end of the turn would cost him there. Kept until the run or the card picked changes. */
  let pbPrevKey = '', pbPrev = null;
  function pbPreview(run, F, i) {
    const key = MS.rev + ':' + i + ':' + F.turn + ':' + F.actions + ':' + F.hand.map((c) => c.id).join(',');
    if (key === pbPrevKey) return pbPrev;
    const out = {};
    PBM.cardTargets(run, F, F.hand[i]).forEach((x) => {
      const r = JSON.parse(JSON.stringify(run)), ev = PBM.play(r, i, x.to) || [], G = r.F;
      const hits = ev.filter((e) => (e.e === 'hit' || e.e === 'splash')).map((e) => {
        const o = { sq: e.sq, res: e.res, splash: e.e === 'splash' };
        if (e.res === 'dodged' && G) { const m = G.enemies.find((m0) => m0.id === e.id); if (m) o.to = m.sq; }
        return o;
      });
      out[x.to] = { hits: hits, kills: hits.filter((o) => o.res === 'dead').length, hero: G ? G.hero : x.to, clear: !!(G && G.over === 'cleared'),
        pend: G && !G.over && !r.over ? pbPending(r, G) : 0, grasp: ev.some((e) => e.e === 'grasp' && e.sq != null) };
    });
    pbPrevKey = key; pbPrev = out;
    return out;
  }
  function pbHints(hint) {
    const run = pbRun();
    if (!pbLive() || pbUi.busy) return;
    const F = run.F, c = F.hand[pbUi.card];
    if (!c || F.actions <= 0) return;
    const pv = pbPreview(run, F, pbUi.card), hov = pv[pbUi.hover];
    PBM.cardTargets(run, F, c).forEach((x) => {
      const p = pv[x.to];
      hint(x.to, x.hit ? 'ring pbring' : 'dot pbdot');
      // at a glance: how many monsters this square kills, or that the attack only makes one dodge or hits nothing
      if (p && p.kills) hint(x.to, 'pbkills').innerHTML = '<b>' + (p.clear ? '✓' : p.kills) + '</b>';
      else if (p && p.hits.some((o) => o.res === 'dodged')) hint(x.to, 'pbkills dodge').innerHTML = '<b>↻</b>';
      if (p && p.pend > 0 && p.hero === x.to && x.to !== pbUi.hover) hint(x.to, 'pbrisk').innerHTML = '<b>-' + p.pend + '</b>';
    });
    if (!hov) return;
    // the square under the mouse: everything the move does
    hov.hits.forEach((o) => {
      if (o.res === 'miss') { hint(o.sq, 'pbatk empty'); return; }
      hint(o.sq, 'pbatk ' + o.res);
      if (o.res === 'dodged' && o.to != null) {
        hint(o.to, 'pbdodge');
        const a = sqXY(o.sq), b = sqXY(o.to), ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
        hint(o.sq, 'pbarrow').style.setProperty('--a', ang + 'deg');
      }
    });
    if (hov.hero !== F.hero) hint(hov.hero, 'pbghost').style.backgroundImage = 'url(' + PB_ART + 'h_' + run.hero + '.svg)';
    hint(hov.hero, 'pbrisk big' + (hov.pend ? '' : ' safe')).innerHTML = hov.clear ? '<b>Floor cleared</b>' : hov.pend ? '<b>-' + hov.pend + ' ♥</b>' : '<b>safe</b>';
  }
  // the monster under the mouse (or the square): what it is, its traits, the damage there
  function pbHoverInfo() {
    const el = $('#pbHover'), run = pbRun();
    if (!el) return;
    const q = pbUi.hover;
    if (!run || q < 0) { el.innerHTML = ''; return; }
    if (run.shop) {
      const o = run.shop.offers.find((x) => x.sq === q && !x.sold);
      if (q === PBM.STAIRS) el.innerHTML = '<b>Stairs</b><span>On to floor ' + run.shop.floor + '.</span>';
      else if (o && o.heart) el.innerHTML = '<b>Heart</b><span>' + o.price + ' gold</span><span>One more Heart, full and for good.</span>';
      else if (o) { const c = run.deck.find((x) => x.id === o.card); el.innerHTML = '<b>' + PBM.UPGRADES[o.up].name + '</b><span>' + PBM.PIECES[c.p].name + '</span><span>' + o.price + ' gold</span><span>' + PBM.UPGRADES[o.up].text + '</span>'; }
      else el.innerHTML = '';
      return;
    }
    const F = run.F;
    if (!F) { el.innerHTML = ''; return; }
    const e = PBM.enemyAt(F, q), dmg = PBM.threat(run, F, q), bl = F.blight[q];
    let html = '';
    // a card picked and a square it reaches: what the move does there, in words
    const card = pbLive() && F.hand[pbUi.card], pv = card ? pbPreview(run, F, pbUi.card)[q] : null;
    if (pv) {
      const n = (r) => pv.hits.filter((o) => o.res === r).length, k = n('dead'), d = n('dodged'), im = n('immune');
      const parts = [];
      if (k) parts.push(k === 1 ? 'Kills 1 monster.' : 'Kills ' + k + ' monsters.');
      if (d) parts.push(d === 1 ? '1 monster dodges.' : d + ' monsters dodge.');
      if (im) parts.push(im === 1 ? '1 monster is immune.' : im + ' monsters are immune.');
      html += '<b>' + pbPieceName(card) + '</b>' + (parts.length ? parts : ['This move hits nothing.']).map((t) => '<span class="pb-prev">' + t + '</span>').join('');
      if (pv.clear) html += '<span class="pb-prev ok">The floor is cleared.</span>';
      else html += '<span class="' + (pv.pend ? 'pb-dmg' : 'pb-prev ok') + '">' + (pv.pend ? 'Ending the turn there: ' + pv.pend + ' damage.' : 'Ending the turn there: no damage.') + '</span>';
      if (pv.grasp) html += '<span class="pb-prev">Void Grasp pulls you on.</span>';
    }
    if (e) {
      const M = PBM.MONSTERS[e.kind];
      html += '<b>' + M.name + '</b><em>' + M.text + '</em><span class="pb-atk">Attacks: ' + PBM.ATTACKS[e.atk] + '.</span>' +
        e.traits.map((t) => '<span><b>' + PBM.TRAITS[t][0] + '</b> ' + PBM.TRAITS[t][1] + '</span>').join('');
      if (PBM.immune(run, F, e, F.hero)) html += '<span class="pb-imm">Immune right now.</span>';
    } else if (q === F.hero) html += '<b>' + PBM.HERO[run.hero].name + '</b>';
    if (dmg) html += '<span class="pb-dmg">' + dmg + ' damage here at the end of the turn.</span>';
    if (bl) html += '<span class="pb-dmg">' + bl + ' Blight: ' + bl + ' damage to end the turn here.</span>';
    if (F.wards.indexOf(q) >= 0) html += '<span>A Ward: monsters cannot enter it. Step on it for 3 Shields.</span>';
    el.innerHTML = html;
  }
  /* what happened, shown on the board: hits and kills, a dodge, the splash, the damage taken */
  /* ---------- the effects: what happened, shown on the board ----------
     A card: the hero slides there, a monster that dodges slides away, a killed one breaks apart, the splash squares
     flash. The end of the turn: every monster that has the hero in its attack lunges at him one after the other, each
     hit lands with the damage sound, a red number and a jolt; a Shield takes it with a clank instead. Then the monsters
     walk, new ones pop up, and the new hand is dealt. */
  const PB_DUR = { lunge: 230, gap: 120 };
  const pbMonPic = (kind) => PB_ART + 'm_' + kind + '.svg';
  // the damage the hero takes if the turn ends now (attacks and Blight, less the Shields)
  function pbPending(run, F) { return Math.max(0, PBM.threat(run, F, F.hero) + F.blight[F.hero] - F.shield); }
  function pbFx(ev, run, carded) {
    let killed = 0, delay = 0;
    (ev || []).forEach((x) => {
      if (x.e === 'hit' || x.e === 'splash') {
        if (x.res === 'dead') { killed++; const d0 = x.e === 'hit' ? 120 : 160 + delay; delay += 40; setTimeout(() => { skShatter(x.sq, pbMonPic(x.kind), false); pbShardSize(); }, d0); }
        else if (x.res === 'dodged') fxRing(x.sq, 'blue');
        else if (x.res === 'immune') { fxRing(x.sq, 'orange'); snd('clank'); }
        else if (x.e === 'splash') pbSlash(x.sq);
      }
      if (x.e === 'ward') { fxRing(x.sq, 'blue'); snd('portal'); }
      if (x.e === 'cantrip') snd('zap', 0.12);
      if (x.e === 'dragon') snd('promo');
      if (x.e === 'grasp') { if (x.hurt) pbHit(x.hurt, 0.15); else snd('portal', 0.12); }
      if (x.e === 'cleared') snd('win', 0.35);
    });
    const at = carded ? 0.12 : 0;
    if (killed) { snd('slash', at); snd('capture', at + 0.06); } else if (!carded && (ev || []).some((x) => x.e === 'hit' || x.e === 'splash')) snd('move');
  }
  // the shards of skShatter are sized for 8 x 8: on the 5 x 5 board they take a square of its own size
  function pbShardSize() { L.fx.querySelectorAll('.skshard:not(.pbw),.skdust:not(.pbw)').forEach((d) => d.classList.add('pbw')); }
  function pbSlash(sq) {
    const d = place(h('div', 'pbslash'), sq);
    L.fx.appendChild(d);
    setTimeout(() => d.remove(), 450);
  }
  function pbNumber(sq, txt, cls) {
    const d = place(h('div', 'skdmg pbw ' + (cls || ''), txt), sq);
    L.fx.appendChild(d);
    setTimeout(() => d.remove(), 950);
  }
  // n points of damage land on the hero now (delay in seconds for the sound)
  function pbHit(n, delay) {
    const run = pbRun(), F = run && run.F, sq = F ? F.hero : -1;
    snd('hurt', delay || 0);
    if (sq >= 0) {
      pbNumber(sq, '-' + n);
      const el = L.pieces.querySelector('[data-sq="' + sq + '"]');
      if (el) { el.classList.remove('pbouch'); void el.offsetWidth; el.classList.add('pbouch'); }
    }
    const b = $('#board');
    if (b && settings.anim) b.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(0,0)' }], { duration: 260 });
    pbUi.flash = Date.now();
    const hb = document.querySelector('.pb-hearts');
    if (hb) { hb.classList.remove('hurt'); void hb.offsetWidth; hb.classList.add('hurt'); }
  }
  function pbBlocked(sq) { fxRing(sq, 'blue'); snd('clank'); pbNumber(sq, '0', 'pbblock'); }
  // a monster lunges at the hero and back
  function pbLunge(from, to, delay) {
    const el = L.pieces.querySelector('[data-sq="' + from + '"]');
    if (!el || !settings.anim) return;
    const a = sqXY(from), b = sqXY(to), k = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) > 1 ? 0.22 : 0.42;
    const mid = 'translate(' + (a[0] + (b[0] - a[0]) * k) * 100 + '%,' + (a[1] + (b[1] - a[1]) * k) * 100 + '%) scale(1.12)';
    el.style.zIndex = 6;
    el.animate([{ transform: trans(from) }, { transform: mid, offset: 0.45 }, { transform: trans(from) }], { duration: PB_DUR.lunge, delay: delay, easing: 'ease-in-out' });
  }
  // the monsters' moves as slides: where each one stood before and stands now
  function pbAnims(before, F) {
    if (!F) return null;
    const out = [];
    F.enemies.forEach((e) => { const b = before[e.id]; if (b != null && b !== e.sq) out.push({ from: b, to: e.sq }); });
    if (before.hero != null && before.hero !== F.hero) out.push({ from: before.hero, to: F.hero });
    return out;
  }
  const pbSnap = (F) => { const o = {}; if (F) { F.enemies.forEach((e) => { o[e.id] = e.sq; }); o.hero = F.hero; } return o; };
  // monsters that were not there before pop up (Blightsacks, tentacles, golems, a new floor's ones do not)
  function pbPops(before, F) {
    pbUi.pop = {};
    if (F && before.hero != null) F.enemies.forEach((e) => { if (before[e.id] == null) pbUi.pop[e.id] = true; });
    setTimeout(() => { pbUi.pop = {}; }, 500);
  }
  function pbAfter(anims) {
    const run = pbRun();
    if (run && run.over && !run.settled) {
      run.settled = true; // counted by pawnbarian.js when it began (runs) and when the dungeon fell (won)
      if (run.over.won) snd('win'); else snd('lose', 0.3);
    }
    MS.rev = (MS.rev || 0) + 1;
    saveModes(); renderModes(); renderAll(anims);
  }
  // the pieces that jump, and how a card goes: a jump, a slide along a line, a step of one square, the Ghost
  const PB_JUMPERS = { N: 1, H: 1, E: 1, sN: 1 };
  function pbCardSound(run, card, from, to, ev, promosBefore) {
    const piece = PBM.pieceOf(card), F = run.F;
    snd('pb:card');
    const shot = PBM.HERO[run.hero].ranged && ev.some((x) => x.e === 'hit');
    const dist = Math.max(Math.abs(PBM.rowOf(to) - PBM.rowOf(from)), Math.abs(PBM.colOf(to) - PBM.colOf(from)));
    snd(shot ? 'pb:bow' : piece === 'G' ? 'pb:ghost' : PB_JUMPERS[piece] ? 'pb:jump' : dist > 1 ? 'pb:slide' : 'pb:step', 0.05);
    if (card.up.dsplash || card.up.csplash) snd('pb:splash', 0.14);
    if (card.up.shield) snd('pb:shield', 0.2);
    if (card.up.purify) snd('pb:purify', 0.24);
    // a card in hand promoted by this play (the Pawnbarian's Queen, the Shogun's promotion)
    if (F && F.hand.filter((c) => c.promo).length > promosBefore) snd('promo', 0.3);
  }
  function pbPlay(i, to) {
    const run = pbRun();
    if (!pbLive() || pbUi.busy) return;
    const F = run.F, before = pbSnap(F), card = F.hand[i], from = F.hero, promos = F.hand.filter((c, k) => k !== i && c.promo).length;
    const ev = PBM.play(run, i, to);
    if (!ev) return;
    pbUi.card = -1;
    pbPops(before, run.F);
    pbAfter(pbAnims(before, run.F === F ? F : null));
    pbCardSound(run, card, from, to, ev, promos);
    pbFx(ev, run, true);
  }
  function pbEnd() {
    const run = pbRun();
    if (!pbLive() || pbUi.busy) return;
    const F = run.F, hero = F.hero;
    pbUi.card = -1;
    // the attacks, one monster after the other, on the board as it stands
    const attackers = F.enemies.filter((e) => PBM.targets(e).indexOf(hero) >= 0).sort((a, b) => a.sq - b.sq);
    const blight = F.blight[hero], tutorial = PBM.DUNGEON[run.dungeon].tutorial;
    let shield = F.shield, t = 0;
    pbUi.busy = true;
    renderModes(); renderAll();
    const land = (n, at) => setTimeout(() => {
      const blocked = Math.min(shield, n); shield -= blocked;
      if (n - blocked > 0 && !tutorial) pbHit(n - blocked); else pbBlocked(hero);
    }, at);
    attackers.forEach((e) => { pbLunge(e.sq, hero, t); land(PBM.isFinalBoss(run, e) ? 2 : 1, t + PB_DUR.lunge * 0.45); t += PB_DUR.gap + 40; });
    if (blight) { setTimeout(() => { pbNumber(hero, '', 'pbbubble'); }, t); land(blight, t + 80); t += 260; }
    setTimeout(() => {
      const before = pbSnap(run.F);
      PBM.endTurn(run);
      pbUi.busy = false;
      if (run.over) {
        pbAfter(null);
        if (settings.anim) { skShatter(hero, PB_ART + 'h_' + run.hero + '.svg', false); pbShardSize(); }
        return;
      }
      pbUi.deal = true;
      pbPops(before, run.F);
      pbAfter(pbAnims(before, run.F));
      snd('move');
      snd('pb:deal', 0.2);
      if (run.F && pbPending(run, run.F) > 0) snd('check', 0.25); // in danger at the start of the turn, as a check
      setTimeout(() => { pbUi.deal = false; }, 600);
    }, attackers.length || blight ? t + 260 : 0);
  }
  function pbDrop() {
    const run = pbRun();
    if (!pbLive() || pbUi.busy) return;
    const before = pbSnap(run.F), ev = PBM.dragonDrop(run);
    if (!ev) { toast('No action left for the Dragon Drop'); return; }
    if (settings.anim && run.F) fxRing(run.F.hero, 'orange');
    pbPops(before, run.F);
    pbAfter(null);
    pbFx(ev, run);
  }
  function pbDown(sq) {
    const run = pbRun();
    if (!run || sq < 0 || pbUi.busy) return;
    if (run.shop) {
      const r = PBM.shopMove(run, sq);
      if (!r) { if (sq !== run.shop.hero) toast('Your pieces here cannot reach that square. Land on an item to buy it, or on the stairs to go on'); return; }
      if (r.e === 'poor') { toast('That costs ' + r.price + ' gold'); return; }
      if (r.e === 'heart' || r.e === 'upgrade') snd('gold'); else if (r.e === 'stairs') snd('start'); else snd('move');
      pbUi.card = -1;
      pbAfter(null);
      return;
    }
    if (!pbLive()) return;
    const F = run.F, c = F.hand[pbUi.card];
    if (c && PBM.cardTargets(run, F, c).some((x) => x.to === sq)) { pbPlay(pbUi.card, sq); return; }
    // a click on a square some card in hand reaches: that card, if only one does
    const cards = F.hand.map((x, i) => i).filter((i) => PBM.cardTargets(run, F, F.hand[i]).some((x) => x.to === sq));
    if (!c && cards.length === 1 && F.actions > 0) { pbUi.card = cards[0]; snd('pb:flick'); renderModes(); renderAll(); return; }
    pbUi.card = -1;
    renderModes(); renderAll();
  }
  function pbStart(again) {
    const d = pbData(), last = d.run;
    const hero = again && last ? last.hero : pbUi.hero, dun = again && last ? last.dungeon : pbUi.dungeon, chain = again && last ? last.chain : Math.min(pbUi.chain, d.chain);
    PBM.newRun(d, Modes.newSeed(), hero, dun, chain);
    pbUi.card = -1; pbUi.busy = false;
    snd('start');
    pbAfter(null);
  }
  /* ---------- the panel ---------- */
  function pbDeckStrip(cards, cls) {
    return '<div class="pb-strip ' + (cls || '') + '">' + cards.map((c) => '<span title="' + PBM.PIECES[c.p].name + PB_UPS.filter((u) => c.up[u]).map((u) => ', ' + PBM.UPGRADES[u].name).join('') + '"><i style="background-image:url(' + pbPic(c.p) + ')"></i>' + pbUps(c.up, 'tiny') + '</span>').join('') + '</div>';
  }
  function pbSelector() {
    const d = pbData();
    let html = '<div class="gm-head"><h2>Pawnbarian</h2><div class="gm-credits"><b class="notranslate">' + ROMAN[d.chain] + '</b><span>chain</span></div></div>' +
      '<p class="gm-fixed">A hero alone on a 5 x 5 board. Your cards are chess moves: land on a monster to kill it. Three cards a turn, two actions. Clear seven floors.</p>';
    html += '<h3 class="sk-h">Hero</h3><div class="pb-heroes">' + PBM.HEROES.map((id) => {
      const won = d.conquered[id] ? Object.keys(d.conquered[id]).length : 0, open = PBM.unlocked(d, id);
      return '<button class="pb-hb' + (pbUi.hero === id ? ' on' : '') + (open ? '' : ' locked') + '" data-pbhero="' + id + '"' + (open ? '' : ' title="Win a dungeon with the Pawnbarian first"') + '><i style="background-image:url(' + PB_ART + 'h_' + id + '.svg)"></i><b>' + PBM.HERO[id].name + '</b>' + (won ? '<em>' + '♛'.repeat(won) + '</em>' : '') + '</button>';
    }).join('') + '</div>';
    const H = PBM.HERO[pbUi.hero], heroOpen = PBM.unlocked(d, pbUi.hero) || PBM.DUNGEON[pbUi.dungeon].tutorial;
    html += '<div class="pb-heroinfo"><i class="pb-port" style="background-image:url(' + PB_ART + 'h_' + pbUi.hero + '.svg)"></i><div><b>' + H.name + '</b><em>' + H.text + '</em><span>' + H.ability + '</span></div></div>' + pbDeckStrip(PBM.makeDeck(pbUi.hero));
    html += '<h3 class="sk-h">Dungeon</h3><div class="pb-duns">' + PBM.DUNGEONS.map((id) => {
      const D = PBM.DUNGEON[id], best = Math.max(-1, ...PBM.HEROES.map((h0) => (d.conquered[h0] && d.conquered[h0][id] != null ? d.conquered[h0][id] : -1)));
      return '<button class="sk-gun' + (pbUi.dungeon === id ? ' on' : '') + '" data-pbdun="' + id + '"><b>' + D.name + '</b><span>' + (D.tutorial ? '2 floors' : best >= 0 ? 'Conquered on chain ' + ROMAN[best] : '7 floors') + '</span></button>';
    }).join('') + '</div><p class="pb-flavour">' + PBM.DUNGEON[pbUi.dungeon].text + '</p>';
    if (PBM.DUNGEON[pbUi.dungeon].tutorial) html += '<p class="gm-fixed">Tutorial Island: always the Pawnbarian on chain 0, and nobody dies here.</p>';
    else {
      const ch = Math.min(pbUi.chain, d.chain);
      html += '<h3 class="sk-h">Chain</h3><div class="sk-ranks pb-chains">' + ROMAN.map((r, i) => '<button class="sk-rank' + (ch === i ? ' on' : '') + (i <= d.chain ? '' : ' locked') + '" data-pbchain="' + i + '"' + (i <= d.chain ? '' : ' disabled title="Conquer all three dungeons on chain ' + ROMAN[i - 1] + ' first"') + '><b class="notranslate">' + r + '</b></button>').join('') + '</div>' +
        '<ul class="pb-chainlist">' + PBM.CHAINS.slice(0, ch + 1).map((t, i) => '<li><b class="notranslate">' + ROMAN[i] + '</b> ' + t + '</li>').join('') + '</ul>';
    }
    html += heroOpen ? '<button class="btn green gm-wide" data-gm="pbstart">Embark</button>' : '<p class="gm-block">Locked: win a dungeon with the Pawnbarian to open the other heroes.</p><button class="btn gm-wide" disabled>Embark</button>';
    html += '<div class="gm-stats">' + d.runs + (d.runs === 1 ? ' run' : ' runs') + ', ' + d.won + ' won. Chain ' + ROMAN[d.chain] + ' is open: it opens the next once all three dungeons are conquered on it, by any heroes.</div>';
    return html;
  }
  function pbLoot(run, F) {
    const track = F.loot.map((x) => (x === 'gold' ? pbIcon('gold', 'loot', 'Gold') : x === 'heal' ? pbIcon('heal', 'loot', 'Heals a Heart') : pbIcon('blood', 'loot', 'Blood Crystal: heals a Heart'))).join('');
    return '<div class="pb-loot" title="Paid out when the floor is cleared. The rightmost reward is lost after every turn the floor is not cleared."><span class="pb-gold">' + pbIcon('gold') + '<b>' + run.gold + '</b></span><span class="pb-track">' + (track || '<em>nothing left</em>') + '</span></div>';
  }
  function pbHearts(run, F) {
    let s = '';
    for (let i = 0; i < run.maxHearts; i++) s += pbIcon(i < run.hearts ? 'heart' : 'heartoff', 'heart');
    if (F && F.shield) s += '<span class="pb-shield">' + pbIcon('shield') + '<b>' + F.shield + '</b></span>';
    return '<div class="pb-hearts' + (Date.now() - pbUi.flash < 900 ? ' hurt' : '') + '">' + s + '</div>';
  }
  function pbFloorName(run) {
    const D = PBM.DUNGEON[run.dungeon];
    const ch = D.tutorial ? '' : ', chain ' + ROMAN[run.chain];
    if (run.shop) return 'The shop before floor ' + run.shop.floor + ' of ' + PBM.floorsOf(run) + ch;
    return run.gauntlet ? 'Gauntlet floor ' + run.gauntlet + ch : 'Floor ' + run.floor + ' of ' + PBM.floorsOf(run) + ch;
  }
  function pbCard() {
    if (!PBM) return '<section class="gm-card"><p>Pawnbarian did not load.</p></section>';
    const run = pbRun();
    let html = '<section class="gm-card sk pb">';
    if (!run) return html + pbSelector() + '</section>';
    const D = PBM.DUNGEON[run.dungeon], H = PBM.HERO[run.hero];
    html += '<div class="gm-head"><h2>' + D.name + '</h2><div class="gm-credits"><b>' + run.gold + '</b><span>gold</span></div></div>';
    html += '<div class="sk-row small">' + H.name + ', ' + pbFloorName(run) + '</div>';
    if (run.over) {
      const won = run.over.won;
      html += '<div class="sk-end ' + (won ? 'won' : 'lost') + '"><b>' + (won ? (run.gauntlet ? 'You rest after ' + (run.gauntlet - 1) + ' Gauntlet floors.' : 'The dungeon is conquered. You rest on your laurels.') : run.over.gaveUp ? 'You leave the dungeon on floor ' + run.floor + '.' : H.name + ' falls on ' + (run.gauntlet ? 'Gauntlet floor ' + run.gauntlet : 'floor ' + run.floor) + '.') + '</b></div>' +
        '<div class="gm-row"><button class="btn green" data-gm="pbagain">Restart dungeon</button><button class="btn" data-gm="pbclose">Back</button></div>';
      return html + pbDeckStrip(run.deck) + '</section>';
    }
    if (run.victory) {
      html += '<div class="sk-end won"><b>The dungeon is conquered!</b><span>Rest on your laurels and end the run, or go on into the Gauntlet: endless floors, a boss every third, a full heal after each, no shops.</span></div>' +
        '<div class="gm-row"><button class="btn green" data-gm="pbrest">Rest on your laurels</button><button class="btn" data-gm="pbgauntlet">Enter the Gauntlet</button></div>';
      return html + pbDeckStrip(run.deck) + '</section>';
    }
    if (run.shop) {
      const S = run.shop;
      html += pbHearts(run, null) + '<p class="gm-fixed">The shop. Next floor is ' + S.floor + ' of ' + PBM.floorsOf(run) + '. Move as often as you like: land on an item to buy it, take the stairs on c5 to go on.</p>' +
        '<div class="sk-row small pb-moves"><span>Moves here:</span>' + H.shop.map((p) => '<span class="pb-tag"><i class="pb-ic" style="background-image:url(' + pbPic(p) + ')"></i>' + PBM.PIECES[p].name + '</span>').join('') + '</div>';
      html += '<div class="pb-offers">' + S.offers.map((o) => {
        if (o.heart) return '<div class="pb-offer' + (o.sold ? ' sold' : '') + '">' + pbIcon('heart') + '<span><b>Heart</b><small>' + PBM.name(o.sq) + '</small></span><em>' + (o.sold ? 'bought' : o.price + ' gold') + '</em></div>';
        const c = run.deck.find((x) => x.id === o.card);
        return '<div class="pb-offer' + (o.sold ? ' sold' : '') + '"><i class="pb-ic" style="background-image:url(' + pbPic(c.p) + ')"></i>' + pbIcon(o.up) + '<span><b>' + PBM.UPGRADES[o.up].name + '</b><small>' + PBM.PIECES[c.p].name + '</small><small>' + PBM.name(o.sq) + '</small></span><em>' + (o.sold ? 'bought' : o.price + ' gold') + '</em></div>';
      }).join('') + '</div>';
      return html + '<div class="sk-row small pb-hov" id="pbHover"></div><h3 class="sk-h">Deck</h3>' + pbDeckStrip(run.deck) + '<div class="gm-row sk-acts"><button class="btn" data-gm="pbquit">Give up</button></div></section>';
    }
    const F = run.F;
    html += pbLoot(run, F) + pbHearts(run, F);
    if (F.over === 'cleared') {
      html += '<div class="sk-end won"><b>Floor cleared!</b><span>' + (F.cleared.gold ? '+' + F.cleared.gold + ' gold.' : 'No gold left on the track.') + '</span>' + (F.cleared.heal ? '<span>Healed.</span>' : '') + '</div>' +
        '<button class="btn green gm-wide" data-gm="pbnext">' + (run.gauntlet ? 'On to the next floor' : run.floor >= PBM.floorsOf(run) ? 'Onward' : 'To the shop') + '</button>';
      return html + '</section>';
    }
    const st = [];
    st.push('<span class="pb-acts" title="Actions left this turn">' + '<u></u>'.repeat(Math.max(0, F.actions)) + (F.actions ? '' : '<em>no actions left</em>') + '</span>');
    if (F.rage) st.push('<span class="pb-tag red" title="Every card played gains a Cantrip and uses up one Rage">Rage ' + F.rage + '</span>');
    if (H.dragon) st.push('<span class="pb-tag" title="Dragon Drop charges: one per monster a card kills">Charges ' + F.charges + '</span>');
    if (F.webbed) st.push('<span class="pb-tag" title="A Webweaver died: 2 cards next turn">Webbed!</span>');
    html += '<div class="sk-row pb-status">' + st.join('') + '</div>';
    const pend = pbPending(run, F);
    if (pend > 0) html += '<div class="sk-warn pb-check">' + (pend >= run.hearts && !PBM.DUNGEON[run.dungeon].tutorial ? 'Deadly: ' + pend + ' damage if you end the turn here.' : 'In danger: ' + pend + ' damage if you end the turn here.') + '</div>';
    html += '<div class="pb-hand">' + F.hand.map((c, i) => {
      const can = F.actions > 0 && PBM.cardTargets(run, F, c).length > 0;
      return '<button class="pb-card' + (pbUi.deal ? ' deal' : '') + (pbUi.card === i ? ' on' : '') + (c.promo ? ' promo' : '') + (can ? '' : ' dead') + '" data-pbcard="' + i + '" style="--i:' + i + '" title="' + PBM.PIECES[PBM.pieceOf(c)].text + '"><span class="pb-ups">' + pbUps(c.up) + '</span><i style="background-image:url(' + pbPic(c) + ')"></i><b>' + pbPieceName(c) + '</b><kbd>' + (i + 1) + '</kbd></button>';
    }).join('') + '</div>';
    html += '<div class="gm-row sk-acts"><button class="btn green" data-gm="pbend">End turn (Space)</button>' +
      (H.dragon ? '<button class="btn" data-gm="pbdrop"' + (F.actions > 0 ? '' : ' disabled') + ' title="Costs an action. A Shield and a promotion; from 1 charge a Diagonal Splash, from 2 a Cardinal Splash, from 3 a Cantrip, from 4 a Shield more per charge">Dragon Drop (' + F.charges + ')</button>' : '') +
      '<button class="btn" data-gm="pbquit">Give up</button></div>';
    html += '<div class="sk-row small pb-hov" id="pbHover"></div>';
    html += '<h3 class="sk-h">Draw pile (' + F.draw.length + ')</h3>' + pbDeckStrip(F.draw.slice().sort((a, b) => a.id - b.id), 'small') + '<h3 class="sk-h">Discard (' + F.discard.length + ')</h3>' + pbDeckStrip(F.discard, 'small');
    return html + '</section>';
  }
  function wirePb(box) {
    box.querySelectorAll('[data-pbhero]').forEach((b) => { b.onclick = () => { pbUi.hero = b.dataset.pbhero; pbSaveSet(); renderModes(); renderAll(); }; });
    box.querySelectorAll('[data-pbdun]').forEach((b) => { b.onclick = () => { pbUi.dungeon = b.dataset.pbdun; pbSaveSet(); renderModes(); }; });
    box.querySelectorAll('[data-pbchain]').forEach((b) => { b.onclick = () => { pbUi.chain = +b.dataset.pbchain; pbSaveSet(); renderModes(); }; });
    box.querySelectorAll('[data-pbcard]').forEach((b) => { b.onclick = () => { const i = +b.dataset.pbcard; pbUi.card = pbUi.card === i ? -1 : i; if (pbUi.card >= 0) snd('pb:flick'); renderModes(); renderAll(); }; });
  }
  function pbKey(e) {
    if (ui.tab !== 'modes' || gmTab !== 'pb' || !pbLive()) return false;
    const F = pbRun().F;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pbEnd(); return true; }
    if (/^[1-4]$/.test(e.key) && F.hand[+e.key - 1]) { pbUi.card = pbUi.card === +e.key - 1 ? -1 : +e.key - 1; if (pbUi.card >= 0) snd('pb:flick'); renderModes(); renderAll(); return true; }
    if ((e.key === 'd' || e.key === 'D') && PBM.HERO[pbRun().hero].dragon) { pbDrop(); return true; }
    if (e.key === 'Escape' && pbUi.card >= 0) { pbUi.card = -1; renderModes(); renderAll(); return true; }
    return false;
  }
  function pbAct(k) {
    const d = pbData(), run = pbRun();
    if (k === 'pbstart') pbStart(false);
    else if (k === 'pbagain') pbStart(true);
    else if (k === 'pbclose') { if (d.run) d.run.closed = true; d.run = null; pbAfter(null); }
    else if (k === 'pbend') pbEnd();
    else if (k === 'pbdrop') pbDrop();
    else if (k === 'pbnext') { if (PBM.next(d)) { if (run && run.victory) snd('win'); else snd('start'); pbAfter(null); } }
    else if (k === 'pbrest') { PBM.rest(d); pbAfter(null); }
    else if (k === 'pbgauntlet') { PBM.gauntlet(d); snd('start'); pbAfter(null); }
    else if (k === 'pbquit') { if (run && confirm('Give up this run? It ends on floor ' + run.floor + '.')) { PBM.giveUp(d); pbAfter(null); } }
    else return false;
    return true;
  }
  function wireModes(box) {
    box.querySelectorAll('[data-tp]').forEach((b) => { b.onclick = () => { const set = SETS[b.dataset.tp](); set.twoP = !set.twoP; if (set.twoP) set.match = null; saveSets(); renderModes(); renderAll(); }; });
    box.querySelectorAll('[data-tpflip]').forEach((b) => { b.onclick = () => { const set = SETS[b.dataset.tpflip](); set.flip = !set.flip; saveSets(); renderModes(); }; });
    wireDrawback(box);
    wireHex(box);
    wireOuro(box);
    wireShogi(box);
    wireSk(box);
    wirePb(box);
    box.querySelectorAll('[data-gmtab]').forEach((b) => {
      b.onclick = () => { gmTab = b.dataset.gmtab; try { localStorage.setItem('powerchess_gmtab', gmTab); } catch (e) { /* private mode */ } msSel = null; renderModes(); renderAll(); };
    });
    box.querySelectorAll('[data-tier]').forEach((b) => { b.onclick = () => startMode('dice', b.dataset.tier); });
    box.querySelectorAll('[data-peek]').forEach((b) => { b.onclick = () => { msPeek = msPeek === b.dataset.peek ? null : b.dataset.peek; ui.info = null; renderModes(); }; });
    box.querySelectorAll('[data-gm]').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.gm;
        syncModes();
        if (k.indexOf('pb') === 0 && pbAct(k)) return;
        if (k === 'resume') { b.disabled = true; b.textContent = 'Loading'; resumePending(); }
        else if (k === 'dbstart') startMode('drawback', JSON.parse(JSON.stringify(dbSet)));
        else if (k === 'dc2start') startMode('dice', JSON.parse(JSON.stringify(diceSet)));
        else if (k === 'hxstart') startMode('hex', JSON.parse(JSON.stringify(hexSet)));
        else if (k === 'sgstart') startShogi();
        else if (k === 'skstart') skStart(false);
        else if (k === 'dailystart') startDaily();
        else if (k === 'skagain') skStart(true);
        else if (k === 'skclose') { const r = skRun(); if (r) r.closed = true; saveModes(); renderModes(); renderAll(); }
        else if (k === 'skreload') skReload();
        else if (k === 'skblade') { skUi.blade = !skUi.blade; skUi.grenade = false; skUi.soul = -1; skUi.pick = null; renderModes(); renderAll(); }
        else if (k === 'skgrenade') { skUi.grenade = !skUi.grenade; skUi.blade = false; skUi.soul = -1; skUi.pick = null; renderModes(); renderAll(); }
        else if (k === 'skdecree') { skUi.decree = !skUi.decree; renderModes(); renderAll(); }
        else if (k === 'skscope') skDo({ k: 'scope' });
        else if (k.indexOf('sktool:') === 0) {
          const kind = k.split(':')[1], id = k.split(':')[2], r = skRun();
          if (SK_DIRECT[id]) { const a = r && r.F && SKM.actions(r, r.F).find((x) => x.k === kind && x.id === id); if (a) skDo(a); }
          else {
            const same = skUi.pick && skUi.pick.k === kind && (skUi.pick.id || '') === id;
            skUi.pick = same ? null : { k: kind, id: id || null }; skUi.grenade = false; skUi.blade = false;
            if (kind !== 'project') skUi.soul = -1;
            renderModes(); renderAll();
          }
        }
        else if (k.indexOf('skdisrupt:') === 0) { const r = skRun(), a = r && r.F && SKM.actions(r, r.F).find((x) => x.k === 'disrupt' && x.id === k.slice(10)); if (a) skDo(a); }
        else if (k === 'skdanger') { skUi.danger = !skUi.danger; skSaveSet(); renderModes(); renderAll(); }
        else if (k === 'sksearch') { const r = skRun(); if (r && SKM.search(r)) { saveModes(); renderModes(); } }
        else if (k === 'skquit') { const r = skRun(); if (r && confirm('Give up this run? It ends on floor ' + r.floor + '.')) { r.phase = 'lost'; if (r.F) r.F.over = 'dead'; skSettle(); saveModes(); renderModes(); renderAll(); } }
        else if (k === 'ouback') { if (Ouro.cancelPlace(MS.run)) { saveModes(); renderModes(); renderAll(); } }
        else if (k === 'ourostart') { const first = !MS.runs.count; Ouro.newRun(MS, Modes.newSeed(), first ? null : ouStart.slice()); ouStart = []; ouSel = null; saveModes(); snd('start'); renderModes(); renderAll(); }
        else if (k === 'ouroclose') { MS.run = null; saveModes(); renderModes(); renderAll(); }
        else if (k === 'travel') { const run = ouroRun(); msSel = null; if (run && ouSel && Ouro.travel(run, ouSel)) { ouSel = null; saveModes(); snd('start'); renderModes(); renderAll(); } }
        else if (k === 'oleave') { const run = ouroRun(); if (run && Ouro.leave(run)) { obGet = null; saveModes(); renderModes(); renderAll(); } }
        else if (k === 'giveup') giveUpPending();
        else if (k === 'fight') startMode('run');
        else if (k === 'abandon') {
          if (MS.pending && MS.pending.kind === 'run') { toast('Finish or give up the stage that is still running first'); return; }
          const run = ouroRun();
          if (!run || !confirm('Abandon this run? It ends here, after ' + run.won + (run.won === 1 ? ' battle' : ' battles') + ' won.')) return;
          if (!run.battle) run.battle = { id: run.at || 'none', type: 'recruit', boss: false, reward: 0 };
          Ouro.settle(MS, 'l', {}); saveModes(); renderModes(); renderAll();
        }
      };
    });
  }

  /* ---------- board editor ---------- */

  /* The editor works on the plain rules (rules.js): the chess pieces, every fairy piece the rules know
     (R.FAIRY), and the terrain. A position with fairy pieces or terrain is played by the power-up
     search, which reads all of it; the chess engines never see such a board. */
  const ED_ORDER = R.FAIRY_LETTERS;
  /* The Ouroboros King's units in the palette: the royal pieces and the evolved chess pieces first, then every base
     unit followed right by what it evolves into (assassin, then blade dancer), the rest after them, the witches last.
     Any unit not named here is added at the end. */
  const OURO_ORDER = ['э', 'ю', 'κ', 'θ', 'ι', 'ο', 'ξ', 'π', 'б', 'в', 'г', 'ж', 'o', 'ν', 's', 't', 'ρ', 'λ', 'τ', 'ε', 'υ', 'ζ', 'η', 'φ', 'ω', 'χ', 'ψ', 'з', 'щ', 'д', 'ы', 'и', 'й', 'α', 'γ', 'β', 'δ', 'x', 'v', 'y', 'μ', 'л', 'п', 'ф', 'ц', 'ч', 'ш', 'ђ', 'ћ', 'ъ', 'я', 'ь', 'ё'];
  function ouroOrder(list) { return OURO_ORDER.filter((l) => list.indexOf(l) >= 0).concat(list.filter((l) => OURO_ORDER.indexOf(l) < 0)); }
  const edHasFairy = () => ed.board.some((p) => p && R.isFairy(p));
  function edLoad(fen) {
    const s = R.fromFen(fen);
    if ((s.W !== ed.W || s.H !== ed.H) && ed.terrain) ed.terrain = { walls: [], water: [], portals: [], holes: [] }; // the old terrain does not fit a board of another size
    ed.W = s.W || 8; ed.H = s.H || 8;
    ed.board = s.board.slice();
    ed.ghosts = []; ed.snipers = []; ed.helmets = []; ed.vests = []; // a new position starts without upgrades
    ed.turn = s.turn;
    ed.castling = s.castling;
  }
  function edSync() {
    // an upgrade belongs to a piece: it goes when the square is empty
    ed.ghosts = ed.ghosts.filter((q) => !!ed.board[q]); ed.snipers = ed.snipers.filter((q) => !!ed.board[q]);
    ed.helmets = ed.helmets.filter((q) => !!ed.board[q] && !R.isRoyal(ed.board[q])); ed.vests = ed.vests.filter((q) => !!ed.board[q] && !R.isRoyal(ed.board[q]));
    setup.traits = { ghosts: ed.ghosts.slice(), snipers: ed.snipers.slice(), helmets: ed.helmets.slice(), vests: ed.vests.slice() };
    R.use({ W: ed.W, H: ed.H });
    const T = ed.terrain;
    if (!T.holes) T.holes = [];
    T.holes.forEach((q) => { ed.board[q] = ''; }); // nothing stands where there is no square
    const cs = ed.W === 8 && ed.H === 8 ? R.cleanCastling({ board: ed.board, castling: ed.castling, W: 8, H: 8 }) : ''; // castling only on the normal board
    setup.fen = R.boardFen(ed.board, ed.W) + ' ' + ed.turn + ' ' + (cs || '-') + ' - 0 1';
    setup.terrain = JSON.parse(JSON.stringify(ed.terrain));
    if (ui.tab === 'editor') ed.touched = true; // the board was changed by hand (see setTab)
    changed();
  }
  const UPGRADE_TOOLS = [['ghost', 'Ghost', 'Moves through its own pieces, like the Ghost power-ups, and attacks through them'], ['camo', 'Camo', 'Shoots what it could take without leaving its square, like the Sniper power-ups'],
    ['helmet', 'Helmet', 'Spiked helmet: the next capture of this piece bounces off, breaks the helmet and freezes the attacker for a turn. Not for kings'], ['vest', 'Vest', 'Explosive vest: instead of moving the piece can go up and take the 3 x 3 square around it with it. Not for kings']];
  const TERRAIN_TOOLS = [['duck', 'Yellow duck', 'Has to be moved to another free square after every move, by the side that moved. Nothing enters or passes it, nothing takes it, a knight jumps over. Several of them all have to move, never onto a square a yellow duck stood on. One with nowhere to go ends the game in a draw'], ['bduck', 'Blue duck', 'Blocks like a yellow duck, but moving it is up to you: each blue duck may be moved once a turn, at any point of the turn'], ['wall', 'Boulder', 'Nothing can enter or pass this square'], ['water', 'Water', 'A piece may slide into it, but not through it. Jumps and shots go over it'], ['portal', 'Teleporter', 'Two of them make a pair: a piece that lands on one comes out at the other'], ['hole', 'Remove square', 'The square is gone: nothing stands on it and nothing slides across it, a jump goes over it']];
  /* Board size. A start position for any size: the pawns on the second rank, the king in the middle with the
     queen beside it, then bishop, knight and rook outwards, repeated on wide boards so a rook stands in each
     corner. Black is the mirror image. Too low a board for pawns gets the back ranks only. */
  function sizedStart(w, h) {
    const back = new Array(w).fill(''), k = Math.floor(w / 2);
    back[k] = 'K';
    if (k - 1 >= 0) back[k - 1] = 'Q';
    for (let f = 0; f < w; f++) if (!back[f]) { const d = f < k ? f : w - 1 - f; back[f] = 'RNB'[d % 3]; }
    const b = new Array(w * h).fill('');
    for (let f = 0; f < w; f++) { b[(h - 1) * w + f] = back[f]; b[f] = back[f].toLowerCase(); }
    if (h >= 4) for (let f = 0; f < w; f++) { b[(h - 2) * w + f] = 'P'; b[w + f] = 'p'; }
    return b;
  }
  function edResize(w, h, fresh) {
    w = Math.max(3, Math.min(R.MAXW, w | 0 || 8)); h = Math.max(3, Math.min(R.MAXW, h | 0 || 8));
    if (w === ed.W && h === ed.H && !fresh) return;
    if (fresh) setup.kcPreset = false;
    const T = ed.terrain;
    if (fresh) {
      ed.board = sizedStart(w, h);
      ed.terrain = { walls: [], water: [], portals: [], holes: [] };
      ed.ghosts = []; ed.snipers = []; ed.helmets = []; ed.vests = [];
      ed.turn = 'w'; ed.castling = w === 8 && h === 8 ? 'KQkq' : ''; // the normal start, castling included
    } else {
      /* Keep the position: the top half stays at the top, the bottom half at the bottom (so both armies keep
         their home rank), and the files stay centred. Whatever falls off the board is gone. */
      const ox = Math.floor((w - ed.W) / 2), oW = ed.W, oH = ed.H;
      const to = (q) => {
        const r = Math.floor(q / oW), f = q % oW, nf = f + ox, nr = r < oH / 2 ? r : h - (oH - r);
        return nf >= 0 && nf < w && nr >= 0 && nr < h && (r < oH / 2 ? nr < h / 2 : nr >= h / 2) ? nr * w + nf : -1;
      };
      const nb = new Array(w * h).fill('');
      ed.board.forEach((p, q) => { const t = to(q); if (p && t >= 0) nb[t] = p; });
      const mv = (list) => (list || []).map(to).filter((q) => q >= 0);
      ed.board = nb;
      ed.terrain = { walls: mv(T.walls), water: mv(T.water), portals: mv(T.portals), holes: mv(T.holes) };
      if (ed.terrain.portals.length !== T.portals.length) ed.terrain.portals = [];
      ed.ghosts = mv(ed.ghosts); ed.snipers = mv(ed.snipers); ed.helmets = mv(ed.helmets); ed.vests = mv(ed.vests);
    }
    ed.W = w; ed.H = h;
    if (w !== 8 || h !== 8) ed.castling = '';
    edSync();
  }
  /* One king a side: the king, the Shogi King and the Shotgun King are each their side's king, so a new one put on the
     board takes the side's other king off. */
  const isKingType = (p) => !!p && 'kѣґ'.indexOf(p.toLowerCase()) >= 0;
  function oneKing(board, sq) {
    const p = board[sq];
    if (!isKingType(p)) return;
    for (let q = 0; q < board.length; q++) if (q !== sq && isKingType(board[q]) && R.colorOf(board[q]) === R.colorOf(p)) board[q] = '';
  }
  function editorDown(sq, e) {
    if (ed.brush === null) {
      if (!ed.board[sq]) return;
      const el = L.pieces.querySelector('[data-sq="' + sq + '"]');
      ui.drag = { sq: sq, el: el, x: e.clientX, y: e.clientY, moved: false, editor: true };
      try { board.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      return;
    }
    const T = ed.terrain, drop = (list, q) => { const i = list.indexOf(q); if (i >= 0) list.splice(i, 1); return i >= 0; };
    if (!T.holes) T.holes = [];
    if (!T.ducks) T.ducks = [];
    if (!T.bducks) T.bducks = [];
    if (ed.brush === 'duck' || ed.brush === 'bduck') {
      // a duck stands alone on its square: no piece, no boulder, no hole under it; a second click takes it away
      const list = ed.brush === 'duck' ? T.ducks : T.bducks;
      if (drop(list, sq)) { edSync(); return; }
      drop(T.ducks, sq); drop(T.bducks, sq); drop(T.walls, sq); drop(T.holes, sq);
      ed.board[sq] = ''; drop(ed.ghosts, sq); drop(ed.snipers, sq); drop(ed.helmets, sq); drop(ed.vests, sq);
      list.push(sq);
      edSync();
      return;
    }
    if (ed.brush === 'wall' || ed.brush === 'water' || ed.brush === 'portal' || ed.brush === 'hole') {
      // terrain: a second click takes it away again; the kinds never share a square
      const list = ed.brush === 'wall' ? T.walls : ed.brush === 'water' ? T.water : ed.brush === 'hole' ? T.holes : T.portals;
      if (drop(list, sq)) { ui.paint = ed.brush === 'hole' ? { hole: false } : null; edSync(); return; }
      drop(T.walls, sq); drop(T.water, sq); drop(T.portals, sq); drop(T.holes, sq);
      if (ed.brush === 'wall' || ed.brush === 'hole') { drop(T.ducks, sq); drop(T.bducks, sq); }
      if (ed.brush === 'portal' && T.portals.length >= 2) T.portals.shift();
      list.push(sq);
      if (ed.brush === 'wall' || ed.brush === 'hole') { ed.board[sq] = ''; drop(ed.ghosts, sq); drop(ed.snipers, sq); drop(ed.helmets, sq); drop(ed.vests, sq); }
      if (ed.brush === 'hole') ui.paint = { hole: true }; // drag on to cut out more squares
      edSync();
      return;
    }
    if (ed.brush === 'ghost' || ed.brush === 'camo' || ed.brush === 'helmet' || ed.brush === 'vest') {
      // an upgrade on one piece: a second click takes it off again (no helmet or vest for a king)
      if (!ed.board[sq]) return;
      if ((ed.brush === 'helmet' || ed.brush === 'vest') && R.isRoyal(ed.board[sq])) { toast('Kings wear neither a helmet nor a vest'); return; }
      const list = ed.brush === 'ghost' ? ed.ghosts : ed.brush === 'camo' ? ed.snipers : ed.brush === 'helmet' ? ed.helmets : ed.vests;
      if (!drop(list, sq)) list.push(sq);
      edSync();
      return;
    }
    if (ed.brush === 'erase') { ed.board[sq] = ''; drop(T.walls, sq); drop(T.water, sq); drop(T.portals, sq); drop(T.holes, sq); drop(T.ducks, sq); drop(T.bducks, sq); ui.paint = { v: '' }; edSync(); return; }
    if (ed.board[sq] === ed.brush) { ed.board[sq] = ''; edSync(); return; }
    if (T.walls.indexOf(sq) >= 0 || T.holes.indexOf(sq) >= 0) return; // nothing stands on a boulder or where there is no square
    ui.paint = { v: ed.brush };
    drop(T.ducks, sq); drop(T.bducks, sq); // a piece pushes a duck off its square
    ed.board[sq] = ed.brush;
    oneKing(ed.board, sq);
    drop(ed.ghosts, sq); drop(ed.snipers, sq); drop(ed.helmets, sq); drop(ed.vests, sq); // a new piece, without the upgrades of the one before
    edSync();
  }
  /* How the piece in hand moves, as a small diagram: the piece in the middle of an empty board,
     every square it can reach marked. A round dot is a plain move, a diamond a jump, a hollow dot a
     square it can move to but not capture on, a ring one it can only capture on. */
  /* The markers of the movement diagram, one per kind of square, also drawn in its legend. */
  const MOVE_MARKS = [['spawn', 'Spawns a demon here'], ['both', 'Move or capture'], ['bothJump', 'Jump, move or capture'], ['move', 'Move only'], ['moveJump', 'Jump, move only'], ['cap', 'Capture only'], ['shoot', 'Shoot: takes without moving']];
  function moveMark(k, cx, cy) {
    const col = 'rgba(20,20,20,.55)', red = 'rgba(190,30,30,.8)';
    const dia = (r, fill) => '<rect x="' + (cx - r) + '" y="' + (cy - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" transform="rotate(45 ' + cx + ' ' + cy + ')" ' + fill + '/>';
    if (k === 'spawn') return '<path d="M' + cx + ' ' + (cy - 5.5) + 'l4.6 8.2h-9.2z" fill="' + red + '"/>'; // a small red triangle: a demon comes out here
    if (k === 'both') return '<circle cx="' + cx + '" cy="' + cy + '" r="3.9" fill="' + col + '"/>';
    if (k === 'bothJump') return dia(4.7, 'fill="' + col + '"');
    if (k === 'move') return '<circle cx="' + cx + '" cy="' + cy + '" r="3.4" fill="none" stroke="' + col + '" stroke-width="2"/>';
    if (k === 'moveJump') return dia(4.3, 'fill="none" stroke="' + col + '" stroke-width="2"');
    if (k === 'cap') return '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="none" stroke="' + red + '" stroke-width="2.2"/>';
    return '<circle cx="' + cx + '" cy="' + cy + '" r="6.4" fill="none" stroke="' + red + '" stroke-width="2"/><path d="M' + cx + ' ' + (cy - 9.5) + 'v6M' + cx + ' ' + (cy + 3.5) + 'v6M' + (cx - 9.5) + ' ' + cy + 'h6M' + (cx + 3.5) + ' ' + cy + 'h6" stroke="' + red + '" stroke-width="2"/>';
  }
  // the legend: the markers this piece uses, each on a square as on the diagram
  function moveLegend(used) {
    const rows = MOVE_MARKS.filter((m) => used[m[0]]);
    if (!rows.length) {
      const d = edDiagram.letter && R.isFairy(edDiagram.letter) ? R.fairyOf(edDiagram.letter) : null;
      const why = d && d.mimic ? (d.mimic === 'fool' ? 'it copies the last enemy piece that moved, and none has yet' : 'it copies the moves of the other side\'s pieces, see above') : d && d.demon ? 'it walks one square forward by itself after every turn of its side, the square ahead of it is in danger' : d && !d.atoms.length ? 'it never moves' : 'it needs other pieces on the board to move';
      return '<div class="mlegend none">No squares to show: ' + why + '.</div>';
    }
    return '<div class="mlegend">' + rows.map((m) => '<div><svg viewBox="0 0 22 22"><rect width="22" height="22" rx="3" fill="#ebecd0"/>' + moveMark(m[0], 11, 11) + '</svg><span>' + m[1] + '</span></div>').join('') + '</div>';
  }
  function edDiagram(letter, gameCfg, mimicTypes) {
    /* The power-ups set on the Power-ups page count too (a sniper shoots, a dragon knight slides): White gets the
       first set, Black the second one or the same one, as the next game would hand them out. */
    const flags = (p) => { if (!p) return null; const o = { double: 0, midasPerTurn: 1 }; POWER_KEYS.forEach((k) => { o[k] = !!p[k]; }); return R.anyPower(o) ? o : null; };
    const black = setup.ai.use === 'same' ? setup.powers : setup.ai.use === 'own' ? setup.powers2 : null;
    /* An 11 by 11 board with the piece in the middle; the diagram shows the 9 by 9 squares around it. The king
       the rules want stands in a corner, outside the part that is shown. */
    const BS = 11, cfg = gameCfg ? { side: 'w', pw: gameCfg.pw || { w: null, b: null } } : { side: 'w', pw: { w: flags(setup.powers), b: flags(black) } }, c = R.colorOf(letter), centre = 5 * BS + 5, N = 9, cell = 22, size = N * cell;
    const base = new Array(BS * BS).fill('');
    base[centre] = letter;
    base[c === 'w' ? BS - 1 : BS * (BS - 1)] = c === 'w' ? 'K' : 'k';
    const st = (board) => Object.assign(R.fromFen('11/11/11/11/11/11/11/11/11/11/11 w - - 0 1', cfg), { board: board, turn: c, fairy: R.hasFairy(board) });
    const moves = {}, caps = {}, shots = {};
    // the squares of one piece on the centre square: where it moves, where it takes, where it shoots
    const collect = (L) => {
      const b0 = base.slice();
      b0[centre] = L;
      R.pseudoMoves(st(b0), cfg).forEach((m) => { if (m.from === centre && !m.snipe) moves[m.to] = m.spawn ? 'spawn' : moves[m.to] === 'move' ? 'move' : m.jump ? 'jump' : 'move'; });
      for (let t = 0; t < BS * BS; t++) {
        if (t === centre || b0[t]) continue;
        const b2 = b0.slice();
        b2[t] = c === 'w' ? 'p' : 'P';
        // a shot (the piece takes without leaving its square) wins over a capture by moving, both are marked
        R.pseudoMoves(st(b2), cfg).forEach((m) => {
          if (m.from !== centre || !m.cap || (m.capSq >= 0 ? m.capSq : m.to) !== t) return; // a checker takes the piece it jumps over
          if (m.snipe) shots[t] = true; else caps[t] = caps[t] === 'move' ? 'move' : m.jump ? 'jump' : 'move';
        });
      }
    };
    /* A mimic (Fool, Tabitha) borrows its moves from the other side's pieces. In a game (mimicTypes: the kinds it
       copies right now) the diagram is every one of them on the centre square together; without a game there is
       nothing to copy, and a lone test piece would only show a misleading part. */
    const mimic = R.isFairy(letter) && R.fairyOf(letter).mimic;
    if (!mimic) collect(letter);
    else if (mimicTypes) mimicTypes.forEach((t) => collect(c === 'w' ? t.toUpperCase() : t.toLowerCase()));
    let g = '<svg viewBox="0 0 ' + size + ' ' + size + '" class="eddia">';
    const used = {};
    for (let r = 0; r < N; r++) for (let f = 0; f < N; f++) {
      const sq = 1 + r, sf = 1 + f, idx = sq * BS + sf, light = (sq + sf) % 2 === 0;
      const x = f * cell, y = r * cell, cx = x + cell / 2, cy = y + cell / 2;
      g += '<rect x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell + '" fill="' + (light ? '#ebecd0' : '#739552') + '"/>';
      if (idx === centre) continue;
      const mv = moves[idx], cp = caps[idx], sh = shots[idx];
      if (sh) { g += moveMark('shoot', cx, cy); used.shoot = true; }
      if (!mv && !cp) continue;
      const k = mv === 'spawn' ? 'spawn' : mv && cp ? ((mv || cp) === 'jump' ? 'bothJump' : 'both') : mv ? (mv === 'jump' ? 'moveJump' : 'move') : 'cap';
      g += moveMark(k, cx, cy);
      used[k] = true;
    }
    edDiagram.used = used; // which markers this piece needs, for the legend next to it
    edDiagram.letter = letter;
    g += '<image href="' + (R.isFairy(letter) && R.fairyOf(letter).pic ? fairyPic(c, R.fairyOf(letter).pic) : pieceUrl(R.isFairy(letter) ? (c === 'w' ? R.fairyOf(letter).base : R.fairyOf(letter).base.toLowerCase()) : letter)) + '" x="' + (4 * cell + 1) + '" y="' + (4 * cell + 1) + '" width="' + (cell - 2) + '" height="' + (cell - 2) + '"/>';
    return g + '</svg>';
  }
  /* The card pinned to the top of the editor panel: what is in hand, with its movement diagram. */
  function edShowPick(br) {
    const pick = $('#edPick');
    const NAMES = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };
    const ter = TERRAIN_TOOLS.find((t) => t[0] === br), upt = UPGRADE_TOOLS.find((t) => t[0] === br);
    pick.classList.toggle('withdia', !upt && !ter && br !== null && br !== 'erase'); // a piece: diagram, text and legend in a grid
    if (upt) pick.innerHTML = '<div class="pic ter up"><span class="piece ' + (br === 'ghost' ? 'ghost' : br === 'camo' ? 'camo' : '') + '" style="background-image:' + (br === 'ghost' ? imgUrl('wR') : br === 'camo' ? skinUrl('camo', 'wB') : imgUrl('wN')) + '">' + (br === 'helmet' || br === 'vest' ? '<i class="wear ' + br + '"></i>' : '') + '</span></div><div><b>' + upt[1] + '</b><span>' + upt[2] + '. Click a piece to give it the upgrade, click it again to take it off. Any piece can have it, of either colour.</span></div>';
    else if (br === null) pick.innerHTML = '<div class="pic hand">\u270b</div><div><b>Hand</b><span>Drag a piece to another square, or off the board to remove it</span></div>';
    else if (br === 'erase') pick.innerHTML = '<div class="pic hand">\u2715</div><div><b>Eraser</b><span>Click a square to clear it, pieces and terrain alike</span></div>';
    else if (ter) pick.innerHTML = '<div class="pic ter ' + br + '"></div><div><b>' + ter[1] + '</b><span>' + ter[2] + '. Click a square to put it there, click again to take it away</span></div>';
    else {
      const c = R.colorOf(br), def = R.isFairy(br) ? R.fairyOf(br) : null, name = def ? def.name : NAMES[br.toLowerCase()];
      const HOW = { k: 'Moves one square in any direction', q: 'Slides any distance straight or diagonally', r: 'Slides any distance straight', b: 'Slides any distance diagonally', n: 'Jumps two squares one way and one the other, over anything', p: 'Moves one square forward, two from its start, takes one square diagonally forward and promotes on the last rank' };
      const dia = edDiagram(br);
      pick.innerHTML = dia + '<div class="edinfo"><b>' + (c === 'w' ? 'White ' : 'Black ') + name + '</b><span class="how">' + (def ? def.how : HOW[br.toLowerCase()]) + '.</span></div>' +
        moveLegend(edDiagram.used);
    }
  }
  function renderEditor() {
    const pal = $('#palette');
    pal.innerHTML = '';
    const tool = (brush, inner, title) => {
      const b = h('button', ed.brush === brush ? 'on' : '', inner);
      b.title = title;
      if (brush && brush !== 'erase') b.style.backgroundImage = 'url(' + pieceUrl(brush) + ')';
      b.onclick = () => { ed.brush = brush; renderEditor(); };
      pal.appendChild(b);
    };
    tool(null, '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 11V4.500a1.500 1.500 0 0 1 3 0V10h1V3.500a1.500 1.500 0 0 1 3 0V10h1V5.500a1.500 1.500 0 0 1 3 0V15c0 4-2.500 7-7 7-3.500 0-5.200-1.500-7-4.500L3.300 13c-.800-1.500 1-2.800 2.200-1.500L8 14V6.500a1.500 1.500 0 0 1 1-1.400z"/></svg>', 'Move pieces');
    'KQRBNP'.split('').forEach((p) => tool(p, '', 'White ' + p));
    tool('erase', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round"><path d="M5 7h14M10 7V4.500h4V7M7 7l1 13h8l1-13M10.500 11v5.500M13.500 11v5.500"/></svg>', 'Eraser');
    'kqrbnp'.split('').forEach((p) => tool(p, '', 'Black ' + p.toUpperCase()));
    // fairy pieces, white then black
    const fp = $('#fairyPalette');
    fp.innerHTML = '';
    // three groups, each white then black: the classic fairy pieces, The Ouroboros King's units (from the crusader on), checkers
    const cut = ED_ORDER.indexOf('o'), CHECKERS = ['є', 'ї'], ULTIMATE = ['ѓ', 'ќ', 'ў', 'џ'], SHOTGUN = ['ґ'], SHOGI = ED_ORDER.filter((l) => R.FAIRY[l].shogi), apart = CHECKERS.concat(ULTIMATE, SHOTGUN, SHOGI);
    [['Classic fairy pieces', ED_ORDER.slice(0, cut)], ['The Ouroboros King', ouroOrder(ED_ORDER.slice(cut).filter((l) => apart.indexOf(l) < 0))], ['Checkers', CHECKERS], ['Chess Ultimate', ULTIMATE], ['Shotgun King (one per side, it is the king)', SHOTGUN], ['Shogi (they promote on the far rank)', ['ѣ', 'ѥ', 'ѩ', 'ѭ', 'ѯ', 'ѳ', 'ѹ', 'ѽ', 'ѧ', 'ѫ', 'ѱ', 'ѵ', 'ѻ', 'ѿ']]].forEach((grp) => {
      fp.appendChild(h('div', 'palhead', grp[0]));
      ['w', 'b'].forEach((c) => {
        grp[1].forEach((l) => {
          const def = R.FAIRY[l], letter = c === 'w' ? l.toUpperCase() : l;
          const b = h('button', ed.brush === letter ? 'on' : '', def.pic ? '' : '<i class="dk-' + c + '">' + def.san + '</i>');
          b.title = (c === 'w' ? 'White ' : 'Black ') + def.name + ': ' + def.how;
          if (def.pic) b.style.backgroundImage = def.pic === 'shotgunking' ? skGunKing(c) : 'url(' + fairyPic(c, def.pic) + ')';
          b.onclick = () => { ed.brush = letter; renderEditor(); };
          fp.appendChild(b);
        });
        // black starts on a row of its own, so each black piece sits right under its white twin
        if (c === 'w') for (let k = (7 - grp[1].length % 7) % 7; k > 0; k--) fp.appendChild(h('span', 'palpad'));
      });
    });
    // terrain
    const tp = $('#terrainPalette');
    tp.innerHTML = '';
    const upp = $('#upgradePalette');
    upp.innerHTML = '';
    UPGRADE_TOOLS.forEach((t) => {
      const worn = t[0] === 'helmet' || t[0] === 'vest';
      const b = h('button', 'ter up ' + t[0] + (ed.brush === t[0] ? ' on' : ''), '<span class="piece ' + (t[0] === 'ghost' ? 'ghost' : worn ? '' : 'camo') + '">' + (worn ? '<i class="wear ' + t[0] + '"></i>' : '') + '</span>' + t[1]);
      b.querySelector('span').style.backgroundImage = t[0] === 'ghost' ? imgUrl('wR') : worn ? imgUrl('wN') : skinUrl('camo', 'wB');
      b.title = t[2];
      b.onclick = () => { ed.brush = t[0]; renderEditor(); };
      upp.appendChild(b);
    });
    TERRAIN_TOOLS.forEach((t) => {
      const b = h('button', 'ter ' + t[0] + (ed.brush === t[0] ? ' on' : ''), '<span></span>' + t[1]);
      b.title = t[2];
      b.onclick = () => { ed.brush = t[0]; renderEditor(); };
      tp.appendChild(b);
    });

    edShowPick(ed.brush);

    seg($('#edTurn'), [['w', 'White to move'], ['b', 'Black to move']], ed.turn, (v) => { ed.turn = v; edSync(); });

    const classic = ed.W === 8 && ed.H === 8;
    $('#edCastleWrap').style.display = classic ? '' : 'none'; // no castling on other sizes
    const wIn = $('#edW'), hIn = $('#edH');
    if (document.activeElement !== wIn) wIn.value = ed.W;
    if (document.activeElement !== hIn) hIn.value = ed.H;
    $('#edSizes').querySelectorAll('button').forEach((x) => x.classList.toggle('on', +x.dataset.w === ed.W && +x.dataset.h === ed.H));
    const cbox = $('#edCastle');
    cbox.innerHTML = '';
    const b = classic ? ed.board : [];
    [['K', 'White O-O', b[60] === 'K' && b[63] === 'R'], ['Q', 'White O-O-O', b[60] === 'K' && b[56] === 'R'],
      ['k', 'Black O-O', b[4] === 'k' && b[7] === 'r'], ['q', 'Black O-O-O', b[4] === 'k' && b[0] === 'r']].forEach((c) => {
      const lab = h('label', 'chk' + (c[2] ? '' : ' dis'));
      const inp = h('input');
      inp.type = 'checkbox';
      inp.disabled = !c[2];
      inp.checked = c[2] && ed.castling.indexOf(c[0]) >= 0;
      inp.onchange = () => {
        ed.castling = ed.castling.replace(c[0], '') + (inp.checked ? c[0] : '');
        edSync();
      };
      lab.appendChild(inp);
      lab.appendChild(document.createTextNode(c[1]));
      cbox.appendChild(lab);
    });

    const fen = $('#edFen');
    if (document.activeElement !== fen) fen.value = setup.fen;
    const msg = $('#edmsg');
    msg.className = ed.errs.length ? 'bad' : '';
    msg.textContent = ed.errs.length ? ed.errs.join(' ') : (edHasFairy() || hasTerrain(ed.terrain) || ed.W !== 8 || ed.H !== 8) ? 'This position is playable. With fairy pieces, terrain or a board that is not 8 by 8 the power-up search plays the bot and judges the game. The chess engines cannot read such a board.' : 'This position is playable. It is used for the next standard game you start.';
    $('#edFromGame').disabled = !G || G.B.kind !== 'std';
  }
  function edApplyFen(fen) {
    try { edLoad(fen); } catch (e) { toast(e.message); return false; }
    setup.kcPreset = false; // a new board: no longer the preset's
    edSync();
    return true;
  }

  /* ---------- preset browser ---------- */
  const presetUi = { tab: 'ouroboros', terrain: true, size: 'all' };
  const PRESET_TABS = [['ouroboros', 'The Ouroboros King'], ['chess', 'Chess'], ['fairy', 'Fairy pieces'], ['checkers', 'Checkers'], ['shogi', 'Shogi'], ['handicap', 'Handicaps and endgames'], ['terrainOnly', 'Terrain only']];
  // terrain by square names, for a board of the given size (square names depend on it)
  const toTerrain = (t, w, h) => {
    R.use({ W: w || 8, H: h || 8 });
    const at = (k) => (t && t[k] ? t[k] : []).map(R.sqIndex);
    return { walls: at('walls'), water: at('water'), portals: at('portals'), holes: at('holes'), ducks: at('ducks'), bducks: at('bducks') };
  };
  // width and height of a FEN's board, without building the position
  function fenDims(f) {
    const ranks = (f || '8/8/8/8/8/8/8/8').split(' ')[0].split('/');
    let w = 0;
    ranks[0].replace(/\d+|./g, (x) => { w += /\d/.test(x) ? +x : 1; return x; });
    return { W: w, H: ranks.length };
  }
  // A picture of any piece, the fairy ones included.
  function pieceSrc(p) {
    if (R.isFairy(p)) { const d = R.fairyOf(p); if (d.pic) return fairyPic(R.colorOf(p), d.pic); return pieceUrl(R.colorOf(p) === 'w' ? d.base : d.base.toLowerCase()); }
    return pieceUrl(p);
  }
  // A small board drawn as SVG: squares in the current colours, terrain, pieces.
  function boardThumb(board, terrain, w, h) {
    w = w || 8; h = h || 8;
    const th = [settings.theme].concat(boardColors(settings.theme)), c = 40;
    let g = '<svg viewBox="0 0 ' + w * c + ' ' + h * c + '" class="pm-board">';
    for (let i = 0; i < w * h; i++) {
      const r = Math.floor(i / w), f = i % w, x = f * c, y = r * c;
      if (terrain.holes && terrain.holes.indexOf(i) >= 0) continue; // a square taken off the board: the card shows through
      g += '<rect x="' + x + '" y="' + y + '" width="' + c + '" height="' + c + '" fill="' + ((r + f) % 2 ? th[2] : th[1]) + '"' + (th[3] ? ' stroke="' + th[3] + '" stroke-width="1"' : '') + '/>';
      if (terrain.water.indexOf(i) >= 0) g += '<rect x="' + x + '" y="' + y + '" width="' + c + '" height="' + c + '" fill="#3b86dc" opacity=".85"/>';
      if (terrain.walls.indexOf(i) >= 0) g += '<path d="M' + (x + 7) + ' ' + (y + 29) + 'q-4-9 4-16t18-4q9 4 7 14t-12 10q-13 2-17-4z" fill="#8a8278" stroke="#463f38" stroke-width="2"/>';
      const pi = terrain.portals.indexOf(i);
      if (pi >= 0) g += '<circle cx="' + (x + 20) + '" cy="' + (y + 20) + '" r="15" fill="none" stroke="' + (pi ? '#ff8a1f' : '#35a7ff') + '" stroke-width="4"/>';
      if (board[i]) g += '<image href="' + pieceSrc(board[i]) + '" x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (c - 2) + '" height="' + (c - 2) + '"/>';
    }
    return g + '</svg>';
  }
  const SIZE_ORDER = ['8x8', '10x10', '12x12', '16x16', '20x20', '26x26', '4x20', '7x13'];
  const sizeOf = (p) => { const d = fenDims(p.f || R.START_FEN); return d.W + 'x' + d.H; };
  const sizeRank = (k) => { const i = SIZE_ORDER.indexOf(k); return i < 0 ? 99 : i; };
  /* Shogi set-ups in the app's own letters (the rules of a normal game: the pieces move as in Shogi and promote on the
     far rank; no drops unless Reinforcements is on). In a handicap game the stronger player (Black here) gives up
     pieces and moves first. */
  const SHOGI_HC = (top, second) => top + '/' + second + '/ѽѽѽѽѽѽѽѽѽ/9/9/9/ѼѼѼѼѼѼѼѼѼ/1Ѩ5Ѥ1/ѸѲѮѬѢѬѮѲѸ b - - 0 1';
  const SHOGI_PRESETS = [
    { g: 'shogi', s: 'start', n: 'Shogi', d: 'The start of a game of Shogi on 9 by 9.', f: 'ѹѳѯѭѣѭѯѳѹ/1ѥ5ѩ1/ѽѽѽѽѽѽѽѽѽ/9/9/9/ѼѼѼѼѼѼѼѼѼ/1Ѩ5Ѥ1/ѸѲѮѬѢѬѮѲѸ w - - 0 1', t: null },
    { g: 'shogi', s: 'hc', n: 'Lance handicap', d: 'Black gives up a lance and moves first.', f: SHOGI_HC('ѹѳѯѭѣѭѯѳ1', '1ѥ5ѩ1'), t: null },
    { g: 'shogi', s: 'hc', n: 'Bishop handicap', d: 'Black plays without the bishop and moves first.', f: SHOGI_HC('ѹѳѯѭѣѭѯѳѹ', '1ѥ7'), t: null },
    { g: 'shogi', s: 'hc', n: 'Rook handicap', d: 'Black plays without the rook and moves first.', f: SHOGI_HC('ѹѳѯѭѣѭѯѳѹ', '7ѩ1'), t: null },
    { g: 'shogi', s: 'hc', n: 'Two-piece handicap', d: 'Black gives up rook and bishop.', f: SHOGI_HC('ѹѳѯѭѣѭѯѳѹ', '9'), t: null },
    { g: 'shogi', s: 'hc', n: 'Four-piece handicap', d: 'Rook, bishop and both lances.', f: SHOGI_HC('1ѳѯѭѣѭѯѳ1', '9'), t: null },
    { g: 'shogi', s: 'hc', n: 'Six-piece handicap', d: 'Rook, bishop, both lances and both knights.', f: SHOGI_HC('2ѯѭѣѭѯ2', '9'), t: null },
    { g: 'shogi', s: 'mini', n: 'Mini Shogi', d: 'Shogi on 5 by 5: one of each piece but knight and lance.', f: 'ѥѩѯѭѣ/4ѽ/5/Ѽ4/ѢѬѮѨѤ w - - 0 1', t: null }
  ];
  function presetItems(tab) {
    if (tab === 'shogi') return SHOGI_PRESETS;
    if (tab === 'handicap') return PRESETS.slice(1).map((p) => ({ n: p[0], d: 'Uneven on purpose: one side is ahead.', f: p[1], t: null }));
    if (tab === 'terrainOnly') return [{ n: 'No terrain', d: 'Takes every boulder, lake and gate off the board.', t: null, only: true }]
      .concat(BOARD_PRESETS.filter((p) => p.g === 'chess' && sizeOf(p) === '8x8').map((p) => ({ n: p.n, d: p.d, t: p.t, only: true })));
    let list = BOARD_PRESETS.filter((p) => p.g === tab);
    if (tab === 'chess') list = [{ g: 'chess', s: 'start', n: 'Starting position', d: 'The normal start, no terrain.', f: R.START_FEN, t: null }].concat(list);
    // by board size, then small armies, armies, big armies, corner starts, boss fights
    return list.map((p, i) => ({ p, i })).sort((a, b) => sizeRank(sizeOf(a.p)) - sizeRank(sizeOf(b.p)) || (SECTION_ORDER[a.p.s || 'terrain'] || 0) - (SECTION_ORDER[b.p.s || 'terrain'] || 0) || a.i - b.i).map((x) => x.p);
  }
  // The terrain a preset brings, unless the switch in the preset browser takes it away.
  const presetTerrain = (p) => (p.only || presetUi.terrain ? p.t : null);
  // fp: the army for the open board, where a preset needs one (its terrain blocks a line the plain board leaves open)
  const presetFen = (p) => (!presetTerrain(p) && p.fp ? p.fp : p.f);
  const PRESET_SECTIONS = { ck: '', hc: 'Handicaps', mini: 'Smaller boards', start: 'Start', terrain: 'Armies on terrain', small: 'Small armies', army: 'Armies', huge: 'Big armies', corner: 'Corner starts', boss: 'Boss fights' };
  const SECTION_ORDER = { ck: 0, hc: 1, mini: 2, start: 0, terrain: 1, small: 2, army: 3, huge: 4, corner: 5, boss: 6 };
  const sizeName = (k) => k.replace('x', ' by ');
  function renderPresets() {
    const tabs = $('#pmTabs'), grid = $('#pmGrid');
    tabs.innerHTML = '';
    PRESET_TABS.forEach((t) => {
      const b = h('button', 'pm-tab' + (presetUi.tab === t[0] ? ' on' : ''), t[1]);
      b.onclick = () => { presetUi.tab = t[0]; renderPresets(); };
      tabs.appendChild(b);
    });
    const sw = $('#pmTerrain');
    sw.className = 'sw' + (presetUi.terrain ? ' on' : '');
    sw.onclick = () => { presetUi.terrain = !presetUi.terrain; renderPresets(); };
    $('#pmTerrainBox').style.display = presetUi.tab === 'terrainOnly' || presetUi.tab === 'handicap' || presetUi.tab === 'checkers' || presetUi.tab === 'shogi' ? 'none' : '';
    $('#pmNote').textContent = presetUi.tab === 'checkers' ? 'Checkers set-ups on every board size: the classic start, inverted colours, whole rows, a crowned back row and kings only. Picking one switches the game to Checkers.'
      : presetUi.tab === 'shogi' ? 'Shogi set-ups for a normal game: the shogi pieces move as in Shogi and promote on the far rank. With Reinforcements on, what you take can be dropped back. The full game, with its hand and promotion zone, is under Game Modes.'
      : presetUi.tab === 'ouroboros' ? 'Armies and witches of The Ouroboros King on every board size, each balanced to an even start: the search rates it within half a pawn, with and without its terrain, and big armies of more than 40 pieces within four. Picking one switches on king capture, the rules of the game.'
      : presetUi.tab === 'fairy' ? 'Chancellors, archbishops, amazons, camels, nightriders and the other classic fairy pieces, on every board size. Each starts even: within half a pawn, big armies of more than 40 pieces within four.'
      : presetUi.tab === 'terrainOnly' ? 'Puts the terrain under the pieces already on the board. A boulder is left out where a piece stands.'
        : presetUi.tab === 'handicap' ? 'Positions in which one side is ahead on purpose: handicaps, studies and endgames.'
          : 'Classical armies on every board size, and the normal armies on terrain: boulders block, water stops a slider, gates send a piece to the other gate. Big armies of more than 40 pieces start within four pawns of even, the rest within half a pawn.';
    grid.innerHTML = '';
    // a row of board sizes to narrow the list down, where the tab has more than one
    const items = presetItems(presetUi.tab), sizes = [];
    items.forEach((p) => { if (!p.only) { const k = sizeOf(p); if (sizes.indexOf(k) < 0) sizes.push(k); } });
    const sz = $('#pmSizes');
    sz.innerHTML = '';
    if (sizes.indexOf(presetUi.size) < 0) presetUi.size = 'all';
    if (sizes.length > 1) [['all', 'All sizes']].concat(sizes.map((k) => [k, sizeName(k)])).forEach((x) => {
      const b = h('button', 'pm-size' + (presetUi.size === x[0] ? ' on' : ''), x[1]);
      b.onclick = () => { presetUi.size = x[0]; renderPresets(); };
      sz.appendChild(b);
    });
    let section = null;
    const perSize = {};
    items.forEach((p) => { if (!p.only) { const k = sizeOf(p); perSize[k] = (perSize[k] || 0) + 1; } });
    items.forEach((p) => {
      const size = p.only ? '8x8' : sizeOf(p), dims = fenDims(p.only ? null : p.f);
      if (presetUi.size !== 'all' && size !== presetUi.size) return;
      // sections: the board size, split by the kind of army only where a size has many presets
      const split = perSize[size] > 4, key = size + '|' + (split ? p.s || (p.only ? '' : 'terrain') : '');
      if (!p.only && key !== section) {
        section = key;
        const lab = split ? PRESET_SECTIONS[p.s || 'terrain'] || '' : '';
        grid.appendChild(h('div', 'pm-sec', sizes.length > 1 ? sizeName(size) + (lab ? ', ' + lab.toLowerCase() : '') : lab));
      }
      const terrain = toTerrain(presetTerrain(p), dims.W, dims.H);
      let board = ed.board.slice();
      if (!p.only) { try { board = R.fromFen(presetFen(p)).board; } catch (e) { return; } }
      const pt = presetTerrain(p), roy = /[ЭэЮю]/.test(p.f || '') ? '<span class="chip">Upgraded king</span>' : '';
      const men = board.filter(Boolean).length;
      const chips = (size !== '8x8' ? '<span class="chip">' + sizeName(size) + '</span>' : '') + (p.s === 'corner' ? '<span class="chip">Corner start</span>' : '') + (p.kc ? '<span class="chip">King capture</span>' : '') + roy + (men > 40 && !p.only ? '<span class="chip">' + men + ' pieces</span>' : '') +
        (pt && (pt.walls.length || pt.water.length || pt.portals.length || (pt.holes && pt.holes.length)) ? '<span class="chip">Terrain</span>' : '');
      const card = h('button', 'pm-card', boardThumb(board, terrain, p.only ? ed.W : dims.W, p.only ? ed.H : dims.H) + '<div class="pm-name">' + p.n + '</div>' + (p.d ? '<div class="pm-desc">' + p.d + '</div>' : '') + (chips ? '<div class="pm-chips">' + chips + '</div>' : ''));
      card.onclick = () => applyPreset(p);
      grid.appendChild(card);
    });
  }
  function applyPreset(p) {
    const dims = fenDims(p.only ? null : presetFen(p)), terrain = toTerrain(presetTerrain(p), dims.W, dims.H);
    if (p.only) {
      if (ed.W !== 8 || ed.H !== 8) { edResize(8, 8); toast('Terrain presets are made for the 8 by 8 board, so the board is 8 by 8 again'); }
      terrain.walls = terrain.walls.filter((q) => !ed.board[q]); // nothing stands on a boulder
      ed.terrain = terrain;
      edSync();
    } else {
      try { edLoad(presetFen(p)); } catch (e) { toast(e.message); return; }
      ed.terrain = terrain;
      setup.kcPreset = !!p.kc;
      if (p.kc) toast('King capture is on, as in The Ouroboros King');
      if (p.g === 'checkers' && !stdVariant(setup.variant) && !isCheckers(setup.variant)) { setup.variant = 'checkers'; toast('The game is Checkers now'); }
      edSync();
    }
    closePresets();
  }
  function openPresets() { $('#presetModal').classList.add('on'); renderPresets(); }
  function closePresets() { $('#presetModal').classList.remove('on'); }

  /* ---------- puzzles ----------
     Rated puzzles with a rating of their own, Puzzle Rush, a daily puzzle, practice by theme and
     statistics. The rules and numbers are in puzzles.js, the puzzles in puzzles/puzzles.json. */

  const PZ_KEY = 'powerchess_puzzles', PZCFG = { side: 'w' };
  // The rules a puzzle is played by: plain chess, or the power-up sets it came with ({ w, b }).
  const pzCfg = (item) => (item.pw ? { side: 'w', pw: item.pw, traits: item.traits || null } : PZCFG); // traits: a vest or a helmet on one piece
  let prof = Puzzles.load(localStorage.getItem(PZ_KEY));
  /* Power-up puzzles have a rated track of their own, beside the plain one: its own rating, streak and
     history (puzzles/power.json, made by tools/make_power_puzzles.js). */
  const PZP_KEY = 'powerchess_pzpower';
  let profP = Puzzles.load(localStorage.getItem(PZP_KEY));
  function pzSaveP() { try { localStorage.setItem(PZP_KEY, JSON.stringify(profP)); } catch (e) { /* private mode */ } }
  const profOf = (P) => (P && (P.kind === 'power' || P.from === 'power') ? profP : prof);
  const pzCounts = (P) => P.kind === 'rated' || P.kind === 'daily' || P.kind === 'power'; // a miss costs something
  function pzPowerReady() {
    if (!pz.powerLoading) pz.powerLoading = fetch('puzzles/power.json').then((r) => (r.ok ? r.json() : [])).then((list) => { pz.power = list; }, () => { pz.power = []; });
    return pz.powerLoading;
  }
  const pz = { view: 'rated', list: null, loading: null, err: '', cur: null, rush: null, custom: { themes: [], band: 'all', source: 'lichess' }, gen: null, genLoading: null, shown: {} };
  function pzSave() { try { localStorage.setItem(PZ_KEY, JSON.stringify(prof)); } catch (e) { /* private mode */ } }
  function pzReady() {
    if (!pz.loading) {
      pz.loading = fetch('puzzles/puzzles.json').then((r) => { if (!r.ok) throw new Error('missing'); return r.json(); })
        .then((list) => { pz.list = list; }, () => { pz.err = 'The puzzle file could not be loaded.'; });
    }
    return pz.loading;
  }
  function pzCanMove() {
    const P = pz.cur;
    return mode() === 'puzzle' && !!P && P.status === 'play' && !P.busy && !ui.overlay && P.state.turn === P.solver;
  }
  function pzEnter() {
    pzReady().then(() => {
      if (ui.tab !== 'puzzles') return;
      if (!pz.cur && pz.list && pz.view === 'rated') pzNextRated();
      else if (!pz.cur && pz.view === 'power') pzNextPower();
      else renderAll();
    });
    if (pz.cur) { ui.flipped = pz.cur.solver === 'b'; BW = 0; }
  }
  function pzLeave() {
    if (pz.rush && pz.rush.on) pzRushEnd();
    ui.flipped = G ? (G.local ? G.spec.flipEach && !G.over && live().turn === 'b' : G.cfg.side === 'b') : setup.mode === 'human' && setup.color === 'b';
    ui.hintArrow = null; ui.marks = [];
    BW = 0;
  }
  // Was the move that led to the puzzle a capture? The move counter of the position tells: captures and pawn moves reset it.
  function pzLeadCapture(item, s) {
    R.use(null); // puzzles are 8 x 8
    const from = R.sqIndex(item.last.slice(0, 2)), to = R.sqIndex(item.last.slice(2, 4)), p = s.board[to];
    const pawn = item.last.length > 4 || (!!p && p.toLowerCase() === 'p');
    return s.half === 0 && !(pawn && (from & 7) === (to & 7));
  }
  /* The position before the move that led to the puzzle, for showing only. Newer puzzles carry it (pre).
     For the others the move is taken back on the board, which works unless it was a capture: the file
     does not say what stood there. Then there is no position to show and null comes back. */
  function pzBefore(item, s) {
    if (!item.last) return null;
    if (item.pre) { try { return R.fromFen(item.pre, pzCfg(item)); } catch (e) { return null; } }
    if (pzLeadCapture(item, s)) return null;
    R.use(null);
    const from = R.sqIndex(item.last.slice(0, 2)), to = R.sqIndex(item.last.slice(2, 4)), p = s.board[to];
    if (!p) return null;
    const b = s.board.slice();
    b[to] = '';
    b[from] = item.last.length > 4 ? (R.colorOf(p) === 'w' ? 'P' : 'p') : p;
    if (p.toLowerCase() === 'k' && Math.abs((from & 7) - (to & 7)) === 2) {
      const row = to - (to & 7), short = (to & 7) === 6; // castling: the rook goes back into its corner
      b[row + (short ? 7 : 0)] = b[row + (short ? 5 : 3)];
      b[row + (short ? 5 : 3)] = '';
    }
    return Object.assign({}, s, { board: b, turn: R.other(s.turn), ep: -1 });
  }
  /* Put a puzzle on the board. kind: rated, rush, daily, custom or again (a replay that counts for nothing).
     It opens the way a game would reach it: the position before, then the other side's move with its
     sound, and only then it is the solver's turn and the clock starts. */
  // The position a puzzle starts from. The Lichess puzzles only carry the position before the lead-in move.
  function pzFen(item) {
    if (!item.fen) {
      const cfg = pzCfg(item), b = R.fromFen(item.pre, cfg), m = R.findUci(R.legalMoves(b, cfg), item.last);
      item.fen = R.toFen(m ? R.play(b, m, cfg) : b);
    }
    return item.fen;
  }
  function pzStart(item, kind, extra) {
    const cfg = pzCfg(item), s = R.fromFen(pzFen(item), cfg);
    const P = pz.cur = Object.assign({
      item: item, kind: kind, cfg: cfg, B: stdBackend(cfg, pzFen(item)), state: s, legal: R.legalMoves(s, cfg), solver: s.turn, idx: 0, status: 'play', clean: true, booked: false,
      hint: 0, t0: performance.now(), secs: 0, busy: false, mark: null, delta: null, msg: '', shown: null, back: null,
      last: item.last ? (R.use(null), [R.sqIndex(item.last.slice(0, 2)), R.sqIndex(item.last.slice(2, 4))]) : null
    }, extra || {});
    ui.flipped = s.turn === 'b';
    BW = 0;
    ui.sel = null; ui.hintArrow = null; ui.marks = []; ui.arrows = []; ui.mode = null;
    closeOverlay();
    if (!P.last) { renderAll(); return; }
    const before = pzBefore(item, s), from = P.last[0], to = P.last[1], p = s.board[to] || '';
    const capture = before ? !!before.board[to] || (item.pre ? !!item.lc : false) : true;
    const castle = p.toLowerCase() === 'k' && Math.abs((from & 7) - (to & 7)) === 2;
    const lead = () => {
      if (pz.cur !== P) return;
      P.shown = null; P.busy = false; P.t0 = performance.now();
      const anims = [{ from: from, to: to }];
      if (castle) anims.push((to & 7) === 6 ? { from: to + 1, to: to - 1 } : { from: to - 2, to: to + 1 });
      if (before && before.board[to]) anims.push({ ghost: before.board[to], at: to });
      snd(capture ? 'capture' : castle ? 'castle' : 'move');
      if (item.last.length > 4) snd('promo', 0.09);
      if (R.inCheck(s, s.turn, cfg)) snd('check', 0.07);
      renderAll(anims);
    };
    if (!before) { lead(); return; }
    P.shown = before; P.busy = true;
    renderAll();
    setTimeout(lead, kind === 'rush' ? 240 : 480);
  }
  // Make a move on the puzzle board, with the same sound and animation as in a game. Returns what to animate.
  function pzPlay(m) {
    const P = pz.cur, before = P.state, n = R.play(before, m, P.cfg), still = m.snipe || m.blast || (n.fx && n.fx.bounce >= 0), anims = still ? [] : [{ from: m.from, to: m.to }];
    if (m.castle === 'K') anims.push({ from: m.to + 1, to: m.to - 1 });
    if (m.castle === 'Q') anims.push({ from: m.to - 2, to: m.to + 1 });
    if (m.cap && before.board[m.capSq]) anims.push({ ghost: before.board[m.capSq], at: m.capSq });
    P.state = n; P.legal = R.legalMoves(n, P.cfg); P.last = [m.from, m.to];
    ui.sel = null; ui.hintArrow = null; ui.marks = []; ui.mode = null;
    if (m.snipe) fxTracer(m.from, m.to);
    if (n.fx && n.fx.bounce >= 0) fxRing(n.fx.bounce, 'orange');
    if (m.blast && n.fx) n.fx.removed.forEach((x) => fxRing(x.sq, 'boom'));
    moveSound(m, n.fx && (n.fx.bounce >= 0 || m.blast) ? n.fx : null, R.inCheck(n, n.turn, P.cfg) && R.status(n, P.cfg, P.legal).reason !== 'checkmate');
    return anims;
  }
  // A wrong move is shown on the board and then taken back. This takes it back (now, or when its moment is over).
  function pzBack(P, slide) {
    const k = P.back;
    if (!k) return;
    P.back = null;
    P.state = k.state; P.legal = k.legal; P.last = k.last; P.mark = null; P.busy = false;
    const m = k.m, anims = [{ from: m.to, to: m.from }];
    if (m.castle === 'K') anims.push({ from: m.to - 1, to: m.to + 1 });
    if (m.castle === 'Q') anims.push({ from: m.to + 1, to: m.to - 2 });
    if (pz.cur === P) renderAll(slide ? anims : undefined);
  }
  function pzSecs() { const P = pz.cur; return P.status === 'play' ? (performance.now() - P.t0) / 1000 : P.secs; }
  // Book the result of a rated or daily puzzle, once.
  function pzBook(won) {
    const P = pz.cur;
    if (P.booked) return;
    P.booked = true;
    P.secs = (performance.now() - P.t0) / 1000;
    if (P.kind === 'rated') { P.delta = Puzzles.record(prof, P.item, won, P.secs, Date.now()); pzSave(); }
    else if (P.kind === 'power') { P.delta = Puzzles.record(profP, P.item, won, P.secs, Date.now()); pzSaveP(); }
    else if (P.kind === 'daily') {
      if (!prof.daily[P.day]) prof.daily[P.day] = { ok: won ? 1 : 0, t: Math.round(P.secs) };
      pzSave();
    }
  }
  /* Solution steps. A plain puzzle writes its moves as UCI (e2e4). A power-up puzzle writes moves as the
     search's keys (n:12:28:) and free actions as f12 (freeze), g12 (gild), c12 (turncoat), t (time stop). */
  const pzIsFree = (step) => /^[gfch]\d+$|^t$/.test(step || '');
  function pzStepMove(lg, step) {
    if (!step || pzIsFree(step)) return null;
    R.use(null);
    return /^[a-h][1-8][a-h][1-8]/.test(step) ? R.findUci(lg, step) : lg.find((m) => moveKey(m) === step) || null;
  }
  const pzMoveIs = (m, step) => (/^[a-h][1-8][a-h][1-8]/.test(step) ? (R.use(null), R.uci(m) === step) : moveKey(m) === step);
  function pzApplyFree(s, step, cfg) {
    if (step === 't') return R.timeStop(s, cfg);
    const sq = +step.slice(1);
    return step[0] === 'g' ? R.gild(s, sq, cfg) : step[0] === 'f' ? R.freeze(s, sq, cfg) : step[0] === 'h' ? R.shield(s, sq, cfg) : R.convert(s, sq, cfg);
  }
  // A free action on the puzzle board: the state changes, the turn goes on.
  function pzPlayFree(step) {
    const P = pz.cur, n = pzApplyFree(P.state, step, P.cfg);
    if (!n) return false;
    P.state = n; P.legal = R.legalMoves(n, P.cfg);
    ui.sel = null; ui.hintArrow = null; ui.marks = []; ui.mode = null;
    snd(step[0] === 'g' ? 'gold' : step[0] === 'f' ? 'ice' : 'portal');
    if (step !== 't') fxRing(+step.slice(1), step[0] === 'g' ? 'orange' : 'blue');
    return true;
  }
  // The other side answers with everything the solution gives it, one step at a time, until it is the solver's turn.
  function pzReply(P, delay) {
    P.busy = true;
    const item = P.item;
    setTimeout(() => {
      if (pz.cur !== P || P.item !== item) return;
      const step = item.moves[P.idx];
      if (!step || P.state.turn === P.solver) { P.busy = false; P.mark = null; if (!step) pzSolved(); else renderAll(); return; }
      let an;
      if (pzIsFree(step)) { if (!pzPlayFree(step)) { P.busy = false; pzSolved(); return; } an = undefined; }
      else { const r = pzStepMove(P.legal, step); if (!r) { P.busy = false; pzSolved(); return; } an = pzPlay(r); }
      P.idx++;
      P.mark = null;
      renderAll(an);
      if (P.state.turn === P.solver || P.idx >= item.moves.length) { P.busy = false; if (P.idx >= item.moves.length && P.state.turn !== P.solver) pzSolved(); }
      else pzReply(P, 420);
    }, delay);
  }
  function pzWrong(P, keep, anims, sq) {
    P.clean = false;
    P.mark = { sq: sq, ok: false };
    snd('wrong', 0.12);
    if (P.kind === 'rush') { pzRushResult(false, anims); return; }
    if (pzCounts(P)) { pzBook(false); P.status = 'lost'; P.msg = 'Incorrect'; }
    else P.msg = 'Not the move. Try again.';
    if (keep) {
      // it stays for a moment with its mark, then goes back where it came from
      P.back = keep; P.busy = true;
      renderAll(anims);
      setTimeout(() => { if (P.back === keep) pzBack(P, true); }, 800);
    } else renderAll(anims);
  }
  function pzRightStep(P, anims, sq) {
    P.mark = { sq: sq, ok: true };
    P.idx++;
    P.msg = '';
    const mates = R.status(P.state, P.cfg, P.legal).reason === 'checkmate';
    if (mates || P.idx >= P.item.moves.length) { pzSolved(anims); return; }
    if (P.state.turn === P.solver) { renderAll(anims); return; } // a free action: the turn goes on
    renderAll(anims);
    pzReply(P, 420);
  }
  // The last step of a power-up puzzle may be answered with any action as good as the solution's (item.alt).
  const pzAlt = (P, key) => !!(P.item.alt && P.item.alt[P.idx] && P.item.alt[P.idx].indexOf(key) >= 0);
  function pzMove(m) {
    const P = pz.cur;
    if (!pzCanMove()) return;
    const want = P.item.moves[P.idx], keep = { state: P.state, legal: P.legal, last: P.last, m: m };
    const mates = R.status(R.play(P.state, m, P.cfg), P.cfg).reason === 'checkmate';
    const alt = pzAlt(P, moveKey(m)); // as good as the solution's move (the last step only)
    const anims = pzPlay(m); // right or wrong, the move is made on the board, with its sound
    if (!(pzMoveIs(m, want) || mates || alt)) { pzWrong(P, keep, anims, m.to); return; }
    if (alt && !pzMoveIs(m, want)) { P.sub = P.sub || {}; P.sub[P.idx] = moveKey(m); }
    pzRightStep(P, anims, m.to);
  }
  // A free action chosen on the puzzle board (freeze, gild, turncoat, time stop).
  function pzAct(step) {
    const P = pz.cur;
    if (!pzCanMove()) return;
    const want = P.item.moves[P.idx];
    if (step !== want && !pzAlt(P, step)) { ui.mode = null; pzWrong(P, null, undefined, step === 't' ? -1 : +step.slice(1)); return; }
    if (!pzPlayFree(step)) return;
    if (step !== want) { P.sub = P.sub || {}; P.sub[P.idx] = step; }
    pzRightStep(P, undefined, step === 't' ? -1 : +step.slice(1));
  }
  function pzSolved(anims) {
    const P = pz.cur;
    P.status = 'won';
    P.secs = P.secs || (performance.now() - P.t0) / 1000;
    snd('right', 0.15);
    if (P.kind === 'rush') { pzRushResult(true, anims); return; }
    if (pzCounts(P)) pzBook(P.clean);
    if (P.kind === 'mine' && P.clean && !P.item.solved) { P.item.solved = 1; saveMine(); }
    P.msg = P.clean ? 'Correct' : (P.hint ? 'Solved with a hint' : 'Solved');
    renderAll(anims);
    pzAfter(P);
  }

  /* After a puzzle (solved, or its solution shown): the play goes on for a moment, the other side's best answer and
     your reply to it, found by the power-up search and played on the board, and the idea behind the solution is put
     into words (Coach.idea). Not in Puzzle Rush, which is about speed. */
  function pzKit(P) {
    const names = {}, values = {};
    R.FAIRY_LETTERS.forEach((l) => { names[l] = R.FAIRY[l].name.toLowerCase(); values[l] = Math.round(R.FAIRY[l].value / 100); });
    return { B: P.B, std: true, R: R, cfg: P.cfg, names: names, values: values, name: (sq) => (R.use(null), R.sqName(sq)), label: (st, lg, act) => actLabel(P.B, st, lg, act) };
  }
  // a step of a puzzle line as an action ({ m } or a free action), in state s
  function pzActOf(P, s, key) {
    const lg = P.B.legal(s);
    if (pzIsFree(key)) return keyToAct(key, lg);
    const m = pzStepMove(lg, key);
    return m ? { m: m } : null;
  }
  // the power-up that makes this move possible at all (a dragon's leap, a rocket's run), by its name, or null
  function pzPowerOf(P, s, act) {
    if (!act.m || !P.cfg.pw) return null;
    const me = s.turn, mine = R.powersOf(P.cfg, me);
    const has = (cfg) => R.legalMoves(s, cfg).some((x) => moveKey(x) === moveKey(act.m));
    const pw0 = Object.assign({}, P.cfg.pw); pw0[me] = null;
    if (has(Object.assign({}, P.cfg, { pw: pw0 }))) return null;
    const names = powerNames(mine);
    if (names.length === 1) return names[0];
    for (const x of POWER_LIST) {
      if (!flagOn(mine, x.key)) continue;
      const one = {}; one[x.key] = mine[x.key];
      const pw1 = Object.assign({}, P.cfg.pw); pw1[me] = one;
      if (has(Object.assign({}, P.cfg, { pw: pw1 }))) return x.name;
    }
    return 'your power-ups';
  }
  async function pzAfter(P) {
    if (P.kind === 'rush' || P.after || pz.cur !== P) return;
    const after = P.after = { idea: null, follow: [], i: 0 };
    const cfgFor = (st) => (P.cfg.pw ? brainCfg(P.cfg, st.turn, true) : P.cfg);
    // the other side's best answer and your reply: one turn each, at most six actions
    let s = P.state, side = s.turn, turns = 2;
    while (after.follow.length < 6) {
      const lg = P.B.legal(s);
      if (P.B.status(s, lg).over) break;
      if (s.turn !== side) { side = s.turn; if (--turns === 0) break; } // a new turn: two of them, then it stops
      let res = null;
      try { res = await evalBrain.think(s, cfgFor(s), { ms: 450, margin: 0, allow: lg.map(moveKey), free: true }); } catch (e) { res = null; }
      if (pz.cur !== P || P.after !== after) return;
      const pick = res && res.actions && res.actions.map((a) => ({ key: a.key, act: keyToAct(a.key, lg) })).find((x) => x.act && (x.act.m || x.act.gild != null || x.act.freeze != null || x.act.shield != null || x.act.convert != null || x.act.stop));
      if (!pick) break;
      const n = pick.act.m ? P.B.play(s, pick.act.m) : pick.act.gild != null ? P.B.gild(s, pick.act.gild) : pick.act.freeze != null ? P.B.freeze(s, pick.act.freeze) : pick.act.shield != null ? P.B.shield(s, pick.act.shield) : pick.act.convert != null ? P.B.convert(s, pick.act.convert) : P.B.timeStop(s);
      if (!n) break;
      after.follow.push(pick.key);
      s = n;
    }
    // the idea, from the start of the puzzle: the solution as it was played, then the follow-up
    try {
      const start = R.fromFen(pzFen(P.item), P.cfg), keys = P.item.moves.slice(0, P.idx).map((k, i) => (P.sub && P.sub[i]) || k);
      const sol = [], fol = [];
      let st = start;
      for (const k of keys) { const a = pzActOf(P, st, k); if (!a) break; sol.push(a); st = a.m ? P.B.play(st, a.m) : a.gild != null ? P.B.gild(st, a.gild) : a.freeze != null ? P.B.freeze(st, a.freeze) : a.shield != null ? P.B.shield(st, a.shield) : a.convert != null ? P.B.convert(st, a.convert) : P.B.timeStop(st); }
      for (const k of after.follow) { const a = pzActOf(P, st, k); if (!a) break; fol.push(a); st = a.m ? P.B.play(st, a.m) : a.gild != null ? P.B.gild(st, a.gild) : a.freeze != null ? P.B.freeze(st, a.freeze) : a.shield != null ? P.B.shield(st, a.shield) : a.convert != null ? P.B.convert(st, a.convert) : P.B.timeStop(st); }
      const mine = P.cfg.pw ? R.powersOf(P.cfg, P.solver) : {};
      after.idea = Coach.idea(pzKit(P), { s: start, sol: sol, follow: fol, me: P.solver, double: (mine.double || 0) > 1, power: (state, act) => pzPowerOf(P, state, act) });
    } catch (e) { console.warn('puzzle idea', e); after.idea = []; }
    renderAll();
    // the follow-up on the board, one action at a time
    const next = () => {
      if (pz.cur !== P || P.after !== after || P.busy) return;
      const k = after.follow[after.i];
      if (!k) { renderAll(); return; }
      let an;
      if (pzIsFree(k)) { if (!pzPlayFree(k)) return; }
      else { const m = pzStepMove(P.legal, k); if (!m) return; an = pzPlay(m); }
      after.i++;
      renderAll(an);
      setTimeout(next, 900);
    };
    setTimeout(next, 1000);
  }
  // Hint: first the piece, then the move. A hint means the puzzle no longer counts as solved.
  function pzHint() {
    const P = pz.cur;
    if (!pzCanMove()) return;
    const step = P.item.moves[P.idx];
    P.clean = false;
    P.hint = Math.min(2, P.hint + 1);
    if (pzIsFree(step)) {
      P.msg = step === 't' ? 'Stop time here' : (step[0] === 'g' ? 'Midas Touch' : step[0] === 'f' ? 'Freeze Ray' : 'Turncoat') + (P.hint > 1 ? ' on ' + (R.use(null), R.sqName(+step.slice(1))) : ' is the way');
      ui.marks = P.hint > 1 && step !== 't' ? [+step.slice(1)] : [];
      renderAll();
      return;
    }
    const m = pzStepMove(P.legal, step);
    if (!m) return;
    ui.marks = [m.from];
    ui.hintArrow = P.hint > 1 ? { from: m.from, to: m.to, color: '#8fd13f' } : null;
    renderAll();
  }
  // Play the rest of the solution, step by step.
  function pzShow() {
    const P = pz.cur;
    if (!P) return;
    if (P.back) pzBack(P, false); // a wrong move that is still on the board goes back first
    if (P.busy) return;
    if (P.status === 'play') { P.clean = false; if (pzCounts(P)) pzBook(false); P.status = 'lost'; }
    P.msg = 'The solution';
    P.busy = true; P.mark = null;
    const step = () => {
      if (pz.cur !== P) return;
      const u = P.item.moves[P.idx];
      let an;
      if (!u) { P.busy = false; renderAll(); pzAfter(P); return; }
      if (pzIsFree(u)) { if (!pzPlayFree(u)) { P.busy = false; renderAll(); return; } }
      else { const m = pzStepMove(P.legal, u); if (!m) { P.busy = false; renderAll(); return; } an = pzPlay(m); }
      P.idx++;
      renderAll(an);
      setTimeout(step, 750);
    };
    // back to the point where the solution continues: wrong tries did not move anything, so the board is right
    setTimeout(step, 250);
  }
  function pzNextRated() {
    if (!pz.list) return;
    const P = pz.cur;
    if (P && P.kind === 'rated' && P.status === 'play' && !P.booked) pzBook(false); // skipped
    pzStart(Puzzles.next(pz.list, prof), 'rated');
  }
  function pzNextPower() {
    if (pz.powerNext) return; // asked twice while loading: one puzzle, and the open one is not booked twice
    pz.powerNext = true;
    pzPowerReady().then(() => {
      pz.powerNext = false;
      if (ui.tab !== 'puzzles' || pz.view !== 'power') return;
      if (!pz.power.length) { renderAll(); return; }
      const P = pz.cur;
      if (P && P.kind === 'power' && P.status === 'play' && !P.booked) pzBook(false); // skipped
      pzStart(Puzzles.next(pz.power, profP), 'power');
    });
  }
  function pzRetry() { const P = pz.cur; if (P) pzStart(P.item, 'again', { from: P.kind === 'again' ? P.from : P.kind, day: P.day }); }
  function pzDown(sq, e) {
    if (!pzCanMove()) return;
    const P = pz.cur, p = P.state.board[sq], own = !!p && R.colorOf(p) === P.solver;
    if (ui.mode === 'gild' || ui.mode === 'freeze' || ui.mode === 'convert') {
      const targets = ui.mode === 'gild' ? P.B.gildTargets(P.state, P.legal) : ui.mode === 'freeze' ? P.B.freezeTargets(P.state) : P.B.convertTargets(P.state);
      if (targets.indexOf(sq) >= 0) { pzAct(ui.mode[0] + sq); return; }
      ui.mode = null; renderAll();
      return;
    }
    if (ui.sel) {
      const cands = ui.sel.moves.filter((m) => m.to === sq);
      if (cands.length) { commit(cands); return; }
    }
    if (own) {
      const was = ui.sel && ui.sel.sq === sq;
      P.mark = null;
      select(sq);
      renderAll();
      startDrag(e, sq, was);
    } else if (ui.sel) { ui.sel = null; renderAll(); }
  }

  /* Puzzle Rush: as many as possible before the clock runs out or the third mistake. */
  function pzRushStart(modeKey) {
    pz.rush = { mode: modeKey, on: true, k: 0, score: 0, strikes: 0, used: {}, results: [], end: Puzzles.RUSH[modeKey].secs ? Date.now() + Puzzles.RUSH[modeKey].secs * 1000 : 0, best: false };
    snd('start');
    pzRushNext();
  }
  function pzRushNext() {
    const rs = pz.rush, item = Puzzles.rushNext(pz.list, rs.k, rs.used, prof);
    if (!item) { pzRushEnd(); return; }
    rs.used[item.id] = 1; rs.k++;
    pzStart(item, 'rush');
  }
  function pzRushResult(ok, anims) {
    const rs = pz.rush, P = pz.cur;
    if (!rs || !rs.on) return;
    rs.results.push({ id: P.item.id, ok: ok, r: Puzzles.ratingOf(P.item, prof) });
    if (ok) rs.score++; else rs.strikes++;
    P.status = ok ? 'won' : 'lost';
    P.busy = true;
    renderAll(anims);
    if (rs.strikes >= (Puzzles.RUSH[rs.mode].strikes || 3)) { setTimeout(() => { if (pz.rush === rs && rs.on) pzRushEnd(); }, 600); return; }
    setTimeout(() => { if (pz.rush === rs && rs.on) pzRushNext(); }, ok ? 320 : 700);
  }
  function pzRushEnd() {
    const rs = pz.rush;
    if (!rs || !rs.on) return;
    rs.on = false;
    if (rs.score > (prof.rush[rs.mode] || 0)) { prof.rush[rs.mode] = rs.score; rs.best = true; }
    prof.rushRuns.unshift({ m: rs.mode, s: rs.score, d: Date.now() });
    if (prof.rushRuns.length > 100) prof.rushRuns.length = 100;
    pzSave();
    if (pz.cur && pz.cur.kind === 'rush') { pz.cur.status = pz.cur.status === 'play' ? 'lost' : pz.cur.status; pz.cur.busy = false; }
    snd(rs.best ? 'win' : 'draw');
    renderAll();
  }
  setInterval(() => {
    if (ui.tab !== 'puzzles') return;
    const rs = pz.rush, el = $('#pzTime');
    if (rs && rs.on && rs.end && Date.now() >= rs.end) { pzRushEnd(); return; }
    if (!el) return;
    if (rs && rs.on && pz.view === 'rush') el.textContent = rs.end ? fmtClock(rs.end - Date.now()) : 'No clock';
    else if (pz.cur) { const t = Math.floor(pzSecs()); el.textContent = Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60); }
  }, 250);

  const themeNames = (item) => item.themes.map((t) => Puzzles.THEMES[t]).filter(Boolean);
  // The whole solution in notation, the solver's moves in bold.
  function pzLine(item) {
    const cfg = pzCfg(item);
    let s = R.fromFen(pzFen(item), cfg), out = '', solver = s.turn, lastTurn = null;
    for (let i = 0; i < item.moves.length; i++) {
      const step = item.moves[i], lg = R.legalMoves(s, cfg), m = pzStepMove(lg, step);
      let text, n;
      if (m) { n = R.play(s, m, cfg); text = R.san(s, m, cfg, lg, n); }
      else {
        n = pzApplyFree(s, step, cfg);
        if (!n) break;
        text = (step[0] === 'g' ? '\u2726' : step[0] === 'f' ? '\u2744' : step[0] === 'c' ? '\u21c4' : '\u29d6') + (step.length > 1 ? (R.use(null), R.sqName(+step.slice(1))) : '');
      }
      if (s.turn !== lastTurn) { out += (s.turn === 'w' ? s.full + '. ' : i === 0 ? s.full + '... ' : ''); lastTurn = s.turn; }
      out += (s.turn === solver ? '<b>' + text + '</b>' : text) + ' ';
      s = n;
    }
    return out.trim();
  }
  // The card for the puzzle on the board: whose move, the verdict, and what can be done now.
  function pzCard(opts) {
    const P = pz.cur;
    if (!P) return '';
    const done = P.status !== 'play', who = P.solver === 'w' ? 'White' : 'Black';
    const btn = (id, label, cls) => '<button class="btn ' + (cls || '') + '" id="' + id + '">' + label + '</button>';
    let html = '<div class="pz-card"><div class="pz-top"><span class="pz-turn"><i class="' + (P.solver === 'w' ? 'dotw' : 'dotb') + '"></i>' + who + ' to move</span><span class="pz-time" id="pzTime"></span></div>';
    const cls = P.status === 'won' && P.clean ? ' ok' : P.status === 'lost' || (P.msg && /Incorrect|Not the move/.test(P.msg)) ? ' bad' : '';
    html += '<div class="pz-msg' + cls + '">' + (P.msg || (P.busy ? '' : 'Find the best move')) +
      (P.delta != null ? '<b class="' + (P.delta >= 0 ? 'up' : 'down') + '">' + (P.delta >= 0 ? '+' : '') + P.delta + '</b>' : '') + '</div>';
    if (done || opts.open) html += '<div class="pz-meta">Puzzle rating <b>' + Puzzles.ratingOf(P.item, profOf(P)) + '</b>' + (done ? '<br>' + themeNames(P.item).join(', ') : '') + '</div>';
    if (done && !P.busy && P.kind !== 'rush') html += '<div class="pz-line">' + pzLine(P.item) + '</div>';
    if (done && P.kind !== 'rush' && P.after) {
      html += '<div class="pz-idea"><h4>The idea</h4>' + (P.after.idea ? P.after.idea.map((t) => '<p>' + t.replace(/</g, '&lt;') + '</p>').join('') : '<p class="dim">Looking at how it goes on</p>') + '</div>';
    }
    if (P.cfg.pw) {
      const mine = R.powersOf(P.cfg, P.solver), theirs = R.powersOf(P.cfg, R.other(P.solver));
      const T = P.cfg.traits;
      if (T && ((T.vests || []).length || (T.helmets || []).length)) {
        // a vest or a helmet put on single pieces: say which
        const b0 = R.fromFen(pzFen(P.item), P.cfg).board, nm = (q) => (R.fairyOf(b0[q]) ? R.fairyOf(b0[q]).name : { q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }[b0[q].toLowerCase()] || 'piece').toLowerCase();
        (T.vests || []).forEach((q) => { if (b0[q]) html += '<div class="pz-meta">The ' + nm(q) + ' on ' + (R.use(null), R.sqName(q)) + ' wears an explosive vest.</div>'; });
        (T.helmets || []).forEach((q) => { if (b0[q]) html += '<div class="pz-meta">The ' + nm(q) + ' on ' + (R.use(null), R.sqName(q)) + ' wears a spiked helmet.</div>'; });
      }
      if (powerNames(mine).length || powerNames(theirs).length || !T) html += '<div class="pz-meta">Your power-ups: <b>' + (powerNames(mine).join(', ') || 'none') + '</b>. The other side: <b>' + (powerNames(theirs).join(', ') || 'none') + '</b></div>';
      if (!done && pzCanMove()) {
        const st = P.state, acts = [];
        if (mine.midas && P.B.gildTargets(st, P.legal).length) acts.push(['pzGild', 'gild', ui.mode === 'gild' ? 'Cancel' : '\u2726 Midas Touch']);
        if (mine.freeze && P.B.freezeTargets(st).length) acts.push(['pzFreeze', 'freeze', ui.mode === 'freeze' ? 'Cancel' : '\u2744 Freeze Ray']);
        if (mine.turncoat && P.B.convertTargets(st).length) acts.push(['pzConvert', 'convert', ui.mode === 'convert' ? 'Cancel' : '\u21c4 Turncoat']);
        if (mine.timestop && P.B.stopReady(st)) acts.push(['pzStop', 'stop', '\u29d6 Time Stop']);
        if (ui.sel && ui.sel.blast) acts.push(['pzBlast', 'blast', '\u2738 Detonate']); // the selected piece wears a vest
        if (acts.length) html += '<div class="pz-actions">' + acts.map((a) => '<button class="btn' + (ui.mode === a[1] ? ' on' : '') + '" id="' + a[0] + '">' + a[2] + '</button>').join('') + '</div>' +
          (ui.mode ? '<div class="pz-meta">' + (ui.mode === 'gild' ? 'Midas Touch: click a glowing piece' : ui.mode === 'freeze' ? 'Freeze Ray: click the piece to freeze' : 'Turncoat: click the piece that should join you') + '</div>' : '');
      }
    }
    html += '<div class="pz-actions">';
    if (!done) html += btn('pzHint', P.hint ? 'Show the move' : 'Hint') + btn('pzSol', 'Solution') + (opts.next ? btn('pzNext', 'Skip') : '');
    else html += (opts.next ? btn('pzNext', 'Next puzzle', 'go') : '') + btn('pzRetry', 'Retry') + (P.idx < P.item.moves.length ? btn('pzSol', 'Solution') : '') + btn('pzAn', 'Analyse');
    html += '</div></div>';
    return html;
  }
  function pzWire(next) {
    const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
    on('pzHint', pzHint); on('pzSol', pzShow); on('pzRetry', pzRetry); on('pzNext', next);
    const modeBtn = (id, m) => on(id, () => { ui.mode = ui.mode === m ? null : m; ui.sel = null; renderAll(); });
    modeBtn('pzGild', 'gild'); modeBtn('pzFreeze', 'freeze'); modeBtn('pzConvert', 'convert');
    on('pzStop', () => pzAct('t'));
    on('pzBlast', () => { if (ui.sel && ui.sel.blast) blastAt(ui.sel.sq); });
    on('pzAn', () => { const fen = pzFen(pz.cur.item); analyseFresh(fen, true).then((ok) => { if (ok) setTab('analysis'); }); });
  }
  /* The rating curve: one point per rated puzzle, green when solved, red when missed, with a rating
     scale on the left, dates underneath, a line for the best rating, and the puzzle's own rating under
     the cursor. Drawn as SVG with real pixel coordinates, so the text keeps its shape. */
  function pzGraph(range) {
    const all = prof.history.slice().reverse(); // oldest first
    if (all.length < 2) return '<div class="pz-empty">Solve a few rated puzzles and the rating curve shows up here.</div>';
    const n = range === 'all' ? all.length : Math.min(all.length, range || 60), pts = all.slice(-n);
    const W = 640, H = 220, L = 44, Rm = 12, T = 14, B = 30, iw = W - L - Rm, ih = H - T - B;
    const vals = pts.map((x) => x.u);
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    const step = hi - lo <= 60 ? 10 : hi - lo <= 150 ? 25 : hi - lo <= 300 ? 50 : hi - lo <= 700 ? 100 : 200;
    lo = Math.floor((lo - 10) / step) * step; hi = Math.ceil((hi + 10) / step) * step;
    const X = (i) => L + (pts.length === 1 ? iw / 2 : i / (pts.length - 1) * iw), Y = (v) => T + ih - (v - lo) / (hi - lo) * ih;
    let g = '<svg class="pz-graph" viewBox="0 0 ' + W + ' ' + H + '" style="height:auto">';
    g += '<rect x="' + L + '" y="' + T + '" width="' + iw + '" height="' + ih + '" fill="#2b2927" rx="4"/>';
    for (let v = lo; v <= hi; v += step) {
      g += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="#413e3b" stroke-width="1"/>';
      g += '<text x="' + (L - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" fill="#9f9c99" font-size="11" text-anchor="end">' + v + '</text>';
    }
    // the best rating so far, as a thin dashed line
    g += '<line x1="' + L + '" x2="' + (L + iw) + '" y1="' + Y(Math.min(hi, prof.best)).toFixed(1) + '" y2="' + Y(Math.min(hi, prof.best)).toFixed(1) + '" stroke="#d4a62a" stroke-width="1" stroke-dasharray="4 4"/>';
    // the curve
    g += '<polyline points="' + pts.map((x, i) => X(i).toFixed(1) + ',' + Y(x.u).toFixed(1)).join(' ') + '" fill="none" stroke="#81b64c" stroke-width="2"/>';
    // the points, each with a tooltip
    pts.forEach((x, i) => {
      const d = new Date(x.d), when = d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
      g += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(x.u).toFixed(1) + '" r="' + (pts.length > 120 ? 2 : 3.2) + '" fill="' + (x.ok ? '#81b64c' : '#e04040') + '" stroke="#262421" stroke-width="1">' +
        '<title>' + (x.ok ? 'Solved' : 'Missed') + ' a ' + x.r + ' puzzle in ' + x.t + ' s: ' + (x.dl >= 0 ? '+' : '') + x.dl + ', rating ' + x.u + '\n' + when + '</title></circle>';
    });
    // dates underneath: first, middle, last
    const lab = (i) => { const d = new Date(pts[i].d); return d.getDate() + '.' + (d.getMonth() + 1) + '.'; };
    [0, Math.floor((pts.length - 1) / 2), pts.length - 1].forEach((i, k) => {
      if (pts.length < 3 && k === 1) return;
      g += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 12) + '" fill="#9f9c99" font-size="11" text-anchor="' + (k === 0 ? 'start' : k === 2 ? 'end' : 'middle') + '">' + lab(i) + '</text>';
    });
    g += '</svg>';
    const solved = pts.filter((x) => x.ok).length, net = pts.reduce((a, x) => a + x.dl, 0);
    g += '<div class="pz-axis"><span><i class="dot ok"></i>solved ' + solved + ' <i class="dot bad"></i>missed ' + (pts.length - solved) + ' <i class="dash"></i>best ' + prof.best + '</span>' +
      '<span>' + (net >= 0 ? '+' : '') + net + ' over these ' + pts.length + '</span></div>';
    g += '<div class="seg pz-range">' + [[20, 'Last 20'], [60, 'Last 60'], [200, 'Last 200'], ['all', 'All']].map((r) => '<button data-range="' + r[0] + '" class="' + (String(r[0]) === String(range || 60) ? 'on' : '') + '">' + r[1] + '</button>').join('') + '</div>';
    return g;
  }

  function renderPuzzles() {
    const body = $('#pzBody');
    seg($('#pzSeg'), [['rated', 'Rated'], ['power', 'Power'], ['rush', 'Rush'], ['daily', 'Daily'], ['custom', 'Practice'], ['mine', 'Mine'], ['stats', 'Stats']], pz.view, (v) => {
      if (v === pz.view) return;
      if (pz.rush && pz.rush.on) pzRushEnd();
      // a rated puzzle that is still open waits until you come back to it
      const cur = pz.cur;
      if (cur && (cur.kind === 'rated' || cur.kind === 'power') && cur.status === 'play') { cur.parkedAt = performance.now(); pz.parked = pz.parked || {}; pz.parked[cur.kind] = cur; }
      pz.cur = null; ui.sel = null; ui.hintArrow = null; ui.marks = [];
      ui.flipped = false; BW = 0; // the empty board between puzzles stands the usual way round
      pz.view = v;
      if (v === 'rated' || v === 'power') {
        const q = pz.parked && pz.parked[v];
        if (q) {
          pz.parked[v] = null;
          q.t0 += performance.now() - q.parkedAt;
          pz.cur = q; ui.flipped = q.solver === 'b'; BW = 0;
          renderAll();
        } else if (v === 'power') pzNextPower();
        else if (pz.list) pzNextRated();
        return;
      }
      renderAll();
    });
    if (pz.err) { body.innerHTML = '<div class="pz-empty">' + pz.err + '</div>'; return; }
    if (!pz.list) { body.innerHTML = '<div class="pz-empty">Loading the puzzles</div>'; return; }
    const P = pz.cur;
    let html = '';
    if (pz.view === 'rated') {
      html += '<div class="pz-rating"><div><small>Your puzzle rating</small><b>' + prof.rating + '</b></div><div><small>Streak</small><b>' + prof.streak + '</b></div><div><small>Best</small><b>' + prof.best + '</b></div></div>';
      html += pzCard({ next: true });
      html += '<p class="sub" style="margin-top:12px">A wrong move or a hint counts as a miss and costs rating. ' + pz.list.length + ' puzzles from real games, with ratings earned from thousands of solvers (Lichess puzzle database).</p>';
      body.innerHTML = html;
      pzWire(pzNextRated);
    } else if (pz.view === 'power') {
      html += '<div class="pz-rating"><div><small>Power-up puzzle rating</small><b>' + profP.rating + '</b></div><div><small>Streak</small><b>' + profP.streak + '</b></div><div><small>Best</small><b>' + profP.best + '</b></div></div>';
      if (!pz.power) html += '<div class="pz-empty">Loading the puzzles</div>';
      else if (!pz.power.length) html += '<div class="pz-empty">The power-up puzzles could not be loaded.</div>';
      else if (P && P.kind === 'power') html += pzCard({ next: true });
      if (pz.power) html += '<p class="sub" style="margin-top:12px">Every solution uses a power-up: a shot, a freeze, a gild, a leap, an explosion, a second move. A wrong move or a hint counts as a miss and costs rating. ' + pz.power.length + ' puzzles from games the power-up search played against itself.</p>';
      body.innerHTML = html;
      pzWire(pzNextPower);
      if (!P && (!pz.power || pz.power.length)) pzNextPower(); // an empty file: nothing to start, and no loop
    } else if (pz.view === 'rush') {
      const rs = pz.rush;
      if (rs && rs.on) {
        const lives = Puzzles.RUSH[rs.mode].strikes || 3, xs = [];
        for (let i = 0; i < lives; i++) xs.push('<i class="' + (i < rs.strikes ? 'x' : '') + '">✕</i>');
        html += '<div class="pz-rating"><div><small>Solved</small><b>' + rs.score + '</b></div><div><small>' + (lives === 1 ? 'One mistake ends it' : 'Mistakes') + '</small><b class="strikes">' + xs.join('') + '</b></div><div><small>Time</small><b id="pzTime"></b></div></div>';
        html += '<div class="pz-card"><div class="pz-top"><span class="pz-turn"><i class="' + (P.solver === 'w' ? 'dotw' : 'dotb') + '"></i>' + (P.solver === 'w' ? 'White' : 'Black') + ' to move</span><span>Puzzle ' + rs.k + '</span></div></div>';
        html += '<button class="btn" id="pzRushStop" style="width:100%;margin-top:10px">End the run</button>';
        body.innerHTML = html;
        $('#pzRushStop').onclick = pzRushEnd;
      } else {
        if (rs) {
          html += '<div class="pz-rating"><div><small>' + Puzzles.RUSH[rs.mode].name + '</small><b>' + rs.score + '</b></div><div><small>Best</small><b>' + (prof.rush[rs.mode] || 0) + '</b></div></div>' +
            (rs.best ? '<div class="pz-msg ok">A new best</div>' : '') + '<div class="pz-dots">' +
            rs.results.map((x, i) => '<button class="' + (x.ok ? 'ok' : 'bad') + '" data-i="' + i + '" title="Rated ' + x.r + '">' + (i + 1) + '</button>').join('') + '</div>';
          if (P && P.kind !== 'rush') html += pzCard({});
        }
        html += '<h3>Puzzle Rush</h3><p class="sub">The puzzles start easy and get harder. Three mistakes end a run, in Streak the first one does.</p>';
        ['3', '5', 's', 'k'].forEach((k) => { html += '<button class="pz-row" data-rush="' + k + '"><b>' + Puzzles.RUSH[k].name + '</b><span>Best ' + (prof.rush[k] || 0) + '</span></button>'; });
        // the best runs so far
        const runs = prof.rushRuns.slice().sort((a, b) => b.s - a.s || b.d - a.d).slice(0, 10);
        if (runs.length) {
          html += '<h3>Best runs</h3><table class="pz-table">' + runs.map((r, i) => {
            const d = new Date(r.d);
            return '<tr><td>' + (i + 1) + '. ' + (Puzzles.RUSH[r.m] ? Puzzles.RUSH[r.m].name : r.m) + '<small style="color:var(--dim)"> ' + d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear() + '</small></td><td>' + r.s + '</td></tr>';
          }).join('') + '</table>';
        }
        body.innerHTML = html;
        body.querySelectorAll('[data-rush]').forEach((b) => { b.onclick = () => pzRushStart(b.dataset.rush); });
        body.querySelectorAll('.pz-dots button').forEach((b) => { b.onclick = () => { const it = pz.list.find((x) => x.id === rs.results[+b.dataset.i].id); if (it) pzStart(it, 'again', { from: 'rush' }); }; });
        pzWire(null);
      }
    } else if (pz.view === 'daily') {
      const today = new Date(), key = Puzzles.dayKey(today), rec = prof.daily[key];
      html += '<div class="pz-rating"><div><small>Today</small><b>' + (rec ? (rec.ok ? 'Solved' : 'Missed') : 'Open') + '</b></div><div><small>Days in a row</small><b>' + Puzzles.dailyStreak(prof, today) + '</b></div></div>';
      if (P && (P.kind === 'daily' || (P.kind === 'again' && P.from === 'daily'))) html += pzCard({});
      html += '<h3>The last two weeks</h3><div class="pz-days">';
      for (let i = 0; i < 14; i++) {
        const d = new Date(today.getTime()); d.setDate(d.getDate() - i);
        const k = Puzzles.dayKey(d), r = prof.daily[k];
        html += '<button data-day="' + k + '" class="' + (r ? (r.ok ? 'ok' : 'bad') : '') + (P && P.day === k ? ' on' : '') + '"><b>' + d.getDate() + '.' + (d.getMonth() + 1) + '.</b><span>' + (r ? (r.ok ? 'solved' : 'missed') : i ? 'open' : 'today') + '</span></button>';
      }
      html += '</div>';
      body.innerHTML = html;
      body.querySelectorAll('[data-day]').forEach((b) => { b.onclick = () => { const k = b.dataset.day; pzStart(Puzzles.daily(pz.list, k), prof.daily[k] ? 'again' : 'daily', { day: k, from: 'daily' }); }; });
      pzWire(null);
      if (!P || !(P.kind === 'daily' || P.from === 'daily')) { pzStart(Puzzles.daily(pz.list, key), rec ? 'again' : 'daily', { day: key, from: 'daily' }); }
    } else if (pz.view === 'custom') {
      // the engine-made puzzles are a second source for practice only; they load on first use
      const extra = { engine: 'puzzles/generated.json', power: 'puzzles/power.json' };
      if (extra[pz.custom.source] && !pz[pz.custom.source]) {
        const src = pz.custom.source;
        if (!pz.loadingExtra) pz.loadingExtra = {};
        if (!pz.loadingExtra[src]) pz.loadingExtra[src] = fetch(extra[src]).then((r) => (r.ok ? r.json() : [])).then((list) => { pz[src] = list; if (ui.tab === 'puzzles') renderPuzzles(); }, () => { pz[src] = []; });
      }
      const source = extra[pz.custom.source] ? (pz[pz.custom.source] || []) : pz.list;
      const pool = Puzzles.filter(source, pz.custom.themes, pz.custom.band, prof);
      if (P && (P.kind === 'custom' || (P.kind === 'again' && P.from === 'custom'))) html += pzCard({ next: true, open: true });
      html += '<h3>Source</h3><div class="seg" id="pzSource"></div><h3>Rating</h3><div class="seg" id="pzBand"></div><h3>Themes</h3><div class="pz-chips">' +
        Puzzles.FILTERS.map((t) => '<button data-theme="' + t + '" class="' + (pz.custom.themes.indexOf(t) >= 0 ? 'on' : '') + '">' + Puzzles.THEMES[t] + '</button>').join('') + '</div>' +
        '<p class="sub" style="margin-top:10px">' + pool.length + (pool.length === 1 ? ' puzzle fits.' : ' puzzles fit.') + ' Practice puzzles do not change your rating, and a wrong move can simply be tried again.</p>' +
        '<button class="btn green sm" id="pzGo"' + (pool.length ? '' : ' disabled') + '>' + (P && P.kind === 'custom' ? 'Another one' : 'Start') + '</button>';
      body.innerHTML = html;
      const go = () => { if (pool.length) pzStart(pool[Math.floor(Math.random() * pool.length)], 'custom'); };
      seg($('#pzBand'), Puzzles.BANDS.map((b) => [b[0], b[1]]), pz.custom.band, (v) => { pz.custom.band = v; renderPuzzles(); });
      seg($('#pzSource'), [['lichess', 'From real games'], ['engine', 'Made by Stockfish'], ['power', 'With power-ups']], pz.custom.source, (v) => { pz.custom.source = v; renderPuzzles(); });
      body.querySelectorAll('[data-theme]').forEach((b) => { b.onclick = () => { const t = b.dataset.theme, at = pz.custom.themes.indexOf(t); if (at >= 0) pz.custom.themes.splice(at, 1); else pz.custom.themes.push(t); renderPuzzles(); }; });
      $('#pzGo').onclick = go;
      pzWire(go);
    } else if (pz.view === 'mine') {
      // puzzles taken from your own reviewed games
      if (P && (P.kind === 'mine' || (P.kind === 'again' && P.from === 'mine'))) {
        html += pzCard({ next: mine.some((x) => !x.solved && x !== P.item), open: true });
        const gm = P.item.game;
        if (gm) html += '<p class="sub">' + gm.white + ' against ' + gm.black + ', move ' + gm.move + '. You played ' + gm.played + '.</p>';
      }
      if (!mine.length) html += '<div class="pz-empty">Review a game of yours and every missed chance in it turns into a puzzle here.</div>';
      else {
        html += '<h3>' + mine.length + (mine.length === 1 ? ' puzzle' : ' puzzles') + ' from your games</h3><div class="pz-hist">' + mine.slice(0, 60).map((x, i) => {
          const d = new Date(x.game.date), gm = x.game;
          return '<button data-m="' + i + '" class="' + (x.solved ? 'ok' : '') + (P && P.item === x ? ' on' : '') + '"><b>' + x.rating + '</b><span>' + (gm.you === 'w' ? gm.black : gm.white) + ', move ' + gm.move + ', ' + d.getDate() + '.' + (d.getMonth() + 1) + '.' + '</span><em>' + (x.solved ? 'solved' : 'open') + '</em></button>';
        }).join('') + '</div><button class="btn" id="mineClear" style="width:100%;margin-top:12px">Delete these puzzles</button>';
      }
      body.innerHTML = html;
      body.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => pzStart(mine[+b.dataset.m], 'mine'); });
      const mc = $('#mineClear');
      if (mc) mc.onclick = () => { if (!confirm('Delete all puzzles from your games?')) return; mine = []; saveMine(); pz.cur = null; renderAll(); };
      pzWire(() => { const next = mine.find((x) => !x.solved && x !== (P && P.item)); if (next) pzStart(next, 'mine'); });
    } else {
      const st = Puzzles.stats(prof, pz.list);
      html += '<div class="pz-rating"><div><small>Rating</small><b>' + prof.rating + '</b></div><div><small>Highest</small><b>' + prof.best + '</b></div><div><small>Solved</small><b>' + prof.solved + '</b></div></div>' +
        (profP.history.length ? '<div class="pz-rating"><div><small>Power-up rating</small><b>' + profP.rating + '</b></div><div><small>Highest</small><b>' + profP.best + '</b></div><div><small>Solved</small><b>' + profP.solved + '</b></div></div>' : '') + pzGraph(pz.graphRange) +
        '<table class="pz-table"><tr><td>Attempts</td><td>' + st.total + '</td></tr><tr><td>Solved first try</td><td>' + (st.accuracy == null ? 'n/a' : st.accuracy + ' %') + '</td></tr>' +
        '<tr><td>Average time</td><td>' + (st.avg == null ? 'n/a' : st.avg + ' s') + '</td></tr><tr><td>Longest streak</td><td>' + prof.bestStreak + '</td></tr>' +
        '<tr><td>Rush, 3 minutes</td><td>' + (prof.rush['3'] || 0) + '</td></tr><tr><td>Rush, 5 minutes</td><td>' + (prof.rush['5'] || 0) + '</td></tr><tr><td>Rush, survival</td><td>' + (prof.rush.s || 0) + '</td></tr><tr><td>Streak</td><td>' + (prof.rush.k || 0) + '</td></tr>' +
        '<tr><td>Daily puzzles solved</td><td>' + Object.keys(prof.daily).filter((k) => prof.daily[k].ok).length + '</td></tr></table>';
      if (st.themes.length) html += '<h3>By theme</h3><table class="pz-table">' + st.themes.map((t) => '<tr><td>' + t.name + '</td><td>' + t.pct + ' % of ' + t.n + '</td></tr>').join('') + '</table>';
      if (P && P.kind === 'again' && P.from === 'stats') html += pzCard({});
      if (prof.history.length) html += '<h3>Recent puzzles</h3><div class="pz-hist">' + prof.history.slice(0, 40).map((x, i) =>
        '<button data-h="' + i + '" class="' + (x.ok ? 'ok' : 'bad') + '"><b>' + x.r + '</b><span>' + (x.ok ? 'solved' : 'missed') + ' in ' + x.t + ' s</span><em>' + (x.dl >= 0 ? '+' : '') + x.dl + '</em></button>').join('') + '</div>';
      html += '<button class="btn" id="pzReset" style="width:100%;margin-top:14px">Reset puzzle rating and statistics</button>';
      body.innerHTML = html;
      body.querySelectorAll('[data-h]').forEach((b) => { b.onclick = () => { const it = pz.list.find((x) => x.id === prof.history[+b.dataset.h].id); if (it) pzStart(it, 'again', { from: 'stats' }); }; });
      $('#pzReset').onclick = () => { if (!confirm('Reset your puzzle rating, history and records?')) return; prof = Puzzles.fresh(); profP = Puzzles.fresh(); pzSave(); pzSaveP(); renderAll(); };
      body.querySelectorAll('.pz-range button').forEach((b) => { b.onclick = () => { pz.graphRange = b.dataset.range === 'all' ? 'all' : +b.dataset.range; renderPuzzles(); }; });
      pzWire(null);
    }
  }

  /* ---------- wiring ---------- */

  // the phone's More sheet: copies of the four tabs that do not fit the bar
  MORE_TABS.forEach((t) => { const b = document.querySelector('#side > .nav[data-tab="' + t + '"]'); if (b) $('#moreSheet').appendChild(b.cloneNode(true)); });
  document.addEventListener('pointerdown', (e) => { if ($('#moreSheet').classList.contains('on') && !e.target.closest('#moreSheet, .nav.morebtn')) $('#moreSheet').classList.remove('on'); });
  document.querySelectorAll('.nav').forEach((b) => { b.onclick = () => setTab(b.dataset.tab); });
  $('#startBtn').onclick = startGame;
  $('#powersClear').onclick = () => {
    const pw = ui.pwSet === 'b' ? setup.powers2 : setup.powers; // the set on screen
    pw.double = 0;
    POWER_KEYS.forEach((k) => { pw[k] = false; });
    changed();
  };
  $('#cNew').onclick = () => setTab('new');
  $('#cUndo').onclick = undo;
  $('#cHint').onclick = hint;
  $('#cFlip').onclick = flip;
  $('#cResign').onclick = () => {
    if (!G || G.over) return;
    if (ranked() && !confirm(G.spec.gameMode.kind === 'dice' && Modes.tier(G.spec.gameMode.tier).cost ? 'Resign? The stake is lost.' : G.spec.gameMode.kind === 'run' ? 'Resign? That ends the run.' : 'Resign this game?')) return;
    finish(G.auto ? { over: true, result: 'draw', reason: 'stopped' } : { over: true, result: R.other(mySide()), reason: 'resignation' });
  };
  $('#cAnalyse').onclick = analyseGame;
  // game modes: the server's copy may be newer than the browser's (another browser, a cleared one)
  renderModesBadge();
  pullModes().then(() => { if (MS.pending) toast('An unfinished game is waiting under Game Modes'); });
  // analysis board
  ['First', 'Prev', 'Next', 'Last'].forEach((k) => { $('#an' + k).innerHTML = $('#nav' + k).innerHTML; });
  $('#anFirst').onclick = () => aGoto(A.root);
  $('#anPrev').onclick = () => aGoto(A.cur.parent);
  $('#anNext').onclick = () => aGoto(A.cur.children[0]);
  $('#anLast').onclick = () => aGoto(aMainEnd(A.cur));
  $('#anDelete').onclick = aDelete;
  $('#anPromote').onclick = aPromote;
  $('#anOn').onclick = () => { A.on = !A.on; runAnalysis(); };
  $('#anArrows').onclick = () => { A.arrows = !A.arrows; renderAnalysis(); renderArrows(); };
  $('#anFlip').onclick = flip;
  $('#anCopyFen').onclick = () => copy(A.B.fen(A.cur.state), 'FEN');
  $('#anCopyPgn').onclick = () => copy(aPgn(), 'PGN');
  $('#anNew').onclick = () => {
    if (A.searching) stopEngines();
    const old = A;
    A = null;
    release(old.B);
    ui.sel = null;
    renderAll();
  };
  $('#anPlay').onclick = () => {
    if (!A.std) return;
    if (!edApplyFen(A.B.fen(A.cur.state))) return;
    setup.variant = 'chess';
    changed();
    setTab('new');
    toast(ed.errs.length ? 'Position loaded, but it cannot be played: ' + ed.errs[0] : 'Position loaded. Pick an opponent and press Play');
  };
  $('#anFromGame').onclick = analyseGame;
  $('#anFromStart').onclick = () => analyseFresh(null);
  $('#anFromEditor').onclick = () => analyseFresh(setup.fen);
  $('#anLoad').onclick = () => analyseText($('#anText').value);
  $('#navFirst').onclick = () => gotoView(0);
  $('#navPrev').onclick = () => gotoView(G ? G.view - 1 : 0);
  $('#navNext').onclick = () => gotoView(G ? G.view + 1 : 0);
  $('#navLast').onclick = () => gotoView(G ? G.states.length - 1 : 0);
  $('#copyPgn').onclick = () => { if (G) copy(pgn(G), 'PGN'); };
  $('#copyFen').onclick = () => copy(G ? G.B.fen(G.states[G.view]) : setup.fen, 'FEN');
  $('#endClose').onclick = () => { G.endOpen = false; renderAll(); };
  // back to the end card of a finished game, from wherever it was closed
  function showResult() { if (!G || !G.over) return; G.endOpen = true; G.view = G.states.length - 1; if (rv) { rv.trial = null; rv.retry = null; } setTab('play'); renderAll(); }
  $('#anBack').onclick = showResult;
  $('#showEnd').onclick = showResult;
  $('#rvResult').onclick = showResult;
  $('#anReview').onclick = () => { if (rv && rv.game === G) setTab('review'); };
  $('#endRematch').onclick = () => (G && G.modeEnd ? modeRematch() : startGame());
  // a review of this game that is already done (or under way) is shown again, not started anew
  $('#endReview').onclick = () => { G.endOpen = false; setTab('review'); if (!(rv && rv.game === G)) startReview(); };
  $('#cReview').onclick = () => setTab('review');
  ['First', 'Prev', 'Next', 'Last'].forEach((k) => { $('#rv' + k).innerHTML = $('#nav' + k).innerHTML; });
  $('#rvFirst').onclick = () => gotoView(0);
  $('#rvPrev').onclick = () => gotoView(G ? G.view - 1 : 0);
  $('#rvNext').onclick = () => gotoView(G ? G.view + 1 : 0);
  $('#rvLast').onclick = () => gotoView(G ? G.states.length - 1 : 0);
  $('#rvKey').onclick = nextKey;
  // a move named in the review's words: show the position after it (again: back)
  $('#rvCoach').addEventListener('click', (e) => {
    const a = e.target.closest('.mvlink');
    if (!a || !rv || !rv.links) return;
    const i = +a.dataset.mv, hit = rv.links[i];
    if (!hit) return;
    rv.peek = rvPeek() && rv.peek.id === i ? null : { view: G.view, state: hit.n, m: hit.m, id: i };
    ui.sel = null;
    renderAll();
  });
  $('#rvSummary').onclick = () => { rv.status = 'summary'; rv.trial = null; rv.retry = null; renderAll(); };
  $('#endNew').onclick = () => { G.endOpen = false; setTab(G.modeEnd ? 'modes' : 'new'); };
  $('#edStart').onclick = () => { if (ed.W === 8 && ed.H === 8) edApplyFen(R.START_FEN); else edResize(ed.W, ed.H, true); };
  // on a phone the editor's sections fold (CSS), a tap on a heading opens or closes one
  document.querySelectorAll('#view-editor .edsec > h3').forEach((h3) => { h3.onclick = () => h3.parentElement.classList.toggle('open'); });
  $('#edClear').onclick = () => {
    // just the two kings, in the middle of their home ranks, on a board of the same size
    const w = ed.W, h = ed.H, k = Math.floor(w / 2);
    ed.board = new Array(w * h).fill(''); ed.board[k] = 'k'; ed.board[(h - 1) * w + k] = 'K';
    ed.terrain = { walls: [], water: [], portals: [], holes: [] }; ed.ghosts = []; ed.snipers = []; ed.helmets = []; ed.vests = []; ed.castling = '';
    setup.kcPreset = false;
    edSync();
  };
  const sizeIn = () => edResize(+$('#edW').value, +$('#edH').value);
  $('#edW').onchange = sizeIn; $('#edH').onchange = sizeIn;
  $('#edSizes').querySelectorAll('button').forEach((x) => { x.onclick = () => edResize(+x.dataset.w, +x.dataset.h, true); });
  $('#edFromGame').onclick = () => { if (G && G.B.kind === 'std') edApplyFen(R.toFen(G.states[G.view])); };
  $('#edPresetBtn').onclick = openPresets;
  $('#zoomIn').onclick = () => setZoom(ui.zoom * 1.5);
  $('#zoomOut').onclick = () => setZoom(ui.zoom / 1.5);
  $('#zoomFit').onclick = () => setZoom(1);
  $('#zoomStd').onclick = () => setZoom(zoomMax());
  // Ctrl or Cmd with the mouse wheel (or a pinch on a trackpad) zooms at the pointer; the plain wheel scrolls
  $('#boardview').addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey) || zoomMax() <= 1) return;
    e.preventDefault();
    setZoom(ui.zoom * Math.exp(-e.deltaY * 0.004), { x: e.clientX, y: e.clientY });
  }, { passive: false });
  $('#pmClose').onclick = closePresets;
  $('#presetModal').onclick = (e) => { if (e.target.id === 'presetModal') closePresets(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#presetModal').classList.contains('on')) closePresets(); });
  $('#edFen').addEventListener('change', (e) => { if (!edApplyFen(e.target.value)) e.target.value = setup.fen; });
  $('#edFen').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  window.addEventListener('resize', () => { if (ui.drag) { ui.drag = null; renderAll(); } });

  // custom variant lab
  const tpl = $('#customTpl'), iniBox = $('#customIni');
  tpl.appendChild(new Option('Start from a template', ''));
  Fairy.TEMPLATES.forEach((t, i) => tpl.appendChild(new Option(t.name, String(i))));
  iniBox.value = setup.customIni;
  tpl.onchange = () => {
    if (tpl.value === '') return;
    setup.customIni = iniBox.value = Fairy.TEMPLATES[+tpl.value].ini;
    tpl.value = '';
    loadCustom();
  };
  iniBox.addEventListener('input', () => {
    setup.customIni = iniBox.value;
    custom = null; customErr = '';
    save();
    renderVariants(); renderSummary();
  });
  $('#customLoad').onclick = loadCustom;

  enginePromise.then(() => { renderEngineBox(); renderSetup(); });

  buildSkins();
  try { edLoad(setup.fen); } catch (e) { setup.fen = R.START_FEN; edLoad(setup.fen); }
  if (setup.terrain && setup.terrain.walls) ed.terrain = JSON.parse(JSON.stringify(setup.terrain));
  if (!ed.terrain.holes) ed.terrain.holes = [];
  if (setup.traits) { ed.ghosts = (setup.traits.ghosts || []).slice(); ed.snipers = (setup.traits.snipers || []).slice(); ed.helmets = (setup.traits.helmets || []).slice(); ed.vests = (setup.traits.vests || []).slice(); }
  applySettings();
  revalidate();
  renderSetup(); renderVariants(); renderPowers(); renderSettings(); renderSummary(); renderAppBox();
  if (window.I18N) I18N.mount($('#langs'), () => changed()); // the flags: the page is translated where it stands
  try { history.replaceState({ pc: ui.tab }, ''); } catch (e) { /* no history */ }
  $('#backupFile').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f); e.target.value = ''; });
  // the browser offers to install the app: once, a quiet bar with the app's own button
  if (window.PWA) PWA.onInstallChange(() => {
    renderAppBox();
    let asked = false;
    try { asked = localStorage.getItem('powerchess_installask') === '1'; } catch (e) { /* private mode */ }
    if (asked || !PWA.canInstall() || !PWA.touch) return;
    const bar = h('div', '', '<span>Install Power Chess: on your home screen, full screen, offline.</span>');
    bar.id = 'installBar';
    const yes = h('button', 'btn green sm', 'Install'), no = h('button', 'btn sm', 'Not now');
    const done = () => { bar.remove(); try { localStorage.setItem('powerchess_installask', '1'); } catch (e) { /* private mode */ } };
    yes.onclick = () => { done(); PWA.install().then(renderAppBox); };
    no.onclick = done;
    bar.appendChild(yes); bar.appendChild(no);
    document.body.appendChild(bar);
  });
  setTab('new');
  { const t0 = new URLSearchParams(location.search).get('tab'); if (t0 && TITLES[t0] && t0 !== 'new') setTab(t0); } // the app icon's shortcuts (New game, Puzzles)
  if (setup.variant === 'custom') loadCustom();
  else if (!stdVariant(setup.variant)) Fairy.rules().catch(() => {});
  // the game from the last time the app was open; on the very first start, the welcome
  resumeLive().then((back) => { if (!back && !introDone() && !archive.length && !Object.keys(stats).length) setTimeout(showIntro, 300); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && G && !G.over) saveLive(); }); // the clocks as they stand

  // Debug handle for the console.
  window.PC = {
    get game() { return G; }, get modes() { return MS; }, saveModes: () => saveModes(), get custom() { return custom; }, ui: ui, setup: setup, settings: settings, engine: engine, rules: R,
    puzzle: (id) => pzPowerReady().then(() => { const it = (pz.power || []).concat(pz.list || []).find((x) => x.id === id); if (it) { setTab('puzzles'); pzStart(it, 'custom'); } return !!it; }), get pz() { return pz.cur; },
    makeBrain: makeBrain, brains: { bot: botBrain, eval: evalBrain }, importPgn: importPgnText, pgn: (g) => pgn(g || G), exportArchive: exportArchive, get mine() { return mine; }, get puzzles() { return pz; }, get puzzleProfile() { return prof; }, puzzleStart: (item, kind) => pzStart(item, kind || 'custom'), get review() { return rv; }, get skins() { return SKIN; }, get analysis() { return A; }, get archive() { return archive; }, openArchived: openArchived, analyseGame: analyseGame, analyseFresh: analyseFresh, analyseText: analyseText, aMove: (uci) => { const m = A.B.find(A.legal, uci); if (m) analysisMove(m); return !!m; }, aGoto: aGoto, startReview: startReview, start: startGame, canAct: canAct, canPremove: canPremove, refresh: changed, sk: () => skData(), pb: { data: () => pbData(), ui: pbUi, down: (sq) => pbDown(sq), end: () => pbEnd(), act: (k) => pbAct(k) }, renderModes: () => renderModes(), sanMap: (st) => sanMap(st),
    play: (m) => { if (canAct()) applyMove(m); }, gild: (sq) => { if (canAct()) doGild(sq); }, freeze: (sq) => { if (canAct()) doFreeze(sq); }, shield: (sq) => { if (canAct()) doShield(sq); }, convert: (sq) => { if (canAct()) doConvert(sq); },
    move: (uci) => {
      if (!G || !canAct()) return false;
      const m = G.B.find(G.legal, uci);
      if (m) applyMove(m);
      return !!m;
    }
  };
})();
