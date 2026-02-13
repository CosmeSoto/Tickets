# 🎨 Guía: Configuración OAuth desde la Interfaz

## 🎯 Descripción

Ahora puedes configurar Google y Microsoft OAuth **directamente desde el panel de administración**, sin necesidad de editar archivos `.env`. Todo se gestiona de forma visual y segura.

## ✨ Características

✅ **Panel de configuración visual** en el sidebar de admin
✅ **Almacenamiento seguro** de credenciales (encriptadas en base de datos)
✅ **Activar/desactivar** proveedores con un click
✅ **Copiar redirect URIs** con un botón
✅ **Validación en tiempo real** de credenciales
✅ **Sin necesidad de reiniciar** el servidor
✅ **Interfaz profesional** y fácil de usar

## 🚀 Cómo Usar

### Paso 1: Acceder al Panel de Configuración

1. Inicia sesión como **ADMIN**
2. Ve al sidebar y busca **"Configuración OAuth"** o **"OAuth Settings"**
3. O navega directamente a: `http://localhost:3000/admin/oauth-settings`

### Paso 2: Configurar Google OAuth

1. **Obtener credenciales de Google:**
   - Ve a [Google Cloud Console](https://console.cloud.google.com/)
   - Crea un proyecto o selecciona uno existente
   - Ve a **APIs & Services** > **Credentials**
   - Click en **Create Credentials** > **OAuth client ID**
   - Selecciona **Web application**

2. **Configurar en Google:**
   - En el panel de OAuth, copia el **Redirect URI** mostrado
   - Pégalo en **Authorized redirect URIs** en Google Console
   - Guarda y obtén tu **Client ID** y **Client Secret**

3. **Configurar en el Sistema:**
   - Pega el **Client ID** en el campo correspondiente
   - Pega el **Client Secret** en el campo correspondiente
   - Marca la casilla **"Habilitar Google OAuth"**
   - Click en **"Guardar Configuración de Google"**

### Paso 3: Configurar Microsoft OAuth

1. **Obtener credenciales de Microsoft:**
   - Ve a [Azure Portal](https://portal.azure.com/)
   - Busca **Azure Active Directory** o **Microsoft Entra ID**
   - Ve a **App registrations** > **New registration**
   - Registra tu aplicación

2. **Configurar en Azure:**
   - En el panel de OAuth, copia el **Redirect URI** mostrado
   - Pégalo en **Redirect URIs** en Azure Portal
   - Ve a **Certificates & secrets** y crea un **New client secret**
   - Copia el **Application (client) ID** y el **Client Secret**

3. **Configurar en el Sistema:**
   - Pega el **Application (client) ID** en el campo correspondiente
   - Pega el **Client Secret** en el campo correspondiente
   - Configura el **Tenant ID** (usa "common" para cuentas personales y organizacionales)
   - Marca la casilla **"Habilitar Microsoft OAuth"**
   - Click en **"Guardar Configuración de Microsoft"**

### Paso 4: Probar

1. Cierra sesión del sistema
2. Ve a `/register` o `/login`
3. Verás los botones de **"Continuar con Google"** y **"Continuar con Microsoft"**
4. Click en cualquiera para probar
5. Autoriza la aplicación
6. ¡Usuario creado automáticamente como CLIENT!

## 🔒 Seguridad

### Encriptación de Credenciales

- Los **Client Secrets** se encriptan antes de guardarse en la base de datos
- Se usa **AES-256-CBC** para encriptación
- La clave de encriptación se almacena en variable de entorno `ENCRYPTION_KEY`
- Los secrets nunca se muestran completos en la interfaz (solo los últimos 4 caracteres)

### Variables de Entorno Necesarias

Solo necesitas agregar una variable de entorno para la encriptación:

```env
# Clave de encriptación (genera una segura)
ENCRYPTION_KEY="tu-clave-de-32-caracteres-aqui"
```

**Generar clave segura:**
```bash
openssl rand -base64 32
```

## 📊 Base de Datos

### Nueva Tabla: `oauth_configs`

```sql
CREATE TABLE oauth_configs (
  id            TEXT PRIMARY KEY,
  provider      TEXT UNIQUE NOT NULL,  -- 'google' | 'azure-ad'
  clientId      TEXT NOT NULL,
  clientSecret  TEXT NOT NULL,         -- Encriptado
  tenantId      TEXT,                  -- Solo para Azure
  isEnabled     BOOLEAN DEFAULT false,
  redirectUri   TEXT,
  scopes        TEXT,
  createdAt     TIMESTAMP DEFAULT NOW(),
  updatedAt     TIMESTAMP DEFAULT NOW()
);
```

### Migración

```bash
# Crear migración
npx prisma migrate dev --name add_oauth_config

# Aplicar migración
npx prisma migrate deploy
```

## 🎨 Interfaz del Panel

### Sección Google OAuth

- **Redirect URI**: Campo de solo lectura con botón de copiar
- **Client ID**: Campo de texto para pegar el ID de Google
- **Client Secret**: Campo de contraseña con botón de mostrar/ocultar
- **Habilitar**: Checkbox para activar/desactivar
- **Estado**: Badge que muestra si está activo o inactivo
- **Botón Guardar**: Guarda la configuración

### Sección Microsoft OAuth

- **Redirect URI**: Campo de solo lectura con botón de copiar
- **Application (Client) ID**: Campo de texto para pegar el ID de Azure
- **Client Secret**: Campo de contraseña con botón de mostrar/ocultar
- **Tenant ID**: Campo de texto (por defecto "common")
- **Habilitar**: Checkbox para activar/desactivar
- **Estado**: Badge que muestra si está activo o inactivo
- **Botón Guardar**: Guarda la configuración

### Sección de Ayuda

- Enlaces directos a Google Cloud Console y Azure Portal
- Referencia a la documentación completa
- Tips y consejos

## 🔄 Flujo de Configuración

```
Admin → Panel OAuth Settings
    ↓
Configurar Google/Microsoft
    ↓
Guardar credenciales
    ↓
Sistema encripta y almacena en BD
    ↓
Activar proveedor
    ↓
Botones OAuth aparecen en /login y /register
    ↓
Usuarios pueden registrarse con OAuth
```

## 📝 API Endpoints

### GET `/api/admin/oauth-config`
Obtiene todas las configuraciones OAuth (solo ADMIN)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "provider": "google",
      "clientId": "123456789-abc.apps.googleusercontent.com",
      "clientSecret": "••••••••1234",
      "isEnabled": true,
      "updatedAt": "2024-01-20T..."
    }
  ]
}
```

### POST `/api/admin/oauth-config`
Crea o actualiza configuración OAuth (solo ADMIN)

**Request:**
```json
{
  "provider": "google",
  "clientId": "...",
  "clientSecret": "...",
  "isEnabled": true,
  "redirectUri": "http://localhost:3000/api/auth/callback/google",
  "scopes": "openid profile email"
}
```

### PUT `/api/admin/oauth-config`
Activa/desactiva un proveedor (solo ADMIN)

**Request:**
```json
{
  "provider": "google",
  "isEnabled": true
}
```

### DELETE `/api/admin/oauth-config?provider=google`
Elimina configuración OAuth (solo ADMIN)

## ⚠️ Consideraciones Importantes

### Seguridad

1. **Nunca compartas** tu `ENCRYPTION_KEY`
2. **Usa HTTPS** en producción
3. **Rota los secrets** periódicamente
4. **Limita el acceso** al panel de configuración (solo ADMIN)

### Producción

1. **Genera una clave de encriptación segura** para producción
2. **Usa variables de entorno** para `ENCRYPTION_KEY`
3. **Configura redirect URIs** con tu dominio real
4. **Habilita HTTPS** en tu servidor
5. **Monitorea los logs** de autenticación OAuth

### Backup

1. **Exporta las configuraciones** antes de cambios importantes
2. **Guarda los secrets** en un gestor de contraseñas seguro
3. **Documenta** qué proveedores están activos

## 🐛 Troubleshooting

### "Error al guardar configuración"

**Causa:** Problema con la encriptación o base de datos

**Solución:**
1. Verifica que `ENCRYPTION_KEY` esté configurada
2. Verifica que la base de datos esté accesible
3. Revisa los logs del servidor

### "Botones OAuth no aparecen"

**Causa:** Proveedor no está habilitado

**Solución:**
1. Ve al panel de configuración
2. Verifica que el checkbox "Habilitar" esté marcado
3. Guarda la configuración
4. Recarga la página de login/register

### "Redirect URI mismatch"

**Causa:** La URI en el proveedor no coincide con la del sistema

**Solución:**
1. Copia la URI exacta del panel de configuración
2. Pégala en Google Console o Azure Portal
3. Asegúrate de que no haya espacios o caracteres extra

### "Client Secret inválido"

**Causa:** Secret incorrecto o expirado

**Solución:**
1. Genera un nuevo secret en Google/Azure
2. Actualiza la configuración en el panel
3. Guarda los cambios

## 📚 Recursos Adicionales

- **Google OAuth**: https://console.cloud.google.com/
- **Azure Portal**: https://portal.azure.com/
- **NextAuth Docs**: https://next-auth.js.org/
- **Documentación completa**: Ver `OAUTH_SETUP_GUIDE.md`

## ✅ Checklist de Configuración

- [ ] Generar `ENCRYPTION_KEY` y agregarla a `.env.local`
- [ ] Aplicar migración de Prisma
- [ ] Crear proyecto en Google Cloud Console
- [ ] Obtener credenciales de Google
- [ ] Configurar Google en el panel
- [ ] Registrar app en Azure Portal
- [ ] Obtener credenciales de Microsoft
- [ ] Configurar Microsoft en el panel
- [ ] Probar registro con Google
- [ ] Probar registro con Microsoft
- [ ] Verificar usuarios en base de datos
- [ ] Documentar credenciales en lugar seguro

## 🎉 ¡Listo!

Ahora puedes gestionar OAuth de forma visual y segura, sin necesidad de editar archivos de configuración. ¡Mucho más fácil y profesional!
