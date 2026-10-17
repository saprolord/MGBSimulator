/**
 * PERKS VIEW
 * ==========
 * Draws the perk tree as an SVG hexagon map and handles clicking. The rules (what can be unlocked
 * or refunded) live in loadout/perk-tree.js; this file only draws and forwards clicks.
 *
 * Hex states:  unlocked (filled)  ·  available (bright outline)  ·  locked (dimmed)
 *              visual-only perks have a dashed outline.
 */

import { imageUrl } from './assets.js';

const SVG = 'http://www.w3.org/2000/svg';
const HEX_RADIUS = 30; // centre to corner, in SVG units
const PADDING = 12;
const SQRT3 = Math.sqrt(3);

const svgElement = (tag, attributes = {}) => {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
};

/** Centre of a pointy-top hex from its axial coordinates. */
const hexCentre = (q, r) => ({ x: HEX_RADIUS * SQRT3 * (q + r / 2), y: HEX_RADIUS * 1.5 * r });

const hexPoints = (cx, cy) =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + HEX_RADIUS * Math.cos(angle)).toFixed(1)},${(cy + HEX_RADIUS * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');

const initials = (name) =>
  name.replace(/^example\s+/i, '').split(/\s+/).map((word) => word[0]).join('').slice(0, 3).toUpperCase();

export class PerksView {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container     where the SVG goes
   * @param {HTMLElement} options.pointsLabel   shows "Perk points: 2 / 8"
   * @param {HTMLElement} options.resetButton
   * @param {object} options.tree               createPerkTree(...) from loadout/perk-tree.js
   * @param {object[]} options.perks            the perk data
   * @param {object} options.loadout            shared loadout (perks Set is replaced on change)
   * @param {(message: string) => void} options.notify  short user message (why a click did nothing)
   * @param {() => void} options.onChange
   */
  constructor({ container, pointsLabel, resetButton, tree, perks, loadout, notify, onChange }) {
    Object.assign(this, { container, pointsLabel, tree, perks, loadout, notify, onChange });
    this.container.addEventListener('click', (event) => this.#onClick(event));
    this.container.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.#onClick(event);
      }
    });
    resetButton.addEventListener('click', () => {
      this.loadout.perks = new Set();
      this.render();
      this.onChange();
    });
    this.render();
  }

  render() {
    const { perks, tree, loadout } = this;
    const unlocked = loadout.perks;

    this.pointsLabel.textContent = `Perk points: ${tree.pointsUsed(unlocked)} / ${tree.maxPoints}`;
    if (perks.length === 0) {
      this.container.replaceChildren();
      return;
    }

    const centres = new Map(perks.map((perk) => [perk.id, hexCentre(perk.q, perk.r)]));
    const xs = [...centres.values()].map((c) => c.x);
    const ys = [...centres.values()].map((c) => c.y);
    const width = Math.max(...xs) - Math.min(...xs) + 2 * (HEX_RADIUS * SQRT3 / 2 + PADDING);
    const height = Math.max(...ys) - Math.min(...ys) + 2 * (HEX_RADIUS + PADDING);
    const minX = Math.min(...xs) - HEX_RADIUS * SQRT3 / 2 - PADDING;
    const minY = Math.min(...ys) - HEX_RADIUS - PADDING;

    const svg = svgElement('svg', {
      viewBox: `${minX} ${minY} ${width} ${height}`,
      width: Math.round(width),
      role: 'group',
      'aria-label': 'Perk tree',
    });

    // Lines first, so the hexagons sit on top of them.
    for (const perk of perks) {
      for (const required of perk.requires ?? []) {
        const from = centres.get(required);
        const to = centres.get(perk.id);
        if (!from) continue;
        const bothUnlocked = unlocked.has(required) && unlocked.has(perk.id);
        svg.append(svgElement('line', {
          class: 'perk-link' + (bothUnlocked ? ' active' : ''),
          x1: from.x, y1: from.y, x2: to.x, y2: to.y,
        }));
      }
    }

    for (const perk of perks) svg.append(this.#hex(perk, centres.get(perk.id), unlocked));
    this.container.replaceChildren(svg);
  }

  #hex(perk, { x, y }, unlocked) {
    const state = unlocked.has(perk.id) ? 'unlocked' : this.tree.isAvailable(unlocked, perk.id) ? 'available' : 'locked';
    const group = svgElement('g', {
      class: `perk-hex ${state}${perk.visualOnly ? ' visual' : ''}`,
      'data-perk': perk.id,
      tabindex: state === 'locked' ? -1 : 0,
      role: 'button',
      'aria-pressed': String(state === 'unlocked'),
      'aria-label': `${perk.name}, ${state}`,
    });

    const title = svgElement('title');
    title.textContent = [perk.name, perk.description, perk.visualOnly ? '(no effect on damage)' : null, `Cost: ${perk.cost ?? 1}`]
      .filter(Boolean).join('\n');
    group.append(title, svgElement('polygon', { points: hexPoints(x, y) }));

    if (perk.image) {
      const size = HEX_RADIUS * 1.2;
      group.append(svgElement('image', { href: imageUrl(perk.image), x: x - size / 2, y: y - size / 2, width: size, height: size }));
    } else {
      const label = svgElement('text', { x, y });
      label.textContent = perk.label ?? initials(perk.name);
      group.append(label);
    }
    return group;
  }

  #onClick(event) {
    const hex = event.target.closest?.('[data-perk]');
    if (!hex) return;
    const id = hex.dataset.perk;
    const { tree, loadout } = this;

    const wasUnlocked = loadout.perks.has(id);
    const next = wasUnlocked ? tree.refund(loadout.perks, id) : tree.unlock(loadout.perks, id);
    if (next === null) {
      this.notify(wasUnlocked ? tree.whyNotRefund(loadout.perks, id) : tree.whyNotUnlock(loadout.perks, id));
      return;
    }
    loadout.perks = next;
    this.render();
    if (event.type === 'keydown') this.container.querySelector(`[data-perk="${id}"]`)?.focus(); // keep keyboard focus
    this.onChange();
  }
}
