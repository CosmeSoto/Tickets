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
} from '@/lib/inventory/supplier-evaluation-import'

interface RowResult {
  rowNumber: number
  status: 'created' | 'error'
  supplierName: string
  supplierCreated?: boolean
  error?: string
}

interface SupplierEvaluationImportDialogProps {
  onDone: () => void
  onCancel: () => void
}

export function SupplierEvaluationImportDialog({
  onDone,
  onCancel,
}: SupplierEvaluationImportDialogProps) {
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
      const res = await fetch('/api/inventory/suppliers/evaluations/import', {
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
        description: `${data.summary.created} de ${data.summary.total} filas importadas (${data.summary.suppliersCreated} proveedores nuevos)`,
      })
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  if (results) {
    const created = results.filter(r => r.status === 'created').length
    const failed = results.filter(r => r.status === 'error').length
    return (
      <div className='space-y-4'>
        <div className='flex gap-3'>
          <Badge className='bg-emerald-100 text-emerald-800 border-emerald-300'>
            {created} importadas
          </Badge>
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
                  <TableCell className='text-sm'>{r.supplierName}</TableCell>
                  <TableCell className='text-sm'>
                    {r.status === 'created' ? (
                      <span className='flex items-center gap-1.5 text-emerald-700'>
                        <CheckCircle2 className='h-3.5 w-3.5' />
                        Registrada{r.supplierCreated ? ' (proveedor nuevo)' : ''}
                      </span>
                    ) : (
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
          onClick={() =>
            window.open('/api/inventory/suppliers/evaluations/import/template', '_blank')
          }
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
          Columnas esperadas: Año, Proveedor, Mail, Contacto, Detalle, Calidad, Tiempo de crédito,
          Tiempo de entrega, Precio, Referencias, Equipo (0-5). RUC/NIT es opcional pero
          recomendado: si viene, se usa para ubicar el proveedor (más confiable que el nombre, que
          puede repetirse entre razones sociales distintas).
        </p>
      </div>

      {missingFields.length > 0 && (
        <div className='flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive'>
          <AlertTriangle className='h-4 w-4 mt-0.5 flex-shrink-0' />
          <span>
            No se encontraron las columnas: {missingFields.join(', ')}. Revisa los encabezados del
            archivo.
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className='space-y-1'>
            <Label>Área por defecto para proveedores nuevos</Label>
            <FamilyCombobox
              families={families}
              value={defaultFamilyId}
              onValueChange={setDefaultFamilyId}
              allowNull={isSuperAdmin}
              nullLabel='Sin área (solo Super Admin)'
              popoverWidth='320px'
            />
            <p className='text-xs text-muted-foreground'>
              Se aplica solo a proveedores que no existan aún en el sistema (se buscan primero por
              RUC/NIT si la columna viene en el archivo, y por nombre exacto si no). Los ya
              existentes conservan su área actual.
              {!defaultFamilyId && !isSuperAdmin && (
                <>
                  {' '}
                  Si no eliges un área, las filas con proveedores nuevos fallarán (se indicará el
                  motivo); las de proveedores ya existentes se importan igual.
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
                  <TableHead>Año</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>RUC/NIT</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.rowNumber}>
                    <TableCell className='font-mono text-xs'>{r.rowNumber}</TableCell>
                    <TableCell>{r.year ?? '—'}</TableCell>
                    <TableCell className='text-sm'>{r.supplierName || '—'}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {r.taxId || '—'}
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {r.detail || '—'}
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
