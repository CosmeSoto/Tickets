'use client'

/**
 * Selector unificado de "Área de soporte" al crear/editar tickets.
 * Usa FamilyCombobox (búsqueda) + mismos estados vacíos/carga en admin, tech y client.
 */

import { Layers, Loader2, AlertCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { FamilyCombobox, type FamilyOption } from '@/components/ui/family-combobox'

export type TicketSupportAreaFamily = FamilyOption & {
  isOwnFamily?: boolean
  isUserFamily?: boolean
}

interface TicketSupportAreaFieldProps {
  families: TicketSupportAreaFamily[]
  loading?: boolean
  value: string
  onValueChange: (familyId: string) => void
  disabled?: boolean
  emptyMessage?: string
  showNativeHint?: boolean
  /** Clase del label (admin vs client usan tipografías distintas) */
  labelClassName?: string
}

export function TicketSupportAreaField({
  families,
  loading = false,
  value,
  onValueChange,
  disabled = false,
  emptyMessage = 'No hay áreas de soporte disponibles para este usuario.',
  showNativeHint = true,
  labelClassName = 'flex items-center gap-1.5',
}: TicketSupportAreaFieldProps) {
  const selected = families.find(f => f.id === value)
  const isNative = !!(selected?.isOwnFamily || selected?.isUserFamily)

  return (
    <div className='space-y-2'>
      <Label className={labelClassName}>
        <Layers className='h-4 w-4' />
        Área de soporte <span className='text-destructive'>*</span>
      </Label>

      {loading ? (
        <p className='text-xs text-muted-foreground italic flex items-center gap-2'>
          <Loader2 className='h-3.5 w-3.5 animate-spin' />
          Cargando áreas disponibles...
        </p>
      ) : families.length === 0 ? (
        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription className='text-sm'>{emptyMessage}</AlertDescription>
        </Alert>
      ) : families.length === 1 ? (
        <div className='flex items-center gap-2 p-3 rounded-lg border bg-muted/30'>
          {families[0].color && (
            <span
              className='w-3 h-3 rounded-full flex-shrink-0'
              style={{ backgroundColor: families[0].color }}
            />
          )}
          <span className='text-sm font-medium'>{families[0].name}</span>
          <Badge variant='outline' className='text-xs font-mono ml-auto'>
            {families[0].code}
          </Badge>
        </div>
      ) : (
        <>
          <FamilyCombobox
            families={families}
            value={value}
            onValueChange={onValueChange}
            placeholder='Selecciona el área de soporte...'
            disabled={disabled}
            popoverWidth='360px'
          />
          {showNativeHint && value && isNative && (
            <p className='text-xs text-muted-foreground'>
              Área nativa pre-seleccionada. Puedes cambiarla si lo necesitas.
            </p>
          )}
          {showNativeHint && value && selected && !isNative && (
            <p className='text-xs text-muted-foreground'>
              Tu solicitud irá al equipo de <strong>{selected.name}</strong>
            </p>
          )}
          {showNativeHint && !value && (
            <p className='text-xs text-amber-600 dark:text-amber-400'>
              Selecciona el área de soporte a la que va dirigida la solicitud.
            </p>
          )}
        </>
      )}
    </div>
  )
}
