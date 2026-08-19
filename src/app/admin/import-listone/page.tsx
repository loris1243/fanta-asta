'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

import { getCurrentUser, logout } from '../../actions/auth'
import { supabase } from '../../../lib/supabaseClient'
import DashboardSidebar from '../../../components/DashboardSidebar'
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
  const [importProgress, setImportProgress] = useState(0)

  const [lastResult, setLastResult] = useState<ImportResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
    setImportProgress(0)
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
          const totalRows = data.length + (existingPlayers?.length || 0)
          let processedCount = 0

          const { data: settingsData } = await supabase
            .from('league_settings')
            .select('initial_budget')
            .maybeSingle()

          const initialBudget = settingsData?.initial_budget ?? 500
          const budgetRatio = initialBudget / 1000

          const insertedNames: string[] = []
          const updatedDetailsList: string[] = []
          const deactivatedNames: string[] = []
          
          for (const row of data) {
            processedCount++
            const playerId = Number(row['#'])
            const name = row['Nome']
            const team = row['Sq.']
            const role = row['R.']
            const roleMantra = row['R.MANTRA'] || ''
            const quotation = Number(row['QUOT.'] || 0)
            const fantaMedia = Number(row['FM'] || 0)
            const rawFvm = Number(row['FVM/1000'] || 0)
            // Ricalcola il FVM in base al budget effettivo della lega (arrotondato a intero o mantenuto decimale)
            const fvm = Math.round(rawFvm * budgetRatio)
            const isOut =row['Fuori lista'] === '*'

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
              insertedNames.push(`${name} (${team} - ${role})`)
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
                // Controlliamo cosa è cambiato specificamente
              const changes: string[] = []
              if (existing.quotation !== quotation) {
                changes.push(`Quot: ${existing.quotation} ➔ ${quotation}`)
              }
              if (existing.team !== team) {
                changes.push(`Sq: ${existing.team} ➔ ${team}`)
              }
              if (existing.fvm !== fvm) {
                changes.push(`FVM: ${existing.fvm} ➔ ${fvm}`)
              }
              if (existing.is_out !== isOut) {
                changes.push(isOut ? `Fuori lista` : `Rientrato in lista`)
              }

              if (changes.length > 0) {
                updatedCount++
                updatedDetailsList.push(`• **${name}**: ${changes.join(', ')}`)
              }
              }
            }
            
            const progress = Math.round((processedCount / totalRows) * 100)
            setImportProgress(progress)
          }

          /*
           * 3. Disattivazione giocatori
           *    assenti dal nuovo listone
           */
          if (existingPlayers) {
            for (const player of existingPlayers) {
              processedCount++
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
                deactivatedNames.push(`${player.name} (${player.team})`)
              }
              
              const progress = Math.round((processedCount / totalRows) * 100)
              setImportProgress(progress)
            }
          }

          /*
           * 4. Log importazione
           */
