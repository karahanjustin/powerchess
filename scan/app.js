import { Chess } from './lib/chess.js';
import { Engine } from './engine.js';
import * as V from './vision.js';

const $ = id => document.getElementById(id);
const FILES = 'abcdefgh';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const engine = new Engine();

/* ---------------- settings ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('scan.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('scan.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
const settings = Object.assign({ think: 2000, multipv: 3, arrow: 1, mode: 'screen' }, store.get('settings', {}));
function saveSettings() { store.set('settings', settings); }

/* ---------------- ui helpers ---------------- */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
  if (id === 'camScreen') startCamera(); else stopCamera();
}
function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
function busy(on, text) { $('busy').classList.toggle('show', !!on); if (text) $('busyText').textContent = text; }

/* ================= 1. camera ================= */
let stream = null;
async function startCamera() {
  if (stream) return;
  const msg = $('camMsg');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = 'No camera access here. Use "Camera app" or "Gallery".'; return; }
  msg.textContent = 'Starting the camera…'; msg.style.display = '';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } } });
    if (!$('camScreen').classList.contains('show')) { stopCamera(); return; }
    const v = $('video'); v.srcObject = stream; await v.play().catch(() => {});
    msg.style.display = 'none';
  } catch (e) {
    stream = null;
    msg.textContent = 'The camera could not start (' + (e.name || e.message) + '). Allow camera access, or use "Camera app" / "Gallery".';
  }
}
function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  $('video').srcObject = null;
}
$('shutter').onclick = () => {
  const v = $('video');
  if (!stream || !v.videoWidth) { $('fileCam').click(); return; }
  const c = V.workCanvas(v, v.videoWidth, v.videoHeight);
  gotImage(c);
};
$('galleryBtn').onclick = () => $('fileIn').click();
$('nativeCam').onclick = () => $('fileCam').click();
for (const id of ['fileIn', 'fileCam']) {
  $(id).onchange = async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' });
      gotImage(V.workCanvas(bmp, bmp.width, bmp.height));
      bmp.close && bmp.close();
    } catch (err) { toast('Could not open that image'); }
  };
}
$('toBoard').onclick = () => { show('boardScreen'); render(); };

/* ================= 2. corners ================= */
let photo = null;        // work canvas (1024 px long side)
let corners = null;      // 4 image points, clockwise
let detected = null;
let lastRecog = null;    // { probs, luma, rot }

async function gotImage(canvas) {
  photo = canvas;
  corners = null;
  show('adjScreen');
  sizeAdj();
  busy(true, 'Finding the board…');
  try {
    detected = await V.detectCorners(photo, settings.mode);
  } catch (e) {
    console.error(e); detected = null;
    toast('Recognition failed to load: ' + e.message, 5000);
  }
  busy(false);
  corners = detected ? detected.map(p => p.slice()) : defaultQuad();
  $('adjHint').textContent = detected ? 'Check the grid. Drag a dot if a corner is off, then tap "Recognise position".' : 'No board found. Drag the four dots onto the corners of the 8×8 squares.';
  drawAdj();
}
function defaultQuad() {
  const w = photo.width, h = photo.height, m = Math.min(w, h) * 0.18;
  return [[m, h - m], [w - m, h - m], [w - m, m], [m, m]];
}
$('adjBack').onclick = () => show('camScreen');
$('adjReset').onclick = () => { if (detected) { corners = detected.map(p => p.slice()); drawAdj(); } else toast('No board found automatically'); };

