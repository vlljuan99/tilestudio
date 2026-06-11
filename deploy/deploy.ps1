# ----------------------------------------------------------------------------
# Despliega el codigo actual (HEAD del repo) al servidor Hetzner.
# Empaqueta el codigo, lo sube por SCP y reconstruye la imagen en el servidor.
#
# Uso (desde la raiz del repo o donde sea):
#   .\deploy\deploy.ps1
#
# Requiere: deploy/server-ip.txt con la IP del servidor y la clave SSH
# ~/.ssh/tilestudio_hetzner (ambos los crea el provisionado inicial).
#
# Nota: solo caracteres ASCII en este archivo - PowerShell 5.1 lee los .ps1
# sin BOM como ANSI y los acentos rompen el parser.
# ----------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'

$repo = Split-Path $PSScriptRoot -Parent
$serverIp = (Get-Content (Join-Path $PSScriptRoot 'server-ip.txt')).Trim()
$key = Join-Path $HOME '.ssh\tilestudio_hetzner'

Write-Host "-> Empaquetando HEAD del repo..."
$tar = Join-Path $env:TEMP 'tilestudio-src.tar.gz'
git -C $repo archive --format=tar.gz -o $tar HEAD
if ($LASTEXITCODE -ne 0) { throw "git archive fallo (hay commits sin hacer?)" }

Write-Host "-> Subiendo codigo a $serverIp..."
scp -i $key -o StrictHostKeyChecking=accept-new $tar "root@${serverIp}:/opt/tilestudio/src.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "scp fallo" }

# Sincroniza tambien los scripts del servidor (si no, se quedan en la version
# con la que se provisiono y los cambios del repo nunca llegan)
Write-Host "-> Sincronizando scripts de deploy..."
scp -i $key (Join-Path $PSScriptRoot 'add-client.sh') (Join-Path $PSScriptRoot 'backup.sh') (Join-Path $PSScriptRoot 'build-on-server.sh') (Join-Path $PSScriptRoot 'hub-compose.yml') "root@${serverIp}:/opt/tilestudio/"
if ($LASTEXITCODE -ne 0) { throw "scp de scripts fallo" }
ssh -i $key "root@$serverIp" "cd /opt/tilestudio; sed -i 's/\r$//' add-client.sh backup.sh build-on-server.sh hub-compose.yml; chmod +x add-client.sh backup.sh build-on-server.sh"
if ($LASTEXITCODE -ne 0) { throw "normalizacion de scripts fallo" }

Write-Host "-> Build remoto (puede tardar varios minutos)..."
ssh -i $key "root@$serverIp" 'bash /opt/tilestudio/build-on-server.sh'
if ($LASTEXITCODE -ne 0) { throw "build remoto fallo" }

Write-Host "OK - Despliegue completado"
