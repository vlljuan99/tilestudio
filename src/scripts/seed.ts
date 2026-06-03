/**
 * Seed inicial del proyecto.
 * Uso: npm run seed
 *
 * Idempotente: borra datos previos de las colecciones afectadas y vuelve a crearlos.
 * No toca la colección 'users' si ya existe un usuario (para no romper el login del admin).
 */
import { getPayload } from 'payload'
import sharp from 'sharp'
import config from '../payload.config'

type Payload = Awaited<ReturnType<typeof getPayload>>

const COLORS = [
  { name: 'Blanco', slug: 'blanco', hex: '#F5F1EA' },
  { name: 'Beige', slug: 'beige', hex: '#D9C9A8' },
  { name: 'Gris', slug: 'gris', hex: '#9A9690' },
  { name: 'Negro', slug: 'negro', hex: '#1F1B17' },
  { name: 'Terracota', slug: 'terracota', hex: '#B36242' },
  { name: 'Verde salvia', slug: 'verde-salvia', hex: '#8FA48A' },
]

const FINISHES = [
  { name: 'Mate', slug: 'mate' },
  { name: 'Brillo', slug: 'brillo' },
  { name: 'Satinado', slug: 'satinado' },
  { name: 'Antideslizante', slug: 'antideslizante' },
]

const FORMATS = [
  { name: '60x60', slug: '60x60', widthCm: 60, heightCm: 60 },
  { name: '30x90', slug: '30x90', widthCm: 30, heightCm: 90 },
  { name: '20x20', slug: '20x20', widthCm: 20, heightCm: 20 },
  { name: '120x60', slug: '120x60', widthCm: 120, heightCm: 60 },
]

const USAGES = [
  { name: 'Suelo interior', slug: 'suelo-interior' },
  { name: 'Pared baño', slug: 'pared-bano' },
  { name: 'Pared cocina', slug: 'pared-cocina' },
  { name: 'Exterior', slug: 'exterior' },
]

const ROOMS = [
  { name: 'Baño', slug: 'bano' },
  { name: 'Cocina', slug: 'cocina' },
  { name: 'Salón', slug: 'salon' },
  { name: 'Dormitorio', slug: 'dormitorio' },
  { name: 'Exterior', slug: 'exterior' },
]

const BRAND = { name: 'Atelier Tilestudio', slug: 'atelier-tilestudio' }

const COLLECTIONS = [
  { name: 'Serenity', slug: 'serenity', description: 'Tonos cálidos y minimalistas.' },
  { name: 'Heritage', slug: 'heritage', description: 'Inspiración clásica reinterpretada.' },
  { name: 'Urban', slug: 'urban', description: 'Estética industrial y contemporánea.' },
]

type TileSpec = {
  name: string
  sku: string
  slug: string
  colorSlug: string
  finishSlug: string
  formatSlug: string
  usages: string[]
  rooms: string[]
  collectionSlug: string
  price: number
  description: string
  featured?: boolean
}

