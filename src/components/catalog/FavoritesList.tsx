'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageCircle, Heart } from 'lucide-react'

import { TileCard } from './TileCard'
import { useFavorites } from '@/lib/favorites'
import { buildWhatsAppLink } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function FavoritesList({ whatsappNumber }: { whatsappNumber?: string | null }) {
  const { slugs, ready } = useFavorites()
  const [tiles, setTiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ready) return
    if (slugs.length === 0) {
      setTiles([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    const params = [
      ...slugs.map((slug, i) => `where[slug][in][${i}]=${encodeURIComponent(slug)}`),
      'where[published][equals]=true',
      'limit=100',
      'depth=1',
    ].join('&')
    fetch(`/api/tiles?${params}`, { signal: controller.signal, credentials: 'omit' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        const docs: any[] = data?.docs || []
        // Conserva el orden en que el cliente los fue guardando.
        docs.sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug))
        setTiles(docs)
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setTiles([])
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [ready, slugs])

  if (!ready || loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (tiles.length === 0) {
    return (
      <div className="py-16 text-center space-y-4">
        <Heart className="h-10 w-10 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">
          Aún no has guardado ningún azulejo. Toca el corazón de cualquier azulejo para tenerlo
          aquí a mano.
        </p>
        <Button asChild>
          <Link href="/catalogo">Explorar el catálogo</Link>
        </Button>
      </div>
    )
  }

  const message = [
    'Hola, me interesan estos azulejos de vuestra web:',
    ...tiles.map((t) => {
      const ref = t.sku ? ` (ref. ${t.sku})` : ''
      const url = typeof window !== 'undefined' ? `${window.location.origin}/catalogo/${t.slug}` : ''
      return `• ${t.name}${ref} ${url}`.trim()
    }),
    '¿Me podéis dar más información?',
  ].join('\n')
  const whatsapp = buildWhatsAppLink({ number: whatsappNumber, message })

  return (
    <div className="space-y-8">
      {whatsapp && (
        <Button asChild size="lg" variant="whatsapp">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-5 w-5" /> Enviar mi selección por WhatsApp
          </a>
        </Button>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
        {tiles.map((tile) => (
          <TileCard key={tile.id} tile={tile} />
        ))}
      </div>
    </div>
  )
}
