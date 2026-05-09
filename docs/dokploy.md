# Dokploy Deployment Guide — jcsoftdev

## VPS Provisioning Checklist

- [ ] Create VPS — minimum 2 vCPU, 4 GB RAM, 50 GB SSD (8 GB RAM recommended for Plausible + ClickHouse)
- [ ] OS: Ubuntu 24.04 LTS
- [ ] SSH access with public key only (disable password auth)
- [ ] Enable UFW: allow 22 (SSH), 80 (HTTP→redirect), 443 (HTTPS), 8080 (Dokploy UI) — block everything else
- [ ] Point DNS A records to VPS IP (see Cloudflare section below)

## Dokploy Install

```bash
# Run on VPS as root
curl -sSL https://dokploy.com/install.sh | bash
```

Dokploy starts on port 3000 by default (or 8080 — check docs for current version). Access `http://<VPS-IP>:8080` to complete setup. Create admin account.

## Service Definitions

Each app is a separate Dokploy "Application" service (Dockerfile build).

### apps/api — Hono API

| Field | Value |
|---|---|
| Build type | Dockerfile |
| Docker context path | `.` (repo root) |
| Dockerfile path | `apps/api/Dockerfile` |
| Published port | 3000 |
| Domain | `api.jcsoftdev.com` |
| HTTPS | Enabled (Traefik auto cert via Cloudflare Origin) |

**Required env vars** (set in Dokploy → Application → Environment):
```
DATABASE_URL=postgresql://jcsoftdev:<password>@pgbouncer:6432/jcsoftdev
DATABASE_DIRECT_URL=postgresql://jcsoftdev:<password>@postgres:5432/jcsoftdev
VALKEY_URL=redis://valkey:6379
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=<key>
MINIO_SECRET_KEY=<secret>
MINIO_BUCKET=jcsoftdev-media
PORT=3000
NODE_ENV=production
BETTER_AUTH_SECRET=<generated>
BETTER_AUTH_URL=https://api.jcsoftdev.com
RESEND_API_KEY=<key>
```

---

### apps/web — Astro SSR

| Field | Value |
|---|---|
| Build type | Dockerfile |
| Docker context path | `.` (repo root) |
| Dockerfile path | `apps/web/Dockerfile` |
| Published port | 4321 |
| Domain | `jcsoftdev.com` |
| HTTPS | Enabled |

**Required env vars**:
```
PUBLIC_API_URL=https://api.jcsoftdev.com
PUBLIC_PLAUSIBLE_HOST=https://analytics.jcsoftdev.com
PLAUSIBLE_DOMAIN=jcsoftdev.com
PORT=4321
NODE_ENV=production
```

---

### apps/admin — React SPA

| Field | Value |
|---|---|
| Build type | Dockerfile |
| Docker context path | `.` (repo root) |
| Dockerfile path | `apps/admin/Dockerfile` |
| Published port | 80 |
| Domain | `admin.jcsoftdev.com` |
| HTTPS | Enabled |

**Required env vars** (available at build time via Vite):
```
VITE_API_URL=https://api.jcsoftdev.com
NODE_ENV=production
```

> Note: Vite replaces `import.meta.env.VITE_*` at build time. Set these in Dokploy before triggering a build.

---

### Infrastructure Services

Deploy Postgres, pgBouncer, Valkey, MinIO, and Plausible as Dokploy "Compose" or individual "Database" services.

**Recommended**: Create a `docker-compose.prod.yml` (not committed — generated from `docker-compose.yml` with production env overrides) and import it into Dokploy as a Compose service.

---

## Cloudflare DNS Configuration

### DNS Records

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `jcsoftdev.com` | `<VPS IP>` | Proxied (orange cloud) |
| A | `api.jcsoftdev.com` | `<VPS IP>` | Proxied |
| A | `admin.jcsoftdev.com` | `<VPS IP>` | Proxied |
| A | `analytics.jcsoftdev.com` | `<VPS IP>` | Proxied |

### SSL/TLS Settings (Cloudflare Dashboard → SSL/TLS)

1. Set mode to **Full (strict)** — requires a valid cert on the origin.
2. Issue a **Cloudflare Origin Certificate** (15-year) from SSL/TLS → Origin Server.
3. Install the origin cert on Traefik (via Dokploy → Traefik → Certificates or as a Docker secret).

### Recommended Page Rules / Cache Rules

- `jcsoftdev.com/blog/*` — Cache Level: Standard, Edge Cache TTL: 4 hours
- `jcsoftdev.com/_astro/*` — Cache Level: Cache Everything, Edge Cache TTL: 1 month (content-hashed filenames)
- `api.jcsoftdev.com/*` — Cache Level: Bypass (API responses should not be Cloudflare-cached)

---

## Cloudflare Cache Purge on Deploy

Set up an automatic cache purge whenever the web app redeploys:

1. In Cloudflare, create an **API Token** with `Cache Purge` permission for `jcsoftdev.com`.
2. In Dokploy, add a **Deploy Hook** (post-deploy) for `apps/web` that calls:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <CF_API_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything": true}'
```

For granular purges (only blog posts), use `{ "files": ["https://jcsoftdev.com/blog/*"] }` instead.

---

## Backup Strategy

### Postgres Dump (cron)

```bash
# Run daily at 2am, keep 7 days
0 2 * * * pg_dump -U jcsoftdev jcsoftdev | gzip > /backups/jcsoftdev-$(date +\%Y\%m\%d).sql.gz
find /backups -name "*.sql.gz" -mtime +7 -delete
```

Upload to MinIO or an off-site S3 bucket for redundancy.

### MinIO Mirror

```bash
# Mirror MinIO production bucket to S3 (e.g., Backblaze B2)
mc mirror minio/jcsoftdev-media b2/jcsoftdev-media-backup
```

Set up as a cron or use MinIO's built-in bucket replication.

---

## Traefik Labels Reference

Add these labels to each app's Dokploy service configuration (or in `docker-compose.prod.yml`):

```yaml
# apps/web
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.web.rule=Host(`jcsoftdev.com`)"
  - "traefik.http.routers.web.tls=true"
  - "traefik.http.services.web.loadbalancer.server.port=4321"

# apps/api
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.api.rule=Host(`api.jcsoftdev.com`)"
  - "traefik.http.routers.api.tls=true"
  - "traefik.http.services.api.loadbalancer.server.port=3000"

# apps/admin
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.admin.rule=Host(`admin.jcsoftdev.com`)"
  - "traefik.http.routers.admin.tls=true"
  - "traefik.http.services.admin.loadbalancer.server.port=80"
```
