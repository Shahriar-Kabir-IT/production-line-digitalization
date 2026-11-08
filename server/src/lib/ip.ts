import { Request } from 'express';

/** The true TCP peer address — a browser cannot spoof this (unlike X-Forwarded-For). */
export function clientIp(req: Request): string {
  let ip = (req.socket.remoteAddress || '').trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv4-mapped IPv6
  return ip;
}

/** Loopback / empty = local dev on one machine; skip IP-based lock inheritance there. */
export function isLoopback(ip: string): boolean {
  return !ip || ip === '127.0.0.1' || ip === '::1';
}
