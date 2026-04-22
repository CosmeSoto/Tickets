'use client'

import { useState, useEffect } from 'react'
import { Loader2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useInventoryFamilies } from '@/contexts/families-context'
import { useFamilyOptions } from '@/hooks/use-family-options'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  isClient: boolean
  preselectedEquipmentId?: string
  preselectedEquipmentLabel?: string
}

interface EquipmentOption {
  id: string
  code: string
  brand: string
  model: string
}

interface FamilyOption {
  id: string
  name: string
}

export function NewMaintenanceDialog({
  open, onClose, onCreated, isClient, preselectedEquipmentId, preselectedEquipmentLabel,
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  // Familias de inventario desde el contexto global — sin petición extra (memoizadas)
  const { families, loading: loadingFamilies } = useFamilyOptions()
  const familyList: FamilyOption[] = families.map(f => ({ id: f.id, name: f.name }))

  const [selectedFamilyId, setSelectedFamilyId] = useState('_all')

  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)

  const [equipmentId, setEquipmentId] = useState(preselectedEquipmentId || '')
  const [type, setType] = useState('PREVENTIVE')
  const [description, setDescription] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [notes, setNotes] = useState('')

  // Cargar equipos al abrir o al cambiar familia
  useEffect(() => {
    if (!open || preselectedEquipmentId) return
    setLoadingEquipment(true)
    setEquipmentId('')

    const params = new URLSearchParams({ limit: '100' })
    if (selectedFamilyId !== '_all') params.set('familyId', selectedFamilyId)

    fetch(`/api/inventory/equipment?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        setEquipmentList((data.equipment || data || []).map((e: any) => ({
          id: e.id,
          code: e.code,
          brand: e.brand,
          model: e.model,
        })))
      })
      .catch(() => {})
      .finally(() => setLoadingEquipment(false))
  }, [open, selectedFamilyId, preselectedEquipmentId, isClient])

  const handleClose = () => {
    setSelectedFamilyId('_all')
    setEquipmentId('')
    setType('PREVENTIVE')
    setDescription('')
    setScheduledDate('')
    setNotes('')
    onClose()
  }

  const handleSubmit = async () => {
    if (!equipmentId || !description || !scheduledDate) {
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
      handleClose()
      onCreated()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
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
          {preselectedEquipmentId ? (
            <div>
              <Label>Equipo</Label>
              <Input value={preselectedEquipmentLabel || preselectedEquipmentId} disabled />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Paso 1: Familia — solo admin/técnico */}
              {!isClient && (
                <div>
                  <Label>
                    Familia
                    <span className="ml-1 text-xs font-normal text-muted-foreground">— filtra los equipos</span>
                  </Label>
                  {loadingFamilies ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando familias...
                    </div>
                  ) : (
                    <SearchableSelect
                      options={[{ id: '_all', name: 'Todas las familias' }, ...familyList]}
                      value={selectedFamilyId}
                      onChange={setSelectedFamilyId}
                      placeholder="Buscar familia..."
                    />
                  )}
                </div>
              )}

              {/* Paso 2: Equipo */}
              <div>
                <Label>Equipo *</Label>
                {loadingEquipment ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando equipos...
                  </div>
                ) : (
                  <SearchableSelect
                    options={equipmentList.map(e => ({ id: e.id, name: `${e.code} — ${e.brand} ${e.model}` }))}
                    value={equipmentId}
                    onChange={setEquipmentId}
                    placeholder={isClient ? 'Buscar tu equipo...' : 'Buscar por código, marca o modelo...'}
                  />
                )}
              </div>
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

          {/* Descripción */}
          <div>
            <Label>{isClient ? 'Motivo de la solicitud *' : 'Descripción del trabajo *'}</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder={isClient ? 'Describe el problema o motivo...' : 'Describe el trabajo a realizar...'}
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

          {/* Notas */}
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
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !equipmentId || !description || !scheduledDate}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isClient ? 'Enviar Solicitud' : 'Programar Mantenimiento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
