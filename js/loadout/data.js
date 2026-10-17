/** All captain / skill / perk data in one object, validated once when the page loads. */

import { CAPTAINS, DAMAGE_PER_CAPTAIN_LEVEL, DEFAULT_MAX_CAPTAIN_LEVEL } from './captains.js';
import { MAX_PERK_POINTS, PERKS } from './perks.js';
import { validateData } from './validate.js';

export const GAME_DATA = Object.freeze({
  captains: CAPTAINS,
  perks: PERKS,
  maxPerkPoints: MAX_PERK_POINTS,
  damagePerCaptainLevel: DAMAGE_PER_CAPTAIN_LEVEL,
  defaultMaxCaptainLevel: DEFAULT_MAX_CAPTAIN_LEVEL,
});

export const DATA_PROBLEMS = validateData(GAME_DATA);
