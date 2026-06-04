import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { getPayload } from 'payload'
import config from '@payload-config'

import { extractPaletteFromBuffer } from '@/lib/palette'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const mediaId = req.nextUrl.searchParams.get('mediaId')
  if (!mediaId) {
    return NextResponse.json({ error: 'Falta mediaId.' }, { status: 400 })
  }

  let media: any
  try {
    media = await payload.findByID({ collection: 'media', id: mediaId })
  } catch {
    return NextResponse.json({ error: 'Imagen no encontrada.' }, { status: 404 })
  }
  if (!media?.filename) {
    return NextResponse.json({ error: 'La imagen no tiene archivo.' }, { status: 400 })
  }

  // Leemos del disco (las Media se guardan en /media bajo el cwd)
  const filePath = path.join(process.cwd(), 'media', media.filename)
  let buffer: Buffer
  try {
    buffer = await readFile(filePath)
  } catch (err) {
    return NextResponse.json(
      { error: `No se pudo leer el archivo: ${(err as Error).message}` },
      { status: 500 },
    )
  }

  try {
    const palette = await extractPaletteFromBuffer(buffer)
    return NextResponse.json({ ok: true, palette })
  } catch (err) {
    return NextResponse.json(
      { error: `Error analizando la imagen: ${(err as Error).message}` },
      { status: 500 },
    )
  }
}
