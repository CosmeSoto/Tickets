'use client'

import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserCog, Loader2, Info } from 'lucide-react'
import { extractApiError, extractCatchError } from '@/lib/utils/api-error'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    id: string
    name: string
    email: string
  }
  onSuccess: () => void
}

export function PromoteUserDialog({ open, onOpenChange, user, onSuccess }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handlePromote = async () => {
    setLoading(true)
    try {
      // Usar el endpoint estándar de actualización de usuario
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'TECHNICIAN' }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          title: 'Usuario promovido',
          description: `${user.name} ahora es técnico. Configura sus categorías en el módulo de técnicos.`,
          duration: 5000,
        })
        onSuccess()
        onOpenChange(false)
      } else {
        toast({ title: 'Error al promover usuario', description: extractApiError(result), variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error de conexión', description: extractCatchError(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md' aria-describedby={undefined}>
        <DialogHeader>
          <div className='flex items-center space-x-2'>
            <UserCog className='h-5 w-5 text-primary' />
            <DialogTitle>Promover a Técnico</DialogTitle>
          </div>
          <DialogDescription>Convierte este usuario en técnico del sistema</DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <p className='text-sm'>
              ¿Estás seguro de que deseas promover a <strong>{user.name}</strong> ({user.email}) a
              técnico?
            </p>
          </div>

          <Alert>
            <Info className='h-4 w-4' />
            <AlertDescription className='text-sm'>
              <strong>Siguiente paso:</strong> Después de promover, ve al módulo de Técnicos para
              configurar:
              <ul className='list-disc list-inside mt-2 space-y-1 text-xs'>
                <li>Categorías de trabajo</li>
                <li>Niveles de prioridad</li>
                <li>Máximo de tickets</li>
                <li>Asignación automática</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className='bg-muted/50 border rounded-lg p-3'>
            <p className='text-sm font-medium mb-2'>El usuario podrá:</p>
            <ul className='list-disc list-inside text-sm text-muted-foreground space-y-1'>
              <li>Ver y gestionar tickets asignados</li>
              <li>Acceder al panel de técnico</li>
              <li>Recibir asignaciones de tickets</li>
            </ul>
          </div>
        </div>

        <div className='flex justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type='button'
            onClick={handlePromote}
            disabled={loading}
            className='bg-primary hover:bg-primary/90'
          >
            {loading ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Promoviendo...
              </>
            ) : (
              <>
                <UserCog className='h-4 w-4 mr-2' />
                Promover a Técnico
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
