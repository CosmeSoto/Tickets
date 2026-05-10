'use client'

import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreationBreadcrumb } from './CreationBreadcrumb'

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
 * Muestra: breadcrumb + descripción + botón atrás consistente.
 * El título principal ya está en el header del layout — no se repite aquí.
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
  return (
    <div className='flex items-start justify-between gap-4 pb-1'>
      <div className='space-y-1 min-w-0'>
        <CreationBreadcrumb
          mode={mode}
          step={step}
          familyName={familyName}
          familyColor={familyColor}
          subtypeName={subtypeName ?? undefined}
        />
        <p className='text-sm text-muted-foreground'>{description}</p>
      </div>

      {onBack && (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={onBack}
          className='shrink-0 text-muted-foreground hover:text-foreground gap-1.5'
        >
          <ArrowLeft className='h-4 w-4' />
          {backLabel}
        </Button>
      )}
    </div>
  )
}
