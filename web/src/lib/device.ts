// A stable per-PC id stored in the browser; identifies this station device.
const KEY = 'mes_device_id';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto?.randomUUID ? crypto.randomUUID() : `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'dev-ephemeral';
  }
}
