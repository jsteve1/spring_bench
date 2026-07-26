# Sequential benchmark sweep across matrix rows (docs/09 methodology).
#
#   .\scripts\run-benchmarks.ps1
#   .\scripts\run-benchmarks.ps1 -Reps 3 -Targets java21-virtual-low,java21-platform-low
#
# One target runs at a time so the JVM under test is not competing with another
# JVM for host CPU. Each target gets a discarded warmup run before the measured
# reps (JIT + page cache). Writes scripts/bench-manifest.json for analysis.

[CmdletBinding()]
param(
    [string[]]$Targets = @(
        "java8-platform-low",
        "java11-platform-low",
        "java17-platform-mid",
        "java21-platform-low",
        "java21-virtual-low"
    ),
    [string[]]$SseTargets = @(
        "java8-platform-low",
        "java11-platform-low",
        "java21-platform-low",
        "java21-virtual-low"
    ),
    [int]$Reps = 3,
    [int]$SseReps = 2,
    [int]$Vus = 10,
    [string]$Duration = "30s",
    [string]$RampStages = "0:5s,full:20s,0:5s",
    [int]$SseVus = 12,
    [string]$SseDuration = "20s",
    [string]$Orchestrator = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Compose = @("-f", "docker-compose.yml", "-f", "docker-compose.extra.yml")
$manifest = [System.Collections.Generic.List[object]]::new()
$manifestPath = Join-Path $PSScriptRoot "bench-manifest.json"

# The orchestrator requires Basic auth when ORCH_BASIC_* are set (see basicAuth.js).
$Auth = @{}
$envFile = Join-Path $Root ".env"
if (Test-Path $envFile) {
    $envLines = Get-Content $envFile
    $u = (($envLines | Where-Object { $_ -match '^ORCH_BASIC_USER=' }) -replace '^ORCH_BASIC_USER=', '').Trim()
    $p = (($envLines | Where-Object { $_ -match '^ORCH_BASIC_PASS=' }) -replace '^ORCH_BASIC_PASS=', '').Trim()
    if ($u -and $p) {
        $pair = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${u}:${p}"))
        $Auth = @{ Authorization = "Basic $pair" }
    }
}

function Save-Manifest {
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding utf8
}

# docker compose writes progress to stderr, which ErrorActionPreference=Stop
# treats as terminating; gate on the exit code instead.
function Invoke-Compose {
    param([string[]]$Arguments)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker compose @Compose @Arguments 2>&1 | Out-Null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    if ($code -ne 0) {
        throw "docker compose $($Arguments -join ' ') failed (exit $code)"
    }
}

function Get-HostPort($name) {
    $t = Invoke-RestMethod "$Orchestrator/api/targets" -Headers $Auth
    ($t | Where-Object { $_.name -eq $name }).port
}

function Wait-Healthy($name, $timeoutSec = 180) {
    $port = Get-HostPort $name
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $h = Invoke-RestMethod "http://localhost:$port/health" -TimeoutSec 4
            return $h
        } catch {
            Start-Sleep 3
        }
    }
    throw "$name did not become healthy within ${timeoutSec}s"
}

function Invoke-Run($target, $mode, $label) {
    $body = if ($mode -eq "sse") {
        @{ mode = "sse"; targetName = $target; vus = $SseVus; duration = $SseDuration; dropRate = 0.1 }
    } else {
        @{ mode = "rest"; targetName = $target; vus = $Vus; duration = $Duration; rampStages = $RampStages }
    }
    $run = Invoke-RestMethod -Method POST -Uri "$Orchestrator/api/loadtest" -Headers $Auth `
        -ContentType application/json -Body ($body | ConvertTo-Json -Compress)

    $deadline = (Get-Date).AddMinutes(10)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep 5
        $r = Invoke-RestMethod "$Orchestrator/api/runs/$($run.runId)" -Headers $Auth
        if ($r.status -ne "running") { break }
    }
    Write-Host ("    {0,-8} {1,-9} {2}" -f $mode, $label, $r.status)
    return $r
}

Write-Host "Benchmark sweep: $($Targets.Count) REST targets x $Reps reps, $($SseTargets.Count) SSE targets x $SseReps reps"
Write-Host "Load generator shares this host; footprints kept modest so it is not the bottleneck.`n"

$all = $Targets + ($SseTargets | Where-Object { $Targets -notcontains $_ }) | Select-Object -Unique

foreach ($target in $all) {
    Write-Host "=== $target ==="
    Invoke-Compose @("up", "-d", $target)
    $health = Wait-Healthy $target
    Write-Host ("    java=$($health.javaVersion) boot=$($health.springBoot) virtual=$($health.virtualThreadsEnabled) maxHeap=$($health.maxHeapMb)MB")

    # Warmup: discarded. Lets the JIT compile hot paths and warms the page cache.
    if ($Targets -contains $target) {
        Invoke-Run $target "rest" "warmup" | Out-Null
    }

    if ($Targets -contains $target) {
        for ($i = 1; $i -le $Reps; $i++) {
            $r = Invoke-Run $target "rest" "rep$i"
            $manifest.Add(@{
                target = $target; mode = "rest"; rep = $i; runId = $r.runId
                status = $r.status; health = $health
            })
            Save-Manifest
        }
    }

    if ($SseTargets -contains $target) {
        for ($i = 1; $i -le $SseReps; $i++) {
            $r = Invoke-Run $target "sse" "rep$i"
            $manifest.Add(@{
                target = $target; mode = "sse"; rep = $i; runId = $r.runId
                status = $r.status; health = $health
            })
            Save-Manifest
        }
    }

    # Stop so the next target starts from a clean, uncontended host.
    Invoke-Compose @("stop", $target)
    Write-Host "    stopped`n"
}

Write-Host "Manifest: $manifestPath ($($manifest.Count) measured runs)"

