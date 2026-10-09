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
  const [playerAssignedTeams, setPlayerAssignedTeams] = useState<Record<string, string>>({})

  const [teams, setTeams] = useState<TeamData[]>([])

  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('TUTTI')
  const [teamFilter, setTeamFilter] = useState('TUTTE')
  const [showOnlyFree, setShowOnlyFree] = useState(false)

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
       * SQUADRA UTENTE E BUDGET
       * ----------------------------------------------------------
       */

      try {
        const { data: teamData, error: teamError } = await supabase
          .from('league_teams')
          .select('id, name, logo_url')
          .eq('user_id', currentUser.id)
          .maybeSingle()

        if (teamData) {
          setTeam({
            id: teamData.id,
            name: teamData.name,
            logo_url: teamData.logo_url,
          })

          const { data: settings } = await supabase
            .from('league_settings')
            .select('initial_budget')
            .maybeSingle()

          const initialBudget =
            settings?.initial_budget ??
            currentUser.budget ??
            500

          const { data: boughtPlayers } = await supabase
            .from('league_team_players')
            .select('price')
            .eq('team_id', teamData.id)

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
        console.error('Errore caricamento squadra:', error)
      }

      /*
       * ----------------------------------------------------------
       * OBIETTIVI
       * ----------------------------------------------------------
       */

      try {
        const { data: targets } = await supabase
          .from('user_targets')
          .select('player_id')
          .eq('user_id', currentUser.id)

        if (targets) {
          setTargetIds(
            targets.map(
              (target: { player_id: string }) =>
                target.player_id
            )
          )
        }
      } catch (error) {
        console.error('Errore caricamento obiettivi:', error)
      }

      /*
       * ----------------------------------------------------------
       * GIOCATORI ASSEGNATI ALLE SQUADRE DI LEGA
       * ----------------------------------------------------------
       */

      try {
        const { data: assignedData } = await supabase
          .from('league_team_players')
          .select('player_id, league_teams(name)')

        if (assignedData) {
          const map: Record<string, string> = {}
          assignedData.forEach((item: any) => {
            const teamName = Array.isArray(item.league_teams) 
              ? item.league_teams[0]?.name 
              : item.league_teams?.name
            if (teamName) {
              map[item.player_id] = teamName
            }
          })
          setPlayerAssignedTeams(map)
        }
      } catch (error) {
        console.error('Errore caricamento assegnazioni:', error)
      }

      await loadTeams()
      await loadPlayers()

      setLoading(false)
    }

    async function loadTeams() {
      const { data } = await supabase
        .from('teams')
        .select('id, name, alias, color, colors')
        .order('name', { ascending: true })

      if (data) {
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
    }

    async function loadPlayers() {
      const { data } = await supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true })

      if (data) {
        setPlayers(data)

        const playerTeams = Array.from(
          new Set(
            data
              .map((player: Player) => player.team)
              .filter(Boolean)
          )
        ) as string[]

        setAvailableTeams(
          playerTeams.sort((a, b) => a.localeCompare(b))
        )
      }
    }

    loadData()
  }, [])

  const getTeamData = (playerTeam: string): TeamData | undefined => {
    if (!playerTeam) return undefined
    const normalizedPlayerTeam = playerTeam.trim().toLowerCase()
    return teams.find(
      (team) =>
        team.alias?.trim().toLowerCase() ===
        normalizedPlayerTeam
    )
  }

  const getTeamColors = (teamData?: TeamData): string[] => {
    if (!teamData) return ['#334155']
    if (Array.isArray(teamData.colors) && teamData.colors.length > 0) {
      return teamData.colors
    }
    if (teamData.color) return [teamData.color]
    return ['#334155']
  }

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
                `${color}${(index / colors.length) * 100}%, ${color}${((index + 1) / colors.length) * 100}%`
            )
            .join(', ')})`

    return (
      <div
        className="relative w-7 h-5 shrink-0 rounded-md overflow-hidden flex border-2 border-border-strong bg-surface-elevated shadow-lg"
        style={{ background }}
        title={teamData ? `${teamData.name} (${teamData.alias})` : playerTeam}
      />
    )
  }

  const handleLogout = async () => {
    await logout()
  }

  const toggleTarget = async (playerId: string) => {
    if (!user?.id) return

    const isAlreadyTarget = targetIds.includes(playerId)

    if (isAlreadyTarget) {
      await supabase
        .from('user_targets')
        .delete()
        .eq('user_id', user.id)
        .eq('player_id', playerId)

      setTargetIds((prev) => prev.filter((id) => id !== playerId))
      return
    }

    await supabase.from('user_targets').insert({
      user_id: user.id,
      player_id: playerId,
    })

    setTargetIds((prev) => [...prev, playerId])
  }

  /*
   * --------------------------------------------------------------
   * FILTRI (Incluso lo switch dei giocatori svincolati)
   * --------------------------------------------------------------
   */

  const filteredPlayers = players.filter((player) => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const matchesSearch =
      !normalizedSearch ||
      player.name?.toLowerCase().includes(normalizedSearch)

    const matchesRole =
      roleFilter === 'TUTTI' ||
      player.role?.toUpperCase() === roleFilter.toUpperCase()

    const matchesTeam =
      teamFilter === 'TUTTE' || player.team === teamFilter

    const matchesFree = !showOnlyFree || !playerAssignedTeams[player.id]

    return matchesSearch && matchesRole && matchesTeam && matchesFree
  })

  const handleResetFilters = () => {
    setSearchTerm('')
    setRoleFilter('TUTTI')
    setTeamFilter('TUTTE')
    setShowOnlyFree(false)
    setCurrentPage(1)
  }

  const totalPages =
    Math.ceil(filteredPlayers.length / itemsPerPage) || 1

  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const currentPlayers = filteredPlayers.slice(
    startIndex,
    startIndex + itemsPerPage
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, roleFilter, teamFilter, showOnlyFree])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

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

  if (!user) return null

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
            <div className="p-5 md:p-6 space-y-4">
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
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Cerca per nome..."
                      className="w-full bg-background/70 border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-muted-2 outline-none focus:border-primary transition"
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
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full bg-background/70 border border-border rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary transition cursor-pointer"
                  >
                    <option value="TUTTI">Tutti i ruoli</option>
                    <option value="P">Portieri</option>
                    <option value="D">Difensori</option>
                    <option value="C">Centrocampisti</option>
                    <option value="A">Attaccanti</option>
                  </select>
                </div>

                {/* SQUADRA */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted">
                    Squadra
                  </label>
                  <select
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className="w-full bg-background/70 border border-border rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary transition cursor-pointer"
                  >
                    <option value="TUTTE">Tutte le squadre</option>
                    {availableTeams.map((teamName) => (
                      <option key={teamName} value={teamName}>
                        {teamName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* RESET */}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  disabled={
                    !searchTerm &&
                    roleFilter === 'TUTTI' &&
                    teamFilter === 'TUTTE' &&
                    !showOnlyFree
                  }
                  className="h-[46px] inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-border bg-surface/60 text-xs font-bold text-muted hover:text-white hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>

              {/* SWITCH SOLO SVINCOLATI */}
              <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setShowOnlyFree(!showOnlyFree)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    showOnlyFree ? 'bg-primary' : 'bg-surface border border-border'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      showOnlyFree ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-bold text-white cursor-pointer" onClick={() => setShowOnlyFree(!showOnlyFree)}>
                  Mostra solo giocatori svincolati
                </span>
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
                      Squadra / Proprietario
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
                  {currentPlayers.length > 0 ? (
                    currentPlayers.map((player) => {
                      const isTarget = targetIds.includes(player.id)
                      const teamData = getTeamData(player.team)
                      const assignedTeamName = playerAssignedTeams[player.id]

                      return (
                        <tr
                          key={player.id}
                          className={`group transition ${
                            player.is_out
                              ? 'bg-danger/5 hover:bg-danger/10'
                              : 'hover:bg-surface-hover/50'
                          }`}
                        >
                          {/* NOME */}
                          <td className="px-5 md:px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-black border ${
                                  player.is_out
                                    ? 'bg-danger/10 border-danger/20 text-danger'
                                    : 'bg-primary/10 border-primary/20 text-primary-hover'
                                }`}
                              >
                                {player.name.slice(0, 2).toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <div
                                  className={`font-bold text-sm truncate ${
                                    player.is_out
                                      ? 'text-muted-2 line-through'
                                      : 'text-white'
                                  }`}
                                >
                                  {player.name}
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
                              className={`inline-flex min-w-8 justify-center px-2.5 py-1 rounded-lg text-[10px] font-black border ${
                                player.role === 'P'
                                  ? 'bg-role-p-bg border-role-p/20 text-role-p'
                                  : player.role === 'D'
                                  ? 'bg-role-d-bg border-role-d/20 text-role-d'
                                  : player.role === 'C'
                                  ? 'bg-role-c-bg border-role-c/20 text-role-c'
                                  : 'bg-role-a-bg border-role-a/20 text-role-a'
                              }`}
                            >
                              {player.role}
                            </span>
                          </td>

                          {/* SQUADRA / PROPRIETARIO */}
                          <td className="px-5 md:px-6 py-4">
                            <div className="flex items-center gap-3">
                              <TeamFlag
                                teamData={teamData}
                                playerTeam={player.team}
                              />
                              <div className="min-w-0">
                                <div className="text-[11px] uppercase font-black tracking-wider truncate">
                                  {teamData?.alias ?? player.team}
                                </div>
                                
                                {/* Mostra il nome della squadra di lega se assegnato, altrimenti "Svincolato" */}
                                {assignedTeamName ? (
                                  <span className="inline-block mt-0.5 text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20 truncate max-w-[140px]" title={assignedTeamName}>
                                    Assegnato a: {assignedTeamName}
                                  </span>
                                ) : (
                                  <span className="inline-block mt-0.5 text-[10px] font-semibold text-success">
                                    Svincolato
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* FANTAMEDIA */}
                          <td className="px-5 md:px-6 py-4 text-right">
                            <div className="inline-flex flex-col items-end">
                              <span
                                className={`text-sm font-black ${
                                  player.is_out ? 'text-muted-2' : 'text-success'
                                }`}
                              >
                                {player.fanta_media}
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
                                !player.is_out && toggleTarget(player.id)
                              }
                              title={
                                isTarget
                                  ? 'Rimuovi dagli obiettivi'
                                  : 'Aggiungi agli obiettivi'
                              }
                              className={`w-9 h-9 rounded-xl inline-flex items-center justify-center border transition-all cursor-pointer ${
                                player.is_out
                                  ? 'bg-background/30 text-muted-2 border-border opacity-30 cursor-not-allowed'
                                  : isTarget
                                  ? 'bg-accent/15 text-accent border-accent/30 shadow-sm shadow-accent/10 cursor-pointer'
                                  : 'bg-background/50 text-muted-2 border-border hover:text-accent hover:border-accent/30 hover:bg-accent/5 cursor-pointer'
                              }`}
                            >
                              <Target className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
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
                            onClick={handleResetFilters}
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
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="bg-surface-elevated border border-border rounded-lg px-2.5 py-1.5 text-xs text-white font-bold outline-none cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>
                  di{' '}
                  <strong className="text-muted">
                    {filteredPlayers.length}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={safeCurrentPage === 1}
                  className="w-9 h-9 rounded-xl bg-surface-elevated border border-border text-muted hover:text-white hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition inline-flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="px-3 text-xs font-bold text-muted">
                  Pagina{' '}
                  <span className="text-white">{safeCurrentPage}</span> di{' '}
                  {totalPages}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.min(prev + 1, totalPages)
                    )
                  }
                  disabled={safeCurrentPage === totalPages}
                  className="w-9 h-9 rounded-xl bg-surface-elevated border border-border text-muted hover:text-white hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition inline-flex items-center justify-center"
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