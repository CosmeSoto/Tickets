'use client'

/**
 * MaintenanceStatusBlock — bloque reutilizable de datos de mantenimiento.
 *
 * Usado en:
 *   - EquipmentAssetForm (nuevo activo con estado MAINTENANCE)
 *   - EquipmentForm (editar activo con estado MAINTENANCE)
 *
 * Muestra: fecha de ingreso, tipo, técnico/proveedor, y descripción.
 * El usuario elige entre técnico interno o proveedor externo.
 */

import { useState, useEffect } from 'react'
import { Wrench } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { DateInput } from '@/components/ui/date-input'

interface Technician {
  id: string
  name: string
  email: string
}

interface MaintenanceStatusBlockProps {
  date: string
  onDateChange: (v: string) => void
  type: 'PREVENTIVE' | 'CORRECTIVE'
  onTypeChange: (v: 'PREVENTIVE' | 'CORRECTIVE') => void
  technicianId: string
  onTechnicianChange: (id: string) => void
  supplierId?: string
  onSupplierChange?: (id: string) => void
  description: string
  onDescriptionChange: (v: string) => void
  familyId?: string
}

export function MaintenanceStatusBlock({
  date,
  onDateChange,
  type,
  onTypeChange,
  technicianId,
  onTechnicianChange,
  supplierId,
  onSupplierChange,
  description,
  onDescriptionChange,
  familyId,
}: MaintenanceStatusBlockProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(false)
  const [responsibleType, setResponsibleType] = useState<'internal' | 'external'>(
    supplierId ? 'external' : 'internal'
  )

  useEffect(() => {
    setLoading(true)
    fetch('/api/users?role=TECHNICIAN&isActive=true&limit=200')
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(data => setTechnicians(data.data ?? []))
      .catch(() => setTechnicians([]))
      .finally(() => setLoading(false))
  }, [])

  const handleResponsibleTypeChange = (newType: 'internal' | 'external') => {
    setResponsibleType(newType)
    if (newType === 'internal') {
      onSupplierChange?.('')
    } else {
      onTechnicianChange('')
    }
  }

  return (
    <div className='rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3'>
      <p className='text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2'>
        <Wrench className='h-4 w-4' />
        Datos del mantenimiento
      </p>

      <div className='grid grid-cols-2 gap-3'>
        {/* Fecha de ingreso */}
        <div className='space-y-1'>
          <Label>
            Fecha de ingreso <span className='text-destructive'>*</span>
          </Label>
          <DateInput value={date} onChange={e => onDateChange(e.target.value)} />
        </div>

        {/* Tipo */}
        <div className='space-y-1'>
          <Label>Tipo de mantenimiento</Label>
          <select
            value={type}
            onChange={e => onTypeChange(e.target.value as 'PREVENTIVE' | 'CORRECTIVE')}
            className='flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          >
            <option value='CORRECTIVE'>Correctivo</option>
            <option value='PREVENTIVE'>Preventivo</option>
          </select>
        </div>
      </div>

      {/* Selector: técnico interno o proveedor externo */}
      {onSupplierChange && (
        <div className='space-y-1'>
          <Label>¿Quién realiza el mantenimiento?</Label>
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={() => handleResponsibleTypeChange('internal')}
              className={`flex-1 px-3 py-2 rounded-md border text-sm transition-colors ${
                responsibleType === 'internal'
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              Técnico interno
            </button>
            <button
              type='button'
              onClick={() => handleResponsibleTypeChange('external')}
              className={`flex-1 px-3 py-2 rounded-md border text-sm transition-colors ${
                responsibleType === 'external'
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              Proveedor externo
            </button>
          </div>
        </div>
      )}

      {/* Técnico interno */}
      {responsibleType === 'internal' && (
        <div className='space-y-1'>
          <Label>Técnico asignado</Label>
          <SearchableSelect
            options={technicians.map(t => ({ id: t.id, name: t.name || t.email }))}
            value={technicianId}
            onChange={onTechnicianChange}
            placeholder={loading ? 'Cargando técnicos...' : 'Buscar técnico...'}
            disabled={loading}
            emptyLabel='Sin técnico asignado'
          />
        </div>
      )}

      {/* Proveedor externo */}
      {responsibleType === 'external' && onSupplierChange && (
        <div className='space-y-1'>
          <Label>Proveedor externo</Label>
          <SupplierSelect
            value={supplierId || null}
            onChange={v => onSupplierChange(v || '')}
            familyId={familyId}
            placeholder='Seleccionar proveedor...'
          />
        </div>
      )}

      {/* Descripción */}
      <div className='space-y-1'>
        <Label>Descripción del problema / trabajo</Label>
        <Textarea
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          rows={2}
          placeholder='Describe el motivo del mantenimiento...'
        />
      </div>
    </div>
  )
}
