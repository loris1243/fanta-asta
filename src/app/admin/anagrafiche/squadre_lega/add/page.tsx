'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../../lib/supabaseClient' 

export default function AddLegaTeamPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [userId, setUserId] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialBudget, setInitialBudget] = useState<number>(500) // Valore di fallback predefinito

  // Carica gli utenti per il menu a tendina e il budget iniziale dalle impostazioni di lega
  useEffect(() => {
    const fetchData = async () => {
      // 1. Caricamento utenti
      const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('id, username');
      
      if (profilesError) {
        console.error("DEBUG: Errore caricamento utenti:", profilesError.message);
      } else {
        setUsers(profilesData || []);
      }

      // 2. Caricamento budget iniziale da league_settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('league_settings')
        .select('initial_budget')
        .maybeSingle();

      if (settingsError) {
        console.error("DEBUG: Errore caricamento impostazioni lega:", settingsError.message);
      } else if (settingsData && settingsData.initial_budget !== undefined) {
        setInitialBudget(settingsData.initial_budget);
      }
    };
    fetchData();
  }, []);

  // Gestione anteprima logo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !userId) {
      alert('Seleziona il fantaallenatore e inserisci il nome squadra.')
      return
    }

    setLoading(true)

    try {
      let logoUrl = ''

      // Caricamento del logo su Supabase Storage se presente
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const randomString = Math.random().toString(36).substring(2, 15)
        const fileName = `${Date.now()}-${randomString}.${fileExt}`
        const filePath = `league-logos/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('league-logos')
          .upload(filePath, logoFile)

        if (uploadError) throw new Error('Errore upload logo: ' + uploadError.message)

        const { data: publicURLData } = supabase.storage
          .from('league-logos')
          .getPublicUrl(filePath)

        logoUrl = publicURLData.publicUrl
      }

      // Salvataggio nel database con user_id, logo_url e il budget iniziale preso da league_settings
      const { error: dbError } = await supabase
        .from('league_teams')
        .insert([{ 
          name, 
          user_id: userId, 
          logo_url: logoUrl,
          budget: initialBudget // Inserimento del budget configurato
        }])

      if (dbError) throw new Error('Errore salvataggio database: ' + dbError.message)

      alert('Squadra della lega aggiunta con successo!')
      router.push('/admin/anagrafiche/squadre_lega')
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
        
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/admin/anagrafiche/squadre_lega" 
            className="text-slate-400 hover:text-white transition-colors text-xs uppercase tracking-widest font-bold mb-2 inline-flex items-center gap-1"
          >
            ← Torna a Squadre Lega
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Aggiungi Squadra Fantacalcio</h1>
          <p className="text-slate-400 text-sm mt-1">Registra la squadra, associa l'allenatore e carica il logo (Budget iniziale: <span className="text-amber-400 font-bold">{initialBudget} CR</span>)</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          
          {/* Nome Squadra */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Nome Squadra</label>
            <input 
              type="text" 
              placeholder="es. Real Marsiglia" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Menu a tendina Fantaallenatore */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Fanta-allenatore</label>
            <select 
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">Seleziona un allenatore...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </div>

          {/* Upload Logo IA */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Logo Squadra</label>
            
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {logoPreview ? (
                  <img src={logoPreview} alt="Anteprima logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-500 font-medium">No Logo</span>
                )}
              </div>

              <label className="flex-1 flex flex-col items-center justify-center px-4 py-3 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-900 hover:border-blue-500 transition-colors">
                <span className="text-xs font-bold text-slate-300">Clicca per caricare l'immagine</span>
                <span className="text-[10px] text-slate-500 mt-0.5">PNG, JPG o WEBP</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          {/* Pulsanti Azione */}
          <div className="pt-4 border-t border-slate-700 flex items-center justify-end gap-3">
            <Link 
              href="/admin/anagrafiche/squadre_lega"
              className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs transition"
            >
              Annulla
            </Link>
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Caricamento in corso...' : 'Salva Squadra'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}