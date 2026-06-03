import { getPayload } from 'payload'
import config from '@payload-config'

import { SimulatorWizard } from '@/components/simulator/SimulatorWizard'

export const metadata = { title: 'Simulador IA' }

async function getInitialTile(slug?: string) {
  if (!slug) return null
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'tiles',
    where: { and: [{ slug: { equals: slug } }, { published: { equals: true } }] },
    limit: 1,
    depth: 1,
  })
  return (res.docs[0] as any) || null
}

async function getCatalog() {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'tiles',
    where: { published: { equals: true } },
    limit: 60,
    depth: 1,
    sort: '-featured',
  })
  return res.docs as any[]
}

export default async function SimuladorPage({
  searchParams,
}: {
  searchParams: Promise<{ tile?: string }>
}) {
  const { tile: slug } = await searchParams
  const [initialTile, catalog] = await Promise.all([getInitialTile(slug), getCatalog()])

  return <SimulatorWizard initialTile={initialTile} catalog={catalog} />
}
