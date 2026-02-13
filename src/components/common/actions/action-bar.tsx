/**
 * Barra de acciones con botón primario, secundarios y acciones masivas
 * Incluye estados de loading y disabled
 */

'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Action } from '@/types/common'

export interface ActionBarProps {
  // Acción principal (ej: Crear, Agregar)
  primaryAction?: Action
  
  // Acciones secundarias (ej: Exportar, Importar)
  secondaryActions?: Action[]
  
  // Acciones masivas (cuando hay items seleccionados)
  bulkActions?: Action[]
  selectedCount?: number
  
  // Estilos
  className?: string
  align?: 'left' | 'right' | 'between'
}

export function ActionBar({
  primaryAction,
  secondaryActions = [],
  bulkActions = [],
  selectedCount = 0,
  className,
  align = 'right'
}: ActionBarProps) {
  const hasBulkActions = bulkActions.length > 0 && selectedCount > 0
  const hasSecondaryActions = secondaryActions.length > 0

  return (
    <div className={cn(
      'flex items-center gap-3',
      align === 'left' && 'justify-start',
      align === 'right' && 'justify-end',
      align === 'between' && 'justify-between',
      className
    )}>
      {/* Acciones masivas (cuando hay selección) */}
      {hasBulkActions && (
        <div className='flex items-center gap-2 mr-auto'>
          <Badge variant='secondary' className='h-8 px-3'>
            {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
          </Badge>
          
          {bulkActions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'outline'}
              size='sm'
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
              className='h-8'
            >
              {action.loading ? (
                <div className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2' />
              ) : action.icon ? (
                <span className='mr-2'>{action.icon}</span>
              ) : null}
              {action.label}
            </Button>
          ))}
        </div>
      )}
      
      {/* Acciones secundarias */}
      {hasSecondaryActions && (
        <>
          {/* Mostrar primeras 2 acciones directamente en desktop */}
          <div className='hidden md:flex items-center gap-2'>
            {secondaryActions.slice(0, 2).map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'outline'}
                size='sm'
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
              >
                {action.loading ? (
                  <div className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2' />
                ) : action.icon ? (
                  <span className='mr-2'>{action.icon}</span>
                ) : null}
                {action.label}
              </Button>
            ))}
          </div>
          
          {/* Dropdown para el resto o todas en mobile */}
          {secondaryActions.length > 2 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' className='md:hidden'>
                  <MoreVertical className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                {secondaryActions.map((action, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={action.onClick}
                    disabled={action.disabled || action.loading}
                  >
                    {action.icon && <span className='mr-2'>{action.icon}</span>}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Dropdown para acciones adicionales en desktop */}
          {secondaryActions.length > 2 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' className='hidden md:flex'>
                  <MoreVertical className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                {secondaryActions.slice(2).map((action, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={action.onClick}
                    disabled={action.disabled || action.loading}
                  >
                    {action.icon && <span className='mr-2'>{action.icon}</span>}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      )}
      
      {/* Acción primaria */}
      {primaryAction && (
        <Button
          variant={primaryAction.variant || 'default'}
          size='sm'
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled || primaryAction.loading}
        >
          {primaryAction.loading ? (
            <div className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2' />
          ) : primaryAction.icon ? (
            <span className='mr-2'>{primaryAction.icon}</span>
          ) : null}
          {primaryAction.label}
        </Button>
      )}
    </div>
  )
}
