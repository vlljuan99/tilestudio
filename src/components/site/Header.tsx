import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

type Props = {
  settings: {
    siteName?: string | null
    logo?: { url?: string | null; width?: number | null; height?: number | null } | number | null
  } | null
}

export function SiteHeader({ settings }: Props) {
  const name = settings?.siteName || 'Tilestudio'
  const logo = settings?.logo && typeof settings.logo === 'object' ? settings.logo : null

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center">
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
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/catalogo" className="hover:text-primary">
            Catálogo
          </Link>
          <Link href="/ambientes" className="hover:text-primary">
            Ambientes
          </Link>
          <Link href="/simulador" className="hover:text-primary inline-flex items-center gap-1">
            <Sparkles className="h-4 w-4" /> Simulador IA
          </Link>
          <Link href="/sobre-nosotros" className="hover:text-primary">
            Sobre nosotros
          </Link>
          <Link href="/contacto" className="hover:text-primary">
            Contacto
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/simulador">
              <Sparkles className="h-4 w-4" /> Probar con IA
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
