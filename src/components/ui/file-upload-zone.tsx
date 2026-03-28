'use client'

/**
 * FileUploadZone — zona de carga compacta con preview de imágenes y descarga.
 * Reutilizable en todos los formularios de activos.
 */

import { useRef, useState, useEffect } from 'react'
import { Upload, X, Eye, Download, FileText, Image as ImageIcon } from 'lucide-react'

interface FileUploadZoneProps {
  files: File[]
  onChange: (files: File[] | ((prev: File[]) => File[])) => void
  maxFileSizeMB?: number
  label?: string
  /** Callback cuando un archivo supera el tamaño máximo */
  onSizeError?: (fileName: string, maxMB: number) => void
  /** Tipos de archivo aceptados (ej: "image/*,application/pdf") */
  accept?: string
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FilePreviewModal({ file, onClose }: { file: File; onClose: () => void }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-card shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
        >
          <X className="h-4 w-4" />
        </button>
        <img src={url} alt={file.name} className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain" />
        <p className="px-3 py-1.5 text-center text-xs text-muted-foreground">{file.name}</p>
      </div>
    </div>
  )
}

export function FileUploadZone({
  files,
  onChange,
  maxFileSizeMB = 10,
  label = 'Imágenes y Adjuntos',
  onSizeError,
  accept,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<File | null>(null)

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const maxBytes = maxFileSizeMB * 1024 * 1024
    onChange(prev => {
      const next = [...prev]
      Array.from(list).forEach(f => {
        if (f.size > maxBytes) {
          onSizeError?.(f.name, maxFileSizeMB)
          return
        }
        if (!next.find(x => x.name === f.name && x.size === f.size)) next.push(f)
      })
      return next
    })
  }

  const remove = (i: number) => onChange(prev => prev.filter((_, j) => j !== i))

  const download = (f: File) => {
    const url = URL.createObjectURL(f)
    const a = document.createElement('a')
    a.href = url
    a.download = f.name
    a.click()
    URL.revokeObjectURL(url)
  }

  const isImage = (f: File) => IMAGE_TYPES.includes(f.type)

  return (
    <>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{label}</span>

        {/* Zona de drop — compacta */}
        <div
          className={`flex items-center gap-3 rounded-md border-2 border-dashed px-3 py-2.5 cursor-pointer transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/40'
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        >
          <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Arrastra archivos o <span className="text-primary font-medium">haz clic</span>
            <span className="ml-1 text-xs">· Máx. {maxFileSizeMB} MB</span>
          </span>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={e => addFiles(e.target.files)}
        />

        {/* Lista de archivos */}
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm"
              >
                {/* Icono tipo */}
                {isImage(f)
                  ? <ImageIcon className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  : <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                }

                {/* Nombre + tamaño */}
                <span className="flex-1 truncate text-foreground">{f.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatSize(f.size)}</span>

                {/* Acciones */}
                <div className="flex shrink-0 items-center gap-1">
                  {isImage(f) && (
                    <button
                      type="button"
                      title="Vista previa"
                      onClick={() => setPreview(f)}
                      className="rounded p-0.5 hover:bg-muted"
                    >
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Descargar"
                    onClick={() => download(f)}
                    className="rounded p-0.5 hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => remove(i)}
                    className="rounded p-0.5 hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal de preview */}
      {preview && <FilePreviewModal file={preview} onClose={() => setPreview(null)} />}
    </>
  )
}
