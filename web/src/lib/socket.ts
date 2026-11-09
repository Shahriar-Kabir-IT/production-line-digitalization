import { io } from 'socket.io-client';
import { API_ORIGIN } from '../api/client';

// With an empty API_ORIGIN, connect to the page's own origin (same-origin behind nginx).
export const socket = io(API_ORIGIN || undefined, { autoConnect: true, transports: ['websocket', 'polling'] });
