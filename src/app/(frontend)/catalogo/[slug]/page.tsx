import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

import { Button } from '@/components/ui/button'
import { Sparkles, MessageCircle } from 'lucide-react'
import { formatPrice, buildWhatsAppLink } from '@/lib/utils'

async function getTile(slug: string) {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'tiles',
    where: { and: [{ slug: { equals: slug } }, { published: { equals: true } }] },
    limit: 1,
    depth: 2,
  })
  return (res.docs[0] as any) || null
}

async function getSettings() {
  const payload = await getPayload({ config })
  try {
    return (await payload.findGlobal({ slug: 'site-settings' })) as any
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tile = await getTile(slug)
  if (!tile) return { title: 'Azulejo no encontrado' }
  return {
    title: tile.name,
    description: tile.description?.slice(0, 160),
  }
}

export default async function TileDetail({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [tile, settings] = await Promise.all([getTile(slug), getSettings()])
  if (!tile) notFound()

  const whatsapp = buildWhatsAppLink({
    number: settings?.whatsappNumber,
    message: `Hola, me interesa el azulejo "${tile.name}"${tile.sku ? ` (ref. ${tile.sku})` : ''}. ¿Me podéis dar más información?`,
  })

  const ambient = tile.mainImage
  const texture = tile.textureImage
  // Solo mostramos la textura como bloque aparte si es distinta de la imagen ambiente.
  const showTextureBlock = texture && ambient && texture.id !== ambient.id

  const attributes = [
    { label: 'Colección', value: tile.collection?.name },
    { label: 'Marca', value: tile.brand?.name },
    { label: 'Formato', value: tile.format?.name },
    { label: 'Acabado', value: tile.finish?.name },
    { label: 'Colores', value: tile.colors?.map((c: any) => c.name).join(', ') },
    { label: 'Usos', value: tile.usages?.map((u: any) => u.name).join(', ') },
    { label: 'Estancias', value: tile.rooms?.map((r: any) => r.name).join(', ') },
    { label: 'Referencia', value: tile.sku },
  ].filter((a) => a.value)

  return (
    <div className="container py-8 md:py-12 grid md:grid-cols-2 gap-8 lg:gap-12">
      {/* Columna izquierda: imagen de ambiente grande */}
      <div className="md:sticky md:top-24 md:self-start">
        <div className="aspect-[4/5] relative overflow-hidden rounded-lg bg-muted">
          {ambient?.url && (
            <Image
              src={ambient.url}
              alt={ambient.alt || `${tile.name} en ambiente`}
              fill
              priority
              loading="eager"
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">Imagen de ambiente</p>
      </div>

      {/* Columna derecha: info, CTAs, atributos y detalle del azulejo */}
      <div className="space-y-6">
        <div className="space-y-2">
          {tile.collection?.name && (
            <p className="text-sm uppercase tracking-wider text-muted-foreground">
              {tile.collection.name}
            </p>
          )}
          <h1 className="text-3xl md:text-4xl">{tile.name}</h1>
          <p className="text-xl">{formatPrice(tile.orientativePrice, tile.priceUnit)}</p>
          <p className="text-xs text-muted-foreground">
            Precio orientativo. La disponibilidad y precio final se confirman al contactar.
          </p>
        </div>

        {tile.description && (
          <p className="text-muted-foreground leading-relaxed">{tile.description}</p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={`/simulador?tile=${tile.slug}`}>
              <Sparkles className="h-5 w-5" /> Probar en mi espacio con IA
            </Link>
          </Button>
          {whatsapp && (
            <Button asChild size="lg" variant="whatsapp">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5" /> Pedir info por WhatsApp
              </a>
            </Button>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-y-3 gap-x-6 border-t border-border pt-6 text-sm">
          {attributes.map((a) => (
            <div key={a.label}>
              <dt className="text-muted-foreground text-xs uppercase tracking-wider">{a.label}</dt>
              <dd>{a.value}</dd>
            </div>
          ))}
        </dl>

        {/* Detalle del azulejo (textura) — solo si tenemos una imagen distinta a la de ambiente */}
        {showTextureBlock && (
          <div className="border-t border-border pt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Detalle del azulejo
            </p>
            <div className="relative overflow-hidden rounded-lg bg-muted border border-border">
              <img
                src={texture.url}
                alt={`Textura de ${tile.name}`}
                loading="eager"
                className="block w-full h-auto object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
