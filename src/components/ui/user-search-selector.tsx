'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, Mail, Phone, Building, Calendar, UserCircle } from 'lucide-react'
import { Badge } from './badge'
import { cn } from '@/lib/utils'
import type { BaseUser } from '@/types/user'
import { 
  USER_ROLE_LABELS,
  USER_ROLE_COLORS,
  USER_ROLE_ICONS,
  type UserRole
} from '@/lib/constants/user-constants'

interface UserSearchSelectorProps {
  users: BaseUser[]
  value: string | null
  onChange: (userId: string | null) => void
  placeholder?: string
  disabled?: boolean
  showStats?: boolean
  filterByActive?: boolean
  excludeRoles?: ('ADMIN' | 'TECHNICIAN' | 'CLIENT')[]
}

export function UserSearchSelector({
  users,
  value,
  onChange,
  placeholder = "Buscar usuario...",
  disabled = false,
  showStats = true,
  filterByActive = true,
  excludeRoles = []
}: UserSearchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filtrar usuarios
  const availableUsers = users.filter(user => {
    const activeFilter = filterByActive ? user.isActive : true
    const roleFilter = !excludeRoles.includes(user.role)
    return activeFilter && roleFilter
  })

  // Filtrar por búsqueda
  const filteredUsers = availableUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.department && typeof user.department === 'string' && user.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.department && typeof user.department === 'object' && user.department.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.phone && user.phone.includes(searchTerm)) ||
    USER_ROLE_LABELS[user.role as UserRole].toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Obtener usuario seleccionado
  const selectedUser = users.find(user => user.id === value)

  // Manejar selección
  const handleSelect = (userId: string | null) => {
    onChange(userId)
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
          prev < filteredUsers.length ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > -1 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex === -1) {
          handleSelect(null) // Sin usuario
        } else if (highlightedIndex >= 0 && highlightedIndex < filteredUsers.length) {
          handleSelect(filteredUsers[highlightedIndex].id)
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

  // Obtener icono de rol
  const getRoleIcon = (role: BaseUser['role']) => {
    const IconComponent = USER_ROLE_ICONS[role as UserRole]
    return <IconComponent className="h-4 w-4" />
  }

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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
          placeholder={selectedUser ? selectedUser.name : placeholder}
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

      {/* Información del usuario seleccionado */}
      {selectedUser && !isOpen && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border",
                USER_ROLE_COLORS[selectedUser.role as UserRole]
              )}>
                {getRoleIcon(selectedUser.role)}
              </div>
              <div>
                <div className="text-sm font-medium text-blue-900">
                  {selectedUser.name}
                </div>
                <div className="text-xs text-blue-700">
                  {selectedUser.email} • {USER_ROLE_LABELS[selectedUser.role as UserRole]}
                </div>
              </div>
            </div>
            {showStats && selectedUser._count && (
              <div className="text-right">
                <div className="text-xs text-blue-600">
                  {selectedUser._count.tickets_tickets_createdByIdTousers || 0} creados
                </div>
                <div className="text-xs text-blue-600">
                  {selectedUser._count.tickets_tickets_assigneeIdTousers || 0} asignados
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
            {/* Opción "Sin usuario" */}
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
              <span className="text-sm font-medium">Sin usuario seleccionado</span>
            </div>

            {/* Usuarios filtrados */}
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user, index) => (
                <div
                  key={user.id}
                  className={cn(
                    "px-3 py-3 cursor-pointer flex items-center space-x-3",
                    "hover:bg-muted border-b border-gray-100 last:border-b-0",
                    highlightedIndex === index && "bg-blue-50",
                    value === user.id && "bg-blue-100 text-blue-900"
                  )}
                  onClick={() => handleSelect(user.id)}
                >
                  {/* Avatar y estado */}
                  <div className="flex items-center space-x-2">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border",
                      USER_ROLE_COLORS[user.role as UserRole]
                    )}>
                      {getRoleIcon(user.role)}
                    </div>
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      user.isActive ? "bg-green-500" : "bg-red-500"
                    )} />
                  </div>
                  
                  {/* Información principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="font-medium text-sm text-foreground truncate">
                        {user.name}
                      </div>
                      <Badge className={cn("text-xs", USER_ROLE_COLORS[user.role as UserRole])}>
                        {USER_ROLE_LABELS[user.role as UserRole]}
                      </Badge>
                      {!user.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{user.email}</span>
                      </div>
                      
                      {user.phone && (
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{user.phone}</span>
                        </div>
                      )}
                      
                      {user.department && (
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Building className="h-3 w-3" />
                          <span>{typeof user.department === 'string' ? user.department : user.department.name}</span>
                        </div>
                      )}
                      
                      {user.lastLogin && (
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Último acceso: {formatDate(user.lastLogin)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Estadísticas */}
                  {showStats && user._count && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground font-medium">
                        {user._count.tickets_tickets_createdByIdTousers || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        creados
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {user._count.tickets_tickets_assigneeIdTousers || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        asignados
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {searchTerm ? (
                  <div>
                    <UserCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <div>No se encontraron usuarios</div>
                    <div className="text-xs mt-1">
                      Intenta con otro término de búsqueda
                    </div>
                  </div>
                ) : (
                  <div>
                    <UserCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <div>No hay usuarios disponibles</div>
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