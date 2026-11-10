# HouseDesigner — 2D Home Planner

A browser-based house planner: draw walls, drop doors and windows, paint
floors, and furnish rooms on a 0.5 m grid — all in 2D with an interactive
top-down walk mode.

## Run it

```
node server.js
```

Then open http://localhost:8000 (editor: `index.html`).

No build step, no dependencies to install — plain HTML/CSS/JS.

## Features

- Walls / doors / windows / fences drawn on a cell grid; multiple floors
- 1,000+ furniture items in a searchable catalog, with colour variants
- Wall-mounted items (TVs, cabinets, shelves, sconces, AC units, clocks,
  mirrors, art…) pin to the wall edge and share their cell with floor
  furniture — a dresser can sit under a wall clock
- Tabletop items (laptop, kettle, toaster, vases…) only place on surfaces
- Multi-select: drag a box, then move / copy / rotate / delete as a set
- Fine snap: 0.5 m cells or 0.25 m half-cells (G key or the Snap button)
- Connected furniture pieces act as one; undo/redo; JSON save/backup files
- "Play" mode walks the plan top-down; co-op editing over PeerJS

## Tests

```
node test-smoke.js    # editor logic
node test-render.js   # every catalog sprite variant
node test-floors.js   # floor material painters
```
