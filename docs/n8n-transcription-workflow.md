# n8n Workflow: YouTube Video Transcription

## Overview

This workflow handles async YouTube video transcription requests.
It receives a webhook from the Neuraal app (via BullMQ worker), calls an external transcription API, and posts the result back via a signed callback.

## Flow

```
Neuraal App → BullMQ Worker → n8n Webhook
                                    ↓
                           Extract YouTube URL
                                    ↓
                        Call Transcription API
                         (e.g. Supadata, AssemblyAI,
                          Whisper, or custom)
                                    ↓
                          Format transcription text
                                    ↓
                        POST callback to Neuraal
                        (HMAC signed, same as summary)
```

## Webhook Configuration

### 1. Trigger: Webhook Node

- **Method:** POST
- **Path:** `neuraal-entry-transcription`
- **Full URL:** `http://localhost:5678/webhook/neuraal-entry-transcription`
- **Authentication:** Header Auth (optional, if N8N_BASIC_AUTH is configured)
- **Response Mode:** "Using 'Respond to Webhook' Node" (NOT "Last Node")

### 2. Input Payload (from worker)

The webhook receives this JSON body:

```json
{
  "requestId": "uuid",
  "userId": "user-123",
  "entryId": "entry-456",
  "youtubeUrl": "https://www.youtube.com/watch?v=abc123",
  "callbackUrl": "http://host.docker.internal:3000/api/automations/entry-transcription/callback",
  "entryTitle": "My Video Note"
}
```

Plus HMAC headers:
- `X-Timestamp`: Unix timestamp (ms)
- `X-Signature`: HMAC-SHA256 of `{timestamp}.{body}` with N8N_WEBHOOK_SECRET

### 3. Transcription API Call

You can use any transcription service. Popular options:

#### Option A: Supadata (free tier available)
- API: `POST https://api.supadata.ai/v1/youtube/transcript`
- Body: `{ "url": "{{youtubeUrl}}", "lang": "en" }`
- Header: `x-api-key: YOUR_SUPADATA_KEY`

#### Option B: AssemblyAI
- Upload audio → transcribe → poll until done

#### Option C: Custom Whisper endpoint
- Extract audio from YouTube → send to Whisper API

### 4. Format Response

Process the API response to extract clean transcription text.

### 5. Callback: HTTP Request Node

**POST** to `{{callbackUrl}}` with:

```json
{
  "requestId": "{{requestId}}",
  "userId": "{{userId}}",
  "entryId": "{{entryId}}",
  "youtubeUrl": "{{youtubeUrl}}",
  "transcription": "The full transcription text..."
}
```

**Headers (HMAC signing):**

You need to compute the HMAC signature. Use a Code node before the callback:

```javascript
const crypto = require('crypto');
const secret = 'dev_secret_change_me_in_production'; // N8N_WEBHOOK_SECRET

const body = JSON.stringify({
  requestId: $json.requestId,
  userId: $json.userId,
  entryId: $json.entryId,
  youtubeUrl: $json.youtubeUrl,
  transcription: $json.transcription,
});

const timestamp = Date.now().toString();
const signature = crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}.${body}`)
  .digest('hex');

return {
  body,
  timestamp,
  signature,
};
```

Then in the HTTP Request node:
- **URL:** `{{callbackUrl}}`
- **Method:** POST
- **Headers:**
  - `Content-Type`: `application/json`
  - `X-Timestamp`: `{{timestamp}}`
  - `X-Signature`: `{{signature}}`
- **Body:** `{{body}}`

### 6. Respond to Webhook Node

After the callback is sent, use a "Respond to Webhook" node to acknowledge the original request:

```json
{
  "status": "ok",
  "requestId": "{{requestId}}"
}
```

## Environment Variables

Make sure these are set in your `.env`:

```bash
N8N_TRANSCRIPTION_WEBHOOK_URL="http://localhost:5678/webhook/neuraal-entry-transcription"
N8N_WEBHOOK_SECRET="dev_secret_change_me_in_production"
```

## Testing

1. Start the transcription worker: `pnpm worker:transcriptions`
2. Embed a YouTube video in a task/note
3. Click the "Transcribe" button
4. Check n8n execution log
5. Wait for the notification "Transcription Complete"
6. Refresh the entry — the transcription should appear below the video

## Error Handling

- If the transcription API fails, n8n should still respond to the webhook (to avoid timeouts)
- The BullMQ job has 3 retry attempts with exponential backoff
- Failed transcriptions create a "TRANSCRIPTION_FAILED" notification
