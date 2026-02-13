# Plan de Integración OAuth (Google/Outlook)

## Estado Actual ✅

La base de datos **YA ESTÁ PREPARADA** para OAuth. El esquema actual incluye:

### Modelos Existentes:
- **User**: Campos `oauthProvider` y `oauthId` ya disponibles
- **OAuthAccount**: Modelo completo para cuentas OAuth
- **Account**: Modelo NextAuth para proveedores
- **Session**: Gestión de sesiones

### Campos OAuth en User:
```prisma
model User {
  // ... otros campos
  oauthProvider         String?
  oauthId               String?
  passwordHash          String?  // Opcional para OAuth
  isEmailVerified       Boolean  @default(false)
  // ... relaciones
  accounts              Account[]
  oauthAccounts         OAuthAccount[]
}
```

## Próximos Pasos para OAuth

### 1. Configuración de Proveedores
```typescript
// next-auth.config.ts
import GoogleProvider from "next-auth/providers/google"
import AzureADProvider from "next-auth/providers/azure-ad"

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  // ... callbacks para sincronizar con User model
}
```

### 2. Variables de Entorno Necesarias
```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Microsoft/Outlook OAuth
AZURE_AD_CLIENT_ID=your_azure_client_id
AZURE_AD_CLIENT_SECRET=your_azure_client_secret
AZURE_AD_TENANT_ID=your_tenant_id

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
```

### 3. Flujo de Registro OAuth

#### Nuevo Usuario OAuth:
1. Usuario se autentica con Google/Outlook
2. Sistema verifica si email existe en BD
3. Si NO existe: crea nuevo User con `role: CLIENT`
4. Si SÍ existe: vincula cuenta OAuth al usuario existente

#### Usuario Existente:
1. Puede vincular cuenta OAuth desde perfil
2. Mantiene datos existentes (tickets, historial)
3. Puede usar login tradicional O OAuth

### 4. Modificaciones de UI Necesarias

#### Login Page:
```tsx
// Botones OAuth
<Button onClick={() => signIn('google')}>
  <GoogleIcon /> Continuar con Google
</Button>
<Button onClick={() => signIn('azure-ad')}>
  <MicrosoftIcon /> Continuar con Outlook
</Button>
```

#### Profile Page:
```tsx
// Sección de cuentas vinculadas
<div className="oauth-accounts">
  <h3>Cuentas Vinculadas</h3>
  {user.accounts.map(account => (
    <div key={account.id}>
      {account.provider} - {account.providerAccountId}
      <Button onClick={() => unlinkAccount(account.id)}>
        Desvincular
      </Button>
    </div>
  ))}
</div>
```

### 5. Callbacks NextAuth
```typescript
callbacks: {
  async signIn({ user, account, profile }) {
    // Lógica para crear/vincular usuario
    if (account?.provider === 'google' || account?.provider === 'azure-ad') {
      // Buscar usuario por email
      // Crear si no existe
      // Vincular cuenta OAuth
    }
    return true
  },
  
  async session({ session, user }) {
    // Agregar datos del usuario a la sesión
    session.user.id = user.id
    session.user.role = user.role
    return session
  }
}
```

## Ventajas del Esquema Actual

✅ **Sin migraciones necesarias**: Campos OAuth ya existen
✅ **Compatibilidad**: Usuarios existentes no se ven afectados
✅ **Flexibilidad**: Soporte para múltiples proveedores
✅ **Seguridad**: Separación entre autenticación local y OAuth

## Consideraciones de Seguridad

1. **Verificación de Email**: OAuth providers ya verifican emails
2. **Roles por Defecto**: Nuevos usuarios OAuth = `CLIENT`
3. **Vinculación Segura**: Solo admins pueden cambiar roles
4. **Desvinculación**: Usuarios pueden desvincular cuentas OAuth

## Timeline Estimado

- **Configuración Básica**: 1-2 días
- **UI/UX Integration**: 2-3 días  
- **Testing & Security**: 1-2 días
- **Documentación**: 1 día

**Total**: ~1 semana de desarrollo

## Notas Importantes

- La base de datos NO necesita cambios
- Los usuarios existentes seguirán funcionando normalmente
- OAuth es una funcionalidad ADICIONAL, no reemplaza el login actual
- Se puede implementar gradualmente (primero Google, luego Outlook)