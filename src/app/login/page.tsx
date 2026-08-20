'use client'

import { useState } from 'react'
import { loginWithUsername } from '../actions/auth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await loginWithUsername(username, password)

    if (res.success) {
      window.location.href = '/'
    } else {
      setError(res.error || 'Errore durante il login')
      setLoading(false)
    }
  }

  return (
  <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
    {/* Background */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />
      <div className="absolute bottom-[-200px] left-[-100px] h-[450px] w-[450px] rounded-full bg-info/10 blur-[130px]" />
      <div className="absolute top-1/2 right-[-150px] h-[400px] w-[400px] rounded-full bg-accent/5 blur-[130px]" />
    </div>

    {/* Content */}
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">

        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-3xl shadow-[0_0_40px_rgba(47,158,110,0.12)]">
            ⚽
          </div>

          <h1 className="text-4xl font-black tracking-tight">
            Fanta<span className="text-primary">Asta</span>
          </h1>

          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-border-strong" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-2">
              Live Fantasy Football
            </span>
            <span className="h-px w-8 bg-border-strong" />
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl border border-border bg-surface/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">

          <div className="mb-7">
            <h2 className="text-xl font-black text-white">
              Bentornato
            </h2>

            <p className="mt-1 text-sm text-muted-2">
              Accedi per entrare nella tua lega.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">

            {/* Username */}
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-muted">
                Username
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm text-muted-2">
                  👤
                </span>

                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Inserisci username"
                  className="w-full rounded-xl border border-border bg-background py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-muted-2 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-muted">
                Password
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm text-muted-2">
                  🔒
                </span>

                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Inserisci password"
                  className="w-full rounded-xl border border-border bg-background py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-muted-2 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-primary py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Accesso in corso...' : 'Entra nella Lega'}
            </button>

          </form>

          {/* Footer */}
          <div className="mt-7 border-t border-border pt-5 text-center">
            <p className="text-[11px] leading-relaxed text-muted-2">
              Le iscrizioni vengono gestite direttamente
              dall'amministratore della lega.
            </p>
          </div>

        </div>

        {/* Bottom label */}
        <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-2">
          FantaAsta
        </p>

      </div>
    </div>
  </main>
)
}