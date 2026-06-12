import Image from 'next/image'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

import { ArrowRight, Sparkles } from 'lucide-react'

export const metadata = {
  title: 'Ambientes',
  description:
    'Inspírate con espacios reales, descubre los azulejos que los hacen posibles y pruébalos en tu propia casa con IA.',
}

export default async function AmbientsPage() {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'ambients',
    where: { published: { equals: true } },
    limit: 30,
    depth: 1,
  })

  const ambients = result.docs as any[]

  return (
    <div className="container py-8 md:py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl">Ambientes</h1>
        <p className="text-muted-foreground max-w-prose">
          Inspírate con espacios reales, descubre qué azulejos los hacen posibles y pruébalos en
          una foto de tu propia casa con IA.
        </p>
      </header>

      {ambients.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          Aún no hay ambientes publicados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {ambients.map((a) => {
            const tileCount = a.tilesUsed?.length || 0
            return (
              <Link key={a.id} href={`/ambientes/${a.slug}`} className="group block space-y-3">
                <div className="aspect-[4/3] relative overflow-hidden rounded-xl bg-muted">
                  {a.image?.url && (
                    <Image
                      src={a.image.url}
                      alt={a.image.alt || a.title}
                      fill
                      loading="eager"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                  {tileCount > 0 && (
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur px-3 py-1 text-xs font-medium text-white">
                      <Sparkles className="h-3 w-3" />
                      {tileCount === 1 ? '1 azulejo para probar' : `${tileCount} azulejos para probar`}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {(a.roomType?.name || a.style) && (
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {[a.roomType?.name, a.style].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <h2 className="text-xl leading-snug group-hover:underline">{a.title}</h2>
                  {a.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                  )}
                  <p className="text-sm text-primary font-medium inline-flex items-center gap-1 pt-1">
                    Ver el ambiente y probarlo en tu casa <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
