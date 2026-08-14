'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getCurrentUser, logout } from '../app/actions/auth'
import { createAuction } from '../app/actions/auctions'
import { supabase } from '../lib/supabaseClient'
import {
  LogOut, Shield, History, Wallet, ArrowUpRight,
  LayoutDashboard, Target, ClipboardList,
  Inbox, Users, Settings, ScrollText, Building2, Plus, Trash2,
  Gavel, PanelLeftClose, PanelLeftOpen
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

// Sotto-componente per evitare duplicazioni nel rendering dell'asta
function AuctionContent({
  item,
  isInCorso,
  isNuova,
  user,
  handleDeleteAuction
}: {
  item: AuctionItem
  isInCorso: boolean
  isNuova: boolean
  user: UserProfile
  handleDeleteAuction: (auctionId: string, e: React.MouseEvent) => void
}) {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${isInCorso
            ? 'bg-amber-400 animate-ping'
            : isNuova
              ? 'bg-blue-400'
              : 'bg-slate-500'
          }`} />
        <div>
          <p className="font-bold text-white uppercase tracking-wide">
            Asta #{item.id.slice(0, 6)}
          </p>
          <p className="text-[10px] text-slate-400">
            Creata il: {new Date(item.created_at).toLocaleDateString('it-IT', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${isInCorso
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            : isNuova
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}>
          {isInCorso ? 'In Corso' : isNuova ? 'Nuova' : item.status}
        </span>

        {user.role === 'admin' && (
          <button
            onClick={(e) => handleDeleteAuction(item.id, e)}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
            title="Elimina asta"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [season, setSeason] = useState('Stagione in corso')
  const [user, setUser] = useState<UserProfile | null>(null)
  const [team, setTeam] = useState<TeamData>({ name: 'Nessuna squadra associata' })
  const [remainingBudget, setRemainingBudget] = useState<number>(500)
  const [auctions, setAuctions] = useState<AuctionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [leagueName, setLeagueName] = useState('La mia Lega')
  const [initialBudget, setInitialBudget] = useState<number>(500)

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
        console.error("Errore caricamento impostazioni:", err)
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
              logo_url: teamData.logo_url
            })
          }
        } catch (err) {
          console.error("Errore caricamento squadra:", err)
        }
      }

      if (currentTeamId) {
        try {
          const { data: boughtPlayers } = await supabase
            .from('league_team_players')
            .select('price')
            .eq('team_id', currentTeamId)

          if (boughtPlayers && boughtPlayers.length > 0) {
            const totalSpent = boughtPlayers.reduce((acc, curr) => acc + (curr.price || 0), 0)
            setRemainingBudget(initialBudget - totalSpent)
          } else {
            setRemainingBudget(initialBudget)
          }
        } catch (err) {
          console.error("Errore calcolo budget:", err)
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
        console.error("Errore caricamento aste:", err)
      }

      const currentYear = new Date().getFullYear()
      setSeason(`${currentYear}/${currentYear + 1}`)

      setLoading(false)
    }

    loadData()

    const channel = supabase
      .channel('realtime-auctions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auctions' },
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

  const handleDeleteAuction = async (auctionId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!window.confirm("Sei sicuro di voler eliminare questa asta?")) return

    try {
      const { error } = await supabase
        .from('auctions')
        .delete()
        .eq('id', auctionId)

      if (error) {
        alert("Errore durante l'eliminazione dell'asta: " + error.message)
      } else {
        setAuctions(prev => prev.filter(item => item.id !== auctionId))
      }
    } catch (err) {
      console.error("Errore imprevisto:", err)
      alert("Errore imprevisto durante l'eliminazione.")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Caricamento FantAsta...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row transition-colors duration-300">

      {/* 🔴 SIDEBAR NAVIGATION */}
{/* ============================================================
    SIDEBAR
============================================================ */}

<aside
  className={`
    relative shrink-0
    bg-slate-900/95
    border-r border-slate-800
    shadow-xl
    transition-[width] duration-300 ease-in-out
    flex flex-col
    ${isSidebarOpen ? 'w-full md:w-64' : 'w-full md:w-[76px]'}
  `}
>
  {/* ==========================================================
      HEADER SIDEBAR
  ========================================================== */}

  <div className="relative p-3 md:p-4">
    <div
      className={`
        relative flex items-center
        ${isSidebarOpen ? 'justify-between' : 'justify-center'}
        min-h-10
      `}
    >
      {/* LOGO */}

      <div
        className={`
          flex items-center
          ${isSidebarOpen ? 'gap-3' : 'justify-center'}
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

      {/* TOGGLE */}

      <button
        type="button"
        onClick={() => setIsSidebarOpen((prev) => !prev)}
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
          ${!isSidebarOpen ? 'absolute -right-2 top-1/2 -translate-y-1/2 z-20 bg-slate-900 border border-slate-700 shadow-lg' : ''}
        `}
      >
        <span className="text-[10px] font-black">
          {isSidebarOpen ? '◀' : '▶'}
        </span>
      </button>
    </div>
  </div>

  {/* ==========================================================
      USER CARD
  ========================================================== */}

  <div
    className={`
      mx-3 md:mx-4
      mb-5
      bg-slate-950/70
      border border-slate-800
      rounded-xl
      transition-all duration-300
      ${isSidebarOpen ? 'p-3' : 'p-2'}
    `}
  >
    <div
      className={`
        flex items-center
        ${isSidebarOpen ? 'gap-3' : 'justify-center'}
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
        {user.username.slice(0, 2).toUpperCase()}
      </div>

      {isSidebarOpen && (
        <div className="min-w-0 overflow-hidden">
          <p className="text-sm font-bold text-white truncate">
            {formatUsername(user.username)}
          </p>

          <p className="text-xs text-emerald-400 font-extrabold mt-0.5">
            {remainingBudget} FM
          </p>
        </div>
      )}
    </div>
  </div>

  {/* ==========================================================
      NAVIGAZIONE
  ========================================================== */}

  <nav className="flex-1 px-3 md:px-4 overflow-y-auto">
    <div className="space-y-1.5">

      {/* DASHBOARD */}

      <Link
        href="/"
        title={!isSidebarOpen ? 'Dashboard' : undefined}
        className={`
          flex items-center
          ${isSidebarOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
          h-11
          rounded-xl
          text-sm font-semibold
          text-white
          bg-blue-600
          shadow-md shadow-blue-600/20
          transition-all
        `}
      >
        <LayoutDashboard className="w-4 h-4 shrink-0" />

        {isSidebarOpen && (
          <span className="truncate">
            Dashboard
          </span>
        )}
      </Link>

      {/* LA MIA SQUADRA */}

      <Link
        href="/rosa"
        title={!isSidebarOpen ? 'La Mia Squadra' : undefined}
        className={`
          flex items-center
          ${isSidebarOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
          h-11
          rounded-xl
          text-sm font-semibold
          text-slate-300
          hover:text-white
          hover:bg-slate-800
          transition-all
        `}
      >
        <Shield className="w-4 h-4 shrink-0 text-emerald-400" />

        {isSidebarOpen && (
          <span className="truncate">
            La Mia Squadra
          </span>
        )}
      </Link>

      {/* OBIETTIVI */}

      <Link
        href="/obiettivi"
        title={!isSidebarOpen ? 'I Miei Obiettivi' : undefined}
        className={`
          flex items-center
          ${isSidebarOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
          h-11
          rounded-xl
          text-sm font-semibold
          text-slate-300
          hover:text-white
          hover:bg-slate-800
          transition-all
        `}
      >
        <Target className="w-4 h-4 shrink-0 text-amber-400" />

        {isSidebarOpen && (
          <span className="truncate">
            I Miei Obiettivi
          </span>
        )}
      </Link>

      {/* LISTONE */}

      <Link
        href="/listone"
        title={!isSidebarOpen ? 'Listone' : undefined}
        className={`
          flex items-center
          ${isSidebarOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
          h-11
          rounded-xl
          text-sm font-semibold
          text-slate-300
          hover:text-white
          hover:bg-slate-800
          transition-all
        `}
      >
        <ClipboardList className="w-4 h-4 shrink-0" />

        {isSidebarOpen && (
          <span className="truncate">
            Listone
          </span>
        )}
      </Link>

      {/* ======================================================
          ADMIN
      ====================================================== */}

      {user.role === 'admin' && (
        <div className="pt-4 mt-4 border-t border-slate-800">

          {isSidebarOpen && (
            <span className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Pannello Admin
            </span>
          )}

          {/* IMPORTA LISTONE */}

          <Link
            href="/admin/import-listone"
            title={!isSidebarOpen ? 'Importa Listone' : undefined}
            className={`
              flex items-center
              ${isSidebarOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
              h-10
              rounded-xl
              text-sm font-semibold
              text-slate-300
              hover:text-white
              hover:bg-slate-800
              transition-all
            `}
          >
            <Inbox className="w-4 h-4 shrink-0" />

            {isSidebarOpen && (
              <span className="truncate">
                Importa Listone
              </span>
            )}
          </Link>

          {/* PARTECIPANTI */}

          <Link
            href="/admin/users"
            title={!isSidebarOpen ? 'Gestione Partecipanti' : undefined}
            className={`
              flex items-center
              ${isSidebarOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
              h-10
              rounded-xl
              text-sm font-semibold
              text-slate-300
              hover:text-white
              hover:bg-slate-800
              transition-all
            `}
          >
            <Users className="w-4 h-4 shrink-0" />

            {isSidebarOpen && (
              <span className="truncate">
                Gestione Partecipanti
              </span>
            )}
          </Link>

          {/* CONFIGURAZIONE */}

          <Link
            href="/admin/settings"
            title={!isSidebarOpen ? 'Configurazione Lega' : undefined}
            className={`
              flex items-center
              ${isSidebarOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
              h-10
              rounded-xl
              text-sm font-semibold
              text-slate-300
              hover:text-white
              hover:bg-slate-800
              transition-all
            `}
          >
            <Settings className="w-4 h-4 shrink-0" />

            {isSidebarOpen && (
              <span className="truncate">
                Configurazione Lega
              </span>
            )}
          </Link>

          {/* ANAGRAFICHE */}

          {isSidebarOpen && (
            <span className="px-2 pt-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Anagrafiche
            </span>
          )}

          <Link
            href="/admin/anagrafiche/serie-a"
            title={!isSidebarOpen ? 'Squadre Serie A' : undefined}
            className={`
              flex items-center
              ${isSidebarOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
              h-9
              rounded-xl
              text-xs font-semibold
              text-slate-400
              hover:text-white
              hover:bg-slate-800
              transition-all
            `}
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
            title={!isSidebarOpen ? 'Squadre Lega' : undefined}
            className={`
              flex items-center
              ${isSidebarOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
              h-9
              rounded-xl
              text-xs font-semibold
              text-slate-400
              hover:text-white
              hover:bg-slate-800
              transition-all
            `}
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

  {/* ==========================================================
      FOOTER
  ========================================================== */}

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
      title={!isSidebarOpen ? 'Esci' : undefined}
      className={`
        w-full
        flex items-center
        ${isSidebarOpen ? 'gap-3 px-3.5' : 'justify-center px-0'}
        h-11
        rounded-xl
        text-sm font-semibold
        text-red-400
        hover:text-red-300
        hover:bg-red-500/10
        transition-all
        cursor-pointer
      `}
    >
      <LogOut className="w-4 h-4 shrink-0" />

      {isSidebarOpen && (
        <span>
          Esci
        </span>
      )}
    </button>
  </div>
</aside>

      {/* 🔵 MAIN CONTENT AREA */}
      <main className="flex-1 p-6 md:p-12 space-y-6 overflow-y-auto">

        {/* Banner Benvenuto */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md">
                Stagione {season}
              </span>
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${user.role === 'admin'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                Ruolo: {user.role}
              </span>
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md">
                🏆 Lega: {leagueName}
              </span>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400 block mb-1">
                🛡️ La mia Squadra
              </span>

              <div className="flex items-center gap-4 flex-wrap">
                {team.logo_url ? (
                  <img
                    src={team.logo_url}
                    alt="Logo Squadra"
                    className="w-16 h-16 object-contain rounded-xl bg-slate-900/60 p-1.5 border border-slate-700 shrink-0 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400 shadow-md">
                    <Shield className="w-8 h-8" />
                  </div>
                )}

                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight uppercase break-words">
                  {team.name}
                </h2>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700/60 pt-4 text-xs sm:text-sm text-slate-300 space-y-1">
            <p className="font-medium text-white">
              Benvenuto, {formatUsername(user.username)}.
            </p>
            <p>
              Monitora i tuoi crediti residui, gestisci la tua rosa e consulta il listone della tua lega.
            </p>
          </div>
        </div>

        {/* 💳 Budget Residuo Card & 📜 Stato Aste */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Card Budget Residuo */}
          <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-slate-300 font-bold">
                  Budget Residuo
                </span>
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-1 mt-3">
                <span className="text-4xl font-black text-emerald-400">{remainingBudget}</span>
                <span className="text-sm font-bold text-slate-400">FM</span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-700/60 text-xs text-slate-400 flex justify-between">
              <span>Budget Iniziale:</span>
              <span className="font-bold text-white">{user.budget ?? 500} FM</span>
            </div>
          </div>

          {/* Stato Aste Live */}
          <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm uppercase tracking-wider text-slate-200 font-bold">
                  Stato Aste Live
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {user.role === 'admin' && (
                  <button
                    onClick={handleNewAuctionClick}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-[0.98] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Nuova Asta
                  </button>
                )}

                <Link
                  href="/rosa"
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition"
                >
                  Vedi tutti <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {auctions.length > 0 ? (
              <div className="space-y-2.5">
                {auctions.map((item) => {
                  const isInCorso = item.status === 'in_corso' || item.status === 'active'
                  const isNuova = item.status === 'pending' || item.status === 'nuova' || item.status === 'da_iniziare'

                  const handleAuctionClick = (e: React.MouseEvent) => {
                    if (isInCorso) {
                      e.preventDefault()
                      alert("Non puoi unirti ad un'asta in corso")
                    }
                  }

                  return (
                    <div
                      key={item.id}
                      onClick={handleAuctionClick}
                      className={`border rounded-xl px-4 py-3 flex items-center justify-between text-xs sm:text-sm transition-all hover:border-blue-500 hover:bg-slate-800/50 cursor-pointer ${isInCorso
                          ? 'bg-amber-500/10 border-amber-500/40 animate-pulse'
                          : isNuova
                            ? 'bg-blue-500/10 border-blue-500/40'
                            : 'bg-slate-900/60 border-slate-700/60'
                        }`}
                    >
                      {isInCorso ? (
                        <AuctionContent
                          item={item}
                          isInCorso={isInCorso}
                          isNuova={isNuova}
                          user={user}
                          handleDeleteAuction={handleDeleteAuction}
                        />
                      ) : (
                        <Link href={`/asta/${item.id}`} className="contents">
                          <AuctionContent
                            item={item}
                            isInCorso={isInCorso}
                            isNuova={isNuova}
                            user={user}
                            handleDeleteAuction={handleDeleteAuction}
                          />
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs italic bg-slate-900/40 rounded-xl border border-slate-800">
                Nessuna asta attiva o recente.
              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  )
}