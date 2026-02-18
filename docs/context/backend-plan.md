# Neuraal — Backend/API + IA + Automatizaciones (Clean Architecture)

**Fecha:** 2026-02-03  
**Objetivo:** Documento de referencia para construir la API y la capa de backend siguiendo Clean Architecture y TDD, integrando **Postgres + S3 + Redis/BullMQ + n8n**, y soportando: login JWT (access/refresh), dashboard calendario, tareas/notas con editor rico, adjuntos con cuotas, embeddings por usuario y flujos asíncronos (resúmenes, avisos, autoclasificación).

> Contexto de UI existente (Next.js App Router, Zustand, estructura feature-first, reglas de imports) en `docs/context/project-context.md`.
> Base de arquitectura (Clean Architecture-inspired, seguridad, testing) en `docs/design.md`.

---

## 0) Decisiones confirmadas (resumen ejecutivo)

### Stack y piezas principales

- **Frontend/Web:** Next.js (App Router) + React + TypeScript + Tailwind; UI ya muy avanzada. fileciteturn1file17
- **Persistencia principal:** **PostgreSQL** autohosteado en VPS.
- **Vectores:** **pgvector** en el mismo Postgres (1ª fase).
- **Archivos/adjuntos:** **S3** (o S3-compatible) para objetos; metadata y cuotas en Postgres.
- **Colas y workers:** **Redis + BullMQ** para jobs diferidos y asíncronos (avisos, llamadas a n8n, etc.).
- **Automatización/IA e integraciones:** **n8n** confirmado para orquestar flujos (resumen IA, envío de mensajes, etc.). (ADR-008 en el diseño) fileciteturn1file8
- **Arquitectura:** Clean Architecture-inspired con capas Domain / Application / Infrastructure / UI. fileciteturn1file6
- **Testing:** TDD empezando por Domain/Application con Vitest (ya en el proyecto). fileciteturn1file8 fileciteturn1file17

### Auth

- **JWT** con **Access Token corto** + **Refresh Token largo**, con rotación.
- **Recomendación fuerte de almacenamiento:** **cookies httpOnly** (no localStorage) para evitar robo por XSS. fileciteturn1file0 fileciteturn1file10
  > Nota: cookies **no** son “inseguras” por sí mismas; lo inseguro es usarlas mal (p. ej. sin `httpOnly`, sin `SameSite`, sin `secure`, etc.). El documento de diseño ya apunta este patrón. fileciteturn1file0

---

## 1) Reglas de arquitectura y dependencias

### Capas (Clean Architecture)

- **Domain:** entidades, value objects, invariantes, reglas puras (sin Next/Prisma/Redis/n8n).
- **Application:** casos de uso (use-cases), DTOs, puertos (interfaces) hacia persistencia y servicios externos.
- **Infrastructure:** adaptadores (Postgres/Prisma, Redis/BullMQ, S3, n8n webhooks, IA si aplica), configuración, logging/monitoring.
- **UI/Presentation:** features/ (componentes), estado UI, view-models; llama a Application (no a Infrastructure directa). fileciteturn1file6

### Reglas de imports (mantener lo ya existente)

- No se importan módulos cruzados entre `features/*` (feature A no importa feature B). fileciteturn1file2
- `shared/` se mantiene “global” y sin estado UI (idealmente domain-centric). fileciteturn1file19
- Ajuste recomendado para el backend:
  - `features/*` (UI) puede importar de `application/` y `domain/`.
  - `infrastructure/*` puede importar de `application/` y `domain/`.
  - `application/` puede importar de `domain/`.
  - `domain/` no importa de nadie.

---

## 2) Estructura de carpetas propuesta (compatible con lo que ya tienes)

Basada en la estructura objetivo ya descrita en `design.md`. fileciteturn1file19

```
src/
  app/
    api/                       # Route Handlers (controladores HTTP)
      ...
  features/                    # UI feature-first (ya existe)
  shared/                      # tipos compartidos y utilidades (domain-centric)
  domain/
    entities/
    value-objects/
    services/                  # reglas de dominio puras (si aplica)
  application/
    use-cases/
    ports/
    dto/
  infrastructure/
    persistence/               # Prisma/Postgres + pgvector
    storage/                   # S3 presigned URLs
    queue/                     # BullMQ + Redis
    automations/               # cliente n8n + callbacks/webhooks
    auth/                      # JWT, hashing, refresh rotation
    config/                    # env parsing
    monitoring/                # Sentry, logs
docs/
  design.md
  adr/
```

