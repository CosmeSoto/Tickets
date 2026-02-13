'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface DashboardProps {
  stats?: {
    totalTickets?: number
    openTickets?: number
    closedTickets?: number
    pendingTickets?: number
  }
}

export function Dashboard({ stats }: DashboardProps) {
  const defaultStats = {
    totalTickets: 0,
    openTickets: 0,
    closedTickets: 0,
    pendingTickets: 0,
    ...stats
  }

  const statCards = [
    {
      title: 'Total de Tickets',
      value: defaultStats.totalTickets,
      description: 'Todos los tickets en el sistema',
      color: 'bg-blue-500'
    },
    {
      title: 'Tickets Abiertos',
      value: defaultStats.openTickets,
      description: 'Tickets actualmente abiertos',
      color: 'bg-green-500'
    },
    {
      title: 'Tickets Pendientes',
      value: defaultStats.pendingTickets,
      description: 'Tickets esperando respuesta',
      color: 'bg-yellow-500'
    },
    {
      title: 'Tickets Cerrados',
      value: defaultStats.closedTickets,
      description: 'Tickets resueltos',
      color: 'bg-muted0'
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Resumen general del sistema de tickets
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`w-4 h-4 rounded-full ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>
              Últimas acciones en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Ticket #123 creado</p>
                  <p className="text-xs text-muted-foreground">Hace 2 minutos</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Ticket #122 actualizado</p>
                  <p className="text-xs text-muted-foreground">Hace 5 minutos</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-muted0 rounded-full" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Ticket #121 cerrado</p>
                  <p className="text-xs text-muted-foreground">Hace 10 minutos</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado del Sistema</CardTitle>
            <CardDescription>
              Información del sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Estado del Servidor</span>
                <Badge variant="default" className="bg-green-500">
                  Activo
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Base de Datos</span>
                <Badge variant="default" className="bg-green-500">
                  Conectada
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cache</span>
                <Badge variant="default" className="bg-green-500">
                  Funcionando
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Última Actualización</span>
                <span className="text-xs text-muted-foreground">
                  Hace 1 minuto
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard