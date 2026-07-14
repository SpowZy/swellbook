# One-shot Swellbook demo launcher (Windows). ONE window does everything:
# it boots the stack, opens the browser, then stays as a tiny console where
# single keys drive the whole demo (race, reset, reopen tabs).
#
#   demo\start.cmd     the only command you need
#   demo\reset.cmd     same, but wipes the database first
#   demo\stop.cmd      stops the app server
#   demo\race.cmd      the race in its own window (optional, console has it too)
#   -Build             force a rebuild of the production bundle
#   -NoBrowser         do not open browser tabs
#   -NoConsole         exit after boot instead of showing the console

param(
    [switch]$Reset,
    [switch]$Build,
    [switch]$NoBrowser,
    [switch]$NoConsole,
    [switch]$StopOnly
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$AppUrl   = 'http://localhost:3000'
$LogDir   = Join-Path $PSScriptRoot 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

$Host.UI.RawUI.WindowTitle = 'swellbook demo'

function Write-Step($m)  { Write-Host ("  -> " + $m) -ForegroundColor Cyan }
function Write-Ok($m)    { Write-Host ("  OK " + $m) -ForegroundColor Green }
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

function Invoke-DbReady {
    Write-Step 'applying migrations and seed (13 listings, 0 bookings)...'
    cmd /c "pnpm exec tsx scripts/migrate.ts --seed"
    if ($LASTEXITCODE -ne 0) { throw 'migration or seed failed' }
    Write-Ok 'database ready'
}

function Start-AppServer {
    Write-Step 'starting the server...'
    $log = Join-Path $LogDir 'server.log'
    Start-Process -FilePath 'cmd' -ArgumentList '/c', "pnpm start > `"$log`" 2>&1" `
        -WorkingDirectory $RepoRoot -WindowStyle Hidden | Out-Null
    $t = Wait-Http $AppUrl 60 'swellbook'
    Write-Ok ("server up in {0}s" -f $t)
}

function Open-Tabs {
    Write-Step 'opening browser (traveler side + host side)...'
    Start-Process $AppUrl
    Start-Sleep -Milliseconds 600
    Start-Process ($AppUrl + '/host')
}

function Invoke-FullReset {
    Write-Step 'RESET: wiping the local database...'
    Stop-AppServer | Out-Null
    cmd /c "docker compose down -v 2>&1" | Out-Null
    Write-Ok 'database volume removed'
    cmd /c "docker compose up -d 2>&1" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed' }
    $t = Wait-Postgres 90
    Write-Ok ("Postgres ready in {0}s" -f $t)
    Invoke-DbReady
    Start-AppServer
}

function Show-Console {
    Write-Host '  ONE window, single keys:' -ForegroundColor Gray
    Write-Host '    [C] run the race on camera: 25 attempts, 1 winner' -ForegroundColor Gray
    Write-Host '    [R] reset: pristine database between takes, tabs reopen' -ForegroundColor Gray
    Write-Host '    [O] reopen the two browser tabs' -ForegroundColor Gray
    Write-Host '    [Q] quit this console (the site keeps running)' -ForegroundColor Gray
    Write-Host ''
    while ($true) {
        Write-Host -NoNewline '  swellbook> press C / R / O / Q ' -ForegroundColor Cyan
        $key = [Console]::ReadKey($true)
        Write-Host $key.KeyChar
        switch -Regex ($key.KeyChar.ToString().ToUpper()) {
            'C' {
                Write-Host ''
                cmd /c "pnpm race"
                Write-Host ''
            }
            'R' {
                Invoke-FullReset
                Open-Tabs
                Write-Ok 'pristine and ready for the next take'
                Write-Host ''
            }
            'O' { Open-Tabs; Write-Host '' }
            'Q' {
                Write-Ok 'console closed, the site is still running (demo\stop.cmd to stop it)'
                return
            }
        }
    }
}

try {
    $bootSw = [Diagnostics.Stopwatch]::StartNew()
    Write-Banner 'SWELLBOOK DEMO' Cyan

    if ($StopOnly) {
        $n = Stop-AppServer
        if ($n -gt 0) { Write-Ok 'server stopped' } else { Write-Ok 'nothing was running on port 3000' }
        exit 0
    }

    Set-Location $RepoRoot

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

        Invoke-DbReady

        if ($Build -or -not (Test-Path (Join-Path $RepoRoot '.next\BUILD_ID'))) {
            Write-Step 'building the production bundle (about a minute, once)...'
            cmd /c "pnpm build"
            if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }
            Write-Ok 'build complete'
        }

        Start-AppServer
    }

    if (-not $NoBrowser) { Open-Tabs }

    Write-Banner ("READY IN {0:n0}s  ->  http://localhost:3000" -f $bootSw.Elapsed.TotalSeconds) Green

    if (-not $NoConsole) { Show-Console }
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
