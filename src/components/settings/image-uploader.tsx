'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Upload, X, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ImageUploaderProps {
  label: string
  currentUrl?: string
  onUpload: (url: string) => void
  type: 'logo-light' | 'logo-dark' | 'hero-bg' | 'favicon'
}

// Varias instancias de ImageUploader se montan a la vez en la misma pantalla
// (favicon, logo claro, logo oscuro, hero) — sin esta caché compartida cada
// una dispara su propio GET /api/admin/settings al montar.
let maxFileSizePromise: Promise<number> | null = null

function fetchMaxFileSize(): Promise<number> {
  if (!maxFileSizePromise) {
    maxFileSizePromise = fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => (typeof data?.maxFileSize === 'number' ? data.maxFileSize : 10))
      .catch(() => 10)
  }
  return maxFileSizePromise
}

export function ImageUploader({ label, currentUrl, onUpload, type }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl || '')
  const [maxFileSize, setMaxFileSize] = useState(10) // Default 10MB
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Cargar configuración del sistema
  useEffect(() => {
    fetchMaxFileSize().then(setMaxFileSize)
  }, [])

  // Actualizar preview cuando cambia currentUrl
  useEffect(() => {
    setPreview(currentUrl || '')
  }, [currentUrl])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo. Los navegadores no siempre reportan un `file.type` para
    // .ico (queda vacío en varios de ellos), así que para favicon también
    // aceptamos por extensión — el servidor igual valida el contenido real
    // (magic bytes) antes de guardarlo.
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
    if (type === 'favicon') {
      allowedTypes.push('image/x-icon', 'image/vnd.microsoft.icon')
    }
    const isIcoByExtension = type === 'favicon' && file.name.toLowerCase().endsWith('.ico')
    if (!allowedTypes.includes(file.type) && !isIcoByExtension) {
      toast({
        title: 'Error',
        description:
          type === 'favicon'
            ? 'Solo se permiten imágenes JPG, PNG, WebP, SVG e ICO'
            : 'Solo se permiten imágenes JPG, PNG, WebP y SVG',
        variant: 'destructive',
      })
      return
    }

    // Validar tamaño usando configuración del sistema
    const maxSizeBytes = maxFileSize * 1024 * 1024
    if (file.size > maxSizeBytes) {
      toast({
        title: 'Error',
        description: `La imagen no debe superar ${maxFileSize}MB`,
        variant: 'destructive',
      })
      return
    }

    // Preview local
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Subir archivo
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const response = await fetch('/api/admin/landing-page/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`📤 Image uploaded (${type}):`, data.url)
        onUpload(data.url)
        toast({
          title: 'Imagen subida',
          description: 'No olvides hacer clic en "Guardar Cambios" para aplicar',
        })
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Error al subir imagen')
      }
    } catch (error) {
      console.error('Error uploading:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al subir imagen',
        variant: 'destructive',
      })
      setPreview(currentUrl || '')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    setPreview('')
    onUpload('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className='space-y-2'>
      <Label>{label}</Label>

      {preview ? (
        <div className='relative border rounded-lg p-3 bg-muted/50'>
          <div className='flex items-center space-x-3'>
            <div className='relative w-16 h-16 bg-white dark:bg-gray-800 rounded border flex items-center justify-center overflow-hidden flex-shrink-0'>
              <img src={preview} alt='Preview' className='max-w-full max-h-full object-contain' />
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-medium'>Imagen cargada</p>
              <p className='text-xs text-muted-foreground truncate'>{preview}</p>
            </div>
            <Button variant='ghost' size='sm' onClick={handleRemove} disabled={uploading}>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </div>
      ) : (
        <div className='flex items-center space-x-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className='flex-1'
          >
            {uploading ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className='h-4 w-4 mr-2' />
                Seleccionar Imagen
              </>
            )}
          </Button>
          <span className='text-xs text-muted-foreground'>
            JPG, PNG, WebP, SVG{type === 'favicon' ? ', ICO' : ''} (máx. {maxFileSize}MB)
          </span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type='file'
        accept={
          type === 'favicon'
            ? 'image/jpeg,image/jpg,image/png,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico'
            : 'image/jpeg,image/jpg,image/png,image/webp,image/svg+xml'
        }
        onChange={handleFileSelect}
        className='hidden'
        disabled={uploading}
      />
    </div>
  )
}