> En la práctica, `src/app/api/*` actúa como “controller adapter” (Infrastructure) y delega en Application.

---

## 3) Modelo de dominio (lo que “existe” en el negocio)

### Conceptos clave

- **User**
- **Topic** (por usuario): nombre, color, embedding
- **Entry** (unifica Task + Note)
  - `type`: `"task" | "note"`
  - `title`
  - `content` (documento rico en JSON)
  - `topicId` (o “AUTO” como modo de UI; persistido como topicId final)
  - `completed` (solo task)
  - `entryDate` (fecha a la que pertenece en el calendario)
- **Attachment** (archivo asociado a una entry, o inline dentro del contenido)
- **Reminder** (aviso programado con fecha/hora)
- **Notification** (para mostrar en dashboard: “resumen listo”, “aviso enviado”, “falló job”, etc.)

### Reglas/invariantes de dominio

- Un usuario solo puede acceder a sus `topics/entries/attachments/reminders/notifications`.
- **Límites de adjuntos:**
  - Máx **20 MB** por entry (suma total de sus adjuntos).
  - Máx **1 GB** por usuario (suma de todos los adjuntos).
- `completed` solo aplica si `type == "task"`.
- `Topic.color` válido (p. ej. `#RRGGBB`).
- `entryDate` siempre en ISO (p. ej. `YYYY-MM-DD`) para evitar líos de zonas horarias.

---

## 4) Persistencia: Postgres + pgvector + S3 (objetos)

### Postgres (tablas mínimas sugeridas)

> No es “modelo final”, pero es suficiente para empezar con TDD y vertical slices.

- `users`
- `topics`
- `entries`
- `entry_embeddings` _(opcional, si decides cachear embedding de entry)_
- `attachments`
- `user_storage_usage` _(o derivable por query + caching)_
- `reminders`
- `notifications`
- `refresh_tokens` _(si haces rotación con estado en BD; recomendado)_

### Campos clave (idea)

- `topics.embedding` → vector pgvector (por usuario)
- `entries.content` → `jsonb` (documento rico)
- `attachments`:
  - `storage_key` (ruta en S3)
  - `mime`, `size_bytes`, `sha256`
  - `kind`: `"inline" | "file"`
  - `entry_id`, `user_id`

### S3 (o compatible)

- Guardar el binario en S3.
- Guardar en Postgres **metadata + ownership + relación**.
- Subida/descarga desde el navegador mediante **URLs prefirmadas** (para no hacer “proxy” de binarios por tu servidor).

### Cuotas (20MB por entry, 1GB por usuario)

Patrón recomendado:

1. El cliente pide “iniciar subida” → `POST /attachments/init`.
2. API valida:
   - tamaño total de la entry (actual + nuevos) ≤ 20MB
   - tamaño total del usuario ≤ 1GB
3. API devuelve:
   - `attachmentId`
   - `presignedUrl` (PUT)
   - `storageKey`
4. Cliente sube a S3.
5. Cliente confirma → `POST /attachments/complete` (marca como “ready” y actualiza contadores).

> Si la confirmación no llega (cierre del navegador), un job de limpieza puede revisar “uploads pendientes” y reconciliar.

---

## 5) Editor rico: cómo almacenar contenido (imágenes, YouTube, código, estilos)

Tu requisito (“texto con formato + embeds + redimensionado + snippets”) se resuelve bien con un **document model** (árbol JSON) tipo ProseMirror/TipTap/Lexical/Slate.

### Recomendación de almacenamiento

- `entries.content` = **JSON** (jsonb) con:
  - nodos: párrafo, heading, lista, bloque de código, embed YouTube, imagen inline…
  - marcas: bold/italic/color, etc.
- Añadir:
  - `contentVersion` (number) para migraciones futuras del esquema.
  - `plainText` (opcional, derivado) para búsqueda rápida o embeddings.

### Relación con imágenes inline

- El nodo “imagen” en el JSON **no** guarda el binario.
- Guarda referencia:
  - `attachmentId` o `storageKey`
  - tamaño/align/crop si aplica

### Seguridad

- Sanitizar renderizado en cliente/servidor (sobre todo si aceptas HTML).
- Prohibir scripts embebidos.

---

## 6) Autosave (guardado automático del contenido)

Objetivo: que el editor guarde “mientras se escribe” sin saturar la API.

### Estrategia propuesta

- UI mantiene `draft` local (Zustand o estado local del editor).
- **Debounce** (p. ej. 500–1200ms) para agrupar cambios.
- Endpoint `PATCH /entries/:id` con **parches** (EntryPatch) o reemplazo parcial.
- Campos recomendados:
  - `updatedAt` + `version` (optimistic concurrency)
