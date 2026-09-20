import { readdir, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const limits = { js: 100 * 1024, css: 12 * 1024 }
const assetsDirectory = path.resolve('dist/assets')
const files = await readdir(assetsDirectory)
const assets = await Promise.all(files.map(async (name) => {
  const filePath = path.join(assetsDirectory, name)
  return { name, bytes: (await stat(filePath)).size, gzip: gzipSync(await readFile(filePath)).length }
}))

const initialJs = assets.filter(({ name }) => /^index-.*\.js$/.test(name))
const initialCss = assets.filter(({ name }) => /^index-.*\.css$/.test(name))

if (initialJs.length !== 1 || initialCss.length !== 1) {
  throw new Error('No fue posible identificar exactamente un bundle inicial JS y CSS.')
}

const failures = [
  ...initialJs.filter(({ gzip }) => gzip > limits.js).map(({ name, gzip }) => `${name}: ${gzip} > ${limits.js} bytes gzip`),
  ...initialCss.filter(({ gzip }) => gzip > limits.css).map(({ name, gzip }) => `${name}: ${gzip} > ${limits.css} bytes gzip`),
]

for (const asset of [...initialJs, ...initialCss]) {
  console.log(`${asset.name}: ${(asset.bytes / 1024).toFixed(2)} kB, ${(asset.gzip / 1024).toFixed(2)} kB gzip`)
}

if (failures.length) throw new Error(`Presupuesto inicial excedido:\n${failures.join('\n')}`)
