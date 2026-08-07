'use client'

import { ChevronRight, Package, Layers } from 'lucide-react'

interface CreationBreadcrumbProps {
  mode: 'individual' | 'bulk'
  familyName?: string | null
  familyColor?: string | null
  subtypeName?: string | null
  /** Paso actual: 1=familia, 2=subtipo, 3=formulario */
  step: 1 | 2 | 3
}

const SUBTYPE_LABELS: Record<string, string> = {
  EQUIPMENT: 'Equipo Físico',
  MRO: 'Suministro',
  LICENSE: 'Contrato / Licencia',
}

export function CreationBreadcrumb({
  mode,
  familyName,
  familyColor,
  subtypeName,
  step,
}: CreationBreadcrumbProps) {
  const modeLabel = mode === 'individual' ? 'Activo Individual' : 'Lote de Activos'
  const ModeIcon = mode === 'individual' ? Package : Layers

  return (
    <div className='flex items-center gap-1.5 text-sm flex-wrap'>
      {/* Modo */}
      <span className='flex items-center gap-1 text-muted-foreground'>
        <ModeIcon className='h-3.5 w-3.5' />
        {modeLabel}
      </span>

      {/* Familia */}
      {familyName && step >= 2 && (
        <>
          <ChevronRight className='h-3.5 w-3.5 text-muted-foreground/50 shrink-0' />
          <span
            className='font-medium px-2 py-0.5 rounded-full text-xs'
            style={{
              backgroundColor: familyColor ? familyColor + '20' : undefined,
              color: familyColor ?? undefined,
            }}
          >
            {familyName}
          </span>
        </>
      )}

      {/* Subtipo */}
      {subtypeName && step >= 3 && (
        <>
          <ChevronRight className='h-3.5 w-3.5 text-muted-foreground/50 shrink-0' />
          <span className='font-medium text-foreground'>
            {SUBTYPE_LABELS[subtypeName] ?? subtypeName}
          </span>
        </>
      )}
    </div>
  )
}
