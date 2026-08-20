'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    Trophy,
    Plus,
    ThumbsUp,
    Award,
    Sparkles,
    Lock,
    Unlock,
    Eye
} from 'lucide-react'

import { getCurrentUser, logout } from '../actions/auth'
import { supabase } from '../../lib/supabaseClient'
import DashboardSidebar from '../../components/DashboardSidebar'

interface UserProfile {
    id: string
    username: string
    role: string
    budget: number
}

interface AwardCategory {
    id: string
    title: string
    description: string
    voting_open: boolean
    show_results: boolean
    created_by: string
    winner_name?: string | null
    is_animating?: boolean
}

interface Candidate {
    id: string
    award_id: string
    user_id: string
    name: string
    description: string
    username?: string
}

export default function PremiPage() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [user, setUser] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    const [categories, setCategories] = useState<AwardCategory[]>([])
    const [candidates, setCandidates] = useState<Candidate[]>([])
    const [votes, setVotes] = useState<Record<string, number>>({})
    const [userVotes, setUserVotes] = useState<Record<string, string[]>>({})

    const [newTitle, setNewTitle] = useState('')
    const [newDesc, setNewDesc] = useState('')

    const [candidateName, setCandidateName] = useState('')
    const [candidateDesc, setCandidateDesc] = useState('')
    const [selectedAwardId, setSelectedAwardId] = useState('')

    // Testo temporaneo della roulette per la suspense su ciascun client
    const [suspenseWinner, setSuspenseWinner] = useState<{ [awardId: string]: string | null }>({})

    useEffect(() => {
        async function loadData() {
            const currentUser = await getCurrentUser()
            if (!currentUser) {
                setLoading(false)
                return
            }
            setUser(currentUser)

            const { data: catData } = await supabase.from('award_categories').select('*')
            if (catData) setCategories(catData)

            const { data: candData } = await supabase.from('award_candidates').select('*')
            if (candData) setCandidates(candData)

            const { data: voteData } = await supabase
                .from('award_votes')
                .select('*')
                .eq('user_id', currentUser.id)

            if (voteData) {
                const userMap: Record<string, string[]> = {}
                voteData.forEach((v: any) => {
                    if (!userMap[v.award_id]) {
                        userMap[v.award_id] = []
                    }
                    userMap[v.award_id].push(v.candidate_id)
                })
                setUserVotes(userMap)
            }

            const { data: allVotes } = await supabase.from('award_votes').select('award_id, candidate_id')
            if (allVotes) {
                const counts: Record<string, number> = {}
                allVotes.forEach((v: any) => {
                    counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1
                })
                setVotes(counts)
            }

            setLoading(false)
        }

        loadData()

        // --- SOTTOSCRIZIONI REALTIME ---
        const channel = supabase
            .channel('public:awards_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'award_categories' },
                (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        setCategories((prev) =>
                            prev.map((cat) => {
                                if (cat.id === payload.new.id) {
                                    // Se lo stato di animazione passa a true nel DB, avviamo la suspense locale anche sul client!
                                    if (payload.new.is_animating && !cat.is_animating) {
                                        runClientSuspense(payload.new.id)
                                    }
                                    return { ...cat, ...payload.new }
                                }
                                return cat
                            })
                        )
                    } else if (payload.eventType === 'INSERT') {
                        setCategories((prev) => [...prev, payload.new as AwardCategory])
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'award_candidates' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setCandidates((prev) => [...prev, payload.new as Candidate])
                    } else if (payload.eventType === 'DELETE') {
                        setCandidates((prev) => prev.filter((c) => c.id !== payload.old.id))
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'award_votes' },
                async () => {
                    const { data: allVotes } = await supabase.from('award_votes').select('award_id, candidate_id')
                    if (allVotes) {
                        const counts: Record<string, number> = {}
                        allVotes.forEach((v: any) => {
                            counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1
                        })
                        setVotes(counts)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // Funzione che esegue l'animazione della roulette su qualsiasi client
    const runClientSuspense = (awardId: string) => {
        const awardCandidates = candidates.filter(c => c.award_id === awardId)
        if (awardCandidates.length === 0) return

        let counter = 0
        const interval = setInterval(() => {
            const randomCandidate = awardCandidates[Math.floor(Math.random() * awardCandidates.length)]
            setSuspenseWinner(prev => ({ ...prev, [awardId]: randomCandidate.name }))
            counter++

            if (counter > 12) {
                clearInterval(interval)
            }
        }, 150)
    }

    const handleLogout = async () => {
        await logout()
    }

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newTitle.trim() || user?.role !== 'admin') return

        await supabase
            .from('award_categories')
            .insert([{ title: newTitle, description: newDesc, created_by: user.id, voting_open: false, show_results: false }])

        setNewTitle('')
        setNewDesc('')
    }

    const toggleAllVoting = async (openState: boolean) => {
        if (user?.role !== 'admin') return
        await supabase
            .from('award_categories')
            .update({ voting_open: openState })
            .neq('id', '00000000-0000-0000-0000-000000000000')
    }

    const toggleAllResults = async (showState: boolean) => {
        if (user?.role !== 'admin') return
        await supabase
            .from('award_categories')
            .update({ show_results: showState })
            .neq('id', '00000000-0000-0000-0000-000000000000')
    }

    const handleAddCandidate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!candidateName.trim() || !selectedAwardId || !user) return

        const category = categories.find(c => c.id === selectedAwardId)
        if (!category?.voting_open) {
            alert("Non puoi aggiungere candidati se le votazioni sono chiuse.")
            return
        }

        const { data: candData } = await supabase
            .from('award_candidates')
            .insert([{ award_id: selectedAwardId, user_id: user.id, name: candidateName, description: candidateDesc }])
            .select()
            .single()

        if (candData) {
            await supabase
                .from('award_votes')
                .insert([{ award_id: selectedAwardId, candidate_id: candData.id, user_id: user.id }])

            setUserVotes(prev => ({
                ...prev,
                [selectedAwardId]: [...(prev[selectedAwardId] || []), candData.id]
            }))
            setCandidateName('')
            setCandidateDesc('')
        }
    }

    const handleVote = async (awardId: string, candidateId: string) => {
        const category = categories.find(c => c.id === awardId)
        if (!category?.voting_open || !user) return

        const currentCategoryVotes = userVotes[awardId] || []
        const hasAlreadyVoted = currentCategoryVotes.includes(candidateId)

        if (hasAlreadyVoted) {
            await supabase
                .from('award_votes')
                .delete()
                .eq('award_id', awardId)
                .eq('candidate_id', candidateId)
                .eq('user_id', user.id)

            setUserVotes(prev => ({
                ...prev,
                [awardId]: prev[awardId].filter(id => id !== candidateId)
            }))
        } else {
            await supabase
                .from('award_votes')
                .insert([{ award_id: awardId, candidate_id: candidateId, user_id: user.id }])

            setUserVotes(prev => ({
                ...prev,
                [awardId]: [...(prev[awardId] || []), candidateId]
            }))
        }
    }

    // --- AVVIO DELL'ESTRAZIONE (ADMIN) ---
    const triggerReveal = async (awardId: string) => {
        if (user?.role !== 'admin') return

        const awardCandidates = candidates.filter(c => c.award_id === awardId)
        if (awardCandidates.length === 0) return

        // Trova il vero vincitore in base ai voti
        let topCandidate = awardCandidates[0]
        let maxV = -1
        awardCandidates.forEach(cand => {
            const vCount = votes[cand.id] || 0
            if (vCount > maxV) {
                maxV = vCount
                topCandidate = cand
            }
        })

        // 1. Imposta is_animating a true nel DB: questo farà partire l'animazione su TUTTI i client connessi via Realtime
        await supabase
            .from('award_categories')
            .update({ is_animating: true, show_results: true })
            .eq('id', awardId)

        // 2. Dopo la durata dell'animazione (es. ~2 secondi), salva il vincitore finale e ferma l'animazione nel DB
        setTimeout(async () => {
            await supabase
                .from('award_categories')
                .update({
                    winner_name: topCandidate.name,
                    is_animating: false
                })
                .eq('id', awardId)
        }, 2000)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-muted font-semibold tracking-wider uppercase">Caricamento premi...</p>
                </div>
            </div>
        )
    }

    if (!user) return null

    return (
        <div className="min-h-screen bg-background text-foreground font-sans flex flex-col md:flex-row">
            <DashboardSidebar
                user={{ username: user.username, role: user.role }}
                remainingBudget={500}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                isMobileMenuOpen={isMobileMenuOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
                onLogout={handleLogout}
            />

            <main className="flex-1 min-w-0 p-5 md:p-8 xl:p-10 overflow-y-auto">
                <div className="max-w-[1500px] mx-auto space-y-6">

                    <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                                    <Trophy className="w-4 h-4 text-accent" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">
                                    Hall of Fame & Extra
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                                Premi Secondari
                            </h1>
                            <p className="mt-1.5 text-sm text-muted">
                                Puoi esprimere più preferenze per categoria e le tue proposte partono già con 1 voto!
                            </p>
                        </div>
                    </header>

                    {user.role === 'admin' && (
                        <div className="flex flex-wrap items-center gap-3 bg-surface-elevated/80 border border-border/80 rounded-2xl p-4 shadow-xl">
                            <span className="text-xs font-black uppercase tracking-widest text-accent mr-2">
                                Azioni Globali Admin:
                            </span>
                            <button
                                type="button"
                                onClick={() => toggleAllVoting(true)}
                                className="bg-success/10 border border-success/30 text-success text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-success/20 transition cursor-pointer flex items-center gap-1.5"
                            >
                                <Unlock className="w-3.5 h-3.5" /> Apri Tutti i Voti
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleAllVoting(false)}
                                className="bg-danger/10 border border-danger/30 text-danger text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-danger/20 transition cursor-pointer flex items-center gap-1.5"
                            >
                                <Lock className="w-3.5 h-3.5" /> Chiudi Tutti i Voti
                            </button>
                            <div className="h-4 w-[1px] bg-border mx-1" />
                            <button
                                type="button"
                                onClick={() => toggleAllResults(true)}
                                className="bg-accent/10 border border-accent/35 text-accent text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-accent/20 transition cursor-pointer flex items-center gap-1.5"
                            >
                                <Eye className="w-3.5 h-3.5" /> Mostra Tutti i Risultati
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleAllResults(false)}
                                className="bg-surface border border-border text-muted text-xs font-bold px-3.5 py-2 rounded-xl hover:text-white transition cursor-pointer flex items-center gap-1.5"
                            >
                                <Lock className="w-3.5 h-3.5" /> Nascondi Tutti i Risultati
                            </button>
                        </div>
                    )}

                    {user.role === 'admin' && (
                        <section className="bg-surface-elevated/80 border border-border/80 rounded-2xl p-5 md:p-6 shadow-xl">
                            <h2 className="text-sm font-black uppercase tracking-widest text-white mb-4 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-accent" />
                                Crea Nuova Categoria (Admin)
                            </h2>
                            <form onSubmit={handleCreateCategory} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <input
                                    type="text"
                                    placeholder="Nome Categoria (es. Pacco d'Oro)"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none focus:border-accent"
                                />
                                <input
                                    type="text"
                                    placeholder="Descrizione breve"
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                    className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none focus:border-accent"
                                />
                                <button
                                    type="submit"
                                    className="bg-accent text-background font-bold text-xs uppercase tracking-wider rounded-xl px-4 py-2.5 hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Aggiungi Categoria
                                </button>
                            </form>
                        </section>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {categories.map((cat) => {
                            const catCandidates = candidates.filter(c => c.award_id === cat.id)
                            const myVotedIds = userVotes[cat.id] || []

                            return (
                                <div key={cat.id} className="bg-surface-elevated/80 border border-border/80 rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between">

                                    <div className="px-5 md:px-6 py-4 border-b border-border/70 bg-background/20 flex items-center justify-between">
                                        <div>
                                            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                                <Award className="w-4 h-4 text-accent" />
                                                {cat.title}
                                            </h2>
                                            <p className="text-xs text-muted mt-0.5">{cat.description}</p>
                                        </div>
                                    </div>

                                    <div className="p-5 md:p-6 space-y-4 flex-1">

                                        <div className="space-y-2">
                                            <span className="text-[10px] font-black text-muted uppercase tracking-wider">Candidati ({catCandidates.length})</span>
                                            {catCandidates.length === 0 ? (
                                                <p className="text-xs text-muted-2 italic py-2">Nessun candidato aggiunto. Proponine uno sotto!</p>
                                            ) : (
                                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                                    {catCandidates.map(cand => {
                                                        const isMyVote = myVotedIds.includes(cand.id)
                                                        const voteCount = votes[cand.id] || 0

                                                        return (
                                                            <div key={cand.id} className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${isMyVote ? 'bg-accent/10 border-accent/40' : 'bg-background/50 border-border/60'}`}>
                                                                <div className="min-w-0">
                                                                    <h4 className="text-xs font-bold text-white truncate">{cand.name}</h4>
                                                                    {cand.description && <p className="text-[10px] text-muted truncate">{cand.description}</p>}
                                                                </div>

                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    {cat.show_results && (
                                                                        <span className="text-[10px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                                                                            {voteCount} voti
                                                                        </span>
                                                                    )}

                                                                    {cat.voting_open && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleVote(cat.id, cand.id)}
                                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${isMyVote ? 'bg-accent text-background' : 'bg-surface border border-border text-muted hover:text-white'}`}
                                                                        >
                                                                            <ThumbsUp className="w-3 h-3" />
                                                                            {isMyVote ? 'Votato' : 'Vota'}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {cat.voting_open ? (
                                            <form onSubmit={(e) => { e.preventDefault(); setSelectedAwardId(cat.id); handleAddCandidate(e); }} className="pt-3 border-t border-border/60 flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Proponi candidato (parte con 1 voto)..."
                                                    value={selectedAwardId === cat.id ? candidateName : ''}
                                                    onChange={(e) => { setSelectedAwardId(cat.id); setCandidateName(e.target.value); }}
                                                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-accent"
                                                />
                                                <button
                                                    type="submit"
                                                    onClick={() => setSelectedAwardId(cat.id)}
                                                    className="bg-surface border border-border text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-border transition cursor-pointer"
                                                >
                                                    Proponi
                                                </button>
                                            </form>
                                        ) : (
                                            <p className="text-[11px] text-muted italic pt-3 border-t border-border/60">Votazioni chiuse: non è possibile aggiungere nuovi candidati.</p>
                                        )}

                                        {/* SEZIONE VINCITORE CON ANIMAZIONE SINCRONIZZATA PER TUTTI */}
                                        {(cat.show_results || user.role === 'admin') && (
                                            <div className="mt-4 pt-4 border-t border-border/75 bg-background/30 rounded-xl p-4 text-center">
                                                <h3 className="text-xs font-black uppercase tracking-widest text-accent mb-2">Momento Verità 🏆</h3>

                                                <div className="py-3 text-lg font-black text-white tracking-wide">
                                                    {cat.is_animating ? (
                                                        <span className="animate-pulse text-accent">🎲 {suspenseWinner[cat.id] || 'Estrazione in corso...'}</span>
                                                    ) : cat.winner_name ? (
                                                        <span className="text-success scale-110 inline-block transition-transform">✨ {cat.winner_name} ✨</span>
                                                    ) : (
                                                        <span className="text-xs text-muted font-normal italic">In attesa della proclamazione del vincitore...</span>
                                                    )}
                                                </div>

                                                {user.role === 'admin' && (
                                                    <button
                                                        type="button"
                                                        disabled={cat.is_animating}
                                                        onClick={() => triggerReveal(cat.id)}
                                                        className="mt-2 text-xs px-4 py-2 rounded-xl font-bold transition 
                                                        bg-accent/20 border border-accent/40 text-accent hover:bg-accent hover:text-background
                                                        disabled:bg-zinc-800 disabled:border-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                                                    >
                                                        {cat.is_animating ? 'Estrazione in corso...' : 'Rivela Vincitore'}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                    </div>

                                </div>
                            )
                        })}
                    </div>

                </div>
            </main>
        </div>
    )
}