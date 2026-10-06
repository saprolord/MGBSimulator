// --- OPTIMIZED MONTE CARLO TRAVERSAL ENGINE ---

const DIR_VECTORS = {
  0:   { dr: -1, dc: 0 },  // North (Up)
  90:  { dr: 0,  dc: 1 },  // East (Right)
  180: { dr: 1,  dc: 0 },  // South (Down)
  270: { dr: 0,  dc: -1 }  // West (Left)
};

// Blocks that pass projectiles straight through without altering direction or damage
const PASSTHROUGH_BLOCKS = new Set([
  'More Speed', 'Less Speed', 'Eject Left', 'Eject Right', 'Eject Randomly',
  'Eject Narrow', 'Curve Left', 'Curve Right', 'Curve Random', 'Bounce back',
  'Bounce randomly', 'Ricochet', 'Double Lifetime', 'Persistent Damage',
  'Pierce', 'AOE Radius', 'AOE Square', 'Projectile Magnet', 'Projectile Align',
  'Line Magnet', 'Forward Magnet', 'Sideways', 'Money Cross', 'Endlife Damage',
  'Slow Damage', 'Zigzag Projectile', 'Double Less Projectile', 
  'Damage Cross', 'Max Tier Damage', 
  'Turn Damage'
]);

function normDir(dir) {
  return (dir % 360 + 360) % 360;
}

// LIGHTWEIGHT SINGLE-PASS TRACE FOR UI PREVIEW
function tracePathOnly(shipGrid, gridSize) {
  let emitter = null;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (shipGrid[r][c].type === 'EMITTER') {
        emitter = { r, c, dir: normDir(shipGrid[r][c].rotation) };
        break;
      }
    }
  }

  if (!emitter) return { traces: [] };

  const activeNodes = [{
    r: emitter.r,
    c: emitter.c,
    dir: emitter.dir,
    damage: 1,
    pathTrace: [{ r: emitter.r, c: emitter.c }],
    isOriginal: true
  }];

  let traces = [];
  let steps = 0;
  let queue = activeNodes;

  while (queue.length > 0 && steps < 1000) {
    steps++;
    let nextQueue = [];

    for (let node of queue) {
      const vec = DIR_VECTORS[node.dir];
      let nextR = node.r + vec.dr;
      let nextC = node.c + vec.dc;

      if (nextR < 0 || nextR >= gridSize || nextC < 0 || nextC >= gridSize) {
        traces.push(node.pathTrace);
        continue;
      }

      const targetTile = shipGrid[nextR][nextC];
      let newTrace = [...node.pathTrace, { r: nextR, c: nextC }];

      if (targetTile.type === 'WALL' || targetTile.type === 'EJECTOR') {
        traces.push(newTrace);
        continue;
      }

      if (targetTile.type === 'SPACE') {
        if (!targetTile.block) {
          nextQueue.push({ ...node, r: nextR, c: nextC, pathTrace: newTrace });
        } else {
          const requiredDir = normDir(targetTile.rotation);
          if (node.dir === requiredDir) {
            let processed = processModifierForTrace(targetTile, node, nextR, nextC, newTrace, traces);
            nextQueue.push(...processed);
          } else {
            traces.push(newTrace);
          }
        }
      }
    }
    queue = nextQueue;
  }

  return { traces };
}

