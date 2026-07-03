<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { backend } from './backend'
import Setup from './Setup.vue'
import Login from './Login.vue'

const view = ref('inbox') // 'inbox' | 'setup'

const STATUSES = ['open', 'in_progress', 'done', 'wontfix']
const PRIORITIES = ['low', 'normal', 'high']
const STATUS_LABEL = { open: 'Açık', in_progress: 'Devam', done: 'Bitti', wontfix: 'Yapılmayacak' }
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

const fmt = (d) => new Date(d).toLocaleString('tr-TR')

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
        <button :class="{ active: view === 'inbox' }" @click="view = 'inbox'">Gelen Kutusu</button>
        <button :class="{ active: view === 'setup' }" @click="view = 'setup'">Kurulum</button>
      </nav>
      <template v-if="view === 'inbox'">
        <select v-model="filters.project">
          <option value="">Tüm projeler</option>
          <option v-for="p in projects" :key="p.key" :value="p.key">{{ p.name }}</option>
        </select>
        <select v-model="filters.status">
          <option value="">Tüm durumlar</option>
          <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
        </select>
        <select v-model="filters.category">
          <option value="">Tüm türler</option>
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ CAT_LABEL[c] }}</option>
        </select>
        <select v-model="filters.assignee">
          <option value="">Tüm atananlar</option>
          <option v-for="a in assignees" :key="a" :value="a">{{ a }}</option>
        </select>
        <span class="count">{{ items.length }} kayıt</span>
      </template>
      <button v-if="user && user.email" class="logout" @click="logout" :title="user.email">Çıkış</button>
    </header>

    <Setup v-if="view === 'setup'" :projects="projects" />

    <div class="main" v-else>
      <ul class="list">
        <li v-if="loading" class="empty">Yükleniyor…</li>
        <li v-else-if="!items.length" class="empty">Kayıt yok.</li>
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
          </div>
          <div class="title">{{ it.title || it.comment || '(boş)' }}</div>
          <div class="meta">{{ it.reporter || 'anonim' }} · {{ fmt(it.created_at) }}</div>
        </li>
      </ul>

      <section class="detail" v-if="selected">
        <div class="dhead">
          <strong>#{{ selected.id }}</strong> · {{ projName(selected.project_key) }}
          <span class="cat-badge" :data-c="selected.category">{{ CAT_LABEL[selected.category] || selected.category }}</span>
          <a v-if="selected.url" :href="selected.url" target="_blank" rel="noopener">↗ sayfa</a>
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
          <label>Durum
            <select :value="selected.status" @change="patch('status', $event.target.value)">
              <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
            </select>
          </label>
          <label>Öncelik
            <select :value="selected.priority" @change="patch('priority', $event.target.value)">
              <option v-for="p in PRIORITIES" :key="p" :value="p">{{ p }}</option>
            </select>
          </label>
          <label>Atanan
            <input
              :value="selected.assignee || ''"
              placeholder="—"
              @change="patch('assignee', $event.target.value)"
            />
          </label>
        </div>

        <ul class="metalist">
          <li>Raporlayan: {{ selected.reporter || 'anonim' }}</li>
          <li>Viewport: {{ selected.viewport_w }}×{{ selected.viewport_h }}</li>
          <li>Tarih: {{ fmt(selected.created_at) }}</li>
          <li class="ua">{{ selected.user_agent }}</li>
        </ul>
      </section>
      <section class="detail empty2" v-else>Bir kayıt seçin.</section>
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
</style>
