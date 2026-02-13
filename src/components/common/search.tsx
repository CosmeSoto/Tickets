/**
 * Componente de búsqueda unificado con debounce optimizado y sugerencias
 * Diseño simétrico y funcionalidad específica por rol
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search as SearchIcon, X, Filter, Clock, TrendingUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// Tipos de configuración
export interface SearchFieldConfig {
  key: string
  label: string
  weight?: number // Peso para relevancia en búsqueda
  type?: 'text' | 'number' | 'date' | 'email'
  searchable?: boolean
}

export interface SearchSuggestion {
  value: string
  label: string
  type: 'recent' | 'popular' | 'suggestion'
  count?: number
  category?: string
}

export interface SearchProps {
  // Estado básico
  value: string
  onChange: (value: string) => void
  
  // Configuración
  placeholder?: string
  debounceMs?: number
  minLength?: number
  maxLength?: number
  
  // Campos de búsqueda
  searchFields?: SearchFieldConfig[]
  
  // Sugerencias
  suggestions?: SearchSuggestion[]
  showSuggestions?: boolean
  maxSuggestions?: number
  
  // Historial
  enableHistory?: boolean
  maxHistory?: number
  
  // UI
  variant?: 'simple' | 'advanced'
  size?: 'sm' | 'default' | 'lg'
  showClearButton?: boolean
  showSearchIcon?: boolean
  
  // Rol-based
  userRole?: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
  
  // Estados
  loading?: boolean
  disabled?: boolean
  
  // Callbacks
  onFocus?: () => void
  onBlur?: () => void
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void
  onHistorySelect?: (term: string) => void
  
  // Estilos
  className?: string
  inputClassName?: string
}

// Temas por rol
const ROLE_THEMES = {
  ADMIN: {
    primary: 'blue',
    focus: 'focus:border-blue-500 focus:ring-blue-500',
    text: 'text-blue-700',
    bg: 'bg-blue-50'
  },
  TECHNICIAN: {
    primary: 'green',
    focus: 'focus:border-green-500 focus:ring-green-500',
    text: 'text-green-700',
    bg: 'bg-green-50'
  },
  CLIENT: {
    primary: 'purple',
    focus: 'focus:border-purple-500 focus:ring-purple-500',
    text: 'text-purple-700',
    bg: 'bg-purple-50'
  }
}

// Hook para manejar historial de búsqueda
function useSearchHistory(maxHistory = 10, storageKey = 'search-history') {
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        setHistory(JSON.parse(stored))
      }
    } catch (error) {
      console.warn('Error loading search history:', error)
    }
  }, [storageKey])

  const addToHistory = useCallback((term: string) => {
    if (!term.trim() || term.length < 2) return

    setHistory(prev => {
      const filtered = prev.filter(item => item !== term)
      const newHistory = [term, ...filtered].slice(0, maxHistory)
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(newHistory))
      } catch (error) {
        console.warn('Error saving search history:', error)
      }
      
      return newHistory
    })
  }, [maxHistory, storageKey])

  const clearHistory = useCallback(() => {
    setHistory([])
    try {
      localStorage.removeItem(storageKey)
    } catch (error) {
      console.warn('Error clearing search history:', error)
    }
  }, [storageKey])

  return { history, addToHistory, clearHistory }
}

export function Search({
  value,
  onChange,
  placeholder = 'Buscar...',
  debounceMs = 300,
  minLength = 1,
  maxLength = 100,
  searchFields = [],
  suggestions = [],
  showSuggestions = true,
  maxSuggestions = 8,
  enableHistory = true,
  maxHistory = 10,
  variant = 'simple',
  size = 'default',
  showClearButton = true,
  showSearchIcon = true,
  userRole = 'CLIENT',
  loading = false,
  disabled = false,
  onFocus,
  onBlur,
  onSuggestionSelect,
  onHistorySelect,
  className,
  inputClassName
}: SearchProps) {
  const theme = ROLE_THEMES[userRole]
  const { history, addToHistory, clearHistory } = useSearchHistory(maxHistory, `search-history-${userRole}`)
  
  // Estados locales
  const [debouncedValue, setDebouncedValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Debounce del valor
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
      if (value && value !== debouncedValue) {
        addToHistory(value)
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [value, debounceMs, debouncedValue, addToHistory])

  // Filtrar sugerencias y historial
  const filteredSuggestions = useMemo(() => {
    if (!showSuggestions || !value.trim()) return []
    
    const searchTerm = value.toLowerCase()
    return suggestions
      .filter(suggestion => 
        suggestion.label.toLowerCase().includes(searchTerm) ||
        suggestion.value.toLowerCase().includes(searchTerm)
      )
      .slice(0, maxSuggestions)
  }, [suggestions, value, showSuggestions, maxSuggestions])

  const filteredHistory = useMemo(() => {
    if (!enableHistory || !value.trim()) return history.slice(0, 5)
    
    const searchTerm = value.toLowerCase()
    return history
      .filter(item => item.toLowerCase().includes(searchTerm))
      .slice(0, 5)
  }, [history, value, enableHistory])

  // Manejar cambio de valor
  const handleChange = useCallback((newValue: string) => {
    if (newValue.length <= maxLength) {
      onChange(newValue)
    }
  }, [onChange, maxLength])

  // Manejar selección de sugerencia
  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    onChange(suggestion.value)
    setShowDropdown(false)
    onSuggestionSelect?.(suggestion)
  }, [onChange, onSuggestionSelect])

  // Manejar selección de historial
  const handleHistorySelect = useCallback((term: string) => {
    onChange(term)
    setShowDropdown(false)
    onHistorySelect?.(term)
  }, [onChange, onHistorySelect])

  // Limpiar búsqueda
  const handleClear = useCallback(() => {
    onChange('')
    setShowDropdown(false)
  }, [onChange])

  // Manejar focus
  const handleFocus = useCallback(() => {
    setIsFocused(true)
    setShowDropdown(true)
    onFocus?.()
  }, [onFocus])

  // Manejar blur
  const handleBlur = useCallback(() => {
    setIsFocused(false)
    // Delay para permitir clicks en dropdown
    setTimeout(() => setShowDropdown(false), 200)
    onBlur?.()
  }, [onBlur])

  // Clases de tamaño
  const sizeClasses = {
    sm: 'h-8 text-sm',
    default: 'h-10',
    lg: 'h-12 text-lg'
  }

  // Renderizado según variante
  if (variant === 'simple') {
    return (
      <div className={cn('relative flex items-center', className)}>
        <div className="relative flex-1">
          <Input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled || loading}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              sizeClasses[size],
              theme.focus,
              showSearchIcon && 'pl-10',
              showClearButton && value && 'pr-10',
              inputClassName
            )}
          />
          
          {showSearchIcon && (
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
          
          {showClearButton && value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'advanced') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Input
              type="text"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled || loading}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className={cn(
                sizeClasses[size],
                theme.focus,
                'pl-10 pr-10',
                inputClassName
              )}
            />
            
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            
            {value && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {searchFields.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  Campos
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-medium">Buscar en:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {searchFields.map((field) => (
                      <Badge key={field.key} variant="outline" className="justify-start">
                        {field.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        
        {/* Información de búsqueda */}
        {value && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Buscando en {searchFields.length || 'todos los'} campo{searchFields.length !== 1 ? 's' : ''}
            </span>
            <span>{value.length}/{maxLength} caracteres</span>
          </div>
        )}
      </div>
    )
  }

  // Variante simple (default)
  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || loading}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            sizeClasses[size],
            theme.focus,
            showSearchIcon && 'pl-10',
            showClearButton && value && 'pr-10',
            inputClassName
          )}
        />
        
        {showSearchIcon && (
          <SearchIcon className={cn(
            'absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4',
            loading ? 'animate-pulse text-blue-500' : 'text-muted-foreground'
          )} />
        )}
        
        {showClearButton && value && !loading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Dropdown de sugerencias e historial */}
      {showDropdown && (isFocused || value) && (filteredSuggestions.length > 0 || filteredHistory.length > 0) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1">
          <Command className="rounded-lg border shadow-md bg-background">
            <CommandList className="max-h-60">
              {/* Historial reciente */}
              {filteredHistory.length > 0 && (
                <CommandGroup heading="Búsquedas recientes">
                  {filteredHistory.map((term, index) => (
                    <CommandItem
                      key={`history-${index}`}
                      value={term}
                      onSelect={() => handleHistorySelect(term)}
                      className="cursor-pointer"
                    >
                      <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{term}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              
              {/* Sugerencias */}
              {filteredSuggestions.length > 0 && (
                <CommandGroup heading="Sugerencias">
                  {filteredSuggestions.map((suggestion, index) => (
                    <CommandItem
                      key={`suggestion-${index}`}
                      value={suggestion.value}
                      onSelect={() => handleSuggestionSelect(suggestion)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center">
                          {suggestion.type === 'popular' && (
                            <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                          )}
                          <div>
                            <div>{suggestion.label}</div>
                            {suggestion.category && (
                              <div className="text-xs text-muted-foreground">{suggestion.category}</div>
                            )}
                          </div>
                        </div>
                        {suggestion.count && (
                          <Badge variant="secondary" className="text-xs">
                            {suggestion.count}
                          </Badge>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              
              {filteredSuggestions.length === 0 && filteredHistory.length === 0 && value && (
                <CommandEmpty>No se encontraron sugerencias</CommandEmpty>
              )}
            </CommandList>
            
            {/* Footer con acciones */}
            {enableHistory && history.length > 0 && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  className="w-full text-xs text-muted-foreground"
                >
                  Limpiar historial
                </Button>
              </div>
            )}
          </Command>
        </div>
      )}
    </div>
  )
}