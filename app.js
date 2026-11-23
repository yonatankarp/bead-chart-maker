// The page: settings, turning the picture into a chart, the chart on screen, filters, hand edits, progress and the bead list.
const C = window.BeadCore, RANGES = window.BEAD_RANGES;
const STARTING = ["C01", "C02", "C88", "C134", "C34", "C155", "C69", "C27", "C96", "C75", "C32", "C08", "C132", "C145", "C68"];
const fromRange = (r, codes) => RANGES[r].colours.filter(c => !codes || codes.includes(c[0])).map(([code, name, hex]) => ({ code, name, hex }));
const DEFAULT_PAL = fromRange("artkal_c", STARTING).map((p, i) => ({ id: i + 1, ...p, on: true }));
const MAX_BOARDS = 8;
const state = { across: 1, down: 1, board: 48, zoom: 1, panX: 0, panY: 0, clearbg: false, tol: 12, smooth: 0, tidy: true, maxc: 0,
                view: "all", colour: null, mode: "look", range: "artkal_c", source: "mine", pal: DEFAULT_PAL,
                edits: {},   // "x,y" on the boards -> {code, name, hex} painted, or null erased
                done: {} };  // board index -> colour keys marked done there
try { Object.assign(state, JSON.parse(localStorage.getItem("bead-maker") || "{}")); } catch (e) {}
const save = () => { try { localStorage.setItem("bead-maker", JSON.stringify(state)); } catch (e) {} };
const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
if (!RANGES[state.range]) state.range = "artkal_c";
if (!["look", "select", "paint", "erase"].includes(state.mode)) state.mode = "look";
const painting = () => state.mode === "paint" || state.mode === "erase";
const palById = id => state.pal.find(p => p.id === id);
const keyOf = p => p.code + p.hex, bead = k => res.pal[k - 1];
const sel = () => state.colour && res ? res.pal.findIndex(p => keyOf(p) === state.colour) + 1 : 0;
let img = null, res = null, selectedRow = null, guide = null, stroke = null;
let pick = null, anchor = null;   // Select mode: the picked box {x0, y0, x1, y1} on the boards (with cells when it's a colour group), and where a drag began
const undo = [];
const narrow = matchMedia("(max-width: 700px)");

