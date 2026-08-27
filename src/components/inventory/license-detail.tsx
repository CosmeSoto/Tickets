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
  UserPlus,
  MoreHorizontal,
  StickyNote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TransferFamilyDialog } from './transfer-family-dialog'
import { LinkedCredentialsCard } from '@/components/credentials/linked-credentials-card'
import { LicenseAssignDialog } from '@/components/inventory/license/license-assign-dialog'
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
  assignedToUser?: string | null
  assignedToEquipment?: string | null
  assignedToDepartment?: string | null
  linkedContractId?: string | null
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
  return new Date(d).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

const SCOPE_LABELS: Record<string, string> = {
  Individual: 'Individual',
  Departamento: 'Departamento',
  Empresa: 'Empresa',
  INDIVIDUAL: 'Individual',
  DEPARTMENT: 'Departamento',
  COMPANY: 'Empresa',
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  SOFTWARE: 'Software / SaaS',
  SERVICE_EXTERNAL: 'Servicio externo',
  MAINTENANCE: 'Mantenimiento',
  INSURANCE: 'Seguro',
  SLA: 'SLA',
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <div className='mt-0.5 text-sm font-medium'>{value ?? '—'}</div>
    </div>
  )
}

function renewalBadge(status: NonNullable<LicenseData['renewalAlertStatus']>) {
  const map = {
    ok: {
      label: 'Vigente',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    },
    warning: {
      label: 'Por renovar',
      className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    },
    critical: {
      label: 'Vence pronto',
      className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
    },
    expired: {
      label: 'Vencida',
      className: 'bg-muted text-muted-foreground border-border line-through',
    },
  } as const
  return map[status]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LicenseDetail({ licenseId, userRole, isSuperAdmin = false }: Props) {
  const router = useRouter()
  const { data: session } = useSession()

  const [license, setLicense] = useState<LicenseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [showAssignDialog, setShowAssignDialog] = useState(false)

  const canManageInventory =
    (session?.user as { canManageInventory?: boolean })?.canManageInventory === true
  const isAdmin = userRole === 'ADMIN' || isSuperAdmin
  const canEdit = isAdmin || userRole === 'TECHNICIAN' || canManageInventory
  const canDelete = isAdmin || canManageInventory
  const canTransfer = isAdmin
  const hasCredentials =
    isSuperAdmin || (session?.user as { credentialsEnabled?: boolean })?.credentialsEnabled === true
  /** Vincular/crear propia: basta módulo ON (gestión completa = jerarquía, no creación). */
  const canManageCredentials = hasCredentials

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

  useEffect(() => {
    void loadLicense()
  }, [loadLicense])

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
        <Button variant='outline' size='sm' onClick={() => void loadLicense()}>
          <RefreshCw className='h-3.5 w-3.5 mr-1.5' />
          Reintentar
        </Button>
      </div>
    )
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar la licencia «${license.name}»? Esta acción no se puede deshacer.`))
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
  const isAssigned = Boolean(license.user || license.equipment || license.department)
  const renewal = license.renewalAlertStatus ? renewalBadge(license.renewalAlertStatus) : null
  const hasSecondaryActions = canEdit || canTransfer || canDelete

  return (
    <div className='space-y-6'>
      <button
        type='button'
        onClick={() => router.push('/inventory')}
        className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
      >
        <ArrowLeft className='h-4 w-4' />
        Regresar a Inventario
      </button>

      {/* Header — mismo patrón que equipo */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex items-center gap-3 min-w-0'>
          <Key className='h-6 w-6 shrink-0 text-muted-foreground' />
          <div className='min-w-0'>
            <h1 className='text-lg font-bold truncate'>{license.name}</h1>
            <p className='text-xs text-muted-foreground truncate'>
              {[license.licenseType?.name, currentFamilyName].filter(Boolean).join(' · ') ||
                'Licencia / contrato'}
            </p>
            <div className='flex flex-wrap items-center gap-1.5 mt-1.5'>
              {license.licenseScope && (
                <Badge variant='outline' className='text-xs'>
                  {SCOPE_LABELS[license.licenseScope] ?? license.licenseScope}
                </Badge>
              )}
              {renewal && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${renewal.className}`}
                >
                  {renewal.label !== 'Vigente' && <AlertTriangle className='h-3 w-3' />}
                  {renewal.label}
                </span>
              )}
              {isAssigned ? (
                <Badge
                  variant='secondary'
                  className='text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                >
                  Asignada
                </Badge>
              ) : (
                <Badge variant='secondary' className='text-xs'>
                  Sin asignar
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className='flex items-center gap-2 shrink-0'>
          {canEdit && (
            <Button size='sm' onClick={() => setShowAssignDialog(true)}>
              <UserPlus className='h-4 w-4 mr-1.5' />
              Asignar
            </Button>
          )}
          {hasSecondaryActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size='sm' variant='outline'>
                  <MoreHorizontal className='h-4 w-4' />
                  <span className='sr-only'>Más acciones</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-52'>
                {canEdit && (
                  <DropdownMenuItem
                    onClick={() => router.push(`/inventory/license/${licenseId}/edit`)}
                  >
                    <Pencil className='h-4 w-4 mr-2' />
                    Editar
                  </DropdownMenuItem>
                )}
                {canTransfer && (
                  <DropdownMenuItem onClick={() => setShowTransferDialog(true)}>
                    <ArrowRightLeft className='h-4 w-4 mr-2' />
                    Transferir área
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => void handleDelete()}
                      className='text-destructive focus:text-destructive'
                    >
                      <Trash2 className='h-4 w-4 mr-2' />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Banner renovación */}
      {renewal &&
        (license.renewalAlertStatus === 'warning' ||
          license.renewalAlertStatus === 'critical' ||
          license.renewalAlertStatus === 'expired') && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${renewal.className}`}
          >
            <AlertTriangle className='h-4 w-4 shrink-0 mt-0.5' />
            <div>
              <p className='font-medium'>Estado de renovación: {renewal.label}</p>
              <p className='text-xs opacity-90 mt-0.5'>
                Vencimiento {fmtDate(license.expirationDate)}
                {license.renewalDate ? ` · Renovación ${fmtDate(license.renewalDate)}` : ''}
              </p>
            </div>
          </div>
        )}

      {/* Layout 2/3 + 1/3 como equipo */}
      <div className='grid gap-6 lg:grid-cols-3'>
        <div className='lg:col-span-2 space-y-6'>
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <FileText className='h-4 w-4' />
                Información de la licencia
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-5'>
              <div className='grid grid-cols-2 gap-x-6 gap-y-3'>
                <InfoRow label='Tipo de licencia' value={license.licenseType?.name} />
                <InfoRow label='Área / Familia' value={currentFamilyName} />
                <InfoRow
                  label='Alcance'
                  value={
                    license.licenseScope
                      ? (SCOPE_LABELS[license.licenseScope] ?? license.licenseScope)
                      : '—'
                  }
                />
                <InfoRow
                  label='Tipo contrato'
                  value={
                    license.contractType
                      ? (CONTRACT_TYPE_LABELS[license.contractType] ?? license.contractType)
                      : '—'
                  }
                />
                <InfoRow label='Proveedor' value={license.supplier?.name || '—'} />
                <InfoRow label='N° Factura' value={license.invoiceNumber || '—'} />
                <InfoRow label='N° Orden de compra' value={license.purchaseOrderNumber || '—'} />
                {canEdit && license.key && license.key !== '••••••••' && (
                  <div className='col-span-2'>
                    <InfoRow
                      label='Clave de licencia'
                      value={
                        <code className='rounded bg-muted px-2 py-1 text-xs font-mono break-all'>
                          {license.key}
                        </code>
                      }
                    />
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-3'>
                  <Calendar className='h-3.5 w-3.5' />
                  Fechas y costos
                </p>
                <div className='grid grid-cols-2 gap-x-6 gap-y-3'>
                  <InfoRow label='Fecha de compra' value={fmtDate(license.purchaseDate)} />
                  <InfoRow label='Vencimiento' value={fmtDate(license.expirationDate)} />
                  <InfoRow label='Renovación' value={fmtDate(license.renewalDate)} />
                  <InfoRow
                    label='Costo'
                    value={
                      <span className='inline-flex items-center gap-1'>
                        <DollarSign className='h-3 w-3 text-muted-foreground' />
                        {fmtCurrency(license.cost)}
                      </span>
                    }
                  />
                  <InfoRow
                    label='Costo renovación'
                    value={
                      <span className='inline-flex items-center gap-1'>
                        <DollarSign className='h-3 w-3 text-muted-foreground' />
                        {fmtCurrency(license.renewalCost)}
                      </span>
                    }
                  />
                </div>
              </div>

              {license.customValues && license.customValues.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-3'>
                      <Tag className='h-3.5 w-3.5' />
                      Atributos del tipo
                    </p>
                    <div className='grid grid-cols-2 gap-x-6 gap-y-3'>
                      {license.customValues.map(v => (
                        <InfoRow key={v.fieldName} label={v.fieldName} value={v.fieldValue} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {license.notes && (
                <>
                  <Separator />
                  <div>
                    <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2'>
                      <StickyNote className='h-3.5 w-3.5' />
                      Observaciones
                    </p>
                    <p className='text-sm whitespace-pre-wrap'>{license.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lateral: credenciales + asignación (como QR/asignación en equipo) */}
        <div className='space-y-6'>
          {hasCredentials && (
            <LinkedCredentialsCard
              entity='license'
              entityId={licenseId}
              familyId={currentFamilyId}
              familyName={currentFamilyName}
              canManage={canManageCredentials}
            />
          )}

          <Card>
            <CardHeader className='pb-2'>
              <div className='flex items-center justify-between gap-2'>
                <CardTitle className='text-base flex items-center gap-2'>
                  <User className='h-4 w-4' />
                  Asignación
                </CardTitle>
                {canEdit && (
                  <Button variant='ghost' size='sm' onClick={() => setShowAssignDialog(true)}>
                    {isAssigned ? 'Cambiar' : 'Asignar'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className='space-y-3'>
              <InfoRow
                label='Usuario'
                value={license.user ? (license.user.name ?? license.user.email) : '—'}
              />
              <InfoRow
                label='Equipo'
                value={
                  license.equipment
                    ? `${license.equipment.brand || 'Equipo'} (${license.equipment.code})`
                    : '—'
                }
              />
              <InfoRow label='Departamento' value={license.department?.name || '—'} />
              {!isAssigned && (
                <p className='text-xs text-muted-foreground pt-1'>
                  Sin asignar. Usa «Asignar» para vincular usuario, equipo o departamento según el
                  alcance.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-base flex items-center gap-2'>
                <Building2 className='h-4 w-4' />
                Área
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <InfoRow label='Familia' value={currentFamilyName || '—'} />
              <InfoRow label='Tipo' value={license.licenseType?.name || '—'} />
              <p className='text-xs text-muted-foreground'>
                El área la define el tipo de licencia. Para cambiarla usa «Transferir área».
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <LicenseAssignDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        licenseId={licenseId}
        licenseName={license.name}
        familyId={currentFamilyId}
        contractId={license.linkedContractId}
        currentScope={license.licenseScope}
        currentUserId={license.assignedToUser ?? license.user?.id ?? null}
        currentUser={
          license.user
            ? {
                id: license.user.id,
                name: license.user.name ?? license.user.email,
                email: license.user.email,
              }
            : null
        }
        currentDepartmentId={license.assignedToDepartment ?? license.department?.id ?? null}
        currentEquipmentId={license.assignedToEquipment ?? license.equipment?.id ?? null}
        onAssigned={() => {
          toast({ title: 'Asignación actualizada' })
          void loadLicense()
        }}
      />

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
