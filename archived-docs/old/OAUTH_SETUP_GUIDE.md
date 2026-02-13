# Guía Completa de Configuración OAuth

## 📋 Descripción General

Esta guía te ayudará a configurar el registro de usuarios mediante OAuth con Google y Microsoft/Outlook. Los usuarios que se registren mediante OAuth serán creados automáticamente con el rol de **CLIENT** (cliente).

## 🎯 Características Implementadas

✅ Registro automático de usuarios con OAuth (Google y Microsoft)
✅ Usuarios OAuth creados con rol CLIENT por defecto
✅ Sincronización automática de avatar y datos de perfil
✅ Verificación automática de email para usuarios OAuth
✅ Creación automática de preferencias de usuario
✅ Creación automática de preferencias de notificación
✅ Manejo de usuarios existentes (actualización de datos)
✅ Protección contra usuarios desactivados
✅ UI profesional con botones de OAuth
✅ Página de registro dedicada

## 🔧 Configuración de Google OAuth

### Paso 1: Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Google+ API**

### Paso 2: Configurar OAuth Consent Screen

1. Ve a **APIs & Services** > **OAuth consent screen**
2. Selecciona **External** (para permitir cualquier cuenta de Google)
3. Completa la información requerida:
   - **App name**: Sistema de Tickets
   - **User support email**: tu-email@dominio.com
   - **Developer contact**: tu-email@dominio.com
4. Agrega los scopes necesarios:
   - `userinfo.email`
   - `userinfo.profile`
5. Guarda y continúa

### Paso 3: Crear Credenciales OAuth

1. Ve a **APIs & Services** > **Credentials**
2. Click en **Create Credentials** > **OAuth client ID**
3. Selecciona **Web application**
4. Configura:
   - **Name**: Sistema de Tickets Web Client
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3000
     https://tu-dominio.com
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:3000/api/auth/callback/google
     https://tu-dominio.com/api/auth/callback/google
     ```
5. Click en **Create**
6. Copia el **Client ID** y **Client Secret**

### Paso 4: Agregar Credenciales al .env

```env
GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="tu-client-secret"
```

## 🔧 Configuración de Microsoft/Azure AD OAuth

### Paso 1: Registrar Aplicación en Azure Portal

1. Ve a [Azure Portal](https://portal.azure.com/)
2. Busca **Azure Active Directory** o **Microsoft Entra ID**
3. Ve a **App registrations** > **New registration**

### Paso 2: Configurar la Aplicación

1. Completa el formulario:
   - **Name**: Sistema de Tickets
   - **Supported account types**: Selecciona una opción:
     - **Accounts in any organizational directory and personal Microsoft accounts** (recomendado para soportar Outlook.com)
     - **Personal Microsoft accounts only** (solo cuentas personales)
   - **Redirect URI**: 
     - Platform: **Web**
     - URI: `http://localhost:3000/api/auth/callback/azure-ad`
2. Click en **Register**

### Paso 3: Agregar Redirect URIs Adicionales

1. En tu aplicación registrada, ve a **Authentication**
2. En **Platform configurations** > **Web**, agrega:
   ```
   http://localhost:3000/api/auth/callback/azure-ad
   https://tu-dominio.com/api/auth/callback/azure-ad
   ```
3. En **Implicit grant and hybrid flows**, habilita:
   - ✅ ID tokens
4. Guarda los cambios

### Paso 4: Crear Client Secret

1. Ve a **Certificates & secrets**
2. Click en **New client secret**
3. Agrega una descripción: "Sistema de Tickets Secret"
4. Selecciona expiración (recomendado: 24 meses)
5. Click en **Add**
6. **¡IMPORTANTE!** Copia el **Value** inmediatamente (solo se muestra una vez)

### Paso 5: Configurar API Permissions

1. Ve a **API permissions**
2. Click en **Add a permission**
3. Selecciona **Microsoft Graph**
4. Selecciona **Delegated permissions**
5. Agrega los siguientes permisos:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
6. Click en **Add permissions**
7. (Opcional) Click en **Grant admin consent** si tienes permisos de admin

### Paso 6: Obtener IDs Necesarios

1. En **Overview** de tu aplicación, copia:
   - **Application (client) ID**
   - **Directory (tenant) ID**

### Paso 7: Agregar Credenciales al .env

