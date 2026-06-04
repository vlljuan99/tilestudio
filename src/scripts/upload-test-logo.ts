import { readFile } from 'fs/promises'
import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const path = process.argv[2] || 'tmp/helvagres-logo.png'
  const buffer = await readFile(path)
  const payload = await getPayload({ config })
  const media = (await payload.create({
    collection: 'media',
    data: { alt: 'Logo de Helvagres (prueba)' } as any,
    file: {
      name: 'helvagres-logo.png',
      data: buffer,
      mimetype: 'image/png',
      size: buffer.length,
    },
  })) as any
  console.log('mediaId =', media.id)

  // Asignar como logo en SiteSettings
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { logo: media.id } as any,
  })
  console.log('Logo asignado al sitio.')
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
