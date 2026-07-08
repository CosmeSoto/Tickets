import {
  validateAndParseImportRows,
  validateImportContext,
  type ExistingEquipmentRef,
} from '../row-validator'
import type { ImportCatalogContext, TypeAttributeDef } from '../types'

const baseContext: ImportCatalogContext = {
  familyId: 'fam-1',
  typeId: 'type-1',
  brandId: 'brand-1',
  modelId: 'model-1',
  acquisitionMode: 'FIXED_ASSET',
}

const warehouses = [{ id: 'wh-1', name: 'Bodega Central', location: 'Piso 1' }]

const header = ['N° de Serie', 'Condición', 'Bodega', 'Fecha de compra', 'Precio de compra']

function makeRows(dataRows: string[][]): string[][] {
  return [header, ...dataRows]
}

function existingMap(entries: Array<[string, Partial<ExistingEquipmentRef> & { code: string }]>) {
  const map = new Map<string, ExistingEquipmentRef>()
  for (const [serial, ref] of entries) {
    map.set(serial, {
      id: ref.id ?? `eq-${serial}`,
      code: ref.code,
      modelId: ref.modelId ?? baseContext.modelId,
      typeId: ref.typeId ?? baseContext.typeId,
      status: ref.status ?? 'AVAILABLE',
    })
  }
  return map
}

describe('validateImportContext', () => {
  it('accepts a complete catalog context', () => {
    expect(validateImportContext(baseContext)).toBeNull()
  })

  it('rejects missing modelId', () => {
    expect(validateImportContext({ ...baseContext, modelId: '' })).toMatch(/modelId/)
  })
})

describe('validateAndParseImportRows', () => {
  it('parses valid rows with condition aliases and warehouse by name', () => {
    const rows = makeRows([
      ['SN-001', 'LIKE_NEW', 'Bodega Central', '2024-01-15', '1500.50'],
      ['SN-002', 'USADO', 'Bodega Central', '15/01/2024', ''],
    ])

    const { errors, parsed, skipped, total } = validateAndParseImportRows({
      rows,
      context: baseContext,
      mode: 'add',
      attributes: [],
      warehouses,
      existingBySerial: new Map(),
    })

    expect(errors).toHaveLength(0)
    expect(skipped).toHaveLength(0)
    expect(total).toBe(2)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].action).toBe('create')
    expect(parsed[0].condition).toBe('USED')
    expect(parsed[0].warehouseId).toBe('wh-1')
    expect(parsed[0].purchasePrice).toBe(1500.5)
    expect(parsed[1].condition).toBe('USED')
    expect(parsed[1].purchaseDate?.toISOString().slice(0, 10)).toBe('2024-01-15')
  })

  it('skips existing serials in add mode', () => {
    const rows = makeRows([
      ['SN-NEW', 'NEW', '', '', ''],
      ['SN-OLD', 'NEW', '', '', ''],
    ])

    const { errors, parsed, skipped } = validateAndParseImportRows({
      rows,
      context: baseContext,
      mode: 'add',
      attributes: [],
      warehouses,
      existingBySerial: existingMap([['sn-old', { code: 'EQ-001' }]]),
    })

    expect(errors).toHaveLength(0)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].serialNumber).toBe('SN-NEW')
    expect(skipped).toHaveLength(1)
    expect(skipped[0].serialNumber).toBe('SN-OLD')
  })

  it('updates existing serials in update mode', () => {
    const rows = makeRows([['SN-OLD', 'USED', 'Bodega Central', '', '']])

    const { errors, parsed } = validateAndParseImportRows({
      rows,
      context: baseContext,
      mode: 'update',
      attributes: [],
      warehouses,
      existingBySerial: existingMap([['sn-old', { id: 'eq-1', code: 'EQ-001' }]]),
    })

    expect(errors).toHaveLength(0)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].action).toBe('update')
    expect(parsed[0].existingEquipmentId).toBe('eq-1')
  })

  it('rejects duplicate serials in file', () => {
    const rows = makeRows([
      ['SN-DUP', 'NEW', '', '', ''],
      ['SN-DUP', 'NEW', '', '', ''],
    ])

    const { errors, parsed } = validateAndParseImportRows({
      rows,
      context: baseContext,
      mode: 'add',
      attributes: [],
      warehouses,
      existingBySerial: new Map(),
    })

    expect(parsed).toHaveLength(1)
    expect(errors).toEqual([
      expect.objectContaining({
        field: 'serialNumber',
        message: expect.stringContaining('duplicada'),
      }),
    ])
  })

  it('blocks update when equipment is assigned', () => {
    const rows = makeRows([['SN-OLD', 'NEW', '', '', '']])

    const { errors, parsed } = validateAndParseImportRows({
      rows,
      context: baseContext,
      mode: 'update',
      attributes: [],
      warehouses,
      existingBySerial: existingMap([['sn-old', { code: 'EQ-001', status: 'ASSIGNED' }]]),
    })

    expect(parsed).toHaveLength(0)
    expect(errors[0].message).toMatch(/ASSIGNED/)
  })

  it('parses attributes from export Atributos column', () => {
    const attributes: TypeAttributeDef[] = [
      {
        attributeName: 'ram_gb',
        attributeLabel: 'RAM (GB)',
        attributeType: 'number',
        isRequired: false,
        options: null,
      },
    ]

    const headerWithAttr = [...header, 'Atributos']
    const rowsWithAttr = [headerWithAttr, ['SN-001', 'NEW', '', '', '', 'RAM (GB): 16']]

    const { errors, parsed } = validateAndParseImportRows({
      rows: rowsWithAttr,
      context: baseContext,
      mode: 'add',
      attributes,
      warehouses,
      existingBySerial: new Map(),
    })

    expect(errors).toHaveLength(0)
    expect(parsed[0].customValues).toEqual([{ fieldName: 'ram_gb', fieldValue: '16' }])
  })

  it('validates required dynamic attributes', () => {
    const attributes: TypeAttributeDef[] = [
      {
        attributeName: 'ram_gb',
        attributeLabel: 'RAM (GB)',
        attributeType: 'number',
        isRequired: true,
        options: null,
      },
    ]

    const rows = makeRows([['SN-001', 'NEW', '', '', '', 'not-a-number']])
    const headerWithAttr = [...header, 'RAM (GB)']
    const rowsWithAttr = [headerWithAttr, ...rows.slice(1)]

    const { errors } = validateAndParseImportRows({
      rows: rowsWithAttr,
      context: baseContext,
      mode: 'add',
      attributes,
      warehouses,
      existingBySerial: new Map(),
    })

    expect(errors).toEqual([
      expect.objectContaining({ field: 'ram_gb', message: expect.stringContaining('numérico') }),
    ])
  })

  it('rejects more than MAX_IMPORT_ROWS data rows', () => {
    const dataRows = Array.from({ length: 101 }, (_, i) => [`SN-${i}`, 'NEW', '', '', ''])
    const { errors } = validateAndParseImportRows({
      rows: makeRows(dataRows),
      context: baseContext,
      mode: 'add',
      attributes: [],
      warehouses,
      existingBySerial: new Map(),
    })

    expect(errors[0]).toMatchObject({ field: 'file', message: expect.stringContaining('100') })
  })
})
