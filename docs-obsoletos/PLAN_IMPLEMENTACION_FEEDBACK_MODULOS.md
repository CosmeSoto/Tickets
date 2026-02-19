# 📋 Plan de Implementación: Sistema de Feedback en Todos los Módulos

**Fecha:** 2026-02-06  
**Estado:** 📝 PLAN MAESTRO  
**Prioridad:** 🔴 CRÍTICA  

---

## 🎯 Objetivo

Replicar el sistema de feedback profesional (tooltips, toast descriptivos, confirmaciones) implementado en el Plan de Resolución a **TODOS** los módulos del sistema.

---

## 📚 Documentos de Referencia

1. **`GUIA_FEEDBACK_SISTEMA_COMPLETO.md`** - Guía oficial con patrones y ejemplos
2. **`MEJORAS_FEEDBACK_APLICADAS.md`** - Mejoras ya implementadas
3. **`MEJORA_TIEMPO_HORAS_MINUTOS.md`** - Manejo de tiempo mejorado

---

## ✅ Módulos Completados

### 1. Plan de Resolución ✅
- Tooltips en todos los elementos
- Toast descriptivos con nombres específicos
- Confirmaciones con contexto
- Menú dropdown con descripciones
- Manejo de tiempo en horas y minutos

---

## 🔄 Módulos Pendientes (Prioridad ALTA)

### 2. Tickets 🔴 URGENTE

#### Ubicaciones:
- `src/app/technician/tickets/[id]/page.tsx`
- `src/app/admin/tickets/[id]/page.tsx`
- `src/app/client/tickets/[id]/page.tsx`

#### Elementos a Mejorar:

**A. Botones de Estado**
```typescript
// ANTES
<Button onClick={() => updateStatus('IN_PROGRESS')}>
  En Progreso
</Button>

// DESPUÉS
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button onClick={() => updateStatus('IN_PROGRESS')}>
        <PlayCircle className="h-4 w-4 mr-2" />
        En Progreso
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Marca este ticket como en progreso y comienza a trabajar en él</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**B. Botón de Asignación**
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button onClick={() => setShowAssignDialog(true)}>
      <User className="h-4 w-4 mr-2" />
      Asignar Técnico
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Asigna este ticket a un técnico disponible para su resolución</p>
  </TooltipContent>
</Tooltip>
```

**C. Cambio de Prioridad**
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button onClick={() => changePriority('HIGH')}>
      <AlertTriangle className="h-4 w-4 mr-2" />
      Alta Prioridad
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Marca este ticket como alta prioridad para atención urgente</p>
  </TooltipContent>
</Tooltip>
```

**D. Toast Mejorados**
```typescript
// Asignación
const technicianName = technician.name
const ticketTitle = ticket.title
toast({
  title: "Ticket asignado exitosamente",
  description: `"${ticketTitle}" ha sido asignado a ${technicianName}`,
  duration: 4000
})

// Cambio de estado
toast({
  title: "Estado actualizado",
  description: `"${ticketTitle}" está ahora en progreso`,
  duration: 4000
})

// Cambio de prioridad
toast({
  title: "Prioridad actualizada",
  description: `"${ticketTitle}" ahora tiene prioridad alta`,
  duration: 4000
})
```

---

### 3. Base de Conocimientos 🟡 ALTA

#### Ubicaciones:
- `src/app/technician/knowledge/[id]/page.tsx`
- `src/app/admin/knowledge/[id]/page.tsx`
- `src/app/knowledge/[id]/page.tsx`

#### Elementos a Mejorar:

**A. Botón Publicar/Despublicar**
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button onClick={handleTogglePublish}>
      <Eye className="h-4 w-4 mr-2" />
      {isPublished ? 'Despublicar' : 'Publicar'}
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>
      {isPublished 
        ? 'Oculta este artículo de la base de conocimientos pública' 
        : 'Publica este artículo para que sea visible a todos los usuarios'}
    </p>
  </TooltipContent>
</Tooltip>
```

**B. Botón Eliminar**
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
      <Trash2 className="h-4 w-4 mr-2" />
      Eliminar
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Elimina permanentemente este artículo de la base de conocimientos</p>
  </TooltipContent>
