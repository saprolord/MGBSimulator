/**
 * Checks captains/skills/perks data for mistakes (typos in stat names, broken links between
 * perks, duplicate ids...). Returns a list of readable problems; an empty list means all good.
 * The app logs them to the console and `node --test` fails if there are any.
 */

import { checkEffect } from './effects.js';

export function validateData({ captains, perks, maxPerkPoints }) {
  const problems = [];
  const ID = /^[a-z0-9_-]+$/;

  const checkEffects = (where, effects) => {
    for (const effect of effects ?? []) {
      const problem = checkEffect(effect);
      if (problem) problems.push(`${where}: ${problem}`);
    }
  };

  // ---- Captains and skills
  const ids = new Set();
  for (const captain of captains) {
    if (!ID.test(captain.id ?? '')) problems.push(`Captain "${captain.id}": id must be lowercase letters, digits, - or _`);
    if (ids.has(captain.id)) problems.push(`Duplicate id "${captain.id}"`);
    ids.add(captain.id);
    if (captain.maxLevel !== undefined && !(Number.isInteger(captain.maxLevel) && captain.maxLevel >= 0)) {
      problems.push(`Captain "${captain.id}": maxLevel must be a whole number, 0 or more`);
    }
    for (const skill of captain.skills ?? []) {
      if (!ID.test(skill.id ?? '')) problems.push(`Skill "${skill.id}": id must be lowercase letters, digits, - or _`);
      if (ids.has(skill.id)) problems.push(`Duplicate id "${skill.id}"`);
      ids.add(skill.id);
      if (skill.visualOnly && skill.effects?.length) problems.push(`Skill "${skill.id}": visualOnly skills must not have effects`);
      checkEffects(`Skill "${skill.id}"`, skill.effects);
    }
  }

  // ---- Perks
  const perkIds = new Set();
  const positions = new Map();
  for (const perk of perks) {
    if (!ID.test(perk.id ?? '')) problems.push(`Perk "${perk.id}": id must be lowercase letters, digits, - or _`);
    if (perkIds.has(perk.id)) problems.push(`Duplicate perk id "${perk.id}"`);
    perkIds.add(perk.id);

    if (!Number.isInteger(perk.q) || !Number.isInteger(perk.r)) problems.push(`Perk "${perk.id}": q and r must be whole numbers`);
    const position = `${perk.q},${perk.r}`;
    if (positions.has(position)) problems.push(`Perks "${positions.get(position)}" and "${perk.id}" are on the same hex (${position})`);
    positions.set(position, perk.id);

    if (perk.cost !== undefined && !(Number.isInteger(perk.cost) && perk.cost > 0)) problems.push(`Perk "${perk.id}": cost must be a whole number above 0`);
    if (perk.visualOnly && perk.effects?.length) problems.push(`Perk "${perk.id}": visualOnly perks must not have effects`);
    checkEffects(`Perk "${perk.id}"`, perk.effects);
  }
  for (const perk of perks) {
    for (const required of perk.requires ?? []) {
      if (!perkIds.has(required)) problems.push(`Perk "${perk.id}" requires unknown perk "${required}"`);
      if (required === perk.id) problems.push(`Perk "${perk.id}" requires itself`);
    }
  }
  if (perks.length > 0 && !perks.some((perk) => (perk.requires ?? []).length === 0)) {
    problems.push('No starting perk: at least one perk needs `requires: []`');
  }

  // Every perk must be unlockable by some route from a starting perk.
  const reached = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const perk of perks) {
      const need = perk.requires ?? [];
      const ok = need.length === 0 || (perk.requiresAll ? need.every((id) => reached.has(id)) : need.some((id) => reached.has(id)));
      if (ok && !reached.has(perk.id)) {
        reached.add(perk.id);
        grew = true;
      }
    }
  }
  for (const perk of perks) if (!reached.has(perk.id)) problems.push(`Perk "${perk.id}" can never be unlocked (no route from a starting perk)`);

  if (!Number.isInteger(maxPerkPoints) || maxPerkPoints < 0) problems.push('MAX_PERK_POINTS must be a whole number, 0 or more');
  return problems;
}
