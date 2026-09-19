import { API_BASE } from '../../config'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ApiError'
    this.status = status
  }

  /** True when the request never reached the backend (offline, proxy failure, DNS). */
  get isNetworkError(): boolean {
    return this.status === 0
  }

  /** True when the route or resource does not exist. */
  get isNotFound(): boolean {
    return this.status === 404
  }
}

/** Turns an unknown rejection reason into something worth putting in front of a user. */
export function describeError(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  return String(reason)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch (cause) {
    throw new ApiError(
      `Cannot reach the backend at ${API_BASE || window.location.origin}. Is the API server running?`,
      0,
      { cause },
    )
  }

  if (!response.ok) {
    // The Vite dev proxy answers 502/504 when it can't reach the backend at all, which is a
    // different problem from the backend returning an error.
    if (response.status === 502 || response.status === 504) {
      throw new ApiError(
        `Backend unreachable through the dev proxy (HTTP ${response.status}).`,
        response.status,
      )
    }

    let detail = ''
    try {
      detail = (await response.text()).slice(0, 300)
    } catch {
      detail = ''
    }
    throw new ApiError(
      `${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}`,
      response.status,
    )
  }

  return (await response.json()) as T
}

/**
 * Guards the list endpoints against a schema change. Without this a non-array body surfaces
 * as "result.map is not a function" from deep inside a component; this names the endpoint.
 */
async function requestArray<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const value = await request<unknown>(path, { signal })
  if (!Array.isArray(value)) {
    throw new ApiError(
      `${path} returned ${value === null ? 'null' : typeof value}, expected an array`,
      0,
    )
  }
  return value as T[]
}

export { request, requestArray }
