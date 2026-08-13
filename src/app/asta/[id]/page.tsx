'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import { Play, Shield, Users, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function WaitingRoomPage() {
  const { id } = useParams()
  const [teamsData, setTeamsData] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const currentTeamIdRef = useRef<string | null>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    let isMounted = true

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      
      if (!user) {
        console.log("Nessun utente loggato trovato.")
        setLoading(false)
        return
      }

      // 1. Setup Fetch delle squadre e dello stato online
      const fetchTeams = async () => {
        const { data: teams, error: teamsError } = await supabase.from('league_teams').select('id, name, logo_url')
        const { data: participants, error: partsError } = await supabase.from('auction_participants').select('team_id, is_online').eq('auction_id', id)
        
        if (teamsError) console.error("Errore fetch league_teams:", teamsError)
        if (partsError) console.error("Errore fetch auction_participants:", partsError)

        if (teams && isMounted) {
          setTeamsData(teams.map(t => ({ 
            ...t, 
            is_online: participants?.find(p => p.team_id === t.id)?.is_online || false 
          })))
        }
      }

      // 2. Controllo ruolo Admin
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role === 'admin') setIsAdmin(true)

      // 3. Recupera la squadra associata all'utente loggato
      const { data: teamData, error: teamError } = await supabase.from('league_teams').select('id').eq('user_id', user.id).maybeSingle()
      console.log("Team trovato per l'utente loggato:", teamData, "Errore:", teamError)

      if (teamData) {
        currentTeamIdRef.current = teamData.id
        
        // 4. Gestione pulita tramite UPSERT (aggiorna a true se esiste già, inserisce se è la prima volta)
        // Nota: richiede un indice UNIQUE su (auction_id, team_id) nella tabella auction_participants
        const { error: upsertError } = await supabase
          .from('auction_participants')
          .upsert(
            { auction_id: id, team_id: teamData.id, is_online: true },
            { onConflict: 'auction_id,team_id' }
          )

        if (upsertError) {
          console.error("Errore durante l'upsert del partecipante:", upsertError)
        }
      } else {
        console.warn("Attenzione: l'utente loggato non ha alcuna squadra associata nella tabella league_teams (campo user_id).")
      }

      await fetchTeams()
      if (isMounted) setLoading(false)

      // 5. Realtime: Sottoscrizione ai cambiamenti dei partecipanti
      if (channelRef.current) supabase.removeChannel(channelRef.current)

      channelRef.current = supabase.channel(`room-changes-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_participants' }, () => fetchTeams())
        .subscribe()
    }

    init()

    return () => {
      isMounted = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      // Imposta is_online a false quando l'utente abbandona la pagina della sala d'attesa
      if (currentTeamIdRef.current) {
        supabase.from('auction_participants').update({ is_online: false })
          .eq('auction_id', id).eq('team_id', currentTeamIdRef.current).then()
      }
    }
  }, [id])

  const handleForceStart = async () => {
    const { error } = await supabase.from('auctions').update({ status: 'in_corso' }).eq('id', id)
    if (error) alert("Errore durante l'avvio.")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-12 flex flex-col justify-between">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 hover:text-white uppercase transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white">Sala d'Attesa</h1>
              <p className="text-xs text-slate-400 font-medium">In attesa che i partecipanti entrino...</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-2.5">
          {teamsData.map((team) => (
            <div key={team.id} className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-3 flex items-center justify-between shadow-md">
              <div className="files flex items-center gap-3">
                {team.logo_url ? (
                  <img src={team.logo_url} alt="" className="w-8 h-8 object-contain rounded-lg bg-slate-900/60 p-1 border border-slate-700" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Shield className="w-4 h-4" />
                  </div>
                )}
                <span className="font-bold text-sm uppercase tracking-wide text-white">{team.name}</span>
              </div>
              <div className={`w-3 h-3 rounded-full ${team.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="pt-4 flex justify-center">
            <button onClick={handleForceStart} className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase rounded-xl transition-all">
              <Play className="w-4 h-4" /> Forza Avvio Asta
            </button>
          </div>
        )}
      </div>
    </div>
  )
}