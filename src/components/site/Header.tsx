'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Sparkles, Menu, X, Heart } from 'lucide-react'
import { useFavorites } from '@/lib/favorites'

type Props = {
  settings: {
    siteName?: string | null
    logo?: { url?: string | null; width?: number | null; height?: number | null } | number | null
  } | null
}

const NAV_LINKS = [
  { href: '/catalogo', label: 'Catálogo' },
  { href: '/ambientes', label: 'Ambientes' },
  { href: '/simulador', label: 'Simulador IA', icon: true },
  { href: '/sobre-nosotros', label: 'Sobre nosotros' },
  { href: '/contacto', label: 'Contacto' },
]

export function SiteHeader({ settings }: Props) {
  const name = settings?.siteName || 'Tilestudio'
  const logo = settings?.logo && typeof settings.logo === 'object' ? settings.logo : null
  const [open, setOpen] = useState(false)
  const { count } = useFavorites()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center" onClick={() => setOpen(false)}>
          {logo?.url ? (
            <Image
              src={logo.url}
              alt={name}
              width={logo.width || 160}
              height={logo.height || 48}
              className="h-10 w-auto object-contain"
              priority
            />
          ) : (
            <span className="font-serif text-xl font-semibold tracking-tight">{name}</span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {NAV_LINKS.map(({ href, label, icon }) => (
            <Link key={href} href={href} className="hover:text-primary inline-flex items-center gap-1">
              {icon && <Sparkles className="h-4 w-4" />} {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/favoritos"
            onClick={() => setOpen(false)}
            aria-label="Mis favoritos"
            className="relative p-2 rounded-md hover:bg-muted"
          >
            <Heart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/simulador">
              <Sparkles className="h-4 w-4" /> Probar con IA
            </Link>
          </Button>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-md hover:bg-muted"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav className="md:hidden border-t border-border bg-background/95 backdrop-blur px-4 py-3 flex flex-col gap-1">
          {NAV_LINKS.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted"
            >
              {icon && <Sparkles className="h-4 w-4 text-primary" />} {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
