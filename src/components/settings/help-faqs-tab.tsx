'use client'

/**
 * Configuración Sistema → Ayuda: administra las preguntas frecuentes que ve
 * cualquier usuario en /help/center (tabla `help_faqs`, ver
 * prisma/schema.prisma y src/features/help/filter-help-faqs.ts). El filtrado
 * por módulo activo del usuario y por rol sigue ocurriendo en el cliente tal
 * como antes — acá solo se administra el contenido: preguntas, respuestas,
 * a qué módulo pertenecen, para qué roles aplican y un adjunto opcional
 * (imagen o video vía URL, mismo componente que usa Noticias).
 *
 * Pestaña y endpoints (/api/admin/help-faqs*) restringidos a Super Admin,
 * igual que OAuth/Backups/Almacenamiento — el propio componente confía en
 * que el padre (admin/settings/page.tsx) ya bloqueó el acceso antes de
 * montarlo, no vuelve a chequear el rol acá.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MediaUrlInput } from '@/components/common/media-url-input'
import { useToast } from '@/hooks/use-toast'
import { HELP_MODULE_SECTIONS, type HelpModuleId } from '@/features/help/data/faq-by-module'

interface HelpFaqRow {
  id: string
  module: string
  category: string
  question: string
  answer: string
  mediaUrl: string | null
  roles: string[]
  keywords: string[]
  order: number
  isActive: boolean
}

const ROLE_OPTIONS: Array<{ value: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'; label: string }> = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'TECHNICIAN', label: 'Técnico' },
  { value: 'CLIENT', label: 'Cliente' },
]

type FormState = {
  module: HelpModuleId
  category: string
  question: string
  answer: string
  mediaUrl: string
  roles: string[]
  keywords: string
  order: string
  isActive: boolean
}

function emptyForm(defaultModule: HelpModuleId): FormState {
  return {
    module: defaultModule,
    category: HELP_MODULE_SECTIONS.find(s => s.id === defaultModule)?.title || '',
    question: '',
    answer: '',
    mediaUrl: '',
    roles: [],
    keywords: '',
    order: '0',
    isActive: true,
  }
}

function rowToForm(row: HelpFaqRow): FormState {
  return {
    module: row.module as HelpModuleId,
    category: row.category,
    question: row.question,
    answer: row.answer,
    mediaUrl: row.mediaUrl || '',
    roles: row.roles,
    keywords: row.keywords.join(', '),
    order: String(row.order),
    isActive: row.isActive,
  }
}

export function HelpFaqsTab() {
  const { toast } = useToast()
  const [faqs, setFaqs] = useState<HelpFaqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState<HelpModuleId | 'all'>('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm('account'))

  const [faqToDelete, setFaqToDelete] = useState<HelpFaqRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/help-faqs')
      const data = await res.json()
      if (data.success) setFaqs(data.data)
      else toast({ title: 'Error', description: data.message, variant: 'destructive' })
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return faqs
      .filter(f => moduleFilter === 'all' || f.module === moduleFilter)
      .filter(
        f => !q || f.question.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
      )
  }, [faqs, moduleFilter, search])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm(moduleFilter === 'all' ? 'account' : moduleFilter))
    setDialogOpen(true)
  }

  const openEdit = (row: HelpFaqRow) => {
    setEditingId(row.id)
    setForm(rowToForm(row))
    setDialogOpen(true)
  }

  const toggleRole = (role: string) => {
    setForm(current => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter(r => r !== role)
        : [...current.roles, role],
    }))
  }

  const save = async () => {
    if (!form.category.trim() || !form.question.trim() || !form.answer.trim()) {
      toast({
        title: 'Campos requeridos',
        description: 'Categoría, pregunta y respuesta son obligatorias',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const payload = {
        module: form.module,
        category: form.category.trim(),
        question: form.question.trim(),
        answer: form.answer.trim(),
        mediaUrl: form.mediaUrl.trim() || null,
        roles: form.roles,
        keywords: form.keywords
          .split(',')
          .map(k => k.trim())
          .filter(Boolean),
        order: Number(form.order) || 0,
        isActive: form.isActive,
      }
      const res = await fetch(
        editingId ? `/api/admin/help-faqs/${editingId}` : '/api/admin/help-faqs',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!data.success) {
        toast({ title: 'Error', description: data.message, variant: 'destructive' })
        return
      }
      toast({ title: editingId ? 'Pregunta actualizada' : 'Pregunta creada' })
      setDialogOpen(false)
      void load()
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: HelpFaqRow, isActive: boolean) => {
    setFaqs(current => current.map(f => (f.id === row.id ? { ...f, isActive } : f)))
    try {
      const res = await fetch(`/api/admin/help-faqs/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      // Reafirma el valor confirmado por el servidor — si mientras esta
      // petición estaba en curso un create/edit disparó load() y trajo de
      // vuelta el estado viejo de esta fila (la respuesta de load() puede
      // llegar antes de que este PUT termine), esto corrige el pisado en vez
      // de dejar el switch mostrando algo distinto a lo que ya quedó en BD.
      setFaqs(current => current.map(f => (f.id === row.id ? { ...f, isActive } : f)))
    } catch {
      setFaqs(current => current.map(f => (f.id === row.id ? { ...f, isActive: row.isActive } : f)))
      toast({ title: 'No se pudo cambiar el estado', variant: 'destructive' })
    }
  }

  const confirmDelete = async () => {
    if (!faqToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/help-faqs/${faqToDelete.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) {
        toast({ title: 'Error', description: data.message, variant: 'destructive' })
        return
      }
      toast({ title: 'Pregunta eliminada' })
      setFaqToDelete(null)
      void load()
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>Preguntas frecuentes del Centro de Ayuda</CardTitle>
          <CardDescription>
            Lo que ve cada usuario en Centro de Ayuda depende de los módulos activos en su cuenta —
            una pregunta de un módulo desactivado simplemente no aparece, sin que tengas que
            ocultarla acá. Usa el rol para restringir además por tipo de usuario (vacío = todos).
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col sm:flex-row gap-2'>
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder='Buscar por pregunta o categoría…'
                className='pl-9'
              />
            </div>
            <Select
              value={moduleFilter}
              onValueChange={v => setModuleFilter(v as typeof moduleFilter)}
            >
              <SelectTrigger className='sm:w-56'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los módulos</SelectItem>
                {HELP_MODULE_SECTIONS.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreate} className='shrink-0'>
              <Plus className='h-4 w-4 mr-2' />
              Nueva pregunta
            </Button>
          </div>

          {loading ? (
            <div className='flex items-center justify-center py-10 text-muted-foreground'>
              <Loader2 className='h-5 w-5 animate-spin mr-2' /> Cargando…
            </div>
          ) : filtered.length === 0 ? (
            <p className='text-sm text-muted-foreground py-6 text-center'>
              No hay preguntas con ese filtro.
            </p>
          ) : (
            <div className='space-y-2'>
              {filtered.map(row => (
                <div key={row.id} className='flex items-start gap-3 rounded-lg border p-3'>
                  <div className='flex-1 min-w-0 space-y-1'>
                    <div className='flex flex-wrap items-center gap-1.5'>
                      <Badge variant='outline' className='text-[10px]'>
                        {row.category}
                      </Badge>
                      {row.roles.length > 0 && (
                        <Badge variant='secondary' className='text-[10px]'>
                          {row.roles.join(', ')}
                        </Badge>
                      )}
                      {row.mediaUrl && (
                        <Badge variant='secondary' className='text-[10px]'>
                          Con adjunto
                        </Badge>
                      )}
                      {!row.isActive && (
                        <Badge variant='destructive' className='text-[10px]'>
                          Inactiva
                        </Badge>
                      )}
                    </div>
                    <p className='text-sm font-medium truncate'>{row.question}</p>
                    <p className='text-xs text-muted-foreground line-clamp-1'>{row.answer}</p>
                  </div>
                  <div className='flex items-center gap-1 shrink-0'>
                    <Switch
                      checked={row.isActive}
                      onCheckedChange={v => void toggleActive(row, v)}
                      aria-label='Activa'
                    />
                    <Button variant='ghost' size='sm' onClick={() => openEdit(row)}>
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-muted-foreground hover:text-destructive'
                      onClick={() => setFaqToDelete(row)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar pregunta' : 'Nueva pregunta'}</DialogTitle>
            <DialogDescription>
              Se muestra en Centro de Ayuda solo a usuarios con el módulo elegido activo.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Módulo</Label>
                <Select
                  value={form.module}
                  onValueChange={v => setForm(f => ({ ...f, module: v as HelpModuleId }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HELP_MODULE_SECTIONS.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Categoría (etiqueta visible)</Label>
                <Input
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label>Pregunta</Label>
              <Input
                value={form.question}
                onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                placeholder='¿Cómo...?'
              />
            </div>

            <div className='space-y-2'>
              <Label>Respuesta</Label>
              <Textarea
                value={form.answer}
                onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
                rows={5}
              />
            </div>

            <MediaUrlInput
              label='Imagen o video (captura de pantalla, YouTube, Google Drive…)'
              value={form.mediaUrl}
              onChange={v => setForm(f => ({ ...f, mediaUrl: v }))}
              placeholder='https://drive.google.com/... · YouTube · URL de imagen...'
            />

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Roles (vacío = todos)</Label>
                <div className='flex gap-4'>
                  {ROLE_OPTIONS.map(opt => (
                    <label key={opt.value} className='flex items-center gap-2 text-sm'>
                      <Checkbox
                        checked={form.roles.includes(opt.value)}
                        onCheckedChange={() => toggleRole(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className='space-y-2'>
                <Label>Orden</Label>
                <Input
                  type='number'
                  value={form.order}
                  onChange={e => setForm(f => ({ ...f, order: e.target.value }))}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label>Palabras clave (separadas por coma)</Label>
              <Input
                value={form.keywords}
                onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                placeholder='perfil, contraseña, notificaciones'
              />
            </div>

            <div className='flex items-center justify-between rounded-lg border p-3'>
              <Label className='text-sm font-normal'>Activa (visible en el Centro de Ayuda)</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!faqToDelete} onOpenChange={open => !open && setFaqToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta pregunta?</AlertDialogTitle>
            <AlertDialogDescription>
              {faqToDelete?.question} — esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className='bg-red-600 hover:bg-red-700'
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
