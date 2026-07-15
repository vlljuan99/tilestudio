import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { ImportStatus, type Progress } from '@/components/admin-pdf/ImportStatus'

export const metadata = { title: 'Estado de la importación', robots: { index: false } }

export default async function ImportStatusPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login')

  let doc: any
  try {
    doc = await payload.findByID({ collection: 'pdf-imports', id, depth: 0 })
  } catch {
    notFound()
  }
  if (!doc) notFound()

  const items: any[] = Array.isArray(doc.extractedItems) ? doc.extractedItems : []
  const usage: any[] = Array.isArray(doc.aiUsage) ? doc.aiUsage : []

  const initial: Progress = {
    id: doc.id,
    displayName: doc.displayName,
    status: doc.status || 'queued',
    progressPercent: doc.progressPercent ?? 0,
    processedPages: doc.processedPages ?? 0,
    totalPages: doc.totalPages ?? null,
    pageRangeFrom: doc.pageRangeFrom ?? 1,
    pageRangeTo: doc.pageRangeTo ?? null,
    pdfTotalPages: doc.pdfTotalPages ?? null,
    lastProcessedPage: doc.lastProcessedPage ?? null,
    candidatesCount: doc.candidatesCount ?? items.length,
    seriesCount: new Set(
      items.map((c) => (c.seriesName || '').toLowerCase()).filter(Boolean),
    ).size,
    currentStep: doc.currentStep || null,
    errorMessage: doc.errorMessage || null,
    startedAt: doc.startedAt || null,
    completedAt: doc.completedAt || null,
    costUsd: usage.reduce((s, u) => s + (u?.estimatedCostUsd || 0), 0),
    recent: items
      .slice(-12)
      .reverse()
      .map((c) => ({
        id: c.id,
        variantName: c.variantName,
        seriesName: c.seriesName || null,
        page: c.page,
        textureImageUrl: c.textureImageUrl || null,
        ambientImageUrl: c.ambientImageUrl || null,
      })),
  }

  return <ImportStatus initial={initial} />
}
