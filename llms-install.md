# Installing Versum Agent Assistant (for AI agents)

Versum is a **remote** MCP server. Nothing to clone, build or run, and no API key.

Add this server to the MCP settings:

```json
{
  "mcpServers": {
    "versum": { "type": "streamableHttp", "url": "https://versum.suverse.io/mcp" }
  }
}
```

(Clients that name the transport `http` instead of `streamableHttp` use `"type": "http"`; the URL is the same.)

Check: list the tools — there are 15 (`list_niches`, `list_cards`, `find_business`, `search_catalog`, `get_card`,
`get_offering`, `get_product`, `get_business`, `quote_order`, `check_availability`, `place_order`, `book_slot`,
`order_status`, `request_to_owner`, `request_status`), the same as on `https://versum.suverse.io/mcp/catalog` (the
catalogue-only door, recommended). Then try `search_catalog` with `{"query": "a dozen red roses delivered", "location": "Miami, FL"}`.
