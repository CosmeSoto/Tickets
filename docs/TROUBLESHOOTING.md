# Solución de Problemas

## Base de Datos

### Error de conexión a PostgreSQL
```
Error: Can't reach database server at `localhost:5432`
```
Verificar que Docker esté corriendo:
```bash
docker-compose ps
docker-compose up -d
```

### Prisma: campos no reconocidos después de cambiar schema
```bash
npx prisma generate    # Regenerar cliente
```
Si el IDE sigue mostrando errores, reiniciar TypeScript Server (Cmd+Shift+P → "TypeScript: Restart TS Server").

### Resetear BD completamente
```bash
docker-compose down -v          # Eliminar volúmenes
docker-compose up -d            # Recrear contenedores
npx prisma db push              # Crear tablas
npm run db:seed                 # Cargar datos iniciales
```

### Error "relation does not exist"
El schema no está sincronizado con la BD:
```bash
npx prisma db push
```

## Next.js

### Error 500 en API routes
Revisar la consola del servidor (terminal donde corre `npm run dev`). Los errores comunes:
- Zod validation: datos del request no cumplen el schema
- Prisma: campo no existe en la BD (ejecutar `npx prisma db push`)
- Auth: sesión expirada o no autenticado

### Params en route handlers (Next.js 16+)
En Next.js 16, `params` es una Promise y debe ser awaited:
```typescript
// ✅ Correcto
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}

// ❌ Incorrecto (versiones anteriores)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
}
```

### Build falla por errores de tipos
El build usa `SKIP_TYPE_CHECK=true` por defecto. Si necesitas verificar tipos:
```bash
npx tsc --noEmit
```

## Docker

### Puerto 5432 ya en uso
Otro servicio PostgreSQL está corriendo localmente:
```bash
# macOS
lsof -i :5432
# Detener el servicio local o cambiar el puerto en docker-compose.yml
```

### pgAdmin no conecta a PostgreSQL
Usar estos datos de conexión en pgAdmin:
- Host: `postgres` (nombre del servicio Docker, no localhost)
- Puerto: `5432`
- Usuario: `tickets_user`
- Password: `tickets_password_2024`
- BD: `tickets_db`

## Inventario

### Consumibles: "Stock insuficiente para realizar la salida"
El movimiento de salida intenta retirar más stock del disponible. Verificar el stock actual del consumible.

### Licencias: clave no se muestra
Las claves de licencia están encriptadas. Se necesita `ENCRYPTION_KEY` configurada en `.env`.

### Alertas de stock bajo no llegan
Verificar en configuración de inventario:
1. `inventory.low_stock_alert_enabled` debe ser `true`
2. Debe haber usuarios con rol ADMIN en el sistema
3. El consumible debe tener `minStock` configurado correctamente
