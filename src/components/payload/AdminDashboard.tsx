import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  Sparkles,
  FileText,
  Users,
  Image as ImageIcon,
  Settings,
  ArrowRight,
  Clock,
  TrendingUp,
} from 'lucide-react'

async function getStats() {
  const payload = await getPayload({ config })
  try {
    const [tiles, leads, generations, imports, recentLeads, recentGens, settings] =
      await Promise.all([
        payload.count({ collection: 'tiles', where: { published: { equals: true } } }),
        payload.count({ collection: 'leads' }),
        payload.count({ collection: 'generations' }),
        payload.count({
          collection: 'pdf-imports',
          where: { status: { in: ['queued', 'processing', 'review_ready'] } },
        }),
        payload.find({
          collection: 'leads',
          limit: 5,
          sort: '-createdAt',
          depth: 1,
        }),
        payload.find({
          collection: 'generations',
          limit: 5,
          sort: '-createdAt',
          depth: 1,
          where: { status: { equals: 'completed' } },
        }),
        payload.findGlobal({ slug: 'site-settings' }).catch(() => null),
      ])
    return {
      tiles: tiles.totalDocs,
      leads: leads.totalDocs,
      generations: generations.totalDocs,
      activeImports: imports.totalDocs,
      recentLeads: recentLeads.docs as any[],
      recentGens: recentGens.docs as any[],
      settings: settings as any,
    }
  } catch (err) {
    console.warn('Dashboard stats error:', err)
    return {
      tiles: 0,
      leads: 0,
      generations: 0,
      activeImports: 0,
      recentLeads: [],
      recentGens: [],
      settings: null,
    }
  }
}

function buildQuickActions(primary: string, accent: string, text: string) {
  // Generamos variaciones del color principal para tener 4 colores distintos
  // pero todos coherentes con la marca del cliente.
  return [
    {
      href: '/pdf-imports/new',
      title: 'Importar un catálogo en PDF',
      description:
        'Sube el catálogo de un fabricante y se convertirá automáticamente en azulejos.',
      Icon: FileText,
      color: primary,
    },
    {
      href: '/admin/collections/leads',
      title: 'Ver clientes interesados',
      description: 'Mensajes de personas que quieren que les llames o les respondas.',
      Icon: Users,
      color: accent,
    },
    {
      href: '/admin/collections/tiles',
      title: 'Editar el catálogo',
      description: 'Añadir, modificar o quitar azulejos del catálogo de tu showroom.',
      Icon: ImageIcon,
      color: mix(primary, accent),
    },
    {
      href: '/admin/globals/site-settings',
      title: 'Datos de contacto',
      description:
        'WhatsApp, teléfono, email y dirección del showroom que aparecen en la web.',
      Icon: Settings,
      color: mix(text, primary, 0.5),
    },
  ]
}

