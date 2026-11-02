// Offline tests over synthetic fixtures (hand-written pages of businesses that do not exist). No network.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serve } = require('./serve.cjs')
const { readSite, read, itemPasses } = require('../dist/index.cjs')

const FIX = path.join(__dirname, '..', 'fixtures')
async function readFixture(name, opts = {}) {
  const s = await serve(path.join(FIX, name))
  try { return await readSite(s.url, { model: false, ...opts }) } finally { s.close() }
}
const doorOf = (c, action) => c.doors.find((d) => d.action === action)

test('a shop: the catalogue with prices in the money its page presents, order door, ship time, contacts', async () => {
  const c = await readFixture('shop')
  assert.equal(c.platform.name, 'shopify')
  assert.equal(c.business.name, 'Lantern & Leaf Candle Co')
  assert.deepEqual(c.offerings.map((o) => [o.title, o.price, o.currency]), [['Fig and Cedar Candle', 24, 'USD'], ['Sea Salt Candle', 22.5, 'USD'], ['Wick Trimmer', 12, 'USD']])
  assert.ok(doorOf(c, 'order'))
  assert.equal(c.delivery.lead_time, '2–3 business days')
  assert.match(c.delivery.policy_url, /shipping-policy$/)
  assert.equal(c.business.email, 'hello@gmail.com')
  assert.ok(c.evidence.some((e) => e.field === 'delivery.lead_time' && /ship within 2-3 business days/.test(e.quote)))
})

test('a restaurant: the menu page, the ordering and reservation platforms, schema.org hours and phone', async () => {
  const c = await readFixture('restaurant')
  assert.equal(c.offerings.length, 6)
  assert.ok(c.offerings.every((o) => o.kind === 'menu_item' && o.price !== null))
  assert.equal(c.offerings[0].title, 'Hummus Plate')
  assert.equal(doorOf(c, 'order').provider, 'toast')
  assert.equal(doorOf(c, 'reserve').provider, 'opentable')
  assert.equal(c.business.hours.length, 7)
  assert.ok(doorOf(c, 'call'))
})

test('a salon: services with durations from the price list, the booking platform door, the owner\'s mailbox', async () => {
  const c = await readFixture('salon')
  assert.equal(c.offerings.length, 4)
  assert.ok(c.offerings.every((o) => o.kind === 'service' && o.duration_min))
  assert.equal(doorOf(c, 'book').provider, 'booksy')
  assert.equal(c.business.email, 'juniperhairstudio@gmail.com')
})

test('a mover: the quote form is a request_quote door, the hourly rates are services', async () => {
  const c = await readFixture('mover')
  assert.match(doorOf(c, 'request_quote').url, /\/get-a-quote$/)
  assert.ok(c.offerings.some((o) => o.price === 120))
  assert.equal(c.business.phone, '+15550100400')
})

test('robots.txt is obeyed', async () => {
  const http = require('node:http')
  const server = http.createServer((req, res) => {
    if (req.url === '/robots.txt') { res.writeHead(200); return res.end('User-agent: *\nDisallow: /\n') }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end('<title>Closed</title>')
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  try {
    const c = await readSite(`http://127.0.0.1:${server.address().port}/`, { model: false })
    assert.equal(c.final_url, null)
    assert.match(c.notes[0], /robots\.txt/)
  } finally { server.close() }
})

test('the shared cache never fails a read, and --no-share asks nothing', async () => {
  const s = await serve(path.join(FIX, 'salon'))
  try {
    const c = await read(s.url, { model: false, share: true, base: 'http://127.0.0.1:1' })
    assert.equal(c.offerings.length, 4)
    const d = await read(s.url, { model: false, share: false, base: 'http://127.0.0.1:1' })
    assert.equal(d.offerings.length, 4)
  } finally { s.close() }
})

test('a model item is kept only with its words on a page we fetched', () => {
  const pages = [{ url: 'https://a.example/', text: 'Lavender Soap Bar — $6.50 each. Free shipping over $40.' }]
  assert.equal(itemPasses({ name: 'Lavender Soap Bar', price: 6.5, currency: 'USD', quote: 'Lavender Soap Bar — $6.50 each', source_url: 'https://a.example/' }, pages), true)
  assert.equal(itemPasses({ name: 'Rose Soap Bar', price: 7, currency: 'USD', quote: 'Rose Soap Bar — $7.00', source_url: 'https://a.example/' }, pages), false)
  assert.equal(itemPasses({ name: 'Lavender Soap Bar', price: 9, currency: 'USD', quote: 'Lavender Soap Bar — $6.50 each', source_url: 'https://a.example/' }, pages), false)
  assert.equal(itemPasses({ name: 'Lavender Soap Bar', price: 6.5, currency: 'USD', quote: 'Lavender Soap Bar — $6.50 each', source_url: 'https://b.example/' }, pages), false)
})

test('the ship-time sentence is the analyzer\'s, character for character', { skip: !fs.existsSync(path.join(__dirname, '../../../analyzer/src/universal/open-layer.ts')) && 'outside the Versum monorepo' }, () => {
  const ours = fs.readFileSync(path.join(__dirname, '../src/read.ts'), 'utf8').match(/export const LEAD_TIME = (\/.*\/i)/)[1]
  const theirs = fs.readFileSync(path.join(__dirname, '../../../analyzer/src/universal/open-layer.ts'), 'utf8').match(/const LEAD_TIME = (\/.*\/i)/)[1]
  assert.equal(ours, theirs)
})
