import Link from 'next/link'

import { TilesList } from '@/components/ventas/TilesList'

export const metadata = { title: 'Azulejos' }

export default function AzulejosPage() {
  return (
    <div className="max-w-5xl">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl">Azulejos</h1>
          <p className="text-sm text-muted-foreground">
            Todo tu catálogo. Los publicados son los que ven tus clientes en la web.
          </p>
        </div>
        <Link
          href="/ventas/azulejos/nuevo"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          + Añadir azulejo
        </Link>
      </header>
      <TilesList />
    </div>
  )
}
