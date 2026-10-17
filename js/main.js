/**
 * APPLICATION ENTRY POINT
 * =======================
 * Wires the model (grid), the views (board, palette, results, simulation panel) and the engine
 * together. All the "when the user does X, do Y" logic lives here; the drawing and the maths live
 * in the modules it imports.
 *
 *   model/   the grid and share links          (plain data, no DOM)
 *   engine/  path tracing + Monte-Carlo maths  (no DOM, runs in a Web Worker)
 *   ui/      canvas, palette, chart, panel     (DOM only)
 */

import { TILE } from './config.js';
import { isDirectionalBlock } from './blocks.js';
import { headingBetween, toDegrees } from './headings.js';
import { DEFAULT_SHIP_ID } from './ships.js';
import { clearBlocks, cloneGrid, hasBlock, removeBlock, collectPlacements, applyPlacements, replaceGrid, canPlaceBlock } from './model/grid.js';
import { AVAILABLE_SHIPS, SHIP_PROBLEMS, createGridForShip, getShipInfo, hasShip } from './model/ship-loader.js';
import { buildHash, parseHash, parseLayout, serializeLayout } from './model/share-code.js';
import { gameCodec, GameCodeError } from './model/game-code.js';
import { CUSTOM_BLOCKS, CUSTOM_SETTINGS } from './custom/custom-blocks.js';
import {
  CUSTOM_PROBLEMS, GRID_COLS, createCustomGrid, createCustomLayout, getCustomBlock, isRotatable,
  parseCustomLayout, serializeCustomLayout, slotIndex, slotOf, stampSlot,
} from './custom/custom-ship.js';
import { changedTuning } from './loadout/effects.js';
import { createPerkTree } from './loadout/perk-tree.js';
import { GAME_DATA, DATA_PROBLEMS } from './loadout/data.js';
import { loadSavedLoadout, resolveRules, saveLoadout } from './loadout/loadout.js';
import { traceGrid } from './engine/index.js';
import { SpriteCache } from './ui/assets.js';
import { BoardView } from './ui/board-view.js';
import { CustomPalette } from './ui/custom-palette.js';
import { CodePanel } from './ui/code-panel.js';
import { Palette } from './ui/palette.js';
import { ResultsView } from './ui/results-view.js';
import { PerksView } from './ui/perks-view.js';
import { ShipPicker } from './ui/ship-picker.js';
import { SkillsView } from './ui/skills-view.js';
import { SimPanel } from './ui/sim-panel.js';
import { SimulationClient } from './ui/sim-client.js';
import { Tabs } from './ui/tabs.js';
import { showToast } from './ui/toast.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------------------------
for (const problem of [...SHIP_PROBLEMS, ...gameCodec.problems, ...DATA_PROBLEMS, ...CUSTOM_PROBLEMS]) console.error(problem); // a broken ship map is skipped, not fatal

const grid = createGridForShip(DEFAULT_SHIP_ID);
let currentShipId = DEFAULT_SHIP_ID;
const sprites = new SpriteCache(() => view.requestDraw());
const view = new BoardView($('ship-canvas'), grid, sprites);
const palette = new Palette($('palette-items'), { onSelect: (name) => name && customPalette.select(null) });
const customPalette = new CustomPalette($('custom-palette'), CUSTOM_BLOCKS, { onSelect: (id) => id && palette.select(null) });
const results = new ResultsView({
  evElement: $('kpi-ev'),
  rangeElement: $('kpi-range'),
  chartCanvas: $('chart-canvas'),
});
const shipPicker = new ShipPicker($('ship-select'), AVAILABLE_SHIPS, (shipId) => changeShip(shipId));
const codePanel = new CodePanel({
  onImport: (text) => importGameCode(text),
  onExport: () => exportGameCode(),
  notify: (message) => toast(message),
});
const simPanel = new SimPanel({ onCalculate: () => runCalculation() });
simPanel.setFireRate(getShipInfo(DEFAULT_SHIP_ID).fireRate);

// ---- Captain / skills / perks (apply to every ship mode) ----
const loadout = loadSavedLoadout();
const perkTree = createPerkTree(GAME_DATA.perks, GAME_DATA.maxPerkPoints);
let activeTab = 'ships';
const tabs = new Tabs({
  onChange: (name) => {
    activeTab = name;
    if (name === 'ships' || name === 'custom') {
      enterMode(name); // the two ship tabs share the board: swap which ship it shows
      view.requestDraw(); // the canvas may have been hidden: redraw it
    }
  },
});
new SkillsView({ container: $('skills-view'), loadout, data: GAME_DATA, onChange: () => onLoadoutChanged() });
new PerksView({
  container: $('perk-map'),
  pointsLabel: $('perk-points'),
  resetButton: $('btn-perks-reset'),
  tree: perkTree,
  perks: GAME_DATA.perks,
  loadout,
  notify: (message) => toast(message),
  onChange: () => onLoadoutChanged(),
});
$('fireRateInput').addEventListener('input', () => refreshEffective());
const simulationClient = new SimulationClient();

