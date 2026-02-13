/**
 * Botón para subir archivos adjuntos en tickets
 */

'use client'

import { useState, useRef } from 'react'
import { Paperclip, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface AttachmentButtonProps {
  ticketId: string
  onUploadComplete?: () => void
  disabled?: boolean
  size?: 'sm' | 'lg' | 'default'
}

export function AttachmentButton({ 
  ticketId, 
  onUploadComplete, 
  disabled = false,
  size = 'sm'
}: AttachmentButtonProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validaciones básicas
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      toast({
        title: 'Archivo muy grande',
        description: 'El archivo no puede superar los 10MB',
        variant: 'destructive'
      })
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Error al subir archivo')
      }

      toast({
        title: 'Éxito',
        description: `Archivo "${file.name}" subido correctamente`
      })

      onUploadComplete?.()

    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo subir el archivo',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
      // Limpiar input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        onClick={handleFileSelect}
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
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
      />
    </>
  )
}