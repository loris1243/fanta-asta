'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Users
} from 'lucide-react'

import {
  getUsers,
  createUser,
  deleteUser,
} from '../../../app/actions/users'

import {
  getCurrentUser,
  logout,
} from '../../../app/actions/auth'

import {
  getLeagueSettings,
} from '../../../app/actions/settings'

import DashboardSidebar from '../../../components/DashboardSidebar'

interface AdminUser {
  id: string
  username: string
  role: string
  budget: number
}

interface CurrentUser {
  id: string
  username: string
  role: string
  budget: number
}

interface Message {
  type: 'success' | 'error'
  text: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null)

  const [defaultBudget, setDefaultBudget] =
    useState(500)

  const [maxUsers, setMaxUsers] =
    useState<number | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  const [message, setMessage] =
    useState<Message | null>(null)

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false)

  const loadData = async () => {
    try {
      setLoading(true)

      const [
        userData,
        settings,
        activeUser,
      ] = await Promise.all([
        getUsers(),
        getLeagueSettings(),
        getCurrentUser(),
      ])

      setUsers(userData || [])
      setCurrentUser(activeUser)

      setDefaultBudget(
        settings?.initial_budget || 500
      )

      setMaxUsers(
        settings?.max_participants ?? null
      )
    } catch (error) {
      console.error(
        'Errore caricamento partecipanti:',
        error
      )

      setMessage({
        type: 'error',
        text:
          'Impossibile caricare i partecipanti della lega.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleLogout = async () => {
    await logout()
  }

  const handleCreateUser = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()

    if (isLimitReached) return

    setSaving(true)
    setMessage(null)

    const formElement = e.currentTarget
    const formData = new FormData(formElement)

    formData.append(
      'budget',
      defaultBudget.toString()
    )

    try {
      const result = await createUser(formData)

      /*
       * Supportiamo sia action che restituiscono
       * { success, error } sia action che non
       * restituiscono nulla.
       */
      if (
        result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === false
      ) {
        throw new Error(
          'error' in result && result.error
            ? String(result.error)
            : 'Impossibile creare il partecipante.'
        )
      }

      await loadData()

      formElement.reset()

      setMessage({
        type: 'success',
        text: 'Partecipante aggiunto con successo.',
      })
    } catch (error: any) {
      console.error(
        'Errore creazione partecipante:',
        error
      )

      setMessage({
        type: 'error',
        text:
          error?.message ||
          'Errore durante la creazione del partecipante.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (
    user: AdminUser
  ) => {
    if (
      currentUser &&
      user.id === currentUser.id
    ) {
      return
    }

    const confirmed = window.confirm(
      `Vuoi davvero eliminare il partecipante "${user.username}"?`
    )

    if (!confirmed) return

    setDeletingId(user.id)
    setMessage(null)

    try {
      const result = await deleteUser(user.id)

      if (
        result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === false
      ) {
        throw new Error(
          'error' in result && result.error
            ? String(result.error)
            : 'Impossibile eliminare il partecipante.'
        )
      }

      await loadData()

      setMessage({
        type: 'success',
        text: `Partecipante "${user.username}" eliminato.`,
      })
    } catch (error: any) {
      console.error(
        'Errore eliminazione partecipante:',
        error
      )

      setMessage({
        type: 'error',
        text:
          error?.message ||
          'Errore durante l’eliminazione del partecipante.',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const isLimitReached =
    maxUsers !== null &&
    users.length >= maxUsers

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />

          <p className="text-xs text-muted font-semibold tracking-wider uppercase">
            Caricamento partecipanti...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col md:flex-row">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <DashboardSidebar
        user={{
          username: currentUser?.username || 'admin',
          role: currentUser?.role || 'admin',
        }}
        remainingBudget={currentUser?.budget || 0}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onLogout={handleLogout}
      />

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto space-y-6">

          {/* HEADER */}

          <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">

            <div>
              {/* <Link
                href="/"
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  text-xs
                  font-bold
                  tracking-wider
                  text-muted
                  hover:text-white
                  uppercase
                  transition-colors
                  mb-3
                "
              >
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Link> */}

              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>

                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  Amministrazione
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                Partecipanti
              </h1>

              <p className="mt-1.5 text-sm text-muted">
                Aggiungi e gestisci i partecipanti
                della lega.
              </p>
            </div>

            {maxUsers !== null && (
              <div className="self-start lg:self-auto bg-surface-elevated border border-border px-4 py-3 rounded-xl">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-2">
                  Partecipanti
                </p>

                <p className="text-lg font-black mt-0.5">
                  <span
                    className={
                      isLimitReached
                        ? 'text-danger'
                        : 'text-success'
                    }
                  >
                    {users.length}
                  </span>

                  <span className="text-muted-2">
                    {' '}
                    / {maxUsers}
                  </span>
                </p>
              </div>
            )}
          </header>

          {/* =====================================================
              MESSAGE
          ===================================================== */}

          {message && (
            <div
              className={`
                rounded-2xl
                border
                p-4
                flex items-start gap-3
                ${
                  message.type === 'success'
                    ? 'bg-success/10 border-success/30'
                    : 'bg-danger/10 border-danger/30'
                }
              `}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-danger shrink-0" />
              )}

              <p
                className={`
                  text-xs font-semibold
                  ${
                    message.type === 'success'
                      ? 'text-success'
                      : 'text-danger-hover'
                  }
                `}
              >
                {message.text}
              </p>
            </div>
          )}

          {/* =====================================================
              LIMIT WARNING
          ===================================================== */}

          {isLimitReached && (
            <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-danger shrink-0" />

              <div>
                <p className="text-sm font-bold text-danger-hover">
                  Numero massimo raggiunto
                </p>

                <p className="text-xs text-danger/70 mt-1">
                  Hai raggiunto il numero massimo
                  di partecipanti consentito
                  dalle impostazioni della lega.
                </p>
              </div>
            </div>
          )}

          {/* =====================================================
              ADD USER
          ===================================================== */}

          <section
            className={`
              bg-surface-elevated/80
              border
              rounded-2xl
              shadow-xl
              overflow-hidden
              ${
                isLimitReached
                  ? 'border-border/50 opacity-70'
                  : 'border-border'
              }
            `}
          >
            <div className="p-5 md:p-6 border-b border-border/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>

                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Aggiungi partecipante
                  </h2>

                  <p className="text-xs text-muted mt-0.5">
                    Il nuovo partecipante riceverà{' '}
                    <span className="text-success font-bold">
                      {defaultBudget} FM
                    </span>
                    .
                  </p>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleCreateUser}
              className="p-5 md:p-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                <div className="xl:col-span-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted font-bold block mb-1.5">
                    Username
                  </label>

                  <input
                    name="username"
                    required
                    disabled={
                      isLimitReached ||
                      saving
                    }
                    placeholder="es. FC Real"
                    className="
                      w-full
                      bg-background/70
                      border border-border
                      rounded-xl
                      px-3.5 py-3
                      text-sm text-white
                      placeholder-muted-2
                      focus:border-primary
                      focus:ring-1
                      focus:ring-primary/30
                      outline-none
                      transition-all
                      disabled:opacity-50
                    "
                  />
                </div>

                <div className="xl:col-span-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted font-bold block mb-1.5">
                    Password
                  </label>

                  <input
                    name="password"
                    type="password"
                    required
                    minLength={4}
                    disabled={
                      isLimitReached ||
                      saving
                    }
                    placeholder="Password"
                    className="
                      w-full
                      bg-background/70
                      border border-border
                      rounded-xl
                      px-3.5 py-3
                      text-sm text-white
                      placeholder-muted-2
                      focus:border-primary
                      focus:ring-1
                      focus:ring-primary/30
                      outline-none
                      transition-all
                      disabled:opacity-50
                    "
                  />
                </div>

                <div className="xl:col-span-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted font-bold block mb-1.5">
                    Ruolo
                  </label>

                  <select
                    name="role"
                    disabled={
                      isLimitReached ||
                      saving
                    }
                    defaultValue="user"
                    className="
                      w-full
                      bg-background/70
                      border border-border
                      rounded-xl
                      px-3.5 py-3
                      text-sm text-white
                      focus:border-primary
                      focus:ring-1
                      focus:ring-primary/30
                      outline-none
                      transition-all
                      disabled:opacity-50
                    "
                  >
                    <option value="user">
                      User
                    </option>

                    <option value="admin">
                      Admin
                    </option>
                  </select>
                </div>

                <div className="xl:col-span-1 flex items-end">
                  <button
                    type="submit"
                    disabled={
                      isLimitReached ||
                      saving
                    }
                    className="
                      w-full
                      h-[46px]
                      px-5
                      bg-primary
                      hover:bg-primary-hover
                      text-white
                      text-sm
                      font-bold
                      rounded-xl
                      transition-all
                      shadow-md
                      shadow-primary/20
                      active:scale-[0.98]
                      disabled:opacity-50
                      disabled:cursor-not-allowed
                      flex items-center
                      justify-center
                      gap-2
                    "
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creazione...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Aggiungi
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* =====================================================
              USERS LIST
          ===================================================== */}

          <section className="bg-surface-elevated/80 border border-border rounded-2xl shadow-xl overflow-hidden">

            <div className="p-5 md:p-6 border-b border-border/70">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Partecipanti della lega
                  </h2>

                  <p className="text-xs text-muted mt-0.5">
                    {users.length}{' '}
                    {users.length === 1
                      ? 'partecipante'
                      : 'partecipanti'}
                  </p>
                </div>
              </div>
            </div>

            {users.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-background/60 border border-border flex items-center justify-center mx-auto mb-3">
                  <Users className="w-5 h-5 text-muted-2" />
                </div>

                <p className="text-sm font-bold text-muted">
                  Nessun partecipante trovato
                </p>

                <p className="text-xs text-muted-2 mt-1">
                  Aggiungi il primo partecipante
                  utilizzando il modulo qui sopra.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {users.map((u) => {
                  const isSelf =
                    currentUser &&
                    u.id === currentUser.id

                  const isDeleting =
                    deletingId === u.id

                  return (
                    <div
                      key={u.id}
                      className="
                        p-4 md:p-5
                        flex items-center
                        justify-between
                        gap-4
                        hover:bg-surface-elevated/70
                        transition-colors
                      "
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="
                          w-10 h-10
                          rounded-xl
                          bg-background
                          border border-border
                          flex items-center
                          justify-center
                          text-sm
                          font-black
                          text-white
                          shrink-0
                        ">
                          {u.username
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-white truncate">
                              {u.username}
                            </p>

                            {u.role === 'admin' && (
                              <span className="
                                text-[9px]
                                bg-accent/10
                                text-accent
                                border border-accent/30
                                px-2 py-0.5
                                rounded-md
                                font-black
                                uppercase
                                tracking-wider
                              ">
                                Admin
                              </span>
                            )}

                            {isSelf && (
                              <span className="
                                text-[9px]
                                bg-primary/10
                                text-primary-hover
                                border border-primary/30
                                px-2 py-0.5
                                rounded-md
                                font-black
                                uppercase
                                tracking-wider
                              ">
                                Tu
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-muted-2 mt-0.5">
                            {u.role === 'admin'
                              ? 'Amministratore'
                              : 'Partecipante'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 md:gap-5 shrink-0">
                        <div className="text-right">
                          <p className="text-[9px] uppercase tracking-wider font-bold text-muted-2">
                            Budget
                          </p>

                          <p className="text-sm font-black font-mono text-success">
                            {u.budget} FM
                          </p>
                        </div>

                        {!isSelf && (
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() =>
                              handleDelete(u)
                            }
                            title={`Elimina ${u.username}`}
                            className="
                              w-9 h-9
                              rounded-xl
                              flex items-center
                              justify-center
                              text-muted-2
                              hover:text-danger
                              hover:bg-danger/10
                              border
                              border-transparent
                              hover:border-danger/20
                              transition-all
                              disabled:opacity-50
                            "
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

/* =========================================================
   ICONA FANTASTA
========================================================= */

function GavelIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="m14.5 6.5 3 3" />
      <path d="m12 9 3 3" />
      <path d="m4 20 7-7" />
      <path d="m3 21 4-4" />
      <path d="m6 13 5 5" />
      <path d="m9 4 11 11" />
      <path d="M14 3 21 10" />
      <path d="M3 17h7" />
    </svg>
  )
}