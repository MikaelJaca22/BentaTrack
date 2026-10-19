import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'bentatrack_token';

// In-memory copy so the axios request interceptor can read it synchronously.
let currentToken = null;

export function getToken() {
  return currentToken;
}

export function setToken(token) {
  currentToken = token;
}

export async function loadToken() {
  try {
    currentToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    currentToken = null;
  }
  return currentToken;
}

export async function saveToken(token) {
  currentToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  currentToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
