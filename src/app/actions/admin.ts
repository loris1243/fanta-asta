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