/* Stockfish wrapper: one worker, one search at a time, newest request wins. */
(function (root) {
  'use strict';

  var BUILDS = {
    full: { url: 'engine/stockfish-19.js', label: 'Stockfish 19', timeout: 90000 },
    lite: { url: 'engine/stockfish-19-lite-single.js', label: 'Stockfish 19 Lite', timeout: 30000 }
  };

  function Engine() {
    this.w = null;
    this.kind = '';
    this.label = '';
    this.cur = null;
    this.chain = Promise.resolve();
    this.ticket = 0;
    this.opts = {};
    this.limits = { eloMin: 1320, eloMax: 3190, threadsMax: 1, hashMax: 16 };
    this.threads = 1;
    this.hash = 16;
  }

  Engine.prototype._spawn = function (build) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var w;
      try { w = new Worker(build.url); } catch (e) { reject(e); return; }
      var timer = setTimeout(function () { w.terminate(); reject(new Error('engine start timed out')); }, build.timeout);
      w.onerror = function (e) { clearTimeout(timer); w.terminate(); reject(new Error(e.message || 'worker error')); };
      w.onmessage = function (e) {
        String(e.data).split('\n').forEach(function (line) {
          if (line.indexOf('option name') === 0) self._option(line);
          else if (line === 'uciok') {
            clearTimeout(timer);
            w.onmessage = function (ev) { String(ev.data).split('\n').forEach(function (l) { self._line(l); }); };
            w.onerror = function (ev) { console.error('Stockfish worker error', ev.message); };
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
        break;
      } catch (e) { lastErr = e; console.warn('Engine build failed:', order[i], e); }
    }
    if (!this.w) throw lastErr || new Error('no engine');
    var cores = navigator.hardwareConcurrency || 4;
    this.threads = Math.max(1, Math.min(this.limits.threadsMax, cores - 2, 8));
    this.hash = Math.min(this.limits.hashMax, this.kind === 'full' ? 256 : 64);
    this._set(this._capped()); // started with what the energy setting allows (a change right after the start locks it up)
    await this._ready();
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
      this.w.postMessage('setoption name ' + k + ' value ' + opts[k]);
    }
  };

  /* The energy setting (app.js puts it in root.PC_ENERGY): at most so many threads and so much hash. */
  Engine.prototype._capped = function () {
    var cap = root.PC_ENERGY;
    return cap ? { Threads: Math.max(1, Math.min(this.threads, cap.threads)), Hash: Math.max(16, Math.min(this.hash, cap.hash)) } : { Threads: this.threads, Hash: this.hash };
  };
  // isready, and wait for readyok: after a change of threads the engine must have its threads up before the next go
  Engine.prototype._ready = function () {
    var self = this;
    return new Promise(function (resolve) {
      var t = setTimeout(function () { self.readyWait = null; resolve(); }, 5000);
      self.readyWait = function () { clearTimeout(t); resolve(); };
      self.w.postMessage('isready');
    });
  };
  Engine.prototype._line = function (line) {
    if (line === 'readyok' && this.readyWait) { var f = this.readyWait; this.readyWait = null; f(); return; }
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

  /* job = { position: 'fen ...' or 'fen ... moves ...', go: 'movetime 1000', options, onInfo }
     Resolves with { best, score, depth, pv, lines, cancelled }. A newer search cancels older ones. */
  Engine.prototype.search = function (job) {
    var self = this, my = ++this.ticket;
    if (this.cur) { this.cur.cancelled = true; this.w.postMessage('stop'); }
    var prev = this.chain, done;
    this.chain = new Promise(function (r) { done = r; });
    return prev.then(function () {
      return new Promise(function (resolve) {
        if (my !== self.ticket) { done(); resolve({ cancelled: true }); return; }
        self.cur = {
          job: job, score: null, depth: 0, pv: [], lines: {}, cancelled: false,
          finish: function (res) { self.cur = null; done(); resolve(res); }
        };
        if (job.options) self._set(job.options);
        // the energy setting: fewer threads and a smaller hash table to save the battery; after a change of threads
        // the search waits until the engine says it is ready
        var want = self._capped(), change = self.opts.Threads !== want.Threads || self.opts.Hash !== want.Hash;
        if (change) self._set(want);
        (change ? self._ready() : Promise.resolve()).then(function () {
          if (self.cur && self.cur.cancelled) { self.cur.finish({ cancelled: true }); return; }
          self.w.postMessage('position ' + job.position);
          self.w.postMessage('go ' + job.go);
        });
      });
    });
  };

  Engine.prototype.stop = function () {
    ++this.ticket;
    if (this.cur) { this.cur.cancelled = true; this.w.postMessage('stop'); }
  };

  Engine.prototype.newGame = function () {
    var self = this;
    this.stop();
    this.chain = this.chain.then(function () { self.w.postMessage('ucinewgame'); });
  };

  root.Engine = Engine;
})(self);
