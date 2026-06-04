import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Healthcheck para Fly. Responde 200 OK con el uptime del proceso.
 * Si esto falla, Fly reinicia la máquina automáticamente.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
}
