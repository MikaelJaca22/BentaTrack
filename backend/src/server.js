import app from './app.js';
import env from './config/env.js';
import { migrate } from './db/migrate.js';

// Run migrations automatically on boot (tables only, no seed rows).
migrate();

app.listen(env.port, () => {
  console.log(`🚀 Server ready at http://localhost:${env.port}`);
  console.log(`📌 Environment: ${env.nodeEnv}`);
});
