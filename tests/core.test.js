// node tests/core.test.js — checks the picture-to-beads steps on small made-up pictures.
const assert = require("assert");
const C = require("../core.js");
const BW = [{ hex: "#000000" }, { hex: "#ffffff" }];
const img = (w, h, f) => { const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set(f(x, y), (y * w + x) * 4); return px; };

// Pixel art no bigger than the grid is sampled exactly.
const stripes = img(4, 4, x => x % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255]);
assert.strictEqual(C.match(C.downscale(stripes, 4, 4, 4, 4), BW).join(), "0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1");

// Area averaging uses premultiplied alpha: a black square half see-through stays black, not grey.
const half = img(8, 8, x => x < 4 ? [0, 0, 0, 255] : [255, 255, 255, 0]);
const hc = C.downscale(half, 8, 8, 2, 2);
assert.deepStrictEqual(C.match(hc, BW).join(), "0,-1,0,-1");
const quarter = C.downscale(img(2, 2, (x, y) => x + y ? [255, 255, 255, 0] : [0, 0, 0, 255]), 2, 2, 1, 1);
assert.strictEqual(quarter.rgb[0], 0, "no halo from see-through pixels");

// Removing the background clears the light frame and keeps the dark middle.
const framed = img(6, 6, (x, y) => x > 1 && x < 4 && y > 1 && y < 4 ? [0, 0, 0, 255] : [250, 250, 250, 255]);
const fc = C.clearBackground(C.downscale(framed, 6, 6, 6, 6), 10);
assert.strictEqual(C.match(fc, BW).filter(v => v >= 0).length, 4);

// Clean-up drops a lone bead and recolours a speck inside a patch.
const g = Int16Array.from([-1, -1, -1, -1, -1,  -1, 0, 0, 0, -1,  -1, 0, 1, 0, -1,  -1, 0, 0, 0, -1,  -1, -1, -1, -1, 1]);
const cl = C.cleanup(g, 5, 5, 1);
assert.strictEqual(cl[24], -1, "lone bead removed"); assert.strictEqual(cl[12], 0, "speck recoloured");

// Photo sampling takes the median (ignores a speck) and applies white-balance gains.
const flat = img(20, 20, () => [200, 100, 50, 255]); flat[(10 * 20 + 10) * 4] = 0;
assert.deepStrictEqual(C.sample(flat, 20, 20, 10, 10, 3, [1.2, 1, 0.5]), [240, 100, 25]);
assert.strictEqual(C.rgbHex([300, -5, 15.6]), "#ff0010");
console.log("CORE TESTS PASS");
