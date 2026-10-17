/* The Ninth Rank: the living light and weather (three.js). Fires with flicker and smoke, torches, steaming springs,
   snow and blizzards, rain, embers over the hot lands, fireflies at night, the aurora over the cold worlds, and the
   frost that creeps over the ground round a freezing King. RealmFX.create(ctx) returns { fire, torch, spring,
   setWeather, setMood, update }. Everything sits in board space (x, height, y) like the rest of the scene. */
(function (root) {
  'use strict';
  function create(ctx) {
    var T3 = ctx.T3, scene = ctx.scene, topY = ctx.topY, level = ctx.level || 'full', toon = ctx.toon || function (o) { return new T3.MeshStandardMaterial(o); };
    var budget = level === 'full' ? 1 : level === 'balanced' ? 0.55 : 0.3;
    var time = 0, fires = [], emitters = [], puffs = [];
    var V = new T3.Vector3();

    /* ---------- textures ---------- */
    function tex(size, draw) { var c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); var t = new T3.CanvasTexture(c); return t; }
    var dotTex = tex(32, function (g, n) { var gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); });
    var streakTex = tex(32, function (g, n) { var gr = g.createLinearGradient(0, 0, 0, n); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(n * 0.42, 0, n * 0.16, n); });
    var flameTex = tex(64, function (g, n) { g.clearRect(0, 0, n, n); var gr = g.createRadialGradient(n / 2, n * 0.62, 2, n / 2, n * 0.55, n * 0.45); gr.addColorStop(0, 'rgba(255,250,200,1)'); gr.addColorStop(0.35, 'rgba(255,180,60,0.95)'); gr.addColorStop(0.7, 'rgba(230,80,20,0.6)'); gr.addColorStop(1, 'rgba(200,40,10,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(n / 2, 2); g.bezierCurveTo(n * 0.95, n * 0.45, n * 0.85, n * 0.95, n / 2, n * 0.98); g.bezierCurveTo(n * 0.15, n * 0.95, n * 0.05, n * 0.45, n / 2, 2); g.fill(); });

    /* ---------- fires, torches, springs ---------- */
    var logMat = toon({ color: 0x6a4028 }), stoneMat = toon({ color: 0x7a7670 });
    var postMat = toon({ color: 0x4a3222 }), ironMat = toon({ color: 0x33333a });
    function flame(scale) {
      var g = new T3.Group();
      for (var i = 0; i < 2; i++) { var m = new T3.Mesh(new T3.PlaneGeometry(0.5 * scale, 0.8 * scale), new T3.MeshBasicMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide })); m.rotation.y = i * Math.PI / 2; m.position.y = 0.4 * scale; g.add(m); }
      g.userData.phase = Math.random() * 10;
      return g;
    }
    function fire(x, y, opts) {
      opts = opts || {};
      var g = new T3.Group(), top = topY(x, y);
      g.position.set(x + 0.5, top, y + 0.5);
      // a ring of stones and three logs
      for (var i = 0; i < 7; i++) { var st = new T3.Mesh(new T3.DodecahedronGeometry(0.07, 0), stoneMat); var a = i / 7 * Math.PI * 2; st.position.set(Math.cos(a) * 0.36, 0.04, Math.sin(a) * 0.36); st.scale.y = 0.7; g.add(st); }
      for (var j = 0; j < 3; j++) { var lg = new T3.Mesh(new T3.CylinderGeometry(0.04, 0.05, 0.5, 6), logMat); lg.rotation.z = Math.PI / 2; lg.rotation.y = j * 1.05; lg.position.y = 0.06 + (j === 2 ? 0.07 : 0); g.add(lg); }
      var fl = flame(opts.big ? 1.2 : 0.8); fl.position.y = 0.08; g.add(fl);
      var light = new T3.PointLight(0xff9a3a, 1.6, opts.big ? 7 : 5, 1.6); light.position.set(x + 0.5, top + 0.7, y + 0.5);
      scene.add(g);
      var h = { g: g, flame: fl, light: light, base: 1.6, smoke: 0, x: x, y: y, lit: true, kind: 'fire' };
      fires.push(h);
      return h;
    }
    function torch(x, y) {
      var g = new T3.Group(), top = topY(x, y);
      g.position.set(x + 0.5, top, y + 0.5);
      var post = new T3.Mesh(new T3.CylinderGeometry(0.05, 0.06, 1.1, 6), postMat); post.position.y = 0.55; g.add(post);
      var cup = new T3.Mesh(new T3.CylinderGeometry(0.12, 0.07, 0.16, 7), ironMat); cup.position.y = 1.12; g.add(cup);
      var fl = flame(0.5); fl.position.y = 1.14; g.add(fl);
      var light = new T3.PointLight(0xffb860, 1.1, 4.5, 1.8); light.position.set(x + 0.5, top + 1.5, y + 0.5);
      scene.add(g);
      var h = { g: g, flame: fl, light: light, base: 1.1, smoke: 0, x: x, y: y, lit: true, kind: 'torch' };
      fires.push(h);
      return h;
    }
    function spring(x, y) {
      var g = new T3.Group(), top = topY(x, y);
      g.position.set(x + 0.5, top, y + 0.5);
      var pool = new T3.Mesh(new T3.CylinderGeometry(0.42, 0.42, 0.06, 18), toon({ color: 0x7fe0d8, emissive: 0x2a6a66, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 })); pool.position.y = 0.02; g.add(pool);
      var rim = new T3.Mesh(new T3.TorusGeometry(0.42, 0.05, 6, 18), stoneMat); rim.rotation.x = Math.PI / 2; rim.position.y = 0.04; g.add(rim);
      var light = new T3.PointLight(0x9fe8e0, 0.6, 3.5); light.position.set(x + 0.5, top + 0.5, y + 0.5);
      scene.add(g);
      var h = { g: g, x: x, y: y, steam: 0, kind: 'spring', light: light };
      emitters.push(h);
      return h;
    }
    // a soft puff of smoke or steam that rises and fades
    var puffMat = new T3.MeshBasicMaterial({ color: 0xb8b4b0, transparent: true, opacity: 0.35, depthWrite: false });
    var steamMat = new T3.MeshBasicMaterial({ color: 0xe8f4f4, transparent: true, opacity: 0.4, depthWrite: false });
    var puffGeo = new T3.SphereGeometry(0.09, 6, 5);
    function puff(x, y, h, mat, rise) {
      if (puffs.length > 90 * budget) return;
      var m = new T3.Mesh(puffGeo, (mat || puffMat).clone()); m.position.set(x, h, y); m.scale.setScalar(0.5 + Math.random() * 0.4);
      m.material.opacity = 0.22;
      scene.add(m);
      puffs.push({ m: m, t: 0, life: 1.4 + Math.random() * 0.8, rise: rise || 0.5, drift: (Math.random() - 0.5) * 0.3, op: m.material.opacity });
    }

    /* ---------- the weather: a cloud of points that follows the King ---------- */
    function cloud(n, size, color, map, opts) {
      var geo = new T3.BufferGeometry(), pos = new Float32Array(n * 3), vel = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * opts.box; pos[i * 3 + 1] = Math.random() * opts.height; pos[i * 3 + 2] = (Math.random() - 0.5) * opts.box; vel[i * 3] = (Math.random() - 0.5) * 0.4; vel[i * 3 + 1] = -(opts.fall * (0.6 + Math.random() * 0.8)); vel[i * 3 + 2] = (Math.random() - 0.5) * 0.4; }
      geo.setAttribute('position', new T3.BufferAttribute(pos, 3));
      var mat = new T3.PointsMaterial({ color: color, size: size, map: map, transparent: true, opacity: opts.opacity || 0.8, depthWrite: false, blending: opts.additive ? T3.AdditiveBlending : T3.NormalBlending, sizeAttenuation: true });
      var pts = new T3.Points(geo, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 5;
      scene.add(pts);
      return { pts: pts, pos: pos, vel: vel, n: n, box: opts.box, height: opts.height, wind: 0, on: false, fade: 0, kind: opts.kind, wander: opts.wander || 0 };
    }
    var clouds = {
      snow: cloud(Math.round(1400 * budget), 0.09, 0xffffff, dotTex, { box: 30, height: 12, fall: 1.1, opacity: 0.85, kind: 'snow' }),
      blizzard: cloud(Math.round(2600 * budget), 0.11, 0xf0f6ff, streakTex, { box: 34, height: 12, fall: 3.2, opacity: 0.9, kind: 'blizzard' }),
      rain: cloud(Math.round(1600 * budget), 0.16, 0xbfd4e8, streakTex, { box: 30, height: 14, fall: 11, opacity: 0.55, kind: 'rain' }),
      embers: cloud(Math.round(220 * budget), 0.12, 0xff8a3a, dotTex, { box: 26, height: 5, fall: -0.7, opacity: 0.9, additive: true, kind: 'embers', wander: 0.8 }),
      fireflies: cloud(Math.round(160 * budget), 0.14, 0xb8ff70, dotTex, { box: 26, height: 2.2, fall: 0, opacity: 0.9, additive: true, kind: 'fireflies', wander: 0.6 }),
      dust: cloud(Math.round(240 * budget), 0.07, 0xd8d0c0, dotTex, { box: 24, height: 3, fall: 0.05, opacity: 0.35, kind: 'dust', wander: 0.4 })
    };
    var weather = 'clear', mood = { cold: false, hot: false, dim: false, woods: false, night: 0 };
    function setWeather(kind) { weather = kind; }
    function setMood(m) { mood = Object.assign(mood, m); }
    function wanted() {
      return { snow: weather === 'clear' && mood.cold && !mood.dim, blizzard: weather === 'blizzard', rain: weather === 'rain', embers: mood.hot, fireflies: mood.woods && mood.night > 0.5 && !mood.hot, dust: mood.dim };
    }

    /* ---------- the aurora: a curtain of light over the cold worlds at night ---------- */
    var auroraMat = new T3.ShaderMaterial({ transparent: true, depthWrite: false, side: T3.DoubleSide, blending: T3.AdditiveBlending, fog: false,
      uniforms: { t: { value: 0 }, amt: { value: 0 } },
      vertexShader: 'varying vec2 vUv; uniform float t; void main(){ vUv = uv; vec3 p = position; p.y += sin(uv.x * 9.0 + t * 0.7) * 2.5 + sin(uv.x * 23.0 - t * 1.3) * 0.8; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform float t, amt; void main(){ float b = sin(vUv.x * 31.0 + t * 0.9) * 0.5 + 0.5; b *= sin(vUv.x * 7.0 - t * 0.4) * 0.5 + 0.5; float v = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y)); vec3 c = mix(vec3(0.2, 1.0, 0.55), vec3(0.45, 0.3, 1.0), vUv.y + sin(t * 0.3) * 0.2); gl_FragColor = vec4(c, v * (0.25 + b * 0.55) * amt); }' });
    var aurora = new T3.Mesh(new T3.PlaneGeometry(160, 34, 64, 8), auroraMat); aurora.frustumCulled = false; aurora.renderOrder = 2; aurora.visible = false; scene.add(aurora);

    /* ---------- the frost: the ground round a freezing King turns white ---------- */
    var frostMat = new T3.MeshBasicMaterial({ color: 0xdff2ff, transparent: true, opacity: 0, depthWrite: false });
    var frost = new T3.Mesh(new T3.CircleGeometry(3.2, 28), frostMat); frost.rotation.x = -Math.PI / 2; frost.visible = false; scene.add(frost);
    var frostAmt = 0;
    function setFrost(a) { frostAmt = a; }

    /* ---------- the frame ---------- */
    function update(dt, p, night) {
      time += dt;
      mood.night = night;
      // fires flicker, breathe smoke
      fires.forEach(function (f) {
        if (!f.lit) { f.light.intensity = 0; f.flame.visible = false; return; }
        var ph = f.flame.userData.phase || 0, fl = 0.82 + Math.sin(time * 11 + ph) * 0.08 + Math.sin(time * 23.7 + ph * 1.7) * 0.06 + (Math.random() - 0.5) * 0.08;
        f.light.intensity = f.base * fl;
        f.flame.scale.set(0.9 + fl * 0.2, 0.85 + fl * 0.35, 0.9 + fl * 0.2);
        f.flame.rotation.y += dt * 0.6;
        var far = Math.abs(f.x - p.x) > 16 || Math.abs(f.y - p.y) > 16;
        f.flame.visible = !far;
        f.smoke += dt;
        if (!far && f.smoke > (f.kind === 'torch' ? 1.4 : 0.55) / budget) { f.smoke = 0; puff(f.g.position.x + (Math.random() - 0.5) * 0.2, f.g.position.z + (Math.random() - 0.5) * 0.2, f.g.position.y + (f.kind === 'torch' ? 1.4 : 0.5), puffMat, 0.55); }
      });
      emitters.forEach(function (e) {
        e.steam += dt;
        if (Math.abs(e.x - p.x) <= 16 && Math.abs(e.y - p.y) <= 16 && e.steam > 0.35 / budget) { e.steam = 0; var a = Math.random() * Math.PI * 2, r = Math.random() * 0.3; puff(e.g.position.x + Math.cos(a) * r, e.g.position.z + Math.sin(a) * r, e.g.position.y + 0.1, steamMat, 0.7); }
      });
      for (var i = puffs.length - 1; i >= 0; i--) { var q = puffs[i]; q.t += dt; q.m.position.y += q.rise * dt; q.m.position.x += q.drift * dt; q.m.scale.multiplyScalar(1 + dt * 0.45); var k = q.t / q.life; q.m.material.opacity = q.op * (1 - k * k); if (k >= 1) { scene.remove(q.m); q.m.material.dispose(); puffs.splice(i, 1); } }
      // the weather clouds: wanted ones fade in, the rest out; the points fall, drift, wrap round the King
      var want = wanted();
      Object.keys(clouds).forEach(function (key) {
        var c = clouds[key], target = want[key] ? 1 : 0;
        c.fade += (target - c.fade) * Math.min(1, dt * 1.2);
        if (c.fade < 0.02 && !target) { c.pts.visible = false; return; }
        c.pts.visible = true;
        c.pts.material.opacity = (key === 'rain' ? 0.5 : key === 'dust' ? 0.3 : 0.85) * c.fade;
        var wind = key === 'blizzard' ? 5.5 : key === 'snow' ? 0.9 : key === 'rain' ? 1.5 : 0;
        var pos = c.pos, vel = c.vel, half = c.box / 2, t = time;
        for (var j = 0; j < c.n; j++) {
          var o = j * 3;
          var wx = c.wander ? Math.sin(t * 1.3 + j) * c.wander : 0, wz = c.wander ? Math.cos(t * 1.1 + j * 0.7) * c.wander : 0;
          pos[o] += (vel[o] + wind + wx) * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += (vel[o + 2] + wz) * dt;
          if (key === 'fireflies') pos[o + 1] += Math.sin(t * 2 + j) * dt * 0.3;
          // keep the cloud round the King
          var dx = pos[o] - (p.x + 0.5), dz = pos[o + 2] - (p.y + 0.5);
          if (dx > half) pos[o] -= c.box; else if (dx < -half) pos[o] += c.box;
          if (dz > half) pos[o + 2] -= c.box; else if (dz < -half) pos[o + 2] += c.box;
          var floor = p.h || 0;
          if (pos[o + 1] < floor - 0.5) { pos[o + 1] = floor + c.height; pos[o] = p.x + 0.5 + (Math.random() - 0.5) * c.box; pos[o + 2] = p.y + 0.5 + (Math.random() - 0.5) * c.box; }
          else if (pos[o + 1] > floor + c.height + 1) { pos[o + 1] = floor + (key === 'embers' ? 0.2 : c.height); }
        }
        c.pts.geometry.attributes.position.needsUpdate = true;
      });
      // the aurora over the cold worlds at night
      var aur = mood.cold && !mood.dim ? Math.max(0, night - 0.3) / 0.7 : 0;
      auroraMat.uniforms.amt.value += (aur - auroraMat.uniforms.amt.value) * Math.min(1, dt);
      auroraMat.uniforms.t.value = time;
      aurora.visible = auroraMat.uniforms.amt.value > 0.01;
      if (aurora.visible) { aurora.position.set(p.x + 0.5, 30, p.y + 0.5 + 48); aurora.rotation.x = -0.25; }
      // the frost round a freezing King
      frostMat.opacity += (frostAmt * 0.55 - frostMat.opacity) * Math.min(1, dt * 2);
      frost.visible = frostMat.opacity > 0.01;
      if (frost.visible) { frost.position.set(p.x + 0.5, (p.h || 0) + 0.015, p.y + 0.5); frost.scale.setScalar(0.6 + frostAmt * 0.8 + Math.sin(time * 1.5) * 0.05); }
    }
    // every point light here, for the view's light budget (a shader holds only so many lights)
    function lights() { return fires.map(function (f) { return { light: f.light, x: f.x, y: f.y }; }).concat(emitters.map(function (e) { return { light: e.light, x: e.x, y: e.y }; })); }
    return { fire: fire, torch: torch, spring: spring, setWeather: setWeather, setMood: setMood, setFrost: setFrost, update: update, puff: puff, fires: fires, lights: lights, get weather() { return weather; } };
  }
  root.RealmFX = { create: create };
})(typeof self !== 'undefined' ? self : this);