let view = { s: 1, ox: 0, oy: 0 };
function sizeAdj() {
  const wrap = $('adjWrap'), c = $('adjCanvas'), dpr = window.devicePixelRatio || 1;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
  if (photo) {
    const s = Math.min(W / photo.width, H / photo.height);
    view = { s, ox: (W - photo.width * s) / 2, oy: (H - photo.height * s) / 2, dpr };
  }
}
function toScreen(p) { return [view.ox + p[0] * view.s, view.oy + p[1] * view.s]; }
function drawAdj() {
  const c = $('adjCanvas'), g = c.getContext('2d');
  g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  if (!photo) return;
  g.drawImage(photo, view.ox, view.oy, photo.width * view.s, photo.height * view.s);
  if (!corners) return;
  const H = V.homography([[0, 0], [8, 0], [8, 8], [0, 8]], corners);
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(127,230,80,.9)';
  g.beginPath();
  for (let i = 0; i <= 8; i++) {
    let a = toScreen(V.project(H, i, 0)), b = toScreen(V.project(H, i, 8));
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
    a = toScreen(V.project(H, 0, i)); b = toScreen(V.project(H, 8, i));
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
  }
  g.stroke();
  corners.forEach((p, i) => {
    const [x, y] = toScreen(p);
    g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2);
    g.fillStyle = i === dragIdx ? 'rgba(255,220,60,.55)' : 'rgba(127,230,80,.35)'; g.fill();
    g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke();
    g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
  });
}
let dragIdx = -1, dragOff = [0, 0];
const adjC = $('adjCanvas');
adjC.addEventListener('pointerdown', e => {
  if (!corners) return;
  const r = adjC.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  let best = -1, bd = 48;
  corners.forEach((p, i) => { const [sx, sy] = toScreen(p), d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = i; } });
  if (best < 0) return;
  dragIdx = best; const [sx, sy] = toScreen(corners[best]); dragOff = [sx - x, sy - y];
  adjC.setPointerCapture(e.pointerId);
  moveCorner(e);
});
adjC.addEventListener('pointermove', e => { if (dragIdx >= 0) moveCorner(e); });
const endDrag = () => { if (dragIdx >= 0) { dragIdx = -1; $('loupe').style.display = 'none'; corners = V.orderClockwise(corners); drawAdj(); } };
adjC.addEventListener('pointerup', endDrag);
adjC.addEventListener('pointercancel', endDrag);
function moveCorner(e) {
  const r = adjC.getBoundingClientRect();
  const x = e.clientX - r.left + dragOff[0], y = e.clientY - r.top + dragOff[1];
  const px = Math.max(0, Math.min(photo.width, (x - view.ox) / view.s)), py = Math.max(0, Math.min(photo.height, (y - view.oy) / view.s));
  corners[dragIdx] = [px, py];
  drawAdj();
  // magnifier above the finger
  const L = $('loupe'), lg = L.getContext('2d'), z = 3;
  L.style.display = 'block';
  L.style.left = Math.min(r.width - 124, Math.max(4, x - 60)) + 'px';
  L.style.top = Math.max(4, y - 170) + 'px';
  const src = 120 / (view.s * z);
  lg.fillStyle = '#000'; lg.fillRect(0, 0, 120, 120);
  lg.drawImage(photo, px - src / 2, py - src / 2, src, src, 0, 0, 120, 120);
  lg.strokeStyle = '#7fe650'; lg.lineWidth = 1.5;
  lg.beginPath(); lg.moveTo(60, 40); lg.lineTo(60, 80); lg.moveTo(40, 60); lg.lineTo(80, 60); lg.stroke();
}
window.addEventListener('resize', () => { if ($('adjScreen').classList.contains('show')) { sizeAdj(); drawAdj(); } });

$('adjGo').onclick = async () => {
  if (!photo || !corners) return;
  busy(true, 'Reading the pieces…');
  try {
    const cw = V.orderClockwise(corners);
    const probs = await V.classify(photo, cw, settings.mode);
    const luma = V.squareLuma(photo, cw);
    const res = V.decide(probs, luma, null, cw);
    lastRecog = { probs, luma, rot: res.rot, corners: cw };
    loadBoardArray(res.board, sideToMove());
    show('boardScreen');
    render();
    toast('Check the position. Edit fixes a square or turns the board.');
  } catch (e) {
    console.error(e); toast('Recognition failed: ' + e.message, 5000);
  }
  busy(false);
};

/* ================= 3. position and moves ================= */
let startFen = store.get('startFen', START);
let line = store.get('line', []);      // [{san, from, to, promotion}]
let ply = store.get('ply', line.length);
let orient = store.get('orient', 'w');
let editing = false, editPiece = 'P';
let analysis = null;                    // { fen, lines, best }
let live = false;

