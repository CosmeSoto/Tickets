import { redirect } from 'next/navigation'

/** Ruta legacy — la configuración OAuth vive en Configuración del Sistema. */
export default function OAuthSettingsRedirectPage() {
  redirect('/admin/settings?tab=oauth')
}
