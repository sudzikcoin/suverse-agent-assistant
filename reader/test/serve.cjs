// A local server for the synthetic fixtures: the tests never touch the network.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
exports.serve = (dir) => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (p === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('User-agent: *\nAllow: /\n') }
    const file = p === '/' ? 'index.html' : p.endsWith('.json') ? p.slice(1) : `${p.slice(1).replace(/\/$/, '')}.html`
    const full = path.join(dir, file)
    if (!full.startsWith(dir) || !fs.existsSync(full)) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('<h1>Not found</h1>') }
    res.writeHead(200, { 'content-type': file.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' })
    res.end(fs.readFileSync(full))
  })
  server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() }))
})
