'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Aviso discreto cuando se restauró un borrador desde sessionStorage. */
export function FormDraftBanner({
  visible,
  onDismiss,
  onDiscard,
}: {
  visible: boolean
  onDismiss: () => void
  onDiscard?: () => void
}) {
  if (!visible) return null
  return (
    <div className='flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm'>
      <div className='flex-1 min-w-0'>
        <p className='font-medium'>Borrador restaurado</p>
        <p className='text-xs text-muted-foreground mt-0.5'>
          Recuperamos lo que estabas llenando en esta pestaña. Los archivos adjuntos no se
          conservan en el borrador.
        </p>
      </div>
      <div className='flex items-center gap-1 shrink-0'>
        {onDiscard && (
          <Button type='button' variant='ghost' size='sm' className='h-7 text-xs' onClick={onDiscard}>
            Descartar
          </Button>
        )}
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='h-7 w-7'
          onClick={onDismiss}
          aria-label='Cerrar aviso'
        >
          <X className='h-3.5 w-3.5' />
        </Button>
      </div>
    </div>
  )
}
