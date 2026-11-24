# Bead Chart Maker

<https://yonatankarp.github.io/bead-chart-maker/>

A static browser tool that turns a picture into a pegboard chart for fuse beads (Artkal, Hama, Perler), in the bead colours you actually own, split across as many boards as it needs.

## Features

- Load a picture by file, drag and drop, or paste. See-through PNG backgrounds stay empty.
- Add or remove boards across and down, and set your board size; the picture fills the boards as far as its shape allows.
- Optional background removal (flood fill from the edges), noise smoothing and stray-bead clean-up
  (lone beads fall off when ironed). Pixel art no bigger than the chart is copied exactly.
- Every Artkal colour, in five ranges (C 2.6 mm Mini, S 5 mm Midi, A, M and R), from the community-measured
  [BeadColors](https://github.com/maxcleme/beadcolors) list (MIT, see `THIRD_PARTY.md`). Chart with every colour in a
  range, or with your own bead list (Edit… beside "My beads"): add colours from the range by search, edit, tick on and off, saved in the browser.
  Colours are matched in Lab space.
- Match from a photo: photograph a pile from each bag on white paper, click the paper to correct the light,
  then click a pile to set a colour from the real beads. Handy for bags that lost their labels.
- Enlarge and move the picture on the boards, zoom into the chart on screen, and cap the number of colours (fewer bags to buy).
- Paint and erase beads by hand, with undo (Ctrl+Z); hand edits stay on their pegs.
- Pick a board and a colour to see only those beads, with counts, and mark a colour done on a board.
  Tap a peg to light up its row and column.
- Download a board, or all of them, as a PNG with its colour list, or copy the chart as text.
- The last picture, hand edits and progress are kept in the browser, so a reload carries on.

Everything runs in the browser; pictures never leave your computer.

## Run

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 5173
```

## Files

`core.js` turns pictures into bead grids (pure functions, tested), `chart.js` draws charts, `app.js` runs the page,
`photo.js` matches colours from a photo, `store.js` keeps the picture, `example.js` draws the example, `palettes.js` holds the colours.

## Test

```bash
node tests/core.test.js
```
