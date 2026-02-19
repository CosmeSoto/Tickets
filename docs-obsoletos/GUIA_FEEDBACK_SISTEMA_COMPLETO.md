# 📘 Guía Completa: Sistema de Feedback del Usuario

**Fecha:** 2026-02-06  
**Objetivo:** Establecer estándares de feedback para TODO el sistema  
**Prioridad:** 🔴 CRÍTICA - Aplicar en todos los módulos  

---

## 🎯 Principios de Feedback Efectivo

### 1. **Claridad Total**
- El usuario SIEMPRE debe saber qué hace cada botón/acción
- Usar tooltips en TODOS los elementos interactivos
- Mensajes descriptivos, no genéricos

### 2. **Contexto Específico**
- Incluir nombres de elementos en los mensajes
- Ejemplo: ❌ "Tarea completada" → ✅ "Configurar servidor" completada

### 3. **Feedback Inmediato**
- Toast aparece inmediatamente después de la acción
- Duración apropiada (4-5 segundos para mensajes importantes)

### 4. **Consistencia**
- Mismo patrón en todos los módulos
- Mismos iconos para mismas acciones
- Mismos colores para mismos estados

---

## 🔧 Implementación: Tooltips

### Regla de Oro
**TODOS los elementos interactivos DEBEN tener tooltip**

### Elementos que REQUIEREN Tooltip

#### ✅ Botones
```typescript
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button onClick={handleAction}>
        <Icon className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Descripción clara de qué hace este botón</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### ✅ Iconos Clickeables
```typescript
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <button onClick={handleClick}>
        <Circle className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Marcar como completada</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### ✅ Badges de Estado
```typescript
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Badge className="bg-blue-100">
        <PlayCircle className="h-3 w-3" />
        <span className="ml-1">En Progreso</span>
      </Badge>
    </TooltipTrigger>
    <TooltipContent>
      <p>Trabajando activamente en esta tarea</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### ✅ Menús Dropdown
```typescript
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
    </TooltipTrigger>
    <TooltipContent>
      <p>Acciones disponibles</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### ✅ Opciones de Menú con Descripción
```typescript
<DropdownMenuItem onClick={handleAction}>
  <Icon className="h-4 w-4 mr-2" />
  <div className="flex flex-col">
    <span>Acción Principal</span>
    <span className="text-xs text-muted-foreground">
      Descripción de qué hace
    </span>
  </div>
</DropdownMenuItem>
```

---

## 💬 Implementación: Toast Messages

### Estructura de Toast Mejorado

#### ❌ INCORRECTO (Genérico)
```typescript
toast({
  title: "Tarea completada",
  description: "Estado actualizado"
})
```

#### ✅ CORRECTO (Específico)
```typescript
const taskTitle = task.title
toast({
  title: "¡Tarea completada!",
  description: `"${taskTitle}" ha sido marcada como completada exitosamente`,
  duration: 4000
})
```

### Patrones de Toast por Tipo de Acción

#### 1. **Crear/Agregar**
```typescript
toast({
  title: "[Elemento] creado exitosamente",
  description: `"${nombre}" ha sido agregado a [ubicación]`,
  duration: 4000
})
```

**Ejemplos:**
- "Tarea agregada exitosamente" / "Configurar servidor" ha sido agregada al plan de resolución
- "Artículo creado exitosamente" / "Guía de instalación" ha sido agregado a la base de conocimientos
- "Usuario creado exitosamente" / "Juan Pérez" ha sido agregado al sistema

#### 2. **Actualizar/Cambiar Estado**
```typescript
toast({
  title: "[Estado] actualizado",
  description: `"${nombre}" está ahora [nuevo estado]`,
  duration: 4000
})
```

**Ejemplos:**
- "Tarea iniciada" / "Configurar servidor" está ahora en progreso. El tiempo se está registrando.
- "Ticket actualizado" / "Ticket #1234" ha sido asignado a María García
- "Estado cambiado" / "Artículo de instalación" está ahora publicado

#### 3. **Eliminar**
```typescript
toast({
  title: "[Elemento] eliminado",
  description: `"${nombre}" ha sido eliminado permanentemente de [ubicación]`,
  duration: 4000
})
```

**Ejemplos:**
- "Tarea eliminada" / "Configurar servidor" ha sido eliminada permanentemente del plan
- "Artículo eliminado" / "Guía obsoleta" ha sido eliminado de la base de conocimientos
- "Usuario eliminado" / "Juan Pérez" ha sido eliminado del sistema

#### 4. **Completar**
```typescript
toast({
  title: "¡[Elemento] completado!",
  description: `"${nombre}" ha sido marcado como completado exitosamente`,
  duration: 4000
})
```

**Ejemplos:**
- "¡Tarea completada!" / "Configurar servidor" ha sido marcada como completada exitosamente
- "¡Ticket resuelto!" / "Ticket #1234" ha sido marcado como resuelto
- "¡Plan completado!" / "Plan de migración" ha sido completado exitosamente

