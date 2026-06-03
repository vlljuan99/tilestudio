/**
 * Test e2e del import de PDF.
 * Uso: npx tsx --env-file=.env src/scripts/e2e-pdf-import.ts [pdf-path] [from] [to]
 *
 * Sube el PDF, crea un PdfImport, dispara la extracción y devuelve el id para
 * abrir el admin y ver la barra de progreso.
 */
import { readFile } from 'fs/promises'
import path from 'path'
import { getPayload } from 'payload'
import config from '../payload.config'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'

async function login() {
  const res = await fetch(`${BASE}/api/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@tilestudio.local',
      password: 'admin123',
    }),
  })
  if (!res.ok) throw new Error(`Login failed ${res.status}`)
  const setCookie = res.headers.get('set-cookie') || ''
  const m = setCookie.match(/payload-token=([^;]+)/)
  if (!m) throw new Error('No cookie en respuesta de login')
  return m[1]
}

async function main() {
  const pdfPath = process.argv[2] || 'C:/Users/jvill/Downloads/170-311 SOLID web.pdf'
  const from = Number(process.argv[3] || 2)
  const to = Number(process.argv[4] || 5)

  console.log(`1. Login como admin…`)
  const token = await login()

  console.log(`2. Subiendo PDF a Media…`)
  const payload = await getPayload({ config })
  const buffer = await readFile(pdfPath)
  const fileName = path.basename(pdfPath)
  const media = (await payload.create({
    collection: 'media',
    data: { alt: `PDF: ${fileName}` } as any,
    file: {
      name: fileName,
      data: buffer,
      mimetype: 'application/pdf',
      size: buffer.length,
    },
  })) as any
  console.log(`   media.id = ${media.id}`)

  console.log(`3. Creando PdfImport (páginas ${from}-${to}, max ${to - from + 1})…`)
  const importDoc = (await payload.create({
    collection: 'pdf-imports',
    data: {
      originalFile: media.id,
      pageRangeFrom: from,
      pageRangeTo: to,
      maxPages: to - from + 1,
      status: 'queued',
    } as any,
  })) as any
  console.log(`   pdf-imports.id = ${importDoc.id}`)

  console.log(`4. Disparando /api/admin/pdf-imports/${importDoc.id}/start…`)
  const startRes = await fetch(`${BASE}/api/admin/pdf-imports/${importDoc.id}/start`, {
    method: 'POST',
    headers: { cookie: `payload-token=${token}` },
  })
  console.log(`   ${startRes.status} ${startRes.statusText}`)
  console.log(`   ${JSON.stringify(await startRes.json())}`)

  console.log(`\n5. Polling cada 3s…`)
  let lastStep = ''
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const doc = (await payload.findByID({ collection: 'pdf-imports', id: importDoc.id })) as any
    const line = `   [${i * 3}s] status=${doc.status} | p=${doc.processedPages || 0}/${doc.totalPages || '?'} | ${doc.progressPercent || 0}% | cand=${doc.candidatesCount || 0} | ${doc.currentStep || ''}`
    if (line !== lastStep) {
      console.log(line)
      lastStep = line
    }
    if (doc.status === 'review_ready' || doc.status === 'completed' || doc.status === 'failed') {
      console.log(`\n   Final: ${doc.status}`)
      if (doc.errorMessage) console.log(`   Error: ${doc.errorMessage}`)
      console.log(`\n   Abre: ${BASE}/admin/collections/pdf-imports/${importDoc.id}`)
      console.log(`   Revisa: ${BASE}/pdf-imports/${importDoc.id}/review`)
      const sample = (doc.extractedItems || []).slice(0, 3)
      if (sample.length > 0) {
        console.log(`\n   Primeros candidatos:`)
        console.log(JSON.stringify(sample, null, 2))
      }
      process.exit(0)
    }
  }
  console.log('   ⏱ timeout esperando.')
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
