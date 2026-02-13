'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  UserCheck, 
  UserX, 
  Mail, 
  Phone, 
  Building, 
  Edit, 
  Trash2, 
  Eye,
  Users,
  Tag
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Column } from '@/components/ui/data-table'
import type { Technician } from '@/types/technicians'

interface TechnicianColumnsProps {
  onEdit: (technician: Technician) => void
  onDelete: (technician: Technician) => void
  onDemote: (technician: Technician) => void
  onViewAssignments: (technician: Technician) => void
}

export function createTechnicianColumns({
  onEdit,
  onDelete,
  onDemote,
  onViewAssignments
}: TechnicianColumnsProps): Column<Technician>[] {
  return [
    {
      key: 'name',
      label: 'Técnico',
      render: (technician: Technician) => (
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            {technician.isActive ? (
              <UserCheck className="h-5 w-5 text-green-600" />
            ) : (
              <UserX className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium text-foreground truncate">
                {technician.name}
              </p>
              <Badge variant={technician.isActive ? 'default' : 'secondary'} className="text-xs">
                {technician.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <div className="flex items-center space-x-1 mt-1">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground truncate">
                {technician.email}
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contacto',
      render: (technician: Technician) => (
        <div className="space-y-1">
          {technician.phone && (
            <div className="flex items-center space-x-1">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {technician.phone}
              </span>
            </div>
          )}
          {technician.department && (
            <Badge 
              variant="outline" 
              className="text-xs"
              style={{ 
                borderColor: technician.department.color,
                color: technician.department.color
              }}
            >
              <Building className="h-3 w-3 mr-1" />
              {technician.department.name}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'workload',
      label: 'Carga de Trabajo',
      render: (technician: Technician) => {
        const assignedTickets = technician._count?.assignedTickets || 0
        const assignments = technician._count?.technicianAssignments || 0
        
        return (
          <div className="space-y-1">
            <div className="flex items-center space-x-1">
              <Users className="h-3 w-3 text-blue-600" />
              <span className="text-xs font-medium">
                {assignedTickets} tickets
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Tag className="h-3 w-3 text-purple-600" />
              <span className="text-xs font-medium">
                {assignments} categorías
              </span>
            </div>
          </div>
        )
      },
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (technician: Technician) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menú</span>
              <Eye className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onViewAssignments(technician)}>
              <Eye className="mr-2 h-4 w-4" />
              Ver Asignaciones
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(technician)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDemote(technician)}
              className="text-orange-600"
            >
              <UserX className="mr-2 h-4 w-4" />
              Convertir a Cliente
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(technician)}
              disabled={!technician.canDelete}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}

// Componente de tarjeta para vista de tarjetas
export function TechnicianCard({ 
  technician, 
  onEdit, 
  onDelete, 
  onDemote, 
  onViewAssignments 
}: { 
  technician: Technician
  onEdit: (technician: Technician) => void
  onDelete: (technician: Technician) => void
  onDemote: (technician: Technician) => void
  onViewAssignments: (technician: Technician) => void
}) {
  const assignedTickets = technician._count?.assignedTickets || 0
  const assignments = technician._count?.technicianAssignments || 0
  const specialties = technician.technicianAssignments || []

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onEdit(technician)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {technician.isActive ? (
                <UserCheck className="h-6 w-6 text-green-600" />
              ) : (
                <UserX className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">{technician.name}</CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant={technician.isActive ? 'default' : 'secondary'} className="text-xs">
                  {technician.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
                {technician.department && (
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                    style={{ 
                      borderColor: technician.department.color,
                      color: technician.department.color
                    }}
                  >
                    {technician.department.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <Eye className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onViewAssignments(technician)
              }}>
                <Eye className="mr-2 h-4 w-4" />
                Ver Asignaciones
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onEdit(technician)
              }}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation()
                  onDemote(technician)
                }}
                className="text-orange-600"
              >
                <UserX className="mr-2 h-4 w-4" />
                Convertir a Cliente
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(technician)
                }}
                disabled={!technician.canDelete}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Información de contacto */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{technician.email}</span>
          </div>
          {technician.phone && (
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{technician.phone}</span>
            </div>
          )}
        </div>

        {/* Estadísticas de carga de trabajo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-lg font-bold text-blue-900">{assignedTickets}</div>
            <div className="text-xs text-blue-700">Tickets Asignados</div>
          </div>
          
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Tag className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-lg font-bold text-purple-900">{assignments}</div>
            <div className="text-xs text-purple-700">Categorías Especializadas</div>
          </div>
        </div>

        {/* Especialidades */}
        {specialties.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Especialidades:</h4>
            <div className="flex flex-wrap gap-1">
              {specialties.slice(0, 3).map((assignment) => (
                <Badge
                  key={assignment.id}
                  variant="outline"
                  className="text-xs"
                  style={{
                    borderColor: assignment.category.color,
                    color: assignment.category.color
                  }}
                >
                  {assignment.category.name}
                </Badge>
              ))}
              {specialties.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{specialties.length - 3} más
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Fecha de creación */}
        <div className="text-xs text-muted-foreground border-t pt-2">
          Técnico desde: {new Date(technician.createdAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          })}
        </div>
      </CardContent>
    </Card>
  )
}