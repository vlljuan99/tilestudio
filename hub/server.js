// Tilestudio Hub — panel de gestión multi-cliente.
// Corre en el propio servidor y opera el stack vía docker compose + Cloudflare.
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import {
  loginAllowed, registerLogin, verifyPassword, newSessionCookie, validSession,
} from './lib/auth.js'
import { getSettings, saveSettings, getPublicHost } from './lib/settings.js'
import { findZone, upsertARecord } from './lib/ionos.js'
import {
  SLUG_RE, slugify, listClients, containerStatuses, dbSizes, createClient,
  restartClient, clientLogs, setDomain, deleteClient, reloadCaddy, publicStatuses,
} from './lib/clients.js'
import {
  loginPage, dashboard, clientCreated, logsPage, settingsPage, buildLogPage, errorPage,
} from './lib/render.js'
import { bash, TS_DIR } from './lib/sh.js'

const app = express()
app.set('trust proxy', true)
app.use(express.urlencoded({ extended: false }))

const COOKIE = 'ts_hub'

function getCookie(req) {
  const raw = req.headers.cookie || ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE) return v.join('=')
  }
  return null
}

app.get('/healthz', (_req, res) => res.json({ ok: true }))

app.get('/login', (_req, res) => res.send(loginPage()))

app.post('/login', (req, res) => {
  const ip = req.ip
  if (!loginAllowed(ip)) {
    return res.status(429).send(loginPage('Demasiados intentos. Espera 15 minutos.'))
  }
  const ok = verifyPassword(req.body.password)
  registerLogin(ip, ok)
  if (!ok) return res.status(401).send(loginPage('Contraseña incorrecta.'))
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${newSessionCookie()}; HttpOnly; Secure; Path=/; Max-Age=604800; SameSite=Strict`,
  )
  res.redirect('/')
})

app.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=Strict`)
  res.redirect('/login')
})

// Todo lo que sigue requiere sesión
app.use((req, res, next) => {
  if (!validSession(getCookie(req))) return res.redirect('/login')
  next()
})

// Mensajes flash simples vía query string (solo texto plano, se escapa al renderizar)
const flash = (req) => ({ notice: req.query.ok || '', error: req.query.err || '' })
const redirectMsg = (res, ok, err) =>
  res.redirect(`/?${ok ? `ok=${encodeURIComponent(ok)}` : `err=${encodeURIComponent(err)}`}`)

// Estado en vivo para el semáforo del dashboard (lo consulta JS cada 20 s)
app.get('/api/status', async (_req, res) => {
  const clients = listClients()
  const [statuses, pub] = await Promise.all([containerStatuses(), publicStatuses(clients)])
  res.json(
    clients.map((c) => {
      const st = statuses[`app-${c.slug}`]
      return {
        slug: c.slug,
        running: st?.state === 'running',
        publicOk: Boolean(pub[c.slug]),
        status: st?.status || 'sin contenedor',
      }
    }),
  )
})

app.get('/', async (req, res) => {
  const [statuses, sizes] = await Promise.all([containerStatuses(), dbSizes()])
  res.send(
    dashboard({
      clients: listClients(),
      statuses,
      sizes,
      settings: getSettings(),
      publicHost: getPublicHost(),
      ...flash(req),
    }),
  )
})

app.post('/clients', async (req, res) => {
  const name = (req.body.name || '').trim()
  const slug = (req.body.slug || '').trim() || slugify(name)
  try {
    if (!name) throw new Error('El nombre es obligatorio.')
    if (!SLUG_RE.test(slug)) throw new Error(`Slug inválido: «${slug}». Usa minúsculas, números y guiones.`)
    const result = await createClient({
      name,
      slug,
      domain: req.body.domain,
      adminEmail: (req.body.adminEmail || '').trim(),
      adminName: (req.body.adminName || '').trim(),
    })
    res.send(clientCreated({ name, ...result }))
  } catch (err) {
    res.status(500).send(errorPage(`No se pudo crear «${name || slug}»: ${err.message}`))
  }
})

const validSlug = (req, res) => {
  const slug = req.params.slug
  if (!SLUG_RE.test(slug)) {
    res.status(400).send(errorPage('Slug inválido'))
    return null
  }
  return slug
}

