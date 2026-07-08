import type { ImportRowError } from './types'
import { getConditionGuideText, CONDITION_ACCEPTED_ALIASES } from './constants'

const FIELD_LABELS: Record<string, string> = {
  serialNumber: 'N° de Serie',
  condition: 'Condición',
  warehouse: 'Bodega',
  purchaseDate: 'Fecha de compra',
  purchasePrice: 'Precio de compra',
  invoiceNumber: 'N° Factura',
  accessories: 'Accesorios',
  notes: 'Notas',
  file: 'Archivo',
  context: 'Configuración',
}

export function getImportFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

interface HintContext {
  warehouseNames?: string[]
  attributeLabel?: string
  allowedOptions?: string[]
}

export function resolveImportErrorHint(
  field: string,
  message: string,
  context: HintContext = {}
): string {
  const lower = message.toLowerCase()

  if (field === 'serialNumber') {
    if (lower.includes('obligatorio')) {
      return 'Complete la columna "N° de Serie". Cada equipo debe tener un identificador único.'
    }
    if (lower.includes('duplicada')) {
      return 'Elimine o corrija la fila duplicada. No puede haber dos filas con la misma serie en un archivo.'
    }
    if (lower.includes('otro tipo')) {
      return 'El catálogo del paso 1 no coincide con el equipo existente. Cambie tipo/modelo en el asistente o quite esa fila del archivo.'
    }
    if (lower.includes('otro modelo')) {
      return 'Seleccione el modelo correcto en el paso 1, o quite la fila si no desea actualizar ese equipo.'
    }
    if (lower.includes('no se puede actualizar') || lower.includes('estado')) {
      return 'Devuelva el equipo a bodega desde Inventario (si está asignado) o edítelo manualmente. La importación no modifica equipos en uso.'
    }
  }

  if (field === 'condition') {
    return `Use: ${getConditionGuideText()}. También acepta: ${CONDITION_ACCEPTED_ALIASES}.`
  }

  if (field === 'warehouse') {
    const list = context.warehouseNames?.slice(0, 5).join(', ')
    return list
      ? `Escriba el nombre o código exacto. Bodegas disponibles: ${list}${(context.warehouseNames?.length ?? 0) > 5 ? '…' : ''}. Deje vacío para usar la bodega por defecto.`
      : 'Verifique el nombre o código de bodega en Inventario → Bodegas. Deje vacío para usar la bodega por defecto.'
  }

  if (field === 'purchaseDate') {
    return 'Use formato AAAA-MM-DD (ej. 2026-01-15) o DD/MM/AAAA (ej. 15/01/2026). Deje vacío si no aplica.'
  }

  if (field === 'purchasePrice') {
    return 'Ingrese solo números. Use punto o coma decimal (ej. 1200,50). Deje vacío si no aplica.'
  }

  if (field === 'accessories') {
    return 'Liste los accesorios separados por coma (ej. Cargador, Mouse, Cable HDMI). Deje vacío si no aplica.'
  }

  if (field === 'file') {
    if (lower.includes('máximo') || lower.includes('maximo')) {
      return 'Divida el archivo en lotes de hasta 100 equipos e importe por partes.'
    }
    if (lower.includes('no tiene filas')) {
      return 'Agregue al menos una fila de datos debajo del encabezado. No borre la fila de títulos de columna.'
    }
    if (lower.includes('válidas') || lower.includes('validas')) {
      return 'Revise que cada fila tenga N° de serie y datos válidos según la plantilla.'
    }
  }

  if (field === 'serialNumber' && lower.includes('falta la columna')) {
    return 'Descargue la plantilla oficial desde este asistente. No modifique el nombre de la columna "N° de Serie".'
  }

  if (lower.includes('obligatorio') && context.attributeLabel) {
    return `Complete la columna "${context.attributeLabel}" (marcada con * en la plantilla).`
  }

  if (lower.includes('numérico') || lower.includes('numerico')) {
    return context.attributeLabel
      ? `La columna "${context.attributeLabel}" solo acepta números (ej. 16).`
      : 'Esta columna solo acepta valores numéricos.'
  }

  if (lower.includes('debe ser uno de') && context.allowedOptions?.length) {
    return `Use exactamente uno de: ${context.allowedOptions.join(', ')}. Consulte la hoja "Instrucciones" de la plantilla.`
  }

  return 'Corrija el valor en el archivo, guarde y vuelva a pulsar "Validar archivo".'
}

export function enrichImportError(
  error: ImportRowError,
  context: HintContext = {}
): ImportRowError {
  return {
    ...error,
    fieldLabel: getImportFieldLabel(error.field),
    hint: error.hint ?? resolveImportErrorHint(error.field, error.message, context),
  }
}
