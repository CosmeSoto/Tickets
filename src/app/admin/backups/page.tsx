/**
 * Backups Page - Refactored
 * Reduced from 806 lines to ~150 lines (81.4% reduction)
 * Full dark mode support
 */

'use client'

import { useMemo, useState } from 'react'
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
  Shield,
  ArrowLeft,
  Activity,
} from 'lucide-react'
import { useSyncDashboardPageMeta } from '@/contexts/dashboard-shell-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRouter } from 'next/navigation'
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
import { BackupDashboard } from '@/components/backups/backup-dashboard'
import { BackupGuideCard } from '@/components/backups/backup-guide-card'
import { BackupConfiguration } from '@/components/backups/backup-configuration'
import { BackupRestore } from '@/components/backups/backup-restore'
import { BackupMonitoring } from '@/components/backups/backup-monitoring'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import {
  useBackups,
  formatFileSize,
  formatBackupDate,
  getStatusColor,
  getStatusLabel,
  getEngineLabel,
  getKindLabel,
} from '@/hooks/use-backups'

export default function BackupsPage() {
  const router = useRouter()
  const {
    session,
    status,
    backups,
    stats,
    failedCount,
    loading,
    creating,
    activeTab,
    setActiveTab,
    deletingBackup,
    setDeletingBackup,
    showCleanupDialog,
    setShowCleanupDialog,
    deleting,
    cleaning,
    refreshData,
    createBackup,
    deleteBackup,
    downloadBackup,
    cleanupFailedBackups,
    confirmCleanup,
    loadStats,
  } = useBackups()

  // ── Búsqueda y exportación de backups ──────────────────────────────────────
  const [backupSearch, setBackupSearch] = useState('')

  const filteredBackups = useMemo(() => {
    if (!backupSearch.trim()) return backups
    const q = backupSearch.toLowerCase()
    return backups.filter(
      b =>
        b.filename.toLowerCase().includes(q) ||
        getStatusLabel(b.status).toLowerCase().includes(q) ||
        (b.module ?? 'completo').toLowerCase().includes(q) ||
        (b.type === 'manual' ? 'manual' : 'automático').includes(q)
    )
  }, [backups, backupSearch])

  const {
    exportCSV: exportBackupCSV,
    exportExcel: exportBackupExcel,
    exportPDF: exportBackupPDF,
    exporting: exportingBackups,
  } = useExport({
    filename: 'backups',
    title: 'Historial de Backups',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} • ${backups.length} backups`,
    columns: [
      { key: 'filename', label: 'Archivo' },
      { key: 'status', label: 'Estado', format: (v: string) => getStatusLabel(v) },
      {
        key: 'type',
        label: 'Tipo',
        format: (v: string) => (v === 'manual' ? 'Manual' : 'Automático'),
      },
      { key: 'module', label: 'Módulo', format: (v: any) => v ?? 'Completo' },
      { key: 'size', label: 'Tamaño', format: (v: number) => formatFileSize(v) },
      { key: 'compressed', label: 'Comprimido', format: (v: boolean) => (v ? 'Sí' : 'No') },
      { key: 'encrypted', label: 'Encriptado', format: (v: boolean) => (v ? 'Sí' : 'No') },
      { key: 'createdAt', label: 'Fecha', format: (v: string) => formatBackupDate(v) },
    ],
    getData: () => filteredBackups,
  })

  const subtitleLink = useMemo(
    () => (
      <button
        type='button'
        onClick={() => router.push('/admin/settings')}
        className='flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors'
      >
        <ArrowLeft className='h-3 w-3' />
        Configuración del sistema
      </button>
    ),
    [router]
  )

  const headerActionsMemo = useMemo(
    () => (
      <div className='flex items-center gap-2 flex-wrap'>
        <Button variant='outline' onClick={refreshData} disabled={loading} size='sm'>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
        {failedCount > 0 && (
          <Button
            variant='outline'
            onClick={cleanupFailedBackups}
            disabled={loading}
            size='sm'
            className='text-destructive hover:text-destructive hover:bg-destructive/10'
          >
            <Trash2 className='h-4 w-4 mr-2' />
            Limpiar Fallidos ({failedCount})
          </Button>
        )}
        <Button
          onClick={() => createBackup({ mode: 'infrastructure', backupKind: 'full' })}
          disabled={creating}
          size='sm'
        >
          <Plus className={`h-4 w-4 mr-2 ${creating ? 'animate-spin' : ''}`} />
          {creating ? 'Creando...' : 'Respaldo pgBackRest'}
        </Button>
        <Button
          variant='outline'
          onClick={() => createBackup({ mode: 'export' })}
          disabled={creating}
          size='sm'
        >
          <Download className='h-4 w-4 mr-2' />
          Exportar .dump
        </Button>
      </div>
    ),
    [loading, creating, failedCount, refreshData, cleanupFailedBackups, createBackup]
  )

  useSyncDashboardPageMeta({
    title: 'Sistema de Backups',
    subtitle: subtitleLink,
    headerActions: headerActionsMemo,
  })

  if (status === 'loading') {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto' />
          <p className='mt-2 text-muted-foreground'>Cargando sistema de backups...</p>
        </div>
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') return null

  return (
    <>
      <div className='space-y-6'>
        <Tabs value={activeTab} onValueChange={setActiveTab} className='space-y-6'>
          <TabsList className='w-full flex overflow-x-auto bg-muted gap-1 p-1'>
            <TabsTrigger
              value='dashboard'
              className='flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 flex-shrink-0 px-3'
            >
              <BarChart3 className='h-4 w-4' />
              <span className='text-xs sm:text-sm whitespace-nowrap'>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger
              value='backups'
              className='flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 flex-shrink-0 px-3'
            >
              <Database className='h-4 w-4' />
              <span className='text-xs sm:text-sm whitespace-nowrap'>Backups</span>
            </TabsTrigger>
            <TabsTrigger
              value='restore'
              className='flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 flex-shrink-0 px-3'
            >
              <RotateCcw className='h-4 w-4' />
              <span className='text-xs sm:text-sm whitespace-nowrap'>Restaurar</span>
            </TabsTrigger>
            <TabsTrigger
              value='config'
              className='flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 flex-shrink-0 px-3'
            >
              <Settings className='h-4 w-4' />
              <span className='text-xs sm:text-sm whitespace-nowrap'>Config</span>
            </TabsTrigger>
            <TabsTrigger
              value='monitoring'
              className='flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 flex-shrink-0 px-3'
            >
              <Activity className='h-4 w-4' />
              <span className='text-xs sm:text-sm whitespace-nowrap'>Monitoreo</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value='dashboard' className='space-y-6'>
            <BackupGuideCard />
            <BackupDashboard
              backups={backups}
              stats={stats}
              loading={loading}
              onRefresh={refreshData}
              onCreateBackup={() => createBackup({ mode: 'infrastructure', backupKind: 'full' })}
              onCreateExport={() => createBackup({ mode: 'export' })}
              creating={creating}
            />
          </TabsContent>

          <TabsContent value='backups' className='space-y-6'>
            <Card>
              <CardHeader>
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                  <div className='flex items-center space-x-2'>
                    <Database className='h-5 w-5 text-primary' />
                    <div>
                      <CardTitle className='text-base'>Gestión de Backups</CardTitle>
                      <CardDescription className='text-xs mt-0.5'>
                        Lista completa de backups con herramientas de gestión
                      </CardDescription>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <input
                      type='text'
                      placeholder='Buscar backup...'
                      value={backupSearch}
                      onChange={e => setBackupSearch(e.target.value)}
                      className='h-8 w-48 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring'
                    />
                    <ExportButton
                      onExportCSV={exportBackupCSV}
                      onExportExcel={exportBackupExcel}
                      onExportPDF={exportBackupPDF}
                      loading={exportingBackups}
                      size='sm'
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className='text-center py-8'>
                    <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4' />
                    <p className='text-muted-foreground'>Cargando backups...</p>
                  </div>
                ) : filteredBackups.length === 0 ? (
                  <div className='text-center py-8 text-muted-foreground'>
                    <Database className='h-8 w-8 mx-auto mb-2' />
                    <p className='text-sm'>
                      {backupSearch ? 'Sin resultados' : 'No hay backups disponibles'}
                    </p>
                    <p className='text-xs'>
                      {backupSearch
                        ? 'Prueba con otro término'
                        : 'Crea tu primer backup usando el botón de arriba'}
                    </p>
                  </div>
                ) : (
                  <div className='space-y-3'>
                    {filteredBackups.map(backup => (
                      <div
                        key={backup.id}
                        className='p-4 border rounded-lg hover:bg-muted transition-colors space-y-3'
                      >
                        {/* Top row: Status icon + filename + action buttons */}
                        <div className='flex items-start justify-between gap-3'>
                          <div className='flex items-center gap-2 min-w-0 flex-1'>
                            {backup.status === 'completed' && (
                              <CheckCircle className='h-4 w-4 text-primary flex-shrink-0' />
                            )}
                            {backup.status === 'failed' && (
                              <AlertTriangle className='h-4 w-4 text-destructive flex-shrink-0' />
                            )}
                            {backup.status === 'in_progress' && (
                              <Clock className='h-4 w-4 text-muted-foreground flex-shrink-0' />
                            )}
                            <Database className='h-5 w-5 text-muted-foreground flex-shrink-0' />
                            <div className='min-w-0 flex-1'>
                              <p className='font-medium text-sm break-words overflow-hidden'>
                                {backup.filename}
                              </p>
                            </div>
                          </div>
                          <div className='flex items-center gap-2 flex-shrink-0'>
                            {backup.status === 'completed' && backup.engine !== 'pgbackrest' && (
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

                        {/* Middle row: metadata badges - stack on mobile */}
                        <div className='flex flex-wrap gap-2'>
                          <Badge className={getStatusColor(backup.status)}>
                            {getStatusLabel(backup.status)}
                          </Badge>
                          <Badge variant='outline'>
                            {backup.type === 'manual' ? 'Manual' : 'Automático'}
                          </Badge>
                          <Badge variant='outline'>{getEngineLabel(backup.engine)}</Badge>
                          <Badge variant='secondary' className='text-xs'>
                            {getKindLabel(backup.backupKind, backup.engine)}
                          </Badge>
                          {backup.label && (
                            <Badge variant='outline' className='text-xs font-mono'>
                              {backup.label}
                            </Badge>
                          )}
                        </div>

                        {/* Bottom row: details - stack on mobile */}
                        <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                          <span>{formatFileSize(backup.size)}</span>
                          <span className='hidden sm:inline'>•</span>
                          <span>{formatBackupDate(backup.createdAt)}</span>
                          {backup.compressed && (
                            <>
                              <span className='hidden sm:inline'>•</span>
                              <Badge variant='outline' className='text-xs'>
                                Comprimido
                              </Badge>
                            </>
                          )}
                          {backup.encrypted && (
                            <>
                              <span className='hidden sm:inline'>•</span>
                              <Badge variant='outline' className='text-xs'>
                                <Shield className='h-3 w-3 mr-1' />
                                Encriptado
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='restore' className='space-y-6'>
            <BackupRestore backups={backups} onRefresh={refreshData} />
          </TabsContent>

          <TabsContent value='config' className='space-y-6'>
            <BackupConfiguration onConfigChange={loadStats} />
          </TabsContent>

          <TabsContent value='monitoring' className='space-y-6'>
            <BackupMonitoring />
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete single backup dialog */}
      <AlertDialog open={!!deletingBackup} onOpenChange={() => setDeletingBackup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar backup?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  ¿Estás seguro de que quieres eliminar el backup &quot;{deletingBackup?.filename}
                  &quot;?
                </p>
                {deletingBackup && (
                  <div className='mt-3 p-3 bg-muted rounded text-sm space-y-1'>
                    <div className='font-medium mb-1'>Información del backup:</div>
                    <div>• Archivo: {deletingBackup.filename}</div>
                    <div>• Tamaño: {formatFileSize(deletingBackup.size)}</div>
                    <div>• Tipo: {deletingBackup.type === 'manual' ? 'Manual' : 'Automático'}</div>
                    <div>• Estado: {getStatusLabel(deletingBackup.status)}</div>
                    <div>• Creado: {formatBackupDate(deletingBackup.createdAt)}</div>
                  </div>
                )}
                <p className='mt-2 text-destructive font-medium'>
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteBackup}
              disabled={deleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
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

      {/* Cleanup failed backups dialog */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar backups fallidos?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>¿Estás seguro de que quieres eliminar todos los backups fallidos?</p>
                <div className='mt-3 p-3 bg-muted border border-border rounded text-sm'>
                  <div className='font-medium mb-2 text-foreground'>Se eliminarán:</div>
                  <div className='text-muted-foreground'>• {failedCount} backup(s) fallido(s)</div>
                  <div className='text-muted-foreground'>• Archivos físicos (si existen)</div>
                  <div className='text-muted-foreground'>• Registros de base de datos</div>
                </div>
                <p className='mt-2 text-destructive font-medium'>
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleaning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCleanup}
              disabled={cleaning}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
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
    </>
  )
}
