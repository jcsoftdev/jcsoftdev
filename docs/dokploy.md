# Guía de Deploy — jcsoftdev en Dokploy

Runbook end-to-end para deployar el monorepo (`apps/api`, `apps/web`, `apps/admin`) más infraestructura (Postgres, pgBouncer, Valkey, MinIO, Plausible) en un VPS con Dokploy.

> Todo el stack corre en un único VPS a propósito — es un SPOF asumido, no un descuido. Ver ADR-24 en `docs/architecture.md` para el razonamiento y cuándo revisitar esta decisión.

---

## 0. Pre-requisitos

- VPS Ubuntu 24.04 LTS, mínimo 2 vCPU / 4 GB RAM / 50 GB SSD (8 GB RAM recomendado por Plausible + ClickHouse).
- Acceso SSH con llave pública (password auth deshabilitado).
- Dominio `jcsoftdev.com` con DNS gestionado en Cloudflare.
- UFW abierto: `22` (SSH), `80` (HTTP), `443` (HTTPS), `3000` (Dokploy UI). Resto bloqueado.

### Instalar Dokploy

```bash
ssh root@<VPS_IP>
curl -sSL https://dokploy.com/install.sh | bash
```

Espera ~2 min. Accede a `http://<VPS_IP>:3000`, crea cuenta admin.

> ⚠️ El puerto de la UI de Dokploy es **3000**, no 8080.

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

| Type | Name      | Content    | Proxy         |
|------|-----------|------------|---------------|
| A    | @         | <VPS_IP>   | **DNS only**  |
| A    | www       | <VPS_IP>   | **DNS only**  |
| A    | api       | <VPS_IP>   | **DNS only**  |
| A    | admin     | <VPS_IP>   | **DNS only**  |
| A    | analytics | <VPS_IP>   | **DNS only**  |
| A    | minio     | <VPS_IP>   | **DNS only**  |

> El record `minio` es opcional (C3 fix): Traefik ya no rutea `minio.${DOMAIN}` públicamente — la consola solo se accede vía túnel SSH (ver §11). Puedes omitirlo por completo.

> ⚠️ **Crítico: mantén TODOS los records en DNS only (gris) permanentemente.**
> Traefik usa HTTP-01 challenge para emitir certs Let's Encrypt. El proxy de Cloudflare rompe ese challenge Y además interfiere con el routing de Traefik en producción. Con DNS only, el TLS termina directamente en el VPS (Traefik), que es lo correcto.

---

## 3. Infra Compose service

### 3.1 Crear servicio en Dokploy

**Project `jcsoftdev`** → Create Service → **Compose**

| Campo         | Valor                      |
|---------------|----------------------------|
| Name          | `infrastructure`           |
| Source Type   | Git (GitHub App)           |
| Repository    | `jcsoftdev/jcsoftdev`      |
| Branch        | `main`                     |
| Compose Path  | `docker-compose.prod.yml`  |
| Compose Type  | `docker-compose`           |

> **Build Path**: debe estar en `.` (raíz del repo).

### 3.2 Environment

Pega en el tab **Environment**:

