# OAuth Configuration Fix - Solución del Error 500

## 🔍 Problema Identificado

El endpoint `/api/admin/oauth-config` estaba retornando un error 500 al intentar cargar las configuraciones OAuth. 

### Causas Raíz:

1. **Falta de ENCRYPTION_KEY**: La variable de entorno `ENCRYPTION_KEY` no estaba configurada en `.env.local`
2. **Manejo de array vacío**: El código no manejaba correctamente el caso cuando no hay configuraciones OAuth en la base de datos
3. **Error en el masking del secret**: Intentaba hacer `.slice(-4)` en un string que podría estar vacío

## ✅ Soluciones Aplicadas

### 1. Agregada ENCRYPTION_KEY a .env.local

```bash
# Encryption Key for OAuth Credentials
ENCRYPTION_KEY="MGZykJSDK3DDnCTMh5w0bJ5+7+syOXYW64Z0IAzwczk="
```

Esta clave se generó usando:
```bash
openssl rand -base64 32
```

### 2. Mejorado el manejo de configuraciones vacías

```typescript
// Si no hay configuraciones, retornar array vacío
if (!configs || configs.length === 0) {
  return NextResponse.json({
    success: true,
    data: []
  })
}
```

### 3. Simplificado el masking del client secret

```typescript
clientSecret: config.clientSecret ? '••••••••' : '',
```

### 4. Agregado mejor logging de errores

```typescript
console.error('Error details:', {
  message: error instanceof Error ? error.message : 'Unknown error',
  stack: error instanceof Error ? error.stack : undefined,
  encryptionKeySet: !!process.env.ENCRYPTION_KEY
})
```

## 🧪 Cómo Probar la Solución

### Opción 1: Desde la UI (Recomendado)

1. **Reinicia el servidor de desarrollo** (importante para cargar la nueva variable de entorno):
   ```bash
   # Detén el servidor actual (Ctrl+C)
   # Luego inicia nuevamente:
   npm run dev
   ```

2. **Inicia sesión como ADMIN**:
   - Ve a http://localhost:3000/login
   - Usa credenciales de administrador

3. **Accede a Configuraciones**:
   - Click en "Configuración" en el sidebar
   - Selecciona la pestaña "OAuth"

4. **Verifica que carga sin errores**:
   - Deberías ver los formularios de Google y Microsoft OAuth
   - No debería haber errores 500
   - Los campos deberían estar vacíos (primera vez)

### Opción 2: Prueba Manual con Script

```bash
# Ejecutar el script de prueba
node test-oauth-config.js
```

Deberías ver:
```
✅ ENCRYPTION_KEY is set
✅ Database connected
✅ Found 0 OAuth configs
✅ All tests passed!
```

### Opción 3: Prueba del API Endpoint

```bash
# Ejecutar el script de prueba del API
bash test-oauth-api.sh
```

## 📝 Configurar OAuth Providers

Una vez que el sistema esté funcionando, puedes configurar los proveedores OAuth:

### Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona uno existente
3. Habilita "Google+ API"
4. Ve a "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth 2.0"
5. Configura:
   - Tipo de aplicación: Aplicación web
   - Orígenes autorizados: `http://localhost:3000`
   - URIs de redirección: `http://localhost:3000/api/auth/callback/google`
6. Copia el Client ID y Client Secret
7. Pégalos en la UI de configuración OAuth

### Microsoft OAuth

1. Ve a [Azure Portal](https://portal.azure.com/)
2. Ve a "Azure Active Directory" → "Registros de aplicaciones"
3. Click en "Nuevo registro"
4. Configura:
   - Nombre: Tu aplicación
   - Tipos de cuenta compatibles: Cuentas en cualquier directorio organizativo y cuentas personales de Microsoft
   - URI de redirección: Web → `http://localhost:3000/api/auth/callback/azure-ad`
5. Copia el "Id. de aplicación (cliente)"
6. Ve a "Certificados y secretos" → "Nuevo secreto de cliente"
7. Copia el valor del secreto (solo se muestra una vez)
8. Pégalos en la UI de configuración OAuth

## 🔐 Seguridad

- ✅ Los Client Secrets se encriptan usando AES-256-CBC antes de guardarse en la base de datos
- ✅ La clave de encriptación (`ENCRYPTION_KEY`) nunca se expone al cliente
- ✅ Los secrets nunca se muestran completos en la UI (solo se muestra `••••••••`)
- ✅ Solo usuarios con rol ADMIN pueden acceder a estas configuraciones

## 🚀 Próximos Pasos

1. **Reiniciar el servidor** para cargar la nueva variable de entorno
2. **Probar la UI** de configuración OAuth
3. **Configurar Google OAuth** (opcional)
4. **Configurar Microsoft OAuth** (opcional)
5. **Habilitar los proveedores** que desees usar
6. **Probar el registro** con cuentas de Google/Microsoft

## 📚 Archivos Modificados

- ✅ `sistema-tickets-nextjs/.env.local` - Agregada ENCRYPTION_KEY
- ✅ `sistema-tickets-nextjs/src/app/api/admin/oauth-config/route.ts` - Mejorado manejo de errores
- ✅ `sistema-tickets-nextjs/test-oauth-config.js` - Script de prueba creado
- ✅ `sistema-tickets-nextjs/test-oauth-api.sh` - Script de prueba del API creado

## ⚠️ Importante

**DEBES REINICIAR EL SERVIDOR** para que Next.js cargue la nueva variable de entorno `ENCRYPTION_KEY`. Sin esto, el API seguirá fallando.

```bash
# Detén el servidor actual
Ctrl+C

# Inicia nuevamente
npm run dev
```

## 🐛 Troubleshooting

### Error: "ENCRYPTION_KEY not found"
- Verifica que `.env.local` tenga la variable `ENCRYPTION_KEY`
- Reinicia el servidor de desarrollo

### Error: "Unable to acquire lock"
- Hay otra instancia de Next.js corriendo
- Encuentra y mata el proceso: `lsof -ti:3000 | xargs kill -9`

### Error 401: "No autorizado"
- Asegúrate de estar logueado como ADMIN
- Verifica que tu sesión sea válida

### Error 500 persiste
- Revisa los logs del servidor en la terminal
- Ejecuta `node test-oauth-config.js` para verificar la configuración
- Verifica que Prisma esté actualizado: `npx prisma generate`

## ✨ Resultado Esperado

Después de aplicar estos cambios y reiniciar el servidor:

1. ✅ La pestaña OAuth en Configuración carga sin errores
2. ✅ Puedes guardar configuraciones de Google y Microsoft
3. ✅ Los secrets se encriptan correctamente en la base de datos
4. ✅ Puedes habilitar/deshabilitar proveedores
5. ✅ Los botones de OAuth aparecen en login/register cuando están habilitados
