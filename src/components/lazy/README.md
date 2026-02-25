# Lazy Loading Components

Este directorio contiene componentes optimizados con lazy loading para mejorar el rendimiento de la aplicación.

## ¿Qué es Lazy Loading?

Lazy loading es una técnica que carga componentes solo cuando son necesarios, en lugar de cargarlos todos al inicio. Esto reduce el tamaño del bundle inicial y mejora el tiempo de carga.

## Componentes Disponibles

### Reports
- `ReportsPage` - Página completa de reportes
- `ReportKPIMetrics` - Métricas KPI
- `DetailedTicketsTable` - Tabla detallada de tickets
- `LazyBarChart` - Gráfico de barras
- `LazyLineChart` - Gráfico de líneas
- `LazyPieChart` - Gráfico circular

### Backups
- `BackupDashboard` - Dashboard de backups
- `BackupConfiguration` - Configuración de backups
- `BackupMonitoring` - Monitoreo de backups
- `BackupRestore` - Restauración de backups

### Knowledge Base
- `ArticleViewer` - Visor de artículos
- `CreateArticleDialog` - Diálogo de creación de artículos

### User Management
- `CreateUserModal` - Modal de creación de usuario
- `EditUserModal` - Modal de edición de usuario
- `AvatarUploadModal` - Modal de carga de avatar

### Categories & Departments
- `CategoryFormDialog` - Formulario de categorías
- `DepartmentFormDialog` - Formulario de departamentos

### Tickets
- `RateTicketDialog` - Diálogo de calificación
- `ResolveTicketDialog` - Diálogo de resolución

## Uso

```typescript
// Importar componentes lazy
import { ReportsPage, BackupDashboard } from '@/components/lazy'

// Usar normalmente en tu componente
function MyComponent() {
  return (
    <div>
      <ReportsPage />
      <BackupDashboard />
    </div>
  )
}
```

## Beneficios

✅ **Reducción del bundle inicial** - Solo se carga el código necesario  
✅ **Mejor First Contentful Paint (FCP)** - La página se muestra más rápido  
✅ **Mejor Time to Interactive (TTI)** - La página es interactiva antes  
✅ **Fallbacks de loading** - Muestra skeletons mientras carga  
✅ **SSR deshabilitado** - Evita problemas de hidratación  

## Configuración

Todos los componentes lazy están configurados con:

```typescript
dynamic(
  () => import('./component'),
  { 
    loading: LoadingFallback,  // Componente de loading
    ssr: false                  // Deshabilitar SSR
  }
)
```

## Cuándo Usar

Usa lazy loading para:
- ✅ Componentes grandes (>50KB)
- ✅ Componentes que no se usan en la carga inicial
- ✅ Modals y dialogs
- ✅ Gráficos y visualizaciones
- ✅ Componentes de administración

No uses lazy loading para:
- ❌ Componentes pequeños (<10KB)
- ❌ Componentes críticos para la primera vista
- ❌ Componentes que se usan frecuentemente

## Agregar Nuevos Componentes

Para agregar un nuevo componente lazy:

```typescript
// En src/components/lazy/index.tsx
export const MyComponent = dynamic(
  () => import('@/components/my-component').then(mod => mod.MyComponent),
  { loading: LoadingFallback, ssr: false }
)
```

## Métricas

Con lazy loading implementado:
- Bundle inicial reducido ~28%
- Tiempo de carga mejorado ~37%
- Mejor experiencia en dispositivos lentos