// ---------- picture -> chart ----------
function convert() {
  if (!img) return;
  const L = C.layout(img.naturalWidth, img.naturalHeight, state.across, state.down, state.board, state.zoom, state.panX, state.panY);
  const { gw, gh } = L;
  const W = Math.min(img.naturalWidth, gw * 4), H = Math.max(1, Math.round(W * img.naturalHeight / img.naturalWidth));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.imageSmoothingEnabled = W < img.naturalWidth; cx.imageSmoothingQuality = "high";
  cx.drawImage(img, 0, 0, W, H);
  let px = cx.getImageData(0, 0, W, H).data;
  if (state.smooth && W > gw) px = C.median(px, W, H, state.smooth);
  const cells = C.downscale(px, W, H, gw, gh);
  if (state.clearbg) C.clearBackground(cells, state.tol);
  let pal = state.source === "range" ? fromRange(state.range) : state.pal.filter(p => p.on);
  let idx = C.match(cells, pal);
  if (state.maxc && pal.length > state.maxc) { pal = C.topColours(idx, state.maxc).map(i => pal[i]); idx = C.match(cells, pal); }
  if (state.tidy && !cells.nearest) idx = C.cleanup(idx, gw, gh, 2);
  res = { ...L, B: state.board, bw: state.across, bh: state.down, pal: pal.map(({ code, name, hex }) => ({ code, name, hex })), base: C.place(idx, L) };
  applyEdits(); pick = null;
  if (state.view !== "all" && +state.view >= res.bw * res.bh) state.view = "all";
}
// Hand edits sit on top of the converted chart, peg by peg; a painted colour joins the chart's colours if it isn't one yet.
function applyEdits() {
  const g = Int16Array.from(res.base);
  for (const [pos, b] of Object.entries(state.edits)) {
    const [x, y] = pos.split(",").map(Number);
    if (x >= res.nx || y >= res.ny) continue;
    let k = 0;
    if (b) { k = res.pal.findIndex(p => keyOf(p) === keyOf(b)) + 1; if (!k) { res.pal.push({ code: b.code, name: b.name, hex: b.hex }); k = res.pal.length; } }
    g[y * res.nx + x] = k;
  }
  res.grid = g;
  if (state.colour && !sel()) state.colour = null;
}
const at = (X, Y) => X < 0 || Y < 0 || X >= res.nx || Y >= res.ny ? 0 : res.grid[Y * res.nx + X];
function view() {
  if (state.view === "all") return { x: 0, y: 0, nx: res.nx, ny: res.ny, name: "All boards" };
  const i = +state.view, bx = i % res.bw, by = (i / res.bw) | 0;
  return { x: bx * res.B, y: by * res.B, nx: res.B, ny: res.B, name: `Board ${i + 1}` };
}
const inPick = (P, X, Y) => P.cells ? P.cells.has(Y * res.nx + X) : X >= P.x0 && X <= P.x1 && Y >= P.y0 && Y <= P.y1;
function counts(v, P) {
  const c = {};
  if (P) v = { x: P.x0, y: P.y0, nx: P.x1 - P.x0 + 1, ny: P.y1 - P.y0 + 1 };
  for (let y = v.y; y < v.y + v.ny; y++) for (let x = v.x; x < v.x + v.nx; x++) { const k = at(x, y); if (k && (!P || inPick(P, x, y))) c[k] = (c[k] || 0) + 1; }
  return c;
}
const picked = () => state.mode === "select" ? pick : null;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const sizeOf = P => `${plural(P.y1 - P.y0 + 1, "row")} × ${plural(P.x1 - P.x0 + 1, "column")}`;
const boardOf = (X, Y) => ((Y / res.B) | 0) * res.bw + ((X / res.B) | 0);
const boardsIn = () => state.view === "all" ? Array.from({ length: res.bw * res.bh }, (_, i) => i) : [+state.view];
const isDone = (X, Y, k) => (state.done[boardOf(X, Y)] || []).includes(keyOf(bead(k)));
const doneHere = k => boardsIn().every(b => (state.done[b] || []).includes(keyOf(bead(k))));

// ---------- chart on screen ----------
const canvas = $("chart"), ctx = canvas.getContext("2d");
const MARGIN = 26;
let cell = 10;
function draw() {
  if (!res) return;
  const v = view(), P = picked(), dpr = window.devicePixelRatio || 1, w = canvas.clientWidth || 600;
  cell = (w - MARGIN) / v.nx;
  const H = MARGIN + cell * v.ny;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(H * dpr); canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = css("--panel"); ctx.fillRect(0, 0, w, H);
  drawChart(ctx, { ...chartBits(v), cell, margin: MARGIN, only: painting() ? 0 : sel(), guide: state.mode === "look" ? guide : null,
    box: P && { x0: P.x0 - v.x, y0: P.y0 - v.y, x1: P.x1 - v.x, y1: P.y1 - v.y }, out: P && ((X, Y) => !inPick(P, X, Y)),
    col: { board: css("--board"), peg: css("--peg"), ring: css("--ring"), muted: css("--muted"), guide: css("--accent") } });
}
const chartBits = v => ({ v, at, hex: k => bead(k).hex, faded: isDone, multi: state.view === "all" && res.bw * res.bh > 1, B: res.B, font: css("--mono") || "monospace" });

