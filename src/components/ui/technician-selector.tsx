'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, User, Users, Star, Zap } from 'lucide-react'
import { Badge } from './badge'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface Technician {
  id: string
  name: string
  email: string
  department?: string | { id: string; name: string; color?: string; familyId?: string } | null
  isActive: boolean
  technicianFamilyAssignments?: { familyId: string; family: { id: string; name: string; code: string; color: string | null } }[]
  _count?: {
    assignedTickets: number
    technicianAssignments: number
  }
  technicianAssignments?: {
    id: string
    priority: number
    maxTickets: number
    autoAssign: boolean
    category: {
      id: string
      name: string
      level: number
    }
  }[]
}

interface AssignedTechnician {
  technicianId: string
  priority: number
  maxTickets?: number
  autoAssign: boolean
}

interface TechnicianSelectorProps {
  technicians: Technician[]
  technicianAssignments: AssignedTechnician[]
  onAdd: (technicianId: string) => void
  onRemove: (technicianId: string) => void
  onUpdatePriority: (technicianId: string, priority: number) => void
  onUpdateMaxTickets: (technicianId: string, maxTickets: number) => void
  onToggleAutoAssign: (technicianId: string) => void
  disabled?: boolean
  categoryLevel?: number
}

export function TechnicianSelector({
  technicians,
  technicianAssignments,
  onAdd,
  onRemove,
  onUpdatePriority,
  onUpdateMaxTickets,
  onToggleAutoAssign,
  disabled = false,
  categoryLevel = 1
}: TechnicianSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filtrar técnicos disponibles (no asignados)
  const availableTechnicians = technicians.filter(tech => 
    tech.isActive && !(technicianAssignments || []).find(at => at.technicianId === tech.id)
  )

  // Filtrar por búsqueda
  const filteredTechnicians = availableTechnicians.filter(tech =>
    tech.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tech.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tech.department && tech.department.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Obtener técnicos asignados con información completa
  const assignedTechniciansWithInfo = (technicianAssignments || []).map(assigned => {
    const techInfo = technicians.find(t => t.id === assigned.technicianId)
    return { ...assigned, ...techInfo, id: assigned.technicianId }
  }).filter(Boolean).sort((a, b) => a.priority - b.priority)

  // Manejar selección
  const handleSelect = (technicianId: string) => {
    onAdd(technicianId)
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
          prev < filteredTechnicians.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredTechnicians.length) {
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
    if (highlightedIndex >= 0 && listRef.current) {
      const element = listRef.current.children[highlightedIndex] as HTMLElement
      if (element) {
        element.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex])

  // Helper para obtener nombre del departamento
  const getDeptName = (dept: Technician['department']): string | null => {
    if (!dept) return null
    if (typeof dept === 'string') return dept
    return dept.name ?? null
  }

  // Obtener descripción por nivel de categoría
  const getLevelDescription = (level: number): string => {
    switch (level) {
      case 1: return 'Técnicos generalistas - Manejan cualquier tipo de problema'
      case 2: return 'Técnicos especializados - Expertos en esta área específica'
      case 3: return 'Técnicos expertos - Conocimiento profundo en esta tecnología'
      case 4: return 'Técnicos súper especializados - Problemas muy específicos'
      default: return `Técnicos de nivel ${level}`
    }
  }

  // Obtener icono de experiencia basado en asignaciones
  const getExperienceIcon = (technician: Technician) => {
    const assignmentCount = technician._count?.technicianAssignments || 0
    const ticketCount = technician._count?.assignedTickets || 0
    
    if (ticketCount > 50 || assignmentCount > 5) return <Star className="h-3 w-3 text-yellow-500" />
    if (ticketCount > 20 || assignmentCount > 2) return <Zap className="h-3 w-3 text-blue-500" />
    return <User className="h-3 w-3 text-muted-foreground" />
  }

  return (
    <div className="space-y-4">
      {/* Técnicos asignados */}
      {assignedTechniciansWithInfo.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Técnicos Asignados ({assignedTechniciansWithInfo.length})
            </label>
            <Badge variant="outline" className="text-xs">
              Ordenados por prioridad
            </Badge>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {assignedTechniciansWithInfo.map((tech: any) => (
              <div key={tech.id} className="flex items-center justify-between p-3 bg-muted rounded-lg border">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="flex items-center space-x-1">
                    {getExperienceIcon(tech)}
                    <Badge 
                      variant={tech.priority <= 2 ? 'default' : 'secondary'} 
                      className="text-xs"
                    >
                      P{tech.priority}
                    </Badge>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">
                      {tech.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {tech.email}
                      {tech.department && ` • ${getDeptName(tech.department)}`}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant={tech.autoAssign ? 'default' : 'outline'} className="text-xs">
                        {tech.autoAssign ? 'Auto-asignación' : 'Manual'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Máx: {tech.maxTickets || 10} tickets
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Prioridad */}
                  <input
                    type="number"
                    value={tech.priority}
                    onChange={(e) => onUpdatePriority(tech.id, parseInt(e.target.value))}
                    className="w-12 px-1 py-0.5 text-xs border rounded text-center"
                    min="1"
                    max="10"
                    title="Prioridad (1=más alta)"
                    disabled={disabled}
                  />
                  
                  {/* Máximo tickets */}
                  <input
                    type="number"
                    value={tech.maxTickets || 10}
                    onChange={(e) => onUpdateMaxTickets(tech.id, parseInt(e.target.value))}
                    className="w-12 px-1 py-0.5 text-xs border rounded text-center"
                    min="1"
                    max="100"
                    title="Máximo tickets"
                    disabled={disabled}
                  />
                  
                  {/* Toggle auto-asignación */}
                  <Button
                    type="button"
                    variant={tech.autoAssign ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onToggleAutoAssign(tech.id)}
                    className="h-6 w-6 p-0"
                    title={tech.autoAssign ? 'Desactivar auto-asignación' : 'Activar auto-asignación'}
                    disabled={disabled}
                  >
                    <Zap className="h-3 w-3" />
                  </Button>
                  
                  {/* Remover */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRemove(tech.id)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    title="Remover técnico"
                    disabled={disabled}
                  >
                    ×
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selector para agregar técnicos */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Agregar Técnico ({availableTechnicians.length} disponibles)
        </label>
        
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
            placeholder="Buscar técnico por nombre, email o departamento..."
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
              {filteredTechnicians.length > 0 ? (
                filteredTechnicians.map((technician, index) => (
                  <div
                    key={technician.id}
                    className={cn(
                      "px-3 py-3 cursor-pointer flex items-center space-x-3",
                      "hover:bg-muted border-b border-gray-100 last:border-b-0",
                      highlightedIndex === index && "bg-blue-50"
                    )}
                    onClick={() => handleSelect(technician.id)}
                  >
                    <div className="flex items-center space-x-2">
                      {getExperienceIcon(technician)}
                      <div className="w-2 h-2 bg-green-500 rounded-full" title="Activo" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {technician.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {technician.email}
                      </div>
                      {technician.department && (
                        <div className="text-xs text-muted-foreground">
                          {getDeptName(technician.department)}
                        </div>
                      )}
                      {technician.technicianFamilyAssignments && technician.technicianFamilyAssignments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {technician.technicianFamilyAssignments.map(fa => (
                            <span
                              key={fa.familyId}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: (fa.family.color ?? '#6B7280') + '20', color: fa.family.color ?? '#6B7280' }}
                            >
                              {fa.family.code}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        {technician._count?.assignedTickets || 0} tickets
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {technician._count?.technicianAssignments || 0} asignaciones
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                  {searchTerm
                    ? 'No se encontraron técnicos con ese criterio'
                    : 'No hay técnicos asignados a esta familia. Puedes asignar técnicos desde Familias → Personal.'}
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

      {/* Información adicional */}
      {assignedTechniciansWithInfo.length === 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
          ⚠️ Sin técnicos asignados. Los tickets se asignarán manualmente.
        </div>
      )}
    </div>
  )
}