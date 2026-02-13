# 🚀 Quick Start: OAuth en 5 Minutos

## ⚡ Configuración Rápida

### 1. Google OAuth (2 minutos)

1. Ve a https://console.cloud.google.com/
2. Crea proyecto → APIs & Services → Credentials
3. Create OAuth Client ID → Web application
4. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. Copia Client ID y Client Secret

### 2. Microsoft OAuth (2 minutos)

1. Ve a https://portal.azure.com/
2. Azure Active Directory → App registrations → New registration
3. Redirect URI: `http://localhost:3000/api/auth/callback/azure-ad`
4. Certificates & secrets → New client secret
5. Copia Application ID y Client Secret

### 3. Variables de Entorno (1 minuto)

Crea `.env.local`:

```env
# NextAuth
NEXTAUTH_SECRET="genera-con: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# Google
GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="tu-client-secret"

# Microsoft
AZURE_AD_CLIENT_ID="tu-azure-client-id"
AZURE_AD_CLIENT_SECRET="tu-azure-client-secret"
AZURE_AD_TENANT_ID="common"
```

### 4. Iniciar Servidor

```bash
npm run dev
```

### 5. Probar

1. Ve a http://localhost:3000/register
2. Click en "Continuar con Google" o "Continuar con Microsoft"
3. Autoriza la aplicación
4. ¡Listo! Usuario creado como CLIENT

## ✅ Verificar

```sql
SELECT email, name, role, "oauthProvider", "isEmailVerified"
FROM users
WHERE "oauthProvider" IS NOT NULL;
```

## 📚 Documentación Completa

Ver `OAUTH_SETUP_GUIDE.md` para configuración detallada.

## 🆘 Problemas Comunes

**Error: "Configuration"**
→ Verifica que todas las variables de entorno estén en `.env.local`

**Error: "Redirect URI mismatch"**
→ Verifica que la URI en Google/Azure coincida exactamente

**Usuario no se crea**
→ Revisa logs del servidor con `npm run dev`

## 🎉 ¡Eso es todo!

Tu sistema ahora soporta registro con Google y Microsoft.
