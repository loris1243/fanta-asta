'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getUsers, createUser, deleteUser } from '../../../app/actions/users'
import { getCurrentUser } from '../../../app/actions/auth' // <-- Assicurati di importarla
import { getLeagueSettings } from '../../../app/actions/settings'
import { AlertTriangle } from 'lucide-react'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null) // <-- Stato per l'utente loggato
  const [defaultBudget, setDefaultBudget] = useState(500)
  const [maxUsers, setMaxUsers] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    const [userData, settings, activeUser] = await Promise.all([
      getUsers(), 
      getLeagueSettings(),
      getCurrentUser() // <-- Recuperiamo l'utente loggato
    ])
    setUsers(userData || [])
    setCurrentUser(activeUser) // <-- Salviamo l'utente loggato nello stato
    setDefaultBudget(settings?.initial_budget || 500)
    setMaxUsers(settings?.max_participants ?? null)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleDelete = async (userId: string) => {
    await deleteUser(userId)
    loadData()
  }

  const isLimitReached = maxUsers !== null && users.length >= maxUsers

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <Link href="/" className="text-slate-400 hover:text-white transition-colors text-xs uppercase tracking-widest font-bold mb-2 inline-flex items-center gap-1">
            ← Dashboard
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-1">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Partecipanti</h1>
              <p className="text-slate-400 text-sm mt-1">Aggiungi e gestisci i partecipanti della lega</p>
            </div>
            
            {maxUsers !== null && (
              <div className="self-start sm:self-auto bg-slate-800 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 shadow-sm">
                Totale: <span className={isLimitReached ? 'text-red-400' : 'text-emerald-400'}>{users.length}</span> / {maxUsers}
              </div>
            )}
          </div>
        </div>

        {/* Avviso limite raggiunto */}
        {isLimitReached && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-xs font-bold">
              Hai raggiunto il numero massimo di partecipanti consentito dalle impostazioni ({maxUsers}). Elimina un utente esistente per poterne aggiungere un altro.
            </p>
          </div>
        )}

        {/* Form di Aggiunta */}
        <form 
          onSubmit={async (e) => {
            e.preventDefault()
            if (isLimitReached) return
            
            const formElement = e.currentTarget
            const formData = new FormData(formElement)
            formData.append('budget', defaultBudget.toString())
            await createUser(formData)
            loadData()
            
            formElement.reset()
          }}
          className={`p-6 bg-slate-800/80 rounded-2xl border shadow-xl flex flex-wrap gap-6 items-end transition-all ${
            isLimitReached ? 'opacity-50 border-slate-700/50 pointer-events-none' : 'border-slate-700'
          }`}
        >
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs uppercase tracking-wider text-slate-300 font-bold block mb-1.5">Username</label>
            <input 
              name="username" 
              required 
              disabled={isLimitReached} 
              placeholder="es. FC Real" 
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-400 outline-none transition-colors disabled:cursor-not-allowed" 
            />
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs uppercase tracking-wider text-slate-300 font-bold block mb-1.5">Password</label>
            <input 
              name="password" 
              type="password" 
              required 
              disabled={isLimitReached} 
              placeholder="••••••••" 
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-400 outline-none transition-colors disabled:cursor-not-allowed" 
            />
          </div>

          <div className="w-[130px]">
            <label className="text-xs uppercase tracking-wider text-slate-300 font-bold block mb-1.5">Ruolo</label>
            <select 
              name="role" 
              disabled={isLimitReached} 
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-blue-400 outline-none transition-colors disabled:cursor-not-allowed"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={isLimitReached} 
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Aggiungi
          </button>
        </form>

        {/* Lista Utenti */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 space-y-1 shadow-inner">
          {users.map((u) => {
            // Controlla se l'utente in questa riga è quello attualmente loggato
            const isSelf = currentUser && u.id === currentUser.id

            return (
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
                  
                  {/* Mostra il pulsante Elimina SOLO SE l'utente non è quello loggato */}
                  {!isSelf && (
                    <button 
                      onClick={() => handleDelete(u.id)}
                      className="text-red-400 hover:text-red-300 transition-colors text-sm font-medium"
                    >
                      Elimina
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {users.length === 0 && !loading && (
            <p className="text-xs text-slate-400 py-8 text-center">Nessun partecipante trovato.</p>
          )}
        </div>
      </div>
    </div>
  )
}