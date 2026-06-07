'use client'

import React from 'react'
import {
  CheckCircle2,
  Edit,
  Clock,
  Users,
  TrendingUp,
  ChevronRight,
  Building2,
  FileText,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { Category, CategoryMetadata } from '../types'

export interface ConfirmationPanelProps {
  category: Category
  path: Category[]
  metadata: CategoryMetadata
  onEdit: () => void
  onConfirm: () => void
}

export function ConfirmationPanel({
  category,
  path,
  metadata,
  onEdit,
  onConfirm,
}: ConfirmationPanelProps) {
  const formatResponseTime = (hours: number | null): string => {
    if (hours === null) return 'No disponible'
    if (hours < 1) return '< 1h'
    if (hours === 1) return '1h'
    if (hours < 24) return `${Math.round(hours)}h`
    const days = Math.round(hours / 24)
    return `${days}d`
  }

  return (
    <Card
      className='w-full border border-green-500/20 bg-green-50/30 dark:bg-green-950/10'
      role='region'
      aria-label='Resumen de categoría seleccionada'
    >
      <CardContent className='px-3 py-3 space-y-2'>
        {/* Header: title + category name */}
        <div className='flex items-center gap-2'>
          <CheckCircle2 className='h-4 w-4 text-green-600 flex-shrink-0' aria-hidden='true' />
          <span className='text-sm font-semibold text-green-700 dark:text-green-400'>
            Categoría Seleccionada
          </span>
        </div>

        {/* Category name + description */}
        <div className='flex items-center gap-2'>
          <span
            className='w-3 h-3 rounded-full flex-shrink-0'
            style={{ backgroundColor: category.color }}
            aria-hidden='true'
          />
          <div className='min-w-0'>
            <p className='font-semibold text-sm leading-tight'>{category.name}</p>
            {category.description && (
              <p className='text-xs text-muted-foreground truncate'>{category.description}</p>
            )}
          </div>
        </div>

        {/* Path + Stats in compact grid */}
        <div className='grid grid-cols-1 gap-2'>
          {/* Path */}
          <div>
            <p className='text-xs text-muted-foreground mb-0.5'>Ruta:</p>
            <div className='flex items-center gap-1 flex-wrap'>
              {path.map((cat, index) => (
                <React.Fragment key={cat.id}>
                  {index > 0 && <ChevronRight className='h-2.5 w-2.5 text-muted-foreground' />}
                  <Badge
                    variant={index === path.length - 1 ? 'default' : 'secondary'}
                    className='text-xs px-1 py-0 h-5'
                  >
                    {cat.name}
                  </Badge>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Stats in compact row */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-2 text-xs'>
            <div className='flex flex-col items-start gap-0.5'>
              <p className='text-muted-foreground leading-none'>Depto.</p>
              <p className='font-medium break-words'>{metadata.departmentName}</p>
            </div>

            <div className='flex flex-col items-start gap-0.5'>
              <p className='text-muted-foreground leading-none'>Técnicos</p>
              <p className='font-medium'>{metadata.assignedTechniciansCount}</p>
            </div>

            <div className='flex flex-col items-start gap-0.5'>
              <p className='text-muted-foreground leading-none'>Respuesta</p>
              <p className='font-medium'>{formatResponseTime(metadata.averageResponseTimeHours)}</p>
            </div>

            <div className='flex flex-col items-start gap-0.5'>
              <p className='text-muted-foreground leading-none'>Popularidad</p>
              <p className='font-medium'>{metadata.popularityScore}/100</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className='flex items-center gap-2 pt-1'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onEdit}
            className='flex-1 gap-1.5 h-7 text-xs'
            aria-label='Cambiar la categoría seleccionada'
          >
            <Edit className='h-3 w-3' aria-hidden='true' />
            Cambiar
          </Button>
          <Button
            type='button'
            size='sm'
            onClick={onConfirm}
            className='flex-1 gap-1.5 h-7 text-xs bg-green-600 hover:bg-green-700'
            aria-label='Confirmar la categoría seleccionada y continuar'
          >
            <CheckCircle2 className='h-3 w-3' aria-hidden='true' />
            Confirmar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