- UI:
  - indicador “Guardando…” / “Guardado”
  - flush inmediato en `blur`, `Cmd+S`, o antes de cambiar de día.

> Ahora mismo el store está persistido en localStorage para el MVP. La migración a server-backed debe sustituir gradualmente ese persist y sincronizar al login. fileciteturn1file12

---

## 7) IA + n8n: flujos asíncronos confirmados

### 7.1 Botón “Resumir” (n8n → IA → actualizar entry → notificar)

**Objetivo:** el usuario pulsa “Resumir” y, cuando termine, la entry se actualiza y aparece una notificación en dashboard.

**Diseño recomendado (robusto y “clean”):**

1. UI → `POST /entries/:id/summarize`
2. API (Use Case `RequestEntrySummary`) crea un registro `notifications` tipo “in-progress” y encola job `ENTRY_SUMMARY_REQUESTED`.
3. Worker (BullMQ):
   - Llama a n8n (webhook) con `entryId` + `userId` + `callbackUrl` + firma HMAC.
4. n8n:
   - Ejecuta el flujo IA (puede usar Batch API si quieres).
   - Cuando termina, llama al `callbackUrl` (tu API) con el resumen.
5. API callback:
   - actualiza `entries.content` (o añade un bloque “Resumen”)
   - marca notificación como “done”
6. UI:
   - obtiene notificaciones (poll o SSE) y refresca la entry.

### 7.2 Autoclasificación de topic (modo “AUTO”)

**Evento:** al terminar de editar, si el selector está en “AUTO”, clasifica entry al topic más similar.

Dos opciones:

- **Síncrono (simple):** endpoint calcula embedding + hace query pgvector a topics del usuario → devuelve topicId.
- **Asíncrono (más robusto):** encola job `ENTRY_CLASSIFY_TOPIC`, notifica al terminar.

Recomendación:

- Empezar **síncrono** si el embedding es rápido.
- Pasar a **asíncrono** si notas latencia o quieres colas/reintentos.

---

## 8) Avisos programados: Redis/BullMQ worker + n8n (envío)

**Objetivo:** el usuario programa una fecha/hora → debe enviarse (por el canal que elijas) y poder apoyarse en n8n.

### Flujo propuesto

1. UI → `POST /reminders` (entryId, scheduledAt, channel, payload…)
2. API guarda `reminders` en Postgres (fuente de verdad).
3. API encola job BullMQ con `delay = scheduledAt - now` (job data: `{ reminderId }`).
4. Cuando llega la hora, Worker:
   - valida en Postgres que sigue `pending` (evita duplicados si se cambió/canceló)
   - llama a n8n webhook “send-reminder”
   - marca `sent` / `failed`
   - crea `notification` en dashboard si procede.

> Este patrón evita polling constante y escala levantando más workers.

---

## 9) Notificaciones en dashboard (para “resumen listo”, “error”, etc.)

### Modelo mínimo

Tabla `notifications`:

- `id`, `user_id`
- `type` (SUMMARY_DONE, REMINDER_SENT, JOB_FAILED, …)
- `title`, `message`, `payload jsonb`
- `status` (unread/read)
- `created_at`

### Entrega a UI (elige 1 para MVP)

- **Polling**: `GET /notifications?since=...` cada 5–15s (fácil).
- **SSE**: `GET /notifications/stream` (más “pro” sin infra extra).
- WebSocket: más complejo (no necesario para MVP).

---

## 10) API (contratos recomendados)

Basado en el esqueleto de endpoints sugerido en el diseño, extendido a tu dominio. fileciteturn1file15

