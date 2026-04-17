'use client'

/**
 * TicketDetailLayout
 *
 * Layout estandarizado para las páginas de detalle de ticket (cliente, técnico, admin).
 * Resuelve de forma centralizada:
 *   - Título completo del ticket (sin truncar, en dos líneas si es necesario)
 *   - Código del ticket como badge discreto
 *   - Estado y prioridad como badges en el subtítulo (sin duplicar en el cuerpo)
 *   - Botón "Volver a Tickets" debajo del header (patrón del sistema)
 *   - Acciones de gestión en el header (solo las que aplican al rol)
 */

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
import { Badge } from '@/components/ui/badge'

interface TicketDetailLayoutProps {
  /** Título completo del ticket */
  title: string
  /** Código legible, ej: TI-2026-0001 */
  ticketCode: string
  /** Config de estado: label + color */
  status: { label: string; color: string }
  /** Config de prioridad: label + color */
  priority: { label: string; color: string }
  /** Acciones del header (Editar, Guardar, Asignar, etc.) — sin botón de volver */
  headerActions?: React.ReactNode
  /** Contenido de la página */
  children: React.ReactNode
  /** Estado de carga */
  loading?: boolean
}

export function TicketDetailLayout({
  title,
  ticketCode,
  status,
  priority,
  headerActions,
  children,
  loading,
}: TicketDetailLayoutProps) {
  return (
    <ModuleLayout
      title={title}
      subtitle={
        <span className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border select-all">
            #{ticketCode}
          </span>
          <Badge className={`text-xs h-5 ${status.color}`}>{status.label}</Badge>
          <Badge className={`text-xs h-5 ${priority.color}`}>{priority.label}</Badge>
        </span>
      }
      headerActions={headerActions}
      loading={loading}
    >
      <BackToTickets />
      {children}
    </ModuleLayout>
  )
}
