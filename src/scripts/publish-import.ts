/**
 * Marca todos los candidatos del último PdfImport como aceptados y dispara publish.
 * Uso: npx tsx --env-file=.env src/scripts/publish-import.ts [importId]
 */
import { getPayload } from 'payload'
import config from '../payload.config'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'

async function login() {
  const res = await fetch(`${BASE}/api/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tilestudio.local', password: 'admin123' }),
  })
  const setCookie = res.headers.get('set-cookie') || ''
  const m = setCookie.match(/payload-token=([^;]+)/)
  if (!m) throw new Error('Login failed')
  return m[1]
}

async function main() {
  const payload = await getPayload({ config })

  const importId = process.argv[2]
    ? Number(process.argv[2])
    : (await payload.find({ collection: 'pdf-imports', sort: '-createdAt', limit: 1 }))
        .docs[0]?.id

  if (!importId) throw new Error('No PdfImport encontrado')

  const doc = (await payload.findByID({ collection: 'pdf-imports', id: importId })) as any
  console.log(`Import #${importId}: ${doc.candidatesCount} candidatos, estado ${doc.status}`)

  const accepted = (doc.extractedItems || []).map((c: any) => ({
    ...c,
    reviewStatus: 'accepted',
  }))
  await payload.update({
    collection: 'pdf-imports',
    id: importId,
    data: { extractedItems: accepted } as any,
  })
  console.log(`Marcados ${accepted.length} como aceptados.`)

  const token = await login()
  const res = await fetch(`${BASE}/api/admin/pdf-imports/${importId}/publish`, {
    method: 'POST',
    headers: { cookie: `payload-token=${token}` },
  })
  const data = await res.json()
  console.log(`Publish: ${res.status}`, data)

  // Auto-publicar los nuevos tiles para que aparezcan al público
  if (data.createdTileIds?.length) {
    for (const id of data.createdTileIds) {
      await payload.update({
        collection: 'tiles',
        id,
        data: { published: true } as any,
      })
    }
    console.log(`Marcados ${data.createdTileIds.length} tiles como publicados.`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
