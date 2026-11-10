# @suverselabs/versum-mcp

Local businesses for AI agents: what they sell, prices, delivery quotes, order and booking links.

```
npx -y @suverselabs/versum-mcp
```

A stdio MCP server that forwards everything to the SuVerse MCP door, `https://www.suverse.io/mcp`. No logic of its
own, no API key: the tools are the door's own tools (15 today), and a new tool there appears here without an update.
It also exports a small typed client (below).

## Use with an MCP client

Claude Desktop (`claude_desktop_config.json`), Cline (MCP settings) and Cursor (`.cursor/mcp.json`) all take this:

```json
{
  "mcpServers": {
    "versum": { "command": "npx", "args": ["-y", "@suverselabs/versum-mcp"] }
  }
}
```

Clients that speak Streamable HTTP can use the door directly: `https://www.suverse.io/mcp`.

`npx -y @suverselabs/versum-mcp --tools` prints the tool list.

## Use from code

```
npm install @suverselabs/versum-mcp
```

```ts
import { SuVerse } from '@suverselabs/versum-mcp'

const versum = new SuVerse()

// 1. florists near Miami that deliver
const found = await versum.searchCatalog({ query: 'florist with delivery', location: 'Miami, FL', limit: 3 })

// 2. what 12 red roses cost delivered to Miami Beach 33139 — asked of the shop's own cart, nothing is ordered
const quote = await versum.quoteOrder({
  offering_id: 'a05bbf1c-32c0-4a56-9038-310b0c35b852',   // Flowers of Miami · Tiny Bouquet of 12 Red Roses with Baby Breath
  deliver_to: { postcode: '33139', state: 'FL', city: 'Miami Beach' },
})

await versum.close()
```

Real answers (2026-11-02), cut down:

```json
{ "found": 12, "businesses": [
  { "name": "More Than Flowers", "miles_away": 2.1, "can": ["order", "contact", "check_delivery"] },
  { "name": "My Peonika Online Flower Shop & Delivery", "miles_away": 0.5, "can": ["order", "contact"] },
  { "name": "Brickell Avenue Flowers & Gifts", "miles_away": 0.4, "can": ["contact"] } ] }
```

```json
{ "status": "quoted", "item": "Tiny Bouquet of 12 Red Roses with Baby Breath", "subtotal": 55, "currency": "USD", "placed": false,
  "options": [ { "name": "Local Delivery", "price": 30, "total": 90.95 },
               { "name": "Local Pickup", "price": 0, "total": 58.85 } ] }
```

There is one method per tool, in camelCase: `listNiches`, `listCards`, `findBusiness`, `searchCatalog`, `getCard`,
`getOffering`, `getProduct`, `getBusiness`, `quoteOrder`, `checkAvailability`, `placeOrder`, `bookSlot`, `orderStatus`,
plus `call(name, args)` for any tool. Parameters are TypeScript types made from each tool's input schema; `getCard` and
`getBusiness` return a typed `Card`; the other answers are plain JSON objects. The methods are generated from the door's
tool list (`npm run generate`), so a new tool only needs a rebuild. Other languages: on request.

## Read any business website

The same package runs SuVerse's open reader on your machine — the readers SuVerse's catalogue uses, for any site:

```
npx -y @suverselabs/versum-mcp read https://example-business.com --pretty
```

Flags: `--pretty` (a short summary), `--json`, `--no-model` (no model call even with `ANTHROPIC_API_KEY` set),
`--no-share` (no shared cache), `--fresh` (read even if the cache has a fresh card). From code:

```ts
import { read } from '@suverselabs/versum-mcp'
const card = await read('https://example-business.com', { model: false })
// card.offerings (title, price, currency, link), card.doors (order, book, reserve, request_quote, call, email), card.evidence
```

The shared cache is free and on by default; `--no-share` or `VERSUM_SHARE=0` turns it off. What is sent and kept:
https://www.suverse.io/privacy. Source: https://github.com/sudzikcoin/versum-agent-assistant/tree/main/reader

## Links

- Schema, taxonomy and docs: https://github.com/sudzikcoin/versum-agent-assistant
- Privacy: https://www.suverse.io/privacy · Terms: https://www.suverse.io/terms
- Contact: info@suverse.io

MIT © SuVerse LLC
