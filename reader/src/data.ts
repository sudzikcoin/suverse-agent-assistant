/**
 * The data the readers learn from, as JSON snapshots taken from SuVerse's catalogue by scripts/snapshot.ts:
 * the page words in every language, the platform registry (which host belongs to which platform) and the
 * recipes proven on many businesses. Plain data: no keys, no addresses of ours.
 */
import pageWords from '../data/page-words.json'
import platforms from '../data/platforms.json'
import recipes from '../data/recipes.json'

export type PageWordRow = { kind: 'menu' | 'order' | 'reserve' | 'book' | 'delivery' | 'price' | 'hours' | 'contact' | 'dead' | 'moved'; word: string; mode: 'word' | 'substring' }
export const snapshot = {
  pageWords: pageWords.rows as PageWordRow[],
  platforms: platforms.platforms as { key: string; label: string; kind: string; transacts: boolean; site_engine: boolean; aliases: string[] }[],
  platformDomains: platforms.domains as { domain: string; platform: string }[],
  recipes: recipes.recipes as { host: string; path_shape: string; how: string; platform_key: string | null }[],
  taken_at: pageWords.taken_at as string,
}
