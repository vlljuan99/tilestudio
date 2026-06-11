import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { sh, compose, bash, TS_DIR } from './sh.js'
import { getSettings, getPublicHost } from './settings.js'
import { upsertARecord, deleteARecord, findZoneFor } from './ionos.js'

const CLIENTS_DIR = path.join(TS_DIR, 'clients')
const SERVER_IP = process.env.SERVER_IP

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

export function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

export function listClients() {
  let dirs = []
  try {
    dirs = fs.readdirSync(CLIENTS_DIR)
  } catch {
    return []
  }
  return dirs
    .filter((d) => !d.startsWith('_') && fs.existsSync(path.join(CLIENTS_DIR, d, 'compose.yml')))
    .sort()
    .map((slug) => {
      const meta = readJson(path.join(CLIENTS_DIR, slug, 'client.json'))
      let url = ''
      try {
        const env = fs.readFileSync(path.join(CLIENTS_DIR, slug, '.env'), 'utf8')
        url = (env.match(/^NEXT_PUBLIC_SERVER_URL=(.+)$/m) || [])[1]?.trim() || ''
      } catch {}
      return { slug, name: meta.name || slug, domain: meta.domain || null, createdAt: meta.createdAt || null, url }
    })
}

// Estado de todos los contenedores del proyecto: { 'app-helvagres': { state, status } }
export async function containerStatuses() {
  try {
    const { stdout } = await compose(['ps', '-a', '--format', 'json'])
    const rows = []
    for (const line of stdout.split('\n')) {
      const t = line.trim()
      if (!t) continue
      try {
        const parsed = JSON.parse(t)
        rows.push(...(Array.isArray(parsed) ? parsed : [parsed]))
      } catch {}
    }
    const map = {}
    for (const r of rows) map[r.Service] = { state: r.State, status: r.Status }
    return map
  } catch {
    return {}
  }
}

// Tamaño de cada BD: { tilestudio_helvagres: '42 MB' }
export async function dbSizes() {
  try {
    const { stdout } = await compose([
      'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-t', '-A', '-F', '|', '-c',
      "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname LIKE 'tilestudio_%'",
    ])
    const map = {}
    for (const line of stdout.split('\n')) {
      const [db, size] = line.trim().split('|')
      if (db) map[db] = size
    }
    return map
  } catch {
    return {}
  }
}

export const dbName = (slug) => `tilestudio_${slug.replaceAll('-', '_')}`

export const clientUrl = (slug, domain) =>
  domain ? `https://${domain}` : `http://${slug}.${getPublicHost()}`

// ¿Es un dominio raíz (helvagres.es) y no un subdominio (tienda.helvagres.es)?
const isApex = (domain) => domain.split('.').length === 2

function caddySite(slug, domain) {
  if (!domain) {
    return `http://${slug}.${getPublicHost()} {\n\tencode gzip\n\treverse_proxy app-${slug}:3000\n}\n`
  }
  let conf = `${domain} {\n\tencode gzip\n\treverse_proxy app-${slug}:3000\n}\n`
  // En dominio raíz, www redirige al principal (con su propio certificado)
  if (isApex(domain)) {
    conf += `\nwww.${domain} {\n\tredir https://${domain}{uri} permanent\n}\n`
  }
  return conf
}

export async function reloadCaddy() {
  await compose(['exec', '-T', '-w', '/etc/caddy', 'caddy', 'caddy', 'reload'])
}

// Crea/actualiza el registro A del dominio en CUALQUIER zona de la cuenta de
// IONOS (el dominio del propio cliente, p. ej. helvagres.es, o un subdominio
// del dominio base). En dominio raíz crea también el www. Si el dominio no
// está en la cuenta, devuelve las instrucciones para el registrador externo.
async function ensureDns(domain) {
  if (!domain) return ''
  const s = getSettings()
  const externalNote =
    `«${domain}» no está en tu cuenta de IONOS. El cliente (o su registrador) debe crear ` +
    `un registro A de ${domain}${isApex(domain) ? ` y de www.${domain}` : ''} apuntando a ${SERVER_IP}. ` +
    `El certificado HTTPS se emitirá solo en cuanto el DNS apunte aquí.`
  if (!s.ionosKey) return externalNote
  const zone = await findZoneFor(s.ionosKey, domain)
  if (!zone) return externalNote
  await upsertARecord(s.ionosKey, zone.id, domain, SERVER_IP)
  let note = `Registro DNS ${domain} → ${SERVER_IP} creado en IONOS (zona ${zone.name}, propaga en minutos).`
  if (domain === zone.name) {
    await upsertARecord(s.ionosKey, zone.id, `www.${domain}`, SERVER_IP)
    note += ` También www.${domain}, que redirige al principal.`
  }
  return note
}

