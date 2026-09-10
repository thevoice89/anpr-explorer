import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

/**
 * Client axios condiviso. `withCredentials: true` è indispensabile perché la sessione
 * è basata su cookie httpOnly: senza questo flag il browser non invierebbe il cookie
 * nelle richieste cross-origin verso il backend.
 */
export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});
