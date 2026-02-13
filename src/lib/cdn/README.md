# CDN y Optimización de Assets

Sistema completo de optimización de assets estáticos con soporte para CDN, compresión, caché y monitoreo de rendimiento.

## Componentes

### 1. AssetOptimizer (`asset-optimizer.ts`)
Servicio principal para optimización de assets con:
- Configuración de CDN
- Compresión gzip/brotli
- Minificación de CSS
- Generación de WebP
- Headers de caché optimizados
- Preload de assets críticos

### 2. StaticAssetMiddleware (`static-asset-middleware.ts`)
Middleware para manejo de assets estáticos:
- Detección automática de assets
- Headers de compresión
- Service Worker para caché
- Preload de CSS crítico

### 3. CDN Image Loader (`image-loader.ts`)
Loader personalizado para Next.js Image:
- Integración con CDN
- Optimización automática de imágenes
- Soporte para WebP/AVIF
- Responsive srcsets
- Preload de imágenes críticas

### 4. Service Worker API (`/api/sw/route.ts`)
Endpoint para servir el service worker:
- Caché de assets estáticos
- Estrategias de caché
- Limpieza automática

## Configuración

### Variables de Entorno

```bash
# CDN Configuration
CDN_ENABLED=true
CDN_BASE_URL=https://cdn.tu-dominio.com

# Asset Optimization
ASSET_COMPRESSION_ENABLED=true
ASSET_MINIFICATION_ENABLED=true
ASSET_CACHE_MAX_AGE=31536000

# Image Optimization
IMAGE_OPTIMIZATION_ENABLED=true
IMAGE_WEBP_ENABLED=true
IMAGE_AVIF_ENABLED=true
IMAGE_DEFAULT_QUALITY=75
```

### Next.js Configuration

El sistema se integra automáticamente con `next.config.ts`:

```typescript
// CDN loader personalizado
loader: process.env.CDN_ENABLED === 'true' ? 'custom' : 'default',
loaderFile: './src/lib/cdn/image-loader.ts',

// Asset prefix para CDN
assetPrefix: process.env.CDN_ENABLED === 'true' ? process.env.CDN_BASE_URL : undefined,
```

## Uso

### Optimización de Assets

```typescript
import { AssetOptimizer } from '@/lib/cdn/asset-optimizer'

// Obtener URL optimizada
const optimizedUrl = AssetOptimizer.getAssetUrl('/images/hero.jpg', {
  width: 800,
  height: 600,
  quality: 80,
  format: 'webp'
})

// Generar headers de caché
const headers = AssetOptimizer.getCacheHeaders('/css/app.css')

// Comprimir contenido
const { compressed, metrics } = await AssetOptimizer.compressAsset(buffer, 'gzip')
```

### Imágenes Optimizadas

```typescript
import Image from 'next/image'
import { getOptimizedImageProps } from '@/lib/cdn/image-loader'

// Props optimizadas automáticamente
const imageProps = getOptimizedImageProps('/images/hero.jpg', 'Hero image', {
  width: 800,
  height: 600,
  priority: true
})

// Uso en componente
<Image {...imageProps} />
```

### Middleware de Assets

```typescript
import { createAssetMiddleware } from '@/lib/cdn/static-asset-middleware'

// En middleware.ts
const assetMiddleware = createAssetMiddleware({
  enableCompression: true,
  enableCaching: true,
  maxAge: 31536000
})
```

## Características

### ✅ Optimización de Rendimiento
- Compresión gzip/brotli automática
- Minificación de CSS
- Caché inteligente con headers optimizados
- Preload de assets críticos
- Lazy loading de imágenes

### ✅ Soporte CDN
- Configuración flexible de CDN
- Fallback automático sin CDN
- Optimización de parámetros de imagen
- Asset prefix para producción

### ✅ Formatos de Imagen Modernos
- Conversión automática a WebP/AVIF
- Detección de soporte del navegador
- Responsive srcsets
- Placeholders blur automáticos

### ✅ Monitoreo y Logging
- Métricas de compresión
- Tiempos de carga
- Detección de assets lentos/grandes
- Logging estructurado con ApplicationLogger

### ✅ Service Worker
- Caché automático de assets estáticos
- Estrategias de caché configurables
- Limpieza automática de caché obsoleto

## Métricas y Monitoreo

El sistema registra automáticamente:
- Ratios de compresión
- Tiempos de optimización
- Hits/misses de caché
- Assets problemáticos (>1MB, >1s carga)
- Configuración de CDN

## Integración con Sistema Existente

El sistema se integra perfectamente con:
- ✅ Sistema de logging estructurado
- ✅ Middleware de Next.js
- ✅ Configuración de entorno
- ✅ Tests automatizados
- ✅ Docker y producción

## Estado de Implementación

- ✅ AssetOptimizer completo
- ✅ StaticAssetMiddleware implementado
- ✅ CDN Image Loader funcional
- ✅ Service Worker API creado
- ✅ Configuración Next.js actualizada
- ✅ Variables de entorno documentadas
- ✅ Tests de integración
- ✅ Documentación completa

**Tarea 6.5 - CDN y Optimización de Assets: ✅ COMPLETADA**