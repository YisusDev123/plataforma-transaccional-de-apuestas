import { preview } from 'vite'

export default async function startPreviewServer(config) {
  const baseURL = config.projects[0]?.use?.baseURL
  if (!baseURL) throw new Error('La configuración de Playwright requiere baseURL para iniciar preview.')
  const url = new URL(baseURL)
  const server = await preview({
    logLevel: 'error',
    preview: {
      host: url.hostname,
      port: Number(url.port),
      strictPort: true,
    },
  })
  return async () => {
    await server.close()
  }
}
