'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Edit, 
  Trash2, 
  Ticket,
  Users,
  FolderTree,
  Folder,
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

import { CategoryData } from '@/hooks/categories/types'

interface CategoryCardProps {
  category: CategoryData
  onEdit: (category: CategoryData) => void
  onDelete: (category: CategoryData) => void
}

const getLevelIcon = (level: number) => {
  switch (level) {
    case 1: return <FolderTree className="h-4 w-4 text-blue-600" />
    case 2: return <Folder className="h-4 w-4 text-green-600" />
    case 3: return <Tag className="h-4 w-4 text-orange-600" />
    case 4: return <Tag className="h-4 w-4 text-red-600" />
    default: return <Folder className="h-4 w-4 text-gray-600" />
  }
}

export function CategoryCard({ category, onEdit, onDelete }: CategoryCardProps) {
  const handleManageTickets = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Redirigir al módulo de tickets filtrado por esta categoría
    window.open(`/admin/tickets?category=${category.id}`, '_blank')
  }

  const handleManageTechnicians = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Redirigir al módulo de técnicos filtrado por esta categoría
    window.open(`/admin/technicians?category=${category.id}`, '_blank')
  }

  const handleManageSubcategories = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Redirigir al módulo de categorías filtrado por esta categoría padre
    window.open(`/admin/categories?parent=${category.id}`, '_blank')
  }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onEdit(category)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className='h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0'
              style={{ backgroundColor: category.color }}
            >
              {getLevelIcon(category.level)}
            </div>
            <div>
              <CardTitle className="text-lg flex items-center space-x-2">
                <span>{category.name}</span>
              </CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant={category.isActive ? 'default' : 'secondary'} className="text-xs">
                  {category.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
                <Badge variant='outline' className="text-xs">
                  {category.levelName}
                </Badge>
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <Edit className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onEdit(category)
              }}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onDelete(category)
              }} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {category.description && (
          <p className='text-sm text-muted-foreground'>{category.description}</p>
        )}

        {category.parent && (
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className='text-xs text-muted-foreground'>
              <strong>Categoría Padre:</strong> {category.parent.name}
            </p>
          </div>
        )}

        {/* Estadísticas */}
        <div className="grid grid-cols-3 gap-3">
          <div 
            className="text-center p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={handleManageTickets}
            title="Click para ver tickets de esta categoría"
          >
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Ticket className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-lg font-bold text-blue-900">{category._count?.tickets || 0}</div>
            <div className="text-xs text-blue-700">Tickets</div>
          </div>
          
          <div 
            className="text-center p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
            onClick={handleManageTechnicians}
            title="Click para ver técnicos asignados"
          >
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Users className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-lg font-bold text-green-900">{category.technician_assignments?.length || 0}</div>
            <div className="text-xs text-green-700">Técnicos</div>
          </div>
          
          <div 
            className="text-center p-3 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors"
            onClick={handleManageSubcategories}
            title="Click para ver subcategorías"
          >
            <div className="flex items-center justify-center space-x-1 mb-1">
              <FolderTree className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-lg font-bold text-purple-900">{category._count?.other_categories || 0}</div>
            <div className="text-xs text-purple-700">Subcategorías</div>
          </div>
        </div>

        {/* Técnicos asignados */}
        {category.technician_assignments && category.technician_assignments.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Técnicos Asignados:</h4>
            <div className="flex flex-wrap gap-1">
              {category.technician_assignments.slice(0, 3).map((assignment) => (
                <Badge
                  key={assignment.id}
                  variant="outline"
                  className="text-xs"
                  title={`${assignment.users.name} - Prioridad: ${assignment.priority}`}
                >
                  {assignment.users.name}
                </Badge>
              ))}
              {category.technician_assignments.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{category.technician_assignments.length - 3} más
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Fecha de creación */}
        <div className="text-xs text-muted-foreground border-t pt-2">
          Nivel {category.level} - {category.levelName}
        </div>
      </CardContent>
    </Card>
  )
}