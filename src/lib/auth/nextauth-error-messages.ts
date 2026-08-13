export type NextAuthErrorKind = 'credentials' | 'network' | 'server' | 'validation' | 'account' | 'session'

export type NextAuthErrorMessage = {
  type: NextAuthErrorKind
  message: string
  suggestion?: string
  code: string
}

/**
 * Mensajes en español para códigos de error de NextAuth (?error= en /login).
 * @see https://next-auth.js.org/configuration/pages#error-page
 */
export function getNextAuthErrorMessage(code: string | null | undefined): NextAuthErrorMessage | null {
  if (!code?.trim()) return null

  switch (code) {
    case 'CredentialsSignin':
      return {
        type: 'credentials',
        message: 'Email o contraseña incorrectos',
        suggestion: 'Verifica tus credenciales e intenta de nuevo',
        code,
      }
    case 'AccessDenied':
      return {
        type: 'account',
        message: 'Acceso denegado',
        suggestion:
          'Tu cuenta puede estar desactivada o el registro con OAuth no está permitido. Contacta al administrador.',
        code,
      }
    case 'OAuthAccountNotLinked':
      return {
        type: 'account',
        message: 'Esta cuenta ya existe con otro método de acceso',
        suggestion:
          'Inicia sesión con email y contraseña, o usa el mismo proveedor con el que te registraste.',
        code,
      }
    case 'Configuration':
      return {
        type: 'server',
        message: 'OAuth no está configurado correctamente en el servidor',
        suggestion:
          'El administrador debe revisar Client ID, Secret y Redirect URI en Configuración → OAuth.',
        code,
      }
    case 'OAuthSignin':
      return {
        type: 'server',
        message: 'No se pudo conectar con Google o Microsoft',
        suggestion: 'Verifica que el proveedor esté activo en el sistema e intenta de nuevo.',
        code,
      }
    case 'OAuthCallback':
      return {
        type: 'server',
        message: 'Error al completar el inicio de sesión OAuth',
        suggestion:
          'Confirma que la Redirect URI en Google/Azure coincida exactamente con la del sistema.',
        code,
      }
    case 'OAuthCreateAccount':
      return {
        type: 'server',
        message: 'No se pudo crear la cuenta con OAuth',
        suggestion: 'Intenta de nuevo o regístrate con email y contraseña.',
        code,
      }
    case 'Callback':
      return {
        type: 'server',
        message: 'Error en el callback de autenticación',
        suggestion: 'Intenta de nuevo. Si persiste, contacta al administrador.',
        code,
      }
    case 'EmailSignin':
      return {
        type: 'server',
        message: 'No se pudo enviar el enlace de acceso por email',
        suggestion: 'Intenta con otro método de inicio de sesión.',
        code,
      }
    case 'SessionRequired':
      return {
        type: 'session',
        message: 'Debes iniciar sesión para continuar',
        code,
      }
    default:
      return {
        type: 'server',
        message: 'Error de autenticación',
        suggestion: 'Intenta de nuevo en unos momentos.',
        code,
      }
  }
}
