'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Globe, Save, Eye } from 'lucide-react'
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
  footerText: string
  metaTitle: string
  metaDescription: string
}

export function LandingPageCMSTab() {
  const [content, setContent] = useState<LandingContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadContent()
  }, [])

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
          footerText: data.footerText || '',
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
        <CardContent className="py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando contenido...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!content) return null

  return (
    <div className="space-y-6">
      {/* Header con acciones */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Gestión de Página Pública</h3>
          <p className="text-sm text-muted-foreground">
            Personaliza el contenido de la página de inicio
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const previewUrl = `${window.location.origin}/?preview=true`
              window.open(previewUrl, '_blank', 'noopener,noreferrer')
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            Vista Previa
          </Button>
          <Button 
            size="sm" 
            onClick={saveContent} 
            disabled={saving}
            className={hasUnsavedChanges ? 'bg-orange-600 hover:bg-orange-700' : ''}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : hasUnsavedChanges ? 'Guardar Cambios *' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>

      {/* Sección Hero */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            Sección Hero
          </CardTitle>
          <CardDescription>
            Contenido principal de la página de inicio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="heroTitle">Título Principal</Label>
            <Input
              id="heroTitle"
              value={content.heroTitle}
              onChange={(e) => setContent({ ...content, heroTitle: e.target.value })}
              placeholder="Soporte Técnico Profesional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="heroSubtitle">Subtítulo</Label>
            <Textarea
              id="heroSubtitle"
              value={content.heroSubtitle}
              onChange={(e) => setContent({ ...content, heroSubtitle: e.target.value })}
              placeholder="Descripción breve de tus servicios"
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="heroCtaPrimary">Texto Botón Principal</Label>
                <Input
                  id="heroCtaPrimary"
                  value={content.heroCtaPrimary}
                  onChange={(e) => setContent({ ...content, heroCtaPrimary: e.target.value })}
                  placeholder="Crear Ticket de Soporte"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="heroCtaPrimaryUrl">Acción Botón Principal</Label>
                <Select
                  value={content.heroCtaPrimaryUrl}
                  onValueChange={(value) => setContent({ ...content, heroCtaPrimaryUrl: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="/login">Iniciar Sesión</SelectItem>
                    <SelectItem value="/register">Registrarse</SelectItem>
                    <SelectItem value="/client/tickets/create">Crear Ticket</SelectItem>
                    <SelectItem value="#servicios">Ver Servicios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="heroCtaSecondary">Texto Botón Secundario</Label>
                <Input
                  id="heroCtaSecondary"
                  value={content.heroCtaSecondary}
                  onChange={(e) => setContent({ ...content, heroCtaSecondary: e.target.value })}
                  placeholder="Ver Servicios"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="heroCtaSecondaryUrl">Acción Botón Secundario</Label>
                <Select
                  value={content.heroCtaSecondaryUrl}
                  onValueChange={(value) => setContent({ ...content, heroCtaSecondaryUrl: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="#servicios">Ver Servicios</SelectItem>
                    <SelectItem value="/login">Iniciar Sesión</SelectItem>
                    <SelectItem value="/register">Registrarse</SelectItem>
                    <SelectItem value="/client/tickets/create">Crear Ticket</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <ImageUploader
              label="Imagen de Fondo (Opcional)"
              currentUrl={content.heroImageUrl}
              onUpload={(url) => {
                console.log('🖼️ Hero image uploaded, updating state:', url)
                setContent({ ...content, heroImageUrl: url })
              }}
              type="hero-bg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sección Servicios */}
      <Card>
        <CardHeader>
          <CardTitle>Sección de Servicios</CardTitle>
          <CardDescription>
            Configura la sección de servicios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="servicesEnabled"
              checked={content.servicesEnabled}
              onCheckedChange={(checked) => setContent({ ...content, servicesEnabled: checked })}
            />
            <Label htmlFor="servicesEnabled">Mostrar sección de servicios</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="servicesTitle">Título de Servicios</Label>
            <Input
              id="servicesTitle"
              value={content.servicesTitle}
              onChange={(e) => setContent({ ...content, servicesTitle: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="servicesSubtitle">Subtítulo de Servicios</Label>
            <Input
              id="servicesSubtitle"
              value={content.servicesSubtitle}
              onChange={(e) => setContent({ ...content, servicesSubtitle: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Gestión de Servicios */}
      <LandingServicesManager />

      {/* Información de la Empresa */}
      <Card>
        <CardHeader>
          <CardTitle>Información de la Empresa</CardTitle>
          <CardDescription>
            Datos generales de tu empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Nombre de la Empresa</Label>
            <Input
              id="companyName"
              value={content.companyName}
              onChange={(e) => setContent({ ...content, companyName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyTagline">Eslogan</Label>
            <Input
              id="companyTagline"
              value={content.companyTagline}
              onChange={(e) => setContent({ ...content, companyTagline: e.target.value })}
            />
          </div>

          <div className="space-y-4">
            <ImageUploader
              label="Logo Tema Claro"
              currentUrl={content.companyLogoLightUrl}
              onUpload={(url) => {
                console.log('🎨 Logo claro uploaded, updating state:', url)
                setContent({ ...content, companyLogoLightUrl: url })
              }}
              type="logo-light"
            />
            
            <ImageUploader
              label="Logo Tema Oscuro"
              currentUrl={content.companyLogoDarkUrl}
              onUpload={(url) => {
                console.log('🌙 Logo oscuro uploaded, updating state:', url)
                setContent({ ...content, companyLogoDarkUrl: url })
              }}
              type="logo-dark"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="footerText">Texto del Footer</Label>
            <Input
              id="footerText"
              value={content.footerText}
              onChange={(e) => setContent({ ...content, footerText: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* SEO */}
      <Card>
        <CardHeader>
          <CardTitle>SEO y Metadatos</CardTitle>
          <CardDescription>
            Optimiza tu página para motores de búsqueda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metaTitle">Título SEO</Label>
            <Input
              id="metaTitle"
              value={content.metaTitle}
              onChange={(e) => setContent({ ...content, metaTitle: e.target.value })}
              placeholder="Sistema de Tickets - Soporte Técnico"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metaDescription">Descripción SEO</Label>
            <Textarea
              id="metaDescription"
              value={content.metaDescription}
              onChange={(e) => setContent({ ...content, metaDescription: e.target.value })}
              placeholder="Descripción para motores de búsqueda"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Botón de guardar al final */}
      <div className="flex justify-end">
        <Button 
          onClick={saveContent} 
          disabled={saving}
          className={hasUnsavedChanges ? 'bg-orange-600 hover:bg-orange-700' : ''}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Guardando...' : hasUnsavedChanges ? 'Guardar Todos los Cambios *' : 'Guardar Todos los Cambios'}
        </Button>
      </div>
    </div>
  )
}
