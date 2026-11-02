// Bundles src/ (and the analyzer readers it imports) into dist/, with the infrastructure modules replaced by
// the stubs in src/stubs: no database, no proxy, no browser, no ledger in the open reader.
import { build } from 'esbuild'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const STUB = {
  'db': 'db.ts', 'direct-db': 'direct-db.ts', 'proxy': 'proxy.ts', 'spend': 'spend.ts', 'browser': 'browser.ts', 'settings': 'settings.ts',
}
const stubs = {
  name: 'versum-stubs',
  setup(b) {
    b.onResolve({ filter: /^\.\.?\// }, (args) => {
      if (!args.importer.includes('/src/analyzer/')) return
      const target = resolve(args.resolveDir, args.path).replace(/\.ts$/, '')
      const base = target.split('/').pop()
      if (!(base in STUB)) return
      if (base === 'settings' && !target.endsWith('/analyzer/semantic/settings')) return
      if (!target.includes('/src/analyzer/')) return
      return { path: join(root, 'src', 'stubs', STUB[base]) }
    })
    b.onResolve({ filter: /^(playwright|pg|@supabase\/supabase-js|undici|@huggingface\/transformers)$/ }, (args) => ({ path: args.path, namespace: 'absent' }))
    b.onLoad({ filter: /.*/, namespace: 'absent' }, (args) => ({ contents: 'module.exports = {}', loader: 'js' }))
  },
}
const common = {
  bundle: true, platform: 'node', target: 'node20', format: 'cjs', sourcemap: false, legalComments: 'none', minifyWhitespace: true, // drops the analyzer's internal comments from what ships
  external: ['@anthropic-ai/sdk'], plugins: [stubs], logLevel: 'warning',
  define: { 'process.env.NEXT_PUBLIC_APP_URL': '"https://versum.suverse.io"', 'process.env.ANALYZER_BROWSER': '"0"' },
}
await build({ ...common, entryPoints: [join(root, 'src/index.ts')], outfile: join(root, 'dist/index.cjs') })
await build({ ...common, entryPoints: [join(root, 'src/cli.ts')], outfile: join(root, 'dist/cli.cjs'), banner: { js: '#!/usr/bin/env node' } })
console.log('[bundle] dist/index.cjs, dist/cli.cjs')
