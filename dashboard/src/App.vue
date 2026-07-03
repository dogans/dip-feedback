<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { backend } from './backend'
import Setup from './Setup.vue'
import Login from './Login.vue'

const view = ref('inbox') // 'inbox' | 'setup'

const STATUSES = ['open', 'in_progress', 'done', 'wontfix']
const PRIORITIES = ['low', 'normal', 'high']
const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', done: 'Done', wontfix: "Won't fix" }
const CATEGORIES = ['bug', 'cosmetic', 'enhancement', 'content', 'question']
const CAT_LABEL = {
  bug: 'Bug',
  cosmetic: 'Cosmetic',
  enhancement: 'Enhancement',
  content: 'Content',
  question: 'Question',
}

const user = ref(null)
const authReady = ref(false)
const projects = ref([])
const assignees = ref([])
const items = ref([])
const filters = ref({ project: '', status: '', category: '', assignee: '' })
const selected = ref(null)
const imgScale = ref(1)
const loading = ref(false)
const comments = ref([])
const newComment = ref({ author: '', body: '' })

// project_key → görünen ad (backend'den bağımsız)
const projMap = computed(() => Object.fromEntries(projects.value.map((p) => [p.key, p.name])))
const projName = (key) => projMap.value[key] || key

async function loadList() {
  loading.value = true
  try {
    items.value = await backend.list(filters.value)
  } finally {
    loading.value = false
  }
}

async function open(id) {
  selected.value = await backend.get(id)
  imgScale.value = 1
  comments.value = await backend.comments(id)
  newComment.value = { author: '', body: '' }
}

async function sendComment() {
  const body = newComment.value.body.trim()
  if (!body || !selected.value) return
  const c = await backend.addComment(selected.value.id, { author: newComment.value.author.trim() || null, body })
  comments.value.push(c)
  newComment.value = { author: '', body: '' }
}

function onImgLoad(e) {
  const img = e.target
  const natural = selected.value?.viewport_w || img.naturalWidth || img.width
  imgScale.value = img.clientWidth / natural
}

async function patch(field, value) {
  const updated = await backend.update(selected.value.id, { [field]: value })
  Object.assign(selected.value, updated)
  await loadList()
  if (field === 'assignee') assignees.value = await backend.assignees()
}

const fmt = (d) => new Date(d).toLocaleString('en-US')

// Anonim oy — tarayıcı bazlı toggle (localStorage), atıf yok.
const VOTED_KEY = 'dipfb_voted'
const votedIds = ref(new Set(JSON.parse(localStorage.getItem(VOTED_KEY) || '[]')))
const hasVoted = (id) => votedIds.value.has(String(id))

async function toggleVote(item) {
  const id = String(item.id)
  const dir = votedIds.value.has(id) ? -1 : 1
  const { votes } = await backend.vote(item.id, dir)
  item.votes = votes
  if (selected.value && String(selected.value.id) === id) selected.value.votes = votes
  const s = new Set(votedIds.value)
  if (dir === 1) s.add(id)
  else s.delete(id)
  votedIds.value = s
  localStorage.setItem(VOTED_KEY, JSON.stringify([...s]))
}

async function loadData() {
  projects.value = await backend.projects()
  assignees.value = await backend.assignees()
  await loadList()
}

async function onAuthed() {
  user.value = await backend.currentUser()
  if (user.value) await loadData()
}

async function logout() {
  await backend.signOut()
  user.value = null
  items.value = []
  selected.value = null
}

onMounted(async () => {
  if (!backend.needsAuth) {
    user.value = { local: true }
    await loadData()
    authReady.value = true
    return
  }
  user.value = await backend.currentUser()
  if (user.value) await loadData()
  backend.onAuth(async (u) => {
    user.value = u
    if (u) await loadData()
  })
  authReady.value = true
})
watch(filters, loadList, { deep: true })
</script>

