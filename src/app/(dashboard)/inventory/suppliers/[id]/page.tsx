'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  User,
  Package,
  Wrench,
  Pencil,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SupplierForm } from '@/components/inventory/suppliers/SupplierForm'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'

interface SupplierDetail {
  id: string
  name: string
  taxId: string | null
  email: string | null
  phone: string | null
  address: string | null
  website: string | null
  contactName: string | null
  isActive: boolean
  supplierType: { id: string; name: string } | null
  family: { id: string; name: string; color: string | null; code: string } | null
  _count: {
    equipment: number
    consumables: number
    software_licenses: number
    maintenances: number
  }
}

export default function SupplierDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>
}) {
  const params = use(paramsPromise)
  const router = useRouter()
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)

  const loadSupplier = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/suppliers/${params.id}`)
      if (!res.ok) throw new Error('No encontrado')
      setSupplier(await res.json())
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el proveedor',
        variant: 'destructive',
      })
      router.push('/inventory/suppliers')
    } finally {
      setLoading(false)
    }
  }, [params.id, router, toast])

  useEffect(() => {
    loadSupplier()
  }, [loadSupplier])

  if (loading) {
    return (
      <ModuleLayout title='Proveedor' subtitle='Cargando...' loading>
        <div />
      </ModuleLayout>
    )
  }

  if (!supplier) return null

  const totalAssets =
    supplier._count.equipment + supplier._count.consumables + supplier._count.software_licenses

  return (
    <ModuleLayout
      title={supplier.name}
      subtitle='Detalle del proveedor'
      headerActions={
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={() => router.push('/inventory/suppliers')}>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Volver
          </Button>
          <Button size='sm' onClick={() => setFormOpen(true)}>
            <Pencil className='h-4 w-4 mr-2' />
            Editar
          </Button>
        </div>
      }
    >
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base flex items-center gap-2'>
              <Building2 className='h-4 w-4' />
              Información general
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Estado</span>
              <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                {supplier.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {supplier.supplierType && (
              <div className='flex justify-between gap-4'>
                <span className='text-muted-foreground'>Tipo</span>
                <span>{supplier.supplierType.name}</span>
              </div>
            )}
            {supplier.family && (
              <div className='flex justify-between gap-4'>
                <span className='text-muted-foreground'>Área</span>
                <span className='flex items-center gap-1.5'>
                  {supplier.family.color && (
                    <span
                      className='w-2 h-2 rounded-full'
                      style={{ backgroundColor: supplier.family.color }}
                    />
                  )}
                  {supplier.family.name}
                </span>
              </div>
            )}
            {supplier.taxId && (
              <div className='flex justify-between gap-4'>
                <span className='text-muted-foreground'>RUC / NIT</span>
                <span className='font-mono'>{supplier.taxId}</span>
              </div>
            )}
            {supplier.contactName && (
              <div className='flex items-center gap-2'>
                <User className='h-3.5 w-3.5 text-muted-foreground' />
                {supplier.contactName}
              </div>
            )}
            {supplier.email && (
              <div className='flex items-center gap-2'>
                <Mail className='h-3.5 w-3.5 text-muted-foreground' />
                <a href={`mailto:${supplier.email}`} className='hover:underline'>
                  {supplier.email}
                </a>
              </div>
            )}
            {supplier.phone && (
              <div className='flex items-center gap-2'>
                <Phone className='h-3.5 w-3.5 text-muted-foreground' />
                {supplier.phone}
              </div>
            )}
            {supplier.website && (
              <div className='flex items-center gap-2'>
                <Globe className='h-3.5 w-3.5 text-muted-foreground' />
                <a
                  href={supplier.website}
                  target='_blank'
                  rel='noreferrer'
                  className='hover:underline'
                >
                  {supplier.website}
                </a>
              </div>
            )}
            {supplier.address && (
              <div className='flex items-start gap-2'>
                <MapPin className='h-3.5 w-3.5 text-muted-foreground mt-0.5' />
                <span>{supplier.address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base flex items-center gap-2'>
              <Package className='h-4 w-4' />
              Activos asociados
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='grid grid-cols-2 gap-3'>
              <div className='rounded-lg border p-3 text-center'>
                <p className='text-2xl font-semibold'>{supplier._count.equipment}</p>
                <p className='text-xs text-muted-foreground'>Equipos</p>
              </div>
              <div className='rounded-lg border p-3 text-center'>
                <p className='text-2xl font-semibold'>{supplier._count.consumables}</p>
                <p className='text-xs text-muted-foreground'>Suministros</p>
              </div>
              <div className='rounded-lg border p-3 text-center'>
                <p className='text-2xl font-semibold'>{supplier._count.software_licenses}</p>
                <p className='text-xs text-muted-foreground'>Licencias</p>
              </div>
              <div className='rounded-lg border p-3 text-center'>
                <p className='text-2xl font-semibold'>{totalAssets}</p>
                <p className='text-xs text-muted-foreground'>Total activos</p>
              </div>
            </div>
            {supplier._count.maintenances > 0 && (
              <Button
                variant='outline'
                className='w-full'
                onClick={() => router.push(`/inventory/maintenance?supplierId=${supplier.id}`)}
              >
                <Wrench className='h-4 w-4 mr-2' />
                Ver {supplier._count.maintenances} mantenimiento
                {supplier._count.maintenances !== 1 ? 's' : ''}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className='max-w-2xl' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Editar proveedor</DialogTitle>
          </DialogHeader>
          <SupplierForm
            supplier={supplier}
            onSuccess={() => {
              setFormOpen(false)
              loadSupplier()
            }}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  )
}
