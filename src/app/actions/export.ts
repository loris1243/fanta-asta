'use server'

import { supabase } from '../../lib/supabaseClient'
import { getCurrentUser } from '../../app/actions/auth'
import * as XLSX from 'xlsx'

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

    // 4. Per ogni squadra, recupera i giocatori in rosa
    for (const team of teams) {
      // Modifica i nomi delle tabelle/colonne in base al tuo schema effettivo di Supabase
      const { data: roster, error: rosterError } = await supabase
        .from('league_team_players')
        .select(`
          price,
          players (
            name,
            team,
            role
          )
        `)
        .eq('team_id', team.id)

      if (rosterError) {
        console.error(`Errore recupero rosa per la squadra ${team.name}:`, rosterError)
        continue
      }

      // Marrschiamo i dati nel formato richiesto: Nome, Squadra, Ruolo, Costo
      const rows = roster.map((item: any) => ({
        'Nome Giocatore': item.players?.name || 'N/D',
        'Squadra Reale': item.players?.team || 'N/D',
        'Ruolo': item.players?.role || 'N/D',
        'Costo d\'acquisto (FM)': item.price || 0,
      }))

      // Se la squadra non ha giocatori, inseriamo una riga vuota o descrittiva per evitare sheet vuoti
      const sheetData = rows.length > 0 ? rows : [{ 'Nome Giocatore': 'Nessun giocatore in rosa', 'Squadra Reale': '', 'Ruolo': '', 'Costo d\'acquisto (FM)': 0 }]

      // Crea il worksheet per la squadra corrente
      const worksheet = XLSX.utils.json_to_sheet(sheetData)

      if (worksheet['!ref']) {
        const range = XLSX.utils.decode_range(worksheet['!ref'])
        worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(range) }
      }

      // Pulisci il nome del foglio da caratteri non consentiti da Excel (es. /, \, ?, *, etc., max 31 caratteri)
      const safeSheetName = team.name.replace(/[\/\\\?\*\[\]]/g, '').substring(0, 31)

      // Aggiungi il foglio al workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName)
    }

    // 5. Genera il file binario in formato base64 o buffer per passarlo al client
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' })

    return { success: true, data: excelBuffer, fileName: `Rose_Lega_${new Date().toISOString().slice(0, 10)}.xlsx` }
  } catch (err: any) {
    console.error("Errore durante l'esportazione delle rose:", err)
    return { success: false, error: err.message || 'Errore imprevisto durante l\'esportazione.' }
  }
}