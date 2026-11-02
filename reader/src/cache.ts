/**
 * The shared cache client. On by default; `--no-share` or VERSUM_SHARE=0 turns off BOTH directions.
 *
 *   GET  {base}/api/reader/cache?url=…   a fresh card someone already read (only fields read from the site)
 *   POST {base}/api/reader/cache         {url, reader_version, install_id, card} — the public page data you read
 *
 * install_id is a random UUID made once and kept in ~/.config/versum/install-id. Nothing else about the machine
 * or the person is sent. A cache failure never fails a read.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Card } from './read'

const VERSION = '0.1.0'

export function installId(): string {
  const dir = join(homedir(), '.config', 'versum')
  const file = join(dir, 'install-id')
  try {
    const id = readFileSync(file, 'utf8').trim()
    if (/^[0-9a-f-]{36}$/i.test(id)) return id
  } catch { /* first run */ }
  const id = randomUUID()
  try { mkdirSync(dir, { recursive: true }); writeFileSync(file, `${id}\n`, { mode: 0o600 }) } catch { /* read-only home: a new id each run */ }
  return id
}

export async function cacheGet(base: string, url: string): Promise<{ card: Card } | null> {
  try {
    const res = await fetch(`${base}/api/reader/cache?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } })
    if (res.status !== 200) return null
    const body = await res.json() as { fresh?: boolean; card?: Card }
    return body.fresh && body.card && typeof body.card === 'object' ? { card: body.card } : null
  } catch { return null }
}

export async function cachePost(base: string, url: string, card: Card): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/reader/cache`, {
      method: 'POST', signal: AbortSignal.timeout(5000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, reader_version: VERSION, install_id: installId(), card }),
    })
    return res.ok
  } catch { return false }
}
