'use client'

import { useState, useEffect } from 'react'
import { Loader2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  isClient: boolean
  /** Si se pasa, el equipo queda fijo (desde la página de detalle del equipo) */
  preselectedEquipmentId?: string
  preselectedEquipmentLabel?: string
}

interface EquipmentOption {
  id: string
  code: string
  brand: string
  model: string
}

export function NewMaintenanceDialog({
  open, onClose, onCreated, isClient, preselectedEquipmentId, preselectedEquipmentLabel,
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)

  const [equipmentId, setEquipmentId] = useState(preselectedEquipmentId || '')
  const [type, setType] = useState('PREVENTIVE')
  const [description, setDescription] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [notes, setNotes] = useState('')

  // Cargar equipos disponibles para el selector
  useEffect(() => {
    if (!open || preselectedEquipmentId) return
    setLoadingEquipment(true)

    const url = isClient
      ? '/api/inventory/equipment?limit=100'
      : '/api/inventory/equipment?limit=100'

    fetch(url, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const items: EquipmentOption[] = (data.equipment || data || []).map((e: any) => ({
          id: e.id,
          code: e.code,
          brand: e.brand,
          model: e.model,
        }))
        setEquipmentList(items)
      })
      .catch(() => {})
      .finally(() => setLoadingEquipment(false))
  }, [open, isClient, preselectedEquipmentId])

  const handleSubmit = async () => {
    if (!equipmentId || !type || !description || !scheduledDate) {
      toast({ title: 'Campos requeridos', description: 'Completa todos los campos obligatorios.', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipmentId, type, description, scheduledDate, notes: notes || undefined }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear mantenimiento')
      }
      toast({
        title: isClient ? 'Solicitud enviada' : 'Mantenimiento programado',
        description: isClient
          ? 'Tu solicitud fue enviada al equipo técnico para su aprobación.'
          : 'El mantenimiento fue programado y el equipo está en estado de mantenimiento.',
      })
      onCreated()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {isClient ? 'Solicitar Mantenimiento' : 'Programar Mantenimiento'}
          </DialogTitle>
          <DialogDescription>
            {isClient
              ? 'Envía una solicitud al equipo técnico. Ellos la revisarán y programarán la fecha.'
              : 'Programa un mantenimiento preventivo o correctivo. El equipo pasará a estado de mantenimiento.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Equipo */}
          {preselectedEquipmentId ? (
            <div>
              <Label>Equipo</Label>
              <Input value={preselectedEquipmentLabel || preselectedEquipmentId} disabled />
            </div>
          ) : (
            <div>
              <Label>Equipo *</Label>
              {loadingEquipment ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando equipos...
                </div>
              ) : (
                <Select value={equipmentId} onValueChange={setEquipmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder={isClient ? 'Selecciona tu equipo' : 'Selecciona un equipo'} />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentList.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        {isClient ? 'No tienes equipos asignados' : 'No hay equipos disponibles'}
                      </SelectItem>
                    ) : (
                      equipmentList.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.code} — {e.brand} {e.model}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Tipo */}
          <div>
            <Label>Tipo de mantenimiento *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PREVENTIVE">
                  <div>
                    <p className="font-medium">Preventivo</p>
                    <p className="text-xs text-muted-foreground">Revisión rutinaria para evitar fallas</p>
                  </div>
                </SelectItem>
                <SelectItem value="CORRECTIVE">
                  <div>
                    <p className="font-medium">Correctivo</p>
                    <p className="text-xs text-muted-foreground">Reparación de una falla existente</p>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Descripción / Motivo */}
          <div>
            <Label>{isClient ? 'Motivo de la solicitud *' : 'Descripción del trabajo *'}</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder={isClient
                ? 'Describe el problema o motivo del mantenimiento...'
                : 'Describe el trabajo a realizar...'}
            />
          </div>

          {/* Fecha */}
          <div>
            <Label>{isClient ? 'Fecha sugerida *' : 'Fecha programada *'}</Label>
            <Input
              type="date"
              value={scheduledDate}
              min={minDate}
              onChange={e => setScheduledDate(e.target.value)}
            />
            {isClient && (
              <p className="text-xs text-muted-foreground mt-1">
                El técnico puede ajustar la fecha al aprobar tu solicitud.
              </p>
            )}
          </div>

          {/* Notas adicionales */}
          <div>
            <Label>Notas adicionales (opcional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Información adicional relevante..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !equipmentId || !description || !scheduledDate}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isClient ? 'Enviar Solicitud' : 'Programar Mantenimiento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
