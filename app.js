// --- APP STATE & GRID CONFIG ---
const GRID_SIZE = 12;
const TILE_SIZE = 50;

let shipGrid = Array(GRID_SIZE).fill(null).map(() => 
  Array(GRID_SIZE).fill(null).map(() => ({ type: 'SPACE', block: null, rotation: 0 }))
);

let selectedTile = { x: -1, y: -1 };
let selectedPaletteBlock = null; // Default to no block selected
let currentCalculation = null;
let chartInstance = null;

// Available Items
const ITEM_PALETTE = [
  'Turn Right', 'Turn Left', 'Dual Splitter',
  '+1 Damage', '+1 Projectile', '33% x2 Damage'
];

// Layout Setup
shipGrid[10][5] = { type: 'EMITTER', block: null, rotation: 0 }; 
shipGrid[1][5] = { type: 'EJECTOR', block: null, rotation: 0 };

// DOM Elements
const canvas = document.getElementById('ship-canvas');
const ctx = canvas.getContext('2d');
const selectedInfo = document.getElementById('selected-info');
const btnRotate = document.getElementById('btn-rotate');
const btnDelete = document.getElementById('btn-delete');
const btnClear = document.getElementById('btn-clear');
const btnCalc = document.getElementById('btn-calc');
const paletteContainer = document.getElementById('palette-items');

// --- 1. TOGGLE-ABLE PALETTE SELECTION ---
function buildPaletteUI() {
  paletteContainer.innerHTML = '';
  ITEM_PALETTE.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'palette-btn' + (item === selectedPaletteBlock ? ' active' : '');
    btn.textContent = item;
    
    btn.addEventListener('click', () => {
      // Toggle selection: click again to deselect
      if (selectedPaletteBlock === item) {
        selectedPaletteBlock = null;
      } else {
        selectedPaletteBlock = item;
      }

      document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
      if (selectedPaletteBlock) {
        btn.classList.add('active');
      }
    });
    
    paletteContainer.appendChild(btn);
  });
}

// --- RENDER GRID & PATH OVERLAY ---
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const tile = shipGrid[r][c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      ctx.fillStyle = tile.type === 'EMITTER' ? '#1e3a1e' : 
                      tile.type === 'EJECTOR' ? '#3a1e1e' : '#222222';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

      if (tile.type === 'EMITTER') {
        ctx.fillStyle = '#4caf50';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('START (▲)', x + 25, y + 28);
      } else if (tile.type === 'EJECTOR') {
        ctx.fillStyle = '#f44336';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EXIT', x + 25, y + 28);
      }

      if (tile.block) {
        drawBlock(x, y, tile.block, tile.rotation);
      }

      if (selectedTile.x === c && selectedTile.y === r) {
        ctx.strokeStyle = '#007acc';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      }
    }
  }

  // Draw Trajectory Traces
  if (currentCalculation && currentCalculation.traces) {
    drawPathTraces(currentCalculation.traces);
  }
}

function drawBlock(x, y, blockName, rotation) {
  ctx.save();
  ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
  ctx.rotate((rotation * Math.PI) / 180);

  ctx.fillStyle = blockName.includes('Damage') ? '#8e24aa' : '#005f9e';
  ctx.fillRect(-20, -20, 40, 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(blockName.substring(0, 5), 0, 4);

  // Arrowhead pointing forward (North)
  ctx.fillStyle = '#4fc3f7';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(6, -10);
  ctx.lineTo(-6, -10);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// --- 3. EDGE-STOPPED TRAJECTORY DRAWING ---
function drawPathTraces(traces) {
  ctx.strokeStyle = '#4caf50';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  traces.forEach(trace => {
    if (trace.length < 2) return;
    
    ctx.beginPath();
    // Start at center of initial cell (Emitter)
    let startX = trace[0].c * TILE_SIZE + 25;
    let startY = trace[0].r * TILE_SIZE + 25;
    ctx.moveTo(startX, startY);

    for (let i = 1; i < trace.length; i++) {
      let prevCell = trace[i - 1];
      let currCell = trace[i];
      let isLast = (i === trace.length - 1);

      let targetX = currCell.c * TILE_SIZE + 25;
      let targetY = currCell.r * TILE_SIZE + 25;

      // Check if path terminates/stops on this last node
      if (isLast) {
        const targetTile = shipGrid[currCell.r][currCell.c];
        
        // Stop line at edge of block/wall instead of center if hit invalid face or wall
        if (targetTile.type === 'WALL' || (targetTile.type === 'SPACE' && targetTile.block)) {
          let dc = currCell.c - prevCell.c;
          let dr = currCell.r - prevCell.r;

          // Adjust destination back to the edge boundary of the cell
          targetX = currCell.c * TILE_SIZE + 25 - (dc * 25);
          targetY = currCell.r * TILE_SIZE + 25 - (dr * 25);
        }
      }

      ctx.lineTo(targetX, targetY);
    }
    ctx.stroke();
  });
}

// --- INTERACTION LISTENERS ---
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left) / TILE_SIZE);
  const r = Math.floor((e.clientY - rect.top) / TILE_SIZE);

  if (c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE) {
    selectedTile = { x: c, y: r };
    const tile = shipGrid[r][c];

    // Place active palette block if one is selected
    if (tile.type === 'SPACE' && selectedPaletteBlock) {
      tile.block = selectedPaletteBlock;
    }

    updateUI();
    runCalculation();
  }
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left) / TILE_SIZE);
  const r = Math.floor((e.clientY - rect.top) / TILE_SIZE);

  if (c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE) {
    rotateTile(r, c);
  }
});

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
      runCalculation();
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
  runCalculation();
});

btnCalc.addEventListener('click', runCalculation);

function rotateTile(r, c) {
  const tile = shipGrid[r][c];
  if (tile.block) {
    tile.rotation = (tile.rotation + 90) % 360;
    runCalculation();
  }
}

function runCalculation() {
  currentCalculation = calculateShip(shipGrid, GRID_SIZE);
  drawGrid();
  updateUI();
  updateChart(currentCalculation);
}

function updateUI() {
  if (selectedTile.x === -1) {
    selectedInfo.textContent = 'Tile: None selected';
  } else {
    const tile = shipGrid[selectedTile.y][selectedTile.x];
    selectedInfo.textContent = `Tile (${selectedTile.x}, ${selectedTile.y}): ${tile.block || tile.type}`;
  }

  if (currentCalculation) {
    document.getElementById('kpi-ev').textContent = currentCalculation.ev;
    document.getElementById('kpi-range').textContent = `${currentCalculation.min} / ${currentCalculation.max}`;
  }
}

function updateChart(calcResult) {
  const chartCanvas = document.getElementById('chart-canvas');
  if (!chartCanvas || !calcResult.dist) return;

  const labels = Object.keys(calcResult.dist).map(d => `${d} Dmg`);
  const data = Object.values(calcResult.dist).map(p => (p * 100).toFixed(1));

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Probability (%)',
        data: data,
        backgroundColor: '#007acc'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Chance (%)' } }
      }
    }
  });
}

// Initial Launch
buildPaletteUI();
runCalculation();
