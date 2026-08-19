'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { supabase } from '../../lib/supabaseClient'
import { getCurrentUser, logout } from '../actions/auth'
import DashboardSidebar from '../../components/DashboardSidebar'

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
  Gavel,
} from 'lucide-react'

interface UserProfile {
  id: string
  username: string
  role: string
  budget: number
}

interface Team {
  id: string
  name: string
  alias: string
  color: string | null
  colors: string[] | null
}

interface PlayerInTeam {
  id: string
  player_name: string
  role: string
  price: number
  player_id: number | null
  team?: string
  fanta_media?: number
  is_out?: boolean
}

const ROLE_ORDER: Record<string, number> = {
  P: 0,
  D: 1,
  C: 2,
  A: 3,
}

const ROLE_NAMES: Record<string, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
}

const ROLE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  P: {
    bg: 'bg-role-p-bg',
    text: 'text-role-p',
    border: 'border-role-p/20',
  },
  D: {
    bg: 'bg-role-d-bg',
    text: 'text-role-d',
    border: 'border-role-d/20',
  },
  C: {
    bg: 'bg-role-c-bg',
    text: 'text-role-c',
    border: 'border-role-c/20',
  },
  A: {
    bg: 'bg-role-a-bg',
    text: 'text-role-a',
    border: 'border-role-a/20',
  },
}

