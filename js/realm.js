/* The Ninth Rank: the world and its rules, without any page code (node-testable, tools/tests/realm.js). The page
   (js/realm_view.js) draws it in 3D and plays the animations.

   A world of 96 x 96 squares, nine regions of 32 x 32, built from a seed. You are the last King. The world moves
   when you move, as in chess: your move, your allies' moves, then every enemy's move, each by its piece's rules.
   Landing on an enemy takes it. An enemy that can reach your square takes a heart from you. Captured pieces leave
   their essence: with it you move as that piece for one move (a knight's leap, a bishop's glide). Seven wardens hold
   crown shards; five shards open the gate of the Ninth Rank, where the Grand Queen waits.

   Squares: x to the east, y to the north, index y * W + x. Heights 0..3 (half a unit each in the view); a step climbs
   or drops at most one level, sliders too (square by square), knights jump two. */
(function (root) {
  'use strict';
  var W = 96, H = 96, N = W * H, RS = 32;
  var idx = function (x, y) { return y * W + x; };
  var inside = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H; };
  var KIND = { ground: 0, water: 1, lava: 2, tree: 3, rock: 4, road: 5, arena: 6, promo: 7, bridge: 8, portal: 9, shrine: 10, cage: 11, chest: 12, monolith: 13, gate: 14, dais: 15, pillar: 16 };
  var KNAME = []; Object.keys(KIND).forEach(function (k) { KNAME[KIND[k]] = k; });
  var BLOCK = {}; [KIND.water, KIND.lava, KIND.tree, KIND.rock, KIND.monolith, KIND.gate, KIND.pillar].forEach(function (k) { BLOCK[k] = true; });
  var VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 20, A: 30 };
  var ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], ALL8 = ORTH.concat(DIAG);
  var KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

  function rng(seed) {
    var st = { s: seed >>> 0 };
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
  // smooth value noise in [0, 1], seeded
  function noise2(seed) {
    var h = function (x, y) { var n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    var sm = function (t) { return t * t * (3 - 2 * t); };
    return function (x, y) {
      var x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0);
      var a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
      return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    };
  }

  /* ---------- the regions ---------- */
  var REGIONS = [
    { id: 0, name: 'The First Rank', line: 'Where the board begins.', biome: 'meadow', pawnDir: [0, -1], count: [6, 2, 0, 0, 0], mood: 'meadow' },
    { id: 1, name: 'The Pawn Fields', line: 'They march west. Stop them before the golden column.', biome: 'fields', pawnDir: [-1, 0], count: [12, 2, 1, 0, 0], mood: 'fields' },
    { id: 2, name: 'The Knight Steppe', line: 'Hills, and hooves in the grass.', biome: 'steppe', pawnDir: [-1, 0], count: [4, 7, 1, 1, 0], mood: 'steppe' },
    { id: 3, name: 'The Bishop Woods', line: 'Long shadows on the long diagonals.', biome: 'woods', pawnDir: [0, -1], count: [4, 2, 7, 0, 0], mood: 'woods' },
    { id: 4, name: 'The Crossing', line: 'Three rivers, four bridges, no quarter.', biome: 'crossing', pawnDir: [-1, 0], count: [6, 4, 4, 3, 0], mood: 'crossing' },
    { id: 5, name: 'The Rook Walls', line: 'Straight lines. Straight deaths.', biome: 'walls', pawnDir: [-1, 0], count: [4, 2, 2, 7, 1], mood: 'walls' },
    { id: 6, name: 'The Mirror Lake', line: 'What the water shows is not where it is.', biome: 'lake', pawnDir: [0, -1], count: [3, 3, 6, 2, 2], mood: 'lake' },
    { id: 7, name: 'The Ashen Keep', line: 'The ground remembers fire.', biome: 'ashen', pawnDir: [-1, 0], count: [5, 6, 3, 6, 2], mood: 'ashen' },
    { id: 8, name: 'The Ninth Rank', line: 'Beyond the edge of every board.', biome: 'court', pawnDir: [-1, 0], count: [0, 0, 0, 0, 0], mood: 'court' }
  ];
  var WARDENS = { 1: 'The Pawn Captain', 2: 'The Horse Lord', 3: 'The Twin Mitres', 4: 'The Ferryman', 5: 'The Wall Warden', 6: 'The Mirror Queen', 7: 'The Ash King' };
  var SHARDS_NEEDED = 5;
  var regionOf = function (x, y) { return Math.floor(y / RS) * 3 + Math.floor(x / RS); };
  var regionDiff = function (r) { return (r % 3) + Math.floor(r / 3); };
  var MONOLITHS = {
    m0: 'You are the last King. The others are gone, their crowns carried east. Walk. The board is wider than eight files.',
    m1: 'The world moves when you move. Stand still and nothing comes. Step, and everything steps with you.',
    m2: 'A taken piece leaves its essence. Hold it, and for one move you are that piece. A knight leaps walls. A rook crosses a field in a breath.',
    m3: 'Red lines are the reach of your enemies. End your move on one and you will bleed for it.',
    r1: 'Pawns do not stop. They march, and at the golden column they become queens. Count them.',
    r2: 'The knights of the steppe fear no hill. The hills will not save you from them.',
    r3: 'In the woods the bishops wait where the trees leave a diagonal open. Walk the straight paths.',
    r4: 'The Ferryman charges in crowns. He has not been paid in years.',
    r5: 'The walls were built to stop rooks. The rooks learned to use them.',
    r6: 'Two portals, one lake. Step into one and the other lets you out.',
    r7: 'The Ash King burned his own court to keep it. He will burn yours.',
    r8: 'There is no tenth rank. Whoever holds the ninth holds everything.'
  };

  /* ---------- building the world ---------- */
  function build(seed) {
    var r = rng(seed), noise = noise2(seed), n2 = noise2(seed + 77), n3 = noise2(seed + 919);
    var h = new Uint8Array(N), k = new Uint8Array(N), ents = [], objs = {}, portals = {}, nextId = 1;
    var set = function (x, y, kind, hh) { if (!inside(x, y)) return; var i = idx(x, y); k[i] = kind; if (hh != null) h[i] = hh; };
    var rect = function (x0, y0, x1, y1, kind, hh) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) set(x, y, kind, hh); };
    // the ground: rolling heights, flatter near the start, hills in the steppe, flat in the court
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var rg = regionOf(x, y), b = REGIONS[rg].biome;
      var v = noise(x / 9, y / 9) * 0.6 + noise(x / 3.5, y / 3.5) * 0.4;
      var lvl = b === 'steppe' ? Math.min(3, Math.floor(v * 4.6)) : b === 'ashen' ? Math.min(3, Math.floor(v * 3.6)) : b === 'court' || b === 'meadow' ? (v > 0.78 ? 1 : 0) : Math.min(2, Math.floor(v * 3));
      h[idx(x, y)] = lvl;
      k[idx(x, y)] = KIND.ground;
      var w = n2(x / 7, y / 7);
      if (b === 'woods' && w > 0.56 && v < 0.75) k[idx(x, y)] = KIND.tree;
      if (b === 'meadow' && w > 0.82) k[idx(x, y)] = KIND.tree;
      if (b === 'steppe' && w > 0.86) k[idx(x, y)] = KIND.rock;
      if (b === 'fields' && w > 0.9) k[idx(x, y)] = KIND.tree;
      if (b === 'lake' && v < 0.42) { k[idx(x, y)] = KIND.water; h[idx(x, y)] = 0; }
      if (b === 'ashen' && n3(x / 5, y / 5) > 0.74) { k[idx(x, y)] = KIND.lava; h[idx(x, y)] = 0; }
      if (b === 'ashen' && w > 0.84) k[idx(x, y)] = KIND.rock;
      if (b === 'crossing' && w > 0.88) k[idx(x, y)] = KIND.tree;
      if (b === 'walls' && w > 0.9) k[idx(x, y)] = KIND.rock;
    }
    // the crossing: three rivers (north to south, bending), with bridges where the roads cross
    for (var ry = 32; ry < 64; ry++) [40, 48, 56].forEach(function (cx, i) { var xx = cx + Math.round(Math.sin(ry / 6 + i) * 2); set(xx, ry, KIND.water, 0); set(xx + 1, ry, KIND.water, 0); });
    // the rook walls: a maze of straight segments
    for (var wy = 33; wy < 63; wy += 4) for (var wx = 65; wx < 95; wx++) if (((wx + wy * 3) % 11) < 7 && r.next() < 0.85) set(wx, wy, KIND.rock, h[idx(wx, wy)]);
    for (var wx2 = 67; wx2 < 95; wx2 += 6) for (var wy2 = 32; wy2 < 64; wy2++) if (((wy2 + wx2) % 9) < 5 && r.next() < 0.7) set(wx2, wy2, KIND.rock, h[idx(wx2, wy2)]);
    // the pawn fields: fences and the golden column where their pawns promote
    for (var fy = 2; fy < 30; fy += 6) for (var fx = 36; fx < 62; fx++) if (r.next() < 0.6) set(fx, fy, KIND.rock, h[idx(fx, fy)]);
    for (var py = 1; py < 31; py++) set(33, py, KIND.promo, 0);
    // the roads: start to each region centre, centre to centre, gently ramped, always passable
    var centres = REGIONS.map(function (rr) { return [(rr.id % 3) * RS + 16, Math.floor(rr.id / 3) * RS + 16]; });
    centres[8] = [67, 80]; // the court of the Ninth Rank fills its region: the roads end at its gate
    function road(ax, ay, bx, by) {
      var x = ax, y = ay, last = h[idx(ax, ay)];
      var lay = function () { for (var dx = 0; dx < 2; dx++) for (var dy = 0; dy < 2; dy++) { if (!inside(x + dx, y + dy)) continue; var i = idx(x + dx, y + dy); var hh = h[i]; if (hh > last + 1) hh = last + 1; if (hh < last - 1) hh = last - 1; k[i] = KIND.road; h[i] = hh; last = hh; } };
      lay();
      while (x !== bx) { x += bx > x ? 1 : -1; lay(); }
      while (y !== by) { y += by > y ? 1 : -1; lay(); }
    }
    road(6, 6, centres[0][0], centres[0][1]);
    [[0, 1], [1, 2], [0, 3], [3, 4], [1, 4], [4, 5], [2, 5], [3, 6], [6, 7], [4, 7], [7, 8], [5, 8]].forEach(function (e) { road(centres[e[0]][0], centres[e[0]][1], centres[e[1]][0], centres[e[1]][1]); });
    // bridges: water next to a road, in the regions with rivers and the lake
    for (var bi = 0; bi < N; bi++) {
      var bx = bi % W, by = Math.floor(bi / W);
      if (k[bi] !== KIND.water) continue;
      var onRoad = false;
      ORTH.forEach(function (d) { var j = inside(bx + d[0], by + d[1]) ? idx(bx + d[0], by + d[1]) : -1; if (j >= 0 && (k[j] === KIND.road || k[j] === KIND.bridge)) onRoad = true; });
      if (onRoad && ((regionOf(bx, by) === 4) || regionOf(bx, by) === 6)) { k[bi] = KIND.bridge; h[bi] = 0; }
    }
    // the start clearing
    rect(3, 3, 10, 10, KIND.ground, 0);
    rect(5, 5, 7, 7, KIND.road, 0);
    var sx = 6, sy = 6;
    // the castles of the wardens (regions 1..7): 11 x 11, a gate towards the region's centre road
    var castles = {};
    for (var cr = 1; cr <= 7; cr++) {
      var cx = centres[cr][0] + (cr % 2 ? 7 : -7), cy = centres[cr][1] + (cr < 4 ? 7 : -7);
      var base = 0;
      rect(cx - 6, cy - 6, cx + 6, cy + 6, KIND.ground, base);
      rect(cx - 5, cy - 5, cx + 5, cy + 5, KIND.rock, base + 2);
      rect(cx - 4, cy - 4, cx + 4, cy + 4, KIND.arena, base);
      var gx = cx + (cr % 2 ? -5 : 5), gy = cy; // the gate on the side facing the centre
      set(gx, gy, KIND.arena, base);
      set(gx + (cr % 2 ? -1 : 1), gy, KIND.road, base);
      road(centres[cr][0], centres[cr][1], gx + (cr % 2 ? -2 : 2), gy);
      set(gx, gy, KIND.arena, base); set(gx + (cr % 2 ? -1 : 1), gy, KIND.road, base);
      castles[cr] = { x: cx, y: cy, gate: [gx, gy], region: cr };
      ents.push({ id: nextId++, side: 'b', t: 'K', x: cx, y: cy, hp: 3, warden: cr, name: WARDENS[cr], region: cr });
      [[cx - 2, cy - 2], [cx + 2, cy - 2], [cx, cy + 2]].forEach(function (g) { ents.push({ id: nextId++, side: 'b', t: r.pick(['N', 'B', 'R']), x: g[0], y: g[1], hp: 1, guard: cr, region: cr }); });
    }
    // the court of the Ninth Rank: 21 x 21, the gate on the west, pillars, the dais
    var qx = 80, qy = 80;
    rect(qx - 11, qy - 11, qx + 11, qy + 11, KIND.ground, 0);
    rect(qx - 10, qy - 10, qx + 10, qy + 10, KIND.rock, 3);
    rect(qx - 9, qy - 9, qx + 9, qy + 9, KIND.arena, 0);
    for (var px = -6; px <= 6; px += 4) for (var pyy = -6; pyy <= 6; pyy += 4) if (Math.abs(px) + Math.abs(pyy) > 4) set(qx + px, qy + pyy, KIND.pillar, 3);
    rect(qx - 2, qy - 2, qx + 2, qy + 2, KIND.dais, 1);
    set(qx - 10, qy, KIND.gate, 3); set(qx - 10, qy + 1, KIND.gate, 3);
    rect(qx - 12, qy, qx - 11, qy + 1, KIND.road, 0);
    ents.push({ id: nextId++, side: 'b', t: 'A', x: qx, y: qy, hp: 5, grand: true, name: 'The Grand Queen', region: 8 });
    [['R', -8, -8], ['R', 8, -8], ['R', -8, 8], ['R', 8, 8], ['B', -4, 0], ['B', 4, 0], ['B', 0, -4], ['B', 0, 4], ['N', -3, -3], ['N', 3, 3]].forEach(function (g) { ents.push({ id: nextId++, side: 'b', t: g[0], x: qx + g[1], y: qy + g[2], hp: 1, guard: 8, region: 8 }); });
    for (var pp = -8; pp <= 8; pp += 2) ents.push({ id: nextId++, side: 'b', t: 'P', x: qx - 8, y: qy + pp, hp: 1, guard: 8, region: 8, dir: [-1, 0] });
    castles[8] = { x: qx, y: qy, gate: [qx - 10, qy], region: 8, court: true };
    // the free squares of a region, for placing things
    var occupied = {};
    ents.forEach(function (e) { occupied[idx(e.x, e.y)] = true; });
    function freeSpots(reg, avoidCastle) {
      var out = [];
      for (var yy = Math.floor(reg / 3) * RS; yy < Math.floor(reg / 3) * RS + RS; yy++) for (var xx = (reg % 3) * RS; xx < (reg % 3) * RS + RS; xx++) {
        var i = idx(xx, yy);
        if (k[i] !== KIND.ground && k[i] !== KIND.road) continue;
        if (occupied[i]) continue;
        if (reg === 0 && Math.max(Math.abs(xx - sx), Math.abs(yy - sy)) <= 9) continue;
        if (avoidCastle && castles[reg] && Math.abs(xx - castles[reg].x) <= 7 && Math.abs(yy - castles[reg].y) <= 7) continue;
        out.push([xx, yy]);
      }
      return r.shuffle(out);
    }
    function place(reg, kind, data) {
      var spots = freeSpots(reg, true);
      for (var i = 0; i < spots.length; i++) {
        var s = spots[i], ii = idx(s[0], s[1]);
        // things sit off the roads, with free ground around them
        if (k[ii] === KIND.road) continue;
        var ok = true;
        ORTH.forEach(function (d) { var j = inside(s[0] + d[0], s[1] + d[1]) ? idx(s[0] + d[0], s[1] + d[1]) : -1; if (j < 0 || BLOCK[k[j]] || occupied[j] || objs[j]) ok = false; });
        if (!ok) continue;
        k[ii] = kind; occupied[ii] = true;
        objs[ii] = Object.assign({ kind: KNAME[kind], x: s[0], y: s[1] }, data || {});
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
      place(reg, KIND.monolith, { text: 'r' + reg });
    }
    // the first rank's shrine and monoliths near the start
    set(8, 4, KIND.shrine, 0); objs[idx(8, 4)] = { kind: 'shrine', x: 8, y: 4, shrine: 1 };
    set(4, 8, KIND.monolith, 0); objs[idx(4, 8)] = { kind: 'monolith', x: 4, y: 8, text: 'm0' };
    set(9, 9, KIND.monolith, 0); objs[idx(9, 9)] = { kind: 'monolith', x: 9, y: 9, text: 'm1' };
    set(12, 6, KIND.monolith, 0); objs[idx(12, 6)] = { kind: 'monolith', x: 12, y: 6, text: 'm2' };
    set(6, 13, KIND.monolith, 0); objs[idx(6, 13)] = { kind: 'monolith', x: 6, y: 13, text: 'm3' };
    [[8, 4], [4, 8], [9, 9], [12, 6], [6, 13]].forEach(function (p) { occupied[idx(p[0], p[1])] = true; });
    // portals: pairs in the lake and the crossing
    [[6, 2], [4, 1]].forEach(function (pr) {
      for (var pi = 0; pi < pr[1]; pi++) {
        var a = place(pr[0], KIND.portal, { portal: true }), b2 = place(pr[0], KIND.portal, { portal: true });
        if (a && b2) { portals[idx(a.x, a.y)] = idx(b2.x, b2.y); portals[idx(b2.x, b2.y)] = idx(a.x, a.y); }
      }
    });
    // the enemies of each region, in camps of two to four
    var TYPES = ['P', 'N', 'B', 'R', 'Q'];
    for (var er = 0; er <= 7; er++) {
      var cnt = REGIONS[er].count, bag = [];
      TYPES.forEach(function (t, ti) { for (var c = 0; c < cnt[ti]; c++) bag.push(t); });
      r.shuffle(bag);
      var spots2 = freeSpots(er, true), si2 = 0;
      while (bag.length && si2 < spots2.length) {
        var camp = spots2[si2++], size = Math.min(bag.length, 2 + r.int(3));
        var around = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, 1], [1, -1]];
        for (var ci = 0; ci < around.length && size > 0; ci++) {
          var ex = camp[0] + around[ci][0], ey = camp[1] + around[ci][1];
          if (!inside(ex, ey)) continue;
          var ei = idx(ex, ey);
          if (occupied[ei] || (k[ei] !== KIND.ground && k[ei] !== KIND.road)) continue;
          if (Math.max(Math.abs(ex - sx), Math.abs(ey - sy)) <= 9) continue;
          var t2 = bag.pop();
          ents.push({ id: nextId++, side: 'b', t: t2, x: ex, y: ey, hp: 1, region: er, dir: t2 === 'P' ? REGIONS[er].pawnDir.slice() : null });
          occupied[ei] = true; size--;
        }
      }
    }
    return { seed: seed, h: h, k: k, ents: ents, objs: objs, portals: portals, castles: castles, start: [sx, sy], nextId: nextId };
  }

  /* ---------- the state of a game ---------- */
  function fresh(seed) {
    seed = (seed == null ? (Date.now() ^ Math.floor(Math.random() * 1e9)) : seed) >>> 0;
    var world = build(seed);
    var S = { v: 1, seed: seed, turn: 0, over: null,
      p: { x: world.start[0], y: world.start[1], hearts: 3, maxHearts: 3, ess: { N: 0, B: 0, R: 0, Q: 0 }, form: 'K', shards: 0, deaths: 0, kills: 0, facing: [1, 0] },
      shrine: null, allies: [], ents: world.ents, nextId: world.nextId, used: {}, read: {}, gateOpen: false, arena: null, explored: {}, log: [], rng: (seed * 7919) >>> 0 };
    S.world = world;
    noteExplored(S);
    return S;
  }
  // the world is built again from the seed when a save comes back (only what changed is saved)
  function toSave(S) {
    return { v: 1, seed: S.seed, turn: S.turn, over: S.over, p: S.p, shrine: S.shrine, allies: S.allies, nextId: S.nextId, used: S.used, read: S.read, gateOpen: S.gateOpen, arena: S.arena, explored: S.explored, rng: S.rng,
      ents: S.ents.map(function (e) { return { id: e.id, t: e.t, x: e.x, y: e.y, hp: e.hp, awake: !!e.awake, dead: !!e.dead, side: e.side, warden: e.warden, grand: e.grand, guard: e.guard, region: e.region, dir: e.dir, name: e.name, summoned: e.summoned }; }) };
  }
  function fromSave(o) {
    if (!o || typeof o !== 'object' || typeof o.seed !== 'number') return null;
    var S = fresh(o.seed);
    ['turn', 'over', 'p', 'shrine', 'allies', 'nextId', 'used', 'read', 'gateOpen', 'arena', 'explored', 'rng'].forEach(function (f) { if (o[f] !== undefined) S[f] = o[f]; });
    if (Array.isArray(o.ents)) S.ents = o.ents.filter(function (e) { return !e.dead; });
    S.p.ess = Object.assign({ N: 0, B: 0, R: 0, Q: 0 }, S.p.ess || {});
    if (S.gateOpen) openGate(S);
    return S;
  }
  function openGate(S) {
    var w = S.world, c = w.castles[8];
    [[c.gate[0], c.gate[1]], [c.gate[0], c.gate[1] + 1]].forEach(function (g) { w.k[idx(g[0], g[1])] = KIND.arena; w.h[idx(g[0], g[1])] = 0; });
    S.gateOpen = true;
  }
  var chunkKey = function (x, y) { return (x >> 3) + ',' + (y >> 3); };
  function noteExplored(S) { for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) S.explored[chunkKey(S.p.x + dx * 8, S.p.y + dy * 8)] = 1; }

  /* ---------- the board as the pieces see it ---------- */
  function at(S, x, y) {
    if (x === S.p.x && y === S.p.y) return { player: true, side: 'w' };
    for (var i = 0; i < S.allies.length; i++) if (S.allies[i].x === x && S.allies[i].y === y) return S.allies[i];
    for (var j = 0; j < S.ents.length; j++) { var e = S.ents[j]; if (!e.dead && e.x === x && e.y === y) return e; }
    return null;
  }
  function tileFree(S, x, y, side) {
    if (!inside(x, y)) return false;
    var i = idx(x, y), kk = S.world.k[i];
    if (BLOCK[kk]) return false;
    if (S.arena && S.arena.closed && kk !== KIND.arena && isArenaEdgeGate(S, x, y)) return false;
    if (side === 'b' && (kk === KIND.portal || kk === KIND.shrine || kk === KIND.cage || kk === KIND.chest)) return false; // the enemies walk round the things of the world
    return true;
  }
  function isArenaEdgeGate(S, x, y) { var c = S.world.castles[S.arena.castle]; return c && c.gate[0] === x && (c.gate[1] === y || (c.court && c.gate[1] + 1 === y)); }
  var hgt = function (S, x, y) { return S.world.h[idx(x, y)]; };
  /* The moves of a piece of type t on (x, y) for side: [{ x, y, cap: the piece taken or null, path: the squares
     slid over }]. own: whether a square holds a piece of the same side (never entered). */
  var REACH = 7; // a slide of the enemies and allies ends after seven squares: nothing strikes from further away
  function movesOf(S, t, x, y, side, dir) {
    var out = [], maxSlide = side === 'w' && x === S.p.x && y === S.p.y ? 40 : REACH;
    var consider = function (nx, ny, maxClimb, path) {
      if (!tileFree(S, nx, ny, side)) return 'stop';
      if (Math.abs(hgt(S, nx, ny) - hgt(S, path && path.length ? path[path.length - 1][0] : x, path && path.length ? path[path.length - 1][1] : y)) > maxClimb) return 'stop';
      var o = at(S, nx, ny);
      if (o) { if (o.side === side) return 'stop'; out.push({ x: nx, y: ny, cap: o, path: path || [] }); return 'stop'; }
      out.push({ x: nx, y: ny, cap: null, path: path || [] });
      return S.world.k[idx(nx, ny)] === KIND.portal ? 'stop' : 'go';
    };
    var slide = function (dirs) {
      dirs.forEach(function (d) {
        var p = [], cx = x, cy = y;
        for (var s = 1; s <= maxSlide; s++) {
          cx += d[0]; cy += d[1];
          var res = consider(cx, cy, 1, p.slice());
          if (res === 'stop') break;
          p.push([cx, cy]);
        }
      });
    };
    if (t === 'K') ALL8.forEach(function (d) { consider(x + d[0], y + d[1], 1); });
    else if (t === 'N') KN.forEach(function (d) { consider(x + d[0], y + d[1], 2); });
    else if (t === 'B') slide(DIAG);
    else if (t === 'R') slide(ORTH);
    else if (t === 'Q') slide(ALL8);
    else if (t === 'A') { slide(ALL8); KN.forEach(function (d) { consider(x + d[0], y + d[1], 2); }); }
    else if (t === 'P') {
      var d = dir || [0, 1], fx = x + d[0], fy = y + d[1];
      if (tileFree(S, fx, fy, side) && !at(S, fx, fy) && Math.abs(hgt(S, fx, fy) - hgt(S, x, y)) <= 1) out.push({ x: fx, y: fy, cap: null, path: [] });
      var sides = d[0] === 0 ? [[1, d[1]], [-1, d[1]]] : [[d[0], 1], [d[0], -1]];
      sides.forEach(function (c) { var cx = x + c[0], cy = y + c[1]; if (!tileFree(S, cx, cy, side)) return; var o = at(S, cx, cy); if (o && o.side !== side && Math.abs(hgt(S, cx, cy) - hgt(S, x, y)) <= 1) out.push({ x: cx, y: cy, cap: o, path: [] }); });
    }
    return out;
  }
  // the player's moves in the form picked (the King's steps need nothing; the others cost one essence)
  function playerMoves(S, form) {
    form = form || S.p.form;
    if (form !== 'K' && !(S.p.ess[form] > 0)) return [];
    return movesOf(S, form, S.p.x, S.p.y, 'w');
  }
  // the squares the enemies within reach attack, and who attacks the player's square
  function threats(S, range) {
    range = range || 18;
    var sq = {}, atPlayer = [];
    S.ents.forEach(function (e) {
      if (e.dead || Math.abs(e.x - S.p.x) > range || Math.abs(e.y - S.p.y) > range) return;
      var ms = e.t === 'P' ? pawnAttacks(S, e) : movesOf(S, e.t, e.x, e.y, 'b', e.dir);
      ms.forEach(function (m) {
        var key = idx(m.x, m.y);
        (sq[key] = sq[key] || []).push(e.id);
        if (m.x === S.p.x && m.y === S.p.y) atPlayer.push(e);
      });
    });
    return { squares: sq, atPlayer: atPlayer };
  }
  function pawnAttacks(S, e) {
    var d = e.dir || [0, 1], sides = d[0] === 0 ? [[1, d[1]], [-1, d[1]]] : [[d[0], 1], [d[0], -1]], out = [];
    sides.forEach(function (c) { var cx = e.x + c[0], cy = e.y + c[1]; if (tileFree(S, cx, cy, 'b') && Math.abs(hgt(S, cx, cy) - hgt(S, e.x, e.y)) <= 1) out.push({ x: cx, y: cy }); });
    return out;
  }
  var inCheck = function (S) { return threats(S, 18).atPlayer.length > 0; };

  /* ---------- a turn ---------- */
  var ESS_MAX = 9;
  function gainEss(S, t, n) { if (S.p.ess[t] == null) return; S.p.ess[t] = Math.min(ESS_MAX, S.p.ess[t] + n); }
  function srand(S) { var r = rng(S.rng); var v = r.next(); S.rng = r.s; return v; }
  /* The player plays form f to (x, y): the move, what the square does (portal, shrine, chest, cage), then the
     allies, then the enemies. Returns the events for the page, or null if the move is not possible. */
  function play(S, x, y, form) {
    if (S.over && S.over.won === false) return null;
    form = form || S.p.form;
    var ms = playerMoves(S, form), m = null;
    for (var i = 0; i < ms.length; i++) if (ms[i].x === x && ms[i].y === y) m = ms[i];
    if (!m) return null;
    var ev = [], from = [S.p.x, S.p.y];
    if (form !== 'K') S.p.ess[form]--;
    S.p.facing = [Math.sign(x - from[0]) || S.p.facing[0], Math.sign(y - from[1]) || S.p.facing[1]];
    ev.push({ e: 'move', who: 'p', form: form, from: from, to: [x, y], path: m.path });
    if (m.cap) capture(S, m.cap, ev, 'p');
    S.p.x = x; S.p.y = y;
    S.turn++;
    arrive(S, ev);
    if (S.over && S.over.won) return ev;
    alliesTurn(S, ev);
    enemiesTurn(S, ev);
    noteExplored(S);
    var th = threats(S, 18);
    ev.push({ e: 'threat', n: th.atPlayer.length });
    return ev;
  }
  // a turn in which the player stands still
  function wait(S) {
    if (S.over && S.over.won === false) return null;
    var ev = [{ e: 'wait' }];
    S.turn++;
    alliesTurn(S, ev);
    enemiesTurn(S, ev);
    ev.push({ e: 'threat', n: threats(S, 18).atPlayer.length });
    return ev;
  }
  function capture(S, o, ev, by) {
    if (o.player) return;
    var ally = S.allies.indexOf(o) >= 0;
    if (ally) { S.allies.splice(S.allies.indexOf(o), 1); ev.push({ e: 'allyLost', id: o.id, t: o.t, at: [o.x, o.y] }); return; }
    o.hp--;
    if (o.hp > 0) {
      // a warden or the Grand Queen: a crown is struck off, it flees within its walls and calls guards
      var c = S.world.castles[o.warden || 8], spots = [];
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var sx = c.x + dx, sy = c.y + dy; if (S.world.k[idx(sx, sy)] === KIND.arena && !at(S, sx, sy) && (Math.abs(dx) + Math.abs(dy)) >= 3) spots.push([sx, sy]); }
      var to = spots.length ? spots[Math.floor(srand(S) * spots.length)] : [o.x, o.y];
      ev.push({ e: 'crownOff', id: o.id, left: o.hp, from: [o.x, o.y], to: to });
      o.x = to[0]; o.y = to[1];
      var guards = o.grand ? ['B', 'R', 'N'] : ['N', 'B', 'R'].slice(0, 2);
      guards.forEach(function (t) {
        var free = spots.filter(function (s) { return !at(S, s[0], s[1]); });
        if (!free.length) return;
        var g = free[Math.floor(srand(S) * free.length)];
        var ne = { id: S.nextId++, side: 'b', t: t, x: g[0], y: g[1], hp: 1, guard: o.warden || 8, region: o.region, awake: true, summoned: true };
        S.ents.push(ne);
        ev.push({ e: 'summon', id: ne.id, t: t, at: g });
      });
      return;
    }
    o.dead = true;
    ev.push({ e: 'capture', id: o.id, t: o.t, at: [o.x, o.y], by: by, warden: o.warden || null, grand: !!o.grand });
    if (by === 'p') {
      S.p.kills++;
      if (o.t === 'P') gainEss(S, srand(S) < 0.5 ? 'N' : 'B', 1);
      else if (S.p.ess[o.t] != null) gainEss(S, o.t, 2);
      if (o.warden) { ['N', 'B', 'R', 'Q'].forEach(function (t) { gainEss(S, t, 3); }); S.p.shards++; ev.push({ e: 'shard', n: S.p.shards, warden: o.warden, name: o.name }); S.arena = null; if (S.p.shards >= SHARDS_NEEDED && !S.gateOpen) { openGate(S); ev.push({ e: 'gate' }); } }
      if (o.grand) { S.over = { won: true, turn: S.turn, kills: S.p.kills, deaths: S.p.deaths }; S.arena = null; ev.push({ e: 'won' }); }
    }
  }
  function arrive(S, ev) {
    var w = S.world, i = idx(S.p.x, S.p.y), kk = w.k[i], o = w.objs[i];
    if (kk === KIND.portal && w.portals[i] != null) {
      var j = w.portals[i], tx = j % W, ty = Math.floor(j / W);
      if (!at(S, tx, ty)) { ev.push({ e: 'portal', from: [S.p.x, S.p.y], to: [tx, ty] }); S.p.x = tx; S.p.y = ty; }
    } else if (kk === KIND.shrine) {
      var healed = S.p.maxHearts - S.p.hearts;
      S.p.hearts = S.p.maxHearts; S.shrine = [S.p.x, S.p.y];
      ev.push({ e: 'shrine', healed: healed });
    } else if (kk === KIND.chest && !S.used[i]) {
      S.used[i] = 1;
      if (o.gift === 'heart') { S.p.maxHearts = Math.min(6, S.p.maxHearts + 1); S.p.hearts = S.p.maxHearts; } else gainEss(S, o.gift, 3);
      ev.push({ e: 'chest', gift: o.gift });
    } else if (kk === KIND.cage && !S.used[i]) {
      S.used[i] = 1;
      var spot = freeNear(S, S.p.x, S.p.y);
      if (spot && S.allies.length < 4) { var a = { id: S.nextId++, side: 'w', t: o.ally, x: spot[0], y: spot[1], hp: 1 }; S.allies.push(a); ev.push({ e: 'freed', id: a.id, t: a.t, at: spot }); }
      else ev.push({ e: 'freed', id: 0, t: o.ally, at: null });
    }
    // a warden's arena: the gate shuts behind the player until the warden falls
    var c = castleAround(S, S.p.x, S.p.y);
    if (c && kk === KIND.arena && !S.arena) {
      var warden = S.ents.filter(function (e) { return !e.dead && (e.warden === c.region || (c.court && e.grand)); })[0];
      if (warden) { S.arena = { castle: c.region, closed: true }; S.ents.forEach(function (e) { if (!e.dead && (e.guard === c.region || e.warden === c.region || (c.court && e.region === 8))) e.awake = true; }); ev.push({ e: 'arena', castle: c.region, name: warden.name }); }
    }
    // the monoliths: read when stood next to
    ALL8.forEach(function (d) {
      var mx = S.p.x + d[0], my = S.p.y + d[1];
      if (!inside(mx, my)) return;
      var mo = w.objs[idx(mx, my)];
      if (mo && mo.kind === 'monolith' && !S.read[mo.text]) { S.read[mo.text] = 1; ev.push({ e: 'monolith', text: mo.text, at: [mx, my] }); }
    });
  }
  function castleAround(S, x, y) {
    var cs = S.world.castles;
    for (var key in cs) { var c = cs[key]; var rad = c.court ? 9 : 4; if (Math.abs(x - c.x) <= rad && Math.abs(y - c.y) <= rad) return c; }
    return null;
  }
  function freeNear(S, x, y) {
    for (var ring = 1; ring <= 3; ring++) for (var dy = -ring; dy <= ring; dy++) for (var dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      var nx = x + dx, ny = y + dy;
      if (tileFree(S, nx, ny, 'w') && !at(S, nx, ny) && S.world.k[idx(nx, ny)] !== KIND.portal && Math.abs(hgt(S, nx, ny) - hgt(S, x, y)) <= 1) return [nx, ny];
    }
    return null;
  }
  var dist = function (ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); };
  // the allies: take what they can, else keep close to the King
  function alliesTurn(S, ev) {
    S.allies.slice().forEach(function (a) {
      if (S.allies.indexOf(a) < 0) return;
      var ms = movesOf(S, a.t, a.x, a.y, 'w'), caps = ms.filter(function (m) { return m.cap && !m.cap.player; });
      var pick = null;
      if (caps.length) { caps.sort(function (p, q) { return VALUE[q.cap.t] - VALUE[p.cap.t]; }); pick = caps[0]; }
      else if (dist(a.x, a.y, S.p.x, S.p.y) > 2 && ms.length) {
        var best = null, bd = 1e9;
        ms.forEach(function (m) { var d = dist(m.x, m.y, S.p.x, S.p.y) + srand(S) * 0.5; if (d < bd && d >= 1) { bd = d; best = m; } });
        pick = best;
      }
      if (!pick) return;
      var from = [a.x, a.y];
      if (pick.cap) capture(S, pick.cap, ev, 'ally');
      a.x = pick.x; a.y = pick.y;
      ev.push({ e: 'move', who: 'a', id: a.id, t: a.t, from: from, to: [a.x, a.y], path: pick.path });
    });
  }
  /* The enemies, nearest first: one that can take the King does (the King loses a heart and is pushed back); one that
     can take an ally does; an awake one closes in; a sleeping one wakes when the King comes near, else it holds its
     ground (a pawn always marches when awake). Pawns that reach the golden squares become queens. */
  function enemiesTurn(S, ev) {
    var struck = 0, near = S.ents.filter(function (e) { return !e.dead && dist(e.x, e.y, S.p.x, S.p.y) <= 20; });
    near.sort(function (a, b) { return dist(a.x, a.y, S.p.x, S.p.y) - dist(b.x, b.y, S.p.x, S.p.y); });
    near.forEach(function (e) {
      if (e.dead || S.over) return;
      var d = dist(e.x, e.y, S.p.x, S.p.y);
      if (!e.awake && d <= (e.t === 'P' ? 7 : 10)) { e.awake = true; ev.push({ e: 'wake', id: e.id }); }
      var ms = movesOf(S, e.t, e.x, e.y, 'b', e.dir);
      if (e.warden || e.grand) ms = ms.filter(function (m) { return inHall(S, e, m.x, m.y); }); // a warden never leaves its hall
      var hitKing = ms.filter(function (m) { return m.cap && m.cap.player; })[0];
      if (hitKing) {
        // the King bleeds: the first attacker takes his square, he is pushed to a free square away from it
        var from = [e.x, e.y];
        var pushTo = struck === 0 ? pushSquare(S, from) : null;
        S.p.hearts--; struck++;
        ev.push({ e: 'hit', id: e.id, t: e.t, from: from, hearts: S.p.hearts, pushed: pushTo });
        if (pushTo) { e.x = S.p.x; e.y = S.p.y; S.p.x = pushTo[0]; S.p.y = pushTo[1]; }
        if (S.p.hearts <= 0) { mated(S, ev); }
        return;
      }
      var hitAlly = ms.filter(function (m) { return m.cap && S.allies.indexOf(m.cap) >= 0; });
      if (hitAlly.length) { hitAlly.sort(function (p, q) { return VALUE[q.cap.t] - VALUE[p.cap.t]; }); var hm = hitAlly[0]; capture(S, hm.cap, ev, 'enemy'); ev.push({ e: 'move', who: 'e', id: e.id, t: e.t, from: [e.x, e.y], to: [hm.x, hm.y], path: hm.path }); e.x = hm.x; e.y = hm.y; return; }
      if (!e.awake) return;
      var quiet = ms.filter(function (m) { return !m.cap; });
      if (e.t === 'P' && !quiet.length) {
        // a pawn with nothing ahead of it (a tree, water, a hill, another piece) turns to face the King instead of
        // standing there for good: the way with the longer distance first, else the other
        var ddx = S.p.x - e.x, ddy = S.p.y - e.y, cands = Math.abs(ddx) >= Math.abs(ddy) ? [[Math.sign(ddx), 0], [0, Math.sign(ddy)]] : [[0, Math.sign(ddy)], [Math.sign(ddx), 0]];
        for (var ci = 0; ci < cands.length; ci++) {
          var nd = cands[ci];
          if (!nd[0] && !nd[1]) continue;
          if (nd[0] === e.dir[0] && nd[1] === e.dir[1]) continue;
          var fx = e.x + nd[0], fy = e.y + nd[1];
          if (!tileFree(S, fx, fy, 'b') || Math.abs(hgt(S, fx, fy) - hgt(S, e.x, e.y)) > 1) continue;
          e.dir = nd; ev.push({ e: 'turn', id: e.id, dir: nd }); return;
        }
        return;
      }
      if (!quiet.length) return;
      var pick = null;
      if (e.t === 'P') pick = quiet[0];
      else {
        var bd = 1e9;
        quiet.forEach(function (m) { var dd = Math.hypot(m.x - S.p.x, m.y - S.p.y) + srand(S) * 0.4; if (dd < bd) { bd = dd; pick = m; } });
        // a piece that is close already does not step away from the King
        if (pick && Math.hypot(pick.x - S.p.x, pick.y - S.p.y) >= Math.hypot(e.x - S.p.x, e.y - S.p.y) && d <= 2) pick = null;
      }
      if (!pick) return;
      var f0 = [e.x, e.y];
      e.x = pick.x; e.y = pick.y;
      ev.push({ e: 'move', who: 'e', id: e.id, t: e.t, from: f0, to: [e.x, e.y], path: pick.path });
      if (e.t === 'P' && S.world.k[idx(e.x, e.y)] === KIND.promo) { e.t = 'Q'; e.dir = null; ev.push({ e: 'promote', id: e.id, at: [e.x, e.y] }); }
    });
  }
  // the hall of a warden: the arena squares of its castle (the Grand Queen's is the whole court)
  function inHall(S, e, x, y) {
    var c = S.world.castles[e.warden || 8]; if (!c) return true;
    var rad = c.court ? 9 : 4;
    return Math.abs(x - c.x) <= rad && Math.abs(y - c.y) <= rad && S.world.k[idx(x, y)] === KIND.arena;
  }
  function pushSquare(S, from) {
    var best = null, bd = -1;
    ALL8.forEach(function (d) {
      var nx = S.p.x + d[0], ny = S.p.y + d[1];
      if (!tileFree(S, nx, ny, 'w') || at(S, nx, ny) || S.world.k[idx(nx, ny)] === KIND.portal || Math.abs(hgt(S, nx, ny) - hgt(S, S.p.x, S.p.y)) > 1) return;
      var dd = Math.hypot(nx - from[0], ny - from[1]);
      if (dd > bd) { bd = dd; best = [nx, ny]; }
    });
    return best;
  }
  // the King falls: back to the last shrine, hearts full, half the essence gone; a warden fight is undone
  function mated(S, ev) {
    S.p.deaths++;
    var back = S.shrine || S.world.start.slice();
    ['N', 'B', 'R', 'Q'].forEach(function (t) { S.p.ess[t] = Math.floor(S.p.ess[t] / 2); });
    S.p.hearts = S.p.maxHearts;
    if (S.arena) {
      var c = S.world.castles[S.arena.castle];
      S.ents.forEach(function (e) { if (e.warden === c.region || (c.court && e.grand)) { e.hp = e.grand ? 5 : 3; e.x = c.x; e.y = c.y; } if (e.summoned && (e.guard === c.region)) e.dead = true; });
      S.arena = null;
    }
    S.p.x = back[0]; S.p.y = back[1];
    if (at(S, back[0], back[1]) && !at(S, back[0], back[1]).player) { var fn = freeNear(S, back[0], back[1]); if (fn) { S.p.x = fn[0]; S.p.y = fn[1]; } }
    S.allies = [];
    ev.push({ e: 'mated', to: [S.p.x, S.p.y], deaths: S.p.deaths });
  }

  var api = { W: W, H: H, RS: RS, KIND: KIND, KNAME: KNAME, BLOCK: BLOCK, REGIONS: REGIONS, WARDENS: WARDENS, MONOLITHS: MONOLITHS, SHARDS_NEEDED: SHARDS_NEEDED, VALUE: VALUE, ESS_MAX: ESS_MAX,
    idx: idx, inside: inside, regionOf: regionOf, regionDiff: regionDiff, build: build, fresh: fresh, toSave: toSave, fromSave: fromSave, at: at, tileFree: tileFree, movesOf: movesOf, playerMoves: playerMoves,
    threats: threats, inCheck: inCheck, play: play, wait: wait, dist: dist, castleAround: castleAround, chunkKey: chunkKey, REACH: REACH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Realm = api;
})(typeof self !== 'undefined' ? self : this);
