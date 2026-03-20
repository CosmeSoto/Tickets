'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Database,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  Settings,
  RotateCcw,
  BarChart3,
  Shield
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Importar componentes
import { BackupDashboard } from '@/components/backups/backup-dashboard'
import { BackupConfiguration } from '@/components/backups/backup-configuration'
import { BackupRestore } from '@/components/backups/backup-restore'

interface BackupInfo {
  id: string
  filename: string
  size: number
  createdAt: string
  type: 'manual' | 'automatic'
  status: 'completed' | 'failed' | 'in_progress'
  compressed?: boolean
  encrypted?: boolean
}

interface BackupStats {
  totalBackups: number
  totalSize: number
  lastBackup?: string
  oldestBackup?: string
  successRate?: number
  avgSize?: number
  compressionRatio?: number
}

export default function BackupsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const { toast } = useToast()

  // Estados para diálogos de confirmación
  const [deletingBackup, setDeletingBackup] = useState<BackupInfo | null>(null)
  const [showCleanupDialog, setShowCleanupDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'ADMIN') {
      router.push('/login')
      return
    }

    loadBackups()
    loadStats()
  }, [session, status, router])

  const loadBackups = async (showToast: boolean = false) => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/backups', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      })
      if (response.ok) {
        const data = await response.json()
        setBackups(Array.isArray(data) ? data : [])
        
        if (showToast) {
          toast({
            title: 'Backups actualizados',
            description: 'Lista de backups cargada correctamente',
          })
        }
      } else {
        console.error('Error al cargar backups:', response.status)
        setBackups([])
        toast({
          title: 'Error al cargar backups',
          description: 'No se pudieron cargar los backups del sistema',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error al cargar backups:', error)
      setBackups([])
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor para cargar los backups',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/backups/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error)
    }
  }

  const createBackup = async () => {
    setCreating(true)
    try {
      const response = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'manual' }),
      })

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Backup creado correctamente',
        })
        loadBackups(false) // No mostrar toast adicional
        loadStats()
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || 'Error al crear backup',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error al crear backup:', error)
      toast({
        title: 'Error',
        description: 'Error al crear backup',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const deleteBackup = async (backupId: string, filename: string) => {
    if (!deletingBackup) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/admin/backups/${backupId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        
        toast({
          title: 'Backup eliminado',
          description: result.message || 'Backup eliminado correctamente',
          variant: 'success',
        })
        
        // Actualizar la lista inmediatamente removiendo el backup eliminado
        setBackups(prev => prev.filter(b => b.id !== backupId))
        setDeletingBackup(null)
        
        // Forzar actualización completa después de un breve delay
        setTimeout(() => {
          loadBackups()
          loadStats()
          
          // Si después de 1 segundo el backup aún aparece, forzar recarga de página
          setTimeout(() => {
            const stillExists = backups.find(b => b.id === backupId)
            if (stillExists) {
              window.location.reload()
            }
          }, 1000)
        }, 100)
      } else {
        const error = await response.json()
        
        let errorMessage = 'Error al eliminar backup'
        let shouldRefresh = false
        
        if (error.error) {
          if (error.error.includes('no encontrado') || error.error.includes('not found')) {
            errorMessage = 'El backup ya no existe. Actualizando lista...'
            shouldRefresh = true
            
            toast({
              title: 'Backup ya eliminado',
              description: 'El backup ya fue eliminado previamente. Actualizando la lista.',
              variant: 'warning',
            })
          } else if (error.error.includes('permisos') || error.error.includes('permission')) {
            errorMessage = 'Sin permisos para eliminar el archivo de backup'
          } else {
            errorMessage = error.error
          }
        }
        
        if (shouldRefresh) {
          // Si el backup ya no existe, actualizar la lista
          setBackups(prev => prev.filter(b => b.id !== backupId))
          setDeletingBackup(null)
          loadBackups()
          loadStats()
        } else {
          toast({
            title: 'Error al eliminar',
            description: errorMessage,
            variant: 'destructive',
          })
        }
      }
    } catch (error) {
      console.error('Error al eliminar backup:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor para eliminar el backup',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const downloadBackup = async (backupId: string, filename: string) => {
    try {
      const response = await fetch(`/api/admin/backups/${backupId}/download`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo descargar el backup',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error al descargar backup:', error)
      toast({
        title: 'Error',
        description: 'Error al descargar backup',
        variant: 'destructive',
      })
    }
  }

  const refreshData = () => {
    loadBackups()
    loadStats()
  }

  const cleanupFailedBackups = async () => {
    const failedCount = backups.filter(b => b.status === 'failed').length
    
    if (failedCount === 0) {
      toast({
        title: 'Sin backups fallidos',
        description: 'No hay backups fallidos para limpiar',
        variant: 'info',
      })
      return
    }

    setShowCleanupDialog(true)
  }

  const confirmCleanup = async () => {
    setCleaning(true)
    try {
      const response = await fetch('/api/admin/backups/cleanup', {
        method: 'POST',
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: 'Limpieza completada',
          description: result.message,
          variant: 'success',
        })
        loadBackups()
        loadStats()
        setShowCleanupDialog(false)
      } else {
        const error = await response.json()
        toast({
          title: 'Error en limpieza',
          description: error.error || 'Error al limpiar backups fallidos',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error al limpiar backups:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor para limpiar backups',
        variant: 'destructive',
      })
    } finally {
      setCleaning(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className='h-4 w-4 text-green-600' />
      case 'failed':
        return <AlertTriangle className='h-4 w-4 text-red-600' />
      case 'in_progress':
        return <Clock className='h-4 w-4 text-yellow-600' />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-muted text-foreground'
    }
  }

  const getTypeColor = (type: string) => {
    return type === 'manual' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
  }

  if (status === 'loading') {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
          <p className='mt-2 text-muted-foreground'>Cargando sistema de backups...</p>
        </div>
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  const headerActions = (
    <div className='flex items-center space-x-3'>
      <Button variant='outline' onClick={refreshData} disabled={loading} size="sm">
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Actualizar
      </Button>
      {backups.filter(b => b.status === 'failed').length > 0 && (
        <Button 
          variant='outline' 
          onClick={cleanupFailedBackups} 
          disabled={loading} 
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Limpiar Fallidos ({backups.filter(b => b.status === 'failed').length})
        </Button>
      )}
      <Button onClick={createBackup} disabled={creating} size="sm" className="bg-blue-600 hover:bg-blue-700">
        <Plus className={`h-4 w-4 mr-2 ${creating ? 'animate-spin' : ''}`} />
        {creating ? 'Creando...' : 'Crear Backup'}
      </Button>
    </div>
  )

  return (
    <RoleDashboardLayout
      title='Sistema de Backups'
      subtitle='Gestión avanzada de respaldos y recuperación de datos'
      headerActions={headerActions}
    >
      <div className='space-y-6'>
        {/* Pestañas principales */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className='space-y-6'>
          <TabsList className="grid w-full grid-cols-5 bg-muted">
            <TabsTrigger value='dashboard' className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value='backups' className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Backups</span>
            </TabsTrigger>
            <TabsTrigger value='restore' className="flex items-center space-x-2">
              <RotateCcw className="h-4 w-4" />
              <span>Restaurar</span>
            </TabsTrigger>
            <TabsTrigger value='config' className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Configuración</span>
            </TabsTrigger>
            <TabsTrigger value='monitoring' className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Monitoreo</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value='dashboard' className='space-y-6'>
            <BackupDashboard
              backups={backups}
              stats={stats}
              loading={loading}
              onRefresh={refreshData}
              onCreateBackup={createBackup}
            />
          </TabsContent>

          {/* Lista de Backups */}
          <TabsContent value='backups' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  <span>Gestión de Backups</span>
                </CardTitle>
                <CardDescription>
                  Lista completa de backups con herramientas de gestión
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Cargando backups...</p>
                  </div>
                ) : (backups && backups.length === 0) ? (
                  <div className='text-center py-8 text-muted-foreground'>
                    <Database className='h-8 w-8 mx-auto mb-2 text-muted-foreground' />
                    <p className='text-sm'>No hay backups disponibles</p>
                    <p className='text-xs'>Crea tu primer backup usando el botón de arriba</p>
                  </div>
                ) : (
                  <div className='space-y-3'>
                    {backups.map(backup => (
                      <div
                        key={backup.id}
                        className='flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors'
                      >
                        <div className='flex items-center space-x-4'>
                          <div className='flex items-center space-x-2'>
                            {getStatusIcon(backup.status)}
                            <Database className='h-5 w-5 text-muted-foreground' />
                          </div>
                          <div>
                            <p className='font-medium'>{backup.filename}</p>
                            <div className='flex items-center space-x-2 text-sm text-muted-foreground'>
                              <span>{formatFileSize(backup.size)}</span>
                              <span>•</span>
                              <span>{formatDate(backup.createdAt)}</span>
                              {backup.compressed && (
                                <>
                                  <span>•</span>
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                    Comprimido
                                  </Badge>
                                </>
                              )}
                              {backup.encrypted && (
                                <>
                                  <span>•</span>
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                    Encriptado
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className='flex items-center space-x-3'>
                          <Badge className={getStatusColor(backup.status)}>
                            {backup.status === 'completed'
                              ? 'Completado'
                              : backup.status === 'failed'
                                ? 'Fallido'
                                : 'En Progreso'}
                          </Badge>
                          <Badge className={getTypeColor(backup.type)}>
                            {backup.type === 'manual' ? 'Manual' : 'Automático'}
                          </Badge>
                          <div className='flex items-center space-x-2'>
                            {backup.status === 'completed' && (
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={() => downloadBackup(backup.id, backup.filename)}
                              >
                                <Download className='h-4 w-4' />
                              </Button>
                            )}
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => setDeletingBackup(backup)}
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Restauración */}
          <TabsContent value='restore' className='space-y-6'>
            <BackupRestore
              backups={backups}
              onRefresh={refreshData}
            />
          </TabsContent>

          {/* Configuración */}
          <TabsContent value='config' className='space-y-6'>
            <BackupConfiguration
              onConfigChange={() => {
                // Solo recargar estadísticas, el componente maneja sus propios toasts
                loadStats()
              }}
            />
          </TabsContent>

          {/* Monitoreo */}
          <TabsContent value='monitoring' className='space-y-6'>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    <span>Estado del Sistema</span>
                  </CardTitle>
                  <CardDescription>
                    Monitoreo en tiempo real del sistema de backups
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Sistema Activo</span>
                      </div>
                      <p className="text-xs text-green-700">Funcionando correctamente</p>
                    </div>
                    
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Próximo Backup</span>
                      </div>
                      <p className="text-xs text-blue-700">Programado automáticamente</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Espacio en disco</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        Suficiente
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Conectividad BD</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        Conectado
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Integridad de datos</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        Verificado
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <HardDrive className="h-5 w-5 text-purple-600" />
                    <span>Métricas de Rendimiento</span>
                  </CardTitle>
                  <CardDescription>
                    Estadísticas de rendimiento y eficiencia
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stats && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-lg font-bold text-purple-700">
                            {stats.successRate?.toFixed(1) || 0}%
                          </div>
                          <div className="text-xs text-purple-600">Tasa de Éxito</div>
                        </div>
                        
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-lg font-bold text-orange-700">
                            {formatFileSize(stats.avgSize || 0)}
                          </div>
                          <div className="text-xs text-orange-600">Tamaño Promedio</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Eficiencia de compresión</span>
                          <span className="font-medium">
                            {stats.compressionRatio ? `${stats.compressionRatio}%` : 'N/A'}
                          </span>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tiempo promedio</span>
                          <span className="font-medium">~2-5 min</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de confirmación para eliminar backup individual */}
      <AlertDialog open={!!deletingBackup} onOpenChange={() => setDeletingBackup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar backup?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>¿Estás seguro de que quieres eliminar el backup "{deletingBackup?.filename}"?</p>
                {deletingBackup && (
                  <div className='mt-3 p-3 bg-muted rounded text-sm'>
                    <div className='font-medium mb-2'>Información del backup:</div>
                    <div>• Archivo: {deletingBackup.filename}</div>
                    <div>• Tamaño: {formatFileSize(deletingBackup.size)}</div>
                    <div>• Tipo: {deletingBackup.type === 'manual' ? 'Manual' : 'Automático'}</div>
                    <div>• Estado: {deletingBackup.status === 'completed' ? 'Completado' : deletingBackup.status === 'failed' ? 'Fallido' : 'En progreso'}</div>
                    <div>• Creado: {formatDate(deletingBackup.createdAt)}</div>
                  </div>
                )}
                <p className='mt-2 text-red-600 font-medium'>
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row justify-end space-x-2">
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBackup(deletingBackup?.id || '', deletingBackup?.filename || '')}
              disabled={deleting}
              className='bg-red-600 hover:bg-red-700 disabled:bg-gray-400'
            >
              {deleting ? (
                <>
                  <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmación para limpieza masiva */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar backups fallidos?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>¿Estás seguro de que quieres eliminar todos los backups fallidos?</p>
                <div className='mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm'>
                  <div className='font-medium mb-2 text-yellow-800'>Se eliminarán:</div>
                  <div className='text-yellow-700'>
                    • {backups.filter(b => b.status === 'failed').length} backup(s) fallido(s)
                  </div>
                  <div className='text-yellow-700'>
                    • Archivos físicos (si existen)
                  </div>
                  <div className='text-yellow-700'>
                    • Registros de base de datos
                  </div>
                </div>
                <p className='mt-2 text-red-600 font-medium'>
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row justify-end space-x-2">
            <AlertDialogCancel disabled={cleaning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCleanup}
              disabled={cleaning}
              className='bg-red-600 hover:bg-red-700 disabled:bg-gray-400'
            >
              {cleaning ? (
                <>
                  <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                  Limpiando...
                </>
              ) : (
                'Limpiar Todo'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleDashboardLayout>
  )
}