// Mezcla dos hex en porcentaje (0 = a, 1 = b)
function mix(aHex: string, bHex: string, t = 0.5): string {
  const a = parseHex(aHex)
  const b = parseHex(bHex)
  const r = Math.round(a[0] * (1 - t) + b[0] * t)
  const g = Math.round(a[1] * (1 - t) + b[1] * t)
  const bl = Math.round(a[2] * (1 - t) + b[2] * t)
  return '#' + [r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')
}
function parseHex(h: string): [number, number, number] {
  const c = h.replace('#', '')
  return [
    parseInt(c.slice(0, 2), 16) || 0,
    parseInt(c.slice(2, 4), 16) || 0,
    parseInt(c.slice(4, 6), 16) || 0,
  ]
}

function formatRel(date: string | Date | undefined) {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const min = Math.round(diffMs / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const days = Math.round(h / 24)
  if (days < 7) return `hace ${days} d`
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

export default async function AdminDashboard() {
  const stats = await getStats()
  const primary = stats.settings?.colorPrimary || '#7a4f23'
  const accent = stats.settings?.colorAccent || '#b04621'
  const text = stats.settings?.colorText || '#1f1b17'
  const quickActions = buildQuickActions(primary, accent, text)

  return (
    <div style={style.root}>
      {/* Hero */}
      <div style={style.hero}>
        <h2 style={style.heroTitle}>
          <Sparkles size={22} style={{ display: 'inline', marginRight: 8, verticalAlign: '-3px' }} />
          Bienvenido a Tilestudio
        </h2>
        <p style={style.heroSubtitle}>
          Desde aquí gestionas el catálogo de azulejos, respondes a los clientes interesados que
          dejan mensaje en la web y subes los catálogos en PDF de tus fabricantes. Empieza por las
          tarjetas de abajo.
        </p>
        <div style={style.heroLinks}>
          <a href="/" target="_blank" rel="noopener noreferrer" style={style.heroLink}>
            Ver la web pública →
          </a>
          <Link href="/admin/collections/users" style={style.heroLink}>
            Personas con acceso →
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={style.statsRow}>
        <StatCard label="Azulejos en la web" value={stats.tiles} Icon={ImageIcon} color={mix(primary, accent)} />
        <StatCard label="Clientes interesados" value={stats.leads} Icon={Users} color={accent} />
        <StatCard label="Simulaciones hechas" value={stats.generations} Icon={Sparkles} color={primary} />
        <StatCard label="Catálogos PDF procesándose" value={stats.activeImports} Icon={TrendingUp} color={mix(text, primary, 0.5)} />
      </div>

      {/* Quick actions */}
      <h3 style={style.sectionTitle}>Qué quieres hacer</h3>
      <div style={style.actionsGrid}>
        {quickActions.map((a) => (
          <Link key={a.href} href={a.href} style={style.actionCard}>
            <div style={{ ...style.actionIcon, background: a.color }}>
              <a.Icon size={20} color="white" />
            </div>
            <div style={style.actionBody}>
              <p style={style.actionTitle}>{a.title}</p>
              <p style={style.actionDesc}>{a.description}</p>
            </div>
            <ArrowRight size={18} color="var(--theme-elevation-400, #999)" />
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div style={style.activityRow}>
        <section style={style.activitySection}>
          <h3 style={style.sectionTitle}>
            <Users size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
            Últimos clientes interesados
            <Link href="/admin/collections/leads" style={style.sectionLink}>
              Ver todos →
            </Link>
          </h3>
          {stats.recentLeads.length === 0 ? (
            <p style={style.empty}>Aún no hay nadie. Cuando alguien use el simulador o el formulario de contacto, aparecerá aquí.</p>
          ) : (
            <ul style={style.list}>
              {stats.recentLeads.map((l) => (
                <li key={l.id} style={style.listItem}>
                  <Link href={`/admin/collections/leads/${l.id}`} style={style.listLink}>
                    <span style={style.listTitle}>{l.displayName || 'Lead sin nombre'}</span>
                    <span style={style.listMeta}>
                      {l.preferredChannel || 'whatsapp'} · {formatRel(l.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={style.activitySection}>
          <h3 style={style.sectionTitle}>
            <Sparkles size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
            Últimas simulaciones
            <Link href="/admin/collections/generations" style={style.sectionLink}>
              Ver todas →
            </Link>
          </h3>
          {stats.recentGens.length === 0 ? (
            <p style={style.empty}>Aún no hay simulaciones generadas con IA.</p>
          ) : (
            <ul style={style.list}>
              {stats.recentGens.map((g) => (
                <li key={g.id} style={style.listItem}>
                  <Link href={`/admin/collections/generations/${g.id}`} style={style.listLink}>
                    <span style={style.listTitle}>
                      {g.tile?.name || 'Sin azulejo'}
                      {g.surfaces?.length ? ` · ${g.surfaces.join(' + ')}` : ''}
                    </span>
                    <span style={style.listMeta}>
                      <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {formatRel(g.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  Icon,
  color,
}: {
  label: string
  value: number
  Icon: any
  color: string
}) {
  return (
    <div style={style.statCard}>
      <div style={{ ...style.statIcon, background: `${color}1a`, color }}>
        <Icon size={18} />
      </div>
      <div>
        <p style={style.statValue}>{value}</p>
        <p style={style.statLabel}>{label}</p>
      </div>
    </div>
  )
}

const style: Record<string, React.CSSProperties> = {
  root: { padding: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: 24 },
  hero: {
    background: 'linear-gradient(135deg, var(--theme-elevation-50, #fafafa), var(--theme-elevation-100, #f0f0f0))',
    border: '1px solid var(--theme-elevation-150, #e0e0e0)',
    borderRadius: 8,
    padding: '20px 24px',
  },
  heroTitle: { margin: 0, fontSize: 22, fontWeight: 600 },
  heroSubtitle: {
    margin: '8px 0 0 0',
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--theme-elevation-500, #666)',
    maxWidth: 720,
  },
  heroLinks: { display: 'flex', gap: 16, marginTop: 12 },
  heroLink: {
    fontSize: 13,
    color: 'var(--theme-success-500, #1e88e5)',
    textDecoration: 'none',
    fontWeight: 500,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  statCard: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    padding: '14px 16px',
    border: '1px solid var(--theme-elevation-150, #e0e0e0)',
    borderRadius: 8,
    background: 'var(--theme-elevation-0, #fff)',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { margin: 0, fontSize: 22, fontWeight: 600, lineHeight: 1 },
  statLabel: { margin: '4px 0 0 0', fontSize: 12, color: 'var(--theme-elevation-500, #666)' },
  sectionTitle: {
    margin: '8px 0 12px 0',
    fontSize: 14,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--theme-elevation-700, #444)',
    display: 'flex',
    alignItems: 'center',
  },
  sectionLink: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: 500,
    textTransform: 'none',
    letterSpacing: 0,
    color: 'var(--theme-success-500, #1e88e5)',
    textDecoration: 'none',
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 12,
  },
  actionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 16px',
    border: '1px solid var(--theme-elevation-150, #e0e0e0)',
    borderRadius: 8,
    background: 'var(--theme-elevation-0, #fff)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionBody: { flex: 1, minWidth: 0 },
  actionTitle: { margin: 0, fontSize: 14, fontWeight: 600 },
  actionDesc: {
    margin: '4px 0 0 0',
    fontSize: 12,
    color: 'var(--theme-elevation-500, #666)',
    lineHeight: 1.4,
  },
  activityRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  activitySection: {
    border: '1px solid var(--theme-elevation-150, #e0e0e0)',
    borderRadius: 8,
    padding: '14px 16px',
    background: 'var(--theme-elevation-0, #fff)',
  },
  empty: {
    margin: 0,
    fontSize: 13,
    color: 'var(--theme-elevation-500, #888)',
    fontStyle: 'italic',
  },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  listItem: { borderBottom: '1px solid var(--theme-elevation-100, #f0f0f0)' },
  listLink: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    textDecoration: 'none',
    color: 'inherit',
    fontSize: 13,
  },
  listTitle: { fontWeight: 500 },
  listMeta: {
    fontSize: 11,
    color: 'var(--theme-elevation-500, #888)',
    display: 'flex',
    alignItems: 'center',
  },
}
