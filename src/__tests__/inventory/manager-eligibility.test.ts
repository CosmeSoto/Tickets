import {
  effectiveCanManageInventory,
  roleCanBeInventoryManager,
} from '@/lib/inventory/manager-eligibility'

describe('inventory manager eligibility', () => {
  it('solo Admin y Técnico pueden ser gestores', () => {
    expect(roleCanBeInventoryManager('ADMIN')).toBe(true)
    expect(roleCanBeInventoryManager('TECHNICIAN')).toBe(true)
    expect(roleCanBeInventoryManager('CLIENT')).toBe(false)
  })

  it('Cliente nunca gestiona aunque el flag legado esté activo', () => {
    expect(
      effectiveCanManageInventory({
        role: 'CLIENT',
        canManageInventory: true,
      })
    ).toBe(false)
  })

  it('Técnico gestiona solo con el flag', () => {
    expect(effectiveCanManageInventory({ role: 'TECHNICIAN', canManageInventory: true })).toBe(true)
    expect(effectiveCanManageInventory({ role: 'TECHNICIAN', canManageInventory: false })).toBe(
      false
    )
  })

  it('Super Admin siempre gestiona', () => {
    expect(
      effectiveCanManageInventory({
        role: 'ADMIN',
        isSuperAdmin: true,
        canManageInventory: false,
      })
    ).toBe(true)
  })
})
