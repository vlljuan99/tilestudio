import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

import { Button } from '@/components/ui/button'
import { Sparkles, MessageCircle, Camera, Wand2, ChevronLeft, ArrowRight } from 'lucide-react'
import { formatPrice, buildWhatsAppLink } from '@/lib/utils'

const SURFACE_LABELS: Record<string, string> = {
  floor: 'Suelo',
  wall: 'Pared',
  other: 'Detalle',
}

async function getAmbient(slug: string) {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'ambients',
    where: { and: [{ slug: { equals: slug } }, { published: { equals: true } }] },
    limit: 1,
    depth: 2,
  })
  return (res.docs[0] as any) || null
}

async function getMoreAmbients(excludeId: number | string) {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'ambients',
    where: { and: [{ published: { equals: true } }, { id: { not_equals: excludeId } }] },
    limit: 4,
    depth: 1,
  })
  return res.docs as any[]
}

async function getSettings() {
  const payload = await getPayload({ config })
  try {
    return (await payload.findGlobal({ slug: 'site-settings' })) as any
  } catch {
    return null
  }
}

// Agrupa los azulejos del ambiente: un mismo azulejo puede aparecer en suelo y
// pared, y lo queremos como una sola tarjeta con sus superficies.
function groupTiles(ambient: any): { tile: any; surfaces: string[] }[] {
  const grouped: { tile: any; surfaces: string[] }[] = []
  for (const item of ambient.tilesUsed || []) {
    const tile = item.tile
    // El API local salta el control de acceso: filtramos no publicados a mano.
    if (!tile || typeof tile !== 'object' || !tile.published) continue
    const entry = grouped.find((g) => g.tile.id === tile.id)
    if (entry) {
      if (item.surface && !entry.surfaces.includes(item.surface)) entry.surfaces.push(item.surface)
    } else {
      grouped.push({ tile, surfaces: item.surface ? [item.surface] : [] })
    }
  }
  return grouped
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ambient = await getAmbient(slug)
  if (!ambient) return { title: 'Ambiente no encontrado' }
  const description =
    ambient.description?.slice(0, 160) ||
    `Descubre los azulejos de este ambiente y pruébalos en tu propia casa con IA.`
  return {
    title: ambient.title,
    description,
    openGraph: {
      title: ambient.title,
      description,
      images: ambient.image?.url ? [{ url: ambient.image.url }] : undefined,
    },
  }
}