<template>
  <Login v-if="authReady && !user" @authed="onAuthed" />

  <div v-else-if="user" class="app">
    <header>
      <h1>🐞 Feedback</h1>
      <nav class="nav">
        <button :class="{ active: view === 'inbox' }" @click="view = 'inbox'">Inbox</button>
        <button :class="{ active: view === 'setup' }" @click="view = 'setup'">Setup</button>
      </nav>
      <template v-if="view === 'inbox'">
        <select v-model="filters.project">
          <option value="">All projects</option>
          <option v-for="p in projects" :key="p.key" :value="p.key">{{ p.name }}</option>
        </select>
        <select v-model="filters.status">
          <option value="">All statuses</option>
          <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
        </select>
        <select v-model="filters.category">
          <option value="">All types</option>
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ CAT_LABEL[c] }}</option>
        </select>
        <select v-model="filters.assignee">
          <option value="">All assignees</option>
          <option v-for="a in assignees" :key="a" :value="a">{{ a }}</option>
        </select>
        <span class="count">{{ items.length }} items</span>
      </template>
      <button v-if="user && user.email" class="logout" @click="logout" :title="user.email">Logout</button>
    </header>

    <Setup v-if="view === 'setup'" :projects="projects" />

    <div class="main" v-else>
      <ul class="list">
        <li v-if="loading" class="empty">Loading…</li>
        <li v-else-if="!items.length" class="empty">No records.</li>
        <li
          v-for="it in items"
          :key="it.id"
          :class="{ active: selected && selected.id === it.id }"
          @click="open(it.id)"
        >
          <div class="row1">
            <span class="proj">{{ projName(it.project_key) }}</span>
            <span class="cat-badge" :data-c="it.category">{{ CAT_LABEL[it.category] || it.category }}</span>
            <span class="badge" :data-s="it.status">{{ STATUS_LABEL[it.status] }}</span>
            <button class="vote" :class="{ voted: hasVoted(it.id) }" title="+1" @click.stop="toggleVote(it)">
              👍 {{ it.votes || 0 }}
            </button>
          </div>
          <div class="title">{{ it.title || it.comment || '(empty)' }}</div>
          <div class="meta">{{ it.reporter || 'anonymous' }} · {{ fmt(it.created_at) }}</div>
        </li>
      </ul>

      <section class="detail" v-if="selected">
        <div class="dhead">
          <strong>#{{ selected.id }}</strong> · {{ projName(selected.project_key) }}
          <span class="cat-badge" :data-c="selected.category">{{ CAT_LABEL[selected.category] || selected.category }}</span>
          <button class="vote" :class="{ voted: hasVoted(selected.id) }" title="+1" @click="toggleVote(selected)">
            👍 {{ selected.votes || 0 }}
          </button>
          <a v-if="selected.url" :href="selected.url" target="_blank" rel="noopener">↗ page</a>
        </div>

        <div class="shot" v-if="selected.screenshot_url">
          <img :src="selected.screenshot_url" @load="onImgLoad" />
          <div
            v-for="(a, i) in selected.annotations"
            :key="i"
            class="box"
            :style="{
              left: a.x * imgScale + 'px',
              top: a.y * imgScale + 'px',
              width: a.w * imgScale + 'px',
              height: a.h * imgScale + 'px',
            }"
          ></div>
        </div>

        <p class="comment">{{ selected.comment }}</p>

        <div class="controls">
          <label>Status
            <select :value="selected.status" @change="patch('status', $event.target.value)">
              <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
            </select>
          </label>
          <label>Priority
            <select :value="selected.priority" @change="patch('priority', $event.target.value)">
              <option v-for="p in PRIORITIES" :key="p" :value="p">{{ p }}</option>
            </select>
          </label>
          <label>Assignee
            <input
              :value="selected.assignee || ''"
              placeholder="—"
              @change="patch('assignee', $event.target.value)"
            />
          </label>
        </div>

        <ul class="metalist">
          <li>Reporter: {{ selected.reporter || 'anonymous' }}</li>
          <li>Viewport: {{ selected.viewport_w }}×{{ selected.viewport_h }}</li>
          <li>Date: {{ fmt(selected.created_at) }}</li>
          <li class="ua">{{ selected.user_agent }}</li>
        </ul>

        <div class="thread">
          <h4>Comments ({{ comments.length }})</h4>
          <div v-if="!comments.length" class="cmt-empty">No comments yet.</div>
          <div v-for="c in comments" :key="c.id" class="cmt">
            <div class="cmt-head">{{ c.author || 'anonymous' }} · {{ fmt(c.created_at) }}</div>
            <div class="cmt-body">{{ c.body }}</div>
          </div>
          <div class="cmt-form">
            <input v-model="newComment.author" placeholder="Your name (optional)" />
            <textarea
              v-model="newComment.body"
              rows="2"
              placeholder="Add a comment… (e.g. 'done', 'not needed now')"
              @keydown.ctrl.enter="sendComment"
            ></textarea>
            <button :disabled="!newComment.body.trim()" @click="sendComment">Add</button>
          </div>
        </div>
      </section>
      <section class="detail empty2" v-else>Select a record.</section>
    </div>
  </div>
</template>

