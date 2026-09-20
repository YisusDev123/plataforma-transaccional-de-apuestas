$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$frontendRoot = Join-Path $projectRoot 'frontend'
$runtimeRoot = Join-Path $projectRoot '.demo-tools'
$logsRoot = Join-Path $runtimeRoot 'logs'
$statePath = Join-Path $runtimeRoot 'demo-processes.json'
$cloudflaredPath = Join-Path $runtimeRoot 'cloudflared.exe'
$nodePath = (Get-Command node -ErrorAction Stop).Source
$npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
$startedProcesses = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()

function Test-PortAvailable([int]$Port) {
    return -not [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Wait-ForPort([int]$Port, [int]$TimeoutSeconds = 30) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $client = [Net.Sockets.TcpClient]::new()
        try {
            $client.Connect('127.0.0.1', $Port)
            return
        } catch {
            Start-Sleep -Milliseconds 250
        } finally {
            $client.Dispose()
        }
    }
    throw "El puerto $Port no quedó disponible dentro del tiempo esperado"
}

function Stop-StartedProcesses {
    for ($index = $startedProcesses.Count - 1; $index -ge 0; $index -= 1) {
        $process = $startedProcesses[$index]
        if (-not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

try {
    if (-not (Test-Path -LiteralPath $cloudflaredPath)) {
        throw 'No existe .demo-tools/cloudflared.exe'
    }
    if (Test-Path -LiteralPath $statePath) {
        throw 'Existe un estado demo anterior. Ejecuta npm run demo:stop antes de iniciar otra instancia.'
    }
    foreach ($port in 2100, 3100) {
        if (-not (Test-PortAvailable $port)) {
            throw "El puerto exclusivo de demostración $port ya está ocupado"
        }
    }

    Push-Location $frontendRoot
    try {
        & $npmPath run demo:build
        if ($LASTEXITCODE -ne 0) { throw 'El build demo falló' }
    } finally {
        Pop-Location
    }

    New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null
    $runId = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
    $frontendOut = Join-Path $logsRoot "frontend-$runId.out.log"
    $frontendError = Join-Path $logsRoot "frontend-$runId.error.log"
    $tunnelOut = Join-Path $logsRoot "tunnel-$runId.out.log"
    $tunnelError = Join-Path $logsRoot "tunnel-$runId.error.log"
    $backendOut = Join-Path $logsRoot "backend-$runId.out.log"
    $backendError = Join-Path $logsRoot "backend-$runId.error.log"

    $frontend = Start-Process -FilePath $nodePath `
        -ArgumentList @('node_modules/vite/bin/vite.js', 'preview', '--mode', 'demo') `
        -WorkingDirectory $frontendRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendError
    $startedProcesses.Add($frontend)
    Wait-ForPort 3100

    $tunnel = Start-Process -FilePath $cloudflaredPath `
        -ArgumentList @('tunnel', '--url', 'http://127.0.0.1:3100', '--no-autoupdate') `
        -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelError
    $startedProcesses.Add($tunnel)

    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    $demoOrigin = $null
    while ([DateTime]::UtcNow -lt $deadline -and -not $demoOrigin) {
        Start-Sleep -Milliseconds 250
        $tunnelLog = if (Test-Path -LiteralPath $tunnelError) {
            Get-Content -Raw -LiteralPath $tunnelError -ErrorAction SilentlyContinue
        } else { '' }
        $match = [regex]::Match($tunnelLog, 'https://[a-z0-9-]+\.trycloudflare\.com')
        if ($match.Success) { $demoOrigin = $match.Value }
        if ($tunnel.HasExited) { throw 'Cloudflare Tunnel terminó antes de crear la URL' }
    }
    if (-not $demoOrigin) { throw 'Cloudflare Tunnel no entregó una URL dentro del tiempo esperado' }

    $env:NODE_ENV = 'development'
    $env:PORT = '2100'
    $env:APP_RELEASE = 'demo-local'
    $env:MYSQL_DB = 'lottery_demo'
    $env:CORS_ALLOWED_ORIGINS = $demoOrigin
    $env:TRUST_PROXY = 'false'
    $env:REQUIRE_HTTPS = 'false'
    $env:PROCESS_ROLE = 'all'
    $env:EMAIL_PROVIDER = 'disabled'

    $backend = Start-Process -FilePath $nodePath -ArgumentList @('index.js') `
        -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $backendOut -RedirectStandardError $backendError
    $startedProcesses.Add($backend)
    Wait-ForPort 2100

    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3100/api/health/live' -TimeoutSec 10
    if (-not $health.success -or $health.status -ne 'alive') {
        throw 'La verificación local de salud no fue aprobada'
    }

    $processState = [ordered]@{
        startedAt = [DateTime]::UtcNow.ToString('o')
        url = $demoOrigin
        frontend = @{ id = $frontend.Id; startedAt = $frontend.StartTime.ToUniversalTime().ToString('o') }
        backend = @{ id = $backend.Id; startedAt = $backend.StartTime.ToUniversalTime().ToString('o') }
        tunnel = @{ id = $tunnel.Id; startedAt = $tunnel.StartTime.ToUniversalTime().ToString('o') }
        logs = @{ frontend = $frontendOut; backend = $backendOut; tunnel = $tunnelError }
    }
    $processState | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding utf8

    Write-Host ''
    Write-Host 'Demostración iniciada correctamente:'
    Write-Host $demoOrigin
    Write-Host ''
    Write-Host 'Para detenerla: npm run demo:stop'
} catch {
    Stop-StartedProcesses
    throw
}
