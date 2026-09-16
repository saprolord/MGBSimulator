// --- TRAVERSAL & PROBABILITY ENGINE ---

// Vector Helpers (0: North, 90: East, 180: South, 270: West)
const DIR_VECTORS = {
  0:   { dr: -1, dc: 0 },
  90:  { dr: 0,  dc: 1 },
  180: { dr: 1,  dc: 0 },
  270: { dr: 0,  dc: -1 }
};

// Normalize direction to [0, 90, 180, 270]
function normDir(dir) {
  return (dir % 360 + 360) % 360;
}

/**
 * Calculates paths and damage probabilities across the ship grid.
 */
function calculateShip(shipGrid, gridSize) {
  // 1. Locate Emitter
  let emitter = null;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (shipGrid[r][c].type === 'EMITTER') {
        emitter = { r, c, dir: normDir(shipGrid[r][c].rotation) };
        break;
      }
    }
  }

  if (!emitter) return { paths: [], totalEjected: 0, finalDistribution: {} };

  // 2. Traversal Stack / Queue
  // Path node state: { r, c, dir, damageDist: Map(damageValue -> prob), pathTrace: Array of {r, c} }
  let activeNodes = [{
    r: emitter.r,
    c: emitter.c,
    dir: emitter.dir,
    damageDist: new Map([[1, 1.0]]), // Starts with flat 1 damage @ 100% prob
    pathTrace: [{ r: emitter.r, c: emitter.c }]
  }];

  let validPaths = [];
  let ejectorHits = [];

  // Prevent infinite loops / bound traversal step safety limits
  let steps = 0;
  const maxSteps = 1000;

  while (activeNodes.length > 0 && steps < maxSteps) {
    steps++;
    let currentNode = activeNodes.pop();
    const vec = DIR_VECTORS[currentNode.dir];
    
    let nextR = currentNode.r + vec.dr;
    let nextC = currentNode.c + vec.dc;

    // Boundary Check
    if (nextR < 0 || nextR >= gridSize || nextC < 0 || nextC >= gridSize) {
      continue; // Path left the ship grid
    }

    const targetTile = shipGrid[nextR][nextC];
    let newTrace = [...currentNode.pathTrace, { r: nextR, c: nextC }];

    // --- COLLISION & TERMINATION CHECKS ---
    if (targetTile.type === 'WALL') {
      continue; // Terminate path
    }

    if (targetTile.type === 'EJECTOR') {
      ejectorHits.push({
        damageDist: currentNode.damageDist,
        pathTrace: newTrace
      });
      continue;
    }

    if (targetTile.type === 'SPACE') {
      if (!targetTile.block) {
        // Pass straight through open space
        activeNodes.push({
          r: nextR, c: nextC, dir: currentNode.dir,
          damageDist: currentNode.damageDist, pathTrace: newTrace
        });
      } else {
        // --- MODIFIER BLOCK ENTRY EVALUATION ---
        // Input face is opposite of block's output rotation face
        const validEntryDir = normDir(targetTile.rotation);
        
        // If projectile movement matches the input face direction
        if (currentNode.dir === validEntryDir) {
          processModifierBlock(targetTile, currentNode, nextR, nextC, newTrace, activeNodes);
        }
        // If projectile enters from invalid face -> Terminate
      }
    }
  }

  // 3. Aggregate Results Across All Ejected Rays
  return aggregateResults(ejectorHits);
}

function processModifierBlock(tile, node, r, c, trace, activeNodes) {
  const blockRot = normDir(tile.rotation);
  let newDist = new Map(node.damageDist);

  switch (tile.block) {
    case 'Turn Right':
      activeNodes.push({
        r, c, dir: normDir(blockRot + 90),
        damageDist: newDist, pathTrace: trace
      });
      break;

    case 'Turn Left':
      activeNodes.push({
        r, c, dir: normDir(blockRot - 90),
        damageDist: newDist, pathTrace: trace
      });
      break;

    case 'Dual Splitter':
      // Clones 100% properties down Left & Right directions
      activeNodes.push({
        r, c, dir: normDir(blockRot - 90),
        damageDist: new Map(newDist), pathTrace: [...trace]
      });
      activeNodes.push({
        r, c, dir: normDir(blockRot + 90),
        damageDist: new Map(newDist), pathTrace: [...trace]
      });
      break;

    case '+1 Damage':
      let addDist = new Map();
      newDist.forEach((prob, dmg) => addDist.set(dmg + 1, prob));
      activeNodes.push({
        r, c, dir: blockRot,
        damageDist: addDist, pathTrace: trace
      });
      break;

    case '+1 Projectile':
      // Spawns 2 identical paths straight ahead
      activeNodes.push({
        r, c, dir: blockRot,
        damageDist: new Map(newDist), pathTrace: [...trace]
      });
      activeNodes.push({
        r, c, dir: blockRot,
        damageDist: new Map(newDist), pathTrace: [...trace]
      });
      break;

    case '33% x2 Damage':
      let multDist = new Map();
      newDist.forEach((prob, dmg) => {
        // 33% chance x2
        let d2 = dmg * 2;
        multDist.set(d2, (multDist.get(d2) || 0) + prob * 0.33);
        // 67% chance x1
        multDist.set(dmg, (multDist.get(dmg) || 0) + prob * 0.67);
      });
      activeNodes.push({
        r, c, dir: blockRot,
        damageDist: multDist, pathTrace: trace
      });
      break;
  }
}

function aggregateResults(ejectorHits) {
  let combinedDist = {};
  let totalEjected = ejectorHits.length;
  let allTraces = ejectorHits.map(h => h.pathTrace);

  if (totalEjected === 0) {
    return { traces: [], totalEjected: 0, ev: 0, min: 0, max: 0, dist: {} };
  }

  // Normalize combined probabilities across all output projectiles
  ejectorHits.forEach(hit => {
    hit.damageDist.forEach((prob, dmg) => {
      let weightedProb = prob / totalEjected;
      combinedDist[dmg] = (combinedDist[dmg] || 0) + weightedProb;
    });
  });

  // Calculate Metrics
  let ev = 0;
  let min = Infinity;
  let max = -Infinity;

  Object.entries(combinedDist).forEach(([dmgStr, prob]) => {
    let dmg = Number(dmgStr);
    ev += dmg * prob;
    if (dmg < min) min = dmg;
    if (dmg > max) max = dmg;
  });

  return {
    traces: allTraces,
    totalEjected,
    ev: totalEjected > 0 ? (ev * totalEjected).toFixed(2) : 0, // Total expected dmg per volley
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
    dist: combinedDist
  };
}
