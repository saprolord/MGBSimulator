// --- APP STATE & GRID CONFIG ---
const GRID_SIZE = 12;
const TILE_SIZE = 50;

let shipGrid = Array(GRID_SIZE).fill(null).map(() => 
  Array(GRID_SIZE).fill(null).map(() => ({ type: 'SPACE', block: null, rotation: 0 }))
);

let selectedTile = { x: -1, y: -1 };
let selectedPaletteBlock = null;
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

// --- IMAGE ASSET CONFIGURATION ---
// Update these file paths to match your assets folder structure
const BLOCK_IMAGES = {
  'EMITTER':        'images/Projectile_generator.webp',
  'EJECTOR':        'images/Ejection_block.webp',
  'WALL':           'images/Solid_block.webp',
  'SPACE':          'images/Empty_slot.webp',
  'Turn Right':     'images/Right_turn.webp',
  'Turn Left':      'images/Left_turn.webp',
  'Dual Splitter':  'images/Split_sides.webp',
  '+1 Damage':      'images/More_damage.webp',
  '+1 Projectile':  'images/Clone_bullet.webp',
  '33% x2 Damage':  'images/Double_damage.webp'
};

// Preload Images
const loadedImages = {};
Object.entries(BLOCK_IMAGES).forEach(([key, src]) => {
  const img = new Image();
  img.src = src;
  img.onload = () => drawGrid(); // Redraw canvas once images load
  loadedImages[key] = img;
});

// --- PALETTE UI ---
function buildPaletteUI() {
  paletteContainer.innerHTML = '';
  ITEM_PALETTE.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'palette-btn' + (item === selectedPaletteBlock ? ' active' : '');
    btn.title = item; // Tooltip on hover
    
    // Add image element inside button
    if (BLOCK_IMAGES[item]) {
      const img = document.createElement('img');
      img.src = BLOCK_IMAGES[item];
      img.alt = item;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      btn.appendChild(img);
    } else {
      btn.textContent = item;
    }

    btn.addEventListener('click', () => {
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

      // 1. Draw Base Tile Background (SPACE, EMITTER, EJECTOR, WALL)
      const baseImg = loadedImages[tile.type];
      if (baseImg && baseImg.complete) {
        ctx.drawImage(baseImg, x, y, TILE_SIZE, TILE_SIZE);
      } else {
        // Fallback color while loading
        ctx.fillStyle = tile.type === 'EMITTER' ? '#1e3a1e' : 
                        tile.type === 'EJECTOR' ? '#3a1e1e' : '#222222';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }

      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

      // 2. Draw Modifier Block
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

  if (currentCalculation && currentCalculation.traces) {
    drawPathTraces(currentCalculation.traces);
  }
}

function drawBlock(x, y, blockName, rotation) {
  ctx.save();
  ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
  ctx.rotate((rotation * Math.PI) / 180);

  const img = loadedImages[blockName];
  if (img && img.complete) {
    // Draw rotated image inside tile
    ctx.drawImage(img, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
  } else {
    // Fallback block render
    ctx.fillStyle = blockName.includes('Damage') ? '#8e24aa' : '#005f9e';
    ctx.fillRect(-20, -20, 40, 40);
  }

  ctx.restore();
}

function drawPathTraces(traces) {
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  traces.forEach(trace => {
    if (trace.length < 2) return;
    
    ctx.beginPath();
    let startX = trace[0].c * TILE_SIZE + 25;
    let startY = trace[0].r * TILE_SIZE + 25;
    ctx.moveTo(startX, startY);

    for (let i = 1; i < trace.length; i++) {
      let prevCell = trace[i - 1];
      let currCell = trace[i];
      let isLast = (i === trace.length - 1);

      let targetX = currCell.c * TILE_SIZE + 25;
      let targetY = currCell.r * TILE_SIZE + 25;

      if (isLast) {
        const targetTile = shipGrid[currCell.r][currCell.c];
        if (targetTile.type === 'WALL' || (targetTile.type === 'SPACE' && targetTile.block)) {
          let dc = currCell.c - prevCell.c;
          let dr = currCell.r - prevCell.r;

          targetX = currCell.c * TILE_SIZE + 25 - (dc * 25);
          targetY = currCell.r * TILE_SIZE + 25 - (dr * 25);
        }
      }

      ctx.lineTo(targetX, targetY);
    }
    ctx.stroke();
  });
}

// --- HELPER: FIND TRAJECTORY DIRECTION AT CELL ---
function getIncomingDirectionAt(targetR, targetC) {
  if (!currentCalculation || !currentCalculation.traces) return null;

  for (let trace of currentCalculation.traces) {
    for (let i = 0; i < trace.length; i++) {
      if (trace[i].r === targetR && trace[i].c === targetC) {
        // If it's not the start node, derive direction from previous node
        if (i > 0) {
          let prev = trace[i - 1];
          let dr = targetR - prev.r;
          let dc = targetC - prev.c;

          if (dr === -1 && dc === 0) return 0;   // Moving North
          if (dr === 0  && dc === 1) return 90;  // Moving East
          if (dr === 1  && dc === 0) return 180; // Moving South
          if (dr === 0  && dc === -1) return 270;// Moving West
        }
      }
    }
  }
  return null;
}

// --- INTERACTION LISTENERS ---
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left) / TILE_SIZE);
  const r = Math.floor((e.clientY - rect.top) / TILE_SIZE);

  if (c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE) {
    selectedTile = { x: c, y: r };
    const tile = shipGrid[r][c];

    if (tile.type === 'SPACE' && selectedPaletteBlock) {
      tile.block = selectedPaletteBlock;

      // Auto-align rotation to incoming trajectory if placed along an active line
      const incomingDir = getIncomingDirectionAt(r, c);
      if (incomingDir !== null) {
        tile.rotation = incomingDir;
      }
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
    const evElem = document.getElementById('kpi-ev');
    const rangeElem = document.getElementById('kpi-range');

    if (evElem) evElem.textContent = `${currentCalculation.ev} `;
    if (rangeElem) rangeElem.textContent = `${currentCalculation.min} / ${currentCalculation.max} `;
  }
}

function updateChart(calcResult) {
  const chartCanvas = document.getElementById('chart-canvas');
  if (!chartCanvas || !calcResult.dist) return;

  // Chart labels explicitly styled as DPS values
  const labels = Object.keys(calcResult.dist).map(d => `${d} `);
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
        x: { title: { display: true, text: 'Damage Output (DPS)' } },
        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Chance (%)' } }
      }
    }
  });
}

// Initial Launch
buildPaletteUI();
runCalculation();
