'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import { Gavel, Users, Shield, ArrowLeft, Timer, Search, Plus, Sparkles } from 'lucide-react'
import Link from 'next/link'

// Mappa per convertire le sigle nei nomi estesi dei ruoli
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
  
  // Stati dell'asta e del giocatore corrente
  const [auction, setAuction] = useState<any>(null)
  const [currentNomination, setCurrentNomination] = useState<any>(null)
  const [teamsData, setTeamsData] = useState<any[]>([])
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [currentBid, setCurrentBid] = useState<number>(0)
  const [highestTeamId, setHighestTeamId] = useState<string | null>(null)

  // Gestione turno e ruolo da chiamare
  const [currentTurnTeamId, setCurrentTurnTeamId] = useState<string | null>(null)
  const [requiredRole, setRequiredRole] = useState<string>('P')

  // Stati per la modale di chiamata calciatore
  const [isNominateModalOpen, setIsNominateModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([])
  
  const auctionChannelRef = useRef<any>(null)

  useEffect(() => {
    let isMounted = true

    async function initAuctionRoom() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      
      if (!user) {
        router.push('/login')
        return
      }

      // 1. Controllo ruolo Admin
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role === 'admin') setIsAdmin(true)

      // 2. Fetch dati dell'asta
      const { data: auctionData, error: auctionError } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (auctionError || !auctionData) {
        router.push('/')
        return
      }

      if (auctionData.status !== 'in_corso') {
        router.push(`/asta/${id}`)
        return
      }

      setAuction(auctionData)
      if (auctionData.current_turn_team_id) setCurrentTurnTeamId(auctionData.current_turn_team_id)
      if (auctionData.required_role) setRequiredRole(auctionData.required_role)

      // 3. Recupera la squadra dell'utente loggato
      const { data: teamData } = await supabase
        .from('league_teams')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (teamData) {
        setMyTeamId(teamData.id)
      }

      // 4. Fetch partecipanti e crediti
      await fetchParticipantsAndTeams(auctionData.current_turn_team_id)

      // 5. Fetch eventuale chiamata attiva corrente
      await fetchCurrentNomination()

      if (isMounted) setLoading(false)

      // 6. Realtime
      if (auctionChannelRef.current) supabase.removeChannel(auctionChannelRef.current)
      auctionChannelRef.current = supabase.channel(`auction-room-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions', filter: `id=eq.${id}` }, (payload: any) => {
          if (payload.new) {
            setAuction(payload.new)
            if (payload.new.status !== 'in_corso') {
              router.push(`/asta/${id}`)
            }
            if (payload.new.current_turn_team_id) setCurrentTurnTeamId(payload.new.current_turn_team_id)
            if (payload.new.required_role) setRequiredRole(payload.new.required_role)
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
      if (auctionChannelRef.current) {
        supabase.removeChannel(auctionChannelRef.current)
        auctionChannelRef.current = null
      }
    }
  }, [id, router])

  const fetchParticipantsAndTeams = async (activeTurnId?: string) => {
    // Carichiamo i partecipanti uniti alla tabella league_teams
    const { data: participants, error } = await supabase
      .from('auction_participants')
      .select('team_id, league_teams(id, name, logo_url, budget)')
      .eq('auction_id', id)

    if (error) {
      console.error("Errore caricamento partecipanti:", error)
      return
    }

    if (participants) {
      const formattedTeams = participants
        .filter((p: any) => p.league_teams)
        .map((p: any) => ({
          id: p.league_teams.id,
          name: p.league_teams.name,
          logo_url: p.league_teams.logo_url,
          budget: p.league_teams.budget ?? 500
        }))
      
      setTeamsData(formattedTeams)
      
      // Se non c'è un turno impostato nello stato ma ci sono squadre, impostiamo la prima di default
      if (!activeTurnId && !currentTurnTeamId && formattedTeams.length > 0) {
        setCurrentTurnTeamId(formattedTeams[0].id)
      }
    }
  }

  const fetchCurrentNomination = async () => {
    const { data: nomination } = await supabase
      .from('auction_nominations')
      .select('*, players(*)')
      .eq('auction_id', id)
      .eq('status', 'in_corso')
      .maybeSingle()

    if (nomination) {
      setCurrentNomination(nomination)
      setCurrentBid(nomination.current_bid || nomination.base_price || 1)
      setHighestTeamId(nomination.highest_bidder_team_id || null)
    } else {
      setCurrentNomination(null)
    }
  }

  const fetchAvailablePlayers = async () => {
    let query = supabase
      .from('players')
      .select('*')
      .eq('role', requiredRole)
      .order('name', { ascending: true })

    if (searchQuery.trim()) {
      query = query.ilike('name', `%${searchQuery}%`)
    }

    const { data } = await query
    if (data) setAvailablePlayers(data)
  }

  useEffect(() => {
    if (isNominateModalOpen) {
      fetchAvailablePlayers()
    }
  }, [isNominateModalOpen, searchQuery, requiredRole])

  const handleNominatePlayer = async (playerId: number, basePrice: number = 1) => {
    const { error } = await supabase
      .from('auction_nominations')
      .insert({
        auction_id: id,
        player_id: playerId,
        base_price: basePrice,
        current_bid: basePrice,
        status: 'in_corso'
      })

    if (error) {
      alert("Impossibile chiamare il giocatore.")
      return
    }

    setIsNominateModalOpen(false)
    fetchCurrentNomination()
  }

  const handlePlaceBid = async (increment: number) => {
    if (!currentNomination || !myTeamId) return

    const nextBid = currentBid + increment
    
    const { error } = await supabase
      .from('auction_nominations')
      .update({
        current_bid: nextBid,
        highest_bidder_team_id: myTeamId
      })
      .eq('id', currentNomination.id)

    if (error) {
      alert("Errore nell'invio dell'offerta.")
    }
  }

  const currentTurnTeamName = teamsData.find(t => t.id === currentTurnTeamId)?.name || 'Nessuna squadra'
  const roleFullName = ROLE_NAMES[requiredRole] || requiredRole
  const canNominate = isAdmin || (currentTurnTeamId === myTeamId)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8 flex flex-col justify-between relative">
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link href={`/asta/${id}`} className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 hover:text-white uppercase transition-colors">
            <ArrowLeft className="w-4 h-4" /> Sala d'Attesa
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <h1 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
            <Gavel className="w-5 h-5 text-blue-500" /> Stanza dell'Asta Live
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Ruolo da Chiamare: <span className="text-white underline">{roleFullName}</span>
          </div>
          <div className="text-xs font-semibold px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 uppercase tracking-wider animate-pulse">
            Live Attivo
          </div>
        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 py-6 flex-1">
        
        {/* COLONNA CENTRALE */}
        <div className="lg:col-span-2 space-y-6 flex flex-col justify-between">
          
          {currentNomination ? (
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 md:p-8 shadow-xl backdrop-blur-md space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg">
                    {ROLE_NAMES[currentNomination.players?.role] || currentNomination.players?.role || 'Ruolo'}
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white mt-3">
                    {currentNomination.players?.name || 'Nome Giocatore'}
                  </h2>
                  <p className="text-sm text-slate-400 font-medium mt-1">
                    Squadra Reale: <span className="text-white font-bold">{currentNomination.players?.team || 'N/D'}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 uppercase font-semibold block">Offerta Attuale</span>
                  <span className="text-4xl md:text-5xl font-black text-amber-400 tracking-tighter">
                    {currentBid} <span className="text-lg text-slate-400">CR</span>
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold uppercase">Miglior offerente:</span>
                <span className="text-sm font-black uppercase text-white">
                  {teamsData.find(t => t.id === highestTeamId)?.name || "Nessuna offerta"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-4">
                <button 
                  onClick={() => handlePlaceBid(1)}
                  className="py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-black text-sm uppercase transition-all shadow-md cursor-pointer"
                >
                  +1 Credito
                </button>
                <button 
                  onClick={() => handlePlaceBid(5)}
                  className="py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-black text-sm uppercase transition-all shadow-md cursor-pointer"
                >
                  +5 Crediti
                </button>
                <button 
                  onClick={() => handlePlaceBid(10)}
                  className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm uppercase transition-all shadow-md cursor-pointer"
                >
                  +10 Crediti
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-12 text-center space-y-4 my-auto">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl mx-auto flex items-center justify-center text-slate-500">
                <Timer className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-xl font-black uppercase text-white">In attesa della chiamata</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
                È il turno di <span className="text-amber-400 font-bold">{currentTurnTeamName}</span> di chiamare un <span className="text-white font-bold">{roleFullName}</span>.
              </p>
              {canNominate && (
                <button 
                  onClick={() => setIsNominateModalOpen(true)}
                  className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase rounded-xl transition-all shadow-lg cursor-pointer inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Chiama {roleFullName}
                </button>
              )}
            </div>
          )}

        </div>

        {/* COLONNA DESTRA: PARTECIPANTI E TURNO EVIDENZIATO */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-4 flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" /> Partecipanti & Crediti
          </h3>
          <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
            {teamsData.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs uppercase font-bold">Nessun partecipante trovato.</div>
            ) : (
              teamsData.map((team) => {
                const isTurn = team.id === currentTurnTeamId
                const isMe = team.id === myTeamId
                return (
                  <div 
                    key={team.id} 
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${isTurn ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/5' : isMe ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-800/80 border-slate-700/80'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield className={`w-4 h-4 ${isTurn ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
                      <div>
                        <span className="font-bold text-xs uppercase text-white truncate max-w-[110px] block">{team.name}</span>
                        {isTurn && <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">Di Turno ⚡</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-amber-400">{team.budget ?? 500} CR</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {canNominate && currentNomination === null && (
            <button 
              onClick={() => setIsNominateModalOpen(true)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase rounded-xl transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Chiama {roleFullName}
            </button>
          )}
        </div>

      </main>

      {/* MODALE DI SCELTA CALCIATORE */}
      {isNominateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-500" /> Seleziona {roleFullName} da Chiamare
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Mostrando solo i giocatori di ruolo <span className="text-amber-400 font-bold">{roleFullName}</span>.</p>
              </div>
              <button 
                onClick={() => setIsNominateModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <input 
                type="text" 
                placeholder={`Cerca ${roleFullName} per nome...`} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[45vh]">
              {availablePlayers.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs uppercase font-bold">Nessun giocatore trovato per questo ruolo.</div>
              ) : (
                availablePlayers.map(player => (
                  <div key={player.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between hover:border-blue-500/50 transition-colors">
                    <div>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded mr-2">{ROLE_NAMES[player.role] || player.role}</span>
                      <span className="font-bold text-sm text-white uppercase">{player.name}</span>
                      <span className="text-xs text-slate-400 ml-2">({player.team})</span>
                    </div>
                    <button 
                      onClick={() => handleNominatePlayer(player.id, 1)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase rounded-lg cursor-pointer shadow"
                    >
                      Chiama (1 CR)
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