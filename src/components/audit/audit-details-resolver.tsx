/**
 * Audit Details Resolver Component
 * Resolves and displays audit log details with ID resolution
 */

'use client'

import { useState, useEffect } from 'react'
import { Loader2, Settings } from 'lucide-react'
import type { ResolvedDetails, AuditChange } from './utils/audit-types'
import {
  getFieldDisplayName,
  formatValue,
  getFieldLabel,
  shouldHideField,
} from './utils/audit-formatters'
import { getConfigModuleName } from '@/lib/services/config-audit-labels'

interface AuditDetailsResolverProps {
  details: any
  /** Acción del log; permite activar vistas especializadas (ej. backup_config_updated) */
  action?: string
}

export function AuditDetailsResolver({ details, action }: AuditDetailsResolverProps) {
  const [resolvedDetails, setResolvedDetails] = useState<ResolvedDetails | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const resolveIds = async () => {
      // PRIORIDAD 1: Nuevo formato de diff de configuración de backups
      // Estructura: details.changes = { key: { label, antes, despues } }
      if (
        details.changes &&
        typeof details.changes === 'object' &&
        !Array.isArray(details.changes)
      ) {
        const firstEntry = Object.values(details.changes)[0] as any
        if (firstEntry && ('antes' in firstEntry || 'despues' in firstEntry)) {
          setResolvedDetails({ type: 'config_diff', data: details.changes })
          return
        }
        // Formato antiguo: { field, old, new }
        setResolvedDetails({ type: 'changes', data: details.changes })
        return
      }

      // Formato legado: solo lista de claves tocadas (sin valores antes/después)
      if (Array.isArray(details.updatedSettings) && details.updatedSettings.length > 0) {
        setResolvedDetails({ type: 'backup_config_legacy', data: details.updatedSettings })
        return
      }

      // PRIORIDAD 2: Si tiene oldValues/newValues (registros antiguos), resolverlos
      if (details.oldValues && details.newValues) {
        setLoading(true)
        try {
          // Obtener todos los valores únicos que necesitan resolución
          const allValues: Record<string, any> = {}

          Object.keys(details.newValues).forEach(key => {
            if (details.oldValues[key] !== details.newValues[key]) {
              allValues[`old_${key}`] = details.oldValues[key]
              allValues[`new_${key}`] = details.newValues[key]
            }
          })

          // Llamar al API para resolver IDs
          const response = await fetch('/api/admin/audit/resolve-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: allValues }),
          })

          if (response.ok) {
            const { resolved } = await response.json()

            // Reconstruir cambios con valores resueltos
            const changes: Record<string, { old: string; new: string; field: string }> = {}

            Object.keys(details.newValues).forEach(key => {
              if (details.oldValues[key] !== details.newValues[key]) {
                changes[key] = {
                  field: getFieldDisplayName(key),
                  old: resolved[`old_${key}`] || String(details.oldValues[key] || 'vacío'),
                  new: resolved[`new_${key}`] || String(details.newValues[key] || 'vacío'),
                }
              }
            })

            setResolvedDetails({ type: 'resolved', data: changes })
          } else {
            // Si falla, usar valores sin resolver
            const changes: Record<string, { old: string; new: string; field: string }> = {}
            Object.keys(details.newValues).forEach(key => {
              if (details.oldValues[key] !== details.newValues[key]) {
                changes[key] = {
                  field: getFieldDisplayName(key),
                  old: String(details.oldValues[key] || 'vacío'),
                  new: String(details.newValues[key] || 'vacío'),
                }
              }
            })
            setResolvedDetails({ type: 'unresolved', data: changes })
          }
        } catch (error) {
          console.error('Error resolviendo IDs:', error)
          // Fallback: mostrar sin resolver
          const changes: Record<string, { old: string; new: string; field: string }> = {}
          Object.keys(details.newValues).forEach(key => {
            if (details.oldValues[key] !== details.newValues[key]) {
              changes[key] = {
                field: getFieldDisplayName(key),
                old: String(details.oldValues[key] || 'vacío'),
                new: String(details.newValues[key] || 'vacío'),
              }
            }
          })
          setResolvedDetails({ type: 'error', data: changes })
        } finally {
          setLoading(false)
        }
        return
      }

      // PRIORIDAD 3: Otros tipos de detalles
      if (details.metadata) {
        setResolvedDetails({ type: 'metadata', data: details.metadata })
        return
      }

      // PRIORIDAD 4: Objeto genérico
      if (typeof details === 'object' && details !== null) {
        setResolvedDetails({ type: 'generic', data: details })
        return
      }

      // Fallback
      setResolvedDetails({ type: 'raw', data: details })
    }

    void resolveIds()
  }, [details, action])

  if (loading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <Loader2 className='h-6 w-6 animate-spin text-blue-600 dark:text-blue-400' />
        <span className='ml-2 text-sm text-muted-foreground'>Resolviendo información...</span>
      </div>
    )
  }

  if (!resolvedDetails) {
    return <div className='text-sm text-muted-foreground'>Cargando detalles...</div>
  }

  // Vista especializada: diff de configuración (Antes / Después)
  if (resolvedDetails.type === 'config_diff' || resolvedDetails.type === 'backup_config_diff') {
    const entries = Object.entries(resolvedDetails.data) as [
      string,
      { label: string; antes: string; despues: string },
    ][]

    const moduleName =
      (typeof details?.module === 'string' && details.module) ||
      (action ? getConfigModuleName(action) : 'Configuración')

    if (entries.length === 0) {
      return (
        <div className='flex items-center gap-2 text-sm text-muted-foreground py-2'>
          <Settings className='h-4 w-4' />
          La configuración se guardó sin cambios detectados.
        </div>
      )
    }

    return (
      <div className='space-y-3'>
        <div className='font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2'>
          <Settings className='h-4 w-4' />
          Cambios en {moduleName} ({entries.length})
        </div>
        <div className='grid gap-2'>
          {entries.map(([key, change]) => (
            <div key={key} className='rounded-lg border border-border bg-muted/30 overflow-hidden'>
              {/* Cabecera del campo */}
              <div className='px-3 py-1.5 bg-muted/60 border-b border-border'>
                <span className='text-xs font-semibold uppercase tracking-wide text-foreground/70'>
                  {change.label}
                </span>
              </div>
              {/* Antes / Después en dos columnas */}
              <div className='grid grid-cols-2 divide-x divide-border text-sm'>
                <div className='px-3 py-2 space-y-0.5'>
                  <div className='text-xs font-medium text-red-500 dark:text-red-400 uppercase tracking-wide'>
                    Antes
                  </div>
                  <div className='text-red-700 dark:text-red-300 font-medium'>
                    {change.antes || '—'}
                  </div>
                </div>
                <div className='px-3 py-2 space-y-0.5'>
                  <div className='text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide'>
                    Después
                  </div>
                  <div className='text-emerald-700 dark:text-emerald-300 font-medium'>
                    {change.despues || '—'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (resolvedDetails.type === 'backup_config_legacy') {
    const keys = resolvedDetails.data as string[]
    return (
      <div className='space-y-3'>
        <div className='font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2'>
          <Settings className='h-4 w-4' />
          Registro antiguo — solo nombres de campos
        </div>
        <p className='text-sm text-muted-foreground'>
          Este evento se guardó antes del diff detallado. A partir de ahora verás valor anterior y
          nuevo en cada cambio.
        </p>
        <ul className='text-sm list-disc list-inside space-y-1 bg-muted/40 rounded-lg p-3'>
          {keys.map(key => (
            <li key={key} className='font-mono text-xs'>
              {key}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // Renderizar según el tipo
  if (
    resolvedDetails.type === 'changes' ||
    resolvedDetails.type === 'resolved' ||
    resolvedDetails.type === 'unresolved' ||
    resolvedDetails.type === 'error'
  ) {
    const changesArray: AuditChange[] = Object.entries(resolvedDetails.data).map(
      ([key, value]: [string, any]) => ({
        campo: value.field || getFieldDisplayName(key),
        campoTecnico: key,
        anterior: value.old,
        nuevo: value.new,
      })
    )

    if (changesArray.length > 0) {
      return (
        <div className='space-y-2'>
          <div className='font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2'>
            📝 Cambios Realizados ({changesArray.length})
            {resolvedDetails.type === 'resolved' && (
              <span className='text-xs text-emerald-600 dark:text-emerald-400 font-normal'>
                ✓ IDs resueltos
              </span>
            )}
            {resolvedDetails.type === 'changes' && (
              <span className='text-xs text-emerald-600 dark:text-emerald-400 font-normal'>
                ✓ Resuelto automáticamente
              </span>
            )}
          </div>
          {changesArray.map((change, idx) => (
            <div key={idx} className='bg-muted/50 p-3 rounded text-sm space-y-1'>
              <div className='font-medium text-foreground'>
                Campo: <span className='text-blue-600 dark:text-blue-400'>{change.campo}</span>
              </div>
              <div className='text-red-600 dark:text-red-400'>
                ❌ Anterior: {String(change.anterior || 'vacío')}
              </div>
              <div className='text-emerald-600 dark:text-emerald-400'>
                ✅ Nuevo: {String(change.nuevo || 'vacío')}
              </div>
            </div>
          ))}
        </div>
      )
    }
  }

  if (resolvedDetails.type === 'metadata') {
    return (
      <div className='space-y-2'>
        <div className='font-semibold text-purple-600 dark:text-purple-400'>📊 Metadatos</div>
        <div className='bg-muted/50 p-3 rounded text-sm space-y-1'>
          {Object.entries(resolvedDetails.data).map(([key, value]) => (
            <div key={key}>
              <span className='font-medium'>{key}:</span>{' '}
              <span className='text-muted-foreground'>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (resolvedDetails.type === 'generic') {
    const entries = Object.entries(resolvedDetails.data)
    if (entries.length > 0) {
      // Filtrar campos que no deben mostrarse
      const filteredEntries = entries.filter(([key, value]) => !shouldHideField(key, value))

      return (
        <div className='space-y-2'>
          <div className='font-semibold text-gray-600 dark:text-gray-400'>
            📦 Información Adicional
          </div>
          <div className='bg-muted/50 p-4 rounded-lg space-y-3'>
            {filteredEntries.map(([key, value]) => (
              <div key={key} className='flex flex-col space-y-1'>
                <span className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                  {getFieldLabel(key)}
                </span>
                <span className='text-sm text-foreground font-medium'>
                  {formatValue(key, value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }
  }

  // Fallback: JSON formateado
  return (
    <pre className='text-xs bg-muted p-3 rounded overflow-auto max-h-60'>
      {JSON.stringify(resolvedDetails.data, null, 2)}
    </pre>
  )
}
