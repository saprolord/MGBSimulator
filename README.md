# MGB Damage Simulator

Monte-Carlo damage simulator for Miner Gun Builder. Plain HTML/CSS/JS,
AI was used for heavily for refactor, optimisation and some function upgrade. 

## Running it

Host the folder on any static host (GitHub Pages, Netlify, ...). To run locally, serve it over
HTTP, because browsers block ES modules and Web Workers on `file://`:

```
python3 -m http.server 8000      # then open http://localhost:8000
```

Keep your existing `Images/` folder next to `index.html`.

Tests (Node 18+, no dependencies): `node --test`

## Layout

```
index.html
css/style.css          design tokens at the top, one section per screen area
js/
  main.js              controller: "when the user does X, do Y"
  config.js            every constant and safety limit
  blocks.js            ★ THE BLOCK REGISTRY - add / tweak blocks here
  ships.js             ★ THE SHIP PRESETS - one text map per ship
  headings.js          direction helpers (quarter-turn headings)
  model/               plain data, no DOM
    grid.js            grid creation / clearing
    share-code.js      #ship=...&build=... link format
    ship-loader.js     validates ship maps and turns them into grids
  engine/              maths, no DOM (also runs inside the Web Worker)
    ship.js            grid -> flat typed arrays
    trace.js           path preview (red lines)
    trial.js           the hot loop: one trial of the simulation
    simulation.js      many trials -> { ev, min, max, distribution }
    histogram.js       chart bars / range grouping
    runner.js          time-sliced driver (progress + yielding)
    worker.js          Web Worker entry point
    index.js           the engine's public API
  ui/                  DOM only
    assets.js          sprite loading
    board-view.js      canvas drawing + hit testing
    palette.js         block picker
    ship-picker.js     ship dropdown
    sim-panel.js       inputs, log slider, progress bar
    results-view.js    KPI cards + Chart.js histogram
    sim-client.js      Worker wrapper with main-thread fallback
    toast.js
tests/engine.test.mjs   engine, blocks, share codes
tests/ships.test.mjs   ship maps and links (checks every preset on each run)
```

Rule of thumb: `engine/` and `model/` never touch the DOM; `ui/` never does maths.

## Adding a block

Open `js/blocks.js`, add **one entry** (see the header comment there for the full anatomy), drop
the image in `Images/`. The palette, canvas, share links, path preview and simulation all pick it up.

```js
define({
  name: 'Add 5 Damage', shareId: 0x30, image: 'Add_5_damage.webp',   // next unused shareId!
  effect: addDamage(5),     // what happens to the damage (simulation only)
  route: forward,           // where the projectile goes (preview AND simulation)
}),
```

Never change or reuse an existing `shareId`: it would break links people already shared.
To make a visual-only block real later, replace its `visualOnly(...)` line with a `define({...})`
using the same name and `shareId`.

## Adding a ship

Open `js/ships.js` and add an entry with a text map. Maps can be up to 12x12; smaller ones are
centred and padded with walls.

```js
{
  id: 'my-ship',          // permanent: stored in share links. lowercase, digits, - and _
  name: 'My Ship',        // dropdown label, free to rename
  map: [
    '#######',            // #  wall      .  empty slot      E  ejector
    '#..E..#',            // ^ > v <  the generator, facing up / right / down / left
    '#.....#',            // exactly one generator, at least one ejector
    '#..^..#',
    '#######',
  ],
},
```

`node --test` validates every ship and names the broken one. A broken map is skipped in the
dropdown (and logged to the console) instead of breaking the app.

Share links: `#ship=<id>&build=<code>`. Links without `ship=` (all the old ones) load the default
ship. Switching ship in the UI keeps blocks that still land on empty slots and drops the rest.

## Design notes worth knowing

- **Projectiles are processed one tile per turn, in FIFO order.** Stateful blocks (Charge, Damage
  Comeback, Combine 10, Damage Cross) depend on arrival order, so this ordering is part of the maths.
- **Charge / Comeback / Combine 10 memory carries over between trials** (deliberate, as before).
  Consequence: trials are *not* independent, so the work cannot simply be split across several
  workers without changing the statistics.
- The preview and the simulation share each block's `route()`, so they cannot disagree.
- Tunable game numbers (x2 chance, Charge rates, ...) are named constants at the top of `blocks.js`.
