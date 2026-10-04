/* Pawnbarian (Jan Wojtecki, 2021) as a game mode: the logic without any page code, so it runs in node too
   (tools/tests/pawnbarian.js). Rules from the developer's "Niche Rule Compendium", his forum answers and patch
   notes, and the fan wiki. The texts are our own.

   A 5 x 5 board, the hero alone against monsters. The hero moves by playing cards: every card is a chess piece's move
   (a pawn, a knight ...). Three cards are drawn each turn and two of them can be played. Landing on a monster kills it;
   monsters have no hit points, only traits that make them immune or dodge. A round: the monsters move (left to right,
   top to bottom), which shows the squares they will attack; the hero plays; at the end of the turn every monster hits
   each of its squares for 1 damage (overlapping attacks add up), and Blight on the hero's square hurts once per stack.
   The hero has 4 hearts. Gold comes from the loot track above the board: it loses its rightmost reward after every
   turn the floor is not cleared, its leftmost one heals a heart. The shop after each floor sells upgrades for the
   cards of the deck (Cantrip, Shield, the Splashes, Purify) and Hearts; the deck itself never changes. Three dungeons
   of seven floors (champions on floors 3 and 5, a boss on floor 7), the Chains for difficulty, the Gauntlet after.

   Squares are r * 5 + c, r = 0 the top row (row 5 of the game), c = 0 file a. The hero starts on c1 (22). */