app.post('/clients/:slug/restart', async (req, res) => {
  const slug = validSlug(req, res)
  if (!slug) return
  try {
    await restartClient(slug)
    redirectMsg(res, `«${slug}» reiniciado.`)
  } catch (err) {
    redirectMsg(res, null, `No se pudo reiniciar «${slug}»: ${err.message}`)
  }
})

app.get('/clients/:slug/logs', async (req, res) => {
  const slug = validSlug(req, res)
  if (!slug) return
  try {
    res.send(logsPage(slug, await clientLogs(slug)))
  } catch (err) {
    res.status(500).send(errorPage(`No se pudieron leer los logs: ${err.message}`))
  }
})

app.post('/clients/:slug/domain', async (req, res) => {
  const slug = validSlug(req, res)
  if (!slug) return
  try {
    const { url, dnsNote } = await setDomain(slug, req.body.domain)
    redirectMsg(res, `«${slug}» ahora responde en ${url}. ${dnsNote}`)
  } catch (err) {
    redirectMsg(res, null, `No se pudo cambiar el dominio de «${slug}»: ${err.message}`)
  }
})

app.post('/clients/:slug/delete', async (req, res) => {
  const slug = validSlug(req, res)
  if (!slug) return
  if ((req.body.confirm_slug || '').trim() !== slug) {
    return redirectMsg(res, null, `Baja cancelada: el texto de confirmación no coincide con «${slug}».`)
  }
  try {
    const { backups } = await deleteClient(slug)
    redirectMsg(res, `«${slug}» dado de baja. Backups: ${backups.join(' y ')}`)
  } catch (err) {
    redirectMsg(res, null, `No se pudo dar de baja «${slug}»: ${err.message}`)
  }
})

app.get('/settings', (req, res) => {
  res.send(settingsPage({ settings: getSettings(), serverIp: process.env.SERVER_IP, ...flash(req) }))
})

app.post('/settings', async (req, res) => {
  const settings = getSettings()
  const baseDomain = (req.body.baseDomain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const ionosKey = (req.body.ionosKey || '').trim() || settings.ionosKey
  try {
    if (!baseDomain) throw new Error('Indica el dominio base.')
    if (!ionosKey) throw new Error('Falta la API key de IONOS (formato prefijo.secreto).')
    const zone = await findZone(ionosKey, baseDomain)
    if (!zone) {
      throw new Error(
        `La API key funciona pero no veo la zona «${baseDomain}» en esa cuenta de IONOS. ¿El dominio está en esa cuenta y usa los nameservers de IONOS?`,
      )
    }
    Object.assign(settings, { baseDomain, ionosKey, ionosZoneId: zone.id })
    saveSettings(settings)

    let hubNote = ''
    if (req.body.applyHub) {
      const hubDomain = `hub.${baseDomain}`
      await upsertARecord(ionosKey, zone.id, hubDomain, process.env.SERVER_IP)
      fs.writeFileSync(
        path.join(TS_DIR, 'sites', 'hub.caddy'),
        `${hubDomain} {\n\tencode gzip\n\treverse_proxy hub:3000\n}\n\nhttps://hub.${getPublicHost()} {\n\ttls internal\n\treverse_proxy hub:3000\n}\n`,
      )
      await reloadCaddy()
      hubNote = ` Este panel también estará en https://${hubDomain} en cuanto el DNS propague (minutos).`
    }
    res.redirect(`/settings?ok=${encodeURIComponent(`Configuración guardada y verificada contra IONOS.${hubNote}`)}`)
  } catch (err) {
    res.redirect(`/settings?err=${encodeURIComponent(err.message)}`)
  }
})

app.post('/system/rebuild', async (_req, res) => {
  try {
    await bash('nohup bash build-on-server.sh > build.log 2>&1 & echo lanzado')
    redirectMsg(res, 'Build lanzado. Sigue el progreso en «Ver log del último build».')
  } catch (err) {
    redirectMsg(res, null, `No se pudo lanzar el build: ${err.message}`)
  }
})

app.get('/system/build-log', (_req, res) => {
  let log = ''
  try {
    const full = fs.readFileSync(path.join(TS_DIR, 'build.log'), 'utf8')
    log = full.split('\n').slice(-150).join('\n')
  } catch {}
  res.send(buildLogPage(log))
})

app.use((_req, res) => res.status(404).send(errorPage('Página no encontrada')))

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`[hub] escuchando en :${port}`))
