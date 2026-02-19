# TAREA 4: Integración Base de Conocimientos con Tickets

## Objetivo
Integrar el sistema de conocimientos con el flujo de tickets para técnicos y clientes.

## Modificaciones en Páginas de Tickets

### 1. `/src/app/technician/tickets/[id]/page.tsx`
**Mejoras a Implementar:**

#### A. Panel de Soluciones Similares
```typescript
// Agregar componente
<SimilarArticlesPanel
  title={ticket.title}
  description={ticket.description}
  categoryId={ticket.categoryId}
  maxResults={5}
/>
```

**Ubicación:** Panel lateral derecho o sección colapsable

**Comportamiento:**
- Busca automáticamente al cargar ticket
- Actualiza si cambia categoría
- Muestra relevancia de cada artículo
- Click abre artículo en modal o nueva pestaña

#### B. Botón Resolver Mejorado
```typescript
// Reemplazar botón simple por:
<ResolveTicketDialog
  ticketId={ticket.id}
  ticketData={ticket}
  onSuccess={() => {
    // Recargar ticket
    // Mostrar mensaje de éxito
    // Opcional: Redirigir a lista
  }}
/>
```

**Opciones en el Dialog:**
1. Comentario de resolución (obligatorio)
2. Tiempo invertido (opcional)
3. ✨ Checkbox: "Crear artículo de conocimiento"
4. Si checkbox activo:
   - Título (pre-llenado)
   - Resumen
   - Tags sugeridos
   - Vista previa

#### C. Badge de Artículo Existente
```typescript
// Si ticket tiene artículo asociado
{ticket.knowledge_article && (
  <Badge variant="success" className="gap-1">
    <BookOpen className="h-3 w-3" />
    Tiene artículo de conocimiento
  </Badge>
)}
```

### 2. `/src/app/client/tickets/create/page.tsx`
**Mejoras a Implementar:**

#### A. Búsqueda Preventiva
```typescript
// Después de ingresar título y descripción
<KnowledgeSearchSuggestions
  title={formData.title}
  description={formData.description}
  categoryId={formData.categoryId}
  onArticleClick={(article) => {
    // Abrir artículo en modal
    // Preguntar: "¿Esto resuelve tu problema?"
  }}
/>
```

**Flujo:**
1. Cliente escribe título (debounce 500ms)
2. Sistema busca artículos similares
3. Muestra sugerencias: "¿Es alguno de estos tu problema?"
4. Si cliente encuentra solución → No crea ticket
5. Si no encuentra → Continúa creando ticket

#### B. Mensaje Informativo
```typescript
<Alert className="mb-4">
  <Info className="h-4 w-4" />
  <AlertTitle>Antes de crear un ticket</AlertTitle>
  <AlertDescription>
    Busca en nuestra base de conocimientos. Tal vez tu problema ya tiene solución.
    <Button variant="link" onClick={() => router.push('/knowledge')}>
      Ir a Base de Conocimientos
    </Button>
  </AlertDescription>
</Alert>
```

### 3. `/src/app/client/tickets/[id]/page.tsx`
**Mejoras a Implementar:**

#### A. Ver Artículo si Existe
```typescript
// Si ticket está RESOLVED y tiene artículo
{ticket.status === 'RESOLVED' && ticket.knowledge_article && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <BookOpen className="h-5 w-5" />
        Solución Documentada
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground mb-4">
        Este problema fue documentado para ayudar a otros usuarios.
      </p>
      <Button onClick={() => router.push(`/knowledge/${ticket.knowledge_article.id}`)}>
        Ver Solución Completa
      </Button>
    </CardContent>
  </Card>
)}
```

#### B. Calificación de Solución
```typescript
// Si ticket está RESOLVED
{ticket.status === 'RESOLVED' && !ticket.rating && (
  <RateTicketDialog
    ticketId={ticket.id}
    onSuccess={() => {
      // Recargar ticket
      toast({ title: 'Gracias por tu calificación' })
    }}
  />
)}
```

#### C. Mensaje de Nuevo Ticket
```typescript
// Si ticket está CLOSED
{ticket.status === 'CLOSED' && (
  <Alert>
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Ticket Cerrado</AlertTitle>
    <AlertDescription>
      Si el problema vuelve a ocurrir, por favor crea un nuevo ticket.
      <Button variant="link" onClick={() => router.push('/client/tickets/create')}>
        Crear Nuevo Ticket
      </Button>
    </AlertDescription>
  </Alert>
)}
```

## Modificaciones en Componentes

### 1. `/src/components/tickets/ticket-columns.tsx`
**Para todas las vistas (admin, technician, client):**

