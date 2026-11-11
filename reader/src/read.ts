/**
 * ─── VERSUM READER: ONE BUSINESS WEBSITE → ONE CARD ───
 *
 * The same readers SuVerse's own analyzer runs (bundled from analyzer/src), on the developer's machine:
 * robots.txt respected, one request per host per second, no proxy, no browser, no logins, no Google.
 * Every value carries the words it was read from. A page that hides everything behind JavaScript is
 * reported as such, not rendered.
 */
import { decodeEntities } from './analyzer/offering-text'
import { fetchHomePage, fetchProbe, fetchUrl, robotsFor, type FetchResult } from './analyzer/fetcher'
import { config } from './analyzer/config'
import { detectPlatform, type Detection } from './analyzer/platform/detect'
import { SHOPIFY_PROBE, WOO_PROBE, type Evidence, type ProbeEvidence } from './analyzer/platform/signals'
import { readCatalogueFor, type CatalogueIo } from './analyzer/adapters/catalogue'
import { fetchShopMeta, presentedCurrencyFromHtml, shopLocale, withLocale } from './analyzer/adapters/products'
import { readFoodBusiness, type FoodPageRead } from './analyzer/families/food/read'
import { plainText } from './analyzer/families/food/menu'
import { buildBookingCard } from './analyzer/families/booking/build'
import { readJsonLd } from './analyzer/families/booking/adapters/jsonld'
import { buildCard as buildQuoteCard } from './analyzer/families/quote/card'
import { tradeOfNiche } from './analyzer/families/quote/niches'
import { telLinks } from './analyzer/families/quote/intake'
import { linksOf } from './analyzer/profile/pages'
import { pageWord, setPageWords, type PageWordKind } from './analyzer/universal/page-words'
import { cleanOfferingTitles } from './analyzer/universal/item-names'
import { emailsOf } from './analyzer/universal/emails'
import { stripTracking } from './analyzer/universal/form'
import { currencyOfAddress } from './analyzer/universal/country-currency'
import { registrableDomain } from './analyzer/chains'
import { hostOf, pathShape, readWithOurReader } from './analyzer/fill/recipes'
import { snapshot } from './data'
import { modelItems } from './model'
import { cacheGet, cachePost } from './cache'

export const READER_VERSION = '0.1.0'

/**
 * The making/shipping-time sentence, character for character the analyzer's (analyzer/src/universal/open-layer.ts
 * LEAD_TIME). Copied rather than imported because that module pulls the whole catalogue writer in; test/lead-time
 * fails the build the day the two differ.
 */
export const LEAD_TIME = /(?:ships?|shipped|dispatch(?:ed|es)?|processing(?:\s+time)?|production(?:\s+time)?|made\s+to\s+order|handmade|ready(?:\s+to\s+ship)?|turnaround(?:\s+time)?|fulfil?led|orders?\s+(?:are\s+)?(?:shipped|processed))[^.!?\n]{0,40}?(?:within|in|takes?|:)\s*(\d{1,2})(?:\s*(?:-|–|to)\s*(\d{1,2}))?\s*(business\s+|working\s+)?(days?|weeks?|hours?)/i

export type Offering = { title: string; price: number | null; price_max: number | null; currency: string | null; kind: 'product' | 'menu_item' | 'service'; url: string | null; section: string | null; duration_min: number | null }
export type DoorAction = 'order' | 'reserve' | 'book' | 'request_quote' | 'contact' | 'call' | 'email'
export type Door = { action: DoorAction; method: string; url: string; provider: string | null }
export type Card = {
  reader: { name: 'versum-reader'; version: string }
  url: string
  final_url: string | null
  read_at: string
  platform: { name: string; confidence: number } | null
  business: { name: string | null; phone: string | null; email: string | null; hours: string[] | null }
  offerings: Offering[]
  doors: Door[]
  delivery: { lead_time: string | null; policy_url: string | null } | null
  evidence: { field: string; quote: string; url: string }[]
  notes: string[]
  model: { used: boolean; model: string | null; cost_usd: number }
}
export type ReadOptions = { model?: boolean; share?: boolean; fresh?: boolean; base?: string; maxPages?: number }

