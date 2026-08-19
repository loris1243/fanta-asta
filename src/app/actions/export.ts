'use server'

import { supabase } from '../../lib/supabaseClient'
import { getCurrentUser } from '../../app/actions/auth'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'

export async function exportRossterExcel() {
  // 1. Verifica che l'utente sia un admin
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Accesso negato: richiesto ruolo admin.' }
  }

  try {
    // 2. Recupera tutte le squadre della lega
    const { data: teams, error: teamsError } = await supabase
      .from('league_teams')
      .select('id, name')

    if (teamsError || !teams) {
      throw new Error('Errore nel recupero delle squadre: ' + teamsError?.message)
    }

    // 3. Crea un nuovo workbook Excel
    const workbook = XLSX.utils.book_new()

    // Array per accumulare le righe del file CSV globale
    const csvRows: string[] = []
    let teamProgressiveIndex = 1

    // 4. Per ogni squadra, recupera i giocatori in rosa
    for (const team of teams) {
      const { data: rosterData, error: rosterErr } = await supabase
        .from('league_team_players')
        .select(`
          price,
          players!inner (
            id,
            name,
            team,
            role
          )
        `)
        .eq('team_id', team.id)

      if (rosterErr) {
        console.error(`Errore recupero rosa per la squadra ${team.name}:`, rosterErr)
        continue
      }

      const roster = rosterData || []

      // --- Generazione dati per Excel ---
      const rows = roster.map((item: any) => {
        const player = Array.isArray(item.players) ? item.players[0] : item.players

        return {
          'Nome Giocatore': player?.name || 'N/D',
          'Squadra Reale': player?.team || 'N/D',
          'Ruolo': player?.role || 'N/D',
          'Costo d\'acquisto (FM)': item.price || 0,
        }
      })

      const sheetData = rows.length > 0 ? rows : [{ 'Nome Giocatore': 'Nessun giocatore in rosa', 'Squadra Reale': '', 'Ruolo': '', 'Costo d\'acquisto (FM)': 0 }]
      const worksheet = XLSX.utils.json_to_sheet(sheetData)

      if (worksheet['!ref']) {
        const range = XLSX.utils.decode_range(worksheet['!ref'])
        worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(range) }
      }

      // --- Correlazione Nome Sheet ---
      // Costruisce il nome del foglio come "progressivo - nome squadra" 
      // e pulisce i caratteri non ammessi da Excel, mantenendo il limite massimo di 31 caratteri
      const rawSheetName = `${teamProgressiveIndex} - ${team.name}`
      const safeSheetName = rawSheetName.replace(/[\/\\\?\*\[\]:]/g, '').substring(0, 31)

      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName)

      // --- Generazione dati per il file CSV ---
      for (const item of roster) {
        const player = Array.isArray(item.players) ? item.players[0] : item.players
        const playerId = player?.id || ''
        const price = item.price ?? 0
        
        const csvLine = `${teamProgressiveIndex},${playerId},${price}`
        csvRows.push(csvLine)
      }

      // Incrementa il progressivo per la squadra successiva
      teamProgressiveIndex++
    }

    // 5. Scrive l'Excel in formato binario (buffer)
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })

    // 6. Assembla il contenuto del file CSV
    const csvContent = csvRows.join('\n')

    // 7. Crea l'archivio ZIP usando JSZip
    const zip = new JSZip()
    const dateStr = new Date().toISOString().slice(0, 10)

    zip.file(`Rose_Lega_${dateStr}.xlsx`, excelBuffer)
    zip.file(`Dati_Rose_${dateStr}.csv`, csvContent)

    const zipBase64 = await zip.generateAsync({ type: 'base64' })

    return { 
      success: true, 
      data: zipBase64, 
      fileName: `Esportazione_Lega_${dateStr}.zip` 
    }
  } catch (err: any) {
    console.error("Errore durante l'esportazione:", err)
    return { success: false, error: err.message || 'Errore imprevisto durante l\'esportazione.' }
  }
}