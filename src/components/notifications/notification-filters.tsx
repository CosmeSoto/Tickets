'use client'

import { Search, Filter, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface NotificationFiltersProps {
  filterType: string
  setFilterType: (type: string) => void
  filterRead: string
  setFilterRead: (read: string) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  hasActiveFilters: boolean
  stats: {
    total: number
    unread: number
    read: number
    filtered: number
    byType: {
      TICKET_CREATED: number
      TICKET_ASSIGNED: number
      TICKET_STATUS_CHANGED: number
      COMMENT_ADDED: number
      TICKET_UPDATED: number
    }
  }
}

const NOTIFICATION_TYPES = [
  { value: 'TICKET_CREATED', label: 'Ticket Creado', icon: '🎫', color: 'bg-blue-100 text-blue-800' },
  { value: 'TICKET_ASSIGNED', label: 'Ticket Asignado', icon: '👤', color: 'bg-green-100 text-green-800' },
  { value: 'TICKET_STATUS_CHANGED', label: 'Estado Cambiado', icon: '🔄', color: 'bg-orange-100 text-orange-800' },
  { value: 'COMMENT_ADDED', label: 'Nuevo Comentario', icon: '💬', color: 'bg-purple-100 text-purple-800' },
  { value: 'TICKET_UPDATED', label: 'Ticket Actualizado', icon: '✏️', color: 'bg-yellow-100 text-yellow-800' },
]

const READ_STATUS_OPTIONS = [
  { value: 'all', label: 'Todas', icon: '📋' },
  { value: 'unread', label: 'No leídas', icon: '🔴' },
  { value: 'read', label: 'Leídas', icon: '✅' },
]

export function NotificationFilters({
  filterType,
  setFilterType,
  filterRead,
  setFilterRead,
  searchTerm,
  setSearchTerm,
  hasActiveFilters,
  stats,
}: NotificationFiltersProps) {

  const resetFilters = () => {
    setFilterType('all')
    setFilterRead('all')
    setSearchTerm('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros de Notificaciones</span>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                Filtros activos
              </Badge>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Limpiar filtros
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Búsqueda */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Buscar notificaciones</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por título o mensaje..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tipo de notificación */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de notificación</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center space-x-2">
                    <span>📋</span>
                    <span>Todos los tipos</span>
                    <Badge variant="outline" className="ml-auto">
                      {stats.total}
                    </Badge>
                  </div>
                </SelectItem>
                {NOTIFICATION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center space-x-2">
                      <span>{type.icon}</span>
                      <span>{type.label}</span>
                      <Badge variant="outline" className="ml-auto">
                        {stats.byType[type.value as keyof typeof stats.byType]}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estado de lectura */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Estado de lectura</Label>
            <Select value={filterRead} onValueChange={setFilterRead}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                {READ_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center space-x-2">
                      <span>{option.icon}</span>
                      <span>{option.label}</span>
                      <Badge variant="outline" className="ml-auto">
                        {option.value === 'all' ? stats.total :
                         option.value === 'unread' ? stats.unread :
                         stats.read}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="font-semibold text-blue-900">{stats.total}</div>
            <div className="text-blue-700">Total</div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
            <div className="font-semibold text-red-900">{stats.unread}</div>
            <div className="text-red-700">No leídas</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <div className="font-semibold text-green-900">{stats.read}</div>
            <div className="text-green-700">Leídas</div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
            <div className="font-semibold text-purple-900">{stats.filtered}</div>
            <div className="text-purple-700">Filtradas</div>
          </div>
        </div>

        {/* Resumen de filtros activos */}
        {hasActiveFilters && (
          <div className="pt-4 border-t">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Search className="h-4 w-4" />
              <span>Filtros activos:</span>
              <div className="flex flex-wrap gap-1">
                {filterType !== 'all' && (
                  <Badge variant="outline" className="text-xs">
                    Tipo: {NOTIFICATION_TYPES.find(t => t.value === filterType)?.label}
                  </Badge>
                )}
                {filterRead !== 'all' && (
                  <Badge variant="outline" className="text-xs">
                    Estado: {READ_STATUS_OPTIONS.find(s => s.value === filterRead)?.label}
                  </Badge>
                )}
                {searchTerm && (
                  <Badge variant="outline" className="text-xs">
                    Búsqueda: "{searchTerm}"
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}