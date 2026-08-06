/**
 * Alcance de publicación Documentos/Noticias vía módulo content.
 */

jest.mock('@/lib/auth/family-scope', () => ({
  getNativeFamilyId: jest.fn(),
}))

jest.mock('@/lib/auth/user-family-access', () => ({
  getUserModuleFamilyGrantIds: jest.fn(),
}))

jest.mock('@/lib/auth/admin-scope', () => ({
  getDepartmentIdsForScope: jest.fn().mockResolvedValue(['dept-1']),
}))

import { getNativeFamilyId } from '@/lib/auth/family-scope'
import { getUserModuleFamilyGrantIds } from '@/lib/auth/user-family-access'
import { getContentVisibilityScope } from '@/lib/content/visibility-scope'

const native = 'fam-native'
const extra = 'fam-content-extra'

describe('getContentVisibilityScope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getNativeFamilyId as jest.Mock).mockResolvedValue(native)
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockResolvedValue([])
  })

  it('Super Admin sin restricción de familias', async () => {
    const scope = await getContentVisibilityScope('sa-1', 'ADMIN', true)
    expect(scope.allowedFamilyIds).toBeUndefined()
    expect(scope.requireFamilyRestriction).toBe(false)
    expect(scope.allowedRoles).toEqual(['ADMIN', 'TECHNICIAN', 'CLIENT'])
  })

  it('TECH: nativa + grants content canOperate', async () => {
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockResolvedValue([extra])
    const scope = await getContentVisibilityScope('tech-1', 'TECHNICIAN', false)
    expect(getUserModuleFamilyGrantIds).toHaveBeenCalledWith('tech-1', 'content', 'canOperate')
    expect(scope.allowedFamilyIds).toEqual(expect.arrayContaining([native, extra]))
    expect(scope.allowedRoles).toEqual(['TECHNICIAN', 'CLIENT'])
  })

  it('CLIENT sin grants: solo nativa', async () => {
    const scope = await getContentVisibilityScope('client-1', 'CLIENT', false)
    expect(scope.allowedFamilyIds).toEqual([native])
    expect(scope.requireFamilyRestriction).toBe(true)
    expect(scope.allowedRoles).toEqual(['CLIENT'])
  })

  it('CLIENT con grants content: nativa + adicionales', async () => {
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockResolvedValue([extra])
    const scope = await getContentVisibilityScope('client-1', 'CLIENT', false)
    expect(scope.allowedFamilyIds).toEqual(expect.arrayContaining([native, extra]))
  })
})
