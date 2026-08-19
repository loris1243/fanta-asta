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
                ? 'bg-accent'
                : isNuova
                ? 'bg-primary'
                : isTerminata
                ? 'bg-success' 
                :'bg-muted-2'
            }`}
          />

          {isInCorso && (
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-accent animate-ping opacity-60" />
          )}
        </div>

        <div className="min-w-0">
          <p className="font-bold text-white uppercase tracking-wide truncate">
            Asta #{item.id.slice(0, 6)}
          </p>

          <p className="text-[10px] text-muted-2 truncate">
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
              ? 'bg-accent/10 text-accent border-accent/20'
              : isNuova
              ? 'bg-primary/10 text-primary-hover border-primary/20'              
              : isTerminata
              ? 'bg-success/10 text-success border-success/20'
              : 'bg-surface-elevated text-muted border-border'
          }`}
        >
          {isInCorso ? 'In corso' : isNuova ? 'Nuova' : isTerminata?'Conclusa' : item.status}
        </span>

        {user.role === 'admin' && !isTerminata && (
          <button
            onClick={(e) => handleDeleteAuction(item.id, e)}
            type="button"
            className="p-2 rounded-lg text-muted-2 hover:text-danger hover:bg-danger/10 transition cursor-pointer"
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />

          <p className="text-xs text-muted-2 font-bold tracking-widest uppercase">
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
          MAIN CONTENT
      ====================================================== */}

      <main className="flex-1 min-w-0 overflow-y-auto">

        <div className="max-w-[1500px] mx-auto p-5 sm:p-6 lg:p-8 xl:p-10">

          {/* ==================================================
              TOP BAR
          ================================================== */}

          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">
                Dashboard
              </p>

              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Panoramica
              </h2>
            </div>

            <div className="flex items-center gap-2">

              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border">
                <Trophy className="w-4 h-4 text-accent" />

                <span className="text-xs font-bold text-muted">
                  {leagueName}
                </span>
              </div>

              <div className="px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
                <span className="text-xs font-bold text-primary-hover">
                  {season}
                </span>
              </div>

            </div>
          </header>

          {/* ==================================================
              TEAM HERO
          ================================================== */}

          <section className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-xl mb-6">

            <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-info/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative p-6 sm:p-8 lg:p-10">

              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">

                <div className="flex items-center gap-5 sm:gap-6 min-w-0">

                  {team.logo_url ? (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-background/80 border border-border-strong flex items-center justify-center p-2 shrink-0 shadow-lg">
                      <img
                        src={team.logo_url}
                        alt="Logo Squadra"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-lg">
                      <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
                    </div>
                  )}

                  <div className="min-w-0">

                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-primary mb-2">
                      La tua squadra
                    </p>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white uppercase break-words">
                      {team.name}
                    </h1>

                    <Link
                      href="/rosa"
                      className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-muted hover:text-foreground transition"
                    >
                      Gestisci la rosa
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>

                  </div>
                </div>

                <div className="shrink-0 lg:min-w-[230px]">

                  <div className="rounded-2xl bg-background/70 border border-border p-5">

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-2">
                        Budget disponibile
                      </span>

                      <Wallet className="w-4 h-4 text-success" />
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-success">
                        {remainingBudget}
                      </span>

                      <span className="text-xs font-bold text-muted-2">
                        FM
                      </span>
                    </div>

                    <div className="mt-3 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full bg-success transition-all"
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
                      <span className="text-[10px] text-muted-2">
                        Disponibile
                      </span>

                      <span className="text-[10px] font-bold text-muted-2">
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

            <section className="rounded-3xl border border-border bg-surface shadow-xl overflow-hidden">

              <div className="p-5 sm:p-6 border-b border-border">

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                  <div className="flex items-center gap-3">

                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <History className="w-5 h-5 text-primary" />
                    </div>

                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">
                        Aste recenti
                      </h3>

                      <p className="text-[11px] text-muted-2 mt-0.5">
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
                          bg-primary
                          hover:bg-primary-hover
                          text-white
                          text-xs font-bold
                          rounded-xl
                          transition-all
                          shadow-md shadow-primary/20
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
                        bg-surface-elevated
                        hover:bg-surface-hover
                        text-xs font-bold
                        text-muted
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
                                ? 'bg-accent/5 border-accent/20 hover:border-accent/40'
                                : isNuova
                                ? 'bg-primary/5 border-primary/20 hover:border-primary/40'
                                : 'bg-background/50 border-border hover:border-border-strong'
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
                  <div className="py-14 text-center rounded-2xl border border-dashed border-border bg-background/30">

                    <div className="w-12 h-12 mx-auto rounded-2xl bg-surface border border-border flex items-center justify-center mb-3">
                      <Gavel className="w-5 h-5 text-muted-2" />
                    </div>

                    <p className="text-sm font-semibold text-muted">
                      Nessuna asta recente
                    </p>

                    <p className="text-xs text-muted-2 mt-1">
                      Le nuove aste compariranno qui.
                    </p>

                  </div>
                )}

              </div>
            </section>

            <aside className="space-y-6">

              <section className="rounded-3xl border border-border bg-surface shadow-xl p-6">

                <div className="flex items-center justify-between mb-5">

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-2">
                      Situazione
                    </p>

                    <h3 className="text-sm font-black text-white mt-1">
                      Il tuo budget
                    </h3>
                  </div>

                  <div className="w-9 h-9 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-success" />
                  </div>

                </div>

                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-white">
                    {remainingBudget}
                  </span>

                  <span className="text-xs font-bold text-muted-2 mb-1">
                    FM
                  </span>
                </div>

                <div className="mt-4 space-y-2">

                  <div className="flex justify-between text-xs">
                    <span className="text-muted-2">
                      Budget iniziale
                    </span>

                    <span className="font-bold text-muted">
                      {initialBudget} FM
                    </span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-muted-2">
                      Speso
                    </span>

                    <span className="font-bold text-muted">
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
                  className="mt-5 flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-xs font-bold text-muted hover:text-foreground transition"
                >
                  <span>Vai alla rosa</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>

              </section>

              <section className="rounded-3xl border border-border bg-surface shadow-xl p-6">

                <div className="flex items-center gap-3 mb-5">

                  <div className="w-9 h-9 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-info" />
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-2">
                      Competizione
                    </p>

                    <h3 className="text-sm font-black text-white mt-1">
                      {leagueName}
                    </h3>
                  </div>

                </div>

                <div className="rounded-2xl bg-background/60 border border-border p-4">

                  <div className="flex items-center justify-between">

                    <div>
                      <p className="text-[10px] text-muted-2 uppercase font-black tracking-wider">
                        Stagione
                      </p>

                      <p className="text-sm font-bold text-muted mt-1">
                        {season}
                      </p>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-accent" />
                    </div>

                  </div>

                </div>

              </section>

              <section className="rounded-3xl border border-border bg-surface shadow-xl p-5">

                <p className="text-[10px] uppercase tracking-[0.15em] font-black text-muted-2 mb-3">
                  Accesso rapido
                </p>

                <div className="space-y-1">

                  <Link
                    href="/rosa"
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-surface-elevated transition group"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-role-d" />

                      <span className="text-xs font-semibold text-muted group-hover:text-foreground">
                        La mia squadra
                      </span>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-muted-2 group-hover:text-muted" />
                  </Link>

                  <Link
                    href="/obiettivi"
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-surface-elevated transition group"
                  >
                    <div className="flex items-center gap-3">
                      <Target className="w-4 h-4 text-accent" />

                      <span className="text-xs font-semibold text-muted group-hover:text-foreground">
                        I miei obiettivi
                      </span>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-muted-2 group-hover:text-muted" />
                  </Link>

                  <Link
                    href="/listone"
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-surface-elevated transition group"
                  >
                    <div className="flex items-center gap-3">
                      <ClipboardList className="w-4 h-4 text-primary" />

                      <span className="text-xs font-semibold text-muted group-hover:text-foreground">
                        Listone
                      </span>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-muted-2 group-hover:text-muted" />
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