/**
 * Hook reutilizable de exportación
 *
 * Recibe los datos ya filtrados (los mismos que se muestran en pantalla)
 * y las columnas con sus labels. Genera CSV, Excel o PDF con un clic.
 *
 * Uso:
 *   const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
 *     filename: 'mis-tickets',
 *     title: 'Mis Tickets',
 *     columns: [
 *       { key: 'title', label: 'Título' },
 *       { key: 'status', label: 'Estado', format: (v) => STATUS_LABELS[v] ?? v },
 *     ],
 *     getData: () => filteredTickets,   // función que devuelve los datos actuales
 *   })
 */

'use client'

import { useState, useCallback } from 'react'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils/export'
import type { ExportColumn } from '@/lib/utils/export'
import { useToast } from '@/hooks/use-toast'

export interface UseExportOptions<T = any> {
  /** Nombre base del archivo (sin extensión) */
  filename: string
  /** Título legible para el PDF y el nombre del archivo */
  title?: string
  /** Subtítulo / descripción para el PDF */
  subtitle?: string
  /** Definición de columnas a exportar */
  columns: ExportColumn[]
  /** Función que devuelve los datos actuales (ya filtrados) */
  getData: () => T[]
}

export interface UseExportReturn {
  exportCSV: () => void
  exportExcel: () => Promise<void>
  exportPDF: () => void
  exporting: boolean
}

export function useExport<T = any>(options: UseExportOptions<T>): UseExportReturn {
  const { filename, title, subtitle, columns, getData } = options
  const { toast } = useToast()
  const [exporting, setExporting] = useState(false)

  const getFilenameWithDate = useCallback(() => {
    const date = new Date().toISOString().split('T')[0]
    return `${filename}-${date}`
  }, [filename])

  const exportCSV = useCallback(() => {
    try {
      const rows = getData()
      if (rows.length === 0) {
        toast({ title: 'Sin datos', description: 'No hay datos para exportar con los filtros actuales', variant: 'destructive' })
        return
      }
      exportToCSV({ filename: getFilenameWithDate(), columns, rows, title, subtitle })
      toast({ title: 'CSV exportado', description: `${rows.length} registros exportados` })
    } catch (err) {
      toast({ title: 'Error al exportar', description: 'No se pudo generar el CSV', variant: 'destructive' })
    }
  }, [getData, columns, title, subtitle, getFilenameWithDate, toast])

  const exportExcel = useCallback(async () => {
    setExporting(true)
    try {
      const rows = getData()
      if (rows.length === 0) {
        toast({ title: 'Sin datos', description: 'No hay datos para exportar con los filtros actuales', variant: 'destructive' })
        return
      }
      await exportToExcel({ filename: getFilenameWithDate(), columns, rows, title, subtitle })
      toast({ title: 'Excel exportado', description: `${rows.length} registros exportados` })
    } catch (err) {
      toast({ title: 'Error al exportar', description: 'No se pudo generar el Excel', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }, [getData, columns, title, subtitle, getFilenameWithDate, toast])

  const exportPDF = useCallback(() => {
    try {
      const rows = getData()
      if (rows.length === 0) {
        toast({ title: 'Sin datos', description: 'No hay datos para exportar con los filtros actuales', variant: 'destructive' })
        return
      }
      exportToPDF({ filename: getFilenameWithDate(), columns, rows, title, subtitle })
    } catch (err) {
      toast({ title: 'Error al exportar', description: 'No se pudo generar el PDF', variant: 'destructive' })
    }
  }, [getData, columns, title, subtitle, getFilenameWithDate, toast])

  return { exportCSV, exportExcel, exportPDF, exporting }
}
