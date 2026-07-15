import { getPayload } from 'payload'
import config from '@payload-config'

import { ImportWizard } from '@/components/admin-pdf/ImportWizard'

export const metadata = { title: 'Importar catálogo' }

export default async function NuevaImportacionPage() {
  const payload = await getPayload({ config })
  const brands = await payload.find({
    collection: 'brands',
    limit: 200,
    sort: 'name',
    depth: 0,
  })

  return <ImportWizard brands={brands.docs.map((b: any) => ({ id: b.id, name: b.name }))} />
}
