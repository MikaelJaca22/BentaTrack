import os from 'node:os';
import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Drop Vite's "VITE v5.x ready in Nms" banner; everything else (HMR updates,
// warnings, errors) still prints. ANSI codes are stripped before matching.
const logger = createLogger('info', { allowClearScreen: false });
const logInfo = logger.info;
const ANSI = /\u001B\[[0-9;]*m/g;
logger.info = (msg, options) => {
  if (typeof msg === 'string' && /VITE v[\d.]+\s+ready in/.test(msg.replace(ANSI, ''))) {
    return;
  }
  logInfo(msg, options);
};

function networkUrl(port) {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return `http://${address.address}:${port}/`;
      }
    }
  }
  return null;
}

// Single clean banner in place of Vite's default startup output.
function startupBanner() {
  return {
    name: 'bentatrack-startup-banner',
    configureServer(server) {
      // Vite 5 prints its own URL list after listen(); silence it.
      server.printUrls = () => {};

      server.httpServer?.once('listening', () => {
        const { port } = server.httpServer.address();
        const network = networkUrl(port);

        console.log('');
        console.log('🚀 App running successfully!\n');
        console.log(`  ➜  Local:   http://localhost:${port}/`);
        if (network) console.log(`  ➜  Network: ${network}`);
        console.log('\n  Press Ctrl+C to stop the server');
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), startupBanner()],
  customLogger: logger,
  server: {
    port: 3000,
    host: true,
    printUrls: false,
  },
});