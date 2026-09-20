// --- TRAVERSAL & PROBABILITY ENGINE ---

// Direction Vectors: 0: North, 90: East, 180: South, 270: West
const DIR_VECTORS = {
  0:   { dr: -1, dc: 0 },  // North (Up)
  90:  { dr: 0,  dc: 1 },  // East (Right)
  180: { dr: 1,  dc: 0 },  // South (Down)
  270: { dr: 0,  dc: -1 }  // West (Left)
};

function normDir(dir) {
  return (dir % 360 + 360) % 360;
}

function calculateShip(shipGrid, gridSize, baseDamage = 1, baseFireRate = 1) {
  // Find emitter location
  let emitter = null;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (shipGrid[r][c].type === 'EMITTER') {
        emitter = { r, c, dir: normDir(shipGrid[r][c].rotation) };
        break;
      }
    }
  }

  if (!emitter) return { traces: [], totalEjected: 0, ev: 0, min: 0, max: 0, dist: { 0: 1.0 } };

  // Set emitter as the first active node
  let activeNodes = [{
    r: emitter.r,
    c: emitter.c,
    dir: emitter.dir,
    damageDist: new Map([[baseDamage, 1.0]]),
    pathTrace: [{ r: emitter.r, c: emitter.c }],
    isOriginal: true // Primary original projectile stream
  }];

  let ejectorHits = [];
  let allTraces = [];
  let steps = 0;
  const maxSteps = 2000;

  while (activeNodes.length > 0 && steps < maxSteps) {
    steps++;
    let currentNode = activeNodes.pop();
    const vec = DIR_VECTORS[currentNode.dir];

    let nextR = currentNode.r + vec.dr;
    let nextC = currentNode.c + vec.dc;

    // Out of grid bounds -> Stop trajectory & store trace
    if (nextR < 0 || nextR >= gridSize || nextC < 0 || nextC >= gridSize) {
      allTraces.push(currentNode.pathTrace);
      continue;
    }

    const targetTile = shipGrid[nextR][nextC];
    let newTrace = [...currentNode.pathTrace, { r: nextR, c: nextC }];

    // Hit Wall -> Stop trajectory & store trace
    if (targetTile.type === 'WALL') {
      allTraces.push(newTrace);
      continue;
    }

    // Hit Ejector -> Register hit & store trace
    if (targetTile.type === 'EJECTOR') {
      ejectorHits.push({ damageDist: currentNode.damageDist, pathTrace: newTrace });
      allTraces.push(newTrace);
      continue;
    }

    if (targetTile.type === 'SPACE') {
      if (!targetTile.block) {
        // Rule 0: Pass straight through open space (PRESERVE isOriginal!)
        activeNodes.push({
          r: nextR, c: nextC, dir: currentNode.dir,
          damageDist: currentNode.damageDist, pathTrace: newTrace,
          isOriginal: currentNode.isOriginal ?? true
        });
      } else {
        // --- RULE 1: ENTRY POINT VALIDATION ---
        const requiredTravelDir = normDir(targetTile.rotation);

        if (currentNode.dir === requiredTravelDir) {
          processModifierBlock(targetTile, currentNode, nextR, nextC, newTrace, activeNodes, allTraces);
        } else {
          // Rule 1 Violation: Did not enter via entry point -> Trajectory stops here
          allTraces.push(newTrace);
        }
      }
    }
  }

  return aggregateResults(ejectorHits, allTraces);
}

function processModifierBlock(tile, node, r, c, trace, activeNodes, allTraces) {
  const blockRot = normDir(tile.rotation);
  let newDist = new Map(node.damageDist);
  const isOrig = node.isOriginal ?? true; // Safe fallback guarantee

  switch (tile.block) {
    case 'Turn Left':
      activeNodes.push({
        r, c, dir: normDir(blockRot - 90),
        damageDist: newDist, pathTrace: trace,
        isOriginal: isOrig
      });
      break;

    case 'Turn Right':
      activeNodes.push({
        r, c, dir: normDir(blockRot + 90),
        damageDist: newDist, pathTrace: trace,
        isOriginal: isOrig
      });
      break;

    case '+1 Projectile':
      // 1. Primary projectile continues forward
      activeNodes.push({
        r, c, dir: blockRot,
        damageDist: new Map(newDist),
        pathTrace: [...trace],
        isOriginal: isOrig
      });

      // 2. Duplicate projectile is spawned ONLY if incoming projectile is original
      if (isOrig) {
        activeNodes.push({
          r, c, dir: blockRot,
          damageDist: new Map(newDist),
          pathTrace: [...trace],
          isOriginal: false // Marked as duplicate -> won't duplicate at future +1 Projectile blocks
        });
      }
      break;

    case 'Dual Splitter':
      // Physical path split: Clones ALL incoming projectiles into both exit directions
      activeNodes.push({
        r, c, dir: normDir(blockRot - 90),
        damageDist: new Map(newDist),
        pathTrace: [...trace],
        isOriginal: isOrig
      });
      activeNodes.push({
        r, c, dir: normDir(blockRot + 90),
        damageDist: new Map(newDist),
        pathTrace: [...trace],
        isOriginal: isOrig
      });
      break;

    case '+1 Damage':
      let addDist = new Map();
      newDist.forEach((prob, dmg) => addDist.set(dmg + 1, prob));
      activeNodes.push({
        r, c, dir: blockRot,
        damageDist: addDist, pathTrace: trace,
        isOriginal: isOrig
      });
      break;

    case '33% x2 Damage':
      let multDist = new Map();
      newDist.forEach((prob, dmg) => {
        let d2 = dmg * 2;
        multDist.set(d2, (multDist.get(d2) || 0) + prob * 0.33);
        multDist.set(dmg, (multDist.get(dmg) || 0) + prob * 0.67);
      });
      activeNodes.push({
        r, c, dir: blockRot,
        damageDist: multDist, pathTrace: trace,
        isOriginal: isOrig
      });
      break;

    default:
      allTraces.push(trace);
      break;
  }
}

function combineEjectedDistributions(ejectedDistributions) {
  if (ejectedDistributions.length === 0) {
    return { 0: 1.0 };
  }

  let currentDist = new Map([[0, 1.0]]);

  for (const projDist of ejectedDistributions) {
    const nextDist = new Map();

    for (const [dmgA, probA] of currentDist.entries()) {
      for (const [dmgB, probB] of projDist.entries()) {
        const totalDmg = dmgA + dmgB;
        const totalProb = probA * probB;
        const existingProb = nextDist.get(totalDmg) || 0;
        
        nextDist.set(totalDmg, existingProb + totalProb);
      }
    }
    currentDist = nextDist;
  }

  const resultObj = {};
  for (const [dmg, prob] of currentDist.entries()) {
    resultObj[dmg] = prob;
  }
  return resultObj;
}

function aggregateResults(ejectorHits, allTraces) {
  let totalEjected = ejectorHits.length;

  if (totalEjected === 0) {
    return { traces: allTraces, totalEjected: 0, ev: 0, min: 0, max: 0, dist: { 0: 1.0 } };
  }

  const ejectedDists = ejectorHits.map(hit => hit.damageDist);
  const combinedDist = combineEjectedDistributions(ejectedDists);

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
    ev: Number(ev.toFixed(2)),
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
    dist: combinedDist
  };
}