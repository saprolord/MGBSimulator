// --- APP STATE & GRID CONFIG ---
const GRID_SIZE = 12;
const TILE_SIZE = 50;

let shipGrid = Array(GRID_SIZE).fill(null).map(() => 
  Array(GRID_SIZE).fill(null).map(() => ({ type: 'Empty Slot', block: null, rotation: 0 }))
);

let selectedTile = { x: -1, y: -1 };
let selectedPaletteBlock = null;
let currentCalculation = null;
let chartInstance = null;

// Directional blocks that should NOT be cleared by "Clear Path"
const DIRECTIONAL_BLOCKS = new Set(['Guide Right', 'Guide Left', '2-Way Split','3-way Split','2-Way Random Split','3-Way Random Split']);

// Available Items
const ITEM_PALETTE = [
  'Guide Right', 'Guide Left', '2-Way Split',
  '3-way Split', 'Add 1 Damage', 'Add Projectile', 'x2 Damage',
  'x10 Damage', 'Random Damage', 'Charge', 'Damage Cross','2-Way Random Split', '3-Way Random Split', 'Tier Damage',
  'Damage Comeback', 'Damage Stockpile', 'Combine 10', 'Guided Damage', 'Add 100 Damage', 'Ejector Damage', 'Clone',
  'Speed Up', 'Slow Down', 'Spread Left', 'Spread Right', 'Large Spread', 'Small Spread', 'Curve Left', 'Curve Right',
  'Random Curve', 'Return Bounce', 'Random Bounce', 'Ricochet', 'Double Lifetime', 'Death Pierce', 'Pierce', 
  'Circle AoE', 'Rectangle AoE', 'Magnet', 'Align Direction', 'Line Magnet', 'Shoot Upward', 'Sideways',
  'Money Cross', 'Evolved Damage', 'Slow Burn', 'Crisscross', 'Sparse Damage'
];

// Layout Setup
shipGrid[10][5] = { type: 'Projectile Generator', block: null, rotation: 0 }; 
shipGrid[1][5] = { type: 'Ejection Block', block: null, rotation: 0 }; 
for (let r = 0; r < GRID_SIZE; r++) {
  shipGrid[r][0] = { type: 'Solid Block', block: null, rotation: 0 };
  shipGrid[r][GRID_SIZE - 1] = { type: 'Solid Block', block: null, rotation: 0 };
  shipGrid[r][GRID_SIZE - 2] = { type: 'Solid Block', block: null, rotation: 0 };
}
for (let c = 0; c < GRID_SIZE; c++) {
  shipGrid[0][c] = { type: 'Solid Block', block: null, rotation: 0 };
  shipGrid[GRID_SIZE - 1][c] = { type: 'Solid Block', block: null, rotation: 0 };
}

// DOM Elements
const canvas = document.getElementById('ship-canvas');
const ctx = canvas.getContext('2d');
const selectedInfo = document.getElementById('selected-info');
const btnRotateCW = document.getElementById('btn-rotate-cw');
const btnRotateCCW = document.getElementById('btn-rotate-ccw');
const btnDelete = document.getElementById('btn-delete');
const btnClearPath = document.getElementById('btn-clear-path');
const btnClear = document.getElementById('btn-clear');
const btnCalc = document.getElementById('btn-calc');
const btnShare = document.getElementById('btn-share');
const toast = document.getElementById('toast');
const paletteContainer = document.getElementById('palette-items');

const trialsSlider = document.getElementById('trials-slider');
const trialsInput = document.getElementById('trials-input');
const progressWrapper = document.getElementById('progress-wrapper');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

