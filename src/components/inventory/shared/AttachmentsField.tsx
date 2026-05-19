'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'
import { Upload, Camera, Eye, FileText, X, Image as ImageIcon } from 'lucide-react'

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface AttachmentsFieldProps {
  files: File[]
  onChange: (files: File[]) => void
  maxFileSizeMB?: number
}

export function AttachmentsField({ files, onChange, maxFileSizeMB = 10 }: AttachmentsFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')

  const ACCEPTED = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt'

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list) return
    const maxBytes = maxFileSizeMB * 1024 * 1024
    const toAdd: File[] = []
    Array.from(list).forEach(f => {
      if (f.size > maxBytes) return // silently skip oversized (could add toast)
      if (!files.find(x => x.name === f.name && x.size === f.size)) toAdd.push(f)
    })
    if (toAdd.length > 0) onChange([...files, ...toAdd])
  }

  const remove = (i: number) => onChange(files.filter((_, j) => j !== i))

  const openPreview = (f: File) => {
    const url = URL.createObjectURL(f)
    setPreviewUrl(url)
    setPreviewName(f.name)
  }

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewName('')
  }

  const images = files.filter(f => IMAGE_TYPES.includes(f.type))
  const docs = files.filter(f => !IMAGE_TYPES.includes(f.type))

  return (
    <>
      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <Label>Imágenes y Adjuntos</Label>
          <FileInputWithCamera accept={ACCEPTED} multiple onChange={addFiles}>
            {({ openFile, openCamera, showCamera }) => (
              <div className='flex items-center gap-1.5'>
                {showCamera && (
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => openCamera()}
                    title='Tomar foto'
                  >
                    <Camera className='h-4 w-4 mr-1.5' />
                    Foto
                  </Button>
                )}
                <Button type='button' size='sm' variant='outline' onClick={openFile}>
                  <Upload className='h-4 w-4 mr-1.5' />
                  {showCamera ? 'Archivo' : 'Subir archivo'}
                </Button>
              </div>
            )}
          </FileInputWithCamera>
        </div>

        {files.length === 0 ? (
          <FileInputWithCamera accept={ACCEPTED} multiple onChange={addFiles}>
            {({ openFile, openCamera, showCamera }) => (
              <div
                className='flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border px-3 py-3 text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors'
                onClick={openFile}
              >
                <Upload className='h-5 w-5 opacity-40' />
                <p className='text-sm'>
                  Arrastra archivos o <span className='text-primary font-medium'>haz clic</span>
                </p>
                {showCamera && (
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    className='text-xs'
                    onClick={e => {
                      e.stopPropagation()
                      openCamera()
                    }}
                  >
                    <Camera className='h-3.5 w-3.5 mr-1' />O toma una foto con la cámara
                  </Button>
                )}
                <p className='text-xs'>Máx. {maxFileSizeMB} MB por archivo</p>
              </div>
            )}
          </FileInputWithCamera>
        ) : (
          <div className='space-y-3'>
            {/* Galería de imágenes */}
            {images.length > 0 && (
              <div>
                <p className='text-xs text-muted-foreground mb-1.5 flex items-center gap-1'>
                  <ImageIcon className='h-3.5 w-3.5' />
                  Imágenes ({images.length})
                </p>
                <div className='grid grid-cols-3 sm:grid-cols-4 gap-2'>
                  {images.map((f, i) => {
                    const url = URL.createObjectURL(f)
                    return (
                      <div
                        key={i}
                        className='group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted'
                      >
                        <img
                          src={url}
                          alt={f.name}
                          className='h-full w-full object-cover'
                          onLoad={() => URL.revokeObjectURL(url)}
                        />
                        <div className='absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1'>
                          <button
                            type='button'
                            onClick={() => openPreview(f)}
                            className='opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-black/60 p-1 text-white hover:bg-black/80'
                            title='Vista previa'
                          >
                            <Eye className='h-3.5 w-3.5' />
                          </button>
                          <button
                            type='button'
                            onClick={() => remove(files.indexOf(f))}
                            className='opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-black/60 p-1 text-white hover:bg-destructive'
                            title='Eliminar'
                          >
                            <X className='h-3.5 w-3.5' />
                          </button>
                        </div>
                        <p className='absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity'>
                          {f.name}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Lista de documentos */}
            {docs.length > 0 && (
              <div>
                {images.length > 0 && (
                  <p className='text-xs text-muted-foreground mb-1.5 flex items-center gap-1'>
                    <FileText className='h-3.5 w-3.5' />
                    Documentos ({docs.length})
                  </p>
                )}
                <ul className='space-y-1'>
                  {docs.map((f, i) => (
                    <li
                      key={i}
                      className='flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm'
                    >
                      <FileText className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                      <span className='flex-1 truncate'>{f.name}</span>
                      <span className='text-xs text-muted-foreground shrink-0'>
                        {formatFileSize(f.size)}
                      </span>
                      <button
                        type='button'
                        onClick={() => remove(files.indexOf(f))}
                        className='rounded p-0.5 hover:bg-muted'
                        title='Eliminar'
                      >
                        <X className='h-3.5 w-3.5 text-muted-foreground' />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de preview */}
      {previewUrl && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'
          onClick={closePreview}
        >
          <div
            className='relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-card shadow-xl'
            onClick={e => e.stopPropagation()}
          >
            <button
              type='button'
              onClick={closePreview}
              className='absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70'
            >
              <X className='h-4 w-4' />
            </button>
            <img
              src={previewUrl}
              alt={previewName}
              className='max-h-[85vh] max-w-[85vw] rounded-lg object-contain'
            />
            <p className='px-3 py-1.5 text-center text-xs text-muted-foreground'>{previewName}</p>
          </div>
        </div>
      )}
    </>
  )
}
