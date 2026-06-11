import { execFile as _execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileP = promisify(_execFile)

// Directorio del stack en el host, montado en el contenedor en la misma ruta
// para que los bind-mounts relativos de compose resuelvan igual dentro y fuera.
export const TS_DIR = '/opt/tilestudio'

export async function sh(cmd, args, opts = {}) {
  return execFileP(cmd, args, {
    cwd: TS_DIR,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
    ...opts,
  })
}

export const compose = (args, opts) => sh('docker', ['compose', ...args], opts)
export const bash = (script, opts) => sh('bash', ['-c', script], opts)
