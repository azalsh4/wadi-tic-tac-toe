export type OvenState = 'Off' | 'Idle' | 'Cooking' | 'Paused' | 'Door_Open' | 'Done';
export type DoorState = 'Closed' | 'Open';
export type MagnetronState = 'Off' | 'On';
export type TimerState = 'Inactive' | 'Running' | 'Paused' | 'Expired';

export interface OvenStatus {
  display: string;
  ovenState: OvenState;
  doorState: DoorState;
  timerState: TimerState;
  timerRemaining: number;
  magnetronState: MagnetronState;
  magnetronPower: number;
  cookTime: number;
  powerLevel: number;
}

type ChangeListener = (status: OvenStatus) => void;

class Magnetron {
  powerLevel = 0;
  state: MagnetronState = 'Off';

  activate(power: number) {
    if (this.state === 'Off') {
      this.powerLevel = power;
      this.state = 'On';
    }
  }

  deactivate() {
    if (this.state === 'On') {
      this.powerLevel = 0;
      this.state = 'Off';
    }
  }
}

class Timer {
  duration = 0;
  remaining = 0;
  state: TimerState = 'Inactive';
  private _interval: ReturnType<typeof setInterval> | null = null;
  private _onExpire: () => void;
  private _onTick: (remaining: number) => void;

  constructor(onExpire: () => void, onTick: (remaining: number) => void) {
    this._onExpire = onExpire;
    this._onTick = onTick;
  }

  start(duration: number) {
    if (this.state !== 'Inactive') return;
    this.duration = duration;
    this.remaining = duration;
    this.state = 'Running';
    this._startInterval();
  }

  pause() {
    if (this.state !== 'Running') return;
    this._clearInterval();
    this.state = 'Paused';
  }

  resume() {
    if (this.state !== 'Paused') return;
    this.state = 'Running';
    this._startInterval();
  }

  cancel() {
    this._clearInterval();
    this.remaining = 0;
    this.duration = 0;
    this.state = 'Inactive';
  }

  private _startInterval() {
    this._interval = setInterval(() => {
      if (this.remaining > 0) {
        this.remaining -= 1;
        this._onTick(this.remaining);
      }
      if (this.remaining <= 0) {
        this._clearInterval();
        this.state = 'Expired';
        this._onExpire();
      }
    }, 1000);
  }

  private _clearInterval() {
    if (this._interval !== null) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }
}

export class MicrowaveOven {
  display = 'OFF';
  state: OvenState = 'Off';
  cookTime = 0;
  powerLevel = 0;

  readonly magnetron = new Magnetron();
  readonly timer: Timer;
  doorState: DoorState = 'Closed';

  private _listeners: ChangeListener[] = [];

  constructor() {
    this.timer = new Timer(
      () => this._onTimerExpired(),
      (remaining) => {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        this.display = `${m}:${s.toString().padStart(2, '0')}`;
        this.cookTime = remaining;
        this._notify();
      },
    );
  }

  onChange(fn: ChangeListener) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  }

  private _notify() {
    const status = this.getStatus();
    this._listeners.forEach(fn => fn(status));
  }

  getStatus(): OvenStatus {
    return {
      display: this.display,
      ovenState: this.state,
      doorState: this.doorState,
      timerState: this.timer.state,
      timerRemaining: this.timer.remaining,
      magnetronState: this.magnetron.state,
      magnetronPower: this.magnetron.powerLevel,
      cookTime: this.cookTime,
      powerLevel: this.powerLevel,
    };
  }

  powerOn() {
    if (this.state !== 'Off') return;
    this.state = 'Idle';
    this.display = '0:00';
    this.cookTime = 0;
    this._notify();
  }

  powerOff() {
    if (this.state !== 'Idle') return;
    this.state = 'Off';
    this.display = 'OFF';
    this.cookTime = 0;
    this.powerLevel = 0;
    this.magnetron.deactivate();
    this.timer.cancel();
    this._notify();
  }

  openDoor() {
    if (this.doorState === 'Open') return;
    this.doorState = 'Open';
    if (this.state === 'Idle') {
      this.state = 'Door_Open';
      this.display = 'DOOR OPEN';
      this.timer.cancel();
      this.magnetron.deactivate();
    } else if (this.state === 'Cooking') {
      this.state = 'Paused';
      this.display = 'PAUSED - CLOSE DOOR';
      this.timer.pause();
      this.magnetron.deactivate();
    }
    this._notify();
  }

  closeDoor() {
    if (this.doorState === 'Closed') return;
    this.doorState = 'Closed';
    if (this.state === 'Door_Open') {
      this.state = 'Idle';
      this.display = '0:00';
      this.cookTime = 0;
    } else if (this.state === 'Paused') {
      this.state = 'Cooking';
      this.display = 'COOKING';
      this.timer.resume();
      this.magnetron.activate(this.powerLevel);
    }
    this._notify();
  }

  startCooking(cookTime: number, powerLevel = 100) {
    if (this.state !== 'Idle') return;
    this.cookTime = cookTime;
    this.powerLevel = powerLevel;
    this.state = 'Cooking';
    this.display = 'COOKING';
    this.timer.start(cookTime);
    this.magnetron.activate(powerLevel);
    this._notify();
  }

  cancel() {
    if (!['Cooking', 'Paused'].includes(this.state)) return;
    this.timer.cancel();
    this.state = 'Idle';
    this.display = '0:00';
    this.cookTime = 0;
    this.magnetron.deactivate();
    this._notify();
  }

  acknowledgeDone() {
    if (this.state !== 'Done') return;
    this.state = 'Idle';
    this.display = '0:00';
    this.cookTime = 0;
    this._notify();
  }

  private _onTimerExpired() {
    if (this.state !== 'Cooking') return;
    this.state = 'Done';
    this.display = 'DONE!';
    this.cookTime = 0;
    this.magnetron.deactivate();
    this._notify();
  }
}

export const oven = new MicrowaveOven();
