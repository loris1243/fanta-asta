'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  LayoutDashboard,
  Shield,
  Target,
  ClipboardList,
  Inbox,
  Users,
  Settings,
  ScrollText,
  LogOut,
  Play,
  Loader2,
} from 'lucide-react'

import { supabase } from '../../../lib/supabaseClient'

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
  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null)

  const currentTeamIdRef = useRef<string | null>(null)

  const participantsChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null)

  const auctionChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    if (!auctionId) return

    let isMounted = true

    /*
     * ============================================================
     * RECUPERO SQUADRE
     * ============================================================
     *
     * Mostriamo tutte le squadre della lega.
     *
     * Una squadra viene considerata partecipante/online solo se
     * esiste il relativo record in auction_participants.
     */
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

            /*
             * Una squadra è online solamente se esiste
             * come partecipante all'asta ed è_online=true.
             */
            is_online:
              participant?.is_online === true,
          }
        })

      if (isMounted) {
        setTeamsData(updatedTeams)
      }
    }

    /*
     * ============================================================
     * INIT
     * ============================================================
     */
    const init = async () => {
      setLoading(true)

      /*
       * ----------------------------------------------------------
       * SESSIONE
       * ----------------------------------------------------------
       */
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const user = session?.user

      if (!user) {
        router.push('/login')
        return
      }

      /*
       * ----------------------------------------------------------
       * RECUPERO ASTA
       * ----------------------------------------------------------
       */
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

        /*
         * Se l'asta è già iniziata, non ha senso rimanere
         * nella Waiting Room.
         */
        if (
          auctionData.status === 'in_corso'
        ) {
          router.push(
            `/asta/${auctionId}/live`
          )
          return
        }
      }

      /*
       * ----------------------------------------------------------
       * PROFILO UTENTE
       * ----------------------------------------------------------
       */
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select(
          'id, username, role'
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

      /*
       * ----------------------------------------------------------
       * RECUPERO SQUADRA DELL'UTENTE
       * ----------------------------------------------------------
       */
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

      /*
       * ----------------------------------------------------------
       * REGISTRAZIONE PARTECIPANTE
       * ----------------------------------------------------------
       *
       * Questo è il punto fondamentale:
       *
       * quando l'utente entra nella Waiting Room viene creato
       * (o aggiornato) il record in auction_participants.
       *
       * Quindi solo le squadre che entrano realmente nella sala
       * partecipano all'asta.
       */
      if (teamData) {
        currentTeamIdRef.current =
          teamData.id

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

      /*
       * ----------------------------------------------------------
       * CARICAMENTO SQUADRE
       * ----------------------------------------------------------
       */
      await fetchTeams()

      if (!isMounted) return

      setLoading(false)

      /*
       * ----------------------------------------------------------
       * REALTIME PARTECIPANTI
       * ----------------------------------------------------------
       */
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

      /*
       * ----------------------------------------------------------
       * REALTIME STATO ASTA
       * ----------------------------------------------------------
       */
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

    /*
     * ============================================================
     * CLEANUP
     * ============================================================
     *
     * IMPORTANTE:
     *
     * NON impostiamo più is_online=false qui.
     *
     * Il cleanup viene eseguito anche quando React smonta la
     * Waiting Room perché l'utente passa alla pagina /live.
     *
     * Se facessimo:
     *
     *   is_online: false
     *
     * qui, il normale passaggio Waiting Room -> Live
     * renderebbe immediatamente offline la squadra.
     *
     * Inoltre il record in auction_participants deve rimanere
     * intatto perché determina chi partecipa all'asta.
     */
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

      /*
       * NON modificare auction_participants qui.
       *
       * La squadra rimane partecipante anche passando alla Live.
       */
    }
  }, [auctionId, router])

  /*
   * ============================================================
   * AVVIO ASTA
   * ============================================================
   */
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

  /*
   * ============================================================
   * STATISTICHE ONLINE
   * ============================================================
   */
  const allTeamsOnline =
    teamsData.length > 0 &&
    teamsData.every(
      (team) => team.is_online
    )

  const onlineTeams =
    teamsData.filter(
      (team) => team.is_online
    ).length

  /*
   * ============================================================
   * LOGOUT
   * ============================================================
   */
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */
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

  /*
   * ============================================================
   * PAGINA
   * ============================================================
   */
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row">

      {/* =======================================================
          SIDEBAR
      ======================================================= */}

      <aside
        className={`
          relative shrink-0
          bg-slate-900/95
          border-r border-slate-800
          shadow-xl
          transition-[width]
          duration-300
          ease-in-out
          flex flex-col
          ${
            isSidebarOpen
              ? 'w-full md:w-64'
              : 'w-full md:w-[76px]'
          }
        `}
      >

        <div className="relative p-3 md:p-4">

          <div
            className={`
              relative flex items-center
              ${
                isSidebarOpen
                  ? 'justify-between'
                  : 'justify-center'
              }
              min-h-10
            `}
          >

            <div
              className={`
                flex items-center
                ${
                  isSidebarOpen
                    ? 'gap-3'
                    : 'justify-center'
                }
              `}
            >

              <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Building2 className="w-5 h-5" />
              </div>

              {isSidebarOpen && (
                <div>

                  <h1 className="font-extrabold text-base tracking-tight text-white leading-tight">
                    FantAsta
                  </h1>

                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Aste Live
                  </p>

                </div>
              )}

            </div>

            <button
              type="button"
              onClick={() =>
                setIsSidebarOpen(
                  (prev) => !prev
                )
              }
              className={`
                hidden md:flex
                items-center justify-center
                w-7 h-7
                rounded-lg
                text-slate-500
                hover:text-white
                hover:bg-slate-800
                transition-all
                ${
                  !isSidebarOpen
                    ? 'absolute -right-2 top-1/2 -translate-y-1/2 z-20 bg-slate-900 border border-slate-700 shadow-lg'
                    : ''
                }
              `}
              aria-label={
                isSidebarOpen
                  ? 'Comprimi sidebar'
                  : 'Espandi sidebar'
              }
            >
              <span className="text-[10px] font-black">
                {isSidebarOpen
                  ? '◀'
                  : '▶'}
              </span>
            </button>

          </div>

        </div>

        <div
          className={`
            mx-3 md:mx-4 mb-5
            bg-slate-950/70
            border border-slate-800
            rounded-xl
            ${
              isSidebarOpen
                ? 'p-3'
                : 'p-2'
            }
          `}
        >

          <div
            className={`
              flex items-center
              ${
                isSidebarOpen
                  ? 'gap-3'
                  : 'justify-center'
              }
            `}
          >

            <div className="w-10 h-10 shrink-0 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/30 flex items-center justify-center font-black text-xs">
              {currentUser?.username
                ?.slice(0, 2)
                .toUpperCase() || 'U'}
            </div>

            {isSidebarOpen && (
              <div className="min-w-0">

                <p className="text-sm font-bold text-white truncate">
                  {currentUser?.username ||
                    'Utente'}
                </p>

                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                  {isAdmin
                    ? 'Amministratore'
                    : 'Partecipante'}
                </p>

              </div>
            )}

          </div>

        </div>

        <nav className="flex-1 px-3 md:px-4 overflow-y-auto">

          <div className="space-y-1.5">

            <Link
              href="/"
              className="flex items-center h-11 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all gap-3 px-3.5"
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />

              {isSidebarOpen && (
                <span>
                  Dashboard
                </span>
              )}
            </Link>

            <Link
              href="/rosa"
              className="flex items-center h-11 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all gap-3 px-3.5"
            >
              <Shield className="w-4 h-4 shrink-0 text-emerald-400" />

              {isSidebarOpen && (
                <span>
                  La Mia Squadra
                </span>
              )}
            </Link>

            <Link
              href="/obiettivi"
              className="flex items-center h-11 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all gap-3 px-3.5"
            >
              <Target className="w-4 h-4 shrink-0 text-amber-400" />

              {isSidebarOpen && (
                <span>
                  I Miei Obiettivi
                </span>
              )}
            </Link>

            <Link
              href="/listone"
              className="flex items-center h-11 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all gap-3 px-3.5"
            >
              <ClipboardList className="w-4 h-4 shrink-0" />

              {isSidebarOpen && (
                <span>
                  Listone
                </span>
              )}
            </Link>

            {isAdmin && (
              <div className="pt-4 mt-4 border-t border-slate-800">

                {isSidebarOpen && (
                  <span className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Pannello Admin
                  </span>
                )}

                <Link
                  href="/admin/import-listone"
                  className="flex items-center h-10 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all gap-3 px-3.5"
                >
                  <Inbox className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span>
                      Importa Listone
                    </span>
                  )}
                </Link>

                <Link
                  href="/admin/users"
                  className="flex items-center h-10 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all gap-3 px-3.5"
                >
                  <Users className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span>
                      Gestione Partecipanti
                    </span>
                  )}
                </Link>

                <Link
                  href="/admin/settings"
                  className="flex items-center h-10 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all gap-3 px-3.5"
                >
                  <Settings className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span>
                      Configurazione Lega
                    </span>
                  )}
                </Link>

                {isSidebarOpen && (
                  <span className="px-2 pt-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Anagrafiche
                  </span>
                )}

                <Link
                  href="/admin/anagrafiche/serie-a"
                  className="flex items-center h-9 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all gap-3 px-3.5"
                >
                  <ScrollText className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span>
                      Squadre Serie A
                    </span>
                  )}
                </Link>

                <Link
                  href="/admin/anagrafiche/squadre_lega"
                  className="flex items-center h-9 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all gap-3 px-3.5"
                >
                  <Building2 className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span>
                      Squadre Lega
                    </span>
                  )}
                </Link>

              </div>
            )}

          </div>

        </nav>

        <div className="mt-auto p-3 md:p-4 border-t border-slate-800">

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center h-11 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all gap-3 px-3.5"
          >
            <LogOut className="w-4 h-4 shrink-0" />

            {isSidebarOpen && (
              <span>
                Esci
              </span>
            )}
          </button>

        </div>

      </aside>

      {/* =======================================================
          MAIN
      ======================================================= */}

      <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">

        <div className="max-w-4xl mx-auto">

          {/* HEADER */}

          <div className="mb-8">

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 hover:text-white uppercase transition-colors mb-5"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>

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