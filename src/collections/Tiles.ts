import type { CollectionConfig } from 'payload'
import { autoSlugFrom } from '../lib/slug'

export const Tiles: CollectionConfig = {
  slug: 'tiles',
  labels: { singular: 'Azulejo', plural: 'Azulejos' },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogo',
    defaultColumns: ['name', 'sku', 'collection', 'format', 'published', 'featured'],
    description:
      'Aquí están todos los azulejos que tienes en el showroom. Los que tienen "Publicado" activado son los que ven tus clientes en la web. Puedes añadir nuevos uno a uno o subir un catálogo PDF entero desde "Catálogos importados".',
    listSearchableFields: ['name', 'sku', 'description'],
  },
  access: {
    read: ({ req }) => {
      if (req.user) return true
      return { published: { equals: true } }
    },
  },
  hooks: {
    // En Postgres las referencias a un azulejo (generaciones, leads, ambientes)
    // son foreign keys sin cascade: borrar el azulejo sin desenlazarlas antes
    // revienta con un 500 ("violates foreign key constraint"). En el SQLite de
    // desarrollo las FKs no se aplican, así que el fallo solo se ve en
    // producción. Este hook desenlaza todo dentro de la misma transacción.
    beforeDelete: [
      async ({ req, id }) => {
        const { payload } = req

        // Las simulaciones se conservan como histórico (uso y coste de IA)
        await payload.update({
          collection: 'generations',
          where: { tile: { equals: id } },
          data: { tile: null },
          req,
        })

        // El lead conserva sus datos de contacto, solo pierde el enlace
        await payload.update({
          collection: 'leads',
          where: { tileOfInterest: { equals: id } },
          data: { tileOfInterest: null },
          req,
        })

        // Quitar el azulejo de los ambientes que lo usaban
        const ambients = await payload.find({
          collection: 'ambients',
          where: { 'tilesUsed.tile': { equals: id } },
          limit: 200,
          depth: 0,
          req,
        })
        for (const ambient of ambients.docs as any[]) {
          await payload.update({
            collection: 'ambients',
            id: ambient.id,
            data: {
              tilesUsed: (ambient.tilesUsed || []).filter((item: any) => {
                const tileId = typeof item.tile === 'object' ? item.tile?.id : item.tile
                return String(tileId) !== String(id)
              }),
            },
            req,
          })
        }
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Datos básicos',
          fields: [
            { name: 'name', label: 'Nombre', type: 'text', required: true },
            {
              name: 'slug',
              label: 'Dirección web',
              type: 'text',
              required: true,
              unique: true,
              ...autoSlugFrom('name'),
            },
            {
              name: 'sku',
              label: 'Código de referencia',
              type: 'text',
              admin: {
                description: 'El código con el que el fabricante identifica el azulejo (ej. SOL23 / SOL28).',
              },
            },
            {
              name: 'description',
              label: 'Descripción',
              type: 'textarea',
            },
          ],
        },
        {
          label: 'Imágenes',
          fields: [
            {
              name: 'mainImage',
              label: 'Imagen principal',
              type: 'upload',
              relationTo: 'media',
              required: true,
              admin: { description: 'Foto principal mostrada en listado y ficha.' },
            },
            {
              name: 'textureImage',
              label: 'Imagen de textura (para simulador)',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description:
                  'Imagen plana, tileable, en alta resolución. Se usa como referencia visual para la IA. Si está vacía, el simulador usará la imagen principal (peor resultado).',
              },
            },
            {
              name: 'gallery',
              label: 'Galería adicional',
              type: 'array',
              fields: [
                {
                  name: 'image',
                  label: 'Imagen',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
              ],
            },
          ],
        },
        {
          label: 'Clasificación',
          fields: [
            {
              name: 'collection',
              label: 'Colección',
              type: 'relationship',
              relationTo: 'collections',
            },
            {
              name: 'brand',
              label: 'Marca',
              type: 'relationship',
              relationTo: 'brands',
            },
            {
              name: 'colors',
              label: 'Colores',
              type: 'relationship',
              relationTo: 'colors',
              hasMany: true,
            },
            {
              name: 'finish',
              label: 'Acabado',
              type: 'relationship',
              relationTo: 'finishes',
            },
            {
              name: 'format',
              label: 'Formato',
              type: 'relationship',
              relationTo: 'formats',
            },
            {
              name: 'usages',
              label: 'Usos',
              type: 'relationship',
              relationTo: 'usages',
              hasMany: true,
            },
            {
              name: 'rooms',
              label: 'Estancias',
              type: 'relationship',
              relationTo: 'rooms',
              hasMany: true,
            },
          ],
        },
        {
          label: 'Precio y publicación',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'orientativePrice',
                  label: 'Precio orientativo',
                  type: 'number',
                  admin: {
                    description:
                      'Mostrado como referencia, nunca como precio firme. Vacío = "Consultar precio".',
                  },
                },
                {
                  name: 'priceUnit',
                  label: 'Unidad',
                  type: 'select',
                  defaultValue: 'm2',
                  options: [
                    { label: '€ / m²', value: 'm2' },
                    { label: '€ / unidad', value: 'unit' },
                    { label: '€ / caja', value: 'box' },
                  ],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'published',
                  label: 'Publicado',
                  type: 'checkbox',
                  defaultValue: true,
                },
                {
                  name: 'featured',
                  label: 'Destacado en home',
                  type: 'checkbox',
                  defaultValue: false,
                },
                {
                  name: 'aiReady',
                  label: 'Apto para simulador IA',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    description:
                      'Marcar solo cuando la textura ha sido validada visualmente con buenos resultados en el simulador.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'attributesJson',
      label: 'Atributos extra (JSON)',
      type: 'json',
      admin: {
        description: 'Campos libres: espesor, rectificado, PEI, antideslizante, etc.',
      },
    },
  ],
  timestamps: true,
}
