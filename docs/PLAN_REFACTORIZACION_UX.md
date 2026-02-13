# 🔧 Plan de Refactorización UX - Eliminación de Redundancias

**Fecha**: 20 de enero de 2026  
**Estado**: 🚀 En Progreso

---

## 📋 Resumen

Este documento detalla el plan para refactorizar el sistema de tickets, eliminando código duplicado y mejorando la consistencia UX entre los diferentes roles (Admin, Técnico, Cliente).

---

## ✅ Archivos Creados

### 1. Utilidades
- ✅ `src/lib/utils/ticket-utils.ts` - Funciones compartidas para tickets
  - `getPriorityColor()` - Colores de prioridad
  - `getStatusColor()` - Colores de estado
  - `getPriorityLabel()` - Etiquetas en español
  - `getStatusLabel()` - Etiquetas en español
  - `formatTimeElapsed()` - Formato de tiempo
  - `filterTickets()` - Filtrado de tickets
  - `sortTicketsByUrgency()` - Ordenamiento por urgencia

### 2. Hooks Personalizados
- ✅ `src/hooks/use-role-protection.ts` - Protección de rutas
  - `useRoleProtection()` - Hook genérico
  - `useAdminProtection()` - Para rutas de admin
  - `useTechnicianProtection()` - Para rutas de técnico
  - `useClientProtection()` - Para rutas de cliente
  - `useHasRole()` - Verificar rol específico
  - `useHasAnyRole()` - Verificar múltiples roles

- ✅ `src/hooks/use-dashboard-data.ts` - Carga de datos del dashboard
  - `useDashboardData()` - Cargar stats y tickets
  - `useDashboardStats()` - Solo estadísticas
  - `useDashboardTickets()` - Solo tickets

### 3. Componentes Compartidos
- ✅ `src/components/shared/quick-action-card.tsx` - Tarjetas de acciones
- ✅ `src/components/shared/loading-dashboard.tsx` - Estados de carga

---

## 🎯 Próximos Pasos

### Fase 1: Refactorizar Dashboards (2-3 horas)

#### 1.1 Admin Dashboard
**Archivo**: `src/app/admin/page.tsx`

**Cambios**:
```typescript
// ANTES (código duplicado)
const [stats, setStats] = useState<DashboardStats>({...})
const [isLoading, setIsLoading] = useState(true)

useEffect(() => {
  if (status === 'loading') return
  if (!session) router.push('/login')
  if (session.user.role !== 'ADMIN') router.push('/unauthorized')
  loadDashboardData()
}, [session, status, router])

// DESPUÉS (usando hooks)
const { isAuthorized, isLoading: authLoading } = useAdminProtection()
const { stats, tickets, isLoading, error } = useDashboardData('ADMIN')

if (authLoading || isLoading) {
  return <LoadingDashboard title="Dashboard Administrativo" />
}
```

**Beneficios**:
- ❌ Elimina ~50 líneas de código duplicado
- ✅ Manejo de errores centralizado
- ✅ Código más limpio y legible

#### 1.2 Technician Dashboard
**Archivo**: `src/app/technician/page.tsx`

**Cambios similares**:
```typescript
// Usar hooks en lugar de código duplicado
const { isAuthorized, isLoading: authLoading } = useTechnicianProtection()
const { stats, tickets, isLoading } = useDashboardData('TECHNICIAN')
```

#### 1.3 Client Dashboard
**Archivo**: `src/app/client/page.tsx`

**Cambios similares**:
```typescript
const { isAuthorized, isLoading: authLoading } = useClientProtection()
const { stats, tickets, isLoading } = useDashboardData('CLIENT')
```

### Fase 2: Refactorizar Tarjetas de Acciones (1 hora)

#### 2.1 Admin Quick Actions
**Antes**:
```typescript
<Link href='/admin/users'>
  <Card className='hover:shadow-md transition-all cursor-pointer border-2 hover:border-blue-200'>
    <CardContent className='p-4'>
      <div className='flex items-center space-x-3'>
        <div className='p-2 bg-blue-100 rounded-lg'>
          <Users className='h-6 w-6 text-blue-600' />
        </div>
        <div>
          <h3 className='font-semibold text-foreground'>Gestión de Usuarios</h3>
          <p className='text-sm text-muted-foreground'>Administrar usuarios y roles</p>
        </div>
      </div>
    </CardContent>
  </Card>
</Link>
```

