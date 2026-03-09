/**
 * Gestor Compacto de Archivos con Vista Previa
 * Componente mejorado para subir y visualizar archivos adjuntos
 */

'use client'

import { useState, useCallback } from 'react'
import { Upload, X, Eye, Download, File, Image as ImageIcon, FileText, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { FilePreviewModal } from './file-preview-modal'

interface Attachment {
  id: string
  originalName: string
  mimeType: string
  size: number
  path: string
  createdAt: string
}

interface CompactFileManagerProps {
  ticketId: string
  attachments: Attachment[]
  onUploadComplete?: () => void
  disabled?: boolean
  maxFileSize?: number // en MB
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
  attachments,
  onUploadComplete,
  disabled = false,
  maxFileSize = 10
}: CompactFileManagerProps) {
  const { toast } = useToast()
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewFile, setPreviewFile] = useState<(Attachment & { url: string }) | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

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

      onUploadComplete?.()
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
    // Construir URL del archivo usando la ruta correcta
    const fileUrl = `/api/tickets/${ticketId}/attachments/${attachment.id}?preview=true`
    setPreviewFile({
      ...attachment,
      url: fileUrl
    })
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

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-blue-500" />
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />
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

  return (
    <div className="space-y-4">
      {/* Zona de subida compacta */}
      {!disabled && (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center transition-all",
            isDragOver 
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
              : "border-gray-300 hover:border-gray-400",
            uploading && "opacity-75"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className={cn(
            "h-6 w-6 mx-auto mb-2",
            isDragOver ? "text-blue-500" : "text-gray-400"
          )} />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Arrastra archivos o{' '}
            <label className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
              selecciona
              <input
                type="file"
                multiple
                accept={ALLOWED_TYPES.join(',')}
                onChange={handleFileInput}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Imágenes, PDF, Office • Máx {maxFileSize}MB
          </p>
          {uploading && (
            <p className="text-xs text-blue-600 mt-2">Subiendo archivo...</p>
          )}
        </div>
      )}

      {/* Lista de archivos adjuntos */}
      {attachments && attachments.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Archivos Adjuntos ({attachments.length})
          </h4>
          <div className="grid gap-2">
            {attachments.map(attachment => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getFileIcon(attachment.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {attachment.originalName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(attachment.size)} • {formatDate(attachment.createdAt)}
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
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hay archivos adjuntos</p>
          {!disabled && (
            <p className="text-xs mt-1">Arrastra archivos arriba para comenzar</p>
          )}
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
