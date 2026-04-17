/**
 * Gestor Compacto de Archivos con Vista Previa
 * Carga sus propios attachments desde la API para siempre tener datos frescos
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { Upload, X, Eye, Download, File, Image as ImageIcon, FileText, Paperclip, RefreshCw, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { FilePreviewModal } from './file-preview-modal'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'

interface Attachment {
  id: string
  originalName: string
  mimeType: string
  size: number
  path: string
  createdAt: string
  uploader?: { id: string; name: string; role: string }
}

interface CompactFileManagerProps {
  ticketId: string
  // attachments prop es opcional — si no se pasa, carga desde la API
  attachments?: Attachment[]
  onUploadComplete?: () => void
  onAttachmentsChange?: () => void
  disabled?: boolean
  maxFileSize?: number // en MB
  canDelete?: boolean
  canUpload?: boolean
  refreshKey?: number
}

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]

export function CompactFileManager({
  ticketId,
  attachments: attachmentsProp,
  onUploadComplete,
  onAttachmentsChange,
  disabled = false,
  maxFileSize = 10,
  canDelete = false,
  canUpload = true,
  refreshKey = 0,
}: CompactFileManagerProps) {
  const { toast } = useToast()
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewFile, setPreviewFile] = useState<(Attachment & { url: string }) | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>(attachmentsProp || [])
  const [loadingFiles, setLoadingFiles] = useState(false)

  // Cargar attachments desde la API
  const loadAttachments = useCallback(async () => {
    try {
      setLoadingFiles(true)
      const res = await fetch(`/api/tickets/${ticketId}/attachments`)
      if (res.ok) {
        const data = await res.json()
        // La API devuelve array directamente
        setAttachments(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('[CompactFileManager] Error cargando archivos:', err)
    } finally {
      setLoadingFiles(false)
    }
  }, [ticketId])

  // Cargar al montar, cuando cambie ticketId, o cuando refreshKey cambie
  useEffect(() => {
    loadAttachments()
  }, [loadAttachments, refreshKey])

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Tipo no permitido'
    }
    if (file.size > maxFileSize * 1024 * 1024) {
      return `Máximo ${maxFileSize}MB`
    }
    return null
  }

  const uploadFile = async (file: File): Promise<void> => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al subir')
      }

      toast({
        title: 'Archivo subido',
        description: file.name
      })

      // Recargar lista de archivos
      await loadAttachments()
      onUploadComplete?.()
      onAttachmentsChange?.()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al subir',
        variant: 'destructive'
      })
    }
  }

  const handleFiles = useCallback(async (files: FileList) => {
    if (disabled || uploading) return

    setUploading(true)
    const fileArray = Array.from(files)

    for (const file of fileArray) {
      const error = validateFile(file)
      if (error) {
        toast({
          title: 'Archivo inválido',
          description: `${file.name}: ${error}`,
          variant: 'destructive'
        })
        continue
      }

      await uploadFile(file)
    }

    setUploading(false)
  }, [disabled, uploading, ticketId, toast, onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
      e.target.value = ''
    }
  }, [handleFiles])

  const handlePreview = (attachment: Attachment) => {
    const fileUrl = `/api/tickets/${ticketId}/attachments/${attachment.id}?preview=true`
    setPreviewFile({ ...attachment, url: fileUrl })
    setIsPreviewOpen(true)
  }

  const handleDownload = (attachment: Attachment) => {
    const link = document.createElement('a')
    link.href = `/api/tickets/${ticketId}/attachments/${attachment.id}`
    link.download = attachment.originalName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDelete = async (attachment: Attachment) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/attachments/${attachment.id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        toast({ title: 'Archivo eliminado', description: attachment.originalName })
        await loadAttachments()
        onAttachmentsChange?.()
      }
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' })
    }
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-blue-500" />
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileText className="h-4 w-4 text-green-500" />
    if (mimeType.includes('word')) return <FileText className="h-4 w-4 text-blue-700" />
    return <File className="h-4 w-4 text-gray-500" />
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-EC', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const showUpload = !disabled && canUpload

  return (
    <div className="space-y-4">
      {/* Zona de subida */}
      {showUpload && (
        <FileInputWithCamera
          accept={ALLOWED_TYPES.join(',')}
          multiple
          onChange={handleFileInput}
        >
          {({ openFile, openCamera, showCamera }) => (
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-4 text-center transition-all',
                isDragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-300 hover:border-gray-400',
                uploading && 'opacity-75'
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className={cn('h-6 w-6 mx-auto mb-2', isDragOver ? 'text-blue-500' : 'text-gray-400')} />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Arrastra archivos o{' '}
                <button
                  type="button"
                  onClick={openFile}
                  className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium underline"
                >
                  selecciona
                </button>
              </p>
              {showCamera && (
                <button
                  type="button"
                  onClick={openCamera}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Tomar foto con la cámara
                </button>
              )}
              <p className="text-xs text-gray-500 mt-1">Imágenes, PDF, Office • Máx {maxFileSize}MB</p>
              {uploading && <p className="text-xs text-blue-600 mt-2">Subiendo archivo...</p>}
            </div>
          )}
        </FileInputWithCamera>
      )}

      {/* Lista de archivos */}
      {loadingFiles ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Cargando archivos...</span>
        </div>
      ) : attachments.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Archivos Adjuntos ({attachments.length})
            </h4>
            <Button variant="ghost" size="sm" onClick={loadAttachments} className="h-7 px-2 text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />
              Actualizar
            </Button>
          </div>
          <div className="grid gap-2">
            {attachments.map(attachment => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getFileIcon(attachment.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.originalName}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(attachment.size)} • {formatDate(attachment.createdAt)}
                      {attachment.uploader && (
                        <span className="ml-1">• {attachment.uploader.name}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreview(attachment)}
                    className="h-8 w-8 p-0"
                    title="Vista previa"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(attachment)}
                    className="h-8 w-8 p-0"
                    title="Descargar"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(attachment)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      title="Eliminar"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hay archivos adjuntos</p>
          {showUpload && <p className="text-xs mt-1">Arrastra archivos arriba para comenzar</p>}
        </div>
      )}

      {/* Modal de vista previa */}
      <FilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        file={previewFile}
      />
    </div>
  )
}
