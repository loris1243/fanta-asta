'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Shield,
  Target,
  ClipboardList,
  Inbox,
  Users,
  Settings,
  ScrollText,
  Building2,
  LogOut,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Palette,
  Trophy,
  UserRound,
} from 'lucide-react'

import { supabase } from '../../../../../lib/supabaseClient'

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

      <aside
        className={`
          relative shrink-0
          bg-slate-900/95
          border-r border-slate-800
          shadow-xl
          transition-[width]
          duration-300
          ease-in-out
          flex flex-col
          ${
            isSidebarOpen
              ? 'w-full md:w-64'
              : 'w-full md:w-[76px]'
          }
        `}
      >
        <div className="relative p-3 md:p-4">
          <div
            className={`
              relative flex items-center
              ${
                isSidebarOpen
                  ? 'justify-between'
                  : 'justify-center'
              }
              min-h-10
            `}
          >
            <div
              className={`
                flex items-center
                ${
                  isSidebarOpen
                    ? 'gap-3'
                    : 'justify-center'
                }
                min-w-0
              `}
            >
              <div
                className="
                  w-10 h-10 shrink-0
                  rounded-xl
                  bg-blue-600
                  text-white
                  flex items-center justify-center
                  shadow-lg shadow-blue-600/20
                "
              >
                <GavelIcon />
              </div>

              {isSidebarOpen && (
                <div className="min-w-0">
                  <h1 className="font-extrabold text-base tracking-tight text-white leading-tight">
                    FantAsta
                  </h1>

                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Aste Live
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setIsSidebarOpen(
                  (prev) => !prev
                )
              }
              aria-label={
                isSidebarOpen
                  ? 'Comprimi barra laterale'
                  : 'Espandi barra laterale'
              }
              title={
                isSidebarOpen
                  ? 'Comprimi sidebar'
                  : 'Espandi sidebar'
              }
              className={`
                hidden md:flex
                items-center justify-center
                w-7 h-7
                rounded-lg
                text-slate-500
                hover:text-white
                hover:bg-slate-800
                transition-all
                ${
                  !isSidebarOpen
                    ? 'absolute -right-2 top-1/2 -translate-y-1/2 z-20 bg-slate-900 border border-slate-700 shadow-lg'
                    : ''
                }
              `}
            >
              <span className="text-[10px] font-black">
                {isSidebarOpen
                  ? '◀'
                  : '▶'}
              </span>
            </button>
          </div>
        </div>

        {/* USER PLACEHOLDER */}

        <div
          className={`
            mx-3 md:mx-4
            mb-5
            bg-slate-950/70
            border border-slate-800
            rounded-xl
            ${
              isSidebarOpen
                ? 'p-3'
                : 'p-2'
            }
          `}
        >
          <div
            className={`
              flex items-center
              ${
                isSidebarOpen
                  ? 'gap-3'
                  : 'justify-center'
              }
            `}
          >
            <div
              className="
                w-10 h-10
                shrink-0
                rounded-lg
                bg-blue-500/10
                text-blue-300
                border border-blue-500/30
                flex items-center justify-center
              "
            >
              <UserRound className="w-4 h-4" />
            </div>

            {isSidebarOpen && (
              <div>
                <p className="text-sm font-bold text-white">
                  Amministratore
                </p>

                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                  Admin
                </p>
              </div>
            )}
          </div>
        </div>

        {/* NAV */}

        <nav className="flex-1 px-3 md:px-4 overflow-y-auto">
          <div className="space-y-1.5">

            <Link
              href="/"
              title={
                !isSidebarOpen
                  ? 'Dashboard'
                  : undefined
              }
              className="
                flex items-center
                h-11 rounded-xl
                text-sm font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
                gap-3 px-3.5
              "
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              {isSidebarOpen && (
                <span>Dashboard</span>
              )}
            </Link>

            <Link
              href="/rosa"
              title={
                !isSidebarOpen
                  ? 'La Mia Squadra'
                  : undefined
              }
              className="
                flex items-center
                h-11 rounded-xl
                text-sm font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
                gap-3 px-3.5
              "
            >
              <Shield className="w-4 h-4 shrink-0 text-emerald-400" />
              {isSidebarOpen && (
                <span>La Mia Squadra</span>
              )}
            </Link>

            <Link
              href="/obiettivi"
              title={
                !isSidebarOpen
                  ? 'I Miei Obiettivi'
                  : undefined
              }
              className="
                flex items-center
                h-11 rounded-xl
                text-sm font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
                gap-3 px-3.5
              "
            >
              <Target className="w-4 h-4 shrink-0 text-amber-400" />
              {isSidebarOpen && (
                <span>I Miei Obiettivi</span>
              )}
            </Link>

            <Link
              href="/listone"
              title={
                !isSidebarOpen
                  ? 'Listone'
                  : undefined
              }
              className="
                flex items-center
                h-11 rounded-xl
                text-sm font-semibold
                text-slate-300
                hover:text-white
                hover:bg-slate-800
                transition-all
                gap-3 px-3.5
              "
            >
              <ClipboardList className="w-4 h-4 shrink-0" />
              {isSidebarOpen && (
                <span>Listone</span>
              )}
            </Link>

            <div className="pt-4 mt-4 border-t border-slate-800">

              {isSidebarOpen && (
                <span className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Pannello Admin
                </span>
              )}

              <Link
                href="/admin/import-listone"
                title={
                  !isSidebarOpen
                    ? 'Importa Listone'
                    : undefined
                }
                className="
                  flex items-center
                  h-10 rounded-xl
                  text-sm font-semibold
                  text-slate-300
                  hover:text-white
                  hover:bg-slate-800
                  transition-all
                  gap-3 px-3.5
                "
              >
                <Inbox className="w-4 h-4 shrink-0" />
                {isSidebarOpen && (
                  <span>Importa Listone</span>
                )}
              </Link>

              <Link
                href="/admin/users"
                title={
                  !isSidebarOpen
                    ? 'Gestione Partecipanti'
                    : undefined
                }
                className="
                  flex items-center
                  h-10 rounded-xl
                  text-sm font-semibold
                  text-slate-300
                  hover:text-white
                  hover:bg-slate-800
                  transition-all
                  gap-3 px-3.5
                "
              >
                <Users className="w-4 h-4 shrink-0" />
                {isSidebarOpen && (
                  <span>
                    Gestione Partecipanti
                  </span>
                )}
              </Link>

              <Link
                href="/admin/settings"
                title={
                  !isSidebarOpen
                    ? 'Configurazione Lega'
                    : undefined
                }
                className="
                  flex items-center
                  h-10 rounded-xl
                  text-sm font-semibold
                  text-slate-300
                  hover:text-white
                  hover:bg-slate-800
                  transition-all
                  gap-3 px-3.5
                "
              >
                <Settings className="w-4 h-4 shrink-0" />
                {isSidebarOpen && (
                  <span>
                    Configurazione Lega
                  </span>
                )}
              </Link>

              {isSidebarOpen && (
                <span className="px-2 pt-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Anagrafiche
                </span>
              )}

              <Link
                href="/admin/anagrafiche/serie-a"
                title={
                  !isSidebarOpen
                    ? 'Squadre Serie A'
                    : undefined
                }
                className="
                  flex items-center
                  h-9 rounded-xl
                  text-xs font-semibold
                  text-blue-400
                  bg-blue-500/10
                  border border-blue-500/20
                  transition-all
                  gap-3 px-3.5
                "
              >
                <ScrollText className="w-4 h-4 shrink-0" />
                {isSidebarOpen && (
                  <span>
                    Squadre Serie A
                  </span>
                )}
              </Link>

              <Link
                href="/admin/anagrafiche/squadre_lega"
                title={
                  !isSidebarOpen
                    ? 'Squadre Lega'
                    : undefined
                }
                className="
                  flex items-center
                  h-9 rounded-xl
                  text-xs font-semibold
                  text-slate-400
                  hover:text-white
                  hover:bg-slate-800
                  transition-all
                  gap-3 px-3.5
                "
              >
                <Building2 className="w-4 h-4 shrink-0" />
                {isSidebarOpen && (
                  <span>
                    Squadre Lega
                  </span>
                )}
              </Link>
            </div>
          </div>
        </nav>

        <div className="mt-auto p-3 md:p-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleLogout}
            title={
              !isSidebarOpen
                ? 'Esci'
                : undefined
            }
            className="
              w-full
              flex items-center
              h-11 rounded-xl
              text-sm font-semibold
              text-red-400
              hover:text-red-300
              hover:bg-red-500/10
              transition-all
              gap-3 px-3.5
            "
          >
            <LogOut className="w-4 h-4 shrink-0" />

            {isSidebarOpen && (
              <span>Esci</span>
            )}
          </button>
        </div>
      </aside>

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