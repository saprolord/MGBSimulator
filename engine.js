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

  // A "World State" tracks a joint probability outcome across all branched paths.
  let worldStates = [{
    prob: 1.0,
    activeNodes: [{
      r: emitter.r,
      c: emitter.c,
      dir: emitter.dir,
      damage: baseDamage,
      pathTrace: [{ r: emitter.r, c: emitter.c }],
      isOriginal: true
    }],
    totalEjectedDamage: 0
  }];

  let completedWorlds = [];
  let allTraces = [];
  let steps = 0;
  const maxSteps = 2000;

  while (worldStates.length > 0 && steps < maxSteps) {
    steps++;
    let nextWorldStates = [];

    for (let world of worldStates) {
      if (world.activeNodes.length === 0) {
        completedWorlds.push(world);
        continue;
      }

      // Process all current active nodes in this world state concurrently
      let currentNodes = world.activeNodes;
      let newWorldBranches = [{ prob: world.prob, activeNodes: [], totalEjectedDamage: world.totalEjectedDamage }];

      for (let node of currentNodes) {
        const vec = DIR_VECTORS[node.dir];
        let nextR = node.r + vec.dr;
        let nextC = node.c + vec.dc;

        // Out of bounds -> stop trace
        if (nextR < 0 || nextR >= gridSize || nextC < 0 || nextC >= gridSize) {
          allTraces.push(node.pathTrace);
          continue;
        }

        const targetTile = shipGrid[nextR][nextC];
        let newTrace = [...node.pathTrace, { r: nextR, c: nextC }];

        // Hit Wall -> stop trace
        if (targetTile.type === 'WALL') {
          allTraces.push(newTrace);
          continue;
        }

        // Hit Ejector -> Register damage output & stop trace
        if (targetTile.type === 'EJECTOR') {
          for (let w of newWorldBranches) {
            w.totalEjectedDamage += node.damage;
          }
          allTraces.push(newTrace);
          continue;
        }

        if (targetTile.type === 'SPACE') {
          if (!targetTile.block) {
            // Rule 0: Move straight through empty tile
            for (let w of newWorldBranches) {
              w.activeNodes.push({
                r: nextR, c: nextC, dir: node.dir,
                damage: node.damage, pathTrace: newTrace,
                isOriginal: node.isOriginal ?? true
              });
            }
          } else {
            // Rule 1: Validate entry direction
            const requiredTravelDir = normDir(targetTile.rotation);
            if (node.dir === requiredTravelDir) {
              newWorldBranches = processModifierBlockWorld(
                targetTile, node, nextR, nextC, newTrace, newWorldBranches, allTraces
              );
            } else {
              // Direction mismatch -> stop trace
              allTraces.push(newTrace);
            }
          }
        }
      }

      nextWorldStates.push(...newWorldBranches);
    }

    worldStates = nextWorldStates;
  }

  // Include any remaining un-completed worlds
  completedWorlds.push(...worldStates);

  return aggregateResults(completedWorlds, allTraces);
}

function processModifierBlockWorld(tile, node, r, c, trace, worldBranches, allTraces) {
  const blockRot = normDir(tile.rotation);
  const isOrig = node.isOriginal ?? true;
  let expandedBranches = [];

  for (let world of worldBranches) {
    switch (tile.block) {
      case 'Turn Left':
        world.activeNodes.push({
          r, c, dir: normDir(blockRot - 90),
          damage: node.damage, pathTrace: trace,
          isOriginal: isOrig
        });
        expandedBranches.push(world);
        break;

      case 'Turn Right':
        world.activeNodes.push({
          r, c, dir: normDir(blockRot + 90),
          damage: node.damage, pathTrace: trace,
          isOriginal: isOrig
        });
        expandedBranches.push(world);
        break;

      case '+1 Projectile':
        world.activeNodes.push({
          r, c, dir: blockRot,
          damage: node.damage, pathTrace: [...trace],
          isOriginal: isOrig
        });

        if (isOrig) {
          world.activeNodes.push({
            r, c, dir: blockRot,
            damage: node.damage, pathTrace: [...trace],
            isOriginal: false // Duplicated projectile
          });
        }
        expandedBranches.push(world);
        break;

      case 'Dual Splitter':
        // Clones current projectile into left and right directions
        world.activeNodes.push({
          r, c, dir: normDir(blockRot - 90),
          damage: node.damage, pathTrace: [...trace],
          isOriginal: isOrig
        });
        world.activeNodes.push({
          r, c, dir: normDir(blockRot + 90),
          damage: node.damage, pathTrace: [...trace],
          isOriginal: isOrig
        });
        expandedBranches.push(world);
        break;

      case '+1 Damage':
        world.activeNodes.push({
          r, c, dir: blockRot,
          damage: node.damage + 1, pathTrace: trace,
          isOriginal: isOrig
        });
        expandedBranches.push(world);
        break;

      case '33% x2 Damage':
        // Branches the World state into two outcomes: Hit (33%) vs Miss (67%)
        let hitWorld = {
          prob: world.prob * 0.33,
          activeNodes: [...world.activeNodes.map(n => ({ ...n, pathTrace: [...n.pathTrace] }))],
          totalEjectedDamage: world.totalEjectedDamage
        };
        hitWorld.activeNodes.push({
          r, c, dir: blockRot,
          damage: node.damage * 2, pathTrace: trace,
          isOriginal: isOrig
        });

        let missWorld = {
          prob: world.prob * 0.67,
          activeNodes: [...world.activeNodes.map(n => ({ ...n, pathTrace: [...n.pathTrace] }))],
          totalEjectedDamage: world.totalEjectedDamage
        };
        missWorld.activeNodes.push({
          r, c, dir: blockRot,
          damage: node.damage, pathTrace: trace,
          isOriginal: isOrig
        });

        expandedBranches.push(hitWorld, missWorld);
        break;

      default:
        allTraces.push(trace);
        expandedBranches.push(world);
        break;
    }
  }

  return expandedBranches;
}

function aggregateResults(completedWorlds, allTraces) {
  if (completedWorlds.length === 0) {
    return { traces: allTraces, totalEjected: 0, ev: 0, min: 0, max: 0, dist: { 0: 1.0 } };
  }

  // Aggregate joint world probabilities by total combined damage
  let combinedDist = {};

  for (let world of completedWorlds) {
    let dmg = world.totalEjectedDamage;
    combinedDist[dmg] = (combinedDist[dmg] || 0) + world.prob;
  }

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
    totalEjected: Object.keys(combinedDist).length,
    ev: Number(ev.toFixed(2)),
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
    dist: combinedDist
  };
}