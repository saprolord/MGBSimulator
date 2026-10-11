/** The "Ship" dropdown. Options come from the ship registry, so a new ship appears automatically. */

export class ShipPicker {
  /**
   * @param {HTMLSelectElement} select
   * @param {{ id: string, name: string }[]} ships
   * @param {(shipId: string) => void} onChange
   */
  constructor(select, ships, onChange) {
    this.select = select;
    const options = ships.map(({ id, name }) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = name;
      return option;
    });
    select.replaceChildren(...options);
    select.addEventListener('change', () => onChange(select.value));
  }

  /** Show the given ship as selected (does not fire onChange). */
  set value(shipId) {
    this.select.value = shipId;
  }
}
