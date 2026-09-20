import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = await readFile(resolve(root, 'public/pwa/icon-source.svg'), 'utf8')
const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
]

const browser = await chromium.launch()
try {
  for (const [name, size, maskable] of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(`<style>html,body,svg{display:block;width:100%;height:100%;margin:0}${maskable ? 'body{background:#0b0d1a}' : ''}</style>${source}`)
    await page.screenshot({ path: resolve(root, 'public/pwa', name), omitBackground: !maskable })
    await page.close()
  }
} finally {
  await browser.close()
}

console.log(`Iconos PWA generados: ${targets.length}`)
