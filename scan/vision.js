/* Board recognition, all on the phone (ONNX Runtime Web, WebAssembly):
   1. corners.onnx: the photo letterboxed to 320x320 -> an 80x80 corner heatmap and an 80x80 board mask
   2. the four board corners: the best convex quad among the heatmap peaks that agrees with the mask
   3. pieces.onnx: one 64x128 crop per square (the square and the space above it, where a standing piece shows)
      -> 13 classes: empty, PNBRQK (white), pnbrqk (black)
   4. orientation: a1 is a dark square (decides 90 degrees), white sits on its own side (decides 180 degrees)
   Images are worked on at 1024 px on the long side, as in training. */
/* global ort */

export const WORK = 1024;
const S = 320, OS = 80;
export const CLASSES = ['', 'P', 'N', 'B', 'R', 'Q', 'K', 'p', 'n', 'b', 'r', 'q', 'k'];

const sessions = {};
let configured = false;
function session(name) {
  if (!configured) {
    ort.env.wasm.wasmPaths = new URL('lib/', document.baseURI).href;
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
    configured = true;
  }
  if (!sessions[name]) {
    sessions[name] = ort.InferenceSession.create('models/' + name + '.onnx', { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    sessions[name].catch(() => { delete sessions[name]; });
  }
  return sessions[name];
}
/* mode: 'screen' (digital boards) or 'real' (a physical set) */
export function loadModels(mode = 'screen') {
  return Promise.all([session('corners'), session(mode === 'real' ? 'pieces' : 'pieces2d')]);
}

/* a canvas with the image at WORK px on the long side */
export function workCanvas(src, w, h) {
  const s = Math.min(1, WORK / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function toTensorData(imgData, n, w, h, out, offset) {
  const d = imgData.data, plane = w * h;
  for (let i = 0; i < plane; i++) {
    out[offset + i] = d[i * 4];
    out[offset + plane + i] = d[i * 4 + 1];
    out[offset + 2 * plane + i] = d[i * 4 + 2];
  }
}

/* ---------- corners ---------- */
export async function detectCorners(img) {
  const sess = await session('corners');
  const w = img.width, h = img.height, s = S / Math.max(w, h);
  const ox = (S - w * s) / 2, oy = (S - h * s) / 2;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, ox, oy, w * s, h * s);
  const data = new Float32Array(3 * S * S);
  toTensorData(g.getImageData(0, 0, S, S), 1, S, S, data, 0);
  const res = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', data, [1, 3, S, S]) });
  const out = res[sess.outputNames[0]].data;
  const hm = new Float32Array(OS * OS), mask = new Float32Array(OS * OS);
  for (let i = 0; i < OS * OS; i++) { hm[i] = 1 / (1 + Math.exp(-out[i])); mask[i] = 1 / (1 + Math.exp(-out[OS * OS + i])); }
  let quad = pickQuad(hm, mask);
  if (!quad) return null;
  // heatmap cells -> work image px
  quad = quad.map(([x, y]) => [((x * S / OS) - ox) / s, ((y * S / OS) - oy) / s]);
  return orderClockwise(quad);
}

function peaks(hm) {
  const out = [];
  for (let y = 0; y < OS; y++) for (let x = 0; x < OS; x++) {
    const v = hm[y * OS + x];
    if (v < 0.04) continue;
    let isMax = true;
    for (let dy = -2; dy <= 2 && isMax; dy++) for (let dx = -2; dx <= 2; dx++) {
      const yy = y + dy, xx = x + dx;
      if ((dy || dx) && yy >= 0 && yy < OS && xx >= 0 && xx < OS && hm[yy * OS + xx] > v) { isMax = false; break; }
    }
    if (!isMax) continue;
    let sw = 0, sx = 0, sy = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || yy >= OS || xx < 0 || xx >= OS) continue;
      const ww = hm[yy * OS + xx]; sw += ww; sx += ww * (xx + 0.5); sy += ww * (yy + 0.5);
    }
    out.push([sx / sw, sy / sw, v]);
  }
  out.sort((a, b) => b[2] - a[2]);
  return out.slice(0, 9);
}

export function orderClockwise(q) {
  const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4;
  return q.slice().sort((a, b) => Math.atan2(b[1] - cy, b[0] - cx) - Math.atan2(a[1] - cy, a[0] - cx));
}

function convex(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(z) < 1e-6) return false;
    if (sign && Math.sign(z) !== sign) return false;
    sign = Math.sign(z);
  }
  return true;
}

