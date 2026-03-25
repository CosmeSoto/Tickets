'use client'

import { use, useEffect, useState } from 'react'
import { Building2, CheckCircle, Package, User, Calendar, MapPin, Tag, Info, Loader2, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface EquipmentPublicInfo {
  id: string
  code: string
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
  photoUrl: string | null
  assignment: {
    receiverName: string
    deliveredBy: string
    startDate: string
    endDate: string | null
    type: { label: string; description: string }
  } | null
  verifiedAt: string
}

interface BrandingInfo {
  logoUrl: string | null
  companyName: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EquipmentVerifyPage({ params }: PageProps) {
  const { id } = use(params)
  const [equipment, setEquipment] = useState<EquipmentPublicInfo | null>(null)
  const [branding, setBranding] = useState<BrandingInfo>({ logoUrl: null, companyName: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Cargar branding y equipo en paralelo
    Promise.all([
      fetch(`/api/public/equipment/${id}`).then(r => r.json()),
      fetch('/api/public/landing-page').then(r => r.json()),
    ])
      .then(([equipData, landingData]) => {
        if (equipData.error) {
          setError(equipData.error)
        } else {
          setEquipment(equipData)
        }
        setBranding({
          logoUrl: landingData.content?.companyLogoLightUrl ?? null,
          companyName: landingData.content?.companyName ?? 'Sistema de Tickets',
        })
      })
      .catch(() => setError('No se pudo cargar la información del equipo.'))
      .finally(() => setLoading(false))
  }, [id])

  const statusColor: Record<string, string> = {
    AVAILABLE: 'bg-green-100 text-green-800',
    ASSIGNED: 'bg-blue-100 text-blue-800',
    MAINTENANCE: 'bg-yellow-100 text-yellow-800',
    DAMAGED: 'bg-red-100 text-red-800',
    RETIRED: 'bg-gray-100 text-gray-800',
  }

  const conditionColor: Record<string, string> = {
    NEW: 'bg-emerald-100 text-emerald-800',
    LIKE_NEW: 'bg-green-100 text-green-800',
    GOOD: 'bg-blue-100 text-blue-800',
    FAIR: 'bg-yellow-100 text-yellow-800',
    POOR: 'bg-red-100 text-red-800',
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-500 text-sm">Verificando equipo...</p>
        </div>
      </div>
    )
  }

  if (error || !equipment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-800">Equipo no encontrado</h2>
          <p className="text-gray-500 text-sm">{error ?? 'El equipo que buscas no existe o fue dado de baja.'}</p>
        </div>
      </div>
    )
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con branding */}
      <div className="bg-white border-b shadow-sm px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.companyName} className="h-9 w-auto object-contain" />
            ) : (
              <>
                <Building2 className="h-9 w-9 text-blue-600" />
                {branding.companyName && (
                  <span className="font-semibold text-gray-800 text-sm">{branding.companyName}</span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
            <CheckCircle className="h-3.5 w-3.5" />
            Verificado
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Foto del equipo si existe */}
        {equipment.photoUrl && (
          <div className="rounded-xl overflow-hidden bg-white border shadow-sm">
            <img
              src={equipment.photoUrl}
              alt={`${equipment.brand} ${equipment.model}`}
              className="w-full h-48 object-cover"
            />
          </div>
        )}

        {/* Tarjeta principal */}
        <Card className="shadow-sm border-0 ring-1 ring-gray-200">
          <CardContent className="p-5 space-y-4">
            {/* Nombre del equipo */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  {equipment.brand} {equipment.model}
                </h1>
                <p className="text-sm text-gray-500">{equipment.typeName}</p>
              </div>
            </div>

            <Separator />

            {/* Código y estado */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Código</p>
                <p className="font-mono font-semibold text-gray-800">{equipment.code}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Estado</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[equipment.status] ?? 'bg-gray-100 text-gray-800'}`}>
                  {equipment.statusLabel}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Condición</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${conditionColor[equipment.condition] ?? 'bg-gray-100 text-gray-800'}`}>
                  {equipment.conditionLabel}
                </span>
              </div>
              {equipment.location && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Ubicación</p>
                  <div className="flex items-center gap-1 text-sm text-gray-700">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{equipment.location}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tipo de propiedad */}
        <Card className="shadow-sm border-0 ring-1 ring-gray-200">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-purple-600" />
              <h2 className="font-semibold text-gray-800 text-sm">Tipo de Propiedad</h2>
            </div>
            <div className="bg-purple-50 rounded-lg px-3 py-2.5">
              <p className="font-semibold text-purple-800 text-sm">{equipment.ownershipLabel}</p>
              <p className="text-xs text-purple-600 mt-0.5 leading-relaxed">{equipment.ownershipDescription}</p>
            </div>
          </CardContent>
        </Card>

        {/* Asignación actual */}
        {equipment.assignment ? (
          <Card className="shadow-sm border-0 ring-1 ring-gray-200">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <h2 className="font-semibold text-gray-800 text-sm">Asignación Actual</h2>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Asignado a</span>
                  <span className="text-sm font-semibold text-gray-800">{equipment.assignment.receiverName}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Entregado por</span>
                  <span className="text-sm text-gray-700">{equipment.assignment.deliveredBy}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Fecha de entrega</span>
                  <span className="text-sm text-gray-700">{assignmentStart}</span>
                </div>
                {assignmentEnd && (
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Fecha de devolución</span>
                    <span className="text-sm text-gray-700">{assignmentEnd}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Tipo de asignación */}
              <div className="bg-blue-50 rounded-lg px-3 py-2.5">
                <p className="font-semibold text-blue-800 text-sm">{equipment.assignment.type.label}</p>
                <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">{equipment.assignment.type.description}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm border-0 ring-1 ring-gray-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 text-gray-500">
                <Info className="h-4 w-4 shrink-0" />
                <p className="text-sm">Este equipo no tiene una asignación activa actualmente.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pie de verificación */}
        <div className="text-center pt-2 pb-6 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            <span>Información verificada el {verifiedDate}</span>
          </div>
          <p className="text-xs text-gray-300">{branding.companyName} · Sistema de Inventario</p>
        </div>
      </div>
    </div>
  )
}
