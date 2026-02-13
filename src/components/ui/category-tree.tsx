'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { 
  ChevronRight, 
  ChevronDown, 
  FolderTree, 
  Folder, 
  Tag, 
  Edit, 
  Trash2, 
  Users,
  Ticket
} from 'lucide-react'
import { Badge } from './badge'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  name: string
  description?: string
  color: string
  level: number
  levelName: string
  isActive: boolean
  canDelete: boolean
  parent?: {
    id: string
    name: string
    color: string
    level: number
  }
  children: {
    id: string
    name: string
    color: string
    level: number
    isActive: boolean
  }[]
  _count: {
    tickets: number
    other_categories: number
  }
  assignedTechnicians: {
    id: string
    name: string
    email: string
    priority: number
    maxTickets?: number
    autoAssign: boolean
  }[]
}

interface CategoryTreeProps {
  categories: Category[]
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  searchTerm?: string
}

interface CategoryNodeProps {
  category: any
  allCategories: Category[]
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  searchTerm?: string
  level?: number
  expandedNodes: Set<string>
  onToggleNode: (nodeId: string) => void
}

function CategoryNode({ 
  category, 
  allCategories,
  onEdit, 
  onDelete, 
  searchTerm = '',
  level = 0,
  expandedNodes,
  onToggleNode
}: CategoryNodeProps) {
  // Usar el estado global en lugar del estado local
  const isExpanded = expandedNodes.has(category.id)
  
  // Memoizar cálculos costosos
  const hasChildren = useMemo(() => category.children.length > 0, [category.children.length])
  
  const matchesSearch = useMemo(() => {
    if (!searchTerm) return true
    return category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [searchTerm, category.name, category.description])

  // Si hay búsqueda y no coincide, verificar si algún descendiente coincide
  const hasMatchingDescendant = useMemo(() => {
    if (!searchTerm) return false
    
    const checkDescendant = (cat: any): boolean => {
      if (cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (cat.description && cat.description.toLowerCase().includes(searchTerm.toLowerCase()))) {
        return true
      }
      return cat.children.some((child: any) => checkDescendant(child))
    }
    
    return checkDescendant(category)
  }, [searchTerm, category])

  // Si hay búsqueda y no coincide ni tiene descendientes que coincidan, no mostrar
  if (searchTerm && !matchesSearch && !hasMatchingDescendant) {
    return null
  }

  // Construir ruta de breadcrumb - MEMOIZADO
  const breadcrumb = useMemo(() => {
    if (level === 0) return []
    
    const buildBreadcrumb = (cat: Category): string[] => {
      const path: string[] = []
      let current = cat
      while (current.parent) {
        // Buscar el padre en las categorías originales
        const parentCategory = allCategories.find(c => c.id === current.parent?.id)
        if (parentCategory) {
          path.unshift(parentCategory.name)
          current = parentCategory
        } else {
          break
        }
      }
      return path
    }
    
    return buildBreadcrumb(category)
  }, [level, category, allCategories])

  // Obtener icono por nivel
  const getLevelIcon = (level: number) => {
    switch (level) {
      case 1: return <FolderTree className='h-4 w-4' />
      case 2: return <Folder className='h-4 w-4' />
      default: return <Tag className='h-4 w-4' />
    }
  }

  // Colores por nivel más distintivos
  const getLevelColors = (level: number) => {
    switch (level) {
      case 1: return 'bg-blue-50 border-l-blue-500 border-l-4'
      case 2: return 'bg-green-50 border-l-green-500 border-l-4'
      case 3: return 'bg-yellow-50 border-l-yellow-500 border-l-4'
      case 4: return 'bg-purple-50 border-l-purple-500 border-l-4'
      default: return 'bg-muted border-l-gray-400 border-l-4'
    }
  }

  // Padding por nivel para mejor jerarquía visual
  const getLevelPadding = (level: number) => {
    return `${level * 12}px`
  }

  return (
    <div className="select-none">
      {/* Nodo de categoría */}
      <div 
        className={cn(
          "group bg-card hover:shadow-sm transition-all duration-200 mb-1 rounded-r-lg border border-border cursor-pointer",
          matchesSearch && searchTerm && "ring-1 ring-blue-400 ring-opacity-50"
        )}
        style={{ marginLeft: getLevelPadding(level) }}
        onClick={() => onEdit(category)}
      >
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {/* Botón expandir/contraer */}
            <button
              onClick={(e) => {
                e.stopPropagation() // Evitar que se propague el click
                onToggleNode(category.id)
              }}
              className={cn(
                "flex-shrink-0 p-0.5 rounded hover:bg-muted",
                !hasChildren && "invisible"
              )}
            >
              {hasChildren && (
                isExpanded ? 
                  <ChevronDown className="h-3 w-3" /> : 
                  <ChevronRight className="h-3 w-3" />
              )}
            </button>

            {/* Color e icono */}
            <div className="flex items-center space-x-1.5 flex-shrink-0">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {React.cloneElement(getLevelIcon(category.level), { className: 'h-3.5 w-3.5' })}
            </div>

            {/* Información de la categoría */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1.5 mb-0.5">
                <h3 className="font-medium text-sm text-foreground truncate">
                  {category.name}
                </h3>
                <Badge variant={category.isActive ? 'default' : 'secondary'} className="text-xs px-1.5 py-0.5 h-5">
                  {category.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
                <Badge 
                  variant='outline' 
                  className={cn(
                    "text-xs px-1.5 py-0.5 h-5 font-medium",
                    category.level === 1 && "bg-blue-50 text-blue-700 border-blue-200",
                    category.level === 2 && "bg-green-50 text-green-700 border-green-200", 
                    category.level === 3 && "bg-yellow-50 text-yellow-700 border-yellow-200",
                    category.level === 4 && "bg-purple-50 text-purple-700 border-purple-200"
                  )}
                >
                  N{category.level}
                </Badge>
              </div>
              
              {category.description && (
                <p className="text-xs text-muted-foreground truncate mb-1">
                  {category.description}
                </p>
              )}
              
              <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Ticket className="h-3 w-3" />
                  <span>{category._count.tickets}</span>
                </div>
                {hasChildren && (
                  <div className="flex items-center space-x-1">
                    <Folder className="h-3 w-3" />
                    <span>{category._count.other_categories}</span>
                  </div>
                )}
                {category.assignedTechnicians && category.assignedTechnicians.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <Users className="h-3 w-3" />
                    <span>{category.assignedTechnicians.length}</span>
                  </div>
                )}
              </div>

              {/* Técnicos asignados */}
              {category.assignedTechnicians && category.assignedTechnicians.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {category.assignedTechnicians.slice(0, 2).map((tech: any) => (
                    <Badge key={tech.id} variant='secondary' className="text-xs px-1.5 py-0.5 h-5">
                      {tech.name.split(' ')[0]} (P{tech.priority})
                    </Badge>
                  ))}
                  {category.assignedTechnicians.length > 2 && (
                    <Badge variant='outline' className="text-xs px-1.5 py-0.5 h-5">
                      +{category.assignedTechnicians.length - 2}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div 
            className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()} // Evitar que se propague el click
          >
            <Button 
              variant='ghost' 
              size='sm' 
              onClick={() => onEdit(category)}
              className="h-7 w-7 p-0"
              title="Editar categoría"
            >
              <Edit className='h-3.5 w-3.5' />
            </Button>
            <Button 
              variant='ghost' 
              size='sm'
              disabled={!category.canDelete}
              onClick={() => onDelete(category)}
              className="h-7 w-7 p-0"
              title={!category.canDelete ? 'No se puede eliminar: tiene tickets o subcategorías' : 'Eliminar categoría'}
            >
              <Trash2 className='h-3.5 w-3.5' />
            </Button>
          </div>
        </div>
      </div>

      {/* Hijos (subcategorías) */}
      {hasChildren && isExpanded && (
        <div className="mt-2">
          {category.children.map((child: any) => (
            <CategoryNode
              key={child.id}
              category={child}
              allCategories={allCategories}
              onEdit={onEdit}
              onDelete={onDelete}
              searchTerm={searchTerm}
              level={level + 1}
              expandedNodes={expandedNodes}
              onToggleNode={onToggleNode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CategoryTree({ categories, onEdit, onDelete, searchTerm }: CategoryTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [globalExpandState, setGlobalExpandState] = useState<'expanded' | 'collapsed' | 'mixed'>('mixed')

  // Inicializar nodos expandidos (primeros 2 niveles)
  React.useEffect(() => {
    const initialExpanded = new Set<string>()
    
    const addInitialExpanded = (cats: Category[], level: number = 0) => {
      cats.forEach(cat => {
        if (level < 2 && cat.children.length > 0) {
          initialExpanded.add(cat.id)
        }
        if (cat.children.length > 0) {
          addInitialExpanded(cat.children as Category[], level + 1)
        }
      })
    }
    
    addInitialExpanded(categories)
    setExpandedNodes(initialExpanded)
  }, [categories])

  // Escuchar eventos globales de expandir/contraer
  React.useEffect(() => {
    const handleExpandAll = () => {
      const allNodeIds = new Set<string>()
      
      const collectAllIds = (cats: Category[]) => {
        cats.forEach(cat => {
          if (cat.children.length > 0) {
            allNodeIds.add(cat.id)
          }
          if (cat.children.length > 0) {
            collectAllIds(cat.children as Category[])
          }
        })
      }
      
      collectAllIds(categories)
      setExpandedNodes(allNodeIds)
      setGlobalExpandState('expanded')
    }

    const handleCollapseAll = () => {
      setExpandedNodes(new Set())
      setGlobalExpandState('collapsed')
    }

    window.addEventListener('expandAllCategories', handleExpandAll)
    window.addEventListener('collapseAllCategories', handleCollapseAll)

    return () => {
      window.removeEventListener('expandAllCategories', handleExpandAll)
      window.removeEventListener('collapseAllCategories', handleCollapseAll)
    }
  }, [categories])

  // Función para toggle individual
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
    setGlobalExpandState('mixed')
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FolderTree className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p>No hay categorías disponibles</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {categories.map(category => (
        <CategoryNode
          key={category.id}
          category={category}
          allCategories={categories}
          onEdit={onEdit}
          onDelete={onDelete}
          searchTerm={searchTerm}
          level={0}
          expandedNodes={expandedNodes}
          onToggleNode={toggleNode}
        />
      ))}
    </div>
  )
}