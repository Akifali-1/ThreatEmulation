/**
 * API + WebSocket location.
 *
 * Defaults are same-origin so traffic rides the Vite dev proxy (see vite.config.ts) and
 * we never depend on the backend's CORS configuration. Point straight at the backend by
 * setting VITE_API_BASE=http://localhost:8000 and VITE_WS_URL=ws://localhost:8000/ws/logs
 * in a .env file if you'd rather skip the proxy.
 */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? ''

function resolveWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL
  if (explicit) return explicit
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/logs`
}

export const WS_URL: string = resolveWsUrl()
