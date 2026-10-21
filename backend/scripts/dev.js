/**
 * Dev launcher (used by `npm run dev` via nodemon).
 *
 * Hands control to the real server entrypoint.
 */
await import('../src/server.js');