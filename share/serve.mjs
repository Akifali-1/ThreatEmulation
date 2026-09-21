import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Minimal static server with SPA fallback, for checking the snapshot without a backend. */

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site')
const PORT = Number(process.argv[2] ?? 4173)

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')
  let file = path.join(SITE, decodeURIComponent(pathname))

  try {
    const info = await stat(file)
    if (info.isDirectory()) file = path.join(file, 'index.html')
  } catch {
    file = path.join(SITE, 'index.html') // SPA fallback, same as the host configs
  }

  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(PORT, () => console.log(`snapshot on http://localhost:${PORT}`))
