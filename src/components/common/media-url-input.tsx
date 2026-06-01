'use client'

/**
 * MediaUrlInput — componente global para insertar URLs de medios externos
 *
 * Soporta:
 *  - Google Drive (imágenes, PDFs, documentos)
 *  - OneDrive / SharePoint
 *  - Dropbox
 *  - YouTube (embed)
 *  - URLs directas de imagen (jpg, png, gif, webp, svg)
 *  - URLs directas de PDF
 *  - Cualquier URL pública
 *
 * Muestra una vista previa inline cuando la URL es reconocible.
 */

import { useState, useEffect } from 'react'
import { Link, X, Eye, EyeOff, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ── Tipos de media detectados ──────────────────────────────────────────────────

export type MediaType =
  | 'image'
  | 'pdf'
  | 'google-drive'
  | 'onedrive'
  | 'dropbox'
  | 'youtube'
  | 'office'
  | 'unknown'

export interface MediaInfo {
  type: MediaType
  label: string
  embedUrl: string | null // URL para mostrar en iframe/img
  originalUrl: string // URL original sin modificar
  canPreview: boolean
  canEmbed: boolean
}

// ── Helpers de detección ───────────────────────────────────────────────────────

export function detectMedia(url: string): MediaInfo {
  if (!url.trim()) {
    return {
      type: 'unknown',
      label: '',
      embedUrl: null,
      originalUrl: url,
      canPreview: false,
      canEmbed: false,
    }
  }

  const u = url.trim()
  const lower = u.toLowerCase()

  // YouTube
  const ytMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  if (ytMatch) {
    return {
      type: 'youtube',
      label: 'YouTube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      originalUrl: u,
      canPreview: true,
      canEmbed: true,
    }
  }

  // Google Drive
  const gdMatch = u.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (gdMatch) {
    return {
      type: 'google-drive',
      label: 'Google Drive',
      embedUrl: `https://drive.google.com/file/d/${gdMatch[1]}/preview`,
      originalUrl: u,
      canPreview: true,
      canEmbed: true,
    }
  }
  const gdOpenMatch = u.match(/drive\.google\.com\/open\?id=([^&]+)/)
  if (gdOpenMatch) {
    return {
      type: 'google-drive',
      label: 'Google Drive',
      embedUrl: `https://drive.google.com/file/d/${gdOpenMatch[1]}/preview`,
      originalUrl: u,
      canPreview: true,
      canEmbed: true,
    }
  }

  // OneDrive personal
  if (lower.includes('onedrive.live.com') || lower.includes('1drv.ms')) {
    const embedUrl = u.replace('/view', '/embed').replace('/download', '/embed')
    return {
      type: 'onedrive',
      label: 'OneDrive',
      embedUrl: embedUrl !== u ? embedUrl : null,
      originalUrl: u,
      canPreview: embedUrl !== u,
      canEmbed: embedUrl !== u,
    }
  }

  // SharePoint / OneDrive for Business
  if (lower.includes('sharepoint.com')) {
    return {
      type: 'onedrive',
      label: 'SharePoint',
      embedUrl: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(u)}`,
      originalUrl: u,
      canPreview: true,
      canEmbed: true,
    }
  }

  // Dropbox
  if (lower.includes('dropbox.com')) {
    const embedUrl = u.replace('?dl=0', '?raw=1').replace('?dl=1', '?raw=1')
    const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u)
    return {
      type: 'dropbox',
      label: 'Dropbox',
      embedUrl,
      originalUrl: u,
      canPreview: true,
      canEmbed: isImage,
    }
  }

  // Documentos Office en URL directa → Office Online Viewer
  if (/\.(docx?|xlsx?|pptx?)(\?|$)/i.test(u) && u.startsWith('http')) {
    return {
      type: 'office',
      label: 'Documento Office',
      embedUrl: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(u)}`,
      originalUrl: u,
      canPreview: true,
      canEmbed: true,
    }
  }

  // PDF directo
  if (/\.pdf(\?|$)/i.test(u)) {
    return {
      type: 'pdf',
      label: 'PDF',
      embedUrl: u,
      originalUrl: u,
      canPreview: true,
      canEmbed: true,
    }
  }

  // Imagen directa
  if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u)) {
    return {
      type: 'image',
      label: 'Imagen',
      embedUrl: u,
      originalUrl: u,
      canPreview: true,
      canEmbed: true,
    }
  }

  // URL genérica
  return {
    type: 'unknown',
    label: 'Enlace externo',
    embedUrl: null,
    originalUrl: u,
    canPreview: false,
    canEmbed: false,
  }
}

