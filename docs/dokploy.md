# Guía de Deploy — jcsoftdev en Dokploy

Runbook end-to-end para deployar el monorepo (`apps/api`, `apps/web`, `apps/admin`) más infraestructura (Postgres, pgBouncer, Valkey, MinIO, Plausible) en un VPS con Dokploy. Incluye automation de migraciones via pre-deploy hook.

---

## 0. Pre-requisitos

- VPS Ubuntu 24.04 LTS, mínimo **2 vCPU / 4 GB RAM / 50 GB SSD** (8 GB RAM recomendado por Plausible + ClickHouse).
- Acceso SSH con llave pública (password auth deshabilitado).
- Dominio `jcsoftdev.com` con DNS gestionado en Cloudflare.
- UFW abierto: `22` (SSH), `80` (redirect HTTPS), `443` (HTTPS), `8080` (Dokploy UI). Resto bloqueado.

### Instalar Dokploy

```bash
ssh root@<VPS_IP>
curl -sSL https://dokploy.com/install.sh | bash
```

Espera ~2 min. Accede a `http://<VPS_IP>:8080`, crea cuenta admin.

Crea el network compartido si no existe:

```bash
docker network create dokploy-network 2>/dev/null || true
```

---

## 1. Generar secretos de producción

Localmente, corre:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "PLAUSIBLE_DB_PASSWORD=$(openssl rand -base64 32)"
echo "MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)"
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 48)"
echo "PLAUSIBLE_SECRET_KEY_BASE=$(openssl rand -base64 64)"
```

Guarda los 5 valores en un password manager. Los vas a usar en varios lugares — deben coincidir exacto.

---

## 2. DNS en Cloudflare

### Records

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `<VPS_IP>` | DNS only* |
| A | `www` | `<VPS_IP>` | DNS only* |
| A | `api` | `<VPS_IP>` | DNS only* |
| A | `admin` | `<VPS_IP>` | DNS only* |
| A | `analytics` | `<VPS_IP>` | DNS only* |
| A | `minio` | `<VPS_IP>` | DNS only* |

> ⚠️ **Crítico**: deja todos en **DNS only (gris)** hasta que Let's Encrypt emita certs. El challenge HTTP-01 falla detrás del proxy de Cloudflare. Después de que cada cert se emita, los flipeas a **Proxied (naranja)**.

### SSL/TLS (después de certs emitidos)

1. SSL/TLS → Overview → **Full (strict)**.
2. SSL/TLS → Origin Server → **Create Certificate** (15 años) — opcional, solo si quieres cert Cloudflare en el origin. Con Let's Encrypt en Traefik ya estás cubierto.

### Cache Rules (opcional, optimización)

| Path | Behavior |
|---|---|
| `jcsoftdev.com/blog/*` | Cache Standard, Edge TTL 4h |
| `jcsoftdev.com/_astro/*` | Cache Everything, Edge TTL 1 mes |
| `api.jcsoftdev.com/*` | Bypass |

---

## 3. Infra Compose service

### 3.1 Crear servicio en Dokploy

**Project `jcsoftdev` → Create Service → Compose**

| Campo | Valor |
|---|---|
| Name | `jcsoftdev-infra` |
| Source Type | Git |
| Repository | `<tu-repo>` |
| Branch | `main` |
| Compose Path | `docker-compose.prod.yml` |
| Compose Type | docker-compose |

### 3.2 Environment

Pega en el tab **Environment**:

```
DOMAIN=jcsoftdev.com
POSTGRES_DB=jcsoftdev
POSTGRES_USER=jcsoftdev
POSTGRES_PASSWORD=<paso 1>
MINIO_ROOT_USER=jcsoftdev_admin
MINIO_ROOT_PASSWORD=<paso 1>
PLAUSIBLE_DB_NAME=plausible_db
PLAUSIBLE_DB_USER=plausible
PLAUSIBLE_DB_PASSWORD=<paso 1>
PLAUSIBLE_SECRET_KEY_BASE=<paso 1>
```

### 3.3 Deploy

Click **Deploy**. Espera ~3 min.

### 3.4 Verifica

En el tab **Logs**, deben quedar 7 containers healthy:

- `postgres` ✅
- `pgbouncer` ✅
- `valkey` ✅
- `minio` ✅
- `plausible-db` ✅
- `plausible-events-db` ✅
- `plausible` ✅

Si alguno falla → revisa logs del container específico.

### 3.5 Bootstrap del bucket MinIO (una vez)

SSH al VPS:

```bash
docker exec -i $(docker ps -qf name=minio) sh -c '
  mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD &&
  mc mb local/jcsoftdev-media &&
  mc anonymous set download local/jcsoftdev-media
'
```

Crea el bucket y lo expone como público read-only.

---

## 4. apps/api — Hono API (con migrator automático)

### 4.1 Push commit con el migrator

Asegúrate que el commit con `packages/db/Dockerfile` y el servicio `migrator` en `docker-compose.prod.yml` esté en el remote:

```bash
git push origin main
```

### 4.2 Crear Application

**Project `jcsoftdev` → Create Service → Application**

| Tab | Campo | Valor |
|---|---|---|
| General | Name | `api` |
| Source | Provider | Git |
| Source | Repository | `<tu-repo>` |
| Source | Branch | `main` |
| Build | Build Type | Dockerfile |
| Build | Dockerfile Path | `apps/api/Dockerfile` |
| Build | Build Context | `.` |

### 4.3 Environment

```
NODE_ENV=production
PORT=3000
POSTGRES_USER=jcsoftdev
POSTGRES_PASSWORD=<paso 1, mismo del Compose>
DATABASE_URL=postgresql://jcsoftdev:<password>@pgbouncer:5432/jcsoftdev
DATABASE_DIRECT_URL=postgresql://jcsoftdev:<password>@postgres:5432/jcsoftdev
VALKEY_URL=redis://valkey:6379
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=jcsoftdev_admin
MINIO_SECRET_KEY=<MINIO_ROOT_PASSWORD del Compose>
MINIO_BUCKET_MEDIA=jcsoftdev-media
CORS_ORIGINS=https://jcsoftdev.com,https://admin.jcsoftdev.com
BETTER_AUTH_SECRET=<paso 1>
BETTER_AUTH_URL=https://api.jcsoftdev.com
RESEND_API_KEY=<tu key real de Resend>
RESEND_FROM_EMAIL=noreply@jcsoftdev.com
```

> Las passwords deben coincidir EXACTO con las del Compose infra. Si difieren, el migrator y el api van a fallar con auth error.

### 4.4 Domain

| Campo | Valor |
|---|---|
| Host | `api.jcsoftdev.com` |
| Container Port | `3000` |
| HTTPS | ON |
| Cert Provider | `letsencrypt` |

### 4.5 Network

**Advanced → Network** → agrega `dokploy-network`. Sin esto el api no resuelve `pgbouncer`/`valkey`/`minio`.

### 4.6 Pre Deploy Command (la magia)

**Advanced → Pre Deploy**:

```bash
docker build -t jcsoftdev-migrator:latest -f packages/db/Dockerfile . \
  && docker run --rm \
     --network dokploy-network \
     -e DATABASE_DIRECT_URL="postgres://jcsoftdev:${POSTGRES_PASSWORD}@postgres:5432/jcsoftdev" \
     jcsoftdev-migrator:latest
```

**Qué hace en cada deploy**:

1. Buildea el container migrator (Node + tsx + drizzle).
2. Lo corre contra `postgres:5432` directo.
3. Aplica migraciones drizzle pendientes (idempotente).
4. Corre el seed (idempotente — `ON CONFLICT DO NOTHING`).
5. Si exit 0 → procede al build del api. Si exit ≠ 0 → aborta deploy, api viejo sigue corriendo.

### 4.7 Deploy

Click **Deploy**. Logs esperados:

```
[Pre-Deploy]
> docker build ...
> docker run ...
> Migrations completed successfully.
> Seed completed successfully.

[Build]
> apps/api/Dockerfile multi-stage (Bun compile, distroless runtime)

[Deploy]
> container running on port 3000
```

### 4.8 Verifica

```bash
curl https://api.jcsoftdev.com/health
# {"status":"ok"}

curl https://api.jcsoftdev.com/api/v1/projects
# array con proyectos del seed
```

Si los dos responden → api en prod con migrations automatizadas.

---

## 5. apps/web — Astro SSR

### 5.1 Crear Application

| Tab | Campo | Valor |
|---|---|---|
| General | Name | `web` |
| Source | Repository | `<tu-repo>` |
| Source | Branch | `main` |
| Build | Build Type | Dockerfile |
| Build | Dockerfile Path | `apps/web/Dockerfile` |
| Build | Build Context | `.` |

### 5.2 Environment

```
NODE_ENV=production
PORT=4321
PUBLIC_API_URL=https://api.jcsoftdev.com
PUBLIC_PLAUSIBLE_HOST=https://analytics.jcsoftdev.com
PLAUSIBLE_DOMAIN=jcsoftdev.com
```

### 5.3 Domains

Agrega DOS domains:

| Host | Port | HTTPS |
|---|---|---|
| `jcsoftdev.com` | 4321 | ON |
| `www.jcsoftdev.com` | 4321 | ON |

(El segundo con redirect a apex via Cloudflare Page Rule, opcional.)

### 5.4 Network

Agrega `dokploy-network` (web no llama infra directo, pero lo dejamos por consistencia).

### 5.5 Deploy & verifica

```bash
curl -I https://jcsoftdev.com
# HTTP/2 200
# server: Astro
```

---

## 6. apps/admin — React SPA (Caddy)

### 6.1 Crear Application

| Tab | Campo | Valor |
|---|---|---|
| General | Name | `admin` |
| Source | Repository | `<tu-repo>` |
| Source | Branch | `main` |
| Build | Build Type | Dockerfile |
| Build | Dockerfile Path | `apps/admin/Dockerfile` |
| Build | Build Context | `.` |

### 6.2 Environment (build-time, Vite)

```
NODE_ENV=production
VITE_API_URL=https://api.jcsoftdev.com
```

> Vite reemplaza `import.meta.env.VITE_*` en build time. Si cambias `VITE_API_URL` después, **redeployea** el admin (no basta restart).

### 6.3 Domain

| Campo | Valor |
|---|---|
| Host | `admin.jcsoftdev.com` |
| Container Port | `80` |
| HTTPS | ON |

### 6.4 Deploy & verifica

```bash
curl -I https://admin.jcsoftdev.com
# HTTP/2 200
# server: Caddy
```

Abre `https://admin.jcsoftdev.com` en browser → debe cargar el panel de login.

---

## 7. Flippeo Cloudflare a Proxied

Una vez que los 4 dominios responden 200 con HTTPS:

En Cloudflare DNS → cada A record → toggle a **Proxied (naranja)**.

Verifica que sigan respondiendo:

```bash
curl -I https://jcsoftdev.com
curl -I https://api.jcsoftdev.com
curl -I https://admin.jcsoftdev.com
curl -I https://analytics.jcsoftdev.com
```

Header `cf-ray: ...` confirma que pasa por Cloudflare.

---

## 8. Cache Purge automático en deploy del web

En Cloudflare:

1. **My Profile → API Tokens → Create Token** con permiso `Zone → Cache Purge → Purge`.
2. Copia el token y el `Zone ID` (sidebar derecho del dominio).

En Dokploy → `web` Application → **Advanced → Post Deploy Command**:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Y en Environment del web:

```
CF_ZONE_ID=<zone id>
CF_API_TOKEN=<token>
```

Cada deploy del web → purge automático del cache CF. Para purges granulares (solo blog):

```bash
--data '{"files":["https://jcsoftdev.com/blog/*"]}'
```

---

## 9. Backup strategy

### 9.1 Postgres dump (cron en VPS)

```bash
ssh root@<VPS_IP>
crontab -e
```

Agrega:

```cron
0 2 * * * docker exec $(docker ps -qf name=postgres) pg_dump -U jcsoftdev jcsoftdev | gzip > /backups/jcsoftdev-$(date +\%Y\%m\%d).sql.gz
0 3 * * * find /backups -name "*.sql.gz" -mtime +7 -delete
```

Crea `/backups`:

```bash
mkdir -p /backups
```

### 9.2 Off-site sync (recomendado)

Sube los dumps a un bucket externo (Backblaze B2, S3, Cloudflare R2):

```bash
0 4 * * * rclone sync /backups remote:jcsoftdev-backups
```

Configura `rclone config` una vez con credenciales del bucket externo.

### 9.3 MinIO bucket replication

Si el contenido en MinIO es crítico:

```bash
docker exec -i $(docker ps -qf name=minio) sh -c '
  mc mirror local/jcsoftdev-media b2/jcsoftdev-media-backup
'
```

(Configura el alias `b2` en `mc` primero.)

---

## 10. Workflow de cambios después del setup inicial

### 10.1 Schema change (nueva migración)

```bash
# Local
pnpm --filter @jcsoftdev/db db:generate   # genera SQL nuevo
git add packages/db/migrations/
git commit -m "feat(db): <descripción>"
git push origin main
```

En Dokploy → `api` → **Redeploy**.

Pre-deploy aplica la migración. Si rompe → api viejo sigue corriendo, fix y re-push.

### 10.2 Cambio en api/web/admin

```bash
git push origin main
```

Si tienes auto-deploy webhook activo en Dokploy → deploy automático.
Si no → click **Redeploy** en el service correspondiente.

### 10.3 Rollback

En Dokploy → service → **Deployments** → click en deploy anterior → **Redeploy**.

Para rollback de migración → escribe migración inversa nueva (drizzle no soporta `down` automático en runtime).

---

## 11. Servicios secundarios (Plausible + MinIO console)

### Plausible Analytics

URL: `https://analytics.jcsoftdev.com`

Primera vez:

1. Abre la URL → te pide crear admin user.
2. Crea cuenta.
3. Add site → `jcsoftdev.com`.
4. Copia el snippet → ya está embebido en `apps/web` via `PUBLIC_PLAUSIBLE_HOST`.

> El compose tiene `DISABLE_REGISTRATION=true` después de tu admin user → nadie más puede registrarse. Si necesitas más users, los creas desde el panel.

### MinIO Console

URL: `https://minio.jcsoftdev.com`

Login con `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`.

Aquí ves uploads, configuras lifecycle rules, replication, etc.

---

## 12. Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| Pre-deploy `Migrations failed: connection refused` | `dokploy-network` no agregado al api | Add network en Advanced |
| Pre-deploy `password authentication failed` | `POSTGRES_PASSWORD` no coincide entre infra y api env | Sincroniza ambos |
| `Let's Encrypt failed: HTTP-01 challenge` | DNS está Proxied en Cloudflare antes del primer cert | Flip a DNS only, redeploy, esperar cert, flip a Proxied |
| api 502 Bad Gateway | Container crasheó en startup | Logs → fix env var faltante o DB connection |
| web blank page | `PUBLIC_API_URL` no apunta a HTTPS válido | Verifica env, redeploy |
| admin 404 en deep links | Caddy no fall-back a `index.html` | Revisa `apps/admin/Caddyfile` |
| Plausible login error | `BASE_URL` no coincide con dominio real | Cambia `DOMAIN` env, redeploy compose |
| MinIO uploads timeout | Bucket no existe | Corre el bootstrap (paso 3.5) |
| Migrator funciona local pero falla en prod | `tsx` no encuentra archivos | Verifica que `packages/db/migrations/*.sql` esté en git (no en `.gitignore`) |

### Logs útiles

```bash
# Pre-deploy log de api (en VPS)
docker logs $(docker ps -af name=api-pre-deploy --format '{{.ID}}' | head -1)

# api runtime
docker logs -f $(docker ps -qf name=api)

# postgres
docker exec $(docker ps -qf name=postgres) pg_isready

# Verificar migraciones aplicadas
docker exec $(docker ps -qf name=postgres) psql -U jcsoftdev -d jcsoftdev -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
```

---

## 13. Cheat sheet de URLs y servicios

| URL | Qué corre | Container |
|---|---|---|
| `https://jcsoftdev.com` | Astro SSR (sitio público) | `web` |
| `https://api.jcsoftdev.com` | Hono API | `api` |
| `https://admin.jcsoftdev.com` | React SPA | `admin` |
| `https://analytics.jcsoftdev.com` | Plausible | `plausible` |
| `https://minio.jcsoftdev.com` | MinIO Console | `minio` |
| `http://<VPS>:8080` | Dokploy UI | `dokploy` |

| DNS interno (dentro de `dokploy-network`) | Qué resuelve |
|---|---|
| `postgres:5432` | Postgres directo |
| `pgbouncer:5432` | Pool de connections |
| `valkey:6379` | Redis-compat cache |
| `minio:9000` | S3 API |
| `plausible-db:5432` | Postgres de Plausible |
| `plausible-events-db:8123` | ClickHouse de Plausible |

---

## 14. Resumen del flujo "release nuevo"

```
1. local: git push origin main
2. Dokploy webhook detecta commit (o manual: click Redeploy)
3. Pre-Deploy: docker build migrator + docker run → migrate + seed
   ├─ FAIL → abort, api viejo sigue ✅
   └─ OK → continúa
4. Build: apps/api Dockerfile (Bun compile, distroless)
5. Deploy: container nuevo, swap atómico
6. Health check pasa → tráfico nuevo va al container nuevo
7. Container viejo se baja
```

Tiempo total: ~2-4 min por release.

---

## 15. Próximos pasos opcionales

- [ ] Configurar webhook de auto-deploy desde GitHub al push.
- [ ] Push del migrator image a un registry (GHCR) para evitar rebuild en cada deploy → reduce pre-deploy a ~5s.
- [ ] Configurar alertas (Dokploy → Notifications) a Slack/Discord on deploy failure.
- [ ] Setear `restart: always` en infra services para HA básico.
- [ ] Monitoring: agregar Grafana + Prometheus stack como otro Compose service.
- [ ] Estrategia expand/contract para schema changes con downtime cero.
