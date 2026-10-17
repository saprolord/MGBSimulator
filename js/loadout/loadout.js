/**
 * LOADOUT
 * =======
 * Everything the player has chosen apart from the ship itself:
 *
 *   captainId     which captain is active (or null)
 *   captainLevel  that captain's level: +1 base damage per level on every ship
 *   skills        Set of ticked skill ids (only the active captain's count)
 *   perks         Set of unlocked perk ids
 *
 * `resolveRules()` turns a loadout into the final numbers the simulation runs with. Skills and perks
 * apply to every ship mode (normal and custom), so the simulation gets them the same way.
 */

import { DEFAULT_TUNING } from '../tuning.js';
import { applyEffects } from './effects.js';
import { createPerkTree } from './perk-tree.js';
import { GAME_DATA } from './data.js';

export const createLoadout = () => ({ captainId: null, captainLevel: 0, skills: new Set(), perks: new Set() });

export const findCaptain = (captainId, data = GAME_DATA) => data.captains.find((c) => c.id === captainId) ?? null;
export const maxLevelOf = (captain, data = GAME_DATA) => captain?.maxLevel ?? data.defaultMaxCaptainLevel;

/** Every effect currently active, from the captain level, ticked skills and unlocked perks. */
export function collectEffects(loadout, data = GAME_DATA) {
  const effects = [];

  const captain = findCaptain(loadout.captainId, data);
  if (captain) {
    effects.push({ stat: 'baseDamage', op: 'add', value: loadout.captainLevel * data.damagePerCaptainLevel });
    for (const skill of captain.skills ?? []) {
      if (loadout.skills.has(skill.id) && !skill.visualOnly) effects.push(...(skill.effects ?? []));
    }
  }
  for (const perk of data.perks) {
    if (loadout.perks.has(perk.id) && !perk.visualOnly) effects.push(...(perk.effects ?? []));
  }
  return effects;
}

/**
 * @param {object} loadout
 * @param {{ fireRate?: number, baseDamage?: number }} start  the ship's fire rate and the plain base damage
 * @returns {{ baseDamage: number, fireRate: number, tuning: Record<string, number> }}
 */
export function resolveRules(loadout, { fireRate = 1, baseDamage = 1 } = {}, data = GAME_DATA) {
  const resolved = applyEffects({ baseDamage, fireRate, ...DEFAULT_TUNING }, collectEffects(loadout, data));
  const { baseDamage: finalDamage, fireRate: finalFireRate, ...tuning } = resolved;
  return { baseDamage: finalDamage, fireRate: finalFireRate, tuning };
}

// ---- Saving ---------------------------------------------------------------------------------

export const serializeLoadout = (loadout) => ({
  captainId: loadout.captainId,
  captainLevel: loadout.captainLevel,
  skills: [...loadout.skills],
  perks: [...loadout.perks],
});

/** Rebuild a loadout from saved JSON, dropping anything that no longer exists or is no longer legal. */
export function restoreLoadout(saved, data = GAME_DATA) {
  const loadout = createLoadout();
  if (saved === null || typeof saved !== 'object') return loadout;

  const captain = findCaptain(saved.captainId, data);
  if (captain) {
    loadout.captainId = captain.id;
    const level = Number.isInteger(saved.captainLevel) ? saved.captainLevel : 0;
    loadout.captainLevel = Math.max(0, Math.min(maxLevelOf(captain, data), level));
  }

  const knownSkills = new Set(data.captains.flatMap((c) => (c.skills ?? []).map((s) => s.id)));
  loadout.skills = new Set((Array.isArray(saved.skills) ? saved.skills : []).filter((id) => knownSkills.has(id)));

  const tree = createPerkTree(data.perks, data.maxPerkPoints);
  loadout.perks = tree.sanitize(Array.isArray(saved.perks) ? saved.perks : []);
  return loadout;
}

const STORAGE_KEY = 'mgb-loadout-v1';

export function loadSavedLoadout(data = GAME_DATA) {
  try {
    return restoreLoadout(JSON.parse(localStorage.getItem(STORAGE_KEY)), data);
  } catch {
    return createLoadout(); // nothing saved, corrupt, or storage blocked
  }
}

export function saveLoadout(loadout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeLoadout(loadout)));
  } catch {
    /* storage blocked or full: the loadout simply is not remembered */
  }
}
