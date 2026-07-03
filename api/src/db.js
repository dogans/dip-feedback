import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://feedback:feedback@localhost:5433/feedback',
})

export async function query(text, params) {
  return pool.query(text, params)
}

// Şemayı uygular (idempotent). Postgres henüz ayağa kalkmadıysa birkaç kez dener.
export async function migrate() {
  const sql = await readFile(join(__dirname, 'schema.sql'), 'utf8')
  const maxTries = 15
  for (let i = 1; i <= maxTries; i++) {
    try {
      await pool.query(sql)
      return
    } catch (err) {
      if (i === maxTries) throw err
      console.log(`DB not ready (try ${i}/${maxTries}): ${err.code || err.message}`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}
