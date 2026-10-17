/* The Ninth Rank in 3D (three.js): the worlds of js/realm_gen.js and the rules of js/realm.js drawn from a low camera
   behind the King (or through his eyes), the pieces as turned chessmen, the moves as hops, leaps, glides and slides,
   captures as bursts of shards, the enemies' reach as red squares and lines, fires, torches, weather, the aurora,
   the frost. RealmView.open(S, hooks) fills the given element with the game and returns { close, step, ... };
   hooks: save(), exit(), nextRank(), newWorld(), snd(kind), music(mood), energy() -> 'full' | 'balanced' | 'saver',
   pieceUrl(t), touch (a phone). The game logic is never here: every turn goes through Realm.play / Realm.wait, and
   this file plays the events it gets back. */
(function (root) {
  'use strict';
  var T3 = root.THREE, Rm = root.Realm, Gn = root.RealmGen, SK = root.RealmSkills;
  var W = 96, H = 96, STEP = 0.5; // a height level in units
  var COL = { road: 0xb9a37a, arena: 0x5c5a66, dais: 0xc9a84a, promo: 0xf0c04a, bridge: 0x8a6a42, ivory: 0xf2e8d5, gold: 0xf0c050, red: 0xe0352b, green: 0x72d060, cyan: 0x4ad0ff, violet: 0x9a6cff, ice: 0xc4e4f6, iceDark: 0x9cc6e0 };

  /* ---------- the chessmen: Jarlan Perez's low-poly set (CC-BY 4.0, js/realm_models.js) and a turned king ---------- */
  var GEO = {}, PS = 1.45, PH = {}, KS = 1.36, GOLD = null, SMOOTH = {}, GRAD = null, OUTLINE = null;
  /* The look is a cartoon's: toon shading in three bands, saturated colours, a dark outline round every piece (the
     same mesh turned inside out and a touch bigger), round trees, bold edges on the squares. */
  function toon(o) { return new T3.MeshToonMaterial(Object.assign({ gradientMap: GRAD }, o || {})); }
  function lathe(pts, seg) { return new T3.LatheGeometry(pts.map(function (p) { return new T3.Vector2(p[0], p[1]); }), seg || 48); }
  function foot(R, top, neck) {
    var pts = [[0, 0], [R, 0], [R, 0.035], [R * 0.97, 0.06], [R * 0.9, 0.085], [R * 0.82, 0.1], [R * 0.76, 0.115], [R * 0.68, 0.14], [R * 0.6, 0.17]];
    var y0 = 0.17, r0 = R * 0.6;
    for (var i = 1; i <= 6; i++) { var t = i / 6, y = y0 + (top - 0.06 - y0) * t; var r = r0 + (neck - r0) * (1 - Math.pow(1 - t, 1.7)); pts.push([r, y]); }
    pts.push([neck * 1.35, top - 0.04], [neck * 1.5, top - 0.015], [neck * 1.5, top + 0.015], [neck * 1.3, top + 0.04], [neck, top + 0.06]);
    return pts;
  }
  function smoothOf(m) { if (!SMOOTH[m.uuid]) { var c = m.clone(); c.flatShading = false; c.needsUpdate = true; SMOOTH[m.uuid] = c; } return SMOOTH[m.uuid]; }
  function buildGeos() {
    var RM = root.RealmModels;
    if (!GRAD) { GRAD = new T3.DataTexture(new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]), 3, 1, T3.RGBAFormat); GRAD.minFilter = GRAD.magFilter = T3.NearestFilter; GRAD.needsUpdate = true; }
    OUTLINE = OUTLINE || new T3.MeshBasicMaterial({ color: 0x15121c, side: T3.BackSide });
    var Kg = foot(0.33, 0.54, 0.115); Kg.push([0.14, 0.6], [0.16, 0.68], [0.2, 0.76], [0.225, 0.82], [0.225, 0.85], [0.17, 0.86], [0.11, 0.88], [0.08, 0.91], [0.08, 0.93], [0, 0.95]);
    GEO.K = lathe(Kg); GEO.K.scale(KS, KS, KS); PH.K = 1.1 * KS;
    GEO.cross = new T3.BoxGeometry(0.05 * KS, 0.17 * KS, 0.05 * KS);
    GEO.crossBar = new T3.BoxGeometry(0.14 * KS, 0.05 * KS, 0.05 * KS);
    GEO.collar = new T3.TorusGeometry(0.165 * KS, 0.018 * KS, 8, 32);
    GEO.typeRing = new T3.TorusGeometry(0.4, 0.028, 6, 32);
    GEO.eliteRing = new T3.TorusGeometry(0.47, 0.02, 6, 32);
    GEO.stunRing = new T3.TorusGeometry(0.22, 0.03, 6, 5);
    ['Q', 'R', 'B', 'N', 'P'].forEach(function (t) {
      var m = RM.get(t), g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.BufferAttribute(m.pos, 3));
      g.setIndex(new T3.BufferAttribute(m.idx, 1));
      g = g.toNonIndexed(); g.computeVertexNormals(); g.scale(PS, PS, PS);
      GEO[t] = g; PH[t] = m.h * PS;
    });
    GEO.A = GEO.Q; PH.A = PH.Q;
    GEO.crown = new T3.TorusGeometry(0.34, 0.035, 8, 24);
    GEO.shard = new T3.TetrahedronGeometry(0.08);
    GEO.orb = new T3.SphereGeometry(0.11, 12, 10);
    GEO.flagPole = new T3.CylinderGeometry(0.02, 0.02, 1.2, 5);
    GEO.flag = new T3.PlaneGeometry(0.42, 0.26);
  }
  function pieceMesh(t, mat) {
    if (t === 'K') mat = smoothOf(mat);
    var g = new T3.Group(), m = new T3.Mesh(GEO[t] || GEO.P, mat);
    m.castShadow = true; m.receiveShadow = false;
    g.add(g.userData.body = m);
    var ol = new T3.Mesh(GEO[t] || GEO.P, OUTLINE); ol.scale.set(1.05, 1.03, 1.05); ol.position.y = -0.005; g.add(ol); g.userData.outline = ol;
    if (t === 'K') {
      GOLD = GOLD || toon({ color: 0xf0c050, emissive: 0x6a4410, emissiveIntensity: 0.35 });
      var c1 = new T3.Mesh(GEO.cross, mat), c2 = new T3.Mesh(GEO.crossBar, mat), band = new T3.Mesh(GEO.collar, GOLD);
      c1.position.y = 1.02 * KS; c2.position.y = 1.05 * KS; band.rotation.x = Math.PI / 2; band.position.y = 0.54 * KS;
      c1.castShadow = c2.castShadow = true;
      g.add(c1); g.add(c2); g.add(band);
    }
    g.userData.h = PH[t] || 1;
    return g;
  }

  function open(S, hooks) {
    var el = hooks.el, touch = !!hooks.touch, energy = hooks.energy || function () { return 'full'; };
    el.innerHTML = '';
    el.classList.add('realm');
    el.classList.toggle('touch', touch);
    var cv = document.createElement('canvas'); cv.className = 'realm-gl'; el.appendChild(cv);
    var hud = document.createElement('div'); hud.className = 'realm-hud' + (touch ? ' touch' : ''); el.appendChild(hud);
    buildGeos();
    var en = energy();
    var renderer = new T3.WebGLRenderer({ canvas: cv, antialias: en !== 'saver', powerPreference: en === 'full' ? 'high-performance' : 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, en === 'full' ? 2 : en === 'balanced' ? 1.5 : 1));
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = T3.SRGBColorSpace;
    renderer.toneMapping = T3.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = en === 'full';
    renderer.shadowMap.type = T3.PCFSoftShadowMap;
    var scene = new T3.Scene();
    /* Everything in the scene sits at (x, height, y) of the board. three.js looks down -z, so the scene is mirrored
       in z: north is away from a camera that looks north, and east is on its right. The camera lives outside the
       scene, in world space: its z is the board's y negated. */
    scene.scale.z = -1;
    scene.fog = new T3.Fog(0x9fb4c8, 14, 46);
    var camera = new T3.PerspectiveCamera(58, 1, 0.1, 220);
    var hemi = new T3.HemisphereLight(0xdfe8ff, 0x3a4a2a, 0.75); scene.add(hemi);
    var fill = new T3.DirectionalLight(0x9fb8ff, 0.55); scene.add(fill); scene.add(fill.target);
    var sun = new T3.DirectionalLight(0xfff1d6, 1.3); sun.castShadow = renderer.shadowMap.enabled;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -16; sun.shadow.camera.right = sun.shadow.camera.top = 16; sun.shadow.bias = -0.0008;
    scene.add(sun); scene.add(sun.target);
    var skyMat = new T3.ShaderMaterial({ side: T3.BackSide, depthWrite: false, uniforms: { top: { value: new T3.Color(0x3a6fa8) }, bot: { value: new T3.Color(0xcfdce8) }, sunDir: { value: new T3.Vector3(0, 1, 0) }, sunCol: { value: new T3.Color(0xfff0c0) }, sunAmt: { value: 1 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, bot, sunDir, sunCol; uniform float sunAmt; varying vec3 vP; void main(){ float t = clamp(vP.y * 1.6 + 0.2, 0.0, 1.0); vec3 c = mix(bot, top, t); float s = max(dot(vP, normalize(sunDir)), 0.0); c += sunCol * (pow(s, 220.0) * 1.2 + pow(s, 6.0) * 0.18) * sunAmt; gl_FragColor = vec4(c, 1.0); }' });
    var sky = new T3.Mesh(new T3.SphereGeometry(100, 24, 12), skyMat); scene.add(sky);
    var starGeo = new T3.BufferGeometry(), sp = [];
    for (var si = 0; si < 700; si++) { var a = Math.random() * Math.PI * 2, b2 = Math.acos(Math.random() * 0.9 + 0.05); sp.push(Math.sin(b2) * Math.cos(a) * 95, Math.cos(b2) * 95, Math.sin(b2) * Math.sin(a) * 95); }
    starGeo.setAttribute('position', new T3.Float32BufferAttribute(sp, 3));
    var stars = new T3.Points(starGeo, new T3.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0, sizeAttenuation: true, depthWrite: false })); scene.add(stars);

    /* ---------- textures painted on canvases ---------- */
    function canvasTex(size, draw, repeat) {
      var c = document.createElement('canvas'); c.width = c.height = size;
      draw(c.getContext('2d'), size);
      var t = new T3.CanvasTexture(c);
      t.wrapS = t.wrapT = T3.RepeatWrapping;
      if (repeat) t.repeat.set(repeat, repeat);
      if (T3.SRGBColorSpace && 'colorSpace' in t) t.colorSpace = T3.SRGBColorSpace;
      return t;
    }
    var tr = (function () { var sd = 1234567; return function () { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; }; })();
    function grain(g, size, n, dark, light, rmin, rmax) { for (var i = 0; i < n; i++) { var v = tr(); g.fillStyle = 'rgba(' + (v < 0.5 ? dark : light) + ',' + (0.04 + tr() * 0.08) + ')'; g.beginPath(); g.arc(tr() * size, tr() * size, rmin + tr() * (rmax - rmin), 0, 7); g.fill(); } }
    var TEX = {
      tile: canvasTex(128, function (g, n) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, n, n); grain(g, n, 220, '0,0,0', '255,255,255', 2, 5); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(8, 8, n - 16, n * 0.3); g.strokeStyle = 'rgba(20,14,30,0.5)'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, n - 5, n - 5); }),
      water: canvasTex(128, function (g, n) { g.fillStyle = '#5fb4e0'; g.fillRect(0, 0, n, n); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 4; g.lineCap = 'round'; for (var i = 0; i < 6; i++) { var y = 12 + i * 20, x = (i % 2) * 30; g.beginPath(); g.moveTo(x + 10, y); g.quadraticCurveTo(x + 26, y - 9, x + 42, y); g.stroke(); } }, 1),
      lava: canvasTex(128, function (g, n) { g.fillStyle = '#2a1510'; g.fillRect(0, 0, n, n); g.strokeStyle = '#ffb24a'; g.lineWidth = 2.5; for (var i = 0; i < 9; i++) { g.beginPath(); var x = tr() * n, y = tr() * n; g.moveTo(x, y); for (var k = 0; k < 6; k++) { x += (tr() - 0.5) * 40; y += (tr() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); } g.strokeStyle = 'rgba(255,230,120,0.8)'; g.lineWidth = 1; for (var j = 0; j < 9; j++) { g.beginPath(); var x2 = tr() * n, y2 = tr() * n; g.moveTo(x2, y2); for (var k2 = 0; k2 < 6; k2++) { x2 += (tr() - 0.5) * 40; y2 += (tr() - 0.5) * 40; g.lineTo(x2, y2); } g.stroke(); } }, 1),
      ice: canvasTex(128, function (g, n) { g.fillStyle = '#dff0fa'; g.fillRect(0, 0, n, n); grain(g, n, 300, '120,170,200', '255,255,255', 1, 3); g.strokeStyle = 'rgba(120,170,210,0.55)'; g.lineWidth = 1.2; for (var i = 0; i < 7; i++) { g.beginPath(); var x = tr() * n, y = tr() * n; g.moveTo(x, y); for (var k = 0; k < 4; k++) { x += (tr() - 0.5) * 50; y += (tr() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); } }, 1),
      bark: canvasTex(64, function (g, n) { g.fillStyle = '#5a4030'; g.fillRect(0, 0, n, n); for (var i = 0; i < 40; i++) { g.fillStyle = 'rgba(' + (tr() < 0.5 ? '30,18,10' : '110,80,55') + ',0.5)'; g.fillRect(tr() * n, 0, 1 + tr() * 3, n); } }),
      leaf: canvasTex(64, function (g, n) { g.fillStyle = '#3f6b3e'; g.fillRect(0, 0, n, n); grain(g, n, 300, '10,30,15', '140,190,110', 1, 3); }),
      stone: canvasTex(128, function (g, n) { g.fillStyle = '#9a968c'; g.fillRect(0, 0, n, n); grain(g, n, 500, '20,20,25', '240,240,235', 1, 3); g.strokeStyle = 'rgba(40,36,34,0.55)'; g.lineWidth = 3; for (var r = 0; r < 4; r++) { var y = r * 32; g.beginPath(); g.moveTo(0, y + 1.5); g.lineTo(n, y + 1.5); g.stroke(); for (var cx = (r % 2) * 32; cx < n; cx += 64) { g.beginPath(); g.moveTo(cx + 1.5, y); g.lineTo(cx + 1.5, y + 32); g.stroke(); } } }),
      rock: canvasTex(64, function (g, n) { g.fillStyle = '#7d7b74'; g.fillRect(0, 0, n, n); grain(g, n, 260, '20,20,22', '220,215,205', 1, 4); }),
      cloth: canvasTex(64, function (g, n) { g.fillStyle = '#9a7a56'; g.fillRect(0, 0, n, n); for (var i = 0; i < n; i += 8) { g.fillStyle = 'rgba(60,40,25,0.25)'; g.fillRect(0, i, n, 2); } grain(g, n, 150, '40,25,15', '220,200,170', 1, 3); }),
      cloud: canvasTex(256, function (g, n) { g.clearRect(0, 0, n, n); for (var i = 0; i < 40; i++) { var r = 20 + tr() * 50, x = n * 0.2 + tr() * n * 0.6, y = n * 0.3 + tr() * n * 0.4; var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }),
      sun: canvasTex(128, function (g, n) { g.clearRect(0, 0, n, n); var gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.2, 'rgba(255,240,200,0.9)'); gr.addColorStop(0.5, 'rgba(255,200,120,0.25)'); gr.addColorStop(1, 'rgba(255,180,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); })
    };
    TEX.cloud.wrapS = TEX.cloud.wrapT = T3.ClampToEdgeWrapping;
    var sunSprite = new T3.Sprite(new T3.SpriteMaterial({ map: TEX.sun, transparent: true, depthWrite: false, blending: T3.AdditiveBlending })); sunSprite.scale.set(26, 26, 1); scene.add(sunSprite);
    var rays = [];
    for (var ri0 = 0; ri0 < 3; ri0++) { var ray0 = new T3.Sprite(new T3.SpriteMaterial({ map: TEX.sun, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, opacity: 0.2, rotation: ri0 * 1.1 })); ray0.scale.set(60 + ri0 * 10, 5, 1); scene.add(ray0); rays.push(ray0); }
    var clouds = [];
    for (var ci = 0; ci < 7; ci++) { var cm = new T3.Mesh(new T3.PlaneGeometry(34 + ci * 6, 20 + ci * 3), new T3.MeshBasicMaterial({ map: TEX.cloud, transparent: true, opacity: 0.5, depthWrite: false, side: T3.DoubleSide, fog: false })); cm.rotation.x = Math.PI / 2; cm.position.set(tr() * 96, 24 + ci * 1.5, tr() * 96); cm.userData.v = 0.25 + tr() * 0.3; scene.add(cm); clouds.push(cm); }

    /* ---------- the ground ---------- */
    var w = S.world, N = W * H, KD = Rm.KIND, BIO = Gn.BIOMES;
    var M4 = new T3.Matrix4(), V3 = new T3.Vector3(), Q4 = new T3.Quaternion(), SC = new T3.Vector3(), CC = new T3.Color();
    var topY = function (x, y) { return (w.h[Rm.idx(x, y)] + 1) * STEP; };
    var biomeAt = function (x, y) { return BIO[w.regions[Rm.regionOf(x, y)].biome]; };
    var ground = new T3.InstancedMesh(new T3.BoxGeometry(1, 1, 1), toon({ map: TEX.tile }), N);
    ground.receiveShadow = true; ground.castShadow = false;
    var waterTiles = [], lavaTiles = [], treeTiles = [], snowTreeTiles = [], rockTiles = [], wallTiles = [], pillarTiles = [], iceTiles = [], tentTiles = [];
    function groundColor(x, y) {
      var i = Rm.idx(x, y), kk = w.k[i], b = biomeAt(x, y), dark = ((x + y) & 1) === 1;
      var c = dark ? b.dark : b.light;
      if (kk === KD.road) c = b.snow ? (dark ? 0xb8b0a4 : 0xd8d2c8) : b.dim ? (dark ? 0x6a6660 : 0x8a867e) : (dark ? 0xa08c62 : COL.road);
      else if (kk === KD.arena) c = dark ? 0x4a4854 : COL.arena;
      else if (kk === KD.dais) c = dark ? 0xb8963a : COL.dais;
      else if (kk === KD.promo) c = COL.promo;
      else if (kk === KD.bridge) c = b.snow ? 0x7a6a5e : COL.bridge;
      else if (kk === KD.water) c = b.dim ? 0x0f1e2a : 0x1f4e68;
      else if (kk === KD.lava) c = 0x2a1812;
      else if (kk === KD.ice) c = dark ? COL.iceDark : COL.ice;
      else if (kk === KD.shrine) c = dark ? 0x8a8ea0 : 0xc8ccd8;
      else if (kk === KD.campfire) c = 0x5a4a3c;
      else if (kk === KD.spring) c = 0x4a8a84;
      // a cartoon's colours: more saturated than the paper ones
      CC.setHex(c); var hsl = {}; CC.getHSL(hsl); CC.setHSL(hsl.h, Math.min(1, hsl.s * 1.4 + 0.04), hsl.l);
      return CC.getHex();
    }
    (function layGround() {
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var i = Rm.idx(x, y), kk = w.k[i], hh = w.h[i], top = (hh + 1) * STEP, b = biomeAt(x, y);
        if (kk === KD.water || kk === KD.lava) top = 0.3;
        else if ((kk === KD.rock && hh >= 2) || kk === KD.pillar || kk === KD.monolith) top = STEP; // the wall or pillar stands on this
        else if (kk === KD.ice) top = (hh + 1) * STEP - 0.1; // the ice slab lies on it
        M4.compose(V3.set(x + 0.5, top / 2, y + 0.5), Q4.identity(), SC.set(1, top, 1));
        ground.setMatrixAt(i, M4);
        ground.setColorAt(i, CC.setHex(groundColor(x, y)));
        if (kk === KD.water) waterTiles.push(i); else if (kk === KD.lava) lavaTiles.push(i);
        else if (kk === KD.tree) { treeTiles.push(i); if (b.snow) snowTreeTiles.push(i); } else if (kk === KD.rock) (hh >= 2 ? wallTiles : rockTiles).push(i);
        else if (kk === KD.pillar || kk === KD.monolith) pillarTiles.push(i);
        else if (kk === KD.ice) iceTiles.push(i); else if (kk === KD.tent) tentTiles.push(i);
      }
      ground.instanceMatrix.needsUpdate = true; ground.instanceColor.needsUpdate = true;
      scene.add(ground);
    })();
    function instanced(list, geo, mat, place) {
      if (!list.length) return null;
      var m = new T3.InstancedMesh(geo, mat, list.length);
      list.forEach(function (i, n) { place(i % W, Math.floor(i / W), i, M4); m.setMatrixAt(n, M4); });
      m.instanceMatrix.needsUpdate = true; m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
      return m;
    }
    var dim = w.regions.every(function (r) { return r.dim; });
    var waterMat = toon({ color: dim ? 0x2a4a60 : 0x4fa0d0, map: TEX.water, transparent: true, opacity: 0.88, emissive: 0x0a2a3a });
    var water = instanced(waterTiles, new T3.BoxGeometry(1, 0.1, 1), waterMat, function (x, y, i, m) { m.compose(V3.set(x + 0.5, 0.33, y + 0.5), Q4.identity(), SC.set(1, 1, 1)); });
    if (water) water.castShadow = false;
    var lavaMat = toon({ color: 0xffffff, map: TEX.lava, emissive: 0xffffff, emissiveMap: TEX.lava, emissiveIntensity: 1.1 });
    instanced(lavaTiles, new T3.BoxGeometry(1, 0.1, 1), lavaMat, function (x, y, i, m) { m.compose(V3.set(x + 0.5, 0.33, y + 0.5), Q4.identity(), SC.set(1, 1, 1)); });
    var Phys = T3.MeshPhysicalMaterial || T3.MeshStandardMaterial;
    var iceMat = toon({ color: 0xcfeeff, map: TEX.ice, transparent: true, opacity: 0.92, emissive: 0x204060, emissiveIntensity: 0.15 });
    var ice = instanced(iceTiles, new T3.BoxGeometry(1, 0.12, 1), iceMat, function (x, y, i, m) { m.compose(V3.set(x + 0.5, (w.h[i] + 1) * STEP - 0.04, y + 0.5), Q4.identity(), SC.set(1, 1, 1)); });
    if (ice) ice.castShadow = false;
    var treeMat = toon({ color: w.cold ? 0x3f7a62 : dim ? 0x5a7a50 : 0x5fb050 }), trunkMat = toon({ color: 0x6a4a30 });
    var seedAt = function (i, k) { var n = (i * 374761393 + k * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    var treeSize = function (i) { return 0.85 + seedAt(i, 1) * 0.4; };
    // round cartoon crowns in the warm lands, pines in the cold; each with its outline
    var treeGeo = w.cold ? new T3.ConeGeometry(0.42, 1.1, 7) : new T3.IcosahedronGeometry(0.55, 1);
    var treeAt = function (x, y, i, m, k) { var s = treeSize(i) * (k || 1); m.compose(V3.set(x + 0.5 + (seedAt(i, 2) - 0.5) * 0.3, topY(x, y) + 0.55 * treeSize(i) + 0.15, y + 0.5 + (seedAt(i, 3) - 0.5) * 0.3), Q4.setFromEuler(new T3.Euler(0, seedAt(i, 4) * 6, 0)), SC.set(s, s, s)); };
    instanced(treeTiles, treeGeo, treeMat, function (x, y, i, m) { treeAt(x, y, i, m, 1); });
    var treeOl = instanced(treeTiles, treeGeo, OUTLINE, function (x, y, i, m) { treeAt(x, y, i, m, 1.07); }); if (treeOl) treeOl.castShadow = false;
    instanced(treeTiles, new T3.CylinderGeometry(0.07, 0.09, 0.3, 6), trunkMat, function (x, y, i, m) { m.compose(V3.set(x + 0.5 + (seedAt(i, 2) - 0.5) * 0.3, topY(x, y) + 0.15, y + 0.5 + (seedAt(i, 3) - 0.5) * 0.3), Q4.identity(), SC.set(1, 1, 1)); });
    // snow on the trees of the cold lands: a white cap
    instanced(snowTreeTiles, new T3.ConeGeometry(0.3, 0.5, 7), toon({ color: 0xf4f8ff }), function (x, y, i, m) { var s = treeSize(i); m.compose(V3.set(x + 0.5 + (seedAt(i, 2) - 0.5) * 0.3, topY(x, y) + 0.55 * s + 0.15 + 0.32 * s, y + 0.5 + (seedAt(i, 3) - 0.5) * 0.3), Q4.setFromEuler(new T3.Euler(0, seedAt(i, 4) * 6, 0)), SC.set(s, s, s)); });
    var rockMat = toon({ color: w.cold ? 0xb8c8d8 : 0x8a8a98 });
    var rockGeo = new T3.DodecahedronGeometry(0.42, 0);
    var rockAt = function (x, y, i, m, k) { var s = (0.8 + seedAt(i, 5) * 0.5) * (k || 1); m.compose(V3.set(x + 0.5, topY(x, y) + 0.25 * (0.8 + seedAt(i, 5) * 0.5), y + 0.5), Q4.setFromEuler(new T3.Euler(seedAt(i, 6) * 3, seedAt(i, 7) * 6, 0)), SC.set(s, s * 0.8, s)); };
    instanced(rockTiles, rockGeo, rockMat, function (x, y, i, m) { rockAt(x, y, i, m, 1); });
    var rockOl = instanced(rockTiles, rockGeo, OUTLINE, function (x, y, i, m) { rockAt(x, y, i, m, 1.08); }); if (rockOl) rockOl.castShadow = false;
    var wallMat = toon({ map: TEX.stone, color: w.cold ? 0xd8e4ee : 0xffffff });
    instanced(wallTiles, new T3.BoxGeometry(1, 1, 1), wallMat, function (x, y, i, m) { var hh = w.h[i], base = STEP, hgt = (hh + 1) * STEP - base + 0.3; m.compose(V3.set(x + 0.5, base + hgt / 2, y + 0.5), Q4.identity(), SC.set(1.0, hgt, 1.0)); });
    var pillarMat = toon({ color: 0x2a2630, emissive: 0x2a1040, emissiveIntensity: 0.6 });
    instanced(pillarTiles, new T3.CylinderGeometry(0.22, 0.3, 1, 8), pillarMat, function (x, y, i, m) { var mono = w.k[i] === KD.monolith, hgt = mono ? 1.6 : 2.4; m.compose(V3.set(x + 0.5, STEP + hgt / 2, y + 0.5), Q4.setFromEuler(new T3.Euler(0, mono ? 0.4 : 0, 0)), SC.set(mono ? 0.9 : 1.2, hgt, mono ? 0.5 : 1.2)); });
    var tentMat = toon({ map: TEX.cloth, color: 0xd0a070 });
    instanced(tentTiles, new T3.ConeGeometry(0.62, 0.8, 4), tentMat, function (x, y, i, m) { m.compose(V3.set(x + 0.5, topY(x, y) + 0.4, y + 0.5), Q4.setFromEuler(new T3.Euler(0, Math.PI / 4, 0)), SC.set(1, 1, 1)); });

    /* ---------- the living light: fires, torches, springs, weather ---------- */
    var fx2 = root.RealmFX.create({ T3: T3, scene: scene, topY: topY, level: en, toon: toon });
    var campFires = {}; // camp id -> fire handle
    Object.keys(w.objs).forEach(function (key) {
      var o = w.objs[key];
      if (o.kind === 'campfire') { var f = fx2.fire(o.x, o.y, { big: !o.camp }); if (o.camp) campFires[o.camp] = f; }
      else if (o.kind === 'torch') fx2.torch(o.x, o.y);
    });
    for (var spi = 0; spi < N; spi++) if (w.k[spi] === KD.spring && (spi % 3 === 0)) fx2.spring(spi % W, Math.floor(spi / W));
    fx2.setMood({ cold: w.cold, dim: dim });
    fx2.setWeather(S.weather.kind);
    /* The light budget: a shader holds only so many point lights, and a world has dozens of fires, torches, shrines
       and portals. Only the nearest few shine; the rest wait unlit until the King comes near. */
    var managedLights = [], LIGHT_BUDGET = en === 'full' ? 8 : en === 'balanced' ? 5 : 3, lightT = 1, lightSlots = [];
    for (var lsi = 0; lsi < LIGHT_BUDGET; lsi++) { var slot = new T3.PointLight(0xffffff, 0, 5); scene.add(slot); lightSlots.push(slot); }
    // the sources are not in the scene; the nearest few are copied into the slots (the count of lights never changes)
    function budgetLights() {
      var p = S.p;
      managedLights.forEach(function (m) { m.d = Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)); });
      managedLights.sort(function (a, b) { return a.d - b.d; });
      lightSlots.forEach(function (slot, i) { var m = managedLights[i]; slot.userData.src = m && m.d <= 14 ? m.light : null; if (!slot.userData.src) slot.intensity = 0; });
    }
    function copyLights() { lightSlots.forEach(function (slot) { var src = slot.userData.src; if (!src) return; slot.position.copy(src.position); slot.color.copy(src.color); slot.distance = src.distance; slot.decay = src.decay; slot.intensity = src.intensity; }); }

    /* ---------- the things of the world ---------- */
    var things = {};
    var shrineMat = toon({ color: 0xbfc4d4 }), beamMat = new T3.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.22, depthWrite: false, blending: T3.AdditiveBlending });
    var goldMat = toon({ color: COL.gold, emissive: 0x7a5010, emissiveIntensity: 0.4 });
    var ironMat = toon({ color: 0x3b3b44 });
    var portalMat = new T3.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.9 });
    var chestMat = toon({ color: 0x8a5a2b });
    var flagMats = { camp: new T3.MeshBasicMaterial({ color: 0x9a2a2a, side: T3.DoubleSide }), ours: new T3.MeshBasicMaterial({ color: 0xf0e0b0, side: T3.DoubleSide }), raid: new T3.MeshBasicMaterial({ color: 0xe0352b, side: T3.DoubleSide }) };
    function banner3d(mat) { var g = new T3.Group(); var pole = new T3.Mesh(GEO.flagPole, ironMat); pole.position.y = 0.6; g.add(pole); var fl = new T3.Mesh(GEO.flag, mat); fl.position.set(0.21, 1.05, 0); g.add(fl); g.userData.flag = fl; return g; }
    Object.keys(w.objs).forEach(function (key) {
      var o = w.objs[key], i = +key, x = o.x, y = o.y, g = new T3.Group(), top = topY(x, y);
      g.position.set(x + 0.5, top, y + 0.5);
      if (o.kind === 'shrine') {
        var ring = new T3.Mesh(new T3.TorusGeometry(0.38, 0.06, 8, 24), shrineMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; g.add(ring);
        var beam = new T3.Mesh(new T3.CylinderGeometry(0.22, 0.3, 3.2, 12, 1, true), beamMat); beam.position.y = 1.6; g.add(beam); g.userData.beam = beam;
        var gem = new T3.Mesh(new T3.OctahedronGeometry(0.14), toon({ color: 0x9fe0ff, emissive: 0x3aa0ff, emissiveIntensity: 1.2 })); gem.position.y = 0.7; g.add(gem); g.userData.gem = gem;
        var sl = new T3.PointLight(0x7fc8ff, 0.5, 4); sl.position.set(x + 0.5, top + 0.8, y + 0.5); managedLights.push({ light: sl, x: x, y: y });
      } else if (o.kind === 'cage') {
        var frame = new T3.LineSegments(new T3.EdgesGeometry(new T3.BoxGeometry(0.8, 1.0, 0.8)), new T3.LineBasicMaterial({ color: 0x5a5a66 })); frame.position.y = 0.5; g.add(frame);
        for (var bi = 0; bi < 4; bi++) { var bar = new T3.Mesh(new T3.CylinderGeometry(0.02, 0.02, 1.0, 5), ironMat); bar.position.set(bi < 2 ? -0.4 : 0.4, 0.5, bi % 2 ? -0.4 : 0.4); g.add(bar); }
        [[-0.4, 0], [0.4, 0], [0, -0.4], [0, 0.4]].forEach(function (p) { for (var bb = -1; bb <= 1; bb += 2) { var bar2 = new T3.Mesh(new T3.CylinderGeometry(0.015, 0.015, 1.0, 5), ironMat); bar2.position.set(p[0] || bb * 0.2, 0.5, p[1] || bb * 0.2); g.add(bar2); } });
        var captive = pieceMesh(o.ally, toon({ color: 0x9a948a })); captive.scale.set(0.7, 0.7, 0.7); g.add(captive); g.userData.captive = captive;
        if (S.used[i]) { g.children.forEach(function (c) { if (c !== captive) c.visible = false; }); captive.visible = false; }
      } else if (o.kind === 'chest') {
        var box = new T3.Mesh(new T3.BoxGeometry(0.6, 0.36, 0.42), chestMat); box.position.y = 0.18; box.castShadow = true; g.add(box);
        var lid = new T3.Group(), lidM = new T3.Mesh(new T3.BoxGeometry(0.6, 0.14, 0.42), chestMat); lidM.position.set(0, 0.07, 0.21); lid.add(lidM); lid.position.set(0, 0.36, -0.21); g.add(lid); g.userData.lid = lid;
        var clasp = new T3.Mesh(new T3.BoxGeometry(0.08, 0.1, 0.03), o.gift === 'camp' ? ironMat : goldMat); clasp.position.set(0, 0.3, 0.22); g.add(clasp); g.userData.clasp = clasp;
        if (S.used[i]) lid.rotation.x = -1.9;
      } else if (o.kind === 'portal') {
        var tor = new T3.Mesh(new T3.TorusGeometry(0.42, 0.05, 10, 32), portalMat); tor.position.y = 0.55; g.add(tor); g.userData.ring = tor;
        var disc = new T3.Mesh(new T3.CircleGeometry(0.38, 24), new T3.MeshBasicMaterial({ color: 0x1a4a70, transparent: true, opacity: 0.7, side: T3.DoubleSide })); disc.position.y = 0.55; g.add(disc); g.userData.disc = disc;
        var pl = new T3.PointLight(COL.cyan, 0.9, 4); pl.position.set(x + 0.5, top + 0.6, y + 0.5); managedLights.push({ light: pl, x: x, y: y });
      } else if (o.kind === 'monolith') {
        for (var ri = 0; ri < 3; ri++) { var rune = new T3.Mesh(new T3.BoxGeometry(0.46, 0.04, 0.26), new T3.MeshBasicMaterial({ color: COL.violet })); rune.position.set(0, 0.6 + ri * 0.35, 0); rune.rotation.y = 0.4; g.add(rune); }
      } else if (o.kind === 'campfire' && o.camp) {
        var cleared = S.camps[o.camp] && S.camps[o.camp].cleared;
        var bn = banner3d(cleared ? flagMats.ours : flagMats.camp); bn.position.set(0.55, 0, -0.5); g.add(bn); g.userData.banner = bn;
      }
      things[i] = g;
      scene.add(g);
    });
    fx2.lights().forEach(function (m) { managedLights.push(m); });
    budgetLights();
    var gateMeshes = [];
    (function () {
      var c = w.castles[8];
      [[c.gate[0], c.gate[1]], [c.gate[0], c.gate[1] + 1]].forEach(function (p) {
        var m = new T3.Mesh(new T3.BoxGeometry(0.9, 2.2, 0.98), ironMat); m.position.set(p[0] + 0.5, STEP + 1.1, p[1] + 0.5); m.castShadow = true;
        var bands = new T3.Mesh(new T3.BoxGeometry(0.96, 0.1, 1.02), goldMat); bands.position.y = 0.6; m.add(bands);
        if (S.gateOpen) m.position.y = STEP - 1.4;
        scene.add(m); gateMeshes.push(m);
      });
    })();

    /* ---------- the pieces ---------- */
    var ivory = toon({ color: 0xfff4de });
    var obsidian = toon({ color: 0x5a5470, emissive: 0x0a0810, emissiveIntensity: 0.3 });
    var obsidianAwake = toon({ color: 0x6a4458, emissive: 0x6a1414, emissiveIntensity: 0.35 });
    var wardenMat = toon({ color: 0x7a3040, emissive: 0x8a2010, emissiveIntensity: 0.45 });
    var grandMat = toon({ color: 0x4a2a68, emissive: 0x6a20a8, emissiveIntensity: 0.7 });
    var captainMat = toon({ color: 0x7a4a2a, emissive: 0x8a3a10, emissiveIntensity: 0.4 });
    var TYPECOL = { P: 0xc8c0b0, N: 0x72d060, B: 0x9a6cff, R: 0xf0a040, Q: 0xe0352b, K: 0xf0c050, A: 0xff5ad0 }, TYPEMAT = {};
    var silverMat = new T3.MeshBasicMaterial({ color: 0xdfe4f0, transparent: true, opacity: 0.8, depthWrite: false });
    var stunMat = new T3.MeshBasicMaterial({ color: 0xffe070 });
    function typeRing(t) { if (!TYPEMAT[t]) TYPEMAT[t] = new T3.MeshBasicMaterial({ color: TYPECOL[t] || 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }); var r = new T3.Mesh(GEO.typeRing, TYPEMAT[t]); r.rotation.x = Math.PI / 2; r.position.y = 0.03; return r; }
    var pieces = {};
    function matFor(e) { return e.side === 'w' ? ivory : e.grand ? grandMat : e.warden ? wardenMat : e.captain ? captainMat : e.awake ? obsidianAwake : obsidian; }
    function pieceAt(e) {
      var g = pieceMesh(e.t, matFor(e));
      if (e.side !== 'w') g.add(typeRing(e.t));
      if (e.elite) { var er = new T3.Mesh(GEO.eliteRing, silverMat); er.rotation.x = Math.PI / 2; er.position.y = 0.03; g.add(er); g.scale.setScalar(1.1); }
      if (e.captain) { var bn = banner3d(e.captain === 'raid' ? flagMats.raid : flagMats.camp); bn.position.set(0.3, 0, -0.3); bn.scale.setScalar(0.8); g.add(bn); g.scale.setScalar(1.2); }
      if (e.warden || e.grand) {
        for (var ci = 0; ci < e.hp; ci++) { var ring = new T3.Mesh(GEO.crown, goldMat); ring.rotation.x = Math.PI / 2; ring.position.y = (PH[e.t] || 1) + 0.12 + ci * 0.12; ring.userData.spin = 0.6 + ci * 0.2; g.add(ring); g.userData.crowns = g.userData.crowns || []; g.userData.crowns.push(ring); }
        if (e.grand) g.scale.set(1.9, 1.9, 1.9); else g.scale.set(1.35, 1.35, 1.35);
      }
      var st = new T3.Mesh(GEO.stunRing, stunMat); st.rotation.x = Math.PI / 2; st.position.y = (PH[e.t] || 1) + 0.25; st.visible = !!(e.stun > 0); g.add(st); g.userData.stunRing = st;
      g.userData.e = e; g.userData.baseScale = g.scale.x;
      place(g, e.x, e.y);
      if (e.dir) g.rotation.y = Math.atan2(e.dir[0], e.dir[1]);
      scene.add(g);
      pieces[e.id] = g;
      return g;
    }
    function place(g, x, y) { g.position.set(x + 0.5, topY(x, y), y + 0.5); }
    function setMat(g, m) { g.traverse(function (o) { if (o.isMesh && (o.material === obsidian || o.material === obsidianAwake)) o.material = m; else if (o.isMesh && (o.material === smoothOf(obsidian) || o.material === smoothOf(obsidianAwake))) o.material = smoothOf(m); }); }
    S.ents.forEach(function (e) { if (!e.dead) pieceAt(e); });
    S.allies.forEach(function (a) { pieceAt(a); });
    var player = new T3.Group(), playerBody = null;
    function setPlayerForm(t) {
      if (playerBody) player.remove(playerBody);
      playerBody = pieceMesh(t, ivory);
      player.add(playerBody);
      if (!player.userData.crown) { var cr = new T3.Mesh(new T3.TorusGeometry(0.2, 0.025, 8, 20), goldMat); cr.rotation.x = Math.PI / 2; player.userData.crown = cr; player.add(cr); }
      player.userData.crown.position.y = (PH[t] || 1) + 0.1;
      player.userData.crown.visible = t !== 'K';
    }
    setPlayerForm('K');
    place(player, S.p.x, S.p.y);
    scene.add(player);
    var playerLight = new T3.PointLight(0xffe8b0, 0.5, 5); playerLight.position.y = 1.3; player.add(playerLight);

    /* ---------- marks on the ground ---------- */
    var planeGeo = new T3.PlaneGeometry(0.94, 0.94); planeGeo.rotateX(-Math.PI / 2);
    var moveMarks = new T3.InstancedMesh(planeGeo, new T3.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }), 128); moveMarks.count = 0; scene.add(moveMarks);
    var threatMarks = new T3.InstancedMesh(planeGeo, new T3.MeshBasicMaterial({ color: COL.red, transparent: true, opacity: 0.22, depthWrite: false }), 900); threatMarks.count = 0; scene.add(threatMarks);
    var lineGeo = new T3.BoxGeometry(1, 0.035, 0.07);
    var threatLines = new T3.InstancedMesh(lineGeo, new T3.MeshBasicMaterial({ color: 0xff3b2a, transparent: true, opacity: 0.85, depthWrite: false, blending: T3.AdditiveBlending }), 64); threatLines.count = 0; scene.add(threatLines);
    var slideMarks = new T3.InstancedMesh(planeGeo, new T3.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.3, depthWrite: false }), 64); slideMarks.count = 0; scene.add(slideMarks);
    var hover = new T3.Mesh(new T3.RingGeometry(0.34, 0.46, 24), new T3.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.9, side: T3.DoubleSide, depthWrite: false })); hover.rotation.x = -Math.PI / 2; hover.visible = false; scene.add(hover);
    var ui = { form: S.p.form || 'K', firstPerson: false, yaw: 0.8, pitch: 0.42, dist: touch ? 4.4 : 3.6, hover: -1, busy: false, legal: [], threat: null, map: false, help: false, skills: false, time: 0, scale: 1, shake: 0, flash: 0, hurt: 0, cold: 0, over: false, sel: null, transmute: null };
    var threatSquares = {};
    function faceVec() { var sx = Math.sin(ui.yaw), cz = Math.cos(ui.yaw), fx = Math.round(sx), fz = Math.round(cz); if (!fx && !fz) { fx = Math.abs(sx) > Math.abs(cz) ? Math.sign(sx) : 0; fz = fx ? 0 : Math.sign(cz); } return [fx, fz]; }
    var face = { key: '', ang: 0, hop: 0 };
    var chevron = new T3.Mesh((function () { var sh = new T3.Shape(); sh.moveTo(-0.22, -0.16); sh.lineTo(0, 0.14); sh.lineTo(0.22, -0.16); sh.lineTo(0, -0.04); sh.closePath(); var g = new T3.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g; })(), new T3.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.75, depthWrite: false, side: T3.DoubleSide }));
    scene.add(chevron);
    function updateFacing(dt) {
      var fv = faceVec(), key = fv[0] + ',' + fv[1];
      if (key !== face.key) { var first = !face.key; face.key = key; face.ang = Math.atan2(fv[0], fv[1]); if (!first && !ui.busy) { face.hop = 1; hooks.snd('pb:step'); } }
      if (!tweens.some(function (t) { return t.g === player; })) {
        var cur = player.rotation.y, diff = ((face.ang - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        player.rotation.y = cur + diff * Math.min(1, dt * 14);
        if (face.hop > 0) { face.hop = Math.max(0, face.hop - dt * 4); player.position.y = topY(S.p.x, S.p.y) + Math.sin(face.hop * Math.PI) * 0.22; }
      }
      var cx = S.p.x + fv[0], cy = S.p.y + fv[1], show = mayAct() && Rm.inside(cx, cy) && !ui.firstPerson;
      chevron.visible = show;
      if (show) { chevron.position.set(cx + 0.5, topY(cx, cy) + 0.03, cy + 0.5); chevron.rotation.y = face.ang; chevron.material.opacity = 0.55 + Math.sin(ui.time * 5) * 0.2; }
    }
    function refreshMarks() {
      var ms = ui.over ? [] : Rm.playerMoves(S, ui.form), n = 0, ns = 0;
      ms.forEach(function (m) {
        if (n >= 128) return;
        M4.compose(V3.set(m.x + 0.5, topY(m.x, m.y) + 0.012, m.y + 0.5), Q4.identity(), SC.set(1, 1, 1));
        moveMarks.setMatrixAt(n, M4);
        moveMarks.setColorAt(n, CC.setHex(m.cap ? 0xffd040 : threatSquares[Rm.idx(m.x, m.y)] ? 0xff7a40 : 0x7ae070));
        n++;
        if (m.slide) m.path.forEach(function (p) { if (ns >= 64) return; M4.compose(V3.set(p[0] + 0.5, topY(p[0], p[1]) + 0.014, p[1] + 0.5), Q4.identity(), SC.set(0.6, 1, 0.6)); slideMarks.setMatrixAt(ns++, M4); });
      });
      moveMarks.count = n; moveMarks.instanceMatrix.needsUpdate = true; if (moveMarks.instanceColor) moveMarks.instanceColor.needsUpdate = true;
      slideMarks.count = ns; slideMarks.instanceMatrix.needsUpdate = true;
      ui.legal = ms;
    }
    function refreshThreats() {
      var th = Rm.threats(S, 18); ui.threat = th; threatSquares = th.squares;
      var n = 0, nl = 0;
      Object.keys(th.squares).forEach(function (key) {
        if (n >= 900) return;
        var i = +key, x = i % W, y = Math.floor(i / W);
        if (Rm.dist(x, y, S.p.x, S.p.y) > 12 + ui.dist) return;
        M4.compose(V3.set(x + 0.5, topY(x, y) + 0.008, y + 0.5), Q4.identity(), SC.set(1, 1, 1));
        threatMarks.setMatrixAt(n++, M4);
      });
      threatMarks.count = n; threatMarks.instanceMatrix.needsUpdate = true;
      th.atPlayer.forEach(function (e) {
        if (nl >= 64) return;
        var ax = e.x + 0.5, ay = topY(e.x, e.y) + 0.35, az = e.y + 0.5, bx = S.p.x + 0.5, by = topY(S.p.x, S.p.y) + 0.35, bz = S.p.y + 0.5;
        var dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        var q = new T3.Quaternion().setFromUnitVectors(new T3.Vector3(1, 0, 0), new T3.Vector3(dx, dy, dz).normalize());
        M4.compose(V3.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, SC.set(len, 1, 1));
        threatLines.setMatrixAt(nl++, M4);
      });
      threatLines.count = nl; threatLines.instanceMatrix.needsUpdate = true;
      hudCheck(th.atPlayer.length);
      Object.keys(pieces).forEach(function (id) { var g = pieces[id], e = g.userData.e; if (g.userData.stunRing) g.userData.stunRing.visible = !!(e && e.stun > 0); });
    }

    /* ---------- effects ---------- */
    var fx = [];
    var shardMats = { w: toon({ color: COL.ivory }), b: toon({ color: 0x2a2430, emissive: 0x5a1010, emissiveIntensity: 0.5 }) }, shardColMats = {};
    /* The lights of the effects come from a small pool that is always in the scene: adding a light to a scene makes
       three.js recompile every lit shader, and that was the lag on a capture. */
    var fxLights = [], fxLightAt = 0;
    for (var fli = 0; fli < (en === 'full' ? 3 : en === 'balanced' ? 2 : 1); fli++) { var fl0 = new T3.PointLight(0xffffff, 0, 6); fl0.position.set(S.p.x + 0.5, 1, S.p.y + 0.5); scene.add(fl0); fxLights.push(fl0); }
    function flash(x, y, col, intensity, life) {
      var fl = fxLights[fxLightAt++ % fxLights.length];
      fl.color.setHex(col); fl.intensity = intensity; fl.position.set(x + 0.5, topY(x, y) + 0.6, y + 0.5);
      fx.push({ m: fl, t: 0, life: life || 0.35, kind: 'light', i0: intensity });
    }
    function burst(x, y, side, n, big, col) {
      var top = topY(x, y);
      if (col && !shardColMats[col]) shardColMats[col] = toon({ color: col, emissive: col, emissiveIntensity: 0.6 });
      for (var i = 0; i < n; i++) {
        var m = new T3.Mesh(GEO.shard, col ? shardColMats[col] : (shardMats[side] || shardMats.b)), a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3 * (big ? 1.6 : 1);
        m.position.set(x + 0.5, top + 0.3 + Math.random() * 0.5, y + 0.5);
        m.scale.setScalar(0.7 + Math.random() * (big ? 1.4 : 0.8));
        scene.add(m);
        fx.push({ m: m, v: new T3.Vector3(Math.cos(a) * sp, 2.5 + Math.random() * 3, Math.sin(a) * sp), r: new T3.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), t: 0, life: 1.1 + Math.random() * 0.5, kind: 'shard', floor: top });
      }
      flash(x, y, col || (side === 'w' ? 0xfff0c0 : 0xff6a40), 3, 0.35);
    }
    var essCol = { N: 0x72d060, B: 0x4ad0ff, R: 0xffa040, Q: 0xd060ff, K: 0xffe070 };
    function orb(x, y, t) {
      var m = new T3.Mesh(GEO.orb, new T3.MeshBasicMaterial({ color: essCol[t] || 0xffffff, transparent: true, opacity: 0.95 }));
      m.position.set(x + 0.5, topY(x, y) + 0.5, y + 0.5);
      scene.add(m);
      fx.push({ m: m, t: 0, life: 1.1, kind: 'orb', from: m.position.clone() });
    }
    var puffGeo = new T3.SphereGeometry(0.08, 6, 5), puffMats = {};
    function puff(x, y, col, n) {
      var top = topY(x, y), key = col || 0xd8d0c0;
      if (!puffMats[key]) puffMats[key] = new T3.MeshBasicMaterial({ color: key, transparent: true, opacity: 0.8 });
      for (var i = 0; i < (n || 10); i++) {
        var m = new T3.Mesh(puffGeo, puffMats[key].clone()); m.scale.setScalar(0.75 + Math.random() * 0.75);
        var a = Math.random() * Math.PI * 2;
        m.position.set(x + 0.5 + Math.cos(a) * 0.2, top + 0.1, y + 0.5 + Math.sin(a) * 0.2);
        scene.add(m);
        fx.push({ m: m, v: new T3.Vector3(Math.cos(a) * 1.2, 0.6 + Math.random(), Math.sin(a) * 1.2), t: 0, life: 0.6, kind: 'puff' });
      }
    }
    function afterimage(g) {
      var c = g.clone(); c.traverse(function (o) { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; o.castShadow = false; } });
      scene.add(c);
      fx.push({ m: c, t: 0, life: 0.3, kind: 'ghost' });
    }
    // a word that floats up from a square (experience, a parry): a DOM label projected from the scene
    var labels = [];
    function label(x, y, text, cls) {
      var d = document.createElement('div'); d.className = 'rh-float ' + (cls || ''); d.textContent = text; hud.appendChild(d);
      labels.push({ el: d, x: x + 0.5, y: topY(x, y) + 1.2, z: y + 0.5, t: 0, life: 1.4 });
    }
    var PV = new T3.Vector3();
    function updateLabels(dt) {
      for (var i = labels.length - 1; i >= 0; i--) {
        var l = labels[i]; l.t += dt; l.y += dt * 0.7;
        PV.set(l.x, l.y, -l.z).project(camera);
        var k = l.t / l.life, vis = PV.z < 1 && Math.abs(PV.x) < 1.2 && Math.abs(PV.y) < 1.2;
        l.el.style.display = vis ? 'block' : 'none';
        l.el.style.left = ((PV.x + 1) / 2 * el.clientWidth) + 'px'; l.el.style.top = ((1 - PV.y) / 2 * el.clientHeight) + 'px';
        l.el.style.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
        if (k >= 1) { if (l.el.parentNode) l.el.parentNode.removeChild(l.el); labels.splice(i, 1); }
      }
    }
    function updateFx(dt) {
      for (var i = fx.length - 1; i >= 0; i--) {
        var f = fx[i]; f.t += dt;
        var k = f.t / f.life;
        if (f.kind === 'shard') { f.v.y -= 9.8 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += f.r.x * dt; f.m.rotation.y += f.r.y * dt; if (f.m.position.y < f.floor + 0.04) { f.m.position.y = f.floor + 0.04; f.v.y *= -0.35; f.v.x *= 0.7; f.v.z *= 0.7; } if (k > 0.7) f.m.scale.multiplyScalar(0.93); }
        else if (f.kind === 'light') f.m.intensity = (f.i0 || 3) * (1 - k);
        else if (f.kind === 'orb') { var tgt = player.position; if (k < 0.35) f.m.position.y = f.from.y + k * 1.5; else { var kk = (k - 0.35) / 0.65, ee = kk * kk; f.m.position.lerpVectors(f.from.clone().setY(f.from.y + 0.52), new T3.Vector3(tgt.x, tgt.y + 0.8, tgt.z), ee); } f.m.scale.setScalar(1 + Math.sin(f.t * 20) * 0.15); }
        else if (f.kind === 'puff') { f.m.position.addScaledVector(f.v, dt); f.v.multiplyScalar(0.92); f.m.material.opacity = 0.8 * (1 - k); f.m.scale.multiplyScalar(1.03); }
        else if (f.kind === 'ghost') f.m.traverse(function (o) { if (o.isMesh) o.material.opacity = 0.35 * (1 - k); });
        else if (f.kind === 'rise') { f.m.scale.setScalar(Math.min(1, k) * (f.s || 1)); f.m.position.y = f.y0 + (1 - Math.min(1, k)) * -0.6; }
        if (f.t >= f.life) { if (f.kind === 'light') f.m.intensity = 0; else scene.remove(f.m); if (f.kind === 'rise') { f.m.scale.setScalar(f.s || 1); f.m.position.y = f.y0; scene.add(f.m); } if (f.kind === 'puff') f.m.material.dispose(); fx.splice(i, 1); }
      }
    }

    /* ---------- the tweens of a turn ---------- */
    var tweens = [];
    function tween(g, from, to, kind, dur, done) {
      var a = { g: g, fx: from[0] + 0.5, fy: topY(from[0], from[1]), fz: from[1] + 0.5, tx: to[0] + 0.5, ty: topY(to[0], to[1]), tz: to[1] + 0.5, t: 0, dur: dur, kind: kind, done: done, ghostAt: 0 };
      var dx = to[0] - from[0], dz = to[1] - from[1];
      if (dx || dz) g.rotation.y = Math.atan2(dx, dz);
      tweens.push(a);
      return a;
    }
    function updateTweens(dt) {
      for (var i = tweens.length - 1; i >= 0; i--) {
        var a = tweens[i]; a.t += dt;
        if (a.kind === 'sink') { var ks = Math.min(1, a.t / a.dur); a.g.position.y = a.fy + (a.ty - a.fy) * ks; a.g.position.x = a.fx + (Math.random() - 0.5) * 0.02 * (1 - ks); if (ks >= 1) tweens.splice(i, 1); continue; }
        var k = Math.min(1, a.t / a.dur), e = a.kind === 'slide' || a.kind === 'glide' ? (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) : k;
        var x = a.fx + (a.tx - a.fx) * e, z = a.fz + (a.tz - a.fz) * e, y = a.fy + (a.ty - a.fy) * e;
        if (a.kind === 'hop') y += Math.sin(k * Math.PI) * 0.35;
        else if (a.kind === 'leap') { y += Math.sin(k * Math.PI) * 1.4; a.g.rotation.x = Math.sin(k * Math.PI) * -0.3; }
        else if (a.kind === 'slide') { a.g.rotation.z = Math.sin(k * Math.PI) * 0.12; a.ghostAt += dt; if (a.ghostAt > 0.04 && k < 0.9) { a.ghostAt = 0; afterimage(a.g); } }
        else if (a.kind === 'glide') { a.g.rotation.x = -0.12 * Math.sin(k * Math.PI); a.ghostAt += dt; if (a.ghostAt > 0.06 && k < 0.9) { a.ghostAt = 0; afterimage(a.g); } }
        else if (a.kind === 'bump') { var bk = Math.sin(k * Math.PI) * 0.45; x = a.fx + (a.tx - a.fx) * bk; z = a.fz + (a.tz - a.fz) * bk; y = a.fy + Math.sin(k * Math.PI) * 0.25; }
        else if (a.kind === 'blink') { var sc = k < 0.5 ? 1 - k * 2 : (k - 0.5) * 2; a.g.scale.setScalar(Math.max(0.01, sc) * (a.g.userData.baseScale || 1)); if (k >= 0.5) { x = a.tx; y = a.ty; z = a.tz; } else { x = a.fx; y = a.fy; z = a.fz; } }
        a.g.position.set(x, y, z);
        if (k >= 1) { a.g.rotation.x = 0; a.g.rotation.z = 0; tweens.splice(i, 1); if (a.done) a.done(); }
      }
    }
    var waitFor = function (ms) { return new Promise(function (r) { if (turnRun && turnRun.flushed) { r(); return; } setTimeout(r, ms / ui.scale); }); };
    function flush() {
      if (turnRun) turnRun.flushed = true;
      tweens.slice().forEach(function (a) { if (a.kind === 'sink') return; a.t = a.dur; });
      updateTweens(0);
      ui.scale = 1;
    }
    var animDur = { hop: 0.16, leap: 0.34, slide: 0.3, glide: 0.3, blink: 0.4, bump: 0.22 };
    var turnRun = null;
    function kindOf(t, path, slide) { return slide ? 'glide' : t === 'N' ? 'leap' : (path && path.length) ? 'slide' : 'hop'; }
    function playEvents(ev) {
      var run = turnRun = { flushed: false };
      return new Promise(function (resolve) {
        var i = 0;
        function next() {
          if (run.flushed) { while (i < ev.length) { var r = ev[i++]; if (r.e !== 'move' && r.e !== 'strike') land(r); } resolve(); return; }
          if (i >= ev.length) { resolve(); return; }
          var e = ev[i++];
          if ((e.e === 'move' || e.e === 'strike') && e.who === 'p') {
            var kd = e.e === 'strike' ? 'bump' : kindOf(e.form, e.path, e.slide), dur = animDur[kd] * (kd === 'slide' || kd === 'glide' ? Math.min(1.6, 0.6 + e.path.length * 0.1) : 1);
            setPlayerForm(e.form);
            if (e.form !== 'K') { puff(e.from[0], e.from[1], essCol[e.form], 8); hooks.snd(e.form === 'N' ? 'pb:jump' : 'pb:slide'); } else hooks.snd(e.slide ? 'pb:slide' : 'pb:step');
            var caps = []; while (ev[i] && (ev[i].e === 'capture' || ev[i].e === 'wound' || ev[i].e === 'crownOff' || ev[i].e === 'summon' || ev[i].e === 'shard' || ev[i].e === 'gate' || ev[i].e === 'won' || ev[i].e === 'xp' || ev[i].e === 'levelUp' || ev[i].e === 'campCleared' || ev[i].e === 'bounty' || ev[i].e === 'bountyDone' || ev[i].e === 'bountyNew' || ev[i].e === 'stun' || ev[i].e === 'echo') && ev[i].by !== 'ally' && ev[i].by !== 'enemy') caps.push(ev[i++]);
            tween(player, e.from, e.to, kd, dur, function () { caps.forEach(land); ui.canAct = true; next(); });
            return;
          }
          if (e.e === 'move' || e.e === 'strike') {
            var batch = [e]; while (ev[i] && (ev[i].e === 'move' || ev[i].e === 'strike') && ev[i].who !== 'p') batch.push(ev[i++]);
            var left = batch.length;
            batch.forEach(function (b) {
              var g = pieces[b.id]; if (!g) { left--; return; }
              var kd2 = b.e === 'strike' ? 'bump' : kindOf(b.t, b.path, b.slide);
              tween(g, b.from, b.to, kd2, animDur[kd2] * (kd2 === 'slide' || kd2 === 'glide' ? Math.min(1.3, 0.6 + b.path.length * 0.08) : b.patrol ? 1.6 : 1), function () { if (--left <= 0) next(); });
            });
            if (left <= 0) next();
            return;
          }
          land(e);
          var pause = e.e === 'hit' ? 260 : e.e === 'capture' ? 120 : e.e === 'crownOff' ? 320 : e.e === 'mated' ? 1300 : e.e === 'portal' ? 300 : e.e === 'arena' ? 600 : e.e === 'won' ? 500 : e.e === 'raid' ? 500 : e.e === 'secondWind' ? 500 : e.e === 'frostbite' ? 260 : e.e === 'hearth' ? 500 : 0;
          if (pause) waitFor(pause).then(next); else next();
        }
        next();
      });
    }
    function entById(id) { return S.ents.filter(function (x) { return x.id === id; })[0]; }
    function land(e) {
      if (e.e === 'capture') {
        var g = pieces[e.id];
        if (g) { scene.remove(g); delete pieces[e.id]; }
        burst(e.at[0], e.at[1], e.by === 'enemy' ? 'w' : 'b', e.warden ? 36 : e.grand ? 60 : e.captain ? 24 : 14, !!(e.warden || e.grand));
        if (e.by === 'p') { orb(e.at[0], e.at[1], e.t === 'P' ? 'K' : e.t); hooks.snd('slash'); hooks.snd('capture', 0.05); slowmo(e.warden || e.grand ? 0.25 : 0.45, e.warden || e.grand ? 0.7 : 0.22); shake(e.warden ? 0.5 : 0.25); }
        else hooks.snd('capture');
        if (e.warden) message('The warden falls.');
        else if (e.captain && e.name) message(e.name + ' falls.');
      } else if (e.e === 'wound') { var gw0 = pieces[e.id]; if (gw0) { puff(e.at[0], e.at[1], 0xff6a50, 10); setMat(gw0, obsidianAwake); } hooks.snd('capture'); message(e.left === 1 ? 'Wounded. One more blow.' : 'Wounded.'); }
      else if (e.e === 'allyLost') { var ga = pieces[e.id]; if (ga) { scene.remove(ga); delete pieces[e.id]; } burst(e.at[0], e.at[1], 'w', 12); hooks.snd('capture'); message('Your ' + NAME[e.t].toLowerCase() + ' is taken.'); }
      else if (e.e === 'allyHit') { puff(e.at[0], e.at[1], 0xffffff, 10); hooks.snd('capture'); message('Your ' + NAME[e.t].toLowerCase() + ' is struck, and stands.'); }
      else if (e.e === 'crownOff') {
        var gw = pieces[e.id];
        if (gw) {
          var cr = gw.userData.crowns && gw.userData.crowns.pop();
          if (cr) { gw.remove(cr); cr.position.copy(gw.position).add(new T3.Vector3(0, 1.7, 0)); scene.add(cr); fx.push({ m: cr, v: new T3.Vector3((Math.random() - 0.5) * 3, 4, (Math.random() - 0.5) * 3), r: new T3.Vector3(3, 5, 2), t: 0, life: 1.4, kind: 'shard', floor: topY(e.from[0], e.from[1]) }); }
          puff(e.from[0], e.from[1], 0x6a2a40, 16);
          tween(gw, e.from, e.to, 'blink', 0.5, function () { puff(e.to[0], e.to[1], 0x6a2a40, 16); });
        }
        hooks.snd('boom'); shake(0.45); slowmo(0.3, 0.5);
        message(e.left === 1 ? 'One crown left.' : e.left + ' crowns left.');
      } else if (e.e === 'summon') {
        var ent = entById(e.id);
        if (ent) { var gs = pieceAt(ent); var y0 = gs.position.y; gs.scale.setScalar(0.01); fx.push({ m: gs, t: 0, life: 0.5, kind: 'rise', y0: y0, s: gs.userData.baseScale }); puff(e.at[0], e.at[1], 0x8a2a30, 10); }
        hooks.snd('zap');
      } else if (e.e === 'raid') {
        e.ids.forEach(function (id) { var re = entById(id); if (re && !pieces[id]) { var gr = pieceAt(re); var yy = gr.position.y; gr.scale.setScalar(0.01); fx.push({ m: gr, t: 0, life: 0.6, kind: 'rise', y0: yy, s: gr.userData.baseScale }); } });
        hooks.snd('boom'); hooks.snd('check', 0.15); shake(0.5);
        banner('A raid', 'A captain and his band, ' + Rm.dist(e.at[0], e.at[1], S.p.x, S.p.y) + ' squares off. They know where you are.');
        hudBounties();
      } else if (e.e === 'hit') {
        hooks.snd('hurt'); shake(0.9); ui.flash = 1; ui.hurt = 1; slowmo(0.3, 0.75);
        var hh = $('#rhHearts'); hh.classList.remove('hurt'); void hh.offsetWidth; hh.classList.add('hurt');
        if (e.pushed) { var ge = pieces[e.id]; var pf = [player.position.x - 0.5, player.position.z - 0.5]; if (ge) tween(ge, e.from, [Math.round(pf[0]), Math.round(pf[1])], kindOf(e.t, [1]), 0.35); tween(player, [Math.round(pf[0]), Math.round(pf[1])], e.pushed, 'hop', 0.3); }
        else { var ge2 = pieces[e.id]; if (ge2) tween(ge2, e.from, [S.p.x, S.p.y], 'bump', 0.3); }
        burst(Math.round(player.position.x - 0.5), Math.round(player.position.z - 0.5), 'w', 6);
        message(e.hearts > 0 ? 'A ' + NAME[e.t].toLowerCase() + ' strikes. ' + e.hearts + (e.hearts === 1 ? ' heart left.' : ' hearts left.') : 'A ' + NAME[e.t].toLowerCase() + ' strikes.');
        hudHearts();
      } else if (e.e === 'parry') { var gp0 = pieces[e.id]; if (gp0) tween(gp0, e.from, [S.p.x, S.p.y], 'bump', 0.3); burst(S.p.x, S.p.y, 'w', 10, false, 0xffd060); hooks.snd('right'); label(S.p.x, S.p.y, 'Bulwark', 'gold'); message('Bulwark: the strike glances off.'); }
      else if (e.e === 'secondWind') { burst(S.p.x, S.p.y, 'w', 30, true, 0xffe080); hooks.snd('win'); ui.flash = 0; ui.hurt = 0; banner('Second Wind', 'One heart. Make it count.'); hudHearts(); }
      else if (e.e === 'frostbite') { hooks.snd('hurt'); ui.cold = 1; shake(0.4); var hh2 = $('#rhHearts'); hh2.classList.remove('hurt'); void hh2.offsetWidth; hh2.classList.add('hurt'); message(e.hearts > 0 ? 'The cold takes a heart. ' + e.hearts + ' left.' : 'The cold takes the last heart.'); hudHearts(); }
      else if (e.e === 'cold') { hudWarmth(e); }
      else if (e.e === 'weather') { fx2.setWeather(e.kind); message(e.kind === 'blizzard' ? 'A blizzard rises. The enemies see less, and the cold bites twice.' : e.kind === 'rain' ? 'Rain.' : S.world.cold ? 'The blizzard passes.' : 'The rain stops.'); hudTop(); }
      else if (e.e === 'mated') {
        fade(1, 500); hooks.snd('lose');
        setTimeout(function () { place(player, e.to[0], e.to[1]); Object.keys(pieces).forEach(function (id) { var pg = pieces[id], pe = pg.userData.e; if (pe && !pe.dead && !S.allies.some(function (a) { return a.id === pe.id; }) && pe.side !== 'w') place(pg, pe.x, pe.y); else if (pe && pe.side === 'w') { scene.remove(pg); delete pieces[id]; } }); S.ents.forEach(function (x) { if (x.dead && pieces[x.id]) { scene.remove(pieces[x.id]); delete pieces[x.id]; } }); hudAll(); fade(0, 700); banner('Mated', 'The ' + (e.deaths === 1 ? 'first' : 'next') + ' fall. ' + (S.shrine ? 'Your fire takes you back.' : 'The start takes you back.')); }, 700);
      } else if (e.e === 'portal') { hooks.snd('portal'); puff(e.from[0], e.from[1], COL.cyan, 14); setTimeout(function () { place(player, e.to[0], e.to[1]); puff(e.to[0], e.to[1], COL.cyan, 14); ui.yaw += Math.PI; }, 220); }
      else if (e.e === 'hearth') { hooks.snd('portal'); puff(e.from[0], e.from[1], 0xffc070, 18); fade(1, 250); setTimeout(function () { place(player, S.p.x, S.p.y); puff(S.p.x, S.p.y, 0xffc070, 18); fade(0, 500); }, 300); message('Hearthstone: back at your fire.'); }
      else if (e.e === 'shrine') { hooks.snd('promo'); var tg = things[Rm.idx(S.p.x, S.p.y)]; if (tg && tg.userData.beam) tg.userData.beam.material.opacity = 0.8; puff(S.p.x, S.p.y, 0x9fe0ff, 18); message(e.healed ? 'The shrine heals you. Your way back is here now.' : 'The shrine remembers you.'); hudAll(); }
      else if (e.e === 'outpost') { hooks.snd('promo'); puff(S.p.x, S.p.y, 0xffd080, 14); if (e.first) message('Your outpost: the way back is here now, and the fire is warm.'); hudAll(); }
      else if (e.e === 'rest') { puff(S.p.x, S.p.y, 0xff8080, 8); hooks.snd('right'); label(S.p.x, S.p.y, '+1 heart', 'red'); hudHearts(); }
      else if (e.e === 'locked') { hooks.snd('wrong'); message('The chest is locked. Take the camp\'s captain and it opens.'); }
      else if (e.e === 'chest') { hooks.snd('gold'); var tc = things[Rm.idx(S.p.x, S.p.y)]; if (tc && tc.userData.lid) tc.userData.lid.rotation.x = -1.9; puff(S.p.x, S.p.y, e.gift === 'heart' ? 0xff5060 : e.gift === 'camp' ? 0xffd080 : essCol[e.gift], 16); message(e.gift === 'heart' ? 'A heart gem: one more heart, and all of them full.' : e.gift === 'camp' ? 'The camp\'s chest: essence of every kind, and a heart back.' : (Rm.sk(S, 'quarter') ? 'Five ' : 'Three ') + NAME[e.gift].toLowerCase() + ' essences.'); hudAll(); }
      else if (e.e === 'freed') { hooks.snd('promo'); var tk = things[Rm.idx(S.p.x, S.p.y)]; if (tk) tk.children.forEach(function (c) { c.visible = false; }); if (e.at) { var al = S.allies.filter(function (a) { return a.id === e.id; })[0]; if (al) { var gf = pieceAt(al); var y1 = gf.position.y; gf.scale.setScalar(0.01); fx.push({ m: gf, t: 0, life: 0.5, kind: 'rise', y0: y1, s: 1 }); } message('A ' + NAME[e.t].toLowerCase() + ' is freed and follows you.'); } else message('The cage is empty: your company is full.'); }
      else if (e.e === 'monolith') { showText(S.world.monoliths[e.text] || ''); hooks.snd('pb:flick'); }
      else if (e.e === 'arena') { hooks.snd('boom'); shake(0.4); banner(e.name, 'The gate shuts behind you.'); hooks.music('boss'); }
      else if (e.e === 'shard') { hooks.snd('win'); banner('A crown shard', e.n + ' of ' + Rm.SHARDS_NEEDED + '. ' + (e.n >= Rm.SHARDS_NEEDED ? 'The gate of the court is open.' : (Rm.SHARDS_NEEDED - e.n) + ' more open the gate of the court.')); hudAll(); hooks.music(regionMood()); }
      else if (e.e === 'gate') { gateMeshes.forEach(function (m) { tweens.push({ g: m, fx: m.position.x, fy: m.position.y, fz: m.position.z, tx: m.position.x, ty: STEP - 1.4, tz: m.position.z, t: 0, dur: 2.5, kind: 'sink' }); }); shake(0.3); }
      else if (e.e === 'promote') { var gp = pieces[e.id]; if (gp) { var ent2 = gp.userData.e; scene.remove(gp); delete pieces[e.id]; pieceAt(ent2); puff(e.at[0], e.at[1], COL.promo, 18); } hooks.snd('promo'); message('A pawn promotes: a queen now.'); }
      else if (e.e === 'turn') { var gt = pieces[e.id]; if (gt) gt.rotation.y = Math.atan2(e.dir[0], e.dir[1]); }
      else if (e.e === 'wake') { var gk = pieces[e.id]; if (gk) { var we = gk.userData.e; if (!we.captain) setMat(gk, obsidianAwake); } }
      else if (e.e === 'calm') { var gc = pieces[e.id]; if (gc && !gc.userData.e.captain) setMat(gc, obsidian); }
      else if (e.e === 'stun') { e.ids.forEach(function (id) { var gst = pieces[id]; if (gst) { gst.userData.stunRing.visible = true; puff(gst.userData.e.x, gst.userData.e.y, 0xffe070, 8); } }); hooks.snd('zap'); message('Thunder Leap: the enemies beside you reel.'); }
      else if (e.e === 'echo') { message('Echo Step: the essence stays with you.'); hudForms(); }
      else if (e.e === 'double') { burst(S.p.x, S.p.y, 'w', 8, false, 0xffffff); hooks.snd('right'); message('Double Time: move again.'); }
      else if (e.e === 'xp') { label(e.at[0], e.at[1], '+' + e.n, 'xp'); hudXp(); }
      else if (e.e === 'levelUp') { hooks.snd('promo'); burst(S.p.x, S.p.y, 'w', 20, true, 0xffe070); banner('Level ' + e.level, e.points === 1 ? 'A skill point to spend.' : e.points + ' skill points to spend.'); hudXp(); $('[data-act=skills]').classList.add('pulse'); }
      else if (e.e === 'campCleared') { hooks.snd('win'); var cf = campFires[e.id]; if (cf) { cf.light.color.setHex(0xffd090); } var ct = things[Rm.idx(e.at[0], e.at[1])]; if (ct && ct.userData.banner) ct.userData.banner.userData.flag.material = flagMats.ours; Object.keys(things).forEach(function (k) { var o = w.objs[k]; if (o && o.kind === 'chest' && o.camp === e.id && things[k].userData.clasp) things[k].userData.clasp.material = goldMat; }); burst(e.at[0], e.at[1], 'w', 20, true, 0xffc060); banner('The camp is yours', e.name.replace(/^Captain of the /, 'The ') + ' falls. Its fire is your outpost, its chest is open.'); hudBounties(); }
      else if (e.e === 'bounty') { hudBounties(); }
      else if (e.e === 'bountyDone') { hooks.snd('gold'); label(S.p.x, S.p.y, 'Bounty', 'gold'); message('Bounty settled: ' + e.name + '. +' + e.xp + ' experience, two ' + NAME[e.ess].toLowerCase() + ' essence.'); hudBounties(); hudAll(); }
      else if (e.e === 'bountyNew') { hudBounties(); }
      else if (e.e === 'won') { ui.over = true; hooks.snd('win'); setTimeout(ending, 1200); }
      else if (e.e === 'threat') { if (e.n) hooks.snd('check', 0.1); }
    }
    function slowmo(scale, secs) { ui.scale = scale; clearTimeout(ui.slowT); ui.slowT = setTimeout(function () { ui.scale = 1; }, secs * 1000); }
    function shake(n) { ui.shake = Math.max(ui.shake, n); }

    /* ---------- the HUD ---------- */
    var NAME = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn', A: 'Grand Queen' };
    hud.innerHTML = '<div class="rh-top"><div class="rh-left"><div class="rh-hearts" id="rhHearts"></div><div class="rh-warm" id="rhWarm"><i></i><b>Warmth</b></div><div class="rh-xp" id="rhXp"><i></i><b></b></div></div>' +
      '<div class="rh-mid"><div class="rh-region" id="rhRegion"></div><div class="rh-weather" id="rhWeather"></div><div class="rh-check" id="rhCheck">Check</div></div>' +
      '<div class="rh-right"><span id="rhRank"></span><span id="rhShards"></span><span id="rhTurn"></span><div class="rh-bounties" id="rhBounties"></div></div></div>' +
      '<div class="rh-banner" id="rhBanner"><b></b><span></span></div><div class="rh-msgs" id="rhMsgs"></div><div class="rh-flash" id="rhFlash"></div><div class="rh-frost" id="rhFrost"></div><div class="rh-fade" id="rhFade"></div>' +
      '<div class="rh-text" id="rhText"><p></p><button class="btn">Close</button></div>' +
      '<div class="rh-bottom"><div class="rh-forms" id="rhForms"></div><div class="rh-acts" id="rhActs"></div></div>' +
      (touch ? '<div class="rh-dpad" id="rhDpad">' + [[-1, 1], [0, 1], [1, 1], [-1, 0], [0, 0], [1, 0], [-1, -1], [0, -1], [1, -1]].map(function (d) { return d[0] || d[1] ? '<button data-d="' + d[0] + ',' + d[1] + '"></button>' : '<button data-act="wait" class="rh-dwait">Wait</button>'; }).join('') + '</div>' : '') +
      '<canvas class="rh-radar" id="rhRadar" width="170" height="170"></canvas><div class="rh-map" id="rhMap"><div class="rh-maptitle" id="rhMapTitle"></div><canvas id="rhMapCv" width="960" height="960"></canvas><div class="rh-mapkey">Gold: you. Red: enemies. White: allies. Blue: shrines. Violet: castles. Orange: camps, green when yours.</div></div>' +
      '<div class="rh-skills" id="rhSkills"></div>' +
      '<div class="rh-help" id="rhHelp"><h3>The Ninth Rank</h3><p>You are the last King on a board the size of a kingdom. The world moves when you move: every piece on it steps by its own rules after each move of yours.</p><ul>' +
      '<li><b>Move:</b> tap a lit square. Green is safe, orange is in an enemy\'s reach, gold holds an enemy to take. Keys: WASD or the arrows step as the King' + (touch ? ', or the pad at the bottom left' : '') + '.</li>' +
      '<li><b>Forms:</b> taking a piece leaves its essence. Pick a form (or press 1 to 5) and move as that piece once: a knight leaps over walls, a rook crosses a field in a breath.</li>' +
      '<li><b>Hearts and warmth:</b> an enemy that reaches your square takes a heart. In the cold lands your warmth drains away from fires, torches, springs and shrines; at nothing, the cold takes hearts. Ice slides you to its end.</li>' +
      '<li><b>Camps and patrols:</b> the enemies live in camps and walk patrols. Take a camp\'s captain and the camp is yours: an outpost, a warm fire, your way back, an open chest. Raids come looking for you.</li>' +
      '<li><b>Experience:</b> every piece taken, camp cleared and bounty settled levels you up. Skill points go into the tree (the Skills button, or K): the Crown, the Essence, the Dominion. They stay with you from world to world.</li>' +
      '<li><b>The goal:</b> seven wardens hold crown shards in their castles. Five open the gate of the court. Beyond the Grand Queen waits the next rank: another world, harder, with you as you are.</li>' +
      '<li><b>Camera:</b> drag to look around, pinch or wheel to zoom, V for the King\'s own eyes, M for the map.</li></ul><p class="rh-credit">Chess pieces by Jarlan Perez (poly.pizza), CC-BY 4.0.</p><button class="btn green">Play</button></div>' +
      '<div class="rh-end" id="rhEnd"></div>';
    var $ = function (sel) { return hud.querySelector(sel); };
    function hudHearts() {
      var s = '';
      for (var i = 0; i < S.p.maxHearts; i++) s += '<i class="' + (i < S.p.hearts ? 'on' : '') + '"></i>';
      $('#rhHearts').innerHTML = s;
    }
    function hudWarmth(e) {
      var box = $('#rhWarm'), cold = S.world.cold || S.p.warmth < S.p.maxWarmth;
      box.classList.toggle('on', cold);
      var k = S.p.warmth / S.p.maxWarmth;
      box.querySelector('i').style.width = Math.round(k * 100) + '%';
      box.classList.toggle('low', k <= 0.3); box.classList.toggle('frozen', S.p.warmth <= 0); box.classList.toggle('warming', !!(e && e.warming));
      box.querySelector('b').textContent = S.p.warmth <= 0 ? 'Frozen' : e && e.warming ? 'Warming' : 'Warmth';
      fx2.setFrost(S.p.warmth <= 0 ? 1 : k < 0.3 ? (0.3 - k) / 0.3 * 0.6 : 0);
      $('#rhFrost').style.opacity = S.p.warmth <= 0 ? 0.75 : k < 0.3 ? (0.3 - k) / 0.3 * 0.45 : 0;
      if (e && !e.warming && S.world.cold) fx2.puff(player.position.x + Math.sin(player.rotation.y) * 0.2, player.position.z + Math.cos(player.rotation.y) * 0.2, player.position.y + 1.1, null, 0.4);
    }
    function hudXp() {
      var xp = S.meta.xp || 0, lvl = SK.levelOf(xp), lo = SK.xpFor(lvl), hi = SK.xpFor(lvl + 1), pts = SK.pointsLeft(S.meta);
      $('#rhXp i').style.width = Math.round((xp - lo) / (hi - lo) * 100) + '%';
      $('#rhXp b').textContent = 'Level ' + lvl + (pts > 0 ? ' (' + pts + (pts === 1 ? ' point)' : ' points)') : '');
      var sb = $('[data-act=skills]'); if (sb) { sb.classList.toggle('badge', pts > 0); sb.setAttribute('data-n', pts); }
    }
    function hudForms() {
      var s = '';
      ['K', 'N', 'B', 'R', 'Q'].forEach(function (t, i) {
        var n = t === 'K' ? null : S.p.ess[t], cost = Rm.formCost(S, t), can = t === 'K' || n >= cost;
        s += '<button class="rh-form ' + t + (ui.form === t ? ' on' : '') + (can ? '' : ' none') + '" data-form="' + t + '" title="' + NAME[t] + (t === 'K' ? ': one step, always' : ': ' + n + ' essence' + (cost > 1 ? ', ' + cost + ' a move while frozen' : '')) + ' (' + (i + 1) + ')"><i style="background-image:url(' + hooks.pieceUrl(t === 'K' ? 'K' : t) + ')"></i><b>' + (t === 'K' ? '∞' : n) + '</b></button>';
      });
      $('#rhForms').innerHTML = s;
      hud.querySelectorAll('[data-form]').forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); if (ui.transmute) { pickTransmute(b.dataset.form); return; } setForm(b.dataset.form); }; });
    }
    function hudActs() {
      var s = (touch ? '' : '<button data-act="wait" title="Stand still for a turn (Space)">Wait</button>') +
        '<button data-act="skills" title="The skill tree (K)">Skills</button>' +
        (Rm.sk(S, 'transmute') ? '<button data-act="transmute" title="Three essence of one kind into two of another">Transmute</button>' : '') +
        (Rm.sk(S, 'hearthstone') ? '<button data-act="hearth" title="Back to your last shrine or outpost (once every 40 moves)">Hearth</button>' : '') +
        '<button data-act="cam" title="Behind the King or through his eyes (V)">Eyes</button><button data-act="map" title="The map (M)">Map</button><button data-act="help" title="How to play (H)">?</button><button data-act="exit" title="Back to Power Chess (Esc)">Exit</button>';
      $('#rhActs').innerHTML = s;
      hud.querySelectorAll('[data-act]').forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); act(b.dataset.act); }; });
      var hb = $('[data-act=hearth]'); if (hb) hb.disabled = !Rm.hearthReady(S);
    }
    function hudTop() {
      $('#rhShards').textContent = S.p.shards + ' / ' + Rm.SHARDS_NEEDED + ' shards';
      $('#rhTurn').textContent = 'Move ' + S.turn;
      $('#rhRank').textContent = 'Rank ' + S.rank + ': ' + S.world.kindName;
      $('#rhRegion').textContent = Rm.regionName(S);
      var wz = S.weather.kind; $('#rhWeather').textContent = wz === 'blizzard' ? 'Blizzard' : wz === 'rain' ? 'Rain' : ''; $('#rhWeather').classList.toggle('on', wz !== 'clear');
    }
    function hudBounties() {
      var s = '';
      S.bounties.filter(function (b) { return !b.done; }).forEach(function (b) { var d = SK.bounty(b.id); s += '<div class="rh-bounty" title="' + d.text + '"><b>' + d.name + '</b><span>' + b.n + ' / ' + d.n + '</span></div>'; });
      $('#rhBounties').innerHTML = s ? '<div class="rh-bhead">Bounties</div>' + s : '';
    }
    function hudCheck(n) { $('#rhCheck').classList.toggle('on', n > 0 && !ui.over); $('#rhCheck').textContent = n > 1 ? 'Check, ' + n + ' attackers' : 'Check'; }
    function hudAll() { hudHearts(); hudForms(); hudTop(); hudXp(); hudWarmth(); hudBounties(); var hb = $('[data-act=hearth]'); if (hb) hb.disabled = !Rm.hearthReady(S); }
    function message(t) { var box = $('#rhMsgs'), d = document.createElement('div'); d.textContent = t; box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild); setTimeout(function () { d.classList.add('out'); setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 600); }, 3600); }
    function banner(title, sub) { var b = $('#rhBanner'); b.querySelector('b').textContent = title; b.querySelector('span').textContent = sub || ''; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
    function showText(t) { var box = $('#rhText'); box.querySelector('p').textContent = t; box.classList.add('on'); }
    $('#rhText button').onclick = function () { $('#rhText').classList.remove('on'); };
    function fade(to, ms) { var f = $('#rhFade'); f.style.transition = 'opacity ' + ms + 'ms'; f.style.opacity = to; }
    $('#rhHelp button').onclick = function () { ui.help = false; $('#rhHelp').classList.remove('on'); };
    hudActs();
    if (touch) hud.querySelectorAll('[data-d]').forEach(function (b) { b.onpointerdown = function (ev) { ev.preventDefault(); ev.stopPropagation(); var d = b.dataset.d.split(',').map(Number); padStep(d); }; });
    function act(k) {
      if (k === 'wait') doWait();
      else if (k === 'cam') { ui.firstPerson = !ui.firstPerson; player.visible = !ui.firstPerson; message(ui.firstPerson ? 'Through the King\'s eyes.' : 'Behind the King.'); }
      else if (k === 'map') { ui.map = !ui.map; $('#rhMap').classList.toggle('on', ui.map); if (ui.map) { $('#rhMapTitle').textContent = S.world.kindName + ', rank ' + S.rank + (S.world.mods.length ? ': ' + S.world.mods.map(function (m) { return SK.MODIFIERS.filter(function (x) { return x.id === m; })[0].name; }).join(', ') : ''); drawMap($('#rhMapCv'), 960, true); } }
      else if (k === 'help') { ui.help = !ui.help; $('#rhHelp').classList.toggle('on', ui.help); }
      else if (k === 'skills') { ui.skills = !ui.skills; $('#rhSkills').classList.toggle('on', ui.skills); $('[data-act=skills]').classList.remove('pulse'); if (ui.skills) renderSkills(); }
      else if (k === 'transmute') { if (ui.transmute) { ui.transmute = null; message('Transmute: never mind.'); } else { ui.transmute = { from: null }; message('Transmute: pick the kind to give three of.'); } hud.querySelector('#rhForms').classList.toggle('transmute', !!ui.transmute); }
      else if (k === 'hearth') { if (!mayAct()) return; var ev = Rm.hearthstone(S); if (!ev) { message('Hearthstone is not ready.'); return; } afterTurn(ev); }
      else if (k === 'exit') { hooks.exit(); }
    }
    function pickTransmute(t) {
      if (t === 'K') return;
      if (!ui.transmute.from) { if (!(S.p.ess[t] >= 3)) { message('You need three ' + NAME[t].toLowerCase() + ' essence to give.'); return; } ui.transmute.from = t; message('Three ' + NAME[t].toLowerCase() + ' essence into two of which kind?'); return; }
      if (Rm.transmute(S, ui.transmute.from, t)) { hooks.snd('gold'); puff(S.p.x, S.p.y, essCol[t], 12); message('Transmuted: two ' + NAME[t].toLowerCase() + ' essence.'); hooks.save(); } else message('That does not transmute.');
      ui.transmute = null; hud.querySelector('#rhForms').classList.remove('transmute'); hudForms(); refreshMarks();
    }
    function setForm(t) {
      if (t !== 'K' && !(S.p.ess[t] >= Rm.formCost(S, t))) { message(S.p.ess[t] > 0 ? 'Frozen: a form costs two essence.' : 'No ' + NAME[t].toLowerCase() + ' essence. Take a ' + NAME[t].toLowerCase() + ' to get some.'); return; }
      ui.form = t; S.p.form = t; hudForms(); refreshMarks(); hooks.snd('pb:flick');
    }
    /* the skill tree: three columns, a node a button; the chosen one tells what it does and takes a point */
    function renderSkills() {
      var box = $('#rhSkills'), xp = S.meta.xp || 0, lvl = SK.levelOf(xp), pts = SK.pointsLeft(S.meta);
      var onShrine = S.world.k[Rm.idx(S.p.x, S.p.y)] === KD.shrine;
      var s = '<div class="rh-skhead"><h3>The Skill Tree</h3><div>Level ' + lvl + ', ' + xp + ' experience, ' + (SK.xpFor(lvl + 1) - xp) + ' to the next. <b>' + pts + (pts === 1 ? ' point' : ' points') + '</b> to spend.</div><button class="rh-x" data-sk="close">Close</button></div><div class="rh-skcols">';
      Object.keys(SK.BRANCHES).forEach(function (br) {
        s += '<div class="rh-skcol ' + br + '"><h4>' + SK.BRANCHES[br] + '</h4>';
        SK.SKILLS.filter(function (k) { return k.branch === br; }).forEach(function (k) {
          var r = SK.rank(S.meta, k.id), can = SK.canTake(S.meta, k.id), st = r >= k.max ? 'full' : r > 0 ? 'on' : can ? 'can' : 'off';
          s += '<button class="rh-node ' + st + (ui.sel === k.id ? ' sel' : '') + '" data-sk="' + k.id + '" style="--tier:' + k.tier + '"><b>' + k.name + '</b><span>' + r + ' / ' + k.max + '</span></button>';
        });
        s += '</div>';
      });
      s += '</div><div class="rh-skfoot" id="rhSkFoot">';
      if (ui.sel) { var k = SK.skill(ui.sel), r2 = SK.rank(S.meta, k.id); s += '<b>' + k.name + '</b> <span class="rh-skbr">' + SK.BRANCHES[k.branch] + ', tier ' + k.tier + '</span><p>' + k.text + '</p>' + (k.needs && !SK.rank(S.meta, k.needs) ? '<p class="rh-sknote">Needs ' + SK.skill(k.needs).name + ' first.</p>' : '') + (SK.canTake(S.meta, k.id) ? '<button class="btn green" data-sk="take">Take' + (r2 ? ' again' : '') + '</button>' : r2 >= k.max ? '<p class="rh-sknote">Taken in full.</p>' : pts <= 0 ? '<p class="rh-sknote">No points left: take more pieces.</p>' : ''); }
      else s += '<p>Pick a skill to read what it does. Skills stay with you from world to world.</p>';
      s += '<button class="btn rh-reset" data-sk="reset" ' + (onShrine && SK.spent(S.meta) ? '' : 'disabled') + ' title="At a shrine, every point can be placed again">Reset at this shrine</button></div>';
      box.innerHTML = s;
      box.querySelectorAll('[data-sk]').forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); var id = b.dataset.sk; if (id === 'close') act('skills'); else if (id === 'take') { if (Rm.takeSkill(S, ui.sel)) { hooks.snd('promo'); burst(S.p.x, S.p.y, 'w', 12, false, 0xffe070); hudAll(); hudActs(); refreshMarks(); hooks.save(); renderSkills(); } } else if (id === 'reset') { SK.resetSkills(S.meta); S.p.maxHearts = Math.max(3, S.p.maxHearts - 0); hudAll(); hooks.save(); renderSkills(); message('Every point is free again.'); } else { ui.sel = id; renderSkills(); } }; });
    }
    var curMood = null;
    function regionMood() { var reg = Rm.regionAt(S, S.p.x, S.p.y); return S.arena ? 'boss' : reg.mood; }
    function musicCheck() { var m = regionMood(); if (m !== curMood) { curMood = m; hooks.music(m); } }
    var lastRegion = -1;
    function regionCheck() {
      var r = Rm.regionOf(S.p.x, S.p.y);
      if (r !== lastRegion) { var reg = S.world.regions[r]; if (lastRegion >= 0 || S.turn > 0) banner(reg.name, reg.line); lastRegion = r; hudTop(); fx2.setMood({ hot: !!reg.hot, woods: /woods|pines|meadow|palms|roots|tundra/.test(reg.biome) }); }
      musicCheck();
    }
    /* the map */
    function drawMap(cv, size, full) {
      var g = cv.getContext('2d'), span = full ? W : 28, cxp = full ? W / 2 : S.p.x + 0.5, cyp = full ? H / 2 : S.p.y + 0.5, s = size / span;
      g.fillStyle = '#0d0b10'; g.fillRect(0, 0, size, size);
      var x0 = Math.max(0, Math.floor(cxp - span / 2)), y0 = Math.max(0, Math.floor(cyp - span / 2)), x1 = Math.min(W, Math.ceil(cxp + span / 2)), y1 = Math.min(H, Math.ceil(cyp + span / 2));
      var px = function (x) { return (x - (cxp - span / 2)) * s; }, py = function (y) { return size - (y - (cyp - span / 2)) * s - s; };
      var seen = function (x, y) { return S.explored[Rm.chunkKey(x, y)]; };
      for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
        if (!seen(x, y)) continue;
        var i = Rm.idx(x, y), kk = w.k[i], c = groundColor(x, y);
        if (kk === KD.tree) c = 0x234a2a; else if (kk === KD.rock || kk === KD.pillar) c = 0x8a867c; else if (kk === KD.monolith) c = 0x4a3a6a; else if (kk === KD.water) c = 0x2d6a8a; else if (kk === KD.lava) c = 0xe0561a; else if (kk === KD.gate) c = 0x3b3b44; else if (kk === KD.tent) c = 0x7a5a3a;
        var shade = 0.75 + w.h[i] * 0.09;
        g.fillStyle = 'rgb(' + Math.round(((c >> 16) & 255) * shade) + ',' + Math.round(((c >> 8) & 255) * shade) + ',' + Math.round((c & 255) * shade) + ')';
        g.fillRect(px(x), py(y), Math.ceil(s), Math.ceil(s));
      }
      var dot = function (x, y, col, r) { g.fillStyle = col; g.beginPath(); g.arc(px(x) + s / 2, py(y) + s / 2, r, 0, 7); g.fill(); };
      var ring = function (x, y, col, r) { g.strokeStyle = col; g.lineWidth = Math.max(1, s * 0.15); g.beginPath(); g.arc(px(x) + s / 2, py(y) + s / 2, r, 0, 7); g.stroke(); };
      // patrol routes, with the Scout's Eye
      if (Rm.sk(S, 'scout')) { g.setLineDash([s * 0.5, s * 0.5]); g.lineWidth = Math.max(1, s * 0.12); S.ents.forEach(function (e) { if (e.dead || !e.patrol || !seen(e.x, e.y)) return; g.strokeStyle = 'rgba(255,120,90,0.55)'; g.beginPath(); e.patrol.route.forEach(function (p, j) { if (j === 0) g.moveTo(px(p[0]) + s / 2, py(p[1]) + s / 2); else g.lineTo(px(p[0]) + s / 2, py(p[1]) + s / 2); }); g.stroke(); }); g.setLineDash([]); }
      Object.keys(w.objs).forEach(function (k2) { var o = w.objs[k2]; if (!seen(o.x, o.y)) return; if (o.kind === 'shrine') dot(o.x, o.y, '#6ad0ff', Math.max(2, s * 0.6)); else if (o.kind === 'portal') dot(o.x, o.y, '#4ad0ff', Math.max(1.5, s * 0.4)); else if (o.kind === 'chest' && !S.used[k2]) dot(o.x, o.y, '#f0c050', Math.max(1.5, s * 0.4)); else if (o.kind === 'cage' && !S.used[k2]) dot(o.x, o.y, '#ffffff', Math.max(1.5, s * 0.4)); else if (o.kind === 'campfire') { var mine = !o.camp || (S.camps[o.camp] && S.camps[o.camp].cleared); dot(o.x, o.y, mine ? '#70e070' : '#ff9a30', Math.max(2, s * 0.55)); if (full) ring(o.x, o.y, mine ? 'rgba(112,224,112,0.6)' : 'rgba(255,154,48,0.6)', s * 1.4); } else if (o.kind === 'torch') dot(o.x, o.y, '#ffd080', Math.max(1, s * 0.25)); });
      Object.keys(w.castles).forEach(function (k3) { var c = w.castles[k3]; if (!seen(c.x, c.y)) return; g.strokeStyle = '#b080ff'; g.lineWidth = full ? 2.5 : 1.5; var rad = c.court ? 10 : 5; g.strokeRect(px(c.x - rad), py(c.y + rad), rad * 2 * s, rad * 2 * s); });
      if (full) {
        g.font = '600 ' + Math.round(size / 44) + 'px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (var r = 0; r < 9; r++) {
          var rcx = (r % 3) * 32 + 16, rcy = Math.floor(r / 3) * 32 + 16, any = false;
          for (var sy = 4; sy < 32 && !any; sy += 8) for (var sx = 4; sx < 32 && !any; sx += 8) if (seen((r % 3) * 32 + sx, Math.floor(r / 3) * 32 + sy)) any = true;
          if (!any) continue;
          var nm = w.regions[r].name.toUpperCase();
          g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(nm, px(rcx), py(rcy) - size / 20); g.fillStyle = 'rgba(243,230,196,0.92)'; g.fillText(nm, px(rcx), py(rcy) - size / 20);
        }
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; for (var gi = 1; gi < 3; gi++) { g.beginPath(); g.moveTo(px(gi * 32), 0); g.lineTo(px(gi * 32), size); g.moveTo(0, py(gi * 32) + s); g.lineTo(size, py(gi * 32) + s); g.stroke(); }
      }
      var hunter = Rm.sk(S, 'hunter'), wantT = {};
      if (hunter) S.bounties.forEach(function (b) { if (b.done) return; var d = SK.bounty(b.id); if (d.kind === 'kill') wantT[d.t] = true; });
      S.ents.forEach(function (e) { if (e.dead || !seen(e.x, e.y)) return; if (!full && Rm.dist(e.x, e.y, S.p.x, S.p.y) > span / 2) return; dot(e.x, e.y, e.warden || e.grand ? '#ff50d0' : e.captain ? '#ff8a40' : '#ff4a3a', Math.max(1.5, s * (e.warden || e.grand ? 0.55 : e.captain ? 0.45 : 0.35))); if (hunter && (wantT[e.t] || e.captain === 'raid')) ring(e.x, e.y, '#ffe070', s * 0.9); });
      S.allies.forEach(function (a) { dot(a.x, a.y, '#ffffff', Math.max(1.5, s * 0.35)); });
      if (S.shrine) ring(S.shrine[0], S.shrine[1], '#ffffff', s * 0.8);
      dot(S.p.x, S.p.y, '#ffd040', Math.max(2.5, s * 0.5));
    }
    function ending() {
      var b = $('#rhEnd'), nextKind = Gn.KINDS[Gn.kindForRank(S.rank + 1)];
      b.innerHTML = '<div class="rh-endbox"><h2>' + S.world.courtName + '</h2><p>' + (S.rank === 1 ? 'The Grand Queen falls. Every crown she carried east is yours to carry on.' : 'Another queen falls. The board goes on.') + '</p><p class="rh-stats">Rank ' + S.rank + ': ' + S.turn + ' moves, ' + S.p.kills + ' pieces taken, ' + S.p.deaths + (S.p.deaths === 1 ? ' fall' : ' falls') + ', ' + S.stats.camps + ' camps, level ' + SK.levelOf(S.meta.xp) + '.</p><div class="gm-row"><button class="btn green" data-end="next">Rank ' + (S.rank + 1) + ': ' + nextKind.name + '</button><button class="btn" data-end="roam">Keep walking this world</button></div></div>';
      b.classList.add('on');
      hooks.music('court');
      b.querySelectorAll('[data-end]').forEach(function (x) { x.onclick = function () { b.classList.remove('on'); if (x.dataset.end === 'next') hooks.nextRank(); else { ui.over = false; refreshMarks(); } }; });
    }

    /* ---------- input ---------- */
    var ray = new T3.Raycaster(), ptr = { down: false, x: 0, y: 0, moved: false, id: null, pinch: 0 };
    function tileFromEvent(ev) {
      var rc = cv.getBoundingClientRect(), nx = ((ev.clientX - rc.left) / rc.width) * 2 - 1, ny = -((ev.clientY - rc.top) / rc.height) * 2 + 1;
      ray.setFromCamera({ x: nx, y: ny }, camera);
      var bodies = Object.keys(pieces).map(function (id) { return pieces[id].userData.body; });
      var ph = ray.intersectObjects(bodies, false)[0];
      if (ph) { var pe = ph.object.parent && ph.object.parent.userData.e; if (pe) return Rm.idx(pe.x, pe.y); }
      var hit = ray.intersectObject(ground, false)[0];
      if (!hit) return -1;
      return hit.instanceId != null ? hit.instanceId : -1;
    }
    cv.addEventListener('pointerdown', function (ev) { if (ev.button === 2) ptr.rmb = true; ptr.down = true; ptr.moved = false; ptr.x = ev.clientX; ptr.y = ev.clientY; ptr.id = ev.pointerId; try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic */ } });
    cv.addEventListener('pointermove', function (ev) {
      if (ptr.down && ev.pointerId === ptr.id) {
        var dx = ev.clientX - ptr.x, dy = ev.clientY - ptr.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) ptr.moved = true;
        if (ptr.moved) { ui.yaw -= dx * 0.006; ui.pitch = Math.max(0.08, Math.min(1.45, ui.pitch + dy * 0.004)); ptr.x = ev.clientX; ptr.y = ev.clientY; }
      } else if (!touch) {
        var t = tileFromEvent(ev);
        if (t !== ui.hover) { ui.hover = t; hoverMark(); }
      }
    });
    cv.addEventListener('pointerup', function (ev) {
      if (!ptr.down) return;
      ptr.down = false;
      if (!ptr.moved && !ptr.rmb) { var t = tileFromEvent(ev); if (t >= 0) clickTile(t); }
      ptr.rmb = false;
    });
    cv.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    cv.addEventListener('wheel', function (ev) { ev.preventDefault(); ui.dist = Math.max(1.6, Math.min(28, ui.dist * (1 + ev.deltaY * 0.0016))); }, { passive: false });
    cv.addEventListener('touchmove', function (ev) { if (ev.touches.length === 2) { var d = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY); if (ptr.pinch) ui.dist = Math.max(1.6, Math.min(28, ui.dist * ptr.pinch / d)); ptr.pinch = d; ptr.moved = true; ev.preventDefault(); } }, { passive: false });
    cv.addEventListener('touchend', function () { ptr.pinch = 0; });
    function hoverMark() {
      if (ui.hover < 0 || !mayAct()) { hover.visible = false; return; }
      var x = ui.hover % W, y = Math.floor(ui.hover / W);
      hover.position.set(x + 0.5, topY(x, y) + 0.02, y + 0.5);
      hover.visible = true;
      var legal = ui.legal.some(function (m) { return m.x === x && m.y === y; });
      hover.material.color.setHex(legal ? 0xfff0b0 : 0x806050);
    }
    function clickTile(i) {
      if (!mayAct()) return;
      var x = i % W, y = Math.floor(i / W);
      var m = ui.legal.filter(function (mm) { return mm.x === x && mm.y === y; })[0];
      if (m) { doMove(x, y); return; }
      var forms = ['N', 'B', 'R', 'Q'].filter(function (t) { return Rm.playerMoves(S, t).some(function (mm) { return mm.x === x && mm.y === y; }); });
      if (forms.length) { message('A ' + NAME[forms[0]].toLowerCase() + ' could go there: pick the form first.'); return; }
      var o = Rm.at(S, x, y);
      if (o && o.side === 'b') message((o.name || 'A ' + NAME[o.t].toLowerCase()) + (o.elite ? ', a veteran' : '') + (o.warden || o.grand ? ', ' + o.hp + ' crowns' : o.hp > 1 ? ', ' + o.hp + ' blows' : '') + (o.stun ? ', reeling.' : o.awake ? ', hunting you.' : o.patrol ? ', on patrol.' : ', asleep.'));
      else { var kk = w.k[i]; if (kk === KD.shrine) message('A shrine: heals and keeps your way back.'); else if (kk === KD.cage) message('A cage: step onto it to free who is inside.'); else if (kk === KD.chest) message(w.objs[i] && w.objs[i].gift === 'camp' ? 'A camp\'s chest: it opens once the captain has fallen.' : 'A chest: step onto it.'); else if (kk === KD.portal) message('A portal: it leads to its twin.'); else if (kk === KD.promo) message('The golden column: an enemy pawn that reaches it becomes a queen.'); else if (kk === KD.gate) message('The gate of the court: ' + Rm.SHARDS_NEEDED + ' crown shards open it.'); else if (kk === KD.monolith) message('A monolith. Step next to it.'); else if (kk === KD.campfire) message(w.objs[i] && w.objs[i].camp && !(S.camps[w.objs[i].camp] && S.camps[w.objs[i].camp].cleared) ? 'An enemy camp\'s fire. Warm, but take the captain first.' : 'A fire: warmth, and rest when you wait by it.'); else if (kk === KD.ice) message('Ice: a step onto it slides to its end.'); else if (kk === KD.torch) message('A torch: warmth within two squares.'); else if (kk === KD.spring) message('A hot spring: warmth, and rest when you wait in it.'); else if (kk === KD.tent) message('A tent.'); }
    }
    function doMove(x, y) {
      var ev = Rm.play(S, x, y, ui.form);
      if (!ev) return;
      afterTurn(ev);
    }
    function doWait() {
      if (!mayAct()) return;
      var ev = Rm.wait(S);
      if (!ev) return;
      hooks.snd('pb:flick');
      afterTurn(ev);
    }
    var lastTurn = null;
    function afterTurn(ev) {
      if (ui.busy) flush();
      ui.busy = true; ui.canAct = false; hover.visible = false;
      if (ui.form !== 'K' && !(S.p.ess[ui.form] >= Rm.formCost(S, ui.form))) { ui.form = 'K'; S.p.form = 'K'; }
      hudAll();
      refreshThreats(); refreshMarks();
      var my = lastTurn = playEvents(ev);
      my.then(function () {
        if (my !== lastTurn) return;
        ui.busy = false; ui.canAct = false;
        setPlayerForm('K');
        place(player, S.p.x, S.p.y);
        S.allies.forEach(function (a) { if (pieces[a.id]) place(pieces[a.id], a.x, a.y); });
        Object.keys(pieces).forEach(function (id) { var g = pieces[id], e = g.userData.e; if (e && !e.dead && S.allies.indexOf(e) < 0 && !tweens.some(function (t) { return t.g === g; })) place(g, e.x, e.y); });
        refreshThreats(); refreshMarks(); hudAll(); regionCheck();
        if (ui.skills) renderSkills();
        hooks.save();
      });
    }
    var mayAct = function () { return !ui.over && (!ui.busy || ui.canAct); };
    var KEYMAP = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, 1], s: [0, -1], a: [-1, 0], d: [1, 0], W: [0, 1], S: [0, -1], A: [-1, 0], D: [1, 0] };
    function onKey(ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var k = ev.key;
      if (k === 'Escape') { if (ui.help) { act('help'); return; } if (ui.map) { act('map'); return; } if (ui.skills) { act('skills'); return; } if ($('#rhText').classList.contains('on')) { $('#rhText').classList.remove('on'); return; } hooks.exit(); ev.preventDefault(); return; }
      if (k === ' ') { ev.preventDefault(); doWait(); return; }
      if (k === 'v' || k === 'V') { act('cam'); return; }
      if (k === 'm' || k === 'M') { act('map'); return; }
      if (k === 'k' || k === 'K') { act('skills'); return; }
      if (k === 'h' || k === 'H' || k === '?') { act('help'); return; }
      if (k === 'q' || k === 'Q') { ui.yaw += 0.35; return; }
      if (k === 'e' || k === 'E') { ui.yaw -= 0.35; return; }
      if (/^[1-5]$/.test(k)) { setForm(['K', 'N', 'B', 'R', 'Q'][+k - 1]); return; }
      var d = KEYMAP[k];
      if (!d) return;
      ev.preventDefault();
      if (ev.repeat) return;
      held[k] = d;
      clearTimeout(gatherT); gatherT = setTimeout(function () { keyStep(); }, 130);
    }
    var gatherT = 0;
    var held = {}, lastStep = 0, heldSince = 0;
    // the pad on a phone: one step in the direction pressed, relative to the camera like the keys
    function padStep(d) { if (!mayAct()) return; stepDir(d); }
    function keyStep() {
      if (!mayAct()) return false;
      var d = [0, 0];
      Object.keys(held).forEach(function (k) { d[0] += held[k][0]; d[1] += held[k][1]; });
      if (!d[0] && !d[1]) return false;
      lastStep = ui.time;
      return stepDir(d);
    }
    function stepDir(d) {
      var fv = faceVec(), dx = Math.round(d[1] * fv[0] + d[0] * fv[1]), dz = Math.round(d[1] * fv[1] - d[0] * fv[0]);
      dx = Math.max(-1, Math.min(1, dx)); dz = Math.max(-1, Math.min(1, dz));
      if (!dx && !dz) return false;
      var tx = S.p.x + dx, ty = S.p.y + dz;
      if (ui.form !== 'K') { var mm = ui.legal.filter(function (m) { return m.x === tx && m.y === ty; })[0]; if (mm) { doMove(tx, ty); return true; } }
      // a King's step, or the slide it turns into on ice: the move that starts in that direction
      var km = Rm.playerMoves(S, 'K').filter(function (m) { return (m.x === tx && m.y === ty) || (m.slide && m.path.length && m.path[0][0] === tx && m.path[0][1] === ty); })[0];
      if (km) { kingStep(km.x, km.y); return true; }
      if (!dx || !dz) {
        var sides = dx ? [[dx, 1], [dx, -1]] : [[1, dz], [-1, dz]];
        for (var si = 0; si < sides.length; si++) {
          var sx = S.p.x + sides[si][0], sy = S.p.y + sides[si][1], foe = Rm.at(S, sx, sy);
          if (foe && foe.side === 'b' && Rm.playerMoves(S, 'K').some(function (m) { return m.x === sx && m.y === sy; })) { kingStep(sx, sy); return true; }
        }
      }
      hooks.snd('wrong');
      return false;
    }
    function kingStep(tx, ty) { var f0 = ui.form; ui.form = 'K'; var ev2 = Rm.play(S, tx, ty, 'K'); ui.form = f0 !== 'K' && S.p.ess[f0] >= Rm.formCost(S, f0) ? f0 : 'K'; S.p.form = ui.form; if (ev2) afterTurn(ev2); }
    function onKeyUp(ev) { if (KEYMAP[ev.key]) delete held[ev.key]; }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () { held = {}; });

    /* ---------- the frame ---------- */
    var clock = { last: performance.now() }, camPos = new T3.Vector3(), camLook = new T3.Vector3(), raf = 0, running = true, radarT = 0;
    var nightNow = 0;
    function dayNight(dt) {
      var elev = Rm.dayElev(S), f = ((S.turn + 36) % 240) / 240, ang = f * Math.PI * 2, night = Math.max(0, -elev), dusk = Math.max(0, 1 - Math.abs(elev) * 3);
      nightNow = night;
      var reg = Rm.regionAt(S, S.p.x, S.p.y), b = BIO[reg.biome];
      sun.position.set(player.position.x + Math.cos(ang) * 20, player.position.y + Math.max(0.2, elev) * 24 + 2, player.position.z + 10);
      sun.target.position.copy(player.position);
      sun.intensity = (1.35 * Math.max(0.1, elev) + 0.1) * (dim ? 0.35 : 1);
      sun.color.setHex(w.cold ? 0xeaf2ff : 0xfff1d6).lerp(new T3.Color(0xff9a5a), dusk * 0.8).lerp(new T3.Color(0x6a7aa8), night);
      hemi.intensity = (0.75 - night * 0.45) * (dim ? 0.45 : 1);
      fill.position.set(player.position.x - Math.cos(ang) * 16, player.position.y + 9, player.position.z - 12); fill.target.position.copy(player.position); fill.intensity = (0.55 - night * 0.2) * (dim ? 0.5 : 1);
      var top = new T3.Color(w.cold ? 0x4a78b0 : 0x3a6fa8).lerp(new T3.Color(0x6a3a5a), dusk * 0.6).lerp(new T3.Color(0x070a16), night);
      var bot = new T3.Color(w.cold ? 0xdfe8f0 : 0xcfdce8).lerp(new T3.Color(0xf0a070), dusk * 0.7).lerp(new T3.Color(0x151a2c), night);
      if (b.hot) { top.lerp(new T3.Color(0x3a2020), 0.6); bot.lerp(new T3.Color(0x6a3a2a), 0.6); }
      if (reg.biome === 'court' || reg.biome === 'icecourt' || reg.biome === 'seacourt') { top.lerp(new T3.Color(0x2a1a4a), 0.6); bot.lerp(new T3.Color(0x6a4a8a), 0.5); }
      if (dim) { top.lerp(new T3.Color(0x08080c), 0.85); bot.lerp(new T3.Color(0x1a1618), 0.85); }
      if (S.weather.kind === 'blizzard') { top.lerp(new T3.Color(0xb8c4d0), 0.7); bot.lerp(new T3.Color(0xd8e0e8), 0.7); }
      else if (S.weather.kind === 'rain') { top.lerp(new T3.Color(0x5a6a7a), 0.6); bot.lerp(new T3.Color(0x8a94a0), 0.5); }
      skyMat.uniforms.top.value.copy(top); skyMat.uniforms.bot.value.copy(bot);
      skyMat.uniforms.sunDir.value.set(Math.cos(ang), Math.max(-0.2, elev), 0.5).normalize();
      skyMat.uniforms.sunAmt.value = dim ? 0 : (1 - night) * (S.weather.kind === 'clear' ? 1 : 0.3);
      scene.fog.color.copy(bot);
      var fogK = S.weather.kind === 'blizzard' ? 0.35 : dim ? 0.45 : S.weather.kind === 'rain' ? 0.7 : 1;
      scene.fog.near = (12 + ui.dist * 1.6) * fogK; scene.fog.far = (44 + ui.dist * 4.5) * fogK;
      stars.material.opacity = night * (dim ? 0 : 0.9) * (S.weather.kind === 'clear' ? 1 : 0.2);
      lavaMat.emissiveIntensity = 1.0 + Math.sin(ui.time * 2) * 0.25;
      iceMat.emissiveIntensity = 0.1 + night * 0.25;
      TEX.water.offset.set(ui.time * 0.02, Math.sin(ui.time * 0.5) * 0.02); TEX.lava.offset.set(ui.time * 0.006, ui.time * 0.004);
      sunSprite.position.copy(sky.position).addScaledVector(new T3.Vector3(Math.cos(ang), Math.max(-0.2, elev), -0.5).normalize(), 90);
      sunSprite.material.opacity = dim ? 0 : Math.max(0, Math.min(1, elev * 3 + 0.3)) * (S.weather.kind === 'clear' ? 1 : 0.2);
      var low = Math.max(0, 1 - Math.abs(elev) * 4) * (dim || S.weather.kind !== 'clear' ? 0 : 1);
      rays.forEach(function (r0, i) { r0.position.copy(sunSprite.position); r0.material.opacity = 0.18 * low; r0.material.rotation = i * 1.1 + ui.time * 0.05; });
      clouds.forEach(function (c) { c.position.x += c.userData.v * dt; if (c.position.x > 130) c.position.x = -34; c.material.opacity = (dim ? 0 : 0.42) * (1 - night * 0.6); });
    }
    function frame(now) {
      raf = 0;
      if (!running) return;
      var dt = Math.min(0.05, (now - clock.last) / 1000) * ui.scale; clock.last = now;
      update(dt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    function update(dt) {
      ui.time += dt;
      updateTweens(dt); updateFx(dt);
      Object.keys(things).forEach(function (k) { var g = things[k]; if (g.userData.gem) { g.userData.gem.rotation.y += dt * 1.5; g.userData.gem.position.y = 0.7 + Math.sin(ui.time * 2 + +k) * 0.08; } if (g.userData.beam && g.userData.beam.material.opacity > 0.22) g.userData.beam.material.opacity -= dt * 0.3; if (g.userData.ring) { g.userData.ring.rotation.z += dt * 0.8; g.userData.disc.rotation.z -= dt * 1.2; g.userData.ring.lookAt(camera.position.x, 0.55, camera.position.z); g.userData.disc.quaternion.copy(g.userData.ring.quaternion); } if (g.userData.banner) g.userData.banner.userData.flag.rotation.y = Math.sin(ui.time * 3 + +k) * 0.25; });
      Object.keys(pieces).forEach(function (id) { var g = pieces[id]; if (g.userData.crowns) g.userData.crowns.forEach(function (c) { c.rotation.z += dt * c.userData.spin; }); if (g.userData.stunRing && g.userData.stunRing.visible) g.userData.stunRing.rotation.z += dt * 4; });
      if (!tweens.some(function (t) { return t.g === player; }) && face.hop <= 0) player.position.y = topY(S.p.x, S.p.y) + Math.sin(ui.time * 2.2) * 0.02;
      updateFacing(dt);
      if (mayAct() && Object.keys(held).length && ui.time - lastStep > (heldSince < 0.3 ? 0.3 : 0.13)) keyStep();
      if (Object.keys(held).length) heldSince += dt; else heldSince = 0;
      hover.material.opacity = 0.6 + Math.sin(ui.time * 6) * 0.3;
      moveMarks.material.opacity = 0.45 + Math.sin(ui.time * 4) * 0.12;
      threatLines.material.opacity = 0.65 + Math.sin(ui.time * 9) * 0.25;
      var tx = player.position.x, ty = player.position.y, tz = -player.position.z, fxx = Math.sin(ui.yaw), fz = -Math.cos(ui.yaw);
      if (ui.firstPerson) {
        camPos.set(tx, ty + 0.95, tz);
        camLook.set(tx + fxx * 4, ty + 0.95 - (ui.pitch - 0.42) * 3, tz + fz * 4);
      } else {
        var d = ui.dist, hgt = 0.6 + ui.pitch * d * 0.9;
        camPos.set(tx - fxx * d, ty + hgt, tz - fz * d);
        camLook.set(tx, ty + 0.5, tz);
      }
      if (ui.shake > 0) { camPos.x += (Math.random() - 0.5) * ui.shake * 0.25; camPos.y += (Math.random() - 0.5) * ui.shake * 0.25; ui.shake = Math.max(0, ui.shake - dt * 1.6); }
      camera.position.lerp(camPos, Math.min(1, dt * 9));
      camera.lookAt(camLook);
      sky.position.set(camera.position.x, camera.position.y, -camera.position.z);
      stars.position.copy(sky.position);
      dayNight(dt);
      fx2.update(dt, { x: S.p.x, y: S.p.y, h: player.position.y }, nightNow);
      lightT += dt; if (lightT > 0.3) { lightT = 0; budgetLights(); }
      copyLights();
      updateLabels(dt);
      var rdt = dt / ui.scale;
      if (ui.flash > 0) { ui.flash = Math.max(0, ui.flash - rdt * 1.6); $('#rhFlash').style.opacity = ui.flash * 0.6; }
      if (ui.hurt > 0) { ui.hurt = Math.max(0, ui.hurt - rdt * 1.1); cv.style.filter = ui.hurt > 0 ? 'saturate(' + (1 - ui.hurt * 0.75).toFixed(2) + ') contrast(' + (1 + ui.hurt * 0.3).toFixed(2) + ') brightness(' + (1 - ui.hurt * 0.12).toFixed(2) + ')' : ''; }
      if (ui.cold > 0) { ui.cold = Math.max(0, ui.cold - rdt * 1.2); cv.style.filter = 'saturate(' + (1 - ui.cold * 0.6).toFixed(2) + ') brightness(' + (1 + ui.cold * 0.3).toFixed(2) + ')'; if (ui.cold <= 0 && ui.hurt <= 0) cv.style.filter = ''; }
      radarT += dt; if (radarT > 0.25) { radarT = 0; drawMap($('#rhRadar'), 170, false); if (ui.map) drawMap($('#rhMapCv'), 960, true); }
    }
    function resize() {
      var rw = el.clientWidth, rh = el.clientHeight;
      if (!rw || !rh) return;
      renderer.setSize(rw, rh, false);
      camera.aspect = rw / rh; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();
    hudAll(); refreshThreats(); refreshMarks(); regionCheck();
    if (S.turn === 0) { ui.help = true; $('#rhHelp').classList.add('on'); banner(S.world.kindName, 'Rank ' + S.rank + (S.world.mods.length ? '. ' + S.world.mods.map(function (m) { return SK.MODIFIERS.filter(function (x) { return x.id === m; })[0].name; }).join(', ') + '.' : '.')); }
    raf = requestAnimationFrame(frame);
    var onVis = function () { if (!document.hidden && running && !raf) { clock.last = performance.now(); raf = requestAnimationFrame(frame); } };
    document.addEventListener('visibilitychange', onVis);

    return {
      close: function () { running = false; if (raf) cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); renderer.dispose(); el.innerHTML = ''; },
      step: function (dt) { update(dt); renderer.render(scene, camera); },
      move: doMove, wait: doWait, form: setForm, act: act, ui: ui, scene: scene, camera: camera, renderer: renderer, player: player, tweens: tweens, fx: fx, render: function () { frame(performance.now()); }
    };
  }
  root.RealmView = { open: open };
})(typeof self !== 'undefined' ? self : this);
