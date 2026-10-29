// `npm run dev:all` runs this. It starts the two things the project needs and prints their messages in one terminal,
// each line labelled so you can tell them apart:
//   live-api  the backend on port 4300 (needs MongoDB running on 127.0.0.1:27017)
//   vite      the website on port 5173
// Ctrl+C stops both. If the backend dies (MongoDB missing, port taken) the website is stopped too, because it
// would be useless without it.
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
    // a non-zero exit of the backend means it crashed: take everything down and report the same exit code
    if (label.startsWith('live') && code) { children.forEach((c) => c.kill()); process.exit(code); }
  });
  return child;
});
const stop = () => { children.forEach((c) => c.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
