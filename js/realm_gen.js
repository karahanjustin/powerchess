/* The Ninth Rank: the worlds. Four kinds of world, each 96 x 96 squares in nine lands of 32 x 32, built from a
   seed and a rank: the Kingdom (meadows, fields, steppe, woods, rivers, walls, a lake, ash and the court), the
   Frostmarch (snow, ice that you slide on, frozen fords, hot springs, blizzards), the Shattered Sea (islands,
   bridges, reefs, a volcano) and the Catacombs (tunnels, vaults, a cistern, a furnace). Every world has roads to
   every land, the castles of seven wardens, the gated court of the Grand Queen, shrines, cages, chests, monoliths,
   portals, and the camps of the enemies with their patrols. No page code: node-testable with the rules. */
(function (root) {
  'use strict';
  var W = 96, H = 96, N = W * H, RS = 32;
  var idx = function (x, y) { return y * W + x; };
  var inside = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H; };
  // the kinds of square (the rules' BLOCK set says which cannot be entered)
  var KIND = { ground: 0, water: 1, lava: 2, tree: 3, rock: 4, road: 5, arena: 6, promo: 7, bridge: 8, portal: 9, shrine: 10, cage: 11, chest: 12, monolith: 13, gate: 14, dais: 15, pillar: 16, ice: 17, campfire: 18, tent: 19, torch: 20, spring: 21, sand: 22 };
  var KNAME = []; Object.keys(KIND).forEach(function (k) { KNAME[KIND[k]] = k; });
  var BLOCK = {}; [KIND.water, KIND.lava, KIND.tree, KIND.rock, KIND.monolith, KIND.gate, KIND.pillar, KIND.tent, KIND.torch].forEach(function (k) { BLOCK[k] = true; });
  var WALK = {}; [KIND.ground, KIND.road, KIND.arena, KIND.promo, KIND.bridge, KIND.dais, KIND.ice, KIND.sand, KIND.campfire, KIND.spring].forEach(function (k) { WALK[k] = true; }); // plain ground for placing things and walking patrols
  var ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]], ALL8 = ORTH.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  var regionOf = function (x, y) { return Math.floor(y / RS) * 3 + Math.floor(x / RS); };
  var regionDiff = function (r) { return (r % 3) + Math.floor(r / 3); };

  function rng(seed) {
    var st = { s: seed >>> 0 };
    st.next = function () { st.s = (st.s + 0x6D2B79F5) >>> 0; var t = st.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    st.int = function (n) { return Math.floor(st.next() * n); };
    st.pick = function (a) { return a[st.int(a.length)]; };
    st.shuffle = function (a) { for (var i = a.length - 1; i > 0; i--) { var j = st.int(i + 1), x = a[i]; a[i] = a[j]; a[j] = x; } return a; };
    return st;
  }
  function noise2(seed) {
    var h = function (x, y) { var n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    var sm = function (t) { return t * t * (3 - 2 * t); };
    return function (x, y) { var x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0); var a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1); return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy; };
  }

  /* ---------- the biomes: how a land is painted ----------
     hills: 0 flat, 1 rolling, 2 hilly, 3 mountainous. tree/rock/water/lava/ice: the noise above which that square is
     that. snow and sand colour the ground. cold: the King loses warmth here. light/dark: the two colours of the
     squares. mood: the music. */
  var BIOMES = {
    meadow: { hills: 1, tree: 0.82, light: 0xdad2b4, dark: 0x6f8a62, mood: 'meadow' },
    fields: { hills: 1, tree: 0.9, light: 0xe6d8a8, dark: 0x9a8a4a, mood: 'fields' },
    steppe: { hills: 3, rock: 0.86, light: 0xd4ceb0, dark: 0x7f8f5a, mood: 'steppe' },
    woods: { hills: 1, tree: 0.56, light: 0xb8c4a0, dark: 0x3f6a4a, mood: 'woods' },
    crossing: { hills: 1, tree: 0.88, light: 0xcfd4c8, dark: 0x5f7f7a, mood: 'crossing', rivers: 'water' },
    walls: { hills: 1, rock: 0.9, light: 0xc4c2c6, dark: 0x6a6a72, mood: 'walls', maze: 1 },
    lake: { hills: 1, water: 0.42, light: 0xc8d8dc, dark: 0x4f7a8a, mood: 'lake' },
    ashen: { hills: 2, lava: 0.74, rock: 0.84, light: 0xb0a098, dark: 0x5a4a4a, mood: 'ashen', hot: true },
    court: { hills: 0, light: 0xbeb6cc, dark: 0x4a4458, mood: 'court' },
    // the Frostmarch
    tundra: { hills: 1, tree: 0.86, snow: true, cold: true, light: 0xe8eef4, dark: 0x9fb4c4, mood: 'frost' },
    snowfields: { hills: 1, tree: 0.92, snow: true, cold: true, light: 0xeef2f6, dark: 0xb4c2cc, mood: 'fields' },
    glacier: { hills: 3, ice: 0.58, rock: 0.9, snow: true, cold: true, light: 0xdbe8f2, dark: 0x8fb0c8, mood: 'frost' },
    pines: { hills: 1, tree: 0.6, snow: true, cold: true, light: 0xd4dee0, dark: 0x4e7a6a, mood: 'woods' },
    fords: { hills: 1, tree: 0.9, snow: true, cold: true, light: 0xdfe8ec, dark: 0x7f9faa, mood: 'crossing', rivers: 'ice' },
    glass: { hills: 1, ice: 0.5, snow: true, cold: true, light: 0xd8e4ee, dark: 0x8a9ab0, mood: 'walls', maze: 1 },
    frozen: { hills: 0, water: 0.42, frozenWater: true, snow: true, cold: true, light: 0xd8e6ee, dark: 0x6f98b0, mood: 'lake' },
    springs: { hills: 2, spring: 0.8, rock: 0.86, snow: true, light: 0xdcd6cc, dark: 0x7a8a7a, mood: 'ashen', warm: true },
    icecourt: { hills: 0, snow: true, cold: true, light: 0xd4dcec, dark: 0x4c4a68, mood: 'court' },
    // the Shattered Sea
    shore: { hills: 1, sea: 0.36, tree: 0.86, sand: true, light: 0xe8dcb0, dark: 0x9aa070, mood: 'meadow' },
    shoals: { hills: 0, sea: 0.4, sand: true, light: 0xeadfae, dark: 0xb0a868, mood: 'fields' },
    dunes: { hills: 3, sea: 0.3, sand: true, light: 0xe4d4a0, dark: 0xa89060, mood: 'steppe' },
    palms: { hills: 1, sea: 0.36, tree: 0.55, sand: true, light: 0xd6d4a4, dark: 0x4c8a5a, mood: 'woods' },
    reef: { hills: 0, sea: 0.52, sand: true, light: 0xd0dcc8, dark: 0x4f8a9a, mood: 'crossing' },
    jetties: { hills: 0, sea: 0.46, rock: 0.9, sand: true, light: 0xcac2b0, dark: 0x6a6a72, mood: 'walls', maze: 1 },
    lagoon: { hills: 0, sea: 0.5, sand: true, light: 0xc8e0dc, dark: 0x3f8a9a, mood: 'lake' },
    volcano: { hills: 3, lava: 0.72, rock: 0.84, light: 0xa09890, dark: 0x4a3a3a, mood: 'ashen', hot: true },
    seacourt: { hills: 0, light: 0xc0c8d0, dark: 0x3a4a60, mood: 'court' },
    // the Catacombs
    crypt: { hills: 0, rock: 0.62, dark: 0x3a3a46, light: 0x8a8690, mood: 'deep', dim: true },
    ossuary: { hills: 0, rock: 0.66, dark: 0x4a4440, light: 0x9a9080, mood: 'fields', dim: true },
    tunnels: { hills: 2, rock: 0.56, dark: 0x3a3a3a, light: 0x7a7a74, mood: 'steppe', dim: true },
    roots: { hills: 0, tree: 0.6, rock: 0.84, dark: 0x2f4a3a, light: 0x7a8a70, mood: 'woods', dim: true },
    cistern: { hills: 0, rock: 0.7, dark: 0x2f4a5a, light: 0x7a9aa0, mood: 'crossing', rivers: 'water', dim: true },
    vaults: { hills: 0, rock: 0.8, dark: 0x44404a, light: 0x8a868c, mood: 'walls', maze: 2, dim: true },
    blackpool: { hills: 0, water: 0.44, rock: 0.78, dark: 0x1f2a3a, light: 0x5a6a7a, mood: 'lake', dim: true },
    furnace: { hills: 1, lava: 0.68, rock: 0.8, dark: 0x4a2a22, light: 0x9a7060, mood: 'ashen', hot: true, dim: true },
    deepcourt: { hills: 0, dark: 0x2a2434, light: 0x8a7a9a, mood: 'court', dim: true }
  };

  /* ---------- the kinds of world ----------
     Nine lands each; land 1 is always where the pawns march to their golden column, land 4 the crossing, land 5
     the maze, land 6 the lake with the portals, land 7 the hot land, land 8 the court. count: P N B R Q. */
  var KINDS = {
    kingdom: { name: 'The Kingdom', court: 'The Ninth Rank', cold: false,
      regions: [
        { name: 'The First Rank', line: 'Where the board begins.', biome: 'meadow', pawnDir: [0, -1], count: [6, 2, 0, 0, 0] },
        { name: 'The Pawn Fields', line: 'They march west. Stop them before the golden column.', biome: 'fields', pawnDir: [-1, 0], count: [12, 2, 1, 0, 0] },
        { name: 'The Knight Steppe', line: 'Hills, and hooves in the grass.', biome: 'steppe', pawnDir: [-1, 0], count: [4, 7, 1, 1, 0] },
        { name: 'The Bishop Woods', line: 'Long shadows on the long diagonals.', biome: 'woods', pawnDir: [0, -1], count: [4, 2, 7, 0, 0] },
        { name: 'The Crossing', line: 'Three rivers, four bridges, no quarter.', biome: 'crossing', pawnDir: [-1, 0], count: [6, 4, 4, 3, 0] },
        { name: 'The Rook Walls', line: 'Straight lines. Straight deaths.', biome: 'walls', pawnDir: [-1, 0], count: [4, 2, 2, 7, 1] },
        { name: 'The Mirror Lake', line: 'What the water shows is not where it is.', biome: 'lake', pawnDir: [0, -1], count: [3, 3, 6, 2, 2] },
        { name: 'The Ashen Keep', line: 'The ground remembers fire.', biome: 'ashen', pawnDir: [-1, 0], count: [5, 6, 3, 6, 2] },
        { name: 'The Ninth Rank', line: 'Beyond the edge of every board.', biome: 'court', pawnDir: [-1, 0], count: [0, 0, 0, 0, 0] }],
      wardens: ['The Pawn Captain', 'The Horse Lord', 'The Twin Mitres', 'The Ferryman', 'The Wall Warden', 'The Mirror Queen', 'The Ash King'], grand: 'The Grand Queen',
      monoliths: ['You are the last King. The others are gone, their crowns carried east. Walk. The board is wider than eight files.', 'Pawns do not stop. They march, and at the golden column they become queens. Count them.', 'The knights of the steppe fear no hill. The hills will not save you from them.', 'In the woods the bishops wait where the trees leave a diagonal open. Walk the straight paths.', 'The Ferryman charges in crowns. He has not been paid in years.', 'The walls were built to stop rooks. The rooks learned to use them.', 'Two portals, one lake. Step into one and the other lets you out.', 'The Ash King burned his own court to keep it. He will burn yours.', 'There is no tenth rank. Whoever holds the ninth holds everything.'] },
    frostmarch: { name: 'The Frostmarch', court: 'The Ice Court', cold: true,
      regions: [
        { name: 'The White Tundra', line: 'Snow to every horizon. Keep to the fires.', biome: 'tundra', pawnDir: [0, -1], count: [6, 2, 1, 0, 0] },
        { name: 'The Snowfields', line: 'They march west through the drifts.', biome: 'snowfields', pawnDir: [-1, 0], count: [12, 2, 1, 0, 0] },
        { name: 'The Glacier', line: 'Ice underfoot. A step becomes a slide.', biome: 'glacier', pawnDir: [-1, 0], count: [3, 7, 1, 2, 0] },
        { name: 'The Black Pines', line: 'The snow muffles the bishops\' steps.', biome: 'pines', pawnDir: [0, -1], count: [4, 2, 7, 0, 0] },
        { name: 'The Frozen Fords', line: 'The rivers stand still. You will not.', biome: 'fords', pawnDir: [-1, 0], count: [6, 4, 4, 3, 0] },
        { name: 'The Glass Walls', line: 'Walls of ice, and the rooks between them.', biome: 'glass', pawnDir: [-1, 0], count: [4, 2, 2, 7, 1] },
        { name: 'The Frozen Lake', line: 'The ice holds. Mostly.', biome: 'frozen', pawnDir: [0, -1], count: [3, 3, 6, 2, 2] },
        { name: 'The Hot Springs', line: 'Warm ground, at last. The Steam Queen knows it too.', biome: 'springs', pawnDir: [-1, 0], count: [5, 6, 3, 6, 2] },
        { name: 'The Ice Court', line: 'Where the cold is kept.', biome: 'icecourt', pawnDir: [-1, 0], count: [0, 0, 0, 0, 0] }],
      wardens: ['The Snow Captain', 'The Rime Lord', 'The Pale Mitres', 'The Ford Keeper', 'The Glass Warden', 'The Frozen Queen', 'The Steam King'], grand: 'The Winter Queen',
      monoliths: ['The cold takes warmth before it takes hearts. A fire gives it back. Stand close.', 'On the snowfields the pawns promote the same as anywhere. The snow hides their count.', 'Step onto ice and you slide until something stops you. An enemy stops you. So does a wall.', 'Under the pines the dark comes early. The bishops like it.', 'The fords are ice. Cross them in one slide and the rooks never get a shot.', 'Glass walls, glass floor. Every slide here goes further than you meant it to.', 'The lake is frozen. The holes are not. Watch the dark squares.', 'The springs are warm. Rest here before the court.', 'The Winter Queen does not move. The cold moves for her.'] },
    sea: { name: 'The Shattered Sea', court: 'The Drowned Court', cold: false,
      regions: [
        { name: 'The Landing', line: 'Sand, salt, and the first footprints.', biome: 'shore', pawnDir: [0, -1], count: [6, 2, 1, 0, 0] },
        { name: 'The Shoals', line: 'They wade west to the golden column.', biome: 'shoals', pawnDir: [-1, 0], count: [12, 2, 1, 0, 0] },
        { name: 'The Dunes', line: 'Knights on the ridges.', biome: 'dunes', pawnDir: [-1, 0], count: [4, 7, 1, 1, 0] },
        { name: 'The Palm Isles', line: 'Shade, and the bishops in it.', biome: 'palms', pawnDir: [0, -1], count: [4, 2, 7, 0, 0] },
        { name: 'The Reef', line: 'Bridges over bright water. Nowhere to hide.', biome: 'reef', pawnDir: [-1, 0], count: [6, 4, 4, 3, 0] },
        { name: 'The Jetties', line: 'Piers and breakwaters, and the rooks that walk them.', biome: 'jetties', pawnDir: [-1, 0], count: [4, 2, 2, 7, 1] },
        { name: 'The Lagoon', line: 'Still water, and doors in it.', biome: 'lagoon', pawnDir: [0, -1], count: [3, 3, 6, 2, 2] },
        { name: 'The Volcano', line: 'The island that made the others.', biome: 'volcano', pawnDir: [-1, 0], count: [5, 6, 3, 6, 2] },
        { name: 'The Drowned Court', line: 'Below the tide line.', biome: 'seacourt', pawnDir: [-1, 0], count: [0, 0, 0, 0, 0] }],
      wardens: ['The Tide Captain', 'The Dune Lord', 'The Salt Mitres', 'The Reef Warden', 'The Harbour Master', 'The Lagoon Queen', 'The Cinder King'], grand: 'The Drowned Queen',
      monoliths: ['Every island has a bridge. Every bridge has a rook at the end of it.', 'The shoals are shallow. The pawns do not mind.', 'From the dunes the knights see you coming. From the dunes you see them too.', 'Palms break the diagonals. Bishops hate palms.', 'The reef bridges are one square wide. A rook on a bridge owns it.', 'Walk the piers. The water does not want you.', 'The lagoon doors lead to the lagoon. Mostly.', 'The Cinder King sleeps in the mountain. Tread softly, or do not.', 'The sea took the court. The Drowned Queen kept the throne.'] },
    catacombs: { name: 'The Catacombs', court: 'The Deep Court', cold: false,
      regions: [
        { name: 'The Crypt Stairs', line: 'Down, and the light stays behind.', biome: 'crypt', pawnDir: [0, -1], count: [6, 2, 1, 0, 0] },
        { name: 'The Ossuary', line: 'Bones in rows. They still march.', biome: 'ossuary', pawnDir: [-1, 0], count: [12, 2, 1, 0, 0] },
        { name: 'The Tunnels', line: 'Hooves echo. You cannot tell from where.', biome: 'tunnels', pawnDir: [-1, 0], count: [4, 7, 1, 1, 0] },
        { name: 'The Root Cellars', line: 'The forest above sends its roots down. The bishops wait among them.', biome: 'roots', pawnDir: [0, -1], count: [4, 2, 7, 0, 0] },
        { name: 'The Cistern', line: 'Black water in stone channels.', biome: 'cistern', pawnDir: [-1, 0], count: [6, 4, 4, 3, 0] },
        { name: 'The Vaults', line: 'Every corridor a file. Every file a rook.', biome: 'vaults', pawnDir: [-1, 0], count: [4, 2, 2, 7, 1] },
        { name: 'The Black Pool', line: 'Do not drink.', biome: 'blackpool', pawnDir: [0, -1], count: [3, 3, 6, 2, 2] },
        { name: 'The Furnace', line: 'Somebody keeps it lit.', biome: 'furnace', pawnDir: [-1, 0], count: [5, 6, 3, 6, 2] },
        { name: 'The Deep Court', line: 'The bottom of everything.', biome: 'deepcourt', pawnDir: [-1, 0], count: [0, 0, 0, 0, 0] }],
      wardens: ['The Bone Captain', 'The Tunnel Lord', 'The Blind Mitres', 'The Cistern Keeper', 'The Vault Warden', 'The Pool Queen', 'The Furnace King'], grand: 'The Queen Below',
      monoliths: ['The torches are the only warmth down here, and the only light. The camps keep them.', 'The ossuary pawns were buried standing. They march anyway.', 'The tunnels bend. A knight does not care.', 'The roots open diagonals where the stone does not.', 'The cistern channels are straight. Rooks swim.', 'The vaults are a grid. You are the only thing in them that is not.', 'The pool is deeper than the catacombs.', 'The Furnace King feeds it crowns.', 'The Queen Below has never seen the sky. She does not miss it.'] }
  };
  var KIND_ORDER = ['kingdom', 'frostmarch', 'sea', 'catacombs'];
  function kindForRank(rank) { return KIND_ORDER[((rank || 1) - 1) % KIND_ORDER.length]; }

  /* ---------- building ---------- */
  function build(seed, rank, kindName, mods, diff) {
    rank = rank || 1;
    kindName = kindName || kindForRank(rank);
    var kind = KINDS[kindName], regions = kind.regions.map(function (rg, i) { var b = BIOMES[rg.biome]; return { id: i, name: rg.name, line: rg.line, biome: rg.biome, pawnDir: rg.pawnDir, count: rg.count, mood: b.mood, cold: !!b.cold, warm: !!b.warm, dim: !!b.dim, hot: !!b.hot }; });
    mods = mods || []; diff = diff || { enemies: 1, wardenHp: 3, grandHp: 5, camps: 2, elite: 0 };
    var has = function (m) { return mods.indexOf(m) >= 0; };
    var r = rng(seed), noise = noise2(seed), n2 = noise2(seed + 77), n3 = noise2(seed + 919);
    var h = new Uint8Array(N), k = new Uint8Array(N), ents = [], objs = {}, portals = {}, nextId = 1;
    var set = function (x, y, kk, hh) { if (!inside(x, y)) return; var i = idx(x, y); k[i] = kk; if (hh != null) h[i] = hh; };
    var rect = function (x0, y0, x1, y1, kk, hh) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) set(x, y, kk, hh); };
    // the ground
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var rg = regions[regionOf(x, y)], b = BIOMES[rg.biome], i = idx(x, y);
      var v = noise(x / 9, y / 9) * 0.6 + noise(x / 3.5, y / 3.5) * 0.4, w = n2(x / 7, y / 7), u = n3(x / 5, y / 5);
      var lvl = b.hills === 3 ? Math.min(3, Math.floor(v * 4.6)) : b.hills === 2 ? Math.min(3, Math.floor(v * 3.6)) : b.hills === 1 ? Math.min(2, Math.floor(v * 3)) : (v > 0.78 ? 1 : 0);
      h[i] = lvl; k[i] = b.sand ? KIND.sand : KIND.ground;
      if (b.sea != null && v < b.sea) { k[i] = KIND.water; h[i] = 0; }
      if (b.water != null && v < b.water) { k[i] = b.frozenWater ? (u > 0.86 ? KIND.water : KIND.ice) : KIND.water; h[i] = 0; }
      if (b.tree != null && w > b.tree && v < 0.75 && k[i] !== KIND.water) k[i] = KIND.tree;
      if (b.rock != null && w > b.rock && k[i] !== KIND.water) k[i] = KIND.rock;
      if (b.rock != null && b.rock < 0.7 && u > b.rock + 0.1 && k[i] !== KIND.water) k[i] = KIND.rock; // the catacombs: stone in two grains
      if (b.lava != null && u > b.lava) { k[i] = KIND.lava; h[i] = 0; }
      if (b.ice != null && w > b.ice && k[i] !== KIND.water && k[i] !== KIND.rock) k[i] = KIND.ice;
      if (b.spring != null && u > b.spring && k[i] !== KIND.rock) k[i] = KIND.spring;
    }
    // the crossing (land 4): three rivers north to south, of water or ice
    var riverKind = BIOMES[regions[4].biome].rivers === 'ice' ? KIND.ice : KIND.water;
    for (var ry = 32; ry < 64; ry++) [40, 48, 56].forEach(function (cx, ii) { var xx = cx + Math.round(Math.sin(ry / 6 + ii) * 2); set(xx, ry, riverKind, 0); set(xx + 1, ry, riverKind, 0); });
    // the maze (land 5): straight walls, denser in the vaults
    var mz = BIOMES[regions[5].biome].maze || 1;
    for (var wy = 33; wy < 63; wy += mz === 2 ? 3 : 4) for (var wx = 65; wx < 95; wx++) if (((wx + wy * 3) % 11) < 7 && r.next() < 0.85) set(wx, wy, KIND.rock, h[idx(wx, wy)]);
    for (var wx2 = 67; wx2 < 95; wx2 += mz === 2 ? 5 : 6) for (var wy2 = 32; wy2 < 64; wy2++) if (((wy2 + wx2) % 9) < 5 && r.next() < 0.7) set(wx2, wy2, KIND.rock, h[idx(wx2, wy2)]);
    // the pawn land (1): fences and the golden column
    for (var fy = 2; fy < 30; fy += 6) for (var fx = 36; fx < 62; fx++) if (r.next() < 0.6) set(fx, fy, KIND.rock, h[idx(fx, fy)]);
    for (var py = 1; py < 31; py++) set(33, py, KIND.promo, 0);
    // the roads: start to each land's centre, centre to centre, ramped, bridged over water and lava
    var centres = regions.map(function (rr) { return [(rr.id % 3) * RS + 16, Math.floor(rr.id / 3) * RS + 16]; });
    centres[8] = [67, 80];
    function road(ax, ay, bx, by) {
      var x = ax, y = ay, last = h[idx(ax, ay)];
      var lay = function () { for (var dx = 0; dx < 2; dx++) for (var dy = 0; dy < 2; dy++) { if (!inside(x + dx, y + dy)) continue; var i = idx(x + dx, y + dy); var hh = h[i]; if (hh > last + 1) hh = last + 1; if (hh < last - 1) hh = last - 1; var wet = k[i] === KIND.water || k[i] === KIND.lava || k[i] === KIND.bridge; k[i] = wet ? KIND.bridge : KIND.road; h[i] = wet ? 0 : hh; last = h[i]; } };
      lay();
      while (x !== bx) { x += bx > x ? 1 : -1; lay(); }
      while (y !== by) { y += by > y ? 1 : -1; lay(); }
    }
    road(6, 6, centres[0][0], centres[0][1]);
    [[0, 1], [1, 2], [0, 3], [3, 4], [1, 4], [4, 5], [2, 5], [3, 6], [6, 7], [4, 7], [7, 8], [5, 8]].forEach(function (e) { road(centres[e[0]][0], centres[e[0]][1], centres[e[1]][0], centres[e[1]][1]); });
    // the start clearing, with a fire
    rect(3, 3, 10, 10, KIND.ground, 0);
    rect(5, 5, 7, 7, KIND.road, 0);
    var sx = 6, sy = 6;
    // the castles of the wardens (lands 1..7)
    var castles = {}, occupied = {};
    for (var cr = 1; cr <= 7; cr++) {
      var cx = centres[cr][0] + (cr % 2 ? 7 : -7), cy = centres[cr][1] + (cr < 4 ? 7 : -7);
      rect(cx - 6, cy - 6, cx + 6, cy + 6, KIND.ground, 0);
      rect(cx - 5, cy - 5, cx + 5, cy + 5, KIND.rock, 2);
      rect(cx - 4, cy - 4, cx + 4, cy + 4, KIND.arena, 0);
      var gx = cx + (cr % 2 ? -5 : 5), gy = cy;
      set(gx, gy, KIND.arena, 0); set(gx + (cr % 2 ? -1 : 1), gy, KIND.road, 0);
      road(centres[cr][0], centres[cr][1], gx + (cr % 2 ? -2 : 2), gy);
      set(gx, gy, KIND.arena, 0); set(gx + (cr % 2 ? -1 : 1), gy, KIND.road, 0);
      castles[cr] = { x: cx, y: cy, gate: [gx, gy], region: cr };
      ents.push({ id: nextId++, side: 'b', t: 'K', x: cx, y: cy, hp: diff.wardenHp + (has('iron') ? 1 : 0), warden: cr, name: kind.wardens[cr - 1], region: cr });
      [[cx - 2, cy - 2], [cx + 2, cy - 2], [cx, cy + 2]].forEach(function (g) { ents.push({ id: nextId++, side: 'b', t: r.pick(['N', 'B', 'R']), x: g[0], y: g[1], hp: 1, guard: cr, region: cr }); });
    }
    // the court (land 8)
    var qx = 80, qy = 80;
    rect(qx - 11, qy - 11, qx + 11, qy + 11, KIND.ground, 0);
    rect(qx - 10, qy - 10, qx + 10, qy + 10, KIND.rock, 3);
    rect(qx - 9, qy - 9, qx + 9, qy + 9, KIND.arena, 0);
    for (var px = -6; px <= 6; px += 4) for (var pyy = -6; pyy <= 6; pyy += 4) if (Math.abs(px) + Math.abs(pyy) > 4) set(qx + px, qy + pyy, KIND.pillar, 3);
    rect(qx - 2, qy - 2, qx + 2, qy + 2, KIND.dais, 1);
    set(qx - 10, qy, KIND.gate, 3); set(qx - 10, qy + 1, KIND.gate, 3);
    rect(qx - 12, qy, qx - 11, qy + 1, KIND.road, 0);
    ents.push({ id: nextId++, side: 'b', t: 'A', x: qx, y: qy, hp: diff.grandHp + (has('iron') ? 1 : 0), grand: true, name: kind.grand, region: 8 });
    [['R', -8, -8], ['R', 8, -8], ['R', -8, 8], ['R', 8, 8], ['B', -4, 0], ['B', 4, 0], ['B', 0, -4], ['B', 0, 4], ['N', -3, -3], ['N', 3, 3]].forEach(function (g) { ents.push({ id: nextId++, side: 'b', t: g[0], x: qx + g[1], y: qy + g[2], hp: 1, guard: 8, region: 8 }); });
    for (var pp = -8; pp <= 8; pp += 2) ents.push({ id: nextId++, side: 'b', t: 'P', x: qx - 8, y: qy + pp, hp: 1, guard: 8, region: 8, dir: [-1, 0] });
    castles[8] = { x: qx, y: qy, gate: [qx - 10, qy], region: 8, court: true };
    ents.forEach(function (e) { occupied[idx(e.x, e.y)] = true; });
    // the free squares of a land
    function freeSpots(reg, avoidCastle) {
      var out = [];
      for (var yy = Math.floor(reg / 3) * RS; yy < Math.floor(reg / 3) * RS + RS; yy++) for (var xx = (reg % 3) * RS; xx < (reg % 3) * RS + RS; xx++) {
        var i = idx(xx, yy);
        if (k[i] !== KIND.ground && k[i] !== KIND.road && k[i] !== KIND.sand) continue;
        if (occupied[i]) continue;
        if (reg === 0 && Math.max(Math.abs(xx - sx), Math.abs(yy - sy)) <= 9) continue;
        if (avoidCastle && castles[reg] && Math.abs(xx - castles[reg].x) <= 7 && Math.abs(yy - castles[reg].y) <= 7) continue;
        out.push([xx, yy]);
      }
      return r.shuffle(out);
    }
    function place(reg, kk, data) {
      var spots = freeSpots(reg, true);
      for (var i = 0; i < spots.length; i++) {
        var s = spots[i], ii = idx(s[0], s[1]);
        if (k[ii] === KIND.road) continue;
        var good = true;
        ORTH.forEach(function (d) { var j = inside(s[0] + d[0], s[1] + d[1]) ? idx(s[0] + d[0], s[1] + d[1]) : -1; if (j < 0 || BLOCK[k[j]] || occupied[j] || objs[j]) good = false; });
        if (!good) continue;
        k[ii] = kk; occupied[ii] = true;
        objs[ii] = Object.assign({ kind: KNAME[kk], x: s[0], y: s[1] }, data || {});
        return objs[ii];
      }
      return null;
    }
    // shrines, cages, chests, monoliths, portals
    for (var reg = 0; reg <= 8; reg++) {
      var nShrine = reg === 8 ? 0 : reg === 0 ? 1 : 2;
      for (var si = 0; si < nShrine; si++) place(reg, KIND.shrine, { shrine: reg * 10 + si });
      if (reg <= 7) place(reg, KIND.cage, { ally: reg === 0 ? 'N' : r.pick(reg >= 5 ? ['R', 'Q', 'B'] : ['N', 'B', 'R']) });
      if (reg <= 7) { place(reg, KIND.chest, { gift: regionDiff(reg) === 2 ? 'heart' : r.pick(['N', 'B', 'R', 'Q']) }); place(reg, KIND.chest, { gift: r.pick(['N', 'B', 'R', 'Q']) }); }
      if (reg >= 1) place(reg, KIND.monolith, { text: 'r' + reg });
    }
    set(8, 4, KIND.shrine, 0); objs[idx(8, 4)] = { kind: 'shrine', x: 8, y: 4, shrine: 1 };
    set(4, 8, KIND.monolith, 0); objs[idx(4, 8)] = { kind: 'monolith', x: 4, y: 8, text: 'm0' };
    set(9, 9, KIND.monolith, 0); objs[idx(9, 9)] = { kind: 'monolith', x: 9, y: 9, text: 'm1' };
    set(12, 6, KIND.monolith, 0); objs[idx(12, 6)] = { kind: 'monolith', x: 12, y: 6, text: 'r0' };
    set(6, 13, KIND.monolith, 0); objs[idx(6, 13)] = { kind: 'monolith', x: 6, y: 13, text: 'm3' };
    set(4, 4, KIND.campfire, 0); objs[idx(4, 4)] = { kind: 'campfire', x: 4, y: 4, lit: true };
    [[8, 4], [4, 8], [9, 9], [12, 6], [6, 13], [4, 4]].forEach(function (p) { occupied[idx(p[0], p[1])] = true; });
    [[6, 2], [4, 1]].forEach(function (pr) {
      for (var pi = 0; pi < pr[1]; pi++) {
        var a = place(pr[0], KIND.portal, { portal: true }), b2 = place(pr[0], KIND.portal, { portal: true });
        if (a && b2) { portals[idx(a.x, a.y)] = idx(b2.x, b2.y); portals[idx(b2.x, b2.y)] = idx(a.x, a.y); }
      }
    });
    // torches along the roads: light in the catacombs, warmth in the cold worlds
    if (kindName === 'catacombs' || kind.cold) for (var ti2 = 0; ti2 < N; ti2++) {
      if (k[ti2] !== KIND.road) continue;
      var txx = ti2 % W, tyy = Math.floor(ti2 / W);
      if ((txx * 7 + tyy * 13) % (kind.cold ? 11 : 23) !== 0) continue;
      var tj = inside(txx, tyy - 1) ? idx(txx, tyy - 1) : -1;
      if (tj < 0 || objs[tj] || occupied[tj]) continue;
      if (k[tj] === KIND.rock || k[tj] === KIND.ground || k[tj] === KIND.tree) { set(txx, tyy - 1, KIND.torch, h[ti2]); objs[tj] = { kind: 'torch', x: txx, y: tyy - 1 }; occupied[tj] = true; }
    }
    // the camps: a fire, tents, a torch, a locked chest, a captain and his band, one or two of them on patrol
    var camps = {}, campId = 1;
    function bfsPath(from, to, maxN) {
      var prev = new Int32Array(N).fill(-1), q = [idx(from[0], from[1])], seen = new Uint8Array(N), goal = idx(to[0], to[1]), n = 0;
      seen[q[0]] = 1;
      while (q.length && n++ < (maxN || 6000)) {
        var cur = q.shift(), cxq = cur % W, cyq = Math.floor(cur / W);
        if (cur === goal) { var path = []; for (var p = cur; p !== -1 && p !== q[0] && path.length < 200; p = prev[p]) { path.push([p % W, Math.floor(p / W)]); if (p === idx(from[0], from[1])) break; } return path.reverse(); }
        for (var di = 0; di < 4; di++) {
          var nx = cxq + ORTH[di][0], ny = cyq + ORTH[di][1];
          if (!inside(nx, ny)) continue;
          var ni = idx(nx, ny);
          if (seen[ni] || !WALK[k[ni]] || Math.abs(h[ni] - h[cur]) > 1 || k[ni] === KIND.arena) continue;
          seen[ni] = 1; prev[ni] = cur; q.push(ni);
        }
      }
      return null;
    }
    for (var creg = 1; creg <= 7; creg++) {
      var spots3 = freeSpots(creg, true), made = 0;
      for (var s3 = 0; s3 < spots3.length && made < diff.camps; s3++) {
        var c0 = spots3[s3], fine = true;
        // a clearing of 5 x 5 free, flat squares, off the roads
        for (var dy = -2; dy <= 2 && fine; dy++) for (var dx = -2; dx <= 2 && fine; dx++) { var ci = inside(c0[0] + dx, c0[1] + dy) ? idx(c0[0] + dx, c0[1] + dy) : -1; if (ci < 0 || occupied[ci] || objs[ci] || (k[ci] !== KIND.ground && k[ci] !== KIND.sand) || h[ci] !== h[idx(c0[0], c0[1])]) fine = false; }
        if (!fine) continue;
        var others = Object.keys(camps).some(function (cid) { var cc = camps[cid]; return Math.abs(cc.x - c0[0]) < 9 && Math.abs(cc.y - c0[1]) < 9; });
        if (others) continue;
        var id = campId++, cxx = c0[0], cyy = c0[1];
        set(cxx, cyy, KIND.campfire); objs[idx(cxx, cyy)] = { kind: 'campfire', x: cxx, y: cyy, camp: id, lit: true };
        var tents = [[-2, -1], [2, -1], [0, 2]], torchAt = [2, 2];
        tents.forEach(function (t) { set(cxx + t[0], cyy + t[1], KIND.tent); objs[idx(cxx + t[0], cyy + t[1])] = { kind: 'tent', x: cxx + t[0], y: cyy + t[1], camp: id }; occupied[idx(cxx + t[0], cyy + t[1])] = true; });
        set(cxx + torchAt[0], cyy + torchAt[1], KIND.torch); objs[idx(cxx + torchAt[0], cyy + torchAt[1])] = { kind: 'torch', x: cxx + torchAt[0], y: cyy + torchAt[1], camp: id }; occupied[idx(cxx + torchAt[0], cyy + torchAt[1])] = true;
        set(cxx - 2, cyy + 1, KIND.chest); objs[idx(cxx - 2, cyy + 1)] = { kind: 'chest', x: cxx - 2, y: cyy + 1, gift: 'camp', camp: id }; occupied[idx(cxx - 2, cyy + 1)] = true;
        occupied[idx(cxx, cyy)] = true;
        var captainT = creg <= 2 ? 'N' : creg <= 4 ? 'B' : 'R';
        var cap = { id: nextId++, side: 'b', t: captainT, x: cxx + 1, y: cyy, hp: 2, captain: id, camp: id, region: creg, name: 'Captain of the ' + regions[creg].name.replace(/^The /, '') };
        ents.push(cap); occupied[idx(cap.x, cap.y)] = true;
        var band = ['P', 'P', r.pick(['N', 'B']), r.pick(['P', 'R', 'N'])];
        if (rank >= 3) band.push(r.pick(['B', 'R', 'Q']));
        var seats = [[-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1], [0, -2]], members = [];
        band.forEach(function (t, bi) { var st = seats[bi]; if (!st) return; var ex = cxx + st[0], ey = cyy + st[1], ei = idx(ex, ey); if (occupied[ei] || BLOCK[k[ei]]) return; var m = { id: nextId++, side: 'b', t: t, x: ex, y: ey, hp: 1, camp: id, region: creg, dir: t === 'P' ? regions[creg].pawnDir.slice() : null }; ents.push(m); occupied[ei] = true; members.push(m); });
        camps[id] = { id: id, x: cxx, y: cyy, region: creg, captain: cap.id, name: cap.name, members: members.map(function (m) { return m.id; }) };
        made++;
      }
    }
    // the patrols, once every camp stands: one or two of a band walk a loop out towards the road and back
    Object.keys(camps).forEach(function (cid) {
      var cp = camps[cid], members = cp.members.map(function (mid) { return ents.filter(function (e) { return e.id === mid; })[0]; });
      var nPat = has('patrols') ? 2 : 1, walkers = members.filter(function (m) { return m.t !== 'P'; }).concat(members.filter(function (m) { return m.t === 'P'; }));
      for (var wi = 0; wi < nPat && wi < walkers.length; wi++) {
        var far = null;
        for (var tries = 0; tries < 40 && !far; tries++) { var ang = r.next() * Math.PI * 2, dd = 9 + r.int(7), tx = Math.round(cp.x + Math.cos(ang) * dd), ty = Math.round(cp.y + Math.sin(ang) * dd); if (inside(tx, ty) && WALK[k[idx(tx, ty)]] && k[idx(tx, ty)] !== KIND.arena && regionOf(tx, ty) === cp.region) far = [tx, ty]; }
        if (!far) continue;
        var pth = bfsPath([walkers[wi].x, walkers[wi].y], far, 4000);
        if (!pth || pth.length < 6) continue;
        var loop = pth.slice(1).concat(pth.slice(1, -1).reverse());
        walkers[wi].patrol = { route: loop, i: 0, home: [walkers[wi].x, walkers[wi].y] };
        walkers[wi].dir = null; // a pawn on patrol follows the route, not its march
      }
    });
    // the loose enemies of each land, in bands of two to four
    var TYPES = ['P', 'N', 'B', 'R', 'Q'];
    for (var er = 0; er <= 7; er++) {
      var cnt = regions[er].count, bag = [];
      TYPES.forEach(function (t, ti) { for (var c = 0; c < Math.round(cnt[ti] * diff.enemies); c++) bag.push(t); });
      r.shuffle(bag);
      var spots2 = freeSpots(er, true), si2 = 0;
      while (bag.length && si2 < spots2.length) {
        var camp = spots2[si2++], size = Math.min(bag.length, 2 + r.int(3));
        var around = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, 1], [1, -1]];
        for (var ci2 = 0; ci2 < around.length && size > 0; ci2++) {
          var ex = camp[0] + around[ci2][0], ey = camp[1] + around[ci2][1];
          if (!inside(ex, ey)) continue;
          var ei = idx(ex, ey);
          if (occupied[ei] || (k[ei] !== KIND.ground && k[ei] !== KIND.road && k[ei] !== KIND.sand)) continue;
          if (Math.max(Math.abs(ex - sx), Math.abs(ey - sy)) <= 9) continue;
          var t2 = bag.pop();
          var elite = er >= 1 && diff.elite > 0 && r.next() < diff.elite + (has('elite') ? 0.25 : 0);
          ents.push({ id: nextId++, side: 'b', t: t2, x: ex, y: ey, hp: elite ? 2 : 1, elite: elite || undefined, region: er, dir: t2 === 'P' ? regions[er].pawnDir.slice() : null });
          occupied[ei] = true; size--;
        }
      }
    }
    // everything must be reachable on foot from the start: what the noise cut off gets a way carved to it
    (function connect() {
      var seen = new Uint8Array(N), q = [idx(sx, sy)]; seen[q[0]] = 1;
      var pass = function (i) { return !BLOCK[k[i]]; };
      var flood = function () { while (q.length) { var cur = q.shift(), cx = cur % W, cy = Math.floor(cur / W); for (var di = 0; di < 8; di++) { var nx = cx + ALL8[di][0], ny = cy + ALL8[di][1]; if (!inside(nx, ny)) continue; var ni = idx(nx, ny); if (seen[ni] || !pass(ni) || Math.abs(h[ni] - h[cur]) > 1) continue; seen[ni] = 1; q.push(ni); } } };
      flood();
      var near = function (x, y) { return seen[idx(x, y)] || ORTH.some(function (d) { return inside(x + d[0], y + d[1]) && seen[idx(x + d[0], y + d[1])]; }); };
      var targets = Object.keys(objs).map(function (key) { return objs[key]; }).filter(function (o) { return o.kind !== 'tent' && o.kind !== 'torch'; });
      targets.forEach(function (o) {
        if (near(o.x, o.y)) return;
        // the nearest reached square, then a corridor to it, x first then y, through rock and trees, over water
        var best = null, bd = 1e9;
        for (var dy = -14; dy <= 14; dy++) for (var dx = -14; dx <= 14; dx++) { var x = o.x + dx, y = o.y + dy; if (!inside(x, y) || !seen[idx(x, y)]) continue; var dd = Math.abs(dx) + Math.abs(dy); if (dd < bd) { bd = dd; best = [x, y]; } }
        if (!best) return;
        var x0 = o.x, y0 = o.y, last = h[idx(o.x, o.y)];
        var carve = function (x, y) { var i = idx(x, y); if (i === idx(o.x, o.y)) return; if (k[i] === KIND.water || k[i] === KIND.lava) { k[i] = KIND.bridge; h[i] = 0; } else if (BLOCK[k[i]] || k[i] === KIND.ice) { k[i] = KIND.ground; } var hh = h[i]; if (hh > last + 1) hh = last + 1; if (hh < last - 1) hh = last - 1; h[i] = hh; last = hh; seen[i] = 1; q.push(i); };
        while (x0 !== best[0]) { x0 += best[0] > x0 ? 1 : -1; carve(x0, y0); }
        while (y0 !== best[1]) { y0 += best[1] > y0 ? 1 : -1; carve(x0, y0); }
        flood();
      });
    })();
    return { seed: seed, rank: rank, kind: kindName, kindName: kind.name, courtName: kind.court, cold: !!kind.cold, regions: regions, mods: mods, h: h, k: k, ents: ents, objs: objs, portals: portals, castles: castles, camps: camps, start: [sx, sy], nextId: nextId,
      monoliths: (function () { var m = { m0: 'You are the last King. The others are gone, their crowns carried east. Walk. The board is wider than eight files.', m1: 'The world moves when you move. Stand still and nothing comes. Step, and everything steps with you. Take a piece and you may move as it moves.', m3: 'Red squares are the reach of your enemies. End your move on one and you will bleed for it. Camps hold captains: take one and the camp is yours.' }; kind.monoliths.forEach(function (t, i) { m['r' + i] = t; }); return m; })() };
  }

  var api = { W: W, H: H, RS: RS, KIND: KIND, KNAME: KNAME, BLOCK: BLOCK, WALK: WALK, BIOMES: BIOMES, KINDS: KINDS, KIND_ORDER: KIND_ORDER, kindForRank: kindForRank, build: build, idx: idx, inside: inside, regionOf: regionOf, regionDiff: regionDiff, rng: rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RealmGen = api;
})(typeof self !== 'undefined' ? self : this);