<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; color: #222; background: #f5f6f8; }
.app { height: 100vh; display: flex; flex-direction: column; }
header { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #1976d2; color: #fff; }
header h1 { font-size: 16px; margin: 0; }
.nav { display: flex; gap: 4px; margin-right: auto; }
.nav button {
  background: transparent; color: #fff; border: none; padding: 6px 12px;
  border-radius: 6px; cursor: pointer; font-size: 13px; opacity: .8;
}
.nav button:hover { background: rgba(255, 255, 255, .12); opacity: 1; }
.nav button.active { background: rgba(255, 255, 255, .22); opacity: 1; font-weight: 600; }
header select { padding: 6px 8px; border-radius: 6px; border: none; }
.count { font-size: 12px; opacity: .85; }
.logout { background: rgba(255, 255, 255, .15); color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.logout:hover { background: rgba(255, 255, 255, .28); }
.main { flex: 1; display: flex; min-height: 0; }
.list { width: 340px; margin: 0; padding: 0; list-style: none; overflow: auto; border-right: 1px solid #e2e4e8; background: #fff; }
.list li { padding: 10px 14px; border-bottom: 1px solid #eef0f2; cursor: pointer; }
.list li:hover { background: #f0f6ff; }
.list li.active { background: #e3f0ff; }
.list .empty { color: #999; cursor: default; }
.row1 { display: flex; align-items: center; gap: 8px; }
.proj { font-size: 11px; font-weight: 700; color: #1976d2; text-transform: uppercase; margin-right: auto; }
.badge { font-size: 11px; padding: 1px 8px; border-radius: 10px; background: #eee; }
.badge[data-s='open'] { background: #ffe0b2; }
.badge[data-s='in_progress'] { background: #bbdefb; }
.badge[data-s='done'] { background: #c8e6c9; }
.badge[data-s='wontfix'] { background: #e0e0e0; }
.cat-badge { font-size: 10px; padding: 1px 7px; border-radius: 10px; background: #eceff1; color: #455a64; font-weight: 600; }
.cat-badge[data-c='bug'] { background: #ffcdd2; color: #b71c1c; }
.cat-badge[data-c='cosmetic'] { background: #e1bee7; color: #6a1b9a; }
.cat-badge[data-c='enhancement'] { background: #c8e6c9; color: #1b5e20; }
.cat-badge[data-c='content'] { background: #ffe0b2; color: #e65100; }
.cat-badge[data-c='question'] { background: #b3e5fc; color: #01579b; }
.vote { border: 1px solid #cfd8dc; background: #fff; color: #546e7a; border-radius: 12px; padding: 1px 8px; font-size: 11px; cursor: pointer; line-height: 1.6; }
.vote:hover { background: #eceff1; }
.vote.voted { background: #1976d2; border-color: #1976d2; color: #fff; font-weight: 600; }
.title {
  font-size: 13px; font-weight: 600; margin: 3px 0;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; overflow-wrap: anywhere;
}
.meta { font-size: 11px; color: #888; }
.detail { flex: 1; overflow: auto; padding: 16px; }
.empty2 { color: #999; display: flex; align-items: center; justify-content: center; }
.dhead { margin-bottom: 10px; }
.dhead a { margin-left: 8px; font-size: 13px; }
.shot { position: relative; display: inline-block; border: 1px solid #ddd; line-height: 0; max-width: 100%; }
.shot img { max-width: 100%; display: block; }
.box { position: absolute; border: 3px solid #e53935; pointer-events: none; }
.comment { white-space: pre-wrap; overflow-wrap: anywhere; background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 10px; }
.controls { display: flex; gap: 14px; flex-wrap: wrap; margin: 12px 0; }
.controls label { font-size: 12px; color: #555; display: flex; flex-direction: column; gap: 4px; }
.controls select, .controls input { padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; }
.metalist { list-style: none; padding: 0; font-size: 12px; color: #777; }
.metalist .ua { word-break: break-all; margin-top: 4px; }
.thread { margin-top: 16px; border-top: 1px solid #eee; padding-top: 12px; }
.thread h4 { margin: 0 0 8px; font-size: 13px; }
.cmt-empty { color: #999; font-size: 12px; }
.cmt { background: #fff; border: 1px solid #eee; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; }
.cmt-head { font-size: 11px; color: #888; margin-bottom: 2px; }
.cmt-body { font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
.cmt-form { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; max-width: 520px; }
.cmt-form input, .cmt-form textarea { border: 1px solid #ccc; border-radius: 6px; padding: 7px; font-size: 13px; font-family: inherit; }
.cmt-form textarea { resize: vertical; }
.cmt-form button { align-self: flex-start; border: none; border-radius: 6px; background: #1976d2; color: #fff; font-weight: 600; padding: 7px 16px; cursor: pointer; }
.cmt-form button:disabled { opacity: .5; cursor: default; }
</style>
