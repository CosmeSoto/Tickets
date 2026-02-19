# Contexto para Próxima Sesión

**Última Actualización:** 2026-02-06  
**Estado Actual:** Fase 2 Completada  
**Próximo Objetivo:** Fase 3 - Despublicación  

---

## 📍 Dónde Estamos

### Fases Completadas
1. ✅ **Fase 1:** Corrección de toast duplicado
   - Bandera `hasCheckedExisting` implementada
   - Toast se muestra una sola vez

2. ✅ **Fase 2:** Botón inteligente (RECIÉN COMPLETADA)
   - API incluye `knowledge_article` en GET ticket
   - Botón "Crear Artículo" o "Ver Artículo" según contexto
   - Badge "Borrador" si no está publicado
   - Implementado en páginas de técnico y admin
   - 12/12 verificaciones pasadas
   - 0 errores TypeScript

### Fases Pendientes
- ⏳ **Fase 3:** Despublicación (SIGUIENTE)
- ⏳ **Fase 4:** Archivado
- ⏳ **Fase 5:** Eliminación

---

## 🎯 Próximo Objetivo: Fase 3 - Despublicación

### Qué Implementar

#### 1. Menú de Acciones en Artículos
Crear componente `src/components/knowledge/article-actions-menu.tsx` con:
- Editar (autor/admin)
- Despublicar/Publicar (autor/admin)
- Archivar (autor/admin)
- Eliminar (solo admin)

#### 2. Toggle isPublished
Actualizar API PATCH `/api/knowledge/[id]` para:
- Cambiar `isPublished` entre true/false
- Registrar en auditoría
- Validar permisos (solo autor o admin)

#### 3. Confirmaciones
Agregar diálogos de confirmación para:
- Despublicar: "¿Despublicar artículo? No será visible en búsquedas"
- Publicar: "¿Publicar artículo? Será visible para todos"

#### 4. Auditoría
Registrar en sistema de auditoría:
- Quién despublicó/publicó
- Cuándo
- Razón (opcional)

---

## 📁 Archivos Clave

### Para Leer Antes de Empezar Fase 3
1. `MEJORAS_GESTION_ARTICULOS_TICKETS.md`
   - Plan completo de 5 fases
   - Código de ejemplo para Fase 3
   - Mejores prácticas de ServiceNow/Zendesk

2. `FASE_2_BOTON_INTELIGENTE_COMPLETADA.md`
   - Qué se hizo en Fase 2
   - Cómo funciona el botón inteligente
   - Verificaciones pasadas

3. `prisma/schema.prisma`
   - Modelo `knowledge_articles`
   - Campo `isPublished` ya existe
   - Relaciones con tickets

### Para Modificar en Fase 3
1. `src/app/api/knowledge/[id]/route.ts`
   - Agregar lógica de toggle isPublished
   - Validar permisos
   - Registrar auditoría

2. `src/app/technician/knowledge/[id]/page.tsx`
   - Agregar menú de acciones
   - Mostrar solo si es autor

3. `src/app/admin/knowledge/[id]/page.tsx`
   - Agregar menú de acciones
   - Admin puede todo

4. `src/components/knowledge/article-actions-menu.tsx` (NUEVO)
   - Componente reutilizable
   - Dropdown con acciones
   - Confirmaciones integradas

---

## 🔧 Código de Referencia para Fase 3

