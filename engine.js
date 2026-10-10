// --- OPTIMIZED MONTE CARLO TRAVERSAL ENGINE ---

const DIR_VECTORS = {
  0:   { dr: -1, dc: 0 },  // North (Up)
  90:  { dr: 0,  dc: 1 },  // East (Right)
  180: { dr: 1,  dc: 0 },  // South (Down)
  270: { dr: 0,  dc: -1 }  // West (Left)
};

// Blocks that pass projectiles straight through without altering direction or damage
const PASSTHROUGH_BLOCKS = new Set([
  'Speed Up', 'Slow Down', 'Spread Left', 'Spread Right', 'Large Spread',
  'Small Spread', 'Curve Left', 'Curve Right', 'Random Curve', 'Return Bounce',
  'Random Bounce', 'Ricochet', 'Double Lifetime', 'Death Pierce',
  'Pierce', 'Circle AoE', 'Rectangle AoE', 'Magnet', 'Align Direction',
  'Line Magnet', 'Shoot Upward', 'Sideways', 'Money Cross', 'Evolved Damage',
  'Slow Burn', 'Crisscross', 'Sparse Damage'
]);


function normDir(dir) {
  return (dir % 360 + 360) % 360;
}

// LIGHTWEIGHT SINGLE-PASS TRACE FOR UI PREVIEW
function tracePathOnly(shipGrid, gridSize) {
  let emitter = null;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (shipGrid[r][c].type === 'Projectile Generator') {
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

      if (targetTile.type === 'Solid Block' || targetTile.type === 'Ejection Block') {
        traces.push(newTrace);
        continue;
      }

      if (targetTile.type === 'Empty Slot') {
        if (!targetTile.block) {
          nextQueue.push({ ...node, r: nextR, c: nextC, pathTrace: newTrace });
        } else {
          const requiredDir = normDir(targetTile.rotation);
          
          // Allow Damage Cross (and passthrough/multi-entry blocks) to evaluate custom entry angles
          if (targetTile.block === 'Damage Cross' || node.dir === requiredDir) {
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
    case 'Guide Left':
      return [{ ...node, r, c, dir: normDir(rot - 90), pathTrace: trace }];
    case 'Guide Right':
      return [{ ...node, r, c, dir: normDir(rot + 90), pathTrace: trace }];
    case 'Add 1 Damage':
      return [{ ...node, r, c, dir: rot, damage: node.damage + 1, pathTrace: trace }];
    case 'Add Projectile': {
      let projList = [{ ...node, r, c, dir: rot, pathTrace: [...trace] }];
      if (isOrig) projList.push({ ...node, r, c, dir: rot, pathTrace: [...trace], isOriginal: false });
      return projList;
    }
    case 'Clone': {
      let projList = [{ ...node, r, c, dir: rot, pathTrace: [...trace] }];
      projList.push({ ...node, r, c, dir: rot, pathTrace: [...trace], isOriginal: false });
      return projList;
    }
    case '2-Way Split':
      return [
        { ...node, r, c, dir: normDir(rot - 90), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot + 90), pathTrace: [...trace] }
      ];
    case 'x2 Damage':
    case 'x10 Damage':
    case 'Random Damage':
    case 'Charge':
    case 'Damage Stockpile':
    case 'Ejector Damage':
    case 'Damage Comeback':
    case 'Combine 10':
    case 'Tier Damage':
    case 'Guided Damage':
      return [{ ...node, r, c, dir: rot, pathTrace: trace }];
    
    case 'Damage Cross': {
      const rot = normDir(tile.rotation);
      const auxB = normDir(rot - 90);
      const auxD = normDir(rot + 90);

      // Auxiliary B entry -> exit D
      if (node.dir === normDir(auxB + 180)) {
        return [{ ...node, r, c, dir: auxD, pathTrace: trace }];
      }
      // Auxiliary D entry -> exit B
      if (node.dir === normDir(auxD + 180)) {
        return [{ ...node, r, c, dir: auxB, pathTrace: trace }];
      }
      // Main Entry A -> exit C
      if (node.dir === rot) {
        return [{ ...node, r, c, dir: rot, pathTrace: trace }];
      }
      // Invalid entry (e.g. entering through C)
      traces.push(trace);
      return [];
    }
    
    case 'Add 100 Damage':
      return [{ ...node, r, c, dir: rot, damage: node.damage + 100, pathTrace: trace }];

    case '3-way Split':
      return [
        { ...node, r, c, dir: normDir(rot - 90), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot + 90), pathTrace: [...trace] }
      ];
    case '2-Way Random Split':
      return [
        { ...node, r, c, dir: normDir(rot - 90), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot + 90), pathTrace: [...trace] }
      ];
    case '3-Way Random Split':
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
function runBurstTrial(shipGrid, gridSize, emitter, baseDamage, tileStates, burstCount = 0, burstDamageMult = 1.0, unusedDamageBonus = 0, ejectorUnusedCount=0, maxTier =0) {
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

  function getDamageCrossState(r, c) {
    const key = `dmgCross_${r},${c}`;
    if (!tileStates.has(key)) {
      tileStates.set(key, {
        idCounter: 0,
        records: new Map() // Maps localStamp -> storedDamage
      });
    }
    return tileStates.get(key);
  }
  function cloneProj(proj, overrides = {}) {
    return {
      ...proj,
      stamps: proj.stamps ? { ...proj.stamps } : {},
      ...overrides
    };
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
      isOriginal: true,
      turnDamageActive: false, // Track "Turn Damage" modifier state per projectile
      stamps: {} // Key: tileKey ("r,c"), Value: unique local ID string used for Damage Cross tracking
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

      if (tile.type === 'Solid Block') continue;

      if (tile.type === 'Ejection Block') {
        totalBurstDamage += proj.damage* (1 + unusedDamageBonus);
        continue;
      }

      if (tile.type === 'Empty Slot') {
        if (!tile.block) {
          queue.push({ ...proj, r: nextR, c: nextC });
          continue;
        }

        const requiredDir = normDir(tile.rotation);
        if (tile.block !== 'Damage Cross' && proj.dir !== requiredDir) continue;

        let currentDmg = proj.damage;

        switch (tile.block) {
          case 'Guide Left':            
            if (proj.turnDamageActive) {
              currentDmg *= 1.10; // Apply 10% boost on subsequent turn blocks
            }
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir - 90), damage:currentDmg });
            break;

          case 'Guide Right':        
            if (proj.turnDamageActive) {
              currentDmg *= 1.10; // Apply 10% boost on subsequent turn blocks
            }
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir + 90), damage:currentDmg });
            break;

          case 'Add 1 Damage':
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg + 1 });
            break;

          case 'Add 100 Damage':
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg + 100 });
            break;

          case 'Damage Stockpile':
            queue.push({ ...proj, r: nextR, c: nextC });
            break;

          case 'Charge': {
            const state = getChargerState(nextR, nextC);
            // 1. Gain 10% of stored charge as bonus damage
            currentDmg += state.charge * 0.10;
            // 2. Takes away 10% of the charge and stores 20% of updated damage back into Charger
            state.charge -= state.charge * 0.10;
            state.charge += currentDmg * 0.20;

            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;
          }
          case 'Damage Comeback': {
            const state = get4xState(nextR, nextC);

            // Increase damage by x4 if current damage < previous projectile's damage
            if (state.lastDamage !== null && currentDmg < state.lastDamage) {
              currentDmg *= 4;
            }

            // Update tile state with current projectile's incoming damage
            state.lastDamage = proj.damage;

            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;
          }
          case 'Combine 10': {
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

          case 'Tier Damage':
            // Adds +10% of the player's max tier as flat damage
            currentDmg += maxTier * 0.10;
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;
          
          case 'Damage Cross': {
            const rot = normDir(tile.rotation); // Facing direction = Main Exit C
            const auxB = normDir(rot - 90);
            const auxD = normDir(rot + 90);

            const tileKey = `${nextR},${nextC}`;
            const crossState = getDamageCrossState(nextR, nextC);

            // Case 1: Main Entry (A) -> Collect recorded damage & exit Main Exit (C)
            if (proj.dir === rot) {
              const localStamp = proj.stamps ? proj.stamps[tileKey] : null;
              if (localStamp && crossState.records.has(localStamp)) {
                currentDmg += crossState.records.get(localStamp);
              }
              queue.push(cloneProj(proj, { r: nextR, c: nextC, damage: currentDmg }));
            } 
            // Case 2: Aux B Entry -> Always assign fresh stamp, record damage & exit Aux D
            else if (proj.dir === normDir(auxB + 180)) {
              crossState.idCounter++;
              const newStamp = `DC_${tileKey}_${crossState.idCounter}`;
              crossState.records.set(newStamp, currentDmg);

              const updatedProj = cloneProj(proj, { r: nextR, c: nextC, dir: auxD, damage: currentDmg });
              updatedProj.stamps[tileKey] = newStamp;
              queue.push(updatedProj);
            } 
            // Case 3: Aux D Entry -> Always assign fresh stamp, record damage & exit Aux B
            else if (proj.dir === normDir(auxD + 180)) {
              crossState.idCounter++;
              const newStamp = `DC_${tileKey}_${crossState.idCounter}`;
              crossState.records.set(newStamp, currentDmg);

              const updatedProj = cloneProj(proj, { r: nextR, c: nextC, dir: auxB, damage: currentDmg });
              updatedProj.stamps[tileKey] = newStamp;
              queue.push(updatedProj);
            }
            // Entry through Main Exit (C) is blocked (nothing pushed to queue)
            break;
          }


          case 'x2 Damage':
            if (Math.random() < 0.33) currentDmg *= 2;
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;

          case 'x10 Damage':
            if (Math.random() < 0.04) currentDmg *= 10;
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;

          case 'Random Damage': {
            const roll = Math.random() * 13;
            if (roll < 1) currentDmg *= 0;
            else if (roll < 10) currentDmg *= 1;
            else if (roll < 11) currentDmg *= 2;
            else if (roll < 12) currentDmg *= 3;
            else currentDmg *= 4;

            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;
          }

          case 'Add Projectile':
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            if (proj.isOriginal) {
              queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg, isOriginal: false });
            }
            break;

          case 'Clone':
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg, isOriginal: false });
            break;

          case '2-Way Split':
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir - 90) });
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir + 90) });
            break;

          case '3-way Split':
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir - 90) });
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir) });
            queue.push({ ...proj, r: nextR, c: nextC, dir: normDir(requiredDir + 90) });
            break;
          
          case 'Ejector Damage':
            // Adds 10 damage for each unused Ejector block in the ship layout
            currentDmg += ejectorUnusedCount * 10;
            queue.push({ ...proj, r: nextR, c: nextC, damage: currentDmg });
            break;
          
            case 'Guided Damage':
            // Activates the +10% turn boost for this projectile moving forward
            queue.push({ ...proj, r: nextR, c: nextC, turnDamageActive: true });
            break;

          case '2-Way Random Split': {
            currentDmg *= 2;
            const chosenDir = Math.random() < 0.5 ? normDir(requiredDir - 90) : normDir(requiredDir + 90);
            queue.push({ ...proj, r: nextR, c: nextC, dir: chosenDir, damage: currentDmg });
            break;
          }

          case '3-Way Random Split': {
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

/* HIGH-SPEED MONTE CARLO SIMULATION*/

function calculateShip(
  shipGrid, 
  gridSize, 
  baseDamage = 1, 
  baseFireRate = 1, 
  numSimulations = 100000, 
  maxTier = 0,
  onProgress = null,
  config = {}
) {
  const { burstCount = 0, burstDamageMult = 1.0 } = config;

  let emitter = null;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (shipGrid[r][c].type === 'Projectile Generator') {
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

  // Count unused Ejector blocks for Ejector Damage modifier
  const ejectorPositions = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (shipGrid[r][c].type === 'Ejection Block') {
        ejectorPositions.push(`${r},${c}`);
      }
    }
  }

  const pathResult = tracePathOnly(shipGrid, gridSize);
  const hitEjectors = new Set();
  pathResult.traces.forEach(trace => {
    const lastPoint = trace[trace.length - 1];
    if (lastPoint && shipGrid[lastPoint.r][lastPoint.c].type === 'Ejection Block') {
      hitEjectors.add(`${lastPoint.r},${lastPoint.c}`);
    }
  });
  const ejectorUnusedCount = ejectorPositions.filter(pos => !hitEjectors.has(pos)).length;

  // Check Unused Damage bonus
  let hasUnusedDamageBlock = false;
  let emptySpaceCount = 0;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const tile = shipGrid[r][c];
      if (tile.type === 'Empty Slot') {
        if (!tile.block) {
          emptySpaceCount++;
        } else if (tile.block === 'Damage Stockpile') {
          hasUnusedDamageBlock = true;
        }
      }
    }
  }
  const unusedDamageBonus = hasUnusedDamageBlock ? emptySpaceCount * 0.1 : 0;

  // Persistent tile states map across all trials
  const persistentTileStates = new Map();
  const damageCounts = new Map();

  let totalDamageSum = 0;
  let globalMin = Infinity;
  let globalMax = -Infinity;

  function executeBatch(startSim, count) {
    const endSim = Math.min(startSim + count, numSimulations);

    for (let sim = startSim; sim < endSim; sim++) {
      const rawDamage = baseFireRate * runBurstTrial(
        shipGrid, 
        gridSize, 
        emitter, 
        baseDamage, 
        persistentTileStates, 
        burstCount, 
        burstDamageMult,
        unusedDamageBonus,
        ejectorUnusedCount,
        maxTier
      );

      const simDamage = Math.round(rawDamage*10)/10;

      // Record 100% of trials into exact frequency Map (no sampleStride)
      damageCounts.set(simDamage, (damageCounts.get(simDamage) || 0) + 1);

      totalDamageSum += simDamage;
      if (simDamage < globalMin) globalMin = simDamage;
      if (simDamage > globalMax) globalMax = simDamage;
    }

    return endSim;
  }

