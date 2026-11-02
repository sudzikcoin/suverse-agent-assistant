/**
 * import { Versum } from '@suverselabs/versum-mcp'
 *
 * A thin MCP client of https://versum.suverse.io/mcp: one method per tool (camelCase), each returning the tool's
 * JSON answer. No logic of its own and no keys. Methods are made from tools.generated.mjs (scripts/generate.mjs).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { TOOLS } from './tools.generated.mjs'

export { TOOLS }

export class Versum {
  constructor(options = {}) {
    this.url = options.url || 'https://versum.suverse.io/mcp'
    this.client = null
  }

  async connect() {
    if (this.client) return this
    const client = new Client({ name: 'versum-sdk', version: '1' })
    await client.connect(new StreamableHTTPClientTransport(new URL(this.url)))
    this.client = client
    return this
  }

  async close() {
    if (this.client) await this.client.close()
    this.client = null
  }

  async call(name, args = {}) {
    await this.connect()
    const r = await this.client.callTool({ name, arguments: args })
    const text = (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
    let body
    try { body = JSON.parse(text) } catch { body = { text } }
    if (r.isError) {
      const err = new Error(typeof body.text === 'string' ? body.text : JSON.stringify(body).slice(0, 300))
      err.answer = body
      throw err
    }
    return body
  }
}

for (const t of TOOLS) {
  Versum.prototype[t.method] = function (args = {}) { return this.call(t.name, args) }
}
