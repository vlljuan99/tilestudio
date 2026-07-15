import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { ImportWizard } from '@/components/admin-pdf/ImportWizard'

export const metadata = { title: 'Importar catálogo', robots: { index: false } }

export default async function NewImportPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login')

  const brands = await payload.find({
    collection: 'brands',
    limit: 200,
    sort: 'name',
    depth: 0,
  })

  return (
    <ImportWizard
      brands={brands.docs.map((b: any) => ({ id: b.id, name: b.name }))}
    />
  )
}
