'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  FolderTree, 
  Folder, 
  Tag, 
  Edit, 
  Trash2, 
  Eye,
  Ticket,
  Users
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
import type { ColumnConfig } from '@/types/views'

interface Category {
  id: string
  name: string
  description?: string
  color: string
  level: number
  levelName: string
  isActive: boolean
  parentId?: string
  parent?: {
    id: string
    name: string
    color: string
  }
  _count?: {
    tickets: number
    other_categories: number
  }
  technician_assignments?: Array<{
    id: string
    priority: number
    maxTickets?: number
    autoAssign: boolean
    users: {
      id: string
      name: string
      email: string
    }
  }>
  canDelete?: boolean
}

interface CategoryColumnsProps {
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  onView: (category: Category) => void
}

export function createCategoryColumns({
  onEdit,
  onDelete,
  onView
}: CategoryColumnsProps): ColumnConfig<Category>[] {
  return [
    {
      id: 'category',
      header: 'Categoría',
      accessor: (category) => {
        const getLevelIcon = (level: number) => {
          switch (level) {
            case 1: return <FolderTree className='h-4 w-4' />
            case 2: return <Folder className='h-4 w-4' />
            case 3: return <Tag className='h-4 w-4' />
            case 4: return <Tag className='h-4 w-4' />
            default: return <Folder className='h-4 w-4' />
          }
        }
        
        return (
          <div className="flex items-center space-x-3">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                {getLevelIcon(category.level)}
                <p className="text-sm font-medium text-foreground truncate">
                  {category.name}
                </p>
                <Badge variant={category.isActive ? 'default' : 'secondary'} className="text-xs">
                  {category.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {category.levelName}
                </Badge>
              </div>
              {category.description && (
                <p className="text-xs text-muted-foreground truncate mt-1">
                  {category.description}
                </p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: 'hierarchy',
      header: 'Jerarquía',
      accessor: (category) => (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            Nivel {category.level}
          </div>
          {category.parent && (
            <div className="flex items-center space-x-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: category.parent.color }}
              />
              <span className="text-xs text-muted-foreground">
                {category.parent.name}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'statistics',
      header: 'Estadísticas',
      accessor: (category) => {
        const ticketCount = category._count?.tickets || 0
        const subcategoryCount = category._count?.other_categories || 0
        
        return (
          <div className="space-y-1">
            <div className="flex items-center space-x-1">
              <Ticket className="h-3 w-3 text-blue-600" />
              <span className="text-xs font-medium">
                {ticketCount} tickets
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Folder className="h-3 w-3 text-green-600" />
              <span className="text-xs font-medium">
                {subcategoryCount} subcategorías
              </span>
            </div>
          </div>
        )
      },
    },
    {
      id: 'technicians',
      header: 'Técnicos',
      accessor: (category) => {
        const assignments = category.technician_assignments || []
        
        if (assignments.length === 0) {
          return (
            <span className="text-xs text-muted-foreground">
              Sin asignar
            </span>
          )
        }
        
        return (
          <div className="flex items-center space-x-1">
            <Users className="h-3 w-3 text-purple-600" />
            <span className="text-xs font-medium">
              {assignments.length} técnico{assignments.length !== 1 ? 's' : ''}
            </span>
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      accessor: (category) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menú</span>
              <Eye className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onView(category)}>
              <Eye className="mr-2 h-4 w-4" />
              Ver Detalles
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(category)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(category)}
              disabled={!category.canDelete}
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
export function CategoryCard({ 
  category, 
  onEdit, 
  onDelete, 
  onView 
}: { 
  category: Category
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  onView: (category: Category) => void
}) {
  const ticketCount = category._count?.tickets || 0
  const subcategoryCount = category._count?.other_categories || 0
  const assignments = category.technician_assignments || []

  const getLevelIcon = (level: number) => {
    switch (level) {
      case 1: return <FolderTree className='h-6 w-6' />
      case 2: return <Folder className='h-6 w-6' />
      case 3: return <Tag className='h-6 w-6' />
      case 4: return <Tag className='h-6 w-6' />
      default: return <Folder className='h-6 w-6' />
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(category)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: category.color }}
            >
              {getLevelIcon(category.level)}
            </div>
            <div>
              <CardTitle className="text-lg">{category.name}</CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant={category.isActive ? 'default' : 'secondary'} className="text-xs">
                  {category.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {category.levelName}
                </Badge>
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
                onView(category)
              }}>
                <Eye className="mr-2 h-4 w-4" />
                Ver Detalles
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onEdit(category)
              }}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(category)
                }}
                disabled={!category.canDelete}
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
        {/* Descripción */}
        {category.description && (
          <p className="text-sm text-muted-foreground">
            {category.description}
          </p>
        )}

        {/* Jerarquía */}
        {category.parent && (
          <div className="flex items-center space-x-2 p-2 bg-muted rounded">
            <span className="text-xs text-muted-foreground">Padre:</span>
            <div className="flex items-center space-x-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: category.parent.color }}
              />
              <span className="text-xs font-medium">{category.parent.name}</span>
            </div>
          </div>
        )}

        {/* Estadísticas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Ticket className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-lg font-bold text-blue-900">{ticketCount}</div>
            <div className="text-xs text-blue-700">Tickets</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Folder className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-lg font-bold text-green-900">{subcategoryCount}</div>
            <div className="text-xs text-green-700">Subcategorías</div>
          </div>
        </div>

        {/* Técnicos asignados */}
        {assignments.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>Técnicos Asignados ({assignments.length}):</span>
            </h4>
            <div className="space-y-1">
              {assignments.slice(0, 3).map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{assignment.users.name}</span>
                  <Badge variant="outline" className="text-xs">
                    Prioridad {assignment.priority}
                  </Badge>
                </div>
              ))}
              {assignments.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{assignments.length - 3} más...
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}