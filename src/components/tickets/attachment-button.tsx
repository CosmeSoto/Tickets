/**
 * Botón para subir archivos adjuntos en tickets.
 * En móvil con cámara muestra dos opciones: tomar foto o adjuntar archivo.
 */

'use client'

import { useState } from 'react'
import { Paperclip, Camera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'

interface AttachmentButtonProps {
  ticketId: string
  onUploadComplete?: () => void
  disabled?: boolean
  size?: 'sm' | 'lg' | 'default'
}

const ACCEPT = 'image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx'

export function AttachmentButton({
  ticketId,
  onUploadComplete,
  disabled = false,
  size = 'sm',
}: AttachmentButtonProps) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)

  const uploadFile = async (file: File) => {
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast({
        title: 'Archivo muy grande',
        description: 'El archivo no puede superar los 10MB',
        variant: 'destructive',
      })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Error al subir archivo')

      toast({ title: 'Archivo subido', description: file.name })
      onUploadComplete?.()
    } catch {
      toast({ title: 'Error', description: 'No se pudo subir el archivo', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file)
  }

  return (
    <FileInputWithCamera
      accept={ACCEPT}
      onChange={handleChange}
    >
      {({ openFile, openCamera, showCamera }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size={size}
            onClick={openFile}
            disabled={disabled || uploading}
            className="h-8 w-8 p-0"
            title="Adjuntar archivo"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>

          {showCamera && (
            <Button
              variant="ghost"
              size={size}
              onClick={openCamera}
              disabled={disabled || uploading}
              className="h-8 w-8 p-0"
              title="Tomar foto"
            >
              <Camera className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </FileInputWithCamera>
  )
}
