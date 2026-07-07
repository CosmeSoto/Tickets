'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Upload,
  Trash2,
  Download,
  Eye,
  FileText,
  Image,
  File,
  Loader2,
  Paperclip,
  Camera,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Smartphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'
import { extractCatchError } from '@/lib/utils/api-error'

interface Attachment {
  id: string
  originalName: string
  mimeType: string
  size: number
  createdAt: string
  uploader: { id: string; name: string }
}

interface EquipmentAttachmentsProps {
  equipmentId: string
  canManage: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <Image className='h-4 w-4 text-primary' />
  if (mimeType === 'application/pdf') return <FileText className='h-4 w-4 text-destructive' />
  return <File className='h-4 w-4 text-muted-foreground' />
}

const ACCEPTED = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
].join(',')

// ── Detección de navegador móvil ──────────────────────────────────────────────

function useIsMobileBrowser(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    const mobile =
      /android/i.test(ua) ||
      /iphone|ipad|ipod/i.test(ua) ||
      (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
    setIsMobile(mobile)
  }, [])
  return isMobile
}

// ── Modal de preview ─────────────────────────────────────────────────────────

interface PreviewModalProps {
  attachment: Attachment
  allImages: Attachment[]
  baseUrl: string
  onClose: () => void
  onNavigate: (att: Attachment) => void
  onDownload: (att: Attachment) => void
}

