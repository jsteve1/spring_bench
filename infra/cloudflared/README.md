# Cloudflare Tunnel

Expose the orchestrator API and dashboard without opening inbound router ports.

**Prerequisite:** a domain whose DNS is on Cloudflare (free plan is fine). Publishing a hostname is
not possible without one. Quick Tunnels (`trycloudflare.com`) need no domain but **do not support
Server-Sent Events** and cap at 200 concurrent requests, so they cannot exercise `/events`.

## Automated path

`scripts/setup-tunnel.ps1` does steps 1–6 below in one run — creates the tunnel, writes its token to
`.env`, sets the ingress rule, creates the proxied CNAME, and adds an Access policy:

```powershell
# .env: CF_API_TOKEN=<api token>
.\scripts\setup-tunnel.ps1 -Hostname bench.example.com -AccessEmail you@example.com
```

The API token needs four permission groups, and the **level matters** — `Read` where `Edit` is
required fails with a bodiless `403` that names no permission:

| Scope | Permission | Level |
| :-- | :-- | :-- |
| Account | Cloudflare Tunnel | Edit |
| Account | Access: Apps and Policies | Edit |
| Zone | Zone | Read |
| Zone | DNS | Edit |

Beware three traps in the token editor: several unrelated permissions contain the word "DNS"
(`Zone DNS Settings`, `Account DNS Settings`, `DNS View`, `DNS Firewall`) and only plain **DNS**
governs records; the summary screen lists permission names without their scope or level; and
**Client IP Address Filtering** rejects requests with code `9109`, reporting an IPv6 address whose
suffix rotates, so allow-list the `/64` rather than the `/128`.

Omit `-AccessEmail` to provision the plumbing without publishing an unauthenticated endpoint — the
hostname returns `530` until the connector starts, which is a safe place to pause.

## Manual path

1. `dash.cloudflare.com` → **Zero Trust** → **Networks → Connectors** (older UIs and some docs call
   this **Networking → Tunnels**) → **Create a tunnel** → **Cloudflared** → name it.
2. On the install step choose **Docker** and copy the command into a text editor — **do not run it**;
   this compose file already runs `cloudflared`. You only need the `eyJ...` token from the end.
   To retrieve it later: select the tunnel → **Overview** → **Add a replica**.
3. Put the token in an untracked `.env` at the repo root (gitignored; treat it like a password):

   ```
   TUNNEL_TOKEN=eyJhIjoi...
   ```

4. Start with the tunnel profile:

   ```bash
   docker compose --profile tunnel up -d
   docker logs cloudflared --tail 20   # expect a registered connection
   ```

5. In the tunnel's **Routes** tab, add a **Published application**: pick your subdomain + domain and
   set the service to `http://orchestrator:3000`. Use the container name, **not** `localhost` —
   `cloudflared` runs on the `matrix-net` network here, not in host mode, unlike most guides online.
6. Layer **Cloudflare Access** on the hostname before sharing it. The orchestrator controls Docker
   through the mounted socket, so an unauthenticated hostname lets anyone start/stop your containers
   and launch load tests.

Also see root `.env.example` and `docs/05-infrastructure-and-orchestration.md`.
