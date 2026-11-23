// Match from a photo: set bead colours from a photo of the real beads, corrected by the white paper.
const photo = $("photo"), pctx = photo.getContext("2d", { willReadFrequently: true });
let photoPx = null, gains = null, whiteMode = false;
$("photopick").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  const im = new Image();
  im.onload = () => {
    const s = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    photo.width = Math.round(im.naturalWidth * s); photo.height = Math.round(im.naturalHeight * s);
    pctx.drawImage(im, 0, 0, photo.width, photo.height);
    photoPx = pctx.getImageData(0, 0, photo.width, photo.height).data; gains = null; photo.hidden = false;
  };
  im.src = URL.createObjectURL(f);
});
$("whitebtn").addEventListener("click", () => { whiteMode = !whiteMode; $("whitebtn").setAttribute("aria-pressed", whiteMode); });
photo.addEventListener("click", e => {
  if (!photoPx) return;
  const r = photo.getBoundingClientRect(), x = Math.round((e.clientX - r.left) * photo.width / r.width), y = Math.round((e.clientY - r.top) * photo.height / r.height);
  const rad = Math.max(4, Math.round(photo.width / 200));
  if (whiteMode) {
    const w = C.sample(photoPx, photo.width, photo.height, x, y, rad * 2, null);
    gains = w.map(v => 245 / Math.max(1, v)); whiteMode = false; $("whitebtn").setAttribute("aria-pressed", "false");
    show(w.map((v, i) => v * gains[i]), "Light corrected from the paper. Now select a row and click its pile."); return;
  }
  const hex = C.rgbHex(C.sample(photoPx, photo.width, photo.height, x, y, rad, gains));
  const target = palById(selectedRow);
  if (target) { target.hex = hex; renderPal(); soon(); show(C.hexRgb(hex), `${target.code} ${target.name} set to ${hex}.`); }
  else {
    const l = C.lab(...C.hexRgb(hex)); let best = null, d = Infinity;
    state.pal.forEach(p => { const e2 = C.dist(l, C.lab(...C.hexRgb(p.hex))); if (e2 < d) { d = e2; best = p; } });
    addColour(hex, "From photo");
    show(C.hexRgb(hex), `Added ${hex}. Nearest existing colour: ${best ? best.code + " " + best.name : "none"}. Give it its code.`);
  }
});
function show(rgb, text) { $("sampled").hidden = false; $("sampledsw").style.background = C.rgbHex(rgb); $("sampledtxt").textContent = text; }
