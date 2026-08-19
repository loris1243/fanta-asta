'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trophy,
  Building2,
  UserRound,
} from 'lucide-react'

import { supabase } from '../../../../lib/supabaseClient'
import DashboardSidebar from '../../../../components/DashboardSidebar'

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false)

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
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>

                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  Anagrafiche
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                Squadre Lega Fantacalcio
              </h1>

              <p className="mt-1.5 text-sm text-muted">
                Gestisci le squadre che partecipano
                al campionato.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start lg:self-auto">

              <div className="bg-surface-elevated border border-border px-4 py-3 rounded-xl">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-2">
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
                  bg-primary
                  hover:bg-primary-hover
                  text-white
                  text-sm
                  font-bold
                  rounded-xl
                  shadow-md
                  shadow-primary/20
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

          {/* CONTENT */}

          {loading ? (
            <section className="bg-surface-elevated/80 border border-border rounded-2xl shadow-xl p-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />

                <p className="text-xs text-muted font-semibold uppercase tracking-wider">
                  Caricamento squadre...
                </p>
              </div>
            </section>
          ) : teams.length === 0 ? (
            <section className="bg-surface-elevated/80 border border-border rounded-2xl shadow-xl p-10 text-center">

              <div className="w-14 h-14 rounded-2xl bg-background/60 border border-border flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-6 h-6 text-muted-2" />
              </div>

              <h2 className="text-sm font-black text-white">
                Nessuna squadra definita
              </h2>

              <p className="text-xs text-muted-2 mt-1.5 max-w-sm mx-auto">
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
                  bg-primary
                  hover:bg-primary-hover
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
            <section className="bg-surface-elevated/80 border border-border rounded-2xl shadow-xl overflow-hidden">

              <div className="p-5 md:p-6 border-b border-border/70">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Squadre partecipanti
                </h2>

                <p className="text-xs text-muted mt-0.5">
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
                        bg-surface/60
                        border border-border
                        rounded-xl
                        flex items-center
                        justify-between
                        gap-3
                        hover:border-border-strong
                        hover:bg-surface/80
                        transition-all
                      "
                    >

                      <div className="flex items-center gap-3 min-w-0">

                        {/* LOGO */}

                        <div
                          className="
                            w-12 h-12
                            rounded-xl
                            bg-background
                            border border-border
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
                            <Building2 className="w-5 h-5 text-muted-2" />
                          )}
                        </div>

                        {/* INFO */}

                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white truncate">
                            {team.name}
                          </h3>

                          <div className="flex items-center gap-1.5 mt-1">
                            <UserRound className="w-3 h-3 text-muted-2 shrink-0" />

                            <p className="text-[10px] text-muted uppercase tracking-wider font-semibold truncate">
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
                          text-muted-2
                          hover:text-danger
                          hover:bg-danger/10
                          border border-transparent
                          hover:border-danger/20
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