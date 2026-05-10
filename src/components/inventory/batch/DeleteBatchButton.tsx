'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteBatch } from '@/lib/actions/batch-inventory.actions'
import { toast } from 'sonner'

interface DeleteBatchButtonProps {
  batchId: string
  batchCode: string
}

export function DeleteBatchButton({ batchId, batchCode }: DeleteBatchButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setLoading(true)
    try {
      const result = await deleteBatch(batchId)
      if (result.success) {
        toast.success('Lote eliminado correctamente')
        router.push('/inventory')
      } else {
        toast.error(result.error || 'Error al eliminar el lote')
      }
    } catch (error) {
      toast.error('Error inesperado al eliminar el lote')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant='destructive' size='sm' className='flex items-center gap-2'>
          <Trash2 className='w-4 h-4' />
          Eliminar Lote
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar lote {batchCode}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción eliminará el lote y todos sus equipos disponibles. Los equipos asignados no
            pueden eliminarse. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
          >
            {loading ? (
              <>
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                Eliminando...
              </>
            ) : (
              'Eliminar'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