function processModifierForTrace(tile, node, r, c, trace, traces) {
  const rot = normDir(tile.rotation);
  const isOrig = node.isOriginal ?? true;

  switch (tile.block) {
    case 'Turn Left':
      return [{ ...node, r, c, dir: normDir(rot - 90), pathTrace: trace }];
    case 'Turn Right':
      return [{ ...node, r, c, dir: normDir(rot + 90), pathTrace: trace }];
    case '+1 Damage':
      return [{ ...node, r, c, dir: rot, damage: node.damage + 1, pathTrace: trace }];
    case '+1 Projectile': {
      let projList = [{ ...node, r, c, dir: rot, pathTrace: [...trace] }];
      if (isOrig) projList.push({ ...node, r, c, dir: rot, pathTrace: [...trace], isOriginal: false });
      return projList;
    }
    case 'Duplicate Projectile': {
      let projList = [{ ...node, r, c, dir: rot, pathTrace: [...trace] }];
      projList.push({ ...node, r, c, dir: rot, pathTrace: [...trace], isOriginal: false });
      return projList;
    }
    case 'Dual Splitter':
      return [
        { ...node, r, c, dir: normDir(rot - 90), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot + 90), pathTrace: [...trace] }
      ];
    case '33% x2 Damage':
    case 'Tenfold Damage':
    case 'Gamble Damage':
    case 'Charger':
    case 'Unused Damage':
    case 'Ejector Damage':
    case '4x Damage':
    case 'Accumulator':
      return [{ ...node, r, c, dir: rot, pathTrace: trace }];
    
    case '+100 Damage':
      return [{ ...node, r, c, dir: rot, damage: node.damage + 100, pathTrace: trace }];

    case 'Triple Splitter':
      return [
        { ...node, r, c, dir: normDir(rot - 90), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot + 90), pathTrace: [...trace] }
      ];
    case 'Random Double':
      return [
        { ...node, r, c, dir: normDir(rot - 90), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot + 90), pathTrace: [...trace] }
      ];
    case 'Random Triple':
      return [
        { ...node, r, c, dir: normDir(rot - 90), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot + 90), pathTrace: [...trace] }
      ];
    default:
      if (PASSTHROUGH_BLOCKS.has(tile.block)) {
        return [{ ...node, r, c, dir: rot, pathTrace: trace }];
      }
      traces.push(trace);
      return [];
  }
}

// ============================================================================
// SEQUENTIAL MONTE CARLO ENGINE (Persistent State Across Simulations)
// ============================================================================

/**
 * Runs a single trial across a full multi-shot burst sequence.
 * Accepts `tileStates` map from outside to mutate state continuously across multiple trial runs.
 */
