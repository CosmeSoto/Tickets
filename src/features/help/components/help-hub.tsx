'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HelpCircle,
  Mail,
  Package,
  Search,
  Shield,
  KeyRound,
  FileText,
  Ticket,
  User,
  ListTodo,
  Newspaper,
  Workflow,
  ScanLine,
  ZoomIn,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useUserModules } from '@/hooks/use-user-modules'
import { useSyncDashboardPageMeta } from '@/contexts/dashboard-shell-context'
import { detectMedia } from '@/components/common/media-url-input'
import { ImageLightbox } from '@/components/ui/image-lightbox'
import type { HelpFaqItem, HelpModuleId } from '@/features/help/data/faq-by-module'
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
  planner: ListTodo,
  news: Newspaper,
  processes: Workflow,
  access: ScanLine,
}

/** Mismo criterio que Noticias (news-detail.tsx) y Documentos (FormDetail.tsx):
 *  imagen directa se muestra con <img> con zoom (ImageLightbox), lo embebible
 *  (YouTube, Vimeo, Google Drive) con <iframe> sandboxeado, y lo que el
 *  proveedor bloquea (SharePoint, carpetas de Drive) muestra una tarjeta con
 *  el motivo en vez de un iframe condenado a fallar. */
function FaqMedia({ url }: { url: string }) {
  const [zoomOpen, setZoomOpen] = useState(false)
  const media = detectMedia(url)

  if (!media.canPreview) {
    return (
      <a
        href={url}
        target='_blank'
        rel='noopener noreferrer'
        className='inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2'
      >
        <ExternalLink className='h-3 w-3' />
        Ver adjunto
      </a>
    )
  }

  if (media.type === 'image' && media.embedUrl) {
    return (
      <>
        <button
          type='button'
          onClick={() => setZoomOpen(true)}
          className='group relative block w-full overflow-hidden rounded-md border'
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.embedUrl} alt='' className='w-full h-auto max-h-[320px] object-contain' />
          <span className='absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors'>
            <ZoomIn className='h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity' />
          </span>
        </button>
        {zoomOpen && (
          <ImageLightbox src={media.embedUrl} alt='Adjunto' onClose={() => setZoomOpen(false)} />
        )}
      </>
    )
  }

  if (media.canEmbed && media.embedUrl) {
    return (
      <iframe
        src={media.embedUrl}
        title='Adjunto'
        className='w-full h-[220px] sm:h-[300px] rounded-md border-0'
        allow='autoplay; fullscreen'
        // allow-same-origin: el src siempre es un dominio fijo y confiable
        // construido por detectMedia (youtube-nocookie.com, vimeo, drive.google.com,
        // etc.), nunca la URL cruda pegada por el editor. Sin este flag, YouTube y
        // otros reproductores no pueden inicializar su botón de play (queda en negro).
        sandbox='allow-scripts allow-same-origin allow-popups allow-forms allow-presentation'
      />
    )
  }

  // canPreview pero no embebible (SharePoint, carpetas de Drive, etc.)
  return (
    <div className='flex flex-col items-center justify-center gap-2 py-6 px-4 text-center rounded-md border bg-muted/30'>
      <p className='text-xs font-medium'>{media.label}</p>
      <p className='text-xs text-muted-foreground max-w-xs'>
        {media.previewNote || 'Este servicio no permite mostrar el contenido en vista previa.'}
      </p>
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={() => window.open(url, '_blank')}
        className='gap-1.5'
      >
        <ExternalLink className='h-3.5 w-3.5' />
        Abrir en nueva pestaña
      </Button>
    </div>
  )
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
    planner,
    news,
    processes,
    access,
    canRequestAssets,
    canAccessKnowledge,
    loading: modulesLoading,
  } = useUserModules()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedModule, setSelectedModule] = useState<HelpModuleId | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [config, setConfig] = useState<HelpConfig | null>(null)
  const [faqs, setFaqs] = useState<HelpFaqItem[]>([])
  const [faqsLoading, setFaqsLoading] = useState(true)

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

  useEffect(() => {
    fetch('/api/help/faqs')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (Array.isArray(data?.data)) setFaqs(data.data)
      })
      .catch(() => {})
      .finally(() => setFaqsLoading(false))
  }, [])

  const viewerRole = resolveHelpViewerRole(session?.user?.role)

  const flags: HelpModuleFlags = useMemo(
    () => ({
      tickets: !!tickets,
      inventory: !!inventory || !!canRequestAssets,
      patrols: !!patrols,
      forms: !!forms,
      credentials: !!credentials,
      planner: !!planner,
      news: !!news,
      processes: !!processes,
      access: !!access,
      knowledge: !!tickets && !!canAccessKnowledge,
    }),
    [
      tickets,
      inventory,
      canRequestAssets,
      patrols,
      forms,
      credentials,
      planner,
      news,
      processes,
      access,
      canAccessKnowledge,
    ]
  )

  const visibleFaqs = useMemo(
    () => filterHelpFaqs(flags, viewerRole, faqs),
    [flags, viewerRole, faqs]
  )

  const sections = useMemo(() => visibleHelpSections(flags, visibleFaqs), [flags, visibleFaqs])

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
              {session?.user?.role
                ? ` (${session.user.role === 'TECHNICIAN' ? 'técnico' : session.user.role === 'ADMIN' ? 'administrador' : 'cliente'})`
                : ''}
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

        {modulesLoading || faqsLoading ? (
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
                  <CardContent className='pt-0 pb-4 px-4 pl-11 space-y-3'>
                    <p className='text-sm text-muted-foreground whitespace-pre-line leading-relaxed'>
                      {faq.answer}
                    </p>
                    {faq.mediaUrl && <FaqMedia url={faq.mediaUrl} />}
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
                <a
                  href={`mailto:${config.supportEmail}?subject=${encodeURIComponent('Consulta de soporte')}`}
                >
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
            Al contactar, envía solo la información necesaria para atender tu caso. El tratamiento
            de datos personales se rige por la{' '}
            <Link
              href={config?.privacyUrl || '/help/privacy'}
              className='underline underline-offset-2'
              target='_blank'
              rel='noopener noreferrer'
              prefetch={false}
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
