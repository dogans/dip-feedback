<script setup>
import { ref } from 'vue'
import { backend } from './backend'

const emit = defineEmits(['authed'])
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await backend.signIn(email.value.trim(), password.value)
    emit('authed')
  } catch (e) {
    error.value = e?.message || 'Sign in failed.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="login">
    <form class="card" @submit.prevent="submit">
      <h1>🐞 Feedback</h1>
      <p class="sub">Sign in to the admin panel</p>
      <input v-model="email" type="email" placeholder="Email" autocomplete="username" />
      <input v-model="password" type="password" placeholder="Password" autocomplete="current-password" />
      <button :disabled="busy" type="submit">{{ busy ? '…' : 'Sign in' }}</button>
      <div v-if="error" class="err">{{ error }}</div>
    </form>
  </div>
</template>

<style scoped>
.login { height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f6f8; }
.card { background: #fff; padding: 28px; border-radius: 10px; box-shadow: 0 8px 30px rgba(0, 0, 0, .12); width: 300px; display: flex; flex-direction: column; gap: 10px; }
h1 { margin: 0; font-size: 20px; }
.sub { margin: 0 0 8px; color: #888; font-size: 13px; }
input { padding: 9px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; }
button { padding: 9px; border: none; border-radius: 6px; background: #1976d2; color: #fff; font-weight: 600; cursor: pointer; }
button:disabled { opacity: .6; }
.err { color: #e53935; font-size: 12px; }
</style>
