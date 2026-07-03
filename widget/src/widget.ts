import html2canvas from 'html2canvas'

// ---- Config (script tag data-attributes) ----------------------------------
function readConfig() {
  const el =
    (document.currentScript as HTMLScriptElement | null) ||
    document.querySelector<HTMLScriptElement>('script[data-project]')
  const d = el?.dataset || ({} as DOMStringMap)
  return {
    project: d.project || '',
    api: (d.api || '').replace(/\/$/, ''), // legacy self-host API
    supabase: (d.supabase || '').replace(/\/$/, ''), // Supabase project URL
    anon: d.anon || '', // Supabase anon key
    env: (d.env || 'production').toLowerCase(),
  }
}

const CFG = readConfig()
const HAS_BACKEND = (CFG.supabase && CFG.anon) || CFG.api

// production'da hiç yüklenme (yalnızca dev/staging).
const ENABLED = Boolean(CFG.project && HAS_BACKEND && CFG.env !== 'production')

type Rect = { x: number; y: number; w: number; h: number }

// Kategoriler: DB'de İngilizce key saklanır (dil-bağımsız, GitHub label'larıyla uyumlu).
const CATS = [
  { key: 'bug', label: 'Bug' },
  { key: 'cosmetic', label: 'Cosmetic' },
  { key: 'enhancement', label: 'Enhancement' },
  { key: 'content', label: 'Content' },
  { key: 'question', label: 'Question' },
]

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
.fab {
  position: fixed; right: 18px; bottom: 18px; z-index: 2147483000;
  background: #1976d2; color: #fff; border: none; border-radius: 24px;
  padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
  box-shadow: 0 4px 14px rgba(0,0,0,.25);
}
.fab:hover { background: #1565c0; }
.overlay {
  position: fixed; inset: 0; z-index: 2147483001; background: rgba(0,0,0,.55);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.panel {
  background: #fff; border-radius: 10px; max-width: 96vw; max-height: 94vh;
  display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.4);
}
.head { padding: 10px 14px; font-weight: 600; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 8px; }
.hint { font-weight: 400; font-size: 12px; color: #777; }
.body { display: flex; gap: 12px; padding: 12px; overflow: auto; }
.canvas-wrap { position: relative; line-height: 0; border: 1px solid #eee; }
canvas { max-width: 68vw; max-height: 72vh; cursor: crosshair; }
.side { width: 240px; display: flex; flex-direction: column; gap: 8px; }
.cats { display: flex; flex-wrap: wrap; gap: 6px; }
.cat { border: 1px solid #ccc; background: #fff; color: #444; border-radius: 14px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
.cat.active { background: #1976d2; border-color: #1976d2; color: #fff; font-weight: 600; }
textarea, input {
  width: 100%; border: 1px solid #ccc; border-radius: 6px; padding: 8px; font-size: 13px;
}
textarea { min-height: 120px; resize: vertical; }
.foot { display: flex; gap: 8px; justify-content: flex-end; padding: 10px 14px; border-top: 1px solid #eee; }
button.act { border: none; border-radius: 6px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
.send { background: #1976d2; color: #fff; }
.send:disabled { opacity: .5; cursor: default; }
.cancel { background: #eee; color: #333; }
.msg { font-size: 12px; color: #1976d2; }
`

let host: HTMLDivElement
let root: ShadowRoot

function mount() {
  if (document.getElementById('dip-feedback-root')) return // çift enjeksiyon koruması (bookmarklet)
  host = document.createElement('div')
  host.id = 'dip-feedback-root'
  document.body.appendChild(host)
  root = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = STYLE
  root.appendChild(style)

  const fab = document.createElement('button')
  fab.className = 'fab'
  fab.textContent = '🐞 Feedback'
  fab.onclick = capture
  root.appendChild(fab)
}

async function capture() {
  const fab = root.querySelector<HTMLButtonElement>('.fab')!
  fab.disabled = true
  fab.textContent = '…'
  try {
    const canvas = await html2canvas(document.documentElement, {
      logging: false,
      useCORS: true,
      scale: 1,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
    })
    openEditor(canvas)
  } catch (e) {
    console.error('[dip-feedback] capture failed', e)
    alert('Screenshot alınamadı.')
  } finally {
    fab.disabled = false
    fab.textContent = '🐞 Feedback'
  }
}

function openEditor(shot: HTMLCanvasElement) {
  const rects: Rect[] = []

  const overlay = document.createElement('div')
  overlay.className = 'overlay'
  overlay.innerHTML = `
    <div class="panel">
      <div class="head">Feedback <span class="hint">— sürükleyerek işaretleyin</span></div>
      <div class="body">
        <div class="canvas-wrap"><canvas class="draw"></canvas></div>
        <div class="side">
          <div class="cats">
            ${CATS.map(
              (c, i) => `<button type="button" class="cat${i === 0 ? ' active' : ''}" data-cat="${c.key}">${c.label}</button>`
            ).join('')}
          </div>
          <input class="reporter" placeholder="Adınız (opsiyonel)" />
          <textarea class="comment" placeholder="Ne oldu? Ne bekliyordunuz?"></textarea>
          <div class="msg"></div>
        </div>
      </div>
      <div class="foot">
        <button class="act cancel">İptal</button>
        <button class="act send">Gönder</button>
      </div>
    </div>`
  root.appendChild(overlay)

  let category = CATS[0].key
  overlay.querySelectorAll<HTMLButtonElement>('.cat').forEach((btn) => {
    btn.onclick = () => {
      category = btn.dataset.cat || 'bug'
      overlay.querySelectorAll('.cat').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
    }
  })

  const canvas = overlay.querySelector<HTMLCanvasElement>('canvas.draw')!
  const ctx = canvas.getContext('2d')!
  // Görüntülenen boyutu ekrana sığdır; annotation'ları doğal piksele çeviririz.
  const maxW = Math.min(shot.width, Math.floor(window.innerWidth * 0.68))
  const dispScale = maxW / shot.width
  canvas.width = shot.width
  canvas.height = shot.height
  canvas.style.width = `${shot.width * dispScale}px`
  canvas.style.height = `${shot.height * dispScale}px`

  const redraw = () => {
    ctx.drawImage(shot, 0, 0)
    ctx.lineWidth = 3
    ctx.strokeStyle = '#e53935'
    for (const r of rects) ctx.strokeRect(r.x, r.y, r.w, r.h)
  }
  redraw()

  let drawing = false
  let start = { x: 0, y: 0 }
  const toImg = (ev: MouseEvent) => {
    const b = canvas.getBoundingClientRect()
    return { x: (ev.clientX - b.left) / dispScale, y: (ev.clientY - b.top) / dispScale }
  }
  canvas.onmousedown = (ev) => {
    drawing = true
    start = toImg(ev)
  }
  canvas.onmousemove = (ev) => {
    if (!drawing) return
    const p = toImg(ev)
    redraw()
    ctx.strokeStyle = '#e53935'
    ctx.lineWidth = 3
    ctx.strokeRect(start.x, start.y, p.x - start.x, p.y - start.y)
  }
  canvas.onmouseup = (ev) => {
    if (!drawing) return
    drawing = false
    const p = toImg(ev)
    const r = { x: start.x, y: start.y, w: p.x - start.x, h: p.y - start.y }
    if (Math.abs(r.w) > 4 && Math.abs(r.h) > 4) {
      rects.push({ x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h), w: Math.abs(r.w), h: Math.abs(r.h) })
    }
    redraw()
  }

  const close = () => overlay.remove()
  overlay.querySelector<HTMLButtonElement>('.cancel')!.onclick = close
  overlay.onclick = (e) => {
    if (e.target === overlay) close()
  }

  const sendBtn = overlay.querySelector<HTMLButtonElement>('.send')!
  sendBtn.onclick = async () => {
    const comment = overlay.querySelector<HTMLTextAreaElement>('.comment')!.value.trim()
    const reporter = overlay.querySelector<HTMLInputElement>('.reporter')!.value.trim()
    const msg = overlay.querySelector<HTMLDivElement>('.msg')!
    if (!comment) {
      msg.textContent = 'Lütfen bir açıklama yazın.'
      return
    }
    sendBtn.disabled = true
    msg.textContent = 'Gönderiliyor…'
    // Ham screenshot (annotation'sız); kutular ayrı katman → dashboard'da bindirilir.
    const clean = document.createElement('canvas')
    clean.width = shot.width
    clean.height = shot.height
    clean.getContext('2d')!.drawImage(shot, 0, 0)
    // Başlık: ilk boş olmayan satır (kısa ve temiz), en fazla 100 karakter.
    const firstLine = comment.split('\n').map((s) => s.trim()).find(Boolean) || comment
    const base = {
      comment,
      reporter: reporter || null,
      title: firstLine.slice(0, 100),
      category,
      url: location.href,
      userAgent: navigator.userAgent,
      annotations: rects.map((r) => ({ type: 'rect', ...r })),
    }
    try {
      if (CFG.supabase && CFG.anon) await submitSupabase(base, clean)
      else await submitLegacy(base, clean)
      msg.textContent = 'Teşekkürler! Gönderildi.'
      setTimeout(close, 900)
    } catch (e) {
      console.error('[dip-feedback] send failed', e)
      msg.textContent = 'Gönderilemedi. Tekrar deneyin.'
      sendBtn.disabled = false
    }
  }
}

type Base = {
  comment: string
  reporter: string | null
  title: string
  category: string
  url: string
  userAgent: string
  annotations: unknown[]
}

function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'))
}

// Supabase: Storage'a yükle + REST ile satır ekle (anon key).
async function submitSupabase(base: Base, clean: HTMLCanvasElement) {
  const headers = { apikey: CFG.anon, Authorization: `Bearer ${CFG.anon}` }
  const name = `${(crypto as any).randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.floor(Math.random() * 1e9)}.png`
  const blob = await canvasToBlob(clean)
  const up = await fetch(`${CFG.supabase}/storage/v1/object/screenshots/${name}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/png' },
    body: blob,
  })
  if (!up.ok) throw new Error('storage ' + up.status)
  const screenshot_url = `${CFG.supabase}/storage/v1/object/public/screenshots/${name}`
  const row = {
    project_key: CFG.project,
    title: base.title,
    comment: base.comment,
    category: base.category,
    reporter: base.reporter,
    url: base.url,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    user_agent: base.userAgent,
    annotations: base.annotations,
    screenshot_url,
  }
  const ins = await fetch(`${CFG.supabase}/rest/v1/feedback`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  })
  if (!ins.ok) throw new Error('insert ' + ins.status)
}

// Legacy self-host Fastify API.
async function submitLegacy(base: Base, clean: HTMLCanvasElement) {
  const res = await fetch(`${CFG.api}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectKey: CFG.project,
      ...base,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      screenshot: clean.toDataURL('image/png'),
    }),
  })
  if (!res.ok) throw new Error(String(res.status))
}

if (ENABLED) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
} else if (CFG.project && CFG.env === 'production') {
  // sessiz: production'da yüklenmez
}