```env
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

En el tab **Logs**, deben quedar los containers healthy:

```
postgres            ✅
pgbouncer           ✅
valkey              ✅
minio               ✅
plausible-db        ✅
plausible-events-db ✅
plausible           ✅
```

### 3.5 Bootstrap del bucket MinIO (una vez)

SSH al VPS o usa el Docker Terminal de Dokploy sobre el container de minio:

```bash
docker exec -i $(docker ps -qf name=minio) sh -c '
mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD &&
mc mb local/jcsoftdev-media &&
mc anonymous set download local/jcsoftdev-media
'
```

Crea el bucket `jcsoftdev-media` y lo expone como público read-only.

---

## 4. apps/api — Hono API

### 4.1 Crear Application

**Project `jcsoftdev`** → Create Service → **Application**

| Tab     | Campo              | Valor                    |
|---------|--------------------|--------------------------|
| General | Name               | `api`                    |
| Source  | Provider           | Git (GitHub App)         |
| Source  | Repository         | `jcsoftdev/jcsoftdev`    |
| Source  | Branch             | `main`                   |
| Build   | Build Type         | `Dockerfile`             |
| Build   | Dockerfile Path    | `apps/api/Dockerfile`    |
| Build   | Build Context (⚠️) | `.`                      |

> ⚠️ **Build Context debe ser `.`** (punto = raíz del repo), NO `apps/api`. El Dockerfile usa `COPY` relativo a la raíz del monorepo.

### 4.2 Dockerfile del api

El Dockerfile usa **dos stages**:

1. **Stage `deps`**: Node 24 Alpine + pnpm — instala dependencias del monorepo filtrando `@jcsoftdev/api`.
2. **Stage `runtime`**: `oven/bun:1-alpine` — copia `/repo` completo del stage anterior y arranca con `bun run src/index.ts`.

> ⚠️ **No compilar a binario** con `bun build --compile`. Un binario compilado en Alpine (musl libc) no corre en imágenes glibc (distroless, debian-slim), resultando en exit 255 sin logs. Usar `bun run src/index.ts` directamente desde `oven/bun:1-alpine`.

> ℹ️ **El CMD solo arranca el servidor — no corre migraciones ni seed.** Antes lo hacía (`migrate.ts && seeds/index.ts && index.ts` en cada arranque del container), duplicando el Pre Deploy migrator (§4.6) y compitiendo contra un drizzle migrator sin lock. Se eligió un único mecanismo de migración: el Pre Deploy Command. El runtime corre como el usuario no-root `bun` (built-in en `oven/bun:1-alpine`), no como root.

```dockerfile
# Stage 1: Install dependencies with Node+pnpm
FROM node:24-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/mdx-runtime/package.json packages/mdx-runtime/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @jcsoftdev/api...
COPY packages/config ./packages/config
COPY packages/db ./packages/db
COPY packages/mdx-runtime ./packages/mdx-runtime
COPY apps/api ./apps/api

# Stage 2: Runtime with Bun
FROM oven/bun:1-alpine AS runtime
WORKDIR /repo
COPY --from=deps --chown=bun:bun /repo /repo
WORKDIR /repo/apps/api
USER bun
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

### 4.3 Zod v4 — env.ts (fix ya aplicado)

> ✅ Este fix **ya está aplicado** en `apps/api/src/env.ts` — se documenta aquí como referencia histórica (por qué el código es como es), no como un paso pendiente del runbook.

Zod v4 cambió `z.url()` para seguir el estándar WHATWG URL, que **rechaza** protocolos como `redis://`, `postgresql://`, `http://minio:9000`. Los validators en `apps/api/src/env.ts` usan `z.string()` en vez de `z.url()` por esta razón:

```typescript
// ❌ Antes (Zod v4 rechaza estos protocolos)
DATABASE_URL: z.url(),
DATABASE_DIRECT_URL: z.url(),
VALKEY_URL: z.url(),
BETTER_AUTH_URL: z.url(),
MINIO_ENDPOINT: z.url(),
MINIO_PUBLIC_URL: z.url().optional(),

// ✅ Después
DATABASE_URL: z.string().min(1),
DATABASE_DIRECT_URL: z.string().min(1),
VALKEY_URL: z.string().min(1),
BETTER_AUTH_URL: z.string().min(1),
MINIO_ENDPOINT: z.string().min(1),
MINIO_PUBLIC_URL: z.string().optional(),
```

Sin este fix, el container arranca y muere inmediatamente (exit 255, sin logs) porque la validación de env falla.

### 4.4 Environment

```env
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

> Las passwords deben coincidir **exacto** con las del Compose infra.

### 4.5 Domain

| Campo           | Valor                |
|-----------------|----------------------|
| Host            | `api.jcsoftdev.com`  |
| Container Port  | `3000`               |
| HTTPS           | ON                   |
| Cert Provider   | `letsencrypt`        |

### 4.6 Pre Deploy Command — el ÚNICO mecanismo de migración

> Este es el **único** lugar donde corren migraciones. El container del `api` (§4.2) NO corre `migrate.ts` en su `CMD` — solo arranca el servidor. Tener dos mecanismos activos a la vez (CMD + Pre Deploy) causaba migraciones duplicadas en cada deploy y una carrera contra un drizzle migrator sin lock (issue H3 del audit). Si en algún momento se desactiva el Pre Deploy Command sin querer, las migraciones nuevas **no se van a aplicar** — no hay fallback automático.

En Dokploy → api → **Advanced** → **Pre Deploy Command**:

```bash
docker build -t jcsoftdev-migrator:latest -f packages/db/Dockerfile . \
  && docker run --rm \
       --network dokploy-network \
       -e DATABASE_DIRECT_URL="postgres://jcsoftdev:${POSTGRES_PASSWORD}@postgres:5432/jcsoftdev" \
       jcsoftdev-migrator:latest
