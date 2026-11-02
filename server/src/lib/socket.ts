import type { Server } from 'socket.io';

let io: Server | null = null;

export function setIO(server: Server) {
  io = server;
}

/** Notify the TV board watching this line, and tell dashboards to refetch. */
export function emitLineUpdate(lineId: string, payload: unknown) {
  if (!io) return;
  io.to(`line:${lineId}`).emit('line:update', payload);
  io.emit('dashboard:dirty', { lineId });
}
