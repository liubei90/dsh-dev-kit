// Login/register view. Renders either the sign-in form or the register form
// plus a signed-in panel after /auth/me succeeds; all copy comes from the
// typed dictionary and every API error maps through the error-code table.

import { useEffect, useState, type FormEvent } from 'react'
import type { PublicUser } from '@devkit/shared'
import {
  ApiClientError,
  fetchCurrentUser,
  login,
  logout,
  register,
} from './api/client.js'
import { copy, errorMessage } from './i18n/zh.js'

type Mode = 'login' | 'register'

export function App() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<PublicUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (window.localStorage.getItem('auth_token') === null) return
    fetchCurrentUser()
      .then((current) => {
        if (!cancelled) setUser(current)
      })
      .catch(() => {
        // 401 already cleared the token; otherwise surface nothing on mount.
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        const result = await login({ email, password })
        setUser(result.user)
        setEmail('')
        setPassword('')
      } else {
        await register({ email, password })
        setNotice(copy.registerSucceeded)
        setMode('login')
      }
    } catch (caught) {
      const code = caught instanceof ApiClientError ? caught.code : 'NETWORK'
      setError(errorMessage(code))
    } finally {
      setBusy(false)
    }
  }

  function handleLogout(): void {
    logout()
    setUser(null)
  }

  if (user !== null) {
    return (
      <main className="card">
        <h1>{copy.appTitle}</h1>
        <p>{copy.signedInAs(user.email)}</p>
        <button type="button" onClick={handleLogout}>
          {copy.logout}
        </button>
      </main>
    )
  }

  const submitting = busy ? copy.submitting : mode === 'login' ? copy.submitLogin : copy.submitRegister

  return (
    <main className="card">
      <h1>{copy.appTitle}</h1>
      <nav aria-label="auth mode">
        <button type="button" onClick={() => { setMode('login'); setError(null); setNotice(null) }} aria-pressed={mode === 'login'}>
          {copy.tabLogin}
        </button>
        <button type="button" onClick={() => { setMode('register'); setError(null); setNotice(null) }} aria-pressed={mode === 'register'}>
          {copy.tabRegister}
        </button>
      </nav>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">{copy.emailLabel}</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            placeholder={copy.emailPlaceholder}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">{copy.passwordLabel}</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            placeholder={copy.passwordPlaceholder}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error !== null && <p role="alert">{error}</p>}
        {notice !== null && <p role="status">{notice}</p>}
        <button type="submit" disabled={busy}>
          {submitting}
        </button>
      </form>
      <button
        type="button"
        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setNotice(null) }}
      >
        {mode === 'login' ? copy.noAccountYet : copy.alreadyHaveAccount}
      </button>
    </main>
  )
}
