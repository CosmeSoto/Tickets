'use client'

import { useState, useEffect } from 'react'
import { X, File, FileText, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

interface FilePreviewListProps {
  files: File[]
  onRemove: (index: number) => void
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-blue-500" />
  if (type === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />
  if (type.includes('word') || type.includes('document')) return <FileText className="h-4 w-4 text-blue-700" />
  if (type.includes('sheet') || type.includes('excel')) return <FileText className="h-4 w-4 text-green-600" />
  return <File className="h-4 w-4 text-muted-foreground" />
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileThumbnail({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file.type.startsWith('image/')) return
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (url) {
    return (
      <img
        src={url}
        alt={file.name}
        className="h-10 w-10 rounded object-cover border"
      />
    )
  }

  return (
    <div className="h-10 w-10 rounded border flex items-center justify-center bg-muted">
      {getFileIcon(file.type)}
    </div>
  )
}

export function FilePreviewList({ files, onRemove }: FilePreviewListProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')

  const openPreview = (file: File) => {
    if (!file.type.startsWith('image/')) return
    setPreviewUrl(URL.createObjectURL(file))
    setPreviewName(file.name)
  }

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewName('')
  }

  if (files.length === 0) return null

  return (
    <>
      <div className="space-y-2 mt-4">
        <p className="text-sm font-medium">Archivos seleccionados ({files.length}/5):</p>
        <div className="grid grid-cols-1 gap-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 bg-muted rounded-lg group"
            >
              <div
                className={file.type.startsWith('image/') ? 'cursor-pointer' : ''}
                onClick={() => openPreview(file)}
              >
                <FileThumbnail file={file} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="opacity-60 group-hover:opacity-100"
                onClick={() => onRemove(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview modal para imágenes */}
      <Dialog open={!!previewUrl} onOpenChange={() => closePreview()}>
        <DialogContent className="max-w-2xl">
          <VisuallyHidden><DialogTitle>{previewName}</DialogTitle></VisuallyHidden>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">{previewName}</p>
            {previewUrl && (
              <img
                src={previewUrl}
                alt={previewName}
                className="max-h-[70vh] mx-auto rounded-lg object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
