// Bundle server (beserta @kb/shared) ke dist/index.js; dependensi npm tetap eksternal.
import { build } from 'esbuild';
import { cpSync, readFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
rmSync('dist', { recursive: true, force: true });
// commit Git untuk halaman versi: dari GIT_SHA (build Docker) atau repo lokal
let commit = process.env.GIT_SHA ?? '';
if (!commit) { try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { commit = ''; } }
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist/index.js',
  external: Object.keys(pkg.dependencies),
  sourcemap: true,
  define: { __BUILD_COMMIT__: JSON.stringify(commit), __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
cpSync('src/db/migrations', 'dist/migrations', { recursive: true });
console.log(`server: dist/index.js siap (commit ${commit || 'tidak diketahui'})`);
