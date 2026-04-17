/**
 * Redirect: /settings/tickets → /admin/settings/tickets
 * Esta página fue movida. Este componente redirige automáticamente.
 */
import { redirect } from 'next/navigation'

export default function TicketSettingsRedirect() {
  redirect('/admin/settings/tickets')
}
