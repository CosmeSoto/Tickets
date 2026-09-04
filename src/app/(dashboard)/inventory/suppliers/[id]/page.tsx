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
  CreditCard,
  Landmark,
  FileText,
  Power,
  PowerOff,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SupplierForm } from '@/components/inventory/suppliers/SupplierForm'
import { SupplierAuditCard } from '@/components/inventory/suppliers/SupplierAuditCard'
import { SupplierEvaluationsCard } from '@/components/inventory/suppliers/SupplierEvaluationsCard'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { useSession } from 'next-auth/react'
import { PAYMENT_METHOD_TYPE_LABELS } from '@/types/contracts'
import {
  SUPPLIER_BANK_ACCOUNT_TYPE_LABELS,
  SUPPLIER_PAYMENT_TERMS_OPTIONS,
} from '@/lib/validations/inventory/supplier'
import type { Supplier } from '@/types/inventory/supplier'

interface SupplierDetail extends Supplier {
  _count: {
    equipment: number
    consumables: number
    software_licenses: number
    maintenances: number
    contracts?: number
  }
}

function termsLabel(days: number | null | undefined) {
  if (days == null) return null
  return SUPPLIER_PAYMENT_TERMS_OPTIONS.find(o => o.value === days)?.label ?? `${days}`
}

