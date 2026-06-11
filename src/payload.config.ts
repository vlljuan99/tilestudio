import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { es } from '@payloadcms/translations/languages/es'
import { s3Storage } from '@payloadcms/storage-s3'
import { azureStorage } from '@payloadcms/storage-azure'
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
function pickDatabaseAdapter() {
  const uri = process.env.DATABASE_URL || process.env.DATABASE_URI || 'file:./tilestudio.db'
  if (uri.startsWith('postgres://') || uri.startsWith('postgresql://')) {
    return postgresAdapter({
      pool: {
        connectionString: uri,
        // SSL para conexiones gestionadas (Heroku Postgres, Neon, Supabase).
        // Localhost, contenedor en la misma red o `?sslmode=disable` no lo necesitan.
        ssl:
          uri.includes('sslmode=disable') ||
          uri.includes('localhost') ||
          uri.includes('127.0.0.1')
            ? false
            : { rejectUnauthorized: false },
      },
      // En staging sincronizamos el schema en cada arranque (sin migraciones
      // manuales). Para producción real sería mejor generar migraciones y
      // ejecutarlas con `payload migrate`, pero aquí queremos cero fricción.
      push: true,
    })
  }
  return sqliteAdapter({ client: { url: uri } })
}

/**
 * Plugins de almacenamiento de Media.
 *
 * Detección automática en este orden:
 *   1. Azure Blob Storage   — si AZURE_STORAGE_CONNECTION_STRING está definida
 *   2. S3-compatible (R2)   — si S3_BUCKET + S3_ENDPOINT + credenciales
 *   3. Filesystem local     — sin nada de lo anterior (dev local)
 *
 * Vars Azure:
 *   - AZURE_STORAGE_CONNECTION_STRING
 *   - AZURE_STORAGE_CONTAINER_NAME    (ej. "tilestudio-media")
 *   - AZURE_STORAGE_ACCOUNT_BASEURL   (https://<account>.blob.core.windows.net)
 *
 * Vars S3 (Cloudflare R2 / AWS S3 / MinIO):
 *   - S3_BUCKET
 *   - S3_ENDPOINT
 *   - S3_ACCESS_KEY_ID
 *   - S3_SECRET_ACCESS_KEY
 *   - S3_PUBLIC_URL    (opcional, URL pública para servir archivos directos)
 *   - S3_REGION        ("auto" para R2)
 */
function pickStoragePlugins() {
  // --- Azure Blob Storage ---
  const azureConn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (azureConn) {
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'tilestudio-media'
    const baseURL = process.env.AZURE_STORAGE_ACCOUNT_BASEURL
    if (baseURL) {
      return [
        azureStorage({
          collections: { media: true },
          allowContainerCreate: true,
          baseURL,
          connectionString: azureConn,
          containerName,
        }),
      ]
    }
    console.warn(
      '[storage] AZURE_STORAGE_CONNECTION_STRING definida pero falta AZURE_STORAGE_ACCOUNT_BASEURL. Se ignora Azure.',
    )
  }

  // --- S3-compatible ---
  const bucket = process.env.S3_BUCKET
  if (bucket) {
    const endpoint = process.env.S3_ENDPOINT
    const accessKeyId = process.env.S3_ACCESS_KEY_ID
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
    const publicUrl = process.env.S3_PUBLIC_URL
    if (endpoint && accessKeyId && secretAccessKey) {
      return [
        s3Storage({
          bucket,
          collections: {
            media: {
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
            forcePathStyle: true,
          },
        }),
      ]
    }
  }

  // --- Filesystem (dev) ---
  return []
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
    // Components custom (dashboard, provider de tema) desactivados temporalmente
    // mientras diagnosticamos un problema de renderizado en Heroku. Reactivar
    // cuando el flujo básico de admin funcione.
    // components: {
    //   providers: ['/components/payload/AdminThemeOverride'],
    //   views: { dashboard: { Component: '/components/payload/AdminDashboard' } },
    // },
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
