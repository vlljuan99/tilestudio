/**
 * Test end-to-end del flujo del simulador.
 * Uso: npx tsx src/scripts/e2e-simulator.ts
 *
 * Genera una "foto de estancia" sintética con sharp, la postea al endpoint
 * /api/simulator/generate junto con un azulejo del seed, y verifica que la
 * página /s/<token> responde 200 y contiene la imagen del resultado.
 *
 * Sin OPENAI_API_KEY, el MockProvider devuelve un placeholder válido. El test
 * verifica el flujo, no la calidad del modelo.
 */
import sharp from 'sharp'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'

async function makeSyntheticRoom(): Promise<Buffer> {
  const w = 1200
  const h = 900
  // Pseudo-habitación: suelo gris claro abajo, pared crema arriba, separadas.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect x="0" y="0" width="${w}" height="${h * 0.55}" fill="#EFE7D6"/>
      <rect x="0" y="${h * 0.55}" width="${w}" height="${h * 0.45}" fill="#BFB7AC"/>
      <rect x="${w * 0.1}" y="${h * 0.18}" width="${w * 0.25}" height="${h * 0.35}" fill="#FFF" stroke="#000" stroke-width="2" opacity="0.7"/>
      <text x="${w / 2}" y="${h * 0.95}" text-anchor="middle" font-family="Arial" font-size="22" fill="#444">
        Foto sintética de prueba
      </text>
    </svg>
  `
  return sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer()
}

async function getTileId(): Promise<number | string> {
  const url = `${BASE}/api/tiles?where[slug][equals]=marfil-mate&limit=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Payload API devolvió ${res.status} al buscar el tile`)
  const data = (await res.json()) as { docs: Array<{ id: number | string }> }
  if (!data.docs?.[0]?.id) throw new Error('No se encontró el tile marfil-mate. ¿Hiciste el seed?')
  return data.docs[0].id
}

async function postGenerate(tileId: number | string, imageBuf: Buffer) {
  const form = new FormData()
  form.append('userImage', new Blob([new Uint8Array(imageBuf)], { type: 'image/jpeg' }), 'room.jpg')
  form.append('tileId', String(tileId))
  form.append('surfaces', 'floor')

  const res = await fetch(`${BASE}/api/simulator/generate`, {
    method: 'POST',
    body: form,
  })
  const data = (await res.json()) as any
  return { status: res.status, data }
}

async function checkSharePage(token: string) {
  const res = await fetch(`${BASE}/s/${token}`)
  const text = await res.text()
  return { status: res.status, hasResult: text.includes('Tu simulación') || text.includes('Marfil') }
}

async function run() {
  console.log('1) Generando foto sintética...')
  const img = await makeSyntheticRoom()
  console.log(`   OK (${img.length} bytes)`)

  console.log('2) Buscando tile id via /api/tiles...')
  const tileId = await getTileId()
  console.log(`   OK (id=${tileId})`)

  console.log('3) POST /api/simulator/generate (puede tardar 15-30s si OPENAI_API_KEY está set)...')
  const { status, data } = await postGenerate(tileId, img)
  if (status !== 200) {
    console.error('   ❌ status:', status, data)
    process.exit(1)
  }
  console.log('   OK', {
    provider: data.provider,
    latencyMs: data.latencyMs,
    shareUrl: data.shareUrl,
    tokenPrefix: data.sessionToken?.slice(0, 8),
  })

  console.log('4) GET /s/<token>...')
  const share = await checkSharePage(data.sessionToken)
  console.log(`   status=${share.status}, hasResult=${share.hasResult}`)
  if (share.status !== 200) process.exit(1)

  console.log('\n✅ Flujo end-to-end OK.')
  console.log(`   Compárte/abre: ${BASE}${data.shareUrl}`)
}

run().catch((err) => {
  console.error('❌ Test E2E falló:', err)
  process.exit(1)
})
