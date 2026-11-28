/* ==========================================================================
   AM Sim Trainer — "Liquid Glass" theme (from Iris Academy / Iris v4) (ported from Iris v4/v5 js/glass-theme.js)
   Changes vs Iris v4: storage keys, Liquid Glass is the DEFAULT theme here,
   and the SLOTS list points at the Academy's surfaces (sidebar, main panel,
   lesson action bar, AI tutor panel, modals, menus, search).
   Uses liquid-glass-js by dashersw (MIT): vendor/liquid-glass-js/container.js
   https://github.com/dashersw/liquid-glass-js

   How it works
   - The library renders each glass surface as a WebGL canvas that refracts,
     blurs and tints a snapshot of whatever is behind it. Normally it takes that
     snapshot with html2canvas. Here the backdrop is a wallpaper we paint ourselves,
     so we hand the library that painted canvas as its snapshot. That keeps
     the app offline and the refraction always matches what you see.
   - A small, fixed pool of glass surfaces (sidebar, main panel, prompt bar,
     two menus, search) is kept alive and moved onto whichever element is on
     screen after each re-render, so WebGL contexts are never churned.
   - No WebGL? The theme falls back to CSS backdrop-filter frosting.

   Public API: window.IrisTheme.get() / set('light'|'glass') / toggle()
               IrisTheme.wallpaper() / setWallpaper(id) / WALLPAPERS
   Demo flags (in the hash query): ?theme=glass|light  &wall=aurora|sunset|lagoon
   ========================================================================== */
