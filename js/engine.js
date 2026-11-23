/* =====================================================================
   NEMSU Navigator — 3D engine (plain Canvas, no libraries, works offline)
   ===================================================================== */
(function () {
  const D = window.NEMSU;
  const RAD = Math.PI / 180;
  const FH = 9.5;                       // floor height (world units)
  const LIGHT = norm3([-0.45, -0.55, 0.72]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  function rng(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function pointInPoly(x, y, p) {
    let inside = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function hull(points) {
    const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop(); return lo.concat(up);
  }

  class Engine {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.cam = Object.assign({}, D.DEFAULT_CAM);
      this.inset = { l: 0, r: 0, t: 0, b: 0 }; this.insetT = { l: 0, r: 0, t: 0, b: 0 };
      this.night = 0; this.nightT = 0;
      this.selected = null; this.hover = null; this.anim = null; this.route = null; this.dirty = true;
      this.layers = { restroom: false, canteen: false, ramp: false, waiting: false };
      this.focusPoint = null;          // pulsing target (tour steps on gates)
      this.hits = []; this.markerHits = []; this.time = 0; this.fp = false;
      this.walk = { on: false, show: false, heading: 0, pitch: 0, eye: 4.1, x: 0, y: 0, face: 0, joy: { x: 0, y: 0 }, keys: { up: 0, down: 0, left: 0, right: 0, tl: 0, tr: 0 }, fast: false, third: false, phase: 0, moving: false, near: null };
      this._last = performance.now();
      this.handlers = {};
      this.buildings = D.BUILDINGS.map(b => this.prepare(b));
      this.byId = Object.fromEntries(this.buildings.map(b => [b.id, b]));
      this.decor = D.DECOR.map(b => this.prepare(Object.assign({ id: 'decor' + Math.random(), rot: 0 }, b)));
      this.initGravel();
      this.buildTrees();
      this.buildGraph();
      this.bindInput();
      this.resize();
      new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
      const loop = t => { this.time = t / 1000; this.frame(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    on(ev, fn) { this.handlers[ev] = fn; }
    emit(ev, ...a) { if (this.handlers[ev]) this.handlers[ev](...a); }

    /* ---------- setup ---------- */
    prepare(b) {
      b.rotR = (b.rot || 0) * RAD; b.cs = Math.cos(b.rotR); b.sn = Math.sin(b.rotR);
      b.H = b.floors * FH + (b.roof === 'open' ? 0 : 0);
      b.look = b.look || {};
      b.rh = b.roof === 'hip' ? clamp(Math.min(b.w, b.h) * 0.3, 7, 15) : b.roof === 'gable' ? clamp(Math.min(b.w, b.h) * 0.3, 8, 13) : b.roof === 'arch' ? 9 : b.roof === 'shed' ? 6 : 1.6;
      if (b.look.noroof) { b.H = 2; b.rh = 0; }
      b.top = b.H + b.rh + (b.look.chimney ? 13 : 0);
      if (b.look.wing) {
        const w = b.look.wing;
        b.wingB = this.prepare({ id: b.id + '_wing', x: b.x + w.dx, y: b.y + w.dy, w: w.w, h: w.h, rot: 0, floors: b.floors, roof: b.roof, look: Object.assign({}, b.look, { wing: null, arcade: false }) });
      }
      return b;
    }
    buildTrees() {
      const r = rng(7), k = D.K; this.trees = []; this.palms = [];
      const solids = this.buildings.concat(this.decor);
      const inB = (x, y) => solids.some(b => Math.abs(x - b.x) < b.w / 2 + 9 && Math.abs(y - b.y) < b.h / 2 + 9);
      const segDist = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t)); };
      const onPath = (x, y) => D.WALKS.some(w => { for (let i = 1; i < w.pts.length; i++) if (segDist(x, y, w.pts[i - 1], w.pts[i]) < 9) return true; return false; }) || Math.abs(y - 990 * k) < 36 * k * 1.9;
      const inField = (x, y) => D.FIELDS.some(f => pointInPoly(x, y, f.pts)) || D.PLAZAS.some(f => pointInPoly(x, y, f.pts));
      (D.TREES || []).forEach(([x, y], i) => { x *= k; y *= k; if (!inB(x, y) && !onPath(x, y) && !inField(x, y)) this.trees.push({ x, y, s: 0.8 + r() * 0.7, c: r() }); });
      (D.PALMS || []).forEach(p => { for (let x = p.x0; x < p.x1; x += 30 + r() * 16) { const X = x * k, Y = (p.y + r() * 10) * k; if (!inB(X, Y)) this.palms.push({ x: X, y: Y, s: 0.85 + r() * 0.4 }); } });
    }
    buildGraph() {
      const segs = []; D.WALKS.forEach(w => { for (let i = 1; i < w.pts.length; i++) segs.push({ a: w.pts[i - 1], b: w.pts[i], over: !!w.over }); });
      const splits = segs.map(s => [{ t: 0, p: s.a }, { t: 1, p: s.b }]);
      const inter = (s1, s2) => {
        const [x1, y1] = s1.a, [x2, y2] = s1.b, [x3, y3] = s2.a, [x4, y4] = s2.b, d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
        if (Math.abs(d) < 1e-9) return null;
        const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d, u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d, e = 0.002;
        if (t < -e || t > 1 + e || u < -e || u > 1 + e) return null; return { t: clamp(t, 0, 1), u: clamp(u, 0, 1), p: [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t] };
      };
      for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) { const h = inter(segs[i], segs[j]); if (h) { splits[i].push({ t: h.t, p: h.p }); splits[j].push({ t: h.u, p: h.p }); } }
      this.nodes = {}; this.adj = {}; this.edgeList = [];
      const node = p => { for (const k in this.nodes) { const q = this.nodes[k]; if (Math.abs(q[0] - p[0]) < 0.4 && Math.abs(q[1] - p[1]) < 0.4) return k; } const k = 'n' + Object.keys(this.nodes).length; this.nodes[k] = [p[0], p[1]]; this.adj[k] = []; return k; };
      segs.forEach((s, i) => {
        const L = splits[i].sort((a, b) => a.t - b.t);
        for (let k = 1; k < L.length; k++) {
          const a = node(L[k - 1].p), b = node(L[k].p); if (a === b) continue;
          const d = Math.hypot(this.nodes[a][0] - this.nodes[b][0], this.nodes[a][1] - this.nodes[b][1]);
          const e = { a, b, d, over: s.over, z: s.over ? D.OVERPASS.height : 0 };
          this.adj[a].push({ to: b, d, e }); this.adj[b].push({ to: a, d, e }); this.edgeList.push(e);
        }
      });
    }

    /* ---------- viewport / camera ---------- */
    resize() {
      const r = this.canvas.parentElement.getBoundingClientRect();
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.W = r.width; this.H = r.height;
      this.canvas.width = this.W * this.dpr; this.canvas.height = this.H * this.dpr;
      this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px';
      this.dirty = true;
    }
    setInsets(i, instant) { Object.assign(this.insetT, i); if (instant) Object.assign(this.inset, this.insetT); this.dirty = true; }
    get base() { return Math.min(this.W / 1150, this.H / 860) * 1.05; }
    get scale() { return this.cam.zoom * Math.max(0.3, this.base); }
    get cx() { return this.inset.l + (this.W - this.inset.l - this.inset.r) / 2; }
    get cy() { return this.inset.t + (this.H - this.inset.t - this.inset.b) / 2; }
    /* walk camera: first person = the walker's eyes; third person = behind and above the walker */
    camXY() { const w = this.walk; if (!w.third) return [w.x, w.y]; const h = w.heading * RAD; return [w.x - Math.sin(h) * 24, w.y + Math.cos(h) * 24]; }
    get camEye() { return this.walk.third ? 13 : this.walk.eye; }
    get camPitch() { return this.walk.pitch + (this.walk.third ? -0.3 : 0); }
    projFP(x, y, z) {
      const w = this.walk, h = w.heading * RAD, sh = Math.sin(h), ch = Math.cos(h), cxy = this.camXY(), pit = this.camPitch;
      const dx = x - cxy[0], dy = y - cxy[1], dz = z - this.camEye, dep = dx * sh - dy * ch, rt = dx * ch + dy * sh;
      const cp = Math.cos(pit), sp = Math.sin(pit), d = dep * cp + dz * sp, u = dz * cp - dep * sp, dd = Math.max(d, 1.2), F = this._F;
      return [clamp(this._cx + rt / dd * F, -1e5, 1e5), clamp(this._cy - u / dd * F, -1e5, 1e5), -d, rt, u, d];
    }
    proj(x, y, z) {
      if (this.fp) return this.projFP(x, y, z);
      const c = this.cam, T = c.tilt * RAD, ya = c.yaw * RAD;
      const co = Math.cos(ya), si = Math.sin(ya);
      const wx = x - c.x, wy = y - c.y;
      const rx = wx * co - wy * si, ry = wx * si + wy * co;
      const p = 1 / (1 - clamp(ry * Math.sin(T) * 0.0007, -0.35, 0.35));
      const S = this._S * p;
      return [this._cx + rx * S, this._cy + (ry * Math.cos(T) - z * Math.sin(T)) * S, ry];
    }
    screenToWorld(sx, sy) {
      const c = this.cam, T = c.tilt * RAD, ya = c.yaw * RAD, S = this.scale;
      const rx = (sx - this.cx) / S, ry = (sy - this.cy) / (S * Math.max(0.05, Math.cos(T)));
      const co = Math.cos(ya), si = Math.sin(ya);
      return [c.x + rx * co + ry * si, c.y - rx * si + ry * co];
    }

    /* ---------- camera animation ---------- */
    flyTo(target, dur = 1000, ease = easeIO) {
      const from = Object.assign({}, this.cam);
      const to = Object.assign({}, this.cam, target);
      if (target.yaw !== undefined) { let d = ((to.yaw - from.yaw + 540) % 360) - 180; to.yaw = from.yaw + d; }
      to.zoom = clamp(to.zoom, 0.28, 9); to.tilt = clamp(to.tilt, 0, 72);
      return new Promise(res => { this.anim = { from, to, t0: performance.now(), dur, ease, res }; this.dirty = true; });
    }
    stopAnim() { if (this.anim) { this.anim.res && this.anim.res(); this.anim = null; } }
    zoomFor(b) {
      const size = Math.max(b.w, b.h) + 30;
      return clamp((0.4 * Math.min(this.W - this.insetT.l - this.insetT.r, this.H)) / (size * Math.max(0.3, this.base)), 1.35, 3.6);
    }
    flyToBuilding(id, dur = 1000) {
      const b = this.byId[id]; if (!b) return Promise.resolve();
      return this.flyTo({ x: b.x, y: b.y, zoom: this.zoomFor(b), tilt: Math.max(this.cam.tilt, 45) }, dur);
    }
    flyToPoint(x, y, zoom = 2.2, dur = 1000) { return this.flyTo({ x, y, zoom, tilt: Math.max(this.cam.tilt, 40) }, dur); }
    frameRoute(pts) {
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const vw = this.W - this.insetT.l - this.insetT.r, vh = this.H - this.insetT.t - this.insetT.b;
      const z = clamp(Math.min(vw * 0.7 / ((x1 - x0) + 120), vh * 0.6 / ((y1 - y0) + 120)) / Math.max(0.3, this.base), 0.8, 3);
      return this.flyTo({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, zoom: z }, 1000);
    }

    /* ---------- selection ---------- */
    select(id) { this.selected = id; this.dirty = true; }

    /* ---------- routing ---------- */
    snap(x, y) {
      let best = null; const N = this.nodes;
      this.edgeList.forEach(e => {
        if (e.over) return;
        const a = N[e.a], b = N[e.b], dx = b[0] - a[0], dy = b[1] - a[1];
        const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        const px = a[0] + dx * t, py = a[1] + dy * t, d = Math.hypot(x - px, y - py);
        if (!best || d < best.d) best = { e, t, px, py, d };
      });
      return best;
    }
    doorPoint(b) {
      const s = this.snap(b.x, b.y);
      return [clamp(s.px, b.x - b.w / 2, b.x + b.w / 2), clamp(s.py, b.y - b.h / 2, b.y + b.h / 2)];
    }
    pointOf(ref) {
      if (ref.type === 'gate') { const g = D.GATES.find(g => g.id === ref.id); return [g.x, g.y]; }
      return this.doorPoint(this.byId[ref.id]);
    }
    computeRoute(fromRef, toRef) {
      const A = this.pointOf(fromRef), B = this.pointOf(toRef), sa = this.snap(A[0], A[1]), sb = this.snap(B[0], B[1]);
      const nodes = Object.assign({}, this.nodes); nodes.__A = [sa.px, sa.py]; nodes.__B = [sb.px, sb.py];
      const adj = {}; Object.keys(this.adj).forEach(k => (adj[k] = this.adj[k].slice())); adj.__A = []; adj.__B = [];
      const plain = { over: false, z: 0 };
      const link = (id, s) => [s.e.a, s.e.b].forEach(n => { const d = Math.hypot(nodes[n][0] - nodes[id][0], nodes[n][1] - nodes[id][1]); adj[id].push({ to: n, d, e: plain }); adj[n].push({ to: id, d, e: plain }); });
      link('__A', sa); link('__B', sb);
      if (sa.e === sb.e) { const d = Math.hypot(nodes.__A[0] - nodes.__B[0], nodes.__A[1] - nodes.__B[1]); adj.__A.push({ to: '__B', d, e: plain }); adj.__B.push({ to: '__A', d, e: plain }); }
      const dist = { __A: 0 }, prev = {}, seen = new Set();
      while (true) {
        let u = null; for (const k in dist) if (!seen.has(k) && (u === null || dist[k] < dist[u])) u = k;
        if (u === null || u === '__B') break; seen.add(u);
        adj[u].forEach(({ to, d, e }) => { const nd = dist[u] + d; if (dist[to] === undefined || nd < dist[to]) { dist[to] = nd; prev[to] = { from: u, e }; } });
      }
      if (dist.__B === undefined) return null;
      const seq = []; let k = '__B'; while (k) { seq.unshift(k); k = prev[k] && prev[k].from; }
      const pts = [[A[0], A[1], 0]]; let usesOverpass = false;
      seq.forEach((id, i) => {
        if (i > 0) { const e = prev[id].e, u = nodes[seq[i - 1]], v = nodes[id];
          if (e.over) { usesOverpass = true; const h = e.z; pts.push([u[0] + (v[0] - u[0]) * 0.1, u[1] + (v[1] - u[1]) * 0.1, h], [u[0] + (v[0] - u[0]) * 0.9, u[1] + (v[1] - u[1]) * 0.9, h]); } }
        pts.push([nodes[id][0], nodes[id][1], 0]);
      });
      pts.push([B[0], B[1], 0]);
      let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const meters = len * D.METERS_PER_UNIT;
      return { pts, len, meters, minutes: Math.max(1, Math.round(meters / D.WALK_SPEED_M_PER_MIN)), usesOverpass };
    }
    setRoute(r) { this.route = r; this.routeT0 = this.time; this.dirty = true; }

    /* ---------- input ---------- */
    bindInput() {
      const cv = this.canvas; let drag = null; const pts = new Map(); let pinch = null, moved = 0;
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('pointerdown', e => {
        cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0;
        this.stopAnim();
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), z: this.cam.zoom, yaw: this.cam.yaw }; drag = null; }
        else drag = { x: e.clientX, y: e.clientY, rot: e.button === 2 || e.shiftKey || e.ctrlKey, btn: e.button };
      });
      cv.addEventListener('pointermove', e => {
        const rect = cv.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
        if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pinch && pts.size >= 2) {
          const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          this.cam.zoom = clamp(pinch.z * d / pinch.d, 0.28, 9); this.cam.yaw = pinch.yaw - (ang - pinch.ang) / RAD; this.dirty = true; this.emit('camera'); return;
        }
        if (drag) {
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
          if (drag.rot) { this.cam.yaw += dx * 0.4; this.cam.tilt = clamp(this.cam.tilt + dy * 0.25, 0, 72); }
          else if (this.walk.on) { if (moved > 3) { this.walk.heading += dx * 0.25; this.walk.pitch = clamp(this.walk.pitch - dy * 0.0032, -0.55, 0.55); } }
          else if (moved > 4) {
            const T = this.cam.tilt * RAD, ya = this.cam.yaw * RAD, S = this.scale, co = Math.cos(ya), si = Math.sin(ya);
            const rx = -dx / S, ry = -dy / (S * Math.max(0.2, Math.cos(T)));
            this.cam.x += rx * co + ry * si; this.cam.y += -rx * si + ry * co;
          }
          this.dirty = true; this.emit('camera');
        } else if (e.pointerType === 'mouse') {
          const h = this.pick(mx, my); const id = h && h.id; if (id !== this.hover) { this.hover = id; cv.style.cursor = id ? 'pointer' : 'grab'; this.dirty = true; this.emit('hover', id); }
        }
      });
      const up = e => {
        const was = pts.has(e.pointerId); pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
        if (was && drag && moved <= 4 && e.type === 'pointerup' && !drag.rot) {
          const rect = cv.getBoundingClientRect(); const h = this.pick(e.clientX - rect.left, e.clientY - rect.top);
          this.emit('click', h ? h.id : null, h);
        }
        if (pts.size === 0) drag = null;
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', e => {
        e.preventDefault(); if (this.fp) return; this.stopAnim();
        const rect = cv.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const before = this.screenToWorld(mx, my);
        this.cam.zoom = clamp(this.cam.zoom * Math.exp(-e.deltaY * 0.0014), this.walk.on ? 3 : 0.28, 9);
        const after = this.screenToWorld(mx, my);
        this.cam.x += before[0] - after[0]; this.cam.y += before[1] - after[1];
        this.dirty = true; this.emit('camera');
      }, { passive: false });
      cv.style.cursor = 'grab';
    }
    pick(mx, my) {
      for (const m of this.markerHits) if (Math.hypot(mx - m.x, my - m.y) <= 15) return { id: m.id, marker: true };
      if (this.fp) return this.rayPick(mx, my);
      for (let i = this.hits.length - 1; i >= 0; i--) if (pointInPoly(mx, my, this.hits[i].poly)) return { id: this.hits[i].id };
      for (const f of this.facilityHits || []) if (Math.hypot(mx - f.x, my - f.y) <= 13) return { facility: f.f };
      return null;
    }

    rayPick(mx, my) {
      const w = this.walk, h = w.heading * RAD, sh = Math.sin(h), ch = Math.cos(h), pit = this.camPitch, cp = Math.cos(pit), sp = Math.sin(pit), F = this._F, cxy = this.camXY();
      const xc = (mx - this._cx) / F, yc = -(my - this._cy) / F;
      const dir = [sh * cp + xc * ch - yc * sh * sp, -ch * cp + xc * sh + yc * ch * sp, sp + yc * cp];
      let best = null, bt = 1e9;
      const test = (b, id) => {
        const ox = cxy[0] - b.x, oy = cxy[1] - b.y, lo = [ox * b.cs + oy * b.sn, -ox * b.sn + oy * b.cs, this.camEye], ld = [dir[0] * b.cs + dir[1] * b.sn, -dir[0] * b.sn + dir[1] * b.cs, dir[2]];
        const mn = [-b.w / 2, -b.h / 2, 0], mxx = [b.w / 2, b.h / 2, b.top]; let t0 = 0, t1 = 1e9;
        for (let k = 0; k < 3; k++) { if (Math.abs(ld[k]) < 1e-9) { if (lo[k] < mn[k] || lo[k] > mxx[k]) return; } else { let a = (mn[k] - lo[k]) / ld[k], c = (mxx[k] - lo[k]) / ld[k]; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return; } }
        if (t0 < bt) { bt = t0; best = id; }
      };
      this.buildings.forEach(b => { test(b, b.id); if (b.wingB) test(b.wingB, b.id); });
      return best ? { id: best } : null;
    }
    /* ---------- WALK VIEW ---------- */
    get solids() {
      if (!this._solids) this._solids = this.buildings.concat(this.buildings.filter(b => b.wingB).map(b => b.wingB), this.decor).filter(b => !b.look.court && b.solid !== false);
      return this._solids;
    }
    blocked(x, y) {
      const r = 2.4;
      for (const w of D.WALLS || []) for (let i = 1; i < w.length; i++) { const a = w[i - 1], c = w[i], dx = c[0] - a[0], dy = c[1] - a[1], t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1); if (Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t)) < 2.2) return true; }
      for (const b of this.solids) { const dx = x - b.x, dy = y - b.y, u = dx * b.cs + dy * b.sn, v = -dx * b.sn + dy * b.cs; if (Math.abs(u) < b.w / 2 + r && Math.abs(v) < b.h / 2 + r) return true; }
      return false;
    }
    startWalk(x, y, heading) {
      const w = this.walk; this.stopAnim(); w.saved = Object.assign({}, this.cam);
      w.x = x; w.y = y; w.heading = heading || 0; w.pitch = 0; w.show = false; w.joy = { x: 0, y: 0 }; w.on = true; this.fp = true; this.cam.yaw = -w.heading;
      this.dirty = true; this.emit('walk', true); this.emit('camera');
    }
    stopWalk() { const w = this.walk; w.on = false; w.show = false; this.fp = false; w.joy = { x: 0, y: 0 }; if (w.saved) Object.assign(this.cam, w.saved); this.dirty = true; this.emit('walk', false); this.emit('camera'); }
    updateWalk(dt) {
      const w = this.walk, c = this.cam;
      const turn = (w.keys.tr ? 1 : 0) - (w.keys.tl ? 1 : 0); if (turn) w.heading += turn * 80 * dt;
      const h = w.heading * RAD, sh = Math.sin(h), ch = Math.cos(h);
      let jx = w.joy.x + (w.keys.right - w.keys.left), jy = w.joy.y + (w.keys.up - w.keys.down);
      const mag = Math.hypot(jx, jy); if (mag > 1) { jx /= mag; jy /= mag; }
      w.moving = mag > 0.08;
      if (w.moving) {
        const sp = (w.fast ? 40 : 18) * Math.min(1, mag);
        const mx = (sh * jy + ch * jx) * sp * dt, my = (-ch * jy + sh * jx) * sp * dt;
        let nx = clamp(w.x + mx, -90, 1820), ny = clamp(w.y + my, -70, 800);
        if (!this.blocked(nx, w.y)) w.x = nx; if (!this.blocked(w.x, ny)) w.y = ny;
        w.phase += dt * 9;
      }
      w.eye = 4.1;   // no head-bob: the world stays steady while walking
      c.yaw = -w.heading; this.dirty = true; this.emit('camera');
      w.tick = (w.tick || 0) + 1;
      if (w.tick % 10 === 0) {
        let best = null, bd = 1e9;
        this.buildings.forEach(b => { const d = this.rectDist(b); if (d < bd) { bd = d; best = b.id; } });
        const id = bd < 38 ? best : null; if (id !== w.near) { w.near = id; this.emit('near', id); }
      }
    }
    drawPlayer(ctx) {
      const w = this.walk, g = this.proj(w.x, w.y, 0), head = this.proj(w.x, w.y, 7), u = Math.max(2.5, (g[1] - head[1]) / 7), sw = w.moving ? Math.sin(w.phase) : 0, bob = w.moving ? Math.abs(Math.cos(w.phase)) * 0.35 * u : 0;
      ctx.save();
      // facing arrow on the ground
      const hr = w.heading * RAD, fa = this.fp ? this.proj(w.x + Math.sin(hr) * 8, w.y - Math.cos(hr) * 8, 0) : this.proj(w.x + Math.cos(w.face) * 8, w.y + Math.sin(w.face) * 8, 0);
      ctx.fillStyle = 'rgba(245,184,0,0.9)'; ctx.beginPath(); ctx.arc(fa[0], fa[1], 3.2, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(g[0], g[1], 2.6 * u, 1.1 * u, 0, 0, 6.283); ctx.fill();
      ctx.lineCap = 'round'; ctx.lineWidth = 1.15 * u;
      ctx.strokeStyle = '#2c3550'; ctx.beginPath(); ctx.moveTo(g[0] - 0.6 * u, g[1] - 3 * u - bob); ctx.lineTo(g[0] - 0.6 * u - sw * 0.9 * u, g[1]); ctx.moveTo(g[0] + 0.6 * u, g[1] - 3 * u - bob); ctx.lineTo(g[0] + 0.6 * u + sw * 0.9 * u, g[1]); ctx.stroke();
      ctx.fillStyle = '#1b3f9b'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
      const tx = g[0] - 1.5 * u, ty = g[1] - 5.8 * u - bob, tw = 3 * u, th = 2.9 * u;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(tx, ty, tw, th, 1 * u) : ctx.rect(tx, ty, tw, th); ctx.fill(); ctx.stroke();
      ctx.fillStyle = this.fp ? '#2b1d14' : '#f2c9a0'; ctx.beginPath(); ctx.arc(g[0], g[1] - 6.9 * u - bob, 1.15 * u, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2b1d14'; ctx.beginPath(); ctx.arc(g[0], g[1] - 7.2 * u - bob, 1.15 * u, Math.PI, 0); ctx.fill();
      ctx.restore();
    }

    /* ---------- colour helpers ---------- */
    shade(hex, k) {
      const [r, g, b] = hexRgb(hex), n = this.night, I = lerp(1, 0.5, n) * k;
      const tr = lerp(255, 150, n) / 255, tg = lerp(255, 172, n) / 255, tb = lerp(255, 255, n) / 255;
      let R = clamp(r * I * tr, 0, 255), G = clamp(g * I * tg, 0, 255), Bb = clamp(b * I * tb, 0, 255);
      if (this._hl) { R = lerp(R, 255, 0.3); G = lerp(G, 214, 0.3); Bb = lerp(Bb, 90, 0.3); }   // walk-view highlight
      const d = this._dim || 0; if (d) { const gr = lerp(222, 70, n); R = lerp(R, gr, d); G = lerp(G, gr + 3, d); Bb = lerp(Bb, gr + 6, d); }
      return `rgb(${R | 0},${G | 0},${Bb | 0})`;
    }
    ground(hex) { return this.shade(hex, 1); }

    /* ---------- frame ---------- */
    frame() {
      const now = performance.now(), dt = Math.min(0.06, (now - this._last) / 1000); this._last = now;
      if (this.anim) {
        const a = this.anim, t = clamp((now - a.t0) / a.dur, 0, 1), k = a.ease(t);
        ['x', 'y', 'yaw', 'tilt', 'zoom'].forEach(p => (this.cam[p] = lerp(a.from[p], a.to[p], k)));
        if (t >= 1) { const r = a.res; this.anim = null; r && r(); }
        this.dirty = true; this.emit('camera');
      }
      if (this.walk.on && !this.anim) this.updateWalk(dt);
      for (const k of ['l', 'r', 't', 'b']) { const d = this.insetT[k] - this.inset[k]; if (Math.abs(d) > 0.3) { this.inset[k] += d * 0.16; this.dirty = true; } else this.inset[k] = this.insetT[k]; }
      const nd = this.nightT - this.night; if (Math.abs(nd) > 0.004) { this.night += nd * 0.08; this.dirty = true; } else this.night = this.nightT;
      if (!(this.dirty || this.selected || this.route || this.focusPoint || this.walk.show)) return;
      this.dirty = false; this.draw();
    }

    draw() {
      const ctx = this.ctx, W = this.W, H = this.H, c = this.cam;
      this.fp = this.walk.on;
      this._S = this.scale; this._cx = this.cx; this._cy = this.cy; this._F = H * 0.95;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      if (this.fp) {
        const hy = clamp(this._cy + Math.tan(this.camPitch) * this._F, 0, H), n = this.night;
        const mix = (a, b) => `rgb(${lerp(a[0], b[0], n) | 0},${lerp(a[1], b[1], n) | 0},${lerp(a[2], b[2], n) | 0})`;
        bg.addColorStop(0, mix([112, 170, 230], [10, 16, 44])); bg.addColorStop(Math.max(0.01, hy / H), mix([226, 236, 245], [44, 56, 96])); bg.addColorStop(1, mix([226, 236, 245], [44, 56, 96]));
      } else { bg.addColorStop(0, this.shade('#dfe5e0', 1)); bg.addColorStop(1, this.shade('#cfd6cf', 1)); }
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      this.drawGround(ctx);
      const items = [];
      const sel = this.selected;
      const addB = (b, lift, alpha, selected, hovered, parent) => items.push({ key: this.fp ? -this.rectDist(b, true) : this.proj(b.x, b.y, 0)[2] + (b.h > b.w ? 0 : 0.01), fn: () => this.drawBuilding(ctx, b, lift, alpha, selected, hovered) });
      this.buildings.forEach(b => {
        const isSel = sel === b.id, dim = this.fp ? 0 : ((sel && !isSel ? 1 : 0) || ((this.filter && this.filter !== 'all' && b.cat !== this.filter && !isSel) ? 1 : 0));
        const lift = this.fp ? 0 : (isSel ? 3.2 : (this.hover === b.id ? 1.2 : 0));   // walk view: buildings never lift, they are only highlighted
        addB(b, lift, dim, isSel, this.hover === b.id);
        if (b.wingB) addB(b.wingB, lift, dim, isSel, this.hover === b.id);
      });
      this.decor.forEach(b => addB(b, 0, sel ? 1 : 0, false, false));
      this.trees.forEach(t => items.push({ key: this.proj(t.x, t.y, 0)[2], fn: () => this.drawTree(ctx, t, sel ? 0.7 : 1) }));
      this.palms.forEach(t => items.push({ key: this.proj(t.x, t.y, 0)[2], fn: () => this.drawPalm(ctx, t) }));
      (D.WALLS || []).forEach(w => { for (let i = 1; i < w.length; i++) { const a = w[i - 1], c2 = w[i]; items.push({ key: this.proj((a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2, 0)[2], fn: () => this.drawWall(ctx, a, c2) }); } });
      (D.GATES.concat(D.EXTRA_ARCHES || [])).forEach(g => items.push({ key: this.proj(g.x, g.y, 0)[2] + 2, fn: () => this.drawGate(ctx, g) }));
      if ((this.walk.show && !this.fp) || (this.fp && this.walk.third)) items.push({ key: this.proj(this.walk.x, this.walk.y, 0)[2] + 1.5, fn: () => this.drawPlayer(ctx) });
      const op = D.OVERPASS; items.push({ key: this.proj((op.a[0] + op.b[0]) / 2, (op.a[1] + op.b[1]) / 2, 0)[2] + 6, fn: () => this.drawOverpass(ctx) });
      items.sort((a, b) => a.key - b.key);
      this.hits = [];
      items.forEach(i => i.fn());
      this.drawFacilities(ctx);
      if (this.route) this.drawRoute(ctx);
      this.drawGateLabels(ctx);
      this.drawMarkersAndLabels(ctx);
      if (this.fp) { const hy = clamp(this._cy + Math.tan(this.camPitch) * this._F, 0, H), hz = ctx.createLinearGradient(0, hy - 70, 0, hy + 30); const hc = this.night > 0.5 ? '40,52,92' : '230,238,246'; hz.addColorStop(0, `rgba(${hc},0)`); hz.addColorStop(0.7, `rgba(${hc},0.3)`); hz.addColorStop(1, `rgba(${hc},0)`); ctx.fillStyle = hz; ctx.fillRect(0, hy - 70, W, 100); }
      this.drawScale(ctx);
    }

    /* ---------- ground, roads, plazas ---------- */
    P(pts, z = 0) { return pts.map(p => this.proj(p[0], p[1], z)); }
    clipPoly(p) {
      const near = 1.2; let any = false, all = true;
      for (const q of p) { if (q[5] >= near) any = true; else all = false; }
      if (!any) return null; if (all) return p;
      const out = [], F = this._F;
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length], ia = a[5] >= near, ib = b[5] >= near;
        if (ia) out.push(a);
        if (ia !== ib) { const t = (near - a[5]) / (b[5] - a[5]), rt = a[3] + (b[3] - a[3]) * t, u = a[4] + (b[4] - a[4]) * t; out.push([this._cx + rt / near * F, this._cy - u / near * F, 0, rt, u, near]); }
      }
      return out.length > 2 ? out : null;
    }
    rectDist(b, fromCam) { const o = fromCam ? this.camXY() : [this.walk.x, this.walk.y], dx = o[0] - b.x, dy = o[1] - b.y, u = dx * b.cs + dy * b.sn, v = -dx * b.sn + dy * b.cs; return Math.hypot(Math.max(Math.abs(u) - b.w / 2, 0), Math.max(Math.abs(v) - b.h / 2, 0)); }
    wallVis(a, c, n, q, footA) { return this.fp ? ((this.camXY()[0] - a[0]) * n[0] + (this.camXY()[1] - a[1]) * n[1] > 0) : Math.sign(area(q)) === Math.sign(footA); }
    ln(ctx, a, b) { if (this.fp && (a[5] < 1.2 || b[5] < 1.2)) return; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    fillPoly(ctx, pts2, fill, stroke, lw) {
      if (this.fp) { pts2 = this.clipPoly(pts2); if (!pts2) return; }
      ctx.beginPath(); pts2.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.lineWidth = lw || 1; ctx.strokeStyle = stroke; ctx.stroke(); }
    }
    makeGravel(size, count, base, tones, rmin, rmax, seed) {
      const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), r = rng(seed);
      g.fillStyle = base; g.fillRect(0, 0, size, size);
      for (let i = 0; i < count; i++) {
        const x = r() * size, y = r() * size, rad = rmin + r() * (rmax - rmin), ry = rad * (0.6 + r() * 0.4), rot = r() * 3.14, tone = tones[(r() * tones.length) | 0];
        for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
          const X = x + ox, Y = y + oy; if (X < -rad * 2 || X > size + rad * 2 || Y < -rad * 2 || Y > size + rad * 2) continue;
          g.fillStyle = 'rgba(70,60,45,0.16)'; g.beginPath(); g.ellipse(X + rad * 0.3, Y + rad * 0.35, rad, ry, rot, 0, 6.283); g.fill();
          g.fillStyle = tone; g.beginPath(); g.ellipse(X, Y, rad, ry, rot, 0, 6.283); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(X - rad * 0.25, Y - ry * 0.28, rad * 0.45, ry * 0.4, rot, 0, 6.283); g.fill();
        }
      }
      return c;
    }
    initGravel() {
      const base = this.makeGravel(512, 2600, '#d9d2c2', ['#cfc7b5', '#e3dccb', '#c4bba8', '#d6cdb9', '#bfb7a6', '#ebe5d6'], 0.8, 2.3, 11);
      const field = this.makeGravel(512, 1500, '#c4baa6', ['#b5ac98', '#cfc6b1', '#a99f8b', '#d6ccb7', '#9c9382', '#bdb29c'], 1.3, 3.8, 23);
      this.gravel = { base: this.ctx.createPattern(base, 'repeat'), field: this.ctx.createPattern(field, 'repeat') };
    }
    fillGravel(ctx, q, kind) {
      const pat = this.gravel[kind], Wt = kind === 'field' ? 80 : 120, T = 512, c = this.cam;
      const ax = Math.round(c.x / Wt) * Wt, ay = Math.round(c.y / Wt) * Wt;
      const p0 = this.proj(ax, ay, 0), px = this.proj(ax + Wt, ay, 0), py = this.proj(ax, ay + Wt, 0);
      if (pat.setTransform) pat.setTransform(new DOMMatrix([(px[0] - p0[0]) / T, (px[1] - p0[1]) / T, (py[0] - p0[0]) / T, (py[1] - p0[1]) / T, p0[0], p0[1]]));
      this.fillPoly(ctx, q, pat);
      if (this.night > 0.01) this.fillPoly(ctx, q, `rgba(12,20,48,${0.58 * this.night})`);
    }
    strokeLine(ctx, pts, w, col, caps) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
        this.fillPoly(ctx, this.P([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]), col);
      }
      for (let i = caps ? 0 : 1; i < (caps ? pts.length : pts.length - 1); i++) {
        const poly = []; for (let k = 0; k < 14; k++) poly.push([pts[i][0] + Math.cos(k / 14 * 6.283) * w / 2, pts[i][1] + Math.sin(k / 14 * 6.283) * w / 2]);
        this.fillPoly(ctx, this.P(poly), col);
      }
    }
    drawGround(ctx) {
      const BIG = [[-6000, -4000], [8000, -4000], [8000, 6000], [-6000, 6000]];
      if (this.fp) {
        this.fillPoly(ctx, this.P(BIG), this.ground('#d6cfbf'));
        D.FIELDS.forEach(f => this.fillPoly(ctx, this.P(f.pts), this.ground('#c2b8a4'), this.shade('#9d937f', 1), 1.6));
        this.drawPebbles(ctx);
      } else {
        this.fillGravel(ctx, this.P(BIG), 'base');
        D.FIELDS.forEach(f => { const q = this.P(f.pts); this.fillGravel(ctx, q, 'field'); this.fillPoly(ctx, q, null, this.shade('#9d937f', 1), 1.6); });
      }
      D.PLAZAS.forEach(p => {
        this.fillPoly(ctx, this.P(p.pts), this.ground(p.color), this.shade('#7d8086', 1), 1);
        if (p.lines && !this.fp) for (let x = p.pts[0][0] + 7; x < p.pts[1][0] - 3; x += 9) { const a = this.proj(x, p.pts[0][1] + 5, 0), b = this.proj(x, p.pts[2][1] - 5, 0); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      });
      // pedestrian walkways (light paths) — the same lines the router uses
      D.WALKS.forEach(w => { if (w.over) return; this.strokeLine(ctx, w.pts, 9.5, this.ground('#c9c0aa'), true); });
      D.WALKS.forEach(w => { if (w.over) return; this.strokeLine(ctx, w.pts, 7.6, this.ground('#ece6d6'), true); });
      // roads
      const asphalt = this.ground('#6c7076'), curb = this.ground('#d4d0c4');
      D.ROADS.forEach(r => {
        this.strokeLine(ctx, r.pts, r.w + 6, curb); this.strokeLine(ctx, r.pts, r.w, asphalt);
        if (r.dash && this.fp) { const y0 = r.pts[0][1]; for (let x = Math.floor((this.walk.x - 140) / 26) * 26; x < this.walk.x + 140; x += 26) this.fillPoly(ctx, this.P([[x, y0 - 0.5], [x + 12, y0 - 0.5], [x + 12, y0 + 0.5], [x, y0 + 0.5]]), 'rgba(255,255,255,0.9)'); }
        else if (r.dash) { ctx.save(); ctx.setLineDash([14, 11]); ctx.strokeStyle = 'rgba(255,255,255,0.88)'; ctx.lineWidth = Math.max(1, this._S * 1.2);
          ctx.beginPath(); r.pts.forEach((p, i) => { const q = this.proj(p[0], p[1], 0); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); ctx.restore(); }
      });
      // captions printed on the ground
      if (this.cam.zoom > 0.4 && !this.fp) {
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const f = clamp(this.cam.zoom, 0.8, 1.8), dk = this.night > 0.5 ? 'rgba(220,230,255,0.75)' : 'rgba(55,50,40,0.6)';
        (D.CAPTIONS || []).forEach(c => { const q = this.proj(c.x * D.K, c.y * D.K, 0); ctx.font = `700 ${c.size * f}px Inter,system-ui,sans-serif`; ctx.fillStyle = c.light ? 'rgba(255,255,255,0.75)' : dk; ctx.letterSpacing = '3px'; ctx.fillText(c.t, q[0], q[1]); });
        ctx.restore();
      }
    }
    drawPebbles(ctx) {
      const w = this.walk, cell = 5, R = 85, i0 = Math.floor((w.x - R) / cell), i1 = Math.floor((w.x + R) / cell), j0 = Math.floor((w.y - R) / cell), j1 = Math.floor((w.y + R) / cell), F = this._F;
      const tones = ['#c4bba8', '#e6dfcf', '#b8af9c', '#d3cab6', '#a79e8b'], nt = this.night, fieldTones = ['#a99f8b', '#cfc6b1', '#9c9382', '#b5ac98'];
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        let h = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) >>> 0;
        for (let k = 0; k < 2; k++) {
          h = (Math.imul(h, 1664525) + 1013904223) >>> 0; const rx = h / 4294967296; h = (Math.imul(h, 1664525) + 1013904223) >>> 0; const ry = h / 4294967296; h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
          const X = (i + rx) * cell, Y = (j + ry) * cell, q = this.proj(X, Y, 0); if (q[5] < 2 || q[5] > R) continue;
          const inF = D.FIELDS.some(f => pointInPoly(X, Y, f.pts)), t = (inF ? fieldTones : tones)[h % (inF ? 4 : 5)], s = Math.max(1, 0.55 * F / q[5]);
          ctx.fillStyle = nt > 0.3 ? this.shade(t, 1) : t; ctx.fillRect(q[0], q[1], s * 1.4, s * 0.7);
        }
      }
    }
    drawWall(ctx, a, b) {
      const h = 5, q = [this.pr([a[0], a[1], 0]), this.pr([b[0], b[1], 0]), this.pr([b[0], b[1], h]), this.pr([a[0], a[1], h])];
      this.fillPoly(ctx, q, this.shade('#cbc3b2', 0.95), 'rgba(0,0,0,0.28)', 0.7);
      this.fillPoly(ctx, [this.pr([a[0], a[1], h]), this.pr([b[0], b[1], h]), this.pr([b[0], b[1] + 1.4, h]), this.pr([a[0], a[1] + 1.4, h])], this.shade('#e6e0d2', 1));
    }

    /* ---------- generic 3D helpers ---------- */
    W3(b, u, v, z) { return [b.x + u * b.cs - v * b.sn, b.y + u * b.sn + v * b.cs, z]; }
    pr(p) { return this.proj(p[0], p[1], p[2]); }
    face(ctx, pts3, color, nrm, alpha, edge) {
      const q = pts3.map(p => this.pr(p));
      let k = 0.55 + 0.6 * Math.max(0, nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2]);
      this.fillPoly(ctx, q, this.shade(color, k), edge || 'rgba(0,0,0,0.22)', 0.6);
      return q;
    }
    quadPt(a, b, u, v, z0, z1) { // point on a wall at fraction u along a→b, height z
      return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(z0, z1, v)];
    }

    drawBuilding(ctx, b, lift, alpha, selected, hovered) {
      const hw = b.w / 2, hh = b.h / 2, L = b.look, z0 = lift, H = z0 + b.H;
      const T = this.cam.tilt;
      this._dim = alpha ? 0.55 : 0; this._hl = this.fp && (selected || hovered) ? 1 : 0; alpha = 1;
      ctx.save(); ctx.globalAlpha = 1;
      const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => this.W3(b, u, v, z0));
      // ground shadow
      if (this.night < 0.8 && T > 4) {
        const sh = b.H * 0.7 + 2, off = [sh * 0.7, sh * 0.8];
        this.fillPoly(ctx, this.P(corners.map(p => [p[0] + off[0], p[1] + off[1]])), `rgba(20,30,40,${0.2 * (1 - this.night)})`);
        this.fillPoly(ctx, this.P(corners.map(p => [p[0] + off[0] / 2, p[1] + off[1] / 2])), `rgba(20,30,40,${0.14 * (1 - this.night)})`);
      }
      // selected glow on ground
      if (selected) {
        const g = corners.map(p => [p[0], p[1]]), cx = b.x, cy = b.y;
        const ex = g.map(p => [cx + (p[0] - cx) * (1 + 14 / b.w), cy + (p[1] - cy) * (1 + 14 / b.h)]);
        const col = (D.CATEGORIES.find(c => c.id === b.cat) || {}).color || '#ffb300';
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = this.fp ? 0 : 38; ctx.globalAlpha = this.fp ? 0.16 : 0.55; this.fillPoly(ctx, this.P(ex), col); ctx.restore();
      }
      // court floor
      if (L.court) {
        this.fillPoly(ctx, this.P(corners.map(p => [p[0], p[1]]), 0.2), this.shade('#c9714b', 1), 'rgba(255,255,255,0.8)', 1);
        const inner = [[-hw * 0.82, -hh * 0.7], [hw * 0.82, -hh * 0.7], [hw * 0.82, hh * 0.7], [-hw * 0.82, hh * 0.7]].map(([u, v]) => this.W3(b, u, v, 0.3));
        this.fillPoly(ctx, inner.map(p => this.pr(p)), null, 'rgba(255,255,255,0.85)', 1.2);
        const m1 = this.pr(this.W3(b, 0, -hh * 0.7, 0.3)), m2 = this.pr(this.W3(b, 0, hh * 0.7, 0.3));
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.moveTo(m1[0], m1[1]); ctx.lineTo(m2[0], m2[1]); ctx.stroke();
      }
      const footQ = corners.map(p => this.pr(p));
      const footA = area(footQ);
      const outline = footQ.slice();
      // ---- walls ----
      if (!L.court) {
        for (let i = 0; i < 4; i++) {
          const a = corners[i], c2 = corners[(i + 1) % 4];
          const dx = c2[0] - a[0], dy = c2[1] - a[1], len = Math.hypot(dx, dy), nrm = [dy / len, -dx / len, 0];
          const q = [this.pr(a), this.pr(c2), this.pr([c2[0], c2[1], H]), this.pr([a[0], a[1], H])];
          if ((!this.fp && T < 3) || !this.wallVis(a, c2, nrm, q, footA)) continue;
          this.face(ctx, [a, c2, [c2[0], c2[1], H], [a[0], a[1], H]], L.wall || '#efe3c0', nrm, alpha);
          this.drawWallDetail(ctx, b, a, c2, len, nrm, z0, i);
        }
      } else if (!L.noroof) {
        // open court: posts + low rail
        const n = 6;
        for (let i = 0; i < 4; i += 2) for (let k = 0; k <= n; k++) {
          const t = k / n, a = corners[i], c2 = corners[i + 1], p = [lerp(a[0], c2[0], t), lerp(a[1], c2[1], t)];
          const q0 = this.pr([p[0], p[1], z0]), q1 = this.pr([p[0], p[1], H]);
          ctx.strokeStyle = this.shade('#2f6fe0', 1); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke();
        }
      }
      // ---- roof ----
      if (!L.noroof) this.drawRoof(ctx, b, z0, H, alpha, outline);
      // chimney / tower
      if (L.chimney) this.box(ctx, b.x, b.y, 14, 14, H + b.rh * 0.6, H + b.rh * 0.6 + 13, '#2d5fc8');
      // glow outline for selection
      if (selected && !this.fp) {
        const top = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => this.pr(this.W3(b, u, v, b.top + z0)));
        const poly = hull(outline.concat(top).map(p => [p[0], p[1]]));
        ctx.save(); ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 22; ctx.strokeStyle = 'rgba(255,214,77,0.95)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke(); ctx.restore();
      } else if (hovered && !this.fp) {
        const top = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => this.pr(this.W3(b, u, v, b.top + z0)));
        const poly = hull(outline.concat(top).map(p => [p[0], p[1]]));
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
      }
      ctx.restore(); this._dim = 0; this._hl = 0;
      // hit area (footprint + top hull)
      if (this.fp) { /* ray picking is used in first-person */ } else if (!/_wing$/.test(b.id) && !/^decor/.test(b.id)) {
        const top = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => this.pr(this.W3(b, u, v, b.top + z0)));
        this.hits.push({ id: b.id, poly: hull(outline.concat(top).map(p => [p[0], p[1]])) });
      } else if (/_wing$/.test(b.id)) {
        const top = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => this.pr(this.W3(b, u, v, b.top + z0)));
        this.hits.push({ id: b.id.replace('_wing', ''), poly: hull(outline.concat(top).map(p => [p[0], p[1]])) });
      }
    }
    box(ctx, x, y, w, h, z0, z1, color) {
      const cs = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => [x + u, y + v]);
      const fq = cs.map(p => this.pr([p[0], p[1], z0])), fa = area(fq);
      for (let i = 0; i < 4; i++) {
        const a = cs[i], c2 = cs[(i + 1) % 4], dx = c2[0] - a[0], dy = c2[1] - a[1], l = Math.hypot(dx, dy), n = [dy / l, -dx / l, 0];
        const q = [this.pr([a[0], a[1], z0]), this.pr([c2[0], c2[1], z0]), this.pr([c2[0], c2[1], z1]), this.pr([a[0], a[1], z1])];
        if (this.wallVis(a, c2, n, q, fa)) this.face(ctx, [[a[0], a[1], z0], [c2[0], c2[1], z0], [c2[0], c2[1], z1], [a[0], a[1], z1]], color, n);
      }
      this.face(ctx, cs.map(p => [p[0], p[1], z1]), color, [0, 0, 1]);
    }

    drawWallDetail(ctx, b, a, c, len, nrm, z0, edgeIdx) {
      const L = b.look, pix = Math.hypot(this.pr(a)[0] - this.pr(c)[0], this.pr(a)[1] - this.pr(c)[1]);
      const isLong = len >= Math.max(b.w, b.h) * 0.8 && len > 40;
      const pt = (u, z) => this.pr([lerp(a[0], c[0], u), lerp(a[1], c[1], u), z0 + z]);
      const strip = (u0, u1, z0_, z1_, color, k = 1) => {
        this.fillPoly(ctx, [pt(u0, z0_), pt(u1, z0_), pt(u1, z1_), pt(u0, z1_)], this.shade(color, k));
      };
      const kdir = 0.55 + 0.6 * Math.max(0, nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1]);
      // end-wall accent stripe
      if (L.stripe && !isLong) { strip(0, 1, 0, b.H, L.stripe === 'pink' ? '#b46a8a' : '#2f6fe0', kdir); }
      if (L.base && pix > 30) strip(0, 1, 0, 1.9, L.base, kdir);
      if (!isLong && !L.stripe) { if (pix < 22) return; }
      if (pix < 38) return;
      // blue vertical fins at wall end
      if (L.fins && isLong) { for (let k = 0; k < 4; k++) strip(0.86 + k * 0.035, 0.86 + k * 0.035 + 0.018, 0, b.H, '#2f6fe0', kdir); }
      // floor slabs / balcony railings
      for (let f = 0; f < b.floors; f++) {
        const zf = f * FH;
        if (f > 0 && L.balcony && isLong) { strip(0, 1, zf - 0.3, zf + 2.6, L.trim || '#2f6fe0', kdir * 0.95); strip(0, 1, zf + 2.6, zf + 3.6, '#ffffff', kdir * 0.4); }
        else if (f > 0) strip(0, 1, zf - 0.4, zf + 0.5, '#8d8570', kdir * 0.9);
      }
      // windows / arcade
      const bay = 12, nb = Math.max(1, Math.floor(len / bay));
      for (let f = 0; f < b.floors; f++) {
        const zf = f * FH;
        if (f === 0 && L.arcade && isLong) {
          strip(0.01, 0.99, 0.4, FH * 0.82, '#3b322b', kdir * 0.8);
          const np = Math.max(2, Math.floor(len / 16));
          for (let k = 0; k <= np; k++) { const u = k / np; strip(Math.max(0, u - 0.006), Math.min(1, u + 0.006), 0, FH * 0.85, '#f1e5b6', kdir); }
          continue;
        }
        if (pix < 70 && !isLong) continue;
        for (let k = 0; k < nb; k++) {
          const u0 = (k + 0.25) / nb, u1 = (k + 0.7) / nb, lit = hash(b.id + f + k) > 0.3;
          const zz0 = zf + 3.2, zz1 = zf + 7.4;
          const col = this.night > 0.45 ? (lit ? '#ffd478' : '#27324a') : '#56748f';
          this.fillPoly(ctx, [pt(u0, zz0), pt(u1, zz0), pt(u1, zz1), pt(u0, zz1)], this.night > 0.45 && lit ? col : this.shade(col, kdir * 0.95));
          if (this.night > 0.45 && lit) { ctx.save(); ctx.globalAlpha *= 0.28; this.fillPoly(ctx, [pt(u0 - 0.01, zz0 - 1), pt(u1 + 0.01, zz0 - 1), pt(u1 + 0.01, zz1 + 1), pt(u0 - 0.01, zz1 + 1)], '#ffd478'); ctx.restore(); }
        }
      }
    }

    drawRoof(ctx, b, z0, H, alpha, outline) {
      const hw = b.w / 2, hh = b.h / 2, rc = b.look.roofC || '#a8483f', e = b.roof === 'flat' ? 0 : 2.6;
      if (b.look.fascia) { /* thicker coloured fascia on flat roofs */ }
      const W3 = (u, v, z) => this.W3(b, u, v, z);
      const rot = (n) => [n[0] * b.cs - n[1] * b.sn, n[0] * b.sn + n[1] * b.cs, n[2]];
      const nrmOf = (p0, p1, p2) => {
        const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
        let n = norm3([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]); if (n[2] < 0) n = [-n[0], -n[1], -n[2]]; return n;
      };
      const faces = [];
      const addF = (pts, color) => faces.push({ pts, color, key: pts.reduce((s, p) => s + this.pr(p)[2], 0) / pts.length });
      if (b.roof === 'flat') {
        this.face(ctx, [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => W3(u, v, H)), rc, [0, 0, 1]);
        // parapet
        const rim = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
        for (let i = 0; i < 4; i++) {
          const p = rim[i], q = rim[(i + 1) % 4]; const ph = b.look.fascia ? 3.4 : 1.6, A = W3(p[0], p[1], H), B = W3(q[0], q[1], H), A2 = W3(p[0], p[1], H + ph), B2 = W3(q[0], q[1], H + ph);
          const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
          const qd = [this.pr(A), this.pr(B), this.pr(B2), this.pr(A2)], fa = area([this.pr(W3(-hw, -hh, H)), this.pr(W3(hw, -hh, H)), this.pr(W3(hw, hh, H))]);
          if (this.wallVis(A, B, [dy / l, -dx / l, 0], qd, fa)) this.face(ctx, [A, B, B2, A2], b.look.fascia || '#c9c3b2', [dy / l, -dx / l, 0]);
        }
        return;
      }
      if (b.roof === 'hip' || b.roof === 'gable') {
        const along = b.w >= b.h, a = (along ? hw : hh) + e, bb = (along ? hh : hw) + e;
        const rz = H + b.rh, rl = b.roof === 'gable' ? a : Math.max(a - bb, 1);
        const M = (p, q, z) => along ? W3(p, q, z) : W3(q, p, z);
        const R1 = M(-rl, 0, rz), R2 = M(rl, 0, rz);
        addF([M(-a, -bb, H), M(a, -bb, H), R2, R1], rc);
        addF([M(a, bb, H), M(-a, bb, H), R1, R2], rc);
        if (b.roof === 'hip') { addF([M(-a, bb, H), M(-a, -bb, H), R1], rc); addF([M(a, -bb, H), M(a, bb, H), R2], rc); }
        else { faces.push({ pts: [M(-a, bb - e, H), M(-a, -bb + e, H), R1], color: b.look.wall || '#efe3c0', key: this.pr(R1)[2] - 1 }); faces.push({ pts: [M(a, -bb + e, H), M(a, bb - e, H), R2], color: b.look.wall || '#efe3c0', key: this.pr(R2)[2] - 1 }); }
      } else if (b.roof === 'shed') {
        const A = [-hw - e, -hh - e], B = [hw + e, -hh - e], C = [hw + e, hh + e], Dd = [-hw - e, hh + e];
        const along = b.w >= b.h; const lowZ = H + 1.5, hiZ = H + b.rh;
        const pts = along ? [W3(A[0], A[1], hiZ), W3(B[0], B[1], hiZ), W3(C[0], C[1], lowZ), W3(Dd[0], Dd[1], lowZ)] : [W3(A[0], A[1], lowZ), W3(B[0], B[1], hiZ), W3(C[0], C[1], hiZ), W3(Dd[0], Dd[1], lowZ)];
        this.face(ctx, pts, rc, nrmOf(pts[0], pts[1], pts[2]));
        // trim fascia along the low edge
        const f = along ? [Dd, C] : [A, Dd];
        return;
      } else if (b.roof === 'arch') {
        const N = 10, along = b.w >= b.h, a = along ? hw + 3 : hh + 3, s = along ? hh + 3 : hw + 3, rz = H;
        const strips = [];
        for (let i = 0; i < N; i++) {
          const t0 = -1 + 2 * i / N, t1 = -1 + 2 * (i + 1) / N;
          const z = t => rz + b.rh * Math.sqrt(Math.max(0, 1 - t * t));
          const M = (p, q, zz) => along ? W3(p, q, zz) : W3(q, p, zz);
          const pts = [M(-a, t0 * s, z(t0)), M(a, t0 * s, z(t0)), M(a, t1 * s, z(t1)), M(-a, t1 * s, z(t1))];
          const mid = (t0 + t1) / 2, nn = rot(along ? [0, mid, 1 - Math.abs(mid) * 0.6] : [mid, 0, 1 - Math.abs(mid) * 0.6]);
          faces.push({ pts, color: rc, nrm: norm3(along ? rot([0, mid * 0.8, 1 - Math.abs(mid) * 0.4]) : rot([mid * 0.8, 0, 1 - Math.abs(mid) * 0.4])), key: this.pr(pts[0])[2] });
        }
        faces.sort((p, q) => p.key - q.key).forEach(f => this.face(ctx, f.pts, f.color, f.nrm, alpha));
        return;
      }
      faces.sort((p, q) => p.key - q.key).forEach(f => this.face(ctx, f.pts, f.color, nrmOf(f.pts[0], f.pts[1], f.pts[2]), alpha));
    }

    drawTree(ctx, t, alpha) {
      const base = this.proj(t.x, t.y, 0), top = this.proj(t.x, t.y, 15 * t.s), sc = this.fp ? this._F / Math.max(base[5], 1) : this._S, r = 9 * t.s * sc;
      if (this.fp && base[5] < 2.5) return;
      if (base[0] < -50 || base[0] > this.W + 50) return;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.fillStyle = this.shade('#6b4a2f', 1); ctx.fillRect(base[0] - 1.4 * sc, top[1], 2.8 * sc, base[1] - top[1]);
      const g = ctx.createRadialGradient(top[0] - r * 0.3, top[1] - r * 0.3, r * 0.1, top[0], top[1], r);
      g.addColorStop(0, this.shade(t.c > 0.5 ? '#6fb060' : '#7bbd6a', 1)); g.addColorStop(1, this.shade('#2f6e3c', 1));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(top[0], top[1] - r * 0.2, r, 0, 6.283); ctx.fill(); ctx.restore();
    }
    drawPalm(ctx, t) {
      const base = this.proj(t.x, t.y, 0), top = this.proj(t.x, t.y, 26 * t.s);
      if (this.fp && base[5] < 2.5) return;
      const S = (this.fp ? this._F / Math.max(base[5], 1) : this._S) * t.s;
      ctx.strokeStyle = this.shade('#8a6a45', 1); ctx.lineWidth = Math.max(1.4, 1.8 * S); ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.quadraticCurveTo((base[0] + top[0]) / 2 + 3 * S, (base[1] + top[1]) / 2, top[0], top[1]); ctx.stroke();
      ctx.strokeStyle = this.shade('#2f8a44', 1); ctx.lineWidth = Math.max(1.2, 2 * S);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * 6.283 + t.x, l = 13 * S; ctx.beginPath(); ctx.moveTo(top[0], top[1]);
        ctx.quadraticCurveTo(top[0] + Math.cos(a) * l * 0.6, top[1] + Math.sin(a) * l * 0.35 - l * 0.45, top[0] + Math.cos(a) * l, top[1] + Math.sin(a) * l * 0.5 + l * 0.2); ctx.stroke();
      }
    }

    drawOverpass(ctx) {
      const o = D.OVERPASS, h = o.height, dx = o.b[0] - o.a[0], dy = o.b[1] - o.a[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy * o.width / 2, ny = ux * o.width / 2;
      const col = '#b9b9b4', rail = '#2f6fe0';
      const pt = (t, side, z) => [o.a[0] + dx * t + nx * side, o.a[1] + dy * t + ny * side, z];
      // pillars
      [0.15, 0.85].forEach(t => [-1, 1].forEach(s => { const p0 = this.pr(pt(t, s * 0.85, 0)), p1 = this.pr(pt(t, s * 0.85, h)); ctx.strokeStyle = this.shade('#8f8e88', 1); ctx.lineWidth = Math.max(2, 2.6 * this._S); this.ln(ctx, p0, p1); }));
      // stairs (sloping slabs) at both ends
      const stair = (t0, dir) => {
        const ex = o.a[0] + dx * t0, ey = o.a[1] + dy * t0, run = 30;
        const ax = ex + ux * dir * run, ay = ey + uy * dir * run;
        const q = [[ex + nx, ey + ny, h], [ex - nx, ey - ny, h], [ax - nx, ay - ny, 0], [ax + nx, ay + ny, 0]];
        this.fillPoly(ctx, q.map(p => this.pr(p)), this.shade('#a9a8a0', 1), 'rgba(0,0,0,0.25)', 0.6);
        for (let k = 1; k < 6; k++) { const f = k / 6, a = this.pr([ex + nx + (ax - ex) * f, ey + ny + (ay - ey) * f, h * (1 - f)]), b2 = this.pr([ex - nx + (ax - ex) * f, ey - ny + (ay - ey) * f, h * (1 - f)]); ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 0.7; this.ln(ctx, a, b2); }
        [1, -1].forEach(s => { const p0 = this.pr([ex + nx * s, ey + ny * s, h + 4]), p1 = this.pr([ax + nx * s, ay + ny * s, 4]); ctx.strokeStyle = this.shade(rail, 1); ctx.lineWidth = Math.max(1.2, 1.4 * this._S); this.ln(ctx, p0, p1); });
      };
      stair(0, -1); stair(1, 1);
      // deck slab
      const top = [pt(0, 1, h), pt(1, 1, h), pt(1, -1, h), pt(0, -1, h)];
      const side = [pt(0, 1, h), pt(1, 1, h), pt(1, 1, h - 2), pt(0, 1, h - 2)], side2 = [pt(0, -1, h), pt(1, -1, h), pt(1, -1, h - 2), pt(0, -1, h - 2)];
      [side, side2].forEach(s => this.fillPoly(ctx, s.map(p => this.pr(p)), this.shade('#8f8e88', 0.9)));
      this.fillPoly(ctx, top.map(p => this.pr(p)), this.shade(col, 1), 'rgba(0,0,0,0.25)', 0.7);
      // roof canopy + rails
      [1, -1].forEach(s => { const a = this.pr(pt(0, s, h)), b2 = this.pr(pt(1, s, h)), a2 = this.pr(pt(0, s, h + 4)), b3 = this.pr(pt(1, s, h + 4)); this.fillPoly(ctx, [a, b2, b3, a2], this.shade(rail, 1), null); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1; this.ln(ctx, a2, b3); });
      const cap = [pt(0, 1.15, h + 9), pt(1, 1.15, h + 9), pt(1, -1.15, h + 9), pt(0, -1.15, h + 9)];
      ctx.save(); ctx.globalAlpha = 0.9; this.fillPoly(ctx, cap.map(p => this.pr(p)), this.shade('#2a55b0', 1), 'rgba(0,0,0,0.25)', 0.6); ctx.restore();
      [0.02, 0.5, 0.98].forEach(t => [1, -1].forEach(s => { const a = this.pr(pt(t, s * 1.05, h)), b2 = this.pr(pt(t, s * 1.05, h + 9)); ctx.strokeStyle = this.shade('#6e6d68', 1); ctx.lineWidth = 1.2; this.ln(ctx, a, b2); }));
    }

    /* ---------- facilities, route ---------- */
    drawFacilities(ctx) {
      this.facilityHits = [];
      if (this.cam.zoom < 0.7) return;
      D.FACILITIES.forEach(f => {
        if (!this.layers[f.type]) return;
        const ft = D.FACILITY_TYPES.find(t => t.id === f.type), q = this.proj(f.x, f.y, 6);
        if (this.fp && (q[5] < 2 || q[5] > 300)) return;
        ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = ft.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(q[0], q[1], 12, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.font = '13px "Segoe UI Emoji","Apple Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ft.icon, q[0], q[1] + 1); ctx.restore();
        this.facilityHits.push({ x: q[0], y: q[1], f });
      });
    }
    clipRuns(p3) {
      const runs = []; let cur = null, prevVis = false;
      for (let i = 1; i < p3.length; i++) {
        let a = p3[i - 1], b = p3[i]; const qa0 = this.proj(a[0], a[1], a[2] + 0.5), qb0 = this.proj(b[0], b[1], b[2] + 0.5), ia = qa0[5] >= 1.2, ib = qb0[5] >= 1.2;
        if (!ia && !ib) { cur = null; continue; }
        let qa = qa0, qb = qb0;
        if (!ia) { const t = (1.2 - qa0[5]) / (qb0[5] - qa0[5]); qa = this.proj(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t) + 0.5); }
        if (!ib) { const t = (1.2 - qa0[5]) / (qb0[5] - qa0[5]); qb = this.proj(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t) + 0.5); }
        if (!cur || !ia) { cur = [qa]; runs.push(cur); }
        cur.push(qb); if (!ib) cur = null;
      }
      return runs;
    }
    drawRoute(ctx) {
      const r = this.route, runs = this.fp ? this.clipRuns(r.pts) : [r.pts.map(p => this.proj(p[0], p[1], p[2] + 0.5))];
      const stroke = (w, col, dash, off) => { runs.forEach(pts => { if (pts.length < 2) return; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.setLineDash(dash || []); ctx.lineDashOffset = off || 0; ctx.stroke(); }); };
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      stroke(9, 'rgba(255,255,255,0.95)');
      stroke(5.5, '#1a73e8');
      ctx.setLineDash([]);
      stroke(2.6, '#ffffff', [7, 9], -(this.time * 38));   // flowing dashes → destination
      // walking dot
      const total = r.len, cyc = Math.max(4, total / 55), prog = ((this.time - this.routeT0) % cyc) / cyc, target = prog * total;
      let acc = 0, dot = null;
      for (let i = 1; i < r.pts.length; i++) {
        const seg = Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
        if (acc + seg >= target) { const t = (target - acc) / (seg || 1); dot = this.proj(lerp(r.pts[i - 1][0], r.pts[i][0], t), lerp(r.pts[i - 1][1], r.pts[i][1], t), lerp(r.pts[i - 1][2], r.pts[i][2], t) + 3); break; }
        acc += seg;
      }
      ctx.setLineDash([]);
      const f = r.pts[0], l = r.pts[r.pts.length - 1], s0 = this.proj(f[0], f[1], 0.5), e0 = this.proj(l[0], l[1], 0.5);
      if (!this.fp || s0[5] > 2) { ctx.fillStyle = '#16a34a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s0[0], s0[1], 7, 0, 6.283); ctx.fill(); ctx.stroke(); }
      if (!this.fp || e0[5] > 2) { ctx.fillStyle = '#e53935'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e0[0], e0[1], 7, 0, 6.283); ctx.fill(); ctx.stroke(); }
      if (dot && (!this.fp || dot[5] > 2)) {
        ctx.shadowColor = 'rgba(26,115,232,0.9)'; ctx.shadowBlur = 14; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(dot[0], dot[1], 6.5, 0, 6.283); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#1a73e8'; ctx.beginPath(); ctx.arc(dot[0], dot[1], 4, 0, 6.283); ctx.fill();
      }
      ctx.restore();
    }

    /* ---------- markers + decluttered labels ---------- */
    drawMarkersAndLabels(ctx) {
      this.markerHits = []; const placed = []; const z = this.cam.zoom, sel = this.selected;
      const list = this.buildings.map(b => {
        const q = this.proj(b.x, b.y, b.top + (this.selected === b.id ? 3.2 : 0) + 14);
        const hide = this.fp && (q[5] < 3 || q[5] > 420);
        return { b, x: hide ? -9999 : q[0], y: hide ? -9999 : q[1], d: q[5] };
      });
      const cat = id => (D.CATEGORIES.find(c => c.id === id) || {}).color;
      const mk = list.map(m => ({ id: m.b.id, x: m.x - 15, y: m.y - 15, w: 30, h: 30 }));   // markers always reserve space
      // markers
      list.forEach(({ b, x, y }) => {
        if (x < -30 || x > this.W + 30 || y < -30 || y > this.H + 30) return;
        const isSel = sel === b.id, hov = this.hover === b.id, col = cat(b.cat), rr = isSel ? 15 : hov ? 14 : 12.5, dim = (sel && !isSel ? 0.7 : 1) * ((this.filter && this.filter !== 'all' && b.cat !== this.filter && !isSel) ? 0.4 : 1);
        const base = this.proj(b.x, b.y, b.top + (isSel ? 3.2 : 0));
        ctx.save(); ctx.globalAlpha = dim;
        ctx.strokeStyle = 'rgba(30,40,50,0.45)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(x, y + rr); ctx.stroke();
        if (isSel) {
          const ph = (this.time % 1.4) / 1.4;
          for (let k = 0; k < 2; k++) { const p = (ph + k * 0.5) % 1; ctx.strokeStyle = col; ctx.globalAlpha = (1 - p) * 0.75; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, rr + p * 30, 0, 6.283); ctx.stroke(); }
          ctx.globalAlpha = 1; ctx.shadowColor = col; ctx.shadowBlur = 18;
        }
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fill();
        ctx.shadowBlur = 0; ctx.lineWidth = 2.6; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `700 ${isSel ? 14 : 12.5}px Inter,system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.n, x, y + 0.5);
        ctx.restore();
        this.markerHits.push({ id: b.id, x, y });
      });
      if (this.focusPoint) {
        const q = this.proj(this.focusPoint.x, this.focusPoint.y, 4), ph = (this.time % 1.4) / 1.4;
        ctx.save(); ctx.strokeStyle = '#ff7a00'; ctx.lineWidth = 3; for (let k = 0; k < 2; k++) { const p = (ph + k * 0.5) % 1; ctx.globalAlpha = 1 - p; ctx.beginPath(); ctx.arc(q[0], q[1], 8 + p * 30, 0, 6.283); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.fillStyle = '#ff7a00'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q[0], q[1], 8, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      // labels: zoomed out → numbers only. Zoomed in → full names, collision-free.
      const show = this.fp ? true : z >= 1.15, order = list.slice().sort((a, b) => (b.b.id === sel) - (a.b.id === sel) || (b.b.id === this.hover) - (a.b.id === this.hover) || b.b.w * b.b.h - a.b.w * a.b.h);
      ctx.font = '600 12px Inter,system-ui,sans-serif'; ctx.textBaseline = 'middle';
      const lineH = 14;
      order.forEach(({ b, x, y, d }) => {
        const must = b.id === sel || b.id === this.hover;
        if (!must && !(show && (!this.fp || d < 170))) return;
        if (x < 0 || x > this.W || y < 0 || y > this.H) return;
        const full = b.name, maxW = 150;
        const lines = wrap(ctx, full, maxW);
        const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 14, h = lines.length * lineH + 8;
        const cands = [[x - w / 2, y + 19], [x - w / 2, y - 19 - h], [x + 19, y - h / 2], [x - 19 - w, y - h / 2]];
        let pos = null;
        for (const c of cands) { const r = { x: c[0], y: c[1], w, h }; if (!placed.some(p => overlap(p, r)) && !mk.some(m => m.id !== b.id && overlap(m, r)) && r.x > this.inset.l - 10 && r.x + r.w < this.W - this.inset.r + 10) { pos = r; break; } }
        if (!pos && must) pos = { x: cands[0][0], y: cands[0][1], w, h };
        if (!pos) return;
        placed.push(pos);
        ctx.save();
        ctx.fillStyle = this.night > 0.5 ? 'rgba(20,28,44,0.92)' : 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
        rr(ctx, pos.x, pos.y, pos.w, pos.h, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = this.night > 0.5 ? '#e6ecff' : '#1d2b36'; ctx.textAlign = 'center';
        lines.forEach((l, i) => ctx.fillText(l, pos.x + pos.w / 2, pos.y + 4 + lineH * (i + 0.5) + 0.5));
        ctx.restore();
      });
    }
    drawGate(ctx, g) {
      /* each gate is a list of small boxes {dx, dy, w, d, z0, z1, c}, sorted far → near so any camera angle looks right */
      const P = [], add = (dx, w, z0, z1, c, d = 3.4, dy = 0) => P.push({ dx, dy, w, d, z0, z1, c });
      const st = g.style || 'blue', x = g.x, y = g.y;
      if (st === 'welcome') {                       // Gate 2 / main gate — blue "WELCOME" arch + dark sign wall + stone pier
        add(-34, 30, 0, 9, '#1f4fb8', 2.6); add(-34, 27, 1.2, 8, '#2b2f3a', 3.0, 0.1);       // university sign wall
        add(-16, 4, 0, 14, '#2250c0', 4.2); add(16, 4, 0, 14, '#2250c0', 4.2);               // blue pillars
        add(0, 36, 14, 17.5, '#2250c0', 4.0); add(0, 22, 17.5, 22, '#2250c0', 4.0);            // lintel + raised WELCOME header
        add(-8, 11, 0, 9.5, '#3a74e0', 1.4, 0.4); add(8, 11, 0, 9.5, '#3a74e0', 1.4, 0.4);      // two slatted gate leaves
        add(-24, 7, 0, 12, '#2250c0', 3.8); add(24, 7, 0, 12, '#2250c0', 3.8);                // outer posts
        add(36, 18, 0, 8, '#6f7377', 3.2); add(36, 18, 8, 9.2, '#2250c0', 3.4);                // stone-clad wall
      } else if (st === 'red') {                    // Gate 4 — red SDS gate + picket fence + wooden guard post
        add(-9, 3.6, 0, 12, '#a32a2a', 3.6); add(9, 3.6, 0, 12, '#a32a2a', 3.6); add(-9, 4.6, 12, 13.2, '#7a1f1f', 4.6); add(9, 4.6, 12, 13.2, '#7a1f1f', 4.6);
        add(-4.5, 5, 0, 7, '#b13030', 1.0); add(4.5, 5, 0, 7, '#b13030', 1.0);                // low red gate leaves ("SDS CANTILAN")
        add(-24, 20, 0, 5, '#efe9da', 0.8); add(-24, 20, 5, 5.5, '#d8d1bf', 1.0);             // white picket fence
        add(-36, 3, 0, 9, '#a32a2a', 3.2); add(-36, 5, 9, 10, '#7a1f1f', 4.4);                // far red pillar
        add(22, 14, 0, 4.5, '#efe9da', 0.8);                                                  // picket fence (right)
        add(34, 12, 0, 8, '#8a6a45', 9, 1); add(34, 15, 8, 9.6, '#b0503c', 11, 1);            // wooden guard post + rusty roof
        add(15, 2.4, 3, 8, '#2d7fd1', 0.8, 2.2);                                              // blue "GATE 4" sign
      } else if (st === 'tan') {                    // Gate 5 — tan pillars, light-blue leaves, grey pergola, stone guard house
        add(-11, 4, 0, 13, '#d8c08c', 4), add(11, 4, 0, 13, '#d8c08c', 4); add(-11, 5.4, 13, 14.2, '#bfb9aa', 5.4); add(11, 5.4, 13, 14.2, '#bfb9aa', 5.4);
        add(-6, 6.6, 0, 10, '#4aa3df', 1.0); add(5.5, 11, 0, 10, '#4aa3df', 1.0); add(5.5, 8, 5.2, 6, '#3a86c0', 1.2, 0.4);    // blue leaves with slat band
        add(-17, 3, 0, 5, '#d8c08c', 3); add(-17, 3.6, 5, 5.8, '#bfb9aa', 3.6);               // tan pillar + cap (left wall end)
        add(-30, 20, 0, 6, '#8c8a80', 2.6);                                                    // stone wall
        add(-23, 2, 0, 15, '#a9b4c6', 2); add(-18, 2, 0, 15, '#a9b4c6', 2); add(-20.5, 12, 15, 16.2, '#a9b4c6', 6);   // grey pergola
        add(29, 14, 0, 9.5, '#8d8c85', 10); add(29, 4, 0, 9.5, '#d8c08c', 10.6); add(29, 17, 9.5, 10.8, '#cdbd98', 12);  // stone guard house
        add(18, 3.6, 0, 11, '#d8c08c', 3.6); add(18, 4.6, 11, 11.8, '#bfb9aa', 4.6);
      } else {                                      // blue steel gate (Gates 1 and 6)
        add(-8, 3.4, 0, 15, '#d9d3c3'); add(8, 3.4, 0, 15, '#d9d3c3'); add(0, 19.4, 15, 18.2, '#2f6fe0', 3.6);
        add(-8, 4.6, 15, 16.2, '#b9b2a2', 4.6); add(8, 4.6, 15, 16.2, '#b9b2a2', 4.6);
        add(-4.2, 6.4, 0, 8.5, '#3a74e0', 1.0); add(4.2, 6.4, 0, 8.5, '#3a74e0', 1.0);
      }
      P.map(o => (o.k = this.proj(x + o.dx, y + o.dy, 0)[2], o)).sort((a, b) => a.k - b.k)
        .forEach(o => this.box(ctx, x + o.dx, y + o.dy, o.w, o.d, o.z0, o.z1, o.c));
      if (st === 'welcome') {                       // "WELCOME" lettering on the header, drawn when close enough to read
        const q = this.proj(x, y + (this.fp ? 0 : 0), 19.8); let fs = this.fp ? this._F / Math.max(q[5], 1.2) * 3.4 : this._S * 3.4;
        if (fs >= 6 && fs < 90 && (!this.fp || q[5] > 0)) { ctx.save(); ctx.font = `900 ${fs}px Inter,system-ui,sans-serif`; ctx.fillStyle = this.night > 0.5 ? '#cfd8ee' : '#e9edf5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('WELCOME', q[0], q[1]); ctx.restore(); }
      }
    }
    drawGateLabels(ctx) {
      D.GATES.forEach(g => {
        const q = this.proj(g.x, g.y, 31); if (this.fp ? (q[5] < 3 || q[5] > 200) : this.cam.zoom < 0.8) return;
        const t = g.name.split(' (')[0].toUpperCase(); ctx.save(); ctx.font = '800 10.5px Inter,system-ui,sans-serif'; const w = ctx.measureText(t).width + 14;
        ctx.fillStyle = '#1b3f9b'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rr(ctx, q[0] - w / 2, q[1] - 10, w, 20, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, q[0], q[1] + 0.5); ctx.restore();
      });
    }
    drawScale(ctx) {
      this.emit('scale', 50 / D.METERS_PER_UNIT * this._S);
    }
  }

  function area(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a; }
  function overlap(a, b) { return a.x < b.x + b.w + 3 && a.x + a.w + 3 > b.x && a.y < b.y + b.h + 3 && a.y + a.h + 3 > b.y; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function wrap(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return [text];
    const words = text.split(' '); let best = [text], bw = 1e9;
    for (let i = 1; i < words.length; i++) {
      const l = [words.slice(0, i).join(' '), words.slice(i).join(' ')], w = Math.max(ctx.measureText(l[0]).width, ctx.measureText(l[1]).width);
      if (w < bw) { bw = w; best = l; }
    }
    return best;
  }
  NEMSU.Engine = Engine; NEMSU.util = { clamp, easeIO, hash };
})();
