/**
 * FilePreviewModal — Modal global de vista previa de archivos
 * Soporta: imágenes, PDFs (con verificación previa), texto, Word y Excel
 * (estos últimos dos se convierten a HTML en el navegador con mammoth/xlsx,
 * ya que el servidor los sirve como octet-stream, no inline)
 * Usado en: tickets, documentos, timeline, y cualquier módulo que necesite preview
 */

'use client'

import { useState, useEffect } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Download,
  FileText,
  File,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Smartphone,
  FileSpreadsheet,
} from 'lucide-react'

const WORD_MIMES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const EXCEL_MIMES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

interface ExcelSheet {
  name: string
  html: string
}

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
  const isWord = WORD_MIMES.has(file?.mimeType || '')
  const isExcel = EXCEL_MIMES.has(file?.mimeType || '')

  const [officeState, setOfficeState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [officeError, setOfficeError] = useState('')
  const [wordHtml, setWordHtml] = useState('')
  const [sheets, setSheets] = useState<ExcelSheet[]>([])
  const [activeSheet, setActiveSheet] = useState(0)

  // Reset de estado al cambiar de archivo
  useEffect(() => {
    setImageError(false)
    setPdfState('loading')
    setPdfError('')
    setOfficeState('loading')
    setOfficeError('')
    setWordHtml('')
    setSheets([])
    setActiveSheet(0)
  }, [file?.id])

  // Word/Excel: se convierten a HTML en el navegador (mammoth/xlsx) a partir
  // de los bytes reales del archivo — el servidor los sirve como
  // application/octet-stream (no están en INLINE_SAFE_MIMES), así que un
  // <iframe src=...> no serviría para esto; hay que traer el arraybuffer.
  useEffect(() => {
    if (!file || !isOpen || (!isWord && !isExcel)) return

    const controller = new AbortController()
    setOfficeState('loading')

    fetch(file.url, { signal: controller.signal, credentials: 'include' })
      .then(async res => {
        if (!res.ok) throw new Error(`Error ${res.status}`)
        return res.arrayBuffer()
      })
      .then(async buffer => {
        if (isWord) {
          const mammoth = await import('mammoth')
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
          setWordHtml(DOMPurify.sanitize(result.value))
        } else {
          const XLSX = await import('xlsx')
          const workbook = XLSX.read(buffer, { type: 'array' })
          const parsed = workbook.SheetNames.map(name => ({
            name,
            html: DOMPurify.sanitize(XLSX.utils.sheet_to_html(workbook.Sheets[name])),
          }))
          setSheets(parsed)
        }
        setOfficeState('ready')
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setOfficeError(err.message || 'No se pudo generar la vista previa')
        setOfficeState('error')
      })

    return () => controller.abort()
  }, [file?.id, file?.url, isWord, isExcel, isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

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
        className='max-w-4xl max-h-[90vh] w-[95vw] overflow-hidden flex flex-col p-4 sm:p-6'
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {isImage && <ImageIcon className='h-5 w-5 shrink-0' />}
            {isPDF && <FileText className='h-5 w-5 shrink-0' />}
            {isExcel && <FileSpreadsheet className='h-5 w-5 shrink-0' />}
            {isWord && <FileText className='h-5 w-5 shrink-0' />}
            {!isImage && !isPDF && !isWord && !isExcel && <File className='h-5 w-5 shrink-0' />}
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

          {/* ── Word / Excel (convertidos a HTML en el navegador) ── */}
          {(isWord || isExcel) && (
            <div className='w-full min-h-[400px]'>
              {officeState === 'loading' && (
                <div className='flex flex-col items-center justify-center min-h-[400px] gap-3'>
                  <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
                  <p className='text-sm text-muted-foreground'>Generando vista previa...</p>
                </div>
              )}

              {officeState === 'error' && (
                <div className='flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center'>
                  <AlertTriangle className='h-10 w-10 text-amber-500' />
                  <div>
                    <p className='font-medium text-sm'>No se pudo generar la vista previa</p>
                    <p className='text-xs text-muted-foreground mt-1'>{officeError}</p>
                  </div>
                  <Button size='sm' variant='outline' onClick={handleDownload}>
                    <Download className='h-3.5 w-3.5 mr-1.5' />
                    Descargar
                  </Button>
                </div>
              )}

              {officeState === 'ready' && isWord && (
                <div
                  className={cn(
                    'bg-background rounded border p-6 max-h-[600px] overflow-auto text-sm leading-relaxed',
                    '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2',
                    '[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2',
                    '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1',
                    '[&_p]:mb-3',
                    '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3',
                    '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3',
                    '[&_table]:border-collapse [&_table]:my-3',
                    '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
                    '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted',
                    '[&_a]:text-primary [&_a]:underline',
                    '[&_strong]:font-semibold'
                  )}
                  dangerouslySetInnerHTML={{ __html: wordHtml }}
                />
              )}

              {officeState === 'ready' && isExcel && (
                <div className='space-y-2'>
                  {sheets.length > 1 && (
                    <div className='flex gap-1 flex-wrap border-b pb-2'>
                      {sheets.map((sheet, i) => (
                        <Button
                          key={sheet.name}
                          size='sm'
                          variant={i === activeSheet ? 'secondary' : 'ghost'}
                          onClick={() => setActiveSheet(i)}
                        >
                          {sheet.name}
                        </Button>
                      ))}
                    </div>
                  )}
                  <div
                    className={cn(
                      'bg-background rounded border overflow-auto max-h-[550px]',
                      '[&_table]:border-collapse [&_table]:text-xs',
                      '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
                      '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted'
                    )}
                    dangerouslySetInnerHTML={{ __html: sheets[activeSheet]?.html || '' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Tipo no soportado ── */}
          {!isImage && !isPDF && !isText && !isWord && !isExcel && (
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
