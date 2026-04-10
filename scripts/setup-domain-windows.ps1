# ─────────────────────────────────────────────────────────────────────────────
# setup-domain-windows.ps1 — Windows (PowerShell)
#
# Ejecutar en cada PC Windows que necesite acceder a gestion.local.
# Cuando el servidor cambie de IP, edita SERVER_IP abajo y vuelve a ejecutar.
#
# Uso (PowerShell como Administrador):
#   .\setup-domain-windows.ps1
#
# Para desinstalar:
#   .\setup-domain-windows.ps1 -Remove
# ─────────────────────────────────────────────────────────────────────────────

param([switch]$Remove)

# ── EDITA ESTA IP CUANDO CAMBIE EL SERVIDOR ───────────────────────────────────
# Puedes ver la IP actual del servidor en: /var/log/gestion-update-hosts.log
# o ejecutando en el Mac: ipconfig getifaddr en0
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigFile = Join-Path $ScriptDir "domain-config.txt"
$Config  = Get-Content $ConfigFile | Where-Object { $_ -notmatch "^#" -and $_ -match "=" }
$Domain  = ($Config | Where-Object { $_ -match "^DOMAIN=" }) -replace "DOMAIN=", "" -replace "\s", ""
if (-not $Domain) { $Domain = "gestion.local" }

# IP del servidor Mac — se lee del domain-config.txt si existe SERVER_IP,
# si no, pide al usuario que la ingrese
$ServerIP = ($Config | Where-Object { $_ -match "^SERVER_IP=" }) -replace "SERVER_IP=", "" -replace "\s", ""
if (-not $ServerIP) {
    $ServerIP = Read-Host "Ingresa la IP del servidor Mac (ej: 192.168.10.181)"
}
# ─────────────────────────────────────────────────────────────────────────────

# Verificar permisos de Administrador
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host ""
    Write-Host "❌ Requiere permisos de Administrador." -ForegroundColor Red
    Write-Host "   Clic derecho en PowerShell → 'Ejecutar como administrador'" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

$HostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
$Marker    = "# gestion-local-domain"

if ($Remove) {
    $Lines = Get-Content $HostsFile | Where-Object { $_ -notmatch [regex]::Escape($Marker) }
    $Lines | Set-Content $HostsFile -Encoding UTF8
    Write-Host "✅ Entrada eliminada." -ForegroundColor Green
    Read-Host "Presiona Enter para salir"
    exit 0
}

# Eliminar entrada anterior y agregar la nueva
$Lines = Get-Content $HostsFile | Where-Object { $_ -notmatch [regex]::Escape($Marker) }
$Lines += "$ServerIP    $Domain www.$Domain $Marker"
$Lines | Set-Content $HostsFile -Encoding UTF8

# Limpiar caché DNS de Windows
ipconfig /flushdns | Out-Null

Write-Host ""
Write-Host "✅ Configurado:" -ForegroundColor Green
Write-Host "   $Domain → $ServerIP" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Abre: http://$Domain" -ForegroundColor Green
Write-Host ""
Read-Host "Presiona Enter para salir"
