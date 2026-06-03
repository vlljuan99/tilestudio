import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { CandidateReview } from '@/components/admin-pdf/CandidateReview'

export const metadata = { title: 'Revisar candidatos', robots: { index: false } }

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login')

  let importDoc: any
  try {
    importDoc = await payload.findByID({ collection: 'pdf-imports', id, depth: 1 })
  } catch {
    notFound()
  }
  if (!importDoc) notFound()

  return <CandidateReview importId={id} importDoc={importDoc} />
}
