import http from 'http';
import { Server } from 'socket.io';
import { env } from './config/env';
import { createApp } from './app';
import { setIO } from './lib/socket';

const app = createApp();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()) },
});

io.on('connection', (socket) => {
  // A TV board subscribes to its line; it then receives live `line:update` events.
  socket.on('join:line', (lineId: string) => {
    if (typeof lineId === 'string') socket.join(`line:${lineId}`);
  });
  socket.on('leave:line', (lineId: string) => {
    if (typeof lineId === 'string') socket.leave(`line:${lineId}`);
  });
});

setIO(io);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`▲ Ananta MES API on http://localhost:${env.PORT}  (${env.NODE_ENV})`);
});
