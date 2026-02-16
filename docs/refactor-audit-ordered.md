# Auditoría de refactoring con SonarJS — archivos ordenados por complejidad

**Estado:** ESLint + `eslint-plugin-sonarjs` instalado y configurado.  
**Reglas activas:** `cognitive-complexity` (15), `no-duplicate-string` (threshold 3), `no-identical-functions`, `no-nested-conditional` (warn).  
**Total actual:** 145 problemas (140 errors, 5 warnings).

Orden: **de menor a mayor complejidad** (arriba = más fácil; abajo = más complejo).

### Regla: no-duplicate-string no se corrige

**No se corregirá** la regla `sonarjs/no-duplicate-string` en ningún archivo del proyecto (ni tests ni producción). Los avisos de esta regla se aceptan como están; no extraer constantes para literales duplicados.

---

## Resumen por tipo de problema

| Tipo                            | Cantidad                        | Acción típica                                                      |
| ------------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `sonarjs/no-duplicate-string`   | ~135 errores en muchos archivos | Extraer constantes (p. ej. en test: `TEST_USER_ID`, `"/api/..."`)  |
| `sonarjs/cognitive-complexity`  | 5 errores                       | Refactorizar función: extraer helpers, early return, reducir ramas |
| `sonarjs/no-nested-conditional` | 5 warnings                      | Sustituir ternario anidado por variable o función                  |

---

## 1. Baja complejidad (arreglos rápidos)

Solo **no-duplicate-string** con pocas ocurrencias por archivo, o **1 warning** de ternario. Ideal para ir de varios en un mismo PR.

### 1.1 Un solo error no-duplicate-string (o 2 en mismo archivo)

| Archivo                                                             | Línea(s) | Nota                      |
| ------------------------------------------------------------------- | -------- | ------------------------- |
| `src/app/api/attachments/init/route.test.ts`                        | 60       | Literal duplicado 5 veces |
| `src/app/api/entries/[id]/attachments/route.test.ts`                | 47       | 3 veces                   |
| `src/app/api/auth/me/route.test.ts`                                 | 36       | 3 veces                   |
| `src/app/api/auth/refresh/route.test.ts`                            | 44       | 3 veces                   |
| `src/app/api/metrics/route.test.ts`                                 | 25       | 3 veces                   |
| `src/app/api/notifications/[id]/read/route.test.ts`                 | 37       | 3 veces                   |
| `src/app/api/topics/[id]/embedding/rebuild/route.test.ts`           | 46       | 3 veces                   |
| `src/app/api/entries/[id]/summary/route.test.ts`                    | 35       | 3 veces                   |
| `src/application/use-cases/ai/ConsumeAiRequest.test.ts`             | 10       | 3 veces                   |
| `src/application/use-cases/auth/RegisterUser.test.ts`               | 10       | 3 veces                   |
| `src/application/use-cases/notifications/ListNotifications.test.ts` | 37, 38   | 3–4 veces                 |
| `src/application/use-cases/ocr/ExtractImageText.test.ts`            | 86       | 3 veces                   |
| `src/domain/entities/Topic.test.ts`                                 | 12       | 3 veces                   |
| `src/domain/entities/Notification.test.ts`                          | 9, 10    | 3 veces                   |
| `src/features/calendar/components/VerticalCalendar.test.tsx`        | 33, 50   | 3 veces c/u               |
| `src/features/task-editor/components/TiptapEditor.test.tsx`         | 38       | 3 veces                   |
| `src/features/tasks-container/components/TasksContainer.test.tsx`   | 21, 355  | 3 veces                   |
| `src/features/topics/components/FloatingTopics.test.tsx`            | 69       | 4 veces                   |
| `src/features/topics/components/TopicsSection.test.tsx`             | 190, 466 | 3 veces                   |
| `src/features/weekly-recap/components/WeeklyRecap.test.tsx`         | 26       | 3 veces                   |
| `src/features/notifications/components/NotificationCenter.tsx`      | 69       | 3 veces (producción)      |
| `src/features/weekly-recap/components/WeeklyRecap.tsx`              | 75       | 3 veces (producción)      |

### 1.2 Warnings: ternario anidado (1 archivo con 1 warning)

| Archivo                               | Línea | Acción                                                                                      |
| ------------------------------------- | ----- | ------------------------------------------------------------------------------------------- |
| `src/app/api/reminders/[id]/route.ts` | 73    | Extraer `code === "NOT_FOUND" ? 404 : code === "CONFLICT" ? 409 : 400` a función o variable |

---

## 2. Complejidad media

Varios errores de **no-duplicate-string** en el mismo archivo, o **varios warnings** de ternario, o **cognitive-complexity** justo por encima del límite (17).

### 2.1 Ternarios anidados (varios en un archivo)

| Archivo                                                | Líneas   | Acción                                     |
| ------------------------------------------------------ | -------- | ------------------------------------------ |
| `src/features/topics/components/CreateTopicDialog.tsx` | 188, 251 | 2 warnings — extraer a variables o helpers |
| `src/features/topics/components/TopicsSection.tsx`     | 73, 74   | 2 warnings — igual                         |