```

**Qué hace en cada deploy:**

1. Buildea la imagen del migrator desde `packages/db/Dockerfile` (Node 24 + pnpm + tsx).
2. Corre el container one-shot contra `postgres:5432` directo (NO pgbouncer — las migraciones DDL requieren modo sesión).
3. Ejecuta `tsx src/migrate.ts` → aplica migraciones Drizzle pendientes (idempotente) y luego el seed.
4. Si exit 0 → procede al build/deploy del api. Si exit ≠ 0 → **aborta el deploy**, el api viejo sigue corriendo.

> ⚠️ Asegúrate de que la variable `POSTGRES_PASSWORD` esté en el env del api service (paso 4.4) para que el Pre Deploy Command pueda usarla.

**Logs esperados en cada deploy:**

```
[Pre-Deploy] Building migrator image...
[Pre-Deploy] Running migrations...
[Pre-Deploy] Migrations completed successfully.
[Pre-Deploy] Seed completed successfully.
[Build] Building apps/api/Dockerfile...
[Deploy] Container running on port 3000
```

> 💡 **Alternativa manual** (sin Pre Deploy): usa el Docker Terminal de Dokploy → selecciona el container `running` del api → `/bin/sh` → `cd /repo/packages/db && bun run src/migrate.ts`. Útil para hotfixes o si el Pre Deploy no está configurado aún.

### 4.7 Deploy

Click **Deploy**. El Pre Deploy corre primero, luego el build. El container debe quedar `running`.

### 4.8 Verifica

```bash
curl https://api.jcsoftdev.com/
# 404 Not Found  ← correcto, no hay ruta en /

curl https://api.jcsoftdev.com/api/v1/projects
# [] o array con proyectos
```

---

## 5. apps/web — Astro SSR

### 5.1 Crear Application

| Tab     | Campo           | Valor                    |
|---------|-----------------|--------------------------|
| General | Name            | `web`                    |
| Source  | Repository      | `jcsoftdev/jcsoftdev`    |
| Source  | Branch          | `main`                   |
| Build   | Build Type      | `Dockerfile`             |
| Build   | Dockerfile Path | `apps/web/Dockerfile`    |
| Build   | Build Context   | `.`                      |

### 5.2 Dockerfile del web

Las variables `PUBLIC_*` de Astro/Vite son **build-time** — deben estar disponibles durante el `pnpm run build`, no solo en runtime. El Dockerfile debe pasar los `ARG` antes del build:

```dockerfile
# Stage 1: Install dependencies and build
FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/animations/package.json packages/animations/
COPY packages/ui/package.json packages/ui/
COPY packages/types/package.json packages/types/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @jcsoftdev/web...
COPY packages/config ./packages/config
COPY packages/animations ./packages/animations
COPY packages/ui ./packages/ui
COPY packages/types ./packages/types
COPY apps/web ./apps/web
WORKDIR /repo/apps/web
# Build-time env vars (Vite/Astro PUBLIC_* se inyectan en build, no en runtime)
ARG PUBLIC_API_URL=https://api.jcsoftdev.com
ARG PUBLIC_PLAUSIBLE_HOST=https://analytics.jcsoftdev.com
ARG PLAUSIBLE_DOMAIN=jcsoftdev.com
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
ENV PUBLIC_PLAUSIBLE_HOST=${PUBLIC_PLAUSIBLE_HOST}
ENV PLAUSIBLE_DOMAIN=${PLAUSIBLE_DOMAIN}
RUN pnpm run build

