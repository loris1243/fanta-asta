'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  Shield,
  Target,
  ClipboardList,
  Inbox,
  Users,
  Settings,
  ScrollText,
  Building2,
  LogOut,
  UserPlus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
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
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />

          <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
            Caricamento partecipanti...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`
          relative shrink-0
          bg-slate-900/95
          border-r border-slate-800
          shadow-xl
          transition-[width]
          duration-300
          ease-in-out
          flex flex-col
          ${
            isSidebarOpen
              ? 'w-full md:w-64'
              : 'w-full md:w-[76px]'
          }
        `}
      >
        {/* HEADER */}

        <div className="relative p-3 md:p-4">
          <div
            className={`
              relative flex items-center
              ${
                isSidebarOpen
                  ? 'justify-between'
                  : 'justify-center'
              }
              min-h-10
            `}
          >
            <div
              className={`
                flex items-center
                ${
                  isSidebarOpen
                    ? 'gap-3'
                    : 'justify-center'
                }
                min-w-0
              `}
            >
              <div
                className="
                  w-10 h-10 shrink-0
                  rounded-xl
                  bg-blue-600
                  text-white
                  flex items-center justify-center
                  shadow-lg shadow-blue-600/20
                "
              >
                <GavelIcon />
              </div>

              {isSidebarOpen && (
                <div className="min-w-0">
                  <h1 className="font-extrabold text-base tracking-tight text-white leading-tight">
                    FantAsta
                  </h1>

                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Aste Live
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setIsSidebarOpen(
                  (prev) => !prev
                )
              }
              aria-label={
                isSidebarOpen
                  ? 'Comprimi barra laterale'
                  : 'Espandi barra laterale'
              }
              title={
                isSidebarOpen
                  ? 'Comprimi sidebar'
                  : 'Espandi sidebar'
              }
              className={`
                hidden md:flex
                items-center justify-center
                w-7 h-7
                rounded-lg
                text-slate-500
                hover:text-white
                hover:bg-slate-800
                transition-all
                ${
                  !isSidebarOpen
                    ? 'absolute -right-2 top-1/2 -translate-y-1/2 z-20 bg-slate-900 border border-slate-700 shadow-lg'
                    : ''
                }
              `}
            >
              <span className="text-[10px] font-black">
                {isSidebarOpen ? '◀' : '▶'}
              </span>
            </button>
          </div>
        </div>

        {/* USER CARD */}

        <div
          className={`
            mx-3 md:mx-4
            mb-5
            bg-slate-950/70
            border border-slate-800
            rounded-xl
            ${
              isSidebarOpen
                ? 'p-3'
                : 'p-2'
            }
          `}
        >
          <div
            className={`
              flex items-center
              ${
                isSidebarOpen
                  ? 'gap-3'
                  : 'justify-center'
              }
            `}
          >
            <div
              className="
                w-10 h-10
                shrink-0
                rounded-lg
                bg-blue-500/10
                text-blue-300
                border border-blue-500/30
                flex items-center justify-center
                font-black text-xs
              "
            >
              {currentUser?.username
                ?.slice(0, 2)
                .toUpperCase()}
            </div>

            {isSidebarOpen && (
              <div className="min-w-0 overflow-hidden">
                <p className="text-sm font-bold text-white truncate">
                  {currentUser?.username}
                </p>

                <p className="text-xs text-emerald-400 font-extrabold mt-0.5">
                  {currentUser?.budget} FM
                </p>
              </div>
            )}
          </div>
        </div>

        {/* NAVIGAZIONE */}

        <nav className="flex-1 px-3 md:px-4 overflow-y-auto">
          <div className="space-y-1.5">

            <Link
              href="/"
              title={
                !isSidebarOpen
                  ? 'Dashboard'
                  : undefined
              }
              className="
                flex items-center
                h-11 rounded-xl
                text-sm font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
                gap-3 px-3.5
              "
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />

              {isSidebarOpen && (
                <span>Dashboard</span>
              )}
            </Link>

            <Link
              href="/rosa"
              title={
                !isSidebarOpen
                  ? 'La Mia Squadra'
                  : undefined
              }
              className="
                flex items-center
                h-11 rounded-xl
                text-sm font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
                gap-3 px-3.5
              "
            >
              <Shield className="w-4 h-4 shrink-0 text-emerald-400" />

              {isSidebarOpen && (
                <span>La Mia Squadra</span>
              )}
            </Link>

            <Link
              href="/obiettivi"
              title={
                !isSidebarOpen
                  ? 'I Miei Obiettivi'
                  : undefined
              }
              className="
                flex items-center
                h-11 rounded-xl
                text-sm font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
                gap-3 px-3.5
              "
            >
              <Target className="w-4 h-4 shrink-0 text-amber-400" />

              {isSidebarOpen && (
                <span>I Miei Obiettivi</span>
              )}
            </Link>

            <Link
              href="/listone"
              title={
                !isSidebarOpen
                  ? 'Listone'
                  : undefined
              }
              className="
                flex items-center
                h-11 rounded-xl
                text-sm font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
                gap-3 px-3.5
              "
            >
              <ClipboardList className="w-4 h-4 shrink-0" />

              {isSidebarOpen && (
                <span>Listone</span>
              )}
            </Link>

            {currentUser?.role === 'admin' && (
              <div className="pt-4 mt-4 border-t border-slate-800">

                {isSidebarOpen && (
                  <span className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Pannello Admin
                  </span>
                )}

                <Link
                  href="/admin/import-listone"
                  title={
                    !isSidebarOpen
                      ? 'Importa Listone'
                      : undefined
                  }
                  className="
                    flex items-center
                    h-10 rounded-xl
                    text-sm font-semibold
                    text-slate-300
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                    gap-3 px-3.5
                  "
                >
                  <Inbox className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span>Importa Listone</span>
                  )}
                </Link>

                <Link
                  href="/admin/users"
                  title={
                    !isSidebarOpen
                      ? 'Gestione Partecipanti'
                      : undefined
                  }
                  className="
                    flex items-center
                    h-10 rounded-xl
                    text-sm font-semibold
                    text-slate-950
                    bg-blue-600
                    shadow-md
                    shadow-blue-600/20
                    transition-all
                    gap-3 px-3.5
                  "
                >
                  <Users className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span>Gestione Partecipanti</span>
                  )}
                </Link>

                <Link
                  href="/admin/settings"
                  title={
                    !isSidebarOpen
                      ? 'Configurazione Lega'
                      : undefined
                  }
                  className="
                    flex items-center
                    h-10 rounded-xl
                    text-sm font-semibold
                    text-slate-300
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                    gap-3 px-3.5
                  "
                >
                  <Settings className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span>Configurazione Lega</span>
                  )}
                </Link>

                {isSidebarOpen && (
                  <span className="px-2 pt-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Anagrafiche
                  </span>
                )}

                <Link
                  href="/admin/anagrafiche/serie-a"
                  title={
                    !isSidebarOpen
                      ? 'Squadre Serie A'
                      : undefined
                  }
                  className="
                    flex items-center
                    h-9 rounded-xl
                    text-xs font-semibold
                    text-slate-400
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                    gap-3 px-3.5
                  "
                >
                  <ScrollText className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span>Squadre Serie A</span>
                  )}
                </Link>

                <Link
                  href="/admin/anagrafiche/squadre_lega"
                  title={
                    !isSidebarOpen
                      ? 'Squadre Lega'
                      : undefined
                  }
                  className="
                    flex items-center
                    h-9 rounded-xl
                    text-xs font-semibold
                    text-slate-400
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                    gap-3 px-3.5
                  "
                >
                  <Building2 className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span>Squadre Lega</span>
                  )}
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* FOOTER */}

        <div className="mt-auto p-3 md:p-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleLogout}
            title={
              !isSidebarOpen
                ? 'Esci'
                : undefined
            }
            className="
              w-full
              flex items-center
              h-11 rounded-xl
              text-sm font-semibold
              text-red-400
              hover:text-red-300
              hover:bg-red-500/10
              transition-all
              gap-3 px-3.5
            "
          >
            <LogOut className="w-4 h-4 shrink-0" />

            {isSidebarOpen && (
              <span>Esci</span>
            )}
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto space-y-6">

          {/* HEADER */}

          <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">

            <div>
              <Link
                href="/"
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  text-xs
                  font-bold
                  tracking-wider
                  text-slate-400
                  hover:text-white
                  uppercase
                  transition-colors
                  mb-3
                "
              >
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Link>

              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>

                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">
                  Amministrazione
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                Partecipanti
              </h1>

              <p className="mt-1.5 text-sm text-slate-400">
                Aggiungi e gestisci i partecipanti
                della lega.
              </p>
            </div>

            {maxUsers !== null && (
              <div className="self-start lg:self-auto bg-slate-800 border border-slate-700 px-4 py-3 rounded-xl">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Partecipanti
                </p>

                <p className="text-lg font-black mt-0.5">
                  <span
                    className={
                      isLimitReached
                        ? 'text-red-400'
                        : 'text-emerald-400'
                    }
                  >
                    {users.length}
                  </span>

                  <span className="text-slate-500">
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
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }
              `}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              )}

              <p
                className={`
                  text-xs font-semibold
                  ${
                    message.type === 'success'
                      ? 'text-emerald-300'
                      : 'text-red-300'
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
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />

              <div>
                <p className="text-sm font-bold text-red-300">
                  Numero massimo raggiunto
                </p>

                <p className="text-xs text-red-200/70 mt-1">
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
              bg-slate-800/80
              border
              rounded-2xl
              shadow-xl
              overflow-hidden
              ${
                isLimitReached
                  ? 'border-slate-700/50 opacity-70'
                  : 'border-slate-700'
              }
            `}
          >
            <div className="p-5 md:p-6 border-b border-slate-700/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-blue-400" />
                </div>

                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Aggiungi partecipante
                  </h2>

                  <p className="text-xs text-slate-400 mt-0.5">
                    Il nuovo partecipante riceverà{' '}
                    <span className="text-emerald-400 font-bold">
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
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5">
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
                      bg-slate-950/70
                      border border-slate-700
                      rounded-xl
                      px-3.5 py-3
                      text-sm text-white
                      placeholder-slate-600
                      focus:border-blue-500
                      focus:ring-1
                      focus:ring-blue-500/30
                      outline-none
                      transition-all
                      disabled:opacity-50
                    "
                  />
                </div>

                <div className="xl:col-span-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5">
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
                      bg-slate-950/70
                      border border-slate-700
                      rounded-xl
                      px-3.5 py-3
                      text-sm text-white
                      placeholder-slate-600
                      focus:border-blue-500
                      focus:ring-1
                      focus:ring-blue-500/30
                      outline-none
                      transition-all
                      disabled:opacity-50
                    "
                  />
                </div>

                <div className="xl:col-span-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5">
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
                      bg-slate-950/70
                      border border-slate-700
                      rounded-xl
                      px-3.5 py-3
                      text-sm text-white
                      focus:border-blue-500
                      focus:ring-1
                      focus:ring-blue-500/30
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
                      bg-blue-600
                      hover:bg-blue-500
                      text-white
                      text-sm
                      font-bold
                      rounded-xl
                      transition-all
                      shadow-md
                      shadow-blue-600/20
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

          <section className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">

            <div className="p-5 md:p-6 border-b border-slate-700/70">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Partecipanti della lega
                  </h2>

                  <p className="text-xs text-slate-400 mt-0.5">
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
                <div className="w-12 h-12 rounded-2xl bg-slate-950/60 border border-slate-700 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-5 h-5 text-slate-500" />
                </div>

                <p className="text-sm font-bold text-slate-300">
                  Nessun partecipante trovato
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  Aggiungi il primo partecipante
                  utilizzando il modulo qui sopra.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/60">
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
                        hover:bg-slate-800/70
                        transition-colors
                      "
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="
                          w-10 h-10
                          rounded-xl
                          bg-slate-950
                          border border-slate-700
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
                                bg-amber-500/10
                                text-amber-300
                                border border-amber-500/30
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
                                bg-blue-500/10
                                text-blue-300
                                border border-blue-500/30
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

                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {u.role === 'admin'
                              ? 'Amministratore'
                              : 'Partecipante'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 md:gap-5 shrink-0">
                        <div className="text-right">
                          <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">
                            Budget
                          </p>

                          <p className="text-sm font-black font-mono text-emerald-400">
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
                              text-slate-500
                              hover:text-red-400
                              hover:bg-red-500/10
                              border
                              border-transparent
                              hover:border-red-500/20
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