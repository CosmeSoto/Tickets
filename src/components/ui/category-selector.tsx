 'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, Folder, FolderTree, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  name: string
  level: number
  levelName: string
  color: string
  parent?: {
    id: string
    name: string
  }
}

interface CategorySelectorProps {
  categories: Category[]
  value: string | null
  onChange: (categoryId: string | null) => void
  placeholder?: string
  disabled?: boolean
}

export function CategorySelector({ 
  categories, 
  value, 
  onChange, 
  placeholder = "Buscar categoría padre...",
  disabled = false 
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filtrar y agrupar categorías basado en búsqueda
  const filteredCategories = Array.isArray(categories) 
    ? categories.filter(category =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (category.levelName && category.levelName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (category.parent?.name.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : []

  // Agrupar categorías por nivel para mejor visualización
  const categoriesByLevel = filteredCategories.reduce((acc, category) => {
    const level = category.level
    if (!acc[level]) acc[level] = []
    acc[level].push(category)
    return acc
  }, {} as Record<number, Category[]>)

  // Ordenar niveles
  const sortedLevels = Object.keys(categoriesByLevel).map(Number).sort()

  // Obtener categoría seleccionada
  const selectedCategory = Array.isArray(categories) 
    ? categories.find(cat => cat.id === value)
    : null

  // Obtener icono por nivel
  const getLevelIcon = (level: number) => {
    switch (level) {
      case 1: return <FolderTree className='h-4 w-4' />
      case 2: return <Folder className='h-4 w-4' />
      default: return <Tag className='h-4 w-4' />
    }
  }

  // Manejar selección
  const handleSelect = (categoryId: string | null) => {
    onChange(categoryId)
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
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1)
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
      const element = listRef.current.children[highlightedIndex + 1] as HTMLElement
      if (element) {
        element.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex])

  return (
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
            "w-full pl-10 pr-10 py-2 border border-border rounded-md",
            "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            "disabled:bg-muted disabled:text-muted-foreground",
            isOpen && "ring-2 ring-blue-500 border-blue-500"
          )}
          placeholder={selectedCategory ? selectedCategory.name : placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            if (!isOpen) setIsOpen(true)
            setHighlightedIndex(-1)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "transform rotate-180"
          )} />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          <div ref={listRef}>
            {/* Opción "Sin padre" */}
            <div
              className={cn(
                "px-3 py-2 cursor-pointer flex items-center space-x-2",
                "hover:bg-muted",
                highlightedIndex === -1 && "bg-blue-50",
                !value && "bg-blue-100 text-blue-900"
              )}
              onClick={() => handleSelect(null)}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <div className="w-2 h-2 border border-gray-400 rounded"></div>
              </div>
              <span className="text-sm font-medium">Sin categoría padre (Nivel 1)</span>
            </div>

            {/* Categorías agrupadas por nivel */}
            {sortedLevels.length > 0 ? (
              sortedLevels.map(level => (
                <div key={level}>
                  {/* Separador de nivel */}
                  <div className="px-3 py-1 bg-muted/50 text-xs font-medium text-muted-foreground border-t">
                    {level === 1 ? 'Principales' : level === 2 ? 'Subcategorías' : level === 3 ? 'Especialidades' : 'Detalles'}
                  </div>
                  
                  {/* Categorías del nivel */}
                  {categoriesByLevel[level].map((category, categoryIndex) => {
                    const globalIndex = sortedLevels.slice(0, sortedLevels.indexOf(level))
                      .reduce((sum, prevLevel) => sum + categoriesByLevel[prevLevel].length, 0) + categoryIndex
                    
                    return (
                      <div
                        key={category.id}
                        className={cn(
                          "px-3 py-2 cursor-pointer flex items-center space-x-2",
                          "hover:bg-muted",
                          highlightedIndex === globalIndex && "bg-blue-50",
                          value === category.id && "bg-blue-100 text-blue-900"
                        )}
                        onClick={() => handleSelect(category.id)}
                      >
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                        <div className="flex items-center space-x-1 text-muted-foreground">
                          {getLevelIcon(category.level)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {category.name}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center space-x-1">
                            <span>{category.levelName || `Nivel ${category.level}`}</span>
                            {category.parent && (
                              <>
                                <span>•</span>
                                <span>Hijo de: {category.parent.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {searchTerm ? 'No se encontraron categorías que coincidan con la búsqueda' : 'No hay categorías disponibles'}
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
  )
}