let detailedLogText = `Importati ${insertedCount} nuovi, aggiornati ${updatedCount}, disattivati ${deactivatedCount}.\n\n`

          if (insertedNames.length > 0) {
            detailedLogText += `**Nuovi inseriti:**\n${insertedNames.join(', ')}\n\n`
          }
          if (updatedDetailsList.length > 0) {
            detailedLogText += `**Modifiche rilevate:**\n${updatedDetailsList.join('\n')}\n\n`
          }
          if (deactivatedNames.length > 0) {
            detailedLogText += `**Disattivati:**\n${deactivatedNames.join(', ')}`
          }

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
                  details: detailedLogText,
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
            details: detailedLogText,
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
          setImportProgress(0)
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />

          <p className="text-xs text-muted font-semibold tracking-wider uppercase">
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
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col md:flex-row">
      {/* =========================================================
          OVERLAY BLOCCO UI DURANTE IMPORTAZIONE
      ========================================================= */}
      {loadingImport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-surface-elevated border border-border rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4">
            {/* Spinner */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            </div>

            {/* Testo */}
            <h3 className="text-center text-lg font-bold text-white mb-2">
              Importazione in corso
            </h3>
            <p className="text-center text-sm text-muted mb-6">
              Elaborazione dei giocatori dal listone...
            </p>

            {/* Barra di progresso */}
            <div className="mb-4">
              <div className="w-full h-2 bg-border-strong rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-success transition-all duration-300 ease-out"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>

            {/* Percentuale */}
            <div className="text-center">
              <span className="text-2xl font-black text-primary">{importProgress}%</span>
              <p className="text-xs text-muted-2 mt-2">Non chiudere questa pagina</p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SIDEBAR
      ========================================================= */}

      <DashboardSidebar
        user={{
          username: user?.username || 'admin',
          role: user?.role || 'admin',
        }}
        remainingBudget={user?.budget || 0}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onLogout={handleLogout}
      />

      {/* =========================================================
          MAIN CONTENT
      ========================================================= */}

      <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto space-y-6">
          {/* HEADER */}

          <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              {/* <Link
                href="/"
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  text-xs
                  font-bold
                  tracking-wider
                  text-muted
                  hover:text-white
                  uppercase
                  transition-colors
                  mb-3
                "
              > */}
                {/* <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Link> */}

              <div className="flex items-center gap-2 mb-2">
                {/* <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Inbox className="w-4 h-4 text-primary" />
                </div> */}

                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  Amministrazione
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                Importazione Listone
              </h1>

              <p className="mt-1.5 text-sm text-muted">
                Aggiorna il database dei giocatori
                utilizzando il listone ufficiale.
              </p>
            </div>
          </header>

          {/* =====================================================
              UPLOAD CARD
          ===================================================== */}

          <section className="bg-surface-elevated/80 border border-border rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 md:p-6 border-b border-border/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-success" />
                </div>

                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Carica il listone
                  </h2>

                  <p className="text-xs text-muted mt-0.5">
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
                      ? 'border-primary/40 bg-primary/5 cursor-wait'
                      : 'border-border-strong bg-background/40 hover:border-primary/60 hover:bg-primary/5 cursor-pointer'
                  }
                `}
              >
                {loadingImport ? (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>

                    <span className="text-sm font-bold text-white">
                      Importazione in corso...
                    </span>

                    <span className="text-xs text-muted-2 mt-1">
                      Non chiudere questa pagina.
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>

                    <span className="text-sm font-bold text-white">
                      Clicca per selezionare il file
                    </span>

                    <span className="text-xs text-muted-2 mt-1">
                      Listone ufficiale Excel
                    </span>

                    <span className="mt-4 inline-flex items-center px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-[10px] font-bold uppercase tracking-wider text-muted">
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
                <div className="rounded-xl bg-background/50 border border-border/70 p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-2">
                    Nuovi
                  </p>

                  <p className="text-xs text-muted mt-1">
                    Giocatori presenti per la prima volta nel database.
                  </p>
                </div>

                <div className="rounded-xl bg-background/50 border border-border/70 p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-2">
                    Aggiornati
                  </p>

                  <p className="text-xs text-muted mt-1">
                    Quotazioni, squadre e dati aggiornati.
                  </p>
                </div>

                <div className="rounded-xl bg-background/50 border border-border/70 p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-2">
                    Disattivati
                  </p>

                  <p className="text-xs text-muted mt-1">
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
            <section className="rounded-2xl border border-danger/30 bg-danger/10 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />

                <div>
                  <p className="text-sm font-bold text-danger-hover">
                    Importazione non completata
                  </p>

                  <p className="text-xs text-danger/80 mt-1 leading-relaxed">
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
            <section className="bg-surface-elevated/80 border border-success/20 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-5 md:p-6 border-b border-border/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>

                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-white">
                      Importazione completata
                    </h2>

                    <p className="text-xs text-muted mt-0.5">
                      Il listone è stato elaborato correttamente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-background/50 border border-border/70 p-4">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-2">
                      Nuovi inseriti
                    </p>

                    <p className="text-2xl font-black text-success mt-1">
                      {lastResult.inserted}
                    </p>
                  </div>

                  <div className="rounded-xl bg-background/50 border border-border/70 p-4">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-2">
                      Aggiornati
                    </p>

                    <p className="text-2xl font-black text-primary mt-1">
                      {lastResult.updated}
                    </p>
                  </div>

                  <div className="rounded-xl bg-background/50 border border-border/70 p-4">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-2">
                      Disattivati
                    </p>

                    <p className="text-2xl font-black text-accent mt-1">
                      {lastResult.deactivated}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-700/70">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Report Dettagliato delle Modifiche:
                  </p>
                  
                  <div className="max-h-60 overflow-y-auto rounded-xl bg-slate-950/50 border border-slate-700/70 p-4 text-xs text-slate-300 whitespace-pre-line leading-relaxed font-mono">
                    {lastResult.details}
                  </div>
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