function runBurstTrial(shipGrid, gridSize, emitter, baseDamage, tileStates, burstCount = 0, burstDamageMult = 1.0, unusedDamageBonus = 0, ejectorUnusedCount=0) {
  function getChargerState(r, c) {
    const key = `${r},${c}`;
    if (!tileStates.has(key)) {
      tileStates.set(key, { charge: 0 });
    }
    return tileStates.get(key);
  }

  function get4xState(r, c) {
    const key = `4X_${r},${c}`;
    if (!tileStates.has(key)) {
      tileStates.set(key, { lastDamage: null });
    }
    return tileStates.get(key);
  }
  
  function getAccumulatorState(r, c) {
    const key = `acc_${r},${c}`;
    if (!tileStates.has(key)) {
      tileStates.set(key, { count: 0, accumulatedDamage: 0 });
    }
    return tileStates.get(key);
  }

  let totalBurstDamage = 0;
  const totalShots = 1 + burstCount;

  for (let shotIndex = 0; shotIndex < totalShots; shotIndex++) {
    const shotBaseDamage = (shotIndex === 0) ? baseDamage : baseDamage * burstDamageMult;

    const queue = [{
      r: emitter.r,
      c: emitter.c,
      dir: emitter.dir,
      damage: shotBaseDamage,
      isOriginal: true
    }];

    let steps = 0;

    while (queue.length > 0 && steps < 5000) {
      steps++;
      const proj = queue.shift();
      const vec = DIR_VECTORS[proj.dir];
      const nextR = proj.r + vec.dr;
      const nextC = proj.c + vec.dc;

      // Off-grid collision check
      if (nextR < 0 || nextR >= gridSize || nextC < 0 || nextC >= gridSize) continue;

      const tile = shipGrid[nextR][nextC];

      if (tile.type === 'WALL') continue;

      if (tile.type === 'EJECTOR') {
        totalBurstDamage += proj.damage* (1 + unusedDamageBonus);
        continue;
      }

      if (tile.type === 'SPACE') {
        if (!tile.block) {
          queue.push({ ...proj, r: nextR, c: nextC });
          continue;
        }

        const requiredDir = normDir(tile.rotation);
        if (proj.dir !== requiredDir) continue;

        let currentDmg = proj.damage;

        switch (tile.block) {
          case 'Turn Left':
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir - 90) });
            break;

          case 'Turn Right':
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir + 90) });
            break;

          case '+1 Damage':
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg + 1 });
            break;

          case '+100 Damage':
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg + 100 });
            break;

          case 'Unused Damage':
            queue.push({ ...proj, r: nextR, c: nextC });
            break;

          case 'Charger': {
            const state = getChargerState(nextR, nextC);
            // 1. Gain 10% of stored charge as bonus damage
            currentDmg += state.charge * 0.10;
            // 2. Takes away 10% of the charge and stores 20% of updated damage back into Charger
            state.charge -= state.charge * 0.10;
            state.charge += currentDmg * 0.20;

            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;
          }
          case '4x Damage': {
            const state = get4xState(nextR, nextC);

            // Increase damage by +4 if current damage < previous projectile's damage
            if (state.lastDamage !== null && currentDmg < state.lastDamage) {
              currentDmg += 4;
            }

            // Update tile state with current projectile's incoming damage
            state.lastDamage = proj.damage;

            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;
          }
          case 'Accumulator': {
            const state = getAccumulatorState(nextR, nextC);
            state.count++;
            state.accumulatedDamage += currentDmg;

            // Only release a projectile on every 10th hit
            if (state.count >= 10) {
              const combinedDamage = state.accumulatedDamage * 2;

              // Reset accumulator state
              state.count = 0;
              state.accumulatedDamage = 0;

              // Continue path with doubled combined damage
              queue.push({ ...proj, r: nextR, c: nextC, damage: combinedDamage });
            }
            // Note: If count < 10, nothing is pushed to queue (projectile absorbed)
            break;
          }
          case '33% x2 Damage':
            if (Math.random() < 0.33) currentDmg *= 2;
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;

          case 'Tenfold Damage':
            if (Math.random() < 0.04) currentDmg *= 10;
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;

          case 'Gamble Damage': {
            const roll = Math.random() * 13;
            if (roll < 1) currentDmg *= 0;
            else if (roll < 10) currentDmg *= 1;
            else if (roll < 11) currentDmg *= 2;
            else if (roll < 12) currentDmg *= 3;
            else currentDmg *= 4;

            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;
          }

          case '+1 Projectile':
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            if (proj.isOriginal) {
              queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg, isOriginal: false });
            }
            break;

          case 'Duplicate Projectile':
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg, isOriginal: false });
            break;

          case 'Dual Splitter':
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir - 90) });
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir + 90) });
            break;

          case 'Triple Splitter':
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir - 90) });
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir) });
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir + 90) });
            break;
          
          case 'Ejector Damage':
            // Adds 10 damage for each unused Ejector block in the ship layout
            currentDmg += ejectorUnusedCount * 10;
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;

          case 'Random Double': {
            currentDmg *= 2;
            const chosenDir = Math.random() < 0.5 ? normDir(requiredDir - 90) : normDir(requiredDir + 90);
            queue.push({ ...proj, r: nextR, c: nextC, dir: chosenDir, damage: currentDmg });
            break;
          }

          case 'Random Triple': {
            currentDmg *= 3;
            const rand = Math.random();
            let chosenDir = normDir(requiredDir);
            if (rand < 0.3333333333333333) chosenDir = normDir(requiredDir - 90);
            else if (rand > 0.6666666666666666) chosenDir = normDir(requiredDir + 90);

            queue.push({ ...proj, r: nextR, c: nextC, dir: chosenDir, damage: currentDmg });
            break;
          }

          default:
            if (PASSTHROUGH_BLOCKS.has(tile.block)) {
              queue.push({ ...proj, r: nextR, c: nextC });
            }
            break;
        }
      }
    }
  }

  return totalBurstDamage;
}

/**
 * HIGH-SPEED MONTE CARLO SIMULATION
 */
