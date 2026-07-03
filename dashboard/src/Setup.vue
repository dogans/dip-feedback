<script setup>
import { ref, computed, watch } from 'vue'
import { BASE } from './api'

const props = defineProps({
  projects: { type: Array, default: () => [] },
})

const selected = ref('')
const copied = ref(false)

// Projeler (async yüklenir) gelince ilkini varsayılan seç
watch(
  () => props.projects,
  (list) => {
    if (!selected.value && list.length) selected.value = list[0].key
  },
  { immediate: true }
)

const projectKey = computed(() => selected.value || (props.projects[0] && props.projects[0].key) || 'metaworks')

// Supabase modu mu? (env verilmişse). widget.js Supabase'de dashboard origin'inden servis edilir.
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseMode = Boolean(SUPA_URL && SUPA_ANON)
const widgetSrc = supabaseMode ? `${location.origin}/widget.js` : `${BASE}/widget.js`

// javascript: bookmarklet — hedef sayfaya widget.js'i enjekte eder.
const bookmarklet = computed(() => {
  const p = projectKey.value
  const attrs = supabaseMode
    ? `s.dataset.project='${p}';s.dataset.supabase='${SUPA_URL}';s.dataset.anon='${SUPA_ANON}';s.dataset.env='staging';`
    : `s.dataset.project='${p}';s.dataset.api='${BASE}';s.dataset.env='staging';`
  return (
    'javascript:(function(){var s=document.createElement(\'script\');' +
    `s.src='${widgetSrc}';${attrs}document.body.appendChild(s);})()`
  )
})

async function copy() {
  try {
    await navigator.clipboard.writeText(bookmarklet.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch (e) {
    copied.value = false
  }
}
</script>

<template>
  <div class="setup">
    <h2>Install the feedback button</h2>
    <p class="lead">
      Collect feedback without adding any code to your site. <b>Drag the button below to your
      browser's bookmarks bar</b>. Then, on any page, click it and the 🐞 widget appears at the
      bottom right.
    </p>

    <label class="field">
      Project
      <select v-model="selected">
        <option v-for="p in projects" :key="p.key" :value="p.key">{{ p.name }} ({{ p.key }})</option>
      </select>
    </label>

    <div class="drag-area">
      <!-- Dragging creates a bookmarklet; click is prevented (so it doesn't fire by accident) -->
      <a class="bm" :href="bookmarklet" draggable="true" @click.prevent>🐞 Feedback → {{ projectKey }}</a>
      <span class="drag-hint">↑ drag this to your bookmarks bar</span>
    </div>

    <div class="fallback">
      <p class="fb-title">Can't drag? Copy the code and add it manually:</p>
      <textarea readonly rows="3" class="code" @focus="$event.target.select()">{{ bookmarklet }}</textarea>
      <button class="copy" @click="copy">{{ copied ? 'Copied ✓' : 'Copy code' }}</button>

      <details>
        <summary>Chrome</summary>
        <ol>
          <li>Bookmark Manager: <kbd>⌘ ⌥ B</kbd></li>
          <li>Top right <b>⋮</b> → <b>Add new bookmark</b></li>
          <li>Name: <code>🐞 Feedback</code> · URL: <b>paste</b> (<kbd>⌘ V</kbd>) → Save</li>
        </ol>
      </details>
      <details>
        <summary>Safari</summary>
        <ol>
          <li>Show the favorites bar: <kbd>⌘ ⇧ B</kbd></li>
          <li>On any page <kbd>⌘ D</kbd> → add to <b>Favorites</b>, name it <code>🐞 Feedback</code></li>
          <li>Edit Bookmarks: <kbd>⌘ ⌥ B</kbd></li>
          <li>Double-click the <b>Address</b> field of 🐞 Feedback → <b>paste</b> the code → Enter</li>
        </ol>
        <p class="tiny">Safari strips a manually typed <code>javascript:</code> in the "add" dialog, so create the bookmark first, then <b>edit its address</b>.</p>
      </details>
    </div>

    <ol class="steps">
      <li>Drag the button to your bookmarks bar (once).</li>
      <li>Open your app or website.</li>
      <li>Click <b>🐞 Feedback</b> in the bar → highlight + write a comment → send.</li>
      <li>The record lands in the <b>Inbox</b>.</li>
    </ol>

    <p class="note">
      Note: this runs <b>inside</b> the page → real screenshot + full access. Some third-party sites
      with strict CSP may block the injected script; your own apps won't have this issue.
    </p>
  </div>
</template>

<style scoped>
.setup { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
h2 { margin: 0 0 6px; }
.lead { color: #555; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #555; max-width: 320px; margin: 16px 0; }
.field select { padding: 8px; border: 1px solid #ccc; border-radius: 6px; }
.drag-area { display: flex; align-items: center; gap: 12px; padding: 20px; border: 2px dashed #b7c6db; border-radius: 10px; background: #f7fafd; }
.bm {
  display: inline-block; background: #1976d2; color: #fff; text-decoration: none;
  padding: 10px 16px; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: grab;
  box-shadow: 0 3px 10px rgba(0,0,0,.2);
}
.drag-hint { font-size: 12px; color: #888; }
.fallback { margin: 18px 0; padding: 14px; border: 1px solid #eee; border-radius: 8px; background: #fafbfc; }
.fb-title { margin: 0 0 6px; font-size: 13px; color: #555; }
.fallback summary { cursor: pointer; color: #1976d2; font-size: 13px; margin-top: 8px; }
.fallback ol { margin: 6px 0 0; font-size: 13px; color: #444; line-height: 1.7; }
.code { width: 100%; font-family: ui-monospace, monospace; font-size: 12px; padding: 8px; border: 1px solid #ccc; border-radius: 6px; }
.copy { margin-top: 6px; padding: 6px 12px; border: none; border-radius: 6px; background: #eee; cursor: pointer; font-size: 13px; }
kbd { background: #eef1f4; border: 1px solid #d3d8de; border-radius: 4px; padding: 1px 5px; font-size: 11px; font-family: ui-monospace, monospace; }
.tiny { font-size: 11px; color: #999; margin-top: 6px; }
.steps { color: #444; line-height: 1.7; }
.note { font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 12px; }
</style>
