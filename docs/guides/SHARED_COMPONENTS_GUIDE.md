# 📚 Guía de Componentes Compartidos

Esta guía explica cómo usar los componentes compartidos creados en FASE 2.

---

## 🎨 RoleDashboardLayout

Layout unificado para todos los dashboards del sistema.

### Ubicación
```
src/components/layout/role-dashboard-layout.tsx
```

### Uso Básico

```tsx
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'

export default function MyPage() {
  return (
    <RoleDashboardLayout
      title="Mi Dashboard"
      subtitle="Descripción del dashboard"
    >
      {/* Tu contenido aquí */}
    </RoleDashboardLayout>
  )
}
```

### Props

| Prop | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `children` | `ReactNode` | ✅ | Contenido de la página |
| `title` | `string` | ❌ | Título del header |
| `subtitle` | `string` | ❌ | Subtítulo del header |
| `headerActions` | `ReactNode` | ❌ | Acciones en el header |

### Características

- ✅ Navegación automática según rol del usuario
- ✅ Sidebar responsive
- ✅ User menu con avatar y badge de rol
- ✅ Manejo automático de sesión
- ✅ Redirección si no hay sesión

### Navegación por Rol

**ADMIN**:
- Dashboard, Tickets, Usuarios, Técnicos, Categorías, Departamentos, Reportes, Configuración

**TECHNICIAN**:
- Dashboard, Mis Tickets, Estadísticas, Mis Categorías, Base de Conocimientos, Configuración

**CLIENT**:
- Dashboard, Crear Ticket, Mis Tickets, Notificaciones, Mi Perfil, Ayuda, Configuración

---

## 📊 StatsCard

Tarjetas de estadísticas reutilizables con soporte para tendencias.

### Ubicación
```
src/components/shared/stats-card.tsx
```

### Uso Básico

```tsx
import { StatsCard } from '@/components/shared/stats-card'
import { Ticket } from 'lucide-react'

<StatsCard
  title="Total Tickets"
  value={stats.totalTickets}
  icon={Ticket}
  color="blue"
/>
```

### Props

| Prop | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `title` | `string` | ✅ | Título de la estadística |
| `value` | `string \| number` | ✅ | Valor a mostrar |
| `icon` | `LucideIcon` | ✅ | Icono de Lucide React |
| `color` | `'blue' \| 'green' \| 'purple' \| 'orange' \| 'red' \| 'gray'` | ❌ | Color del tema (default: 'blue') |
| `description` | `string` | ❌ | Descripción adicional |
| `trend` | `TrendObject` | ❌ | Indicador de tendencia |
| `loading` | `boolean` | ❌ | Estado de carga |
| `onClick` | `() => void` | ❌ | Callback al hacer click |

### Objeto Trend

```tsx
{
  value: number        // Porcentaje de cambio (ej: 12, -5)
  label: string        // Etiqueta (ej: "desde el mes pasado")
  isPositive?: boolean // Si es positivo o negativo
}
```

### Ejemplos

#### Con Tendencia Positiva
```tsx
<StatsCard
  title="Total Usuarios"
  value={150}
  icon={Users}
  color="blue"
  trend={{ 
    value: 12, 
    label: 'desde el mes pasado', 
    isPositive: true 
  }}
/>
```

#### Con Tendencia Negativa
```tsx
<StatsCard
  title="Tickets Abiertos"
  value={25}
  icon={AlertCircle}
  color="orange"
  trend={{ 
    value: -5, 
    label: 'desde ayer', 
    isPositive: false 
  }}
/>
```

#### Con Descripción
```tsx
<StatsCard
  title="Tiempo Promedio"
  value="2.5h"
  description="Resolución de tickets"
  icon={Clock}
  color="purple"
/>
```

#### Con Estado de Carga
```tsx
<StatsCard
  title="Total Tickets"
  value={stats.totalTickets}
  icon={Ticket}
  color="green"
  loading={isLoading}
/>
```