### Auth

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET  /api/auth/me`

### Topics

- `GET /api/topics`
- `POST /api/topics`
- `PATCH /api/topics/:id`
- `DELETE /api/topics/:id`

### Entries (tasks/notes)

- `GET /api/entries?date=YYYY-MM-DD`
- `POST /api/entries`
- `PATCH /api/entries/:id`
- `DELETE /api/entries/:id`
- `POST /api/entries/:id/summarize`
- `POST /api/entries/:id/classify-topic` _(si decides endpoint explícito)_

### Attachments

- `POST /api/attachments/init`
- `POST /api/attachments/complete`
- `DELETE /api/attachments/:id`
- `GET /api/attachments/:id/download` _(presigned GET)_

### Reminders

- `POST /api/reminders`
- `PATCH /api/reminders/:id` _(reprogramar/cancelar)_
- `DELETE /api/reminders/:id`

### Notifications

- `GET /api/notifications`
- `POST /api/notifications/:id/read`
- `GET /api/notifications/stream` _(si SSE)_

---

## 11) Seguridad (puntos no negociables)

Del diseño: evitar localStorage/sessionStorage para tokens y preferir cookies httpOnly. fileciteturn1file0

### JWT access/refresh + cookies httpOnly (recomendado)

- Cookies:
  - `httpOnly: true`
  - `secure: true` (prod)
  - `sameSite: Lax` (o Strict si no hay flows cross-site)
- Rotación de refresh y registro en BD (revocar, detectar reutilización).
- Access corto (ej. 15 min), refresh largo (ej. 7 días). fileciteturn1file10

### CSRF

- Con `SameSite=Lax/Strict` ya reduces mucho.
- Si en algún momento necesitas `SameSite=None`, añade CSRF token.

### AuthZ

- Cada endpoint valida `userId` propietario (401/403). fileciteturn1file0

### Webhooks n8n (muy importante)

- Todos los webhooks (callback de resumen, envío de avisos, etc.) deben ir firmados:
  - HMAC (`X-Signature`) con secret compartido
  - timestamp + nonce para evitar replay
- Rate limiting en endpoints sensibles (login, webhooks, summarize).

---

## 12) Workers, BullMQ y Redis (cómo se usa aquí)

- **Redis**: almacén rápido donde BullMQ guarda estado de colas y jobs.
- **BullMQ**: librería Node que ofrece colas, jobs con delay, reintentos, concurrencia.
- **Worker**: proceso aparte que “consume” jobs y ejecuta acciones (llamar a n8n, marcar en Postgres, etc.).

Colas sugeridas:

- `reminders` (delayed)
- `automations` (call n8n)
- `ai` (embeddings/clasificación)
- `maintenance` (cleanup uploads pendientes, reintentos, etc.)

---

## 13) Plan de implementación con TDD (por dónde empezar)

### Principio: construir vertical slices

En lugar de “hacer toda la arquitectura de golpe”, haces un caso de uso completo, con su test, y repites.

#### Orden recomendado (de más básico a más complejo)

1. **Domain**: Value Objects + Entities mínimas (UserId, EntryId, ISODate; Entry, Topic).
2. **Application**: Use cases + puertos + tests (mocks/in-memory).
3. **Infrastructure**: adaptadores reales (Prisma/Postgres, JWT, Redis/BullMQ).
4. **API**: route handlers finos que solo transforman HTTP ↔ DTO y llaman al use case.

### Slices concretas (MVP incremental)

1. **Auth (login/refresh/me)**
   - tests de Application: validar credenciales, emitir tokens, rotación refresh.
2. **Topics CRUD**
   - persiste topics por usuario.
3. **Entries CRUD + autosave**
   - `GET entries by date`, `PATCH entry`.
4. **Attachments (init/complete) + cuotas**
   - S3 presigned + contadores.
5. **Reminders + worker delayed + n8n webhook**
   - primer job real end-to-end.
6. **Summarize (n8n + callback + notification)**
   - notificaciones mínimas (poll).
7. **Auto topic (embedding + pgvector)**
   - primero síncrono; luego asíncrono si hace falta.

---

## 14) Preguntas abiertas (para cerrar antes de implementar algunas piezas)

1. **Editor rico**: ¿qué motor vas a usar (TipTap/Lexical/Slate) o es editor custom?
   - Esto decide el formato exacto de `entries.content`.
2. **Notificaciones**: ¿te vale polling en MVP, o quieres SSE desde el principio?
3. **Canal de avisos**: WhatsApp vía n8n (como dijiste) — ¿habrá también email/push?
4. **IA**: proveedor y estrategia de prompts/costes (Batch API, modelos, límites).
5. **Auth storage**: confirmación final de “cookies httpOnly” vs alternativa (menos recomendada).
   - Para seguridad, evita localStorage para tokens. fileciteturn1file10

---

## 15) Instrucciones operativas para la IA que construye el proyecto

- Mantener barreras Clean Architecture: Domain y Application sin dependencias de framework. fileciteturn1file6
- Respetar regla: **no imports entre features**; UI llama a Application, no a Infrastructure. fileciteturn1file2
- No guardar tokens en localStorage/sessionStorage. fileciteturn1file0
- Mantener `pnpm` como package manager del proyecto. fileciteturn1file17
- Tests primero (TDD) en Domain/Application; integración después.

---

**Fin del documento.**
