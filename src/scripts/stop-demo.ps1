$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$statePath = Join-Path $projectRoot '.demo-tools\demo-processes.json'

if (-not (Test-Path -LiteralPath $statePath)) {
    Write-Host 'No existe una demostración administrada activa.'
    exit 0
}

$state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
$stopped = 0

foreach ($name in 'tunnel', 'backend', 'frontend') {
    $saved = $state.$name
    $process = Get-Process -Id ([int]$saved.id) -ErrorAction SilentlyContinue
    if (-not $process) { continue }

    $actualStart = $process.StartTime.ToUniversalTime()
    $savedStart = [DateTime]::Parse($saved.startedAt).ToUniversalTime()
    if ([Math]::Abs(($actualStart - $savedStart).TotalSeconds) -gt 2) {
        Write-Warning "El PID guardado para $name fue reutilizado; no se detuvo."
        continue
    }

    Stop-Process -Id $process.Id -Force
    $stopped += 1
}

Remove-Item -LiteralPath $statePath -Force
Write-Host "Demostración detenida. Procesos cerrados: $stopped."
