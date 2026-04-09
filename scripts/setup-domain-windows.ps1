# ─────────────────────────────────────────────────────────────────────────────
# setup-domain-windows.ps1  —  Windows (PowerShell)
# Configura el dominio local para acceder al sistema desde este equipo.
#
# Uso (PowerShell como Administrador):
#   .\setup-domain-windows.ps1
#
# Para desinstalar:
#   .\setup-domain-windows.ps1 -Remove
# ─────────────────────────────────────────────────────────────────────────────

param(
    [switch]$Remove
)

# Verificar que se ejecuta como Administrador
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host ""
    Write-Host "❌ Este script requiere permisos de Administrador." -ForegroundColor Red
    Write-Host "   Haz clic derecho en PowerShell y selecciona 'Ejecutar como administrador'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Leer configuración desde domain-config.txt
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigFile = Join-Path $ScriptDir "domain-config.txt"

if (-not (Test-Path $ConfigFile)) {
    Write-Host "❌ No se encontró domain-config.txt en $ScriptDir" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

$Config = Get-Content $ConfigFile | Where-Object { $_ -notmatch "^#" -and $_ -match "=" }
$ServerIP = ($Config | Where-Object { $_ -match "^SERVER_IP=" }) -replace "SERVER_IP=", "" -replace "\s", ""
$Domain   = ($Config | Where-Object { $_ -match "^DOMAIN=" })   -replace "DOMAIN=",    "" -replace "\s", ""

if (-not $ServerIP -or -not $Domain) {
    Write-Host "❌ SERVER_IP o DOMAIN no definidos en domain-config.txt" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

$HostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
$Marker    = "# gestion-local-domain"

# ── Modo desinstalar ──────────────────────────────────────────────────────────
if ($Remove) {
    $Lines = Get-Content $HostsFile
    $NewLines = $Lines | Where-Object { $_ -notmatch [regex]::Escape($Marker) }
    if ($Lines.Count -ne $NewLines.Count) {
        $NewLines | Set-Content $HostsFile -Encoding UTF8
        Write-Host "✅ Dominio '$Domain' eliminado de hosts" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  No se encontró entrada de '$Domain' en hosts" -ForegroundColor Yellow
    }
    Read-Host "Presiona Enter para salir"
    exit 0
}

# ── Modo instalar ─────────────────────────────────────────────────────────────

# Eliminar entrada anterior si existe
$Lines = Get-Content $HostsFile
$Lines = $Lines | Where-Object { $_ -notmatch [regex]::Escape($Marker) }

# Agregar nueva entrada
$NewEntry = "$ServerIP    $Domain www.$Domain $Marker"
$Lines += $NewEntry
$Lines | Set-Content $HostsFile -Encoding UTF8

Write-Host ""
Write-Host "✅ Configurado correctamente:" -ForegroundColor Green
Write-Host "   Dominio : $Domain" -ForegroundColor Cyan
Write-Host "   IP      : $ServerIP" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Abre en tu navegador: http://$Domain" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Para actualizar la IP o el dominio:" -ForegroundColor Yellow
Write-Host "   1. Edita scripts\domain-config.txt"
Write-Host "   2. Vuelve a ejecutar este script como Administrador"
Write-Host ""
Read-Host "Presiona Enter para salir"
