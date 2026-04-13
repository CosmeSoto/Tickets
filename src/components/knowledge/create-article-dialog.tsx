'use client'

import { useState, useEffect } from 'react'
import { useKnowledge } from '@/hooks/use-knowledge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface CreateArticleDialogProps {
  isOpen: boolean
  onClose: () => void
  ticketId: string
  ticketTitle: string
  ticketDescription: string
  categoryId: string
  onSuccess?: (articleId: string) => void
}

export function CreateArticleDialog({
  isOpen,
  onClose,
  ticketId,
  ticketTitle,
  ticketDescription,
  categoryId,
  onSuccess,
}: CreateArticleDialogProps) {
  const { createFromTicket, getTicketSuggestions, loading } = useKnowledge()
  
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  // Cargar sugerencias al abrir el diálogo
  useEffect(() => {
    if (isOpen && ticketId) {
      const loadSuggestions = async () => {
        const suggestions = await getTicketSuggestions(ticketId)
        if (suggestions) {
          setTitle(suggestions.suggestions.title || '')
          setContent(suggestions.suggestions.content || '')
          setTags(suggestions.suggestions.tags || [])
        }
      }
      loadSuggestions()
    }
  }, [isOpen, ticketId, getTicketSuggestions])

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase()
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 10) {
      setTags([...tags, trimmedTag])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleSubmit = async () => {
    // Validaciones
    if (title.length < 10) {
      toast.error('El título debe tener al menos 10 caracteres')
      return
    }

    if (content.length < 50) {
      toast.error('El contenido debe tener al menos 50 caracteres')
      return
    }

    if (tags.length === 0) {
      toast.error('Agrega al menos un tag')
      return
    }

    const article = await createFromTicket(ticketId, {
      title,
      content,
      summary: summary || undefined,
      tags,
    })

    if (article) {
      toast.success('Artículo creado exitosamente')
      onSuccess?.(article.id)
      handleClose()
    } else {
      toast.error('Error al crear artículo')
    }
  }

  const handleClose = () => {
    setTitle('')
    setSummary('')
    setContent('')
    setTags([])
    setTagInput('')
    setActiveTab('edit')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Crear Artículo de Conocimiento</DialogTitle>
          <DialogDescription>
            Documenta la solución de este ticket para ayudar a otros usuarios
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Solución: Error al imprimir documentos"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              {title.length}/200 caracteres (mínimo 10)
            </p>
          </div>

          {/* Resumen */}
          <div className="space-y-2">
            <Label htmlFor="summary">Resumen corto</Label>
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

          {/* Contenido con tabs */}
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
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {content.length} caracteres (mínimo 50). Soporta Markdown.
                </p>
              </TabsContent>
              
              <TabsContent value="preview">
                <div className="border rounded-lg p-4 min-h-[300px] prose prose-slate dark:prose-invert max-w-none">
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Artículo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
