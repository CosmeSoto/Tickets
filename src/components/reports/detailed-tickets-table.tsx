'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  FileText,
  Download,
  Search,
  Star,
  Clock,
  User,
  MessageSquare,
  Paperclip,
  Eye,
} from 'lucide-react'
import Link from 'next/link'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { cn } from '@/lib/utils'

interface DetailedTicket {
  id: string
  title: string
  description: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  resolutionTime: string | null
  client: {
    id: string
    name: string
    email: string
  }
  assignee: {
    id: string
    name: string
    email: string
  } | null
  category: {
    id: string
    name: string
    color: string
  }
  rating: {
    score: number
    comment: string | null
  } | null
  commentsCount: number
  attachmentsCount: number
}

interface DetailedTicketsTableProps {
  tickets: DetailedTicket[]
  onExport?: () => void
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Abierto', color: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-yellow-100 text-yellow-800' },
  RESOLVED: { label: 'Resuelto', color: 'bg-green-100 text-green-800' },
  CLOSED: { label: 'Cerrado', color: 'bg-muted text-foreground' },
  ON_HOLD: { label: 'En Espera', color: 'bg-purple-100 text-purple-800' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Baja', color: 'bg-muted text-foreground' },
  MEDIUM: { label: 'Media', color: 'bg-blue-100 text-blue-800' },
  HIGH: { label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  URGENT: { label: 'Urgente', color: 'bg-red-100 text-red-800' },
}

export function DetailedTicketsTable({ tickets, onExport }: DetailedTicketsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [pageSize, setPageSize] = useState(10)

  // Filtrar tickets solo por búsqueda (los filtros principales ya se aplicaron)
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.assignee?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  // Paginación profesional
  const pagination = useTablePagination(filteredTickets, { pageSize })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderRating = (rating: { score: number; comment: string | null } | null) => {
    if (!rating) {
      return <span className="text-muted-foreground text-sm">Sin calificar</span>
    }

    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`h-3 w-3 ${
              star <= rating.score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="text-sm font-medium ml-1">{rating.score}/5</span>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Detalle de Tickets</span>
            </CardTitle>
            <CardDescription>
              Vista detallada de todos los tickets con información completa
            </CardDescription>
          </div>
          {onExport && (
            <Button onClick={onExport} variant="outline" size="sm" className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
              <Download className="h-4 w-4 mr-2" />
              Exportar Vista Actual
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Búsqueda */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, título, cliente o técnico..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                pagination.resetPage()
              }}
              className="pl-10"
            />
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-600 font-medium">Total</div>
            <div className="text-2xl font-bold text-blue-900">{filteredTickets.length}</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <div className="text-sm text-green-600 font-medium">Resueltos</div>
            <div className="text-2xl font-bold text-green-900">
              {filteredTickets.filter(t => t.status === 'RESOLVED').length}
            </div>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <div className="text-sm text-yellow-600 font-medium">En Progreso</div>
            <div className="text-2xl font-bold text-yellow-900">
              {filteredTickets.filter(t => t.status === 'IN_PROGRESS').length}
            </div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
            <div className="text-sm text-purple-600 font-medium">Calificados</div>
            <div className="text-2xl font-bold text-purple-900">
              {filteredTickets.filter(t => t.rating !== null).length}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="font-semibold">ID</TableHead>
                  <TableHead className="font-semibold">Título</TableHead>
                  <TableHead className="font-semibold">Cliente</TableHead>
                  <TableHead className="font-semibold">Técnico</TableHead>
                  <TableHead className="font-semibold">Categoría</TableHead>
                  <TableHead className="font-semibold">Estado</TableHead>
                  <TableHead className="font-semibold">Prioridad</TableHead>
                  <TableHead className="font-semibold">Tiempo Resolución</TableHead>
                  <TableHead className="font-semibold">Calificación</TableHead>
                  <TableHead className="font-semibold">Actividad</TableHead>
                  <TableHead className="font-semibold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No se encontraron tickets con los filtros aplicados
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.paginatedData.map((ticket) => (
                    <TableRow key={ticket.id} className="hover:bg-muted">
                      <TableCell className="font-mono text-xs">
                        {ticket.id.substring(0, 8)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="font-medium truncate">{ticket.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(ticket.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-sm">{ticket.client.name}</div>
                            <div className="text-xs text-muted-foreground">{ticket.client.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {ticket.assignee ? (
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-blue-400" />
                            <div>
                              <div className="font-medium text-sm">{ticket.assignee.name}</div>
                              <div className="text-xs text-muted-foreground">{ticket.assignee.email}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          style={{ backgroundColor: ticket.category.color + '20', color: ticket.category.color }}
                          className="font-medium"
                        >
                          {ticket.category.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_CONFIG[ticket.status]?.color}>
                          {STATUS_CONFIG[ticket.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={PRIORITY_CONFIG[ticket.priority]?.color}>
                          {PRIORITY_CONFIG[ticket.priority]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ticket.resolutionTime ? (
                          <div className="flex items-center space-x-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>{ticket.resolutionTime}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Pendiente</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {renderRating(ticket.rating)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1 text-sm">
                            <MessageSquare className="h-3 w-3 text-muted-foreground" />
                            <span>{ticket.commentsCount}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-sm">
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                            <span>{ticket.attachmentsCount}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/tickets/${ticket.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Mostrando {pagination.startIndex} a {pagination.endIndex} de {pagination.totalItems} elementos
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                pagination.resetPage()
              }}
              className="px-3 py-1 border border-border rounded text-sm bg-background"
            >
              {[10, 20, 50, 100].map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            
            <button
              onClick={pagination.previousPage}
              disabled={!pagination.hasPreviousPage}
              className={cn(
                "px-3 py-1 border border-border rounded text-sm transition-colors",
                !pagination.hasPreviousPage
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-background hover:bg-muted"
              )}
            >
              Anterior
            </button>
            
            <span className="text-sm">
              Página {pagination.currentPage} de {pagination.totalPages}
            </span>
            
            <button
              onClick={pagination.nextPage}
              disabled={!pagination.hasNextPage}
              className={cn(
                "px-3 py-1 border border-border rounded text-sm transition-colors",
                !pagination.hasNextPage
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-background hover:bg-muted"
              )}
            >
              Siguiente
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
