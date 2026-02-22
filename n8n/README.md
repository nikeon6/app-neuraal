# n8n Workflows

This folder contains exportable n8n workflow JSON files for the Neuraal automation layer.
All files are **EXAMPLE** templates with placeholder credentials that must be configured after import.

---

## Available Workflows

### 1. `Neuraal — Send Reminder - EXAMPLE.json`

Processes reminder delivery requests from the backend (via BullMQ worker).
Routes reminders to **Email** or **WhatsApp** based on the `channel` field.

**Trigger:** Webhook `POST /webhook/neuraal-send-reminder`
**Auth:** Basic Auth

#### Flow

```
Webhook → Switch (channel)
  ├─ email → Markdown→HTML (summary) → Build Email Params → Send Email (SMTP)
  └─ whatsapp → Build WhatsApp Params → Twilio HTTP Request
```

#### Incoming Payload

```json
{
  "reminderId": "uuid",
  "userId": "uuid",
  "entryId": "uuid",
  "scheduledAt": "2026-02-19T01:55:00.000Z",
  "channel": "email | whatsapp",
  "message": null,
  "entryTitle": "Task title",
  "entrySummary": "## Markdown summary...",
  "userEmail": "user@example.com",
  "userPhoneNumber": "+34600000000"
}
```

#### Nodes

| Node                           | Purpose                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| **Webhook: Receive Reminder**  | Entry point. Basic Auth protected.                             |
| **Switch: Channel**            | Routes to `email` or `whatsapp` branch.                        |
| **Markdown**                   | Converts `entrySummary` (Markdown) to HTML for the email body. |
| **Set: Build Email Params**    | Prepares `to`, `subject`, `body` (HTML) fields.                |
| **Send an Email**              | Sends email via SMTP. Replace credentials with your provider.  |
| **Set: Build WhatsApp Params** | Prepares `phone`, `entryTitle` fields.                         |
| **Whatsapp (HTTP Request)**    | Sends WhatsApp message via Twilio API.                         |

---

### 2. `neuraal-entry-summary - EXAMPLE.json`

Generates a structured summary of an entry's content using an LLM.
Responds immediately to the caller (async), processes in background, then sends the result back via HMAC-signed callback.

**Trigger:** Webhook `POST /webhook/<your-path>`
**Auth:** None on webhook (HMAC on callback)

#### Flow

```
Webhook → Respond 200 → Extract Text (Code) → AI Agent (LLM) → Sign Callback (HMAC) → HTTP Request (callback)
```

#### Incoming Payload

```json
{
  "requestId": "uuid",
  "userId": "uuid",
  "entryId": "uuid",
  "callbackUrl": "http://host.docker.internal:3000/api/automations/entry-summary/callback",
  "entryTitle": "Task title",
  "entryType": "task",
  "entryContent": { "type": "doc", "content": [...] }
}
```

#### Callback Payload (sent back to the app)

```json
{
  "requestId": "uuid",
  "userId": "uuid",
  "entryId": "uuid",
  "summary": "## Structured Markdown summary...",
  "format": "markdown"
}
```

#### Nodes

| Node                     | Purpose                                                                       |
| ------------------------ | ----------------------------------------------------------------------------- |
| **Webhook**              | Entry point. Receives entry content from BullMQ worker.                       |
| **Respond to Webhook**   | Returns `200 { status: "accepted" }` immediately (async processing).          |
| **Extract text**         | Code node: extracts plain text from TipTap/ProseMirror JSON content.          |
| **AI Agent**             | Sends text to LLM with system prompt for summarization and structuring.       |
| **OpenAI Chat Model**    | Primary LLM (GPT). Connected as main language model.                          |
| **Anthropic Chat Model** | Fallback LLM (Claude Sonnet). Connected as fallback language model.           |
| **Signature callback**   | Code node: builds callback body and generates HMAC-SHA256 signature.          |
| **HTTP Request**         | Sends signed callback to the app API (`X-Timestamp` + `X-Signature` headers). |

---

### 3. `neuraal-entry-transcription - EXAMPLE.json`

Transcribes a YouTube video embedded in an entry, then formats the transcript with an LLM.
Responds immediately, processes in background, then sends the result back via HMAC-signed callback.

**Trigger:** Webhook `POST /webhook/<your-path>`
**Auth:** None on webhook (HMAC on callback)

#### Flow

```
Webhook → Respond 200 → Supadata (get transcript) → AI Agent (LLM) → Sign Callback (HMAC) → HTTP Request (callback)
```

#### Incoming Payload

```json
{
  "requestId": "uuid",
  "userId": "uuid",
  "entryId": "uuid",
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "callbackUrl": "http://host.docker.internal:3000/api/automations/entry-transcription/callback",
  "entryTitle": "Entry title"
}
```

