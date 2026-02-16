# n8n Workflows

This folder contains exportable n8n workflow JSON files for the Neuraal automation layer.

## Available Workflows

### `workflows/neuraal-send-reminder.json`

Processes reminder delivery requests from the backend (via BullMQ worker).  
Routes reminders to **Email** or **WhatsApp** based on the `channel` field.

**Trigger:** Webhook `POST /webhook/neuraal-send-reminder`  
**Auth:** Basic Auth (configured in `.env` as `N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD`)

#### Incoming Payload

```json
{
  "reminderId": "uuid",
  "userId": "user-123",
  "entryId": "uuid",
  "scheduledAt": "2026-01-29T10:00:00.000Z",
  "channel": "email | whatsapp",
  "message": "Optional reminder message"
}
```

#### Nodes

| Node | Purpose |
|------|---------|
| **Webhook: Receive Reminder** | Entry point. Basic Auth protected. |
| **Switch: Channel** | Routes to `email` or `whatsapp` branch. |
| **Set: Build Email Params** | Prepares `to`, `subject`, `body` fields. |
| **Email Placeholder (replace me)** | No-Op placeholder. Replace with your email provider (Gmail, SMTP, SendGrid, Resend, etc.). |
| **Set: Build WhatsApp Params** | Prepares `phone`, `messageText` fields. |
| **WhatsApp Business API** | HTTP Request to Meta WhatsApp Business Cloud API. |
| **Respond: 200 OK** | Returns `{ success: true }` to the backend. |

---

## How to Import

1. Open n8n UI at `http://localhost:5678`
2. Go to **Workflows** > click the **"..."** menu > **Import from File**
3. Select `workflows/neuraal-send-reminder.json`
4. The workflow will appear in your list

## Setup After Import

### 1. Basic Auth Credential

Create an **HTTP Basic Auth** credential in n8n:
- **User:** `neuraal`
- **Password:** `neuraal_password`
- Link it to the **Webhook: Receive Reminder** node

### 2. Email (placeholder)

The email branch uses a **No-Op placeholder** node. Replace it with your chosen provider:
- **Gmail:** Use the Gmail node with OAuth2
- **SMTP:** Use the Send Email node with SMTP credentials
- **SendGrid / Resend:** Use the HTTP Request node with API key

The previous **Set: Build Email Params** node provides `to`, `subject`, and `body` (HTML) fields.

### 3. WhatsApp Business API

1. Get your **Phone Number ID** and **Access Token** from [Meta Business](https://business.facebook.com/)
2. Replace `YOUR_PHONE_NUMBER_ID` in the HTTP Request URL
3. Create an **Header Auth** credential in n8n:
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer YOUR_ACCESS_TOKEN`
4. Link it to the **WhatsApp Business API** node
5. Update the hardcoded phone number (`+34600000000`) in **Set: Build WhatsApp Params** with your test number

### 4. Activate

Toggle the workflow to **Active** so the webhook starts listening.

---

## Dev Placeholders

These values are hardcoded for local development and must be changed for production:

| Value | Location | Default |
|-------|----------|---------|
| Email recipient | Set: Build Email Params > `to` | `dev@example.com` |
| WhatsApp phone | Set: Build WhatsApp Params > `phone` | `+34600000000` |
| Phone Number ID | WhatsApp Business API > URL | `YOUR_PHONE_NUMBER_ID` |
| Access Token | n8n credential | `YOUR_ACCESS_TOKEN` |
