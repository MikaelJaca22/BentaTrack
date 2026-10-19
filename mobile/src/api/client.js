import axios from 'axios';
import { API_URL } from '../config.js';
import { getToken } from './tokenStore.js';

const client = axios.create({ baseURL: API_URL });

// Attach the JWT from secure store to every request.
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Called by AuthContext to react to expired sessions.
let onUnauthorized = null;
export function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response && error.response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

// Normalize an axios error into { message, field }.
export function extractError(error) {
  const resp = error && error.response ? error.response : null;
  if (resp && resp.data && resp.data.error) {
    return {
      message: resp.data.error.message || 'Something went wrong',
      field: resp.data.error.field,
    };
  }
  if (error && error.message === 'Network Error') {
    return { message: 'Cannot reach the server. Check the API URL and that the backend is running.' };
  }
  return { message: 'Something went wrong' };
}

export default client;
