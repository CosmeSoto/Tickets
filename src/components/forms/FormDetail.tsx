'use client'

/**
 * FormDetail — Dialog de detalle de documento
 * Modos:
 *  - 'view'   : usuario final (descarga + vista previa)
 *  - 'manage' : admin (+ botones editar/eliminar)
 *
 * Soporta:
 *  - Archivos locales subidos al servidor (servidos por /api/forms/[id]/file)
 *  - URLs externas: Google Drive, OneDrive, Dropbox, links directos
 */

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Calendar,
  User,
  Tag,
  Star,
  FileText,
  Edit,
  Trash2,
  ZoomIn,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { FilePreviewModal } from '@/components/ui/file-preview-modal'
import { ImageLightbox } from '@/components/ui/image-lightbox'
import { detectMedia } from '@/components/common/media-url-input'
import type { FormFeedItem } from './types'
import { formatFileSize, getFileEmoji } from './types'

// ── Helpers de URL ─────────────────────────────────────────────────────────────

/** Determina si el archivo es local (subido al servidor) */
function isLocalFile(fileUrl: string | null | undefined): boolean {
  if (!fileUrl) return false
  return fileUrl.startsWith('/api/forms/') || fileUrl.startsWith('/api/admin/forms/')
}

/** Word/Excel — se convierten a HTML en el navegador dentro de FilePreviewModal */
function isOfficeMime(fileType: string | null | undefined): boolean {
  if (!fileType) return false
  return (
    fileType === 'application/msword' ||
    fileType === 'application/vnd.ms-excel' ||
    fileType.includes('wordprocessingml') ||
    fileType.includes('spreadsheetml')
  )
}

