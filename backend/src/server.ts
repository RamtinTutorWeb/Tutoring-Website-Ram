import { createApp } from './app.js';
import { configured, env } from './env.js';

const app = createApp();
const server = app.listen(env.port, () => {
  const on = Object.entries(configured())
    .map(([name, ok]) => `${name}=${ok ? 'on' : 'off'}`)
    .join(' ');
  console.log(`tutorpro-backend listening on :${env.port} (${env.nodeEnv}) ${on}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, closing server`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