function finalize() {
    let dist = {};
    const maxChartBars = 30;

    // If output spread is dense (e.g. Charger produces >30 distinct values), collapse into dynamic bins
    if (damageCounts.size > maxChartBars && globalMax > globalMin) {
      // 1. Force the minimum bin width to be at least 1 whole integer
      const minVal = Math.floor(globalMin);
      const maxVal = Math.ceil(globalMax);
      const binWidth = Math.max(1, Math.ceil((maxVal - minVal + 1) / maxChartBars));
      const rawBins = new Map();

      // 2. Bucket each recorded damage value into integer step slots
      damageCounts.forEach((count, dmg) => {
        const binIndex = Math.floor((dmg - minVal) / binWidth);
        rawBins.set(binIndex, (rawBins.get(binIndex) || 0) + count);
      });

      // 3. Sort bin indices numerically ascending
      const sortedIndices = Array.from(rawBins.keys()).sort((a, b) => a - b);

      // 4. Construct clean, integer-bounded, non-overlapping label ranges
      sortedIndices.forEach(idx => {
        const start = minVal + idx * binWidth;
        const end = start + binWidth - 1;

        // Single-integer range vs. multi-integer range
        const label = (start === end) ? `${start}` : `${start}-${end}`;
        dist[label] = Number((rawBins.get(idx) / numSimulations).toFixed(4));
      });
    } else {
      // Small set of distinct keys (Accumulators, Splitters, basic multipliers)
      // Sort numeric damage keys ascending
      const sortedDamages = Array.from(damageCounts.keys()).sort((a, b) => a - b);

      sortedDamages.forEach(dmg => {
        dist[dmg] = Number((damageCounts.get(dmg) / numSimulations).toFixed(4));
      });
    }

    return {
      traces: [],
      totalEjected: numSimulations,
      ev: Number((totalDamageSum / numSimulations).toFixed(2)),
      min: globalMin === Infinity ? 0 : globalMin,
      max: globalMax === -Infinity ? 0 : globalMax,
      dist: dist
    };
  }

  // Synchronous execution fallback
  if (!onProgress) {
    executeBatch(0, numSimulations);
    return finalize();
  }

  // Frame-budgeted execution
  return new Promise((resolve) => {
    let currentSim = 0;
    const RESOLUTION = 2500;

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