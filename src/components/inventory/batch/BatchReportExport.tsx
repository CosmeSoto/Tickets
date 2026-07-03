'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  exportBatchReportToPDF,
  type BatchReportSummary,
  type BatchReportEquipmentRow,
  type BatchReportHistoryRow,
} from '@/lib/inventory/batch-export'

interface BatchReportExportProps {
  summary: BatchReportSummary
  equipment: BatchReportEquipmentRow[]
  history?: BatchReportHistoryRow[]
}

export function BatchReportExport({ summary, equipment, history }: BatchReportExportProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = () => {
    setExporting(true)
    try {
      exportBatchReportToPDF({
        summary,
        equipment,
        history,
        filename: `lote-${summary.batchCode}`,
      })
      toast.success('Informe listo para guardar como PDF')
    } catch {
      toast.error('No se pudo generar el informe')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant='outline'
      size='sm'
      onClick={handleExport}
      disabled={exporting}
      className='gap-1.5'
    >
      {exporting ? (
        <Loader2 className='h-3.5 w-3.5 animate-spin' />
      ) : (
        <FileDown className='h-3.5 w-3.5' />
      )}
      Exportar PDF
    </Button>
  )
}
