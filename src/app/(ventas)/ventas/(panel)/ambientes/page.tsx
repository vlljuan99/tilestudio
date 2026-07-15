import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

export const metadata = { title: 'Ambientes' }

export default async function AmbientesPage() {
  const payload = await getPayload({ config })
  const ambients = await payload.find({
    collection: 'ambients',
    limit: 200,
    sort: '-updatedAt',
    depth: 1,
  })

  return (
    <div className="max-w-5xl">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl">Ambientes</h1>
          <p className="text-sm text-muted-foreground">
            Fotos de estancias reales con tus azulejos, para inspirar a los clientes.
          </p>
        </div>
        <Link
          href="/ventas/ambientes/nuevo"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          + Añadir ambiente
        </Link>
      </header>

      {ambients.docs.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Todavía no hay ambientes. Se crean también automáticamente al importar catálogos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {ambients.docs.map((a: any) => {
            const img = typeof a.image === 'object' ? a.image : null
            return (
              <Link
                key={a.id}
                href={`/ventas/ambientes/${a.id}`}
                className="border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-card"
              >
                {img?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.url} alt={a.title} className="w-full aspect-[4/3] object-cover" />
                ) : (
                  <div className="w-full aspect-[4/3] bg-muted" />
                )}
                <div className="p-2.5">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {(a.tilesUsed || []).length} azulejo{(a.tilesUsed || []).length === 1 ? '' : 's'}
                    {a.published === false ? ' · sin publicar' : ''}
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