function validFen(f) { try { new Chess(f); return true; } catch (e) { return false; } }
if (!validFen(startFen)) { startFen = START; line = []; ply = 0; }

function game(upto = ply) {
  const g = new Chess(startFen);
  for (let i = 0; i < upto && i < line.length; i++) {
    try { g.move({ from: line[i].from, to: line[i].to, promotion: line[i].promotion }); } catch (e) { line = line.slice(0, i); break; }
  }
  return g;
}
function persist() { store.set('startFen', startFen); store.set('line', line); store.set('ply', ply); store.set('orient', orient); }

/* the placement part of a FEN <-> 64 letters (index rank*8+file) */
function boardArray(fen) {
  const b = new Array(64).fill('');
  fen.split(' ')[0].split('/').forEach((row, i) => {
    let f = 0;
    for (const ch of row) { if (/\d/.test(ch)) f += +ch; else { b[(7 - i) * 8 + f] = ch; f++; } }
  });
  return b;
}
function placement(b) {
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let s = '', n = 0;
    for (let f = 0; f < 8; f++) { const p = b[r * 8 + f]; if (!p) n++; else { if (n) s += n; n = 0; s += p; } }
    if (n) s += n; rows.push(s);
  }
  return rows.join('/');
}
function castleRightsPossible(b) {
  let c = '';
  if (b[4] === 'K' && b[7] === 'R') c += 'K';
  if (b[4] === 'K' && b[0] === 'R') c += 'Q';
  if (b[60] === 'k' && b[63] === 'r') c += 'k';
  if (b[60] === 'k' && b[56] === 'r') c += 'q';
  return c;
}

/* raw position (may be illegal): placement, turn, castling */
let raw = null;
function rawFromFen(f) { const p = f.split(' '); return { b: boardArray(f), turn: p[1] || 'w', castle: p[2] && p[2] !== '-' ? p[2] : '' }; }
function rawFen(r) {
  const cs = r.castle.split('').filter(ch => castleRightsPossible(r.b).includes(ch)).join('');
  return placement(r.b) + ' ' + r.turn + ' ' + (cs || '-') + ' - 0 1';
}
function sideToMove() { return raw ? raw.turn : 'w'; }

function problems(r) {
  const b = r.b, out = [];
  const cnt = p => b.filter(x => x === p).length;
  if (cnt('K') !== 1) out.push(cnt('K') ? 'White has more than one king' : 'White has no king');
  if (cnt('k') !== 1) out.push(cnt('k') ? 'Black has more than one king' : 'Black has no king');
  for (let f = 0; f < 8; f++) if (/p/i.test(b[f]) || /p/i.test(b[56 + f])) { out.push('A pawn stands on the first or last rank'); break; }
  if (cnt('P') > 8 || cnt('p') > 8) out.push('More than eight pawns of one colour');
  if (!out.length) {
    // the side that is not to move may not be in check
    const other = placement(b) + ' ' + (r.turn === 'w' ? 'b' : 'w') + ' - - 0 1';
    try { if (new Chess(other, { skipValidation: true }).inCheck()) out.push((r.turn === 'w' ? 'Black' : 'White') + ' is in check, so it cannot be ' + (r.turn === 'w' ? 'White' : 'Black') + ' to move'); }
    catch (e) { /* ignore */ }
  }
  return out;
}

function loadBoardArray(b, turn) {
  const r = { b, turn: turn || 'w', castle: castleRightsPossible(b) };
  setRaw(r);
}
function setRaw(r) {
  raw = r;
  const errs = problems(r);
  if (!errs.length) {
    const f = rawFen(r);
    if (validFen(f)) { startFen = f; line = []; ply = 0; }
  }
  analysis = null;
  engine.stop();
  persist();
}
// the position being shown, as a raw record (for the setup panel)
function currentRaw() {
  if (raw && (editing || problems(raw).length)) return raw;
  return rawFromFen(game().fen());
}

/* ---------------- board rendering ---------------- */
const boardEl = $('board');
const sqEls = [];
for (let i = 0; i < 64; i++) { const d = document.createElement('div'); d.className = 'sq'; boardEl.appendChild(d); sqEls.push(d); }
const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
arrowSvg.id = 'arrows'; arrowSvg.setAttribute('viewBox', '0 0 800 800'); boardEl.appendChild(arrowSvg);

