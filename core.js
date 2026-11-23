// Picture -> bead grid. Pure functions on plain arrays, so node can test them (test_core.js).
(function (root) {
  const lin = c => (c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const fl = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  function lab(r, g, b) {
    const R = lin(r), G = lin(g), B = lin(b);
    const x = fl((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
    const y = fl(R * 0.2126 + G * 0.7152 + B * 0.0722);
    const z = fl((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgbHex = c => "#" + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

  // Median of each channel over a (2r+1)^2 window; alpha is kept as it is.
  function median(px, w, h, r) {
    const out = new Uint8ClampedArray(px), buf = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
      buf.length = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy));
        buf.push(px[(yy * w + xx) * 4 + c]);
      }
      buf.sort((a, b) => a - b);
      out[(y * w + x) * 4 + c] = buf[buf.length >> 1];
    }
    return out;
  }

  // Area-average down to gw x gh with premultiplied alpha (no dark halo at the edges);
  // a source no bigger than the grid (pixel art) is sampled nearest instead.
  function downscale(px, w, h, gw, gh) {
    const rgb = new Float32Array(gw * gh * 3), alpha = new Float32Array(gw * gh);
    const nearest = w <= gw;
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      let x0, x1, y0, y1;
      if (nearest) { x0 = Math.floor((gx + 0.5) * w / gw); y0 = Math.floor((gy + 0.5) * h / gh); x1 = x0 + 1; y1 = y0 + 1; }
      else {
        x0 = Math.floor(gx * w / gw); x1 = Math.max(x0 + 1, Math.floor((gx + 1) * w / gw));
        y0 = Math.floor(gy * h / gh); y1 = Math.max(y0 + 1, Math.floor((gy + 1) * h / gh));
      }
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4, A = px[i + 3] / 255;
        r += px[i] * A; g += px[i + 1] * A; b += px[i + 2] * A; a += A; n++;
      }
      const k = gy * gw + gx;
      alpha[k] = a / n;
      if (a > 0) { rgb[k * 3] = r / a; rgb[k * 3 + 1] = g / a; rgb[k * 3 + 2] = b / a; }
    }
    return { w: gw, h: gh, rgb, alpha, nearest };
  }

  // Clear the background: flood in from the edges through cells close to the edges' median colour.
  function clearBackground(cells, tol) {
    const { w, h, rgb, alpha } = cells, L = k => lab(rgb[k * 3], rgb[k * 3 + 1], rgb[k * 3 + 2]);
    const edge = [];
    for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
    for (let y = 1; y < h - 1; y++) edge.push(y * w, y * w + w - 1);
    const solid = edge.filter(k => alpha[k] >= 0.43);
    if (!solid.length) return cells;
    const labs = solid.map(L), ref = [0, 1, 2].map(c => labs.map(l => l[c]).sort((a, b) => a - b)[labs.length >> 1]);
    const seen = new Uint8Array(w * h), q = solid.filter(k => dist(L(k), ref) <= tol);
    q.forEach(k => seen[k] = 1);
    while (q.length) {
      const k = q.pop(), x = k % w, y = (k / w) | 0;
      alpha[k] = 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (!seen[n] && alpha[n] >= 0.43 && dist(L(n), ref) <= tol) { seen[n] = 1; q.push(n); }
      }
    }
    return cells;
  }

  // Nearest palette colour (CIE76 in Lab); -1 where the picture is see-through.
  function match(cells, palette) {
    const pl = palette.map(p => lab(...hexRgb(p.hex))), idx = new Int16Array(cells.w * cells.h).fill(-1), memo = new Map();
    if (!pl.length) return idx;
    for (let k = 0; k < idx.length; k++) {
      if (cells.alpha[k] < 0.43) continue;
      const r = cells.rgb[k * 3] | 0, g = cells.rgb[k * 3 + 1] | 0, b = cells.rgb[k * 3 + 2] | 0, key = (r << 16) | (g << 8) | b;
      let best = memo.get(key);
      if (best === undefined) {
        const l = lab(r, g, b); let d = Infinity; best = 0;
        pl.forEach((p, i) => { const e = dist(l, p); if (e < d) { d = e; best = i; } });
        memo.set(key, best);
      }
      idx[k] = best;
    }
    return idx;
  }

  // Lone beads (nothing beside them) fall off when ironed: remove them. Then a bead unlike all its
  // neighbours (three or four of them) takes their most common colour, `passes` times.
  function cleanup(idx, w, h, passes) {
    const nb = (a, x, y) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h).map(([nx, ny]) => a[ny * w + nx]).filter(v => v >= 0);
    let a = Int16Array.from(idx);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[y * w + x] >= 0 && !nb(idx, x, y).length) a[y * w + x] = -1;
    for (let p = 0; p < passes; p++) {
      const b = Int16Array.from(a);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = a[y * w + x]; if (v < 0) continue;
        const n = nb(a, x, y); if (n.length < 3 || n.includes(v)) continue;
        const c = {}; n.forEach(m => c[m] = (c[m] || 0) + 1);
        b[y * w + x] = +Object.keys(c).sort((p, q) => c[q] - c[p])[0];
      }
      a = b;
    }
    return a;
  }

  // Median colour of a square around (x, y), white-balanced by per-channel gains.
  function sample(px, w, h, x, y, r, gains) {
    const ch = [[], [], []];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy)), i = (yy * w + xx) * 4;
      for (let c = 0; c < 3; c++) ch[c].push(px[i + c]);
    }
    return ch.map((v, c) => v.sort((a, b) => a - b)[v.length >> 1] * (gains ? gains[c] : 1));
  }

  // Where the picture sits on the boards: fitted to them, then zoomed, then moved. pan is -1..1 across the
  // free room (or, zoomed past the boards, across the part that hangs over): -1 left or top, 0 centred, 1 right or bottom.
  function layout(iw, ih, across, down, B, zoom = 1, panX = 0, panY = 0) {
    const nx = across * B, ny = down * B, ar = iw / ih;
    let gw = nx, gh = Math.max(1, Math.round(gw / ar));
    if (gh > ny) { gh = ny; gw = Math.max(1, Math.round(gh * ar)); }
    gw = Math.max(1, Math.round(gw * zoom)); gh = Math.max(1, Math.round(gh * zoom));
    return { nx, ny, gw, gh, ox: Math.round((nx - gw) / 2 * (1 + panX)) | 0, oy: Math.round((ny - gh) / 2 * (1 + panY)) | 0 };
  }

  // The picture grid (palette index or -1) onto the boards (palette index + 1, 0 for an empty peg); what hangs over is cut off.
  function place(idx, L) {
    const grid = new Int16Array(L.nx * L.ny);
    for (let y = 0; y < L.gh; y++) {
      const Y = y + L.oy; if (Y < 0 || Y >= L.ny) continue;
      for (let x = 0; x < L.gw; x++) { const X = x + L.ox; if (X >= 0 && X < L.nx) grid[Y * L.nx + X] = idx[y * L.gw + x] + 1; }
    }
    return grid;
  }

  // The n most used palette indexes in a matched grid, most used first.
  function topColours(idx, n) {
    const c = new Map();
    for (const i of idx) if (i >= 0) c.set(i, (c.get(i) || 0) + 1);
    return [...c.keys()].sort((p, q) => c.get(q) - c.get(p) || p - q).slice(0, n);
  }

  root.BeadCore = { lab, dist, hexRgb, rgbHex, median, downscale, clearBackground, match, cleanup, sample, layout, place, topColours };
  if (typeof module !== "undefined") module.exports = root.BeadCore;
})(typeof window !== "undefined" ? window : globalThis);
