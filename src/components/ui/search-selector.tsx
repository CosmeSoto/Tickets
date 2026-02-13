'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { Button } from './button'
import { Input } from './input'
import { Badge } from './badge'
import { Card, CardContent } from './card'
import { 
  Search, 
  ChevronDown, 
  X, 
  Check,
  User,
  Users,
  Folder,
  Tag
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchSelectorItem {
  id: string
  name: string
  email?: string
  description?: string
  color?: string
  level?: number
  isActive?: boolean
  role?: string
  department?: string
  _count?: Record<string, number>
  [key: string]: any
}

interface SearchSelectorProps {
  items: SearchSelectorItem[]
  value: string | string[] | null
  onChange: (value: string | string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  multiple?: boolean
  clearable?: boolean
  
  // Filtros
  filterByActive?: boolean
  excludeRoles?: string[]
  includeRoles?: string[]
  
  // Renderizado personalizado
  itemRenderer?: (item: SearchSelectorItem, isSelected: boolean) => ReactNode
  selectedRenderer?: (item: SearchSelectorItem) => ReactNode
  emptyRenderer?: () => ReactNode
  
  // Configuración visual
  variant?: 'default' | 'user' | 'technician' | 'category'
  showStats?: boolean
  maxHeight?: string
  
  // Callbacks
  onSearch?: (term: string) => void
  onOpen?: () => void
  onClose?: () => void
}

const variantIcons = {
  default: Search,
  user: User,
  technician: Users,
  category: Folder,
}

const variantColors = {
  default: 'border-border',
  user: 'border-purple-300',
  technician: 'border-green-300',
  category: 'border-blue-300',
}

export function SearchSelector({
  items,
  value,
  onChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  disabled = false,
  multiple = false,
  clearable = true,
  filterByActive = true,
  excludeRoles = [],
  includeRoles = [],
  itemRenderer,
  selectedRenderer,
  emptyRenderer,
  variant = 'default',
  showStats = false,
  maxHeight = "300px",
  onSearch,
  onOpen,
  onClose
}: SearchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const VariantIcon = variantIcons[variant]

  // Filtrar items
  const filteredItems = items.filter(item => {
    // Filtro por activo
    if (filterByActive && item.isActive === false) return false
    
    // Filtro por roles excluidos
    if (excludeRoles.length > 0 && item.role && excludeRoles.includes(item.role)) return false
    
    // Filtro por roles incluidos
    if (includeRoles.length > 0 && item.role && !includeRoles.includes(item.role)) return false
    
    // Filtro por búsqueda
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        item.name.toLowerCase().includes(searchLower) ||
        (item.email && item.email.toLowerCase().includes(searchLower)) ||
        (item.description && item.description.toLowerCase().includes(searchLower))
      )
    }
    
    return true
  })

  // Obtener items seleccionados
  const selectedItems = multiple 
    ? items.filter(item => Array.isArray(value) && value.includes(item.id))
    : value ? items.find(item => item.id === value) ? [items.find(item => item.id === value)!] : []
    : []

  // Manejar selección
  const handleSelect = (item: SearchSelectorItem) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : []
      const newValues = currentValues.includes(item.id)
        ? currentValues.filter(id => id !== item.id)
        : [...currentValues, item.id]
      onChange(newValues)
    } else {
      onChange(item.id)
      setIsOpen(false)
    }
  }

  // Limpiar selección
  const handleClear = () => {
    onChange(multiple ? [] : '')
  }

  // Manejar búsqueda
  const handleSearch = (term: string) => {
    setSearchTerm(term)
    if (onSearch) {
      onSearch(term)
    }
  }

  // Manejar apertura/cierre
  const handleToggle = () => {
    if (disabled) return
    
    const newIsOpen = !isOpen
    setIsOpen(newIsOpen)
    
    if (newIsOpen) {
      onOpen?.()
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      onClose?.()
      setSearchTerm('')
    }
  }

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
        onClose?.()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Renderizador por defecto de items
  const defaultItemRenderer = (item: SearchSelectorItem, isSelected: boolean) => (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        {variant === 'category' && item.color && (
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground truncate">
            {item.name}
          </div>
          {item.email && (
            <div className="text-sm text-muted-foreground truncate">
              {item.email}
            </div>
          )}
          {item.description && !item.email && (
            <div className="text-sm text-muted-foreground truncate">
              {item.description}
            </div>
          )}
          {showStats && item._count && (
            <div className="flex items-center space-x-2 mt-1">
              {Object.entries(item._count).map(([key, count]) => (
                <Badge key={key} variant="outline" className="text-xs">
                  {key}: {count}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      {isSelected && (
        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
      )}
    </div>
  )

  // Renderizador por defecto de seleccionados
  const defaultSelectedRenderer = (item: SearchSelectorItem) => (
    <div className="flex items-center space-x-2">
      {variant === 'category' && item.color && (
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: item.color }}
        />
      )}
      <span className="truncate">{item.name}</span>
    </div>
  )

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <Button
        type="button"
        variant="outline"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "w-full justify-between text-left font-normal",
          variantColors[variant],
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <VariantIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          {selectedItems.length > 0 ? (
            multiple && selectedItems.length > 1 ? (
              <span className="truncate">
                {selectedItems.length} seleccionados
              </span>
            ) : (
              <div className="truncate">
                {selectedRenderer 
                  ? selectedRenderer(selectedItems[0])
                  : defaultSelectedRenderer(selectedItems[0])
                }
              </div>
            )
          ) : (
            <span className="text-muted-foreground truncate">{placeholder}</span>
          )}
        </div>
        
        <div className="flex items-center space-x-1 flex-shrink-0">
          {clearable && selectedItems.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            isOpen && "transform rotate-180"
          )} />
        </div>
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <Card className="absolute z-50 w-full mt-1 shadow-lg">
          <CardContent className="p-0">
            {/* Búsqueda */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  ref={inputRef}
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Lista de items */}
            <div 
              className="max-h-[300px] overflow-y-auto"
              style={{ maxHeight }}
            >
              {filteredItems.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {emptyRenderer ? emptyRenderer() : (
                    searchTerm ? 'No se encontraron resultados' : 'No hay elementos disponibles'
                  )}
                </div>
              ) : (
                filteredItems.map(item => {
                  const isSelected = multiple 
                    ? Array.isArray(value) && value.includes(item.id)
                    : value === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "w-full p-3 text-left hover:bg-muted border-b border-gray-100 last:border-b-0",
                        isSelected && "bg-blue-50"
                      )}
                    >
                      {itemRenderer 
                        ? itemRenderer(item, isSelected)
                        : defaultItemRenderer(item, isSelected)
                      }
                    </button>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}