/* Stockfish wrapper: one worker, one search at a time, newest request wins.
   On a phone the worker can die (the tab in the background, memory short, a hash table that does not fit) or fall
   silent. So: a watchdog on every search, a fresh worker with the same options when one dies, the same search once
   more, and only then an error, so the caller can fall back to the app's own search. */
(function (root) {
  'use strict';

  var BUILDS = {
    full: { url: 'engine/stockfish-19.js', label: 'Stockfish 19', timeout: 90000 },
    lite: { url: 'engine/stockfish-19-lite-single.js', label: 'Stockfish 19 Lite', timeout: 30000 }
  };
  // all in milliseconds (tools/tests/engine_watchdog.js shortens them)
  var TIMING = {
    ready: 10000,  // isready to readyok, else the worker counts as dead
    ping: 3000,    // the same when the tab comes back to the front
    hurry: 3000,   // a cancelled search has this long to say bestmove
    margin: 6000,  // a timed search may run this much past its movetime
    depth: 20000,  // a search with no time limit (depth, nodes) gets this long
    backoff: 30000 // after a failed respawn, no new try before this has passed
  };

  // the web build or a touch device: the lite engine, one thread, a small hash table (64 MB can fail to allocate on a phone)
  function lean() {
    if (root.PC_WEB) return true;
    if (root.PWA && root.PWA.touch) return true;
    try { return !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches); } catch (e) { return false; }
  }

  function Engine() {
    this.w = null;
    this.kind = '';
    this.label = '';
    this.build = null;      // the build that runs, so a dead worker can be started again
    this.cur = null;
    this.chain = Promise.resolve();
    this.ticket = 0;
    this.opts = {};
    this.limits = { eloMin: 1320, eloMax: 3190, threadsMax: 1, hashMax: 16 };
    this.threads = 1;
    this.hash = 16;
    this.waiters = [];      // one entry per isready that has no readyok yet
    this.reviving = null;   // the respawn under way
    this.deaths = 0;        // how often a worker was lost (shown in the engine box)
    this.onDeath = null;    // app.js may listen
  }

  Engine.prototype._spawn = function (build) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var w;
      try { w = new Worker(build.url); } catch (e) { reject(e); return; }
      var timer = setTimeout(function () { w.terminate(); reject(new Error('engine start timed out')); }, build.timeout);
      w.onerror = function (e) { clearTimeout(timer); w.terminate(); reject(new Error((e && e.message) || 'worker error')); };
      w.onmessage = function (e) {
        String(e.data).split('\n').forEach(function (line) {
          if (line.indexOf('option name') === 0) self._option(line);
          else if (line === 'uciok') {
            clearTimeout(timer);
            // from here on the worker belongs to the engine; a worker that was replaced is not listened to
            w.onmessage = function (ev) { if (self.w === w) String(ev.data).split('\n').forEach(function (l) { self._line(l); }); };
            var died = function (ev) { self._died(w, new Error((ev && ev.message) || 'worker error')); };
            w.onerror = died;
            w.onmessageerror = died;
            resolve(w);
          }
        });
      };
      w.postMessage('uci');
    });
  };

  Engine.prototype._option = function (line) {
    var m = /^option name (.+?) type spin default (-?\d+) min (-?\d+) max (-?\d+)/.exec(line);
    if (!m) return;
    if (m[1] === 'UCI_Elo') { this.limits.eloMin = +m[3]; this.limits.eloMax = +m[4]; }
    if (m[1] === 'Threads') this.limits.threadsMax = +m[4];
    if (m[1] === 'Hash') this.limits.hashMax = +m[4];
  };

  Engine.prototype._post = function (msg) { if (this.w) this.w.postMessage(msg); };

  /* The worker is lost: an error after the start, no readyok, no bestmove in time. It is dropped (a new one is
     started before the next search), and whatever waited on it fails. Fairy-Stockfish cannot be started again,
     so it is only told to stop. */
  Engine.prototype._died = function (w, err) {
    if (w && this.w !== w) return; // a late word from a worker that was replaced
    if (this.kind === 'fairy') this._post('stop');
    else if (this.w) {
      var old = this.w;
      this.w = null;
      this.deaths++;
      if (old.terminate) try { old.terminate(); } catch (e) { /* already gone */ }
    }
    var ws = this.waiters;
    this.waiters = [];
    ws.forEach(function (it) { it.fail(err); });
    if (this.cur) this.cur.fail(err);
    if (this.onDeath) try { this.onDeath(err); } catch (e) { /* the listener's own problem */ }
  };

  // A dead worker is started again, with the options it had. One respawn at a time.
  Engine.prototype._alive = function () {
    var self = this;
    if (this.w) return Promise.resolve();
    if (!this.build) return Promise.reject(new Error('engine is not running'));
    // a start that just failed is not tried again at once: a phone that cannot run the engine would otherwise wait
    // out a start timeout before every move
    if (this.failedAt && Date.now() - this.failedAt < TIMING.backoff) return Promise.reject(new Error('engine start failed a moment ago'));
    if (!this.reviving) {
      this.reviving = this._spawn(this.build).then(function (w) {
        self.w = w;
        var had = self.opts;
        self.opts = {};
        self._set(had);
        return self._ready();
      }).then(function () {
        self.reviving = null;
        self.failedAt = 0;
        if (self.onRevive) try { self.onRevive(); } catch (e) { /* the listener's own problem */ }
      }, function (e) { self.reviving = null; self.failedAt = Date.now(); throw e; });
    }
    return this.reviving;
  };

  // Start the strongest build the browser allows, fall back to the lite one.
  Engine.prototype.init = async function () {
    var isolated = !!root.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';
    var order = isolated && !root.PC_WEB ? ['full', 'lite'] : ['lite']; // the web build (phones) ships only the lite one
    var lastErr = null;
    for (var i = 0; i < order.length; i++) {
      try {
        this.w = await this._spawn(BUILDS[order[i]]);
        this.kind = order[i];
        this.label = BUILDS[order[i]].label;
        this.build = BUILDS[order[i]];
        break;
      } catch (e) { lastErr = e; console.warn('Engine build failed:', order[i], e); }
    }
    if (!this.w) throw lastErr || new Error('no engine');
    if (lean()) {
      this.threads = 1;
      this.hash = 16;
    } else {
      var cores = navigator.hardwareConcurrency || 4;
      this.threads = Math.max(1, Math.min(this.limits.threadsMax, cores - 2, 8));
      this.hash = Math.min(this.limits.hashMax, this.kind === 'full' ? 256 : 64);
    }
    this._set(this._capped()); // started with what the energy setting allows (a change right after the start locks it up)
    await this._ready();
    this._watch();
    return this;
  };

  /* Fairy-Stockfish for the chess variants. It is not a plain worker: the script
     exposes a factory and runs its UCI loop on its own pthread. */
  Engine.prototype.initFairy = async function () {
    var self = this;
    if (!root.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') throw new Error('Fairy-Stockfish needs the app server (cross-origin isolation)');
    if (!root.Stockfish) {
      await new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'fairy/stockfish.js';
        s.onload = resolve;
        s.onerror = function () { reject(new Error('fairy/stockfish.js could not be loaded')); };
        document.head.appendChild(s);
      });
    }
    var sf = await root.Stockfish();
    this.sf = sf;
    this.w = { postMessage: function (m) { sf.postMessage(m); } };
    this.kind = 'fairy';
    this.label = 'Fairy-Stockfish';
    await new Promise(function (resolve, reject) {
      var ready = false;
      var timer = setTimeout(function () { reject(new Error('Fairy-Stockfish start timed out')); }, 30000);
      sf.addMessageListener(function (line) {
        if (ready) { self._line(line); return; }
        if (line.indexOf('option name') === 0) self._option(line);
        else if (line === 'uciok') { ready = true; clearTimeout(timer); resolve(); }
      });
      sf.postMessage('uci');
    });
    var cores = navigator.hardwareConcurrency || 4;
    this.threads = Math.max(1, Math.min(this.limits.threadsMax, cores - 2, 6));
    this.hash = Math.min(this.limits.hashMax, 128);
    // No variant networks are shipped, so the classical evaluation is used.
    this._set(Object.assign({ 'Use NNUE': 'false' }, this._capped()));
    await this._ready();
    return this;
  };

  // Hand a variants.ini text to Fairy-Stockfish (custom pieces and boards).
  Engine.prototype.loadVariants = function (ini) {
    if (this.ini === ini) return;
    this.ini = ini;
    this.sf.FS.writeFile('/custom.ini', ini);
    this.w.postMessage('setoption name VariantPath value /custom.ini');
    delete this.opts.UCI_Variant;
  };

  Engine.prototype._set = function (opts) {
    for (var k in opts) {
      if (this.opts[k] === opts[k]) continue;
      this.opts[k] = opts[k];
      this._post('setoption name ' + k + ' value ' + opts[k]);
    }
  };

  /* The energy setting (app.js puts it in root.PC_ENERGY): at most so many threads and so much hash. */
  Engine.prototype._capped = function () {
    var cap = root.PC_ENERGY;
    return cap ? { Threads: Math.max(1, Math.min(this.threads, cap.threads)), Hash: Math.max(16, Math.min(this.hash, cap.hash)) } : { Threads: this.threads, Hash: this.hash };
  };
  /* isready, and wait for readyok: after a change of threads the engine must have its threads up before the next go.
     No readyok in time means the worker is dead: it is dropped and the promise rejects. */
  Engine.prototype._ready = function (ms) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var it = {};
      var t = setTimeout(function () { self._died(null, new Error('engine did not answer isready')); }, ms || TIMING.ready);
      it.ok = function () { clearTimeout(t); resolve(); };
      it.fail = function (e) { clearTimeout(t); reject(e); };
      self.waiters.push(it);
      self._post('isready');
    });
  };
  /* The tab comes back to the front: a worker that was suspended or killed meanwhile shows itself by not answering
     isready, and is dropped so that the next search starts a new one. A running search has its own watchdog. */
  Engine.prototype._watch = function () {
    var self = this, doc = root.document;
    if (this.watching || !doc || !doc.addEventListener) return;
    this.watching = true;
    doc.addEventListener('visibilitychange', function () {
      if (doc.visibilityState !== 'visible' || !self.w || self.cur || self.reviving || self.waiters.length) return;
      self._ready(TIMING.ping).catch(function () { /* dropped; the next search starts a fresh worker */ });
    });
  };
  Engine.prototype._line = function (line) {
    if (line === 'readyok') { var it = this.waiters.shift(); if (it) it.ok(); return; }
    var cur = this.cur;
    if (!cur) return;
    if (line.indexOf('info ') === 0 && line.indexOf(' score ') > 0) {
      var sm = / score (cp|mate) (-?\d+)/.exec(line);
      if (!sm || / (upperbound|lowerbound)/.test(line)) return;
      var dm = / depth (\d+)/.exec(line), pm = / pv (.+)$/.exec(line), mp = / multipv (\d+)/.exec(line);
      var entry = { score: sm[1] === 'cp' ? { cp: +sm[2] } : { mate: +sm[2] }, depth: dm ? +dm[1] : 0, pv: pm ? pm[1].split(' ') : [] };
      var rank = mp ? +mp[1] : 1;
      cur.lines[rank] = entry; // with MultiPV set, line 2 and up are the alternatives
      if (cur.job.onLine && !cur.cancelled) cur.job.onLine(rank, entry);
      if (rank !== 1) return;
      cur.score = entry.score;
      cur.depth = entry.depth;
      cur.pv = entry.pv;
      if (cur.job.onInfo && !cur.cancelled) cur.job.onInfo({ score: cur.score, depth: cur.depth, pv: cur.pv });
    } else if (line.indexOf('bestmove') === 0) {
      var best = line.split(' ')[1];
      cur.finish({ best: best === '(none)' ? null : best, score: cur.score, depth: cur.depth, pv: cur.pv, lines: cur.lines, cancelled: cur.cancelled });
    }
  };

  // How long a search may take before the worker counts as dead. 0: no limit (go infinite is stopped by the caller).
  Engine.prototype._budget = function (go) {
    var m = /movetime (\d+)/.exec(go);
    if (m) return +m[1] + TIMING.margin;
    if (/infinite/.test(go)) return 0;
    var t = /(?:wtime|btime) (\d+)/.exec(go);
    if (t) return +t[1] + TIMING.margin;
    return TIMING.depth;
  };

  /* job = { position: 'fen ...' or 'fen ... moves ...', go: 'movetime 1000', options, onInfo }
     Resolves with { best, score, depth, pv, lines, cancelled }. A newer search cancels older ones.
     Rejects when the engine gives no answer even after a fresh worker, so the caller can fall back. */
  Engine.prototype.search = function (job) {
    var self = this, my = ++this.ticket;
    if (this.cur) { this.cur.cancelled = true; this._post('stop'); this.cur.arm(TIMING.hurry); }
    var prev = this.chain, done;
    this.chain = new Promise(function (r) { done = r; });
    return prev.then(function () {
      if (my !== self.ticket) { done(); return { cancelled: true }; }
      return self._run(job, my, false).then(function (res) { done(); return res; }, function (e) { done(); throw e; });
    });
  };

  // One attempt at a search; a dead or silent worker is replaced and the search tried once more.
  Engine.prototype._run = function (job, my, again) {
    var self = this;
    return this._alive().then(function () {
      if (my !== self.ticket) return { cancelled: true }; // overtaken while the worker was starting
      return new Promise(function (resolve, reject) {
        var cur = { job: job, score: null, depth: 0, pv: [], lines: {}, cancelled: false, timer: 0 };
        cur.arm = function (ms) {
          clearTimeout(cur.timer);
          cur.timer = ms > 0 ? setTimeout(function () { self._died(null, new Error('engine search timed out')); }, ms) : 0;
        };
        cur.finish = function (res) { clearTimeout(cur.timer); if (self.cur === cur) self.cur = null; resolve(res); };
        cur.fail = function (err) { clearTimeout(cur.timer); if (self.cur === cur) self.cur = null; reject(err); };
        self.cur = cur;
        if (job.options) self._set(job.options);
        // the energy setting: fewer threads and a smaller hash table to save the battery; after a change of threads
        // the search waits until the engine says it is ready
        var want = self._capped(), change = self.opts.Threads !== want.Threads || self.opts.Hash !== want.Hash;
        if (change) self._set(want);
        (change ? self._ready() : Promise.resolve()).then(function () {
          if (self.cur !== cur) return;
          if (cur.cancelled) { cur.finish({ cancelled: true }); return; }
          self._post('position ' + job.position);
          self._post('go ' + job.go);
          cur.arm(self._budget(job.go));
        }, function () { /* no readyok: _died has failed this search already */ });
      });
    }).catch(function (e) {
      if (my !== self.ticket) return { cancelled: true }; // overtaken meanwhile: the newer search gets the fresh worker
      if (!again && self.build) { console.warn('Engine lost, starting it again:', e && e.message); return self._run(job, my, true); }
      throw e;
    });
  };

  Engine.prototype.stop = function () {
    ++this.ticket;
    if (this.cur) { this.cur.cancelled = true; this._post('stop'); this.cur.arm(TIMING.hurry); }
  };

  Engine.prototype.newGame = function () {
    var self = this;
    this.stop();
    this.chain = this.chain.then(function () { self._post('ucinewgame'); });
  };

  Engine.TIMING = TIMING;
  root.Engine = Engine;
})(typeof self !== 'undefined' ? self : globalThis);