</Tooltip>
```

**C. Botones de Votación**
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button onClick={() => vote(true)}>
      <ThumbsUp className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Este artículo me fue útil</p>
  </TooltipContent>
</Tooltip>

<Tooltip>
  <TooltipTrigger asChild>
    <Button onClick={() => vote(false)}>
      <ThumbsDown className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Este artículo no me fue útil</p>
  </TooltipContent>
</Tooltip>
```

**D. Toast Mejorados**
```typescript
// Publicar
const articleTitle = article.title
toast({
  title: "Artículo publicado exitosamente",
  description: `"${articleTitle}" está ahora visible para todos los usuarios`,
  duration: 4000
})

// Eliminar
toast({
  title: "Artículo eliminado",
  description: `"${articleTitle}" ha sido eliminado permanentemente de la base de conocimientos`,
  duration: 4000
})

// Votar
toast({
  title: "Gracias por tu feedback",
  description: "Tu voto nos ayuda a mejorar la calidad de nuestros artículos",
  duration: 3000
})
```

---

### 4. Usuarios 🟡 ALTA

#### Ubicaciones:
- `src/app/admin/users/page.tsx`
- `src/app/admin/users/[id]/page.tsx`

#### Elementos a Mejorar:

**A. Botón Crear Usuario**
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button onClick={() => setShowCreateDialog(true)}>
      <UserPlus className="h-4 w-4 mr-2" />
      Crear Usuario
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Crea un nuevo usuario en el sistema</p>
  </TooltipContent>
</Tooltip>
```

**B. Botón Cambiar Rol**
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button onClick={() => changeRole(userId, 'TECHNICIAN')}>
      <Shield className="h-4 w-4 mr-2" />
      Cambiar Rol
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Cambia el rol y permisos de este usuario</p>
  </TooltipContent>
</Tooltip>
```

**C. Botón Activar/Desactivar**
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button onClick={() => toggleActive(userId)}>
      {isActive ? <UserX /> : <UserCheck />}
      {isActive ? 'Desactivar' : 'Activar'}
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>
      {isActive 
        ? 'Desactiva este usuario (no podrá iniciar sesión)' 
        : 'Activa este usuario para que pueda iniciar sesión'}
    </p>
  </TooltipContent>
</Tooltip>
```

**D. Toast Mejorados**
```typescript
// Crear
const userName = user.name
toast({
  title: "Usuario creado exitosamente",
  description: `${userName} ha sido agregado al sistema con rol ${user.role}`,
  duration: 4000
})

// Cambiar rol
toast({
  title: "Rol actualizado",
  description: `${userName} ahora tiene el rol de ${newRole}`,
  duration: 4000
})

// Eliminar
toast({
  title: "Usuario eliminado",
  description: `${userName} ha sido eliminado del sistema`,
  duration: 4000
})
```

---

### 5. Categorías 🟢 MEDIA

#### Ubicaciones:
- `src/app/admin/categories/page.tsx`
- `src/app/technician/categories/page.tsx`

#### Elementos a Mejorar:

**A. Botones de Árbol**
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button onClick={() => expandNode(nodeId)}>
      <ChevronRight className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Expandir para ver subcategorías</p>
  </TooltipContent>
</Tooltip>
```

**B. Botón Crear Subcategoría**
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button onClick={() => createSubcategory(parentId)}>
      <FolderPlus className="h-4 w-4 mr-2" />
      Nueva Subcategoría
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Crea una subcategoría dentro de esta categoría</p>
  </TooltipContent>
</Tooltip>
```

**C. Toast Mejorados**
```typescript
const categoryName = category.name
toast({
  title: "Categoría creada exitosamente",
  description: `"${categoryName}" ha sido agregada al árbol de categorías`,
  duration: 4000
})
```

---

### 6. Departamentos 🟢 MEDIA

#### Ubicaciones:
- `src/app/admin/departments/page.tsx`

#### Elementos a Mejorar:

**A. Botón Asignar Técnicos**
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button onClick={() => setShowAssignDialog(true)}>
      <Users className="h-4 w-4 mr-2" />
      Asignar Técnicos
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Asigna técnicos a este departamento</p>
  </TooltipContent>
</Tooltip>
```

**B. Toast Mejorados**
```typescript
const deptName = department.name
const techCount = technicians.length
toast({
  title: "Técnicos asignados exitosamente",
  description: `${techCount} técnico(s) han sido asignados a ${deptName}`,
  duration: 4000
})
```

---

