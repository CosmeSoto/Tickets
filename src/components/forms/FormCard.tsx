'use client'

/**
 * FormCard — tarjeta de documento para el feed de usuario
 */

import { Download, FileText, Star } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { FormFeedItem } from './types'
import { getFileEmoji } from './types'

interface FormCardProps {
  form: FormFeedItem
  onClick: () => void
  className?: string
}

export function FormCard({ form, onClick, className }: FormCardProps) {
  const timeAgo = formatDistanceToNow(new Date(form.createdAt), { addSuffix: true, locale: es })

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md py-0',
        form.isFeatured && 'border-primary/40',
        className
      )}
      onClick={onClick}
    >
      <CardContent className='p-4'>
        <div className='flex items-start gap-3'>
          {/* Icono del tipo de archivo */}
          <div className='flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-xl'>
            {getFileEmoji(form.fileType)}
          </div>

          {/* Contenido */}
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-1.5 mb-1 flex-wrap'>
              {form.category && (
                <Badge variant='secondary' className='text-[10px] px-1.5 py-0 h-5'>
                  {form.category.name}
                </Badge>
              )}
              {form.version && (
                <Badge variant='outline' className='text-[10px] px-1.5 py-0 h-5'>
                  v{form.version}
                </Badge>
              )}
              {form.isFeatured && (
                <Badge className='bg-primary/10 text-primary text-[10px] px-1.5 py-0 h-5 gap-0.5'>
                  <Star className='h-2.5 w-2.5' />
                  Destacado
                </Badge>
              )}
              {!form.fileUrl && (
                <Badge
                  variant='outline'
                  className='text-[10px] px-1.5 py-0 h-5 text-muted-foreground'
                >
                  Sin archivo
                </Badge>
              )}
            </div>

            <h4 className='font-semibold text-sm line-clamp-2 break-words'>{form.title}</h4>

            {form.description && (
              <p className='text-xs text-muted-foreground line-clamp-2 mt-0.5 break-words'>
                {form.description}
              </p>
            )}

            {/* Footer */}
            <div className='flex items-center justify-between mt-2 flex-wrap gap-1'>
              <div className='flex items-center gap-1.5 min-w-0'>
                <span className='text-xs text-muted-foreground truncate'>
                  {form.createdBy.name}
                </span>
                <span className='text-[10px] text-muted-foreground flex-shrink-0'>· {timeAgo}</span>
              </div>
              {form.fileUrl && (
                <span className='flex items-center gap-0.5 text-[10px] text-muted-foreground flex-shrink-0'>
                  <Download className='h-3 w-3' />
                  {form._count.form_downloads}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
