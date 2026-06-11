import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

const SECRET = process.env.HUB_SESSION_SECRET
const HASH = process.env.HUB_PASSWORD_HASH
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000

if (!SECRET || !HASH) {
  console.error('Faltan HUB_SESSION_SECRET o HUB_PASSWORD_HASH en hub.env')
  process.exit(1)
}

// Rate limit de login en memoria: 5 intentos fallidos → 15 min de bloqueo
const attempts = new Map()

export function loginAllowed(ip) {
  const a = attempts.get(ip)
  return !(a && a.count >= 5 && a.until > Date.now())
}

export function registerLogin(ip, ok) {
  if (ok) {
    attempts.delete(ip)
    return
  }
  const a = attempts.get(ip) || { count: 0, until: 0 }
  a.count += 1
  a.until = Date.now() + 15 * 60_000
  attempts.set(ip, a)
}

export function verifyPassword(password) {
  return bcrypt.compareSync(password || '', HASH)
}

const sign = (exp) => crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex')

export function newSessionCookie() {
  const exp = Date.now() + SESSION_TTL_MS
  return `${exp}.${sign(exp)}`
}

export function validSession(value) {
  if (!value) return false
  const [exp, sig] = value.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  const expected = sign(exp)
  return (
    sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
}