// ---------- rails ----------
const tolWord = t => t <= 8 ? "strict" : t <= 20 ? "medium" : "loose";
function renderSettings() {
  $("acrossv").textContent = state.across; $("downv").textContent = state.down; $("bsize").value = state.board;
  $("across-").disabled = state.across <= 1; $("down-").disabled = state.down <= 1;
  $("across+").disabled = state.across >= MAX_BOARDS; $("down+").disabled = state.down >= MAX_BOARDS;
  $("zoom").value = Math.round(state.zoom * 100); $("zoomv").textContent = Math.round(state.zoom * 100) + "%";
  $("panx").value = Math.round(state.panX * 100); $("pany").value = Math.round(state.panY * 100);
  $("clearbg").checked = state.clearbg; $("tol").value = state.tol; $("tolv").textContent = tolWord(state.tol);
  $("smooth").value = state.smooth; $("smoothv").textContent = ["off", "light", "medium", "strong"][state.smooth]; $("tidy").checked = state.tidy;
  $("maxc").value = state.maxc; $("maxcv").textContent = state.maxc || "any";
  if (!res) return;
  const n = res.bw * res.bh, s = n > 1 ? "s" : "", over = res.gw > res.nx || res.gh > res.ny;
  $("setsum").textContent = `${n} board${s} · ${res.gw} × ${res.gh}`;
  $("sizeinfo").textContent = `${n} board${s}, ${res.nx} × ${res.ny} pegs. The picture is ${res.gw} × ${res.gh}${over ? ", cut off at the edges" : ""}.`;
}
function renderFilter() {
  if (!res) return;
  const v = view(), P = picked(), c = counts(v, P), n = res.bw * res.bh, paint = painting();
  $("boardsec").hidden = n === 1;
  $("boards").style.gridTemplateColumns = `repeat(${res.bw}, 1fr)`;
  $("boards").innerHTML = (n > 1 ? `<button type="button" data-view="all" style="grid-column:1/-1" aria-pressed="${state.view === "all"}">All boards</button>` : "")
    + Array.from({ length: n }, (_, i) => `<button type="button" data-view="${i}" aria-pressed="${state.view === String(i) || (n === 1)}">${i + 1}</button>`).join("");
  const only = sel();   // the picked colour stays in the list even where there's none of it, so it can be unpicked
  const ids = (paint ? res.pal.map((_, i) => i + 1) : [...new Set([...Object.keys(c).map(Number), ...(only ? [only] : [])])]).sort((p, q) => (c[q] || 0) - (c[p] || 0));
  $("colours").innerHTML = ids.map(k => { const p = bead(k), d = !paint && doneHere(k);
    return `<button type="button" data-colour="${k}" aria-pressed="${k === only}" class="${d ? "done" : ""}" title="${esc(p.code)} ${esc(p.name)}${d ? " (done)" : ""}">`
      + `<span class="sw" style="background:${p.hex}"></span><span class="code">${d ? "✓ " : ""}${esc(p.code)}</span><span class="nm">${esc(p.name)}</span><span class="count">${c[k] || 0}</span></button>`; }).join("")
    || `<p class="hint">No beads here.</p>`;
  const total = Object.values(c).reduce((s, x) => s + x, 0), where = P ? (P.cells ? "in the group" : "in the box") : "on " + v.name.toLowerCase();
  $("totalLabel").textContent = paint ? (only ? `Painting with ${bead(only).code}` : "Pick a colour to paint with") : only ? `${bead(only).code} ${where}` : `All beads ${where}`;
  $("total").textContent = only ? (c[only] || 0) : total;
  if (P) $("status").textContent = `${P.cells ? bead(res.grid[P.cells.values().next().value]).code + " group · " : ""}${sizeOf(P)} · ${plural(total, "bead")}`
    + (only && !P.cells ? ` · ${c[only] || 0} ${bead(only).code}` : "");   // under the chart, so a phone shows it too
  const db = $("donebtn");
  db.hidden = paint || !only;
  if (only) db.textContent = doneHere(only) ? `Not done yet: ${bead(only).code}` : `Mark ${bead(only).code} done on ${n === 1 ? "this board" : state.view === "all" ? "every board" : v.name.toLowerCase()}`;
}
function renderTools() {
  document.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === state.mode));
  canvas.classList.toggle("painting", state.mode !== "look");
  $("undo").disabled = !undo.length;
  const n = Object.keys(state.edits).length;
  $("clearedits").hidden = !n; $("clearedits").textContent = `Clear ${n} hand edit${n > 1 ? "s" : ""}`;
}
function renderPal() {
  const labs = state.pal.map(p => C.lab(...C.hexRgb(p.hex)));
  $("pal").innerHTML = state.pal.map((p, i) => {
    let near = "";
    state.pal.forEach((q, j) => { if (j !== i && p.on && q.on && C.dist(labs[i], labs[j]) < 6) near = `close to ${esc(q.code)}`; });
    return `<div class="p" data-id="${p.id}" aria-current="${p.id === selectedRow}">
      <input type="checkbox" id="on-${p.id}" data-f="on" ${p.on ? "checked" : ""} aria-label="Use ${esc(p.code)}">
      <input type="color" id="hex-${p.id}" data-f="hex" value="${p.hex}" aria-label="Colour of ${esc(p.code)}">
      <input type="text" id="code-${p.id}" data-f="code" value="${esc(p.code)}" aria-label="Code">
      <input type="text" id="name-${p.id}" data-f="name" value="${esc(p.name)}" aria-label="Name">
      <span class="near">${near}</span>
      <button type="button" class="x" data-del="${p.id}" aria-label="Remove ${esc(p.code)}">×</button></div>`;
  }).join("");
  renderCat();
}
function renderCat() {
  const q = $("find").value.trim().toLowerCase(), mine = new Set(state.pal.map(p => p.code));
  const list = fromRange(state.range).filter(c => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  $("cat").innerHTML = list.map(c => `<button type="button" data-code="${esc(c.code)}" aria-pressed="${mine.has(c.code)}" title="${esc(c.code)} ${esc(c.name)}">`
    + `<span class="sw" style="background:${c.hex}"></span>${esc(c.code)}</button>`).join("") || `<p class="hint">No colour matches.</p>`;
}
function renderRange() {
  $("range").innerHTML = Object.entries(RANGES).map(([k, r]) => `<option value="${k}" ${k === state.range ? "selected" : ""}>${esc(r.name)}</option>`).join("");
  $("src-" + state.source).checked = true;
  renderCat();
}
function render(again = true) { if (again) convert(); renderSettings(); renderFilter(); renderTools(); draw(); }

// ---------- settings ----------
let pending = 0;
const soon = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { save(); render(); }); };
const num = (el, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+el.value || lo)));
for (const k of ["across", "down"]) for (const d of [-1, 1])
  $(k + (d < 0 ? "-" : "+")).addEventListener("click", () => { state[k] = Math.max(1, Math.min(MAX_BOARDS, state[k] + d)); state.view = "all"; soon(); });
