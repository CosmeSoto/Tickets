'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, Plus, Layers, Target, BarChart3, Activity, X } from 'lucide-react'
import { Badge } from './badge'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  name: string
  level: number
  color: string
  levelName: string
  description?: string
  isActive: boolean
  _count?: {
    tickets: number
    other_categories: number
  }
}

interface AssignedCategory {
  categoryId: string
  priority: number
  maxTickets?: number
  autoAssign: boolean
}

interface CategorySearchSelectorProps {
  categories: Category[]
  assignedCategories: AssignedCategory[]
  onAddCategory: (categoryId: string) => void
  onRemoveCategory: (categoryId: string) => void
  onUpdatePriority: (categoryId: string, priority: number) => void
  onUpdateMaxTickets: (categoryId: string, maxTickets: number) => void
  onUpdateAutoAssign: (categoryId: string, autoAssign: boolean) => void
  placeholder?: string
  disabled?: boolean
  showStats?: boolean
}

export function CategorySearchSelector({
  categories,
  assignedCategories,
  onAddCategory,
  onRemoveCategory,
  onUpdatePriority,
  onUpdateMaxTickets,
  onUpdateAutoAssign,
  placeholder = "Buscar categorías...",
  disabled = false,
  showStats = true
}: CategorySearchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filtrar categorías disponibles (no asignadas y activas)
  const availableCategories = (categories || []).filter(cat => {
    const isAssigned = assignedCategories.some(ac => ac.categoryId === cat.id)
    return !isAssigned && cat.isActive
  })

  // Filtrar por búsqueda
  const filteredCategories = availableCategories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.levelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cat.description && cat.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Manejar selección
  const handleSelect = (categoryId: string) => {
    onAddCategory(categoryId)
    setIsOpen(false)
    setSearchTerm('')
    setHighlightedIndex(-1)
  }

  // Manejar teclas
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredCategories.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredCategories.length) {
          handleSelect(filteredCategories[highlightedIndex].id)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSearchTerm('')
        setHighlightedIndex(-1)
        break
    }
  }

  // Scroll al elemento destacado
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const element = listRef.current.children[highlightedIndex] as HTMLElement
      if (element) {
        element.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex])

  // Obtener icono por nivel
  const getLevelIcon = (level: number) => {
    switch (level) {
      case 1: return <Layers className="h-4 w-4" />
      case 2: return <Target className="h-4 w-4" />
      case 3: return <BarChart3 className="h-4 w-4" />
      case 4: return <Activity className="h-4 w-4" />
      default: return <Layers className="h-4 w-4" />
    }
  }

  // Obtener color por prioridad
  const getPriorityColor = (priority: number) => {
    if (priority <= 3) return 'bg-red-100 text-red-800 border-red-200'
    if (priority <= 6) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-green-100 text-green-800 border-green-200'
  }

  const getPriorityLabel = (priority: number) => {
    if (priority <= 3) return 'Alta'
    if (priority <= 6) return 'Media'
    return 'Baja'
  }

  return (
    <div className="space-y-4">
      {/* Categorías asignadas */}
      {assignedCategories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">
              Categorías Asignadas ({assignedCategories.length})
            </h4>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {assignedCategories.map(assignedCat => {
              const category = categories.find(c => c.id === assignedCat.categoryId)
              if (!category) return null
              
              return (
                <div key={assignedCat.categoryId} className="p-3 bg-muted border border-border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h5 className="font-medium text-foreground truncate">
                            {category.name}
                          </h5>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {getLevelIcon(category.level)}
                            <span className="ml-1">{category.levelName}</span>
                          </Badge>
                        </div>
                        {category.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {category.description}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveCategory(assignedCat.categoryId)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                      disabled={disabled}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Configuración de la asignación */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Prioridad
                        <span className="text-muted-foreground ml-1" title="1-3: Alta, 4-6: Media, 7-10: Baja">ⓘ</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={assignedCat.priority}
                          onChange={(e) => onUpdatePriority(assignedCat.categoryId, parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1 text-xs border border-border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          min="1"
                          max="10"
                          disabled={disabled}
                        />
                        <Badge className={cn("text-xs", getPriorityColor(assignedCat.priority))}>
                          {getPriorityLabel(assignedCat.priority)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Máx. Tickets
                        <span className="text-muted-foreground ml-1" title="Máximo de tickets concurrentes">ⓘ</span>
                      </label>
                      <input
                        type="number"
                        value={assignedCat.maxTickets || 10}
                        onChange={(e) => onUpdateMaxTickets(assignedCat.categoryId, parseInt(e.target.value) || 10)}
                        className="w-20 px-2 py-1 text-xs border border-border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                        max="100"
                        disabled={disabled}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Auto-asignación
                        <span className="text-muted-foreground ml-1" title="Asignación automática de tickets">ⓘ</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={assignedCat.autoAssign}
                          onChange={(e) => onUpdateAutoAssign(assignedCat.categoryId, e.target.checked)}
                          className="rounded focus:ring-blue-500"
                          disabled={disabled}
                        />
                        <span className={cn(
                          "text-xs font-medium",
                          assignedCat.autoAssign ? "text-green-600" : "text-muted-foreground"
                        )}>
                          {assignedCat.autoAssign ? 'Activa' : 'Manual'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Selector para agregar categorías */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Agregar Categoría
          </label>
          <span className="text-xs text-muted-foreground">
            {availableCategories.length} disponibles
          </span>
        </div>
        
        <div className="relative">
          {/* Input de búsqueda */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <input
              ref={inputRef}
              type="text"
              className={cn(
                "w-full pl-10 pr-10 py-2 border border-border rounded-md text-sm",
                "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                "disabled:bg-muted disabled:text-muted-foreground",
                isOpen && "ring-2 ring-blue-500 border-blue-500",
                availableCategories.length === 0 && "bg-muted text-muted-foreground"
              )}
              placeholder={availableCategories.length === 0 ? "Todas las categorías están asignadas" : placeholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                if (!isOpen) setIsOpen(true)
                setHighlightedIndex(-1)
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              disabled={disabled || availableCategories.length === 0}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "transform rotate-180",
                availableCategories.length === 0 && "opacity-50"
              )} />
            </div>
          </div>

          {/* Dropdown */}
          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-64 overflow-auto">
              <div ref={listRef}>
                {filteredCategories.length > 0 ? (
                  filteredCategories.map((category, index) => (
                    <div
                      key={category.id}
                      className={cn(
                        "px-3 py-3 cursor-pointer flex items-center space-x-3",
                        "hover:bg-muted border-b border-gray-100 last:border-b-0",
                        highlightedIndex === index && "bg-blue-50"
                      )}
                      onClick={() => handleSelect(category.id)}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="font-medium text-sm text-foreground truncate">
                            {category.name}
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {getLevelIcon(category.level)}
                            <span className="ml-1">{category.levelName}</span>
                          </Badge>
                        </div>
                        
                        {category.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {category.description}
                          </div>
                        )}
                        
                        {showStats && category._count && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {category._count.tickets} tickets • {category._count.other_categories} subcategorías
                          </div>
                        )}
                      </div>
                      
                      <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    {searchTerm ? (
                      <div>
                        <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <div>No se encontraron categorías</div>
                        <div className="text-xs mt-1">
                          Intenta con otro término de búsqueda
                        </div>
                      </div>
                    ) : availableCategories.length === 0 ? (
                      <div>
                        <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <div>Todas las categorías están asignadas</div>
                      </div>
                    ) : (
                      <div>
                        <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <div>No hay categorías disponibles</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Overlay para cerrar */}
          {isOpen && (
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => {
                setIsOpen(false)
                setSearchTerm('')
                setHighlightedIndex(-1)
              }}
            />
          )}
        </div>
        
        {assignedCategories.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No hay categorías asignadas. Los tickets se asignarán manualmente.
          </p>
        )}
      </div>
    </div>
  )
}