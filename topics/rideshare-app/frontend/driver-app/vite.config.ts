import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api/trip':  { target: 'http://localhost:3004', rewrite: p => p.replace(/^\/api\/trip/, '') },
      '/api/price': { target: 'http://localhost:3003', rewrite: p => p.replace(/^\/api\/price/, '') },
    },
  },
});
