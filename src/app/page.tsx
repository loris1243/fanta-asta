'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getCurrentUser, logout } from '../app/actions/auth'
import { createAuction } from '../app/actions/auctions'
import DashboardSidebar from '../components/DashboardSidebar'
import { supabase } from '../lib/supabaseClient'
import {
  Shield,
  History,
  Wallet,
  ArrowUpRight,
  Target,
  ClipboardList,
  Plus,
  Trash2,
  Gavel,
  Trophy,
  ChevronRight,
} from 'lucide-react'

interface UserProfile {
  id: string
  username: string
  role: string
  budget: number
}

interface TeamData {
  id?: string
  name: string
  logo_url?: string
}

interface AuctionItem {
  id: string
  status: string
  created_at: string
}

/* ============================================================
   AUCTION ITEM
============================================================ */

function AuctionContent({
  item,
  isInCorso,
  isNuova,
  isTerminata,
  user,
  handleDeleteAuction,
}: {
  item: AuctionItem
  isInCorso: boolean
  isNuova: boolean
  isTerminata: boolean
  user: UserProfile
  handleDeleteAuction: (auctionId: string, e: React.MouseEvent) => void
}) {
  return (
    <div className="flex items-center justify-between w-full gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isInCorso
                ? 'bg-amber-400'
                : isNuova
                ? 'bg-blue-400'
                : isTerminata
                ? 'bg-green-400' 
                :'bg-slate-500'
            }`}
          />

          {isInCorso && (
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping opacity-60" />
          )}
        </div>

        <div className="min-w-0">
          <p className="font-bold text-white uppercase tracking-wide truncate">
            Asta #{item.id.slice(0, 6)}
          </p>

          <p className="text-[10px] text-slate-500 truncate">
            Creata il{' '}
            {new Date(item.created_at).toLocaleDateString('it-IT', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
            isInCorso
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
              : isNuova
              ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'              
              : isTerminata
              ? 'bg-green-500/10 text-blue-300 border-green-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {isInCorso ? 'In corso' : isNuova ? 'Nuova' : isTerminata?'Conclusa' : item.status}
        </span>

        {user.role === 'admin' && !isTerminata && (
          <button
            onClick={(e) => handleDeleteAuction(item.id, e)}
            type="button"
            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
            title="Elimina asta"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   DASHBOARD
============================================================ */

export default function DashboardPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [season, setSeason] = useState('Stagione in corso')
  const [user, setUser] = useState<UserProfile | null>(null)

  const [team, setTeam] = useState<TeamData>({
    name: 'Nessuna squadra associata',
  })

  const [remainingBudget, setRemainingBudget] = useState<number>(500)
  const [auctions, setAuctions] = useState<AuctionItem[]>([])
  const [loading, setLoading] = useState(true)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const [leagueName, setLeagueName] = useState('La mia Lega')
  const [initialBudget, setInitialBudget] = useState<number>(500)

  /* ==========================================================
     LOAD DATA
  ========================================================== */

  useEffect(() => {
    async function loadData() {
      const u = await getCurrentUser()
      setUser(u)

      try {
        const { data: settings } = await supabase
          .from('league_settings')
          .select('*')
          .maybeSingle()

        if (settings?.league_name) {
          setLeagueName(settings.league_name)
        }

        if (settings?.initial_budget) {
          setInitialBudget(settings.initial_budget)
        }
      } catch (err) {
        console.error('Errore caricamento impostazioni:', err)
      }

      let currentTeamId = null

      if (u?.id) {
        try {
          const { data: teamData } = await supabase
            .from('league_teams')
            .select('id, name, logo_url')
            .eq('user_id', u.id)
            .maybeSingle()

          if (teamData?.name) {
            currentTeamId = teamData.id

            setTeam({
              id: teamData.id,
              name: teamData.name,
              logo_url: teamData.logo_url,
            })
          }
        } catch (err) {
          console.error('Errore caricamento squadra:', err)
        }
      }

      if (currentTeamId) {
        try {
          const { data: boughtPlayers } = await supabase
            .from('league_team_players')
            .select('price')
            .eq('team_id', currentTeamId)

          if (boughtPlayers && boughtPlayers.length > 0) {
            const totalSpent = boughtPlayers.reduce(
              (acc, curr) => acc + (curr.price || 0),
              0
            )

            setRemainingBudget(initialBudget - totalSpent)
          } else {
            setRemainingBudget(initialBudget)
          }
        } catch (err) {
          console.error('Errore calcolo budget:', err)
          setRemainingBudget(initialBudget)
        }
      } else {
        setRemainingBudget(initialBudget)
      }

      try {
        const { data: auctionData } = await supabase
          .from('auctions')
          .select('id, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5)

        if (auctionData) {
          setAuctions(auctionData)
        }
      } catch (err) {
        console.error('Errore caricamento aste:', err)
      }

      const currentYear = new Date().getFullYear()
      setSeason(`${currentYear}/${currentYear + 1}`)

      setLoading(false)
    }

    loadData()

    /* ========================================================
       REALTIME ASTE
    ======================================================== */

    const channel = supabase
      .channel('realtime-auctions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auctions',
        },
        async () => {
          const { data: updatedAuctions } = await supabase
            .from('auctions')
            .select('id, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5)

          if (updatedAuctions) {
            setAuctions(updatedAuctions)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  /* ==========================================================
     ACTIONS
  ========================================================== */

  const handleLogout = async () => {
    await logout()
  }

  const formatUsername = (name: string) => {
    if (!name) return ''

    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  const handleNewAuctionClick = async () => {
    const res = await createAuction()

    if (!res.success) {
      alert(res.error || "Errore durante l'avvio della nuova asta.")
    }
  }

  const handleDeleteAuction = async (
    auctionId: string,
    e: React.MouseEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!window.confirm('Sei sicuro di voler eliminare questa asta?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('auctions')
        .delete()
        .eq('id', auctionId)

      if (error) {
        alert(
          "Errore durante l'eliminazione dell'asta: " + error.message
        )
      } else {
        setAuctions((prev) =>
          prev.filter((item) => item.id !== auctionId)
        )
      }
    } catch (err) {
      console.error('Errore imprevisto:', err)
      alert("Errore imprevisto durante l'eliminazione.")
    }
  }

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />

          <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">
            Caricamento FantAsta...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row">
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
          MAIN CONTENT
      ====================================================== */}

      <main className="flex-1 min-w-0 overflow-y-auto">

        <div className="max-w-[1500px] mx-auto p-5 sm:p-6 lg:p-8 xl:p-10">

          {/* ==================================================
              TOP BAR
          ================================================== */}

          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1">
                Dashboard
              </p>

              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Panoramica
              </h2>
            </div>

            <div className="flex items-center gap-2">

              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
                <Trophy className="w-4 h-4 text-amber-400" />

                <span className="text-xs font-bold text-slate-300">
                  {leagueName}
                </span>
              </div>

              <div className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <span className="text-xs font-bold text-blue-300">
                  {season}
                </span>
              </div>

            </div>
          </header>

          {/* ==================================================
              TEAM HERO
          ================================================== */}

          <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-xl mb-6">

            <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative p-6 sm:p-8 lg:p-10">

              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">

                <div className="flex items-center gap-5 sm:gap-6 min-w-0">

                  {team.logo_url ? (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-950/80 border border-slate-700 flex items-center justify-center p-2 shrink-0 shadow-lg">
                      <img
                        src={team.logo_url}
                        alt="Logo Squadra"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-lg">
                      <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-blue-400" />
                    </div>
                  )}

                  <div className="min-w-0">

                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-blue-400 mb-2">
                      La tua squadra
                    </p>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white uppercase break-words">
                      {team.name}
                    </h1>

                    <Link
                      href="/rosa"
                      className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-slate-400 hover:text-white transition"
                    >
                      Gestisci la rosa
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>

                  </div>
                </div>

                <div className="shrink-0 lg:min-w-[230px]">

                  <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-5">

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase tracking-[0.15em] font-black text-slate-500">
                        Budget disponibile
                      </span>

                      <Wallet className="w-4 h-4 text-emerald-400" />
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-emerald-400">
                        {remainingBudget}
                      </span>

                      <span className="text-xs font-bold text-slate-500">
                        FM
                      </span>
                    </div>

                    <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              (remainingBudget /
                                Math.max(initialBudget, 1)) *
                              100
                            )
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-slate-600">
                        Disponibile
                      </span>

                      <span className="text-[10px] font-bold text-slate-500">
                        {initialBudget} FM iniziali
                      </span>
                    </div>

                  </div>

                </div>

              </div>

            </div>
          </section>

          {/* ==================================================
              LOWER GRID
          ================================================== */}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">

            <section className="rounded-3xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden">

              <div className="p-5 sm:p-6 border-b border-slate-800">

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                  <div className="flex items-center gap-3">

                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <History className="w-5 h-5 text-blue-400" />
                    </div>

                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">
                        Aste recenti
                      </h3>

                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Stato delle ultime aste della lega
                      </p>
                    </div>

                  </div>

                  <div className="flex items-center gap-2">

                    {user.role === 'admin' && (
                      <button
                        onClick={handleNewAuctionClick}
                        type="button"
                        className="
                          inline-flex items-center gap-1.5
                          px-3.5 py-2
                          bg-blue-600
                          hover:bg-blue-500
                          text-white
                          text-xs font-bold
                          rounded-xl
                          transition-all
                          shadow-md shadow-blue-600/20
                          active:scale-[0.98]
                          cursor-pointer
                        "
                      >
                        <Plus className="w-4 h-4" />
                        Nuova asta
                      </button>
                    )}

                    {/* <Link
                      href="/rosa"
                      className="
                        inline-flex items-center gap-1
                        px-3.5 py-2
                        rounded-xl
                        bg-slate-800
                        hover:bg-slate-700
                        text-xs font-bold
                        text-slate-300
                        hover:text-white
                        transition
                      "
                    >
                      Vedi tutte
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link> */}

                  </div>

                </div>

              </div>

              <div className="p-5 sm:p-6">

                {auctions.length > 0 ? (
                  <div className="space-y-2.5">

                    {auctions.map((item) => {

                      const isInCorso =
                        item.status === 'in_corso' ||
                        item.status === 'active'

                      const isNuova =
                        item.status === 'pending' ||
                        item.status === 'nuova' ||
                        item.status === 'da_iniziare'

                      const conclusa =
                        item.status === 'conclusa'  

                      const handleAuctionClick = (
                        e: React.MouseEvent
                      ) => {
                        if (isInCorso) {
                          e.preventDefault()
                          alert(
                            "Non puoi unirti ad un'asta in corso"
                          )
                        }
                      }

                      return (
                        <div
                          key={item.id}
                          onClick={handleAuctionClick}
                          className={`
                            group
                            border rounded-2xl
                            px-4 py-3.5
                            flex items-center justify-between
                            text-xs sm:text-sm
                            transition-all
                            ${
                              isInCorso
                                ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                                : isNuova
                                ? 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40'
                                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                            }
                          `}
                        >
                          {isInCorso ? (
                            <AuctionContent
                              item={item}
                              isInCorso={isInCorso}
                              isNuova={isNuova}
                              isTerminata = {conclusa}
                              user={user}
                              handleDeleteAuction={
                                handleDeleteAuction
                              }
                            />
                          ) : (
                            <Link
                              href={`/asta/${item.id}`}
                              className="contents"
                            >
                              <AuctionContent
                                item={item}
                                isInCorso={isInCorso}
                                isNuova={isNuova}
                                isTerminata = {conclusa}
                                user={user}
                                handleDeleteAuction={
                                  handleDeleteAuction
                                }
                              />
                            </Link>
                          )}
                        </div>
                      )
                    })}

                  </div>
                ) : (
                  <div className="py-14 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/30">

                    <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
                      <Gavel className="w-5 h-5 text-slate-600" />
                    </div>

                    <p className="text-sm font-semibold text-slate-400">
                      Nessuna asta recente
                    </p>

                    <p className="text-xs text-slate-600 mt-1">
                      Le nuove aste compariranno qui.
                    </p>

                  </div>
                )}

              </div>
            </section>

            <aside className="space-y-6">

              <section className="rounded-3xl border border-slate-800 bg-slate-900 shadow-xl p-6">

                <div className="flex items-center justify-between mb-5">

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] font-black text-slate-500">
                      Situazione
                    </p>

                    <h3 className="text-sm font-black text-white mt-1">
                      Il tuo budget
                    </h3>
                  </div>

                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                  </div>

                </div>

                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-white">
                    {remainingBudget}
                  </span>

                  <span className="text-xs font-bold text-slate-500 mb-1">
                    FM
                  </span>
                </div>

                <div className="mt-4 space-y-2">

                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">
                      Budget iniziale
                    </span>

                    <span className="font-bold text-slate-300">
                      {initialBudget} FM
                    </span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">
                      Speso
                    </span>

                    <span className="font-bold text-slate-300">
                      {Math.max(
                        0,
                        initialBudget - remainingBudget
                      )}{' '}
                      FM
                    </span>
                  </div>

                </div>

                <Link
                  href="/rosa"
                  className="mt-5 flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white transition"
                >
                  <span>Vai alla rosa</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>

              </section>

              <section className="rounded-3xl border border-slate-800 bg-slate-900 shadow-xl p-6">

                <div className="flex items-center gap-3 mb-5">

                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-purple-400" />
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] font-black text-slate-500">
                      Competizione
                    </p>

                    <h3 className="text-sm font-black text-white mt-1">
                      {leagueName}
                    </h3>
                  </div>

                </div>

                <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4">

                  <div className="flex items-center justify-between">

                    <div>
                      <p className="text-[10px] text-slate-600 uppercase font-black tracking-wider">
                        Stagione
                      </p>

                      <p className="text-sm font-bold text-slate-300 mt-1">
                        {season}
                      </p>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-amber-400" />
                    </div>

                  </div>

                </div>

              </section>

              <section className="rounded-3xl border border-slate-800 bg-slate-900 shadow-xl p-5">

                <p className="text-[10px] uppercase tracking-[0.15em] font-black text-slate-500 mb-3">
                  Accesso rapido
                </p>

                <div className="space-y-1">

                  <Link
                    href="/rosa"
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-800 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-emerald-400" />

                      <span className="text-xs font-semibold text-slate-400 group-hover:text-white">
                        La mia squadra
                      </span>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400" />
                  </Link>

                  <Link
                    href="/obiettivi"
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-800 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <Target className="w-4 h-4 text-amber-400" />

                      <span className="text-xs font-semibold text-slate-400 group-hover:text-white">
                        I miei obiettivi
                      </span>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400" />
                  </Link>

                  <Link
                    href="/listone"
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-800 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <ClipboardList className="w-4 h-4 text-blue-400" />

                      <span className="text-xs font-semibold text-slate-400 group-hover:text-white">
                        Listone
                      </span>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400" />
                  </Link>

                </div>

              </section>

            </aside>

          </div>

        </div>

      </main>
    </div>
  )
}