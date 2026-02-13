'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Download, 
  FileText, 
  FileSpreadsheet,
  ChevronDown
} from 'lucide-react'

interface ExportButtonProps {
  reportType: string
  onExport: (type: string, format: string) => void
  loading?: boolean
  disabled?: boolean
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'secondary'
}

export function ExportButton({
  reportType,
  onExport,
  loading = false,
  disabled = false,
  size = 'sm',
  variant = 'outline'
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const exportFormats = [
    {
      id: 'csv',
      name: 'CSV',
      description: 'Archivo de valores separados por comas',
      icon: FileSpreadsheet,
    },
    {
      id: 'json',
      name: 'JSON',
      description: 'Datos estructurados',
      icon: FileText,
    }
  ]

  const handleExport = async (format: string) => {
    setIsExporting(true)
    try {
      await onExport(reportType, format)
    } finally {
      setIsExporting(false)
    }
  }

  const isDisabled = disabled || loading || isExporting

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={isDisabled}
          className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
        >
          <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-spin' : ''}`} />
          {isExporting ? 'Exportando...' : 'Exportar'}
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {exportFormats.map((format) => {
          const Icon = format.icon
          return (
            <DropdownMenuItem
              key={format.id}
              onClick={() => handleExport(format.id)}
              disabled={isDisabled}
              className="cursor-pointer"
            >
              <Icon className="h-4 w-4 mr-2" />
              <div>
                <div className="font-medium">{format.name}</div>
                <div className="text-xs text-muted-foreground">{format.description}</div>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}