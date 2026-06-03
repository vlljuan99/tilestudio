import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
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
})
