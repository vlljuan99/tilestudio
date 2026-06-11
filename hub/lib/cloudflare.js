const API = 'https://api.cloudflare.com/client/v4'

async function cf(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!data.success) {
    const msg = (data.errors || []).map((e) => e.message).join('; ') || `HTTP ${res.status}`
    throw new Error(`Cloudflare: ${msg}`)
  }
  return data.result
}

export async function findZone(token, domain) {
  const zones = await cf(token, `/zones?name=${encodeURIComponent(domain)}`)
  return zones[0] || null
}

// Crea o actualiza un registro A. `proxied: false` (nube gris) para que Caddy
// pueda emitir el certificado Let's Encrypt con el desafío HTTP.
export async function upsertARecord(token, zoneId, fqdn, ip) {
  const existing = await cf(
    token,
    `/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(fqdn)}`,
  )
  const body = JSON.stringify({ type: 'A', name: fqdn, content: ip, ttl: 300, proxied: false })
  if (existing[0]) {
    return cf(token, `/zones/${zoneId}/dns_records/${existing[0].id}`, { method: 'PUT', body })
  }
  return cf(token, `/zones/${zoneId}/dns_records`, { method: 'POST', body })
}

export async function deleteARecord(token, zoneId, fqdn) {
  const existing = await cf(
    token,
    `/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(fqdn)}`,
  )
  if (existing[0]) {
    await cf(token, `/zones/${zoneId}/dns_records/${existing[0].id}`, { method: 'DELETE' })
  }
}
