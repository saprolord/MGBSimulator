/**
 * GAME CODE PANEL
 * ===============
 * The "paste a game code / copy the game code" row under the board. Handles the text box, the two
 * buttons and the clipboard; the actual code reading and writing lives in model/game-code.js.
 *
 *   Import  - imports what is in the box. If the box is empty it reads the clipboard instead.
 *             Pasting into the box imports straight away, and so does pressing Enter.
 *   Copy    - puts the current build's game code on the clipboard (and in the box, as a fallback
 *             for browsers that block clipboard access).
 */

export class CodePanel {
  /**
   * @param {object} handlers
   * @param {(text: string) => boolean} handlers.onImport  returns true if the code was imported
   * @param {() => string | null}       handlers.onExport  returns the code, or null if it could not be made
   * @param {(message: string) => void} handlers.notify    shows a short message to the user
   */
  constructor({ onImport, onExport, notify }) {
    const $ = (id) => document.getElementById(id);
    this.input = $('game-code-input');
    this.onImport = onImport;
    this.onExport = onExport;
    this.notify = notify;

    $('btn-import-code').addEventListener('click', () => this.#import());
    $('btn-export-code').addEventListener('click', () => this.#export());
    this.input.addEventListener('paste', () => setTimeout(() => this.#import(), 0)); // wait for the pasted text to land
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.#import();
    });
  }

  async #import() {
    let text = this.input.value.trim();
    if (!text) {
      try {
        text = await navigator.clipboard.readText();
      } catch {
        this.notify('Could not read the clipboard. Paste the code into the box instead.');
        this.input.focus();
        return;
      }
    }
    if (this.onImport(text)) this.input.value = '';
  }

  async #export() {
    const code = this.onExport();
    if (code === null) return;
    this.input.value = code;
    try {
      await navigator.clipboard.writeText(code);
      this.notify('Game code copied to clipboard!');
    } catch {
      this.input.select();
      this.notify('Could not copy automatically. The code is in the box, copy it from there.');
    }
  }
}