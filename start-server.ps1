param([int]$Port = 8080)

# Egyszerű statikus HTTP szerver tiszta TCP-n.
# A HttpListener-rel ellentétben nem utasítja el a Cloudflare/ngrok alagutak
# által küldött idegen Host fejlécet, ezért PWA-alagúthoz is jó.

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
  '.wasm' = 'application/wasm'
  '.bin'  = 'application/octet-stream'
  '.md'   = 'text/markdown; charset=utf-8'
}

function Get-ContentType([string]$path) {
  $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($mime.ContainsKey($ext)) { return $mime[$ext] }
  return 'application/octet-stream'
}

function Write-Response($stream, [int]$status, [string]$statusText, [string]$contentType, [byte[]]$bytes) {
  $head = "HTTP/1.1 $status $statusText`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
  $headBytes = [Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($headBytes, 0, $headBytes.Length)
  if ($bytes.Length -gt 0) { $stream.Write($bytes, 0, $bytes.Length) }
  $stream.Flush()
}

Write-Host "Offline AI Studio: http://localhost:$Port/"
Write-Host "Press Ctrl+C to stop."

try {
  while ($true) {
    try {
      $client = $listener.AcceptTcpClient()
    } catch { break }
    try {
      $stream = $client.GetStream()
      $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
      $line = $reader.ReadLine()
      if (-not $line) { continue }
      $parts = $line -split ' '
      $path = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
      # Fejlécek eltöltése (a Host fejlécet szándékosan figyelmen kívül hagyjuk).
      while (($null -ne ($h = $reader.ReadLine())) -and $h.Length -gt 0) { }

      $relative = [Uri]::UnescapeDataString(($path -split '\?')[0].TrimStart('/'))
      if ([string]::IsNullOrEmpty($relative)) { $relative = 'index.html' }
      $full = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $relative))
      if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        $body = [Text.Encoding]::UTF8.GetBytes('403 Forbidden')
        Write-Response $stream 403 'Forbidden' 'text/plain; charset=utf-8' $body
      } elseif (Test-Path $full -PathType Leaf) {
        $bytes = [IO.File]::ReadAllBytes($full)
        Write-Response $stream 200 'OK' (Get-ContentType $full) $bytes
      } else {
        $body = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
        Write-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' $body
      }
    } catch {
      try { if ($stream) { Write-Response $stream 500 'Internal Server Error' 'text/plain' ([Text.Encoding]::ASCII.GetBytes('500')) } } catch { }
    } finally {
      if ($client) { $client.Close() }
    }
  }
} finally {
  $listener.Stop()
}
