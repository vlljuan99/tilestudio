// Despliegues: recepción de código (tarball), lanzamiento del pipeline en un
// contenedor hermano y lectura de estado/logs desde deploys/<id>.*
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { sh, TS_DIR } from './sh.js'

const DIR = path.join(TS_DIR, 'deploys')
const TOKEN_FILE = path.join(TS_DIR, 'hub-deploy-token')

export const DEPLOY_ID_RE = /^[A-Za-z0-9_-]{1,80}$/

// Token para el endpoint /api/deploy (GitHub Actions). Se genera una vez y se
// muestra en Ajustes; HUB_DEPLOY_TOKEN en hub.env lo sobreescribe si existe.
export function getDeployToken() {
  if (process.env.HUB_DEPLOY_TOKEN) return process.env.HUB_DEPLOY_TOKEN.trim()
  try {
    const t = fs.readFileSync(TOKEN_FILE, 'utf8').trim()
    if (t) return t
  } catch {}
  const token = crypto.randomBytes(32).toString('hex')
  fs.writeFileSync(TOKEN_FILE, `${token}\n`, { mode: 0o600 })
  return token
}

export function tokenOk(authorizationHeader) {
  const expected = Buffer.from(getDeployToken())
  const got = Buffer.from((authorizationHeader || '').replace(/^Bearer\s+/i, '').trim())
  return got.length === expected.length && crypto.timingSafeEqual(got, expected)
}

export function saveTarball(buf) {
  fs.writeFileSync(path.join(TS_DIR, 'src.tar.gz'), buf)
}

export function createDeploy({ commit = '', ref = '', actor = '', origin = 'manual' } = {}) {
  fs.mkdirSync(DIR, { recursive: true })
  // El timestamp ISO ordena lexicográficamente — el listado sale gratis
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(2).toString('hex')}`
  const meta = { id, commit, ref, actor, origin, startedAt: new Date().toISOString() }
  fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify(meta, null, 2))
  fs.writeFileSync(path.join(DIR, `${id}.status`), 'running\n')
  return meta
}

// Contenedor hermano con el socket de docker: el pipeline sigue vivo aunque
// `compose up` recree el contenedor del hub a mitad del despliegue.
export async function launchDeploy(id) {
  await sh('docker', [
    'run', '-d', '--rm',
    '--name', `tilestudio-deploy-${id}`,
    '-v', '/var/run/docker.sock:/var/run/docker.sock',
    '-v', `${TS_DIR}:${TS_DIR}`,
    '-w', TS_DIR,
    'tilestudio-hub:latest',
    'bash', 'deploy-on-server.sh', id,
  ])
}

function readOpt(file) {
  try {
    return fs.readFileSync(path.join(DIR, file), 'utf8').trim()
  } catch {
    return null
  }
}

export function getDeploy(id) {
  if (!DEPLOY_ID_RE.test(id)) return null
  let meta
  try {
    meta = JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), 'utf8'))
  } catch {
    return null
  }
  const status = readOpt(`${id}.status`) || 'running'
  const finishedAt = readOpt(`${id}.finished`)
  const end = finishedAt ? new Date(finishedAt) : new Date()
  const durationSec = Math.max(0, Math.round((end - new Date(meta.startedAt)) / 1000))
  return { ...meta, status, finishedAt, durationSec }
}

export function listDeploys(limit = 15) {
  let files = []
  try {
    files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  return files
    .sort()
    .reverse()
    .slice(0, limit)
    .map((f) => getDeploy(f.replace(/\.json$/, '')))
    .filter(Boolean)
}

export function deployLog(id, tailLines = 400) {
  if (!DEPLOY_ID_RE.test(id)) return ''
  try {
    const full = fs.readFileSync(path.join(DIR, `${id}.log`), 'utf8')
    return full.split('\n').slice(-tailLines).join('\n')
  } catch {
    return ''
  }
}

// Evita dos deploys simultáneos; un "running" de hace >45 min se considera
// muerto (contenedor matado, servidor reiniciado…) y no bloquea.
export function runningDeploy() {
  const d = listDeploys(5).find((x) => x.status === 'running')
  if (!d) return null
  if (Date.now() - new Date(d.startedAt) > 45 * 60 * 1000) return null
  return d
}
