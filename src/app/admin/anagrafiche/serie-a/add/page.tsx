'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Trophy,
} from 'lucide-react'

import { supabase } from '../../../../../lib/supabaseClient'
import DashboardSidebar from '../../../../../components/DashboardSidebar'

export default function AddSerieATeamPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [alias, setAlias] = useState('')
  const [colors, setColors] = useState<string[]>([
    '#3b82f6',
  ])

  const [loading, setLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] =
    useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false)

  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const handleAddColor = () => {
    setColors((prev) => [
      ...prev,
      '#ffffff',
    ])
  }

  const handleColorChange = (
    index: number,
    value: string
  ) => {
    setColors((prev) =>
      prev.map((color, i) =>
        i === index
          ? value
          : color
      )
    )
  }

  const handleRemoveColor = (
    index: number
  ) => {
    setColors((prev) => {
      if (prev.length === 1) {
        return prev
      }

      return prev.filter(
        (_, i) => i !== index
      )
    })
  }

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    setMessage(null)

    if (!name.trim() || !alias.trim()) {
      setMessage({
        type: 'error',
        text:
          'Compila il nome completo e l’alias della squadra.',
      })

      return
    }

    setLoading(true)

    try {
      const { error: dbError } =
        await supabase
          .from('teams')
          .insert([
            {
              name: name.trim(),
              alias: alias.trim(),
              color: colors[0],
              colors: colors,
            },
          ])

      if (dbError) {
        throw new Error(
          dbError.message
        )
      }

      setMessage({
        type: 'success',
        text:
          'Squadra aggiunta con successo.',
      })

      setTimeout(() => {
        router.push(
          '/admin/anagrafiche/serie-a'
        )
        router.refresh()
      }, 500)
    } catch (err: any) {
      console.error(
        'Errore aggiunta squadra:',
        err
      )

      setMessage({
        type: 'error',
        text:
          err?.message ||
          'Errore durante il salvataggio della squadra.',
      })

      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const previewBackground =
    colors.length > 1
      ? `linear-gradient(135deg, ${colors.join(', ')})`
      : colors[0]

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col md:flex-row">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <DashboardSidebar
        user={{
          username: 'admin',
          role: 'admin',
        }}
        remainingBudget={0}
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
            <Link
              href="/admin/anagrafiche/serie-a"
              className="
                inline-flex
                items-center
                gap-1.5
                text-xs
                font-bold
                tracking-wider
                text-muted
                hover:text-foreground
                uppercase
                transition-colors
                mb-3
              "
            >
              <ArrowLeft className="w-4 h-4" />
              Squadre Serie A
            </Link>

            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-primary" />
              </div>

              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                Anagrafiche
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              Aggiungi squadra Serie A
            </h1>

            <p className="mt-1.5 text-sm text-muted">
              Inserisci i dati del club e configura
              i suoi colori sociali.
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
                    ? 'bg-success/10 border-success/30'
                    : 'bg-danger/10 border-danger/30'
                }
              `}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-danger shrink-0" />
              )}

              <p
                className={`
                  text-xs font-semibold
                  ${
                    message.type === 'success'
                      ? 'text-success'
                      : 'text-danger-hover'
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
            className="bg-surface-elevated/80 border border-border rounded-2xl shadow-xl overflow-hidden"
          >

            <div className="p-5 md:p-7 space-y-6">

              {/* NOME */}

              <div>
                <label
                  htmlFor="team-name"
                  className="block text-xs font-bold text-muted uppercase tracking-wider mb-2"
                >
                  Nome completo
                </label>

                <input
                  id="team-name"
                  type="text"
                  placeholder="Es. Associazione Calcio Milan"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  required
                  disabled={loading}
                  className="
                    w-full
                    h-11
                    px-3.5
                    rounded-xl
                    bg-background/70
                    border border-border
                    text-sm
                    text-white
                    placeholder:text-muted-2
                    font-semibold
                    outline-none
                    focus:border-primary
                    focus:ring-2
                    focus:ring-primary/10
                    transition-all
                    disabled:opacity-50
                  "
                />

                <p className="text-[11px] text-muted-2 mt-2">
                  Nome ufficiale della squadra.
                </p>
              </div>

              {/* ALIAS */}

              <div>
                <label
                  htmlFor="team-alias"
                  className="block text-xs font-bold text-muted uppercase tracking-wider mb-2"
                >
                  Alias
                </label>

                <input
                  id="team-alias"
                  type="text"
                  placeholder="Es. MILAN o MIL"
                  value={alias}
                  onChange={(e) =>
                    setAlias(e.target.value)
                  }
                  required
                  disabled={loading}
                  className="
                    w-full
                    h-11
                    px-3.5
                    rounded-xl
                    bg-background/70
                    border border-border
                    text-sm
                    text-white
                    placeholder:text-muted-2
                    font-semibold
                    outline-none
                    focus:border-primary
                    focus:ring-2
                    focus:ring-primary/10
                    transition-all
                    disabled:opacity-50
                  "
                />

                <p className="text-[11px] text-muted-2 mt-2">
                  Identificativo breve utilizzato nell&apos;app.
                </p>
              </div>

              {/* COLORI SOCIALI */}

              <div>
                <div className="flex items-center justify-between gap-4 mb-3">
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                    Colori sociali
                  </label>

                  <button
                    type="button"
                    onClick={handleAddColor}
                    className="
                      inline-flex
                      items-center
                      gap-1.5
                      px-3
                      h-8
                      rounded-lg
                      bg-primary/10
                      border border-primary/20
                      text-primary
                      hover:text-primary-hover
                      hover:bg-primary/20
                      text-xs
                      font-bold
                      transition-all
                      shrink-0
                    "
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi colore
                  </button>
                </div>

                {/* PREVIEW */}

                <div
                  className="
                    h-24
                    rounded-2xl
                    border border-border
                    shadow-inner
                    flex items-center
                    justify-center
                    mb-4
                    overflow-hidden
                  "
                  style={{
                    background:
                      previewBackground,
                  }}
                >
                  <div className="px-4 py-2 rounded-xl bg-background/60 backdrop-blur-sm border border-white/10">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-white drop-shadow-lg">
                      {alias || 'ANTEPRIMA'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">

                  {colors.map(
                    (color, index) => (
                      <div
                        key={index}
                        className="
                          flex items-center
                          gap-3
                          p-3
                          rounded-xl
                          bg-background/40
                          border border-border/70
                        "
                      >

                        <div
                          className="w-10 h-10 rounded-lg shrink-0 border border-white/10 shadow-inner"
                          style={{
                            backgroundColor:
                              color,
                          }}
                        />

                        <input
                          type="color"
                          value={
                            /^#[0-9A-Fa-f]{6}$/.test(
                              color
                            )
                              ? color
                              : '#ffffff'
                          }
                          onChange={(e) =>
                            handleColorChange(
                              index,
                              e.target.value
                            )
                          }
                          className="
                            w-10
                            h-10
                            rounded-lg
                            bg-transparent
                            border-0
                            p-0
                            cursor-pointer
                            shrink-0
                          "
                          title="Seleziona colore"
                        />

                        <input
                          type="text"
                          value={color}
                          onChange={(e) =>
                            handleColorChange(
                              index,
                              e.target.value
                            )
                          }
                          className="
                            flex-1
                            min-w-0
                            px-3
                            py-2.5
                            bg-surface
                            border border-border
                            rounded-xl
                            text-xs
                            font-mono
                            text-white
                            focus:outline-none
                            focus:border-primary
                            focus:ring-1
                            focus:ring-primary/30
                          "
                          placeholder="#3b82f6"
                        />

                        {colors.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveColor(
                                index
                              )
                            }
                            title="Rimuovi colore"
                            className="
                              w-9
                              h-9
                              rounded-xl
                              flex
                              items-center
                              justify-center
                              text-muted-2
                              hover:text-danger
                              hover:bg-danger/10
                              border border-transparent
                              hover:border-danger/20
                              transition-all
                              shrink-0
                            "
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>

                <p className="text-[11px] text-muted-2 mt-3">
                  Il primo colore viene mantenuto anche
                  nel campo legacy della squadra.
                </p>
              </div>

            </div>

            {/* FOOTER */}

            <div className="px-5 md:px-7 py-4 bg-surface/40 border-t border-border flex flex-col-reverse sm:flex-row sm:justify-end gap-2">

              <Link
                href="/admin/anagrafiche/serie-a"
                className="
                  inline-flex
                  items-center
                  justify-center
                  h-10
                  px-4
                  rounded-xl
                  border border-border
                  bg-surface-elevated
                  hover:bg-surface-hover
                  text-xs
                  font-bold
                  text-muted
                  hover:text-foreground
                  transition-all
                "
              >
                Annulla
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  h-10
                  px-5
                  rounded-xl
                  bg-primary
                  hover:bg-primary-hover
                  disabled:bg-surface-elevated
                  disabled:text-muted-2
                  disabled:cursor-not-allowed
                  text-white
                  text-xs
                  font-bold
                  shadow-md
                  shadow-primary/20
                  transition-all
                "
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Salva squadra
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
