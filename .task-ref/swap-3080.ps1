# Swap 3080 to the D: build: kill the old 3080 host and start the new build on 3080.
# Runs DETACHED so it survives the old host's termination (TerminateProcess does not
# kill descendants). The initial sleep gives the launching agent time to finish its
# response before its host dies.
$dir = 'D:\Github\dsh_test'
$out = Join-Path $dir '.task-ref\server-3080.out.log'
$err = Join-Path $dir '.task-ref\server-3080.err.log'
$log = Join-Path $dir '.task-ref\start-3080.log'
New-Item -ItemType Directory -Force -Path (Join-Path $dir '.task-ref') | Out-Null

Start-Sleep -Seconds 60

# Kill the old 3080 host (whatever currently listens on 3080).
$conn = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
  Add-Content -Path $log -Value ("killed old 3080 pid " + $conn.OwningProcess)
}
Start-Sleep -Seconds 2

# Start the new build on 3080.
Start-Process -FilePath 'D:\nodejs\node.exe' `
  -ArgumentList '--import','tsx/esm','apps/cli/src/bin.ts','web','--port','3080' `
  -WorkingDirectory $dir `
  -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $out -RedirectStandardError $err |
  ForEach-Object { Add-Content -Path $log -Value ("started new 3080 pid " + $_.Id) }

# Poll until 3080 serves (up to ~3 minutes).
for ($i = 0; $i -lt 36; $i++) {
  try {
    $r = Invoke-WebRequest 'http://127.0.0.1:3080/' -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) {
      Add-Content -Path $log -Value ("3080 UP after ~$($i*5)s")
      break
    }
  } catch { Start-Sleep -Seconds 5 }
}
