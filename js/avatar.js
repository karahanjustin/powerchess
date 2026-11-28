/* Profile pictures (avatars). An avatar is one chess piece of either colour, with up to two of the power-up looks the
   board gives a piece (the sniper's vine, the ghost's glow, the gold of a statue and so on), on a background and in a
   frame. A config is { p: 'K'|'Q'|'R'|'B'|'N'|'P', c: 'w'|'b', fx: [up to 2 effect ids], bg: id, fr: id }.
   The pictures are the board's own: the classic piece set from pieces/ (always that one, so an avatar looks the same
   for everybody whatever set they play with), the vine of the sniper skin (its curves were traced once from the
   board's own vine painter in app.js, buildSkins, so nothing is read from a canvas here and it works from file://),
   the gold and ice tints with the same gradients, and the board's CSS looks redrawn under the .av- prefix.
   Everything sized from one number, --av, so a picture reads from 24 px in a list up to 120 px and more.
   window.Avatar: normalize, html, random, encode, decode, editor, and the lists. Its CSS goes in once (#avatarCss). */
(function (root) {
  'use strict';

  var PIECES = ['K', 'Q', 'R', 'B', 'N', 'P'];
  var PIECE_NAMES = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' };
  var COLORS = ['w', 'b'];

  // the looks, with the group a look shares with others (one tint, one hat): a second of a group replaces the first
  var EFFECTS = [
    { id: 'vines', name: 'Sniper Vines' },
    { id: 'ghost', name: 'Ghost' },
    { id: 'gold', name: 'Midas Gold', group: 'tint' },
    { id: 'ice', name: 'Frozen', group: 'tint' },
    { id: 'shield', name: 'Shield' },
    { id: 'helmet', name: 'Spiked Helmet', group: 'head' },
    { id: 'jester', name: 'Jester Hat', group: 'head' },
    { id: 'vest', name: 'Explosive Vest' },
    { id: 'shotgun', name: 'Shotgun' },
    { id: 'portal', name: 'Portal' },
    { id: 'blast', name: 'Explosion' },
    { id: 'aura', name: 'Golden Aura' }
  ];

  var BACKGROUNDS = [
    { id: 'green', name: 'Board Green', css: '#739552' },
    { id: 'moss', name: 'Moss', css: '#45753c' },
    { id: 'slate', name: 'Slate', css: '#3c3a38' },
    { id: 'cream', name: 'Cream', css: '#ebecd0' },
    { id: 'walnut', name: 'Walnut', css: '#b88762' },
    { id: 'ocean', name: 'Ocean', css: '#4b7399' },
    { id: 'lilac', name: 'Lilac', css: '#8476ba' },
    { id: 'forest', name: 'Forest', css: 'linear-gradient(160deg,#a3d160 0%,#5d8f3f 55%,#2f5a2a 100%)' },
    { id: 'sunset', name: 'Sunset', css: 'linear-gradient(150deg,#ffd34d 0%,#f0b400 35%,#fa412d 100%)' },
    { id: 'midnight', name: 'Midnight', css: 'radial-gradient(circle at 50% 32%,#4a5f86 0%,#26324a 55%,#121722 100%)' },
    { id: 'board', name: 'Green Board', css: 'repeating-conic-gradient(#ebecd0 0 25%,#739552 0 50%) 0 0/50% 50%' },
    { id: 'wood', name: 'Wood Board', css: 'repeating-conic-gradient(#edd6b0 0 25%,#b88762 0 50%) 0 0/50% 50%' }
  ];

  // round: the frame makes the picture a circle, the others are rounded squares
  var FRAMES = [
    { id: 'none', name: 'None' },
    { id: 'thin', name: 'Thin' },
    { id: 'green', name: 'Green' },
    { id: 'gold', name: 'Gold' },
    { id: 'double', name: 'Double' },
    { id: 'oak', name: 'Oak' },
    { id: 'glow', name: 'Glow' },
    { id: 'circle', name: 'Circle', round: true },
    { id: 'gcircle', name: 'Gold Circle', round: true },
    { id: 'icering', name: 'Ice Ring', round: true }
  ];

  var byId = function (list) { var o = {}; list.forEach(function (x) { o[x.id] = x; }); return o; };
  var FX = byId(EFFECTS), BG = byId(BACKGROUNDS), FR = byId(FRAMES);
  var DEFAULT = { p: 'N', c: 'w', fx: [], bg: BACKGROUNDS[0].id, fr: FRAMES[0].id };

  /* The sniper's vine per piece type, in the 192 x 192 box the board paints its skins in: two slanted turns
     (cubic curves x0 y0 c1x c1y c2x c2y x1 y1), each with three leaves (x, y, angle in degrees, length).
     Traced from buildSkins() in app.js on the classic set, with the same seeds; white and black share the outline. */
  var VINES = {
    P: { c: [[41.3, 143.8, 70.9, 156.8, 104.1, 111.6, 133.7, 116.6], [60, 98.9, 81.8, 111.9, 106.2, 69.4, 128, 74.4]], l: [[43.1, 144.5, 168.3, 22.1], [87.5, 133.2, 32.4, 19.5], [131.9, 116.4, 37.3, 21.6], [61.3, 99.6, 237.8, 21.4], [94, 89.7, -94, 18.8], [126.7, 74.2, -23.3, 20.8]] },
    N: { c: [[63.2, 140.4, 96.7, 153.4, 134.3, 106.8, 167.8, 111.8], [22.5, 93.2, 64.1, 106.2, 110.9, 62.5, 152.5, 67.5]], l: [[65.2, 141.1, 166.1, 21.2], [115.5, 129.1, 38.3, 20.2], [165.8, 111.6, 36.6, 19.9], [25, 93.9, 226, 18.2], [87.5, 83.3, -86.5, 22.6], [150, 67.2, -27.3, 19.7]] },
    B: { c: [[55.2, 138.4, 79.7, 151.4, 107.3, 103.8, 131.8, 108.8], [47.9, 89.6, 75.8, 102.6, 107.2, 57.9, 135.1, 62.9]], l: [[56.7, 139.1, 171.8, 20.2], [93.5, 126.6, 33.6, 21], [130.3, 108.6, 38.3, 18.2], [49.6, 90.3, 232.5, 20], [91.5, 79.2, -85.7, 21.5], [133.4, 62.7, -25.3, 18.6]] },
    R: { c: [[42.2, 142.2, 73.7, 155.2, 109.3, 110.4, 140.8, 115.4], [48.4, 98, 78.5, 111, 112.5, 68.9, 142.6, 73.9]], l: [[44.1, 142.9, 167.2, 19.3], [91.5, 131.8, 28.7, 21.7], [138.9, 115.2, 37, 21.5], [50.2, 98.7, 231.2, 21.8], [95.5, 88.9, -88.9, 20.3], [140.8, 73.6, -25.6, 22.5]] },
    Q: { c: [[42.1, 140, 80.4, 153, 123.6, 105, 161.9, 110], [26.9, 90.5, 72.4, 103.5, 123.6, 58.5, 169.1, 63.5]], l: [[44.4, 140.7, 163.9, 18.3], [102, 128, 35.1, 22.4], [159.6, 109.8, 35.9, 19.8], [29.6, 91.2, 224.7, 18.6], [98, 80, -88.9, 19.2], [166.4, 63.3, -27.7, 21.4]] },
    K: { c: [[39.1, 142, 80.3, 155, 126.7, 107, 167.9, 112], [15.3, 92.5, 59.6, 105.5, 109.4, 60.5, 153.7, 65.5]], l: [[41.6, 142.7, 162.8, 22.4], [103.5, 130, 40.6, 18.2], [165.4, 111.8, 35.6, 18.1], [18, 93.2, 225.1, 20.4], [84.5, 82, -79.1, 18], [151, 65.3, -27.6, 20.3]] }
  };
  // the statue and ice gradients of the board (app.js TINTS), the white drawing multiplied with them
  var TINTS = {
    gold: { w: [[0, '#fff6c4'], [0.35, '#ffdc55'], [0.68, '#f3b300'], [1, '#cf8e00']], b: [[0, '#e0b347'], [0.38, '#b8861a'], [0.72, '#8c5e06'], [1, '#5c3c00']] },
    ice: { w: [[0, '#f4fcff'], [0.3, '#b8e8ff'], [0.65, '#6cc4f4'], [1, '#2f8fd6']], b: [[0, '#8cc4ee'], [0.35, '#4a8fd0'], [0.7, '#2364a8'], [1, '#0f3a70']] }
  };

  // where the app lives: the folder above js/avatar.js, so the pictures load from any page (a test page too)
  var ROOT = '';
  try {
    var src = root.document && root.document.currentScript && root.document.currentScript.src;
    if (src && /js\/avatar\.js(\?.*)?$/.test(src)) ROOT = src.replace(/js\/avatar\.js(\?.*)?$/, '');
  } catch (e) { /* relative paths then */ }
  var attr = function (s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var pic = function (path) { return attr(ROOT + path); };

  // ---- config ----

  function has(list, v) { return typeof v === 'string' && list.indexOf(v) >= 0; }

  function normalize(cfg) {
    var out = { p: DEFAULT.p, c: DEFAULT.c, fx: [], bg: DEFAULT.bg, fr: DEFAULT.fr };
    try {
      if (typeof cfg === 'string') return decode(cfg);
      if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return out;
      var p = cfg.p, c = cfg.c, fx = cfg.fx, bg = cfg.bg, fr = cfg.fr;
      if (typeof p === 'string' && p.length === 1 && has(PIECES, p.toUpperCase())) out.p = p.toUpperCase();
      if (typeof c === 'string' && has(COLORS, c.toLowerCase())) out.c = c.toLowerCase();
      if (typeof bg === 'string' && BG.hasOwnProperty(bg)) out.bg = bg;
      if (typeof fr === 'string' && FR.hasOwnProperty(fr)) out.fr = fr;
      if (Array.isArray(fx)) {
        var n = Math.min(fx.length >>> 0, 16), groups = {};
        for (var i = 0; i < n && out.fx.length < 2; i++) {
          var id = fx[i];
          if (typeof id !== 'string' || !FX.hasOwnProperty(id) || out.fx.indexOf(id) >= 0) continue;
          var g = FX[id].group;
          if (g && groups[g]) continue; // one of a group: the first one stays
          if (g) groups[g] = true;
          out.fx.push(id);
        }
      }
    } catch (e) { return { p: DEFAULT.p, c: DEFAULT.c, fx: [], bg: DEFAULT.bg, fr: DEFAULT.fr }; }
    return out;
  }

  /* Stored form: "Nw.green.none" and the effects after more dots, "Qb.midnight.gcircle.vines.gold".
     Ids only, at most 39 characters (the longest possible is 34), letters, digits and dots. */
  function encode(cfg) {
    var n = normalize(cfg);
    return [n.p + n.c, n.bg, n.fr].concat(n.fx).join('.');
  }

  function decode(str) {
    try {
      if (typeof str !== 'string' || !str || str.length > 80) return normalize(null);
      var parts = str.split('.', 6), head = parts[0] || '';
      return normalize({ p: head.charAt(0), c: head.charAt(1), bg: parts[1], fr: parts[2], fx: parts.slice(3, 5) });
    } catch (e) { return normalize(null); }
  }

  // a small string hash (FNV-1a), the same picture for the same name everywhere
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  /* A pleasant picture for somebody who never chose one: any piece, a calm background, a light frame, and every other
     name gets one look. A black piece never stands on a dark background. */
  function random(seed) {
    var s;
    try { s = typeof seed === 'string' ? seed : seed == null ? '' : String(seed); } catch (e) { s = ''; }
    s = s.slice(0, 200);
    var h = hash(s), r = function (n) { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return h % n; };
    var p = PIECES[r(6)], c = r(2) ? 'b' : 'w';
    var bgs = c === 'b' ? ['green', 'cream', 'walnut', 'ocean', 'lilac', 'forest', 'sunset', 'board', 'wood'] : ['green', 'moss', 'slate', 'walnut', 'ocean', 'lilac', 'forest', 'sunset', 'midnight', 'board', 'wood'];
    var frs = ['none', 'thin', 'green', 'circle', 'gold', 'thin'];
    var looks = ['vines', 'ghost', 'gold', 'ice', 'shield', 'helmet', 'aura', 'portal'];
    var fx = r(2) ? [looks[r(looks.length)]] : [];
    return normalize({ p: p, c: c, bg: bgs[r(bgs.length)], fr: frs[r(frs.length)], fx: fx });
  }

  // ---- drawing ----

  var CSS = [
    '.av{position:relative;display:inline-block;flex:none;width:var(--av);height:var(--av);vertical-align:middle;line-height:0;border-radius:calc(var(--av) * .2);isolation:isolate;-webkit-user-select:none;user-select:none}',
    '.av.av-round{border-radius:50%}',
    '.av-in{position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none}',
    '.av-in>span,.av-in>i{position:absolute;pointer-events:none}',
    '.av-bg{inset:0;background:#739552}',
    '.av-pc{left:8%;top:9%;width:84%;height:84%}',
    '.av-svg{position:absolute;inset:0;display:block;width:100%;height:100%;overflow:visible}',
    '.av-pc>i{position:absolute;pointer-events:none;background-position:center;background-size:contain;background-repeat:no-repeat}',
    // the board's looks, see .piece.ghost / .wear / .skhat / .mark.portal / .fx .boom / .piece.skboss in power_chess.html
    '.av-ghost{opacity:.66;-webkit-mask-image:linear-gradient(to bottom,#000 52%,rgba(0,0,0,.3) 100%);mask-image:linear-gradient(to bottom,#000 52%,rgba(0,0,0,.3) 100%)}',
    ".av-helmet{left:28%;top:-5%;width:44%;height:38%;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 20'%3E%3Cdefs%3E%3ClinearGradient id='m' x1='0' x2='1'%3E%3Cstop offset='0' stop-color='%23868d95'/%3E%3Cstop offset='.45' stop-color='%23eef1f4'/%3E%3Cstop offset='1' stop-color='%23646a72'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M12 .5 13.5 7H10.5Z' fill='url%28%23m%29' stroke='%2333373d' stroke-width='.8' stroke-linejoin='round'/%3E%3Cpath d='M4 16.5C4 10.8 7.4 6.8 12 6.8s8 4 8 9.7Z' fill='url%28%23m%29' stroke='%2333373d' stroke-width='.9'/%3E%3Crect x='2.6' y='15.2' width='18.8' height='3.4' rx='1' fill='url%28%23m%29' stroke='%2333373d' stroke-width='.8'/%3E%3C/svg%3E\")}",
    ".av-vest{left:19%;bottom:7%;width:62%;height:30%;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 13'%3E%3Cg fill='%23d33b2a' stroke='%236a1409' stroke-width='.7'%3E%3Crect x='2.2' y='1.4' width='4.6' height='10.4' rx='1.4'/%3E%3Crect x='7.6' y='1.4' width='4.6' height='10.4' rx='1.4'/%3E%3Crect x='15.8' y='1.4' width='4.6' height='10.4' rx='1.4'/%3E%3Crect x='21.2' y='1.4' width='4.6' height='10.4' rx='1.4'/%3E%3C/g%3E%3Crect x='.8' y='5' width='26.4' height='3.2' rx='1' fill='%233b3f2a' stroke='%2315170e' stroke-width='.7'/%3E%3Crect x='11.2' y='3.4' width='5.6' height='6.4' rx='.8' fill='%23222' stroke='%23000' stroke-width='.7'/%3E%3Ccircle cx='14' cy='6.6' r='1.2' fill='%23ff3b30'/%3E%3C/svg%3E\")}",
    ".av-pc>.av-jester{left:24%;top:-7%;width:52%;height:36%;background-position:center bottom;background-image:url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'><g stroke='%23000' stroke-width='1.5' stroke-linejoin='round'><path fill='%23c8324f' d='M13.5 32.5C12.5 29 9.5 26.6 5.6 26 6 20 9.6 15.4 14.5 15.4 19 15.4 21.6 19.4 22 25L21 32.5z'/><path fill='%233b6fd1' d='M31.5 32.5C32.5 29 35.4 26.4 39.4 25.6 39 20.4 35.8 17 31.4 17 27.4 17 24.4 20 23.5 25l.5 7.5z'/><path fill='%23c8324f' d='M15.6 32.5C15.4 22 17 11 23 4.8c4.5-.3 8.5 1.8 10.5 5.7-3.5-1-6-.1-7 2.5 1 6.5 2 13 3 19.5z'/><path fill='%23e8c34a' d='M12 32h21c.8 0 1.3.6 1.3 1.3v3c0 .7-.5 1.2-1.3 1.2H12c-.8 0-1.3-.5-1.3-1.2v-3c0-.7.5-1.3 1.3-1.3z'/><g fill='%23e8c34a'><circle cx='5.2' cy='26.6' r='2.4'/><circle cx='39.9' cy='25.7' r='2.4'/><circle cx='33.6' cy='10.8' r='2.2'/></g></g></svg>\");filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))}",
    '.av-pc>.av-gun{inset:0;background-size:100% 100%}',
    '.av-portal{left:7%;top:7%;right:7%;bottom:7%;border-radius:50%;box-shadow:inset 0 0 0 calc(var(--av) * .055) #35a7ff,inset 0 0 calc(var(--av) * .16) calc(var(--av) * .06) rgba(53,167,255,.65)}',
    '.av-portal.av-b{box-shadow:inset 0 0 0 calc(var(--av) * .055) #ff8a1f,inset 0 0 calc(var(--av) * .16) calc(var(--av) * .06) rgba(255,138,31,.65)}',
    '.av-blast{inset:-6%;background:radial-gradient(circle,#fff6c4 0%,#ffb020 35%,#ff4a10 60%,rgba(255,60,0,0) 72%)}',
    '.av-aura{left:10%;top:12%;right:10%;bottom:8%;border-radius:50%;background:radial-gradient(circle,rgba(255,214,90,.55) 0%,rgba(255,196,64,.28) 55%,rgba(255,196,64,0) 72%)}',
    // the frames: rings drawn inside the edge, a glow may reach a little outside
    '.av-fr{position:absolute;inset:0;border-radius:inherit;pointer-events:none}',
    '.av-f-thin .av-fr,.av-f-circle .av-fr{box-shadow:inset 0 0 0 max(1px,calc(var(--av) * .035)) rgba(255,255,255,.6),inset 0 0 0 max(1.5px,calc(var(--av) * .05)) rgba(0,0,0,.18)}',
    '.av-f-green .av-fr{box-shadow:inset 0 0 0 max(1.5px,calc(var(--av) * .06)) #81b64c,inset 0 0 0 max(2px,calc(var(--av) * .075)) rgba(0,0,0,.25)}',
    '.av-f-gold .av-fr,.av-f-gcircle .av-fr{box-shadow:inset 0 0 0 max(1px,calc(var(--av) * .022)) #fff1a8,inset 0 0 0 max(1.5px,calc(var(--av) * .06)) #e0a800,inset 0 0 0 max(2px,calc(var(--av) * .075)) #7a5200,inset 0 0 calc(var(--av) * .12) calc(var(--av) * .02) rgba(255,200,40,.35)}',
    '.av-f-double .av-fr{box-shadow:inset 0 0 0 max(1px,calc(var(--av) * .03)) #f2f2ea,inset 0 0 0 max(1.5px,calc(var(--av) * .06)) #262522,inset 0 0 0 max(2px,calc(var(--av) * .085)) #f2f2ea,inset 0 0 0 max(2.5px,calc(var(--av) * .1)) rgba(0,0,0,.2)}',
    '.av-f-oak .av-fr{box-shadow:inset 0 0 0 max(1px,calc(var(--av) * .02)) #d9a86c,inset 0 0 0 max(2px,calc(var(--av) * .08)) #8b5a2b,inset 0 0 0 max(2.5px,calc(var(--av) * .095)) #4a2c12}',
    '.av-f-glow .av-fr{box-shadow:inset 0 0 0 max(1.5px,calc(var(--av) * .05)) #a3d160,inset 0 0 calc(var(--av) * .14) rgba(163,209,96,.6),0 0 calc(var(--av) * .1) rgba(129,182,76,.85)}',
    '.av-f-icering .av-fr{box-shadow:inset 0 0 0 max(1px,calc(var(--av) * .02)) #f4fcff,inset 0 0 0 max(1.5px,calc(var(--av) * .06)) #6cc4f4,inset 0 0 0 max(2px,calc(var(--av) * .075)) #1f5f9e,inset 0 0 calc(var(--av) * .14) rgba(127,214,255,.55),0 0 calc(var(--av) * .08) rgba(127,214,255,.7)}',
    // the editor
    '.ave{display:flex;flex-direction:column;gap:16px;min-width:0;max-width:100%;color:var(--text,#fff);font-size:14px}',
    '.ave *{box-sizing:border-box}',
    '.ave button{font:inherit;color:inherit;cursor:pointer;border:0;margin:0;-webkit-tap-highlight-color:transparent}',
    '.ave-top{display:flex;flex-wrap:wrap;justify-content:center;gap:14px 16px;align-items:center}',
    '.ave-prev{flex:none;padding:10px;border-radius:14px;background:var(--panel2,#21201d);box-shadow:inset 0 0 0 1px var(--line,rgba(255,255,255,.08))}',
    '.ave-side{flex:1 1 236px;min-width:0;display:flex;flex-direction:column;gap:14px}',
    '.ave-sec{display:flex;flex-direction:column;gap:8px;min-width:0}',
    '.ave-lab{display:flex;align-items:baseline;gap:8px;min-width:0;font-size:11.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--dim,rgba(255,255,255,.5))}',
    '.ave-val{font-size:12.5px;font-weight:700;letter-spacing:0;text-transform:none;color:var(--muted,rgba(255,255,255,.72));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ave-row{display:flex;flex-wrap:wrap;gap:6px}',
    '.ave-pcs{display:grid;grid-template-columns:repeat(6,minmax(40px,48px));gap:6px}',
    '.ave-b{position:relative;min-width:40px;min-height:44px;border-radius:8px;background:var(--raise,#3c3a38);transition:background .12s}',
    '.ave-b:hover{background:var(--raise-h,#4b4847)}',
    '.ave-b:focus-visible{outline:2px solid #81b64c;outline-offset:2px}',
    '.ave-b.on{background:#2c2f27;box-shadow:inset 0 0 0 2px #81b64c}',
    '.ave-pcb{width:100%;aspect-ratio:1;min-height:40px;padding:0;background-position:center;background-size:82%;background-repeat:no-repeat}',
    '.ave-seg{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
    '.ave-seg .ave-b{display:flex;align-items:center;justify-content:center;gap:8px;padding:0 12px;font-weight:700;color:var(--muted,rgba(255,255,255,.72))}',
    '.ave-seg .ave-b.on{color:#fff}',
    '.ave-seg i{display:block;width:26px;height:26px;background:center/100% no-repeat;flex:none}',
    '.ave-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(136px,1fr));gap:6px}',
    '.ave-chip{display:flex;align-items:center;gap:8px;min-width:0;padding:0 10px 0 6px;text-align:left;font-size:13px;font-weight:700;color:var(--muted,rgba(255,255,255,.72))}',
    '.ave-chip.on{color:#fff;background:#2c3a24}',
    '.ave-chip>span:last-child{flex:1;min-width:0;line-height:1.2;overflow:hidden;text-overflow:ellipsis}',
    '.ave-chip .ave-n{position:absolute;right:-5px;top:-5px;width:18px;height:18px;border-radius:50%;background:#81b64c;color:#fff;font-size:11px;font-weight:800;line-height:18px;text-align:center;display:none}',
    '.ave-chip.on .ave-n{display:block}',
    '.ave-chip.no{animation:avno .32s ease-in-out}',
    '@keyframes avno{20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}',
    '.ave-hint{min-height:1.35em;font-size:12.5px;line-height:1.35;color:var(--dim,rgba(255,255,255,.5))}',
    '.ave-hint.warn{color:#f0b400}',
    '.ave-sw{width:44px;height:44px;min-width:44px;padding:4px;display:flex;align-items:center;justify-content:center}',
    '.ave-sw .ave-swb{display:block;width:100%;height:100%;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}',
    '.ave-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}',
    '@media (prefers-reduced-motion:reduce){.ave-chip.no{animation:none}.ave-b{transition:none}}'
  ].join('\n');

  function inject() {
    try {
      var d = root.document;
      if (!d || d.getElementById('avatarCss')) return;
      var st = d.createElement('style');
      st.id = 'avatarCss';
      st.textContent = CSS;
      (d.head || d.documentElement).appendChild(st);
    } catch (e) { /* no page */ }
  }

  var uid = 0;
  var r1 = function (v) { return Math.round(v * 100) / 100; };

  // the vine of the sniper skin as SVG, drawn the way the board's canvas draws it (shadow, dark rope, green core, leaves)
  function vineSvg(p) {
    var v = VINES[p], s = '';
    if (!v) return '';
    var curve = function (c) { return 'M' + c[0] + ' ' + c[1] + 'C' + c[2] + ' ' + c[3] + ' ' + c[4] + ' ' + c[5] + ' ' + c[6] + ' ' + c[7]; };
    var leaf = function (l) {
      var n = l[3], a = r1(n * 0.45), b = r1(n * 0.42);
      return '<g transform="translate(' + l[0] + ' ' + l[1] + ') rotate(' + l[2] + ')">' +
        '<path d="M0 0Q' + a + ' ' + (-b) + ' ' + n + ' 0Q' + a + ' ' + b + ' 0 0Z" fill="#5c9e3c" stroke="#1f3c16" stroke-width="2.2" stroke-linejoin="round"/>' +
        '<path d="M' + r1(n * 0.12) + ' 0L' + r1(n * 0.82) + ' 0" stroke="#a4d66e" stroke-width="1.4"/></g>';
    };
    v.c.forEach(function (c, k) {
      s += '<path d="' + curve(c) + '" transform="translate(0 2)" stroke="rgba(0,0,0,.28)" stroke-width="8.4"/>' +
        '<path d="' + curve(c) + '" stroke="#1f3c16" stroke-width="6.4"/>' +
        '<path d="' + curve(c) + '" stroke="#4c8733" stroke-width="3.2"/>';
      s += leaf(v.l[k * 3]) + leaf(v.l[k * 3 + 1]) + leaf(v.l[k * 3 + 2]);
    });
    return '<g fill="none" stroke-linecap="round">' + s + '</g>';
  }

  /* The piece: the picture, the gold or ice tint the board gives a statue or a frozen piece (the white drawing
     multiplied with the gradient, ice with a frosty shine on top), then the vine. */
  function pieceSvg(n, has) {
    var tint = has.gold ? 'gold' : has.ice ? 'ice' : null;
    var href = pic('pieces/' + (tint ? 'w' : n.c) + n.p + '.svg');
    var s = '<svg class="av-svg" viewBox="0 0 192 192" aria-hidden="true" focusable="false">';
    if (!tint) s += '<image href="' + href + '" width="192" height="192"/>';
    else {
      var id = 'avm' + (++uid), stops = TINTS[tint][n.c];
      s += '<defs><mask id="' + id + 'm" maskUnits="userSpaceOnUse" x="0" y="0" width="192" height="192" style="mask-type:alpha"><image href="' + href + '" width="192" height="192"/></mask>' +
        '<linearGradient id="' + id + 'g" gradientUnits="userSpaceOnUse" x1="38.4" y1="0" x2="153.6" y2="192">' +
        stops.map(function (st) { return '<stop offset="' + st[0] + '" stop-color="' + st[1] + '"/>'; }).join('') + '</linearGradient>';
      var shine = tint === 'ice' ? (n.c === 'w' ? 0.55 : 0.4) : 0;
      if (shine) {
        s += '<linearGradient id="' + id + 's" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="192" y2="192">' +
          '<stop offset="0" stop-color="#fff" stop-opacity="' + shine + '"/><stop offset=".38" stop-color="#fff" stop-opacity="0"/>' +
          '<stop offset=".44" stop-color="#fff" stop-opacity="' + r1(shine * 0.9) + '"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>';
      }
      s += '</defs><g style="isolation:isolate"><image href="' + href + '" width="192" height="192"/>' +
        '<rect width="192" height="192" fill="url(#' + id + 'g)" mask="url(#' + id + 'm)" style="mix-blend-mode:multiply"/>' +
        (shine ? '<rect width="192" height="192" fill="url(#' + id + 's)" mask="url(#' + id + 'm)" style="mix-blend-mode:screen"/>' : '') + '</g>';
    }
    if (has.vines) s += vineSvg(n.p);
    return s + '</svg>';
  }

  function html(cfg, size, opts) {
    inject();
    var n = normalize(cfg);
    var z = Math.round(Number(size));
    if (!isFinite(z) || z <= 0) z = 40;
    z = Math.max(12, Math.min(512, z));
    var bare = !!(opts && opts.bare);
    var has = {};
    n.fx.forEach(function (id) { has[id] = true; });
    var fr = FR[n.fr], px = function (k) { return r1(Math.max(0.6, z * k)) + 'px'; };
    // the glows of the board, added up: shield, statue or ice by side, the boss's gold, the ghost's blue
    var f = [];
    if (has.gold) f.push(n.c === 'w' ? 'drop-shadow(0 0 ' + px(0.05) + ' rgba(255,205,0,.9))' : 'drop-shadow(0 0 ' + px(0.015) + ' #241600) drop-shadow(0 0 ' + px(0.05) + ' rgba(214,150,0,.8))');
    if (has.ice) f.push(n.c === 'w' ? 'drop-shadow(0 0 ' + px(0.06) + ' rgba(127,214,255,.95))' : 'drop-shadow(0 0 ' + px(0.015) + ' #04203a) drop-shadow(0 0 ' + px(0.06) + ' rgba(70,160,235,.85))');
    if (has.shield) f.push('drop-shadow(0 0 ' + px(0.085) + ' rgba(110,170,255,.95)) drop-shadow(0 0 ' + px(0.025) + ' rgba(150,200,255,.9))');
    if (has.aura) f.push('drop-shadow(0 0 ' + px(0.1) + ' rgba(255,190,40,.95)) drop-shadow(0 0 ' + px(0.03) + ' rgba(255,230,120,.9))');
    if (has.ghost) f.push('drop-shadow(0 0 ' + px(0.075) + ' rgba(150,232,255,.95))');
    var cls = 'av' + (bare ? ' av-bare' : ' av-f-' + n.fr + (fr.round ? ' av-round' : ''));
    var s = '<span class="' + cls + '" style="--av:' + z + 'px" aria-hidden="true"><span class="av-in">';
    if (!bare) s += '<span class="av-bg" style="background:' + BG[n.bg].css + '"></span>';
    if (has.blast) s += '<span class="av-blast"></span>';
    if (has.aura) s += '<span class="av-aura"></span>';
    if (has.portal) s += '<span class="av-portal' + (n.c === 'b' ? ' av-b' : '') + '"></span>';
    s += '<span class="av-pc' + (has.ghost ? ' av-ghost' : '') + '"' + (f.length ? ' style="filter:' + f.join(' ') + '"' : '') + '>';
    s += pieceSvg(n, has);
    if (has.vest && !has.gold) s += '<i class="av-vest"></i>'; // a statue wears no vest on the board either
    if (has.helmet) s += '<i class="av-helmet"></i>';
    if (has.jester) s += '<i class="av-jester"></i>';
    if (has.shotgun) s += '<i class="av-gun" style="background-image:url(&quot;' + pic('pieces/fairy/gun_solomon.svg') + '&quot;)"></i>';
    s += '</span></span>';
    if (!bare && n.fr !== 'none') s += '<span class="av-fr"></span>';
    return s + '</span>';
  }

  // ---- the editor ----

  var T = {
    piece: 'Piece', colour: 'Colour', effects: 'Effects', background: 'Background', frame: 'Frame',
    white: 'White', black: 'Black',
    upTo: 'Up to two', full: 'Two effects at most. Remove one first.', swapped: 'Those two do not go together, so the first one was swapped out.'
  };

  function editor(container, cfg, onChange) {
    inject();
    var d = root.document;
    if (!container || !d) return null;
    var cur = normalize(cfg), hintTimer = 0;
    var el = function (tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.appendChild(d.createTextNode(text)); return e; };
    var btn = function (cls, label) { var b = el('button', 'ave-b ' + cls); b.type = 'button'; if (label) b.setAttribute('aria-label', label); return b; };
    var section = function (title, val) {
      var sec = el('div', 'ave-sec'), lab = el('div', 'ave-lab');
      lab.appendChild(el('span', '', title));
      if (val) lab.appendChild(val);
      sec.appendChild(lab);
      return sec;
    };
    var sr = function (text) { return el('span', 'ave-sr', text); };

    container.innerHTML = '';
    var box = el('div', 'ave');
    var top = el('div', 'ave-top'), prev = el('div', 'ave-prev'), side = el('div', 'ave-side');
    top.appendChild(prev); top.appendChild(side); box.appendChild(top);

    // the piece and its colour
    var secP = section(T.piece), pcs = el('div', 'ave-pcs'), pcBtns = {};
    PIECES.forEach(function (p) {
      var b = btn('ave-pcb', PIECE_NAMES[p]);
      b.appendChild(sr(PIECE_NAMES[p]));
      b.onclick = function () { set({ p: p }); };
      pcBtns[p] = b; pcs.appendChild(b);
    });
    secP.appendChild(pcs); side.appendChild(secP);
    var secC = section(T.colour), seg = el('div', 'ave-seg'), colBtns = {};
    COLORS.forEach(function (c) {
      var b = btn('');
      b.appendChild(el('i'));
      b.appendChild(el('span', '', c === 'w' ? T.white : T.black));
      b.onclick = function () { set({ c: c }); };
      colBtns[c] = b; seg.appendChild(b);
    });
    secC.appendChild(seg); side.appendChild(secC);

    // the effects: a chip each, the number on a chosen one says which came first
    var hint = el('div', 'ave-hint', T.upTo);
    var secE = section(T.effects), chips = el('div', 'ave-chips'), fxBtns = {};
    EFFECTS.forEach(function (x) {
      var b = btn('ave-chip');
      b.appendChild(el('span', 'ave-ic'));
      b.appendChild(el('span', 'ave-n'));
      b.appendChild(el('span', '', x.name));
      b.onclick = function () { toggle(x.id, b); };
      fxBtns[x.id] = b; chips.appendChild(b);
    });
    secE.appendChild(chips); secE.appendChild(hint); box.appendChild(secE);

    // backgrounds and frames: swatches, the chosen one's name beside the title
    var bgVal = el('span', 'ave-val'), secB = section(T.background, bgVal), bgRow = el('div', 'ave-row'), bgBtns = {};
    BACKGROUNDS.forEach(function (x) {
      var b = btn('ave-sw', x.name), sw = el('span', 'ave-swb');
      b.title = x.name;
      sw.style.background = x.css;
      b.appendChild(sw);
      b.onclick = function () { set({ bg: x.id }); };
      bgBtns[x.id] = b; bgRow.appendChild(b);
    });
    secB.appendChild(bgRow); box.appendChild(secB);
    var frVal = el('span', 'ave-val'), secF = section(T.frame, frVal), frRow = el('div', 'ave-row'), frBtns = {};
    FRAMES.forEach(function (x) {
      var b = btn('ave-sw', x.name);
      b.title = x.name;
      b.onclick = function () { set({ fr: x.id }); };
      frBtns[x.id] = b; frRow.appendChild(b);
    });
    secF.appendChild(frRow); box.appendChild(secF);
    container.appendChild(box);

    function say(text, warn) {
      hint.textContent = text;
      hint.className = 'ave-hint' + (warn ? ' warn' : '');
      clearTimeout(hintTimer);
      if (warn) hintTimer = setTimeout(function () { hint.textContent = T.upTo; hint.className = 'ave-hint'; }, 3200);
    }
    function toggle(id, b) {
      var fx = cur.fx.slice(), at = fx.indexOf(id);
      if (at >= 0) { fx.splice(at, 1); set({ fx: fx }); say(T.upTo); return; }
      var g = FX[id].group, clash = g ? fx.filter(function (o) { return FX[o].group === g; })[0] : null;
      if (clash) { fx[fx.indexOf(clash)] = id; set({ fx: fx }); say(T.swapped, true); return; }
      if (fx.length >= 2) {
        // a third one is refused: the chip shakes and the line under the chips says why
        b.classList.remove('no'); void b.offsetWidth; b.classList.add('no');
        say(T.full, true);
        return;
      }
      fx.push(id); set({ fx: fx }); say(T.upTo);
    }
    function set(part) {
      var next = {}, k;
      for (k in cur) next[k] = cur[k];
      for (k in part) next[k] = part[k];
      cur = normalize(next);
      paint();
      if (typeof onChange === 'function') { try { onChange(normalize(cur)); } catch (e) { /* the caller's problem */ } }
    }
    var on = function (b, yes) { b.classList.toggle('on', !!yes); b.setAttribute('aria-pressed', yes ? 'true' : 'false'); };
    var lastBg = null, lastFr = null;
    function paint() {
      prev.innerHTML = html(cur, 112);
      PIECES.forEach(function (p) { pcBtns[p].style.backgroundImage = 'url("' + ROOT + 'pieces/' + cur.c + p + '.svg")'; on(pcBtns[p], cur.p === p); });
      COLORS.forEach(function (c) { colBtns[c].firstChild.style.backgroundImage = 'url("' + ROOT + 'pieces/' + c + cur.p + '.svg")'; on(colBtns[c], cur.c === c); });
      EFFECTS.forEach(function (x) {
        var b = fxBtns[x.id], at = cur.fx.indexOf(x.id);
        b.firstChild.innerHTML = html({ p: cur.p, c: cur.c, fx: [x.id], bg: cur.bg }, 30); // on the chosen background, without a frame
        b.childNodes[1].textContent = at >= 0 ? String(at + 1) : '';
        on(b, at >= 0);
      });
      BACKGROUNDS.forEach(function (x) { on(bgBtns[x.id], cur.bg === x.id); });
      FRAMES.forEach(function (x) { frBtns[x.id].innerHTML = html({ p: cur.p, c: cur.c, bg: cur.bg, fr: x.id }, 36); on(frBtns[x.id], cur.fr === x.id); });
      // the names as text of their own, so the translation finds them word for word
      if (lastBg !== cur.bg) { bgVal.textContent = BG[cur.bg].name; lastBg = cur.bg; }
      if (lastFr !== cur.fr) { frVal.textContent = FR[cur.fr].name; lastFr = cur.fr; }
    }
    paint();
    return {
      get: function () { return normalize(cur); },
      set: function (c) { cur = normalize(c); paint(); },
      destroy: function () { clearTimeout(hintTimer); container.innerHTML = ''; }
    };
  }

  // every English word the avatar shows, for the German table
  var TEXTS = [];
  [T.piece, T.colour, T.effects, T.background, T.frame, T.white, T.black, T.upTo, T.full, T.swapped]
    .concat(PIECES.map(function (p) { return PIECE_NAMES[p]; }), EFFECTS.map(function (x) { return x.name; }),
      BACKGROUNDS.map(function (x) { return x.name; }), FRAMES.map(function (x) { return x.name; }))
    .forEach(function (t) { if (TEXTS.indexOf(t) < 0) TEXTS.push(t); });

  var strip = function (list) { return list.map(function (x) { return { id: x.id, name: x.name }; }); };
  root.Avatar = {
    PIECES: PIECES.slice(),
    PIECE_NAMES: PIECE_NAMES,
    EFFECTS: strip(EFFECTS),
    BACKGROUNDS: strip(BACKGROUNDS),
    FRAMES: strip(FRAMES),
    DEFAULT: normalize(null),
    TEXTS: TEXTS,
    normalize: normalize,
    html: html,
    random: random,
    encode: encode,
    decode: decode,
    editor: editor,
    inject: inject
  };
  if (root.document) inject();
})(typeof window !== 'undefined' ? window : this);