#### Con Click Handler
```tsx
<StatsCard
  title="Tickets Urgentes"
  value={5}
  icon={AlertCircle}
  color="red"
  onClick={() => router.push('/admin/tickets?priority=URGENT')}
/>
```

### Colores Disponibles

| Color | Uso Recomendado |
|-------|-----------------|
| `blue` | Información general, totales |
| `green` | Éxito, completados, positivo |
| `purple` | Métricas especiales, tiempo |
| `orange` | Advertencias, pendientes |
| `red` | Urgente, crítico, errores |
| `gray` | Neutral, inactivo |

---

## 🎫 TicketCard

Tarjetas de tickets reutilizables adaptables por rol.

### Ubicación
```
src/components/shared/ticket-card.tsx
```

### Uso Básico

```tsx
import { TicketCard } from '@/components/shared/ticket-card'

<TicketCard
  ticket={ticket}
  role="ADMIN"
  onView={handleView}
  onEdit={handleEdit}
/>
```

### Props

| Prop | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `ticket` | `TicketObject` | ✅ | Objeto del ticket |
| `role` | `'ADMIN' \| 'TECHNICIAN' \| 'CLIENT'` | ❌ | Rol del usuario (default: 'ADMIN') |
| `onView` | `(ticket) => void` | ❌ | Callback al ver ticket |
| `onEdit` | `(ticket) => void` | ❌ | Callback al editar ticket |
| `onDelete` | `(ticket) => void` | ❌ | Callback al eliminar ticket |
| `showActions` | `boolean` | ❌ | Mostrar botones de acción (default: true) |
| `compact` | `boolean` | ❌ | Modo compacto (default: false) |

### Objeto Ticket

```tsx
{
  id: string
  title: string
  description?: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  client?: {
    name: string
    email: string
  }
  assignee?: {
    name: string
    email: string
  } | null
  category: {
    name: string
    color: string
  }
  _count?: {
    comments: number
    attachments: number
  }
}
```

### Ejemplos

#### Uso Básico
```tsx
<TicketCard
  ticket={ticket}
  onView={(t) => router.push(`/admin/tickets/${t.id}`)}
/>
```

#### Con Rol de Técnico
```tsx
<TicketCard
  ticket={ticket}
  role="TECHNICIAN"
  onView={handleView}
  showActions={true}
/>
```

#### Con Rol de Cliente
```tsx
<TicketCard
  ticket={ticket}
  role="CLIENT"
  onView={handleView}
  showActions={false}
/>
```

#### Modo Compacto
```tsx
<TicketCard
  ticket={ticket}
  compact={true}
  onView={handleView}
/>
```

#### Con Todas las Acciones
```tsx
<TicketCard
  ticket={ticket}
  role="ADMIN"
  onView={handleView}
  onEdit={handleEdit}
  onDelete={handleDelete}
  showActions={true}
/>
```

### Características

- ✅ Badges de estado y prioridad
- ✅ Información de cliente (solo ADMIN/TECHNICIAN)
- ✅ Técnico asignado
- ✅ Categoría con color
- ✅ Contador de comentarios y adjuntos
- ✅ Fecha relativa (hace 5min, hace 2h)
- ✅ Acciones contextuales por rol

---

## 🔔 NotificationBell

Sistema completo de notificaciones con polling automático.

### Ubicación
```
src/components/ui/notification-bell.tsx
```

### Uso Básico

```tsx
import { NotificationBell } from '@/components/ui/notification-bell'

<NotificationBell />
```

### Props

| Prop | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `className` | `string` | ❌ | Clases CSS adicionales |

### Características

- ✅ Polling automático cada 30 segundos
- ✅ Contador de notificaciones no leídas
- ✅ Panel desplegable con lista
- ✅ Marcar como leída (individual o todas)
- ✅ Eliminar notificaciones
- ✅ Formato de fecha relativo
- ✅ Colores por tipo (SUCCESS, INFO, WARNING, ERROR)
- ✅ Link a ticket relacionado

