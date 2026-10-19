import axios from 'axios';
import { API_URL } from '../config.js';

export const TOKEN_KEY = 'bentatrack_token';

const client = axios.create({
  baseURL: API_URL,
});

// Attach the JWT to every request.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear the token and bounce to login.
client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

// Normalize an axios error into { message, field }.
export function extractError(error) {
  const resp = error?.response;
  if (resp && resp.data && resp.data.error) {
    return {
      message: resp.data.error.message || 'Something went wrong',
      field: resp.data.error.field,
    };
  }
  if (error?.message === 'Network Error') {
    return { message: 'Cannot reach the server. Is the backend running?' };
  }
  return { message: 'Something went wrong' };
}

export default client;
