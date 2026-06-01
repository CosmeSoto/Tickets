'use client'

/**
 * FileDropZone — componente global de carga de archivos con drag & drop.
 *
 * Características:
 *  - Drag & drop en desktop
 *  - Botón de cámara/galería en móvil (via FileInputWithCamera)
 *  - Múltiples archivos simultáneos
 *  - Preview de imágenes antes de subir
 *  - Lista de archivos pendientes + ya guardados (modo edición)
 *  - Validación de tipo y tamaño en cliente
 *
 * Modos de uso:
 *
 * 1. Modo "pendientes" (crear) — el padre controla la lista de archivos locales:
 *    <FileDropZone
 *      pendingFiles={files}
 *      onPendingFilesChange={setFiles}
 *    />
 *
 * 2. Modo "guardados" (editar) — muestra adjuntos ya en BD + pendientes nuevos:
 *    <FileDropZone
 *      pendingFiles={files}
 *      onPendingFilesChange={setFiles}
 *      uploadedAttachments={existingAttachments}
 *      onDeleteUploaded={handleDelete}
 *      uploadedFileUrl={(att) => `/api/admin/news/${newsId}/attachments/${att.id}/file`}
 *    />
 */

import { useCallback, useState, useRef } from 'react'
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Film,
  File,
  Camera,
  Trash2,
  Paperclip,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'
import { cn } from '@/lib/utils'

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export interface PendingFile {
  file: File
  preview: string | null
  id: string
}

