# Instrucciones para Reconstruir Contenedores desde Cero

Este documento contiene las instrucciones para reconstruir completamente los contenedores Docker y la base de datos desde cero, eliminando todos los datos antiguos y duplicados.

## ⚠️ ADVERTENCIA

Este proceso **eliminará TODOS los datos** de la base de datos. Solo ejecutar en desarrollo.

## 📋 Pasos para Reconstruir

### 1. Detener y Eliminar Contenedores Actuales

```bash
# Detener todos los contenedores
docker-compose -f docker-compose.dev.yml down

# Eliminar volúmenes (esto borra la base de datos)
docker-compose -f docker-compose.dev.yml down -v

# Verificar que no queden contenedores
docker ps -a | grep tickets
```

### 2. Limpiar Imágenes y Caché (Opcional pero Recomendado)

```bash
# Eliminar imágenes del proyecto
docker images | grep tickets | awk '{print $3}' | xargs docker rmi -f

# Limpiar caché de Docker
docker system prune -a --volumes
```

### 3. Reconstruir Contenedores

```bash
# Reconstruir desde cero
docker-compose -f docker-compose.dev.yml up --build -d

# Ver logs para verificar que todo está corriendo
docker-compose -f docker-compose.dev.yml logs -f
```

### 4. Verificar que los Servicios Están Corriendo

```bash
# Verificar estado de los contenedores
docker-compose -f docker-compose.dev.yml ps

# Deberías ver:
# - tickets-postgres-dev (healthy)
# - tickets-redis-dev (healthy)
# - tickets-app-dev (running)
# - tickets-nginx-dev (running)
```

### 5. Ejecutar Migraciones y Seed

El seed se ejecuta automáticamente al iniciar el contenedor de la app. Si necesitas ejecutarlo manualmente:

```bash
# Entrar al contenedor de la app
docker-compose -f docker-compose.dev.yml exec app sh

# Ejecutar migraciones
npx prisma migrate deploy

# Ejecutar seed
npx prisma db seed

# Salir del contenedor
exit
```

### 6. Verificar los Datos

```bash
# Conectarse a la base de datos
docker-compose -f docker-compose.dev.yml exec postgres psql -U tickets_user -d tickets_db

# Verificar atributos de Laptop (no debe haber duplicados)
SELECT attribute_name, attribute_label, "order"
FROM equipment_type_attributes
WHERE equipment_type_id = (
  SELECT id FROM equipment_types WHERE name = 'Laptop' LIMIT 1
)
ORDER BY "order";

# Salir de psql
\q
```

## ✅ Resultado Esperado

Después de la reconstrucción, deberías tener:

- **Base de datos limpia** sin duplicados
- **Atributos consistentes** en español:
  - `marca`, `modelo`, `numero_serie`, `procesador`, `ram`, etc.
- **Orden correcto** de atributos (1, 2, 3, 4...)
- **Sin errores** en la interfaz de gestión de atributos

## 🔧 Cambios Realizados en el Seed

### Antes (Inglés - Inconsistente)

```typescript
attributeName: 'processor'
attributeName: 'storage'
attributeName: 'screen_size'
```

### Después (Español - Consistente)

```typescript
attributeName: 'procesador'
attributeName: 'almacenamiento'
attributeName: 'pantalla_pulgadas'
```

## 📝 Notas Importantes

1. **Nombres de atributos en español**: Todos los `attributeName` ahora usan snake_case en español
2. **Labels descriptivos**: Los `attributeLabel` son amigables para el usuario
3. **Orden secuencial**: Los atributos tienen orden 1, 2, 3, 4... sin duplicados
4. **Upsert mejorado**: El seed ahora actualiza correctamente los atributos existentes

## 🐛 Solución de Problemas

### Si siguen apareciendo duplicados:

1. Verificar que el seed se ejecutó correctamente:

```bash
docker-compose -f docker-compose.dev.yml logs app | grep "Seed de atributos"
```

2. Verificar la base de datos directamente:

```bash
docker-compose -f docker-compose.dev.yml exec postgres psql -U tickets_user -d tickets_db -c "SELECT COUNT(*) FROM equipment_type_attributes;"
```

3. Si es necesario, ejecutar el seed manualmente:

```bash
docker-compose -f docker-compose.dev.yml exec app npx prisma db seed
```

### Si hay errores de conexión:

1. Verificar que los servicios están healthy:

```bash
docker-compose -f docker-compose.dev.yml ps
```

2. Reiniciar los contenedores:

```bash
docker-compose -f docker-compose.dev.yml restart
```

## 📚 Archivos Modificados

- ✅ `prisma/seeds/attributes.seed.ts` - Corregido con nombres en español
- 🗑️ `prisma/scripts/clean-duplicate-attributes.ts` - Eliminado (obsoleto)
- 🗑️ `prisma/scripts/migrate-custom-fields-to-attributes.ts` - Eliminado (obsoleto)
- 🗑️ `prisma/scripts/migrate-units-to-attributes.ts` - Eliminado (obsoleto)
- 🗑️ `prisma/scripts/validate-migration.ts` - Eliminado (obsoleto)
- 🗑️ `backups/migration-*.json` - Eliminados (obsoletos)

## 🎯 Próximos Pasos

Después de reconstruir, puedes:

1. Acceder a la aplicación en `http://localhost:3000`
2. Ir a **Configuración → Inventario → Catálogos**
3. Seleccionar un tipo (ej: Laptop)
4. Hacer clic en "Gestionar Atributos"
5. Verificar que no hay duplicados y el orden es correcto
