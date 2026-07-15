import { redirect } from 'next/navigation'

/** La importación de catálogos vive ahora en la zona de ventas. */
export default async function LegacyImportStatusRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/ventas/importar/${id}`)
}
