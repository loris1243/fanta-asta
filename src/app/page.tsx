'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getCurrentUser, logout } from '../app/actions/auth'
import { createAuction } from '../app/actions/auctions'
import { supabase } from '../lib/supabaseClient'
import {
  LogOut, Shield, History, Wallet, ArrowUpRight,
  LayoutDashboard, Target, ClipboardList,
  Inbox, Users, Settings, ScrollText, Building2, Plus, Trash2
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
        <div className={`w-2.5 h-2.5 rounded-full ${
          isInCorso 
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
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
          isInCorso 
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

  useEffect(() => {
    async function loadData() {
      const u = await getCurrentUser()
      setUser(u)

      let currentTeamId = null
      let initialBudget = u?.budget ?? 500

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
            .from('rosters')
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

      try {
        const { data: settings } = await supabase
          .from('league_settings')
          .select('league_name')
          .maybeSingle()

        if (settings?.league_name) {
          setLeagueName(settings.league_name)
        }
      } catch (err) {
        console.error("Errore caricamento impostazioni:", err)
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
      <aside className={`bg-slate-800/80 border-r border-slate-700 transition-all duration-300 flex flex-col justify-between shadow-xl ${
        isSidebarOpen ? 'w-full md:w-64' : 'w-full md:w-20'
      }`}>
        <div className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center shadow-md text-sm">
                ⚽
              </div>
              {isSidebarOpen && (
                <div>
                  <h1 className="font-extrabold text-base tracking-tight text-white leading-tight">FantAsta</h1>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aste Live</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition text-xs"
            >
              {isSidebarOpen ? '◀' : '▶'}
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 mb-6 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center justify-center font-bold text-xs shrink-0">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{formatUsername(user.username)}</p>
                <p className="text-xs text-emerald-400 font-extrabold">{remainingBudget} FM</p>
              </div>
            )}
          </div>

          <nav className="space-y-1.5">
            <Link
              href="/"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 shadow-md shadow-blue-600/20 transition"
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span className="truncate">Dashboard</span>}
            </Link>

            <Link
              href="/rosa"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              <Shield className="w-4 h-4 shrink-0 text-emerald-400" />
              {isSidebarOpen && <span className="truncate">La Mia Squadra</span>}
            </Link>

            <Link
              href="/obiettivi"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              <Target className="w-4 h-4 shrink-0 text-amber-400" />
              {isSidebarOpen && <span className="truncate">I Miei Obiettivi</span>}
            </Link>

            <Link
              href="/listone"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              <ClipboardList className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span className="truncate">Listone</span>}
            </Link>

            {user.role === 'admin' && (
              <div className="pt-4 mt-4 border-t border-slate-700">
                {isSidebarOpen && (
                  <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Pannello Admin
                  </span>
                )}
                <Link
                  href="/admin/import-listone"
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition mb-1.5"
                >
                  <Inbox className="w-4 h-4 shrink-0" />
                  {isSidebarOpen && <span className="truncate">Importa Listone</span>}
                </Link>
                <Link
                  href="/admin/users"
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition mb-1.5"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  {isSidebarOpen && <span className="truncate">Gestione Partecipanti</span>}
                </Link>

                <Link
                  href="/admin/settings"
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition mb-1.5"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  {isSidebarOpen && <span className="truncate">Configurazione Lega</span>}
                </Link>

                {isSidebarOpen && (
                  <span className="px-2 pt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Anagrafiche
                  </span>
                )}
                <Link
                  href="/admin/anagrafiche/serie-a"
                  className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition mb-1"
                >
                  <ScrollText className="w-4 h-4 shrink-0" />
                  {isSidebarOpen && <span className="truncate">Squadre Serie A</span>}
                </Link>
                <Link
                  href="/admin/anagrafiche/squadre_lega"
                  className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  {isSidebarOpen && <span className="truncate">Squadre Lega</span>}
                </Link>
              </div>
            )}
          </nav>
        </div>

        <div className="p-4 md:p-5 border-t border-slate-700 space-y-2">
          <button
            onClick={handleLogout}
            type="button"
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:text-white hover:bg-red-600/20 transition cursor-pointer"
          >
            <LogOut className="w-5 h-5 shrink-0 text-red-400" />
            {isSidebarOpen && <span>Esci</span>}
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
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${
                user.role === 'admin'
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
                      className={`border rounded-xl px-4 py-3 flex items-center justify-between text-xs sm:text-sm transition-all hover:border-blue-500 hover:bg-slate-800/50 cursor-pointer ${
                        isInCorso
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