// ---- Ship modes: normal ships and the custom ship share one board. `grid` always holds the ship of
//      the mode being shown; the other mode's grid waits in `parkedGrids`.
let mode = 'ships'; // 'ships' | 'custom'
const customLayout = createCustomLayout(); // which custom block sits in each of the 16 slots
const parkedGrids = { ships: null, custom: null };
const boardPanel = $('panel-ships');

const selectedInfo = $('selected-info');
const toast = (message) => showToast($('toast'), message);
let isRunning = false;

// ---------------------------------------------------------------------------------------------
// Keeping the screen in sync with the grid
// ---------------------------------------------------------------------------------------------

/** Call after ANY change to the grid. */
function onLayoutChanged() {
  view.paths = traceGrid(grid);
  syncUrl();
  refreshSelectionInfo();
  view.requestDraw();
}

function refreshSelectionInfo() {
  const sel = view.selected;
  if (!sel) {
    selectedInfo.textContent = 'Tile: None selected';
    return;
  }
  const tile = grid[sel.r][sel.c];
  let text = `Tile (${sel.c}, ${sel.r}): ${tile.block || tile.type}`;
  const slot = mode === 'custom' ? slotOf(sel.r, sel.c) : null;
  if (slot) {
    const placed = customLayout.slots[slotIndex(slot.slotRow, slot.slotCol)];
    text += ` · Slot (${slot.slotCol + 1}, ${slot.slotRow + 1}): ${getCustomBlock(placed.block).name}`;
  }
  selectedInfo.textContent = text;
}

/** Keep the address bar's #ship=...&build=... in sync so the page URL is always shareable. */
function syncUrl() {
  const hash = currentHash();
  window.history.replaceState(null, '', hash || window.location.pathname);
}

/** The shareable hash of whatever the board shows (a normal ship or the custom ship). */
function currentHash() {
  const items = serializeLayout(grid);
  return mode === 'custom' ? buildHash(null, items, serializeCustomLayout(customLayout)) : buildHash(currentShipId, items);
}

/**
 * Switch the board between normal ships and the custom ship (keeps both builds). No-op if already
 * showing `next`. Called by the tabs.
 */
function enterMode(next) {
  if (next === mode) return;
  parkedGrids[mode] = cloneGrid(grid);
  mode = next;
  replaceGrid(grid, parkedGrids[next] ?? (next === 'custom' ? createCustomGrid(customLayout) : createGridForShip(currentShipId)));
  parkedGrids[next] = null;

  boardPanel.classList.toggle('mode-custom', next === 'custom');
  view.selected = null;
  simPanel.setFireRate(next === 'custom' ? CUSTOM_SETTINGS.fireRate : getShipInfo(currentShipId).fireRate);
  refreshEffective();
  onLayoutChanged();
}

/**
 * Show `shipId` on the board with the given blocks on it (blocks that do not fit are skipped).
+ * The one place that swaps ships. Returns how many blocks were placed.
  */
function setShip(shipId, placements = []) {
  if (mode !== 'ships') tabs.show('ships'); // leave the custom ship first (this swaps the grid)
  replaceGrid(grid, createGridForShip(shipId));
  currentShipId = shipId;
  const placed = applyPlacements(grid, placements);
  view.selected = null;
  shipPicker.value = shipId;
  simPanel.setFireRate(getShipInfo(shipId).fireRate);
  refreshEffective();
  onLayoutChanged();
  return placed;
}

/** Dropdown: switch ship, carrying blocks over to tiles that are still empty slots. */
function changeShip(shipId) {
  if (!hasShip(shipId) || shipId === currentShipId) return;
  const carried = collectPlacements(grid);
  const kept = setShip(shipId, carried);
  if (kept < carried.length) toast(`${carried.length - kept} block(s) did not fit the new ship and were removed.`);
}

 // ---------------------------------------------------------------------------------------------
// In-game ship codes
// ---------------------------------------------------------------------------------------------

/** Import a pasted game code: switches to its ship and replaces the build. Returns true on success. */
function importGameCode(text) {
  try {
    const { shipId, placements, unknownItems, badOrientations } = gameCodec.importCode(text);
    const placed = setShip(shipId, placements);

    const notes = [];
    if (placed < placements.length) notes.push(`${placements.length - placed} did not fit`);
    if (unknownItems > 0) notes.push(`${unknownItems} unknown item ID(s) skipped`);
    if (badOrientations > 0) notes.push(`${badOrientations} with a bad orientation skipped`);
    const shipName = AVAILABLE_SHIPS.find((ship) => ship.id === shipId)?.name ?? shipId;
    toast(`Imported "${shipName}" with ${placed} block(s)` + (notes.length ? ` (${notes.join(', ')})` : '.'));

    runCalculation();
    return true;
  } catch (error) {
    if (!(error instanceof GameCodeError)) throw error;
    toast(error.message);
    return false;
  }
}

