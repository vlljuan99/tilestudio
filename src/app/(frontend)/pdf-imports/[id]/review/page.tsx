import { redirect } from 'next/navigation'

/** La revisión de candidatos vive ahora en la zona de ventas. */
export default async function LegacyReviewRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/ventas/importar/${id}/revisar`)
}