function inside(q, x, y) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const z = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (z === 0) continue;
    if (sign && Math.sign(z) !== sign) return false;
    sign = Math.sign(z);
  }
  return true;
}

function iou(q, mask) {
  let inter = 0, uni = 0;
  for (let y = 0; y < OS; y++) for (let x = 0; x < OS; x++) {
    const m = mask[y * OS + x] > 0.5, p = inside(q, x + 0.5, y + 0.5);
    if (m && p) inter++;
    if (m || p) uni++;
  }
  return uni ? inter / uni : 0;
}

function maskQuad(mask) {
  // extreme points of the mask in eight directions, the four that span the largest quad
  const pts = [];
  for (let y = 0; y < OS; y++) for (let x = 0; x < OS; x++) if (mask[y * OS + x] > 0.5) pts.push([x + 0.5, y + 0.5]);
  if (pts.length < 30) return null;
  const ext = [];
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, dx = Math.cos(a), dy = Math.sin(a);
    let best = null, bv = -1e9;
    for (const p of pts) { const v = p[0] * dx + p[1] * dy; if (v > bv) { bv = v; best = p; } }
    ext.push(best);
  }
  let bestQ = null, bestA = 0;
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) for (let c = b + 1; c < 8; c++) for (let d = c + 1; d < 8; d++) {
    const q = orderClockwise([ext[a], ext[b], ext[c], ext[d]]);
    if (!convex(q)) continue;
    const ar = area(q);
    if (ar > bestA) { bestA = ar; bestQ = q; }
  }
  return bestQ;
}

function area(q) {
  let s = 0;
  for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}

function pickQuad(hm, mask) {
  const pk = peaks(hm);
  let best = null, bs = -1;
  for (let a = 0; a < pk.length; a++) for (let b = a + 1; b < pk.length; b++) for (let c = b + 1; c < pk.length; c++) for (let d = c + 1; d < pk.length; d++) {
    const q = orderClockwise([pk[a], pk[b], pk[c], pk[d]]);
    if (!convex(q) || area(q) < 60) continue;
    const sc = (pk[a][2] + pk[b][2] + pk[c][2] + pk[d][2]) / 4 + 1.5 * iou(q, mask);
    if (sc > bs) { bs = sc; best = q; }
  }
  const mq = maskQuad(mask);
  if (!best) return mq;
  if (mq) {
    // a corner the heatmap missed (hidden behind a piece): the mask's corner is closer to the truth
    const fit = iou(best, mask), mfit = iou(mq, mask);
    if (mfit > fit + 0.15) return mq;
  }
  return best.map(p => [p[0], p[1]]);
}

