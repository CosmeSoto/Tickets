/**
 * Toggle para cambiar entre vistas (cards/list/table/tree)
 * Incluye iconos y estado activo visual
 */

'use client'

import { LayoutGrid, List, Table2, FolderTree } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ViewMode } from '@/hooks/common'

export interface ViewToggleProps {
  mode: ViewMode
  availableModes?: ViewMode[]
  onChange: (mode: ViewMode) => void
  labels?: Partial<Record<ViewMode, string>>
  className?: string
  size?: 'sm' | 'default' | 'lg'
}

const defaultLabels: Record<ViewMode, string> = {
  cards: 'Vista de Tarjetas',
  list: 'Vista de Lista',
  table: 'Vista de Tabla',
  tree: 'Vista de Árbol'
}

const defaultIcons: Record<ViewMode, React.ReactNode> = {
  cards: <LayoutGrid className='h-4 w-4' />,
  list: <List className='h-4 w-4' />,
  table: <Table2 className='h-4 w-4' />,
  tree: <FolderTree className='h-4 w-4' />
}

export function ViewToggle({
  mode,
  availableModes = ['cards', 'list', 'table'],
  onChange,
  labels = {},
  className,
  size = 'default'
}: ViewToggleProps) {
  const mergedLabels = { ...defaultLabels, ...labels }

  return (
    <div className={cn('flex items-center border rounded-md overflow-hidden', className)}>
      {availableModes.map((viewMode) => (
        <Button
          key={viewMode}
          variant={mode === viewMode ? 'default' : 'ghost'}
          size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default'}
          onClick={() => onChange(viewMode)}
          className={cn(
            'rounded-none border-0',
            mode === viewMode && 'bg-primary text-primary-foreground'
          )}
          aria-label={mergedLabels[viewMode]}
          aria-pressed={mode === viewMode}
          title={mergedLabels[viewMode]}
        >
          {defaultIcons[viewMode]}
        </Button>
      ))}
    </div>
  )
}
