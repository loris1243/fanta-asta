'use client'

import { X } from 'lucide-react'

interface PresentationModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PresentationModal({
  isOpen,
  onClose,
}: PresentationModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl aspect-video"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          type="button"
          className="absolute -top-11 right-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-muted hover:text-white hover:border-border-strong transition"
          title="Chiudi presentazione"
        >
          <X className="w-4 h-4" />
          Chiudi
        </button>

        <iframe
          src="/presentation.html"
          title="Presentazione Lega"
          className="w-full h-full rounded-2xl border border-border shadow-2xl"
          allow="autoplay"
        />
      </div>
    </div>
  )
}
