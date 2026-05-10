'use client'

import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreationBreadcrumb } from './CreationBreadcrumb'

const STEP_TITLES: Record<'individual' | 'bulk', Record<1 | 2 | 3, string>> = {
  individual: {
    1: 'Selecciona una familia',
    2: 'Selecciona el tipo de activo',
    3: 'Completa la información',
  },
  bulk: {
    1: 'Selecciona una familia',
    2: 'Selecciona el tipo de activo',
    3: 'Datos del lote',
  },
}

interface StepHeaderProps {
  mode: 'individual' | 'bulk'
  step: 1 | 2 | 3
  description: string
  familyName?: string | null
  familyColor?: string | null
  subtypeName?: string | null
  backLabel?: string
  onBack?: () => void
}

/**
 * Header estandarizado para todos los pasos del flujo de creación.
 * Muestra: título del paso + descripción + breadcrumb + botón atrás.
 * El título del layout (Nuevo Activo Individual / Nuevo Lote de Activos)
 * ya está en el header del sistema — aquí mostramos el contexto del paso.
 */
export function StepHeader({
  mode,
  step,
  description,
  familyName,
  familyColor,
  subtypeName,
  backLabel = 'Atrás',
  onBack,
}: StepHeaderProps) {
  const title = STEP_TITLES[mode][step]

  return (
    <div className='space-y-2 pb-1'>
      {/* Fila superior: título del paso + botón atrás */}
      <div className='flex items-center justify-between gap-4'>
        <h2 className='text-base font-semibold text-foreground'>{title}</h2>
        {onBack && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={onBack}
            className='shrink-0 text-muted-foreground hover:text-foreground gap-1.5 -mr-2'
          >
            <ArrowLeft className='h-4 w-4' />
            {backLabel}
          </Button>
        )}
      </div>

      {/* Descripción contextual */}
      <p className='text-sm text-muted-foreground'>{description}</p>

      {/* Breadcrumb — solo cuando hay familia seleccionada */}
      {(familyName || subtypeName) && (
        <CreationBreadcrumb
          mode={mode}
          step={step}
          familyName={familyName}
          familyColor={familyColor}
          subtypeName={subtypeName ?? undefined}
        />
      )}
    </div>
  )
}
