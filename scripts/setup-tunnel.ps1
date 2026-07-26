# Provision a remotely-managed Cloudflare Tunnel for the orchestrator (DoD #7).
#
#   $env:CF_API_TOKEN = "<40-char API token>"
#   .\scripts\setup-tunnel.ps1 -Hostname bench.example.com -AccessEmail you@example.com
#
# Required token scopes:
#   Account -> Cloudflare Tunnel: Write, Access: Apps and Policies: Write
#   Zone    -> Zone: Read, DNS: Write   (on the zone that owns -Hostname)
#
# Idempotent: reuses an existing tunnel of the same name, updates an existing
# DNS record, and skips Access setup if the application already exists.
# Writes the tunnel token into .env (gitignored) and never echoes it.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Hostname,
    [string]$AccessEmail,
    [string]$TunnelName = "spring-bench",
    [string]$Service = "http://orchestrator:3000",
    [string]$Zone,
    [string]$SessionDuration = "24h"
)

$ErrorActionPreference = "Stop"
$Api = "https://api.cloudflare.com/client/v4"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $RepoRoot ".env"

# Prefer .env so the secret never has to be typed into a shell (and into shell history).
$Token = $env:CF_API_TOKEN
if (-not $Token -and (Test-Path $EnvPath)) {
    $line = Get-Content $EnvPath | Where-Object { $_ -match '^CF_API_TOKEN=' } | Select-Object -First 1
    if ($line) {
        $Token = ($line -replace '^CF_API_TOKEN=', '').Trim()
    }
}
if (-not $Token) {
    throw "No API token found. Add CF_API_TOKEN=<token> to .env, or set `$env:CF_API_TOKEN."
}
if (-not $Zone) {
    $parts = $Hostname.Split(".")
    if ($parts.Count -lt 3) {
        throw "Pass -Zone explicitly when -Hostname is the apex (got '$Hostname')"
    }
    $Zone = ($parts[-2, -1]) -join "."
}

$Headers = @{ Authorization = "Bearer $Token" }

function Invoke-Cf {
    param([string]$Method, [string]$Path, $Body)
    $req = @{
        Method  = $Method
        Uri     = "$Api$Path"
        Headers = $Headers
    }
    if ($Body) {
        $req.ContentType = "application/json"
        $req.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }
    try {
        $res = Invoke-RestMethod @req
    } catch {
        # Surface Cloudflare's error body; a bare 403 is usually code 9109 (token IP filter).
        $detail = $null
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $detail = (New-Object System.IO.StreamReader($stream)).ReadToEnd() | ConvertFrom-Json
        } catch {
            # no parseable body
        }
        if ($detail.errors) {
            $first = $detail.errors[0]
            if ($first.code -eq 9109) {
                throw "Token rejected from this machine's IP (Cloudflare code 9109). " +
                      "Add this host to the token's Client IP Address Filtering, or remove the filter. Detail: $($first.message)"
            }
            throw "Cloudflare API $Method $Path failed: [$($first.code)] $($first.message)"
        }
        throw "Cloudflare API $Method $Path failed: $($_.Exception.Message)"
    }
    if (-not $res.success) {
        throw "Cloudflare API $Method $Path failed: $($res.errors | ConvertTo-Json -Compress)"
    }
    return $res.result
}

Write-Host "==> Resolving zone $Zone"
$zones = Invoke-Cf GET "/zones?name=$Zone"
if (-not $zones) {
    throw "Zone '$Zone' not found. Check the token's Zone Resources include it."
}
$ZoneId = $zones[0].id
$AccountId = $zones[0].account.id
Write-Host "    zone=$ZoneId account=$AccountId"

Write-Host "==> Ensuring tunnel '$TunnelName'"
$existing = Invoke-Cf GET "/accounts/$AccountId/cfd_tunnel?name=$TunnelName&is_deleted=false"
if ($existing) {
    $Tunnel = $existing[0]
    Write-Host "    reusing $($Tunnel.id) (connections: $($Tunnel.connections.Count))"
} else {
    $Tunnel = Invoke-Cf POST "/accounts/$AccountId/cfd_tunnel" @{
        name       = $TunnelName
        config_src = "cloudflare"
    }
    Write-Host "    created $($Tunnel.id)"
}

Write-Host "==> Fetching tunnel token"
$TunnelToken = Invoke-Cf GET "/accounts/$AccountId/cfd_tunnel/$($Tunnel.id)/token"

Write-Host "==> Writing TUNNEL_TOKEN to .env"
if (-not (Test-Path $EnvPath)) {
    Copy-Item (Join-Path $RepoRoot ".env.example") $EnvPath
}
$lines = Get-Content $EnvPath
if ($lines -match "^TUNNEL_TOKEN=") {
    $lines = $lines -replace "^TUNNEL_TOKEN=.*", "TUNNEL_TOKEN=$TunnelToken"
} else {
    $lines += "TUNNEL_TOKEN=$TunnelToken"
}
Set-Content -Path $EnvPath -Value $lines -Encoding utf8
Write-Host "    .env updated (value not shown)"

Write-Host "==> Routing $Hostname -> $Service"
Invoke-Cf PUT "/accounts/$AccountId/cfd_tunnel/$($Tunnel.id)/configurations" @{
    config = @{
        ingress = @(
            @{ hostname = $Hostname; service = $Service },
            @{ service = "http_status:404" }
        )
    }
} | Out-Null

$Target = "$($Tunnel.id).cfargotunnel.com"
$record = Invoke-Cf GET "/zones/$ZoneId/dns_records?name=$Hostname"
if ($record) {
    Invoke-Cf PATCH "/zones/$ZoneId/dns_records/$($record[0].id)" @{
        type    = "CNAME"
        name    = $Hostname
        content = $Target
        proxied = $true
    } | Out-Null
    Write-Host "    updated existing CNAME -> $Target"
} else {
    Invoke-Cf POST "/zones/$ZoneId/dns_records" @{
        type    = "CNAME"
        name    = $Hostname
        content = $Target
        proxied = $true
    } | Out-Null
    Write-Host "    created CNAME -> $Target"
}

if ($AccessEmail) {
    Write-Host "==> Ensuring Access application for $Hostname"
    $apps = Invoke-Cf GET "/accounts/$AccountId/access/apps"
    $app = $apps | Where-Object { $_.domain -eq $Hostname } | Select-Object -First 1
    if (-not $app) {
        $app = Invoke-Cf POST "/accounts/$AccountId/access/apps" @{
            name             = "Spring Bench orchestrator"
            domain           = $Hostname
            type             = "self_hosted"
            session_duration = $SessionDuration
        }
        Write-Host "    created app $($app.id)"
    } else {
        Write-Host "    reusing app $($app.id)"
    }

    $policies = Invoke-Cf GET "/accounts/$AccountId/access/apps/$($app.id)/policies"
    if (-not $policies) {
        Invoke-Cf POST "/accounts/$AccountId/access/apps/$($app.id)/policies" @{
            name       = "Owner only"
            decision   = "allow"
            precedence = 1
            include    = @(@{ email = @{ email = $AccessEmail } })
        } | Out-Null
        Write-Host "    policy allows $AccessEmail only"
    } else {
        Write-Host "    policy already present ($($policies.Count)) - left alone"
    }
} else {
    Write-Warning "No -AccessEmail given: hostname will be PUBLIC. The orchestrator can start/stop containers."
}

Write-Host ""
Write-Host "Done. Next:"
Write-Host "  docker compose --profile tunnel up -d"
Write-Host "  docker logs cloudflared --tail 20"
Write-Host "  https://$Hostname"
