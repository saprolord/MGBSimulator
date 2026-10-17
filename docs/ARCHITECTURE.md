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

## The custom ship

A custom ship is a 12 x 12 board that starts full of walls, divided into 4 x 4 **slots** of 3 x 3
tiles. Each slot holds one **custom block** whose pattern (`#` wall, `.` empty, `E` ejector) is
stamped onto the slot. Normal items are then placed on the empty tiles exactly like on any ship.
The generator sits in an extra row below the board (13 rows x 12 columns in total).

```
js/custom/custom-blocks.js   DATA: the custom blocks (patterns, shareIds) and the settings
                             (generator column, fire rate)  <- edit this to add real blocks
js/custom/custom-ship.js     logic: layout (16 slots), stamping, rotation, share code, validation
js/ui/custom-palette.js      the custom block picker (draws each 3x3 pattern)
```

How it plugs in:

* **One board, two modes.** The Normal Ships and Custom Ship tabs share the board panel. `main.js`
  keeps a single `grid` that always holds the ship of the visible mode; the other mode's grid is
  parked in `parkedGrids`, so switching tabs keeps both builds. Parts that belong to one mode only
  carry the classes `ships-only` / `custom-only` (CSS hides them in the other mode).
* **Clicking:** with a custom block selected, a click fills the slot under the tile; with an item
  selected it places the item. Right-click / the rotate buttons turn the item on the tile, or the
  slot's block when the tile has no item. Delete removes the item, or empties the slot.
* **Changing a slot** keeps items on tiles that stay empty and removes items on tiles that become
  walls or ejectors.
* **Share link:** `#custom=<48 hex characters>&build=<items>`. The 48 characters are 16 slots x
  (block shareId 2 digits + rotation 1 digit). Custom block `shareId`s are permanent, like items.
* **Not available for custom ships yet:** game-code import/export (it targets normal ships; importing
  a code switches back to Normal Ships).
* Perks, skills and captain level apply to the custom ship automatically.

To add a custom block: add one line to `CUSTOM_BLOCKS` with the next free `shareId`. `node --test`
validates the patterns and ids. Set `rotatable: false` on blocks that cannot be turned in the game.

Open assumptions (all are data in `custom-blocks.js`): the generator sits below the board in column 5
and fires upward; blocks are rotatable; the custom ship's fire rate is 1.

## Roadmap: smaller items

* Put captain / skills / perks into share links (so a shared build includes who flies it).
* Game-code import/export for custom ships, once the game's format for them is known.
* Show a note when the chart hides a thin tail.