export default async function AmbientDetail({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [ambient, settings] = await Promise.all([getAmbient(slug), getSettings()])
  if (!ambient) notFound()

  const moreAmbients = await getMoreAmbients(ambient.id)
  const tiles = groupTiles(ambient)
  const firstTile = tiles[0]?.tile

  const roomName: string | undefined = ambient.roomType?.name
  const roomLower = roomName ? roomName.toLowerCase() : 'estancia'

  const intro =
    ambient.description ||
    `Así puede verse ${roomName ? `un ${roomLower}` : 'tu espacio'}${
      ambient.style ? ` de estilo ${ambient.style}` : ''
    } con los azulejos adecuados. Y lo mejor: puedes comprobar cómo quedaría en tu propia casa antes de decidir.`

  const whatsapp = buildWhatsAppLink({
    number: settings?.whatsappNumber,
    message: `Hola, me ha encantado el ambiente "${ambient.title}" que he visto en la web. ¿Me podéis ayudar a conseguir algo así?`,
  })

  const simulatorHref = firstTile ? `/simulador?tile=${firstTile.slug}` : '/simulador'

  return (
    <div className="pb-28 md:pb-0">
      {/* HERO inmersivo a sangre — en móvil ocupa casi toda la pantalla */}
      <section className="relative">
        <div className="relative aspect-[4/5] sm:aspect-[16/10] lg:aspect-[21/9] max-h-[80vh] w-full overflow-hidden bg-muted">
          {ambient.image?.url && (
            <Image
              src={ambient.image.url}
              alt={ambient.image.alt || ambient.title}
              fill
              priority
              loading="eager"
              sizes="100vw"
              className="object-cover"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

          <Link
            href="/ambientes"
            className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full bg-background/85 backdrop-blur px-3 py-1.5 text-xs font-medium hover:bg-background"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Ambientes
          </Link>

          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
            <div className="container px-0 sm:px-0 space-y-2">
              <div className="flex flex-wrap gap-2">
                {roomName && (
                  <span className="rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium text-white">
                    {roomName}
                  </span>
                )}
                {ambient.style && (
                  <span className="rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium text-white capitalize">
                    {ambient.style}
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl text-white leading-tight">
                {ambient.title}
              </h1>
            </div>
          </div>
        </div>
      </section>

      <div className="container py-8 md:py-12 space-y-10 md:space-y-16">
        {/* Intro vendedora */}
        <section className="max-w-prose space-y-4">
          <p className="text-base md:text-lg leading-relaxed text-muted-foreground">{intro}</p>
          {tiles.length > 0 && (
            <p className="text-sm font-medium">
              Este look se consigue con {tiles.length === 1 ? 'este azulejo' : `estos ${tiles.length} azulejos`} — y
              puedes verlo aplicado en una foto de tu {roomLower} en menos de un minuto.
            </p>
          )}
        </section>

        {/* Los azulejos que crean este ambiente */}
        {tiles.length > 0 && (
          <section className="space-y-5">
            <header className="space-y-1">
              <h2 className="text-2xl md:text-3xl">Consigue este look</h2>
              <p className="text-sm text-muted-foreground">
                Los azulejos que dan vida a este ambiente, listos para probar.
              </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tiles.map(({ tile, surfaces }) => {
                const thumb = tile.textureImage?.url ? tile.textureImage : tile.mainImage
                return (
                  <article
                    key={tile.id}
                    className="rounded-xl border border-border bg-card overflow-hidden flex flex-col"
                  >
                    <div className="flex gap-4 p-4 flex-1">
                      <Link
                        href={`/catalogo/${tile.slug}`}
                        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted"
                      >
                        {thumb?.url && (
                          <Image
                            src={thumb.url}
                            alt={thumb.alt || tile.name}
                            fill
                            loading="eager"
                            sizes="96px"
                            className="object-cover"
                          />
                        )}
                      </Link>
                      <div className="min-w-0 flex-1 space-y-1">
                        {surfaces.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {surfaces.map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium"
                              >
                                {SURFACE_LABELS[s] || s}
                              </span>
                            ))}
                          </div>
                        )}
                        <Link href={`/catalogo/${tile.slug}`} className="block font-medium leading-tight hover:underline">
                          {tile.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {[tile.format?.name, tile.finish?.name].filter(Boolean).join(' · ')}
                        </p>
                        <p className="text-sm">{formatPrice(tile.orientativePrice, tile.priceUnit)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
                      <Button asChild size="sm">
                        <Link href={`/simulador?tile=${tile.slug}`}>
                          <Sparkles className="h-4 w-4" /> Probar con IA
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/catalogo/${tile.slug}`}>Ver ficha</Link>
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {/* Bloque de venta: empuja al simulador */}
        <section className="rounded-2xl bg-primary text-primary-foreground p-6 md:p-10 space-y-6">
          <div className="space-y-2 max-w-prose">
            <h2 className="text-2xl md:text-3xl text-primary-foreground">
              ¿Te lo imaginas en tu casa? No te lo imagines: míralo.
            </h2>
            <p className="text-sm md:text-base opacity-90">
              Haz una foto de tu {roomLower} con el móvil y nuestra IA te enseña al momento cómo
              quedaría {tiles.length === 1 ? 'este azulejo' : 'cada azulejo'} en tu espacio real.
              Gratis y sin compromiso.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs sm:text-sm">
            {[
              { icon: Camera, text: 'Haz una foto' },
              { icon: Wand2, text: 'La IA lo aplica' },
              { icon: MessageCircle, text: 'Te asesoramos' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="space-y-2">
                <div className="mx-auto w-10 h-10 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="opacity-90">{text}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg" variant="outline" className="bg-primary-foreground text-primary border-transparent hover:bg-primary-foreground/90">
              <Link href={simulatorHref}>
                <Sparkles className="h-5 w-5" /> Probar este ambiente con IA
              </Link>
            </Button>
            {whatsapp && (
              <Button asChild size="lg" variant="whatsapp">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5" /> Pedir consejo por WhatsApp
                </a>
              </Button>
            )}
          </div>
        </section>

        {/* Más inspiración */}
        {moreAmbients.length > 0 && (
          <section className="space-y-5">
            <div className="flex items-end justify-between">
              <h2 className="text-2xl md:text-3xl">Más ambientes</h2>
              <Link href="/ambientes" className="text-sm hover:underline inline-flex items-center gap-1">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {moreAmbients.map((a) => (
                <Link key={a.id} href={`/ambientes/${a.slug}`} className="group block space-y-2">
                  <div className="aspect-[4/3] relative overflow-hidden rounded-lg bg-muted">
                    {a.image?.url && (
                      <Image
                        src={a.image.url}
                        alt={a.image.alt || a.title}
                        fill
                        loading="eager"
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <p className="text-sm font-medium leading-tight group-hover:underline">{a.title}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* CTA flotante solo en móvil — deja sitio al FAB de WhatsApp a la derecha */}
      <div className={`fixed bottom-5 left-4 z-40 md:hidden ${whatsapp ? 'right-24' : 'right-4'}`}>
        <Button asChild size="lg" className="w-full rounded-full shadow-lg">
          <Link href={simulatorHref}>
            <Sparkles className="h-5 w-5" /> Probar en mi casa
          </Link>
        </Button>
      </div>
    </div>
  )
}
