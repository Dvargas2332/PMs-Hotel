# PMS Print Agent (Windows)

Small local service that runs on the **PC that has the printers** (USB or network printers installed in Windows) and exposes a local API for the web app to print.

## Why this exists
Browsers cannot access local printers directly (without dialogs) reliably. A local agent bridges the gap.

## Install
1) Install Node.js LTS on the printer PC.
2) In this folder:
   - `npm install`
   - Copy `.env.example` to `.env` and edit values
   - `npm run start`

## Configuration
See `.env.example`.

Recommended defaults:
- Bind only to localhost unless you really need LAN access.
- Always set `PRINT_AGENT_API_KEY`.

## API
All requests must include header: `x-api-key: <API_KEY>`

API key value comes from `PRINT_AGENT_API_KEY`.

### `GET /health`
Returns `{ ok: true }`

### `GET /printers`
Lists Windows printers (from `Get-Printer`).

### `POST /print`
Creates a print job.

Body:
```json
{
  "printerName": "EPSON TM-T20II",
  "mode": "text",
  "text": "Hello\\nWorld",
  "copies": 1
}
```

Modes:
- `text`: uses PowerShell `Out-Printer` (works with any Windows printer driver; formatting is basic).
- `file`: prints a temp file using Windows `PrintTo` verb (works if the file extension is associated with a printing-capable app on that PC).

## Notes
- For true thermal/ESC/POS raw printing, we can add a dedicated raw channel later.
- This agent is intentionally isolated from the backend/frontend modules.