const TILES: TileSpec[] = [
  { name: 'Marfil Mate', sku: 'AT-001', slug: 'marfil-mate', colorSlug: 'blanco', finishSlug: 'mate', formatSlug: '60x60', usages: ['suelo-interior', 'pared-bano'], rooms: ['bano', 'salon'], collectionSlug: 'serenity', price: 28.5, description: 'Porcelánico de tono crema, acabado mate sedoso. Ideal para baños y salas amplias.', featured: true },
  { name: 'Marfil Brillo', sku: 'AT-002', slug: 'marfil-brillo', colorSlug: 'blanco', finishSlug: 'brillo', formatSlug: '30x90', usages: ['pared-bano', 'pared-cocina'], rooms: ['bano', 'cocina'], collectionSlug: 'serenity', price: 24.9, description: 'Pared cerámica blanca con brillo elegante, refleja la luz natural.' },
  { name: 'Arena Sahara', sku: 'AT-010', slug: 'arena-sahara', colorSlug: 'beige', finishSlug: 'mate', formatSlug: '120x60', usages: ['suelo-interior'], rooms: ['salon', 'dormitorio'], collectionSlug: 'serenity', price: 38.0, description: 'Gran formato en beige cálido con sutiles vetas. Aspecto piedra natural.', featured: true },
  { name: 'Dune', sku: 'AT-011', slug: 'dune', colorSlug: 'beige', finishSlug: 'satinado', formatSlug: '60x60', usages: ['suelo-interior'], rooms: ['salon'], collectionSlug: 'serenity', price: 32.0, description: 'Beige satinado con textura mineralizada.' },
  { name: 'Piedra Gris', sku: 'AT-020', slug: 'piedra-gris', colorSlug: 'gris', finishSlug: 'mate', formatSlug: '60x60', usages: ['suelo-interior', 'exterior'], rooms: ['salon', 'exterior'], collectionSlug: 'urban', price: 30.0, description: 'Imitación piedra gris, antideslizante y resistente al exterior.' },
  { name: 'Concreto', sku: 'AT-021', slug: 'concreto', colorSlug: 'gris', finishSlug: 'mate', formatSlug: '120x60', usages: ['suelo-interior', 'pared-cocina'], rooms: ['cocina', 'salon'], collectionSlug: 'urban', price: 42.0, description: 'Aspecto cemento pulido. Estilo industrial y minimalista.', featured: true },
  { name: 'Carbón', sku: 'AT-030', slug: 'carbon', colorSlug: 'negro', finishSlug: 'mate', formatSlug: '60x60', usages: ['suelo-interior', 'pared-bano'], rooms: ['bano'], collectionSlug: 'urban', price: 36.0, description: 'Negro profundo mate para acentos arquitectónicos.' },
  { name: 'Antracita Brillo', sku: 'AT-031', slug: 'antracita-brillo', colorSlug: 'negro', finishSlug: 'brillo', formatSlug: '30x90', usages: ['pared-bano'], rooms: ['bano'], collectionSlug: 'urban', price: 34.0, description: 'Pared en antracita brillante, sofisticada y atemporal.' },
  { name: 'Terracota Vintage', sku: 'AT-040', slug: 'terracota-vintage', colorSlug: 'terracota', finishSlug: 'mate', formatSlug: '20x20', usages: ['suelo-interior', 'pared-cocina'], rooms: ['cocina', 'salon'], collectionSlug: 'heritage', price: 45.0, description: 'Pequeño formato hidráulico inspirado en suelos mediterráneos.', featured: true },
  { name: 'Cotto Antiguo', sku: 'AT-041', slug: 'cotto-antiguo', colorSlug: 'terracota', finishSlug: 'mate', formatSlug: '60x60', usages: ['suelo-interior'], rooms: ['cocina', 'salon'], collectionSlug: 'heritage', price: 39.0, description: 'Tonalidad cocida con variación natural pieza a pieza.' },
  { name: 'Salvia Botánica', sku: 'AT-050', slug: 'salvia-botanica', colorSlug: 'verde-salvia', finishSlug: 'mate', formatSlug: '20x20', usages: ['pared-bano', 'pared-cocina'], rooms: ['bano', 'cocina'], collectionSlug: 'heritage', price: 48.0, description: 'Verde salvia suave, perfecto para baños frescos y cocinas con personalidad.', featured: true },
  { name: 'Salvia Liso', sku: 'AT-051', slug: 'salvia-liso', colorSlug: 'verde-salvia', finishSlug: 'satinado', formatSlug: '30x90', usages: ['pared-bano'], rooms: ['bano'], collectionSlug: 'heritage', price: 33.0, description: 'Pared lisa en verde salvia satinado.' },
]

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