### Ejemplo con Clase Personalizada

```tsx
<NotificationBell className="mr-4" />
```

### Integración en Layout

El componente ya está integrado en `RoleDashboardLayout`, no necesitas agregarlo manualmente.

---

## 🎯 Ejemplos Completos

### Dashboard Completo

```tsx
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { StatsCard } from '@/components/shared/stats-card'
import { TicketCard } from '@/components/shared/ticket-card'
import { Users, Ticket, Clock, CheckCircle } from 'lucide-react'

export default function MyDashboard() {
  const { data: session } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTickets: 0,
    openTickets: 0,
    avgTime: '0h'
  })
  const [tickets, setTickets] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Cargar datos
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const response = await fetch('/api/dashboard/stats')
      const data = await response.json()
      setStats(data.stats)
      setTickets(data.tickets)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <RoleDashboardLayout
      title="Mi Dashboard"
      subtitle="Vista general del sistema"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total Usuarios"
          value={stats.totalUsers}
          icon={Users}
          color="blue"
          trend={{ value: 12, label: 'desde el mes pasado', isPositive: true }}
          loading={isLoading}
        />

        <StatsCard
          title="Total Tickets"
          value={stats.totalTickets}
          icon={Ticket}
          color="green"
          loading={isLoading}
        />

        <StatsCard
          title="Tickets Abiertos"
          value={stats.openTickets}
          icon={AlertCircle}
          color="orange"
          loading={isLoading}
        />

        <StatsCard
          title="Tiempo Promedio"
          value={stats.avgTime}
          icon={Clock}
          color="purple"
          description="Resolución de tickets"
          loading={isLoading}
        />
      </div>

      {/* Tickets List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tickets.map(ticket => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            role={session?.user?.role}
            onView={(t) => router.push(`/tickets/${t.id}`)}
          />
        ))}
      </div>
    </RoleDashboardLayout>
  )
}
```

---

## 💡 Mejores Prácticas

### 1. Usa RoleDashboardLayout en todas las páginas
```tsx
// ✅ Correcto
<RoleDashboardLayout title="Mi Página">
  <div>Contenido</div>
</RoleDashboardLayout>

// ❌ Incorrecto
<div>
  <Sidebar />
  <Header />
  <div>Contenido</div>
</div>
```

### 2. Usa StatsCard para todas las estadísticas
```tsx
// ✅ Correcto
<StatsCard
  title="Total"
  value={total}
  icon={Icon}
  color="blue"
/>

// ❌ Incorrecto
<Card>
  <CardHeader>
    <CardTitle>Total</CardTitle>
  </CardHeader>
  <CardContent>{total}</CardContent>
</Card>
```

### 3. Usa TicketCard para listados de tickets
```tsx
// ✅ Correcto
{tickets.map(ticket => (
  <TicketCard
    key={ticket.id}
    ticket={ticket}
    onView={handleView}
  />
))}

// ❌ Incorrecto
{tickets.map(ticket => (
  <Card key={ticket.id}>
    {/* Código personalizado */}
  </Card>
))}
```

### 4. Maneja estados de carga
```tsx
// ✅ Correcto
<StatsCard
  title="Total"
  value={stats.total}
  icon={Icon}
  loading={isLoading}
/>

// ❌ Incorrecto
{isLoading ? (
  <div>Cargando...</div>
) : (
  <StatsCard title="Total" value={stats.total} icon={Icon} />
)}
```

---

## 🚀 Próximos Pasos

1. Refactoriza páginas existentes para usar estos componentes
2. Crea nuevos módulos usando estos componentes
3. Mantén la consistencia en toda la aplicación
4. Documenta cualquier extensión de estos componentes

---

**Última actualización**: 20 de enero de 2026
