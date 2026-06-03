import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'

type TileCardProps = {
  tile: {
    id: number | string
    slug: string
    name: string
    sku?: string | null
    orientativePrice?: number | null
    priceUnit?: string | null
    mainImage?: { url?: string | null; alt?: string | null } | null
    format?: { name?: string | null } | null
    finish?: { name?: string | null } | null
  }
}

export function TileCard({ tile }: TileCardProps) {
  return (
    <Link href={`/catalogo/${tile.slug}`} className="group block">
      <div className="aspect-square relative overflow-hidden rounded-lg bg-muted">
        {tile.mainImage?.url ? (
          <Image
            src={tile.mainImage.url}
            alt={tile.mainImage.alt || tile.name}
            fill
            loading="eager"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            Sin imagen
          </div>
        )}
      </div>
      <div className="pt-3 space-y-1">
        <p className="font-medium leading-tight">{tile.name}</p>
        <p className="text-xs text-muted-foreground">
          {[tile.format?.name, tile.finish?.name].filter(Boolean).join(' · ')}
        </p>
        <p className="text-sm">{formatPrice(tile.orientativePrice, tile.priceUnit)}</p>
      </div>
    </Link>
  )
}
