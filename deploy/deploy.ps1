# ----------------------------------------------------------------------------
# Despliega el código actual (HEAD del repo) al servidor Hetzner.
# Empaqueta el código, lo sube por SCP y reconstruye la imagen en el servidor.
#
# Uso (desde la raíz del repo o donde sea):
#   .\deploy\deploy.ps1
#
# Requiere: deploy/server-ip.txt con la IP del servidor y la clave SSH
# ~/.ssh/tilestudio_hetzner (ambos los crea el provisionado inicial).
# ----------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'

$repo = Split-Path $PSScriptRoot -Parent
$serverIp = (Get-Content (Join-Path $PSScriptRoot 'server-ip.txt')).Trim()
$key = Join-Path $HOME '.ssh\tilestudio_hetzner'

Write-Host "→ Empaquetando HEAD del repo..."
$tar = Join-Path $env:TEMP 'tilestudio-src.tar.gz'
git -C $repo archive --format=tar.gz -o $tar HEAD
if ($LASTEXITCODE -ne 0) { throw "git archive falló — ¿hay commits sin hacer?" }

Write-Host "→ Subiendo código a $serverIp..."
scp -i $key -o StrictHostKeyChecking=accept-new $tar "root@${serverIp}:/opt/tilestudio/src.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "scp falló" }

Write-Host "→ Build remoto (puede tardar varios minutos)..."
ssh -i $key "root@$serverIp" 'bash /opt/tilestudio/build-on-server.sh'
if ($LASTEXITCODE -ne 0) { throw "build remoto falló" }

Write-Host "✔ Despliegue completado"
