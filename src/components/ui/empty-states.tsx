/**
 * Empty States Components
 * Standardized empty state displays for various scenarios
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Card, CardContent } from './card'
import { 
  Plus,
  Search,
  Inbox,
  FileText,
  Users,
  Settings,
  Filter,
  Database,
  Ticket,
  MessageSquare,
  Paperclip,
  Calendar,
  BarChart3
} from 'lucide-react'

// Base Empty State Props
interface BaseEmptyStateProps {
  title?: string
  description?: string
  className?: string
  actions?: React.ReactNode
}

// Generic Empty State Component
interface EmptyStateDisplayProps extends BaseEmptyStateProps {
  icon?: React.ReactNode
  variant?: 'default' | 'subtle'
}

export const EmptyState: React.FC<EmptyStateDisplayProps> = ({
  title = 'No hay elementos',
  description = 'No se encontraron elementos para mostrar.',
  icon,
  actions,
  variant = 'default',
  className,
}) => {
  const defaultIcon = <Inbox className="h-12 w-12 text-muted-foreground" />
  
  const containerClass = variant === 'subtle' 
    ? 'p-8 text-center'
    : 'p-12 text-center border-2 border-dashed border-border rounded-lg'

  return (
    <div className={cn(containerClass, className)}>
      <div className="flex flex-col items-center">
        <div className="mb-4">
          {icon || defaultIcon}
        </div>
        
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {title}
        </h3>
        
        <p className="text-muted-foreground mb-6 max-w-md">
          {description}
        </p>
        
        {actions && (
          <div className="flex flex-wrap gap-3 justify-center">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

// No Tickets Empty State
interface NoTicketsProps extends BaseEmptyStateProps {
  onCreateTicket?: () => void
  canCreate?: boolean
}

export const NoTickets: React.FC<NoTicketsProps> = ({
  onCreateTicket,
  canCreate = true,
  ...props
}) => {
  return (
    <EmptyState
      title="No hay tickets"
      description="No se han creado tickets aún. Crea tu primer ticket para comenzar."
      icon={<Ticket className="h-12 w-12 text-muted-foreground" />}
      actions={
        canCreate && onCreateTicket ? (
          <Button onClick={onCreateTicket}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Ticket
          </Button>
        ) : undefined
      }
      {...props}
    />
  )
}

// No Search Results
interface NoSearchResultsProps extends BaseEmptyStateProps {
  searchTerm?: string
  onClearSearch?: () => void
}

export const NoSearchResults: React.FC<NoSearchResultsProps> = ({
  searchTerm,
  onClearSearch,
  ...props
}) => {
  return (
    <EmptyState
      title="No se encontraron resultados"
      description={
        searchTerm 
          ? `No se encontraron resultados para "${searchTerm}". Intenta con otros términos de búsqueda.`
          : 'No se encontraron resultados que coincidan con tu búsqueda.'
      }
      icon={<Search className="h-12 w-12 text-muted-foreground" />}
      actions={
        onClearSearch ? (
          <Button variant="outline" onClick={onClearSearch}>
            Limpiar búsqueda
          </Button>
        ) : undefined
      }
      {...props}
    />
  )
}

// No Comments
interface NoCommentsProps extends BaseEmptyStateProps {
  onAddComment?: () => void
}

export const NoComments: React.FC<NoCommentsProps> = ({
  onAddComment,
  ...props
}) => {
  return (
    <EmptyState
      title="No hay comentarios"
      description="Sé el primero en agregar un comentario a este ticket."
      icon={<MessageSquare className="h-12 w-12 text-muted-foreground" />}
      variant="subtle"
      actions={
        onAddComment ? (
          <Button size="sm" onClick={onAddComment}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar comentario
          </Button>
        ) : undefined
      }
      {...props}
    />
  )
}

// No Attachments
interface NoAttachmentsProps extends BaseEmptyStateProps {
  onAddAttachment?: () => void
}

export const NoAttachments: React.FC<NoAttachmentsProps> = ({
  onAddAttachment,
  ...props
}) => {
  return (
    <EmptyState
      title="No hay archivos adjuntos"
      description="No se han subido archivos a este ticket."
      icon={<Paperclip className="h-12 w-12 text-muted-foreground" />}
      variant="subtle"
      actions={
        onAddAttachment ? (
          <Button size="sm" variant="outline" onClick={onAddAttachment}>
            <Plus className="h-4 w-4 mr-2" />
            Subir archivo
          </Button>
        ) : undefined
      }
      {...props}
    />
  )
}

// No Users
interface NoUsersProps extends BaseEmptyStateProps {
  onInviteUser?: () => void
  canInvite?: boolean
}

export const NoUsers: React.FC<NoUsersProps> = ({
  onInviteUser,
  canInvite = true,
  ...props
}) => {
  return (
    <EmptyState
      title="No hay usuarios"
      description="No se han registrado usuarios en el sistema."
      icon={<Users className="h-12 w-12 text-muted-foreground" />}
      actions={
        canInvite && onInviteUser ? (
          <Button onClick={onInviteUser}>
            <Plus className="h-4 w-4 mr-2" />
            Invitar usuario
          </Button>
        ) : undefined
      }
      {...props}
    />
  )
}

// No Data for Reports
interface NoReportDataProps extends BaseEmptyStateProps {
  onRefresh?: () => void
}

export const NoReportData: React.FC<NoReportDataProps> = ({
  onRefresh,
  ...props
}) => {
  return (
    <EmptyState
      title="No hay datos disponibles"
      description="No hay suficientes datos para generar el reporte en el período seleccionado."
      icon={<BarChart3 className="h-12 w-12 text-muted-foreground" />}
      actions={
        onRefresh ? (
          <Button variant="outline" onClick={onRefresh}>
            Actualizar datos
          </Button>
        ) : undefined
      }
      {...props}
    />
  )
}

// No Filter Results
interface NoFilterResultsProps extends BaseEmptyStateProps {
  onClearFilters?: () => void
}

export const NoFilterResults: React.FC<NoFilterResultsProps> = ({
  onClearFilters,
  ...props
}) => {
  return (
    <EmptyState
      title="No hay resultados con estos filtros"
      description="No se encontraron elementos que coincidan con los filtros aplicados."
      icon={<Filter className="h-12 w-12 text-muted-foreground" />}
      actions={
        onClearFilters ? (
          <Button variant="outline" onClick={onClearFilters}>
            Limpiar filtros
          </Button>
        ) : undefined
      }
      {...props}
    />
  )
}

// Database Empty State
interface DatabaseEmptyProps extends BaseEmptyStateProps {
  onSetup?: () => void
}

export const DatabaseEmpty: React.FC<DatabaseEmptyProps> = ({
  onSetup,
  ...props
}) => {
  return (
    <EmptyState
      title="Base de datos vacía"
      description="La base de datos no contiene información. Configura los datos iniciales."
      icon={<Database className="h-12 w-12 text-muted-foreground" />}
      actions={
        onSetup ? (
          <Button onClick={onSetup}>
            <Settings className="h-4 w-4 mr-2" />
            Configurar datos
          </Button>
        ) : undefined
      }
      {...props}
    />
  )
}

// No Activity
interface NoActivityProps extends BaseEmptyStateProps {
  timeframe?: string
}

export const NoActivity: React.FC<NoActivityProps> = ({
  timeframe = 'reciente',
  ...props
}) => {
  return (
    <EmptyState
      title="No hay actividad"
      description={`No se ha registrado actividad ${timeframe} en el sistema.`}
      icon={<Calendar className="h-12 w-12 text-muted-foreground" />}
      variant="subtle"
      {...props}
    />
  )
}

// Card-based Empty State
interface EmptyCardProps extends BaseEmptyStateProps {
  icon?: React.ReactNode
}

export const EmptyCard: React.FC<EmptyCardProps> = ({
  title = 'Sin contenido',
  description = 'No hay información para mostrar.',
  icon,
  actions,
  className,
}) => {
  const defaultIcon = <FileText className="h-8 w-8 text-muted-foreground" />

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center text-center p-8">
        <div className="mb-3">
          {icon || defaultIcon}
        </div>
        
        <h4 className="font-medium text-foreground mb-1">
          {title}
        </h4>
        
        <p className="text-sm text-muted-foreground mb-4">
          {description}
        </p>
        
        {actions && (
          <div className="flex gap-2">
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  )
}