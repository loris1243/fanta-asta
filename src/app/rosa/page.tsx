'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { supabase } from '../../lib/supabaseClient'
import { getCurrentUser, logout } from '../actions/auth'

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
    bg: 'bg-sky-500/10',
    text: 'text-sky-300',
    border: 'border-sky-500/20',
  },
  D: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
    border: 'border-emerald-500/20',
  },
  C: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
    border: 'border-amber-500/20',
  },
  A: {
    bg: 'bg-red-500/10',
    text: 'text-red-300',
    border: 'border-red-500/20',
  },
}

export default function RosaPage() {
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
        bg-slate-900
        text-white
      ">
        Caricamento rosa...
      </div>
    )
  }

  // ============================================================
  // PAGINA
  // ============================================================

  return (
    <div
      className="
        min-h-screen
        bg-slate-900
        text-slate-100
        font-sans
        flex
        flex-col
        md:flex-row
      "
    >

      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside
        className={`
          relative
          shrink-0
          bg-slate-900/95
          border-r
          border-slate-800
          shadow-xl
          transition-[width]
          duration-300
          ease-in-out
          flex
          flex-col
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
              relative
              flex
              items-center
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
                flex
                items-center
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
                  w-10
                  h-10
                  shrink-0
                  rounded-xl
                  bg-blue-600
                  text-white
                  flex
                  items-center
                  justify-center
                  shadow-lg
                  shadow-blue-600/20
                "
              >
                <Gavel className="w-5 h-5" />
              </div>

              {isSidebarOpen && (
                <div className="min-w-0">

                  <h1
                    className="
                      font-extrabold
                      text-base
                      tracking-tight
                      text-white
                      leading-tight
                    "
                  >
                    FantAsta
                  </h1>

                  <p
                    className="
                      text-[10px]
                      text-slate-500
                      font-bold
                      uppercase
                      tracking-wider
                    "
                  >
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
                hidden
                md:flex
                items-center
                justify-center
                w-7
                h-7
                rounded-lg
                text-slate-500
                hover:text-white
                hover:bg-slate-800
                transition-all
                ${
                  !isSidebarOpen
                    ? `
                      absolute
                      -right-2
                      top-1/2
                      -translate-y-1/2
                      z-20
                      bg-slate-900
                      border
                      border-slate-700
                      shadow-lg
                    `
                    : ''
                }
              `}
            >
              <span className="text-[10px] font-black">
                {isSidebarOpen
                  ? '◀'
                  : '▶'}
              </span>
            </button>

          </div>

        </div>

        {/* USER CARD */}

        <div
          className={`
            mx-3
            md:mx-4
            mb-5
            bg-slate-950/70
            border
            border-slate-800
            rounded-xl
            transition-all
            duration-300
            ${
              isSidebarOpen
                ? 'p-3'
                : 'p-2'
            }
          `}
        >

          <div
            className={`
              flex
              items-center
              ${
                isSidebarOpen
                  ? 'gap-3'
                  : 'justify-center'
              }
            `}
          >

            <div
              className="
                w-10
                h-10
                shrink-0
                rounded-lg
                bg-blue-500/10
                text-blue-300
                border
                border-blue-500/30
                flex
                items-center
                justify-center
                font-black
                text-xs
              "
            >
              {user.username
                .slice(0, 2)
                .toUpperCase()}
            </div>

            {isSidebarOpen && (
              <div
                className="
                  min-w-0
                  overflow-hidden
                "
              >

                <p
                  className="
                    text-sm
                    font-bold
                    text-white
                    truncate
                  "
                >
                  {formatUsername(
                    user.username
                  )}
                </p>

                <p
                  className="
                    text-xs
                    text-emerald-400
                    font-extrabold
                    mt-0.5
                  "
                >
                  {budget} FM
                </p>

              </div>
            )}

          </div>

        </div>

        {/* NAVIGAZIONE */}

        <nav
          className="
            flex-1
            px-3
            md:px-4
            overflow-y-auto
          "
        >

          <div className="space-y-1.5">

            {/* DASHBOARD */}

            <Link
              href="/"
              title={
                !isSidebarOpen
                  ? 'Dashboard'
                  : undefined
              }
              className="
                flex
                items-center
                h-11
                rounded-xl
                text-sm
                font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
                gap-3
                px-3.5
              "
            >
              <LayoutDashboard
                className="
                  w-4
                  h-4
                  shrink-0
                "
              />

              {isSidebarOpen && (
                <span className="truncate">
                  Dashboard
                </span>
              )}
            </Link>

            {/* ROSA ATTIVA */}

            <Link
              href="/rosa"
              title={
                !isSidebarOpen
                  ? 'La Mia Squadra'
                  : undefined
              }
              className="
                flex
                items-center
                h-11
                rounded-xl
                text-sm
                font-semibold
                text-white
                bg-blue-600
                shadow-md
                shadow-blue-600/20
                transition-all
                gap-3
                px-3.5
              "
            >
              <Shield
                className="
                  w-4
                  h-4
                  shrink-0
                "
              />

              {isSidebarOpen && (
                <span className="truncate">
                  La Mia Squadra
                </span>
              )}
            </Link>

            {/* OBIETTIVI */}

            <Link
              href="/obiettivi"
              title={
                !isSidebarOpen
                  ? 'I Miei Obiettivi'
                  : undefined
              }
              className="
                flex
                items-center
                h-11
                rounded-xl
                text-sm
                font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
                gap-3
                px-3.5
              "
            >
              <Target
                className="
                  w-4
                  h-4
                  shrink-0
                  text-amber-400
                "
              />

              {isSidebarOpen && (
                <span className="truncate">
                  I Miei Obiettivi
                </span>
              )}
            </Link>

            {/* LISTONE */}

            <Link
              href="/listone"
              title={
                !isSidebarOpen
                  ? 'Listone'
                  : undefined
              }
              className="
                flex
                items-center
                h-11
                rounded-xl
                text-sm
                font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
                gap-3
                px-3.5
              "
            >
              <ClipboardList
                className="
                  w-4
                  h-4
                  shrink-0
                "
              />

              {isSidebarOpen && (
                <span className="truncate">
                  Listone
                </span>
              )}
            </Link>

            {/* ADMIN */}

            {user.role === 'admin' && (
              <div
                className="
                  pt-4
                  mt-4
                  border-t
                  border-slate-800
                "
              >

                {isSidebarOpen && (
                  <span
                    className="
                      px-2
                      text-[10px]
                      font-bold
                      text-slate-500
                      uppercase
                      tracking-wider
                      block
                      mb-2
                    "
                  >
                    Pannello Admin
                  </span>
                )}

                {/* IMPORTA LISTONE */}

                <Link
                  href="/admin/import-listone"
                  title={
                    !isSidebarOpen
                      ? 'Importa Listone'
                      : undefined
                  }
                  className="
                    flex
                    items-center
                    h-10
                    rounded-xl
                    text-sm
                    font-semibold
                    text-slate-300
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                    gap-3
                    px-3.5
                  "
                >
                  <Inbox
                    className="
                      w-4
                      h-4
                      shrink-0
                    "
                  />

                  {isSidebarOpen && (
                    <span className="truncate">
                      Importa Listone
                    </span>
                  )}
                </Link>

                {/* GESTIONE PARTECIPANTI */}

                <Link
                  href="/admin/users"
                  title={
                    !isSidebarOpen
                      ? 'Gestione Partecipanti'
                      : undefined
                  }
                  className="
                    flex
                    items-center
                    h-10
                    rounded-xl
                    text-sm
                    font-semibold
                    text-slate-300
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                    gap-3
                    px-3.5
                  "
                >
                  <Users
                    className="
                      w-4
                      h-4
                      shrink-0
                    "
                  />

                  {isSidebarOpen && (
                    <span className="truncate">
                      Gestione Partecipanti
                    </span>
                  )}
                </Link>

                {/* CONFIGURAZIONE */}

                <Link
                  href="/admin/settings"
                  title={
                    !isSidebarOpen
                      ? 'Configurazione Lega'
                      : undefined
                  }
                  className="
                    flex
                    items-center
                    h-10
                    rounded-xl
                    text-sm
                    font-semibold
                    text-slate-300
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                    gap-3
                    px-3.5
                  "
                >
                  <Settings
                    className="
                      w-4
                      h-4
                      shrink-0
                    "
                  />

                  {isSidebarOpen && (
                    <span className="truncate">
                      Configurazione Lega
                    </span>
                  )}
                </Link>

                {/* ANAGRAFICHE */}

                {isSidebarOpen && (
                  <span
                    className="
                      px-2
                      pt-4
                      text-[10px]
                      font-bold
                      text-slate-500
                      uppercase
                      tracking-wider
                      block
                      mb-2
                    "
                  >
                    Anagrafiche
                  </span>
                )}

                {/* SERIE A */}

                <Link
                  href="/admin/anagrafiche/serie-a"
                  title={
                    !isSidebarOpen
                      ? 'Squadre Serie A'
                      : undefined
                  }
                  className="
                    flex
                    items-center
                    h-9
                    rounded-xl
                    text-xs
                    font-semibold
                    text-slate-400
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                    gap-3
                    px-3.5
                  "
                >
                  <ScrollText
                    className="
                      w-4
                      h-4
                      shrink-0
                    "
                  />

                  {isSidebarOpen && (
                    <span className="truncate">
                      Squadre Serie A
                    </span>
                  )}
                </Link>

                {/* SQUADRE LEGA */}

                <Link
                  href="/admin/anagrafiche/squadre_lega"
                  title={
                    !isSidebarOpen
                      ? 'Squadre Lega'
                      : undefined
                  }
                  className="
                    flex
                    items-center
                    h-9
                    rounded-xl
                    text-xs
                    font-semibold
                    text-slate-400
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                    gap-3
                    px-3.5
                  "
                >
                  <Building2
                    className="
                      w-4
                      h-4
                      shrink-0
                    "
                  />

                  {isSidebarOpen && (
                    <span className="truncate">
                      Squadre Lega
                    </span>
                  )}
                </Link>

              </div>
            )}

          </div>

        </nav>

        {/* FOOTER */}

        <div
          className="
            mt-auto
            p-3
            md:p-4
            border-t
            border-slate-800
          "
        >

          <button
            onClick={handleLogout}
            type="button"
            title={
              !isSidebarOpen
                ? 'Esci'
                : undefined
            }
            className="
              w-full
              flex
              items-center
              h-11
              rounded-xl
              text-sm
              font-semibold
              text-red-400
              hover:text-red-300
              hover:bg-red-500/10
              transition-all
              cursor-pointer
              gap-3
              px-3.5
            "
          >
            <LogOut
              className="
                w-4
                h-4
                shrink-0
              "
            />

            {isSidebarOpen && (
              <span>Esci</span>
            )}

          </button>

        </div>

      </aside>

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
                text-slate-400
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
                bg-slate-800/80
                border
                border-slate-700/80
                rounded-2xl
                p-10
                text-center
              "
            >

              <Shield
                className="
                  w-8
                  h-8
                  text-slate-600
                  mx-auto
                  mb-3
                "
              />

              <p
                className="
                  text-sm
                  text-slate-400
                "
              >
                Nessun giocatore acquistato.
              </p>

            </div>

          ) : (

            <div className="space-y-6">
              {Object.entries(groupedPlayers).map(([role, rolePlayers]) => {
                const style = ROLE_STYLES[role] || {
                  bg: 'bg-slate-500/10',
                  text: 'text-slate-300',
                  border: 'border-slate-500/20',
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
                      <div className="flex-1 h-px bg-slate-800" />
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
                                    bg-red-500/10
                                    border-red-500/50
                                  `
                                  : `
                                    bg-slate-800
                                    border-slate-700
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
                                        text-slate-500
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
                                  text-slate-400
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
                                    border-slate-300/70
                                    bg-slate-800
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
                                      text-slate-500
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
                                  text-emerald-400
                                  font-black
                                "
                              >
                                {p.price} FM
                              </p>

                              <p
                                className="
                                  text-xs
                                  text-slate-400
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
        bg-slate-800
        p-4
        rounded-xl
        border
        border-slate-700
      "
    >

      <p
        className="
          text-xs
          text-slate-400
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