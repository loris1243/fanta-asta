'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getLeagueSettings, updateLeagueSettings, LeagueSettings } from '../../../app/actions/settings'

// Assicurati che l'interfaccia LeagueSettings (o il tipo usato) includa league_name
// es: league_name?: string

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [settings, setSettings] = useState<LeagueSettings & { league_name?: string }>({
    max_participants: 8,
    initial_budget: 500,
    auction_timeout_seconds: 30,
    call_timeout_seconds: 10,
    league_name: '', // 🏆 Aggiunto di default
  })

  useEffect(() => {
    async function loadSettings() {
      const data = await getLeagueSettings()
      setSettings(data)
      setLoading(false)
    }
    loadSettings()
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const res = await updateLeagueSettings(formData)

    if (res.success) {
      setMessage({ type: 'success', text: 'Impostazioni aggiornate con successo!' })
    } else {
      setMessage({ type: 'error', text: res.error || 'Errore durante il salvataggio.' })
    }
    setSaving(false)
  }

  const handleResetClick = () => {
    alert('Funzionalità "Reset Lega" selezionata: la implementeremo al prossimo step!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Caricamento impostazioni...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors text-xs uppercase tracking-widest font-bold mb-2 inline-flex items-center gap-1">
            ← Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Configurazione Lega</h1>
          <p className="text-slate-400 text-sm mt-1">Imposta i parametri dell&apos;asta live, crediti e partecipanti</p>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl border text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-red-500/20 text-red-300 border-red-500/40'
          }`}>
            {message.text}
          </div>
        )}

        {/* Settings Form */}
        <form onSubmit={handleSubmit} className="mb-12 p-6 bg-slate-800/80 rounded-2xl border border-slate-700 shadow-xl space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 🏆 Nome della Lega (Aggiunto a tutta larghezza) */}
            <div className="col-span-1 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-slate-300 font-bold block mb-1.5">
                🏆 Nome della Lega
              </label>
              <input
                type="text"
                name="league_name"
                required
                defaultValue={settings.league_name || ''}
                placeholder="Es. Fantacalcio degli Amici"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:border-blue-400 outline-none transition-colors"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Il nome ufficiale identificativo della tua lega fantacalcistica.
              </p>
            </div>

            {/* Numero Partecipanti */}
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-300 font-bold block mb-1.5">
                👥 Numero Max Partecipanti
              </label>
              <input
                type="number"
                name="max_participants"
                required
                min={2}
                max={20}
                defaultValue={settings.max_participants}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:border-blue-400 outline-none transition-colors"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Numero di squadre previste per la lega.
              </p>
            </div>

            {/* Crediti Iniziali */}
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-300 font-bold block mb-1.5">
                💰 Crediti Iniziali (FM)
              </label>
              <input
                type="number"
                name="initial_budget"
                required
                min={1}
                defaultValue={settings.initial_budget}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-emerald-400 font-extrabold focus:border-blue-400 outline-none transition-colors"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Budget assegnato di default ai nuovi partecipanti.
              </p>
            </div>

            {/* Timeout Avvio Asta */}
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-300 font-bold block mb-1.5">
                ⏱️ Timeout Avvio Asta (sec)
              </label>
              <input
                type="number"
                name="call_timeout_seconds"
                required
                min={1}
                max={120}
                defaultValue={settings.call_timeout_seconds}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:border-blue-400 outline-none transition-colors"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Tempo d&apos;attesa dopo la chiamata per far partire le offerte.
              </p>
            </div>

            {/* Timeout Chiusura Asta */}
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-300 font-bold block mb-1.5">
                🔨 Timeout Chiusura Asta (sec)
              </label>
              <input
                type="number"
                name="auction_timeout_seconds"
                required
                min={1}
                max={300}
                defaultValue={settings.auction_timeout_seconds}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:border-blue-400 outline-none transition-colors"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Secondi senza ulteriori rilanci per l&apos;assegnazione automatica.
              </p>
            </div>

          </div>

          <div className="pt-4 border-t border-slate-700 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : 'Salva Configurazione'}
            </button>
          </div>
        </form>

        {/* Danger Zone: Reset Lega */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
              <span>⚠️</span> Zona Pericolosa
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Vuoi azzerare la lega, rimuovere le rose assegnate e ripristinare i crediti?
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetClick}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-[0.98] shrink-0"
          >
            🔄 Reset Lega
          </button>
        </div>

      </div>
    </div>
  )
}