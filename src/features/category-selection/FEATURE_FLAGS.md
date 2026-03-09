# Feature Flags - Category Selection

## Introducción

El sistema de selección de categorías utiliza **feature flags** para permitir rollout gradual, A/B testing y activación/desactivación rápida de funcionalidades.

## Flags Disponibles

### Flag Principal

- **`enhanced_category_selector`**: Flag maestro que habilita el nuevo selector mejorado

### Flags de Funcionalidades

- **`category_smart_search`**: Búsqueda fuzzy con Fuse.js
- **`category_suggestions`**: Sugerencias contextuales automáticas
- **`category_frequent`**: Categorías frecuentes del usuario
- **`category_step_by_step`**: Navegación guiada paso a paso
- **`category_knowledge_base`**: Integración con base de conocimientos
- **`category_visual_enhancements`**: Mejoras visuales (iconos, colores, breadcrumbs)
- **`category_analytics`**: Tracking de interacciones

## Configuración Inicial

```typescript
import { initializeCategorySelectorFlags } from '@/features/category-selection/config/feature-flags';

// En app/layout.tsx o _app.tsx
initializeCategorySelectorFlags();
```

## Activar/Desactivar Features

### Método 1: Por Código

```typescript
import { featureFlagsService } from '@/lib/config/feature-flags';
import { CATEGORY_SELECTOR_FLAGS } from '@/features/category-selection/config/feature-flags';

// Activar feature
featureFlagsService.setFlag({
  id: CATEGORY_SELECTOR_FLAGS.SMART_SEARCH,
  name: 'Category Smart Search',
  description: 'Enable fuzzy search',
  enabled: true,
  rolloutPercentage: 100,
  conditions: [],
  variants: [],
}, 'category-selector-module');

// Desactivar feature
featureFlagsService.setFlag({
  id: CATEGORY_SELECTOR_FLAGS.SMART_SEARCH,
  enabled: false,
  // ... resto igual
}, 'category-selector-module');
```

### Método 2: Variables de Entorno

```bash
# .env.local
NEXT_PUBLIC_FEATURE_ENHANCED_SELECTOR=true
NEXT_PUBLIC_FEATURE_SMART_SEARCH=true
NEXT_PUBLIC_FEATURE_SUGGESTIONS=false
```

## Rollout Gradual

### Por Porcentaje

```typescript
// Activar para 50% de usuarios
featureFlagsService.setFlag({
  id: CATEGORY_SELECTOR_FLAGS.SUGGESTIONS,
  enabled: true,
  rolloutPercentage: 50,  // Solo 50% verán la feature
  // ...
}, 'category-selector-module');
```

### Plan de Rollout Recomendado

#### Fase 1: Testing Interno (Día 1-3)
- Solo ADMIN y DEVELOPER
- 100% de estos roles

```typescript
conditions: [
  { type: 'user_role', operator: 'in', value: ['ADMIN', 'DEVELOPER'] }
]
```

#### Fase 2: Beta Testing (Día 4-7)
- 10% de usuarios CLIENT

```typescript
rolloutPercentage: 10,
conditions: [
  { type: 'user_role', operator: 'equals', value: 'CLIENT' }
]
```

#### Fase 3: Rollout Gradual (Día 8-14)
- Día 8: 25%
- Día 10: 50%
- Día 12: 75%
- Día 14: 100%

#### Fase 4: Producción Completa (Día 15+)
- 100% de todos los usuarios

## Targeting por Condiciones

### Por Rol

```typescript
conditions: [
  {
    type: 'user_role',
    operator: 'equals',
    value: 'ADMIN',
  },
]
```

### Por Usuario Específico

```typescript
conditions: [
  {
    type: 'user_id',
    operator: 'in',
    value: ['user-123', 'user-456'],
  },
]
```

## Verificar Feature Flags

```typescript
import { 
  isEnhancedSelectorEnabled,
  isCategorySelectorFeatureEnabled,
  getCategorySelectorConfig,
} from '@/features/category-selection/config/feature-flags';

// Verificar flag principal
if (isEnhancedSelectorEnabled(userId, userRole)) {
  // Usar selector mejorado
}

// Verificar feature específica
if (isCategorySelectorFeatureEnabled('SMART_SEARCH', userId, userRole)) {
  // Mostrar búsqueda inteligente
}

// Obtener configuración completa
const config = getCategorySelectorConfig(userId, userRole);
console.log(config.useEnhancedSelector);
console.log(config.enabledFeatures);
console.log(config.fallbackMode);
```

## Fallback para Navegadores Antiguos

El sistema detecta automáticamente capacidades del navegador:

```typescript
import { 
  browserSupportsEnhancedFeatures,
  detectBrowserCapabilities,
} from '@/features/category-selection/config/feature-flags';

// Verificar soporte
if (browserSupportsEnhancedFeatures()) {
  // Usar selector mejorado
} else {
  // Usar CategorySelectorFallback
}

// Capacidades detectadas
const capabilities = detectBrowserCapabilities();
// - supportsIntersectionObserver
// - supportsResizeObserver
// - supportsES6
// - supportsFlexbox
// - supportsGrid
```

## Monitoreo

### Logs de Activación

```typescript
// El sistema registra automáticamente cuando se activa/desactiva un flag
console.log('Feature flag changed:', {
  flagId: CATEGORY_SELECTOR_FLAGS.SUGGESTIONS,
  enabled: true,
  rolloutPercentage: 50,
});
```

### Métricas Recomendadas

- Tasa de adopción por feature
- Errores por feature
- Tiempo de selección con/sin features
- Satisfacción del usuario

## Desactivación de Emergencia

Si una feature causa problemas en producción:

```typescript
// Desactivar inmediatamente
featureFlagsService.setFlag({
  id: CATEGORY_SELECTOR_FLAGS.PROBLEMATIC_FEATURE,
  enabled: false,
  rolloutPercentage: 0,
}, 'category-selector-module');
```

O mediante variable de entorno y redeploy rápido:

```bash
NEXT_PUBLIC_FEATURE_PROBLEMATIC=false
```

## Testing

### Test con Feature Habilitada

```typescript
import { featureFlagsService } from '@/lib/config/feature-flags';

beforeEach(() => {
  featureFlagsService.setFlag({
    id: CATEGORY_SELECTOR_FLAGS.SMART_SEARCH,
    enabled: true,
    rolloutPercentage: 100,
  }, 'test');
});

test('search works when enabled', () => {
  // ...
});
```

### Test con Feature Deshabilitada

```typescript
beforeEach(() => {
  featureFlagsService.setFlag({
    id: CATEGORY_SELECTOR_FLAGS.SMART_SEARCH,
    enabled: false,
  }, 'test');
});

test('fallback works when disabled', () => {
  // ...
});
```

## Mejores Prácticas

1. **Rollout Gradual**: Siempre empezar con porcentajes bajos (10-25%)
2. **Monitoreo**: Vigilar métricas y errores durante rollout
3. **Documentación**: Documentar razón y fecha de cada cambio de flag
4. **Limpieza**: Remover flags cuando feature esté 100% estable
5. **Testing**: Probar tanto con feature habilitada como deshabilitada
6. **Fallback**: Siempre tener un fallback funcional

## Recursos

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Guía completa de desarrollo
- [README.md](./README.md) - Visión general del módulo
- Código: `config/feature-flags.ts`
