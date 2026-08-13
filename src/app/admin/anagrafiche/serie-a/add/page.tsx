'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../../lib/supabaseClient' 

export default function AddSerieATeamPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [alias, setAlias] = useState('')
  const [colors, setColors] = useState<string[]>(['#3b82f6']) // Array di colori di partenza
  const [loading, setLoading] = useState(false)

  // Aggiunge un nuovo selettore di colore
  const handleAddColor = () => {
    setColors([...colors, '#ffffff'])
  }

  // Modifica un colore esistente nell'array
  const handleColorChange = (index: number, value: string) => {
    const newColors = [...colors]
    newColors[index] = value
    setColors(newColors)
  }

  // Rimuove un colore (mantenendo almeno uno)
  const handleRemoveColor = (index: number) => {
    if (colors.length === 1) return
    setColors(colors.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !alias) {
      alert('Compila il nome completo e l\'alias della squadra.')
      return
    }

    setLoading(true)

    try {
      // Salviamo l'array dei colori come colonna JSON o stringa nel database
      const { error: dbError } = await supabase
        .from('teams')
        .insert([{ 
          name, 
          alias, 
          color: colors[0], // Retrocompatibilità colonna singola se esiste
          colors: colors    // Array completo dei colori
        }])

      if (dbError) throw new Error(dbError.message)

      alert('Squadra aggiunta con successo!')
      router.push('/admin/anagrafiche/serie-a')
      router.refresh()
    } catch (err: any) {
      alert('Errore: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-xl mx-auto">
        
        <div className="mb-8">
          <Link 
            href="/admin/anagrafiche/serie-a" 
            className="text-slate-400 hover:text-white transition-colors text-xs uppercase tracking-widest font-bold mb-2 inline-flex items-center gap-1"
          >
            ← Torna a Squadre Serie A
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Aggiungi Squadra Serie A</h1>
          <p className="text-slate-400 text-sm mt-1">Inserisci i dettagli e configura i colori sociali del club.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          
          {/* Nome Completo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Nome Completo</label>
            <input 
              type="text" 
              placeholder="es. Associazione Calcio Milan" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Alias senza restrizioni di lunghezza */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Alias</label>
            <input 
              type="text" 
              placeholder="es. MILAN o MIL" 
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Gestione Più Colori Sociali */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">Colori Sociali</label>
              <button 
                type="button" 
                onClick={handleAddColor}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold transition"
              >
                + Aggiungi colore
              </button>
            </div>

            <div className="space-y-3">
              {colors.map((col, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={col}
                    onChange={(e) => handleColorChange(index, e.target.value)}
                    className="h-11 w-14 rounded-xl cursor-pointer bg-slate-900 border border-slate-700 p-1 shrink-0"
                  />
                  <input 
                    type="text" 
                    value={col}
                    onChange={(e) => handleColorChange(index, e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                  {colors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(index)}
                      className="p-2 text-slate-400 hover:text-red-400 transition"
                      title="Rimuovi colore"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700 flex items-center justify-end gap-3">
            <Link 
              href="/admin/anagrafiche/serie-a"
              className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs transition"
            >
              Annulla
            </Link>
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Salvataggio...' : 'Salva Squadra'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}