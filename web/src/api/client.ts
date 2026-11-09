import axios from 'axios';

// Empty origin ⇒ same-origin relative calls (e.g. behind nginx in production).
// Local dev sets VITE_API_URL=http://localhost:4000 in web/.env.
export const API_ORIGIN = import.meta.env.VITE_API_URL ?? '';

const client = axios.create({ baseURL: `${API_ORIGIN}/api` });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('mes_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default client;
