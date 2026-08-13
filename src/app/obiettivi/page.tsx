'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getCurrentUser } from '../actions/auth'
import { supabase } from '../../lib/supabaseClient'
import { Target, Trash2, Settings, Percent, DollarSign, AlertTriangle } from 'lucide-react'

interface TargetPlayer {
  id: string
  player_id: number
  player: {
    id: number
    name: string
    role: string
    team: string
    fvm: number
  }
}

interface RoleBudget {
  mode: 'percentage' | 'fixed'
  P: number
  D: number
  C: number
  A: number
}

export default function ObiettiviPage() {
  const [targets, setTargets] = useState<TargetPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [showWarning, setShowWarning] = useState(false)

  // Budget e impostazioni lega
  const [maxBudget, setMaxBudget] = useState<number>(500)
  const [roleBudget, setRoleBudget] = useState<RoleBudget>({
    mode: 'percentage',
    P: 10,
    D: 20,
    C: 30,
    A: 40
  })

  // Caricamento iniziale dei dati
  useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser()
      if (!user) return
      setUserId(user.id)

      const { data: targetsData, error: targetsError } = await supabase
        .from('user_targets')
        .select(`
          id,
          player_id,
          player:players(id, name, role, team, fvm)
        `)
        .eq('user_id', user.id)

      if (targetsError) console.error('Errore nel caricamento obiettivi:', targetsError)
      else if (targetsData) setTargets(targetsData.filter((item: any) => item.player))

      const { data: settingsData } = await supabase.from('settings').select('*').single()
      if (settingsData?.max_budget) setMaxBudget(settingsData.max_budget)

      const { data: userBudgetPref } = await supabase
        .from('user_role_budgets')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (userBudgetPref) {
        setRoleBudget({
          mode: userBudgetPref.mode || 'percentage',
          P: userBudgetPref.p_val ?? 10,
          D: userBudgetPref.d_val ?? 20,
          C: userBudgetPref.c_val ?? 30,
          A: userBudgetPref.a_val ?? 40,
        })
      }
      setLoading(false)
    }
    loadData()
  }, [])

  // Calcolo crediti effettivi
  const getEffectiveCredits = (roleKey: 'P' | 'D' | 'C' | 'A'): number => {
    const val = roleBudget[roleKey]
    if (roleBudget.mode === 'percentage') return Math.round((maxBudget * val) / 100)
    return val
  }

  const totalDistributed = getEffectiveCredits('P') + getEffectiveCredits('D') + getEffectiveCredits('C') + getEffectiveCredits('A')

  // Controllo budget
  useEffect(() => {
    setShowWarning(totalDistributed > maxBudget)
  }, [totalDistributed, maxBudget])

  // Salvataggio automatico (debounce)
  useEffect(() => {
    if (!userId) return
    const timer = setTimeout(async () => {
      await supabase
        .from('user_role_budgets')
        .upsert({
          user_id: userId,
          mode: roleBudget.mode,
          p_val: roleBudget.P,
          d_val: roleBudget.D,
          c_val: roleBudget.C,
          a_val: roleBudget.A,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
    }, 800)
    return () => clearTimeout(timer)
  }, [roleBudget, userId])

  const updateBudget = (roleKey: 'P' | 'D' | 'C' | 'A', value: number) => setRoleBudget(prev => ({ ...prev, [roleKey]: value }))
  const toggleMode = (mode: 'percentage' | 'fixed') => setRoleBudget(prev => ({ ...prev, mode }))
  const removeTarget = async (targetId: string) => {
    const { error } = await supabase.from('user_targets').delete().eq('id', targetId)
    if (!error) setTargets(targets.filter(t => t.id !== targetId))
  }

  const roles = ['P', 'D', 'C', 'A'] as const
  const roleTitles: Record<string, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-12 space-y-8">
      
      <div className="space-y-4 border-b border-slate-800 pb-6">
        <Link href="/" className="text-xs font-bold text-slate-400 hover:text-white transition uppercase tracking-wider">← Dashboard</Link>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-lg">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase">I Miei Obiettivi</h1>
            <p className="text-xs text-slate-400 font-medium">Gestisci la tua lista di giocatori puntati e configura il tuo budget.</p>
          </div>
        </div>
      </div>

      {showWarning && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <div>
            <h3 className="text-sm font-bold text-red-500">Budget superato!</h3>
            <p className="text-xs text-red-400/80">Hai distribuito {totalDistributed} crediti su un massimo di {maxBudget}. Riduci le quote.</p>
          </div>
        </div>
      )}

      <div className={`bg-slate-800/80 border rounded-2xl p-6 shadow-xl space-y-5 ${showWarning ? 'border-red-500/30' : 'border-slate-700/80'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" /> Distribuzione Budget per Ruolo
            </h2>
            <p className="text-xs text-slate-400">Limite admin: <strong className="text-emerald-400">{maxBudget} cr</strong></p>
          </div>
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-700/80 inline-flex items-center">
            <button onClick={() => toggleMode('percentage')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${roleBudget.mode === 'percentage' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
              <Percent className="w-3.5 h-3.5" /> Percentuale (%)
            </button>
            <button onClick={() => toggleMode('fixed')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${roleBudget.mode === 'fixed' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
              <DollarSign className="w-3.5 h-3.5" /> Crediti Fissi
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {roles.map((roleKey) => (
            <div key={roleKey} className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center text-xs font-black text-slate-300">
                {roleKey} <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{getEffectiveCredits(roleKey)} cr.</span>
              </div>
              <input type="number" value={roleBudget[roleKey]} onChange={(e) => updateBudget(roleKey, Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold outline-none focus:border-amber-500" />
            </div>
          ))}
        </div>
        <div className="text-right text-xs font-bold pt-2">
          Totale: <span className={totalDistributed > maxBudget ? 'text-red-500' : 'text-emerald-400'}>{totalDistributed}</span> / {maxBudget} cr.
        </div>
      </div>

      <div className="space-y-8">
        {roles.map(role => {
          const rolePlayers = targets.filter(t => t.player.role?.toUpperCase() === role)
          return (
            <div key={role} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
              <h2 className="text-sm font-extrabold text-amber-400 uppercase tracking-wider mb-4">{roleTitles[role]} ({rolePlayers.length})</h2>
              {rolePlayers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rolePlayers.map(item => (
                    <div key={item.id} className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{item.player.team}</span>
                        <h3 className="font-bold text-sm">{item.player.name}</h3>
                      </div>
                      <button onClick={() => removeTarget(item.id)} className="p-2 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-500 italic">Nessun giocatore.</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}