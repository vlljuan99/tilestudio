'use client'

import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFavorites } from '@/lib/favorites'

type Props = {
  slug: string
  /** 'overlay' = corazón flotante sobre la imagen; 'button' = botón con texto para la ficha. */
  variant?: 'overlay' | 'button'
  className?: string
}

export function FavoriteButton({ slug, variant = 'overlay', className }: Props) {
  const { has, toggle, ready } = useFavorites()
  const active = ready && has(slug)

  function onClick(e: React.MouseEvent) {
    // El overlay vive dentro del <Link> de la card: no debe navegar.
    e.preventDefault()
    e.stopPropagation()
    toggle(slug)
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-md border px-6 text-sm font-medium transition-colors',
          active
            ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-border bg-background hover:bg-muted',
          className,
        )}
      >
        <Heart className={cn('h-5 w-5', active && 'fill-red-500 text-red-500')} />
        {active ? 'Guardado en favoritos' : 'Guardar en favoritos'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      className={cn(
        'absolute top-2 right-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur shadow-sm transition-transform hover:scale-110',
        className,
      )}
    >
      <Heart
        className={cn('h-[18px] w-[18px]', active ? 'fill-red-500 text-red-500' : 'text-neutral-600')}
      />
    </button>
  )
}
