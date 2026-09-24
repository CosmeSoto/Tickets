'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

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
 * Lightbox de zoom para imágenes, compartido por Noticias, Documentos, Centro
 * de Ayuda y FilePreviewModal.
 *
 * Es un <Dialog> anidado (no un <div> propio portado a mano con createPortal):
 * un div a mano vive fuera del stack de capas de Radix, así que cuando se abre
 * sobre otro Dialog (Noticias, FilePreviewModal), Radix lo trataba como "clic
 * afuera" y arrancaba el cierre del Dialog de abajo a mitad de su animación
 * (el efecto de "doble pantalla" reportado). Radix ya sabe apilar Dialogs
 * anidados correctamente, así que este componente hereda ese comportamiento
 * ya probado por el resto de los modales de la app en vez de reinventarlo.
 */
export function ImageLightbox({ src, alt, onClose, onPrev, onNext, counter }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    setZoom(1)
  }, [src])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape ya lo cierra Radix (onOpenChange) — solo maneja zoom y navegación.
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3))
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5))
      if (e.key === 'ArrowLeft') onPrev?.()
      if (e.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onPrev, onNext])

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent
        hideClose
        aria-describedby={undefined}
        className='max-w-none w-screen h-screen sm:rounded-none rounded-none border-0 p-0 gap-0 shadow-none bg-black/90 flex items-center justify-center'
        // Cierra solo si el clic fue en el fondo, no en la imagen ni los controles.
        onClick={e => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <DialogTitle className='sr-only'>{alt || 'Imagen ampliada'}</DialogTitle>

        <button
          type='button'
          aria-label='Cerrar'
          onClick={onClose}
          className='absolute top-4 right-4 text-white bg-black/50 hover:bg-black/75 p-2 rounded-full transition-colors'
        >
          <X className='h-5 w-5' />
        </button>

        <div className='absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/50 rounded-full px-1.5 py-1'>
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
              onClick={onPrev}
              className='absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/75 p-2 rounded-full transition-colors'
            >
              <ChevronLeft className='h-5 w-5' />
            </button>
            <button
              type='button'
              aria-label='Siguiente'
              onClick={onNext}
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
          style={{ transform: `scale(${zoom})` }}
          className='max-w-[90vw] max-h-[85vh] object-contain transition-transform duration-150 select-none'
        />
      </DialogContent>
    </Dialog>
  )
}
