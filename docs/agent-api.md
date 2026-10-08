# LocalMD agent API

This is LocalMD's API design. mdview Desktop's route details were not verified.

Enable the service in Preferences. It is disabled by default and binds exclusively to `127.0.0.1`. The default port is 39281; Preferences can change it, reports collisions, approves/removes root folders, copies the token/example and rotates the token. API clients cannot grant themselves roots. Reading works with the service disabled.

Every request must have `Host: 127.0.0.1:<configured-port>`. Requests carrying Origin are rejected. CORS is not enabled. Operations require `Authorization: Bearer <token>` and `Content-Type: application/json`. Do not place tokens in URLs or logs. The Windows token uses Electron safeStorage (OS protection); fallback platforms use restrictive file permissions. Rotation immediately invalidates the previous token.

Limits: 1 MiB total UTF-8 request body, 60 requests per minute, 16 concurrent connections, 10-second request/header timeout. Titles are capped at 200 characters. JSON results include `ok` and `documentId`; show results also include `ephemeral: true`. Errors use JSON `{ "error": "..." }`, with HTTP 400/401/403/404/413/415/429 as appropriate.

## Endpoints

`GET /v1/health` needs no token and returns only `{ "service": "LocalMD", "version": "1.0.2", "available": true }`.

`POST /v1/open` accepts `{ "path": "C:\\approved-folder\\report.md", "activate": true }`. The optional activate flag defaults to true. Paths must be absolute existing local files with .md/.markdown/.mmd/.mermaid extensions, under a UI-approved root after canonicalization. Junction/symlink escapes and UNC/network paths are rejected. Opening uses the same document registry and deduplicated tab service as the desktop chooser.

`POST /v1/show` accepts `{ "title": "Report", "markdown": "# Report" }`. It creates an ephemeral read-only tab without writing content to disk. These tabs are deliberately excluded from persisted disk-file sessions. No local base directory is inferred for supplied content.

No read-file, write-file, execute-command, publish, or approve-root endpoint exists.

## PowerShell

Copy the token in Preferences and put it in an environment variable in your own session:

```powershell
$env:LOCALMD_TOKEN = '<paste copied token here>'
$headers = @{ Authorization = "Bearer $env:LOCALMD_TOKEN" }
Invoke-RestMethod -Uri 'http://127.0.0.1:39281/v1/health'
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:39281/v1/open' `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ path = 'C:\approved-folder\report.md'; activate = $true } | ConvertTo-Json)
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:39281/v1/show' `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ title = 'Agent report'; markdown = "# Report`n`nFinished locally." } | ConvertTo-Json)
```

Use the actual configured port. The example keeps secrets in an environment variable and never embeds them in a URL.
