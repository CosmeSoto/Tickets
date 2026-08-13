'use client'

import * as React from 'react'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { CalendarContainerContext } from '@/components/ui/calendar-container-context'
import { cn } from '@/lib/utils'

type RootProps = {
  className?: string
  rootRef?: React.Ref<HTMLDivElement>
} & React.HTMLAttributes<HTMLDivElement>

/** Componente estable: evita remount del calendario en cada re-render del padre (p.ej. watch() en contratos). */
export function CalendarRoot({ className, rootRef, ...props }: RootProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node
      if (typeof rootRef === 'function') rootRef(node)
      else if (rootRef && 'current' in rootRef) {
        ;(rootRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      }
    },
    [rootRef]
  )

  return (
    <CalendarContainerContext.Provider value={containerRef}>
      <div data-slot='calendar' ref={setRefs} className={cn(className)} {...props} />
    </CalendarContainerContext.Provider>
  )
}

type ChevronProps = {
  className?: string
  orientation?: 'left' | 'right' | 'up' | 'down'
} & React.SVGProps<SVGSVGElement>

export function CalendarChevron({ className, orientation, ...props }: ChevronProps) {
  if (orientation === 'left') {
    return <ChevronLeftIcon className={cn('size-5', className)} {...props} />
  }

  if (orientation === 'right') {
    return <ChevronRightIcon className={cn('size-5', className)} {...props} />
  }

  return <ChevronDownIcon className={cn('size-5', className)} {...props} />
}

type WeekNumberProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  children?: React.ReactNode
}

export function CalendarWeekNumber({ children, ...props }: WeekNumberProps) {
  return (
    <td {...props}>
      <div className='flex size-[--cell-size] items-center justify-center text-center'>
        {children}
      </div>
    </td>
  )
}

export const calendarDefaultComponents = {
  Root: CalendarRoot,
  Chevron: CalendarChevron,
  WeekNumber: CalendarWeekNumber,
} as const
