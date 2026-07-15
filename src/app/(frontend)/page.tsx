import Link from 'next/link'
import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@payload-config'

import { Button } from '@/components/ui/button'
import { BeforeAfterSlider } from '@/components/site/BeforeAfterSlider'
import { Sparkles, Camera, Wand2, MessageCircle } from 'lucide-react'

async function getFeaturedTiles() {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'tiles',
    where: { and: [{ published: { equals: true } }, { featured: { equals: true } }] },
    limit: 8,
    depth: 1,
  })
  return result.docs
}

// Bloques "explora por estancia": cada estancia se ilustra con la imagen de
// ambiente de uno de sus azulejos publicados. Estancias sin azulejos no se
// muestran (evita enlaces a un catálogo vacío).
async function getRoomShowcase() {
  const payload = await getPayload({ config })
  const rooms = await payload.find({ collection: 'rooms', limit: 12, sort: 'name', depth: 0 })
  const withImage = await Promise.all(
    (rooms.docs as any[]).map(async (room) => {
      const tiles = await payload.find({
        collection: 'tiles',
        where: { and: [{ published: { equals: true } }, { rooms: { in: [room.id] } }] },
        limit: 1,
        depth: 1,
        sort: '-featured',
      })
      const tile = tiles.docs[0] as any
      if (!tile) return null
      return {
        ...room,
        tileCount: tiles.totalDocs,
        image: tile.mainImage || tile.textureImage || null,
      }
    }),
  )
  return withImage.filter(Boolean) as any[]
}

async function getSettings() {
  const payload = await getPayload({ config })
  try {
    return await payload.findGlobal({ slug: 'site-settings', depth: 1 })
  } catch {
    return null
  }
}

export default async function HomePage() {
  const [tiles, settings, roomShowcase] = await Promise.all([
    getFeaturedTiles(),
    getSettings(),
    getRoomShowcase(),
  ])

  const heroTitle =
    settings?.heroTitle ||
    'Visualiza tus azulejos en tu propio espacio, con inteligencia artificial.'
  const heroSubtitle =
    settings?.heroSubtitle ||
    'Sube una foto de tu estancia, elige el azulejo que te gusta y deja que la IA te muestre cómo quedaría. Sin compromiso.'

  const heroBeforeImage = (settings as any)?.heroBeforeImage?.url as string | undefined
  const heroAfterImage = (settings as any)?.heroAfterImage?.url as string | undefined

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="container py-8 md:py-28 flex flex-col md:grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Slider – first on mobile for visual impact */}
          <div className="w-full order-1 md:order-2 -mx-4 px-0 md:mx-0 md:px-0">
            <BeforeAfterSlider
              beforeSrc={heroBeforeImage}
              afterSrc={heroAfterImage}
              className="w-full aspect-[4/3] md:aspect-[4/3]"
            />
          </div>

          {/* Text */}
          <div className="space-y-6 order-2 md:order-1">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 text-accent px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Simulación con IA
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl leading-tight">{heroTitle}</h1>
            <p className="text-lg text-muted-foreground max-w-prose">{heroSubtitle}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/simulador">
                  <Sparkles className="h-5 w-5" /> Probar con IA
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/catalogo">Ver catálogo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="border-y border-border bg-muted/30">
        <div className="container py-16">
          <h2 className="text-3xl mb-10 text-center">¿Cómo funciona?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Camera,
                title: '1. Haz una foto',
                text: 'Sube una imagen de tu baño, cocina o salón desde el móvil o el ordenador.',
              },
              {
                icon: Wand2,
                title: '2. Elige el azulejo',
                text: 'Selecciona el azulejo que te interesa de nuestro catálogo y dónde aplicarlo.',
              },
              {
                icon: MessageCircle,
                title: '3. Habla con nosotros',
                text: 'Si te gusta el resultado, contacta por WhatsApp y te asesoramos sin compromiso.',
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="space-y-3 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl">{title}</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXPLORA POR ESTANCIA */}
      {roomShowcase.length > 0 && (
        <section className="container py-16">
          <div className="flex items-end justify-between mb-8">
            <div className="space-y-1">
              <h2 className="text-3xl">¿Qué vas a reformar?</h2>
              <p className="text-muted-foreground text-sm">
                Ve directo a los azulejos pensados para tu espacio.
              </p>
            </div>
            <Link href="/ambientes" className="text-sm hover:underline shrink-0">
              Ver ambientes →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {roomShowcase.map((room: any) => (
              <Link
                key={room.id}
                href={`/catalogo?estancia=${room.slug}`}
                className="group block aspect-[4/3] relative overflow-hidden rounded-xl bg-muted"
              >
                {room.image?.url && (
                  <Image
                    src={room.image.url}
                    alt={room.image.alt || room.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-white text-lg font-medium leading-tight">{room.name}</p>
                  <p className="text-white/70 text-xs">
                    {room.tileCount === 1 ? '1 azulejo' : `${room.tileCount} azulejos`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* DESTACADOS */}
      {tiles.length > 0 && (
        <section className="container py-16">
          <div className="flex items-end justify-between mb-8">
            <h2 className="text-3xl">Destacados</h2>
            <Link href="/catalogo" className="text-sm hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tiles.map((tile: any) => {
              const cardImage = tile.textureImage?.url ? tile.textureImage : tile.mainImage
              return (
              <Link
                key={tile.id}
                href={`/catalogo/${tile.slug}`}
                className="group block aspect-square relative overflow-hidden rounded-lg bg-muted"
              >
                {cardImage?.url && (
                  <Image
                    src={cardImage.url}
                    alt={cardImage.alt || tile.name}
                    fill
                    loading="eager"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-white text-sm font-medium">{tile.name}</p>
                </div>
              </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
