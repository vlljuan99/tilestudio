import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getSessionByToken } from '@/lib/session'

export const runtime = 'nodejs'

type Body = {
  name?: string
  phone?: string
  email?: string
  sqMeters?: number
  dontKnowSqm?: boolean
  comment?: string
  preferredChannel?: 'whatsapp' | 'email' | 'phone'
  source?: string
  tileId?: number | string
  sessionToken?: string
  generationId?: number | string
  shareUrl?: string
  consent?: boolean
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.consent) {
    return NextResponse.json(
      { error: 'Debes aceptar la política de privacidad.' },
      { status: 400 },
    )
  }

  if (!body.name && !body.phone && !body.email) {
    return NextResponse.json(
      { error: 'Indica al menos un nombre, teléfono o email para que podamos responderte.' },
      { status: 400 },
    )
  }

  const payload = await getPayload({ config })

  const session = body.sessionToken
    ? await getSessionByToken(body.sessionToken)
    : null

  const lead = await payload.create({
    collection: 'leads',
    data: {
      name: body.name,
      phone: body.phone,
      email: body.email,
      sqMeters: body.sqMeters,
      dontKnowSqm: !!body.dontKnowSqm,
      comment: body.comment,
      preferredChannel: body.preferredChannel || 'whatsapp',
      source: (body.source as any) || 'simulator',
      tileOfInterest: body.tileId,
      generationImageUrl: body.shareUrl,
      sessionId: body.sessionToken,
      status: 'new',
      consentAccepted: true,
    } as any,
  })

  if (session) {
    try {
      await payload.update({
        collection: 'simulator-sessions',
        id: session.id,
        data: { lead: lead.id } as any,
      })
    } catch (err) {
      console.warn('No se pudo vincular lead a sesión:', err)
    }
  }

  return NextResponse.json({ ok: true, leadId: lead.id })
}