// --- IMAGE ASSET CONFIGURATION ---
const BLOCK_IMAGES = {
  //Core blocks
  'Projectile Generator':        'Images/Projectile_generator.webp',
  'Ejection Block':        'Images/Ejection_block.webp',
  'Solid Block':           'Images/Solid_block.webp',
  'Empty Slot':          'Images/Empty_slot.webp',
  //Directional blocks
  'Guide Right':     'Images/Right_turn.webp',
  'Guide Left':      'Images/Left_turn.webp',
  '2-Way Split':  'Images/Split_sides.webp',
  '3-way Split': 'Images/Split_all.webp',
  // Damage/projectile modifiers
  'Add 1 Damage':      'Images/More_damage.webp',
  'Add Projectile':  'Images/Clone_bullet.webp',
  'x2 Damage':  'Images/Double_damage.webp',
  '2-Way Random Split':   'Images/Random_double.webp',
  '3-Way Random Split':   'Images/Random_triple.webp',
  'x10 Damage':  'Images/Tenfold_damage.webp',
  'Random Damage':  'Images/Gamble_damage.webp',
  'Charge':          'Images/Damage_regulator.webp',
  'Damage Cross':      'Images/Damage_loop.webp',
  'Tier Damage':      'Images/Max_tier_damage.webp',
  'Damage Comeback':      'Images/Double_size_and_damage.webp',
  'Damage Stockpile':      'Images/Empty_tile_damage_boost.webp',
  'Combine 10':      'Images/Accumulator.webp',
  'Guided Damage':      'Images/Turn_damage.webp',
  'Add 100 Damage':      'Images/Add_100_damage.webp',
  'Ejector Damage':      'Images/10_damage_unused_ejector.webp',
  'Clone':      'Images/Duplicate_bullet.webp',

  // Unconsequntial modifiers for completness and ship copy/paste functionality
  'Speed Up':      'Images/More_speed.webp',
  'Slow Down':      'Images/Less_speed.webp',
  'Spread Left':      'Images/Eject_to_the_left.webp',
  'Spread Right':     'Images/Eject_to_the_right.webp',
  'Large Spread':  'Images/Eject_randomly.webp',
  'Small Spread':    'Images/Eject_narrow.webp',
  'Curve Left':       'Images/Curve_left.webp',
  'Curve Right':      'Images/Curve_right.webp',
  'Random Curve':     'Images/Curve_randomly.webp',
  'Return Bounce':      'Images/Bounce_back.webp',
  'Random Bounce':   'Images/Bounce_randomly.webp',
  'Ricochet':          'Images/Realistic_bounce.webp',
  'Double Lifetime':   'Images/More_projectile_lifetime.webp',
  'Death Pierce': 'Images/Persistent_damage.webp',
  'Pierce':            'Images/Pierce.webp',
  'Circle AoE':        'Images/Aoe.webp',
  'Rectangle AoE':        'Images/Square_aoe.webp',
  'Magnet': 'Images/Bullet_magnet.webp',
  'Align Direction':  'Images/Bullet_align.webp',
  'Line Magnet':       'Images/Ship_line_bullet_magnet.webp',
  'Shoot Upward':    'Images/Forward.webp',
  'Sideways':        'Images/Sideways.webp',
  'Money Cross':        'Images/Money_loop.webp',
  'Evolved Damage':        'Images/More_damage_at_end_of_lifetime.webp',
  'Slow Burn':        'Images/Speed_damage_boost.webp',
  'Crisscross':        'Images/Zigzag_bullet.webp',
  'Sparse Damage':      'Images/Double_damage_10_bullet_screen.webp'

}

// Preload Images
const loadedImages = {};
Object.entries(BLOCK_IMAGES).forEach(([key, src]) => {
  const img = new Image();
  img.src = src;
  img.onload = () => drawGrid();
  loadedImages[key] = img;
});



// --- TRIALS CONTROLS SYNCHRONIZATION (Logarithmic) ---
const MIN_SIMS = 1;
const MAX_SIMS = 5000000;

trialsSlider.addEventListener('input', (e) => {
  // Linear slider value (0 to 1) -> exponential scale
  const val = e.target.value / 1000;
  const sims = Math.round(MIN_SIMS * Math.pow(MAX_SIMS / MIN_SIMS, val));
  trialsInput.value = sims;
});

trialsInput.addEventListener('change', (e) => {
  let num = parseInt(e.target.value, 10) || 1000000;
  num = Math.max(MIN_SIMS, Math.min(MAX_SIMS, num));
  trialsInput.value = num;
  // Reverse: logarithmic value -> linear slider position (0 to 1000)
  trialsSlider.value = Math.round((Math.log(num / MIN_SIMS) / Math.log(MAX_SIMS / MIN_SIMS)) * 1000);
});

