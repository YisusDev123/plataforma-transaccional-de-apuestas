import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function createDemoProxy() {
  return {
    target: 'http://127.0.0.1:2100',
    changeOrigin: false,
    rewrite: (path) => path.replace(/^\/api/, ''),
    cookiePathRewrite: {
      '/auth': '/api/auth',
      '/admin': '/api/admin',
    },
  }
}

export default defineConfig(({ mode }) => {
  const demoProxy = mode === 'demo' ? { '/api': createDemoProxy() } : undefined

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      strictPort: true,
      host: mode === 'demo' ? '127.0.0.1' : undefined,
      allowedHosts: mode === 'demo' ? ['.trycloudflare.com'] : undefined,
      proxy: demoProxy,
    },
    preview: {
      port: mode === 'demo' ? 3100 : 4173,
      strictPort: true,
      host: '127.0.0.1',
      allowedHosts: mode === 'demo' ? ['.trycloudflare.com'] : undefined,
      proxy: demoProxy,
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{js,jsx}'],
      setupFiles: './src/test/setup.js',
    },
  }
})
