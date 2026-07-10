import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function getBuildMetadata() {
  let commitHash = 'unknown';
  try {
    commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {}

  const now = new Date();
  const buildTime =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return { commitHash, buildTime };
}

const { commitHash, buildTime } = getBuildMetadata();

export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify(commitHash),
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  // Cloudflare Pages expects all routes to serve index.html for SPA routing
  appType: 'spa',
});
