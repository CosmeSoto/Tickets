# ✅ RESUMEN DE CORRECCIONES A APLICAR

**Fecha**: 5 de Febrero, 2026

---

## 🎯 CORRECCIONES NECESARIAS

### 1. **TÉCNICO** - Reorganizar Tabs

**Cambio**: De 5 tabs a 4 tabs (eliminar "Calificación")

**Tabs Correctos**:
1. ✅ Estado - Cambiar estado del ticket
2. ✅ Historial - Timeline + comentarios
3. ✅ Plan de Resolución - Crear/editar plan
4. ✅ Archivos - Ver/descargar archivos

**Eliminar**:
- ❌ Tab "Calificación" (solo clientes califican)

**Agregar**:
- ✅ Botón "Crear Artículo" (cuando ticket está RESOLVED)

---

### 2. **CLIENTE** - Mejorar Navegación

**Agregar**:
- ✅ Botón "Volver a Mis Tickets" en el header

---

### 3. **ADMIN** - Sin Cambios

Ya está correcto con 4 tabs:
1. Historial
2. Plan de Resolución
3. Calificación
4. Archivos

---

## 📋 PERMISOS POR ROL (DEFINITIVO)

### **ADMIN** puede:
- ✅ Ver TODO
- ✅ Editar TODO
- ✅ Ver calificaciones + estadísticas del técnico
- ✅ Ver comentarios internos
- ✅ Crear plan de resolución
- ✅ Subir/ver/descargar archivos

### **TÉCNICO** puede:
- ✅ Cambiar estado (transiciones válidas)
- ✅ Ver historial completo
- ✅ Agregar comentarios (públicos e internos)
- ✅ Ver comentarios internos
- ✅ Crear/editar plan de resolución (si es asignado)
- ✅ Ver/descargar archivos
- ✅ Crear artículo (si ticket RESOLVED y es asignado)
- ❌ NO puede calificar
- ❌ NO puede ver estadísticas del técnico
- ❌ NO puede editar título/descripción del ticket

### **CLIENTE** puede:
- ✅ Ver historial (solo público)
- ✅ Agregar comentarios públicos
- ✅ Calificar servicio (si RESOLVED o CLOSED)
- ✅ Ver/descargar archivos
- ✅ Editar título/descripción (solo si OPEN)
- ✅ Eliminar ticket (solo si OPEN)
- ❌ NO puede ver comentarios internos
- ❌ NO puede ver plan de resolución
- ❌ NO puede cambiar estado
- ❌ NO puede ver estadísticas del técnico

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### Archivo: `src/app/technician/tickets/[id]/page.tsx`

**Cambios a aplicar**:

1. **Tabs** - Cambiar de 5 a 4:
```tsx
<TabsList className="grid w-full grid-cols-4">
  <TabsTrigger value="status">Estado</TabsTrigger>
  <TabsTrigger value="timeline">Historial</TabsTrigger>
  <TabsTrigger value="resolution">Plan de Resolución</TabsTrigger>
  <TabsTrigger value="files">Archivos</TabsTrigger>
</TabsList>
```

2. **Eliminar TabsContent de "rating"**

3. **Agregar botón "Crear Artículo"** en el header:
```tsx
{canCreateArticle && (
  <Button variant='outline' size='sm' onClick={handleCreateArticle}>
    <Lightbulb className='h-4 w-4 mr-2' />
    Crear Artículo
  </Button>
)}
```

4. **Agregar lógica**:
```tsx
const canCreateArticle = ticket.status === 'RESOLVED' && ticket.assignee?.id === session?.user?.id

const handleCreateArticle = () => {
  router.push(`/technician/knowledge/create?fromTicket=${ticket.id}`)
}
```

---

### Archivo: `src/app/client/tickets/[id]/page.tsx`

**Cambios a aplicar**:

1. **Agregar botón "Volver"** en headerActions:
```tsx
const headerActions = (
  <div className='flex items-center space-x-2'>
    <Button variant='outline' size='sm' onClick={() => router.push('/client/tickets')}>
      <ArrowLeft className='h-4 w-4 mr-2' />
      Mis Tickets
    </Button>
    {getStatusBadge(ticket.status)}
    {getPriorityBadge(ticket.priority)}
    {/* ... resto de botones ... */}
  </div>
)
```

---

## ✅ VERIFICACIÓN

Después de aplicar los cambios, verificar:

1. ✅ Técnico tiene 4 tabs (sin Calificación)
2. ✅ Técnico ve botón "Crear Artículo" cuando ticket está RESOLVED
3. ✅ Cliente tiene botón "Volver a Mis Tickets" visible
4. ✅ Admin sigue con 4 tabs (sin cambios)
5. ✅ Todos los roles tienen navegación consistente
6. ✅ Archivos visibles en tab dedicado para todos

---

## 📊 TABS FINALES POR ROL

```
ADMIN (4 tabs):
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  Historial  │  Plan Res.  │ Calificación│  Archivos   │
└─────────────┴─────────────┴─────────────┴─────────────┘

TÉCNICO (4 tabs):
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   Estado    │  Historial  │  Plan Res.  │  Archivos   │
└─────────────┴─────────────┴─────────────┴─────────────┘

CLIENTE (3 tabs):
┌─────────────┬─────────────┬─────────────┐
│  Historial  │ Calificación│  Archivos   │
└─────────────┴─────────────┴─────────────┘
```

---

**Estado**: 📝 PENDIENTE DE APLICAR  
**Archivos a modificar**: 2  
**Tiempo estimado**: 10 minutos
