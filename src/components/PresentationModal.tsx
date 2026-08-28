'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface PresentationModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PresentationModal({
  isOpen,
  onClose,
}: PresentationModalProps) {
  const [mounted, setMounted] = useState(false)

  // Evita mismatch SSR/CSR: il portal può essere creato solo lato client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Blocca lo scroll del body mentre il modale è aperto
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  // Chiusura con tasto Esc
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  // Spazio verticale riservato a padding esterno + pulsante "Chiudi" + gap,
  // così il frame 16:9 non supera mai l'altezza disponibile nel viewport.
  const RESERVED_VERTICAL_SPACE = '8rem'

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      style={{ height: '100dvh', width: '100dvw' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-end gap-2 my-auto"
        style={{
          // La larghezza è la più piccola tra: il massimo desiderato (896px),
          // lo spazio orizzontale disponibile, e la larghezza che, mantenendo
          // il rapporto 16:9, farebbe stare l'altezza nello spazio verticale
          // rimasto. Così il box si restringe su entrambi gli assi invece di
          // uscire dallo schermo quando la finestra è bassa.
          width: `min(896px, 100%, calc((100dvh - ${RESERVED_VERTICAL_SPACE}) * 16 / 9))`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          type="button"
          className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-muted hover:text-white hover:border-border-strong transition"
          title="Chiudi presentazione"
        >
          <X className="w-4 h-4" />
          Chiudi
        </button>

        <div className="relative w-full aspect-video">
          <iframe
            src="/presentation.html"
            title="Presentazione Lega"
            className="w-full h-full rounded-2xl border border-border shadow-2xl"
            allow="autoplay"
          />
        </div>
      </div>
    </div>
  )

  // Portale diretto su document.body: bypassa qualsiasi antenato con
  // transform/filter/backdrop-filter/contain che romperebbe position:fixed
  return createPortal(modalContent, document.body)
}
