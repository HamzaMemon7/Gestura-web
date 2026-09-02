import axios from 'axios'

/**
 * Shared axios instance. The baseURL stays empty because Vite proxies every
 * `/api` request to the Express server on :5000 (see vite.config.js).
 */
const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' }
})

// Attach the JWT to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** Normalises an axios error into a human-readable string. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.message) return error.response.data.message
  if (error?.response?.data?.error) return error.response.data.error
  if (error?.code === 'ERR_NETWORK') return 'Cannot reach the server. Is the API running on port 5000?'
  if (error?.message) return error.message
  return fallback
}

export default api
