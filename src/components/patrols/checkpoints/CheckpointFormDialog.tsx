'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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

  // Evitar reset accidental cuando el padre recarga checkpoints/families (búsqueda, filtros)
  const familiesRef = useRef(families)
  familiesRef.current = families
  const checkpointsRef = useRef(checkpoints)
  checkpointsRef.current = checkpoints

  useEffect(() => {
    if (!open) return
    if (editingId) {
      const cp = checkpointsRef.current.find(c => c.id === editingId)
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
      setForm({ ...EMPTY_CHECKPOINT_FORM, familyId: familiesRef.current[0]?.id ?? '' })
    }
    // Solo al abrir o cambiar registro en edición — NO al recargar la lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingId])

  return (
    <Dialog open={open} onOpenChange={v => !saving && onOpenChange(v)}>
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
            <Select
              value={form.familyId}
              onValueChange={v => setForm(f => ({ ...f, familyId: v }))}
              disabled={saving || !!editingId}
            >
              <SelectTrigger id='cp-family' className='h-9'>
                <SelectValue placeholder='Selecciona un área' />
              </SelectTrigger>
              <SelectContent>
                {families.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <Label className='text-sm font-medium'>Tipo de QR</Label>
                <p className='text-xs text-muted-foreground mt-0.5'>
                  {form.hasConnectivity ? (
                    <>
                      <span className='font-semibold text-amber-600 dark:text-amber-400'>
                        🔄 QR Dinámico
                      </span>{' '}
                      — el código cambia cada 5 min. Necesita conexión a internet al escanear.
                      <br />
                      <span className='text-destructive'>
                        No apto para imprimir: el QR impreso expirará.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className='font-semibold text-green-600 dark:text-green-400'>
                        📌 QR Estático
                      </span>{' '}
                      — código fijo permanente. Imprime una vez y funciona siempre.
                    </>
                  )}
                </p>
              </div>
              <Switch
                checked={form.hasConnectivity}
                onCheckedChange={v => setForm(f => ({ ...f, hasConnectivity: v }))}
                disabled={saving}
                aria-label='Activar QR dinámico'
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
            <div className='p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-400'>
              ✅ QR Estático: imprime el código una sola vez y el guardia podrá escanearlo siempre
              sin necesidad de reconectar.
            </div>
          )}

          {form.hasConnectivity && (
            <div className='p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400'>
              ⚠️ QR Dinámico: el token cambia cada 5 minutos. Si imprimes el QR, dejará de funcionar
              en pocos minutos. Usa este modo solo si muestras el QR en pantalla digital.
            </div>
          )}

          {editingId && (
            <div className='flex items-center justify-between pt-1'>
              <div>
                <Label className='text-sm font-medium'>Regenerar QR</Label>
                <p className='text-xs text-muted-foreground'>
                  Genera un nuevo código QR. Los QR impresos anteriores dejarán de funcionar.
                </p>
              </div>
              <Switch
                checked={form.regenerateSecret ?? false}
                onCheckedChange={v => setForm(f => ({ ...f, regenerateSecret: v }))}
                disabled={saving}
              />
            </div>
          )}

          {form.regenerateSecret && (
            <div className='p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive'>
              ⚠️ Al guardar, se generará un nuevo QR. Deberás imprimir y reemplazar el QR físico en
              la ubicación del checkpoint.
            </div>
          )}
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
          <Button type='button' onClick={() => onSave(form, families)} disabled={saving}>
            {saving ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : null}
            {editingId ? 'Guardar cambios' : 'Crear checkpoint'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
