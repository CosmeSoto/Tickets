/**
 * Versión del aviso de privacidad que se muestra en el flujo de aceptación
 * pública. Antes el cliente (access-console.tsx) hardcodeaba `'v1'` y lo
 * mandaba como dato de ENTRADA en el POST de creación — el servidor lo
 * persistía tal cual, así que la versión del aviso legal que queda como
 * evidencia de consentimiento la decidía el navegador, no el backend. Ahora
 * es el servidor quien fija el valor; el cliente solo la importa para
 * mostrar el texto informativo.
 */
export const ACCESS_PRIVACY_NOTICE_VERSION = 'v1'
