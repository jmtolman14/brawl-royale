// Collects keyboard, mouse and gamepad input and produces InputFrames for the sim.
// UI-only keys (map, pause, lock-on) are surfaced as callbacks.
import { useSettings } from '../store/settings';
import { emptyInput, type InputFrame } from '../sim/types';

type EdgeKey = 'light' | 'heavy' | 'dodge' | 'grapple' | 'jump' | 'signature' | 'throwItem' | 'useItem';

const KEYMAP: Record<string, EdgeKey | 'block' | 'sprint' | undefined> = {
  Space: 'jump',
  KeyC: 'dodge',
  ControlLeft: 'dodge',
  ControlRight: 'dodge',
  KeyQ: 'block',
  KeyE: 'grapple',
  KeyF: 'signature',
  KeyR: 'useItem',
  KeyG: 'throwItem',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
};

export interface UiCallbacks {
  onMap?: () => void;
  onPause?: () => void;
  onLock?: () => void;
}

export class InputManager {
  keys = new Set<string>();
  edges = new Set<EdgeKey>();
  slot = -1;
  wheel = 0;
  yaw = 0;
  pitch = 0.25;
  mouseLeft = false;
  mouseRight = false;
  ui: UiCallbacks = {};
  enabled = true;
  private el: HTMLElement | null = null;
  private padPrev: boolean[] = [];
  usingPad = false;

  attach(el: HTMLElement) {
    this.detach();
    this.el = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    el.addEventListener('wheel', this.onWheel, { passive: true });
    el.addEventListener('contextmenu', this.prevent);
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    if (this.el) {
      this.el.removeEventListener('mousedown', this.onMouseDown);
      this.el.removeEventListener('wheel', this.onWheel);
      this.el.removeEventListener('contextmenu', this.prevent);
    }
    if (document.pointerLockElement) document.exitPointerLock();
  }

  get locked() {
    return !!document.pointerLockElement;
  }

  requestLock() {
    if (this.el && !document.pointerLockElement) {
      try {
        const r = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
        r?.catch?.(() => {});
      } catch {
        /* ignore */
      }
    }
  }

  private prevent = (e: Event) => e.preventDefault();

  private onBlur = () => {
    this.keys.clear();
    this.mouseLeft = this.mouseRight = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (['Tab', 'Space', 'ControlLeft', 'KeyF', 'KeyG', 'KeyR'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    // UI keys work even while gameplay input is disabled (map/pause open)
    if (e.code === 'KeyM') this.ui.onMap?.();
    if (e.code === 'Escape' || e.code === 'KeyP') this.ui.onPause?.();
    if (!this.enabled) return;
    this.keys.add(e.code);
    this.usingPad = false;
    const k = KEYMAP[e.code];
    if (k && k !== 'block' && k !== 'sprint') this.edges.add(k);
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5)) - 1;
      if (n >= 0 && n < 5) this.slot = n;
    }
    if (e.code === 'Tab') this.ui.onLock?.();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.enabled) return;
    if (!this.locked) {
      this.requestLock();
      return;
    }
    if (e.button === 0) {
      this.mouseLeft = true;
      this.edges.add('light');
    } else if (e.button === 2) {
      this.mouseRight = true;
      this.edges.add('heavy');
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseLeft = false;
    if (e.button === 2) this.mouseRight = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked || !this.enabled) return;
    const s = useSettings.getState();
    const k = 0.0025 * s.sensitivity;
    this.yaw -= e.movementX * k;
    this.pitch += e.movementY * k * (s.invertY ? -1 : 1);
    this.pitch = Math.max(-0.35, Math.min(1.2, this.pitch));
  };

  private onWheel = (e: WheelEvent) => {
    this.wheel = Math.sign(e.deltaY);
  };

  private pollPad(dt: number, f: InputFrame) {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = pads.find((p) => p && p.connected);
    if (!gp) return;
    const dead = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    const lx = dead(gp.axes[0] ?? 0), ly = dead(gp.axes[1] ?? 0);
    const rx = dead(gp.axes[2] ?? 0), ry = dead(gp.axes[3] ?? 0);
    const b = gp.buttons.map((x) => x.pressed);
    const edge = (i: number) => b[i] && !this.padPrev[i];
    if (lx || ly || rx || ry || b.some(Boolean)) this.usingPad = true;
    if (!this.usingPad) return;
    const s = useSettings.getState();
    this.yaw -= rx * dt * 2.6 * s.sensitivity;
    this.pitch = Math.max(-0.35, Math.min(1.2, this.pitch + ry * dt * 1.8 * s.sensitivity * (s.invertY ? -1 : 1)));
    if (lx || ly) {
      f.moveX = lx;
      f.moveZ = -ly;
    }
    // Standard mapping: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 9 Start, 10 LS, 11 RS, 12-15 dpad
    if (edge(0)) f.jump = true;
    if (edge(2)) f.light = true;
    if (edge(3)) f.heavy = true;
    if (edge(1)) f.dodge = true;
    if (edge(5)) f.grapple = true;
    if (b[4]) f.block = true;
    if (edge(7)) f.signature = true;
    if (edge(6)) f.useItem = true;
    if (b[10]) f.sprint = true;
    if (edge(11)) this.ui.onLock?.();
    if (edge(9)) this.ui.onPause?.();
    if (edge(8)) this.ui.onMap?.();
    if (edge(13)) f.throwItem = true;
    if (edge(15)) f.slot = 99; // next slot
    if (edge(14)) f.slot = 98; // prev slot
    this.padPrev = b;
  }

  /** Build this frame's InputFrame and clear edge-triggered state. */
  sample(dt: number, lockTarget: number, currentSlot: number): InputFrame {
    const f = emptyInput();
    if (this.enabled) {
      const k = this.keys;
      f.moveX = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      f.moveZ = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
      f.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
      f.block = k.has('KeyQ');
      for (const e of this.edges) f[e] = true;
      this.pollPad(dt, f);
      if (this.slot >= 0) f.slot = this.slot;
      else if (this.wheel > 0 || f.slot === 99) f.slot = (currentSlot + 1) % 5;
      else if (this.wheel < 0 || f.slot === 98) f.slot = (currentSlot + 4) % 5;
      else if (f.slot > 5) f.slot = -1;
    }
    this.edges.clear();
    this.slot = -1;
    this.wheel = 0;
    f.yaw = this.yaw;
    f.lockTarget = lockTarget;
    return f;
  }
}
