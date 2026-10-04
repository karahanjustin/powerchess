/* The Ouroboros King: a run as the original game has it (Oriol Cosp, 2023), the logic without any page code so it
   runs in node too (tools/tests/ouro_sim.js). Facts from the game's own data, as the official modding docs publish it
   (ingoh.net/tokmods), and the wiki: the unit prices and recruit weights, the enemy pools per stage and the units'
   point values, the upgrade lines, the starting gold, Rewinds and relics.

   Three acts and a last battle: the Kingdom of Thessalonia (its boss Edea, at the Capital), the Marsh of Madness
   (Tabitha, at the Tower of Trickery), the Ridge of Ruin (Andromeda, at the Castle of the Coven), then the Coven, all
   three witches at once. Each act is a map of rows of one to three places linked by paths, from Ouroboros Manor up to
   the boss. Every place is a battle; what kind of place it is decides the reward for winning it: Training grounds
   (recruit a unit: two free ones and one for gold), Armory (upgrade a unit), Ruins (a relic), Shop (items), Sacrificial
   obelisks (give something up for something better). A boss pays gold only.

   Gold: 500 at the start. A battle pays a reward that starts at 200 (400 for a boss) and drops by 4 with every move
   played, to 0. Training grounds with a full army, or an Armory with nothing to upgrade, pay 350 instead. The army is
   the King and up to seven units in a formation four files wide and two ranks deep; where it stands on the first two
   ranks changes from battle to battle. Pieces lost in a battle are back for the next one, the Glass Queen (and the
   Mirror Queen) excepted. The King taken ends the run. A draw gives nothing (a boss is fought again).

   Everything random comes from the run's own generator, whose state is saved, so a reload cannot reroll anything. */
