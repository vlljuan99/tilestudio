'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Sparkles, MessageCircle, Mail, Phone, Copy, Check, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { buildWhatsAppLink } from '@/lib/utils'
import { LeadModal } from './LeadModal'

type Gen = {
  id: number | string
  resultImage?: { url?: string | null; alt?: string | null } | null
  surfaces?: string[]
  wallColor?: string | null
  tile?: {
    id: number | string
    name: string
    slug: string
    sku?: string | null
    mainImage?: { url?: string | null } | null
  } | null
  createdAt?: string
}

type Settings = {
  siteName?: string | null
  whatsappNumber?: string | null
  phone?: string | null
  email?: string | null
} | null

export function ShareView({
  token,
  generations,
  settings,
}: {
  token: string
  generations: Gen[]
  settings: Settings
}) {
  const latest = generations[0]
  const [activeId, setActiveId] = useState<string | number>(latest.id)
  const [modalOpen, setModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const active = generations.find((g) => g.id === activeId) || latest
  const tile = active.tile
  const surfaceLabel = (active.surfaces || [])
    .map((s) => (s === 'floor' ? 'suelo' : 'pared'))
    .join(' + ')

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  const waMessage = `Hola, vengo del simulador de ${settings?.siteName || 'Tilestudio'}.
Me interesa el azulejo "${tile?.name}"${tile?.sku ? ` (ref. ${tile.sku})` : ''}.
Aquí está mi simulación: ${shareUrl}
Superficie aplicada: ${surfaceLabel || '—'}.`

  const wa = buildWhatsAppLink({
    number: settings?.whatsappNumber,
    message: waMessage,
  })

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="container py-6 md:py-10 max-w-5xl">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Tu simulación
          </p>
          <h1 className="text-2xl md:text-3xl mt-1">
            {tile?.name}
            {surfaceLabel && (
              <span className="text-muted-foreground text-base md:text-lg ml-2">
                · {surfaceLabel}
              </span>
            )}
          </h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/simulador">
            <RefreshCw className="h-4 w-4" /> Otra simulación
          </Link>
        </Button>
      </header>

      <div className="aspect-[4/3] md:aspect-[3/2] relative rounded-lg overflow-hidden bg-muted">
        {active.resultImage?.url && (
          <Image
            src={active.resultImage.url}
            alt={active.resultImage.alt || `Simulación con ${tile?.name}`}
            fill
            priority
            loading="eager"
            sizes="(max-width: 1024px) 100vw, 80vw"
            className="object-cover"
          />
        )}
        <span className="absolute bottom-3 left-3 bg-background/85 text-xs px-2 py-1 rounded">
          ✨ Generado con IA · resultado orientativo
        </span>
      </div>

      {generations.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {generations.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveId(g.id)}
              className={`shrink-0 h-16 w-20 relative rounded overflow-hidden border-2 ${
                g.id === activeId ? 'border-primary' : 'border-transparent'
              }`}
            >
              {g.resultImage?.url && (
                <Image
                  src={g.resultImage.url}
                  alt=""
                  fill
                  loading="eager"
                  sizes="80px"
                  className="object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}

      <section className="grid md:grid-cols-3 gap-3 mt-6">
        <Button size="lg" onClick={() => setModalOpen(true)}>
          <Sparkles className="h-5 w-5" /> Me interesa, contactar
        </Button>
        {wa && (
          <Button asChild size="lg" variant="whatsapp">
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" /> Enviar por WhatsApp
            </a>
          </Button>
        )}
        <Button variant="outline" size="lg" onClick={copyShare}>
          {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          {copied ? 'Enlace copiado' : 'Copiar enlace'}
        </Button>
      </section>

      {tile && (
        <section className="mt-8 border-t border-border pt-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded relative overflow-hidden bg-muted shrink-0">
            {tile.mainImage?.url && (
              <Image
                src={tile.mainImage.url}
                alt=""
                fill
                loading="eager"
                sizes="64px"
                className="object-cover"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Azulejo</p>
            <Link href={`/catalogo/${tile.slug}`} className="font-medium hover:underline">
              {tile.name}
            </Link>
            {tile.sku && (
              <p className="text-xs text-muted-foreground">Ref. {tile.sku}</p>
            )}
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground mt-8 text-center">
        Este enlace caduca a los 14 días. Guárdalo si quieres volver a verlo.
      </p>

      <LeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sessionToken={token}
        generationId={active.id}
        tileId={tile?.id}
        tileName={tile?.name}
        tileSku={tile?.sku}
        settings={settings}
        shareUrl={shareUrl}
        surfaceLabel={surfaceLabel}
      />
    </div>
  )
}