/* ---------- geometry ---------- */
export function homography(src, dst) {
  // solve the 8 unknowns with Gaussian elimination
  const A = [], B = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  }
  for (let i = 0; i < 8; i++) {
    let p = i;
    for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [B[i], B[p]] = [B[p], B[i]];
    for (let r = 0; r < 8; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c];
      B[r] -= f * B[i];
    }
  }
  const h = B.map((b, i) => b / A[i][i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
export function project(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}
const BOARD = [[0, 0], [8, 0], [8, 8], [0, 8]];

/* corners a1,h1,h8,a8 -> 64 crop boxes [x0,y0,x1,y1], index rank*8+file (same as training) */
export function cropBoxes(corners) {
  const H = homography(BOARD, corners);
  const boxes = [];
  for (let sq = 0; sq < 64; sq++) {
    const f = sq % 8, r = (sq / 8) | 0;
    const q = [[f, r], [f + 1, r], [f + 1, r + 1], [f, r + 1]].map(([x, y]) => project(H, x, y));
    const cx = project(H, f + 0.5, r + 0.5)[0];
    const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const top = Math.min(...ys), bot = Math.max(...ys), hq = bot - top;
    boxes.push([cx - 0.62 * w, top - 1.45 * w, cx + 0.62 * w, bot + 0.08 * hq]);
  }
  return boxes;
}

/* digital boards: the square itself and 10% around it, 64x64 (same as training) */
export function cropBoxes2d(corners) {
  const H = homography(BOARD, corners);
  const boxes = [];
  for (let sq = 0; sq < 64; sq++) {
    const f = sq % 8, r = (sq / 8) | 0;
    const q = [[f, r], [f + 1, r], [f + 1, r + 1], [f, r + 1]].map(([x, y]) => project(H, x, y));
    const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const mx = (x1 - x0) * 0.1, my = (y1 - y0) * 0.1;
    boxes.push([x0 - mx, y0 - my, x1 + mx, y1 + my]);
  }
  return boxes;
}

/* ---------- pieces ---------- */
/* corners: clockwise image quad (any start). Returns per image-square class probabilities, with squares indexed
   as if corners[0] were a1 and corners[1] h1. */
export async function classify(img, corners, mode = 'screen') {
  const real = mode === 'real';
  const sess = await session(real ? 'pieces' : 'pieces2d');
  const CW = 64, CH = real ? 128 : 64;
  const boxes = real ? cropBoxes(corners) : cropBoxes2d(corners);
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  const data = new Float32Array(64 * 3 * CW * CH);
  boxes.forEach(([x0, y0, x1, y1], i) => {
    g.clearRect(0, 0, CW, CH);
    g.fillStyle = '#000'; g.fillRect(0, 0, CW, CH);
    drawClipped(g, img, x0, y0, x1, y1, CW, CH);
    toTensorData(g.getImageData(0, 0, CW, CH), 1, CW, CH, data, i * 3 * CW * CH);
  });
  const res = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', data, [64, 3, CH, CW]) });
  const logits = res[sess.outputNames[0]].data;
  const probs = [];
  for (let i = 0; i < 64; i++) {
    const l = Array.from(logits.slice(i * 13, i * 13 + 13)), m = Math.max(...l);
    const e = l.map(v => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0);
    probs.push(e.map(v => v / s));
  }
  return probs;
}

// draw the source box into the whole canvas; parts outside the image stay black (as in training)
function drawClipped(g, img, x0, y0, x1, y1, CW, CH) {
  const W = img.width, H = img.height;
  const sx0 = Math.max(0, x0), sy0 = Math.max(0, y0), sx1 = Math.min(W, x1), sy1 = Math.min(H, y1);
  if (sx1 <= sx0 || sy1 <= sy0) return;
  const kx = CW / (x1 - x0), ky = CH / (y1 - y0);
  g.drawImage(img, sx0, sy0, sx1 - sx0, sy1 - sy0, (sx0 - x0) * kx, (sy0 - y0) * ky, (sx1 - sx0) * kx, (sy1 - sy0) * ky);
}

/* square brightness for the a1-is-dark rule: mean luma in the middle of each square (index as in classify) */
export function squareLuma(img, corners) {
  const H = homography(BOARD, corners);
  const g = img.getContext('2d', { willReadFrequently: true });
  const d = g.getImageData(0, 0, img.width, img.height).data;
  const out = [];
  for (let sq = 0; sq < 64; sq++) {
    const f = sq % 8, r = (sq / 8) | 0;
    let sum = 0, n = 0;
    for (let a = 0.25; a <= 0.75; a += 0.1) for (let b = 0.25; b <= 0.75; b += 0.1) {
      const [x, y] = project(H, f + a, r + b);
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) continue;
      const k = (yi * img.width + xi) * 4;
      sum += 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; n++;
    }
    out.push(n ? sum / n : 128);
  }
  return out;
}

/* rotation k: board square (f,r) is image square rot(f,r,k) */
export function rotIndex(sq, k) {
  let f = sq % 8, r = (sq / 8) | 0;
  for (let i = 0; i < k; i++) { const nf = 7 - r, nr = f; f = nf; r = nr; }
  return r * 8 + f;
}

/* image-square probabilities + luma -> board (array of 64 piece letters, index rank*8+file) with a chosen rotation */
export function decide(probs, luma, forceRot) {
  // 1. parity: squares with (f+r) even under k=0 are a1-coloured. Compare their luma on squares that look empty.
  let even = [], odd = [];
  for (let sq = 0; sq < 64; sq++) {
    const f = sq % 8, r = (sq / 8) | 0;
    if (probs[sq][0] < 0.5) continue;
    ((f + r) % 2 ? odd : even).push(luma[sq]);
  }
  if (even.length < 3 || odd.length < 3) {
    even = []; odd = [];
    for (let sq = 0; sq < 64; sq++) (((sq % 8) + ((sq / 8) | 0)) % 2 ? odd : even).push(luma[sq]);
  }
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  const evenDark = med(even) < med(odd);
  const cands = evenDark ? [0, 2] : [1, 3];
  const results = [0, 1, 2, 3].map(k => {
    const board = [];
    for (let sq = 0; sq < 64; sq++) board.push(probs[rotIndex(sq, k)]);
    return { k, probs: board };
  });
  // 2. white at the bottom: white pieces on low ranks, black on high ranks
  const side = res => {
    let s = 0;
    res.probs.forEach((p, sq) => {
      const r = (sq / 8) | 0;
      const w = p.slice(1, 7).reduce((a, b) => a + b, 0), b = p.slice(7).reduce((a, b) => a + b, 0);
      s += (w - b) * (3.5 - r);
      // pawns never stand on their first rank
      if (r === 0) s -= 3 * p[1]; if (r === 7) s -= 3 * p[7];
    });
    return s;
  };
  let pick;
  if (forceRot != null) pick = results[forceRot];
  else pick = side(results[cands[0]]) >= side(results[cands[1]]) ? results[cands[0]] : results[cands[1]];
  return { rot: pick.k, board: fix(pick.probs) };
}

/* the most likely legal-looking position: one king each, no pawns on the first or last rank */
function fix(probs) {
  const b = probs.map(p => { let m = 0; for (let i = 1; i < 13; i++) if (p[i] > p[m]) m = i; return m; });
  for (let sq = 0; sq < 64; sq++) {
    const r = (sq / 8) | 0;
    if ((r === 0 || r === 7) && (b[sq] === 1 || b[sq] === 7)) {
      const p = probs[sq].slice(); p[1] = p[7] = -1;
      b[sq] = p.indexOf(Math.max(...p));
    }
  }
  for (const k of [6, 12]) {
    let bestSq = -1, bv = -1;
    for (let sq = 0; sq < 64; sq++) if (probs[sq][k] > bv) { bv = probs[sq][k]; bestSq = sq; }
    for (let sq = 0; sq < 64; sq++) {
      if (b[sq] === k && sq !== bestSq) { const p = probs[sq].slice(); p[k] = -1; b[sq] = p.indexOf(Math.max(...p)); }
    }
    if (bv > 0.15) b[bestSq] = k;
  }
  return b.map(i => CLASSES[i]);
}

/* corners clockwise from the image + the chosen rotation -> corners a1,h1,h8,a8 (for drawing labels) */
export function boardCorners(corners, k) {
  // rotation k: a1 is image corner k, h1 corner k+1, h8 corner k+2, a8 corner k+3
  return [0, 1, 2, 3].map(i => corners[(i + k) % 4]);
}

/* ---------- screen boards: snap the grid onto the square edges ----------
   On a digital board every line between two squares is a sharp light/dark edge. The score is the mean contrast
   across the nine vertical and nine horizontal grid lines; each corner is moved a little at a time while it rises. */
export function refineCorners(img, corners) {
  const W = img.width, H = img.height;
  const d = img.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) return -1;
    const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, k = yi * W + xi;
    return L[k] * (1 - fx) * (1 - fy) + L[k + 1] * fx * (1 - fy) + L[k + W] * (1 - fx) * fy + L[k + W + 1] * fx * fy;
  };
  const N = 48, E = 0.07;
  const score = c => {
    const Hm = homography(BOARD, c);
    let s = 0, n = 0;
    for (let i = 1; i < 8; i++) for (let j = 0; j < N; j++) {
      const t = (j + 0.5) / N * 8;
      for (const [a, b] of [[[i - E, t], [i + E, t]], [[t, i - E], [t, i + E]]]) {
        const p = project(Hm, a[0], a[1]), q = project(Hm, b[0], b[1]);
        const u = at(p[0], p[1]), v = at(q[0], q[1]);
        if (u < 0 || v < 0) continue;
        s += Math.abs(u - v); n++;
      }
    }
    return n ? s / n : 0;
  };
  let c = corners.map(p => p.slice());
  let best = score(c);
  const sqPx = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]) / 8;
  for (const step of [0.2, 0.1, 0.05, 0.025, 0.012]) {
    const st = step * sqPx;
    let improved = true, rounds = 0;
    while (improved && rounds++ < 6) {
      improved = false;
      for (let k = 0; k < 4; k++) for (let ax = 0; ax < 2; ax++) for (const sgn of [1, -1]) {
        const t = c.map(p => p.slice()); t[k][ax] += sgn * st;
        const s = score(t);
        if (s > best) { best = s; c = t; improved = true; }
      }
    }
  }
  return c;
}
