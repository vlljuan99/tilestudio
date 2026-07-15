import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

export const metadata = { title: 'Importar catálogos' }

const STATUS_LABEL: Record<string, string> = {
  queued: 'Lista para empezar',
  processing: 'Leyendo el catálogo',
  review_ready: 'Lista para revisar',
  importing: 'Añadiendo al catálogo',
  completed: 'Completada',
  failed: 'Algo falló',
}

const STATUS_CLASS: Record<string, string> = {
  queued: 'bg-muted text-foreground',
  processing: 'bg-primary/15 text-primary',
  review_ready: 'bg-green-600/15 text-green-700',
  importing: 'bg-amber-500/15 text-amber-700',
  completed: 'bg-green-600/15 text-green-700',
  failed: 'bg-destructive/15 text-destructive',
}

export default async function ImportarPage() {
  const payload = await getPayload({ config })
  const imports = await payload.find({
    collection: 'pdf-imports',
    limit: 100,
    sort: '-createdAt',
    depth: 1,
  })

  return (
    <div className="max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl">Importar catálogos</h1>
          <p className="text-sm text-muted-foreground">
            Sube el PDF de un proveedor y el sistema encuentra los azulejos; luego los revisas y
            publicas.
          </p>
        </div>
        <Link
          href="/ventas/importar/nuevo"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          + Importar catálogo
        </Link>
      </header>

      {imports.docs.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">Todavía no has importado ningún catálogo.</p>
          <Link
            href="/ventas/importar/nuevo"
            className="inline-block mt-3 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
          >
            Importar el primero
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {imports.docs.map((doc: any) => {
            const status = doc.status || 'queued'
            const brand = typeof doc.brand === 'object' ? doc.brand?.name : null
            return (
              <li key={doc.id}>
                <Link
                  href={`/ventas/importar/${doc.id}`}
                  className="flex flex-wrap items-center gap-3 border border-border rounded-lg p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-[55%]">
                    <p className="font-medium">{doc.displayName || `Importación ${doc.id}`}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {brand ? `${brand} · ` : ''}
                      {doc.candidatesCount || 0} azulejos encontrados
                      {status === 'processing' && doc.totalPages
                        ? ` · página ${doc.processedPages || 0} de ${doc.totalPages}`
                        : ''}
                      {' · '}
                      {new Date(doc.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  {status === 'processing' && (
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${doc.progressPercent || 0}%` }}
                      />
                    </div>
                  )}
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CLASS[status] || 'bg-muted'}`}
                  >
                    {STATUS_LABEL[status] || status}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