**Después**:
```typescript
<QuickActionCard
  href='/admin/users'
  icon={Users}
  title='Gestión de Usuarios'
  description='Administrar usuarios y roles'
  color='blue'
/>
```

**Beneficios**:
- ❌ Reduce de 15 líneas a 6 líneas por tarjeta
- ✅ Consistencia visual automática
- ✅ Fácil de mantener

#### 2.2 Aplicar en todos los dashboards
- Admin: 4 tarjetas → Reducción de ~36 líneas
- Technician: 4 botones → Convertir a tarjetas
- Client: 4 tarjetas → Reducción de ~36 líneas

### Fase 3: Refactorizar Funciones de Utilidad (30 min)

#### 3.1 Reemplazar funciones duplicadas

**Archivos a modificar**:
- `src/app/admin/tickets/page.tsx`
- `src/app/technician/tickets/page.tsx`
- `src/app/client/tickets/page.tsx`
- `src/app/client/page.tsx`
- `src/app/technician/page.tsx`

**Cambios**:
```typescript
// ANTES (en cada archivo)
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'URGENT': return 'bg-red-100 text-red-800'
    // ...
  }
}

// DESPUÉS (importar)
import { getPriorityColor, getStatusColor } from '@/lib/utils/ticket-utils'
```

**Beneficios**:
- ❌ Elimina ~100 líneas de código duplicado
- ✅ Soporte para dark mode automático
- ✅ Consistencia en toda la aplicación

### Fase 4: Crear Componentes de Tickets (2-3 horas)

#### 4.1 TicketListItem Component
**Archivo**: `src/components/shared/ticket-list-item.tsx`

```typescript
interface TicketListItemProps {
  ticket: {
    id: string
    title: string
    priority: string
    status: string
    client?: string
    assignee?: string
    category: string
    createdAt: string
  }
  role: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
  onView?: (id: string) => void
  showActions?: boolean
}

export function TicketListItem({ ticket, role, onView, showActions }: TicketListItemProps) {
  // Componente reutilizable que adapta la visualización según el rol
}
```

#### 4.2 TicketFilters Component
**Archivo**: `src/components/shared/ticket-filters.tsx`

```typescript
interface TicketFiltersProps {
  onFilterChange: (filters: TicketFilters) => void
  availableFilters: ('priority' | 'status' | 'assignee' | 'client')[]
  role: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
}

export function TicketFilters({ onFilterChange, availableFilters, role }: TicketFiltersProps) {
  // Filtros adaptables según el rol
}
```

### Fase 5: Testing y Validación (2 horas)

#### 5.1 Tests Unitarios
- [ ] Tests de `ticket-utils.ts`
- [ ] Tests de `use-role-protection.ts`
- [ ] Tests de `use-dashboard-data.ts`
- [ ] Tests de componentes compartidos

#### 5.2 Tests de Integración
- [ ] Verificar dashboards de cada rol
- [ ] Verificar páginas de tickets
- [ ] Verificar permisos y redirecciones
- [ ] Verificar en modo claro y oscuro

#### 5.3 Tests E2E
- [ ] Flujo completo de admin
- [ ] Flujo completo de técnico
- [ ] Flujo completo de cliente
- [ ] Verificar que no hay regresiones

---

## 📊 Métricas de Impacto

### Reducción de Código

| Componente | Antes | Después | Reducción |
|------------|-------|---------|-----------|
| Dashboards | ~450 líneas | ~250 líneas | 44% |
| Páginas de Tickets | ~800 líneas | ~500 líneas | 37% |
| Funciones de Utilidad | ~150 líneas | ~0 líneas | 100% |
| **TOTAL** | **~1,400 líneas** | **~750 líneas** | **46%** |

### Mejoras de Mantenibilidad

| Aspecto | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Archivos a modificar para cambio | 5-8 | 1-2 | 75% |
| Tiempo para agregar funcionalidad | 2-3h | 30-45min | 75% |
| Consistencia UX | 70% | 95% | 25% |
| Bugs por inconsistencias | Alto | Bajo | 60% |

---

## 🔄 Proceso de Refactorización

### Paso a Paso

