import { io } from 'socket.io-client';
import { API_ORIGIN } from '../api/client';

export const socket = io(API_ORIGIN, { autoConnect: true, transports: ['websocket', 'polling'] });
