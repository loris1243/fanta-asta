'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import {
    Gavel,
    Users,
    X,
    Loader2,
    Trophy,
    Wallet,
    Star,
    LogOut
} from 'lucide-react'

const ROLE_LIMITS: Record<string, number> = {
    P: 3,
    D: 8,
    C: 8,
    A: 6
}

const ROLE_ORDER: string[] = ['P', 'D', 'C', 'A']

const ROLE_NAMES: Record<string, string> = {
    P: 'Portiere',
    D: 'Difensore',
    C: 'Centrocampista',
    A: 'Attaccante'
}

const ROLE_COLUMN_MAP: Record<string, string> = {
    P: 'p_val',
    D: 'd_val',
    C: 'c_val',
    A: 'a_val'
}

type BidRow = {
    id: number
    team_id: string
    amount: number
    created_at: string
}

type WithdrawalRow = {
    id: number
    team_id: string
    created_at: string
    teamName?: string
}

export default function LiveAuctionPage() {
    const { id } = useParams()
    const router = useRouter()

    const [myRoleCounts, setMyRoleCounts] = useState<Record<string, number>>({ P: 0, D: 0, C: 0, A: 0 })
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)

    const [auction, setAuction] = useState<any>(null)
    const [currentNomination, setCurrentNomination] = useState<any>(null)

    const [teamsData, setTeamsData] = useState<any[]>([])
    const [realTeamsData, setRealTeamsData] = useState<any[]>([])

    const [myTeamId, setMyTeamId] = useState<string | null>(null)
    const [myBudget, setMyBudget] = useState<number>(0)

    const [myRoleBudget, setMyRoleBudget] =
        useState<number | null>(null)
    const [myRoleSpent, setMyRoleSpent] = useState<number>(0)

    const [currentBid, setCurrentBid] = useState<number>(0)
    const [highestTeamId, setHighestTeamId] =
        useState<string | null>(null)

    const [currentTurnTeamId, setCurrentTurnTeamId] =
        useState<string | null>(null)

    const [requiredRole, setRequiredRole] = useState<string>('P')

    const [bids, setBids] = useState<BidRow[]>([])

    const [withdrawnTeamIds, setWithdrawnTeamIds] =
        useState<Set<string>>(new Set())

    const [withdrawalMessages, setWithdrawalMessages] =
        useState<WithdrawalRow[]>([])

    const [isNominateModalOpen, setIsNominateModalOpen] =
        useState(false)

    const [searchQuery, setSearchQuery] = useState('')
    const [selectedTeamFilter, setSelectedTeamFilter] =
        useState('')
    const [onlyTargets, setOnlyTargets] = useState(false)

    const [targetPlayerIds, setTargetPlayerIds] =
        useState<Set<number>>(new Set())

    const [availablePlayers, setAvailablePlayers] =
        useState<any[]>([])

    const [availableTeamsList, setAvailableTeamsList] =
        useState<string[]>([])

    const [customBidValue, setCustomBidValue] = useState('')
    const [basePriceValue, setBasePriceValue] = useState('1')

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isWithdrawing, setIsWithdrawing] = useState(false)

    const [isRoleBudgetWarningOpen, setIsRoleBudgetWarningOpen] =
        useState(false)

    const [pendingBidAmount, setPendingBidAmount] =
        useState<number | null>(null)

    const [pendingRoleBudgetExceeded, setPendingRoleBudgetExceeded] =
        useState(0)

    const [isClosingAuction, setIsClosingAuction] =
        useState(false)

    const [isCongratulationModalOpen, setIsCongratulationModalOpen] =
        useState(false)

    const [congratulatedPlayer, setCongratulatedPlayer] =
        useState<any>(null)

    const auctionChannelRef = useRef<any>(null)
    const finalizingRef = useRef(false)
    const initSequenceRef = useRef(0)

    const getRealTeamData = (playerTeam: string) => {
        if (!playerTeam) return null
        const normalized = playerTeam.trim().toLowerCase()
        return realTeamsData.find(
            (t) => t.alias?.trim().toLowerCase() === normalized
        )
    }


    // ============================================================
    // SQUADRE PARTECIPANTI
    // ============================================================

    const handlePassTurn = async () => {
        try {

            const nextTurnTeamId =
                getNextTurnTeamId(
                    currentTurnTeamId,
                    teamsData
                )


            const { error } = await supabase
                .from('auctions')
                .update({
                    current_turn_team_id:
                        nextTurnTeamId
                })
                .eq('id', id);

            if (error) throw error;

            // Oppure, se gestisci tutto via stato locale / websocket, richiama la funzione di aggiornamento dati
            // fetchAuctionData();

        } catch (err) {
            console.error("Errore durante il passaggio del turno:", err);
            alert("Impossibile passare il turno. Riprova.");
        }
    };

    const fetchParticipantsAndTeams = async () => {
        const { data: participants, error } = await supabase
            .from('auction_participants')
            .select('team_id')
            .eq('auction_id', id)
            .eq('is_online', true)

        if (error) {
            console.error('Errore partecipanti:', error)
            return []
        }

        const teamIds =
            participants
                ?.map((p: any) => p.team_id)
                .filter(Boolean) || []

        if (teamIds.length === 0) {
            setTeamsData([])
            return []
        }

        const { data: teams, error: teamsError } =
            await supabase
                .from('league_teams')
                .select('id, name, budget, user_id')
                .in('id', teamIds)

        if (teamsError) {
            console.error('Errore squadre:', teamsError)
            return []
        }

        const orderedTeams =
            teamIds
                .map((teamId: string) =>
                    (teams || []).find(
                        (team: any) =>
                            team.id === teamId
                    )
                )
                .filter(Boolean)

        setTeamsData(orderedTeams)

        return orderedTeams
    }

    // ============================================================
    // TROVA PROSSIMA SQUADRA DEL TURNO
    // ============================================================

    const getNextTurnTeamId = (
        currentTeamId: string | null,
        teams: any[]
    ): string | null => {
        if (!teams || teams.length === 0) {
            return null
        }

        if (!currentTeamId) {
            return teams[0]?.id || null
        }

        const currentIndex =
            teams.findIndex(
                (team) =>
                    team.id === currentTeamId
            )

        if (currentIndex === -1) {
            return teams[0]?.id || null
        }

        const nextIndex =
            (currentIndex + 1) %
            teams.length

        return teams[nextIndex]?.id || null
    }

    // ============================================================
    // AGGIORNAMENTO MIA SQUADRA
    // ============================================================

    const refreshMyTeamData = async (
        teamId: string | null = myTeamId
    ) => {
        if (!teamId) return

        const { data, error } = await supabase
            .from('league_teams')
            .select('id, name, budget')
            .eq('id', teamId)
            .maybeSingle()

        if (error) {
            console.error(
                'Errore aggiornamento squadra:',
                error
            )
            return
        }

        if (data) {
            setMyBudget(data.budget || 0)

            setTeamsData((prev) =>
                prev.map((team) =>
                    team.id === data.id
                        ? {
                            ...team,
                            budget: data.budget
                        }
                        : team
                )
            )
        }
    }

    // ============================================================
    // BUDGET RUOLO
    // ============================================================

    const fetchRoleBudgetInfo = async (
        teamId: string,
        role: string
    ) => {
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

        const { data: leagueSettings } = await supabase
            .from('league_settings')
            .select('initial_budget')
            .single()

        const maxBudgetTotal =
            leagueSettings?.initial_budget || 500

        const { data: sessionData } =
            await supabase.auth.getSession()

        const userId =
            sessionData?.session?.user?.id

        if (!userId) return

        const { data: roleBudgetRow } =
            await supabase
                .from('user_role_budgets')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle()

        if (
            roleBudgetRow &&
            roleBudgetRow[colName] !== undefined &&
            roleBudgetRow[colName] !== null
        ) {
            const rawVal = roleBudgetRow[colName]
            const mode =
                roleBudgetRow.mode || 'percentage'

            const calculatedBudget =
                mode === 'percentage'
                    ? Math.round(
                        (maxBudgetTotal * rawVal) /
                        100
                    )
                    : rawVal

            setMyRoleBudget(calculatedBudget)

            const { data: spentData } =
                await supabase
                    .from('league_team_players')
                    .select('price')
                    .eq('auction_id', id)
                    .eq('team_id', teamId)
                    .eq('role', role)

            const totalSpent =
                spentData?.reduce(
                    (acc, curr) =>
                        acc + (curr.price || 0),
                    0
                ) || 0

            setMyRoleSpent(totalSpent)
        } else {
            setMyRoleBudget(null)
            setMyRoleSpent(0)
        }
    }

    const fetchMyRoleCounts = async (teamId: string) => {
        if (!teamId) return

        const { data, error } = await supabase
            .from('league_team_players')
            .select('role')
            .eq('auction_id', id)
            .eq('team_id', teamId)

        if (error) {
            console.error('Errore conteggio ruoli rosa:', error)
            return
        }

        const counts: Record<string, number> = { P: 0, D: 0, C: 0, A: 0 }
        data?.forEach((item: any) => {
            if (item.role && counts[item.role] !== undefined) {
                counts[item.role]++
            }
        })

        setMyRoleCounts(counts)
    }

    // ============================================================
    // TARGET
    // ============================================================

    const loadUserTargets = async () => {
        const { data: sessionData } =
            await supabase.auth.getSession()

        if (!sessionData?.session?.user) return

        const { data: targetsData } =
            await supabase
                .from('user_targets')
                .select('player_id')
                .eq(
                    'user_id',
                    sessionData.session.user.id
                )

        if (targetsData) {
            setTargetPlayerIds(
                new Set(
                    targetsData.map(
                        (t: any) => t.player_id
                    )
                )
            )
        }
    }

    // ============================================================
    // OFFERTE
    // ============================================================

    const fetchBids = async (
        nominationId: number
    ) => {
        const { data, error } =
            await supabase
                .from('auction_bids')
                .select(
                    'id, team_id, amount, created_at'
                )
                .eq(
                    'nomination_id',
                    nominationId
                )
                .order(
                    'created_at',
                    {
                        ascending: true
                    }
                )

        if (error) {
            console.error(
                'Errore caricamento offerte:',
                error
            )
            return
        }

        setBids(data || [])
    }

    // ============================================================
    // RITIRI
    // ============================================================

    const fetchWithdrawals = async (
        nominationId: number
    ) => {
        const { data, error } =
            await supabase
                .from('auction_withdrawals')
                .select(
                    'id, team_id, created_at'
                )
                .eq(
                    'nomination_id',
                    nominationId
                )
                .order(
                    'created_at',
                    {
                        ascending: true
                    }
                )

        if (error) {
            console.error(
                'Errore caricamento ritiri:',
                error
            )
            return
        }

        const rows =
            (data || []) as WithdrawalRow[]

        const teamIds = rows.map(
            (row) => row.team_id
        )

        let teamNames: Record<string, string> = {}

        if (teamIds.length > 0) {
            const { data: teams } =
                await supabase
                    .from('league_teams')
                    .select('id, name')
                    .in('id', teamIds)

            teams?.forEach((team: any) => {
                teamNames[team.id] = team.name
            })
        }

        const enrichedRows = rows.map(
            (row) => ({
                ...row,
                teamName:
                    teamNames[row.team_id] ||
                    teamsData.find(
                        (team) =>
                            team.id ===
                            row.team_id
                    )?.name ||
                    'Squadra'
            })
        )

        setWithdrawnTeamIds(
            new Set(teamIds)
        )

        setWithdrawalMessages(
            enrichedRows
        )
    }

    // ============================================================
    // NOMINATION CORRENTE
    // ============================================================

    const fetchCurrentNomination = async () => {
        const {
            data: nomination,
            error
        } = await supabase
            .from('auction_nominations')
            .select('*, players(*)')
            .eq(
                'auction_id',
                id
            )
            .eq(
                'status',
                'in_corso'
            )
            .maybeSingle()

        if (error) {
            console.error(
                'Errore nomination:',
                error
            )
            return
        }

        setCurrentNomination(
            nomination
        )

        if (!nomination) {
            setCurrentBid(0)
            setHighestTeamId(null)
            setBids([])
            setWithdrawnTeamIds(
                new Set()
            )
            setWithdrawalMessages([])
            return
        }

        const initialBid =
            nomination.current_bid ??
            nomination.base_price ??
            1

        setCurrentBid(
            initialBid
        )

        setHighestTeamId(
            nomination.highest_bidder_team_id ||
            null
        )

        await Promise.all([
            fetchBids(
                nomination.id
            ),
            fetchWithdrawals(
                nomination.id
            )
        ])
    }

    // ============================================================
    // MIGLIOR OFFERTA ATTIVA
    // ============================================================

    const getBestActiveBid = (
        bidRows: BidRow[],
        withdrawnIds: Set<string>
    ) => {
        const bestByTeam =
            new Map<string, number>()

        for (const bid of bidRows) {
            if (
                withdrawnIds.has(
                    bid.team_id
                )
            ) {
                continue
            }

            const previous =
                bestByTeam.get(
                    bid.team_id
                ) || 0

            if (
                bid.amount >
                previous
            ) {
                bestByTeam.set(
                    bid.team_id,
                    bid.amount
                )
            }
        }

        let winningTeamId:
            string | null = null

        let winningAmount = 0

        for (
            const [
                teamId,
                amount
            ] of bestByTeam.entries()
        ) {
            if (
                amount >
                winningAmount
            ) {
                winningTeamId =
                    teamId

                winningAmount =
                    amount
            }
        }

        return {
            teamId:
                winningTeamId,
            amount:
                winningAmount
        }
    }

    // ============================================================
    // MOSTRA RISULTATO ASTA
    // ============================================================

    const showAuctionResult = async (
        nomination: any
    ) => {
        if (!nomination) return

        const playerData =
            nomination.players

        const winningTeamId =
            nomination.highest_bidder_team_id

        const winningAmount =
            nomination.current_bid ??
            nomination.base_price ??
            1

        if (!winningTeamId) return

        let winningTeamName =
            teamsData.find(
                (team) =>
                    team.id ===
                    winningTeamId
            )?.name

        if (!winningTeamName) {
            const { data: team } =
                await supabase
                    .from('league_teams')
                    .select('id, name')
                    .eq(
                        'id',
                        winningTeamId
                    )
                    .maybeSingle()

            winningTeamName =
                team?.name ||
                'Squadra'
        }

        setCongratulatedPlayer({
            name:
                playerData?.name ||
                'Giocatore',
            role:
                playerData?.role ||
                '',
            price:
                winningAmount,
            teamName:
                winningTeamName,
            isMyTeam:
                winningTeamId ===
                myTeamId
        })

        setIsCongratulationModalOpen(
            true
        )

        if (
            winningTeamId ===
            myTeamId
        ) {
            await refreshMyTeamData(
                myTeamId
            )

            if (playerData?.role) {
                await fetchRoleBudgetInfo(
                    myTeamId!,
                    playerData.role
                )
            }
            await fetchMyRoleCounts(myTeamId!)
        }
    }

    // ============================================================
    // CHIUSURA ASTA
    // ============================================================

    const finalizeAuctionItem =
        async () => {
            if (
                finalizingRef.current
            ) {
                return
            }

            finalizingRef.current =
                true

            try {
                const {
                    data:
                    freshNomination,
                    error
                } =
                    await supabase
                        .from(
                            'auction_nominations'
                        )
                        .select(
                            'id, status, player_id, current_bid, base_price, highest_bidder_team_id, players(name, role)'
                        )
                        .eq(
                            'auction_id',
                            id
                        )
                        .eq(
                            'status',
                            'in_corso'
                        )
                        .maybeSingle()

                if (error) {
                    console.error(
                        'Errore recupero asta:',
                        error
                    )
                    return
                }

                if (
                    !freshNomination
                ) {
                    return
                }

                const [
                    {
                        data:
                        freshBids
                    },
                    {
                        data:
                        freshWithdrawals
                    }
                ] =
                    await Promise.all([
                        supabase
                            .from(
                                'auction_bids'
                            )
                            .select(
                                'id, team_id, amount, created_at'
                            )
                            .eq(
                                'nomination_id',
                                freshNomination.id
                            ),

                        supabase
                            .from(
                                'auction_withdrawals'
                            )
                            .select(
                                'team_id'
                            )
                            .eq(
                                'nomination_id',
                                freshNomination.id
                            )
                    ])

                const withdrawnIds =
                    new Set<string>(
                        (
                            freshWithdrawals ||
                            []
                        ).map(
                            (row: any) =>
                                row.team_id
                        )
                    )

                const {
                    teamId:
                    winningTeamId,
                    amount:
                    winningAmount
                } =
                    getBestActiveBid(
                        (
                            freshBids ||
                            []
                        ) as BidRow[],
                        withdrawnIds
                    )

                let finalWinningTeamId =
                    winningTeamId

                let finalWinningAmount =
                    winningAmount

                const activeTeams =
                    teamsData.filter(
                        (team) =>
                            !withdrawnIds.has(
                                team.id
                            )
                    )

                if (
                    !finalWinningTeamId
                ) {
                    if (
                        activeTeams.length ===
                        1
                    ) {
                        finalWinningTeamId =
                            activeTeams[0].id

                        finalWinningAmount =
                            freshNomination
                                .base_price ||
                            1
                    } else {
                        alert(
                            'Non è possibile chiudere l’asta: non ci sono offerte valide.'
                        )

                        return
                    }
                }

                if (
                    finalWinningAmount <=
                    0
                ) {
                    finalWinningAmount =
                        freshNomination
                            .base_price ||
                        1
                }

                const {
                    error:
                    closeError
                } =
                    await supabase
                        .from(
                            'auction_nominations'
                        )
                        .update({
                            status:
                                'chiusa',
                            current_bid:
                                finalWinningAmount,
                            highest_bidder_team_id:
                                finalWinningTeamId
                        })
                        .eq(
                            'id',
                            freshNomination.id
                        )
                        .eq(
                            'status',
                            'in_corso'
                        )

                if (closeError) {
                    throw closeError
                }

                const playerId =
                    freshNomination.player_id

                const playerData =
                    freshNomination.players as any

                const playerName =
                    playerData?.name

                const playerRole =
                    playerData?.role

                const {
                    data:
                    existingTx
                } =
                    await supabase
                        .from(
                            'auction_transactions'
                        )
                        .select(
                            'id'
                        )
                        .eq(
                            'auction_id',
                            id
                        )
                        .eq(
                            'player_id',
                            playerId
                        )
                        .maybeSingle()

                if (!existingTx) {
                    const {
                        error:
                        txError
                    } =
                        await supabase
                            .from(
                                'auction_transactions'
                            )
                            .insert({
                                auction_id:
                                    id,
                                team_id:
                                    finalWinningTeamId,
                                player_id:
                                    playerId,
                                player_name:
                                    playerName,
                                role:
                                    playerRole,
                                price:
                                    finalWinningAmount
                            })

                    if (txError) {
                        throw txError
                    }

                    const {
                        error:
                        playerError
                    } =
                        await supabase
                            .from(
                                'league_team_players'
                            )
                            .insert({
                                auction_id:
                                    id,
                                team_id:
                                    finalWinningTeamId,
                                player_id:
                                    playerId,
                                player_name:
                                    playerName,
                                role:
                                    playerRole,
                                price:
                                    finalWinningAmount
                            })

                    if (
                        playerError
                    ) {
                        throw playerError
                    }

                    if (finalWinningTeamId === myTeamId) {
                        await fetchMyRoleCounts(myTeamId!);
                    }

                    const targetTeam =
                        teamsData.find(
                            (team) =>
                                team.id ===
                                finalWinningTeamId
                        )

                    if (targetTeam) {
                        const newBudget =
                            Math.max(
                                0,
                                (
                                    targetTeam.budget ||
                                    0
                                ) -
                                finalWinningAmount
                            )

                        const {
                            error:
                            budgetError
                        } =
                            await supabase
                                .from(
                                    'league_teams'
                                )
                                .update({
                                    budget:
                                        newBudget
                                })
                                .eq(
                                    'id',
                                    finalWinningTeamId
                                )

                        if (
                            budgetError
                        ) {
                            console.error(
                                'Errore aggiornamento budget:',
                                budgetError
                            )
                        }
                    }
                }

                // ============================================================
                // AVANZAMENTO TURNO E RUOLO
                // Se TUTTE le squadre hanno completato gli slot per il ruolo
                // corrente, si passa al ruolo successivo ripartendo dalla
                // prima squadra. Altrimenti si mantiene la logica esistente
                // di rotazione al turno successivo.
                // ============================================================

                let nextTurnTeamId: string | null = null
                let nextRequiredRole: string = requiredRole

                const {
                    data: roleRows,
                    error: roleRowsError
                } = await supabase
                    .from('league_team_players')
                    .select('team_id')
                    .eq('auction_id', id)
                    .eq('role', playerRole)

                if (roleRowsError) {
                    console.error(
                        'Errore conteggio ruoli per avanzamento turno:',
                        roleRowsError
                    )
                }

                const roleCountByTeam: Record<string, number> = {}
                ;(roleRows || []).forEach((row: any) => {
                    roleCountByTeam[row.team_id] =
                        (roleCountByTeam[row.team_id] || 0) + 1
                })

                const roleLimit = ROLE_LIMITS[playerRole] || 0

                const allTeamsRoleComplete =
                    teamsData.length > 0 &&
                    teamsData.every(
                        (team) =>
                            (roleCountByTeam[team.id] || 0) >= roleLimit
                    )

                if (allTeamsRoleComplete) {
                    const currentRoleIndex = ROLE_ORDER.indexOf(playerRole)
                    const upcomingRole = ROLE_ORDER[currentRoleIndex + 1]

                    if (upcomingRole) {
                        nextRequiredRole = upcomingRole
                        nextTurnTeamId = teamsData[0]?.id || null
                    } else {
                        alert(
                            'Tutte le squadre hanno completato tutti i ruoli disponibili. L’asta è conclusa.'
                        )

                        nextRequiredRole = requiredRole
                        nextTurnTeamId = null
                    }
                } else {
                    nextTurnTeamId =
                        getNextTurnTeamId(
                            currentTurnTeamId,
                            teamsData
                        )
                }

                if (nextTurnTeamId || allTeamsRoleComplete) {
                    const {
                        error:
                        turnError
                    } =
                        await supabase
                            .from(
                                'auctions'
                            )
                            .update({
                                current_turn_team_id:
                                    nextTurnTeamId,
                                required_role:
                                    nextRequiredRole
                            })
                            .eq(
                                'id',
                                id
                            )

                    if (turnError) {
                        console.error(
                            'Errore aggiornamento turno:',
                            turnError
                        )
                    } else {
                        setCurrentTurnTeamId(
                            nextTurnTeamId
                        )

                        setRequiredRole(
                            nextRequiredRole
                        )

                        setAuction(
                            (prev: any) =>
                                prev
                                    ? {
                                        ...prev,
                                        current_turn_team_id:
                                            nextTurnTeamId,
                                        required_role:
                                            nextRequiredRole
                                    }
                                    : prev
                        )
                    }
                }

                setCurrentNomination(null)
                setCurrentBid(0)
                setHighestTeamId(null)
                setBids([])
                setWithdrawnTeamIds(
                    new Set()
                )
                setWithdrawalMessages([])

                await fetchParticipantsAndTeams()
            } catch (error) {
                console.error(
                    'Errore chiusura asta:',
                    error
                )

                alert(
                    'Errore durante la chiusura dell’asta.'
                )
            } finally {
                finalizingRef.current =
                    false
            }
        }

    // ============================================================
    // RITIRO
    // ============================================================

    const handleWithdraw =
        async (options?: { silent?: boolean }) => {
            if (
                !currentNomination ||
                !myTeamId ||
                isWithdrawing
            ) {
                return
            }

            if (
                withdrawnTeamIds.has(
                    myTeamId
                )
            ) {
                return
            }

            if (!options?.silent) {
                const confirmed =
                    window.confirm(
                        'Vuoi davvero ritirarti da questa asta? Non potrai più fare offerte su questo giocatore.'
                    )

                if (!confirmed) {
                    return
                }
            }

            setIsWithdrawing(true)

            try {
                const {
                    error
                } =
                    await supabase
                        .from(
                            'auction_withdrawals'
                        )
                        .insert({
                            auction_id:
                                id,
                            nomination_id:
                                currentNomination.id,
                            team_id:
                                myTeamId
                        })

                if (error) {
                    if (
                        error.code ===
                        '23505'
                    ) {
                        return
                    }

                    throw error
                }

                const myTeamName =
                    teamsData.find(
                        (team) =>
                            team.id ===
                            myTeamId
                    )?.name ||
                    'Squadra'

                const nextWithdrawn =
                    new Set(
                        withdrawnTeamIds
                    )

                nextWithdrawn.add(
                    myTeamId
                )

                setWithdrawnTeamIds(
                    nextWithdrawn
                )

                setWithdrawalMessages(
                    (prev) => [
                        ...prev,
                        {
                            id:
                                Date.now(),
                            team_id:
                                myTeamId,
                            created_at:
                                new Date().toISOString(),
                            teamName:
                                myTeamName
                        }
                    ]
                )

                const activeTeams =
                    teamsData.filter(
                        (team) =>
                            !nextWithdrawn.has(
                                team.id
                            )
                    )

                if (
                    activeTeams.length ===
                    1
                ) {
                    await finalizeAuctionItem()
                }
            } catch (error) {
                console.error(
                    'Errore ritiro:',
                    error
                )

                alert(
                    'Non è stato possibile ritirarsi dall’asta.'
                )
            } finally {
                setIsWithdrawing(
                    false
                )
            }
        }

    // ============================================================
    // NUOVA CHIAMATA
    // ============================================================

    const handleNominatePlayer =
        async (
            playerId: number, playerRole: string
        ) => {
            const currentCount = myRoleCounts[playerRole] || 0;
            const limit = ROLE_LIMITS[playerRole];

            if (currentCount >= limit) {
                alert(`Hai raggiunto il limite massimo di ${limit} per il ruolo ${ROLE_NAMES[playerRole]}. Il turno passa alla prossima squadra.`);

                const nextTeamId = getNextTurnTeamId(myTeamId, teamsData);
                await supabase.from('auctions').update({ current_turn_team_id: nextTeamId }).eq('id', id);
                return;
            }

            if (
                isSubmitting
            ) {
                return
            }

            if (
                !myTeamId ||
                currentTurnTeamId !==
                myTeamId
            ) {
                alert(
                    'Non è il tuo turno di chiamata.'
                )

                return
            }

            if (
                currentNomination
            ) {
                alert(
                    'C’è già un giocatore all’asta.'
                )

                return
            }

            const basePrice =
                parseInt(
                    basePriceValue
                )

            if (
                isNaN(basePrice) ||
                basePrice < 1
            ) {
                alert(
                    'Il prezzo base deve essere almeno 1 CR.'
                )

                return
            }

            setIsSubmitting(
                true
            )

            try {
                const {
                    error
                } =
                    await supabase.rpc(
                        'nominate_player',
                        {
                            p_auction_id:
                                id,
                            p_player_id:
                                playerId
                        }
                    )

                if (error) {
                    throw error
                }

                const {
                    data:
                    newNomination,
                    error:
                    nominationError
                } =
                    await supabase
                        .from(
                            'auction_nominations'
                        )
                        .select(
                            'id'
                        )
                        .eq(
                            'auction_id',
                            id
                        )
                        .eq(
                            'player_id',
                            playerId
                        )
                        .eq(
                            'status',
                            'in_corso'
                        )
                        .maybeSingle()

                if (
                    nominationError ||
                    !newNomination
                ) {
                    throw (
                        nominationError ||
                        new Error(
                            'Impossibile recuperare la nuova asta.'
                        )
                    )
                }

                const {
                    error:
                    priceError
                } =
                    await supabase
                        .from(
                            'auction_nominations'
                        )
                        .update({
                            base_price:
                                basePrice,
                            current_bid:
                                basePrice,
                            highest_bidder_team_id:
                                myTeamId
                        })
                        .eq(
                            'id',
                            newNomination.id
                        )

                if (priceError) {
                    throw priceError
                }

                const {
                    error:
                    bidError
                } =
                    await supabase
                        .from(
                            'auction_bids'
                        )
                        .insert({
                            auction_id:
                                id,
                            nomination_id:
                                newNomination.id,
                            team_id:
                                myTeamId,
                            amount:
                                basePrice
                        })

                if (bidError) {
                    throw bidError
                }

                setBids([])
                setWithdrawnTeamIds(
                    new Set()
                )
                setWithdrawalMessages(
                    []
                )

                setIsNominateModalOpen(
                    false
                )

                setBasePriceValue(
                    '1'
                )

                await fetchCurrentNomination()
            } catch (error) {
                console.error(
                    'Errore chiamata:',
                    error
                )

                alert(
                    'Errore durante la chiamata del giocatore. Riprova.'
                )
            } finally {
                setIsSubmitting(
                    false
                )
            }
        }

    // ============================================================
    // OFFERTA
    // ============================================================

    const handlePlaceBid =
        async (
            newAmount: number,
            skipRoleBudgetWarning = false
        ) => {
            if (
                !currentNomination ||
                !myTeamId
            ) {
                return
            }

            if (
                withdrawnTeamIds.has(
                    myTeamId
                )
            ) {
                alert(
                    'Ti sei ritirato da questa asta.'
                )

                return
            }

            if (
                highestTeamId ===
                myTeamId
            ) {
                alert(
                    'Sei già in vantaggio: non puoi rilanciare contro la tua stessa offerta.'
                )

                return
            }

            if (
                newAmount <=
                currentBid
            ) {
                alert(
                    "L'offerta deve essere superiore all'offerta corrente!"
                )

                return
            }

            if (
                newAmount >
                myBudget
            ) {
                alert(
                    "Non hai abbastanza Crediti (CR) per effettuare questa offerta!"
                )

                return
            }

            if (
                myRoleBudget !== null &&
                !skipRoleBudgetWarning
            ) {
                const myPreviousBestBid =
                    bids
                        .filter(
                            (bid) =>
                                bid.team_id ===
                                myTeamId
                        )
                        .reduce(
                            (
                                max,
                                bid
                            ) =>
                                Math.max(
                                    max,
                                    bid.amount
                                ),
                            0
                        )

                const effectiveCostDelta =
                    newAmount -
                    myPreviousBestBid

                const roleBudgetRemaining =
                    myRoleBudget -
                    myRoleSpent

                if (
                    effectiveCostDelta >
                    roleBudgetRemaining
                ) {
                    const exceededAmount =
                        effectiveCostDelta -
                        roleBudgetRemaining

                    setPendingBidAmount(
                        newAmount
                    )

                    setPendingRoleBudgetExceeded(
                        exceededAmount
                    )

                    setIsRoleBudgetWarningOpen(
                        true
                    )

                    return
                }
            }

            const {
                data:
                bidRow,
                error:
                bidInsertError
            } =
                await supabase
                    .from(
                        'auction_bids'
                    )
                    .insert({
                        auction_id:
                            id,
                        nomination_id:
                            currentNomination.id,
                        team_id:
                            myTeamId,
                        amount:
                            newAmount
                    })
                    .select(
                        'id, team_id, amount, created_at'
                    )
                    .single()

            if (
                bidInsertError
            ) {
                console.error(
                    'Errore inserimento offerta:',
                    bidInsertError
                )

                alert(
                    "Errore durante l'offerta. Riprova."
                )

                return
            }

            if (bidRow) {
                setBids(
                    (prev) => [
                        ...prev,
                        bidRow as BidRow
                    ]
                )
            }

            const {
                error:
                nominationError
            } =
                await supabase
                    .from(
                        'auction_nominations'
                    )
                    .update({
                        current_bid:
                            newAmount,
                        highest_bidder_team_id:
                            myTeamId
                    })
                    .eq(
                        'id',
                        currentNomination.id
                    )

            if (
                nominationError
            ) {
                console.error(
                    'Errore aggiornamento nomination:',
                    nominationError
                )

                alert(
                    "L'offerta è stata salvata nello storico, ma non è stato possibile aggiornare l'asta."
                )

                return
            }

            setCurrentBid(
                newAmount
            )

            setHighestTeamId(
                myTeamId
            )

            setCustomBidValue('')
        }

    const confirmRoleBudgetBid = async () => {
        if (pendingBidAmount === null) {
            return
        }

        const amount = pendingBidAmount

        setIsRoleBudgetWarningOpen(false)
        setPendingBidAmount(null)
        setPendingRoleBudgetExceeded(0)

        await handlePlaceBid(
            amount,
            true
        )
    }

    // ============================================================
    // INIT
    // ============================================================

    useEffect(() => {
        if (!id) return

        let isMounted = true

        const initId =
            ++initSequenceRef.current

        const channelTopic =
            `auction-room-${id}`

        async function initAuctionRoom() {
            const {
                data: {
                    session
                }
            } =
                await supabase.auth.getSession()

            if (
                !session?.user
            ) {
                router.push(
                    '/login'
                )

                return
            }

            const {
                data: profile
            } =
                await supabase
                    .from(
                        'profiles'
                    )
                    .select(
                        'role'
                    )
                    .eq(
                        'id',
                        session.user.id
                    )
                    .maybeSingle()

            if (
                !isMounted ||
                initId !==
                initSequenceRef.current
            ) {
                return
            }

            const admin =
                profile?.role ===
                'admin'

            setIsAdmin(
                admin
            )

            await loadUserTargets()

            const {
                data:
                auctionData
            } =
                await supabase
                    .from(
                        'auctions'
                    )
                    .select('*')
                    .eq(
                        'id',
                        id
                    )
                    .maybeSingle()

            if (
                !auctionData
            ) {
                router.push(
                    '/'
                )

                return
            }

            setAuction(
                auctionData
            )

            const initialRole =
                auctionData.required_role ||
                'P'

            setRequiredRole(
                initialRole
            )

            setCurrentTurnTeamId(
                auctionData.current_turn_team_id ||
                null
            )

            const {
                data:
                realTeams
            } =
                await supabase
                    .from(
                        'teams'
                    )
                    .select('*')

            if (
                realTeams &&
                isMounted
            ) {
                setRealTeamsData(
                    realTeams
                )
            }


            const {
                data:
                teamData
            } =
                await supabase
                    .from(
                        'league_teams'
                    )
                    .select(
                        'id, budget'
                    )
                    .eq(
                        'user_id',
                        session.user.id
                    )
                    .maybeSingle()

            if (
                teamData &&
                isMounted
            ) {
                setMyTeamId(
                    teamData.id
                )

                setMyBudget(
                    teamData.budget ||
                    0
                )

                await fetchRoleBudgetInfo(
                    teamData.id,
                    initialRole
                )
                await fetchMyRoleCounts(teamData.id)
            }

            const fetchedTeams =
                await fetchParticipantsAndTeams()

            let activeTurnId =
                auctionData.current_turn_team_id

            if (
                !activeTurnId &&
                fetchedTeams.length >
                0
            ) {
                activeTurnId =
                    fetchedTeams[0]?.id

                await supabase
                    .from(
                        'auctions'
                    )
                    .update({
                        current_turn_team_id:
                            activeTurnId
                    })
                    .eq(
                        'id',
                        id
                    )
            }

            setCurrentTurnTeamId(
                activeTurnId ||
                null
            )

            await fetchCurrentNomination()

            setLoading(
                false
            )

            const existingChannel =
                supabase
                    .getChannels()
                    .find(
                        (ch: any) =>
                            ch.topic ===
                            `realtime:${channelTopic}`
                    )

            if (
                existingChannel
            ) {
                await supabase.removeChannel(
                    existingChannel
                )
            }

            if (
                !isMounted ||
                initId !==
                initSequenceRef.current
            ) {
                return
            }

            const channel =
                supabase
                    .channel(
                        channelTopic
                    )
                    .on(
                        'postgres_changes',
                        {
                            event:
                                '*',
                            schema:
                                'public',
                            table:
                                'auctions',
                            filter:
                                `id=eq.${id}`
                        },
                        async (
                            payload: any
                        ) => {
                            if (
                                !payload.new ||
                                !isMounted
                            ) {
                                return
                            }

                            const previousTurn =
                                currentTurnTeamId

                            const newTurn =
                                payload.new
                                    .current_turn_team_id ||
                                null

                            setAuction(
                                payload.new
                            )

                            setCurrentTurnTeamId(
                                newTurn
                            )

                            const newRole =
                                payload.new
                                    .required_role ||
                                'P'

                            setRequiredRole(
                                newRole
                            )

                            if (
                                teamData?.id
                            ) {
                                await fetchRoleBudgetInfo(
                                    teamData.id,
                                    newRole
                                )
                            }

                            if (
                                isCongratulationModalOpen &&
                                newTurn !==
                                previousTurn
                            ) {
                                setIsCongratulationModalOpen(
                                    false
                                )

                                setCongratulatedPlayer(
                                    null
                                )

                                await fetchCurrentNomination()
                            }
                        }
                    )
                    .on(
                        'postgres_changes',
                        {
                            event:
                                '*',
                            schema:
                                'public',
                            table:
                                'auction_nominations',
                            filter:
                                `auction_id=eq.${id}`
                        },
                        async (
                            payload: any
                        ) => {
                            if (
                                !isMounted
                            ) {
                                return
                            }

                            if (
                                payload.new?.status ===
                                'in_corso'
                            ) {
                                await fetchCurrentNomination()
                                return
                            }

                            if (
                                payload.new?.status ===
                                'chiusa'
                            ) {
                                const {
                                    data:
                                    closedNomination
                                } =
                                    await supabase
                                        .from(
                                            'auction_nominations'
                                        )
                                        .select(
                                            'id, player_id, current_bid, base_price, highest_bidder_team_id, status, players(*)'
                                        )
                                        .eq(
                                            'id',
                                            payload.new.id
                                        )
                                        .maybeSingle()

                                if (
                                    closedNomination &&
                                    closedNomination.highest_bidder_team_id
                                ) {
                                    await showAuctionResult(
                                        closedNomination
                                    )
                                }

                                setCurrentNomination(
                                    null
                                )

                                setCurrentBid(
                                    0
                                )

                                setHighestTeamId(
                                    null
                                )

                                setBids(
                                    []
                                )

                                setWithdrawnTeamIds(
                                    new Set()
                                )

                                setWithdrawalMessages(
                                    []
                                )

                                await fetchParticipantsAndTeams()

                                if (
                                    teamData?.id
                                ) {
                                    await refreshMyTeamData(
                                        teamData.id
                                    )

                                    await fetchMyRoleCounts(
                                        teamData.id
                                    )
                                }
                            }
                        }
                    )
                    .on(
                        'postgres_changes',
                        {
                            event:
                                '*',
                            schema:
                                'public',
                            table:
                                'auction_bids',
                            filter:
                                `auction_id=eq.${id}`
                        },
                        async () => {
                            if (
                                !isMounted
                            ) {
                                return
                            }

                            const {
                                data:
                                nomination
                            } =
                                await supabase
                                    .from(
                                        'auction_nominations'
                                    )
                                    .select(
                                        'id'
                                    )
                                    .eq(
                                        'auction_id',
                                        id
                                    )
                                    .eq(
                                        'status',
                                        'in_corso'
                                    )
                                    .maybeSingle()

                            if (
                                nomination
                            ) {
                                await fetchBids(
                                    nomination.id
                                )

                                await fetchCurrentNomination()
                            }
                        }
                    )
                    .on(
                        'postgres_changes',
                        {
                            event:
                                '*',
                            schema:
                                'public',
                            table:
                                'auction_withdrawals',
                            filter:
                                `auction_id=eq.${id}`
                        },
                        async () => {
                            if (
                                !isMounted
                            ) {
                                return
                            }

                            const {
                                data:
                                nomination
                            } =
                                await supabase
                                    .from(
                                        'auction_nominations'
                                    )
                                    .select(
                                        'id'
                                    )
                                    .eq(
                                        'auction_id',
                                        id
                                    )
                                    .eq(
                                        'status',
                                        'in_corso'
                                    )
                                    .maybeSingle()

                            if (
                                nomination
                            ) {
                                await fetchWithdrawals(
                                    nomination.id
                                )
                            }
                        }
                    )
                    .on(
                        'postgres_changes',
                        {
                            event:
                                '*',
                            schema:
                                'public',
                            table:
                                'league_teams'
                        },
                        async (
                            payload: any
                        ) => {
                            if (
                                !isMounted
                            ) {
                                return
                            }

                            if (
                                payload.new
                            ) {
                                setTeamsData(
                                    (prev) => {
                                        const exists =
                                            prev.some(
                                                (
                                                    team
                                                ) =>
                                                    team.id ===
                                                    payload
                                                        .new
                                                        .id
                                            )

                                        if (
                                            exists
                                        ) {
                                            return prev.map(
                                                (
                                                    team
                                                ) =>
                                                    team.id ===
                                                        payload
                                                            .new
                                                            .id
                                                        ? {
                                                            ...team,
                                                            ...payload.new
                                                        }
                                                        : team
                                            )
                                        }

                                        return prev
                                    }
                                )

                                if (
                                    payload.new
                                        .id ===
                                    teamData?.id
                                ) {
                                    setMyBudget(
                                        payload.new
                                            .budget ||
                                        0
                                    )

                                    await fetchRoleBudgetInfo(
                                        payload.new
                                            .id,
                                        requiredRole
                                    )
                                }
                            }
                        }
                    )
                    .on(
                        'broadcast',
                        {
                            event: 'auction_continue'
                        },
                        async ({ payload }) => {
                            if (!isMounted) {
                                return
                            }

                            setIsCongratulationModalOpen(false)
                            setCongratulatedPlayer(null)

                            await fetchCurrentNomination()

                            if (teamData?.id) {
                                await fetchMyRoleCounts(teamData.id)
                            }
                        }
                    )

            auctionChannelRef.current =
                channel

            await channel.subscribe()
        }

        initAuctionRoom()

        return () => {
            isMounted =
                false

            initSequenceRef.current++

            if (
                auctionChannelRef.current
            ) {
                supabase.removeChannel(
                    auctionChannelRef.current
                )

                auctionChannelRef.current =
                    null
            }
        }
    }, [id, router])

    // ============================================================
    // CARICAMENTO GIOCATORI
    // ============================================================

    useEffect(() => {
        async function loadPlayers() {
            if (
                !isNominateModalOpen
            ) {
                return
            }

            await loadUserTargets()

            const {
                data:
                assignedData
            } =
                await supabase
                    .from(
                        'league_team_players'
                    )
                    .select(
                        'player_id'
                    )
                    .eq(
                        'auction_id',
                        id
                    )

            const assignedPlayerIds =
                new Set(
                    assignedData
                        ?.map(
                            (
                                item: any
                            ) =>
                                item.player_id
                        )
                        .filter(
                            Boolean
                        ) || []
                )

            let query =
                supabase
                    .from(
                        'players'
                    )
                    .select('*')
                    .eq('is_out',false)
                    .order(
                        'name',
                        {
                            ascending:
                                true
                        }
                    )

            if (
                requiredRole
            ) {
                query =
                    query.eq(
                        'role',
                        requiredRole
                    )
            }

            const {
                data,
                error
            } = await query

            if (
                !error &&
                data
            ) {
                const unassignedPlayers =
                    data.filter(
                        (p: any) =>
                            !assignedPlayerIds.has(
                                p.id
                            )
                    )

                const uniqueTeams =
                    Array.from(
                        new Set(
                            unassignedPlayers
                                .map(
                                    (
                                        p: any
                                    ) =>
                                        p.team
                                )
                                .filter(
                                    Boolean
                                )
                        )
                    ) as string[]

                setAvailableTeamsList(
                    uniqueTeams.sort()
                )

                let filtered =
                    unassignedPlayers

                if (
                    searchQuery.trim()
                ) {
                    filtered =
                        filtered.filter(
                            (
                                p: any
                            ) =>
                                p.name
                                    .toLowerCase()
                                    .includes(
                                        searchQuery
                                            .toLowerCase()
                                    )
                        )
                }

                if (
                    selectedTeamFilter
                ) {
                    filtered =
                        filtered.filter(
                            (
                                p: any
                            ) =>
                                p.team ===
                                selectedTeamFilter
                        )
                }

                if (
                    onlyTargets
                ) {
                    filtered =
                        filtered.filter(
                            (
                                p: any
                            ) =>
                                targetPlayerIds.has(
                                    p.id
                                )
                        )
                }

                setAvailablePlayers(
                    filtered
                )
            }
        }

        loadPlayers()
    }, [
        isNominateModalOpen,
        requiredRole,
        searchQuery,
        selectedTeamFilter,
        onlyTargets,
        id
    ])

    // ============================================================
    // DATI UI
    // ============================================================

    const currentTurnTeamName =
        teamsData.find(
            (team) =>
                team.id ===
                currentTurnTeamId
        )?.name ||
        'Nessuna squadra'

    const highestBidderName =
        teamsData.find(
            (team) =>
                team.id ===
                highestTeamId
        )?.name ||
        'Nessuno'

    const roleDisplay =
        ROLE_NAMES[
        requiredRole
        ] || requiredRole

    const isRoleBudgetExceeded =
        myRoleBudget !== null &&
        myRoleSpent > myRoleBudget

    // ============================================================
    // TURNO E DISABILITAZIONE PULSANTI RILANCIO
    // ============================================================

    const currentRoleCode = currentNomination?.players?.role || requiredRole
    const currentRoleCount = myRoleCounts[currentRoleCode] || 0
    const currentRoleLimit = ROLE_LIMITS[currentRoleCode] || 99
    const isRoleFull = currentRoleCount >= currentRoleLimit

    // ============================================================
    // RITIRO AUTOMATICO SE RUOLO GIÀ ESAURITO
    // Se la mia squadra ha già completato gli slot per il ruolo
    // della chiamata in corso, non sono un partecipante attivo per
    // questa nomination: mi ritiro in automatico (stesso meccanismo
    // del ritiro manuale) invece di dover cliccare "Ritirati dall'asta".
    // ============================================================

    useEffect(() => {
        if (!currentNomination || !myTeamId) {
            return
        }

        if (withdrawnTeamIds.has(myTeamId)) {
            return
        }

        if (isRoleFull) {
            handleWithdraw({ silent: true })
        }
    }, [currentNomination?.id, myTeamId, isRoleFull, withdrawnTeamIds])

    const canNominate =
        !!myTeamId &&
        !!currentTurnTeamId &&
        currentTurnTeamId ===
        myTeamId &&
        !currentNomination

    const hasWithdrawn =
        !!myTeamId &&
        withdrawnTeamIds.has(
            myTeamId
        )

    const activeTeams =
        teamsData.filter(
            (team) =>
                !withdrawnTeamIds.has(
                    team.id
                )
        )

    const amHighestBidder =
        !!myTeamId &&
        highestTeamId ===
        myTeamId

    // ============================================================
    // RENDER
    // ============================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8 flex flex-col">

            {/* HEADER */}

            <header className="max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between pb-6 border-b border-slate-800 gap-3">

                <h1 className="text-lg font-black uppercase flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-blue-500" />
                    Asta Live
                </h1>

                <div className="flex items-center gap-2">

                    {myRoleBudget !== null && (
                        <div
                            className={`px-3 py-1 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-all ${isRoleBudgetExceeded
                                ? 'bg-red-500/15 border border-red-500/50 text-red-400 animate-pulse'
                                : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'
                                }`}
                        >
                            <Wallet className="w-3.5 h-3.5" />

                            Budget {roleDisplay}:{' '}

                            <span className="font-black">
                                {myRoleBudget - myRoleSpent} CR
                            </span>

                            <span
                                className={`font-normal ${isRoleBudgetExceeded
                                    ? 'text-red-300'
                                    : 'text-slate-500'
                                    }`}
                            >
                                / {myRoleBudget}
                            </span>
                        </div>
                    )}

                    <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs font-black uppercase">
                        Budget Tot:{' '}
                        {myBudget} CR
                    </div>

                    <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-black uppercase flex items-center gap-2">
                        <span>ROSA: {(myRoleCounts.P + myRoleCounts.D + myRoleCounts.C + myRoleCounts.A)}/25</span>
                        <span className="text-slate-500 font-normal">|</span>
                        <span className="text-[10px] text-slate-300">
                            P:{myRoleCounts.P} D:{myRoleCounts.D} C:{myRoleCounts.C} A:{myRoleCounts.A}
                        </span>
                    </div>

                </div>

            </header>

            {/* MAIN */}

            <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 py-6 flex-1">

                <div className="lg:col-span-2 space-y-6">

                    {currentNomination ? (
                        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 md:p-8 space-y-6">

                            {/* GIOCATORE */}

                            <div className="flex justify-between items-start gap-4">

                                <div>

                                    <div className="flex items-center gap-2 flex-wrap">

                                        <span className="text-xs font-bold uppercase px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg">
                                            {
                                                ROLE_NAMES[
                                                currentNomination
                                                    .players
                                                    ?.role
                                                ] ||
                                                currentNomination
                                                    .players
                                                    ?.role
                                            }
                                        </span>

                                        {targetPlayerIds.has(
                                            currentNomination
                                                .players
                                                ?.id
                                        ) && (
                                                <span className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-extrabold rounded-full uppercase tracking-wider">
                                                    ⭐ Obiettivo
                                                </span>
                                            )}

                                        {targetPlayerIds.has(
                                            currentNomination
                                                .players
                                                ?.id
                                        ) && (
                                                <span
                                                    className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-700/60 flex items-center gap-1 ${currentBid > currentNomination.players.fvm ? 'animate-pulse text-red-400 border-red-500 bg-red-950/80' : ''
                                                        }`}
                                                >
                                                    💎 Fanta-valore Medio: {currentNomination.players.fvm}
                                                </span>
                                            )}

                                    </div>

                                    <h2 className="text-3xl font-black uppercase text-white mt-3">
                                        {
                                            currentNomination
                                                .players
                                                ?.name
                                        }
                                    </h2>

                                    <p className="text-slate-400 text-xs mt-2">
                                        Chiamato da{' '}
                                        <span className="text-amber-400 font-bold">
                                            {
                                                currentTurnTeamName
                                            }
                                        </span>
                                    </p>

                                </div>

                                <div className="text-right">
                                    <span className="text-xs text-slate-400 uppercase font-semibold">
                                        Offerta
                                    </span>

                                    <span className="text-5xl font-black text-amber-400 block">
                                        {
                                            currentBid
                                        }{' '}
                                        CR
                                    </span>
                                </div>

                            </div>

                            {/* STATO ASTA */}

                            <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 flex-wrap gap-2">

                                <div className="text-xs font-bold text-slate-300 uppercase">
                                    In vantaggio:{' '}
                                    <span className="text-white font-black">
                                        {
                                            highestBidderName
                                        }
                                    </span>
                                </div>

                                <div className="text-xs font-black text-slate-400 bg-slate-800 px-3 py-1 rounded-lg">
                                    Squadre ancora in gara:{' '}
                                    {
                                        activeTeams.length
                                    }
                                </div>

                            </div>

                            {/* RITIRI */}

                            {withdrawalMessages.length >
                                0 && (
                                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">

                                        <div className="flex items-center gap-2 text-xs font-black uppercase text-red-300 mb-3">
                                            <LogOut className="w-4 h-4" />
                                            Ritiri
                                        </div>

                                        <div className="space-y-2">

                                            {withdrawalMessages.map(
                                                (
                                                    message
                                                ) => (
                                                    <div
                                                        key={
                                                            message.id
                                                        }
                                                        className="text-sm text-slate-300"
                                                    >
                                                        🔥{' '}
                                                        <span className="font-black text-white">
                                                            {
                                                                message.teamName
                                                            }
                                                        </span>{' '}
                                                        si è ritirata
                                                        dall'asta
                                                    </div>
                                                )
                                            )}

                                        </div>

                                    </div>
                                )}

                            {/* OFFERTE */}

                            {bids.length >
                                0 && (
                                    <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">

                                        <h3 className="text-xs font-black uppercase text-slate-400 mb-3">
                                            Ultime offerte
                                        </h3>

                                        <div className="space-y-2 max-h-40 overflow-y-auto">

                                            {bids
                                                .slice()
                                                .reverse()
                                                .map(
                                                    (
                                                        bid
                                                    ) => {
                                                        const team =
                                                            teamsData.find(
                                                                (
                                                                    t
                                                                ) =>
                                                                    t.id ===
                                                                    bid.team_id
                                                            )

                                                        const withdrawn =
                                                            withdrawnTeamIds.has(
                                                                bid.team_id
                                                            )

                                                        return (
                                                            <div
                                                                key={
                                                                    bid.id
                                                                }
                                                                className={`flex justify-between items-center text-xs ${withdrawn
                                                                    ? 'opacity-40 line-through'
                                                                    : ''
                                                                    }`}
                                                            >

                                                                <span className="font-bold">
                                                                    {
                                                                        team?.name ||
                                                                        'Squadra'
                                                                    }
                                                                </span>

                                                                <span className="font-black text-amber-400">
                                                                    {
                                                                        bid.amount
                                                                    }{' '}
                                                                    CR
                                                                </span>

                                                            </div>
                                                        )
                                                    }
                                                )}

                                        </div>

                                    </div>
                                )}

                            {/* MESSAGGIO SLOT PIENI */}
                            {isRoleFull && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
                                    <p className="text-xs font-black uppercase text-amber-400">
                                        ⚠️ Hai esaurito gli slot disponibili per questo ruolo ({currentRoleCount}/{currentRoleLimit}). Rilanci disabilitati.
                                    </p>
                                </div>
                            )}

                            {/* BOTTONI ASTA */}

                            {!hasWithdrawn ? (
                                <>
                                    {amHighestBidder ? (
                                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center">

                                            <div className="text-emerald-400 text-sm font-black uppercase">
                                                Sei in vantaggio
                                            </div>

                                            <p className="text-xs text-slate-400 mt-1">
                                                Non puoi rilanciare
                                                contro la tua stessa
                                                offerta.
                                            </p>

                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-3 gap-3">

                                                <button
                                                    disabled={isRoleFull}
                                                    onClick={() =>
                                                        handlePlaceBid(
                                                            currentBid +
                                                            1
                                                        )
                                                    }
                                                    className="py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold uppercase text-sm transition"
                                                >
                                                    +1
                                                </button>

                                                <button
                                                    disabled={isRoleFull}
                                                    onClick={() =>
                                                        handlePlaceBid(
                                                            currentBid +
                                                            5
                                                        )
                                                    }
                                                    className="py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold uppercase text-sm transition"
                                                >
                                                    +5
                                                </button>

                                                <button
                                                    disabled={isRoleFull}
                                                    onClick={() =>
                                                        handlePlaceBid(
                                                            currentBid +
                                                            10
                                                        )
                                                    }
                                                    className="py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold uppercase text-sm transition"
                                                >
                                                    +10
                                                </button>

                                            </div>

                                            <div className="flex gap-2 pt-2 border-t border-slate-700/50">

                                                <input
                                                    type="number"
                                                    disabled={isRoleFull}
                                                    placeholder={isRoleFull ? "Slot ruolo esauriti" : `Offerta personalizzata (> ${currentBid})`}
                                                    value={
                                                        customBidValue
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        setCustomBidValue(
                                                            e
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className="flex-1 bg-slate-900 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                                                />

                                                <button
                                                    disabled={isRoleFull}
                                                    onClick={() => {
                                                        const value =
                                                            parseInt(
                                                                customBidValue
                                                            )

                                                        if (
                                                            isNaN(
                                                                value
                                                            ) ||
                                                            value <=
                                                            currentBid
                                                        ) {
                                                            alert(
                                                                "L'offerta deve essere superiore all'offerta corrente!"
                                                            )

                                                            return
                                                        }

                                                        handlePlaceBid(
                                                            value
                                                        )
                                                    }}
                                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-black text-xs uppercase transition"
                                                >
                                                    Rilancia
                                                </button>

                                            </div>
                                        </>
                                    )}

                                    <button
                                        onClick={
                                            () => handleWithdraw()
                                        }
                                        disabled={
                                            isWithdrawing
                                        }
                                        className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded-xl font-black text-xs uppercase transition flex items-center justify-center gap-2"
                                    >
                                        <LogOut className="w-4 h-4" />

                                        {isWithdrawing
                                            ? 'Ritiro...'
                                            : "Ritirati dall'asta"}
                                    </button>

                                </>
                            ) : (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-center">

                                    <LogOut className="w-8 h-8 text-red-400 mx-auto mb-2" />

                                    <p className="text-sm font-black uppercase text-red-300">
                                        Ti sei ritirato
                                        dall'asta
                                    </p>

                                    <p className="text-xs text-slate-400 mt-1">
                                        Non puoi più fare
                                        offerte su questo
                                        giocatore.
                                    </p>

                                </div>
                            )}

                            {/* ADMIN */}

                            {isAdmin && (
                                <div className="pt-4 border-t border-slate-700/50">

                                    <button
                                        onClick={async () => {
                                            if (
                                                isClosingAuction
                                            ) {
                                                return
                                            }

                                            const confirmed =
                                                window.confirm(
                                                    'Vuoi chiudere definitivamente questa asta?'
                                                )

                                            if (
                                                !confirmed
                                            ) {
                                                return
                                            }

                                            setIsClosingAuction(
                                                true
                                            )

                                            try {
                                                await finalizeAuctionItem()
                                            } finally {
                                                setIsClosingAuction(
                                                    false
                                                )
                                            }
                                        }}
                                        disabled={
                                            isClosingAuction
                                        }
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-black text-xs uppercase transition"
                                    >
                                        {isClosingAuction
                                            ? 'Chiusura...'
                                            : 'Chiudi asta'}
                                    </button>

                                </div>
                            )}

                        </div>
                    ) : (
                        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-12 text-center space-y-4">

                            <h3 className="text-xl font-black uppercase">
                                {canNominate && (myRoleCounts[requiredRole] || 0) >= ROLE_LIMITS[requiredRole]
                                    ? "Hai completato gli slot per il ruolo"
                                    : "In attesa della chiamata"
                                }
                            </h3>

                            <p className="text-xs text-slate-400">
                                {canNominate && (myRoleCounts[requiredRole] || 0) >= ROLE_LIMITS[requiredRole] ? (
                                    <span>
                                        Hai esaurito i posti disponibili per il ruolo di <span className="text-white font-bold">{roleDisplay}</span>. Puoi passare il turno.
                                    </span>
                                ) : (
                                    <span>
                                        È il turno di{' '}
                                        <span className="text-amber-400 font-bold">
                                            {currentTurnTeamName}
                                        </span>{' '}
                                        di chiamare un{' '}
                                        <span className="text-white font-bold">
                                            {roleDisplay}
                                        </span>.
                                    </span>
                                )}
                            </p>

                            {canNominate && (myRoleCounts[requiredRole] || 0) < ROLE_LIMITS[requiredRole] ? (
                                <button
                                    onClick={() =>
                                        setIsNominateModalOpen(true)
                                    }
                                    className="mt-4 px-6 py-3 bg-blue-600 rounded-xl font-black text-xs uppercase hover:bg-blue-500 transition"
                                >
                                    Chiama {roleDisplay}
                                </button>
                            ) : canNominate ? (
                                <div className="mt-4">
                                    <button
                                        onClick={() => handlePassTurn()}
                                        className="px-6 py-3 bg-amber-600 rounded-xl font-black text-xs uppercase hover:bg-amber-500 transition text-white"
                                    >
                                        Passa il turno
                                    </button>
                                </div>
                            ) : null}

                        </div>
                    )}

                </div>

                {/* PARTECIPANTI */}

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-4">

                    <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Partecipanti
                    </h3>

                    {teamsData.map(
                        (team) => {
                            const withdrawn =
                                withdrawnTeamIds.has(
                                    team.id
                                )

                            return (
                                <div
                                    key={
                                        team.id
                                    }
                                    className={`p-3 rounded-xl border flex justify-between items-center ${withdrawn
                                        ? 'bg-red-500/5 border-red-500/20 opacity-60'
                                        : team.id ===
                                            currentTurnTeamId
                                            ? 'bg-amber-500/10 border-amber-500/50'
                                            : 'bg-slate-800/80 border-slate-700'
                                        }`}
                                >

                                    <div>

                                        <span className="font-bold text-xs">
                                            {
                                                team.name
                                            }
                                        </span>

                                        {withdrawn && (
                                            <span className="text-[10px] uppercase font-black text-red-400 block mt-1">
                                                Ritirata
                                            </span>
                                        )}

                                        {team.id ===
                                            currentTurnTeamId && (
                                                <span className="text-[10px] uppercase font-black text-amber-400 block mt-1">
                                                    Turno di chiamata
                                                </span>
                                            )}

                                    </div>

                                    <span className="text-xs font-black text-amber-400">
                                        {
                                            team.budget
                                        }{' '}
                                        CR
                                    </span>

                                </div>
                            )
                        }
                    )}

                </div>

            </main>

            {/* ===================================================
    WARNING BUDGET RUOLO
=================================================== */}

            {isRoleBudgetWarningOpen &&
                pendingBidAmount !== null && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="w-full max-w-md bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl p-6">

                            <div className="flex items-center gap-3 mb-5">

                                <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                                    <Wallet className="w-5 h-5 text-red-400" />
                                </div>

                                <div>
                                    <h2 className="text-lg font-black text-white uppercase">
                                        Budget ruolo superato
                                    </h2>

                                    <p className="text-xs text-slate-400 font-bold uppercase">
                                        {ROLE_NAMES[requiredRole]}
                                    </p>
                                </div>

                            </div>

                            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 mb-5 space-y-3">

                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">
                                        Budget impostato
                                    </span>

                                    <span className="text-white font-black">
                                        {myRoleBudget} CR
                                    </span>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">
                                        Già spesi
                                    </span>

                                    <span className="text-white font-black">
                                        {myRoleSpent} CR
                                    </span>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">
                                        Nuova offerta
                                    </span>

                                    <span className="text-amber-400 font-black">
                                        {pendingBidAmount} CR
                                    </span>
                                </div>

                                <div className="border-t border-slate-700 pt-3 flex justify-between">
                                    <span className="text-red-300 font-bold">
                                        Superamento
                                    </span>

                                    <span className="text-red-400 font-black">
                                        +{pendingRoleBudgetExceeded} CR
                                    </span>
                                </div>

                            </div>

                            <p className="text-sm text-slate-300 leading-relaxed mb-6">
                                Questa offerta supera il budget che hai
                                impostato per questo ruolo.
                                <br />
                                <br />
                                Il budget per ruolo è indicativo.
                                Vuoi comunque effettuare l'offerta?
                            </p>

                            <div className="flex gap-3">

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRoleBudgetWarningOpen(false)
                                        setPendingBidAmount(null)
                                        setPendingRoleBudgetExceeded(0)
                                    }}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-black text-xs uppercase transition"
                                >
                                    Annulla
                                </button>

                                <button
                                    type="button"
                                    onClick={confirmRoleBudgetBid}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-black text-xs uppercase transition"
                                >
                                    Fai comunque l'offerta
                                </button>

                            </div>

                        </div>
                    </div>
                )}

            {/* ===================================================
                MODALE ASSEGNAZIONE
            =================================================== */}

            {isCongratulationModalOpen &&
                congratulatedPlayer && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">

                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">

                            <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-3 animate-bounce" />

                            <h2 className="text-2xl font-black uppercase text-white mb-1">
                                Giocatore Assegnato!
                            </h2>

                            <p className="text-slate-400 text-sm mb-6">

                                {congratulatedPlayer.isMyTeam
                                    ? "Complimenti! È entrato nella tua rosa."
                                    : `Assegnato alla squadra ${congratulatedPlayer.teamName}`}

                            </p>

                            <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 mb-6 text-left space-y-2">

                                <div className="text-xl font-black text-white">
                                    {
                                        congratulatedPlayer.name
                                    }
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t border-slate-700/50 text-sm">

                                    <span className="text-slate-400">
                                        Prezzo di chiusura
                                    </span>

                                    <span className="font-black text-emerald-400">
                                        {
                                            congratulatedPlayer.price
                                        }{' '}
                                        CR
                                    </span>

                                </div>

                                <div className="flex justify-between items-center pt-2 border-t border-slate-700/50 text-sm">

                                    <span className="text-slate-400">
                                        Squadra vincitrice
                                    </span>

                                    <span className="font-black text-white">
                                        {
                                            congratulatedPlayer.teamName
                                        }
                                    </span>

                                </div>

                            </div>

                            {isAdmin ? (
                                <button
                                    onClick={async () => {
                                        setIsCongratulationModalOpen(false)
                                        setCongratulatedPlayer(null)

                                        const channel =
                                            auctionChannelRef.current

                                        if (channel) {
                                            await channel.send({
                                                type: 'broadcast',
                                                event: 'auction_continue',
                                                payload: {
                                                    auctionId: id
                                                }
                                            })
                                        }

                                        await fetchCurrentNomination()

                                        if (myTeamId) {
                                            await fetchMyRoleCounts(myTeamId)
                                        }
                                    }}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition"
                                >
                                    Continua l'Asta
                                </button>
                            ) : (
                                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3">

                                    <p className="text-xs font-black uppercase text-slate-400">
                                        In attesa dell'amministratore
                                    </p>

                                    <p className="text-[10px] text-slate-500 mt-1">
                                        L'asta continuerà quando
                                        l'amministratore
                                        procederà.
                                    </p>

                                </div>
                            )}

                        </div>

                    </div>
                )}

            {/* ===================================================
                MODAL CHIAMATA
            =================================================== */}

            {isNominateModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-6 space-y-4 relative">

                        {isSubmitting && (
                            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs z-10 flex flex-col items-center justify-center gap-3 rounded-2xl">

                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />

                                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                                    Chiamata in corso...
                                </span>

                            </div>
                        )}

                        <div className="flex justify-between items-center">

                            <h3 className="text-sm font-black uppercase text-white">
                                Chiama{' '}
                                {roleDisplay}
                            </h3>

                            <button
                                disabled={
                                    isSubmitting
                                }
                                onClick={() => {
                                    setBasePriceValue(
                                        '1'
                                    )

                                    setIsNominateModalOpen(
                                        false
                                    )
                                }}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>

                        </div>

                        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">

                            <label className="text-xs font-black uppercase text-slate-400 block mb-2">
                                Prezzo base
                            </label>

                            <div className="flex items-center gap-2">

                                <input
                                    type="number"
                                    min="1"
                                    value={
                                        basePriceValue
                                    }
                                    disabled={
                                        isSubmitting
                                    }
                                    onChange={(
                                        e
                                    ) =>
                                        setBasePriceValue(
                                            e
                                                .target
                                                .value
                                        )
                                    }
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white font-black focus:outline-none focus:border-blue-500"
                                />

                                <span className="text-sm font-black text-amber-400">
                                    CR
                                </span>

                            </div>

                            <p className="text-[10px] text-slate-500 mt-2 uppercase">
                                Default: 1 CR
                            </p>

                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-2">

                            <input
                                type="text"
                                placeholder="Cerca per nome..."
                                value={
                                    searchQuery
                                }
                                disabled={
                                    isSubmitting
                                }
                                onChange={(
                                    e
                                ) =>
                                    setSearchQuery(
                                        e
                                            .target
                                            .value
                                    )
                                }
                                className="w-full sm:flex-1 bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                            />

                            <select
                                value={
                                    selectedTeamFilter
                                }
                                disabled={
                                    isSubmitting
                                }
                                onChange={(
                                    e
                                ) =>
                                    setSelectedTeamFilter(
                                        e
                                            .target
                                            .value
                                    )
                                }
                                className="w-full sm:w-60 bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                            >

                                <option value="">
                                    Tutte le squadre
                                </option>

                                {availableTeamsList.map(
                                    (
                                        teamName
                                    ) => (
                                        <option
                                            key={
                                                teamName
                                            }
                                            value={
                                                teamName
                                            }
                                        >
                                            {
                                                teamName
                                            }
                                        </option>
                                    )
                                )}

                            </select>

                            <button
                                disabled={
                                    isSubmitting
                                }
                                onClick={() =>
                                    setOnlyTargets(
                                        !onlyTargets
                                    )
                                }
                                className={`px-4 py-3 rounded-lg text-xs font-black uppercase transition flex items-center gap-1.5 border ${onlyTargets
                                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                                    }`}
                            >

                                <Star
                                    className={`w-4 h-4 ${onlyTargets
                                        ? 'fill-slate-950'
                                        : ''
                                        }`}
                                />

                                Obiettivi

                            </button>

                        </div>

                        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">

                            {availablePlayers.length ===
                                0 ? (
                                <p className="text-center text-xs text-slate-500 py-6 uppercase font-semibold">
                                    Nessun giocatore trovato
                                </p>
                            ) : (
                                availablePlayers.map(
                                    (
                                        p
                                    ) => (
                                        <div
                                            key={
                                                p.id
                                            }
                                            className="flex justify-between items-center p-3 rounded-xl border bg-slate-800/80 border-slate-700/60"
                                        >

                                            <div className="space-y-1 flex items-center gap-2">

                                                {targetPlayerIds.has(
                                                    p.id
                                                ) && (
                                                        <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                                                    )}

                                                <div>
                                                    <span className="font-bold text-sm text-white">
                                                        {p.name.toUpperCase()}
                                                    </span>
                                                    {(() => {
                                                        const teamInfo = getRealTeamData(p.team)
                                                        return (
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <TeamFlag teamData={teamInfo} playerTeam={p.team} />
                                                                <span className="text-xs text-slate-400">
                                                                    {teamInfo?.alias && <span className="text-slate-500 ml-1 font-bold text-s text-white">{teamInfo.alias.toUpperCase()}</span>}<br />
                                                                    <span className="text-slate-500 ml-1">{teamInfo ? teamInfo.name : p.team}</span>
                                                                </span>
                                                            </div>
                                                        )
                                                    })()}
                                                </div>

                                            </div>

                                            <button
                                                disabled={
                                                    isSubmitting
                                                }
                                                onClick={() =>
                                                    handleNominatePlayer(
                                                        p.id, p.role
                                                    )
                                                }
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-xs font-black uppercase transition"
                                            >
                                                CHIAMA
                                            </button>

                                        </div>
                                    )
                                )
                            )}

                        </div>

                    </div>

                </div>
            )}

        </div>
    )
}

const getTeamColors = (teamData: any): string[] => {
    if (!teamData) return ['#334155']
    if (Array.isArray(teamData.colors) && teamData.colors.length > 0) {
        return teamData.colors
    }
    if (teamData.color) {
        return [teamData.color]
    }
    return ['#334155']
}

const TeamFlag = ({ teamData, playerTeam }: { teamData?: any; playerTeam: string }) => {
    const colors = getTeamColors(teamData)
    const background =
        colors.length === 1
            ? colors[0]
            : `linear-gradient(90deg, ${colors
                .map((color, index) => `${color} ${(index / colors.length) * 100}%, ${color} ${((index + 1) / colors.length) * 100}%`)
                .join(', ')})`

    return (
        <div
            className="w-6 h-4 shrink-0 rounded overflow-hidden border border-slate-600 shadow-sm"
            style={{ background }}
            title={teamData ? `${teamData.name} (${teamData.alias})` : playerTeam}
        />
    )
}