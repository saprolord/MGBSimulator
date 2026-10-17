# Architecture: how the pieces fit

## The idea in one picture

```
 SHIP (what you build)                    LOADOUT (who is flying it)
 normal preset  |  custom ship            captain + level  |  skills  |  perks
        \                                         |
         \                                        v
          \                              effects  [{ stat, op, value }, ...]
           \                                      |
            \                  resolveRules()  <--+--  the ship's fire rate
             \                          |
              v                         v
          grid (rows x cols)     { baseDamage, fireRate, tuning }
                      \              /
                       v            v
                    Simulation (worker)  ->  { ev, min, max, distribution, chartDistribution }
```

* A **ship** produces a grid of tiles (any rows x cols). Normal ships come from text maps
  (`js/ships.js`); the custom ship will produce the same kind of grid.
* The **loadout** (captain, skills, perks) never touches the grid. It only changes numbers, so it
  works identically for every ship mode.
* The **engine** gets the grid plus `{ baseDamage, fireRate, tuning }` and knows nothing about
  captains, skills or perks.

## The one rule that makes it extensible: `tuning.js`

Every number that defines how a block behaves (x2 chance, Charge rates, ...) lives in
`js/tuning.js` and is read by the blocks as `sim.tuning.<key>`. A skill or perk changes the game by
listing an **effect** on one of those keys (or on `baseDamage` / `fireRate`):

```js
{ stat: 'x2Chance', op: 'add', value: 0.05 }     // +5 percentage points
{ stat: 'fireRate', op: 'mul', value: 1.1 }      // +10 % fire rate
{ stat: 'chargeStoreRate', op: 'set', value: 0.3 }
```

Several effects on one stat combine as `((set ?? start) + all adds) x all muls`, so the order never
matters (`js/loadout/effects.js`).

## Recipes

| I want to...                         | Edit                                                                         |
|--------------------------------------|------------------------------------------------------------------------------|
| add a captain or skill               | `js/loadout/captains.js`                                                     |
| add / move a perk, change its links  | `js/loadout/perks.js` (hex coordinates + `requires`)                         |
| change the number of perk points     | `MAX_PERK_POINTS` in `js/loadout/perks.js`                                   |
| change +damage per captain level     | `DAMAGE_PER_CAPTAIN_LEVEL` in `js/loadout/captains.js`                       |
| let a perk change a new block number | add the number to `js/tuning.js`, read it as `sim.tuning.myKey` in the block |
| mark a perk/skill as no-effect       | `visualOnly: true` (and no `effects`)                                        |

`node --test` validates all of this data (typos in stat names, perks linked to ids that do not
exist, perks that can never be unlocked, duplicate ids / hexes) and names the mistake.

## Where things live

```
js/tuning.js            rule numbers read by the blocks
js/loadout/             effects, captains, perks, perk-tree rules, loadout + saving   (no DOM)
js/ui/tabs.js           tab switching        js/ui/skills-view.js   skills tab
js/ui/perks-view.js     SVG hex map          index.html             one panel per tab
```

The loadout is saved in the browser (`localStorage`, key `mgb-loadout-v1`) and cleaned up on load, so
removing a perk from the data never breaks a saved loadout.

## Roadmap: the custom ship (not built yet)

Already done underneath: the engine, path preview, board drawing and share codes handle any
rows x cols grid, so a 13 x 12 board (12 x 12 plus the generator row) needs no engine change.

Still to build:

1. **Data** `js/custom/blocks.js`: the 3x3 custom blocks as ASCII patterns, same legend as ships:
   ```js
   { id: 'corridor', name: 'Corridor', pattern: ['#.#', '#.#', '#.#'] }   // # wall  . empty  E ejector
   ```
2. **Model** `js/custom/custom-ship.js`: a 12 x 12 grid that starts full of walls, "stamp a block
   onto it", and the single generator outside the board (position/facing as data). It outputs a
   normal grid, so `traceGrid` and the simulation run unchanged.
3. **UI**: fill the `Custom Ship` tab (`#panel-custom`): a palette of custom blocks plus the board.
   `BoardView` can already draw it; the normal-ship palette/board panel can be reused or cloned.
4. **Share link**: a custom ship needs its own code (which block at which slot, plus normal item
   placements), e.g. `#custom=<code>`.
5. In `main.js`, `runCalculation()` should simulate whichever grid belongs to the active ship tab.
   Today it always uses the normal-ship grid.

Perks and skills need nothing: they already apply to whatever grid is simulated.

## Roadmap: smaller items

* Put captain / skills / perks into share links (so a shared build includes who flies it).
* Show a note when the chart hides a thin tail.
