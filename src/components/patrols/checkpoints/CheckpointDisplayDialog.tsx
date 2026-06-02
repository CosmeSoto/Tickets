'use client'

import { Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Checkpoint } from './types'

interface CheckpointDisplayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  checkpoint: Checkpoint | null
  onCopyUrl: () => void
}

export function CheckpointDisplayDialog({
  open,
  onOpenChange,
  checkpoint,
  onCopyUrl,
}: CheckpointDisplayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Pantalla de Visualización QR</DialogTitle>
          <DialogDescription>
            Abre esta URL en la pantalla física donde los guardias escanearán el QR.
          </DialogDescription>
        </DialogHeader>

        {checkpoint && (
          <div className='space-y-4 py-2'>
            <div className='space-y-2'>
              <Label className='text-sm'>Checkpoint</Label>
              <p className='font-medium'>{checkpoint.name}</p>
              <p className='text-sm text-muted-foreground'>{checkpoint.location}</p>
            </div>

            <div className='space-y-2'>
              <Label className='text-sm'>URL de la pantalla</Label>
              <div className='flex gap-2'>
                <Input
                  readOnly
                  value={`${window.location.origin}/patrol-checkpoint-display/${checkpoint.id}`}
                  className='font-mono text-xs'
                />
                <Button variant='outline' onClick={onCopyUrl}>
                  <Copy className='h-4 w-4' />
                </Button>
              </div>
            </div>

            <div className='pt-2'>
              <Button
                className='w-full'
                onClick={() => {
                  window.open(`/patrol-checkpoint-display/${checkpoint.id}`, '_blank')
                }}
              >
                <ExternalLink className='h-4 w-4 mr-2' />
                Abrir en nueva pestaña
              </Button>
            </div>

            <div className='p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400'>
              <strong>Nota:</strong> Esta página está diseñada para mostrarse en una pantalla física
              (tableta, monitor, etc.) donde los guardias pueden escanear el QR. Solo los
              administradores pueden acceder a esta configuración.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
