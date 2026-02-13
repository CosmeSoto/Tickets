/**
 * Input de búsqueda ultra estable - No hace debounce hasta que el usuario para de escribir
 */

'use client'

import React, { useState, useEffect, useCallback, memo, useRef } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface SearchInputUltraStableProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  debounceMs?: number
}

const SearchInputUltraStable = memo(function SearchInputUltraStable({
  value,
  onChange,
  placeholder = 'Buscar...',
  disabled = false,
  className = '',
  debounceMs = 1000 // 1 segundo completo
}: SearchInputUltraStableProps) {
  // Estado local completamente aislado
  const [localValue, setLocalValue] = useState(value)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastChangeRef = useRef<number>(0)
  const isUserTypingRef = useRef(false)

  // Solo sincronizar cuando el valor externo cambie Y no estemos escribiendo
  useEffect(() => {
    if (value !== localValue && !isUserTypingRef.current) {
      setLocalValue(value)
    }
  }, [value])

  // Handler que detecta cuando el usuario está escribiendo activamente
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const now = Date.now()
    
    // Marcar que el usuario está escribiendo
    isUserTypingRef.current = true
    lastChangeRef.current = now
    
    // Actualizar inmediatamente el estado local (sin delay)
    setLocalValue(newValue)
    
    // Limpiar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Crear nuevo timeout que solo se ejecuta si el usuario para de escribir
    timeoutRef.current = setTimeout(() => {
      // Verificar que realmente haya pasado el tiempo sin más cambios
      if (Date.now() - lastChangeRef.current >= debounceMs - 50) {
        onChange(newValue)
        isUserTypingRef.current = false
      }
    }, debounceMs)
    
  }, [onChange, debounceMs])

  // Enviar inmediatamente cuando el input pierde el foco
  const handleBlur = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    onChange(localValue)
    isUserTypingRef.current = false
  }, [onChange, localValue])

  // Enviar inmediatamente cuando se presiona Enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      onChange(localValue)
      isUserTypingRef.current = false
    }
  }, [onChange, localValue])

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`pl-10 ${className}`}
        autoComplete="off"
        spellCheck="false"
      />
    </div>
  )
})

export { SearchInputUltraStable }