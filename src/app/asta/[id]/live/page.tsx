'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import { Gavel, Users, Timer, X, Loader2, Trophy, Wallet } from 'lucide-react'

const ROLE_NAMES: Record<string, string> = {
    'P': 'Portiere',
    'D': 'Difensore',
    'C': 'Centrocampista',
    'A': 'Attaccante'
}

const ROLE_COLUMN_MAP: Record<string, string> = {
    'P': 'p_val',
    'D': 'd_val',
    'C': 'c_val',
    'A': 'a_val'
}

export default function LiveAuctionPage() {
    const { id } = useParams()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)

    const [auction, setAuction] = useState<any>(null)
    const [currentNomination, setCurrentNomination] = useState<any>(null)
    const [pendingTimer, setPendingTimer] = useState<number>(0)
    const [biddingTimer, setBiddingTimer] = useState<number>(0)
    
    const [callTimeoutSeconds, setCallTimeoutSeconds] = useState<number>(15)
    const [auctionTimeoutSeconds, setAuctionTimeoutSeconds] = useState<number>(15)

    const [teamsData, setTeamsData] = useState<any[]>([])
    const [realTeamsData, setRealTeamsData] = useState<any[]>([])
    const [myTeamId, setMyTeamId] = useState<string | null>(null)
    const [myBudget, setMyBudget] = useState<number>(0)
    const [myRoleBudget, setMyRoleBudget] = useState<number | null>(null)
    const [myRoleSpent, setMyRoleSpent] = useState<number>(0)

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

    const [isCongratulationModalOpen, setIsCongratulationModalOpen] = useState(false)
    const [congratulatedPlayer, setCongratulatedPlayer] = useState<any>(null)

    const auctionChannelRef = useRef<any>(null)

    const fetchParticipantsAndTeams = async () => {
        const { data: participants } = await supabase.from('auction_participants').select('team_id').eq('auction_id', id)
        if (participants && participants.length > 0) {
            const teamIds = participants.map((p: any) => p.team_id).filter(Boolean)
            const { data: teams } = await supabase.from('league_teams').select('id, name, budget').in('id', teamIds)
            if (teams) {
                setTeamsData(teams)
                return teams
            }
        }
        return []
    }

    const fetchRoleBudgetInfo = async (teamId: string, role: string) => {
        if (!teamId || !role) {
            setMyRoleBudget(null)
            setMyRoleSpent(0)
            return
        }

        const colName = ROLE_COLUMN_MAP[role]
        if (!colName) {
            setMyRoleBudget(null)
            setMyRoleSpent(0)
            return
        }

        // 1. Recupera le impostazioni della lega per ottenere il budget massimo totale (es. max_budget)
        const { data: leagueSettings } = await supabase
            .from('league_settings')
            .select('max_budget')
            .single()
        
        const maxBudgetTotal = leagueSettings?.max_budget || 500

        // 2. Leggi la preferenza del budget di ruolo salvata a DB (tabella user_role_budgets o user_role_budget)
        const { data: roleBudgetRow } = await supabase
            .from('user_role_budgets')
            .select('*')
            .eq('user_id', (await supabase.auth.getSession()).data.session?.user.id)
            .maybeSingle()

        if (roleBudgetRow && roleBudgetRow[colName] !== undefined && roleBudgetRow[colName] !== null) {
            const rawVal = roleBudgetRow[colName]
            const mode = roleBudgetRow.mode || 'percentage'

            // Se la modalità è percentage, calcoliamo i crediti in base al max_budget totale
            const calculatedBudget = mode === 'percentage' 
                ? Math.round((maxBudgetTotal * rawVal) / 100) 
                : rawVal

            setMyRoleBudget(calculatedBudget)

            // 3. Calcola quanto è stato speso finora per questo ruolo da questa squadra
            const { data: spentData } = await supabase
                .from('league_team_players')
                .select('price')
                .eq('auction_id', id)
                .eq('team_id', teamId)
                .eq('role', role)

            const totalSpent = spentData?.reduce((acc, curr) => acc + (curr.price || 0), 0) || 0
            setMyRoleSpent(totalSpent)
        } else {
            setMyRoleBudget(null)
            setMyRoleSpent(0)
        }
    }

    const fetchCurrentNomination = async (forcedAuctionData?: any, callTimeout?: number, auctionTimeout?: number) => {
        const { data: nomination } = await supabase
            .from('auction_nominations')
            .select('*, players(*)')
            .eq('auction_id', id)
            .eq('status', 'in_corso')
            .maybeSingle()

        setCurrentNomination(nomination)
        setCurrentBid(nomination?.current_bid || nomination?.base_price || 1)
        setHighestTeamId(nomination?.highest_bidder_team_id || null)

        const act = forcedAuctionData || auction
        if (act) {
            evaluateTimers(act, callTimeout ?? callTimeoutSeconds, auctionTimeout ?? auctionTimeoutSeconds)
        }
    }

    const evaluateTimers = (currentAuctionData: any, callTimeout: number, auctionTimeout: number) => {
        if (currentAuctionData?.countdown_started_at) {
            const startTime = new Date(currentAuctionData.countdown_started_at).getTime()
            const now = Date.now()
            const elapsedSeconds = Math.floor((now - startTime) / 1000)
            const totalDuration = callTimeout + auctionTimeout
            const remainingTotal = totalDuration - elapsedSeconds

            if (remainingTotal > auctionTimeout) {
                setPendingTimer(Math.max(0, remainingTotal - auctionTimeout))
                setBiddingTimer(auctionTimeout)
            } else {
                setPendingTimer(0)
                setBiddingTimer(Math.max(0, remainingTotal))
            }
        } else {
            setPendingTimer(0)
            setBiddingTimer(0)
        }
    }

    const finalizeAuctionItem = async () => {
        if (!currentNomination) return

        const { data: freshNomination } = await supabase
            .from('auction_nominations')
            .select('status')
            .eq('id', currentNomination.id)
            .single()

        if (!freshNomination || freshNomination.status !== 'in_corso') {
            return
        }

        const { error: updateError } = await supabase
            .from('auction_nominations')
            .update({ status: 'chiusa' })
            .eq('id', currentNomination.id)
            .eq('status', 'in_corso')

        if (updateError) return

        const winnerTeamId = currentNomination.highest_bidder_team_id
        const finalPrice = currentNomination.current_bid
        const playerName = currentNomination.players?.name
        const playerRole = currentNomination.players?.role

        if (winnerTeamId) {
            await supabase.from('auction_transactions').insert({
                auction_id: id,
                team_id: winnerTeamId,
                player_name: playerName,
                role: playerRole,
                price: finalPrice
            })

            await supabase.from('league_team_players').insert({
                auction_id: id,
                team_id: winnerTeamId,
                player_name: playerName,
                role: playerRole,
                price: finalPrice
            })

            const targetTeam = teamsData.find(t => t.id === winnerTeamId)
            if (targetTeam) {
                const newBudget = Math.max(0, (targetTeam.budget || 0) - finalPrice)
                await supabase.from('league_teams').update({ budget: newBudget }).eq('id', winnerTeamId)
            }
        }

        if (playerName) {
            const winnerTeamName = teamsData.find(t => t.id === winnerTeamId)?.name || 'Nessuna squadra'
            setCongratulatedPlayer({
                name: playerName,
                role: playerRole,
                price: finalPrice,
                teamName: winnerTeamName,
                isMyTeam: winnerTeamId === myTeamId
            })
            setIsCongratulationModalOpen(true)
        }

        const teams = await fetchParticipantsAndTeams()
        const currentTeam = teams.find((t: any) => t.id === myTeamId)
        if (currentTeam) setMyBudget(currentTeam.budget)
        if (myTeamId && requiredRole) {
            await fetchRoleBudgetInfo(myTeamId, requiredRole)
        }
    }

    useEffect(() => {
        if (!id) return

        let isMounted = true

        async function initAuctionRoom() {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) {
                router.push('/login')
                return
            }

            const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
            if (profile?.role === 'admin') setIsAdmin(true)

            const { data: settings } = await supabase.from('league_settings').select('call_timeout_seconds, auction_timeout_seconds').single()
            const cTimeout = settings?.call_timeout_seconds || 15
            const aTimeout = settings?.auction_timeout_seconds || 15

            if (isMounted) {
                setCallTimeoutSeconds(cTimeout)
                setAuctionTimeoutSeconds(aTimeout)
            }

            const { data: auctionData } = await supabase
                .from('auctions')
                .select('*')
                .eq('id', id)
                .maybeSingle()

            if (!auctionData) {
                router.push('/')
                return
            }

            if (isMounted) {
                setAuction(auctionData)
                setRequiredRole(auctionData.required_role || 'P')
                setCurrentTurnTeamId(auctionData.current_turn_team_id || null)
            }

            const { data: realTeams } = await supabase.from('teams').select('*')
            if (realTeams && isMounted) {
                setRealTeamsData(realTeams)
            }

            const { data: teamData } = await supabase
                .from('league_teams')
                .select('id, budget')
                .eq('user_id', session.user.id)
                .maybeSingle()

            if (teamData && isMounted) {
                setMyTeamId(teamData.id)
                setMyBudget(teamData.budget || 0)
                await fetchRoleBudgetInfo(teamData.id, auctionData.required_role || 'P')
            }

            const fetchedTeams = await fetchParticipantsAndTeams()
            const currentTeam = fetchedTeams.find((t: any) => t.id === teamData?.id)
            if (currentTeam && isMounted) setMyBudget(currentTeam.budget)

            let activeTurnId = auctionData.current_turn_team_id
            if (!activeTurnId && fetchedTeams.length > 0) {
                activeTurnId = fetchedTeams[0].id
                await supabase.from('auctions').update({ current_turn_team_id: activeTurnId }).eq('id', id)
            }
            if (isMounted) setCurrentTurnTeamId(activeTurnId || null)

            await fetchCurrentNomination(auctionData, cTimeout, aTimeout)

            if (isMounted) setLoading(false)
            if (!isMounted) return

            const channel = supabase.channel(`auction-room-${id}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'auctions', filter: `id=eq.${id}` },
                    async (payload: any) => {
                        if (payload.new && isMounted) {
                            setAuction(payload.new)
                            setCurrentTurnTeamId(payload.new.current_turn_team_id || null)
                            const newRole = payload.new.required_role || 'P'
                            setRequiredRole(newRole)
                            if (myTeamId) {
                                await fetchRoleBudgetInfo(myTeamId, newRole)
                            }
                            evaluateTimers(payload.new, cTimeout, aTimeout)
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'auction_nominations', filter: `auction_id=eq.${id}` },
                    () => {
                        if (isMounted) fetchCurrentNomination(undefined, cTimeout, aTimeout)
                    }
                )
                .subscribe()

            auctionChannelRef.current = channel
        }

        initAuctionRoom()

        return () => {
            isMounted = false
            if (auctionChannelRef.current) {
                supabase.removeChannel(auctionChannelRef.current)
                auctionChannelRef.current = null
            }
        }
    }, [id, router, myTeamId])

    // Sync continuo basato su timestamp assoluto ed evento di visibilità
    useEffect(() => {
        if (!auction?.countdown_started_at) return

        const checkTimer = () => {
            evaluateTimers(auction, callTimeoutSeconds, auctionTimeoutSeconds)
        }

        checkTimer()

        const interval = setInterval(checkTimer, 1000)

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkTimer()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            clearInterval(interval)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [auction?.countdown_started_at, callTimeoutSeconds, auctionTimeoutSeconds])

    useEffect(() => {
        if (biddingTimer === 0 && pendingTimer === 0 && currentNomination && currentNomination.status === 'in_corso') {
            if (isAdmin) {
                finalizeAuctionItem()
            }
        }
    }, [biddingTimer, pendingTimer, currentNomination, isAdmin])

    useEffect(() => {
        async function loadPlayers() {
            if (!isNominateModalOpen) return

            let query = supabase.from('players').select('*').order('name', { ascending: true })

            if (requiredRole) {
                query = query.eq('role', requiredRole)
            }

            const { data, error } = await query

            if (!error && data) {
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

        loadPlayers()
    }, [isNominateModalOpen, requiredRole, searchQuery, selectedTeamFilter])

    const handleNominatePlayer = async (playerId: number) => {
        if (isSubmitting) return
        setIsSubmitting(true)

        const { data: settings } = await supabase
            .from('league_settings')
            .select('call_timeout_seconds, auction_timeout_seconds')
            .single()

        const cTimeout = settings?.call_timeout_seconds || callTimeoutSeconds
        const aTimeout = settings?.auction_timeout_seconds || auctionTimeoutSeconds

        const now = Date.now()
        const nowISO = new Date(now).toISOString()
        const totalDurationSeconds = cTimeout + aTimeout
        const expireISO = new Date(now + totalDurationSeconds * 1000).toISOString()

        await supabase.from('auctions').update({
            countdown_started_at: nowISO,
            bidding_expires_at: expireISO
        }).eq('id', id)

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
            setIsNominateModalOpen(false)
            setPendingTimer(cTimeout)
            setBiddingTimer(aTimeout)
        }
        setIsSubmitting(false)
    }

    const handlePlaceBid = async (newAmount: number) => {
        if (!currentNomination || !myTeamId) return

        if (newAmount > myBudget) {
            alert("Non hai abbastanza Crediti (CR) per effettuare questa offerta!")
            return
        }

        if (myRoleBudget !== null) {
            const alreadyCommittedByMe = (highestTeamId === myTeamId) ? currentBid : 0
            const effectiveCostDelta = newAmount - alreadyCommittedByMe

            if (effectiveCostDelta > (myRoleBudget - myRoleSpent)) {
                alert(`L'offerta supera il budget residuo per il ruolo ${ROLE_NAMES[requiredRole]} (${myRoleBudget - myRoleSpent} CR disponibili)!`)
                return
            }
        }

        const { data: settings } = await supabase
            .from('league_settings')
            .select('auction_timeout_seconds')
            .single()

        const aTimeout = settings?.auction_timeout_seconds || auctionTimeoutSeconds
        const expireISO = new Date(Date.now() + aTimeout * 1000).toISOString()

        await supabase.from('auction_nominations').update({
            current_bid: newAmount,
            highest_bidder_team_id: myTeamId
        }).eq('id', currentNomination.id)

        await supabase.from('auctions').update({
            bidding_expires_at: expireISO
        }).eq('id', id)

        setCustomBidValue('')
    }

    const currentTurnTeamName = teamsData.find(t => t.id === currentTurnTeamId)?.name || 'Nessuna squadra'
    const highestBidderName = teamsData.find(t => t.id === highestTeamId)?.name || 'Nessuna'
    const roleDisplay = ROLE_NAMES[requiredRole] || requiredRole
    const canNominate = isAdmin || (currentTurnTeamId === myTeamId)

    const nominatingTeamId = currentNomination?.highest_bidder_team_id
    const nominatingTeamName = teamsData.find(t => t.id === nominatingTeamId)?.name || 'Una squadra'

    if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 rounded-full animate-spin" /></div>

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8 flex flex-col">
            <header className="max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between pb-6 border-b border-slate-800 gap-3">
                <h1 className="text-lg font-black uppercase flex items-center gap-2"><Gavel className="w-5 h-5 text-blue-500" /> Asta Live</h1>
                <div className="flex items-center gap-2">
                    {myRoleBudget !== null && (
                        <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300 text-xs font-black uppercase flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5" /> Budget {roleDisplay}: {myRoleBudget - myRoleSpent} CR <span className="text-slate-500 font-normal">/ {myRoleBudget}</span>
                        </div>
                    )}
                    <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs font-black uppercase">Budget Tot: {myBudget} CR</div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 py-6 flex-1">
                <div className="lg:col-span-2 space-y-6">

                    {currentNomination && pendingTimer > 0 ? (
                        <div className="bg-slate-800/60 border border-amber-500/50 rounded-2xl p-12 text-center space-y-4">
                            <h3 className="text-xl font-black uppercase text-amber-400">La squadra {nominatingTeamName} ha scelto {currentNomination.players?.name}!</h3>
                            <p className="text-slate-400 text-sm">L'asta inizia tra...</p>
                            <div className="text-6xl font-black text-white">{pendingTimer}s</div>
                        </div>
                    ) : currentNomination ? (
                        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 md:p-8 space-y-6">
                            <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 flex-wrap gap-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase">
                                    <Timer className="w-4 h-4 text-amber-400 animate-spin" /> In vantaggio: <span className="text-white font-black">{highestBidderName}</span> <span className="text-amber-400 font-black">({currentBid} CR)</span>
                                </div>
                                <div className="text-xs font-black text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                                    Scadenza: {biddingTimer}s
                                </div>
                            </div>
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold uppercase px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg">{ROLE_NAMES[currentNomination.players?.role] || currentNomination.players?.role}</span>
                                    <h2 className="text-3xl font-black uppercase text-white mt-3">{currentNomination.players?.name}</h2>

                                    <div className="flex items-center gap-3 mt-2">
                                        {(() => {
                                            const playerTeamName = currentNomination.players?.team;
                                            const matchedRealTeam = realTeamsData.find(
                                                t => t.alias?.toLowerCase() === playerTeamName?.toLowerCase()
                                            );

                                            let colorsArray: string[] = [];
                                            if (matchedRealTeam?.colors) {
                                                if (Array.isArray(matchedRealTeam.colors)) {
                                                    colorsArray = matchedRealTeam.colors;
                                                } else if (typeof matchedRealTeam.colors === 'string') {
                                                    colorsArray = matchedRealTeam.colors.replace(/[{}]/g, '').split(',').map((c: string) => c.trim()).filter(Boolean);
                                                }
                                            }

                                            return (
                                                <>
                                                    {colorsArray.length > 0 && (
                                                        <div className="flex h-4 w-6 rounded overflow-hidden border border-slate-700 shadow-sm" title="Colori sociali">
                                                            {colorsArray.map((color: string, idx: number) => (
                                                                <div key={idx} className="flex-1 h-full" style={{ backgroundColor: color }} />
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-2">
                                                        {matchedRealTeam?.logo_url ? (
                                                            <img src={matchedRealTeam.logo_url} alt={playerTeamName} className="w-5 h-5 object-contain" />
                                                        ) : null}
                                                        <span className="text-sm text-slate-400 font-medium">{matchedRealTeam?.name}</span>
                                                    </div>

                                                    {matchedRealTeam?.alias && (
                                                        <span className="text-xs font-semibold px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded border border-slate-600/40 uppercase">
                                                            {matchedRealTeam.alias}
                                                        </span>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
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

                            <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                                <input
                                    type="number"
                                    placeholder={`Offerta personalizzata (> ${currentBid})`}
                                    value={customBidValue}
                                    onChange={(e) => setCustomBidValue(e.target.value)}
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                                <button
                                    onClick={() => {
                                        const val = parseInt(customBidValue)
                                        if (isNaN(val) || val <= currentBid) {
                                            alert("L'offerta deve essere superiore all'offerta corrente!")
                                            return
                                        }
                                        handlePlaceBid(val)
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
                    <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2"><Users className="w-4 h-4" /> Partecipanti</h3>
                    {teamsData.map(team => (
                        <div key={team.id} className={`p-3 rounded-xl border flex justify-between items-center ${team.id === currentTurnTeamId ? 'bg-amber-500/10 border-amber-500/50' : 'bg-slate-800/80 border-slate-700'}`}>
                            <span className="font-bold text-xs">{team.name}</span>
                            <span className="text-xs font-black text-amber-400">{team.budget} CR</span>
                        </div>
                    ))}
                </div>
            </main>

            {isCongratulationModalOpen && congratulatedPlayer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
                        <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl"></div>
                        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>

                        <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-3 animate-bounce" />
                        <h2 className="text-2xl font-black uppercase text-white mb-1">Giocatore Assegnato!</h2>
                        <p className="text-slate-400 text-sm mb-6">
                            {congratulatedPlayer.isMyTeam ? "Complimenti! È entrato nella tua rosa." : `Assegnato alla squadra ${congratulatedPlayer.teamName}`}
                        </p>

                        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 mb-6 text-left space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Ruolo</span>
                                <span className="px-2 py-0.5 bg-slate-700 text-xs font-bold text-indigo-300 rounded">
                                    {ROLE_NAMES[congratulatedPlayer.role] || congratulatedPlayer.role}
                                </span>
                            </div>
                            <div className="text-xl font-black text-white">
                                {congratulatedPlayer.name}
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-700/50 text-sm">
                                <span className="text-slate-400">Prezzo di chiusura</span>
                                <span className="font-black text-emerald-400">{congratulatedPlayer.price} CR</span>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setIsCongratulationModalOpen(false)
                                setCongratulatedPlayer(null)
                            }}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-indigo-600/30"
                        >
                            Continua l'Asta
                        </button>
                    </div>
                </div>
            )}

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
                            <button disabled={isSubmitting} onClick={() => setIsNominateModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                                type="text"
                                placeholder="Cerca per nome giocatore..."
                                value={searchQuery}
                                disabled={isSubmitting}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                            <select
                                value={selectedTeamFilter}
                                disabled={isSubmitting}
                                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
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