function sqAt(i) { // screen cell -> board square index
  const row = (i / 8) | 0, col = i % 8;
  return orient === 'w' ? (7 - row) * 8 + col : row * 8 + (7 - col);
}
function cellOf(sq) { const f = sq % 8, r = (sq / 8) | 0; return orient === 'w' ? [f, 7 - r] : [7 - f, r]; }
const sqName = sq => FILES[sq % 8] + (((sq / 8) | 0) + 1);
const nameSq = n => (n.charCodeAt(1) - 49) * 8 + (n.charCodeAt(0) - 97);
const pieceImg = p => 'pieces/' + (p === p.toUpperCase() ? 'w' : 'b') + p.toUpperCase() + '.svg';

let selected = -1;
function render() {
  const g = game();
  const showRaw = raw && (editing || problems(raw).length);
  const b = showRaw ? raw.b : boardArray(g.fen());
  const last = !showRaw && ply > 0 ? line[ply - 1] : null;
  const legalTo = new Set();
  if (selected >= 0 && !editing && !showRaw) g.moves({ square: sqName(selected), verbose: true }).forEach(m => legalTo.add(nameSq(m.to)));
  let checkSq = -1;
  if (!showRaw && g.inCheck()) { const k = g.turn() === 'w' ? 'K' : 'k'; checkSq = b.indexOf(k); }
  for (let i = 0; i < 64; i++) {
    const sq = sqAt(i), el = sqEls[i], f = sq % 8, r = (sq / 8) | 0;
    let cls = 'sq ' + ((f + r) % 2 ? 'l' : 'd');
    if (last && (sqName(sq) === last.from || sqName(sq) === last.to)) cls += ' last';
    if (sq === selected) cls += ' selected';
    if (sq === checkSq) cls += ' check';
    el.className = cls;
    let html = '';
    const row = (i / 8) | 0, col = i % 8;
    if (col === 0) html += `<span class="coord r">${r + 1}</span>`;
    if (row === 7) html += `<span class="coord f">${FILES[f]}</span>`;
    if (b[sq]) html += `<img class="pc" src="${pieceImg(b[sq])}" alt="${b[sq]}" draggable="false">`;
    if (legalTo.has(sq)) html += b[sq] ? '<span class="ring"></span>' : '<span class="dot"></span>';
    el.innerHTML = html;
  }
  drawArrow();
  renderSetup();
  renderMoves();
  renderAnalysis();
  $('undoBtn').disabled = ply === 0; $('redoBtn').disabled = ply >= line.length;
}

function drawArrow() {
  arrowSvg.innerHTML = '';
  if (!settings.arrow || !analysis || analysis.fen !== game().fen() || !analysis.lines.length) return;
  const mv = analysis.lines[0].pv[0];
  if (!mv) return;
  const [fx, fy] = cellOf(nameSq(mv.slice(0, 2))), [tx, ty] = cellOf(nameSq(mv.slice(2, 4)));
  const x1 = fx * 100 + 50, y1 = fy * 100 + 50, x2 = tx * 100 + 50, y2 = ty * 100 + 50;
  const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const ex = x2 - ux * 32, ey = y2 - uy * 32;
  arrowSvg.innerHTML = `<g opacity=".8" fill="#15781B" stroke="#15781B"><line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke-width="18" stroke-linecap="round"/>` +
    `<polygon points="${x2},${y2} ${ex - uy * 28},${ey + ux * 28} ${ex + uy * 28},${ey - ux * 28}" stroke="none"/></g>`;
}

