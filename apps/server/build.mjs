// Bundle server (beserta @kb/shared) ke dist/index.js; dependensi npm tetap eksternal.
import { build } from 'esbuild';
import { cpSync, readFileSync, rmSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
rmSync('dist', { recursive: true, force: true });
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist/index.js',
  external: Object.keys(pkg.dependencies),
  sourcemap: true,
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
cpSync('src/db/migrations', 'dist/migrations', { recursive: true });
console.log('server: dist/index.js siap');
