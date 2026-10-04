/* Shotgun King, the Game Mode: after Shotgun King: The Final Checkmate (PUNKCAKE Délicieux).
   A lone Black King with a royal shotgun against the White army on an 8 x 8 board, floor after floor.

   Each turn the king does one thing: step one square (which also puts one shell into the gun from the reserve and
   brings shells back to the reserve), shoot (pellets fan out over the fire arc and fly a random distance inside the
   range, 1 damage each), reload one shell in place, strike with the blade, or spend a soul to move like the piece it
   came from. Then every white piece counts down its own timer (its speed); those at zero move. A white piece that
   attacks the king's square when its move comes, or at the end of the king's turn, takes him: the king may never step
   into an attack, but a shot that removes a blocker (a discovered attack) is fatal. Killing the leader (the king, the
   Boss Pawn on floor 6, the White King boss on floor 12) clears the floor. After floors 1 to 10 the player picks one
   of two pairs of cards: a black card for the king, a white card for the army. 20 ranks make the army tougher.

   The cards are lists of effects (fx, see CARDS below): the same list drives the rules here and draws the card in
   the app, so a card is written once. Everything is plain data in and out (JSON), so a run can be saved and resumed.
   The luck comes from a seed kept in the floor. Rules.js lends the pellet flight (Rules.pellets). */
