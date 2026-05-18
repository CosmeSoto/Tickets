'use client'

import { useState, useRef } from 'react'
import { AlertTriangle, Camera, Upload, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'
import { compressImageFile } from '@/lib/utils/image-utils'

interface PatrolIncidentButtonProps {
  patrolId: string
  familyId: string
  checkInId: string
  /** ID de categoría pre-configurada para incidentes de patrulla */
  incidentCategoryId?: string | null
  /** Callback tras crear el ticket exitosamente */
  onIncidentCreated?: (ticketId: string) => void
  disabled?: boolean
}

/**
 * Botón que abre un diálogo para reportar un incidente desde una patrulla.
 * Crea un ticket con source=PATROL y vincula el checkInId.
 * Requiere foto como evidencia (Req 10.5).
 * Usa FileInputWithCamera para soporte de cámara en móvil.
 */
export function PatrolIncidentButton({
  patrolId,
  familyId,
  checkInId,
  incidentCategoryId,
  onIncidentCreated,
  disabled,
}: PatrolIncidentButtonProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Comprimir antes de previsualizar
    const compressed = await compressImageFile(file, { maxWidthPx: 1280, quality: 0.82 })
    setPhotoFile(compressed)

    // Previsualizar
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(compressed)
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: 'Título requerido',
        description: 'Ingresa un título para el incidente',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || title.trim(),
          familyId,
          categoryId: incidentCategoryId ?? undefined,
          source: 'PATROL',
          checkInId,
          patrolId,
        }),
      })

      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.message ?? payload.error ?? 'Error al crear el incidente')
      }

      const ticket = payload.data ?? payload
      if (!ticket?.id) throw new Error('El servidor no devolvió el ticket creado')

      if (photoFile) {
        const attachmentData = new FormData()
        attachmentData.append('file', photoFile)
        await fetch(`/api/tickets/${ticket.id}/attachments`, {
          method: 'POST',
          body: attachmentData,
        }).catch(() => {})
      }

      toast({
        title: 'Incidente reportado',
        description: `Ticket creado: ${ticket.ticketCode ?? ticket.id}`,
      })
      onIncidentCreated?.(ticket.id)
      setOpen(false)
      // Reset form
      setTitle('')
      setDescription('')
      setPhotoFile(null)
      setPhotoPreview(null)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo crear el incidente',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        variant='destructive'
        size='sm'
        onClick={() => setOpen(true)}
        disabled={disabled}
        className='flex items-center gap-2'
      >
        <AlertTriangle className='h-4 w-4' />
        Reportar Incidente
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <AlertTriangle className='h-5 w-5 text-destructive' />
              Reportar Incidente
            </DialogTitle>
            <DialogDescription>
              Se creará un ticket de soporte vinculado a este check-in. Puedes adjuntar una foto
              como evidencia.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-2'>
            {/* Título */}
            <div className='space-y-1.5'>
              <Label htmlFor='incident-title' className='text-sm font-medium'>
                Título del incidente <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='incident-title'
                placeholder='Ej: Puerta de emergencia dañada'
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={submitting}
                maxLength={200}
              />
            </div>

            {/* Descripción */}
            <div className='space-y-1.5'>
              <Label htmlFor='incident-desc' className='text-sm font-medium'>
                Descripción (opcional)
              </Label>
              <Textarea
                id='incident-desc'
                placeholder='Describe el incidente con más detalle...'
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={submitting}
                rows={3}
                maxLength={1000}
              />
            </div>

            {/* Foto de evidencia */}
            <div className='space-y-1.5'>
              <Label className='text-sm font-medium'>Foto de evidencia (opcional)</Label>

              {photoPreview ? (
                <div className='relative rounded-lg overflow-hidden border border-border'>
                  <img src={photoPreview} alt='Evidencia' className='w-full h-40 object-cover' />
                  <button
                    type='button'
                    onClick={handleRemovePhoto}
                    className='absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-destructive transition-colors'
                    disabled={submitting}
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                  <div className='absolute bottom-2 left-2'>
                    <span className='text-xs bg-black/60 text-white px-2 py-0.5 rounded'>
                      {(photoFile!.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                </div>
              ) : (
                <FileInputWithCamera
                  accept='image/*'
                  multiple={false}
                  onChange={handlePhotoChange}
                  onCameraChange={handlePhotoChange}
                >
                  {({ openFile, openCamera, showCamera }) => (
                    <div className='flex gap-2'>
                      {showCamera && (
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => openCamera('environment')}
                          disabled={submitting}
                          className='flex-1'
                        >
                          <Camera className='h-4 w-4 mr-2' />
                          Tomar foto
                        </Button>
                      )}
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={openFile}
                        disabled={submitting}
                        className={showCamera ? 'flex-1' : 'w-full'}
                      >
                        <Upload className='h-4 w-4 mr-2' />
                        {showCamera ? 'Galería' : 'Adjuntar foto'}
                      </Button>
                    </div>
                  )}
                </FileInputWithCamera>
              )}
            </div>
          </div>

          <DialogFooter className='gap-2'>
            <Button variant='outline' onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant='destructive'
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Enviando...
                </>
              ) : (
                <>
                  <AlertTriangle className='h-4 w-4 mr-2' />
                  Reportar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