async function makePlaceholderImage(name: string, hex: string): Promise<Buffer> {
  const { r, g, b } = hexToRgb(hex)
  const w = 1200
  const h = 1200

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <pattern id="grid" width="120" height="120" patternUnits="userSpaceOnUse">
          <rect width="120" height="120" fill="rgba(0,0,0,0.04)"/>
          <path d="M120 0 L0 0 0 120" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#grid)"/>
      <text x="${w / 2}" y="${h / 2}" font-family="Georgia, serif" font-size="58"
            text-anchor="middle" fill="rgba(0,0,0,0.45)" dominant-baseline="middle">
        ${name.replace(/&/g, '&amp;')}
      </text>
    </svg>
  `

  return sharp({
    create: { width: w, height: h, channels: 3, background: { r, g, b } },
  })
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 86 })
    .toBuffer()
}

async function clear(payload: Payload) {
  const collections = [
    'tiles',
    'collections',
    'brands',
    'ambients',
    'colors',
    'finishes',
    'formats',
    'usages',
    'rooms',
    'leads',
    'media',
  ] as const
  for (const slug of collections) {
    const all = await payload.find({ collection: slug, limit: 1000, depth: 0 })
    for (const doc of all.docs) {
      try {
        await payload.delete({ collection: slug, id: (doc as any).id })
      } catch (e) {
        console.warn(`No se pudo borrar ${slug}/${(doc as any).id}:`, (e as Error).message)
      }
    }
  }
}

async function ensureAdminUser(payload: Payload) {
  const existing = await payload.find({ collection: 'users', limit: 1 })
  if (existing.docs.length > 0) return existing.docs[0]
  return payload.create({
    collection: 'users',
    data: {
      email: 'admin@tilestudio.local',
      password: 'admin123',
      name: 'Admin',
      role: 'admin',
    } as any,
  })
}

async function run() {
  const payload = await getPayload({ config })

  console.log('· Asegurando usuario admin...')
  await ensureAdminUser(payload)

  console.log('· Limpiando datos previos...')
  await clear(payload)

  console.log('· Creando taxonomías...')
  const colors = await Promise.all(
    COLORS.map((c) => payload.create({ collection: 'colors', data: c })),
  )
  const finishes = await Promise.all(
    FINISHES.map((f) => payload.create({ collection: 'finishes', data: f })),
  )
  const formats = await Promise.all(
    FORMATS.map((f) => payload.create({ collection: 'formats', data: f })),
  )
  const usages = await Promise.all(
    USAGES.map((u) => payload.create({ collection: 'usages', data: u })),
  )
  const rooms = await Promise.all(
    ROOMS.map((r) => payload.create({ collection: 'rooms', data: r })),
  )

  const findBySlug = (arr: any[], slug: string) => arr.find((x) => x.slug === slug)?.id

  console.log('· Creando marca y colecciones...')
  const brand = await payload.create({ collection: 'brands', data: BRAND })
  const collections = await Promise.all(
    COLLECTIONS.map((c) =>
      payload.create({
        collection: 'collections',
        data: { ...c, brand: brand.id, featured: true },
      }),
    ),
  )

  console.log('· Creando azulejos (con imagen placeholder)...')
  for (const spec of TILES) {
    const color = COLORS.find((c) => c.slug === spec.colorSlug)!
    const imgBuffer = await makePlaceholderImage(spec.name, color.hex)
    const media = await payload.create({
      collection: 'media',
      data: { alt: spec.name },
      file: {
        name: `${spec.slug}.jpg`,
        data: imgBuffer,
        mimetype: 'image/jpeg',
        size: imgBuffer.length,
      },
    })

    await payload.create({
      collection: 'tiles',
      data: {
        name: spec.name,
        slug: spec.slug,
        sku: spec.sku,
        description: spec.description,
        mainImage: media.id,
        textureImage: media.id,
        collection: findBySlug(collections, spec.collectionSlug),
        brand: brand.id,
        colors: [findBySlug(colors, spec.colorSlug)].filter(Boolean),
        finish: findBySlug(finishes, spec.finishSlug),
        format: findBySlug(formats, spec.formatSlug),
        usages: spec.usages.map((s) => findBySlug(usages, s)).filter(Boolean),
        rooms: spec.rooms.map((s) => findBySlug(rooms, s)).filter(Boolean),
        orientativePrice: spec.price,
        priceUnit: 'm2',
        published: true,
        featured: !!spec.featured,
        aiReady: false,
      } as any,
    })
  }

  console.log('· Configurando SiteSettings (placeholder)...')
  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      siteName: 'Tilestudio',
      tagline: 'Showroom de azulejos con simulación visual por IA',
      whatsappNumber: '34600000000',
      phone: '+34 600 000 000',
      email: 'hola@tilestudio.local',
      address: 'Calle Mayor 1\n28000 Madrid',
      openingHours: 'L-V 9:00–18:00\nS 10:00–14:00',
      heroTitle: 'Visualiza tus azulejos en tu propio espacio, con inteligencia artificial.',
      heroSubtitle:
        'Sube una foto de tu estancia, elige el azulejo que te gusta y deja que la IA te muestre cómo quedaría. Sin compromiso.',
      companyLegalName: 'Tilestudio SL (demo)',
    } as any,
  })

  console.log('✅ Seed completado.')
  console.log('   Admin: admin@tilestudio.local / admin123')
  process.exit(0)
}

run().catch((err) => {
  console.error('❌ Seed falló:', err)
  process.exit(1)
})
