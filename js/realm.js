/* The Ninth Rank: the rules, without any page code (node-testable, tools/tests/realm.js). The worlds come from
   js/realm_gen.js, what the King keeps between worlds (experience, skills) from js/realm_skills.js. The page
   (js/realm_view.js) draws it all in 3D and plays the events this file hands back.

   You are the last King on a board the size of a kingdom. The world moves when you move, as in chess: your move,
   your allies' moves, then every enemy's move, each by its piece's rules. Landing on an enemy takes it. An enemy
   that can reach your square takes a heart. Taken pieces leave their essence: with it you move as that piece for
   one move. Taken pieces also leave experience: levels, and a skill tree that stays with you from world to world.
   The enemies live in camps and walk patrols; take a camp's captain and the camp is yours, an outpost with a warm
   fire. In the cold lands warmth drains away from the fires; at nothing, the cold takes hearts. Ice slides. Raids
   come looking for you. Seven wardens hold crown shards; five open the gate of the court, where the Grand Queen
   waits; beyond her the next rank: another world, harder, with you as you are.

   Squares: x east, y north, index y * W + x. Heights 0..3; a step climbs or drops one level, knights two. */
(function (root) {
  'use strict';
  var G = typeof module !== 'undefined' && module.exports ? require('./realm_gen.js') : root.RealmGen;
  var SK = typeof module !== 'undefined' && module.exports ? require('./realm_skills.js') : root.RealmSkills;
  var W = G.W, H = G.H, RS = G.RS, KIND = G.KIND, KNAME = G.KNAME, BLOCK = G.BLOCK, idx = G.idx, inside = G.inside, regionOf = G.regionOf, regionDiff = G.regionDiff, rng = G.rng;
  var VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 20, A: 30 };
  var ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], ALL8 = ORTH.concat(DIAG);
  var KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  var SHARDS_NEEDED = 5, REACH = 7, HEAT_RANGE = 2, WARMTH = 30; // thirty moves of cold between fires, a blizzard halves that
  var dist = function (ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); };

  /* ---------- the state of a game ---------- */
  // opts: { seed, rank, meta (what the King keeps), carry: { ess, maxHearts } from the world before }
  function fresh(opts) {
    opts = opts || {};
    var seed = (opts.seed == null ? (Date.now() ^ Math.floor(Math.random() * 1e9)) : opts.seed) >>> 0;
    var rank = opts.rank || 1, meta = opts.meta || SK.freshMeta();
    var mods = SK.modifiersFor(rank, seed), diff = SK.difficulty(rank);
    var world = G.build(seed, rank, opts.kind, mods, diff);
    var sr = rng((seed * 7919) >>> 0);
    var pool = sr.shuffle(SK.BOUNTIES.map(function (b) { return b.id; }));
    var S = { v: 2, seed: seed, rank: rank, kind: world.kind, turn: 0, over: null, meta: meta,
      p: { x: world.start[0], y: world.start[1], hearts: 3, maxHearts: 3, ess: { N: 0, B: 0, R: 0, Q: 0 }, form: 'K', shards: 0, deaths: 0, kills: 0, facing: [1, 0],
        warmth: WARMTH, maxWarmth: WARMTH, chill: 0, xpWorld: 0, level: SK.levelOf(meta.xp || 0), cool: {}, onIce: false },
      shrine: null, allies: [], ents: world.ents, nextId: world.nextId, used: {}, read: {}, gateOpen: false, arena: null, explored: {}, rng: sr.s,
      camps: {}, bounties: [], pool: pool, weather: { kind: 'clear', left: 40 + sr.int(30) }, raids: { next: 40, n: 0 },
      stats: { ambush: 0, frostWalk: 0, formKills: {}, chests: 0, reads: 0, frees: 0, raids: 0, camps: 0, wardens: 0, levelsHere: 0 } };
    S.world = world;
    S.p.maxHearts = 3 + sk(S, 'skin'); S.p.hearts = S.p.maxHearts;
    S.p.maxWarmth = WARMTH + 8 * sk(S, 'hearth'); S.p.warmth = S.p.maxWarmth;
    if (opts.carry) { if (opts.carry.ess) Object.keys(S.p.ess).forEach(function (t) { S.p.ess[t] = Math.min(essMax(S), opts.carry.ess[t] || 0); }); if (opts.carry.maxHearts) { S.p.maxHearts = Math.max(S.p.maxHearts, opts.carry.maxHearts); S.p.hearts = S.p.maxHearts; } }
    for (var i = 0; i < 3; i++) drawBounty(S, null);
    meta.worlds = (meta.worlds || 0) + 1;
    noteExplored(S);
    return S;
  }
  function sk(S, id) { return SK.rank(S.meta, id); }
  function essMax(S) { return 9 + 3 * sk(S, 'well'); }
  function allyCap(S) { return 4 + 2 * sk(S, 'rally'); }
  var hasMod = function (S, m) { return S.world.mods.indexOf(m) >= 0; };
  // the world is built again from the seed when a save comes back
  function toSave(S) {
    return { v: 2, seed: S.seed, rank: S.rank, kind: S.kind, turn: S.turn, over: S.over, meta: S.meta, p: S.p, shrine: S.shrine, allies: S.allies, nextId: S.nextId, used: S.used, read: S.read, gateOpen: S.gateOpen, arena: S.arena, explored: S.explored, rng: S.rng,
      camps: S.camps, bounties: S.bounties, pool: S.pool, weather: S.weather, raids: S.raids, stats: S.stats, where: regionName(S), kindName: S.world.kindName,
      ents: S.ents.filter(function (e) { return !e.dead; }).map(function (e) { var o = {}; Object.keys(e).forEach(function (f) { if (e[f] !== undefined && e[f] !== null && e[f] !== false) o[f] = e[f]; }); return o; }) };
  }
  function fromSave(o) {
    if (!o || typeof o !== 'object' || typeof o.seed !== 'number') return null;
    if (o.v !== 2) return null; // the worlds before the skill tree cannot come back; a new one begins
    var S = fresh({ seed: o.seed, rank: o.rank || 1, kind: o.kind, meta: o.meta || SK.freshMeta() });
    S.meta.worlds = Math.max(1, (S.meta.worlds || 1) - 1);
    ['turn', 'over', 'p', 'shrine', 'allies', 'nextId', 'used', 'read', 'gateOpen', 'arena', 'explored', 'rng', 'camps', 'bounties', 'pool', 'weather', 'raids', 'stats'].forEach(function (f) { if (o[f] !== undefined) S[f] = o[f]; });
    if (Array.isArray(o.ents)) S.ents = o.ents.filter(function (e) { return !e.dead; });
    S.p.ess = Object.assign({ N: 0, B: 0, R: 0, Q: 0 }, S.p.ess || {});
    S.p.cool = S.p.cool || {};
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
  var regionAt = function (S, x, y) { return S.world.regions[regionOf(x, y)]; };
  var regionName = function (S) { return regionAt(S, S.p.x, S.p.y).name; };
  // the day: the sun's height for the turn (the long night keeps it low twice as long)
  function dayElev(S) {
    var f = ((S.turn + 36) % 240) / 240, e = Math.sin(f * Math.PI * 2);
    if (hasMod(S, 'night')) e = e - 0.5; // two thirds of the day are night
    return Math.max(-1, Math.min(1, e));
  }
  var isNight = function (S) { return dayElev(S) < 0; };

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
    if (S.arena && S.arena.closed && isArenaEdgeGate(S, x, y)) return false; // the gateway is shut while the warden stands
    if (side === 'b' && (kk === KIND.portal || kk === KIND.shrine || kk === KIND.cage || kk === KIND.chest)) return false; // the enemies walk round the things of the world
    return true;
  }
  function isArenaEdgeGate(S, x, y) { var c = S.world.castles[S.arena.castle]; return c && c.gate[0] === x && (c.gate[1] === y || (c.court && c.gate[1] + 1 === y)); }
  var hgt = function (S, x, y) { return S.world.h[idx(x, y)]; };
  var isIce = function (S, x, y) { return inside(x, y) && S.world.k[idx(x, y)] === KIND.ice; };
  /* Ice: a piece that steps onto it keeps going the same way until the ice ends or something stands in the way
     (an enemy in the way is taken). Thin ice carries it two squares further onto the ground. */
  function iceSlide(S, x, y, d, side, firstCap) {
    var cx = x + d[0], cy = y + d[1], path = [], cap = firstCap || null, extra = hasMod(S, 'thin') ? 2 : 0;
    if (cap || !isIce(S, cx, cy)) return null;
    for (var s = 0; s < 40; s++) {
      var nx = cx + d[0], ny = cy + d[1];
      if (!tileFree(S, nx, ny, side) || Math.abs(hgt(S, nx, ny) - hgt(S, cx, cy)) > 1) break;
      var o = at(S, nx, ny);
      if (o) { if (o.side === side) break; cap = o; path.push([cx, cy]); cx = nx; cy = ny; break; }
      path.push([cx, cy]); cx = nx; cy = ny;
      if (S.world.k[idx(cx, cy)] === KIND.portal) break;
      // off the ice: the slide ends on the first square of ground (thin ice carries it two squares further)
      if (!isIce(S, cx, cy)) { if (extra > 0) extra--; else break; }
    }
    if (!path.length) return null;
    return { x: cx, y: cy, cap: cap, path: path, slide: true };
  }
  /* The moves of a piece of type t on (x, y) for side: [{ x, y, cap, path }]. */
  function movesOf(S, t, x, y, side, dir, noIce) {
    var out = [], player = side === 'w' && x === S.p.x && y === S.p.y, maxSlide = player ? 40 : REACH;
    var consider = function (nx, ny, maxClimb, path, d) {
      if (!tileFree(S, nx, ny, side)) return 'stop';
      if (Math.abs(hgt(S, nx, ny) - hgt(S, path && path.length ? path[path.length - 1][0] : x, path && path.length ? path[path.length - 1][1] : y)) > maxClimb) return 'stop';
      var o = at(S, nx, ny);
      if (o) { if (o.side === side) return 'stop'; out.push({ x: nx, y: ny, cap: o, path: path || [] }); return 'stop'; }
      var sl = !noIce && d ? iceSlide(S, x, y, d, side, null) : null;
      if (sl) { out.push(sl); return 'stop'; }
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
    if (t === 'K') ALL8.forEach(function (d) { consider(x + d[0], y + d[1], 1, null, d); });
    else if (t === 'N') KN.forEach(function (d) { consider(x + d[0], y + d[1], 2, null, Math.abs(d[0]) > Math.abs(d[1]) ? [d[0] / 2, 0] : [0, d[1] / 2]); });
    else if (t === 'B') slide(DIAG);
    else if (t === 'R') slide(ORTH);
    else if (t === 'Q') slide(ALL8);
    else if (t === 'A') { slide(ALL8); KN.forEach(function (d) { consider(x + d[0], y + d[1], 2); }); }
    else if (t === 'P') {
      var d = dir || [0, 1], fx = x + d[0], fy = y + d[1];
      if (tileFree(S, fx, fy, side) && !at(S, fx, fy) && Math.abs(hgt(S, fx, fy) - hgt(S, x, y)) <= 1) { var sl2 = !noIce ? iceSlide(S, x, y, d, side, null) : null; out.push(sl2 || { x: fx, y: fy, cap: null, path: [] }); }
      var sides = d[0] === 0 ? [[1, d[1]], [-1, d[1]]] : [[d[0], 1], [d[0], -1]];
      sides.forEach(function (c) { var cx = x + c[0], cy = y + c[1]; if (!tileFree(S, cx, cy, side)) return; var o = at(S, cx, cy); if (o && o.side !== side && Math.abs(hgt(S, cx, cy) - hgt(S, x, y)) <= 1) out.push({ x: cx, y: cy, cap: o, path: [] }); });
    }
    return out;
  }
  // the cost of a form move: one essence, two when frozen
  function formCost(S, form) { return form === 'K' ? 0 : S.p.warmth <= 0 ? 2 : 1; }
  function playerMoves(S, form) {
    form = form || S.p.form;
    if (form !== 'K' && !(S.p.ess[form] >= formCost(S, form))) return [];
    return movesOf(S, form, S.p.x, S.p.y, 'w');
  }
  // the squares the enemies within reach attack, and who attacks the player's square (a stunned piece attacks nothing)
  function threats(S, range) {
    range = range || 18;
    var sq = {}, atPlayer = [];
    S.ents.forEach(function (e) {
      if (e.dead || e.stun > 0 || Math.abs(e.x - S.p.x) > range || Math.abs(e.y - S.p.y) > range) return;
      var ms = e.t === 'P' ? pawnAttacks(S, e) : movesOf(S, e.t, e.x, e.y, 'b', e.dir, true);
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
  // the warmth of a square: a fire, a torch, a spring or a shrine within two squares
  function nearHeat(S, x, y) {
    for (var dy = -HEAT_RANGE; dy <= HEAT_RANGE; dy++) for (var dx = -HEAT_RANGE; dx <= HEAT_RANGE; dx++) {
      if (!inside(x + dx, y + dy)) continue;
      var kk = S.world.k[idx(x + dx, y + dy)];
      if (kk === KIND.campfire || kk === KIND.torch || kk === KIND.spring || kk === KIND.shrine) return true;
    }
    return false;
  }
  var isCold = function (S, x, y) { return regionAt(S, x, y).cold && !nearHeat(S, x, y); };

  /* ---------- a turn ---------- */
  function gainEss(S, t, n) { if (S.p.ess[t] == null) return; S.p.ess[t] = Math.min(essMax(S), S.p.ess[t] + n); }
  function srand(S) { var r = rng(S.rng); var v = r.next(); S.rng = r.s; return v; }
  function gainXp(S, n, ev, at) {
    if (sk(S, 'stand') && S.p.hearts === 1) n *= 2;
    S.meta.xp = (S.meta.xp || 0) + n; S.p.xpWorld += n;
    ev.push({ e: 'xp', n: n, at: at || [S.p.x, S.p.y] });
    var lvl = SK.levelOf(S.meta.xp);
    if (lvl > S.p.level) { S.p.level = lvl; S.stats.levelsHere++; ev.push({ e: 'levelUp', level: lvl, points: SK.pointsLeft(S.meta) }); }
  }
  /* The player plays form f to (x, y): the move, what the square does, then the allies, then the enemies, then the
     cold and the weather. Returns the events for the page, or null if the move is not possible. */
  function play(S, x, y, form) {
    if (S.over && S.over.won === false) return null;
    form = form || S.p.form;
    var ms = playerMoves(S, form), m = null;
    for (var i = 0; i < ms.length; i++) if (ms[i].x === x && ms[i].y === y) m = ms[i];
    if (!m) return null;
    var ev = [], from = [S.p.x, S.p.y];
    if (form !== 'K') {
      var cost = formCost(S, form);
      if (sk(S, 'echo') && srand(S) < 0.25) { cost = 0; ev.push({ e: 'echo' }); }
      S.p.ess[form] = Math.max(0, S.p.ess[form] - cost);
    }
    S.p.facing = [Math.sign(x - from[0]) || S.p.facing[0], Math.sign(y - from[1]) || S.p.facing[1]];
    // a blow that only wounds (a captain, a veteran) leaves the King where he stands
    var stay = !!(m.cap && m.cap.hp > 1 && !m.cap.warden && !m.cap.grand);
    ev.push({ e: stay ? 'strike' : 'move', who: 'p', form: form, from: from, to: [x, y], path: m.path, slide: !!m.slide });
    if (m.cap) capture(S, m.cap, ev, 'p', form);
    if (!stay) { S.p.x = x; S.p.y = y; }
    S.p.onIce = isIce(S, S.p.x, S.p.y);
    S.turn++;
    // the knight's landing stuns the enemies around it
    if (form === 'N' && sk(S, 'thunder')) { var ids = []; S.ents.forEach(function (e) { if (!e.dead && dist(e.x, e.y, S.p.x, S.p.y) === 1) { e.stun = 1; ids.push(e.id); } }); if (ids.length) ev.push({ e: 'stun', ids: ids }); }
    arrive(S, ev);
    if (S.over && S.over.won) return ev;
    // double time: a form move that does not end the turn
    if (form !== 'K' && sk(S, 'double') && S.turn - (S.p.cool.double || -99) >= 10) { S.p.cool.double = S.turn; ev.push({ e: 'double' }); noteExplored(S); ev.push({ e: 'threat', n: threats(S, 18).atPlayer.length }); return ev; }
    endTurn(S, ev);
    return ev;
  }
  // a turn in which the player stands still (by a fire: he warms himself and rests)
  function wait(S) {
    if (S.over && S.over.won === false) return null;
    var ev = [{ e: 'wait' }];
    S.turn++;
    var kk = S.world.k[idx(S.p.x, S.p.y)];
    if ((kk === KIND.campfire || kk === KIND.spring) && S.p.hearts < S.p.maxHearts && S.turn % 3 === 0) { S.p.hearts++; ev.push({ e: 'rest', hearts: S.p.hearts }); }
    endTurn(S, ev);
    return ev;
  }
  function endTurn(S, ev) {
    alliesTurn(S, ev);
    enemiesTurn(S, ev);
    if (S.over && S.over.won === false) return;
    coldTurn(S, ev);
    weatherTurn(S, ev);
    raidTurn(S, ev);
    S.ents.forEach(function (e) { if (e.stun > 0) e.stun--; });
    noteExplored(S);
    ev.push({ e: 'threat', n: threats(S, 18).atPlayer.length });
  }
  function capture(S, o, ev, by, form) {
    if (o.player) return;
    var ally = S.allies.indexOf(o) >= 0;
    if (ally) {
      if (o.hp > 1) { o.hp--; ev.push({ e: 'allyHit', id: o.id, t: o.t, at: [o.x, o.y] }); return; }
      S.allies.splice(S.allies.indexOf(o), 1); ev.push({ e: 'allyLost', id: o.id, t: o.t, at: [o.x, o.y] }); return;
    }
    var wasAsleep = !o.awake;
    o.hp--;
    if (o.hp > 0) {
      if (!(o.warden || o.grand)) { o.awake = true; ev.push({ e: 'wound', id: o.id, left: o.hp, at: [o.x, o.y] }); return; }
      // a warden or the Grand Queen: a crown is struck off, it flees within its walls and calls guards
      var c = S.world.castles[o.warden || 8], spots = [];
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var sx = c.x + dx, sy = c.y + dy; if (S.world.k[idx(sx, sy)] === KIND.arena && !at(S, sx, sy) && (Math.abs(dx) + Math.abs(dy)) >= 3) spots.push([sx, sy]); }
      var to = spots.length ? spots[Math.floor(srand(S) * spots.length)] : [o.x, o.y];
      ev.push({ e: 'crownOff', id: o.id, left: o.hp, from: [o.x, o.y], to: to });
      o.x = to[0]; o.y = to[1];
      var guards = o.grand ? ['B', 'R', 'N'] : ['N', 'B'];
      if (sk(S, 'sovereign')) guards = guards.slice(0, Math.ceil(guards.length / 2));
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
    ev.push({ e: 'capture', id: o.id, t: o.t, at: [o.x, o.y], by: by, warden: o.warden || null, grand: !!o.grand, captain: o.captain || null, name: o.name });
    if (by !== 'p') return;
    S.p.kills++; S.meta.kills = (S.meta.kills || 0) + 1;
    var extra = sk(S, 'harvest');
    if (o.t === 'P') gainEss(S, srand(S) < 0.5 ? 'N' : 'B', 1 + extra);
    else if (S.p.ess[o.t] != null) gainEss(S, o.t, 2 + extra);
    gainXp(S, SK.xpOf(o.t, S.rank), ev, [o.x, o.y]);
    if (wasAsleep && !o.warden && !o.grand) { S.stats.ambush++; bountyNote(S, 'ambush', null, ev); }
    bountyNote(S, 'kill', o.t, ev);
    if (form && form !== 'K') { S.stats.formKills[form] = (S.stats.formKills[form] || 0) + 1; bountyNote(S, 'formkill', form, ev); }
    if (o.captain) {
      gainXp(S, SK.xpOf('captain', S.rank), ev, [o.x, o.y]);
      if (o.captain === 'raid') { S.stats.raids++; bountyNote(S, 'raid', null, ev); }
      else if (S.world.camps[o.captain] && !(S.camps[o.captain] && S.camps[o.captain].cleared)) {
        S.camps[o.captain] = { cleared: true, turn: S.turn };
        S.stats.camps++; S.meta.camps = (S.meta.camps || 0) + 1;
        gainXp(S, SK.xpOf('camp', S.rank), ev, [o.x, o.y]);
        ev.push({ e: 'campCleared', id: o.captain, name: S.world.camps[o.captain].name, at: [S.world.camps[o.captain].x, S.world.camps[o.captain].y] });
        bountyNote(S, 'camp', null, ev);
      }
    }
    if (o.warden) {
      var n = sk(S, 'rain') ? 5 : 3;
      ['N', 'B', 'R', 'Q'].forEach(function (t) { gainEss(S, t, n); });
      S.p.shards++; S.stats.wardens++; S.meta.wardens = (S.meta.wardens || 0) + 1;
      ev.push({ e: 'shard', n: S.p.shards, warden: o.warden, name: o.name });
      S.arena = null;
      bountyNote(S, 'warden', null, ev);
      if (S.p.shards >= SHARDS_NEEDED && !S.gateOpen) { openGate(S); ev.push({ e: 'gate' }); }
    }
    if (o.grand) {
      S.over = { won: true, turn: S.turn, kills: S.p.kills, deaths: S.p.deaths, rank: S.rank };
      S.meta.bestRank = Math.max(S.meta.bestRank || 1, S.rank + 1);
      S.arena = null;
      ev.push({ e: 'won', rank: S.rank });
    }
  }
  function arrive(S, ev) {
    var w = S.world, i = idx(S.p.x, S.p.y), kk = w.k[i], o = w.objs[i];
    if (kk === KIND.portal && w.portals[i] != null) {
      var j = w.portals[i], tx = j % W, ty = Math.floor(j / W);
      if (!at(S, tx, ty)) { ev.push({ e: 'portal', from: [S.p.x, S.p.y], to: [tx, ty] }); S.p.x = tx; S.p.y = ty; }
    } else if (kk === KIND.shrine) {
      var healed = S.p.maxHearts - S.p.hearts;
      S.p.hearts = S.p.maxHearts; S.shrine = [S.p.x, S.p.y]; S.p.warmth = S.p.maxWarmth;
      if (sk(S, 'bond')) ['N', 'B', 'R', 'Q'].forEach(function (t) { gainEss(S, t, 2); });
      ev.push({ e: 'shrine', healed: healed });
    } else if (kk === KIND.campfire && o && o.camp) {
      // a camp's fire: an outpost once the captain has fallen, the way back from then on
      if (S.camps[o.camp] && S.camps[o.camp].cleared) {
        var was = S.shrine && S.shrine[0] === S.p.x && S.shrine[1] === S.p.y;
        S.shrine = [S.p.x, S.p.y]; S.p.warmth = S.p.maxWarmth;
        if (sk(S, 'bond') && !was) ['N', 'B', 'R', 'Q'].forEach(function (t) { gainEss(S, t, 2); });
        ev.push({ e: 'outpost', id: o.camp, first: !was });
      }
    } else if (kk === KIND.chest && !S.used[i]) {
      if (o.gift === 'camp' && !(S.camps[o.camp] && S.camps[o.camp].cleared)) ev.push({ e: 'locked', camp: o.camp });
      else {
        S.used[i] = 1; S.stats.chests++;
        if (o.gift === 'heart') { S.p.maxHearts = Math.min(8, S.p.maxHearts + 1); S.p.hearts = S.p.maxHearts; }
        else if (o.gift === 'camp') { ['N', 'B', 'R', 'Q'].forEach(function (t) { gainEss(S, t, 1 + (sk(S, 'quarter') ? 1 : 0)); }); S.p.hearts = Math.min(S.p.maxHearts, S.p.hearts + (sk(S, 'quarter') ? 2 : 1)); }
        else gainEss(S, o.gift, sk(S, 'quarter') ? 5 : 3);
        ev.push({ e: 'chest', gift: o.gift });
        bountyNote(S, 'chest', null, ev);
      }
    } else if (kk === KIND.cage && !S.used[i]) {
      S.used[i] = 1;
      var spot = freeNear(S, S.p.x, S.p.y);
      if (spot && S.allies.length < allyCap(S)) { var a = { id: S.nextId++, side: 'w', t: o.ally, x: spot[0], y: spot[1], hp: sk(S, 'veteran') ? 2 : 1 }; S.allies.push(a); S.stats.frees++; ev.push({ e: 'freed', id: a.id, t: a.t, at: spot }); bountyNote(S, 'free', null, ev); }
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
      if (mo && mo.kind === 'monolith' && !S.read[mo.text]) { S.read[mo.text] = 1; S.stats.reads++; ev.push({ e: 'monolith', text: mo.text, at: [mx, my] }); bountyNote(S, 'read', null, ev); }
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
      var from = [a.x, a.y], stay = !!(pick.cap && pick.cap.hp > 1 && !pick.cap.warden && !pick.cap.grand);
      if (pick.cap) capture(S, pick.cap, ev, 'ally');
      if (stay) { ev.push({ e: 'strike', who: 'a', id: a.id, t: a.t, from: from, to: [pick.x, pick.y] }); return; }
      a.x = pick.x; a.y = pick.y;
      ev.push({ e: 'move', who: 'a', id: a.id, t: a.t, from: from, to: [a.x, a.y], path: pick.path, slide: !!pick.slide });
    });
  }
  // how close the King may come before a piece notices him
  function wakeRange(S, e) {
    var r = e.t === 'P' ? 7 : 10;
    r -= 2 * sk(S, 'scout');
    if (S.weather.kind === 'blizzard') r -= 3;
    if (isNight(S) && hasMod(S, 'night')) r += 3;
    return Math.max(3, r);
  }
  /* The enemies, nearest first: one that can take the King does (the King loses a heart and is pushed back); one that
     can take an ally does; an awake one closes in; a sleeping one wakes when the King comes near, walks its patrol
     if it has one, else holds its ground (a pawn always marches when awake). Pawns that reach the golden squares
     become queens. A piece that has lost the King for a while goes back to sleep. */
  function enemiesTurn(S, ev) {
    var struck = 0, near = S.ents.filter(function (e) { return !e.dead && (dist(e.x, e.y, S.p.x, S.p.y) <= 20 || e.patrol || e.raid); });
    near.sort(function (a, b) { return dist(a.x, a.y, S.p.x, S.p.y) - dist(b.x, b.y, S.p.x, S.p.y); });
    near.forEach(function (e) {
      if (e.dead || S.over) return;
      if (e.stun > 0) return;
      var d = dist(e.x, e.y, S.p.x, S.p.y);
      if (!e.awake && d <= wakeRange(S, e)) { e.awake = true; e.lost = 0; ev.push({ e: 'wake', id: e.id }); }
      if (e.awake && !e.guard && !e.warden && !e.grand && !e.raid) {
        if (d > 14) { e.lost = (e.lost || 0) + 1; if (e.lost > 5) { e.awake = false; e.lost = 0; ev.push({ e: 'calm', id: e.id }); } } else e.lost = 0;
      }
      var ms = movesOf(S, e.t, e.x, e.y, 'b', e.dir);
      if (e.warden || e.grand) ms = ms.filter(function (m) { return inHall(S, e, m.x, m.y); });
      var hitKing = ms.filter(function (m) { return m.cap && m.cap.player; })[0];
      if (hitKing) { strike(S, e, ev, struck === 0); struck++; return; }
      var hitAlly = ms.filter(function (m) { return m.cap && S.allies.indexOf(m.cap) >= 0; });
      if (hitAlly.length) { hitAlly.sort(function (p, q) { return VALUE[q.cap.t] - VALUE[p.cap.t]; }); var hm = hitAlly[0]; capture(S, hm.cap, ev, 'enemy'); if (S.allies.indexOf(hm.cap) < 0) { ev.push({ e: 'move', who: 'e', id: e.id, t: e.t, from: [e.x, e.y], to: [hm.x, hm.y], path: hm.path }); e.x = hm.x; e.y = hm.y; } return; }
      if (!e.awake) { if (e.patrol) patrolStep(S, e, ev); return; }
      var quiet = ms.filter(function (m) { return !m.cap; });
      if (e.t === 'P' && !quiet.length) {
        // a pawn with nothing ahead of it turns to face the King instead of standing there for good
        var ddx = S.p.x - e.x, ddy = S.p.y - e.y, cands = Math.abs(ddx) >= Math.abs(ddy) ? [[Math.sign(ddx), 0], [0, Math.sign(ddy)]] : [[0, Math.sign(ddy)], [Math.sign(ddx), 0]];
        for (var ci = 0; ci < cands.length; ci++) {
          var nd = cands[ci];
          if (!nd[0] && !nd[1]) continue;
          if (e.dir && nd[0] === e.dir[0] && nd[1] === e.dir[1]) continue;
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
        if (pick && Math.hypot(pick.x - S.p.x, pick.y - S.p.y) >= Math.hypot(e.x - S.p.x, e.y - S.p.y) && d <= 2) pick = null;
      }
      if (!pick) return;
      var f0 = [e.x, e.y];
      e.x = pick.x; e.y = pick.y;
      ev.push({ e: 'move', who: 'e', id: e.id, t: e.t, from: f0, to: [e.x, e.y], path: pick.path, slide: !!pick.slide });
      if (e.t === 'P') { e.marched = (e.marched || 0) + 1; if (S.world.k[idx(e.x, e.y)] === KIND.promo || (hasMod(S, 'hungry') && e.marched >= 4)) { e.t = 'Q'; e.dir = null; ev.push({ e: 'promote', id: e.id, at: [e.x, e.y] }); } }
    });
  }
  // a patrol walks its beat one square at a time, round the pieces in its way
  function patrolStep(S, e, ev) {
    var r = e.patrol.route; if (!r || !r.length) return;
    var tgt = r[e.patrol.i % r.length];
    if (tgt[0] === e.x && tgt[1] === e.y) { e.patrol.i = (e.patrol.i + 1) % r.length; tgt = r[e.patrol.i]; }
    var best = null, bd = dist(e.x, e.y, tgt[0], tgt[1]);
    ALL8.forEach(function (d) {
      var nx = e.x + d[0], ny = e.y + d[1];
      if (!tileFree(S, nx, ny, 'b') || at(S, nx, ny) || Math.abs(hgt(S, nx, ny) - hgt(S, e.x, e.y)) > 1 || S.world.k[idx(nx, ny)] === KIND.arena) return;
      var dd = dist(nx, ny, tgt[0], tgt[1]) + (Math.abs(nx - tgt[0]) + Math.abs(ny - tgt[1])) * 0.01;
      if (dd < bd) { bd = dd; best = [nx, ny]; }
    });
    if (!best) return;
    var f0 = [e.x, e.y];
    e.x = best[0]; e.y = best[1];
    if (e.t === 'P') e.dir = [Math.sign(best[0] - f0[0]), Math.sign(best[1] - f0[1])];
    ev.push({ e: 'move', who: 'e', id: e.id, t: e.t, from: f0, to: best, path: [], patrol: true });
    if (best[0] === tgt[0] && best[1] === tgt[1]) e.patrol.i = (e.patrol.i + 1) % r.length;
  }
  // an enemy reaches the King's square
  function strike(S, e, ev, first) {
    var from = [e.x, e.y];
    if (sk(S, 'bulwark') && S.turn - (S.p.cool.bulwark == null ? -99 : S.p.cool.bulwark) >= 20) { S.p.cool.bulwark = S.turn; ev.push({ e: 'parry', id: e.id, t: e.t, from: from }); return; }
    var pushTo = first && !sk(S, 'iron') ? pushSquare(S, from) : null;
    S.p.hearts--;
    ev.push({ e: 'hit', id: e.id, t: e.t, from: from, hearts: S.p.hearts, pushed: pushTo });
    if (pushTo) { e.x = S.p.x; e.y = S.p.y; S.p.x = pushTo[0]; S.p.y = pushTo[1]; }
    if (S.p.hearts <= 0) {
      if (sk(S, 'wind') && S.turn - (S.p.cool.wind == null ? -999 : S.p.cool.wind) >= 60) { S.p.hearts = 1; S.p.cool.wind = S.turn; ev.push({ e: 'secondWind' }); }
      else mated(S, ev);
    }
  }
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
  // the King falls: back to the last shrine or outpost, hearts full, half the essence gone; a warden fight is undone
  function mated(S, ev) {
    S.p.deaths++;
    var back = S.shrine || S.world.start.slice();
    ['N', 'B', 'R', 'Q'].forEach(function (t) { S.p.ess[t] = Math.floor(S.p.ess[t] / 2); });
    S.p.hearts = S.p.maxHearts; S.p.warmth = S.p.maxWarmth; S.p.chill = 0;
    if (S.arena) {
      var c = S.world.castles[S.arena.castle];
      S.ents.forEach(function (e) { if (e.warden === c.region || (c.court && e.grand)) { e.hp = e.grand ? SK.difficulty(S.rank).grandHp : SK.difficulty(S.rank).wardenHp; if (hasMod(S, 'iron')) e.hp++; e.x = c.x; e.y = c.y; } if (e.summoned && (e.guard === c.region)) e.dead = true; });
      S.arena = null;
    }
    S.p.x = back[0]; S.p.y = back[1];
    if (at(S, back[0], back[1]) && !at(S, back[0], back[1]).player) { var fn = freeNear(S, back[0], back[1]); if (fn) { S.p.x = fn[0]; S.p.y = fn[1]; } }
    S.allies = [];
    ev.push({ e: 'mated', to: [S.p.x, S.p.y], deaths: S.p.deaths });
  }

  /* ---------- the cold, the weather, the raids ---------- */
  function coldTurn(S, ev) {
    var p = S.p, cold = isCold(S, p.x, p.y), heat = nearHeat(S, p.x, p.y);
    if (!regionAt(S, p.x, p.y).cold && !heat) { p.warmth = Math.min(p.maxWarmth, p.warmth + 2); p.chill = 0; S.stats.frostWalk = 0; return; }
    if (heat) { p.warmth = Math.min(p.maxWarmth, p.warmth + 6); p.chill = 0; if (regionAt(S, p.x, p.y).cold) ev.push({ e: 'cold', warmth: p.warmth, max: p.maxWarmth, warming: true }); return; }
    var drain = S.weather.kind === 'blizzard' ? 2 : 1;
    if (sk(S, 'hearth')) drain = S.weather.kind === 'blizzard' ? 1 : (S.turn % 2 ? 1 : 0);
    p.warmth = Math.max(0, p.warmth - drain);
    if (p.warmth <= 0) {
      p.chill++; S.stats.frostWalk = 0;
      if (p.chill % 3 === 0) { p.hearts--; ev.push({ e: 'frostbite', hearts: p.hearts }); if (p.hearts <= 0) { mated(S, ev); return; } }
    } else { S.stats.frostWalk++; if (S.stats.frostWalk === 20) bountyNote(S, 'frost', null, ev); }
    ev.push({ e: 'cold', warmth: p.warmth, max: p.maxWarmth, frozen: p.warmth <= 0, blizzard: S.weather.kind === 'blizzard' });
  }
  function weatherTurn(S, ev) {
    var wz = S.weather;
    wz.left--;
    if (wz.left > 0) return;
    var cold = S.world.cold, bliz = hasMod(S, 'blizzard');
    if (cold) { if (wz.kind === 'clear') { wz.kind = 'blizzard'; wz.left = bliz ? 30 : 14; } else { wz.kind = 'clear'; wz.left = bliz ? 15 : 45 + Math.floor(srand(S) * 30); } }
    else if (S.kind === 'catacombs') { wz.kind = 'clear'; wz.left = 999; }
    else { if (wz.kind === 'clear') { wz.kind = 'rain'; wz.left = 18 + Math.floor(srand(S) * 10); } else { wz.kind = 'clear'; wz.left = 70 + Math.floor(srand(S) * 40); } }
    ev.push({ e: 'weather', kind: wz.kind });
  }
  // a raiding party comes looking for the King: a captain and his band at the edge of sight, awake
  function raidTurn(S, ev) {
    if (S.turn < S.raids.next || S.arena || S.over) return;
    var every = SK.difficulty(S.rank).raidEvery; if (hasMod(S, 'raids')) every = Math.ceil(every / 2);
    S.raids.next = S.turn + every;
    var spots = [];
    for (var dy = -18; dy <= 18; dy++) for (var dx = -18; dx <= 18; dx++) {
      var d = Math.max(Math.abs(dx), Math.abs(dy)); if (d < 13) continue;
      var x = S.p.x + dx, y = S.p.y + dy;
      if (!inside(x, y) || !G.WALK[S.world.k[idx(x, y)]] || S.world.k[idx(x, y)] === KIND.arena || at(S, x, y)) continue;
      spots.push([x, y]);
    }
    if (spots.length < 6) return;
    var c = spots[Math.floor(srand(S) * spots.length)], n = ++S.raids.n;
    var band = ['P', 'P', 'N', 'B'];
    if (S.rank >= 2) band.push('R'); if (S.rank >= 4) band.push('Q');
    if (sk(S, 'sovereign')) band = band.slice(0, Math.ceil(band.length / 2));
    var seats = spots.filter(function (s) { return dist(s[0], s[1], c[0], c[1]) <= 2; });
    var cap = { id: S.nextId++, side: 'b', t: S.rank >= 3 ? 'R' : 'N', x: c[0], y: c[1], hp: 2, captain: 'raid', raid: n, awake: true, region: regionOf(c[0], c[1]), name: 'The Raid Captain' };
    S.ents.push(cap);
    var placed = [cap];
    band.forEach(function (t) { var s = seats.filter(function (q) { return !at(S, q[0], q[1]); })[0]; if (!s) return; var e = { id: S.nextId++, side: 'b', t: t, x: s[0], y: s[1], hp: 1, raid: n, awake: true, region: regionOf(s[0], s[1]), dir: t === 'P' ? [Math.sign(S.p.x - s[0]) || 1, 0] : null }; S.ents.push(e); placed.push(e); });
    ev.push({ e: 'raid', n: n, at: c, ids: placed.map(function (e) { return e.id; }) });
  }

  /* ---------- bounties ---------- */
  function drawBounty(S, ev) {
    if (!S.pool.length || S.bounties.filter(function (b) { return !b.done; }).length >= 3) return null;
    var id = S.pool.shift();
    var def = SK.bounty(id);
    if ((def.kind === 'frost') && !S.world.cold) return drawBounty(S, ev);
    var b = { id: id, n: 0, done: false };
    S.bounties.push(b);
    if (ev) ev.push({ e: 'bountyNew', id: id });
    return b;
  }
  function bountyNote(S, kind, t, ev) {
    S.bounties.forEach(function (b) {
      if (b.done) return;
      var def = SK.bounty(b.id);
      if (def.kind !== kind) return;
      if (def.t && def.t !== t) return;
      b.n++;
      if (b.n >= def.n) {
        b.done = true;
        var xp = SK.xpOf('bounty', S.rank); if (sk(S, 'hunter')) xp = Math.round(xp * 1.5);
        gainXp(S, xp, ev);
        var tt = ['N', 'B', 'R', 'Q'][Math.floor(srand(S) * 4)]; gainEss(S, tt, 2);
        ev.push({ e: 'bountyDone', id: b.id, name: def.name, xp: xp, ess: tt });
        drawBounty(S, ev);
      } else ev.push({ e: 'bounty', id: b.id, n: b.n, of: def.n });
    });
    S.bounties = S.bounties.filter(function (b) { return !b.done; }).concat(S.bounties.filter(function (b) { return b.done; })).slice(0, 6);
  }

  /* ---------- the skills in play ---------- */
  function takeSkill(S, id) {
    if (!SK.take(S.meta, id)) return false;
    if (id === 'skin') { S.p.maxHearts++; S.p.hearts = S.p.maxHearts; }
    if (id === 'hearth') { S.p.maxWarmth += 8; S.p.warmth = S.p.maxWarmth; }
    if (id === 'veteran') S.allies.forEach(function (a) { a.hp = Math.max(a.hp, 2); });
    return true;
  }
  function transmute(S, from, to) {
    if (!sk(S, 'transmute') || from === to || !(S.p.ess[from] >= 3) || S.p.ess[to] == null) return false;
    S.p.ess[from] -= 3; gainEss(S, to, 2);
    return true;
  }
  // hearthstone: back to the last shrine or outpost; it takes the turn
  function hearthstone(S) {
    if (!sk(S, 'hearthstone') || !S.shrine || S.arena) return null;
    if (S.turn - (S.p.cool.hearth == null ? -999 : S.p.cool.hearth) < 40) return null;
    var ev = [{ e: 'hearth', from: [S.p.x, S.p.y], to: S.shrine.slice() }];
    S.p.cool.hearth = S.turn;
    var back = S.shrine;
    S.p.x = back[0]; S.p.y = back[1];
    if (at(S, back[0], back[1]) && !at(S, back[0], back[1]).player) { var fn = freeNear(S, back[0], back[1]); if (fn) { S.p.x = fn[0]; S.p.y = fn[1]; } }
    S.turn++;
    endTurn(S, ev);
    return ev;
  }
  var hearthReady = function (S) { return sk(S, 'hearthstone') && !!S.shrine && !S.arena && S.turn - (S.p.cool.hearth == null ? -999 : S.p.cool.hearth) >= 40; };

  var api = { W: W, H: H, RS: RS, KIND: KIND, KNAME: KNAME, BLOCK: BLOCK, SHARDS_NEEDED: SHARDS_NEEDED, VALUE: VALUE, REACH: REACH, WARMTH: WARMTH, HEAT_RANGE: HEAT_RANGE,
    idx: idx, inside: inside, regionOf: regionOf, regionDiff: regionDiff, regionAt: regionAt, regionName: regionName, fresh: fresh, toSave: toSave, fromSave: fromSave, at: at, tileFree: tileFree, movesOf: movesOf, playerMoves: playerMoves, formCost: formCost,
    threats: threats, inCheck: inCheck, play: play, wait: wait, dist: dist, castleAround: castleAround, chunkKey: chunkKey, dayElev: dayElev, isNight: isNight, nearHeat: nearHeat, isCold: isCold, isIce: isIce, iceSlide: iceSlide, wakeRange: wakeRange,
    sk: sk, essMax: essMax, allyCap: allyCap, takeSkill: takeSkill, transmute: transmute, hearthstone: hearthstone, hearthReady: hearthReady, gen: G, skills: SK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Realm = api;
})(typeof self !== 'undefined' ? self : this);
