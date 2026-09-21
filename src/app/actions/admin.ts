'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type UserProfile = {
  id: string
  username: string
  role: 'admin' | 'user'
  created_at: string
}

export async function swapPlayerTeam(leagueTeamPlayerId: string, targetTeamId: string) {
  // Opzionale ma consigliato: verifica che chi chiama sia admin tramite getCurrentUser o simili se già integrato
  try {
    const { error } = await supabaseAdmin
      .from('league_team_players')
      .update({ team_id: targetTeamId })
      .eq('id', leagueTeamPlayerId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    console.error('Errore durante lo scambio del giocatore:', err)
    return { success: false, error: err.message || 'Errore imprevisto durante lo scambio.' }
  }
}

export async function swapPlayersBetweenTeams(
  playerInSourceTeamId: string, // ID del record league_team_players del giocatore che cedi
  playerInTargetTeamId: string  // ID del record league_team_players del giocatore che ricevi in cambio
) {
  try {
    // 1. Recupera i dettagli e il prezzo del primo giocatore e la sua squadra
    const { data: tpSource, error: errSource } = await supabaseAdmin
      .from('league_team_players')
      .select('id, team_id, player_id, price, players(role)')
      .eq('id', playerInSourceTeamId)
      .single()

    if (errSource || !tpSource) throw new Error('Giocatore di partenza in rosa non trovato.')

    // 2. Recupera i dettagli e il prezzo del secondo giocatore e la sua squadra
    const { data: tpTarget, error: errTarget } = await supabaseAdmin
      .from('league_team_players')
      .select('id, team_id, player_id, price, players(role)')
      .eq('id', playerInTargetTeamId)
      .single()

    if (errTarget || !tpTarget) throw new Error('Giocatore di arrivo in rosa non trovato.')

    const teamSourceId = tpSource.team_id
    const teamTargetId = tpTarget.team_id

    if (teamSourceId === teamTargetId) {
      return { success: false, error: 'Non puoi scambiare giocatori appartenenti alla stessa squadra.' }
    }

    // Controllo sui ruoli (lo scambio deve avvenire tra ruoli uguali)
    const roleSource = (tpSource.players as any)?.role
    const roleTarget = (tpTarget.players as any)?.role
    if (roleSource && roleTarget && roleSource !== roleTarget) {
      return { success: false, error: 'Lo scambio deve avvenire tra giocatori dello stesso ruolo.' }
    }

    const priceSource = tpSource.price // Es. 30
    const priceTarget = tpTarget.price // Es. 20

    // 3. Recupera i budget attuali delle due squadre
    const { data: teamSourceData, error: tsError } = await supabaseAdmin
      .from('league_teams')
      .select('budget')
      .eq('id', teamSourceId)
      .single()

    if (tsError || !teamSourceData) throw new Error('Squadra di partenza non trovata.')

    const { data: teamTargetData, error: ttError } = await supabaseAdmin
      .from('league_teams')
      .select('budget')
      .eq('id', teamTargetId)
      .single()

    if (ttError || !teamTargetData) throw new Error('Squadra di arrivo non trovata.')

    // Calcolo della differenza economica
    // Esempio: se source cede un giocatore da 30 e prende uno da 20, la differenza è (20 - 30) = -10 crediti (quindi recupera 10 crediti di conguaglio o viceversa)
    // Riformuliamo chiaramente: 
    // La Squadra Source cede il suo giocatore (valore priceSource) e prende quello di Target (valore priceTarget).
    // Nuova spesa per Source = priceTarget (invece di priceSource). Variazione budget Source = + (priceSource - priceTarget).
    // Nuova spesa per Target = priceSource (invece di priceTarget). Variazione budget Target = + (priceTarget - priceSource).
    
    const diffSource = priceSource - priceTarget // Es. 30 - 20 = 10 (crediti che tornano o si muovono)
    const newBudgetSource = teamSourceData.budget + diffSource
    const newBudgetTarget = teamTargetData.budget - diffSource

    // 4. Esegue l'aggiornamento dei team_id mantenendo i prezzi originali dei cartellini (o gestendo il conguaglio)
    // Nota: Se il giocatore si sposta mantenendo il proprio prezzo originario con cui è stato pagato:
    const { error: updateErrorA } = await supabaseAdmin
      .from('league_team_players')
      .update({ team_id: teamTargetId, price: priceSource })
      .eq('id', playerInSourceTeamId)

    if (updateErrorA) throw updateErrorA

    const { error: updateErrorB } = await supabaseAdmin
      .from('league_team_players')
      .update({ team_id: teamSourceId, price: priceTarget })
      .eq('id', playerInTargetTeamId)

    if (updateErrorB) {
      // Rollback del primo in caso di errore
      await supabaseAdmin
        .from('league_team_players')
        .update({ team_id: teamSourceId, price: priceSource })
        .eq('id', playerInSourceTeamId)
      throw updateErrorB
    }

    // 5. Aggiorna i budget delle due squadre
    const { error: updateBudgetSourceError } = await supabaseAdmin
      .from('league_teams')
      .update({ budget: newBudgetSource })
      .eq('id', teamSourceId)

    if (updateBudgetSourceError) throw updateBudgetSourceError

    const { error: updateBudgetTargetError } = await supabaseAdmin
      .from('league_teams')
      .update({ budget: newBudgetTarget })
      .eq('id', teamTargetId)

    if (updateBudgetTargetError) throw updateBudgetTargetError

    return { success: true }
  } catch (err: any) {
    console.error('Errore durante lo scambio dei giocatori:', err)
    return { success: false, error: err.message || 'Errore imprevisto durante lo scambio.' }
  }
}

export async function releasePlayer(teamPlayerId: string, actionType: 'refund' | 'swap', newPlayerId?: string) {
  try {
    // 1. Recupera i dettagli del giocatore attualmente in rosa
    const { data: teamPlayer, error: tpError } = await supabaseAdmin
      .from('league_team_players')
      .select('id, team_id, price, player_id, players(role)')
      .eq('id', teamPlayerId)
      .single()

    if (tpError || !teamPlayer) throw new Error('Giocatore in rosa non trovato.')

    const teamId = teamPlayer.team_id
    const refundedPrice = teamPlayer.price

    // Estrai correttamente il ruolo gestendo il ritorno come array o oggetto di Supabase
    const rawPlayers = teamPlayer.players
    const currentRole = Array.isArray(rawPlayers) ? rawPlayers[0]?.role : (rawPlayers as any)?.role

    // 2. Recupera la squadra per aggiornare il budget
    const { data: teamData, error: teamError } = await supabaseAdmin
      .from('league_teams')
      .select('budget')
      .eq('id', teamId)
      .single()

    if (teamError || !teamData) throw new Error('Squadra non trovata.')

    let newBudget = teamData.budget + refundedPrice

    // 3. Gestione dello scambio con un giocatore non assegnato (se scelto)
    if (actionType === 'swap') {
      if (!newPlayerId) throw new Error('Seleziona un giocatore di rimpiazzo.')

      // Verifica che il nuovo giocatore esista e recuperane il ruolo
      const { data: newPlayer, error: npError } = await supabaseAdmin
        .from('players')
        .select('*')
        .eq('id', newPlayerId)
        .single()

      if (npError || !newPlayer) throw new Error('Nuovo giocatore non trovato.')
      
      // Controllo rigoroso del ruolo (assicurati che nel DB siano scritti nello stesso formato, es. 'C' o 'Centrocampista')
      // if (newPlayer.role !== currentRole) {
      //   return { success: false, error: `Il giocatore di rimpiazzo deve essere dello stesso ruolo (${currentRole || 'N/D'}).` }
      // }

      const playerName = (newPlayer as any).name || (newPlayer as any).nome || (newPlayer as any).full_name || 'Giocatore Sconosciuto'

      // Recupera dalle impostazioni lega la modalità di prezzo del rimpiazzo
      const { data: leagueSettings } = await supabaseAdmin
        .from('league_settings')
        .select('swap_replacement_match_price')
        .single()

      const matchPrice = leagueSettings?.swap_replacement_match_price === true

      // Il nuovo giocatore costa quanto il giocatore svincolato (se l'opzione è attiva), altrimenti 1 credito fisso
      const newPlayerCost = matchPrice ? refundedPrice : 1
      if (newBudget < newPlayerCost) {
        return { success: false, error: `Budget insufficiente per acquistare il rimpiazzo a ${newPlayerCost} credit${newPlayerCost === 1 ? 'o' : 'i'}.` }
      }

      newBudget -= newPlayerCost

      // Inserisci il nuovo giocatore nella rosa della squadra
      const { error: insertError } = await supabaseAdmin
        .from('league_team_players')
        .insert({
          team_id: teamId,
          player_id: newPlayerId,
          price: newPlayerCost,
          player_name: playerName,
          role: newPlayer.role
        })

      if (insertError) throw insertError
    }

    // 4. Rimuovi il vecchio giocatore dalla rosa
    const { error: deleteError } = await supabaseAdmin
      .from('league_team_players')
      .delete()
      .eq('id', teamPlayerId)

    if (deleteError) throw deleteError

    // 5. Aggiorna il budget della squadra
    const { error: updateBudgetError } = await supabaseAdmin
      .from('league_teams')
      .update({ budget: newBudget })
      .eq('id', teamId)

    if (updateBudgetError) throw updateBudgetError

    return { success: true }
  } catch (err: any) {
    console.error('Errore durante lo svincolo:', err)
    return { success: false, error: err.message || 'Errore imprevisto.' }
  }
}

// 1. Recupera la lista di tutti gli utenti dal DB
export async function getUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, role, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Errore durante il recupero degli utenti:', error)
    return []
  }

  return data as UserProfile[]
}

// 2. Crea un nuovo utente senza invio di email
export async function createDirectUser(params: {
  username: string
  password: string
  role: 'admin' | 'user'
}) {
  const { username, password, role } = params
  const internalEmail = `${username.toLowerCase().trim()}@fanta.local`

  // Crea l'utente su Supabase Auth
  const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { username }
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { success: false, error: 'Questo Username è già in uso!' }
    }
    return { success: false, error: authError.message }
  }

  // Aggiorna lo username e il ruolo nella tabella profiles
  if (data.user) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ username, role })
      .eq('id', data.user.id)

    if (profileError) {
      return { success: false, error: profileError.message }
    }
  }

  return { success: true }
}

// 3. Elimina un utente sia da Auth che dalla tabella profiles
export async function deleteUserByAdmin(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}