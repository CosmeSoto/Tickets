'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContractFormSectionProps {
  title: string
  description?: string
  children: ReactNode
  /** Si false, la sección siempre está visible (sin accordion). */
  collapsible?: boolean
  /** Estado inicial abierto (solo si collapsible). */
  defaultOpen?: boolean
  /** Etiqueta opcional a la derecha del título (ej. "Opcional"). */
  badge?: string
  className?: string
}

/**
 * Sección de formulario de contrato: fija o colapsable.
 * Usa botón en lugar de <details> para no interferir con Popover/Select anidados.
 */
export function ContractFormSection({
  title,
  description,
  children,
  collapsible = true,
  defaultOpen = true,
  badge,
  className,
}: ContractFormSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  const header = (
    <div className='flex items-start gap-2 min-w-0'>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2 flex-wrap'>
          <h3 className='text-sm font-semibold leading-none'>{title}</h3>
          {badge && (
            <span className='text-[10px] uppercase tracking-wide text-muted-foreground border rounded px-1.5 py-0.5'>
              {badge}
            </span>
          )}
        </div>
        {description && <p className='text-xs text-muted-foreground mt-1.5'>{description}</p>}
      </div>
      {collapsible && (
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform mt-0.5',
            open && 'rotate-180'
          )}
        />
      )}
    </div>
  )

  if (!collapsible) {
    return (
      <section className={cn('rounded-lg border bg-card', className)}>
        <div className='px-4 py-3 border-b'>{header}</div>
        <div className='p-4'>{children}</div>
      </section>
    )
  }

  return (
    <section className={cn('rounded-lg border bg-card group/section', className)}>
      <button
        type='button'
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
        className='w-full cursor-pointer px-4 py-3 select-none text-left'
      >
        {header}
      </button>
      {open ? <div className='border-t p-4'>{children}</div> : null}
    </section>
  )
}
