'use client'

import { use, useEffect, useState } from 'react'
import {
  Building2,
  CheckCircle,
  Package,
  User,
  MapPin,
  Tag,
  Info,
  Loader2,
  AlertTriangle,
  Wrench,
  Warehouse,
  StickyNote,
  Ban,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface MaintenanceInfo {
  type: string
  description: string
  date: string
  technicianName: string | null
}

interface DecommissionInfo {
  reason: string
  date: string
}

interface EquipmentPublicInfo {
  id: string
  code: string
  serialNumber: string
  brand: string
  model: string
  typeName: string
  statusLabel: string
  status: string
  condition: string
  conditionLabel: string
  ownershipLabel: string
  ownershipDescription: string
  location: string | null
  physicalLocation: string | null
  warehouseName: string | null
  departmentName: string | null
  accessories: string[]
  specifications: Record<string, string> | null
  notes: string | null
  photoUrl: string | null
  assignment: {
    receiverName: string
    receiverDepartment: string | null
    deliveredBy: string
    startDate: string
    endDate: string | null
    type: { label: string; description: string }
  } | null
  maintenance: MaintenanceInfo | null
  decommission: DecommissionInfo | null
  verifiedAt: string
}

interface BrandingInfo {
  logoUrl: string | null
  companyName: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

const STATUS_CLASS: Record<string, string> = {
  AVAILABLE:   'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  ASSIGNED:    'bg-primary/10 text-primary border-primary/30',
  MAINTENANCE: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  DAMAGED:     'bg-destructive/10 text-destructive border-destructive/30',
  RETIRED:     'bg-muted text-muted-foreground border-border',
}

const CONDITION_CLASS: Record<string, string> = {
  NEW:      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  LIKE_NEW: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  GOOD:     'bg-primary/10 text-primary border-primary/30',
  FAIR:     'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  POOR:     'bg-destructive/10 text-destructive border-destructive/30',
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='space-y-0.5'>
      <p className='text-xs text-muted-foreground uppercase tracking-wide font-medium'>{label}</p>
      <div className='text-sm font-medium text-foreground'>{value}</div>
    </div>
  )
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
      <Icon className='h-3.5 w-3.5' />
      {label}
    </p>
  )
}

