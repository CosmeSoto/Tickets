/**
 * Sortable Table Head Component
 * Header de tabla con iconos de ordenamiento
 */

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface SortableTableHeadProps {
  children: React.ReactNode
  sortKey: string
  currentSort: 'asc' | 'desc' | null
  onSort: (key: string) => void
  className?: string
  align?: 'left' | 'center' | 'right'
}

export function SortableTableHead({
  children,
  sortKey,
  currentSort,
  onSort,
  className,
  align = 'left',
}: SortableTableHeadProps) {
  const alignClass =
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : ''

  return (
    <TableHead className={cn(alignClass, className)}>
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          'flex items-center gap-1.5 hover:text-foreground transition-colors font-medium',
          align === 'center' && 'justify-center w-full',
          align === 'right' && 'justify-end w-full',
          currentSort ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        <span>{children}</span>
        {currentSort === 'asc' && <ArrowUp className='h-3.5 w-3.5' />}
        {currentSort === 'desc' && <ArrowDown className='h-3.5 w-3.5' />}
        {!currentSort && <ArrowUpDown className='h-3.5 w-3.5 opacity-40' />}
      </button>
    </TableHead>
  )
}
