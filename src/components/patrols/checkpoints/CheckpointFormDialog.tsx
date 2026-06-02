'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CheckpointFormData, Checkpoint } from './types'
import { EMPTY_CHECKPOINT_FORM } from './types'

interface CheckpointFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingId: string | null
  families: { id: string; name: string; code: string }[]
  checkpoints: Checkpoint[]
  onSave: (
    form: CheckpointFormData,
    families: { id: string; name: string; code: string }[]
  ) => Promise<boolean>
  saving: boolean
}

export function CheckpointFormDialog({
  open,
  onOpenChange,
  editingId,
  families,
  checkpoints,
  onSave,
  saving,
}: CheckpointFormDialogProps) {
  const [form, setForm] = useState<CheckpointFormData>(EMPTY_CHECKPOINT_FORM)

  useEffect(() => {
    if (open) {
      if (editingId) {
        const cp = checkpoints.find(c => c.id === editingId)
        if (cp) {
          setForm({
            familyId: cp.familyId,
            name: cp.name,
            description: cp.description ?? '',
            location: cp.location,
            latitude: cp.latitude != null ? String(cp.latitude) : '',
            longitude: cp.longitude != null ? String(cp.longitude) : '',
            geofenceRadiusMeters:
              cp.geofenceRadiusMeters != null ? String(cp.geofenceRadiusMeters) : '',
            hasConnectivity: cp.hasConnectivity,
            isSensitive: cp.isSensitive,
          })
        }
      } else {
        setForm({ ...EMPTY_CHECKPOINT_FORM, familyId: families[0]?.id ?? '' })
      }
    }
  }, [open, editingId, checkpoints, families])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{editingId ? 'Editar Checkpoint' : 'Nuevo Checkpoint'}</DialogTitle>
          <DialogDescription>
            {editingId
              ? 'Modifica los datos del checkpoint.'
              : 'Crea un nuevo punto de control físico.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1'>
          {/* Área */}
          <div className='space-y-1.5'>
            <Label htmlFor='cp-family' className='text-sm'>
              Área <span className='text-destructive'>*</span>
            </Label>
            <select
              id='cp-family'
              value={form.familyId}
              onChange={e => setForm(f => ({ ...f, familyId: e.target.value }))}
              className='w-full h-9 rounded-md border border-input bg-background px-3 text-sm'
              disabled={saving || !!editingId}
            >
              <option value=''>Selecciona un área</option>
              {families.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.code})
                </option>
              ))}
            </select>
          </div>

          {/* Nombre */}
          <div className='space-y-1.5'>
            <Label htmlFor='cp-name' className='text-sm'>
              Nombre <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='cp-name'
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder='Ej: Entrada Principal'
              disabled={saving}
              maxLength={200}
            />
          </div>

          {/* Ubicación */}
          <div className='space-y-1.5'>
            <Label htmlFor='cp-location' className='text-sm'>
              Descripción de ubicación <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='cp-location'
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder='Ej: Planta baja, junto a ascensores'
              disabled={saving}
              maxLength={500}
            />
          </div>

          {/* Descripción */}
          <div className='space-y-1.5'>
            <Label htmlFor='cp-desc' className='text-sm'>
              Descripción (opcional)
            </Label>
            <Textarea
              id='cp-desc'
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder='Notas adicionales sobre este checkpoint...'
              disabled={saving}
              rows={2}
            />
          </div>

          {/* GPS */}
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label htmlFor='cp-lat' className='text-sm'>
                Latitud (opcional)
              </Label>
              <Input
                id='cp-lat'
                type='number'
                step='any'
                value={form.latitude}
                onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                placeholder='-0.1234'
                disabled={saving}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='cp-lng' className='text-sm'>
                Longitud (opcional)
              </Label>
              <Input
                id='cp-lng'
                type='number'
                step='any'
                value={form.longitude}
                onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                placeholder='-78.5678'
                disabled={saving}
              />
            </div>
          </div>

          {/* Radio geofence */}
          <div className='space-y-1.5'>
            <Label htmlFor='cp-radius' className='text-sm'>
              Radio de geofence (metros, opcional)
            </Label>
            <Input
              id='cp-radius'
              type='number'
              min={1}
              max={10000}
              value={form.geofenceRadiusMeters}
              onChange={e => setForm(f => ({ ...f, geofenceRadiusMeters: e.target.value }))}
              placeholder='Deja vacío para usar el default del área'
              disabled={saving}
            />
          </div>

          {/* Switches */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div>
                <Label className='text-sm font-medium'>Tiene conectividad</Label>
                <p className='text-xs text-muted-foreground'>
                  ON = QR Dinámico (cambia constantemente, máxima seguridad)
                  <br />
                  OFF = QR Estático (permanente, ideal para imprimir)
                </p>
              </div>
              <Switch
                checked={form.hasConnectivity}
                onCheckedChange={v => setForm(f => ({ ...f, hasConnectivity: v }))}
                disabled={saving}
              />
            </div>
            <div className='flex items-center justify-between'>
              <div>
                <Label className='text-sm font-medium'>Punto sensible</Label>
                <p className='text-xs text-muted-foreground'>
                  Requiere foto obligatoria en cada check-in
                </p>
              </div>
              <Switch
                checked={form.isSensitive}
                onCheckedChange={v => setForm(f => ({ ...f, isSensitive: v }))}
                disabled={saving}
              />
            </div>
          </div>

          {!form.hasConnectivity && (
            <div className='p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 text-xs text-orange-700 dark:text-orange-400'>
              Sin conectividad → QR Estático.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(form, families)} disabled={saving}>
            {saving ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : null}
            {editingId ? 'Guardar cambios' : 'Crear checkpoint'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
