'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Target,
  LayoutDashboard,
  Shield,
  ClipboardList,
  Inbox,
  Users,
  Settings,
  ScrollText,
  Building2,
  LogOut,
  Gavel,
  Wallet,
} from 'lucide-react'

import { supabase } from '../../lib/supabaseClient'
import { getCurrentUser, logout } from '../actions/auth'
import DashboardSidebar from '../../components/DashboardSidebar'

interface UserProfile {
  id: string
  username: string
  role: string
  budget: number
}

interface Player {
  id: string
  name: string
  role: string
  team: string
  quotation: number
  fanta_media: number
  fvm: number
  is_out: boolean
}

interface TeamData {
  id?: string
  name: string
  alias: string
  color?: string
  colors?: string[]
  logo_url?: string
}

export default function ListonePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)

  const [team, setTeam] = useState<{
    id?: string
    name: string
    logo_url?: string
  }>({
    name: 'Nessuna squadra associata',
  })

  const [remainingBudget, setRemainingBudget] = useState(500)

  const [players, setPlayers] = useState<Player[]>([])
  const [targetIds, setTargetIds] = useState<string[]>([])

  const [teams, setTeams] = useState<TeamData[]>([])

  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('TUTTI')
  const [teamFilter, setTeamFilter] = useState('TUTTE')

  const [availableTeams, setAvailableTeams] = useState<string[]>([])

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  /*
   * --------------------------------------------------------------
   * CARICAMENTO DATI
   * --------------------------------------------------------------
   */

  useEffect(() => {
    async function loadData() {
      const currentUser = await getCurrentUser()

      if (!currentUser) {
        setLoading(false)
        return
      }

      setUser(currentUser)

      /*
       * ----------------------------------------------------------
       * SQUADRA UTENTE
       * ----------------------------------------------------------
       */

      try {
        const { data: teamData, error: teamError } = await supabase
          .from('league_teams')
          .select('id, name, logo_url')
          .eq('user_id', currentUser.id)
          .maybeSingle()

        if (teamError) {
          console.error(
            'Errore caricamento squadra:',
            teamError
          )
        }

        if (teamData) {
          setTeam({
            id: teamData.id,
            name: teamData.name,
            logo_url: teamData.logo_url,
          })

          /*
           * ------------------------------------------------------
           * BUDGET
           * ------------------------------------------------------
           */

          const { data: settings, error: settingsError } =
            await supabase
              .from('league_settings')
              .select('initial_budget')
              .maybeSingle()

          if (settingsError) {
            console.error(
              'Errore caricamento impostazioni lega:',
              settingsError
            )
          }

          const initialBudget =
            settings?.initial_budget ??
            currentUser.budget ??
            500

          const { data: boughtPlayers, error: boughtError } =
            await supabase
              .from('league_team_players')
              .select('price')
              .eq('team_id', teamData.id)

          if (boughtError) {
            console.error(
              'Errore caricamento giocatori acquistati:',
              boughtError
            )
          }

          const totalSpent =
            boughtPlayers?.reduce(
              (acc, player) =>
                acc + (player.price || 0),
              0
            ) ?? 0

          setRemainingBudget(
            Math.max(
              initialBudget - totalSpent,
              0
            )
          )
        }
      } catch (error) {
        console.error(
          'Errore caricamento squadra:',
          error
        )
      }

      /*
       * ----------------------------------------------------------
       * OBIETTIVI
       * ----------------------------------------------------------
       */

      try {
        const {
          data: targets,
          error: targetsError,
        } = await supabase
          .from('user_targets')
          .select('player_id')
          .eq('user_id', currentUser.id)

        if (targetsError) {
          console.error(
            'Errore caricamento obiettivi:',
            targetsError
          )
        } else if (targets) {
          setTargetIds(
            targets.map(
              (target: { player_id: string }) =>
                target.player_id
            )
          )
        }
      } catch (error) {
        console.error(
          'Errore caricamento obiettivi:',
          error
        )
      }

      /*
       * ----------------------------------------------------------
       * SQUADRE SERIE A
       * ----------------------------------------------------------
       */

      await loadTeams()

      /*
       * ----------------------------------------------------------
       * LISTONE
       * ----------------------------------------------------------
       */

      await loadPlayers()

      setLoading(false)
    }

    /*
     * ------------------------------------------------------------
     * CARICA SQUADRE
     * ------------------------------------------------------------
     */

    async function loadTeams() {
      const {
        data,
        error,
      } = await supabase
        .from('teams')
        .select(
          'id, name, alias, color, colors'
        )
        .order('name', {
          ascending: true,
        })

      if (error) {
        console.error(
          'Errore caricamento squadre:',
          error
        )
        return
      }

      if (!data) {
        setTeams([])
        return
      }

      setTeams(
        data.map((team) => ({
          id: team.id,
          name: team.name,
          alias: team.alias,
          color: team.color,
          colors: Array.isArray(team.colors)
            ? team.colors
            : undefined,
        }))
      )
    }

    /*
     * ------------------------------------------------------------
     * CARICA LISTONE
     * ------------------------------------------------------------
     */

    async function loadPlayers() {
      const {
        data,
        error,
      } = await supabase
        .from('players')
        .select('*')
        .order('name', {
          ascending: true,
        })

      if (error) {
        console.error(
          'Errore caricamento listone:',
          error
        )
        return
      }

      if (!data) {
        setPlayers([])
        setAvailableTeams([])
        return
      }

      setPlayers(data)

      const playerTeams = Array.from(
        new Set(
          data
            .map(
              (player: Player) =>
                player.team
            )
            .filter(Boolean)
        )
      ) as string[]

      setAvailableTeams(
        playerTeams.sort((a, b) =>
          a.localeCompare(b)
        )
      )
    }

    loadData()

    /*
     * ------------------------------------------------------------
     * REALTIME
     * ------------------------------------------------------------
     */

    const channel = supabase
      .channel('listone-players-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
        },
        async () => {
          const {
            data,
            error,
          } = await supabase
            .from('players')
            .select('*')
            .order('name', {
              ascending: true,
            })

          if (error) {
            console.error(
              'Errore aggiornamento realtime listone:',
              error
            )
            return
          }

          if (data) {
            setPlayers(data)

            const playerTeams = Array.from(
              new Set(
                data
                  .map(
                    (player: Player) =>
                      player.team
                  )
                  .filter(Boolean)
              )
            ) as string[]

            setAvailableTeams(
              playerTeams.sort((a, b) =>
                a.localeCompare(b)
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  /*
   * --------------------------------------------------------------
   * TROVA SQUADRA DAL PLAYER.TEAM
   * --------------------------------------------------------------
   *
   * Il valore presente in players.team viene confrontato
   * con teams.alias senza distinguere maiuscole/minuscole.
   */

  const getTeamData = (
    playerTeam: string
  ): TeamData | undefined => {
    if (!playerTeam) return undefined

    const normalizedPlayerTeam =
      playerTeam.trim().toLowerCase()

    return teams.find(
      (team) =>
        team.alias?.trim().toLowerCase() ===
        normalizedPlayerTeam
    )
  }

  /*
   * --------------------------------------------------------------
   * COLORI BANDIERINA
   * --------------------------------------------------------------
   */

  const getTeamColors = (
    teamData?: TeamData
  ): string[] => {
    if (!teamData) {
      return ['#334155']
    }

    if (
      Array.isArray(teamData.colors) &&
      teamData.colors.length > 0
    ) {
      return teamData.colors
    }

    if (teamData.color) {
      return [teamData.color]
    }

    return ['#334155']
  }

  /*
   * --------------------------------------------------------------
   * BANDIERINA SQUADRA
   * --------------------------------------------------------------
   */

  const TeamFlag = ({
    teamData,
    playerTeam,
  }: {
    teamData?: TeamData
    playerTeam: string
  }) => {
    const colors = getTeamColors(teamData)

    const background =
      colors.length === 1
        ? colors[0]
        : `linear-gradient(90deg, ${colors
          .map(
            (color, index) =>
              `${color} ${(index / colors.length) * 100
              }%, ${color} ${((index + 1) / colors.length) *
              100
              }%`
          )
          .join(', ')})`

    return (
      <div
        className="
                                      relative
                                      w-7 h-5
                                      shrink-0
                                      rounded-md
                                      overflow-hidden
                                      flex
                                      border-2
                                      border-border-strong
                                      bg-surface-elevated
                                      shadow-lg
                                    "
        style={{
          background,
        }}
        title={
          teamData
            ? `${teamData.name} (${teamData.alias})`
            : playerTeam
        }
      />
    )
  }

  /*
   * --------------------------------------------------------------
   * LOGOUT
   * --------------------------------------------------------------
   */

  const handleLogout = async () => {
    await logout()
  }

  /*
   * --------------------------------------------------------------
   * USERNAME
   * --------------------------------------------------------------
   */

  const formatUsername = (
    name: string
  ) => {
    if (!name) return ''

    return (
      name.charAt(0).toUpperCase() +
      name.slice(1)
    )
  }

  /*
   * --------------------------------------------------------------
   * OBIETTIVO
   * --------------------------------------------------------------
   */

  const toggleTarget = async (
    playerId: string
  ) => {
    if (!user?.id) return

    const isAlreadyTarget =
      targetIds.includes(playerId)

    if (isAlreadyTarget) {
      const { error } =
        await supabase
          .from('user_targets')
          .delete()
          .eq('user_id', user.id)
          .eq('player_id', playerId)

      if (error) {
        console.error(
          'Errore rimozione obiettivo:',
          error
        )
        return
      }

      setTargetIds((prev) =>
        prev.filter(
          (id) => id !== playerId
        )
      )

      return
    }

    const { error } =
      await supabase
        .from('user_targets')
        .insert({
          user_id: user.id,
          player_id: playerId,
        })

    if (error) {
      console.error(
        'Errore inserimento obiettivo:',
        error
      )
      return
    }

    setTargetIds((prev) => [
      ...prev,
      playerId,
    ])
  }

  /*
   * --------------------------------------------------------------
   * FILTRI
   * --------------------------------------------------------------
   */

  const filteredPlayers =
    players.filter((player) => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase()

      const matchesSearch =
        !normalizedSearch ||
        player.name
          ?.toLowerCase()
          .includes(
            normalizedSearch
          )

      const matchesRole =
        roleFilter === 'TUTTI' ||
        player.role?.toUpperCase() ===
        roleFilter.toUpperCase()

      const matchesTeam =
        teamFilter === 'TUTTE' ||
        player.team === teamFilter

      return (
        matchesSearch &&
        matchesRole &&
        matchesTeam
      )
    })

  /*
   * --------------------------------------------------------------
   * RESET FILTRI
   * --------------------------------------------------------------
   */

  const handleResetFilters = () => {
    setSearchTerm('')
    setRoleFilter('TUTTI')
    setTeamFilter('TUTTE')
    setCurrentPage(1)
  }

  /*
   * --------------------------------------------------------------
   * PAGINAZIONE
   * --------------------------------------------------------------
   */

  const totalPages =
    Math.ceil(
      filteredPlayers.length /
      itemsPerPage
    ) || 1

  const safeCurrentPage =
    Math.min(
      currentPage,
      totalPages
    )

  const startIndex =
    (safeCurrentPage - 1) *
    itemsPerPage

  const currentPlayers =
    filteredPlayers.slice(
      startIndex,
      startIndex + itemsPerPage
    )

  useEffect(() => {
    setCurrentPage(1)
  }, [
    searchTerm,
    roleFilter,
    teamFilter,
  ])

  useEffect(() => {
    if (
      currentPage > totalPages
    ) {
      setCurrentPage(totalPages)
    }
  }, [
    currentPage,
    totalPages,
  ])

  /*
   * --------------------------------------------------------------
   * LOADING
   * --------------------------------------------------------------
   */

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />

          <p className="text-xs text-muted font-semibold tracking-wider uppercase">
            Caricamento Listone...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

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

      {/* =========================================================
          MAIN
      ========================================================= */}

      <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">
        <div className="max-w-[1500px] mx-auto space-y-6">

          {/* HEADER */}

          <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-primary" />
                </div>

                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  Mercato
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                Listone
              </h1>

              <p className="mt-1.5 text-sm text-muted">
                Cerca, filtra e seleziona i giocatori da tenere d'occhio.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2.5 rounded-xl bg-surface-elevated/70 border border-border/80">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-success" />

                  <span className="text-xs font-bold text-muted">
                    {remainingBudget} FM
                  </span>
                </div>
              </div>

              <div className="px-4 py-2.5 rounded-xl bg-surface-elevated/70 border border-border/80">
                <span className="text-xs font-bold text-muted">
                  {targetIds.length} obiettivi
                </span>
              </div>
            </div>
          </header>

          {/* FILTRI */}

          <section className="bg-surface-elevated/80 border border-border/80 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.6fr_0.8fr_1fr_auto] gap-4 items-end">

                {/* RICERCA */}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted">
                    Cerca calciatore
                  </label>

                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-2" />

                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) =>
                        setSearchTerm(
                          e.target.value
                        )
                      }
                      placeholder="Cerca per nome..."
                      className="
                        w-full
                        bg-background/70
                        border border-border
                        rounded-xl
                        py-3
                        pl-10
                        pr-4
                        text-sm
                        text-white
                        placeholder:text-muted-2
                        outline-none
                        focus:border-primary
                        focus:ring-2
                        focus:ring-primary/10
                        transition
                      "
                    />
                  </div>
                </div>

                {/* RUOLO */}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted">
                    Ruolo
                  </label>

                  <select
                    value={roleFilter}
                    onChange={(e) =>
                      setRoleFilter(
                        e.target.value
                      )
                    }
                    className="
                      w-full
                      bg-background/70
                      border border-border
                      rounded-xl
                      px-4
                      py-3
                      text-sm
                      text-white
                      outline-none
                      focus:border-primary
                      transition
                      cursor-pointer
                    "
                  >
                    <option value="TUTTI">
                      Tutti i ruoli
                    </option>
                    <option value="P">
                      Portieri
                    </option>
                    <option value="D">
                      Difensori
                    </option>
                    <option value="C">
                      Centrocampisti
                    </option>
                    <option value="A">
                      Attaccanti
                    </option>
                  </select>
                </div>

                {/* SQUADRA */}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted">
                    Squadra
                  </label>

                  <select
                    value={teamFilter}
                    onChange={(e) =>
                      setTeamFilter(
                        e.target.value
                      )
                    }
                    className="
                      w-full
                      bg-background/70
                      border border-border
                      rounded-xl
                      px-4
                      py-3
                      text-sm
                      text-white
                      outline-none
                      focus:border-primary
                      transition
                      cursor-pointer
                    "
                  >
                    <option value="TUTTE">
                      Tutte le squadre
                    </option>

                    {availableTeams.map(
                      (teamName) => (
                        <option
                          key={teamName}
                          value={teamName}
                        >
                          {teamName}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* RESET */}

                <button
                  type="button"
                  onClick={
                    handleResetFilters
                  }
                  disabled={
                    !searchTerm &&
                    roleFilter ===
                    'TUTTI' &&
                    teamFilter ===
                    'TUTTE'
                  }
                  className="
                    h-[46px]
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    px-4
                    rounded-xl
                    border border-border
                    bg-surface/60
                    text-xs
                    font-bold
                    text-muted
                    hover:text-white
                    hover:bg-surface-hover
                    disabled:opacity-30
                    disabled:cursor-not-allowed
                    transition
                  "
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
            </div>

            {/* RISULTATI */}

            <div className="px-5 md:px-6 py-3.5 border-t border-border/70 bg-background/20 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted">
                <span className="font-bold text-white">
                  {filteredPlayers.length}
                </span>{' '}
                calciatori trovati
              </div>

              {(searchTerm ||
                roleFilter !== 'TUTTI' ||
                teamFilter !==
                'TUTTE') && (
                  <div className="flex items-center gap-2">
                    {searchTerm && (
                      <span className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary-hover">
                        {searchTerm}
                      </span>
                    )}

                    {roleFilter !==
                      'TUTTI' && (
                        <span className="px-2.5 py-1 rounded-md bg-info/10 border border-info/20 text-[10px] font-bold text-info">
                          {roleFilter}
                        </span>
                      )}

                    {teamFilter !==
                      'TUTTE' && (
                        <span className="px-2.5 py-1 rounded-md bg-success/10 border border-success/20 text-[10px] font-bold text-success">
                          {teamFilter}
                        </span>
                      )}
                  </div>
                )}
            </div>
          </section>

          {/* TABELLA */}

          <section className="bg-surface-elevated/80 border border-border/80 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[820px]">
                <thead>
                  <tr className="border-b border-border bg-background/30">
                    <th className="px-5 md:px-6 py-4 text-[10px] font-black uppercase tracking-wider text-muted-2">
                      Calciatore
                    </th>

                    <th className="px-5 md:px-6 py-4 text-[10px] font-black uppercase tracking-wider text-muted-2">
                      Ruolo
                    </th>

                    <th className="px-5 md:px-6 py-4 text-[10px] font-black uppercase tracking-wider text-muted-2">
                      Squadra
                    </th>

                    <th className="px-5 md:px-6 py-4 text-right text-[10px] font-black uppercase tracking-wider text-muted-2">
                      FantaMedia
                    </th>

                    <th className="px-5 md:px-6 py-4 text-center text-[10px] font-black uppercase tracking-wider text-muted-2">
                      Obiettivo
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/60">
                  {currentPlayers.length >
                    0 ? (
                    currentPlayers.map(
                      (player) => {
                        const isTarget =
                          targetIds.includes(
                            player.id
                          )

                        const teamData =
                          getTeamData(
                            player.team
                          )

                        return (
                          <tr
                            key={
                              player.id
                            }
                            className={`
                              group
                              transition
                              ${player.is_out
                                ? 'bg-danger/5 hover:bg-danger/10'
                                : 'hover:bg-surface-hover/50'
                              }
                            `}
                          >
                            {/* NOME */}

                            <td className="px-5 md:px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`
                                    w-9 h-9
                                    shrink-0
                                    rounded-lg
                                    flex
                                    items-center
                                    justify-center
                                    text-[10px]
                                    font-black
                                    border
                                    ${player.is_out
                                      ? 'bg-danger/10 border-danger/20 text-danger'
                                      : 'bg-primary/10 border-primary/20 text-primary-hover'
                                    }
                                  `}
                                >
                                  {player.name
                                    .slice(
                                      0,
                                      2
                                    )
                                    .toUpperCase()}
                                </div>

                                <div className="min-w-0">
                                  <div
                                    className={`
                                      font-bold
                                      text-sm
                                      truncate
                                      ${player.is_out
                                        ? 'text-muted-2 line-through'
                                        : 'text-white'
                                      }
                                    `}
                                  >
                                    {
                                      player.name
                                    }
                                  </div>

                                  {player.is_out && (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-danger">
                                      Fuori Listone
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* RUOLO */}

                            <td className="px-5 md:px-6 py-4">
                              <span
                                className={`
                                  inline-flex
                                  min-w-8
                                  justify-center
                                  px-2.5
                                  py-1
                                  rounded-lg
                                  text-[10px]
                                  font-black
                                  border
                                  ${player.role ===
                                    'P'
                                    ? 'bg-role-p-bg border-role-p/20 text-role-p'
                                    : player.role ===
                                      'D'
                                      ? 'bg-role-d-bg border-role-d/20 text-role-d'
                                      : player.role ===
                                        'C'
                                        ? 'bg-role-c-bg border-role-c/20 text-role-c'
                                        : 'bg-role-a-bg border-role-a/20 text-role-a'
                                  }
                                `}
                              >
                                {
                                  player.role
                                }
                              </span>
                            </td>

                            {/* SQUADRA */}

                            <td className="px-5 md:px-6 py-4">
                              <div className="flex items-center gap-3">
                                <TeamFlag
                                  teamData={
                                    teamData
                                  }
                                  playerTeam={
                                    player.team
                                  }
                                />
                                {/* <div
                                  className="
                                      relative
                                      w-7 h-5
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
                                    player.team
                                  }
                                >                                    {teamColors.length > 0 ? (

                                  teamColors.map(
                                    (color, index) => (
                                      <span
                                        key={index}
                                        className="flex-1 h-full"
                                        style={{
                                          backgroundColor:
                                            color,
                                        }}
                                      />
                                    )
                                  )

                                ) : (

                                  <span
                                    className="w-full h-full"
                                    style={{
                                      backgroundColor:
                                        teamColor,
                                    }}
                                  />

                                )}</div> */}

                                <div className="min-w-0">                            
                                  {teamData?.alias && (
                                    <div className="text-[11px]

                                      uppercase

                                      font-black

                                      tracking-wider

                                      truncate">
                                      {
                                        teamData.alias
                                      }
                                    </div>
                                  )}
                                       <div className="text-[10px] text-muted-2 truncate mt-0.5">
                                    {teamData
                                      ?.name ??
                                      player.team}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* FANTAMEDIA */}

                            <td className="px-5 md:px-6 py-4 text-right">
                              <div className="inline-flex flex-col items-end">
                                <span
                                  className={`
                                    text-sm
                                    font-black
                                    ${player.is_out
                                      ? 'text-muted-2'
                                      : 'text-success'
                                    }
                                  `}
                                >
                                  {
                                    player.fanta_media
                                  }
                                </span>

                                <span className="text-[9px] uppercase tracking-wider text-muted-2 font-bold">
                                  FM
                                </span>
                              </div>
                            </td>

                            {/* OBIETTIVO */}

                            <td className="px-5 md:px-6 py-4 text-center">
                              <button
                                type="button"
                                disabled={player.is_out}
                                onClick={() =>
                                  !player.is_out && toggleTarget(
                                    player.id
                                  )
                                }
                                title={
                                  isTarget
                                    ? 'Rimuovi dagli obiettivi'
                                    : 'Aggiungi agli obiettivi'
                                }
                                className={`
                                  w-9 h-9
                                  rounded-xl
                                  inline-flex
                                  items-center
                                  justify-center
                                  border
                                  transition-all
                                  cursor-pointer
                                  ${player.is_out
                                    ? 'bg-background/30 text-muted-2 border-border opacity-30 cursor-not-allowed'
                                    : isTarget
                                    ? 'bg-accent/15 text-accent border-accent/30 shadow-sm shadow-accent/10 cursor-pointer'
                                    : 'bg-background/50 text-muted-2 border-border hover:text-accent hover:border-accent/30 hover:bg-accent/5 cursor-pointer'
                                  }
                                `}
                              >
                                <Target className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      }
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-20 text-center"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <Search className="w-8 h-8 text-muted-2" />

                          <div>
                            <p className="text-sm font-bold text-muted">
                              Nessun calciatore trovato
                            </p>

                            <p className="text-xs text-muted-2 mt-1">
                              Prova a modificare i filtri di ricerca.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={
                              handleResetFilters
                            }
                            className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-elevated hover:bg-surface-hover text-xs font-bold text-muted hover:text-foreground transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Resetta filtri
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINAZIONE */}

            <div className="px-5 md:px-6 py-4 border-t border-border/70 bg-background/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-muted-2">
                <span>Mostra</span>

                <select
                  value={
                    itemsPerPage
                  }
                  onChange={(e) => {
                    setItemsPerPage(
                      Number(
                        e.target.value
                      )
                    )
                    setCurrentPage(1)
                  }}
                  className="
                    bg-surface-elevated
                    border border-border
                    rounded-lg
                    px-2.5
                    py-1.5
                    text-xs
                    text-white
                    font-bold
                    outline-none
                    cursor-pointer
                  "
                >
                  <option value={15}>
                    15
                  </option>
                  <option value={20}>
                    20
                  </option>
                  <option value={50}>
                    50
                  </option>
                  <option value={100}>
                    100
                  </option>
                </select>

                <span>
                  di{' '}
                  <strong className="text-muted">
                    {
                      filteredPlayers.length
                    }
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage(
                      (prev) =>
                        Math.max(
                          prev - 1,
                          1
                        )
                    )
                  }
                  disabled={
                    safeCurrentPage ===
                    1
                  }
                  className="
                    w-9 h-9
                    rounded-xl
                    bg-surface-elevated
                    border border-border
                    text-muted
                    hover:text-white
                    hover:bg-surface-hover
                    disabled:opacity-30
                    disabled:cursor-not-allowed
                    transition
                    inline-flex
                    items-center
                    justify-center
                  "
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="px-3 text-xs font-bold text-muted">
                  Pagina{' '}
                  <span className="text-white">
                    {
                      safeCurrentPage
                    }
                  </span>{' '}
                  di {totalPages}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage(
                      (prev) =>
                        Math.min(
                          prev + 1,
                          totalPages
                        )
                    )
                  }
                  disabled={
                    safeCurrentPage ===
                    totalPages
                  }
                  className="
                    w-9 h-9
                    rounded-xl
                    bg-surface-elevated
                    border border-border
                    text-muted
                    hover:text-white
                    hover:bg-surface-hover
                    disabled:opacity-30
                    disabled:cursor-not-allowed
                    transition
                    inline-flex
                    items-center
                    justify-center
                  "
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}