/* Chess Scan service worker: everything offline, plus the cross-origin isolation headers so the recogniser may use
   threads. tools/stamp_sw.py writes the version and file list below. */
var VERSION = '1326b155716b';
var FILES = ["./", ".gitignore", "app.js", "engine.js", "engine/stockfish-19-lite-single.js", "engine/stockfish-19-lite-single.wasm", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "index.html", "lib/chess.js", "lib/ort-wasm-simd-threaded.mjs", "lib/ort-wasm-simd-threaded.wasm", "lib/ort.wasm.min.js", "manifest.webmanifest", "models/corners.onnx", "models/pieces.onnx", "models/pieces2d.onnx", "pieces/bB.svg", "pieces/bK.svg", "pieces/bN.svg", "pieces/bP.svg", "pieces/bQ.svg", "pieces/bR.svg", "pieces/wB.svg", "pieces/wK.svg", "pieces/wN.svg", "pieces/wP.svg", "pieces/wQ.svg", "pieces/wR.svg", "vision.js"];

var CACHE = 'chessscan-' + VERSION;
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) { return c.add(new Request(f, { cache: 'reload' })); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('chessscan-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function isolate(res) {
  if (!res || res.status === 0 || res.type === 'opaque') return res;
  var h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var key = url.pathname.replace(/\/$/, '/index.html');
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(key, { ignoreSearch: true }).then(function (hit) {
      if (hit) return isolate(hit);
      return fetch(req).then(isolate).catch(function () {
        return req.mode === 'navigate' ? c.match(new URL('index.html', self.registration.scope).pathname).then(isolate) : Response.error();
      });
    });
  }));
});
