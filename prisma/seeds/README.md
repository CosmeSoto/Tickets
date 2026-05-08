# 📦 Seeds Modulares

Este directorio contiene los seeds modulares del proyecto, organizados por funcionalidad para mejor mantenibilidad.

## 📁 Estructura

```
prisma/
├── seed.ts                      # Seed principal (1,063 líneas)
└── seeds/
    ├── categories.seed.ts       # Categorías de tickets (1,247 líneas)
    ├── custom-fields.seed.ts    # Campos personalizados (274 líneas)
    ├── inventory-types.seed.ts  # Tipos de inventario (329 líneas)
    └── README.md               # Este archivo
```

## 🎯 Módulos Disponibles

### 1. categories.seed.ts

Gestiona todas las categorías de tickets del sistema.

**Funciones exportadas:**

- `seedCategories(prisma, deptMap)` - Categorías de Tecnología
- `seedCategoriesOtherFamilies(prisma, deptMap)` - Categorías de otras familias

**Contenido:**

- 5 departamentos de Tecnología con jerarquía N1 → N2 → N3
- Categorías para Mantenimiento (Civil, Eléctrico, Mecánico)
- Categorías para Seguridad Física
- Categorías para Servicios (Limpieza, Mensajería)
- Categorías para Gestión Administrativa

**Uso:**

```typescript
import { seedCategories, seedCategoriesOtherFamilies } from './seeds/categories.seed'

await seedCategories(prisma, deptMap)
await seedCategoriesOtherFamilies(prisma, deptMap)
```

### 2. custom-fields.seed.ts

Define campos personalizados para diferentes familias de activos.

**Función exportada:**

- `seedCustomFields(prisma, familyMap)` - Crea 16 campos personalizados

**Contenido:**

- **Tecnología** (5 campos): procesador, ram, almacenamiento, sistema_operativo, tipo_disco
- **Activos Fijos** (4 campos): año_construcción, área_m2, estado_conservación, ubicación_física
- **Mantenimiento** (4 campos): frecuencia_mantenimiento, última_revisión, próxima_revisión, tipo_mantenimiento
- **Seguridad** (3 campos): nivel_seguridad, certificación, zona_cobertura

**Uso:**

```typescript
import { seedCustomFields } from './seeds/custom-fields.seed'

await seedCustomFields(prisma, familyMap)
```

### 3. inventory-types.seed.ts

Crea todos los tipos de inventario del sistema.

**Funciones exportadas:**

- `seedInventoryTypes(prisma, familyMap)` - Función principal (wrapper)
- `seedEquipmentTypes(prisma, familyMap)` - 33 tipos de equipo
- `seedLicenseTypes(prisma, familyMap)` - 16 tipos de licencia
- `seedConsumableTypes(prisma, familyMap)` - 17 tipos de consumible

**Contenido:**

- **Equipos** (33): laptops, desktops, monitores, impresoras, cámaras, herramientas, etc.
- **Licencias** (16): Windows, Office 365, contratos de mantenimiento, seguros, etc.
- **Consumibles** (17): tóner, papel, repuestos, productos de limpieza, fertilizantes, etc.

**Uso:**

```typescript
import { seedInventoryTypes } from './seeds/inventory-types.seed'

// Opción 1: Usar la función wrapper (recomendado)
await seedInventoryTypes(prisma, familyMap)

// Opción 2: Usar funciones individuales
import {
  seedEquipmentTypes,
  seedLicenseTypes,
  seedConsumableTypes,
} from './seeds/inventory-types.seed'

await seedEquipmentTypes(prisma, familyMap)
await seedLicenseTypes(prisma, familyMap)
await seedConsumableTypes(prisma, familyMap)
```

## 🚀 Ejecutar el Seed

### Desarrollo

```bash
npm run prisma:seed
```

### Producción

```bash
npx prisma db seed
```

### Desde Docker

```bash
docker-compose exec app npm run prisma:seed
```

## 📊 Métricas

| Métrica                         | Valor              |
| ------------------------------- | ------------------ |
| **Líneas originales (seed.ts)** | 2,579              |
| **Líneas actuales (seed.ts)**   | 1,063              |
| **Reducción**                   | 1,516 líneas (58%) |
| **Total en módulos**            | 1,850 líneas       |
| **Archivos modulares**          | 3                  |

## ✨ Beneficios de la Modularización

1. **Mantenibilidad**: Cada módulo es independiente y fácil de mantener
2. **Legibilidad**: Archivos más pequeños y enfocados en una sola responsabilidad
3. **Reutilización**: Las funciones pueden ser importadas y usadas individualmente
4. **Escalabilidad**: Fácil agregar nuevos módulos sin afectar el seed principal
5. **Testing**: Cada módulo puede ser probado de forma independiente
6. **Colaboración**: Múltiples desarrolladores pueden trabajar en diferentes módulos sin conflictos

## 🔧 Agregar un Nuevo Módulo

1. Crear archivo en `prisma/seeds/nombre-modulo.seed.ts`
2. Exportar las funciones necesarias
3. Importar en `prisma/seed.ts`
4. Llamar la función en el orden correcto dentro de `main()`

**Ejemplo:**

```typescript
// prisma/seeds/mi-modulo.seed.ts
import { PrismaClient } from '@prisma/client'

export async function seedMiModulo(prisma: PrismaClient) {
  console.log('🎯 Creando datos de mi módulo...')

  // Tu lógica aquí

  console.log('✅ Mi módulo creado')
}
```

```typescript
// prisma/seed.ts
import { seedMiModulo } from './seeds/mi-modulo.seed'

async function main() {
  // ... otros seeds
  await seedMiModulo(prisma)
  // ... más seeds
}
```

## 📝 Convenciones

- Usar nombres descriptivos en snake_case para archivos: `nombre-modulo.seed.ts`
- Exportar funciones con prefijo `seed`: `seedNombreModulo()`
- Pasar `prisma` como primer parámetro siempre
- Incluir mensajes de consola con emojis para mejor UX
- Documentar el contenido y propósito de cada módulo

## 🐛 Troubleshooting

### Error: "Cannot find module './seeds/...'"

Verifica que el archivo existe y la ruta de import es correcta.

### Error: "Expected X arguments, but got Y"

Asegúrate de pasar todos los parámetros requeridos (prisma, familyMap, deptMap, etc.)

### Seed no crea datos

Verifica que:

1. La base de datos está accesible
2. Las migraciones están aplicadas: `npx prisma migrate dev`
3. No hay errores en la consola

## 📚 Referencias

- [Prisma Seeding](https://www.prisma.io/docs/guides/database/seed-database)
- [TypeScript Modules](https://www.typescriptlang.org/docs/handbook/modules.html)
