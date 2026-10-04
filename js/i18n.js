/* Language switch (English / German). The app is written in English and stays so: this file translates what reaches
   the page. A MutationObserver sees every text node and every title / placeholder / aria-label the app writes and
   swaps in the German from js/i18n_de.js (made from tools/i18n_extract.js). Sentences the code builds from pieces
   ('Floor ' + n + ' of ' + m) are looked up as templates ("Floor {0} of {1}"); the filled-in values are translated
   on their own when they are words. For a German that needs more than a swap (plurals, cases) I18N_DE_FN holds a
   function per template. Elements with the class "notranslate" (moves, openings, FENs) are left alone.
   English costs nothing: the observer only runs while German is on, or on a phone, where the words of the mouse
   become the words of the finger in both languages (a click is a tap, a right click a long press, no keyboard keys). */
(function (root) {
  const KEY = 'powerchess_lang';
  const DE = root.I18N_DE || {}, FN = root.I18N_DE_FN || {}, RX = root.I18N_DE_RX || [];
  const CTX = root.I18N_DE_CTX || []; // [selector, {English: German}]: a word that reads differently in one place
  const ATTRS = ['title', 'placeholder', 'aria-label'];
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  let lang = 'en';
  const TOUCH = !!(root.PWA && root.PWA.touch);
  const TOUCH_EN = [
    [/\b([Rr])ight[- ]click(ed)?\b/g, (m, r) => (r === 'R' ? 'Long press' : 'long press')],
    [/\b([Dd])ouble[- ]click(ed)?\b/g, '$1ouble tap'],
    [/\bClick(s?)\b/g, 'Tap$1'], [/\bclicked\b/g, 'tapped'], [/\bclick(s?)\b/g, 'tap$1'],
    [/\bpress Space\b/g, 'tap Load'], [/\bPoint at a button\b/g, 'Hold a button'], [/ \((Space|Ctrl or Cmd[^)]*)\)/g, '']
  ];
  const TOUCH_DE = [
    [/\bEin Rechtsklick\b/g, 'Langes Drücken'], [/\bein Rechtsklick\b/g, 'langes Drücken'], [/\bRechtsklick\b/g, 'Langes Drücken'],
    [/Doppelklicke die Figur/g, 'Tippe die Figur doppelt an'], [/doppelklicke sie/g, 'tippe sie doppelt an'], [/Doppelklick/g, 'Doppeltipp'], [/\bKlick\b/g, 'Tipp'], [/\bklicken\b/g, 'tippen'], [/\bklickst\b/g, 'tippst'],
    [/drück die Leertaste/g, 'tipp auf Laden'], [/Zeig auf einen Knopf/g, 'Halte einen Knopf gedrückt'], [/ \((Leertaste|Strg oder Cmd[^)]*)\)/g, '']
  ];
  const touchWords = (t, rules) => (/lick|Space|Ctrl|Leertaste|Strg|Point at|Zeig auf/.test(t) ? rules.reduce((x, r) => x.replace(r[0], r[1]), t) : t);
  try { lang = localStorage.getItem(KEY) === 'de' ? 'de' : 'en'; } catch (e) { /* no storage */ }

  /* templates: the keys with {n}, most specific first (the most fixed text). Each gets a regex and its longest fixed
     piece, a cheap test before the regex. */
  const tpls = [];
  function addTpl(k) {
    if (!/\{\d+\}/.test(k)) return;
    const lits = k.split(/\{\d+\}/);
    const order = (k.match(/\{\d+\}/g) || []).map((x) => +x.slice(1, -1));
    const re = new RegExp('^' + lits.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.*?)') + '$');
    tpls.push({ k: k, re: re, order: order, key: lits.reduce((a, b) => (b.length > a.length ? b : a), ''), weight: lits.join('').length });
  }
  Object.keys(DE).forEach((k) => { if (DE[k] != null) addTpl(k); });
  Object.keys(FN).forEach((k) => { if (DE[k] == null) addTpl(k); });
  tpls.sort((a, b) => b.weight - a.weight);

  const cache = new Map();
  const misses = new Set();
  function fill(k, args) {
    return DE[k].replace(/\{(\d+)\}/g, (m, i) => (args[+i] != null ? args[+i] : ''));
  }
  /* one text, trimmed and with single spaces; null when nothing fits. Remembered, since the parts of a text are
     tried in many ways (and the same texts come again with every redraw). */
  const memo = new Map();
  function look(t, depth) {
    if (FN[t]) return FN[t]();
    if (DE[t] != null) return DE[t];
    if (depth > 4 || t.length > 1500 || !/[A-Za-z]{2}/.test(t)) return null;
    const mk = (depth ? '1' : '0') + t;
    if (memo.has(mk)) return memo.get(mk);
    memo.set(mk, null); // while it is being worked out
    if (memo.size > 50000) memo.clear();
    const r = look0(t, depth);
    memo.set(mk, r);
    return r;
  }
  function look0(t, depth) {
    // a filled-in value the code wrote in small letters ('like a ' + name.toLowerCase()): German nouns are capitalised anyway
    if (depth && /^[a-z]/.test(t)) { const c = t[0].toUpperCase() + t.slice(1); if (FN[c]) return FN[c](); if (DE[c] != null) return DE[c]; }
    // sentences with a shape of their own (the review's and the coach's words): a regex and a function each
    for (let i = 0; i < RX.length; i++) {
      const m = RX[i][0].exec(t);
      if (m) { const r = RX[i][1].apply(null, m.slice(1)); if (r != null) return r; }
    }
    // the code added a full stop or colon to a known text
    const bare = /^(.*?[^.:!?,;])([.:!?,;]+)$/.exec(t);
    if (bare && (DE[bare[1]] != null || FN[bare[1]])) return (FN[bare[1]] ? FN[bare[1]]() : DE[bare[1]]) + bare[2];
    for (let i = 0; i < tpls.length; i++) {
      const p = tpls[i];
      if (p.key && t.indexOf(p.key) < 0) continue;
      const m = p.re.exec(t);
      if (!m) continue;
      if (FN[p.k]) { // a function gets the English values and does its own German (it may also say no: null)
        const raw = [];
        p.order.forEach((n, j) => { raw[n] = m[j + 1]; });
        const r = FN[p.k].apply(null, raw);
        if (r != null) return r;
        continue;
      }
      // the values in the order of the placeholders; a value that is itself a known text is translated too
      /* a value left in English is fine when it is a name in a long fixed text ("In {0} the power-ups ..."), not when
         the template is mostly glue ("{0} and {1}") or swallowed whole sentences */
      const args = [];
      let bad = false, unknown = 0;
      p.order.forEach((n, j) => {
        const v = m[j + 1], lead = v.match(/^\s*/)[0], tail = v.match(/\s*$/)[0], core = v.trim();
        const tr = core && /[A-Za-z]{2}/.test(core) ? look(core, depth + 1) : null;
        if (tr == null && /[A-Za-z]{2}/.test(core)) {
          if (/[.!?:] \S/.test(core)) bad = true;
          if (/ /.test(core) || /^[a-z]/.test(core)) unknown += core.length; // several words, or a word in small letters: not a name
        }
        args[n] = tr != null ? lead + tr + tail : v;
      });
      if (bad || unknown > p.weight) continue;
      return fill(p.k, args);
    }
    return glue(t, depth);
  }
  /* texts the code puts together from known ones: a full stop or colon added, brackets around, a number or name in
     brackets after, several sentences in a row */
  function glue(t, depth) {
    let m, x, y;
    if ((m = /^(.*?[^.:!?,;])([.:!?,;]+)$/.exec(t)) && (x = look(m[1], depth + 1)) != null) return x + m[2];
    if ((m = /^\((.*)\)$/.exec(t)) && (x = look(m[1], depth + 1)) != null) return '(' + x + ')';
    if ((m = /^(.+?) \(([^()]*)\)([.:]?)$/.exec(t)) && (x = look(m[1], depth + 1)) != null) return x + ' (' + ((y = look(m[2], depth + 1)) != null ? y : m[2]) + ')' + m[3];
    // a card's hover text: its "part; part" text with capitals and full stops ("Part. Part")
    if (!depth && /\. \S/.test(t)) {
      const semi = t.split('. ').map((p) => p.charAt(0).toLowerCase() + p.slice(1)).join('; ');
      const semi2 = t.charAt(0).toLowerCase() + t.slice(1).split('. ').join('; '); // a name inside keeps its capital
      x = DE[semi] != null ? DE[semi] : look(semi, depth);
      if (x == null) x = look(semi2, depth);
      if (x == null) { // part by part, as the card lines show them
        const ps = semi.split('; ').map((p) => { const y = look(p, 1); return y != null ? y : look(p.charAt(0).toUpperCase() + p.slice(1), 1); });
        if (ps.every((p) => p != null)) x = ps.join('; ');
      }
      if (x != null) return x.split('; ').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('. ');
    }
    // sentences in a row: every break between two sentences is tried, the first part known, the rest worked out again
    const re = /[.:!?] (?=\S)/g;
    let k = 0;
    while ((m = re.exec(t)) && k++ < 16) {
      const a = t.slice(0, m.index + 1), b = t.slice(m.index + 2);
      if ((x = look(a, depth + 1)) != null && (y = look(b, depth)) != null) return x + ' ' + y; // the rest is shorter, so this ends
    }
    // a number in front of a known text: "1 move left"
    if ((m = /^([\d.,]+) (.+)$/.exec(t)) && (x = look(m[2], depth + 1)) != null) return m[1] + ' ' + x;
    // a list of labels: "400, Stockfish 19, guided by the power-up search". The last part known, the rest known or
    // only names and numbers
    const ci = t.lastIndexOf(', ');
    if (ci > 0) {
      const l = t.slice(0, ci), r = t.slice(ci + 2);
      const yr = (y = look(r, depth + 1)) != null ? ', ' + y : look(', ' + r, depth + 1);
      if (yr != null) {
        const xl = look(l, depth);
        if (xl != null) return xl + yr;
        if (!/\b[a-z]{3,}/.test(l)) return l + yr;
      }
    }
    // the last sentence of a text whose full stop the code put outside: known with one
    if (/[^.:!?]$/.test(t) && (x = look(t + '.', depth + 1)) != null && /\.$/.test(x)) return x.slice(0, -1);
    return null;
  }
  // the German for a text as the page shows it, keeping its outer spaces; the text itself when nothing fits
  function T(s) {
    if (s == null) return s;
    if (lang !== 'de') return TOUCH ? touchWords(String(s), TOUCH_EN) : s;
    s = String(s);
    if (cache.has(s)) return cache.get(s);
    let out = s;
    const t = norm(s);
    if (t && /[A-Za-z]{2}/.test(t)) {
      let tr = look(t, 0);
      // a text of several lines or sentences built in one go: try line by line
      if (tr == null && /\n/.test(s.trim())) {
        out = s.split('\n').map((l) => { const x = norm(l), y = x && look(x, 0); return y != null && y !== false && x ? l.replace(x, y) : l; }).join('\n');
      }
      if (tr != null) out = s.match(/^\s*/)[0] + tr + s.match(/\s*$/)[0];
      else if (out === s) misses.add(t);
    }
    if (TOUCH) out = touchWords(touchWords(out, TOUCH_DE), TOUCH_EN);
    if (cache.size > 20000) cache.clear();
    cache.set(s, out);
    return out;
  }

  /* the page. Each translated text node and attribute remembers its English and the German it got, so that the
     observer can tell its own writes from the app's and English can come back. */
  const textOf = new WeakMap(); // text node -> { en, de }
  const attrOf = new WeakMap(); // element -> { attr: { en, de } }
  const skip = (el) => el && el.closest && el.closest('.notranslate, script, style, textarea, [contenteditable="true"]');
  function doText(n) {
    const rec = textOf.get(n), cur = n.data;
    if (rec && cur === rec.de) return;
    if (skip(n.parentElement)) return;
    let de = null;
    if (lang === 'de' && CTX.length) {
      const k = norm(cur);
      for (let i = 0; i < CTX.length && de == null; i++) if (CTX[i][1][k] != null && n.parentElement && n.parentElement.closest(CTX[i][0])) de = cur.replace(k, CTX[i][1][k]);
    }
    if (de == null) de = T(cur);
    textOf.set(n, { en: cur, de: de });
    if (de !== cur) n.data = de;
  }
  function doAttr(el, a) {
    const v = el.getAttribute(a);
    if (v == null) return;
    let recs = attrOf.get(el);
    if (recs && recs[a] && recs[a].de === v) return;
    if (skip(el)) return;
    const de = T(v);
    if (!recs) attrOf.set(el, (recs = {}));
    recs[a] = { en: v, de: de };
    if (de !== v) el.setAttribute(a, de);
  }
  function walk(node) {
    if (node.nodeType === 3) { doText(node); return; }
    if (node.nodeType !== 1 || skip(node)) return;
    ATTRS.forEach((a) => { if (node.hasAttribute(a)) doAttr(node, a); });
    const w = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (x) => (x.nodeType === 1 && x.matches('.notranslate, script, style, textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    let x;
    while ((x = w.nextNode())) {
      if (x.nodeType === 3) doText(x);
      else ATTRS.forEach((a) => { if (x.hasAttribute(a)) doAttr(x, a); });
    }
  }
  // English back: every remembered node and attribute gets its English again
  function unwalk(node) {
    const w = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let x = node;
    do {
      if (x.nodeType === 3) { const r = textOf.get(x); if (r && x.data === r.de) x.data = r.en; textOf.delete(x); }
      else if (x.nodeType === 1) {
        const recs = attrOf.get(x);
        if (recs) Object.keys(recs).forEach((a) => { if (x.getAttribute(a) === recs[a].de) x.setAttribute(a, recs[a].en); });
        attrOf.delete(x);
      }
    } while ((x = w.nextNode()));
  }
  const obs = typeof MutationObserver !== 'undefined' ? new MutationObserver((list) => {
    list.forEach((m) => {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doAttr(m.target, m.attributeName);
      else m.addedNodes.forEach(walk);
    });
  }) : null;
  function start() {
    if (!obs || !document.body) return;
    walk(document.body);
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function stop() { if (obs) { obs.takeRecords(); obs.disconnect(); } }

  // the dialogs of the browser
  ['confirm', 'alert', 'prompt'].forEach((f) => {
    const orig = root[f];
    if (typeof orig !== 'function') return;
    root[f] = function (msg) { const a = Array.prototype.slice.call(arguments); a[0] = T(msg); return orig.apply(root, a); };
  });

  function set(l) {
    l = l === 'de' ? 'de' : 'en';
    try { localStorage.setItem(KEY, l); } catch (e) { /* no storage */ }
    if (l === lang) return;
    lang = l;
    cache.clear();
    if (typeof document === 'undefined') return;
    document.documentElement.lang = l;
    // off first: the texts get their English back, then are done again for the new language
    stop();
    if (document.body) unwalk(document.body);
    if (l === 'de' || TOUCH) start();
  }

  // the two flags of the settings
  const FLAGS = {
    en: '<svg viewBox="0 0 60 30" aria-hidden="true"><clipPath id="i18nUk"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>' +
      '<path d="M0,0 v30 h60 v-30 z" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/>' +
      '<path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#i18nUk)" stroke="#C8102E" stroke-width="4"/>' +
      '<path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></svg>',
    de: '<svg viewBox="0 0 5 3" aria-hidden="true"><rect width="5" height="3" y="0" fill="#000"/><rect width="5" height="2" y="1" fill="#D00"/><rect width="5" height="1" y="2" fill="#FFCE00"/></svg>'
  };
  const NAMES = { en: 'English', de: 'Deutsch' };
  // buttons into box; onChange runs after a switch (the app draws itself again)
  function mount(box, onChange) {
    if (!box) return;
    box.innerHTML = '';
    ['en', 'de'].forEach((l) => {
      const b = document.createElement('button');
      b.className = 'flag notranslate' + (lang === l ? ' on' : '');
      b.title = NAMES[l];
      b.setAttribute('aria-label', NAMES[l]);
      b.innerHTML = FLAGS[l];
      b.onclick = () => {
        if (lang === l) return;
        set(l);
        box.querySelectorAll('.flag').forEach((x) => x.classList.toggle('on', x === b));
        if (onChange) onChange(l);
      };
      box.appendChild(b);
    });
  }

  // for finding gaps: the texts on the page now, English and German side by side
  function pairs() {
    const out = [];
    if (typeof document === 'undefined') return out;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let x;
    while ((x = w.nextNode())) { const r = textOf.get(x); if (r && /[A-Za-z]{2}/.test(r.en)) out.push([norm(r.en), norm(r.de)]); }
    return out;
  }
  root.I18N = { T: T, set: set, mount: mount, get lang() { return lang; }, misses: misses, pairs: pairs, look: (t) => look(norm(t), 0) };
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    if (lang === 'de' || TOUCH) start();
  }
})(typeof window !== 'undefined' ? window : globalThis);