/** The current build as a game code, or null (after telling the user why) if it cannot be made. */
function exportGameCode() {
  if (mode === 'custom') {
    toast('Game codes are not available for custom ships yet. Use Share Build Link.');
    return null;
  }
  try {
    return gameCodec.exportCode(grid, currentShipId);
  } catch (error) {
    if (!(error instanceof GameCodeError)) throw error;
    toast(error.message);
    return null;
  }
}


// ---------------------------------------------------------------------------------------------
// Editing the grid
// ---------------------------------------------------------------------------------------------

/** The direction a projectile currently travels when it enters tile (r, c), in degrees, or null. */
function incomingRotation(r, c) {
  for (const path of view.paths) {
    for (let i = 1; i < path.length; i++) {
      if (path[i].r !== r || path[i].c !== c) continue;
      const heading = headingBetween(path[i - 1].r, path[i - 1].c, r, c);
      if (heading !== -1) return toDegrees(heading);
    }
  }
  return null;
}

function placeSelectedBlock(r, c) {
  const tile = grid[r][c];
  if (tile.type !== TILE.EMPTY || !palette.selected) return;
  if (tile.block !== palette.selected && !canPlaceBlock(grid, palette.selected)) {
    toast(`Only one "${palette.selected}" is allowed per ship. Delete the existing one first.`);
    return;
  }
  tile.block = palette.selected;
  // Face the way projectiles already travel through this tile (if any do).
  const rotation = incomingRotation(r, c);
  if (rotation !== null) tile.rotation = rotation;
}

/** Delete the item on the selected tile; if there is none (custom ship) empty its slot instead. */
function deleteSelectedBlock() {
  const sel = view.selected;
  if (!sel) return;
  if (hasBlock(grid[sel.r][sel.c])) {
    removeBlock(grid[sel.r][sel.c]);
  } else if (mode === 'custom') {
    const slot = slotOf(sel.r, sel.c);
    if (!slot) return;
    stampSlot(grid, customLayout, slot.slotRow, slot.slotCol, 'solid');
  } else {
    return;
  }
  onLayoutChanged();
}

/** Turn the item on a tile; if there is none (custom ship) turn the custom block of its slot. */
function rotateBlock(r, c, direction) {
  const tile = grid[r][c];
  const step = direction === 'ccw' ? -90 : 90;
  if (hasBlock(tile)) {
    tile.rotation = (tile.rotation + step + 360) % 360;
  } else if (mode === 'custom' && slotOf(r, c)) {
    const { slotRow, slotCol } = slotOf(r, c);
    const placed = customLayout.slots[slotIndex(slotRow, slotCol)];
    if (!isRotatable(getCustomBlock(placed.block))) return;
    stampSlot(grid, customLayout, slotRow, slotCol, placed.block, (placed.rotation + step + 360) % 360);
  } else {
    return;
  }
  onLayoutChanged();
}

/** Custom ship: put the selected custom block into the slot under the tile. */
function stampSelectedCustomBlock(r, c) {
  const slot = slotOf(r, c);
  if (slot) stampSlot(grid, customLayout, slot.slotRow, slot.slotCol, customPalette.selected);
}

function rotateSelected(direction) {
  if (view.selected) rotateBlock(view.selected.r, view.selected.c, direction);
}

// ---------------------------------------------------------------------------------------------
// Canvas and keyboard
// ---------------------------------------------------------------------------------------------
view.canvas.addEventListener('click', (event) => {
  const pos = view.tileAt(event);
  if (!pos) return;
  view.selected = pos;
  if (mode === 'custom' && customPalette.selected) stampSelectedCustomBlock(pos.r, pos.c);
  else placeSelectedBlock(pos.r, pos.c);
  onLayoutChanged();
});

view.canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const pos = view.tileAt(event);
  if (pos) rotateBlock(pos.r, pos.c, 'cw');
});