$("bsize").addEventListener("change", e => { state.board = num(e.target, 8, 120); state.view = "all"; soon(); });
$("zoom").addEventListener("input", e => { state.zoom = +e.target.value / 100; soon(); });
$("panx").addEventListener("input", e => { state.panX = +e.target.value / 100; soon(); });
$("pany").addEventListener("input", e => { state.panY = +e.target.value / 100; soon(); });
$("centre").addEventListener("click", () => { state.zoom = 1; state.panX = state.panY = 0; soon(); });
$("clearbg").addEventListener("change", e => { state.clearbg = e.target.checked; soon(); });
$("tol").addEventListener("input", e => { state.tol = +e.target.value; soon(); });
$("smooth").addEventListener("input", e => { state.smooth = +e.target.value; soon(); });
$("tidy").addEventListener("change", e => { state.tidy = e.target.checked; soon(); });
$("maxc").addEventListener("input", e => { state.maxc = +e.target.value; soon(); });
$("boards").addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (b) { state.view = b.dataset.view; guide = pick = null; save(); render(false); } });
$("colours").addEventListener("click", e => { const b = e.target.closest("[data-colour]"); if (!b) return;
  const k = +b.dataset.colour; state.colour = sel() === k && !painting() ? null : keyOf(bead(k)); save(); render(false); });
