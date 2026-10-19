import app from './app.js';
import env from './config/env.js';
import { migrate } from './db/migrate.js';

// Run migrations automatically on boot (tables only, no seed rows).
migrate();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `BentaTrack API listening on http://localhost:${env.port} (DB: ${env.dbPath})`
  );
});
