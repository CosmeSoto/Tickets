import { buildPrefilledDataRows } from '@/lib/inventory/equipment-import/prefill-builder'
import type { TypeAttributeDef } from '@/lib/inventory/equipment-import/types'

describe('buildPrefilledDataRows', () => {
  const attributes: TypeAttributeDef[] = [
    {
      attributeName: 'ram_gb',
      attributeLabel: 'RAM (GB)',
      attributeType: 'number',
      isRequired: true,
      options: null,
    },
  ]

  it('maps equipment to import-compatible rows', () => {
    const rows = buildPrefilledDataRows(
      [
        {
          serialNumber: 'SN-001',
          condition: 'USED',
          warehouse: { name: 'Bodega Central' },
          physicalLocation: 'Piso 1',
          purchaseDate: new Date('2024-03-15T12:00:00'),
          purchasePrice: 1500.5,
          invoiceNumber: 'FAC-001',
          accessories: ['Cargador', 'Mouse'],
          notes: 'Nota test',
          customValues: [{ fieldName: 'ram_gb', fieldValue: '16' }],
        },
      ],
      attributes
    )

    expect(rows).toHaveLength(1)
    expect(rows[0][0]).toBe('SN-001')
    expect(rows[0][1]).toBe('Usado')
    expect(rows[0][2]).toBe('Bodega Central')
    expect(rows[0][3]).toBe('Piso 1')
    expect(rows[0][4]).toBe('2024-03-15')
    expect(rows[0][5]).toBe('1500.50')
    expect(rows[0][6]).toBe('FAC-001')
    expect(rows[0][7]).toBe('Cargador, Mouse')
    expect(rows[0][8]).toBe('Nota test')
    expect(rows[0][9]).toBe('16')
  })
})
