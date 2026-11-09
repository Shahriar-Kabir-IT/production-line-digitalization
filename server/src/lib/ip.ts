import { Request } from 'express';

/**
 * The true client address. Behind nginx we read `X-Real-IP`, which nginx sets from
 * its own `$remote_addr` (a browser cannot spoof it because nginx overwrites it).
 * With no proxy (local dev) we fall back to the real TCP peer address.
 */
export function clientIp(req: Request): string {
  const xReal = req.headers['x-real-ip'];
  let ip = (typeof xReal === 'string' && xReal.trim()) ? xReal.trim() : (req.socket.remoteAddress || '').trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv4-mapped IPv6
  return ip;
}

/** Loopback / empty = local dev on one machine; skip IP-based lock inheritance there. */
export function isLoopback(ip: string): boolean {
  return !ip || ip === '127.0.0.1' || ip === '::1';
}
