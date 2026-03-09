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
        <div className="flex items-center space-x-2 min-w-0">
          <div className="flex-shrink-0">
            {technician.isActive ? (
              <UserCheck className="h-4 w-4 text-green-600" />
            ) : (
              <UserX className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1.5">
              <p className="text-sm font-medium text-foreground truncate">
                {technician.name}
              </p>
              <Badge variant={technician.isActive ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
                {technician.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <div className="flex items-center space-x-1 mt-0.5">
              <Mail className="h-2.5 w-2.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground truncate">
                {technician.email}
              </p>
            </div>
          </div>
        </div>
      ),
      width: '250px'
    },
    {
      key: 'contact',
      label: 'Contacto',
      render: (technician: Technician) => (
        <div className="space-y-1">
          {technician.phone ? (
            <div className="flex items-center space-x-1">
              <Phone className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {technician.phone}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
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
              <Building className="h-2.5 w-2.5 mr-1" />
              {technician.department.name}
            </Badge>
          )}
        </div>
      ),
      width: '140px'
    },
    {
      key: 'workload',
      label: 'Carga',
      render: (technician: Technician) => {
        const assignedTickets = technician._count?.assignedTickets || 0
        const assignments = technician._count?.technicianAssignments || 0
        
        return (
          <div className="space-y-0.5">
            <div className="flex items-center space-x-1">
              <Users className="h-2.5 w-2.5 text-blue-600" />
              <span className="text-xs font-medium">
                {assignedTickets}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Tag className="h-2.5 w-2.5 text-purple-600" />
              <span className="text-xs font-medium">
                {assignments}
              </span>
            </div>
          </div>
        )
      },
      width: '80px'
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (technician: Technician) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="h-7 w-7 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="sr-only">Abrir menú</span>
              <Eye className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation()
              onViewAssignments(technician)
            }}>
              <Eye className="mr-2 h-4 w-4" />
              Ver Asignaciones
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation()
              onEdit(technician)
            }}>
              <Edit className="mr-2 h-4 w-4" />
              Editar Técnico
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation()
                onDemote(technician)
              }}
              className="text-orange-600 focus:text-orange-700 focus:bg-orange-50"
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
              className="text-red-600 focus:text-red-700 focus:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      width: '70px'
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
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onViewAssignments(technician)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="flex-shrink-0">
              {technician.isActive ? (
                <UserCheck className="h-5 w-5 text-green-600" />
              ) : (
                <UserX className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">{technician.name}</CardTitle>
              <div className="flex items-center space-x-1.5 mt-1">
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
              <Button variant="ghost" className="h-7 w-7 p-0">
                <Eye className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onViewAssignments(technician)
              }}>
                <Eye className="mr-2 h-4 w-4" />
                Ver Asignaciones
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onEdit(technician)
              }}>
                <Edit className="mr-2 h-4 w-4" />
                Editar Técnico
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation()
                  onDemote(technician)
                }}
                className="text-orange-600 focus:text-orange-700 focus:bg-orange-50"
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
                className="text-red-600 focus:text-red-700 focus:bg-red-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Información de contacto */}
        <div className="space-y-1.5">
          <div className="flex items-center space-x-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{technician.email}</span>
          </div>
          {technician.phone && (
            <div className="flex items-center space-x-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{technician.phone}</span>
            </div>
          )}
        </div>

        {/* Estadísticas de carga de trabajo */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2.5 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div className="text-base font-bold text-blue-900">{assignedTickets}</div>
            <div className="text-xs text-blue-700">Tickets</div>
          </div>
          
          <div className="text-center p-2.5 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Tag className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div className="text-base font-bold text-purple-900">{assignments}</div>
            <div className="text-xs text-purple-700">Categorías</div>
          </div>
        </div>

        {/* Especialidades */}
        {specialties.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-foreground mb-1.5">Especialidades:</h4>
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
                  +{specialties.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Fecha de creación */}
        <div className="text-xs text-muted-foreground border-t pt-2">
          Desde: {new Date(technician.createdAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })}
        </div>
      </CardContent>
    </Card>
  )
}