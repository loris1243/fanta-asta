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
  Palette,
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
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row">

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
        <div className="max-w-[1000px] mx-auto space-y-6">

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
                text-slate-400
                hover:text-white
                uppercase
                transition-colors
                mb-3
              "
            >
              <ArrowLeft className="w-4 h-4" />
              Squadre Serie A
            </Link>

            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-blue-400" />
              </div>

              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">
                Anagrafiche
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              Aggiungi squadra Serie A
            </h1>

            <p className="mt-1.5 text-sm text-slate-400">
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

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            {/* =================================================
                DATI SQUADRA
            ================================================= */}

            <section className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">

              <div className="p-5 md:p-6 border-b border-slate-700/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-blue-400" />
                  </div>

                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-white">
                      Dati squadra
                    </h2>

                    <p className="text-xs text-slate-400 mt-0.5">
                      Informazioni identificative del club.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* NOME */}

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5">
                    Nome completo
                  </label>

                  <input
                    type="text"
                    placeholder="Es. Associazione Calcio Milan"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    required
                    className="
                      w-full
                      px-3.5 py-3
                      bg-slate-950/70
                      border border-slate-700
                      rounded-xl
                      text-sm
                      text-white
                      placeholder-slate-600
                      font-semibold
                      focus:outline-none
                      focus:border-blue-500
                      focus:ring-1
                      focus:ring-blue-500/30
                      transition-all
                    "
                  />

                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Nome ufficiale della squadra.
                  </p>
                </div>

                {/* ALIAS */}

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5">
                    Alias
                  </label>

                  <input
                    type="text"
                    placeholder="Es. MILAN o MIL"
                    value={alias}
                    onChange={(e) =>
                      setAlias(e.target.value)
                    }
                    required
                    className="
                      w-full
                      px-3.5 py-3
                      bg-slate-950/70
                      border border-slate-700
                      rounded-xl
                      text-sm
                      text-white
                      placeholder-slate-600
                      font-semibold
                      focus:outline-none
                      focus:border-blue-500
                      focus:ring-1
                      focus:ring-blue-500/30
                      transition-all
                    "
                  />

                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Identificativo breve utilizzato nell&apos;app.
                  </p>
                </div>
              </div>
            </section>

            {/* =================================================
                COLORI
            ================================================= */}

            <section className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">

              <div className="p-5 md:p-6 border-b border-slate-700/70">
                <div className="flex items-center justify-between gap-4">

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <Palette className="w-5 h-5 text-purple-400" />
                    </div>

                    <div>
                      <h2 className="text-sm font-black uppercase tracking-wider text-white">
                        Colori sociali
                      </h2>

                      <p className="text-xs text-slate-400 mt-0.5">
                        Configura uno o più colori del club.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddColor}
                    className="
                      inline-flex
                      items-center
                      gap-1.5
                      px-3
                      h-9
                      rounded-xl
                      bg-blue-600/10
                      border border-blue-500/20
                      text-blue-400
                      hover:text-blue-300
                      hover:bg-blue-600/20
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
              </div>

              <div className="p-5 md:p-6">

                {/* PREVIEW */}

                <div
                  className="
                    h-24
                    rounded-2xl
                    border border-slate-700
                    shadow-inner
                    flex items-center
                    justify-center
                    mb-5
                    overflow-hidden
                  "
                  style={{
                    background:
                      previewBackground,
                  }}
                >
                  <div className="px-4 py-2 rounded-xl bg-slate-950/60 backdrop-blur-sm border border-white/10">
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
                          bg-slate-950/40
                          border border-slate-700/70
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
                            bg-slate-900
                            border border-slate-700
                            rounded-xl
                            text-xs
                            font-mono
                            text-white
                            focus:outline-none
                            focus:border-blue-500
                            focus:ring-1
                            focus:ring-blue-500/30
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
                              text-slate-500
                              hover:text-red-400
                              hover:bg-red-500/10
                              border border-transparent
                              hover:border-red-500/20
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

                <p className="text-[11px] text-slate-500 mt-3">
                  Il primo colore viene mantenuto anche
                  nel campo legacy della squadra.
                </p>
              </div>
            </section>

            {/* =================================================
                ACTIONS
            ================================================= */}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">

              <Link
                href="/admin/anagrafiche/serie-a"
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  h-11
                  px-5
                  rounded-xl
                  bg-slate-800
                  border border-slate-700
                  hover:bg-slate-700
                  hover:border-slate-600
                  text-slate-300
                  hover:text-white
                  text-sm
                  font-bold
                  transition-all
                "
              >
                <ArrowLeft className="w-4 h-4" />
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
                  h-11
                  px-5
                  rounded-xl
                  bg-blue-600
                  hover:bg-blue-500
                  text-white
                  text-sm
                  font-bold
                  shadow-md
                  shadow-blue-600/20
                  transition-all
                  active:scale-[0.98]
                  disabled:opacity-50
                  disabled:cursor-not-allowed
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

/* =========================================================
   ICONA FANTASTA
========================================================= */

function GavelIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path d="m14.5 6.5 3 3" />
      <path d="m12 9 3 3" />
      <path d="m4 20 7-7" />
      <path d="m3 21 4-4" />
      <path d="m6 13 5 5" />
      <path d="m9 4 11 11" />
      <path d="M14 3 21 10" />
      <path d="M3 17h7" />
    </svg>
  )
}