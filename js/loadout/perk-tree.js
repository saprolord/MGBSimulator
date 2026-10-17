/**
 * PERK TREE RULES
 * ===============
 * The perk map is a graph. A perk can be unlocked when its prerequisites are unlocked:
 *
 *   requires: []              a starting perk (root): always available
 *   requires: ['a', 'b']      available once ANY of a, b is unlocked   (several paths lead here)
 *   requires: [...], requiresAll: true   available once ALL of them are unlocked
 *
 * Every unlock costs `cost` perk points (default 1) out of `maxPoints`.
 * A perk can only be refunded if everything still unlocked stays reachable from a root
 * (you cannot pull out the middle of a path).
 *
 * Pure logic, no DOM. `unlocked` is a Set of perk ids and is never mutated: the functions that
 * change it return a NEW Set (or null when the action is not allowed).
 */

export function createPerkTree(perks, maxPoints) {
  const byId = new Map(perks.map((perk) => [perk.id, perk]));
  const costOf = (perk) => perk.cost ?? 1;

  const prerequisitesMet = (perk, unlocked) => {
    if (!perk.requires || perk.requires.length === 0) return true;
    return perk.requiresAll
      ? perk.requires.every((id) => unlocked.has(id))
      : perk.requires.some((id) => unlocked.has(id));
  };

  const pointsUsed = (unlocked) => {
    let total = 0;
    for (const id of unlocked) total += costOf(byId.get(id));
    return total;
  };

  /** Everything in `ids` that can be reached by unlocking in order from the roots. */
  const reachable = (ids) => {
    const result = new Set();
    let grew = true;
    while (grew) {
      grew = false;
      for (const id of ids) {
        if (!result.has(id) && prerequisitesMet(byId.get(id), result)) {
          result.add(id);
          grew = true;
        }
      }
    }
    return result;
  };

  /** Why a perk cannot be unlocked right now, or null if it can. */
  function whyNotUnlock(unlocked, id) {
    const perk = byId.get(id);
    if (!perk) return 'Unknown perk.';
    if (unlocked.has(id)) return 'Already unlocked.';
    if (!prerequisitesMet(perk, unlocked)) return 'Unlock a connected perk first.';
    if (pointsUsed(unlocked) + costOf(perk) > maxPoints) return 'No perk points left.';
    return null;
  }

  /** Why a perk cannot be refunded right now, or null if it can. */
  function whyNotRefund(unlocked, id) {
    if (!unlocked.has(id)) return 'Not unlocked.';
    const rest = new Set(unlocked);
    rest.delete(id);
    return reachable(rest).size === rest.size ? null : 'Other unlocked perks depend on this one.';
  }

  return {
    byId,
    maxPoints,
    pointsUsed,
    pointsLeft: (unlocked) => maxPoints - pointsUsed(unlocked),

    isAvailable: (unlocked, id) => whyNotUnlock(unlocked, id) === null,
    whyNotUnlock,
    whyNotRefund,

    unlock(unlocked, id) {
      if (whyNotUnlock(unlocked, id) !== null) return null;
      return new Set(unlocked).add(id);
    },

    refund(unlocked, id) {
      if (whyNotRefund(unlocked, id) !== null) return null;
      const next = new Set(unlocked);
      next.delete(id);
      return next;
    },

    /**
     * Clean up a saved selection: drops unknown perks, anything unreachable, and anything over the
     * point limit (keeping the earliest ones in the given order).
     */
    sanitize(ids) {
      const wanted = [...new Set(ids)].filter((id) => byId.has(id));
      let result = new Set();
      let grew = true;
      while (grew) {
        grew = false;
        for (const id of wanted) {
          const next = this.unlock(result, id);
          if (next) {
            result = next;
            grew = true;
          }
        }
      }
      return result;
    },
  };
}
