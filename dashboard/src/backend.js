import { supabase } from './supabase'
import { api as legacyApi } from './api'

// Supabase modu: doğrudan Postgres (RLS) + Auth.
const supabaseBackend = {
  mode: 'supabase',
  needsAuth: false, // açık mod: dashboard login istemez (anon key ile okur/günceller)
  async projects() {
    const { data, error } = await supabase.from('projects').select('key,name').order('name')
    if (error) throw error
    return data
  },
  async list({ project, status, category, assignee } = {}) {
    let q = supabase.from('feedback').select('*').order('created_at', { ascending: false })
    if (project) q = q.eq('project_key', project)
    if (status) q = q.eq('status', status)
    if (category) q = q.eq('category', category)
    if (assignee) q = q.eq('assignee', assignee)
    const { data, error } = await q
    if (error) throw error
    return data
  },
  async assignees() {
    const { data, error } = await supabase.from('feedback').select('assignee').not('assignee', 'is', null)
    if (error) throw error
    return [...new Set(data.map((r) => r.assignee).filter((a) => a && a.trim()))].sort()
  },
  async get(id) {
    const { data, error } = await supabase.from('feedback').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  async update(id, patch) {
    const { data, error } = await supabase
      .from('feedback')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },
  async vote(id, dir) {
    const { data, error } = await supabase.rpc('vote', { fid: id, delta: dir })
    if (error) throw error
    return { votes: data }
  },
  async comments(feedbackId) {
    const { data, error } = await supabase
      .from('feedback_comments')
      .select('id, author, body, created_at')
      .eq('feedback_id', feedbackId)
      .order('created_at')
    if (error) throw error
    return data
  },
  async addComment(feedbackId, c) {
    const { data, error } = await supabase
      .from('feedback_comments')
      .insert({ feedback_id: feedbackId, author: c.author || null, body: c.body })
      .select()
      .single()
    if (error) throw error
    return data
  },
  async currentUser() {
    const { data } = await supabase.auth.getUser()
    return data.user
  },
  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  },
  async signOut() {
    await supabase.auth.signOut()
  },
  onAuth(cb) {
    return supabase.auth.onAuthStateChange((_e, session) => cb(session ? session.user : null))
  },
}

// Yerel (self-host Fastify) modu: auth yok, hep açık.
const legacyBackend = {
  mode: 'legacy',
  needsAuth: false,
  ...legacyApi,
  async currentUser() {
    return { local: true }
  },
  async signIn() {},
  async signOut() {},
  onAuth() {
    return { data: { subscription: { unsubscribe() {} } } }
  },
}

export const backend = supabase ? supabaseBackend : legacyBackend
