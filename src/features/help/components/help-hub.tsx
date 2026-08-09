'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Mail,
  Package,
  Search,
  Shield,
  KeyRound,
  FileText,
  Ticket,
  User,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useUserModules } from '@/hooks/use-user-modules'
import { useSyncDashboardPageMeta } from '@/contexts/dashboard-shell-context'
import type { HelpModuleId } from '@/features/help/data/faq-by-module'
import {
  faqMatchesQuery,
  filterHelpFaqs,
  resolveHelpViewerRole,
  visibleHelpSections,
  type HelpModuleFlags,
} from '@/features/help/filter-help-faqs'

interface HelpConfig {
  supportEmail?: string | null
  chatEnabled?: boolean
  chatUrl?: string | null
  documentationUrl?: string | null
  videoTutorialsUrl?: string | null
  companyName?: string
  privacyUrl?: string
}

const MODULE_ICONS: Record<HelpModuleId, typeof HelpCircle> = {
  account: User,
  tickets: Ticket,
  inventory: Package,
  patrols: Shield,
  knowledge: BookOpen,
  forms: FileText,
  credentials: KeyRound,
}

function knowledgeHrefForRole(role?: string): string {
  if (role === 'ADMIN') return '/admin/knowledge'
  if (role === 'TECHNICIAN') return '/technician/knowledge'
  return '/knowledge'
}

