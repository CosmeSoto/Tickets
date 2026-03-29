import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { Building2, Package, Tag, User, Calendar, Wrench, AlertTriangle } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  MAINTENANCE: 'En mantenimiento',
  DAMAGED: 'Dañado',
  RETIRED: 'Dado de baja',
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800 border-green-200',
  ASSIGNED: 'bg-blue-100 text-blue-800 border-blue-200',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  DAMAGED: 'bg-red-100 text-red-800 border-red-200',
  RETIRED: 'bg-gray-100 text-gray-800 border-gray-200',
}

const STATUS_DOT: Record<string, string> = {
  AVAILABLE: 'bg-green-500',
  ASSIGNED: 'bg-blue-500',
  MAINTENANCE: 'bg-yellow-500',
  DAMAGED: 'bg-red-500',
  RETIRED: 'bg-gray-500',
}

interface PageProps {
  params: Promise<{ equipmentId: string }>
}

export default async function EquipmentPublicPage({ params }: PageProps) {
  const { equipmentId } = await params

  // Obtener IP del cliente
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown'

  // Consultar equipo con relaciones necesarias
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      type: {
        include: {
          family: true,
        },
      },
      assignments: {
        where: { isActive: true },
        include: {
          receiver: {
            select: { id: true, name: true },
          },
        },
        take: 1,
      },
      maintenanceRecords: {
        where: {
          status: { in: ['SCHEDULED', 'ACCEPTED'] },
        },
        orderBy: { date: 'desc' },
        take: 1,
      },
      attachments: {
        take: 1,
      },
    },
  })

  if (!equipment) {
    notFound()
  }

  // Registrar escaneo en audit_logs (fire-and-forget, no bloquea el render)
  prisma.audit_logs
    .create({
      data: {
        id: randomUUID(),
        action: 'QR_SCAN',
        entityType: 'asset',
        entityId: equipmentId,
        ipAddress: ip,
        details: {
          equipmentCode: equipment.code,
          brand: equipment.brand,
          model: equipment.model,
          status: equipment.status,
        },
      },
    })
    .catch(() => {
      // Silenciar errores de auditoría para no afectar la experiencia del usuario
    })

  const statusLabel = STATUS_LABELS[equipment.status] ?? equipment.status
  const statusColor = STATUS_COLORS[equipment.status] ?? 'bg-gray-100 text-gray-800 border-gray-200'
  const statusDot = STATUS_DOT[equipment.status] ?? 'bg-gray-500'

  const activeAssignment = equipment.assignments[0] ?? null
  const activeMaintenance = equipment.maintenanceRecords[0] ?? null
  const photoUrl = equipment.photoUrl ?? equipment.attachments[0]?.path ?? null

  const familyName = equipment.type?.family?.name ?? null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Building2 className="h-8 w-8 text-blue-600 shrink-0" />
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">Sistema de Gestión de Activos</p>
            <p className="text-xs text-gray-500">Información del equipo</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Foto del equipo */}
        {photoUrl && (
          <div className="rounded-xl overflow-hidden bg-white border shadow-sm">
            <img
              src={photoUrl}
              alt={`${equipment.brand} ${equipment.model}`}
              className="w-full h-52 object-cover"
            />
          </div>
        )}

        {/* Tarjeta principal */}
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
          {/* Nombre */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 rounded-lg shrink-0">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                {equipment.brand} {equipment.model}
              </h1>
              <p className="text-sm text-gray-500">{equipment.type?.name}</p>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Código, marca, modelo, familia */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Código</p>
              <p className="font-mono font-semibold text-gray-800 text-sm">{equipment.code}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Marca</p>
              <p className="text-sm text-gray-800">{equipment.brand}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Modelo</p>
              <p className="text-sm text-gray-800">{equipment.model}</p>
            </div>
            {familyName && (
              <div className="col-span-2 space-y-1">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Familia</p>
                <div className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-gray-400" />
                  <p className="text-sm text-gray-800">{familyName}</p>
                </div>
              </div>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* Estado */}
          <div className="space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Estado</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${statusColor}`}>
              <span className={`h-2 w-2 rounded-full ${statusDot}`} />
              {statusLabel}
            </div>
          </div>
        </div>

        {/* Detalle según estado */}
        {equipment.status === 'ASSIGNED' && activeAssignment && (
          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              <h2 className="font-semibold text-gray-800 text-sm">Asignación actual</h2>
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Asignado a</span>
                <span className="text-sm font-semibold text-gray-800">
                  {activeAssignment.receiver?.name ?? '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 uppercase tracking-wide font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Desde
                </span>
                <span className="text-sm text-gray-700">
                  {new Date(activeAssignment.startDate).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        )}

        {equipment.status === 'MAINTENANCE' && activeMaintenance && (
          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-yellow-600" />
              <h2 className="font-semibold text-gray-800 text-sm">En mantenimiento</h2>
            </div>
            <div className="space-y-2.5">
              {activeMaintenance.description && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Motivo</p>
                  <p className="text-sm text-gray-700">{activeMaintenance.description}</p>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 uppercase tracking-wide font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Inicio
                </span>
                <span className="text-sm text-gray-700">
                  {new Date(activeMaintenance.date).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        )}

        {equipment.status === 'RETIRED' && (
          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-gray-500" />
              <h2 className="font-semibold text-gray-800 text-sm">Equipo retirado</h2>
            </div>
            <p className="text-sm text-gray-600">Este equipo ha sido retirado del inventario.</p>
            {equipment.updatedAt && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 uppercase tracking-wide font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Fecha de baja
                </span>
                <span className="text-sm text-gray-700">
                  {new Date(equipment.updatedAt).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Pie de página */}
        <div className="text-center pt-2 pb-6">
          <p className="text-xs text-gray-400">Sistema de Gestión de Activos · Información pública</p>
        </div>
      </div>
    </div>
  )
}
