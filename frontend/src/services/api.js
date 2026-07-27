import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

export const getMediaUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  const rawApiUrl = import.meta.env.VITE_API_URL || ''
  const backendBase = rawApiUrl ? rawApiUrl.replace(/\/api\/?$/, '') : ''
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`
}

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request (User token or Voting Device token)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('device_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global response error handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const userToken = localStorage.getItem('token')
      const deviceToken = localStorage.getItem('device_token')
      if (userToken) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      } else if (deviceToken && window.location.pathname.startsWith('/device')) {
        localStorage.removeItem('device_token')
        localStorage.removeItem('device_booth')
        window.location.href = '/device'
      }
    }
    return Promise.reject(err)
  }
)

// ─── AUTH ───────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  deviceToken: (boothCode) => api.post('/auth/device-token', { boothCode }),
}

// ─── BOOTHS ─────────────────────────────────────────
export const boothsAPI = {
  getAll: () => api.get('/booths'),
  getOne: (id) => api.get(`/booths/${id}`),
  create: (data) => api.post('/booths', data),
  update: (id, data) => api.put(`/booths/${id}`, data),
  delete: (id) => api.delete(`/booths/${id}`),
}

// ─── POSITIONS ──────────────────────────────────────
export const positionsAPI = {
  getAll: (params) => api.get('/positions', { params }),
  getOne: (id) => api.get(`/positions/${id}`),
  create: (data) => api.post('/positions', data),
  update: (id, data) => api.put(`/positions/${id}`, data),
  delete: (id) => api.delete(`/positions/${id}`),
}

// ─── STUDENTS ───────────────────────────────────────
export const studentsAPI = {
  getAll: (params) => api.get('/students', { params }),
  getOne: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
  bulkCreate: (students) => api.post('/students/bulk', { students }),
  transferStudents: (data) => api.post('/students/bulk-transfer', data),
  bulkDelete: (ids) => api.delete('/students', { data: { ids } }),
  bulkAssignBooth: (data) => api.put('/students/bulk-assign-booth', data),
}

// ─── CANDIDATES ─────────────────────────────────────
export const candidatesAPI = {
  getAll: (params) => api.get('/candidates', { params }),
  create: (formData) => api.post('/candidates', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.put(`/candidates/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/candidates/${id}`),
}

// ─── VOTES ──────────────────────────────────────────
export const votesAPI = {
  cast: (data) => api.post('/votes', data),
  castBulk: (data) => api.post('/votes/bulk', data),
  getBoothVotes: (boothId) => api.get(`/votes/booth/${boothId}`),
}

// ─── ELECTION ───────────────────────────────────────
export const electionAPI = {
  status: () => api.get('/election/status'),
  start: (data) => api.post('/election/start', data),
  stop: () => api.post('/election/stop'),
  startSession: (studentId) => api.post('/election/session/start', { studentId }),
  completeSession: (boothId) => api.post('/election/session/complete', { boothId }),
  resetSession: () => api.post('/election/session/reset'),
  getSession: (boothId) => api.get(`/election/session/${boothId}`),
  getStats: () => api.get('/election/stats'),
  updateSettings: (data) => api.put('/election/settings', data),
}

// ─── RESULTS ────────────────────────────────────────
export const resultsAPI = {
  getAll: () => api.get('/results'),
  getLive: () => api.get('/results/live'),
}

// ─── USERS ──────────────────────────────────────────
export const usersAPI = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
}

export default api
