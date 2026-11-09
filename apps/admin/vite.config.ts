import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/admin/',
  plugins: [svelte()],
  server: {
    port: 5174,
    host: true,
    proxy: { '/api': 'http://localhost:8787', '/media': 'http://localhost:8787' },
  },
  build: { target: 'es2020' },
});
