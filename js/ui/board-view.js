/**
 * BOARD VIEW
 * ==========
 * Draws the ship grid, the red projectile paths and the selection highlight on the canvas, and
 * converts mouse positions to tiles. Knows nothing about the simulation or the palette.
 *
 * Drawing is requested, not performed immediately: any number of requestDraw() calls within one
 * frame (e.g. 50 images finishing loading) result in a single redraw.
 */

import { TILE, TILE_SIZE } from '../config.js';
import { hasBlock } from '../model/grid.js';

const HALF = TILE_SIZE / 2;
const COLORS = {
  gridLine: '#333333',
  path: '#FF0000',
  selection: '#007acc',
  fallbackGenerator: '#1e3a1e',
  fallbackEjector: '#3a1e1e',
  fallbackTile: '#222222',
  fallbackDamageBlock: '#8e24aa',
  fallbackBlock: '#005f9e',
  cleanGrey: '#555'
};

export class BoardView {
  #frame = 0;

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object[][]} grid  live grid (read at draw time)
   * @param {import('./assets.js').SpriteCache} sprites
   */
  constructor(canvas, grid, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.grid = grid;
    this.sprites = sprites;

    /** @type {{ r: number, c: number } | null} */
    this.selected = null;
    /** @type {{ r: number, c: number }[][]} projectile paths to draw */
    this.paths = [];
  }

  requestDraw() {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.draw();
    });
  }

  /** Tile under a mouse event, or null if outside the grid. */
  tileAt(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * this.canvas.width) / rect.width;
    const y = ((event.clientY - rect.top) * this.canvas.height) / rect.height;
    const c = Math.floor(x / TILE_SIZE);
    const r = Math.floor(y / TILE_SIZE);
    return r >= 0 && r < this.grid.length && c >= 0 && c < this.grid[0].length ? { r, c } : null;
  }

  draw() {
    const { ctx, canvas, grid } = this;
    const rows = grid.length;
    const cols = grid[0].length;
    this.#fitCanvas(rows, cols);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Layer 1: tile backgrounds and grid lines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.#drawTileBase(grid[r][c], c * TILE_SIZE, r * TILE_SIZE);
      }
    }

    // Layer 2: projectile paths (under the blocks, so blocks stay readable)
    this.#drawPaths();

    // Layer 3: modifier blocks, then the selection frame
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = grid[r][c];
        if (hasBlock(tile)) this.#drawBlock(tile, c * TILE_SIZE, r * TILE_SIZE);
      }
    }
    if (this.selected) {
      const { ctx } = this;
      ctx.strokeStyle = COLORS.selection;
      ctx.lineWidth = 3;
      ctx.strokeRect(this.selected.c * TILE_SIZE + 2, this.selected.r * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }
  }

  /** Size the canvas to the grid (12x12 -> 600x600; a 13-row ship gets a taller canvas). */
  #fitCanvas(rows, cols) {
    const { canvas } = this;
    if (canvas.width === cols * TILE_SIZE && canvas.height === rows * TILE_SIZE) return;
    canvas.width = cols * TILE_SIZE;
    canvas.height = rows * TILE_SIZE;
    canvas.style.aspectRatio = `${cols} / ${rows}`;
  }

  #drawTileBase(tile, x, y) {
    const { ctx } = this;
    const sprite = this.sprites.get(tile.type);
    if (sprite && tile.type === TILE.GENERATOR && tile.rotation) {
      // The generator sprite points the way it fires.
      ctx.save();
      ctx.translate(x + HALF, y + HALF);
      ctx.rotate((tile.rotation * Math.PI) / 180);
      ctx.drawImage(sprite, -HALF, -HALF, TILE_SIZE, TILE_SIZE);
      ctx.restore();
    } else if (sprite) {
      ctx.drawImage(sprite, x, y, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle =
        tile.type === TILE.GENERATOR ? COLORS.fallbackGenerator
        : tile.type === TILE.EJECTOR ? COLORS.fallbackEjector
        : COLORS.fallbackTile;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
  }

  #drawBlock(tile, x, y) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x + HALF, y + HALF);
    ctx.rotate((tile.rotation * Math.PI) / 180);

    const sprite = this.sprites.get(tile.block);
    if (sprite) {
      ctx.fillStyle=COLORS.cleanGrey;
      ctx.fillRect(-HALF, -HALF, TILE_SIZE, TILE_SIZE);
      ctx.drawImage(sprite, -HALF, -HALF, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle = tile.block.includes('Damage') ? COLORS.fallbackDamageBlock : COLORS.fallbackBlock;
      ctx.fillRect(-20, -20, 40, 40);
    }
    ctx.restore();
  }

  #drawPaths() {
    const { ctx, grid } = this;
    ctx.strokeStyle = COLORS.path;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath(); // one path, one stroke call for all projectiles

    for (const path of this.paths) {
      if (path.length < 2) continue;
      ctx.moveTo(path[0].c * TILE_SIZE + HALF, path[0].r * TILE_SIZE + HALF);

      for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const cell = path[i];
        let x = cell.c * TILE_SIZE + HALF;
        let y = cell.r * TILE_SIZE + HALF;

        // A path that ends ON a wall or a block stops at that tile's near edge, not its centre.
        if (i === path.length - 1) {
          const tile = grid[cell.r][cell.c];
          if (tile.type === TILE.SOLID || hasBlock(tile)) {
            x -= (cell.c - prev.c) * HALF;
            y -= (cell.r - prev.r) * HALF;
          }
        }
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}
