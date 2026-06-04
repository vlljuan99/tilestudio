import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig, type DatabaseAdapterResult } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { es } from '@payloadcms/translations/languages/es'
import { s3Storage } from '@payloadcms/storage-s3'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Colors } from './collections/Colors'
import { Finishes } from './collections/Finishes'
import { Formats } from './collections/Formats'
import { Usages } from './collections/Usages'
import { Rooms } from './collections/Rooms'
import { Brands } from './collections/Brands'
import { TileCollections } from './collections/Collections'
import { Tiles } from './collections/Tiles'
import { Ambients } from './collections/Ambients'
import { Leads } from './collections/Leads'
import { SimulatorSessions } from './collections/SimulatorSessions'
import { Generations } from './collections/Generations'
import { PdfImports } from './collections/PdfImports'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Elige el adaptador de base de datos.
 *  - `DATABASE_URL` (Heroku Postgres lo inyecta automáticamente)
 *  - o `DATABASE_URI` (otros hosts y dev local)
 *  - postgres:// → Postgres ; cualquier otra cosa → SQLite local
 */
function pickDatabaseAdapter(): DatabaseAdapterResult {
  const uri = process.env.DATABASE_URL || process.env.DATABASE_URI || 'file:./tilestudio.db'
  if (uri.startsWith('postgres://') || uri.startsWith('postgresql://')) {
    return postgresAdapter({
      pool: {
        connectionString: uri,
        // SSL para conexiones gestionadas (Heroku Postgres, Neon, Supabase).
        // Localhost / contenedor en la misma red no lo necesitan.
        ssl: uri.includes('localhost') || uri.includes('127.0.0.1')
          ? false
          : { rejectUnauthorized: false },
      },
    }) as DatabaseAdapterResult
  }
  return sqliteAdapter({ client: { url: uri } }) as DatabaseAdapterResult
}

/**
 * Plugin de storage S3-compatible (Cloudflare R2, AWS S3, MinIO…).
 * Solo se activa si están definidas las env vars necesarias. En dev local sin
 * estas vars, los archivos se guardan en `/media` como hasta ahora.
 *
 * Para Cloudflare R2 necesitas:
 *   - S3_BUCKET           (nombre del bucket)
 *   - S3_ENDPOINT         (https://<account-id>.r2.cloudflarestorage.com)
 *   - S3_ACCESS_KEY_ID    (Access Key del token)
 *   - S3_SECRET_ACCESS_KEY
 *   - S3_PUBLIC_URL       (URL pública del bucket: el dominio público de R2)
 *   - S3_REGION           (siempre "auto" para R2)
 */
function pickStoragePlugins() {
  const bucket = process.env.S3_BUCKET
  if (!bucket) return []
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  const publicUrl = process.env.S3_PUBLIC_URL
  if (!endpoint || !accessKeyId || !secretAccessKey) return []

  return [
    s3Storage({
      bucket,
      collections: {
        media: {
          // Las URLs de archivo apuntan al CDN público de R2. Si no tenemos
          // S3_PUBLIC_URL, Payload genera URLs firmadas (sirven pero pesan más).
          prefix: 'media',
          generateFileURL: publicUrl
            ? ({ filename, prefix }) =>
                `${publicUrl.replace(/\/$/, '')}/${prefix ? prefix + '/' : ''}${filename}`
            : undefined,
        },
      },
      config: {
        endpoint,
        region: process.env.S3_REGION || 'auto',
        credentials: { accessKeyId, secretAccessKey },
        // R2 requiere path-style addressing
        forcePathStyle: true,
      },
    }),
  ]
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '· Tilestudio Admin',
    },
    components: {
      // Provider que aplica la paleta del cliente al admin (lee SiteSettings y
      // sobrescribe las CSS variables --theme-*).
      providers: ['/components/payload/AdminThemeOverride'],
      // Dashboard custom con accesos directos, stats y actividad reciente.
      // Reemplaza el dashboard por defecto de Payload (que solo lista colecciones).
      views: {
        dashboard: {
          Component: '/components/payload/AdminDashboard',
        },
      },
    },
  },
  collections: [
    // Catálogo
    Tiles,
    TileCollections,
    Brands,
    Ambients,
    // Taxonomías
    Colors,
    Finishes,
    Formats,
    Usages,
    Rooms,
    // Comercial
    Leads,
    // Simulador
    SimulatorSessions,
    Generations,
    // Importación
    PdfImports,
    // Sistema
    Users,
    Media,
  ],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'change-me-dev-secret',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Postgres en producción (Heroku), SQLite en dev local. Auto-detección por URI.
  db: pickDatabaseAdapter(),
  // Cloudflare R2 / S3 si están definidas las env vars. Si no, filesystem local.
  plugins: pickStoragePlugins(),
  sharp,
  // Toda la UI de Payload en español: botones, formularios, mensajes, errores,
  // tabla de listado, paginación, búsqueda, etc.
  i18n: {
    fallbackLanguage: 'es',
    supportedLanguages: { es },
  },
})
