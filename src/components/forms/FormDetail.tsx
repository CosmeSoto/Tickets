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
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { FilePreviewModal } from '@/components/ui/file-preview-modal'
import type { FormFeedItem } from './types'
import { formatFileSize, getFileEmoji } from './types'

// ── Helpers de URL ─────────────────────────────────────────────────────────────

/** Determina si el archivo es local (subido al servidor) */
function isLocalFile(fileUrl: string | null | undefined): boolean {
  if (!fileUrl) return false
  return fileUrl.startsWith('/api/forms/') || fileUrl.startsWith('/api/admin/forms/')
}

/** Convierte URLs de Google Drive / OneDrive a URLs de vista previa embebible */
function getEmbedUrl(fileUrl: string): string | null {
  // Google Drive: https://drive.google.com/file/d/FILE_ID/view
  const gdMatch = fileUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (gdMatch) {
    return `https://drive.google.com/file/d/${gdMatch[1]}/preview`
  }

  // Google Drive compartido: https://drive.google.com/open?id=FILE_ID
  const gdOpenMatch = fileUrl.match(/drive\.google\.com\/open\?id=([^&]+)/)
  if (gdOpenMatch) {
    return `https://drive.google.com/file/d/${gdOpenMatch[1]}/preview`
  }

  // OneDrive: https://onedrive.live.com/...
  if (fileUrl.includes('onedrive.live.com') || fileUrl.includes('1drv.ms')) {
    // OneDrive embed: reemplazar /view por /embed o usar el viewer de Office
    const embedUrl = fileUrl.replace('/view', '/embed').replace('/download', '/embed')
    return embedUrl !== fileUrl ? embedUrl : null
  }

  // SharePoint / OneDrive for Business
  if (fileUrl.includes('sharepoint.com')) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`
  }

  // Dropbox: cambiar ?dl=0 por ?raw=1 para vista previa
  if (fileUrl.includes('dropbox.com')) {
    return fileUrl.replace('?dl=0', '?raw=1').replace('?dl=1', '?raw=1')
  }

  return null
}

/** Determina si una URL puede mostrarse en iframe/img */
function canPreviewUrl(
  fileUrl: string | null | undefined,
  fileType: string | null | undefined
): boolean {
  if (!fileUrl) return false

  // Archivos locales: PDF e imágenes
  if (isLocalFile(fileUrl)) {
    if (!fileType) return false
    return fileType.includes('pdf') || fileType.includes('image')
  }

  // Google Drive — siempre previsualizable
  if (fileUrl.includes('drive.google.com')) return true

  // OneDrive / SharePoint
  if (
    fileUrl.includes('onedrive.live.com') ||
    fileUrl.includes('1drv.ms') ||
    fileUrl.includes('sharepoint.com')
  )
    return true

  // Dropbox
  if (fileUrl.includes('dropbox.com')) return true

  // URL directa: detectar por extensión o MIME
  const urlLower = fileUrl.toLowerCase().split('?')[0]
  const previewExts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  if (previewExts.some(ext => urlLower.endsWith(ext))) return true

  if (fileType) {
    return fileType.includes('pdf') || fileType.includes('image')
  }

  return false
}

/** Etiqueta legible del tipo de archivo */
function getFileLabel(
  fileType: string | null | undefined,
  fileUrl: string | null | undefined
): string {
  if (fileType) {
    if (fileType.includes('pdf')) return 'PDF'
    if (fileType.includes('word') || fileType.includes('document')) return 'Word'
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'Excel'
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'PowerPoint'
    if (fileType.includes('image')) return 'Imagen'
    if (fileType.includes('zip') || fileType.includes('compressed')) return 'Archivo comprimido'
    if (fileType.includes('text')) return 'Texto'
  }
  if (fileUrl) {
    if (fileUrl.includes('drive.google.com')) return 'Google Drive'
    if (fileUrl.includes('onedrive.live.com') || fileUrl.includes('1drv.ms')) return 'OneDrive'
    if (fileUrl.includes('sharepoint.com')) return 'SharePoint'
    if (fileUrl.includes('dropbox.com')) return 'Dropbox'
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
  const [downloadCount, setDownloadCount] = useState(form._count.form_downloads)

  const hasFile = !!form.fileUrl
  const isLocal = isLocalFile(form.fileUrl)
  const canPreview = canPreviewUrl(form.fileUrl, form.fileType)
  const embedUrl = form.fileUrl ? getEmbedUrl(form.fileUrl) : null
  const previewSrc = isLocal ? `/api/forms/${form.id}/file` : embedUrl || form.fileUrl

  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
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
                        {getFileLabel(form.fileType, form.fileUrl)}
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

                        {/* Vista previa: PDF → modal dedicado, imagen → inline */}
                        {canPreview && (
                          <Button
                            variant='outline'
                            onClick={() => setShowPreview(v => !v)}
                            className='gap-2'
                          >
                            {showPreview &&
                            (form.fileType?.includes('image') ||
                              form.fileUrl?.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) ? (
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

                {/* Vista previa inline para imágenes locales */}
                {showPreview &&
                  canPreview &&
                  previewSrc &&
                  isLocal &&
                  (form.fileType?.includes('image') ||
                    form.fileUrl?.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) && (
                    <div className='rounded-lg overflow-hidden border bg-muted/30'>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewSrc}
                        alt={form.title}
                        className='w-full max-h-[500px] object-contain'
                      />
                    </div>
                  )}

                {/* Vista previa inline para URLs externas embebibles (Google Drive, OneDrive, etc.) */}
                {showPreview && canPreview && previewSrc && !isLocal && (
                  <div className='rounded-lg overflow-hidden border bg-muted/30'>
                    {/* Para PDFs directos, usar object con fallback a Google Docs Viewer */}
                    {form.fileType?.includes('pdf') &&
                    !previewSrc.includes('drive.google.com') &&
                    !previewSrc.includes('onedrive') &&
                    !previewSrc.includes('sharepoint') &&
                    !previewSrc.includes('dropbox') ? (
                      <object data={previewSrc} type='application/pdf' className='w-full h-[500px]'>
                        <iframe
                          src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewSrc)}&embedded=true`}
                          className='w-full h-[500px] border-0'
                          title={form.title}
                        />
                      </object>
                    ) : (
                      <iframe
                        src={previewSrc}
                        title={form.title}
                        className='w-full h-[500px] border-0'
                        allow='autoplay'
                      />
                    )}
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

      {/* Modal de vista previa para PDFs locales */}
      {showPreview && isLocal && canPreview && previewSrc && form.fileType?.includes('pdf') && (
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
    </>
  )
}