#### 5. **Errores**
```typescript
toast({
  variant: "destructive",
  title: "Error al [acción]",
  description: "No se pudo [acción detallada]. Intenta nuevamente.",
  duration: 5000
})
```

**Ejemplos:**
- "Error al eliminar tarea" / No se pudo eliminar la tarea. Intenta nuevamente.
- "Error al crear artículo" / No se pudo crear el artículo. Verifica los datos e intenta nuevamente.
- "Error al actualizar usuario" / No se pudo actualizar el usuario. Intenta nuevamente.

#### 6. **Validación**
```typescript
toast({
  variant: "destructive",
  title: "[Campo] requerido",
  description: "Debes ingresar [campo] antes de [acción]",
  duration: 4000
})
```

**Ejemplos:**
- "Título requerido" / Debes ingresar un título para la tarea antes de agregarla
- "Email requerido" / Debes ingresar un email válido antes de crear el usuario
- "Categoría requerida" / Debes seleccionar una categoría antes de publicar el artículo

---

## 🎨 Implementación: Badges con Iconos

### Estructura de Badge Mejorado

```typescript
const getStatusBadge = (status: string) => {
  const configs = {
    pending: {
      icon: <Clock className="h-3 w-3" />,
      label: 'Pendiente',
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      description: 'Descripción del estado'
    },
    // ... más estados
  }
  
  const config = configs[status]
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={config.color}>
            {config.icon}
            <span className="ml-1">{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

### Iconos Estándar por Estado

| Estado | Icono | Color | Descripción |
|--------|-------|-------|-------------|
| Pendiente | ⏳ Clock | Gris | No iniciado |
| En Progreso | ▶️ PlayCircle | Azul | Trabajando activamente |
| Completado | ✅ CheckCircle | Verde | Terminado exitosamente |
| Bloqueado | 🚫 XCircle | Rojo | No se puede continuar |
| Cancelado | ❌ X | Rojo | Cancelado por usuario |
| Pausado | ⏸️ PauseCircle | Amarillo | Temporalmente detenido |

---

## 🔄 Implementación: Diálogos de Confirmación

### Estructura de Confirmación Mejorada

```typescript
<AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Eliminar [elemento]?</AlertDialogTitle>
      <AlertDialogDescription>
        {itemToDelete && item && (
          <>
            Estás a punto de eliminar:{' '}
            <span className="font-semibold text-foreground">
              "{item.title}"
            </span>
            <br /><br />
            Esta acción no se puede deshacer. [Consecuencias específicas].
          </>
        )}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => itemToDelete && handleDelete(itemToDelete)}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        Eliminar [Elemento]
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Elementos Clave
1. **Título claro**: "¿Eliminar tarea?"
2. **Nombre del elemento**: Mostrar qué se va a eliminar
3. **Consecuencias**: Explicar qué pasará
4. **Botones claros**: "Cancelar" y "Eliminar [Elemento]"

---

## 📋 Checklist de Implementación por Módulo

### Para CADA módulo del sistema, verificar:

#### ✅ Botones
- [ ] Todos los botones tienen tooltip
- [ ] Tooltip describe claramente la acción
- [ ] Iconos acompañados de texto cuando sea posible

#### ✅ Estados
- [ ] Badges tienen iconos
- [ ] Badges tienen tooltips con descripción
- [ ] Colores consistentes con el sistema

#### ✅ Acciones
- [ ] Menús dropdown tienen tooltip en el trigger
- [ ] Opciones de menú tienen descripción
- [ ] Acciones destructivas tienen confirmación

#### ✅ Toast Messages
- [ ] Incluyen nombre del elemento afectado
- [ ] Describen claramente qué pasó
- [ ] Duración apropiada (4-5 segundos)
- [ ] Errores son descriptivos

#### ✅ Confirmaciones
- [ ] Muestran nombre del elemento
- [ ] Explican consecuencias
- [ ] Botones claros y descriptivos

---

## 🎯 Módulos a Actualizar

### Prioridad ALTA (Actualizar YA)

1. **✅ Plan de Resolución** - COMPLETADO
   - Tooltips en todos los botones
   - Toast descriptivos
   - Confirmación con nombre de tarea

2. **⏳ Tickets**
   - Botones de estado
   - Asignación de técnico
   - Cambio de prioridad
   - Cierre de ticket

3. **⏳ Base de Conocimientos**
   - Publicar/Despublicar
   - Eliminar artículo
   - Votar artículo
   - Crear desde ticket

4. **⏳ Usuarios**
   - Crear usuario
   - Editar usuario
   - Eliminar usuario
   - Cambiar rol

5. **⏳ Categorías**
   - Crear categoría
   - Editar categoría
   - Eliminar categoría
   - Mover en árbol

6. **⏳ Departamentos**
   - Crear departamento
   - Editar departamento
   - Eliminar departamento
   - Asignar técnicos

