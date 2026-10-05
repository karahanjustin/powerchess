/* Music for the roguelike modes, made here as it plays (no files): a pad, a plucked arpeggio, a bass and a few
   drums, from a small score per mood. Pawnbarian is a slow dungeon walk in D dorian, Shotgun King a dark waltz-like
   organ in A harmonic minor, the Ouroboros King a harp in E minor over a drone; each has a faster, heavier boss
   version. Scheduled a little ahead of time on the page's AudioContext (the usual look-ahead clock), so the timing
   holds while the page is busy. Music.play(ctx, mood) switches with a short fade, Music.play(ctx, null) fades out.
   The volume stays well under the sound effects. */
(function (root) {
  'use strict';
  var NOTE = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  // chords as semitones over the root; arp: the chord tones to pick per step (an index, -1 a rest); drums: k kick, s snare, h hat
  var MOODS = {
    pb: { bpm: 84, root: 50, chords: [[0, 3, 7, 10], [-2, 2, 5, 9], [-4, 0, 3, 7], [-2, 2, 5, 9]], steps: 8,
      arp: [0, 2, 1, 3, 2, 1, -1, 1], bass: [0, -1, -1, -1, 0, -1, -1, -1], drums: 'k...h...k.s.h...', pad: 0.05, arpVol: 0.045, wave: 'triangle', cut: 1800 },
    pbboss: { bpm: 112, root: 50, chords: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 2, 5]], steps: 8,
      arp: [0, 1, 2, 1, 0, 1, 2, 3], bass: [0, 0, -1, 0, 0, -1, 0, -1], drums: 'k.h.s.h.k.khs.h.', pad: 0.045, arpVol: 0.05, wave: 'sawtooth', cut: 1400 },
    sk: { bpm: 72, root: 45, chords: [[0, 3, 7], [5, 8, 12], [-1, 2, 5, 8], [0, 3, 7]], steps: 6,
      arp: [0, 2, 1, -1, 2, 1], bass: [0, -1, -1, 0, -1, -1], drums: 'k.....h.....', pad: 0.05, arpVol: 0.035, wave: 'square', cut: 1200, bell: true },
    skboss: { bpm: 100, root: 45, chords: [[0, 3, 7], [-1, 2, 5, 8], [1, 5, 8], [-1, 2, 5, 8]], steps: 8,
      arp: [0, 1, 2, 3, 2, 1, 0, 1], bass: [0, -1, 0, -1, 0, 0, -1, 0], drums: 'k...s...k.k.s.hh', pad: 0.045, arpVol: 0.04, wave: 'square', cut: 1500, bell: true },
    ouro: { bpm: 76, root: 52, chords: [[0, 7, 12, 15], [-4, 3, 8, 12], [-2, 5, 10, 14], [-5, 2, 7, 10]], steps: 8,
      arp: [0, 1, 2, 3, 2, 1, -1, -1], bass: [0, -1, -1, -1, -1, -1, -1, -1], drums: '........k.......', pad: 0.04, arpVol: 0.05, wave: 'sine', cut: 3000, drone: true },
    // The Gilded Crown: the open land (slow, wide, a little sad), the inside of houses (warm, quiet), the lake
    cfield: { bpm: 66, root: 50, chords: [[0, 7, 14, 15], [-2, 5, 12, 14], [-4, 3, 10, 12], [-5, 2, 9, 14]], steps: 8,
      arp: [0, -1, 2, -1, 1, -1, 3, -1], bass: [0, -1, -1, -1, -1, -1, -1, -1], drums: '................', pad: 0.045, arpVol: 0.04, wave: 'triangle', cut: 2400, drone: true },
    cinn: { bpm: 72, root: 55, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [2, 5, 9, 12]], steps: 6,
      arp: [0, 2, 1, -1, 3, -1], bass: [0, -1, -1, 0, -1, -1], drums: '............', pad: 0.04, arpVol: 0.035, wave: 'sine', cut: 2000 },
    clake: { bpm: 58, root: 52, chords: [[0, 7, 12, 16], [5, 9, 12, 16], [-3, 4, 9, 12], [-1, 4, 7, 11]], steps: 8,
      arp: [0, -1, 1, -1, 2, -1, -1, -1], bass: [0, -1, -1, -1, -1, -1, -1, -1], drums: '................', pad: 0.04, arpVol: 0.04, wave: 'sine', cut: 3000, drone: true },
    ouroboss: { bpm: 104, root: 52, chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], steps: 8,
      arp: [0, 2, 1, 2, 0, 2, 1, 3], bass: [0, -1, 0, -1, 0, -1, 0, 0], drums: 'k.h.k.h.s.h.k.hh', pad: 0.045, arpVol: 0.045, wave: 'triangle', cut: 2200, drone: true }
  };
  var S = { ctx: null, out: null, mood: null, step: 0, next: 0, timer: null, noise: null };
  function noiseBuf(ctx) {
    if (S.noise && S.noise.sampleRate === ctx.sampleRate) return S.noise;
    var len = ctx.sampleRate * 0.5, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    S.noise = b;
    return b;
  }
  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function voice(t, freq, dur, vol, wave, cut, a) {
    var c = S.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = wave; o.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.Q.value = 0.7;
    env(g, t, a || 0.008, vol, dur);
    o.connect(f); f.connect(g); g.connect(S.out);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(t, kind) {
    var c = S.ctx;
    if (kind === 'k') {
      var o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      env(g, t, 0.004, 0.16, 0.22); o.connect(g); g.connect(S.out); o.start(t); o.stop(t + 0.25);
      return;
    }
    var src = c.createBufferSource(), f = c.createBiquadFilter(), g2 = c.createGain();
    src.buffer = noiseBuf(c);
    f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1500 : 7000; f.Q.value = 0.8;
    env(g2, t, 0.002, kind === 's' ? 0.07 : 0.025, kind === 's' ? 0.14 : 0.05);
    src.connect(f); f.connect(g2); g2.connect(S.out); src.start(t); src.stop(t + 0.2);
  }
  // one step of the score at time t
  function tick(t) {
    var M = MOODS[S.mood], n = M.steps, bar = Math.floor(S.step / n), at = S.step % n, beat = 60 / M.bpm / 2;
    var ch = M.chords[bar % M.chords.length], root = M.root;
    if (at === 0) {
      // the pad: the chord held for the bar, an octave up, soft attack
      ch.forEach(function (x) { voice(t, NOTE(root + 12 + x), beat * n * 0.98, M.pad / ch.length * 2, 'sawtooth', 700, 0.5); });
      if (M.drone) voice(t, NOTE(root - 12), beat * n, 0.05, 'sine', 400, 0.4);
    }
    var ai = M.arp[at];
    if (ai >= 0) voice(t, NOTE(root + 24 + ch[ai % ch.length]), beat * 1.6, M.arpVol, M.wave, M.cut);
    if (M.bell && at === 0 && bar % 2 === 1) voice(t, NOTE(root + 36 + ch[0]), beat * 6, 0.03, 'sine', 5000);
    if (M.bass[at] >= 0) voice(t, NOTE(root - 12 + ch[0]), beat * 1.8, 0.09, 'triangle', 500);
    var dr = M.drums.charAt((S.step * 2) % M.drums.length), dr2 = M.drums.charAt((S.step * 2 + 1) % M.drums.length);
    if (dr !== '.') drum(t, dr);
    if (dr2 !== '.') drum(t + beat / 2, dr2);
    S.step++;
  }
  function pump() {
    if (!S.ctx || !S.mood) return;
    var M = MOODS[S.mood], beat = 60 / M.bpm / 2;
    if (S.next < S.ctx.currentTime) S.next = S.ctx.currentTime + 0.05;
    while (S.next < S.ctx.currentTime + 0.35) { tick(S.next); S.next += beat; }
  }
  function play(ctx, mood, vol) {
    mood = MOODS[mood] ? mood : null;
    if (mood === S.mood && (!mood || S.ctx === ctx)) { if (S.out && vol != null) S.out.gain.setTargetAtTime(vol, ctx.currentTime, 0.2); return; }
    // the old one fades out on its own gain
    if (S.out) { var old = S.out; old.gain.setTargetAtTime(0.0001, S.ctx.currentTime, 0.25); setTimeout(function () { try { old.disconnect(); } catch (e) { /* gone */ } }, 1500); }
    S.out = null; S.mood = mood;
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
    if (!mood || !ctx) return;
    S.ctx = ctx; S.step = 0; S.next = ctx.currentTime + 0.3;
    S.out = ctx.createGain();
    S.out.gain.setValueAtTime(0.0001, ctx.currentTime);
    S.out.gain.setTargetAtTime(vol == null ? 1 : vol, ctx.currentTime + 0.1, 0.6);
    S.out.connect(ctx.destination);
    S.timer = setInterval(pump, 90);
    pump();
  }
  root.Music = { play: play, MOODS: MOODS, get mood() { return S.mood; } };
})(typeof self !== 'undefined' ? self : this);
