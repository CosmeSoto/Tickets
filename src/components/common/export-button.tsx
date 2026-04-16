'use client'

/**
 * Botón de exportación con dropdown — CSV, Excel, PDF
 * Reutilizable en cualquier sección del sistema.
 *
 * Uso:
 *   <ExportButton
 *     onExportCSV={exportCSV}
 *     onExportExcel={exportExcel}
 *     onExportPDF={exportPDF}
 *     loading={exporting}
 *   />
 */

import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ExportButtonProps {
  onExportCSV: () => void
  onExportExcel: () => Promise<void>
  onExportPDF: () => void
  loading?: boolean
  disabled?: boolean
  size?: 'sm' | 'default'
  variant?: 'outline' | 'ghost' | 'default'
}

export function ExportButton({
  onExportCSV,
  onExportExcel,
  onExportPDF,
  loading = false,
  disabled = false,
  size = 'sm',
  variant = 'outline',
}: ExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled || loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Formato de exportación
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onExportCSV} className="cursor-pointer">
          <FileText className="h-4 w-4 mr-2 text-green-600" />
          CSV
          <span className="ml-auto text-xs text-muted-foreground">Excel / Sheets</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportExcel} className="cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 mr-2 text-blue-600" />
          Excel
          <span className="ml-auto text-xs text-muted-foreground">.xlsx</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPDF} className="cursor-pointer">
          <FileText className="h-4 w-4 mr-2 text-red-600" />
          PDF
          <span className="ml-auto text-xs text-muted-foreground">Imprimir</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
