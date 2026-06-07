'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  MapPin,
  Monitor,
  Pencil,
  Download,
  PowerOff,
  Power,
  Loader2,
  Trash2,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'
import { ExportButton } from '@/components/common/export-button'
import { useModuleData } from '@/hooks/common/use-module-data'
import { usePagination } from '@/hooks/common/use-pagination'
import { useExport } from '@/hooks/common/use-export'
import { createCheckpointColumns } from '@/components/patrols/patrol-columns'
import { PATROL_CHECKPOINTS_EXPORT_COLUMNS } from '@/lib/utils/patrol-utils'
import { QRPrintDialog } from '@/components/common/qr/qr-print-dialog'
import {
  CheckpointFormDialog,
  CheckpointDisplayDialog,
  useCheckpoints,
  Checkpoint,
} from '@/components/patrols/checkpoints'
import type { Family } from '@/components/patrols/types'

export default function CheckpointsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true

  const [families, setFamilies] = useState<Family[]>([])
  const [includeInactive, setIncludeInactive] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Build endpoint with params
  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    params.append('limit', '100')
    if (includeInactive) params.append('includeInactive', 'true')
    if (debouncedSearch) params.append('search', debouncedSearch)
    return `/api/patrols/checkpoints?${params.toString()}`
  }, [debouncedSearch, includeInactive])

  // Fetch data with useModuleData
  const {
    data: checkpointsRaw,
    loading,
    error,
    reload,
  } = useModuleData<Checkpoint>({
    endpoint,
    initialLoad: true,
  })

  const checkpoints = checkpointsRaw || []

  // Use our custom hook for checkpoint logic
  const {
    dialogOpen,
    setDialogOpen,
    editingId,
    setEditingId,
    saving,
    deactivatingId,
    setDeactivatingId,
    reactivatingId,
    setReactivatingId,
    permanentlyDeletingId,
    setPermanentlyDeletingId,
    downloadingQrId,
    displayModalOpen,
    setDisplayModalOpen,
    selectedCheckpointForDisplay,
    printDialogOpen,
    setPrintDialogOpen,
    printItem,
    selectedIds,
    setSelectedIds,
    bulkPrinting,
    openCreate,
    openEdit,
    handleSave,
    handleDeactivate,
    handleReactivate,
    handlePermanentDelete,
    handleDownloadQR,
    handlePrintQR,
    toggleSelection,
    toggleSelectAll,
    handleBulkPrint,
    copyDisplayUrl,
    openDisplayModal,
  } = useCheckpoints({ checkpoints, reload })

  // Pagination
  const pagination = usePagination(checkpoints, { pageSize: 20 })

  // Export
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'checkpoints-patrullas',
    title: 'Checkpoints',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} • ${checkpoints.length} checkpoints`,
    getData: () => checkpoints,
    columns: PATROL_CHECKPOINTS_EXPORT_COLUMNS,
  })

  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/families?includeInactive=false&module=patrols')
      const data = await res.json()
      if (data.success) setFamilies(data.data)
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    fetchFamilies()
  }, [session, status, router, fetchFamilies])

  if (status === 'loading' || !session) return null

  // Create columns with callbacks
  const columns = createCheckpointColumns({
    onEdit: openEdit,
    onDownloadQR: handleDownloadQR,
    onDeactivate: id => setDeactivatingId(id),
    onReactivate: id => setReactivatingId(id),
    onPermanentDelete: id => setPermanentlyDeletingId(id),
    onOpenDisplay: openDisplayModal,
    downloadingQrId,
    isSuperAdmin,
  })

  // Columna de selección para bulk print — se antepone al resto
  const selectionColumn = {
    key: '__select__' as keyof Checkpoint,
    label: '',
    width: '32px',
    render: (cp: Checkpoint) =>
      cp.isActive ? (
        <input
          type='checkbox'
          checked={selectedIds.has(cp.id)}
          onChange={() => toggleSelection(cp.id)}
          onClick={e => e.stopPropagation()}
          className='h-4 w-4 accent-primary cursor-pointer'
          aria-label={`Seleccionar ${cp.name}`}
        />
      ) : null,
  }

  const columnsWithSelection = [selectionColumn, ...columns] as typeof columns

  // Pagination config
  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: checkpoints.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  return (
    <ModuleLayout
      title='Checkpoints'
      subtitle='Puntos de control físicos para patrullaje'
      loading={loading && checkpoints.length === 0}
      error={error}
      onRetry={reload}
      headerActions={
        <Button size='sm' onClick={openCreate}>
          <Plus className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>Nuevo Checkpoint</span>
        </Button>
      }
    >
      {/* Filtros custom */}
      <div className='flex flex-col sm:flex-row gap-3 mb-4'>
        <div className='relative flex-1'>
          <Input
            placeholder='Buscar checkpoints...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className='flex items-center gap-2'>
          <Switch
            id='show-inactive-cp'
            checked={includeInactive}
            onCheckedChange={v => {
              setIncludeInactive(v)
              pagination.goToPage(1)
            }}
          />
          <Label htmlFor='show-inactive-cp' className='text-sm cursor-pointer'>
            Mostrar inactivos
          </Label>
        </div>
      </div>

      {/* --- Barra de selección bulk --- */}
      {checkpoints.some(cp => cp.isActive) && (
        <div className='flex items-center gap-3 mb-3'>
          <label className='flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none'>
            <input
              type='checkbox'
              className='h-4 w-4 accent-primary cursor-pointer'
              checked={
                checkpoints.filter(cp => cp.isActive).length > 0 &&
                checkpoints.filter(cp => cp.isActive).every(cp => selectedIds.has(cp.id))
              }
              onChange={toggleSelectAll}
              aria-label='Seleccionar todos los checkpoints activos'
            />
            {selectedIds.size > 0
              ? `${selectedIds.size} seleccionado${selectedIds.size > 1 ? 's' : ''}`
              : 'Seleccionar todos'}
          </label>

          {selectedIds.size > 0 && (
            <Button
              size='sm'
              variant='outline'
              onClick={handleBulkPrint}
              disabled={bulkPrinting}
              className='gap-2'
            >
              {bulkPrinting ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Printer className='h-3.5 w-3.5' />
              )}
              Imprimir {selectedIds.size} QR{selectedIds.size > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      )}

      {/* DataTable */}
      <DataTable
        title='Checkpoints'
        description={`Gestión de puntos de control (${checkpoints.length} checkpoints)`}
        data={checkpoints}
        columns={columnsWithSelection}
        loading={loading}
        error={error}
        pagination={paginationConfig}
        onRefresh={reload}
        externalSearch={true}
        hideInternalFilters={true}
        onRowClick={openEdit}
        rowActions={(cp: Checkpoint) => (
          <div className='flex items-center gap-1'>
            <Button size='sm' variant='ghost' onClick={() => openEdit(cp)}>
              <Pencil className='h-3.5 w-3.5' />
            </Button>
            {cp.qrType === 'DYNAMIC' && cp.isActive && (
              <Button
                size='sm'
                variant='ghost'
                onClick={() => openDisplayModal(cp)}
                title='Ver pantalla'
              >
                <Monitor className='h-3.5 w-3.5' />
              </Button>
            )}
            <Button
              size='sm'
              variant='ghost'
              onClick={() => handleDownloadQR(cp)}
              disabled={downloadingQrId === cp.id}
              title='Descargar QR'
            >
              {downloadingQrId === cp.id ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Download className='h-3.5 w-3.5' />
              )}
            </Button>
            <Button size='sm' variant='ghost' onClick={() => handlePrintQR(cp)} title='Imprimir QR'>
              <Printer className='h-3.5 w-3.5' />
            </Button>
            {cp.isActive ? (
              <Button
                size='sm'
                variant='ghost'
                className='text-destructive hover:text-destructive'
                onClick={() => setDeactivatingId(cp.id)}
                title='Desactivar'
              >
                <PowerOff className='h-3.5 w-3.5' />
              </Button>
            ) : (
              <Button
                size='sm'
                variant='ghost'
                className='text-green-600 hover:text-green-700 dark:text-green-400'
                onClick={() => setReactivatingId(cp.id)}
                title='Reactivar'
              >
                <Power className='h-3.5 w-3.5' />
              </Button>
            )}
            {isSuperAdmin && (
              <Button
                size='sm'
                variant='ghost'
                className='text-red-700 hover:text-red-800 dark:text-red-500'
                onClick={() => setPermanentlyDeletingId(cp.id)}
                title='Eliminar permanentemente'
              >
                <Trash2 className='h-3.5 w-3.5' />
              </Button>
            )}
          </div>
        )}
        actions={
          <ExportButton
            onExportCSV={exportCSV}
            onExportExcel={exportExcel}
            onExportPDF={exportPDF}
            loading={exporting}
            disabled={checkpoints.length === 0}
          />
        }
        emptyState={{
          icon: <MapPin className='h-12 w-12 text-muted-foreground mx-auto mb-4' />,
          title: 'No hay checkpoints',
          description: 'Crea el primer checkpoint con el botón de arriba',
        }}
      />

      {/* --- Dialog crear/editar --- */}
      <CheckpointFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        families={families}
        checkpoints={checkpoints}
        onSave={handleSave}
        saving={saving}
      />

      {/* --- Confirm desactivar --- */}
      <AlertDialog open={!!deactivatingId} onOpenChange={() => setDeactivatingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar checkpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              El checkpoint no podrá agregarse a nuevas rutas, pero se preservará el historial de
              check-ins.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={() => deactivatingId && handleDeactivate(deactivatingId)}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- Confirm reactivar --- */}
      <AlertDialog open={!!reactivatingId} onOpenChange={() => setReactivatingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reactivar checkpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              El checkpoint podrá agregarse a nuevas rutas nuevamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-green-700 text-white hover:bg-green-800'
              onClick={() => reactivatingId && handleReactivate(reactivatingId)}
            >
              Reactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- Confirm eliminar permanentemente --- */}
      <AlertDialog
        open={!!permanentlyDeletingId}
        onOpenChange={() => setPermanentlyDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar checkpoint PERMANENTEMENTE?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El checkpoint se eliminará completamente de la base
              de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-red-700 text-white hover:bg-red-800'
              onClick={() => permanentlyDeletingId && handlePermanentDelete(permanentlyDeletingId)}
            >
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- Modal de pantalla QR --- */}
      <CheckpointDisplayDialog
        open={displayModalOpen}
        onOpenChange={setDisplayModalOpen}
        checkpoint={selectedCheckpointForDisplay}
        onCopyUrl={copyDisplayUrl}
      />

      {/* --- Diálogo de impresión individual --- */}
      <QRPrintDialog open={printDialogOpen} onOpenChange={setPrintDialogOpen} item={printItem} />
    </ModuleLayout>
  )
}