export default function RosaPage() {
  const [remainingBudget, setRemainingBudget] = useState(500)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)  
  const [user, setUser] =
    useState<UserProfile | null>(null)

  const [teams, setTeams] =
    useState<Team[]>([])

  const [players, setPlayers] =
    useState<PlayerInTeam[]>([])

  const [loading, setLoading] =
    useState(true)

  const [budget, setBudget] =
    useState(500)

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(true)

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = async () => {
    await logout()
  }

  // ============================================================
  // USERNAME
  // ============================================================

  const formatUsername = (name: string) => {
    if (!name) return ''

    return (
      name.charAt(0).toUpperCase() +
      name.slice(1)
    )
  }

  // ============================================================
  // TROVA SQUADRA
  // players.team -> teams.alias
  // ============================================================

  const getPlayerTeam = (
    playerTeam: string
  ): Team | null => {
    if (!playerTeam) return null

    const normalizedPlayerTeam =
      playerTeam.trim().toLowerCase()

    return (
      teams.find(
        (team) =>
          team.alias?.trim().toLowerCase() ===
          normalizedPlayerTeam
      ) ?? null
    )
  }

  // ============================================================
  // CARICAMENTO ROSA
  // ============================================================

  useEffect(() => {
    async function loadRosa() {
      try {
        const currentUser =
          await getCurrentUser()

        if (!currentUser) {
          setLoading(false)
          return
        }

        setUser(currentUser)

        // --------------------------------------------------------
        // SQUADRA DELL'UTENTE
        // --------------------------------------------------------

        const {
          data: leagueTeam,
          error: teamError,
        } = await supabase
          .from('league_teams')
          .select('id')
          .eq(
            'user_id',
            currentUser.id
          )
          .maybeSingle()

        if (teamError) {
          console.error(
            'Errore caricamento squadra lega:',
            teamError
          )

          setLoading(false)
          return
        }

        if (!leagueTeam) {
          setLoading(false)
          return
        }

        // --------------------------------------------------------
        // SQUADRE SERIE A
        // --------------------------------------------------------

        const {
          data: teamsData,
          error: teamsError,
        } = await supabase
          .from('teams')
          .select(
            'id, name, alias, color, colors'
          )

        if (teamsError) {
          console.error(
            'Errore caricamento squadre:',
            teamsError
          )
        } else if (teamsData) {
          const formattedTeams: Team[] =
            teamsData.map((team: any) => ({
              id: team.id,
              name: team.name,
              alias: team.alias,
              color:
                team.color ?? null,
              colors:
                Array.isArray(team.colors)
                  ? team.colors
                  : [],
            }))

          setTeams(formattedTeams)
        }

        // --------------------------------------------------------
        // BUDGET INIZIALE
        // --------------------------------------------------------

        const {
          data: settings,
          error: settingsError,
        } = await supabase
          .from('league_settings')
          .select('initial_budget')
          .maybeSingle()

        if (settingsError) {
          console.error(
            'Errore caricamento impostazioni:',
            settingsError
          )
        }

        const initialBudget =
          settings?.initial_budget ?? 500

        // --------------------------------------------------------
        // ROSA
        // --------------------------------------------------------

        const {
          data,
          error,
        } = await supabase
          .from('league_team_players')
          .select(`
            id,
            player_name,
            role,
            price,
            player_id,
            players (
              team,
              fanta_media,
              is_out
            )
          `)
          .eq(
            'team_id',
            leagueTeam.id
          )

        if (error) {
          console.error(
            'Errore caricamento rosa:',
            error
          )

          setLoading(false)
          return
        }

        // --------------------------------------------------------
        // FORMATTAZIONE
        // --------------------------------------------------------

        const formatted: PlayerInTeam[] =
          (data || []).map(
            (p: any) => ({
              id: p.id,
              player_name:
                p.player_name,
              role: p.role,
              price: p.price,
              player_id:
                p.player_id,
              team:
                p.players?.team,
              fanta_media:
                p.players?.fanta_media,
              is_out:
                p.players?.is_out,
            })
          )

        // --------------------------------------------------------
        // ORDINE RUOLI
        // --------------------------------------------------------

        formatted.sort(
          (a, b) =>
            (ROLE_ORDER[a.role] ?? 99) -
            (ROLE_ORDER[b.role] ?? 99)
        )

        setPlayers(formatted)

        // --------------------------------------------------------
        // BUDGET RESIDUO
        // --------------------------------------------------------

        const spent =
          formatted.reduce(
            (acc, player) =>
              acc + player.price,
            0
          )

        setBudget(
          initialBudget - spent
        )

        setLoading(false)
      } catch (error) {
        console.error(
          'Errore caricamento pagina Rosa:',
          error
        )

        setLoading(false)
      }
    }

    loadRosa()
  }, [])

  // ============================================================
  // STATISTICHE
  // ============================================================

  const roleCount =
    players.reduce(
      (acc, player) => {
        acc[player.role] =
          (acc[player.role] || 0) + 1

        return acc
      },
      {} as Record<string, number>
    )

  const totalSpent =
    players.reduce(
      (acc, player) =>
        acc + player.price,
      0
    )

  // Raggruppamento giocatori per ruolo ordinati secondo ROLE_ORDER
  const groupedPlayers = ['P', 'D', 'C', 'A'].reduce((acc, role) => {
    const rolePlayers = players.filter((p) => p.role === role)
    if (rolePlayers.length > 0) {
      acc[role] = rolePlayers
    }
    return acc
  }, {} as Record<string, PlayerInTeam[]>)

  // ============================================================
  // LOADING
  // ============================================================

  if (loading || !user) {
    return (
      <div className="
        min-h-screen
        flex
        items-center
        justify-center
        bg-background
        text-foreground
      ">
        Caricamento rosa...
      </div>
    )
  }

  // ============================================================
  // PAGINA
  // ============================================================


      {/* ======================================================
          SIDEBAR
      ====================================================== */}
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col md:flex-row">
      <DashboardSidebar
        user={{ username: user.username, role: user.role }}
        remainingBudget={remainingBudget}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onLogout={handleLogout}
      />

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main
        className="
          flex-1
          min-w-0
          p-5
          md:p-8
          xl:p-10
          overflow-y-auto
        "
      >

        <div
          className="
            max-w-[1500px]
            mx-auto
            space-y-6
          "
        >

          {/* HEADER */}

          <header>

            <h1
              className="
                text-3xl
                md:text-4xl
                font-black
                tracking-tight
                text-white
              "
            >
              La Mia Rosa
            </h1>

            <p
              className="
                mt-1.5
                text-sm
                text-muted
              "
            >
              Giocatori acquistati all'asta
            </p>

          </header>

          {/* STATS */}

          <div
            className="
              grid
              grid-cols-2
              md:grid-cols-4
              gap-4
            "
          >

            <Stat
              label="Budget residuo"
              value={`${budget} FM`}
            />

            <Stat
              label="Spesa totale"
              value={`${totalSpent} FM`}
            />

            <Stat
              label="Giocatori"
              value={players.length}
            />

            <Stat
              label="Ruoli"
              value={`
                P:${roleCount.P || 0}
                D:${roleCount.D || 0}
                C:${roleCount.C || 0}
                A:${roleCount.A || 0}
              `}
            />

          </div>

          {/* ROSA */}

          {players.length === 0 ? (

            <div
              className="
                bg-surface-elevated/80
                border
                border-border/80
                rounded-2xl
                p-10
                text-center
              "
            >

              <Shield
                className="
                  w-8
                  h-8
                  text-muted-2
                  mx-auto
                  mb-3
                "
              />

              <p
                className="
                  text-sm
                  text-muted
                "
              >
                Nessun giocatore acquistato.
              </p>

            </div>

          ) : (

            <div className="space-y-6">
              {Object.entries(groupedPlayers).map(([role, rolePlayers]) => {
                const style = ROLE_STYLES[role] || {
                  bg: 'bg-muted/10',
                  text: 'text-muted',
                  border: 'border-muted/20',
                }

                return (
                  <div key={role} className="space-y-3">
                    {/* INTESTAZIONE SEZIONE RUOLO */}
                    <div className="flex items-center gap-3">
                      <span
                        className={`
                          px-3
                          py-1
                          rounded-lg
                          text-xs
                          font-black
                          border
                          ${style.bg}
                          ${style.text}
                          ${style.border}
                        `}
                      >
                        {ROLE_NAMES[role] || role} ({rolePlayers.length})
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* LISTA GIOCATORI DEL RUOLO */}
                    <div className="space-y-3">
                      {rolePlayers.map((p) => {
                        const team = getPlayerTeam(p.team || '')

                        return (
                          <div
                            key={p.id}
                            className={`
                              p-4
                              rounded-xl
                              border
                              flex
                              justify-between
                              items-center
                              gap-4
                              ${
                                p.is_out
                                  ? `
                                    bg-danger/10
                                    border-danger/50
                                  `
                                  : `
                                    bg-surface-elevated
                                    border-border
                                  `
                              }
                            `}
                          >

                            {/* INFO */}

                            <div className="min-w-0">

                              <p
                                className={`
                                  font-bold
                                  truncate
                                  ${
                                    p.is_out
                                      ? `
                                        line-through
                                        text-muted-2
                                      `
                                      : 'text-white'
                                  }
                                `}
                              >
                                {p.player_name}
                              </p>

                              {/* SQUADRA */}

                              <div
                                className="
                                  text-xs
                                  text-muted
                                  flex
                                  items-center
                                  gap-2
                                  mt-1
                                "
                              >

                                {/* BANDIERINA */}

                                <div
                                  className="
                                    relative
                                    w-7
                                    h-5
                                    shrink-0
                                    rounded-md
                                    overflow-hidden
                                    flex
                                    border-2
                                    border-border-strong
                                    bg-surface-elevated
                                    shadow-lg
                                  "
                                  title={
                                    team?.name ??
                                    p.team ??
                                    'Squadra sconosciuta'
                                  }
                                >

                                  {team?.colors &&
                                  team.colors.length > 0 ? (

                                    team.colors.map(
                                      (
                                        color,
                                        index
                                      ) => (
                                        <span
                                          key={index}
                                          className="
                                            flex-1
                                            h-full
                                          "
                                          style={{
                                            backgroundColor:
                                              color,
                                          }}
                                        />
                                      )
                                    )

                                  ) : (

                                    <span
                                      className="
                                        w-full
                                        h-full
                                      "
                                      style={{
                                        backgroundColor:
                                          team?.color ??
                                          '#3b82f6',
                                      }}
                                    />

                                  )}

                                  {/* EFFETTO LUCE */}

                                  <span
                                    className="
                                      absolute
                                      inset-0
                                      bg-white/5
                                      pointer-events-none
                                    "
                                  />

                                </div>

                                {/* NOME SQUADRA */}

                                <span>
                                  {p.team || '-'}
                                </span>

                              </div>

                              {/* NOME UFFICIALE */}

                              {team?.name &&
                                team.name !==
                                  p.team && (
                                  <p
                                    className="
                                      text-[10px]
                                      text-muted-2
                                      mt-0.5
                                      truncate
                                    "
                                  >
                                    {team.name}
                                  </p>
                                )}

                            </div>

                            {/* PREZZO */}

                            <div
                              className="
                                text-right
                                shrink-0
                              "
                            >

                              <p
                                className="
                                  text-success
                                  font-black
                                "
                              >
                                {p.price} FM
                              </p>

                              <p
                                className="
                                  text-xs
                                  text-muted
                                "
                              >
                                FM:{' '}
                                {p.fanta_media ??
                                  '-'}
                              </p>

                            </div>

                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

          )}

        </div>

      </main>

    </div>
  )
}

// ============================================================
// STAT
// ============================================================

function Stat({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div
      className="
        bg-surface-elevated
        p-4
        rounded-xl
        border
        border-border
      "
    >

      <p
        className="
          text-xs
          text-muted
        "
      >
        {label}
      </p>

      <p
        className="
          font-black
          text-lg
          text-white
        "
      >
        {value}
      </p>

    </div>
  )
}