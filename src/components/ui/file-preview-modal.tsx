/**
 * FilePreviewModal — Modal global de vista previa de archivos
 * Soporta: imágenes, PDFs (con verificación previa), texto
 * Usado en: tickets, documentos, timeline, y cualquier módulo que necesite preview
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Download,
  FileText,
  File,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Smartphone,
} from 'lucide-react'

/**
 * Detecta si el navegador actual es móvil/tablet y no puede renderizar
 * PDFs en iframe (Chrome Android, Safari iOS, etc.)
 */
function useIsMobileBrowser(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    const mobile =
      /android/i.test(ua) ||
      /iphone|ipad|ipod/i.test(ua) ||
      (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) // iPad con iPadOS
    setIsMobile(mobile)
  }, [])
  return isMobile
}

export interface PreviewFile {
  id: string
  originalName: string
  mimeType: string
  size: number
  /** URL para mostrar el archivo (inline). Para descarga, se usa esta misma quitando ?preview=true */
  url: string
  /** URL de descarga opcional. Si no se provee, se usa url sin ?preview=true */
  downloadUrl?: string
}

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  file: PreviewFile | null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FilePreviewModal({ isOpen, onClose, file }: FilePreviewModalProps) {
  const [imageError, setImageError] = useState(false)
  const [pdfState, setPdfState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [pdfError, setPdfError] = useState('')
  const isMobileBrowser = useIsMobileBrowser()

  const isImage = (file?.mimeType || '').startsWith('image/')
  const isPDF = file?.mimeType === 'application/pdf'
  const isText = (file?.mimeType || '').startsWith('text/')

  // Reset de estado al cambiar de archivo
  useEffect(() => {
    setImageError(false)
    setPdfState('loading')
    setPdfError('')
  }, [file?.id])

  // Verificar disponibilidad del PDF antes de mostrar el iframe.
  // Solo para URLs externas — las rutas relativas del mismo origen se confían directamente.
  useEffect(() => {
    if (!file || !isPDF || !isOpen) return

    const isRelativeUrl = file.url.startsWith('/')

    // Rutas del mismo origen: ir directo al iframe sin fetch verificador
    if (isRelativeUrl) {
      setPdfState('ready')
      return
    }

    const controller = new AbortController()
    setPdfState('loading')

    fetch(file.url, { method: 'GET', signal: controller.signal, credentials: 'include' })
      .then(res => {
        if (!res.ok) {
          return res.text().then(text => {
            try {
              const d = JSON.parse(text)
              throw new Error(d.error || `Error ${res.status}`)
            } catch {
              throw new Error(`Error ${res.status}`)
            }
          })
        }
        setPdfState('ready')
        return undefined
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setPdfError(err.message || 'No se pudo cargar el archivo')
        setPdfState('error')
      })

    return () => controller.abort()
  }, [file?.id, file?.url, isPDF, isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!file) return null

  const downloadUrl = file.downloadUrl ?? file.url.replace('?preview=true', '')

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = file.originalName
    document.body.appendChild(link)
    link.click()
    if (link.parentNode) link.parentNode.removeChild(link)
  }

  const handleOpenNewTab = () => {
    window.open(file.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className='max-w-4xl max-h-[90vh] overflow-hidden flex flex-col'
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {isImage && <ImageIcon className='h-5 w-5 shrink-0' />}
            {isPDF && <FileText className='h-5 w-5 shrink-0' />}
            {!isImage && !isPDF && <File className='h-5 w-5 shrink-0' />}
            <span className='truncate'>{file.originalName}</span>
          </DialogTitle>
          <DialogDescription className='flex items-center justify-between gap-2 flex-wrap'>
            <span>
              {formatFileSize(file.size)} · {file.mimeType}
            </span>
            <div className='flex gap-2'>
              {isPDF && pdfState === 'ready' && (
                <Button variant='outline' size='sm' onClick={handleOpenNewTab}>
                  <ExternalLink className='h-4 w-4 mr-1.5' />
                  Abrir en pestaña
                </Button>
              )}
              <Button variant='outline' size='sm' onClick={handleDownload}>
                <Download className='h-4 w-4 mr-1.5' />
                Descargar
              </Button>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 overflow-auto bg-muted/30 rounded-lg p-4 min-h-0'>
          {/* ── Imagen ── */}
          {isImage && !imageError && (
            <div className='flex items-center justify-center min-h-[400px]'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.url}
                alt={file.originalName}
                className='max-w-full max-h-[600px] object-contain'
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {/* ── PDF ── */}
          {isPDF && (
            <div className='w-full h-[600px] relative'>
              {/* En navegadores móviles el iframe no puede renderizar PDFs */}
              {isMobileBrowser ? (
                <div className='absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center'>
                  <Smartphone className='h-10 w-10 text-muted-foreground' />
                  <div>
                    <p className='font-medium text-sm'>Vista previa no disponible en móvil</p>
                    <p className='text-xs text-muted-foreground mt-1'>
                      Los navegadores móviles no admiten la previsualización de PDFs en línea.
                      Ábrelo en una nueva pestaña o descárgalo.
                    </p>
                  </div>
                  <div className='flex gap-2 flex-wrap justify-center'>
                    <Button size='sm' variant='outline' onClick={handleOpenNewTab}>
                      <ExternalLink className='h-3.5 w-3.5 mr-1.5' />
                      Abrir en pestaña
                    </Button>
                    <Button size='sm' variant='outline' onClick={handleDownload}>
                      <Download className='h-3.5 w-3.5 mr-1.5' />
                      Descargar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {pdfState === 'loading' && (
                    <div className='absolute inset-0 flex flex-col items-center justify-center gap-3'>
                      <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
                      <p className='text-sm text-muted-foreground'>Cargando PDF...</p>
                    </div>
                  )}

                  {pdfState === 'error' && (
                    <div className='absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center'>
                      <AlertTriangle className='h-10 w-10 text-amber-500' />
                      <div>
                        <p className='font-medium text-sm'>No se puede previsualizar el PDF</p>
                        <p className='text-xs text-muted-foreground mt-1'>{pdfError}</p>
                      </div>
                      <div className='flex gap-2 flex-wrap justify-center'>
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

                  {pdfState === 'ready' && (
                    <iframe
                      src={file.url}
                      className='w-full h-full border-0 rounded'
                      title={file.originalName}
                      onError={() => {
                        setPdfState('error')
                        setPdfError('El navegador no pudo mostrar el PDF.')
                      }}
                      onLoad={e => {
                        // Detectar si el iframe cargó una página de error (respuesta no-PDF del servidor)
                        try {
                          const doc = (e.target as HTMLIFrameElement).contentDocument
                          if (doc && doc.contentType && !doc.contentType.includes('pdf')) {
                            const bodyText = doc.body?.innerText ?? ''
                            if (
                              bodyText.includes('not found') ||
                              bodyText.includes('404') ||
                              bodyText.includes('Unauthorized')
                            ) {
                              setPdfState('error')
                              setPdfError(bodyText.trim().slice(0, 80) || 'Archivo no encontrado')
                            }
                          }
                        } catch {
                          // cross-origin o acceso denegado al contentDocument — ignorar
                        }
                      }}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Texto ── */}
          {isText && (
            <div className='bg-background p-4 rounded border'>
              <iframe
                src={file.url}
                className='w-full h-[500px] border-0'
                title={file.originalName}
              />
            </div>
          )}

          {/* ── Tipo no soportado ── */}
          {!isImage && !isPDF && !isText && (
            <div className='flex flex-col items-center justify-center min-h-[400px] text-center'>
              <File className='h-16 w-16 text-muted-foreground mb-4' />
              <p className='text-lg font-medium'>Vista previa no disponible</p>
              <p className='text-sm text-muted-foreground mt-2'>
                Este tipo de archivo no se puede previsualizar
              </p>
              <Button className='mt-4' onClick={handleDownload}>
                <Download className='h-4 w-4 mr-2' />
                Descargar archivo
              </Button>
            </div>
          )}

          {/* ── Error de imagen ── */}
          {isImage && imageError && (
            <div className='flex flex-col items-center justify-center min-h-[400px] text-center'>
              <ImageIcon className='h-16 w-16 text-muted-foreground mb-4' />
              <p className='text-lg font-medium'>Error al cargar la imagen</p>
              <p className='text-sm text-muted-foreground mt-2'>
                No se pudo cargar la vista previa
              </p>
              <Button className='mt-4' onClick={handleDownload}>
                <Download className='h-4 w-4 mr-2' />
                Descargar archivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
