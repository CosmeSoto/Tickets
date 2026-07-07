'use client'

import { useState, useEffect } from 'react'
import { Loader2, Camera, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { compressImageFile, fileToBase64, fileToDataUrl } from '@/lib/utils/image-utils'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'

interface IncidentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  patrolId?: string
  checkpointId?: string
  checkpointName?: string
  incident?: {
    id: string
    description: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    photoIds: string[]
  }
  onSuccess?: () => void
}

const SEVERITY_OPTIONS = [
  { value: 'LOW', label: '🟢 Baja' },
  { value: 'MEDIUM', label: '🟡 Media' },
  { value: 'HIGH', label: '🟠 Alta' },
  { value: 'CRITICAL', label: '🔴 Crítica' },
] as const

export function IncidentFormDialog({
  open,
  onOpenChange,
  mode,
  patrolId,
  checkpointId,
  checkpointName,
  incident,
  onSuccess,
}: IncidentFormDialogProps) {
  const { toast } = useToast()
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<string>('')
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && incident) {
      setDescription(incident.description)
      setSeverity(incident.severity)
      setPhotoBase64(null)
      setPhotoPreview(null)
    } else {
      setDescription('')
      setSeverity('')
      setPhotoBase64(null)
      setPhotoPreview(null)
    }
  }, [open, mode, incident])

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast({
        title: 'Error',
        description: 'Solo se permiten imágenes JPEG o PNG',
        variant: 'destructive',
      })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'La imagen no puede superar 10MB',
        variant: 'destructive',
      })
      return
    }
    // Vista previa usando el archivo original con data URL completa
    const previewUrl = await fileToDataUrl(file)
    setPhotoPreview(previewUrl)
    // Comprimir antes de convertir a base64 para enviar al servidor
    const compressed = await compressImageFile(file, { maxWidthPx: 1280, quality: 0.82 })
    const base64 = await fileToBase64(compressed)
    setPhotoBase64(base64)
  }

  const isValid = description.length >= 10 && severity !== ''

  const handleSubmit = async () => {
    if (!isValid) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = { description, severity }
      if (photoBase64) body.photoBase64 = photoBase64
      const url =
        mode === 'create' ? '/api/patrols/incidents' : `/api/patrols/incidents/${incident!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      if (mode === 'create') {
        body.patrolId = patrolId
        body.checkpointId = checkpointId
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al guardar la novedad')
      }
      // Solo mostramos toast en modo create, en modo edit la página padre se encarga
      if (mode === 'create') {
        toast({
          title: 'Éxito',
          description: 'Novedad reportada correctamente',
          variant: 'success',
        })
      }
      onSuccess?.()
      onOpenChange(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar la novedad'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Reportar Novedad' : 'Editar Novedad'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' && checkpointName
              ? `Checkpoint: ${checkpointName}`
              : 'Modifica los datos de la novedad.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={e => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <div className='space-y-4 py-2'>
            {/* Descripción */}
            <div className='space-y-1.5'>
              <Label htmlFor='incident-desc' className='text-sm'>
                Descripción <span className='text-destructive'>*</span>
              </Label>
              <Textarea
                id='incident-desc'
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder='Describe la novedad encontrada (mín. 10 caracteres)...'
                disabled={saving}
                rows={4}
              />
              <p className='text-xs text-muted-foreground text-right'>
                {description.length} caracteres{' '}
                {description.length > 0 && description.length < 10 && '(mínimo 10)'}
              </p>
            </div>

            {/* Severidad */}
            <div className='space-y-1.5'>
              <Label htmlFor='incident-severity' className='text-sm'>
                Severidad <span className='text-destructive'>*</span>
              </Label>
              <Select value={severity} onValueChange={setSeverity} disabled={saving}>
                <SelectTrigger id='incident-severity' className='h-9'>
                  <SelectValue placeholder='Selecciona severidad' />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Foto */}
            <div className='space-y-1.5'>
              <Label htmlFor='incident-photo' className='text-sm'>
                Foto (opcional)
              </Label>
              <FileInputWithCamera accept='image/jpeg,image/png' onChange={handlePhotoChange}>
                {({ openFile, openCamera, showCamera }) => (
                  <div className='flex items-center gap-2 flex-wrap'>
                    {showCamera && (
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => openCamera()}
                        disabled={saving}
                      >
                        <Camera className='h-3.5 w-3.5 mr-1.5' />
                        Cámara
                      </Button>
                    )}
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={openFile}
                      disabled={saving}
                    >
                      <Paperclip className='h-3.5 w-3.5 mr-1.5' />
                      {showCamera ? 'Galería' : 'Seleccionar'}
                    </Button>
                  </div>
                )}
              </FileInputWithCamera>
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt='Vista previa'
                  className='mt-2 rounded-md max-h-40 object-contain border'
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={saving || !isValid}>
              {saving && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              {mode === 'create' ? 'Reportar Novedad' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
