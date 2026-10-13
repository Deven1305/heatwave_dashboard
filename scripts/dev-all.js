// Starts the Node API (8100), Express API (4100) and the Vite dev server (5173) together.
// The MongoDB API (4200) is optional - start it with `npm run api-mongo` if MongoDB is running.
import { spawn } from 'node:child_process';

const jobs = [
  ['node-api   ', 'node', ['api/server.js']],
  ['express-api', 'node', ['api-express/server.js']],
  ['vite       ', 'node', ['node_modules/vite/bin/vite.js']],
];
const children = jobs.map(([label, cmd, args]) => {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = (chunk) => String(chunk).split(/\r?\n/).filter(Boolean).forEach((l) => console.log(`[${label}] ${l}`));
  child.stdout.on('data', tag);
  child.stderr.on('data', tag);
  child.on('exit', (code) => console.log(`[${label}] exited (${code})`));
  return child;
});
const stop = () => { children.forEach((c) => c.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
