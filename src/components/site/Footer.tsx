import Link from 'next/link'

type Props = {
  settings:
    | {
        siteName?: string | null
        phone?: string | null
        email?: string | null
        address?: string | null
        openingHours?: string | null
        companyLegalName?: string | null
        privacyPolicyUrl?: string | null
        cookiesPolicyUrl?: string | null
      }
    | null
}

export function SiteFooter({ settings }: Props) {
  const year = new Date().getFullYear()
  const name = settings?.siteName || 'Tilestudio'

  return (
    <footer className="border-t border-border bg-muted/30 mt-16">
      <div className="container py-12 grid gap-10 md:grid-cols-4 text-sm">
        <div className="space-y-2">
          <p className="font-serif text-lg font-semibold">{name}</p>
          <p className="text-muted-foreground">
            Showroom de azulejos con simulación visual por IA.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-medium">Catálogo</p>
          <ul className="space-y-1 text-muted-foreground">
            <li><Link href="/catalogo" className="hover:text-foreground">Todos los azulejos</Link></li>
            <li><Link href="/ambientes" className="hover:text-foreground">Ambientes</Link></li>
            <li><Link href="/simulador" className="hover:text-foreground">Simulador IA</Link></li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="font-medium">Contacto</p>
          <ul className="space-y-1 text-muted-foreground">
            {settings?.phone && <li>Tel: {settings.phone}</li>}
            {settings?.email && (
              <li>
                <a href={`mailto:${settings.email}`} className="hover:text-foreground">
                  {settings.email}
                </a>
              </li>
            )}
            {settings?.address && <li className="whitespace-pre-line">{settings.address}</li>}
            {settings?.openingHours && (
              <li className="whitespace-pre-line">{settings.openingHours}</li>
            )}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="font-medium">Legal</p>
          <ul className="space-y-1 text-muted-foreground">
            {settings?.privacyPolicyUrl && (
              <li>
                <Link href={settings.privacyPolicyUrl} className="hover:text-foreground">
                  Política de privacidad
                </Link>
              </li>
            )}
            {settings?.cookiesPolicyUrl && (
              <li>
                <Link href={settings.cookiesPolicyUrl} className="hover:text-foreground">
                  Política de cookies
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container py-4 text-xs text-muted-foreground flex justify-between">
          <span>
            © {year} {settings?.companyLegalName || name}
          </span>
          <span>Diseñado para inspirar.</span>
        </div>
      </div>
    </footer>
  )
}
