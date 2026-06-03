import Link from 'next/link'
import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@payload-config'

import { Button } from '@/components/ui/button'
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

async function getSettings() {
  const payload = await getPayload({ config })
  try {
    return await payload.findGlobal({ slug: 'site-settings', depth: 1 })
  } catch {
    return null
  }
}

export default async function HomePage() {
  const [tiles, settings] = await Promise.all([getFeaturedTiles(), getSettings()])

  const heroTitle =
    settings?.heroTitle ||
    'Visualiza tus azulejos en tu propio espacio, con inteligencia artificial.'
  const heroSubtitle =
    settings?.heroSubtitle ||
    'Sube una foto de tu estancia, elige el azulejo que te gusta y deja que la IA te muestre cómo quedaría. Sin compromiso.'

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="container py-16 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
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
          <div className="aspect-[4/3] rounded-xl bg-muted relative overflow-hidden">
            <div className="absolute inset-0 grid grid-cols-2">
              <div className="border-r border-background flex items-end p-4">
                <span className="text-xs uppercase tracking-wider text-muted-foreground bg-background/80 px-2 py-1 rounded">Antes</span>
              </div>
              <div className="bg-primary/10 flex items-end p-4">
                <span className="text-xs uppercase tracking-wider text-primary bg-background/80 px-2 py-1 rounded">Con IA</span>
              </div>
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
            {tiles.map((tile: any) => (
              <Link
                key={tile.id}
                href={`/catalogo/${tile.slug}`}
                className="group block aspect-square relative overflow-hidden rounded-lg bg-muted"
              >
                {tile.mainImage?.url && (
                  <Image
                    src={tile.mainImage.url}
                    alt={tile.mainImage.alt || tile.name}
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
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
