'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trophy,
  Coins,
  RotateCcw,
  AlertTriangle,
  UserRound,
  Settings,
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

import DashboardSidebar from '../../../components/DashboardSidebar'

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false)

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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />

          <p className="text-xs text-muted font-semibold uppercase tracking-wider">
            Caricamento impostazioni...
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
          MAIN CONTENT
      ===================================================== */}

      <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto space-y-6">

          {/* HEADER */}

          <header>
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
            > */}
              {/* <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link> */}

            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Settings className="w-4 h-4 text-primary" />
              </div>

              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                Amministrazione
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              Configurazione Lega
            </h1>

            <p className="mt-1.5 text-sm text-muted">
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
              SETTINGS FORM
          ===================================================== */}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            {/* =================================================
                INFO LEGA
            ================================================= */}

            <section className="bg-surface-elevated/80 border border-border rounded-2xl shadow-xl overflow-hidden">

              <div className="p-5 md:p-6 border-b border-border/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-primary" />
                  </div>

                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-white">
                      Informazioni lega
                    </h2>

                    <p className="text-xs text-muted mt-0.5">
                      Il nome con cui verrà identificata la lega.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6">
                <label className="text-[10px] uppercase tracking-wider text-muted font-bold block mb-1.5">
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
                    bg-background/70
                    border border-border
                    rounded-xl
                    px-3.5 py-3
                    text-sm
                    text-white
                    font-bold
                    placeholder-muted-2
                    focus:border-primary
                    focus:ring-1
                    focus:ring-primary/30
                    outline-none
                    transition-all
                  "
                />

                <p className="text-[11px] text-muted-2 mt-1.5">
                  Questo nome identifica la tua lega
                  all&apos;interno di FantAsta.
                </p>
              </div>
            </section>

            {/* =================================================
                PARAMETRI
            ================================================= */}

            <section className="bg-surface-elevated/80 border border-border rounded-2xl shadow-xl overflow-hidden">

              <div className="p-5 md:p-6 border-b border-border/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-success" />
                  </div>

                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-white">
                      Parametri lega
                    </h2>

                    <p className="text-xs text-muted mt-0.5">
                      Configura partecipanti e budget iniziale.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* PARTECIPANTI */}

                <div className="rounded-xl bg-background/40 border border-border/70 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <UserRound className="w-4 h-4 text-primary" />

                    <label className="text-[10px] uppercase tracking-wider text-muted font-bold">
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
                      bg-surface
                      border border-border
                      rounded-xl
                      px-3.5 py-3
                      text-sm
                      text-white
                      font-bold
                      focus:border-primary
                      focus:ring-1
                      focus:ring-primary/30
                      outline-none
                      transition-all
                    "
                  />

                  <p className="text-[11px] text-muted-2 mt-2">
                    Numero massimo di squadre
                    partecipanti alla lega.
                  </p>
                </div>

                {/* BUDGET */}

                <div className="rounded-xl bg-background/40 border border-border/70 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Coins className="w-4 h-4 text-success" />

                    <label className="text-[10px] uppercase tracking-wider text-muted font-bold">
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
                        bg-surface
                        border border-border
                        rounded-xl
                        px-3.5 py-3 pr-14
                        text-sm
                        text-success
                        font-black
                        focus:border-success
                        focus:ring-1
                        focus:ring-success/30
                        outline-none
                        transition-all
                      "
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-success/70">
                      FM
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-2 mt-2">
                    Budget assegnato ai nuovi
                    partecipanti.
                  </p>
                </div>
              </div>

              {/* SAVE */}

              <div className="px-5 md:px-6 py-4 border-t border-border/70 flex justify-end">
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

          <section className="bg-danger/5 border border-danger/30 rounded-2xl shadow-xl overflow-hidden">

            <div className="p-5 md:p-6">
              <div className="flex items-start gap-3">

                <div className="w-10 h-10 shrink-0 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-sm font-black uppercase tracking-wider text-danger">
                    Zona pericolosa
                  </h2>

                  <p className="text-xs text-muted mt-1 max-w-2xl leading-relaxed">
                    Il reset azzera le rose assegnate,
                    cancella lo storico delle aste
                    e ripristina i crediti iniziali
                    per tutte le squadre.
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-danger/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-muted">
                    Reset completo della lega
                  </p>

                  <p className="text-[11px] text-muted-2 mt-0.5">
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
                    bg-danger
                    hover:bg-danger-hover
                    disabled:opacity-50
                    disabled:cursor-not-allowed
                    text-white
                    text-xs
                    font-bold
                    rounded-xl
                    transition-all
                    shadow-md
                    shadow-danger/10
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