'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Users,
  Play,
  Loader2,
  Shield,
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

  const currentTeamIdRef = useRef<string | null>(null)

  const participantsChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null)

  const auctionChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!auctionId) return

    let isMounted = true

    const fetchTeams = async () => {
      const {
        data: teams,
        error: teamsError,
      } = await supabase
        .from('league_teams')
        .select('id, name, logo_url')
        .order('name', {
          ascending: true,
        })

      if (teamsError) {
        console.error(
          'Errore recupero squadre:',
          teamsError.message
        )
        return
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
          'Errore recupero partecipanti:',
          participantsError.message
        )
        return
      }

      const updatedTeams: TeamData[] =
        (teams || []).map((team) => {
          const participant =
            participants?.find(
              (item) =>
                item.team_id === team.id
            )

          return {
            ...team,
            is_online:
              participant?.is_online === true,
          }
        })

      if (isMounted) {
        setTeamsData(updatedTeams)
      }
    }

    const init = async () => {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const user = session?.user

      if (!user) {
        router.push('/login')
        return
      }

      const {
        data: auctionData,
        error: auctionError,
      } = await supabase
        .from('auctions')
        .select('status')
        .eq('id', auctionId)
        .maybeSingle()

      if (auctionError) {
        console.error(
          'Errore recupero asta:',
          auctionError.message
        )
      }

      if (auctionData?.status) {
        setAuctionStatus(auctionData.status)

        if (
          auctionData.status === 'in_corso'
        ) {
          router.push(
            `/asta/${auctionId}/live`
          )
          return
        }
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select(
          'id, username, role, budget'
        )
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error(
          'Errore recupero profilo:',
          profileError.message
        )
      }

      if (profile && isMounted) {
        setCurrentUser(profile)
        setIsAdmin(
          profile.role === 'admin'
        )
      }

      const {
        data: teamData,
        error: teamError,
      } = await supabase
        .from('league_teams')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (teamError) {
        console.error(
          'Errore recupero squadra:',
          teamError.message
        )
      }

      if (teamData) {
        currentTeamIdRef.current =
          teamData.id

        // Calcolo budget rimanente per la sidebar
        const { data: settings } = await supabase
          .from('league_settings')
          .select('initial_budget')
          .maybeSingle()

        const initialBudget =
          settings?.initial_budget ??
          profile?.budget ??
          500

        const { data: boughtPlayers } = await supabase
          .from('league_team_players')
          .select('price')
          .eq('team_id', teamData.id)

        const totalSpent =
          boughtPlayers?.reduce(
            (acc, player) =>
              acc + (player.price || 0),
            0
          ) ?? 0

        setRemainingBudget(
          Math.max(
            initialBudget - totalSpent,
            0
          )
        )

        const {
          error: upsertError,
        } = await supabase
          .from('auction_participants')
          .upsert(
            {
              auction_id: auctionId,
              team_id: teamData.id,
              is_online: true,
            },
            {
              onConflict:
                'auction_id,team_id',
            }
          )

        if (upsertError) {
          console.error(
            'Errore registrazione partecipante:',
            upsertError.message
          )
        }
      }

      await fetchTeams()

      if (!isMounted) return

      setLoading(false)

      if (
        participantsChannelRef.current
      ) {
        await supabase.removeChannel(
          participantsChannelRef.current
        )

        participantsChannelRef.current =
          null
      }

      participantsChannelRef.current =
        supabase
          .channel(
            `auction-participants-${auctionId}`
          )
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

      if (
        auctionChannelRef.current
      ) {
        await supabase.removeChannel(
          auctionChannelRef.current
        )

        auctionChannelRef.current = null
      }

      auctionChannelRef.current =
        supabase
          .channel(
            `auction-status-${auctionId}`
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'auctions',
              filter: `id=eq.${auctionId}`,
            },
            (payload) => {
              const newStatus =
                payload.new.status

              setAuctionStatus(
                newStatus
              )

              if (
                newStatus === 'in_corso'
              ) {
                router.push(
                  `/asta/${auctionId}/live`
                )
              }
            }
          )
          .subscribe()
    }

    init()

    return () => {
      isMounted = false

      if (
        participantsChannelRef.current
      ) {
        supabase.removeChannel(
          participantsChannelRef.current
        )

        participantsChannelRef.current =
          null
      }

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
  }, [auctionId, router])

  const handleForceStart = async () => {
    if (!auctionId || starting) return

    setStarting(true)

    const {
      error,
    } = await supabase
      .from('auctions')
      .update({
        status: 'in_corso',
      })
      .eq('id', auctionId)
      .neq('status', 'in_corso')

    if (error) {
      console.error(
        "Errore durante l'avvio:",
        error.message
      )

      setStarting(false)
      return
    }

    setAuctionStatus('in_corso')

    router.push(
      `/asta/${auctionId}/live`
    )
  }

  const allTeamsOnline =
    teamsData.length > 0 &&
    teamsData.every(
      (team) => team.is_online
    )

  const onlineTeams =
    teamsData.filter(
      (team) => team.is_online
    ).length

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />

          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Caricamento sala...
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row">

      {/* Sostituito il vecchio aside con il componente condiviso */}
      <DashboardSidebar
        user={{ username: currentUser?.username || 'Utente', role: currentUser?.role || 'user' }}
        remainingBudget={remainingBudget}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onLogout={handleLogout}
      />

      {/* =======================================================
          MAIN
      ======================================================= */}

      <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">

        <div className="max-w-4xl mx-auto">

          {/* HEADER */}

          <div className="mb-8">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

              <div className="flex items-center gap-4">

                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Users className="w-6 h-6" />
                </div>

                <div>

                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                    Sala d'Attesa
                  </h1>

                  <p className="text-sm text-slate-400 mt-1">
                    {allTeamsOnline
                      ? 'Tutte le squadre sono connesse.'
                      : 'In attesa che i partecipanti entrino...'}
                  </p>

                </div>

              </div>

              <div className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-2 rounded-xl bg-slate-800 border border-slate-700">

                <span
                  className={`w-2 h-2 rounded-full ${
                    onlineTeams > 0
                      ? 'bg-emerald-500'
                      : 'bg-slate-600'
                  }`}
                />

                <span className="text-xs font-bold text-slate-300">
                  {onlineTeams}/
                  {teamsData.length}{' '}
                  online
                </span>

              </div>

            </div>

          </div>

          {/* TEAMS */}

          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">

            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">

              <div>

                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  Partecipanti
                </h2>

                <p className="text-[11px] text-slate-500 mt-1">
                  Squadre presenti nella sessione d'asta
                </p>

              </div>

              <span className="text-xs font-bold text-slate-500">
                {teamsData.length}
              </span>

            </div>

            {teamsData.length === 0 ? (

              <div className="px-5 py-12 text-center">

                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 mx-auto mb-3 flex items-center justify-center">
                  <Users className="w-5 h-5 text-slate-600" />
                </div>

                <p className="text-sm font-bold text-slate-400">
                  Nessun partecipante ancora presente
                </p>

                <p className="text-xs text-slate-600 mt-1">
                  Le squadre appariranno qui quando entreranno nella sala.
                </p>

              </div>

            ) : (

              <div className="divide-y divide-slate-700/70">

                {teamsData.map((team) => (

                  <div
                    key={team.id}
                    className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-800/80 transition-colors"
                  >

                    <div className="flex items-center gap-3 min-w-0">

                      {team.logo_url ? (

                        <img
                          src={team.logo_url}
                          alt=""
                          className="w-10 h-10 object-contain rounded-xl bg-slate-900/70 p-1 border border-slate-700 shrink-0"
                        />

                      ) : (

                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                          <Shield className="w-5 h-5" />
                        </div>

                      )}

                      <div className="min-w-0">

                        <p className="font-bold text-sm text-white truncate">
                          {team.name}
                        </p>

                        <p
                          className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                            team.is_online
                              ? 'text-emerald-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {team.is_online
                            ? 'Online'
                            : 'Offline'}
                        </p>

                      </div>

                    </div>

                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        team.is_online
                          ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
                          : 'bg-slate-600'
                      }`}
                    />

                  </div>

                ))}

              </div>

            )}

          </div>

          {/* ADMIN ACTION */}

          {isAdmin &&
            auctionStatus !== 'in_corso' && (

            <div className="mt-6 bg-slate-800/80 border border-slate-700 rounded-2xl p-5 md:p-6">

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                <div>

                  <p className="text-sm font-black text-white">
                    Controllo asta
                  </p>

                  <p className="text-xs text-slate-500 mt-1">
                    {allTeamsOnline
                      ? 'Tutti i partecipanti sono online.'
                      : 'Puoi avviare comunque l’asta.'}
                  </p>

                </div>

                <button
                  type="button"
                  onClick={handleForceStart}
                  disabled={starting}
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    h-11
                    px-5
                    rounded-xl
                    bg-blue-600
                    hover:bg-blue-500
                    disabled:bg-slate-700
                    disabled:text-slate-500
                    text-white
                    text-xs
                    font-black
                    uppercase
                    tracking-wide
                    shadow-lg
                    shadow-blue-600/20
                    transition-all
                    shrink-0
                  "
                >

                  {starting ? (

                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Avvio...
                    </>

                  ) : (

                    <>
                      <Play className="w-4 h-4" />

                      {allTeamsOnline
                        ? 'Avvia Asta'
                        : 'Forza Avvio'}
                    </>

                  )}

                </button>

              </div>

            </div>

          )}

          {/* STATUS */}

          {auctionStatus === 'in_corso' && (

            <div className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">

              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Play className="w-4 h-4 text-emerald-400" />
              </div>

              <div>

                <p className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                  Asta in corso
                </p>

                <p className="text-[11px] text-emerald-400/70 mt-0.5">
                  Apertura della sala d'asta...
                </p>

              </div>

            </div>

          )}

        </div>

      </main>

    </div>
  )
}