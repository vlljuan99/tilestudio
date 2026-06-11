// Cliente mínimo de la API de DNS de IONOS.
// Docs: https://developer.hosting.ionos.es → API "DNS".
// La API key se crea en el portal de desarrollador y tiene la forma
// "publicprefix.secret"; va entera en la cabecera X-API-Key.
const API = 'https://api.hosting.ionos.com/dns/v1'

async function ionos(apiKey, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    let detail = ''
    try {
      detail = JSON.stringify(await res.json())
    } catch {}
    throw new Error(`IONOS DNS: HTTP ${res.status}${detail ? ` — ${detail.slice(0, 300)}` : ''}`)
  }
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function findZone(apiKey, domain) {
  const zones = await ionos(apiKey, '/zones')
  return (zones || []).find((z) => z.name === domain) || null
}

// Busca la zona de la cuenta que cubre un dominio cualquiera:
// "helvagres.es" → zona helvagres.es; "tienda.agumasa.es" → zona agumasa.es.
// Devuelve null si el dominio no está en esta cuenta de IONOS.
export async function findZoneFor(apiKey, domain) {
  const zones = await ionos(apiKey, '/zones')
  let best = null
  for (const z of zones || []) {
    if (domain === z.name || domain.endsWith(`.${z.name}`)) {
      if (!best || z.name.length > best.name.length) best = z
    }
  }
  return best
}

async function findARecords(apiKey, zoneId, fqdn) {
  const zone = await ionos(
    apiKey,
    `/zones/${zoneId}?recordName=${encodeURIComponent(fqdn)}&recordType=A`,
  )
  return (zone && zone.records) || []
}

export async function upsertARecord(apiKey, zoneId, fqdn, ip) {
  const records = await findARecords(apiKey, zoneId, fqdn)
  if (records[0]) {
    await ionos(apiKey, `/zones/${zoneId}/records/${records[0].id}`, {
      method: 'PUT',
      body: JSON.stringify({ content: ip, ttl: 600, prio: 0, disabled: false }),
    })
    return
  }
  await ionos(apiKey, `/zones/${zoneId}/records`, {
    method: 'POST',
    body: JSON.stringify([{ name: fqdn, type: 'A', content: ip, ttl: 600, prio: 0, disabled: false }]),
  })
}

export async function deleteARecord(apiKey, zoneId, fqdn) {
  const records = await findARecords(apiKey, zoneId, fqdn)
  for (const r of records) {
    await ionos(apiKey, `/zones/${zoneId}/records/${r.id}`, { method: 'DELETE' })
  }
}
