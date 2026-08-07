/**
 * Redirect: /client/create-ticket → /client/tickets/create
 * Esta página fue consolidada. Este componente redirige automáticamente.
 */
import { redirect } from 'next/navigation'

export default function CreateTicketRedirect() {
  redirect('/client/tickets/create')
}