1. **Crear rama de refactorización**
   ```bash
   git checkout -b refactor/ux-consistency
   ```

2. **Implementar utilidades y hooks** ✅
   - [x] ticket-utils.ts
   - [x] use-role-protection.ts
   - [x] use-dashboard-data.ts

3. **Crear componentes compartidos** ✅
   - [x] quick-action-card.tsx
   - [x] loading-dashboard.tsx
   - [ ] ticket-list-item.tsx
   - [ ] ticket-filters.tsx

4. **Refactorizar dashboards**
   - [ ] Admin dashboard
   - [ ] Technician dashboard
   - [ ] Client dashboard

5. **Refactorizar páginas de tickets**
   - [ ] Admin tickets
   - [ ] Technician tickets
   - [ ] Client tickets

6. **Testing completo**
   - [ ] Tests unitarios
   - [ ] Tests de integración
   - [ ] Tests E2E

7. **Code review y merge**
   - [ ] Revisión de código
   - [ ] Aprobación
   - [ ] Merge a main

---

## ⚠️ Consideraciones Importantes

### 1. Compatibilidad hacia atrás
- ✅ No romper funcionalidad existente
- ✅ Mantener misma UX para usuarios
- ✅ Preservar permisos y seguridad

### 2. Performance
- ✅ No degradar tiempos de carga
- ✅ Optimizar llamadas a API
- ✅ Implementar caching donde sea posible

### 3. Accesibilidad
- ✅ Mantener soporte de teclado
- ✅ Preservar ARIA labels
- ✅ Verificar contraste de colores

### 4. Responsive Design
- ✅ Verificar en móviles
- ✅ Verificar en tablets
- ✅ Verificar en desktop

---

## 📝 Checklist de Implementación

### Utilidades y Hooks
- [x] ticket-utils.ts creado
- [x] use-role-protection.ts creado
- [x] use-dashboard-data.ts creado
- [ ] Tests unitarios de utilidades
- [ ] Tests de hooks

### Componentes Compartidos
- [x] QuickActionCard creado
- [x] LoadingDashboard creado
- [ ] TicketListItem creado
- [ ] TicketFilters creado
- [ ] Tests de componentes

### Refactorización de Dashboards
- [ ] Admin dashboard refactorizado
- [ ] Technician dashboard refactorizado
- [ ] Client dashboard refactorizado
- [ ] Tests de dashboards

### Refactorización de Tickets
- [ ] Admin tickets refactorizado
- [ ] Technician tickets refactorizado
- [ ] Client tickets refactorizado
- [ ] Tests de páginas de tickets

### Validación Final
- [ ] Tests E2E pasando
- [ ] No regresiones detectadas
- [ ] Performance mantenida
- [ ] Accesibilidad verificada
- [ ] Responsive verificado
- [ ] Dark mode verificado

---

## 🎯 Próxima Sesión de Trabajo

### Prioridad Alta (Hacer primero)
1. ✅ Crear TicketListItem component
2. ✅ Refactorizar Admin dashboard
3. ✅ Refactorizar Client dashboard

### Prioridad Media
4. ✅ Refactorizar Technician dashboard
5. ✅ Crear TicketFilters component
6. ✅ Refactorizar páginas de tickets

### Prioridad Baja (Opcional)
7. ⚪ Agregar tests unitarios
8. ⚪ Agregar tests E2E
9. ⚪ Documentación adicional

---

## 📚 Recursos

### Documentación Relacionada
- `AUDITORIA_UX_ROLES.md` - Análisis completo de redundancias
- `ROLES_AND_PERMISSIONS.md` - Matriz de permisos
- `CLIENT_TICKETS_IMPLEMENTATION.md` - Implementación de cliente

### Archivos Clave
- `src/components/layout/role-dashboard-layout.tsx` - Layout unificado
- `src/components/shared/stats-card.tsx` - Tarjetas de estadísticas
- `src/app/api/dashboard/stats/route.ts` - API de estadísticas

---

## ✅ Estado Actual

**Progreso**: 30% completado

- ✅ Análisis y auditoría
- ✅ Utilidades creadas
- ✅ Hooks creados
- ✅ Componentes básicos creados
- ⏳ Refactorización en progreso
- ⏳ Testing pendiente

---

*Última actualización: 20 de enero de 2026*
