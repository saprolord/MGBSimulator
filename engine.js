// --- OPTIMIZED MONTE CARLO TRAVERSAL ENGINE ---

const DIR_VECTORS = {
  0:   { dr: -1, dc: 0 },  // North (Up)
  90:  { dr: 0,  dc: 1 },  // East (Right)
  180: { dr: 1,  dc: 0 },  // South (Down)
  270: { dr: 0,  dc: -1 }  // West (Left)
};



function normDir(dir) {
  return (dir % 360 + 360) % 360;
}

/**
 * LIGHTWEIGHT SINGLE-PASS TRACE FOR UI PREVIEW
 * Used exclusively for canvas trajectory overlays and auto-rotation.
 */
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
    case 'Turn Left': {
      return [{ ...node, r, c, dir: normDir(rot - 90), pathTrace: trace }];}
    case 'Turn Right':{
      return [{ ...node, r, c, dir: normDir(rot + 90), pathTrace: trace }];}
    case '+1 Damage':{
      return [{ ...node, r, c, dir: rot, damage: node.damage + 1, pathTrace: trace }];}
    case '+1 Projectile':{
      let projList = [{ ...node, r, c, dir: rot, pathTrace: [...trace] }];
      if (isOrig) projList.push({ ...node, r, c, dir: rot, pathTrace: [...trace], isOriginal: false });
      return projList;   }
    case 'Dual Splitter':{
      return [
        { ...node, r, c, dir: normDir(rot - 90), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot + 90), pathTrace: [...trace] }
      ];}
    case '33% x2 Damage':{
      return [{ ...node, r, c, dir: rot, pathTrace: trace }];}
      case 'Triple Splitter':{
      return [
        { ...node, r, c, dir: normDir(rot - 90), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot + 90), pathTrace: [...trace] }
      ];}
    case 'Random Double':{
      return [
        { ...node, r, c, dir: normDir(rot - 90), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot + 90), pathTrace: [...trace] }
      ];}
    case 'Random Triple':{
      return [
        { ...node, r, c, dir: normDir(rot - 90), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot), pathTrace: [...trace] },
        { ...node, r, c, dir: normDir(rot + 90), pathTrace: [...trace] }
      ];}
    default:
      traces.push(trace);
      return [];
  }
}

// ============================================================================
// LEVEL 2: PRE-COMPILED EXECUTION GRAPH ENGINE
// ============================================================================

/**
 * Compiles grid structure into an optimized graph representation.
 * Deterministic steps (turns, straight travel, splitters, +1 damage) are compiled
 * into graph nodes, isolating probabilistic nodes (33% x2 Damage) for fast evaluation.
 */
