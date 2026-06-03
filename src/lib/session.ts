import crypto from 'crypto'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

const SESSION_TTL_DAYS = 14
const GENERATION_LIMIT_PER_SESSION = 5

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

async function payload(): Promise<Payload> {
  return getPayload({ config })
}

export async function createSession(meta?: Record<string, unknown>) {
  const p = await payload()
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  const doc = await p.create({
    collection: 'simulator-sessions',
    data: {
      token,
      generationCount: 0,
      expiresAt: expiresAt.toISOString(),
      meta: meta || {},
    } as any,
  })
  return doc as any
}

export async function getSessionByToken(token: string) {
  if (!token || typeof token !== 'string' || token.length < 32) return null
  const p = await payload()
  const res = await p.find({
    collection: 'simulator-sessions',
    where: { token: { equals: token } },
    limit: 1,
    depth: 0,
  })
  const session = res.docs[0] as any
  if (!session) return null
  if (new Date(session.expiresAt).getTime() < Date.now()) return null
  return session
}

export async function getOrCreateSession(token?: string | null) {
  if (token) {
    const existing = await getSessionByToken(token)
    if (existing) return { session: existing, created: false as const }
  }
  const session = await createSession()
  return { session, created: true as const }
}

export async function incrementGenerationCount(sessionId: number | string) {
  const p = await payload()
  const current = (await p.findByID({
    collection: 'simulator-sessions',
    id: sessionId as any,
  })) as any
  const next = (current.generationCount || 0) + 1
  await p.update({
    collection: 'simulator-sessions',
    id: sessionId as any,
    data: { generationCount: next } as any,
  })
  return next
}

export async function listGenerationsForSession(sessionId: number | string) {
  const p = await payload()
  const res = await p.find({
    collection: 'generations',
    where: { session: { equals: sessionId } },
    sort: '-createdAt',
    limit: 20,
    depth: 2,
  })
  return res.docs as any[]
}

export function isSessionAtLimit(session: { generationCount?: number | null }) {
  return (session.generationCount || 0) >= GENERATION_LIMIT_PER_SESSION
}

export const SESSION_CONSTANTS = {
  TTL_DAYS: SESSION_TTL_DAYS,
  GENERATION_LIMIT: GENERATION_LIMIT_PER_SESSION,
}