```env
AZURE_AD_CLIENT_ID="tu-application-client-id"
AZURE_AD_CLIENT_SECRET="tu-client-secret-value"
AZURE_AD_TENANT_ID="common"
```

**Nota sobre TENANT_ID:**
- `common`: Permite cuentas personales (Outlook.com) y organizacionales
- `organizations`: Solo cuentas organizacionales
- `consumers`: Solo cuentas personales (Outlook.com, Hotmail, Live)
- `tu-tenant-id`: Solo usuarios de tu organización específica

## 🚀 Configuración del Proyecto

### 1. Instalar Dependencias

Las dependencias ya están instaladas, pero si necesitas reinstalar:

```bash
npm install next-auth @next-auth/prisma-adapter
```

### 2. Configurar Variables de Entorno

Crea o actualiza tu archivo `.env.local`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/tickets_db"

# NextAuth
NEXTAUTH_SECRET="genera-un-secret-seguro-aqui"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="tu-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="tu-google-client-secret"

# Microsoft/Azure AD OAuth
AZURE_AD_CLIENT_ID="tu-azure-client-id"
AZURE_AD_CLIENT_SECRET="tu-azure-client-secret"
AZURE_AD_TENANT_ID="common"
```

**Generar NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 3. Verificar Schema de Prisma

El schema ya incluye los modelos necesarios:
- `Account` - Para cuentas OAuth de NextAuth
- `OAuthAccount` - Para información adicional de OAuth
- `User` - Con campos `oauthProvider` y `oauthId`

### 4. Aplicar Migraciones (si es necesario)

```bash
npx prisma migrate dev
```

## 📱 Uso del Sistema

### Para Usuarios Nuevos

1. **Acceder a la página de registro:**
   - Navega a `/register`
   - O click en "Regístrate aquí" desde `/login`

2. **Seleccionar método de registro:**
   - Click en "Continuar con Google" para usar cuenta de Gmail
   - Click en "Continuar con Microsoft" para usar cuenta de Outlook/Hotmail

3. **Autorizar la aplicación:**
   - Serás redirigido al proveedor OAuth
   - Inicia sesión con tu cuenta
   - Autoriza los permisos solicitados

4. **Cuenta creada automáticamente:**
   - Usuario creado con rol CLIENT
   - Email verificado automáticamente
   - Avatar sincronizado desde el proveedor
   - Preferencias creadas por defecto
   - Redirigido a `/client` (dashboard de cliente)

### Para Usuarios Existentes

Si ya tienes una cuenta con el mismo email:
- El sistema actualizará tu información de OAuth
- Mantendrás tu rol actual (no se cambia a CLIENT)
- Se actualizará tu avatar si está disponible
- Se registrará el último login

## 🔒 Seguridad

### Validaciones Implementadas

✅ Verificación de usuario activo antes de permitir login
✅ Creación automática de usuarios solo con rol CLIENT
✅ Validación de email único
✅ Tokens de sesión seguros con JWT
✅ Refresh tokens para mantener sesión
✅ Expiración de sesión (24 horas)

### Datos Almacenados

**De Google:**
- Email
- Nombre completo
- Avatar (URL de foto de perfil)
- ID de Google (para vincular cuenta)

**De Microsoft:**
- Email
- Nombre completo
- Avatar (si está disponible)
- ID de Microsoft (para vincular cuenta)

**NO se almacenan:**
- Contraseñas de OAuth
- Tokens de acceso en texto plano
- Información sensible adicional

## 🧪 Testing

### Probar Google OAuth

1. Inicia el servidor: `npm run dev`
2. Ve a `http://localhost:3000/register`
3. Click en "Continuar con Google"
4. Usa una cuenta de Gmail de prueba
5. Verifica que:
   - Usuario se crea en la base de datos
   - Rol es CLIENT
   - Avatar se sincroniza
   - Redirección a `/client` funciona

### Probar Microsoft OAuth

1. Ve a `http://localhost:3000/register`
2. Click en "Continuar con Microsoft"
3. Usa una cuenta de Outlook/Hotmail de prueba
4. Verifica los mismos puntos que con Google

### Verificar en Base de Datos

