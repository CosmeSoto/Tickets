import type { HelpFaqItem, HelpModuleId } from './data/faq-by-module'
import { HELP_FAQS, HELP_MODULE_SECTIONS } from './data/faq-by-module'

export type HelpViewerRole = 'ADMIN' | 'TECHNICIAN' | 'CLIENT'

export type HelpModuleFlags = {
  tickets: boolean
  inventory: boolean
  patrols: boolean
  forms: boolean
  credentials: boolean
  /** Knowledge = tickets + canAccessKnowledge */
  knowledge: boolean
}

export function resolveHelpViewerRole(role: string | undefined): HelpViewerRole {
  if (role === 'ADMIN') return 'ADMIN'
  if (role === 'TECHNICIAN') return 'TECHNICIAN'
  return 'CLIENT'
}

export function isHelpModuleEnabled(moduleId: HelpModuleId, flags: HelpModuleFlags): boolean {
  switch (moduleId) {
    case 'account':
      return true
    case 'tickets':
      return flags.tickets
    case 'inventory':
      return flags.inventory
    case 'patrols':
      return flags.patrols
    case 'knowledge':
      return flags.knowledge
    case 'forms':
      return flags.forms
    case 'credentials':
      return flags.credentials
    default:
      return false
  }
}

export function filterHelpFaqs(
  flags: HelpModuleFlags,
  viewerRole: HelpViewerRole,
  faqs: HelpFaqItem[] = HELP_FAQS
): HelpFaqItem[] {
  return faqs.filter(faq => {
    if (!isHelpModuleEnabled(faq.module, flags)) return false
    if (!faq.roles || faq.roles.length === 0) return true
    return faq.roles.includes(viewerRole)
  })
}

export function visibleHelpSections(flags: HelpModuleFlags, faqs: HelpFaqItem[]) {
  const used = new Set(faqs.map(f => f.module))
  return HELP_MODULE_SECTIONS.filter(s => used.has(s.id) && isHelpModuleEnabled(s.id, flags))
}

export function faqMatchesQuery(faq: HelpFaqItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [faq.question, faq.answer, faq.category, ...(faq.keywords || [])]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}