(function (root) {
  'use strict';
  var R = root.Rules || (typeof require === 'function' ? require('./rules.js') : null);
  var W = 8, H = 8, N = 64;
  var row = function (q) { return Math.floor(q / W); }, col = function (q) { return q % W; };
  var at = function (r, f) { return r >= 0 && r < H && f >= 0 && f < W ? r * W + f : -1; };
  var cheb = function (a, b) { return Math.max(Math.abs(row(a) - row(b)), Math.abs(col(a) - col(b))); };
  var KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]], ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]], DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  var KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

  /* ---------- the shotguns (the game's own numbers) ---------- */
  var SHOTGUNS = [
    { id: 'solomon', name: 'Solomon', cap: 2, res: 6, fp: 4, arc: 55, rmin: 3, rmax: 5, text: 'The royal shotgun everybody starts with. Balanced in every way.' },
    { id: 'victoria', name: 'Victoria', cap: 1, res: 3, fp: 5, arc: 45, rmin: 4, rmax: 6, text: 'One shell and a small reserve, but a tight, long reaching blast.' },
    { id: 'richard', name: 'Richard III', cap: 3, res: 8, fp: 3, arc: 75, rmin: 5, rmax: 7, pierce: 0.4, text: 'Three shells and the longest reach. Wide, and 40% of its pellets pierce.' },
    { id: 'makeda', name: 'Makeda', cap: 2, res: 6, fp: 3, arc: 50, rmin: 3, rmax: 5, blade: 2, bladeFree: true, tags: ['blade'], text: 'A blade of 2 that can strike any piece next to the king, not only to finish it.' },
    { id: 'alexander', name: 'Alexander', cap: 2, res: 8, fp: 4, arc: 65, rmin: 3, rmax: 5, search: 1, text: 'A big reserve and one search per floor: throw the card offer away and draw a new one.' },
    { id: 'yvan', name: 'Yvan IV', cap: 1, res: 6, fp: 4, arc: 50, rmin: 2, rmax: 4, reloadOnKill: true, text: 'Short reach and one shell, but every kill reloads it at once.' },
    { id: 'ramesses', name: 'Ramesses II', cap: 2, res: 5, fp: 4, arc: 65, rmin: 3, rmax: 5, knock: 0.5, tags: ['on_hit'], text: 'Half of its hits knock the piece one square back. Off the board is death.' },
    { id: 'montezuma', name: 'Montezuma', cap: 3, res: 6, fp: 3, arc: 65, rmin: 3, rmax: 5, mark: 1, tags: ['on_hit'], text: 'Its pellets mark what they hit: every reload hurts each marked piece by 1.' },
    { id: 'attila', name: 'Attila', cap: 1, res: 5, fp: 4, arc: 65, rmin: 3, rmax: 5, grenades: 1, tags: ['grenade'], text: 'One shell and a grenade (3 damage on 3 x 3 squares) that comes back with every reload.' }
  ];
  var GUN = {};
  SHOTGUNS.forEach(function (g) { GUN[g.id] = g; });

  /* ---------- the cards ----------
     All 93 + 93 cards of the game. A card: { id, name, max, fx, needs, tags, later }. fx is a list of effects:
       S(stat, v)            the king's gun and body: fp arc range cap res regen pierce knock souls move mark blade
                             grenades gdmg (grenade damage) search fright (fear radius) shrapnel. Black and white
                             cards alike: a white card may weaken the gun (Karma) or the blade (Full Plate Armor).
       A(kind, v, {after|every}) the army: pieces added (or removed) at the start of a floor, after a number of turns,
                             or every so many turns. kind p n b r q k (k: the king, the floor's leader).
       HP(kind, v), SP(kind, v) hit points and speed of a kind (also leader, all); speed + is slower (turns between moves).
       EVERY(n, effect)      a stat that grows every n turns of a floor (Grindstone), or a speed that does (Golden Aging).
       RULE(id)              a rule the code below checks with rule(run, F, id) (the number of such cards that work).
       FLIP(event)           the card turns face down (stops working) for the rest of the floor when that happens.
       OFF(state)            the card does not work while that holds (Cornered Despot off the edge).
       ALLY(kind)            a black piece of that kind fights for the king, from the start of every floor (Bastion).
     needs: cards (ids) or tags the run must have first; any: at least one of these cards (or tags); notTags: tags the
     run must not have (King's Shoulders and a blade); blockedBy: cards that keep it away; floorMax: the last floor
     after which it is offered; pawns: pawns the next floor's army must have (The Mole). tags: what the card gives (as
     in the game: blade, bleed, grenade, on_hit, cloak, jump, ally, orb, mission, tunnels, leader). The gun gives tags
     too. later: a card whose mechanics are not built yet (it needs a white card that is not built): never offered. */
  var S = function (k, v) { return { s: k, v: v }; }, A = function (t, v, o) { var e = { a: t, v: v }; if (o) { e.after = o.after; e.every = o.every; } return e; };
  var HP = function (t, v) { return { hp: t, v: v }; }, SP = function (t, v) { return { spd: t, v: v }; };
  var EVERY = function (n, e) { var o = {}; for (var k in e) o[k] = e[k]; o.every = n; return o; }, RULE = function (id) { return { r: id }; };
  var FLIP = function (ev) { return { flip: ev }; }, OFF = function (st) { return { off: st }; };
  var ALLY = function (t) { return { ally: t, v: 1 }; };
  var LATER = true;
  var BLACK = [
    { id: 'pierce', name: 'A Piercing Truth', max: 2, fx: [S('pierce', 0.3)], text: 'Your pellets have 30% chance to pierce through targets' },
    { id: 'ambush', name: 'Ambush', max: 1, needs: ['cloak'], fx: [S('range', 2), S('gdmg', 1), OFF('notStealth')], text: '+2 fire range; +1 grenade damage; flip card if your king is not being stealthy' },
    { id: 'flagstone', name: 'Ancient Flagstone', max: 1, fx: [RULE('flagstone')], text: '+1 flagstone; jump to a flagstone at any time; +1 firepower while you stand on a flagstone' },
    { id: 'august', name: 'August Presence', max: 1, fx: [RULE('august')], text: 'Non-king pieces can\'t come near your king' },
    { id: 'bastion', name: 'Bastion', max: 1, any: ['dungeon', 'bunker', 'lookout'], tags: ['ally'], fx: [ALLY('r')], text: 'Add 1 black rook' },
    { id: 'mist', name: 'Black Mist', max: 2, fx: [S('range', -1), RULE('mist')], text: '-1 fire range; protects from death once per floor' },
    { id: 'plague', name: 'Black Plague', max: 1, needs: ['crow', 'rats'], fx: [S('range', -1), RULE('plague')], text: '-1 fire range; at the end of each turn a random piece takes 1 dmg' },
    { id: 'bloodless', name: 'Bloodless Coup', max: 1, fx: [RULE('bloodless'), S('arc', -15), FLIP('pawnKilled')], text: 'Pawns can\'t attack; fire arc: -15°; flip this card if a pawn is killed' },
    { id: 'blunderbuss', name: 'Blunderbuss', max: 2, fx: [S('fp', 2), S('arc', 30)], text: '+2 firepower; fire arc: +30°' },
    { id: 'boldplan', name: 'Bold Plan', max: 3, fx: [RULE('boldplan')], text: 'Replace a white card with a different one' },
    { id: 'bushido', name: 'Bushido', max: 1, tags: ['blade'], fx: [S('fp', -1), S('blade', 2), RULE('bushido')], text: '-1 firepower; blade: +2; once per turn, execute a piece with your blade without ending your turn' },
    { id: 'caltrops', name: 'Caltrops', max: 2, tags: ['bleed'], fx: [RULE('caltropsSlow'), RULE('caltrops')], text: '-1 speed on bleeding pieces; +15% chance to inflict bleed on moving enemies' },
    { id: 'fodder', name: 'Cannon Fodder', max: 1, fx: [RULE('fodder')], text: 'Use pawns\' souls to gain +2 firepower on your next shot' },
    { id: 'organ', name: 'Church Organ', max: 1, needs: ['cathedral'], fx: [S('res', 2), S('cap', 2)], text: '+2 ammo max; charge 2 additional shells in your shotgun' },
    { id: 'cloaking', name: 'Cloaking Device', max: 1, needs: ['holoking'], tags: ['cloak'], fx: [RULE('cloaking')], text: 'Enter stealth mode for 6 turns each time you create a hologram; lose stealth effect if your hologram is destroyed' },
    { id: 'despot', name: 'Cornered Despot', max: 1, fx: [S('fp', 2), OFF('notEdge')], text: '+2 firepower; flip card if your king is not on the board\'s edge' },
    { id: 'jousting', name: 'Courteous Jousting', max: 1, fx: [RULE('jousting'), S('arc', -10)], text: 'Play an extra turn when you kill a knight; fire arc: -10°' },
    { id: 'crow', name: 'Crow\'s Blessing', max: 1, fx: [S('range', 2)], text: '+2 fire range' },
    { id: 'deathmark', name: 'Death Mark', max: 2, tags: ['on_hit'], fx: [S('fp', -1), S('mark', 1)], text: '-1 firepower; pellets mark pieces on hit; marked pieces take 1 dmg when you reload' },
    { id: 'deepwaters', name: 'Deep Waters', max: 1, needs: ['moat'], fx: [RULE('deepwaters')], text: 'Pieces within the moat can\'t attack you' },
    { id: 'maelstrom', name: 'Egotic Maelstrom', max: 1, fx: [EVERY(12, S('fp', 1))], text: 'Every 12 turns: +1 firepower' },
    { id: 'gem', name: 'Elite Gem', max: 1, fx: [S('regen', 1), S('range', 1)], text: '+1 ammo regeneration; +1 fire range' },
    { id: 'elusive', name: 'Elusive', max: 1, tags: ['jump'], fx: [S('jump', 1), RULE('elusive')], text: 'Jump: +1 (jump over a nearby piece without ending the turn); white pieces ready to move can\'t attack you' },
    { id: 'scope', name: 'Engraved Scope', max: 1, fx: [RULE('scope'), S('search', 1)], text: 'Aim: fire arc -45° and range +2, until you move or reload; search: +1' },
    { id: 'ermine', name: 'Ermine Belt', max: 3, fx: [S('res', 3)], text: '+3 ammo max' },
    { id: 'barrel', name: 'Extra Barrel', max: 3, fx: [S('cap', 1)], text: 'Charge 1 additional shell in your shotgun' },
    { id: 'steed', name: 'Faithful Steed', max: 1, needs: ['warhorse'], fx: [RULE('steed')], text: 'The king swaps positions with a knight whenever he\'s about to take damage; knights move the king if he is adjacent' },
    { id: 'fearsome', name: 'Fearsome', max: 2, fx: [S('res', 1), S('fright', 1), RULE('fearsome')], text: '+1 ammo max; +1 fright radius; when you kill a non-pawn piece, pieces around the black king are scared: they can\'t attack you and flee on their next move' },
    { id: 'foolcompanion', name: 'Fool Companion', max: 1, needs: ['jester'], later: LATER, text: 'Jesters can move in all directions and always follow the king; earn an extra turn when you kill a jester' },
    { id: 'force', name: 'Force-Feeding', max: 1, fx: [RULE('forceFp'), RULE('force')], text: '+1 firepower while your gun is full; reloading without moving lets you squeeze one more shell into the shotgun when it\'s full' },
    { id: 'golden', name: 'Golden Aging', max: 1, fx: [HP('leader', -1), HP('q', -1), EVERY(10, SP('leader', 1)), EVERY(10, SP('q', 1))], text: 'Leader and queen: -1 HP; every 10 turns: leader and queen: -1 speed' },
    { id: 'absolution', name: 'Gradual Absolution', max: 2, fx: [RULE('absolution')], text: '+1 firepower for each empty soul slot' },
    { id: 'grindstone', name: 'Grindstone', max: 1, fx: [EVERY(6, S('blade', 1))], text: 'Every 6 turns: blade: +1' },
    { id: 'guerilla', name: 'Guerilla Tactics', max: 1, tags: ['grenade'], fx: [S('res', 1), S('grenades', 1), S('range', 1)], text: 'Throw grenades; +1 ammo max; +1 grenade; +1 fire range' },
    { id: 'focus', name: 'High Focus', max: 2, fx: [S('fp', 1), S('arc', -10), OFF('adjacent')], text: '+1 firepower; fire arc: -10°; flip card if a piece is adjacent to you' },
    { id: 'holoking', name: 'Holoking', max: 1, fx: [RULE('holoking')], text: 'Create a hologram when you use a soul; the hologram stuns any piece that kills it for 2 turns' },
    { id: 'gunpowder', name: 'Holy Gunpowder', max: 2, fx: [S('res', -1), S('fp', 1)], text: '-1 ammo max; +1 firepower' },
    { id: 'humanshield', name: 'Human Shield', max: 1, needs: ['fearsome'], fx: [S('res', 2), RULE('humanshield')], text: '+2 ammo max; Fearsome also triggers on pawn deaths' },
    { id: 'shotput', name: 'Imperial Shot Put', max: 3, needs: ['shoulders'], fx: [S('res', -1), RULE('shotput')], text: '-1 ammo max; add 1 cannonball; cannonballs can be grabbed and thrown at pieces' },
    { id: 'indelible', name: 'Indelible Memories', max: 1, tags: ['bleed', 'grenade'], fx: [S('grenades', 1), RULE('grenadeBleed')], text: 'Throw grenades; +1 grenade; grenades inflict bleed' },
    { id: 'shoulders', name: 'King\'s Shoulders', max: 1, notTags: ['blade'], fx: [RULE('shoulders')], text: 'Once per floor, drag a nearby piece onto your king and throw it in any direction' },
    { id: 'wealth', name: 'Kingdom Wealth', max: 1, fx: [S('res', 6), HP('leader', 2)], text: '+6 ammo max; leader: +2 HP' },
    { id: 'alms', name: 'Kingly Alms', max: 3, tags: ['grenade'], fx: [S('grenades', 1), RULE('alms')], text: 'Throw grenades; +1 grenade; +2 damage on the grenade\'s center square' },
    { id: 'disguise', name: 'Low-Cost Disguise', max: 2, tags: ['cloak'], fx: [RULE('disguise')], text: 'When a pawn dies, enter stealth mode for 2 turns' },
    { id: 'censer', name: 'Majestic Censer', max: 1, fx: [S('res', 1), S('souls', 1)], text: '+1 ammo max; add 1 extra soul slot' },
    { id: 'confidence', name: 'Monarch\'s Confidence', max: 1, fx: [RULE('confidence')], text: '+1 firepower for each missing shell in your shotgun' },
    { id: 'shackles', name: 'Mystic Shackles', max: 1, needs: ['orb'], fx: [RULE('shackles')], text: 'The piece under the orb\'s influence cannot modify its move and gets speed -1' },
    { id: 'nightbane', name: 'Nightbane', max: 1, tags: ['blade'], fx: [S('blade', 3)], text: 'Blade: +3' },
    { id: 'onboarding', name: 'Onboarding Party', max: 1, needs: ['welcome'], fx: [RULE('onboarding')], text: 'Flip Welcome Gift back when a pawn promotes or when a non-pawn backup enters the board' },
    { id: 'patience', name: 'Patience', max: 2, floorMax: 9, fx: [S('res', 1), RULE('patience')], text: '+1 ammo max; for your next black card, browse and pick a card from the entire deck' },
    { id: 'philanthropy', name: 'Philanthropy', max: 1, tags: ['grenade'], fx: [S('grenades', 2), S('gdmg', -1)], text: 'Throw grenades; +2 grenades; -1 grenade damage' },
    { id: 'possessed', name: 'Possessed', max: 1, needs: ['conclave', 'unholy'], fx: [A('b', 1), S('souls', 2)], text: 'Add 1 bishop; add 2 extra soul slots' },
    { id: 'presbyopia', name: 'Presbyopia', max: 1, needs: ['golden'], fx: [RULE('presbyopia')], text: 'Queens and bishops can\'t attack you at less than 2 range' },
    { id: 'rapunzel', name: 'Rapunzel', max: 1, any: ['lady', 'dungeon'], tags: ['ally'], fx: [RULE('rapunzel')], text: 'The first time you kill a rook, spawn a black queen' },
    { id: 'rats', name: 'Ravenous Rats', max: 1, fx: [RULE('rats')], text: 'When you kill a piece, a rat bites the nearest target for 1 dmg' },
    { id: 'terror', name: 'Reign of Terror', max: 1, needs: ['fearsome'], fx: [S('res', -2), RULE('terror')], text: '-2 ammo max; Fearsome also applies around the killed pieces' },
    { id: 'righthand', name: 'Right-hand', max: 1, any: ['absolution', 'possessed', 'redbook'], tags: ['ally'], fx: [ALLY('b')], text: 'Add 1 black bishop' },
    { id: 'curtsy', name: 'Rightful Curtsy', max: 2, tags: ['on_hit'], fx: [S('res', 1), S('knock', 0.5)], text: '+1 ammo max; +50% chance to knock enemies back' },
    { id: 'dagger', name: 'Ritual Dagger', max: 1, tags: ['blade'], fx: [HP('leader', -3), S('range', -1), S('blade', 1)], text: 'Leader: -3 HP; -1 fire range; blade: +1' },
    { id: 'loafers', name: 'Royal Loafers', max: 1, blockedBy: ['sawed'], fx: [RULE('loafers')], text: 'Strafe mode: pick a target to fire at it on your next moves with +15° arc' },
    { id: 'crown', name: 'Sacred Crown', max: 1, fx: [RULE('crown')], text: 'You can play an extra turn after using a soul card move' },
    { id: 'sacredlight', name: 'Sacred Light', max: 1, tags: ['grenade'], fx: [S('grenades', 1), S('gdmg', -2), RULE('grenadeSafe'), RULE('grenadeStun')], text: 'Throw grenades; +1 grenade; -2 grenade damage; you are immune to grenade damage; grenades stun pieces for 2 turns' },
    { id: 'sawed', name: 'Sawed-off Justice', max: 1, fx: [RULE('sawed'), S('fp', 2), S('range', -1)], text: 'Shooting moves you backwards; +2 firepower; -1 fire range' },
    { id: 'secretmove', name: 'Secret Move', max: 1, needs: ['jump'], tags: ['jump'], fx: [S('jump', 1), RULE('secretmove')], text: 'Jump: +1; use up all your jumps to get firepower equal to your jump stat on your next shot' },
    { id: 'orb', name: 'Seer\'s Orb', max: 1, tags: ['orb'], fx: [RULE('orb'), S('search', 1)], text: 'Pick a piece to predict its next move; search: +1' },
    { id: 'selective', name: 'Selective Listening', max: 1, fx: [RULE('selective')], text: 'White can\'t move more than 2 piece types on each turn' },
    { id: 'shovel', name: 'Shovel', max: 1, tags: ['blade', 'tunnels'], fx: [RULE('shovel'), S('blade', 1)], text: 'Dig a hole on a nearby square; blade: +1; dig 2 holes in the battlefield; you can travel to any hole if you are near a hole' },
    { id: 'shrapnel', name: 'Shrapnel', max: 2, needs: ['on_hit'], tags: ['on_hit'], fx: [S('knock', 0.15), S('shrapnel', 3)], text: '+15% chance to knock enemies back; shrapnel: +3; shrapnels deal 0 damage but trigger pellet effects' },
    { id: 'silencer', name: 'Silencer', max: 1, needs: ['cloak'], fx: [S('range', -1), RULE('silencer')], text: '-1 fire range; while stealthy, fire without revealing yourself' },
    { id: 'smallfry', name: 'Small Fry Harvest', max: 2, tags: ['blade'], fx: [RULE('smallfry'), S('blade', 1)], text: 'Gain 1 ammo each time you kill a pawn; blade: +1' },
    { id: 'smallkey', name: 'Small Key', max: 1, any: ['prison', 'trowel'], fx: [RULE('smallkey')], text: 'Once per floor click a nearby rook to remove it or a nearby jailed piece to convert it; then disrupt the White Army' },
    { id: 'projection', name: 'Soul Projection', max: 1, any: ['undead', 'knightmare'], tags: ['ally'], fx: [RULE('projection')], text: 'If you have no ally, you can spend a soul to create an ally' },
    { id: 'sprint', name: 'Sprint', max: 1, fx: [S('move', 1)], text: 'Move range: +1' },
    { id: 'poison', name: 'Subtle Poison', max: 1, fx: [HP('q', -1), HP('leader', -1), RULE('poison')], text: 'Queen: -1 HP; leader: -1 HP; queen\'s moves limit: 1 square for 15 turns' },
    { id: 'hop', name: 'Taunting Hop', max: 2, tags: ['jump'], fx: [S('jump', 1), S('jdmg', 1)], text: 'Jump: +1; jump damage: +1' },
    { id: 'tearing', name: 'Tearing Bullets', max: 1, tags: ['bleed', 'on_hit'], fx: [RULE('bleedHit')], text: 'Pieces hit by your pellets bleed (bleeding pieces take an extra damage on hits)' },
    { id: 'moat', name: 'The Moat', max: 1, fx: [RULE('moat')], text: 'Non-knight pieces can\'t cross the moat in one move' },
    { id: 'mole', name: 'The Mole', max: 2, pawns: 7, tags: ['mission'], fx: [RULE('mole')], text: '+1 spy mask; find and approach a spy to disrupt the White Army; spies turn black when promoting' },
    { id: 'undercover', name: 'Undercover Mission', max: 1, tags: ['mission'], fx: [RULE('undercover')], text: 'Reach the waypoint to disrupt the White Army' },
    { id: 'unholy', name: 'Unholy Call', max: 1, fx: [RULE('unholy')], text: 'Add 3 pentagrams on the board; trigger one to get an extra turn; trigger all to get +2 firepower' },
    { id: 'decree', name: 'Unjust Decree', max: 1, fx: [RULE('decree'), S('fp', -1)], text: 'Fire all loaded shells at once; -1 firepower' },
    { id: 'wanddownpour', name: 'Wand of Downpour', max: 1, fx: [RULE('wanddownpour')], text: 'Deal 10 damage to random enemies' },
    { id: 'wandexecution', name: 'Wand of Execution', max: 1, fx: [RULE('wandexecution')], text: 'Destroy a pawn; refill when you kill a non-pawn piece' },
    { id: 'wandfrenzy', name: 'Wand of Frenzy', max: 1, fx: [RULE('wandfrenzy')], text: 'Once per floor, free: refill your ammo and reload your gun' },
    { id: 'wandgust', name: 'Wand of Gust', max: 1, fx: [RULE('wandgust')], text: 'Once per floor, free: repel all white pieces northward; delay their next move by two turns' },
    { id: 'wandhypnosis', name: 'Wand of Hypnosis', max: 1, fx: [RULE('wandhypnosis')], text: 'Play a white piece of your choice' },
    { id: 'wandsouls', name: 'Wand of Souls', max: 1, fx: [RULE('wandsouls')], text: 'Stun a piece for 3 turns and steal their soul' },
    { id: 'wandtreachery', name: 'Wand of Treachery', max: 1, tags: ['ally'], fx: [RULE('wandtreachery')], text: 'Convert a piece that is next to the king' },
    { id: 'wandwings', name: 'Wand of Wings', max: 1, fx: [RULE('wandwings')], text: 'Once per floor, free: move in any direction up to 3 squares' },
    { id: 'wandwrath', name: 'Wand of Wrath', max: 1, fx: [RULE('wandwrath')], text: 'Deal firepower damage to a non-king target' },
    { id: 'warhorse', name: 'Warhorse', max: 1, any: ['saddle', 'knightmare', 'cavalry'], tags: ['ally'], fx: [ALLY('n')], text: 'Add 1 black knight' },
    { id: 'welcome', name: 'Welcome Gift', max: 1, fx: [S('fp', 4), FLIP('reload')], text: '+4 firepower; flip this card when you reload your gun' },
    { id: 'workshop', name: 'Workshop', max: 1, needs: ['grenade'], fx: [RULE('workshop')], text: 'Every 8 turns: produce 1 grenade and 2 ammo' }
  ];
  var WHITE = [
    { id: 'depot', name: 'Ammunition Depot', max: 2, fx: [A('r', 1), RULE('depot')], text: 'Add 1 rook; gain 2 ammo each time you kill a rook' },
    { id: 'paralysis', name: 'Analysis Paralysis', max: 2, needs: ['focus'], fx: [S('search', 1), RULE('paralysis')], text: 'Search: +1; you can\'t play for 6 turns or until you are in check' },
    { id: 'anarchy', name: 'Anarchy', max: 1, tags: ['leader'], fx: [RULE('anarchy')], text: 'Randomize army formation; promote two random pieces to any other type' },
    { id: 'ascension', name: 'Ascension', max: 1, fx: [RULE('ascension')], text: 'Bishops can move and attack across any obstacle' },
    { id: 'assault', name: 'Assault', max: 1, fx: [A('p', 1), RULE('assault')], text: 'Add 1 pawn; pawns can walk 1 additional square on their first move' },
    { id: 'autodafe', name: 'Auto-da-fe', max: 1, later: LATER, fx: [A('b', 1), RULE('autodafe')], text: 'Add 1 bishop; when a bishop threatens you, either mark a random black card or flip all marked cards' },
    { id: 'backups', name: 'Backups', max: 3, fx: [A('p', 3)], text: 'Add 3 pawns' },
    { id: 'bodyguard', name: 'Bodyguard', max: 1, fx: [HP('n', 1), RULE('bodyguard')], text: 'Knight: +1 HP; the king can\'t be killed if a knight is alive' },
    { id: 'bouncy', name: 'Bouncy Castle', max: 1, fx: [HP('r', -2), RULE('bouncy')], text: 'Rook: -2 HP; pieces falling off the board come back fully healed' },
    { id: 'buckler', name: 'Buckler of Limos', max: 1, fx: [SP('leader', 1), RULE('buckler')], text: 'Leader: -1 speed; leaders can\'t take more than 3 damage in a single turn' },
    { id: 'bunker', name: 'Bunker', max: 1, needs: ['grenade'], fx: [A('r', -1), HP('leader', 1), HP('p', 1), S('gdmg', -1)], text: 'Remove 1 rook; leader and pawn: +1 HP; -1 grenade damage' },
    { id: 'cardinal', name: 'Cardinal', max: 1, fx: [A('p', -1), A('b', 1), S('res', -1)], text: 'Remove 1 pawn; add 1 bishop; -1 ammo max' },
    { id: 'castle', name: 'Castle', max: 1, tags: ['leader'], fx: [HP('r', 1), RULE('castle')], text: 'Rook: +1 HP; the king swaps positions with a rook whenever he\'s about to take damage' },
    { id: 'catacombs', name: 'Catacombs', max: 1, needs: ['tunnels'], later: LATER, text: 'Add 1 rook; fire arc: +10°; holes don\'t collapse when you use them for traveling' },
    { id: 'cathedral', name: 'Cathedral', max: 1, needs: ['cardinal'], fx: [A('b', -1), A('r', 1), RULE('cathedral')], text: 'Remove 1 bishop; add 1 rook; non-rook pieces near rooks can\'t take more than 2 damage per turn' },
    { id: 'cavalry', name: 'Cavalry', max: 1, fx: [A('n', 2, { after: 15 })], text: 'Add 2 knights after 15 turns' },
    { id: 'commoner', name: 'Commoner\'s Reign', max: 1, tags: ['leader'], fx: [A('k', -1), A('n', 1), HP('n', 2), RULE('goalKnights')], text: 'Remove 1 king; add 1 knight; knight: +2 HP; win if all knights are dead' },
    { id: 'conclave', name: 'Conclave', max: 1, fx: [A('b', 2, { after: 15 })], text: 'Add 2 bishops after 15 turns' },
    { id: 'conscription', name: 'Conscription', max: 2, fx: [A('p', 1, { every: 5 })], text: 'Add 1 pawn every 5 turns' },
    { id: 'court', name: 'Court of the King', max: 2, fx: [A('n', 2), A('b', 1), A('r', 1), SP('all', 1)], text: 'Add 2 knights, 1 bishop and 1 rook; all: -1 speed' },
    { id: 'crusades', name: 'Crusades', max: 1, fx: [A('b', -1), A('n', 2)], text: 'Remove 1 bishop; add 2 knights' },
    { id: 'healing', name: 'Divine Healing', max: 1, fx: [HP('b', 1), RULE('heal')], text: 'Bishop: +1 HP; bishops can heal nearby allies instead of moving' },
    { id: 'dragqueen', name: 'Drag Queen', max: 1, fx: [A('b', -1), A('q', 1, { after: 10 })], text: 'Remove 1 bishop; add 1 queen after 10 turns' },
    { id: 'emergency', name: 'Emergency Call', max: 1, fx: [A('p', 1), RULE('emergency')], text: 'Add 1 pawn; the first time you hit a leader it gets +1 speed and promotes the nearest pawn' },
    { id: 'entitle', name: 'Entitle', max: 1, fx: [A('p', -1), A('n', 1), S('res', -1)], text: 'Remove 1 pawn; add 1 knight; -1 ammo max' },
    { id: 'excommunication', name: 'Excommunication', max: 1, fx: [A('r', 1), A('n', 1), FLIP('bishopAt15')], text: 'Add 1 rook and 1 knight; if a bishop is still alive on or after turn 15, flip this card' },
    { id: 'dynasty', name: 'Fallen Dynasty', max: 1, later: LATER, text: 'They ruled a long time ago... But royalty shall prevail' },
    { id: 'countdown', name: 'Final Countdown', max: 1, fx: [RULE('countdown')], text: 'When 6 pieces remain, you have 12 turns to end the level' },
    { id: 'fleshwall', name: 'Flesh Wall', max: 1, fx: [A('p', 1), RULE('fleshwall')], text: 'Add 1 pawn; pawns won\'t die until the turn ends' },
    { id: 'plate', name: 'Full Plate Armor', max: 1, fx: [HP('all', 1), SP('all', 1), S('blade', -1)], text: 'All: +1 HP; all: -1 speed; blade: -1' },
    { id: 'gatehouse', name: 'Gatehouse', max: 1, fx: [HP('r', -1), SP('r', 2), RULE('gatehouse')], text: 'Rook: -1 HP; rook: -2 speed; rooks can create a knight instead of moving' },
    { id: 'governess', name: 'Governess', max: 1, fx: [A('b', 1), RULE('governess')], text: 'Add 1 bishop; pawns always promote to queens' },
    { id: 'guillotine', name: 'Guillotine', max: 1, needs: ['revolution'], fx: [A('k', -1), RULE('goalAll')], text: 'Remove 1 king' },
    { id: 'dungeon', name: 'Highest Dungeon', max: 1, fx: [HP('all', 1), OFF('noRook')], text: 'All: +1 HP; flip card if there\'s no rook on the board' },
    { id: 'hiredblade', name: 'Hired Blade', max: 2, later: LATER, text: 'Remove 1 pawn; add 1 slayer; -1 ammo max' },
    { id: 'homecoming', name: 'Homecoming', max: 1, fx: [A('q', 1)], text: 'Add 1 queen' },
    { id: 'inquisition', name: 'Inquisition', max: 1, needs: ['mission', 'cloak'], later: LATER, text: 'Remove 1 pawn; add 1 bishop; bishops execute exposed spies and cancel missions; bishops can attack you even when you are stealthy' },
    { id: 'ironmaiden', name: 'Iron Maiden', max: 1, fx: [A('q', -1), SP('q', 2), RULE('ironmaiden'), OFF('onlyQueens')], text: 'Remove 1 queen; queen: -2 speed; queens can\'t die; flip card if there\'s only queens on the board' },
    { id: 'karma', name: 'Karma', max: 1, fx: [S('fp', -1), S('arc', 30), FLIP('promote')], text: '-1 firepower; fire arc: +30°; flip this card when a pawn promotes' },
    { id: 'lookalike', name: 'King\'s Look-alike', max: 2, later: LATER, text: 'Add 1 king; leader: +1 HP; replace the false king with a knight when he\'s hurt; win if all knights are dead' },
    { id: 'mistress', name: 'King\'s Mistress', max: 1, fx: [A('q', 1), RULE('mistress')], text: 'Add 1 queen; queens\' moves are limited to 3 squares' },
    { id: 'kite', name: 'Kite Shield', max: 1, tags: ['on_hit'], fx: [A('p', 1), RULE('kite')], text: 'Add 1 pawn; knights have a shield that absorbs all damage once' },
    { id: 'knightmare', name: 'Knightmare', max: 1, fx: [HP('n', -1), RULE('knightmare')], text: 'Knight: -1 HP; knights can only be hit when moving or when threatening you' },
    { id: 'lady', name: 'Lady in the Tower', max: 1, fx: [A('r', 1), RULE('lady')], text: 'Add 1 rook; rooks promote to queens instead of executing the Black King' },
    { id: 'guardian', name: 'Last Guardian', max: 1, fx: [RULE('guardian')], text: 'After killing a pawn, promote another pawn if it\'s the last one' },
    { id: 'latedinner', name: 'Late for Dinner', max: 1, fx: [A('p', -1), A('n', -1), A('b', -1), A('p', 1, { after: 10 }), A('n', 1, { after: 10 }), A('b', 1, { after: 10 }), A('r', 1, { after: 10 })], text: 'Remove 1 pawn, 1 knight and 1 bishop; add 1 pawn, 1 knight, 1 bishop and 1 rook after 10 turns' },
    { id: 'lightfoot', name: 'Lightfoot', max: 1, fx: [A('p', 2), RULE('lightfoot')], text: 'Add 2 pawns; pawns can jump over obstacles in any directions' },
    { id: 'lookout', name: 'Lookout Tower', max: 2, fx: [A('r', 1, { after: 20 }), RULE('lookout')], text: 'Add 1 rook after 20 turns; White backups come 1 turn earlier for every piece you kill' },
    { id: 'loyalist', name: 'Loyalist March', max: 1, fx: [A('p', 8, { after: 10 })], text: 'Add 8 pawns after 10 turns' },
    { id: 'mangonel', name: 'Mangonel', max: 1, later: LATER, text: 'Add 1 rook; rook: -2 speed; rooks can fire a projectile at you' },
    { id: 'mausoleum', name: 'Mausoleum', max: 1, tags: ['leader'], fx: [A('r', 1), RULE('mausoleum')], text: 'Add 1 rook; when a rook dies, kings take 2 damage' },
    { id: 'academy', name: 'Military Academy', max: 1, fx: [A('n', 1, { every: 10 })], text: 'Add 1 knight every 10 turns' },
    { id: 'militia', name: 'Militia', max: 1, fx: [A('p', 1), RULE('militia')], text: 'Add 1 pawn; pawns can move and attack in four directions' },
    { id: 'nomad', name: 'Nomad Life', max: 2, fx: [A('r', -1), A('n', 2), A('b', 1), RULE('nomad')], text: 'Remove 1 rook; add 2 knights and 1 bishop; knights can promote if they reach the last line' },
    { id: 'oathkeeper', name: 'Oathkeeper', max: 1, later: LATER, text: 'Add 1 warden' },
    { id: 'peace', name: 'Peace', max: 1, fx: [A('n', -1), A('b', 2)], text: 'Remove 1 knight; add 2 bishops' },
    { id: 'pikemen', name: 'Pikemen', max: 1, fx: [HP('p', 1), RULE('pikemen')], text: 'Pawn: +1 HP; pawns can attack the two squares in front of them; pawns can\'t use their standard attack' },
    { id: 'pillage', name: 'Pillage', max: 1, fx: [A('r', -1), A('p', 5), HP('p', 1)], text: 'Remove 1 rook; add 5 pawns; pawn: +1 HP' },
    { id: 'plumed', name: 'Plumed Knight', max: 1, fx: [RULE('plumed')], text: 'One knight gains +3 HP and can attack diagonally' },
    { id: 'prison', name: 'Prison', max: 1, fx: [A('b', 1), A('n', 1), RULE('prison')], text: 'Add 1 bishop and 1 knight; knights and bishops near a rook are imprisoned (they can\'t move or attack and can be passed through)' },
    { id: 'pyre', name: 'Pyre of Lust', max: 1, fx: [A('q', 1), FLIP('bishopAt15')], text: 'Add 1 queen; if a bishop is still alive on or after turn 15, flip this card' },
    { id: 'redemption', name: 'Redemption', max: 1, needs: ['ally'], later: LATER, text: 'Add 1 bishop; when a black piece dies, add a white piece of the same type on the board' },
    { id: 'remparts', name: 'Remparts', max: 2, fx: [A('p', -2), A('r', 1)], text: 'Remove 2 pawns; add 1 rook' },
    { id: 'mother', name: 'Reverend Mother', max: 1, needs: ['theocracy'], fx: [A('q', 1), RULE('mother')], text: 'Add 1 queen; when a queen dies, all other pieces are scared: they can\'t attack you and will flee on their next move' },
    { id: 'revolution', name: 'Revolution', max: 1, fx: [A('b', -1), A('p', 6)], text: 'Remove 1 bishop; add 6 pawns' },
    { id: 'ruins', name: 'Ruins', max: 1, fx: [A('r', 1), A('p', 2), HP('r', -2)], text: 'Add 1 rook and 2 pawns; rook: -2 HP' },
    { id: 'saboteur', name: 'Saboteur', max: 2, fx: [A('p', -2), A('b', 1), RULE('saboteur')], text: 'Remove 2 pawns; add 1 bishop; doubles the fire arc for 1 pellet' },
    { id: 'saddle', name: 'Saddle', max: 1, later: LATER, text: 'Knight: -1 speed; knights carry non-rook and non-knight pieces when moving' },
    { id: 'sanctity', name: 'Sanctity', max: 1, needs: ['conclave'], fx: [A('b', 1), RULE('sanctity')], text: 'Add 1 bishop; bishops\' souls can\'t be reaped' },
    { id: 'scouting', name: 'Scouting', max: 1, fx: [A('n', -1), A('p', 2), SP('p', -1)], text: 'Remove 1 knight; add 2 pawns; pawn: +1 speed' },
    { id: 'selfdefense', name: 'Self-Defense', max: 1, fx: [HP('n', 2)], text: 'Knight: +2 HP' },
    { id: 'shortage', name: 'Shortage', max: 1, needs: ['grenade'], fx: [A('p', -1), S('res', -3), S('grenades', -1)], text: 'Remove 1 pawn; -3 ammo max; -1 grenade' },
    { id: 'sokoban', name: 'Sokoban', max: 1, later: LATER, text: 'Add 2 pawns; rooks can push pieces up to 3 times' },
    { id: 'stoning', name: 'Stoning', max: 1, later: LATER, text: 'Pawns throw stones at the black king' },
    { id: 'succubus', name: 'Succubus', max: 1, fx: [A('q', 1), S('souls', 1)], text: 'Add 1 queen; add 1 extra soul slot' },
    { id: 'tagteam', name: 'Tag Team', max: 1, later: LATER, text: 'Rook and bishop: +1 HP; bishops can swap positions with a rook; rooks can swap positions with a bishop' },
    { id: 'bridge', name: 'The Bridge', max: 1, needs: ['moat'], later: LATER, text: 'Add 1 knight after 10 turns; open a path in the moat' },
    { id: 'jester', name: 'The Jester', max: 1, needs: ['throne'], later: LATER, text: 'Add 1 pawn; jesters can move diagonally and have +2 speed; jesters pass the hat when they die' },
    { id: 'redbook', name: 'The Red Book', max: 1, fx: [A('b', 1), RULE('redbook')], text: 'Add 1 bishop; bishops can move (not attack) orthogonally' },
    { id: 'royalhunt', name: 'The Royal Hunt', max: 2, later: LATER, text: 'Leaders shoot arrows at you; +1 leader shooting speed' },
    { id: 'heir', name: 'The Secret Heir', max: 1, tags: ['leader'], fx: [A('p', 1), RULE('heir')], text: 'Add 1 pawn; heir: +1 (the secret heir replaces the king if he dies)' },
    { id: 'theocracy', name: 'Theocracy', max: 1, tags: ['leader'], fx: [A('k', -1), A('b', 1), HP('b', 2), RULE('goalBishops'), RULE('goalKnights')], text: 'Remove 1 king; add 1 bishop; bishop: +2 HP; win if all bishops are dead; win if all knights are dead' },
    { id: 'throne', name: 'Throne Room', max: 1, fx: [HP('leader', 2), HP('q', 1)], text: 'Leader: +2 HP; queen: +1 HP' },
    { id: 'tragic', name: 'Tragic Homecoming', max: 1, fx: [A('q', 1), HP('q', 2)], text: 'Add 1 queen; queen: +2 HP' },
    { id: 'trench', name: 'Trench War', max: 2, later: LATER, text: 'Add 1 knight; pieces in trench or moat have 50% chance to dodge bullets; dig 5 holes in the battlefield' },
    { id: 'trowel', name: 'Trowel', max: 1, fx: [HP('r', 4), OFF('noPawn')], text: 'Rook: +4 HP; flip card if there\'s no pawn on the board' },
    { id: 'undead', name: 'Undead Armies', max: 1, fx: [HP('p', -1), RULE('undead')], text: 'Pawn: -1 HP; replace knights, bishops and rooks with pawns after they die' },
    { id: 'unicorn', name: 'Unicorn', max: 1, later: LATER, text: 'Add 1 knight; knights can charge your king instead of moving, pushing him by one square' },
    { id: 'unsettled', name: 'Unsettled Throne', max: 1, tags: ['leader'], fx: [RULE('heir'), RULE('heirKing')], text: 'Heir: +1 (the secret heir replaces the king if he dies); heirs promote to kings' },
    { id: 'vampirism', name: 'Vampirism', max: 1, needs: ['bleed'], fx: [HP('leader', 1), HP('q', 1), RULE('vampire')], text: 'Leader and queen: +1 HP; leaders and queens are immune to bleed; leaders and queens heal from nearby bleeding pieces, and stop their bleeding' },
    { id: 'vendetta', name: 'Vendetta', max: 1, tags: ['blade'], fx: [S('blade', 1), RULE('vendetta')], text: 'Blade: +1; when you kill a piece, all pieces of that type move on the next turn' },
    { id: 'witch', name: 'Witch\'s Curse', max: 1, fx: [S('fp', -1), S('range', -1), S('arc', 10), FLIP('queenKilled')], text: '-1 firepower; -1 fire range; fire arc: +10°; flip this card if a queen is killed' },
    { id: 'zealots', name: 'Zealots', max: 1, fx: [SP('p', -1), SP('b', -1), OFF('noBishop')], text: 'Pawn: +1 speed; bishop: +1 speed; flip card if there\'s no bishop on the board' }
  ];
  var CARD = {};
  BLACK.forEach(function (c) { c.color = 'black'; c.fx = c.fx || []; CARD[c.id] = c; });
  WHITE.forEach(function (c) { c.color = 'white'; c.fx = c.fx || []; CARD[c.id] = c; });

  /* ---------- pieces and ranks ---------- */
  var NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King', P: 'Boss Pawn', K: 'White King' };
  var BASE_HP = { p: 3, n: 3, b: 4, r: 5, q: 5, k: 8, P: 16, K: 24 };
  var BASE_SPD = { p: 5, n: 2, b: 3, r: 4, q: 4, k: 4, P: 3, K: 4 };
  // the army at the start of a floor on rank r (the game's rank table), before the cards
  function rankArmy(rank, floor) {
    var a = { p: 4 + (rank >= 2 ? 2 : 0), n: 1 + (rank >= 5 ? 1 : 0), b: 1 + (rank >= 8 ? 1 : 0), r: rank >= 3 ? 1 : 0, q: floor >= 4 ? 1 : 0 };
    var hp = { k: 8 + (rank >= 7) + (rank >= 14) + (rank >= 18), q: 5 + (rank >= 17), r: 5 + (rank >= 9) + (rank >= 13) + (rank >= 19), b: 4 + (rank >= 15), n: 3 + (rank >= 16), p: 3 + (rank >= 20) };
    return { count: a, hp: hp, strategy: (rank >= 4 ? 1 : 0) + (rank >= 10 ? 1 : 0), bossHp: rank >= 11 ? 2 : 1, arc: rank >= 12 ? 15 : 0, ammo: rank >= 20 ? 1 : 0, promote: rank >= 6 };
  }
  // The original has its bosses on floor 12 only. The Boss Pawn (BOSS_PAWN_FLOOR) is kept for cards that call it, but no
  // floor is its own any more (0: none); floor 6 is an ordinary floor.
  var FLOORS = 12, BOSS_PAWN_FLOOR = 0, BOSS_FLOOR = 12, CARD_FLOORS = 10;
  var isBoss = function (floor) { return floor === BOSS_FLOOR || (BOSS_PAWN_FLOOR > 0 && floor === BOSS_PAWN_FLOOR); };

  /* ---------- luck ---------- */
  function rngOf(F) { var r = R.mulberry(F.seed >>> 0), n = 0; return function () { n++; F.seed = (Math.imul(F.seed ^ 0x9E3779B9, 2654435761) + n) >>> 0; return r(); }; }
  function pick(list, rnd) { return list[Math.floor(rnd() * list.length)]; }

  /* ---------- which cards work right now ---------- */
  // the states a card can be switched off by (OFF), read from the floor
  var OFFS = {
    notEdge: function (run, F) { return !(row(F.king) === 0 || row(F.king) === H - 1 || col(F.king) === 0 || col(F.king) === W - 1); },
    adjacent: function (run, F) { return F.pieces.some(function (p) { return cheb(p.sq, F.king) === 1; }); },
    noRook: function (run, F) { return !F.pieces.some(function (p) { return p.t === 'r'; }); },
    noPawn: function (run, F) { return !F.pieces.some(function (p) { return p.t === 'p'; }); },
    noBishop: function (run, F) { return !F.pieces.some(function (p) { return p.t === 'b'; }); },
    onlyQueens: function (run, F) { return F.pieces.length > 0 && F.pieces.every(function (p) { return p.t === 'q'; }); },
    notStealth: function (run, F) { return !(F.stealth > 0); }
  };
  function offOf(c) { for (var i = 0; i < c.fx.length; i++) if (c.fx[i].off) return c.fx[i].off; return null; }
  // does card id work now? (owned, not flipped this floor, not switched off)
  function works(run, F, id) {
    var c = CARD[id];
    if (!c || !(run.cards[id] > 0)) return false;
    if (F && F.flipped && F.flipped[id]) return false;
    var off = offOf(c);
    if (off && F && OFFS[off](run, F)) return false;
    return true;
  }
  // how many working cards have rule id (a card taken twice counts twice)
  function rule(run, F, id) {
    var n = 0;
    for (var cid in run.cards) {
      var c = CARD[cid];
      if (!c || !works(run, F, cid)) continue;
      for (var i = 0; i < c.fx.length; i++) if (c.fx[i].r === id) n += run.cards[cid];
    }
    return n;
  }
  var has = function (run, id) { return rule(run, run.F, id) > 0; }; // a rule, on the run's floor
  // a card turns face down for the rest of the floor when its event happens
  function flipOn(run, F, event, ev) {
    for (var cid in run.cards) {
      var c = CARD[cid];
      if (!c || (F.flipped && F.flipped[cid])) continue;
      for (var i = 0; i < c.fx.length; i++) if (c.fx[i].flip === event) {
        F.flipped = F.flipped || {};
        F.flipped[cid] = 1;
        if (ev) ev.push({ e: 'flip', card: cid });
        if (c.color === 'white') leaveOf(run, F, cid, ev); // a white card face down: the pieces it brought leave
      }
    }
  }
  function leaveOf(run, F, cid, ev) {
    F.pieces.filter(function (p) { return p.src === cid && !p.leader; }).forEach(function (p) {
      F.pieces.splice(F.pieces.indexOf(p), 1);
      if (ev) ev.push({ e: 'leave', id: p.id, sq: p.sq });
    });
  }
  // the tags a run has: from its cards and its gun
  function tagsOf(run) {
    var t = {}, g = GUN[run.gun];
    (g && g.tags || []).forEach(function (x) { t[x] = 1; });
    for (var cid in run.cards) if (run.cards[cid] > 0 && CARD[cid]) (CARD[cid].tags || []).forEach(function (x) { t[x] = 1; });
    return t;
  }

  /* ---------- stats of the king's gun, from the shotgun, the cards and the rank ---------- */
  function stats(run, F) {
    var g = GUN[run.gun] || GUN.solomon, rk = rankArmy(run.rank, run.floor);
    var st = { cap: g.cap, res: g.res + rk.ammo, fp: g.fp, arc: g.arc + rk.arc, rmin: g.rmin, rmax: g.rmax, pierce: g.pierce || 0, knock: g.knock || 0, blade: g.blade || 0, bladeFree: !!g.bladeFree,
      souls: 1, move: 1, mark: g.mark || 0, grenades: g.grenades || 0, gdmg: 3, search: g.search || 0, reloadOnKill: !!g.reloadOnKill, regen: 1, fright: 0, shrapnel: 0, jump: 0, jdmg: 0 };
    var add = function (key, v) { if (key === 'range') { st.rmin += v; st.rmax += v; } else st[key] = (st[key] || 0) + v; };
    for (var id in run.cards) {
      var c = CARD[id], k = run.cards[id];
      if (!c || !works(run, F, id)) continue;
      c.fx.forEach(function (e) {
        if (!e.s) return;
        if (e.every) { if (F) add(e.s, e.v * k * Math.floor(F.turn / e.every)); } // grows over the floor
        else add(e.s, e.v * k);
      });
    }
    if (F) {
      // what depends on the moment: the gun's load, empty soul slots, the scope, a pawn's soul in the next shot
      if (rule(run, F, 'forceFp') && F.gun[0] >= st.cap) st.fp += 1;
      if (rule(run, F, 'confidence')) st.fp += Math.max(0, st.cap - F.gun[0]);
      if (rule(run, F, 'absolution')) st.fp += rule(run, F, 'absolution') * Math.max(0, st.souls - run.souls.length);
      if (F.fodder) st.fp += F.fodder;
      if (F.scope) { st.arc -= 45; st.rmin += 2; st.rmax += 2; }
      // Ancient Flagstone: standing on one; Unholy Call: all pentagrams triggered; Secret Move: all jumps spent
      if (F.stones && F.stones.indexOf(F.king) >= 0) st.fp += rule(run, F, 'flagstone');
      if (F.pentaFp) st.fp += F.pentaFp;
      if (F.secret) st.fp += F.secret;
    }
    st.fp = Math.max(1, st.fp); st.arc = Math.max(5, st.arc); st.rmin = Math.max(1, st.rmin); st.rmax = Math.max(st.rmin + 0.5, st.rmax);
    st.cap = Math.max(1, st.cap); st.res = Math.max(0, st.res); st.blade = Math.max(0, st.blade); st.pierce = Math.min(0.95, st.pierce); st.knock = Math.min(1, st.knock);
    st.grenades = Math.max(0, st.grenades); st.gdmg = Math.max(1, st.gdmg); st.regen = Math.max(0, st.regen); st.souls = Math.max(0, st.souls); st.jump = Math.max(0, st.jump);
    return st;
  }

  /* ---------- a run ---------- */
  function newRun(o) {
    var run = { v: 2, gun: GUN[o.gun] ? o.gun : 'solomon', rank: Math.max(1, Math.min(20, o.rank || 1)), floor: 1, seed: (o.seed || Date.now()) >>> 0, cards: {}, souls: [], turns: 0, kills: 0, phase: 'play', offer: null, searchLeft: 0 };
    run.F = newFloor(run);
    return run;
  }
  function leaderKind(floor) { return floor === BOSS_FLOOR ? 'K' : BOSS_PAWN_FLOOR > 0 && floor === BOSS_PAWN_FLOOR ? 'P' : 'k'; }
  // the hit points and speed of a new piece of kind t, from the rank and the cards
  function hpFor(run, t, leader) {
    var rk = rankArmy(run.rank, run.floor), v = t === 'P' || t === 'K' ? BASE_HP[t] * rk.bossHp : (rk.hp[t] || BASE_HP[t]);
    for (var id in run.cards) {
      var c = CARD[id];
      if (!c || !works(run, null, id)) continue;
      c.fx.forEach(function (e) { if (e.hp && !e.every && (e.hp === t || e.hp === 'all' || (e.hp === 'leader' && leader))) v += e.v * run.cards[id]; });
    }
    return Math.max(1, v);
  }
  function spdFor(run, t, leader) {
    var v = BASE_SPD[t] || 3;
    for (var id in run.cards) {
      var c = CARD[id];
      if (!c || !works(run, null, id)) continue;
      c.fx.forEach(function (e) { if (e.spd && !e.every && (e.spd === t || e.spd === 'all' || (e.spd === 'leader' && leader))) v += e.v * run.cards[id]; });
    }
    return Math.max(1, v);
  }
  function makePiece(run, F, t, sq, rnd, o) {
    o = o || {};
    var hp = hpFor(run, t, !!o.leader), spd = spdFor(run, t, !!o.leader);
    var p = { id: F.nextId++, t: t, sq: sq, hp: hp, max: hp, spd: spd, tm: o.tm != null ? o.tm : 1 + Math.floor(rnd() * spd), leader: !!o.leader, first: true, bleed: 0, mark: 0 };
    if (o.src) p.src = o.src;
    return p;
  }
  function newFloor(run) {
    var rk = rankArmy(run.rank, run.floor), st = stats(run, null);
    var F = { floor: run.floor, seed: (run.seed + run.floor * 7919) >>> 0, king: at(H - 1, 4), pieces: [], nextId: 1, turn: 0, gun: [st.cap, st.res], grenades: st.grenades, threw: false, over: null, killer: -1, extra: false, flags: {}, flipped: {} };
    var rnd = rngOf(F);
    // the army: the rank's pieces, then what the cards add and take away (each card's own pieces remember it)
    var count = {}, from = [], k;
    for (k in rk.count) count[k] = rk.count[k];
    for (var id in run.cards) {
      var c = CARD[id];
      if (!c) continue;
      c.fx.forEach(function (e) {
        if (!e.a || e.after || e.every) return;
        var n = e.v * run.cards[id];
        if (e.a === 'k') { if (n < 0) F.noKing = true; return; }
        count[e.a] = (count[e.a] || 0) + n;
        if (n > 0) for (var i = 0; i < n; i++) from.push([e.a, id]);
      });
    }
    for (k in count) count[k] = Math.max(0, count[k]);
    var lead = leaderKind(run.floor);
    if (isBoss(run.floor)) F.noKing = false;
    // what clears the floor: the leader, or with the king gone (Commoner's Reign, Theocracy, Guillotine) whole groups
    if (F.noKing) {
      var goals = [];
      if (rule(run, null, 'goalKnights')) goals.push('n');
      if (rule(run, null, 'goalBishops')) goals.push('b');
      F.goal = goals.length ? goals : ['all'];
    }
    F.heirs = isBoss(run.floor) ? 0 : rule(run, null, 'heir');
    F.mist = rule(run, null, 'mist');
    if (rule(run, null, 'paralysis')) F.paralysis = 6;
    // where they start: the leader and the heavy pieces on the back row, knights behind the pawns, pawns in front
    var taken = {}; taken[F.king] = 1;
    var srcFor = function (t) { for (var i = 0; i < from.length; i++) if (from[i][0] === t) return from.splice(i, 1)[0][1]; return null; };
    var place = function (t, rows, leader) {
      var free = [];
      rows.forEach(function (r) { for (var f = 0; f < W; f++) { var q = at(r, f); if (!taken[q]) free.push(q); } });
      if (!free.length) for (var q2 = 0; q2 < N - 2 * W; q2++) if (!taken[q2]) free.push(q2);
      if (!free.length) return null;
      var q3 = pick(free, rnd);
      taken[q3] = 1;
      var p = makePiece(run, F, t, q3, rnd, { leader: leader, src: leader ? null : srcFor(t) });
      F.pieces.push(p);
      return p;
    };
    if (!F.noKing) { if (lead === 'k') place('k', [0], true); else place(lead, lead === 'P' ? [1] : [0], true); }
    ['q', 'r', 'b'].forEach(function (t) { for (var i = 0; i < count[t]; i++) place(t, [0, 1]); });
    for (var i = 0; i < count.n; i++) place('n', [1, 0]);
    for (i = 0; i < count.p; i++) place('p', [2, 1]);
    // Anarchy: the formation shuffled, two pieces promoted to another kind
    if (rule(run, null, 'anarchy')) {
      var sqs = F.pieces.map(function (p) { return p.sq; });
      for (i = sqs.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t0 = sqs[i]; sqs[i] = sqs[j]; sqs[j] = t0; }
      F.pieces.forEach(function (p, n2) { p.sq = sqs[n2]; });
      var pool = F.pieces.filter(function (p) { return !p.leader; });
      for (var a2 = 0; a2 < 2 && pool.length; a2++) {
        var pp = pool.splice(Math.floor(rnd() * pool.length), 1)[0], kinds = ['p', 'n', 'b', 'r', 'q'].filter(function (x) { return x !== pp.t; });
        var nt = pick(kinds, rnd), nh = hpFor(run, nt, false);
        pp.t = nt; pp.hp = nh; pp.max = nh; pp.spd = spdFor(run, nt, false); pp.tm = Math.min(pp.tm, pp.spd);
      }
    }
    // Plumed Knight: one knight with 3 more HP that also attacks diagonally
    if (rule(run, null, 'plumed')) { var kn = F.pieces.find(function (p) { return p.t === 'n'; }); if (kn) { kn.hp += 3; kn.max += 3; kn.plumed = true; } }
    if (rule(run, null, 'kite')) F.pieces.forEach(function (p) { if (p.t === 'n') p.shield = 1; });
    F.pieces.sort(function (a, b) { return a.sq - b.sq; });
    // a card switched off from the start (Highest Dungeon without a rook): its HP and speed do not count
    offAdjust(run, F, null);
    // the king does not start in an attack
    var safe = [at(H - 1, 4), at(H - 1, 3), at(H - 1, 5), at(H - 1, 2), at(H - 1, 6), at(H - 1, 1), at(H - 1, 0), at(H - 1, 7)];
    for (i = 0; i < safe.length; i++) { F.king = safe[i]; if (!attackedBy(run, F, F.king).length && !pieceAt(F, F.king)) break; }
    features(run, F, rnd);
    F.st = st;
    return F;
  }
  /* What the black cards put on a floor: the king's allies (Bastion, Right-hand, Warhorse) next to him, the moat, and
     the squares that mean something (flagstones, pentagrams, holes, cannonballs, the waypoint), and the spies among
     the pawns. The squares are picked from the middle of the board, where both sides can reach them. */
  function features(run, F, rnd) {
    var free = function (rows) { var o = []; rows.forEach(function (r) { for (var f = 0; f < W; f++) { var q = at(r, f); if (!occupied(F, q) && !marked(F, q)) o.push(q); } }); return o; };
    var spot = function (rows) { var o = free(rows); return o.length ? pick(o, rnd) : -1; };
    F.allies = [];
    for (var cid in run.cards) {
      var c = CARD[cid];
      if (!c || !works(run, null, cid)) continue;
      c.fx.forEach(function (e) {
        if (!e.ally) return;
        for (var i = 0; i < e.v * run.cards[cid]; i++) {
          var near = free([H - 1, H - 2]).filter(function (q) { return cheb(q, F.king) <= 2; }), q = near.length ? pick(near, rnd) : spot([H - 1, H - 2, H - 3]);
          if (q >= 0) F.allies.push(allyOf(F, e.ally, q));
        }
      });
    }
    if (rule(run, null, 'moat')) F.moat = true;
    var n = rule(run, null, 'flagstone');
    if (n) { F.stones = []; for (var i = 0; i < n; i++) { var q = spot([3, 4, 5]); if (q >= 0) F.stones.push(q); } }
    if (rule(run, null, 'unholy')) { F.penta = []; for (i = 0; i < 3; i++) { q = spot([2, 3, 4, 5]); if (q >= 0) F.penta.push({ sq: q, on: true }); } F.pentaFp = 0; }
    if (rule(run, null, 'shovel')) { F.holes = []; for (i = 0; i < 2; i++) { q = spot([2, 3, 4, 5]); if (q >= 0) F.holes.push(q); } }
    n = rule(run, null, 'shotput');
    if (n) { F.balls = []; for (i = 0; i < n; i++) { q = spot([3, 4, 5, 6]); if (q >= 0) F.balls.push(q); } }
    if (rule(run, null, 'undercover')) F.way = spot([0, 1, 2, 3, 4]);
    // The Mole: as many spies as masks, among the pawns
    n = rule(run, null, 'mole');
    var pawns = F.pieces.filter(function (p) { return p.t === 'p' && !p.leader; });
    for (i = 0; i < n && pawns.length; i++) pawns.splice(Math.floor(rnd() * pawns.length), 1)[0].spy = 1;
  }
  // a black piece that fights for the king: it moves on the White army's clock, at its own kind's speed
  function allyOf(F, t, sq) { return { id: F.nextId++, t: t, sq: sq, spd: BASE_SPD[t] || 3, tm: BASE_SPD[t] || 3, ally: true }; }
  // a square with a mark of a card on it (the new features keep off each other)
  function marked(F, q) {
    return (F.stones || []).indexOf(q) >= 0 || (F.holes || []).indexOf(q) >= 0 || (F.balls || []).indexOf(q) >= 0 || F.way === q || (F.penta || []).some(function (x) { return x.sq === q; });
  }
  /* A card with HP or speed that switches off (OFF) while the floor goes on: the pieces lose what it gave them,
     once. F.offDone remembers the cards already taken back. */
  function offAdjust(run, F, ev) {
    F.offDone = F.offDone || {};
    for (var cid in run.cards) {
      var c = CARD[cid], off = c && offOf(c);
      if (!off || F.offDone[cid] || !OFFS[off](run, F)) continue;
      if (off === 'notEdge' || off === 'adjacent' || off === 'notStealth') continue; // the king's own state: read live, nothing to take back
      F.offDone[cid] = 1;
      c.fx.forEach(function (e) {
        var v = (e.v || 0) * run.cards[cid];
        F.pieces.forEach(function (p) {
          if (e.hp && (e.hp === p.t || e.hp === 'all' || (e.hp === 'leader' && p.leader))) { p.max = Math.max(1, p.max - v); p.hp = Math.max(1, Math.min(p.max, p.hp - v)); }
          if (e.spd && (e.spd === p.t || e.spd === 'all' || (e.spd === 'leader' && p.leader))) p.spd = Math.max(1, p.spd - v);
        });
      });
      if (ev) ev.push({ e: 'flip', card: cid });
    }
  }

  /* ---------- the board ---------- */
  function pieceAt(F, q) { for (var i = 0; i < F.pieces.length; i++) if (F.pieces[i].sq === q) return F.pieces[i]; return null; }
  function allyAt(F, q) { var a = F.allies || []; for (var i = 0; i < a.length; i++) if (a[i].sq === q) return a[i]; return null; }
  // the things that stand on a square besides the White army: the king, his allies, his hologram, a cannonball
  function solid(F, q) { return q === F.king || (F.holo != null && F.holo >= 0 && F.holo === q) || !!allyAt(F, q) || (F.balls || []).indexOf(q) >= 0; }
  function occupied(F, q) { return solid(F, q) || !!pieceAt(F, q); }
  // The Moat: the middle row of the board; a piece that is not a knight stops on it before it goes across
  var MOAT = 4;
  var crossesMoat = function (a, b) { return (row(a) - MOAT) * (row(b) - MOAT) < 0; };
  // Prison: knights and bishops next to a rook (a black one of Bastion too) can't move or attack, and lines pass through them
  function jailed(run, F, p) {
    if (!(p.t === 'n' || p.t === 'b') || !rule(run, F, 'prison')) return false;
    return F.pieces.concat(F.allies || []).some(function (x) { return x.t === 'r' && cheb(x.sq, p.sq) === 1; });
  }
  // the squares piece p attacks, and where it may go (moves: empty squares only, it never takes another white piece)
  function reach(run, F, p, forMove) {
    var out = [], r = row(p.sq), f = col(p.sq), i, d, q;
    if (p.scared && !forMove) return out; // a frightened piece does not attack
    if (jailed(run, F, p)) return out;
    var prison = rule(run, F, 'prison');
    var blocks = function (q0) { var x = pieceAt(F, q0); return solid(F, q0) || (!!x && !(prison && jailed(run, F, x))); };
    var moat = F.moat && p.t !== 'n';
    var ray = function (dirs, max, through) {
      for (i = 0; i < dirs.length; i++) {
        for (d = 1; d <= max; d++) {
          q = at(r + dirs[i][0] * d, f + dirs[i][1] * d);
          if (q < 0 || (moat && !through && crossesMoat(p.sq, q))) break;
          var occ = blocks(q);
          if (forMove) { if (occupied(F, q)) { if (!through && occ) break; continue; } out.push(q); }
          else { out.push(q); if (occ && !through) break; }
        }
      }
    };
    var steps = function (list) { for (i = 0; i < list.length; i++) { q = at(r + list[i][0], f + list[i][1]); if (q >= 0 && !(forMove && occupied(F, q))) out.push(q); } };
    var poison = has(run, 'poison') && F.turn < 15, qmax = rule(run, F, 'mistress') ? 3 : 8;
    switch (p.t) {
      case 'p':
        if (forMove) {
          var dirs = has(run, 'militia') ? ORTH : [[1, 0]];
          for (i = 0; i < dirs.length; i++) {
            q = at(r + dirs[i][0], f + dirs[i][1]);
            if (q < 0 || occupied(F, q)) continue;
            out.push(q);
            if (p.first && has(run, 'assault') && dirs[i][0] === 1) { var q2 = at(r + 2, f); if (q2 >= 0 && !occupied(F, q2) && !(moat && crossesMoat(p.sq, q2))) out.push(q2); }
          }
          if (has(run, 'lightfoot')) KG.forEach(function (dd) { // Lightfoot: over a piece next to it, any way
            var q1 = at(r + dd[0], f + dd[1]), q3 = at(r + 2 * dd[0], f + 2 * dd[1]);
            if (q1 >= 0 && q3 >= 0 && occupied(F, q1) && !occupied(F, q3) && out.indexOf(q3) < 0 && !(moat && crossesMoat(p.sq, q3))) out.push(q3);
          });
        } else if (has(run, 'bloodless') || F.unarmed) { /* Bloodless Coup, or the guards' weapons taken: pawns can't attack */ }
        else if (has(run, 'pikemen')) { q = at(r + 1, f); if (q >= 0) { out.push(q); if (!occupied(F, q)) { q = at(r + 2, f); if (q >= 0) out.push(q); } } }
        else steps(has(run, 'militia') ? DIAG : [[1, -1], [1, 1]]);
        break;
      case 'n': steps(KN); if (p.plumed && !forMove) steps(DIAG); break;
      case 'b': ray(DIAG, 8, has(run, 'ascension')); if (forMove && has(run, 'redbook')) ray(ORTH, 8, false); break;
      case 'r': ray(ORTH, 8, false); break;
      case 'q': ray(ORTH.concat(DIAG), poison ? 1 : qmax, false); break;
      case 'k': steps(KG); break;
      case 'K': steps(ORTH); break;
      case 'P': if (forMove) steps([[1, 0], [1, -1], [1, 1]]); else steps([[1, -1], [1, 0], [1, 1]]); break;
    }
    // Presbyopia: queens and bishops do not attack the squares right next to them
    if (!forMove && (p.t === 'q' || p.t === 'b') && has(run, 'presbyopia')) out = out.filter(function (x) { return cheb(x, p.sq) >= 2; });
    // August Presence: no piece but a king comes next to the Black King
    if (forMove && p.t !== 'k' && p.t !== 'K' && has(run, 'august')) out = out.filter(function (x) { return cheb(x, F.king) > 1; });
    return out;
  }
  /* Black cards that keep a piece from taking the king although it attacks his square: stealth (nobody sees him),
     Elusive (a piece about to move, or moving, can't), Deep Waters (a piece in the moat can't). moving: the piece is
     taking its move right now. */
  function kingSafe(run, F, p, moving) {
    if (F.stealth > 0) return true;
    if ((moving || p.tm <= 1) && has(run, 'elusive')) return true;
    if (F.moat && row(p.sq) === MOAT && has(run, 'deepwaters')) return true;
    return false;
  }
  // the white pieces that attack square q (frightened or jailed ones aside; on the king's own square, the ones that may take him)
  function attackedBy(run, F, q) {
    var out = [];
    for (var i = 0; i < F.pieces.length; i++) { var p = F.pieces[i]; if (reach(run, F, p, false).indexOf(q) >= 0 && !(q === F.king && kingSafe(run, F, p, false))) out.push(p); }
    return out;
  }
  function inCheck(run, F) { return attackedBy(run, F, F.king).length > 0; }

  /* ---------- what the king may do ---------- */
  // the actions that do not end the king's turn (anything else is his one action of the turn)
  var FREE = { grenade: 1, scope: 1, wand: 1, orb: 1, strafe: 1, jump: 1, lift: 1, project: 1, key: 1, disrupt: 1 };
  // a piece the wands and the key may turn to the king's side: not a leader, not a king, not the Boss Pawn
  var convertible = function (p) { return !p.leader && 'pnbrq'.indexOf(p.t) >= 0; };
  function actions(run, F) {
    if (F.over) return [];
    // a disruption of the White Army to choose (Undercover Mission, The Mole, Small Key): that comes first
    if (F.disrupt) return disruptions(run, F).map(function (id) { return { k: 'disrupt', id: id }; });
    var out = [], st = stats(run, F), r = row(F.king), f = col(F.king), i, d, q, seen = {};
    // Analysis Paralysis: the first turns of a floor the king can only wait, unless he is in check
    if (F.paralysis > 0 && !inCheck(run, F)) return [{ k: 'wait' }];
    var step = function (q0, how) { if (seen[q0]) return; seen[q0] = 1; var a = { k: 'move', to: q0 }; if (how) a[how] = true; out.push(a); };
    var safe = function (q0) { return q0 >= 0 && q0 !== F.king && !occupied(F, q0) && !attackedFrom(run, F, q0); };
    // steps (Sprint: up to two squares in a line, the first one free; not across the moat)
    for (i = 0; i < KG.length; i++) for (d = 1; d <= st.move; d++) {
      q = at(r + KG[i][0] * d, f + KG[i][1] * d);
      if (q < 0 || occupied(F, q) || (F.moat && crossesMoat(F.king, q))) break;
      if (!attackedFrom(run, F, q)) step(q);
    }
    // Ancient Flagstone: from anywhere onto a flagstone; Shovel: from a hole next to the king to any other hole;
    // Faithful Steed: a black knight next to the king carries him one knight's jump
    (F.stones || []).forEach(function (q0) { if (safe(q0)) step(q0, 'stone'); });
    if (F.holes && rule(run, F, 'shovel')) F.holes.forEach(function (q0) { if (safe(q0) && F.holes.some(function (e) { return e !== q0 && cheb(e, F.king) <= 1; })) step(q0, 'tunnel'); });
    if (rule(run, F, 'steed') && (F.allies || []).some(function (a) { return a.t === 'n' && cheb(a.sq, F.king) === 1; })) KN.forEach(function (dd) { var q0 = at(r + dd[0], f + dd[1]); if (safe(q0)) step(q0, 'steed'); });
    if (F.gun[0] > 0) out.push({ k: 'shoot' }); // aimed at any square: the target goes with it (act)
    if (F.gun[0] > 1 && rule(run, F, 'decree')) out.push({ k: 'decree' }); // Unjust Decree: every loaded shell at once
    var full = F.gun[0] >= st.cap;
    if ((!full && F.gun[1] > 0) || (full && rule(run, F, 'force') && F.gun[0] === st.cap && F.gun[1] > 0 && !F.moved)) out.push({ k: 'reload' });
    if (st.blade > 0) for (i = 0; i < KG.length; i++) {
      q = at(r + KG[i][0], f + KG[i][1]);
      var p = q >= 0 ? pieceAt(F, q) : null;
      if (p && (st.bladeFree || p.hp <= st.blade)) out.push({ k: 'blade', to: q });
    }
    var loafers = rule(run, F, 'loafers') > 0; // Royal Loafers: no soul moves
    run.souls.forEach(function (t, si) {
      if (t === 'p') { if (rule(run, F, 'fodder')) out.push({ k: 'fodder', soul: si }); } // Cannon Fodder: a pawn's soul feeds the next shot
      else if (!loafers) soulMoves(run, F, t).forEach(function (q2) { out.push({ k: 'soul', soul: si, to: q2 }); });
      // Soul Projection: with no ally, a soul becomes one, next to the king
      if (rule(run, F, 'projection') && !(F.allies || []).length) KG.forEach(function (dd) { var q0 = at(r + dd[0], f + dd[1]); if (q0 >= 0 && !occupied(F, q0)) out.push({ k: 'project', soul: si, to: q0 }); });
    });
    if (F.grenades > 0 && !F.threw) out.push({ k: 'grenade' });
    // the wands: once per floor each, free (they do not end the turn)
    var wandOk = function (id) { return rule(run, F, id) > 0 && !(F.wands && F.wands[id]); };
    var each = function (id, ok) { if (wandOk(id)) F.pieces.forEach(function (x) { if (ok(x)) out.push({ k: 'wand', id: id, to: x.sq }); }); };
    if (wandOk('wandfrenzy') && (F.gun[0] < st.cap || F.gun[1] < st.res)) out.push({ k: 'wand', id: 'wandfrenzy' });
    if (wandOk('wandgust') && F.pieces.length) out.push({ k: 'wand', id: 'wandgust' });
    if (wandOk('wandwings')) wingSquares(run, F).forEach(function (q3) { out.push({ k: 'wand', id: 'wandwings', to: q3 }); });
    if (wandOk('wanddownpour') && F.pieces.length) out.push({ k: 'wand', id: 'wanddownpour' });
    each('wandexecution', function (x) { return x.t === 'p' && !x.leader; });
    each('wandwrath', function (x) { return x.t !== 'k' && x.t !== 'K'; });
    each('wandsouls', function (x) { return 'nbrq'.indexOf(x.t) >= 0 && !x.soulless; });
    each('wandtreachery', function (x) { return convertible(x) && cheb(x.sq, F.king) === 1; });
    if (wandOk('wandhypnosis')) F.pieces.forEach(function (x) { reach(run, F, x, true).forEach(function (q4) { out.push({ k: 'wand', id: 'wandhypnosis', from: x.sq, to: q4 }); }); });
    if (rule(run, F, 'scope')) out.push({ k: 'scope' });
    // Seer's Orb and Royal Loafers: pick a piece, as often as the king likes
    if (rule(run, F, 'orb')) F.pieces.forEach(function (x) { if (x.id !== F.orb) out.push({ k: 'orb', id: x.id }); });
    if (loafers) F.pieces.forEach(function (x) { out.push({ k: 'strafe', id: x.id }); });
    // jumps (Elusive, Taunting Hop, Secret Move): over a white piece next to the king onto the free square behind it,
    // each piece once a turn, as many a turn as the jump stat
    if (st.jump > (F.jumps || 0)) KG.forEach(function (dd) {
      var q1 = at(r + dd[0], f + dd[1]), q2 = at(r + 2 * dd[0], f + 2 * dd[1]), over = q1 >= 0 ? pieceAt(F, q1) : null;
      if (over && !(F.jumped && F.jumped[over.id]) && safe(q2) && !(F.moat && crossesMoat(F.king, q2))) out.push({ k: 'jump', to: q2, over: q1 });
    });
    // King's Shoulders (once a floor) and Imperial Shot Put: lift a piece or a cannonball next to the king, then throw it
    if (!F.carry) KG.forEach(function (dd) {
      var q0 = at(r + dd[0], f + dd[1]), x = q0 >= 0 ? pieceAt(F, q0) : null;
      if (x && convertible(x) && rule(run, F, 'shoulders') && !F.lifted) out.push({ k: 'lift', to: q0 });
      else if (q0 >= 0 && (F.balls || []).indexOf(q0) >= 0 && rule(run, F, 'shotput')) out.push({ k: 'lift', to: q0 });
    });
    else KG.forEach(function (dd) { var q0 = at(r + dd[0], f + dd[1]); if (q0 >= 0 && (!solid(F, q0))) out.push({ k: 'throw', to: q0 }); });
    // Small Key: a rook next to the king goes, a jailed piece next to him changes sides
    if (rule(run, F, 'smallkey') && !F.keyUsed) KG.forEach(function (dd) {
      var q0 = at(r + dd[0], f + dd[1]), x = q0 >= 0 ? pieceAt(F, q0) : null;
      if (x && !x.leader && (x.t === 'r' || (jailed(run, F, x) && convertible(x)))) out.push({ k: 'key', to: q0 });
    });
    // Shovel: dig a hole next to the king (that is his turn)
    if (rule(run, F, 'shovel')) KG.forEach(function (dd) { var q0 = at(r + dd[0], f + dd[1]); if (q0 >= 0 && !occupied(F, q0) && !marked(F, q0)) out.push({ k: 'dig', to: q0 }); });
    // nothing at all left (walled in, no shell): the king can only wait for his fate
    if (!out.some(function (x) { return !FREE[x.k]; })) out.push({ k: 'wait' });
    return out;
  }
  // the disruptions of the White Army the king may choose from (the original's list, as far as its cards are built)
  function disruptions(run, F) {
    var out = [];
    if (Object.keys(run.cards).some(function (id) { return CARD[id] && CARD[id].color === 'white' && works(run, F, id); })) out.push('sabotage');
    out.push('poison');
    if (F.pieces.some(function (p) { return p.t === 'k' || p.t === 'K'; })) out.push('stab');
    out.push('ammo', 'glue');
    if (run.cards.backups > 0 && !F.unarmed) out.push('guards');
    return out;
  }
  // Wand of Wings: up to 3 squares in a straight line, any direction, over nothing, onto a square that is not attacked
  function wingSquares(run, F) {
    var out = [], r = row(F.king), f = col(F.king);
    for (var i = 0; i < KG.length; i++) for (var d = 1; d <= 3; d++) {
      var q = at(r + KG[i][0] * d, f + KG[i][1] * d);
      if (q < 0 || occupied(F, q)) break;
      if (!attackedFrom(run, F, q)) out.push(q);
    }
    return out;
  }
  // would the king be attacked on q (with him standing there instead)?
  function attackedFrom(run, F, q) {
    var save = F.king; F.king = q;
    var a = attackedBy(run, F, q).length > 0;
    F.king = save;
    return a;
  }
  function soulMoves(run, F, t) {
    var fake = { t: t, sq: F.king, first: false }, save = F.king, out = [];
    F.king = -1; // the king is lifted off the board while his soul move is worked out
    var to = reach(run, F, fake, true);
    F.king = save;
    to.forEach(function (q) { if (q !== F.king && !pieceAt(F, q) && !attackedFrom(run, F, q)) out.push(q); });
    return out;
  }
  // the fire cone for a target: the aim angle and the stats, for the board to draw
  function cone(run, F, target) {
    var st = stats(run, F);
    return { from: F.king, to: target, arc: st.arc, rmin: st.rmin, rmax: st.rmax, fp: st.fp };
  }

  /* ---------- damage ---------- */
  function hurt(run, F, p, n, ev, cause) {
    if (n <= 0 || F.pieces.indexOf(p) < 0 || p.dying) return false;
    if (p.leader && has(run, 'castle')) {
      // Castle: the leader swaps places with a rook before he would take damage
      var rook = F.pieces.find(function (x) { return x.t === 'r'; });
      if (rook && !F.swapped) { var s0 = p.sq; p.sq = rook.sq; rook.sq = s0; F.swapped = true; ev.push({ e: 'swap', a: p.id, b: rook.id, aTo: p.sq, bTo: rook.sq }); p = rook; }
    }
    // Knightmare: a knight is only hit when it moves next or threatens the king
    if (p.t === 'n' && has(run, 'knightmare') && p.tm > 1 && reach(run, F, p, false).indexOf(F.king) < 0) { ev.push({ e: 'immune', id: p.id, sq: p.sq }); return false; }
    // Kite Shield: a knight's shield takes the first hit whole
    if (p.shield) { p.shield = 0; ev.push({ e: 'shield', id: p.id, sq: p.sq }); return false; }
    if (p.bleed && !((p.leader || p.t === 'q') && has(run, 'vampire'))) n += 1;
    // caps on the damage of one turn: Buckler of Limos (leaders, 3), Cathedral (pieces next to a rook, 2)
    var cap = 1e9;
    if (p.leader && has(run, 'buckler')) cap = 3;
    if (p.t !== 'r' && has(run, 'cathedral') && F.pieces.some(function (x) { return x.t === 'r' && x !== p && cheb(x.sq, p.sq) === 1; })) cap = Math.min(cap, 2);
    if (cap < 1e9) { if (p.turnDmg == null || p.dmgTurn !== F.turn) { p.turnDmg = 0; p.dmgTurn = F.turn; } n = Math.max(0, Math.min(n, cap - p.turnDmg)); p.turnDmg += n; if (n <= 0) return false; }
    p.hp -= n;
    if (p.leader && has(run, 'bodyguard') && p.hp < 1 && F.pieces.some(function (x) { return x.t === 'n'; })) p.hp = 1; // Bodyguard
    if (p.t === 'q' && has(run, 'ironmaiden') && p.hp < 1) p.hp = 1; // Iron Maiden: queens can't die
    // Emergency Call: the first hit on a leader quickens it and crowns the nearest pawn
    if (p.leader && has(run, 'emergency') && !F.emergency) {
      F.emergency = true; p.spd = Math.max(1, p.spd - 1);
      var pw = F.pieces.filter(function (x) { return x.t === 'p'; }).sort(function (a, b) { return cheb(a.sq, p.sq) - cheb(b.sq, p.sq); })[0];
      if (pw) promote(run, F, pw, ev, rngOf(F), 2);
    }
    ev.push({ e: 'hit', id: p.id, sq: p.sq, n: n, hp: Math.max(0, p.hp), cause: cause || 'shot' });
    if (p.hp <= 0) {
      // Flesh Wall: a pawn stays (and blocks) until the king's action is over
      if (p.t === 'p' && has(run, 'fleshwall') && cause !== 'end') { p.dying = true; p.hp = 0; return true; }
      kill(run, F, p, ev); return true;
    }
    return false;
  }
  // the pieces Flesh Wall kept standing fall now
  function settle(run, F, ev) {
    // again until none is left: a fall can bring another one down (a rat from a dead pawn)
    for (var guard = 0; guard < 64; guard++) {
      var down = F.pieces.filter(function (p) { return p.dying; });
      if (!down.length) return;
      down.forEach(function (p) { p.dying = false; kill(run, F, p, ev); });
    }
  }
  // pieces near a square are scared: they don't attack and flee on their next move
  function scare(run, F, around, radius, ev) {
    F.pieces.forEach(function (p) { if (cheb(p.sq, around) <= radius && !p.scared) { p.scared = 1; ev.push({ e: 'scare', id: p.id, sq: p.sq }); } });
  }
  function kill(run, F, p, ev) {
    var i = F.pieces.indexOf(p);
    if (i < 0) return;
    F.pieces.splice(i, 1);
    run.kills++;
    F.kills = (F.kills || 0) + 1;
    ev.push({ e: 'kill', id: p.id, t: p.t, sq: p.sq });
    var st = stats(run, F);
    // the soul: a non-pawn piece's (a pawn's with Cannon Fodder), not a bishop's under Sanctity
    var reap = (p.t === 'n' || p.t === 'b' || p.t === 'r' || p.t === 'q' || (p.t === 'p' && has(run, 'fodder'))) && !(p.t === 'b' && has(run, 'sanctity')) && !p.soulless; // Wand of Souls took it already
    if (reap && run.souls.length < st.souls) { run.souls.push(p.t); ev.push({ e: 'soul', t: p.t }); }
    if (p.t === 'p' && has(run, 'smallfry')) F.gun[1] = Math.min(st.res, F.gun[1] + rule(run, F, 'smallfry'));
    if (p.t === 'r' && has(run, 'depot')) F.gun[1] = Math.min(st.res, F.gun[1] + 2 * rule(run, F, 'depot'));
    if (p.t === 'n' && has(run, 'jousting')) F.extra = true;
    if (st.reloadOnKill) { var fill = Math.min(st.cap - F.gun[0], F.gun[1]); F.gun[0] += fill; F.gun[1] -= fill; }
    // Fearsome (and Human Shield, Reign of Terror): the pieces near the king, or near the dead one, are scared
    if (has(run, 'fearsome') && st.fright > 0 && (p.t !== 'p' || has(run, 'humanshield'))) { scare(run, F, F.king, st.fright, ev); if (has(run, 'terror')) scare(run, F, p.sq, st.fright, ev); }
    if (p.t === 'q' && has(run, 'mother')) F.pieces.forEach(function (x) { if (!x.scared) { x.scared = 1; ev.push({ e: 'scare', id: x.id, sq: x.sq }); } }); // Reverend Mother
    if (p.t === 'p') flipOn(run, F, 'pawnKilled', ev);
    if (p.t === 'q') flipOn(run, F, 'queenKilled', ev);
    // Mausoleum: when a rook dies, kings take 2 damage
    if (p.t === 'r' && has(run, 'mausoleum')) F.pieces.filter(function (x) { return x.t === 'k'; }).forEach(function (x) { hurt(run, F, x, 2, ev, 'mausoleum'); });
    // the floor: the leader (or an heir in his place), or the groups that have to fall
    if (p.leader) {
      var heirs = F.pieces.filter(function (x) { return x.t === 'p'; });
      if (F.heirs > 0 && heirs.length && !isBoss(F.floor)) {
        F.heirs--;
        var heir = heirs.sort(function (a, b) { return a.sq - b.sq; })[0];
        heir.leader = true;
        if (has(run, 'heirKing')) { heir.t = 'k'; heir.max = hpFor(run, 'k', true); heir.hp = heir.max; heir.spd = spdFor(run, 'k', true); }
        ev.push({ e: 'heir', id: heir.id, sq: heir.sq, t: heir.t });
      } else { F.over = 'won'; F.leaderSq = p.sq; ev.push({ e: 'cleared' }); }
    } else goalCheck(run, F, p.sq, ev);
    if (F.over) return;
    if (F.orb === p.id) F.orb = -1;
    if (F.strafe === p.id) F.strafe = -1;
    // Low-Cost Disguise: a dead pawn, and the king goes unseen for 2 turns (4 with the card twice)
    if (p.t === 'p' && has(run, 'disguise')) hide(F, 2 * rule(run, F, 'disguise'), ev);
    // Wand of Execution: ready again when a piece other than a pawn dies
    if (p.t !== 'p' && F.wands && F.wands.wandexecution && rule(run, F, 'wandexecution')) { delete F.wands.wandexecution; ev.push({ e: 'refill', id: 'wandexecution' }); }
    // Rapunzel: the first rook of the floor to die lets a black queen down, where it fell (or next to the king)
    if (p.t === 'r' && has(run, 'rapunzel') && !F.rapunzel) {
      var qs = !occupied(F, p.sq) ? p.sq : KG.map(function (d) { return at(row(F.king) + d[0], col(F.king) + d[1]); }).filter(function (x) { return x >= 0 && !occupied(F, x); })[0];
      F.rapunzel = true;
      if (qs != null) { var qa = allyOf(F, 'q', qs); F.allies = F.allies || []; F.allies.push(qa); ev.push({ e: 'ally', id: qa.id, t: 'q', sq: qs }); }
    }
    // Undead Armies: a dead knight, bishop or rook comes back as a pawn
    if ((p.t === 'n' || p.t === 'b' || p.t === 'r') && has(run, 'undead') && !occupied(F, p.sq)) {
      var up = makePiece(run, F, 'p', p.sq, rngOf(F), { tm: BASE_SPD.p });
      F.pieces.push(up); ev.push({ e: 'arrive', id: up.id, t: 'p', sq: up.sq });
    }
    // Last Guardian: the last pawn is crowned
    if (p.t === 'p' && has(run, 'guardian')) { var last = F.pieces.filter(function (x) { return x.t === 'p'; }); if (last.length === 1) promote(run, F, last[0], ev, rngOf(F), 1); }
    // Vendetta: every piece of the dead one's kind moves on the next turn
    if (has(run, 'vendetta')) F.pieces.forEach(function (x) { if (x.t === p.t) x.tm = 1; });
    if (has(run, 'rats') && F.pieces.length) {
      // a rat bites the nearest piece
      var near = F.pieces.slice().sort(function (a, b) { return cheb(a.sq, p.sq) - cheb(b.sq, p.sq); })[0];
      ev.push({ e: 'rat', from: p.sq, to: near.sq });
      hurt(run, F, near, 1, ev, 'rat');
    }
    offAdjust(run, F, ev);
  }

  /* ---------- the king's turn ---------- */
  // act(run, action) changes run (and run.F) and gives the events, in order, for the board to animate
  function act(run, a, opts) {
    var F = run.F, ev = [], st = stats(run, F), rnd = rngOf(F);
    opts = opts || {};
    if (F.over || run.phase !== 'play') return ev;
    if (F.paralysis > 0 && !inCheck(run, F) && a.k !== 'wait') return ev; // Analysis Paralysis
    // the actions of the wands and the newer cards are played only as actions() offers them
    if ((CHECKED[a.k] || F.disrupt || a.stone || a.tunnel || a.steed) && !actions(run, F).some(function (x) { return Object.keys(x).every(function (k) { return x[k] === a[k]; }); })) return ev;
    F.swapped = false; F.extra = false;
    var endsTurn = true, from = F.king;
    if (a.k === 'scope') { F.scope = !F.scope; ev.push({ e: 'scope', on: !!F.scope }); return ev; } // Engraved Scope: aiming costs nothing
    if (a.k === 'orb') { orbOn(run, F, a.id, ev); return ev; } // Seer's Orb: costs nothing
    if (a.k === 'strafe') { F.strafe = F.strafe === a.id ? -1 : a.id; ev.push({ e: 'strafe', id: F.strafe }); return ev; } // Royal Loafers: the target of the next steps
    if (a.k === 'disrupt') { disrupt(run, F, a.id, ev); endsTurn = false; }
    else if (a.k === 'move' || a.k === 'soul') {
      ev.push({ e: 'king', from: F.king, to: a.to, soul: a.k === 'soul' ? run.souls[a.soul] : null });
      F.king = a.to; F.moved = true; F.scope = false;
      if (a.k === 'soul') {
        run.souls.splice(a.soul, 1); if (has(run, 'crown')) endsTurn = false;
        reveal(run, F, ev, false); // a soul move gives a stealthy king away
        // Holoking: a hologram of the king stays where he was (one at a time); Cloaking Device: and he goes unseen
        if (has(run, 'holoking')) { F.holo = from; ev.push({ e: 'holo', sq: from }); if (has(run, 'cloaking')) hide(F, 6, ev); }
      } else {
        // Shovel: the hole the king went down collapses behind him
        if (a.tunnel && F.holes) { var hin = F.holes.filter(function (q) { return q !== a.to && cheb(q, from) <= 1; })[0]; if (hin != null) { F.holes.splice(F.holes.indexOf(hin), 1); ev.push({ e: 'tunnel', from: hin, to: a.to }); } }
        // as in the original: a step fills the gun from the reserve as far as it goes, and (no shot this turn) brings
        // ammo back to the reserve
        var fill = Math.min(st.cap - F.gun[0], F.gun[1]);
        if (fill > 0) { F.gun[0] += fill; F.gun[1] -= fill; ev.push({ e: 'load', n: fill }); }
        F.gun[1] = Math.min(st.res, F.gun[1] + st.regen);
        if (st.grenades) F.grenades = st.grenades;
        // Royal Loafers: the step fires at the picked target, with 15 degrees more spread, as the gun stands on the new square
        var tg = F.strafe != null && F.strafe >= 0 ? F.pieces.find(function (x) { return x.id === F.strafe; }) : null;
        if (tg && F.gun[0] > 0) {
          var sst = stats(run, F); sst.arc += 15;
          reveal(run, F, ev, true);
          fire(run, F, sst, tg.sq, rnd, ev);
          F.fodder = 0; F.secret = 0;
        }
      }
    } else if (a.k === 'wand') {
      var wst = stats(run, F);
      F.wands = F.wands || {}; F.wands[a.id] = true; endsTurn = false;
      ev.push({ e: 'wand', id: a.id });
      if (a.id === 'wandfrenzy') { F.gun = [wst.cap, wst.res]; ev.push({ e: 'load', n: wst.cap }); }
      else if (a.id === 'wandgust') {
        // every white piece one square north (the far side), where that square is free; their clocks wait two turns more
        F.pieces.slice().sort(function (x, y) { return row(x.sq) - row(y.sq); }).forEach(function (p) {
          var up = at(row(p.sq) - 1, col(p.sq));
          if (up >= 0 && !occupied(F, up)) { ev.push({ e: 'move', id: p.id, from: p.sq, to: up, gust: true }); p.sq = up; }
          p.tm += 2;
        });
      } else if (a.id === 'wandwings') { ev.push({ e: 'king', from: F.king, to: a.to }); F.king = a.to; }
      else if (a.id === 'wanddownpour') {
        // 10 bolts of 1 damage, spread over up to 4 random pieces
        var pool = F.pieces.slice(), aims = [];
        while (pool.length && aims.length < 4) aims.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
        for (var b = 0; b < 10; b++) {
          var live = aims.filter(function (x) { return F.pieces.indexOf(x) >= 0 && !x.dying; });
          if (!live.length || F.over) break;
          var tp = pick(live, rnd);
          ev.push({ e: 'bolt', from: F.king, to: tp.sq });
          hurt(run, F, tp, 1, ev, 'wand');
        }
      } else if (a.id === 'wandexecution') { var xp = pieceAt(F, a.to); ev.push({ e: 'bolt', from: F.king, to: a.to }); kill(run, F, xp, ev); }
      else if (a.id === 'wandwrath') { ev.push({ e: 'bolt', from: F.king, to: a.to }); hurt(run, F, pieceAt(F, a.to), wst.fp, ev, 'wand'); }
      else if (a.id === 'wandsouls') {
        // the piece is stunned for 3 turns and its soul is the king's (in place of the oldest when the slots are full)
        var sp = pieceAt(F, a.to);
        sp.tm += 3; sp.soulless = true; ev.push({ e: 'stun', id: sp.id, sq: sp.sq });
        if (wst.souls > 0) { if (run.souls.length >= wst.souls) run.souls.splice(0, 1); run.souls.push(sp.t); ev.push({ e: 'soul', t: sp.t }); }
      } else if (a.id === 'wandtreachery') convert(run, F, pieceAt(F, a.to), ev);
      else if (a.id === 'wandhypnosis') {
        // the king plays one move of a white piece; it has moved, so its clock starts again
        var hp0 = pieceAt(F, a.from);
        ev.push({ e: 'move', id: hp0.id, from: hp0.sq, to: a.to }); hp0.sq = a.to; hp0.first = false; hp0.tm = hp0.spd;
        if ((hp0.t === 'p' || hp0.t === 'P') && row(a.to) === H - 1) promote(run, F, hp0, ev, rnd, rankArmy(run.rank, run.floor).strategy);
      }
    } else if (a.k === 'jump') {
      // a jump over a piece next to the king: free, the jumped piece takes the jump damage (Taunting Hop)
      var over = pieceAt(F, a.over);
      ev.push({ e: 'king', from: F.king, to: a.to, jump: true });
      F.king = a.to; endsTurn = false;
      reveal(run, F, ev, false);
      F.jumps = (F.jumps || 0) + 1; F.jumped = F.jumped || {}; F.jumped[over.id] = 1;
      if (st.jdmg > 0) hurt(run, F, over, st.jdmg, ev, 'jump');
      // Secret Move: all the jumps of the turn spent, the next shot has the jump stat as extra firepower
      if (has(run, 'secretmove') && F.jumps >= st.jump) { F.secret = st.jump; ev.push({ e: 'secret', n: st.jump }); }
    } else if (a.k === 'lift') {
      endsTurn = false;
      var bi = (F.balls || []).indexOf(a.to);
      if (bi >= 0) { F.balls.splice(bi, 1); F.carry = { ball: true }; ev.push({ e: 'lift', sq: a.to, ball: true }); }
      else {
        var lp = pieceAt(F, a.to);
        if (F.orb === lp.id) orbOn(run, F, -1, ev); // the orb lets go first (Mystic Shackles gives the speed back)
        F.pieces.splice(F.pieces.indexOf(lp), 1); F.carry = { p: lp }; F.lifted = true;
        ev.push({ e: 'lift', id: lp.id, sq: a.to });
      }
    } else if (a.k === 'throw') {
      reveal(run, F, ev, true);
      throwAt(run, F, a.to, ev);
    } else if (a.k === 'project') {
      var pt = run.souls.splice(a.soul, 1)[0], pa = allyOf(F, pt, a.to);
      F.allies = F.allies || []; F.allies.push(pa); endsTurn = false;
      ev.push({ e: 'ally', id: pa.id, t: pt, sq: a.to });
    } else if (a.k === 'key') {
      // Small Key: a rook leaves the board, a jailed piece changes sides; then the White Army is disrupted
      var kp = pieceAt(F, a.to);
      F.keyUsed = true; endsTurn = false;
      ev.push({ e: 'key', sq: a.to });
      if (kp.t === 'r') { F.pieces.splice(F.pieces.indexOf(kp), 1); ev.push({ e: 'leave', id: kp.id, sq: kp.sq }); goalCheck(run, F, kp.sq, ev); offAdjust(run, F, ev); }
      else convert(run, F, kp, ev);
      if (!F.over) F.disrupt = true;
    } else if (a.k === 'dig') {
      F.holes = F.holes || []; F.holes.push(a.to); ev.push({ e: 'dig', sq: a.to });
    } else if (a.k === 'fodder') {
      // Cannon Fodder: a pawn's soul gives +2 firepower to the next shot, without spending the turn
      if (run.souls[a.soul] !== 'p') return ev;
      run.souls.splice(a.soul, 1); F.fodder = (F.fodder || 0) + 2; endsTurn = false;
      ev.push({ e: 'fodder' });
    } else if (a.k === 'wait') {
      ev.push({ e: 'wait' });
    } else if (a.k === 'reload') {
      // a reload turn fills the gun from the reserve as far as it goes (Force-Feeding: one more than the gun holds, if the
      // king stood still)
      var fill2 = Math.min(st.cap - F.gun[0], F.gun[1]);
      if (fill2 > 0) { F.gun[0] += fill2; F.gun[1] -= fill2; ev.push({ e: 'load', n: fill2 }); }
      else if (F.gun[1] > 0 && rule(run, F, 'force') && F.gun[0] === st.cap && !F.moved) { F.gun[0]++; F.gun[1]--; ev.push({ e: 'load', n: 1 }); }
      if (st.grenades) F.grenades = st.grenades;
      ev.push({ e: 'reload' });
      F.scope = false;
      flipOn(run, F, 'reload', ev);
      // Death Mark: every reload hurts the marked pieces
      F.pieces.slice().forEach(function (p) { if (p.mark) hurt(run, F, p, p.mark, ev, 'mark'); });
    } else if (a.k === 'blade') {
      var bp = pieceAt(F, a.to);
      ev.push({ e: 'blade', to: a.to });
      var killed = bp && hurt(run, F, bp, st.blade, ev, 'blade');
      if (killed && !F.over && !attackedFrom(run, F, a.to) && !pieceAt(F, a.to)) { ev.push({ e: 'king', from: F.king, to: a.to }); F.king = a.to; }
      // Bushido: once a turn an execution does not end the turn
      if (killed && has(run, 'bushido') && !F.bushido) { F.bushido = true; endsTurn = false; }
    } else if (a.k === 'grenade') {
      // a grenade: damage on the 3 x 3 squares around where it lands, the king too (not with Sacred Light); it does not end the turn
      if (!(a.to >= 0 && a.to < N) || cheb(a.to, F.king) > 4) return ev;
      F.grenades--; F.threw = true; endsTurn = false;
      ev.push({ e: 'grenade', from: F.king, to: a.to });
      for (var gr = -1; gr <= 1; gr++) for (var gf = -1; gf <= 1; gf++) {
        var gq = at(row(a.to) + gr, col(a.to) + gf);
        if (gq < 0) continue;
        if (gq === F.king && !has(run, 'grenadeSafe')) { F.over = 'dead'; F.killer = -2; ev.push({ e: 'dead', by: -2, cause: 'grenade' }); }
        var gp = pieceAt(F, gq);
        if (!gp) continue;
        var dmg = st.gdmg + (gq === a.to ? 2 * rule(run, F, 'alms') : 0);
        var alive = !hurt(run, F, gp, dmg, ev, 'grenade') && F.pieces.indexOf(gp) >= 0;
        if (alive && has(run, 'grenadeBleed')) gp.bleed = 1;
        if (alive && has(run, 'grenadeStun')) { gp.tm += 2; ev.push({ e: 'stun', id: gp.id, sq: gp.sq }); }
      }
      if (F.over === 'dead') return ev;
    } else if (a.k === 'shoot' || a.k === 'decree') {
      if (F.gun[0] <= 0 || a.to === F.king || a.to < 0) return ev;
      reveal(run, F, ev, true); // a shot gives a stealthy king away (not with a Silencer)
      // Unjust Decree: every loaded shell, one after the other, at the same target
      var shots = a.k === 'decree' ? F.gun[0] : 1;
      for (var sh = 0; sh < shots && !F.over; sh++) fire(run, F, st, a.to, rnd, ev);
      F.fodder = 0; F.secret = 0;
      // Sawed-off Justice: the blast pushes the king one square back, if that square is free and safe
      if (has(run, 'sawed') && !F.over) {
        var br = -Math.sign(row(a.to) - row(F.king)), bf = -Math.sign(col(a.to) - col(F.king)), back = at(row(F.king) + br, col(F.king) + bf);
        if (back >= 0 && !occupied(F, back) && !attackedFrom(run, F, back)) { ev.push({ e: 'king', from: F.king, to: back }); F.king = back; }
      }
    }
    if (a.k !== 'grenade') F.threw = false;
    settle(run, F, ev);
    if (F.over === 'won') return floorDone(run, ev);
    afterKing(run, F, from, ev);
    if (!endsTurn || F.extra) { ev.push({ e: 'extra' }); return ev; }
    if (opts.split) { F.pend = 1; return ev; } // the board shows the king's action first, then finish() plays White
    return whiteTurn(run, F, ev, rnd);
  }
  // one shell: the pellets (and Saboteur's wide pellet, Shrapnel's harmless ones), then each hit
  function fire(run, F, st, target, rnd, ev) {
    F.gun[0]--;
    R.use({ W: W, H: H });
    var hitTest = function (q) { return !!pieceAt(F, q); };
    var wide = Math.min(st.fp, rule(run, F, 'saboteur'));
    var res = R.pellets({ from: F.king, to: target, n: st.fp - wide, arc: st.arc, rmin: st.rmin, rmax: st.rmax, pierce: st.pierce, rng: rnd, hit: hitTest });
    var extra = wide ? R.pellets({ from: F.king, to: target, n: wide, arc: st.arc * 2, rmin: st.rmin, rmax: st.rmax, pierce: st.pierce, rng: rnd, hit: hitTest }) : null;
    var frag = st.shrapnel ? R.pellets({ from: F.king, to: target, n: st.shrapnel, arc: st.arc, rmin: st.rmin, rmax: st.rmax, pierce: st.pierce, rng: rnd, hit: hitTest }) : null;
    var hits = {};
    [res, extra].forEach(function (x) { if (x) for (var q in x.hits) hits[q] = (hits[q] || 0) + x.hits[q]; });
    var touched = {};
    if (frag) for (var fq in frag.hits) touched[fq] = 1;
    ev.push({ e: 'shot', from: F.king, to: target, paths: res.paths.concat(extra ? extra.paths : [], frag ? frag.paths : []) });
    // the hits land piece by piece: each one hurts, may knock back, bleed and mark
    var order = Object.keys(hits).concat(Object.keys(touched).filter(function (q) { return !hits[q]; })).map(Number).sort(function (x, y) { return cheb(x, F.king) - cheb(y, F.king); });
    order.forEach(function (q) {
      var p = pieceAt(F, q);
      if (!p || p.dying) return;
      var n = hits[q] || 0, tries = n + (touched[q] ? 1 : 0);
      if (st.mark) p.mark = Math.max(p.mark, st.mark);
      var died = n > 0 && hurt(run, F, p, n, ev, 'shot');
      if (has(run, 'bleedHit')) p.bleed = 1;
      if (!died && !F.over && st.knock && rnd() < 1 - Math.pow(1 - st.knock, tries) && !p.leader && F.pieces.indexOf(p) >= 0) knock(run, F, p, ev);
    });
  }
  // knocked one square away from the king; off the board it is gone
  function knock(run, F, p, ev) {
    var dr = Math.sign(row(p.sq) - row(F.king)), df = Math.sign(col(p.sq) - col(F.king)), nr = row(p.sq) + dr, nf = col(p.sq) + df, to = at(nr, nf);
    if (to < 0) fallOff(run, F, p, ev);
    else if (!occupied(F, to)) { ev.push({ e: 'knock', id: p.id, from: p.sq, to: to }); p.sq = to; }
  }
  // a piece off the edge of the board dies (Bouncy Castle: it comes back fully healed)
  function fallOff(run, F, p, ev) {
    ev.push({ e: 'fall', id: p.id, sq: p.sq });
    if (has(run, 'bouncy')) {
      var free = []; for (var q = 0; q < 2 * W; q++) if (!occupied(F, q)) free.push(q);
      if (free.length) { p.sq = pick(free, rngOf(F)); p.hp = p.max; p.bleed = 0; p.mark = 0; ev.push({ e: 'arrive', id: p.id, t: p.t, sq: p.sq, back: true }); return; }
    }
    kill(run, F, p, ev);
  }

  /* ---------- the newer black cards' pieces of the turn ---------- */
  var CHECKED = { wand: 1, orb: 1, strafe: 1, jump: 1, lift: 1, throw: 1, project: 1, key: 1, dig: 1, disrupt: 1 };
  // stealth: for n turns the White Army does not see the king (Low-Cost Disguise, Cloaking Device)
  function hide(F, n, ev) { if (n > (F.stealth || 0)) { F.stealth = n; ev.push({ e: 'stealth', n: n }); } }
  // a shot (shot: true; a Silencer keeps him hidden), a soul move or a jump gives the stealthy king away
  function reveal(run, F, ev, shot) { if (F.stealth > 0 && !(shot && has(run, 'silencer'))) { F.stealth = 0; ev.push({ e: 'stealth', n: 0 }); } }
  // the hologram is taken by piece p, which stands stunned for 2 turns; with it goes the Cloaking Device's stealth
  function holoDown(run, F, p, ev) {
    ev.push({ e: 'holo', sq: F.holo, off: true });
    F.holo = -1; p.tm += 2;
    ev.push({ e: 'stun', id: p.id, sq: p.sq });
    if (has(run, 'cloaking') && F.stealth > 0) { F.stealth = 0; ev.push({ e: 'stealth', n: 0 }); }
  }
  // a white piece changes sides (Wand of Treachery, Small Key, a spy that promotes): from now on a black ally
  function convert(run, F, p, ev) {
    var i = F.pieces.indexOf(p);
    if (i < 0) return;
    if (F.orb === p.id) orbOn(run, F, -1, ev);
    F.pieces.splice(i, 1);
    if (F.strafe === p.id) F.strafe = -1;
    var a = allyOf(F, p.t, p.sq);
    F.allies = F.allies || []; F.allies.push(a);
    ev.push({ e: 'convert', id: p.id, ally: a.id, t: p.t, sq: p.sq });
    goalCheck(run, F, p.sq, ev);
    offAdjust(run, F, ev);
  }
  // with the king gone (Commoner's Reign, Theocracy, Guillotine): the floor is won when the groups to kill are gone
  function goalCheck(run, F, sq, ev) {
    if (!F.goal || F.over) return;
    var left = F.pieces.concat(F.carry && F.carry.p ? [F.carry.p] : []);
    if (F.goal.some(function (g) { return g === 'all' ? !left.length : !left.some(function (x) { return x.t === g; }); })) { F.over = 'won'; F.leaderSq = sq; ev.push({ e: 'cleared' }); }
  }
  /* King's Shoulders and Imperial Shot Put: what the king carries flies from him over the square `first` on in a line,
     until it hits something. A white piece it hits takes 3 damage, and so does a thrown piece, which then lands next
     to it; past the edge of the board a thrown piece dies, a cannonball is gone. */
  var THROW_DMG = 3;
  function throwAt(run, F, first, ev) {
    var c = F.carry, dr = row(first) - row(F.king), df = col(first) - col(F.king), q = first, prev = -1, hit = null;
    F.carry = null;
    if (!c) return;
    while (q >= 0) {
      if (occupied(F, q)) { hit = pieceAt(F, q); break; }
      prev = q; q = at(row(q) + dr, col(q) + df);
    }
    var land = prev;
    if (hit && land < 0) land = KG.map(function (d) { return at(row(hit.sq) + d[0], col(hit.sq) + d[1]); }).filter(function (x) { return x >= 0 && !occupied(F, x); })[0];
    ev.push({ e: 'throw', from: F.king, to: hit ? hit.sq : prev, ball: !!c.ball, t: c.p ? c.p.t : null });
    if (c.ball) {
      if (land != null && land >= 0 && (hit || q >= 0)) F.balls.push(land);
      if (hit) hurt(run, F, hit, THROW_DMG, ev, 'throw');
      return;
    }
    var p = c.p;
    if (land == null || land < 0) { F.pieces.push(p); p.sq = hit ? hit.sq : first; kill(run, F, p, ev); return; } // nowhere to land: crushed
    p.sq = land; F.pieces.push(p);
    if (!hit) { if (q < 0) fallOff(run, F, p, ev); return; } // it flew off the board, or came down before an obstacle
    hurt(run, F, hit, THROW_DMG, ev, 'throw');
    if (F.pieces.indexOf(p) >= 0) hurt(run, F, p, THROW_DMG, ev, 'throw');
  }
  // Seer's Orb on piece id (-1: off). Mystic Shackles: that piece is one turn slower and bound to the orb's prediction
  function orbOn(run, F, id, ev) {
    var old = F.pieces.find(function (x) { return x.id === F.orb; });
    if (old && old.shk) { old.spd = Math.max(1, old.spd - 1); old.shk = 0; delete old.lock; }
    F.orb = id;
    var p = F.pieces.find(function (x) { return x.id === id; });
    if (p && has(run, 'shackles')) { p.spd += 1; p.tm += 1; p.shk = 1; p.lock = predict(run, F, p); }
    ev.push({ e: 'orb', id: id, sq: p ? p.sq : -1 });
  }
  // the luck the orbed piece moves with: the same for the prediction and the move, so the orb can tell it
  function orbRnd(F, p, turn) { return R.mulberry(((F.floor * 7919) ^ (turn * 104729) ^ Math.imul(p.id, 2654435761)) >>> 0); }
  // where piece p would go on its next move, as the board stands (-1: it stays)
  function predict(run, F, p) {
    if (p.lock != null && p.shk) return p.lock;
    return choose(run, F, p, rankArmy(run.rank, run.floor).strategy, orbRnd(F, p, F.turn + 1));
  }
  // after the king's action: a pentagram (Unholy Call), the waypoint (Undercover Mission) or a spy (The Mole) reached
  function afterKing(run, F, from, ev) {
    if (F.over) return;
    var pg = F.king !== from && F.penta ? F.penta.find(function (x) { return x.sq === F.king && x.on; }) : null;
    if (pg) {
      pg.on = false; F.extra = true; ev.push({ e: 'penta', sq: pg.sq });
      if (F.penta.every(function (x) { return !x.on; })) { F.pentaFp = (F.pentaFp || 0) + 2; F.penta.forEach(function (x) { x.on = true; }); ev.push({ e: 'pentaAll', fp: F.pentaFp }); }
    }
    if (F.way >= 0 && F.king === F.way) { F.way = -1; F.disrupt = true; F.extra = true; ev.push({ e: 'mission', sq: F.king }); }
    var spy = F.pieces.find(function (x) { return x.spy === 1 && cheb(x.sq, F.king) === 1; });
    if (spy && !F.disrupt) { spy.spy = 2; F.disrupt = true; F.extra = true; ev.push({ e: 'spy', id: spy.id, sq: spy.sq }); }
  }
  // a disruption of the White Army for the rest of the floor
  function disrupt(run, F, id, ev) {
    var st = stats(run, F), rnd = rngOf(F);
    F.disrupt = false;
    ev.push({ e: 'disrupt', id: id });
    if (id === 'sabotage') {
      // a white card face down: its pieces leave, its rules stop
      var ws = Object.keys(run.cards).filter(function (c) { return CARD[c] && CARD[c].color === 'white' && works(run, F, c); }).sort();
      if (ws.length) { var c = pick(ws, rnd); F.flipped = F.flipped || {}; F.flipped[c] = 1; ev.push({ e: 'flip', card: c }); leaveOf(run, F, c, ev); goalCheck(run, F, F.king, ev); }
    } else if (id === 'poison') F.pieces.forEach(function (p) { p.max = Math.max(1, p.max - 1); p.hp = Math.max(1, Math.min(p.hp, p.max)); });
    else if (id === 'stab') { var k = F.pieces.filter(function (p) { return p.t === 'k' || p.t === 'K'; }).sort(function (x, y) { return y.leader - x.leader; })[0]; if (k) hurt(run, F, k, 4, ev, 'stab'); }
    else if (id === 'ammo') { F.gun = [st.cap, st.res]; F.grenades = st.grenades; ev.push({ e: 'load', n: st.cap }); }
    else if (id === 'glue') F.pieces.forEach(function (p) { p.spd += 1; });
    else if (id === 'guards') F.unarmed = true;
  }
  // the king's last chances against piece p that would take him: his hologram, if p attacks it too, takes the blow;
  // or (Faithful Steed) a black knight swaps places with him and is taken in his place
  function spare(run, F, p, ev) {
    if (F.holo != null && F.holo >= 0 && reach(run, F, p, false).indexOf(F.holo) >= 0) {
      ev.push({ e: 'move', id: p.id, from: p.sq, to: F.holo }); p.sq = F.holo; holoDown(run, F, p, ev); return true;
    }
    var kn = has(run, 'steed') ? (F.allies || []).find(function (a) { return a.t === 'n'; }) : null;
    if (kn) {
      var ks = F.king;
      ev.push({ e: 'king', from: ks, to: kn.sq, steed: true });
      F.king = kn.sq;
      F.allies.splice(F.allies.indexOf(kn), 1);
      ev.push({ e: 'move', id: p.id, from: p.sq, to: ks }); p.sq = ks;
      ev.push({ e: 'allydead', id: kn.id, t: kn.t, sq: ks });
      return true;
    }
    return false;
  }
  /* The king's allies (black pieces): on the White Army's clock, each at its own speed. When its time comes an ally
     strikes a white piece it attacks (the leader first, then the weakest) and steps onto its square if it dies;
     otherwise it moves towards the nearest white piece, onto a square from which it attacks one if it can, and out of
     the army's reach if it can. It never hurts the king; his pellets and grenades fly past it. */
  var ALLY_DMG = { p: 1, n: 2, b: 2, r: 3, q: 3 };
  function allyReach(run, F, a) {
    var mv = [], hit = [], r = row(a.sq), f = col(a.sq), moat = F.moat && a.t !== 'n';
    var look = function (q) { if (pieceAt(F, q)) { hit.push(q); return false; } if (occupied(F, q)) return false; mv.push(q); return true; };
    var ray = function (dirs) { dirs.forEach(function (d) { for (var k = 1; k < 8; k++) { var q = at(r + d[0] * k, f + d[1] * k); if (q < 0 || (moat && crossesMoat(a.sq, q)) || !look(q)) break; } }); };
    if (a.t === 'n') KN.forEach(function (d) { var q = at(r + d[0], f + d[1]); if (q >= 0) look(q); });
    else if (a.t === 'b') ray(DIAG);
    else if (a.t === 'r') ray(ORTH);
    else if (a.t === 'q') ray(ORTH.concat(DIAG));
    else if (a.t === 'p') { // a black pawn goes north, and strikes on the two squares in front of it
      var q = at(r - 1, f);
      if (q >= 0 && !occupied(F, q) && !(moat && crossesMoat(a.sq, q))) mv.push(q);
      [[-1, -1], [-1, 1]].forEach(function (d) { var q2 = at(r + d[0], f + d[1]); if (q2 >= 0 && pieceAt(F, q2)) hit.push(q2); });
    }
    return { moves: mv, hits: hit };
  }
  function allyTurn(run, F, ev, rnd) {
    (F.allies || []).slice().forEach(function (a) {
      if (F.over || F.allies.indexOf(a) < 0 || --a.tm > 0) return;
      a.tm = a.spd;
      var re = allyReach(run, F, a);
      if (re.hits.length) {
        var tg = re.hits.map(function (q) { return pieceAt(F, q); }).sort(function (x, y) { return (y.leader - x.leader) || (x.hp - y.hp) || (x.sq - y.sq); })[0];
        ev.push({ e: 'strike', id: a.id, from: a.sq, to: tg.sq });
        if (hurt(run, F, tg, ALLY_DMG[a.t] || 2, ev, 'ally') && !F.over && !occupied(F, tg.sq)) { ev.push({ e: 'move', id: a.id, from: a.sq, to: tg.sq, ally: true }); a.sq = tg.sq; }
        return;
      }
      if (!re.moves.length || !F.pieces.length) return;
      var best = -1, bestV = -1e9, save = a.sq;
      re.moves.forEach(function (q) {
        var near = Math.min.apply(null, F.pieces.map(function (x) { return cheb(x.sq, q); }));
        a.sq = q;
        var v = -3 * near + (allyReach(run, F, a).hits.length ? 8 : 0) - (attackedBy(run, F, q).length ? 6 : 0) + rnd() * 2;
        a.sq = save;
        if (v > bestV) { bestV = v; best = q; }
      });
      ev.push({ e: 'move', id: a.id, from: a.sq, to: best, ally: true });
      a.sq = best;
      if (a.t === 'p' && row(best) === 0) { a.t = 'q'; a.spd = BASE_SPD.q; ev.push({ e: 'promote', id: a.id, t: 'q', sq: best, ally: true }); }
    });
    settle(run, F, ev);
  }

  // the White army's part of a turn that act(.., { split: true }) left open
  function finish(run) {
    var F = run.F;
    if (!F || !F.pend) return [];
    F.pend = 0;
    return whiteTurn(run, F, [], rngOf(F));
  }

  /* ---------- the White army's turn ---------- */
  function whiteTurn(run, F, ev, rnd) {
    // the end of the king's turn: a piece that attacks him takes him, whoever's move it is (his hologram or his steed
    // may take the blow first; a piece that took one does not strike again this turn)
    var acted = [], att = attackedBy(run, F, F.king);
    for (var g = 0; g < 16 && att.length; g++) {
      if (!spare(run, F, att[0], ev)) return death(run, F, att[0], ev);
      acted.push(att[0]);
      att = attackedBy(run, F, F.king).filter(function (x) { return acted.indexOf(x) < 0; });
    }
    F.turn++; run.turns++; F.moved = false; F.bushido = false; F.jumps = 0; F.jumped = {};
    if (F.paralysis > 0) F.paralysis--;
    // Black Plague, the Workshop, then the pieces that arrive on the clock
    if (has(run, 'plague') && F.pieces.length) { hurt(run, F, pick(F.pieces, rnd), 1, ev, 'plague'); settle(run, F, ev); } // Flesh Wall keeps a pawn up during the king's action only
    if (F.over === 'won') return floorDone(run, ev);
    var st = stats(run, F);
    if (has(run, 'workshop') && F.turn % 8 === 0) { F.grenades += rule(run, F, 'workshop'); F.gun[1] = Math.min(st.res, F.gun[1] + 2 * rule(run, F, 'workshop')); ev.push({ e: 'workshop' }); }
    arrivals(run, F, ev, rnd);
    // the king's allies take their moves before the army
    allyTurn(run, F, ev, rnd);
    if (F.over === 'won') return floorDone(run, ev);
    // the speeds that grow over the floor (Golden Aging: leader and queens slower every 10 turns)
    for (var cid in run.cards) {
      var c = CARD[cid];
      if (!c || !works(run, F, cid)) continue;
      c.fx.forEach(function (e) { if (e.spd && e.every && F.turn % e.every === 0) F.pieces.forEach(function (p) { if (e.spd === p.t || e.spd === 'all' || (e.spd === 'leader' && p.leader)) p.spd = Math.max(1, p.spd + e.v * run.cards[cid]); }); });
    }
    if (F.turn === 15 && F.pieces.some(function (p) { return p.t === 'b'; })) flipOn(run, F, 'bishopAt15', ev);
    // Final Countdown: once 6 pieces are left, 12 turns to finish the floor
    if (has(run, 'countdown')) {
      if (F.countdown == null && F.pieces.length <= 6) { F.countdown = 12; ev.push({ e: 'countdown', n: 12 }); }
      else if (F.countdown != null && --F.countdown <= 0) { F.over = 'dead'; F.killer = -3; ev.push({ e: 'dead', by: -3, cause: 'countdown' }); run.phase = 'lost'; return ev; }
    }
    var rk = rankArmy(run.rank, run.floor), strat = rk.strategy;
    // timers count down; the pieces at zero act, the ones furthest forward first. Bleeding pieces under Caltrops are slower.
    var slow = rule(run, F, 'caltropsSlow') > 0;
    var movers = F.pieces.filter(function (p) { if (slow && p.bleed && F.turn % 2 === 0) return false; p.tm--; return p.tm <= 0; }).sort(function (a, b) { return row(b.sq) - row(a.sq); });
    // Selective Listening: no more than two kinds of piece move in one turn
    if (has(run, 'selective')) {
      var kinds = [];
      movers = movers.filter(function (p) { if (kinds.indexOf(p.t) < 0) { if (kinds.length >= 2) { p.tm = 1; return false; } kinds.push(p.t); } return true; });
    }
    for (var i = 0; i < movers.length; i++) {
      var p = movers[i];
      if (F.pieces.indexOf(p) < 0) continue;
      p.tm = p.spd;
      if (jailed(run, F, p) || acted.indexOf(p) >= 0) continue; // a piece that took the hologram or the steed has had its move
      if (!p.scared && reach(run, F, p, false).indexOf(F.king) >= 0 && !kingSafe(run, F, p, true)) {
        if (p.t === 'r' && has(run, 'lady')) { p.t = 'q'; p.spd = BASE_SPD.q; ev.push({ e: 'promote', id: p.id, t: 'q' }); continue; } // Lady in the Tower
        if (spare(run, F, p, ev)) continue;
        return death(run, F, p, ev);
      }
      // Divine Healing: a bishop next to a hurt ally heals it instead of moving
      if (p.t === 'b' && has(run, 'heal')) {
        var sick = F.pieces.filter(function (x) { return x !== p && x.hp < x.max && cheb(x.sq, p.sq) === 1; })[0];
        if (sick) { sick.hp = Math.min(sick.max, sick.hp + 1); ev.push({ e: 'heal', id: sick.id, sq: sick.sq, hp: sick.hp }); continue; }
      }
      // Vampirism: leaders and queens drink from bleeding pieces next to them
      if ((p.leader || p.t === 'q') && has(run, 'vampire')) {
        F.pieces.forEach(function (x) { if (x !== p && x.bleed && cheb(x.sq, p.sq) === 1) { x.bleed = 0; p.hp = Math.min(p.max, p.hp + 1); ev.push({ e: 'heal', id: p.id, sq: p.sq, hp: p.hp }); } });
      }
      // Gatehouse: a rook may raise a knight next to it instead of moving
      if (p.t === 'r' && has(run, 'gatehouse') && F.pieces.filter(function (x) { return x.t === 'n'; }).length < 4 && rnd() < 0.35) {
        var spots = KG.map(function (d) { return at(row(p.sq) + d[0], col(p.sq) + d[1]); }).filter(function (q) { return q >= 0 && !occupied(F, q); });
        if (spots.length) { var kp = makePiece(run, F, 'n', pick(spots, rnd), rnd, { tm: BASE_SPD.n }); F.pieces.push(kp); ev.push({ e: 'arrive', id: kp.id, t: 'n', sq: kp.sq, by: p.id }); continue; }
      }
      // the Boss Pawn calls a pawn to its side every third action
      if (p.t === 'P') { p.acts = (p.acts || 0) + 1; if (p.acts % 3 === 0 && F.pieces.filter(function (x) { return x.t === 'p'; }).length < 8) { summon(run, F, p, ev, rnd); continue; } }
      // the piece under the Seer's Orb moves with the orb's luck; bound by Mystic Shackles, it goes where the orb said
      var orbed = F.orb === p.id, to;
      if (orbed && p.shk && p.lock != null) to = p.lock >= 0 && reach(run, F, p, true).concat(prey(run, F, p)).indexOf(p.lock) >= 0 ? p.lock : -1;
      else to = choose(run, F, p, strat, orbed ? orbRnd(F, p, F.turn) : rnd);
      p.scared = 0; // a frightened piece flees once, then it is itself again
      if (to < 0) continue;
      var ally = allyAt(F, to), holo = F.holo != null && F.holo >= 0 && to === F.holo;
      ev.push({ e: 'move', id: p.id, from: p.sq, to: to });
      p.sq = to; p.first = false;
      // a black ally or the hologram on that square is taken
      if (ally) { F.allies.splice(F.allies.indexOf(ally), 1); ev.push({ e: 'allydead', id: ally.id, t: ally.t, sq: to }); }
      if (holo) holoDown(run, F, p, ev);
      // Caltrops: a moving enemy may start to bleed
      if (has(run, 'caltrops') && !p.bleed && rnd() < 0.15 * rule(run, F, 'caltrops')) { p.bleed = 1; ev.push({ e: 'bleed', id: p.id, sq: p.sq }); }
      if ((p.t === 'p' || p.t === 'P') && row(to) === H - 1) promote(run, F, p, ev, rnd, strat);
      else if (p.t === 'n' && row(to) === H - 1 && has(run, 'nomad')) promote(run, F, p, ev, rnd, strat);
    }
    if (F.over === 'won') return floorDone(run, ev);
    // the stealth runs out at the end of the army's turn; the orb under Mystic Shackles reads the next move
    if (F.stealth > 0 && !--F.stealth) ev.push({ e: 'stealth', n: 0 });
    var op = F.orb != null && F.orb >= 0 ? F.pieces.find(function (x) { return x.id === F.orb; }) : null;
    if (op && op.shk) { delete op.lock; op.lock = predict(run, F, op); }
    return ev;
  }
  // the pieces that come on the clock: A(kind, v, { after }) once, A(kind, v, { every }) again and again
  function arrivals(run, F, ev, rnd) {
    var early = rule(run, F, 'lookout') * (F.kills || 0); // Lookout Tower: the backups come earlier for every kill
    for (var cid in run.cards) {
      var c = CARD[cid];
      if (!c || !works(run, F, cid)) continue;
      c.fx.forEach(function (e) {
        if (!e.a || (!e.after && !e.every)) return;
        var n = e.v * run.cards[cid], due = false;
        if (e.after) { var when = Math.max(1, e.after - early); F.arrived = F.arrived || {}; var key = cid + ':' + e.a + ':' + e.after; if (F.turn >= when && !F.arrived[key]) { F.arrived[key] = 1; due = true; } }
        else due = F.turn % e.every === 0;
        if (!due || n <= 0) return;
        for (var i = 0; i < n; i++) arrive(run, F, e.a, ev, rnd, cid);
        if (e.a !== 'p' && has(run, 'onboarding')) unflip(run, F, 'welcome', ev); // Onboarding Party
      });
    }
  }
  function unflip(run, F, cid, ev) { if (F.flipped && F.flipped[cid]) { delete F.flipped[cid]; ev.push({ e: 'unflip', card: cid }); } }
  function death(run, F, p, ev) {
    // Black Mist: once a floor (per card) death passes the king by; the piece is thrown back to its start of turn
    if (F.mist > 0) { F.mist--; p.tm = p.spd; ev.push({ e: 'mist', id: p.id, sq: p.sq }); return ev; }
    ev.push({ e: 'move', id: p.id, from: p.sq, to: F.king, kill: true });
    p.sq = F.king;
    F.over = 'dead'; F.killer = p.id;
    ev.push({ e: 'dead', by: p.id });
    run.phase = 'lost';
    return ev;
  }
  function promote(run, F, p, ev, rnd, strat) {
    if (p.t === 'P') {
      // the Boss Pawn crowns itself: it moves like a queen from now on, with the hit points it has left
      p.t = 'q'; p.boss = true; ev.push({ e: 'promote', id: p.id, t: 'q', boss: true });
      return;
    }
    var t = strat >= 2 || has(run, 'governess') ? 'q' : pick(['n', 'b', 'r', 'q'].filter(function (x) { return x !== p.t; }), rnd);
    var hp = hpFor(run, t, p.leader);
    p.hp = Math.max(1, Math.min(p.hp + hp - p.max, hp)); p.max = hp; p.t = t; p.spd = spdFor(run, t, p.leader); p.tm = Math.min(p.tm, p.spd);
    ev.push({ e: 'promote', id: p.id, t: t });
    if (p.spy && has(run, 'mole') && !p.leader) convert(run, F, p, ev); // The Mole: a spy turns black when it promotes
    flipOn(run, F, 'promote', ev);
    if (has(run, 'onboarding')) unflip(run, F, 'welcome', ev);
  }
  function arrive(run, F, t, ev, rnd, src) {
    var free = [];
    for (var q = 0; q < 2 * W; q++) if (!occupied(F, q)) free.push(q);
    if (!free.length) return;
    var p = makePiece(run, F, t, pick(free, rnd), rnd, { tm: spdFor(run, t, false), src: src });
    F.pieces.push(p);
    ev.push({ e: 'arrive', id: p.id, t: t, sq: p.sq });
  }
  function summon(run, F, boss, ev, rnd) {
    var free = KG.map(function (d) { return at(row(boss.sq) + d[0], col(boss.sq) + d[1]); }).filter(function (q) { return q >= 0 && !occupied(F, q) && row(q) < H - 1; });
    if (!free.length) return;
    var p = makePiece(run, F, 'p', pick(free, rnd), rnd, { tm: BASE_SPD.p });
    F.pieces.push(p);
    ev.push({ e: 'arrive', id: p.id, t: 'p', sq: p.sq, by: boss.id });
  }
  /* Where a white piece goes. It wants to give check (the king then has to deal with it at once), to take the
     king's flight squares, and to get closer; the leader keeps its distance, a frightened piece runs. From rank 4
     on the army also stays out of the gun's reach where it can, from rank 10 more carefully; on the lowest ranks
     it is more random. */
  function choose(run, F, p, strat, rnd) {
    var food = prey(run, F, p), to = reach(run, F, p, true).concat(food);
    if (!to.length) return -1;
    // the squares the king could flee to, and his flagstones (the army keeps them covered)
    var st = stats(run, F), kq = F.king, flight = KG.map(function (d) { return at(row(kq) + d[0], col(kq) + d[1]); }).concat(F.stones || []).filter(function (q) { return q >= 0 && !occupied(F, q); });
    var best = -1, bestV = -1e9, save = p.sq, scared = p.scared;
    p.scared = 0;
    for (var i = 0; i < to.length; i++) {
      var q = to[i];
      p.sq = q;
      var dist = cheb(q, kq), v = 0;
      if (food.indexOf(q) >= 0) v = q === F.holo ? 60 : 45; // a black ally or the hologram to take
      else if (scared) v = 10 * dist; // it flees
      else if (F.stealth > 0) v = 0; // the king is not seen: the army wanders
      else {
        var hits = reach(run, F, p, false);
        // ranks 1 to 3 (the lowest strategy level of the original): the army hunts less precisely
        if (hits.indexOf(kq) >= 0) v += strat >= 1 ? 70 : 25;
        for (var j = 0; j < flight.length; j++) if (hits.indexOf(flight[j]) >= 0) v += strat >= 1 ? 9 : 4;
        if (p.leader) v += 3 * Math.min(dist, 6); else v -= 2.5 * dist;
        if (strat >= 1) {
          var dx = col(q) - col(kq), dy = row(q) - row(kq), e = Math.sqrt(dx * dx + dy * dy);
          if (e <= st.rmax && hits.indexOf(kq) < 0) v -= (strat >= 2 ? 9 : 5) * (e <= st.rmin ? 2 : 1) * (p.hp <= st.fp ? 1.5 : 1);
        }
      }
      v += rnd() * (strat >= 2 ? 3 : strat >= 1 ? 6 : 24);
      if (v > bestV) { bestV = v; best = q; }
    }
    p.sq = save; p.scared = scared;
    return best;
  }
  // what a white piece may take on its move besides the king: a black ally or the hologram (not next to the king under
  // August Presence)
  function prey(run, F, p) {
    if (p.scared || (!(F.allies || []).length && !(F.holo >= 0))) return [];
    var aug = has(run, 'august') && p.t !== 'k' && p.t !== 'K';
    return reach(run, F, p, false).filter(function (q) { return (allyAt(F, q) || (F.holo >= 0 && q === F.holo)) && !(aug && cheb(q, F.king) <= 1); });
  }

  /* ---------- floors and cards ---------- */
  function floorDone(run, ev) {
    if (run.floor >= FLOORS) { run.phase = 'won'; ev.push({ e: 'won' }); return ev; }
    if (run.floor <= CARD_FLOORS) { run.phase = 'cards'; run.offer = offer(run); run.searchLeft = stats(run, null).search; }
    else nextFloor(run);
    return ev;
  }
  function nextFloor(run) {
    run.floor++; run.phase = 'play'; run.offer = null;
    run.F = newFloor(run);
  }
  // may the run be offered card c now? Not at its maximum, its needs met (cards or tags), and an army it can take from
  function offerable(run, c, tags) {
    if (c.later || (run.cards[c.id] || 0) >= c.max) return false;
    var own = function (n) { return CARD[n] ? (run.cards[n] || 0) > 0 : !!tags[n]; };
    if (c.needs && !c.needs.every(own)) return false;
    if (c.any && !c.any.some(own)) return false;
    if (c.notTags && c.notTags.some(function (n) { return !!tags[n]; })) return false;
    if (c.blockedBy && c.blockedBy.some(function (n) { return (run.cards[n] || 0) > 0; })) return false;
    if (c.floorMax && run.floor > c.floorMax) return false;
    if (c.pawns && armyCount(run, 'p', run.floor + 1) < c.pawns) return false;
    for (var i = 0; i < c.fx.length; i++) {
      var e = c.fx[i];
      if (!e.a || e.v >= 0 || e.after || e.every || e.a === 'k') continue;
      // removing a kind: the army of the next floor must have one left
      if (armyCount(run, e.a, run.floor + 1) + e.v < 0) return false;
    }
    return true;
  }
  // the pieces of kind t the army starts floor `floor` with: the rank's, and what the run's cards add and take
  function armyCount(run, t, floor) {
    var n = rankArmy(run.rank, floor).count[t] || 0;
    for (var id in run.cards) { var cc = CARD[id]; if (cc) cc.fx.forEach(function (x) { if (x.a === t && !x.after && !x.every) n += x.v * run.cards[id]; }); }
    return n;
  }
  // two pairs, each a black card and a white card the run can still take
  function offer(run) {
    var rnd = R.mulberry((run.seed + run.floor * 104729 + (run.rerolls || 0) * 31) >>> 0), tags = tagsOf(run);
    var ok = function (c) { return offerable(run, c, tags); };
    var blacks = BLACK.filter(ok), whites = WHITE.filter(ok), out = [];
    var draw = function (list) { if (!list.length) return null; var i = Math.floor(rnd() * list.length); return list.splice(i, 1)[0].id; };
    for (var i = 0; i < 2; i++) out.push([draw(blacks), draw(whites)]);
    return out;
  }
  function choosePair(run, i) {
    if (run.phase !== 'cards' || !run.offer || !run.offer[i]) return false;
    var browsed = run.patience > 0;
    run.offer[i].forEach(function (id) { if (id) run.cards[id] = (run.cards[id] || 0) + 1; });
    // Patience: this pick was the free choice it gave; taken now, it gives one for the next pick
    if (browsed) run.patience--;
    if (run.offer[i][0] === 'patience') run.patience = (run.patience || 0) + 1;
    // Bold Plan: a white card of the run is swapped for a different one
    if (run.offer[i][0] === 'boldplan') {
      var mine = Object.keys(run.cards).filter(function (id) { return CARD[id] && CARD[id].color === 'white' && run.cards[id] > 0; });
      var rnd = R.mulberry((run.seed + run.floor * 7) >>> 0), tags = tagsOf(run);
      if (mine.length) {
        var out = mine[Math.floor(rnd() * mine.length)], ins = WHITE.filter(function (c) { return c.id !== out && offerable(run, c, tags); });
        if (ins.length) { run.cards[out]--; if (!run.cards[out]) delete run.cards[out]; var inn = ins[Math.floor(rnd() * ins.length)].id; run.cards[inn] = (run.cards[inn] || 0) + 1; run.swapped = [out, inn]; }
      }
    }
    nextFloor(run);
    return true;
  }
  // Patience: the black cards the run may pick from the whole deck, and the pick (it goes into both pairs)
  function browsable(run) { var tags = tagsOf(run); return run.patience > 0 && run.phase === 'cards' ? BLACK.filter(function (c) { return offerable(run, c, tags); }).map(function (c) { return c.id; }) : []; }
  function browse(run, id) {
    if (browsable(run).indexOf(id) < 0) return false;
    run.offer.forEach(function (pr) { pr[0] = id; });
    return true;
  }
  function search(run) {
    if (run.phase !== 'cards' || run.searchLeft <= 0) return false;
    run.searchLeft--; run.rerolls = (run.rerolls || 0) + 1;
    run.offer = offer(run);
    return true;
  }

  var api = {
    SHOTGUNS: SHOTGUNS, GUN: GUN, BLACK: BLACK, WHITE: WHITE, CARD: CARD, NAMES: NAMES, FLOORS: FLOORS, BOSS_PAWN_FLOOR: BOSS_PAWN_FLOOR, BOSS_FLOOR: BOSS_FLOOR, W: W, H: H,
    newRun: newRun, newFloor: newFloor, stats: stats, actions: actions, act: act, finish: finish, attackedBy: attackedBy, attackedFrom: attackedFrom, inCheck: inCheck, reach: reach, pieceAt: pieceAt,
    soulMoves: soulMoves, cone: cone, choosePair: choosePair, search: search, rankArmy: rankArmy, leaderKind: leaderKind, works: works, rule: rule, offerable: offerable, tagsOf: tagsOf, jailed: jailed,
    allyAt: allyAt, predict: predict, browsable: browsable, browse: browse, MOAT: MOAT
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shotgun = api;
})(typeof self !== 'undefined' ? self : this);
