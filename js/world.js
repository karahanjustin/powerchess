/* The Gilded Crown: the world, without any page code (node-testable, tools/tests/world.js). The maps and what the
   people say live in js/world_maps.js. A map is rows of tile letters (TILES below) plus its things: doors (where they
   lead and where you arrive), people (a chess piece with a name and lines), signs, things to look at, barred doors.
   The state is one plain object (fresh()), kept in the saved modes as MS.world: the map, the King's square and the
   way he faces, the story flags, the steps walked.

   Squares are x (column) and y (row), y = 0 at the top. Directions: n, e, s, w. */
(function (root) {
  'use strict';
  var WM = root.WorldMaps || (typeof require !== 'undefined' ? require('./world_maps.js') : null);
  var DIRS = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
  // the tiles: block = cannot be walked on; tall = drawn over what stands behind it
  var TILES = {
    '.': { name: 'grass' }, ',': { name: 'flowers' }, '"': { name: 'tall grass' }, '=': { name: 'road' }, ':': { name: 'shore' },
    'w': { name: 'wheat' }, 'P': { name: 'paving' }, '_': { name: 'bridge' }, 'f': { name: 'floor' }, 'R': { name: 'rug' },
    'T': { name: 'tree', block: true, tall: true }, 't': { name: 'bush', block: true }, 'o': { name: 'rock', block: true },
    '~': { name: 'water', block: true }, '#': { name: 'wall', block: true }, 'H': { name: 'house wall', block: true },
    '^': { name: 'roof', block: true, tall: true }, 'D': { name: 'door' }, '|': { name: 'fence', block: true },
    'W': { name: 'well', block: true }, 'S': { name: 'sign', block: true }, 'X': { name: 'ruin', block: true, tall: true },
    'G': { name: 'tower gate', block: true }, 'c': { name: 'cave', block: true }, 'A': { name: 'shrine', block: true },
    'F': { name: 'fire', block: true }, 'n': { name: 'tent', block: true, tall: true }, 'v': { name: 'barrel', block: true },
    'C': { name: 'counter', block: true }, 'b': { name: 'bed', block: true }, 'k': { name: 'table', block: true },
    'K': { name: 'fireplace', block: true }, 'a': { name: 'anvil', block: true }, '!': { name: 'banner', block: true }
  };

  function fresh() {
    var s = WM.START;
    return { v: 1, started: false, map: s.map, x: s.x, y: s.y, dir: s.dir, flags: {}, steps: 0, seen: {}, npcs: {} };
  }
  function mapOf(W) { return WM.MAPS[W.map]; }
  function size(M) { return [M.rows[0].length, M.rows.length]; }
  function tile(M, x, y) {
    if (y < 0 || y >= M.rows.length || x < 0 || x >= M.rows[0].length) return '#';
    return M.rows[y].charAt(x);
  }
  // where a person stands now (they may have wandered from their start)
  function npcAt(W, n) { var p = W.npcs[W.map + ':' + n.id]; return p ? p : [n.x, n.y]; }
  // the thing on a square: a person (where they stand now) or a sign, door and so on
  function thingAt(W, x, y) {
    var M = mapOf(W), list = M.things || [];
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t.t === 'npc') { var p = npcAt(W, t); if (p[0] === x && p[1] === y) return t; }
      else if (t.x === x && t.y === y) return t;
    }
    return null;
  }
  function blocked(W, x, y) {
    var M = mapOf(W), c = tile(M, x, y), d = TILES[c];
    if (!d || d.block) return true;
    var t = thingAt(W, x, y);
    return !!(t && t.t === 'npc');
  }
  /* One step the King tries in direction d: he turns that way first; then he walks if the square is free. A door
     takes him to its map. Returns { moved, turned, door: map name when he went through one, bump: the thing he
     walked into } */
  function step(W, d) {
    var v = DIRS[d];
    if (!v) return { moved: false };
    var turned = W.dir !== d;
    W.dir = d;
    var x = W.x + v[0], y = W.y + v[1], M = mapOf(W);
    if (blocked(W, x, y)) return { moved: false, turned: turned, bump: thingAt(W, x, y) };
    W.x = x; W.y = y; W.steps++;
    if (tile(M, x, y) === 'D') {
      var door = thingAt(W, x, y);
      if (door && door.t === 'door') return enter(W, door);
    }
    return { moved: true, turned: turned };
  }
  function enter(W, door) {
    var from = W.map;
    W.map = door.to; W.x = door.at[0]; W.y = door.at[1];
    // facing away from the door he came through
    var M = mapOf(W);
    W.dir = tile(M, W.x, W.y + 1) === 'D' ? 'n' : tile(M, W.x, W.y - 1) === 'D' ? 's' : W.dir;
    var first = !W.seen[W.map];
    W.seen[W.map] = true;
    return { moved: true, door: W.map, from: from, first: first };
  }
  // the square in front of the King and what is there
  function front(W) { var v = DIRS[W.dir]; return [W.x + v[0], W.y + v[1]]; }
  function facing(W) { var f = front(W); return thingAt(W, f[0], f[1]); }
  /* What a thing says now: the first entry of its lines whose flags fit. Sets the entry's flag (call it when the
     lines have been read). Returns { lines, set } */
  function talk(W, key) {
    var list = WM.SAY[key] || [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.if && !W.flags[e.if]) continue;
      if (e.not && W.flags[e.not]) continue;
      return { lines: e.lines.slice(), set: e.set || null };
    }
    return { lines: [], set: null };
  }
  function done(W, said) { if (said && said.set) W.flags[said.set] = true; }
  /* The shortest walk to (tx, ty), as directions, around everything that blocks. A blocked target (a person, a
     sign): the walk ends next to it and the last direction turns him to face it. Null if there is no way. */
  function path(W, tx, ty) {
    var M = mapOf(W), sz = size(M), w = sz[0], h = sz[1];
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return null;
    if (tx === W.x && ty === W.y) return [];
    var goalBlocked = blocked(W, tx, ty), prev = {}, seen = {}, q = [[W.x, W.y]], key = function (x, y) { return y * w + x; };
    seen[key(W.x, W.y)] = true;
    var end = null, order = ['n', 'e', 's', 'w'];
    while (q.length) {
      var c = q.shift();
      if (!goalBlocked && c[0] === tx && c[1] === ty) { end = c; break; }
      if (goalBlocked && Math.abs(c[0] - tx) + Math.abs(c[1] - ty) === 1) { end = c; break; }
      for (var i = 0; i < 4; i++) {
        var v = DIRS[order[i]], nx = c[0] + v[0], ny = c[1] + v[1], k = key(nx, ny);
        if (seen[k] || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        // a door is only walked into as the last step (walking through it changes the map)
        if (blocked(W, nx, ny) || (tile(M, nx, ny) === 'D' && !(nx === tx && ny === ty))) continue;
        seen[k] = true; prev[k] = [c[0], c[1], order[i]];
        q.push([nx, ny]);
      }
    }
    if (!end) return null;
    var out = [], cur = end;
    while (!(cur[0] === W.x && cur[1] === W.y)) { var p = prev[key(cur[0], cur[1])]; out.unshift(p[2]); cur = [p[0], p[1]]; }
    if (goalBlocked) out.push(tx > end[0] ? 'e' : tx < end[0] ? 'w' : ty > end[1] ? 's' : 'n');
    return out;
  }
  /* People who wander stroll a little around where they started (seeded by the steps walked, so it stays the same
     on a replay); never onto the King or a blocked square. Called now and then by the page. */
  function wander(W, rand) {
    var M = mapOf(W), moved = [];
    (M.things || []).forEach(function (t) {
      if (t.t !== 'npc' || !t.wander || rand() > 0.35) return;
      var p = npcAt(W, t), dirs = ['n', 'e', 's', 'w'], d = dirs[Math.floor(rand() * 4)], v = DIRS[d];
      var nx = p[0] + v[0], ny = p[1] + v[1];
      if (Math.abs(nx - t.x) > t.wander || Math.abs(ny - t.y) > t.wander) return;
      if ((nx === W.x && ny === W.y) || blocked(W, nx, ny) || tile(M, nx, ny) === 'D') return;
      W.npcs[W.map + ':' + t.id] = [nx, ny];
      moved.push({ id: t.id, from: p, to: [nx, ny], dir: d });
    });
    return moved;
  }
  // an old or damaged save, filled up
  function migrate(o) {
    var f = fresh();
    if (!o || typeof o !== 'object' || !WM.MAPS[o.map]) return f;
    var out = Object.assign(f, o);
    ['flags', 'seen', 'npcs'].forEach(function (k) { if (!out[k] || typeof out[k] !== 'object') out[k] = {}; });
    if (blocked(out, out.x, out.y) && !(tile(mapOf(out), out.x, out.y) === 'D')) { var s = WM.START; out.map = s.map; out.x = s.x; out.y = s.y; }
    return out;
  }

  var api = { TILES: TILES, DIRS: DIRS, MAPS: WM.MAPS, SAY: WM.SAY, fresh: fresh, migrate: migrate, mapOf: mapOf, size: size, tile: tile, thingAt: thingAt,
    npcAt: npcAt, blocked: blocked, step: step, front: front, facing: facing, talk: talk, done: done, path: path, wander: wander };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.World = api;
})(typeof self !== 'undefined' ? self : this);
