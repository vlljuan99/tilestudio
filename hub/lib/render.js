// Render de páginas: HTML servido directamente, sin framework de frontend.

export function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function layout(title, body) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · Tilestudio Hub</title>
<style>
  :root { --bg:#0f1115; --card:#181b22; --line:#2a2f3a; --text:#e8eaf0; --muted:#9aa3b2;
          --accent:#e8734a; --ok:#3fb96d; --bad:#e05555; --warn:#d9a13b; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text);
         font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  a { color:var(--accent); text-decoration:none; }
  a:hover { text-decoration:underline; }
  header { display:flex; align-items:center; gap:12px; padding:14px 22px;
           border-bottom:1px solid var(--line); background:var(--card); }
  header h1 { font-size:17px; margin:0; }
  header .grow { flex:1; }
  main { max-width:980px; margin:26px auto; padding:0 18px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px;
          padding:18px 20px; margin-bottom:18px; }
  h2 { font-size:15px; margin:0 0 12px; color:var(--muted); text-transform:uppercase;
       letter-spacing:.06em; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:9px 10px; border-bottom:1px solid var(--line);
           vertical-align:middle; }
  th { color:var(--muted); font-weight:500; font-size:13px; }
  tr:last-child td { border-bottom:none; }
  .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:7px; }
  .dot.ok { background:var(--ok); } .dot.bad { background:var(--bad); }
  .muted { color:var(--muted); font-size:13px; }
  input, select { background:#10131a; color:var(--text); border:1px solid var(--line);
          border-radius:7px; padding:8px 10px; font:inherit; width:100%; }
  input:focus { outline:none; border-color:var(--accent); }
  label { display:block; font-size:13px; color:var(--muted); margin:10px 0 4px; }
  button { background:var(--accent); color:#fff; border:none; border-radius:7px;
           padding:8px 14px; font:inherit; cursor:pointer; }
  button:hover { filter:brightness(1.1); }
  button.ghost { background:transparent; border:1px solid var(--line); color:var(--text); }
  button.danger { background:var(--bad); }
  .row { display:flex; gap:14px; flex-wrap:wrap; }
  .row > div { flex:1; min-width:180px; }
  .actions { display:flex; gap:6px; flex-wrap:wrap; }
  .actions form { display:inline; }
  .actions button, .actions a.btn { font-size:13px; padding:5px 10px; background:transparent;
           border:1px solid var(--line); color:var(--text); border-radius:7px; display:inline-block; }
  .actions a.btn:hover { text-decoration:none; border-color:var(--accent); }
  .notice { border-left:3px solid var(--ok); padding:10px 14px; background:#16241c;
            border-radius:0 8px 8px 0; margin-bottom:16px; white-space:pre-wrap; }
  .notice.error { border-color:var(--bad); background:#2a1818; }
  .notice.warn { border-color:var(--warn); background:#272113; }
  pre { background:#0a0c10; border:1px solid var(--line); border-radius:8px; padding:14px;
        overflow:auto; font-size:12.5px; line-height:1.45; }
  code.cred { background:#0a0c10; padding:3px 8px; border-radius:6px; font-size:14px;
        border:1px solid var(--line); user-select:all; }
  details { margin-top:8px; }
  summary { cursor:pointer; color:var(--muted); font-size:13px; }
</style>
</head>
<body>
<header>
  <h1>⬢ Tilestudio <span style="color:var(--accent)">Hub</span></h1>
  <span class="grow"></span>
  <nav><a href="/">Clientes</a> &nbsp;·&nbsp; <a href="/settings">DNS y dominio</a>
  &nbsp;·&nbsp; <a href="/system/build-log">Último build</a></nav>
  <form method="post" action="/logout" style="margin-left:14px"><button class="ghost">Salir</button></form>
</header>
<main>${body}</main>
</body>
</html>`
}

export function loginPage(error) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Tilestudio Hub</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0f1115;
         color:#e8eaf0; font:15px system-ui,sans-serif; }
  form { background:#181b22; border:1px solid #2a2f3a; border-radius:12px; padding:34px;
         width:320px; }
  h1 { font-size:19px; margin:0 0 18px; text-align:center; }
  input { width:100%; box-sizing:border-box; background:#10131a; color:#e8eaf0;
          border:1px solid #2a2f3a; border-radius:7px; padding:10px 12px; font:inherit; }
  button { width:100%; margin-top:14px; background:#e8734a; color:#fff; border:none;
           border-radius:7px; padding:10px; font:inherit; cursor:pointer; }
  .err { color:#e05555; font-size:13px; margin-top:10px; text-align:center; }
</style></head>
<body><form method="post" action="/login">
<h1>⬢ Tilestudio Hub</h1>
<input type="password" name="password" placeholder="Contraseña" autofocus autocomplete="current-password">
<button>Entrar</button>
${error ? `<div class="err">${esc(error)}</div>` : ''}
</form></body></html>`
}

export function dashboard({ clients, statuses, sizes, settings, publicHost, notice, error }) {
  const dnsReady = Boolean(settings.cfToken && settings.cfZoneId)
  const rows = clients
    .map((c) => {
      const st = statuses[`app-${c.slug}`]
      const running = st?.state === 'running'
      const size = sizes[`tilestudio_${c.slug.replaceAll('-', '_')}`] || '—'
      return `<tr>
  <td><span class="dot ${running ? 'ok' : 'bad'}"></span><strong>${esc(c.name)}</strong>
      <div class="muted">${esc(c.slug)} · BD ${esc(size)}</div></td>
  <td><a href="${esc(c.url)}" target="_blank">${esc(c.url.replace(/^https?:\/\//, ''))}</a>
      <div class="muted">${running ? esc(st.status) : st ? `⚠ ${esc(st.status || st.state)}` : '⚠ sin contenedor'}</div></td>
  <td class="actions">
    <a class="btn" href="${esc(c.url)}/admin" target="_blank">Admin</a>
    <a class="btn" href="/clients/${esc(c.slug)}/logs">Logs</a>
    <form method="post" action="/clients/${esc(c.slug)}/restart"><button>Reiniciar</button></form>
    <details>
      <summary>Más</summary>
      <form method="post" action="/clients/${esc(c.slug)}/domain" style="margin:8px 0">
        <label>Dominio (vacío = volver a ${esc(c.slug)}.${esc(publicHost)})</label>
        <input name="domain" value="${esc(c.domain || '')}" placeholder="${esc(c.slug)}.tudominio.com">
        <button style="margin-top:6px">Aplicar dominio</button>
      </form>
      <form method="post" action="/clients/${esc(c.slug)}/delete"
            onsubmit="return this.confirm_slug.value==='${esc(c.slug)}' || (alert('Escribe el slug exacto para confirmar'),false)">
        <label>Dar de baja (escribe «${esc(c.slug)}» para confirmar; se guarda backup)</label>
        <input name="confirm_slug" placeholder="${esc(c.slug)}">
        <button class="danger" style="margin-top:6px">Dar de baja</button>
      </form>
    </details>
  </td>
</tr>`
    })
    .join('')

  return layout('Clientes', `
${notice ? `<div class="notice">${esc(notice)}</div>` : ''}
${error ? `<div class="notice error">${esc(error)}</div>` : ''}
${!dnsReady ? `<div class="notice warn">DNS automático sin configurar: las tiendas nuevas salen en http://&lt;slug&gt;.${esc(publicHost)}. Configúralo en <a href="/settings">DNS y dominio</a>.</div>` : ''}

<div class="card">
<h2>Clientes (${clients.length})</h2>
${clients.length ? `<table><tr><th>Cliente</th><th>URL</th><th>Acciones</th></tr>${rows}</table>` : '<p class="muted">Todavía no hay clientes.</p>'}
</div>

<div class="card">
<h2>Nuevo cliente</h2>
<form method="post" action="/clients" onsubmit="this.btn.disabled=true;this.btn.textContent='Creando… (1-3 min)'">
  <div class="row">
    <div><label>Nombre del cliente *</label><input name="name" required placeholder="Helvagres S.L."></div>
    <div><label>Slug (se genera solo si lo dejas vacío)</label><input name="slug" placeholder="helvagres" pattern="[a-z0-9][a-z0-9-]{1,28}[a-z0-9]"></div>
  </div>
  <div class="row">
    <div><label>Dominio (opcional${settings.baseDomain ? ` — por defecto &lt;slug&gt;.${esc(settings.baseDomain)}` : ''})</label>
         <input name="domain" placeholder="${settings.baseDomain ? `cliente.${esc(settings.baseDomain)}` : 'catalogo.cliente.es'}"></div>
    <div><label>Email del admin de la tienda (crea el usuario y te da la contraseña)</label>
         <input name="adminEmail" type="email" placeholder="gerente@cliente.es"></div>
  </div>
  <div class="row">
    <div><label>Nombre del admin (opcional)</label><input name="adminName" placeholder="María García"></div>
    <div style="display:flex;align-items:flex-end"><button name="btn" style="width:100%">Crear cliente</button></div>
  </div>
</form>
</div>

<div class="card">
<h2>Sistema</h2>
<div class="actions">
  <form method="post" action="/system/rebuild"
        onsubmit="return confirm('Reconstruye la imagen con el último código subido y reinicia todas las tiendas. ¿Seguir?')">
    <button class="ghost">Reconstruir y actualizar todas las tiendas</button>
  </form>
  <a class="btn" href="/system/build-log">Ver log del último build</a>
</div>
<p class="muted">El código se sube desde tu equipo con <code>deploy\\deploy.ps1</code>; este botón solo reconstruye con lo último subido.</p>
</div>`)
}

export function clientCreated({ name, url, dnsNote, creds, credsError }) {
  return layout('Cliente creado', `
<div class="notice">Cliente «${esc(name)}» creado y funcionando.</div>
<div class="card">
  <h2>Datos de la tienda</h2>
  <p>URL: <a href="${esc(url)}" target="_blank">${esc(url)}</a><br>
  Admin: <a href="${esc(url)}/admin" target="_blank">${esc(url)}/admin</a></p>
  ${dnsNote ? `<p class="muted">${esc(dnsNote)}</p>` : ''}
  ${creds ? `<h2 style="margin-top:18px">Credenciales del administrador — guárdalas ahora, no se vuelven a mostrar</h2>
  <p>Email: <code class="cred">${esc(creds.email)}</code><br><br>
  Contraseña: <code class="cred">${esc(creds.password)}</code></p>` : ''}
  ${credsError ? `<div class="notice error">La tienda está creada pero el usuario admin falló: ${esc(credsError)}\nPuedes crearlo a mano entrando en ${esc(url)}/admin.</div>` : ''}
  <p><a href="/">← Volver al panel</a></p>
</div>`)
}

export function logsPage(slug, logs) {
  return layout(`Logs ${slug}`, `
<div class="card">
  <h2>Logs de ${esc(slug)} (últimas 200 líneas) · <a href="/clients/${esc(slug)}/logs">recargar</a> · <a href="/">volver</a></h2>
  <pre>${esc(logs || '(sin salida)')}</pre>
</div>`)
}

export function settingsPage({ settings, serverIp, notice, error }) {
  const ns = settings.cfNameServers || []
  return layout('DNS y dominio', `
${notice ? `<div class="notice">${esc(notice)}</div>` : ''}
${error ? `<div class="notice error">${esc(error)}</div>` : ''}
<div class="card">
<h2>Dominio base + Cloudflare</h2>
<p class="muted">Con esto configurado, cada cliente nuevo sale automáticamente en
<strong>&lt;slug&gt;.${esc(settings.baseDomain || 'tudominio.com')}</strong> con DNS creado en Cloudflare
y HTTPS automático. IP del servidor: <code class="cred">${esc(serverIp)}</code></p>
<form method="post" action="/settings">
  <label>Dominio base (el que tienes en IONOS, ej. tilestudio.es)</label>
  <input name="baseDomain" value="${esc(settings.baseDomain || '')}" placeholder="tilestudio.es">
  <label>API token de Cloudflare (permiso Zone → DNS → Edit sobre esa zona)</label>
  <input name="cfToken" type="password" placeholder="${settings.cfToken ? '(configurado — escribe solo para cambiarlo)' : 'pega aquí el token'}">
  <label style="display:flex;align-items:center;gap:8px;margin-top:12px">
    <input type="checkbox" name="applyHub" checked style="width:auto"> Activar también hub.&lt;dominio&gt; con HTTPS para este panel
  </label>
  <button style="margin-top:14px">Guardar y verificar</button>
</form>
${settings.cfZoneId ? `<p class="muted" style="margin-top:14px">Zona: <strong>${esc(settings.baseDomain)}</strong> · estado: <strong>${esc(settings.cfZoneStatus || '?')}</strong>${settings.cfZoneStatus !== 'active' && ns.length ? `<br>Para activarla, pon estos nameservers en IONOS (sustituyen a los suyos): <strong>${esc(ns.join(' · '))}</strong>` : ''}</p>` : ''}
</div>
<div class="card">
<h2>Cómo se conecta (una vez)</h2>
<ol class="muted">
  <li>Crea cuenta gratuita en <a href="https://dash.cloudflare.com" target="_blank">Cloudflare</a> y pulsa «Add a domain» con tu dominio de IONOS (plan Free).</li>
  <li>Cloudflare te dará 2 nameservers. En el panel de IONOS → Dominios → Nameservers, sustituye los de IONOS por esos 2 (tarda de minutos a horas en propagar).</li>
  <li>En Cloudflare → My Profile → API Tokens → «Create Token» → plantilla «Edit zone DNS», limita a tu zona, y pega aquí el token.</li>
</ol>
</div>`)
}

export function buildLogPage(log) {
  return layout('Build', `
<div class="card">
  <h2>Log del último build · <a href="/system/build-log">recargar</a> · <a href="/">volver</a></h2>
  <pre>${esc(log || '(sin builds todavía)')}</pre>
</div>`)
}

export function errorPage(message) {
  return layout('Error', `
<div class="notice error">${esc(message)}</div>
<p><a href="/">← Volver al panel</a></p>`)
}
