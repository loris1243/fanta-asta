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
  LayoutDashboard,
  Shield,
  ClipboardList,
  Inbox,
  Users,
  ScrollText,
  Building2,
  LogOut,
  Gavel,
} from 'lucide-react'

import { getCurrentUser, logout } from '../actions/auth'
import { supabase } from '../../lib/supabaseClient'

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
}

interface RoleBudget {
  mode: 'percentage' | 'fixed'
  P: number
  D: number
  C: number
  A: number
}

export default function ObiettiviPage() {
  const [user, setUser] = useState<UserProfile | null>(null)

  const [targets, setTargets] = useState<TargetPlayer[]>([])
  const [teams, setTeams] = useState<Team[]>([])

  const [loading, setLoading] = useState(true)
  const [showWarning, setShowWarning] = useState(false)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // ============================================================
  // BUDGET E IMPOSTAZIONI
  // ============================================================

  const [maxBudget, setMaxBudget] = useState<number>(500)

  const [roleBudget, setRoleBudget] = useState<RoleBudget>({
    mode: 'percentage',
    P: 0,
    D: 0,
    C: 0,
    A: 0,
  })

  // ============================================================
  // CARICAMENTO DATI
  // ============================================================

  useEffect(() => {
    async function loadData() {
      const currentUser = await getCurrentUser()

      if (!currentUser) {
        setLoading(false)
        return
      }

      setUser(currentUser)

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
          .eq('user_id', currentUser.id)

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
                : item.player,
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
              : [],
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
          .eq('user_id', currentUser.id)
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
          A: userBudgetPref.a_val ?? 0,
        })
      }

      setLoading(false)
    }

    loadData()
  }, [])

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
    if (!user?.id) return

    const timer = setTimeout(async () => {
      const { error } = await supabase
        .from('user_role_budgets')
        .upsert(
          {
            user_id: user.id,
            mode: roleBudget.mode,
            p_val: roleBudget.P,
            d_val: roleBudget.D,
            c_val: roleBudget.C,
            a_val: roleBudget.A,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
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
  }, [roleBudget, user?.id])

  // ============================================================
  // MODIFICA BUDGET
  // ============================================================

  const updateBudget = (
    roleKey: 'P' | 'D' | 'C' | 'A',
    value: number
  ) => {
    setRoleBudget((prev) => ({
      ...prev,
      [roleKey]: isNaN(value) ? 0 : value,
    }))
  }

  const toggleMode = (
    mode: 'percentage' | 'fixed'
  ) => {
    setRoleBudget((prev) => ({
      ...prev,
      mode,
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
    A: 'Attaccanti',
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />

          <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
            Caricamento obiettivi...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // ============================================================
  // PAGINA
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row">

      {/* =========================================================
          SIDEBAR
      ========================================================= */}

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
                <Gavel className="w-5 h-5" />
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
                setIsSidebarOpen((prev) => !prev)
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
              {user.username
                .slice(0, 2)
                .toUpperCase()}
            </div>

            {isSidebarOpen && (
              <div className="min-w-0 overflow-hidden">

                <p className="text-sm font-bold text-white truncate">
                  {formatUsername(user.username)}
                </p>

                <p className="text-xs text-emerald-400 font-extrabold mt-0.5">
                  {user.budget} FM
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
                h-11
                rounded-xl
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
                <span className="truncate">
                  Dashboard
                </span>
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
                h-11
                rounded-xl
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
                <span className="truncate">
                  La Mia Squadra
                </span>
              )}
            </Link>

            {/* OBIETTIVI ATTIVO */}

            <Link
              href="/obiettivi"
              title={
                !isSidebarOpen
                  ? 'I Miei Obiettivi'
                  : undefined
              }
              className="
                flex items-center
                h-11
                rounded-xl
                text-sm font-semibold
                text-slate-950
                bg-amber-500
                shadow-md
                shadow-amber-500/20
                transition-all
                gap-3 px-3.5
              "
            >
              <Target className="w-4 h-4 shrink-0" />

              {isSidebarOpen && (
                <span className="truncate">
                  I Miei Obiettivi
                </span>
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
                h-11
                rounded-xl
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
                <span className="truncate">
                  Listone
                </span>
              )}
            </Link>

            {/* ADMIN */}

            {user.role === 'admin' && (
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
                    h-10
                    rounded-xl
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
                    <span className="truncate">
                      Importa Listone
                    </span>
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
                    h-10
                    rounded-xl
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
                    <span className="truncate">
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
                    h-10
                    rounded-xl
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
                    <span className="truncate">
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
                    h-9
                    rounded-xl
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
                    <span className="truncate">
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
                    h-9
                    rounded-xl
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
            p-3 md:p-4
            border-t border-slate-800
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
              flex items-center
              h-11
              rounded-xl
              text-sm font-semibold
              text-red-400
              hover:text-red-300
              hover:bg-red-500/10
              transition-all
              cursor-pointer
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

      {/* =========================================================
          MAIN
      ========================================================= */}

      <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">

        <div className="max-w-[1500px] mx-auto space-y-6">

          {/* =====================================================
              HEADER
          ===================================================== */}

          <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">

            <div>

              <div className="flex items-center gap-2 mb-2">

                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-amber-400" />
                </div>

                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">
                  Strategia
                </span>

              </div>

              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                I Miei Obiettivi
              </h1>

              <p className="mt-1.5 text-sm text-slate-400">
                Gestisci i giocatori da tenere d'occhio e pianifica il tuo budget d'asta.
              </p>

            </div>

            <div className="flex items-center gap-3">

              <div className="px-4 py-2.5 rounded-xl bg-slate-800/70 border border-slate-700/80">

                <div className="flex items-center gap-2">

                  <Target className="w-4 h-4 text-amber-400" />

                  <span className="text-xs font-bold text-slate-300">
                    {targets.length} obiettivi
                  </span>

                </div>

              </div>

              <div className="px-4 py-2.5 rounded-xl bg-slate-800/70 border border-slate-700/80">

                <div className="flex items-center gap-2">

                  <span className="text-xs font-bold text-slate-300">
                    {maxBudget} FM
                  </span>

                </div>

              </div>

            </div>

          </header>

          {/* =====================================================
              WARNING BUDGET
          ===================================================== */}

          {showWarning && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">

              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />

              <div>

                <h3 className="text-sm font-bold text-red-400">
                  Budget superato
                </h3>

                <p className="text-xs text-red-400/70 mt-0.5">
                  Hai distribuito {totalDistributed} crediti su un massimo di {maxBudget}. Riduci le quote.
                </p>

              </div>

            </div>
          )}

          {/* =====================================================
              DISTRIBUZIONE BUDGET
          ===================================================== */}

          <section
            className={`
              bg-slate-800/80
              border
              rounded-2xl
              shadow-xl
              overflow-hidden
              ${
                showWarning
                  ? 'border-red-500/30'
                  : 'border-slate-700/80'
              }
            `}
          >

            <div className="p-5 md:p-6">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                <div>

                  <div className="flex items-center gap-2">

                    <Settings className="w-4 h-4 text-amber-400" />

                    <h2 className="text-sm font-black uppercase tracking-widest text-white">
                      Distribuzione Budget
                    </h2>

                  </div>

                  <p className="text-xs text-slate-400 mt-1">
                    Imposta quanto vuoi destinare a ciascun ruolo.
                  </p>

                </div>

                <div className="bg-slate-950/70 p-1 rounded-xl border border-slate-700/80 inline-flex items-center">

                  <button
                    type="button"
                    onClick={() =>
                      toggleMode('percentage')
                    }
                    className={`
                      flex items-center gap-1.5
                      px-3 py-1.5
                      rounded-lg
                      text-xs font-bold
                      transition
                      ${
                        roleBudget.mode === 'percentage'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }
                    `}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    Percentuale
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      toggleMode('fixed')
                    }
                    className={`
                      flex items-center gap-1.5
                      px-3 py-1.5
                      rounded-lg
                      text-xs font-bold
                      transition
                      ${
                        roleBudget.mode === 'fixed'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }
                    `}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Crediti Fissi
                  </button>

                </div>

              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">

                {roles.map((roleKey) => (

                  <div
                    key={roleKey}
                    className="
                      bg-slate-950/50
                      border border-slate-700/60
                      rounded-xl
                      p-4
                      space-y-3
                    "
                  >

                    <div className="flex justify-between items-center">

                      <span className="text-xs font-black text-slate-300">
                        {roleKey}
                      </span>

                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
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
                      className="
                        w-full
                        bg-slate-900
                        border border-slate-700
                        rounded-xl
                        px-3
                        py-2.5
                        text-sm
                        text-white
                        font-bold
                        outline-none
                        focus:border-amber-500
                        focus:ring-2
                        focus:ring-amber-500/10
                        transition
                      "
                    />

                  </div>

                ))}

              </div>

            </div>

            <div className="px-5 md:px-6 py-3.5 border-t border-slate-700/70 bg-slate-950/20 flex items-center justify-between">

              <span className="text-xs text-slate-500">
                Budget distribuito
              </span>

              <span
                className={`
                  text-xs font-black
                  ${
                    totalDistributed > maxBudget
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  }
                `}
              >
                {totalDistributed} / {maxBudget} cr.
              </span>

            </div>

          </section>

          {/* =====================================================
              OBIETTIVI PER RUOLO
          ===================================================== */}

          <div className="space-y-6">

            {roles.map((role) => {

              const rolePlayers =
                targets.filter(
                  (target) =>
                    target.player?.role?.toUpperCase() === role
                )

              return (

                <section
                  key={role}
                  className="
                    bg-slate-800/80
                    border border-slate-700/80
                    rounded-2xl
                    shadow-xl
                    overflow-hidden
                  "
                >

                  {/* HEADER RUOLO */}

                  <div className="px-5 md:px-6 py-4 border-b border-slate-700/70 bg-slate-950/20 flex items-center justify-between">

                    <div className="flex items-center gap-3">

                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">

                        <span className="text-xs font-black text-amber-400">
                          {role}
                        </span>

                      </div>

                      <h2 className="text-sm font-black text-white uppercase tracking-wider">
                        {roleTitles[role]}
                      </h2>

                    </div>

                    <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg">
                      {rolePlayers.length}
                    </span>

                  </div>

                  {/* CONTENUTO */}

                  <div className="p-5 md:p-6">

                    {rolePlayers.length > 0 ? (

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

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
                              className="
                                bg-slate-950/50
                                border border-slate-700/60
                                rounded-xl
                                p-4
                                flex items-center justify-between
                                gap-4
                                hover:border-slate-600
                                hover:bg-slate-950/80
                                transition
                              "
                            >

                              {/* INFO GIOCATORE */}

                              <div className="min-w-0">

                                <h3 className="font-bold text-sm text-white truncate">
                                  {item.player.name}
                                </h3>

                                {/* SQUADRA */}

                                <div className="mt-2 flex items-center gap-2.5 min-w-0">

                                  {/* BANDIERINA */}

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
                                    title={
                                      team?.name ??
                                      item.player.team
                                    }
                                  >

                                    {teamColors.length > 0 ? (

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

                                    )}

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
                                      color: teamColor,
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

                              {/* RIMUOVI */}

                              <button
                                type="button"
                                onClick={() =>
                                  removeTarget(item.id)
                                }
                                title="Rimuovi obiettivo"
                                className="
                                  shrink-0
                                  w-9 h-9
                                  rounded-xl
                                  inline-flex
                                  items-center
                                  justify-center
                                  border border-slate-700
                                  bg-slate-900/50
                                  text-slate-500
                                  hover:text-red-400
                                  hover:border-red-500/30
                                  hover:bg-red-500/10
                                  transition
                                  cursor-pointer
                                "
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>

                            </div>

                          )
                        })}

                      </div>

                    ) : (

                      <div className="py-10 text-center bg-slate-950/30 rounded-xl border border-slate-800">

                        <Target className="w-6 h-6 text-slate-700 mx-auto mb-2" />

                        <p className="text-xs text-slate-500 italic">
                          Nessun giocatore tra gli obiettivi.
                        </p>

                        <Link
                          href="/listone"
                          className="inline-flex items-center mt-3 text-[10px] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 transition"
                        >
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