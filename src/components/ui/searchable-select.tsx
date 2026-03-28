'use client'

/**
 * SearchableSelect — selector con buscador integrado, uso global.
 *
 * Acepta opciones en dos formatos:
 *   - { value: string; label: string }   ← formato estándar
 *   - { id: string; name: string }       ← compatibilidad con APIs existentes
 *
 * Uso básico:
 *   <SearchableSelect
 *     options={items}          // { id, name } o { value, label }
 *     value={selectedId}
 *     onChange={setSelectedId}
 *     placeholder="Buscar..."
 *     emptyLabel="Sin asignar" // texto de la opción vacía (omitir para ocultar)
 *   />
 */

import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'

export interface SearchableSelectOption {
  value?: string
  label?: string
  id?: string
  name?: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Texto de la opción "vacía". Si no se pasa, no se muestra opción vacía. */
  emptyLabel?: string
  disabled?: boolean
  className?: string
}

function normalize(opt: SearchableSelectOption): { value: string; label: string } {
  return {
    value: (opt.value ?? opt.id ?? ''),
    label: (opt.label ?? opt.name ?? ''),
  }
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  emptyLabel,
  disabled = false,
  className = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const normalized = options.map(normalize)
  const selected = normalized.find(o => o.value === value)

  const filtered = query.trim()
    ? normalized.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : normalized

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    if (disabled) return
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleSelect = (val: string) => {
    onChange(val)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selected ? 'text-foreground truncate' : 'text-muted-foreground truncate'}>
          {selected ? selected.label : (emptyLabel ?? placeholder)}
        </span>
        <div className="flex shrink-0 items-center gap-1 ml-2">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); handleSelect('') }}
              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); handleSelect('') } }}
              className="rounded p-0.5 hover:bg-muted"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
          {/* Buscador */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')}>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Opciones */}
          <ul className="max-h-56 overflow-y-auto py-1">
            {/* Opción vacía opcional */}
            {emptyLabel !== undefined && (
              <li>
                <button
                  type="button"
                  onClick={() => handleSelect('')}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${!value ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                >
                  {emptyLabel}
                </button>
              </li>
            )}

            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
            ) : (
              filtered.map(opt => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${opt.value === value ? 'bg-accent/50 font-medium text-foreground' : 'text-foreground'}`}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