async function waitForHealth(slug, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`http://app-${slug}:3000/api/health`, {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error('La instancia no respondió al healthcheck tras 2 minutos. Mira sus logs.')
}

// Crea el primer usuario (admin) de la tienda vía API de Payload.
export async function createFirstAdmin(slug, email, name) {
  const password = crypto.randomBytes(12).toString('base64url')
  const res = await fetch(`http://app-${slug}:3000/api/users/first-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, 'confirm-password': password, name: name || '', role: 'admin' }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`No se pudo crear el usuario admin (HTTP ${res.status}): ${text.slice(0, 300)}`)
  }
  return { email, password }
}

export async function createClient({ name, slug, domain, adminEmail, adminName }) {
  if (!SLUG_RE.test(slug)) throw new Error('Slug inválido: minúsculas, números y guiones (3-30 caracteres).')
  if (fs.existsSync(path.join(CLIENTS_DIR, slug))) throw new Error(`El cliente "${slug}" ya existe.`)

  const settings = getSettings()
  let finalDomain = (domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  // Con dominio base configurado y sin dominio explícito → subdominio automático
  if (!finalDomain && settings.baseDomain) finalDomain = `${slug}.${settings.baseDomain}`

  // DNS primero, para que Caddy pueda emitir el certificado a la primera
  const dnsNote = await ensureDns(finalDomain)

  const args = ['add-client.sh', slug]
  if (finalDomain) args.push(finalDomain)
  await sh('bash', args, { timeout: 10 * 60_000 })

  // El site de Caddy lo reescribimos nosotros: añade el redirect de www
  // en dominios raíz, que add-client.sh no genera.
  if (finalDomain && isApex(finalDomain)) {
    fs.writeFileSync(path.join(TS_DIR, 'sites', `${slug}.caddy`), caddySite(slug, finalDomain))
    await reloadCaddy()
  }

  fs.writeFileSync(
    path.join(CLIENTS_DIR, slug, 'client.json'),
    JSON.stringify({ name: name || slug, domain: finalDomain || null, createdAt: new Date().toISOString() }, null, 2),
  )

  await waitForHealth(slug)

  let creds = null
  let credsError = null
  if (adminEmail) {
    try {
      creds = await createFirstAdmin(slug, adminEmail, adminName)
    } catch (err) {
      credsError = err.message
    }
  }
  return { url: clientUrl(slug, finalDomain), dnsNote, creds, credsError }
}

export async function restartClient(slug) {
  await compose(['restart', `app-${slug}`], { timeout: 180_000 })
}

export async function clientLogs(slug, tail = 200) {
  const { stdout, stderr } = await compose(['logs', '--tail', String(tail), '--no-color', `app-${slug}`])
  return stdout + (stderr || '')
}

// Cambia (o quita, con domain='') el dominio de un cliente ya desplegado.
export async function setDomain(slug, domain) {
  const finalDomain = (domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const dnsNote = await ensureDns(finalDomain)

  fs.writeFileSync(path.join(TS_DIR, 'sites', `${slug}.caddy`), caddySite(slug, finalDomain))

  const envPath = path.join(CLIENTS_DIR, slug, '.env')
  const url = clientUrl(slug, finalDomain)
  let env = fs.readFileSync(envPath, 'utf8')
  env = env.replace(/^NEXT_PUBLIC_SERVER_URL=.*$/m, `NEXT_PUBLIC_SERVER_URL=${url}`)
  fs.writeFileSync(envPath, env)

  const metaPath = path.join(CLIENTS_DIR, slug, 'client.json')
  const meta = readJson(metaPath)
  meta.domain = finalDomain || null
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

  await compose(['up', '-d', '--force-recreate', `app-${slug}`], { timeout: 180_000 })
  await reloadCaddy()
  return { url, dnsNote }
}

// Baja de un cliente: backup de BD y media, y se retira todo. Los datos quedan
// en backups/ y la carpeta se renombra a _deleted-<slug>-<ts> (no se borra).
export async function deleteClient(slug) {
  const db = dbName(slug)
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  await bash(
    `mkdir -p backups && docker compose exec -T postgres pg_dump -U postgres -d ${db} | gzip > backups/${slug}-final-${ts}.sql.gz`,
    { timeout: 300_000 },
  )
  await bash(`tar -czf backups/${slug}-media-${ts}.tar.gz -C clients ${slug}/media 2>/dev/null || true`, {
    timeout: 300_000,
  })

  await compose(['stop', `app-${slug}`], { timeout: 120_000 })
  await compose(['rm', '-f', `app-${slug}`])
  await bash(`sed -i '\\#clients/${slug}/compose.yml#d' docker-compose.yml`)
  fs.rmSync(path.join(TS_DIR, 'sites', `${slug}.caddy`), { force: true })
  await compose(['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-c', `DROP DATABASE IF EXISTS ${db} WITH (FORCE)`])

  const meta = readJson(path.join(CLIENTS_DIR, slug, 'client.json'))
  fs.renameSync(path.join(CLIENTS_DIR, slug), path.join(CLIENTS_DIR, `_deleted-${slug}-${ts}`))
  await reloadCaddy()

  // Limpieza de los registros DNS si los gestionábamos nosotros
  const s = getSettings()
  if (meta.domain && s.ionosKey) {
    try {
      const zone = await findZoneFor(s.ionosKey, meta.domain)
      if (zone) {
        await deleteARecord(s.ionosKey, zone.id, meta.domain)
        if (meta.domain === zone.name) await deleteARecord(s.ionosKey, zone.id, `www.${meta.domain}`)
      }
    } catch {}
  }
  return { backups: [`backups/${slug}-final-${ts}.sql.gz`, `backups/${slug}-media-${ts}.tar.gz`] }
}