function compileShipGraph(shipGrid, gridSize) {
  let emitter = null;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (shipGrid[r][c].type === 'EMITTER') {
        emitter = { r, c, dir: normDir(shipGrid[r][c].rotation) };
        break;
      }
    }
  }

  if (!emitter) return null;

  let nodes = [];
  let visitedKeyToId = new Map();

  function getKey(r, c, dir, isOriginal) {
    return `${r},${c},${dir},${isOriginal ? 1 : 0}`;
  }

  function resolvePath(startR, startC, startDir, startIsOrig) {
    const key = getKey(startR, startC, startDir, startIsOrig);
    if (visitedKeyToId.has(key)) {
      return visitedKeyToId.get(key);
    }

    let nodeId = nodes.length;
    visitedKeyToId.set(key, nodeId);

    // Placeholder node
    let node = {
      id: nodeId,
      flatAdd: 0,
      probMultiplier: 1, // 1 = deterministic, 2 = 33% chance x2
      nextNodes: [],
      isEjector: false
    };
    nodes.push(node);

    let currR = startR;
    let currC = startC;
    let currDir = startDir;
    let isOrig = startIsOrig;
    let accumulatedAdd = 0;
    let steps = 0;

    while (steps < 1000) {
      steps++;
      const vec = DIR_VECTORS[currDir];
      let nextR = currR + vec.dr;
      let nextC = currC + vec.dc;

      // Off-grid or hit outer wall -> Termination
      if (nextR < 0 || nextR >= gridSize || nextC < 0 || nextC >= gridSize) {
        node.flatAdd = accumulatedAdd;
        return nodeId;
      }

      const targetTile = shipGrid[nextR][nextC];

      if (targetTile.type === 'WALL') {
        node.flatAdd = accumulatedAdd;
        return nodeId;
      }

      if (targetTile.type === 'EJECTOR') {
        node.flatAdd = accumulatedAdd;
        node.isEjector = true;
        return nodeId;
      }

      if (targetTile.type === 'SPACE') {
        if (!targetTile.block) {
          currR = nextR;
          currC = nextC;
          continue;
        }

        const requiredDir = normDir(targetTile.rotation);
        if (currDir !== requiredDir) {
          // Blocked by wrong-facing modifier entry
          node.flatAdd = accumulatedAdd;
          return nodeId;
        }

        const block = targetTile.block;
        currR = nextR;
        currC = nextC;

        if (block === 'Turn Left') {
          currDir = normDir(requiredDir - 90);
        } else if (block === 'Turn Right') {
          currDir = normDir(requiredDir + 90);
        } else if (block === '+1 Damage') {
          accumulatedAdd += 1;
        } else if (block === '+1 Projectile') {
          node.flatAdd = accumulatedAdd;
          let next1 = resolvePath(currR, currC, currDir, isOrig);
          node.nextNodes.push(next1);
          if (isOrig) {
            let next2 = resolvePath(currR, currC, currDir, false);
            node.nextNodes.push(next2);
          }
          return nodeId;
        } else if (block === 'Dual Splitter') {
          node.flatAdd = accumulatedAdd;
          let leftDir = normDir(requiredDir - 90);
          let rightDir = normDir(requiredDir + 90);
          node.nextNodes.push(resolvePath(currR, currC, leftDir, isOrig));
          node.nextNodes.push(resolvePath(currR, currC, rightDir, isOrig));
          return nodeId;
        } else if (block === '33% x2 Damage') {
          node.flatAdd = accumulatedAdd;
          node.probMultiplier = 2; // Flag as 33% x2 chance
          node.nextNodes.push(resolvePath(currR, currC, currDir, isOrig));
          return nodeId;
        }
         else if (block === 'Triple Splitter') {
          node.flatAdd = accumulatedAdd;
          let leftDir = normDir(requiredDir - 90);
          let rightDir = normDir(requiredDir + 90);
          let next1 = resolvePath(currR, currC, currDir, isOrig);
          node.nextNodes.push(resolvePath(currR, currC, leftDir, isOrig));
          node.nextNodes.push(resolvePath(currR, currC, rightDir, isOrig));
          node.nextNodes.push(next1);
          return nodeId;
        } 
          else if (block === 'Random Double') {
            node.flatAdd = accumulatedAdd;
            node.probMultiplier = 3; // Tag: Random 50/50 path branch + x2 Damage
            let leftDir = normDir(requiredDir - 90);
            let rightDir = normDir(requiredDir + 90);
            node.nextNodes.push(resolvePath(currR, currC, leftDir, isOrig));  // index 0: Left
            node.nextNodes.push(resolvePath(currR, currC, rightDir, isOrig)); // index 1: Right
            return nodeId;
        } 
          else if (block === 'Random Triple') {
            node.flatAdd = accumulatedAdd;
            node.probMultiplier = 4; // Tag: Random 33/33/33 path branch + x3 Damage
            let leftDir = normDir(requiredDir - 90);
            let rightDir = normDir(requiredDir + 90);
            node.nextNodes.push(resolvePath(currR, currC, leftDir, isOrig));  // index 0: Left
            node.nextNodes.push(resolvePath(currR, currC, currDir, isOrig));  // index 1: Straight
            node.nextNodes.push(resolvePath(currR, currC, rightDir, isOrig)); // index 2: Right
            return nodeId;
        }
      }
    }

    node.flatAdd = accumulatedAdd;
    return nodeId;
  }

  let rootId = resolvePath(emitter.r, emitter.c, emitter.dir, true);
  return { rootId, nodes };
}

/**
 * HIGH-SPEED MONTE CARLO SIMULATION
 * Uses flat pre-allocated arrays, compiled graph traversal, and time-sliced
 * frame execution for smooth progress reporting without blocking the UI.
 */