export function HelpHub() {
  const { data: session } = useSession()
  const {
    tickets,
    inventory,
    patrols,
    forms,
    credentials,
    canRequestAssets,
    canAccessKnowledge,
    canManageInventory,
    loading: modulesLoading,
  } = useUserModules()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedModule, setSelectedModule] = useState<HelpModuleId | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [config, setConfig] = useState<HelpConfig | null>(null)

  useSyncDashboardPageMeta({
    title: 'Centro de Ayuda',
    subtitle: 'Guías según tus módulos y permisos',
  })

  useEffect(() => {
    fetch('/api/config/help')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.data) setConfig(data.data)
      })
      .catch(() => {})
  }, [])

  const viewerRole = resolveHelpViewerRole(session?.user?.role, !!canManageInventory)

  const flags: HelpModuleFlags = useMemo(
    () => ({
      tickets: !!tickets,
      inventory: !!inventory || !!canRequestAssets,
      patrols: !!patrols,
      forms: !!forms,
      credentials: !!credentials,
      knowledge: !!tickets && !!canAccessKnowledge,
    }),
    [
      tickets,
      inventory,
      canRequestAssets,
      patrols,
      forms,
      credentials,
      canAccessKnowledge,
    ]
  )

  const visibleFaqs = useMemo(
    () => filterHelpFaqs(flags, viewerRole),
    [flags, viewerRole]
  )

  const sections = useMemo(
    () => visibleHelpSections(flags, visibleFaqs),
    [flags, visibleFaqs]
  )

  const filteredFaqs = useMemo(() => {
    return visibleFaqs.filter(faq => {
      if (selectedModule !== 'all' && faq.module !== selectedModule) return false
      return faqMatchesQuery(faq, searchQuery)
    })
  }, [visibleFaqs, selectedModule, searchQuery])

  const createTicketHref =
    session?.user?.role === 'ADMIN'
      ? '/admin/tickets'
      : session?.user?.role === 'TECHNICIAN'
        ? '/technician/tickets'
        : '/client/tickets/create'

  return (
    <div className='max-w-4xl mx-auto space-y-6'>
      <Card>
        <CardContent className='p-4 sm:p-6 space-y-4'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder='Buscar por tema, módulo o palabra clave…'
              className='pl-10 h-11'
              aria-label='Buscar en el centro de ayuda'
            />
          </div>

          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              size='sm'
              variant={selectedModule === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedModule('all')}
            >
              Todos ({visibleFaqs.length})
            </Button>
            {sections.map(section => {
              const count = visibleFaqs.filter(f => f.module === section.id).length
              const Icon = MODULE_ICONS[section.id]
              return (
                <Button
                  key={section.id}
                  type='button'
                  size='sm'
                  variant={selectedModule === section.id ? 'default' : 'outline'}
                  onClick={() => setSelectedModule(section.id)}
                  className='gap-1.5'
                >
                  <Icon className='h-3.5 w-3.5' />
                  {section.title}
                  <span className='opacity-70'>({count})</span>
                </Button>
              )
            })}
          </div>

          {!modulesLoading && (
            <p className='text-xs text-muted-foreground'>
              Mostramos solo la ayuda de los módulos activos en tu cuenta
              {session?.user?.role ? ` (${session.user.role === 'TECHNICIAN' ? 'técnico' : session.user.role === 'ADMIN' ? 'administrador' : 'cliente'})` : ''}
              . Si falta un módulo, un administrador puede habilitarlo en tu ficha.
            </p>
          )}
        </CardContent>
      </Card>

      {flags.knowledge && (
        <Card className='border-primary/20 bg-primary/5'>
          <CardContent className='p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between'>
            <div className='space-y-1'>
              <p className='text-sm font-medium flex items-center gap-2'>
                <BookOpen className='h-4 w-4' />
                Base de conocimientos
              </p>
              <p className='text-xs text-muted-foreground'>
                Artículos operativos de tu organización (distinto de esta guía del sistema).
              </p>
            </div>
            <Button asChild size='sm' variant='secondary'>
              <Link href={knowledgeHrefForRole(session?.user?.role)}>Abrir conocimientos</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className='space-y-3'>
        <div className='flex items-center justify-between gap-2'>
          <h2 className='text-lg font-semibold'>Preguntas frecuentes</h2>
          <Badge variant='secondary'>{filteredFaqs.length} temas</Badge>
        </div>

        {modulesLoading ? (
          <Card>
            <CardContent className='p-6 text-sm text-muted-foreground'>
              Cargando ayuda según tus módulos…
            </CardContent>
          </Card>
        ) : filteredFaqs.length === 0 ? (
          <Card>
            <CardContent className='p-6 text-sm text-muted-foreground space-y-2'>
              <p>No hay resultados con ese filtro.</p>
              <p>Prueba otra búsqueda o elige «Todos». Si no ves módulos, revisa tus permisos.</p>
            </CardContent>
          </Card>
        ) : (
          filteredFaqs.map(faq => {
            const open = expandedId === faq.id
            const Icon = MODULE_ICONS[faq.module]
            return (
              <Card key={faq.id} className={cn(open && 'border-primary/30')}>
                <button
                  type='button'
                  className='w-full text-left p-4 flex gap-3 items-start'
                  onClick={() => setExpandedId(open ? null : faq.id)}
                  aria-expanded={open}
                >
                  <Icon className='h-4 w-4 mt-1 shrink-0 text-muted-foreground' />
                  <div className='flex-1 min-w-0 space-y-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant='outline' className='text-[10px]'>
                        {faq.category}
                      </Badge>
                    </div>
                    <p className='font-medium text-sm sm:text-base'>{faq.question}</p>
                  </div>
                  {open ? (
                    <ChevronUp className='h-4 w-4 shrink-0 text-muted-foreground' />
                  ) : (
                    <ChevronDown className='h-4 w-4 shrink-0 text-muted-foreground' />
                  )}
                </button>
                {open && (
                  <CardContent className='pt-0 pb-4 px-4 pl-11'>
                    <p className='text-sm text-muted-foreground whitespace-pre-line leading-relaxed'>
                      {faq.answer}
                    </p>
                  </CardContent>
                )}
              </Card>
            )
          })
        )}
      </div>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base flex items-center gap-2'>
            <HelpCircle className='h-4 w-4' />
            ¿Necesitas más ayuda?
          </CardTitle>
          <CardDescription>
            Usa el correo de soporte configurado por tu organización
            {config?.companyName ? ` (${config.companyName})` : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex flex-col sm:flex-row gap-2'>
            {flags.tickets && (
              <Button asChild className='flex-1'>
                <Link href={createTicketHref}>
                  <Ticket className='h-4 w-4 mr-2' />
                  {session?.user?.role === 'CLIENT' || !session?.user?.role
                    ? 'Crear ticket de soporte'
                    : 'Ir a tickets'}
                </Link>
              </Button>
            )}
            {config?.supportEmail ? (
              <Button asChild variant='default' className='flex-1'>
                <a href={`mailto:${config.supportEmail}?subject=${encodeURIComponent('Consulta de soporte')}`}>
                  <Mail className='h-4 w-4 mr-2' />
                  Contactar soporte
                </a>
              </Button>
            ) : (
              <Button asChild variant='outline' className='flex-1'>
                <Link href='/help/contact'>Formulario de contacto</Link>
              </Button>
            )}
          </div>
          {config?.supportEmail && (
            <p className='text-xs text-muted-foreground'>
              Correo: <span className='font-medium text-foreground'>{config.supportEmail}</span>
              {' · '}
              <Link href='/help/contact' className='underline underline-offset-2'>
                Más opciones de contacto
              </Link>
            </p>
          )}
          <p className='text-xs text-muted-foreground leading-relaxed'>
            Al contactar, envía solo la información necesaria para atender tu caso. El tratamiento de
            datos personales se rige por la{' '}
            <Link
              href={config?.privacyUrl || '/help/privacy'}
              className='underline underline-offset-2'
              target='_blank'
              rel='noopener noreferrer'
            >
              Política de Privacidad
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
