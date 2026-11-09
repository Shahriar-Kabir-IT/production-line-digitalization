// A stable per-PC id that identifies this station device.
// Stored in BOTH localStorage and a long-lived cookie, and read from either, so
// clearing one (e.g. browser storage) does not drop the lock. The lock is keyed
// to this id on the server, never to the IP (many PCs share one IP behind a NAT).
const KEY = 'mes_device_id';
const TEN_YEARS = 10 * 365 * 24 * 60 * 60;

function readCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}
function writeCookie(name: string, val: string): void {
  try {
    document.cookie = `${name}=${encodeURIComponent(val)}; path=/; max-age=${TEN_YEARS}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY) || readCookie(KEY);
    if (!id) {
      id = crypto?.randomUUID ? crypto.randomUUID() : `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    }
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
    writeCookie(KEY, id); // mirror so a localStorage clear can't lose the lock
    return id;
  } catch {
    return 'dev-ephemeral';
  }
}