/** Etiqueta legible del tipo de archivo — `remoteLabel` viene de detectMedia() para URLs externas. */
function getFileLabel(
  fileType: string | null | undefined,
  fileUrl: string | null | undefined,
  remoteLabel?: string
): string {
  if (fileType) {
    if (fileType.includes('pdf')) return 'PDF'
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'Excel'
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'PowerPoint'
    if (fileType.includes('word') || fileType.includes('wordprocessingml')) return 'Word'
    if (fileType.includes('image')) return 'Imagen'
    if (fileType.includes('zip') || fileType.includes('compressed')) return 'Archivo comprimido'
    if (fileType.includes('text')) return 'Texto'
  }
  if (remoteLabel && remoteLabel !== 'Enlace externo') return remoteLabel
  if (fileUrl) {
    const ext = fileUrl.split('?')[0].split('.').pop()?.toUpperCase()
    if (ext && ext.length <= 5) return ext
  }
  return 'Archivo adjunto'
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface FormDetailProps {
  form: FormFeedItem
  isOpen: boolean
  onClose: () => void
  mode?: 'view' | 'manage'
  onEdit?: (form: FormFeedItem) => void
  onDelete?: (form: FormFeedItem) => void
  onDownloaded?: () => void
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function FormDetail({
  form,
  isOpen,
  onClose,
  mode = 'view',
  onEdit,
  onDelete,
  onDownloaded,
}: FormDetailProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [downloadCount, setDownloadCount] = useState(form._count.form_downloads)

  const hasFile = !!form.fileUrl
  const isLocal = isLocalFile(form.fileUrl)
  // Para URLs externas, detectMedia() es la misma detección que usa Noticias y
  // el propio DocumentFormDialog al pegar el enlace — evita reimplementar por
  // separado las mismas reglas de Drive/OneDrive/SharePoint/Dropbox y agrega
  // soporte de YouTube/Vimeo gratis si el "documento" es en realidad un video.
  const remoteMedia = !isLocal && form.fileUrl ? detectMedia(form.fileUrl) : null
  const canPreview = isLocal
    ? !!form.fileType &&
      (form.fileType.includes('pdf') ||
        form.fileType.includes('image') ||
        isOfficeMime(form.fileType))
    : !!remoteMedia?.canPreview
  const embedUrl = remoteMedia?.embedUrl ?? null
  const previewSrc = isLocal ? `/api/forms/${form.id}/file` : embedUrl || form.fileUrl
  // Imagen directa externa (o Dropbox con imagen) — se muestra con <img> + zoom,
  // no en un <iframe> apuntando a un dominio arbitrario que pegó quien creó el
  // documento.
  const isRemoteImage =
    !isLocal && !!embedUrl && (remoteMedia?.type === 'image' || remoteMedia?.type === 'dropbox')

  const isOwner = form.createdBy.id === session?.user?.id
  const isAdmin = session?.user?.role === 'ADMIN'
  // Admin (normal o super) puede modificar cualquier documento.
  // TECHNICIAN/CLIENT con canManageForms solo pueden modificar los que crearon.
  const canModify = isAdmin || isOwner

  const handleDownload = async () => {
    if (!hasFile) {
      toast({
        title: 'Sin archivo',
        description: 'Este documento no tiene un archivo adjunto',
        variant: 'destructive',
      })
      return
    }
    try {
      setDownloading(true)
      // Registrar la descarga en BD
      await fetch(`/api/forms/${form.id}/download`, { method: 'POST' })

      if (isLocal) {
        // Archivo local: forzar descarga via endpoint unificado
        window.open(`/api/forms/${form.id}/file?download=true`, '_blank')
      } else {
        // URL externa: abrir directamente
        window.open(form.fileUrl!, '_blank')
      }

      setDownloadCount(c => c + 1)
      onDownloaded?.()
      toast({ title: 'Descarga iniciada', description: `Descargando ${form.title}...` })
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo iniciar la descarga',
        variant: 'destructive',
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className='sm:max-w-2xl max-h-[90vh] overflow-y-auto max-w-[95vw] w-full p-4 sm:p-6'>
          <DialogHeader className='relative'>
            {/* Acciones de gestión - Siempre en la parte superior derecha */}
            {mode === 'manage' && canModify && (
              <div className='flex gap-2 flex-shrink-0 mb-3 sm:absolute sm:top-4 sm:right-4'>
                {onEdit && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      onClose()
                      onEdit(form)
                    }}
                    className='gap-1.5'
                  >
                    <Edit className='h-3.5 w-3.5' />
                    Editar
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      onClose()
                      onDelete(form)
                    }}
                    className='gap-1.5 text-destructive hover:text-destructive'
                  >
                    <Trash2 className='h-3.5 w-3.5' />
                    Eliminar
                  </Button>
                )}
              </div>
            )}
            <div className='flex-1 min-w-0'>
              {/* Badges */}
              <div className='flex items-center gap-2 mb-2 flex-wrap'>
                <span className='text-2xl'>{getFileEmoji(form.fileType)}</span>
                {form.category && (
                  <Badge variant='secondary' className='gap-1'>
                    <Tag className='h-3 w-3' />
                    {form.category.name}
                  </Badge>
                )}
                {form.version && <Badge variant='outline'>v{form.version}</Badge>}
                {form.isFeatured && (
                  <Badge className='gap-1 bg-primary/10 text-primary'>
                    <Star className='h-3 w-3' />
                    Destacado
                  </Badge>
                )}
              </div>
              <DialogTitle className='text-xl sm:text-2xl leading-tight whitespace-normal break-words'>
                {form.title}
              </DialogTitle>
              {/* Metadatos */}
              <div className='flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground'>
                <span className='flex items-center gap-1'>
                  <User className='h-3.5 w-3.5' />
                  {form.createdBy.name}
                </span>
                <span className='flex items-center gap-1'>
                  <Calendar className='h-3.5 w-3.5' />
                  {new Date(form.createdAt).toLocaleDateString('es-EC', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                <span className='flex items-center gap-1'>
                  <Download className='h-3.5 w-3.5' />
                  {downloadCount} descarga{downloadCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </DialogHeader>

          <div className='space-y-4'>
            {/* Descripción corta */}
            {form.description && (
              <p className='text-sm text-muted-foreground leading-relaxed'>{form.description}</p>
            )}

            {/* Resumen / descripción larga */}
            {form.summary && (
              <>
                <Separator />
                <div className='space-y-1'>
                  <p className='text-sm font-medium'>Descripción completa</p>
                  <p className='text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap'>
                    {form.summary}
                  </p>
                </div>
              </>
            )}

            {/* Sección de archivo */}
            {hasFile ? (
              <>
                <Separator />
                <div className='space-y-3'>
                  {/* Info del archivo */}
                  <div className='flex items-center gap-3 p-3 rounded-lg bg-muted/40 border'>
                    <span className='text-2xl flex-shrink-0'>{getFileEmoji(form.fileType)}</span>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium'>
                        {getFileLabel(form.fileType, form.fileUrl, remoteMedia?.label)}
                      </p>
                      <div className='flex items-center gap-2 text-xs text-muted-foreground flex-wrap'>
                        {form.fileSize && <span>{formatFileSize(form.fileSize)}</span>}
                        {!isLocal && (
                          <span className='flex items-center gap-1'>
                            <ExternalLink className='h-3 w-3' />
                            Enlace externo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className='flex flex-wrap gap-2'>
                    {isLocal ? (
                      // Archivo local
                      <>
                        <Button onClick={handleDownload} disabled={downloading} className='gap-2'>
                          <Download className='h-4 w-4' />
                          {downloading ? 'Descargando...' : 'Descargar'}
                        </Button>

                        {/* Vista previa: PDF, imagen y Word/Excel → modal dedicado (FilePreviewModal) */}
                        {canPreview && (
                          <Button
                            variant='outline'
                            onClick={() => setShowPreview(v => !v)}
                            className='gap-2'
                          >
                            {showPreview ? (
                              <>
                                <EyeOff className='h-4 w-4' />
                                Ocultar vista previa
                              </>
                            ) : (
                              <>
                                <Eye className='h-4 w-4' />
                                Vista previa
                              </>
                            )}
                          </Button>
                        )}
                      </>
                    ) : (
                      // URL externa (Google Drive, OneDrive, Dropbox, etc.)
                      <>
                        <Button onClick={handleDownload} disabled={downloading} className='gap-2'>
                          <ExternalLink className='h-4 w-4' />
                          {downloading ? 'Abriendo...' : 'Abrir documento'}
                        </Button>

                        {/* Vista previa embebida para servicios que la soportan */}
                        {canPreview && (
                          <Button
                            variant='outline'
                            onClick={() => setShowPreview(v => !v)}
                            className='gap-2'
                          >
                            {showPreview ? (
                              <>
                                <EyeOff className='h-4 w-4' />
                                Ocultar vista previa
                              </>
                            ) : (
                              <>
                                <Eye className='h-4 w-4' />
                                Vista previa
                              </>
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Vista previa inline para imágenes externas directas (o Dropbox-imagen) —
                    se muestran con <img>+zoom en vez de meterlas en un <iframe>, ya que su
                    origen es el dominio que haya pegado quien creó el documento. */}
                {showPreview && canPreview && previewSrc && isRemoteImage && (
                  <div className='rounded-lg overflow-hidden border bg-muted/30'>
                    <button
                      type='button'
                      onClick={() => setZoomOpen(true)}
                      className='w-full block relative cursor-zoom-in group'
                      aria-label='Ampliar imagen'
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewSrc}
                        alt={form.title}
                        className='w-full max-h-[500px] object-contain'
                      />
                      <span className='absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors'>
                        <ZoomIn className='h-6 w-6 text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity' />
                      </span>
                    </button>
                  </div>
                )}

                {/* Vista previa inline para URLs externas embebibles (Google Drive, OneDrive,
                    Dropbox, YouTube, Vimeo, Office) — allow-same-origin es seguro aquí porque
                    `embedUrl` siempre es uno de los dominios fijos que construye detectMedia()
                    (o el visor de Google Docs, también fijo), nunca uno elegido por quien pegó
                    la URL; sin este flag algunos reproductores/visores no pueden acceder a su
                    storage/cookies para inicializar. */}
                {showPreview &&
                  canPreview &&
                  previewSrc &&
                  !isLocal &&
                  !isRemoteImage &&
                  remoteMedia?.canEmbed &&
                  embedUrl && (
                    <div className='rounded-lg overflow-hidden border bg-muted/30'>
                      {remoteMedia.type === 'pdf' ? (
                        <object data={embedUrl} type='application/pdf' className='w-full h-[500px]'>
                          <iframe
                            src={`https://docs.google.com/viewer?url=${encodeURIComponent(embedUrl)}&embedded=true`}
                            className='w-full h-[500px] border-0'
                            title={form.title}
                            sandbox='allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
                          />
                        </object>
                      ) : (
                        <iframe
                          src={embedUrl}
                          title={form.title}
                          className='w-full h-[500px] border-0'
                          allow='autoplay; fullscreen'
                          sandbox='allow-scripts allow-same-origin allow-popups allow-presentation'
                        />
                      )}
                    </div>
                  )}

                {/* Enlace válido pero no embebible (SharePoint bloquea iframes por política de
                    seguridad, carpetas/Docs de Drive, Dropbox de un tipo no soportado, etc.) —
                    mostramos el motivo en vez de intentar un iframe condenado a fallar. */}
                {showPreview &&
                  canPreview &&
                  !isRemoteImage &&
                  !(remoteMedia?.canEmbed && embedUrl) &&
                  !isLocal && (
                    <div className='flex flex-col items-center justify-center gap-3 py-8 px-4 text-center rounded-lg border bg-muted/30'>
                      <ExternalLink className='h-8 w-8 text-muted-foreground' />
                      <p className='text-sm text-muted-foreground max-w-xs'>
                        {remoteMedia?.previewNote ||
                          'Este servicio no permite mostrar el contenido en vista previa inline.'}
                      </p>
                    </div>
                  )}
              </>
            ) : (
              <div className='flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg'>
                <FileText className='h-8 w-8 text-muted-foreground mb-2' />
                <p className='text-sm text-muted-foreground'>
                  Este documento no tiene un archivo adjunto todavía.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de vista previa para PDFs, imágenes y Word/Excel locales — el zoom de
          imagen ya viene incluido en FilePreviewModal. */}
      {showPreview && isLocal && canPreview && previewSrc && (
        <FilePreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          file={{
            id: form.id,
            originalName: form.title,
            mimeType: form.fileType ?? 'application/pdf',
            size: form.fileSize ?? 0,
            url: previewSrc,
            downloadUrl: `/api/forms/${form.id}/file?download=true`,
          }}
        />
      )}

      {zoomOpen && isRemoteImage && previewSrc && (
        <ImageLightbox src={previewSrc} alt={form.title} onClose={() => setZoomOpen(false)} />
      )}
    </>
  )
}
