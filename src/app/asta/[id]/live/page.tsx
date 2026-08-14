'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import { Gavel, Users, Shield, ArrowLeft, Timer, Search, Plus, Sparkles, X, Loader2, DollarSign } from 'lucide-react'

const ROLE_NAMES: Record<string, string> = {
  'P': 'Portiere',
  'D': 'Difensore',
  'C': 'Centrocampista',
  'A': 'Attaccante'
}

export default function LiveAuctionPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  
  const [auction, setAuction] = useState<any>(null)
  const [currentNomination, setCurrentNomination] = useState<any>(null)
  const [teamsData, setTeamsData] = useState<any[]>([])
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [myBudget, setMyBudget] = useState<number>(0)
  const [currentBid, setCurrentBid] = useState<number>(0)
  const [highestTeamId, setHighestTeamId] = useState<string | null>(null)

  const [currentTurnTeamId, setCurrentTurnTeamId] = useState<string | null>(null)
  const [requiredRole, setRequiredRole] = useState<string>('P')

  const [isNominateModalOpen, setIsNominateModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('')
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([])
  const [availableTeamsList, setAvailableTeamsList] = useState<string[]>([])
  const [customBidValue, setCustomBidValue] = useState<string>('')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(15) // Timer di default per l'asta
  
  const auctionChannelRef = useRef<any>(null)

  useEffect(() => {
    let isMounted = true

    async function initAuctionRoom() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      if (profile?.role === 'admin') setIsAdmin(true)

      const { data: auctionData } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (!auctionData) {
        router.push('/')
        return
      }

      setAuction(auctionData)
      setCurrentTurnTeamId(auctionData.current_turn_team_id || null)
      setRequiredRole(auctionData.required_role || 'P')

      const { data: teamData } = await supabase
        .from('league_teams')
        .select('id, budget')
        .eq('user_id', session.user.id)
        .maybeSingle()
        
      if (teamData) {
        setMyTeamId(teamData.id)
        setMyBudget(teamData.budget || 0)
      }

      await fetchParticipantsAndTeams()
      await fetchCurrentNomination()

      if (isMounted) setLoading(false)

      // Listener Realtime corretto su eventi inserimento, aggiornamento ed eliminazione
      auctionChannelRef.current = supabase.channel(`auction-room-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions', filter: `id=eq.${id}` }, (payload: any) => {
          if (payload.new) {
            setAuction(payload.new)
            setCurrentTurnTeamId(payload.new.current_turn_team_id || null)
            setRequiredRole(payload.new.required_role || 'P')
            if (payload.new.status && payload.new.status !== 'in_corso') router.push(`/asta/${id}`)
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_nominations', filter: `auction_id=eq.${id}` }, () => {
          fetchCurrentNomination()
        })
        .subscribe()
    }

    initAuctionRoom()

    return () => {
      isMounted = false
      if (auctionChannelRef.current) supabase.removeChannel(auctionChannelRef.current)
    }
  }, [id, router])

  // Gestione del Timer reattivo quando c'è una nomina attiva
  useEffect(() => {
    if (!currentNomination) return
    setTimeLeft(15) // Reset timer a ogni nuova offerta o nomina

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // Qui in futuro gestiremo la chiusura automatica dell'asta
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [currentNomination?.id, currentBid])

  const fetchParticipantsAndTeams = async () => {
    const { data: participants } = await supabase
      .from('auction_participants')
      .select('league_teams(id, name, budget)')
      .eq('auction_id', id)

    if (participants) {
      const teams = participants.map((p: any) => p.league_teams).filter(Boolean)
      setTeamsData(teams)
      const currentTeam = teams.find((t: any) => t.id === myTeamId)
      if (currentTeam) setMyBudget(currentTeam.budget)
    }
  }

  const fetchCurrentNomination = async () => {
    const { data: nomination } = await supabase
      .from('auction_nominations')
      .select('*, players(*)')
      .eq('auction_id', id)
      .eq('status', 'in_corso')
      .maybeSingle()

    setCurrentNomination(nomination)
    setCurrentBid(nomination?.current_bid || nomination?.base_price || 1)
    setHighestTeamId(nomination?.highest_bidder_team_id || null)
    await fetchParticipantsAndTeams()
  }

  const fetchAvailablePlayers = async () => {
    let baseQuery = supabase.from('players').select('*').eq('role', requiredRole).order('name', { ascending: true })
    const { data } = await baseQuery

    if (data) {
      const uniqueTeams = Array.from(new Set(data.map((p: any) => p.team).filter(Boolean))) as string[]
      setAvailableTeamsList(uniqueTeams.sort())

      let filtered = data
      if (searchQuery.trim()) {
        filtered = filtered.filter((p: any) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      }
      if (selectedTeamFilter) {
        filtered = filtered.filter((p: any) => p.team === selectedTeamFilter)
      }

      setAvailablePlayers(filtered)
    }
  }

  useEffect(() => {
    if (isNominateModalOpen) {
      setSelectedTeamFilter('')
      setSearchQuery('')
      fetchAvailablePlayers()
    }
  }, [isNominateModalOpen, requiredRole])

  useEffect(() => {
    if (isNominateModalOpen) {
      fetchAvailablePlayers()
    }
  }, [searchQuery, selectedTeamFilter])

  const handleNominatePlayer = async (playerId: number) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    
    const { error } = await supabase
      .from('auction_nominations')
      .insert({ 
        auction_id: id, 
        player_id: playerId, 
        base_price: 1, 
        current_bid: 1, 
        highest_bidder_team_id: myTeamId, 
        status: 'in_corso' 
      })

    if (error) {
      console.error("Errore durante la chiamata:", error)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    setIsNominateModalOpen(false)
  }

  const handlePlaceBid = async (newAmount: number) => {
    if (!currentNomination || !myTeamId) return
    if (newAmount <= currentBid) {
      alert("L'offerta deve essere superiore a quella attuale!")
      return
    }
    if (newAmount > myBudget) {
      alert("Non hai abbastanza budget per questa offerta!")
      return
    }

    await supabase
      .from('auction_nominations')
      .update({ current_bid: newAmount, highest_bidder_team_id: myTeamId })
      .eq('id', currentNomination.id)
      
    setCustomBidValue('')
  }

  const currentTurnTeamName = teamsData.find(t => t.id === currentTurnTeamId)?.name || 'Nessuna squadra'
  const highestBidderName = teamsData.find(t => t.id === highestTeamId)?.name || 'Nessuna'
  const roleDisplay = ROLE_NAMES[requiredRole] || requiredRole || 'Giocatore'
  const canNominate = isAdmin || (currentTurnTeamId === myTeamId)

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8 flex flex-col">
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-800">
        <h1 className="text-lg font-black uppercase text-white flex items-center gap-2"><Gavel className="w-5 h-5 text-blue-500" /> Asta Live</h1>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs font-black uppercase">
            Il tuo Budget: {myBudget} CR
          </div>
          <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-black uppercase animate-pulse">Live Attivo</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 py-6 flex-1">
        <div className="lg:col-span-2 space-y-6">
          {currentNomination ? (
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden">
              
              {/* Barra Timer Superiore */}
              <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase">
                  <Timer className="w-4 h-4 text-amber-400 animate-spin" /> Chiusura tra: <span className="text-amber-400 font-black text-sm">{timeLeft}s</span>
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase">
                  In vantaggio: <span className="text-white font-black">{highestBidderName}</span>
                </div>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg">{ROLE_NAMES[currentNomination.players?.role] || currentNomination.players?.role}</span>
                  <h2 className="text-3xl font-black uppercase text-white mt-3">{currentNomination.players?.name}</h2>
                  <p className="text-sm text-slate-400 mt-1">{currentNomination.players?.team}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Offerta Attuale</span>
                  <span className="text-5xl font-black text-amber-400 block">{currentBid} CR</span>
                </div>
              </div>

              {/* Pulsanti Rilancio Rapido */}
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => handlePlaceBid(currentBid + 1)} className="py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold uppercase text-sm transition">+1 ({currentBid + 1})</button>
                <button onClick={() => handlePlaceBid(currentBid + 5)} className="py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold uppercase text-sm transition">+5 ({currentBid + 5})</button>
                <button onClick={() => handlePlaceBid(currentBid + 10)} className="py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold uppercase text-sm transition">+10 ({currentBid + 10})</button>
              </div>

              {/* Input Offerta Manuale Personalizzata */}
              <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                <input 
                  type="number" 
                  placeholder="Inserisci offerta personalizzata..." 
                  value={customBidValue}
                  onChange={(e) => setCustomBidValue(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button 
                  onClick={() => {
                    const val = parseInt(customBidValue)
                    if (!isNaN(val)) handlePlaceBid(val)
                  }}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-xs uppercase transition"
                >
                  Rilancia
                </button>
              </div>

            </div>
          ) : (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-12 text-center space-y-4">
              <h3 className="text-xl font-black uppercase">In attesa della chiamata</h3>
              <p className="text-xs text-slate-400">È il turno di <span className="text-amber-400 font-bold">{currentTurnTeamName}</span> di chiamare un <span className="text-white font-bold">{roleDisplay}</span>.</p>
              {canNominate && <button onClick={() => setIsNominateModalOpen(true)} className="mt-4 px-6 py-3 bg-blue-600 rounded-xl font-black text-xs uppercase hover:bg-blue-500 transition">Chiama {roleDisplay}</button>}
            </div>
          )}
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2"><Users className="w-4 h-4" /> Partecipanti & Budget</h3>
          <div className="space-y-2">
            {teamsData.map(team => (
              <div key={team.id} className={`p-3 rounded-xl border flex justify-between items-center ${team.id === currentTurnTeamId ? 'bg-amber-500/10 border-amber-500/50' : 'bg-slate-800/80 border-slate-700'}`}>
                <span className="font-bold text-xs">{team.name} {team.id === currentTurnTeamId && '⚡'}</span>
                <span className="text-xs font-black text-amber-400">{team.budget} CR</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {isNominateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 relative">
            
            {isSubmitting && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs z-10 flex flex-col items-center justify-center gap-3 rounded-2xl">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Chiamata in corso...</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase text-white">Chiama {roleDisplay}</h3>
              <button disabled={isSubmitting} onClick={() => setIsNominateModalOpen(false)} className="text-slate-400 hover:text-white disabled:opacity-50"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input 
                type="text" 
                placeholder="Cerca per nome giocatore..." 
                value={searchQuery} 
                disabled={isSubmitting}
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50" 
              />
              <select 
                value={selectedTeamFilter} 
                disabled={isSubmitting}
                onChange={(e) => setSelectedTeamFilter(e.target.value)} 
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="">Tutte le squadre reali</option>
                {availableTeamsList.map((teamName) => (
                  <option key={teamName} value={teamName}>{teamName}</option>
                ))}
              </select>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {availablePlayers.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-6 uppercase font-semibold">Nessun giocatore trovato</p>
              ) : (
                availablePlayers.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl">
                    <div>
                      <span className="font-bold text-sm text-white block">{p.name}</span>
                      <span className="text-xs text-slate-400">{p.team}</span>
                    </div>
                    <button 
                      disabled={isSubmitting}
                      onClick={() => handleNominatePlayer(p.id)} 
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-xs font-black uppercase transition flex items-center gap-1"
                    >
                      CHIAMA
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}