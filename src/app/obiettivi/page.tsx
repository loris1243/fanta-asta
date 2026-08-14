'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getCurrentUser } from '../actions/auth'
import { supabase } from '../../lib/supabaseClient'
import {
  Target,
  Trash2,
  Settings,
  Percent,
  DollarSign,
  AlertTriangle
} from 'lucide-react'

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
}

interface RoleBudget {
  mode: 'percentage' | 'fixed'
  P: number
  D: number
  C: number
  A: number
}

export default function ObiettiviPage() {
  const [targets, setTargets] = useState<TargetPlayer[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [showWarning, setShowWarning] = useState(false)

  // ============================================================
  // BUDGET E IMPOSTAZIONI
  // ============================================================

  const [maxBudget, setMaxBudget] = useState<number>(500)

  const [roleBudget, setRoleBudget] = useState<RoleBudget>({
    mode: 'percentage',
    P: 0,
    D: 0,
    C: 0,
    A: 0
  })

  // ============================================================
  // CARICAMENTO DATI
  // ============================================================

  useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser()

      if (!user) {
        setLoading(false)
        return
      }

      setUserId(user.id)

      // --------------------------------------------------------
      // OBIETTIVI
      // --------------------------------------------------------

      const { data: targetsData, error: targetsError } =
        await supabase
          .from('user_targets')
          .select(`
            id,
            player_id,
            player:players(
              id,
              name,
              role,
              team,
              fvm
            )
          `)
          .eq('user_id', user.id)

      if (targetsError) {
        console.error(
          'Errore nel caricamento obiettivi:',
          targetsError
        )
      } else if (targetsData) {
        const formattedTargets: TargetPlayer[] =
          targetsData
            .filter((item: any) => item.player)
            .map((item: any) => ({
              id: item.id,
              player_id: item.player_id,
              player: Array.isArray(item.player)
                ? item.player[0]
                : item.player
            }))

        setTargets(formattedTargets)
      }

      // --------------------------------------------------------
      // SQUADRE
      // --------------------------------------------------------

      const { data: teamsData, error: teamsError } =
        await supabase
          .from('teams')
          .select(
            'id, name, alias, color, colors'
          )

      if (teamsError) {
        console.error(
          'Errore nel caricamento squadre:',
          teamsError
        )
      } else if (teamsData) {
        const formattedTeams: Team[] =
          teamsData.map((team: any) => ({
            id: team.id,
            name: team.name,
            alias: team.alias,
            color: team.color ?? null,
            colors: Array.isArray(team.colors)
              ? team.colors
              : []
          }))

        setTeams(formattedTeams)
      }

      // --------------------------------------------------------
      // SETTINGS
      // --------------------------------------------------------

      const { data: settingsData } =
        await supabase
          .from('settings')
          .select('*')
          .single()

      if (settingsData?.max_budget) {
        setMaxBudget(settingsData.max_budget)
      }

      // --------------------------------------------------------
      // BUDGET UTENTE
      // --------------------------------------------------------

      const { data: userBudgetPref } =
        await supabase
          .from('user_role_budgets')
          .select('*')
          .eq('user_id', user.id)
          .single()

      if (userBudgetPref) {
        setRoleBudget({
          mode:
            userBudgetPref.mode === 'fixed'
              ? 'fixed'
              : 'percentage',

          P: userBudgetPref.p_val ?? 0,
          D: userBudgetPref.d_val ?? 0,
          C: userBudgetPref.c_val ?? 0,
          A: userBudgetPref.a_val ?? 0
        })
      }

      setLoading(false)
    }

    loadData()
  }, [])

  // ============================================================
  // TROVA LA SQUADRA DEL GIOCATORE
  // players.team === teams.alias
  // case insensitive
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
  // CALCOLO CREDITI PER RUOLO
  // ============================================================

  const getEffectiveCredits = (
    roleKey: 'P' | 'D' | 'C' | 'A'
  ): number => {
    const value = roleBudget[roleKey]

    if (roleBudget.mode === 'percentage') {
      return Math.round(
        (maxBudget * value) / 100
      )
    }

    return value
  }

  const totalDistributed =
    getEffectiveCredits('P') +
    getEffectiveCredits('D') +
    getEffectiveCredits('C') +
    getEffectiveCredits('A')

  // ============================================================
  // CONTROLLO BUDGET
  // ============================================================

  useEffect(() => {
    setShowWarning(
      totalDistributed > maxBudget
    )
  }, [totalDistributed, maxBudget])

  // ============================================================
  // SALVATAGGIO AUTOMATICO
  // ============================================================

  useEffect(() => {
    if (!userId) return

    const timer = setTimeout(async () => {
      const { error } = await supabase
        .from('user_role_budgets')
        .upsert(
          {
            user_id: userId,
            mode: roleBudget.mode,
            p_val: roleBudget.P,
            d_val: roleBudget.D,
            c_val: roleBudget.C,
            a_val: roleBudget.A,
            updated_at:
              new Date().toISOString()
          },
          {
            onConflict: 'user_id'
          }
        )

      if (error) {
        console.error(
          'Errore salvataggio budget:',
          error
        )
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [roleBudget, userId])

  // ============================================================
  // MODIFICA BUDGET
  // ============================================================

  const updateBudget = (
    roleKey: 'P' | 'D' | 'C' | 'A',
    value: number
  ) => {
    setRoleBudget((prev) => ({
      ...prev,
      [roleKey]: isNaN(value) ? 0 : value
    }))
  }

  const toggleMode = (
    mode: 'percentage' | 'fixed'
  ) => {
    setRoleBudget((prev) => ({
      ...prev,
      mode
    }))
  }

  // ============================================================
  // RIMOZIONE OBIETTIVO
  // ============================================================

  const removeTarget = async (
    targetId: string
  ) => {
    const { error } = await supabase
      .from('user_targets')
      .delete()
      .eq('id', targetId)

    if (error) {
      console.error(
        'Errore eliminazione obiettivo:',
        error
      )
      return
    }

    setTargets((prev) =>
      prev.filter(
        (target) => target.id !== targetId
      )
    )
  }

  // ============================================================
  // RUOLI
  // ============================================================

  const roles = ['P', 'D', 'C', 'A'] as const

  const roleTitles: Record<string, string> = {
    P: 'Portieri',
    D: 'Difensori',
    C: 'Centrocampisti',
    A: 'Attaccanti'
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />

          <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
            Caricamento obiettivi...
          </p>
        </div>
      </div>
    )
  }

  // ============================================================
  // PAGINA
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-12 space-y-8">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="space-y-4 border-b border-slate-800 pb-6">

        <Link
          href="/"
          className="text-xs font-bold text-slate-400 hover:text-white transition uppercase tracking-wider"
        >
          ← Dashboard
        </Link>

        <div className="flex items-center gap-4">

          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-lg">
            <Target className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase">
              I Miei Obiettivi
            </h1>

            <p className="text-xs text-slate-400 font-medium">
              Gestisci la tua lista di giocatori puntati e configura il tuo budget.
            </p>
          </div>

        </div>
      </div>

      {/* ======================================================
          WARNING BUDGET
      ====================================================== */}

      {showWarning && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center gap-3">

          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />

          <div>
            <h3 className="text-sm font-bold text-red-500">
              Budget superato!
            </h3>

            <p className="text-xs text-red-400/80">
              Hai distribuito {totalDistributed} crediti su un massimo di {maxBudget}. Riduci le quote.
            </p>
          </div>

        </div>
      )}

      {/* ======================================================
          DISTRIBUZIONE BUDGET
      ====================================================== */}

      <div
        className={`bg-slate-800/80 border rounded-2xl p-6 shadow-xl space-y-5 ${
          showWarning
            ? 'border-red-500/30'
            : 'border-slate-700/80'
        }`}
      >

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">

          <div>

            <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              Distribuzione Budget per Ruolo
            </h2>

            <p className="text-xs text-slate-400">
              Limite admin:{' '}
              <strong className="text-emerald-400">
                {maxBudget} cr
              </strong>
            </p>

          </div>

          <div className="bg-slate-900 p-1 rounded-xl border border-slate-700/80 inline-flex items-center">

            <button
              type="button"
              onClick={() =>
                toggleMode('percentage')
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                roleBudget.mode === 'percentage'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              Percentuale (%)
            </button>

            <button
              type="button"
              onClick={() =>
                toggleMode('fixed')
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                roleBudget.mode === 'fixed'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Crediti Fissi
            </button>

          </div>

        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          {roles.map((roleKey) => (

            <div
              key={roleKey}
              className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 space-y-2"
            >

              <div className="flex justify-between items-center text-xs font-black text-slate-300">

                <span>
                  {roleKey}
                </span>

                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {getEffectiveCredits(roleKey)} cr.
                </span>

              </div>

              <input
                type="number"
                min="0"
                value={roleBudget[roleKey]}
                onChange={(e) =>
                  updateBudget(
                    roleKey,
                    Number(e.target.value)
                  )
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition"
              />

            </div>

          ))}

        </div>

        <div className="text-right text-xs font-bold pt-2">

          Totale:{' '}

          <span
            className={
              totalDistributed > maxBudget
                ? 'text-red-500'
                : 'text-emerald-400'
            }
          >
            {totalDistributed}
          </span>

          {' / '}

          {maxBudget} cr.

        </div>

      </div>

      {/* ======================================================
          OBIETTIVI PER RUOLO
      ====================================================== */}

      <div className="space-y-8">

        {roles.map((role) => {

          const rolePlayers =
            targets.filter(
              (target) =>
                target.player?.role?.toUpperCase() === role
            )

          return (

            <div
              key={role}
              className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl"
            >

              <div className="flex items-center justify-between mb-4">

                <h2 className="text-sm font-extrabold text-amber-400 uppercase tracking-wider">
                  {roleTitles[role]}
                </h2>

                <span className="text-[10px] font-bold text-slate-500 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-md">
                  {rolePlayers.length}
                </span>

              </div>

              {rolePlayers.length > 0 ? (

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                  {rolePlayers.map((item) => {

                    const team = getPlayerTeam(
                      item.player.team
                    )

                    const teamColor =
                      team?.color ?? '#3b82f6'

                    const teamColors =
                      team?.colors?.filter(Boolean) ?? []

                    return (

                      <div
                        key={item.id}
                        className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-slate-600 hover:bg-slate-900 transition"
                      >

                        {/* ==================================================
                            INFORMAZIONI GIOCATORE
                        ================================================== */}

                        <div className="min-w-0">

                          {/* NOME */}

                          <h3 className="font-bold text-sm text-white truncate">
                            {item.player.name}
                          </h3>

                          {/* =================================================
                              SQUADRA
                          ================================================= */}

                          <div className="mt-2 flex items-center gap-2.5 min-w-0">

{/* BANDIERINA SQUADRA */}

<div
  className="
    relative
    w-7 h-5
    shrink-0
    rounded-md
    overflow-hidden
    flex
    border-2
    border-slate-300/70
    bg-slate-800
    shadow-lg
  "
  title={team?.name ?? item.player.team}
>
  {teamColors.length > 0 ? (
    teamColors.map((color, index) => (
      <span
        key={index}
        className="flex-1 h-full"
        style={{
          backgroundColor: color,
        }}
      />
    ))
  ) : (
    <span
      className="w-full h-full"
      style={{
        backgroundColor: teamColor,
      }}
    />
  )}

  {/* leggero riflesso per renderla più leggibile */}
  <span className="absolute inset-0 bg-white/5 pointer-events-none" />
</div>

                            {/* ALIAS */}

                            <span
                              className="
                                text-[11px]
                                uppercase
                                font-black
                                tracking-wider
                                truncate
                              "
                              style={{
                                color: teamColor
                              }}
                            >
                              {team?.alias ??
                                item.player.team}
                            </span>

                          </div>

                          {/* NOME UFFICIALE */}

                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {team?.name ??
                              item.player.team}
                          </p>

                          {/* FVM */}

                          <p className="text-[10px] text-slate-600 font-semibold mt-1">
                            FVM {item.player.fvm}
                          </p>

                        </div>

                        {/* ==================================================
                            RIMUOVI
                        ================================================== */}

                        <button
                          type="button"
                          onClick={() =>
                            removeTarget(item.id)
                          }
                          title="Rimuovi obiettivo"
                          className="shrink-0 p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                      </div>

                    )
                  })}

                </div>

              ) : (

                <div className="py-5 text-center bg-slate-900/40 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-500 italic">
                    Nessun giocatore.
                  </p>
                </div>

              )}

            </div>

          )
        })}

      </div>

    </div>
  )
}