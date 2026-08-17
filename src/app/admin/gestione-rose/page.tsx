'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { swapPlayersBetweenTeams, releasePlayer } from '../../../app/actions/admin'
import { getCurrentUser, logout } from '../../actions/auth'
import { ArrowLeftRight, Shield, AlertCircle, CheckCircle2, UserMinus } from 'lucide-react'
import DashboardSidebar from '../../../components/DashboardSidebar'

interface UserProfile {
  id: string
  username: string
  role: string
  budget: number
}

type TeamRosterItem = {
  id: string
  price: number
  players: {
    id: string
    name: string
    team: string
    role: string
  } | null
}

type TeamWithRoster = {
  id: string
  name: string
  roster: TeamRosterItem[]
}

type FreePlayer = {
  id: string
  name: string
  team: string
  role: string
}

export default function GestioneRosePage() {
  const [teams, setTeams] = useState<TeamWithRoster[]>([])
  const [freePlayers, setFreePlayers] = useState<FreePlayer[]>([])
  const [loading, setLoading] = useState(true)

  const [user, setUser] = useState<UserProfile | null>(null)
  const [remainingBudget] = useState(500)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const [modalType, setModalType] = useState<'swap' | 'release' | null>(null)
  const [selectedItem, setSelectedItem] = useState<{ item: TeamRosterItem; fromTeamId: string } | null>(null)
  
  const [targetTeamId, setTargetTeamId] = useState('')
  const [targetTeamPlayerId, setTargetTeamPlayerId] = useState('')
  
  const [releaseActionType, setReleaseActionType] = useState<'refund' | 'swap'>('refund')
  const [selectedFreePlayerId, setSelectedFreePlayerId] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ success?: string; error?: string } | null>(null)

  const handleLogout = async () => {
    await logout()
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const currentUser = await getCurrentUser()
      if (currentUser) setUser(currentUser)

      const { data: teamsData, error: teamsError } = await supabase
        .from('league_teams')
        .select('id, name')
        .order('name')

      if (teamsError) throw teamsError

      const { data: assignedData } = await supabase
        .from('league_team_players')
        .select('player_id')

      const assignedIds = new Set((assignedData || []).map((row) => row.player_id))

      const { data: allPlayersData, error: apError } = await supabase
        .from('players')
        .select('id, name, team, role')
        .order('name')

      if (apError) throw apError

      const unassigned = (allPlayersData || []).filter((p) => !assignedIds.has(p.id))
      setFreePlayers(unassigned)

      const teamsWithRostersPromises = teamsData.map(async (team) => {
        const { data: rosterData } = await supabase
          .from('league_team_players')
          .select(`
            id,
            price,
            players (
              id,
              name,
              team,
              role
            )
          `)
          .eq('team_id', team.id)

        const formattedRoster: TeamRosterItem[] = (rosterData || []).map((item: any) => ({
          id: item.id,
          price: item.price,
          players: Array.isArray(item.players) ? (item.players[0] || null) : (item.players || null)
        }))

        return {
          ...team,
          roster: formattedRoster
        }
      })

      const resolvedTeams = await Promise.all(teamsWithRostersPromises)
      setTeams(resolvedTeams)
    } catch (err) {
      console.error('Errore nel caricamento:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return

    setIsSubmitting(true)
    setFeedback(null)

    if (modalType === 'swap') {
      if (!targetTeamId || !targetTeamPlayerId) return
      if (selectedItem.fromTeamId === targetTeamId) {
        setFeedback({ error: 'La squadra di destinazione è uguale a quella attuale!' })
        setIsSubmitting(false)
        return
      }

      const res = await swapPlayersBetweenTeams(selectedItem.item.id, targetTeamPlayerId)
      if (res.success) {
        setFeedback({ success: 'Scambio effettuato con successo (nessuna modifica ai crediti)!' })
        setSelectedItem(null)
        await fetchData()
      } else {
        setFeedback({ error: res.error || 'Errore durante lo scambio.' })
      }
    } else if (modalType === 'release') {
      const res = await releasePlayer(
        selectedItem.item.id, 
        releaseActionType, 
        releaseActionType === 'swap' ? selectedFreePlayerId : undefined
      )

      if (res.success) {
        setFeedback({ success: releaseActionType === 'refund' ? 'Giocatore svincolato con rimborso crediti!' : 'Giocatore svincolato e rimpiazzato con successo!' })
        setSelectedItem(null)
        await fetchData()
      } else {
        setFeedback({ error: res.error || 'Errore durante lo svincolo.' })
      }
    }

    setIsSubmitting(false)
  }

  if (loading || !user) {
    return (
      <div className="p-8 text-slate-400 text-center bg-slate-950 min-h-screen flex items-center justify-center">
        Caricamento pannello di gestione in corso...
      </div>
    )
  }

  const currentRoleFilter = selectedItem?.item.players?.role
  const filteredFreePlayers = freePlayers.filter(p => p.role === currentRoleFilter)

  const targetTeamData = teams.find(t => t.id === targetTeamId)
  const filteredTargetTeamPlayers = (targetTeamData?.roster || []).filter(item => item.players?.role === currentRoleFilter)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row">
      <DashboardSidebar
        user={{ username: user.username, role: user.role }}
        remainingBudget={remainingBudget}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onLogout={handleLogout}
      />

      <main className="flex-1 p-5 md:p-8 xl:p-10 space-y-6 overflow-y-auto">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <ArrowLeftRight className="w-7 h-7 text-blue-500" />
            Gestione Rose e Svincoli
          </h1>
          <p className="text-sm text-slate-400">
            Effettua scambi diretti tra rose (senza variazioni di budget) o gestisci gli svincoli.
          </p>
        </div>

        {feedback && (
          <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold ${
            feedback.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {feedback.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{feedback.success || feedback.error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div key={team.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                  <h2 className="font-bold text-white text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    {team.name}
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg">
                    {team.roster.length} giocatori
                  </span>
                </div>

                {team.roster.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">Nessun giocatore in rosa</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {team.roster.map((item) => (
                      <div 
                        key={item.id}
                        className="flex items-center justify-between p-2.5 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-white truncate">{item.players?.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                            {item.players?.role} • {item.players?.team} • <span className="text-blue-400 font-semibold">{item.price} FM</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem({ item, fromTeamId: team.id })
                              setModalType('swap')
                              setTargetTeamId('')
                              setTargetTeamPlayerId('')
                              setFeedback(null)
                            }}
                            className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg transition-all cursor-pointer"
                            title="Scambia con altra squadra"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem({ item, fromTeamId: team.id })
                              setModalType('release')
                              setReleaseActionType('refund')
                              setSelectedFreePlayerId('')
                              setFeedback(null)
                            }}
                            className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg transition-all cursor-pointer"
                            title="Svincola giocatore"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {selectedItem && modalType && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {modalType === 'swap' ? 'Scambio tra Squadre' : 'Gestione Svincolo'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Giocatore in uscita: <span className="text-white font-semibold">{selectedItem.item.players?.name}</span> ({selectedItem.item.players?.role})
                </p>
              </div>

              <form onSubmit={handleActionSubmit} className="space-y-4">
                {modalType === 'swap' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        1. Seleziona Squadra Destinataria
                      </label>
                      <select
                        value={targetTeamId}
                        onChange={(e) => {
                          setTargetTeamId(e.target.value)
                          setTargetTeamPlayerId('')
                        }}
                        required
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                      >
                        <option value="" disabled>Seleziona squadra...</option>
                        {teams
                          .filter((t) => t.id !== selectedItem.fromTeamId)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {targetTeamId && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          2. Seleziona Giocatore in Cambio ({currentRoleFilter})
                        </label>
                        <select
                          value={targetTeamPlayerId}
                          onChange={(e) => setTargetTeamPlayerId(e.target.value)}
                          required
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                        >
                          <option value="" disabled>Seleziona giocatore da ricevere...</option>
                          {filteredTargetTeamPlayers.length === 0 ? (
                            <option disabled value="">Nessun giocatore di questo ruolo in questa squadra</option>
                          ) : (
                            filteredTargetTeamPlayers.map((tp) => (
                              <option key={tp.id} value={tp.id}>
                                {tp.players?.name} ({tp.players?.team}) - {tp.price} FM
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Tipo di Svincolo
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setReleaseActionType('refund')}
                          className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                            releaseActionType === 'refund' 
                              ? 'bg-red-600/20 border-red-500 text-red-300' 
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          Solo Rimborso ({selectedItem.item.price} FM)
                        </button>
                        <button
                          type="button"
                          onClick={() => setReleaseActionType('swap')}
                          className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                            releaseActionType === 'swap' 
                              ? 'bg-blue-600/20 border-blue-500 text-blue-300' 
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          Svincolo + Rimpiazzo (1 FM)
                        </button>
                      </div>
                    </div>

                    {releaseActionType === 'swap' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Seleziona Nuovo Giocatore ({currentRoleFilter})
                        </label>
                        <select
                          value={selectedFreePlayerId}
                          onChange={(e) => setSelectedFreePlayerId(e.target.value)}
                          required
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                        >
                          <option value="" disabled>Seleziona svincolato...</option>
                          {filteredFreePlayers.length === 0 ? (
                            <option disabled value="">Nessun giocatore disponibile in questo ruolo</option>
                          ) : (
                            filteredFreePlayers.map((fp) => (
                              <option key={fp.id} value={fp.id}>
                                {fp.name} ({fp.team})
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || (modalType === 'swap' && (!targetTeamId || !targetTeamPlayerId)) || (modalType === 'release' && releaseActionType === 'swap' && !selectedFreePlayerId)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'Elaborazione...' : 'Conferma'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}