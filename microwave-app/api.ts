export type OvenState = 'Off' | 'Idle' | 'Cooking' | 'Paused' | 'Door_Open' | 'Done';
export type DoorState = 'Closed' | 'Open';
export type MagnetronState = 'Off' | 'On';
export type TimerState = 'Inactive' | 'Running' | 'Paused' | 'Expired';

export interface OvenStatus {
  display: string;
  oven_state: OvenState;
  door_state: DoorState;
  timer_state: TimerState;
  timer_remaining: number;
  magnetron_state: MagnetronState;
  magnetron_power: number;
  cook_time: number;
  power_level: number;
}

// Mac's LAN IP — phone and Mac must be on the same WiFi network
const BASE_URL = 'http://192.168.100.98:8000';

export async function fetchStatus(): Promise<OvenStatus> {
  const res = await fetch(`${BASE_URL}/status/`);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json();
}

export async function sendAction(
  action: string,
  extras?: Record<string, unknown>,
): Promise<OvenStatus> {
  const res = await fetch(`${BASE_URL}/action/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extras }),
  });
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json();
}