(function () {
  const KEY = 'amsim.theme.v2', WKEY = 'amsim.wallpaper';
  const root = document.documentElement;

  /* ------------------------------------------------------------ wallpapers */
  // blobs:   [x, y, radius (x longest side), colour, alpha]
  // ribbons: [y, amplitude, thickness, colour A, colour B, waves, phase, alpha]
  // orbs:    [x, y, radius (x shortest side), light colour, dark colour]
  const WALLPAPERS = {
    aurora: {
      name: 'Aurora', base: ['#e9e3ff', '#d6e7ff'],
      blobs: [[0.06, 0.12, 0.46, '#7034f5', 0.85], [0.32, 0.98, 0.5, '#53a7ea', 0.8], [0.88, 0.16, 0.42, '#c26dff', 0.7],
              [0.97, 0.88, 0.46, '#5c4ef5', 0.78], [0.56, 0.44, 0.3, '#ff8fd0', 0.32]],
      ribbons: [[0.27, 0.08, 0.11, '#7034f5', '#53a7ea', 1.1, 0.4, 0.5], [0.7, 0.06, 0.08, '#ff7ab8', '#7c6cff', 0.9, 2.2, 0.42],
                [0.5, 0.05, 0.035, '#ffffff', '#ffffff', 1.4, 1.0, 0.55]],
      orbs: [[0.19, 0.63, 0.075, '#b39bff', '#5c4ef5'], [0.79, 0.57, 0.055, '#8fd6ff', '#3f8fdc'], [0.61, 0.13, 0.038, '#ffc6ea', '#c26dff']],
    },
    sunset: {
      name: 'Sunset', base: ['#ffe8da', '#f3dcff'],
      blobs: [[0.05, 0.1, 0.45, '#ff7a59', 0.85], [0.3, 0.98, 0.5, '#ff4f9a', 0.75], [0.9, 0.12, 0.42, '#ffb547', 0.75],
              [0.96, 0.9, 0.46, '#8a4dff', 0.75], [0.55, 0.45, 0.3, '#ffd36e', 0.3]],
      ribbons: [[0.3, 0.07, 0.1, '#ff6a6a', '#ffb547', 1.0, 0.9, 0.5], [0.72, 0.06, 0.08, '#c45cff', '#ff5fa8', 1.2, 2.6, 0.45],
                [0.52, 0.05, 0.035, '#ffffff', '#ffffff', 1.3, 1.6, 0.5]],
      orbs: [[0.2, 0.62, 0.075, '#ffd0a8', '#ff6a4d'], [0.78, 0.56, 0.055, '#ffb3dc', '#d6409a'], [0.6, 0.14, 0.038, '#fff0b0', '#ffa63d']],
    },
    lagoon: {
      name: 'Lagoon', base: ['#daf5f1', '#d9e5ff'],
      blobs: [[0.06, 0.12, 0.45, '#13b5a6', 0.8], [0.32, 0.98, 0.5, '#2f7fe0', 0.8], [0.88, 0.14, 0.42, '#6fe0c8', 0.7],
              [0.96, 0.88, 0.46, '#5c4ef5', 0.7], [0.55, 0.45, 0.3, '#9be7ff', 0.35]],
      ribbons: [[0.28, 0.08, 0.1, '#0fa3a0', '#53a7ea', 1.1, 0.2, 0.5], [0.71, 0.06, 0.08, '#7c6cff', '#2fc1b4', 0.9, 2.0, 0.42],
                [0.5, 0.05, 0.035, '#ffffff', '#ffffff', 1.4, 1.2, 0.55]],
      orbs: [[0.19, 0.63, 0.075, '#a6f2e4', '#13a594'], [0.79, 0.57, 0.055, '#a9d2ff', '#2f6fd0'], [0.61, 0.13, 0.038, '#d5ccff', '#6c5cf0']],
    },
  };

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // Paints wallpaper `wp` at CSS size w x h. The same function draws the visible
  // wallpaper (at device pixel ratio) and the 1x snapshot the glass samples.
  function paint(ctx, w, h, wp) {
    const L = Math.max(w, h), S = Math.min(w, h);
    let g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, wp.base[0]); g.addColorStop(1, wp.base[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    for (const [x, y, r, c, a] of wp.blobs) {
      g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * L);
      g.addColorStop(0, rgba(c, a)); g.addColorStop(0.55, rgba(c, a * 0.5)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }

    for (const [y0, amp, th, c1, c2, f, ph, a] of wp.ribbons) {
      const n = 64, pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push([-0.05 * w + t * 1.1 * w,
                  y0 * h + amp * h * Math.sin(ph + t * Math.PI * 2 * f),
                  th * h * (0.6 + 0.4 * Math.cos(ph * 1.7 + t * Math.PI * 2 * f * 0.8))]);
      }
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let i = n; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + pts[i][2]);
      ctx.closePath();
      g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
    }

    for (const [x, y, r, c1, c2] of wp.orbs) {
      const cx = x * w, cy = y * h, R = r * S;
      g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx - R * 0.3, cy - R * 0.45, R * 0.38, R * 0.2, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill();
    }
  }

  /* ------------------------------------------------------------ glass surfaces */
  // Where glass goes. The white "veil" (for legibility) and the specular rim are
  // CSS (css/glass-theme.css); refraction, blur and tint come from the library.
  // Only the two long-lived panels get WebGL glass. They are created once, at app load.
  // Transient surfaces (news flash, overlays, modals, menus) use CSS frosted glass: creating a
  // WebGL context mid-session stalled the main thread for seconds on software-rendered machines,
  // which would freeze the terminal exactly when a headline lands.
  const SLOTS = [
    { key: 'sidebar', sel: '.sidebar', tint: 0.18, ctl: { blurRadius: 7 } },
    { key: 'main', sel: '.main', tint: 0.22, ctl: { blurRadius: 10 } },
  ];
  // The library's own defaults (container.js, setupShader)
  const DEFAULTS = { blurRadius: 5, edgeIntensity: 0.01, rimIntensity: 0.05, baseIntensity: 0.01, edgeDistance: 0.15,
                     rimDistance: 0.8, baseDistance: 0.1, cornerBoost: 0.02, rippleEffect: 0.1 };
  const UNIFORM = { blurRadius: 'blurRadiusLoc', edgeIntensity: 'edgeIntensityLoc', rimIntensity: 'rimIntensityLoc',
                    baseIntensity: 'baseIntensityLoc', edgeDistance: 'edgeDistanceLoc', rimDistance: 'rimDistanceLoc',
                    baseDistance: 'baseDistanceLoc', cornerBoost: 'cornerBoostLoc', rippleEffect: 'rippleEffectLoc' };

  const GlassSurface = typeof Container === 'function' && class extends Container {
    // The library would load its html2canvas snapshot via toDataURL + Image.
    // Our snapshot is already a canvas, so set the shader up from it directly.
    initWebGL() {
      if (!Container.pageSnapshot || !this.gl) return;
      this.setupShader(Container.pageSnapshot);
      this.webglInitialized = true;
    }
    // The library resizes on the next frame but only redraws on window scroll,
    // so redraw once the new size is in.
    updateSizeFromDOM() {
      super.updateSizeFromDOM();
      requestAnimationFrame(() => this.draw());
    }
    configure(slot) {
      const r = this.gl_refs, gl = r.gl;
      if (!gl) return;
      const c = { ...DEFAULTS, ...slot.ctl };
      for (const k in UNIFORM) gl.uniform1f(r[UNIFORM[k]], c[k]);
      gl.uniform1f(r.tintOpacityLoc, slot.tint);
    }
    draw() {
      if (!this.render || !this.width || !this.element.isConnected) return;
      this.render();
      const b = this.element.getBoundingClientRect();
      this.last = `${b.left},${b.top},${b.width},${b.height}`;
      this.element.classList.add('ready');
    }
    attach(el) {
      el.prepend(this.element);
      const h = el.getBoundingClientRect().height || 1e4;
      const rad = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, h / 2);
      this.borderRadius = rad;
      this.element.style.borderRadius = rad + 'px';
      this.canvas.style.borderRadius = rad + 'px';
      if (this.gl_refs.gl) this.gl_refs.gl.uniform1f(this.gl_refs.borderRadiusLoc, rad);
      this.updateSizeFromDOM();
    }
    moved() {
      const b = this.element.getBoundingClientRect();
      return `${b.left},${b.top},${b.width},${b.height}` !== this.last;
    }
    setSnapshot(snap) {
      const r = this.gl_refs, gl = r.gl;
      if (!gl) return;
      gl.bindTexture(gl.TEXTURE_2D, r.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snap);
      gl.uniform2f(r.textureSizeLoc, snap.width, snap.height);
    }
    destroy() {
      const ext = this.gl && this.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      this.element.remove();
      this.gl_refs = {};
      const i = Container.instances.indexOf(this);
      if (i > -1) Container.instances.splice(i, 1);
    }
  };

  /* ------------------------------------------------------------ manager */
  let theme = 'amplify', wall = 'aurora', active = false, webgl = null;
  let wallCanvas = null, snap = null, pool = {}, mo = null, ro = null, queued = false, resizeT = null;

  function hasWebGL() {
    if (webgl !== null) return webgl;
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      webgl = !!gl && !!GlassSurface;
      // Software renderers (SwiftShader, llvmpipe…) take seconds per shader compile / full-panel draw and
      // would freeze the trading terminal. Use the CSS frosted-glass fallback there instead.
      // Override for testing: localStorage 'amsim.forceWebgl' = 'true'.
      if (webgl && localStorage.getItem('amsim.forceWebgl') !== 'true') {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const ren = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        if (/swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(ren)) webgl = false;
      }
      const ext = gl && gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    } catch (e) { webgl = false; }
    return webgl;
  }

  function paintWall() {
    const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2), wp = WALLPAPERS[wall];
    if (!wallCanvas) {
      wallCanvas = document.createElement('canvas');
      wallCanvas.id = 'lg-wall';
      wallCanvas.setAttribute('aria-hidden', 'true');
      document.body.prepend(wallCanvas);
    }
    wallCanvas.width = Math.round(w * dpr); wallCanvas.height = Math.round(h * dpr);
    const c = wallCanvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0); paint(c, w, h, wp);

    // 1 texel per CSS pixel: the shader maps screen position straight to texture position.
    snap = snap || document.createElement('canvas');
    snap.width = w; snap.height = h;
    paint(snap.getContext('2d'), w, h, wp);
    if (GlassSurface) Container.pageSnapshot = snap;   // so the library never reaches for html2canvas
  }

  function schedule() {
    if (queued || !active) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  }

  function sync(force) {
    if (!active || !webgl) return;
    for (const slot of SLOTS) {
      const el = document.querySelector(slot.sel);
      let g = pool[slot.key];
      if (!el) { if (g && g.element.isConnected) g.element.remove(); continue; }
      if (!g) {
        g = pool[slot.key] = new GlassSurface({ type: 'rounded', borderRadius: 0, tintOpacity: slot.tint });
        g.element.classList.add('lg-layer');
        g.configure(slot);
      }
      if (g.element.parentNode !== el) {
        if (g.target) ro.unobserve(g.target);
        g.target = el; g.attach(el); ro.observe(el);
      }
      else if (force || g.moved()) g.updateSizeFromDOM();
    }
  }

  // Ignore DOM changes we made ourselves, so syncing doesn't trigger itself.
  function ours(m) {
    const t = m.target;
    if (t.id === 'lg-wall' || (t.closest && t.closest('.lg-layer'))) return true;
    if (m.type === 'childList') {
      const nodes = [...m.addedNodes, ...m.removedNodes];
      return nodes.length > 0 && nodes.every(n => n.classList && (n.classList.contains('lg-layer') || n.id === 'lg-wall'));
    }
    return false;
  }

  function onResize() {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      paintWall();
      Object.values(pool).forEach(g => g.setSnapshot(snap));
      sync(true);
    }, 120);
  }
  const onMove = () => schedule();

  function enable() {
    if (active) return;
    active = true;
    paintWall();
    root.classList.toggle('lg-fallback', !hasWebGL());
    if (webgl) {
      // Re-attach synchronously (before the browser paints) so a re-rendered element is
      // never shown without its glass; the WebGL redraw itself waits for the next frame.
      mo = new MutationObserver(list => { if (!list.every(ours)) sync(); });
      mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
      ro = new ResizeObserver(onMove);
      document.addEventListener('scroll', onMove, true);          // prompt bars that scroll with the page
      document.addEventListener('animationend', onMove, true);    // menus measured mid "pop" animation
      document.addEventListener('transitionend', onMove, true);
      schedule();
    }
    addEventListener('resize', onResize);
  }

  function disable() {
    if (!active) return;
    active = false;
    if (mo) mo.disconnect();
    if (ro) ro.disconnect();
    mo = ro = null;
    document.removeEventListener('scroll', onMove, true);
    document.removeEventListener('animationend', onMove, true);
    document.removeEventListener('transitionend', onMove, true);
    removeEventListener('resize', onResize);
    Object.values(pool).forEach(g => g.destroy());
    pool = {};
    if (wallCanvas) { wallCanvas.remove(); wallCanvas = null; }
    root.classList.remove('lg-fallback');
  }

  function set(t, persist = true) {
    theme = ['glass', 'light', 'amplify'].includes(t) ? t : 'amplify';
    root.dataset.theme = theme;
    if (persist) try { localStorage.setItem(KEY, theme); } catch (e) {}
    if (theme === 'glass') enable(); else disable();
  }

  function setWallpaper(id, persist = true) {
    if (!WALLPAPERS[id]) return;
    wall = id;
    if (persist) try { localStorage.setItem(WKEY, id); } catch (e) {}
    if (active) { paintWall(); Object.values(pool).forEach(g => g.setSnapshot(snap)); sync(true); }
  }

  function fromHash() {
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    if (q.get('wall')) setWallpaper(q.get('wall'), false);
    if (['glass', 'light', 'amplify'].includes(q.get('theme'))) set(q.get('theme'), false);
  }

  window.IrisTheme = {
    WALLPAPERS,
    get: () => theme,
    set,
    toggle: () => set(theme === 'amplify' ? 'light' : 'amplify'),
    wallpaper: () => wall,
    setWallpaper,
    refresh: () => sync(true),
    // CSS gradient used for the small wallpaper swatches in Settings
    preview: id => { const w = WALLPAPERS[id]; return `linear-gradient(135deg, ${w.blobs[0][3]}, ${w.blobs[2][3]} 50%, ${w.blobs[1][3]})`; },
  };

  /* ------------------------------------------------------------ boot */
  try {
    const sw = localStorage.getItem(WKEY); if (WALLPAPERS[sw]) wall = sw;
    theme = ['glass', 'light', 'amplify'].includes(localStorage.getItem(KEY)) ? localStorage.getItem(KEY) : 'amplify';   // AmplifyME-style dark terminal by default
  } catch (e) {}
  set(theme, false);
  fromHash();
  addEventListener('hashchange', fromHash);
})();
