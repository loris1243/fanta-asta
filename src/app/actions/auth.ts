'use server'

import { createServerSupabaseClient } from '../../lib/supabaseServer'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function loginWithUsername(username: string, password: string) {
  const supabase = await createServerSupabaseClient()

  // Genera l'email interna
  const internalEmail = `${username.toLowerCase().trim()}@fanta.local`

  const { data, error } = await supabase.auth.signInWithPassword({
    email: internalEmail,
    password: password.trim(),
  })

  if (error) {
    console.error('Errore Login Supabase:', error.message)
    return { success: false, error: `Errore Supabase: ${error.message}` }
  }

  return { success: true, user: data.user }
}

export async function getCurrentUser() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return null
    }

    // Se hai una tabella "profiles" o "users" collegata dove salvi username, ruolo e budget:
    const { data: profile } = await supabase
      .from('profiles') // Assicurati che si chiami così, oppure adatta il nome della tabella utenti
      .select('*')
      .eq('id', authUser.id)
      .single()

    return {
      id: authUser.id,
      username: profile?.username || authUser.email?.split('@')[0] || 'Utente',
      role: profile?.role || 'user',
      budget: profile?.budget ?? 500,
    }
  } catch (error) {
    console.error('Errore in getCurrentUser:', error)
    return null
  }
}

export async function logout() {
  const supabase = await createServerSupabaseClient()

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}