# Plan de Despliegue - Category Selection

## Resumen Ejecutivo

Este documento describe el plan de despliegue incremental para el módulo de selección de categorías mejorado, diseñado para minimizar riesgos y permitir rollback rápido si es necesario.

## Estrategia de Despliegue

**Tipo:** Rollout gradual con feature flags  
**Duración estimada:** 14 días  
**Rollback:** Inmediato mediante feature flags

## Pre-requisitos

### Técnicos

- ✅ Código desplegado en producción (con flags deshabilitados)
- ✅ Base de datos migrada (tabla `category_analytics`)
- ✅ Feature flags inicializados
- ✅ Tests pasando (unit, integration, e2e)
- ✅ Monitoreo configurado (logs, métricas, errores)

### Operacionales

- ✅ Equipo de soporte notificado
- ✅ Documentación de usuario actualizada
- ✅ Plan de rollback documentado
- ✅ Ventana de mantenimiento programada (si necesario)

## Fases de Despliegue

### Fase 0: Preparación (Día -2 a 0)

**Objetivo:** Desplegar código a producción con todas las features deshabilitadas.

**Acciones:**

1. Merge de código a rama principal
2. Deploy a staging para validación final
3. Ejecutar suite completa de tests
4. Deploy a producción con flags deshabilitados
5. Verificar que selector legacy sigue funcionando

**Criterios de éxito:**

- ✅ Deploy exitoso sin errores
- ✅ Selector legacy funciona normalmente
- ✅ No hay regresiones en funcionalidad existente

**Rollback:** Revert del deploy si hay problemas

---

### Fase 1: Testing Interno (Día 1-3)

**Objetivo:** Validar funcionalidad con equipo interno.

**Usuarios afectados:** Solo ADMIN y DEVELOPER (≈5-10 usuarios)

**Features habilitadas:**
- ✅ `enhanced_category_selector`
- ✅ `category_smart_search`
- ✅ `category_suggestions`
- ✅ `category_frequent`
- ✅ `category_step_by_step`
- ✅ `category_knowledge_base`
- ✅ `category_visual_enhancements`
- ✅ `category_analytics`

**Configuración:**

```typescript
// Todas las features al 100% solo para ADMIN/DEVELOPER
rolloutPercentage: 100,
conditions: [
  { type: 'user_role', operator: 'in', value: ['ADMIN', 'DEVELOPER'] }
]
```

**Métricas a monitorear:**

- Errores en logs
- Tiempo de carga del componente
- Tiempo de selección de categoría
- Feedback del equipo interno

**Criterios de éxito:**

- ✅ Cero errores críticos
- ✅ Tiempo de carga < 500ms
- ✅ Feedback positivo del equipo
- ✅ Todas las features funcionan correctamente

**Rollback:** Deshabilitar `enhanced_category_selector`

---

### Fase 2: Beta Testing (Día 4-7)

**Objetivo:** Validar con usuarios reales en ambiente controlado.

**Usuarios afectados:** 10% de usuarios CLIENT (≈50-100 usuarios)

**Features habilitadas:** Todas

**Configuración:**

```typescript
rolloutPercentage: 10,
conditions: [
  { type: 'user_role', operator: 'equals', value: 'CLIENT' }
]
```

**Métricas a monitorear:**

- Tasa de error
- Tiempo promedio de selección
- Tasa de uso de cada feature:
  - % que usa búsqueda
  - % que usa sugerencias
  - % que usa categorías frecuentes
- Búsquedas sin resultados
- Cambios de categoría después de selección
- Feedback de usuarios (si disponible)

**Criterios de éxito:**

- ✅ Tasa de error < 1%
- ✅ Tiempo de selección ≤ tiempo actual
- ✅ Al menos 30% usa búsqueda o sugerencias
- ✅ < 5% de búsquedas sin resultados
- ✅ No hay quejas de usuarios

**Rollback:** Reducir a 0% o deshabilitar flag principal

---

### Fase 3: Rollout Gradual (Día 8-14)

**Objetivo:** Expandir gradualmente a todos los usuarios.

#### Día 8: 25% de usuarios CLIENT

```typescript
rolloutPercentage: 25
```

**Monitoreo:** Revisar métricas cada 4 horas

**Criterios para continuar:**
- Tasa de error < 1%
- No hay degradación de rendimiento
- Métricas de uso positivas

---

#### Día 10: 50% de usuarios CLIENT

```typescript
rolloutPercentage: 50
```

**Monitoreo:** Revisar métricas cada 6 horas

**Criterios para continuar:**
- Tasa de error < 1%
- Tiempo de selección estable o mejor
- Feedback positivo o neutral

---

#### Día 12: 75% de usuarios CLIENT

```typescript
rolloutPercentage: 75
```

**Monitoreo:** Revisar métricas cada 8 horas

**Criterios para continuar:**
- Sin problemas reportados
- Métricas estables

---

#### Día 14: 100% de usuarios

```typescript
rolloutPercentage: 100,
conditions: []  // Sin restricciones
```

**Monitoreo:** Revisar métricas diariamente por 1 semana

---

### Fase 4: Estabilización (Día 15-21)

**Objetivo:** Monitorear estabilidad y optimizar basándose en datos.

**Acciones:**

1. Analizar datos de analytics recopilados
2. Identificar patrones de uso
3. Identificar problemas de UX
4. Optimizar basándose en datos
5. Documentar lecciones aprendidas

**Métricas a analizar:**

