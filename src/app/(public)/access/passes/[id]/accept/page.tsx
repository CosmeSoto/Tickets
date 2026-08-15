import { PrivacyAcceptance } from './privacy-acceptance'

export default async function AccessPrivacyAcceptancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { id } = await params
  const { token } = await searchParams
  return <PrivacyAcceptance passId={id} token={token ?? ''} />
}
