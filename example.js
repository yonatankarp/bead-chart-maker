// The example picture: a donut drawn here, so the site ships no picture files.
function exampleImage() {
  const c = document.createElement("canvas"); c.width = c.height = 360;
  const x = c.getContext("2d"), cx = 180, cy = 186;
  const blob = (rx, ry, wob, n) => { x.beginPath();
    for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 2, k = 1 + wob * Math.sin(a * n);
      x.lineTo(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k); } x.closePath(); };
  const ell = (rx, ry, dy = 0) => { x.beginPath(); x.ellipse(cx, cy + dy, rx, ry, 0, 0, Math.PI * 2); };
  x.fillStyle = "#2a1c16"; ell(158, 126, 6); x.fill();                              // outline
  let g = x.createRadialGradient(cx - 40, cy - 50, 20, cx, cy, 160);
  g.addColorStop(0, "#c98a52"); g.addColorStop(0.7, "#a8642f"); g.addColorStop(1, "#6e4024");
  x.fillStyle = g; ell(150, 118, 4); x.fill();                                      // dough
  x.fillStyle = "#2a1c16"; blob(134, 102, 0.06, 9); x.fill();
  g = x.createLinearGradient(0, 70, 0, 300); g.addColorStop(0, "#f27ab8"); g.addColorStop(1, "#d23688");
  x.fillStyle = g; blob(128, 96, 0.06, 9); x.fill();                                // icing
  x.fillStyle = "#ffffff"; x.beginPath(); x.ellipse(cx - 62, cy - 52, 26, 9, -0.45, 0, Math.PI * 2); x.fill();
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cols = ["#ffffff", "#78c8d2", "#6e1e3c", "#ffffff", "#78c8d2"];
  x.lineCap = "round"; x.lineWidth = 9;
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, r = 0.45 + rnd() * 0.45, px = cx + Math.cos(a) * 112 * r, py = cy + Math.sin(a) * 84 * r, t = rnd() * Math.PI;
    x.strokeStyle = cols[i % cols.length]; x.beginPath(); x.moveTo(px - Math.cos(t) * 9, py - Math.sin(t) * 9); x.lineTo(px + Math.cos(t) * 9, py + Math.sin(t) * 9); x.stroke();
  }
  x.fillStyle = "#2a1c16"; ell(50, 36); x.fill();                                   // hole rim
  x.fillStyle = "#8a5230"; ell(44, 30, 4); x.fill();
  x.globalCompositeOperation = "destination-out"; ell(38, 24, -2); x.fill();
  return c.toDataURL("image/png");
}
