'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, User, Users, Star, Zap, Mail, Phone, Building } from 'lucide-react'
import { Badge } from './badge'
import { cn } from '@/lib/utils'
import type { Technician } from '@/types/user'

interface TechnicianSearchSelectorProps {
  technicians: Technician[]
  value: string | null
  onChange: (technicianId: string | null) => void
  placeholder?: string
  disabled?: boolean
  showStats?: boolean
  filterByActive?: boolean
}

export function TechnicianSearchSelector({
  technicians,
  value,
  onChange,
  placeholder = "Buscar técnico...",
  disabled = false,
  showStats = true,
  filterByActive = true
}: TechnicianSearchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filtrar técnicos
  const availableTechnicians = technicians.filter(tech => {
    const activeFilter = filterByActive ? tech.isActive : true
    return activeFilter
  })

  // Filtrar por búsqueda
  const filteredTechnicians = availableTechnicians.filter(tech => {
    const deptName = typeof tech.department === 'string' ? tech.department : tech.department?.name || ''
    return tech.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tech.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deptName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tech.phone && tech.phone.includes(searchTerm))
  })

  // Obtener técnico seleccionado
  const selectedTechnician = technicians.find(tech => tech.id === value)

  // Manejar selección
  const handleSelect = (technicianId: string | null) => {
    onChange(technicianId)
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
          prev < filteredTechnicians.length ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > -1 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex === -1) {
          handleSelect(null) // Sin técnico
        } else if (highlightedIndex >= 0 && highlightedIndex < filteredTechnicians.length) {
          handleSelect(filteredTechnicians[highlightedIndex].id)
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
    if (highlightedIndex >= -1 && listRef.current) {
      const element = listRef.current.children[highlightedIndex + 1] as HTMLElement
      if (element) {
        element.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex])

  // Obtener icono de experiencia
  const getExperienceIcon = (technician: Technician) => {
    const assignmentCount = technician._count?.technician_assignments || 0
    const ticketCount = technician._count?.tickets_tickets_assigneeIdTousers || 0
    
    if (ticketCount > 50 || assignmentCount > 5) return <Star className="h-3 w-3 text-yellow-500" />
    if (ticketCount > 20 || assignmentCount > 2) return <Zap className="h-3 w-3 text-blue-500" />
    return <User className="h-3 w-3 text-muted-foreground" />
  }

  // Obtener nivel de experiencia
  const getExperienceLevel = (technician: Technician) => {
    const assignmentCount = technician._count?.technician_assignments || 0
    const ticketCount = technician._count?.tickets_tickets_assigneeIdTousers || 0
    
    if (ticketCount > 50 || assignmentCount > 5) return { level: 'Experto', color: 'bg-yellow-100 text-yellow-800' }
    if (ticketCount > 20 || assignmentCount > 2) return { level: 'Avanzado', color: 'bg-blue-100 text-blue-800' }
    return { level: 'Junior', color: 'bg-muted text-foreground' }
  }

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
          placeholder={selectedTechnician ? selectedTechnician.name : placeholder}
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

      {/* Información del técnico seleccionado */}
      {selectedTechnician && !isOpen && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getExperienceIcon(selectedTechnician)}
              <div>
                <div className="text-sm font-medium text-blue-900">
                  {selectedTechnician.name}
                </div>
                <div className="text-xs text-blue-700">
                  {selectedTechnician.email}
                </div>
              </div>
            </div>
            {showStats && selectedTechnician._count && (
              <div className="text-right">
                <div className="text-xs text-blue-600">
                  {selectedTechnician._count.tickets_tickets_assigneeIdTousers || 0} tickets
                </div>
                <div className="text-xs text-blue-600">
                  {selectedTechnician._count.technician_assignments} asignaciones
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-80 overflow-auto">
          <div ref={listRef}>
            {/* Opción "Sin técnico" */}
            <div
              className={cn(
                "px-3 py-2 cursor-pointer flex items-center space-x-2",
                "hover:bg-muted border-b border-gray-100",
                highlightedIndex === -1 && "bg-blue-50",
                !value && "bg-blue-100 text-blue-900"
              )}
              onClick={() => handleSelect(null)}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <div className="w-2 h-2 border border-gray-400 rounded"></div>
              </div>
              <span className="text-sm font-medium">Sin técnico asignado</span>
            </div>

            {/* Técnicos filtrados */}
            {filteredTechnicians.length > 0 ? (
              filteredTechnicians.map((technician, index) => {
                const experience = getExperienceLevel(technician)
                return (
                  <div
                    key={technician.id}
                    className={cn(
                      "px-3 py-3 cursor-pointer flex items-center space-x-3",
                      "hover:bg-muted border-b border-gray-100 last:border-b-0",
                      highlightedIndex === index && "bg-blue-50",
                      value === technician.id && "bg-blue-100 text-blue-900"
                    )}
                    onClick={() => handleSelect(technician.id)}
                  >
                    {/* Indicadores de estado */}
                    <div className="flex items-center space-x-1">
                      {getExperienceIcon(technician)}
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        technician.isActive ? "bg-green-500" : "bg-red-500"
                      )} />
                    </div>
                    
                    {/* Información principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="font-medium text-sm text-foreground truncate">
                          {technician.name}
                        </div>
                        <Badge className={cn("text-xs", experience.color)}>
                          {experience.level}
                        </Badge>
                        {!technician.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{technician.email}</span>
                        </div>
                        
                        {technician.phone && (
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{technician.phone}</span>
                          </div>
                        )}
                        
                        {technician.department && (
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Building className="h-3 w-3" />
                            <span>{typeof technician.department === 'string' ? technician.department : (technician.department as any)?.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Estadísticas */}
                    {showStats && technician._count && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground font-medium">
                          {technician._count.tickets_tickets_assigneeIdTousers || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          tickets
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {technician._count.technician_assignments}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          categorías
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {searchTerm ? (
                  <div>
                    <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <div>No se encontraron técnicos</div>
                    <div className="text-xs mt-1">
                      Intenta con otro término de búsqueda
                    </div>
                  </div>
                ) : (
                  <div>
                    <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <div>No hay técnicos disponibles</div>
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
  )
}