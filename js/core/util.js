/* ==========================================================================
   AM Sim Trainer: small shared helpers (DOM, formatting, storage, RNG, sound)
   Plain globals so the app works from file:// with no build step.
   ========================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sum = a => a.reduce((s, v) => s + v, 0);
const mean = a => (a.length ? sum(a) / a.length : 0);
const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };

/* ---------- formatting ---------- */
const Fmt = {
  money(v, dp = 0) {
    const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    return (v < 0 ? '−$' : '$') + s;
  },
  moneyS(v) {   // signed
    return (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
  },
  compact(v) {
    const a = Math.abs(v), sg = v < 0 ? '−' : '';
    if (a >= 1e9) return sg + '$' + (a / 1e9).toFixed(2) + 'bn';
    if (a >= 1e6) return sg + '$' + (a / 1e6).toFixed(2) + 'm';
    if (a >= 1e3) return sg + '$' + (a / 1e3).toFixed(1) + 'k';
    return sg + '$' + a.toFixed(0);
  },
  compactS(v) { return (v > 0 ? '+' : '') + Fmt.compact(v); },
  pct(v, dp = 2) { return (v * 100).toFixed(dp) + '%'; },
  pctS(v, dp = 2) { const x = v * 100; return (x > 0.00001 ? '+' : x < -0.00001 ? '−' : '') + Math.abs(x).toFixed(dp) + '%'; },
  pp(v, dp = 1) { const x = v * 100; return (x > 0.0001 ? '+' : x < -0.0001 ? '−' : '') + Math.abs(x).toFixed(dp) + 'pp'; },
  num(v, dp = 2) { return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); },
  int(v) { return Math.round(v).toLocaleString('en-US'); },
  bps(v, dp = 1) { return v.toFixed(dp) + ' bp'; },
  clock(ms) { ms = Math.max(0, ms); const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; },
  dur(ms) { const s = Math.round(ms / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; },
  date(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); },
};
const signCls = v => (v > 1e-9 ? 'up' : v < -1e-9 ? 'down' : 'flat');

/* ---------- storage ---------- */
const Store = {
  get(k, d) { try { const v = localStorage.getItem('amsim2.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('amsim2.' + k, JSON.stringify(v)); } catch (e) { console.warn('storage full', e); } },
  del(k) { try { localStorage.removeItem('amsim2.' + k); } catch (e) {} },
};

/* ---------- seeded RNG (mulberry32 + Box-Muller) ---------- */
function RNG(seed) {
  let a = (seed >>> 0) || 1;
  const r = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let spare = null;
  r.normal = () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0; while (u === 0) u = r(); v = r();
    const m = Math.sqrt(-2 * Math.log(u)); spare = m * Math.sin(2 * Math.PI * v); return m * Math.cos(2 * Math.PI * v);
  };
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.shuffle = arr => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
  return r;
}
const hashStr = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------- sim calendar: 21 trading days per month ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function simDate(day) {
  const m = clamp(Math.floor(day / 21), 0, 11), k = day - m * 21;
  const dom = clamp(Math.round(1 + (k / 20) * (MDAYS[m] - 2)), 1, MDAYS[m]);
  return { m, dom, label: `${dom} ${MONTHS[m]}`, q: Math.floor(m / 3) + 1 };
}

/* ---------- sound (WebAudio, generated, no files) ---------- */
const Sound = (() => {
  let ctx = null, ambient = null;
  const on = () => Store.get('sound', true);
  function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; }
  function tone(freq, t0, dur, vol = 0.08, type = 'sine') {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime + t0);
    g.gain.linearRampToValueAtTime(vol, c.currentTime + t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
    o.connect(g).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05);
  }
  function startAmbient() {
    const c = ac(); if (!c || ambient) return;
    // trading-floor murmur: brown noise through a band-pass with slow random swells
    const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.7;
    const g = c.createGain(); g.gain.value = 0.0;
    src.connect(bp).connect(g).connect(c.destination); src.start();
    const lfo = setInterval(() => { if (!ambient) return; g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, c.currentTime + 1.2); }, 1300);
    ambient = { src, g, lfo };
  }
  function stopAmbient() { if (!ambient) return; try { ambient.src.stop(); } catch (e) {} clearInterval(ambient.lfo); ambient = null; }
  return {
    on, unlock: () => (on() ? ac() : null),
    set(v) { Store.set('sound', v); if (!v) stopAmbient(); },
    ambient(v) { if (v && on() && Store.get('ambient', false)) startAmbient(); else stopAmbient(); },
    setAmbient(v) { Store.set('ambient', v); if (v && on()) startAmbient(); else stopAmbient(); },
    news(sev) { if (!on()) return; if (sev >= 3) { tone(988, 0, .18, .09); tone(1319, .12, .3, .09); tone(988, .34, .18, .07); } else { tone(880, 0, .16, .07); tone(1175, .1, .25, .06); } },
    fill() { if (on()) { tone(1568, 0, .07, .05, 'triangle'); tone(2093, .05, .1, .04, 'triangle'); } },
    reject() { if (on()) { tone(220, 0, .18, .08, 'square'); tone(185, .12, .22, .07, 'square'); } },
    breach() { if (on()) { tone(440, 0, .12, .05, 'sawtooth'); tone(440, .18, .12, .05, 'sawtooth'); } },
    quote() { if (on()) tone(1320, 0, .06, .04, 'triangle'); },
    tick() { if (on()) tone(660, 0, .05, .035); },
  };
})();

/* ---------- toasts (motion ref C10: toast stack) ---------- */
function toast(html, kind = '', ms = 4200) {
  let host = $('#toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.innerHTML = html;
  host.appendChild(t);
  while (host.children.length > 4) host.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, ms);
  return t;
}

/* ---------- count-up number animation ---------- */
function countUp(el, to, fmt = v => Math.round(v), ms = 900) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => { const k = clamp((now - t0) / ms, 0, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
