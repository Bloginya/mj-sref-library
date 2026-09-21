/* Style Index — infinite 3D inspiration field.
 * Drag the space to travel, drag a picture to move it (it leaves a rainbow
 * trail and can be thrown), click a picture to open its style.
 * Needs three.js (r128, global THREE). Exposes window.initWorld(opts). */
(function () {
  'use strict';

  const VERT = `
    uniform float uBend;
    uniform vec2  uVel;
    uniform float uHalfW;
    varying vec2 vUv;
    void main(){
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      // lens: the field curves away from the viewer toward the edges,
      // harder while travelling fast
      vec2 n = mv.xy / uHalfW;
      float r2 = dot(n, n);
      mv.z -= uBend * r2 * 420.0;
      // motion smear: far-from-centre vertices lag behind the travel direction
      mv.xy -= uVel * r2 * 26.0;
      gl_Position = projectionMatrix * mv;
    }`;

  const FRAG = `
    precision highp float;
    uniform sampler2D map;
    uniform float uHas;
    uniform float uOpacity;
    uniform float uHover;
    uniform float uTime;
    uniform float uChroma;
    uniform vec2  uVel;
    uniform vec2  uSize;      // plane size in px
    uniform float uImgAspect; // texture w/h
    uniform float uSeed;
    varying vec2 vUv;

    vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
    float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
    vec2 cover(vec2 uv){
      float pa = uSize.x/uSize.y;
      vec2 s = pa > uImgAspect ? vec2(1., uImgAspect/pa) : vec2(pa/uImgAspect, 1.);
      return (uv-.5)*s+.5;
    }
    void main(){
      vec2 p = (vUv-.5)*uSize;
      float d = sdRound(p, uSize*.5, 14.);
      float aa = fwidthFallback();
      float inside = 1. - smoothstep(-1., .5, d);
      if(inside <= 0.001) discard;

      vec2 off = uVel * uChroma;
      vec2 uv = cover(vUv);
      vec3 col;
      if(uHas > .5){
        col.r = texture2D(map, cover(vUv + off)).r;
        col.g = texture2D(map, uv).g;
        col.b = texture2D(map, cover(vUv - off)).b;
      } else {
        col = mix(vec3(.10,.08,.14), vec3(.16,.12,.22), vUv.y);
      }

      // rainbow beam riding the border (same idea as the page's Beam effect)
      float ang = atan(p.y, p.x) / 6.28318 + .5;
      float band = exp(-abs(d + 1.5) / 2.2);
      float sweep = smoothstep(.55, 1., fract(ang - uTime*.32 + uSeed));
      float speed = clamp(length(uVel)*.6, 0., 1.);
      vec3 rainbow = hue(ang + uTime*.08);
      col += rainbow * band * (uHover*(.35 + 1.4*sweep) + speed*.5);
      col = mix(col, col*1.08, uHover);

      gl_FragColor = vec4(col, inside * uOpacity);
    }`.replace('float aa = fwidthFallback();', '');

  const TRAIL_FRAG = `
    precision highp float;
    uniform sampler2D map;
    uniform float uOpacity;
    uniform vec3 uTint;
    uniform vec2 uSize;
    varying vec2 vUv;
    float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
    void main(){
      vec2 p = (vUv-.5)*uSize;
      float d = sdRound(p, uSize*.5, 14.);
      float edge = exp(-abs(d)/6.);
      float fill = 1. - smoothstep(-1., .5, d);
      gl_FragColor = vec4(uTint, (edge*.9 + fill*.18) * uOpacity);
    }`;
  const TRAIL_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;

  // deterministic hash → [0,1)
  function h2(x, y, s) {
    let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    n = (n ^ (n >>> 13)) * 1274126177 | 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

  window.initWorld = function initWorld(opts) {
    const { canvas, items, imgUrl, onOpen, onHover } = opts;
    if (!window.THREE || !items.length) return false;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { return false; }
    if (!renderer.getContext()) return false;

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const FOV = 40;
    const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 8000);
    let W = 1, H = 1, DIST = 1000;

    // ---------- layout of the infinite field ----------
    let S = 1;                          // global scale (smaller on phones)
    let CW = 320, CH = 400;             // cell size
    const DEPTHS = [-900, -460, -140, 170];
    const geo = new THREE.PlaneGeometry(1, 1, 18, 22);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const cache = new Map(); let inflight = 0; const queue = [];

    function pump() {
      while (inflight < 8 && queue.length) {
        const job = queue.shift();
        if (job.entry.state !== 'queued') continue;
        job.entry.state = 'loading'; inflight++;
        loader.load(job.url, tex => {
          inflight--; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
          tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
          job.entry.tex = tex; job.entry.state = 'ok';
          job.entry.aspect = tex.image.width / tex.image.height;
          job.entry.waiters.forEach(fn => fn(job.entry)); job.entry.waiters = [];
          pump();
        }, undefined, () => { inflight--; job.entry.state = 'err'; pump(); });
      }
    }
    function getTex(url, cb) {
      let e = cache.get(url);
      if (!e) { e = { state: 'queued', waiters: [] }; cache.set(url, e); queue.push({ url, entry: e }); pump(); }
      if (e.state === 'ok') cb(e); else if (e.state !== 'err') e.waiters.push(cb);
      return e;
    }

    // per-cell overrides after the visitor drags a picture somewhere
    const moved = new Map();
    function cellInfo(cx, cy) {
      const r1 = h2(cx, cy, 1), r2 = h2(cx, cy, 2), r3 = h2(cx, cy, 3), r4 = h2(cx, cy, 4), r5 = h2(cx, cy, 5);
      const di = r3 < .22 ? 0 : r3 < .5 ? 1 : r3 < .85 ? 2 : 3;
      const size = (di === 0 ? .7 : di === 1 ? .6 : di === 2 ? .55 : .5) + r4 * .2;
      const idx = Math.floor(h2(cx, cy, 7) * items.length);
      const m = moved.get(cx + ',' + cy);
      return {
        idx, di, z: DEPTHS[di] + (r5 - .5) * 60,
        x: (cx + .5 + (r1 - .5) * .6) * CW + (m ? m.x : 0),
        y: (cy + .5 + (r2 - .5) * .6) * CH + (m ? m.y : 0),
        w: CW * size, skip: h2(cx, cy, 9) < .1 && !m,
      };
    }

    let COLS = 0, ROWS = 0, pool = [];
    function makeMat() {
      return new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
        uniforms: {
          map: { value: null }, uHas: { value: 0 }, uOpacity: { value: 0 }, uHover: { value: 0 },
          uTime: { value: 0 }, uChroma: { value: 0 }, uVel: { value: new THREE.Vector2() },
          uSize: { value: new THREE.Vector2(1, 1) }, uImgAspect: { value: .75 }, uSeed: { value: Math.random() },
          uBend: { value: 0 }, uHalfW: { value: 800 },
        },
      });
    }
    function buildPool() {
      pool.forEach(s => { scene.remove(s.mesh); s.mesh.material.dispose(); });
      pool = [];
      const cover = 2.3; // far layers see a wider area than the focal plane
      COLS = Math.ceil(W * cover / CW) + 2; ROWS = Math.ceil(H * cover / CH) + 2;
      for (let i = 0; i < COLS * ROWS; i++) {
        const mesh = new THREE.Mesh(geo, makeMat());
        mesh.frustumCulled = false;
        scene.add(mesh);
        pool.push({ mesh, key: null, info: null, hover: 0, lift: 0, born: 0 });
      }
    }

    // ---------- camera / motion state ----------
    const cam = { x: 0, y: 0, z: 1, vx: 0, vy: 0, zoom: 1, zoomT: 1 };
    let intro = still ? 1 : 0, t0 = performance.now(), lastInput = -1e9;
    let time = 0;

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      DIST = (H / 2) / Math.tan(FOV * Math.PI / 360);
      camera.updateProjectionMatrix();
      S = clamp(Math.min(W / 1300, H / 820), .58, 1.15);
      CW = 360 * S; CH = 440 * S;
      buildPool();
    }

    function assign(slot, cx, cy) {
      const key = cx + ',' + cy;
      if (slot.key === key) return;
      slot.key = key;
      const info = cellInfo(cx, cy);
      slot.info = info; slot.cx = cx; slot.cy = cy;
      const u = slot.mesh.material.uniforms;
      u.uHas.value = 0; u.map.value = null; u.uOpacity.value = 0;
      slot.mesh.visible = !info.skip;
      if (info.skip) return;
      const it = items[info.idx];
      const url = imgUrl(it);
      slot.url = url;
      getTex(url, e => {
        if (slot.url !== url) return;
        u.map.value = e.tex; u.uHas.value = 1; u.uImgAspect.value = e.aspect || .75;
      });
    }

    // ---------- interaction ----------
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hoverSlot = null;
    const drag = { mode: null, id: null, sx: 0, sy: 0, lx: 0, ly: 0, slot: null, moved: 0, vx: 0, vy: 0, t: 0 };
    const thrown = []; // pictures flying after release
    const pointers = new Map(); let pinch0 = 0, zoom0 = 1;

    function pick(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left) / W) * 2 - 1, -((clientY - r.top) / H) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(pool.filter(s => s.mesh.visible && s.mesh.material.uniforms.uOpacity.value > .2).map(s => s.mesh), false);
      if (!hits.length) return null;
      // nearest to the camera wins
      return pool.find(s => s.mesh === hits[0].object) || null;
    }
    // px on screen → world units at depth z
    const pxToWorld = z => (camera.position.z - z) / DIST;

    canvas.addEventListener('pointerdown', e => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) { // pinch
        const [a, b] = [...pointers.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = cam.zoomT; drag.mode = 'pinch'; return;
      }
      if (drag.mode) return; // ignore extra fingers mid-drag
      canvas.setPointerCapture(e.pointerId);
      const s = pick(e.clientX, e.clientY);
      Object.assign(drag, { mode: s ? 'maybe-item' : 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, slot: s, moved: 0, vx: 0, vy: 0, t: performance.now() });
      cam.vx = cam.vy = 0;
      lastInput = performance.now();
      canvas.classList.add('grabbing');
    });
    canvas.addEventListener('pointermove', e => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (drag.mode === 'pinch' && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        cam.zoomT = clamp(zoom0 * pinch0 / Math.max(40, Math.hypot(a.x - b.x, a.y - b.y)), .6, 1.8);
        return;
      }
      if (!drag.mode || e.pointerId !== drag.id) {
        if (!coarse) {
          const s = pick(e.clientX, e.clientY);
          hoverSlot = s;
          canvas.style.cursor = s ? 'pointer' : 'grab';
          onHover && onHover(s ? items[s.info.idx] : null, e.clientX, e.clientY);
        }
        return;
      }
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly, now = performance.now();
      const dt = Math.max(1, now - drag.t);
      drag.lx = e.clientX; drag.ly = e.clientY; drag.t = now;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.mode === 'maybe-item' && drag.moved > 7) { drag.mode = 'item'; hoverSlot = drag.slot; onHover && onHover(null); }
      if (drag.mode === 'maybe-item') { lastInput = now; return; }
      if (drag.mode === 'pan') {
        const k = pxToWorld(0);
        cam.x -= dx * k; cam.y += dy * k;
        cam.vx = damp(cam.vx, -dx * k / dt * 16.67, 30, dt / 1000);
        cam.vy = damp(cam.vy, dy * k / dt * 16.67, 30, dt / 1000);
      } else if (drag.mode === 'item') {
        const s = drag.slot, k = pxToWorld(s.info.z + s.lift);
        const key = s.key, m = moved.get(key) || { x: 0, y: 0 };
        m.x += dx * k; m.y -= dy * k; moved.set(key, m);
        s.info.x += dx * k; s.info.y -= dy * k;
        drag.vx = damp(drag.vx, dx * k / dt * 16.67, 25, dt / 1000);
        drag.vy = damp(drag.vy, -dy * k / dt * 16.67, 25, dt / 1000);
      }
      lastInput = now;
    });
    function end(e) {
      pointers.delete(e.pointerId);
      if (drag.mode === 'pinch') { if (pointers.size < 2) drag.mode = null; return; }
      if (e.pointerId !== drag.id) return;
      if (drag.mode === 'maybe-item' && drag.moved <= 7 && drag.slot && e.type === 'pointerup') {
        onOpen && onOpen(items[drag.slot.info.idx]);
      } else if (drag.mode === 'item') {
        thrown.push({ slot: drag.slot, key: drag.slot.key, vx: drag.vx, vy: drag.vy });
      }
      drag.mode = null; drag.id = null;
      canvas.classList.remove('grabbing');
      lastInput = performance.now();
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', () => { if (!drag.mode) { hoverSlot = null; onHover && onHover(null); } });
    canvas.addEventListener('wheel', e => {
      if (scrollY > 40) return;            // page already moving — let it scroll
      e.preventDefault();
      if (e.ctrlKey) { cam.zoomT = clamp(cam.zoomT * Math.exp(e.deltaY * .01), .6, 1.8); return; }
      const k = pxToWorld(0) * (e.deltaMode === 1 ? 16 : 1);
      cam.vx += e.deltaX * k * .09; cam.vy -= e.deltaY * k * .09;
      lastInput = performance.now();
    }, { passive: false });
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', e => {
      const k = 14 * pxToWorld(0);
      if (e.key === 'ArrowLeft') cam.vx -= k; else if (e.key === 'ArrowRight') cam.vx += k;
      else if (e.key === 'ArrowUp') cam.vy += k; else if (e.key === 'ArrowDown') cam.vy -= k; else return;
      e.preventDefault(); lastInput = performance.now();
    });

    // ---------- rainbow trail for dragged / thrown pictures ----------
    const TRAIL = 9, hist = [];
    const ghosts = [];
    for (let i = 0; i < TRAIL; i++) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
        vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { map: { value: null }, uOpacity: { value: 0 }, uTint: { value: new THREE.Color().setHSL(i / TRAIL, .95, .6) }, uSize: { value: new THREE.Vector2(1, 1) } },
      }));
      g.frustumCulled = false; g.renderOrder = -1; scene.add(g); ghosts.push(g);
    }
    let trailSlot = null, trailLife = 0;

    // ---------- loop ----------
    let visible = true, raf = 0, prev = performance.now();
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !raf) loop(performance.now()); }).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !raf) { prev = performance.now(); loop(prev); } });

    function loop(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - prev) / 1000); prev = now; time += dt;

      // intro dolly
      if (intro < 1) intro = Math.min(1, (now - t0) / 2200);
      const ie = 1 - Math.pow(1 - intro, 4);

      // inertia + idle drift
      if (!drag.mode || drag.mode === 'item' || drag.mode === 'pinch') {
        const idle = now - lastInput > 2600 && !still;
        const f = Math.exp(-dt * (still ? 9 : 2.6));
        cam.vx *= f; cam.vy *= f;
        if (idle) { cam.vx = damp(cam.vx, .32 * S, .8, dt); cam.vy = damp(cam.vy, .14 * S, .8, dt); }
        cam.x += cam.vx * dt * 60; cam.y += cam.vy * dt * 60;
      }
      cam.zoom = damp(cam.zoom, cam.zoomT, 8, dt);
      camera.position.set(cam.x, cam.y, DIST * cam.zoom * (1 + (1 - ie) * 1.6));
      camera.rotation.z = (1 - ie) * -.08;
      camera.updateMatrixWorld();

      // thrown pictures glide to a stop
      for (let i = thrown.length - 1; i >= 0; i--) {
        const t = thrown[i], f = Math.exp(-dt * 3.2);
        t.vx *= f; t.vy *= f;
        const m = moved.get(t.key) || { x: 0, y: 0 };
        m.x += t.vx * dt * 60; m.y += t.vy * dt * 60; moved.set(t.key, m);
        if (t.slot.key === t.key) { t.slot.info.x += t.vx * dt * 60; t.slot.info.y += t.vy * dt * 60; }
        if (Math.hypot(t.vx, t.vy) < .05) thrown.splice(i, 1);
      }

      // wrap cells around the camera
      const spanW = COLS * CW, spanH = ROWS * CH;
      const c0 = Math.floor((cam.x - spanW / 2) / CW), r0 = Math.floor((cam.y - spanH / 2) / CH);
      for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) {
        const cx = c0 + i, cy = r0 + j;
        const slot = pool[((cx % COLS + COLS) % COLS) + ((cy % ROWS + ROWS) % ROWS) * COLS];
        assign(slot, cx, cy);
      }

      const speed = Math.hypot(cam.vx, cam.vy) / Math.max(.3, S);
      const vel = new THREE.Vector2(clamp(cam.vx / 14, -1.2, 1.2), clamp(cam.vy / 14, -1.2, 1.2));
      const bend = still ? .04 : .1 + clamp(speed * .035, 0, .35);

      for (const s of pool) {
        if (!s.info || s.info.skip) continue;
        const u = s.mesh.material.uniforms, inf = s.info;
        const isHover = s === hoverSlot || (drag.mode === 'item' && drag.slot === s);
        s.hover = damp(s.hover, isHover ? 1 : 0, isHover ? 14 : 7, dt);
        s.lift = damp(s.lift, isHover ? (drag.mode === 'item' && drag.slot === s ? 180 : 70) : 0, 10, dt);
        const sc = 1 + s.hover * .045;
        s.mesh.position.set(inf.x, inf.y, inf.z + s.lift);
        s.mesh.scale.set(inf.w * sc, inf.w * 1.25 * sc, 1);
        s.mesh.renderOrder = Math.round(inf.z + s.lift);
        // depth fog: far pictures are dimmer, fade in once the texture is ready
        const depthA = inf.di === 0 ? .34 : inf.di === 1 ? .62 : 1;
        u.uOpacity.value = damp(u.uOpacity.value, u.uHas.value * depthA * ie, 3.2, dt);
        u.uHover.value = s.hover; u.uTime.value = time;
        u.uVel.value.copy(vel);
        u.uChroma.value = still ? 0 : .012 + s.hover * .004;
        u.uSize.value.set(inf.w * sc, inf.w * 1.25 * sc);
        u.uBend.value = bend; u.uHalfW.value = Math.max(W, H) * .5 * pxToWorld(0);
      }

      // trail follows the picture being dragged (or thrown)
      const active = drag.mode === 'item' ? drag.slot : (thrown[0] && thrown[0].slot.key === thrown[0].key ? thrown[0].slot : null);
      if (active) { trailSlot = active; trailLife = 1; }
      else trailLife = Math.max(0, trailLife - dt * 1.8);
      if (trailSlot && trailSlot.info) {
        const m = trailSlot.mesh;
        hist.unshift({ x: m.position.x, y: m.position.y, z: m.position.z, w: m.scale.x, h: m.scale.y });
        if (hist.length > TRAIL * 3) hist.length = TRAIL * 3;
        ghosts.forEach((g, i) => {
          const p = hist[Math.min(hist.length - 1, (i + 1) * 3)];
          if (!p) return;
          g.position.set(p.x, p.y, p.z - 2 - i);
          g.scale.set(p.w, p.h, 1);
          g.material.uniforms.uSize.value.set(p.w, p.h);
          g.material.uniforms.uTint.value.setHSL(((i / TRAIL) + time * .15) % 1, .95, .6);
          g.material.uniforms.uOpacity.value = trailLife * (1 - i / TRAIL) * .55;
        });
      } else ghosts.forEach(g => (g.material.uniforms.uOpacity.value = 0));

      renderer.render(scene, camera);
    }

    addEventListener('resize', () => { resize(); });
    resize();
    raf = requestAnimationFrame(loop);
    return {
      nudge(dx, dy) { cam.vx += dx; cam.vy += dy; lastInput = performance.now(); },
    };
  };
})();
