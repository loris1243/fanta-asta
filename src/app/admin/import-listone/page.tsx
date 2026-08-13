'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient' 
import * as XLSX from 'xlsx'

export default function ImportListonePage() {
  const [loading, setLoading] = useState(false)
  const [logsList, setLogsList] = useState<any[]>([])
  const [lastResult, setLastResult] = useState<any>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setLastResult(null)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const workbook = XLSX.read(bstr, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const data: any[] = XLSX.utils.sheet_to_json(sheet)

        let insertedCount = 0
        let updatedCount = 0
        let deactivatedCount = 0
        const processedIds: number[] = []

        // 1. Recupera i giocatori già esistenti per il confronto
        const { data: existingPlayers } = await supabase.from('players').select('id, name, quotation, fvm, is_out')
        const existingMap = new Map(existingPlayers?.map(p => [p.id, p]) || [])

        for (const row of data) {
          const playerId = Number(row['#'])
          const name = row['Nome']
          const team = row['Sq.']
          const role = row['R.']
          const roleMantra = row['R.MANTRA'] || ''
          const quotation = Number(row['QUOT.'] || 0)
          const fvm = Number(row['FVM/1000'] || 0)
          const isOut = row['Fuori lista'] === '*'

          processedIds.push(playerId)

          const existing = existingMap.get(playerId)

          if (!existing) {
            // NUOVO INSERIMENTO
            const { error } = await supabase.from('players').insert([{
              id: playerId,
              name,
              team,
              role,
              role_mantra: roleMantra,
              quotation,
              fvm,
              is_out: isOut
            }])
            if (!error) insertedCount++
          } else {
            // AGGIORNAMENTO (Verifichiamo se è cambiato qualcosa o se era fuori lista)
            const { error } = await supabase.from('players').update({
              name,
              team,
              role,
              role_mantra: roleMantra,
              quotation,
              fvm,
              is_out: isOut,
              updated_at: new Date()
            }).eq('id', playerId)

            if (!error) {
              // Controlliamo se ci sono variazioni significative per contare l'aggiornamento
              if (existing.quotation !== quotation || existing.fvm !== fvm || existing.is_out !== isOut) {
                updatedCount++
              }
            }
          }
        }

        // 2. CANCELLAZIONE LOGICA: Chi non è nel file Excel viene marcato come fuori lista / disattivato
        if (existingPlayers) {
          for (const p of existingPlayers) {
            if (!processedIds.includes(p.id) && !p.is_out) {
              await supabase.from('players').update({ is_out: true }).eq('id', p.id)
              deactivatedCount++
            }
          }
        }

        // 3. SALVATAGGIO LOG NEL DATABASE
        const logDetails = `Importati ${insertedCount} nuovi, aggiornati ${updatedCount}, disattivati ${deactivatedCount} giocatori.`
        const { data: logData } = await supabase.from('import_logs').insert([{
          inserted_count: insertedCount,
          updated_count: updatedCount,
          deactivated_count: deactivatedCount,
          details: logDetails
        }]).select().single()

        setLastResult({
          inserted: insertedCount,
          updated: updatedCount,
          deactivated: deactivatedCount,
          details: logDetails
        })

        alert('Importazione completata con successo!')
      } catch (err: any) {
        alert('Errore durante l\'importazione: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-slate-400 hover:text-white transition-colors text-xs uppercase tracking-widest font-bold mb-4 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">Importazione Listone Calciatori</h1>
        <p className="text-slate-400 text-sm mb-8">Carica il file Excel ufficiale. Il sistema registrerà inserimenti, variazioni e disattivazioni logiche.</p>

        {/* Box Upload */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-8 shadow-xl mb-8">
          <label className="flex flex-col items-center justify-center px-6 py-8 border-2 border-slate-600 border-dashed rounded-xl cursor-pointer bg-slate-900 hover:border-blue-500 transition-colors">
            <span className="text-sm font-bold text-slate-200 mb-1">
              {loading ? 'Elaborazione in corso...' : 'Clicca per caricare il file Excel (.xlsx)'}
            </span>
            <span className="text-xs text-slate-500">Formato supportato: foglio Excel listone classico/mantra</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={loading} className="hidden" />
          </label>

          {lastResult && (
            <div className="mt-6 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs space-y-1">
              <p className="font-bold">Ultimo report importazione:</p>
              <p>• Nuovi inseriti: {lastResult.inserted}</p>
              <p>• Aggiornati: {lastResult.updated}</p>
              <p>• Disattivati (Fuori lista): {lastResult.deactivated}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}