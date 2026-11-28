/* Online play: the connection to the owner's Mac (online/server.py). No page code: js/app.js draws the Online tab
   and plays the games, this keeps the account, finds the server and listens to it.

   Finding the server: the app on the Mac itself (served by app.py) asks app.py whether the server runs and talks to it
   directly; everywhere else the Worker says where the Mac's tunnel is right now. Listening: one long poll at a time
   (the tunnel carries no server-sent events), it returns at once when anything changes for this player. */
(function (root) {
  'use strict';
  var WORKER = 'https://powerchess-online.karahan-justin.workers.dev/where';
  var KEY = 'powerchess_online';
  var O = {
    base: null, status: 'idle', // idle, finding, offline, online
    token: null, user: null, lobby: null, games: {}, error: '', rev: 0, owner: false, why: ''
  };
  var listeners = [], gameListeners = [], polling = false, findTimer = null, stopped = true, pollCtl = null;

  try { var saved = JSON.parse(root.localStorage.getItem(KEY) || 'null'); if (saved && saved.token) { O.token = saved.token; O.user = saved.user || null; } } catch (e) { /* private mode */ }
  function keep() { try { root.localStorage.setItem(KEY, JSON.stringify({ token: O.token, user: O.user })); } catch (e) { /* private mode */ } }
  function emit() { listeners.forEach(function (f) { try { f(O); } catch (e) { console.error(e); } }); }
  O.onChange = function (f) { listeners.push(f); };
  O.onGame = function (f) { gameListeners.push(f); };

  function timeout(ms) { var c = typeof AbortController !== 'undefined' ? new AbortController() : null; if (c) setTimeout(function () { c.abort(); }, ms); return c; }
  function fetchJson(url, opts, ms) {
    var c = timeout(ms || 12000);
    opts = Object.assign({ cache: 'no-store', mode: 'cors' }, opts || {});
    if (c) opts.signal = c.signal;
    return fetch(url, opts).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); });
  }
  // a request to the server; rejects with { code, error } (error: the server's short word, or 'net')
  O.api = function (method, path, body, ms) {
    if (!O.base) return Promise.reject({ code: 0, error: 'offline' });
    var headers = { 'Content-Type': 'application/json' };
    if (O.token) headers.Authorization = 'Bearer ' + O.token;
    return fetchJson(O.base + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined }, ms).then(function (r) {
      if (r.status === 200) return r.body;
      if (r.status === 401 && O.token && path !== '/api/login') { O.token = null; O.user = null; keep(); emit(); }
      throw { code: r.status, error: (r.body && r.body.error) || 'http' + r.status };
    }, function () {
      lost();
      throw { code: 0, error: 'net' };
    });
  };

  /* ---------- finding the server ---------- */
  function localOwner() {
    // the page from app.py on the Mac: same origin, the Owner Console's door
    if (root.PC_WEB || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return Promise.resolve(null);
    return fetchJson('/api/owner/status', { headers: { 'X-PC': 'owner' }, mode: 'same-origin' }, 10000).then(function (r) {
      if (r.status !== 200) return null;
      O.owner = true;
      return r.body.on ? 'http://127.0.0.1:' + r.body.port : false;
    }, function () { return 'retry'; }); // busy with the page's own load: ask again soon, the Worker would only send us round through the tunnel
  }
  function find() {
    clearTimeout(findTimer);
    if (stopped) return Promise.resolve(false);
    O.status = 'finding'; emit();
    return localOwner().then(function (local) {
      if (local === 'retry') { findTimer = setTimeout(find, 2000); return 'wait'; }
      if (local) return local;
      if (local === false) { O.why = 'off'; return null; } // the owner's own app: the server is switched off
      return fetchJson(WORKER, {}, 8000).then(function (r) { O.why = r.body && r.body.on ? '' : 'off'; return r.body && r.body.on && r.body.url ? r.body.url : null; }, function () { O.why = 'net'; return null; });
    }).then(function (url) {
      if (url === 'wait') return false;
      if (!url) { offline(); return false; }
      return fetchJson(url + '/api/hello', {}, 8000).then(function (r) {
        if (r.status !== 200 || !r.body || r.body.name !== 'Power Chess') { O.why = 'down'; offline(); return false; }
        O.base = url; O.status = 'online'; O.error = ''; O.why = ''; O.hello = r.body;
        emit();
        if (O.token) startPolling();
        return true;
      }, function () { O.why = 'down'; offline(); return false; });
    });
  }
  function offline() {
    O.base = null; O.status = 'offline'; O.lobby = null;
    emit();
    clearTimeout(findTimer);
    if (!stopped) findTimer = setTimeout(find, 20000);
  }
  function lost() { if (O.status === 'online') { O.status = 'finding'; emit(); clearTimeout(findTimer); findTimer = setTimeout(find, 1500); } }
  O.start = function () { if (!stopped) return; stopped = false; find(); };
  O.stop = function () { stopped = true; clearTimeout(findTimer); if (pollCtl) pollCtl.abort(); };
  O.retry = function () { stopped = false; return find(); };

  /* ---------- listening ---------- */
  function startPolling() {
    if (polling || !O.base || !O.token) return;
    polling = true;
    O.rev = 0;
    (function loop() {
      if (!O.base || !O.token || stopped) { polling = false; return; }
      var headers = { Authorization: 'Bearer ' + O.token };
      pollCtl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var t = setTimeout(function () { if (pollCtl) pollCtl.abort(); }, 40000);
      fetch(O.base + '/api/poll?since=' + O.rev, { headers: headers, cache: 'no-store', mode: 'cors', signal: pollCtl ? pollCtl.signal : undefined }).then(function (r) {
        clearTimeout(t);
        if (r.status === 401) { O.token = null; O.user = null; keep(); polling = false; emit(); return null; }
        if (r.status !== 200) throw new Error('poll ' + r.status);
        return r.json();
      }).then(function (j) {
        if (!j) return;
        O.rev = j.rev;
        if (j.lobby) { O.lobby = j.lobby; if (j.lobby.me) { O.user = j.lobby.me; keep(); } }
        (j.games || []).forEach(function (g) { O.games[g.id] = g; });
        emit();
        (j.games || []).forEach(function (g) { gameListeners.forEach(function (f) { try { f(g); } catch (e) { console.error(e); } }); });
        setTimeout(loop, 30);
      }).catch(function () {
        clearTimeout(t);
        polling = false;
        if (!stopped) lost();
      });
    })();
  }
  // back from the background (a phone): the poll may have died with the page asleep
  if (root.document) root.document.addEventListener('visibilitychange', function () {
    if (root.document.visibilityState === 'visible' && !stopped) { if (O.status !== 'online') find(); else if (!polling) startPolling(); }
  });

  /* ---------- the account ---------- */
  function signedIn(r) {
    O.token = r.token; O.user = r.user; keep();
    emit();
    startPolling();
    return r.user;
  }
  O.register = function (name, password) { return O.api('POST', '/api/register', { name: name, password: password }).then(signedIn); };
  O.login = function (name, password) { return O.api('POST', '/api/login', { name: name, password: password }).then(signedIn); };
  O.logout = function () {
    var p = O.token && O.base ? O.api('POST', '/api/logout', {}).catch(function () {}) : Promise.resolve();
    O.token = null; O.user = null; O.lobby = null; O.games = {}; keep();
    if (pollCtl) pollCtl.abort();
    emit();
    return p;
  };
  O.signedIn = function () { return !!O.token; };
  O.password = function (old, nw) { return O.api('POST', '/api/password', { old: old, new: nw }); };
  O.profile = function (name) { return O.api('GET', '/api/profile?name=' + encodeURIComponent(name)); };
  O.me = function () { return O.api('GET', '/api/me'); };
  O.history = function (name, limit) { return O.api('GET', '/api/history?limit=' + (limit || 50) + (name ? '&name=' + encodeURIComponent(name) : '')); };
  O.game = function (id) { return O.api('GET', '/api/game?id=' + encodeURIComponent(id)).then(function (r) { O.games[r.game.id] = r.game; return r.game; }); };

  /* ---------- the lobby and the games ---------- */
  O.seek = function (o) { return O.api('POST', '/api/seek', o); };
  O.cancel = function (id) { return O.api('POST', '/api/cancel', { id: id }); };
  O.accept = function (idOrCode, byCode) { return O.api('POST', '/api/accept', byCode ? { code: idOrCode } : { id: idOrCode }).then(function (r) { O.games[r.game.id] = r.game; return r.game; }); };
  O.play = function (id, n, actions, turn, over) { return O.api('POST', '/api/play', { id: id, n: n, actions: actions, turn: turn, over: over || null }).then(function (r) { O.games[r.game.id] = r.game; return r.game; }); };
  O.over = function (id, n, result, reason) { return O.api('POST', '/api/over', { id: id, n: n, result: result, reason: reason }).then(function (r) { O.games[r.game.id] = r.game; return r.game; }); };
  O.resign = function (id) { return O.api('POST', '/api/resign', { id: id }).then(function (r) { O.games[r.game.id] = r.game; return r.game; }); };
  O.offer = function (id, what) { return O.api('POST', '/api/offer', { id: id, what: what }).then(function (r) { O.games[r.game.id] = r.game; return r.game; }); };
  O.liveGame = function () {
    if (!O.user) return null;
    var me = O.user.name.toLowerCase();
    for (var id in O.games) { var g = O.games[id]; if (!g.over && (g.wname.toLowerCase() === me || g.bname.toLowerCase() === me)) return g; }
    return null;
  };
  O.sideIn = function (g) { return O.user && g.wname.toLowerCase() === O.user.name.toLowerCase() ? 'w' : 'b'; };

  /* ---------- the cloud save ---------- */
  O.syncGet = function () { return O.api('GET', '/api/sync').then(function (r) { return r.items || {}; }); };
  O.syncPut = function (items) { return O.api('POST', '/api/sync', { items: items }); };

  /* ---------- the Owner Console (the app on the Mac only) ---------- */
  function owner(method, path, body) {
    return fetchJson('/api/owner' + path, { method: method, headers: { 'X-PC': 'owner', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, mode: 'same-origin' }, 30000).then(function (r) {
      if (r.status !== 200) throw { code: r.status, error: (r.body && r.body.error) || 'http' + r.status };
      return r.body;
    });
  }
  O.ownerStatus = function () { return owner('GET', '/status'); };
  O.ownerStart = function () { return owner('POST', '/start', {}).then(function (r) { setTimeout(find, 300); return r; }); };
  O.ownerStop = function () { return owner('POST', '/stop', {}).then(function (r) { setTimeout(find, 300); return r; }); };
  O.ownerAutostart = function (on) { return owner('POST', '/autostart', { on: !!on }); };
  O.ownerUsers = function () { return owner('GET', '/users'); };
  O.ownerUser = function (name, what, password) { return owner('POST', '/user', { name: name, what: what, password: password }); };
  O.ownerAbort = function (id) { return owner('POST', '/abort', { id: id }); };
  O.canOwn = function () { return !root.PC_WEB && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); };

  root.PCOnline = O;
})(typeof self !== 'undefined' ? self : this);
