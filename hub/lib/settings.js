import fs from 'node:fs'
import path from 'node:path'
import { TS_DIR } from './sh.js'

const FILE = path.join(TS_DIR, 'hub-settings.json')

// { baseDomain, cfToken, cfZoneId, cfZoneStatus, cfNameServers }
export function getSettings() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}

export function saveSettings(settings) {
  fs.writeFileSync(FILE, JSON.stringify(settings, null, 2), { mode: 0o600 })
}

// PUBLIC_HOST del .env del stack (ej: 167.233.99.156.sslip.io)
export function getPublicHost() {
  try {
    const env = fs.readFileSync(path.join(TS_DIR, '.env'), 'utf8')
    const m = env.match(/^PUBLIC_HOST=(.+)$/m)
    return m ? m[1].trim() : ''
  } catch {
    return ''
  }
}
