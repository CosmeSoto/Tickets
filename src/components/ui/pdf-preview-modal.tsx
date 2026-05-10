'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Download, Loader2, AlertTriangle, FileText, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PdfPreviewModalProps {
  /** URL del endpoint que devuelve el PDF con Content-Disposition: inline */
  previewUrl: string
  /** URL del endpoint de descarga (Content-Disposition: attachment) */
  downloadUrl: string
  /** Nombre sugerido para la descarga */
  fileName: string
  /** Título que aparece en el header del modal */
  title: string
  onClose: () => void
}

export function PdfPreviewModal({
  previewUrl,
  downloadUrl,
  fileName,
  title,
  onClose,
}: PdfPreviewModalProps) {
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Verificar disponibilidad del PDF via fetch (mismo origen, sin CORS)
  useEffect(() => {
    setLoadState('loading')
    setErrorMsg('')

    const controller = new AbortController()
    fetch(previewUrl, { method: 'GET', signal: controller.signal })
      .then(res => {
        if (!res.ok) {
          return res.text().then(text => {
            // Si devuelve HTML es un error de Next.js
            if (text.startsWith('<!')) throw new Error(`Error ${res.status}`)
            try {
              const d = JSON.parse(text)
              throw new Error(d.error || `Error ${res.status}`)
            } catch {
              throw new Error(`Error ${res.status}`)
            }
          })
        }
        // PDF disponible — mostrar iframe
        setLoadState('loaded')
        return undefined
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setErrorMsg(err.message || 'No se pudo cargar el PDF')
        setLoadState('error')
      })

    return () => controller.abort()
  }, [previewUrl])

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = fileName
    a.click()
  }

  const handleOpenNewTab = () => {
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className='relative flex flex-col w-full max-w-5xl h-[90vh] bg-background rounded-xl shadow-2xl overflow-hidden'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 px-5 py-3 border-b bg-muted/40 shrink-0'>
          <div className='flex items-center gap-2 min-w-0'>
            <FileText className='h-4 w-4 text-muted-foreground shrink-0' />
            <span className='font-medium text-sm truncate'>{title}</span>
          </div>
          <div className='flex items-center gap-2 shrink-0'>
            {loadState === 'loaded' && (
              <>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={handleOpenNewTab}
                  className='h-8 text-xs'
                >
                  <ExternalLink className='h-3.5 w-3.5 mr-1.5' />
                  Abrir en pestaña
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={handleDownload}
                  className='h-8 text-xs'
                >
                  <Download className='h-3.5 w-3.5 mr-1.5' />
                  Descargar
                </Button>
              </>
            )}
            <button
              onClick={onClose}
              className='rounded-md p-1.5 hover:bg-muted transition-colors'
              aria-label='Cerrar vista previa'
            >
              <X className='h-4 w-4' />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className='flex-1 min-h-0 relative bg-muted/20'>
          {loadState === 'loading' && (
            <div className='absolute inset-0 flex flex-col items-center justify-center gap-3'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>Cargando PDF...</p>
            </div>
          )}

          {loadState === 'error' && (
            <div className='absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center'>
              <AlertTriangle className='h-10 w-10 text-amber-500' />
              <div>
                <p className='font-medium text-sm'>No se puede previsualizar el PDF</p>
                <p className='text-xs text-muted-foreground mt-1'>{errorMsg}</p>
              </div>
              <div className='flex gap-2'>
                <Button size='sm' variant='outline' onClick={handleOpenNewTab}>
                  <ExternalLink className='h-3.5 w-3.5 mr-1.5' />
                  Abrir en nueva pestaña
                </Button>
                <Button size='sm' variant='outline' onClick={handleDownload}>
                  <Download className='h-3.5 w-3.5 mr-1.5' />
                  Descargar
                </Button>
              </div>
            </div>
          )}

          {loadState === 'loaded' && (
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className='w-full h-full border-0'
              title={title}
              onError={() => {
                setLoadState('error')
                setErrorMsg('El navegador no pudo mostrar el PDF en el iframe.')
              }}
            />
          )}
        </div>

        {/* Footer */}
        {loadState === 'loaded' && (
          <div className='px-5 py-2 border-t bg-muted/40 shrink-0'>
            <p className='text-xs text-muted-foreground text-center'>
              Si el PDF no se muestra, usa{' '}
              <button onClick={handleOpenNewTab} className='underline font-medium'>
                Abrir en pestaña
              </button>{' '}
              o{' '}
              <button onClick={handleDownload} className='underline font-medium'>
                Descargar
              </button>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