// --- PALETTE UI ---
// Add or import PASSTHROUGH_BLOCKS in app.js or reference it from engine.js
function buildPaletteUI() {
  paletteContainer.innerHTML = '';
  ITEM_PALETTE.forEach(item => {
    const btn = document.createElement('button');
    const isUnimplemented = PASSTHROUGH_BLOCKS.has(item);

    btn.className = 'palette-btn' + 
      (item === selectedPaletteBlock ? ' active' : '') + 
      (isUnimplemented ? ' unimplemented' : '');
      
    btn.title = isUnimplemented ? `${item} (Visual only - No effect yet)` : item;

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
        ctx.fillStyle = tile.type === 'Projectile Generator' ? '#1e3a1e' : 
                        tile.type === 'Ejection Block' ? '#3a1e1e' : '#222222';
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

  const isUnimplemented = PASSTHROUGH_BLOCKS.has(blockName);

  if (isUnimplemented) {
    // Apply grayscale and semi-transparency filter to canvas image
    ctx.filter = 'grayscale(100%) opacity(0.55)';
  }

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
        if (targetTile.type === 'Solid Block' || (targetTile.type === 'Empty Slot' && targetTile.block)) {
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

function updatePathAndGrid() {
  const pathResult = tracePathOnly(shipGrid, GRID_SIZE);
  currentCalculation = { traces: pathResult.traces };
  
  // Auto-update URL hash on layout change
  const code = serializeLayout();
  if (code) {
    window.history.replaceState(null, '', `#build=${code}`);
  } else {
    // If the grid is empty, clear the hash
    window.history.replaceState(null, '', window.location.pathname);
  }

  updateUI();
  drawGrid();
}

// --- INTERACTION ACTIONS ---
function deleteSelectedTile() {
  if (selectedTile.x !== -1) {
    const tile = shipGrid[selectedTile.y][selectedTile.x];
    if (tile.type === 'Empty Slot' && tile.block) {
      tile.block = null;
      tile.rotation = 0;
      updatePathAndGrid();
    }
  }
}

function rotateTile(r, c, direction = 'cw') {
  const tile = shipGrid[r][c];
  if (tile.block) {
    const step = direction === 'ccw' ? -90 : 90;
    tile.rotation = (tile.rotation + step + 360) % 360;
    updatePathAndGrid();
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

    if (tile.type === 'Empty Slot' && selectedPaletteBlock) {
      tile.block = selectedPaletteBlock;

      const incomingDir = getIncomingDirectionAt(r, c);
      if (incomingDir !== null) {
        tile.rotation = incomingDir;
      }
    }

    updatePathAndGrid();
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

// Clear Path Only: Retains Turns & Splitters
btnClearPath.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all non-directional blocks?')) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const tile = shipGrid[r][c];
        if (tile.type === 'Empty Slot' && tile.block && !DIRECTIONAL_BLOCKS.has(tile.block)) {
          tile.block = null;
          tile.rotation = 0;
        }
      }
    }
    updatePathAndGrid();
  }
});

// Clear All Blocks
btnClear.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all blocks?')) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (shipGrid[r][c].type === 'Empty Slot') {
          shipGrid[r][c].block = null;
          shipGrid[r][c].rotation = 0;
        }
      }
    }
  }
  updatePathAndGrid();
});

// --- SIMULATION WITH REAL PROGRESS TRACKING ---
btnCalc.addEventListener('click', () => {
  runCalculation();
});

