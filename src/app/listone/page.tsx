'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import { getCurrentUser } from '../actions/auth'
import { Search, Loader2, ChevronLeft, ChevronRight, RotateCcw, Target } from 'lucide-react'

interface Player {
  id: string
  name: string
  role: string
  team: string
  quotation: number
  fanta_media: number
  fvm: number
  is_out: boolean
}

export default function ListonePage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  
  // Stato per gli obiettivi
  const [targetIds, setTargetIds] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  
  // Filtri
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('TUTTI')
  const [teamFilter, setTeamFilter] = useState('TUTTE')
  const [availableTeams, setAvailableTeams] = useState<string[]>([])

  // Paginazione
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  useEffect(() => {
    async function fetchData() {
      // 1. Recupera l'utente con il sistema personalizzato
      const user = await getCurrentUser()
      if (user) {
        setUserId(user.id)
        
        // Carica gli obiettivi dell'utente
        const { data: targets } = await supabase
          .from('user_targets')
          .select('player_id')
          .eq('user_id', user.id)

        if (targets) {
          setTargetIds(targets.map((t: any) => t.player_id))
        }
      }

      // 2. Carica i giocatori
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error("Errore caricamento listone:", error)
      } else if (data) {
        setPlayers(data)
        const teams = Array.from(new Set(data.map((p: Player) => p.team))).filter(Boolean) as string[]
        setAvailableTeams(teams.sort())
      }
      setLoading(false)
    }

    fetchData()

    // 3. Realtime Subscription: aggiorna la pagina se cambia qualcosa nel DB
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Funzione per aggiungere o rimuovere l'obiettivo
  const toggleTarget = async (playerId: string) => {
    if (!userId) {
      console.warn("Impossibile salvare l'obiettivo: utente non identificato.")
      return
    }

    const isAlreadyTarget = targetIds.includes(playerId)

    if (isAlreadyTarget) {
      const { error } = await supabase
        .from('user_targets')
        .delete()
        .eq('user_id', userId)
        .eq('player_id', playerId)

      if (!error) {
        setTargetIds(targetIds.filter(id => id !== playerId))
      } else {
        console.error("Errore rimozione obiettivo:", error)
      }
    } else {
      const { error } = await supabase
        .from('user_targets')
        .insert({ user_id: userId, player_id: playerId })

      if (!error) {
        setTargetIds([...targetIds, playerId])
      } else {
        console.error("Errore inserimento obiettivo:", error)
      }
    }
  }

  // Logica di filtro
  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'TUTTI' || player.role?.toUpperCase() === roleFilter.toUpperCase()
    const matchesTeam = teamFilter === 'TUTTE' || player.team === teamFilter
    return matchesSearch && matchesRole && matchesTeam
  })

  // Reset filtri
  const handleResetFilters = () => {
    setSearchTerm('')
    setRoleFilter('TUTTI')
    setTeamFilter('TUTTE')
    setCurrentPage(1)
  }

  // Paginazione
  const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage) || 1
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentPlayers = filteredPlayers.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, roleFilter, teamFilter])

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="space-y-1">
          <Link 
            href="/" 
            className="text-xs font-bold text-slate-400 hover:text-white tracking-widest uppercase transition inline-block mb-1"
          >
            ← Dashboard
          </Link>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Listone</h1>
          <p className="text-sm text-slate-400 font-medium">Consulta e filtra i calciatori caricati per la tua lega</p>
        </div>

        {/* Card Filtri */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Cerca Calciatore</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="es. Zapata"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:border-blue-600 outline-none transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Ruolo</label>
              <select 
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-600 outline-none transition cursor-pointer"
              >
                <option value="TUTTI">Tutti i ruoli</option>
                <option value="P">Portiere (P)</option>
                <option value="D">Difensore (D)</option>
                <option value="C">Centrocampista (C)</option>
                <option value="A">Attaccante (A)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Squadra Serie A</label>
              <select 
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-600 outline-none transition cursor-pointer"
              >
                <option value="TUTTE">Tutte le squadre</option>
                {availableTeams.map((teamName) => (
                  <option key={teamName} value={teamName}>{teamName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Trovati: <span className="text-white">{filteredPlayers.length}</span> calciatori
            </span>
            {(searchTerm || roleFilter !== 'TUTTI' || teamFilter !== 'TUTTE') && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Resetta filtri
              </button>
            )}
          </div>
        </div>

        {/* Tabella */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-blue-500 bg-[#111827] rounded-2xl border border-slate-800">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Caricamento listone...</p>
          </div>
        ) : (
          <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                    <th className="px-6 py-4">Nome</th>
                    <th className="px-6 py-4">Ruolo</th>
                    <th className="px-6 py-4">Squadra</th>
                    <th className="px-6 py-4 text-right">FantaMedia</th>
                    <th className="px-6 py-4 text-center">Obiettivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {currentPlayers.length > 0 ? (
                    currentPlayers.map((player) => {
                      const isTarget = targetIds.includes(player.id)
                      return (
                        <tr 
                          key={player.id} 
                          className={`transition ${player.is_out ? 'opacity-60 bg-red-950/10 hover:bg-red-950/20' : 'hover:bg-slate-800/30'}`}
                        >
                          <td className="px-6 py-4 font-bold text-white flex items-center gap-3">
                            <span className={player.is_out ? 'line-through text-slate-400' : ''}>{player.name}</span>
                            {player.is_out && (
                              <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-[10px] font-black text-red-400 uppercase tracking-wider">
                                Fuori Listone
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-md bg-[#0b0f19] border border-slate-800 text-[11px] font-black text-blue-400">{player.role}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-300 font-medium">{player.team}</td>
                          <td className="px-6 py-4 text-right font-black text-emerald-400">{player.fanta_media}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => toggleTarget(player.id)}
                              title={isTarget ? "Rimuovi dagli obiettivi" : "Imposta come obiettivo"}
                              className={`p-2 rounded-xl transition cursor-pointer inline-flex items-center justify-center ${
                                isTarget 
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' 
                                  : 'bg-[#0b0f19] text-slate-500 border border-slate-800 hover:text-white hover:bg-slate-800'
                              }`}
                            >
                              <Target className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-sm italic">Nessun calciatore trovato con i filtri selezionati.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginazione */}
            <div className="bg-[#0b0f19] border-t border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Mostra</span>
                <select 
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-[#111827] border border-slate-800 rounded-lg px-2.5 py-1 text-white font-bold outline-none cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>di {filteredPlayers.length} elementi</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-xl bg-[#111827] border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold px-3 py-1 text-slate-300">Pagina {currentPage} di {totalPages}</span>
                <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 rounded-xl bg-[#111827] border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}