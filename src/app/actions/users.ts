'use server'

import { createServerSupabaseClient } from '../../lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// Client Supabase con i permessi Admin (Service Role) per saltare l'invio delle mail
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 1. Recupera tutti i profili
export async function getUsers() {
  const supabase = await createServerSupabaseClient()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Errore recupero utenti:', error)
    return []
  }

  return profiles
}

// 2. Crea un nuovo utente/partecipante SENZA INVIO EMAIL
export async function createUser(formData: FormData) {
  const username = formData.get('username') as string
  let password = formData.get('password') as string
  const role = (formData.get('role') as string) || 'user'
  const budget = parseInt((formData.get('budget') as string) || '500', 10)

  if (!username || !password) {
    return { success: false, error: 'Username e Password sono obbligatori' }
  }

  // Padding password per bypassare il minimo dei 6 caratteri
  if (password && password.length < 6) {
    password = password.padEnd(6, '0')
  }

  const internalEmail = `${username.toLowerCase().trim()}@fanta.local`

  // 💡 USIAMO admin.createUser INVECE DI signUp:
  // Non invia ALCUNA email e crea subito l'utente già confermato!
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: internalEmail,
    password: password.trim(),
    email_confirm: true, // Auto-conferma senza inviare mail
  })

  if (authError) {
    return { success: false, error: authError.message }
  }

  if (authData.user) {
    const supabase = await createServerSupabaseClient()

    // Inserisci/Aggiorna profilo con budget e ruolo
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      username: username.trim(),
      role: role,
      budget: budget,
      email: internalEmail,
    })

    if (profileError) {
      return { success: false, error: profileError.message }
    }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

// 3. Elimina un utente
export async function deleteUser(userId: string) {
  // Eliminiamo l'utente anche da Auth con le API Admin
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (authDeleteError) {
    console.error('Errore eliminazione da Auth:', authDeleteError)
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('profiles').delete().eq('id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/users')
  return { success: true }
}