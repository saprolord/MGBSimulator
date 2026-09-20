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

// Default ship base damage
let baseDamage = 1;
let baseFireRate = 1;

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
const btnRotateCW = document.getElementById('btn-rotate-cw');
const btnRotateCCW = document.getElementById('btn-rotate-ccw');
const btnDelete = document.getElementById('btn-delete');
const btnClear = document.getElementById('btn-clear');
const btnCalc = document.getElementById('btn-calc');
const paletteContainer = document.getElementById('palette-items');

// --- IMAGE ASSET CONFIGURATION ---
const BLOCK_IMAGES = {
  'EMITTER':        'Images/Projectile_generator.webp',
  'EJECTOR':        'Images/Ejection_block.webp',
  'WALL':           'Images/Solid_block.webp',
  'SPACE':          'Images/Empty_slot.webp',
  'Turn Right':     'Images/Right_turn.webp',
  'Turn Left':      'Images/Left_turn.webp',
  'Dual Splitter':  'Images/Split_sides.webp',
  '+1 Damage':      'Images/More_damage.webp',
  '+1 Projectile':  'Images/Clone_bullet.webp',
  '33% x2 Damage':  'Images/Double_damage.webp'
};

// Preload Images
const loadedImages = {};
Object.entries(BLOCK_IMAGES).forEach(([key, src]) => {
  const img = new Image();
  img.src = src;
  img.onload = () => drawGrid();
  loadedImages[key] = img;
});

// --- PALETTE UI ---
function buildPaletteUI() {
  paletteContainer.innerHTML = '';
  ITEM_PALETTE.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'palette-btn' + (item === selectedPaletteBlock ? ' active' : '');
    btn.title = item;
    
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
        deselectPaletteBlock();
      } else {
        selectedPaletteBlock = item;
      }
      updatePaletteHighlight();
    });
    
    paletteContainer.appendChild(btn);
  });
}

function deselectPaletteBlock() {
  selectedPaletteBlock = null;
  updatePaletteHighlight();
}

function updatePaletteHighlight() {
  document.querySelectorAll('.palette-btn').forEach(b => {
    if (b.title === selectedPaletteBlock) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

// --- RENDER GRID & PATH OVERLAY ---
function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // LAYER 1: Base Tile Backgrounds & Grid Lines
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const tile = shipGrid[r][c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      const baseImg = loadedImages[tile.type];
      if (baseImg && baseImg.complete) {
        ctx.drawImage(baseImg, x, y, TILE_SIZE, TILE_SIZE);
      } else {
        ctx.fillStyle = tile.type === 'EMITTER' ? '#1e3a1e' : 
                        tile.type === 'EJECTOR' ? '#3a1e1e' : '#222222';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }

      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
    }
  }

  // LAYER 2: Trajectory Lines
  if (currentCalculation && currentCalculation.traces) {
    drawPathTraces(currentCalculation.traces);
  }

  // LAYER 3: Modifier Blocks & Selection Highlights
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const tile = shipGrid[r][c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

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
}

function drawBlock(x, y, blockName, rotation) {
  ctx.save();
  ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
  ctx.rotate((rotation * Math.PI) / 180);

  const img = loadedImages[blockName];
  if (img && img.complete) {
    ctx.drawImage(img, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
  } else {
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

function getIncomingDirectionAt(targetR, targetC) {
  if (!currentCalculation || !currentCalculation.traces) return null;

  for (let trace of currentCalculation.traces) {
    for (let i = 0; i < trace.length; i++) {
      if (trace[i].r === targetR && trace[i].c === targetC) {
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

// --- INTERACTION ACTIONS ---
function deleteSelectedTile() {
  if (selectedTile.x !== -1) {
    const tile = shipGrid[selectedTile.y][selectedTile.x];
    if (tile.type === 'SPACE' && tile.block) {
      tile.block = null;
      tile.rotation = 0;
      updateUI();
      runCalculation();
    }
  }
}

function rotateTile(r, c, direction = 'cw') {
  const tile = shipGrid[r][c];
  if (tile.block) {
    const step = direction === 'ccw' ? -90 : 90;
    tile.rotation = (tile.rotation + step + 360) % 360;
    runCalculation();
  }
}

// --- LISTENERS ---
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top) * scaleY;

  const c = Math.floor(canvasX / TILE_SIZE);
  const r = Math.floor(canvasY / TILE_SIZE);

  if (c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE) {
    selectedTile = { x: c, y: r };
    const tile = shipGrid[r][c];

    if (tile.type === 'SPACE' && selectedPaletteBlock) {
      tile.block = selectedPaletteBlock;

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
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top) * scaleY;

  const c = Math.floor(canvasX / TILE_SIZE);
  const r = Math.floor(canvasY / TILE_SIZE);

  if (c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE) {
    rotateTile(r, c, 'cw');
  }
});

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelectedTile();
  } else if (e.key === 'Escape') {
    if (selectedPaletteBlock !== null) {
      deselectPaletteBlock();
    } else {
      selectedTile = { x: -1, y: -1 };
      updateUI();
      drawGrid();
    }
  }
});

btnRotateCW.addEventListener('click', () => {
  if (selectedTile.x !== -1) rotateTile(selectedTile.y, selectedTile.x, 'cw');
});

btnRotateCCW.addEventListener('click', () => {
  if (selectedTile.x !== -1) rotateTile(selectedTile.y, selectedTile.x, 'ccw');
});

btnDelete.addEventListener('click', deleteSelectedTile);

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

// --- CALCULATION & CHART UI ---
function runCalculation() {
  currentCalculation = calculateShip(shipGrid, GRID_SIZE, baseDamage, baseFireRate);
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

  const labels = Object.keys(calcResult.dist).map(d => `${d} DPS`);
  const probabilities = Object.values(calcResult.dist).map(p => p * 100);

  // 1. Calculate peak probability and round UP to the nearest 10%
  const maxProb = Math.max(...probabilities, 0);
  const yMax = Math.min(100, Math.ceil(maxProb / 10) * 10 || 10); // Minimum scale of 10%

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Probability (%)',
        data: probabilities.map(p => p.toFixed(1)),
        backgroundColor: '#007acc',
        borderColor: '#0094f0',
        borderWidth: 1,
        maxBarThickness: 30 // Fix 1: Caps bar width so single/few bars don't stretch
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, // Hiding redundant legend frees up vertical chart space
        tooltip: {
          callbacks: {
            label: (ctx) => `Chance: ${ctx.parsed.y}%`
          }
        }
      },
      scales: {
        x: { 
          title: { display: true, text: 'Damage Output', color: '#888888', font: { size: 11 } },
          ticks: { color: '#cccccc' },
          grid: { display: false }
        },
        y: { 
          beginAtZero: true, 
          max: yMax, // Fix 2: Dynamic ceiling rounded to nearest 10%
          title: { display: true, text: 'Chance (%)', color: '#888888', font: { size: 11 } },
          ticks: { 
            color: '#cccccc',
            stepSize: yMax <= 20 ? 2 : (yMax <= 50 ? 5 : 10), // Smart tick steps based on scale
            callback: (val) => `${val}%`
          },
          grid: { color: '#333333' }
        }
      }
    }
  });
}

// Initial Launch
buildPaletteUI();
runCalculation();