const TYPE_ICONS: Record<MediaType, string> = {
  image: '🖼️',
  pdf: '📕',
  'google-drive': '📁',
  onedrive: '☁️',
  dropbox: '📦',
  youtube: '▶️',
  office: '📄',
  unknown: '🔗',
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface MediaUrlInputProps {
  value: string
  onChange: (url: string) => void
  label?: string
  placeholder?: string
  showPreview?: boolean
  className?: string
  /** Si se pasa, muestra el campo como opcional */
  optional?: boolean
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function MediaUrlInput({
  value,
  onChange,
  label = 'URL de imagen o documento',
  placeholder = 'https://drive.google.com/... o https://onedrive.live.com/... o URL directa',
  showPreview = true,
  className,
  optional = true,
}: MediaUrlInputProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)

  // Sincronizar si el valor externo cambia (ej: al abrir edición)
  useEffect(() => {
    setInputValue(value)
    if (!value) setPreviewOpen(false)
  }, [value])

  const media = detectMedia(inputValue)
  const hasUrl = !!inputValue.trim()

  const handleChange = (v: string) => {
    setInputValue(v)
    onChange(v)
    if (!v) setPreviewOpen(false)
  }

  const handleClear = () => {
    handleChange('')
    setPreviewOpen(false)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label>
          {label}
          {optional && <span className='text-muted-foreground ml-1 font-normal'>(opcional)</span>}
        </Label>
      )}

      {/* Input con indicador de tipo */}
      <div className='relative flex items-center gap-2'>
        <div className='relative flex-1'>
          <div className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'>
            {hasUrl ? (
              <span className='text-base leading-none'>{TYPE_ICONS[media.type]}</span>
            ) : (
              <Link className='h-4 w-4' />
            )}
          </div>
          <Input
            value={inputValue}
            onChange={e => handleChange(e.target.value)}
            placeholder={placeholder}
            className='pl-9 pr-4'
          />
        </div>

        {/* Botones de acción */}
        {hasUrl && (
          <div className='flex items-center gap-1 flex-shrink-0'>
            {showPreview && media.canPreview && (
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => setPreviewOpen(v => !v)}
                className='gap-1.5 h-9'
                title={previewOpen ? 'Ocultar vista previa' : 'Vista previa'}
              >
                {previewOpen ? <EyeOff className='h-3.5 w-3.5' /> : <Eye className='h-3.5 w-3.5' />}
                <span className='hidden sm:inline'>
                  {previewOpen ? 'Ocultar' : 'Previsualizar'}
                </span>
              </Button>
            )}
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => window.open(inputValue, '_blank')}
              className='h-9 w-9 p-0'
              title='Abrir en nueva pestaña'
            >
              <ExternalLink className='h-3.5 w-3.5' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={handleClear}
              className='h-9 w-9 p-0 text-muted-foreground hover:text-destructive'
              title='Quitar URL'
            >
              <X className='h-3.5 w-3.5' />
            </Button>
          </div>
        )}
      </div>

      {/* Indicador de tipo detectado */}
      {hasUrl && (
        <div className='flex items-center gap-1.5 text-xs'>
          {media.type !== 'unknown' ? (
            <span className='flex items-center gap-1 text-green-600 dark:text-green-400'>
              <CheckCircle2 className='h-3 w-3' />
              {media.label} detectado
              {media.canPreview && ' · Vista previa disponible'}
            </span>
          ) : (
            <span className='flex items-center gap-1 text-muted-foreground'>
              <AlertCircle className='h-3 w-3' />
              Enlace externo · Se abrirá en nueva pestaña
            </span>
          )}
        </div>
      )}

      {/* Vista previa */}
      {previewOpen && media.canPreview && media.embedUrl && (
        <div className='rounded-lg overflow-hidden border bg-muted/30 mt-2'>
          {media.type === 'image' || (media.type === 'dropbox' && media.canEmbed) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.embedUrl}
              alt='Vista previa'
              className='w-full max-h-64 object-contain'
              onError={() => setPreviewOpen(false)}
            />
          ) : (
            <iframe
              src={media.embedUrl}
              title='Vista previa'
              className='w-full h-64 border-0'
              allow='autoplay'
              sandbox='allow-scripts allow-same-origin allow-popups'
            />
          )}
        </div>
      )}

      {/* Ayuda */}
      {!hasUrl && (
        <p className='text-xs text-muted-foreground'>
          Soporta: Google Drive, OneDrive, SharePoint, Dropbox, YouTube, imágenes y PDFs directos
        </p>
      )}
    </div>
  )
}
