'use client'

/**
 * SimpleSelect — select nativo estilizado, para opciones fijas y cortas.
 * Usa el mismo estilo visual que Input y SearchableSelect.
 *
 * Uso:
 *   <SimpleSelect value={val} onChange={setVal} options={OPTIONS} />
 *   <SimpleSelect value={val} onChange={setVal}>
 *     <option value="a">Opción A</option>
 *   </SimpleSelect>
 */

import { cn } from '@/lib/utils'

export interface SimpleSelectOption {
  value: string
  label: string
}

interface SimpleSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: SimpleSelectOption[]
  className?: string
}

export function SimpleSelect({ options, className, children, ...props }: SimpleSelectProps) {
  return (
    <select
      {...props}
      className={cn(
        'flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {options
        ? options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
        : children}
    </select>
  )
}
