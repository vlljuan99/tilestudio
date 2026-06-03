import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@payload-config'

export const metadata = { title: 'Ambientes' }

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
        <p className="text-muted-foreground">
          Inspírate con espacios reales y descubre qué azulejos se han utilizado.
        </p>
      </header>

      {ambients.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          Aún no hay ambientes publicados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ambients.map((a) => (
            <article key={a.id} className="space-y-2">
              <div className="aspect-[4/3] relative overflow-hidden rounded-lg bg-muted">
                {a.image?.url && (
                  <Image
                    src={a.image.url}
                    alt={a.image.alt || a.title}
                    fill
                    loading="eager"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                )}
              </div>
              <h2 className="text-xl">{a.title}</h2>
              {a.description && (
                <p className="text-sm text-muted-foreground">{a.description}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