```typescript
// Agregar columna de artículo
{
  accessorKey: 'hasArticle',
  header: 'Conocimiento',
  cell: ({ row }) => {
    const ticket = row.original
    return ticket.knowledge_article ? (
      <Badge variant="outline" className="gap-1">
        <BookOpen className="h-3 w-3" />
        Documentado
      </Badge>
    ) : null
  }
}
```

### 2. `/src/components/tickets/ticket-stats-card.tsx`
**Agregar estadística:**

```typescript
// Nueva métrica
<StatCard
  title="Con Documentación"
  value={stats.withArticles}
  icon={BookOpen}
  description="Tickets documentados"
/>
```

## Nuevos Componentes a Crear

### 1. `/src/components/knowledge/knowledge-search-suggestions.tsx`
**Propósito:** Sugerencias automáticas al crear ticket

```typescript
interface KnowledgeSearchSuggestionsProps {
  title: string
  description: string
  categoryId?: string
  onArticleClick: (article: Article) => void
}
```

**Comportamiento:**
- Búsqueda automática con debounce
- Muestra top 3 artículos más relevantes
- Diseño compacto y no intrusivo
- Opción "Ver más resultados"

### 2. `/src/components/tickets/rate-ticket-dialog.tsx`
**Propósito:** Calificar solución del ticket

```typescript
interface RateTicketDialogProps {
  ticketId: string
  onSuccess?: () => void
}
```

**Campos:**
- Calificación general (1-5 estrellas)
- Tiempo de respuesta (1-5)
- Habilidad técnica (1-5)
- Comunicación (1-5)
- Resolución del problema (1-5)
- Comentarios (opcional)

### 3. `/src/components/knowledge/article-preview-modal.tsx`
**Propósito:** Vista rápida de artículo sin salir de página

```typescript
interface ArticlePreviewModalProps {
  articleId: string
  isOpen: boolean
  onClose: () => void
  onCreateTicket?: () => void
}
```

**Contenido:**
- Título y resumen
- Contenido completo
- Botones:
  - "Esto resolvió mi problema" (cierra modal)
  - "No resuelve, crear ticket" (va a crear ticket)
  - "Ver artículo completo" (abre página completa)

## Flujos Completos

### Flujo Técnico: Resolver Ticket
```
1. Técnico abre ticket asignado
2. Ve panel "Soluciones Similares" →
   - Si encuentra solución similar, la aplica
   - Si no, investiga y resuelve
3. Click en "Resolver Ticket"
4. Dialog aparece con:
   - Comentario de resolución
   - Checkbox "Crear artículo"
5. Si marca checkbox:
   - Formulario de artículo se expande
   - Pre-llena título y categoría
   - Técnico escribe solución
6. Click "Resolver y Crear Artículo"
7. Sistema:
   - Marca ticket como RESOLVED
   - Crea artículo de conocimiento
   - Asocia artículo con ticket
   - Notifica al cliente
```

### Flujo Cliente: Crear Ticket
```
1. Cliente va a "Crear Ticket"
2. Ve mensaje: "Busca primero en conocimientos"
3. Escribe título y descripción
4. Sistema muestra sugerencias automáticas
5. Cliente revisa sugerencias:
   - Si encuentra solución → No crea ticket
   - Si no encuentra → Continúa
6. Completa formulario y crea ticket
7. Técnico resuelve y crea artículo
8. Cliente ve ticket RESOLVED
9. Cliente puede:
   - Ver artículo asociado
   - Calificar solución
   - Cerrar ticket
```

### Flujo Cliente: Problema Recurrente
```
1. Cliente tiene problema similar
2. Busca en base de conocimientos
3. Encuentra artículo del problema anterior
4. Lee solución
5. Opciones:
   - Vota "Útil" → Problema resuelto
   - Vota "No útil" → Crea nuevo ticket
```

## Métricas y Estadísticas

### Para Dashboards:
```typescript
// Nuevas métricas a agregar
interface KnowledgeStats {
  totalArticles: number
  articlesThisMonth: number
  avgHelpfulRate: number
  topArticles: Article[]
  ticketsPreventedByKnowledge: number // Estimado
}
```

### Para Técnicos:
- Artículos creados
- Artículos más útiles
- Tickets resueltos con artículo

### Para Admins:
- Tasa de adopción de conocimientos
- Artículos más vistos
- Categorías con más artículos
- Reducción de tickets por conocimientos

## Validación
- ✅ Sugerencias aparecen al crear ticket
- ✅ Panel de similares funciona en vista de ticket
- ✅ Resolver ticket permite crear artículo
- ✅ Artículo se asocia correctamente con ticket
- ✅ Cliente puede ver artículo de su ticket resuelto
- ✅ Calificación de tickets funciona
- ✅ Badges de artículos aparecen en listados
- ✅ Estadísticas se actualizan correctamente

## Siguiente Tarea
TAREA 5: Testing y Refinamiento Final
