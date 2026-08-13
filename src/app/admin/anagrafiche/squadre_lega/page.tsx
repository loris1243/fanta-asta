'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabaseClient' 

interface LeagueTeam {
  id: string
  name: string
  logo_url: string
  profiles?: {
    username: string
  }
}

export default function LeagueTeamsPage() {
  const [teams, setTeams] = useState<LeagueTeam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTeams()
  }, [])

const fetchTeams = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('league_teams')
      .select(`
        id,
        name,
        logo_url,
        user_id,
        profiles (
          username
        )
      `)
      .order('name', { ascending: true })

    if (error) {
      console.error("Errore fetch squadre:", error.message)
    }

    if (data) {
      setTeams(data as any)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questa squadra della lega?')) {
      const { error } = await supabase.from('league_teams').delete().eq('id', id)
      if (!error) {
        setTeams(teams.filter(team => team.id !== id))
      } else {
        alert('Errore durante l\'eliminazione: ' + error.message)
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
          <div>
            <Link href="/" className="text-slate-400 hover:text-white transition-colors text-xs uppercase tracking-widest font-bold mb-2 inline-flex items-center gap-1">
              ← Dashboard
            </Link>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Squadre Lega Fantacalcio</h1>
            <p className="text-slate-400 text-sm mt-1">Gestisci le squadre che partecipano al campionato</p>
          </div>

          <Link
            href="/admin/anagrafiche/squadre_lega/add"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all shrink-0"
          >
            + Aggiungi Squadra
          </Link>
        </div>

        {/* Griglia */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400 uppercase tracking-wider">Caricamento...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="p-8 bg-slate-800/80 rounded-2xl border border-slate-700 text-center">
            <p className="text-xs text-slate-400 mb-3">Nessuna squadra definita.</p>
            <Link href="/admin/anagrafiche/squadre_lega/add" className="inline-block px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl">
              Crea la prima
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div 
                key={team.id}
                className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl flex items-center justify-between gap-4 group hover:border-slate-600 transition-all"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  {/* Logo Caricato */}
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
                    {team.logo_url ? (
                      <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-[10px] text-slate-600 font-bold uppercase">No Logo</div>
                    )}
                  </div>
                  
                  {/* Dettagli */}
                  <div className="overflow-hidden">
                    <h3 className="text-sm font-bold text-white truncate">{team.name}</h3>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                      {team.profiles?.username || 'Nessun proprietario'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(team.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  title="Elimina"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}