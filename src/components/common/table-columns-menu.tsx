'use client'

/**
 * Menú de columnas: visibilidad + orden (↑ ↓).
 * Usa Popover (portal) para no quedar cortado por overflow del layout.
 */

import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type TableColumnDef = {
  key: string
  label: string
  /** No se puede ocultar (sigue en la lista de orden) */
  required?: boolean
}

type Props = {
  columns: TableColumnDef[]
  /** Orden actual de keys (todas las columnas conocidas) */
  order: string[]
  /** Keys visibles */
  visible: string[]
  onOrderChange: (order: string[]) => void
  onVisibleChange: (visible: string[]) => void
  storageKey?: string
  className?: string
  /** Si se define, "Predeterminado" restaura estas keys (no todas) */
  defaultVisible?: string[]
}

function loadStored(key: string | undefined): { order?: string[]; visible?: string[] } | null {
  if (!key || typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as { order?: string[]; visible?: string[] }
  } catch {
    return null
  }
}

function saveStored(key: string | undefined, order: string[], visible: string[]) {
  if (!key || typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify({ order, visible }))
  } catch {
    /* ignore */
  }
}

export function TableColumnsMenu({
  columns,
  order,
  visible,
  onOrderChange,
  onVisibleChange,
  storageKey,
  className,
  defaultVisible,
}: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const stored = loadStored(storageKey)
    if (!stored) return
    const known = new Set(columns.map(c => c.key))
    if (stored.order?.length) {
      const next = [
        ...stored.order.filter(k => known.has(k)),
        ...columns.map(c => c.key).filter(k => !stored.order!.includes(k)),
      ]
      onOrderChange(next)
    }
    if (stored.visible?.length) {
      const required = columns.filter(c => c.required).map(c => c.key)
      const nextVis = [...new Set([...required, ...stored.visible.filter(k => known.has(k))])]
      onVisibleChange(nextVis)
    }
    // Solo hidratar al montar / cambiar storageKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const persist = (nextOrder: string[], nextVisible: string[]) => {
    saveStored(storageKey, nextOrder, nextVisible)
  }

  const toggleVisible = (key: string) => {
    const col = columns.find(c => c.key === key)
    if (col?.required) return
    const next = visible.includes(key) ? visible.filter(k => k !== key) : [...visible, key]
    if (next.length === 0) return
    onVisibleChange(next)
    persist(order, next)
  }

  const move = (key: string, dir: -1 | 1) => {
    const idx = order.indexOf(key)
    if (idx < 0) return
    const j = idx + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onOrderChange(next)
    persist(next, visible)
  }

  const resetDefault = () => {
    const defOrder = columns.map(c => c.key)
    const required = columns.filter(c => c.required).map(c => c.key)
    const known = new Set(columns.map(c => c.key))
    const preferred = (defaultVisible ?? columns.map(c => c.key)).filter(k => known.has(k))
    const nextVis = [...new Set([...required, ...preferred])]
    onOrderChange(defOrder)
    onVisibleChange(nextVis)
    persist(defOrder, nextVis)
  }

  const showAll = () => {
    const defOrder = columns.map(c => c.key)
    const allVisible = columns.map(c => c.key)
    onOrderChange(defOrder)
    onVisibleChange(allVisible)
    persist(defOrder, allVisible)
  }

  const orderedDefs = order
    .map(k => columns.find(c => c.key === k))
    .filter((c): c is TableColumnDef => Boolean(c))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className={cn('min-h-9 shrink-0', className)}
          title='Ordenar y mostrar columnas'
        >
          <SlidersHorizontal className='h-4 w-4 mr-1.5' />
          Columnas
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        side='bottom'
        sideOffset={6}
        collisionPadding={12}
        className='w-[min(20rem,calc(100vw-1.5rem))] p-0'
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <p className='px-3 py-2 text-xs font-semibold text-muted-foreground border-b'>
          Visibilidad y orden (afecta exportar)
        </p>
        <ul className='max-h-[min(20rem,50vh)] overflow-y-auto overscroll-contain py-1'>
          {orderedDefs.map((col, index) => {
            const isOn = visible.includes(col.key)
            return (
              <li key={col.key} className='flex items-center gap-1 px-2 py-1 hover:bg-accent/60'>
                <button
                  type='button'
                  className='flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-sm text-left'
                  onClick={() => toggleVisible(col.key)}
                  disabled={col.required}
                >
                  <span
                    className={cn(
                      'h-4 w-4 shrink-0 rounded border flex items-center justify-center',
                      isOn ? 'bg-primary border-primary' : 'border-border bg-background'
                    )}
                  >
                    {isOn && <Check className='h-2.5 w-2.5 text-primary-foreground' />}
                  </span>
                  <span className='min-w-0 flex-1 truncate'>{col.label}</span>
                  {col.required ? (
                    <span className='shrink-0 text-[10px] text-muted-foreground'>fija</span>
                  ) : null}
                </button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='h-7 w-7 shrink-0'
                  disabled={index === 0}
                  onClick={() => move(col.key, -1)}
                  title='Subir'
                >
                  <ChevronUp className='h-3.5 w-3.5' />
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='h-7 w-7 shrink-0'
                  disabled={index === orderedDefs.length - 1}
                  onClick={() => move(col.key, 1)}
                  title='Bajar'
                >
                  <ChevronDown className='h-3.5 w-3.5' />
                </Button>
              </li>
            )
          })}
        </ul>
        <div className='border-t px-3 py-2 flex flex-wrap gap-x-2 gap-y-1'>
          <button
            type='button'
            className='text-xs text-muted-foreground hover:text-foreground'
            onClick={resetDefault}
          >
            Predeterminado
          </button>
          <span className='text-muted-foreground text-xs'>·</span>
          <button
            type='button'
            className='text-xs text-muted-foreground hover:text-foreground'
            onClick={showAll}
          >
            Todas
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