function PreviewModal({
  attachment,
  allImages,
  baseUrl,
  onClose,
  onNavigate,
  onDownload,
}: PreviewModalProps) {
  const [zoom, setZoom] = useState(1)
  const isImage = attachment.mimeType.startsWith('image/')
  const isPdf = attachment.mimeType === 'application/pdf'
  const previewUrl = `${baseUrl}/${attachment.id}?preview=true`
  const isMobileBrowser = useIsMobileBrowser()

  const currentIndex = allImages.findIndex(a => a.id === attachment.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < allImages.length - 1

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(allImages[currentIndex - 1])
      if (e.key === 'ArrowRight' && hasNext) onNavigate(allImages[currentIndex + 1])
    },
    [onClose, hasPrev, hasNext, allImages, currentIndex, onNavigate]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Reset zoom when attachment changes
  useEffect(() => {
    setZoom(1)
  }, [attachment.id])

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm'
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className='relative flex flex-col bg-card rounded-xl shadow-2xl overflow-hidden'
        style={{ maxWidth: '92vw', maxHeight: '92vh', width: isImage ? 'auto' : '860px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Barra superior */}
        <div className='flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-card shrink-0'>
          <div className='flex items-center gap-2 min-w-0'>
            <FileIcon mimeType={attachment.mimeType} />
            <span className='text-sm font-medium truncate max-w-[280px]'>
              {attachment.originalName}
            </span>
            <span className='text-xs text-muted-foreground shrink-0'>
              {formatSize(attachment.size)}
            </span>
          </div>
          <div className='flex items-center gap-1 shrink-0'>
            {isImage && (
              <>
                <Button
                  size='icon'
                  variant='ghost'
                  className='h-7 w-7'
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  title='Reducir'
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className='h-3.5 w-3.5' />
                </Button>
                <span className='text-xs text-muted-foreground w-10 text-center'>
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  size='icon'
                  variant='ghost'
                  className='h-7 w-7'
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  title='Ampliar'
                  disabled={zoom >= 3}
                >
                  <ZoomIn className='h-3.5 w-3.5' />
                </Button>
              </>
            )}
            <Button
              size='icon'
              variant='ghost'
              className='h-7 w-7'
              onClick={() => onDownload(attachment)}
              title='Descargar'
            >
              <Download className='h-3.5 w-3.5' />
            </Button>
            <Button
              size='icon'
              variant='ghost'
              className='h-7 w-7'
              onClick={onClose}
              title='Cerrar (Esc)'
            >
              <X className='h-4 w-4' />
            </Button>
          </div>
        </div>

        {/* Contenido */}
        <div
          className='relative flex items-center justify-center overflow-auto bg-black/5 dark:bg-black/30'
          style={{ minHeight: '200px', maxHeight: 'calc(92vh - 52px)' }}
        >
          {isImage && (
            <div
              className='overflow-auto flex items-center justify-center p-4'
              style={{ maxHeight: 'calc(92vh - 52px)', maxWidth: '92vw' }}
            >
              <img
                src={previewUrl}
                alt={attachment.originalName}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center',
                  transition: 'transform 0.15s ease',
                }}
                className='max-h-[80vh] max-w-[80vw] object-contain rounded select-none'
                draggable={false}
              />
            </div>
          )}

          {isPdf &&
            (isMobileBrowser ? (
              <div
                className='flex flex-col items-center justify-center gap-4 p-8 text-center w-full'
                style={{ height: 'calc(92vh - 52px)' }}
              >
                <Smartphone className='h-10 w-10 text-muted-foreground' />
                <div>
                  <p className='font-medium text-sm'>Vista previa no disponible en móvil</p>
                  <p className='text-xs text-muted-foreground mt-1'>
                    Los navegadores móviles no admiten la previsualización de PDFs en línea.
                  </p>
                </div>
                <div className='flex gap-2 flex-wrap justify-center'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className='h-3.5 w-3.5 mr-1.5' />
                    Abrir en pestaña
                  </Button>
                  <Button size='sm' variant='outline' onClick={() => onDownload(attachment)}>
                    <Download className='h-3.5 w-3.5 mr-1.5' />
                    Descargar
                  </Button>
                </div>
              </div>
            ) : (
              <iframe
                src={previewUrl}
                title={attachment.originalName}
                className='w-full border-0'
                style={{ height: 'calc(92vh - 52px)', minWidth: '600px' }}
              />
            ))}

          {!isImage && !isPdf && (
            <div className='flex flex-col items-center justify-center gap-3 p-12 text-muted-foreground'>
              <File className='h-12 w-12 opacity-30' />
              <p className='text-sm'>Vista previa no disponible para este tipo de archivo</p>
              <Button size='sm' variant='outline' onClick={() => onDownload(attachment)}>
                <Download className='h-4 w-4 mr-2' />
                Descargar archivo
              </Button>
            </div>
          )}

          {/* Navegación entre imágenes */}
          {isImage && allImages.length > 1 && (
            <>
              {hasPrev && (
                <button
                  type='button'
                  onClick={() => onNavigate(allImages[currentIndex - 1])}
                  className='absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors'
                  title='Anterior (←)'
                >
                  <ChevronLeft className='h-5 w-5' />
                </button>
              )}
              {hasNext && (
                <button
                  type='button'
                  onClick={() => onNavigate(allImages[currentIndex + 1])}
                  className='absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors'
                  title='Siguiente (→)'
                >
                  <ChevronRight className='h-5 w-5' />
                </button>
              )}
              {/* Indicador de posición */}
              <div className='absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5'>
                {allImages.map((a, i) => (
                  <button
                    key={a.id}
                    type='button'
                    onClick={() => onNavigate(a)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/75'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

export function EquipmentAttachments({ equipmentId, canManage }: EquipmentAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null)
  const [previewTarget, setPreviewTarget] = useState<Attachment | null>(null)

  const baseUrl = `/api/inventory/equipment/${equipmentId}/attachments`

  const images = attachments.filter(a => a.mimeType.startsWith('image/'))
  const previewable = attachments.filter(
    a => a.mimeType.startsWith('image/') || a.mimeType === 'application/pdf'
  )

  useEffect(() => {
    loadAttachments()
  }, [equipmentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadAttachments = async () => {
    try {
      setLoading(true)
      const res = await fetch(baseUrl)
      if (res.ok) setAttachments(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'El límite es 20 MB',
        variant: 'destructive',
      })
      return
    }

    try {
      setUploading(true)
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(baseUrl, { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al subir')
      }
      const newAttachment = await res.json()
      setAttachments(prev => [newAttachment, ...prev])
      toast({ title: 'Archivo subido', description: file.name })
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo subir el archivo',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`${baseUrl}/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAttachments(prev => prev.filter(a => a.id !== deleteTarget.id))
      // Si se estaba previsualizando el archivo eliminado, cerrar el modal
      if (previewTarget?.id === deleteTarget.id) setPreviewTarget(null)
      toast({ title: 'Archivo eliminado' })
    } catch (err) {
      toast({
        title: 'Error',
        description: extractCatchError(err, 'No se pudo eliminar el archivo'),
        variant: 'destructive',
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  const downloadFile = (attachment: Attachment) => {
    const url = `${baseUrl}/${attachment.id}`
    const a = document.createElement('a')
    a.href = url
    a.download = attachment.originalName
    a.click()
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-3'>
          <div>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Paperclip className='h-4 w-4' />
              Archivos Adjuntos
            </CardTitle>
            <CardDescription>
              Imágenes, documentos y archivos relacionados al equipo
            </CardDescription>
          </div>
          {canManage && (
            <FileInputWithCamera accept={ACCEPTED} onChange={handleUpload}>
              {({ openFile, openCamera, showCamera }) => (
                <div className='flex items-center gap-1.5'>
                  {showCamera && (
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => openCamera()}
                      disabled={uploading}
                      title='Tomar foto'
                    >
                      {uploading ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <Camera className='h-4 w-4' />
                      )}
                    </Button>
                  )}
                  <Button size='sm' variant='outline' onClick={openFile} disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <Upload className='h-4 w-4 mr-2' />
                        {showCamera ? 'Archivo' : 'Subir archivo'}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </FileInputWithCamera>
          )}
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className='flex items-center justify-center py-6'>
              <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
            </div>
          ) : attachments.length === 0 ? (
            <div className='flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-muted-foreground'>
              <Paperclip className='h-4 w-4 shrink-0 opacity-40' />
              <p className='text-sm'>Sin archivos adjuntos</p>
            </div>
          ) : (
            <div className='space-y-3'>
              {/* ── Galería de imágenes ── */}
              {images.length > 0 && (
                <div>
                  <p className='text-xs text-muted-foreground mb-2 flex items-center gap-1.5'>
                    <Image className='h-3.5 w-3.5' />
                    Imágenes
                  </p>
                  <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2'>
                    {images.map(att => (
                      <div
                        key={att.id}
                        role='button'
                        tabIndex={0}
                        onClick={() => setPreviewTarget(att)}
                        onKeyDown={e => e.key === 'Enter' && setPreviewTarget(att)}
                        className='group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted hover:border-primary/50 transition-all cursor-pointer'
                        title={att.originalName}
                      >
                        <img
                          src={`${baseUrl}/${att.id}?preview=true`}
                          alt={att.originalName}
                          className='h-full w-full object-cover group-hover:scale-105 transition-transform duration-200'
                        />
                        <div className='absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center'>
                          <Eye className='h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow' />
                        </div>
                        {canManage && (
                          <button
                            type='button'
                            onClick={e => {
                              e.stopPropagation()
                              setDeleteTarget(att)
                            }}
                            className='absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive'
                            title='Eliminar'
                          >
                            <X className='h-3 w-3' />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Lista de documentos ── */}
              {attachments.some(a => !a.mimeType.startsWith('image/')) && (
                <div>
                  {images.length > 0 && (
                    <p className='text-xs text-muted-foreground mb-2 flex items-center gap-1.5'>
                      <FileText className='h-3.5 w-3.5' />
                      Documentos
                    </p>
                  )}
                  <div className='divide-y'>
                    {attachments
                      .filter(a => !a.mimeType.startsWith('image/'))
                      .map(att => (
                        <div key={att.id} className='flex items-center gap-3 py-2'>
                          <FileIcon mimeType={att.mimeType} />
                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-medium truncate'>{att.originalName}</p>
                            <p className='text-xs text-muted-foreground'>
                              {formatSize(att.size)} · {att.uploader.name} ·{' '}
                              {new Date(att.createdAt).toLocaleDateString('es-EC')}
                            </p>
                          </div>
                          <div className='flex items-center gap-1 shrink-0'>
                            {att.mimeType === 'application/pdf' && (
                              <Button
                                size='icon'
                                variant='ghost'
                                className='h-7 w-7'
                                onClick={() => setPreviewTarget(att)}
                                title='Previsualizar'
                              >
                                <Eye className='h-3.5 w-3.5' />
                              </Button>
                            )}
                            <Button
                              size='icon'
                              variant='ghost'
                              className='h-7 w-7'
                              onClick={() => downloadFile(att)}
                              title='Descargar'
                            >
                              <Download className='h-3.5 w-3.5' />
                            </Button>
                            {canManage && (
                              <Button
                                size='icon'
                                variant='ghost'
                                className='h-7 w-7 text-destructive hover:text-destructive'
                                onClick={() => setDeleteTarget(att)}
                                title='Eliminar'
                              >
                                <Trash2 className='h-3.5 w-3.5' />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Modal de preview ── */}
      {previewTarget && (
        <PreviewModal
          attachment={previewTarget}
          allImages={images}
          baseUrl={baseUrl}
          onClose={() => setPreviewTarget(null)}
          onNavigate={setPreviewTarget}
          onDownload={downloadFile}
        />
      )}

      {/* ── Confirmar eliminación ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente{' '}
              <span className='font-medium'>&quot;{deleteTarget?.originalName}&quot;</span>. Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
