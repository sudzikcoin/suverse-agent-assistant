#!/usr/bin/env node
/**
 * @suverselabs/versum-mcp — a stdio MCP server that forwards everything to the Versum MCP door
 * (https://versum.suverse.io/mcp, Streamable HTTP). No logic of its own, no keys: tools/list and tools/call go
 * through unchanged, so a new tool on the door appears here without an update.
 *
 *   npx -y @suverselabs/versum-mcp            # stdio server for Claude Desktop, Cline, Cursor, …
 *   npx -y @suverselabs/versum-mcp --tools    # print the door's tools and exit
 *
 * Env: VERSUM_MCP_URL to point at another door (default https://versum.suverse.io/mcp).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const args = process.argv.slice(2)
const url = process.env.VERSUM_MCP_URL || 'https://versum.suverse.io/mcp'
const log = (...a) => console.error('[versum-mcp]', ...a)

if (args.includes('--help') || args.includes('-h')) {
  console.error(`usage: versum-mcp [--tools]\nA stdio MCP server forwarding to ${url}. No key needed.`)
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

const server = new Server({ name: 'versum', version: pkg.version }, { capabilities: { tools: { listChanged: false } } })
server.setRequestHandler(ListToolsRequestSchema, async (req) => upstream.listTools(req.params))
server.setRequestHandler(CallToolRequestSchema, async (req) => upstream.callTool(req.params))
await server.connect(new StdioServerTransport())
log(`ready — forwarding to ${url}`)
