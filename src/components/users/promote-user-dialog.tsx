'use client'

import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { UserCog } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: string; name: string; email: string }
  onSuccess: () => void
}

export function PromoteUserDialog({ open, onOpenChange, user, onSuccess }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handlePromote = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/users/${user.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Promoción simple sin datos adicionales
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          title: 'Usuario promovido',
          description: `${user.name} ahora es técnico`
        })
        onSuccess()
        onOpenChange(false)
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo promover el usuario',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error promoting user:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center space-x-2">
            <UserCog className="h-5 w-5 text-blue-600" />
            <AlertDialogTitle>¿Promover a Técnico?</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                ¿Estás seguro de que deseas promover a <strong>{user.name}</strong> ({user.email}) a técnico?
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900 font-medium mb-2">El usuario podrá:</p>
                <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                  <li>Ver y gestionar tickets asignados</li>
                  <li>Recibir asignaciones automáticas de tickets</li>
                  <li>Acceder al panel de técnico</li>
                  <li>Gestionar sus propias asignaciones</li>
                </ul>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handlePromote} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Promoviendo...' : 'Promover a Técnico'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