- Distribución de métodos de selección:
  - % búsqueda
  - % sugerencias
  - % manual
  - % frecuentes
- Categorías más buscadas
- Búsquedas sin resultados (para mejorar keywords)
- Tiempo promedio de selección por método
- Categorías con baja confianza
- Artículos de KB más vistos

---

### Fase 5: Limpieza (Día 22+)

**Objetivo:** Remover código legacy y flags innecesarios.

**Acciones:**

1. Remover selector legacy (CategorySelectorFallback)
2. Remover flags de features (mantener solo flag principal si necesario)
3. Simplificar código
4. Actualizar documentación
5. Archivar este plan de despliegue

---

## Plan de Rollback

### Rollback Inmediato (< 5 minutos)

**Cuándo:** Error crítico que afecta funcionalidad principal

**Acción:**

```typescript
// Deshabilitar flag principal
featureFlagsService.setFlag({
  id: CATEGORY_SELECTOR_FLAGS.ENHANCED_SELECTOR,
  enabled: false,
}, 'category-selector-module');
```

**Resultado:** Todos los usuarios vuelven al selector legacy inmediatamente

---

### Rollback Parcial (< 10 minutos)

**Cuándo:** Una feature específica causa problemas

**Acción:**

```typescript
// Deshabilitar solo la feature problemática
featureFlagsService.setFlag({
  id: CATEGORY_SELECTOR_FLAGS.PROBLEMATIC_FEATURE,
  enabled: false,
}, 'category-selector-module');
```

**Resultado:** Feature específica se deshabilita, resto sigue funcionando

---

### Rollback Gradual (< 30 minutos)

**Cuándo:** Problemas menores pero preocupantes

**Acción:**

```typescript
// Reducir porcentaje gradualmente
rolloutPercentage: 50  // De 75% a 50%
rolloutPercentage: 25  // De 50% a 25%
rolloutPercentage: 10  // De 25% a 10%
rolloutPercentage: 0   // De 10% a 0%
```

**Resultado:** Reducción gradual de usuarios afectados

---

## Monitoreo y Alertas

### Métricas Críticas

**Errores:**
- Tasa de error > 1% → Alerta
- Tasa de error > 5% → Rollback inmediato

**Rendimiento:**
- Tiempo de carga > 1s → Investigar
- Tiempo de carga > 2s → Alerta

**Uso:**
- 0% uso de búsqueda/sugerencias → Investigar UX
- > 10% búsquedas sin resultados → Mejorar keywords

### Herramientas de Monitoreo

- **Logs:** CloudWatch / Datadog / Sentry
- **Métricas:** Analytics dashboard
- **Errores:** Error tracking (Sentry)
- **Rendimiento:** Web Vitals, Lighthouse

### Alertas Configuradas

```typescript
// Ejemplo de configuración de alertas
{
  "error_rate": {
    "threshold": 0.01,  // 1%
    "action": "notify_team"
  },
  "critical_error_rate": {
    "threshold": 0.05,  // 5%
    "action": "auto_rollback"
  },
  "load_time": {
    "threshold": 2000,  // 2s
    "action": "notify_team"
  }
}
```

---

## Comunicación

### Equipo Interno

**Antes del despliegue:**
- Notificar a equipo de desarrollo
- Notificar a equipo de soporte
- Notificar a product managers

**Durante el despliegue:**
- Updates diarios en canal de Slack
- Reporte de métricas en cada fase

**Después del despliegue:**
- Reporte final con lecciones aprendidas
- Documentación actualizada

### Usuarios

**Antes del despliegue:**
- Anuncio de nueva funcionalidad (opcional)
- Actualización de documentación de ayuda

**Durante el despliegue:**
- No se requiere comunicación (cambio transparente)

**Después del despliegue:**
- Solicitar feedback (opcional)
- Anuncio de features disponibles

---

## Checklist de Despliegue

### Pre-despliegue

- [ ] Tests pasando (unit, integration, e2e)
- [ ] Code review completado
- [ ] Documentación actualizada
- [ ] Feature flags configurados
- [ ] Monitoreo configurado
- [ ] Equipo notificado
- [ ] Plan de rollback revisado

### Durante despliegue

- [ ] Deploy a staging exitoso
- [ ] Validación en staging
- [ ] Deploy a producción
- [ ] Verificación post-deploy
- [ ] Fase 1 completada (testing interno)
- [ ] Fase 2 completada (beta testing)
- [ ] Fase 3 completada (rollout gradual)

### Post-despliegue

- [ ] Monitoreo de métricas
- [ ] Análisis de datos
- [ ] Optimizaciones implementadas
- [ ] Documentación finalizada
- [ ] Código legacy removido
- [ ] Lecciones aprendidas documentadas

---

## Contactos de Emergencia

**Equipo de Desarrollo:**
- Lead Developer: [nombre] - [email] - [teléfono]
- Backend Developer: [nombre] - [email] - [teléfono]
- Frontend Developer: [nombre] - [email] - [teléfono]

**Equipo de Operaciones:**
- DevOps Lead: [nombre] - [email] - [teléfono]
- SRE: [nombre] - [email] - [teléfono]

**Escalación:**
- Engineering Manager: [nombre] - [email] - [teléfono]
- CTO: [nombre] - [email] - [teléfono]

---

## Recursos Adicionales

- [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) - Documentación de feature flags
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Guía de desarrollo
- [README.md](./README.md) - Visión general del módulo
- Dashboard de métricas: [URL]
- Logs: [URL]
- Error tracking: [URL]
