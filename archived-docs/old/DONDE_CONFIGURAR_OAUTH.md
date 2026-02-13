# 📍 ¿Dónde Configurar OAuth?

## 🎯 Ubicación en la Interfaz

### Paso 1: Iniciar Sesión como ADMIN

1. Ve a: `http://localhost:3000/login`
2. Inicia sesión con una cuenta de **ADMIN**

**Credenciales de prueba:**
```
Email: admin@tickets.com
Password: admin123
```

### Paso 2: Ir a Configuración

En el **sidebar izquierdo**, busca y haz click en:

```
📊 Dashboard
🎫 Tickets
👥 Usuarios
📁 Categorías
🔧 Técnicos
🏢 Departamentos
📈 Reportes
💾 Backups
⚙️  Configuración    ← ¡CLICK AQUÍ!
```

### Paso 3: Seleccionar el Tab "OAuth"

Una vez en la página de Configuración, verás varios tabs en la parte superior:

```
┌─────────────────────────────────────────────────────┐
│ [General] [Email] [Notificaciones] [Seguridad] [🔑 OAuth] │
└─────────────────────────────────────────────────────┘
                                                    ↑
                                            ¡CLICK AQUÍ!
```

**Haz click en el tab "🔑 OAuth"**

## 📋 ¿Qué Verás en el Tab OAuth?

### Sección 1: Información
```
┌─────────────────────────────────────────┐
│ ℹ️  Configura Google y Microsoft OAuth   │
│ Los usuarios OAuth se crean como CLIENT │
└─────────────────────────────────────────┘
```

### Sección 2: Google OAuth
```
┌─────────────────────────────────────────┐
│ 🔵 Google OAuth              [Activo]   │
├─────────────────────────────────────────┤
│ Redirect URI (copiable):                │
│ http://localhost:3000/api/auth/...  📋 │
│                                         │
│ Client ID *                             │
│ [___________________________________]   │
│                                         │
│ Client Secret *                         │
│ [___________________________________] 👁 │
│                                         │
│ ☑ Habilitar Google OAuth                │
│                                         │
│ [Guardar Configuración de Google]      │
└─────────────────────────────────────────┘
```

### Sección 3: Microsoft OAuth
```
┌─────────────────────────────────────────┐
│ 🟦 Microsoft OAuth           [Inactivo] │
├─────────────────────────────────────────┤
│ Redirect URI (copiable):                │
│ http://localhost:3000/api/auth/...  📋 │
│                                         │
│ Application (Client) ID *               │
│ [___________________________________]   │
│                                         │
│ Client Secret *                         │
│ [___________________________________] 👁 │
│                                         │
│ Tenant ID                               │
│ [common_____________________________]   │
│                                         │
│ ☑ Habilitar Microsoft OAuth             │
│                                         │
│ [Guardar Configuración de Microsoft]   │
└─────────────────────────────────────────┘
```

### Sección 4: Ayuda
```
┌─────────────────────────────────────────┐
│ 🔑 ¿Necesitas ayuda?                     │
├─────────────────────────────────────────┤
│ Google: Crea credenciales en            │
│ → Google Cloud Console                  │
│                                         │
│ Microsoft: Registra tu app en           │
│ → Azure Portal                          │
│                                         │
│ Consulta: OAUTH_SETUP_GUIDE.md         │
└─────────────────────────────────────────┘
```

## 🔧 ¿Qué Datos Necesitas?

### Para Google:
1. **Client ID**: Algo como `123456789-abc.apps.googleusercontent.com`
2. **Client Secret**: Algo como `GOCSPX-abc123...`

**¿Dónde obtenerlos?**
- Ve a: https://console.cloud.google.com/
- Crea un proyecto
- Ve a "APIs & Services" > "Credentials"
- Crea "OAuth client ID"

### Para Microsoft:
1. **Application (Client) ID**: Algo como `12345678-1234-1234-1234-123456789012`
2. **Client Secret**: Un valor que generas en Azure
3. **Tenant ID**: Usa `common` para cuentas personales y organizacionales

**¿Dónde obtenerlos?**
- Ve a: https://portal.azure.com/
- Busca "Azure Active Directory"
- Ve a "App registrations"
- Registra una nueva aplicación

## ✅ Pasos Rápidos

1. **Inicia sesión como ADMIN**
2. **Click en "Configuración"** en el sidebar (icono ⚙️)
3. **Click en el tab "OAuth"** (icono 🔑)
4. **Copia el Redirect URI** (botón de copiar 📋)
5. **Ve a Google Console o Azure Portal**
6. **Pega el Redirect URI** en la configuración
7. **Obtén Client ID y Client Secret**
8. **Vuelve al tab OAuth**
9. **Pega las credenciales**
10. **Marca "Habilitar"**
11. **Click en "Guardar"**

## 🎉 ¡Listo!

Ahora los botones de OAuth aparecerán en:
- `/login` - Página de inicio de sesión
- `/register` - Página de registro

Los usuarios podrán registrarse con:
- ✅ Google (Gmail)
- ✅ Microsoft (Outlook/Hotmail)

Y serán creados automáticamente como **CLIENT**.

## 🆘 ¿No Ves el Tab "OAuth"?

**Verifica:**
1. ✅ Estás logueado como **ADMIN** (no como técnico o cliente)
2. ✅ Estás en la página de **Configuración** (`/admin/settings`)
3. ✅ El servidor está corriendo (`npm run dev`)
4. ✅ La migración de Prisma se aplicó (`npx prisma migrate dev`)
5. ✅ Recarga la página (Ctrl+R o Cmd+R)

**Si aún no aparece:**
- Revisa la consola del navegador (F12)
- Revisa los logs del servidor
- Verifica que el componente `oauth-settings-tab.tsx` existe

## 📚 Más Información

- **Guía completa**: `OAUTH_UI_CONFIG_GUIDE.md`
- **Guía rápida**: `OAUTH_UI_QUICK_START.md`
- **Setup detallado**: `OAUTH_SETUP_GUIDE.md`

## 🎨 Navegación Visual

```
Sidebar → Configuración → Tab OAuth
   ⚙️          ⚙️            🔑

1. Click aquí   2. Luego aquí   3. Finalmente aquí
```

¡Es así de fácil! 🚀
