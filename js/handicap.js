/* Handicaps: blindfold, peeks, vanishing pieces, no hints, touch-move, time odds and material odds.

   A game keeps them in its spec, so an archived game replays with them:
     spec.hc   = { w: {...}, b: {...} }   per colour, missing = none (games from before have none)
     spec.odds = { w: '', b: '' }         the material a colour gives up at the start
   The fields of one colour:
     blind   '' | 'all' | 'opp' | 'own'   the pieces not drawn: all of them, the other side's, your own
     peeks   0..N, -1 unlimited           looks at the pieces while a button (or Space) is held
     fade    0 or seconds                 vanishing pieces: seen after every move, gone a few seconds later
     nohints true                         no move dots, highlights, threats, eval bar, hints or coordinates
     touch   true                         touch-move: a piece picked up has to move
     time    1 | 0.75 | 0.5 | 0.25        the share of the starting time and of the increment
   Material odds work on the starting position of standard chess only. The rest of this file has no page code,
   so it runs in node (tools/tests/handicap.js) as well as in the page (window.Handicap). */
(function (root) {
  const BLIND = ['', 'all', 'opp', 'own'];
  const PEEKS = [0, 1, 3, 5, 10, -1];
  const FADES = [0, 2, 4, 8];
  const TIMES = [1, 0.75, 0.5, 0.25];
  const ODDS = ['', 'p', 'pm', 'n', 'r', 'q', 'rr'];
  const ODDS_NAME = { p: 'f-pawn', pm: 'Pawn and move', n: 'Knight', r: 'Rook', q: 'Queen', rr: 'Both rooks' }; // as in the New Game choices
  const START_BOARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

  // one colour's handicaps with every field present and in range
  function clean(o) {
    o = o || {};
    return {
      blind: BLIND.indexOf(o.blind) >= 0 ? o.blind : '',
      peeks: PEEKS.indexOf(+o.peeks) >= 0 ? +o.peeks : 0,
      fade: FADES.indexOf(+o.fade) >= 0 ? +o.fade : 0,
      nohints: !!o.nohints,
      touch: !!o.touch,
      time: TIMES.indexOf(+o.time) >= 0 ? +o.time : 1
    };
  }
  const none = (o) => { const c = clean(o); return !c.blind && !c.fade && !c.nohints && !c.touch && c.time === 1; }; // peeks alone are nothing
  const oddsOf = (v) => (ODDS.indexOf(v) >= 0 ? v : '');

  /* The choices of the New Game tab: your own (against a bot), White's and Black's (two players), and the odds
     each way. Saved with the other setup fields. */
  function setupClean(o) {
    o = o || {};
    const od = o.odds || {};
    return { me: clean(o.me), w: clean(o.w), b: clean(o.b), odds: { bot: oddsOf(od.bot), me: oddsOf(od.me), w: oddsOf(od.w), b: oddsOf(od.b) } };
  }
  // Puts the handicaps on a spec, only what is set: a game without any keeps a spec without hc and odds.
  function attach(spec, hc, odds) {
    const H = {}, O = {};
    ['w', 'b'].forEach((c) => {
      if (hc && hc[c] && !none(hc[c])) H[c] = clean(hc[c]);
      if (odds && oddsOf(odds[c])) O[c] = odds[c];
    });
    if (Object.keys(H).length) spec.hc = H; else delete spec.hc;
    if (Object.keys(O).length) spec.odds = { w: O.w || '', b: O.b || '' }; else delete spec.odds;
    return spec;
  }
  const any = (spec) => !!spec && (!!(spec.hc && (spec.hc.w || spec.hc.b)) || !!(spec.odds && (spec.odds.w || spec.odds.b)));
  // the clock factor of colour c
  const time = (spec, c) => (spec && spec.hc && spec.hc[c] ? clean(spec.hc[c]).time : 1);
  const peeks = (spec, c) => (spec && spec.hc && spec.hc[c] ? clean(spec.hc[c]).peeks : 0);

  // the normal starting position of standard chess, White to move, all castling rights
  function isStart(fen) {
    const f = String(fen || '').split(' ');
    return f[0] === START_BOARD && (f[1] || 'w') === 'w' && (f[2] || 'KQkq') === 'KQkq';
  }
  const expand = (row) => row.replace(/\d/g, (d) => '.'.repeat(+d)).split('');
  const pack = (cells) => cells.join('').replace(/\.+/g, (m) => String(m.length));
  /* The starting position with the odds taken off: the f-pawn, the queen's knight, the queen's rook (and its castling),
     the queen, both rooks. Pawn and move: the f-pawn, and the other side moves first (White giving it: Black starts).
     Any other position comes back unchanged, which also keeps a replay from taking the piece off twice: a game
     stores the position it really started from. */
  function oddsFen(fen, odds) {
    if (!odds || (!oddsOf(odds.w) && !oddsOf(odds.b)) || !isStart(fen)) return fen;
    const f = String(fen).split(' ');
    while (f.length < 6) f.push(['w', 'KQkq', '-', '0', '1'][f.length - 1]);
    const rows = f[0].split('/').map(expand);
    let cast = f[2], turn = 'w';
    ['w', 'b'].forEach((c) => {
      const o = oddsOf(odds[c]);
      if (!o) return;
      const back = c === 'w' ? 7 : 0, pawns = c === 'w' ? 6 : 1, K = c === 'w' ? 'K' : 'k', Q = c === 'w' ? 'Q' : 'q';
      const off = (r, x) => { rows[r][x] = '.'; };
      if (o === 'p' || o === 'pm') off(pawns, 5);
      if (o === 'n') off(back, 1);
      if (o === 'q') off(back, 3);
      if (o === 'r' || o === 'rr') { off(back, 0); cast = cast.replace(Q, ''); }
      if (o === 'rr') { off(back, 7); cast = cast.replace(K, ''); }
      if (o === 'pm' && c === 'w' && oddsOf(odds.b) !== 'pm') turn = 'b';
    });
    f[0] = rows.map(pack).join('/');
    f[1] = turn;
    f[2] = cast || '-';
    return f.join(' ');
  }

  // The chips of one colour's handicaps, in English (the page translates them).
  function labels(o) {
    if (!o || none(o)) return [];
    const c = clean(o), out = [];
    if (c.blind) out.push(c.blind === 'all' ? 'Blindfold' : c.blind === 'opp' ? 'Blindfold: opponent' : 'Blindfold: own pieces');
    if (c.fade) out.push('Vanishing pieces (' + c.fade + ' s)');
    if ((c.blind || c.fade) && c.peeks) out.push('Peeks: ' + (c.peeks < 0 ? 'unlimited' : c.peeks));
    if (c.nohints) out.push('No hints');
    if (c.touch) out.push('Touch-move');
    if (c.time !== 1) out.push('Time ' + Math.round(c.time * 100) + '%');
    return out;
  }

  const api = { BLIND, PEEKS, FADES, TIMES, ODDS, ODDS_NAME, clean, none, setupClean, attach, any, time, peeks, isStart, oddsFen, labels };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Handicap = api;
})(typeof self !== 'undefined' ? self : this);
