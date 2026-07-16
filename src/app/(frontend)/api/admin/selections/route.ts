import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

/**
 * Crea una selección de azulejos para compartir con un cliente.
 *
 * El token se genera AQUÍ, no en el navegador: es la única credencial del
 * enlace, así que tiene que venir de un generador criptográfico del servidor y
 * no de algo adivinable como Math.random() o la fecha.
 *
 * Body: { title, tiles: [id], clientName?, note? }
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
  }

  const tiles: (number | string)[] = Array.isArray(body?.tiles) ? body.tiles : []
  if (tiles.length === 0) {
    return NextResponse.json({ error: 'Selecciona al menos un azulejo.' }, { status: 400 })
  }

  const title = String(body?.title || '').trim() || 'Selección de azulejos'

  const doc = await payload.create({
    collection: 'selections',
    data: {
      title,
      token: randomBytes(24).toString('hex'),
      clientName: body?.clientName?.trim() || undefined,
      note: body?.note?.trim() || undefined,
      tiles,
      createdBy: user.id,
      viewCount: 0,
    } as any,
  })

  return NextResponse.json({ ok: true, id: doc.id, token: (doc as any).token })
}
