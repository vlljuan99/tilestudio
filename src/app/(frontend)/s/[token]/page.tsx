import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { ShareView } from '@/components/simulator/ShareView'

export const metadata = { title: 'Tu simulación', robots: { index: false } }

async function loadSession(token: string) {
  if (!token || token.length < 32) return null
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'simulator-sessions',
    where: { token: { equals: token } },
    limit: 1,
    depth: 0,
  })
  const session = res.docs[0] as any
  if (!session) return null
  if (new Date(session.expiresAt).getTime() < Date.now()) return null
  return session
}

async function loadGenerations(sessionId: number | string) {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'generations',
    where: {
      and: [{ session: { equals: sessionId } }, { status: { equals: 'completed' } }],
    },
    sort: '-createdAt',
    limit: 10,
    depth: 2,
  })
  return res.docs as any[]
}

async function loadSettings() {
  const payload = await getPayload({ config })
  try {
    return (await payload.findGlobal({ slug: 'site-settings' })) as any
  } catch {
    return null
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const session = await loadSession(token)
  if (!session) notFound()

  const [generations, settings] = await Promise.all([
    loadGenerations(session.id),
    loadSettings(),
  ])

  if (generations.length === 0) notFound()

  return <ShareView token={token} generations={generations} settings={settings} />
}
