/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override the API origin. Empty (default) means "same origin", i.e. via the Vite dev proxy. */
  readonly VITE_API_BASE?: string
  /** Override the WebSocket URL entirely. Default derives from window.location. */
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
