import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { es } from '@payloadcms/translations/languages/es'
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
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || 'file:./tilestudio.db',
    },
  }),
  sharp,
  // Toda la UI de Payload en español: botones, formularios, mensajes, errores,
  // tabla de listado, paginación, búsqueda, etc.
  i18n: {
    fallbackLanguage: 'es',
    supportedLanguages: { es },
  },
})
