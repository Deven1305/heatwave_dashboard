// Starts the whole project with one command.
//   npm run dev:all    Node API (8100) + Express/JSON API (4100) + Vite (5173)
//   npm run dev:mongo  Node API (8100) + MongoDB API (4200) + Vite (5173); the dashboard's
//                      regions and alerts are then read from / written to MongoDB.
//                      Needs MongoDB running on mongodb://127.0.0.1:27017.
import { spawn } from 'node:child_process';

const useMongo = process.argv.includes('--mongo');
const jobs = [
  ['node-api   ', 'node', ['api/server.js'], {}],
  useMongo
    ? ['mongo-api  ', 'node', ['api-mongo/server.js'], {}]
    : ['express-api', 'node', ['api-express/server.js'], {}],
  ['vite       ', 'node', ['node_modules/vite/bin/vite.js'],
    useMongo ? { VITE_EXPRESS_API_URL: 'http://localhost:4200' } : {}],
];
const children = jobs.map(([label, cmd, args, env]) => {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  const tag = (chunk) => String(chunk).split(/\r?\n/).filter(Boolean).forEach((l) => console.log(`[${label}] ${l}`));
  child.stdout.on('data', tag);
  child.stderr.on('data', tag);
  child.on('exit', (code) => console.log(`[${label}] exited (${code})`));
  return child;
});
const stop = () => { children.forEach((c) => c.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