### 2.2 Cognitive complexity 17 (reducir 2 puntos)

| Archivo                                           | Función/línea | Acción                                                |
| ------------------------------------------------- | ------------- | ----------------------------------------------------- |
| `src/app/api/entries/[id]/summarize/route.ts`     | 26            | Refactor POST handler: extraer validaciones o helpers |
| `src/application/use-cases/topics/UpdateTopic.ts` | 29            | Refactor use case: early return o extraer funciones   |

### 2.3 Varios no-duplicate-string en mismo archivo (producción)

| Archivo                                                  | Líneas                  | Nota                                    |
| -------------------------------------------------------- | ----------------------- | --------------------------------------- |
| `src/features/task-editor/components/TaskEditor.tsx`     | 266, 470, 472, 473, 953 | 5 errores — constantes de UI o mensajes |
| `src/features/task-editor/extensions/ImageAttachment.ts` | 111, 117, 118, 119      | 4 errores                               |
| `src/features/task-editor/extensions/YoutubeEmbed.ts`    | 168, 169, 170           | 3 errores                               |
| `src/features/calendar/components/VerticalCalendar.tsx`  | 114                     | 8 veces (producción)                    |

### 2.4 Tests con muchos no-duplicate-string

(Archivos con 3+ errores de literal; conviene agrupar constantes al inicio del test o en `test-helpers`.)

- `src/app/api/attachments/[id]/download/route.test.ts` (2)
- `src/app/api/attachments/[id]/route.test.ts` (3)
- `src/app/api/attachments/complete/route.test.ts` (2)
- `src/app/api/auth/login/route.test.ts`, `recover`, `register`
- `src/app/api/entries/[id]/route.test.ts` (2, uno 16 veces)
- `src/app/api/entries/[id]/summarize/route.test.ts`, `transcribe-youtube`, `transcription`
- `src/app/api/entries/route.test.ts` (4)
- `src/app/api/reminders/route.test.ts` (2), `reminders/[id]/route.test.ts`
- `src/app/api/automations/entry-summary/callback`, `entry-transcript`, `entry-transcription`
- `src/application/use-cases/attachments/InitAttachmentUpload.test.ts` (19 veces)
- `src/application/use-cases/auth/RefreshSession.ts` (producción), `RequestPasswordReset.test`
- `src/application/use-cases/entries/CreateEntry.test.ts`, `ListEntriesByDate.test.ts`, `ReorderEntries.test.ts`
- `src/application/use-cases/reminders/CreateReminder.test.ts`, `UpdateReminder.test.ts`
- `src/application/use-cases/summaries/HandleEntrySummaryCallback.test.ts`, `RequestEntrySummary.test.ts`
- `src/application/use-cases/topics/AutoAssignTopicToEntry.test.ts`
- `src/domain/entities/*.test.ts` (Attachment, Entry, Reminder, TranscriptionRequest, User)
- `src/domain/value-objects/*.test.ts` (Email, Filename, HexColor, ISODate, JwtAccessToken, MimeType, SummaryText, TokenExpiry)
- `src/features/attachments/components/AttachmentPanel.test.tsx`
- `src/features/dashboard/components/DashboardHeader.test.tsx`
- `src/features/notifications/components/NotificationCenter.test.tsx` (8 errores)
- `src/shared/api/apiClient.test.ts` (4 errores, uno 17 veces)

---

## 3. Alta complejidad (ir de uno en uno)

**Cognitive complexity** muy por encima de 15. Requieren refactor de función (extraer helpers, simplificar condicionales).

| #   | Archivo                                            | Complejidad | Línea | Acción                                                                                      |
| --- | -------------------------------------------------- | ----------- | ----- | ------------------------------------------------------------------------------------------- |
| 1   | `src/shared/api/apiClient.ts`                      | **44**      | 225   | Refactorizar función (p. ej. manejo de respuestas/errores): extraer funciones, early return |
| 2   | `src/shared/lib/extractPlainText.ts`               | **38**      | 26    | Refactorizar: extraer lógica por tipo de nodo, reducir ramas                                |
| 3   | `src/features/task-editor/hooks/useImageUpload.ts` | **23**      | 23    | Refactorizar hook: extraer handlers o helpers, reducir condicionales                        |

---

## Orden sugerido para corregir

1. **Primero (rápido):**
   - Unificar imports duplicados en `Dashboard.tsx` (`@/shared/store`).
   - Archivos de la sección **1.2** (un warning de ternario en `reminders/[id]/route.ts`).
   - Algunos de **1.1** (tests con 1–2 literales duplicados): elegir por carpeta (p. ej. solo `app/api/auth/*.test.ts`).

2. **Después:**
   - **2.1** (CreateTopicDialog, TopicsSection — ternarios).
   - **2.2** (summarize route, UpdateTopic — CC 17).
   - **2.3** (TaskEditor, ImageAttachment, YoutubeEmbed, VerticalCalendar — constantes en producción).

3. **Al final (uno por uno):**
   - **3** (apiClient.ts, extractPlainText.ts, useImageUpload.ts).

Cuando quieras, indica por cuál bloque o archivo empezar y se puede bajar a cambios concretos (parches o PRs).