async function runCalculation() {
  const numTrials = parseInt(trialsInput.value, 10) || 1000000;
  //Get max tier value from html element
  const maxTierValue = parseInt(document.getElementById('maxTierInput').value, 10) || 0;
  // Default ship base damage
  let baseDamage = 1;
  let baseFireRate = parseFloat(document.getElementById('fireRateInput').value);

  btnCalc.disabled = true;
  progressWrapper.classList.add('active');
  progressBar.style.width = '0%';
  if (progressText) {
    progressText.textContent = `0 / ${numTrials.toLocaleString()} (0%)`;
  }

  const pathPreview = tracePathOnly(shipGrid, GRID_SIZE);

  const simResult = await calculateShip(
    shipGrid,
    GRID_SIZE,
    baseDamage,
    baseFireRate,
    numTrials,
    maxTierValue,
    (completed, total) => {
      const pct = Math.min(100, (completed / total) * 100).toFixed(1);
      progressBar.style.width = `${pct}%`;
      if (progressText) {
        progressText.textContent = `${completed.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`;
      }
    }
  );

  currentCalculation = {
    ...simResult,
    traces: pathPreview.traces
  };

  drawGrid();
  updateUI();
  updateChart(currentCalculation);

  progressBar.style.width = '100%';
  btnCalc.disabled = false;
  setTimeout(() => {
    progressWrapper.classList.remove('active');
    progressBar.style.width = '0%';
    if (progressText) {
      progressText.textContent = '';
    }
  }, 400);
}

function updateUI() {
  if (selectedTile.x === -1) {
    selectedInfo.textContent = 'Tile: None selected';
  } else {
    const tile = shipGrid[selectedTile.y][selectedTile.x];
    selectedInfo.textContent = `Tile (${selectedTile.x}, ${selectedTile.y}): ${tile.block || tile.type}`;
  }

  if (currentCalculation && currentCalculation.ev !== undefined) {
    const evElem = document.getElementById('kpi-ev');
    const rangeElem = document.getElementById('kpi-range');

    if (evElem) evElem.textContent = `${currentCalculation.ev} `;
    if (rangeElem) rangeElem.textContent = `${currentCalculation.min} / ${currentCalculation.max} `;
  }
}

