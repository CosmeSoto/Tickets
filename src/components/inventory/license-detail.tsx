'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Key,
  Calendar,
  DollarSign,
  Building2,
  User,
  Tag,
  FileText,
  Loader2,
  RefreshCw,
  ArrowRightLeft,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TransferFamilyDialog } from './transfer-family-dialog'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LicenseData {
  id: string
  name: string
  key?: string | null
  cost?: number | null
  notes?: string | null
  licenseScope?: string | null
  contractType?: string | null
  purchaseDate?: string | null
  expirationDate?: string | null
  renewalDate?: string | null
  renewalCost?: number | null
  invoiceNumber?: string | null
  purchaseOrderNumber?: string | null
  customValues?: Array<{ fieldName: string; fieldValue: string }> | null
  renewalAlertStatus?: 'ok' | 'warning' | 'critical' | 'expired' | null
  licenseType?: {
    id: string
    name: string
    familyId?: string | null
    family?: { id: string; name: string } | null
  } | null
  supplier?: { id: string; name: string } | null
  user?: { id: string; name?: string | null; email: string } | null
  equipment?: { id: string; code: string; brand: string } | null
  department?: { id: string; name: string } | null
}

interface Props {
  licenseId: string
  userRole: string
  userId: string
  isSuperAdmin?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fmtCurrency(n: number | null | undefined, symbol = '$') {
  if (n == null) return '—'
  return `${symbol}${new Intl.NumberFormat('es-CL').format(n)}`
}

const SCOPE_LABELS: Record<string, string> = {
  Individual: 'Individual',
  Departamento: 'Departamento',
  Empresa: 'Empresa',
  INDIVIDUAL: 'Individual',
  DEPARTMENT: 'Departamento',
  COMPANY: 'Empresa',
}

const RENEWAL_COLORS: Record<string, string> = {
  ok: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-600 line-through',
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-0.5'>
      <p className='text-xs text-muted-foreground uppercase tracking-wide font-medium'>{label}</p>
      <p className='text-sm text-foreground'>{value ?? '—'}</p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LicenseDetail({ licenseId, userRole, isSuperAdmin = false }: Props) {
  const router = useRouter()
  const { data: session } = useSession()

  const [license, setLicense] = useState<LicenseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTransferDialog, setShowTransferDialog] = useState(false)

  const canManageInventory = (session?.user as { canManageInventory?: boolean })?.canManageInventory === true
  const isAdmin = userRole === 'ADMIN' || isSuperAdmin
  const canEdit = isAdmin || userRole === 'TECHNICIAN' || canManageInventory
  const canDelete = isAdmin || canManageInventory

  const loadLicense = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/licenses/${licenseId}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'No se pudo cargar la licencia')
      }
      setLicense(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [licenseId])

  // Cargar al montar
  useEffect(() => {
    loadLicense()
  }, [loadLicense])

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (error || !license) {
    return (
      <div className='flex flex-col items-center justify-center h-64 gap-3 text-center'>
        <AlertTriangle className='h-8 w-8 text-destructive' />
        <p className='text-sm text-muted-foreground'>{error ?? 'Licencia no encontrada'}</p>
        <Button variant='outline' size='sm' onClick={loadLicense}>
          <RefreshCw className='h-3.5 w-3.5 mr-1.5' />
          Reintentar
        </Button>
      </div>
    )
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm(`¿Eliminar la licencia "${license.name}"? Esta acción no se puede deshacer.`))
      return
    try {
      const res = await fetch(`/api/inventory/licenses/${licenseId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al eliminar')
      toast({ title: 'Licencia eliminada' })
      router.push('/inventory')
    } catch (err) {
      toast({
        title: 'Error al eliminar',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    }
  }

  const currentFamilyId = license.licenseType?.familyId ?? null
  const currentFamilyName = license.licenseType?.family?.name ?? null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className='space-y-6 max-w-4xl mx-auto'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => router.back()}
            className='shrink-0 mt-0.5'
          >
            <ArrowLeft className='h-4 w-4' />
          </Button>
          <div>
            <h1 className='text-xl font-semibold flex items-center gap-2'>
              <Key className='h-5 w-5 text-muted-foreground' />
              {license.name}
            </h1>
            <div className='flex items-center gap-2 mt-1 flex-wrap'>
              {license.licenseType && (
                <Badge variant='secondary' className='text-xs'>
                  {license.licenseType.name}
                </Badge>
              )}
              {license.licenseType?.family && (
                <Badge variant='outline' className='text-xs'>
                  {license.licenseType.family.name}
                </Badge>
              )}
              {license.licenseScope && (
                <Badge variant='outline' className='text-xs'>
                  {SCOPE_LABELS[license.licenseScope] ?? license.licenseScope}
                </Badge>
              )}
              {license.renewalAlertStatus && license.renewalAlertStatus !== 'ok' && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    RENEWAL_COLORS[license.renewalAlertStatus]
                  }`}
                >
                  <AlertTriangle className='h-3 w-3' />
                  {license.renewalAlertStatus === 'expired'
                    ? 'Vencida'
                    : license.renewalAlertStatus === 'critical'
                      ? 'Vence pronto'
                      : 'Por renovar'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Acciones de gestión */}
        {(canEdit || canDelete) && (
          <div className='flex items-center gap-2 shrink-0'>
            {canEdit && (
              <Button
                variant='outline'
                size='sm'
                onClick={() => router.push(`/inventory/license/${licenseId}/edit`)}
              >
                <Pencil className='h-3.5 w-3.5 mr-1.5' />
                Editar
              </Button>
            )}
            {canEdit && (
              <Button
                variant='outline'
                size='sm'
                onClick={() => setShowTransferDialog(true)}
                className='gap-1.5'
              >
                <ArrowRightLeft className='h-3.5 w-3.5' />
                Transferir área
              </Button>
            )}
            {canDelete && (
              <Button
                variant='outline'
                size='sm'
                onClick={handleDelete}
                className='text-destructive hover:text-destructive'
              >
                <Trash2 className='h-3.5 w-3.5' />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Cards de información */}
      <div className='grid gap-4 md:grid-cols-2'>
        {/* Datos principales */}
        <div className='rounded-lg border border-border p-4 space-y-4'>
          <h3 className='text-sm font-semibold flex items-center gap-2'>
            <FileText className='h-4 w-4 text-muted-foreground' />
            Información general
          </h3>
          <div className='grid grid-cols-2 gap-4'>
            <InfoRow label='Tipo contrato' value={license.contractType ?? '—'} />
            <InfoRow
              label='Alcance'
              value={
                license.licenseScope
                  ? (SCOPE_LABELS[license.licenseScope] ?? license.licenseScope)
                  : '—'
              }
            />
            <InfoRow label='Proveedor' value={license.supplier?.name} />
            <InfoRow label='N° Factura' value={license.invoiceNumber} />
            <InfoRow label='N° Orden compra' value={license.purchaseOrderNumber} />
          </div>
          {license.notes && (
            <div className='pt-1 border-t border-border'>
              <p className='text-xs text-muted-foreground mb-1 uppercase tracking-wide'>Notas</p>
              <p className='text-sm text-foreground'>{license.notes}</p>
            </div>
          )}
        </div>

        {/* Fechas y costos */}
        <div className='rounded-lg border border-border p-4 space-y-4'>
          <h3 className='text-sm font-semibold flex items-center gap-2'>
            <Calendar className='h-4 w-4 text-muted-foreground' />
            Fechas y costos
          </h3>
          <div className='grid grid-cols-2 gap-4'>
            <InfoRow label='Fecha compra' value={fmtDate(license.purchaseDate)} />
            <InfoRow label='Vencimiento' value={fmtDate(license.expirationDate)} />
            <InfoRow label='Renovación' value={fmtDate(license.renewalDate)} />
            <InfoRow
              label='Costo'
              value={
                <span className='flex items-center gap-1'>
                  <DollarSign className='h-3 w-3 text-muted-foreground' />
                  {fmtCurrency(license.cost)}
                </span>
              }
            />
            <InfoRow
              label='Costo renovación'
              value={
                <span className='flex items-center gap-1'>
                  <DollarSign className='h-3 w-3 text-muted-foreground' />
                  {fmtCurrency(license.renewalCost)}
                </span>
              }
            />
          </div>
        </div>

        {/* Asignación */}
        <div className='rounded-lg border border-border p-4 space-y-4'>
          <h3 className='text-sm font-semibold flex items-center gap-2'>
            <User className='h-4 w-4 text-muted-foreground' />
            Asignación
          </h3>
          <div className='grid grid-cols-2 gap-4'>
            <InfoRow
              label='Usuario'
              value={license.user ? (license.user.name ?? license.user.email) : '—'}
            />
            <InfoRow
              label='Equipo'
              value={
                license.equipment ? `${license.equipment.brand} (${license.equipment.code})` : '—'
              }
            />
            <InfoRow label='Departamento' value={license.department?.name} />
          </div>
        </div>

        {/* Área */}
        <div className='rounded-lg border border-border p-4 space-y-4'>
          <h3 className='text-sm font-semibold flex items-center gap-2'>
            <Building2 className='h-4 w-4 text-muted-foreground' />
            Área
          </h3>
          <div className='grid grid-cols-2 gap-4'>
            <InfoRow label='Tipo de licencia' value={license.licenseType?.name} />
            <InfoRow label='Área / Familia' value={currentFamilyName ?? '—'} />
          </div>
        </div>
      </div>

      {/* Clave de licencia — solo admin */}
      {isAdmin && license.key && (
        <div className='rounded-lg border border-border p-4'>
          <h3 className='text-sm font-semibold flex items-center gap-2 mb-3'>
            <Key className='h-4 w-4 text-muted-foreground' />
            Clave de licencia
          </h3>
          <code className='block rounded bg-muted px-3 py-2 text-sm font-mono break-all'>
            {license.key}
          </code>
        </div>
      )}

      {/* Atributos personalizados */}
      {license.customValues && license.customValues.length > 0 && (
        <div className='rounded-lg border border-border p-4'>
          <h3 className='text-sm font-semibold flex items-center gap-2 mb-3'>
            <Tag className='h-4 w-4 text-muted-foreground' />
            Atributos personalizados
          </h3>
          <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
            {license.customValues.map(v => (
              <InfoRow key={v.fieldName} label={v.fieldName} value={v.fieldValue} />
            ))}
          </div>
        </div>
      )}

      {/* TransferFamilyDialog */}
      <TransferFamilyDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        assetId={licenseId}
        assetKind='LICENSE'
        assetLabel={license.name}
        currentFamilyId={currentFamilyId}
        currentFamilyName={currentFamilyName}
        onSuccess={loadLicense}
      />
    </div>
  )
}
