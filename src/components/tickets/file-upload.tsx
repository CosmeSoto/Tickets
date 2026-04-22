/**
 * Componente para subida de archivos adjuntos en tickets
 */

'use client'

import { useState, useCallback } from 'react'
import { Upload, X, File, Image, FileText, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  ticketId: string
  onUploadComplete?: () => void
  disabled?: boolean
  maxFiles?: number
  maxFileSize?: number // en MB
}

interface UploadingFile {
  file: File
  progress: number
  status: 'uploading' | 'success' | 'error'
  error?: string
}

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const MAX_FILE_SIZE = 10 // MB

export function FileUpload({
  ticketId,
  onUploadComplete,
  disabled = false,
  maxFiles = 5,
  maxFileSize = MAX_FILE_SIZE,
}: FileUploadProps) {
  const { toast } = useToast()
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  const validateFile = (file: File): string | null => {
    // Validar tipo
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Tipo de archivo no permitido. Solo se permiten imágenes, PDF, documentos de Office y texto plano.'
    }

    // Validar tamaño
    if (file.size > maxFileSize * 1024 * 1024) {
      return `El archivo es muy grande. Máximo permitido: ${maxFileSize}MB`
    }

    // Validar nombre
    if (file.name.length > 255) {
      return 'El nombre del archivo es muy largo'
    }

    return null
  }

  const uploadFile = async (file: File): Promise<void> => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al subir archivo')
      }

      // Simular progreso para mejor UX
      const uploadingFile: UploadingFile = {
        file,
        progress: 0,
        status: 'uploading',
      }

      setUploadingFiles(prev => [...prev, uploadingFile])

      // Simular progreso
      const progressInterval = setInterval(() => {
        setUploadingFiles(prev =>
          prev.map(f =>
            f.file === file && f.progress < 90 ? { ...f, progress: f.progress + 10 } : f
          )
        )
      }, 100)

      await response.json()

      clearInterval(progressInterval)

      // Completar subida
      setUploadingFiles(prev =>
        prev.map(f => (f.file === file ? { ...f, progress: 100, status: 'success' } : f))
      )

      // Remover de la lista después de 2 segundos
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => f.file !== file))
      }, 2000)

      toast({
        title: 'Éxito',
        description: `Archivo "${file.name}" subido correctamente`,
      })

      onUploadComplete?.()
    } catch (error) {
      setUploadingFiles(prev =>
        prev.map(f =>
          f.file === file
            ? {
                ...f,
                status: 'error',
                error: error instanceof Error ? error.message : 'Error desconocido',
              }
            : f
        )
      )

      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al subir archivo',
        variant: 'destructive',
      })
    }
  }

  const handleFiles = useCallback(
    async (files: FileList) => {
      if (disabled) return

      const fileArray = Array.from(files)

      // Validar número de archivos
      if (uploadingFiles.length + fileArray.length > maxFiles) {
        toast({
          title: 'Demasiados archivos',
          description: `Solo puedes subir máximo ${maxFiles} archivos a la vez`,
          variant: 'destructive',
        })
        return
      }

      // Validar cada archivo
      for (const file of fileArray) {
        const error = validateFile(file)
        if (error) {
          toast({
            title: 'Archivo inválido',
            description: `${file.name}: ${error}`,
            variant: 'destructive',
          })
          continue
        }

        // Subir archivo
        uploadFile(file)
      }
    },
    [disabled, uploadingFiles.length, maxFiles, ticketId, toast, onUploadComplete]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files)
        // Limpiar input para permitir subir el mismo archivo de nuevo
        e.target.value = ''
      }
    },
    [handleFiles]
  )

  const removeUploadingFile = (file: File) => {
    setUploadingFiles(prev => prev.filter(f => f.file !== file))
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className='h-4 w-4' />
    if (type === 'application/pdf') return <FileText className='h-4 w-4' />
    return <File className='h-4 w-4' />
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center space-x-2'>
          <Upload className='h-5 w-5' />
          <span>Subir Archivos</span>
        </CardTitle>
        <CardDescription>
          Arrastra archivos aquí o haz clic para seleccionar. Máximo {maxFileSize}MB por archivo.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Zona de drop */}
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload
            className={cn(
              'h-8 w-8 mx-auto mb-2',
              isDragOver ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <p className='text-sm text-muted-foreground mb-2'>
            Arrastra archivos aquí o{' '}
            <label className='text-primary hover:text-primary/80 cursor-pointer underline'>
              selecciona archivos
              <input
                type='file'
                multiple
                accept={ALLOWED_TYPES.join(',')}
                onChange={handleFileInput}
                disabled={disabled}
                className='hidden'
              />
            </label>
          </p>
          <p className='text-xs text-muted-foreground'>
            Tipos permitidos: Imágenes, PDF, Documentos de Office, Texto plano
          </p>
        </div>

        {/* Lista de archivos subiendo */}
        {uploadingFiles.length > 0 && (
          <div className='space-y-2'>
            <h4 className='text-sm font-medium'>Subiendo archivos:</h4>
            {uploadingFiles.map((uploadingFile, index) => (
              <div key={index} className='flex items-center space-x-3 p-3 bg-muted/50 rounded-lg'>
                <div className='flex items-center space-x-2 flex-1'>
                  {getFileIcon(uploadingFile.file.type)}
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium truncate'>{uploadingFile.file.name}</p>
                    <p className='text-xs text-muted-foreground'>
                      {formatFileSize(uploadingFile.file.size)}
                    </p>
                  </div>
                </div>

                <div className='flex items-center space-x-2'>
                  {uploadingFile.status === 'uploading' && (
                    <div className='w-20'>
                      <Progress value={uploadingFile.progress} className='h-2' />
                    </div>
                  )}

                  {uploadingFile.status === 'success' && (
                    <div className='text-primary text-sm'>✓</div>
                  )}

                  {uploadingFile.status === 'error' && (
                    <div className='flex items-center space-x-1 text-destructive'>
                      <AlertCircle className='h-4 w-4' />
                      <span className='text-xs'>{uploadingFile.error}</span>
                    </div>
                  )}

                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => removeUploadingFile(uploadingFile.file)}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