window.addEventListener('keydown', (event) => {
  // Don't hijack Backspace/Delete while the user is typing in a number box.
  if (event.target instanceof Element && event.target.closest('input, textarea, select')) return;
  if (activeTab !== 'ships' && activeTab !== 'custom') return; // the board is hidden on the other tabs

  if (event.key === 'Delete' || event.key === 'Backspace') {
    deleteSelectedBlock();
  } else if (event.key === 'Escape') {
    if (palette.selected) {
      palette.select(null);
    } else if (customPalette.selected) {
      customPalette.select(null);
    } else {
      view.selected = null;
      refreshSelectionInfo();
      view.requestDraw();
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Toolbar buttons
// ---------------------------------------------------------------------------------------------
$('btn-delete').addEventListener('click', deleteSelectedBlock);
$('btn-rotate-cw').addEventListener('click', () => rotateSelected('cw'));
$('btn-rotate-ccw').addEventListener('click', () => rotateSelected('ccw'));

$('btn-clear-path').addEventListener('click', () => {
  if (!confirm('Are you sure you want to clear all non-directional blocks?')) return;
  clearBlocks(grid, isDirectionalBlock); // keeps turns and splitters
  onLayoutChanged();
});

$('btn-clear').addEventListener('click', () => {
  if (!confirm(mode === 'custom' ? 'Are you sure you want to clear the whole custom ship (custom blocks and items)?' : 'Are you sure you want to clear all blocks?')) return;
  if (mode === 'custom') {
    customLayout.slots = createCustomLayout().slots; // every slot back to solid
    replaceGrid(grid, createCustomGrid(customLayout));
    view.selected = null;
  } else {
    clearBlocks(grid);
  }
  onLayoutChanged();
});

$('btn-share').addEventListener('click', async () => {
  const hash = currentHash();
  if (!hash) {
    toast('Grid has no blocks to share!');
    return;
  }
  const shareUrl = `${window.location.href.split('#')[0]}${hash}`;
  window.history.replaceState(null, '', hash);
  try {
    await navigator.clipboard.writeText(shareUrl);
    toast('Build link copied to clipboard!');
  } catch {
    prompt('Copy this link to share your build:', shareUrl); // clipboard blocked: let them copy by hand
  }
});

// ---------------------------------------------------------------------------------------------
// Rules from captain, skills and perks
// ---------------------------------------------------------------------------------------------

/** The numbers the simulation will use: the ship's fire rate and plain base damage, plus the loadout. */
function currentRules() {
  const { fireRate, baseDamage } = simPanel.readParams();
  return resolveRules(loadout, { fireRate, baseDamage });
}

const shown = (value) => Number(value.toFixed(2));

/** The line under the inputs, so it is always clear what skills and perks are doing. */
function refreshEffective() {
  const rules = currentRules();
  const tweaks = changedTuning(rules.tuning);
  simPanel.showEffective(
    `With captain, skills & perks: base damage ${shown(rules.baseDamage)} · fire rate ${shown(rules.fireRate)}` +
      (tweaks.length ? ` · ${tweaks.length} item rule${tweaks.length > 1 ? 's' : ''} changed` : ''),
    tweaks.map(({ key, from, to }) => `${key}: ${from} -> ${shown(to)}`).join('\n'),
  );
}

function onLoadoutChanged() {
  saveLoadout(loadout);
  refreshEffective();
}

// ---------------------------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------------------------
async function runCalculation() {
  if (isRunning) return;
  isRunning = true;

  const params = simPanel.readParams();
  const rules = currentRules(); // captain level, skills and perks applied on top of the ship
  const simulationParams = { ...params, baseDamage: rules.baseDamage, fireRate: rules.fireRate, tuning: rules.tuning };
  simPanel.start(params.trials);
  try {
    const result = await simulationClient.run(grid, simulationParams, (done, total) => simPanel.setProgress(done, total));
    results.show(result);
  } catch (error) {
    console.error('Simulation failed:', error);
    toast('Simulation failed - see the console for details.');
  } finally {
    isRunning = false;
    simPanel.finish();
  }
}

// ---------------------------------------------------------------------------------------------
// Loading a shared build, then start
// ---------------------------------------------------------------------------------------------
function loadBuildFromUrl() {
  const link = parseHash(window.location.hash);
  if (link && link.custom !== null) return loadCustomShipFromLink(link);
  if (!link || !hasShip(link.shipId)) return false;

  const placements = link.code ? parseLayout(link.code, grid[0].length) : [];
  if (placements === null) return false; // malformed code: leave everything as it is

  setShip(link.shipId, placements);
  runCalculation();
  return true;
}

/** A #custom=...&build=... link: switch to the custom ship tab and rebuild it. */
function loadCustomShipFromLink(link) {
  const layout = parseCustomLayout(link.custom);
  const items = link.code ? parseLayout(link.code, GRID_COLS) : [];
  if (layout === null || items === null) return false; // malformed link: leave everything as it is

  tabs.show('custom');
  customLayout.slots = layout.slots;
  replaceGrid(grid, createCustomGrid(customLayout));
  applyPlacements(grid, items);
  view.selected = null;
  onLayoutChanged();
  runCalculation();
  return true;
}

window.addEventListener('hashchange', loadBuildFromUrl);

refreshEffective();
if (!loadBuildFromUrl()) onLayoutChanged();
