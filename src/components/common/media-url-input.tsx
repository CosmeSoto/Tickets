'use client'

/**
 * MediaUrlInput — componente global para insertar URLs de medios externos
 *
 * Vista previa real (iframe funcional):
 *  - YouTube (embed)
 *  - Google Drive (archivo individual con /preview)
 *  - Imágenes directas (jpg, png, gif, webp, svg)
 *  - PDFs directos
 *  - Dropbox imágenes (?raw=1)
 *
 * Enlace externo (bloquean X-Frame-Options — no se puede embeber):
 *  - SharePoint / OneDrive for Business
 *  - OneDrive personal (link de compartir, no de insertar)
 *  - Google Drive carpetas / Docs / Sheets
 */

import { useState, useEffect, useRef } from 'react'
import { Link, X, Eye, EyeOff, ExternalLink, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ── Tipos ──────────────────────────────────────────────────────────────────────

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
  embedUrl: string | null
  originalUrl: string
  canPreview: boolean
  canEmbed: boolean
  previewNote?: string
}

// ── detectMedia ────────────────────────────────────────────────────────────────

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

  // Google Drive — archivo individual (/file/d/{id})
  const gdMatch = u.match(/drive\.google\.com\/file\/d\/([^/?]+)/)
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
  // Google Drive carpetas, Docs, Sheets, Slides — bloquean iframe
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) {
    return {
      type: 'google-drive',
      label: 'Google Drive',
      embedUrl: null,
      originalUrl: u,
      canPreview: true,
      canEmbed: false,
      previewNote:
        'Google Drive bloquea la vista previa inline para carpetas y documentos. Usa el botón para abrir.',
    }
  }

  // SharePoint / OneDrive for Business — bloquea iframes con X-Frame-Options: DENY
  if (lower.includes('sharepoint.com') || lower.includes('office.com')) {
    return {
      type: 'onedrive',
      label: 'SharePoint / OneDrive',
      embedUrl: null,
      originalUrl: u,
      canPreview: true,
      canEmbed: false,
      previewNote:
        'SharePoint bloquea la vista previa inline por política de seguridad. Usa el botón para abrir el archivo.',
    }
  }

  // OneDrive personal — solo funciona con URL de "Insertar" (/embed), no de compartir
  if (lower.includes('onedrive.live.com') || lower.includes('1drv.ms')) {
    const embedUrl = u
      .replace('/view?', '/embed?')
      .replace('/view#', '/embed#')
      .replace(/\/view$/, '/embed')
    const isEmbedUrl = embedUrl !== u || lower.includes('/embed')
    return {
      type: 'onedrive',
      label: 'OneDrive',
      embedUrl: isEmbedUrl ? embedUrl : null,
      originalUrl: u,
      canPreview: true,
      canEmbed: isEmbedUrl,
      previewNote: isEmbedUrl
        ? undefined
        : 'Para vista previa, usa el enlace de "Insertar" de OneDrive (no el de compartir).',
    }
  }

  // Dropbox — imágenes con ?raw=1 funcionan; otros tipos bloquean
  if (lower.includes('dropbox.com')) {
    const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u)
    const rawUrl = u.replace('?dl=0', '?raw=1').replace('?dl=1', '?raw=1')
    if (isImage) {
      return {
        type: 'dropbox',
        label: 'Dropbox',
        embedUrl: rawUrl,
        originalUrl: u,
        canPreview: true,
        canEmbed: true,
      }
    }
    return {
      type: 'dropbox',
      label: 'Dropbox',
      embedUrl: null,
      originalUrl: u,
      canPreview: true,
      canEmbed: false,
      previewNote: 'Dropbox bloquea la vista previa inline para este tipo de archivo.',
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

  // Office en URL directa pública → Office Online Viewer (solo si el archivo es público)
  if (/\.(docx?|xlsx?|pptx?)(\?|$)/i.test(u) && u.startsWith('http')) {
    return {
      type: 'office',
      label: 'Documento Office',
      embedUrl: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(u)}`,
      originalUrl: u,
      canPreview: true,
      canEmbed: true,
      previewNote: 'Requiere que el archivo sea públicamente accesible (sin login).',
    }
  }

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
  const [imgError, setImgError] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    setInputValue(value)
    if (!value) setPreviewOpen(false)
  }, [value])

  useEffect(() => {
    setImgError(false)
  }, [inputValue, previewOpen])

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
          {optional && <span className='text-muted-foreground ml-1 font-normal'></span>}
        </Label>
      )}

      {/* Input */}
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
        {hasUrl && (
          <div className='flex items-center gap-1 flex-shrink-0 flex-wrap'>
            {showPreview && media.canPreview && (
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => setPreviewOpen(v => !v)}
                className='gap-1.5 h-9'
                title={previewOpen ? 'Ocultar' : 'Vista previa'}
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

      {/* Indicador de tipo */}
      {hasUrl && (
        <div className='flex items-center gap-1.5 text-xs'>
          {media.type !== 'unknown' ? (
            <span
              className={cn(
                'flex items-center gap-1',
                media.canEmbed
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-amber-600 dark:text-amber-400'
              )}
            >
              {media.canEmbed ? <CheckCircle2 className='h-3 w-3' /> : <Info className='h-3 w-3' />}
              {media.label} detectado
              {media.canEmbed ? ' · Vista previa disponible' : ' · Solo enlace externo'}
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
      {previewOpen && media.canPreview && (
        <div className='rounded-lg overflow-hidden border bg-muted/30 mt-2'>
          {/* Imagen directa o Dropbox imagen */}
          {media.canEmbed && (media.type === 'image' || media.type === 'dropbox') && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.embedUrl!}
              alt='Vista previa'
              className='w-full max-h-64 object-contain'
              onError={() => setImgError(true)}
            />
          ) : media.canEmbed && media.embedUrl && !imgError ? (
            /* iframe embebible: YouTube, Google Drive archivo, PDF, Office público */
            <iframe
              ref={iframeRef}
              src={media.embedUrl}
              title='Vista previa'
              className='w-full h-72 border-0'
              allow='autoplay; fullscreen'
              sandbox='allow-scripts allow-same-origin allow-popups allow-forms allow-presentation'
            />
          ) : (
            /* Fallback: no embebible o imagen falló */
            <div className='flex flex-col items-center justify-center gap-3 py-8 px-4 text-center'>
              <span className='text-4xl'>{TYPE_ICONS[media.type]}</span>
              <div>
                <p className='text-sm font-medium'>{media.label}</p>
                <p className='text-xs text-muted-foreground mt-1 max-w-xs'>
                  {imgError
                    ? 'No se pudo cargar la imagen. Puede requerir permisos o no estar disponible públicamente.'
                    : media.previewNote ||
                      'Este servicio no permite mostrar el contenido en vista previa inline.'}
                </p>
              </div>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => window.open(media.originalUrl, '_blank')}
                className='gap-1.5'
              >
                <ExternalLink className='h-3.5 w-3.5' />
                Abrir en nueva pestaña
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Ayuda */}
      {!hasUrl && (
        <p className='text-xs text-muted-foreground'>
          Vista previa: Google Drive (archivos), YouTube, imágenes y PDFs directos · SharePoint y
          OneDrive se abren en nueva pestaña
        </p>
      )}
    </div>
  )
}
