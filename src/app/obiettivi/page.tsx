'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Target,
  Trash2,
  Settings,
  Percent,
  DollarSign,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'

import { getCurrentUser, logout } from '../actions/auth'
import { supabase } from '../../lib/supabaseClient'
import DashboardSidebar from '../../components/DashboardSidebar'

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

interface Player {
  id: number
  name: string
  role: string
  team: string
  fvm: number
}

interface TargetPlayer {
  id: string
  player_id: number
  player: Player
  replacement_player_id?: number | null
}

interface RosterPlayer {
  id: string
  price: number
  players: {
    id: number
    name: string
    team: string
    role: string
  } | null
}

export default function ObiettiviPage() {
  const [remainingBudget, setRemainingBudget] = useState(500)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)

  const [targets, setTargets] = useState<TargetPlayer[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [userRoster, setUserRoster] = useState<RosterPlayer[]>([])

  const [loading, setLoading] = useState(true)
  const [showWarning, setShowWarning] = useState(false)
  const [isSubmittingAll, setIsSubmittingAll] = useState(false)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const [maxBudget, setMaxBudget] = useState<number>(500)
  const [budgetMode, setBudgetMode] = useState<'percentage' | 'fixed'>('percentage')
  
  const [percentBudget, setPercentBudget] = useState({ P: 0, D: 0, C: 0, A: 0 })
  const [fixedBudget, setFixedBudget] = useState({ P: 0, D: 0, C: 0, A: 0 })

  useEffect(() => {
    async function loadData() {
      const currentUser = await getCurrentUser()

      if (!currentUser) {
        setLoading(false)
        return
      }

      setUser(currentUser)

      // Caricamento Obiettivi (inclusa la colonna di sostituzione se presente nel DB)
      const { data: targetsData, error: targetsError } = await supabase
        .from('user_targets')
        .select(`
          id,
          player_id,
          replacement_player_id,
          player:players(
            id,
            name,
            role,
            team,
            fvm
          )
        `)
        .eq('user_id', currentUser.id)

      if (targetsError) {
        console.error('Errore nel caricamento obiettivi:', targetsError)
      } else if (targetsData) {
        const formattedTargets: TargetPlayer[] = targetsData
          .filter((item: any) => item.player)
          .map((item: any) => ({
            id: item.id,
            player_id: item.player_id,
            replacement_player_id: item.replacement_player_id ?? null,
            player: Array.isArray(item.player) ? item.player[0] : item.player,
          }))

        setTargets(formattedTargets)
      }

      // Caricamento Squadre reali
      const { data: teamsData } = await supabase.from('teams').select('id, name, alias, color, colors')
      if (teamsData) {
        setTeams(teamsData.map((team: any) => ({
          id: team.id,
          name: team.name,
          alias: team.alias,
          color: team.color ?? null,
          colors: Array.isArray(team.colors) ? team.colors : [],
        })))
      }

      // Caricamento Rosa della squadra dell'utente per il menu a tendina "chi sostituirebbe"
      const { data: teamData } = await supabase
        .from('league_teams')
        .select('id, name')
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (teamData) {
        const { data: rosterData } = await supabase
          .from('league_team_players')
          .select(`
            id,
            price,
            players (
              id,
              name,
              team,
              role
            )
          `)
          .eq('team_id', teamData.id)

        if (rosterData) {
          const formattedRoster = rosterData.map((item: any) => ({
            id: item.id,
            price: item.price,
            players: Array.isArray(item.players) ? (item.players[0] || null) : (item.players || null)
          }))
          setUserRoster(formattedRoster)
        }
      }

      const { data: settingsData } = await supabase.from('settings').select('*').single()
      if (settingsData?.max_budget) setMaxBudget(settingsData.max_budget)

      const { data: userBudgetPref } = await supabase
        .from('user_role_budgets')
        .select('*')
        .eq('user_id', currentUser.id)
        .single()

      if (userBudgetPref) {
        const mode = userBudgetPref.mode === 'fixed' ? 'fixed' : 'percentage'
        setBudgetMode(mode)
        const loadedValues = {
          P: userBudgetPref.p_val ?? 0,
          D: userBudgetPref.d_val ?? 0,
          C: userBudgetPref.c_val ?? 0,
          A: userBudgetPref.a_val ?? 0,
        }
        if (mode === 'fixed') setFixedBudget(loadedValues)
        else setPercentBudget(loadedValues)
      }

      const initialBudget = settingsData?.initial_budget ?? currentUser.budget ?? 500
      const { data: boughtPlayers } = await supabase
        .from('league_team_players')
        .select('price')
        .eq('team_id', teamData?.id)

      const totalSpent = boughtPlayers?.reduce((acc, player) => acc + (player.price || 0), 0) ?? 0
      setRemainingBudget(Math.max(initialBudget - totalSpent, 0))

      setLoading(false)
    }

    loadData()
  }, [])

  const handleLogout = async () => {
    await logout()
  }

  const getPlayerTeam = (playerTeam: string): Team | null => {
    if (!playerTeam) return null
    const normalizedPlayerTeam = playerTeam.trim().toLowerCase()
    return teams.find((team) => team.alias?.trim().toLowerCase() === normalizedPlayerTeam) ?? null
  }

  const currentActiveBudget = budgetMode === 'percentage' ? percentBudget : fixedBudget

  const getEffectiveCredits = (roleKey: 'P' | 'D' | 'C' | 'A'): number => {
    const value = currentActiveBudget[roleKey]
    if (budgetMode === 'percentage') return Math.round((maxBudget * value) / 100)
    return value
  }

  const totalDistributed = getEffectiveCredits('P') + getEffectiveCredits('D') + getEffectiveCredits('C') + getEffectiveCredits('A')

  useEffect(() => {
    setShowWarning(totalDistributed > maxBudget)
  }, [totalDistributed, maxBudget])

  // 1. FUNZIONE PER CANCELLARE TUTTI GLI OBIETTIVI
  const removeAllTargets = async () => {
    if (!user?.id) return
    if (!window.confirm("Sei sicuro di voler eliminare tutti gli obiettivi salvati?")) return

    setIsSubmittingAll(true)
    const { error } = await supabase
      .from('user_targets')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Errore durante la cancellazione di tutti gli obiettivi:', error)
    } else {
      setTargets([])
    }
    setIsSubmittingAll(false)
  }

  const removeTarget = async (targetId: string) => {
    const { error } = await supabase.from('user_targets').delete().eq('id', targetId)
    if (!error) {
      setTargets((prev) => prev.filter((target) => target.id !== targetId))
    }
  }

  // 2. FUNZIONE PER AGGIORNARE IL GIOCATORE DA SOSTITUIRE
  const updateReplacementPlayer = async (targetId: string, replacementPlayerId: number | null) => {
    // Aggiornamento locale immediato
    setTargets((prev) =>
      prev.map((t) => (t.id === targetId ? { ...t, replacement_player_id: replacementPlayerId } : t))
    )

    // Salvataggio su Supabase
    const { error } = await supabase
      .from('user_targets')
      .update({ replacement_player_id: replacementPlayerId })
      .eq('id', targetId)

    if (error) {
      console.error('Errore aggiornamento sostituzione:', error)
    }
  }

  const roles: ('P' | 'D' | 'C' | 'A')[] = ['P', 'D', 'C', 'A']
  const roleTitles: Record<string, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted font-semibold tracking-wider uppercase">Caricamento obiettivi...</p>
        </div>
      </div>
    )
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

      <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">
        <div className="max-w-[1500px] mx-auto space-y-6">

          {/* HEADER CON PULSANTE CANCELLA TUTTI */}
          <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-accent" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">Strategia</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">I Miei Obiettivi</h1>
              <p className="mt-1.5 text-sm text-muted">Gestisci i giocatori da tenere d'occhio e pianifica il tuo budget d'asta.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2.5 rounded-xl bg-surface-elevated/70 border border-border/80 flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" />
                <span className="text-xs font-bold text-muted">{targets.length} obiettivi</span>
              </div>

              {targets.length > 0 && (
                <button
                  type="button"
                  onClick={removeAllTargets}
                  disabled={isSubmittingAll}
                  className="px-4 py-2.5 rounded-xl bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Cancella tutti
                </button>
              )}
            </div>
          </header>

          {showWarning && (
            <div className="bg-danger/10 border border-danger/30 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-danger shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-danger">Budget superato</h3>
                <p className="text-xs text-danger/70 mt-0.5">Hai distribuito {totalDistributed} crediti su un massimo di {maxBudget}.</p>
              </div>
            </div>
          )}

          {/* OBIETTIVI PER RUOLO */}
          <div className="space-y-6">
            {roles.map((role) => {
              const rolePlayers = targets.filter((target) => target.player?.role?.toUpperCase() === role)
              // Filtra i giocatori in rosa dello stesso ruolo per la select di sostituzione
              const availableRoleRoster = userRoster.filter((item) => item.players?.role?.toUpperCase() === role)

              return (
                <section key={role} className="bg-surface-elevated/80 border border-border/80 rounded-2xl shadow-xl overflow-hidden">
                  <div className="px-5 md:px-6 py-4 border-b border-border/70 bg-background/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                        <span className="text-xs font-black text-accent">{role}</span>
                      </div>
                      <h2 className="text-sm font-black text-white uppercase tracking-wider">{roleTitles[role]}</h2>
                    </div>
                    <span className="text-[10px] font-bold text-muted bg-surface border border-border px-2.5 py-1 rounded-lg">
                      {rolePlayers.length}
                    </span>
                  </div>

                  <div className="p-5 md:p-6">
                    {rolePlayers.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {rolePlayers.map((item) => {
                          const team = getPlayerTeam(item.player.team)
                          const teamColors = team?.colors?.filter(Boolean) ?? []

                          return (
                            <div key={item.id} className="bg-background/50 border border-border/60 rounded-xl p-4 flex flex-col justify-between gap-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <h3 className="font-bold text-sm text-white truncate">{item.player.name}</h3>
                                  <div className="mt-2 flex items-center gap-2.5 min-w-0">
                                    <div className="relative w-7 h-5 shrink-0 rounded-md overflow-hidden flex border-2 border-border-strong bg-surface-elevated shadow-lg">
                                      {teamColors.length > 0 ? (
                                        teamColors.map((color, idx) => (
                                          <span key={idx} className="flex-1 h-full" style={{ backgroundColor: color }} />
                                        ))
                                      ) : (
                                        <span className="w-full h-full" />
                                      )}
                                    </div>
                                    <span className="text-[11px] uppercase font-black tracking-wider truncate">{team?.alias ?? item.player.team}</span>
                                  </div>
                                  <p className="text-[10px] text-muted-2 font-semibold mt-1">FVM {item.player.fvm}</p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeTarget(item.id)}
                                  title="Rimuovi obiettivo"
                                  className="shrink-0 w-9 h-9 rounded-xl inline-flex items-center justify-center border border-border bg-surface/50 text-muted-2 hover:text-danger hover:border-danger/30 hover:bg-danger/10 transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Selezione giocatore in rosa da sostituire */}
                              <div className="pt-2 border-t border-border/40">
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                                  Sostituirebbe in rosa:
                                </label>
                                <select
                                  value={item.replacement_player_id ?? ''}
                                  onChange={(e) => updateReplacementPlayer(item.id, e.target.value ? Number(e.target.value) : null)}
                                  className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-accent"
                                >
                                  <option value="">Nessuno / Slot libero</option>
                                  {availableRoleRoster.map((rosterItem) => (
                                    <option key={rosterItem.id} value={rosterItem.players?.id}>
                                      {rosterItem.players?.name} ({rosterItem.price} cr.)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="py-10 text-center bg-background/30 rounded-xl border border-border">
                        <Target className="w-6 h-6 text-muted-2 mx-auto mb-2" />
                        <p className="text-xs text-muted-2 italic">Nessun giocatore tra gli obiettivi.</p>
                        <Link href="/listone" className="inline-flex items-center mt-3 text-[10px] font-bold uppercase tracking-wider text-accent hover:text-accent-hover transition">
                          Vai al Listone
                        </Link>
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>

        </div>
      </main>
    </div>
  )
}