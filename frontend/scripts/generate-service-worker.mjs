import { stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSW } from 'workbox-build'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
await stat(resolve(dist, 'index.html'))

const result = await generateSW({
  globDirectory: dist,
  globPatterns: ['**/*.{html,js,css,png,svg,webmanifest,woff,woff2}'],
  globIgnores: ['sw.js', 'workbox-*.js'],
  swDest: resolve(dist, 'sw.js'),
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: false,
  navigateFallback: '/index.html',
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  runtimeCaching: [],
  sourcemap: false,
})

console.log(`Service worker generado: ${result.count} archivos, ${result.size} bytes precacheados`)
