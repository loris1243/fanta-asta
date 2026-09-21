'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { swapPlayersBetweenTeams, releasePlayer } from '../../../app/actions/admin'
import { getCurrentUser, logout } from '../../actions/auth'
import { ArrowLeftRight, Shield, AlertCircle, CheckCircle2, UserMinus, Search } from 'lucide-react'
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
  groupedRoster: Record<string, TeamRosterItem[]>
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
  
  // Stati per l'Autocomplete del giocatore svincolato
  const [freePlayerSearch, setFreePlayerSearch] = useState('')
  const [selectedFreePlayer, setSelectedFreePlayer] = useState<FreePlayer | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [swapReplacementMatchPrice, setSwapReplacementMatchPrice] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ success?: string; error?: string } | null>(null)

  const handleLogout = async () => {
    await logout()
  }

  // Chiudi il menu a tendina se si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

      const { data: leagueSettingsData } = await supabase
        .from('league_settings')
        .select('swap_replacement_match_price')
        .single()

      setSwapReplacementMatchPrice(Boolean(leagueSettingsData?.swap_replacement_match_price))

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

        formattedRoster.sort((a, b) => {
          const nameA = a.players?.name || ''
          const nameB = b.players?.name || ''
          return nameA.localeCompare(nameB)
        })

        const groupedRoster = formattedRoster.reduce((acc: Record<string, TeamRosterItem[]>, item) => {
          const role = item.players?.role || 'Senza Ruolo'
          if (!acc[role]) acc[role] = []
          acc[role].push(item)
          return acc
        }, {})

        return { ...team, roster: formattedRoster, groupedRoster }
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
    console.log("=== SUBMIT AVVIATO ===", { modalType, releaseActionType, selectedFreePlayer, targetTeamId, targetTeamPlayerId })
    
    if (!selectedItem) {
      console.log("Errore: selectedItem mancante")
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    try {
      if (modalType === 'swap') {
        if (!targetTeamId || !targetTeamPlayerId) {
          console.log("Errore: dati scambio mancanti")
          setIsSubmitting(false)
          return
        }
        if (selectedItem.fromTeamId === targetTeamId) {
          setFeedback({ error: 'La squadra di destinazione è uguale a quella attuale!' })
          setIsSubmitting(false)
          return
        }

        console.log("Chiamata a swapPlayersBetweenTeams...")
        const res = await swapPlayersBetweenTeams(selectedItem.item.id, targetTeamPlayerId)
        console.log("Risposta swap:", res)

        if (res.success) {
          setFeedback({ success: 'Scambio effettuato con successo!' })
          setSelectedItem(null)
          await fetchData()
        } else {
          setFeedback({ error: res.error || 'Errore durante lo scambio.' })
        }
      } else if (modalType === 'release') {
        console.log("Chiamata a releasePlayer con:", {
          teamPlayerId: selectedItem.item.id,
          releaseActionType,
          newPlayerId: releaseActionType === 'swap' ? selectedFreePlayer?.id : undefined
        })

        const res = await releasePlayer(
          selectedItem.item.id, 
          releaseActionType, 
          releaseActionType === 'swap' ? selectedFreePlayer?.id : undefined
        )
        console.log("Risposta release:", res)

        if (res.success) {
          setFeedback({ success: releaseActionType === 'refund' ? 'Giocatore svincolato con rimborso!' : 'Giocatore svincolato e rimpiazzato con successo!' })
          setSelectedItem(null)
          await fetchData()
        } else {
          setFeedback({ error: res.error || 'Errore durante lo svincolo.' })
        }
      }
    } catch (err) {
      console.error("Eccezione catturata nel submit:", err)
      setFeedback({ error: 'Errore imprevisto durante l\'operazione.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // const handleActionSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault()
  //   if (!selectedItem) return

  //   setIsSubmitting(true)
  //   setFeedback(null)

  //   if (modalType === 'swap') {
  //     if (!targetTeamId || !targetTeamPlayerId) return
  //     if (selectedItem.fromTeamId === targetTeamId) {
  //       setFeedback({ error: 'La squadra di destinazione è uguale a quella attuale!' })
  //       setIsSubmitting(false)
  //       return
  //     }

  //     const res = await swapPlayersBetweenTeams(selectedItem.item.id, targetTeamPlayerId)
  //     if (res.success) {
  //       setFeedback({ success: 'Scambio effettuato con successo!' })
  //       setSelectedItem(null)
  //       await fetchData()
  //     } else {
  //       setFeedback({ error: res.error || 'Errore durante lo scambio.' })
  //     }
  //   } else if (modalType === 'release') {
  //     const res = await releasePlayer(
  //       selectedItem.item.id, 
  //       releaseActionType, 
  //       releaseActionType === 'swap' ? selectedFreePlayer?.id : undefined
  //     )

  //     if (res.success) {
  //       setFeedback({ success: releaseActionType === 'refund' ? 'Giocatore svincolato con rimborso!' : 'Giocatore svincolato e rimpiazzato con successo!' })
  //       setSelectedItem(null)
  //       await fetchData()
  //     } else {
  //       setFeedback({ error: res.error || 'Errore durante lo svincolo.' })
  //     }
  //   }

  //   setIsSubmitting(false)
  // }

  if (loading || !user) {
    return (
      <div className="p-8 text-muted text-center bg-background min-h-screen flex items-center justify-center">
        Caricamento pannello di gestione in corso...
      </div>
    )
  }

  const currentRoleFilter = selectedItem?.item.players?.role
  
  // Filtro per l'Autocomplete degli svincolati dello stesso ruolo
  const filteredFreePlayers = freePlayers.filter(p => {
    const matchesRole = p.role?.toLowerCase() === currentRoleFilter?.toLowerCase()
    const matchesSearch = p.name.toLowerCase().includes(freePlayerSearch.toLowerCase()) || 
                          p.team.toLowerCase().includes(freePlayerSearch.toLowerCase())
    return matchesRole && matchesSearch
  })

  const targetTeamData = teams.find(t => t.id === targetTeamId)
  const filteredTargetTeamPlayers = (targetTeamData?.roster || []).filter(
    item => item.players?.role?.toLowerCase() === currentRoleFilter?.toLowerCase()
  )

  const replacementPrice = swapReplacementMatchPrice ? (selectedItem?.item.price ?? 1) : 1

  const roleOrder: Record<string, number> = {
    'P': 1, 'Portiere': 1, 'portiere': 1,
    'D': 2, 'Difensore': 2, 'difensore': 2,
    'C': 3, 'Centrocampista': 3, 'centrocampista': 3,
    'A': 4, 'Attaccante': 4, 'attaccante': 4,
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col md:flex-row">
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
            <ArrowLeftRight className="w-7 h-7 text-primary" />
            Gestione Rose e Svincoli
          </h1>
          <p className="text-sm text-muted">
            Effettua scambi diretti tra rose o gestisci gli svincoli con rimpiazzo.
          </p>
        </div>

        {feedback && (
          <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold ${
            feedback.success ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20'
          }`}>
            {feedback.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{feedback.success || feedback.error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => {
            const sortedRoles = Object.keys(team.groupedRoster || {}).sort((a, b) => {
              const orderA = roleOrder[a] || 99
              const orderB = roleOrder[b] || 99
              return orderA - orderB
            })

            return (
              <div key={team.id} className="bg-surface border border-border rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
                    <h2 className="font-bold text-white text-base flex items-center gap-2">
                      <Shield className="w-4 h-4 text-role-d" />
                      {team.name}
                    </h2>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-surface-elevated text-muted rounded-lg">
                      {team.roster.length} giocatori
                    </span>
                  </div>

                  {team.roster.length === 0 ? (
                    <p className="text-xs text-muted-2 italic py-4 text-center">Nessun giocatore in rosa</p>
                  ) : (
                    <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                      {sortedRoles.map((role) => {
                        const items = team.groupedRoster[role]
                        return (
                          <div key={role} className="space-y-1.5">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-primary px-1 pt-1 border-b border-border/50 pb-1">
                              Ruolo: {role} ({items.length})
                            </div>

                            {items.map((item) => (
                              <div 
                                key={item.id}
                                className="flex items-center justify-between p-2.5 bg-surface-elevated/50 hover:bg-surface-elevated rounded-xl transition-all text-xs"
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="font-bold text-white truncate">{item.players?.name}</p>
                                  <p className="text-[10px] text-muted uppercase tracking-wider">
                                    {item.players?.team} • <span className="text-primary font-semibold">{item.price} FM</span>
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
                                    className="p-1.5 bg-primary/20 hover:bg-primary text-primary-hover hover:text-white rounded-lg transition-all cursor-pointer"
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
                                      setSelectedFreePlayer(null)
                                      setFreePlayerSearch('')
                                      setFeedback(null)
                                    }}
                                    className="p-1.5 bg-danger/20 hover:bg-danger text-danger-hover hover:text-white rounded-lg transition-all cursor-pointer"
                                    title="Svincola giocatore"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {selectedItem && modalType && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {modalType === 'swap' ? 'Scambio tra Squadre' : 'Gestione Svincolo'}
                </h3>
                <p className="text-xs text-muted mt-1">
                  Giocatore in uscita: <span className="text-white font-semibold">{selectedItem.item.players?.name}</span> ({selectedItem.item.players?.role})
                </p>
              </div>

              <form onSubmit={handleActionSubmit} className="space-y-4">
                {modalType === 'swap' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                        1. Seleziona Squadra Destinataria
                      </label>
                      <select
                        value={targetTeamId}
                        onChange={(e) => {
                          setTargetTeamId(e.target.value)
                          setTargetTeamPlayerId('')
                        }}
                        required
                        className="w-full bg-surface-elevated border border-border text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary"
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
                        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                          2. Seleziona Giocatore in Cambio ({currentRoleFilter})
                        </label>
                        <select
                          value={targetTeamPlayerId}
                          onChange={(e) => setTargetTeamPlayerId(e.target.value)}
                          required
                          className="w-full bg-surface-elevated border border-border text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary"
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
                      <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                        Tipo di Svincolo
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setReleaseActionType('refund')}
                          className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                            releaseActionType === 'refund' 
                              ? 'bg-danger/20 border-danger text-danger-hover' 
                              : 'bg-surface-elevated border-border text-muted'
                          }`}
                        >
                          Solo Rimborso ({selectedItem.item.price} FM)
                        </button>
                        <button
                          type="button"
                          onClick={() => setReleaseActionType('swap')}
                          className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                            releaseActionType === 'swap' 
                              ? 'bg-primary/20 border-primary text-primary-hover' 
                              : 'bg-surface-elevated border-border text-muted'
                          }`}
                        >
                          Svincolo + Rimpiazzo ({replacementPrice} FM)
                        </button>
                      </div>
                    </div>

                    {releaseActionType === 'swap' && (
                      <div className="space-y-2 relative" ref={dropdownRef}>
                        <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
                          Cerca Nuovo Giocatore ({currentRoleFilter})
                        </label>
                        
                        {/* Input Autocomplete */}
                        <div className="relative">
                          <Search className="absolute left-3 top-3 w-4 h-4 text-muted" />
                          <input
                            type="text"
                            placeholder="Digita il nome del giocatore..."
                            value={selectedFreePlayer ? `${selectedFreePlayer.name} (${selectedFreePlayer.team})` : freePlayerSearch}
                            onChange={(e) => {
                              setSelectedFreePlayer(null)
                              setFreePlayerSearch(e.target.value)
                              setIsDropdownOpen(true)
                            }}
                            onFocus={() => setIsDropdownOpen(true)}
                            className="w-full bg-surface-elevated border border-border text-white rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-primary"
                          />
                        </div>

                        {/* Dropdown dei risultati filtrati */}
                        {isDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1 bg-surface-elevated border border-border rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50">
                            {filteredFreePlayers.length === 0 ? (
                              <div className="p-3 text-xs text-muted text-center">Nessun giocatore trovato</div>
                            ) : (
                              filteredFreePlayers.map((fp) => (
                                <div
                                  key={fp.id}
                                  onClick={() => {
                                    setSelectedFreePlayer(fp)
                                    setFreePlayerSearch('')
                                    setIsDropdownOpen(false)
                                  }}
                                  className="px-3.5 py-2.5 text-xs hover:bg-primary/20 hover:text-white cursor-pointer transition-colors flex items-center justify-between border-b border-border/30 last:border-none"
                                >
                                  <span className="font-bold text-white">{fp.name}</span>
                                  <span className="text-muted">{fp.team}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-muted hover:bg-surface-elevated transition-all cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || (modalType === 'swap' && (!targetTeamId || !targetTeamPlayerId)) || (modalType === 'release' && releaseActionType === 'swap' && !selectedFreePlayer)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20 transition-all disabled:opacity-50 cursor-pointer"
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