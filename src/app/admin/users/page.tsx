'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getUsers, createUser, deleteUser } from '../../../app/actions/users'
import { getLeagueSettings } from '../../../app/actions/settings'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [defaultBudget, setDefaultBudget] = useState(500)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    const [userData, settings] = await Promise.all([getUsers(), getLeagueSettings()])
    setUsers(userData || [])
    setDefaultBudget(settings?.initial_budget || 500)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors text-xs uppercase tracking-widest font-bold mb-2 inline-flex items-center gap-1">
            ← Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Partecipanti</h1>
          <p className="text-slate-400 text-sm mt-1">Aggiungi e gestisci i partecipanti della lega</p>
        </div>

        {/* Form di Aggiunta Luminoso */}
        <form 
          onSubmit={async (e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            formData.append('budget', defaultBudget.toString())
            await createUser(formData)
            loadData()
            e.currentTarget.reset()
          }}
          className="mb-12 p-6 bg-slate-800/80 rounded-2xl border border-slate-700 shadow-xl flex flex-wrap gap-6 items-end"
        >
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs uppercase tracking-wider text-slate-300 font-bold block mb-1.5">Username</label>
            <input name="username" required placeholder="es. FC Real" className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-400 outline-none transition-colors" />
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs uppercase tracking-wider text-slate-300 font-bold block mb-1.5">Password</label>
            <input name="password" type="password" required placeholder="••••••••" className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-400 outline-none transition-colors" />
          </div>

          <div className="w-[130px]">
            <label className="text-xs uppercase tracking-wider text-slate-300 font-bold block mb-1.5">Ruolo</label>
            <select name="role" className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-blue-400 outline-none transition-colors">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-[0.98]">
            Aggiungi
          </button>
        </form>

        {/* Lista Utenti */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 space-y-1 shadow-inner">
          {users.map((u) => (
            <div key={u.id} className="group flex items-center justify-between p-3.5 hover:bg-slate-800 rounded-xl transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-700/80 border border-slate-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    {u.username}
                    {u.role === 'admin' && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-extrabold uppercase">
                        Admin
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{u.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-sm font-mono font-extrabold text-emerald-400">{u.budget} FM</span>
                <button 
                  onClick={async () => { await deleteUser(u.id); loadData() }}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 text-xs font-bold transition-all p-1.5 hover:bg-red-500/10 rounded-lg"
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}

          {users.length === 0 && !loading && (
            <p className="text-xs text-slate-400 py-8 text-center">Nessun partecipante trovato.</p>
          )}
        </div>
      </div>
    </div>
  )
}