# Stage 2: Runtime
FROM node:24-alpine AS runtime
WORKDIR /repo
COPY --from=build --chown=node:node /repo /repo
WORKDIR /repo/apps/web
EXPOSE 4321
ENV HOST=0.0.0.0
ENV PORT=4321
USER node
CMD ["node", "./dist/server/entry.mjs"]
```

> ⚠️ El Stage 2 debe copiar el `/repo` **completo** del stage de build (no solo `dist/`). El servidor SSR de Astro necesita `node_modules` en runtime.

### 5.3 Environment

```env
NODE_ENV=production
PORT=4321
PUBLIC_API_URL=https://api.jcsoftdev.com
PUBLIC_PLAUSIBLE_HOST=https://analytics.jcsoftdev.com
PLAUSIBLE_DOMAIN=jcsoftdev.com
```

### 5.4 Domain

| Host              | Port   | HTTPS |
|-------------------|--------|-------|
| `jcsoftdev.com`   | `4321` | ON    |

### 5.5 Deploy & verifica

```bash
curl -I https://jcsoftdev.com
# HTTP/2 200
```

---

## 6. apps/admin — React SPA (Caddy)

### 6.1 Crear Application

| Tab     | Campo           | Valor                      |
|---------|-----------------|----------------------------|
| General | Name            | `admin`                    |
| Source  | Repository      | `jcsoftdev/jcsoftdev`      |
| Source  | Branch          | `main`                     |
| Build   | Build Type      | `Dockerfile`               |
| Build   | Dockerfile Path | `apps/admin/Dockerfile`    |
| Build   | Build Context   | `.`                        |

### 6.2 Environment (build-time, Vite)

```env
NODE_ENV=production
VITE_API_URL=https://api.jcsoftdev.com
```

> Vite reemplaza `import.meta.env.VITE_*` en build time. Si cambias `VITE_API_URL` después, redeployea el admin (no basta restart).

### 6.3 Domain

| Campo          | Valor                  |
|----------------|------------------------|
| Host           | `admin.jcsoftdev.com`  |
| Container Port | `80`                   |
| HTTPS          | ON                     |
| Cert Provider  | `letsencrypt`          |

### 6.4 Deploy & verifica

```bash
curl -I https://admin.jcsoftdev.com
# HTTP/2 200
# server: Caddy
```

Abre `https://admin.jcsoftdev.com` → debe cargar el panel de login con magic link.

---

## 7. Validar certificados SSL en Dokploy

Por cada servicio: **Domains** tab → botón **Validate** junto al cert. Debe mostrar **Valid** (verde).

Si muestra error:
- Verifica que el DNS record esté en **DNS only** (no Proxied).
- Verifica que los puertos 80 y 443 estén accesibles desde internet.
- Espera 2-5 min y vuelve a intentar.

---

## 8. Migraciones — referencia completa

El repo tiene un migrator dedicado en `packages/db/Dockerfile` que el compose llama como one-shot container. **El mecanismo automático (Opción A) es el único que corre en cada deploy** — las opciones B y C son manuales, para hotfixes o troubleshooting, y nunca corren solas en producción salvo que las invoques a mano.

### Opción A: Pre Deploy automático (el mecanismo real, no opcional)

Configurado en el paso 4.6. Corre automáticamente antes de cada deploy del api. El comando:
- Buildea la imagen del migrator desde `packages/db/Dockerfile`.
- Corre el container con `DATABASE_DIRECT_URL` apuntando a `postgres:5432` directamente (no pgbouncer — DDL requiere session mode).
- Sale 0 → deploy continúa. Sale ≠ 0 → deploy abortado, api viejo sigue corriendo sin cambios.

**Comportamiento de falla**: si el migrator falla (SQL inválido, conexión rechazada, timeout), Dokploy aborta el deploy completo del api — no llega a buildear ni reemplazar el container corriendo. No hay rollback automático de la migración en sí (Drizzle es forward-only, ADR-9); si la migración quedó parcialmente aplicada, corregir con una migración forward nueva, no editando el historial de `drizzle.__drizzle_migrations` a mano.

### Opción B: Via docker compose profile (manual en VPS, no corre en autodeploy)

```bash
# En el VPS, dentro del directorio donde el compose está deployado
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrator
```

Útil para aplicar una migración fuera del ciclo normal de deploy (ej. antes de habilitar el Pre Deploy Command por primera vez).

### Opción C: Via Docker Terminal de Dokploy (hotfix rápido, no corre en autodeploy)