function calculateShip(
  shipGrid, 
  gridSize, 
  baseDamage = 1, 
  baseFireRate = 1, 
  numSimulations = 100000, 
  onProgress = null,
  config = {}
) {
  const { burstCount = 0, burstDamageMult = 1.0 } = config;

  let emitter = null;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (shipGrid[r][c].type === 'EMITTER') {
        emitter = { r, c, dir: normDir(shipGrid[r][c].rotation) };
        break;
      }
    }
  }

  if (!emitter) {
    const emptyResult = { traces: [], totalEjected: 0, ev: 0, min: 0, max: 0, dist: { 0: 1.0 } };
    if (onProgress) onProgress(numSimulations, numSimulations);
    return Promise.resolve(emptyResult);
  }

  // Count unused Ejector blocks for Unused Damage modifier
  // Find all EJECTOR coordinates on the grid
  const ejectorPositions = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (shipGrid[r][c].type === 'EJECTOR') {
        ejectorPositions.push(`${r},${c}`);
      }
    }
  }
  // Run preview path trace to find hit ejectors
  const pathResult = tracePathOnly(shipGrid, gridSize);
  const hitEjectors = new Set();
  pathResult.traces.forEach(trace => {
    const lastPoint = trace[trace.length - 1];
    if (lastPoint && shipGrid[lastPoint.r][lastPoint.c].type === 'EJECTOR') {
      hitEjectors.add(`${lastPoint.r},${lastPoint.c}`);
    }
  });
  // Count unused ejectors (total ejectors minus hit ejectors)
  const ejectorUnusedCount = ejectorPositions.filter(pos => !hitEjectors.has(pos)).length;

  //Check if an "Unused Damage" block is present anywhere on the grid
  let hasUnusedDamageBlock = false;
  let emptySpaceCount = 0;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const tile = shipGrid[r][c];
      if (tile.type === 'SPACE') {
        if (!tile.block) {
          emptySpaceCount++;
        } else if (tile.block === 'Unused Damage') {
          hasUnusedDamageBlock = true;
        }
      }
    }
  }
  // Only apply the bonus if the block exists on the layout
  const unusedDamageBonus = hasUnusedDamageBlock ? emptySpaceCount*0.1 : 0;

  // Persistent tile states map initialized ONCE for the entire simulation batch
  const persistentTileStates = new Map();

  const damageCounts = new Map();
  const MAX_HISTOGRAM_SAMPLES = 50000;
  const sampleStride = numSimulations > MAX_HISTOGRAM_SAMPLES
    ? Math.ceil(numSimulations / MAX_HISTOGRAM_SAMPLES)
    : 1;

  let histogramSamples = 0;
  let totalDamageSum = 0;
  let globalMin = Infinity;
  let globalMax = -Infinity;

  function executeBatch(startSim, count) {
    const endSim = Math.min(startSim + count, numSimulations);

    for (let sim = startSim; sim < endSim; sim++) {
      // Pass persistentTileStates so simulation N carries over charge from N-1
      const rawDamage = runBurstTrial(
        shipGrid, 
        gridSize, 
        emitter, 
        baseDamage, 
        persistentTileStates, 
        burstCount, 
        burstDamageMult,
        unusedDamageBonus,
        ejectorUnusedCount
      );

      const simDamage = Math.round(rawDamage);

      if (sim % sampleStride === 0) {
        // Round damage to nearest integer before storing
        const roundedDmg = Math.round(simDamage);
        damageCounts.set(roundedDmg, (damageCounts.get(roundedDmg) || 0) + 1);
        histogramSamples++;
      }

      totalDamageSum += simDamage;
      if (simDamage < globalMin) globalMin = simDamage;
      if (simDamage > globalMax) globalMax = simDamage;
    }

    return endSim;
  }

  function finalize() {
    let dist = {};
    const sampleBase = histogramSamples || 1;
    damageCounts.forEach((count, dmg) => {
      dist[dmg] = Number((count / sampleBase).toFixed(4));
    });

    return {
      traces: [],
      totalEjected: numSimulations,
      ev: Number((totalDamageSum / numSimulations).toFixed(2)),
      min: globalMin === Infinity ? 0 : globalMin,
      max: globalMax === -Infinity ? 0 : globalMax,
      dist: dist
    };
  }

  // Synchronous run if no progress callback passed
  if (!onProgress) {
    executeBatch(0, numSimulations);
    return finalize();
  }

  // Asynchronous frame-budgeted execution loop
  return new Promise((resolve) => {
    let currentSim = 0;
    const RESOLUTION = 2000;

    function processFrame() {
      const frameStart = performance.now();

      while (currentSim < numSimulations) {
        currentSim = executeBatch(currentSim, RESOLUTION);
        if (performance.now() - frameStart >= 12) break;
      }

      onProgress(currentSim, numSimulations);

      if (currentSim < numSimulations) {
        requestAnimationFrame(processFrame);
      } else {
        resolve(finalize());
      }
    }

    requestAnimationFrame(processFrame);
  });
}