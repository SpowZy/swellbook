# One-shot Swellbook demo launcher (Windows).
#
#   demo\start.cmd     boot everything (or fast-attach if already healthy)
#   demo\reset.cmd     wipe the local database, reseed, restart: pristine demo
#   demo\stop.cmd      stop the app server (Postgres container keeps running)
#   demo\race.cmd      run the 25-way booking race in its own window
#   -Build             force a rebuild of the production bundle
#   -NoBrowser         do not open browser tabs

param(
    [switch]$Reset,
    [switch]$Build,
    [switch]$NoBrowser,
    [switch]$StopOnly
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$AppUrl   = 'http://localhost:3000'
$LogDir   = Join-Path $PSScriptRoot 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

$Host.UI.RawUI.WindowTitle = 'swellbook'

function Write-Step($m)  { Write-Host ("  -> " + $m) -ForegroundColor Cyan }
function Write-Ok($m)    { Write-Host ("  OK " + $m) -ForegroundColor Green }
function Write-Warn2($m) { Write-Host ("  !! " + $m) -ForegroundColor Yellow }
function Write-Banner($m, $c) {
    Write-Host ''
    Write-Host ('  ' + ('=' * ($m.Length + 4))) -ForegroundColor $c
    Write-Host ('    ' + $m) -ForegroundColor $c
    Write-Host ('  ' + ('=' * ($m.Length + 4))) -ForegroundColor $c
    Write-Host ''
}

function Test-Http($url) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        return ($r.StatusCode -eq 200)
    } catch { return $false }
}

function Wait-Http($url, $timeoutSec, $name) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        if (Test-Http $url) { return [Math]::Round($sw.Elapsed.TotalSeconds, 0) }
        Start-Sleep -Milliseconds 500
    }
    throw ("{0} did not answer within {1}s (see demo\logs\server.log)" -f $name, $timeoutSec)
}

function Stop-AppServer {
    $procIds = @()
    try {
        $procIds = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop |
            Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique
    } catch { }
    foreach ($procId in $procIds) {
        try { Stop-Process -Id $procId -Force -ErrorAction Stop } catch { }
    }
    return $procIds.Count
}

function Start-DockerEngine {
    cmd /c "docker ps >nul 2>&1"
    if ($LASTEXITCODE -eq 0) { return }
    Write-Step 'Docker engine is asleep, waking it up...'
    Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe' | Out-Null
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt 120) {
        cmd /c "docker ps >nul 2>&1"
        if ($LASTEXITCODE -eq 0) {
            Write-Ok ("Docker engine up in {0:n0}s" -f $sw.Elapsed.TotalSeconds)
            return
        }
        Start-Sleep -Seconds 2
    }
    throw 'Docker engine did not come up within 120s. Open Docker Desktop once, then rerun.'
}

function Wait-Postgres($timeoutSec) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        cmd /c "docker exec swellbook-db pg_isready -U swellbook -d swellbook >nul 2>&1"
        if ($LASTEXITCODE -eq 0) { return [Math]::Round($sw.Elapsed.TotalSeconds, 0) }
        Start-Sleep -Milliseconds 500
    }
    throw "Postgres did not become ready within ${timeoutSec}s"
}

try {
    $bootSw = [Diagnostics.Stopwatch]::StartNew()
    Write-Banner 'SWELLBOOK DEMO LAUNCHER' Cyan

    if ($StopOnly) {
        $n = Stop-AppServer
        if ($n -gt 0) { Write-Ok 'server stopped' } else { Write-Ok 'nothing was running on port 3000' }
        exit 0
    }

    Set-Location $RepoRoot

    # Fast-attach: everything already healthy and no reset requested.
    if (-not $Reset -and -not $Build -and (Test-Http $AppUrl)) {
        Write-Ok 'stack already healthy, attaching'
    }
    else {
        $killed = Stop-AppServer
        if ($killed -gt 0) { Write-Ok ("{0} stale server process(es) removed" -f $killed) }

        Start-DockerEngine

        if ($Reset) {
            Write-Step 'RESET: wiping the local database...'
            cmd /c "docker compose down -v 2>&1" | Out-Null
            Write-Ok 'database volume removed'
        }

        Write-Step 'starting Postgres container...'
        cmd /c "docker compose up -d 2>&1" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed' }
        $t = Wait-Postgres 90
        Write-Ok ("Postgres ready in {0}s" -f $t)

        Write-Step 'applying migrations and seed (13 listings, 0 bookings)...'
        cmd /c "pnpm exec tsx scripts/migrate.ts --seed"
        if ($LASTEXITCODE -ne 0) { throw 'migration or seed failed' }
        Write-Ok 'database ready'

        if ($Build -or -not (Test-Path (Join-Path $RepoRoot '.next\BUILD_ID'))) {
            Write-Step 'building the production bundle (about a minute, once)...'
            cmd /c "pnpm build"
            if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }
            Write-Ok 'build complete'
        }

        Write-Step 'starting the server...'
        $log = Join-Path $LogDir 'server.log'
        Start-Process -FilePath 'cmd' -ArgumentList '/c', "pnpm start > `"$log`" 2>&1" `
            -WorkingDirectory $RepoRoot -WindowStyle Hidden | Out-Null
        $t = Wait-Http $AppUrl 60 'swellbook'
        Write-Ok ("server up in {0}s" -f $t)
    }

    if (-not $NoBrowser) {
        Write-Step 'opening browser (home + host side)...'
        Start-Process $AppUrl
        Start-Sleep -Milliseconds 600
        Start-Process ($AppUrl + '/host')
    }

    Write-Banner ("READY IN {0:n0}s  ->  http://localhost:3000" -f $bootSw.Elapsed.TotalSeconds) Green
    Write-Host '  For the Loom:' -ForegroundColor Gray
    Write-Host '    1. Two tabs are open: the traveler side and the host side.' -ForegroundColor Gray
    Write-Host '    2. demo\race.cmd   runs the 25-way race in its own window.' -ForegroundColor Gray
    Write-Host '    3. demo\reset.cmd  gives you a pristine database between takes.' -ForegroundColor Gray
    Write-Host ''
}
catch {
    Write-Banner 'LAUNCH FAILED' Red
    Write-Host ('  ' + $_.Exception.Message) -ForegroundColor Red
    $log = Join-Path $LogDir 'server.log'
    if (Test-Path $log) {
        Write-Host '  --- last lines of demo\logs\server.log ---' -ForegroundColor DarkGray
        Get-Content $log -Tail 12 | ForEach-Object { Write-Host ('  ' + $_) -ForegroundColor DarkGray }
    }
    Read-Host 'Press Enter to close'
    exit 1
}
