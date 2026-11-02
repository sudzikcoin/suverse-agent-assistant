/**
 * ONE small model call, with the developer's own ANTHROPIC_API_KEY, only when the structured readers found no
 * items. What it returns passes the fill agent's check: the quote must be on a page we fetched, the price must be
 * in the quote, the name's first word must be in the quote, and the page must be one we opened. Nothing else is kept.
 */
import Anthropic from '@anthropic-ai/sdk'
import { config } from './analyzer/config'
import { plainText } from './analyzer/families/food/menu'

export const READER_MODEL = (process.env.VERSUM_READER_MODEL ?? 'claude-haiku-5-5').trim()
type Item = { name: string; price: number | null; currency: string | null; quote: string; source_url: string }

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** the fill agent's rule (analyzer/src/fill/agent.ts), against the pages this run fetched */
export function itemPasses(raw: Item, pages: { url: string; text: string }[]): boolean {
  const name = String(raw.name ?? '').trim()
  const quote = String(raw.quote ?? '')
  const page = pages.find((p) => p.url === raw.source_url)
  if (!name || !quote || !page) return false
  if (!norm(page.text).includes(norm(quote))) return false
  const price = raw.price
  const priceInQuote = price === null || quote.replace(/[,\s]/g, '').includes(String(price).replace(/\.0+$/, '')) || quote.includes(price.toFixed(2))
  return priceInQuote && quote.toLowerCase().includes(name.toLowerCase().split(' ')[0])
}

export async function modelItems(pages: { url: string; html: string }[]): Promise<{ items: Item[]; dropped: number; model: string; cost_usd: number }> {
  const texts = pages.map((p) => ({ url: p.url, text: plainText(p.html) }))
  let budget = 24_000
  const shown = texts.map((t) => { const s = t.text.slice(0, Math.max(0, budget)); budget -= s.length; return { url: t.url, text: s } }).filter((t) => t.text)
  const client = new Anthropic()
  const res = await client.messages.create({
    model: READER_MODEL,
    max_tokens: 2000,
    system: 'You extract the items a business sells (products, dishes, services) with prices from the text of its own web pages. '
      + 'Return ONLY JSON: {"items":[{"name":"","price":null,"currency":null,"quote":"","source_url":""}]}. '
      + '"quote" is copied VERBATIM from the page text and contains the name and the price; "source_url" is the page it is on. '
      + 'price is a number or null when the page states none. Never invent an item, a price or a page. At most 40 items.',
    messages: [{ role: 'user', content: shown.map((t) => `PAGE ${t.url}\n${t.text}`).join('\n\n---\n\n') }],
  })
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  let parsed: { items?: Item[] } = {}
  try { parsed = JSON.parse(/\{[\s\S]*\}/.exec(text)?.[0] ?? '{}') } catch { parsed = {} }
  const all = Array.isArray(parsed.items) ? parsed.items : []
  const items = all.filter((i) => itemPasses(i, texts)).map((i) => ({ ...i, name: String(i.name).slice(0, 200), quote: String(i.quote).slice(0, 300), currency: typeof i.currency === 'string' ? i.currency.toUpperCase().slice(0, 3) : null }))
  const cost = res.usage.input_tokens / 1e6 * config.profileModelPriceIn + res.usage.output_tokens / 1e6 * config.profileModelPriceOut
  return { items, dropped: all.length - items.length, model: READER_MODEL, cost_usd: Math.round(cost * 1e6) / 1e6 }
}
