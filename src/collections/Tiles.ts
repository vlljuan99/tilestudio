import type { CollectionConfig } from 'payload'

export const Tiles: CollectionConfig = {
  slug: 'tiles',
  labels: { singular: 'Azulejo', plural: 'Azulejos' },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogo',
    defaultColumns: ['name', 'sku', 'collection', 'format', 'published', 'featured'],
    description: 'Catálogo de azulejos del showroom. Solo se muestran al público los que están publicados.',
    listSearchableFields: ['name', 'sku', 'description'],
  },
  access: {
    read: ({ req }) => {
      if (req.user) return true
      return { published: { equals: true } }
    },
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
              label: 'Slug',
              type: 'text',
              required: true,
              unique: true,
              admin: { description: 'Se usa en la URL: /catalogo/<slug>' },
            },
            {
              name: 'sku',
              label: 'Referencia / SKU',
              type: 'text',
              admin: { description: 'Código interno o de marca.' },
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
