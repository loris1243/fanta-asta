'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabaseClient'

interface Team {
  id: string
  name: string
  alias: string
  color?: string
  colors?: string[]
}

export default function SerieASquadsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    setLoading(true)
    // Query con ordinamento alfabetico automatico per nome
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true })

    if (!error && data) {
      setTeams(data)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questa squadra?')) {
      const { error } = await supabase.from('teams').delete().eq('id', id)
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
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Anagrafica Squadre Serie A</h1>
            <p className="text-slate-400 text-sm mt-1">Gestisci i club partecipanti al campionato</p>
          </div>

          <Link
            href="/admin/anagrafiche/serie-a/add"
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
            <p className="text-xs text-slate-400 mb-3">Nessuna squadra presente in anagrafica.</p>
            <Link href="/admin/anagrafiche/serie-a/add" className="inline-block px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl">
              Aggiungi la prima squadra
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div 
                key={team.id}
                className="p-5 bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl flex items-center justify-between gap-4 group hover:border-slate-600 transition-all"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  {/* Logo stilizzato: solo prime 3 lettere dell'alias */}
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg overflow-hidden"
                    style={{ 
                      background: team.colors && team.colors.length > 1 
                        ? `linear-gradient(135deg, ${team.colors.join(', ')})` 
                        : (team.color || team.colors?.[0] || '#1e293b') 
                    }}
                  >
                    <span className="font-black text-xl text-white drop-shadow-md tracking-wider uppercase">
                      {team.alias ? team.alias.slice(0, 3).toUpperCase() : ''}
                    </span>
                  </div>
                  
                  {/* Nome completo */}
                  <div className="overflow-hidden">
                    <h3 className="text-sm font-bold text-white leading-tight whitespace-normal break-words">
                      {team.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider mt-1">Serie A</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(team.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  title="Elimina squadra"
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