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
import { clearBlocks, hasBlock, removeBlock, collectPlacements, applyPlacements, replaceGrid, canPlaceBlock } from  './model/grid.js';
import { AVAILABLE_SHIPS, SHIP_PROBLEMS, createGridForShip, getShipInfo, hasShip } from './model/ship-loader.js';
import { buildHash, parseHash, parseLayout, serializeLayout } from './model/share-code.js';
import { gameCodec, GameCodeError } from './model/game-code.js';
import { changedTuning } from './loadout/effects.js';
import { createPerkTree } from './loadout/perk-tree.js';
import { GAME_DATA, DATA_PROBLEMS } from './loadout/data.js';
import { loadSavedLoadout, resolveRules, saveLoadout } from './loadout/loadout.js';
import { traceGrid } from './engine/index.js';
import { SpriteCache } from './ui/assets.js';
import { BoardView } from './ui/board-view.js';
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
for (const problem of [...SHIP_PROBLEMS, ...gameCodec.problems, ...DATA_PROBLEMS]) console.error(problem); // a broken ship map is skipped, not fatal

const grid = createGridForShip(DEFAULT_SHIP_ID);
let currentShipId = DEFAULT_SHIP_ID;
const sprites = new SpriteCache(() => view.requestDraw());
const view = new BoardView($('ship-canvas'), grid, sprites);
const palette = new Palette($('palette-items'));
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
new Tabs({
  onChange: (name) => {
    activeTab = name;
    if (name === 'ships') view.requestDraw(); // the canvas was hidden: redraw it
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
  selectedInfo.textContent = `Tile (${sel.c}, ${sel.r}): ${tile.block || tile.type}`;
}

/** Keep the address bar's #ship=...&build=... in sync so the page URL is always shareable. */
function syncUrl() {
  const hash = buildHash(currentShipId, serializeLayout(grid));
  window.history.replaceState(null, '', hash || window.location.pathname);
}

/**
 * Show `shipId` on the board with the given blocks on it (blocks that do not fit are skipped).
+ * The one place that swaps ships. Returns how many blocks were placed.
  */
function setShip(shipId, placements = []) {
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

function deleteSelectedBlock() {
  const sel = view.selected;
  if (!sel || !hasBlock(grid[sel.r][sel.c])) return;
  removeBlock(grid[sel.r][sel.c]);
  onLayoutChanged();
}

function rotateBlock(r, c, direction) {
  const tile = grid[r][c];
  if (!hasBlock(tile)) return;
  tile.rotation = (tile.rotation + (direction === 'ccw' ? -90 : 90) + 360) % 360;
  onLayoutChanged();
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
  placeSelectedBlock(pos.r, pos.c);
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
  if (activeTab !== 'ships') return; // the board is hidden on the other tabs

  if (event.key === 'Delete' || event.key === 'Backspace') {
    deleteSelectedBlock();
  } else if (event.key === 'Escape') {
    if (palette.selected) {
      palette.select(null);
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
  if (!confirm('Are you sure you want to clear all blocks?')) return;
  clearBlocks(grid);
  onLayoutChanged();
});

$('btn-share').addEventListener('click', async () => {
  const hash = buildHash(currentShipId, serializeLayout(grid));
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
  if (!link || !hasShip(link.shipId)) return false;

  const placements = link.code ? parseLayout(link.code, grid[0].length) : [];
  if (placements === null) return false; // malformed code: leave everything as it is

  setShip(link.shipId, placements);
  runCalculation();
  return true;
}

window.addEventListener('hashchange', loadBuildFromUrl);

refreshEffective();
if (!loadBuildFromUrl()) onLayoutChanged();
