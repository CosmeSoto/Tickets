import {
  FAMILY_ACCESS_MODULES,
  getModuleDefaults,
  resolveFamilyAccessModuleKey,
  registerFamilyAccessModule,
  listFamilyAccessModules,
} from '@/lib/auth/family-access-modules'

describe('family-access-modules registry', () => {
  it('mapea news/forms → content', () => {
    expect(resolveFamilyAccessModuleKey('news')).toBe('content')
    expect(resolveFamilyAccessModuleKey('forms')).toBe('content')
    expect(resolveFamilyAccessModuleKey('tickets')).toBe('tickets')
  })

  it('incluye módulos built-in extensibles', () => {
    const keys = listFamilyAccessModules().map(m => m.key)
    expect(keys).toEqual(expect.arrayContaining(['tickets', 'inventory', 'patrols', 'content']))
  })

  it('defaults por rol: tickets consumer para TECH', () => {
    const d = getModuleDefaults('tickets', 'TECHNICIAN')
    expect(d.canConsume).toBe(true)
    expect(d.canOperate).toBe(false)
  })

  it('defaults content: operar/ver para CLIENT', () => {
    const d = getModuleDefaults('content', 'CLIENT')
    expect(d.canOperate).toBe(true)
    expect(d.canView).toBe(true)
  })

  it('permite registrar un módulo futuro sin tocar schema', () => {
    registerFamilyAccessModule({
      key: 'contracts',
      label: 'Contratos',
      description: 'Áreas de contratos',
      defaultsByRole: {
        ADMIN: { canConsume: false, canOperate: true, canView: true },
        TECHNICIAN: { canConsume: false, canOperate: true, canView: true },
        CLIENT: { canConsume: true, canOperate: false, canView: true },
      },
    })
    expect(FAMILY_ACCESS_MODULES.contracts).toBeDefined()
    expect(getModuleDefaults('contracts', 'ADMIN').canOperate).toBe(true)
    delete FAMILY_ACCESS_MODULES.contracts
  })

  it('módulo desconocido usa defaults seguros', () => {
    const d = getModuleDefaults('hr_future', 'TECHNICIAN')
    expect(d.canOperate).toBe(true)
    expect(d.canView).toBe(true)
  })
})