export default function SupplierDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>
}) {
  const params = use(paramsPromise)
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || (session?.user as any)?.isSuperAdmin === true
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [togglingActive, setTogglingActive] = useState(false)
  const [auditKey, setAuditKey] = useState(0)

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
  }, [params.id, router])

  useEffect(() => {
    loadSupplier()
  }, [loadSupplier])

  const toggleActive = async (nextActive: boolean) => {
    if (!supplier) return
    setTogglingActive(true)
    try {
      const res = await fetch(`/api/inventory/suppliers/${supplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          title: nextActive ? 'No se puede reactivar' : 'No se puede desactivar',
          description: data.error,
          variant: 'destructive',
        })
        return
      }
      toast({
        title: nextActive ? 'Proveedor reactivado' : 'Proveedor desactivado',
        description: supplier.name,
      })
      setSupplier(prev => (prev ? { ...prev, isActive: nextActive } : prev))
      setAuditKey(k => k + 1)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado del proveedor',
        variant: 'destructive',
      })
    } finally {
      setTogglingActive(false)
    }
  }

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
  const paymentLabel = supplier.preferredPaymentMethod
    ? PAYMENT_METHOD_TYPE_LABELS[
        supplier.preferredPaymentMethod as keyof typeof PAYMENT_METHOD_TYPE_LABELS
      ]
    : null
  const bankTypeLabel = supplier.bankAccountType
    ? SUPPLIER_BANK_ACCOUNT_TYPE_LABELS[
        supplier.bankAccountType as keyof typeof SUPPLIER_BANK_ACCOUNT_TYPE_LABELS
      ]
    : null

  return (
    <ModuleLayout
      title={supplier.name}
      subtitle={supplier.legalName || 'Detalle del proveedor'}
      headerActions={
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' size='sm' onClick={() => router.push('/inventory/suppliers')}>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Volver
          </Button>
          {isAdmin && supplier.isActive && (
            <Button
              variant='outline'
              size='sm'
              disabled={togglingActive}
              onClick={() => toggleActive(false)}
            >
              <PowerOff className='h-4 w-4 mr-2' />
              Desactivar
            </Button>
          )}
          {isAdmin && !supplier.isActive && (
            <Button
              variant='outline'
              size='sm'
              disabled={togglingActive}
              onClick={() => toggleActive(true)}
            >
              <Power className='h-4 w-4 mr-2' />
              Reactivar
            </Button>
          )}
          <Button
            size='sm'
            onClick={() => {
              setFormDirty(false)
              setFormOpen(true)
            }}
          >
            <Pencil className='h-4 w-4 mr-2' />
            Editar
          </Button>
        </div>
      }
    >
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base flex items-center gap-2'>
              <Building2 className='h-4 w-4' />
              Identidad y contacto
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Estado</span>
              <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                {supplier.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {supplier.legalName && (
              <div className='flex justify-between gap-4'>
                <span className='text-muted-foreground'>Razón social</span>
                <span className='text-right'>{supplier.legalName}</span>
              </div>
            )}
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
                  href={
                    supplier.website.startsWith('http')
                      ? supplier.website
                      : `https://${supplier.website}`
                  }
                  target='_blank'
                  rel='noreferrer'
                  className='hover:underline truncate'
                >
                  {supplier.website}
                </a>
              </div>
            )}
            {(supplier.address || supplier.city || supplier.country) && (
              <div className='flex items-start gap-2'>
                <MapPin className='h-3.5 w-3.5 text-muted-foreground mt-0.5' />
                <span>
                  {[supplier.address, supplier.city, supplier.country].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base flex items-center gap-2'>
              <CreditCard className='h-4 w-4' />
              Crédito y pago
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='flex justify-between gap-4'>
              <span className='text-muted-foreground'>Plazo</span>
              <span>{termsLabel(supplier.paymentTermsDays) ?? '—'}</span>
            </div>
            <div className='flex justify-between gap-4'>
              <span className='text-muted-foreground'>Método preferido</span>
              <span>{paymentLabel ?? '—'}</span>
            </div>
            <div className='flex justify-between gap-4'>
              <span className='text-muted-foreground'>Límite de crédito</span>
              <span className='font-mono'>
                {supplier.creditLimit != null
                  ? `${Number(supplier.creditLimit).toLocaleString()} ${supplier.creditCurrency || 'USD'}`
                  : '—'}
              </span>
            </div>
            {supplier.commercialSummary && (
              <div className='rounded-md border p-3 space-y-2 mt-1'>
                <p className='text-xs font-medium'>Referencia vs contratos abiertos</p>
                <div className='flex justify-between gap-4 text-xs'>
                  <span className='text-muted-foreground'>Contratos ACTIVE/EXPIRING</span>
                  <span>{supplier.commercialSummary.openContracts}</span>
                </div>
                <div className='flex justify-between gap-4 text-xs'>
                  <span className='text-muted-foreground'>Compromiso mensual est.</span>
                  <span className='font-mono'>
                    {supplier.commercialSummary.monthlyCommitment.toLocaleString()}{' '}
                    {supplier.commercialSummary.currency}
                  </span>
                </div>
                <div className='flex justify-between gap-4 text-xs'>
                  <span className='text-muted-foreground'>Anualizado (×12)</span>
                  <span className='font-mono'>
                    {supplier.commercialSummary.annualizedCommitment.toLocaleString()}{' '}
                    {supplier.commercialSummary.currency}
                  </span>
                </div>
                <Badge
                  variant={
                    supplier.commercialSummary.referenceStatus === 'high'
                      ? 'destructive'
                      : supplier.commercialSummary.referenceStatus === 'ok'
                        ? 'default'
                        : 'secondary'
                  }
                  className='mt-1'
                >
                  {supplier.commercialSummary.referenceStatus === 'high'
                    ? 'Compromiso alto vs límite'
                    : supplier.commercialSummary.referenceStatus === 'ok'
                      ? 'Dentro de referencia de crédito'
                      : 'Sin límite o monedas mixtas'}
                </Badge>
                <p className='text-[10px] text-muted-foreground leading-snug'>
                  Indicador orientativo (no ledger AP). Compara el compromiso recurrente anualizado
                  con el límite de crédito del maestro.
                </p>
              </div>
            )}
            {(supplier.bankName || supplier.bankAccountNumber) && (
              <div className='rounded-md border p-3 space-y-1.5 mt-2'>
                <p className='text-xs font-medium flex items-center gap-1.5'>
                  <Landmark className='h-3.5 w-3.5' /> Datos bancarios
                </p>
                {supplier.bankName && <p>{supplier.bankName}</p>}
                {bankTypeLabel && <p className='text-xs text-muted-foreground'>{bankTypeLabel}</p>}
                {supplier.bankAccountNumber && (
                  <p className='font-mono text-xs'>{supplier.bankAccountNumber}</p>
                )}
                {supplier.bankSwift && (
                  <p className='text-xs text-muted-foreground'>SWIFT: {supplier.bankSwift}</p>
                )}
              </div>
            )}
            {supplier.notes && (
              <div className='rounded-md border border-dashed p-3 space-y-1'>
                <p className='text-xs font-medium flex items-center gap-1.5'>
                  <FileText className='h-3.5 w-3.5' /> Notas
                </p>
                <p className='text-xs text-muted-foreground whitespace-pre-wrap'>
                  {supplier.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base flex items-center gap-2'>
              <Package className='h-4 w-4' />
              Relación operativa
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
                <p className='text-2xl font-semibold'>{supplier._count.contracts ?? 0}</p>
                <p className='text-xs text-muted-foreground'>Contratos</p>
              </div>
            </div>
            <p className='text-xs text-muted-foreground text-center'>
              {totalAssets} activo{totalAssets !== 1 ? 's' : ''} vinculados
            </p>
            {(supplier._count.contracts ?? 0) > 0 && (
              <Button
                variant='outline'
                className='w-full'
                onClick={() => router.push(`/inventory/contracts?supplierId=${supplier.id}`)}
              >
                Ver contratos del proveedor
              </Button>
            )}
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

      <div className='mt-4'>
        <SupplierEvaluationsCard supplierId={supplier.id} canManage={isAdmin} />
      </div>

      <div className='mt-4'>
        <SupplierAuditCard key={auditKey} supplierId={supplier.id} />
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={open => {
          if (open) {
            setFormOpen(true)
            return
          }
          if (
            formDirty &&
            !window.confirm(
              'Hay cambios sin guardar en el proveedor. ¿Cerrar y descartar lo que estabas llenando?'
            )
          ) {
            return
          }
          setFormDirty(false)
          setFormOpen(false)
        }}
      >
        <DialogContent
          className='w-[min(98vw,56rem)] max-w-4xl max-h-[92vh] overflow-y-auto'
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>Editar proveedor</DialogTitle>
          </DialogHeader>
          <SupplierForm
            supplier={supplier}
            onDirtyChange={setFormDirty}
            onSuccess={() => {
              setFormDirty(false)
              setFormOpen(false)
              loadSupplier()
              setAuditKey(k => k + 1)
            }}
            onCancel={() => {
              if (
                formDirty &&
                !window.confirm(
                  'Hay cambios sin guardar en el proveedor. ¿Cerrar y descartar lo que estabas llenando?'
                )
              ) {
                return
              }
              setFormDirty(false)
              setFormOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  )
}
