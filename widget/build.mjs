import * as esbuild from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')

// Widget'ı tek dosyaya bundle'la ve hem widget/dist hem de API'nin servis ettiği
// api/public altına yaz (API `/widget.js` olarak sunar).
const outfiles = [
  join(__dirname, 'dist/widget.js'),
  join(__dirname, '../api/public/widget.js'), // yerel Fastify servis eder
  join(__dirname, '../dashboard/public/widget.js'), // dashboard (Vite/Pages) servis eder → Supabase deploy
]

async function buildTo(outfile) {
  const opts = {
    entryPoints: [join(__dirname, 'src/widget.ts')],
    bundle: true,
    format: 'iife',
    target: ['es2019'],
    minify: !watch,
    sourcemap: false,
    outfile,
    logLevel: 'info',
  }
  if (watch) {
    const ctx = await esbuild.context(opts)
    await ctx.watch()
  } else {
    await esbuild.build(opts)
  }
}

for (const f of outfiles) await buildTo(f)
if (watch) console.log('watching…')
