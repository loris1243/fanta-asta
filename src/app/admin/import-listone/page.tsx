'use client'

import { useEffect, useState } from 'react'
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
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react'

import { getCurrentUser, logout } from '../../actions/auth'
import { supabase } from '../../../lib/supabaseClient'
import * as XLSX from 'xlsx'

interface UserProfile {
  id: string
  username: string
  role: string
  budget: number
}

interface ImportResult {
  inserted: number
  updated: number
  deactivated: number
  details: string
}

export default function ImportListonePage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loadingPage, setLoadingPage] = useState(true)
  const [loadingImport, setLoadingImport] = useState(false)

  const [lastResult, setLastResult] = useState<ImportResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const currentUser = await getCurrentUser()

      if (!currentUser) {
        setLoadingPage(false)
        return
      }

      setUser(currentUser)
      setLoadingPage(false)
    }

    loadUser()
  }, [])

  const handleLogout = async () => {
    await logout()
  }

  const formatUsername = (name: string) => {
    if (!name) return ''

    return (
      name.charAt(0).toUpperCase() +
      name.slice(1)
    )
  }

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]

    if (!file) return

    setLoadingImport(true)
    setLastResult(null)
    setErrorMessage(null)

    try {
      const reader = new FileReader()

      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result

          if (!bstr) {
            throw new Error('Impossibile leggere il file selezionato.')
          }

          const workbook = XLSX.read(bstr, {
            type: 'binary',
          })

          if (!workbook.SheetNames.length) {
            throw new Error(
              'Il file Excel non contiene nessun foglio.'
            )
          }

          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]

          if (!sheet) {
            throw new Error(
              'Impossibile leggere il primo foglio del file Excel.'
            )
          }

          const data: any[] =
            XLSX.utils.sheet_to_json(sheet)

          if (data.length === 0) {
            throw new Error(
              'Il file Excel non contiene giocatori.'
            )
          }

          let insertedCount = 0
          let updatedCount = 0
          let deactivatedCount = 0

          const processedIds: number[] = []

          /*
           * 1. Recupero giocatori esistenti
           */
          const {
            data: existingPlayers,
            error: existingPlayersError,
          } = await supabase
            .from('players')
            .select(
              'id, name, quotation, fvm, is_out, team'
            )

          if (existingPlayersError) {
            throw new Error(
              'Errore nel recupero dei giocatori esistenti: ' +
                existingPlayersError.message
            )
          }

          const existingMap = new Map(
            existingPlayers?.map((player) => [
              player.id,
              player,
            ]) || []
          )

          /*
           * 2. Elaborazione Excel
           */
          for (const row of data) {
            const playerId = Number(row['#'])
            const name = row['Nome']
            const team = row['Sq.']
            const role = row['R.']
            const roleMantra = row['R.MANTRA'] || ''
            const quotation = Number(
              row['QUOT.'] || 0
            )
            const fantaMedia = Number(
              row['FM'] || 0
            )
            const fvm = Number(
              row['FVM/1000'] || 0
            )
            const isOut =
              row['Fuori lista'] === '*'

            if (!playerId || !name) {
              continue
            }

            processedIds.push(playerId)

            const existing =
              existingMap.get(playerId)

            /*
             * NUOVO GIOCATORE
             */
            if (!existing) {
              const { error } =
                await supabase
                  .from('players')
                  .insert([
                    {
                      id: playerId,
                      name,
                      team,
                      role,
                      role_mantra: roleMantra,
                      quotation,
                      fanta_media: fantaMedia,
                      fvm,
                      is_out: isOut,
                    },
                  ])

              if (error) {
                throw new Error(
                  `Errore inserimento ${name}: ${error.message}`
                )
              }

              insertedCount++
            }

            /*
             * AGGIORNAMENTO GIOCATORE
             */
            else {
              const { error } =
                await supabase
                  .from('players')
                  .update({
                    name,
                    team,
                    role,
                    role_mantra: roleMantra,
                    quotation,
                    fanta_media: fantaMedia,
                    fvm,
                    is_out: isOut,
                    updated_at:
                      new Date().toISOString(),
                  })
                  .eq('id', playerId)

              if (error) {
                throw new Error(
                  `Errore aggiornamento ${name}: ${error.message}`
                )
              }

              if (
                existing.quotation !== quotation ||
                existing.fvm !== fvm ||
                existing.is_out !== isOut ||
                existing.team !== team
              ) {
                updatedCount++
              }
            }
          }

          /*
           * 3. Disattivazione giocatori
           *    assenti dal nuovo listone
           */
          if (existingPlayers) {
            for (const player of existingPlayers) {
              if (
                !processedIds.includes(player.id) &&
                !player.is_out
              ) {
                const { error } =
                  await supabase
                    .from('players')
                    .update({
                      is_out: true,
                      updated_at:
                        new Date().toISOString(),
                    })
                    .eq('id', player.id)

                if (error) {
                  throw new Error(
                    `Errore disattivazione ${player.name}: ${error.message}`
                  )
                }

                deactivatedCount++
              }
            }
          }

          /*
           * 4. Log importazione
           */
          const logDetails =
            `Importati ${insertedCount} nuovi, ` +
            `aggiornati ${updatedCount}, ` +
            `disattivati ${deactivatedCount} giocatori.`

          const { error: logError } =
            await supabase
              .from('import_logs')
              .insert([
                {
                  inserted_count:
                    insertedCount,
                  updated_count:
                    updatedCount,
                  deactivated_count:
                    deactivatedCount,
                  details: logDetails,
                },
              ])

          if (logError) {
            console.error(
              'Errore salvataggio log:',
              logError
            )
          }

          setLastResult({
            inserted: insertedCount,
            updated: updatedCount,
            deactivated: deactivatedCount,
            details: logDetails,
          })
        } catch (error: any) {
          console.error(
            'Errore importazione:',
            error
          )

          setErrorMessage(
            error?.message ||
              'Errore durante l’importazione del listone.'
          )
        } finally {
          setLoadingImport(false)
        }
      }

      reader.onerror = () => {
        setLoadingImport(false)
        setErrorMessage(
          'Impossibile leggere il file selezionato.'
        )
      }

      reader.readAsBinaryString(file)
    } catch (error: any) {
      setLoadingImport(false)

      setErrorMessage(
        error?.message ||
          'Errore durante l’importazione del listone.'
      )
    }

    e.target.value = ''
  }

  if (loadingPage) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />

          <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
            Caricamento FantAsta...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col md:flex-row">
      {/* =========================================================
          SIDEBAR
      ========================================================= */}

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
        {/* HEADER */}

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
                {isSidebarOpen ? '◀' : '▶'}
              </span>
            </button>
          </div>
        </div>

        {/* USER CARD */}

        <div
          className={`
            mx-3 md:mx-4
            mb-5
            bg-slate-950/70
            border border-slate-800
            rounded-xl
            transition-all
            duration-300
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
                font-black text-xs
              "
            >
              {user.username
                .slice(0, 2)
                .toUpperCase()}
            </div>

            {isSidebarOpen && (
              <div className="min-w-0 overflow-hidden">
                <p className="text-sm font-bold text-white truncate">
                  {formatUsername(
                    user.username
                  )}
                </p>

                <p className="text-xs text-emerald-400 font-extrabold mt-0.5">
                  {user.budget} FM
                </p>
              </div>
            )}
          </div>
        </div>

        {/* NAVIGAZIONE */}

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
                h-11
                rounded-xl
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
                <span className="truncate">
                  Dashboard
                </span>
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
                h-11
                rounded-xl
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
                <span className="truncate">
                  La Mia Squadra
                </span>
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
                h-11
                rounded-xl
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
                <span className="truncate">
                  I Miei Obiettivi
                </span>
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
                h-11
                rounded-xl
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
                <span className="truncate">
                  Listone
                </span>
              )}
            </Link>

            {/* ADMIN */}

            {user.role === 'admin' && (
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
                    h-10
                    rounded-xl
                    text-sm font-semibold
                    text-slate-950
                    bg-blue-600
                    shadow-md
                    shadow-blue-600/20
                    transition-all
                    gap-3 px-3.5
                  "
                >
                  <Inbox className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span className="truncate">
                      Importa Listone
                    </span>
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
                    h-10
                    rounded-xl
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
                    <span className="truncate">
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
                    h-10
                    rounded-xl
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
                    <span className="truncate">
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
                    h-9
                    rounded-xl
                    text-xs font-semibold
                    text-slate-400
                    hover:text-white
                    hover:bg-slate-800
                    transition-all
                    gap-3 px-3.5
                  "
                >
                  <ScrollText className="w-4 h-4 shrink-0" />

                  {isSidebarOpen && (
                    <span className="truncate">
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
                    h-9
                    rounded-xl
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
                    <span className="truncate">
                      Squadre Lega
                    </span>
                  )}
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* FOOTER */}

        <div
          className="
            mt-auto
            p-3 md:p-4
            border-t border-slate-800
          "
        >
          <button
            onClick={handleLogout}
            type="button"
            title={
              !isSidebarOpen
                ? 'Esci'
                : undefined
            }
            className="
              w-full
              flex items-center
              h-11
              rounded-xl
              text-sm font-semibold
              text-red-400
              hover:text-red-300
              hover:bg-red-500/10
              transition-all
              cursor-pointer
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

      {/* =========================================================
          MAIN CONTENT
      ========================================================= */}

      <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto space-y-6">
          {/* HEADER */}

          <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <Link
                href="/"
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
                Dashboard
              </Link>

              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Inbox className="w-4 h-4 text-blue-400" />
                </div>

                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">
                  Amministrazione
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                Importazione Listone
              </h1>

              <p className="mt-1.5 text-sm text-slate-400">
                Aggiorna il database dei giocatori
                utilizzando il listone ufficiale.
              </p>
            </div>
          </header>

          {/* =====================================================
              UPLOAD CARD
          ===================================================== */}

          <section className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 md:p-6 border-b border-slate-700/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                </div>

                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Carica il listone
                  </h2>

                  <p className="text-xs text-slate-400 mt-0.5">
                    Formato supportato: Excel
                    (.xlsx, .xls)
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 md:p-8">
              <label
                className={`
                  relative
                  flex
                  flex-col
                  items-center
                  justify-center
                  min-h-[220px]
                  px-6
                  py-10
                  border-2
                  border-dashed
                  rounded-2xl
                  transition-all
                  ${
                    loadingImport
                      ? 'border-blue-500/40 bg-blue-500/5 cursor-wait'
                      : 'border-slate-600 bg-slate-950/40 hover:border-blue-500/60 hover:bg-blue-500/5 cursor-pointer'
                  }
                `}
              >
                {loadingImport ? (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                      <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                    </div>

                    <span className="text-sm font-bold text-white">
                      Importazione in corso...
                    </span>

                    <span className="text-xs text-slate-500 mt-1">
                      Non chiudere questa pagina.
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                      <Upload className="w-6 h-6 text-blue-400" />
                    </div>

                    <span className="text-sm font-bold text-white">
                      Clicca per selezionare il file
                    </span>

                    <span className="text-xs text-slate-500 mt-1">
                      Listone ufficiale Excel
                    </span>

                    <span className="mt-4 inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      .XLSX / .XLS
                    </span>
                  </>
                )}

                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={loadingImport}
                  className="hidden"
                />
              </label>

              {/* INFO */}

              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-950/50 border border-slate-700/70 p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Nuovi
                  </p>

                  <p className="text-xs text-slate-300 mt-1">
                    Giocatori presenti per la prima volta nel database.
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/50 border border-slate-700/70 p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Aggiornati
                  </p>

                  <p className="text-xs text-slate-300 mt-1">
                    Quotazioni, squadre e dati aggiornati.
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/50 border border-slate-700/70 p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Disattivati
                  </p>

                  <p className="text-xs text-slate-300 mt-1">
                    Giocatori non più presenti nel nuovo listone.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* =====================================================
              ERROR
          ===================================================== */}

          {errorMessage && (
            <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />

                <div>
                  <p className="text-sm font-bold text-red-300">
                    Importazione non completata
                  </p>

                  <p className="text-xs text-red-200/80 mt-1 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* =====================================================
              RESULT
          ===================================================== */}

          {lastResult && (
            <section className="bg-slate-800/80 border border-emerald-500/20 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-5 md:p-6 border-b border-slate-700/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>

                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-white">
                      Importazione completata
                    </h2>

                    <p className="text-xs text-slate-400 mt-0.5">
                      Il listone è stato elaborato correttamente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-slate-950/50 border border-slate-700/70 p-4">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      Nuovi inseriti
                    </p>

                    <p className="text-2xl font-black text-emerald-400 mt-1">
                      {lastResult.inserted}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950/50 border border-slate-700/70 p-4">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      Aggiornati
                    </p>

                    <p className="text-2xl font-black text-blue-400 mt-1">
                      {lastResult.updated}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950/50 border border-slate-700/70 p-4">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      Disattivati
                    </p>

                    <p className="text-2xl font-black text-amber-400 mt-1">
                      {lastResult.deactivated}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700/70">
                  <p className="text-xs text-slate-400">
                    {lastResult.details}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

/*
 * Icona Gavel separata per mantenere il blocco
 * sidebar facilmente leggibile.
 */
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