function renderSetup() {
  const r = currentRaw();
  document.querySelectorAll('#turnSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === r.turn));
  const poss = castleRightsPossible(r.b);
  document.querySelectorAll('[data-c]').forEach(b => {
    const c = b.dataset.c;
    b.disabled = !poss.includes(c);
    b.classList.toggle('on', poss.includes(c) && r.castle.includes(c));
  });
  const errs = raw && (editing || problems(raw).length) ? problems(raw) : [];
  $('posWarn').style.display = errs.length ? '' : 'none';
  $('posWarnText').textContent = errs.join('. ') + (errs.length ? '. Use Edit to fix the position.' : '');
  $('bestBtn').disabled = !!errs.length || editing;
  $('fenIn').value = raw && (editing || errs.length) ? rawFen(raw) : game().fen();
}

function renderMoves() {
  const el = $('moves');
  if (!line.length) { el.innerHTML = '<span class="n">Make a move on the board, for either side.</span>'; return; }
  const g = new Chess(startFen);
  let n = +startFen.split(' ')[5] || 1, white = g.turn() === 'w';
  let html = '';
  line.forEach((m, i) => {
    if (white) html += `<span class="n">${n}.</span>`; else if (i === 0) html += `<span class="n">${n}…</span>`;
    html += `<span data-i="${i + 1}" class="${i + 1 === ply ? 'cur' : ''}">${m.san}</span>`;
    if (!white) n++;
    white = !white;
  });
  el.innerHTML = html;
}
$('moves').onclick = e => { const i = e.target.dataset && e.target.dataset.i; if (i) { ply = +i; afterChange(); } };

/* ---------------- moving ---------------- */
function tryMove(from, to) {
  const g = game();
  const fromN = sqName(from), toN = sqName(to);
  const cands = g.moves({ square: fromN, verbose: true }).filter(m => m.to === toN);
  if (!cands.length) return false;
  if (cands.some(m => m.promotion)) {
    render();
    askPromotion(g.turn()).then(p => { if (p) doMove({ from: fromN, to: toN, promotion: p }); });
    return true;
  }
  doMove({ from: fromN, to: toN });
  return true;
}
function doMove(m) {
  const g = game();
  let res;
  try { res = g.move(m); } catch (e) { return; }
  line = line.slice(0, ply);
  line.push({ san: res.san, from: res.from, to: res.to, promotion: res.promotion });
  ply++;
  raw = null;
  afterChange();
}
function afterChange() {
  selected = -1;
  if (!analysis || analysis.fen !== game().fen()) { analysis = null; engine.stop(); }
  persist();
  render();
  if (live) runAnalysis();
}
function askPromotion(color) {
  return new Promise(res => {
    const d = $('promoDlg'), row = $('promoRow');
    row.innerHTML = '';
    for (const p of ['q', 'r', 'b', 'n']) {
      const b = document.createElement('button');
      b.innerHTML = `<img src="${pieceImg(color === 'w' ? p.toUpperCase() : p)}" alt="${p}">`;
      b.onclick = () => { d.close(); res(p); };
      row.appendChild(b);
    }
    d.onclose = () => res(null);
    d.showModal();
  });
}

/* pointer: tap-tap and drag */
let press = null;
const dragEl = $('drag');
function cellFromPoint(x, y) {
  const r = boardEl.getBoundingClientRect();
  if (x < r.left || y < r.top || x >= r.right || y >= r.bottom) return -1;
  const col = Math.floor((x - r.left) / r.width * 8), row = Math.floor((y - r.top) / r.height * 8);
  return sqAt(row * 8 + col);
}
boardEl.addEventListener('pointerdown', e => {
  const sq = cellFromPoint(e.clientX, e.clientY);
  if (sq < 0) return;
  e.preventDefault();
  if (editing) { editSquare(sq); return; }
  if (raw && problems(raw).length) { toast('Fix the position first (Edit)'); return; }
  const g = game(), b = boardArray(g.fen()), p = b[sq];
  const own = p && ((p === p.toUpperCase()) === (g.turn() === 'w'));
  if (selected >= 0 && selected !== sq && !own) { tryMove(selected, sq); selected = -1; render(); return; }
  if (own) {
    selected = sq; render();
    press = { sq, x: e.clientX, y: e.clientY, moved: false, p };
    boardEl.setPointerCapture(e.pointerId);
  } else { selected = -1; render(); }
});
boardEl.addEventListener('pointermove', e => {
  if (!press) return;
  if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) return;
  if (!press.moved) {
    press.moved = true;
    const size = boardEl.getBoundingClientRect().width / 8 * 1.15;
    dragEl.innerHTML = `<img src="${pieceImg(press.p)}" style="width:${size}px;height:${size}px">`;
    dragEl.style.display = 'block';
    const i = sqEls.findIndex((_, k) => sqAt(k) === press.sq);
    const img = sqEls[i].querySelector('.pc'); if (img) img.style.opacity = '.3';
    press.size = size;
  }
  dragEl.style.left = (e.clientX - press.size / 2) + 'px';
  dragEl.style.top = (e.clientY - press.size / 2) + 'px';
});
function endPress(e) {
  if (!press) return;
  const p = press; press = null;
  dragEl.style.display = 'none';
  if (!p.moved) return;
  const sq = cellFromPoint(e.clientX, e.clientY);
  if (sq >= 0 && sq !== p.sq && tryMove(p.sq, sq)) { selected = -1; return; }
  render();
}
boardEl.addEventListener('pointerup', endPress);
boardEl.addEventListener('pointercancel', endPress);

