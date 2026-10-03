/* The app shell for phones: what makes the page behave like an installed app.
   - touch: body.touch on devices whose main pointer is a finger (CSS and the board read it)
   - buzz(kind): a short vibration for a move, a capture, a check, a shot (Android; settings can turn it off)
   - awake(on): keeps the screen on while a game is running (Screen Wake Lock)
   - install: the browser's install offer is kept and shown as the app's own button (Settings, a one-time banner)
   - hold to explain: a long press on anything with a title (a button, a card) shows that text, as hover does on a desktop
   - the web build (window.PC_WEB, set by tools/build_web.py) registers sw.js: offline files, updates in the
     background, and the headers that the engines' threads need (cross-origin isolation) on hosts that cannot send them. HQ's app.py sends them itself
     and gets no service worker, so a local edit is never hidden behind a cache. */
(function (root) {
  'use strict';
  var PWA = {};
  var mm = function (q) { return !!(root.matchMedia && root.matchMedia(q).matches); };
  PWA.touch = mm('(pointer: coarse)') || ('ontouchstart' in root && !mm('(pointer: fine)'));
  PWA.standalone = mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)') || root.navigator.standalone === true;
  PWA.web = !!root.PC_WEB;

  /* ---------- vibration ---------- */
  var BUZZ = { move: 8, capture: 16, check: [10, 40, 14], shotgun: 26, boom: 38, win: [20, 60, 20, 60, 40], lose: [60, 80, 60], tap: 6, select: 5 };
  PWA.haptics = true; // the app's setting ('Vibration')
  PWA.buzz = function (kind) {
    if (!PWA.touch || !PWA.haptics || !root.navigator.vibrate) return;
    var p = BUZZ[kind];
    if (p) try { root.navigator.vibrate(p); } catch (e) { /* not allowed before the first touch */ }
  };

  /* ---------- the screen stays on during a game ---------- */
  var lock = null, want = false;
  function grab() {
    if (!want || lock || !root.navigator.wakeLock || document.visibilityState !== 'visible') return;
    root.navigator.wakeLock.request('screen').then(function (l) { lock = l; l.addEventListener('release', function () { lock = null; }); }).catch(function () { /* refused */ });
  }
  PWA.awake = function (on) {
    on = !!on;
    if (on === want) { if (on) grab(); return; }
    want = on;
    if (on) grab(); else if (lock) { lock.release().catch(function () {}); lock = null; }
  };
  document.addEventListener('visibilitychange', grab); // the lock is dropped when the app goes to the background

  /* ---------- installing ---------- */
  var offer = null, listeners = [];
  root.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); offer = e; listeners.forEach(function (f) { f(); }); });
  root.addEventListener('appinstalled', function () { offer = null; PWA.standalone = true; listeners.forEach(function (f) { f(); }); });
  PWA.canInstall = function () { return !!offer && !PWA.standalone; };
  PWA.onInstallChange = function (f) { listeners.push(f); };
  PWA.install = function () {
    if (!offer) return Promise.resolve(false);
    var o = offer;
    offer = null;
    o.prompt();
    return o.userChoice.then(function (c) { listeners.forEach(function (f) { f(); }); return c && c.outcome === 'accepted'; }).catch(function () { return false; });
  };

  // ask the browser to keep the saved games and progress (no eviction when space runs low)
  if (root.navigator.storage && root.navigator.storage.persist) root.navigator.storage.persist().catch(function () {});

  /* ---------- hold to explain ---------- */
  var tip = null, tipTimer = null, swallow = false;
  function hideTip() { if (tip) { tip.remove(); tip = null; } }
  PWA.hideTip = function () { var was = !!tip; hideTip(); return was; };
  function showTip(el, text, x, y) {
    hideTip();
    tip = document.createElement('div');
    tip.id = 'tip';
    tip.textContent = text;
    document.body.appendChild(tip);
    var w = tip.offsetWidth, h = tip.offsetHeight, vw = root.innerWidth;
    var left = Math.max(8, Math.min(vw - w - 8, x - w / 2)), top = y - h - 18;
    if (top < 8) top = y + 26;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
    PWA.buzz('tap');
  }
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch') return;
    if (tip && !e.target.closest('#tip')) hideTip();
    var el = e.target.closest('[title]');
    if (!el || el.closest('#board') || !el.getAttribute('title')) return;
    var x = e.clientX, y = e.clientY;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { tipTimer = null; swallow = true; showTip(el, el.getAttribute('title'), x, y); }, 480);
  }, true);
  var cancel = function () { clearTimeout(tipTimer); tipTimer = null; };
  document.addEventListener('pointerup', cancel, true);
  document.addEventListener('pointercancel', cancel, true);
  document.addEventListener('pointermove', function (e) { if (tipTimer && e.pointerType === 'touch' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 6)) cancel(); }, true);
  // the tap that ended a long press does not also press the button
  document.addEventListener('click', function (e) { if (swallow) { swallow = false; e.preventDefault(); e.stopPropagation(); } }, true);
  // no browser menu on a long press, except in text fields
  document.addEventListener('contextmenu', function (e) { if (PWA.touch && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault(); });

  /* ---------- the web build: offline files and cross-origin isolation ---------- */
  if (PWA.web && 'serviceWorker' in root.navigator && root.isSecureContext) {
    /* updates, as an app from the store gets them: a new version loads in the background, takes over while the app
       is out of sight, and the app starts again when it comes back (the running game is kept, see saveLive) */
    var swapped = false;
    root.navigator.serviceWorker.register('sw.js').then(function (reg) {
      var waiting = function () { if (reg.waiting && root.navigator.serviceWorker.controller) PWA.updated = true; };
      waiting();
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (w) w.addEventListener('statechange', function () { if (w.state === 'installed') waiting(); });
      });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden' && PWA.updated && reg.waiting) reg.waiting.postMessage('skipWaiting');
        else if (document.visibilityState === 'visible' && swapped) root.location.reload();
        else if (document.visibilityState === 'visible') reg.update().catch(function () {}); // back in front: anything new?
      });
    }).catch(function (e) { console.warn('service worker', e); });
    root.navigator.serviceWorker.addEventListener('controllerchange', function () { if (PWA.updated) swapped = true; });
    // the first visit: the worker is not in charge yet, so the page is not isolated. Once it is, reload once.
    if (!root.crossOriginIsolated) {
      var once = false;
      try { once = sessionStorage.getItem('pc_coi') === '1'; } catch (e) { /* no storage */ }
      if (!once) root.navigator.serviceWorker.ready.then(function () {
        if (root.crossOriginIsolated) return;
        try { sessionStorage.setItem('pc_coi', '1'); } catch (e) { /* no storage */ }
        root.location.reload();
      });
    }
  }

  if (PWA.touch) {
    var mark = function () { document.body.classList.add('touch'); if (PWA.standalone) document.body.classList.add('standalone'); };
    if (document.body) mark(); else document.addEventListener('DOMContentLoaded', mark);
  }
  root.PWA = PWA;
})(typeof window !== 'undefined' ? window : globalThis);
