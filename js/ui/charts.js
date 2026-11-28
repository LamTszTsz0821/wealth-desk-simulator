/* ==========================================================================
   Canvas charts (no library, offline): live line chart with news & trade
   markers + crosshair, sparklines, histogram. Colours are read from CSS
   variables so both themes restyle them.
   ========================================================================== */
const Charts = (() => {
  const css = (name, el = document.documentElement) => getComputedStyle(el).getPropertyValue(name).trim() || '#888';
  function fit(cv) {
    const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
    const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    return { c, w, h };
  }
  function niceTicks(a, b, n = 5) {
    if (a === b) { a -= 1; b += 1; }
    const span = b - a, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), err = step0 / mag;
    const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag, out = [];
    for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }

  /* Live line chart.
     o = { series:[{data, upto, color, width, fill, dash, label}], xMax, xLabels:[{x,label}], yFmt,
           markers:[{x, y?, kind:'news'|'buy'|'sell', sev, label}], pad, hover:{x} } */
  function line(cv, o) {
    const { c, w, h } = fit(cv);
    const pad = Object.assign({ l: 10, r: 62, t: 14, b: 24 }, o.pad || {});
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b, xMax = o.xMax;
    let lo = Infinity, hi = -Infinity;
    for (const s of o.series) { const n = Math.min(s.upto ?? s.data.length - 1, s.data.length - 1); for (let i = 0; i <= n; i++) { const v = s.data[i]; if (v < lo) lo = v; if (v > hi) hi = v; } }
    if (o.yInclude) for (const v of o.yInclude) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    const m = (hi - lo) * .12 || Math.abs(hi) * .01 || 1; lo -= m; hi += m;
    const X = i => pad.l + (i / xMax) * pw, Y = v => pad.t + (1 - (v - lo) / (hi - lo)) * ph;
    const grid = css('--grid'), t3 = css('--text-3');
    c.font = '11px "Google Sans Code", ui-monospace, monospace'; c.textBaseline = 'middle';
    for (const v of niceTicks(lo, hi, Math.max(3, Math.round(ph / 55)))) {
      const y = Y(v); if (y < pad.t - 2 || y > pad.t + ph + 2) continue;
      c.strokeStyle = grid; c.lineWidth = 1; c.beginPath(); c.moveTo(pad.l, y + .5); c.lineTo(pad.l + pw, y + .5); c.stroke();
      c.fillStyle = t3; c.textAlign = 'left'; c.fillText(o.yFmt ? o.yFmt(v) : v.toFixed(2), pad.l + pw + 8, y);
    }
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = '11px "Google Sans Flex", system-ui, sans-serif';
    for (const xl of o.xLabels || []) { const x = X(xl.x); if (xl.tick) { c.strokeStyle = grid; c.beginPath(); c.moveTo(x + .5, pad.t); c.lineTo(x + .5, pad.t + ph); c.stroke(); } c.fillStyle = t3; c.fillText(xl.label, x + (xl.off || 0), h - 7); }
    // future shading
    if (o.now != null && o.now < xMax) { c.fillStyle = 'rgba(120,110,170,.06)'; c.fillRect(X(o.now), pad.t, pad.l + pw - X(o.now), ph); }
    // series
    for (const s of o.series) {
      const n = Math.min(s.upto ?? s.data.length - 1, s.data.length - 1); if (n < 1) continue;
      const stride = Math.max(1, Math.floor(n / (pw * 1.5)));
      c.beginPath();
      for (let i = 0; i <= n; i += stride) { const x = X(i), y = Y(s.data[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.lineTo(X(n), Y(s.data[n]));
      c.setLineDash(s.dash || []); c.lineWidth = s.width || 1.8; c.strokeStyle = s.color; c.lineJoin = 'round'; c.stroke(); c.setLineDash([]);
      if (s.fill) {
        c.lineTo(X(n), pad.t + ph); c.lineTo(X(0), pad.t + ph); c.closePath();
        const g = c.createLinearGradient(0, pad.t, 0, pad.t + ph); g.addColorStop(0, s.fill); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fill();
      }
      if (s.tag) {   // last value tag on the right axis
        const y = Y(s.data[n]); c.fillStyle = s.color; const tw = pad.r - 6;
        c.beginPath(); c.roundRect ? c.roundRect(pad.l + pw + 3, y - 9, tw, 18, 5) : c.rect(pad.l + pw + 3, y - 9, tw, 18); c.fill();
        c.fillStyle = '#fff'; c.font = '600 11px "Google Sans Code", monospace'; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText(s.tag(s.data[n]), pad.l + pw + 8, y + .5);
        c.beginPath(); c.arc(X(n), y, 3.2, 0, Math.PI * 2); c.fill();
      }
    }
    // markers
    const base = o.series[0];
    for (const mk of o.markers || []) {
      const x = X(mk.x);
      if (mk.kind === 'news') {
        const col = mk.sev >= 3 ? css('--sev3') : mk.sev === 2 ? css('--sev2') : css('--sev1');
        c.fillStyle = col; c.globalAlpha = .9; c.beginPath(); c.arc(x, pad.t + ph - 4, mk.sev >= 3 ? 4 : 3, 0, Math.PI * 2); c.fill();
        c.globalAlpha = .18; c.fillRect(x - .5, pad.t, 1, ph); c.globalAlpha = 1;
      } else if (base) {
        const y = Y(base.data[Math.min(mk.x | 0, base.data.length - 1)]), up = mk.kind === 'buy';
        c.fillStyle = up ? css('--up') : css('--down'); c.strokeStyle = '#fff'; c.lineWidth = 1.5;
        c.beginPath(); if (up) { c.moveTo(x, y + 6); c.lineTo(x - 5, y + 14); c.lineTo(x + 5, y + 14); } else { c.moveTo(x, y - 6); c.lineTo(x - 5, y - 14); c.lineTo(x + 5, y - 14); } c.closePath(); c.fill(); c.stroke();
      }
    }
    // crosshair
    if (o.hover && o.hover.x != null) {
      const i = clamp(Math.round(((o.hover.x - pad.l) / pw) * xMax), 0, Math.min(base.upto ?? base.data.length - 1, base.data.length - 1));
      const x = X(i); c.strokeStyle = css('--text-3'); c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x + .5, pad.t); c.lineTo(x + .5, pad.t + ph); c.stroke(); c.setLineDash([]);
      for (const s of o.series) { if (i > (s.upto ?? 1e9)) continue; c.fillStyle = s.color; c.beginPath(); c.arc(x, Y(s.data[i]), 3.5, 0, Math.PI * 2); c.fill(); }
      return { i, x, pad, pw };
    }
    return { pad, pw };
  }

  function spark(cv, data, from, to, color) {
    const { c, w, h } = fit(cv); if (to - from < 2) return;
    let lo = Infinity, hi = -Infinity; for (let i = from; i <= to; i++) { lo = Math.min(lo, data[i]); hi = Math.max(hi, data[i]); }
    const step = Math.max(1, Math.floor((to - from) / w));
    c.beginPath();
    for (let i = from; i <= to; i += step) { const x = ((i - from) / (to - from)) * (w - 2) + 1, y = 2 + (1 - (data[i] - lo) / (hi - lo || 1)) * (h - 4); i === from ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.lineWidth = 1.4; c.strokeStyle = color; c.lineJoin = 'round'; c.stroke();
  }

  function histogram(cv, values, mine, o = {}) {
    const { c, w, h } = fit(cv);
    const lo = Math.min(...values, mine), hi = Math.max(...values, mine), bins = o.bins || 28, bw = (hi - lo) / bins || 1;
    const cnt = new Array(bins).fill(0); for (const v of values) cnt[Math.min(bins - 1, Math.floor((v - lo) / bw))]++;
    const mx = Math.max(...cnt), pb = 22, gap = 2, colW = (w - 8) / bins;
    for (let i = 0; i < bins; i++) {
      const bh = (cnt[i] / mx) * (h - pb - 18), x = 4 + i * colW, isMe = mine >= lo + i * bw && mine < lo + (i + 1) * bw + (i === bins - 1 ? 1e-9 : 0);
      c.fillStyle = isMe ? css('--accent') : 'rgba(92,78,245,.22)';
      c.beginPath(); c.roundRect ? c.roundRect(x + gap / 2, h - pb - bh, colW - gap, bh, 3) : c.rect(x + gap / 2, h - pb - bh, colW - gap, bh); c.fill();
    }
    const mx2 = 4 + ((mine - lo) / (hi - lo || 1)) * (w - 8);
    c.strokeStyle = css('--accent'); c.lineWidth = 2; c.beginPath(); c.moveTo(mx2, 12); c.lineTo(mx2, h - pb); c.stroke();
    c.fillStyle = css('--accent'); c.font = '600 11.5px "Google Sans Flex", system-ui'; c.textAlign = mx2 > w - 40 ? 'right' : mx2 < 40 ? 'left' : 'center'; c.fillText('You', mx2, 10);
    c.fillStyle = css('--text-3'); c.font = '11px "Google Sans Code", monospace'; c.textAlign = 'left'; c.fillText(o.fmt ? o.fmt(lo) : lo.toFixed(1), 4, h - 6); c.textAlign = 'right'; c.fillText(o.fmt ? o.fmt(hi) : hi.toFixed(1), w - 4, h - 6);
  }
  return { line, spark, histogram, css, fit };
})();
