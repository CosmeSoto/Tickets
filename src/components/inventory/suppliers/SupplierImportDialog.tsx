'use client'

import { useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Upload,
  Download,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { useFamilyOptions } from '@/hooks/use-family-options'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { parseImportFile } from '@/lib/utils/parse-import-file'
import {
  buildHeaderMap,
  parseImportRows,
  validateImportRow,
  REQUIRED_IMPORT_FIELDS,
  type ParsedImportRow,
} from '@/lib/inventory/supplier-import'

interface RowResult {
  rowNumber: number
  status: 'created' | 'skipped' | 'error'
  name: string
  supplierId?: string
  error?: string
}

interface SupplierImportDialogProps {
  onDone: () => void
  onCancel: () => void
}

export function SupplierImportDialog({ onDone, onCancel }: SupplierImportDialogProps) {
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const { families } = useFamilyOptions()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedImportRow[]>([])
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [defaultFamilyId, setDefaultFamilyId] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<RowResult[] | null>(null)

  const rowErrors = useMemo(() => rows.map(r => validateImportRow(r)), [rows])
  const validCount = rowErrors.filter(e => !e).length

  const handleFile = async (file: File) => {
    setParsing(true)
    setResults(null)
    try {
      const raw = await parseImportFile(file)
      if (raw.length === 0) {
        toast({ title: 'Archivo vacío', variant: 'destructive' })
        return
      }
      const headerMap = buildHeaderMap(raw[0])
      const missing = REQUIRED_IMPORT_FIELDS.filter(f => headerMap[f] === undefined)
      setMissingFields(missing)
      if (missing.length > 0) {
        setRows([])
        return
      }
      const parsed = parseImportRows(raw, headerMap)
      setRows(parsed)
      setFileName(file.name)
    } catch {
      toast({
        title: 'No se pudo leer el archivo',
        description: 'Verifica que sea un .xlsx o .csv válido',
        variant: 'destructive',
      })
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    if (validCount === 0) return
    setImporting(true)
    try {
      const validRows = rows.filter((_, i) => !rowErrors[i])
      const res = await fetch('/api/inventory/suppliers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows, defaultFamilyId: defaultFamilyId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'No se pudo importar', description: data.error, variant: 'destructive' })
        return
      }
      setResults(data.results)
      toast({
        title: 'Importación completada',
        description: `${data.summary.created} de ${data.summary.total} proveedores creados (${data.summary.skipped} ya existían, ${data.summary.failed} con error)`,
      })
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  if (results) {
    const created = results.filter(r => r.status === 'created').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const failed = results.filter(r => r.status === 'error').length
    return (
      <div className='space-y-4'>
        <div className='flex flex-wrap gap-3'>
          <Badge className='bg-emerald-100 text-emerald-800 border-emerald-300'>
            {created} creados
          </Badge>
          {skipped > 0 && (
            <Badge className='bg-amber-100 text-amber-800 border-amber-300'>
              {skipped} ya existían
            </Badge>
          )}
          {failed > 0 && <Badge variant='destructive'>{failed} con error</Badge>}
        </div>
        <div className='max-h-[50vh] overflow-y-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-16'>Fila</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map(r => (
                <TableRow key={r.rowNumber}>
                  <TableCell className='font-mono text-xs'>{r.rowNumber}</TableCell>
                  <TableCell className='text-sm'>{r.name}</TableCell>
                  <TableCell className='text-sm'>
                    {r.status === 'created' && (
                      <span className='flex items-center gap-1.5 text-emerald-700'>
                        <CheckCircle2 className='h-3.5 w-3.5' />
                        Creado
                      </span>
                    )}
                    {r.status === 'skipped' && (
                      <span className='flex items-center gap-1.5 text-amber-700'>
                        <MinusCircle className='h-3.5 w-3.5' />
                        {r.error}
                      </span>
                    )}
                    {r.status === 'error' && (
                      <span className='flex items-center gap-1.5 text-destructive'>
                        <XCircle className='h-3.5 w-3.5' />
                        {r.error}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className='flex justify-end'>
          <Button onClick={onDone}>Cerrar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between p-3 bg-muted/50 rounded-lg border'>
        <div className='flex items-center gap-2'>
          <FileText className='h-4 w-4 text-muted-foreground' />
          <div>
            <p className='text-sm font-medium'>Plantilla Excel</p>
            <p className='text-xs text-muted-foreground'>Descarga el formato con ejemplos</p>
          </div>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => window.open('/api/inventory/suppliers/import/template', '_blank')}
        >
          <Download className='h-3.5 w-3.5 mr-1.5' />
          Descargar plantilla
        </Button>
      </div>

      <div className='rounded-md border border-dashed p-4 text-center space-y-2'>
        <input
          ref={fileInputRef}
          type='file'
          accept='.xlsx,.xls,.csv'
          className='hidden'
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Button
          type='button'
          variant='outline'
          onClick={() => fileInputRef.current?.click()}
          disabled={parsing}
        >
          {parsing ? (
            <Loader2 className='h-4 w-4 mr-2 animate-spin' />
          ) : (
            <Upload className='h-4 w-4 mr-2' />
          )}
          {fileName || 'Seleccionar archivo (.xlsx o .csv)'}
        </Button>
        <p className='text-xs text-muted-foreground'>
          Columna obligatoria: Nombre. El resto son opcionales: RUC/NIT, Email, Teléfono, Contacto,
          Área, Razón social, Tipo de proveedor, Sitio web, Dirección, Ciudad, País, Plazo de pago,
          Límite de crédito, Moneda, Método de pago, Banco, Cuenta bancaria, Tipo de cuenta,
          SWIFT/BIC y Notas — descarga la plantilla para ver el formato exacto de cada una.
        </p>
      </div>

      {missingFields.length > 0 && (
        <div className='flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive'>
          <AlertTriangle className='h-4 w-4 mt-0.5 flex-shrink-0' />
          <span>No se encontró la columna Nombre. Revisa los encabezados del archivo.</span>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className='space-y-1'>
            <Label>Área por defecto</Label>
            <FamilyCombobox
              families={families}
              value={defaultFamilyId}
              onValueChange={setDefaultFamilyId}
              allowNull={isSuperAdmin}
              nullLabel='Sin área (solo Super Admin)'
              popoverWidth='320px'
            />
            <p className='text-xs text-muted-foreground'>
              Se usa solo para filas cuya columna Área venga vacía o no coincida con ninguna
              existente.
              {!defaultFamilyId && !isSuperAdmin && (
                <>
                  {' '}
                  Sin área por defecto, esas filas fallarán (se indicará el motivo); las que traigan
                  un área válida en su propia columna se importan igual.
                </>
              )}
            </p>
          </div>

          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>
              {validCount} de {rows.length} filas listas para importar
            </p>
          </div>

          <div className='max-h-[40vh] overflow-y-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-16'>Fila</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>RUC/NIT</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.rowNumber}>
                    <TableCell className='font-mono text-xs'>{r.rowNumber}</TableCell>
                    <TableCell className='text-sm'>{r.name || '—'}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {r.taxId || '—'}
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {r.email || '—'}
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {r.contactName || '—'}
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {r.familyName || '—'}
                    </TableCell>
                    <TableCell className='text-sm'>
                      {rowErrors[i] ? (
                        <span className='text-destructive'>{rowErrors[i]}</span>
                      ) : (
                        <span className='text-emerald-700'>OK</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className='text-xs text-muted-foreground'>
            La vista previa solo muestra las columnas principales; el resto de campos del archivo
            (razón social, dirección, condiciones de pago, datos bancarios, etc.) también se
            importan aunque no se listen acá.
          </p>
        </>
      )}

      <div className='flex justify-end gap-2 pt-2'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={importing}>
          Cancelar
        </Button>
        <Button
          type='button'
          onClick={handleImport}
          disabled={validCount === 0 || importing || missingFields.length > 0}
        >
          {importing && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
          Importar {validCount > 0 ? `(${validCount})` : ''}
        </Button>
      </div>
    </div>
  )
}
