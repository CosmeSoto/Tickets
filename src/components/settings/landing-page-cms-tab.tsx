'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Globe,
  Save,
  Eye,
  Crown,
  Building2,
  Mail,
  Phone,
  MapPin,
  Clock,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  MessageCircle,
  Link2,
  X,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ImageUploader } from './image-uploader'
import { LandingServicesManager } from './landing-services-manager'

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
  companyTagline: string
  companyLogoLightUrl?: string
  companyLogoDarkUrl?: string
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
  metaTitle: string
  metaDescription: string
}

export function LandingPageCMSTab({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const [content, setContent] = useState<LandingContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadContent()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Detectar cambios no guardados
  useEffect(() => {
    if (content) {
      setHasUnsavedChanges(true)
    }
  }, [content])

  const loadContent = async () => {
    try {
      const response = await fetch('/api/admin/landing-page')
      if (response.ok) {
        const data = await response.json()
        // Asegurar que todos los campos tengan valores por defecto
        setContent({
          heroTitle: data.heroTitle || '',
          heroSubtitle: data.heroSubtitle || '',
          heroCtaPrimary: data.heroCtaPrimary || '',
          heroCtaPrimaryUrl: data.heroCtaPrimaryUrl || '/login',
          heroCtaSecondary: data.heroCtaSecondary || '',
          heroCtaSecondaryUrl: data.heroCtaSecondaryUrl || '#servicios',
          heroImageUrl: data.heroImageUrl || '',
          servicesTitle: data.servicesTitle || '',
          servicesSubtitle: data.servicesSubtitle || '',
          servicesEnabled: data.servicesEnabled ?? true,
          companyName: data.companyName || '',
          companyTagline: data.companyTagline || '',
          companyLogoLightUrl: data.companyLogoLightUrl || '',
          companyLogoDarkUrl: data.companyLogoDarkUrl || '',
          faviconUrl: data.faviconUrl || '',
          contactEmail: data.contactEmail || '',
          contactPhone: data.contactPhone || '',
          contactAddress: data.contactAddress || '',
          socialFacebook: data.socialFacebook || '',
          socialInstagram: data.socialInstagram || '',
          socialTwitter: data.socialTwitter || '',
          socialLinkedin: data.socialLinkedin || '',
          socialWhatsapp: data.socialWhatsapp || '',
          scheduleText: data.scheduleText || '',
          footerText: data.footerText || '',
          footerLinksJson: data.footerLinksJson || '',
          metaTitle: data.metaTitle || '',
          metaDescription: data.metaDescription || '',
        })
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      console.error('Error loading content:', error)
      toast({
        title: 'Error',
        description: 'Error al cargar el contenido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const saveContent = async () => {
    if (!content) return

    console.log('💾 Saving content:', {
      companyLogoLightUrl: content.companyLogoLightUrl,
      companyLogoDarkUrl: content.companyLogoDarkUrl,
      heroImageUrl: content.heroImageUrl,
    })

    setSaving(true)
    try {
      const response = await fetch('/api/admin/landing-page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Save result:', result)
        setHasUnsavedChanges(false)
        const { invalidateLandingCache } = await import('@/hooks/use-landing-data')
        invalidateLandingCache()
        window.dispatchEvent(new CustomEvent('landing-updated'))
        toast({
          title: 'Éxito',
          description: 'Contenido guardado correctamente',
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al guardar')
      }
    } catch (error) {
      console.error('❌ Save error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al guardar el contenido',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className='py-8'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4'></div>
            <p className='text-muted-foreground'>Cargando contenido...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!content) return null

  return (
    <div className='space-y-6'>
      {/* Header con acciones */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0'>
          <h3 className='text-lg font-medium'>Gestión de Página Pública</h3>
          <p className='text-sm text-muted-foreground'>
            Personaliza el contenido de la página de inicio
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2 sm:justify-end flex-shrink-0'>
          <Button
            variant='outline'
            size='sm'
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              const previewUrl = `${window.location.origin}/?preview=true`
              window.open(previewUrl, '_blank', 'noopener,noreferrer')
            }}
          >
            <Eye className='h-4 w-4 mr-2' />
            Vista Previa
          </Button>
          <Button size='sm' onClick={saveContent} disabled={saving}>
            <Save className='h-4 w-4 mr-2' />
            {saving ? 'Guardando...' : hasUnsavedChanges ? 'Guardar Cambios *' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>

      {/* Sección Hero */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center'>
            <Globe className='h-5 w-5 mr-2' />
            Sección Hero
          </CardTitle>
          <CardDescription>Contenido principal de la página de inicio</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='heroTitle'>Título Principal</Label>
            <Input
              id='heroTitle'
              value={content.heroTitle}
              onChange={e => setContent({ ...content, heroTitle: e.target.value })}
              placeholder='Soporte profesional para toda la organización'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='heroSubtitle'>Subtítulo</Label>
            <Textarea
              id='heroSubtitle'
              value={content.heroSubtitle}
              onChange={e => setContent({ ...content, heroSubtitle: e.target.value })}
              placeholder='Descripción breve de tus servicios'
              rows={3}
            />
          </div>

          <div className='space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='heroCtaPrimary'>Texto Botón Principal</Label>
                <Input
                  id='heroCtaPrimary'
                  value={content.heroCtaPrimary}
                  onChange={e => setContent({ ...content, heroCtaPrimary: e.target.value })}
                  placeholder='Crear Ticket de Soporte'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='heroCtaPrimaryUrl'>Acción Botón Principal</Label>
                <Select
                  value={content.heroCtaPrimaryUrl}
                  onValueChange={value => setContent({ ...content, heroCtaPrimaryUrl: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='/login'>Iniciar Sesión</SelectItem>
                    <SelectItem value='/register'>Registrarse</SelectItem>
                    <SelectItem value='/client/tickets/create'>Crear Ticket</SelectItem>
                    <SelectItem value='#servicios'>Ver Servicios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='heroCtaSecondary'>Texto Botón Secundario</Label>
                <Input
                  id='heroCtaSecondary'
                  value={content.heroCtaSecondary}
                  onChange={e => setContent({ ...content, heroCtaSecondary: e.target.value })}
                  placeholder='Ver Servicios'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='heroCtaSecondaryUrl'>Acción Botón Secundario</Label>
                <Select
                  value={content.heroCtaSecondaryUrl}
                  onValueChange={value => setContent({ ...content, heroCtaSecondaryUrl: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='#servicios'>Ver Servicios</SelectItem>
                    <SelectItem value='/login'>Iniciar Sesión</SelectItem>
                    <SelectItem value='/register'>Registrarse</SelectItem>
                    <SelectItem value='/client/tickets/create'>Crear Ticket</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className='space-y-2'>
            <ImageUploader
              label='Imagen de Fondo (Opcional)'
              currentUrl={content.heroImageUrl}
              onUpload={url => {
                console.log('🖼️ Hero image uploaded, updating state:', url)
                setContent({ ...content, heroImageUrl: url })
              }}
              type='hero-bg'
            />
          </div>
        </CardContent>
      </Card>

      {/* Sección Servicios */}
      <Card>
        <CardHeader>
          <CardTitle>Sección de Servicios</CardTitle>
          <CardDescription>Configura la sección de servicios</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center space-x-2'>
            <Switch
              id='servicesEnabled'
              checked={content.servicesEnabled}
              onCheckedChange={checked => setContent({ ...content, servicesEnabled: checked })}
            />
            <Label htmlFor='servicesEnabled'>Mostrar sección de servicios</Label>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='servicesTitle'>Título de Servicios</Label>
            <Input
              id='servicesTitle'
              value={content.servicesTitle}
              onChange={e => setContent({ ...content, servicesTitle: e.target.value })}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='servicesSubtitle'>Subtítulo de Servicios</Label>
            <Input
              id='servicesSubtitle'
              value={content.servicesSubtitle}
              onChange={e => setContent({ ...content, servicesSubtitle: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Gestión de Servicios */}
      <LandingServicesManager />

      {/* Información de la Empresa y Footer */}
      <Card className={!isSuperAdmin ? 'opacity-60' : ''}>
        <CardHeader className='pb-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center'>
                <Building2 className='h-5 w-5 text-primary' />
              </div>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  Empresa y Footer
                  {!isSuperAdmin && (
                    <Badge className='bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1 text-xs'>
                      <Crown className='h-3 w-3' />
                      Solo Super Admin
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isSuperAdmin
                    ? 'Identidad, contacto, redes sociales y pie de página'
                    : 'Solo el Administrador Principal puede modificar esta sección'}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue='identity' className='w-full'>
            <TabsList className='grid w-full grid-cols-4'>
              <TabsTrigger value='identity'>Identidad</TabsTrigger>
              <TabsTrigger value='contact'>Contacto</TabsTrigger>
              <TabsTrigger value='social'>Redes</TabsTrigger>
              <TabsTrigger value='footer'>Footer</TabsTrigger>
            </TabsList>

            {/* Tab: Identidad */}
            <TabsContent value='identity' className='space-y-5 mt-5'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='companyName' className='text-sm font-medium'>
                    Nombre de la Empresa
                  </Label>
                  <Input
                    id='companyName'
                    value={content.companyName}
                    onChange={e =>
                      isSuperAdmin && setContent({ ...content, companyName: e.target.value })
                    }
                    disabled={!isSuperAdmin}
                    placeholder='Mi Empresa S.A.'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='companyTagline' className='text-sm font-medium'>
                    Eslogan
                  </Label>
                  <Input
                    id='companyTagline'
                    value={content.companyTagline}
                    onChange={e =>
                      isSuperAdmin && setContent({ ...content, companyTagline: e.target.value })
                    }
                    disabled={!isSuperAdmin}
                    placeholder='Tu frase representativa'
                  />
                </div>
              </div>

              <Separator />

              <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                <ImageUploader
                  label='Favicon'
                  currentUrl={content.faviconUrl}
                  onUpload={url => {
                    if (!isSuperAdmin) return
                    setContent({ ...content, faviconUrl: url })
                  }}
                  type='favicon'
                />
                <ImageUploader
                  label='Logo Tema Claro'
                  currentUrl={content.companyLogoLightUrl}
                  onUpload={url => {
                    if (!isSuperAdmin) return
                    setContent({ ...content, companyLogoLightUrl: url })
                  }}
                  type='logo-light'
                />
                <ImageUploader
                  label='Logo Tema Oscuro'
                  currentUrl={content.companyLogoDarkUrl}
                  onUpload={url => {
                    if (!isSuperAdmin) return
                    setContent({ ...content, companyLogoDarkUrl: url })
                  }}
                  type='logo-dark'
                />
              </div>
            </TabsContent>

            {/* Tab: Contacto */}
            <TabsContent value='contact' className='space-y-5 mt-5'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label
                    htmlFor='contactEmail'
                    className='flex items-center gap-2 text-sm font-medium'
                  >
                    <Mail className='h-4 w-4 text-muted-foreground' />
                    Correo Electrónico
                  </Label>
                  <Input
                    id='contactEmail'
                    type='email'
                    value={content.contactEmail || ''}
                    onChange={e =>
                      isSuperAdmin && setContent({ ...content, contactEmail: e.target.value })
                    }
                    disabled={!isSuperAdmin}
                    placeholder='contacto@empresa.com'
                  />
                </div>
                <div className='space-y-2'>
                  <Label
                    htmlFor='contactPhone'
                    className='flex items-center gap-2 text-sm font-medium'
                  >
                    <Phone className='h-4 w-4 text-muted-foreground' />
                    Teléfono
                  </Label>
                  <Input
                    id='contactPhone'
                    value={content.contactPhone || ''}
                    onChange={e =>
                      isSuperAdmin && setContent({ ...content, contactPhone: e.target.value })
                    }
                    disabled={!isSuperAdmin}
                    placeholder='+56 9 1234 5678'
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label
                  htmlFor='contactAddress'
                  className='flex items-center gap-2 text-sm font-medium'
                >
                  <MapPin className='h-4 w-4 text-muted-foreground' />
                  Dirección
                </Label>
                <Input
                  id='contactAddress'
                  value={content.contactAddress || ''}
                  onChange={e =>
                    isSuperAdmin && setContent({ ...content, contactAddress: e.target.value })
                  }
                  disabled={!isSuperAdmin}
                  placeholder='Av. Principal 123, Ciudad'
                />
              </div>

              <div className='space-y-2'>
                <Label
                  htmlFor='scheduleText'
                  className='flex items-center gap-2 text-sm font-medium'
                >
                  <Clock className='h-4 w-4 text-muted-foreground' />
                  Horario de Atención
                </Label>
                <Input
                  id='scheduleText'
                  value={content.scheduleText || ''}
                  onChange={e =>
                    isSuperAdmin && setContent({ ...content, scheduleText: e.target.value })
                  }
                  disabled={!isSuperAdmin}
                  placeholder='Lunes a Viernes, 9:00 - 18:00'
                />
              </div>
            </TabsContent>

            {/* Tab: Redes Sociales */}
            <TabsContent value='social' className='space-y-5 mt-5'>
              <p className='text-sm text-muted-foreground'>
                Agrega los enlaces a tus redes sociales. Se mostrarán como íconos en el footer.
              </p>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label
                    htmlFor='socialFacebook'
                    className='flex items-center gap-2 text-sm font-medium'
                  >
                    <Facebook className='h-4 w-4 text-[#1877F2]' />
                    Facebook
                  </Label>
                  <Input
                    id='socialFacebook'
                    value={content.socialFacebook || ''}
                    onChange={e =>
                      isSuperAdmin && setContent({ ...content, socialFacebook: e.target.value })
                    }
                    disabled={!isSuperAdmin}
                    placeholder='https://facebook.com/tu-pagina'
                  />
                </div>
                <div className='space-y-2'>
                  <Label
                    htmlFor='socialInstagram'
                    className='flex items-center gap-2 text-sm font-medium'
                  >
                    <Instagram className='h-4 w-4 text-[#E4405F]' />
                    Instagram
                  </Label>
                  <Input
                    id='socialInstagram'
                    value={content.socialInstagram || ''}
                    onChange={e =>
                      isSuperAdmin && setContent({ ...content, socialInstagram: e.target.value })
                    }
                    disabled={!isSuperAdmin}
                    placeholder='https://instagram.com/tu-cuenta'
                  />
                </div>
                <div className='space-y-2'>
                  <Label
                    htmlFor='socialTwitter'
                    className='flex items-center gap-2 text-sm font-medium'
                  >
                    <Twitter className='h-4 w-4 text-[#1DA1F2]' />
                    Twitter / X
                  </Label>
                  <Input
                    id='socialTwitter'
                    value={content.socialTwitter || ''}
                    onChange={e =>
                      isSuperAdmin && setContent({ ...content, socialTwitter: e.target.value })
                    }
                    disabled={!isSuperAdmin}
                    placeholder='https://twitter.com/tu-cuenta'
                  />
                </div>
                <div className='space-y-2'>
                  <Label
                    htmlFor='socialLinkedin'
                    className='flex items-center gap-2 text-sm font-medium'
                  >
                    <Linkedin className='h-4 w-4 text-[#0A66C2]' />
                    LinkedIn
                  </Label>
                  <Input
                    id='socialLinkedin'
                    value={content.socialLinkedin || ''}
                    onChange={e =>
                      isSuperAdmin && setContent({ ...content, socialLinkedin: e.target.value })
                    }
                    disabled={!isSuperAdmin}
                    placeholder='https://linkedin.com/company/tu-empresa'
                  />
                </div>
                <div className='space-y-2 md:col-span-2'>
                  <Label
                    htmlFor='socialWhatsapp'
                    className='flex items-center gap-2 text-sm font-medium'
                  >
                    <MessageCircle className='h-4 w-4 text-[#25D366]' />
                    WhatsApp
                  </Label>
                  <Input
                    id='socialWhatsapp'
                    value={content.socialWhatsapp || ''}
                    onChange={e =>
                      isSuperAdmin && setContent({ ...content, socialWhatsapp: e.target.value })
                    }
                    disabled={!isSuperAdmin}
                    placeholder='https://wa.me/593987654321'
                  />
                  <p className='text-xs text-muted-foreground'>
                    URL del footer y fallback del catálogo de equipos en desuso (si la familia no
                    tiene WhatsApp propio).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Footer */}
            <TabsContent value='footer' className='space-y-5 mt-5'>
              <div className='space-y-2'>
                <Label htmlFor='footerText' className='text-sm font-medium'>
                  Texto de Copyright
                </Label>
                <Input
                  id='footerText'
                  value={content.footerText}
                  onChange={e =>
                    isSuperAdmin && setContent({ ...content, footerText: e.target.value })
                  }
                  disabled={!isSuperAdmin}
                  placeholder='© 2025 Mi Empresa. Todos los derechos reservados.'
                />
                <p className='text-xs text-muted-foreground'>
                  Se muestra en la parte inferior del footer
                </p>
              </div>

              <Separator />

              <div className='space-y-3'>
                <div className='flex items-center justify-between flex-wrap gap-2'>
                  <div className='flex items-center gap-2'>
                    <Link2 className='h-4 w-4 text-muted-foreground' />
                    <Label className='text-sm font-medium'>Enlaces del Footer</Label>
                  </div>
                  {isSuperAdmin && (
                    <div className='flex gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => {
                          const exampleLinks = [
                            { label: 'Política de Privacidad', url: '/help/privacy' },
                            { label: 'Términos de Uso', url: '/help/terms' },
                            { label: 'Centro de Ayuda', url: '/help/center' },
                          ]
                          setContent({
                            ...content,
                            footerLinksJson: JSON.stringify(exampleLinks, null, 2),
                          })
                        }}
                      >
                        Cargar Ejemplo
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => {
                          let currentLinks: { label: string; url: string }[] = []
                          try {
                            if (content.footerLinksJson) {
                              currentLinks = JSON.parse(content.footerLinksJson)
                            }
                          } catch {}
                          currentLinks.push({ label: '', url: '' })
                          setContent({
                            ...content,
                            footerLinksJson: JSON.stringify(currentLinks, null, 2),
                          })
                        }}
                      >
                        Agregar Enlace
                      </Button>
                    </div>
                  )}
                </div>
                <p className='text-xs text-muted-foreground'>
                  Agrega enlaces adicionales que aparecerán en el footer. Ejemplo: Políticas de
                  privacidad, Términos de uso, etc.
                </p>

                {(() => {
                  let links: { label: string; url: string }[] = []
                  try {
                    if (content.footerLinksJson) {
                      links = JSON.parse(content.footerLinksJson)
                    }
                  } catch {}

                  const exampleJson = JSON.stringify(
                    [
                      { label: 'Política de Privacidad', url: '/privacidad' },
                      { label: 'Términos de Uso', url: '/terminos' },
                      { label: 'Preguntas Frecuentes', url: '/help/center' },
                    ],
                    null,
                    2
                  )

                  return (
                    <div className='space-y-3'>
                      {links.map((link, index) => (
                        <div key={index} className='flex gap-2 items-start'>
                          <div className='flex-1 grid grid-cols-1 md:grid-cols-2 gap-2'>
                            <div className='space-y-1'>
                              <Label className='text-xs'>Texto del Enlace</Label>
                              <Input
                                value={link.label}
                                onChange={e => {
                                  if (!isSuperAdmin) return
                                  const newLinks = [...links]
                                  newLinks[index].label = e.target.value
                                  setContent({
                                    ...content,
                                    footerLinksJson: JSON.stringify(newLinks, null, 2),
                                  })
                                }}
                                disabled={!isSuperAdmin}
                                placeholder='Política de Privacidad'
                              />
                            </div>
                            <div className='space-y-1'>
                              <Label className='text-xs'>URL</Label>
                              <Input
                                value={link.url}
                                onChange={e => {
                                  if (!isSuperAdmin) return
                                  const newLinks = [...links]
                                  newLinks[index].url = e.target.value
                                  setContent({
                                    ...content,
                                    footerLinksJson: JSON.stringify(newLinks, null, 2),
                                  })
                                }}
                                disabled={!isSuperAdmin}
                                placeholder='/privacidad'
                              />
                            </div>
                          </div>
                          {isSuperAdmin && (
                            <Button
                              variant='ghost'
                              size='sm'
                              className='mt-6'
                              onClick={() => {
                                const newLinks = links.filter((_, i) => i !== index)
                                setContent({
                                  ...content,
                                  footerLinksJson: JSON.stringify(newLinks, null, 2),
                                })
                              }}
                            >
                              <X className='h-4 w-4' />
                            </Button>
                          )}
                        </div>
                      ))}

                      <details className='mt-4'>
                        <summary className='text-xs text-muted-foreground cursor-pointer'>
                          Ver JSON crudo
                        </summary>
                        <Textarea
                          id='footerLinksJson'
                          value={content.footerLinksJson || exampleJson}
                          onChange={e =>
                            isSuperAdmin &&
                            setContent({ ...content, footerLinksJson: e.target.value })
                          }
                          disabled={!isSuperAdmin}
                          placeholder={exampleJson}
                          rows={6}
                          className='font-mono text-xs mt-2'
                        />
                      </details>
                    </div>
                  )
                })()}
              </div>

              <Separator />

              {/* Preview del Footer */}
              <div className='space-y-2'>
                <Label className='text-sm font-medium'>Vista Previa del Footer</Label>
                <div className='rounded-lg border bg-muted/30 p-6'>
                  <div className='max-w-md mx-auto text-center space-y-3'>
                    <p className='font-semibold text-sm'>
                      {content.companyName || 'Nombre de la Empresa'}
                    </p>
                    {content.companyTagline && (
                      <p className='text-xs text-muted-foreground'>{content.companyTagline}</p>
                    )}
                    <div className='flex items-center justify-center gap-3'>
                      {content.socialFacebook && (
                        <Facebook className='h-4 w-4 text-muted-foreground' />
                      )}
                      {content.socialInstagram && (
                        <Instagram className='h-4 w-4 text-muted-foreground' />
                      )}
                      {content.socialTwitter && (
                        <Twitter className='h-4 w-4 text-muted-foreground' />
                      )}
                      {content.socialLinkedin && (
                        <Linkedin className='h-4 w-4 text-muted-foreground' />
                      )}
                      {content.socialWhatsapp && (
                        <MessageCircle className='h-4 w-4 text-muted-foreground' />
                      )}
                    </div>
                    {/* Vista previa de enlaces */}
                    {(() => {
                      let links: { label: string; url: string }[] = []
                      try {
                        if (content.footerLinksJson) {
                          links = JSON.parse(content.footerLinksJson)
                        }
                      } catch {}

                      if (links.length > 0) {
                        return (
                          <div className='flex flex-wrap items-center justify-center gap-x-4 gap-y-1'>
                            {links.map((link, index) => (
                              <span
                                key={index}
                                className='text-xs text-muted-foreground hover:text-foreground cursor-pointer'
                              >
                                {link.label || 'Enlace sin nombre'}
                              </span>
                            ))}
                          </div>
                        )
                      }
                      return null
                    })()}
                    <p className='text-xs text-muted-foreground'>
                      {content.footerText || '© 2025'}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* SEO */}
      <Card className={!isSuperAdmin ? 'opacity-60' : ''}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            SEO y Metadatos
            {!isSuperAdmin && (
              <Badge className='bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1 text-xs'>
                <Crown className='h-3 w-3' />
                Solo Super Admin
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isSuperAdmin
              ? 'Optimiza tu página para motores de búsqueda'
              : 'Solo el Administrador Principal puede modificar el SEO'}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='metaTitle'>Título SEO</Label>
            <Input
              id='metaTitle'
              value={content.metaTitle}
              onChange={e => isSuperAdmin && setContent({ ...content, metaTitle: e.target.value })}
              disabled={!isSuperAdmin}
              placeholder='Gestión Operaciones - Soporte Multi-Área'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='metaDescription'>Descripción SEO</Label>
            <Textarea
              id='metaDescription'
              value={content.metaDescription}
              onChange={e =>
                isSuperAdmin && setContent({ ...content, metaDescription: e.target.value })
              }
              disabled={!isSuperAdmin}
              placeholder='Descripción para motores de búsqueda'
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Botón de guardar al final */}
      <div className='flex justify-end'>
        <Button onClick={saveContent} disabled={saving}>
          <Save className='h-4 w-4 mr-2' />
          {saving
            ? 'Guardando...'
            : hasUnsavedChanges
              ? 'Guardar Todos los Cambios *'
              : 'Guardar Todos los Cambios'}
        </Button>
      </div>
    </div>
  )
}
