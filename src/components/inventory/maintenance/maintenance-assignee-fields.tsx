'use client'

/**
 * Selector reutilizable: técnico interno XOR proveedor externo (+ contrato opcional).
 * Usado en programar / aprobar / masivo por tipo.
 */

import { Label } from '@/components/ui/label'
import { TechnicianCombobox } from '@/components/ui/technician-combobox'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { ContractPicker } from '@/components/contracts/contract-picker'

export type MaintenanceAssigneeMode = 'internal' | 'external'

export interface MaintenanceAssigneeValue {
  mode: MaintenanceAssigneeMode
  technicianId: string
  supplierId: string
  contractId: string | null
}

interface Props {
  value: MaintenanceAssigneeValue
  onChange: (next: MaintenanceAssigneeValue) => void
  familyId?: string | null
  /** Si false, oculta el picker de contrato (p. ej. formulario muy compacto) */
  showContract?: boolean
  disabled?: boolean
}

export function MaintenanceAssigneeFields({
  value,
  onChange,
  familyId,
  showContract = true,
  disabled,
}: Props) {
  const setMode = (mode: MaintenanceAssigneeMode) => {
    if (mode === 'internal') {
      onChange({ mode, technicianId: value.technicianId, supplierId: '', contractId: null })
    } else {
      onChange({ mode, technicianId: '', supplierId: value.supplierId, contractId: value.contractId })
    }
  }

  return (
    <div className='space-y-3'>
      <div className='space-y-1'>
        <Label>¿Quién realiza el mantenimiento?</Label>
        <div className='flex gap-2'>
          <button
            type='button'
            disabled={disabled}
            onClick={() => setMode('internal')}
            className={`flex-1 px-3 py-2 rounded-md border text-sm transition-colors ${
              value.mode === 'internal'
                ? 'border-primary bg-primary/5 text-primary font-medium'
                : 'border-border hover:border-muted-foreground/50'
            }`}
          >
            Técnico interno
          </button>
          <button
            type='button'
            disabled={disabled}
            onClick={() => setMode('external')}
            className={`flex-1 px-3 py-2 rounded-md border text-sm transition-colors ${
              value.mode === 'external'
                ? 'border-primary bg-primary/5 text-primary font-medium'
                : 'border-border hover:border-muted-foreground/50'
            }`}
          >
            Proveedor externo
          </button>
        </div>
      </div>

      {value.mode === 'internal' ? (
        <div className='space-y-1'>
          <Label>Técnico asignado</Label>
          <TechnicianCombobox
            value={value.technicianId}
            onValueChange={id => onChange({ ...value, technicianId: id || '' })}
            allowNull
            disabled={disabled}
          />
          <p className='text-xs text-muted-foreground'>
            Si no eliges uno, se asignará a quien programa el mantenimiento.
          </p>
        </div>
      ) : (
        <>
          <div className='space-y-1'>
            <Label>
              Proveedor <span className='text-destructive'>*</span>
            </Label>
            <SupplierSelect
              value={value.supplierId || null}
              onChange={id =>
                onChange({
                  ...value,
                  supplierId: id || '',
                  // Si cambia proveedor, limpia contrato vinculado
                  contractId: null,
                })
              }
              familyId={familyId || undefined}
              placeholder='Seleccionar proveedor...'
              disabled={disabled}
            />
          </div>
          {showContract && (
            <div className='space-y-1'>
              <Label>Contrato de soporte / mantenimiento (opcional)</Label>
              <ContractPicker
                value={value.contractId}
                onChange={contractId => onChange({ ...value, contractId })}
                supplierId={value.supplierId || null}
                familyId={familyId || null}
                context='equipment'
                disabled={disabled || !value.supplierId}
              />
              {!value.supplierId && (
                <p className='text-xs text-muted-foreground'>
                  Selecciona el proveedor para vincular un contrato vigente.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Payload listo para API desde el estado del assignee */
export function assigneeToApiPayload(value: MaintenanceAssigneeValue): {
  technicianId?: string
  supplierId?: string
  contractId?: string
} {
  if (value.mode === 'external') {
    return {
      supplierId: value.supplierId || undefined,
      contractId: value.contractId || undefined,
    }
  }
  return {
    technicianId: value.technicianId || undefined,
  }
}

export function emptyAssignee(mode: MaintenanceAssigneeMode = 'internal'): MaintenanceAssigneeValue {
  return { mode, technicianId: '', supplierId: '', contractId: null }
}