export default function EquipmentVerifyPage({ params }: PageProps) {
  const { id } = use(params)
  const [equipment, setEquipment] = useState<EquipmentPublicInfo | null>(null)
  const [branding, setBranding] = useState<BrandingInfo>({ logoUrl: null, companyName: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/public/equipment/${id}`).then(r => r.json()),
      fetch('/api/public/landing-page').then(r => r.json()),
    ])
      .then(([equipData, landingData]) => {
        if (equipData.error) setError(equipData.error)
        else setEquipment(equipData)
        setBranding({
          logoUrl: landingData.content?.companyLogoLightUrl ?? null,
          companyName: landingData.content?.companyName ?? 'Sistema de Inventario',
        })
      })
      .catch(() => setError('No se pudo cargar la información del equipo.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background'>
        <div className='text-center space-y-3'>
          <Loader2 className='h-10 w-10 animate-spin text-primary mx-auto' />
          <p className='text-muted-foreground text-sm'>Verificando equipo...</p>
        </div>
      </div>
    )
  }

  if (error || !equipment) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background px-4'>
        <div className='text-center space-y-4 max-w-sm'>
          <AlertTriangle className='h-12 w-12 text-amber-500 mx-auto' />
          <h2 className='text-xl font-semibold text-foreground'>Equipo no encontrado</h2>
          <p className='text-muted-foreground text-sm'>
            {error ?? 'El equipo que buscas no existe o fue dado de baja.'}
          </p>
        </div>
      </div>
    )
  }

  const { status } = equipment

  const verifiedDate = new Date(equipment.verifiedAt).toLocaleString('es-EC', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  const assignmentStart = equipment.assignment
    ? new Date(equipment.assignment.startDate).toLocaleDateString('es-EC', { dateStyle: 'long' })
    : null

  const assignmentEnd = equipment.assignment?.endDate
    ? new Date(equipment.assignment.endDate).toLocaleDateString('es-EC', { dateStyle: 'long' })
    : null

  const maintenanceDate = equipment.maintenance
    ? new Date(equipment.maintenance.date).toLocaleDateString('es-EC', { dateStyle: 'long' })
    : null

  const decommissionDate = equipment.decommission
    ? new Date(equipment.decommission.date).toLocaleDateString('es-EC', { dateStyle: 'long' })
    : null

  const hasSpecs = equipment.specifications && Object.keys(equipment.specifications).length > 0
  const hasAccessories = equipment.accessories && equipment.accessories.length > 0

  // Ubicación según estado:
  // AVAILABLE / DAMAGED → bodega + ubicación física
  // ASSIGNED            → solo ubicación física (ya no está en bodega)
  // MAINTENANCE         → ubicación física si existe (está con el técnico)
  // RETIRED             → no aplica ubicación
  const showWarehouse = ['AVAILABLE', 'DAMAGED'].includes(status) && !!equipment.warehouseName
  const showPhysicalLocation = status !== 'RETIRED' && !!equipment.physicalLocation
  const showLocation = showWarehouse || showPhysicalLocation

  return (
    <div className='min-h-screen bg-muted/30'>

      {/* Header con branding */}
      <div className='bg-background border-b px-4 py-3 sticky top-0 z-10'>
        <div className='max-w-lg mx-auto flex items-center justify-between'>
          <div className='flex items-center gap-2.5'>
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.companyName} className='h-8 w-auto object-contain' />
            ) : (
              <>
                <Building2 className='h-7 w-7 text-primary' />
                {branding.companyName && (
                  <span className='font-semibold text-foreground text-sm'>{branding.companyName}</span>
                )}
              </>
            )}
          </div>
          <div className='flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30'>
            <CheckCircle className='h-3.5 w-3.5' />
            Verificado
          </div>
        </div>
      </div>

      <div className='max-w-lg mx-auto px-4 py-5 space-y-3'>

        {/* Foto del equipo */}
        {equipment.photoUrl && (
          <div className='rounded-xl overflow-hidden bg-muted border shadow-sm flex items-center justify-center' style={{ minHeight: '200px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={equipment.photoUrl}
              alt={`${equipment.brand} ${equipment.model}`}
              className='w-full max-h-72 object-contain'
            />
          </div>
        )}

        {/* ── Tarjeta principal ── */}
        <Card className='shadow-sm'>
          <CardContent className='p-5 space-y-4'>

            {/* Encabezado */}
            <div className='flex items-start gap-3'>
              <div className='p-2 bg-primary/10 rounded-lg shrink-0'>
                <Package className='h-5 w-5 text-primary' />
              </div>
              <div className='flex-1 min-w-0'>
                <h1 className='text-lg font-bold text-foreground leading-tight'>
                  {equipment.brand} {equipment.model}
                </h1>
                <p className='text-sm text-muted-foreground'>{equipment.typeName}</p>
              </div>
            </div>

            <Separator />

            {/* Identificación — siempre visible */}
            <div className='grid grid-cols-2 gap-x-4 gap-y-3'>
              <InfoRow label='Código' value={<span className='font-mono'>{equipment.code}</span>} />
              <InfoRow label='N° de Serie' value={<span className='font-mono text-xs'>{equipment.serialNumber}</span>} />
              <InfoRow
                label='Estado'
                value={
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CLASS[status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                    {equipment.statusLabel}
                  </span>
                }
              />
              <InfoRow
                label='Condición'
                value={
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CONDITION_CLASS[equipment.condition] ?? 'bg-muted text-muted-foreground border-border'}`}>
                    {equipment.conditionLabel}
                  </span>
                }
              />
              {/* Departamento del equipo — solo cuando NO está asignado */}
              {equipment.departmentName && status !== 'ASSIGNED' && (
                <InfoRow label='Departamento' value={equipment.departmentName} />
              )}
            </div>

            {/* ── Ubicación — lógica por estado ── */}
            {showLocation && (
              <>
                <Separator />
                <div className='space-y-2'>
                  <SectionTitle icon={MapPin} label='Ubicación' />
                  <div className='grid grid-cols-2 gap-x-4 gap-y-2'>
                    {showWarehouse && (
                      <InfoRow
                        label='Bodega'
                        value={
                          <span className='flex items-center gap-1'>
                            <Warehouse className='h-3.5 w-3.5 text-muted-foreground' />
                            {equipment.warehouseName}
                          </span>
                        }
                      />
                    )}
                    {showPhysicalLocation && (
                      <InfoRow label='Ubicación física' value={equipment.physicalLocation!} />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── Accesorios ── */}
            {hasAccessories && (
              <>
                <Separator />
                <div className='space-y-2'>
                  <SectionTitle icon={Tag} label='Accesorios' />
                  <div className='flex flex-wrap gap-1.5'>
                    {equipment.accessories.map((acc, i) => (
                      <span key={i} className='inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border'>
                        {acc}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── Especificaciones técnicas ── */}
            {hasSpecs && (
              <>
                <Separator />
                <div className='space-y-2'>
                  <SectionTitle icon={Wrench} label='Especificaciones técnicas' />
                  <div className='rounded-md border border-border divide-y divide-border text-sm'>
                    {Object.entries(equipment.specifications!).reverse().map(([key, value]) => (
                      <div key={key} className='flex items-center justify-between px-3 py-1.5'>
                        <span className='text-muted-foreground text-xs'>{key}</span>
                        <span className='font-medium text-xs text-right max-w-[55%] truncate'>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── Observaciones ── */}
            {equipment.notes && (
              <>
                <Separator />
                <div className='space-y-1.5'>
                  <SectionTitle icon={StickyNote} label='Observaciones' />
                  <p className='text-sm text-foreground leading-relaxed'>{equipment.notes}</p>
                </div>
              </>
            )}

          </CardContent>
        </Card>

        {/* ── Tipo de propiedad ── */}
        <Card className='shadow-sm'>
          <CardContent className='p-5 space-y-2'>
            <div className='flex items-center gap-2'>
              <Tag className='h-4 w-4 text-muted-foreground' />
              <h2 className='font-semibold text-foreground text-sm'>Tipo de Propiedad</h2>
            </div>
            <div className='bg-muted/60 rounded-lg px-3 py-2.5 border border-border'>
              <p className='font-semibold text-foreground text-sm'>{equipment.ownershipLabel}</p>
              <p className='text-xs text-muted-foreground mt-0.5 leading-relaxed'>{equipment.ownershipDescription}</p>
            </div>
          </CardContent>
        </Card>

        {/* ── ASSIGNED: asignación actual ── */}
        {status === 'ASSIGNED' && equipment.assignment && (
          <Card className='shadow-sm'>
            <CardContent className='p-5 space-y-3'>
              <div className='flex items-center gap-2'>
                <User className='h-4 w-4 text-muted-foreground' />
                <h2 className='font-semibold text-foreground text-sm'>Asignación Actual</h2>
              </div>
              <div className='space-y-2.5'>
                <div className='flex justify-between items-start gap-2'>
                  <span className='text-xs text-muted-foreground uppercase tracking-wide font-medium shrink-0'>Asignado a</span>
                  <div className='text-right'>
                    <p className='text-sm font-semibold text-foreground'>{equipment.assignment.receiverName}</p>
                    {equipment.assignment.receiverDepartment && (
                      <p className='text-xs text-muted-foreground'>{equipment.assignment.receiverDepartment}</p>
                    )}
                  </div>
                </div>
                <div className='flex justify-between items-start gap-2'>
                  <span className='text-xs text-muted-foreground uppercase tracking-wide font-medium shrink-0'>Entregado por</span>
                  <span className='text-sm text-foreground text-right'>{equipment.assignment.deliveredBy}</span>
                </div>
                <div className='flex justify-between items-start gap-2'>
                  <span className='text-xs text-muted-foreground uppercase tracking-wide font-medium shrink-0'>Fecha de entrega</span>
                  <span className='text-sm text-foreground text-right'>{assignmentStart}</span>
                </div>
                {assignmentEnd && (
                  <div className='flex justify-between items-start gap-2'>
                    <span className='text-xs text-muted-foreground uppercase tracking-wide font-medium shrink-0'>Devolución</span>
                    <span className='text-sm text-foreground text-right'>{assignmentEnd}</span>
                  </div>
                )}
              </div>
              <Separator />
              <div className='bg-muted/60 rounded-lg px-3 py-2.5 border border-border'>
                <p className='font-semibold text-foreground text-sm'>{equipment.assignment.type.label}</p>
                <p className='text-xs text-muted-foreground mt-0.5 leading-relaxed'>{equipment.assignment.type.description}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── AVAILABLE: sin asignación ── */}
        {status === 'AVAILABLE' && (
          <Card className='shadow-sm'>
            <CardContent className='p-5'>
              <div className='flex items-center gap-3 text-muted-foreground'>
                <Info className='h-4 w-4 shrink-0' />
                <p className='text-sm'>Este equipo está disponible y no tiene una asignación activa.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── MAINTENANCE: datos del mantenimiento ── */}
        {status === 'MAINTENANCE' && (
          <Card className='shadow-sm border-amber-500/30'>
            <CardContent className='p-5 space-y-3'>
              <div className='flex items-center gap-2'>
                <Wrench className='h-4 w-4 text-amber-600 dark:text-amber-400' />
                <h2 className='font-semibold text-foreground text-sm'>En Mantenimiento</h2>
              </div>
              {equipment.maintenance ? (
                <div className='space-y-2.5'>
                  <div className='flex justify-between items-start gap-2'>
                    <span className='text-xs text-muted-foreground uppercase tracking-wide font-medium shrink-0'>Tipo</span>
                    <span className='text-sm text-foreground text-right'>{equipment.maintenance.type}</span>
                  </div>
                  {equipment.maintenance.technicianName && (
                    <div className='flex justify-between items-start gap-2'>
                      <span className='text-xs text-muted-foreground uppercase tracking-wide font-medium shrink-0'>Técnico</span>
                      <span className='text-sm text-foreground text-right'>{equipment.maintenance.technicianName}</span>
                    </div>
                  )}
                  <div className='flex justify-between items-start gap-2'>
                    <span className='text-xs text-muted-foreground uppercase tracking-wide font-medium shrink-0'>Fecha de ingreso</span>
                    <span className='text-sm text-foreground text-right'>{maintenanceDate}</span>
                  </div>
                  <div className='bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20'>
                    <p className='text-xs text-amber-700 dark:text-amber-400 leading-relaxed'>{equipment.maintenance.description}</p>
                  </div>
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>El equipo se encuentra en proceso de mantenimiento.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── DAMAGED: aviso de daño ── */}
        {status === 'DAMAGED' && (
          <Card className='shadow-sm border-destructive/30'>
            <CardContent className='p-4'>
              <div className='flex items-start gap-3'>
                <AlertCircle className='h-4 w-4 text-destructive shrink-0 mt-0.5' />
                <div>
                  <p className='text-sm font-medium text-foreground'>Equipo dañado</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    Este equipo presenta daños y no está disponible para uso. Contacta al área de TI para más información.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── RETIRED: datos de baja ── */}
        {status === 'RETIRED' && (
          <Card className='shadow-sm border-border'>
            <CardContent className='p-5 space-y-3'>
              <div className='flex items-center gap-2'>
                <Ban className='h-4 w-4 text-muted-foreground' />
                <h2 className='font-semibold text-foreground text-sm'>Equipo Dado de Baja</h2>
              </div>
              {equipment.decommission ? (
                <div className='space-y-2.5'>
                  <div className='flex justify-between items-start gap-2'>
                    <span className='text-xs text-muted-foreground uppercase tracking-wide font-medium shrink-0'>Fecha de baja</span>
                    <span className='text-sm text-foreground text-right'>{decommissionDate}</span>
                  </div>
                  <div className='bg-muted/60 rounded-lg px-3 py-2 border border-border'>
                    <p className='text-xs text-muted-foreground leading-relaxed'>{equipment.decommission.reason}</p>
                  </div>
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>Este equipo fue dado de baja definitivamente y ya no está en uso.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pie */}
        <div className='text-center pt-2 pb-8 space-y-1'>
          <div className='flex items-center justify-center gap-1.5 text-xs text-muted-foreground'>
            <CheckCircle className='h-3.5 w-3.5 text-emerald-500' />
            <span>Verificado el {verifiedDate}</span>
          </div>
          <p className='text-xs text-muted-foreground/50'>{branding.companyName} · Sistema de Inventario</p>
        </div>

      </div>
    </div>
  )
}
