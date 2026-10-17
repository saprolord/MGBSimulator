/**
 * SKILLS VIEW
 * ===========
 * Captain picker, captain level and the list of that captain's skills to tick. Edits the loadout
 * it is given and calls `onChange` after every edit. Re-renders from the loadout, so it always
 * shows the truth.
 */

import { findCaptain, maxLevelOf } from '../loadout/loadout.js';

export class SkillsView {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container
   * @param {object} options.loadout       the shared loadout (edited in place)
   * @param {object} options.data          GAME_DATA (captains, damagePerCaptainLevel, ...)
   * @param {() => void} options.onChange
   */
  constructor({ container, loadout, data, onChange }) {
    Object.assign(this, { container, loadout, data, onChange });
    this.render();
  }

  render() {
    const { loadout, data } = this;
    const captain = findCaptain(loadout.captainId, data);

    const select = document.createElement('select');
    select.id = 'captain-select';
    select.append(new Option('No captain', ''));
    for (const c of data.captains) select.append(new Option(c.name, c.id, false, c.id === loadout.captainId));
    select.addEventListener('change', () => {
      loadout.captainId = select.value || null;
      loadout.captainLevel = Math.min(loadout.captainLevel, maxLevelOf(findCaptain(loadout.captainId, data), data));
      this.#changed();
    });

    const level = document.createElement('input');
    level.type = 'number';
    level.id = 'captain-level';
    level.min = 0;
    level.max = maxLevelOf(captain, data);
    level.step = 1;
    level.value = loadout.captainLevel;
    level.disabled = !captain;
    level.addEventListener('change', () => {
      const typed = parseInt(level.value, 10) || 0;
      loadout.captainLevel = Math.max(0, Math.min(maxLevelOf(findCaptain(loadout.captainId, data), data), typed));
      level.value = loadout.captainLevel;
      this.#changed(false); // no need to rebuild the list while typing a number
    });

    const controls = document.createElement('div');
    controls.className = 'skills-controls';
    controls.append(this.#labelled('Captain', select), this.#labelled('Level', level));

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = captain
      ? `Each captain level gives +${data.damagePerCaptainLevel} base damage on every ship. Only this captain's skills apply.`
      : 'Choose a captain to set their level and tick their skills.';

    this.container.replaceChildren(controls, hint, ...(captain ? [this.#skillList(captain)] : []));
  }

  #skillList(captain) {
    const list = document.createElement('ul');
    list.className = 'skill-list';

    for (const skill of captain.skills ?? []) {
      const item = document.createElement('li');
      item.className = 'skill-item' + (skill.visualOnly ? ' visual-only' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.loadout.skills.has(skill.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.loadout.skills.add(skill.id);
        else this.loadout.skills.delete(skill.id);
        this.#changed(false);
      });

      const name = document.createElement('span');
      name.className = 'skill-name';
      name.textContent = skill.name + (skill.visualOnly ? ' (no effect on damage)' : '');
      const description = document.createElement('span');
      description.className = 'skill-desc';
      description.textContent = skill.description ?? '';

      const text = document.createElement('span');
      text.append(name, description);
      const label = document.createElement('label');
      label.append(checkbox, text);
      item.append(label);
      list.append(item);
    }
    return list;
  }

  #labelled(text, control) {
    const label = document.createElement('label');
    label.append(text, control);
    return label;
  }

  #changed(rerender = true) {
    if (rerender) this.render();
    this.onChange();
  }
}
