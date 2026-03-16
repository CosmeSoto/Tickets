'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Download, FileText, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ActDetailsDisplay } from '@/components/inventory/act-details-display'

interface PageProps {
  params: {
    id: string
  }
}

export default function ActDetailPage({ params }: PageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [act, setAct] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (!session?.user) return

    const fetchAct = async () => {
      try {
        const response = await fetch(`/api/inventory/acts/${params.id}`)
        if (!response.ok) {
          setLoading(false)
          return
        }
        const data = await response.json()
        setAct(data.act)
      } catch (error) {
        console.error('Error fetching act:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAct()
  }, [params.id, session, status, router])

  if (!session?.user) {
    return null
  }

  if (loading) {
    return (
      <RoleDashboardLayout title="Cargando..." subtitle="Obteniendo detalles del acta">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!act) {
    return (
      <RoleDashboardLayout title="Acta no encontrada" subtitle="El acta solicitada no existe">
        <Alert variant="destructive">
          <AlertTitle>Acta no encontrada</AlertTitle>
          <AlertDescription>
            El acta que buscas no existe o no tienes permisos para verla.
          </AlertDescription>
        </Alert>
      </RoleDashboardLayout>
    )
  }

  const userId = session.user.id
  const userRole = session.user.role
  const isDeliverer = act.delivererInfo.id === userId
  const isReceiver = act.receiverInfo.id === userId
  const isAdmin = userRole === 'ADMIN'

  if (!isDeliverer && !isReceiver && !isAdmin) {
    return (
      <RoleDashboardLayout title="Acceso Denegado" subtitle="No tienes permisos">
        <Alert variant="destructive">
          <AlertTitle>Acceso Denegado</AlertTitle>
          <AlertDescription>
            No tienes permisos para ver esta acta de entrega.
          </AlertDescription>
        </Alert>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title="Acta de Entrega"
      subtitle="Detalles completos del acta de entrega de equipo"
      headerActions={
        act.status === 'ACCEPTED' ? (
          <Button 
            variant="outline"
            onClick={() => window.open(`/api/inventory/acts/${act.id}/pdf`, '_blank')}
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar PDF
          </Button>
        ) : undefined
      }
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Información de Acceso */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Tu Rol en esta Acta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {isAdmin && <p className="text-sm">Estás viendo esta acta como <strong>Administrador</strong></p>}
              {isDeliverer && <p className="text-sm">Eres el <strong>Entregador</strong> de este equipo</p>}
              {isReceiver && <p className="text-sm">Eres el <strong>Receptor</strong> de este equipo</p>}
            </div>
          </CardContent>
        </Card>

        {/* Detalles del Acta */}
        <ActDetailsDisplay act={act} showStatus={true} />

        {/* Enlace de Aceptación */}
        {act.status === 'PENDING' && isDeliverer && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Enlace de Aceptación
              </CardTitle>
              <CardDescription>
                Comparte este enlace con el receptor para que acepte el acta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/acts/${act.id}/accept?token=${act.acceptanceToken}`}
                  className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/acts/${act.id}/accept?token=${act.acceptanceToken}`
                    )
                  }}
                >
                  Copiar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Acciones */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => window.history.back()}>
                Volver
              </Button>
              {act.assignment && (
                <Button
                  variant="outline"
                  onClick={() => window.location.href = `/inventory/equipment/${act.assignment.equipmentId}`}
                >
                  Ver Equipo
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
