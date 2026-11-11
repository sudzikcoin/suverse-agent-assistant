#!/usr/bin/env node
/**
 * @suverselabs/suverse-mcp — a stdio MCP server that forwards everything to the SuVerse MCP door
 * (https://www.suverse.io/mcp, Streamable HTTP). No logic of its own, no keys: tools/list and tools/call go
 * through unchanged, so a new tool on the door appears here without an update.
 *
 *   npx -y @suverselabs/suverse-mcp            # stdio server for Claude Desktop, Cline, Cursor, …
 *   npx -y @suverselabs/suverse-mcp --tools    # print the door's tools and exit
 *
 * Env: SUVERSE_MCP_URL (or the old VERSUM_MCP_URL) to point at another door (default https://www.suverse.io/mcp).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const args = process.argv.slice(2)
const url = process.env.SUVERSE_MCP_URL || process.env.VERSUM_MCP_URL || 'https://www.suverse.io/mcp'
const log = (...a) => console.error('[versum-mcp]', ...a)

// `versum-mcp read <url> [--pretty] [--json] [--no-model] [--no-share] [--fresh]` — SuVerse's open reader on this machine
if (args[0] === 'read') {
  const { spawnSync } = await import('node:child_process')
  const { fileURLToPath } = await import('node:url')
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./reader-cli.cjs', import.meta.url)), ...args], { stdio: 'inherit' })
  process.exit(r.status ?? 1)
} else {
if (args.includes('--help') || args.includes('-h')) {
  console.error(`usage: versum-mcp [--tools] | versum-mcp read <url> [--pretty] [--json] [--no-model] [--no-share] [--fresh]\nA stdio MCP server forwarding to ${url} (no key needed), and SuVerse's open reader.`)
  process.exit(0)
}

const upstream = new Client({ name: 'versum-mcp', version: pkg.version })
try {
  await upstream.connect(new StreamableHTTPClientTransport(new URL(url)))
} catch (e) {
  log(`cannot reach ${url}: ${e?.message ?? e}`)
  process.exit(1)
}

if (args.includes('--tools')) {
  const { tools } = await upstream.listTools()
  for (const t of tools) console.log(`${t.name} — ${t.title ?? ''}`)
  await upstream.close()
  process.exit(0)
}

const server = new Server({ name: 'suverse', version: pkg.version }, { capabilities: { tools: { listChanged: false } } })
server.setRequestHandler(ListToolsRequestSchema, async (req) => upstream.listTools(req.params))
server.setRequestHandler(CallToolRequestSchema, async (req) => upstream.callTool(req.params))
await server.connect(new StdioServerTransport())
log(`ready — forwarding to ${url}`)
}
