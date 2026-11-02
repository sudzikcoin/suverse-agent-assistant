/**
 *   versum-reader read <url> [--pretty] [--json] [--no-model] [--no-share] [--fresh]
 */
import { read, type Card } from './read'

const HELP = `versum-reader — read a business website into a card an AI agent can act on

  versum-reader read <url> [--pretty] [--json] [--no-model] [--no-share] [--fresh]

  --pretty     a short summary for people (default when the output is a terminal)
  --json       the card as JSON (default when piped)
  --no-model   never call a model, even with ANTHROPIC_API_KEY set
  --no-share   do not use the shared cache: nothing asked, nothing sent (also VERSUM_SHARE=0)
  --fresh      read the site even if the shared cache has a fresh card (still shares the result)
`

export function pretty(c: Card): string {
  const L: string[] = []
  L.push(`${c.business.name ?? '(no name found)'} — ${c.final_url ?? c.url}`)
  if (c.platform) L.push(`  built on: ${c.platform.name} (${Math.round(c.platform.confidence * 100)}%)`)
  if (c.business.phone) L.push(`  phone:    ${c.business.phone}`)
  if (c.business.email) L.push(`  e-mail:   ${c.business.email}`)
  if (c.business.hours?.length) L.push(`  hours:    ${c.business.hours.join(' · ')}`)
  const priced = c.offerings.filter((o) => o.price !== null).length
  L.push(`  items:    ${c.offerings.length} (${priced} with a price)`)
  for (const o of c.offerings.slice(0, 8)) L.push(`    - ${o.title}${o.price !== null ? ` — ${o.price}${o.price_max ? `–${o.price_max}` : ''} ${o.currency ?? ''}`.trimEnd() : ''}`)
  if (c.offerings.length > 8) L.push(`    … and ${c.offerings.length - 8} more`)
  L.push(`  doors:    ${c.doors.length ? '' : 'none'}`)
  for (const d of c.doors) L.push(`    - ${d.action}${d.provider ? ` (${d.provider})` : ''}: ${d.url}`)
  if (c.delivery) L.push(`  delivery: ${[c.delivery.lead_time && `ships/made in ${c.delivery.lead_time}`, c.delivery.policy_url].filter(Boolean).join(' · ')}`)
  for (const n of c.notes) L.push(`  note: ${n}`)
  if (c.model.used) L.push(`  model: ${c.model.model}, $${c.model.cost_usd}`)
  return L.join('\n')
}

export async function main(argv: string[]): Promise<number> {
  const [cmd, url] = argv.filter((a) => !a.startsWith('--'))
  if (cmd !== 'read' || !url) { process.stdout.write(HELP); return cmd ? 1 : 0 }
  const card = await read(url, { model: !argv.includes('--no-model'), share: argv.includes('--no-share') ? false : undefined, fresh: argv.includes('--fresh') })
  const asJson = argv.includes('--json') || (!argv.includes('--pretty') && !process.stdout.isTTY)
  process.stdout.write(asJson ? `${JSON.stringify(card, null, 2)}\n` : `${pretty(card)}\n`)
  return 0
}

if (require.main === module) main(process.argv.slice(2)).then((code) => { process.exitCode = code }, (e) => { console.error(`versum-reader: ${(e as Error).message}`); process.exitCode = 1 })
