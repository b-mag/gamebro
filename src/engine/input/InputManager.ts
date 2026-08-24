import type { GBButton, InputState } from '../core/types';

/**
 * Maps keyboard to Game Boy controls.
 *
 * | GB Button | Keys              |
 * |-----------|-------------------|
 * | D-Pad Up  | ArrowUp, W        |
 * | D-Pad Down| ArrowDown, S      |
 * | D-Pad Left| ArrowLeft, A      |
 * | D-Pad Right| ArrowRight, D    |
 * | A         | Z, Space, J       |
 * | B         | X, C, K           |
 * | Start     | Enter, Return     |
 * | Select    | Tab, Backspace    |
 * | Alt (hold)| Shift (L/R)       |
 */
const KEY_MAP: Record<string, GBButton> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
  z: 'a',
  Z: 'a',
  ' ': 'a',
  j: 'a',
  J: 'a',
  x: 'b',
  X: 'b',
  c: 'b',
  C: 'b',
  k: 'b',
  K: 'b',
  Enter: 'start',
  Tab: 'select',
  Backspace: 'select',
};

export class InputManager {
  private held = new Set<GBButton>();
  private pressed = new Set<GBButton>();
  private released = new Set<GBButton>();
  private altHeld = false;
  private bound = false;
  private onKeyDown = (e: KeyboardEvent) => this.handleKey(e, true);
  private onKeyUp = (e: KeyboardEvent) => this.handleKey(e, false);

  attach(): void {
    if (this.bound || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.bound = true;
  }

  detach(): void {
    if (!this.bound || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.bound = false;
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
    this.altHeld = false;
  }

  /** Consume input state for this frame; clears edge triggers afterward. */
  poll(): InputState {
    const state: InputState = {
      held: new Set(this.held),
      pressed: new Set(this.pressed),
      released: new Set(this.released),
      altHeld: this.altHeld,
    };
    this.pressed.clear();
    this.released.clear();
    return state;
  }

  /** Peek without clearing edge triggers. */
  peek(): InputState {
    return {
      held: new Set(this.held),
      pressed: new Set(this.pressed),
      released: new Set(this.released),
      altHeld: this.altHeld,
    };
  }

  private handleKey(e: KeyboardEvent, down: boolean): void {
    if (e.key === 'Shift') {
      this.altHeld = down;
      return;
    }

    const button = KEY_MAP[e.key];
    if (!button) return;

    // Prevent page scroll / browser shortcuts for game keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }

    if (down) {
      if (!this.held.has(button)) {
        this.pressed.add(button);
      }
      this.held.add(button);
    } else {
      if (this.held.has(button)) {
        this.released.add(button);
      }
      this.held.delete(button);
    }
  }
}
