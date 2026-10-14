// Starts the whole project with one command:  npm run dev:all
//   live-api (port 4300)  real Open-Meteo weather, stored in MongoDB (needs MongoDB on 127.0.0.1:27017)
//   vite     (port 5173)  the React app
// The older lab back ends (api/, api-express/, api-mongo/) have their own scripts, see the README.
import { spawn } from 'node:child_process';

const jobs = [
  ['live-api', 'node', ['live-api/server.js']],
  ['vite    ', 'node', ['node_modules/vite/bin/vite.js']],
];
const children = jobs.map(([label, cmd, args]) => {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = (chunk) => String(chunk).split(/\r?\n/).filter(Boolean).forEach((l) => console.log(`[${label}] ${l}`));
  child.stdout.on('data', tag);
  child.stderr.on('data', tag);
  child.on('exit', (code) => {
    console.log(`[${label}] exited (${code})`);
    if (label.startsWith('live') && code) { children.forEach((c) => c.kill()); process.exit(code); }
  });
  return child;
});
const stop = () => { children.forEach((c) => c.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
