// Menjalankan server API, game (Vite :5173), dan admin (Vite :5174/admin/) sekaligus.
import { spawn } from 'node:child_process';
const procs = [
  ['server', ['run', 'dev', '-w', '@kb/server'], '\x1b[36m'],
  ['game  ', ['run', 'dev', '-w', '@kb/game'], '\x1b[33m'],
  ['admin ', ['run', 'dev', '-w', '@kb/admin'], '\x1b[35m'],
];
const kids = procs.map(([name, args, color]) => {
  const p = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  const out = (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.log(`${color}[${name}]\x1b[0m ${l}`));
  p.stdout.on('data', out);
  p.stderr.on('data', out);
  return p;
});
console.log('Game: http://localhost:5173  ·  Admin: http://localhost:5174/admin/  ·  API: http://localhost:8787');
const stop = () => { kids.forEach((k) => k.kill('SIGTERM')); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
