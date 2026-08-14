'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import { Play, Shield, Users, ArrowLeft, Clock } from 'lucide-react'
import Link from 'next/link'

export default function WaitingRoomPage() {
  const { id } = useParams()
  const router = useRouter()
  const [teamsData, setTeamsData] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Stati per il countdown e gestione asta
  const [auctionStatus, setAuctionStatus] = useState<string>('attesa')
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)

  const currentTeamIdRef = useRef<string | null>(null)
  const channelRef = useRef<any>(null)
  const auctionChannelRef = useRef<any>(null)

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

      // 1. Fetch stato asta iniziale
      const { data: auctionData } = await supabase.from('auctions').select('status, countdown_started_at').eq('id', id).maybeSingle()
      if (auctionData) {
        setAuctionStatus(auctionData.status || 'attesa')
        if (auctionData.status === 'countdown' && auctionData.countdown_started_at) {
          calculateCountdown(auctionData.countdown_started_at)
        }
      }

      // 2. Setup Fetch delle squadre e dello stato online
      const fetchTeams = async () => {
        const { data: teams, error: teamsError } = await supabase.from('league_teams').select('id, name, logo_url')
        const { data: participants, error: partsError } = await supabase.from('auction_participants').select('team_id, is_online').eq('auction_id', id)
        
        if (teamsError) console.error("Errore fetch league_teams:", teamsError)
        if (partsError) console.error("Errore fetch auction_participants:", partsError)

        if (teams && isMounted) {
          const updatedTeams = teams.map(t => ({ 
            ...t, 
            is_online: participants?.find(p => p.team_id === t.id)?.is_online || false 
          }))
          setTeamsData(updatedTeams)

          // Controllo automatico: se tutte le squadre sono online e siamo in 'attesa', l'admin fa partire il countdown in automatico
          // (Lo facciamo fare solo a un client per evitare conflitti, es. il primo team o l'admin)
        }
      }

      // 3. Controllo ruolo Admin
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role === 'admin') setIsAdmin(true)

      // 4. Recupera la squadra associata all'utente loggato
      const { data: teamData, error: teamError } = await supabase.from('league_teams').select('id').eq('user_id', user.id).maybeSingle()

      if (teamData) {
        currentTeamIdRef.current = teamData.id
        
        const { error: upsertError } = await supabase
          .from('auction_participants')
          .upsert(
            { auction_id: id, team_id: teamData.id, is_online: true },
            { onConflict: 'auction_id,team_id' }
          )

        if (upsertError) {
          console.error("Errore durante l'upsert del partecipante:", upsertError)
        }
      }

      await fetchTeams()
      if (isMounted) setLoading(false)

      // 5. Realtime: Sottoscrizione ai cambiamenti dei partecipanti
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      channelRef.current = supabase.channel(`room-changes-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_participants' }, () => fetchTeams())
        .subscribe()

      // 6. Realtime: Sottoscrizione ai cambiamenti dell'asta
      if (auctionChannelRef.current) supabase.removeChannel(auctionChannelRef.current)
      auctionChannelRef.current = supabase.channel(`auction-status-${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${id}` }, (payload) => {
          const newStatus = payload.new.status
          const newTimestamp = payload.new.countdown_started_at
          
          setAuctionStatus(newStatus)
          if (newStatus === 'countdown' && newTimestamp) {
            calculateCountdown(newTimestamp)
          }
        })
        .subscribe()
    }

    init()

    return () => {
      isMounted = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (auctionChannelRef.current) {
        supabase.removeChannel(auctionChannelRef.current)
        auctionChannelRef.current = null
      }
      if (currentTeamIdRef.current) {
        supabase.from('auction_participants').update({ is_online: false })
          .eq('auction_id', id).eq('team_id', currentTeamIdRef.current).then()
      }
    }
  }, [id])

  // Funzione di calcolo del countdown
const calculateCountdown = (startedAtString: string) => {
  const startTime = new Date(startedAtString).getTime()
  
  const interval = setInterval(async () => {
    const now = new Date().getTime()
    const elapsedSeconds = Math.floor((now - startTime) / 1000)
    const remaining = 3 - elapsedSeconds

    if (remaining <= 0) {
      clearInterval(interval)
      setCountdownSeconds(0)
      
      // LOGICA DI SICUREZZA:
      // Anche se sei admin, aggiungiamo un controllo di sicurezza per 
      // verificare che non sia già stato aggiornato (evita spam di chiamate)
      if (isAdmin) {
        try {
          const { error } = await supabase
            .from('auctions')
            .update({ status: 'in_corso' })
            .eq('id', id)
            .neq('status', 'in_corso') // Aggiorna solo se non è già in_corso
          
          if (error) console.error("Errore aggiornamento stato:", error)
        } catch (e) {
          console.error("Errore critico:", e)
        }
      }
      setAuctionStatus('in_corso')
    } else {
      setCountdownSeconds(remaining)
    }
  }, 200)
}

const handleForceStart = async () => {
    // Aggiorniamo subito lo stato locale a 'countdown' per partire istantaneamente
    setAuctionStatus('countdown')
    
    // Salviamo l'orario sul DB (può servire per chi entra dopo)
    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('auctions')
      .update({ status: 'countdown', countdown_started_at: nowIso })
      .eq('id', id)
      
    if (error) {
      alert("Errore durante l'avvio.")
      return
    }

    // Facciamo partire il conto alla rovescia locale in modo sicuro (es. 3 secondi netti)
    let secondsLeft = 3
    setCountdownSeconds(secondsLeft)

    const timer = setInterval(async () => {
      secondsLeft -= 1
      if (secondsLeft <= 0) {
        clearInterval(timer)
        setCountdownSeconds(0)

        // Aggiorniamo lo stato finale a 'in_corso' sul database
        await supabase
          .from('auctions')
          .update({ status: 'in_corso' })
          .eq('id', id)

        setAuctionStatus('in_corso')
      } else {
        setCountdownSeconds(secondsLeft)
      }
    }, 1000) // Intervallo esatto di 1 secondo
  }

  // Controlliamo se tutte le squadre sono online
  const allTeamsOnline = teamsData.length > 0 && teamsData.every(t => t.is_online)

  // Effetto opzionale: se tutte le squadre sono online e siamo in stato 'attesa', l'admin può far partire in automatico o notificare
  useEffect(() => {
    if (allTeamsOnline && isAdmin && auctionStatus === 'attesa') {
      // Opzionale: potremmo far partire il countdown in automatico qui se desiderato,
      // oppure lasciarlo fare manualmente tramite il pulsante che ora rimane ben visibile.
    }
  }, [allTeamsOnline, isAdmin, auctionStatus])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-12 flex flex-col justify-between relative overflow-hidden">
      
      {/* OVERFLOW COUNTDOWN (DA 3 A 0) */}
      {auctionStatus === 'countdown' && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-6 animate-fadeIn">
          <div className="w-20 h-20 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
            <Clock className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white">L'asta inizierà tra</h2>
            <p className="text-7xl md:text-9xl font-black text-amber-400 tracking-tighter drop-shadow-lg">
              {countdownSeconds !== null ? countdownSeconds : 3}
            </p>
          </div>
          <p className="text-sm text-slate-400 font-medium">Preparati a chiamare i tuoi giocatori!</p>
        </div>
      )}

      {/* SALA D'ATTESA NORMALE */}
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
              <p className="text-xs text-slate-400 font-medium">
                {auctionStatus === 'in_corso' ? "L'asta è in corso!" : allTeamsOnline ? "Tutte le squadre sono connesse!" : "In attesa che i partecipanti entrino..."}
              </p>
            </div>
          </div>
        </div>
        
        <div className="space-y-2.5">
          {teamsData.map((team) => (
            <div key={team.id} className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-3 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
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

        {/* Il pulsante di avvio ora compare finché l'asta non è ufficialmente in corso o nel countdown */}
        {isAdmin && auctionStatus !== 'in_corso' && auctionStatus !== 'countdown' && (
          <div className="pt-4 flex flex-col items-center gap-2">
            <button 
              onClick={handleForceStart} 
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase rounded-xl transition-all shadow-lg hover:shadow-blue-600/20"
            >
              <Play className="w-4 h-4" /> {allTeamsOnline ? "Avvia Asta (Tutti Connessi)" : "Forza Avvio Asta"}
            </button>
            {allTeamsOnline && (
              <span className="text-[11px] text-emerald-400 font-medium">Tutti i partecipanti sono online! Puoi procedere all'avvio.</span>
            )}
          </div>
        )}

        {auctionStatus === 'in_corso' && (
          <div className="pt-4 text-center">
            <div className="inline-block px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-black uppercase tracking-wider animate-pulse">
              Asta in corso - Reindirizzamento o schermata successiva attiva
            </div>
          </div>
        )}
      </div>
    </div>
  )
}