### Menú de Acciones (Ejemplo)
```typescript
// src/components/knowledge/article-actions-menu.tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Edit, EyeOff, Eye, Archive, Trash2 } from 'lucide-react'

export function ArticleActionsMenu({ article, canEdit, isAdmin, onAction }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <MoreVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {canEdit && (
          <>
            <DropdownMenuItem onClick={() => onAction('edit')}>
              <Edit /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('toggle-publish')}>
              {article.isPublished ? (
                <><EyeOff /> Despublicar</>
              ) : (
                <><Eye /> Publicar</>
              )}
            </DropdownMenuItem>
          </>
        )}
        {isAdmin && (
          <DropdownMenuItem onClick={() => onAction('delete')}>
            <Trash2 /> Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### API Toggle isPublished (Ejemplo)
```typescript
// src/app/api/knowledge/[id]/route.ts - PATCH
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  const { isPublished } = await request.json()
  const article = await prisma.knowledge_articles.findUnique({ where: { id: params.id } })
  
  // Validar permisos
  if (session.user.id !== article.authorId && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  
  // Actualizar
  const updated = await prisma.knowledge_articles.update({
    where: { id: params.id },
    data: { isPublished, updatedAt: new Date() }
  })
  
  // Auditoría
  await auditArticleChange(params.id, session.user.id, 'publish_toggled', {
    oldValue: article.isPublished,
    newValue: isPublished
  })
  
  return NextResponse.json({ success: true, data: updated })
}
```

---

## 🧪 Plan de Testing para Fase 3

### Test 1: Despublicar Artículo
```
1. Login como autor del artículo
2. Abrir artículo publicado
3. Menú acciones → "Despublicar"
4. Confirmar
5. Verificar que isPublished = false
6. Verificar que no aparece en búsquedas públicas
7. Verificar auditoría registrada
```

### Test 2: Publicar Artículo
```
1. Login como autor del artículo
2. Abrir artículo borrador
3. Menú acciones → "Publicar"
4. Confirmar
5. Verificar que isPublished = true
6. Verificar que aparece en búsquedas
7. Verificar auditoría registrada
```

### Test 3: Permisos
```
1. Login como técnico B
2. Abrir artículo de técnico A
3. Verificar que NO aparece menú de acciones
4. Login como admin
5. Verificar que SÍ aparece menú de acciones
```

---

## 📊 Estado de la Base de Datos

### Modelo knowledge_articles (Actual)
```prisma
model knowledge_articles {
  id              String    @id
  title           String
  content         String
  summary         String?
  isPublished     Boolean   @default(true)  // ✅ Ya existe
  categoryId      String
  authorId        String
  sourceTicketId  String?   @unique
  tags            String[]
  viewCount       Int       @default(0)
  helpfulCount    Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime
  
  // Relaciones
  category        categories  @relation(...)
  author          users       @relation(...)
  sourceTicket    tickets?    @relation(...)
  votes           article_votes[]
}
```

### Campos Necesarios para Fase 4 (Archivado)
```prisma
// AGREGAR EN FASE 4:
isArchived      Boolean   @default(false)
archivedAt      DateTime?
archivedBy      String?
```

### Campos Necesarios para Fase 5 (Eliminación)
```prisma
// AGREGAR EN FASE 5:
deletedAt       DateTime?
deletedBy       String?
```

---

## 🔒 Reglas de Negocio

### Permisos de Despublicación
- ✅ **Autor:** Puede despublicar sus propios artículos
- ✅ **Admin:** Puede despublicar cualquier artículo
- ❌ **Otros:** No pueden despublicar

### Efectos de Despublicar
- ❌ No aparece en búsquedas públicas
- ❌ No aparece en listados de base de conocimientos
- ✅ Autor/Admin pueden verlo (con badge "Borrador")
- ✅ Puede volver a publicarse
- ✅ Mantiene vínculo con ticket origen

### Auditoría Requerida
- Quién despublicó/publicó
- Cuándo (timestamp)
- Estado anterior y nuevo
- Razón (opcional, para futuro)

---

## 💡 Consideraciones Importantes

### UX
1. **Confirmación clara:** Usuario debe entender qué pasará
2. **Feedback inmediato:** Toast de éxito/error
3. **Estado visible:** Badge "Borrador" o "Publicado"
4. **Reversible:** Puede volver a publicar

### Seguridad
1. **Validar permisos:** Backend debe verificar autor/admin
2. **No confiar en frontend:** Validación en API
3. **Auditoría completa:** Registrar todas las acciones

### Performance
1. **Optimistic updates:** Actualizar UI antes de respuesta
2. **Cache invalidation:** Revalidar listados después de cambio
3. **Índices:** Asegurar que `isPublished` esté indexado

---

## 📚 Documentos de Referencia

### Documentación Técnica
- `IMPLEMENTACION_BOTON_INTELIGENTE_ARTICULOS.md` - Fase 2 completa
- `MEJORAS_GESTION_ARTICULOS_TICKETS.md` - Plan maestro
- `MEJORAS_AUDITORIA_Y_CONTENIDO_ARTICULOS.md` - Sistema de auditoría

### Scripts de Verificación
- `verificar-boton-inteligente.sh` - Ejemplo de script de verificación
- Crear `verificar-despublicacion.sh` para Fase 3

### Resúmenes
- `RESUMEN_IMPLEMENTACION_FASE_2.md` - Qué se hizo
- `FASE_2_BOTON_INTELIGENTE_COMPLETADA.md` - Estado final

---

## 🚀 Cómo Empezar Fase 3

### Paso 1: Leer Documentación
```bash
# Leer plan completo
cat MEJORAS_GESTION_ARTICULOS_TICKETS.md

# Leer estado actual
cat FASE_2_BOTON_INTELIGENTE_COMPLETADA.md
```

### Paso 2: Crear Componente
```bash
# Crear menú de acciones
touch src/components/knowledge/article-actions-menu.tsx
```

### Paso 3: Actualizar API
```bash
# Modificar API PATCH
code src/app/api/knowledge/[id]/route.ts
```

### Paso 4: Actualizar Páginas
```bash
# Agregar menú a páginas de detalle
code src/app/technician/knowledge/[id]/page.tsx
code src/app/admin/knowledge/[id]/page.tsx
```

### Paso 5: Testing
```bash
# Crear script de verificación
touch verificar-despublicacion.sh
chmod +x verificar-despublicacion.sh
```

---

## 🎯 Criterios de Éxito para Fase 3

### Funcionalidad
- ✅ Menú de acciones visible para autor/admin
- ✅ Toggle isPublished funciona
- ✅ Confirmación antes de cambiar estado
- ✅ Auditoría registrada correctamente

### UX
- ✅ Feedback claro (toast)
- ✅ Badge de estado actualizado
- ✅ Artículo desaparece/aparece de búsquedas

### Seguridad
- ✅ Permisos validados en backend
- ✅ Solo autor/admin pueden despublicar
- ✅ Auditoría completa

### Calidad
- ✅ 0 errores TypeScript
- ✅ Script de verificación pasa
- ✅ Documentación completa

---

## 📞 Preguntas Frecuentes

### ¿Qué pasa con el ticket cuando se despublica el artículo?
- El ticket mantiene el vínculo con el artículo
- El botón "Ver Artículo" sigue apareciendo
- El badge "Borrador" se muestra
- Solo autor/admin pueden ver el artículo

### ¿Se puede volver a publicar?
- Sí, es completamente reversible
- Mismo menú de acciones → "Publicar"
- Se registra en auditoría

### ¿Qué diferencia hay entre despublicar y archivar?
- **Despublicar:** Temporal, fácilmente reversible
- **Archivar:** Más permanente, va a sección separada
- Archivar se implementará en Fase 4

---

**Preparado por:** Kiro AI  
**Fecha:** 2026-02-06  
**Para:** Próxima sesión de desarrollo  
**Objetivo:** Implementar Fase 3 - Despublicación

