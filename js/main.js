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
import { AVAILABLE_SHIPS, SHIP_PROBLEMS, createGridForShip, hasShip } from './model/ship-loader.js';
import { buildHash, parseHash, parseLayout, serializeLayout } from './model/share-code.js';
import { traceGrid } from './engine/index.js';
import { SpriteCache } from './ui/assets.js';
import { BoardView } from './ui/board-view.js';
import { Palette } from './ui/palette.js';
import { ResultsView } from './ui/results-view.js';
import { ShipPicker } from './ui/ship-picker.js';
import { SimPanel } from './ui/sim-panel.js';
import { SimulationClient } from './ui/sim-client.js';
import { showToast } from './ui/toast.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------------------------
for (const problem of SHIP_PROBLEMS) console.error(problem); // a broken ship map is skipped, not fatal

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
const simPanel = new SimPanel({ onCalculate: () => runCalculation() });
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
 * Switch to another ship. Blocks are carried over to tiles that are still empty slots on the new
 * ship; the rest are dropped.
 */
function changeShip(shipId) {
  if (!hasShip(shipId) || shipId === currentShipId) return;
  const carried = collectPlacements(grid);
  replaceGrid(grid, createGridForShip(shipId));
  currentShipId = shipId;
  const kept = applyPlacements(grid, carried);

  view.selected = null;
  shipPicker.value = shipId;
  onLayoutChanged();
  if (kept < carried.length) toast(`${carried.length - kept} block(s) did not fit the new ship and were removed.`);
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
// Simulation
// ---------------------------------------------------------------------------------------------
async function runCalculation() {
  if (isRunning) return;
  isRunning = true;

  const params = simPanel.readParams();
  simPanel.start(params.trials);
  try {
    const result = await simulationClient.run(grid, params, (done, total) => simPanel.setProgress(done, total));
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

  const placements = link.code ? parseLayout(link.code, grid.length) : [];
  if (placements === null) return false; // malformed code: leave everything as it is

  replaceGrid(grid, createGridForShip(link.shipId));
  currentShipId = link.shipId;
  applyPlacements(grid, placements);

  view.selected = null;
  shipPicker.value = link.shipId;
  onLayoutChanged();
  runCalculation();
  return true;
}

window.addEventListener('hashchange', loadBuildFromUrl);

if (!loadBuildFromUrl()) onLayoutChanged();