```sql
-- Ver usuarios OAuth creados
SELECT id, email, name, role, "oauthProvider", "isEmailVerified", "createdAt"
FROM users
WHERE "oauthProvider" IS NOT NULL
ORDER BY "createdAt" DESC;

-- Ver cuentas OAuth vinculadas
SELECT u.email, a.provider, a."providerAccountId", a."createdAt"
FROM accounts a
JOIN users u ON a."userId" = u.id
ORDER BY a."createdAt" DESC;
```

## 🐛 Troubleshooting

### Error: "Configuration" en login

**Causa:** Variables de entorno no configuradas correctamente

**Solución:**
1. Verifica que `.env.local` existe
2. Verifica que todas las variables OAuth están configuradas
3. Reinicia el servidor de desarrollo

### Error: "Redirect URI mismatch"

**Causa:** La URI de redirección no coincide con la configurada en el proveedor

**Solución:**
1. Verifica que la URI en Google/Azure coincide exactamente:
   - Google: `http://localhost:3000/api/auth/callback/google`
   - Azure: `http://localhost:3000/api/auth/callback/azure-ad`
2. No olvides el protocolo (`http://` o `https://`)
3. Verifica que `NEXTAUTH_URL` en `.env.local` es correcto

### Error: "Access denied"

**Causa:** Permisos no configurados correctamente

**Solución:**
1. Verifica que los scopes están configurados en OAuth consent screen (Google)
2. Verifica que los API permissions están agregados (Azure)
3. Intenta otorgar admin consent en Azure

### Usuario no se crea

**Causa:** Error en el callback de signIn

**Solución:**
1. Revisa los logs del servidor
2. Verifica que la base de datos está accesible
3. Verifica que el schema de Prisma está actualizado
4. Revisa que no hay errores de validación

### Avatar no se sincroniza

**Causa:** El proveedor no devuelve la URL del avatar

**Solución:**
- Esto es normal, algunos proveedores no siempre incluyen el avatar
- El sistema funcionará sin avatar
- El usuario puede subir uno manualmente después

## 📊 Monitoreo

### Logs Importantes

El sistema registra eventos importantes:

```
✅ Nuevo usuario OAuth creado: user@example.com con rol CLIENT
🎉 Nuevo usuario registrado vía OAuth: user@example.com Provider: google
```

### Métricas a Monitorear

- Número de registros OAuth por día
- Tasa de éxito de autenticación OAuth
- Proveedores más utilizados (Google vs Microsoft)
- Tiempo de respuesta de OAuth callbacks

## 🔄 Mantenimiento

### Renovar Client Secrets

**Google:**
- Los secrets no expiran, pero puedes rotarlos por seguridad
- Crea un nuevo secret y actualiza `.env.local`
- El anterior seguirá funcionando hasta que lo elimines

**Microsoft:**
- Los secrets expiran (6, 12 o 24 meses)
- Crea un nuevo secret antes de que expire el actual
- Actualiza `.env.local` con el nuevo valor
- Elimina el secret antiguo después de verificar que el nuevo funciona

### Actualizar Redirect URIs

Si cambias de dominio:
1. Agrega las nuevas URIs en Google Cloud Console
2. Agrega las nuevas URIs en Azure Portal
3. Actualiza `NEXTAUTH_URL` en `.env.local`
4. Despliega los cambios
5. Verifica que funciona
6. Elimina las URIs antiguas

## 📚 Recursos Adicionales

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Prisma Adapter for NextAuth](https://authjs.dev/reference/adapter/prisma)

## ✅ Checklist de Implementación

- [ ] Proyecto creado en Google Cloud Console
- [ ] OAuth consent screen configurado en Google
- [ ] Credenciales OAuth creadas en Google
- [ ] Aplicación registrada en Azure Portal
- [ ] Client secret creado en Azure
- [ ] API permissions configurados en Azure
- [ ] Variables de entorno configuradas en `.env.local`
- [ ] NEXTAUTH_SECRET generado
- [ ] Migraciones de Prisma aplicadas
- [ ] Servidor de desarrollo iniciado
- [ ] Registro con Google probado
- [ ] Registro con Microsoft probado
- [ ] Usuarios verificados en base de datos
- [ ] Redirección a dashboard funciona
- [ ] Avatar se sincroniza correctamente

## 🎉 ¡Listo!

Tu sistema ahora soporta registro de usuarios mediante OAuth con Google y Microsoft. Los usuarios se crearán automáticamente con rol CLIENT y podrán acceder inmediatamente a crear tickets de soporte.
