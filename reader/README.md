# versum-reader

Read one business website into a card an AI agent can act on: the items it sells with their prices, the doors
(order, book, reserve, request a quote, call, e-mail), its hours and contacts — every value with the words it was
read from. These are the same readers [SuVerse](https://versum.suverse.io) runs on its own catalogue, bundled to
run on your machine.

## Read any business website

```sh
npx @suverselabs/versum-reader read https://example-bakery.com --pretty
```

```js
const { read } = require('@suverselabs/versum-reader')
const card = await read('https://example-bakery.com', { model: false })
```

What it does, in order:

1. Asks the site's `robots.txt` and obeys it. One request per host per second. No logins, no captcha solving,
   no proxy, no browser. A page that only builds itself with JavaScript is reported in `notes`, not rendered.
2. Reads the home page and up to 8 linked pages that the page words point at (menu, order, book, prices,
   contact, delivery), in many languages.
3. Runs the readers that apply: the platform detector (Shopify, WooCommerce, Squarespace, Wix, WordPress, …), the
   shop catalogue readers, the restaurant menu reader with ordering and reservation platforms, the booking reader
   (services, durations, booking platforms), the quote reader (services, rates, quote forms), e-mail and phone.
4. Applies SuVerse's output filter: lines that are not items are dropped (phone numbers, copyright, addresses,
   opening hours), shop names and SEO tails are cut from item names, duplicates are merged, tracking parameters are
   removed from every link.
5. Only when no structured reader found any item, and only if **you** set `ANTHROPIC_API_KEY`, makes ONE small
   model call (`claude-haiku-5-5`, about a cent or less). Every item it returns must carry a quote that is on a page
   that was fetched in this run, with the price inside the quote; anything else is dropped. `--no-model` turns it off.

Nothing is invented: a field the site does not state is `null`. There is no Google data in this card — no address
from a map, no Google hours or reviews. A price's currency is filled in only when the page itself states it.

Options: `--pretty`, `--json`, `--no-model`, `--no-share`, `--fresh` (read even if the shared cache has a fresh card).

The card:

```ts
{ reader: { name: 'versum-reader', version }, url, final_url, read_at,
  platform: { name, confidence } | null,
  business: { name, phone, email, hours: string[] | null },
  offerings: [{ title, price, price_max, currency, kind: 'product'|'menu_item'|'service', url, section, duration_min }],
  doors: [{ action: 'order'|'reserve'|'book'|'request_quote'|'contact'|'call'|'email', method, url, provider }],
  delivery: { lead_time, policy_url } | null,
  evidence: [{ field, quote, url }], notes: string[], model: { used, model, cost_usd } }
```

## Shared cache — free, on by default

Reading a site costs the site a few requests and costs you a few seconds. When someone has read the same site
recently, the reader can use that card instead, and your read can save the next person the trip.

- **Before reading**, the reader asks `https://versum.suverse.io/api/reader/cache?url=…` whether a fresh card for
  that website exists. The request carries **only the website address**. If a fresh card exists it is returned with
  the note «from the shared cache, read <date>»; `--fresh` reads the site anyway.
- **After reading**, the reader sends the card it built: what the business itself publishes on its public pages
  (items, prices, links to order, book or contact, opening hours, the business e-mail shown on the site), the quotes
  each value was read from, the reader's version, and an **anonymous install id** — a random number made on the
  first run and kept in `~/.config/versum/install-id`.
- **Nothing else** about the computer, the developer or the person using it is sent — not your API key, not your
  files, not your environment.
- SuVerse stores the install id hashed again, and the IP address only as a hash, to enforce the per-hour limits.
- **A shared card is never shown as it arrived**: SuVerse's own analyzer opens the cited pages, checks the quotes are
  there, and only then may the cache serve it. The SuVerse catalogue keeps its own reading of a site, never the
  shared one.
- **Turn it off completely** (no look-up and no sending): `--no-share`, or `VERSUM_SHARE=0`.
- A cache that is down, slow or over its limit never fails a read.
- Questions, or deletion of a shared card: info@suverse.io.

The same facts are in SuVerse's privacy policy at https://versum.suverse.io/privacy.

## Build from source

`src/analyzer/` holds the readers of SuVerse's own analyzer — exported from it as is, minus comments and the code that
only the hosted service runs; the infrastructure parts (database, proxy, browser, spend ledger) are replaced by stubs
in `src/stubs/`:

```sh
npm install
npm run build        # bundle + type check
npm test             # offline, over synthetic fixtures
```

## License

MIT © SuVerse LLC
