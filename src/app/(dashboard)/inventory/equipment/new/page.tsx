'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { AdaptiveAssetForm } from '@/components/inventory/adaptive-asset-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type Family = { id: string; name: string; icon?: string | null; color?: string | null; code: string }
type Warehouse = { id: string; name: string }
type Supplier = { id: string; name: string }

export default function NewEquipmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [families, setFamilies] = useState<Family[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (session?.user?.role === 'CLIENT') router.push('/inventory')
  }, [status, session, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    Promise.all([
      fetch('/api/inventory/families').then(r => r.json()),
      fetch('/api/inventory/warehouses').then(r => r.json()),
      fetch('/api/inventory/suppliers').then(r => r.json()).catch(() => ({ suppliers: [] })),
    ])
      .then(([familiesData, warehousesData, suppliersData]) => {
        setFamilies(familiesData.families ?? [])
        setWarehouses(warehousesData.warehouses ?? [])
        setSuppliers(suppliersData.suppliers ?? suppliersData ?? [])
      })
      .finally(() => setLoadingData(false))
  }, [status])

  const handleSubmit = async (data: Record<string, unknown>, files?: File[]) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Error al guardar', variant: 'destructive' })
        return
      }
      const { equipment } = await res.json()

      // Subir adjuntos si los hay
      if (files && files.length > 0 && equipment?.id) {
        for (const file of files) {
          const fd = new FormData()
          fd.append('file', file)
          await fetch(`/api/inventory/equipment/${equipment.id}/attachments`, { method: 'POST', body: fd })
        }
      }

      toast({ title: 'Equipo registrado', description: 'El activo fue creado exitosamente' })
      router.push('/inventory/equipment')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading' || loadingData) {
    return (
      <RoleDashboardLayout title="Nuevo Activo" subtitle="Cargando...">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session?.user || session.user.role === 'CLIENT') return null

  return (
    <RoleDashboardLayout
      title="Nuevo Activo"
      subtitle="Registra un nuevo activo en el inventario"
    >
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Información del Activo</CardTitle>
            <CardDescription>
              Selecciona la familia del activo para ver los campos correspondientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdaptiveAssetForm
              families={families}
              warehouses={warehouses}
              suppliers={suppliers}
              onSubmit={handleSubmit}
              isLoading={submitting}
            />
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
