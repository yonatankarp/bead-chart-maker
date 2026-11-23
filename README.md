# Bead Chart Maker

<https://yonatankarp.github.io/bead-chart-maker/>

A static browser tool that turns a picture into a pegboard chart for fuse beads (Artkal, Hama, Perler), in the bead colours you actually own, split across as many boards as it needs.

## Features

- Load a picture by file, drag and drop, or paste. See-through PNG backgrounds stay empty.
- Add or remove boards across and down, and set your board size; the picture fills the boards as far as its shape allows.
- Optional background removal (flood fill from the edges), noise smoothing and stray-bead clean-up
  (lone beads fall off when ironed). Pixel art no bigger than the chart is copied exactly.
- Colours are matched in Lab space to your own bead list, which you can edit, tick on and off, and save in the browser.
- Match from a photo: photograph a pile from each bag on white paper, click the paper to correct the light,
  then click a pile to set a colour from the real beads. Handy for bags that lost their labels.
- Pick a board and a colour to see only those beads, with counts. Copy the chart as text.

Everything runs in the browser; pictures never leave your computer.

## Run

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 5173
```

## Test

```bash
node tests/core.test.js
```