function calculateShip(shipGrid, gridSize, baseDamage = 1, baseFireRate = 1, numSimulations = 1000000, onProgress = null) {
  const compiled = compileShipGraph(shipGrid, gridSize);

  if (!compiled) {
    const emptyResult = { traces: [], totalEjected: 0, ev: 0, min: 0, max: 0, dist: { 0: 1.0 } };
    if (onProgress) {
      onProgress(numSimulations, numSimulations);
      return Promise.resolve(emptyResult);
    }
    return emptyResult;
  }

  const { rootId, nodes } = compiled;
  const numNodes = nodes.length;

  // Flatten graph structures into pre-allocated typed arrays
  const nodeFlatAdd = new Int32Array(numNodes);
  const nodeIsEjector = new Uint8Array(numNodes);
  const nodeProbMult = new Uint8Array(numNodes);
  const nextNodesOffset = new Int32Array(numNodes);
  const nextNodesCount = new Int32Array(numNodes);

  // Flatten edges list
  let totalEdges = 0;
  for (let i = 0; i < numNodes; i++) {
    totalEdges += nodes[i].nextNodes.length;
  }
  const edgeList = new Int32Array(totalEdges);

  let edgeIdx = 0;
  for (let i = 0; i < numNodes; i++) {
    const n = nodes[i];
    nodeFlatAdd[i] = n.flatAdd;
    nodeIsEjector[i] = n.isEjector ? 1 : 0;
    nodeProbMult[i] = n.probMultiplier;

    nextNodesOffset[i] = edgeIdx;
    nextNodesCount[i] = n.nextNodes.length;

    for (let j = 0; j < n.nextNodes.length; j++) {
      edgeList[edgeIdx++] = n.nextNodes[j];
    }
  }

  // Pre-allocated stack buffers for traversal (Zero GC during evaluation)
  const MAX_STACK = 4096; // 4k stack depth should be sufficient for any reasonable ship layout
  const stackNodeId = new Int32Array(MAX_STACK);
  const stackDamage = new Float64Array(MAX_STACK);

  // Frequency Map for damage outcomes (sampled up to 50k to eliminate Map lookup bottlenecks)
  const damageCounts = new Map();
  const MAX_HISTOGRAM_SAMPLES = 50000;
  const sampleStride = numSimulations > MAX_HISTOGRAM_SAMPLES
    ? Math.ceil(numSimulations / MAX_HISTOGRAM_SAMPLES)
    : 1;
  let histogramSamples = 0;

  let totalDamageSum = 0;
  let globalMin = Infinity;
  let globalMax = -Infinity;

  // Simulation execution helper for a batch of trials
  function executeBatch(startSim, count) {
    const endSim = Math.min(startSim + count, numSimulations);

    for (let sim = startSim; sim < endSim; sim++) {
      let stackPtr = 0;
      stackNodeId[0] = rootId;
      stackDamage[0] = baseDamage;
      stackPtr = 1;

      let simDamage = 0;

      while (stackPtr > 0) {
        stackPtr--;
        let currId = stackNodeId[stackPtr];
        let currDmg = stackDamage[stackPtr];

        // Linear Path Shortcut: follow single-exit chains without stack push/pop
        while (true) {
          currDmg += nodeFlatAdd[currId];

          const probType = nodeProbMult[currId];

          if (probType === 2) {
            // 33% x2 Damage
            if (Math.random() < 0.33) {
              currDmg *= 2;
            }
          } else if (probType === 3) {
            // Random Double Damage: 50% Right, 50% Left + 2x Damage
            currDmg *= 2;
            const offset = nextNodesOffset[currId];
            const pick = Math.random() < 0.5 ? 1 : 0; // 50% Right (index 1), 50% Left (index 0)
            currId = edgeList[offset + pick];
            continue;
          } else if (probType === 4) {
            // Random Triple Damage: ~33.33% Left, ~33.33% Straight, ~33.33% Right + 3x Damage
            currDmg *= 3;
            const offset = nextNodesOffset[currId];
            const rand = Math.random();
            const pick = rand < 0.3333333333333333 ? 0 : (rand < 0.6666666666666666 ? 1 : 2);
            currId = edgeList[offset + pick];
            continue;
          }

          if (nodeIsEjector[currId] === 1) {
            simDamage += currDmg;
          }

          const count = nextNodesCount[currId];
          if (count === 1) {
            currId = edgeList[nextNodesOffset[currId]];
            continue;
          }

          if (count > 1) {
            // Standard splitters (Dual, Triple, +1 Projectile) that clone bullets
            const offset = nextNodesOffset[currId];
            for (let k = 0; k < count; k++) {
              if (stackPtr < MAX_STACK) {
                stackNodeId[stackPtr] = edgeList[offset + k];
                stackDamage[stackPtr] = currDmg;
                stackPtr++;
              }
            }
          }
          break;
        }
      }

      if (sim % sampleStride === 0) {
        damageCounts.set(simDamage, (damageCounts.get(simDamage) || 0) + 1);
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

  // If no onProgress callback, run synchronously
  if (!onProgress) {
    executeBatch(0, numSimulations);
    return finalize();
  }

  // Time-sliced asynchronous run with resolution of 10,000 trials
  return new Promise((resolve) => {
    let currentSim = 0;
    const RESOLUTION = 10000;

    function processFrame() {
      const frameStart = performance.now();

      while (currentSim < numSimulations) {
        currentSim = executeBatch(currentSim, RESOLUTION);

        // Yield if more than 12ms elapsed in this frame to maintain 60 FPS
        if (performance.now() - frameStart >= 12) {
          break;
        }
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