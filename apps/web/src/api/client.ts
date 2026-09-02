// Typed API client: wraps fetch, attaches the Bearer token from localStorage,
// parses the shared ApiEnvelope, and clears the token on any 401 so stale
// sessions fall back to the login view. Logout with a stateless JWT discards
// the stored token; the server endpoint documents that contract (204).

import type { ApiEnvelope, LoginResult, PublicUser, RegisterInput } from '@devkit/shared'

const TOKEN_KEY = 'auth_token'

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const token = getToken()
  if (token !== null) {
    headers.authorization = `Bearer ${token}`
  }
  let response: Response
  try {
    response = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiClientError('NETWORK', 'network request failed')
  }
  if (response.status === 204) {
    return undefined as T
  }
  const envelope = (await response.json()) as ApiEnvelope<T>
  if (!envelope.ok) {
    if (response.status === 401) {
      clearToken()
    }
    throw new ApiClientError(envelope.error.code, envelope.error.message)
  }
  return envelope.data
}

export function register(input: RegisterInput): Promise<PublicUser> {
  return request<PublicUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function login(input: RegisterInput): Promise<LoginResult> {
  const result = await request<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  window.localStorage.setItem(TOKEN_KEY, result.token)
  return result
}

export async function fetchCurrentUser(): Promise<PublicUser> {
  const data = await request<{ user: PublicUser }>('/auth/me')
  return data.user
}

export function logout(): void {
  clearToken()
}
