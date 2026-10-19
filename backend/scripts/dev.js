/**
 * Dev launcher (used by `npm run dev` via nodemon).
 *
 * Clears the terminal before booting so every restart starts from a clean
 * window, then hands control to the real server entrypoint.
 */
if (process.stdout.isTTY) {
  // \x1b[2J clear screen, \x1b[3J clear scrollback, \x1b[H move to home.
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
}

await import('../src/server.js');