type Page = { url: string; html: string; kind: string }

const PAGE_KINDS: PageWordKind[] = ['menu', 'order', 'reserve', 'book', 'price', 'contact', 'delivery', 'hours']
const SERVICES = /\b(?:services?|pricing|prices?|rates?|treatments?|menu|book(?:ing)?|appointments?|quote|estimate|shipping|delivery)\b/i
const NEVER = /\/(?:cart|checkout|account|login|register|wp-admin|wp-login|feed|search)(?:[\/?#]|$)|\.(?:pdf|jpe?g|png|gif|webp|svg|zip|xml|css|js)(?:\?|$)/i

let wordsLoaded = false
function loadWords(): void {
  if (wordsLoaded) return
  setPageWords(snapshot.pageWords)
  wordsLoaded = true
}

export function normalizeUrl(input: string): string {
  const t = input.trim()
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

function providerOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase()
    const reg = registrableDomain(host) ?? host
    for (const d of snapshot.platformDomains) if (host === d.domain || host.endsWith(`.${d.domain}`) || reg === d.domain) return d.platform
  } catch { /* not a URL */ }
  return null
}

function siteName(html: string): string | null {
  const og = /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{2,80})["']/i.exec(html)?.[1]
  if (og) return decode(og)
  const ld = readJsonLd(html).name
  if (ld) return ld
  const title = /<title[^>]*>([^<]{2,200})<\/title>/i.exec(html)?.[1]
  return title ? decode(title.split(/\s[|–—-]\s/)[0]).trim() || null : null
}
const decode = (s: string): string => s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()

/** a page whose server sent almost no words and a lot of script: it builds itself in the browser */
function jsShell(html: string): boolean {
  const text = plainText(html)
  const scripts = (html.match(/<script\b/gi) ?? []).length
  return text.length < 400 && scripts >= 3
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_KEYS: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
function hoursLines(h: unknown): string[] | null {
  if (!h || typeof h !== 'object') return null
  const o = h as Record<string, unknown>
  if (o.days && typeof o.days === 'object') {
    const out: string[] = []
    for (const [k, full] of Object.entries(DAY_KEYS)) {
      const d = (o.days as Record<string, { closed?: boolean; opens?: string; closes?: string; periods?: { opens: string; closes: string }[] }>)[k]
      if (!d) continue
      if (d.closed) out.push(`${full}: Closed`)
      else out.push(`${full}: ${(d.periods?.length ? d.periods : [{ opens: d.opens ?? '', closes: d.closes ?? '' }]).map((p) => `${p.opens}–${p.closes}`).join(', ')}`)
    }
    return out.length ? out : null
  }
  const lines = Object.entries(o).filter(([, v]) => typeof v === 'string')
    .sort(([a], [b]) => DAY_ORDER.indexOf(a.toLowerCase()) - DAY_ORDER.indexOf(b.toLowerCase()))
    .map(([k, v]) => `${k.charAt(0).toUpperCase()}${k.slice(1)}: ${v as string}`)
  return lines.length ? lines : null
}

async function detect(origin: string, home: Extract<FetchResult, { ok: true }>, robots: { allows: (p: string) => boolean }): Promise<Detection> {
  const base: Evidence = { html: home.body, headers: home.headers, finalUrl: home.finalUrl, probes: {} }
  const first = detectPlatform(base)
  const unknown = first.platform === 'custom'
  const wantShopify = unknown || first.platform === 'shopify'
  const wantWoo = unknown || first.platform === 'woocommerce' || 'woo_wp_content' in first.signals
  if (!wantShopify && !wantWoo) return first
  const probe = async (path: string): Promise<ProbeEvidence> => {
    const r = await fetchProbe(origin, path, robots)
    return r.ok ? { status: r.status, contentType: r.headers['content-type'] ?? '', body: r.body.slice(0, 200_000) } : null
  }
  const probes: Record<string, ProbeEvidence> = {}
  if (wantShopify) probes[SHOPIFY_PROBE] = await probe(SHOPIFY_PROBE)
  if (wantWoo) probes[WOO_PROBE] = await probe(WOO_PROBE)
  return detectPlatform({ ...base, probes })
}

/** home + the linked pages the page words point at (menu, order, book, prices, contact, delivery), same site only */
export function choosePages(homeHtml: string, homeUrl: string, max: number): { url: string; kind: string }[] {
  loadWords()
  let own = ''
  try { own = registrableDomain(new URL(homeUrl).hostname) ?? new URL(homeUrl).hostname } catch { return [] }
  const picked = new Map<string, string>()
  const perKind = new Map<string, number>()
  for (const l of linksOf(homeHtml, homeUrl)) {
    if (picked.size >= max) break
    let u: URL
    try { u = new URL(l.url) } catch { continue }
    if ((registrableDomain(u.hostname) ?? u.hostname) !== own || NEVER.test(u.pathname)) continue
    u.hash = ''
    const key = stripTracking(u.toString())
    if (key.replace(/\/$/, '') === homeUrl.replace(/\/$/, '') || picked.has(key)) continue
    const said = `${l.text} ${decodeURIComponent(u.pathname).replace(/[\/_-]+/g, ' ')}`
    const kind = PAGE_KINDS.find((k) => pageWord(k, said)) ?? (SERVICES.test(said) ? 'price' : null)
    if (!kind) continue
    if ((perKind.get(kind) ?? 0) >= 2) continue
    perKind.set(kind, (perKind.get(kind) ?? 0) + 1)
    picked.set(key, kind)
  }
  return [...picked].map(([url, kind]) => ({ url, kind }))
}

function emptyCard(url: string): Card {
  return {
    reader: { name: 'versum-reader', version: READER_VERSION }, url, final_url: null, read_at: new Date().toISOString(),
    platform: null, business: { name: null, phone: null, email: null, hours: null }, offerings: [], doors: [], delivery: null,
    evidence: [], notes: [], model: { used: false, model: null, cost_usd: 0 },
  }
}

/** Read one business website. Never throws for a site that refuses or fails; the card says why in `notes`. */
export async function read(input: string, opts: ReadOptions = {}): Promise<Card> {
  const url = normalizeUrl(input)
  const share = opts.share ?? !/^(?:0|false|no)$/i.test(process.env.VERSUM_SHARE ?? '')
  const base = (opts.base ?? process.env.VERSUM_BASE ?? 'https://versum.suverse.io').replace(/\/$/, '')
  if (share && !opts.fresh) {
    const hit = await cacheGet(base, url)
    if (hit) return { ...hit.card, notes: [...(hit.card.notes ?? []), `from the shared cache, read ${hit.card.read_at?.slice(0, 10) ?? 'recently'}`] }
  }
  const card = await readSite(url, opts)
  if (share && card.final_url) await cachePost(base, url, card)
  return card
}

export async function readSite(url: string, opts: ReadOptions = {}): Promise<Card> {
  loadWords()
  const card = emptyCard(url)
  let origin: string
  try { origin = new URL(url).origin } catch { card.notes.push('not a web address'); return card }

  const robots = await robotsFor(origin)
  const home = await fetchHomePage(url, robots)
  if (!home.ok) {
    card.notes.push(home.reason === 'robots'
      ? 'robots.txt asks readers like this one not to read this page, so it was not read'
      : `the site did not give us its page (${home.reason}${home.status ? `, HTTP ${home.status}` : ''}); the open reader does not retry through other networks or a browser`)
    return card
  }
  card.final_url = home.finalUrl
  if (jsShell(home.body)) card.notes.push('this page builds itself with JavaScript in the browser; the open reader does not run a browser, so only what the server sent was read')

  const detection = await detect(new URL(home.finalUrl).origin, home, robots).catch(() => null)
  if (detection) card.platform = { name: detection.platform, confidence: Math.round(detection.confidence * 100) / 100 }
  const platform = detection?.platform ?? 'custom'

  // ─── the pages ───
  const pages: Page[] = [{ url: home.finalUrl, html: home.body, kind: 'home' }]
  for (const p of choosePages(home.body, home.finalUrl, opts.maxPages ?? 8)) {
    let path = '/'
    try { path = new URL(p.url).pathname } catch { continue }
    if (!robots.allows(path)) { card.notes.push(`robots.txt keeps ${path} closed; not read`); continue }
    const r = await fetchUrl(p.url)
    if (r.ok) pages.push({ url: r.finalUrl, html: r.body, kind: p.kind })
  }
  const name = siteName(home.body)
  card.business.name = name

  const offerings: Offering[] = []
  /**
   * The family readers all look at the same pages, and each sees its own shape everywhere: the booking reader
   * reads a menu's descriptions as services, the menu reader reads a price list as dishes. The family with the
   * stronger evidence keeps its items (a menu page or an ordering/reservation platform for food; a booking door
   * for services); the quote family's services count only when neither found any.
   */
  const menuItems: Offering[] = [], serviceItems: Offering[] = [], quoteItems: Offering[] = []
  let foodScore = 0, bookingScore = 0
  const doors: Door[] = []
  const door = (action: DoorAction, method: string, u: string | null | undefined, provider?: string | null): void => {
    if (!u || !/^(?:https?:|tel:|mailto:)/i.test(u)) return
    const clean = /^https?:/i.test(u) ? stripTracking(u) : u
    if (doors.some((d) => d.action === action && d.url === clean)) return
    doors.push({ action, method, url: clean, provider: provider ?? (/^https?:/i.test(clean) ? providerOf(clean) : null) })
  }
  const ev = (field: string, quote: string | null | undefined, u: string | null | undefined): void => {
    if (quote && u) card.evidence.push({ field, quote: quote.replace(/\s+/g, ' ').trim().slice(0, 240), url: u })
  }

  // ─── shops ───
  // the shop platforms always; a generic site only when its own page shows a shop (a product in schema.org, a cart):
  // walking a plumber's sitemap for products cost 90 s and found none (the 10-site comparison)
  const shopSigns = /"@type"\s*:\s*"Product"|add[\s-]to[\s-](?:cart|bag|basket)|\/cart\b|woocommerce/i.test(home.body)
  if (['shopify', 'woocommerce', 'squarespace', 'wix', 'bigcommerce'].includes(platform) || (['custom', 'wordpress', 'webflow'].includes(platform) && shopSigns)) {
    try {
      const shopOrigin = new URL(home.finalUrl).origin
      const meta = platform === 'shopify' ? await fetchShopMeta(shopOrigin, robots) : null
      const locale = platform === 'shopify' ? shopLocale(meta, null) : null
      const io: CatalogueIo = {
        html: home.body,
        robotsTxt: null,
        productPageCap: 12,
        fetchPath: async (path) => {
          const p = platform === 'shopify' && /^\/(?:products\.json|products\/|collections\/)/.test(path) ? withLocale(path, locale) : path
          const r = await fetchProbe(shopOrigin, p, robots)
          return r.ok ? { ok: true, body: r.body, status: r.status } : { ok: false, reason: r.reason }
        },
        fetchUrl: async (abs) => {
          let path = '/'
          try { path = new URL(abs).pathname } catch { return { ok: false } }
          if (!robots.allows(path)) return { ok: false }
          const r = await fetchUrl(abs, { timeoutMs: config.probeTimeoutMs })
          return r.ok && r.status >= 200 && r.status < 300 ? { ok: true, body: r.body } : { ok: false }
        },
      }
      const cat = await readCatalogueFor(platform, shopOrigin, io)
      // the shop's own presented money, as its page states it (Shopify's API names none)
      const presented = presentedCurrencyFromHtml(home.body)
      if (presented && cat.products.some((p) => !p.currency)) ev('currency', `the shop's page presents prices in ${presented}`, home.finalUrl)
      for (const p of cat.products) {
        offerings.push({ title: p.title, price: p.price, price_max: null, currency: p.currency ?? (p.price !== null ? presented : null), kind: 'product', url: p.product_url ? stripTracking(p.product_url) : null, section: p.product_type || null, duration_min: null })
      }
      if (cat.products.length) {
        ev('offerings', `${cat.products.length} products read from the shop's own catalogue (${cat.source})`, shopOrigin)
        door('order', platform === 'custom' ? 'link' : platform, cat.products.find((p) => p.order_url)?.order_url ?? cat.products[0].product_url ?? shopOrigin, platform === 'custom' ? null : platform)
      } else if (cat.reason && platform !== 'custom') card.notes.push(`shop catalogue: ${cat.reason}`)
    } catch (e) { card.notes.push(`shop catalogue could not be read: ${(e as Error).message.slice(0, 120)}`) }
  }

  // ─── food: menus, ordering and reservation platforms ───
  try {
    const foodKinds = new Set(['home', 'menu', 'order', 'reserve', 'hours'])
    const food = readFoodBusiness({
      business: { name: name ?? '', address: null, location: null, phone: null, website: url, site_platform: platform, place_id: null, primary_type: null },
      hint: { name, address: null, city: null },
      pages: pages.map((p) => ({ url: p.url, html: p.html, kind: (foodKinds.has(p.kind) ? p.kind : 'about') as FoodPageRead['kind'] })),
    })
    foodScore = food.menu.dishes + (food.platforms.some((p) => p.url) ? 100 : 0) + (pages.some((p) => p.kind === 'menu') ? 50 : 0)
    for (const s of food.menu.sections) for (const d of s.dishes) {
      menuItems.push({ title: d.name, price: d.price, price_max: null, currency: d.currency, kind: 'menu_item', url: food.menu.url, section: s.name || null, duration_min: null })
    }
    if (food.menu.dishes) ev('offerings', `a menu of ${food.menu.dishes} dishes (${food.menu.priced} priced), read as ${food.menu.source}`, food.menu.url ?? home.finalUrl)
    for (const p of food.platforms) {
      if (!p.url) continue
      const action: DoorAction | null = p.capability === 'reserve' ? 'reserve' : p.capability === 'order' || p.capability === 'order_catering' ? 'order' : null
      if (action) door(action, p.platform, p.url, p.platform)
    }
    const fh = hoursLines(food.hours.business)
    if (fh) { card.business.hours = fh; ev('hours', food.hours.business?.quote ?? fh.join(' · '), home.finalUrl) }
  } catch (e) { card.notes.push(`menu reader failed: ${(e as Error).message.slice(0, 120)}`) }

  // ─── booking: services, staff, booking doors ───
  try {
    const { card: b } = buildBookingCard({ business: { name: name ?? '', website: url }, pages })
    bookingScore = b.services.count + (b.capabilities.some((c) => c.name === 'book') ? 100 : 0)
    for (const s of b.services.items) {
      serviceItems.push({ title: s.name, price: s.price_from, price_max: s.price_to, currency: s.currency, kind: 'service', url: null, section: s.category, duration_min: s.duration_min })
    }
    if (b.services.count) ev('offerings', `${b.services.count} services (${b.services.prices_seen} with a price)`, home.finalUrl)
    for (const c of b.capabilities) {
      if (c.name === 'book') for (const d of c.doors) door('book', d.via, d.url, b.booking.provider ?? d.via)
      if (c.name === 'contact') { if (c.form) door('contact', 'form', c.form); card.business.phone ??= c.phone; card.business.email ??= c.email }
    }
    card.business.hours ??= hoursLines(b.hours)
    for (const [field, e] of Object.entries(b.evidence ?? {})) ev(field, (e as { quote?: string | null }).quote, (e as { url?: string | null }).url ?? home.finalUrl)
  } catch (e) { card.notes.push(`booking reader failed: ${(e as Error).message.slice(0, 120)}`) }

  // ─── quote: services, request-a-quote and booking forms, phone, e-mail, hours ───
  try {
    // no Google category here: the trade is named by the site's own title and heading, if it names one
    const said = `${/<title[^>]*>([^<]{0,200})/i.exec(home.body)?.[1] ?? ''} ${/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/i.exec(home.body)?.[1]?.replace(/<[^>]+>/g, ' ') ?? ''}`
    const niche = tradeOfNiche(said) ? said : ''
    const built = buildQuoteCard({ niche, pages: pages.map((p) => ({ url: p.url, html: p.html })) })
    const f = built.card.fields
    for (const s of f.services) {
      quoteItems.push({ title: s.name, price: s.price?.amount ?? null, price_max: s.price?.amount_max ?? null, currency: s.price?.currency ?? null, kind: 'service', url: s.url, section: null, duration_min: null })
      ev(`offerings[${s.name}]`, s.quote, s.url)
    }
    // a quote form is a door of a trade that quotes (the site names one) — a shop's contact form is not
    if (niche || f.services.length) {
      if (f.request_quote?.url) door('request_quote', f.request_quote.via, f.request_quote.url)
      if (f.book?.url) door('book', f.book.via, f.book.url)
    }
    card.business.phone ??= f.phone
    card.business.email ??= f.email
    card.business.hours ??= hoursLines(f.hours)
  } catch (e) { card.notes.push(`quote reader failed: ${(e as Error).message.slice(0, 120)}`) }

  // ─── one family's items ───
  if (menuItems.length && foodScore > bookingScore) offerings.push(...menuItems)
  else if (serviceItems.length) offerings.push(...serviceItems)
  else if (menuItems.length) offerings.push(...menuItems)
  if (!menuItems.length && !serviceItems.length) offerings.push(...quoteItems)

  // ─── contacts every card gets: tel:, e-mail, schema.org ───
  const ld = pages.map((p) => ({ p, ld: readJsonLd(p.html) }))
  const tel = pages.flatMap((p) => telLinks(p.html).map((t) => ({ t, url: p.url })))[0]
  if (tel) { card.business.phone ??= tel.t; ev('phone', `tel:${tel.t}`, tel.url) }
  const ldPhone = ld.find((x) => x.ld.telephone)
  if (ldPhone) { card.business.phone ??= ldPhone.ld.telephone; ev('phone', `schema.org telephone ${ldPhone.ld.telephone}`, ldPhone.p.url) }
  if (card.business.phone) door('call', 'phone', `tel:${card.business.phone.replace(/[^\d+]/g, '')}`, null)
  const emails = emailsOf(pages, home.finalUrl, name)
  if (emails[0]) { card.business.email = emails[0].email; ev('email', emails[0].quote, emails[0].url || home.finalUrl) }
  if (card.business.email) door('email', 'email', `mailto:${card.business.email}`, null)
  const ldHours = ld.find((x) => x.ld.hours && Object.keys(x.ld.hours).length)
  if (!card.business.hours && ldHours) { card.business.hours = hoursLines(ldHours.ld.hours); ev('hours', 'schema.org openingHoursSpecification', ldHours.p.url) }

  // ─── delivery: the policy page and the making/shipping time, in the shop's words ───
  const policy = pages.flatMap((p) => linksOf(p.html, p.url)).find((l) => /\b(?:shipping|delivery)\b/i.test(`${l.text} ${l.url}`) && /polic|shipping|delivery/i.test(l.url))
  let lead: string | null = null
  for (const p of pages) {
    const text = plainText(p.html)
    const m = LEAD_TIME.exec(text)
    if (m) { lead = `${m[1]}${m[2] ? `–${m[2]}` : ''} ${m[3] ? m[3].trim() + ' ' : ''}${m[4].toLowerCase()}`; ev('delivery.lead_time', text.slice(Math.max(0, (m.index ?? 0) - 20), (m.index ?? 0) + m[0].length + 40), p.url); break }
  }
  if (policy || lead) card.delivery = { lead_time: lead, policy_url: policy ? stripTracking(policy.url) : null }

  // ─── recipes: a link this site has to a host we have a proven recipe for ───
  if (!offerings.length && snapshot.recipes.length) {
    const links = [...doors.map((d) => d.url), ...pages.flatMap((p) => linksOf(p.html, p.url).map((l) => l.url))].filter((u) => /^https?:/.test(u))
    for (const r of snapshot.recipes) {
      const link = links.find((u) => hostOf(u) === r.host && (pathShape(u) === r.path_shape || r.path_shape === '/'))
      if (!link) continue
      const items = await readWithOurReader(link, null).catch(() => [])
      if (!items.length) continue
      for (const i of items) offerings.push({ title: i.name, price: i.price, price_max: null, currency: null, kind: 'menu_item', url: stripTracking(link), section: null, duration_min: null })
      ev('offerings', `${items.length} items read from ${r.host} with a proven recipe`, link)
      break
    }
  }

  // ─── the model, only when nothing structured was found and the developer allowed it with their own key ───
  if (!offerings.length && opts.model !== false && (process.env.ANTHROPIC_API_KEY ?? '').trim()) {
    const got = await modelItems(pages).catch((e: Error) => { card.notes.push(`model call failed: ${e.message.slice(0, 120)}`); return null })
    if (got) {
      card.model = { used: true, model: got.model, cost_usd: got.cost_usd }
      for (const i of got.items) {
        offerings.push({ title: i.name, price: i.price, price_max: null, currency: i.currency, kind: 'product', url: i.source_url, section: null, duration_min: null })
        ev(`offerings[${i.name}]`, i.quote, i.source_url)
      }
      if (got.dropped) card.notes.push(`${got.dropped} item(s) the model returned were dropped: their words are not on the page`)
    }
  } else if (!offerings.length && opts.model !== false) card.notes.push('no items found by the structured readers; set ANTHROPIC_API_KEY to let one small model call look (your key, your cost)')

  // ─── the output filter the analyzer applies at write ───
  const pageAddress = ld.find((x) => x.ld.address)?.ld.address ?? null
  const pageCurrency = currencyOfAddress(pageAddress)
  const { kept, dropped } = cleanOfferingTitles(offerings, name, null)
  const seen = new Set<string>()
  card.offerings = kept.filter((o) => {
    const k = `${o.title.toLowerCase()}|${o.price ?? ''}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).map((o) => ({ ...o, title: decodeEntities(o.title), section: o.section ? decodeEntities(o.section) : o.section, currency: o.currency ?? (o.price !== null ? pageCurrency : null), url: o.url ? stripTracking(o.url) : null }))
  if (dropped.length) card.notes.push(`${dropped.length} line(s) dropped as not items (e.g. «${dropped[0].title.slice(0, 60)}»: ${dropped[0].why})`)
  if (pageCurrency) ev('currency', String(pageAddress), home.finalUrl)
  card.doors = doors.filter((d) => !(d.action === 'contact' && doors.some((o) => o !== d && o.url === d.url && o.action !== 'contact')))
  // evidence is a QUOTE: a line the reader wrote itself («68 services», a bare host) is not kept as evidence —
  // anyone checking the card (the shared cache's re-check included) must find each quote on a page that was read
  const flat = (t: string): string => t.toLowerCase().normalize('NFKC').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const haystack = pages.map((p) => `${flat(p.html)} ${p.html.toLowerCase()}`).join(' ')
  card.evidence = card.evidence.filter((e) => { const q = flat(e.quote); return q.length >= 3 && (haystack.includes(q) || haystack.includes(e.quote.toLowerCase())) })
  return card
}