(function (root) {
  'use strict';
  var R = root.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);
  var B = root.Brain || (typeof require !== 'undefined' ? require('./brain.js') : null);
  var VERSION = 2;

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
    // a pick by weight from [[item, weight], ...]
    st.weighted = function (list) {
      var sum = 0, i;
      for (i = 0; i < list.length; i++) sum += list[i][1];
      var x = st.next() * sum;
      for (i = 0; i < list.length; i++) { x -= list[i][1]; if (x < 0) return list[i][0]; }
      return list[list.length - 1][0];
    };
    return st;
  }

  /* ---------- the units ---------- */
  // the game's point values (game data): what an enemy army is counted in. The king and the general are not counted.
  var POINTS = {
    'д': 1, b: 3, n: 3, o: 3, 'з': 4, s: 3, 'ρ': 3, 'τ': 3, 'υ': 1, 'φ': 4, 'χ': 4, 'б': 1, 'в': 4, 'π': 6, 'г': 4, 'ξ': 7, 'ж': 4, 'ο': 17, 'и': 9,
    r: 5, x: 6, v: 7, 'л': 6, 'п': 4, 'ф': 4, 'μ': 5, 'ц': 5, y: 7, q: 9, 'ђ': 7, 'ћ': 8, 'ч': 4, 'ш': 9, 'α': 7, 'β': 9,
    'θ': 5, 'κ': 5, 'ι': 7, 'ν': 8, 'щ': 11, t: 7, 'λ': 10, 'ε': 4, 'ζ': 3, 'η': 14, 'ψ': 7, 'ω': 7, 'ы': 4, 'й': 10, 'γ': 14, 'δ': 14,
    'ё': 12, 'я': 12, 'ь': 12
  };
  function points(l) { return POINTS[String(l).toLowerCase()] || 0; }
  // what a recruit costs and how often Training grounds offer it [letter, price, weight] (game data)
  var RECRUITS = [
    ['д', 0, 2], ['b', 0, 2], ['n', 0, 2], ['s', 0, 2], ['o', 0, 2], ['в', 0, 2], ['ρ', 0, 2], ['и', 0, 2], ['ж', 0, 2], ['ο', 0, 2], ['υ', 0, 2], ['τ', 0, 2], ['ξ', 0, 2], ['б', 0, 2],
    ['з', 0, 1], ['φ', 0, 1], ['χ', 0, 1], ['π', 0, 1],
    ['r', 352, 2], ['г', 400, 2], ['v', 431, 2], ['x', 503, 2], ['ц', 524, 2], ['л', 533, 2], ['y', 624, 2], ['μ', 733, 2], ['α', 750, 2], ['ћ', 753, 2],
    ['п', 848, 1], ['ф', 848, 1], ['β', 900, 2], ['ђ', 917, 2], ['q', 940, 2], ['ч', 1141, 2], ['ш', 1488, 2]
  ];
  var PRICE = {};
  RECRUITS.forEach(function (x) { PRICE[x[0]] = x[1]; });
  // the wiki's tiers: a run may start with tier 1 units and at most one of tier 2; tier 3 come for gold or at the obelisks
  var TIER2 = ['r', 'x', 'v', 'л', 'п', 'ф', 'μ', 'ц', 'y'], TIER3 = ['q', 'ђ', 'ћ', 'ч', 'ш', 'α', 'β'];
  function tierOf(l) { l = String(l).toLowerCase(); return TIER3.indexOf(l) >= 0 ? 3 : TIER2.indexOf(l) >= 0 ? 2 : 1; }
  // the upgrade lines (the Armory): base unit to its upgrade
  var UPGRADE = { k: 'э', n: 'κ', b: 'θ', r: 'ι', o: 'ν', s: 't', 'ρ': 'λ', 'з': 'щ', 'д': 'ы', 'и': 'й', 'β': 'δ', 'α': 'γ', 'υ': 'ζ', 'ζ': 'η', 'τ': 'ε', 'φ': 'ω', 'χ': 'ψ' };
  var DOWNGRADE = {};
  Object.keys(UPGRADE).forEach(function (k) { DOWNGRADE[UPGRADE[k]] = k; });
  function upgradeOf(l) { var lo = String(l).toLowerCase(), u = UPGRADE[lo]; return u ? (l === lo ? u : u.toUpperCase()) : null; }
  function downgradeOf(l) { var lo = String(l).toLowerCase(), d = DOWNGRADE[lo]; return d ? (l === lo ? d : d.toUpperCase()) : null; }
  var GLASS = { 'и': 1, 'й': 1 }; // lost for good when taken
  // pieces that may never stand on their own first rank
  var PAWNISH = { p: 1, 'д': 1, 'ы': 1 };
  function title(l) {
    var t = String(l).toLowerCase(), STD = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
    return STD[t] || (R.fairyOf(l) ? R.fairyOf(l).name : l);
  }

  /* The enemy's pools per stage, [letter, weight] (game data). Act 1 starts in stage 0 and moves on to stage 1, the
     second act is stage 2, the third stage 3; the witches come as bosses. */
  var POOLS = [
    [['s', 10], ['t', 10], ['b', 10], ['θ', 10], ['n', 10], ['r', 10], ['κ', 10], ['ι', 10]],
    [['φ', 10], ['ω', 5], ['ψ', 5], ['χ', 10], ['s', 5], ['t', 5], ['b', 5], ['v', 5], ['θ', 5], ['x', 10], ['π', 10], ['г', 10], ['n', 5], ['з', 10], ['μ', 10], ['ж', 10], ['r', 5], ['ξ', 10], ['κ', 5], ['ι', 5]],
    [['φ', 5], ['ω', 5], ['ψ', 5], ['χ', 5], ['s', 5], ['t', 5], ['b', 5], ['θ', 5], ['x', 5], ['π', 5], ['г', 5], ['n', 5], ['з', 5], ['μ', 5], ['ж', 5], ['r', 5], ['ξ', 5], ['κ', 5], ['ι', 5],
      ['ч', 10], ['ћ', 10], ['в', 20], ['ш', 10], ['ν', 20], ['л', 20], ['y', 10], ['п', 5], ['ф', 5], ['o', 20], ['ζ', 10], ['v', 20]],
    [['ω', 5], ['ψ', 5], ['t', 5], ['θ', 5], ['x', 5], ['π', 5], ['г', 5], ['μ', 5], ['ж', 5], ['ξ', 5], ['κ', 5], ['ч', 5], ['ћ', 5], ['в', 5], ['ш', 5], ['л', 5], ['y', 5], ['п', 5], ['ф', 5], ['v', 5], ['ζ', 5],
      ['β', 10], ['α', 10], ['δ', 10], ['γ', 10], ['q', 10], ['ц', 10], ['ђ', 10], ['ι', 10], ['o', 10], ['ν', 10]]
  ];

  /* ---------- acts, places, relics, items ---------- */
  var ACTS = [
    { name: 'Kingdom of Thessalonia', boss: 'The Capital', witch: ['ё'], witchName: 'Edea, the Witch Queen' },
    { name: 'Marsh of Madness', boss: 'Tower of Trickery', witch: ['я'], witchName: 'Tabitha the Deceptive' },
    { name: 'Ridge of Ruin', boss: 'Castle of the Coven', witch: ['ь'], witchName: 'Andromeda of the Stars' },
    { name: 'Castle of the Coven', boss: 'The Coven', witch: ['ё', 'я', 'ь'], witchName: 'the Coven' }
  ];
  var PLACES = {
    recruit: { name: 'Training grounds', text: 'Win the battle, then recruit a unit: two for free and one for gold' },
    upgrade: { name: 'Armory', text: 'Win the battle, then upgrade one of your units' },
    ruins: { name: 'Ruins', text: 'Win the battle, then take a relic' },
    shop: { name: 'Shop', text: 'Win the battle, then buy items' },
    obelisk: { name: 'Sacrificial obelisks', text: 'Win the battle, then give something up for something better' },
    boss: { name: 'Boss', text: 'A witch and her army. Pays gold only' }
  };
  var PLACE_WEIGHTS = [['recruit', 30], ['upgrade', 20], ['ruins', 17], ['shop', 18], ['obelisk', 15]];
  /* Relics: kept for the whole run. premium ones cost gold in the Ruins or come from the obelisks. Those that change
     the rules of a battle are read by the app (rel()). */
  var RELICS = {
    sigil: { name: 'Ouroboros sigil', text: '+1 Rewind at the start of every battle', start: true },
    bell: { name: 'Alarm bell', text: 'Warns you when your King is in danger', start: true },
    finisher: { name: 'The Finisher', text: 'If the enemy General stands alone at the start of your turn and you still have another unit, you win', start: true, premium: true },
    angel: { name: 'Guardian angel', text: 'If a move of yours would leave your King in danger, it is taken back for 3 Rewinds', start: true },
    clock: { name: 'Ouroboros clock', text: 'Starting a battle with no Rewinds gives you 2' },
    backpack: { name: 'Backpack', text: '2 Rewinds, a random item and 200 gold, at once' },
    chest: { name: 'Treasure chest', text: '3 random items, at once' },
    compass: { name: 'Compass', text: 'Ignore the paths: go to any place of the next row' },
    secretkey: { name: 'Secret key', text: 'A draw still gives the place\'s reward (but no gold)' },
    goldbar: { name: 'Gold bar', text: '500 gold, at once' },
    bounty: { name: 'Bounty card', text: 'Battles pay double gold' },
    cake: { name: 'Cake', text: 'Units cost half' },
    discount: { name: 'Discount card', text: 'Shop items cost half' },
    ticket: { name: 'Golden ticket', text: 'The next Ruins offer three premium relics, for free' },
    goldaxe: { name: 'Golden axe', text: '+30 gold for every enemy unit you take' },
    scarab: { name: 'Gold scarab', text: '+200 gold every time your King takes a unit' },
    shovel: { name: 'Shovel', text: 'A boulder on the board at the start of every battle' },
    suitcase: { name: 'Magic suitcase', text: 'A random item at the start of every battle', premium: true },
    horn: { name: 'Bodyguard horn', text: 'When your King is your only unit left, a Queen joins him (once a battle)', premium: true },
    spiked: { name: 'Spiked shield', text: 'The first time a unit of yours is taken by anything but a king, the taker is destroyed (once a battle)', premium: true },
    firegem: { name: 'Fire gem', text: 'Your King cannot be taken by Edea, Tabitha or Andromeda', premium: true },
    boots: { name: 'Marching boots', text: 'The first turn of every battle you move twice, two different units', premium: true },
    // for one kind of unit: offered only when the army has one of them (units)
    axe: { name: 'Battle axe', text: 'Vikings and Berserkers move through boulders, bombs and units', units: 'st' },
    wheel: { name: 'Extra wheel', text: 'A Catapult moves one more square sideways', units: 'x' },
    heavyarmor: { name: 'Heavy armor', text: 'Marching pawns cannot be taken until they change', units: 'д' },
    grail: { name: 'Holy grail', text: 'Crusaders and Knight Templars bounce off the edge of the board once', units: 'oν' },
    vestments: { name: 'Immaterial vestments', text: 'Bishops, Cardinals and Centaurs move diagonally through boulders, bombs and units', units: 'bθћ' },
    sceptre: { name: 'Royal sceptre', text: 'Agents can also step to the squares next to them', units: 'φχψω' },
    carrots: { name: 'Spicy carrots', text: 'A Knight or Pegasus Rider that takes moves once more (once a turn)', units: 'nκ' },
    stiletto: { name: 'Stiletto', text: 'A Princess that takes goes back to where she started (and still becomes a Queen)', units: 'ж' },
    tabi: { name: 'Tabi boots', text: 'Lepers and Martyrs move up to two squares', units: 'зщ' },
    horseshoes: { name: 'Premium horseshoes', text: 'Knights, Pegasus Riders, Centaurs and Unicorn Cavalry can also step to the squares next to them', units: 'nκћђ' },
    glass: { name: 'Tempered glass', text: 'The Glass Queen does not break when she is taken', units: 'ий' },
    daggers: { name: 'Extra daggers', text: 'Assassins and Blade Dancers move again after every capture, as often as they take', units: 'ρλ' },
    terraform: { name: 'Terraformer staff', text: 'A Portal Mage leaves a boulder where it stood', units: 'л' },
    // for the whole army
    whiteflag: { name: 'White flag', text: 'Your units can also step one square straight back' },
    cursed: { name: 'Cursed staff', text: 'Every third turn you move twice, two different units' },
    medal: { name: 'Death medal', text: 'A unit that takes is upgraded for the rest of the battle' },
    fence: { name: 'Spiked fence', text: 'The enemy cannot use the portals' },
    wrecking: { name: 'Wrecking ball', text: 'Your units can break boulders by moving onto them' },
    feather: { name: 'Feather necklace', text: 'A unit can move onto one of your own units, and the two change places' },
    helmet: { name: 'Dwarven helmet', text: 'Bomb blasts do not hurt your units' },
    totem: { name: 'Totem mask', text: 'Your units (not the King) turn into whatever they take' },
    carnival: { name: 'Carnival mask', text: 'Your units (not the King) turn into a random unit after every move' }
  };
  // the relics the rules read in a battle (powers .ou of the player)
  var RULE_RELICS = ['axe', 'wheel', 'heavyarmor', 'grail', 'vestments', 'sceptre', 'carrots', 'stiletto', 'tabi', 'horseshoes', 'daggers', 'terraform', 'whiteflag', 'cursed', 'fence', 'wrecking', 'feather', 'helmet', 'totem', 'boots'];
  var PREMIUM_PRICE = { finisher: 640, suitcase: 560, horn: 700, spiked: 760, firegem: 900, boots: 620 };
  /* Items: used up when used. In a battle they are actions of their own (the app); the enemy never uses items. */
  var ITEMS = {
    rewind: { name: 'Rewind', text: 'Take back your last move and the enemy\'s answer', price: 300, qty: 2 },
    shackles: { name: 'Shackles', text: 'An enemy unit cannot move on its next turn (one a turn, does not use your move)', price: 305, qty: 1 },
    sphere: { name: 'Sphere of protection', text: 'One of your units cannot be taken on the enemy\'s next turn (one a turn, does not use your move)', price: 364, qty: 3 },
    chair: { name: 'Rocking chair', text: 'Pass your turn', price: 250, qty: 1 },
    powerup: { name: 'Power up', text: 'Upgrade one of your units for the rest of the battle, then move', price: 382, qty: 1 },
    downgrade: { name: 'Downgrade', text: 'Turn an upgraded enemy unit back into its base unit, for the rest of the battle', price: 320, qty: 1 },
    smoke: { name: 'Smoke bomb', text: 'End the battle at once, with no reward. Not against a witch', price: 300, qty: 1 },
    hourglass: { name: 'Sand hourglass', text: 'Start the battle again; the positions and the terrain may differ', price: 280, qty: 1 },
    knife: { name: 'Backstabbing knife', text: 'This turn your units may take your own units', price: 220, qty: 1 },
    bottle_b: { name: 'Bishop in a bottle', text: 'This turn all your units move like Bishops', price: 300, qty: 1 },
    bottle_n: { name: 'Knight in a bottle', text: 'This turn all your units move like Knights', price: 300, qty: 1 },
    bottle_r: { name: 'Rook in a bottle', text: 'This turn all your units move like Rooks', price: 300, qty: 1 },
    boomerang: { name: 'Boomerang', text: 'The next unit you move comes back to where it started', price: 290, qty: 1 },
    rock: { name: 'Exploding rock', text: 'Put a bomb on an empty square. This uses your turn', price: 310, qty: 1 },
    hammer: { name: 'Hammer', text: 'Break a boulder, then move', price: 240, qty: 2 },
    glider: { name: 'Hang glider', text: 'Your next move flies over boulders and bombs', price: 270, qty: 1 },
    boulder: { name: 'Pocket boulder', text: 'Put a boulder on an empty square, then move', price: 250, qty: 2 },
    snow: { name: 'Snow bottle', text: 'Defuse a bomb, then move', price: 230, qty: 2 },
    teleporter: { name: 'Teleporter', text: 'Two of your units change places. This uses your turn', price: 330, qty: 1 }
  };
  var ITEM_IDS = Object.keys(ITEMS);
  function has(run, id) { return run.relics.indexOf(id) >= 0; }
  function addItem(run, id, n) { run.items[id] = (run.items[id] || 0) + (n || 1); if (id === 'rewind') { run.rewinds += run.items.rewind; delete run.items.rewind; } }

  /* ---------- the map ---------- */
  /* One act: rows of places from the start (Ouroboros Manor) to the boss. The first row has one or two places, the
     others two or three; every place leads to one or two places of the next row, and paths never cross. */
  function genMap(r, act) {
    if (act === 3) return { rows: [], boss: { id: 'boss', row: 0, x: 0.5, type: 'boss', next: [] } }; // the Coven: one last battle
    var nRows = 5, rows = [], id = 0;
    for (var i = 0; i < nRows; i++) {
      var n = i === 0 ? 1 + r.int(2) : 2 + (r.next() < 0.45 ? 1 : 0), row = [];
      for (var k = 0; k < n; k++) row.push({ id: 'n' + (id++), row: i, x: (k + 0.5) / n, type: '', next: [] });
      rows.push(row);
    }
    // paths: every place to the nearest place above, then every place left without a way in from the nearest below,
    // then now and then a second path to a neighbour, if it crosses nothing
    var crosses = function (from, a, b) { return from.some(function (o) { return o.next.some(function (id) { var nb = byId(rows, id); return (o.x < a.x && nb.x > b.x) || (o.x > a.x && nb.x < b.x); }); }); };
    for (i = 0; i + 1 < rows.length; i++) {
      var lo = rows[i], hi = rows[i + 1];
      var near = function (p, list) { return list.slice().sort(function (u, v) { return Math.abs(u.x - p.x) - Math.abs(v.x - p.x); })[0]; };
      lo.forEach(function (p) { p.next.push(near(p, hi).id); });
      hi.forEach(function (q) { if (!lo.some(function (p) { return p.next.indexOf(q.id) >= 0; })) near(q, lo).next.push(q.id); });
      lo.forEach(function (p) {
        if (r.next() > 0.4) return;
        var cand = hi.filter(function (q) { return p.next.indexOf(q.id) < 0 && Math.abs(q.x - p.x) < 0.6; });
        if (!cand.length) return;
        var q = r.pick(cand);
        if (!crosses(lo.filter(function (o) { return o !== p; }), p, q)) p.next.push(q.id);
      });
      lo.forEach(function (p) { p.next.sort(function (a, b) { return byId(rows, a).x - byId(rows, b).x; }); });
    }
    rows[rows.length - 1].forEach(function (p) { p.next = ['boss']; });
    // what each place is: dealt by weight, at least one Training grounds and one Shop an act, no Shop or obelisks
    // in the first row (nothing to spend or to give up yet)
    var all = [];
    rows.forEach(function (row) { row.forEach(function (p) { all.push(p); }); });
    all.forEach(function (p) { p.type = r.weighted(p.row === 0 ? [['recruit', 3], ['upgrade', 2], ['ruins', 1]] : PLACE_WEIGHTS); });
    ['recruit', 'shop'].forEach(function (t) {
      if (all.some(function (p) { return p.type === t; })) return;
      var spots = all.filter(function (p) { return p.row > 0; });
      r.pick(spots).type = t;
    });
    return { rows: rows, boss: { id: 'boss', row: nRows, x: 0.5, type: 'boss', next: [] } };
  }
  function byId(rows, id) { for (var i = 0; i < rows.length; i++) for (var k = 0; k < rows[i].length; k++) if (rows[i][k].id === id) return rows[i][k]; return null; }
  function place(run, id) { return id === 'boss' ? run.map.boss : byId(run.map.rows, id); }
  // where the player may go next: the first row from the start, else the paths out of the place last won
  function options(run) {
    if (run.battle || run.reward || run.edit || run.over) return [];
    var m = run.map;
    if (!m.rows.length) return run.at === 'boss' ? [] : ['boss'];
    if (run.at == null) return m.rows[0].map(function (p) { return p.id; });
    var at = place(run, run.at);
    if (!at || at.type === 'boss') return [];
    if (has(run, 'compass') && at.row + 1 < m.rows.length) return m.rows[at.row + 1].map(function (p) { return p.id; });
    return at.next.slice();
  }

  /* ---------- the army ---------- */
  // the formation: files a to d of the first two ranks; in a battle it stands somewhere along the first two ranks
  var FILES = 'abcdefgh';
  var CELLS = ['a1', 'b1', 'c1', 'd1', 'a2', 'b2', 'c2', 'd2'];
  function fits(l, at) { return !(PAWNISH[String(l).toLowerCase()] && at[1] === '1'); }
  function freeCells(run, piece) {
    var taken = {};
    run.army.forEach(function (x) { taken[x[0]] = true; });
    return CELLS.filter(function (c) { return !taken[c] && (!piece || fits(piece, c)); });
  }
  function movePiece(run, from, to) {
    if (run.battle || CELLS.indexOf(to) < 0 || from === to) return false;
    var a = run.army.find(function (x) { return x[0] === from; }), b = run.army.find(function (x) { return x[0] === to; });
    if (!a || !fits(a[1], to) || (b && !fits(b[1], from))) return false;
    a[0] = to;
    if (b) b[0] = from;
    return true;
  }
  var START_UNITS = ['n', 'b', 'r']; // the first run of the game: King, Knight, Bishop, Rook
  function startOk(units) {
    if (!Array.isArray(units) || units.length !== 3) return false;
    var t2 = 0;
    for (var i = 0; i < 3; i++) {
      var l = String(units[i]).toLowerCase(), t = tierOf(l);
      if (!POINTS[l] || UPGRADE[l] == null && DOWNGRADE[l] != null) return false; // base units only
      if (t === 3) return false;
      if (t === 2) t2++;
    }
    return t2 <= 1;
  }
  // The units offered for the start (from the second run on): six, tier 1 and some of tier 2; three are picked.
  function startOffer(seed) {
    var r = rng((seed ^ 0x2545f491) >>> 0), out = [], t1 = RECRUITS.filter(function (x) { return tierOf(x[0]) === 1; }), t2 = TIER2.slice();
    while (out.length < 4) { var l = r.weighted(t1.map(function (x) { return [x[0], x[2]]; })); if (out.indexOf(l) < 0) out.push(l); }
    while (out.length < 6) { var m = r.pick(t2); if (out.indexOf(m) < 0) out.push(m); }
    return out;
  }
  function startArmy(units) {
    if (!startOk(units)) units = START_UNITS;
    var army = [['b1', 'K']], spots = ['a1', 'c1', 'd1'];
    units.forEach(function (l, i) { army.push([PAWNISH[l] ? ['a2', 'c2', 'd2'][i] : spots[i], String(l).toUpperCase()]); });
    return army;
  }

  /* ---------- a run ---------- */
  function newRun(M, seed, units) {
    var r = rng((seed ^ 0x51ed27) >>> 0);
    var run = {
      v: VERSION, seed: seed >>> 0, rng: 0, act: 0, map: null, at: null, done: [], won: 0,
      gold: 500, rewinds: 5, relics: ['sigil', 'bell', 'finisher', 'angel'], items: {},
      army: startArmy(units), battle: null, reward: null, edit: null, over: null, ticket: false, started: Date.now()
    };
    run.map = genMap(r, 0);
    run.rng = r.s;
    M.run = run;
    M.runs.count++;
    return run;
  }
  /* An older run (the stage after stage one): its army is kept, put into the formation (the King and the seven most
     valuable units), and it goes on from the start of the first act. */
  function fromOld(old) {
    var seed = (old.seed || 1) >>> 0, run = newRun({ runs: { count: 0 } }, seed, START_UNITS);
    var king = old.army.find(function (x) { return R.isRoyal(x[1]); }) || [null, 'K'];
    var rest = old.army.filter(function (x) { return x !== king; }).sort(function (a, b) { return points(b[1]) - points(a[1]); }).slice(0, 7);
    run.army = [['b1', king[1]]];
    rest.forEach(function (x) { var c = freeCells(run, x[1])[0] || freeCells(run)[0]; if (c && fits(x[1], c)) run.army.push([c, x[1]]); });
    return run;
  }

  /* The battle at a place: the enemy army drawn from the stage's pool by weight until its points reach the limit (at
     most seven units and the General), the witches at a boss, terrain from the second row of the first act on, and
     where both formations stand. The bot's level climbs with the battles won, as the game's AI gets stronger armies. */
  function stageOf(act, row) { return act === 0 ? (row < 2 ? 0 : 1) : act === 1 ? 2 : 3; }
  // the points of an enemy army: rising by two a row; a boss army (the witch counted in) four more than the last row
  function limitOf(act, row, boss) {
    if (act === 3) return 36 + 14; // the Coven: the three witches and an escort
    var base = [6, 16, 25][act];
    return boss ? base + 2 * 4 + 4 : base + 2 * row;
  }
  function botFor(run, r) { var lv = Math.round(0.33 * run.won + 0.5 + (r.next() - 0.5)); return 'b' + Math.max(0, Math.min(9, lv)); }
  function terrainFor(act, row, r) {
    var chance = act === 0 ? (row >= 2 ? 0.35 : 0) : act === 1 ? 0.5 : 0.65;
    if (r.next() >= chance) return null;
    var t = { walls: [], water: [], portals: [] }, used = {};
    var pairs = 1 + r.int(act + 1);
    for (var i = 0; i < pairs; i++) {
      var q = 24 + r.int(16), mirror = 63 - q; // ranks 4 and 5 and their point mirror: boulders, the same from both sides
      if (used[q] || used[mirror]) continue;
      used[q] = used[mirror] = true;
      t.walls.push(sqName(q), sqName(mirror));
    }
    if (r.next() < 0.25 + 0.1 * act) {
      var p = 16 + r.int(8), pm = 63 - p;
      if (!used[p] && !used[pm]) { t.portals = [sqName(p), sqName(pm)]; used[p] = used[pm] = true; }
    }
    // bombs (from the second act on): they blow up with everything around them when taken
    t.bombs = [];
    if (act >= 1 && r.next() < 0.3 + 0.15 * act) {
      var bq = 24 + r.int(16), bm = 63 - bq;
      if (!used[bq] && !used[bm]) t.bombs.push(sqName(bq), sqName(bm));
    }
    return t;
  }
  function sq(n) { return (8 - parseInt(n[1], 10)) * 8 + FILES.indexOf(n[0]); }
  function sqName(i) { return FILES[i % 8] + (8 - Math.floor(i / 8)); }
  // a battle always has a terrain (the items and relics may put boulders and bombs on the board)
  function cfgFor(terrain, run) {
    var t = terrain || {};
    return { side: 'w', pw: { w: null, b: null }, freeArmy: true, kingCapture: true, terrain: { walls: (t.walls || []).map(sq), water: (t.water || []).map(sq), portals: (t.portals || []).map(sq), bombs: (t.bombs || []).map(sq) } };
  }
  // the relics the rules play with, for the player's side (powers .ou); null when none
  function battleFlags(run) {
    var ou = {}, any = false;
    RULE_RELICS.forEach(function (id) { if (has(run, id)) { ou[id] = true; any = true; } });
    if (has(run, 'medal')) { ou.medal = {}; Object.keys(UPGRADE).forEach(function (k) { if (k !== 'k') ou.medal[k] = UPGRADE[k]; }); any = true; }
    if (has(run, 'carnival')) { ou.carnival = RECRUITS.map(function (x) { return x[0]; }).filter(function (l) { return TIER3.indexOf(l) < 0; }); any = true; }
    return any ? ou : null;
  }
  // the player's formation moved along the first two ranks by dx files
  function shifted(army, dx) { return army.map(function (x) { return [FILES[FILES.indexOf(x[0][0]) + dx] + x[0][1], x[1]]; }); }
  function boardOf(white, black) {
    var b = new Array(64).fill('');
    white.forEach(function (x) { b[sq(x[0])] = x[1]; });
    black.forEach(function (x) { b[sq(x[0])] = x[1]; });
    return b;
  }
  function fenOf(white, black) { return R.boardFen(boardOf(white, black), 8) + ' w - - 0 1'; }
  function hotStart(fen, cfg) {
    for (var t = 0; t < 2; t++) {
      var s = R.fromFen(fen.replace(' w ', t ? ' b ' : ' w '), cfg);
      if (R.legalMoves(s, cfg).some(function (m) { return m.cap && R.isRoyal(m.cap); })) return true;
    }
    return false;
  }
  function rate(fen, cfg) {
    if (!B) return 0;
    var s = R.fromFen(fen, cfg), res = B.think(s, cfg, { ms: 5000, maxDepth: 3, margin: 0, free: true });
    return res && isFinite(res.score) ? res.score : 0;
  }
  function dealBattle(run, id) {
    var p = place(run, id), r = rng(run.rng), boss = p.type === 'boss', act = run.act, A = ACTS[act];
    var stage = stageOf(act, p.row), limit = limitOf(act, p.row, boss), units = boss ? A.witch.slice() : [];
    var pool = POOLS[stage], left = limit - units.reduce(function (a, l) { return a + points(l); }, 0); // the witches count
    for (var tries = 0; tries < 60 && units.length < 7; tries++) {
      var l = r.weighted(pool), v = points(l);
      if (v > left + 1) { if (left <= 1) break; continue; }
      units.push(l); left -= v;
      if (left <= 0) break;
    }
    if (!units.length) units.push('s');
    var terrain = boss && act === 3 ? null : terrainFor(act, p.row, r), cfg = cfgFor(terrain, run);
    // both formations: the player's on the first two ranks, the enemy's (the General and its units) on the last two,
    // each somewhere along its ranks. Dealt again until no King can be taken on the first move; up to eight layouts are
    // rated and the most even one kept (the search's eye, so a stage is never lost or won before it starts).
    var best = null, bestScore = Infinity;
    for (var k = 0, rated = 0; k < 60 && rated < 6; k++) {
      var dx = r.int(5), ex = r.int(5), cells = [];
      for (var c = 0; c < 8; c++) cells.push(FILES[ex + (c % 4)] + (c < 4 ? '8' : '7'));
      var black = [], order = ['k'].concat(units.slice().sort(function (a, b) { return (PAWNISH[a] ? 1 : 0) - (PAWNISH[b] ? 1 : 0); }));
      var freeC = cells.filter(function (q) { return !terrain || (terrain.walls.indexOf(q) < 0 && (terrain.bombs || []).indexOf(q) < 0); });
      for (var i = 0; i < order.length && freeC.length; i++) {
        var opts = freeC.filter(function (q) { return order[i] === 'k' ? q[1] === '8' : !PAWNISH[order[i]] || q[1] === '7'; });
        if (!opts.length) opts = freeC;
        var at = r.pick(opts);
        freeC.splice(freeC.indexOf(at), 1);
        black.push([at, order[i]]);
      }
      var white = shifted(run.army, dx);
      if (terrain && white.some(function (x) { return terrain.walls.indexOf(x[0]) >= 0 || terrain.portals.indexOf(x[0]) >= 0 || (terrain.bombs || []).indexOf(x[0]) >= 0; })) continue;
      var fen = fenOf(white, black), s;
      try { s = R.fromFen(fen, cfg); } catch (e) { continue; }
      if (R.validate(s, cfg).length || hotStart(fen, cfg)) continue;
      var sc = Math.abs(rate(fen, cfg));
      rated++;
      if (sc < bestScore) { bestScore = sc; best = { dx: dx, black: black }; }
      if (sc <= 300) break;
    }
    if (!best) best = { dx: 0, black: [['e8', 'k']] };
    var lead = units.slice().sort(function (a, b) { return points(b) - points(a); })[0];
    var b = {
      id: id, type: p.type, boss: boss, act: act, dx: best.dx, black: best.black, terrain: terrain, bot: botFor(run, r), points: limit - left,
      title: boss ? (act === 3 ? 'The Coven' : A.witchName) : (lead ? 'Led by ' + (/^[AEIO]/.test(title(lead)) ? 'an ' : 'a ') + title(lead) : 'A small band'),
      reward: boss ? 400 : 200
    };
    // relics that act at the start of a battle
    if (has(run, 'shovel')) {
      var spots = [];
      for (var q2 = 24; q2 < 40; q2++) if (!boardOf(shifted(run.army, b.dx), b.black)[q2] && !(terrain && (terrain.walls.indexOf(sqName(q2)) >= 0 || terrain.portals.indexOf(sqName(q2)) >= 0))) spots.push(sqName(q2));
      if (spots.length) { b.terrain = b.terrain || { walls: [], water: [], portals: [] }; b.terrain.walls = b.terrain.walls.concat([r.pick(spots)]); }
    }
    run.rng = r.s;
    return b;
  }
  // Travel to a place: its battle is dealt and shown; from then on the formation is fixed until the battle is over.
  function travel(run, id) {
    if (options(run).indexOf(id) < 0) return false;
    run.battle = dealBattle(run, id);
    // relics at the start of the battle: more Rewinds, an item
    if (has(run, 'sigil')) run.rewinds++;
    if (has(run, 'clock') && run.rewinds === 0) run.rewinds = 2;
    if (has(run, 'suitcase')) { var r = rng(run.rng); addItem(run, r.pick(ITEM_IDS.filter(function (x) { return x !== 'rewind'; }))); run.rng = r.s; }
    return true;
  }
  // the position the battle starts from
  function battleFen(run) { return fenOf(shifted(run.army, run.battle.dx), run.battle.black); }
  function battleCfg(run) { return cfgFor(run.battle.terrain, run); }
  // the gold a battle pays after `moves` moves (both sides' moves count)
  function rewardAfter(battle, moves) { return Math.max(0, battle.reward - 4 * moves); }

  /* The battle is over. res: 'w', 'd' or 'l' from the player's side. info: { moves, kills: [taken enemy letters with
     who took them: [taker, taken]], lost: [own letters taken], used: { item: n } }. Returns what happened. */
  function settle(M, res, info) {
    var run = M.run;
    if (!run || !run.battle) return null;
    info = info || {};
    var b = run.battle;
    consume(run, info.used);
    if (res === 'l') {
      run.over = { won: false, act: run.act, battles: run.won, date: Date.now() };
      M.runs.history.unshift({ cleared: run.won, act: run.act, date: Date.now(), army: run.army.map(function (x) { return x.slice(); }) });
      if (M.runs.history.length > 30) M.runs.history.length = 30;
      M.run = null;
      return { outcome: 'over' };
    }
    // the Glass Queen (and the Mirror Queen she becomes) is lost for good when taken
    (info.lost || []).forEach(function (l) {
      var lo = String(l).toLowerCase();
      if (!GLASS[lo] || has(run, 'glass')) return; // the Tempered glass: she does not break
      var i = run.army.findIndex(function (x) { return x[1].toLowerCase() === lo; });
      if (i >= 0) run.army.splice(i, 1);
    });
    if (res === 'f') { run.done.push(b.id); run.at = b.id; run.battle = null; return { outcome: 'fled' }; } // a Smoke bomb: on, with nothing
    if (res === 'd') {
      if (b.boss) { run.battle = null; run.battle = dealBattle(run, b.id); return { outcome: 'again' }; } // a boss is fought again
      run.done.push(b.id); run.at = b.id; run.battle = null;
      if (has(run, 'secretkey')) { run.reward = dealReward(run, b); return { outcome: 'draw-reward' }; }
      return { outcome: 'draw' };
    }
    // a win: the gold, then the place's reward
    var gold = rewardAfter(b, info.moves || 0);
    (info.kills || []).forEach(function (k) {
      var taker = String(k[0]).toLowerCase();
      if (has(run, 'goldaxe')) gold += 30;
      if (taker === 'o' || taker === 'ν') gold += 30; // a crusader's or a knight templar's kill
      if (has(run, 'scarab') && R.isRoyal(k[0])) gold += 200;
    });
    if (has(run, 'bounty')) gold *= 2;
    run.gold += gold;
    run.won++;
    if (run.won > M.runs.best) { M.runs.best = run.won; M.runs.bestDate = Date.now(); M.runs.bestArmy = run.army.map(function (x) { return x.slice(); }); }
    run.done.push(b.id); run.at = b.id; run.battle = null;
    if (b.boss) {
      if (run.act === 3) {
        run.over = { won: true, act: 3, battles: run.won, date: Date.now() };
        M.runs.wins = (M.runs.wins || 0) + 1;
        M.runs.history.unshift({ cleared: run.won, act: 4, won: true, date: Date.now(), army: run.army.map(function (x) { return x.slice(); }) });
        run.reward = { kind: 'gold', gold: gold, boss: true, last: true };
        return { outcome: 'won', gold: gold };
      }
      run.reward = { kind: 'gold', gold: gold, boss: true };
      return { outcome: 'boss', gold: gold };
    }
    run.reward = dealReward(run, b);
    run.reward.gold = gold;
    return { outcome: 'cleared', gold: gold };
  }
  // On to the next act after a boss's gold has been seen.
  function nextAct(run) {
    var r = rng(run.rng);
    run.act++;
    run.map = genMap(r, run.act);
    run.at = null; run.done = [];
    run.rng = r.s;
  }

  /* ---------- rewards ---------- */
  function unitPrice(run, l) { var p = PRICE[String(l).toLowerCase()] || 0; return has(run, 'cake') ? Math.round(p / 2) : p; }
  function itemPrice(run, id, r) { var p = Math.round(ITEMS[id].price * (0.9 + 0.2 * r.next())); return has(run, 'discount') ? Math.round(p / 2) : p; }
  function dealReward(run, b) {
    var r = rng(run.rng), out;
    if (b.type === 'recruit') {
      if (run.army.length >= 8) out = { kind: 'gold', gold350: true };
      else {
        var free = RECRUITS.filter(function (x) { return x[1] === 0; }), paid = RECRUITS.filter(function (x) { return x[1] > 0; }), offers = [];
        while (offers.length < 2) { var l = r.weighted(free.map(function (x) { return [x[0], x[2]]; })).toUpperCase(); if (offers.indexOf(l) < 0) offers.push(l); }
        offers.push(r.weighted(paid.map(function (x) { return [x[0], x[2]]; })).toUpperCase());
        out = { kind: 'recruit', offers: offers.map(function (l, i) { return { l: l, price: i < 2 ? 0 : unitPrice(run, l) }; }) };
      }
    } else if (b.type === 'upgrade') {
      var ups = run.army.filter(function (x) { return upgradeOf(x[1]); }).map(function (x) { return { at: x[0], from: x[1], to: upgradeOf(x[1]) }; });
      out = ups.length ? { kind: 'upgrade', offers: ups } : { kind: 'gold', gold350: true };
    } else if (b.type === 'ruins') {
      var owned = function (id) { return has(run, id); };
      // a unit's relic only when the army has such a unit
      var fitsArmy = function (id) { var u = RELICS[id].units; return !u || run.army.some(function (x) { return u.indexOf(x[1].toLowerCase()) >= 0; }); };
      var normal = Object.keys(RELICS).filter(function (id) { return !RELICS[id].premium && !RELICS[id].start && !owned(id) && fitsArmy(id); });
      var prem = Object.keys(RELICS).filter(function (id) { return RELICS[id].premium && !owned(id); });
      var rel = [];
      if (run.ticket) {
        while (rel.length < Math.min(3, prem.length)) { var t = r.pick(prem); if (rel.every(function (x) { return x.id !== t; })) rel.push({ id: t, price: 0 }); }
        run.ticket = false;
      } else {
        while (rel.length < Math.min(2, normal.length)) { var u = r.pick(normal); if (rel.every(function (x) { return x.id !== u; })) rel.push({ id: u, price: 0 }); }
        if (prem.length) { var pr = r.pick(prem); rel.push({ id: pr, price: PREMIUM_PRICE[pr] }); }
      }
      out = rel.length ? { kind: 'ruins', offers: rel } : { kind: 'gold', gold350: true };
    } else if (b.type === 'shop') {
      var ids = ITEM_IDS.slice(), shop = [];
      while (shop.length < 3) { var it = r.pick(ids); ids.splice(ids.indexOf(it), 1); shop.push({ id: it, qty: ITEMS[it].qty, price: itemPrice(run, it, r), sold: false }); }
      out = { kind: 'shop', offers: shop };
    } else if (b.type === 'obelisk') {
      // what can be given up: a unit (not the King) for one of two tier 3 units, a relic that is not premium (nor one of
      // the starting four) for one of two premium relics, or all gold and Rewinds for a premium relic
      var tier3 = TIER3.slice(), u3 = [];
      while (u3.length < 2) { var x3 = r.pick(tier3); tier3.splice(tier3.indexOf(x3), 1); u3.push(x3.toUpperCase()); }
      var premLeft = Object.keys(RELICS).filter(function (id) { return RELICS[id].premium && !has(run, id); }), p2 = [];
      while (p2.length < Math.min(2, premLeft.length)) { var pp = r.pick(premLeft); premLeft.splice(premLeft.indexOf(pp), 1); p2.push(pp); }
      out = { kind: 'obelisk', units: u3, relics: p2, step: null };
    }
    if (out && out.gold350) { run.gold += 350; out.gold = 0; out.instead = 350; }
    run.rng = r.s;
    return out;
  }
  function relicGained(run, id) {
    run.relics.push(id);
    var r = rng(run.rng);
    if (id === 'goldbar') run.gold += 500;
    if (id === 'backpack') { run.rewinds += 2; run.gold += 200; addItem(run, r.pick(ITEM_IDS.filter(function (x) { return x !== 'rewind'; }))); }
    if (id === 'chest') for (var i = 0; i < 3; i++) addItem(run, r.pick(ITEM_IDS));
    if (id === 'ticket') run.ticket = true;
    run.rng = r.s;
  }
  // Taking offer i of the reward. Returns false when it cannot be taken (not enough gold, no room).
  function take(run, i, arg) {
    var rw = run.reward;
    if (!rw) return false;
    if (rw.kind === 'recruit') {
      var o = rw.offers[i];
      if (!o || run.gold < o.price || !freeCells(run, o.l).length) return false;
      run.edit = { kind: 'place', piece: o.l, price: o.price, reward: rw };
      run.reward = null;
      return true;
    }
    if (rw.kind === 'upgrade') {
      var u = rw.offers[i], x = u && run.army.find(function (a) { return a[0] === u.at && a[1] === u.from; });
      if (!x) return false;
      x[1] = u.to;
      run.reward = null;
      return true;
    }
    if (rw.kind === 'ruins') {
      var rl = rw.offers[i];
      if (!rl || run.gold < rl.price) return false;
      run.gold -= rl.price;
      relicGained(run, rl.id);
      run.reward = null;
      return true;
    }
    if (rw.kind === 'shop') {
      var it = rw.offers[i];
      if (!it || it.sold || run.gold < it.price) return false;
      run.gold -= it.price;
      addItem(run, it.id, it.qty);
      it.sold = true;
      return true; // the shop stays open until it is left
    }
    if (rw.kind === 'obelisk') {
      // arg: { give: 'unit', at, get: letter } | { give: 'relic', id, get: relic } | { give: 'all', get: relic }
      if (!arg) return false;
      if (arg.give === 'unit') {
        var gx = run.army.find(function (a) { return a[0] === arg.at; });
        if (!gx || R.isRoyal(gx[1]) || rw.units.indexOf(arg.get) < 0) return false;
        if (!fits(arg.get, gx[0])) return false;
        gx[1] = arg.get;
      } else if (arg.give === 'relic') {
        if (!has(run, arg.id) || RELICS[arg.id].premium || rw.relics.indexOf(arg.get) < 0) return false;
        run.relics.splice(run.relics.indexOf(arg.id), 1);
        relicGained(run, arg.get);
      } else if (arg.give === 'all') {
        if (rw.relics.indexOf(arg.get) < 0) return false;
        run.gold = 0; run.rewinds = 0;
        relicGained(run, arg.get);
      } else return false;
      run.reward = null;
      return true;
    }
    return false;
  }
  // Leaving a reward (any can be skipped), or the gold of a boss seen: on to the map (the next act after a boss).
  function leave(run) {
    var rw = run.reward;
    if (!rw) return false;
    run.reward = null;
    if (rw.boss && !rw.last) nextAct(run);
    return true;
  }
  function placeRecruit(run, at) {
    if (!run.edit || run.edit.kind !== 'place' || freeCells(run, run.edit.piece).indexOf(at) < 0 || run.gold < run.edit.price) return false;
    run.gold -= run.edit.price;
    run.army.push([at, run.edit.piece]);
    run.edit = null;
    return true;
  }
  function cancelPlace(run) {
    if (!run.edit || run.edit.kind !== 'place') return false;
    run.reward = run.edit.reward;
    run.edit = null;
    return true;
  }
  // A Sand hourglass: the same place's battle dealt again (the positions and the terrain may differ).
  function restart(run, used) { if (!run.battle) return false; consume(run, used); run.battle = dealBattle(run, run.battle.id); return true; }
  // the items a battle used up
  function consume(run, used) { Object.keys(used || {}).forEach(function (k) { if (run.items[k]) { run.items[k] = Math.max(0, run.items[k] - used[k]); if (!run.items[k]) delete run.items[k]; } }); }
  function useRewind(run) { if (run.rewinds <= 0) return false; run.rewinds--; return true; }

  var api = {
    VERSION: VERSION, ACTS: ACTS, PLACES: PLACES, RELICS: RELICS, ITEMS: ITEMS, ITEM_IDS: ITEM_IDS, CELLS: CELLS, RECRUITS: RECRUITS, POOLS: POOLS, POINTS: POINTS, UPGRADE: UPGRADE, TIER2: TIER2, TIER3: TIER3,
    rng: rng, genMap: genMap, place: place, options: options, newRun: newRun, fromOld: fromOld, startOk: startOk, startOffer: startOffer, startArmy: startArmy,
    travel: travel, dealBattle: dealBattle, battleFlags: battleFlags, RULE_RELICS: RULE_RELICS, battleFen: battleFen, battleCfg: battleCfg, rewardAfter: rewardAfter, settle: settle, nextAct: nextAct,
    take: take, leave: leave, restart: restart, placeRecruit: placeRecruit, cancelPlace: cancelPlace, freeCells: freeCells, movePiece: movePiece, fits: fits, useRewind: useRewind,
    has: has, addItem: addItem, upgradeOf: upgradeOf, downgradeOf: downgradeOf, points: points, title: title, tierOf: tierOf, unitPrice: unitPrice, sq: sq, sqName: sqName, shifted: shifted, GLASS: GLASS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ouro = api;
})(typeof self !== 'undefined' ? self : this);
