'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import { Gavel, Users, Timer, X, Loader2 } from 'lucide-react'

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
  const [pendingNomination, setPendingNomination] = useState<any>(null)
  const [pendingTimer, setPendingTimer] = useState<number>(0)
  
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
  const [timeLeft, setTimeLeft] = useState<number>(15)
  
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

      const fetchedTeams = await fetchParticipantsAndTeams()
      
      let activeTurnId = auctionData.current_turn_team_id
      if (!activeTurnId && fetchedTeams.length > 0) {
        activeTurnId = fetchedTeams[0].id
        await supabase.from('auctions').update({ current_turn_team_id: activeTurnId }).eq('id', id)
      }
      setCurrentTurnTeamId(activeTurnId || null)

      await fetchCurrentNomination()

      if (isMounted) setLoading(false)

      auctionChannelRef.current = supabase.channel(`auction-room-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions', filter: `id=eq.${id}` }, (payload: any) => {
          if (payload.new) {
            setAuction(payload.new)
            setCurrentTurnTeamId(payload.new.current_turn_team_id || null)
            setRequiredRole(payload.new.required_role || 'P')
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

  // Timer di attesa (Pending)
  useEffect(() => {
    if (pendingTimer > 0) {
      const interval = setInterval(() => setPendingTimer(prev => prev - 1), 1000)
      return () => clearInterval(interval)
    } else if (pendingTimer === 0 && pendingNomination) {
      setPendingNomination(null)
      fetchCurrentNomination()
    }
  }, [pendingTimer, pendingNomination])

  const fetchParticipantsAndTeams = async () => {
    const { data: participants } = await supabase.from('auction_participants').select('team_id').eq('auction_id', id)
    if (participants && participants.length > 0) {
      const teamIds = participants.map((p: any) => p.team_id).filter(Boolean)
      const { data: teams } = await supabase.from('league_teams').select('id, name, budget').in('id', teamIds)
      if (teams) {
        setTeamsData(teams)
        const currentTeam = teams.find((t: any) => t.id === myTeamId)
        if (currentTeam) setMyBudget(currentTeam.budget)
        return teams
      }
    }
    return []
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
  }

  const handleNominatePlayer = async (playerId: number, playerName: string) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    
    const { data: settings } = await supabase.from('league_settings').select('call_timeout_seconds').single()
    const timeout = settings?.call_timeout_seconds || 15

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

    if (!error) {
      setPendingNomination({ playerName, teamName: teamsData.find(t => t.id === myTeamId)?.name })
      setPendingTimer(timeout)
      setIsNominateModalOpen(false)
    }
    setIsSubmitting(false)
  }

  const handlePlaceBid = async (newAmount: number) => {
    if (!currentNomination || !myTeamId) return
    await supabase.from('auction_nominations').update({ current_bid: newAmount, highest_bidder_team_id: myTeamId }).eq('id', currentNomination.id)
    setCustomBidValue('')
  }

  const currentTurnTeamName = teamsData.find(t => t.id === currentTurnTeamId)?.name || 'Nessuna squadra'
  const roleDisplay = ROLE_NAMES[requiredRole] || requiredRole
  const canNominate = isAdmin || (currentTurnTeamId === myTeamId)

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8 flex flex-col">
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-800">
        <h1 className="text-lg font-black uppercase flex items-center gap-2"><Gavel className="w-5 h-5 text-blue-500" /> Asta Live</h1>
        <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs font-black uppercase">Budget: {myBudget} CR</div>
      </header>

      <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 py-6 flex-1">
        <div className="lg:col-span-2 space-y-6">
          
          {pendingNomination ? (
            <div className="bg-slate-800/60 border border-amber-500/50 rounded-2xl p-12 text-center space-y-4">
              <h3 className="text-xl font-black uppercase text-amber-400">La squadra {pendingNomination.teamName} ha scelto {pendingNomination.playerName}!</h3>
              <p className="text-slate-400 text-sm">L'asta inizia tra...</p>
              <div className="text-6xl font-black text-white">{pendingTimer}s</div>
            </div>
          ) : currentNomination ? (
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg">{ROLE_NAMES[currentNomination.players?.role] || currentNomination.players?.role}</span>
                  <h2 className="text-3xl font-black uppercase text-white mt-3">{currentNomination.players?.name}</h2>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Offerta</span>
                  <span className="text-5xl font-black text-amber-400 block">{currentBid} CR</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => handlePlaceBid(currentBid + 1)} className="py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold uppercase text-sm transition">+1</button>
                <button onClick={() => handlePlaceBid(currentBid + 5)} className="py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold uppercase text-sm transition">+5</button>
                <button onClick={() => handlePlaceBid(currentBid + 10)} className="py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold uppercase text-sm transition">+10</button>
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
          <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2"><Users className="w-4 h-4" /> Partecipanti</h3>
          {teamsData.map(team => (
            <div key={team.id} className={`p-3 rounded-xl border flex justify-between items-center ${team.id === currentTurnTeamId ? 'bg-amber-500/10 border-amber-500/50' : 'bg-slate-800/80 border-slate-700'}`}>
              <span className="font-bold text-xs">{team.name}</span>
              <span className="text-xs font-black text-amber-400">{team.budget} CR</span>
            </div>
          ))}
        </div>
      </main>

      {isNominateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase">Chiama {roleDisplay}</h3>
              <button onClick={() => setIsNominateModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {availablePlayers.map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-slate-800 rounded-xl">
                  <span className="font-bold text-sm">{p.name}</span>
                  <button onClick={() => handleNominatePlayer(p.id, p.name)} className="px-4 py-2 bg-emerald-600 rounded-lg text-xs font-black uppercase">Chiama</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}