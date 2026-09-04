'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { RefreshCw, Upload } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ListTableToolbar } from '@/components/common/list-table-toolbar'
import { useExport } from '@/hooks/common/use-export'
import { SupplierEvaluationImportDialog } from './SupplierEvaluationImportDialog'
import {
  QUALIFICATION_CRITERIA,
  type SupplierClassification,
} from '@/lib/inventory/supplier-qualification-shared'
import type { SupplierEvaluation } from '@/types/inventory/supplier-evaluation'

function classificationBadgeClass(c: SupplierClassification) {
  if (c === 'A')
    return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400'
  if (c === 'B')
    return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400'
  return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400'
}

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => currentYear + 1 - i)

export function SupplierEvaluationsTab() {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || (session?.user as any)?.isSuperAdmin === true
  const [importOpen, setImportOpen] = useState(false)
  const [evaluations, setEvaluations] = useState<SupplierEvaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [year, setYear] = useState('all')
  const [classification, setClassification] = useState('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1, limit: 50 })

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (search) params.set('search', search)
    if (year !== 'all') params.set('year', year)
    if (classification !== 'all') params.set('classification', classification)
    try {
      const res = await fetch(`/api/inventory/suppliers/evaluations?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvaluations(Array.isArray(data.evaluations) ? data.evaluations : [])
      if (data.pagination) setPagination(data.pagination)
    } catch {
      setEvaluations([])
    } finally {
      setLoading(false)
    }
  }, [search, year, classification, page])

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search, year, classification])

  useEffect(() => {
    load()
  }, [load])

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'calificacion-proveedores',
    title: 'Calificación de proveedores',
    getData: () => evaluations,
    columns: [
      { key: 'year', label: 'Año' },
      { key: 'supplier', label: 'Proveedor', format: v => v?.name ?? '' },
      { key: 'supplier', label: 'Mail', format: v => v?.email ?? '' },
      { key: 'supplier', label: 'Contacto', format: v => v?.contactName ?? v?.phone ?? '' },
      { key: 'detail', label: 'Detalle', format: v => v ?? '' },
      { key: 'quality', label: 'Calidad' },
      { key: 'creditTime', label: 'Tiempo de crédito' },
      { key: 'deliveryTime', label: 'Tiempo de entrega' },
      { key: 'price', label: 'Precio' },
      { key: 'references', label: 'Referencias' },
      { key: 'equipmentScore', label: 'Equipo' },
      { key: 'total', label: 'Totales' },
      { key: 'classification', label: 'Clasificación' },
    ],
  })

  return (
    <div className='space-y-6'>
      <ListTableToolbar
        title={
          <p className='text-sm text-muted-foreground'>
            {pagination.total} calificación{pagination.total !== 1 ? 'es' : ''} registrada
            {pagination.total !== 1 ? 's' : ''}
          </p>
        }
        loading={loading}
        onRefresh={load}
        showViewToggle={false}
        export={{
          onExportCSV: exportCSV,
          onExportExcel: exportExcel,
          onExportPDF: exportPDF,
          loading: exporting,
          disabled: evaluations.length === 0,
        }}
        endActions={
          isAdmin && (
            <Button variant='outline' onClick={() => setImportOpen(true)}>
              <Upload className='h-4 w-4 sm:mr-2' />
              <span className='hidden sm:inline'>Importar desde Excel</span>
            </Button>
          )
        }
      />

      <div className='flex flex-wrap gap-3'>
        <Input
          placeholder='Buscar por proveedor...'
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className='flex-1 min-w-[200px]'
        />
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className='w-full sm:w-32'>
            <SelectValue placeholder='Año' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos los años</SelectItem>
            {YEAR_OPTIONS.map(y => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={classification} onValueChange={setClassification}>
          <SelectTrigger className='w-full sm:w-44'>
            <SelectValue placeholder='Clasificación' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todas las clasificaciones</SelectItem>
            <SelectItem value='A'>Clasificación A</SelectItem>
            <SelectItem value='B'>Clasificación B</SelectItem>
            <SelectItem value='C'>Clasificación C</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className='overflow-x-auto rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Año</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className='hidden lg:table-cell'>Detalle</TableHead>
              {QUALIFICATION_CRITERIA.map(c => (
                <TableHead key={c.key} className='hidden xl:table-cell text-center' title={c.label}>
                  {c.label.split(' ')[0]}
                </TableHead>
              ))}
              <TableHead className='text-center'>Total</TableHead>
              <TableHead>Clasificación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className='text-center py-8 text-muted-foreground'>
                  <RefreshCw className='h-4 w-4 animate-spin mx-auto mb-2' />
                  Cargando...
                </TableCell>
              </TableRow>
            ) : evaluations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className='text-center py-8 text-muted-foreground'>
                  No se encontraron calificaciones
                </TableCell>
              </TableRow>
            ) : (
              evaluations.map(ev => (
                <TableRow
                  key={ev.id}
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => router.push(`/inventory/suppliers/${ev.supplierId}`)}
                >
                  <TableCell className='font-mono'>{ev.year}</TableCell>
                  <TableCell className='font-medium'>{ev.supplier?.name ?? '—'}</TableCell>
                  <TableCell className='hidden lg:table-cell text-muted-foreground'>
                    {ev.detail || '—'}
                  </TableCell>
                  <TableCell className='hidden xl:table-cell text-center'>{ev.quality}</TableCell>
                  <TableCell className='hidden xl:table-cell text-center'>
                    {ev.creditTime}
                  </TableCell>
                  <TableCell className='hidden xl:table-cell text-center'>
                    {ev.deliveryTime}
                  </TableCell>
                  <TableCell className='hidden xl:table-cell text-center'>{ev.price}</TableCell>
                  <TableCell className='hidden xl:table-cell text-center'>
                    {ev.references}
                  </TableCell>
                  <TableCell className='hidden xl:table-cell text-center'>
                    {ev.equipmentScore}
                  </TableCell>
                  <TableCell className='text-center font-medium'>{ev.total}</TableCell>
                  <TableCell>
                    <Badge
                      variant='outline'
                      className={classificationBadgeClass(ev.classification)}
                    >
                      {ev.classification}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination.pages > 1 && (
        <div className='flex items-center justify-between pt-2'>
          <p className='text-sm text-muted-foreground'>
            {pagination.total} calificación{pagination.total !== 1 ? 'es' : ''} en total
          </p>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </Button>
            <span className='text-sm text-muted-foreground'>
              Página {page} de {pagination.pages}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= pagination.pages || loading}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className='w-[min(98vw,52rem)] max-w-3xl max-h-[92vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Importar calificaciones desde Excel</DialogTitle>
          </DialogHeader>
          <SupplierEvaluationImportDialog
            onCancel={() => setImportOpen(false)}
            onDone={() => {
              setImportOpen(false)
              load()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
