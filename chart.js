// Drawing a view of the boards: beads, empty pegs, the 8-peg grid, board edges and numbers.
// The screen and the downloaded picture both use drawChart.
function drawChart(ctx, o) {
  const { v, cell, margin: M, col } = o;
  ctx.fillStyle = col.board; ctx.fillRect(M, M, cell * v.nx, cell * v.ny);
  for (let y = 0; y < v.ny; y++) for (let x = 0; x < v.nx; x++) {
    const X = v.x + x, Y = v.y + y, k = o.at(X, Y), cx = M + (x + 0.5) * cell, cy = M + (y + 0.5) * cell;
    if (!k || (o.only && k !== o.only)) { ctx.fillStyle = col.peg; ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.6, cell * 0.09), 0, 7); ctx.fill(); continue; }
    const faded = o.faded(X, Y, k) || (o.out && o.out(X, Y));
    ctx.globalAlpha = faded ? 0.22 : 1;
    ctx.fillStyle = o.hex(k); ctx.beginPath(); ctx.arc(cx, cy, cell * 0.46, 0, 7); ctx.fill();
    if (cell >= 4 && !faded) { ctx.strokeStyle = col.ring; ctx.lineWidth = Math.max(0.75, cell * 0.06); ctx.stroke(); }   // black and white beads stay visible on either board
    if (cell >= 7) { ctx.fillStyle = col.board; ctx.beginPath(); ctx.arc(cx, cy, cell * 0.15, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  const b = o.box;   // the picked box in Select mode
  if (b) { ctx.strokeStyle = col.guide; ctx.lineWidth = 2; ctx.strokeRect(M + b.x0 * cell, M + b.y0 * cell, (b.x1 - b.x0 + 1) * cell, (b.y1 - b.y0 + 1) * cell); }
  const g = o.guide;
  if (g && g.X >= v.x && g.X < v.x + v.nx && g.Y >= v.y && g.Y < v.y + v.ny) {   // the row and column guide
    const gx = M + (g.X - v.x) * cell, gy = M + (g.Y - v.y) * cell;
    ctx.fillStyle = col.guide; ctx.globalAlpha = 0.16;
    ctx.fillRect(M, gy, v.nx * cell, cell); ctx.fillRect(gx, M, cell, v.ny * cell);
    ctx.globalAlpha = 1; ctx.strokeStyle = col.guide; ctx.lineWidth = 2; ctx.strokeRect(gx, gy, cell, cell);
  }
  ctx.font = `500 ${Math.min(11, Math.max(7, cell * 0.9))}px ${o.font}`;
  ctx.fillStyle = col.muted; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const step = cell < 6 ? 16 : 8;
  const lines = (n, along) => {
    for (let i = 0; i <= n; i++) {
      const p = M + i * cell, edge = o.multi && i % o.B === 0 && i > 0 && i < n, major = i % 8 === 0;
      if (!edge && !major) continue;
      ctx.strokeStyle = edge ? "#d23c3c" : col.muted; ctx.globalAlpha = edge ? 0.9 : 0.45; ctx.lineWidth = edge ? 2 : 1;
      ctx.beginPath();
      if (along) { ctx.moveTo(p, M); ctx.lineTo(p, M + v.ny * cell); } else { ctx.moveTo(M, p); ctx.lineTo(M + v.nx * cell, p); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (let i = 0; i < n; i += (n <= 48 ? 4 : step)) {
      const label = o.multi ? (i % o.B) + 1 : i + 1;
      if (along) ctx.fillText(label, M + (i + 0.5) * cell, M / 2); else ctx.fillText(label, M / 2, M + (i + 0.5) * cell);
    }
  };
  lines(v.nx, true); lines(v.ny, false);
}

// A picture to keep or print: the view in light colours, a title, and the colour list with counts.
function chartImage(o) {
  const PRINT = { board: "#f1eef4", peg: "#c9c3d3", ring: "#8a8396", muted: "#5a5466", guide: "#7b3fa6" };
  const cell = Math.max(8, Math.min(22, Math.floor(2400 / Math.max(o.v.nx, o.v.ny)))), M = 30, top = 44;
  const chartW = M + cell * o.v.nx, colW = 230, cols = Math.max(1, Math.floor((chartW - 16) / colW)), rowH = 28;
  const legendH = 40 + Math.ceil(o.beads.length / cols) * rowH;
  const cv = document.createElement("canvas");
  cv.width = chartW + 16; cv.height = top + M + cell * o.v.ny + legendH;
  const x = cv.getContext("2d");
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, cv.width, cv.height);
  x.fillStyle = "#1d1a24"; x.font = `700 18px ${o.font}`; x.textBaseline = "middle"; x.fillText(o.title, 16, 22);
  x.save(); x.translate(0, top);
  drawChart(x, { ...o, cell, margin: M, col: PRINT, guide: null, only: 0 });
  x.restore();
  let y = top + M + cell * o.v.ny + 24;
  x.font = `600 13px ${o.font}`; x.fillStyle = "#5a5466"; x.textAlign = "left";
  x.fillText(`${o.beads.reduce((s, b) => s + b.count, 0)} beads`, 16, y); y += 22;
  o.beads.forEach((b, i) => {
    const bx = 16 + (i % cols) * colW, by = y + Math.floor(i / cols) * rowH;
    x.fillStyle = b.hex; x.beginPath(); x.arc(bx + 9, by, 9, 0, 7); x.fill();
    x.strokeStyle = PRINT.ring; x.lineWidth = 1; x.stroke();
    x.fillStyle = "#1d1a24"; x.font = `600 13px ${o.font}`; x.fillText(b.code, bx + 26, by);
    x.font = `400 13px ${o.font}`; x.fillText(`${b.name} · ${b.count}`, bx + 80, by);
  });
  return cv;
}
