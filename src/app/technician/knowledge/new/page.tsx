'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useKnowledge } from '@/hooks/use-knowledge'
import { useCategoriesData } from '@/hooks/use-categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Save, X, Plus, Loader2, BookOpen, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Alert, AlertDescription } from '@/components/ui/alert'

function NewArticleContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { createFromTicket, getTicketSuggestions, loading } = useKnowledge()
  const { categories, loadCategories } = useCategoriesData()

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isPublished, setIsPublished] = useState(true)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [isSaving, setIsSaving] = useState(false)
  const [sourceTicketId, setSourceTicketId] = useState<string | null>(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [hasCheckedExisting, setHasCheckedExisting] = useState(false)

  // Cargar categorías al montar el componente
  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // Cargar datos del ticket si viene desde un ticket
  useEffect(() => {
    const fromTicket = searchParams.get('fromTicket')
    
    if (fromTicket && !hasCheckedExisting) {
      setSourceTicketId(fromTicket)
      setHasCheckedExisting(true)
      loadTicketSuggestions(fromTicket)
    }
  }, [searchParams, hasCheckedExisting])

  const loadTicketSuggestions = async (ticketId: string) => {
    setLoadingSuggestions(true)
    
    try {
      const data = await getTicketSuggestions(ticketId)
      
      if (data) {
        // Verificar si ya existe un artículo
        if (data.existingArticle) {
          toast.warning(
            `Ya existe un artículo creado desde este ticket: "${data.existingArticle.title}"`,
            {
              duration: 5000,
              action: {
                label: 'Ver artículo',
                onClick: () => router.push(`/technician/knowledge/${data.existingArticle.id}`)
              }
            }
          )
          // Redirigir automáticamente después de 3 segundos
          setTimeout(() => {
            router.push(`/technician/knowledge/${data.existingArticle.id}`)
          }, 3000)
          return
        }
        
        // Pre-llenar formulario con sugerencias
        setTitle(data.suggestions.title)
        setContent(data.suggestions.content)
        setCategoryId(data.ticket.category?.id || '')
        setTags(data.suggestions.tags)
        
        // Generar resumen automático
        const autoSummary = data.ticket.description.substring(0, 200)
        setSummary(autoSummary)
        
        toast.success('Información del ticket cargada automáticamente')
      }
    } catch (error) {
      toast.error('Error al cargar información del ticket')
      console.error(error)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN') {
      toast.error('No tienes permisos para crear artículos')
      router.push('/knowledge')
    }
  }, [session, router])

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase()
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 10) {
      setTags([...tags, trimmedTag])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSubmit = async () => {
    if (title.length < 10) {
      toast.error('El título debe tener al menos 10 caracteres')
      return
    }

    if (content.length < 50) {
      toast.error('El contenido debe tener al menos 50 caracteres')
      return
    }

    if (!categoryId) {
      toast.error('Selecciona una categoría')
      return
    }

    if (tags.length === 0) {
      toast.error('Agrega al menos un tag')
      return
    }

    setIsSaving(true)
    
    let article
    
    // Si viene desde un ticket, usar API específica
    if (sourceTicketId) {
      article = await createFromTicket(sourceTicketId, {
        title,
        summary: summary || undefined,
        content,
        tags,
      })
    } else {
      toast.error('Los artículos solo pueden crearse desde tickets resueltos')
      setIsSaving(false)
      return
    }

    setIsSaving(false)

    if (article) {
      toast.success('Artículo creado exitosamente desde el ticket')
      router.push(`/technician/knowledge/${article.id}`)
    } else {
      toast.error('Error al crear artículo')
    }
  }

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN')) {
    return null
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Nuevo Artículo
          </h1>
          <p className="text-muted-foreground mt-2">
            {sourceTicketId 
              ? 'Crear artículo desde ticket resuelto' 
              : 'Crea un nuevo artículo para la base de conocimiento'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => router.push('/technician/knowledge')}
            disabled={isSaving || loadingSuggestions}
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Cancelar</span>
          </Button>

          <Button 
            onClick={handleSubmit} 
            disabled={isSaving || loading || loadingSuggestions || !sourceTicketId} 
            size="sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                <span className="hidden sm:inline">Creando...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Crear Artículo</span>
                <span className="sm:hidden">Crear</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Alerta si no viene desde ticket */}
      {!sourceTicketId && !loadingSuggestions && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Los artículos solo pueden crearse desde tickets resueltos. 
            Ve a un ticket resuelto y haz clic en "Crear Artículo".
          </AlertDescription>
        </Alert>
      )}

      {/* Loading sugerencias */}
      {loadingSuggestions && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Cargando información del ticket...
          </AlertDescription>
        </Alert>
      )}

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Artículo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Cómo solucionar problemas de conexión"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              {title.length}/200 caracteres (mínimo 10)
            </p>
          </div>

          {/* Resumen */}
          <div className="space-y-2">
            <Label htmlFor="summary">Resumen</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Breve descripción del artículo (opcional)"
              rows={2}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">
              {summary.length}/300 caracteres
            </p>
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label htmlFor="category">
              Categoría <span className="text-red-500">*</span>
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contenido */}
          <div className="space-y-2">
            <Label>
              Contenido <span className="text-red-500">*</span>
            </Label>
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit">Editar</TabsTrigger>
                <TabsTrigger value="preview">Vista Previa</TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-2">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escribe el contenido en Markdown..."
                  rows={16}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {content.length} caracteres (mínimo 50). Soporta Markdown.
                </p>
              </TabsContent>

              <TabsContent value="preview">
                <div className="border rounded-lg p-6 min-h-[400px] prose prose-slate dark:prose-invert max-w-none">
                  {content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground">
                      Escribe contenido para ver la vista previa
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">
              Tags <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                placeholder="Escribe un tag y presiona Enter"
                maxLength={30}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 10}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {tags.length}/10 tags. Presiona Enter para agregar.
            </p>
          </div>

          {/* Publicar */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="publish">Publicar artículo</Label>
              <p className="text-sm text-muted-foreground">
                El artículo será visible para todos los usuarios
              </p>
            </div>
            <Switch
              id="publish"
              checked={isPublished}
              onCheckedChange={setIsPublished}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function NewArticlePage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    }>
      <NewArticleContent />
    </Suspense>
  )
}