export interface UploadedAttachment {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  path?: string
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface FileDropZoneProps {
  /** Archivos pendientes de subir (controlado por el padre) */
  pendingFiles: PendingFile[]
  onPendingFilesChange: (files: PendingFile[]) => void
  /** Adjuntos ya guardados en BD (modo edición) */
  uploadedAttachments?: UploadedAttachment[]
  onDeleteUploaded?: (id: string) => void
  /**
   * Función que devuelve la URL de preview/descarga para un adjunto guardado.
   * Si no se pasa, no se muestra imagen de preview para los guardados.
   */
  uploadedFileUrl?: (att: UploadedAttachment) => string
  /** Tipos MIME permitidos */
  allowedTypes?: string[]
  /** Máximo de archivos (pendientes + guardados) */
  maxFiles?: number
  /** Tamaño máximo por archivo en MB */
  maxSizeMB?: number
  /** Texto del accept para el input (ej: "image/*,.pdf") */
  accept?: string
  /** Texto descriptivo de los tipos aceptados */
  acceptLabel?: string
  /** Clases adicionales */
  className?: string
}

// ── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const DEFAULT_ACCEPT = 'image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx'
const DEFAULT_ACCEPT_LABEL = 'Imágenes, PDF, Word, Excel'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className='h-4 w-4 text-blue-500' />
  if (mimeType === 'application/pdf') return <FileText className='h-4 w-4 text-red-500' />
  if (mimeType.startsWith('video/')) return <Film className='h-4 w-4 text-purple-500' />
  return <File className='h-4 w-4 text-gray-500' />
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function FileDropZone({
  pendingFiles,
  onPendingFilesChange,
  uploadedAttachments = [],
  onDeleteUploaded,
  uploadedFileUrl,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  maxFiles = 10,
  maxSizeMB = 10,
  accept = DEFAULT_ACCEPT,
  acceptLabel = DEFAULT_ACCEPT_LABEL,
  className,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const dropRef = useRef<HTMLDivElement>(null)

  const totalFiles = pendingFiles.length + uploadedAttachments.length

  const processFiles = useCallback(
    (rawFiles: FileList | File[]) => {
      const newErrors: string[] = []
      const toAdd: PendingFile[] = []

      Array.from(rawFiles).forEach(file => {
        if (totalFiles + toAdd.length >= maxFiles) {
          newErrors.push(`Máximo ${maxFiles} archivos permitidos`)
          return
        }
        if (!allowedTypes.includes(file.type)) {
          newErrors.push(`"${file.name}": tipo no permitido`)
          return
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
          newErrors.push(`"${file.name}": supera ${maxSizeMB}MB`)
          return
        }
        const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
        toAdd.push({ file, preview, id: `${Date.now()}-${Math.random()}` })
      })

      setErrors(newErrors)
      if (toAdd.length > 0) onPendingFilesChange([...pendingFiles, ...toAdd])
    },
    [pendingFiles, onPendingFilesChange, totalFiles, maxFiles, maxSizeMB, allowedTypes]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFiles(e.target.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!dropRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files)
  }

  const removePending = (id: string) => {
    const file = pendingFiles.find(f => f.id === id)
    if (file?.preview) URL.revokeObjectURL(file.preview)
    onPendingFilesChange(pendingFiles.filter(f => f.id !== id))
  }

  const hasFiles = totalFiles > 0

  return (
    <div className={cn('space-y-3', className)}>
      {/* Zona de drop */}
      <FileInputWithCamera
        accept={accept}
        multiple
        onChange={handleInputChange}
        onCameraChange={handleInputChange}
      >
        {({ openFile, openCamera, showCamera }) => (
          <div
            ref={dropRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'relative border-2 border-dashed rounded-lg transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50',
              totalFiles >= maxFiles && 'opacity-50 pointer-events-none'
            )}
          >
            <div className='flex flex-col items-center justify-center gap-2 py-6 px-4 text-center'>
              <div className='flex items-center justify-center w-10 h-10 rounded-full bg-muted'>
                <Upload className='h-5 w-5 text-muted-foreground' />
              </div>
              <div>
                <p className='text-sm font-medium'>
                  {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos aquí'}
                </p>
                <p className='text-xs text-muted-foreground mt-0.5'>
                  {acceptLabel} · Máx {maxSizeMB}MB por archivo
                </p>
              </div>
              <div className='flex gap-2 mt-1'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={openFile}
                  className='gap-1.5 h-8'
                >
                  <Paperclip className='h-3.5 w-3.5' />
                  {showCamera ? 'Galería / Archivos' : 'Seleccionar archivos'}
                </Button>
                {showCamera && (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => openCamera('environment')}
                    className='gap-1.5 h-8'
                  >
                    <Camera className='h-3.5 w-3.5' />
                    Cámara
                  </Button>
                )}
              </div>
              {totalFiles > 0 && (
                <p className='text-xs text-muted-foreground'>
                  {totalFiles} / {maxFiles} archivos
                </p>
              )}
            </div>
          </div>
        )}
      </FileInputWithCamera>

      {/* Errores de validación */}
      {errors.length > 0 && (
        <div className='space-y-1'>
          {errors.map((err, i) => (
            <p key={i} className='text-xs text-destructive flex items-center gap-1'>
              <X className='h-3 w-3 flex-shrink-0' />
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Lista de archivos */}
      {hasFiles && (
        <div className='space-y-2'>
          {/* Adjuntos ya guardados en BD */}
          {uploadedAttachments.map(att => (
            <div
              key={att.id}
              className='flex items-center gap-3 p-2.5 rounded-lg border bg-muted/30'
            >
              <div className='w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center'>
                {att.mimeType.startsWith('image/') && uploadedFileUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={uploadedFileUrl(att)}
                    alt={att.originalName}
                    className='w-full h-full object-cover'
                    onError={e => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  getFileIcon(att.mimeType)
                )}
              </div>
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium truncate'>{att.originalName}</p>
                <p className='text-xs text-muted-foreground'>{formatSize(att.size)}</p>
              </div>
              <Badge variant='secondary' className='text-[10px] flex-shrink-0'>
                Guardado
              </Badge>
              {onDeleteUploaded && (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => onDeleteUploaded(att.id)}
                  className='h-7 w-7 p-0 text-muted-foreground hover:text-destructive flex-shrink-0'
                >
                  <Trash2 className='h-3.5 w-3.5' />
                </Button>
              )}
            </div>
          ))}

          {/* Archivos pendientes de subir */}
          {pendingFiles.map(pf => (
            <div
              key={pf.id}
              className='flex items-center gap-3 p-2.5 rounded-lg border border-dashed bg-muted/10'
            >
              <div className='w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center'>
                {pf.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pf.preview} alt={pf.file.name} className='w-full h-full object-cover' />
                ) : (
                  getFileIcon(pf.file.type)
                )}
              </div>
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium truncate'>{pf.file.name}</p>
                <p className='text-xs text-muted-foreground'>{formatSize(pf.file.size)}</p>
              </div>
              <Badge variant='outline' className='text-[10px] flex-shrink-0 text-muted-foreground'>
                Pendiente
              </Badge>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => removePending(pf.id)}
                className='h-7 w-7 p-0 text-muted-foreground hover:text-destructive flex-shrink-0'
              >
                <X className='h-3.5 w-3.5' />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
