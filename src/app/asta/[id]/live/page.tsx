'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
    LogOut,
    SkipForward,
} from 'lucide-react'

const ROLE_ORDER = ['P', 'D', 'C', 'A'] as const

const ROLE_NAMES: Record<string, string> = {
    P: 'Portiere',
    D: 'Difensore',
    C: 'Centrocampista',
    A: 'Attaccante',
}

const ROLE_LIMITS: Record<string, number> = {
    P: 3,
    D: 8,
    C: 8,
    A: 6,
}

const ROLE_COLUMN_MAP: Record<string, string> = {
    P: 'p_val',
    D: 'd_val',
    C: 'c_val',
    A: 'a_val',
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
    league_teams?: {
        name: string
    }[] | null
}

type TeamRow = {
    id: string
    name: string
    budget: number
}

type ParticipantRow = {
    team_id: string
    is_online?: boolean | null
}

type PlayerRow = {
    id: number
    name: string
    role: string
    team?: string | null
}

type SquadCount = {
    P: number
    D: number
    C: number
    A: number
}

export default function LiveAuctionPage() {
    const { id } = useParams()
    const router = useRouter()

    const auctionId = Array.isArray(id) ? id[0] : id

    // ============================================================
    // STATO GENERALE
    // ============================================================

    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)

    const [auction, setAuction] = useState<any>(null)

    const [currentNomination, setCurrentNomination] =
        useState<any>(null)

    const [teamsData, setTeamsData] = useState<TeamRow[]>([])
    const [participantOrder, setParticipantOrder] = useState<string[]>([])

    const [myTeamId, setMyTeamId] = useState<string | null>(null)
    const [myBudget, setMyBudget] = useState(0)

    // ============================================================
    // RUOLO / BUDGET
    // ============================================================

    const [requiredRole, setRequiredRole] = useState('P')

    const [myRoleBudget, setMyRoleBudget] =
        useState<number | null>(null)

    const [myRoleSpent, setMyRoleSpent] = useState(0)

    const [mySquadCounts, setMySquadCounts] =
        useState<SquadCount>({
            P: 0,
            D: 0,
            C: 0,
            A: 0,
        })

    // ============================================================
    // TURNO
    // ============================================================

    const [currentTurnTeamId, setCurrentTurnTeamId] =
        useState<string | null>(null)

    // ============================================================
    // ASTA CORRENTE
    // ============================================================

    const [currentBid, setCurrentBid] = useState(0)

    const [highestTeamId, setHighestTeamId] =
        useState<string | null>(null)

    const [bids, setBids] = useState<BidRow[]>([])

    const [withdrawnTeamIds, setWithdrawnTeamIds] =
        useState<Set<string>>(new Set())

    const [withdrawalMessages, setWithdrawalMessages] =
        useState<WithdrawalRow[]>([])

    // ============================================================
    // CHIAMATA
    // ============================================================

    const [isNominateModalOpen, setIsNominateModalOpen] =
        useState(false)

    const [searchQuery, setSearchQuery] = useState('')

    const [selectedTeamFilter, setSelectedTeamFilter] =
        useState('')

    const [onlyTargets, setOnlyTargets] = useState(false)

    const [targetPlayerIds, setTargetPlayerIds] =
        useState<Set<number>>(new Set())

    const [availablePlayers, setAvailablePlayers] =
        useState<PlayerRow[]>([])

    const [availableTeamsList, setAvailableTeamsList] =
        useState<string[]>([])

    const [customBidValue, setCustomBidValue] = useState('')

    const [basePriceValue, setBasePriceValue] =
        useState('1')

    // ============================================================
    // MODAL / OPERAZIONI
    // ============================================================

    const [isSubmitting, setIsSubmitting] = useState(false)

    const [isWithdrawing, setIsWithdrawing] =
        useState(false)

    const [isClosingAuction, setIsClosingAuction] =
        useState(false)

    const [
        isCongratulationModalOpen,
        setIsCongratulationModalOpen,
    ] = useState(false)

    const [congratulatedPlayer, setCongratulatedPlayer] =
        useState<any>(null)

    // ============================================================
    // REF
    // ============================================================

    const auctionChannelRef = useRef<any>(null)

    const finalizingRef = useRef(false)

    const initSequenceRef = useRef(0)

    // Questo ref evita che i callback realtime utilizzino
    // uno stato vecchio della nomination.
    const currentNominationRef =
        useRef<any>(null)

    const teamsRef = useRef<TeamRow[]>([])

    const participantOrderRef =
        useRef<string[]>([])

    const currentTurnTeamIdRef =
        useRef<string | null>(null)

    const requiredRoleRef = useRef('P')

    // ============================================================
    // SYNC REF
    // ============================================================

    useEffect(() => {
        currentNominationRef.current =
            currentNomination
    }, [currentNomination])

    useEffect(() => {
        teamsRef.current = teamsData
    }, [teamsData])

    useEffect(() => {
        participantOrderRef.current =
            participantOrder
    }, [participantOrder])

    useEffect(() => {
        currentTurnTeamIdRef.current =
            currentTurnTeamId
    }, [currentTurnTeamId])

    useEffect(() => {
        requiredRoleRef.current =
            requiredRole
    }, [requiredRole])

    // ============================================================
    // UTILITY
    // ============================================================

    const normalizeRole = (role: string | null | undefined) => {
        if (!role) return 'P'

        const normalized = role.toUpperCase()

        return ROLE_ORDER.includes(
            normalized as any
        )
            ? normalized
            : 'P'
    }

    const getNextRole = (role: string) => {
        const index =
            ROLE_ORDER.indexOf(
                normalizeRole(role) as any
            )

        if (index < 0) {
            return 'P'
        }

        return (
            ROLE_ORDER[index + 1] ||
            null
        )
    }

    const isTeamRoleComplete = (
        counts: SquadCount,
        role: string
    ) => {
        const normalized =
            normalizeRole(role)

        return (
            counts[normalized as keyof SquadCount] >=
            ROLE_LIMITS[normalized]
        )
    }

    const emptySquadCounts = (): SquadCount => ({
        P: 0,
        D: 0,
        C: 0,
        A: 0,
    })

    // ============================================================
    // PARTECIPANTI
    // ============================================================

    const fetchParticipantsAndTeams =
        useCallback(async () => {
            if (!auctionId) {
                return []
            }

            const {
                data: participants,
                error: participantsError,
            } = await supabase
                .from('auction_participants')
                .select('team_id, is_online')
                .eq('auction_id', auctionId)

            if (participantsError) {
                console.error(
                    'Errore partecipanti:',
                    participantsError
                )

                return []
            }

            const rows =
                (participants || []) as ParticipantRow[]

            const orderedIds = rows
                .map((row) => row.team_id)
                .filter(Boolean)

            const uniqueIds = Array.from(
                new Set(orderedIds)
            )

            setParticipantOrder(
                uniqueIds
            )

            participantOrderRef.current =
                uniqueIds

            if (uniqueIds.length === 0) {
                setTeamsData([])

                teamsRef.current = []

                return []
            }

            const {
                data: teams,
                error: teamsError,
            } = await supabase
                .from('league_teams')
                .select(
                    'id, name, budget'
                )
                .in(
                    'id',
                    uniqueIds
                )

            if (teamsError) {
                console.error(
                    'Errore squadre:',
                    teamsError
                )

                return []
            }

            const rawTeams =
                (teams || []) as TeamRow[]

            // .in() non garantisce l'ordine.
            // Ricostruiamo esplicitamente l'ordine
            // dei partecipanti.
            const orderedTeams =
                uniqueIds
                    .map((teamId) =>
                        rawTeams.find(
                            (team) =>
                                team.id ===
                                teamId
                        )
                    )
                    .filter(
                        Boolean
                    ) as TeamRow[]

            setTeamsData(
                orderedTeams
            )

            teamsRef.current =
                orderedTeams

            return orderedTeams
        }, [auctionId])

    // ============================================================
    // BUDGET RUOLO
    // ============================================================

    const fetchRoleBudgetInfo = useCallback(
        async (
            teamId: string,
            role: string
        ) => {
            if (!teamId || !role) {
                setMyRoleBudget(null)
                setMyRoleSpent(0)

                return
            }

            const colName =
                ROLE_COLUMN_MAP[
                    normalizeRole(role)
                ]

            if (!colName) {
                setMyRoleBudget(null)
                setMyRoleSpent(0)

                return
            }

            const {
                data: leagueSettings,
            } = await supabase
                .from('league_settings')
                .select('initial_budget')
                .single()

            const maxBudgetTotal =
                leagueSettings?.initial_budget ||
                500

            const {
                data: sessionData,
            } =
                await supabase.auth.getSession()

            const userId =
                sessionData?.session?.user?.id

            if (!userId) {
                return
            }

            const {
                data: roleBudgetRow,
            } = await supabase
                .from('user_role_budgets')
                .select('*')
                .eq(
                    'user_id',
                    userId
                )
                .maybeSingle()

            if (
                roleBudgetRow &&
                roleBudgetRow[colName] !==
                    undefined &&
                roleBudgetRow[colName] !==
                    null
            ) {
                const rawVal =
                    roleBudgetRow[colName]

                const mode =
                    roleBudgetRow.mode ||
                    'percentage'

                const calculatedBudget =
                    mode === 'percentage'
                        ? Math.round(
                              (maxBudgetTotal *
                                  rawVal) /
                                  100
                          )
                        : rawVal

                setMyRoleBudget(
                    calculatedBudget
                )

                const {
                    data: spentData,
                } = await supabase
                    .from(
                        'league_team_players'
                    )
                    .select(
                        'price'
                    )
                    .eq(
                        'auction_id',
                        auctionId
                    )
                    .eq(
                        'team_id',
                        teamId
                    )
                    .eq(
                        'role',
                        normalizeRole(role)
                    )

                const totalSpent =
                    spentData?.reduce(
                        (
                            acc,
                            curr
                        ) =>
                            acc +
                            (curr.price ||
                                0),
                        0
                    ) || 0

                setMyRoleSpent(
                    totalSpent
                )
            } else {
                setMyRoleBudget(null)
                setMyRoleSpent(0)
            }
        },
        [auctionId]
    )

    // ============================================================
    // ROSA SQUADRA
    // ============================================================

    const fetchSquadCounts = useCallback(
        async (
            teamId: string
        ) => {
            const counts =
                emptySquadCounts()

            if (!teamId) {
                setMySquadCounts(
                    counts
                )

                return counts
            }

            const {
                data,
                error,
            } = await supabase
                .from(
                    'league_team_players'
                )
                .select('role')
                .eq(
                    'auction_id',
                    auctionId
                )
                .eq(
                    'team_id',
                    teamId
                )

            if (error) {
                console.error(
                    'Errore conteggio rosa:',
                    error
                )

                setMySquadCounts(
                    counts
                )

                return counts
            }

            for (const row of data || []) {
                const role =
                    normalizeRole(
                        row.role
                    )

                if (
                    role in
                    counts
                ) {
                    counts[
                        role as keyof SquadCount
                    ]++
                }
            }

            setMySquadCounts(
                counts
            )

            return counts
        },
        [auctionId]
    )

    // ============================================================
    // TARGET
    // ============================================================

    const loadUserTargets =
        useCallback(async () => {
            const {
                data: sessionData,
            } =
                await supabase.auth.getSession()

            if (
                !sessionData?.session?.user
            ) {
                return
            }

            const {
                data: targetsData,
            } = await supabase
                .from('user_targets')
                .select(
                    'player_id'
                )
                .eq(
                    'user_id',
                    sessionData.session.user.id
                )

            setTargetPlayerIds(
                new Set(
                    (targetsData || []).map(
                        (row: any) =>
                            row.player_id
                    )
                )
            )
        }, [])

    // ============================================================
    // OFFERTE
    // ============================================================

    const fetchBids =
        useCallback(
            async (
                nominationId: number
            ) => {
                const {
                    data,
                    error,
                } = await supabase
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
                            ascending: true,
                        }
                    )

                if (error) {
                    console.error(
                        'Errore caricamento offerte:',
                        error
                    )

                    return
                }

                setBids(
                    (data || []) as BidRow[]
                )
            },
            []
        )

    // ============================================================
    // RITIRI
    // ============================================================

    const fetchWithdrawals =
        useCallback(
            async (
                nominationId: number
            ) => {
                const {
                    data,
                    error,
                } = await supabase
                    .from(
                        'auction_withdrawals'
                    )
                    .select(
                        'id, team_id, created_at, league_teams(name)'
                    )
                    .eq(
                        'nomination_id',
                        nominationId
                    )
                    .order(
                        'created_at',
                        {
                            ascending: true,
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

                const withdrawn =
                    new Set(
                        rows.map(
                            (row) =>
                                row.team_id
                        )
                    )

                setWithdrawnTeamIds(
                    withdrawn
                )

                setWithdrawalMessages(
                    rows
                )
            },
            []
        )

    // ============================================================
    // NOMINATION
    // ============================================================

    const fetchCurrentNomination =
        useCallback(async () => {
            if (!auctionId) {
                return
            }

            const {
                data: nomination,
                error,
            } = await supabase
                .from(
                    'auction_nominations'
                )
                .select(
                    '*, players(*)'
                )
                .eq(
                    'auction_id',
                    auctionId
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

            currentNominationRef.current =
                nomination

            if (!nomination) {
                setCurrentBid(0)
                setHighestTeamId(null)
                setBids([])
                setWithdrawnTeamIds(
                    new Set()
                )
                setWithdrawalMessages(
                    []
                )

                return
            }

            setCurrentBid(
                nomination.current_bid ??
                    nomination.base_price ??
                    1
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
                ),
            ])
        }, [
            auctionId,
            fetchBids,
            fetchWithdrawals,
        ])

    // ============================================================
    // MIGLIOR OFFERTA
    // ============================================================

    const getBestActiveBid = (
        bidRows: BidRow[],
        withdrawnIds: Set<string>
    ) => {
        const bestByTeam =
            new Map<
                string,
                number
            >()

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
            | string
            | null = null

        let winningAmount = 0

        for (
            const [
                teamId,
                amount,
            ] of bestByTeam
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
                winningAmount,
        }
    }

    // ============================================================
    // SQUADRE ATTIVE
    // ============================================================

    const getActiveTeamsForRole =
        useCallback(
            (
                role: string,
                withdrawnIds: Set<string> =
                    withdrawnTeamIds
            ) => {
                const normalized =
                    normalizeRole(role)

                return teamsRef.current.filter(
                    (team) =>
                        !withdrawnIds.has(
                            team.id
                        )
                )
            },
            [withdrawnTeamIds]
        )

    // ============================================================
    // TROVA PROSSIMO TURNO
    // ============================================================

    const findNextTurnTeam = useCallback(
        async (
            afterTeamId: string | null,
            role: string
        ) => {
            const order =
                participantOrderRef.current

            const teams =
                teamsRef.current

            if (
                order.length === 0 ||
                teams.length === 0
            ) {
                return null
            }

            const normalized =
                normalizeRole(role)

            const startIndex =
                afterTeamId
                    ? order.indexOf(
                          afterTeamId
                      )
                    : -1

            /*
             * Partiamo dalla squadra successiva
             * rispetto a quella che ha appena avuto
             * il turno.
             *
             * Se ha completato gli slot del ruolo,
             * viene saltata.
             */

            for (
                let offset = 1;
                offset <= order.length;
                offset++
            ) {
                const index =
                    (
                        startIndex +
                        offset
                    ) %
                    order.length

                const teamId =
                    order[index]

                const team =
                    teams.find(
                        (item) =>
                            item.id ===
                            teamId
                    )

                if (!team) {
                    continue
                }

                // La squadra deve essere ancora partecipante.
                const isParticipant =
                    teams.some(
                        (item) =>
                            item.id ===
                            teamId
                    )

                if (
                    !isParticipant
                ) {
                    continue
                }

                const counts =
                    emptySquadCounts()

                const {
                    data,
                    error,
                } = await supabase
                    .from(
                        'league_team_players'
                    )
                    .select(
                        'role'
                    )
                    .eq(
                        'auction_id',
                        auctionId
                    )
                    .eq(
                        'team_id',
                        teamId
                    )

                if (error) {
                    console.error(
                        'Errore controllo slot:',
                        error
                    )

                    continue
                }

                for (const row of data || []) {
                    const rowRole =
                        normalizeRole(
                            row.role
                        )

                    counts[
                        rowRole as keyof SquadCount
                    ]++
                }

                if (
                    !isTeamRoleComplete(
                        counts,
                        normalized
                    )
                ) {
                    return teamId
                }
            }

            return null
        },
        [auctionId]
    )

    // ============================================================
    // AVANZAMENTO TURNO
    // ============================================================

    const advanceTurnAfterPlayer =
        useCallback(
            async (
                previousTeamId: string | null,
                role: string
            ) => {
                const nextTeamId =
                    await findNextTurnTeam(
                        previousTeamId,
                        role
                    )

                if (!nextTeamId) {
                    /*
                     * Nessuna squadra può più avere
                     * giocatori del ruolo corrente.
                     *
                     * Passiamo al ruolo successivo.
                     */

                    const nextRole =
                        getNextRole(role)

                    if (!nextRole) {
                        return null
                    }

                    const firstTeam =
                        await findNextTurnTeam(
                            previousTeamId,
                            nextRole
                        )

                    if (!firstTeam) {
                        return null
                    }

                    const {
                        error,
                    } = await supabase
                        .from('auctions')
                        .update({
                            required_role:
                                nextRole,
                            current_turn_team_id:
                                firstTeam,
                        })
                        .eq(
                            'id',
                            auctionId
                        )

                    if (error) {
                        throw error
                    }

                    setRequiredRole(
                        nextRole
                    )

                    requiredRoleRef.current =
                        nextRole

                    setCurrentTurnTeamId(
                        firstTeam
                    )

                    currentTurnTeamIdRef.current =
                        firstTeam

                    return firstTeam
                }

                const {
                    error,
                } = await supabase
                    .from('auctions')
                    .update({
                        current_turn_team_id:
                            nextTeamId,
                    })
                    .eq(
                        'id',
                        auctionId
                    )

                if (error) {
                    throw error
                }

                setCurrentTurnTeamId(
                    nextTeamId
                )

                currentTurnTeamIdRef.current =
                    nextTeamId

                return nextTeamId
            },
            [
                auctionId,
                findNextTurnTeam,
            ]
        )

    // ============================================================
    // CHIUSURA ASTA
    // ============================================================

    const finalizeAuctionItem =
        useCallback(async () => {
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
                    error,
                } = await supabase
                    .from(
                        'auction_nominations'
                    )
                    .select(
                        'id, status, player_id, current_bid, base_price, highest_bidder_team_id, players(name, role)'
                    )
                    .eq(
                        'auction_id',
                        auctionId
                    )
                    .eq(
                        'status',
                        'in_corso'
                    )
                    .maybeSingle()

                if (error) {
                    throw error
                }

                if (
                    !freshNomination
                ) {
                    return
                }

                const [
                    bidsResult,
                    withdrawalsResult,
                ] = await Promise.all([
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
                        ),
                ])

                if (
                    bidsResult.error
                ) {
                    throw bidsResult.error
                }

                if (
                    withdrawalsResult.error
                ) {
                    throw withdrawalsResult.error
                }

                const freshBids =
                    (bidsResult.data ||
                        []) as BidRow[]

                const withdrawnIds =
                    new Set<string>(
                        (
                            withdrawalsResult.data ||
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
                        winningAmount,
                } =
                    getBestActiveBid(
                        freshBids,
                        withdrawnIds
                    )

                let finalWinningTeamId =
                    winningTeamId

                let finalWinningAmount =
                    winningAmount

                /*
                 * Se nessuno ha fatto un'offerta
                 * e rimane una sola squadra attiva,
                 * quella squadra prende il giocatore
                 * al prezzo base.
                 */

                const activeTeams =
                    teamsRef.current.filter(
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
                            freshNomination.base_price ||
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
                        freshNomination.base_price ||
                        1
                }

                const playerData =
                    freshNomination.players as any

                const playerName =
                    playerData?.name ||
                    'Giocatore'

                const playerRole =
                    normalizeRole(
                        playerData?.role
                    )

                /*
                 * Chiudiamo la nomination con un
                 * update condizionale.
                 *
                 * Se un altro client l'ha già chiusa,
                 * non procediamo nuovamente.
                 */

                const {
                    data:
                        closedNomination,
                    error:
                        closeError,
                } = await supabase
                    .from(
                        'auction_nominations'
                    )
                    .update({
                        status:
                            'chiusa',
                        current_bid:
                            finalWinningAmount,
                        highest_bidder_team_id:
                            finalWinningTeamId,
                    })
                    .eq(
                        'id',
                        freshNomination.id
                    )
                    .eq(
                        'status',
                        'in_corso'
                    )
                    .select('id')

                if (closeError) {
                    throw closeError
                }

                if (
                    !closedNomination ||
                    closedNomination.length ===
                        0
                ) {
                    return
                }

                // ====================================================
                // TRANSAZIONE
                // ====================================================

                const {
                    data:
                        existingTx,
                    error:
                        existingTxError,
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
                            auctionId
                        )
                        .eq(
                            'player_id',
                            freshNomination.player_id
                        )
                        .maybeSingle()

                if (existingTxError) {
                    throw existingTxError
                }

                if (!existingTx) {
                    const {
                        error:
                            txError,
                    } =
                        await supabase
                            .from(
                                'auction_transactions'
                            )
                            .insert({
                                auction_id:
                                    auctionId,
                                team_id:
                                    finalWinningTeamId,
                                player_id:
                                    freshNomination.player_id,
                                player_name:
                                    playerName,
                                role:
                                    playerRole,
                                price:
                                    finalWinningAmount,
                            })

                    if (txError) {
                        throw txError
                    }

                    const {
                        error:
                            playerError,
                    } =
                        await supabase
                            .from(
                                'league_team_players'
                            )
                            .insert({
                                auction_id:
                                    auctionId,
                                team_id:
                                    finalWinningTeamId,
                                player_id:
                                    freshNomination.player_id,
                                player_name:
                                    playerName,
                                role:
                                    playerRole,
                                price:
                                    finalWinningAmount,
                            })

                    if (
                        playerError
                    ) {
                        throw playerError
                    }

                    const {
                        data:
                            winnerTeam,
                        error:
                            winnerTeamError,
                    } =
                        await supabase
                            .from(
                                'league_teams'
                            )
                            .select(
                                'budget'
                            )
                            .eq(
                                'id',
                                finalWinningTeamId
                            )
                            .single()

                    if (
                        winnerTeamError
                    ) {
                        throw winnerTeamError
                    }

                    const newBudget =
                        Math.max(
                            0,
                            (winnerTeam?.budget ||
                                0) -
                                finalWinningAmount
                        )

                    const {
                        error:
                            budgetError,
                    } =
                        await supabase
                            .from(
                                'league_teams'
                            )
                            .update({
                                budget:
                                    newBudget,
                            })
                            .eq(
                                'id',
                                finalWinningTeamId
                            )

                    if (
                        budgetError
                    ) {
                        throw budgetError
                    }
                }

                // ====================================================
                // DATI PRIMA DEL RESET
                // ====================================================

                const winnerTeam =
                    teamsRef.current.find(
                        (team) =>
                            team.id ===
                            finalWinningTeamId
                    )

                const winnerTeamName =
                    winnerTeam?.name ||
                    'Nessuna squadra'

                const wasMyTeam =
                    finalWinningTeamId ===
                    myTeamId

                /*
                 * Il turno successivo viene calcolato
                 * usando il ruolo appena concluso.
                 */

                await advanceTurnAfterPlayer(
                    currentTurnTeamIdRef.current,
                    playerRole
                )

                // ====================================================
                // RESET UI
                // ====================================================

                setCurrentNomination(
                    null
                )

                currentNominationRef.current =
                    null

                setCurrentBid(0)

                setHighestTeamId(
                    null
                )

                setBids([])

                setWithdrawnTeamIds(
                    new Set()
                )

                setWithdrawalMessages(
                    []
                )

                setCongratulatedPlayer({
                    name:
                        playerName,
                    role:
                        playerRole,
                    price:
                        finalWinningAmount,
                    teamName:
                        winnerTeamName,
                    isMyTeam:
                        wasMyTeam,
                })

                setIsCongratulationModalOpen(
                    true
                )

                // ====================================================
                // RICARICA DATI
                // ====================================================

                const freshTeams =
                    await fetchParticipantsAndTeams()

                const freshMyTeam =
                    freshTeams.find(
                        (team) =>
                            team.id ===
                            myTeamId
                    )

                if (
                    freshMyTeam
                ) {
                    setMyBudget(
                        freshMyTeam.budget
                    )
                }

                if (
                    myTeamId
                ) {
                    await Promise.all([
                        fetchRoleBudgetInfo(
                            myTeamId,
                            requiredRoleRef.current
                        ),
                        fetchSquadCounts(
                            myTeamId
                        ),
                    ])
                }
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
        }, [
            auctionId,
            fetchParticipantsAndTeams,
            fetchRoleBudgetInfo,
            fetchSquadCounts,
            getBestActiveBid,
            advanceTurnAfterPlayer,
            myTeamId,
        ])

    // ============================================================
    // RITIRO
    // ============================================================

    const handleWithdraw =
        async () => {
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

            const confirmed =
                window.confirm(
                    'Vuoi davvero ritirarti da questa asta? Non potrai più fare offerte su questo giocatore.'
                )

            if (!confirmed) {
                return
            }

            setIsWithdrawing(
                true
            )

            try {
                const {
                    error,
                } = await supabase
                    .from(
                        'auction_withdrawals'
                    )
                    .insert({
                        auction_id:
                            auctionId,
                        nomination_id:
                            currentNomination.id,
                        team_id:
                            myTeamId,
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

                const myTeamName =
                    teamsRef.current.find(
                        (team) =>
                            team.id ===
                            myTeamId
                    )?.name ||
                    'Una squadra'

                setWithdrawalMessages(
                    (previous) => [
                        ...previous,
                        {
                            id:
                                Date.now(),
                            team_id:
                                myTeamId,
                            created_at:
                                new Date().toISOString(),
                            league_teams:
                                [
                                    {
                                        name:
                                            myTeamName,
                                    },
                                ],
                        },
                    ]
                )

                /*
                 * Se rimane una sola squadra,
                 * l'assegnazione è automatica.
                 */

                const activeTeams =
                    teamsRef.current.filter(
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
    // CHIAMATA GIOCATORE
    // ============================================================

    const handleNominatePlayer =
        async (
            playerId: number
        ) => {
            if (
                isSubmitting ||
                !currentTurnTeamIdRef.current
            ) {
                return
            }

            const basePrice =
                parseInt(
                    basePriceValue,
                    10
                )

            if (
                Number.isNaN(
                    basePrice
                ) ||
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
                /*
                 * Ricontrolliamo dal DB che non esista
                 * già una nomination in corso.
                 */

                const {
                    data:
                        existingNomination,
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
                            auctionId
                        )
                        .eq(
                            'status',
                            'in_corso'
                        )
                        .maybeSingle()

                if (
                    existingNomination
                ) {
                    await fetchCurrentNomination()

                    throw new Error(
                        'Esiste già un’asta in corso.'
                    )
                }

                const {
                    error:
                        rpcError,
                } =
                    await supabase.rpc(
                        'nominate_player',
                        {
                            p_auction_id:
                                auctionId,
                            p_player_id:
                                playerId,
                        }
                    )

                if (rpcError) {
                    throw rpcError
                }

                const {
                    data:
                        newNomination,
                    error:
                        nominationError,
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
                            auctionId
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

                /*
                 * La chiamata stabilisce soltanto il prezzo base.
                 *
                 * NON inseriamo una falsa offerta
                 * della squadra che ha chiamato.
                 */

                const {
                    error:
                        priceError,
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
                                null,
                        })
                        .eq(
                            'id',
                            newNomination.id
                        )

                if (
                    priceError
                ) {
                    throw priceError
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
                    error instanceof Error &&
                        error.message
                        ? error.message
                        : 'Errore durante la chiamata del giocatore. Riprova.'
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
            newAmount: number
        ) => {
            const nomination =
                currentNominationRef.current

            if (
                !nomination ||
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
                    'Non hai abbastanza Crediti (CR) per effettuare questa offerta!'
                )

                return
            }

            /*
             * Budget specifico del ruolo.
             */

            if (
                myRoleBudget !==
                null
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

                const roleRemaining =
                    myRoleBudget -
                    myRoleSpent

                if (
                    effectiveCostDelta >
                    roleRemaining
                ) {
                    alert(
                        `L'offerta supera il budget residuo per il ruolo ${ROLE_NAMES[requiredRole]} (${roleRemaining} CR disponibili)!`
                    )

                    return
                }
            }

            /*
             * Rileggiamo la nomination dal DB prima
             * dell'offerta per evitare di rilanciare
             * partendo da un valore vecchio.
             */

            const {
                data:
                    freshNomination,
                error:
                    nominationReadError,
            } =
                await supabase
                    .from(
                        'auction_nominations'
                    )
                    .select(
                        'id, status, current_bid'
                    )
                    .eq(
                        'id',
                        nomination.id
                    )
                    .maybeSingle()

            if (
                nominationReadError
            ) {
                console.error(
                    nominationReadError
                )

                alert(
                    "Impossibile verificare l'offerta corrente."
                )

                return
            }

            if (
                !freshNomination ||
                freshNomination.status !==
                    'in_corso'
            ) {
                await fetchCurrentNomination()

                alert(
                    "Questa asta non è più in corso."
                )

                return
            }

            const freshCurrentBid =
                freshNomination.current_bid ??
                0

            if (
                newAmount <=
                freshCurrentBid
            ) {
                await fetchCurrentNomination()

                alert(
                    "Qualcuno ha già rilanciato. L'offerta deve essere superiore!"
                )

                return
            }

            /*
             * Storico offerta.
             */

            const {
                data: bidRow,
                error:
                    bidInsertError,
            } =
                await supabase
                    .from(
                        'auction_bids'
                    )
                    .insert({
                        auction_id:
                            auctionId,
                        nomination_id:
                            nomination.id,
                        team_id:
                            myTeamId,
                        amount:
                            newAmount,
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

            /*
             * Aggiornamento condizionale:
             * se nel frattempo qualcuno ha rilanciato,
             * questa update non modifica l'asta.
             */

            const {
                data:
                    updatedNomination,
                error:
                    nominationUpdateError,
            } =
                await supabase
                    .from(
                        'auction_nominations'
                    )
                    .update({
                        current_bid:
                            newAmount,
                        highest_bidder_team_id:
                            myTeamId,
                    })
                    .eq(
                        'id',
                        nomination.id
                    )
                    .eq(
                        'status',
                        'in_corso'
                    )
                    .eq(
                        'current_bid',
                        freshCurrentBid
                    )
                    .select('id')

            if (
                nominationUpdateError
            ) {
                console.error(
                    nominationUpdateError
                )

                await fetchCurrentNomination()

                return
            }

            if (
                !updatedNomination ||
                updatedNomination.length ===
                    0
            ) {
                await fetchCurrentNomination()

                alert(
                    "Qualcuno ha già rilanciato. La tua offerta non è diventata l'offerta corrente."
                )

                return
            }

            if (bidRow) {
                setBids(
                    (previous) => [
                        ...previous,
                        bidRow as BidRow,
                    ]
                )
            }

            setCurrentBid(
                newAmount
            )

            setHighestTeamId(
                myTeamId
            )

            setCustomBidValue(
                ''
            )
        }

    // ============================================================
    // INIT
    // ============================================================

    useEffect(() => {
        if (!auctionId) {
            return
        }

        let isMounted = true

        const initId =
            ++initSequenceRef.current

        const channelTopic =
            `auction-room-${auctionId}`

        const initAuctionRoom =
            async () => {
                const {
                    data: {
                        session,
                    },
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
                    data: profile,
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

                setIsAdmin(
                    profile?.role ===
                        'admin'
                )

                await loadUserTargets()

                const {
                    data:
                        auctionData,
                    error:
                        auctionError,
                } =
                    await supabase
                        .from(
                            'auctions'
                        )
                        .select('*')
                        .eq(
                            'id',
                            auctionId
                        )
                        .maybeSingle()

                if (
                    auctionError
                ) {
                    console.error(
                        auctionError
                    )
                }

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
                    normalizeRole(
                        auctionData.required_role
                    )

                setRequiredRole(
                    initialRole
                )

                requiredRoleRef.current =
                    initialRole

                setCurrentTurnTeamId(
                    auctionData.current_turn_team_id ||
                        null
                )

                currentTurnTeamIdRef.current =
                    auctionData.current_turn_team_id ||
                    null

                // ====================================================
                // MIA SQUADRA
                // ====================================================

                const {
                    data:
                        teamData,
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

                    await Promise.all([
                        fetchRoleBudgetInfo(
                            teamData.id,
                            initialRole
                        ),
                        fetchSquadCounts(
                            teamData.id
                        ),
                    ])
                }

                // ====================================================
                // PARTECIPANTI
                // ====================================================

                const fetchedTeams =
                    await fetchParticipantsAndTeams()

                /*
                 * Il primo turno deve essere già quello
                 * deciso dal sorteggio.
                 *
                 * Se current_turn_team_id è presente,
                 * lo preserviamo.
                 *
                 * Se è assente, prendiamo il primo
                 * partecipante nell'ordine del sorteggio
                 * restituito da auction_participants.
                 */

                let initialTurn =
                    auctionData.current_turn_team_id ||
                    null

                if (
                    !initialTurn &&
                    fetchedTeams.length >
                        0
                ) {
                    initialTurn =
                        participantOrderRef.current[0] ||
                        fetchedTeams[0].id

                    const {
                        error:
                            turnError,
                    } =
                        await supabase
                            .from(
                                'auctions'
                            )
                            .update({
                                current_turn_team_id:
                                    initialTurn,
                            })
                            .eq(
                                'id',
                                auctionId
                            )

                    if (
                        turnError
                    ) {
                        console.error(
                            'Errore impostazione primo turno:',
                            turnError
                        )
                    }
                }

                setCurrentTurnTeamId(
                    initialTurn
                )

                currentTurnTeamIdRef.current =
                    initialTurn

                await fetchCurrentNomination()

                if (
                    !isMounted ||
                    initId !==
                        initSequenceRef.current
                ) {
                    return
                }

                setLoading(
                    false
                )

                // ====================================================
                // REALTIME
                // ====================================================

                const existingChannel =
                    supabase
                        .getChannels()
                        .find(
                            (channel: any) =>
                                channel.topic ===
                                `realtime:${channelTopic}`
                        )

                if (
                    existingChannel
                ) {
                    await supabase.removeChannel(
                        existingChannel
                    )
                }

                const channel =
                    supabase
                        .channel(
                            channelTopic
                        )

                        // ------------------------------------------
                        // AUCTION
                        // ------------------------------------------

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
                                    `id=eq.${auctionId}`,
                            },
                            async (
                                payload: any
                            ) => {
                                if (
                                    !payload.new
                                ) {
                                    return
                                }

                                setAuction(
                                    payload.new
                                )

                                const newRole =
                                    normalizeRole(
                                        payload
                                            .new
                                            .required_role
                                    )

                                const newTurn =
                                    payload
                                        .new
                                        .current_turn_team_id ||
                                    null

                                setRequiredRole(
                                    newRole
                                )

                                requiredRoleRef.current =
                                    newRole

                                setCurrentTurnTeamId(
                                    newTurn
                                )

                                currentTurnTeamIdRef.current =
                                    newTurn

                                if (
                                    myTeamId
                                ) {
                                    await Promise.all([
                                        fetchRoleBudgetInfo(
                                            myTeamId,
                                            newRole
                                        ),
                                        fetchSquadCounts(
                                            myTeamId
                                        ),
                                    ])
                                }
                            }
                        )

                        // ------------------------------------------
                        // NOMINATIONS
                        // ------------------------------------------

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
                                    `auction_id=eq.${auctionId}`,
                            },
                            async () => {
                                if (
                                    !isMounted
                                ) {
                                    return
                                }

                                await fetchCurrentNomination()
                            }
                        )

                        // ------------------------------------------
                        // OFFERTE
                        // ------------------------------------------

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
                                    `auction_id=eq.${auctionId}`,
                            },
                            async () => {
                                if (
                                    !isMounted
                                ) {
                                    return
                                }

                                const nomination =
                                    currentNominationRef.current

                                if (
                                    nomination?.id
                                ) {
                                    await fetchBids(
                                        nomination.id
                                    )

                                    /*
                                     * Aggiorniamo anche il prezzo
                                     * direttamente dal DB.
                                     */

                                    const {
                                        data,
                                    } =
                                        await supabase
                                            .from(
                                                'auction_nominations'
                                            )
                                            .select(
                                                'current_bid, highest_bidder_team_id'
                                            )
                                            .eq(
                                                'id',
                                                nomination.id
                                            )
                                            .maybeSingle()

                                    if (
                                        data
                                    ) {
                                        setCurrentBid(
                                            data.current_bid ??
                                                0
                                        )

                                        setHighestTeamId(
                                            data.highest_bidder_team_id ||
                                                null
                                        )
                                    }
                                }
                            }
                        )

                        // ------------------------------------------
                        // RITIRI
                        // ------------------------------------------

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
                                    `auction_id=eq.${auctionId}`,
                            },
                            async () => {
                                if (
                                    !isMounted
                                ) {
                                    return
                                }

                                const nomination =
                                    currentNominationRef.current

                                if (
                                    nomination?.id
                                ) {
                                    await fetchWithdrawals(
                                        nomination.id
                                    )
                                }
                            }
                        )

                auctionChannelRef.current =
                    channel

                await channel.subscribe()
            }

        initAuctionRoom()

        return () => {
            isMounted = false

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
    }, [
        auctionId,
        router,
        loadUserTargets,
        fetchParticipantsAndTeams,
        fetchCurrentNomination,
        fetchRoleBudgetInfo,
        fetchSquadCounts,
        fetchBids,
        fetchWithdrawals,
        myTeamId,
    ])

    // ============================================================
    // CARICAMENTO GIOCATORI
    // ============================================================

    useEffect(() => {
        const loadPlayers =
            async () => {
                if (
                    !isNominateModalOpen ||
                    !auctionId
                ) {
                    return
                }

                await loadUserTargets()

                const {
                    data:
                        assignedData,
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
                            auctionId
                        )

                const assignedPlayerIds =
                    new Set(
                        (
                            assignedData ||
                            []
                        )
                            .map(
                                (
                                    row: any
                                ) =>
                                    row.player_id
                            )
                            .filter(
                                Boolean
                            )
                    )

                let query =
                    supabase
                        .from(
                            'players'
                        )
                        .select('*')
                        .order(
                            'name',
                            {
                                ascending:
                                    true,
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
                    error,
                } =
                    await query

                if (
                    error ||
                    !data
                ) {
                    setAvailablePlayers(
                        []
                    )

                    return
                }

                const unassignedPlayers =
                    data.filter(
                        (
                            player: PlayerRow
                        ) =>
                            !assignedPlayerIds.has(
                                player.id
                            )
                    ) as PlayerRow[]

                const uniqueTeams =
                    Array.from(
                        new Set(
                            unassignedPlayers
                                .map(
                                    (
                                        player
                                    ) =>
                                        player.team
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
                    const search =
                        searchQuery
                            .trim()
                            .toLowerCase()

                    filtered =
                        filtered.filter(
                            (
                                player
                            ) =>
                                player.name
                                    .toLowerCase()
                                    .includes(
                                        search
                                    )
                        )
                }

                if (
                    selectedTeamFilter
                ) {
                    filtered =
                        filtered.filter(
                            (
                                player
                            ) =>
                                player.team ===
                                selectedTeamFilter
                        )
                }

                if (
                    onlyTargets
                ) {
                    filtered =
                        filtered.filter(
                            (
                                player
                            ) =>
                                targetPlayerIds.has(
                                    player.id
                                )
                        )
                }

                setAvailablePlayers(
                    filtered
                )
            }

        loadPlayers()
    }, [
        isNominateModalOpen,
        requiredRole,
        searchQuery,
        selectedTeamFilter,
        onlyTargets,
        auctionId,
        loadUserTargets,
        targetPlayerIds,
    ])

    // ============================================================
    // DATI UI
    // ============================================================

    const currentTurnTeamName =
        useMemo(
            () =>
                teamsData.find(
                    (team) =>
                        team.id ===
                        currentTurnTeamId
                )?.name ||
                'Nessuna squadra',
            [
                teamsData,
                currentTurnTeamId,
            ]
        )

    const highestBidderName =
        useMemo(
            () =>
                teamsData.find(
                    (team) =>
                        team.id ===
                        highestTeamId
                )?.name ||
                'Nessuno',
            [
                teamsData,
                highestTeamId,
            ]
        )

    const roleDisplay =
        ROLE_NAMES[
            requiredRole
        ] ||
        requiredRole

    const canNominate =
        !!currentTurnTeamId &&
        (
            isAdmin ||
            currentTurnTeamId ===
                myTeamId
        )

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

    const myCurrentRoleCount =
        mySquadCounts[
            normalizeRole(
                requiredRole
            ) as keyof SquadCount
        ]

    const currentRoleLimit =
        ROLE_LIMITS[
            normalizeRole(
                requiredRole
            )
        ]

    const currentRoleComplete =
        myCurrentRoleCount >=
        currentRoleLimit

    // ============================================================
    // RENDER LOADING
    // ============================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8 flex flex-col">

            {/* ==================================================
                HEADER
            ================================================== */}

            <header className="max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between pb-6 border-b border-slate-800 gap-3">

                <div>
                    <h1 className="text-lg font-black uppercase flex items-center gap-2">
                        <Gavel className="w-5 h-5 text-blue-500" />
                        Asta Live
                    </h1>

                    <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">
                        {roleDisplay}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">

                    {myRoleBudget !== null && (
                        <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300 text-xs font-black uppercase flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5" />

                            Budget {roleDisplay}:{' '}
                            {Math.max(
                                0,
                                myRoleBudget -
                                    myRoleSpent
                            )}{' '}
                            CR

                            <span className="text-slate-500 font-normal">
                                /
                                {myRoleBudget}
                            </span>
                        </div>
                    )}

                    <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs font-black uppercase">
                        Budget Tot:{' '}
                        {myBudget} CR
                    </div>

                    <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-xs font-black uppercase">
                        Rosa:{' '}
                        {mySquadCounts.P +
                            mySquadCounts.D +
                            mySquadCounts.C +
                            mySquadCounts.A}
                        /25
                    </div>

                </div>

            </header>

            {/* ==================================================
                MAIN
            ================================================== */}

            <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 py-6 flex-1">

                <div className="lg:col-span-2 space-y-6">

                    {/* ==================================================
                        ASTA IN CORSO
                    ================================================== */}

                    {currentNomination ? (
                        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 md:p-8 space-y-6">

                            {/* GIOCATORE */}

                            <div className="flex justify-between items-start gap-4">

                                <div>

                                    <div className="flex items-center gap-2 flex-wrap">

                                        <span className="text-xs font-bold uppercase px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg">
                                            {
                                                ROLE_NAMES[
                                                    currentNomination.players?.role
                                                ] ||
                                                currentNomination.players?.role
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

                                    </div>

                                    <h2 className="text-3xl font-black uppercase text-white mt-3">
                                        {
                                            currentNomination.players?.name
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
                                        {currentBid}{' '}
                                        CR
                                    </span>

                                </div>

                            </div>

                            {/* STATO */}

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
                                                            message
                                                                .league_teams?.[0]
                                                                ?.name ||
                                                            'Squadra'
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
                                                            className={`flex justify-between items-center text-xs ${
                                                                withdrawn
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

                            {/* BOTTONI */}

                            {!hasWithdrawn ? (
                                <>

                                    <div className="grid grid-cols-3 gap-3">

                                        <button
                                            onClick={() =>
                                                handlePlaceBid(
                                                    currentBid +
                                                        1
                                                )
                                            }
                                            className="py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold uppercase text-sm transition"
                                        >
                                            +1
                                        </button>

                                        <button
                                            onClick={() =>
                                                handlePlaceBid(
                                                    currentBid +
                                                        5
                                                )
                                            }
                                            className="py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold uppercase text-sm transition"
                                        >
                                            +5
                                        </button>

                                        <button
                                            onClick={() =>
                                                handlePlaceBid(
                                                    currentBid +
                                                        10
                                                )
                                            }
                                            className="py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold uppercase text-sm transition"
                                        >
                                            +10
                                        </button>

                                    </div>

                                    <div className="flex gap-2 pt-2 border-t border-slate-700/50">

                                        <input
                                            type="number"
                                            placeholder={`Offerta personalizzata (> ${currentBid})`}
                                            value={
                                                customBidValue
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setCustomBidValue(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />

                                        <button
                                            onClick={() => {
                                                const value =
                                                    parseInt(
                                                        customBidValue,
                                                        10
                                                    )

                                                if (
                                                    Number.isNaN(
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
                                            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-xs uppercase transition"
                                        >
                                            Rilancia
                                        </button>

                                    </div>

                                    <button
                                        onClick={
                                            handleWithdraw
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
                        /* ==================================================
                           ATTESA CHIAMATA
                           ================================================== */

                        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-12 text-center space-y-4">

                            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto">
                                <Gavel className="w-8 h-8 text-blue-400" />
                            </div>

                            <h3 className="text-xl font-black uppercase">
                                In attesa della chiamata
                            </h3>

                            <p className="text-xs text-slate-400">
                                È il turno di{' '}
                                <span className="text-amber-400 font-bold">
                                    {
                                        currentTurnTeamName
                                    }
                                </span>{' '}
                                di chiamare un{' '}
                                <span className="text-white font-bold">
                                    {
                                        roleDisplay
                                    }
                                </span>
                                .
                            </p>

                            {currentRoleComplete &&
                                myTeamId ===
                                    currentTurnTeamId && (
                                    <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                                        Hai completato gli slot
                                        per questo ruolo.
                                        Il tuo turno viene
                                        saltato.
                                    </div>
                                )}

                            {canNominate && (
                                <button
                                    onClick={() =>
                                        setIsNominateModalOpen(
                                            true
                                        )
                                    }
                                    className="mt-4 px-6 py-3 bg-blue-600 rounded-xl font-black text-xs uppercase hover:bg-blue-500 transition"
                                >
                                    Chiama{' '}
                                    {
                                        roleDisplay
                                    }
                                </button>
                            )}

                            {!canNominate &&
                                currentTurnTeamId && (
                                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 uppercase font-bold">
                                        <SkipForward className="w-4 h-4" />
                                        In attesa della
                                        chiamata
                                    </div>
                                )}

                        </div>
                    )}

                </div>

                {/* ==================================================
                    PARTECIPANTI
                    ================================================== */}

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-4 h-fit">

                    <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Partecipanti
                    </h3>

                    {teamsData.map(
                        (
                            team,
                            index
                        ) => {
                            const withdrawn =
                                withdrawnTeamIds.has(
                                    team.id
                                )

                            const isTurn =
                                team.id ===
                                currentTurnTeamId

                            return (
                                <div
                                    key={
                                        team.id
                                    }
                                    className={`p-3 rounded-xl border flex justify-between items-center transition ${
                                        withdrawn
                                            ? 'bg-red-500/5 border-red-500/20 opacity-60'
                                            : isTurn
                                              ? 'bg-amber-500/10 border-amber-500/50'
                                              : 'bg-slate-800/80 border-slate-700'
                                    }`}
                                >

                                    <div className="flex items-center gap-3">

                                        <span className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400">
                                            {index +
                                                1}
                                        </span>

                                        <div>

                                            <span className="font-bold text-xs block">
                                                {
                                                    team.name
                                                }
                                            </span>

                                            {isTurn &&
                                                !withdrawn && (
                                                    <span className="text-[10px] uppercase font-black text-amber-400 block mt-1">
                                                        Turno
                                                    </span>
                                                )}

                                            {withdrawn && (
                                                <span className="text-[10px] uppercase font-black text-red-400 block mt-1">
                                                    Ritirata
                                                </span>
                                            )}

                                        </div>

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

            {/* ====================================================
                MODAL ASSEGNAZIONE
            ==================================================== */}

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

                                <div className="flex justify-between items-center text-xs text-slate-400">
                                    <span>
                                        Ruolo
                                    </span>

                                    <span className="font-black text-white">
                                        {
                                            ROLE_NAMES[
                                                congratulatedPlayer.role
                                            ]
                                        }
                                    </span>
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

                            </div>

                            <button
                                onClick={async () => {
                                    setIsCongratulationModalOpen(
                                        false
                                    )

                                    setCongratulatedPlayer(
                                        null
                                    )

                                    await fetchParticipantsAndTeams()

                                    if (
                                        myTeamId
                                    ) {
                                        await Promise.all([
                                            fetchSquadCounts(
                                                myTeamId
                                            ),
                                            fetchRoleBudgetInfo(
                                                myTeamId,
                                                requiredRoleRef.current
                                            ),
                                        ])
                                    }

                                    await fetchCurrentNomination()
                                }}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition"
                            >
                                Continua l'Asta
                            </button>

                        </div>

                    </div>
                )}

            {/* ====================================================
                MODAL CHIAMATA
            ==================================================== */}

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

                        {/* HEADER */}

                        <div className="flex justify-between items-center">

                            <h3 className="text-sm font-black uppercase text-white">
                                Chiama{' '}
                                {
                                    roleDisplay
                                }
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

                        {/* INFO TURNO */}

                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-xs text-slate-400">
                            Turno di{' '}
                            <span className="text-amber-400 font-black">
                                {
                                    currentTurnTeamName
                                }
                            </span>
                        </div>

                        {/* PREZZO BASE */}

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
                                        event
                                    ) =>
                                        setBasePriceValue(
                                            event
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

                        {/* FILTRI */}

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
                                    event
                                ) =>
                                    setSearchQuery(
                                        event
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
                                    event
                                ) =>
                                    setSelectedTeamFilter(
                                        event
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
                                        (
                                            previous
                                        ) =>
                                            !previous
                                    )
                                }
                                className={`px-4 py-3 rounded-lg text-xs font-black uppercase transition flex items-center gap-1.5 border ${
                                    onlyTargets
                                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                                }`}
                            >

                                <Star
                                    className={`w-4 h-4 ${
                                        onlyTargets
                                            ? 'fill-slate-950'
                                            : ''
                                    }`}
                                />

                                Obiettivi

                            </button>

                        </div>

                        {/* ELENCO */}

                        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">

                            {availablePlayers.length ===
                            0 ? (
                                <p className="text-center text-xs text-slate-500 py-6 uppercase font-semibold">
                                    Nessun giocatore trovato
                                </p>
                            ) : (
                                availablePlayers.map(
                                    (
                                        player
                                    ) => (
                                        <div
                                            key={
                                                player.id
                                            }
                                            className="flex justify-between items-center p-3 rounded-xl border bg-slate-800/80 border-slate-700/60"
                                        >

                                            <div className="space-y-1 flex items-center gap-2">

                                                {targetPlayerIds.has(
                                                    player.id
                                                ) && (
                                                    <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                                                )}

                                                <div>

                                                    <span className="font-bold text-sm text-white">
                                                        {
                                                            player.name
                                                        }
                                                    </span>

                                                    <span className="text-xs text-slate-400 block">
                                                        {
                                                            player.team
                                                        }
                                                    </span>

                                                </div>

                                            </div>

                                            <button
                                                disabled={
                                                    isSubmitting
                                                }
                                                onClick={() =>
                                                    handleNominatePlayer(
                                                        player.id
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