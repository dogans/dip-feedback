export const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')

async function req(path, opts) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.status === 204 ? null : res.json()
}

export const api = {
  projects: () => req('/api/projects'),
  assignees: () => req('/api/assignees'),
  list: ({ project, status, category, assignee } = {}) => {
    const q = new URLSearchParams()
    if (project) q.set('project', project)
    if (status) q.set('status', status)
    if (category) q.set('category', category)
    if (assignee) q.set('assignee', assignee)
    const qs = q.toString()
    return req('/api/feedback' + (qs ? `?${qs}` : ''))
  },
  get: (id) => req(`/api/feedback/${id}`),
  update: (id, patch) => req(`/api/feedback/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
}
