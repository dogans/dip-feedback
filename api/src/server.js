import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool, query, migrate } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const UPLOADS_DIR = join(ROOT, 'uploads')
const PUBLIC_DIR = join(ROOT, 'public')
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:4000'
const PORT = Number(process.env.PORT || 4000)

const STATUSES = ['open', 'in_progress', 'done', 'wontfix']
const PRIORITIES = ['low', 'normal', 'high']

const app = Fastify({ logger: true, bodyLimit: 20 * 1024 * 1024 }) // ~20MB (screenshots)

await app.register(cors, { origin: true }) // widget farklı origin'lerden POST eder
await mkdir(UPLOADS_DIR, { recursive: true })
await mkdir(PUBLIC_DIR, { recursive: true })
await app.register(fastifyStatic, { root: UPLOADS_DIR, prefix: '/uploads/' })
await app.register(fastifyStatic, { root: PUBLIC_DIR, prefix: '/', decorateReply: false })

const screenshotUrl = (p) => (p ? `${PUBLIC_URL}/uploads/${p}` : null)

app.get('/health', async () => ({ ok: true }))

app.get('/api/projects', async () => {
  const { rows } = await query('SELECT id, key, name FROM projects ORDER BY name')
  return rows
})

// Widget → feedback gönderir
app.post('/api/feedback', async (req, reply) => {
  const b = req.body || {}
  if (!b.projectKey) return reply.code(400).send({ error: 'projectKey required' })

  const proj = await query('SELECT id FROM projects WHERE key = $1', [b.projectKey])
  if (proj.rowCount === 0) return reply.code(404).send({ error: 'unknown project' })

  // Screenshot (data URL) → dosya
  let screenshotPath = null
  if (typeof b.screenshot === 'string' && b.screenshot.startsWith('data:image/')) {
    const base64 = b.screenshot.split(',')[1] || ''
    screenshotPath = `${randomUUID()}.png`
    await writeFile(join(UPLOADS_DIR, screenshotPath), Buffer.from(base64, 'base64'))
  }

  const vp = b.viewport || {}
  const { rows } = await query(
    `INSERT INTO feedback
       (project_id, title, comment, category, url, viewport_w, viewport_h, user_agent, reporter, screenshot_path, annotations, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      proj.rows[0].id,
      b.title || null,
      b.comment || null,
      b.category || 'bug',
      b.url || null,
      vp.w || null,
      vp.h || null,
      b.userAgent || null,
      b.reporter || null,
      screenshotPath,
      JSON.stringify(Array.isArray(b.annotations) ? b.annotations : []),
      JSON.stringify(b.meta || {}),
    ]
  )
  return reply.code(201).send({ id: rows[0].id })
})

// Dashboard → liste (filtreli)
app.get('/api/feedback', async (req) => {
  const { project, status, category } = req.query
  const where = []
  const params = []
  if (project) {
    params.push(project)
    where.push(`p.key = $${params.length}`)
  }
  if (status) {
    params.push(status)
    where.push(`f.status = $${params.length}`)
  }
  if (category) {
    params.push(category)
    where.push(`f.category = $${params.length}`)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const { rows } = await query(
    `SELECT f.id, p.key AS project_key, p.name AS project_name, f.title, f.comment, f.category,
            f.status, f.priority, f.assignee, f.url, f.reporter, f.screenshot_path, f.created_at
     FROM feedback f JOIN projects p ON p.id = f.project_id
     ${clause}
     ORDER BY f.created_at DESC`,
    params
  )
  return rows.map((r) => ({ ...r, screenshot_url: screenshotUrl(r.screenshot_path) }))
})

// Dashboard → detay
app.get('/api/feedback/:id', async (req, reply) => {
  const { rows } = await query(
    `SELECT f.*, p.key AS project_key, p.name AS project_name
     FROM feedback f JOIN projects p ON p.id = f.project_id
     WHERE f.id = $1`,
    [req.params.id]
  )
  if (rows.length === 0) return reply.code(404).send({ error: 'not found' })
  const r = rows[0]
  return { ...r, screenshot_url: screenshotUrl(r.screenshot_path) }
})

// Dashboard → status/priority/assignee güncelle
app.patch('/api/feedback/:id', async (req, reply) => {
  const b = req.body || {}
  const sets = []
  const params = []
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return reply.code(400).send({ error: 'bad status' })
    params.push(b.status)
    sets.push(`status = $${params.length}`)
  }
  if (b.priority !== undefined) {
    if (!PRIORITIES.includes(b.priority)) return reply.code(400).send({ error: 'bad priority' })
    params.push(b.priority)
    sets.push(`priority = $${params.length}`)
  }
  if (b.assignee !== undefined) {
    params.push(b.assignee)
    sets.push(`assignee = $${params.length}`)
  }
  if (!sets.length) return reply.code(400).send({ error: 'nothing to update' })
  sets.push('updated_at = now()')
  params.push(req.params.id)
  const { rows } = await query(
    `UPDATE feedback SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id, status, priority, assignee`,
    params
  )
  if (rows.length === 0) return reply.code(404).send({ error: 'not found' })
  return rows[0]
})

try {
  await migrate()
  await app.listen({ port: PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  await pool.end()
  process.exit(1)
}