/* ---------------- setup panel ---------------- */
document.querySelectorAll('#turnSeg button').forEach(btn => btn.onclick = () => {
  const r = currentRaw(); r.turn = btn.dataset.v; setRaw(r); render(); if (live) runAnalysis();
});
document.querySelectorAll('[data-c]').forEach(btn => btn.onclick = () => {
  const r = currentRaw(), c = btn.dataset.c;
  r.castle = r.castle.includes(c) ? r.castle.replace(c, '') : r.castle + c;
  setRaw(r); render(); if (live) runAnalysis();
});

/* ---------------- edit mode ---------------- */
const pal = $('palette');
for (const p of ['K', 'Q', 'R', 'B', 'N', 'P', 'x', 'k', 'q', 'r', 'b', 'n', 'p']) {
  const b = document.createElement('button');
  b.dataset.p = p;
  b.innerHTML = p === 'x' ? '<svg class="i" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>' : `<img src="${pieceImg(p)}" alt="${p}">`;
  b.title = p === 'x' ? 'Remove' : p;
  b.onclick = () => { editPiece = p; pal.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
  if (p === 'x') { b.style.gridRow = 'span 2'; b.style.aspectRatio = 'auto'; }
  pal.appendChild(b);
}
// put the remove button in the 7th column, spanning both rows
pal.querySelector('[data-p="x"]').style.gridColumn = '7'; pal.querySelector('[data-p="x"]').style.gridRow = '1 / span 2';
function setEditing(on) {
  if (on && !editing) raw = currentRaw();
  editing = on;
  $('editPanel').style.display = on ? '' : 'none';
  $('editBtn').classList.toggle('on', on);
  pal.classList.toggle('show', on);
  if (on) { engine.stop(); analysis = null; pal.querySelector(`[data-p="${editPiece}"]`).click(); }
  else if (raw) setRaw(raw);
  selected = -1;
  render();
}
function editSquare(sq) {
  const r = raw || currentRaw();
  r.b[sq] = editPiece === 'x' || r.b[sq] === editPiece ? '' : editPiece;
  raw = r;
  // newly possible castling rights are switched on, as on a set-up board
  render();
}
$('editBtn').onclick = () => setEditing(!editing);
$('editDone').onclick = () => setEditing(false);
$('startPos').onclick = () => { raw = rawFromFen(START); render(); };
$('clearPos').onclick = () => { raw = { b: new Array(64).fill(''), turn: 'w', castle: '' }; render(); };
function turn(times) {
  for (let i = 0; i < times; i++) turn90();
}
$('rot180').onclick = () => turn(2);
$('rotRecog').onclick = () => turn(1);
function turn90() {
  const r = raw || currentRaw();
  const nb = new Array(64).fill('');
  for (let sq = 0; sq < 64; sq++) { const f = sq % 8, rk = (sq / 8) | 0; nb[(7 - f) * 8 + rk] = r.b[sq]; }
  r.b = nb; r.castle = castleRightsPossible(nb); raw = r; render();
};

/* ---------------- toolbar ---------------- */
$('undoBtn').onclick = () => { if (ply > 0) { ply--; afterChange(); } };
$('redoBtn').onclick = () => { if (ply < line.length) { ply++; afterChange(); } };
$('flipBtn').onclick = () => { orient = orient === 'w' ? 'b' : 'w'; persist(); render(); };
$('newScan').onclick = () => { setEditing(false); show('camScreen'); };
$('photoBtn').onclick = () => {
  if (!photo) { toast('No photo yet. Tap the camera icon.'); return; }
  const c = document.createElement('canvas'); c.width = photo.width; c.height = photo.height;
  const g = c.getContext('2d'); g.drawImage(photo, 0, 0);
  if (lastRecog) {
    const bc = V.boardCorners(lastRecog.corners, lastRecog.rot);
    const H = V.homography([[0, 0], [8, 0], [8, 8], [0, 8]], bc);
    g.strokeStyle = 'rgba(127,230,80,.9)'; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 8; i++) {
      let a = V.project(H, i, 0), b = V.project(H, i, 8); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      a = V.project(H, 0, i); b = V.project(H, 8, i); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
    }
    g.stroke();
    g.font = 'bold 22px system-ui'; g.fillStyle = '#ffeb3b'; g.strokeStyle = '#000'; g.lineWidth = 4;
    const [x, y] = V.project(H, 0.5, 0.5);
    g.strokeText('a1', x - 11, y + 8); g.fillText('a1', x - 11, y + 8);
  }
  $('photoThumb').src = c.toDataURL('image/jpeg', 0.85);
  $('photoDlg').showModal();
};
$('photoClose').onclick = () => $('photoDlg').close();
$('reAdjust').onclick = () => { $('photoDlg').close(); show('adjScreen'); sizeAdj(); if (lastRecog) corners = lastRecog.corners.map(p => p.slice()); drawAdj(); };

