import { redirect } from 'next/navigation'

/** La importación de catálogos vive ahora en la zona de ventas. */
export default function LegacyNewImportRedirect() {
  redirect('/ventas/importar/nuevo')
}
