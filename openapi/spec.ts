/**
 * Neuraal OpenAPI 3.1 specification — single source of truth.
 *
 * ## How to use
 *
 * 1. Edit this file when endpoints change.
 * 2. Regenerate the JSON and TS types:
 *    ```bash
 *    pnpm openapi:generate
 *    ```
 * 3. The generated files are:
 *    - `openapi/openapi.json`            — served at GET /api/openapi.json
 *    - `src/shared/api/openapi-types.ts`  — typed paths, schemas, operations
 *
 * ## Auth
 *
 * Currently using `x-user-id` header (dev-only, temporary).
 * A `BearerAuth` security scheme is defined but not enforced yet.
 * When JWT auth is implemented, switch `security` entries from
 * `DevUserIdHeader` to `BearerAuth`.
 */

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Neuraal API",
    version: "0.1.0",
    description:
      "Backend API for Neuraal — task/note management with AI features (summaries, auto-topic classification).",
  },
  servers: [{ url: "http://localhost:3000", description: "Local development" }],

  tags: [
    { name: "Auth", description: "Authentication endpoints (register, login, refresh, logout, me, recover)" },
    { name: "Topics", description: "User topic/category management" },
    { name: "Entries", description: "Task and note entries" },
    { name: "Reminders", description: "Scheduled reminders for entries" },
    { name: "Notifications", description: "In-app notifications" },
    { name: "Automations", description: "Webhook callbacks (HMAC-authenticated)" },
    { name: "Embeddings", description: "Vector embeddings and auto-topic classification" },
    { name: "Attachments", description: "File attachments for entries" },
  ],

  // ---------------------------------------------------------------------------
  // Components
  // ---------------------------------------------------------------------------
  components: {
    securitySchemes: {
      CookieAuth: {
        type: "apiKey" as const,
        in: "cookie" as const,
        name: "access_token",
        description: "JWT access token sent as httpOnly cookie.",
      },
      DevUserIdHeader: {
        type: "apiKey" as const,
        in: "header" as const,
        name: "x-user-id",
        description:
          "Temporary dev-only auth. Sends a fixed user ID. Will be replaced by BearerAuth (JWT) in production.",
      },
      BearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token via Authorization header (alternative to cookie auth).",
      },
    },

    schemas: {
      // ----- Shared ---------------------------------------------------------
      UserResponse: {
        type: "object" as const,
        required: ["id", "email"],
        properties: {
          id: { type: "string" as const, format: "uuid" },
          email: { type: "string" as const, format: "email" },
        },
      },
      ErrorResponse: {
        type: "object" as const,
        required: ["error"],
        properties: {
          error: {
            type: "object" as const,
            required: ["code", "message"],
            properties: {
              code: { type: "string" as const, example: "NOT_FOUND" },
              message: { type: "string" as const, example: "Resource not found" },
              details: { type: "object" as const, description: "Optional extra data (e.g. RATE_LIMITED: remaining, resetAt)" },
            },
          },
        },
      },

      // ----- Topics ---------------------------------------------------------
      Topic: {
        type: "object" as const,
        required: ["id", "userId", "name", "color", "createdAt"],
        properties: {
          id: { type: "string" as const, format: "uuid" },
          userId: { type: "string" as const },
          name: { type: "string" as const, minLength: 2, maxLength: 50 },
          color: { type: "string" as const, pattern: "^#[0-9a-fA-F]{6}$", example: "#e11d48" },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },

      // ----- Entries --------------------------------------------------------
      Entry: {
        type: "object" as const,
        required: ["id", "userId", "date", "type", "title", "content", "version", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" as const, format: "uuid" },
          userId: { type: "string" as const },
          date: { type: "string" as const, pattern: String.raw`^\d{4}-\d{2}-\d{2}$`, example: "2025-06-15" },
          type: { type: "string" as const, enum: ["task", "note"] },
          title: { type: "string" as const, maxLength: 120 },
          content: { type: "object" as const, additionalProperties: true, description: "TipTap/ProseMirror JSON content" },
          topicId: { type: ["string", "null"] as const },
          completed: { type: ["boolean", "null"] as const, description: "null for notes" },
          version: { type: "integer" as const, minimum: 1 },
          sortOrder: { type: "integer" as const, minimum: 0, description: "Display order within a day. Lower values appear first." },
          createdAt: { type: "string" as const, format: "date-time" },
          updatedAt: { type: "string" as const, format: "date-time" },
          summary: { type: ["string", "null"] as const },
          summaryFormat: { type: ["string", "null"] as const, enum: ["markdown", "plain", null] },
          summaryUpdatedAt: { type: ["string", "null"] as const, format: "date-time" },
        },
      },

      // ----- Reminders ------------------------------------------------------
      Reminder: {
        type: "object" as const,
        required: ["id", "userId", "entryId", "scheduledAt", "channel", "status", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" as const, format: "uuid" },
          userId: { type: "string" as const },
          entryId: { type: "string" as const, format: "uuid" },
          scheduledAt: { type: "string" as const, format: "date-time" },
          channel: { type: "string" as const, enum: ["whatsapp", "email", "push", "sms"] },
          message: { type: ["string", "null"] as const, maxLength: 500 },
          status: { type: "string" as const, enum: ["pending", "sent", "canceled", "failed"] },
          createdAt: { type: "string" as const, format: "date-time" },
          updatedAt: { type: "string" as const, format: "date-time" },
        },
      },

      // ----- Notifications --------------------------------------------------
      Notification: {
        type: "object" as const,
        required: ["id", "userId", "type", "title", "message", "status", "createdAt"],
        properties: {
          id: { type: "string" as const, format: "uuid" },
          userId: { type: "string" as const },
          type: {
            type: "string" as const,
            enum: [
              "REMINDER_SENT",
              "REMINDER_FAILED",
              "REMINDER_CANCELED",
              "SUMMARY_IN_PROGRESS",
              "SUMMARY_DONE",
              "SUMMARY_FAILED",
            ],
          },
          title: { type: "string" as const, maxLength: 100 },
          message: { type: "string" as const, maxLength: 500 },
          status: { type: "string" as const, enum: ["unread", "read"] },
          payload: {
            type: ["object", "null"] as const,
            additionalProperties: true,
            description:
              "Dynamic payload. May contain entryId, requestId, score, etc. depending on notification type.",
          },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },

      // ----- Attachments ----------------------------------------------------
      Attachment: {
        type: "object" as const,
        required: ["id", "userId", "entryId", "storageKey", "filename", "mimeType", "sizeBytes", "kind", "status", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" as const, format: "uuid" },
          userId: { type: "string" as const },
          entryId: { type: "string" as const, format: "uuid" },
          storageKey: { type: "string" as const },
          filename: { type: "string" as const, maxLength: 255 },
          mimeType: { type: "string" as const, maxLength: 100 },
          sizeBytes: { type: "integer" as const },
          kind: { type: "string" as const, enum: ["inline", "file"] },
          status: { type: "string" as const, enum: ["pending", "ready", "deleted"] },
          createdAt: { type: "string" as const, format: "date-time" },
          updatedAt: { type: "string" as const, format: "date-time" },
        },
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Security (default for all endpoints — dev header)
  // ---------------------------------------------------------------------------
  security: [{ CookieAuth: [] }],

  // ---------------------------------------------------------------------------
  // Paths
  // ---------------------------------------------------------------------------
  paths: {
    // =====================================================================
    // Auth
    // =====================================================================
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        operationId: "registerUser",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["email", "password"],
                properties: {
                  email: { type: "string" as const, format: "email" },
                  password: { type: "string" as const, minLength: 8, maxLength: 128 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "User registered. Auth cookies set.",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["user"],
                  properties: { user: { $ref: "#/components/schemas/UserResponse" } },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "409": { $ref: "#/components/responses/Conflict" },
        },
      },
    },

    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        operationId: "loginUser",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["email", "password"],
                properties: {
                  email: { type: "string" as const, format: "email" },
                  password: { type: "string" as const },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful. Auth cookies set.",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["user"],
                  properties: { user: { $ref: "#/components/schemas/UserResponse" } },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        operationId: "refreshSession",
        description: "Uses the refresh_token cookie to issue new auth tokens. Old refresh token is rotated.",
        security: [],
        responses: {
          "200": {
            description: "Tokens refreshed. New cookies set.",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["ok"],
                  properties: { ok: { type: "boolean" as const } },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out (revoke tokens)",
        operationId: "logoutUser",
        security: [],
        responses: {
          "204": { description: "Logged out. Cookies cleared." },
        },
      },
    },

    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        operationId: "getMe",
        responses: {
          "200": {
            description: "Current user info",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["user"],
                  properties: { user: { $ref: "#/components/schemas/UserResponse" } },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/auth/recover": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset",
        operationId: "requestPasswordReset",
        description: "Always returns 200 to prevent email enumeration. If the email exists, a reset token is created (but email is not sent in MVP).",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["email"],
                properties: {
                  email: { type: "string" as const, format: "email" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Request processed (always succeeds)",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["ok"],
                  properties: { ok: { type: "boolean" as const } },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },

    // =====================================================================
    // Topics
    // =====================================================================
    "/api/topics": {
      get: {
        tags: ["Topics"],
        summary: "List user topics",
        operationId: "listTopics",
        responses: {
          "200": {
            description: "List of topics",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["topics"],
                  properties: {
                    topics: { type: "array" as const, items: { $ref: "#/components/schemas/Topic" } },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Topics"],
        summary: "Create a topic",
        operationId: "createTopic",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["name", "color"],
                properties: {
                  name: { type: "string" as const, minLength: 2, maxLength: 50 },
                  color: { type: "string" as const, pattern: "^#[0-9a-fA-F]{6}$" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Topic created",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["topic"],
                  properties: { topic: { $ref: "#/components/schemas/Topic" } },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "409": { $ref: "#/components/responses/Conflict" },
        },
      },
    },

    "/api/topics/{id}": {
      patch: {
        tags: ["Topics"],
        summary: "Update a topic",
        operationId: "updateTopic",
        parameters: [{ $ref: "#/components/parameters/ResourceId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                properties: {
                  name: { type: "string" as const, minLength: 2, maxLength: 50 },
                  color: { type: "string" as const, pattern: "^#[0-9a-fA-F]{6}$" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Topic updated",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["topic"],
                  properties: { topic: { $ref: "#/components/schemas/Topic" } },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { $ref: "#/components/responses/Conflict" },
        },
      },
      delete: {
        tags: ["Topics"],
        summary: "Delete a topic",
        operationId: "deleteTopic",
        parameters: [{ $ref: "#/components/parameters/ResourceId" }],
        responses: {
          "204": { description: "Topic deleted" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/topics/{id}/embedding/rebuild": {
      post: {
        tags: ["Embeddings"],
        summary: "Rebuild topic embedding",
        operationId: "rebuildTopicEmbedding",
        description: "Recalculates the embedding vector for a topic using Ollama. Useful after renaming.",
        parameters: [{ $ref: "#/components/parameters/ResourceId" }],
        responses: {
          "200": {
            description: "Embedding rebuilt",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["topicId", "embeddingUpdatedAt"],
                  properties: {
                    topicId: { type: "string" as const, format: "uuid" },
                    embeddingUpdatedAt: { type: "string" as const, format: "date-time" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    // =====================================================================
    // Entries
    // =====================================================================
    "/api/entries": {
      get: {
        tags: ["Entries"],
        summary: "List entries by date",
        operationId: "listEntries",
        parameters: [
          {
            name: "date",
            in: "query" as const,
            required: true,
            schema: { type: "string" as const, pattern: String.raw`^\d{4}-\d{2}-\d{2}$` },
            description: "Date in YYYY-MM-DD format",
          },
        ],
        responses: {
          "200": {
            description: "List of entries for the given date",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["entries"],
                  properties: {
                    entries: { type: "array" as const, items: { $ref: "#/components/schemas/Entry" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Entries"],
        summary: "Create an entry",
        operationId: "createEntry",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["date", "type", "title", "content"],
                properties: {
                  date: { type: "string" as const, pattern: String.raw`^\d{4}-\d{2}-\d{2}$` },
                  type: { type: "string" as const, enum: ["task", "note"] },
                  title: { type: "string" as const, maxLength: 120 },
                  content: { type: "object" as const, additionalProperties: true },
                  topicId: { type: ["string", "null"] as const },
                  completed: { type: "boolean" as const },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Entry created",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["entry"],
                  properties: { entry: { $ref: "#/components/schemas/Entry" } },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/entries/{id}": {
      patch: {
        tags: ["Entries"],
        summary: "Update an entry",
        operationId: "updateEntry",
        description: "Updates entry fields with optimistic concurrency (version check).",
        parameters: [{ $ref: "#/components/parameters/ResourceId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                properties: {
                  version: { type: "integer" as const, description: "Current version for optimistic concurrency" },
                  title: { type: "string" as const, maxLength: 120 },
                  content: { type: "object" as const, additionalProperties: true },
                  topicId: { type: ["string", "null"] as const },
                  completed: { type: "boolean" as const },
                  type: { type: "string" as const, enum: ["task", "note"], description: "Change entry type" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Entry updated",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["entry"],
                  properties: { entry: { $ref: "#/components/schemas/Entry" } },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { $ref: "#/components/responses/Conflict" },
        },
      },
      delete: {
        tags: ["Entries"],
        summary: "Delete an entry",
        operationId: "deleteEntry",
        parameters: [{ $ref: "#/components/parameters/ResourceId" }],
        responses: {
          "204": { description: "Entry deleted" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/entries/reorder": {
      patch: {
        tags: ["Entries"],
        summary: "Reorder entries for a date",
        operationId: "reorderEntries",
        description:
          "Bulk-updates sortOrder for all entries on a given date. The order of IDs in the array determines the new sort order (index 0 = first).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["date", "orderedIds"],
                properties: {
                  date: {
                    type: "string" as const,
                    pattern: String.raw`^\d{4}-\d{2}-\d{2}$`,
                    example: "2025-06-15",
                  },
                  orderedIds: {
                    type: "array" as const,
                    items: { type: "string" as const, format: "uuid" },
                    description:
                      "Entry IDs in desired display order (index 0 = first).",
                  },
                },
              },
            },
          },
        },
        responses: {
          "204": { description: "Entries reordered successfully" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/entries/{id}/summarize": {
      post: {
        tags: ["Entries"],
        summary: "Request entry summary (async)",
        operationId: "requestEntrySummary",
        description:
          "Enqueues an async AI summary generation. Subject to guardrails: rate limit (429), monthly quota (403), concurrency (409), max input (400). Returns 202 Accepted when accepted.",
        parameters: [{ $ref: "#/components/parameters/ResourceId" }],
        responses: {
          "202": {
            description: "Summary generation started",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["requestId", "notificationId", "message"],
                  properties: {
                    requestId: { type: "string" as const, format: "uuid" },
                    notificationId: { type: "string" as const, format: "uuid" },
                    message: { type: "string" as const },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation or INPUT_TOO_LARGE (max input chars exceeded)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": {
            description: "QUOTA_EXCEEDED — monthly summary limit reached",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": {
            description: "CONCURRENCY_LIMIT — another summary already in progress for this entry or user",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "429": {
            description: "RATE_LIMITED — too many requests (details may include remaining, resetAt)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },

    "/api/ai/usage": {
      get: {
        tags: ["Entries"],
        summary: "Get AI usage and limits",
        operationId: "getAiUsage",
        description: "Returns current usage and limits for the authenticated user (e.g. summaries per month).",
        parameters: [
          { name: "action", in: "query" as const, schema: { type: "string" as const, enum: ["SUMMARY"], default: "SUMMARY" }, description: "AI action type" },
          { name: "month", in: "query" as const, schema: { type: "string" as const, pattern: "^\\d{4}-(0[1-9]|1[0-2])$", example: "2026-02" }, description: "Month key YYYY-MM (default: current)" },
        ],
        responses: {
          "200": {
            description: "Usage and limits",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["action", "month", "requestsUsed", "requestsLimit", "tokensUsed", "tokensLimit", "maxActivePerUser", "rateLimitPerMinute", "maxInputChars"],
                  properties: {
                    action: { type: "string" as const, example: "SUMMARY" },
                    month: { type: "string" as const, example: "2026-02" },
                    requestsUsed: { type: "integer" as const, minimum: 0 },
                    requestsLimit: { type: "integer" as const, minimum: 0 },
                    tokensUsed: { type: "integer" as const, minimum: 0 },
                    tokensLimit: { type: "integer" as const, minimum: 0 },
                    maxActivePerUser: { type: "integer" as const, minimum: 1 },
                    rateLimitPerMinute: { type: "integer" as const, minimum: 1 },
                    maxInputChars: { type: "integer" as const, minimum: 1 },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/entries/{id}/auto-topic": {
      post: {
        tags: ["Embeddings"],
        summary: "Auto-assign topic to entry",
        operationId: "autoAssignTopic",
        description:
          "Generates an embedding for the entry text, finds the best matching topic by cosine similarity, and assigns it if the score meets the threshold.",
        parameters: [{ $ref: "#/components/parameters/ResourceId" }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                properties: {
                  threshold: {
                    type: "number" as const,
                    minimum: 0,
                    maximum: 1,
                    description: "Similarity threshold (default 0.35). Higher = stricter.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Auto-topic result",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["entryId", "selectedTopicId", "score"],
                  properties: {
                    entryId: { type: "string" as const, format: "uuid" },
                    selectedTopicId: { type: ["string", "null"] as const, format: "uuid" },
                    score: { type: ["number", "null"] as const, description: "Similarity score 0..1" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/entries/{id}/attachments": {
      get: {
        tags: ["Attachments"],
        summary: "List attachments for an entry",
        operationId: "listEntryAttachments",
        parameters: [{ $ref: "#/components/parameters/ResourceId" }],
        responses: {
          "200": {
            description: "List of attachments with usage/quota info",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["attachments", "usage"],
                  properties: {
                    attachments: {
                      type: "array" as const,
                      items: { $ref: "#/components/schemas/Attachment" },
                    },
                    usage: {
                      type: "object" as const,
                      required: [
                        "entryBytesUsed",
                        "entryLimitBytes",
                        "userBytesUsed",
                        "userLimitBytes",
                      ],
                      properties: {
                        entryBytesUsed: { type: "integer" as const },
                        entryLimitBytes: { type: "integer" as const },
                        userBytesUsed: { type: "integer" as const },
                        userLimitBytes: { type: "integer" as const },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // =====================================================================
    // Reminders
    // =====================================================================
    "/api/reminders": {
      post: {
        tags: ["Reminders"],
        summary: "Create a reminder",
        operationId: "createReminder",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["entryId", "scheduledAt", "channel"],
                properties: {
                  entryId: { type: "string" as const, format: "uuid" },
                  scheduledAt: { type: "string" as const, format: "date-time" },
                  channel: { type: "string" as const, enum: ["whatsapp", "email", "push", "sms"] },
                  message: { type: ["string", "null"] as const, maxLength: 500 },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Reminder created",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["reminder"],
                  properties: { reminder: { $ref: "#/components/schemas/Reminder" } },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { $ref: "#/components/responses/Conflict" },
        },
      },
    },

    "/api/reminders/{id}": {
      patch: {
        tags: ["Reminders"],
        summary: "Update a reminder",
        operationId: "updateReminder",
        parameters: [{ $ref: "#/components/parameters/ResourceId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                properties: {
                  scheduledAt: { type: "string" as const, format: "date-time" },
                  channel: { type: "string" as const, enum: ["whatsapp", "email", "push", "sms"] },
                  message: { type: ["string", "null"] as const, maxLength: 500 },
                  status: { type: "string" as const, enum: ["canceled"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Reminder updated",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["reminder"],
                  properties: { reminder: { $ref: "#/components/schemas/Reminder" } },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { $ref: "#/components/responses/Conflict" },
        },
      },
    },

    // =====================================================================
    // Notifications
    // =====================================================================
    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List notifications",
        operationId: "listNotifications",
        parameters: [
          {
            name: "since",
            in: "query" as const,
            required: false,
            schema: { type: "string" as const, format: "date-time" },
            description: "Filter notifications created after this ISO datetime",
          },
        ],
        responses: {
          "200": {
            description: "List of notifications",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["notifications"],
                  properties: {
                    notifications: {
                      type: "array" as const,
                      items: { $ref: "#/components/schemas/Notification" },
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/notifications/{id}/read": {
      post: {
        tags: ["Notifications"],
        summary: "Mark notification as read",
        operationId: "markNotificationRead",
        parameters: [{ $ref: "#/components/parameters/ResourceId" }],
        responses: {
          "200": {
            description: "Notification marked as read",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["success"],
                  properties: { success: { type: "boolean" as const } },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // =====================================================================
    // Automations (HMAC callbacks — no x-user-id)
    // =====================================================================
    "/api/automations/entry-summary/callback": {
      post: {
        tags: ["Automations"],
        summary: "Entry summary callback (from n8n)",
        operationId: "entrySummaryCallback",
        description:
          "Callback endpoint for n8n to deliver AI-generated summaries. Authenticated via HMAC signature (NOT x-user-id).",
        security: [], // No default auth — uses HMAC headers
        parameters: [
          {
            name: "X-Timestamp",
            in: "header" as const,
            required: true,
            schema: { type: "string" as const },
            description: "Unix timestamp in ms used for HMAC computation",
          },
          {
            name: "X-Signature",
            in: "header" as const,
            required: true,
            schema: { type: "string" as const },
            description: "HMAC-SHA256 signature: hmac(secret, timestamp + '.' + rawBody)",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["requestId", "userId", "entryId", "summary", "format"],
                properties: {
                  requestId: { type: "string" as const, format: "uuid" },
                  userId: { type: "string" as const },
                  entryId: { type: "string" as const, format: "uuid" },
                  summary: { type: "string" as const },
                  format: { type: "string" as const, enum: ["markdown", "plain"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Summary processed",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["success"],
                  properties: {
                    success: { type: "boolean" as const },
                    alreadyProcessed: { type: "boolean" as const },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    // =====================================================================
    // Attachments
    // =====================================================================
    "/api/attachments/init": {
      post: {
        tags: ["Attachments"],
        summary: "Initialize attachment upload",
        operationId: "initAttachmentUpload",
        description: "Creates an attachment record and returns a presigned PUT URL for uploading.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["entryId", "filename", "mimeType", "sizeBytes", "kind"],
                properties: {
                  entryId: { type: "string" as const, format: "uuid" },
                  filename: { type: "string" as const, maxLength: 255 },
                  mimeType: { type: "string" as const, maxLength: 100 },
                  sizeBytes: { type: "integer" as const },
                  kind: { type: "string" as const, enum: ["inline", "file"] },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Upload initialized",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["attachment", "presignedPutUrl"],
                  properties: {
                    attachment: { $ref: "#/components/schemas/Attachment" },
                    presignedPutUrl: { type: "string" as const, format: "uri" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "413": {
            description: "Quota exceeded",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },

    "/api/attachments/complete": {
      post: {
        tags: ["Attachments"],
        summary: "Complete attachment upload",
        operationId: "completeAttachmentUpload",
        description: "Marks an attachment as ready after successful upload to S3.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object" as const,
                required: ["attachmentId"],
                properties: {
                  attachmentId: { type: "string" as const, format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Attachment marked as ready",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["attachment"],
                  properties: { attachment: { $ref: "#/components/schemas/Attachment" } },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/attachments/{id}": {
      delete: {
        tags: ["Attachments"],
        summary: "Delete an attachment",
        operationId: "deleteAttachment",
        parameters: [{ $ref: "#/components/parameters/ResourceId" }],
        responses: {
          "204": { description: "Attachment deleted" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/attachments/{id}/download": {
      get: {
        tags: ["Attachments"],
        summary: "Get attachment download URL",
        operationId: "getAttachmentDownloadUrl",
        parameters: [{ $ref: "#/components/parameters/ResourceId" }],
        responses: {
          "200": {
            description: "Presigned download URL",
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  required: ["presignedGetUrl"],
                  properties: {
                    presignedGetUrl: { type: "string" as const, format: "uri" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Reusable response/parameter refs (injected into components after definition)
// ---------------------------------------------------------------------------

// TypeScript doesn't allow forward-refs in the literal, so we add them here.
const withRefs = {
  ...spec,
  components: {
    ...spec.components,
    responses: {
      BadRequest: {
        description: "Validation error",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      Unauthorized: {
        description: "Authentication required",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      NotFound: {
        description: "Resource not found",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      Conflict: {
        description: "Conflict (duplicate or version mismatch)",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      Forbidden: {
        description: "Forbidden (e.g. quota exceeded)",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      RateLimited: {
        description: "Too many requests (rate limit)",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      InternalError: {
        description: "Internal server error",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
    },
    parameters: {
      ResourceId: {
        name: "id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const, format: "uuid" },
        description: "Resource UUID",
      },
    },
  },
};

export default withRefs;
