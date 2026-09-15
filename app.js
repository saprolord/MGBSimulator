// --- APP STATE & GRID CONFIG ---
const GRID_SIZE = 12;
const TILE_SIZE = 50; // 50px per tile -> 600px canvas

// Grid Matrix: Stores tile objects { type, block, rotation }
let shipGrid = Array(GRID_SIZE).fill(null).map(() => 
  Array(GRID_SIZE).fill(null).map(() => ({ type: 'SPACE', block: null, rotation: 0 }))
);

// Selected Tile Tracking for UI Controls
let selectedTile = { x: -1, y: -1 };

// Set up Default Ship Layout (Emitter & Ejector)
shipGrid[1][5] = { type: 'EMITTER', block: null, rotation: 90 };  // Points East
shipGrid[10][5] = { type: 'EJECTOR', block: null, rotation: 0 };

// DOM Elements
const canvas = document.getElementById('ship-canvas');
const ctx = canvas.getContext('2d');
const selectedInfo = document.getElementById('selected-info');
const btnRotate = document.getElementById('btn-rotate');
const btnDelete = document.getElementById('btn-delete');
const btnClear = document.getElementById('btn-clear');

// --- CANVAS RENDERING ENGINE ---
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const tile = shipGrid[r][c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      // Base Tile Backgrounds
      if (tile.type === 'WALL') {
        ctx.fillStyle = '#111111';
      } else if (tile.type === 'EMITTER') {
        ctx.fillStyle = '#1e3a1e';
      } else if (tile.type === 'EJECTOR') {
        ctx.fillStyle = '#3a1e1e';
      } else {
        ctx.fillStyle = '#222222';
      }
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      // Grid Lines
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

      // Draw Emitter / Ejector Markers
      if (tile.type === 'EMITTER') {
        ctx.fillStyle = '#4caf50';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('START', x + 25, y + 28);
      } else if (tile.type === 'EJECTOR') {
        ctx.fillStyle = '#f44336';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EXIT', x + 25, y + 28);
      }

      // Draw Placed Block
      if (tile.block) {
        drawBlock(x, y, tile.block, tile.rotation);
      }

      // Selection Highlight
      if (selectedTile.x === c && selectedTile.y === r) {
        ctx.strokeStyle = '#007acc';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      }
    }
  }
}

function drawBlock(x, y, blockName, rotation) {
  ctx.save();
  ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
  ctx.rotate((rotation * Math.PI) / 180);

  // Block Background
  ctx.fillStyle = '#005f9e';
  ctx.fillRect(-20, -20, 40, 40);

  // Block Direction Indicator (Arrow)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(10, 8);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// --- INTERACTION & EVENT LISTENERS ---
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left) / TILE_SIZE);
  const r = Math.floor((e.clientY - rect.top) / TILE_SIZE);

  if (c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE) {
    selectedTile = { x: c, y: r };
    const tile = shipGrid[r][c];

    // Simple placement test: Click empty tile to place a default block
    if (tile.type === 'SPACE' && !tile.block) {
      tile.block = 'Turn Right';
    }

    updateUI();
    drawGrid();
  }
});

// Context Menu (Right Click) -> Rotate
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left) / TILE_SIZE);
  const r = Math.floor((e.clientY - rect.top) / TILE_SIZE);

  if (c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE) {
    rotateTile(r, c);
  }
});

// Action Bar Button Handlers
btnRotate.addEventListener('click', () => {
  if (selectedTile.x !== -1) rotateTile(selectedTile.y, selectedTile.x);
});

btnDelete.addEventListener('click', () => {
  if (selectedTile.x !== -1) {
    const tile = shipGrid[selectedTile.y][selectedTile.x];
    if (tile.type === 'SPACE') {
      tile.block = null;
      tile.rotation = 0;
      updateUI();
      drawGrid();
    }
  }
});

btnClear.addEventListener('click', () => {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (shipGrid[r][c].type === 'SPACE') {
        shipGrid[r][c].block = null;
        shipGrid[r][c].rotation = 0;
      }
    }
  }
  updateUI();
  drawGrid();
});

function rotateTile(r, c) {
  const tile = shipGrid[r][c];
  if (tile.block) {
    tile.rotation = (tile.rotation + 90) % 360;
    drawGrid();
  }
}

function updateUI() {
  if (selectedTile.x === -1) {
    selectedInfo.textContent = 'Tile: None selected';
  } else {
    const tile = shipGrid[selectedTile.y][selectedTile.x];
    selectedInfo.textContent = `Tile (${selectedTile.x}, ${selectedTile.y}): ${tile.block || tile.type}`;
  }
}

// Initial Render
drawGrid();
