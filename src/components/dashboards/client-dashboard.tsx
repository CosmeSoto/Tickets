'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Package, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { NewsFeed } from '@/components/news'
import { useUserModules } from '@/hooks/use-user-modules'

interface ClientStats {
  assignedEquipment: number
  pendingRequests: number
  openTickets: number
  notifications: number
}

interface AssignedEquipment {
  id: string
  code: string
  brand: string
  model: string
  familyName: string
  assignedAt: string
}

export function ClientDashboard({ userId }: { userId: string }) {
  // Fuente fresca desde DB (no JWT), mismo criterio que el sidebar
  const { canRequestAssets } = useUserModules()

  const [stats, setStats] = useState<ClientStats>({
    assignedEquipment: 0,
    pendingRequests: 0,
    openTickets: 0,
    notifications: 0,
  })
  const [recentEquipment, setRecentEquipment] = useState<AssignedEquipment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [userId])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      // Cargar estadísticas
      const [equipmentRes, requestsRes, ticketsRes] = await Promise.all([
        fetch('/api/inventory/equipment?status=ASSIGNED&limit=5'),
        fetch('/api/inventory/asset-requests?status=PENDING'),
        fetch('/api/tickets?status=OPEN&status=IN_PROGRESS'),
      ])

      if (equipmentRes.ok) {
        const equipmentData = await equipmentRes.json()
        setStats(prev => ({ ...prev, assignedEquipment: equipmentData.total || 0 }))
        setRecentEquipment(equipmentData.equipment || [])
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        setStats(prev => ({ ...prev, pendingRequests: requestsData.total || 0 }))
      }

      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json()
        setStats(prev => ({ ...prev, openTickets: ticketsData.total || 0 }))
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error)
      toast.error('Error al cargar datos del dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold'>Mi Dashboard</h1>
        <p className='text-muted-foreground'>
          Bienvenido, aquí puedes ver tus equipos y solicitudes
        </p>
      </div>

      {/* Noticias y Comunicados */}
      <NewsFeed />

      {/* Estadísticas */}
      <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-${canRequestAssets ? '4' : '3'}`}>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Equipos Asignados</CardTitle>
            <Package className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.assignedEquipment}</div>
            <p className='text-xs text-muted-foreground'>Equipos actualmente en tu poder</p>
          </CardContent>
        </Card>

        {canRequestAssets && (
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Solicitudes Pendientes</CardTitle>
              <Clock className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.pendingRequests}</div>
              <p className='text-xs text-muted-foreground'>Solicitudes en proceso</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Tickets Abiertos</CardTitle>
            <AlertCircle className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.openTickets}</div>
            <p className='text-xs text-muted-foreground'>Tickets sin resolver</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Notificaciones</CardTitle>
            <CheckCircle className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.notifications}</div>
            <p className='text-xs text-muted-foreground'>Mensajes sin leer</p>
          </CardContent>
        </Card>
      </div>

      {/* Acciones Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Accede rápidamente a las funciones más usadas</CardDescription>
        </CardHeader>
        <CardContent className={`grid gap-4 md:grid-cols-${canRequestAssets ? '3' : '2'}`}>
          {canRequestAssets && (
            <Link href='/inventory/asset-requests/create'>
              <Button className='w-full' variant='outline'>
                <FileText className='mr-2 h-4 w-4' />
                Nueva Solicitud
              </Button>
            </Link>
          )}
          <Link href='/client/create-ticket'>
            <Button className='w-full' variant='outline'>
              <AlertCircle className='mr-2 h-4 w-4' />
              Crear Ticket
            </Button>
          </Link>
          {canRequestAssets && (
            <Link href='/inventory/asset-requests'>
              <Button className='w-full' variant='outline'>
                <Clock className='mr-2 h-4 w-4' />
                Mis Solicitudes
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Equipos Asignados Recientes */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Mis Equipos</CardTitle>
              <CardDescription>Equipos actualmente asignados a ti</CardDescription>
            </div>
            <Link href='/inventory/equipment'>
              <Button variant='outline' size='sm'>
                Ver Todos
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className='text-sm text-muted-foreground'>Cargando...</p>
          ) : recentEquipment.length === 0 ? (
            <p className='text-sm text-muted-foreground'>No tienes equipos asignados actualmente</p>
          ) : (
            <div className='space-y-4'>
              {recentEquipment.map(equipment => (
                <div
                  key={equipment.id}
                  className='flex items-center justify-between border-b pb-4 last:border-0 last:pb-0'
                >
                  <div>
                    <p className='font-medium'>{equipment.code}</p>
                    <p className='text-sm text-muted-foreground'>
                      {equipment.brand} {equipment.model}
                    </p>
                  </div>
                  <Link href={`/inventory/equipment/${equipment.id}`}>
                    <Button variant='ghost' size='sm'>
                      Ver Detalle
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
