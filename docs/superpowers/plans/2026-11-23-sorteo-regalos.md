# Sorteo de regalos — plan de implementación

**Goal:** App de amigo secreto anónimo con exclusiones por persona, desplegada en el Dokploy de jcsoftdev reutilizando su Postgres.

**Architecture:** `apps/sorteo-regalos` (Next.js App Router), aislada del resto del monorepo. Capas: `domain` (sorteo puro) → `application` (casos de uso sobre el puerto `Store`) → `infrastructure` (drizzle sobre Postgres; PGlite en tests) → `app` (rutas y UI).

**Tech Stack:** Next.js, React 19, Tailwind 4, `@jcsoftdev/ui@0.10.1` (npm, glass), drizzle-orm, postgres-js, PGlite, Vitest.

## Global constraints
- `@jcsoftdev/ui` se fija a la versión publicada `0.10.1`, nunca `workspace:`.
- La app no importa `packages/db` ni otras apps.
- Sin servicios de pago nuevos: corre en el VPS con Dokploy que ya existe.
- Las asignaciones nunca salen del servidor salvo a su dueño; el admin no ve asignaciones ni códigos.
- Salas expiran a los 30 días; el admin puede borrar todo.
- Código y commits en inglés; textos de UI en español.

## Review focus
- Sorteo imposible por exclusiones: informa quiénes bloquean y no sortea.
- Nombre duplicado (sin distinguir mayúsculas) en la misma sala.
- Fuerza bruta del código de 4 dígitos: 5 fallos bloquean 15 minutos.
- Sala vencida: se comporta como inexistente aunque no se haya purgado.
- Registro después del sorteo: rechazado.

## Tareas
1. **Dominio del sorteo** — `src/domain/draw.ts`: `drawAssignments(participants, exclusions, random)` por emparejamiento bipartito; devuelve `{ ok, assignments }` o `{ ok:false, blocked }`. Tests: sin autoasignación, respeta exclusiones, imposible reporta bloqueados.
2. **Persistencia** — esquema drizzle, migración, cliente (postgres-js / PGlite), repositorio.
3. **Casos de uso** — crear sala, unirse, recuperar con código, ver lo mío, panel admin, exclusiones, sortear, borrar, purgar. Tests contra PGlite: frontera de permisos, bloqueo, expiración.
4. **Rutas HTTP** — `src/app/api/**`, cookie + bearer, cron de purga.
5. **UI glass** — crear sala, unirse, mi resultado, recuperar, panel admin.
6. **Despliegue** — Dockerfile y README listos; el despliegue en Dokploy espera autorización explícita.
