/* The Ninth Rank: what the King keeps between worlds. Experience and levels, the skill tree (three branches:
   Crown, Essence, Dominion), the bounties a world posts, the modifiers of the deeper ranks. No page code, no world
   code: js/realm.js reads this, tools/tests/realm.js tests it. */
(function (root) {
  'use strict';

  /* ---------- experience ---------- */
  // the experience a level needs in all: 100 n + 30 n^2 (level 1 at 130, 5 at 1250, 10 at 4000, 20 at 14000)
  function xpFor(level) { return level <= 0 ? 0 : 100 * level + 30 * level * level; }
  function levelOf(xp) { var l = 0; while (xpFor(l + 1) <= xp) l++; return l; }
  // the experience a capture is worth, by the piece and the rank of the world
  var XP = { P: 10, N: 30, B: 30, R: 50, Q: 90, K: 150, A: 400, captain: 60, camp: 100, bounty: 120 };
  function xpOf(what, rank) { return Math.round((XP[what] || 10) * (1 + 0.25 * ((rank || 1) - 1))); }
  // skill points: one per level, one more every fifth
  function pointsFor(level) { return level + Math.floor(level / 5); }

  /* ---------- the skill tree ----------
     Each node: id, branch, tier, name, text, max (how often it can be taken), needs (the node before it). A node
     of tier t needs t - 1 points in its branch besides its parent. */
  var SKILLS = [
    // Crown: the King's own body
    { id: 'skin', branch: 'crown', tier: 1, name: 'Thick Skin', text: 'One more heart, and all of them full.', max: 3 },
    { id: 'wind', branch: 'crown', tier: 2, name: 'Second Wind', needs: 'skin', text: 'The blow that would fell you leaves you one heart instead. Once every 60 moves.', max: 1 },
    { id: 'hearth', branch: 'crown', tier: 2, name: 'Hearth King', needs: 'skin', text: 'Eight more warmth, and the cold bites half as hard.', max: 2 },
    { id: 'bulwark', branch: 'crown', tier: 3, name: 'Bulwark', needs: 'wind', text: 'The first strike in every 20 moves glances off.', max: 1 },
    { id: 'bond', branch: 'crown', tier: 3, name: 'Shrine Bond', needs: 'hearth', text: 'Shrines and fires also give two essence of every kind.', max: 1 },
    { id: 'iron', branch: 'crown', tier: 4, name: 'Iron Crown', needs: 'bulwark', text: 'A strike no longer pushes you off your square.', max: 1 },
    { id: 'stand', branch: 'crown', tier: 4, name: 'Last Stand', needs: 'bond', text: 'At one heart, every piece you take is worth double experience.', max: 1 },
    // Essence: the forms
    { id: 'well', branch: 'essence', tier: 1, name: 'Deep Well', text: 'Three more essence of each kind fit in you.', max: 2 },
    { id: 'harvest', branch: 'essence', tier: 2, name: 'Harvest', needs: 'well', text: 'Every piece you take leaves one essence more.', max: 2 },
    { id: 'echo', branch: 'essence', tier: 2, name: 'Echo Step', needs: 'well', text: 'One move in four as a form costs nothing.', max: 1 },
    { id: 'thunder', branch: 'essence', tier: 3, name: 'Thunder Leap', needs: 'harvest', text: 'Landing as a knight stuns every enemy next to you for a move.', max: 1 },
    { id: 'double', branch: 'essence', tier: 3, name: 'Double Time', needs: 'echo', text: 'Once every 10 moves, a move as a form does not end your turn.', max: 1 },
    { id: 'rain', branch: 'essence', tier: 4, name: 'Essence Rain', needs: 'thunder', text: 'A fallen warden leaves five essence of every kind.', max: 1 },
    { id: 'transmute', branch: 'essence', tier: 4, name: 'Transmute', needs: 'double', text: 'Turn three essence of one kind into two of another (a button in the forms bar).', max: 1 },
    // Dominion: the world and the company
    { id: 'rally', branch: 'dominion', tier: 1, name: 'Rallying Cry', text: 'Two more freed pieces may follow you.', max: 2 },
    { id: 'scout', branch: 'dominion', tier: 2, name: 'Scout\'s Eye', needs: 'rally', text: 'Patrol routes show on the map, and enemies notice you two squares later.', max: 1 },
    { id: 'quarter', branch: 'dominion', tier: 2, name: 'Quartermaster', needs: 'rally', text: 'Chests hold five essence, and the camps\' chests two hearts\' worth of healing.', max: 1 },
    { id: 'hunter', branch: 'dominion', tier: 3, name: 'Bounty Hunter', needs: 'scout', text: 'Bounties pay half again, and their targets show on the map.', max: 1 },
    { id: 'veteran', branch: 'dominion', tier: 3, name: 'Veterans', needs: 'quarter', text: 'Freed pieces take two blows to fall.', max: 1 },
    { id: 'hearthstone', branch: 'dominion', tier: 4, name: 'Hearthstone', needs: 'hunter', text: 'Return to your last shrine or outpost at will (a button), once every 40 moves.', max: 1 },
    { id: 'sovereign', branch: 'dominion', tier: 4, name: 'Sovereign', needs: 'veteran', text: 'Wardens call half the guards, and raids come with half the pieces.', max: 1 }
  ];
  var BRANCHES = { crown: 'Crown', essence: 'Essence', dominion: 'Dominion' };
  var byId = {}; SKILLS.forEach(function (s) { byId[s.id] = s; });
  // meta.skills = { id: times taken }
  function rank(meta, id) { return (meta && meta.skills && meta.skills[id]) || 0; }
  function spent(meta, branch) { var n = 0; SKILLS.forEach(function (s) { if (!branch || s.branch === branch) n += rank(meta, s.id); }); return n; }
  function pointsLeft(meta) { return pointsFor(levelOf(meta.xp || 0)) - spent(meta); }
  function canTake(meta, id) {
    var s = byId[id]; if (!s) return false;
    if (rank(meta, id) >= s.max) return false;
    if (pointsLeft(meta) <= 0) return false;
    if (s.needs && rank(meta, s.needs) <= 0) return false;
    if (spent(meta, s.branch) < s.tier - 1) return false;
    return true;
  }
  function take(meta, id) {
    if (!canTake(meta, id)) return false;
    meta.skills = meta.skills || {};
    meta.skills[id] = rank(meta, id) + 1;
    return true;
  }
  function resetSkills(meta) { meta.skills = {}; }
  function freshMeta() { return { v: 1, xp: 0, skills: {}, rank: 1, bestRank: 1, worlds: 0, kills: 0, camps: 0, wardens: 0 }; }

  /* ---------- bounties ----------
     A world posts three at a time from this list; done ones are replaced. kind tells the rules what to count. */
  var BOUNTIES = [
    { id: 'pawns', kind: 'kill', t: 'P', n: 6, name: 'Thin the ranks', text: 'Take six pawns.' },
    { id: 'knights', kind: 'kill', t: 'N', n: 3, name: 'Unhorsed', text: 'Take three knights.' },
    { id: 'bishops', kind: 'kill', t: 'B', n: 3, name: 'Broken mitres', text: 'Take three bishops.' },
    { id: 'rooks', kind: 'kill', t: 'R', n: 2, name: 'Towers down', text: 'Take two rooks.' },
    { id: 'queen', kind: 'kill', t: 'Q', n: 1, name: 'Regicide', text: 'Take a queen.' },
    { id: 'camp', kind: 'camp', n: 1, name: 'Burn the banner', text: 'Clear an enemy camp.' },
    { id: 'camps2', kind: 'camp', n: 2, name: 'Scorched earth', text: 'Clear two enemy camps.' },
    { id: 'warden', kind: 'warden', n: 1, name: 'A crown shard', text: 'Fell a warden.' },
    { id: 'free', kind: 'free', n: 1, name: 'Open the cage', text: 'Free a captive.' },
    { id: 'read', kind: 'read', n: 3, name: 'Old words', text: 'Read three monoliths.' },
    { id: 'chests', kind: 'chest', n: 2, name: 'Finders keepers', text: 'Open two chests.' },
    { id: 'raid', kind: 'raid', n: 1, name: 'Hold the line', text: 'Break a raiding party (take its captain).' },
    { id: 'frost', kind: 'frost', n: 1, name: 'Through the white', text: 'Walk 20 moves in the cold without freezing.' },
    { id: 'patrol', kind: 'ambush', n: 3, name: 'From the shadows', text: 'Take three enemies that have not noticed you.' },
    { id: 'knightkills', kind: 'formkill', t: 'N', n: 3, name: 'The horse\'s way', text: 'Take three pieces while moving as a knight.' },
    { id: 'slidekills', kind: 'formkill', t: 'R', n: 2, name: 'Down the file', text: 'Take two pieces while moving as a rook.' }
  ];
  var bountyById = {}; BOUNTIES.forEach(function (b) { bountyById[b.id] = b; });

  /* ---------- the ranks ----------
     Each rank past the first adds a modifier; the deeper, the more enemies, the tougher the wardens. */
  var MODIFIERS = [
    { id: 'night', name: 'The Long Night', text: 'The nights last twice as long. Enemies wake from further off in the dark.' },
    { id: 'patrols', name: 'Double Patrols', text: 'Every camp sends out two patrols.' },
    { id: 'iron', name: 'Iron Wardens', text: 'The wardens wear one crown more.' },
    { id: 'hungry', name: 'Hungry Queens', text: 'Enemy pawns promote after four squares of marching, wherever they are.' },
    { id: 'elite', name: 'Veterans of the East', text: 'One enemy in four takes two blows to fall.' },
    { id: 'raids', name: 'Raiding Season', text: 'Raids come twice as often.' },
    { id: 'blizzard', name: 'Blizzard Season', text: 'In the cold lands the blizzards never quite stop.' },
    { id: 'thin', name: 'Thin Ice', text: 'Every slide on ice goes two squares further.' }
  ];
  function modifiersFor(rank, seed) {
    // the first rank has none; from the second on, rank - 1 of them (at most 4), picked by the seed
    var n = Math.min(4, Math.max(0, rank - 1)), out = [], pool = MODIFIERS.slice(), s = (seed >>> 0) || 1;
    for (var i = 0; i < n && pool.length; i++) { s = (s * 1103515245 + 12345) >>> 0; var j = (s >>> 8) % pool.length; out.push(pool.splice(j, 1)[0].id); }
    return out;
  }
  function difficulty(rank) {
    var r = Math.max(1, rank || 1);
    return { enemies: 1 + 0.18 * (r - 1), wardenHp: 3 + Math.floor((r - 1) / 2), grandHp: 5 + Math.floor((r - 1) / 2), camps: Math.min(4, 2 + Math.floor((r - 1) / 2)), raidEvery: Math.max(22, 48 - (r - 1) * 4), elite: Math.min(0.5, 0.06 * (r - 1)) };
  }

  var api = { xpFor: xpFor, levelOf: levelOf, xpOf: xpOf, XP: XP, pointsFor: pointsFor, SKILLS: SKILLS, BRANCHES: BRANCHES, skill: function (id) { return byId[id]; }, rank: rank, spent: spent, pointsLeft: pointsLeft, canTake: canTake, take: take, resetSkills: resetSkills, freshMeta: freshMeta,
    BOUNTIES: BOUNTIES, bounty: function (id) { return bountyById[id]; }, MODIFIERS: MODIFIERS, modifiersFor: modifiersFor, difficulty: difficulty };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RealmSkills = api;
})(typeof self !== 'undefined' ? self : this);
