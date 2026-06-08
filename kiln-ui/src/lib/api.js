// In production the React build is served by FastAPI itself, so /api calls
// go to the same origin. In local dev, Vite proxies /api → localhost:8000.
const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)

  const res = await fetch(BASE + path, opts)

  if (res.status === 204) return null

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.detail || `${res.status} ${res.statusText}`)
  }

  return data
}

// ── Kilns ─────────────────────────────────────────────────
export const kilnsApi = {
  list:   ()          => request('GET',    '/kilns/'),
  get:    (id)        => request('GET',    `/kilns/${id}`),
  create: (data)      => request('POST',   '/kilns/', data),
  update: (id, data)  => request('PUT',    `/kilns/${id}`, data),
  delete: (id)        => request('DELETE', `/kilns/${id}`),
}

// ── Templates ─────────────────────────────────────────────
export const templatesApi = {
  list:      ()         => request('GET',    '/templates/'),
  get:       (id)       => request('GET',    `/templates/${id}`),
  revisions: (id)       => request('GET',    `/templates/${id}/revisions`),
  diff:      (id, oid)  => request('GET',    `/templates/${id}/diff/${oid}`),
  create:    (data)     => request('POST',   '/templates/', data),
  update:    (id, data) => request('PUT',    `/templates/${id}`, data),
  delete:    (id)       => request('DELETE', `/templates/${id}`),
}

// ── Elements ──────────────────────────────────────────────
export const elementsApi = {
  list:   ()          => request('GET',    '/elements/'),
  get:    (id)        => request('GET',    `/elements/${id}`),
  create: (data)      => request('POST',   '/elements/', data),
  update: (id, data)  => request('PUT',    `/elements/${id}`, data),
  delete: (id)        => request('DELETE', `/elements/${id}`),
}

// ── Recipes ───────────────────────────────────────────────
export const recipesApi = {
  list:      ()         => request('GET',    '/recipes/'),
  get:       (id)       => request('GET',    `/recipes/${id}`),
  revisions: (id)       => request('GET',    `/recipes/${id}/revisions`),
  diff:      (id, oid)  => request('GET',    `/recipes/${id}/diff/${oid}`),
  create:    (data)     => request('POST',   '/recipes/', data),
  update:    (id, data) => request('PUT',    `/recipes/${id}`, data),
  delete:    (id)       => request('DELETE', `/recipes/${id}`),
}

// ── Burns ─────────────────────────────────────────────────
export const burnsApi = {
  list:     ()         => request('GET',    '/burns/'),
  get:      (id)       => request('GET',    `/burns/${id}`),
  create:   (data)     => request('POST',   '/burns/', data),
  update:   (id, data) => request('PUT',    `/burns/${id}`, data),
  delete:   (id)       => request('DELETE', `/burns/${id}`),
  start:    (id, test=false) => request('POST', `/burns/${id}/start${test ? '?test_data=true' : ''}`),
  complete: (id)       => request('POST',   `/burns/${id}/complete`),
  abort:    (id)       => request('POST',   `/burns/${id}/abort`),
  getLogs:  (id, params={}) => {
    const q = new URLSearchParams(params).toString()
    return request('GET', `/burns/${id}/logs${q ? '?' + q : ''}`)
  },
  getChartLogs: (id, params={}) => {
    const q = new URLSearchParams(params).toString()
    return request('GET', `/burns/${id}/logs/chart${q ? '?' + q : ''}`)
  },
  getLatestLogs: (id, afterId=0) =>
    request('GET', `/burns/${id}/logs/latest?after_id=${afterId}`),
  addLog:   (id, data) => request('POST',   `/burns/${id}/logs`, data),
  startWithTestData: (id) => request('POST', `/burns/${id}/start?test_data=true`),
  getRecipes:   (id)       => request('GET',    `/burns/${id}/recipes`),
  addRecipe:    (id, data) => request('POST',   `/burns/${id}/recipes`, data),
  removeRecipe: (id, brId) => request('DELETE', `/burns/${id}/recipes/${brId}`),
  simulate: (id, speed=60) => request('POST', `/burns/${id}/simulate?speed=${speed}`),
  // Temperature alerts
  getAlerts:    (id)          => request('GET',    `/burns/${id}/alerts`),
  createAlert:  (id, data)    => request('POST',   `/burns/${id}/alerts`, data),
  updateAlert:  (id, aId, data) => request('PUT',  `/burns/${id}/alerts/${aId}`, data),
  deleteAlert:  (id, aId)     => request('DELETE', `/burns/${id}/alerts/${aId}`),
  // Comments
  getComments:    (id)          => request('GET',    `/burns/${id}/comments`),
  addComment:     (id, data)    => request('POST',   `/burns/${id}/comments`, data),
  updateComment:  (id, cId, data) => request('PUT',  `/burns/${id}/comments/${cId}`, data),
  deleteComment:  (id, cId)     => request('DELETE', `/burns/${id}/comments/${cId}`),
}

// ── Settings ──────────────────────────────────────────────
export const settingsApi = {
  get:              ()     => request('GET',  '/settings/'),
  update:           (data) => request('PUT',  '/settings/', data),
  testNotification: ()     => request('POST', '/settings/test-notification'),
}

// ── Photos ────────────────────────────────────────────────
export const photosApi = {
  list:   (params = {}) => {
    const q = new URLSearchParams()
    if (params.tag)       q.set('tag',       params.tag)
    if (params.burn_id)   q.set('burn_id',   params.burn_id)
    if (params.recipe_id) q.set('recipe_id', params.recipe_id)
    return request('GET', `/photos/${q.toString() ? '?' + q : ''}`)
  },
  tags:   ()            => request('GET',    '/photos/tags'),
  burns:  ()            => request('GET',    '/photos/burns'),
  get:    (id)          => request('GET',    `/photos/${id}`),
  update: (id, data)    => request('PUT',    `/photos/${id}`, data),
  delete: (id)          => request('DELETE', `/photos/${id}`),

  // Upload uses FormData — can't use the regular request() helper
  upload: (formData) => fetch('/api/photos/', { method: 'POST', body: formData })
    .then(async r => {
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.detail || r.statusText)
      return data
    }),
}

// ── System Logs ───────────────────────────────────────────
export const systemLogsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams()
    if (params.burn_id)  q.set('burn_id',  params.burn_id)
    if (params.level)    q.set('level',    params.level)
    if (params.after_id) q.set('after_id', params.after_id)
    if (params.limit)    q.set('limit',    params.limit)
    return request('GET', `/logs/${q.toString() ? '?' + q : ''}`)
  },
  clear: (burn_id) => {
    const q = burn_id ? `?burn_id=${burn_id}` : ''
    return request('DELETE', `/logs/${q}`)
  },
}
