/* Stockfish 19 lite (WebAssembly, one thread) in a worker, spoken to over UCI.
   analyse(fen, opts, onInfo) -> Promise<{best, lines}>; a new call stops the one before. */
export class Engine {
  constructor(url = 'engine/stockfish-19-lite-single.js') {
    this.url = url;
    this.w = null;
    this.ready = null;
    this.job = null;
    this.multipv = 0;
  }

  start() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const w = new Worker(this.url);
      const timer = setTimeout(() => reject(new Error('The engine did not start')), 30000);
      w.onerror = e => { clearTimeout(timer); this.ready = null; reject(new Error(e.message || 'engine error')); };
      w.onmessage = e => {
        for (const line of String(e.data).split('\n')) {
          if (line === 'uciok') { w.postMessage('setoption name Hash value 32'); w.postMessage('isready'); }
          else if (line === 'readyok' && !this.w) { clearTimeout(timer); this.w = w; w.onmessage = ev => this._lines(ev.data); resolve(); }
        }
      };
      w.postMessage('uci');
    });
    return this.ready;
  }

  _lines(data) {
    for (const line of String(data).split('\n')) {
      const j = this.job;
      if (!j) continue;
      if (line.startsWith('info') && line.includes(' pv ')) {
        const m = / multipv (\d+)/.exec(line), sc = / score (cp|mate) (-?\d+)/.exec(line);
        const d = / depth (\d+)/.exec(line), pv = / pv (.+)$/.exec(line), nps = / nps (\d+)/.exec(line);
        if (!sc || !pv || / (lowerbound|upperbound)/.test(line)) continue;
        const idx = m ? +m[1] - 1 : 0;
        j.lines[idx] = { depth: +d[1], cp: sc[1] === 'cp' ? +sc[2] : null, mate: sc[1] === 'mate' ? +sc[2] : null, pv: pv[1].split(' '), nps: nps ? +nps[1] : 0 };
        if (!j.stopped) j.onInfo && j.onInfo(j.lines.filter(Boolean));
      } else if (line.startsWith('bestmove')) {
        this.job = null;
        const best = line.split(' ')[1];
        j.resolve({ best: best && best !== '(none)' ? best : null, lines: j.lines.filter(Boolean), stopped: j.stopped });
        if (this.next) { const n = this.next; this.next = null; this._go(n); }
      }
    }
  }

  _go(n) {
    if (n.multipv !== this.multipv) { this.w.postMessage('setoption name MultiPV value ' + n.multipv); this.multipv = n.multipv; }
    this.job = n;
    this.w.postMessage('position fen ' + n.fen);
    this.w.postMessage(n.infinite ? 'go infinite' : n.movetime ? 'go movetime ' + n.movetime : 'go depth ' + (n.depth || 18));
  }

  async analyse(fen, opts = {}, onInfo) {
    await this.start();
    return new Promise(resolve => {
      const n = { fen, movetime: opts.movetime, depth: opts.depth, infinite: !!opts.infinite, multipv: opts.multipv || 1, onInfo, resolve, lines: [] };
      if (this.next) { this.next.resolve({ best: null, lines: [], stopped: true }); this.next = null; }
      if (this.job) { this.job.stopped = true; this.next = n; this.w.postMessage('stop'); }
      else this._go(n);
    });
  }

  stop() {
    if (this.next) { this.next.resolve({ best: null, lines: [], stopped: true }); this.next = null; }
    if (this.job) { this.job.stopped = true; this.w.postMessage('stop'); }
  }

  newGame() { if (this.w && !this.job) { this.w.postMessage('ucinewgame'); this.w.postMessage('isready'); } }
}
