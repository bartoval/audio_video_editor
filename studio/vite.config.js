import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CERTS_DIR = path.resolve(PROJECT_ROOT, 'certs');

// Use HTTPS if certificates exist
const httpsConfig = fs.existsSync(path.join(CERTS_DIR, 'key.pem'))
  ? {
      key: fs.readFileSync(path.join(CERTS_DIR, 'key.pem')),
      cert: fs.readFileSync(path.join(CERTS_DIR, 'cert.pem'))
    }
  : false;

// API target: use 'api' hostname in Docker, 'localhost' otherwise
const API_TARGET = process.env.VITE_API_URL || 'http://localhost:8080';

export default defineConfig({
  server: {
    port: 8081,
    host: true, // Listen on all addresses (needed for Docker)
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true
      }
    },
    fs: {
      strict: false
    }
  },
  assetsInclude: ['**/*.wasm'],
  base: '/',
  build: {
    outDir: path.resolve(PROJECT_ROOT, 'public'),
    emptyOutDir: false
  }
});
