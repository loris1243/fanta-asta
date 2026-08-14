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
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Trophy,
  UserRound,
} from 'lucide-react'

import { supabase } from '../../../../lib/supabaseClient'

interface LeagueTeam {
  id: string
  name: string
  logo_url: string
  user_id?: string
  profiles?: {
    username: string
  } | {
    username: string
  }[]
}

interface CurrentUser {
  id: string
  username: string
  role: string
  budget: number
}

export default function LeagueTeamsPage() {
  const [teams, setTeams] = useState<LeagueTeam[]>([])
  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null)

  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(true)

  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    fetchTeams()
    loadCurrentUser()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await supabase
        .from('users')
        .select('id, username, role, budget')
        .eq('id', user.id)
        .single()

      if (data) {
        setCurrentUser(data)
      }
    } catch (error) {
      console.error(
        'Errore caricamento utente:',
        error
      )
    }
  }

  const fetchTeams = async () => {
    setLoading(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('league_teams')
      .select(`
        id,
        name,
        logo_url,
        user_id,
        profiles (
          username
        )
      `)
      .order('name', {
        ascending: true,
      })

    if (error) {
      console.error(
        'Errore fetch squadre:',
        error.message
      )

      setMessage({
        type: 'error',
        text:
          'Impossibile caricare le squadre della lega.',
      })

      setTeams([])
      setLoading(false)
      return
    }

    if (data) {
      setTeams(data as LeagueTeam[])
    }

    setLoading(false)
  }

  const getOwnerName = (
    team: LeagueTeam
  ) => {
    if (!team.profiles) {
      return 'Nessun proprietario'
    }

    if (Array.isArray(team.profiles)) {
      return (
        team.profiles[0]?.username ||
        'Nessun proprietario'
      )
    }

    return (
      team.profiles.username ||
      'Nessun proprietario'
    )
  }

  const handleDelete = async (
    team: LeagueTeam
  ) => {
    const confirmed = window.confirm(
      `Vuoi davvero eliminare "${team.name}" dalla lega?`
    )

    if (!confirmed) return

    setDeletingId(team.id)
    setMessage(null)

    const { error } = await supabase
      .from('league_teams')
      .delete()
      .eq('id', team.id)

    if (error) {
      console.error(
        'Errore eliminazione:',
        error.message
      )

      setMessage({
        type: 'error',
        text:
          `Errore durante l'eliminazione: ${error.message}`,
      })

      setDeletingId(null)
      return
    }

    setTeams((prev) =>
      prev.filter(
        (item) => item.id !== team.id
      )
    )

    setMessage({
      type: 'success',
      text:
        `"${team.name}" è stata eliminata dalla lega.`,
    })

    setDeletingId(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
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

        {/* USER */}

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
                .toUpperCase() || (
                <UserRound className="w-4 h-4" />
              )}
            </div>

            {isSidebarOpen && (
              <div className="min-w-0 overflow-hidden">
                <p className="text-sm font-bold text-white truncate">
                  {currentUser?.username || 'Admin'}
                </p>

                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                  Amministratore
                </p>
              </div>
            )}
          </div>
        </div>

        {/* NAV */}

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
                  text-slate-300
                  hover:text-white
                  hover:bg-slate-800
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
                  text-slate-950
                  bg-blue-600
                  shadow-md
                  shadow-blue-600/20
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
          </div>
        </nav>

        {/* LOGOUT */}

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
                  <Building2 className="w-4 h-4 text-blue-400" />
                </div>

                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">
                  Anagrafiche
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                Squadre Lega Fantacalcio
              </h1>

              <p className="mt-1.5 text-sm text-slate-400">
                Gestisci le squadre che partecipano
                al campionato.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start lg:self-auto">

              <div className="bg-slate-800 border border-slate-700 px-4 py-3 rounded-xl">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Squadre
                </p>

                <p className="text-lg font-black mt-0.5 text-white">
                  {teams.length}
                </p>
              </div>

              <Link
                href="/admin/anagrafiche/squadre_lega/add"
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  h-11
                  px-4
                  bg-blue-600
                  hover:bg-blue-500
                  text-white
                  text-sm
                  font-bold
                  rounded-xl
                  shadow-md
                  shadow-blue-600/20
                  transition-all
                  active:scale-[0.98]
                  shrink-0
                "
              >
                <Plus className="w-4 h-4" />
                Aggiungi squadra
              </Link>
            </div>
          </header>

          {/* MESSAGE */}

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

          {/* CONTENT */}

          {loading ? (
            <section className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl p-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />

                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Caricamento squadre...
                </p>
              </div>
            </section>
          ) : teams.length === 0 ? (
            <section className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl p-10 text-center">

              <div className="w-14 h-14 rounded-2xl bg-slate-950/60 border border-slate-700 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-6 h-6 text-slate-500" />
              </div>

              <h2 className="text-sm font-black text-white">
                Nessuna squadra definita
              </h2>

              <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto">
                Non ci sono ancora squadre nella lega.
                Crea la prima per iniziare.
              </p>

              <Link
                href="/admin/anagrafiche/squadre_lega/add"
                className="
                  inline-flex
                  items-center
                  gap-2
                  mt-5
                  px-4
                  h-10
                  bg-blue-600
                  hover:bg-blue-500
                  text-white
                  text-xs
                  font-bold
                  rounded-xl
                  transition-all
                "
              >
                <Plus className="w-4 h-4" />
                Crea la prima
              </Link>
            </section>
          ) : (
            <section className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">

              <div className="p-5 md:p-6 border-b border-slate-700/70">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Squadre partecipanti
                </h2>

                <p className="text-xs text-slate-400 mt-0.5">
                  Elenco delle squadre iscritte alla lega,
                  ordinate alfabeticamente.
                </p>
              </div>

              <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">

                {teams.map((team) => {
                  const isDeleting =
                    deletingId === team.id

                  const owner =
                    getOwnerName(team)

                  return (
                    <div
                      key={team.id}
                      className="
                        group
                        p-4
                        bg-slate-900/60
                        border border-slate-700
                        rounded-xl
                        flex items-center
                        justify-between
                        gap-3
                        hover:border-slate-600
                        hover:bg-slate-900/80
                        transition-all
                      "
                    >

                      <div className="flex items-center gap-3 min-w-0">

                        {/* LOGO */}

                        <div
                          className="
                            w-12 h-12
                            rounded-xl
                            bg-slate-950
                            border border-slate-700
                            flex items-center
                            justify-center
                            shrink-0
                            shadow-inner
                            overflow-hidden
                          "
                        >
                          {team.logo_url ? (
                            <img
                              src={team.logo_url}
                              alt={team.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building2 className="w-5 h-5 text-slate-600" />
                          )}
                        </div>

                        {/* INFO */}

                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white truncate">
                            {team.name}
                          </h3>

                          <div className="flex items-center gap-1.5 mt-1">
                            <UserRound className="w-3 h-3 text-slate-500 shrink-0" />

                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate">
                              {owner}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* DELETE */}

                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() =>
                          handleDelete(team)
                        }
                        title={`Elimina ${team.name}`}
                        className="
                          w-9 h-9
                          rounded-xl
                          flex items-center
                          justify-center
                          text-slate-500
                          hover:text-red-400
                          hover:bg-red-500/10
                          border border-transparent
                          hover:border-red-500/20
                          transition-all
                          disabled:opacity-50
                          disabled:cursor-not-allowed
                          shrink-0
                        "
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
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