# Guía de Optimización de Rendimiento

## Tabla de Contenidos

1. [Resumen](#resumen)
2. [Code Splitting](#code-splitting)
3. [Bundle Optimization](#bundle-optimization)
4. [Lazy Loading](#lazy-loading)
5. [Re-render Optimization](#re-render-optimization)
6. [Mejores Prácticas](#mejores-prácticas)
7. [Herramientas](#herramientas)
8. [Métricas](#métricas)

## Resumen

Este documento describe las optimizaciones de rendimiento implementadas en el sistema de tickets. Las optimizaciones se enfocan en 4 áreas principales:

- **Code Splitting**: Dividir el código en chunks más pequeños
- **Bundle Size**: Reducir el tamaño total del bundle
- **Lazy Loading**: Cargar componentes bajo demanda
- **Re-renders**: Minimizar renderizados innecesarios

## Code Splitting

### Configuración de Webpack

El archivo `next.config.mjs` contiene la configuración de code splitting:

```javascript
splitChunks: {
  chunks: 'all',
  cacheGroups: {
    // Vendor chunks por paquete
    vendor: {
      test: /[\\/]node_modules[\\/]/,
      name(module) {
        const packageName = module.context.match(
          /[\\/]node_modules[\\/](.*?)([\\/]|$)/
        )?.[1]
        return `vendor.${packageName?.replace('@', '')}`
      },
      priority: 10,
    },
    
    // UI components chunk
    ui: {
      test: /[\\/]src[\\/]components[\\/]ui[\\/]/,
      name: 'ui-components',
      priority: 20,
    },
    
    // Common components chunk
    common: {
      test: /[\\/]src[\\/]components[\\/]common[\\/]/,
      name: 'common-components',
      priority: 20,
    },
    
    // Librerías pesadas separadas
    radix: {
      test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
      name: 'radix-ui',
      priority: 30,
    },
    recharts: {
      test: /[\\/]node_modules[\\/]recharts[\\/]/,
      name: 'recharts',
      priority: 30,
    },
  },
}
```

### Beneficios

- ✅ Chunks más pequeños y específicos
- ✅ Mejor caching (cambios en app no invalidan vendor)
- ✅ Carga paralela de múltiples chunks
- ✅ Reutilización de chunks entre páginas

### Cómo Usar

El code splitting es automático. Next.js y webpack se encargan de:

1. Analizar las importaciones
2. Crear chunks según la configuración
3. Cargar chunks cuando se necesitan

## Bundle Optimization

### Optimización de Paquetes

```javascript
experimental: {
  optimizePackageImports: [
    'lucide-react',           // Solo iconos usados
    '@radix-ui/react-dialog',
    '@radix-ui/react-dropdown-menu',
    'recharts',               // Tree-shaking de gráficos
    'date-fns',              // Solo funciones usadas
  ],
}
```

### Eliminación de Console Logs

```javascript
compiler: {
  removeConsole: process.env.NODE_ENV === 'production' ? {
    exclude: ['error', 'warn'],
  } : false,
}
```

### Análisis de Bundle

Para analizar el tamaño del bundle:

```bash
# Opción 1: Script automatizado
npm run analyze:bundle

# Opción 2: Build con análisis
npm run analyze

# Opción 3: Manual
ANALYZE=true npm run build
```

Esto generará un archivo `.next/analyze.html` con un reporte visual del bundle.

### Mejores Prácticas

#### ✅ Hacer

```typescript
// Importar solo lo necesario
import { Button } from '@/components/ui/button'
import { User, Mail } from 'lucide-react'

// Tree-shaking de date-fns
import { format, parseISO } from 'date-fns'
```

#### ❌ Evitar

```typescript
// Importar todo el paquete
import * as Icons from 'lucide-react'
import * as dateFns from 'date-fns'

// Importar componentes no usados
import { Button, Card, Dialog, ... } from '@/components/ui'
```

## Lazy Loading

### Componentes Pesados

Use `dynamic` de Next.js para cargar componentes pesados bajo demanda:

```typescript
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy load con loading state
const ReportsPage = dynamic(() => import('@/components/reports/reports-page'), {
  loading: () => <Skeleton className="h-screen w-full" />,
  ssr: false, // Opcional: deshabilitar SSR
})

export default function ReportsRoute() {
  return <ReportsPage />
}
```

### Cuándo Usar Lazy Loading

✅ **Usar para**:
- Componentes con librerías pesadas (Recharts, D3, etc.)
- Modales y diálogos (no se usan inmediatamente)
- Componentes de administración (no todos los usuarios los ven)
- Editores de texto enriquecido
- Visualizadores de PDF/imágenes

❌ **No usar para**:
- Componentes críticos above-the-fold
- Componentes pequeños (<10KB)
- Componentes usados en todas las páginas
- Componentes de navegación

### Ejemplo: Modal con Lazy Loading

```typescript
// ❌ Carga inmediata (aumenta bundle inicial)
import { UserDetailsModal } from '@/components/ui/user-details-modal'

// ✅ Carga diferida (reduce bundle inicial)
const UserDetailsModal = dynamic(() => 
  import('@/components/ui/user-details-modal'), {
  loading: () => <Skeleton className="h-96 w-full" />
})

function UsersPage() {
  const [showModal, setShowModal] = useState(false)
  
  return (
    <>
      <Button onClick={() => setShowModal(true)}>Ver Detalles</Button>
      {showModal && <UserDetailsModal />}
    </>
  )
}
```

## Re-render Optimization

### React.memo

Use `React.memo` para componentes puros que no necesitan re-renderizar cuando sus props no cambian:

```typescript
import { memo } from 'react'

interface CardProps {
  item: Item
  onEdit: (item: Item) => void
  onDelete: (item: Item) => void
}

// Componente sin optimizar
export function Card({ item, onEdit, onDelete }: CardProps) {
  return (
    <div>
      <h3>{item.name}</h3>
      <Button onClick={() => onEdit(item)}>Editar</Button>
      <Button onClick={() => onDelete(item)}>Eliminar</Button>
    </div>
  )
}

// Componente optimizado con React.memo
export const Card = memo(function Card({ item, onEdit, onDelete }: CardProps) {
  return (
    <div>
      <h3>{item.name}</h3>
      <Button onClick={() => onEdit(item)}>Editar</Button>
      <Button onClick={() => onDelete(item)}>Eliminar</Button>
    </div>
  )
})

// Con comparación personalizada
export const Card = memo(
  CardComponent,
  (prevProps, nextProps) => {
    // Solo re-renderizar si el item cambió
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.updatedAt === nextProps.item.updatedAt
    )
  }
)
```

### useMemo

Use `useMemo` para memorizar cálculos costosos:

```typescript
import { useMemo } from 'react'

function TechniciansPage() {
  const { data: technicians } = useModuleData()
  
  // ❌ Se recalcula en cada render
  const departments = technicians
    .map(t => t.department)
    .filter(Boolean)
    .filter((dept, index, self) =>
      index === self.findIndex(d => d.id === dept.id)
    )
    .sort((a, b) => a.name.localeCompare(b.name))
  
  // ✅ Solo se recalcula cuando technicians cambia
  const departments = useMemo(() => {
    const depts = technicians
      .map(t => t.department)
      .filter(Boolean)
    
    const uniqueDepts = depts.filter((dept, index, self) =>
      index === self.findIndex(d => d.id === dept.id)
    )
    
    return uniqueDepts.sort((a, b) => a.name.localeCompare(b.name))
  }, [technicians])
  
  // ✅ Configuración de filtros memoizada
  const filterConfig = useMemo(() => [
    {
      id: 'search',
      type: 'search',
      searchFields: ['name', 'email'],
    },
    {
      id: 'department',
      type: 'select',
      options: departments.map(d => ({ value: d.id, label: d.name }))
    }
  ], [departments])
  
  return <FilterBar config={filterConfig} />
}
```

### useCallback

Use `useCallback` para memorizar funciones:

```typescript
import { useCallback } from 'react'

function TechniciansPage() {
  const { reload } = useModuleData()
  const { toast } = useToast()
  
  // ❌ Se crea nueva función en cada render
  const handleEdit = (technician: Technician) => {
    setEditingTechnician(technician)
    setIsDialogOpen(true)
  }
  
  // ✅ Función memoizada
  const handleEdit = useCallback((technician: Technician) => {
    setEditingTechnician(technician)
    setIsDialogOpen(true)
  }, [])
  
  // ✅ Con dependencias
  const handleDelete = useCallback(async (technician: Technician) => {
    try {
      await deleteAPI(technician.id)
      toast({ title: 'Eliminado' })
      reload()
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' })
    }
  }, [reload, toast])
  
  return (
    <CardView
      data={technicians}
      renderCard={(tech) => (
        <Card
          item={tech}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    />
  )
}
```

### Optimización de Listas

```typescript
// ❌ Funciones inline causan re-renders
{data.map(item => (
  <Card
    key={item.id}
    item={item}
    onClick={() => handleClick(item)}  // Nueva función cada render
  />
))}

// ✅ Función memoizada
const handleClick = useCallback((item: Item) => {
  // ...
}, [])

{data.map(item => (
  <MemoizedCard
    key={item.id}
    item={item}
    onClick={handleClick}
  />
))}

// ✅ Aún mejor: pasar ID en lugar de objeto
const handleClick = useCallback((id: string) => {
  const item = data.find(d => d.id === id)
  // ...
}, [data])

{data.map(item => (
  <MemoizedCard
    key={item.id}
    itemId={item.id}
    onClick={handleClick}
  />
))}
```

## Mejores Prácticas

### 1. Componentes

```typescript
// ✅ Componente optimizado
export const OptimizedCard = memo(function OptimizedCard({ 
  item, 
  onEdit, 
  onDelete 
}: CardProps) {
  // Cálculos memoizados
  const stats = useMemo(() => calculateStats(item), [item])
  
  // Funciones memoizadas
  const handleEdit = useCallback(() => onEdit(item), [item, onEdit])
  const handleDelete = useCallback(() => onDelete(item), [item, onDelete])
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{item.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <Stats data={stats} />
        <div className="flex space-x-2">
          <Button onClick={handleEdit}>Editar</Button>
          <Button onClick={handleDelete}>Eliminar</Button>
        </div>
      </CardContent>
    </Card>
  )
})
```

### 2. Hooks Personalizados

```typescript
// ✅ Hook optimizado
export function useOptimizedData() {
  const { data, loading } = useModuleData()
  
  // Filtrado memoizado
  const filteredData = useMemo(() => {
    return data.filter(item => item.isActive)
  }, [data])
  
  // Estadísticas memoizadas
  const stats = useMemo(() => ({
    total: data.length,
    active: filteredData.length,
    inactive: data.length - filteredData.length
  }), [data, filteredData])
  
  // Funciones memoizadas
  const reload = useCallback(async () => {
    // ...
  }, [])
  
  return { data: filteredData, stats, loading, reload }
}
```

### 3. Contextos

```typescript
// ✅ Contexto optimizado
const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data[]>([])
  
  // Valor memoizado para evitar re-renders
  const value = useMemo(() => ({
    data,
    setData,
  }), [data])
  
  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}
```

## Herramientas

### 1. Bundle Analyzer

```bash
# Analizar bundle
npm run analyze

# Ver reporte
open .next/analyze.html
```

### 2. React DevTools Profiler

1. Instalar React DevTools en Chrome/Firefox
2. Abrir DevTools → Profiler
3. Grabar interacción
4. Analizar flamegraph de renders

### 3. Lighthouse

```bash
# Lighthouse CI
npm run lighthouse

# O usar Chrome DevTools → Lighthouse
```

### 4. Next.js Build Output

```bash
npm run build

# Ver tamaño de páginas y chunks
# Output muestra:
# - First Load JS: Tamaño inicial
# - Size: Tamaño del chunk
```

## Métricas

### Core Web Vitals

- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

### Métricas de Bundle

- **Bundle inicial**: < 500KB
- **Vendor chunks**: < 300KB
- **App chunks**: < 200KB

### Métricas de Rendimiento

- **FCP (First Contentful Paint)**: < 1.8s
- **TTI (Time to Interactive)**: < 3.0s
- **Re-renders por interacción**: < 10

### Cómo Medir

```typescript
// Performance API
const start = performance.now()
// ... operación
const end = performance.now()
console.log(`Tiempo: ${end - start}ms`)

// React Profiler
import { Profiler } from 'react'

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
) {
  console.log(`${id} (${phase}): ${actualDuration}ms`)
}

<Profiler id="MyComponent" onRender={onRenderCallback}>
  <MyComponent />
</Profiler>
```

## Checklist de Optimización

### Antes de Implementar

- [ ] Identificar componentes pesados (>50KB)
- [ ] Identificar componentes con re-renders frecuentes
- [ ] Medir métricas actuales (baseline)
- [ ] Priorizar optimizaciones por impacto

### Durante Implementación

- [ ] Implementar code splitting
- [ ] Agregar lazy loading a componentes pesados
- [ ] Agregar React.memo a componentes puros
- [ ] Agregar useMemo a cálculos costosos
- [ ] Agregar useCallback a funciones en props

### Después de Implementar

- [ ] Medir nuevas métricas
- [ ] Comparar con baseline
- [ ] Verificar que no hay regresiones
- [ ] Documentar cambios
- [ ] Actualizar guías de desarrollo

## Recursos

- [Next.js Performance](https://nextjs.org/docs/advanced-features/measuring-performance)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Web.dev Performance](https://web.dev/performance/)
- [Webpack Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)

## Soporte

Para preguntas o problemas con optimizaciones:

1. Revisar esta guía
2. Analizar bundle con `npm run analyze`
3. Usar React DevTools Profiler
4. Consultar con el equipo de desarrollo
