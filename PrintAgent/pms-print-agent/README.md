# PMS Print Agent (Windows)

Agente de impresion para Windows que recibe trabajos desde AWS por WebSocket y los imprime en impresoras locales o de red.

**Licencia:** Codigo propietario de Diego Alonso Vargas Almengor. Todos los derechos reservados.
No se permite uso, copia, modificacion, distribucion o despliegue sin autorizacion previa y por escrito.
Para licenciamiento o compra: `vargas.almengor@gmail.com`.

**Soporta**
- ESC/POS (termicas 80/58/54mm) enviando bytes RAW.
- PDF listo.
- HTML o plantillas que el agente convierte a PDF con Chromium.

## Requisitos
- Windows 10/11.
- Chrome o Edge instalado (para HTML -> PDF).
- SumatraPDF para imprimir PDF.

## Configuracion
1. Copia `.env.example` a `.env` y completa las variables.
2. Define `PRINT_AGENT_WS_URL` y `PRINT_AGENT_API_KEY`.
3. Si usas Sumatra, coloca `tools\SumatraPDF.exe` o define `PRINT_AGENT_SUMATRA_PATH`.
4. Si solo quieres la UI local sin AWS, puedes poner `PRINT_AGENT_ENABLE_WS=false`.

## Ejecutar
```powershell
# desarrollo
 go run .\cmd\print-agent
```

## Compilar
```powershell
go build -o dist\print-agent.exe .\cmd\print-agent
```

## Servicio Windows
El instalador puede crear el servicio `PMSPrintAgent`. Si lo haces manual:
```powershell
sc.exe create PMSPrintAgent binPath= "C:\Program Files\PMSPrintAgent\print-agent.exe" start= auto
sc.exe start PMSPrintAgent
```

## Interfaz visual (local)
Abre `http://127.0.0.1:8787/` para ver estado y lista de impresoras.

## API local (salud y impresoras)
- `GET http://127.0.0.1:8787/health`
- `GET http://127.0.0.1:8787/printers`

## API local (configuracion y pruebas)
- `GET http://127.0.0.1:8787/api/status`
- `GET http://127.0.0.1:8787/api/printers`
- `POST http://127.0.0.1:8787/api/printers/map`
- `DELETE http://127.0.0.1:8787/api/printers/map?alias=BAR`
- `POST http://127.0.0.1:8787/api/print/test`
- `POST http://127.0.0.1:8787/api/job`
- `GET http://127.0.0.1:8787/api/logs`
- `GET http://127.0.0.1:8787/api/keys`
- `POST http://127.0.0.1:8787/api/keys/ensure`
- `POST http://127.0.0.1:8787/api/keys/rotate`

Si defines `PRINT_AGENT_LOCAL_API_KEY`, debes enviar `X-API-Key` o `Authorization: Bearer`.

### Mapear impresora (alias)
```json
{ "alias": "BAR", "printer_name": "EPSON TM-T20II", "mode": "escpos" }
```

### Prueba de impresion
```json
{ "target": "BAR", "target_type": "alias", "kind": "escpos" }
```

### Generar API Keys por impresora
```json
POST /api/keys/ensure
{}
```

### Rotar API Key de una impresora
```json
POST /api/keys/rotate
{ "target": "EPSON TM-T20II", "target_type": "printer" }
```

### Enviar trabajo directo (debug)
```json
{ "job": { "job_id": "1", "type": "html", "printer_name": "EPSON TM-T20II", "payload": { "html": "<h1>Hola</h1>" } } }
```

## Protocolo WebSocket
### Mensaje de saludo (agente -> backend)
```json
{
  "type": "hello",
  "agent_id": "HOSTNAME",
  "api_key": "...",
  "version": "0.1.0",
  "capabilities": {"escpos": true, "pdf": true, "html": true, "template": true}
}
```

### Trabajo (backend -> agente)
```json
{
  "type": "job",
  "job": {
    "job_id": "uuid",
    "type": "escpos | pdf | html | template",
    "printer_name": "Nombre exacto de Windows",
    "copies": 1,
    "payload": { }
  }
}
```

### Resultado (agente -> backend)
```json
{
  "type": "job_result",
  "job_id": "uuid",
  "status": "ok | error",
  "error": "mensaje de error (si aplica)"
}
```

## Payloads
### ESC/POS
```json
{
  "raw_base64": "BASE64"
}
```

### PDF
```json
{
  "pdf_base64": "BASE64"
}
```

### HTML
```json
{
  "html": "<html>...</html>"
}
```

### Template
```json
{
  "template_id": "receipt",
  "data": {"key": "value"}
}
```

## Opciones de papel
```json
"options": {
  "paper_size": "80mm | 58mm | 54mm | A4 | Letter",
  "paper_width_mm": 80,
  "paper_height_mm": 500
}
```

Si el HTML incluye `@page` y estilos, el agente intentara respetarlos.

## Notas
- Para PDF se requiere SumatraPDF. Si no esta disponible, el trabajo fallara.
- ESC/POS usa envio RAW. El backend debe generar los comandos ESC/POS.
