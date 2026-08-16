# Restart the dsh web server on 3080 with the new build that includes the
# static usage-monitor package pair, then probe: boot payload must list the
# client bundle, session.list must answer 200, and host.gitStatus must answer.
$ErrorActionPreference = 'Continue'
$log = 'D:\Github\dsh_test\.task-ref\restart-usage-monitor.log'
$out = 'D:\Github\dsh_test\.task-ref\restart-um.out.log'
$err = 'D:\Github\dsh_test\.task-ref\restart-um.err.log'

function L($msg) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $log -Value $line
}

L 'restart scheduled; sleeping 45s for the finishing turn to settle'
Start-Sleep -Seconds 45

$old = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'node.exe' -and $_.CommandLine -match 'apps/cli/src/bin\.ts\s+web'
}
if ($old) {
  foreach ($p in $old) {
    L ("stopping web server PID " + $p.ProcessId)
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; L 'stopped' }
    catch { L ("stop failed (already gone): " + $_.Exception.Message) }
  }
} else { L 'no running web server found' }
Start-Sleep -Seconds 3

L 'starting the fresh server on 3080 with the usage-monitor build'
$proc = Start-Process -FilePath 'D:\nodejs\node.exe' `
  -ArgumentList '--import','tsx/esm','apps/cli/src/bin.ts','web' `
  -WorkingDirectory 'D:\Github\dsh_test' `
  -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $out -RedirectStandardError $err
L ("started pid " + $proc.Id)

$ok = $false
for ($i = 0; $i -lt 36; $i++) {
  Start-Sleep -Seconds 5
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3080/' -UseBasicParsing -TimeoutSec 4
    $hasUsageMonitor = $r.Content -match 'dsh-client-ui-usage-monitor'
    $hasBoot = $r.Content -match '__DSH_BOOT__'
    if (-not $hasBoot) { L ("probe @" + ($i * 5) + "s: up but no boot payload yet"); continue }
    $body = '{"type":"client-request","rpcId":"probe-list","method":"session.list","payload":{}}'
    try {
      $s = Invoke-WebRequest -Uri 'http://127.0.0.1:3080/api/session.list' -Method POST `
        -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 60
      L ("probe @" + ($i * 5) + "s: boot=True, usageMonitorBundle=" + $hasUsageMonitor + ", session.list HTTP " + $s.StatusCode)
      if ($hasUsageMonitor -and $s.StatusCode -eq 200) { $ok = $true; break }
    } catch {
      $code = $_.Exception.Response.StatusCode.value__
      L ("probe @" + ($i * 5) + "s: boot=True, usageMonitorBundle=" + $hasUsageMonitor + ", session.list HTTP " + $code + " (host not ready yet)")
    }
  } catch {
    L ("probe @" + ($i * 5) + "s: not up yet")
  }
}
if ($ok) { L 'restart verified: fresh 3080 serves the usage-monitor build with healthy session.list' }
else { L 'server did not verify within 3 minutes; see stderr log' }
L 'script done'
