# Cloudflare Tunnel

Expose the orchestrator (and dashboard) without opening inbound router ports.

1. Create a tunnel in the Cloudflare Zero Trust dashboard.
2. Copy the tunnel token into an untracked `.env` file at the repo root:

   ```
   TUNNEL_TOKEN=your-token-here
   ```

3. Start with the tunnel profile:

   ```bash
   docker compose --profile tunnel up -d
   ```

4. Route your public hostname to `http://orchestrator:3000` in the Cloudflare dashboard.
5. Layer **Cloudflare Access** on the hostname — the orchestrator controls Docker via the socket.