/* ---------------- engine ---------------- */
function scoreWhite(l, turn) {
  const s = turn === 'w' ? 1 : -1;
  return l.mate != null ? { mate: l.mate * s } : { cp: l.cp * s };
}
function fmtScore(sc) {
  if (sc.mate != null) return (sc.mate > 0 ? '+' : '-') + 'M' + Math.abs(sc.mate);
  const v = sc.cp / 100;
  return (v > 0 ? '+' : '') + v.toFixed(2);
}
function pvSan(fen, pv, max = 8) {
  const g = new Chess(fen), out = [];
  let n = +fen.split(' ')[5] || 1, white = g.turn() === 'w';
  for (const u of pv.slice(0, max)) {
    let m;
    try { m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch (e) { break; }
    out.push((white ? n + '.' : (out.length ? '' : n + '…')) + m.san);
    if (!white) n++;
    white = !white;
  }
  return out;
}
function renderAnalysis() {
  const fen = game().fen(), turn = fen.split(' ')[1];
  const el = $('bestOut');
  const g = game();
  if (g.isGameOver()) {
    const t = g.isCheckmate() ? 'Checkmate. ' + (turn === 'w' ? 'Black' : 'White') + ' wins.' : g.isStalemate() ? 'Stalemate.' : 'Draw.';
    el.innerHTML = `<b>${t}</b>`; $('playBest').disabled = true;
    setEval(g.isCheckmate() ? { mate: turn === 'w' ? -0 : 0, over: turn } : { cp: 0 });
    return;
  }
  if (!analysis || analysis.fen !== fen) {
    el.innerHTML = raw && problems(raw).length ? '' : '<span class="small-label">Tap "Best move" to ask Stockfish.</span>';
    $('playBest').disabled = true; setEval(null); return;
  }
  const lines = analysis.lines;
  if (!lines.length) { el.innerHTML = '<span class="small-label">Thinking…</span>'; return; }
  const top = lines[0], sc = scoreWhite(top, turn);
  setEval(sc, top.depth);
  let html = '';
  lines.forEach((l, i) => {
    const s = pvSan(fen, l.pv);
    if (!s.length) return;
    html += `<div class="line"><span class="sc">${fmtScore(scoreWhite(l, turn))}</span><span class="mv"><b>${s[0]}</b> ${s.slice(1).join(' ')}</span></div>`;
  });
  const bestSan = pvSan(fen, top.pv, 1)[0];
  el.innerHTML = `<div style="margin-bottom:4px">${analysis.done ? 'Best move' : 'Thinking'}: <b style="font-size:18px">${bestSan || ''}</b> <span class="small-label" style="display:inline">depth ${top.depth}</span></div>` + html;
  $('playBest').disabled = !top.pv[0];
}
function setEval(sc, depth) {
  const fill = $('evalfill'), t = $('evaltext');
  if (!sc) { fill.style.width = '50%'; t.textContent = '–'; return; }
  if (sc.over) { fill.style.width = sc.over === 'w' ? '0%' : '100%'; t.textContent = '#'; return; }
  let p;
  if (sc.mate != null) p = sc.mate > 0 ? 100 : 0;
  else p = 50 + 50 * (2 / (1 + Math.exp(-0.004 * sc.cp)) - 1);
  fill.style.width = p + '%';
  t.textContent = fmtScore(sc);
}
async function runAnalysis() {
  if (raw && problems(raw).length) return;
  const g = game();
  if (g.isGameOver()) { render(); return; }
  const fen = g.fen();
  analysis = { fen, lines: [], done: false };
  renderAnalysis();
  $('bestBtn').textContent = 'Thinking…';
  try {
    const res = await engine.analyse(fen, { movetime: settings.think, multipv: settings.multipv }, lines => {
      if (!analysis || analysis.fen !== fen) return;
      analysis.lines = lines;
      renderAnalysis(); drawArrow();
    });
    if (analysis && analysis.fen === fen && !res.stopped) {
      analysis.done = true;
      if (res.lines.length) analysis.lines = res.lines;
      renderAnalysis(); drawArrow();
    }
  } catch (e) {
    toast('Engine error: ' + e.message, 4000);
  }
  $('bestBtn').textContent = 'Best move';
}
$('bestBtn').onclick = () => runAnalysis();
$('playBest').onclick = () => {
  if (!analysis || !analysis.lines.length) return;
  const u = analysis.lines[0].pv[0];
  doMove({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
};
$('liveBtn').onclick = () => { live = !live; $('liveBtn').classList.toggle('on', live); if (live) runAnalysis(); else engine.stop(); };

/* ---------------- FEN, settings ---------------- */
$('fenSet').onclick = () => {
  const f = $('fenIn').value.trim();
  const parts = f.split(/\s+/);
  if (parts.length < 1 || parts[0].split('/').length !== 8) { toast('That is not a FEN'); return; }
  const full = [parts[0], parts[1] || 'w', parts[2] || '-', parts[3] || '-', parts[4] || '0', parts[5] || '1'].join(' ');
  const r = rawFromFen(full);
  if (!problems(r).length && validFen(full)) { startFen = full; line = []; ply = 0; raw = null; analysis = null; persist(); }
  else setRaw(r);
  render();
};
$('fenCopy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('fenIn').value).then(() => toast('FEN copied')); };
$('settingsBtn').onclick = () => {
  $('thinkSel').value = settings.think; $('mpvSel').value = settings.multipv; $('arrowSel').value = settings.arrow;
  $('setDlg').showModal();
};
$('setClose').onclick = () => $('setDlg').close();
$('thinkSel').onchange = e => { settings.think = +e.target.value; saveSettings(); };
$('mpvSel').onchange = e => { settings.multipv = +e.target.value; saveSettings(); };
$('arrowSel').onchange = e => { settings.arrow = +e.target.value; saveSettings(); drawArrow(); };

/* ---------------- start ---------------- */
render();
engine.start().catch(() => {});
// load the recogniser in the background so the first photo is quick
setTimeout(() => V.loadModels(settings.mode).catch(e => console.warn('models', e)), 300);
function renderMode() { document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === settings.mode)); }
document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => {
  settings.mode = b.dataset.m; saveSettings(); renderMode();
  V.loadModels(settings.mode).catch(() => {});
  toast(settings.mode === 'screen' ? 'Screen mode: screenshots and photos of a chess app' : 'Real board mode: photos of a physical chess set');
});
renderMode();
const q = new URLSearchParams(location.search);
if (q.get('board') != null) show('boardScreen'); else show('camScreen');
window.__scan = { V, game, engine, gotImage: c => gotImage(c), state: () => ({ startFen, line, ply, raw }) };
