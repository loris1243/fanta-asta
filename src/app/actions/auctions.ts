'use server'

import { createServerSupabaseClient } from '../../lib/supabaseServer'
import { revalidatePath } from 'next/cache'

export async function createAuction() {
  const supabase = await createServerSupabaseClient()

  // Verifica che l'utente sia admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non autorizzato' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Solo gli admin possono avviare un asta' }
  }

  // Crea la testata nella tabella padre "auctions"
  const { data, error } = await supabase
    .from('auctions')
    .insert({
      status: 'nuova',
    })
    .select()
    .single()

  if (error) {
    console.error('Errore creazione asta padre:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true, auction: data }
}