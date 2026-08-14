'use client'

import { useState, useEffect } from 'react'
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
  Save,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Trophy,
  Coins,
  UserRound,
  RotateCcw,
} from 'lucide-react'

import {
  getLeagueSettings,
  updateLeagueSettings,
  resetLeagueAction,
  LeagueSettings,
} from '../../../app/actions/settings'

import {
  getCurrentUser,
  logout,
} from '../../../app/actions/auth'

interface CurrentUser {
  id: string
  username: string
  role: string
  budget: number
}

interface SettingsState
  extends Omit<
    LeagueSettings,
    'auction_timeout_seconds' |
    'call_timeout_seconds'
  > {
  league_name?: string
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null)

  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const [settings, setSettings] =
    useState<SettingsState>({
      max_participants: 8,
      initial_budget: 500,
      league_name: '',
    })

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(true)

  useEffect(() => {
    async function loadSettings() {
      try {
        const [data, user] = await Promise.all([
          getLeagueSettings(),
          getCurrentUser(),
        ])

        setSettings({
          league_name: data.league_name || '',
          max_participants:
            data.max_participants,
          initial_budget:
            data.initial_budget,
        })

        setCurrentUser(user)
      } catch (error) {
        console.error(
          'Errore caricamento impostazioni:',
          error
        )

        setMessage({
          type: 'error',
          text:
            'Impossibile caricare le impostazioni della lega.',
        })
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleLogout = async () => {
    await logout()
  }

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()

    setSaving(true)
    setMessage(null)

    try {
      const formData = new FormData(
        e.currentTarget
      )

      /*
       * IMPORTANTE:
       * Non inviamo più i due timer.
       * Rimangono eventualmente nel database/backend
       * finché non verifichiamo che nessun'altra pagina
       * li utilizzi.
       */
      const res =
        await updateLeagueSettings(formData)

      if (res.success) {
        setMessage({
          type: 'success',
          text:
            'Impostazioni aggiornate con successo.',
        })
      } else {
        setMessage({
          type: 'error',
          text:
            res.error ||
            'Errore durante il salvataggio.',
        })
      }
    } catch (error: any) {
      console.error(
        'Errore salvataggio impostazioni:',
        error
      )

      setMessage({
        type: 'error',
        text:
          error?.message ||
          'Errore durante il salvataggio delle impostazioni.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleResetClick = async () => {
    const confirmed = window.confirm(
      'ATTENZIONE: questa azione azzererà tutte le rose assegnate, cancellerà lo storico delle aste e ripristinerà i crediti iniziali per tutte le squadre. Vuoi procedere?'
    )

    if (!confirmed) return

    setResetting(true)
    setMessage(null)

    try {
      const res =
        await resetLeagueAction()

      if (res.success) {
        setMessage({
          type: 'success',
          text:
            'Lega resettata con successo.',
        })
      } else {
        setMessage({
          type: 'error',
          text:
            res.error ||
            'Errore durante il reset della lega.',
        })
      }
    } catch (error: any) {
      console.error(
        'Errore reset lega:',
        error
      )

      setMessage({
        type: 'error',
        text:
          error?.message ||
          'Errore durante il reset della lega.',
      })
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />

          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Caricamento impostazioni...
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
                    text-slate-300
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                    gap-3 px-3.5
                  "
                >
                  <Users className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span>
                      Gestione Partecipanti
                    </span>
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
                    text-slate-950
                    bg-blue-600
                    shadow-md
                    shadow-blue-600/20
                    transition-all
                    gap-3 px-3.5
                  "
                >
                  <Settings className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span>
                      Configurazione Lega
                    </span>
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
                    <span>
                      Squadre Serie A
                    </span>
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
                    <span>
                      Squadre Lega
                    </span>
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
          MAIN CONTENT
      ===================================================== */}

      <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto space-y-6">

          {/* HEADER */}

          <header>
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
                <Settings className="w-4 h-4 text-blue-400" />
              </div>

              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">
                Amministrazione
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              Configurazione Lega
            </h1>

            <p className="mt-1.5 text-sm text-slate-400">
              Gestisci le impostazioni principali
              della tua lega.
            </p>
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
              SETTINGS FORM
          ===================================================== */}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            {/* =================================================
                INFO LEGA
            ================================================= */}

            <section className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">

              <div className="p-5 md:p-6 border-b border-slate-700/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-blue-400" />
                  </div>

                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-white">
                      Informazioni lega
                    </h2>

                    <p className="text-xs text-slate-400 mt-0.5">
                      Il nome con cui verrà identificata la lega.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6">
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5">
                  Nome della lega
                </label>

                <input
                  type="text"
                  name="league_name"
                  required
                  defaultValue={
                    settings.league_name || ''
                  }
                  placeholder="Es. Fantacalcio degli Amici"
                  className="
                    w-full
                    bg-slate-950/70
                    border border-slate-700
                    rounded-xl
                    px-3.5 py-3
                    text-sm
                    text-white
                    font-bold
                    placeholder-slate-600
                    focus:border-blue-500
                    focus:ring-1
                    focus:ring-blue-500/30
                    outline-none
                    transition-all
                  "
                />

                <p className="text-[11px] text-slate-500 mt-1.5">
                  Questo nome identifica la tua lega
                  all&apos;interno di FantAsta.
                </p>
              </div>
            </section>

            {/* =================================================
                PARAMETRI
            ================================================= */}

            <section className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">

              <div className="p-5 md:p-6 border-b border-slate-700/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-emerald-400" />
                  </div>

                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-white">
                      Parametri lega
                    </h2>

                    <p className="text-xs text-slate-400 mt-0.5">
                      Configura partecipanti e budget iniziale.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* PARTECIPANTI */}

                <div className="rounded-xl bg-slate-950/40 border border-slate-700/70 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <UserRound className="w-4 h-4 text-blue-400" />

                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      Numero massimo partecipanti
                    </label>
                  </div>

                  <input
                    type="number"
                    name="max_participants"
                    required
                    min={2}
                    max={20}
                    defaultValue={
                      settings.max_participants
                    }
                    className="
                      w-full
                      bg-slate-900
                      border border-slate-700
                      rounded-xl
                      px-3.5 py-3
                      text-sm
                      text-white
                      font-bold
                      focus:border-blue-500
                      focus:ring-1
                      focus:ring-blue-500/30
                      outline-none
                      transition-all
                    "
                  />

                  <p className="text-[11px] text-slate-500 mt-2">
                    Numero massimo di squadre
                    partecipanti alla lega.
                  </p>
                </div>

                {/* BUDGET */}

                <div className="rounded-xl bg-slate-950/40 border border-slate-700/70 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Coins className="w-4 h-4 text-emerald-400" />

                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      Crediti iniziali
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      name="initial_budget"
                      required
                      min={1}
                      defaultValue={
                        settings.initial_budget
                      }
                      className="
                        w-full
                        bg-slate-900
                        border border-slate-700
                        rounded-xl
                        px-3.5 py-3 pr-14
                        text-sm
                        text-emerald-400
                        font-black
                        focus:border-emerald-500
                        focus:ring-1
                        focus:ring-emerald-500/30
                        outline-none
                        transition-all
                      "
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-500/70">
                      FM
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-2">
                    Budget assegnato ai nuovi
                    partecipanti.
                  </p>
                </div>
              </div>

              {/* SAVE */}

              <div className="px-5 md:px-6 py-4 border-t border-slate-700/70 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    px-5
                    h-11
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
                  "
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salva configurazione
                    </>
                  )}
                </button>
              </div>
            </section>
          </form>

          {/* =====================================================
              DANGER ZONE
          ===================================================== */}

          <section className="bg-red-500/5 border border-red-500/30 rounded-2xl shadow-xl overflow-hidden">

            <div className="p-5 md:p-6">
              <div className="flex items-start gap-3">

                <div className="w-10 h-10 shrink-0 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-sm font-black uppercase tracking-wider text-red-400">
                    Zona pericolosa
                  </h2>

                  <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Il reset azzera le rose assegnate,
                    cancella lo storico delle aste
                    e ripristina i crediti iniziali
                    per tutte le squadre.
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-red-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-300">
                    Reset completo della lega
                  </p>

                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Questa operazione non dovrebbe essere
                    utilizzata durante un&apos;asta.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={resetting}
                  onClick={handleResetClick}
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    px-4
                    h-10
                    bg-red-600
                    hover:bg-red-500
                    disabled:opacity-50
                    disabled:cursor-not-allowed
                    text-white
                    text-xs
                    font-bold
                    rounded-xl
                    transition-all
                    shadow-md
                    shadow-red-600/10
                    active:scale-[0.98]
                    shrink-0
                  "
                >
                  {resetting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Reset in corso...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      Reset lega
                    </>
                  )}
                </button>
              </div>
            </div>
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