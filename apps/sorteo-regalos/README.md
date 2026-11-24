# sorteo-regalos

Amigo secreto anónimo. Un administrador crea una sala y comparte un enlace; cada persona escribe su nombre; el administrador marca, por persona, a quiénes no conoce y hace el sorteo. Cada quien ve solo a quién le toca.

App independiente dentro del monorepo: no importa `packages/db` ni otras apps. Usa `@jcsoftdev/ui@0.10.1` desde npm (no el `packages/ui` del workspace) con `material="glass"`.

## Cómo funciona

- **Sala:** `/` crea la sala. El administrador recibe `/sala/<id>/admin#<secreto>`; el secreto va en el fragmento, así no llega a logs del servidor, y se guarda en `localStorage`.
- **Participantes:** `/sala/<id>`. Cada dispositivo recibe un token aleatorio (cookie `HttpOnly` y `localStorage`); el servidor guarda solo su hash.
- **Código de 4 dígitos:** vale únicamente dentro de su sala. Sirve para entrar desde otro dispositivo eligiendo el nombre. Cinco fallos bloquean a esa persona 15 minutos.
- **Sorteo:** lo hace el servidor con un emparejamiento bipartito (sin autoasignación, respetando exclusiones). Si es imposible, informa quiénes lo bloquean y no sortea.
- **Anonimato:** las asignaciones se guardan cifradas (AES-256-GCM, clave `ASSIGNMENT_KEY`, contexto = id del participante). El administrador no ve asignaciones ni códigos.
- **Vida de la sala:** vence a los 30 días y el administrador puede borrar todo antes. Una sala vencida se trata como inexistente y se purga al arrancar, cada hora y al crear otra sala.

## Desarrollo

```bash
pnpm install
cp apps/sorteo-regalos/.env.example apps/sorteo-regalos/.env
pnpm --filter @jcsoftdev/sorteo-regalos dev
pnpm --filter @jcsoftdev/sorteo-regalos test
```

`DATABASE_DIRECT_URL` se usa para aplicar migraciones al arrancar. Sin `ASSIGNMENT_KEY`, solo en desarrollo se usa una clave fija.

Los tests corren contra PGlite (Postgres en proceso), sin Docker.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión de la app. El cliente usa `prepare: false`, así que también funciona detrás de pgBouncer en modo transacción. |
| `DATABASE_DIRECT_URL` | Conexión directa a Postgres, solo para migraciones al arrancar. |
| `ASSIGNMENT_KEY` | 32 bytes en base64 (`openssl rand -base64 32`). Obligatoria en producción. Si se pierde, los sorteos existentes no se pueden leer. |

## Base de datos compartida con el portafolio

La app reutiliza la base `jcsoftdev` del portafolio y vive en su propio schema, `sorteo_regalos`, con su propia tabla de migraciones (`sorteo_regalos.migrations`). No toca `public` ni `drizzle.__drizzle_migrations`, que es donde migra `packages/db`: compartir esa tabla haría que drizzle se salte migraciones futuras del portafolio.

Rol propio, sin acceso a las tablas del portafolio (lo ejecuta quien administra el Postgres):

```sql
CREATE ROLE sorteo LOGIN PASSWORD '<contraseña>';
GRANT CONNECT, CREATE ON DATABASE jcsoftdev TO sorteo;
```

El rol necesita `CREATE` en la base solo para crear su schema la primera vez. Como el pgBouncer actual autentica un único usuario, la app se conecta directo a `postgres:5432` (abre como máximo 5 conexiones).

## Despliegue en Dokploy

Sin hacer todavía; requiere autorización explícita sobre el destino.

1. Crear el rol anterior en el Postgres de producción.
2. Crear la aplicación con `apps/sorteo-regalos/Dockerfile` y contexto en la raíz del repositorio, puerto 3015.
3. Definir `DATABASE_URL` y `DATABASE_DIRECT_URL` (ambas `postgresql://sorteo:<contraseña>@postgres:5432/jcsoftdev`), `ASSIGNMENT_KEY` y un dominio.

El Dockerfile no se ha construido todavía.
