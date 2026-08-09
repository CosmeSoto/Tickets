'use client'

import { MoveUp, MoveDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** Flechas de reorden persistente (mismo patrón que atributos de tipo). */
export function ReorderRowButtons({
  index,
  total,
  disabled,
  onMove,
}: {
  index: number
  total: number
  disabled?: boolean
  onMove: (direction: 'up' | 'down') => void
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 w-7 p-0'
            onClick={() => onMove('up')}
            disabled={disabled || index <= 0}
          >
            <MoveUp className='h-3.5 w-3.5' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Subir en el orden</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 w-7 p-0'
            onClick={() => onMove('down')}
            disabled={disabled || index >= total - 1}
          >
            <MoveDown className='h-3.5 w-3.5' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Bajar en el orden</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Intercambia ítem en la lista y devuelve los ids en el nuevo orden. */
export function moveItemInList<T extends { id: string }>(
  items: T[],
  itemId: string,
  direction: 'up' | 'down'
): { next: T[]; ids: string[] } | null {
  const index = items.findIndex(i => i.id === itemId)
  if (index < 0) return null
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= items.length) return null
  const next = [...items]
  const [removed] = next.splice(index, 1)
  next.splice(newIndex, 0, removed)
  return { next, ids: next.map(i => i.id) }
}
