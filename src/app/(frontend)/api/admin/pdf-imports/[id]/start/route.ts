import { NextRequest, NextResponse } from 'next/server'
import { getPayload, headersWithCors } from 'payload'
import config from '@payload-config'

import { runPdfImport } from '@/lib/pdf/worker'

export const runtime = 'nodejs'
export const maxDuration = 900

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let importDoc: any
  try {
    importDoc = await payload.findByID({ collection: 'pdf-imports', id })
  } catch {
    return NextResponse.json({ error: 'Import no encontrado.' }, { status: 404 })
  }

  if (importDoc.status === 'processing') {
    return NextResponse.json(
      { error: 'Ya está en proceso.', status: importDoc.status },
      { status: 409 },
    )
  }

  // Fire and forget: el worker corre en background, el handler vuelve enseguida.
  // El front-end pollea el doc para ver el progreso.
  runPdfImport(id).catch((err) => {
    console.error('runPdfImport unhandled error:', err)
  })

  return NextResponse.json({
    ok: true,
    message: 'Extracción iniciada. Refresca para ver el progreso.',
  })
}