#### Callback Payload (sent back to the app)

```json
{
  "requestId": "uuid",
  "userId": "uuid",
  "entryId": "uuid",
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "transcription": "## Formatted Markdown transcription..."
}
```

#### Nodes

| Node                     | Purpose                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------- |
| **Webhook**              | Entry point. Receives transcription request from BullMQ worker.                       |
| **Respond to Webhook**   | Returns `200 { status: "ok", requestId }` immediately.                                |
| **Get transcript**       | Supadata node: fetches raw YouTube transcript via Supadata API.                       |
| **AI Agent**             | Sends raw transcript to LLM for punctuation correction and Markdown structuring.      |
| **OpenAI Chat Model**    | Primary LLM (GPT). Connected as main language model.                                  |
| **Anthropic Chat Model** | Fallback LLM (Claude Sonnet). Connected as fallback language model.                   |
| **Signature callback**   | Code node: builds callback body and generates HMAC-SHA256 signature.                  |
| **HTTP Request**         | Sends signed callback to the app API (`X-Timestamp` + `X-Signature` headers, 60s TO). |

---

## How to Import

1. Open n8n UI at `http://localhost:5678`
2. Go to **Workflows** > click the **"..."** menu > **Import from File**
3. Select the desired workflow JSON file
4. The workflow will appear in your list — rename and configure before activating

---

## Setup After Import

### Common: HMAC Callback Secret

The summary and transcription workflows sign their callbacks with HMAC-SHA256.
The secret is read from the n8n environment variable `N8N_WEBHOOK_SECRET`.

- Must match the `HMAC_WEBHOOK_SECRET` configured in the app's `.env`
- Default (dev only): `dev_secret_change_me_in_production`

### Common: Docker Networking

When running n8n inside Docker, callback URLs pointing to `localhost` are automatically
rewritten to `host.docker.internal` by the Code nodes. No manual change needed.

### 1. Send Reminder — SMTP Credential

1. Create an **SMTP** credential in n8n with your email provider settings
2. Link it to the **Send an Email** node
3. Update `fromEmail` in the node to your sender address

### 2. Send Reminder — Twilio (WhatsApp)

1. Get your **Account SID** and **Auth Token** from [Twilio Console](https://console.twilio.com/)
2. Create an **HTTP Basic Auth** credential in n8n (SID as user, token as password)
3. Update the Twilio Account URL in the **Whatsapp (HTTP Request)** node
4. Update `ContentSid` with your approved WhatsApp template ID
5. Update the `From` phone number with your Twilio WhatsApp sender

### 3. Entry Summary — LLM Credentials

1. Create an **OpenAI API** credential (primary model)
2. Optionally create an **Anthropic API** credential (fallback model)
3. Link them to the respective Chat Model nodes
4. Adjust `maxTokens` if needed (default: 650)

### 4. Entry Transcription — Supadata + LLM Credentials

1. Create a **Supadata API** credential for YouTube transcript fetching
2. Create **OpenAI** and optionally **Anthropic** credentials (same as summary)
3. Link them to the respective nodes
4. Adjust `maxTokens` if needed (default: 30000 for long videos)

### 5. Webhook Paths

- **Send Reminder**: path is fixed as `neuraal-send-reminder`
- **Summary & Transcription**: paths are set to placeholder values (`YOUR_PATH` / UUID).
  Update them to match the URLs configured in the app's environment variables
  (`N8N_SUMMARY_WEBHOOK_URL`, `N8N_TRANSCRIPTION_WEBHOOK_URL`)

---

## Dev Placeholders

These values are hardcoded in the EXAMPLE files and must be replaced for production:

| Value              | Workflow      | Location                     | Default / Placeholder                |
| ------------------ | ------------- | ---------------------------- | ------------------------------------ |
| SMTP credentials   | Send Reminder | Send an Email node           | `your_emaill@email.com`              |
| Twilio Account URL | Send Reminder | Whatsapp HTTP Request node   | `YOUR_ACCOUNT`                       |
| Twilio From number | Send Reminder | Whatsapp HTTP Request node   | `+3600000000`                        |
| Template ID        | Send Reminder | Whatsapp HTTP Request node   | `ID_TEMPLATE`                        |
| Webhook path       | Summary       | Webhook node                 | `YOUR_PATH`                          |
| OpenAI API key     | Summary / Tx  | OpenAI Chat Model credential | _(configure in n8n credentials)_     |
| Anthropic API key  | Summary / Tx  | Anthropic credential         | _(configure in n8n credentials)_     |
| Supadata API key   | Transcription | Supadata credential          | _(configure in n8n credentials)_     |
| HMAC secret        | Summary / Tx  | n8n env `N8N_WEBHOOK_SECRET` | `dev_secret_change_me_in_production` |
