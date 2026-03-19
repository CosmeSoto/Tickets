'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { EquipmentSummaryWidget } from '@/components/inventory/equipment-summary-widget'
import { EquipmentList } from '@/components/inventory/equipment-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import type { Equipment } from '@/types/inventory/equipment'
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

export default function InventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [canCreate, setCanCreate] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (session?.user?.role === 'CLIENT') {
      router.push('/unauthorized')
      return
    }
    // Verificar permiso de gestión de inventario
    if (session?.user) {
      fetch('/api/inventory/access')
        .then(r => r.json())
        .then(d => setCanCreate(d.canManage === true))
        .catch(() => setCanCreate(session.user!.role === 'ADMIN'))
    }
  }, [status, session, router])

  const handleCreateNew = () => {
    router.push('/inventory/equipment/new')
  }

  const handleDelete = (equipment: Equipment) => {
    setDeleteTarget(equipment)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    try {
      const response = await fetch(`/api/inventory/equipment/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al retirar equipo')
      }

      toast({
        title: 'Equipo retirado',
        description: `El equipo ${deleteTarget.code} ha sido retirado exitosamente`,
      })

      setDeleteTarget(null)
      window.location.reload()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo retirar el equipo',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title="Cargando..." subtitle="Obteniendo información">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session?.user) return null

  return (
    <RoleDashboardLayout
      title="Inventario de Equipos"
      subtitle="Gestiona el inventario de equipos tecnológicos"
      headerActions={
        canCreate ? (
          <Link href="/inventory/equipment/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Equipo
            </Button>
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <EquipmentSummaryWidget userRole={session.user.role} userId={session.user.id} />
        <EquipmentList
          onCreateNew={canCreate ? handleCreateNew : undefined}
          onDelete={session.user.role === 'ADMIN' ? handleDelete : undefined}
        />
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar equipo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas retirar el equipo{' '}
              <span className="font-semibold">{deleteTarget?.code}</span> ({deleteTarget?.brand} {deleteTarget?.model})?
              Esta acción cambiará el estado del equipo a &quot;Retirado&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Retirando...' : 'Sí, retirar equipo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleDashboardLayout>
  )
}
