'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Shield, 
  Activity, 
  Users, 
  FileText, 
  Download,
  Calendar,
  Filter,
  Search,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  Loader2
} from 'lucide-react'

// Componentes
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId?: string
  userId: string
  userEmail?: string
  details?: any
  ipAddress?: string
  userAgent?: string
  createdAt: string
  users?: {
    name: string
    email: string
    role: string
  }
}

interface AuditStats {
  totalLogs: number
  actionStats: Array<{
    action: string
    entityType: string
    _count: { id: number }
  }>
  topUsers: Array<{
    userId: string
    _count: { id: number }
  }>
  period: string
}

/**
 * Componente para resolver IDs en detalles de auditoría
 * Detecta registros antiguos con UUIDs y los resuelve en tiempo real
 */
function AuditDetailsResolver({ details }: { details: any }) {
  const [resolvedDetails, setResolvedDetails] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const resolveIds = async () => {
      // PRIORIDAD 1: Si ya tiene cambios resueltos del servidor, usarlos directamente
      if (details.changes && typeof details.changes === 'object') {
        setResolvedDetails({ type: 'changes', data: details.changes })
        return
      }

      // PRIORIDAD 2: Si tiene oldValues/newValues (registros antiguos), resolverlos
      if (details.oldValues && details.newValues) {
        setLoading(true)
        try {
          // Obtener todos los valores únicos que necesitan resolución
          const allValues: Record<string, any> = {}
          
          Object.keys(details.newValues).forEach(key => {
            if (details.oldValues[key] !== details.newValues[key]) {
              allValues[`old_${key}`] = details.oldValues[key]
              allValues[`new_${key}`] = details.newValues[key]
            }
          })

          // Llamar al API para resolver IDs
          const response = await fetch('/api/admin/audit/resolve-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: allValues })
          })

          if (response.ok) {
            const { resolved } = await response.json()
            
            // Reconstruir cambios con valores resueltos
            const changes: Record<string, { old: string; new: string; field: string }> = {}
            
            Object.keys(details.newValues).forEach(key => {
              if (details.oldValues[key] !== details.newValues[key]) {
                changes[key] = {
                  field: getFieldDisplayName(key),
                  old: resolved[`old_${key}`] || String(details.oldValues[key] || 'vacío'),
                  new: resolved[`new_${key}`] || String(details.newValues[key] || 'vacío')
                }
              }
            })
            
            setResolvedDetails({ type: 'resolved', data: changes })
          } else {
            // Si falla, usar valores sin resolver
            const changes: Record<string, { old: string; new: string; field: string }> = {}
            Object.keys(details.newValues).forEach(key => {
              if (details.oldValues[key] !== details.newValues[key]) {
                changes[key] = {
                  field: getFieldDisplayName(key),
                  old: String(details.oldValues[key] || 'vacío'),
                  new: String(details.newValues[key] || 'vacío')
                }
              }
            })
            setResolvedDetails({ type: 'unresolved', data: changes })
          }
        } catch (error) {
          console.error('Error resolviendo IDs:', error)
          // Fallback: mostrar sin resolver
          const changes: Record<string, { old: string; new: string; field: string }> = {}
          Object.keys(details.newValues).forEach(key => {
            if (details.oldValues[key] !== details.newValues[key]) {
              changes[key] = {
                field: getFieldDisplayName(key),
                old: String(details.oldValues[key] || 'vacío'),
                new: String(details.newValues[key] || 'vacío')
              }
            }
          })
          setResolvedDetails({ type: 'error', data: changes })
        } finally {
          setLoading(false)
        }
        return
      }

      // PRIORIDAD 3: Otros tipos de detalles
      if (details.metadata) {
        setResolvedDetails({ type: 'metadata', data: details.metadata })
        return
      }

      // PRIORIDAD 4: Objeto genérico
      if (typeof details === 'object' && details !== null) {
        setResolvedDetails({ type: 'generic', data: details })
        return
      }

      // Fallback
      setResolvedDetails({ type: 'raw', data: details })
    }

    resolveIds()
  }, [details])

  // Función para obtener nombre amigable del campo
  const getFieldDisplayName = (fieldName: string): string => {
    const fieldNames: Record<string, string> = {
      'name': 'Nombre',
      'email': 'Correo Electrónico',
      'role': 'Rol',
      'departmentId': 'Departamento',
      'phone': 'Teléfono',
      'isActive': 'Estado',
      'avatar': 'Avatar',
      'password': 'Contraseña',
      'createdById': 'Creado por',
      'assigneeId': 'Asignado a',
      'ticketId': 'Ticket',
      'title': 'Título',
      'description': 'Descripción',
      'status': 'Estado',
      'priority': 'Prioridad',
      'categoryId': 'Categoría',
      'ticketNumber': 'Número de Ticket',
      'color': 'Color',
      'parentId': 'Categoría Padre',
      'level': 'Nivel',
      'order': 'Orden',
      'createdAt': 'Fecha de Creación',
      'updatedAt': 'Última Actualización',
      'isEmailVerified': 'Email Verificado',
      'lastLogin': 'Último Acceso'
    }
    return fieldNames[fieldName] || fieldName
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-muted-foreground">Resolviendo información...</span>
      </div>
    )
  }

  if (!resolvedDetails) {
    return (
      <div className="text-sm text-muted-foreground">Cargando detalles...</div>
    )
  }

  // Renderizar según el tipo
  if (resolvedDetails.type === 'changes' || resolvedDetails.type === 'resolved' || resolvedDetails.type === 'unresolved' || resolvedDetails.type === 'error') {
    const changesArray = Object.entries(resolvedDetails.data).map(([key, value]: [string, any]) => ({
      campo: value.field || getFieldDisplayName(key),
      campoTecnico: key,
      anterior: value.old,
      nuevo: value.new
    }))

    if (changesArray.length > 0) {
      return (
        <div className="space-y-2">
          <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2">
            📝 Cambios Realizados ({changesArray.length})
            {resolvedDetails.type === 'resolved' && (
              <span className="text-xs text-green-600 dark:text-green-400 font-normal">
                ✓ IDs resueltos
              </span>
            )}
            {resolvedDetails.type === 'changes' && (
              <span className="text-xs text-green-600 dark:text-green-400 font-normal">
                ✓ Resuelto automáticamente
              </span>
            )}
          </div>
          {changesArray.map((change, idx) => (
            <div key={idx} className="bg-muted/50 p-3 rounded text-sm space-y-1">
              <div className="font-medium text-foreground">
                Campo: <span className="text-blue-600">{change.campo}</span>
              </div>
              <div className="text-red-600 dark:text-red-400">
                ❌ Anterior: {String(change.anterior || 'vacío')}
              </div>
              <div className="text-green-600 dark:text-green-400">
                ✅ Nuevo: {String(change.nuevo || 'vacío')}
              </div>
            </div>
          ))}
        </div>
      )
    }
  }

  if (resolvedDetails.type === 'metadata') {
    return (
      <div className="space-y-2">
        <div className="font-semibold text-purple-600 dark:text-purple-400">
          📊 Metadatos
        </div>
        <div className="bg-muted/50 p-3 rounded text-sm space-y-1">
          {Object.entries(resolvedDetails.data).map(([key, value]) => (
            <div key={key}>
              <span className="font-medium">{key}:</span>{' '}
              <span className="text-muted-foreground">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (resolvedDetails.type === 'generic') {
    const entries = Object.entries(resolvedDetails.data)
    if (entries.length > 0) {
      return (
        <div className="space-y-2">
          <div className="font-semibold text-gray-600 dark:text-gray-400">
            📦 Información
          </div>
          <div className="bg-muted/50 p-3 rounded text-sm space-y-1">
            {entries.map(([key, value]) => (
              <div key={key}>
                <span className="font-medium">{key}:</span>{' '}
                <span className="text-muted-foreground">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }
  }

  // Fallback: JSON formateado
  return (
    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
      {JSON.stringify(resolvedDetails.data, null, 2)}
    </pre>
  )
}

interface AuditStats {
  totalLogs: number
  actionStats: Array<{
    action: string
    entityType: string
    _count: { id: number }
  }>
  topUsers: Array<{
    userId: string
    _count: { id: number }
  }>
  period: string
}

export default function AuditPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  // Estados
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    hasMore: false
  })
  const [filters, setFilters] = useState({
    search: '',
    entityType: 'all',
    action: '',
    userId: '',
    days: '30'
  })

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'ADMIN') {
      router.push('/unauthorized')
      return
    }

    loadAuditData()
  }, [session, status, router, filters])

  const loadAuditData = async (page = 1, limit = 50) => {
    try {
      setLoading(true)
      
      // Cargar logs con paginación
      const logsResponse = await fetch('/api/admin/audit/logs?' + new URLSearchParams({
        ...filters,
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString()
      }))
      
      if (logsResponse.ok) {
        const logsData = await logsResponse.json()
        setLogs(logsData.logs || [])
        setPagination({
          page,
          limit,
          total: logsData.total || 0,
          hasMore: logsData.hasMore || false
        })
      }

      // Cargar estadísticas solo en la primera página
      if (page === 1) {
        const statsResponse = await fetch(`/api/admin/audit/stats?days=${filters.days}`)
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData)
        }
      }

    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos de auditoría',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // Función auxiliar para traducir acciones
  const translateAction = (action: string): string => {
    const actionMap: Record<string, string> = {
      'created': 'Creó',
      'updated': 'Actualizó',
      'deleted': 'Eliminó',
      'login': 'Inició sesión',
      'logout': 'Cerró sesión',
      'assigned': 'Asignó',
      'resolved': 'Resolvió',
      'closed': 'Cerró',
      'role_changed': 'Cambió rol'
    }
    
    for (const [key, value] of Object.entries(actionMap)) {
      if (action.toLowerCase().includes(key)) {
        return value
      }
    }
    
    return action
  }

  // Función auxiliar para traducir tipos de entidad
  const translateEntityType = (entityType: string): string => {
    const entityMap: Record<string, string> = {
      'ticket': 'Ticket',
      'user': 'Usuario',
      'category': 'Categoría',
      'department': 'Departamento',
      'comment': 'Comentario',
      'system': 'Sistema'
    }
    return entityMap[entityType.toLowerCase()] || entityType
  }

  const exportAuditReport = async (format: 'csv' | 'json' = 'csv') => {
    try {
      setLoading(true)
      
      toast({
        title: '📤 Exportando...',
        description: `Preparando archivo ${format.toUpperCase()}. Esto puede tomar unos momentos.`,
      })

      const response = await fetch('/api/admin/audit/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          includeHeaders: true,
          includeMetadata: true,
          filters: {
            ...filters,
            limit: 50000, // Límite de seguridad
            offset: 0
          }
        })
      })
      
      if (response.ok) {
        // Obtener advertencias del header
        const warnings = response.headers.get('X-Warnings')
        const totalRecords = response.headers.get('X-Total-Records')
        const exportedRecords = response.headers.get('X-Exported-Records')
        
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // Obtener nombre del archivo del header Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition')
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
        const filename = filenameMatch ? filenameMatch[1] : `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`
        
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        // Mostrar resultado con advertencias si existen
        let description = `✅ ${exportedRecords || 0} registros exportados`
        if (totalRecords && exportedRecords && totalRecords !== exportedRecords) {
          description += ` de ${totalRecords} total`
        }
        
        toast({
          title: '✅ Exportación Completada',
          description: description + (warnings && JSON.parse(warnings).length > 0 
            ? `\n⚠️ Advertencias: ${JSON.parse(warnings).join(', ')}` 
            : ''),
          duration: 10000
        })
      } else {
        const error = await response.json()
        throw new Error(error.details || error.error || 'Error desconocido')
      }
    } catch (error) {
      console.error('Error en exportación:', error)
      toast({
        title: '❌ Error en Exportación',
        description: error instanceof Error ? error.message : 'No se pudo exportar el reporte',
        variant: 'destructive',
        duration: 8000
      })
    } finally {
      setLoading(false)
    }
  }

  const auditColumns = [
    {
      key: 'createdAt',
      label: 'Fecha y Hora',
      render: (log: any) => {
        const date = new Date(log.createdAt)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)
        
        let timeAgo = ''
        if (diffMins < 1) timeAgo = 'Hace un momento'
        else if (diffMins < 60) timeAgo = `Hace ${diffMins} min`
        else if (diffHours < 24) timeAgo = `Hace ${diffHours}h`
        else if (diffDays < 7) timeAgo = `Hace ${diffDays}d`
        else timeAgo = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        
        return (
          <div className="text-sm">
            <div className="font-medium">{date.toLocaleDateString('es-ES', { 
              day: '2-digit', 
              month: 'short',
              year: 'numeric'
            })}</div>
            <div className="text-muted-foreground text-xs">
              {date.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
            <div className="text-muted-foreground text-xs italic">
              {timeAgo}
            </div>
          </div>
        )
      }
    },
    {
      key: 'action',
      label: 'Acción',
      render: (log: any) => {
        const action = log.action
        const entityType = log.entityType
        
        // Traducir acciones a español
        const actionTranslations: Record<string, string> = {
          'created': 'Creado',
          'updated': 'Actualizado',
          'deleted': 'Eliminado',
          'login': 'Inicio de sesión',
          'logout': 'Cierre de sesión',
          'login_failed': 'Intento de login fallido',
          'assigned': 'Asignado',
          'unassigned': 'Desasignado',
          'status_changed': 'Estado cambiado',
          'priority_changed': 'Prioridad cambiada',
          'resolved': 'Resuelto',
          'closed': 'Cerrado',
          'role_changed': 'Rol cambiado',
          'password_changed': 'Contraseña cambiada',
          'promoted': 'Promovido',
          'demoted': 'Degradado',
          'uploaded': 'Subido',
          'downloaded': 'Descargado',
          'exported': 'Exportado',
          'generated': 'Generado',
          'backup': 'Respaldo',
          'restore': 'Restauración',
          'config_changed': 'Configuración cambiada',
        }
        
        // Traducir tipos de entidad
        const entityTranslations: Record<string, string> = {
          'ticket': '🎫 Ticket',
          'user': '👤 Usuario',
          'category': '📂 Categoría',
          'department': '🏢 Departamento',
          'technician': '🔧 Técnico',
          'comment': '💬 Comentario',
          'attachment': '📎 Archivo',
          'system': '⚙️ Sistema',
          'report': '📊 Reporte',
          'settings': '🛠️ Configuración',
          'assignment': '📌 Asignación',
        }
        
        // Obtener traducción de la acción
        let translatedAction = action
        for (const [key, value] of Object.entries(actionTranslations)) {
          if (action.toLowerCase().includes(key)) {
            translatedAction = value
            break
          }
        }
        
        const getActionColor = (action: string) => {
          if (action.includes('created')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          if (action.includes('updated')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          if (action.includes('deleted')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          if (action.includes('login')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
          if (action.includes('assigned')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
          if (action.includes('resolved') || action.includes('closed')) return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
          return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
        }

        return (
          <div className="space-y-1">
            <Badge className={getActionColor(action)}>
              {translatedAction}
            </Badge>
            <div className="text-xs text-muted-foreground">
              {entityTranslations[entityType] || entityType}
            </div>
          </div>
        )
      }
    },
    {
      key: 'users',
      label: 'Usuario',
      render: (log: any) => {
        const user = log.users
        if (!user) return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <Shield className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <div className="text-sm font-medium">Sistema</div>
              <div className="text-xs text-muted-foreground">Acción automática</div>
            </div>
          </div>
        )
        
        const roleColors: Record<string, string> = {
          'ADMIN': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
          'TECHNICIAN': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          'CLIENT': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        }
        
        const roleLabels: Record<string, string> = {
          'ADMIN': 'Administrador',
          'TECHNICIAN': 'Técnico',
          'CLIENT': 'Cliente',
        }
        
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
              <Badge variant="outline" className={`text-xs mt-0.5 ${roleColors[user.role] || ''}`}>
                {roleLabels[user.role] || user.role}
              </Badge>
            </div>
          </div>
        )
      }
    },
    {
      key: 'entityId',
      label: 'Qué Pasó',
      render: (log: any) => {
        const details = log.details
        const action = log.action
        const entityType = log.entityType
        const userName = log.users?.name || 'Sistema'
        
        // Construir descripción natural y legible
        let mainDescription = ''
        let subDescription = ''
        let icon = '📝'
        
        if (entityType === 'comment') {
          icon = '💬'
          mainDescription = 'Agregó un comentario'
          
          // Extraer el contenido del comentario
          if (details?.content) {
            const preview = String(details.content).slice(0, 80)
            subDescription = `"${preview}${details.content.length > 80 ? '...' : ''}"`
          } else if (details?.comment) {
            const preview = String(details.comment).slice(0, 80)
            subDescription = `"${preview}${details.comment.length > 80 ? '...' : ''}"`
          } else if (details?.message) {
            const preview = String(details.message).slice(0, 80)
            subDescription = `"${preview}${details.message.length > 80 ? '...' : ''}"`
          }
          
          // Indicar si es interno o público
          if (details?.metadata?.isInternal === true) {
            mainDescription += ' (nota interna)'
          } else if (details?.metadata?.isInternal === false) {
            mainDescription += ' (visible para cliente)'
          }
        } else if (entityType === 'ticket') {
          icon = '🎫'
          if (action.includes('created')) {
            mainDescription = 'Creó un ticket'
            if (details?.title) {
              subDescription = details.title
            }
          } else if (action.includes('updated')) {
            mainDescription = 'Actualizó un ticket'
            if (details?.oldValues && details?.newValues) {
              const changes = Object.keys(details.newValues).filter(
                key => details.oldValues[key] !== details.newValues[key]
              )
              if (changes.length > 0) {
                subDescription = `Modificó: ${changes.slice(0, 2).join(', ')}${changes.length > 2 ? '...' : ''}`
              }
            }
          } else if (action.includes('deleted')) {
            mainDescription = 'Eliminó un ticket'
            icon = '🗑️'
          } else if (action.includes('assigned')) {
            mainDescription = 'Asignó el ticket'
            icon = '👤'
          } else if (action.includes('resolved')) {
            mainDescription = 'Resolvió el ticket'
            icon = '✅'
          } else if (action.includes('closed')) {
            mainDescription = 'Cerró el ticket'
            icon = '🔒'
          }
        } else if (entityType === 'user') {
          icon = '👤'
          if (action.includes('created')) {
            mainDescription = 'Creó un usuario'
            if (details?.name) {
              subDescription = details.name
            }
          } else if (action.includes('updated')) {
            mainDescription = 'Actualizó un usuario'
          } else if (action.includes('role_changed')) {
            mainDescription = 'Cambió el rol de un usuario'
            icon = '🔑'
          }
        } else if (entityType === 'category') {
          icon = '📂'
          mainDescription = action.includes('created') ? 'Creó una categoría' : 
                           action.includes('updated') ? 'Actualizó una categoría' : 
                           'Modificó una categoría'
        } else if (entityType === 'department') {
          icon = '🏢'
          mainDescription = action.includes('created') ? 'Creó un departamento' : 
                           action.includes('updated') ? 'Actualizó un departamento' : 
                           'Modificó un departamento'
        } else if (action.includes('login')) {
          icon = '🔐'
          mainDescription = 'Inició sesión'
        } else if (action.includes('logout')) {
          icon = '🚪'
          mainDescription = 'Cerró sesión'
        } else {
          // Fallback genérico
          const actionTranslated = translateAction(action)
          const entityTranslated = translateEntityType(entityType)
          mainDescription = `${actionTranslated} ${entityTranslated.toLowerCase()}`
        }
        
        return (
          <div className="text-sm space-y-1 max-w-md">
            <div className="flex items-start gap-2">
              <span className="text-lg">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">
                  {mainDescription}
                </div>
                {subDescription && (
                  <div className="text-xs text-muted-foreground italic mt-1 line-clamp-2">
                    {subDescription}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
    },
    {
      key: 'ipAddress',
      label: 'Contexto Técnico',
      render: (log: any) => {
        const ip = log.ipAddress
        const userAgent = log.userAgent
        const context = log.details?.context
        
        // Detectar navegador y SO del userAgent (fallback si no hay context)
        let browser = context?.browser || 'Desconocido'
        let os = context?.os || 'Desconocido'
        let deviceType = context?.deviceType
        let source = context?.source
        
        if (!context && userAgent) {
          if (userAgent.includes('Chrome')) browser = '🌐 Chrome'
          else if (userAgent.includes('Firefox')) browser = '🦊 Firefox'
          else if (userAgent.includes('Safari')) browser = '🧭 Safari'
          else if (userAgent.includes('Edge')) browser = '🌊 Edge'
          
          if (userAgent.includes('Windows')) os = '🪟 Windows'
          else if (userAgent.includes('Mac')) os = '🍎 macOS'
          else if (userAgent.includes('Linux')) os = '🐧 Linux'
          else if (userAgent.includes('Android')) os = '🤖 Android'
          else if (userAgent.includes('iOS')) os = '📱 iOS'
        }
        
        return (
          <div className="text-sm space-y-1">
            {/* Origen */}
            {source && (
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {source === 'WEB' && '🌐 Web'}
                  {source === 'API' && '⚡ API'}
                  {source === 'MOBILE' && '📱 Móvil'}
                  {source === 'SYSTEM' && '⚙️ Sistema'}
                </span>
              </div>
            )}
            
            {/* IP */}
            {ip ? (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-xs">IP:</span>
                <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">
                  {ip}
                </code>
              </div>
            ) : (
              <span className="text-muted-foreground text-xs">Sin IP</span>
            )}
            
            {/* Dispositivo */}
            {deviceType && (
              <div className="text-xs text-muted-foreground">
                {deviceType === 'Desktop' && '🖥️ Escritorio'}
                {deviceType === 'Mobile' && '📱 Móvil'}
                {deviceType === 'Tablet' && '📱 Tablet'}
              </div>
            )}
            
            {/* Navegador y SO */}
            {userAgent && (
              <>
                <div className="text-xs text-muted-foreground">{browser}</div>
                <div className="text-xs text-muted-foreground">{os}</div>
              </>
            )}
            
            {/* Duración (si existe) */}
            {context?.duration && (
              <div className="text-xs text-purple-600 dark:text-purple-400">
                ⏱️ {context.duration}ms
              </div>
            )}
            
            {/* Resultado (si es error) */}
            {context?.result === 'ERROR' && (
              <div className="text-xs text-red-600 dark:text-red-400 font-semibold">
                ❌ Error
              </div>
            )}
          </div>
        )
      }
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (log: any) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedLog(log)
              setIsDialogOpen(true)
            }}
          >
            <Eye className="h-4 w-4 mr-1" />
            Ver
          </Button>
        )
      }
    }
  ]

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <ModuleLayout
      title="Sistema de Auditoría"
      subtitle="Monitoreo y logs de actividad del sistema"
      loading={loading}
    >
      <div className="space-y-6">
        
        {/* Estadísticas de Auditoría */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SymmetricStatsCard
            title="Total de Eventos"
            value={stats?.totalLogs || 0}
            icon={FileText}
            color="blue"
            role="ADMIN"
          />
          
          <SymmetricStatsCard
            title="Usuarios Activos"
            value={stats?.topUsers?.length || 0}
            icon={Users}
            color="green"
            role="ADMIN"
          />
          
          <SymmetricStatsCard
            title="Acciones Críticas"
            value={stats?.actionStats?.filter(s => 
              s.action.includes('deleted') || 
              s.action.includes('role_changed') ||
              s.action.includes('login_failed')
            ).reduce((acc, s) => acc + s._count.id, 0) || 0}
            icon={AlertTriangle}
            color="orange"
            role="ADMIN"
            status={(stats?.actionStats?.filter(s => 
              s.action.includes('deleted') || 
              s.action.includes('role_changed') ||
              s.action.includes('login_failed')
            ).reduce((acc, s) => acc + s._count.id, 0) || 0) > 10 ? 'warning' : 'normal'}
          />
          
          <SymmetricStatsCard
            title="Módulos Activos"
            value={stats?.actionStats?.length || 0}
            icon={Activity}
            color="purple"
            role="ADMIN"
          />
        </div>

        {/* Filtros de Auditoría */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros de Auditoría
            </CardTitle>
            <CardDescription>
              Filtra los logs de auditoría por diferentes criterios. Máximo 50,000 registros por exportación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              
              {/* Búsqueda */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Búsqueda</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar en logs..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Tipo de Entidad */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Módulo</label>
                <Select 
                  value={filters.entityType} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, entityType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Módulos</SelectItem>
                    <SelectItem value="ticket">🎫 Tickets</SelectItem>
                    <SelectItem value="user">👥 Usuarios</SelectItem>
                    <SelectItem value="category">📂 Categorías</SelectItem>
                    <SelectItem value="department">🏢 Departamentos</SelectItem>
                    <SelectItem value="technician">🔧 Técnicos</SelectItem>
                    <SelectItem value="system">⚙️ Sistema</SelectItem>
                    <SelectItem value="report">📊 Reportes</SelectItem>
                    <SelectItem value="settings">🛠️ Configuración</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Período */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Período</label>
                <Select 
                  value={filters.days} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, days: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Último día</SelectItem>
                    <SelectItem value="7">Última semana</SelectItem>
                    <SelectItem value="30">Último mes</SelectItem>
                    <SelectItem value="90">Últimos 3 meses</SelectItem>
                    <SelectItem value="180">Últimos 6 meses</SelectItem>
                    <SelectItem value="365">Último año</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Acción */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Acción</label>
                <Input
                  placeholder="Ej: created, updated..."
                  value={filters.action}
                  onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
                />
              </div>

              {/* Exportar y Acciones */}
              <div className="space-y-2 lg:col-span-2">
                <label className="text-sm font-medium">Exportar y Acciones</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    onClick={() => exportAuditReport('csv')}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    CSV
                  </Button>
                  <Button 
                    onClick={() => exportAuditReport('json')}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    JSON
                  </Button>
                  <Button 
                    onClick={() => setFilters({
                      search: '',
                      entityType: 'all',
                      action: '',
                      userId: '',
                      days: '30'
                    })}
                    variant="outline"
                    size="sm"
                  >
                    Limpiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Máx. 50,000 registros por exportación
                </p>
              </div>
            </div>
            
            {/* Información de filtros activos */}
            {(filters.search || filters.entityType !== 'all' || filters.action || filters.days !== '30') && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Filtros activos:</strong>
                  {filters.search && ` Búsqueda: "${filters.search}"`}
                  {filters.entityType !== 'all' && ` | Módulo: ${filters.entityType}`}
                  {filters.action && ` | Acción: "${filters.action}"`}
                  {filters.days !== '30' && ` | Período: ${filters.days} días`}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabla de Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Logs de Auditoría
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Mostrando {logs.length} de {pagination.total} registros
              </div>
            </CardTitle>
            <CardDescription>
              Registro detallado de todas las actividades del sistema con información contextual
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 && !loading ? (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No hay logs de auditoría</h3>
                <p className="text-muted-foreground mb-4">
                  No se encontraron registros con los filtros aplicados
                </p>
                <Button
                  variant="outline"
                  onClick={() => setFilters({
                    search: '',
                    entityType: 'all',
                    action: '',
                    userId: '',
                    days: '30'
                  })}
                >
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <DataTable
                data={logs}
                columns={auditColumns}
                loading={loading}
                searchable={false}
                pagination={{
                  page: pagination.page,
                  limit: pagination.limit,
                  total: pagination.total,
                  onPageChange: (page) => loadAuditData(page, pagination.limit),
                  onLimitChange: (limit) => loadAuditData(1, limit)
                }}
                emptyState={{
                  icon: <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
                  title: "No hay logs de auditoría",
                  description: "No se encontraron registros con los filtros aplicados"
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Detalles */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Detalles del Registro de Auditoría
            </DialogTitle>
            <DialogDescription>
              Información completa del evento registrado
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 mt-4">
              {/* Información básica */}
              <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Acción:</span>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <span className="font-semibold">Tipo de Entidad:</span>{' '}
                  <span className="text-muted-foreground">{selectedLog.entityType}</span>
                </div>
                {selectedLog.entityId && (
                  <div>
                    <span className="font-semibold">
                      {selectedLog.entityType === 'user' ? 'Usuario Afectado:' : 
                       selectedLog.entityType === 'ticket' ? 'Ticket:' :
                       selectedLog.entityType === 'category' ? 'Categoría:' :
                       selectedLog.entityType === 'department' ? 'Departamento:' :
                       'ID de Entidad:'}
                    </span>{' '}
                    {/* PRIORIDAD 1: Usar entityName si está disponible (ya resuelto) */}
                    {selectedLog.details?.entityName ? (
                      <span className="text-muted-foreground font-medium text-blue-600">
                        {selectedLog.details.entityName}
                      </span>
                    ) : /* PRIORIDAD 2: Usar nombres específicos del details */
                      selectedLog.entityType === 'user' && selectedLog.details?.userName ? (
                      <span className="text-muted-foreground">
                        {selectedLog.details.userName}
                        {selectedLog.details.userEmail && (
                          <span className="text-xs ml-2">({selectedLog.details.userEmail})</span>
                        )}
                      </span>
                    ) : selectedLog.entityType === 'ticket' && selectedLog.details?.ticketTitle ? (
                      <span className="text-muted-foreground">
                        {selectedLog.details.ticketTitle}
                      </span>
                    ) : selectedLog.entityType === 'category' && selectedLog.details?.categoryName ? (
                      <span className="text-muted-foreground">
                        {selectedLog.details.categoryName}
                      </span>
                    ) : selectedLog.entityType === 'department' && selectedLog.details?.departmentName ? (
                      <span className="text-muted-foreground">
                        {selectedLog.details.departmentName}
                      </span>
                    ) : /* FALLBACK: Mostrar UUID solo si no hay nada más */
                    (
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {selectedLog.entityId}
                      </code>
                    )}
                  </div>
                )}
                <div>
                  <span className="font-semibold">Fecha:</span>{' '}
                  <span className="text-muted-foreground">
                    {new Date(selectedLog.createdAt).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                </div>
                {selectedLog.users && (
                  <div>
                    <span className="font-semibold">Usuario:</span>{' '}
                    <span className="text-muted-foreground">
                      {selectedLog.users.name} ({selectedLog.users.email})
                    </span>
                  </div>
                )}
                {selectedLog.ipAddress && (
                  <div>
                    <span className="font-semibold">IP:</span>{' '}
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                      {selectedLog.ipAddress}
                    </code>
                  </div>
                )}
              </div>

              {/* Detalles formateados */}
              {selectedLog.details && (
                <div className="border-t pt-4">
                  <AuditDetailsResolver details={selectedLog.details} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  )
}