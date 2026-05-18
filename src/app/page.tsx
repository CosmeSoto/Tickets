'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import * as Icons from 'lucide-react'
import { SystemLogo } from '@/components/common/system-logo'
import { DynamicFavicon } from '@/components/common/dynamic-favicon'
import { Button } from '@/components/ui/button'
import { ForSaleSection } from '@/components/landing/ForSaleSection'
import { PublicEquipmentItem } from '@/components/inventory/public/PublicEquipmentCard'

interface LandingContent {
  heroTitle: string
  heroSubtitle: string
  heroCtaPrimary: string
  heroCtaPrimaryUrl: string
  heroCtaSecondary: string
  heroCtaSecondaryUrl: string
  heroImageUrl?: string
  servicesTitle: string
  servicesSubtitle: string
  servicesEnabled: boolean
  companyName: string
  companyTagline?: string
  faviconUrl?: string
  contactEmail?: string
  contactPhone?: string
  contactAddress?: string
  socialFacebook?: string
  socialInstagram?: string
  socialTwitter?: string
  socialLinkedin?: string
  socialWhatsapp?: string
  scheduleText?: string
  footerText: string
  footerLinksJson?: string
}

interface Service {
  id: string
  icon: string
  iconColor: string
  title: string
  description: string
}

const defaultContent: LandingContent = {
  heroTitle: 'Gestión Integral de Operaciones',
  heroSubtitle: 'Tickets, inventario, rondas en una sola plataforma',
  heroCtaPrimary: 'Crear Ticket de Soporte',
  heroCtaPrimaryUrl: '/login',
  heroCtaSecondary: 'Ver Servicios',
  heroCtaSecondaryUrl: '#servicios',
  heroImageUrl: '',
  servicesTitle: 'Nuestros Servicios',
  servicesSubtitle: 'Ofrecemos soporte técnico integral',
  servicesEnabled: true,
  companyName: 'Sistema de Tickets',
  companyTagline: 'Gestión Integral de Operaciones',
  footerText: `© ${new Date().getFullYear()} Sistema de Tickets`,
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [content, setContent] = useState<LandingContent | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [forSaleItems, setForSaleItems] = useState<PublicEquipmentItem[]>([])
  const [forSaleEnabled, setForSaleEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  // Redirigir usuarios autenticados al dashboard
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const dest =
        session.user.role === 'ADMIN'
          ? '/admin'
          : session.user.role === 'TECHNICIAN'
            ? '/technician'
            : '/client'
      router.replace(dest)
    }
  }, [status, session, router])

  useEffect(() => {
    // Fetch landing page content and services
    fetch('/api/public/landing-page')
      .then(r => r.json())
      .then(data => {
        setContent(data.content)
        setServices(data.services)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Fetch assets for sale (up to 6 items for preview)
    fetch('/api/public/assets-for-sale?limit=6')
      .then(r => r.json())
      .then(data => {
        setForSaleItems(data.items ?? [])
        // Check if the public sale section is enabled (default: true)
        if (data.sectionEnabled !== undefined) {
          setForSaleEnabled(data.sectionEnabled)
        }
      })
      .catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background'>
        <div className='text-center'>
          <Loader2 className='h-10 w-10 animate-spin text-primary mx-auto mb-3' />
          <p className='text-sm text-muted-foreground'>Cargando...</p>
        </div>
      </div>
    )
  }

  const d: LandingContent = { ...defaultContent, ...content }

  const getIcon = (name: string) => (Icons as any)[name] || Icons.HelpCircle

  const iconColorClass: Record<string, string> = {
    blue: 'bg-primary/10 text-primary',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    red: 'bg-destructive/10 text-destructive',
  }

  const dashboardHref =
    session?.user?.role === 'ADMIN'
      ? '/admin'
      : session?.user?.role === 'TECHNICIAN'
        ? '/technician'
        : '/client'

  const hasHeroImage = !!d.heroImageUrl

  return (
    <>
      <DynamicFavicon faviconUrl={d.faviconUrl} />
      <div className='min-h-screen bg-background flex flex-col'>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className='bg-card border-b border-border sticky top-0 z-40 shadow-sm'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='flex justify-between items-center h-16 sm:h-20'>
              <SystemLogo size='lg' showText={true} />
              <nav className='flex items-center gap-2 sm:gap-3'>
                {status === 'authenticated' && session?.user ? (
                  <Button asChild size='sm'>
                    <Link href={dashboardHref}>Ir al Dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant='ghost' size='sm'>
                      <Link href='/login'>Iniciar Sesión</Link>
                    </Button>
                    <Button asChild size='sm' className='hidden sm:inline-flex'>
                      <Link href='/client/tickets/create'>Crear Ticket</Link>
                    </Button>
                  </>
                )}
              </nav>
            </div>
          </div>
        </header>

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section
          className='relative flex-1 flex items-center py-24 sm:py-32 overflow-hidden'
          style={
            hasHeroImage
              ? {
                  backgroundImage: `url(${d.heroImageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          {hasHeroImage && <div className='absolute inset-0 bg-background/70' />}

          {!hasHeroImage && (
            <>
              {/* Gradiente base más visible en light mode */}
              <div className='absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-background to-primary/[0.04] pointer-events-none' />
              {/* Círculos decorativos con el color primario */}
              <div className='absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/[0.07] blur-3xl pointer-events-none' />
              <div className='absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/[0.06] blur-3xl pointer-events-none' />
              {/* Línea de acento en la parte superior */}
              <div className='absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent' />
            </>
          )}

          <div className='relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full'>
            {/* Badge */}
            <div className='inline-flex items-center gap-2 bg-primary/10 border border-primary/25 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-8'>
              <span className='w-2 h-2 rounded-full bg-primary animate-pulse' />
              Gestión Integral de Operaciones integral
            </div>

            <h1 className='text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-foreground leading-tight'>
              {(() => {
                const words = d.heroTitle.trim().split(/\s+/).filter(Boolean)
                if (words.length === 0) {
                  return <span className='text-primary'>Soporte</span>
                }
                if (words.length === 1) {
                  return <span className='text-primary'>{words[0]}</span>
                }
                const rest = words.slice(0, -1).join(' ')
                const last = words[words.length - 1]
                return (
                  <>
                    {rest} <span className='text-primary'>{last}</span>
                  </>
                )
              })()}
            </h1>
            <p className='text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed'>
              {d.heroSubtitle}
            </p>
            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <Button asChild size='lg' className='text-base px-8 shadow-md'>
                <Link href={d.heroCtaPrimaryUrl}>{d.heroCtaPrimary}</Link>
              </Button>
              <Button
                asChild
                size='lg'
                variant='outline'
                className='text-base px-8 border-primary/30 hover:bg-primary/5'
              >
                <Link href={d.heroCtaSecondaryUrl}>{d.heroCtaSecondary}</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Services ───────────────────────────────────────────────────── */}
        {d.servicesEnabled && services.length > 0 && (
          <section id='servicios' className='py-20 border-y border-border relative overflow-hidden'>
            <div className='absolute inset-0 bg-gradient-to-b from-muted/50 via-muted/30 to-muted/50 pointer-events-none' />
            <div className='absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.06),transparent_60%)] pointer-events-none' />

            <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
              <div className='text-center mb-14'>
                <div className='flex items-center justify-center gap-3 mb-4'>
                  <div className='h-px w-12 bg-primary/40' />
                  <span className='text-primary text-sm font-semibold uppercase tracking-widest'>
                    Servicios
                  </span>
                  <div className='h-px w-12 bg-primary/40' />
                </div>
                <h2 className='text-3xl sm:text-4xl font-bold text-foreground mb-3'>
                  {d.servicesTitle}
                </h2>
                <p className='text-muted-foreground text-lg max-w-2xl mx-auto'>
                  {d.servicesSubtitle}
                </p>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                {services.map(service => {
                  const Icon = getIcon(service.icon)
                  const colorCls = iconColorClass[service.iconColor] ?? 'bg-primary/10 text-primary'
                  return (
                    <div
                      key={service.id}
                      className='bg-card rounded-xl border border-border p-6 text-center shadow-sm hover:shadow-lg hover:border-primary/40 hover:-translate-y-1 transition-all duration-200 group'
                    >
                      <div
                        className={`mx-auto w-14 h-14 ${colorCls} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}
                      >
                        <Icon className='h-7 w-7' />
                      </div>
                      <h3 className='text-lg font-semibold text-foreground mb-2'>
                        {service.title}
                      </h3>
                      <p className='text-sm text-muted-foreground leading-relaxed'>
                        {service.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── For Sale Section ───────────────────────────────────────────── */}
        {forSaleEnabled && forSaleItems.length > 0 && <ForSaleSection items={forSaleItems} />}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer className='bg-card border-t border-border'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            {/* Main footer content */}
            <div className='py-12 grid grid-cols-1 md:grid-cols-3 gap-8'>
              {/* Company Info */}
              <div className='space-y-4'>
                <SystemLogo size='md' showText={true} />
                {d.companyTagline && (
                  <p className='text-sm text-muted-foreground'>{d.companyTagline}</p>
                )}
                {/* Social Icons */}
                {(d.socialFacebook ||
                  d.socialInstagram ||
                  d.socialTwitter ||
                  d.socialLinkedin ||
                  d.socialWhatsapp) && (
                  <div className='flex items-center gap-3 pt-2'>
                    {d.socialFacebook && (
                      <a
                        href={d.socialFacebook}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors'
                        aria-label='Facebook'
                      >
                        <Icons.Facebook className='h-4 w-4' />
                      </a>
                    )}
                    {d.socialInstagram && (
                      <a
                        href={d.socialInstagram}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors'
                        aria-label='Instagram'
                      >
                        <Icons.Instagram className='h-4 w-4' />
                      </a>
                    )}
                    {d.socialTwitter && (
                      <a
                        href={d.socialTwitter}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors'
                        aria-label='Twitter'
                      >
                        <Icons.Twitter className='h-4 w-4' />
                      </a>
                    )}
                    {d.socialLinkedin && (
                      <a
                        href={d.socialLinkedin}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors'
                        aria-label='LinkedIn'
                      >
                        <Icons.Linkedin className='h-4 w-4' />
                      </a>
                    )}
                    {d.socialWhatsapp && (
                      <a
                        href={d.socialWhatsapp}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors'
                        aria-label='WhatsApp'
                      >
                        <Icons.MessageCircle className='h-4 w-4' />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Contact Info */}
              {(d.contactEmail || d.contactPhone || d.contactAddress || d.scheduleText) && (
                <div className='space-y-3'>
                  <h4 className='text-sm font-semibold text-foreground'>Contacto</h4>
                  {d.contactEmail && (
                    <a
                      href={`mailto:${d.contactEmail}`}
                      className='flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors'
                    >
                      <Icons.Mail className='h-4 w-4 flex-shrink-0' />
                      {d.contactEmail}
                    </a>
                  )}
                  {d.contactPhone && (
                    <a
                      href={`tel:${d.contactPhone}`}
                      className='flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors'
                    >
                      <Icons.Phone className='h-4 w-4 flex-shrink-0' />
                      {d.contactPhone}
                    </a>
                  )}
                  {d.contactAddress && (
                    <p className='flex items-start gap-2 text-sm text-muted-foreground'>
                      <Icons.MapPin className='h-4 w-4 flex-shrink-0 mt-0.5' />
                      {d.contactAddress}
                    </p>
                  )}
                  {d.scheduleText && (
                    <p className='flex items-center gap-2 text-sm text-muted-foreground'>
                      <Icons.Clock className='h-4 w-4 flex-shrink-0' />
                      {d.scheduleText}
                    </p>
                  )}
                </div>
              )}

              {/* Footer Links */}
              {d.footerLinksJson &&
                (() => {
                  try {
                    const links = JSON.parse(d.footerLinksJson) as { label: string; url: string }[]
                    if (links.length === 0) return null
                    return (
                      <div className='space-y-3'>
                        <h4 className='text-sm font-semibold text-foreground'>Enlaces</h4>
                        <nav className='flex flex-col gap-2'>
                          {links.map((link, i) => (
                            <a
                              key={i}
                              href={link.url}
                              className='text-sm text-muted-foreground hover:text-foreground transition-colors'
                            >
                              {link.label}
                            </a>
                          ))}
                        </nav>
                      </div>
                    )
                  } catch {
                    return null
                  }
                })()}
            </div>

            {/* Bottom bar */}
            <div className='border-t border-border py-6'>
              <p className='text-center text-xs text-muted-foreground'>{d.footerText}</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