function updateChart(calcResult) {
  const chartCanvas = document.getElementById('chart-canvas');
  if (!chartCanvas || !calcResult.dist) return;

  const labels = Object.keys(calcResult.dist).map(d => `${d} Dmg`);
  const probabilities = Object.values(calcResult.dist).map(p => p * 100);

  const maxProb = Math.max(...probabilities, 0);
  let yMax;
  if (maxProb < 10) {
    yMax = Math.max(1, Math.ceil(maxProb));
  } else {
    yMax = Math.min(100, Math.ceil(maxProb / 10) * 10 || 10);
  }

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
        maxBarThickness: 30
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Chance: ${ctx.parsed.y}%`
          }
        }
      },
      scales: {
        x: { 
          title: { display: true, text: 'Damage Output per Seconds', color: '#888888', font: { size: 11 } },
          ticks: { color: '#cccccc' },
          grid: { display: false }
        },
        y: { 
          beginAtZero: true, 
          max: yMax,
          title: { display: true, text: 'Chance (%)', color: '#888888', font: { size: 11 } },
          ticks: { 
            color: '#cccccc',
            stepSize: (yMax <= 5 || (yMax <= 10 && yMax % 2 !== 0)) ? 1 : (yMax <= 20 ? 2 : (yMax <= 50 ? 5 : 10)),
            callback: (val) => `${val}%`
          },
          grid: { color: '#333333' }
        }
      }
    }
  });
}

// --- URL SHARING & SERIALIZATION (5-CHAR HEX: TT-BB-R) ---
// Format per placed tile:
// - TT: 2-digit hex tile index (00 to 8F for 144 tiles)
// - BB: 2-digit hex block ID (00 to 3D for up to 62 blocks)
// - R:  1-digit hex rotation (0=0°, 1=90°, 2=180°, 3=270°)
// No delimiters needed because each block is strictly 5 characters long.
const BLOCK_CATALOG = [
  'Guide Right',     // 00
  'Guide Left',      // 01
  '2-Way Split',  // 02
  '+1 Damage',      // 03
  'Add Projectile',  // 04
  'x2 Damage',   // 05
  '3-way Split', // 06
  '2-Way Random Split',   // 07
  '3-Way Random Split',   // 08
  'x10 Damage',  // 09
  'Random Damage',   // 0A
  'Add 100 Damage' ,    // 0B
  'Clone', // 0C
  'Charge',         // 0D
  'Damage Stockpile',   // 0E
  'Ejector Damage',  // 0F
  'Combine 10',     // 10
  'Damage Comeback' ,      // 11  
  'Tier Damage', // 12
  'Guided Damage',     // 13
  'Damage Cross',    // 14
  'Speed Up',     // 15
  'Slow Down',     // 16
  'Spread Left',     // 17
  'Spread Right',    // 18
  'Large Spread', // 19
  'Small Spread',   // 1A
  'Curve Left',     // 1B
  'Curve Right',    // 1C
  'Random Curve',   // 1D
  'Return Bounce',    // 1E
  'Random Bounce', // 1F
  'Ricochet',       // 20
  'Double Lifetime',  // 21
  'Death Pierce', // 22   
  'Pierce',           // 23
  'Circle AoE',       // 24
  'Rectangle AoE',     // 25
  'Magnet',  // 26
  'Align Direction',   // 27
  'Line Magnet',      // 28
  'Shoot Upward',   // 29
  'Sideways',         // 2A
  'Money Cross',      // 2B
  'Evolved Damage',   // 2C
  'Slow Burn',    // 2D
  'Crisscross',    // 2E
  'Sparse Damage'  // 2F
  // Additional blocks (up to 64) can be appended here
];

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

function serializeLayout() {
  let hexCode = '';

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const tile = shipGrid[r][c];
      if (tile.type === 'Empty Slot' && tile.block) {
        const blockIdx = BLOCK_CATALOG.indexOf(tile.block);
        if (blockIdx !== -1) {
          const tileIdx = r * GRID_SIZE + c;
          const rotIdx = Math.floor(normDir(tile.rotation) / 90) & 3;

          const hexTile = tileIdx.toString(16).padStart(2, '0');
          const hexBlock = blockIdx.toString(16).padStart(2, '0');
          const hexRot = rotIdx.toString(16);

          hexCode += `${hexTile}${hexBlock}${hexRot}`;
        }
      }
    }
  }

  return hexCode;
}

function deserializeLayout(encodedStr) {
  if (!encodedStr || encodedStr.length % 5 !== 0 || !/^[0-9a-fA-F]+$/.test(encodedStr)) {
    return false;
  }

  // Clear existing placed blocks
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (shipGrid[r][c].type === 'Empty Slot') {
        shipGrid[r][c].block = null;
        shipGrid[r][c].rotation = 0;
      }
    }
  }

  let count = 0;
  for (let i = 0; i < encodedStr.length; i += 5) {
    const chunk = encodedStr.substring(i, i + 5);
    const tileIdx = parseInt(chunk.substring(0, 2), 16);
    const blockIdx = parseInt(chunk.substring(2, 4), 16);
    const rot = (parseInt(chunk.substring(4, 5), 16) || 0) * 90;

    const blockName = BLOCK_CATALOG[blockIdx];
    if (blockName && !isNaN(tileIdx)) {
      const r = Math.floor(tileIdx / GRID_SIZE);
      const c = tileIdx % GRID_SIZE;
      if (shipGrid[r] && shipGrid[r][c] && shipGrid[r][c].type === 'Empty Slot') {
        shipGrid[r][c].block = blockName;
        shipGrid[r][c].rotation = normDir(rot);
        count++;
      }
    }
  }

  return count > 0;
}

function loadFromUrlHash() {
  const hash = window.location.hash;
  if (hash.startsWith('#build=')) {
    const code = hash.replace('#build=', '');
    if (deserializeLayout(code)) {
      updatePathAndGrid();
      runCalculation();
      return true;
    }
  }
  return false;
}

if (btnShare) {
  btnShare.addEventListener('click', async () => {
    const code = serializeLayout();
    if (!code) {
      showToast('Grid has no blocks to share!');
      return;
    }

    const cleanBaseUrl = window.location.href.split('#')[0];
    const shareUrl = `${cleanBaseUrl}#build=${code}`;

    // Update address bar without triggering reload
    window.history.replaceState(null, '', `#build=${code}`);

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Build link copied to clipboard!');
    } catch (err) {
      prompt('Copy this link to share your build:', shareUrl);
    }
  });
}

window.addEventListener('hashchange', () => {
  loadFromUrlHash();
});

// Initial Launch
buildPaletteUI();
const loadedFromHash = loadFromUrlHash();
if (!loadedFromHash) {
  updatePathAndGrid();
}