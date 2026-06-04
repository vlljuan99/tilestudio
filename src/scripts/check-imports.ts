import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'pdf-imports',
    limit: 10,
    sort: '-createdAt',
    depth: 0,
  })
  for (const i of res.docs as any[]) {
    const now = Date.now()
    const started = i.startedAt ? new Date(i.startedAt).getTime() : null
    const completed = i.completedAt ? new Date(i.completedAt).getTime() : null
    const ageStarted = started ? Math.round((now - started) / 1000) : null
    const ageCompleted = completed ? Math.round((now - completed) / 1000) : null

    console.log(
      `#${i.id} ${i.displayName || '?'} | status=${i.status} | progress=${i.progressPercent || 0}% | p=${i.processedPages || 0}/${i.totalPages || '?'} | cand=${i.candidatesCount || 0}`,
    )
    console.log(`   step: ${i.currentStep || '—'}`)
    console.log(
      `   startedAt: ${i.startedAt || '—'}${ageStarted ? ` (hace ${ageStarted}s)` : ''}`,
    )
    console.log(
      `   completedAt: ${i.completedAt || '—'}${ageCompleted ? ` (hace ${ageCompleted}s)` : ''}`,
    )
    if (i.errorMessage) console.log(`   ERROR: ${i.errorMessage.slice(0, 200)}`)
    console.log()
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
