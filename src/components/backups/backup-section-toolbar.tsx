'use client'

import { SearchInput } from '@/components/common/filters/search-input'
import { ExportButton } from '@/components/common/export-button'

type BackupSectionToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  onExportCSV?: () => void
  onExportExcel?: () => Promise<void>
  onExportPDF?: () => void
  exporting?: boolean
  exportDisabled?: boolean
}

/** Barra compacta reutilizable: búsqueda + export opcional */
export function BackupSectionToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  onExportCSV,
  onExportExcel,
  onExportPDF,
  exporting = false,
  exportDisabled = false,
}: BackupSectionToolbarProps) {
  const hasExport = onExportCSV && onExportExcel && onExportPDF

  return (
    <div className='flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end'>
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        className='sm:max-w-xs sm:mr-auto'
      />
      {hasExport && (
        <ExportButton
          onExportCSV={onExportCSV}
          onExportExcel={onExportExcel}
          onExportPDF={onExportPDF}
          loading={exporting}
          disabled={exportDisabled}
          size='sm'
        />
      )}
    </div>
  )
}
