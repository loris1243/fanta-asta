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
    const [isClosingAuction, setIsClosingAuction] =
        useState(false)

    const [isCongratulationModalOpen, setIsCongratulationModalOpen] =
        useState(false)

    const [congratulatedPlayer, setCongratulatedPlayer] =
        useState<any>(null)

    const auctionChannelRef = useRef<any>(null)
    const finalizingRef = useRef(false)
    const initSequenceRef = useRef(0)

    // ============================================================
    // SQUADRE PARTECIPANTI
    // ============================================================

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

                const nextTurnTeamId =
                    getNextTurnTeamId(
                        currentTurnTeamId,
                        teamsData
                    )

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

                if (nextTurnTeamId) {
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
                                    nextTurnTeamId
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

                        setAuction(
                            (prev: any) =>
                                prev
                                    ? {
                                        ...prev,
                                        current_turn_team_id:
                                            nextTurnTeamId
                                    }
                                    : prev
                        )
                    }
                }
            } catch (error) {
                console.error('Errore durante la chiusura dell\'asta:', error)
            } finally {
                finalizingRef.current = false
            }
        }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Asta in corso</h1>
            {/* Contenuto della pagina */}
        </div>
    )
}