## 📋 Checklist por Módulo

Para cada módulo, verificar:

### Tooltips
- [ ] Todos los botones tienen tooltip
- [ ] Todos los iconos clickeables tienen tooltip
- [ ] Todos los badges tienen tooltip (si aplica)
- [ ] Menús dropdown tienen tooltip en trigger

### Toast Messages
- [ ] Incluyen nombre del elemento afectado
- [ ] Describen claramente qué pasó
- [ ] Duración apropiada (4-5 segundos)
- [ ] Errores son descriptivos

### Confirmaciones
- [ ] Muestran nombre del elemento
- [ ] Explican consecuencias
- [ ] Botones claros y descriptivos

### Consistencia
- [ ] Mismos iconos para mismas acciones
- [ ] Mismos colores para mismos estados
- [ ] Mismo patrón de mensajes

---

## 🛠️ Plantilla de Implementación

### Paso 1: Importar Componentes
```typescript
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
```

### Paso 2: Envolver Botones
```typescript
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button onClick={handleAction}>
        <Icon className="h-4 w-4 mr-2" />
        Acción
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Descripción clara de qué hace este botón</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Paso 3: Mejorar Toast
```typescript
const itemName = item.title || item.name
toast({
  title: "Acción completada exitosamente",
  description: `"${itemName}" ha sido [acción específica]`,
  duration: 4000
})
```

### Paso 4: Agregar Confirmación
```typescript
<AlertDialog open={!!itemToDelete}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Eliminar [elemento]?</AlertDialogTitle>
      <AlertDialogDescription>
        Estás a punto de eliminar:{' '}
        <span className="font-semibold text-foreground">
          "{item.name}"
        </span>
        <br /><br />
        Esta acción no se puede deshacer.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => handleDelete(itemToDelete)}
        className="bg-destructive text-destructive-foreground"
      >
        Eliminar [Elemento]
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 📊 Progreso de Implementación

| Módulo | Tooltips | Toast | Confirmaciones | Estado |
|--------|----------|-------|----------------|--------|
| Plan de Resolución | ✅ | ✅ | ✅ | ✅ Completado |
| Tickets | ✅ | ✅ | ⏳ | ✅ Completado |
| Base de Conocimientos | ✅ | ✅ | ✅ | ✅ Completado |
| Usuarios | ✅ | ✅ | ✅ | ✅ Completado |
| Categorías | ⏳ | ⏳ | ⏳ | 🔴 Pendiente |
| Departamentos | ⏳ | ⏳ | ⏳ | 🔴 Pendiente |
| Reportes | ⏳ | ⏳ | ⏳ | 🔴 Pendiente |
| Notificaciones | ⏳ | ⏳ | ⏳ | 🔴 Pendiente |

---

## 🎯 Orden de Implementación Sugerido

1. **Tickets** (Más usado, mayor impacto)
2. **Base de Conocimientos** (Ya tiene trabajo previo)
3. **Usuarios** (Crítico para administración)
4. **Categorías** (Afecta organización)
5. **Departamentos** (Gestión de equipos)
6. **Reportes** (Análisis y métricas)
7. **Notificaciones** (Comunicación)
8. **Otros módulos** (Según necesidad)

---

## 📝 Notas Importantes

### Consistencia es Clave
- Usar SIEMPRE el mismo patrón
- Mismos iconos para mismas acciones
- Mismos colores para mismos estados
- Mismos mensajes para mismas operaciones

### Testing
- Probar cada tooltip (hover)
- Probar cada toast (acción)
- Probar cada confirmación (eliminar)
- Verificar en modo oscuro

### Documentación
- Actualizar este documento con progreso
- Documentar cualquier patrón nuevo
- Mantener ejemplos actualizados

---

## 🚀 Inicio Rápido

Para comenzar con un módulo:

1. Leer `GUIA_FEEDBACK_SISTEMA_COMPLETO.md`
2. Identificar todos los botones/acciones del módulo
3. Agregar tooltips usando la plantilla
4. Mejorar toast messages con nombres específicos
5. Agregar confirmaciones para acciones destructivas
6. Probar todo el flujo
7. Actualizar este documento con ✅

---

**Preparado por:** Kiro AI  
**Fecha:** 2026-02-06  
**Estado:** 📝 PLAN MAESTRO  
**Próxima Acción:** Implementar en módulo de Tickets
