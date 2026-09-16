// --- TRAVERSAL & PROBABILITY ENGINE ---

const DIR_VECTORS = {
  0:   { dr: -1, dc: 0 },  // North
  90:  { dr: 0,  dc: 1 },  // East
  180: { dr: 1,  dc: 0 },  // South
  270: { dr: 0,  dc: -1 }  // West
};

function normDir(dir) {
  return (dir % 360 + 360) % 360;
}

function calculateShip(shipGrid, gridSize) {
  let emitter = null;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (shipGrid[r][c].type === 'EMITTER') {
        emitter = { r, c, dir: normDir(shipGrid[r][c].rotation) };
        break;
      }
    }
  }

  if (!emitter) return { traces: [], totalEjected: 0, ev: 0, min: 0, max: 0, dist: {} };

  let activeNodes = [{
    r: emitter.r,
    c: emitter.c,
    dir: emitter.dir,
    damageDist: new Map([[1, 1.0]]),
    pathTrace: [{ r: emitter.r, c: emitter.c }]
  }];

  let ejectorHits = [];
  let allTraces = [];
  let steps = 0;
  const maxSteps = 1000;

  while (activeNodes.length > 0 && steps < maxSteps) {
    steps++;
    let currentNode = activeNodes.pop();
    const vec = DIR_VECTORS[currentNode.dir];

    let nextR = currentNode.r + vec.dr;
    let nextC = currentNode.c + vec.dc;

    // Out of grid bounds
    if (nextR < 0 || nextR >= gridSize || nextC < 0 || nextC >= gridSize) {
      allTraces.push(currentNode.pathTrace);
      continue;
    }

    const targetTile = shipGrid[nextR][nextC];
    let newTrace = [...currentNode.pathTrace, { r: nextR, c: nextC }];

    if (targetTile.type === 'WALL') {
      allTraces.push(newTrace);
      continue;
    }

    if (targetTile.type === 'EJECTOR') {
      ejectorHits.push({ damageDist: currentNode.damageDist, pathTrace: newTrace });
      allTraces.push(newTrace);
      continue;
    }

    if (targetTile.type === 'SPACE') {
      if (!targetTile.block) {
        activeNodes.push({
          r: nextR, c: nextC, dir: currentNode.dir,
          damageDist: currentNode.damageDist, pathTrace: newTrace
        });
      } else {
        // Enters block: check entry alignment
        const blockOutputDir = normDir(targetTile.rotation);
        
        // Block processing:
        processModifierBlock(targetTile, currentNode, nextR, nextC, newTrace, activeNodes, allTraces);
      }
    }
  }

  return aggregateResults(ejectorHits, allTraces);
}

function processModifierBlock(tile, node, r, c, trace, activeNodes, allTraces) {
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
        let d2 = dmg * 2;
        multDist.set(d2, (multDist.get(d2) || 0) + prob * 0.33);
        multDist.set(dmg, (multDist.get(dmg) || 0) + prob * 0.67);
      });
      activeNodes.push({
        r, c, dir: blockRot,
        damageDist: multDist, pathTrace: trace
      });
      break;

    default:
      allTraces.push(trace);
      break;
  }
}

function aggregateResults(ejectorHits, allTraces) {
  let combinedDist = {};
  let totalEjected = ejectorHits.length;

  if (totalEjected === 0) {
    return { traces: allTraces, totalEjected: 0, ev: 0, min: 0, max: 0, dist: { 0: 1.0 } };
  }

  ejectorHits.forEach(hit => {
    hit.damageDist.forEach((prob, dmg) => {
      let weightedProb = prob / totalEjected;
      combinedDist[dmg] = (combinedDist[dmg] || 0) + weightedProb;
    });
  });

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
    ev: (ev * totalEjected).toFixed(2),
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
    dist: combinedDist
  };
}
