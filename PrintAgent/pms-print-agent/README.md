# Kazehana Print (Windows)

Small local service that runs on the **PC that has the printers** (USB or network printers installed in Windows) and exposes a local API for the web app to print.

## Why this exists
Browsers cannot access local printers directly (without dialogs) reliably. A local agent bridges the gap.

## Install
1) Install Node.js LTS on the printer PC.
2) In this folder:
   - `npm install`
   - Copy `.env.example` to `.env` and edit values
   - `npm run start`

### First run (EXE)
When running the compiled EXE, if no config exists yet, the agent auto-creates:
- `.env` (with a generated `PRINT_AGENT_API_KEY`)
- `pms-print-agent.config.json` (stores generated keys + allowed printers per key)

By default, these files are stored in `%APPDATA%\\PMS Print Agent\\`.

## Configuration
See `.env.example`.

Recommended defaults:
- Bind only to localhost unless you really need LAN access.
- Always set `PRINT_AGENT_API_KEY`.

## API
All requests must include header: `x-api-key: <API_KEY>`

API key value comes from `PRINT_AGENT_API_KEY`.

## Local UI (Key/Printer manager)
Open from the same PC:
- `http://127.0.0.1:8787/ui`

From there you can:
- Generate API keys
- See existing keys
- Restrict which printers each key can use

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
