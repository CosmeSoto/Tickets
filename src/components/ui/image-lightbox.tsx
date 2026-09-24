'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'

interface ImageLightboxProps {
  src: string
  alt: string
  onClose: () => void
  /** Si se pasan ambos, se muestran flechas de navegación y ← →  funcionan. */
  onPrev?: () => void
  onNext?: () => void
  /** Texto tipo "2 / 5" mostrado abajo cuando hay navegación. */
  counter?: string
}

/**
 * Lightbox de zoom para imágenes, compartido por Noticias, Documentos y
 * FilePreviewModal. Se porta a `document.body` con createPortal: los Dialog
 * de Radix centran su contenido con un `transform` CSS, que crea un
 * containing block nuevo para `position: fixed` — sin el portal, el overlay
 * quedaría atrapado dentro del recuadro del Dialog en vez de cubrir la
 * pantalla completa.
 */
export function ImageLightbox({ src, alt, onClose, onPrev, onNext, counter }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    setZoom(1)
  }, [src])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3))
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5))
      if (e.key === 'ArrowLeft') onPrev?.()
      if (e.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onPrev, onNext])

  if (typeof document === 'undefined') return null

  return createPortal(
    // data-image-lightbox: permite que dialog.tsx (allowPortaledOverlay) ignore
    // los clics aquí dentro — sin esto, un ImageLightbox abierto sobre un Dialog
    // de Radix se interpreta como "clic afuera" y cierra el Dialog subyacente.
    <div
      data-image-lightbox
      className='fixed inset-0 z-[200] bg-black/90 flex items-center justify-center'
      onClick={onClose}
    >
      <button
        type='button'
        aria-label='Cerrar'
        onClick={onClose}
        className='absolute top-4 right-4 text-white bg-black/50 hover:bg-black/75 p-2 rounded-full transition-colors'
      >
        <X className='h-5 w-5' />
      </button>

      <div
        className='absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/50 rounded-full px-1.5 py-1'
        onClick={e => e.stopPropagation()}
      >
        <button
          type='button'
          aria-label='Alejar'
          onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
          className='text-white p-1.5 hover:bg-white/20 rounded-full transition-colors'
        >
          <ZoomOut className='h-4 w-4' />
        </button>
        <span className='text-white text-xs w-10 text-center select-none'>
          {Math.round(zoom * 100)}%
        </span>
        <button
          type='button'
          aria-label='Acercar'
          onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
          className='text-white p-1.5 hover:bg-white/20 rounded-full transition-colors'
        >
          <ZoomIn className='h-4 w-4' />
        </button>
      </div>

      {onPrev && onNext && (
        <>
          <button
            type='button'
            aria-label='Anterior'
            onClick={e => {
              e.stopPropagation()
              onPrev()
            }}
            className='absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/75 p-2 rounded-full transition-colors'
          >
            <ChevronLeft className='h-5 w-5' />
          </button>
          <button
            type='button'
            aria-label='Siguiente'
            onClick={e => {
              e.stopPropagation()
              onNext()
            }}
            className='absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/75 p-2 rounded-full transition-colors'
          >
            <ChevronRight className='h-5 w-5' />
          </button>
        </>
      )}

      {counter && (
        <div className='absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full'>
          {counter}
        </div>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        style={{ transform: `scale(${zoom})` }}
        className='max-w-[90vw] max-h-[85vh] object-contain transition-transform duration-150 cursor-zoom-out select-none'
      />
    </div>,
    document.body
  )
}
