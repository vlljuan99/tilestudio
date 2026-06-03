import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import sharp from 'sharp'
import config from '@payload-config'

import { getRenderingProvider, type Surface, type TilePlacement } from '@/lib/ai/renderer'
import {
  getOrCreateSession,
  incrementGenerationCount,
  isSessionAtLimit,
  SESSION_CONSTANTS,
} from '@/lib/session'

export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_USER_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_DIMENSION = 1536

async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function fetchTileTexture(payload: any, tileId: number | string): Promise<Buffer | null> {
  try {
    const tile = await payload.findByID({ collection: 'tiles', id: tileId, depth: 1 })
    const textureRel = tile.textureImage || tile.mainImage
    if (!textureRel) return null

    const mediaId = typeof textureRel === 'object' ? textureRel.id : textureRel
    const media = await payload.findByID({ collection: 'media', id: mediaId })
    if (!media?.filename) return null

    // Leer desde disco para evitar dependencia del puerto del servidor
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')
    const filePath = join(process.cwd(), 'media', media.filename)
    return await readFile(filePath)
  } catch (err) {
    console.error('fetchTileTexture error', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Multipart inválido' }, { status: 400 })
  }

  const file = formData.get('userImage')
  const tileIdRaw = formData.get('tileId')
  const surfacesRaw = String(formData.get('surfaces') || '')
  const wallColor = (formData.get('wallColor') as string) || null
  const sessionToken = (formData.get('sessionToken') as string) || null

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta la imagen del usuario.' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'La imagen debe ser un archivo de imagen.' }, { status: 400 })
  }
  if (file.size > MAX_USER_IMAGE_BYTES) {
    return NextResponse.json({ error: 'La imagen es demasiado grande (máx 12 MB).' }, { status: 400 })
  }

  const tileId = tileIdRaw ? Number(tileIdRaw) || String(tileIdRaw) : null
  if (!tileId) {
    return NextResponse.json({ error: 'Falta el azulejo.' }, { status: 400 })
  }

  const surfaces = surfacesRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is Surface => s === 'floor' || s === 'wall')

  if (surfaces.length === 0) {
    return NextResponse.json(
      { error: 'Selecciona al menos suelo o pared.' },
      { status: 400 },
    )
  }

  const payload = await getPayload({ config })

  // Sesión + rate limit
  const { session } = await getOrCreateSession(sessionToken)
  if (isSessionAtLimit(session)) {
    return NextResponse.json(
      {
        error: `Has alcanzado el límite de ${SESSION_CONSTANTS.GENERATION_LIMIT} simulaciones en esta sesión. Contacta para ver más opciones.`,
        sessionToken: session.token,
      },
      { status: 429 },
    )
  }

  // Tile + textura
  let tile: any
  try {
    tile = await payload.findByID({ collection: 'tiles', id: tileId as any, depth: 1 })
  } catch {
    return NextResponse.json({ error: 'Azulejo no encontrado.' }, { status: 404 })
  }
  if (!tile.published) {
    return NextResponse.json({ error: 'Azulejo no disponible.' }, { status: 404 })
  }

  const textureBuffer = await fetchTileTexture(payload, tile.id)
  if (!textureBuffer) {
    return NextResponse.json(
      { error: 'No se pudo cargar la imagen de referencia del azulejo.' },
      { status: 500 },
    )
  }

  // Procesar imagen de usuario: rotar EXIF, redimensionar, normalizar a JPEG
  const rawBuffer = await fileToBuffer(file)
  const processedUserImage = await sharp(rawBuffer)
    .rotate()
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer()

  // Subir la foto del usuario como Media
  const userMedia = await payload.create({
    collection: 'media',
    data: { alt: `Foto del usuario (sesión ${session.token.slice(0, 8)})` } as any,
    file: {
      name: `user-${Date.now()}.jpg`,
      data: processedUserImage,
      mimetype: 'image/jpeg',
      size: processedUserImage.length,
    },
  })

  // Crear registro de Generation (processing)
  const generation = await payload.create({
    collection: 'generations',
    data: {
      session: session.id,
      tile: tile.id,
      surfaces,
      wallColor: wallColor || undefined,
      userImage: userMedia.id,
      status: 'processing',
    } as any,
  })

  // Construir placement y llamar al proveedor IA
  const dominantColorHex = Array.isArray(tile.colors) && tile.colors[0]?.hex
    ? tile.colors[0].hex
    : null

  const placement: TilePlacement = {
    tileName: tile.name,
    tileSku: tile.sku,
    surface: surfaces[0],
    dominantColorHex,
    formatLabel: tile.format?.name || null,
    textureImage: textureBuffer,
  }

  const placements: TilePlacement[] = surfaces.map((surface) => ({ ...placement, surface }))

  const provider = getRenderingProvider()

  try {
    const result = await provider.generate({
      baseImage: processedUserImage,
      baseImageMimeType: 'image/jpeg',
      placements,
      globalEdits: wallColor ? { wallColorHex: wallColor } : undefined,
    })

    // Subir resultado a Media
    const resultMedia = await payload.create({
      collection: 'media',
      data: { alt: `Simulación con ${tile.name}` } as any,
      file: {
        name: `result-${generation.id}.${result.mimeType === 'image/png' ? 'png' : 'jpg'}`,
        data: result.imageBuffer,
        mimetype: result.mimeType,
        size: result.imageBuffer.length,
      },
    })

    // Actualizar la generación
    await payload.update({
      collection: 'generations',
      id: generation.id,
      data: {
        status: 'completed',
        resultImage: resultMedia.id,
        providerUsed: result.provider,
        promptUsed: result.promptUsed,
        costCents: result.costCents,
        latencyMs: result.latencyMs,
      } as any,
    })

    await incrementGenerationCount(session.id)

    return NextResponse.json({
      ok: true,
      sessionToken: session.token,
      generationId: generation.id,
      resultUrl: resultMedia.url,
      shareUrl: `/s/${session.token}`,
      provider: result.provider,
      latencyMs: result.latencyMs,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido en la generación.'
    console.error('Simulator generation failed:', err)

    await payload.update({
      collection: 'generations',
      id: generation.id,
      data: {
        status: 'failed',
        errorMessage: message,
      } as any,
    })

    return NextResponse.json(
      {
        error: 'No se pudo generar la simulación. Inténtalo de nuevo o prueba con otra foto.',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
        sessionToken: session.token,
      },
      { status: 500 },
    )
  }
}