1. api → General → **Open Terminal**
2. Selecciona container **running** en el dropdown
3. Elige **/bin/sh** (no bash — la imagen es Alpine)

```sh
cd /repo/packages/db && bun run src/migrate.ts
# Migrations completed successfully.
```

> ⚠️ `migrate.ts` requiere `DATABASE_DIRECT_URL` (postgres directo, puerto 5432). En el api container esta variable ya está en el env — confirma antes de correr. Nota: el `CMD` del api container ya no incluye `migrate.ts` (fix H3) — este comando lo corre manualmente dentro del container, no es lo que pasa por defecto al arrancar.

---

## 9. Workflow de cambios después del setup inicial

### 9.1 Schema change (nueva migración)

```bash
# Local
pnpm --filter @jcsoftdev/db db:generate  # genera SQL nuevo
git add packages/db/migrations/
git commit -m "feat(db): <descripción>"
git push origin main
```

Con **Autodeploy ON** y **Pre Deploy configurado**: Dokploy detecta el push → corre el migrator → aplica la migración nueva → deploya el api nuevo. Todo automático.

### 9.2 Cambio en api/web/admin

```bash
git push origin main
```

Con **Autodeploy ON** → deploy automático en todos los servicios.

### 9.3 Rollback

En Dokploy → service → **Deployments** → click en deploy anterior → **Redeploy**.

Para rollback de migración → escribe migración inversa nueva (Drizzle no soporta down automático en runtime).

---

## 10. Backup strategy

### 10.1 Postgres dump (cron en VPS)

```bash
ssh root@<VPS_IP>
mkdir -p /backups
crontab -e
```

Agrega:

```cron
0 2 * * * docker exec $(docker ps -qf name=postgres) pg_dump -U jcsoftdev jcsoftdev | gzip > /backups/jcsoftdev-$(date +\%Y\%m\%d).sql.gz
0 3 * * * find /backups -name "*.sql.gz" -mtime +7 -delete
```

### 10.2 Off-site sync (recomendado)

```cron
0 4 * * * rclone sync /backups remote:jcsoftdev-backups
```

Configura `rclone config` una vez con credenciales de Backblaze B2, S3 o Cloudflare R2.

---

## 11. Servicios secundarios (Plausible + MinIO console)

### Plausible Analytics

URL: `https://analytics.jcsoftdev.com`

Primera vez:
1. Abre la URL → te pide crear admin user.
2. Crea cuenta → Add site → `jcsoftdev.com`.
3. `apps/web` ya lee `PUBLIC_PLAUSIBLE_HOST` / `PLAUSIBLE_DOMAIN` para construir la URL del snippet — falta embeber el `<script>` en el layout público (en progreso, otro workstream). Hasta que eso esté hecho, Plausible corre y recibe tráfico solo si algo apunta al endpoint manualmente.

### MinIO Console (C3 fix — sin acceso público)

> ⚠️ **La consola de MinIO (puerto 9001) NO está expuesta por Traefik.** Solo tiene una password root estática protegiéndola — dejarla pública detrás de un subdominio era el hallazgo crítico C3 del audit. `docker-compose.prod.yml` ya no define labels de Traefik para `minio-console`; el registro DNS `minio.jcsoftdev.com` puede quedar en Cloudflare pero no resuelve a nada servido por Traefik.

Acceso a la consola vía túnel SSH:

```bash
ssh -L 9001:localhost:9001 root@<VPS_IP>
# En otra terminal / el navegador:
open http://localhost:9001
```

Login con `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`.

La API S3 (`:9000`) tampoco está expuesta públicamente — solo es alcanzable desde `dokploy-network` vía `minio:9000` (usada por `apps/api`). Si en el futuro se necesita acceso público de solo-lectura a objetos (ej. imágenes de blog), preferir presigned URLs o un bucket público read-only vía la API — no reabrir el puerto de la consola.

---

## 12. Troubleshooting