for (const s of ["mine", "range"]) $("src-" + s).addEventListener("change", () => { state.source = s; soon(); });
$("donebtn").addEventListener("click", () => {
  const k = sel(); if (!k) return;
  const key = keyOf(bead(k)), on = !doneHere(k);
  for (const b of boardsIn()) { const l = new Set(state.done[b] || []); on ? l.add(key) : l.delete(key); state.done[b] = [...l]; }
  save(); render(false);
});

// ---------- tapping, painting and undo ----------
function pegAt(e) {
  const r = canvas.getBoundingClientRect(), v = view();
  const x = Math.floor((e.clientX - r.left - MARGIN) / cell), y = Math.floor((e.clientY - r.top - MARGIN) / cell);
  return x < 0 || y < 0 || x >= v.nx || y >= v.ny ? null : { x, y, X: v.x + x, Y: v.y + y, v };
}
function point(p) {
  if (!p) { $("status").textContent = state.mode === "look" ? "Tap a peg to see where it is and light up its row and column."
    : state.mode === "select" ? "Drag a box to measure it, or tap a bead to pick its colour's beads joined to it." : "Drag across pegs to " + state.mode + "."; return; }
  const k = at(p.X, p.Y), B = res.B;
  const where = state.view === "all" && res.bw * res.bh > 1
    ? `Board ${boardOf(p.X, p.Y) + 1} · row ${(p.Y % B) + 1}, column ${(p.X % B) + 1}`
    : `${p.v.name} · row ${p.y + 1}, column ${p.x + 1}`;
  $("status").textContent = where + " · " + (k ? `${bead(k).code} ${bead(k).name}` : "empty peg");
}
function paintAt(p) {
  const brush = state.mode === "erase" ? null : sel() ? { ...bead(sel()) } : undefined;
  if (brush === undefined) { $("status").textContent = "Pick a colour from the list to paint with."; return; }
  const pos = p.X + "," + p.Y, baseK = res.base[p.Y * res.nx + p.X], baseB = baseK ? res.pal[baseK - 1] : null;
  if (!(pos in stroke)) stroke[pos] = pos in state.edits ? state.edits[pos] : undefined;
  if (brush ? baseB && keyOf(baseB) === keyOf(brush) : !baseB) delete state.edits[pos];   // back to what the picture gave
  else state.edits[pos] = brush;
  applyEdits(); point(p); draw();
}
function undoLast() {
  const s = undo.pop(); if (!s) return;
  for (const [pos, prev] of Object.entries(s)) { if (prev === undefined) delete state.edits[pos]; else state.edits[pos] = prev; }
  applyEdits(); save(); render(false);
}
canvas.addEventListener("pointerdown", e => {
  if (!res) return;
  const p = pegAt(e);
  if (state.mode === "select") {
    if (!p) return;
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    anchor = { X: p.X, Y: p.Y, moved: false, was: pick }; return;
  }
  if (state.mode === "look") {
    guide = p && !(guide && guide.X === p.X && guide.Y === p.Y) ? { X: p.X, Y: p.Y } : null;
    point(p); draw(); return;
  }
  if (!p) return;
  e.preventDefault(); canvas.setPointerCapture(e.pointerId); stroke = {}; paintAt(p);
});
canvas.addEventListener("pointermove", e => {
  if (!res) return;
  if (anchor) {   // past the chart's edge the box stops at the edge
    const v = view(), r = canvas.getBoundingClientRect(), lim = (n, lo, len) => Math.max(lo, Math.min(lo + len - 1, lo + Math.floor((n - MARGIN) / cell)));
    const X = lim(e.clientX - r.left, v.x, v.nx), Y = lim(e.clientY - r.top, v.y, v.ny), a = anchor;
    if (!a.moved && X === a.X && Y === a.Y) return;
    a.moved = true;
    pick = { x0: Math.min(a.X, X), y0: Math.min(a.Y, Y), x1: Math.max(a.X, X), y1: Math.max(a.Y, Y) };
    renderFilter(); draw(); return;
  }
  const p = pegAt(e);
  if (stroke) { if (p) paintAt(p); } else if (e.pointerType === "mouse" && !picked()) point(p);   // keep the size on show
});
// A tap without a drag picks the same-colour beads joined to that bead, or clears the pick when it's already in it or the peg is empty.
function tapPick({ X, Y, was }) {
  const v = view();
  pick = !at(X, Y) || (was && was.cells && inPick(was, X, Y)) ? null : C.region(res.grid, res.nx, X, Y, { x0: v.x, y0: v.y, x1: v.x + v.nx - 1, y1: v.y + v.ny - 1 });
}
const endStroke = () => {
  if (anchor) { if (!anchor.moved) tapPick(anchor); anchor = null; if (!pick) point(null); renderFilter(); draw(); }
  if (!stroke) return; if (Object.keys(stroke).length) undo.push(stroke); stroke = null; save(); renderFilter(); renderTools(); };
canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);
document.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => { state.mode = b.dataset.mode; guide = pick = null; point(null); save(); render(false); }));
$("undo").addEventListener("click", undoLast);
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey && !e.target.closest?.("input, textarea, select")) { e.preventDefault(); undoLast(); }
});
$("clearedits").addEventListener("click", () => {
  const n = Object.keys(state.edits).length;
  if (!n || !confirm(`Clear all ${n} hand edits? The chart goes back to what the picture gives.`)) return;
  state.edits = {}; undo.length = 0; applyEdits(); save(); render(false);
});

// ---------- copy and download ----------
function beadsIn(v) { const c = counts(v); return Object.keys(c).map(Number).sort((p, q) => c[q] - c[p]).map(k => ({ ...bead(k), k, count: c[k] })); }
$("copy").addEventListener("click", () => {
  const v = view(), list = beadsIn(v), L = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", key = {};
  list.forEach((b, i) => key[b.k] = L[i] || "#");
  const rows = []; for (let y = v.y; y < v.y + v.ny; y++) { let s = ""; for (let x = v.x; x < v.x + v.nx; x++) { const k = at(x, y); s += k ? key[k] : "."; } rows.push(s); }
  const text = `${v.name}, ${v.nx} × ${v.ny}; . is an empty peg\n` + list.map(b => `${key[b.k]} = ${b.code} ${b.name} (${b.count})`).join("\n") + "\n\n" + rows.join("\n");
  const ta = $("copytext"); ta.value = text;
  const fallback = () => { ta.hidden = false; ta.focus(); ta.select(); $("copy").textContent = "Select all and copy"; };
  try { navigator.clipboard.writeText(text).then(() => { ta.hidden = true; $("copy").textContent = "Copied"; setTimeout(() => $("copy").textContent = "Copy as text", 1500); }, fallback); }
  catch (e) { fallback(); }
});
$("download").addEventListener("click", () => {
  if (!res) return;
  const v = view(), n = res.bw * res.bh;
  const title = state.view === "all" ? (n > 1 ? `All ${n} boards · ${v.nx} × ${v.ny} pegs` : `${v.nx} × ${v.ny} pegs`) : `${v.name} of ${n} · ${v.nx} × ${v.ny} pegs`;
  const cv = chartImage({ ...chartBits(v), title, beads: beadsIn(v), font: "ui-monospace, Menlo, monospace" });
  cv.toBlob(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `bead-chart-${state.view === "all" ? "all-boards" : "board-" + (+state.view + 1)}.png`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
});

// ---------- bead list ----------
$("pal").addEventListener("input", e => {
  const row = e.target.closest(".p"), f = e.target.dataset.f; if (!row || !f) return;
  const p = palById(+row.dataset.id); p[f] = f === "on" ? e.target.checked : e.target.value;
  if (f === "on" || f === "hex") soon(); else { save(); renderFilter(); }
});
$("pal").addEventListener("change", e => { if (e.target.dataset.f === "on" || e.target.dataset.f === "hex") renderPal(); });
$("pal").addEventListener("click", e => {
  const del = e.target.closest("[data-del]");
  if (del) { state.pal = state.pal.filter(p => p.id !== +del.dataset.del); if (selectedRow === +del.dataset.del) selectedRow = null; renderPal(); soon(); return; }
  const row = e.target.closest(".p"); if (!row || e.target.matches("input")) return;
  selectedRow = selectedRow === +row.dataset.id ? null : +row.dataset.id; renderPal();
});
$("pal").addEventListener("focusin", e => { const row = e.target.closest(".p"); if (row && selectedRow !== +row.dataset.id) { selectedRow = +row.dataset.id; row.setAttribute("aria-current", "true");
  $("pal").querySelectorAll(".p").forEach(r => r !== row && r.setAttribute("aria-current", "false")); } });
const nextId = () => Math.max(0, ...state.pal.map(p => p.id)) + 1;
function addColour(hex, name = "New colour") { const p = { id: nextId(), code: "?", name, hex, on: true }; state.pal.push(p); selectedRow = p.id; renderPal(); soon(); return p; }
$("add").addEventListener("click", () => addColour("#888888"));
$("range").addEventListener("change", e => { state.range = e.target.value; renderCat(); soon(); });
$("find").addEventListener("input", renderCat);
$("cat").addEventListener("click", e => {
  const b = e.target.closest("[data-code]"); if (!b) return;
  const code = b.dataset.code, had = state.pal.some(p => p.code === code);
  if (had) state.pal = state.pal.filter(p => p.code !== code);
  else state.pal.push({ id: nextId(), ...fromRange(state.range, [code])[0], on: true });
  renderPal(); soon();
});
$("reset").addEventListener("click", () => { state.pal = DEFAULT_PAL.map(p => ({ ...p })); selectedRow = null; renderPal(); soon(); });

// ---------- loading pictures ----------
// A new picture starts a new project: its hand edits, progress and position start over. A restored one keeps them.
function load(src, name, fresh) {
  const im = new Image();
  im.onload = () => {
    img = im;
    if (fresh) { state.edits = {}; state.done = {}; state.zoom = 1; state.panX = state.panY = 0; undo.length = 0; guide = null; }
    $("picname").textContent = `${name}, ${im.naturalWidth} × ${im.naturalHeight}px.`;
    if (narrow.matches) $("settings").open = false;
    save(); render();
  };
  im.onerror = () => { $("picname").textContent = `Couldn't open ${name}. Try a PNG or JPEG.`; };
  im.src = src;
}
const loadFile = f => { if (f && f.type.startsWith("image/")) { PictureStore.save(f, f.name); load(URL.createObjectURL(f), f.name, true); } };
$("pick").addEventListener("change", e => loadFile(e.target.files[0]));
$("example").addEventListener("click", () => { PictureStore.clear(); load(exampleImage(), "Example donut", true); });
const box = canvas.parentElement;
box.addEventListener("dragover", e => { e.preventDefault(); box.classList.add("drop"); });
box.addEventListener("dragleave", () => box.classList.remove("drop"));
box.addEventListener("drop", e => { e.preventDefault(); box.classList.remove("drop"); loadFile(e.dataTransfer.files[0]); });
document.addEventListener("paste", e => { const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith("image/")); if (f) loadFile(f); });

new ResizeObserver(draw).observe(canvas);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
// On a phone the settings fold away once a picture is in; wider screens always show them.
narrow.addEventListener("change", () => { if (!narrow.matches) $("settings").open = true; });
renderRange(); renderPal(); renderSettings(); renderTools(); point(null);
PictureStore.load().then(r => r && r.blob ? load(URL.createObjectURL(r.blob), r.name, false) : load(exampleImage(), "Example donut", false));
