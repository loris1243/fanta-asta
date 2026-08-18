'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Users,
  Play,
  Loader2,
  Shield,
  Clock,
  Sparkles,
  Trophy,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { supabase } from '../../../lib/supabaseClient'
import DashboardSidebar from '../../../components/DashboardSidebar'

interface LeagueTeam {
  id: string
  name: string
  logo_url: string | null
}

interface TeamData extends LeagueTeam {
  is_online: boolean
}

interface CurrentUser {
  id: string
  username: string
  role: string
  budget?: number
}

interface TransactionItem {
  player_name: string
  player_team: string
  player_role: string
  price: number
  team_name: string
  team_logo: string | null
}

export default function WaitingRoomPage() {
  const { id } = useParams()
  const router = useRouter()

  const auctionId = Array.isArray(id) ? id[0] : id

  const [teamsData, setTeamsData] = useState<TeamData[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [auctionStatus, setAuctionStatus] = useState('attesa')
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [remainingBudget, setRemainingBudget] = useState(500)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [transactions, setTransactions] = useState<TransactionItem[]>([])

  // Stati per filtri e paginazione (lista squadre - sala d'attesa)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Stati per filtri e paginazione (RISULTATI ASTA, solo a asta conclusa)
  const [resultsSearchQuery, setResultsSearchQuery] = useState('')
  const [resultsRoleFilter, setResultsRoleFilter] = useState<'all' | 'P' | 'D' | 'C' | 'A'>('all')
  const [resultsPage, setResultsPage] = useState(1)
  const resultsItemsPerPage = 10

  const currentTeamIdRef = useRef<string | null>(null)
  const participantsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const auctionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchTransactions = async (currentAuctionId: string) => {
    const { data: transData, error } = await supabase
      .from('auction_nominations')
      .select(`
        current_bid,
        players:player_id (
          name,
          team,
          role
        ),
        league_teams:highest_bidder_team_id (
          name,
          logo_url
        )
      `)
      .eq('auction_id', currentAuctionId)
      .eq('status', 'chiusa')

    if (error) {
      console.error('Errore recupero transazioni:', error.message)
      return
    }

    if (transData) {
      const formattedTransactions: TransactionItem[] = transData.map((item: any) => ({
        player_name: item.players?.name || 'Sconosciuto',
        player_team: item.players?.team || '-',
        player_role: item.players?.role || '-',
        price: item.current_bid,
        team_name: item.league_teams?.name || 'Svincolato',
        team_logo: item.league_teams?.logo_url || null,
      }))
      setTransactions(formattedTransactions)
    }
  }

  useEffect(() => {
    if (!auctionId) return

    let isMounted = true

    const fetchTeams = async () => {
      const { data: teams, error: teamsError } = await supabase
        .from('league_teams')
        .select('id, name, logo_url')
        .order('name', { ascending: true })

      if (teamsError) {
        console.error('Errore recupero squadre:', teamsError.message)
        return
      }

      const { data: participants, error: participantsError } = await supabase
        .from('auction_participants')
        .select('team_id, is_online')
        .eq('auction_id', auctionId)

      if (participantsError) {
        console.error('Errore recupero partecipanti:', participantsError.message)
        return
      }

      const updatedTeams: TeamData[] = (teams || []).map((team) => {
        const participant = participants?.find((item) => item.team_id === team.id)
        return {
          ...team,
          is_online: participant?.is_online === true,
        }
      })

      if (isMounted) {
        setTeamsData(updatedTeams)
      }
    }

    const init = async () => {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user

      if (!user) {
        router.push('/login')
        return
      }

      const { data: auctionData, error: auctionError } = await supabase
        .from('auctions')
        .select('status')
        .eq('id', auctionId)
        .maybeSingle()

      if (auctionError) {
        console.error('Errore recupero asta:', auctionError.message)
      }

      if (auctionData?.status) {
        setAuctionStatus(auctionData.status)

        if (auctionData.status === 'in_corso') {
          router.push(`/asta/${auctionId}/live`)
          return
        }

        if (auctionData.status === 'conclusa') {
          await fetchTransactions(auctionId)
        }
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, role, budget')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Errore recupero profilo:', profileError.message)
      }

      if (profile && isMounted) {
        setCurrentUser(profile)
        setIsAdmin(profile.role === 'admin')
      }

      const { data: teamData, error: teamError } = await supabase
        .from('league_teams')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (teamError) {
        console.error('Errore recupero squadra:', teamError.message)
      }

      if (teamData) {
        currentTeamIdRef.current = teamData.id

        const { data: settings } = await supabase
          .from('league_settings')
          .select('initial_budget')
          .maybeSingle()

        const initialBudget = settings?.initial_budget ?? profile?.budget ?? 500

        const { data: boughtPlayers } = await supabase
          .from('league_team_players')
          .select('price')
          .eq('team_id', teamData.id)

        const totalSpent = boughtPlayers?.reduce((acc, player) => acc + (player.price || 0), 0) ?? 0

        setRemainingBudget(Math.max(initialBudget - totalSpent, 0))

        const { error: upsertError } = await supabase
          .from('auction_participants')
          .upsert(
            {
              auction_id: auctionId,
              team_id: teamData.id,
              is_online: true,
            },
            {
              onConflict: 'auction_id,team_id',
            }
          )

        if (upsertError) {
          console.error('Errore registrazione partecipante:', upsertError.message)
        }
      }

      await fetchTeams()

      if (!isMounted) return

      setLoading(false)

      if (participantsChannelRef.current) {
        await supabase.removeChannel(participantsChannelRef.current)
        participantsChannelRef.current = null
      }

      participantsChannelRef.current = supabase
        .channel(`auction-participants-${auctionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'auction_participants',
            filter: `auction_id=eq.${auctionId}`,
          },
          () => {
            fetchTeams()
          }
        )
        .subscribe()

      if (auctionChannelRef.current) {
        await supabase.removeChannel(auctionChannelRef.current)
        auctionChannelRef.current = null
      }

      auctionChannelRef.current = supabase
        .channel(`auction-status-${auctionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'auctions',
            filter: `id=eq.${auctionId}`,
          },
          async (payload) => {
            const newStatus = payload.new.status
            setAuctionStatus(newStatus)

            if (newStatus === 'in_corso') {
              router.push(`/asta/${auctionId}/live`)
            } else if (newStatus === 'conclusa') {
              await fetchTransactions(auctionId)
            }
          }
        )
        .subscribe()
    }

    init()

    return () => {
      isMounted = false

      if (participantsChannelRef.current) {
        supabase.removeChannel(participantsChannelRef.current)
        participantsChannelRef.current = null
      }

      if (auctionChannelRef.current) {
        supabase.removeChannel(auctionChannelRef.current)
        auctionChannelRef.current = null
      }
    }
  }, [auctionId, router])

  const handleForceStart = async () => {
    if (!auctionId || starting) return

    setStarting(true)

    const { error } = await supabase
      .from('auctions')
      .update({
        status: 'in_corso',
      })
      .eq('id', auctionId)
      .neq('status', 'in_corso')

    if (error) {
      console.error("Errore durante l'avvio:", error.message)
      setStarting(false)
      return
    }

    setAuctionStatus('in_corso')
    router.push(`/asta/${auctionId}/live`)
  }

  const allTeamsOnline =
    teamsData.length > 0 && teamsData.every((team) => team.is_online)

  const onlineTeams = teamsData.filter((team) => team.is_online).length

  // Filtraggio delle squadre
  const filteredTeams = useMemo(() => {
    return teamsData.filter((team) => {
      const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'online' && team.is_online) ||
        (statusFilter === 'offline' && !team.is_online)
      return matchesSearch && matchesStatus
    })
  }, [teamsData, searchQuery, statusFilter])

  // Paginazione
  const totalPages = Math.ceil(filteredTeams.length / itemsPerPage) || 1
  const paginatedTeams = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredTeams.slice(start, start + itemsPerPage)
  }, [filteredTeams, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  // Filtraggio e paginazione dei risultati (solo asta conclusa)
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const query = resultsSearchQuery.toLowerCase()
      const matchesSearch =
        query === '' ||
        t.team_name.toLowerCase().includes(query) ||
        t.player_name.toLowerCase().includes(query)
      const matchesRole =
        resultsRoleFilter === 'all' || t.player_role === resultsRoleFilter
      return matchesSearch && matchesRole
    })
  }, [transactions, resultsSearchQuery, resultsRoleFilter])

  const resultsTotalPages =
    Math.ceil(filteredTransactions.length / resultsItemsPerPage) || 1

  const paginatedTransactions = useMemo(() => {
    const start = (resultsPage - 1) * resultsItemsPerPage
    return filteredTransactions.slice(start, start + resultsItemsPerPage)
  }, [filteredTransactions, resultsPage])

  useEffect(() => {
    setResultsPage(1)
  }, [resultsSearchQuery, resultsRoleFilter])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-indigo-500/20" />
          <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
            Preparazione sala d'asta...
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row selection:bg-indigo-500 selection:text-white">
      <DashboardSidebar
        user={{
          username: currentUser?.username || 'Utente',
          role: currentUser?.role || 'user',
        }}
        remainingBudget={remainingBudget}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {auctionStatus === 'conclusa' ? (
            /* RISULTATI ASTA */
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      Risultati Asta Conclusa
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Riepilogo finale dei calciatori acquistati dalle squadre
                    </p>
                  </div>
                </div>

                {/* Filtri e Ricerca (solo asta conclusa) */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cerca squadra o calciatore..."
                      value={resultsSearchQuery}
                      onChange={(e) => setResultsSearchQuery(e.target.value)}
                      className="h-9 pl-9 pr-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors w-44 sm:w-56"
                    />
                  </div>

                  <select
                    value={resultsRoleFilter}
                    onChange={(e) => setResultsRoleFilter(e.target.value as any)}
                    className="h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="all">Tutti i ruoli</option>
                    <option value="P">Portieri</option>
                    <option value="D">Difensori</option>
                    <option value="C">Centrocampisti</option>
                    <option value="A">Attaccanti</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-4 px-6">Squadra</th>
                      <th className="py-4 px-6">Fantallenatore / Club</th>
                      <th className="py-4 px-6">Calciatore</th>
                      <th className="py-4 px-6 text-right">Prezzo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {paginatedTransactions.length > 0 ? (
                      paginatedTransactions.map((t, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-800/40 transition-colors group"
                        >
                          <td className="py-4 px-6">
                            {t.team_logo ? (
                              <img
                                src={t.team_logo}
                                alt={t.team_name}
                                className="w-9 h-9 object-contain rounded-xl bg-slate-950 p-1 border border-slate-800 shadow-sm"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                                {t.team_name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6 font-semibold text-white">
                            {t.team_name}
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-bold text-white group-hover:text-indigo-300 transition-colors">
                              {t.player_name}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-md text-[10px] font-bold text-indigo-400">
                                {t.player_role}
                              </span>
                              <span className="text-xs text-slate-400">
                                {t.player_team}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right font-black text-emerald-400">
                            {t.price} <span className="text-xs font-semibold text-slate-400">FM</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-12 text-center text-slate-500 font-medium"
                        >
                          {transactions.length === 0
                            ? 'Nessuna transazione registrata per questa asta.'
                            : 'Nessun risultato per i filtri selezionati.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* CONTROLLI PAGINAZIONE RISULTATI */}
              {resultsTotalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-800/80 flex items-center justify-between bg-slate-950/40">
                  <span className="text-xs text-slate-400">
                    Pagina <strong className="text-white">{resultsPage}</strong> di <strong className="text-white">{resultsTotalPages}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setResultsPage((prev) => Math.max(prev - 1, 1))}
                      disabled={resultsPage === 1}
                      className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultsPage((prev) => Math.min(prev + 1, resultsTotalPages))}
                      disabled={resultsPage === resultsTotalPages}
                      className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* VISTA SALA D'ATTESA */
            <>
              {/* HEADER */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-lg shadow-indigo-500/10">
                      <Clock className="w-7 h-7 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                          Live Lobby
                        </span>
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                        Sala d'Attesa Asta
                      </h1>
                      <p className="text-sm text-slate-400 mt-1">
                        {allTeamsOnline
                          ? 'Tutti i partecipanti sono pronti e connessi.'
                          : 'In attesa che tutti i partecipanti entrino nella stanza...'}
                      </p>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-950/60 border border-slate-800 shadow-inner self-start sm:self-auto">
                    <span
                      className={`w-3 h-3 rounded-full animate-ping ${
                        onlineTeams > 0 ? 'bg-emerald-500' : 'bg-slate-500'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-300">
                      <strong className="text-white">{onlineTeams}</strong> / {teamsData.length} squadre online
                    </span>
                  </div>
                </div>
              </div>

              {/* TEAMS LIST WITH SEARCH & FILTERS */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-wider">
                      Squadre Partecipanti
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Stato della connessione in tempo reale dei partecipanti
                    </p>
                  </div>
                  
                  {/* Filtri e Ricerca */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cerca squadra..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 pl-9 pr-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors w-40 sm:w-48"
                      />
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="all">Tutti ({teamsData.length})</option>
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                    </select>
                  </div>
                </div>

                {paginatedTeams.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 mx-auto mb-4 flex items-center justify-center shadow-inner">
                      <Users className="w-6 h-6 text-slate-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-300">
                      Nessun partecipante trovato
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Nessuna squadra corrisponde ai filtri di ricerca selezionati.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/60">
                    {paginatedTeams.map((team) => (
                      <div
                        key={team.id}
                        className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {team.logo_url ? (
                            <img
                              src={team.logo_url}
                              alt={team.name}
                              className="w-11 h-11 object-contain rounded-2xl bg-slate-950 p-1.5 border border-slate-800 shadow-sm shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-sm">
                              <Shield className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-white truncate">
                              {team.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  team.is_online ? 'bg-emerald-500' : 'bg-slate-500'
                                }`}
                              />
                              <p
                                className={`text-[11px] font-bold uppercase tracking-wider ${
                                  team.is_online ? 'text-emerald-400' : 'text-slate-500'
                                }`}
                              >
                                {team.is_online ? 'Online' : 'Offline'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            team.is_online
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {team.is_online ? 'Connesso' : 'In attesa'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* CONTROLLI PAGINAZIONE */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-slate-800/80 flex items-center justify-between bg-slate-950/40">
                    <span className="text-xs text-slate-400">
                      Pagina <strong className="text-white">{currentPage}</strong> di <strong className="text-white">{totalPages}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ADMIN ACTION PANEL */}
              {isAdmin && auctionStatus !== 'in_corso' && (
                <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                        Pannello Amministratore
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white mt-1">
                      Controllo Apertura Asta
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {allTeamsOnline
                        ? 'Tutti i partecipanti sono presenti. Puoi avviare ufficialmente l\'asta.'
                        : 'Alcuni partecipanti non sono ancora online, ma puoi forzare l\'avvio se necessario.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleForceStart}
                    disabled={starting}
                    className="inline-flex items-center justify-center gap-2.5 h-12 px-7 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-black uppercase tracking-wider shadow-xl shadow-indigo-600/25 transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {starting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Avvio in corso...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>{allTeamsOnline ? 'Avvia Asta Live' : 'Forza Avvio Asta'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* STATUS BANNER WHEN LIVE */}
              {auctionStatus === 'in_corso' && (
                <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-4 backdrop-blur-xl">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Play className="w-5 h-5 text-emerald-400 fill-current" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-emerald-300 uppercase tracking-widest">
                      Asta in Corso
                    </h4>
                    <p className="text-xs text-emerald-400/80 mt-0.5">
                      Reindirizzamento automatico alla schermata live in corso...
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}