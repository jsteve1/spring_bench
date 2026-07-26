# Cloudflare Tunnel

Expose the orchestrator API and dashboard without opening inbound router ports.

**Prerequisite:** a domain whose DNS is on Cloudflare (free plan is fine). Publishing a hostname is
not possible without one. Quick Tunnels (`trycloudflare.com`) need no domain but **do not support
Server-Sent Events** and cap at 200 concurrent requests, so they cannot exercise `/events`.

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
