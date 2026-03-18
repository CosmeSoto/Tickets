/**
 * Modal de Vista Previa de Archivos
 * Permite previsualizar imágenes, PDFs y otros archivos antes de descargar
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
import { Download, FileText, File, Image as ImageIcon } from 'lucide-react'

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  file: {
    id: string
    originalName: string
    mimeType: string
    size: number
    url: string
  } | null
}

export function FilePreviewModal({ isOpen, onClose, file }: FilePreviewModalProps) {
  const [imageError, setImageError] = useState(false)

  // Resetear error al cambiar de archivo
  useEffect(() => {
    setImageError(false)
  }, [file?.id])

  if (!file) return null

  const isImage = (file.mimeType || '').startsWith('image/')
  const isPDF = file.mimeType === 'application/pdf'
  const isText = (file.mimeType || '').startsWith('text/')
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = file.url.replace('?preview=true', '')
    link.download = file.originalName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {isImage && <ImageIcon className="h-5 w-5" />}
            {isPDF && <FileText className="h-5 w-5" />}
            {!isImage && !isPDF && <File className="h-5 w-5" />}
            <span className="truncate max-w-md">{file.originalName}</span>
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>{formatFileSize(file.size)} • {file.mimeType}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30 rounded-lg p-4">
          {/* Vista previa de imágenes */}
          {isImage && !imageError && (
            <div className="flex items-center justify-center min-h-[400px]">
              <img
                src={file.url}
                alt={file.originalName}
                className="max-w-full max-h-[600px] object-contain"
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {/* Vista previa de PDFs */}
          {isPDF && (
            <div className="w-full h-[600px]">
              <iframe
                src={file.url}
                className="w-full h-full border-0 rounded"
                title={file.originalName}
              />
            </div>
          )}

          {/* Vista previa de archivos de texto */}
          {isText && (
            <div className="bg-background p-4 rounded border">
              <iframe
                src={file.url}
                className="w-full h-[500px] border-0"
                title={file.originalName}
              />
            </div>
          )}

          {/* Mensaje para archivos no previsualizables */}
          {!isImage && !isPDF && !isText && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
              <File className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Vista previa no disponible</p>
              <p className="text-sm text-muted-foreground mt-2">
                Este tipo de archivo no se puede previsualizar
              </p>
              <Button
                className="mt-4"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar archivo
              </Button>
            </div>
          )}

          {/* Error al cargar imagen */}
          {isImage && imageError && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
              <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Error al cargar la imagen</p>
              <p className="text-sm text-muted-foreground mt-2">
                No se pudo cargar la vista previa de la imagen
              </p>
              <Button
                className="mt-4"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar archivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