| Síntoma | Causa probable | Fix |
|---------|---------------|-----|
| Container exits immediately, exit 255, sin logs | Zod v4 `z.url()` rechaza `redis://` / `postgresql://` | Cambiar a `z.string().min(1)` en `env.ts` |
| Container exits 255 tras fix de Zod | Binario compilado con `bun build --compile` en Alpine (musl) no corre en glibc | Usar `bun run src/index.ts` en `oven/bun:1-alpine`, sin compilar |
| api 502 Bad Gateway | Container crasheó en startup | Logs → fix env var faltante o DB connection |
| Pre Deploy falla: `connection refused` | `dokploy-network` no agregado al api | Advanced → Network → agregar `dokploy-network` |
| Pre Deploy falla: `password authentication failed` | `POSTGRES_PASSWORD` no coincide entre infra y api env | Sincronizar ambos valores |
| `PostgresError: relation "X" does not exist` | Pre Deploy no configurado / migración no corrida | Configurar Pre Deploy (4.6) o correr manualmente (opción C del paso 8) |
| Let's Encrypt failed: HTTP-01 challenge | DNS está Proxied en Cloudflare | Flip a DNS only, esperar, retry |
| web blank / `PUBLIC_API_URL must be set` | Variables `PUBLIC_*` no disponibles en build time | Agregar `ARG`/`ENV` antes de `pnpm run build` en el Dockerfile |
| web SSR falla, `Cannot find module` | Stage 2 solo copia `dist/`, faltan `node_modules` | Stage 2 debe copiar `/repo` completo del stage build |
| Terminal muestra `bash: not found` | Imagen es Alpine, no tiene bash | Usar `/bin/sh` en el Docker Terminal de Dokploy |
| admin blank page en `/dashboard` | Requiere autenticación — comportamiento normal | Ir a `/login`, ingresar email, recibir magic link |
| Magic link no llega | `RESEND_API_KEY` es placeholder | Reemplazar con key real de Resend en env del api |
| MinIO uploads timeout | Bucket no existe | Correr bootstrap (paso 3.5) |

### Logs útiles

```bash
# api runtime
docker logs -f $(docker ps -qf name=api)

# postgres
docker exec $(docker ps -qf name=postgres) pg_isready

# Verificar migraciones aplicadas
docker exec $(docker ps -qf name=postgres) psql -U jcsoftdev -d jcsoftdev \
  -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
```

---

## 13. Cheat sheet de URLs y servicios

| URL | Qué corre | Container |
|-----|-----------|-----------|
| `https://jcsoftdev.com` | Astro SSR (sitio público) | `web` |
| `https://api.jcsoftdev.com` | Hono API | `api` |
| `https://admin.jcsoftdev.com` | React SPA (Caddy) | `admin` |
| `https://analytics.jcsoftdev.com` | Plausible Analytics | `plausible` |
| `ssh -L 9001:localhost:9001` + `http://localhost:9001` | MinIO Console (SSH-tunnel only, C3 fix — no public route) | `minio` |
| `http://<VPS>:3000` | Dokploy UI | `dokploy` |

| DNS interno (dokploy-network) | Qué resuelve |
|-------------------------------|--------------|
| `postgres:5432` | Postgres directo (migraciones, DDL) |
| `pgbouncer:5432` | Pool de connections (queries de app) |
| `valkey:6379` | Redis-compat cache |
| `minio:9000` | S3 API |
| `plausible-db:5432` | Postgres de Plausible |
| `plausible-events-db:8123` | ClickHouse de Plausible |

---

## 14. Resumen del flujo "release nuevo"

```
1. local: git push origin main
2. Dokploy autodeploy detecta commit
3. Pre-Deploy: docker build jcsoftdev-migrator + docker run
   ├─ FAIL → abort, api viejo sigue ✅
   └─ OK → continúa
4. Build: apps/api/Dockerfile (Node deps + Bun runtime)
5. Deploy: container nuevo, swap atómico
6. Health check pasa → tráfico al container nuevo
7. Container viejo se baja

Tiempo total: ~3-5 min por release (incluyendo migrator build).
```

---

## 15. Próximos pasos opcionales

- Push del migrator image a GHCR para evitar rebuild en cada deploy → reduce Pre Deploy a ~5s.
- Configurar alertas (Dokploy → Notifications) a Slack/Discord on deploy failure.
- Cache purge de Cloudflare en cada deploy del web via Post Deploy Command.
- Backup off-site con rclone a Backblaze B2 o Cloudflare R2.
- Monitoring: Grafana + Prometheus como otro Compose service.
- Estrategia expand/contract para schema changes con downtime cero.