(function (root) {
  'use strict';
  var N = 5, SQ = 25, START = 22, STAIRS = 2;
  var rowOf = function (q) { return Math.floor(q / N); }, colOf = function (q) { return q % N; };
  var at = function (r, c) { return r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1; };
  function name(q) { return 'abcde'[colOf(q)] + (N - rowOf(q)); }
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
    st.shuffle = function (a) { for (var i = a.length - 1; i > 0; i--) { var j = st.int(i + 1), x = a[i]; a[i] = a[j]; a[j] = x; } return a; };
    return st;
  }

  /* ---------- the pieces the cards move like ---------- */
  var ORTH = [[-1, 0], [0, 1], [1, 0], [0, -1]], DIAG = [[-1, 1], [1, 1], [1, -1], [-1, -1]], ALL8 = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
  var KN = [[-2, -1], [-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2]];
  var PIECES = {
    P: { name: 'Pawn', text: 'Moves one square forward, or attacks one square diagonally forward' },
    N: { name: 'Knight', text: 'Jumps like a knight and attacks where it lands' },
    B: { name: 'Bishop', text: 'Moves and attacks any distance diagonally' },
    R: { name: 'Rook', text: 'Moves and attacks any distance straight' },
    Q: { name: 'Queen', text: 'Moves and attacks any distance straight or diagonally' },
    K: { name: 'King', text: 'Moves and attacks one square in any direction' },
    H: { name: 'Hawk', text: 'Jumps two or three squares straight or diagonally and attacks where it lands' },
    E: { name: 'Bear', text: 'Jumps to any square exactly two away and attacks where it lands' },
    G: { name: 'Ghost', text: 'Jumps to any empty square. It never attacks, except with a Splash' },
    // the Shogun's shogi pieces; forward is up the board
    sK: { name: 'King (Shogi)', text: 'Moves and attacks one square in any direction' },
    sG: { name: 'Gold General', text: 'One square straight, or one diagonally forward' },
    sS: { name: 'Silver General', text: 'One square diagonally, or one forward. Promotes to move like a Gold General', up: 'sG' },
    sN: { name: 'Shogi Knight', text: 'Jumps two forward and one to the side. Promotes to move like a Gold General', up: 'sG' },
    sL: { name: 'Lance', text: 'Any distance straight forward. Promotes to move like a Gold General', up: 'sG' },
    sP: { name: 'Shogi Pawn', text: 'One square forward. Promotes to move like a Gold General', up: 'sG' },
    sR: { name: 'Shogi Rook', text: 'Any distance straight. Promotes to a Dragon King: also one square diagonally', up: 'sD' },
    sB: { name: 'Shogi Bishop', text: 'Any distance diagonally. Promotes to a Dragon Horse: also one square straight', up: 'sH' },
    sD: { name: 'Dragon King', text: 'Any distance straight, or one square diagonally' },
    sH: { name: 'Dragon Horse', text: 'Any distance diagonally, or one square straight' }
  };
  // the squares a card's piece reaches from `from`: [{ to, hit }] (hit: there is a monster there to attack)
  function reach(F, piece, from, ghostOnly) {
    var out = [], r0 = rowOf(from), c0 = colOf(from), seen = {};
    var occ = function (q) { return enemyAt(F, q); };
    var add = function (q, canHit, canMove) {
      if (q < 0 || q === from || seen[q]) return;
      var e = occ(q);
      if (e) { if (canHit) { seen[q] = 1; out.push({ to: q, hit: e.id }); } }
      else if (canMove !== false) { seen[q] = 1; out.push({ to: q, hit: 0 }); }
    };
    var slide = function (dirs, max) {
      dirs.forEach(function (d) {
        for (var k = 1; k <= (max || 4); k++) {
          var q = at(r0 + d[0] * k, c0 + d[1] * k);
          if (q < 0) break;
          add(q, true);
          if (occ(q)) break;
        }
      });
    };
    var step = function (offs) { offs.forEach(function (d) { add(at(r0 + d[0], c0 + d[1]), true); }); };
    var FWD = [[-1, 0]], FDIAG = [[-1, -1], [-1, 1]];
    var gold = function () { step(ORTH.concat(FDIAG)); };
    switch (piece) {
      case 'P': FWD.forEach(function (d) { add(at(r0 + d[0], c0 + d[1]), false, true); }); FDIAG.forEach(function (d) { var q = at(r0 + d[0], c0 + d[1]); if (q >= 0 && occ(q)) add(q, true, false); }); break;
      case 'N': step(KN); break;
      case 'B': slide(DIAG); break;
      case 'R': slide(ORTH); break;
      case 'Q': slide(ALL8); break;
      case 'K': case 'sK': step(ALL8); break;
      case 'H': ALL8.forEach(function (d) { add(at(r0 + 2 * d[0], c0 + 2 * d[1]), true); add(at(r0 + 3 * d[0], c0 + 3 * d[1]), true); }); break;
      case 'E': for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) if (Math.max(Math.abs(dr), Math.abs(dc)) === 2) add(at(r0 + dr, c0 + dc), true); break;
      case 'G': for (var q = 0; q < SQ; q++) if (q !== from && !occ(q)) add(q, false); break;
      case 'sG': gold(); break;
      case 'sS': step(DIAG.concat(FWD)); break;
      case 'sN': step([[-2, -1], [-2, 1]]); break;
      case 'sL': slide(FWD); break;
      case 'sP': step(FWD); break;
      case 'sR': slide(ORTH); break;
      case 'sB': slide(DIAG); break;
      case 'sD': slide(ORTH); step(DIAG); break;
      case 'sH': slide(DIAG); step(ORTH); break;
    }
    return out;
  }

  /* ---------- the heroes ---------- */
  // a deck entry: [piece, count, upgrades for each of them ...]
  var HEROES = {
    pawnbarian: { name: 'Pawnbarian', text: 'A wandering warrior from the northern Chesslands who never turns down a fight.',
      ability: 'Promote a Pawn whenever you move into the top row, start your turn in the top row, or have 3 Pawns in hand. The rightmost Pawn in hand becomes a Queen, upgrades and all, until it is played or the floor ends.',
      deck: [['K', 1], ['R', 2], ['B', 2], ['N', 2], ['P', 5, ['shield'], ['shield', 'dsplash'], ['csplash'], ['cantrip'], ['cantrip']]], shop: ['Q', 'N'] },
    templar: { name: 'Knight Templar', text: 'A holy knight in heavy armour, patient and precise in battle.',
      ability: 'Playing a second Knight in a turn gives a Cantrip. Cannot buy Cantrips; can buy Purify.',
      deck: [['K', 2], ['R', 2], ['B', 2], ['N', 6, ['shield'], ['shield', 'dsplash'], ['csplash', 'purify']]], shop: ['Q', 'N'], noCantrip: true, purify: true },
    shogun: { name: 'Shogun', text: 'A warlord from a far-off land, fighting in a style nobody here has seen.',
      ability: 'The first card played each turn promotes the rightmost card in hand that can. Dragon Drop: an action that grows with every monster a card kills (1 charge each): a Shield and a promotion; from 1 charge a Diagonal Splash, from 2 a Cardinal Splash, from 3 a Cantrip, from 4 a Shield more per charge. It uses up the charges.',
      deck: [['sK', 1], ['sR', 1], ['sB', 1], ['sG', 2], ['sS', 2], ['sN', 1], ['sL', 1], ['sP', 3, ['cantrip'], ['cantrip'], ['csplash']]], shop: ['sD'], dragon: true },
    nomad: { name: 'Nomad', text: 'An archer of the open steppe, never far from her hawk.',
      ability: 'A card that lands on a monster shoots it instead: the monster is hit and she stays where she is.',
      deck: [['R', 3], ['B', 3], ['N', 2, ['dsplash'], ['dsplash']], ['H', 4, ['cantrip'], ['cantrip']]], shop: ['Q', 'N'], ranged: true },
    capyzerker: { name: 'Capyzerker', text: 'All muscle and appetite, and picky about neither.',
      ability: 'Every heart lost gives a Rage: while there is Rage, every card played gains a Cantrip and uses up one Rage. Rage is gone at the end of a floor. Every third gold of the loot track is a Blood Crystal that heals. Cannot buy Cantrips.',
      deck: [['K', 2], ['R', 2], ['B', 2], ['E', 6, ['dsplash'], ['dsplash'], ['csplash'], ['csplash']]], shop: ['Q', 'E'], noCantrip: true, rage: true },
    mystic: { name: 'Mystic', text: 'She wears no armour: the spirits around her keep the blows away.',
      ability: 'Her first move each turn leaves a Ward where she stood, for the floor. Monsters cannot move or appear on a Ward, it is like the edge of the board to them; stepping onto one uses it up for 3 Shields. Cannot buy Shields; can buy Purify.',
      deck: [['K', 3], ['B', 3], ['N', 2], ['G', 4, ['cantrip'], ['cantrip'], ['csplash'], ['purify']]], shop: ['Q', 'N'], noShield: true, purify: true, wards: true }
  };
  var HERO_IDS = Object.keys(HEROES);
  function makeDeck(hero) {
    var out = [], id = 1;
    HEROES[hero].deck.forEach(function (d) {
      for (var i = 0; i < d[1]; i++) {
        var up = {};
        (d[2 + i] || []).forEach(function (u) { up[u] = true; });
        out.push({ id: id++, p: d[0], up: up });
      }
    });
    return out;
  }

  /* ---------- the monsters ---------- */
  // atk: the squares it attacks around itself; traits as in the game
  var TRAITS = {
    artery: ['Blight Artery', 'When moving, spawns a Blightsack on the square it left.'],
    blast: ['Blight Blast', 'After death, Blights all adjacent squares.'],
    caller: ['Blight Caller', 'Spawns a Blightsack on an empty adjacent square whenever any other monster but a Blightsack dies.'],
    host: ['Blight Host', 'After death, spawns a Blightsack on each empty diagonally adjacent square.'],
    wake: ['Blight Wake', 'Moves twice. When moving, leaves Blight.'],
    brawler: ['Brawler', 'Immune while the hero is on a cardinally adjacent square.'],
    champion: ['Champion', 'Immune while any other monsters are alive.'],
    terror: ['Deep Terror', 'Spawns a Kraken Tentacle on an empty adjacent square the first time each turn a monster dies.'],
    soul: ['Golem Soul', 'After death, triggers all Spark traits.'],
    nimble: ['Nimble', 'Dodges the first attack each turn if able, moving one square in the attack\'s direction. Dies if it cannot.'],
    aegis: ['Spark Aegis', 'Gains Immune until next turn after a Cantrip.'],
    sblast: ['Spark Blight Blast', 'Blights all adjacent squares after a Cantrip.'],
    dominion: ['Spark Dominion', 'Spawns a Guard Golem or a Knight Golem on an empty adjacent square after a Cantrip.'],
    puppeteer: ['Spark Puppeteer', 'Spawns a Capybear Golem on an empty adjacent square after a Cantrip.'],
    surge: ['Spark Surge', 'Attacks its targeted squares after a Cantrip.'],
    swalk: ['Spark Walk', 'Moves after a Cantrip.'],
    vigilant: ['Vigilant', 'Immune while the hero is not on an adjacent square.'],
    grasp: ['Void Grasp', 'After death, moves the hero one square in the direction of the attack. If it cannot, or several trigger at once, deals 1 damage each instead.'],
    web: ['Webweaver', 'After death, the hero draws only 2 cards next turn.']
  };
  var ATTACKS = { adj: 'All adjacent squares', card: 'Cardinally adjacent squares', ring: 'The sides of the 5x5 square around it', far: 'Every square not next to it', line: 'Its whole row and column', notline: 'Every square not in its row or column', kraken: 'The 5x5 square around it without its corners', none: 'Nothing' };
  var MONSTERS = {
    capybear: { name: 'Capybear', atk: 'adj', traits: [], text: 'Big, round and grumpy.' },
    hcapybear: { name: 'Horned Capybear', atk: 'adj', traits: ['brawler'], text: 'Horns for the ones who come too close.' },
    bcapybear: { name: 'Blighted Capybear', atk: 'adj', traits: ['wake'], text: 'It ate something it should not have.' },
    spidertoad: { name: 'Spidertoad', atk: 'card', traits: ['web'], text: 'Eight legs and a sticky tongue.' },
    gblightbearer: { name: 'Goblin Blightbearer', atk: 'adj', traits: ['nimble', 'blast'], text: 'A goblin who let the Blight in, hoping it would make him strong.' },
    gskirmisher: { name: 'Goblin Skirmisher', atk: 'adj', traits: ['nimble'], text: 'Quick on its feet.' },
    garcher: { name: 'Goblin Archer', atk: 'ring', traits: ['nimble'], text: 'It shoots from a distance and runs.' },
    snakepaca: { name: 'Snakepaca', atk: 'ring', traits: ['vigilant'], text: 'Half snake, half alpaca, all suspicion.' },
    gwarrior: { name: 'Goblin Warrior', atk: 'adj', traits: ['brawler', 'nimble'], text: 'A goblin with a shield and a temper.' },
    gshaman: { name: 'Goblin Shaman', atk: 'far', traits: ['nimble'], text: 'Its curses reach every corner.' },
    blightvessel: { name: 'Goblin Blightvessel', atk: 'far', traits: ['champion', 'nimble', 'caller'], text: 'The oldest of the shamans. The Blight pours through him.', boss: true },
    blightsack: { name: 'Blightsack', atk: 'card', traits: ['blast'], text: 'A bag of Blight on little legs.' },
    capygolem: { name: 'Capybear Golem', atk: 'adj', traits: ['swalk'], text: 'Stone in the shape of a capybear.' },
    kgolem: { name: 'Knight Golem', atk: 'adj', traits: ['aegis', 'surge'], text: 'It wakes at every spark.' },
    ggolem: { name: 'Guard Golem', atk: 'adj', traits: ['brawler', 'aegis'], text: 'It does not budge for anyone close.' },
    coilgolem: { name: 'Coil Golem', atk: 'ring', traits: ['vigilant', 'surge'], text: 'Humming with stored lightning.' },
    spewer: { name: 'Spewer Golem', atk: 'adj', traits: ['wake', 'sblast'], text: 'It leaks Blight where it walks.' },
    sparkimp: { name: 'Spark Imp', atk: 'ring', traits: ['soul'], text: 'A spark that learned to run.' },
    gzapper: { name: 'Goblin Zapper', atk: 'line', traits: ['nimble', 'surge'], text: 'It found a battery and is not letting go.' },
    gtinkerer: { name: 'Goblin Tinkerer', atk: 'ring', traits: ['puppeteer', 'nimble'], text: 'It builds friends out of rubble.' },
    kinggolem: { name: 'King Golem', atk: 'notline', traits: ['champion', 'surge', 'dominion'], text: 'Made by the fortress itself, to rule its empty halls.', boss: true },
    voidimp: { name: 'Void Imp', atk: 'adj', traits: ['grasp'], text: 'It giggles. It never stops giggling.' },
    demongolem: { name: 'Demon Golem', atk: 'adj', traits: ['brawler', 'grasp', 'surge'], text: 'A golem with something else inside.' },
    gcultist: { name: 'Goblin Cultist', atk: 'adj', traits: ['nimble', 'grasp'], text: 'It prays to the Blightvoid.' },
    matron: { name: 'Blight Matron', atk: 'adj', traits: ['wake', 'host'], text: 'Mother of every Blightsack.' },
    blightimp: { name: 'Blight Imp', atk: 'ring', traits: ['blast', 'wake'], text: 'Small, fast and leaking.' },
    blightheart: { name: 'Blight Heart', atk: 'none', traits: ['artery'], text: 'It beats, and Blightsacks come out.' },
    kraken: { name: 'Blightvoid Kraken', atk: 'kraken', traits: ['champion', 'wake', 'terror'], text: 'The biggest thing that ever came through the rift.', boss: true },
    tentacle: { name: 'Kraken Tentacle', atk: 'adj', traits: ['wake', 'grasp'], text: 'There is always another one.' }
  };
  function hasT(e, t) { return e.traits.indexOf(t) >= 0; }

  /* ---------- the dungeons ---------- */
  var DUNGEONS = {
    goblin: { name: 'Goblin Caves', text: 'Damp tunnels under the Rook Ridge, full of goblins and beasts the Blight is slowly rotting.',
      pool: ['capybear', 'hcapybear', 'bcapybear', 'spidertoad', 'gblightbearer', 'gskirmisher', 'snakepaca'], later: ['garcher', 'gwarrior'], champs: { 3: 'garcher', 5: 'gshaman' }, boss: 'blightvessel', escort: ['blightsack', 'blightsack'] },
    golem: { name: 'Golem Fortress', text: 'An old mountain fortress whose stone guards still wake at every spark. There are warning signs at the gate.',
      pool: ['capygolem', 'kgolem', 'ggolem', 'coilgolem', 'spewer', 'gskirmisher'], later: ['sparkimp'], champs: { 3: 'gzapper', 5: 'gtinkerer' }, boss: 'kinggolem', escort: ['sparkimp', 'sparkimp', 'sparkimp'] },
    shrine: { name: 'Foul Shrine', text: 'A temple built around a rift to the Blightvoid. Things with too many eyes crawl out of it.',
      pool: ['capybear', 'bcapybear', 'spidertoad', 'voidimp', 'demongolem', 'gcultist', 'gblightbearer', 'blightsack', 'blightimp'], later: [], champs: { 3: 'matron', 5: 'blightheart' }, boss: 'kraken', escort: ['tentacle', 'tentacle'] },
    tutorial: { name: 'Tutorial Island', text: 'A quiet old manor to clear out first, to learn the moves before the real dungeons.', tutorial: true, floors: 2 }
  };
  var DUNGEON_IDS = ['goblin', 'golem', 'shrine', 'tutorial'];
  var CHAINS = ['No handicaps', 'Tougher floors', 'Leave Blight on each square you leave', 'Tougher floors', 'Upgrades cost 1 more', 'Tougher floors', 'Start with only two full Hearts', 'Tougher floors', 'The edge files start with Blight', 'Tougher floors', 'Final bosses deal double damage'];
  var FLOORS = 7;

  /* ---------- upgrades and the shop ---------- */
  var UPGRADES = {
    cantrip: { name: 'Cantrip', text: 'Gain an action and draw a card.', price: 10 },
    shield: { name: 'Shield', text: 'Absorb a point of damage this turn.', price: 6 },
    dsplash: { name: 'Diagonal Splash', text: 'Attack diagonally adjacent squares after moving.', price: 6 },
    csplash: { name: 'Cardinal Splash', text: 'Attack cardinally adjacent squares after moving.', price: 6 },
    purify: { name: 'Purify', text: 'Remove 3 Blight from the square you land on (after all monster traits).', price: 8 }
  };
  function allowed(hero) {
    var H = HEROES[hero], out = [];
    if (!H.noCantrip) out.push('cantrip');
    if (!H.noShield) out.push('shield');
    out.push('dsplash', 'csplash');
    if (H.purify) out.push('purify');
    return out;
  }

  /* ---------- a run ---------- */
  function fresh() { return { run: null, conquered: {}, chain: 0, runs: 0, won: 0 }; } // as in Modes.fresh().pb
  /* As in the original, only the Pawnbarian is there at first: one win with him (a dungeon, not Tutorial Island)
     opens the other five at once. */
  function unlocked(P, hero) {
    if (hero === 'pawnbarian') return true;
    return !!(P && P.conquered && P.conquered.pawnbarian && Object.keys(P.conquered.pawnbarian).length);
  }
  function newRun(P, seed, hero, dungeon, chain) {
    var D = DUNGEONS[dungeon];
    if (D.tutorial || !unlocked(P, hero)) hero = 'pawnbarian';
    if (D.tutorial) chain = 0;
    var run = { v: 1, seed: seed >>> 0, rng: seed >>> 0, hero: hero, dungeon: dungeon, chain: chain || 0, floor: 1, gauntlet: 0,
      hearts: chain >= 6 ? 2 : 4, maxHearts: 4, gold: 0, heartBuys: 0, deck: makeDeck(hero), F: null, shop: null, over: null, victory: false, dominion: 0 };
    P.run = run;
    P.runs++;
    startFloor(run);
    return run;
  }
  function floorsOf(run) { return DUNGEONS[run.dungeon].floors || FLOORS; }
  // how many monsters a floor sends, and its monsters
  function dealFloor(run, r) {
    var D = DUNGEONS[run.dungeon], f = run.floor, g = run.gauntlet, out = [];
    if (D.tutorial) return f === 1 ? ['capybear', 'capybear'] : ['matron'];
    var tough = [1, 3, 5, 7, 9].filter(function (c) { return run.chain >= c; }).length;
    var boss = g ? g % 3 === 0 : f === FLOORS, champ = g ? null : D.champs[f];
    // about 4 monsters on the first floor, 7 by the sixth, more in the Gauntlet; the odd Chains add one each
    var count = (g ? 6 + Math.min(4, Math.floor(g / 2)) : [0, 4, 4, 5, 5, 6, 7, 6][f]) + tough;
    var pool = D.pool.concat(f >= 2 || g ? D.later : []);
    if (boss) { out.push(D.boss); D.escort.forEach(function (x) { out.push(x); }); }
    else if (champ) out.push(champ);
    if (g && !boss && run.dungeon === 'golem') out.push('sparkimp', 'sparkimp', 'sparkimp'); // the Fortress's Gauntlet floors
    // the floor's own kind first (a goblin floor tends to be goblins), then the rest of the pool
    var seedKind = r.pick(pool);
    while (out.length < count) out.push(r.next() < 0.45 ? seedKind : r.pick(pool));
    return out.slice(0, 16);
  }
  function newEnemy(F, kind, sq, champion) {
    var M = MONSTERS[kind], e = { id: ++F.nextId, kind: kind, sq: sq, traits: M.traits.slice(), atk: M.atk, aegis: -1, dodged: -1, fresh: true };
    if (champion && e.traits.indexOf('champion') < 0) e.traits.unshift('champion');
    F.enemies.push(e);
    return e;
  }
  function startFloor(run) {
    var r = rng(run.rng), kinds = dealFloor(run, r), D = DUNGEONS[run.dungeon];
    var F = { enemies: [], nextId: 0, hero: START, blight: new Array(SQ).fill(0), wards: [], hand: [], draw: [], discard: [], actions: 0, shield: 0, turn: 0,
      rage: 0, charges: 0, webbed: false, played: 0, knights: 0, moved: false, terrorTurn: -1, log: [], over: null, loot: [] };
    if (run.chain >= 8) for (var rr = 0; rr < N; rr++) { F.blight[rr * N] = 1; F.blight[rr * N + 4] = 1; } // Chain VIII: the edge files
    // where they start: "almost entirely random" (the developer), next to the hero too; only his own square stays free
    var spots = [];
    for (var q = 0; q < SQ; q++) if (q !== START) spots.push(q);
    r.shuffle(spots);
    if (D.tutorial && run.floor === 2) spots = [2].concat(spots.filter(function (x) { return x !== 2; }));
    var bossKind = D.boss, champ = D.champs ? D.champs[run.floor] : null;
    // the Gauntlet: on a floor without the boss a random monster is the Champion
    var champAt = run.gauntlet && run.gauntlet % 3 !== 0 ? r.int(kinds.length) : -1;
    kinds.forEach(function (k, i) { if (spots[i] != null) newEnemy(F, k, spots[i], i === champAt); });
    /* the loot track: a heal, then the gold. The floor's difficulty sets its length: a guide's numbers (before 1.2.0)
       are 11 gold for 4 monsters cleared in 2 turns and 11 for 5 in 4 turns, so about 2 gold a monster on 12 for 4,
       one more for a Nimble one, and 1.2.0 added 1 to every floor */
    var nimble = F.enemies.filter(function (e) { return hasT(e, 'nimble'); }).length, n = F.enemies.length;
    var len = D.tutorial ? 4 : 5 + 2 * n + nimble + (champ ? 2 : 0) + (kinds.indexOf(bossKind) >= 0 ? 4 : 0);
    F.loot = ['heal'];
    for (var i = 1; i <= len; i++) F.loot.push(run.hero === 'capyzerker' && i % 3 === 0 ? 'blood' : 'gold');
    F.draw = r.shuffle(run.deck.map(function (c) { return { id: c.id, p: c.p, up: c.up, promo: null }; }));
    run.rng = r.s;
    run.F = F; run.shop = null;
    if (run.gauntlet) run.hearts = run.maxHearts; // the Gauntlet: a full heal before every floor
    newRound(run, true);
  }
  function enemyAt(F, q) { for (var i = 0; i < F.enemies.length; i++) if (F.enemies[i].sq === q) return F.enemies[i]; return null; }
  function wardAt(F, q) { return F.wards.indexOf(q) >= 0; }
  // the squares a monster attacks from where it stands
  function targets(e, sq) {
    var s0 = sq == null ? e.sq : sq, r0 = rowOf(s0), c0 = colOf(s0), out = [];
    for (var q = 0; q < SQ; q++) {
      if (q === s0) continue;
      var dr = Math.abs(rowOf(q) - r0), dc = Math.abs(colOf(q) - c0), ch = Math.max(dr, dc);
      var hit = e.atk === 'adj' ? ch === 1 : e.atk === 'card' ? dr + dc === 1 : e.atk === 'ring' ? ch === 2 : e.atk === 'far' ? ch > 1
        : e.atk === 'line' ? (dr === 0 || dc === 0) : e.atk === 'notline' ? (dr !== 0 && dc !== 0) : e.atk === 'kraken' ? ch <= 2 && !(dr === 2 && dc === 2) : false;
      if (hit) out.push(q);
    }
    return out;
  }
  // damage the hero would take at the end of the turn on square q (monsters' attacks and Blight)
  function threat(run, F, q) {
    var n = 0;
    F.enemies.forEach(function (e) { if (targets(e).indexOf(q) >= 0) n += isFinalBoss(run, e) ? 2 : 1; });
    return n;
  }
  function isFinalBoss(run, e) { return run.chain >= 10 && MONSTERS[e.kind].boss; }
  var dist2 = function (a, b) { var dr = rowOf(a) - rowOf(b), dc = colOf(a) - colOf(b); return dr * dr + dc * dc; };
  var edge = function (q) { return rowOf(q) === 0 || rowOf(q) === N - 1 || colOf(q) === 0 || colOf(q) === N - 1; };
  // one step of a monster: always moving if it can, keeping the hero in its attack range
  function moveEnemy(run, F, e) {
    var r0 = rowOf(e.sq), c0 = colOf(e.sq), cands = [];
    ALL8.forEach(function (d, k) { var q = at(r0 + d[0], c0 + d[1]); if (q >= 0 && q !== F.hero && !enemyAt(F, q) && !wardAt(F, q)) cands.push({ q: q, k: k }); });
    if (!cands.length) return false;
    var nimble = hasT(e, 'nimble');
    cands.forEach(function (c) {
      var inRange = targets(e, c.q).indexOf(F.hero) >= 0 ? 0 : 1;
      c.score = [inRange, nimble && edge(c.q) ? 1 : 0, dist2(c.q, F.hero), c.k];
    });
    cands.sort(function (a, b) { for (var i = 0; i < 4; i++) if (a.score[i] !== b.score[i]) return a.score[i] - b.score[i]; return 0; });
    var from = e.sq, to = cands[0].q;
    e.sq = to;
    if (hasT(e, 'wake')) F.blight[from]++;
    if (hasT(e, 'artery')) spawnAt(run, F, 'blightsack', from);
    return true;
  }
  // a new monster: on the given square, or on the empty square next to `near` furthest from the hero (ties clockwise from the top)
  function spawnAt(run, F, kind, sq) {
    if (sq < 0 || enemyAt(F, sq) || sq === F.hero || wardAt(F, sq)) return null;
    return newEnemy(F, kind, sq, false);
  }
  function spawnNear(run, F, kind, near) {
    var best = -1, bd = -1, r0 = rowOf(near), c0 = colOf(near);
    ALL8.forEach(function (d) { var q = at(r0 + d[0], c0 + d[1]); if (q >= 0 && q !== F.hero && !enemyAt(F, q) && !wardAt(F, q)) { var dd = dist2(q, F.hero); if (dd > bd) { bd = dd; best = q; } } });
    return best >= 0 ? newEnemy(F, kind, best, false) : null;
  }
  // a new round: the monsters move (left to right, top to bottom), then the hero draws
  function newRound(run, first) {
    var F = run.F;
    F.turn++;
    if (!first) { // a new floor: the monsters stand where they appeared, their attacks shown
      var order = F.enemies.slice().sort(function (a, b) { return a.sq - b.sq; });
      order.forEach(function (e) {
        if (F.enemies.indexOf(e) < 0) return;
        moveEnemy(run, F, e);
        if (hasT(e, 'wake')) moveEnemy(run, F, e);
      });
    }
    F.enemies.forEach(function (e) { e.fresh = false; });
    // the hero's turn: the hand is drawn fresh
    F.discard = F.discard.concat(F.hand.map(revert));
    F.hand = [];
    F.actions = 2; F.shield = 0; F.played = 0; F.knights = 0; F.moved = false;
    var n = F.webbed ? 2 : 3;
    F.webbed = false;
    for (var i = 0; i < n; i++) drawCard(run, F);
    if (run.hero === 'pawnbarian' && rowOf(F.hero) === 0) promote(run, F); // starting the turn on the top row
    pawnCheck(run, F);
  }
  function revert(c) { c.promo = null; return c; }
  function drawCard(run, F) {
    if (!F.draw.length) { var r = rng(run.rng); F.draw = r.shuffle(F.discard.map(revert)); F.discard = []; run.rng = r.s; }
    if (!F.draw.length) return null;
    var c = F.draw.shift();
    F.hand.push(c);
    return c;
  }
  // the piece a card moves like right now (a promoted card moves like its promotion)
  function pieceOf(c) { return c.promo || c.p; }
  // Pawnbarian: the rightmost Pawn in hand becomes a Queen; Shogun: the rightmost card that can promote does
  function promote(run, F) {
    for (var i = F.hand.length - 1; i >= 0; i--) {
      var c = F.hand[i];
      if (c.promo) continue;
      if (run.hero === 'pawnbarian' && c.p === 'P') { c.promo = 'Q'; return true; }
      if (run.hero === 'shogun' && PIECES[c.p].up) { c.promo = PIECES[c.p].up; return true; }
    }
    return false;
  }
  function pawnCheck(run, F) {
    if (run.hero !== 'pawnbarian') return;
    while (F.hand.filter(function (c) { return c.p === 'P' && !c.promo; }).length >= 3) if (!promote(run, F)) break;
  }

  /* ---------- the hero's actions ---------- */
  // Can the hero hit this monster right now? from: where the hero stands for this attack
  function immune(run, F, e, from) {
    if (hasT(e, 'champion') && F.enemies.some(function (o) { return o !== e; })) return true;
    var dr = Math.abs(rowOf(from) - rowOf(e.sq)), dc = Math.abs(colOf(from) - colOf(e.sq));
    if (hasT(e, 'brawler') && dr + dc === 1) return true;
    if (hasT(e, 'vigilant') && Math.max(dr, dc) !== 1) return true;
    if (e.aegis >= F.turn) return true;
    return false;
  }
  // the squares a card can be played to (an immune monster cannot be attacked)
  function cardTargets(run, F, c) {
    return reach(F, pieceOf(c), F.hero, false).filter(function (x) { if (!x.hit) return true; var e = enemyById(F, x.hit); return e && !immune(run, F, e, F.hero); });
  }
  function enemyById(F, id) { for (var i = 0; i < F.enemies.length; i++) if (F.enemies[i].id === id) return F.enemies[i]; return null; }
  var sign = function (x) { return x > 0 ? 1 : x < 0 ? -1 : 0; };
  /* An attack on one monster, the hero standing on `from`; dir: the attack's direction. A nimble one dodges the first
     attack of a turn one square on in that direction (dies when it cannot); the others die. Returns 'dead', 'dodged' or
     'immune'. The deaths are only noted here (F.dying): they are dealt with after the whole attack. */
  function hit(run, F, e, from, dir) {
    if (e.dying) return 'dead';
    if (immune(run, F, e, from)) return 'immune';
    if (hasT(e, 'nimble') && e.dodged !== F.turn) {
      e.dodged = F.turn;
      var q = at(rowOf(e.sq) + dir[0], colOf(e.sq) + dir[1]);
      if (q >= 0 && !enemyAt(F, q) && q !== F.hero && !wardAt(F, q)) { e.sq = q; return 'dodged'; }
    }
    // it stays on the board until the whole attack is over (a Champion stays immune, nothing moves into its square)
    e.dying = true;
    F.dying.push({ e: e, dir: dir });
    return 'dead';
  }
  // the splash squares around the landing square, from the one above, clockwise
  function splashSquares(land, d, c) {
    var out = [], r0 = rowOf(land), c0 = colOf(land);
    ALL8.forEach(function (o) {
      var diag = o[0] !== 0 && o[1] !== 0;
      if ((diag && d) || (!diag && c)) { var q = at(r0 + o[0], c0 + o[1]); if (q >= 0) out.push({ q: q, dir: o }); }
    });
    return out;
  }
  /* The deaths of an attack, in order: what the monsters do after death. The pulls of Void Grasp wait in F.grasps
     (they come after the Spark traits of a Cantrip). If the last monster died, nothing of it happens. Returns the kills. */
  function resolveDeaths(run, F) {
    var dying = F.dying || [];
    F.dying = [];
    if (!dying.length) return 0;
    F.enemies = F.enemies.filter(function (e) { return !e.dying; });
    if (!F.enemies.length) { F.grasps = []; return dying.length; }
    dying.forEach(function (d) {
      var e = d.e, sq = e.sq;
      if (hasT(e, 'blast')) ALL8.forEach(function (o) { var q = at(rowOf(sq) + o[0], colOf(sq) + o[1]); if (q >= 0) F.blight[q]++; });
      if (hasT(e, 'host')) DIAG.forEach(function (o) { spawnAt(run, F, 'blightsack', at(rowOf(sq) + o[0], colOf(sq) + o[1])); });
      if (hasT(e, 'web')) F.webbed = true;
      if (hasT(e, 'grasp')) F.grasps.push(d.dir);
      if (e.kind !== 'blightsack') F.enemies.forEach(function (o) { if (hasT(o, 'caller')) spawnNear(run, F, 'blightsack', o.sq); });
      if (F.terrorTurn !== F.turn) { var kr = F.enemies.filter(function (o) { return hasT(o, 'terror'); }); if (kr.length) { F.terrorTurn = F.turn; kr.forEach(function (o) { spawnNear(run, F, 'tentacle', o.sq); }); } }
      if (hasT(e, 'soul')) spark(run, F);
    });
    return dying.length;
  }
  // Void Grasp: pulled one square on in the attack's direction; if it cannot, or several pull at once, 1 damage each
  function grasp(run, F) {
    var g = F.grasps || [];
    F.grasps = [];
    if (!g.length || !F.enemies.length || F.over) return null;
    var q = g.length === 1 ? at(rowOf(F.hero) + g[0][0], colOf(F.hero) + g[0][1]) : -1;
    if (q >= 0 && !enemyAt(F, q)) {
      F.hero = q;
      var wi = F.wards.indexOf(q);
      if (wi >= 0) { F.wards.splice(wi, 1); F.shield += 3; }
      if (run.hero === 'pawnbarian' && rowOf(q) === 0) promote(run, F);
      return { e: 'grasp', sq: q };
    }
    damage(run, F, g.length);
    return { e: 'grasp', hurt: g.length };
  }
  // damage to the hero, the shields first; the Capyzerker's Rage from what gets through
  function damage(run, F, n) {
    var through = Math.max(0, n - F.shield);
    F.shield = Math.max(0, F.shield - n);
    if (!through) return 0;
    if (DUNGEONS[run.dungeon].tutorial) return 0; // nobody dies on Tutorial Island
    run.hearts -= through;
    if (run.hero === 'capyzerker') F.rage += through;
    if (run.hearts <= 0) { run.hearts = 0; F.over = 'dead'; run.over = { won: false, floor: run.floor, gauntlet: run.gauntlet }; }
    return through;
  }
  // after a Cantrip: every monster's Spark traits
  function spark(run, F) {
    F.enemies.slice().forEach(function (e) {
      if (F.enemies.indexOf(e) < 0 || F.over) return;
      if (hasT(e, 'aegis')) e.aegis = F.turn;
      if (hasT(e, 'surge') && targets(e).indexOf(F.hero) >= 0) damage(run, F, isFinalBoss(run, e) ? 2 : 1);
      if (hasT(e, 'swalk')) moveEnemy(run, F, e);
      if (hasT(e, 'sblast')) ALL8.forEach(function (o) { var q = at(rowOf(e.sq) + o[0], colOf(e.sq) + o[1]); if (q >= 0) F.blight[q]++; });
      if (hasT(e, 'dominion')) { spawnNear(run, F, run.dominion % 2 ? 'kgolem' : 'ggolem', e.sq); run.dominion++; }
      if (hasT(e, 'puppeteer')) spawnNear(run, F, 'capygolem', e.sq);
    });
  }
  function cantrip(run, F) {
    F.actions++;
    var c = drawCard(run, F);
    if (c && c.p === 'P' && run.hero === 'pawnbarian' && rowOf(F.hero) === 0) promote(run, F); // drawn while still on the top row
    pawnCheck(run, F); spark(run, F);
  }
  /* Playing card i of the hand to square `to`. Returns an event list for the page, or null if it cannot be played. */
  function play(run, i, to) {
    var F = run.F;
    if (!F || F.over || F.actions <= 0) return null;
    var c = F.hand[i];
    if (!c) return null;
    var opt = cardTargets(run, F, c).find(function (x) { return x.to === to; });
    if (!opt) return null;
    var H = HEROES[run.hero], ev = [], from = F.hero, piece = pieceOf(c);
    F.actions--;
    F.hand.splice(i, 1);
    F.discard.push(revert(c));
    F.played++;
    if (piece === 'N' || c.p === 'N') F.knights++;
    if (run.hero === 'shogun' && F.played === 1) promote(run, F); // the first card of the turn promotes another
    F.dying = []; F.grasps = [];
    var land = to, kills = 0;
    var dir = [sign(rowOf(to) - rowOf(from)), sign(colOf(to) - colOf(from))];
    if (opt.hit) {
      var tgt = enemyById(F, opt.hit), res = hit(run, F, tgt, from, dir);
      ev.push({ e: 'hit', sq: to, res: res, kind: tgt.kind, id: tgt.id });
      if (H.ranged) land = from; // the Nomad shoots and stays
    }
    if (land !== from) {
      if (H.wards && !F.moved) F.wards.push(from); // the Mystic's first move leaves a Ward
      if (run.chain >= 2) F.blight[from]++;        // Chain II: Blight on the square left
      F.hero = land;
      F.moved = true;
      var wi = F.wards.indexOf(land);
      if (wi >= 0 && H.wards) { F.wards.splice(wi, 1); F.shield += 3; ev.push({ e: 'ward', sq: land }); }
    }
    // the splashes, around the attack's centre (where the card landed)
    var centre = to;
    splashSquares(centre, c.up.dsplash, c.up.csplash).forEach(function (x) {
      var e = enemyAt(F, x.q);
      if (e && !e.dying) { var r2 = hit(run, F, e, centre, x.dir); ev.push({ e: 'splash', sq: x.q, res: r2, kind: e.kind, id: e.id }); }
      else ev.push({ e: 'splash', sq: x.q, res: 'miss' });
    });
    kills = resolveDeaths(run, F);
    if (H.dragon) F.charges += kills;
    if (c.up.shield) F.shield++;
    if (run.hero === 'pawnbarian' && land !== from && rowOf(F.hero) === 0) promote(run, F); // into the top row
    if (!F.enemies.length) { clearFloor(run, ev); return ev; }
    // Cantrips: the card's own, the Knight Templar's second Knight, the Capyzerker's Rage
    var cant = !!c.up.cantrip;
    if (run.hero === 'templar' && F.knights === 2 && (piece === 'N' || c.p === 'N')) cant = true;
    if (run.hero === 'capyzerker' && F.rage > 0) { F.rage--; cant = true; }
    if (cant) { cantrip(run, F); ev.push({ e: 'cantrip' }); }
    var gr = grasp(run, F);
    if (gr) ev.push(gr);
    if (c.up.purify) F.blight[F.hero] = Math.max(0, F.blight[F.hero] - 3); // after all the monsters' traits, the pull too
    pawnCheck(run, F);
    if (F.over) return ev;
    if (!F.enemies.length) { clearFloor(run, ev); return ev; }
    return ev;
  }
  // The Shogun's Dragon Drop: an action, its effects stacking with the charges, which it uses up
  function dragonDrop(run) {
    var F = run.F;
    if (!F || F.over || F.actions <= 0 || !HEROES[run.hero].dragon) return null;
    var n = F.charges, ev = [{ e: 'dragon', n: n }];
    F.actions--;
    F.charges = 0;
    F.shield++;
    promote(run, F);
    F.dying = []; F.grasps = [];
    splashSquares(F.hero, n >= 1, n >= 2).forEach(function (x) { var e = enemyAt(F, x.q); if (e && !e.dying) ev.push({ e: 'splash', sq: x.q, res: hit(run, F, e, F.hero, x.dir), kind: e.kind, id: e.id }); else ev.push({ e: 'splash', sq: x.q, res: 'miss' }); });
    resolveDeaths(run, F);
    if (n >= 4) F.shield += n - 3;
    if (!F.enemies.length) { clearFloor(run, ev); return ev; }
    if (n >= 3) { F.actions++; if (F.hand.length < 3) drawCard(run, F); spark(run, F); ev.push({ e: 'cantrip' }); }
    var gr = grasp(run, F);
    if (gr) ev.push(gr);
    if (!F.over && !F.enemies.length) clearFloor(run, ev);
    return ev;
  }
  /* The end of the hero's turn: the monsters attack, Blight on the hero's square hurts, the loot track loses its last
     reward, and the next round begins. */
  function endTurn(run) {
    var F = run.F;
    if (!F || F.over) return null;
    var hits = threat(run, F, F.hero), bl = F.blight[F.hero], took = damage(run, F, hits + bl);
    var ev = [{ e: 'attack', hits: hits, blight: bl, took: took }];
    if (F.over) return ev;
    if (F.loot.length) F.loot.pop();
    newRound(run, false);
    return ev;
  }
  function clearFloor(run, ev) {
    var F = run.F;
    F.over = 'cleared';
    var gold = F.loot.filter(function (x) { return x === 'gold'; }).length, heal = F.loot.filter(function (x) { return x === 'heal' || x === 'blood'; }).length;
    run.gold += gold;
    run.hearts = Math.min(run.maxHearts, run.hearts + heal);
    if (run.gauntlet) run.hearts = run.maxHearts; // the Gauntlet: a full heal after every floor
    ev.push({ e: 'cleared', gold: gold, heal: heal });
    F.cleared = { gold: gold, heal: heal };
  }
  // On from a cleared floor: the shop after floors 1 to 6, the victory after the last, the next Gauntlet floor
  function next(P) {
    var run = P.run;
    if (!run || !run.F || run.F.over !== 'cleared') return false;
    if (run.gauntlet) { run.gauntlet++; startFloor(run); return true; }
    if (run.floor >= floorsOf(run)) { win(P); return true; }
    openShop(run);
    return true;
  }
  function win(P) {
    var run = P.run;
    run.victory = true; run.F = null;
    if (!DUNGEONS[run.dungeon].tutorial) {
      var C = P.conquered[run.hero] = P.conquered[run.hero] || {};
      C[run.dungeon] = Math.max(C[run.dungeon] == null ? -1 : C[run.dungeon], run.chain);
      P.won++;
      // the next Chain opens once all three dungeons are cleared on the current one, by any heroes
      var ok = ['goblin', 'golem', 'shrine'].every(function (d) { return HERO_IDS.some(function (h) { return P.conquered[h] && P.conquered[h][d] >= P.chain; }); });
      if (ok && P.chain < 10) P.chain++;
    }
  }
  // After the victory: rest (the run ends) or the Gauntlet (endless floors, a boss every third, no shops)
  function gauntlet(P) { var run = P.run; if (!run || !run.victory) return false; run.victory = false; run.gauntlet = 1; startFloor(run); return true; }
  function rest(P) { var run = P.run; if (!run) return false; run.over = { won: true, floor: run.floor, gauntlet: run.gauntlet }; return true; }
  function giveUp(P) { var run = P.run; if (!run) return false; run.over = { won: false, floor: run.floor, gauntlet: run.gauntlet, gaveUp: true }; return true; }
  function close(P) { P.run = null; }

  /* The shop: a board of its own. The hero moves with a Queen and a Knight (the Capyzerker a Queen and a Bear, the
     Shogun a Dragon King) as often as he likes; landing on an item buys it, the stairs on c5 lead to the next floor.
     Five cards of the deck with an upgrade each (four before 1.1.0), and a Heart. */
  var SHOP_SPOTS = [10, 6, 12, 8, 14, 17];
  function openShop(run) {
    var r = rng(run.rng), ok = allowed(run.hero), offers = [];
    var cards = run.deck.filter(function (c) { return ok.some(function (u) { return !c.up[u]; }); });
    r.shuffle(cards);
    cards.slice(0, 5).forEach(function (c, i) {
      var miss = ok.filter(function (u) { return !c.up[u]; }), u = r.pick(miss);
      offers.push({ sq: SHOP_SPOTS[i], card: c.id, up: u, price: UPGRADES[u].price + (run.chain >= 4 ? 1 : 0), sold: false });
    });
    offers.push({ sq: SHOP_SPOTS[5], heart: true, price: 5 + 2 * run.heartBuys, sold: false });
    run.rng = r.s;
    run.F = null;
    run.shop = { hero: START, offers: offers, floor: run.floor + 1 };
  }
  function shopMoves(run) {
    var S = run.shop;
    if (!S) return [];
    var empty = { enemies: [] }, out = {};
    HEROES[run.hero].shop.forEach(function (p) { reach(empty, p, S.hero, false).forEach(function (x) { out[x.to] = true; }); });
    return Object.keys(out).map(Number);
  }
  function shopMove(run, to) {
    var S = run.shop;
    if (!S || shopMoves(run).indexOf(to) < 0) return null;
    var o = S.offers.find(function (x) { return x.sq === to && !x.sold; });
    if (o && run.gold < o.price) return { e: 'poor', price: o.price }; // not enough gold: he does not go there
    S.hero = to;
    if (to === STAIRS) { run.floor = S.floor; startFloor(run); return { e: 'stairs' }; }
    if (!o) return { e: 'move' };
    run.gold -= o.price; o.sold = true;
    if (o.heart) { run.maxHearts++; run.hearts++; run.heartBuys++; return { e: 'heart' }; }
    var card = run.deck.find(function (c) { return c.id === o.card; });
    if (card) card.up[o.up] = true;
    return { e: 'upgrade', card: o.card, up: o.up };
  }

  var api = {
    N: N, SQ: SQ, START: START, STAIRS: STAIRS, PIECES: PIECES, HEROES: HERO_IDS.map(function (id) { return id; }), HERO: HEROES, MONSTERS: MONSTERS, TRAITS: TRAITS, ATTACKS: ATTACKS,
    DUNGEONS: DUNGEON_IDS, DUNGEON: DUNGEONS, CHAINS: CHAINS, UPGRADES: UPGRADES, FLOORS: FLOORS,
    rng: rng, fresh: fresh, unlocked: unlocked, newRun: newRun, makeDeck: makeDeck, reach: reach, cardTargets: cardTargets, targets: targets, threat: threat, immune: immune, enemyAt: enemyAt,
    play: play, dragonDrop: dragonDrop, endTurn: endTurn, next: next, gauntlet: gauntlet, rest: rest, giveUp: giveUp, close: close, shopMoves: shopMoves, shopMove: shopMove,
    pieceOf: pieceOf, floorsOf: floorsOf, allowed: allowed, name: name, rowOf: rowOf, colOf: colOf, hasT: hasT, isFinalBoss: isFinalBoss
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pawnbarian = api;
})(typeof self !== 'undefined' ? self : this);
