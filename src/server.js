import { app } from './app.js';
import { pool } from './config/db.js';
import { env } from './config/env.js';

const start = async () => {
  await pool.query('SELECT 1');

  app.listen(env.port, () => {
    console.log(`Cloud POS SaaS is running on http://localhost:${env.port}`);
  });
};

start().catch((error) => {
  console.error('Failed to start server');
  console.error(error);
  process.exit(1);
});