7. **⏳ Reportes**
   - Exportar reporte
   - Filtrar datos
   - Cambiar rango de fechas

8. **⏳ Notificaciones**
   - Marcar como leída
   - Eliminar notificación
   - Ver detalles

---

## 📝 Plantilla de Implementación

### Paso 1: Importar Componentes
```typescript
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
```

### Paso 2: Envolver Elementos Interactivos
```typescript
// ANTES
<Button onClick={handleAction}>
  <Icon />
</Button>

// DESPUÉS
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button onClick={handleAction}>
        <Icon />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Descripción clara de la acción</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Paso 3: Mejorar Toast Messages
```typescript
// ANTES
toast({
  title: "Éxito",
  description: "Operación completada"
})

// DESPUÉS
const itemName = item.title
toast({
  title: "Operación completada exitosamente",
  description: `"${itemName}" ha sido [acción específica]`,
  duration: 4000
})
```

### Paso 4: Agregar Confirmaciones
```typescript
// ANTES
<Button onClick={() => handleDelete(id)}>
  Eliminar
</Button>

// DESPUÉS
<Button onClick={() => setItemToDelete(id)}>
  Eliminar
</Button>

<AlertDialog open={!!itemToDelete}>
  {/* Contenido del diálogo con nombre del elemento */}
</AlertDialog>
```

---

## 🔍 Ejemplos Completos por Módulo

### Ejemplo 1: Módulo de Tickets

#### Botón de Asignar Técnico
```typescript
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button onClick={() => setShowAssignDialog(true)}>
        <User className="h-4 w-4 mr-2" />
        Asignar Técnico
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Asigna este ticket a un técnico disponible</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### Toast de Asignación
```typescript
const technicianName = technician.name
const ticketTitle = ticket.title
toast({
  title: "Ticket asignado exitosamente",
  description: `"${ticketTitle}" ha sido asignado a ${technicianName}`,
  duration: 4000
})
```

### Ejemplo 2: Módulo de Conocimientos

#### Botón de Publicar
```typescript
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button onClick={handlePublish}>
        <Eye className="h-4 w-4 mr-2" />
        Publicar
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Publica este artículo para que sea visible a todos los usuarios</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### Toast de Publicación
```typescript
const articleTitle = article.title
toast({
  title: "Artículo publicado exitosamente",
  description: `"${articleTitle}" está ahora visible para todos los usuarios`,
  duration: 4000
})
```

### Ejemplo 3: Módulo de Usuarios

#### Botón de Eliminar Usuario
```typescript
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button 
        variant="destructive"
        onClick={() => setUserToDelete(user.id)}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Eliminar
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Elimina permanentemente este usuario del sistema</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### Confirmación de Eliminación
```typescript
<AlertDialog open={!!userToDelete}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
      <AlertDialogDescription>
        Estás a punto de eliminar a:{' '}
        <span className="font-semibold text-foreground">
          {user.name} ({user.email})
        </span>
        <br /><br />
        Esta acción no se puede deshacer. El usuario perderá acceso al sistema
        y todos sus datos serán eliminados permanentemente.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => handleDeleteUser(userToDelete)}
        className="bg-destructive text-destructive-foreground"
      >
        Eliminar Usuario
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 🎓 Mejores Prácticas

### DO ✅
- Usar tooltips en TODOS los elementos interactivos
- Incluir nombres específicos en mensajes
- Explicar consecuencias de acciones destructivas
- Usar iconos consistentes
- Duración apropiada de toast (4-5 segundos)
- Confirmación antes de eliminar

### DON'T ❌
- Mensajes genéricos ("Éxito", "Error")
- Botones sin tooltip
- Iconos sin explicación
- Eliminar sin confirmación
- Toast muy cortos (< 3 segundos)
- Colores inconsistentes

---

## 📊 Métricas de Éxito

### Indicadores de Buen Feedback
- ✅ 100% de botones tienen tooltip
- ✅ 0 mensajes genéricos
- ✅ 100% de eliminaciones tienen confirmación
- ✅ Usuarios entienden qué hace cada acción
- ✅ Menos preguntas de soporte sobre "¿qué hace este botón?"

---

## 🔄 Plan de Implementación Global

### Fase 1: Módulos Críticos (Esta Semana)
1. ✅ Plan de Resolución - COMPLETADO
2. ⏳ Tickets - Pendiente
3. ⏳ Base de Conocimientos - Pendiente

### Fase 2: Módulos de Gestión (Próxima Semana)
4. ⏳ Usuarios
5. ⏳ Categorías
6. ⏳ Departamentos

### Fase 3: Módulos Secundarios
7. ⏳ Reportes
8. ⏳ Notificaciones
9. ⏳ Configuración

---

**Preparado por:** Kiro AI  
**Fecha:** 2026-02-06  
**Versión:** 1.0  
**Estado:** 📘 Guía Oficial del Sistema
