# 🚨 CORRECCIONES URGENTES A APLICAR

**Fecha**: 5 de Febrero, 2026  
**Prioridad**: CRÍTICA

---

## 🐛 ERRORES IDENTIFICADOS

### 1. Error 500 en API de Resolution Plan
**Problema**: GET `/api/tickets/[id]/resolution-plan` retorna 500
**Causa**: Probablemente falta autenticación o error en query de Prisma
**Solución**: Verificar logs del servidor y agregar manejo de errores

### 2. Error 404 en `/api/knowledge/new`
**Problema**: Endpoint no existe
**Causa**: Componente intenta cargar datos de un endpoint inexistente
**Solución**: Eliminar llamada o crear endpoint

### 3. Botón "Crear Artículo" No Visible
**Problema**: No aparece en Admin ni Técnico
**Causa**: No está implementado en el header
**Solución**: Agregar botón condicional cuando ticket.status === 'RESOLVED'

### 4. Enlaces de Base de Conocimientos No Visibles
**Problema**: No hay enlaces en sidebar
**Causa**: Falta agregar en navegación
**Solución**: Agregar en RoleDashboardLayout o ModuleLayout

### 5. Botones Duplicados en Cliente
**Problema**: Dos botones "Volver a Mis Tickets" y "Mis Tickets"
**Causa**: Redundancia en implementación
**Solución**: Unificar en un solo botón en header superior izquierdo

---

## ✅ CORRECCIONES A APLICAR

### CORRECCIÓN 1: Agregar Botón "Volver" en Admin
**Archivo**: `src/app/admin/tickets/[id]/page.tsx`
**Ubicación**: Antes del contenido principal, después del `<RoleDashboardLayout>`

```tsx
{/* Header con botón de volver */}
<div className='mb-6'>
  <Button
    variant='ghost'
    size='sm'
    onClick={() => router.push('/admin/tickets')}
    className='mb-4'
  >
    <ArrowLeft className='h-4 w-4 mr-2' />
    Volver a Todos los Tickets
  </Button>
</div>
```

### CORRECCIÓN 2: Agregar Botón "Crear Artículo" en Admin y Técnico
**Archivos**: 
- `src/app/admin/tickets/[id]/page.tsx`
- `src/app/technician/tickets/[id]/page.tsx`

**Ubicación**: En el header, junto al botón de volver

```tsx
{/* Botón Crear Artículo (solo si ticket está RESOLVED) */}
{ticket && ticket.status === 'RESOLVED' && (
  <Button
    variant='outline'
    size='sm'
    onClick={() => router.push(`/technician/knowledge/create?fromTicket=${ticket.id}`)}
    className='ml-auto'
  >
    <Lightbulb className='h-4 w-4 mr-2' />
    Crear Artículo
  </Button>
)}
```

### CORRECCIÓN 3: Unificar Botones en Cliente
**Archivo**: `src/app/client/tickets/[id]/page.tsx`

**Problema actual**: Tiene dos botones redundantes
**Solución**: Mantener solo uno en el header superior izquierdo

```tsx
{/* Header con botón de volver */}
<div className='mb-6 flex items-center justify-between'>
  <Button
    variant='ghost'
    size='sm'
    onClick={() => router.push('/client/tickets')}
  >
    <ArrowLeft className='h-4 w-4 mr-2' />
    Volver a Mis Tickets
  </Button>
</div>
```

### CORRECCIÓN 4: Agregar Enlaces de Base de Conocimientos
**Archivo**: `src/components/layout/role-dashboard-layout.tsx` o similar

**Agregar en navegación**:
```tsx
{
  title: 'Base de Conocimientos',
  href: `/${role}/knowledge`,
  icon: BookOpen,
  badge: null
}
```

### CORRECCIÓN 5: Corregir Error 500 en API
**Archivo**: `src/app/api/tickets/[id]/resolution-plan/route.ts`

**Problema**: Posible error en query de Prisma
**Solución**: Agregar try-catch más robusto y logs

```typescript
try {
  const ticket = await prisma.tickets.findUnique({
    where: { id: ticketId },
    include: {
      users_tickets_clientIdTousers: {
        select: { id: true, name: true, email: true, role: true }
      },
      users_tickets_assigneeIdTousers: {
        select: { id: true, name: true, email: true, role: true }
      }
    }
  })

  if (!ticket) {
    console.error('[API] Ticket not found:', ticketId)
    return NextResponse.json(
      { success: false, message: 'Ticket no encontrado' },
      { status: 404 }
    )
  }

  // ... resto del código
} catch (error) {
  console.error('[API] Error in resolution plan GET:', error)
  console.error('[API] Error details:', {
    ticketId,
    userId: session.user.id,
    error: error instanceof Error ? error.message : 'Unknown error'
  })
  return NextResponse.json(
    {
      success: false,
      message: 'Error al cargar el plan de resolución',
      error: error instanceof Error ? error.message : 'Error desconocido'
    },
    { status: 500 }
  )
}
```

---

## 📝 ORDEN DE APLICACIÓN

1. ✅ **PRIMERO**: Corregir error 500 en API (crítico)
2. ✅ **SEGUNDO**: Agregar botones de volver en Admin
3. ✅ **TERCERO**: Unificar botones en Cliente
4. ✅ **CUARTO**: Agregar botón "Crear Artículo"
5. ✅ **QUINTO**: Agregar enlaces de Base de Conocimientos

---

## 🧪 TESTING DESPUÉS DE CORRECCIONES

### Test 1: API de Resolution Plan
```bash
# Verificar que no hay error 500
curl http://localhost:3000/api/tickets/{ticketId}/resolution-plan
```

### Test 2: Navegación
- ✅ Admin: Botón "Volver a Todos los Tickets" visible
- ✅ Técnico: Botón "Volver a Mis Tickets" visible
- ✅ Cliente: Solo UN botón "Volver a Mis Tickets"

### Test 3: Botón Crear Artículo
- ✅ Visible solo cuando ticket.status === 'RESOLVED'
- ✅ Redirige a `/technician/knowledge/create?fromTicket={id}`

### Test 4: Enlaces de Conocimientos
- ✅ Visible en sidebar de Admin
- ✅ Visible en sidebar de Técnico
- ✅ Visible en sidebar de Cliente

---

**Última actualización**: 5 de Febrero, 2026  
**Estado**: PENDIENTE DE APLICAR
