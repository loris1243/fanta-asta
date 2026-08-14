'use server'

import { supabase } from '../../lib/supabaseClient' // Mantieni il tuo percorso corretto di supabase
import { revalidatePath } from 'next/cache'

export type LeagueSettings = {
  league_name?: string
  max_participants: number
  initial_budget: number
  auction_timeout_seconds: number
  call_timeout_seconds: number
}

export async function resetLeagueAction() {
  try {
    // 1. Leggi il budget iniziale dalle impostazioni
    const { data: settings, error: settingsError } = await supabase
      .from('league_settings')
      .select('initial_budget')
      .single()

    if (settingsError) throw settingsError
    const initialBudget = settings?.initial_budget || 500

    // 2. Svuota la tabella delle rose (senza passare "0")
    const { error: clearPlayersError } = await supabase
      .from('league_team_players')
      .delete()
      .not('id', 'is', null)

    if (clearPlayersError) throw clearPlayersError

    // 3. Ripristina il budget di tutte le squadre
    const { error: resetBudgetError } = await supabase
      .from('league_teams')
      .update({ budget: initialBudget })
      .not('id', 'is', null)

    if (resetBudgetError) throw resetBudgetError

    // 4. Pulisci lo storico transazioni e le aste/chiamate in corso
    await supabase.from('auction_transactions').delete().not('id', 'is', null)
    await supabase.from('auction_nominations').delete().not('id', 'is', null)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 1. Funzione per leggere le impostazioni dal DB
export async function getLeagueSettings(): Promise<LeagueSettings> {
  const supabaseClient = supabase

  const { data, error } = await supabaseClient
    .from('league_settings')
    .select('*')
    .single()

  if (error) {
    console.error('Errore nel recupero delle impostazioni:', error.message)
    // Ritorna valori di fallback se la riga non esiste ancora
    return {
      league_name: 'Il mio Fantacalcio',
      max_participants: 8,
      initial_budget: 500,
      auction_timeout_seconds: 30,
      call_timeout_seconds: 10,
    }
  }

  return data
}

// 2. Funzione per aggiornare le impostazioni nel DB (incluso il nome lega)
export async function updateLeagueSettings(formData: FormData) {
  const supabaseClient = supabase

  const league_name = formData.get('league_name') as string
  const max_participants = parseInt(formData.get('max_participants') as string)
  const initial_budget = parseInt(formData.get('initial_budget') as string)
  const auction_timeout_seconds = parseInt(formData.get('auction_timeout_seconds') as string)
  const call_timeout_seconds = parseInt(formData.get('call_timeout_seconds') as string)

  // 1. Estrai i valori (con log per debug)
  const settingsData = {
    id: 1, // Forza l'id a 1 per essere sicuri di sovrascrivere sempre la stessa riga
    league_name: formData.get('league_name') as string,
    max_participants: parseInt(formData.get('max_participants') as string),
    initial_budget: parseInt(formData.get('initial_budget') as string),
    auction_timeout_seconds: parseInt(formData.get('auction_timeout_seconds') as string),
    call_timeout_seconds: parseInt(formData.get('call_timeout_seconds') as string),
  }

  console.log("Dati inviati a Supabase:", settingsData) // Controlla il terminale del server!

  // Effettua l'update sulla tabella league_settings (supponendo ci sia una riga con id = 1 o la prima disponibile)
  const { error } = await supabaseClient
    .from('league_settings')
    .upsert({
      league_name,
      max_participants,
      initial_budget,
      auction_timeout_seconds,
      call_timeout_seconds,
    })
    .eq('id', 1) // Se usi un id fisso o un altro selettore univoco

  if (error) {
    console.error('Errore durante l\'aggiornamento:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/settings')
  return { success: true }
}