'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

type Props = { siteName: string; logoUrl: string | null; userName: string }

const NAV = [
  { href: '/ventas', label: 'Inicio', icon: '⌂' },
  { href: '/ventas/azulejos', label: 'Azulejos', icon: '▦' },
  { href: '/ventas/marcas', label: 'Marcas', icon: '◈' },
  { href: '/ventas/colecciones', label: 'Colecciones', icon: '❏' },
  { href: '/ventas/ambientes', label: 'Ambientes', icon: '🛋' },
  { href: '/ventas/importar', label: 'Importar catálogos', icon: '⇪' },
  { href: '/ventas/clientes', label: 'Clientes interesados', icon: '☏' },
  { href: '/ventas/selecciones', label: 'Selecciones enviadas', icon: '↗' },
  { href: '/ventas/etiquetas', label: 'Etiquetas', icon: '#' },
]

export function VentasSidebar({ siteName, logoUrl, userName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  function isActive(href: string): boolean {
    if (href === '/ventas') return pathname === '/ventas'
    return pathname === href || pathname.startsWith(href + '/')
  }

  async function logout() {
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    } catch {}
    router.push('/ventas/login')
    router.refresh()
  }

  return (
    <>
      {/* Barra superior en móvil */}
      <div className="md:hidden flex items-center gap-3 p-3 border-b border-border sticky top-0 bg-background z-30">
        <button
          onClick={() => setOpen(!open)}
          aria-label="Abrir menú"
          className="w-9 h-9 grid place-items-center rounded-md border border-border"
        >
          ☰
        </button>
        <span className="font-medium text-sm">Zona de ventas</span>
      </div>

      <aside
        className={`${
          open ? 'block' : 'hidden'
        } md:block border-r border-border bg-muted/30 md:sticky md:top-0 md:h-screen md:overflow-y-auto`}
      >
        <div className="p-4 flex flex-col gap-1 md:h-full">
          <Link href="/ventas" className="block mb-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={siteName} className="h-9 object-contain" />
            ) : (
              <span className="font-serif text-lg">{siteName}</span>
            )}
            <span className="block text-[11px] text-muted-foreground mt-1 uppercase tracking-wide">
              Zona de ventas
            </span>
          </Link>

          <nav className="flex flex-col gap-0.5">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted'
                }`}
              >
                <span className="w-4 text-center opacity-80">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="md:mt-auto pt-4 border-t border-border mt-4 space-y-2">
            <p className="text-xs text-muted-foreground truncate px-3" title={userName}>
              {userName}
            </p>
            <div className="flex flex-col gap-0.5">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted"
              >
                Ver la web pública →
              </a>
              <a
                href="/admin"
                className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted"
              >
                Admin técnico →
              </a>
              <button
                onClick={logout}
                className="text-left px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
