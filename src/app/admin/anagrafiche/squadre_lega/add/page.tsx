'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ImagePlus,
  Loader2,
  Plus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

import { supabase } from '../../../../../lib/supabaseClient'
import DashboardSidebar from '../../../../../components/DashboardSidebar'

interface User {
  id: string
  username: string
}

interface CurrentUser {
  id: string
  username: string
  role: string
  budget: number
}

export default function AddLeagueTeamPage() {
  const [name, setName] = useState('')
  const [userId, setUserId] = useState('')
  const [budget, setBudget] = useState(500)
  const [users, setUsers] = useState<User[]>([])

  const [logoFile, setLogoFile] =
    useState<File | null>(null)

  const [logoPreview, setLogoPreview] =
    useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null)

  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false)

  useEffect(() => {
    loadData()

    return () => {
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview)
      }
    }
  }, [logoPreview])

  const loadData = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const {
        data: {
          user: authUser,
        },
      } = await supabase.auth.getUser()

      if (authUser) {
        const { data: profile } = await supabase
          .from('users')
          .select('id, username, role, budget')
          .eq('id', authUser.id)
          .single()

        if (profile) {
          setCurrentUser(profile)
        }
      }

      const { data: usersData, error: usersError } =
        await supabase
          .from('profiles')
          .select('id, username')
          .order('username', {
            ascending: true,
          })

      if (usersError) {
        throw new Error(
          'Impossibile caricare gli utenti.'
        )
      }

      setUsers(usersData || [])

      const { data: settingsData, error: settingsError } =
        await supabase
          .from('league_settings')
          .select('initial_budget')
          .maybeSingle()

      if (!settingsError && settingsData?.initial_budget != null) {
        setBudget(settingsData.initial_budget)
      }
    } catch (error) {
      console.error(
        'Errore caricamento dati:',
        error
      )

      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Errore durante il caricamento dei dati.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLogoChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessage({
        type: 'error',
        text:
          'Il file selezionato deve essere un\'immagine.',
      })

      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({
        type: 'error',
        text:
          'Il logo non può superare i 5 MB.',
      })

      event.target.value = ''
      return
    }

    if (logoPreview) {
      URL.revokeObjectURL(logoPreview)
    }

    const previewUrl =
      URL.createObjectURL(file)

    setLogoFile(file)
    setLogoPreview(previewUrl)
    setMessage(null)
  }

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setMessage(null)

    const trimmedName = name.trim()

    if (!trimmedName) {
      setMessage({
        type: 'error',
        text: 'Inserisci il nome della squadra.',
      })

      return
    }

    if (!userId) {
      setMessage({
        type: 'error',
        text:
          'Seleziona il proprietario della squadra.',
      })

      return
    }

    if (budget < 0) {
      setMessage({
        type: 'error',
        text:
          'Il budget non può essere negativo.',
      })

      return
    }

    setSaving(true)

    try {
      /*
       * Controllo duplicati.
       * Non blocchiamo il database con una modifica strutturale:
       * verifichiamo semplicemente se esiste già una squadra
       * con lo stesso nome.
       */
      const { data: existingTeam, error: existingError } =
        await supabase
          .from('league_teams')
          .select('id')
          .ilike('name', trimmedName)
          .maybeSingle()

      if (existingError) {
        throw new Error(
          'Impossibile verificare le squadre esistenti.'
        )
      }

      if (existingTeam) {
        throw new Error(
          'Esiste già una squadra con questo nome.'
        )
      }

      let logoUrl: string | null = null

      if (logoFile) {
        const extension =
          logoFile.name.split('.').pop()?.toLowerCase() ||
          'png'

        const fileName = `${crypto.randomUUID()}.${extension}`

        const filePath = `league-teams/${fileName}`

        const {
          error: uploadError,
        } = await supabase.storage
          .from('league-logos')
          .upload(filePath, logoFile, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          throw new Error(
            `Errore caricamento logo: ${uploadError.message}`
          )
        }

        const {
          data: publicUrlData,
        } = supabase.storage
          .from('team-logos')
          .getPublicUrl(filePath)

        logoUrl =
          publicUrlData.publicUrl
      }

      const {
        error: insertError,
      } = await supabase
        .from('league_teams')
        .insert({
          name: trimmedName,
          user_id: userId,
          logo_url: logoUrl,
          budget,
        })

      if (insertError) {
        throw new Error(
          `Errore creazione squadra: ${insertError.message}`
        )
      }

      setMessage({
        type: 'success',
        text:
          `La squadra "${trimmedName}" è stata creata correttamente.`,
      })

      setName('')
      setUserId('')
      setLogoFile(null)

      if (logoPreview) {
        URL.revokeObjectURL(logoPreview)
      }

      setLogoPreview(null)
    } catch (error) {
      console.error(
        'Errore creazione squadra:',
        error
      )

      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Errore durante la creazione della squadra.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <DashboardSidebar
        user={{
          username: currentUser?.username || 'admin',
          role: currentUser?.role || 'admin',
        }}
        remainingBudget={currentUser?.budget || 0}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onLogout={handleLogout}
      />

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">

        <div className="max-w-[900px] mx-auto space-y-6">

          {/* HEADER */}

          <header>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Plus className="w-4 h-4 text-blue-400" />
              </div>

              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">
                Anagrafiche
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              Nuova squadra
            </h1>

            <p className="mt-1.5 text-sm text-slate-400">
              Aggiungi una nuova squadra alla lega.
            </p>
          </header>

          {/* MESSAGE */}

          {message && (
            <div
              className={`
                rounded-2xl
                border
                p-4
                flex items-start gap-3
                ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }
              `}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              )}

              <p
                className={`
                  text-xs font-semibold
                  ${
                    message.type === 'success'
                      ? 'text-emerald-300'
                      : 'text-red-300'
                  }
                `}
              >
                {message.text}
              </p>
            </div>
          )}

          {/* FORM */}

          <form
            onSubmit={handleSubmit}
            className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl overflow-hidden"
          >

            <div className="p-5 md:p-7 space-y-6">

              {/* NOME */}

              <div>
                <label
                  htmlFor="team-name"
                  className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2"
                >
                  Nome squadra
                </label>

                <input
                  id="team-name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Es. Abate Borisov"
                  disabled={loading || saving}
                  className="
                    w-full
                    h-11
                    px-3.5
                    rounded-xl
                    bg-slate-950/70
                    border border-slate-700
                    text-sm
                    text-white
                    placeholder:text-slate-600
                    outline-none
                    focus:border-blue-500
                    focus:ring-2
                    focus:ring-blue-500/10
                    transition-all
                    disabled:opacity-50
                  "
                />
              </div>

              {/* PROPRIETARIO */}

              <div>
                <label
                  htmlFor="team-owner"
                  className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2"
                >
                  Proprietario
                </label>

                <select
                  id="team-owner"
                  value={userId}
                  onChange={(event) =>
                    setUserId(event.target.value)
                  }
                  disabled={
                    loading ||
                    saving ||
                    users.length === 0
                  }
                  className="
                    w-full
                    h-11
                    px-3.5
                    rounded-xl
                    bg-slate-950/70
                    border border-slate-700
                    text-sm
                    text-white
                    outline-none
                    focus:border-blue-500
                    focus:ring-2
                    focus:ring-blue-500/10
                    transition-all
                    disabled:opacity-50
                  "
                >
                  <option value="">
                    {loading
                      ? 'Caricamento utenti...'
                      : users.length === 0
                        ? 'Nessun utente disponibile'
                        : 'Seleziona proprietario'}
                  </option>

                  {users.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>

              {/* BUDGET */}

              <div>
                <label
                  htmlFor="team-budget"
                  className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2"
                >
                  Budget iniziale
                </label>

                <div className="relative">
                  <input
                    id="team-budget"
                    type="number"
                    min="0"
                    value={budget}
                    onChange={(event) =>
                      setBudget(
                        Number(event.target.value)
                      )
                    }
                    disabled={loading || saving}
                    className="
                      w-full
                      h-11
                      px-3.5
                      pr-16
                      rounded-xl
                      bg-slate-950/70
                      border border-slate-700
                      text-sm
                      text-white
                      outline-none
                      focus:border-blue-500
                      focus:ring-2
                      focus:ring-blue-500/10
                      transition-all
                      disabled:opacity-50
                    "
                  />

                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    crediti
                  </span>
                </div>
              </div>

              {/* LOGO */}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Logo squadra
                </label>

                <div className="flex flex-col sm:flex-row gap-4">

                  <div className="w-28 h-28 rounded-2xl bg-slate-950 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Anteprima logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImagePlus className="w-7 h-7 text-slate-600" />
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-center">

                    <label
                      htmlFor="team-logo"
                      className="
                        inline-flex
                        items-center
                        justify-center
                        gap-2
                        w-fit
                        h-10
                        px-4
                        rounded-xl
                        bg-slate-700
                        hover:bg-slate-600
                        border border-slate-600
                        text-xs
                        font-bold
                        text-white
                        cursor-pointer
                        transition-all
                      "
                    >
                      <ImagePlus className="w-4 h-4" />
                      {logoFile
                        ? 'Cambia logo'
                        : 'Seleziona logo'}
                    </label>

                    <input
                      id="team-logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      disabled={saving}
                      className="hidden"
                    />

                    <p className="text-[11px] text-slate-500 mt-2">
                      PNG, JPG, WEBP. Dimensione massima
                      5 MB.
                    </p>

                    {logoFile && (
                      <p className="text-[11px] text-slate-400 mt-1 truncate">
                        {logoFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* FOOTER */}

            <div className="px-5 md:px-7 py-4 bg-slate-900/40 border-t border-slate-700 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">

              <Link
                href="/admin/anagrafiche/squadre_lega"
                className="
                  inline-flex
                  items-center
                  justify-center
                  h-10
                  px-4
                  rounded-xl
                  border border-slate-700
                  bg-slate-800
                  hover:bg-slate-700
                  text-xs
                  font-bold
                  text-slate-300
                  hover:text-white
                  transition-all
                "
              >
                Annulla
              </Link>

              <button
                type="submit"
                disabled={
                  loading ||
                  saving ||
                  !name.trim() ||
                  !userId
                }
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  h-10
                  px-5
                  rounded-xl
                  bg-blue-600
                  hover:bg-blue-500
                  disabled:bg-slate-700
                  disabled:text-slate-500
                  disabled:cursor-not-allowed
                  text-white
                  text-xs
                  font-bold
                  shadow-md
                  shadow-blue-600/20
                  transition-all
                "
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Crea squadra
                  </>
                )}
              </button>

            </div>
          </form>

        </div>
      </main>
    </div>
  )
}